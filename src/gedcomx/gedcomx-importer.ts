/**
 * GEDCOM X Importer for Canvas Roots
 *
 * Imports GEDCOM X JSON data into the Obsidian vault as person notes.
 * Based on the FamilySearch GEDCOM X specification.
 */

import { App, Notice, TFile, normalizePath } from 'obsidian';
import { GedcomXParser, ParsedGedcomXData, ParsedGedcomXPerson } from './gedcomx-parser';
import {
	GedcomXValidationResult,
	GedcomXDocument,
	GedcomXSourceDescription,
	extractTypeName
} from './gedcomx-types';
import { createPersonNote, PersonData } from '../core/person-note-writer';
import { generateCrId } from '../core/uuid';
import { getErrorMessage } from '../core/error-utils';
import { getLogger } from '../core/logging';

const logger = getLogger('GedcomXImporter');

/**
 * Dynamic block type for person notes
 */
export type DynamicBlockType = 'timeline' | 'relationships' | 'media';

/**
 * GEDCOM X import options
 */
export interface GedcomXImportOptions {
	peopleFolder: string;
	overwriteExisting: boolean;
	fileName?: string;
	/** Property aliases for writing custom property names (user property → canonical) */
	propertyAliases?: Record<string, string>;
	/** Include dynamic content blocks in person notes */
	includeDynamicBlocks?: boolean;
	/** Which dynamic block types to include */
	dynamicBlockTypes?: DynamicBlockType[];
	/** Create place notes from unique places */
	createPlaceNotes?: boolean;
	/** Folder to store place notes */
	placesFolder?: string;
	/** Create event notes from person facts */
	createEventNotes?: boolean;
	/** Folder to store event notes */
	eventsFolder?: string;
	/** Create source notes from source descriptions */
	createSourceNotes?: boolean;
	/** Folder to store source notes */
	sourcesFolder?: string;
}

/**
 * GEDCOM X import result
 */
export interface GedcomXImportResult {
	success: boolean;
	individualsImported: number;
	notesCreated: number;
	notesUpdated: number;
	notesSkipped: number;
	errors: string[];
	validation?: GedcomXValidationResult;
	fileName?: string;
	malformedDataCount?: number;
	/** Number of place notes created */
	placesCreated?: number;
	/** Number of event notes created */
	eventsCreated?: number;
	/** Number of source notes created */
	sourcesCreated?: number;
}

/**
 * Import GEDCOM X files into Canvas Roots
 */
export class GedcomXImporter {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Analyze GEDCOM X file before import
	 * Returns basic statistics and component analysis
	 */
	analyzeFile(content: string): {
		individualCount: number;
		relationshipCount: number;
		componentCount: number;
	} {
		const data = GedcomXParser.parse(content);

		// Count individuals
		const individualCount = data.persons.size;

		// Count relationships by looking at spouse and parent references
		let relationshipCount = 0;
		for (const [, person] of data.persons) {
			relationshipCount += person.spouseRefs.length;
			if (person.fatherRef) relationshipCount++;
			if (person.motherRef) relationshipCount++;
		}
		// Divide by 2 since relationships are counted from both sides
		relationshipCount = Math.floor(relationshipCount / 2);

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
						related.push(otherPerson.id);
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

		return {
			individualCount,
			relationshipCount,
			componentCount
		};
	}

	/**
	 * Import GEDCOM X file
	 */
	async importFile(
		content: string,
		options: GedcomXImportOptions
	): Promise<GedcomXImportResult> {
		const result: GedcomXImportResult = {
			success: false,
			individualsImported: 0,
			notesCreated: 0,
			notesUpdated: 0,
			notesSkipped: 0,
			errors: [],
			fileName: options.fileName,
			malformedDataCount: 0
		};

		try {
			// Validate GEDCOM X first
			new Notice('Validating GEDCOM X file…');
			const validation = GedcomXParser.validate(content);
			result.validation = validation;

			// Check for critical errors
			if (!validation.valid) {
				result.errors.push(...validation.errors.map(e => e.message));
				new Notice(`GEDCOM X validation failed: ${validation.errors[0].message}`);
				return result;
			}

			// Show validation summary
			if (validation.warnings.length > 0) {
				new Notice(`Found ${validation.warnings.length} warning(s) - import will continue`);
			}

			// Parse GEDCOM X
			new Notice('Parsing GEDCOM X file…');
			const gedcomXData = GedcomXParser.parse(content);

			new Notice(`Parsed ${gedcomXData.persons.size} individuals`);
			logger.info('importFile', `Starting import of ${gedcomXData.persons.size} persons`);

			// Ensure people folder exists
			await this.ensureFolderExists(options.peopleFolder);

			// Create mapping of GEDCOM X IDs to cr_ids and file paths
			const gedcomXToCrId = new Map<string, string>();
			const gedcomXToFilePath = new Map<string, string>();

			// Mapping from place name to wikilink (for linking in person notes)
			const placeNameToWikilink = new Map<string, string>();

			// Create place notes FIRST if requested (so we can link to them from person notes)
			if (options.createPlaceNotes) {
				const placesFolder = options.placesFolder || options.peopleFolder;
				await this.ensureFolderExists(placesFolder);

				// Collect all unique places
				const allPlaces = this.collectAllPlaces(gedcomXData);

				if (allPlaces.size > 0) {
					new Notice(`Creating ${allPlaces.size} place notes...`);

					for (const placeString of allPlaces) {
						try {
							const { wikilink } = await this.createPlaceNote(placeString, placesFolder, options);
							placeNameToWikilink.set(placeString, wikilink);
							result.placesCreated = (result.placesCreated || 0) + 1;
						} catch (error: unknown) {
							result.errors.push(
								`Failed to import place ${placeString}: ${getErrorMessage(error)}`
							);
						}
					}
				}
			}

			// Parse raw JSON to access source descriptions (not in parsed data)
			const rawDocument = JSON.parse(content) as GedcomXDocument;

			// Mapping from source ID to wikilink (for linking in event notes)
			const sourceIdToWikilink = new Map<string, string>();

			// Create source notes if requested
			if (options.createSourceNotes && rawDocument.sourceDescriptions) {
				const sourcesFolder = options.sourcesFolder || options.peopleFolder;
				await this.ensureFolderExists(sourcesFolder);

				const sourceCount = rawDocument.sourceDescriptions.length;
				if (sourceCount > 0) {
					new Notice(`Creating ${sourceCount} source notes...`);

					for (const source of rawDocument.sourceDescriptions) {
						try {
							const { wikilink } = await this.createSourceNote(source, sourcesFolder);
							if (source.id) {
								sourceIdToWikilink.set(source.id, wikilink);
							}
							result.sourcesCreated = (result.sourcesCreated || 0) + 1;
						} catch (error: unknown) {
							const sourceTitle = source.titles?.[0]?.value || source.id || 'Unknown source';
							result.errors.push(
								`Failed to import source ${sourceTitle}: ${getErrorMessage(error)}`
							);
						}
					}
				}
			}

			// Create event notes if requested (from person facts)
			if (options.createEventNotes) {
				const eventsFolder = options.eventsFolder || options.peopleFolder;
				await this.ensureFolderExists(eventsFolder);

				// Collect all events from persons
				const allEvents = this.collectAllEvents(gedcomXData, rawDocument);
				if (allEvents.length > 0) {
					new Notice(`Creating ${allEvents.length} event notes...`);

					for (const eventInfo of allEvents) {
						try {
							await this.createEventNote(
								eventInfo,
								eventsFolder,
								placeNameToWikilink,
								sourceIdToWikilink
							);
							result.eventsCreated = (result.eventsCreated || 0) + 1;
						} catch (error: unknown) {
							result.errors.push(
								`Failed to import event ${eventInfo.title}: ${getErrorMessage(error)}`
							);
						}
					}
				}
			}

			// Create person notes
			new Notice('Creating person notes...');

			// First pass: Create all person notes
			for (const [personId, person] of gedcomXData.persons) {
				try {
					const { crId, filePath } = await this.importPerson(
						person,
						gedcomXData,
						options,
						gedcomXToCrId,
						placeNameToWikilink
					);

					gedcomXToCrId.set(personId, crId);
					gedcomXToFilePath.set(personId, filePath);
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
			}

			// Second pass: Update relationships now that all cr_ids are known
			new Notice('Updating relationships...');
			for (const [, person] of gedcomXData.persons) {
				try {
					await this.updateRelationships(
						person,
						gedcomXToCrId,
						gedcomXToFilePath
					);
				} catch (error: unknown) {
					result.errors.push(
						`Failed to update relationships for ${person.name}: ${getErrorMessage(error)}`
					);
				}
			}

			// Enhanced import complete notice
			let importMessage = `Import complete: ${result.notesCreated} people`;

			if (result.sourcesCreated && result.sourcesCreated > 0) {
				importMessage += `, ${result.sourcesCreated} sources`;
			}

			if (result.eventsCreated && result.eventsCreated > 0) {
				importMessage += `, ${result.eventsCreated} events`;
			}

			if (result.placesCreated && result.placesCreated > 0) {
				importMessage += `, ${result.placesCreated} places`;
			}

			if (result.malformedDataCount && result.malformedDataCount > 0) {
				importMessage += `. ${result.malformedDataCount} had missing/invalid data`;
			}

			if (result.errors.length > 0) {
				importMessage += `. ${result.errors.length} errors occurred`;
			}

			new Notice(importMessage, 8000);
			result.success = result.errors.length === 0;

			logger.info('importFile', `Import complete: ${result.notesCreated} people, ${result.eventsCreated || 0} events, ${result.sourcesCreated || 0} sources, ${result.errors.length} errors`);

		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			result.errors.push(`GEDCOM X parse error: ${errorMsg}`);
			new Notice(`Import failed: ${errorMsg}`);
			logger.error('importFile', 'Import failed', error);
		}

		return result;
	}

	/**
	 * Import a single person
	 * @returns Object containing the cr_id and the actual file path created
	 */
	private async importPerson(
		person: ParsedGedcomXPerson,
		gedcomXData: ParsedGedcomXData,
		options: GedcomXImportOptions,
		gedcomXToCrId: Map<string, string>,
		placeNameToWikilink: Map<string, string>
	): Promise<{ crId: string; filePath: string }> {
		const crId = generateCrId();

		// Convert place strings to wikilinks if place notes were created
		let birthPlaceValue = person.birthPlace;
		let deathPlaceValue = person.deathPlace;

		if (person.birthPlace) {
			const wikilink = placeNameToWikilink.get(person.birthPlace);
			if (wikilink) {
				birthPlaceValue = wikilink;
			}
		}

		if (person.deathPlace) {
			const wikilink = placeNameToWikilink.get(person.deathPlace);
			if (wikilink) {
				deathPlaceValue = wikilink;
			}
		}

		// Convert GEDCOM X person to PersonData
		const personData: PersonData = {
			name: person.name || 'Unknown',
			crId: crId,
			birthDate: person.birthDate,
			deathDate: person.deathDate,
			birthPlace: birthPlaceValue,
			deathPlace: deathPlaceValue,
			occupation: person.occupation,
			sex: person.gender === 'M' ? 'male' : person.gender === 'F' ? 'female' : undefined
		};

		// Add relationship references with GEDCOM X IDs (temporary) and names
		if (person.fatherRef) {
			personData.fatherCrId = person.fatherRef; // Temporary GEDCOM X ID
			const father = gedcomXData.persons.get(person.fatherRef);
			if (father) {
				personData.fatherName = father.name || 'Unknown';
			}
		}

		if (person.motherRef) {
			personData.motherCrId = person.motherRef; // Temporary GEDCOM X ID
			const mother = gedcomXData.persons.get(person.motherRef);
			if (mother) {
				personData.motherName = mother.name || 'Unknown';
			}
		}

		if (person.spouseRefs.length > 0) {
			personData.spouseCrId = person.spouseRefs; // Temporary GEDCOM X IDs
			personData.spouseName = person.spouseRefs.map(ref => {
				const spouse = gedcomXData.persons.get(ref);
				return spouse?.name || 'Unknown';
			});
			// Note: Marriage date/place is tracked in the ParsedGedcomXPerson.marriages Map
			// but PersonData doesn't support it directly - this would need to be added
			// to the frontmatter separately if needed
		}

		// Add step-parent references (from StepParent lineage type)
		if (person.stepfatherRefs.length > 0) {
			personData.stepfatherCrId = person.stepfatherRefs; // Temporary GEDCOM X IDs
			personData.stepfatherName = person.stepfatherRefs.map(ref => {
				const stepfather = gedcomXData.persons.get(ref);
				return stepfather?.name || 'Unknown';
			});
		}

		if (person.stepmotherRefs.length > 0) {
			personData.stepmotherCrId = person.stepmotherRefs; // Temporary GEDCOM X IDs
			personData.stepmotherName = person.stepmotherRefs.map(ref => {
				const stepmother = gedcomXData.persons.get(ref);
				return stepmother?.name || 'Unknown';
			});
		}

		// Add adoptive parent references (from AdoptiveParent lineage type)
		if (person.adoptiveFatherRef) {
			personData.adoptiveFatherCrId = person.adoptiveFatherRef; // Temporary GEDCOM X ID
			const adoptiveFather = gedcomXData.persons.get(person.adoptiveFatherRef);
			if (adoptiveFather) {
				personData.adoptiveFatherName = adoptiveFather.name || 'Unknown';
			}
		}

		if (person.adoptiveMotherRef) {
			personData.adoptiveMotherCrId = person.adoptiveMotherRef; // Temporary GEDCOM X ID
			const adoptiveMother = gedcomXData.persons.get(person.adoptiveMotherRef);
			if (adoptiveMother) {
				personData.adoptiveMotherName = adoptiveMother.name || 'Unknown';
			}
		}

		// Find children (people who have this person as a parent)
		const childRefs: string[] = [];
		const childNames: string[] = [];
		for (const [childId, child] of gedcomXData.persons) {
			if (child.fatherRef === person.id || child.motherRef === person.id) {
				if (!childRefs.includes(childId)) {
					childRefs.push(childId);
					childNames.push(child.name || 'Unknown');
				}
			}
		}
		if (childRefs.length > 0) {
			personData.childCrId = childRefs; // Temporary GEDCOM X IDs
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

		return { crId, filePath: file.path };
	}

	/**
	 * Update relationships with actual cr_ids
	 */
	private async updateRelationships(
		person: ParsedGedcomXPerson,
		gedcomXToCrId: Map<string, string>,
		gedcomXToFilePath: Map<string, string>
	): Promise<void> {
		const crId = gedcomXToCrId.get(person.id);
		if (!crId) return;

		// Look up the actual file path from the map (handles duplicate names with suffixes)
		const filePath = gedcomXToFilePath.get(person.id);
		if (!filePath) return;

		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!file || !(file instanceof TFile)) {
			return;
		}

		// Read the file
		const content = await this.app.vault.read(file);

		// Update frontmatter with real cr_ids (replacing temporary GEDCOM X IDs)
		let updatedContent = content;

		// Replace father_id reference with real cr_id
		if (person.fatherRef) {
			const fatherCrId = gedcomXToCrId.get(person.fatherRef);
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
			const motherCrId = gedcomXToCrId.get(person.motherRef);
			if (motherCrId) {
				const escapedRef = this.escapeRegex(person.motherRef);
				updatedContent = updatedContent.replace(
					new RegExp(`mother_id: ${escapedRef}`, 'g'),
					`mother_id: ${motherCrId}`
				);
			}
		}

		// Replace spouse_id references with real cr_ids
		if (person.spouseRefs.length > 0) {
			for (const spouseRef of person.spouseRefs) {
				const spouseCrId = gedcomXToCrId.get(spouseRef);
				if (spouseCrId) {
					const escapedRef = this.escapeRegex(spouseRef);
					// Replace in spouse_id field
					updatedContent = updatedContent.replace(
						new RegExp(`spouse_id: ${escapedRef}`, 'g'),
						`spouse_id: ${spouseCrId}`
					);
					// Also replace in array format
					updatedContent = updatedContent.replace(
						new RegExp(` {2}- ${escapedRef}`, 'g'),
						`  - ${spouseCrId}`
					);
				}
			}
		}

		// Replace children_id references with real cr_ids
		for (const [gedcomXId, crId] of gedcomXToCrId) {
			if (content.includes(gedcomXId)) {
				const escapedRef = this.escapeRegex(gedcomXId);
				// Replace in children_id field (single value)
				updatedContent = updatedContent.replace(
					new RegExp(`children_id: ${escapedRef}`, 'g'),
					`children_id: ${crId}`
				);
				// Also replace in array format
				updatedContent = updatedContent.replace(
					new RegExp(` {2}- ${escapedRef}`, 'g'),
					`  - ${crId}`
				);
			}
		}

		// Replace stepfather_id references with real cr_ids
		if (person.stepfatherRefs.length > 0) {
			for (const stepfatherRef of person.stepfatherRefs) {
				const stepfatherCrId = gedcomXToCrId.get(stepfatherRef);
				if (stepfatherCrId) {
					const escapedRef = this.escapeRegex(stepfatherRef);
					updatedContent = updatedContent.replace(
						new RegExp(`stepfather_id: ${escapedRef}`, 'g'),
						`stepfather_id: ${stepfatherCrId}`
					);
					updatedContent = updatedContent.replace(
						new RegExp(` {2}- ${escapedRef}`, 'g'),
						`  - ${stepfatherCrId}`
					);
				}
			}
		}

		// Replace stepmother_id references with real cr_ids
		if (person.stepmotherRefs.length > 0) {
			for (const stepmotherRef of person.stepmotherRefs) {
				const stepmotherCrId = gedcomXToCrId.get(stepmotherRef);
				if (stepmotherCrId) {
					const escapedRef = this.escapeRegex(stepmotherRef);
					updatedContent = updatedContent.replace(
						new RegExp(`stepmother_id: ${escapedRef}`, 'g'),
						`stepmother_id: ${stepmotherCrId}`
					);
					updatedContent = updatedContent.replace(
						new RegExp(` {2}- ${escapedRef}`, 'g'),
						`  - ${stepmotherCrId}`
					);
				}
			}
		}

		// Replace adoptive_father_id reference with real cr_id
		if (person.adoptiveFatherRef) {
			const adoptiveFatherCrId = gedcomXToCrId.get(person.adoptiveFatherRef);
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
			const adoptiveMotherCrId = gedcomXToCrId.get(person.adoptiveMotherRef);
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
	 * Collect all unique places from GEDCOM X data
	 */
	private collectAllPlaces(gedcomXData: ParsedGedcomXData): Set<string> {
		const places = new Set<string>();

		for (const [, person] of gedcomXData.persons) {
			if (person.birthPlace) {
				places.add(person.birthPlace);
			}
			if (person.deathPlace) {
				places.add(person.deathPlace);
			}
		}

		return places;
	}

	/**
	 * Create a place note
	 * @returns Object containing the cr_id and the wikilink
	 */
	private async createPlaceNote(
		placeString: string,
		placesFolder: string,
		options: GedcomXImportOptions
	): Promise<{ crId: string; wikilink: string }> {
		const crId = generateCrId();

		// Parse place hierarchy (comma-separated)
		const parts = placeString.split(',').map(p => p.trim()).filter(p => p.length > 0);
		const name = parts[0] || placeString;

		// Infer place type from hierarchy
		const placeType = this.inferPlaceType(parts);

		// Build frontmatter
		const frontmatterLines: string[] = [
			'---',
			'cr_type: place',
			`cr_id: ${crId}`,
			`title: "${name.replace(/"/g, '\\"')}"`,
			`place_type: ${placeType}`
		];

		// Add full place string for reference/search
		if (parts.length > 1) {
			frontmatterLines.push(`full_name: "${placeString.replace(/"/g, '\\"')}"`);
		}

		frontmatterLines.push('---');

		// Build note body
		let body = `\n# ${name}\n\n`;

		if (parts.length > 1) {
			body += `**Location:** ${placeString}\n\n`;
		}

		body += `_Imported from GEDCOM X_\n`;

		const content = frontmatterLines.join('\n') + body;

		// Create filename - include parent for disambiguation if needed
		let baseName: string;
		if (parts.length > 1) {
			baseName = `${name} ${parts[1]}`;
		} else {
			baseName = name;
		}

		// Sanitize filename
		const safeFileName = this.sanitizeFilename(baseName);
		const filePath = normalizePath(`${placesFolder}/${safeFileName}.md`);

		// Handle duplicate filenames
		let finalPath = filePath;
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(finalPath)) {
			finalPath = normalizePath(`${placesFolder}/${safeFileName}-${counter}.md`);
			counter++;
		}

		await this.app.vault.create(finalPath, content);

		// Extract the wikilink name from the path
		const wikilinkName = finalPath.replace(/\.md$/, '').split('/').pop() || name;

		return { crId, wikilink: `[[${wikilinkName}]]` };
	}

	/**
	 * Infer place type from hierarchy parts
	 */
	private inferPlaceType(parts: string[]): string {
		if (parts.length === 1) {
			return 'unknown';
		}

		// Check last part for country indicators
		const lastPart = parts[parts.length - 1].toLowerCase();
		if (['usa', 'united states', 'us', 'uk', 'united kingdom', 'canada', 'australia'].includes(lastPart)) {
			if (parts.length === 2) {
				return 'state';
			} else if (parts.length === 3) {
				return 'county';
			} else {
				return 'city';
			}
		}

		// Default based on position in hierarchy
		if (parts.length === 2) {
			return 'region';
		} else if (parts.length >= 3) {
			return 'city';
		}

		return 'unknown';
	}

	/**
	 * Sanitize a string for use as a filename
	 */
	private sanitizeFilename(name: string): string {
		return name
			.replace(/[\\/:*?"<>|[\]]/g, '-')
			.replace(/\s+/g, ' ')
			.trim();
	}

	// ============================================================================
	// Source Note Creation
	// ============================================================================

	/**
	 * Create a source note from GEDCOM X source description
	 */
	private async createSourceNote(
		source: GedcomXSourceDescription,
		sourcesFolder: string
	): Promise<{ crId: string; wikilink: string }> {
		const crId = generateCrId();

		// Extract title from source
		const title = source.titles?.[0]?.value || source.id || 'Unknown Source';

		// Extract citation text
		const citation = source.citations?.[0]?.value;

		// Build frontmatter
		const frontmatterLines: string[] = [
			'---',
			'cr_type: source',
			`cr_id: ${crId}`,
			`title: "${title.replace(/"/g, '\\"')}"`,
			`source_type: document`
		];

		// Add citation if available
		if (citation) {
			frontmatterLines.push(`citation: "${citation.replace(/"/g, '\\"')}"`);
		}

		// Add about/URL if available
		if (source.about) {
			frontmatterLines.push(`url: "${source.about.replace(/"/g, '\\"')}"`);
		}

		frontmatterLines.push('confidence: unknown');
		frontmatterLines.push('---');

		// Build note body
		let body = `\n# ${title}\n\n`;

		if (citation) {
			body += `**Citation:** ${citation}\n\n`;
		}

		if (source.about) {
			body += `**URL:** ${source.about}\n\n`;
		}

		body += `_Imported from GEDCOM X_\n`;

		const content = frontmatterLines.join('\n') + body;

		// Create filename
		const safeFileName = this.sanitizeFilename(title);
		const filePath = normalizePath(`${sourcesFolder}/${safeFileName}.md`);

		// Handle duplicate filenames
		let finalPath = filePath;
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(finalPath)) {
			finalPath = normalizePath(`${sourcesFolder}/${safeFileName}-${counter}.md`);
			counter++;
		}

		await this.app.vault.create(finalPath, content);

		// Extract the wikilink name from the path
		const wikilinkName = finalPath.replace(/\.md$/, '').split('/').pop() || title;

		return { crId, wikilink: `[[${wikilinkName}]]` };
	}

	// ============================================================================
	// Event Note Creation
	// ============================================================================

	/**
	 * Collect all events from GEDCOM X data
	 */
	private collectAllEvents(
		parsedData: ParsedGedcomXData,
		rawDocument: GedcomXDocument
	): Array<{ title: string; eventType: string; date?: string; place?: string; personName?: string; sourceRefs: string[] }> {
		const events: Array<{ title: string; eventType: string; date?: string; place?: string; personName?: string; sourceRefs: string[] }> = [];

		// Collect events from raw persons (to get full fact data)
		if (rawDocument.persons) {
			for (const rawPerson of rawDocument.persons) {
				const parsedPerson = parsedData.persons.get(rawPerson.id);
				const personName = parsedPerson?.name || 'Unknown';

				if (rawPerson.facts) {
					for (const fact of rawPerson.facts) {
						const eventType = extractTypeName(fact.type);
						const title = `${eventType} of ${personName}`;

						// Extract source references
						const sourceRefs: string[] = [];
						if (fact.sources) {
							for (const sourceRef of fact.sources) {
								if (sourceRef.description) {
									// Remove leading # if present
									const sourceId = sourceRef.description.startsWith('#')
										? sourceRef.description.substring(1)
										: sourceRef.description;
									sourceRefs.push(sourceId);
								}
							}
						}

						events.push({
							title,
							eventType: eventType.toLowerCase(),
							date: fact.date?.original || fact.date?.formal,
							place: fact.place?.original,
							personName,
							sourceRefs
						});
					}
				}
			}
		}

		return events;
	}

	/**
	 * Create an event note
	 */
	private async createEventNote(
		eventInfo: { title: string; eventType: string; date?: string; place?: string; personName?: string; sourceRefs: string[] },
		eventsFolder: string,
		placeNameToWikilink: Map<string, string>,
		sourceIdToWikilink: Map<string, string>
	): Promise<void> {
		const crId = generateCrId();

		// Build frontmatter
		const frontmatterLines: string[] = [
			'---',
			'cr_type: event',
			`cr_id: ${crId}`,
			`title: "${eventInfo.title.replace(/"/g, '\\"')}"`,
			`event_type: ${eventInfo.eventType}`
		];

		// Add date if available
		if (eventInfo.date) {
			frontmatterLines.push(`date: "${eventInfo.date.replace(/"/g, '\\"')}"`);
		}

		// Add person reference - always use persons array for consistency
		if (eventInfo.personName) {
			frontmatterLines.push(`persons:`);
			frontmatterLines.push(`  - "${eventInfo.personName.replace(/"/g, '\\"')}"`);
		}

		// Add place (as wikilink if place note exists)
		if (eventInfo.place) {
			const placeWikilink = placeNameToWikilink.get(eventInfo.place);
			if (placeWikilink) {
				frontmatterLines.push(`place: "${placeWikilink}"`);
			} else {
				frontmatterLines.push(`place: "${eventInfo.place.replace(/"/g, '\\"')}"`);
			}
		}

		// Add source references
		if (eventInfo.sourceRefs.length > 0) {
			frontmatterLines.push(`sources:`);
			for (const sourceId of eventInfo.sourceRefs) {
				const sourceWikilink = sourceIdToWikilink.get(sourceId);
				if (sourceWikilink) {
					frontmatterLines.push(`  - "${sourceWikilink}"`);
				}
			}
		}

		frontmatterLines.push('confidence: unknown');
		frontmatterLines.push('---');

		// Build note body
		let body = `\n# ${eventInfo.title}\n\n`;

		if (eventInfo.date) {
			body += `**Date:** ${eventInfo.date}\n\n`;
		}

		if (eventInfo.place) {
			body += `**Place:** ${eventInfo.place}\n\n`;
		}

		body += `_Imported from GEDCOM X_\n`;

		const content = frontmatterLines.join('\n') + body;

		// Create filename
		const safeFileName = this.sanitizeFilename(eventInfo.title);
		const filePath = normalizePath(`${eventsFolder}/${safeFileName}.md`);

		// Handle duplicate filenames
		let finalPath = filePath;
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(finalPath)) {
			finalPath = normalizePath(`${eventsFolder}/${safeFileName}-${counter}.md`);
			counter++;
		}

		await this.app.vault.create(finalPath, content);
	}
}
