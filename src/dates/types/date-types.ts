/**
 * Fictional Date Systems - Type Definitions
 *
 * Enables custom calendars and eras for world-building, historical fiction,
 * and alternate history research.
 */

/**
 * A fictional era within a date system (e.g., "Third Age", "Before Conquest")
 */
export interface FictionalEra {
	/** Unique identifier (e.g., "third_age") */
	id: string;
	/** Full display name (e.g., "Third Age") */
	name: string;
	/** Abbreviation used in date strings (e.g., "TA") */
	abbrev: string;
	/**
	 * Year offset from the system's epoch (year 0).
	 * For chronologically ordered eras:
	 * - First era might be 0 or negative
	 * - Later eras have higher values
	 * Example: Third Age epoch=0, Fourth Age epoch=3021 means
	 * TA 3021 and FoA 1 are the same year.
	 */
	epoch: number;
	/**
	 * Count direction for years within this era.
	 * - 'forward' (default): Years increase (1, 2, 3...)
	 * - 'backward': Years decrease (like BC dates)
	 */
	direction?: 'forward' | 'backward';
}

/**
 * A complete fictional date system with multiple eras
 */
export interface FictionalDateSystem {
	/** Unique identifier (e.g., "middle_earth") */
	id: string;
	/** Display name (e.g., "Middle-earth Calendar") */
	name: string;
	/** Optional universe scope - links to person notes with matching universe */
	universe?: string;
	/** Eras in this system, ordered chronologically */
	eras: FictionalEra[];
	/** Default era ID for new dates in this system */
	defaultEra?: string;
	/** Whether this is a built-in system (read-only) */
	builtIn?: boolean;
	/**
	 * Source of this date system definition
	 * - undefined or 'custom': User-defined in Charted Roots settings
	 * - 'calendarium': Imported from Calendarium plugin
	 */
	source?: 'custom' | 'calendarium';
	/** Original calendar name in Calendarium (when source is 'calendarium') */
	calendariumName?: string;
}

/**
 * A parsed fictional date with all components resolved
 */
export interface ParsedFictionalDate {
	/** The date system this date belongs to */
	system: FictionalDateSystem;
	/** The specific era */
	era: FictionalEra;
	/** The year within the era */
	year: number;
	/** The original raw date string */
	raw: string;
	/** Canonical year for sorting/comparison (absolute timeline position) */
	canonicalYear: number;
}

/**
 * Result of parsing a date string
 */
export type DateParseResult =
	| { success: true; date: ParsedFictionalDate }
	| { success: false; error: string; raw: string };

/**
 * Options for date formatting
 */
export interface DateFormatOptions {
	/** Use full era name instead of abbreviation */
	useLongForm?: boolean;
	/** Include the year prefix (e.g., "Year 2941" vs "2941") */
	includeYearPrefix?: boolean;
}

/**
 * Age calculation result
 */
export interface AgeCalculation {
	/** Calculated age in years */
	years: number;
	/** Whether the calculation is exact or estimated */
	isExact: boolean;
	/** Formatted display string (e.g., "111 years") */
	display: string;
	/** Error message if calculation failed */
	error?: string;
}
