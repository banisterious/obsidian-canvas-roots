/**
 * GEDCOM Importer v2 for Canvas Roots
 *
 * Enhanced importer that creates event notes, source notes, and place notes
 * in addition to person notes.
 */

import { App, Notice, TFile, TFolder, normalizePath } from 'obsidian';
import { GedcomParserV2 } from './gedcom-parser-v2';
import {
	GedcomDataV2,
	GedcomIndividualV2,
	GedcomFamilyV2,
	GedcomEvent,
	GedcomSource,
	GedcomImportOptionsV2,
	GedcomImportResultV2,
	PedigreeType
} from './gedcom-types';
import { createPersonNote, PersonData } from '../core/person-note-writer';
import { generateCrId } from '../core/uuid';
import { getErrorMessage } from '../core/error-utils';
import type { CreateEventData, EventConfidence } from '../events/types/event-types';

/**
 * US State abbreviation to full name mapping for normalizing place names
 */
const US_STATE_ABBREVIATIONS: Record<string, string> = {
	'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
	'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
	'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
	'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
	'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
	'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
	'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
	'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
	'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
	'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
	'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
	'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
	'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
};

/**
 * Information about a created place note
 */
interface PlaceNoteInfo {
	path: string;
	crId: string;
}

/**
 * Enhanced GEDCOM Importer (v2)
 *
 * Creates:
 * - Person notes with extended attributes
 * - Event notes for all parsed events
 * - Source notes (Phase 2)
 * - Place notes (Phase 3)
 */
export class GedcomImporterV2 {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Analyze GEDCOM file before import (v2)
	 * Returns statistics including event and source counts
	 */
	analyzeFile(content: string): {
		individualCount: number;
		familyCount: number;
		sourceCount: number;
		eventCount: number;
		uniquePlaces: number;
		componentCount: number;
	} {
		const gedcomData = GedcomParserV2.parse(content);

		// Count individuals and families
		const individualCount = gedcomData.individuals.size;
		const familyCount = gedcomData.families.size;
		const sourceCount = gedcomData.sources.size;

		// Count events
		let eventCount = 0;
		for (const individual of gedcomData.individuals.values()) {
			eventCount += individual.events.length;
		}
		for (const family of gedcomData.families.values()) {
			eventCount += family.events.length;
		}

		// Count unique places
		const places = new Set<string>();
		for (const individual of gedcomData.individuals.values()) {
			if (individual.birthPlace) places.add(individual.birthPlace.toLowerCase());
			if (individual.deathPlace) places.add(individual.deathPlace.toLowerCase());
			for (const event of individual.events) {
				if (event.place) places.add(event.place.toLowerCase());
			}
		}
		for (const family of gedcomData.families.values()) {
			if (family.marriagePlace) places.add(family.marriagePlace.toLowerCase());
			for (const event of family.events) {
				if (event.place) places.add(event.place.toLowerCase());
			}
		}

		// Analyze connected components using BFS
		// Pre-build family lookup indexes for O(1) access instead of O(families) per person
		const familiesByPerson = new Map<string, Set<{ husbandRef?: string; wifeRef?: string; childRefs: string[] }>>();
		for (const family of gedcomData.families.values()) {
			// Index by husband
			if (family.husbandRef) {
				if (!familiesByPerson.has(family.husbandRef)) {
					familiesByPerson.set(family.husbandRef, new Set());
				}
				familiesByPerson.get(family.husbandRef)!.add(family);
			}
			// Index by wife
			if (family.wifeRef) {
				if (!familiesByPerson.has(family.wifeRef)) {
					familiesByPerson.set(family.wifeRef, new Set());
				}
				familiesByPerson.get(family.wifeRef)!.add(family);
			}
		}

		const visited = new Set<string>();
		let componentCount = 0;

		for (const [gedcomId] of gedcomData.individuals) {
			if (visited.has(gedcomId)) continue;

			componentCount++;
			const queue: string[] = [gedcomId];

			while (queue.length > 0) {
				const currentId = queue.shift()!;
				if (visited.has(currentId)) continue;

				visited.add(currentId);
				const individual = gedcomData.individuals.get(currentId);
				if (!individual) continue;

				const related: string[] = [];
				if (individual.fatherRef) related.push(individual.fatherRef);
				if (individual.motherRef) related.push(individual.motherRef);

				// Use pre-built index instead of iterating all families
				const personFamilies = familiesByPerson.get(currentId);
				if (personFamilies) {
					for (const family of personFamilies) {
						if (family.husbandRef === currentId && family.wifeRef) {
							related.push(family.wifeRef);
						}
						if (family.wifeRef === currentId && family.husbandRef) {
							related.push(family.husbandRef);
						}
						related.push(...family.childRefs);
					}
				}

				for (const relatedId of related) {
					if (!visited.has(relatedId) && gedcomData.individuals.has(relatedId)) {
						queue.push(relatedId);
					}
				}
			}
		}

		return {
			individualCount,
			familyCount,
			sourceCount,
			eventCount,
			uniquePlaces: places.size,
			componentCount
		};
	}

	/**
	 * Parse and validate GEDCOM content without importing
	 * Used for quality analysis before import
	 */
	parseContent(content: string): {
		valid: boolean;
		data?: GedcomDataV2;
		errors: string[];
		warnings: string[];
	} {
		// Validate first
		const validation = GedcomParserV2.validate(content);

		if (!validation.valid) {
			return {
				valid: false,
				errors: validation.errors.map(e => e.message),
				warnings: validation.warnings.map(w => w.message)
			};
		}

		// Parse
		const data = GedcomParserV2.parse(content);

		return {
			valid: true,
			data,
			errors: [],
			warnings: validation.warnings.map(w => w.message)
		};
	}

	/**
	 * Import GEDCOM file (v2)
	 * Optionally accepts pre-parsed data (if quality preview was shown)
	 */
	async importFile(
		content: string,
		options: GedcomImportOptionsV2,
		preParsedData?: GedcomDataV2
	): Promise<GedcomImportResultV2> {
		const result: GedcomImportResultV2 = {
			success: false,
			individualsImported: 0,
			eventsCreated: 0,
			sourcesCreated: 0,
			placesCreated: 0,
			placesUpdated: 0,
			errors: [],
			warnings: []
		};

		// Helper to report progress
		const reportProgress = options.onProgress || (() => {});

		try {
			let gedcomData: GedcomDataV2;

			// Use pre-parsed data if provided (from quality preview), otherwise parse now
			if (preParsedData) {
				gedcomData = preParsedData;
				reportProgress({ phase: 'validating', current: 1, total: 1, message: 'Using pre-validated data' });
				reportProgress({ phase: 'parsing', current: 1, total: 1, message: `Found ${gedcomData.individuals.size} individuals` });
			} else {
				// Validate GEDCOM first
				reportProgress({ phase: 'validating', current: 0, total: 1, message: 'Validating GEDCOM file…' });
				const validation = GedcomParserV2.validate(content);

				if (!validation.valid) {
					result.errors.push(...validation.errors.map(e => e.message));
					return result;
				}

				if (validation.warnings.length > 0) {
					result.warnings.push(...validation.warnings.map(w => w.message));
				}

				// Parse GEDCOM with v2 parser
				reportProgress({ phase: 'parsing', current: 0, total: 1, message: 'Parsing GEDCOM file…' });
				gedcomData = GedcomParserV2.parse(content);

				reportProgress({ phase: 'parsing', current: 1, total: 1, message: `Found ${gedcomData.individuals.size} individuals` });
			}

			// Count events for progress
			let totalEvents = 0;
			for (const individual of gedcomData.individuals.values()) {
				totalEvents += individual.events.length;
			}
			for (const family of gedcomData.families.values()) {
				totalEvents += family.events.length;
			}

			// Ensure folders exist
			if (options.createPeopleNotes) {
				await this.ensureFolderExists(options.peopleFolder);
			}
			if (options.createEventNotes) {
				await this.ensureFolderExists(options.eventsFolder);
			}
			if (options.createSourceNotes) {
				await this.ensureFolderExists(options.sourcesFolder);
			}
			if (options.createPlaceNotes) {
				await this.ensureFolderExists(options.placesFolder);
			}

			// Create mapping of GEDCOM IDs to cr_ids and note paths
			const gedcomToCrId = new Map<string, string>();
			const gedcomToNotePath = new Map<string, string>();
			const sourceIdToNotePath = new Map<string, string>();
			let placeToNoteInfo = new Map<string, PlaceNoteInfo>();

			// Phase 0: Create place notes (if enabled) - do this first for wikilinks
			if (options.createPlaceNotes) {
				const allPlaces = this.collectAllPlaces(gedcomData);
				if (allPlaces.size > 0) {
					reportProgress({ phase: 'places', current: 0, total: allPlaces.size, message: 'Creating place notes…' });
					const placeResult = await this.createPlaceNotes(allPlaces, options, reportProgress);
					placeToNoteInfo = placeResult.placeToNoteInfo;
					result.placesCreated = placeResult.created;
					result.placesUpdated = placeResult.updated;
				}
			}

			// Phase 1a: Create source notes (if enabled)
			if (options.createSourceNotes && gedcomData.sources.size > 0) {
				const totalSources = gedcomData.sources.size;
				let sourceIndex = 0;
				for (const [sourceId, source] of gedcomData.sources) {
					reportProgress({ phase: 'sources', current: sourceIndex, total: totalSources });
					try {
						const notePath = await this.createSourceNote(source, options);
						sourceIdToNotePath.set(sourceId, notePath);
						result.sourcesCreated++;
					} catch (error: unknown) {
						result.errors.push(
							`Failed to create source ${source.title || sourceId}: ${getErrorMessage(error)}`
						);
					}
					sourceIndex++;
				}
			}

			// Phase 1b: Create all person notes (if enabled)
			if (options.createPeopleNotes) {
				const totalPeople = gedcomData.individuals.size;
				let personIndex = 0;
				for (const [gedcomId, individual] of gedcomData.individuals) {
					reportProgress({ phase: 'people', current: personIndex, total: totalPeople });
					try {
						const { crId, notePath } = await this.importIndividual(
							individual,
							gedcomData,
							options,
							gedcomToCrId,
							placeToNoteInfo
						);

						gedcomToCrId.set(gedcomId, crId);
						gedcomToNotePath.set(gedcomId, notePath);
						result.individualsImported++;
					} catch (error: unknown) {
						result.errors.push(
							`Failed to import ${individual.name || 'Unknown'}: ${getErrorMessage(error)}`
						);
					}
					personIndex++;
				}

				// Phase 2: Update relationships with real cr_ids
				let relIndex = 0;
				for (const [, individual] of gedcomData.individuals) {
					reportProgress({ phase: 'relationships', current: relIndex, total: totalPeople });
					try {
						await this.updateRelationships(
							individual,
							gedcomToCrId,
							gedcomToNotePath,
							gedcomData
						);
					} catch (error: unknown) {
						result.errors.push(
							`Failed to update relationships for ${individual.name || 'Unknown'}: ${getErrorMessage(error)}`
						);
					}
					relIndex++;
				}
			}

			// Phase 3: Create event notes
			if (options.createEventNotes && totalEvents > 0) {
				let eventIndex = 0;

				// Individual events
				for (const individual of gedcomData.individuals.values()) {
					for (const event of individual.events) {
						reportProgress({ phase: 'events', current: eventIndex, total: totalEvents });
						try {
							await this.createEventNote(
								event,
								individual,
								null,
								gedcomData,
								gedcomToNotePath,
								sourceIdToNotePath,
								placeToNoteInfo,
								options
							);
							result.eventsCreated++;
						} catch (error: unknown) {
							result.errors.push(
								`Failed to create event ${event.eventType} for ${individual.name || 'Unknown'}: ${getErrorMessage(error)}`
							);
						}
						eventIndex++;
					}
				}

				// Family events
				for (const family of gedcomData.families.values()) {
					for (const event of family.events) {
						reportProgress({ phase: 'events', current: eventIndex, total: totalEvents });
						try {
							await this.createEventNote(
								event,
								null,
								family,
								gedcomData,
								gedcomToNotePath,
								sourceIdToNotePath,
								placeToNoteInfo,
								options
							);
							result.eventsCreated++;
						} catch (error: unknown) {
							const spouse1 = family.husbandRef ? gedcomData.individuals.get(family.husbandRef)?.name : 'Unknown';
							const spouse2 = family.wifeRef ? gedcomData.individuals.get(family.wifeRef)?.name : 'Unknown';
							result.errors.push(
								`Failed to create event ${event.eventType} for ${spouse1} & ${spouse2}: ${getErrorMessage(error)}`
							);
						}
						eventIndex++;
					}
				}
			}

			// Mark complete
			reportProgress({ phase: 'complete', current: 1, total: 1, message: 'Import complete' });

			// Build import complete message
			let importMessage = `Import complete: ${result.individualsImported} people`;
			if (result.placesCreated > 0 || result.placesUpdated > 0) {
				const placeParts: string[] = [];
				if (result.placesCreated > 0) placeParts.push(`${result.placesCreated} created`);
				if (result.placesUpdated > 0) placeParts.push(`${result.placesUpdated} updated`);
				importMessage += `, ${placeParts.join('/')} places`;
			}
			if (result.sourcesCreated > 0) {
				importMessage += `, ${result.sourcesCreated} sources`;
			}
			if (result.eventsCreated > 0) {
				importMessage += `, ${result.eventsCreated} events`;
			}
			if (result.errors.length > 0) {
				importMessage += `. ${result.errors.length} errors occurred`;
			}

			new Notice(importMessage, 8000);
			result.success = result.errors.length === 0;

		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			result.errors.push(`GEDCOM parse error: ${errorMsg}`);
			new Notice(`Import failed: ${errorMsg}`);
		}

		return result;
	}

	// ============================================================================
	// Private: Individual Import
	// ============================================================================

	private async importIndividual(
		individual: GedcomIndividualV2,
		gedcomData: GedcomDataV2,
		options: GedcomImportOptionsV2,
		gedcomToCrId: Map<string, string>,
		placeToNoteInfo: Map<string, PlaceNoteInfo>
	): Promise<{ crId: string; notePath: string }> {
		const crId = generateCrId();

		// Convert place strings to wikilinks if place notes were created
		let birthPlaceValue = individual.birthPlace;
		let deathPlaceValue = individual.deathPlace;

		if (individual.birthPlace) {
			const normalizedPlace = this.normalizePlaceString(individual.birthPlace);
			const placeInfo = placeToNoteInfo.get(normalizedPlace);
			if (placeInfo) {
				const placeBaseName = placeInfo.path.replace(/\.md$/, '').split('/').pop() || '';
				birthPlaceValue = `[[${placeBaseName}]]`;
			}
		}

		if (individual.deathPlace) {
			const normalizedPlace = this.normalizePlaceString(individual.deathPlace);
			const placeInfo = placeToNoteInfo.get(normalizedPlace);
			if (placeInfo) {
				const placeBaseName = placeInfo.path.replace(/\.md$/, '').split('/').pop() || '';
				deathPlaceValue = `[[${placeBaseName}]]`;
			}
		}

		// Convert GEDCOM individual to PersonData
		const personData: PersonData = {
			name: individual.name || 'Unknown',
			crId: crId,
			birthDate: GedcomParserV2.gedcomDateToISO(individual.birthDate || ''),
			deathDate: GedcomParserV2.gedcomDateToISO(individual.deathDate || ''),
			birthPlace: birthPlaceValue,
			deathPlace: deathPlaceValue,
			occupation: individual.occupation,
			sex: individual.sex === 'M' ? 'male' : individual.sex === 'F' ? 'female' : undefined
		};

		// Add extended attributes
		for (const [propName, value] of Object.entries(individual.attributes)) {
			(personData as unknown as Record<string, unknown>)[propName] = value;
		}

		// Add relationship references (biological parents)
		if (individual.fatherRef) {
			personData.fatherCrId = individual.fatherRef;
			const father = gedcomData.individuals.get(individual.fatherRef);
			if (father) {
				personData.fatherName = father.name || 'Unknown';
			}
		}
		if (individual.motherRef) {
			personData.motherCrId = individual.motherRef;
			const mother = gedcomData.individuals.get(individual.motherRef);
			if (mother) {
				personData.motherName = mother.name || 'Unknown';
			}
		}

		// Extract step/adoptive parent references from familyAsChildRefs
		const stepAdoptiveParents = this.extractStepAdoptiveParents(individual, gedcomData);
		if (stepAdoptiveParents.stepfatherRefs.length > 0) {
			personData.stepfatherCrId = stepAdoptiveParents.stepfatherRefs;
			personData.stepfatherName = stepAdoptiveParents.stepfatherNames;
		}
		if (stepAdoptiveParents.stepmotherRefs.length > 0) {
			personData.stepmotherCrId = stepAdoptiveParents.stepmotherRefs;
			personData.stepmotherName = stepAdoptiveParents.stepmotherNames;
		}
		if (stepAdoptiveParents.adoptiveFatherRef) {
			personData.adoptiveFatherCrId = stepAdoptiveParents.adoptiveFatherRef;
			personData.adoptiveFatherName = stepAdoptiveParents.adoptiveFatherName;
		}
		if (stepAdoptiveParents.adoptiveMotherRef) {
			personData.adoptiveMotherCrId = stepAdoptiveParents.adoptiveMotherRef;
			personData.adoptiveMotherName = stepAdoptiveParents.adoptiveMotherName;
		}

		if (individual.spouseRefs.length > 0) {
			personData.spouseCrId = individual.spouseRefs;
			personData.spouseName = individual.spouseRefs.map(ref => {
				const spouse = gedcomData.individuals.get(ref);
				return spouse?.name || 'Unknown';
			});
		}

		// Extract children from families
		const childRefs: string[] = [];
		const childNames: string[] = [];
		for (const family of gedcomData.families.values()) {
			if (family.husbandRef === individual.id || family.wifeRef === individual.id) {
				for (const childRef of family.childRefs) {
					if (!childRefs.includes(childRef)) {
						childRefs.push(childRef);
						const child = gedcomData.individuals.get(childRef);
						childNames.push(child?.name || 'Unknown');
					}
				}
			}
		}
		if (childRefs.length > 0) {
			personData.childCrId = childRefs;
			personData.childName = childNames;
		}

		// Create person note
		const file = await createPersonNote(this.app, personData, {
			directory: options.peopleFolder,
			addBidirectionalLinks: false,
			propertyAliases: options.propertyAliases,
			filenameFormat: this.getFormatForType('people', options),
			includeDynamicBlocks: options.includeDynamicBlocks,
			dynamicBlockTypes: options.dynamicBlockTypes
		});

		return { crId, notePath: file.path };
	}

	// ============================================================================
	// Private: Relationship Update
	// ============================================================================

	private async updateRelationships(
		individual: GedcomIndividualV2,
		gedcomToCrId: Map<string, string>,
		gedcomToNotePath: Map<string, string>,
		gedcomData: GedcomDataV2
	): Promise<void> {
		const crId = gedcomToCrId.get(individual.id);
		if (!crId) return;

		// Look up the actual file path from the map (handles duplicate names with suffixes)
		const filePath = gedcomToNotePath.get(individual.id);
		if (!filePath) return;

		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!file || !(file instanceof TFile)) {
			return;
		}

		const content = await this.app.vault.read(file);
		let updatedContent = content;

		// Replace GEDCOM IDs with real cr_ids
		const replacements: Array<{ from: string; to: string }> = [];

		if (individual.fatherRef) {
			const fatherCrId = gedcomToCrId.get(individual.fatherRef);
			if (fatherCrId) {
				replacements.push({ from: individual.fatherRef, to: fatherCrId });
			}
		}
		if (individual.motherRef) {
			const motherCrId = gedcomToCrId.get(individual.motherRef);
			if (motherCrId) {
				replacements.push({ from: individual.motherRef, to: motherCrId });
			}
		}
		for (const spouseRef of individual.spouseRefs) {
			const spouseCrId = gedcomToCrId.get(spouseRef);
			if (spouseCrId) {
				replacements.push({ from: spouseRef, to: spouseCrId });
			} else {
				console.warn(`[GEDCOM Import] No cr_id found for spouse ref ${spouseRef} of ${individual.name} (${individual.id})`);
			}
		}

		// Collect step/adoptive parent references from familyAsChildRefs
		const stepAdoptiveParents = this.extractStepAdoptiveParents(individual, gedcomData);
		for (const stepfatherRef of stepAdoptiveParents.stepfatherRefs) {
			const stepfatherCrId = gedcomToCrId.get(stepfatherRef);
			if (stepfatherCrId && !replacements.some(r => r.from === stepfatherRef)) {
				replacements.push({ from: stepfatherRef, to: stepfatherCrId });
			}
		}
		for (const stepmotherRef of stepAdoptiveParents.stepmotherRefs) {
			const stepmotherCrId = gedcomToCrId.get(stepmotherRef);
			if (stepmotherCrId && !replacements.some(r => r.from === stepmotherRef)) {
				replacements.push({ from: stepmotherRef, to: stepmotherCrId });
			}
		}
		if (stepAdoptiveParents.adoptiveFatherRef) {
			const adoptiveFatherCrId = gedcomToCrId.get(stepAdoptiveParents.adoptiveFatherRef);
			if (adoptiveFatherCrId && !replacements.some(r => r.from === stepAdoptiveParents.adoptiveFatherRef)) {
				replacements.push({ from: stepAdoptiveParents.adoptiveFatherRef, to: adoptiveFatherCrId });
			}
		}
		if (stepAdoptiveParents.adoptiveMotherRef) {
			const adoptiveMotherCrId = gedcomToCrId.get(stepAdoptiveParents.adoptiveMotherRef);
			if (adoptiveMotherCrId && !replacements.some(r => r.from === stepAdoptiveParents.adoptiveMotherRef)) {
				replacements.push({ from: stepAdoptiveParents.adoptiveMotherRef, to: adoptiveMotherCrId });
			}
		}

		// Collect child references from families where this person is a parent
		for (const family of gedcomData.families.values()) {
			if (family.husbandRef === individual.id || family.wifeRef === individual.id) {
				for (const childRef of family.childRefs) {
					const childCrId = gedcomToCrId.get(childRef);
					if (childCrId && !replacements.some(r => r.from === childRef)) {
						replacements.push({ from: childRef, to: childCrId });
					}
				}
			}
		}

		// DEBUG: Log replacements for debugging spouse_id issues
		if (replacements.length > 0) {
			console.debug(`[GEDCOM Import] Updating relationships for ${individual.name} (${individual.id}):`,
				replacements.map(r => `${r.from} -> ${r.to}`).join(', '));
		}

		// Apply replacements
		// Sort by length descending to replace longer IDs first (e.g., I27 before I2)
		// This prevents partial matches where I2 matches within I27
		const sortedReplacements = [...replacements].sort((a, b) => b.from.length - a.from.length);

		for (const { from, to } of sortedReplacements) {
			const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			// Replace in property values - use word boundary to prevent partial matches
			// Match the ID only when followed by end of line, comma, bracket, or whitespace
			// Include step/adoptive parent property names
			updatedContent = updatedContent.replace(
				new RegExp(`(father_id|mother_id|spouse_id|children_id|stepfather_id|stepmother_id|adoptive_father_id|adoptive_mother_id):\\s*${escapedFrom}(?=\\s*$|\\s*,|\\s*\\]|\\s*\\n)`, 'gm'),
				`$1: ${to}`
			);
			// Replace in array format (YAML list items)
			updatedContent = updatedContent.replace(
				new RegExp(`(\\s{2}- )${escapedFrom}$`, 'gm'),
				`$1${to}`
			);
			// Replace in inline array format: ["I1", "I2"]
			updatedContent = updatedContent.replace(
				new RegExp(`"${escapedFrom}"`, 'g'),
				`"${to}"`
			);
		}

		if (updatedContent !== content) {
			await this.app.vault.modify(file, updatedContent);
		}
	}

	// ============================================================================
	// Private: Event Note Creation
	// ============================================================================

	private async createEventNote(
		event: GedcomEvent,
		individual: GedcomIndividualV2 | null,
		family: GedcomFamilyV2 | null,
		gedcomData: GedcomDataV2,
		gedcomToNotePath: Map<string, string>,
		sourceIdToNotePath: Map<string, string>,
		placeToNoteInfo: Map<string, PlaceNoteInfo>,
		options: GedcomImportOptionsV2
	): Promise<TFile> {
		// Build event title
		let title: string;
		const eventTypeLabel = this.formatEventType(event.eventType);

		if (event.isFamilyEvent) {
			// Family event: "Marriage of John Smith and Jane Doe"
			const spouse1Name = event.spouse1Ref
				? gedcomData.individuals.get(event.spouse1Ref)?.name || 'Unknown'
				: 'Unknown';
			const spouse2Name = event.spouse2Ref
				? gedcomData.individuals.get(event.spouse2Ref)?.name || 'Unknown'
				: 'Unknown';
			title = `${eventTypeLabel} of ${spouse1Name} and ${spouse2Name}`;
		} else {
			// Individual event: "Birth of John Smith"
			const personName = individual?.name || 'Unknown';
			title = `${eventTypeLabel} of ${personName}`;
		}

		// Build person reference(s)
		let person: string | undefined;
		let persons: string[] | undefined;

		if (event.isFamilyEvent) {
			// Family events have multiple persons
			persons = [];
			if (event.spouse1Ref) {
				const notePath = gedcomToNotePath.get(event.spouse1Ref);
				if (notePath) {
					const baseName = notePath.replace(/\.md$/, '').split('/').pop() || '';
					persons.push(baseName);
				}
			}
			if (event.spouse2Ref) {
				const notePath = gedcomToNotePath.get(event.spouse2Ref);
				if (notePath) {
					const baseName = notePath.replace(/\.md$/, '').split('/').pop() || '';
					persons.push(baseName);
				}
			}
		} else if (individual) {
			// Individual event has one person
			const notePath = gedcomToNotePath.get(individual.id);
			if (notePath) {
				const baseName = notePath.replace(/\.md$/, '').split('/').pop() || '';
				person = baseName;
			}
		}

		// Build source references from event citations
		const sourceWikilinks: string[] = [];
		for (const citation of event.sourceCitations) {
			const sourcePath = sourceIdToNotePath.get(citation.sourceRef);
			if (sourcePath) {
				const baseName = sourcePath.replace(/\.md$/, '').split('/').pop() || '';
				sourceWikilinks.push(baseName);
			}
		}

		// Build place reference (wikilink if place notes were created)
		let placeValue: string | undefined;
		let placeWikilink: string | undefined;
		if (event.place) {
			// Normalize the place string to match the key used in placeToNoteInfo
			const normalizedPlace = this.normalizePlaceString(event.place);
			const placeInfo = placeToNoteInfo.get(normalizedPlace);
			if (placeInfo) {
				// Use wikilink to place note
				const placeBaseName = placeInfo.path.replace(/\.md$/, '').split('/').pop() || '';
				placeWikilink = placeBaseName;
			} else {
				// Use plain text (normalized)
				placeValue = normalizedPlace || event.place;
			}
		}

		// Build event data
		const eventData: CreateEventData = {
			title,
			eventType: event.eventType,
			datePrecision: event.datePrecision,
			date: event.date,
			dateEnd: event.dateEnd,
			person,
			persons: persons && persons.length > 0 ? persons : undefined,
			place: placeValue, // May be undefined if using wikilink
			description: event.description || `Imported from GEDCOM`,
			confidence: 'unknown' as EventConfidence
		};

		// Create the event note file directly (not using EventService to avoid circular deps)
		const crId = generateCrId();
		const frontmatterLines = this.buildEventFrontmatter(crId, eventData, sourceWikilinks, placeWikilink);
		const body = `\n# ${title}\n\n${eventData.description || ''}\n`;
		const content = frontmatterLines.join('\n') + body;

		// Create file
		const eventFormat = this.getFormatForType('events', options);
		const fileName = this.formatFilename(title, eventFormat);
		const filePath = normalizePath(`${options.eventsFolder}/${fileName}`);

		// Handle duplicate filenames
		let finalPath = filePath;
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(finalPath)) {
			const baseName = this.formatFilename(`${title}-${counter}`, eventFormat);
			finalPath = normalizePath(`${options.eventsFolder}/${baseName}`);
			counter++;
		}

		const file = await this.app.vault.create(finalPath, content);
		return file;
	}

	private buildEventFrontmatter(
		crId: string,
		data: CreateEventData,
		sourceWikilinks: string[] = [],
		placeWikilink?: string
	): string[] {
		const lines: string[] = [
			'---',
			'cr_type: event',
			`cr_id: ${crId}`,
			`title: "${data.title.replace(/"/g, '\\"')}"`,
			`event_type: ${data.eventType}`,
			`date_precision: ${data.datePrecision}`
		];

		if (data.date) {
			lines.push(`date: ${data.date}`);
		}
		if (data.dateEnd) {
			lines.push(`date_end: ${data.dateEnd}`);
		}
		if (data.person) {
			lines.push(`person: "[[${data.person}]]"`);
		}
		if (data.persons && data.persons.length > 0) {
			lines.push(`persons:`);
			for (const p of data.persons) {
				lines.push(`  - "[[${p}]]"`);
			}
		}
		// Place: use wikilink if provided, otherwise plain text
		if (placeWikilink) {
			lines.push(`place: "[[${placeWikilink}]]"`);
		} else if (data.place) {
			lines.push(`place: "${data.place.replace(/"/g, '\\"')}"`);
		}
		if (data.confidence) {
			lines.push(`confidence: ${data.confidence}`);
		}
		if (data.description) {
			lines.push(`description: "${data.description.replace(/"/g, '\\"')}"`);
		}
		// Add source references as wikilinks
		if (sourceWikilinks.length > 0) {
			lines.push(`sources:`);
			for (const source of sourceWikilinks) {
				lines.push(`  - "[[${source}]]"`);
			}
		}

		lines.push('---');
		return lines;
	}

	// ============================================================================
	// Private: Source Note Creation
	// ============================================================================

	private async createSourceNote(
		source: GedcomSource,
		options: GedcomImportOptionsV2
	): Promise<string> {
		const crId = generateCrId();

		// Determine source type (GEDCOM doesn't distinguish, so default to 'document')
		const sourceType = 'document';

		// Build frontmatter
		const frontmatterLines: string[] = [
			'---',
			'cr_type: source',
			`cr_id: ${crId}`,
			`title: "${(source.title || `Source ${source.id}`).replace(/"/g, '\\"')}"`,
			`source_type: ${sourceType}`
		];

		// Add author if available
		if (source.author) {
			frontmatterLines.push(`author: "${source.author.replace(/"/g, '\\"')}"`);
		}

		// Add publisher if available
		if (source.publisher) {
			frontmatterLines.push(`source_repository: "${source.publisher.replace(/"/g, '\\"')}"`);
		}

		// Add publication info as notes/description
		if (source.publication) {
			frontmatterLines.push(`publication_info: "${source.publication.replace(/"/g, '\\"')}"`);
		}

		// Default confidence for imported sources
		frontmatterLines.push(`confidence: unknown`);

		frontmatterLines.push('---');

		// Build note body
		const title = source.title || `Source ${source.id}`;
		let body = `\n# ${title}\n\n`;

		if (source.author) {
			body += `**Author:** ${source.author}\n\n`;
		}
		if (source.publisher) {
			body += `**Publisher:** ${source.publisher}\n\n`;
		}
		if (source.publication) {
			body += `**Publication:** ${source.publication}\n\n`;
		}
		if (source.notes) {
			body += `## Notes\n\n${source.notes}\n\n`;
		}

		body += `\n_Imported from GEDCOM source ${source.id}_\n`;

		const content = frontmatterLines.join('\n') + body;

		// Create file
		const sourceFormat = this.getFormatForType('sources', options);
		const fileName = this.formatFilename(title, sourceFormat);
		const filePath = normalizePath(`${options.sourcesFolder}/${fileName}`);

		// Handle duplicate filenames
		let finalPath = filePath;
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(finalPath)) {
			const baseName = this.formatFilename(`${title}-${counter}`, sourceFormat);
			finalPath = normalizePath(`${options.sourcesFolder}/${baseName}`);
			counter++;
		}

		await this.app.vault.create(finalPath, content);
		return finalPath;
	}

	// ============================================================================
	// Private: Utilities
	// ============================================================================

	/**
	 * Get the filename format for a specific note type
	 */
	private getFormatForType(
		type: 'people' | 'events' | 'sources' | 'places',
		options: GedcomImportOptionsV2
	): 'original' | 'kebab-case' | 'snake_case' {
		// Per-type formats take precedence
		if (options.filenameFormats) {
			return options.filenameFormats[type];
		}
		// Fall back to single format or default
		return options.filenameFormat || 'original';
	}

	private formatEventType(eventType: string): string {
		// Convert snake_case to Title Case
		return eventType
			.split('_')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	/**
	 * Format a filename based on the selected format option
	 */
	private formatFilename(name: string, format: 'original' | 'kebab-case' | 'snake_case' = 'original'): string {
		// First sanitize illegal filesystem characters
		const sanitized = name
			.replace(/[\\/:*?"<>|]/g, '')
			.trim();

		switch (format) {
			case 'kebab-case':
				return sanitized
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/^-+|-+$/g, '')
					.substring(0, 100) + '.md';

			case 'snake_case':
				return sanitized
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '_')
					.replace(/^_+|_+$/g, '')
					.substring(0, 100) + '.md';

			case 'original':
			default:
				// Keep original casing and spaces, just sanitize
				return sanitized.replace(/\s+/g, ' ').substring(0, 100) + '.md';
		}
	}


	private async ensureFolderExists(folderPath: string): Promise<void> {
		if (!folderPath) return;

		const normalizedPath = normalizePath(folderPath);
		const folder = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (!folder) {
			await this.app.vault.createFolder(normalizedPath);
		} else if (!(folder instanceof TFolder)) {
			throw new Error(`Path exists but is not a folder: ${normalizedPath}`);
		}
	}

	// ============================================================================
	// Private: Step/Adoptive Parent Extraction
	// ============================================================================

	/**
	 * Extract step-parent and adoptive parent references from familyAsChildRefs.
	 * Looks up the family records to find husband/wife and categorizes by pedigree type.
	 */
	private extractStepAdoptiveParents(
		individual: GedcomIndividualV2,
		gedcomData: GedcomDataV2
	): {
		stepfatherRefs: string[];
		stepfatherNames: string[];
		stepmotherRefs: string[];
		stepmotherNames: string[];
		adoptiveFatherRef?: string;
		adoptiveFatherName?: string;
		adoptiveMotherRef?: string;
		adoptiveMotherName?: string;
	} {
		const result = {
			stepfatherRefs: [] as string[],
			stepfatherNames: [] as string[],
			stepmotherRefs: [] as string[],
			stepmotherNames: [] as string[],
			adoptiveFatherRef: undefined as string | undefined,
			adoptiveFatherName: undefined as string | undefined,
			adoptiveMotherRef: undefined as string | undefined,
			adoptiveMotherName: undefined as string | undefined
		};

		// Skip if no familyAsChildRefs
		if (!individual.familyAsChildRefs || individual.familyAsChildRefs.length === 0) {
			return result;
		}

		for (const famcRef of individual.familyAsChildRefs) {
			// Skip biological relationships - those are handled via fatherRef/motherRef
			if (famcRef.pedigree === 'birth') {
				continue;
			}

			const family = gedcomData.families.get(famcRef.familyRef);
			if (!family) {
				continue;
			}

			// Get parent references and names from the family
			const husbandRef = family.husbandRef;
			const wifeRef = family.wifeRef;
			const husband = husbandRef ? gedcomData.individuals.get(husbandRef) : undefined;
			const wife = wifeRef ? gedcomData.individuals.get(wifeRef) : undefined;

			if (famcRef.pedigree === 'step') {
				// Step-parents (can have multiple)
				// Exclude biological parents - only add true step-parents
				if (husbandRef && !result.stepfatherRefs.includes(husbandRef) && husbandRef !== individual.fatherRef) {
					result.stepfatherRefs.push(husbandRef);
					result.stepfatherNames.push(husband?.name || 'Unknown');
				}
				if (wifeRef && !result.stepmotherRefs.includes(wifeRef) && wifeRef !== individual.motherRef) {
					result.stepmotherRefs.push(wifeRef);
					result.stepmotherNames.push(wife?.name || 'Unknown');
				}
			} else if (famcRef.pedigree === 'adop') {
				// Adoptive parents (typically one set)
				if (husbandRef && !result.adoptiveFatherRef) {
					result.adoptiveFatherRef = husbandRef;
					result.adoptiveFatherName = husband?.name || 'Unknown';
				}
				if (wifeRef && !result.adoptiveMotherRef) {
					result.adoptiveMotherRef = wifeRef;
					result.adoptiveMotherName = wife?.name || 'Unknown';
				}
			}
			// Note: 'foster' pedigree is not yet supported in frontmatter fields
		}

		return result;
	}

	// ============================================================================
	// Private: Place Note Creation (Hierarchical)
	// ============================================================================

	/**
	 * Parse a GEDCOM place string into hierarchical components.
	 * GEDCOM places are typically: "Locality, County, State, Country"
	 * Returns array from most specific to most general.
	 */
	/**
	 * Normalize a place string to handle inconsistent GEDCOM data.
	 * - Strips leading/trailing commas and whitespace
	 * - Collapses multiple spaces into single space
	 * - Removes empty parts between commas
	 * - Normalizes comma spacing
	 * - Expands US state abbreviations to full names (e.g., "SC" → "South Carolina")
	 * - Handles space-separated state abbreviations (e.g., "Abbeville SC" → "Abbeville, South Carolina")
	 *
	 * Examples:
	 * - ", Scotland, Missouri, USA" → "Scotland, Missouri, USA"
	 * - ", Scotland , Missouri, USA" → "Scotland, Missouri, USA"
	 * - "Springfield,  Sangamon,, Illinois" → "Springfield, Sangamon, Illinois"
	 * - "Abbeville, SC, USA" → "Abbeville, South Carolina, USA"
	 * - "Abbeville SC" → "Abbeville, South Carolina"
	 */
	private normalizePlaceString(placeString: string): string {
		if (!placeString) return '';

		// Split by comma, trim each part, filter empty parts
		const parts = placeString
			.split(',')
			.map(p => p.trim().replace(/\s+/g, ' ')) // Collapse multiple spaces
			.filter(p => p.length > 0)
			.flatMap(p => {
				// First check if the whole part is a state abbreviation
				const upperPart = p.toUpperCase();
				if (US_STATE_ABBREVIATIONS[upperPart]) {
					return [US_STATE_ABBREVIATIONS[upperPart]];
				}

				// Check for space-separated state abbreviation at the end (e.g., "Abbeville SC")
				const words = p.split(' ');
				if (words.length >= 2) {
					const lastWord = words[words.length - 1].toUpperCase();
					if (US_STATE_ABBREVIATIONS[lastWord]) {
						// Split into locality and state
						const locality = words.slice(0, -1).join(' ');
						const state = US_STATE_ABBREVIATIONS[lastWord];
						return [locality, state];
					}
				}

				return [p];
			});

		return parts.join(', ');
	}

	private parsePlaceHierarchy(placeString: string): string[] {
		if (!placeString) return [];

		// Split by comma, trim whitespace, filter empty parts
		const parts = placeString
			.split(',')
			.map(p => p.trim())
			.filter(p => p.length > 0);

		return parts;
	}

	/**
	 * Get canonical name for a place at a given level.
	 * E.g., for "Springfield, Sangamon, Illinois, USA" at level 2:
	 * Returns "Illinois, USA" (from index 2 onward)
	 */
	private getPlaceAtLevel(parts: string[], levelIndex: number): string {
		return parts.slice(levelIndex).join(', ');
	}

	/**
	 * Build a set of all unique places including parent chains.
	 * Returns Map of full place string → place hierarchy parts
	 */
	private collectAllPlaces(gedcomData: GedcomDataV2): Map<string, string[]> {
		const places = new Map<string, string[]>();

		const addPlace = (rawPlaceString: string) => {
			if (!rawPlaceString) return;

			// Normalize the place string to handle inconsistent GEDCOM data
			const placeString = this.normalizePlaceString(rawPlaceString);
			if (!placeString) return;

			const parts = this.parsePlaceHierarchy(placeString);
			if (parts.length === 0) return;

			// Add the full place (using normalized string as key)
			places.set(placeString, parts);

			// Add all parent levels too
			// E.g., "Springfield, Sangamon, Illinois, USA" creates:
			// - "Springfield, Sangamon, Illinois, USA" (full)
			// - "Sangamon, Illinois, USA" (parent)
			// - "Illinois, USA" (grandparent)
			// - "USA" (great-grandparent)
			for (let i = 1; i < parts.length; i++) {
				const parentPlace = this.getPlaceAtLevel(parts, i);
				if (!places.has(parentPlace)) {
					places.set(parentPlace, parts.slice(i));
				}
			}
		};

		// Collect from individuals
		for (const individual of gedcomData.individuals.values()) {
			if (individual.birthPlace) addPlace(individual.birthPlace);
			if (individual.deathPlace) addPlace(individual.deathPlace);
			for (const event of individual.events) {
				if (event.place) addPlace(event.place);
			}
		}

		// Collect from families
		for (const family of gedcomData.families.values()) {
			if (family.marriagePlace) addPlace(family.marriagePlace);
			for (const event of family.events) {
				if (event.place) addPlace(event.place);
			}
		}

		return places;
	}

	/**
	 * Create all place notes with proper hierarchy.
	 * Creates from most general (country) to most specific (locality).
	 * Checks for existing place notes and updates them if found.
	 * Returns map of placeString → notePath for wikilink generation.
	 */
	private async createPlaceNotes(
		places: Map<string, string[]>,
		options: GedcomImportOptionsV2,
		reportProgress: (progress: { phase: 'places'; current: number; total: number; message?: string }) => void
	): Promise<{ placeToNoteInfo: Map<string, PlaceNoteInfo>; created: number; updated: number }> {
		const placeToNoteInfo = new Map<string, PlaceNoteInfo>();
		let created = 0;
		let updated = 0;

		// Build a cache of existing place notes by full_name for fast lookup
		const existingPlaces = this.buildExistingPlaceCache();

		// Build a set of all place strings for context-aware type inference
		const allPlaceStrings = new Set(places.keys());

		// Sort places by hierarchy depth (fewest parts first = most general)
		// This ensures parent places are created before children
		const sortedPlaces = Array.from(places.entries())
			.sort((a, b) => a[1].length - b[1].length);

		const totalPlaces = sortedPlaces.length;
		let placeIndex = 0;

		for (const [placeString, parts] of sortedPlaces) {
			reportProgress({ phase: 'places', current: placeIndex, total: totalPlaces });
			try {
				const result = await this.createOrUpdatePlaceNote(
					placeString,
					parts,
					placeToNoteInfo,
					existingPlaces,
					options,
					allPlaceStrings
				);
				placeToNoteInfo.set(placeString, { path: result.path, crId: result.crId });
				if (result.wasUpdated) {
					updated++;
				} else {
					created++;
				}
			} catch (error: unknown) {
				// Log but continue with other places
				console.warn(`Failed to create place note for "${placeString}": ${getErrorMessage(error)}`);
			}
			placeIndex++;
		}

		return { placeToNoteInfo, created, updated };
	}

	/**
	 * Build a cache of existing place notes for duplicate detection.
	 * Indexes by:
	 * 1. full_name (case-insensitive) - primary lookup
	 * 2. title + parent combination - fallback for notes without full_name
	 */
	private buildExistingPlaceCache(): {
		byFullName: Map<string, TFile>;
		byTitleAndParent: Map<string, TFile>;
	} {
		const byFullName = new Map<string, TFile>();
		const byTitleAndParent = new Map<string, TFile>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const fileCache = this.app.metadataCache.getFileCache(file);
			if (!fileCache?.frontmatter) continue;

			// Check for place notes using both 'type' and 'cr_type' properties
			const noteType = fileCache.frontmatter.type || fileCache.frontmatter.cr_type;
			if (noteType !== 'place') continue;

			// Index by full_name (normalized and case-insensitive)
			if (fileCache.frontmatter.full_name) {
				// Normalize the full_name to match against normalized place strings
				const normalizedFullName = this.normalizePlaceString(String(fileCache.frontmatter.full_name)).toLowerCase();
				if (normalizedFullName) {
					byFullName.set(normalizedFullName, file);
				}
			}

			// Index by title + parent for fallback matching
			// Support both old 'parent' and new 'parent_place' properties
			const title = fileCache.frontmatter.title;
			const parent = fileCache.frontmatter.parent_place || fileCache.frontmatter.parent;
			if (title) {
				// Extract parent name from wikilink if present
				const parentName = parent
					? String(parent).replace(/^\[\[/, '').replace(/\]\]$/, '').toLowerCase()
					: '';
				const key = `${String(title).toLowerCase()}|${parentName}`;
				byTitleAndParent.set(key, file);
			}
		}

		return { byFullName, byTitleAndParent };
	}

	/**
	 * Find an existing place note that matches the given place string.
	 * Uses multiple strategies:
	 * 1. Exact match on full_name (case-insensitive)
	 * 2. Match on title + parent combination
	 */
	private findExistingPlace(
		placeString: string,
		parts: string[],
		placeToNoteInfo: Map<string, PlaceNoteInfo>,
		cache: { byFullName: Map<string, TFile>; byTitleAndParent: Map<string, TFile> }
	): TFile | null {
		// Strategy 1: Match by full_name (case-insensitive)
		const existingByFullName = cache.byFullName.get(placeString.toLowerCase());
		if (existingByFullName) {
			return existingByFullName;
		}

		// Strategy 2: Match by title + parent
		const name = parts[0];
		let parentBaseName = '';
		if (parts.length > 1) {
			const parentPlaceString = this.getPlaceAtLevel(parts, 1);
			const parentInfo = placeToNoteInfo.get(parentPlaceString);
			if (parentInfo) {
				parentBaseName = (parentInfo.path.replace(/\.md$/, '').split('/').pop() || '').toLowerCase();
			}
		}
		const titleParentKey = `${name.toLowerCase()}|${parentBaseName}`;
		const existingByTitleParent = cache.byTitleAndParent.get(titleParentKey);
		if (existingByTitleParent) {
			return existingByTitleParent;
		}

		return null;
	}

	/**
	 * Create or update a place note.
	 * If a place with the same full_name or title+parent exists, update it.
	 */
	private async createOrUpdatePlaceNote(
		placeString: string,
		parts: string[],
		placeToNoteInfo: Map<string, PlaceNoteInfo>,
		existingPlaces: { byFullName: Map<string, TFile>; byTitleAndParent: Map<string, TFile> },
		options: GedcomImportOptionsV2,
		allPlaceStrings?: Set<string>
	): Promise<{ path: string; crId: string; wasUpdated: boolean }> {
		// Check if place already exists using multiple strategies
		const existingFile = this.findExistingPlace(placeString, parts, placeToNoteInfo, existingPlaces);

		if (existingFile) {
			// Get or generate cr_id for existing place
			const fileCache = this.app.metadataCache.getFileCache(existingFile);
			let crId = fileCache?.frontmatter?.cr_id;

			// Update existing place note if parent wikilink needs to be added/updated
			const wasUpdated = await this.updateExistingPlaceNote(
				existingFile,
				parts,
				placeToNoteInfo,
				placeString
			);

			// If no cr_id exists, add one
			if (!crId) {
				crId = generateCrId();
				await this.app.fileManager.processFrontMatter(existingFile, (frontmatter) => {
					frontmatter.cr_id = crId;
				});
			}

			return { path: existingFile.path, crId, wasUpdated: wasUpdated || !fileCache?.frontmatter?.cr_id };
		}

		// Create new place note
		const result = await this.createPlaceNote(placeString, parts, placeToNoteInfo, options, allPlaceStrings);
		return { path: result.path, crId: result.crId, wasUpdated: false };
	}

	/**
	 * Update an existing place note's parent references and full_name if needed.
	 * Returns true if the note was modified, false otherwise.
	 */
	private async updateExistingPlaceNote(
		file: TFile,
		parts: string[],
		placeToNoteInfo: Map<string, PlaceNoteInfo>,
		placeString: string
	): Promise<boolean> {
		// Check current frontmatter
		const fileCache = this.app.metadataCache.getFileCache(file);
		const currentFullName = fileCache?.frontmatter?.full_name;
		// Support both old 'parent' and new 'parent_place' properties
		const currentParentPlace = fileCache?.frontmatter?.parent_place || fileCache?.frontmatter?.parent;
		const currentParentPlaceId = fileCache?.frontmatter?.parent_place_id;

		// Determine what needs updating
		let needsUpdate = false;
		let newParentWikilink: string | undefined;
		let newParentCrId: string | undefined;
		let newFullName: string | undefined;

		// Check if full_name needs to be added/updated
		if (!currentFullName) {
			newFullName = placeString;
			needsUpdate = true;
		}

		// Check if parent needs updating
		if (parts.length > 1) {
			const parentPlaceString = this.getPlaceAtLevel(parts, 1);
			const parentInfo = placeToNoteInfo.get(parentPlaceString);
			if (parentInfo) {
				const parentBaseName = parentInfo.path.replace(/\.md$/, '').split('/').pop() || '';
				// If parent_place is not set or doesn't match
				if (!currentParentPlace || !String(currentParentPlace).includes(parentBaseName)) {
					newParentWikilink = parentBaseName;
					needsUpdate = true;
				}
				// If parent_place_id is not set or doesn't match
				if (!currentParentPlaceId || currentParentPlaceId !== parentInfo.crId) {
					newParentCrId = parentInfo.crId;
					needsUpdate = true;
				}
			}
		}

		if (!needsUpdate) {
			return false;
		}

		// Update the frontmatter
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			if (newParentWikilink) {
				frontmatter.parent_place = `[[${newParentWikilink}]]`;
				// Remove old 'parent' property if it exists
				if (frontmatter.parent) {
					delete frontmatter.parent;
				}
			}
			if (newParentCrId) {
				frontmatter.parent_place_id = newParentCrId;
			}
			if (newFullName) {
				frontmatter.full_name = newFullName;
			}
		});

		return true;
	}

	/**
	 * Create a single place note with parent references.
	 */
	private async createPlaceNote(
		placeString: string,
		parts: string[],
		placeToNoteInfo: Map<string, PlaceNoteInfo>,
		options: GedcomImportOptionsV2,
		allPlaceStrings?: Set<string>
	): Promise<{ path: string; crId: string }> {
		const crId = generateCrId();

		// The "name" is the most specific part (first in the array)
		const name = parts[0];

		// Determine place type using heuristics (with context for smarter inference)
		const placeType = this.inferPlaceType(name, parts, allPlaceStrings);

		// Get parent place info for references (if any)
		let parentWikilink: string | undefined;
		let parentCrId: string | undefined;
		if (parts.length > 1) {
			const parentPlaceString = this.getPlaceAtLevel(parts, 1);
			const parentInfo = placeToNoteInfo.get(parentPlaceString);
			if (parentInfo) {
				const parentBaseName = parentInfo.path.replace(/\.md$/, '').split('/').pop() || '';
				parentWikilink = parentBaseName;
				parentCrId = parentInfo.crId;
			}
		}

		// Build frontmatter
		const frontmatterLines: string[] = [
			'---',
			'cr_type: place',
			`cr_id: ${crId}`,
			`title: "${name.replace(/"/g, '\\"')}"`,
			`place_type: ${placeType}`
		];

		// Add parent references (using correct property names per Place model)
		if (parentWikilink) {
			frontmatterLines.push(`parent_place: "[[${parentWikilink}]]"`);
		}
		if (parentCrId) {
			frontmatterLines.push(`parent_place_id: ${parentCrId}`);
		}

		// Add full place string for reference/search
		frontmatterLines.push(`full_name: "${placeString.replace(/"/g, '\\"')}"`);

		frontmatterLines.push('---');

		// Build note body
		let body = `\n# ${name}\n\n`;

		if (parentWikilink) {
			body += `**Part of:** [[${parentWikilink}]]\n\n`;
		}

		body += `_Imported from GEDCOM_\n`;

		const content = frontmatterLines.join('\n') + body;

		// Create file - use the specific place name for the filename
		// Include parent for disambiguation if needed
		let baseName: string;
		if (parts.length > 1 && parts.length <= 3) {
			// For counties and states, include immediate parent for clarity
			// e.g., "Sangamon, Illinois" or "Illinois, USA"
			baseName = `${name} ${parts[1]}`;
		} else if (parts.length > 3) {
			// For localities, include county for clarity
			baseName = `${name} ${parts[1]}`;
		} else {
			baseName = name;
		}

		const placeFormat = this.getFormatForType('places', options);
		const fileName = this.formatFilename(baseName, placeFormat);
		const filePath = normalizePath(`${options.placesFolder}/${fileName}`);

		// Handle duplicate filenames
		let finalPath = filePath;
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(finalPath)) {
			const dupeName = this.formatFilename(`${baseName}-${counter}`, placeFormat);
			finalPath = normalizePath(`${options.placesFolder}/${dupeName}`);
			counter++;
		}

		await this.app.vault.create(finalPath, content);
		return { path: finalPath, crId };
	}

	/**
	 * Infer place type using multiple heuristics.
	 * Checks name patterns, suffixes, and hierarchy position.
	 *
	 * @param name - The place name (first component of the hierarchy)
	 * @param parts - Full hierarchy parts array
	 * @param allPlaceStrings - Optional set of all place strings being imported (for context)
	 */
	private inferPlaceType(name: string, parts: string[], allPlaceStrings?: Set<string>): string {
		const nameLower = name.toLowerCase().trim();

		// Check for explicit type indicators in the name
		// Counties
		if (nameLower.includes(' county') ||
			nameLower.includes(' co.') ||
			nameLower.includes(' co,') ||
			nameLower.endsWith(' co')) {
			return 'county';
		}

		// States/Provinces - check common abbreviations and patterns
		const stateAbbreviations = ['al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga',
			'hi', 'id', 'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms',
			'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa',
			'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy', 'dc'];

		// If it's a 2-letter code and matches US state abbreviation pattern
		if (nameLower.length === 2 && stateAbbreviations.includes(nameLower)) {
			return 'state';
		}

		// Check for parish (Louisiana), borough (Alaska)
		if (nameLower.includes(' parish') || nameLower.includes(' borough')) {
			return 'county';
		}

		// Check for townships, villages, cities, towns
		if (nameLower.includes(' township') || nameLower.includes(' twp')) {
			return 'township';
		}
		if (nameLower.includes(' village') || nameLower.includes(' vlg')) {
			return 'village';
		}
		if (nameLower.includes(' city')) {
			return 'city';
		}
		if (nameLower.includes(' town')) {
			return 'town';
		}

		// International indicators
		if (nameLower.includes(' province') || nameLower.includes(' provincia')) {
			return 'province';
		}
		if (nameLower.includes(' region') || nameLower.includes(' région')) {
			return 'region';
		}
		if (nameLower.includes(' department') || nameLower.includes(' département')) {
			return 'department';
		}
		if (nameLower.includes(' district')) {
			return 'district';
		}
		if (nameLower.includes(' canton')) {
			return 'canton';
		}

		// Fall back to hierarchy-based inference with context awareness
		if (parts.length === 1) {
			// Single part - could be country or a well-known place
			const countries = ['usa', 'uk', 'england', 'scotland', 'wales', 'ireland',
				'france', 'germany', 'italy', 'spain', 'canada', 'australia', 'mexico',
				'netherlands', 'belgium', 'switzerland', 'austria', 'poland', 'sweden',
				'norway', 'denmark', 'finland'];
			if (countries.includes(nameLower)) {
				return 'country';
			}
			return 'region';
		} else if (parts.length === 2) {
			// Two parts - could be state, county, or city depending on context
			const parentLower = parts[1].toLowerCase().trim();
			const usStateNames = [
				'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
				'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
				'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
				'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
				'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
				'new hampshire', 'new jersey', 'new mexico', 'new york',
				'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon',
				'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
				'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington',
				'west virginia', 'wisconsin', 'wyoming', 'district of columbia'
			];
			if (usStateNames.includes(parentLower)) {
				// Parent is a US state - could be county OR city
				// If there are child places under this one, it's likely a county
				// Since we don't have that info here, use context from allPlaceStrings:
				// If there's a place like "X, Name, State" then "Name, State" is likely a county
				if (allPlaceStrings) {
					const thisPlaceLower = parts.join(', ').toLowerCase();
					const childPlace = Array.from(allPlaceStrings).find(ps => {
						const psLower = ps.toLowerCase();
						// Check if any place string ends with ", Name, State"
						return psLower.endsWith(`, ${thisPlaceLower}`) && psLower !== thisPlaceLower;
					});
					if (childPlace) {
						return 'county';
					}
				}
				// No child places found - default to locality (city/town)
				// Counties without the "County" suffix and without children are rare
				return 'locality';
			}
			// Parent is not a US state - likely state/province level
			return 'state';
		} else if (parts.length === 3) {
			// Three parts - could be county OR city depending on context
			// Check if there's an explicit "County" sibling that would indicate
			// this place is actually a locality within that county
			if (allPlaceStrings && this.hasExplicitCountySibling(name, parts, allPlaceStrings)) {
				return 'locality';
			}
			// Check if the parent has the same name as this place (e.g., Hartford within Hartford County)
			// This pattern indicates a city/town within a county of the same name
			if (parts.length >= 2 && nameLower === parts[1].toLowerCase().trim()) {
				return 'locality';
			}
			// Default to county for 3-part places without context
			return 'county';
		} else {
			// Four or more parts - locality (city, town, village, etc.)
			return 'locality';
		}
	}

	/**
	 * Check if there's an explicit county with the same base name in the data.
	 * e.g., if we're processing "Abbeville, South Carolina, USA" and
	 * "Abbeville County, South Carolina, USA" also exists, then "Abbeville"
	 * is likely a city within that county, not the county itself.
	 */
	private hasExplicitCountySibling(name: string, parts: string[], allPlaceStrings: Set<string>): boolean {
		const nameLower = name.toLowerCase().trim();

		// Build the parent portion (everything after the first part)
		const parentPortion = parts.slice(1).join(', ');

		// Check for common county patterns
		const countyPatterns = [
			`${nameLower} county, ${parentPortion}`,
			`${nameLower} co., ${parentPortion}`,
			`${nameLower} parish, ${parentPortion}`,  // Louisiana
			`${nameLower} borough, ${parentPortion}`   // Alaska
		];

		for (const pattern of countyPatterns) {
			// Check all place strings (case-insensitive)
			for (const placeString of allPlaceStrings) {
				if (placeString.toLowerCase() === pattern.toLowerCase()) {
					return true;
				}
			}
		}

		return false;
	}
}
