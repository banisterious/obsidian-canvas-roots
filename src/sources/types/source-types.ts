/**
 * Source Types for Evidence & Source Management
 *
 * Defines the built-in source types and interfaces for source notes.
 */

import { LucideIconName } from '../../ui/lucide-icons';

/**
 * Confidence level for source reliability
 */
export type SourceConfidence = 'high' | 'medium' | 'low' | 'unknown';

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
