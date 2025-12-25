/**
 * Gramps XML Importer for Canvas Roots
 *
 * Imports Gramps XML data into the Obsidian vault as person notes.
 */

import { App, Notice, TFile, normalizePath } from 'obsidian';
import { GrampsParser, ParsedGrampsData, ParsedGrampsPerson, ParsedGrampsPlace, ParsedGrampsEvent, ParsedGrampsSource } from './gramps-parser';
import { GrampsValidationResult } from './gramps-types';
import { createPersonNote, PersonData } from '../core/person-note-writer';
import { createPlaceNote, PlaceData } from '../core/place-note-writer';
import { generateCrId } from '../core/uuid';
import { getErrorMessage } from '../core/error-utils';
import { getLogger } from '../core/logging';

const logger = getLogger('GrampsImporter');

/**
 * Import progress phases for Gramps
 */
export type GrampsImportPhase =
	| 'validating'
	| 'parsing'
	| 'media'
	| 'places'
	| 'sources'
	| 'people'
	| 'events'
	| 'complete';

/**
 * Progress callback for Gramps import
 */
export interface GrampsImportProgress {
	phase: GrampsImportPhase;
	current: number;
	total: number;
	message?: string;
}

/**
 * Dynamic block type for person notes
 */
export type DynamicBlockType = 'timeline' | 'relationships' | 'media';

/**
 * Gramps import options
 */
export interface GrampsImportOptions {
	peopleFolder: string;
	overwriteExisting: boolean;
	fileName?: string;
	/** Property aliases for writing custom property names (user property → canonical) */
	propertyAliases?: Record<string, string>;
	/** Whether to create place notes (default: false) */
	createPlaceNotes?: boolean;
	/** Folder for place notes (default: same as peopleFolder) */
	placesFolder?: string;
	/** Whether to create event notes (default: false) */
	createEventNotes?: boolean;
	/** Folder for event notes */
	eventsFolder?: string;
	/** Whether to create source notes (default: true) */
	createSourceNotes?: boolean;
	/** Folder for source notes */
	sourcesFolder?: string;
	/** Include dynamic content blocks in person notes */
	includeDynamicBlocks?: boolean;
	/** Which dynamic block types to include */
	dynamicBlockTypes?: DynamicBlockType[];
	/** Progress callback */
	onProgress?: (progress: GrampsImportProgress) => void;
	/** Media files extracted from .gpkg package (path → binary content) */
	mediaFiles?: Map<string, ArrayBuffer>;
	/** Folder to store extracted media files */
	mediaFolder?: string;
	/** Whether to extract and save media files from .gpkg packages */
	extractMedia?: boolean;
	/** Preserve subfolder structure when extracting media (default: false = flat folder) */
	preserveMediaFolderStructure?: boolean;
}

/**
 * Gramps import result
 */
export interface GrampsImportResult {
	success: boolean;
	individualsImported: number;
	notesCreated: number;
	notesUpdated: number;
	notesSkipped: number;
	errors: string[];
	validation?: GrampsValidationResult;
	fileName?: string;
	malformedDataCount?: number;
	placesImported?: number;
	placeNotesCreated?: number;
	eventsImported?: number;
	eventNotesCreated?: number;
	sourcesImported?: number;
	sourceNotesCreated?: number;
	mediaFilesExtracted?: number;
	/** Mapping from Gramps media handle to vault path (for linking) */
	mediaHandleToPath?: Map<string, string>;
}

/**
 * Import Gramps XML files into Canvas Roots
 */
export class GrampsImporter {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Analyze Gramps file before import
	 * Returns basic statistics and component analysis
	 */
	analyzeFile(content: string): {
		individualCount: number;
		familyCount: number;
		placeCount: number;
		eventCount: number;
		sourceCount: number;
		componentCount: number;
	} {
		const data = GrampsParser.parse(content);

		// Count individuals
		const individualCount = data.persons.size;

		// Count relationships by looking at spouse and parent references
		let familyCount = 0;
		for (const [, person] of data.persons) {
			familyCount += person.spouseRefs.length;
			if (person.fatherRef) familyCount++;
			if (person.motherRef) familyCount++;
		}
		// Divide by 2 since relationships are counted from both sides
		familyCount = Math.floor(familyCount / 2);

		// Analyze connected components using BFS
		const visited = new Set<string>();
		let componentCount = 0;

		for (const [personId] of data.persons) {
			if (visited.has(personId)) continue;

			// Start BFS from this individual
			componentCount++;
			const queue: string[] = [personId];

			while (queue.length > 0) {
				const currentId = queue.shift()!;
				if (visited.has(currentId)) continue;

				visited.add(currentId);
				const person = data.persons.get(currentId);
				if (!person) continue;

				// Add connected people (parents, spouses)
				const related: string[] = [];

				if (person.fatherRef) related.push(person.fatherRef);
				if (person.motherRef) related.push(person.motherRef);
				related.push(...person.spouseRefs);

				// Find children (people who have this person as a parent)
				for (const [, otherPerson] of data.persons) {
					if (otherPerson.fatherRef === currentId || otherPerson.motherRef === currentId) {
						related.push(otherPerson.handle);
					}
				}

				// Queue unvisited relatives
				for (const relatedId of related) {
					if (!visited.has(relatedId) && data.persons.has(relatedId)) {
						queue.push(relatedId);
					}
				}
			}
		}

		// Count places
		const placeCount = data.places.size;

		// Count events
		const eventCount = data.events.size;

		// Count sources
		const sourceCount = data.sources.size;

		return {
			individualCount,
			familyCount,
			placeCount,
			eventCount,
			sourceCount,
			componentCount
		};
	}

	/**
	 * Import Gramps file
	 */
	async importFile(
		content: string,
		options: GrampsImportOptions
	): Promise<GrampsImportResult> {
		const result: GrampsImportResult = {
			success: false,
			individualsImported: 0,
			notesCreated: 0,
			notesUpdated: 0,
			notesSkipped: 0,
			errors: [],
			fileName: options.fileName,
			malformedDataCount: 0,
			placesImported: 0,
			placeNotesCreated: 0,
			eventsImported: 0,
			eventNotesCreated: 0,
			sourcesImported: 0,
			sourceNotesCreated: 0,
			mediaFilesExtracted: 0,
			mediaHandleToPath: new Map()
		};

		// Helper to report progress
		const reportProgress = (phase: GrampsImportPhase, current: number, total: number, message?: string) => {
			if (options.onProgress) {
				options.onProgress({ phase, current, total, message });
			}
		};

		try {
			// Validate Gramps XML first
			reportProgress('validating', 0, 1, 'Validating Gramps XML file…');
			const validation = GrampsParser.validate(content);
			result.validation = validation;

			// Check for critical errors
			if (!validation.valid) {
				result.errors.push(...validation.errors.map(e => e.message));
				new Notice(`Gramps XML validation failed: ${validation.errors[0].message}`);
				return result;
			}

			// Show validation summary
			if (validation.warnings.length > 0) {
				new Notice(`Found ${validation.warnings.length} warning(s) - import will continue`);
			}
			reportProgress('validating', 1, 1, 'Validation complete');

			// Parse Gramps XML
			reportProgress('parsing', 0, 1, 'Parsing Gramps XML file…');
			const grampsData = GrampsParser.parse(content);
			reportProgress('parsing', 1, 1, `Parsed ${grampsData.persons.size} individuals`);

			logger.info('importFile', `Starting import of ${grampsData.persons.size} persons`);

			// Ensure folders exist
			await this.ensureFolderExists(options.peopleFolder);

			// Extract media files from .gpkg package if provided
			if (options.extractMedia !== false && options.mediaFiles && options.mediaFiles.size > 0) {
				const mediaFolder = options.mediaFolder || 'Canvas Roots/Media';
				await this.ensureFolderExists(mediaFolder);

				const mediaTotal = options.mediaFiles.size;
				reportProgress('media', 0, mediaTotal, `Extracting ${mediaTotal} media files...`);

				let mediaIndex = 0;
				for (const [relativePath, content] of options.mediaFiles) {
					try {
						const vaultPath = await this.extractMediaFile(
							relativePath,
							content,
							mediaFolder,
							grampsData,
							result.mediaHandleToPath!,
							options.preserveMediaFolderStructure ?? false
						);
						if (vaultPath) {
							result.mediaFilesExtracted = (result.mediaFilesExtracted || 0) + 1;
						}
					} catch (error: unknown) {
						result.errors.push(
							`Failed to extract media file ${relativePath}: ${getErrorMessage(error)}`
						);
					}
					mediaIndex++;
					reportProgress('media', mediaIndex, mediaTotal);
				}

				logger.info('importFile', `Extracted ${result.mediaFilesExtracted} media files to ${mediaFolder}`);
			}

			// Create mapping of Gramps handles to cr_ids
			const grampsToCrId = new Map<string, string>();
			// Mapping from place name to wikilink (for linking in person notes)
			const placeNameToWikilink = new Map<string, string>();

			// Create place notes FIRST if requested (so we can link to them from person notes)
			if (options.createPlaceNotes && grampsData.places.size > 0) {
				const placesTotal = grampsData.places.size;
				reportProgress('places', 0, placesTotal, `Creating ${placesTotal} place notes...`);
				const placesFolder = options.placesFolder || options.peopleFolder;
				await this.ensureFolderExists(placesFolder);

				let placeIndex = 0;
				for (const [handle, place] of grampsData.places) {
					try {
						const crId = await this.importPlace(place, placesFolder, options, result.mediaHandleToPath);
						if (crId !== null) {
							// Place was created
							result.placeNotesCreated = (result.placeNotesCreated || 0) + 1;
						}
						// Always count as imported (even if skipped due to existing)
						result.placesImported = (result.placesImported || 0) + 1;

						// Store mapping from place name to wikilink for use in person notes
						if (place.name) {
							placeNameToWikilink.set(place.name, `[[${place.name}]]`);
						}
					} catch (error: unknown) {
						result.errors.push(
							`Failed to import place ${place.name || handle}: ${getErrorMessage(error)}`
						);
					}
					placeIndex++;
					reportProgress('places', placeIndex, placesTotal);
				}
			}

			// Create mapping of source handles to cr_ids and wikilinks
			const sourceHandleToCrId = new Map<string, string>();
			const sourceHandleToWikilink = new Map<string, string>();

			// Create source notes if requested (default: true)
			const shouldCreateSources = options.createSourceNotes !== false;
			if (shouldCreateSources && grampsData.sources.size > 0) {
				const sourcesTotal = grampsData.sources.size;
				reportProgress('sources', 0, sourcesTotal, `Creating ${sourcesTotal} source notes...`);
				const sourcesFolder = options.sourcesFolder || 'Canvas Roots/Sources';
				await this.ensureFolderExists(sourcesFolder);

				let sourceIndex = 0;
				for (const [handle, source] of grampsData.sources) {
					try {
						const { crId, wikilink } = await this.importSource(
							source,
							sourcesFolder,
							options,
							result.mediaHandleToPath
						);
						sourceHandleToCrId.set(handle, crId);
						sourceHandleToWikilink.set(handle, wikilink);
						result.sourcesImported = (result.sourcesImported || 0) + 1;
						result.sourceNotesCreated = (result.sourceNotesCreated || 0) + 1;
					} catch (error: unknown) {
						result.errors.push(
							`Failed to import source ${source.title || handle}: ${getErrorMessage(error)}`
						);
					}
					sourceIndex++;
					reportProgress('sources', sourceIndex, sourcesTotal);
				}
			}

			// Build citation handle to source wikilink mapping
			const citationToSourceWikilink = new Map<string, string>();
			for (const [citationHandle, citation] of grampsData.citations) {
				if (citation.sourceHandle) {
					const sourceWikilink = sourceHandleToWikilink.get(citation.sourceHandle);
					if (sourceWikilink) {
						citationToSourceWikilink.set(citationHandle, sourceWikilink);
					}
				}
			}

			// Create person notes
			const peopleTotal = grampsData.persons.size;
			reportProgress('people', 0, peopleTotal, 'Creating person notes...');

			// First pass: Create all person notes
			let personIndex = 0;
			for (const [handle, person] of grampsData.persons) {
				try {
					const crId = await this.importPerson(
						person,
						grampsData,
						options,
						grampsToCrId,
						placeNameToWikilink,
						result.mediaHandleToPath
					);

					grampsToCrId.set(handle, crId);
					result.individualsImported++;
					result.notesCreated++;

					// Track malformed data (missing name or dates)
					if (!person.name || person.name.startsWith('Unknown') ||
						!person.birthDate || !person.deathDate) {
						if (result.malformedDataCount !== undefined) {
							result.malformedDataCount++;
						}
					}
				} catch (error: unknown) {
					result.errors.push(
						`Failed to import ${person.name}: ${getErrorMessage(error)}`
					);
				}
				personIndex++;
				reportProgress('people', personIndex, peopleTotal);
			}

			// Second pass: Update relationships now that all cr_ids are known
			// Note: This is a quick pass, no separate progress phase needed
			for (const [, person] of grampsData.persons) {
				try {
					await this.updateRelationships(
						person,
						grampsData,
						grampsToCrId,
						options
					);
				} catch (error: unknown) {
					result.errors.push(
						`Failed to update relationships for ${person.name}: ${getErrorMessage(error)}`
					);
				}
			}

			// Create event notes if requested
			if (options.createEventNotes && grampsData.events.size > 0) {
				const eventsTotal = grampsData.events.size;
				reportProgress('events', 0, eventsTotal, `Creating ${eventsTotal} event notes...`);
				const eventsFolder = options.eventsFolder || 'Canvas Roots/Events';
				await this.ensureFolderExists(eventsFolder);

				let eventIndex = 0;
				for (const [handle, event] of grampsData.events) {
					try {
						await this.importEvent(
							event,
							grampsData,
							grampsToCrId,
							placeNameToWikilink,
							citationToSourceWikilink,
							eventsFolder,
							options,
							result.mediaHandleToPath
						);
						result.eventsImported = (result.eventsImported || 0) + 1;
						result.eventNotesCreated = (result.eventNotesCreated || 0) + 1;
					} catch (error: unknown) {
						result.errors.push(
							`Failed to import event ${event.type || handle}: ${getErrorMessage(error)}`
						);
					}
					eventIndex++;
					reportProgress('events', eventIndex, eventsTotal);
				}
			}

			// Mark import as complete
			reportProgress('complete', 1, 1, 'Import complete');

			// Enhanced import complete notice
			let importMessage = `Import complete: ${result.notesCreated} people imported`;

			if (result.sourceNotesCreated && result.sourceNotesCreated > 0) {
				importMessage += `, ${result.sourceNotesCreated} sources`;
			}

			if (result.placeNotesCreated && result.placeNotesCreated > 0) {
				importMessage += `, ${result.placeNotesCreated} places`;
			}

			if (result.eventNotesCreated && result.eventNotesCreated > 0) {
				importMessage += `, ${result.eventNotesCreated} events`;
			}

			if (result.malformedDataCount && result.malformedDataCount > 0) {
				importMessage += `. ${result.malformedDataCount} had missing/invalid data`;
			}

			if (result.errors.length > 0) {
				importMessage += `. ${result.errors.length} errors occurred`;
			}

			new Notice(importMessage, 8000);
			result.success = result.errors.length === 0;

			logger.info('importFile', `Import complete: ${result.notesCreated} notes created, ${result.errors.length} errors`);

		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			result.errors.push(`Gramps XML parse error: ${errorMsg}`);
			new Notice(`Import failed: ${errorMsg}`);
			logger.error('importFile', 'Import failed', error);
		}

		return result;
	}

	/**
	 * Import a single person
	 */
	private async importPerson(
		person: ParsedGrampsPerson,
		grampsData: ParsedGrampsData,
		options: GrampsImportOptions,
		grampsToCrId: Map<string, string>,
		placeNameToWikilink: Map<string, string>,
		mediaHandleToPath?: Map<string, string>
	): Promise<string> {
		const crId = generateCrId();

		// Convert place names to wikilinks if place notes were created
		const birthPlaceValue = person.birthPlace
			? (placeNameToWikilink.get(person.birthPlace) || person.birthPlace)
			: undefined;
		const deathPlaceValue = person.deathPlace
			? (placeNameToWikilink.get(person.deathPlace) || person.deathPlace)
			: undefined;

		// Resolve media references to wikilinks
		const resolvedMedia: string[] = [];
		if (person.mediaRefs && person.mediaRefs.length > 0 && mediaHandleToPath) {
			for (const ref of person.mediaRefs) {
				const vaultPath = mediaHandleToPath.get(ref);
				if (vaultPath) {
					const filename = vaultPath.split('/').pop() || vaultPath;
					resolvedMedia.push(`"[[${filename}]]"`);
				}
			}
		}

		// Convert Gramps person to PersonData
		const personData: PersonData = {
			name: person.name || 'Unknown',
			crId: crId,
			birthDate: person.birthDate,
			deathDate: person.deathDate,
			birthPlace: birthPlaceValue,
			deathPlace: deathPlaceValue,
			occupation: person.occupation,
			sex: person.gender === 'M' ? 'male' : person.gender === 'F' ? 'female' : undefined,
			media: resolvedMedia.length > 0 ? resolvedMedia : undefined
		};

		// Add relationship references with Gramps handles (temporary) and names
		if (person.fatherRef) {
			personData.fatherCrId = person.fatherRef; // Temporary Gramps handle
			const father = grampsData.persons.get(person.fatherRef);
			if (father) {
				personData.fatherName = father.name || 'Unknown';
			}
		}

		if (person.motherRef) {
			personData.motherCrId = person.motherRef; // Temporary Gramps handle
			const mother = grampsData.persons.get(person.motherRef);
			if (mother) {
				personData.motherName = mother.name || 'Unknown';
			}
		}

		if (person.spouseRefs.length > 0) {
			personData.spouseCrId = person.spouseRefs; // Temporary Gramps handles
			personData.spouseName = person.spouseRefs.map(ref => {
				const spouse = grampsData.persons.get(ref);
				return spouse?.name || 'Unknown';
			});
		}

		// Add step-parent references (from mrel/frel = 'Stepchild')
		if (person.stepfatherRefs.length > 0) {
			personData.stepfatherCrId = person.stepfatherRefs; // Temporary Gramps handles
			personData.stepfatherName = person.stepfatherRefs.map(ref => {
				const stepfather = grampsData.persons.get(ref);
				return stepfather?.name || 'Unknown';
			});
		}

		if (person.stepmotherRefs.length > 0) {
			personData.stepmotherCrId = person.stepmotherRefs; // Temporary Gramps handles
			personData.stepmotherName = person.stepmotherRefs.map(ref => {
				const stepmother = grampsData.persons.get(ref);
				return stepmother?.name || 'Unknown';
			});
		}

		// Add adoptive parent references (from mrel/frel = 'Adopted')
		if (person.adoptiveFatherRef) {
			personData.adoptiveFatherCrId = person.adoptiveFatherRef; // Temporary Gramps handle
			const adoptiveFather = grampsData.persons.get(person.adoptiveFatherRef);
			if (adoptiveFather) {
				personData.adoptiveFatherName = adoptiveFather.name || 'Unknown';
			}
		}

		if (person.adoptiveMotherRef) {
			personData.adoptiveMotherCrId = person.adoptiveMotherRef; // Temporary Gramps handle
			const adoptiveMother = grampsData.persons.get(person.adoptiveMotherRef);
			if (adoptiveMother) {
				personData.adoptiveMotherName = adoptiveMother.name || 'Unknown';
			}
		}

		// Find children (people who have this person as a parent)
		const childRefs: string[] = [];
		const childNames: string[] = [];
		for (const [childHandle, child] of grampsData.persons) {
			if (child.fatherRef === person.handle || child.motherRef === person.handle) {
				if (!childRefs.includes(childHandle)) {
					childRefs.push(childHandle);
					childNames.push(child.name || 'Unknown');
				}
			}
		}
		if (childRefs.length > 0) {
			personData.childCrId = childRefs; // Temporary Gramps handles
			personData.childName = childNames;
		}

		// Write person note using the createPersonNote function
		// Disable bidirectional linking during import - we'll fix relationships in pass 2
		await createPersonNote(this.app, personData, {
			directory: options.peopleFolder,
			addBidirectionalLinks: false,
			propertyAliases: options.propertyAliases,
			includeDynamicBlocks: options.includeDynamicBlocks,
			dynamicBlockTypes: options.dynamicBlockTypes
		});

		return crId;
	}

	/**
	 * Update relationships with actual cr_ids
	 */
	private async updateRelationships(
		person: ParsedGrampsPerson,
		_grampsData: ParsedGrampsData,
		grampsToCrId: Map<string, string>,
		options: GrampsImportOptions
	): Promise<void> {
		const crId = grampsToCrId.get(person.handle);
		if (!crId) return;

		// Generate the expected file name
		const fileName = this.generateFileName(person.name || 'Unknown');
		const filePath = options.peopleFolder
			? `${options.peopleFolder}/${fileName}`
			: fileName;

		const normalizedPath = normalizePath(filePath);
		const file = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (!file || !(file instanceof TFile)) {
			return;
		}

		// Read the file
		const content = await this.app.vault.read(file);

		// Update frontmatter with real cr_ids (replacing temporary Gramps handles)
		let updatedContent = content;

		// Replace father_id reference with real cr_id
		if (person.fatherRef) {
			const fatherCrId = grampsToCrId.get(person.fatherRef);
			if (fatherCrId) {
				const escapedRef = this.escapeRegex(person.fatherRef);
				updatedContent = updatedContent.replace(
					new RegExp(`father_id: ${escapedRef}`, 'g'),
					`father_id: ${fatherCrId}`
				);
			}
		}

		// Replace mother_id reference with real cr_id
		if (person.motherRef) {
			const motherCrId = grampsToCrId.get(person.motherRef);
			if (motherCrId) {
				const escapedRef = this.escapeRegex(person.motherRef);
				updatedContent = updatedContent.replace(
					new RegExp(`mother_id: ${escapedRef}`, 'g'),
					`mother_id: ${motherCrId}`
				);
			}
		}

		// Replace spouse_id references with real cr_ids
		// Use a targeted approach to avoid cross-contamination with other arrays
		if (person.spouseRefs.length > 0) {
			// Handle array format
			const spouseIdMatch = updatedContent.match(/^spouse_id:\n((?:\s{2}-\s+[^\n]+\n?)+)/m);
			if (spouseIdMatch) {
				let spouseIdBlock = spouseIdMatch[0];
				for (const spouseRef of person.spouseRefs) {
					const spouseCrId = grampsToCrId.get(spouseRef);
					if (spouseCrId && spouseIdBlock.includes(spouseRef)) {
						const escapedRef = this.escapeRegex(spouseRef);
						spouseIdBlock = spouseIdBlock.replace(
							new RegExp(`(\\s{2}-\\s+)${escapedRef}`, 'g'),
							`$1${spouseCrId}`
						);
					}
				}
				updatedContent = updatedContent.replace(spouseIdMatch[0], spouseIdBlock);
			}
			// Handle single-value format (spouse_id: handle)
			for (const spouseRef of person.spouseRefs) {
				const spouseCrId = grampsToCrId.get(spouseRef);
				if (spouseCrId) {
					const escapedRef = this.escapeRegex(spouseRef);
					updatedContent = updatedContent.replace(
						new RegExp(`^(spouse_id:\\s+)${escapedRef}$`, 'gm'),
						`$1${spouseCrId}`
					);
				}
			}
		}

		// Replace children_id references with real cr_ids
		// Use a targeted approach: extract, replace, and re-insert the children_id block
		const childrenIdMatch = updatedContent.match(/^children_id:\n((?:\s{2}-\s+[^\n]+\n?)+)/m);
		if (childrenIdMatch) {
			let childrenIdBlock = childrenIdMatch[0];
			for (const [childHandle] of grampsToCrId) {
				const childCrId = grampsToCrId.get(childHandle);
				if (childCrId && childrenIdBlock.includes(childHandle)) {
					const escapedRef = this.escapeRegex(childHandle);
					childrenIdBlock = childrenIdBlock.replace(
						new RegExp(`(\\s{2}-\\s+)${escapedRef}`, 'g'),
						`$1${childCrId}`
					);
				}
			}
			updatedContent = updatedContent.replace(childrenIdMatch[0], childrenIdBlock);
		}
		// Also handle single-value format (children_id: handle)
		for (const [childHandle] of grampsToCrId) {
			const childCrId = grampsToCrId.get(childHandle);
			if (childCrId && content.includes(childHandle)) {
				const escapedRef = this.escapeRegex(childHandle);
				updatedContent = updatedContent.replace(
					new RegExp(`^(children_id:\\s+)${escapedRef}$`, 'gm'),
					`$1${childCrId}`
				);
			}
		}

		// Replace stepfather_id references with real cr_ids
		// Use a targeted approach to avoid cross-contamination with other arrays
		if (person.stepfatherRefs.length > 0) {
			// Handle array format
			const stepfatherIdMatch = updatedContent.match(/^stepfather_id:\n((?:\s{2}-\s+[^\n]+\n?)+)/m);
			if (stepfatherIdMatch) {
				let stepfatherIdBlock = stepfatherIdMatch[0];
				for (const stepfatherRef of person.stepfatherRefs) {
					const stepfatherCrId = grampsToCrId.get(stepfatherRef);
					if (stepfatherCrId && stepfatherIdBlock.includes(stepfatherRef)) {
						const escapedRef = this.escapeRegex(stepfatherRef);
						stepfatherIdBlock = stepfatherIdBlock.replace(
							new RegExp(`(\\s{2}-\\s+)${escapedRef}`, 'g'),
							`$1${stepfatherCrId}`
						);
					}
				}
				updatedContent = updatedContent.replace(stepfatherIdMatch[0], stepfatherIdBlock);
			}
			// Handle single-value format
			for (const stepfatherRef of person.stepfatherRefs) {
				const stepfatherCrId = grampsToCrId.get(stepfatherRef);
				if (stepfatherCrId) {
					const escapedRef = this.escapeRegex(stepfatherRef);
					updatedContent = updatedContent.replace(
						new RegExp(`^(stepfather_id:\\s+)${escapedRef}$`, 'gm'),
						`$1${stepfatherCrId}`
					);
				}
			}
		}

		// Replace stepmother_id references with real cr_ids
		// Use a targeted approach to avoid cross-contamination with other arrays
		if (person.stepmotherRefs.length > 0) {
			// Handle array format
			const stepmotherIdMatch = updatedContent.match(/^stepmother_id:\n((?:\s{2}-\s+[^\n]+\n?)+)/m);
			if (stepmotherIdMatch) {
				let stepmotherIdBlock = stepmotherIdMatch[0];
				for (const stepmotherRef of person.stepmotherRefs) {
					const stepmotherCrId = grampsToCrId.get(stepmotherRef);
					if (stepmotherCrId && stepmotherIdBlock.includes(stepmotherRef)) {
						const escapedRef = this.escapeRegex(stepmotherRef);
						stepmotherIdBlock = stepmotherIdBlock.replace(
							new RegExp(`(\\s{2}-\\s+)${escapedRef}`, 'g'),
							`$1${stepmotherCrId}`
						);
					}
				}
				updatedContent = updatedContent.replace(stepmotherIdMatch[0], stepmotherIdBlock);
			}
			// Handle single-value format
			for (const stepmotherRef of person.stepmotherRefs) {
				const stepmotherCrId = grampsToCrId.get(stepmotherRef);
				if (stepmotherCrId) {
					const escapedRef = this.escapeRegex(stepmotherRef);
					updatedContent = updatedContent.replace(
						new RegExp(`^(stepmother_id:\\s+)${escapedRef}$`, 'gm'),
						`$1${stepmotherCrId}`
					);
				}
			}
		}

		// Replace adoptive_father_id reference with real cr_id
		if (person.adoptiveFatherRef) {
			const adoptiveFatherCrId = grampsToCrId.get(person.adoptiveFatherRef);
			if (adoptiveFatherCrId) {
				const escapedRef = this.escapeRegex(person.adoptiveFatherRef);
				updatedContent = updatedContent.replace(
					new RegExp(`adoptive_father_id: ${escapedRef}`, 'g'),
					`adoptive_father_id: ${adoptiveFatherCrId}`
				);
			}
		}

		// Replace adoptive_mother_id reference with real cr_id
		if (person.adoptiveMotherRef) {
			const adoptiveMotherCrId = grampsToCrId.get(person.adoptiveMotherRef);
			if (adoptiveMotherCrId) {
				const escapedRef = this.escapeRegex(person.adoptiveMotherRef);
				updatedContent = updatedContent.replace(
					new RegExp(`adoptive_mother_id: ${escapedRef}`, 'g'),
					`adoptive_mother_id: ${adoptiveMotherCrId}`
				);
			}
		}

		// Write updated content if changed
		if (updatedContent !== content) {
			await this.app.vault.modify(file, updatedContent);
		}
	}

	/**
	 * Escape special regex characters in a string
	 */
	private escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	/**
	 * Generate file name from person name
	 */
	private generateFileName(name: string): string {
		// Sanitize name for file system
		const sanitized = name
			.replace(/[\\/:*?"<>|]/g, '-')
			.replace(/\s+/g, ' ')
			.trim();

		return `${sanitized}.md`;
	}

	/**
	 * Ensure folder exists, create if necessary
	 */
	private async ensureFolderExists(folderPath: string): Promise<void> {
		if (!folderPath) return;

		const normalizedPath = normalizePath(folderPath);
		const folder = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (!folder) {
			await this.app.vault.createFolder(normalizedPath);
		}
	}

	/**
	 * Extract a media file from .gpkg package to the vault
	 *
	 * @param relativePath - Relative path from the .gpkg media folder
	 * @param content - Binary content of the file
	 * @param mediaFolder - Target folder in the vault
	 * @param grampsData - Parsed Gramps data to look up media handles
	 * @param handleToPath - Map to populate with handle → vault path mappings
	 * @param preserveStructure - Whether to preserve subfolder structure from source
	 * @returns The vault path where the file was saved, or null if skipped
	 */
	private async extractMediaFile(
		relativePath: string,
		content: ArrayBuffer,
		mediaFolder: string,
		grampsData: ParsedGrampsData,
		handleToPath: Map<string, string>,
		preserveStructure: boolean
	): Promise<string | null> {
		let vaultPath: string;

		if (preserveStructure) {
			// Preserve the subfolder structure from the source
			// Strip any absolute path prefix (e.g., C:\Users\... or /home/...)
			let cleanPath = relativePath;

			// Remove Windows absolute path prefix
			if (/^[A-Za-z]:[\\/]/.test(cleanPath)) {
				cleanPath = cleanPath.replace(/^[A-Za-z]:[\\/]/, '');
			}
			// Remove Unix absolute path prefix
			if (cleanPath.startsWith('/')) {
				cleanPath = cleanPath.substring(1);
			}

			vaultPath = normalizePath(`${mediaFolder}/${cleanPath}`);

			// Ensure parent directories exist
			const parentDir = vaultPath.substring(0, vaultPath.lastIndexOf('/'));
			if (parentDir && parentDir !== mediaFolder) {
				await this.ensureFolderExists(parentDir);
			}
		} else {
			// Flat import: just use the filename
			const filename = relativePath.split('/').pop() || relativePath;
			vaultPath = normalizePath(`${mediaFolder}/${filename}`);
		}

		// Check if file already exists
		const existing = this.app.vault.getAbstractFileByPath(vaultPath);
		if (existing) {
			logger.debug('extractMediaFile', `Skipping existing file: ${vaultPath}`);
			// Still record the mapping for existing files
			this.recordMediaMapping(relativePath, vaultPath, grampsData, handleToPath);
			return vaultPath;
		}

		// Write the binary file to the vault
		await this.app.vault.createBinary(vaultPath, content);
		logger.debug('extractMediaFile', `Extracted: ${vaultPath}`);

		// Record the mapping from Gramps path/handle to vault path
		this.recordMediaMapping(relativePath, vaultPath, grampsData, handleToPath);

		return vaultPath;
	}

	/**
	 * Record media handle → vault path mappings by finding matching media objects
	 */
	private recordMediaMapping(
		relativePath: string,
		vaultPath: string,
		grampsData: ParsedGrampsData,
		handleToPath: Map<string, string>
	): void {
		// Look through all media objects to find ones that match this path
		for (const [handle, mediaObj] of grampsData.database.media) {
			// The media path in Gramps might be relative to mediapath or absolute
			// Match on filename or full relative path
			const mediaFilename = mediaObj.path.split('/').pop() || mediaObj.path;
			const filename = relativePath.split('/').pop() || relativePath;

			if (mediaFilename === filename || mediaObj.path === relativePath || mediaObj.path.endsWith(relativePath)) {
				handleToPath.set(handle, vaultPath);
				logger.debug('recordMediaMapping', `Mapped handle ${handle} → ${vaultPath}`);
			}
		}
	}

	/**
	 * Import a single place
	 * Returns the cr_id if imported, or null if skipped (already exists)
	 */
	private async importPlace(
		place: ParsedGrampsPlace,
		placesFolder: string,
		options: GrampsImportOptions,
		mediaHandleToPath?: Map<string, string>
	): Promise<string | null> {
		const placeName = place.name || `Unknown Place (${place.id || place.handle})`;

		// Check if place note already exists (sanitize name same way as createPlaceNote)
		const sanitizedName = placeName
			.replace(/^\[\[/, '').replace(/\]\]$/, '')  // Strip wikilink brackets
			.replace(/[\\/:*?"<>|[\]]/g, '-')           // Remove invalid chars
			.replace(/\s+/g, ' ')
			.trim();
		const expectedPath = normalizePath(`${placesFolder}/${sanitizedName}.md`);

		if (this.app.vault.getAbstractFileByPath(expectedPath)) {
			logger.debug('importPlace', `Skipping existing place: ${placeName}`);
			return null;
		}

		const crId = generateCrId();

		// Resolve media references to wikilinks
		const resolvedMedia: string[] = [];
		if (place.mediaRefs && place.mediaRefs.length > 0 && mediaHandleToPath) {
			for (const ref of place.mediaRefs) {
				const vaultPath = mediaHandleToPath.get(ref);
				if (vaultPath) {
					const filename = vaultPath.split('/').pop() || vaultPath;
					resolvedMedia.push(`"[[${filename}]]"`);
				}
			}
		}

		// Convert Gramps place to PlaceData
		const placeData: PlaceData = {
			name: placeName,
			crId: crId,
			// Map Gramps place type to Canvas Roots place type if possible
			placeType: this.mapGrampsPlaceType(place.type),
			media: resolvedMedia.length > 0 ? resolvedMedia : undefined
		};

		// Write place note using the createPlaceNote function
		await createPlaceNote(this.app, placeData, {
			directory: placesFolder,
			propertyAliases: options.propertyAliases
		});

		return crId;
	}

	/**
	 * Map Gramps place type to Canvas Roots place type
	 */
	private mapGrampsPlaceType(grampsType?: string): string | undefined {
		if (!grampsType) return undefined;

		// Common Gramps place types mapped to Canvas Roots equivalents
		const typeMap: Record<string, string> = {
			'country': 'country',
			'state': 'state',
			'province': 'province',
			'county': 'county',
			'city': 'city',
			'town': 'town',
			'village': 'village',
			'parish': 'parish',
			'municipality': 'municipality',
			'region': 'region',
			'district': 'district',
			'borough': 'borough',
			'address': 'address',
			'building': 'building',
			'farm': 'farm',
			'street': 'street',
			'neighborhood': 'neighborhood',
			'cemetery': 'cemetery',
			'church': 'church'
		};

		const normalized = grampsType.toLowerCase();
		return typeMap[normalized] || grampsType.toLowerCase();
	}

	/**
	 * Import a single source
	 */
	private async importSource(
		source: ParsedGrampsSource,
		sourcesFolder: string,
		options: GrampsImportOptions,
		mediaHandleToPath?: Map<string, string>
	): Promise<{ crId: string; wikilink: string }> {
		const crId = generateCrId();

		// Generate source title
		const title = source.title || `Unknown Source (${source.id || source.handle})`;

		// Infer source type from title
		const sourceType = this.inferSourceType(title, source.author);

		// Build frontmatter
		const aliases = options.propertyAliases || {};
		const prop = (canonical: string) => this.getWriteProperty(canonical, aliases);

		const frontmatterLines: string[] = [
			'---',
			`${prop('cr_type')}: source`,
			`${prop('cr_id')}: ${crId}`,
			`${prop('title')}: "${title.replace(/"/g, '\\"')}"`,
			`${prop('source_type')}: ${sourceType}`
		];

		if (source.author) {
			frontmatterLines.push(`${prop('author')}: "${source.author.replace(/"/g, '\\"')}"`);
		}

		// Repository handling: prefer resolved repository name over pubinfo (Phase 2.1)
		if (source.repositoryName) {
			frontmatterLines.push(`${prop('repository')}: "${source.repositoryName.replace(/"/g, '\\"')}"`);
		} else if (source.pubinfo) {
			frontmatterLines.push(`${prop('repository')}: "${source.pubinfo.replace(/"/g, '\\"')}"`);
		}

		// Add repository type and source medium if available (Phase 2.1)
		if (source.repositoryType) {
			frontmatterLines.push(`${prop('repository_type')}: "${source.repositoryType}"`);
		}
		if (source.sourceMedium) {
			frontmatterLines.push(`${prop('source_medium')}: "${source.sourceMedium}"`);
		}

		// Default confidence to medium
		frontmatterLines.push(`${prop('confidence')}: medium`);

		// Add Gramps ID preservation (Phase 2.4)
		frontmatterLines.push(`${prop('gramps_handle')}: ${source.handle}`);
		if (source.id) {
			frontmatterLines.push(`${prop('gramps_id')}: ${source.id}`);
		}

		// Handle media references - convert handles to wikilinks if we have the mapping
		const resolvedMediaLinks: string[] = [];
		const unresolvedMediaRefs: string[] = [];

		if (source.mediaRefs && source.mediaRefs.length > 0) {
			for (const ref of source.mediaRefs) {
				const vaultPath = mediaHandleToPath?.get(ref);
				if (vaultPath) {
					// Extract just the filename for the wikilink
					const filename = vaultPath.split('/').pop() || vaultPath;
					resolvedMediaLinks.push(`[[${filename}]]`);
				} else {
					// Store unresolved refs for manual resolution
					unresolvedMediaRefs.push(ref);
				}
			}
		}

		// Add resolved media as proper media property
		if (resolvedMediaLinks.length > 0) {
			frontmatterLines.push(`${prop('media')}:`);
			for (const link of resolvedMediaLinks) {
				frontmatterLines.push(`  - "${link}"`);
			}
		}

		// Keep unresolved refs for manual resolution (if any remain)
		if (unresolvedMediaRefs.length > 0) {
			frontmatterLines.push(`${prop('gramps_media_refs')}:`);
			for (const ref of unresolvedMediaRefs) {
				frontmatterLines.push(`  - "${ref}"`);
			}
		}

		frontmatterLines.push('---');

		// Build note body with source notes if available
		let body = `\n# ${title}\n`;
		if (source.noteText) {
			body += `\n${source.noteText}\n`;
		}

		// Add note about unresolved media refs that need manual resolution
		if (unresolvedMediaRefs.length > 0) {
			body += `\n## Unresolved Media References\n\n`;
			body += `This source has ${unresolvedMediaRefs.length} media reference(s) from Gramps that could not be automatically linked.\n`;
			body += `Use the Media Manager to find and link these files.\n`;
		}

		const content = frontmatterLines.join('\n') + body;

		// Generate file name
		const fileName = this.slugify(title) + '.md';
		const filePath = normalizePath(`${sourcesFolder}/${fileName}`);

		// Handle duplicate file names with suffix
		let finalPath = filePath;
		let counter = 2;
		while (this.app.vault.getAbstractFileByPath(finalPath)) {
			const baseName = this.slugify(title);
			finalPath = normalizePath(`${sourcesFolder}/${baseName} (${counter}).md`);
			counter++;
		}

		await this.app.vault.create(finalPath, content);

		// Return both crId and wikilink for mapping
		const finalFileName = finalPath.split('/').pop()?.replace('.md', '') || title;
		return {
			crId,
			wikilink: `[[${finalFileName}]]`
		};
	}

	/**
	 * Infer source type from title and author
	 */
	private inferSourceType(title: string, _author?: string): string {
		const lowerTitle = title.toLowerCase();

		// Check for common patterns
		if (lowerTitle.includes('census')) return 'census';
		if (lowerTitle.includes('vital record') || lowerTitle.includes('birth') ||
			lowerTitle.includes('death') || lowerTitle.includes('marriage certificate')) {
			return 'vital_record';
		}
		if (lowerTitle.includes('church') || lowerTitle.includes('parish') ||
			lowerTitle.includes('baptism') || lowerTitle.includes('burial')) {
			return 'church_record';
		}
		if (lowerTitle.includes('military') || lowerTitle.includes('draft') ||
			lowerTitle.includes('service record')) {
			return 'military';
		}
		if (lowerTitle.includes('immigration') || lowerTitle.includes('passenger') ||
			lowerTitle.includes('naturalization')) {
			return 'immigration';
		}
		if (lowerTitle.includes('newspaper')) return 'newspaper';
		if (lowerTitle.includes('bible')) return 'custom';
		if (lowerTitle.includes('social security')) return 'vital_record';
		if (lowerTitle.includes('obituary')) return 'obituary';
		if (lowerTitle.includes('court') || lowerTitle.includes('probate')) return 'court_record';
		if (lowerTitle.includes('land') || lowerTitle.includes('deed')) return 'land_deed';
		if (lowerTitle.includes('photo')) return 'photo';

		return 'custom';
	}

	/**
	 * Import a single event
	 */
	private async importEvent(
		event: ParsedGrampsEvent,
		grampsData: ParsedGrampsData,
		grampsToCrId: Map<string, string>,
		placeNameToWikilink: Map<string, string>,
		citationToSourceWikilink: Map<string, string>,
		eventsFolder: string,
		options: GrampsImportOptions,
		mediaHandleToPath?: Map<string, string>
	): Promise<string> {
		const crId = generateCrId();

		// Map Gramps event type to Canvas Roots event type
		const eventType = this.mapGrampsEventType(event.type);

		// Resolve media references to wikilinks
		const resolvedMedia: string[] = [];
		if (event.mediaRefs && event.mediaRefs.length > 0 && mediaHandleToPath) {
			for (const ref of event.mediaRefs) {
				const vaultPath = mediaHandleToPath.get(ref);
				if (vaultPath) {
					const filename = vaultPath.split('/').pop() || vaultPath;
					resolvedMedia.push(`[[${filename}]]`);
				}
			}
		}

		// Get person names for the title
		const personNames: string[] = [];
		const personWikilinks: string[] = [];
		for (const personHandle of event.personHandles) {
			const person = grampsData.persons.get(personHandle);
			if (person) {
				personNames.push(person.name || 'Unknown');
				personWikilinks.push(`[[${person.name || 'Unknown'}]]`);
			}
		}

		// Resolve source wikilinks from citations
		const sourceWikilinks: string[] = [];
		for (const citationHandle of event.citationHandles) {
			const sourceWikilink = citationToSourceWikilink.get(citationHandle);
			if (sourceWikilink && !sourceWikilinks.includes(sourceWikilink)) {
				sourceWikilinks.push(sourceWikilink);
			}
		}

		// Generate event title
		const eventTypeLabel = this.getEventTypeLabel(eventType);
		const title = personNames.length > 0
			? `${eventTypeLabel} of ${personNames.join(' and ')}`
			: `${eventTypeLabel} (${event.id || event.handle})`;

		// Resolve place to wikilink if available
		const placeValue = event.placeName
			? (placeNameToWikilink.get(event.placeName) || event.placeName)
			: undefined;

		// Build frontmatter
		const aliases = options.propertyAliases || {};
		const prop = (canonical: string) => this.getWriteProperty(canonical, aliases);

		const frontmatterLines: string[] = [
			'---',
			`${prop('cr_type')}: event`,
			`${prop('cr_id')}: ${crId}`,
			`${prop('title')}: "${title.replace(/"/g, '\\"')}"`,
			`${prop('event_type')}: ${eventType}`,
			`${prop('date_precision')}: ${event.date ? 'exact' : 'unknown'}`
		];

		if (event.date) {
			frontmatterLines.push(`${prop('date')}: ${event.date}`);
		}

		// Add person references
		if (personWikilinks.length === 1) {
			frontmatterLines.push(`${prop('person')}: "${personWikilinks[0]}"`);
		} else if (personWikilinks.length > 1) {
			frontmatterLines.push(`${prop('persons')}:`);
			for (const p of personWikilinks) {
				frontmatterLines.push(`  - "${p}"`);
			}
		}

		if (placeValue) {
			// Check if it's already a wikilink
			const placeLink = placeValue.startsWith('[[') ? placeValue : `[[${placeValue}]]`;
			frontmatterLines.push(`${prop('place')}: "${placeLink}"`);
		}

		// Add source references (array format)
		if (sourceWikilinks.length > 0) {
			frontmatterLines.push(`${prop('sources')}:`);
			for (const s of sourceWikilinks) {
				frontmatterLines.push(`  - "${s}"`);
			}
		}

		if (event.description) {
			frontmatterLines.push(`${prop('description')}: "${event.description.replace(/"/g, '\\"')}"`);
		}

		// Add media references
		if (resolvedMedia.length > 0) {
			frontmatterLines.push(`${prop('media')}:`);
			for (const m of resolvedMedia) {
				frontmatterLines.push(`  - "${m}"`);
			}
		}

		frontmatterLines.push('---');

		// Build note body
		const body = `\n# ${title}\n\n${event.description || ''}\n`;
		const content = frontmatterLines.join('\n') + body;

		// Create file
		const fileName = this.slugify(title) + '.md';
		const filePath = normalizePath(`${eventsFolder}/${fileName}`);

		// Check if file already exists and add suffix if needed
		let finalPath = filePath;
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(finalPath)) {
			const baseName = this.slugify(title);
			finalPath = normalizePath(`${eventsFolder}/${baseName}-${counter}.md`);
			counter++;
		}

		await this.app.vault.create(finalPath, content);

		return crId;
	}

	/**
	 * Map Gramps event type to Canvas Roots event type
	 */
	private mapGrampsEventType(grampsType?: string): string {
		if (!grampsType) return 'custom';

		const typeMap: Record<string, string> = {
			'birth': 'birth',
			'death': 'death',
			'marriage': 'marriage',
			'divorce': 'divorce',
			'burial': 'burial',
			'baptism': 'baptism',
			'christening': 'baptism',
			'confirmation': 'confirmation',
			'ordination': 'ordination',
			'residence': 'residence',
			'occupation': 'occupation',
			'military service': 'military',
			'military': 'military',
			'immigration': 'immigration',
			'emigration': 'immigration',
			'naturalization': 'immigration',
			'education': 'education',
			'graduation': 'education'
		};

		const normalized = grampsType.toLowerCase();
		return typeMap[normalized] || 'custom';
	}

	/**
	 * Get display label for event type
	 */
	private getEventTypeLabel(eventType: string): string {
		const labels: Record<string, string> = {
			'birth': 'Birth',
			'death': 'Death',
			'marriage': 'Marriage',
			'divorce': 'Divorce',
			'burial': 'Burial',
			'baptism': 'Baptism',
			'confirmation': 'Confirmation',
			'ordination': 'Ordination',
			'residence': 'Residence',
			'occupation': 'Occupation',
			'military': 'Military Service',
			'immigration': 'Immigration',
			'education': 'Education',
			'custom': 'Event'
		};
		return labels[eventType] || eventType.charAt(0).toUpperCase() + eventType.slice(1);
	}

	/**
	 * Get property name to write, respecting aliases
	 */
	private getWriteProperty(canonical: string, aliases: Record<string, string>): string {
		for (const [userProp, canonicalProp] of Object.entries(aliases)) {
			if (canonicalProp === canonical) {
				return userProp;
			}
		}
		return canonical;
	}

	/**
	 * Convert string to URL-friendly slug
	 */
	private slugify(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^\w\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.trim();
	}
}
