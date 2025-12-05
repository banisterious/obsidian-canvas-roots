/**
 * Source Types for Evidence & Source Management
 *
 * Defines the built-in source types and interfaces for source notes,
 * including evidence visualization types for GPS-aligned research.
 */

import { LucideIconName } from '../../ui/lucide-icons';

/**
 * Confidence level for source reliability
 */
export type SourceConfidence = 'high' | 'medium' | 'low' | 'unknown';

/**
 * Source quality classification per Elizabeth Shown Mills / GPS methodology
 *
 * - primary: Created at or near the time of the event by a participant or witness
 *   (e.g., original vital records, census enumeration, contemporary letters)
 * - secondary: Created later from memory or hearsay
 *   (e.g., family bibles with later entries, obituaries, oral histories)
 * - derivative: Copies, transcriptions, or abstracts of other sources
 *   (e.g., database transcriptions, published abstracts, photocopies)
 */
export type SourceQuality = 'primary' | 'secondary' | 'derivative';

/**
 * Fact keys that can be tracked for source coverage
 */
export type FactKey =
	| 'birth_date'
	| 'birth_place'
	| 'death_date'
	| 'death_place'
	| 'parents'
	| 'marriage_date'
	| 'marriage_place'
	| 'spouse'
	| 'occupation'
	| 'residence';

/**
 * All trackable fact keys
 */
export const FACT_KEYS: FactKey[] = [
	'birth_date',
	'birth_place',
	'death_date',
	'death_place',
	'parents',
	'marriage_date',
	'marriage_place',
	'spouse',
	'occupation',
	'residence'
];

/**
 * Human-readable labels for fact keys
 */
export const FACT_KEY_LABELS: Record<FactKey, string> = {
	birth_date: 'Birth date',
	birth_place: 'Birth place',
	death_date: 'Death date',
	death_place: 'Death place',
	parents: 'Parents',
	marriage_date: 'Marriage date',
	marriage_place: 'Marriage place',
	spouse: 'Spouse',
	occupation: 'Occupation',
	residence: 'Residence'
};

/**
 * Source citation for a specific fact
 */
export interface FactSourceEntry {
	/** Array of wikilinks to source notes */
	sources: string[];
}

/**
 * Fact-level source tracking for a person note
 *
 * Maps fact keys to their supporting sources.
 * Missing keys are considered unsourced.
 * Empty sources array means explicitly tracked as unsourced.
 */
export type SourcedFacts = Partial<Record<FactKey, FactSourceEntry>>;

/**
 * Coverage status for a single fact
 */
export type FactCoverageStatus = 'well-sourced' | 'sourced' | 'weakly-sourced' | 'unsourced';

/**
 * Coverage information for a single fact
 */
export interface FactCoverage {
	factKey: FactKey;
	status: FactCoverageStatus;
	sourceCount: number;
	/** Best quality among sources (if any) */
	bestQuality?: SourceQuality;
	/** Links to source notes */
	sources: string[];
}

/**
 * Overall research coverage for a person
 */
export interface PersonResearchCoverage {
	personCrId: string;
	personName: string;
	filePath: string;
	/** Percentage of tracked facts that have sources (0-100) */
	coveragePercent: number;
	/** Number of facts with at least one source */
	sourcedFactCount: number;
	/** Total number of trackable facts */
	totalFactCount: number;
	/** Coverage breakdown by fact */
	facts: FactCoverage[];
}

/**
 * Citation format options
 */
export type CitationFormat = 'chicago' | 'evidence_explained' | 'mla' | 'turabian';

/**
 * Definition of a source type (built-in or custom)
 */
export interface SourceTypeDefinition {
	id: string;
	name: string;
	description: string;
	icon: LucideIconName;
	color: string;
	category: 'vital' | 'census' | 'church' | 'legal' | 'military' | 'media' | 'other';
	isBuiltIn: boolean;
	/** Markdown template for the note body (without frontmatter) */
	template?: string;
}

/**
 * Source note data extracted from frontmatter
 */
export interface SourceNote {
	/** File path in vault */
	filePath: string;
	/** Unique identifier */
	crId: string;
	/** Display title */
	title: string;
	/** Source type (census, vital_record, etc.) */
	sourceType: string;
	/** Date of the original document */
	date?: string;
	/** When the source was accessed */
	dateAccessed?: string;
	/** Repository/archive where source is held */
	repository?: string;
	/** URL to online source */
	repositoryUrl?: string;
	/** Collection or record group name */
	collection?: string;
	/** Geographic location of record */
	location?: string;
	/** Media file wikilinks (aggregated from media, media_2, etc.) */
	media: string[];
	/** Confidence level */
	confidence: SourceConfidence;
	/** Manual citation override */
	citationOverride?: string;
	/**
	 * Source quality classification (GPS methodology)
	 * If not explicitly set, inferred from sourceType via getDefaultSourceQuality()
	 */
	sourceQuality?: SourceQuality;
}

/**
 * Summary statistics for sources
 */
export interface SourceStats {
	totalSources: number;
	byType: Record<string, number>;
	byRepository: Record<string, number>;
	byConfidence: Record<SourceConfidence, number>;
	withMedia: number;
	withoutMedia: number;
}

/**
 * Built-in source types
 */
export const BUILT_IN_SOURCE_TYPES: SourceTypeDefinition[] = [
	// Vital Records
	{
		id: 'vital_record',
		name: 'Vital record',
		description: 'Birth, death, marriage certificates',
		icon: 'file-text',
		color: '#4a90d9',
		category: 'vital',
		isBuiltIn: true
	},
	{
		id: 'obituary',
		name: 'Obituary',
		description: 'Death notices, memorial articles',
		icon: 'bookmark',
		color: '#7c7c7c',
		category: 'vital',
		isBuiltIn: true
	},

	// Census
	{
		id: 'census',
		name: 'Census',
		description: 'Population census records',
		icon: 'users',
		color: '#5ba55b',
		category: 'census',
		isBuiltIn: true
	},

	// Church Records
	{
		id: 'church_record',
		name: 'Church record',
		description: 'Baptism, marriage, burial records',
		icon: 'church',
		color: '#9b59b6',
		category: 'church',
		isBuiltIn: true
	},

	// Legal
	{
		id: 'court_record',
		name: 'Court record',
		description: 'Legal proceedings, divorces',
		icon: 'gavel',
		color: '#8b4513',
		category: 'legal',
		isBuiltIn: true
	},
	{
		id: 'land_deed',
		name: 'Land deed',
		description: 'Property records, deeds',
		icon: 'map',
		color: '#228b22',
		category: 'legal',
		isBuiltIn: true
	},
	{
		id: 'probate',
		name: 'Probate',
		description: 'Wills, estate inventories',
		icon: 'scroll',
		color: '#daa520',
		category: 'legal',
		isBuiltIn: true
	},

	// Military
	{
		id: 'military',
		name: 'Military record',
		description: 'Service records, draft cards, pensions',
		icon: 'shield',
		color: '#2e8b57',
		category: 'military',
		isBuiltIn: true
	},

	// Immigration
	{
		id: 'immigration',
		name: 'Immigration record',
		description: 'Ship manifests, naturalization, passports',
		icon: 'ship',
		color: '#4169e1',
		category: 'other',
		isBuiltIn: true
	},

	// Media & Correspondence
	{
		id: 'photo',
		name: 'Photo',
		description: 'Photographs and portraits',
		icon: 'image',
		color: '#ff6b6b',
		category: 'media',
		isBuiltIn: true
	},
	{
		id: 'correspondence',
		name: 'Correspondence',
		description: 'Letters, emails, postcards',
		icon: 'mail',
		color: '#ff8c00',
		category: 'media',
		isBuiltIn: true
	},
	{
		id: 'newspaper',
		name: 'Newspaper',
		description: 'Newspaper articles',
		icon: 'newspaper',
		color: '#696969',
		category: 'media',
		isBuiltIn: true
	},
	{
		id: 'oral_history',
		name: 'Oral history',
		description: 'Interviews, recordings',
		icon: 'mic',
		color: '#e91e63',
		category: 'media',
		isBuiltIn: true
	},

	// Other
	{
		id: 'custom',
		name: 'Custom',
		description: 'User-defined source type',
		icon: 'file',
		color: '#808080',
		category: 'other',
		isBuiltIn: true
	}
];

/**
 * Get a source type definition by ID
 */
export function getSourceType(
	typeId: string,
	customTypes: SourceTypeDefinition[] = [],
	showBuiltIn = true
): SourceTypeDefinition | undefined {
	// Check custom types first
	const customType = customTypes.find(t => t.id === typeId);
	if (customType) return customType;

	// Check built-in types
	if (showBuiltIn) {
		return BUILT_IN_SOURCE_TYPES.find(t => t.id === typeId);
	}

	return undefined;
}

/**
 * Get all available source types
 */
export function getAllSourceTypes(
	customTypes: SourceTypeDefinition[] = [],
	showBuiltIn = true
): SourceTypeDefinition[] {
	const types: SourceTypeDefinition[] = [];

	if (showBuiltIn) {
		types.push(...BUILT_IN_SOURCE_TYPES);
	}

	types.push(...customTypes);

	return types;
}

/**
 * Group source types by category
 */
export function getSourceTypesByCategory(
	customTypes: SourceTypeDefinition[] = [],
	showBuiltIn = true
): Record<string, SourceTypeDefinition[]> {
	const types = getAllSourceTypes(customTypes, showBuiltIn);
	const grouped: Record<string, SourceTypeDefinition[]> = {};

	for (const type of types) {
		if (!grouped[type.category]) {
			grouped[type.category] = [];
		}
		grouped[type.category].push(type);
	}

	return grouped;
}

/**
 * Category display names
 */
export const SOURCE_CATEGORY_NAMES: Record<string, string> = {
	vital: 'Vital records',
	census: 'Census',
	church: 'Church records',
	legal: 'Legal & property',
	military: 'Military',
	media: 'Media & correspondence',
	other: 'Other'
};

/**
 * Default source quality by source type
 *
 * These defaults assume the user has the original or authoritative version.
 * Users can override with explicit source_quality in frontmatter.
 */
export const DEFAULT_SOURCE_QUALITY: Record<string, SourceQuality> = {
	// Primary sources - created at/near the event
	census: 'primary',
	vital_record: 'primary',
	church_record: 'primary',
	military: 'primary',
	court_record: 'primary',
	land_deed: 'primary',
	probate: 'primary',
	photo: 'primary',
	correspondence: 'primary',
	immigration: 'primary',

	// Secondary sources - created later from memory/hearsay
	newspaper: 'secondary',
	obituary: 'secondary',
	oral_history: 'secondary',
	custom: 'secondary'
};

/**
 * Get the quality for a source, using explicit value or inferring from type
 */
export function getSourceQuality(source: SourceNote): SourceQuality {
	// Use explicit quality if set
	if (source.sourceQuality) {
		return source.sourceQuality;
	}

	// Infer from source type
	return DEFAULT_SOURCE_QUALITY[source.sourceType] || 'secondary';
}

/**
 * Get the default quality for a source type
 */
export function getDefaultSourceQuality(sourceType: string): SourceQuality {
	return DEFAULT_SOURCE_QUALITY[sourceType] || 'secondary';
}

/**
 * User-friendly labels for source quality (for casual users)
 */
export const SOURCE_QUALITY_LABELS: Record<SourceQuality, { label: string; description: string }> = {
	primary: {
		label: 'Original record',
		description: 'Created at the time of the event by a participant or witness'
	},
	secondary: {
		label: 'Later account',
		description: 'Created later from memory or hearsay'
	},
	derivative: {
		label: 'Copy/transcription',
		description: 'Copies, transcriptions, or abstracts of other sources'
	}
};
