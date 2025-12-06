/**
 * Gramps XML Importer for Canvas Roots
 *
 * Imports Gramps XML data into the Obsidian vault as person notes.
 */

import { App, Notice, TFile, normalizePath } from 'obsidian';
import { GrampsParser, ParsedGrampsData, ParsedGrampsPerson } from './gramps-parser';
import { GrampsValidationResult } from './gramps-types';
import { createPersonNote, PersonData } from '../core/person-note-writer';
import { generateCrId } from '../core/uuid';
import { getErrorMessage } from '../core/error-utils';
import { getLogger } from '../core/logging';

const logger = getLogger('GrampsImporter');

/**
 * Gramps import options
 */
export interface GrampsImportOptions {
	peopleFolder: string;
	overwriteExisting: boolean;
	fileName?: string;
	/** Property aliases for writing custom property names (user property → canonical) */
	propertyAliases?: Record<string, string>;
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

		return {
			individualCount,
			familyCount,
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
			malformedDataCount: 0
		};

		try {
			// Validate Gramps XML first
			new Notice('Validating Gramps XML file…');
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

			// Parse Gramps XML
			new Notice('Parsing Gramps XML file…');
			const grampsData = GrampsParser.parse(content);

			new Notice(`Parsed ${grampsData.persons.size} individuals`);
			logger.info('importFile', `Starting import of ${grampsData.persons.size} persons`);

			// Create person notes
			new Notice('Creating person notes...');

			// Ensure people folder exists
			await this.ensureFolderExists(options.peopleFolder);

			// Create mapping of Gramps handles to cr_ids
			const grampsToCrId = new Map<string, string>();

			// First pass: Create all person notes
			for (const [handle, person] of grampsData.persons) {
				try {
					const crId = await this.importPerson(
						person,
						grampsData,
						options,
						grampsToCrId
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
			}

			// Second pass: Update relationships now that all cr_ids are known
			new Notice('Updating relationships...');
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
		grampsToCrId: Map<string, string>
	): Promise<string> {
		const crId = generateCrId();

		// Convert Gramps person to PersonData
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
			propertyAliases: options.propertyAliases
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
		if (person.spouseRefs.length > 0) {
			for (const spouseRef of person.spouseRefs) {
				const spouseCrId = grampsToCrId.get(spouseRef);
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
		for (const [childHandle] of grampsToCrId) {
			const childCrId = grampsToCrId.get(childHandle);
			if (childCrId && content.includes(childHandle)) {
				const escapedRef = this.escapeRegex(childHandle);
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
