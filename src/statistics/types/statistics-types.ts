/**
 * Statistics Types
 *
 * Type definitions for the Statistics & Reports feature.
 */

import type { TFile } from 'obsidian';

/**
 * Entity counts across all note types
 */
export interface EntityCounts {
	people: number;
	events: number;
	places: number;
	sources: number;
	organizations: number;
	canvases: number;
}

/**
 * Parent type breakdown for completeness scores
 */
export interface ParentTypeBreakdown {
	/** People with biological father */
	biologicalFather: number;
	/** People with biological mother */
	biologicalMother: number;
	/** People with step-father */
	stepFather: number;
	/** People with step-mother */
	stepMother: number;
	/** People with adoptive father */
	adoptiveFather: number;
	/** People with adoptive mother */
	adoptiveMother: number;
}

/**
 * Data completeness scores as percentages (0-100)
 */
export interface CompletenessScores {
	/** Percentage of people with birth date */
	withBirthDate: number;
	/** Percentage of people with death date */
	withDeathDate: number;
	/** Percentage of people with at least one source citation */
	withSources: number;
	/** Percentage of people with father (any type) */
	withFather: number;
	/** Percentage of people with mother (any type) */
	withMother: number;
	/** Percentage of people with spouse */
	withSpouse: number;
	/** Parent type breakdown (counts, not percentages) */
	parentTypeBreakdown?: ParentTypeBreakdown;
}

/**
 * Data quality metrics
 */
export interface QualityMetrics {
	/** People missing birth date */
	missingBirthDate: number;
	/** People missing death date (excluding living) */
	missingDeathDate: number;
	/** People with no relationships (orphaned) */
	orphanedPeople: number;
	/** People currently living (has birth, no death) */
	livingPeople: number;
	/** Events without source citations */
	unsourcedEvents: number;
	/** Places without coordinates */
	placesWithoutCoordinates: number;
	/** People with only one parent linked (incomplete family) */
	incompleteParents: number;
	/** People with date inconsistencies (birth after death, child born before parent, etc.) */
	dateInconsistencies: number;
	/** People with no biological parents but may have step/adoptive parents */
	biologicallyOrphaned?: number;
	/** People with multiple parent types (blended families) */
	blendedFamilyCount?: number;
}

/**
 * Generic item for top lists
 */
export interface TopListItem {
	name: string;
	count: number;
	/** Optional file reference for drill-down */
	file?: TFile;
}

/**
 * Person reference for drill-down lists
 */
export interface PersonRef {
	/** Person's cr_id */
	crId: string;
	/** Display name */
	name: string;
	/** File reference for opening the note */
	file: TFile;
}

/**
 * Top list item type for determining drill-down behavior
 */
export type TopListType = 'surname' | 'location' | 'occupation' | 'source' | 'generic';

/**
 * Quality issue type for drill-down
 */
export type QualityIssueType =
	| 'missingBirthDate'
	| 'missingDeathDate'
	| 'orphanedPeople'
	| 'unsourcedEvents'
	| 'placesWithoutCoordinates'
	| 'incompleteParents'
	| 'dateInconsistencies';

/**
 * Date range across all entities
 */
export interface DateRange {
	earliest: string | null;
	latest: string | null;
	spanYears: number | null;
}

/**
 * Gender/sex distribution
 */
export interface GenderDistribution {
	male: number;
	female: number;
	other: number;
	unknown: number;
}

/**
 * Event type distribution
 */
export interface EventTypeDistribution {
	[eventType: string]: number;
}

/**
 * Source type distribution
 */
export interface SourceTypeDistribution {
	[sourceType: string]: number;
}

/**
 * Source confidence distribution
 */
export interface SourceConfidenceDistribution {
	high: number;
	medium: number;
	low: number;
	unknown: number;
}

/**
 * Place category distribution
 */
export interface PlaceCategoryDistribution {
	[category: string]: number;
}

/**
 * Combined statistics data (cached result)
 */
export interface StatisticsData {
	entityCounts: EntityCounts;
	completeness: CompletenessScores;
	quality: QualityMetrics;
	dateRange: DateRange;
	genderDistribution: GenderDistribution;
	topSurnames: TopListItem[];
	topLocations: TopListItem[];
	topOccupations: TopListItem[];
	topSources: TopListItem[];
	eventsByType: EventTypeDistribution;
	sourcesByType: SourceTypeDistribution;
	sourcesByConfidence: SourceConfidenceDistribution;
	placesByCategory: PlaceCategoryDistribution;
	lastUpdated: Date;
}

/**
 * Statistics view state for persistence
 */
export interface StatisticsViewState {
	/** Which sections are expanded */
	expandedSections: string[];
	/** Current filter (if any) */
	filter?: string;
	/** Index signature for Record<string, unknown> compatibility */
	[key: string]: unknown;
}

/**
 * Statistics cache structure
 */
export interface StatisticsCache {
	data: StatisticsData | null;
	lastUpdated: number;
	isValid: boolean;
}

// =============================================================================
// Extended Statistics Types (Phase 3)
// =============================================================================

/**
 * Age statistics for a group of people
 */
export interface AgeStatistics {
	/** Number of people with calculable lifespan */
	count: number;
	/** Average age at death in years */
	averageAge: number;
	/** Median age at death in years */
	medianAge: number;
	/** Minimum age at death */
	minAge: number;
	/** Maximum age at death */
	maxAge: number;
}

/**
 * Age statistics grouped by decade
 */
export interface DecadeAgeStats {
	/** Decade start year (e.g., 1850) */
	decade: number;
	/** Decade label (e.g., "1850s") */
	label: string;
	/** Statistics for this decade */
	stats: AgeStatistics;
}

/**
 * Age statistics grouped by location
 */
export interface LocationAgeStats {
	/** Normalized location name */
	location: string;
	/** Statistics for people from this location */
	stats: AgeStatistics;
}

/**
 * Longevity analysis results
 */
export interface LongevityAnalysis {
	/** Overall statistics across all people */
	overall: AgeStatistics;
	/** Statistics grouped by birth decade */
	byBirthDecade: DecadeAgeStats[];
	/** Statistics grouped by birth location (top 10) */
	byBirthLocation: LocationAgeStats[];
}

/**
 * Family size statistics
 */
export interface FamilySizeStats {
	/** Number of families/people analyzed */
	count: number;
	/** Average number of children */
	averageChildren: number;
	/** Median number of children */
	medianChildren: number;
	/** Maximum number of children in a family */
	maxChildren: number;
	/** Total children across all families */
	totalChildren: number;
}

/**
 * Family size statistics by decade
 */
export interface DecadeFamilyStats {
	/** Decade start year */
	decade: number;
	/** Decade label */
	label: string;
	/** Statistics for this decade */
	stats: FamilySizeStats;
}

/**
 * Family size distribution bucket
 */
export interface FamilySizeBucket {
	/** Bucket label (e.g., "0", "1-2", "3-4", "5+") */
	label: string;
	/** Number of families in this bucket */
	count: number;
	/** Percentage of total */
	percent: number;
}

/**
 * Family size analysis results
 */
export interface FamilySizeAnalysis {
	/** Overall statistics */
	overall: FamilySizeStats;
	/** Statistics by birth decade of parent */
	byBirthDecade: DecadeFamilyStats[];
	/** Distribution buckets */
	sizeDistribution: FamilySizeBucket[];
}

/**
 * Marriage age statistics
 */
export interface MarriageStats {
	/** Number of people with calculable marriage age */
	count: number;
	/** Average age at first marriage */
	averageAge: number;
	/** Median age at first marriage */
	medianAge: number;
	/** Minimum age at marriage */
	minAge: number;
	/** Maximum age at marriage */
	maxAge: number;
}

/**
 * Remarriage statistics
 */
export interface RemarriageStats {
	/** Total married people analyzed */
	totalMarried: number;
	/** Number of people who remarried */
	remarriedCount: number;
	/** Percentage who remarried */
	remarriageRate: number;
	/** Average number of marriages for those who remarried */
	averageMarriagesForRemarried: number;
}

/**
 * Marriage pattern analysis results
 */
export interface MarriagePatternAnalysis {
	/** Overall marriage age statistics */
	overall: MarriageStats;
	/** Statistics by sex */
	bySex: {
		male: MarriageStats;
		female: MarriageStats;
	};
	/** Remarriage statistics */
	remarriage: RemarriageStats;
}

/**
 * Migration route (from one place to another)
 */
export interface MigrationRoute {
	/** Origin location (birth place) */
	from: string;
	/** Destination location (death place) */
	to: string;
	/** Number of people who made this migration */
	count: number;
}

/**
 * Migration analysis results
 */
export interface MigrationAnalysis {
	/** Number of people with both birth and death places */
	analyzedCount: number;
	/** Number who moved (different birth/death locations) */
	movedCount: number;
	/** Migration rate (percentage who moved) */
	migrationRate: number;
	/** Top migration routes */
	topRoutes: MigrationRoute[];
	/** Top destinations (death places) */
	topDestinations: TopListItem[];
	/** Top origins (birth places) */
	topOrigins: TopListItem[];
}

/**
 * Source coverage statistics
 */
export interface SourceCoverageStats {
	/** Number of people analyzed */
	peopleCount: number;
	/** Number with at least one source */
	withSources: number;
	/** Coverage percentage */
	coveragePercent: number;
	/** Average sources per person */
	averageSourcesPerPerson: number;
}

/**
 * Source coverage by generation
 */
export interface GenerationSourceStats {
	/** Generation number (0 = root, 1 = parents, 2 = grandparents, etc.) */
	generation: number;
	/** Generation label */
	label: string;
	/** Statistics for this generation */
	stats: SourceCoverageStats;
}

/**
 * Source coverage analysis results
 */
export interface SourceCoverageAnalysis {
	/** Overall source coverage */
	overall: SourceCoverageStats;
	/** Coverage by generation (requires root person) */
	byGeneration: GenerationSourceStats[];
}

/**
 * Timeline gap (period with unusually low activity)
 */
export interface TimelineGap {
	/** Start year of gap */
	startYear: number;
	/** End year of gap */
	endYear: number;
	/** Event count in this period */
	eventCount: number;
	/** Expected count based on surrounding periods */
	expectedCount: number;
}

/**
 * Decade event count for timeline
 */
export interface DecadeEventCount {
	/** Decade start year */
	decade: number;
	/** Decade label */
	label: string;
	/** Number of events in this decade */
	count: number;
}

/**
 * Timeline density analysis results
 */
export interface TimelineDensityAnalysis {
	/** Total events analyzed */
	totalEvents: number;
	/** Events grouped by decade */
	byDecade: DecadeEventCount[];
	/** Detected gaps in the timeline */
	gaps: TimelineGap[];
}

/**
 * Combined extended statistics (Phase 3)
 */
export interface ExtendedStatistics {
	longevity: LongevityAnalysis;
	familySize: FamilySizeAnalysis;
	marriagePatterns: MarriagePatternAnalysis;
	migration: MigrationAnalysis;
	sourceCoverage: SourceCoverageAnalysis;
	timelineDensity: TimelineDensityAnalysis;
}
