/**
 * GEDCOM Importer for Canvas Roots
 *
 * Imports GEDCOM data into the Obsidian vault as person notes.
 */

import { App, Notice, TFile, normalizePath } from 'obsidian';
import { GedcomParser, GedcomData, GedcomIndividual } from './gedcom-parser';
import { createPersonNote, PersonData } from '../core/person-note-writer';
import { generateCrId } from '../core/uuid';

/**
 * GEDCOM import options
 */
export interface GedcomImportOptions {
	mode: 'canvas-only' | 'vault-sync';
	peopleFolder: string;
	overwriteExisting: boolean;
}

/**
 * GEDCOM import result
 */
export interface GedcomImportResult {
	success: boolean;
	individualsProcessed: number;
	notesCreated: number;
	notesUpdated: number;
	notesSkipped: number;
	errors: string[];
	gedcomData?: GedcomData;
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
	 * Import GEDCOM file
	 */
	async importFile(
		content: string,
		options: GedcomImportOptions
	): Promise<GedcomImportResult> {
		const result: GedcomImportResult = {
			success: false,
			individualsProcessed: 0,
			notesCreated: 0,
			notesUpdated: 0,
			notesSkipped: 0,
			errors: []
		};

		try {
			// Parse GEDCOM
			new Notice('Parsing GEDCOM file...');
			const gedcomData = GedcomParser.parse(content);
			result.gedcomData = gedcomData;

			new Notice(`Parsed ${gedcomData.individuals.size} individuals`);

			// For canvas-only mode, we just return the parsed data
			// TODO: Phase 3 - Implement canvas visualization from GEDCOM data
			//       Should create a canvas with nodes for each individual and
			//       edges for relationships (parent-child, spouse) without
			//       creating person notes in the vault.
			if (options.mode === 'canvas-only') {
				result.success = true;
				result.individualsProcessed = gedcomData.individuals.size;
				return result;
			}

			// For vault-sync mode, create person notes
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
					result.notesCreated++;
					result.individualsProcessed++;
				} catch (error) {
					result.errors.push(
						`Failed to import ${individual.name}: ${error.message}`
					);
				}
			}

			// Second pass: Update relationships now that all cr_ids are known
			for (const [gedcomId, individual] of gedcomData.individuals) {
				try {
					await this.updateRelationships(
						individual,
						gedcomData,
						gedcomToCrId,
						options
					);
				} catch (error) {
					result.errors.push(
						`Failed to update relationships for ${individual.name}: ${error.message}`
					);
				}
			}

			new Notice(
				`Import complete: ${result.notesCreated} notes created, ${result.errors.length} errors`
			);
			result.success = result.errors.length === 0;

		} catch (error) {
			result.errors.push(`GEDCOM parse error: ${error.message}`);
			new Notice(`Import failed: ${error.message}`);
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
			deathDate: GedcomParser.gedcomDateToISO(individual.deathDate || '')
		};

		// Add relationship references (we'll use temporary GEDCOM IDs for now)
		if (individual.fatherRef) {
			personData.fatherCrId = individual.fatherRef; // Temporary
		}
		if (individual.motherRef) {
			personData.motherCrId = individual.motherRef; // Temporary
		}
		if (individual.spouseRefs.length > 0) {
			personData.spouseCrId = individual.spouseRefs; // Temporary
		}

		// Write person note using the createPersonNote function
		// Disable bidirectional linking during import - we'll fix relationships in pass 2
		await createPersonNote(this.app, personData, {
			directory: options.peopleFolder,
			addBidirectionalLinks: false
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

		// Update frontmatter with real cr_ids
		let updatedContent = content;

		// Replace father reference
		if (individual.fatherRef) {
			const fatherCrId = gedcomToCrId.get(individual.fatherRef);
			if (fatherCrId) {
				updatedContent = updatedContent.replace(
					new RegExp(`father: ${individual.fatherRef}`, 'g'),
					`father: ${fatherCrId}`
				);
			}
		}

		// Replace mother reference
		if (individual.motherRef) {
			const motherCrId = gedcomToCrId.get(individual.motherRef);
			if (motherCrId) {
				updatedContent = updatedContent.replace(
					new RegExp(`mother: ${individual.motherRef}`, 'g'),
					`mother: ${motherCrId}`
				);
			}
		}

		// Replace spouse references
		if (individual.spouseRefs.length > 0) {
			const spouseCrIds = individual.spouseRefs
				.map(ref => gedcomToCrId.get(ref))
				.filter(id => id !== undefined);

			if (spouseCrIds.length > 0) {
				// Find the spouse line in frontmatter and replace it
				// Match spouse field and all its array items, stopping before the next field or closing ---
				const spousePattern = /spouse:.*?(?=\n[a-z_]+:|\n---|\n\n|$)/s;
				const spouseReplacement = spouseCrIds.length === 1
					? `spouse: ${spouseCrIds[0]}`
					: `spouse:\n${spouseCrIds.map(id => `  - ${id}`).join('\n')}`;

				updatedContent = updatedContent.replace(spousePattern, spouseReplacement);
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
