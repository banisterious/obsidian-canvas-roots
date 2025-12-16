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
 * Data completeness scores as percentages (0-100)
 */
export interface CompletenessScores {
	/** Percentage of people with birth date */
	withBirthDate: number;
	/** Percentage of people with death date */
	withDeathDate: number;
	/** Percentage of people with at least one source citation */
	withSources: number;
	/** Percentage of people with father */
	withFather: number;
	/** Percentage of people with mother */
	withMother: number;
	/** Percentage of people with spouse */
	withSpouse: number;
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
