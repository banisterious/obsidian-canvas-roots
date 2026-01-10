/**
 * CSV Parser for Charted Roots
 *
 * Parses CSV files with support for quoted fields, custom delimiters,
 * and flexible column mapping.
 */

import { getLogger } from '../core/logging';

const logger = getLogger('CsvParser');

/**
 * Parsed CSV row as key-value pairs
 */
export type CsvRow = Record<string, string>;

/**
 * CSV parse options
 */
export interface CsvParseOptions {
	/** Field delimiter (default: comma) */
	delimiter?: string;

	/** Whether first row contains headers (default: true) */
	hasHeader?: boolean;

	/** Custom header names if file has no header row */
	customHeaders?: string[];

	/** Skip empty rows (default: true) */
	skipEmptyRows?: boolean;

	/** Trim whitespace from values (default: true) */
	trimValues?: boolean;
}

/**
 * CSV parse result
 */
export interface CsvParseResult {
	/** Parsed data rows */
	rows: CsvRow[];

	/** Column headers (from file or custom) */
	headers: string[];

	/** Total rows parsed (excluding header) */
	rowCount: number;

	/** Parse errors encountered */
	errors: Array<{
		row: number;
		message: string;
	}>;
}

/**
 * CSV validation result
 */
export interface CsvValidationResult {
	/** Whether CSV is valid for import */
	valid: boolean;

	/** Headers found in the file */
	headers: string[];

	/** Row count (excluding header) */
	rowCount: number;

	/** Validation errors */
	errors: Array<{
		row?: number;
		message: string;
	}>;

	/** Validation warnings */
	warnings: Array<{
		row?: number;
		message: string;
	}>;
}

/**
 * Parse CSV content into structured data
 */
export class CsvParser {
	/**
	 * Parse CSV content
	 */
	static parse(content: string, options: CsvParseOptions = {}): CsvParseResult {
		const {
			delimiter = ',',
			hasHeader = true,
			customHeaders,
			skipEmptyRows = true,
			trimValues = true
		} = options;

		const result: CsvParseResult = {
			rows: [],
			headers: [],
			rowCount: 0,
			errors: []
		};

		// Split into lines (handle different line endings)
		const lines = content.split(/\r?\n/);

		if (lines.length === 0) {
			result.errors.push({ row: 0, message: 'Empty CSV file' });
			return result;
		}

		// Parse headers
		let dataStartIndex = 0;

		if (hasHeader && !customHeaders) {
			const headerLine = lines[0];
			result.headers = this.parseLine(headerLine, delimiter, trimValues);
			dataStartIndex = 1;
			logger.debug('parse', `Parsed ${result.headers.length} headers: ${result.headers.join(', ')}`);
		} else if (customHeaders) {
			result.headers = customHeaders;
			logger.debug('parse', `Using ${customHeaders.length} custom headers`);
		} else {
			// No headers - generate column names
			if (lines.length > 0) {
				const firstRow = this.parseLine(lines[0], delimiter, trimValues);
				result.headers = firstRow.map((_, i) => `column_${i + 1}`);
				logger.debug('parse', `Generated ${result.headers.length} column names`);
			}
		}

		// Parse data rows
		for (let i = dataStartIndex; i < lines.length; i++) {
			const line = lines[i];

			// Skip empty lines
			if (skipEmptyRows && (!line || line.trim() === '')) {
				continue;
			}

			try {
				const values = this.parseLine(line, delimiter, trimValues);

				// Create row object
				const row: CsvRow = {};
				for (let j = 0; j < result.headers.length; j++) {
					const header = result.headers[j];
					const value = j < values.length ? values[j] : '';
					row[header] = value;
				}

				// Handle extra columns (log warning but include)
				if (values.length > result.headers.length) {
					result.errors.push({
						row: i + 1,
						message: `Row has ${values.length} columns but header has ${result.headers.length}`
					});

					// Add extra columns with generated names
					for (let j = result.headers.length; j < values.length; j++) {
						row[`extra_${j + 1}`] = values[j];
					}
				}

				result.rows.push(row);
				result.rowCount++;

			} catch (error) {
				result.errors.push({
					row: i + 1,
					message: `Parse error: ${error instanceof Error ? error.message : String(error)}`
				});
			}
		}

		logger.info('parse', `Parsed ${result.rowCount} rows with ${result.errors.length} errors`);
		return result;
	}

	/**
	 * Parse a single CSV line into an array of values
	 * Handles quoted fields with embedded delimiters, quotes, and newlines
	 */
	private static parseLine(line: string, delimiter: string, trimValues: boolean): string[] {
		const values: string[] = [];
		let current = '';
		let inQuotes = false;
		let i = 0;

		while (i < line.length) {
			const char = line[i];
			const nextChar = i + 1 < line.length ? line[i + 1] : '';

			if (inQuotes) {
				if (char === '"') {
					if (nextChar === '"') {
						// Escaped quote
						current += '"';
						i += 2;
					} else {
						// End of quoted field
						inQuotes = false;
						i++;
					}
				} else {
					current += char;
					i++;
				}
			} else {
				if (char === '"') {
					// Start of quoted field
					inQuotes = true;
					i++;
				} else if (char === delimiter) {
					// End of field
					values.push(trimValues ? current.trim() : current);
					current = '';
					i++;
				} else {
					current += char;
					i++;
				}
			}
		}

		// Add last field
		values.push(trimValues ? current.trim() : current);

		return values;
	}

	/**
	 * Validate CSV content for import
	 */
	static validate(content: string, options: CsvParseOptions = {}): CsvValidationResult {
		const result: CsvValidationResult = {
			valid: true,
			headers: [],
			rowCount: 0,
			errors: [],
			warnings: []
		};

		if (!content || content.trim() === '') {
			result.valid = false;
			result.errors.push({ message: 'CSV content is empty' });
			return result;
		}

		// Try to parse
		const parseResult = this.parse(content, options);

		result.headers = parseResult.headers;
		result.rowCount = parseResult.rowCount;

		// Check for parse errors
		if (parseResult.errors.length > 0) {
			for (const error of parseResult.errors) {
				result.warnings.push(error);
			}
		}

		// Validate headers exist
		if (parseResult.headers.length === 0) {
			result.valid = false;
			result.errors.push({ message: 'No headers found in CSV' });
		}

		// Check for required columns (name or cr_id)
		const hasNameColumn = this.hasColumn(parseResult.headers, ['name', 'full_name', 'fullname', 'person_name']);
		const hasCrIdColumn = this.hasColumn(parseResult.headers, ['cr_id', 'id', 'uuid']);

		if (!hasNameColumn && !hasCrIdColumn) {
			result.valid = false;
			result.errors.push({
				message: 'CSV must contain at least a "name" or "cr_id" column'
			});
		}

		// Warn about empty data
		if (parseResult.rowCount === 0) {
			result.valid = false;
			result.errors.push({ message: 'CSV contains no data rows' });
		}

		// Check for duplicate headers
		const headerCounts = new Map<string, number>();
		for (const header of parseResult.headers) {
			const lowerHeader = header.toLowerCase();
			headerCounts.set(lowerHeader, (headerCounts.get(lowerHeader) || 0) + 1);
		}

		for (const [header, count] of headerCounts) {
			if (count > 1) {
				result.warnings.push({
					message: `Duplicate header "${header}" found ${count} times`
				});
			}
		}

		logger.info('validate', `Validation ${result.valid ? 'passed' : 'failed'}: ${result.errors.length} errors, ${result.warnings.length} warnings`);
		return result;
	}

	/**
	 * Check if headers contain any of the given column names (case-insensitive)
	 */
	private static hasColumn(headers: string[], possibleNames: string[]): boolean {
		const lowerHeaders = headers.map(h => h.toLowerCase());
		return possibleNames.some(name => lowerHeaders.includes(name.toLowerCase()));
	}

	/**
	 * Find matching column name from headers (case-insensitive)
	 */
	static findColumn(headers: string[], possibleNames: string[]): string | undefined {
		const lowerHeaders = headers.map(h => h.toLowerCase());

		for (const name of possibleNames) {
			const index = lowerHeaders.indexOf(name.toLowerCase());
			if (index !== -1) {
				return headers[index];
			}
		}

		return undefined;
	}

	/**
	 * Get value from row by any of the possible column names
	 */
	static getValue(row: CsvRow, possibleNames: string[]): string | undefined {
		for (const name of possibleNames) {
			// Try exact match first
			if (row[name] !== undefined) {
				return row[name];
			}

			// Try case-insensitive match
			const lowerName = name.toLowerCase();
			for (const [key, value] of Object.entries(row)) {
				if (key.toLowerCase() === lowerName) {
					return value;
				}
			}
		}

		return undefined;
	}
}
