/**
 * GEDCOM Types and Mappings for Canvas Roots
 *
 * Defines types, interfaces, and tag mappings for GEDCOM import v2.
 * Supports comprehensive event, source, and person attribute import.
 */

import type { DatePrecision } from '../events/types/event-types';

// ============================================================================
// Event Types and Mappings
// ============================================================================

/**
 * GEDCOM event tag to Canvas Roots event_type mapping
 */
export const GEDCOM_EVENT_TAG_MAP: Record<string, string> = {
	// Core events
	BIRT: 'birth',
	DEAT: 'death',
	MARR: 'marriage',
	DIV: 'divorce',

	// Life events
	BURI: 'burial',
	CREM: 'cremation',
	ADOP: 'adoption',
	GRAD: 'graduation',
	RETI: 'retirement',
	CENS: 'census',

	// Career/Residence
	RESI: 'residence',
	OCCU: 'occupation',
	EDUC: 'education',

	// Legal/Estate
	PROB: 'probate',
	WILL: 'will',
	NATU: 'naturalization',
	MILI: 'military',

	// Migration
	IMMI: 'immigration',
	EMIG: 'emigration',

	// Religious
	BAPM: 'baptism',
	CHR: 'christening',
	CHRA: 'adult_christening',
	CONF: 'confirmation',
	FCOM: 'first_communion',
	ORDN: 'ordination',
	BARM: 'bar_mitzvah',
	BASM: 'bas_mitzvah',
	BLES: 'blessing',

	// Family events
	ENGA: 'engagement',
	MARB: 'marriage_bann',
	MARC: 'marriage_contract',
	MARL: 'marriage_license',
	MARS: 'marriage_settlement',
	ANUL: 'annulment',
	DIVF: 'divorce_filed'
};

/**
 * Set of all GEDCOM event tags we recognize
 */
export const GEDCOM_EVENT_TAGS = new Set(Object.keys(GEDCOM_EVENT_TAG_MAP));

/**
 * Individual event tags (attached to INDI records)
 */
export const GEDCOM_INDIVIDUAL_EVENT_TAGS = new Set([
	'BIRT', 'DEAT', 'BURI', 'CREM', 'ADOP', 'GRAD', 'RETI', 'CENS',
	'RESI', 'OCCU', 'EDUC',
	'PROB', 'WILL', 'NATU', 'MILI',
	'IMMI', 'EMIG',
	'BAPM', 'CHR', 'CHRA', 'CONF', 'FCOM', 'ORDN', 'BARM', 'BASM', 'BLES'
]);

/**
 * Family event tags (attached to FAM records)
 */
export const GEDCOM_FAMILY_EVENT_TAGS = new Set([
	'MARR', 'DIV', 'ENGA', 'MARB', 'MARC', 'MARL', 'MARS', 'ANUL', 'DIVF'
]);

// ============================================================================
// Person Attribute Types and Mappings
// ============================================================================

/**
 * GEDCOM person attribute tag to Canvas Roots property mapping
 */
export const GEDCOM_ATTRIBUTE_TAG_MAP: Record<string, string> = {
	DSCR: 'physicalDescription',
	IDNO: 'identityNumber',
	NATI: 'nationality',
	RELI: 'religion',
	TITL: 'title',
	PROP: 'property',
	CAST: 'caste',
	NCHI: 'childrenCount',
	NMR: 'marriageCount',
	SSN: 'ssn'
};

/**
 * Set of all GEDCOM attribute tags we recognize
 */
export const GEDCOM_ATTRIBUTE_TAGS = new Set(Object.keys(GEDCOM_ATTRIBUTE_TAG_MAP));

/**
 * Sensitive fields that should be redacted from exports
 */
export const SENSITIVE_FIELDS = new Set(['ssn', 'identityNumber']);

// ============================================================================
// Date Precision Mapping
// ============================================================================

/**
 * GEDCOM date modifier to Canvas Roots date_precision mapping
 */
export const GEDCOM_DATE_PRECISION_MAP: Record<string, DatePrecision> = {
	'': 'exact',        // No modifier = exact
	ABT: 'estimated',   // About/approximately
	BEF: 'estimated',   // Before
	AFT: 'estimated',   // After
	CAL: 'estimated',   // Calculated
	EST: 'estimated',   // Estimated
	BET: 'range'        // Between X and Y
};

// ============================================================================
// Source Quality Mapping
// ============================================================================

/**
 * GEDCOM QUAY (quality) value to Canvas Roots source_quality mapping
 */
export const GEDCOM_SOURCE_QUALITY_MAP: Record<number, string> = {
	0: 'derivative',  // Unreliable
	1: 'secondary',   // Questionable
	2: 'secondary',   // Secondary evidence
	3: 'primary'      // Direct/primary evidence
};

// ============================================================================
// Parsed Event Interface
// ============================================================================

/**
 * Parsed GEDCOM event (individual or family event)
 */
export interface GedcomEvent {
	/** GEDCOM tag (e.g., 'BIRT', 'MARR') */
	tag: string;
	/** Canvas Roots event type (e.g., 'birth', 'marriage') */
	eventType: string;
	/** Raw GEDCOM date string */
	dateRaw?: string;
	/** Parsed ISO date */
	date?: string;
	/** End date for ranges */
	dateEnd?: string;
	/** Date precision */
	datePrecision: DatePrecision;
	/** Place string from GEDCOM */
	place?: string;
	/** Source citation references (GEDCOM @S1@ IDs) */
	sourceRefs: string[];
	/** Source citation details (PAGE values) */
	sourceCitations: GedcomSourceCitation[];
	/** Description or notes */
	description?: string;
	/** For individual events: the person's GEDCOM ID */
	individualRef?: string;
	/** For family events: spouse 1 GEDCOM ID */
	spouse1Ref?: string;
	/** For family events: spouse 2 GEDCOM ID */
	spouse2Ref?: string;
	/** Is this a family event (MARR, DIV, etc.)? */
	isFamilyEvent: boolean;
}

/**
 * Source citation attached to an event
 */
export interface GedcomSourceCitation {
	/** Reference to source record (@S1@) */
	sourceRef: string;
	/** PAGE/detail within source */
	page?: string;
	/** Quality assessment (0-3) */
	quay?: number;
}

// ============================================================================
// Parsed Source Interface
// ============================================================================

/**
 * Parsed GEDCOM source record (@S1@ SOUR)
 */
export interface GedcomSource {
	/** GEDCOM ID (e.g., 'S1') */
	id: string;
	/** Source title */
	title?: string;
	/** Author */
	author?: string;
	/** Publisher */
	publisher?: string;
	/** Publication info */
	publication?: string;
	/** Repository reference */
	repositoryRef?: string;
	/** Notes */
	notes?: string;
}

// ============================================================================
// Pedigree Types
// ============================================================================

/**
 * GEDCOM pedigree linkage type (PEDI tag values)
 * Indicates the relationship type between a child and family
 */
export type PedigreeType = 'birth' | 'adop' | 'step' | 'foster';

/**
 * Family reference with pedigree type for FAMC records
 * Tracks how a person is linked to a family (biological, adopted, step, foster)
 */
export interface FamilyAsChildRef {
	/** GEDCOM family ID (e.g., 'F1') */
	familyRef: string;
	/** Pedigree linkage type - defaults to 'birth' if not specified */
	pedigree: PedigreeType;
}

/**
 * Map GEDCOM PEDI tag values to PedigreeType
 */
export const GEDCOM_PEDIGREE_MAP: Record<string, PedigreeType> = {
	birth: 'birth',
	adop: 'adop',
	adopted: 'adop',
	step: 'step',
	foster: 'foster',
	// Some software uses these variations
	natural: 'birth',
	biological: 'birth'
};

/**
 * Get pedigree type from GEDCOM PEDI value
 * @param pediValue Raw PEDI tag value from GEDCOM
 * @returns Normalized PedigreeType, defaults to 'birth' if not recognized
 */
export function getPedigreeType(pediValue?: string): PedigreeType {
	if (!pediValue) return 'birth';
	const normalized = pediValue.toLowerCase().trim();
	return GEDCOM_PEDIGREE_MAP[normalized] || 'birth';
}

// ============================================================================
// Extended Individual Interface
// ============================================================================

/**
 * Extended individual with events and attributes (v2)
 */
export interface GedcomIndividualV2 {
	id: string;
	name: string;
	givenName?: string;
	surname?: string;
	sex?: 'M' | 'F' | 'U';

	// Core dates (still stored as flat properties for compatibility)
	birthDate?: string;
	birthPlace?: string;
	deathDate?: string;
	deathPlace?: string;
	occupation?: string;

	// Family references
	fatherRef?: string;
	motherRef?: string;
	spouseRefs: string[];
	/** @deprecated Use familyAsChildRefs instead */
	familyAsChildRef?: string;
	/** Family references where this person is a child, with pedigree type */
	familyAsChildRefs: FamilyAsChildRef[];
	familyAsSpouseRefs: string[];

	// NEW: All events for this individual
	events: GedcomEvent[];

	// NEW: Person attributes
	attributes: Record<string, string>;
}

/**
 * Extended family with events (v2)
 */
export interface GedcomFamilyV2 {
	id: string;
	husbandRef?: string;
	wifeRef?: string;
	childRefs: string[];

	// Core marriage data (for compatibility)
	marriageDate?: string;
	marriagePlace?: string;

	// NEW: All events for this family
	events: GedcomEvent[];
}

/**
 * Complete parsed GEDCOM data (v2)
 */
export interface GedcomDataV2 {
	individuals: Map<string, GedcomIndividualV2>;
	families: Map<string, GedcomFamilyV2>;
	sources: Map<string, GedcomSource>;
	header: {
		source?: string;
		version?: string;
		date?: string;
		fileName?: string;
	};
}

// ============================================================================
// Import Options
// ============================================================================

/**
 * Progress callback for GEDCOM import
 */
export type GedcomProgressCallback = (progress: GedcomImportProgress) => void;

/**
 * Progress state for GEDCOM import
 */
export interface GedcomImportProgress {
	phase: 'validating' | 'parsing' | 'places' | 'sources' | 'people' | 'relationships' | 'events' | 'complete';
	current: number;
	total: number;
	message?: string;
}

/**
 * Filename format options for imported notes
 */
export type FilenameFormat = 'original' | 'kebab-case' | 'snake_case';

/**
 * Per-type filename format options
 */
export interface FilenameFormatOptions {
	people: FilenameFormat;
	events: FilenameFormat;
	sources: FilenameFormat;
	places: FilenameFormat;
}

/**
 * Dynamic block type for person notes
 */
export type DynamicBlockType = 'timeline' | 'relationships';

/**
 * GEDCOM import options (v2)
 */
export interface GedcomImportOptionsV2 {
	peopleFolder: string;
	eventsFolder: string;
	sourcesFolder: string;
	placesFolder: string;
	overwriteExisting: boolean;
	fileName?: string;

	/** Create person notes from GEDCOM individuals */
	createPeopleNotes: boolean;
	/** Create event notes from GEDCOM events */
	createEventNotes: boolean;
	/** Create source notes from GEDCOM sources */
	createSourceNotes: boolean;
	/** Create place notes from unique places */
	createPlaceNotes: boolean;

	/** Filename format for created notes (legacy single format) */
	filenameFormat?: FilenameFormat;
	/** Per-type filename formats (takes precedence over filenameFormat) */
	filenameFormats?: FilenameFormatOptions;

	/** Property aliases for writing custom property names */
	propertyAliases?: Record<string, string>;

	/** Include dynamic content blocks in person notes */
	includeDynamicBlocks?: boolean;
	/** Which dynamic block types to include */
	dynamicBlockTypes?: DynamicBlockType[];

	/** Progress callback for UI updates */
	onProgress?: GedcomProgressCallback;
}

/**
 * GEDCOM import result (v2)
 */
export interface GedcomImportResultV2 {
	success: boolean;
	individualsImported: number;
	eventsCreated: number;
	sourcesCreated: number;
	placesCreated: number;
	placesUpdated: number;
	errors: string[];
	warnings: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a GEDCOM tag is an event tag
 */
export function isEventTag(tag: string): boolean {
	return GEDCOM_EVENT_TAGS.has(tag);
}

/**
 * Check if a GEDCOM tag is an individual event tag
 */
export function isIndividualEventTag(tag: string): boolean {
	return GEDCOM_INDIVIDUAL_EVENT_TAGS.has(tag);
}

/**
 * Check if a GEDCOM tag is a family event tag
 */
export function isFamilyEventTag(tag: string): boolean {
	return GEDCOM_FAMILY_EVENT_TAGS.has(tag);
}

/**
 * Check if a GEDCOM tag is a person attribute tag
 */
export function isAttributeTag(tag: string): boolean {
	return GEDCOM_ATTRIBUTE_TAGS.has(tag);
}

/**
 * Get Canvas Roots event type from GEDCOM tag
 */
export function getEventTypeFromTag(tag: string): string {
	return GEDCOM_EVENT_TAG_MAP[tag] || 'custom';
}

/**
 * Get Canvas Roots property name from GEDCOM attribute tag
 */
export function getPropertyFromAttributeTag(tag: string): string | undefined {
	return GEDCOM_ATTRIBUTE_TAG_MAP[tag];
}

/**
 * Parse GEDCOM date modifier and return date precision
 */
export function parseDatePrecision(dateRaw: string): {
	datePrecision: DatePrecision;
	modifier?: string;
	cleanedDate: string;
} {
	if (!dateRaw) {
		return { datePrecision: 'unknown', cleanedDate: '' };
	}

	const upper = dateRaw.toUpperCase().trim();

	// Check for BET...AND range
	const betMatch = upper.match(/^BET\s+(.+)\s+AND\s+(.+)$/i);
	if (betMatch) {
		return {
			datePrecision: 'range',
			modifier: 'BET',
			cleanedDate: betMatch[1].trim()
			// Note: betMatch[2] would be the end date
		};
	}

	// Check for other modifiers
	const modifierMatch = upper.match(/^(ABT|BEF|AFT|CAL|EST)\s+(.+)$/i);
	if (modifierMatch) {
		const modifier = modifierMatch[1].toUpperCase();
		return {
			datePrecision: GEDCOM_DATE_PRECISION_MAP[modifier] || 'estimated',
			modifier,
			cleanedDate: modifierMatch[2].trim()
		};
	}

	// No modifier - determine precision from date format
	// Just year = year precision
	if (/^\d{4}$/.test(dateRaw.trim())) {
		return { datePrecision: 'year', cleanedDate: dateRaw.trim() };
	}

	// Month and year = month precision
	if (/^[A-Z]{3}\s+\d{4}$/i.test(dateRaw.trim())) {
		return { datePrecision: 'month', cleanedDate: dateRaw.trim() };
	}

	// Full date = exact
	return { datePrecision: 'exact', cleanedDate: dateRaw.trim() };
}

/**
 * Parse a BET...AND date range and return both dates
 */
export function parseDateRange(dateRaw: string): {
	startDate: string;
	endDate?: string;
} | null {
	if (!dateRaw) return null;

	const upper = dateRaw.toUpperCase().trim();
	const betMatch = upper.match(/^BET\s+(.+)\s+AND\s+(.+)$/i);

	if (betMatch) {
		return {
			startDate: betMatch[1].trim(),
			endDate: betMatch[2].trim()
		};
	}

	return null;
}
