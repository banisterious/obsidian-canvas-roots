/**
 * Statistics Constants
 *
 * Constants for the Statistics & Reports feature.
 */

/**
 * View type identifier for Statistics workspace view
 */
export const VIEW_TYPE_STATISTICS = 'canvas-roots-statistics';

/**
 * Default limit for top lists
 */
export const DEFAULT_TOP_LIST_LIMIT = 10;

/**
 * Cache invalidation debounce time in milliseconds
 */
export const CACHE_DEBOUNCE_MS = 1000;

/**
 * Section IDs for expandable sections
 */
export const SECTION_IDS = {
	OVERVIEW: 'overview',
	COMPLETENESS: 'completeness',
	QUALITY: 'quality',
	TOP_SURNAMES: 'top-surnames',
	TOP_LOCATIONS: 'top-locations',
	TOP_OCCUPATIONS: 'top-occupations',
	TOP_SOURCES: 'top-sources',
	EVENTS_BY_TYPE: 'events-by-type',
	SOURCES_BY_TYPE: 'sources-by-type',
	SOURCES_BY_CONFIDENCE: 'sources-by-confidence',
	PLACES_BY_CATEGORY: 'places-by-category',
	GENDER_DISTRIBUTION: 'gender-distribution',
	UNIVERSES: 'universes',
	REPORTS: 'reports',
	// Phase 3: Extended Statistics
	LONGEVITY: 'longevity',
	FAMILY_SIZE: 'family-size',
	MARRIAGE_PATTERNS: 'marriage-patterns',
	MIGRATION: 'migration',
	SOURCE_COVERAGE_GEN: 'source-coverage-gen',
	TIMELINE_DENSITY: 'timeline-density'
} as const;

/**
 * Generation labels for ancestor display
 */
export const GENERATION_LABELS = [
	'Self',
	'Parents',
	'Grandparents',
	'Great-grandparents',
	'2nd great-grandparents',
	'3rd great-grandparents',
	'4th great-grandparents',
	'5th great-grandparents'
] as const;

/**
 * Get generation label for a given generation number
 */
export function getGenerationLabel(generation: number): string {
	if (generation < GENERATION_LABELS.length) {
		return GENERATION_LABELS[generation];
	}
	return `${generation - 2}th great-grandparents`;
}
