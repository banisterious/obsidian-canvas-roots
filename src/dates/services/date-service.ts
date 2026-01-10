/**
 * Date Service for Charted Roots
 *
 * Unified service for parsing and calculating with dates,
 * supporting both standard (ISO) dates and fictional calendar systems.
 */

import type { FictionalDateSystem, ParsedFictionalDate, AgeCalculation } from '../types/date-types';
import { FictionalDateParser } from '../parser/fictional-date-parser';
import { DEFAULT_DATE_SYSTEMS } from '../constants/default-date-systems';
import { getLogger } from '../../core/logging';

const logger = getLogger('DateService');

export interface DateServiceSettings {
	enableFictionalDates: boolean;
	showBuiltInDateSystems: boolean;
	fictionalDateSystems: FictionalDateSystem[];
}

export interface ParsedDate {
	/** The parsed date type */
	type: 'standard' | 'fictional';
	/** Original raw string */
	raw: string;
	/** Extracted year (for standard dates) or canonical year (for fictional dates) */
	year: number | null;
	/** Fictional date details if applicable */
	fictional?: ParsedFictionalDate;
	/** Whether the date is approximate (circa, about, etc.) */
	isApproximate?: boolean;
}

/**
 * Service for handling both standard and fictional dates
 */
export class DateService {
	private settings: DateServiceSettings;
	private fictionalParser: FictionalDateParser | null = null;

	constructor(settings: DateServiceSettings) {
		this.settings = settings;
		this.initFictionalParser();
	}

	/**
	 * Update settings and reinitialize parser
	 */
	updateSettings(settings: DateServiceSettings): void {
		this.settings = settings;
		this.initFictionalParser();
	}

	/**
	 * Initialize the fictional date parser with current settings
	 */
	private initFictionalParser(): void {
		if (!this.settings.enableFictionalDates) {
			this.fictionalParser = null;
			return;
		}

		const systems: FictionalDateSystem[] = [];

		if (this.settings.showBuiltInDateSystems) {
			systems.push(...DEFAULT_DATE_SYSTEMS);
		}

		systems.push(...this.settings.fictionalDateSystems);

		if (systems.length > 0) {
			this.fictionalParser = new FictionalDateParser(systems);
		} else {
			this.fictionalParser = null;
		}
	}

	/**
	 * Parse a date string, attempting fictional date parsing first if enabled
	 */
	parseDate(dateStr: string | undefined, universe?: string): ParsedDate | null {
		if (!dateStr || dateStr.trim() === '') {
			return null;
		}

		const trimmed = dateStr.trim();

		// Try fictional date parsing first if enabled
		if (this.fictionalParser) {
			const fictionalResult = this.fictionalParser.parse(trimmed, universe);
			if (fictionalResult.success) {
				return {
					type: 'fictional',
					raw: trimmed,
					year: fictionalResult.date.canonicalYear,
					fictional: fictionalResult.date
				};
			}
		}

		// Fall back to standard date parsing
		const standardYear = this.extractStandardYear(trimmed);
		if (standardYear !== null) {
			return {
				type: 'standard',
				raw: trimmed,
				year: standardYear,
				isApproximate: this.isApproximateDate(trimmed)
			};
		}

		// Couldn't parse the date
		logger.debug('parseDate', `Could not parse date: ${trimmed}`);
		return null;
	}

	/**
	 * Calculate age between birth and death dates
	 */
	calculateAge(
		birthDateStr: string | undefined,
		deathDateStr: string | undefined,
		universe?: string
	): AgeCalculation | null {
		if (!birthDateStr) {
			return null;
		}

		const birthDate = this.parseDate(birthDateStr, universe);
		if (!birthDate || birthDate.year === null) {
			return null;
		}

		// If both dates are fictional, use the fictional parser's age calculation
		if (birthDate.type === 'fictional' && birthDate.fictional) {
			const deathDate = deathDateStr ? this.parseDate(deathDateStr, universe) : null;

			if (deathDate?.type === 'fictional' && deathDate.fictional) {
				// Both are fictional - use fictional age calculation
				return this.fictionalParser!.calculateAge(
					birthDate.fictional,
					deathDate.fictional
				);
			} else if (!deathDateStr) {
				// No death date - calculate age to "now" (needs current fictional year)
				// For now, return null as we can't determine "current year" in fictional systems
				return null;
			}
		}

		// Standard date age calculation
		const deathDate = deathDateStr ? this.parseDate(deathDateStr, universe) : null;
		const endYear = deathDate?.year ?? new Date().getFullYear();

		if (birthDate.year === null) {
			return null;
		}

		const years = endYear - birthDate.year;
		const isExact = !birthDate.isApproximate && (!deathDate || !deathDate.isApproximate);

		return {
			years,
			isExact,
			display: `${years} years`
		};
	}

	/**
	 * Format a date for display, using fictional formatting if applicable
	 */
	formatDate(dateStr: string | undefined, universe?: string): string {
		if (!dateStr) {
			return '';
		}

		const parsed = this.parseDate(dateStr, universe);
		if (!parsed) {
			return dateStr; // Return original if can't parse
		}

		if (parsed.type === 'fictional' && parsed.fictional && this.fictionalParser) {
			return this.fictionalParser.format(parsed.fictional);
		}

		return dateStr; // Return original for standard dates
	}

	/**
	 * Check if a date string looks like a fictional date
	 */
	looksLikeFictionalDate(dateStr: string): boolean {
		if (!this.fictionalParser) {
			return false;
		}
		return this.fictionalParser.looksLikeFictionalDate(dateStr);
	}

	/**
	 * Get the canonical year for sorting purposes
	 */
	getCanonicalYear(dateStr: string | undefined, universe?: string): number | null {
		const parsed = this.parseDate(dateStr, universe);
		return parsed?.year ?? null;
	}

	/**
	 * Extract year from a standard date string
	 * Supports various formats including approximate dates
	 */
	private extractStandardYear(dateString: string): number | null {
		if (!dateString) return null;

		const normalized = dateString.toLowerCase().trim();

		// Handle "between X and Y" or "bet X and Y" - use earlier year
		const betweenMatch = normalized.match(/(?:bet(?:ween)?)\s*(\d{4})\s*(?:and|-)\s*(\d{4})/);
		if (betweenMatch) {
			const year1 = parseInt(betweenMatch[1], 10);
			const year2 = parseInt(betweenMatch[2], 10);
			return Math.min(year1, year2);
		}

		// Handle date ranges like "1920-1930" - use earlier year
		const rangeMatch = normalized.match(/\b(\d{4})\s*[-–—]\s*(\d{4})\b/);
		if (rangeMatch) {
			const year1 = parseInt(rangeMatch[1], 10);
			const year2 = parseInt(rangeMatch[2], 10);
			if (year2 > year1) {
				return Math.min(year1, year2);
			}
		}

		// Handle "before" dates
		const beforeMatch = normalized.match(/(?:bef(?:ore)?)\s*(\d{4})/);
		if (beforeMatch) {
			return parseInt(beforeMatch[1], 10);
		}

		// Handle "after" dates
		const afterMatch = normalized.match(/(?:aft(?:er)?)\s*(\d{4})/);
		if (afterMatch) {
			return parseInt(afterMatch[1], 10);
		}

		// Handle approximate dates
		const approxMatch = normalized.match(/(?:ab(?:ou)?t|circa|c\.|~)\s*(\d{4})/);
		if (approxMatch) {
			return parseInt(approxMatch[1], 10);
		}

		// Try to find any 4-digit year in the string
		const yearMatch = dateString.match(/\b(\d{4})\b/);
		if (yearMatch) {
			return parseInt(yearMatch[1], 10);
		}

		return null;
	}

	/**
	 * Check if a date string represents an approximate date
	 */
	private isApproximateDate(dateString: string): boolean {
		const normalized = dateString.toLowerCase().trim();
		return /(?:ab(?:ou)?t|circa|c\.|~|bet(?:ween)?|bef(?:ore)?|aft(?:er)?)/.test(normalized);
	}
}

/**
 * Create a DateService instance from plugin settings
 */
export function createDateService(settings: DateServiceSettings): DateService {
	return new DateService(settings);
}
