/**
 * Statistics Service
 *
 * Core service for computing vault statistics with caching.
 * Leverages existing services (VaultStatsService, FamilyGraphService) for data.
 */

import type { App, TFile } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import { VaultStatsService } from '../../core/vault-stats';
import { FamilyGraphService, type PersonNode } from '../../core/family-graph';
import { FolderFilterService } from '../../core/folder-filter';
import { OrganizationService } from '../../organizations';
import type {
	StatisticsData,
	StatisticsCache,
	EntityCounts,
	CompletenessScores,
	QualityMetrics,
	DateRange,
	GenderDistribution,
	TopListItem,
	EventTypeDistribution,
	SourceTypeDistribution,
	PlaceCategoryDistribution
} from '../types/statistics-types';
import { DEFAULT_TOP_LIST_LIMIT, CACHE_DEBOUNCE_MS } from '../constants/statistics-constants';

/**
 * Service for computing and caching vault statistics
 */
export class StatisticsService {
	private app: App;
	private settings: CanvasRootsSettings;
	private cache: StatisticsCache;
	private refreshTimeout: ReturnType<typeof setTimeout> | null = null;

	// Lazy-initialized services
	private vaultStatsService: VaultStatsService | null = null;
	private familyGraphService: FamilyGraphService | null = null;
	private organizationService: OrganizationService | null = null;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
		this.cache = {
			data: null,
			lastUpdated: 0,
			isValid: false
		};
	}

	/**
	 * Get or create VaultStatsService
	 */
	private getVaultStatsService(): VaultStatsService {
		if (!this.vaultStatsService) {
			this.vaultStatsService = new VaultStatsService(this.app);
			this.vaultStatsService.setSettings(this.settings);
			const folderFilter = this.createFolderFilter();
			if (folderFilter) {
				this.vaultStatsService.setFolderFilter(folderFilter);
			}
		}
		return this.vaultStatsService;
	}

	/**
	 * Get or create FamilyGraphService
	 */
	private getFamilyGraphService(): FamilyGraphService {
		if (!this.familyGraphService) {
			this.familyGraphService = new FamilyGraphService(this.app);
			this.familyGraphService.setSettings(this.settings);
			this.familyGraphService.setPropertyAliases(this.settings.propertyAliases);
			this.familyGraphService.setValueAliases(this.settings.valueAliases);
			const folderFilter = this.createFolderFilter();
			if (folderFilter) {
				this.familyGraphService.setFolderFilter(folderFilter);
			}
		}
		return this.familyGraphService;
	}

	/**
	 * Create folder filter service based on settings
	 */
	private createFolderFilter(): FolderFilterService | null {
		// FolderFilterService uses settings directly for folder filtering
		if (this.settings.folderFilterMode !== 'disabled') {
			return new FolderFilterService(this.settings);
		}
		return null;
	}

	/**
	 * Get all statistics (cached)
	 */
	getAllStatistics(): StatisticsData {
		if (this.cache.isValid && this.cache.data) {
			return this.cache.data;
		}

		const data = this.computeAllStatistics();
		this.cache = {
			data,
			lastUpdated: Date.now(),
			isValid: true
		};

		return data;
	}

	/**
	 * Invalidate the cache
	 */
	invalidateCache(): void {
		this.cache.isValid = false;
		// Also clear any dependent service caches
		if (this.familyGraphService) {
			this.familyGraphService.clearCache();
		}
	}

	/**
	 * Schedule a debounced cache invalidation
	 */
	scheduleRefresh(): void {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
		}
		this.refreshTimeout = setTimeout(() => {
			this.refreshTimeout = null;
			this.invalidateCache();
		}, CACHE_DEBOUNCE_MS);
	}

	/**
	 * Get cache age in milliseconds
	 */
	getCacheAge(): number {
		return Date.now() - this.cache.lastUpdated;
	}

	/**
	 * Compute all statistics (not cached)
	 */
	private computeAllStatistics(): StatisticsData {
		const vaultStats = this.getVaultStatsService().collectStats();
		const familyGraph = this.getFamilyGraphService();
		familyGraph.ensureCacheLoaded();
		const people = familyGraph.getAllPeople();
		const analytics = familyGraph.calculateCollectionAnalytics();

		// Entity counts
		const entityCounts = this.computeEntityCounts(vaultStats, people.length);

		// Completeness scores
		const completeness = this.computeCompleteness(vaultStats, analytics, people.length);

		// Quality metrics
		const quality = this.computeQualityMetrics(vaultStats, analytics, people.length);

		// Date range
		const dateRange = this.computeDateRange(analytics);

		// Gender distribution
		const genderDistribution = this.computeGenderDistribution(people);

		// Top lists
		const topSurnames = this.computeTopSurnames(people);
		const topLocations = this.computeTopLocations(people);
		const topOccupations = this.computeTopOccupations(people);
		const topSources = this.computeTopSources();

		// Type distributions
		const eventsByType = vaultStats.events.byType;
		const sourcesByType = vaultStats.sources.byType;
		const placesByCategory = vaultStats.places.byCategory;

		return {
			entityCounts,
			completeness,
			quality,
			dateRange,
			genderDistribution,
			topSurnames,
			topLocations,
			topOccupations,
			topSources,
			eventsByType,
			sourcesByType,
			placesByCategory,
			lastUpdated: new Date()
		};
	}

	/**
	 * Compute entity counts
	 */
	private computeEntityCounts(vaultStats: ReturnType<VaultStatsService['collectStats']>, peopleCount: number): EntityCounts {
		// Get organization count
		let orgCount = 0;
		try {
			if (!this.organizationService) {
				// OrganizationService needs the plugin, but we can count manually
				const files = this.app.vault.getMarkdownFiles();
				for (const file of files) {
					const cache = this.app.metadataCache.getFileCache(file);
					if (cache?.frontmatter?.cr_type === 'organization') {
						orgCount++;
					}
				}
			}
		} catch {
			// Ignore errors
		}

		return {
			people: peopleCount,
			events: vaultStats.events.totalEvents,
			places: vaultStats.places.totalPlaces,
			sources: vaultStats.sources.totalSources,
			organizations: orgCount,
			canvases: vaultStats.canvases.totalCanvases
		};
	}

	/**
	 * Compute completeness scores
	 */
	private computeCompleteness(
		vaultStats: ReturnType<VaultStatsService['collectStats']>,
		analytics: ReturnType<FamilyGraphService['calculateCollectionAnalytics']>,
		totalPeople: number
	): CompletenessScores {
		const safePercent = (value: number, total: number): number => {
			if (total === 0) return 0;
			return Math.round((value / total) * 100);
		};

		return {
			withBirthDate: analytics.dataCompleteness.birthDatePercent,
			withDeathDate: analytics.dataCompleteness.deathDatePercent,
			withSources: this.computeSourcedPercent(),
			withFather: safePercent(vaultStats.people.peopleWithFather, totalPeople),
			withMother: safePercent(vaultStats.people.peopleWithMother, totalPeople),
			withSpouse: safePercent(vaultStats.people.peopleWithSpouse, totalPeople)
		};
	}

	/**
	 * Compute percentage of people with at least one source
	 */
	private computeSourcedPercent(): number {
		const people = this.getFamilyGraphService().getAllPeople();
		if (people.length === 0) return 0;

		const withSources = people.filter(p => (p.sourceCount ?? 0) > 0).length;
		return Math.round((withSources / people.length) * 100);
	}

	/**
	 * Compute quality metrics
	 */
	private computeQualityMetrics(
		vaultStats: ReturnType<VaultStatsService['collectStats']>,
		analytics: ReturnType<FamilyGraphService['calculateCollectionAnalytics']>,
		totalPeople: number
	): QualityMetrics {
		// Missing death date = total people - people with death date - living people
		const missingDeathDate = totalPeople - vaultStats.people.peopleWithDeathDate - vaultStats.people.livingPeople;

		return {
			missingBirthDate: totalPeople - vaultStats.people.peopleWithBirthDate,
			missingDeathDate: Math.max(0, missingDeathDate),
			orphanedPeople: analytics.relationshipMetrics.orphanedPeople,
			livingPeople: vaultStats.people.livingPeople,
			unsourcedEvents: this.countUnsourcedEvents(),
			placesWithoutCoordinates: vaultStats.places.totalPlaces - vaultStats.places.placesWithCoordinates
		};
	}

	/**
	 * Count events without source citations
	 */
	private countUnsourcedEvents(): number {
		const files = this.app.vault.getMarkdownFiles();
		let count = 0;

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;
			// Check if it's an event note
			if (fm.cr_type === 'event' || cache.tags?.some(t => t.tag === '#event')) {
				// Check for source field
				if (!fm.source && !fm.sources && !fm.source_id) {
					count++;
				}
			}
		}

		return count;
	}

	/**
	 * Compute date range
	 */
	private computeDateRange(analytics: ReturnType<FamilyGraphService['calculateCollectionAnalytics']>): DateRange {
		const { earliest, latest, span } = analytics.dateRange;

		return {
			earliest: earliest ? String(earliest) : null,
			latest: latest ? String(latest) : null,
			spanYears: span ?? null
		};
	}

	/**
	 * Compute gender distribution
	 */
	private computeGenderDistribution(people: PersonNode[]): GenderDistribution {
		const distribution: GenderDistribution = {
			male: 0,
			female: 0,
			other: 0,
			unknown: 0
		};

		for (const person of people) {
			const sex = person.sex?.toLowerCase();
			if (!sex) {
				distribution.unknown++;
			} else if (sex === 'm' || sex === 'male') {
				distribution.male++;
			} else if (sex === 'f' || sex === 'female') {
				distribution.female++;
			} else {
				distribution.other++;
			}
		}

		return distribution;
	}

	/**
	 * Compute top surnames
	 */
	private computeTopSurnames(people: PersonNode[], limit: number = DEFAULT_TOP_LIST_LIMIT): TopListItem[] {
		const surnameCount = new Map<string, number>();

		for (const person of people) {
			if (!person.name) continue;
			const parts = person.name.trim().split(/\s+/);
			if (parts.length > 1) {
				const surname = parts[parts.length - 1];
				surnameCount.set(surname, (surnameCount.get(surname) ?? 0) + 1);
			}
		}

		return Array.from(surnameCount.entries())
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, limit);
	}

	/**
	 * Compute top locations (birth and death places)
	 */
	private computeTopLocations(people: PersonNode[], limit: number = DEFAULT_TOP_LIST_LIMIT): TopListItem[] {
		const locationCount = new Map<string, number>();

		for (const person of people) {
			// Count birth places
			if (person.birthPlace) {
				const place = this.normalizePlace(person.birthPlace);
				locationCount.set(place, (locationCount.get(place) ?? 0) + 1);
			}
			// Count death places
			if (person.deathPlace) {
				const place = this.normalizePlace(person.deathPlace);
				locationCount.set(place, (locationCount.get(place) ?? 0) + 1);
			}
		}

		return Array.from(locationCount.entries())
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, limit);
	}

	/**
	 * Normalize place name (strip wikilinks)
	 */
	private normalizePlace(place: string): string {
		// Strip [[wikilink]] syntax
		return place.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1').trim();
	}

	/**
	 * Compute top occupations
	 */
	private computeTopOccupations(people: PersonNode[], limit: number = DEFAULT_TOP_LIST_LIMIT): TopListItem[] {
		const occupationCount = new Map<string, number>();

		for (const person of people) {
			if (person.occupation) {
				const occupation = person.occupation.trim();
				if (occupation) {
					occupationCount.set(occupation, (occupationCount.get(occupation) ?? 0) + 1);
				}
			}
		}

		return Array.from(occupationCount.entries())
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, limit);
	}

	/**
	 * Compute top sources (most cited)
	 */
	private computeTopSources(limit: number = DEFAULT_TOP_LIST_LIMIT): TopListItem[] {
		const sourceCitationCount = new Map<string, { count: number; file?: TFile }>();
		const files = this.app.vault.getMarkdownFiles();

		// Build map of source cr_id to file
		const sourceFiles = new Map<string, TFile>();
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter?.cr_type === 'source' && cache.frontmatter.cr_id) {
				sourceFiles.set(cache.frontmatter.cr_id as string, file);
			}
		}

		// Count citations
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;

			// Check for source references in various fields
			const sourceRefs: string[] = [];

			if (fm.source) {
				sourceRefs.push(...this.extractSourceRefs(fm.source));
			}
			if (fm.sources) {
				sourceRefs.push(...this.extractSourceRefs(fm.sources));
			}
			if (fm.source_id) {
				sourceRefs.push(...this.extractSourceRefs(fm.source_id));
			}

			// Count each reference
			for (const ref of sourceRefs) {
				const existing = sourceCitationCount.get(ref);
				if (existing) {
					existing.count++;
				} else {
					sourceCitationCount.set(ref, {
						count: 1,
						file: sourceFiles.get(ref)
					});
				}
			}
		}

		return Array.from(sourceCitationCount.entries())
			.map(([name, { count, file }]) => ({ name, count, file }))
			.sort((a, b) => b.count - a.count)
			.slice(0, limit);
	}

	/**
	 * Extract source references from a field value
	 */
	private extractSourceRefs(value: unknown): string[] {
		if (!value) return [];

		if (typeof value === 'string') {
			// Extract from wikilinks
			const matches = value.match(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g);
			if (matches) {
				return matches.map(m => m.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/, '$1'));
			}
			return [value];
		}

		if (Array.isArray(value)) {
			return value.flatMap(v => this.extractSourceRefs(v));
		}

		return [];
	}

	/**
	 * Get entity counts only
	 */
	getEntityCounts(): EntityCounts {
		return this.getAllStatistics().entityCounts;
	}

	/**
	 * Get completeness scores only
	 */
	getCompletenessScores(): CompletenessScores {
		return this.getAllStatistics().completeness;
	}

	/**
	 * Get quality metrics only
	 */
	getQualityMetrics(): QualityMetrics {
		return this.getAllStatistics().quality;
	}

	/**
	 * Get top surnames
	 */
	getTopSurnames(limit?: number): TopListItem[] {
		const stats = this.getAllStatistics();
		return limit ? stats.topSurnames.slice(0, limit) : stats.topSurnames;
	}

	/**
	 * Get top locations
	 */
	getTopLocations(limit?: number): TopListItem[] {
		const stats = this.getAllStatistics();
		return limit ? stats.topLocations.slice(0, limit) : stats.topLocations;
	}

	/**
	 * Get top occupations
	 */
	getTopOccupations(limit?: number): TopListItem[] {
		const stats = this.getAllStatistics();
		return limit ? stats.topOccupations.slice(0, limit) : stats.topOccupations;
	}

	/**
	 * Get top sources
	 */
	getTopSources(limit?: number): TopListItem[] {
		const stats = this.getAllStatistics();
		return limit ? stats.topSources.slice(0, limit) : stats.topSources;
	}

	/**
	 * Get date range
	 */
	getDateRange(): DateRange {
		return this.getAllStatistics().dateRange;
	}

	/**
	 * Get gender distribution
	 */
	getGenderDistribution(): GenderDistribution {
		return this.getAllStatistics().genderDistribution;
	}
}

/**
 * Factory function to create a StatisticsService
 */
export function createStatisticsService(app: App, settings: CanvasRootsSettings): StatisticsService {
	return new StatisticsService(app, settings);
}
