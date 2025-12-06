/**
 * GEDCOM X Importer for Canvas Roots
 *
 * Imports GEDCOM X JSON data into the Obsidian vault as person notes.
 * Based on the FamilySearch GEDCOM X specification.
 */

import { App, Notice, TFile, normalizePath } from 'obsidian';
import { GedcomXParser, ParsedGedcomXData, ParsedGedcomXPerson } from './gedcomx-parser';
import { GedcomXValidationResult } from './gedcomx-types';
import { createPersonNote, PersonData } from '../core/person-note-writer';
import { generateCrId } from '../core/uuid';
import { getErrorMessage } from '../core/error-utils';
import { getLogger } from '../core/logging';

const logger = getLogger('GedcomXImporter');

/**
 * GEDCOM X import options
 */
export interface GedcomXImportOptions {
	peopleFolder: string;
	overwriteExisting: boolean;
	fileName?: string;
	/** Property aliases for writing custom property names (user property → canonical) */
	propertyAliases?: Record<string, string>;
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

			// Create person notes
			new Notice('Creating person notes...');

			// Ensure people folder exists
			await this.ensureFolderExists(options.peopleFolder);

			// Create mapping of GEDCOM X IDs to cr_ids
			const gedcomXToCrId = new Map<string, string>();

			// First pass: Create all person notes
			for (const [personId, person] of gedcomXData.persons) {
				try {
					const crId = await this.importPerson(
						person,
						gedcomXData,
						options,
						gedcomXToCrId
					);

					gedcomXToCrId.set(personId, crId);
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
						gedcomXData,
						gedcomXToCrId,
						options
					);
				} catch (error: unknown) {
					result.errors.push(
						`Failed to update relationships for ${person.name}: ${getErrorMessage(error)}`
					);
				}
			}

			// Enhanced import complete notice
			let importMessage = `Import complete: ${result.notesCreated} people imported`;

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
			result.errors.push(`GEDCOM X parse error: ${errorMsg}`);
			new Notice(`Import failed: ${errorMsg}`);
			logger.error('importFile', 'Import failed', error);
		}

		return result;
	}

	/**
	 * Import a single person
	 */
	private async importPerson(
		person: ParsedGedcomXPerson,
		gedcomXData: ParsedGedcomXData,
		options: GedcomXImportOptions,
		gedcomXToCrId: Map<string, string>
	): Promise<string> {
		const crId = generateCrId();

		// Convert GEDCOM X person to PersonData
		const personData: PersonData = {
			name: person.name || 'Unknown',
			crId: crId,
			birthDate: person.birthDate,
			deathDate: person.deathDate,
			birthPlace: person.birthPlace,
			deathPlace: person.deathPlace,
			occupation: person.occupation,
			gender: person.gender === 'M' ? 'Male' : person.gender === 'F' ? 'Female' : undefined
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
		await createPersonNote(this.app, personData, {
			directory: options.peopleFolder,
			addBidirectionalLinks: false,
			propertyAliases: options.propertyAliases
		});

		return crId;
	}

	/**
	 * Update relationships with actual cr_ids
	 */
	private async updateRelationships(
		person: ParsedGedcomXPerson,
		_gedcomXData: ParsedGedcomXData,
		gedcomXToCrId: Map<string, string>,
		options: GedcomXImportOptions
	): Promise<void> {
		const crId = gedcomXToCrId.get(person.id);
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

		// Replace child_id references with real cr_ids
		for (const [childId] of gedcomXToCrId) {
			const childCrId = gedcomXToCrId.get(childId);
			if (childCrId && content.includes(childId)) {
				const escapedRef = this.escapeRegex(childId);
				// Replace in child_id field
				updatedContent = updatedContent.replace(
					new RegExp(`child_id: ${escapedRef}`, 'g'),
					`child_id: ${childCrId}`
				);
				// Also replace in array format
				updatedContent = updatedContent.replace(
					new RegExp(` {2}- ${escapedRef}`, 'g'),
					`  - ${childCrId}`
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
}
