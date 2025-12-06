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
	GedcomImportOptionsV2,
	GedcomImportResultV2
} from './gedcom-types';
import { GedcomValidationResult } from './gedcom-parser';
import { createPersonNote, PersonData } from '../core/person-note-writer';
import { generateCrId } from '../core/uuid';
import { getErrorMessage } from '../core/error-utils';
import type { CreateEventData, DatePrecision, EventConfidence } from '../events/types/event-types';

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

				for (const family of gedcomData.families.values()) {
					if (family.husbandRef === currentId && family.wifeRef) {
						related.push(family.wifeRef);
					}
					if (family.wifeRef === currentId && family.husbandRef) {
						related.push(family.husbandRef);
					}
					if (family.husbandRef === currentId || family.wifeRef === currentId) {
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
	 * Import GEDCOM file (v2)
	 */
	async importFile(
		content: string,
		options: GedcomImportOptionsV2
	): Promise<GedcomImportResultV2> {
		const result: GedcomImportResultV2 = {
			success: false,
			individualsImported: 0,
			eventsCreated: 0,
			sourcesCreated: 0,
			placesCreated: 0,
			errors: [],
			warnings: []
		};

		try {
			// Validate GEDCOM first
			new Notice('Validating GEDCOM file…');
			const validation = GedcomParserV2.validate(content);

			if (!validation.valid) {
				result.errors.push(...validation.errors.map(e => e.message));
				new Notice(`GEDCOM validation failed: ${validation.errors[0].message}`);
				return result;
			}

			if (validation.warnings.length > 0) {
				result.warnings.push(...validation.warnings.map(w => w.message));
				new Notice(`Found ${validation.warnings.length} warning(s) - import will continue`);
			}

			// Parse GEDCOM with v2 parser
			new Notice('Parsing GEDCOM file…');
			const gedcomData = GedcomParserV2.parse(content);

			new Notice(`Parsed ${gedcomData.individuals.size} individuals, counting events…`);

			// Count events for progress
			let totalEvents = 0;
			for (const individual of gedcomData.individuals.values()) {
				totalEvents += individual.events.length;
			}
			for (const family of gedcomData.families.values()) {
				totalEvents += family.events.length;
			}

			// Ensure folders exist
			await this.ensureFolderExists(options.peopleFolder);
			if (options.createEventNotes) {
				await this.ensureFolderExists(options.eventsFolder);
			}

			// Create mapping of GEDCOM IDs to cr_ids and note paths
			const gedcomToCrId = new Map<string, string>();
			const gedcomToNotePath = new Map<string, string>();

			// Phase 1: Create all person notes
			new Notice('Creating person notes…');
			for (const [gedcomId, individual] of gedcomData.individuals) {
				try {
					const { crId, notePath } = await this.importIndividual(
						individual,
						gedcomData,
						options,
						gedcomToCrId
					);

					gedcomToCrId.set(gedcomId, crId);
					gedcomToNotePath.set(gedcomId, notePath);
					result.individualsImported++;
				} catch (error: unknown) {
					result.errors.push(
						`Failed to import ${individual.name || 'Unknown'}: ${getErrorMessage(error)}`
					);
				}
			}

			// Phase 2: Update relationships with real cr_ids
			new Notice('Updating relationships…');
			for (const [, individual] of gedcomData.individuals) {
				try {
					await this.updateRelationships(
						individual,
						gedcomData,
						gedcomToCrId,
						options
					);
				} catch (error: unknown) {
					result.errors.push(
						`Failed to update relationships for ${individual.name || 'Unknown'}: ${getErrorMessage(error)}`
					);
				}
			}

			// Phase 3: Create event notes
			if (options.createEventNotes && totalEvents > 0) {
				new Notice(`Creating ${totalEvents} event notes…`);

				// Individual events
				for (const individual of gedcomData.individuals.values()) {
					for (const event of individual.events) {
						try {
							await this.createEventNote(
								event,
								individual,
								null,
								gedcomData,
								gedcomToNotePath,
								options
							);
							result.eventsCreated++;
						} catch (error: unknown) {
							result.errors.push(
								`Failed to create event ${event.eventType} for ${individual.name || 'Unknown'}: ${getErrorMessage(error)}`
							);
						}
					}
				}

				// Family events
				for (const family of gedcomData.families.values()) {
					for (const event of family.events) {
						try {
							await this.createEventNote(
								event,
								null,
								family,
								gedcomData,
								gedcomToNotePath,
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
					}
				}
			}

			// Build import complete message
			let importMessage = `Import complete: ${result.individualsImported} people`;
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
		gedcomToCrId: Map<string, string>
	): Promise<{ crId: string; notePath: string }> {
		const crId = generateCrId();

		// Convert GEDCOM individual to PersonData
		const personData: PersonData = {
			name: individual.name || 'Unknown',
			crId: crId,
			birthDate: GedcomParserV2.gedcomDateToISO(individual.birthDate || ''),
			deathDate: GedcomParserV2.gedcomDateToISO(individual.deathDate || ''),
			birthPlace: individual.birthPlace,
			deathPlace: individual.deathPlace,
			occupation: individual.occupation,
			gender: individual.sex === 'M' ? 'Male' : individual.sex === 'F' ? 'Female' : undefined
		};

		// Add extended attributes
		for (const [propName, value] of Object.entries(individual.attributes)) {
			(personData as unknown as Record<string, unknown>)[propName] = value;
		}

		// Add relationship references
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
			propertyAliases: options.propertyAliases
		});

		return { crId, notePath: file.path };
	}

	// ============================================================================
	// Private: Relationship Update
	// ============================================================================

	private async updateRelationships(
		individual: GedcomIndividualV2,
		gedcomData: GedcomDataV2,
		gedcomToCrId: Map<string, string>,
		options: GedcomImportOptionsV2
	): Promise<void> {
		const crId = gedcomToCrId.get(individual.id);
		if (!crId) return;

		const fileName = this.generateFileName(individual.name || 'Unknown');
		const filePath = options.peopleFolder
			? `${options.peopleFolder}/${fileName}`
			: fileName;

		const normalizedPath = normalizePath(filePath);
		const file = this.app.vault.getAbstractFileByPath(normalizedPath);

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
			}
		}

		// Apply replacements
		for (const { from, to } of replacements) {
			const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			// Replace in property values
			updatedContent = updatedContent.replace(
				new RegExp(`(father_id|mother_id|spouse_id|children_id):\\s*${escapedFrom}`, 'g'),
				`$1: ${to}`
			);
			// Replace in array format
			updatedContent = updatedContent.replace(
				new RegExp(`(\\s{2}- )${escapedFrom}$`, 'gm'),
				`$1${to}`
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

		// Build event data
		const eventData: CreateEventData = {
			title,
			eventType: event.eventType,
			datePrecision: event.datePrecision,
			date: event.date,
			dateEnd: event.dateEnd,
			person,
			persons: persons && persons.length > 0 ? persons : undefined,
			place: event.place,
			description: event.description || `Imported from GEDCOM`,
			confidence: 'unknown' as EventConfidence
		};

		// Create the event note file directly (not using EventService to avoid circular deps)
		const crId = generateCrId();
		const frontmatterLines = this.buildEventFrontmatter(crId, eventData);
		const body = `\n# ${title}\n\n${eventData.description || ''}\n`;
		const content = frontmatterLines.join('\n') + body;

		// Create file
		const fileName = this.slugify(title) + '.md';
		const filePath = normalizePath(`${options.eventsFolder}/${fileName}`);

		// Handle duplicate filenames
		let finalPath = filePath;
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(finalPath)) {
			finalPath = normalizePath(`${options.eventsFolder}/${this.slugify(title)}-${counter}.md`);
			counter++;
		}

		const file = await this.app.vault.create(finalPath, content);
		return file;
	}

	private buildEventFrontmatter(crId: string, data: CreateEventData): string[] {
		const lines: string[] = [
			'---',
			'type: event',
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
		if (data.place) {
			// For now, store as plain string; Phase 3 will convert to wikilinks
			lines.push(`place: "${data.place.replace(/"/g, '\\"')}"`);
		}
		if (data.confidence) {
			lines.push(`confidence: ${data.confidence}`);
		}
		if (data.description) {
			lines.push(`description: "${data.description.replace(/"/g, '\\"')}"`);
		}

		lines.push('---');
		return lines;
	}

	// ============================================================================
	// Private: Utilities
	// ============================================================================

	private formatEventType(eventType: string): string {
		// Convert snake_case to Title Case
		return eventType
			.split('_')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	private generateFileName(name: string): string {
		const sanitized = name
			.replace(/[\\/:*?"<>|]/g, '-')
			.replace(/\s+/g, ' ')
			.trim();
		return `${sanitized}.md`;
	}

	private slugify(title: string): string {
		return title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.substring(0, 100);
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
}
