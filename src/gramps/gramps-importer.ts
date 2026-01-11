/**
 * Gramps XML Importer for Charted Roots
 *
 * Imports Gramps XML data into the Obsidian vault as person notes.
 */

import { App, Notice, TFile, normalizePath } from 'obsidian';
import { GrampsParser, ParsedGrampsData, ParsedGrampsPerson, ParsedGrampsPlace, ParsedGrampsEvent, ParsedGrampsSource } from './gramps-parser';
import { GrampsNote, GrampsValidationResult } from './gramps-types';
import { formatNotesSection, hasPrivateNote } from './gramps-note-converter';
import { createPersonNote, PersonData, findPersonByCrId } from '../core/person-note-writer';
import { createPlaceNote, PlaceData } from '../core/place-note-writer';
import { writeNoteFile, buildNoteReferenceMap } from '../core/note-writer';
import { generateCrId } from '../core/uuid';
import { getErrorMessage } from '../core/error-utils';
import { getLogger } from '../core/logging';
import { sanitizeName } from '../utils/name-sanitization';

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
	| 'notes'
	| 'people'
	| 'relationships'
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
	/** Whether to import notes attached to entities (default: true) */
	importNotes?: boolean;
	/** Whether to create separate note files instead of embedding (default: false) */
	createSeparateNoteFiles?: boolean;
	/** Folder for separate note files (default: Charted Roots/Notes) */
	notesFolder?: string;
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
	/** Number of duplicate events skipped (same type + person + date) */
	duplicateEventsSkipped?: number;
	sourcesImported?: number;
	sourceNotesCreated?: number;
	mediaFilesExtracted?: number;
	/** Mapping from Gramps media handle to vault path (for linking) */
	mediaHandleToPath?: Map<string, string>;
	/** Number of separate note files created (Phase 4) */
	separateNoteFilesCreated?: number;
}

/**
 * Import Gramps XML files into Charted Roots
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
			// Small delay to allow UI to repaint before synchronous validation
			await new Promise(resolve => setTimeout(resolve, 50));
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
			// Small delay to allow UI to repaint before synchronous parsing blocks the thread
			await new Promise(resolve => setTimeout(resolve, 50));
			const grampsData = GrampsParser.parse(content);
			reportProgress('parsing', 1, 1, `Parsed ${grampsData.persons.size} individuals`);

			logger.info('importFile', `Starting import of ${grampsData.persons.size} persons`);

			// Ensure folders exist
			await this.ensureFolderExists(options.peopleFolder);

			// Extract media files from .gpkg package if provided
			if (options.extractMedia !== false && options.mediaFiles && options.mediaFiles.size > 0) {
				const mediaFolder = options.mediaFolder || 'Charted Roots/Media';
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

			// Create mapping of Gramps handles to cr_ids (for person relationships)
			const grampsToCrId = new Map<string, string>();
			// Mapping from place name to wikilink (for linking in person notes)
			let placeNameToWikilink = new Map<string, string>();

			// Create place notes FIRST if requested (so we can link to them from person notes)
			if (options.createPlaceNotes && grampsData.places.size > 0) {
				const placesFolder = options.placesFolder || options.peopleFolder;
				await this.ensureFolderExists(placesFolder);

				// Collect all places with expanded hierarchies (like GEDCOM importer)
				const allPlaces = this.collectAllPlacesWithHierarchy(grampsData);

				if (allPlaces.size > 0) {
					reportProgress('places', 0, allPlaces.size, `Creating ${allPlaces.size} place notes (including hierarchy)...`);

					try {
						const placeResult = await this.createPlaceNotesWithHierarchy(
							allPlaces,
							grampsData,
							placesFolder,
							options,
							result.mediaHandleToPath,
							reportProgress
						);

						placeNameToWikilink = placeResult.placeNameToWikilink;
						result.placeNotesCreated = placeResult.created;
						result.placesImported = allPlaces.size;
					} catch (error: unknown) {
						result.errors.push(
							`Failed to import places: ${getErrorMessage(error)}`
						);
					}
				}

				// Build additional mappings for malformed place names (space-separated → comma-separated)
				// Some Gramps exports have places like "Boston Suffolk County" that should map to
				// "Boston, Suffolk County, Massachusetts, USA"
				for (const [, place] of grampsData.places) {
					if (!place.name || place.name.includes(',')) continue;

					// This is a space-separated name without commas
					// Try to find a matching comma-separated place
					const spaceSeparatedName = place.name;

					// Try matching with progressively more words from the beginning
					// This handles multi-word city names like "Los Angeles", "San Jose", "New Orleans"
					const words = spaceSeparatedName.split(' ');
					let matched = false;

					for (let numWords = 1; numWords <= Math.min(words.length, 3) && !matched; numWords++) {
						const prefix = words.slice(0, numWords).join(' ');

						// Look for a place that starts with this prefix followed by a comma
						for (const [properName, wikilink] of placeNameToWikilink) {
							if (properName.startsWith(prefix + ',')) {
								// Found a match - add mapping from space-separated to proper wikilink
								placeNameToWikilink.set(spaceSeparatedName, wikilink);
								matched = true;
								break;
							}
						}
					}
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
				const sourcesFolder = options.sourcesFolder || 'Charted Roots/Sources';
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

			// Create separate note files if requested (Phase 4)
			const noteHandleToWikilink = new Map<string, string>();
			if (options.createSeparateNoteFiles && grampsData.database.notes.size > 0) {
				const notesFolder = options.notesFolder || 'Charted Roots/Notes';
				await this.ensureFolderExists(notesFolder);

				// Build note-to-entity reference map for meaningful names
				const noteReferenceMap = buildNoteReferenceMap(
					grampsData.persons,
					grampsData.events,
					grampsData.places
				);

				// Collect notes referenced by sources - these are already embedded in source notes
				// and should not be created as separate files
				const sourceOnlyNotes = new Set<string>();
				for (const [, source] of grampsData.database.sources) {
					if (source.noteRefs) {
						for (const noteRef of source.noteRefs) {
							// Only exclude if this note is NOT also referenced by person/event/place
							if (!noteReferenceMap.has(noteRef)) {
								sourceOnlyNotes.add(noteRef);
							}
						}
					}
				}

				// Filter to only notes that should become separate files
				const notesToCreate = [...grampsData.database.notes.entries()]
					.filter(([handle]) => !sourceOnlyNotes.has(handle));

				const notesTotal = notesToCreate.length;
				reportProgress('notes', 0, notesTotal, `Creating ${notesTotal} separate note files...`);

				let noteIndex = 0;
				for (const [handle, note] of notesToCreate) {
					try {
						const entityRef = noteReferenceMap.get(handle);
						const writeResult = await writeNoteFile(this.app, note, {
							notesFolder,
							propertyAliases: options.propertyAliases,
							referencingEntityName: entityRef?.entityName,
							overwriteExisting: options.overwriteExisting
						});

						if (writeResult.success) {
							noteHandleToWikilink.set(handle, writeResult.wikilink);
							result.separateNoteFilesCreated = (result.separateNoteFilesCreated || 0) + 1;
						} else {
							result.errors.push(
								`Failed to create note file ${note.id || handle}: ${writeResult.error}`
							);
						}
					} catch (error: unknown) {
						result.errors.push(
							`Failed to create note ${note.id || handle}: ${getErrorMessage(error)}`
						);
					}
					noteIndex++;
					reportProgress('notes', noteIndex, notesTotal);
				}
			}

			// Create person notes
			const peopleTotal = grampsData.persons.size;
			reportProgress('people', 0, peopleTotal, 'Creating person notes...');

			// Track handle → note path for wikilink correction
			const grampsHandleToNotePath = new Map<string, string>();

			// First pass: Create all person notes
			let personIndex = 0;
			for (const [handle, person] of grampsData.persons) {
				try {
					const { crId, notePath } = await this.importPerson(
						person,
						grampsData,
						options,
						grampsToCrId,
						placeNameToWikilink,
						result.mediaHandleToPath,
						noteHandleToWikilink
					);

					grampsToCrId.set(handle, crId);
					grampsHandleToNotePath.set(handle, notePath);
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
			const relationshipsTotal = grampsData.persons.size;
			reportProgress('relationships', 0, relationshipsTotal, 'Updating relationships...');
			let relationshipIndex = 0;
			for (const [, person] of grampsData.persons) {
				try {
					await this.updateRelationships(
						person,
						grampsData,
						grampsToCrId,
						grampsHandleToNotePath,
						options
					);
				} catch (error: unknown) {
					result.errors.push(
						`Failed to update relationships for ${person.name}: ${getErrorMessage(error)}`
					);
				}
				relationshipIndex++;
				reportProgress('relationships', relationshipIndex, relationshipsTotal);
			}

			// Create event notes if requested
			if (options.createEventNotes && grampsData.events.size > 0) {
				const eventsTotal = grampsData.events.size;
				reportProgress('events', 0, eventsTotal, `Creating ${eventsTotal} event notes...`);
				const eventsFolder = options.eventsFolder || 'Charted Roots/Events';
				await this.ensureFolderExists(eventsFolder);

				// Track seen events to detect duplicates (same type + same persons + same date + same place)
				const seenEvents = new Set<string>();
				let duplicateEventsSkipped = 0;

				let eventIndex = 0;
				for (const [handle, event] of grampsData.events) {
					// Create a key for duplicate detection: type + sorted person handles + date + place
					const personKey = [...event.personHandles].sort().join(',');
					const eventKey = `${event.type || 'unknown'}|${personKey}|${event.date || ''}|${event.placeName || ''}`;

					if (seenEvents.has(eventKey)) {
						// Skip duplicate event
						duplicateEventsSkipped++;
						logger.debug('importEvent', `Skipping duplicate event: ${event.type} for ${personKey}`);
						eventIndex++;
						reportProgress('events', eventIndex, eventsTotal);
						continue;
					}
					seenEvents.add(eventKey);

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

				if (duplicateEventsSkipped > 0) {
					result.duplicateEventsSkipped = duplicateEventsSkipped;
					logger.info('importFile', `Skipped ${duplicateEventsSkipped} duplicate event(s)`);
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
		mediaHandleToPath?: Map<string, string>,
		noteHandleToWikilink?: Map<string, string>
	): Promise<{ crId: string; notePath: string }> {
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
			nickname: person.nickname,
			birthDate: person.birthDate,
			deathDate: person.deathDate,
			birthPlace: birthPlaceValue,
			deathPlace: deathPlaceValue,
			occupation: person.occupation,
			sex: person.gender === 'M' ? 'male' : person.gender === 'F' ? 'female' : undefined,
			media: resolvedMedia.length > 0 ? resolvedMedia : undefined,
			// Store Gramps handle for round-trip support (#175)
			externalId: person.handle,
			externalIdSource: 'gramps'
		};

		// Handle Research Level attribute (from Gramps person attributes)
		if (person.attributes && person.attributes['Research Level']) {
			const level = parseInt(person.attributes['Research Level'], 10);
			if (!isNaN(level) && level >= 0 && level <= 6) {
				personData.researchLevel = level as 0 | 1 | 2 | 3 | 4 | 5 | 6;
			}
		}

		// Resolve and append notes from Gramps (if enabled)
		if (options.importNotes !== false && person.noteRefs && person.noteRefs.length > 0) {
			// Check if we're using separate note files (Phase 4)
			if (options.createSeparateNoteFiles && noteHandleToWikilink && noteHandleToWikilink.size > 0) {
				// Use wikilinks to separate note files
				const noteWikilinks: string[] = [];
				for (const noteRef of person.noteRefs) {
					const wikilink = noteHandleToWikilink.get(noteRef);
					if (wikilink) {
						noteWikilinks.push(wikilink);
					}
					// Check privacy even when using separate files
					const note = grampsData.database.notes.get(noteRef);
					if (note?.private) {
						personData.private = true;
					}
				}
				if (noteWikilinks.length > 0) {
					// Format as markdown list of wikilinks
					personData.notesContent = '## Notes\n\n' + noteWikilinks.map(l => `- ${l}`).join('\n');
				}
			} else {
				// Embed note content (original behavior)
				const resolvedNotes: GrampsNote[] = [];
				for (const noteRef of person.noteRefs) {
					const note = grampsData.database.notes.get(noteRef);
					if (note) {
						resolvedNotes.push(note);
					}
				}
				if (resolvedNotes.length > 0) {
					personData.notesContent = formatNotesSection(resolvedNotes);
					// Set private flag if any note is marked private
					if (hasPrivateNote(resolvedNotes)) {
						personData.private = true;
					}
				}
			}
		}

		// Add relationship references with Gramps handles (temporary) and names
		// Names are sanitized to match filename sanitization, preventing wikilink resolution failures
		// when names contain special characters like quotes, parentheses, or brackets (#139)
		if (person.fatherRef) {
			personData.fatherCrId = person.fatherRef; // Temporary Gramps handle
			const father = grampsData.persons.get(person.fatherRef);
			if (father) {
				personData.fatherName = sanitizeName(father.name || 'Unknown');
			}
		}

		if (person.motherRef) {
			personData.motherCrId = person.motherRef; // Temporary Gramps handle
			const mother = grampsData.persons.get(person.motherRef);
			if (mother) {
				personData.motherName = sanitizeName(mother.name || 'Unknown');
			}
		}

		if (person.spouseRefs.length > 0) {
			personData.spouseCrId = person.spouseRefs; // Temporary Gramps handles
			personData.spouseName = person.spouseRefs.map(ref => {
				const spouse = grampsData.persons.get(ref);
				return sanitizeName(spouse?.name || 'Unknown');
			});
		}

		// Add step-parent references (from mrel/frel = 'Stepchild')
		if (person.stepfatherRefs.length > 0) {
			personData.stepfatherCrId = person.stepfatherRefs; // Temporary Gramps handles
			personData.stepfatherName = person.stepfatherRefs.map(ref => {
				const stepfather = grampsData.persons.get(ref);
				return sanitizeName(stepfather?.name || 'Unknown');
			});
		}

		if (person.stepmotherRefs.length > 0) {
			personData.stepmotherCrId = person.stepmotherRefs; // Temporary Gramps handles
			personData.stepmotherName = person.stepmotherRefs.map(ref => {
				const stepmother = grampsData.persons.get(ref);
				return sanitizeName(stepmother?.name || 'Unknown');
			});
		}

		// Add adoptive parent references (from mrel/frel = 'Adopted')
		if (person.adoptiveFatherRef) {
			personData.adoptiveFatherCrId = person.adoptiveFatherRef; // Temporary Gramps handle
			const adoptiveFather = grampsData.persons.get(person.adoptiveFatherRef);
			if (adoptiveFather) {
				personData.adoptiveFatherName = sanitizeName(adoptiveFather.name || 'Unknown');
			}
		}

		if (person.adoptiveMotherRef) {
			personData.adoptiveMotherCrId = person.adoptiveMotherRef; // Temporary Gramps handle
			const adoptiveMother = grampsData.persons.get(person.adoptiveMotherRef);
			if (adoptiveMother) {
				personData.adoptiveMotherName = sanitizeName(adoptiveMother.name || 'Unknown');
			}
		}

		// Find children (people who have this person as a parent)
		const childRefs: string[] = [];
		const childNames: string[] = [];
		for (const [childHandle, child] of grampsData.persons) {
			if (child.fatherRef === person.handle || child.motherRef === person.handle) {
				if (!childRefs.includes(childHandle)) {
					childRefs.push(childHandle);
					childNames.push(sanitizeName(child.name || 'Unknown'));
				}
			}
		}
		if (childRefs.length > 0) {
			personData.childCrId = childRefs; // Temporary Gramps handles
			personData.childName = childNames;
		}

		// Write person note using the createPersonNote function
		// Disable bidirectional linking during import - we'll fix relationships in pass 2
		const file = await createPersonNote(this.app, personData, {
			directory: options.peopleFolder,
			addBidirectionalLinks: false,
			propertyAliases: options.propertyAliases,
			includeDynamicBlocks: options.includeDynamicBlocks,
			dynamicBlockTypes: options.dynamicBlockTypes
		});

		return { crId, notePath: file.path };
	}

	/**
	 * Update relationships with actual cr_ids and fix wikilinks for duplicate names
	 */
	private async updateRelationships(
		person: ParsedGrampsPerson,
		grampsData: ParsedGrampsData,
		grampsToCrId: Map<string, string>,
		grampsHandleToNotePath: Map<string, string>,
		options: GrampsImportOptions
	): Promise<void> {
		const crId = grampsToCrId.get(person.handle);
		if (!crId) {
			logger.warn('updateRelationships', `No crId for ${person.name}`, { handle: person.handle });
			return;
		}

		// Find file by cr_id to handle duplicate names correctly
		// When multiple people have the same name, filenames get suffixed (e.g., "Samuel Edison 1.md")
		const file = findPersonByCrId(this.app, crId, options.peopleFolder);

		if (!file) {
			logger.warn('updateRelationships', `File not found for ${person.name}`, { crId });
			return;
		}

		logger.debug('updateRelationships', `Processing ${person.name}`, { path: file.path });

		// Read the file
		const content = await this.app.vault.read(file);

		// Helper to get aliased property name
		const aliases = options.propertyAliases || {};
		const prop = (canonical: string) => this.getWriteProperty(canonical, aliases);

		// Update frontmatter with real cr_ids (replacing temporary Gramps handles)
		let updatedContent = content;

		// Replace father_id reference with real cr_id
		if (person.fatherRef) {
			const fatherCrId = grampsToCrId.get(person.fatherRef);
			if (fatherCrId) {
				const escapedRef = this.escapeRegex(person.fatherRef);
				const propName = prop('father_id');
				updatedContent = updatedContent.replace(
					new RegExp(`${propName}: ${escapedRef}`, 'g'),
					`${propName}: ${fatherCrId}`
				);
			}
		}

		// Replace mother_id reference with real cr_id
		if (person.motherRef) {
			const motherCrId = grampsToCrId.get(person.motherRef);
			if (motherCrId) {
				const escapedRef = this.escapeRegex(person.motherRef);
				const propName = prop('mother_id');
				updatedContent = updatedContent.replace(
					new RegExp(`${propName}: ${escapedRef}`, 'g'),
					`${propName}: ${motherCrId}`
				);
			}
		}

		// Replace spouse_id references with real cr_ids
		// Use a targeted approach to avoid cross-contamination with other arrays
		const spouseIdProp = prop('spouse_id');
		if (person.spouseRefs.length > 0) {
			// Handle array format
			const spouseIdMatch = updatedContent.match(new RegExp(`^${spouseIdProp}:\\n((?:\\s{2}-\\s+[^\\n]+\\n?)+)`, 'm'));
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
						new RegExp(`^(${spouseIdProp}:\\s+)${escapedRef}$`, 'gm'),
						`$1${spouseCrId}`
					);
				}
			}
		}

		// Replace children_id references with real cr_ids
		// Use a targeted approach: extract, replace, and re-insert the children_id block
		const childrenIdProp = prop('children_id');
		const childrenIdMatch = updatedContent.match(new RegExp(`^${childrenIdProp}:\\n((?:\\s{2}-\\s+[^\\n]+\\n?)+)`, 'm'));
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
					new RegExp(`^(${childrenIdProp}:\\s+)${escapedRef}$`, 'gm'),
					`$1${childCrId}`
				);
			}
		}

		// Replace stepfather_id references with real cr_ids
		// Use a targeted approach to avoid cross-contamination with other arrays
		const stepfatherIdProp = prop('stepfather_id');
		if (person.stepfatherRefs.length > 0) {
			// Handle array format
			const stepfatherIdMatch = updatedContent.match(new RegExp(`^${stepfatherIdProp}:\\n((?:\\s{2}-\\s+[^\\n]+\\n?)+)`, 'm'));
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
						new RegExp(`^(${stepfatherIdProp}:\\s+)${escapedRef}$`, 'gm'),
						`$1${stepfatherCrId}`
					);
				}
			}
		}

		// Replace stepmother_id references with real cr_ids
		// Use a targeted approach to avoid cross-contamination with other arrays
		const stepmotherIdProp = prop('stepmother_id');
		if (person.stepmotherRefs.length > 0) {
			// Handle array format
			const stepmotherIdMatch = updatedContent.match(new RegExp(`^${stepmotherIdProp}:\\n((?:\\s{2}-\\s+[^\\n]+\\n?)+)`, 'm'));
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
						new RegExp(`^(${stepmotherIdProp}:\\s+)${escapedRef}$`, 'gm'),
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
				const adoptiveFatherIdProp = prop('adoptive_father_id');
				updatedContent = updatedContent.replace(
					new RegExp(`${adoptiveFatherIdProp}: ${escapedRef}`, 'g'),
					`${adoptiveFatherIdProp}: ${adoptiveFatherCrId}`
				);
			}
		}

		// Replace adoptive_mother_id reference with real cr_id
		if (person.adoptiveMotherRef) {
			const adoptiveMotherCrId = grampsToCrId.get(person.adoptiveMotherRef);
			if (adoptiveMotherCrId) {
				const escapedRef = this.escapeRegex(person.adoptiveMotherRef);
				const adoptiveMotherIdProp = prop('adoptive_mother_id');
				updatedContent = updatedContent.replace(
					new RegExp(`${adoptiveMotherIdProp}: ${escapedRef}`, 'g'),
					`${adoptiveMotherIdProp}: ${adoptiveMotherCrId}`
				);
			}
		}

		// Clean up any remaining unresolved Gramps handles in _id fields
		// These occur when a referenced person doesn't exist in the imported data
		// Pattern matches: property_id: _HANDLE (Gramps handles start with _ followed by alphanumeric)
		const beforeCleanup = updatedContent;
		updatedContent = this.cleanupUnresolvedGrampsHandles(updatedContent);

		// Log if cleanup removed unresolved handles
		if (beforeCleanup !== updatedContent) {
			logger.info('updateRelationships', 'Cleaned unresolved Gramps handles', { path: file.path });
		}

		// Fix wikilinks to use actual filenames (handles duplicate names)
		// When files are created with suffixes like "John Smith 1.md" for duplicates,
		// the wikilinks need to point to the actual filename, not the display name.
		// We use cr_id-targeted replacement to handle cases where multiple people
		// have the same display name (e.g., father and child both named "George Hall").

		// Helper to get filename without extension from path
		const getFilenameFromPath = (path: string): string => {
			const parts = path.split('/');
			const filename = parts[parts.length - 1];
			return filename.replace(/\.md$/, '');
		};

		// Helper to fix a wikilink for a specific relationship using cr_id matching
		const fixWikilinkByCrId = (
			content: string,
			propertyName: string,
			idPropertyName: string,
			targetCrId: string,
			displayName: string,
			actualFilename: string
		): string => {
			if (actualFilename === displayName) return content; // No change needed

			// For single-value properties (father, mother), match the property line
			// Pattern: property: "[[DisplayName]]" followed by property_id: cr_id
			const singleValuePattern = new RegExp(
				`(${propertyName}:\\s*)"\\[\\[${this.escapeRegex(displayName)}\\]\\]"(\\n${idPropertyName}:\\s*${this.escapeRegex(targetCrId)})`,
				'm'
			);
			if (singleValuePattern.test(content)) {
				return content.replace(singleValuePattern, `$1"[[${actualFilename}]]"$2`);
			}

			// Also try reverse order (id before wikilink)
			const reversePattern = new RegExp(
				`(${idPropertyName}:\\s*${this.escapeRegex(targetCrId)}\\n${propertyName}:\\s*)"\\[\\[${this.escapeRegex(displayName)}\\]\\]"`,
				'm'
			);
			if (reversePattern.test(content)) {
				return content.replace(reversePattern, `$1"[[${actualFilename}]]"`);
			}

			return content;
		};

		// Helper to fix a wikilink in an array using cr_id index matching
		const fixWikilinkInArrayByCrId = (
			content: string,
			arrayPropertyName: string,
			idArrayPropertyName: string,
			targetCrId: string,
			displayName: string,
			actualFilename: string
		): string => {
			if (actualFilename === displayName) return content; // No change needed

			// Find the _id array and get the index of the target cr_id
			const idArrayMatch = content.match(new RegExp(`${idArrayPropertyName}:\\n((?:\\s{2}-\\s+[^\\n]+\\n?)+)`, 'm'));
			if (!idArrayMatch) return content;

			const idLines = idArrayMatch[1].split('\n').filter(line => line.trim().startsWith('- '));
			const targetIndex = idLines.findIndex(line => line.includes(targetCrId));
			if (targetIndex === -1) return content;

			// Find the wikilink array and replace the item at the same index
			const wikilinkArrayMatch = content.match(new RegExp(`(${arrayPropertyName}:\\n)((?:\\s{2}-\\s+[^\\n]+\\n?)+)`, 'm'));
			if (!wikilinkArrayMatch) return content;

			const wikilinkLines = wikilinkArrayMatch[2].split('\n').filter(line => line.trim().startsWith('- '));
			if (targetIndex >= wikilinkLines.length) return content;

			// Check if this line contains the display name we're looking for
			const targetLine = wikilinkLines[targetIndex];
			if (!targetLine.includes(`[[${displayName}]]`)) return content;

			// Replace only this specific line
			const newLine = targetLine.replace(`[[${displayName}]]`, `[[${actualFilename}]]`);
			wikilinkLines[targetIndex] = newLine;

			// Rebuild the array section
			const newArrayContent = wikilinkLines.join('\n') + '\n';
			return content.replace(wikilinkArrayMatch[0], `${wikilinkArrayMatch[1]}${newArrayContent}`);
		};

		// Father (single value)
		if (person.fatherRef) {
			const fatherPath = grampsHandleToNotePath.get(person.fatherRef);
			const father = grampsData.persons.get(person.fatherRef);
			const fatherCrId = grampsToCrId.get(person.fatherRef);
			if (fatherPath && father?.name && fatherCrId) {
				const actualFilename = getFilenameFromPath(fatherPath);
				updatedContent = fixWikilinkByCrId(updatedContent, prop('father'), prop('father_id'), fatherCrId, father.name, actualFilename);
			}
		}

		// Mother (single value)
		if (person.motherRef) {
			const motherPath = grampsHandleToNotePath.get(person.motherRef);
			const mother = grampsData.persons.get(person.motherRef);
			const motherCrId = grampsToCrId.get(person.motherRef);
			if (motherPath && mother?.name && motherCrId) {
				const actualFilename = getFilenameFromPath(motherPath);
				updatedContent = fixWikilinkByCrId(updatedContent, prop('mother'), prop('mother_id'), motherCrId, mother.name, actualFilename);
			}
		}

		// Spouses (array)
		for (const spouseRef of person.spouseRefs) {
			const spousePath = grampsHandleToNotePath.get(spouseRef);
			const spouse = grampsData.persons.get(spouseRef);
			const spouseCrId = grampsToCrId.get(spouseRef);
			if (spousePath && spouse?.name && spouseCrId) {
				const actualFilename = getFilenameFromPath(spousePath);
				updatedContent = fixWikilinkInArrayByCrId(updatedContent, prop('spouse'), prop('spouse_id'), spouseCrId, spouse.name, actualFilename);
			}
		}

		// Children (array) - find children of this person
		for (const [childHandle, child] of grampsData.persons) {
			if (child.fatherRef === person.handle || child.motherRef === person.handle) {
				const childPath = grampsHandleToNotePath.get(childHandle);
				const childCrId = grampsToCrId.get(childHandle);
				if (childPath && child.name && childCrId) {
					const actualFilename = getFilenameFromPath(childPath);
					updatedContent = fixWikilinkInArrayByCrId(updatedContent, prop('children'), prop('children_id'), childCrId, child.name, actualFilename);
				}
			}
		}

		// Stepfathers (array)
		for (const stepfatherRef of person.stepfatherRefs) {
			const stepfatherPath = grampsHandleToNotePath.get(stepfatherRef);
			const stepfather = grampsData.persons.get(stepfatherRef);
			const stepfatherCrId = grampsToCrId.get(stepfatherRef);
			if (stepfatherPath && stepfather?.name && stepfatherCrId) {
				const actualFilename = getFilenameFromPath(stepfatherPath);
				updatedContent = fixWikilinkInArrayByCrId(updatedContent, prop('stepfather'), prop('stepfather_id'), stepfatherCrId, stepfather.name, actualFilename);
			}
		}

		// Stepmothers (array)
		for (const stepmotherRef of person.stepmotherRefs) {
			const stepmotherPath = grampsHandleToNotePath.get(stepmotherRef);
			const stepmother = grampsData.persons.get(stepmotherRef);
			const stepmotherCrId = grampsToCrId.get(stepmotherRef);
			if (stepmotherPath && stepmother?.name && stepmotherCrId) {
				const actualFilename = getFilenameFromPath(stepmotherPath);
				updatedContent = fixWikilinkInArrayByCrId(updatedContent, prop('stepmother'), prop('stepmother_id'), stepmotherCrId, stepmother.name, actualFilename);
			}
		}

		// Adoptive father (single value)
		if (person.adoptiveFatherRef) {
			const adoptiveFatherPath = grampsHandleToNotePath.get(person.adoptiveFatherRef);
			const adoptiveFather = grampsData.persons.get(person.adoptiveFatherRef);
			const adoptiveFatherCrId = grampsToCrId.get(person.adoptiveFatherRef);
			if (adoptiveFatherPath && adoptiveFather?.name && adoptiveFatherCrId) {
				const actualFilename = getFilenameFromPath(adoptiveFatherPath);
				updatedContent = fixWikilinkByCrId(updatedContent, prop('adoptive_father'), prop('adoptive_father_id'), adoptiveFatherCrId, adoptiveFather.name, actualFilename);
			}
		}

		// Adoptive mother (single value)
		if (person.adoptiveMotherRef) {
			const adoptiveMotherPath = grampsHandleToNotePath.get(person.adoptiveMotherRef);
			const adoptiveMother = grampsData.persons.get(person.adoptiveMotherRef);
			const adoptiveMotherCrId = grampsToCrId.get(person.adoptiveMotherRef);
			if (adoptiveMotherPath && adoptiveMother?.name && adoptiveMotherCrId) {
				const actualFilename = getFilenameFromPath(adoptiveMotherPath);
				updatedContent = fixWikilinkByCrId(updatedContent, prop('adoptive_mother'), prop('adoptive_mother_id'), adoptiveMotherCrId, adoptiveMother.name, actualFilename);
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
	 * Clean up unresolved Gramps handles from frontmatter
	 *
	 * After the handle-to-cr_id replacement pass, some handles may remain if
	 * the referenced person doesn't exist in the imported data. This removes
	 * those invalid references to prevent issues with relationship traversal.
	 *
	 * Handles single-value fields (e.g., mother_id: _HANDLE) by clearing the value,
	 * and array items (e.g., - _HANDLE) by removing the entire line.
	 */
	private cleanupUnresolvedGrampsHandles(content: string): string {
		// Gramps handles: start with underscore, followed by alphanumeric characters
		// e.g., _PTHMF88SXO93W8QTDJ or _bc09aafc5ba1cb2a871
		const grampsHandlePattern = /_[A-Za-z0-9]+/;

		// Clean single-value _id fields: "property_id: _HANDLE" -> "property_id: "
		// This preserves the property but clears the invalid value
		const singleValueRegex = new RegExp(`^(\\w+_id):\\s+${grampsHandlePattern.source}\\s*$`, 'gm');
		content = content.replace(singleValueRegex, '$1: ');

		// Clean array items that are unresolved handles: "  - _HANDLE" -> remove line
		content = content.replace(
			new RegExp(`^\\s{2}-\\s+${grampsHandlePattern.source}\\s*\\n`, 'gm'),
			''
		);

		return content;
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
		grampsData: ParsedGrampsData,
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

		// Resolve and format notes (if enabled)
		let notesContent: string | undefined;
		let hasPrivateNotes = false;
		if (options.importNotes !== false && place.noteRefs && place.noteRefs.length > 0) {
			const resolvedNotes: GrampsNote[] = [];
			for (const noteRef of place.noteRefs) {
				const note = grampsData.database.notes.get(noteRef);
				if (note) {
					resolvedNotes.push(note);
				}
			}
			if (resolvedNotes.length > 0) {
				notesContent = formatNotesSection(resolvedNotes);
				hasPrivateNotes = hasPrivateNote(resolvedNotes);
			}
		}

		// Convert Gramps place to PlaceData
		const placeData: PlaceData = {
			name: placeName,
			crId: crId,
			// Map Gramps place type to Charted Roots place type if possible
			placeType: this.mapGrampsPlaceType(place.type),
			media: resolvedMedia.length > 0 ? resolvedMedia : undefined,
			notesContent,
			private: hasPrivateNotes || undefined
		};

		// Write place note using the createPlaceNote function
		await createPlaceNote(this.app, placeData, {
			directory: placesFolder,
			propertyAliases: options.propertyAliases
		});

		return crId;
	}

	/**
	 * Parse a place name into hierarchy parts (split by comma)
	 */
	private parsePlaceHierarchy(placeName: string): string[] {
		if (!placeName) return [];
		return placeName
			.split(',')
			.map(p => p.trim())
			.filter(p => p.length > 0);
	}

	/**
	 * Get canonical name for a place at a given level.
	 * E.g., for parts ["Springfield", "Illinois", "USA"] at level 1:
	 * Returns "Illinois, USA" (from index 1 onward)
	 */
	private getPlaceAtLevel(parts: string[], levelIndex: number): string {
		return parts.slice(levelIndex).join(', ');
	}

	/**
	 * Infer place type from hierarchy position and name patterns
	 */
	private inferPlaceType(name: string, parts: string[]): string {
		const lowerName = name.toLowerCase();
		const depth = parts.length;

		// Check for common suffixes/patterns
		if (lowerName.endsWith(' county') || lowerName.includes(' co.')) return 'county';
		if (lowerName.endsWith(' parish')) return 'parish';
		if (lowerName.endsWith(' township') || lowerName.endsWith(' twp')) return 'township';
		if (lowerName.endsWith(' borough')) return 'borough';

		// Infer from hierarchy depth (typical US: City, County, State, Country)
		if (depth === 1) return 'country';
		if (depth === 2) return 'state';
		if (depth === 3) return 'county';
		if (depth >= 4) return 'city';

		return 'unknown';
	}

	/**
	 * Collect all places from Gramps data, expanding hierarchies.
	 * Returns a Map of place string → hierarchy parts
	 */
	private collectAllPlacesWithHierarchy(grampsData: ParsedGrampsData): Map<string, string[]> {
		const places = new Map<string, string[]>();

		const addPlace = (placeName: string | undefined) => {
			if (!placeName) return;

			const parts = this.parsePlaceHierarchy(placeName);
			if (parts.length === 0) return;

			// Add the full place
			places.set(placeName, parts);

			// Add all parent levels too
			// E.g., "Springfield, Illinois, USA" creates:
			// - "Springfield, Illinois, USA" (full)
			// - "Illinois, USA" (parent)
			// - "USA" (grandparent)
			for (let i = 1; i < parts.length; i++) {
				const parentPlace = this.getPlaceAtLevel(parts, i);
				if (!places.has(parentPlace)) {
					places.set(parentPlace, parts.slice(i));
				}
			}
		};

		// Collect from all Gramps places that have comma-separated names
		for (const [, place] of grampsData.places) {
			if (place.name && place.name.includes(',')) {
				addPlace(place.name);
			}
		}

		return places;
	}

	/**
	 * Create place notes with proper hierarchy (parents created before children)
	 */
	private async createPlaceNotesWithHierarchy(
		places: Map<string, string[]>,
		grampsData: ParsedGrampsData,
		placesFolder: string,
		options: GrampsImportOptions,
		mediaHandleToPath: Map<string, string> | undefined,
		reportProgress: (phase: GrampsImportPhase, current: number, total: number, message?: string) => void
	): Promise<{
		placeNameToWikilink: Map<string, string>;
		placeNameToCrId: Map<string, string>;
		created: number;
	}> {
		const placeNameToWikilink = new Map<string, string>();
		const placeNameToCrId = new Map<string, string>();
		let created = 0;

		// Sort places by hierarchy depth (fewest parts first = most general)
		// This ensures parent places are created before children
		const sortedPlaces = Array.from(places.entries())
			.sort((a, b) => a[1].length - b[1].length);

		const totalPlaces = sortedPlaces.length;
		let placeIndex = 0;

		for (const [placeString, parts] of sortedPlaces) {
			reportProgress('places', placeIndex, totalPlaces);

			const name = parts[0]; // Most specific part
			const sanitizedName = name
				.replace(/[\\/:*?"<>|[\]]/g, '-')
				.replace(/\s+/g, ' ')
				.trim();

			// Add disambiguation if needed (e.g., "Illinois USA" to distinguish from city named Illinois)
			let fileName = sanitizedName;
			if (parts.length > 1 && parts.length <= 2) {
				fileName = `${sanitizedName} ${parts[1]}`;
			}

			const filePath = normalizePath(`${placesFolder}/${fileName}.md`);

			// Check if already exists
			if (this.app.vault.getAbstractFileByPath(filePath)) {
				// Try to read existing cr_id
				const existingFile = this.app.vault.getAbstractFileByPath(filePath);
				if (existingFile instanceof TFile) {
					const content = await this.app.vault.read(existingFile);
					const crIdMatch = content.match(/^cr_id:\s*(.+)$/m);
					if (crIdMatch) {
						placeNameToCrId.set(placeString, crIdMatch[1].trim());
					}
				}
				placeNameToWikilink.set(placeString, `[[${fileName}]]`);
				placeIndex++;
				continue;
			}

			const crId = generateCrId();
			placeNameToCrId.set(placeString, crId);
			placeNameToWikilink.set(placeString, `[[${fileName}]]`);

			// Get parent info if exists
			let parentWikilink: string | undefined;
			let parentCrId: string | undefined;
			if (parts.length > 1) {
				const parentPlaceString = this.getPlaceAtLevel(parts, 1);
				parentWikilink = placeNameToWikilink.get(parentPlaceString)?.replace(/^\[\[/, '').replace(/\]\]$/, '');
				parentCrId = placeNameToCrId.get(parentPlaceString);
			}

			// Infer place type
			const placeType = this.inferPlaceType(name, parts);

			// Look up original Gramps place for media/notes
			let grampsPlace: ParsedGrampsPlace | undefined;
			for (const [, p] of grampsData.places) {
				if (p.name === placeString) {
					grampsPlace = p;
					break;
				}
			}

			// Resolve media references
			const resolvedMedia: string[] = [];
			if (grampsPlace?.mediaRefs && mediaHandleToPath) {
				for (const ref of grampsPlace.mediaRefs) {
					const vaultPath = mediaHandleToPath.get(ref);
					if (vaultPath) {
						const filename = vaultPath.split('/').pop() || vaultPath;
						resolvedMedia.push(`"[[${filename}]]"`);
					}
				}
			}

			// Build PlaceData
			const placeData: PlaceData = {
				name: name,
				crId: crId,
				placeType: placeType,
				parentPlace: parentWikilink ? `[[${parentWikilink}]]` : undefined,
				parentPlaceId: parentCrId,
				media: resolvedMedia.length > 0 ? resolvedMedia : undefined
			};

			// Write place note
			await createPlaceNote(this.app, placeData, {
				directory: placesFolder,
				propertyAliases: options.propertyAliases
			});

			created++;
			placeIndex++;
		}

		return { placeNameToWikilink, placeNameToCrId, created };
	}

	/**
	 * Map Gramps place type to Charted Roots place type
	 */
	private mapGrampsPlaceType(grampsType?: string): string | undefined {
		if (!grampsType) return undefined;

		// Common Gramps place types mapped to Charted Roots equivalents
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

		// Check if file already exists
		const existingFile = this.app.vault.getAbstractFileByPath(filePath);
		if (existingFile instanceof TFile) {
			if (options.overwriteExisting) {
				// Overwrite existing file
				await this.app.vault.modify(existingFile, content);
				logger.debug('importSource', `Overwrote existing source: ${filePath}`);
			} else {
				// Skip existing file
				logger.debug('importSource', `Skipping existing source: ${filePath}`);
			}
			// Return wikilink to existing file
			const existingFileName = filePath.split('/').pop()?.replace('.md', '') || title;
			return {
				crId,
				wikilink: `[[${existingFileName}]]`
			};
		}

		await this.app.vault.create(filePath, content);

		// Return both crId and wikilink for mapping
		const finalFileName = filePath.split('/').pop()?.replace('.md', '') || title;
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

		// Map Gramps event type to Charted Roots event type
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
		// Prefer the principal participant (role="Primary") for event naming
		const personNames: string[] = [];
		const personWikilinks: string[] = [];
		const allPersonWikilinks: string[] = [];

		// First, try to find the primary participant
		let primaryPersonHandle: string | undefined;
		if (event.personRoles) {
			for (const [handle, role] of event.personRoles) {
				if (role === 'Primary') {
					primaryPersonHandle = handle;
					break;
				}
			}
		}

		// Use primary participant if found, otherwise fall back to first person
		const displayHandles = primaryPersonHandle
			? [primaryPersonHandle]
			: event.personHandles.slice(0, 1);

		// Populate title names/links (primary participant only)
		for (const personHandle of displayHandles) {
			const person = grampsData.persons.get(personHandle);
			if (person) {
				personNames.push(person.name || 'Unknown');
				personWikilinks.push(`[[${person.name || 'Unknown'}]]`);
			}
		}

		// Populate all person wikilinks for frontmatter persons field
		for (const personHandle of event.personHandles) {
			const person = grampsData.persons.get(personHandle);
			if (person) {
				allPersonWikilinks.push(`[[${person.name || 'Unknown'}]]`);
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

		// Add person references - always use persons array for consistency
		if (allPersonWikilinks.length > 0) {
			frontmatterLines.push(`${prop('persons')}:`);
			for (const p of allPersonWikilinks) {
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

		// Add privacy flag if any attached note is private
		let hasPrivateNotes = false;
		let notesContent = '';

		// Resolve and append notes (if enabled)
		if (options.importNotes !== false && event.noteRefs && event.noteRefs.length > 0) {
			const resolvedNotes: GrampsNote[] = [];
			for (const noteRef of event.noteRefs) {
				const note = grampsData.database.notes.get(noteRef);
				if (note) {
					resolvedNotes.push(note);
				}
			}
			if (resolvedNotes.length > 0) {
				notesContent = '\n' + formatNotesSection(resolvedNotes);
				hasPrivateNotes = hasPrivateNote(resolvedNotes);
			}
		}

		if (hasPrivateNotes) {
			frontmatterLines.push(`${prop('private')}: true`);
		}

		frontmatterLines.push('---');

		// Build note body
		const body = `\n# ${title}\n\n${event.description || ''}\n${notesContent}`;
		const content = frontmatterLines.join('\n') + body;

		// Create file
		// Include date in filename to distinguish multiple events of the same type with the same participants
		// e.g., "Residence of John Doe (2025-01-01)" vs "Residence of John Doe (2025-02-01)"
		const fileNameBase = event.date ? `${title} (${event.date})` : title;
		const fileName = this.slugify(fileNameBase) + '.md';
		const filePath = normalizePath(`${eventsFolder}/${fileName}`);

		// Check if file already exists
		const existingFile = this.app.vault.getAbstractFileByPath(filePath);
		if (existingFile instanceof TFile) {
			if (options.overwriteExisting) {
				// Overwrite existing file
				await this.app.vault.modify(existingFile, content);
				logger.debug('importEvent', `Overwrote existing event: ${filePath}`);
			} else {
				// Skip existing file (like places do)
				logger.debug('importEvent', `Skipping existing event: ${filePath}`);
			}
			return crId;
		}

		await this.app.vault.create(filePath, content);

		return crId;
	}

	/**
	 * Map Gramps event type to Charted Roots event type
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
