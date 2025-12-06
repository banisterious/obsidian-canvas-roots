/**
 * GEDCOM Importer for Canvas Roots
 *
 * Imports GEDCOM data into the Obsidian vault as person notes.
 */

import { App, Notice, TFile, normalizePath } from 'obsidian';
import { GedcomParser, GedcomData, GedcomIndividual, GedcomValidationResult } from './gedcom-parser';
import { createPersonNote, PersonData } from '../core/person-note-writer';
import { generateCrId } from '../core/uuid';
import { getErrorMessage } from '../core/error-utils';

/**
 * GEDCOM import options
 */
export interface GedcomImportOptions {
	peopleFolder: string;
	overwriteExisting: boolean;
	fileName?: string;
	/** Property aliases for writing custom property names (user property → canonical) */
	propertyAliases?: Record<string, string>;
}

/**
 * GEDCOM import result
 */
export interface GedcomImportResult {
	success: boolean;
	individualsImported: number; // Renamed from individualsProcessed for clarity
	familiesCreated: number; // Renamed from notesCreated for clarity
	individualsProcessed: number; // Deprecated, use individualsImported
	notesCreated: number; // Deprecated, use familiesCreated
	notesUpdated: number;
	notesSkipped: number;
	errors: string[];
	validation?: GedcomValidationResult;
	gedcomData?: GedcomData;
	fileName?: string;
	malformedDataCount?: number; // Count of people with missing/invalid data
}

/**
 * Import GEDCOM files into Canvas Roots
 */
export class GedcomImporter {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Analyze GEDCOM file before import
	 * Returns basic statistics and component analysis
	 */
	analyzeFile(content: string): {
		individualCount: number;
		familyCount: number;
		componentCount: number;
	} {
		const gedcomData = GedcomParser.parse(content);

		// Count individuals and families
		const individualCount = gedcomData.individuals.size;
		const familyCount = gedcomData.families.size;

		// Analyze connected components using BFS
		const visited = new Set<string>();
		let componentCount = 0;

		for (const [gedcomId] of gedcomData.individuals) {
			if (visited.has(gedcomId)) continue;

			// Start BFS from this individual
			componentCount++;
			const queue: string[] = [gedcomId];

			while (queue.length > 0) {
				const currentId = queue.shift()!;
				if (visited.has(currentId)) continue;

				visited.add(currentId);
				const individual = gedcomData.individuals.get(currentId);
				if (!individual) continue;

				// Add connected people (parents, spouses, children)
				const related: string[] = [];

				// Add parents
				if (individual.fatherRef) related.push(individual.fatherRef);
				if (individual.motherRef) related.push(individual.motherRef);

				// Add spouses (from families where this person is a spouse)
				for (const [, family] of gedcomData.families) {
					if (family.husbandRef === currentId && family.wifeRef) {
						related.push(family.wifeRef);
					}
					if (family.wifeRef === currentId && family.husbandRef) {
						related.push(family.husbandRef);
					}
				}

				// Add children (from families where this person is a parent)
				for (const [, family] of gedcomData.families) {
					if (family.husbandRef === currentId || family.wifeRef === currentId) {
						related.push(...family.childRefs);
					}
				}

				// Queue unvisited relatives
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
			componentCount
		};
	}

	/**
	 * Import GEDCOM file
	 */
	async importFile(
		content: string,
		options: GedcomImportOptions
	): Promise<GedcomImportResult> {
		const result: GedcomImportResult = {
			success: false,
			individualsImported: 0,
			familiesCreated: 0,
			individualsProcessed: 0,
			notesCreated: 0,
			notesUpdated: 0,
			notesSkipped: 0,
			errors: [],
			fileName: options.fileName,
			malformedDataCount: 0
		};

		try {
			// Validate GEDCOM first
			new Notice('Validating GEDCOM file…');
			const validation = GedcomParser.validate(content);
			result.validation = validation;

			// Check for critical errors
			if (!validation.valid) {
				result.errors.push(...validation.errors.map(e => e.message));
				new Notice(`GEDCOM validation failed: ${validation.errors[0].message}`);
				return result;
			}

			// Show validation summary
			if (validation.warnings.length > 0) {
				new Notice(`Found ${validation.warnings.length} warning(s) - import will continue`);
			}

			// Parse GEDCOM
			new Notice('Parsing GEDCOM file…');
			const gedcomData = GedcomParser.parse(content);
			result.gedcomData = gedcomData;

			new Notice(`Parsed ${gedcomData.individuals.size} individuals`);

			// Create person notes
			new Notice('Creating person notes...');

			// Ensure people folder exists
			await this.ensureFolderExists(options.peopleFolder);

			// Create mapping of GEDCOM IDs to cr_ids
			const gedcomToCrId = new Map<string, string>();

			// First pass: Create all person notes
			for (const [gedcomId, individual] of gedcomData.individuals) {
				try {
					const crId = await this.importIndividual(
						individual,
						gedcomData,
						options,
						gedcomToCrId
					);

					gedcomToCrId.set(gedcomId, crId);
					result.individualsImported++;
					result.familiesCreated++; // Count each person note
					result.individualsProcessed++; // Keep for backward compat
					result.notesCreated++; // Keep for backward compat

					// Track malformed data (missing name or dates)
					if (!individual.name || individual.name.trim() === '' ||
						!individual.birthDate || !individual.deathDate) {
						if (result.malformedDataCount !== undefined) {
							result.malformedDataCount++;
						}
					}
				} catch (error: unknown) {
					result.errors.push(
						`Failed to import ${individual.name}: ${getErrorMessage(error)}`
					);
				}
			}

			// Second pass: Update relationships now that all cr_ids are known
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
						`Failed to update relationships for ${individual.name}: ${getErrorMessage(error)}`
					);
				}
			}

			// Enhanced import complete notice
			let importMessage = `Import complete: ${result.notesCreated} people imported`;

			if (result.malformedDataCount && result.malformedDataCount > 0) {
				importMessage += `. ${result.malformedDataCount} had missing/invalid data (defaults applied)`;
			}

			if (result.errors.length > 0) {
				importMessage += `. ${result.errors.length} errors occurred`;
			}

			new Notice(importMessage, 8000); // Show for 8 seconds
			result.success = result.errors.length === 0;

		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			result.errors.push(`GEDCOM parse error: ${errorMsg}`);
			new Notice(`Import failed: ${errorMsg}`);
		}

		return result;
	}

	/**
	 * Import a single individual
	 */
	private async importIndividual(
		individual: GedcomIndividual,
		gedcomData: GedcomData,
		options: GedcomImportOptions,
		gedcomToCrId: Map<string, string>
	): Promise<string> {
		const crId = generateCrId();

		// Convert GEDCOM individual to PersonData
		const personData: PersonData = {
			name: individual.name || 'Unknown',
			crId: crId,
			birthDate: GedcomParser.gedcomDateToISO(individual.birthDate || ''),
			deathDate: GedcomParser.gedcomDateToISO(individual.deathDate || ''),
			birthPlace: individual.birthPlace,
			deathPlace: individual.deathPlace,
			occupation: individual.occupation,
			gender: individual.sex === 'M' ? 'Male' : individual.sex === 'F' ? 'Female' : undefined
		};

		// Add relationship references with both GEDCOM IDs (temporary) and names
		if (individual.fatherRef) {
			personData.fatherCrId = individual.fatherRef; // Temporary GEDCOM ID
			const father = gedcomData.individuals.get(individual.fatherRef);
			if (father) {
				personData.fatherName = father.name || 'Unknown';
			}
		}
		if (individual.motherRef) {
			personData.motherCrId = individual.motherRef; // Temporary GEDCOM ID
			const mother = gedcomData.individuals.get(individual.motherRef);
			if (mother) {
				personData.motherName = mother.name || 'Unknown';
			}
		}
		if (individual.spouseRefs.length > 0) {
			personData.spouseCrId = individual.spouseRefs; // Temporary GEDCOM IDs
			personData.spouseName = individual.spouseRefs.map(ref => {
				const spouse = gedcomData.individuals.get(ref);
				return spouse?.name || 'Unknown';
			});
		}

		// Extract children from families where this person is a parent
		const childRefs: string[] = [];
		const childNames: string[] = [];
		for (const [, family] of gedcomData.families) {
			// Check if this individual is a parent in this family
			if (family.husbandRef === individual.id || family.wifeRef === individual.id) {
				// Add all children from this family
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
			personData.childCrId = childRefs; // Temporary GEDCOM IDs
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
		individual: GedcomIndividual,
		gedcomData: GedcomData,
		gedcomToCrId: Map<string, string>,
		options: GedcomImportOptions
	): Promise<void> {
		const crId = gedcomToCrId.get(individual.id);
		if (!crId) return;

		// Generate the expected file name
		const fileName = this.generateFileName(individual.name || 'Unknown');
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

		// Update frontmatter with real cr_ids (replacing temporary GEDCOM IDs)
		let updatedContent = content;

		// Replace father_id reference with real cr_id
		if (individual.fatherRef) {
			const fatherCrId = gedcomToCrId.get(individual.fatherRef);
			if (fatherCrId) {
				// Escape special regex characters in GEDCOM ID
				const escapedRef = individual.fatherRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				updatedContent = updatedContent.replace(
					new RegExp(`father_id: ${escapedRef}`, 'g'),
					`father_id: ${fatherCrId}`
				);
			}
		}

		// Replace mother_id reference with real cr_id
		if (individual.motherRef) {
			const motherCrId = gedcomToCrId.get(individual.motherRef);
			if (motherCrId) {
				// Escape special regex characters in GEDCOM ID
				const escapedRef = individual.motherRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				updatedContent = updatedContent.replace(
					new RegExp(`mother_id: ${escapedRef}`, 'g'),
					`mother_id: ${motherCrId}`
				);
			}
		}

		// Replace spouse_id references with real cr_ids
		if (individual.spouseRefs.length > 0) {
			// Replace each GEDCOM ID with its corresponding cr_id in the spouse_id field
			for (const spouseRef of individual.spouseRefs) {
				const spouseCrId = gedcomToCrId.get(spouseRef);
				if (spouseCrId) {
					// Escape special regex characters in GEDCOM ID
					const escapedRef = spouseRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

		// Write updated content if changed
		if (updatedContent !== content) {
			await this.app.vault.modify(file, updatedContent);
		}
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
