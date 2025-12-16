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
	GENDER_DISTRIBUTION: 'gender-distribution',
	REPORTS: 'reports'
} as const;
