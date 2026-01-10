/**
 * Place data model for Charted Roots geographic features
 * Supports real-world locations, historical places, and fictional geography
 */

/**
 * Place categories for classification
 * - real: Verified real-world location (default)
 * - historical: Real place that no longer exists or changed significantly
 * - disputed: Location debated by historians/archaeologists
 * - legendary: May have historical basis but heavily fictionalized
 * - mythological: Place from mythology/religion, not claimed to be real
 * - fictional: Invented for a story/world
 */
export type PlaceCategory = 'real' | 'historical' | 'disputed' | 'legendary' | 'mythological' | 'fictional';

/**
 * Known place types for hierarchical organization
 * Custom types are also supported via the "Other..." option
 */
export type KnownPlaceType =
	| 'planet'
	| 'continent'
	| 'country'
	| 'state'
	| 'province'
	| 'region'
	| 'county'
	| 'township'
	| 'city'
	| 'town'
	| 'village'
	| 'district'
	| 'parish'
	| 'castle'
	| 'estate'
	| 'cemetery'
	| 'church';

/**
 * Place type: can be any string value
 * Known types (KnownPlaceType) have predefined hierarchy levels
 * Custom types are treated as leaf-level in hierarchy (level 99)
 * Use isKnownPlaceType() to check if a type is a known type
 */
export type PlaceType = string;

/**
 * Real-world geographic coordinates
 */
export interface GeoCoordinates {
	lat: number;
	long: number;
}

/**
 * Custom coordinates for fictional maps or custom map images
 */
export interface CustomCoordinates {
	x: number;
	y: number;
	/** Path to the custom map image (relative to vault) */
	map?: string;
}

/**
 * Historical name entry for places that changed names over time
 */
export interface HistoricalName {
	name: string;
	/** Time period (e.g., "Roman", "1066-1485", "Medieval") */
	period?: string;
}

/**
 * Place data as stored in frontmatter
 */
export interface Place {
	/** Must be "place" to identify as a place note */
	type: 'place';

	/** Unique identifier (UUID) - REQUIRED */
	cr_id: string;

	/** Primary display name */
	name: string;

	/** Path to the place's note file */
	filePath: string;

	/** Alternative names for the place */
	aliases?: string[];

	/** Classification of the place */
	place_category?: PlaceCategory;

	/** Type of place in hierarchy */
	place_type?: PlaceType;

	/** For fictional/mythological/legendary places - the universe/world it belongs to */
	universe?: string;

	/** Wikilink to parent place */
	parent_place?: string;

	/** Parent place's cr_id for reliable resolution */
	parent_place_id?: string;

	/** Real-world coordinates (for real, historical, disputed places) */
	coordinates?: GeoCoordinates;

	/** Custom coordinates for fictional places or custom maps */
	custom_coordinates?: CustomCoordinates;

	/** Historical names the place has had */
	historical_names?: HistoricalName[];

	/** User-defined collection/grouping name (shared with person notes) */
	collection?: string;
}

/**
 * Normalized place data for graph processing
 */
export interface PlaceNode {
	id: string;
	name: string;
	filePath: string;
	category: PlaceCategory;
	placeType?: PlaceType;
	universe?: string;
	parentId?: string;
	childIds: string[];
	aliases: string[];
	coordinates?: GeoCoordinates;
	customCoordinates?: CustomCoordinates;
	collection?: string;
	/** Media files linked to this place (wikilinks) */
	media?: string[];
}

/**
 * Place reference from a person note
 * Tracks which people are associated with which places
 */
export interface PlaceReference {
	/** The place identifier (cr_id if linked, or raw string if unlinked) */
	placeId?: string;

	/** The raw string value from frontmatter */
	rawValue: string;

	/** Whether this references an existing place note */
	isLinked: boolean;

	/** Type of reference (birth, death, marriage, residence, etc.) */
	referenceType: PlaceReferenceType;

	/** The person's cr_id who has this place reference */
	personId: string;
}

/**
 * Types of place references from person notes
 */
export type PlaceReferenceType =
	| 'birth'
	| 'death'
	| 'marriage'
	| 'residence'
	| 'burial'
	| 'other';

/**
 * Statistics about places in the vault
 */
export interface PlaceStatistics {
	/** Total number of place notes */
	totalPlaces: number;

	/** Places with coordinates defined */
	withCoordinates: number;

	/** Places without a parent (orphans or top-level) */
	orphanPlaces: number;

	/** Maximum depth of place hierarchy */
	maxHierarchyDepth: number;

	/** Counts by category */
	byCategory: Record<PlaceCategory, number>;

	/** Count of places by type (known types + any custom types found) */
	byType: Record<string, number>;

	/** Places grouped by universe (for fictional places) */
	byUniverse: Record<string, number>;

	/** Places grouped by user-defined collection */
	byCollection: Record<string, number>;

	/** Most common places referenced by people */
	topBirthPlaces: Array<{ place: string; count: number }>;
	topDeathPlaces: Array<{ place: string; count: number }>;

	/** Migration patterns (birth place -> death place) */
	migrationPatterns: Array<{ from: string; to: string; count: number }>;

	/** Data quality issues */
	issues: PlaceIssue[];
}

/**
 * Place-related data quality issues
 */
export interface PlaceIssue {
	type: PlaceIssueType;
	message: string;
	placeId?: string;
	placeName?: string;
	filePath?: string;
}

export type PlaceIssueType =
	| 'orphan_place'           // Place has no parent (and isn't top-level)
	| 'missing_place_note'     // Person references place that doesn't exist
	| 'circular_hierarchy'     // Circular parent reference detected
	| 'duplicate_name'         // Multiple places with same name, no disambiguation
	| 'fictional_with_coords'  // Fictional place has real-world coordinates
	| 'real_missing_coords'    // Real place missing coordinates
	| 'invalid_category';      // Unrecognized place category

/**
 * Default place category when not specified
 */
export const DEFAULT_PLACE_CATEGORY: PlaceCategory = 'real';

/**
 * Categories that support universe grouping
 */
export const UNIVERSE_CATEGORIES: PlaceCategory[] = ['fictional', 'mythological', 'legendary'];

/**
 * Categories that can have real-world coordinates
 */
export const REAL_COORD_CATEGORIES: PlaceCategory[] = ['real', 'historical', 'disputed'];

/**
 * Check if a place category supports universe grouping
 */
export function supportsUniverse(category: PlaceCategory): boolean {
	return UNIVERSE_CATEGORIES.includes(category);
}

/**
 * Check if a place category can have real-world coordinates
 */
export function supportsRealCoordinates(category: PlaceCategory): boolean {
	return REAL_COORD_CATEGORIES.includes(category);
}

/**
 * List of known place types (for dropdown/validation)
 */
export const KNOWN_PLACE_TYPES: KnownPlaceType[] = [
	'planet',
	'continent',
	'country',
	'state',
	'province',
	'region',
	'county',
	'township',
	'city',
	'town',
	'village',
	'district',
	'parish',
	'castle',
	'estate',
	'cemetery',
	'church'
];

/**
 * Check if a place type is a known type (vs custom)
 */
export function isKnownPlaceType(type: string): type is KnownPlaceType {
	return KNOWN_PLACE_TYPES.includes(type as KnownPlaceType);
}
