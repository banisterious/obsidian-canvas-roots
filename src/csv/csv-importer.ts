/**
 * CSV Importer for Canvas Roots
 *
 * Imports CSV data into the Obsidian vault as person notes.
 * Supports flexible column mapping and two-pass relationship resolution.
 */

import { App, Notice, TFile, normalizePath } from 'obsidian';
import { CsvParser, CsvParseOptions, CsvRow, CsvValidationResult } from './csv-parser';
import { createPersonNote, PersonData } from '../core/person-note-writer';
import { generateCrId } from '../core/uuid';
import { getLogger } from '../core/logging';
import { getErrorMessage } from '../core/error-utils';

const logger = getLogger('CsvImporter');

/**
 * Column mapping for CSV import
 * Maps CSV column names to PersonData fields
 */
export interface CsvColumnMapping {
	/** Column for cr_id (optional - will be generated if not provided) */
	crId?: string;

	/** Column for person name (required) */
	name: string;

	/** Column for birth date */
	birthDate?: string;

	/** Column for death date */
	deathDate?: string;

	/** Column for birth place */
	birthPlace?: string;

	/** Column for death place */
	deathPlace?: string;

	/** Column for gender */
	gender?: string;

	/** Column for occupation */
	occupation?: string;

	/** Column for father ID (cr_id reference) */
	fatherId?: string;

	/** Column for father name (for wikilink) */
	fatherName?: string;

	/** Column for mother ID (cr_id reference) */
	motherId?: string;

	/** Column for mother name (for wikilink) */
	motherName?: string;

	/** Column for spouse IDs (semicolon-separated cr_ids) */
	spouseIds?: string;

	/** Column for spouse names (semicolon-separated names) */
	spouseNames?: string;

	/** Column for collection */
	collection?: string;
}

/**
 * Default column mapping with common variations
 */
export const DEFAULT_COLUMN_ALIASES: Record<keyof CsvColumnMapping, string[]> = {
	crId: ['cr_id', 'id', 'uuid', 'person_id'],
	name: ['name', 'full_name', 'fullname', 'person_name'],
	birthDate: ['birth_date', 'born', 'birthdate', 'dob', 'date_of_birth'],
	deathDate: ['death_date', 'died', 'deathdate', 'dod', 'date_of_death'],
	birthPlace: ['birth_place', 'birthplace', 'place_of_birth', 'born_place'],
	deathPlace: ['death_place', 'deathplace', 'place_of_death', 'died_place'],
	gender: ['gender', 'sex'],
	occupation: ['occupation', 'job', 'profession'],
	fatherId: ['father_id', 'father_cr_id'],
	fatherName: ['father_name', 'father'],
	motherId: ['mother_id', 'mother_cr_id'],
	motherName: ['mother_name', 'mother'],
	spouseIds: ['spouse_ids', 'spouse_id', 'spouse_cr_ids'],
	spouseNames: ['spouse_names', 'spouse', 'spouses'],
	collection: ['collection', 'family', 'group']
};

/**
 * CSV import options
 */
export interface CsvImportOptions {
	/** People folder to import into */
	peopleFolder: string;

	/** Column mapping (auto-detected if not provided) */
	columnMapping?: CsvColumnMapping;

	/** Overwrite existing person notes */
	overwriteExisting?: boolean;

	/** Source filename for tracking */
	fileName?: string;

	/** CSV parse options */
	parseOptions?: CsvParseOptions;
}

/**
 * CSV import result
 */
export interface CsvImportResult {
	success: boolean;
	recordsImported: number;
	notesCreated: number;
	notesUpdated: number;
	notesSkipped: number;
	errors: string[];
	validation?: CsvValidationResult;
	fileName?: string;
	/** Count of people with missing/invalid data */
	malformedDataCount?: number;
}

/**
 * Import CSV files into Canvas Roots
 */
export class CsvImporter {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Analyze CSV file before import
	 * Returns basic statistics and detected columns
	 */
	analyzeFile(content: string, parseOptions?: CsvParseOptions): {
		rowCount: number;
		headers: string[];
		detectedMapping: Partial<CsvColumnMapping>;
		sampleData: CsvRow[];
	} {
		const parseResult = CsvParser.parse(content, parseOptions);

		// Auto-detect column mapping
		const detectedMapping = this.autoDetectMapping(parseResult.headers);

		// Get sample data (first 5 rows)
		const sampleData = parseResult.rows.slice(0, 5);

		return {
			rowCount: parseResult.rowCount,
			headers: parseResult.headers,
			detectedMapping,
			sampleData
		};
	}

	/**
	 * Auto-detect column mapping from headers
	 */
	autoDetectMapping(headers: string[]): Partial<CsvColumnMapping> {
		const mapping: Partial<CsvColumnMapping> = {};

		for (const [field, aliases] of Object.entries(DEFAULT_COLUMN_ALIASES)) {
			const column = CsvParser.findColumn(headers, aliases);
			if (column) {
				mapping[field as keyof CsvColumnMapping] = column;
			}
		}

		return mapping;
	}

	/**
	 * Import CSV file
	 */
	async importFile(
		content: string,
		options: CsvImportOptions
	): Promise<CsvImportResult> {
		const result: CsvImportResult = {
			success: false,
			recordsImported: 0,
			notesCreated: 0,
			notesUpdated: 0,
			notesSkipped: 0,
			errors: [],
			fileName: options.fileName,
			malformedDataCount: 0
		};

		try {
			// Validate CSV first
			new Notice('Validating CSV file...');
			const validation = CsvParser.validate(content, options.parseOptions);
			result.validation = validation;

			// Check for critical errors
			if (!validation.valid) {
				result.errors.push(...validation.errors.map(e => e.message));
				new Notice(`CSV validation failed: ${validation.errors[0]?.message || 'Unknown error'}`);
				return result;
			}

			// Show validation summary
			if (validation.warnings.length > 0) {
				new Notice(`Found ${validation.warnings.length} warning(s) - import will continue`);
			}

			// Parse CSV
			new Notice('Parsing CSV file...');
			const parseResult = CsvParser.parse(content, options.parseOptions);

			new Notice(`Parsed ${parseResult.rowCount} rows`);

			// Determine column mapping
			const mapping = options.columnMapping || this.autoDetectMapping(parseResult.headers);

			// Validate mapping has at least name column
			if (!mapping.name) {
				result.errors.push('No name column found or specified');
				return result;
			}

			// Create person notes
			new Notice('Creating person notes...');

			// Ensure people folder exists
			await this.ensureFolderExists(options.peopleFolder);

			// Create mapping of row index to cr_id (for relationship resolution)
			const rowToCrId = new Map<number, string>();

			// Also create mapping of existing IDs from CSV to cr_ids
			const csvIdToCrId = new Map<string, string>();

			// First pass: Create all person notes
			for (let i = 0; i < parseResult.rows.length; i++) {
				const row = parseResult.rows[i];

				try {
					const { crId, created, updated } = await this.importRow(
						row,
						mapping,
						options
					);

					rowToCrId.set(i, crId);

					// Track CSV ID mapping if present
					const csvId = this.getColumnValue(row, mapping.crId);
					if (csvId) {
						csvIdToCrId.set(csvId, crId);
					}

					// Also map by name for relationship resolution
					const name = this.getColumnValue(row, mapping.name);
					if (name) {
						csvIdToCrId.set(name, crId);
					}

					result.recordsImported++;

					if (created) {
						result.notesCreated++;
					} else if (updated) {
						result.notesUpdated++;
					} else {
						result.notesSkipped++;
					}

					// Track malformed data
					const birthDate = this.getColumnValue(row, mapping.birthDate);
					const deathDate = this.getColumnValue(row, mapping.deathDate);
					if (!name || !birthDate || !deathDate) {
						if (result.malformedDataCount !== undefined) {
							result.malformedDataCount++;
						}
					}

				} catch (error: unknown) {
					const name = this.getColumnValue(row, mapping.name) || `Row ${i + 1}`;
					result.errors.push(`Failed to import ${name}: ${getErrorMessage(error)}`);
				}
			}

			// Second pass: Update relationships with resolved cr_ids
			for (let i = 0; i < parseResult.rows.length; i++) {
				const row = parseResult.rows[i];
				const crId = rowToCrId.get(i);

				if (!crId) continue;

				try {
					await this.updateRelationships(
						row,
						crId,
						mapping,
						csvIdToCrId,
						options
					);
				} catch (error: unknown) {
					const name = this.getColumnValue(row, mapping.name) || `Row ${i + 1}`;
					result.errors.push(`Failed to update relationships for ${name}: ${getErrorMessage(error)}`);
				}
			}

			// Enhanced import complete notice
			let importMessage = `Import complete: ${result.notesCreated} created, ${result.notesUpdated} updated`;

			if (result.malformedDataCount && result.malformedDataCount > 0) {
				importMessage += `. ${result.malformedDataCount} had missing data`;
			}

			if (result.errors.length > 0) {
				importMessage += `. ${result.errors.length} errors`;
			}

			new Notice(importMessage, 8000);
			result.success = result.errors.length === 0;

		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			result.errors.push(`CSV import error: ${errorMsg}`);
			new Notice(`Import failed: ${errorMsg}`);
		}

		return result;
	}

	/**
	 * Import a single row
	 */
	private async importRow(
		row: CsvRow,
		mapping: Partial<CsvColumnMapping>,
		options: CsvImportOptions
	): Promise<{ crId: string; created: boolean; updated: boolean }> {
		// Get or generate cr_id
		let crId = this.getColumnValue(row, mapping.crId);
		const isNewId = !crId;
		if (!crId) {
			crId = generateCrId();
		}

		// Get name
		const name = this.getColumnValue(row, mapping.name);
		if (!name) {
			throw new Error('Name is required');
		}

		// Check if file already exists
		const fileName = this.generateFileName(name);
		const filePath = options.peopleFolder
			? `${options.peopleFolder}/${fileName}`
			: fileName;

		const normalizedPath = normalizePath(filePath);
		const existingFile = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (existingFile && !options.overwriteExisting) {
			return { crId, created: false, updated: false };
		}

		// Build PersonData
		const personData: PersonData = {
			name,
			crId,
			birthDate: this.getColumnValue(row, mapping.birthDate),
			deathDate: this.getColumnValue(row, mapping.deathDate),
			birthPlace: this.getColumnValue(row, mapping.birthPlace),
			deathPlace: this.getColumnValue(row, mapping.deathPlace),
			occupation: this.getColumnValue(row, mapping.occupation),
			gender: this.normalizeGender(this.getColumnValue(row, mapping.gender))
		};

		// Add relationship hints (will be resolved in pass 2)
		const fatherName = this.getColumnValue(row, mapping.fatherName);
		const fatherId = this.getColumnValue(row, mapping.fatherId);
		if (fatherName || fatherId) {
			personData.fatherName = fatherName;
			personData.fatherCrId = fatherId; // Temporary, may be CSV ID
		}

		const motherName = this.getColumnValue(row, mapping.motherName);
		const motherId = this.getColumnValue(row, mapping.motherId);
		if (motherName || motherId) {
			personData.motherName = motherName;
			personData.motherCrId = motherId; // Temporary, may be CSV ID
		}

		const spouseNames = this.getColumnValue(row, mapping.spouseNames);
		const spouseIds = this.getColumnValue(row, mapping.spouseIds);
		if (spouseNames || spouseIds) {
			personData.spouseName = spouseNames?.split(';').map(s => s.trim()).filter(s => s);
			personData.spouseCrId = spouseIds?.split(';').map(s => s.trim()).filter(s => s);
		}

		// Create or update person note
		// Disable bidirectional linking during import - we'll fix relationships in pass 2
		await createPersonNote(this.app, personData, {
			directory: options.peopleFolder,
			addBidirectionalLinks: false
		});

		return {
			crId,
			created: !existingFile || isNewId,
			updated: !!existingFile && options.overwriteExisting === true
		};
	}

	/**
	 * Update relationships with resolved cr_ids
	 */
	private async updateRelationships(
		row: CsvRow,
		crId: string,
		mapping: Partial<CsvColumnMapping>,
		idLookup: Map<string, string>,
		options: CsvImportOptions
	): Promise<void> {
		// Get the file
		const name = this.getColumnValue(row, mapping.name);
		if (!name) return;

		const fileName = this.generateFileName(name);
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
		let updatedContent = content;

		// Resolve father relationship
		const fatherId = this.getColumnValue(row, mapping.fatherId);
		const fatherName = this.getColumnValue(row, mapping.fatherName);

		if (fatherId || fatherName) {
			const resolvedId = this.resolveId(fatherId, fatherName, idLookup);
			if (resolvedId && fatherId && resolvedId !== fatherId) {
				// Replace CSV ID with real cr_id
				const escapedId = this.escapeRegex(fatherId);
				updatedContent = updatedContent.replace(
					new RegExp(`father_id: ${escapedId}`, 'g'),
					`father_id: ${resolvedId}`
				);
			}
		}

		// Resolve mother relationship
		const motherId = this.getColumnValue(row, mapping.motherId);
		const motherName = this.getColumnValue(row, mapping.motherName);

		if (motherId || motherName) {
			const resolvedId = this.resolveId(motherId, motherName, idLookup);
			if (resolvedId && motherId && resolvedId !== motherId) {
				const escapedId = this.escapeRegex(motherId);
				updatedContent = updatedContent.replace(
					new RegExp(`mother_id: ${escapedId}`, 'g'),
					`mother_id: ${resolvedId}`
				);
			}
		}

		// Resolve spouse relationships
		const spouseIds = this.getColumnValue(row, mapping.spouseIds);
		const spouseNames = this.getColumnValue(row, mapping.spouseNames);

		if (spouseIds) {
			const ids = spouseIds.split(';').map(s => s.trim()).filter(s => s);
			const names = spouseNames?.split(';').map(s => s.trim()).filter(s => s) || [];

			for (let i = 0; i < ids.length; i++) {
				const resolvedId = this.resolveId(ids[i], names[i], idLookup);
				if (resolvedId && resolvedId !== ids[i]) {
					const escapedId = this.escapeRegex(ids[i]);
					updatedContent = updatedContent.replace(
						new RegExp(`spouse_id: ${escapedId}`, 'g'),
						`spouse_id: ${resolvedId}`
					);
					updatedContent = updatedContent.replace(
						new RegExp(` {2}- ${escapedId}`, 'g'),
						`  - ${resolvedId}`
					);
				}
			}
		}

		// Write updated content if changed
		if (updatedContent !== content) {
			await this.app.vault.modify(file, updatedContent);
			logger.debug('relationships', `Updated relationships for ${name}`);
		}
	}

	/**
	 * Resolve an ID or name to a cr_id using the lookup map
	 */
	private resolveId(
		id: string | undefined,
		name: string | undefined,
		lookup: Map<string, string>
	): string | undefined {
		// Try ID first
		if (id && lookup.has(id)) {
			return lookup.get(id);
		}

		// Try name
		if (name && lookup.has(name)) {
			return lookup.get(name);
		}

		// Return original ID if no resolution found
		return id;
	}

	/**
	 * Get column value with mapping support
	 */
	private getColumnValue(row: CsvRow, columnName?: string): string | undefined {
		if (!columnName) return undefined;

		const value = row[columnName];
		return value && value.trim() !== '' ? value.trim() : undefined;
	}

	/**
	 * Normalize gender value to standard format
	 */
	private normalizeGender(value?: string): string | undefined {
		if (!value) return undefined;

		const lower = value.toLowerCase().trim();

		if (lower === 'm' || lower === 'male') {
			return 'Male';
		}

		if (lower === 'f' || lower === 'female') {
			return 'Female';
		}

		// Return as-is if not recognized
		return value;
	}

	/**
	 * Generate file name from person name
	 */
	private generateFileName(name: string): string {
		const sanitized = name
			.replace(/[\\/:*?"<>|]/g, '-')
			.replace(/\s+/g, ' ')
			.trim();

		return `${sanitized}.md`;
	}

	/**
	 * Escape regex special characters
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
}
