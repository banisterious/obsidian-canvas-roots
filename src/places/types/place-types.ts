/**
 * Place type definitions for Canvas Roots
 *
 * Place types are hierarchical, representing geographic/political divisions
 * from planet down to specific buildings. Each type has a hierarchy level
 * that determines valid parent-child relationships.
 */

/**
 * Definition of a place type
 */
export interface PlaceTypeDefinition {
	/** Unique identifier (lowercase, no spaces) */
	id: string;
	/** Display name */
	name: string;
	/** Brief description of this place type */
	description?: string;
	/** Hierarchy level (0 = highest, like planet; higher numbers = more specific) */
	hierarchyLevel: number;
	/** Category for grouping in UI */
	category: string;
	/** Whether this is a built-in type (cannot be deleted) */
	builtIn: boolean;
}

/**
 * Built-in place type category IDs
 */
export type BuiltInPlaceTypeCategory =
	| 'geographic'    // Planet, continent, region
	| 'political'     // Country, state, province, county
	| 'settlement'    // City, town, village
	| 'subdivision'   // District, parish
	| 'structure';    // Castle, estate, church, cemetery

/**
 * Category definition for grouping place types
 */
export interface PlaceTypeCategoryDefinition {
	/** Unique identifier (string to support custom categories) */
	id: string;
	/** Display name */
	name: string;
	/** Sort order for display (lower = first) */
	sortOrder: number;
}

/**
 * Human-readable category names for display (built-in categories)
 */
export const PLACE_TYPE_CATEGORY_NAMES: Record<BuiltInPlaceTypeCategory, string> = {
	geographic: 'Geographic',
	political: 'Political divisions',
	settlement: 'Settlements',
	subdivision: 'Subdivisions',
	structure: 'Structures'
};

/**
 * Built-in place type categories
 */
export const BUILT_IN_PLACE_TYPE_CATEGORIES: PlaceTypeCategoryDefinition[] = [
	{ id: 'geographic', name: 'Geographic', sortOrder: 0 },
	{ id: 'political', name: 'Political divisions', sortOrder: 1 },
	{ id: 'settlement', name: 'Settlements', sortOrder: 2 },
	{ id: 'subdivision', name: 'Subdivisions', sortOrder: 3 },
	{ id: 'structure', name: 'Structures', sortOrder: 4 }
];

/**
 * Get category for a place type
 * Returns the explicit category if set, otherwise infers from hierarchy level
 */
export function getPlaceTypeCategory(type: PlaceTypeDefinition): string {
	// Use explicit category if set
	if (type.category) {
		return type.category;
	}
	// Fall back to hierarchy-based inference for backwards compatibility
	if (type.hierarchyLevel <= 1) return 'geographic';
	if (type.hierarchyLevel <= 5) return 'political';
	if (type.hierarchyLevel <= 9) return 'settlement';
	if (type.hierarchyLevel <= 10) return 'subdivision';
	return 'structure';
}
