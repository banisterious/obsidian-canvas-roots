/**
 * Statistics Module
 *
 * Provides vault statistics, data completeness metrics, and quality analysis.
 */

// Types
export type {
	EntityCounts,
	CompletenessScores,
	QualityMetrics,
	TopListItem,
	DateRange,
	GenderDistribution,
	EventTypeDistribution,
	SourceTypeDistribution,
	PlaceCategoryDistribution,
	StatisticsData,
	StatisticsViewState,
	StatisticsCache
} from './types/statistics-types';

// Constants
export {
	VIEW_TYPE_STATISTICS,
	DEFAULT_TOP_LIST_LIMIT,
	CACHE_DEBOUNCE_MS,
	SECTION_IDS
} from './constants/statistics-constants';

// Services
export {
	StatisticsService,
	createStatisticsService
} from './services/statistics-service';

// UI Components
export { renderStatisticsTab } from './ui/statistics-tab';
export { StatisticsView } from './ui/statistics-view';
