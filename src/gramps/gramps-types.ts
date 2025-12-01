/**
 * Gramps XML Type Definitions
 *
 * TypeScript interfaces for Gramps genealogy software XML format.
 * Based on the Gramps XML DTD: https://github.com/gramps-project/gramps/blob/master/data/grampsxml.dtd
 */

/**
 * Gender types in Gramps
 */
export type GrampsGender = 'M' | 'F' | 'U';

/**
 * Relationship type between parent and child
 */
export type GrampsRelType = 'Birth' | 'Adopted' | 'Stepchild' | 'Sponsored' | 'Foster' | 'Unknown';

/**
 * Family relationship type
 */
export type GrampsFamilyRelType = 'Married' | 'Unmarried' | 'Civil Union' | 'Unknown';

/**
 * Name components
 */
export interface GrampsName {
	type?: string;
	first?: string;
	call?: string;
	surname?: string;
	suffix?: string;
	title?: string;
	nick?: string;
	primary?: boolean;
}

/**
 * Date representation - can be various formats
 */
export interface GrampsDate {
	type?: 'dateval' | 'daterange' | 'datespan' | 'datestr';
	val?: string;      // For dateval
	start?: string;    // For daterange/datespan
	stop?: string;     // For daterange/datespan
	quality?: 'estimated' | 'calculated';
	text?: string;     // For datestr (freeform text)
}

/**
 * Event reference from a person or family
 */
export interface GrampsEventRef {
	hlink: string;  // Handle link to event
	role?: string;  // Role in the event (Primary, Family, etc.)
}

/**
 * Event record
 */
export interface GrampsEvent {
	handle: string;
	id?: string;
	type?: string;   // Birth, Death, Marriage, etc.
	date?: GrampsDate;
	place?: string;  // Handle link to place
	description?: string;
}

/**
 * Place record
 */
export interface GrampsPlace {
	handle: string;
	id?: string;
	name?: string;
	type?: string;
}

/**
 * Child reference in a family
 */
export interface GrampsChildRef {
	hlink: string;    // Handle link to person
	mrel?: GrampsRelType;  // Mother relationship type
	frel?: GrampsRelType;  // Father relationship type
}

/**
 * Person record
 */
export interface GrampsPerson {
	handle: string;
	id?: string;
	gender?: GrampsGender;
	names: GrampsName[];
	eventrefs: GrampsEventRef[];
	childof: string[];   // Handle links to families where this person is a child
	parentin: string[];  // Handle links to families where this person is a parent
}

/**
 * Family record
 */
export interface GrampsFamily {
	handle: string;
	id?: string;
	reltype?: GrampsFamilyRelType;
	father?: string;     // Handle link to father person
	mother?: string;     // Handle link to mother person
	eventrefs: GrampsEventRef[];
	children: GrampsChildRef[];
}

/**
 * Complete Gramps database structure
 */
export interface GrampsDatabase {
	persons: Map<string, GrampsPerson>;
	families: Map<string, GrampsFamily>;
	events: Map<string, GrampsEvent>;
	places: Map<string, GrampsPlace>;
	header?: {
		createdBy?: string;
		createdDate?: string;
		version?: string;
	};
}

/**
 * Validation result for Gramps XML documents
 */
export interface GrampsValidationResult {
	valid: boolean;
	errors: Array<{ path?: string; message: string }>;
	warnings: Array<{ path?: string; message: string }>;
	stats: {
		personCount: number;
		familyCount: number;
		eventCount: number;
		placeCount: number;
	};
}

/**
 * Convert Gramps gender to Canvas Roots format
 */
export function convertGrampsGender(gender?: GrampsGender): 'M' | 'F' | undefined {
	if (gender === 'M') return 'M';
	if (gender === 'F') return 'F';
	return undefined;
}

/**
 * Format a Gramps date to ISO or readable string
 */
export function formatGrampsDate(date?: GrampsDate): string | undefined {
	if (!date) return undefined;

	// If it's a free-form text date, return it as-is
	if (date.type === 'datestr' && date.text) {
		return date.text;
	}

	// For dateval, try to parse and format
	if (date.val) {
		// Gramps dates are often in YYYY-MM-DD format already
		return date.val;
	}

	// For ranges/spans, format as "start - stop"
	if (date.start) {
		if (date.stop) {
			return `${date.start} - ${date.stop}`;
		}
		return date.start;
	}

	return undefined;
}
