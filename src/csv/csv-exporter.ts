/**
 * CSV Exporter for Canvas Roots
 *
 * Exports person notes from Obsidian vault to CSV format.
 */

import { App, Notice } from 'obsidian';
import { FamilyGraphService, type PersonNode } from '../core/family-graph';
import { getLogger } from '../core/logging';
import { getErrorMessage } from '../core/error-utils';
import { PrivacyService, type PrivacySettings } from '../core/privacy-service';

const logger = getLogger('CsvExporter');

/**
 * Available CSV columns for export
 */
export type CsvColumn =
	| 'cr_id'
	| 'name'
	| 'birth_date'
	| 'death_date'
	| 'birth_place'
	| 'death_place'
	| 'gender'
	| 'occupation'
	| 'father_id'
	| 'father_name'
	| 'mother_id'
	| 'mother_name'
	| 'spouse_ids'
	| 'spouse_names'
	| 'collection'
	| 'file_path';

/**
 * Default columns for CSV export
 */
export const DEFAULT_CSV_COLUMNS: CsvColumn[] = [
	'cr_id',
	'name',
	'birth_date',
	'death_date',
	'birth_place',
	'death_place',
	'gender',
	'occupation',
	'father_id',
	'father_name',
	'mother_id',
	'mother_name',
	'spouse_ids',
	'spouse_names',
	'collection'
];

/**
 * Human-readable column headers
 */
export const CSV_COLUMN_HEADERS: Record<CsvColumn, string> = {
	cr_id: 'ID',
	name: 'Name',
	birth_date: 'Birth Date',
	death_date: 'Death Date',
	birth_place: 'Birth Place',
	death_place: 'Death Place',
	gender: 'Gender',
	occupation: 'Occupation',
	father_id: 'Father ID',
	father_name: 'Father Name',
	mother_id: 'Mother ID',
	mother_name: 'Mother Name',
	spouse_ids: 'Spouse IDs',
	spouse_names: 'Spouse Names',
	collection: 'Collection',
	file_path: 'File Path'
};

/**
 * CSV export options
 */
export interface CsvExportOptions {
	/** People folder to export from */
	peopleFolder: string;

	/** Collection filter - only export people in this collection */
	collectionFilter?: string;

	/** Branch filter - cr_id of person to filter around */
	branchRootCrId?: string;

	/** Branch direction - export ancestors or descendants of branchRootCrId */
	branchDirection?: 'ancestors' | 'descendants';

	/** Include spouses when exporting a branch (applies to descendants) */
	branchIncludeSpouses?: boolean;

	/** Export filename (without .csv extension) */
	fileName?: string;

	/** Columns to include in export */
	columns?: CsvColumn[];

	/** Include header row */
	includeHeader?: boolean;

	/** Field delimiter (default: comma) */
	delimiter?: string;

	/** Privacy settings for protecting living persons */
	privacySettings?: PrivacySettings;
}

/**
 * CSV export result
 */
export interface CsvExportResult {
	success: boolean;
	recordsExported: number;
	errors: string[];
	csvContent?: string;
	fileName: string;
	/** Number of living persons excluded due to privacy settings */
	privacyExcluded?: number;
	/** Number of living persons with obfuscated data */
	privacyObfuscated?: number;
}

/**
 * Export person notes to CSV format
 */
export class CsvExporter {
	private app: App;
	private graphService: FamilyGraphService;

	constructor(app: App) {
		this.app = app;
		this.graphService = new FamilyGraphService(app);
	}

	/**
	 * Export people to CSV format
	 */
	exportToCsv(options: CsvExportOptions): CsvExportResult {
		const result: CsvExportResult = {
			success: false,
			recordsExported: 0,
			errors: [],
			fileName: options.fileName || 'export',
			privacyExcluded: 0,
			privacyObfuscated: 0
		};

		// Create privacy service if settings provided
		const privacyService = options.privacySettings
			? new PrivacyService(options.privacySettings)
			: null;

		try {
			new Notice('Reading person notes...');

			// Load all people using the family graph service
			this.graphService['loadPersonCache']();
			const allPeople = Array.from(this.graphService['personCache'].values());

			if (allPeople.length === 0) {
				throw new Error(`No person notes found in folder: ${options.peopleFolder}`);
			}

			logger.info('export', `Loaded ${allPeople.length} people`);

			// Apply collection filter if specified
			let filteredPeople = allPeople;
			if (options.collectionFilter) {
				filteredPeople = allPeople.filter(person => {
					return person.collection === options.collectionFilter;
				});

				logger.info('export', `Filtered to ${filteredPeople.length} people in collection: ${options.collectionFilter}`);

				if (filteredPeople.length === 0) {
					throw new Error(`No people found in collection "${options.collectionFilter}". Found ${allPeople.length} total people, but none match this collection.`);
				}
			}

			// Apply branch filter if specified
			if (options.branchRootCrId && options.branchDirection) {
				const branchPeople = options.branchDirection === 'ancestors'
					? this.graphService.getAncestors(options.branchRootCrId, true)
					: this.graphService.getDescendants(options.branchRootCrId, true, options.branchIncludeSpouses);

				const branchCrIds = new Set(branchPeople.map(p => p.crId));
				filteredPeople = filteredPeople.filter(p => branchCrIds.has(p.crId));

				logger.info('export', `Filtered to ${filteredPeople.length} people in ${options.branchDirection} branch of ${options.branchRootCrId}`);

				if (filteredPeople.length === 0) {
					throw new Error(`No people found in ${options.branchDirection} branch. The branch root may not exist or has no ${options.branchDirection}.`);
				}
			}

			// Apply privacy filtering if enabled
			if (privacyService && options.privacySettings?.enablePrivacyProtection) {
				const beforeCount = filteredPeople.length;

				// Count obfuscated (living but not excluded)
				for (const person of filteredPeople) {
					const privacyResult = privacyService.applyPrivacy({
						name: person.name,
						birthDate: person.birthDate,
						deathDate: person.deathDate
					});
					if (privacyResult.isProtected && !privacyResult.excludeFromOutput) {
						result.privacyObfuscated = (result.privacyObfuscated || 0) + 1;
					}
				}

				// Filter out excluded people (privacy format = 'hidden')
				if (options.privacySettings.privacyDisplayFormat === 'hidden') {
					filteredPeople = filteredPeople.filter(person => {
						const privacyResult = privacyService.applyPrivacy({
							name: person.name,
							birthDate: person.birthDate,
							deathDate: person.deathDate
						});
						return !privacyResult.excludeFromOutput;
					});
					result.privacyExcluded = beforeCount - filteredPeople.length;
					logger.info('export', `Privacy: excluded ${result.privacyExcluded} living persons`);
				}

				if (result.privacyObfuscated && result.privacyObfuscated > 0) {
					logger.info('export', `Privacy: obfuscating ${result.privacyObfuscated} living persons`);
				}
			}

			// Build person lookup map for resolving relationship names
			const personLookup = new Map<string, PersonNode>();
			for (const person of allPeople) {
				personLookup.set(person.crId, person);
			}

			// Build CSV content
			new Notice('Generating CSV data...');
			const csvContent = this.buildCsvContent(
				filteredPeople,
				personLookup,
				options,
				privacyService
			);

			result.csvContent = csvContent;
			result.recordsExported = filteredPeople.length;
			result.success = true;

			new Notice(`Export complete: ${result.recordsExported} people exported`);

		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			result.errors.push(`Export failed: ${errorMsg}`);
			logger.error('export', 'Export failed', error);
			new Notice(`Export failed: ${errorMsg}`);
		}

		return result;
	}

	/**
	 * Build complete CSV content
	 */
	private buildCsvContent(
		people: PersonNode[],
		personLookup: Map<string, PersonNode>,
		options: CsvExportOptions,
		privacyService: PrivacyService | null
	): string {
		const columns = options.columns || DEFAULT_CSV_COLUMNS;
		const delimiter = options.delimiter || ',';
		const includeHeader = options.includeHeader !== false;

		const lines: string[] = [];

		// Add header row
		if (includeHeader) {
			const headers = columns.map(col => this.escapeField(CSV_COLUMN_HEADERS[col], delimiter));
			lines.push(headers.join(delimiter));
		}

		// Add data rows
		for (const person of people) {
			const row = this.buildRow(person, personLookup, columns, delimiter, privacyService);
			lines.push(row);
		}

		return lines.join('\n');
	}

	/**
	 * Build a single CSV row for a person
	 */
	private buildRow(
		person: PersonNode,
		personLookup: Map<string, PersonNode>,
		columns: CsvColumn[],
		delimiter: string,
		privacyService: PrivacyService | null
	): string {
		// Check privacy status
		const privacyResult = privacyService?.applyPrivacy({
			name: person.name,
			birthDate: person.birthDate,
			deathDate: person.deathDate
		});

		const fields: string[] = [];

		for (const column of columns) {
			let value = '';

			switch (column) {
				case 'cr_id':
					value = person.crId;
					break;

				case 'name':
					value = privacyResult?.isProtected
						? privacyResult.displayName
						: (person.name || '');
					break;

				case 'birth_date':
					if (privacyResult?.isProtected && !privacyResult.showBirthDate) {
						value = '';
					} else {
						value = person.birthDate || '';
					}
					break;

				case 'death_date':
					value = person.deathDate || '';
					break;

				case 'birth_place':
					if (privacyResult?.isProtected && !privacyResult.showBirthPlace) {
						value = '';
					} else {
						value = person.birthPlace || '';
					}
					break;

				case 'death_place':
					value = person.deathPlace || '';
					break;

				case 'gender':
					value = person.sex || '';
					break;

				case 'occupation':
					if (privacyResult?.isProtected) {
						value = '';
					} else {
						value = person.occupation || '';
					}
					break;

				case 'father_id':
					value = person.fatherCrId || '';
					break;

				case 'father_name':
					if (person.fatherCrId) {
						const father = personLookup.get(person.fatherCrId);
						value = father?.name || '';
					}
					break;

				case 'mother_id':
					value = person.motherCrId || '';
					break;

				case 'mother_name':
					if (person.motherCrId) {
						const mother = personLookup.get(person.motherCrId);
						value = mother?.name || '';
					}
					break;

				case 'spouse_ids':
					value = person.spouseCrIds.join('; ');
					break;

				case 'spouse_names':
					value = person.spouseCrIds
						.map(id => personLookup.get(id)?.name || '')
						.filter(name => name)
						.join('; ');
					break;

				case 'collection':
					value = person.collection || '';
					break;

				case 'file_path':
					value = person.file.path;
					break;
			}

			fields.push(this.escapeField(value, delimiter));
		}

		return fields.join(delimiter);
	}

	/**
	 * Escape a field value for CSV
	 * Handles quotes, delimiters, and newlines
	 */
	private escapeField(value: string, delimiter: string): string {
		if (!value) return '';

		// Check if field needs quoting
		const needsQuoting = value.includes(delimiter) ||
			value.includes('"') ||
			value.includes('\n') ||
			value.includes('\r');

		if (needsQuoting) {
			// Escape existing quotes by doubling them
			const escaped = value.replace(/"/g, '""');
			return `"${escaped}"`;
		}

		return value;
	}

	/**
	 * Get available columns for export
	 */
	static getAvailableColumns(): Array<{ value: CsvColumn; label: string }> {
		return (Object.keys(CSV_COLUMN_HEADERS) as CsvColumn[]).map(col => ({
			value: col,
			label: CSV_COLUMN_HEADERS[col]
		}));
	}
}
