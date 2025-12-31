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
	citationRefs: string[];  // Handle links to citations
	mediaRefs: string[];     // Handle links to media objects
	noteRefs: string[];      // Handle links to notes
}

/**
 * Place record
 */
export interface GrampsPlace {
	handle: string;
	id?: string;
	name?: string;
	type?: string;
	/** Handle link to parent place (for place hierarchy) */
	parentRef?: string;
	/** Whether this place has a ptitle (full hierarchical name) */
	hasPtitle?: boolean;
	mediaRefs: string[];  // Handle links to media objects
	noteRefs: string[];   // Handle links to notes
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
 * Person attribute (custom key-value pair)
 */
export interface GrampsAttribute {
	type: string;
	value: string;
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
	mediaRefs: string[]; // Handle links to media objects
	attributes: GrampsAttribute[];  // Custom person attributes
	noteRefs: string[];  // Handle links to notes
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
	noteRefs: string[];  // Handle links to notes
}

/**
 * Source record
 */
export interface GrampsSource {
	handle: string;
	id?: string;
	title?: string;      // <stitle>
	author?: string;     // <sauthor>
	pubinfo?: string;    // <spubinfo>
	abbrev?: string;     // <sabbrev>
	noteRefs: string[];  // Handle links to notes
	repoRef?: GrampsRepoRef;  // Reference to repository with medium
	mediaRefs: string[]; // Handle links to media objects (Phase 2.2)
}

/**
 * Citation record - links sources to facts with confidence
 */
export interface GrampsCitation {
	handle: string;
	id?: string;
	confidence?: number; // 0-4 scale (0=very low, 4=very high)
	sourceRef?: string;  // Handle link to source
	page?: string;       // Page/volume details
}

/**
 * Note format types
 * - FLOWED (0): Normal text, whitespace is not significant
 * - FORMATTED (1): Preformatted text, preserve whitespace
 */
export type GrampsNoteFormat = 'flowed' | 'formatted';

/**
 * Style range within note text
 */
export interface GrampsStyleRange {
	type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'superscript' | 'subscript' | 'link';
	start: number;  // Start offset in text
	end: number;    // End offset in text
	value?: string; // For links, the URL
}

/**
 * Note record
 */
export interface GrampsNote {
	handle: string;
	id?: string;
	type?: string;       // e.g., "Source text", "Research", "Person Note"
	text?: string;
	format?: GrampsNoteFormat;  // 'flowed' or 'formatted'
	private?: boolean;   // Privacy flag (priv="1")
	styles?: GrampsStyleRange[]; // Style ranges for formatted text
}

/**
 * Repository record
 */
export interface GrampsRepository {
	handle: string;
	id?: string;
	name?: string;       // <rname>
	type?: string;       // Library, Archive, Cemetery, Church, Collection, Repository, Web site, Unknown
}

/**
 * Repository reference on a source
 */
export interface GrampsRepoRef {
	hlink: string;       // Handle link to repository
	medium?: string;     // e.g., "Book", "Electronic", etc.
	callno?: string;     // Call number
}

/**
 * Media object record
 * Represents a media file (image, document, etc.) in the Gramps database
 */
export interface GrampsMedia {
	handle: string;
	id?: string;
	path: string;        // Original file path (relative to mediapath in header)
	mime?: string;       // MIME type (e.g., "image/jpeg")
	description?: string;
	date?: GrampsDate;
	noteRefs: string[];  // Handle links to notes
	citationRefs: string[]; // Handle links to citations
}

/**
 * Citation confidence levels in Gramps (0-4 scale)
 */
export type GrampsConfidence = 0 | 1 | 2 | 3 | 4;

/**
 * Map Gramps confidence (0-4) to Canvas Roots confidence (high/medium/low)
 */
export function mapGrampsConfidence(confidence?: number): 'high' | 'medium' | 'low' {
	if (confidence === undefined || confidence === null) return 'medium';
	if (confidence >= 3) return 'high';   // 3=High, 4=Very High
	if (confidence === 2) return 'medium'; // 2=Normal
	return 'low';                          // 0=Very Low, 1=Low
}

/**
 * Complete Gramps database structure
 */
export interface GrampsDatabase {
	persons: Map<string, GrampsPerson>;
	families: Map<string, GrampsFamily>;
	events: Map<string, GrampsEvent>;
	places: Map<string, GrampsPlace>;
	sources: Map<string, GrampsSource>;
	citations: Map<string, GrampsCitation>;
	notes: Map<string, GrampsNote>;
	repositories: Map<string, GrampsRepository>;
	media: Map<string, GrampsMedia>;
	header?: {
		createdBy?: string;
		createdDate?: string;
		version?: string;
		mediapath?: string;  // Base path for media files
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
		sourceCount: number;
		citationCount: number;
		noteCount: number;
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
