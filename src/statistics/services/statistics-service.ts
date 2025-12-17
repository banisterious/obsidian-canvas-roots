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
	PersonRef,
	SourceConfidenceDistribution,
	// Phase 3 types
	ExtendedStatistics,
	LongevityAnalysis,
	AgeStatistics,
	DecadeAgeStats,
	LocationAgeStats,
	FamilySizeAnalysis,
	FamilySizeStats,
	DecadeFamilyStats,
	FamilySizeBucket,
	MarriagePatternAnalysis,
	MarriageStats,
	RemarriageStats,
	MigrationAnalysis,
	MigrationRoute,
	SourceCoverageAnalysis,
	SourceCoverageStats,
	GenerationSourceStats,
	TimelineDensityAnalysis,
	DecadeEventCount,
	TimelineGap
} from '../types/statistics-types';
import { DEFAULT_TOP_LIST_LIMIT, CACHE_DEBOUNCE_MS, getGenerationLabel } from '../constants/statistics-constants';

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
		const sourcesByConfidence = this.computeSourceConfidence();
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
			sourcesByConfidence,
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

		// Compute parent type breakdown
		const parentTypeBreakdown = this.computeParentTypeBreakdown();

		return {
			withBirthDate: analytics.dataCompleteness.birthDatePercent,
			withDeathDate: analytics.dataCompleteness.deathDatePercent,
			withSources: this.computeSourcedPercent(),
			withFather: safePercent(vaultStats.people.peopleWithFather, totalPeople),
			withMother: safePercent(vaultStats.people.peopleWithMother, totalPeople),
			withSpouse: safePercent(vaultStats.people.peopleWithSpouse, totalPeople),
			parentTypeBreakdown
		};
	}

	/**
	 * Compute parent type breakdown (counts by relationship type)
	 */
	private computeParentTypeBreakdown(): import('../types/statistics-types').ParentTypeBreakdown {
		const people = this.getFamilyGraphService().getAllPeople();

		let biologicalFather = 0;
		let biologicalMother = 0;
		let stepFather = 0;
		let stepMother = 0;
		let adoptiveFather = 0;
		let adoptiveMother = 0;

		for (const person of people) {
			// Biological parents
			if (person.fatherCrId) biologicalFather++;
			if (person.motherCrId) biologicalMother++;

			// Step-parents
			if (person.stepfatherCrIds && person.stepfatherCrIds.length > 0) stepFather++;
			if (person.stepmotherCrIds && person.stepmotherCrIds.length > 0) stepMother++;

			// Adoptive parents
			if (person.adoptiveFatherCrId) adoptiveFather++;
			if (person.adoptiveMotherCrId) adoptiveMother++;
		}

		return {
			biologicalFather,
			biologicalMother,
			stepFather,
			stepMother,
			adoptiveFather,
			adoptiveMother
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

		// Calculate additional metrics
		const people = this.getFamilyGraphService().getAllPeople();

		// Incomplete parents: has one parent but not both
		const incompleteParents = people.filter(p =>
			(p.fatherCrId && !p.motherCrId) || (!p.fatherCrId && p.motherCrId)
		).length;

		// Date inconsistencies: birth after death or unreasonable ages
		let dateInconsistencies = 0;
		for (const person of people) {
			if (person.birthDate && person.deathDate) {
				const birthYear = this.extractYear(person.birthDate);
				const deathYear = this.extractYear(person.deathDate);
				if (birthYear !== null && deathYear !== null) {
					// Birth after death
					if (birthYear > deathYear) {
						dateInconsistencies++;
					}
					// Age over 120 (likely data error)
					else if (deathYear - birthYear > 120) {
						dateInconsistencies++;
					}
				}
			}
		}

		// Biologically orphaned: no biological parents but may have step/adoptive
		let biologicallyOrphaned = 0;
		let blendedFamilyCount = 0;

		for (const person of people) {
			const hasBiologicalFather = !!person.fatherCrId;
			const hasBiologicalMother = !!person.motherCrId;
			const hasStepParent = (person.stepfatherCrIds?.length ?? 0) > 0 ||
				(person.stepmotherCrIds?.length ?? 0) > 0;
			const hasAdoptiveParent = !!person.adoptiveFatherCrId || !!person.adoptiveMotherCrId;

			// Biologically orphaned: no biological parents but has step or adoptive
			if (!hasBiologicalFather && !hasBiologicalMother && (hasStepParent || hasAdoptiveParent)) {
				biologicallyOrphaned++;
			}

			// Blended family: has both biological and step/adoptive parents
			if ((hasBiologicalFather || hasBiologicalMother) && (hasStepParent || hasAdoptiveParent)) {
				blendedFamilyCount++;
			}
		}

		return {
			missingBirthDate: totalPeople - vaultStats.people.peopleWithBirthDate,
			missingDeathDate: Math.max(0, missingDeathDate),
			orphanedPeople: analytics.relationshipMetrics.orphanedPeople,
			livingPeople: vaultStats.people.livingPeople,
			unsourcedEvents: this.countUnsourcedEvents(),
			placesWithoutCoordinates: vaultStats.places.totalPlaces - vaultStats.places.placesWithCoordinates,
			incompleteParents,
			dateInconsistencies,
			biologicallyOrphaned,
			blendedFamilyCount
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
	 * Compute source confidence distribution
	 */
	private computeSourceConfidence(): SourceConfidenceDistribution {
		const distribution: SourceConfidenceDistribution = {
			high: 0,
			medium: 0,
			low: 0,
			unknown: 0
		};

		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;
			// Check if it's a source note
			if (fm.cr_type === 'source' || cache.tags?.some(t => t.tag === '#source')) {
				const confidence = (fm.confidence as string)?.toLowerCase() || 'unknown';
				if (confidence === 'high') {
					distribution.high++;
				} else if (confidence === 'medium') {
					distribution.medium++;
				} else if (confidence === 'low') {
					distribution.low++;
				} else {
					distribution.unknown++;
				}
			}
		}

		return distribution;
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

	// =========================================================================
	// Drill-down Methods (for Top Lists)
	// =========================================================================

	/**
	 * Get people with a specific surname
	 */
	getPeopleBySurname(surname: string): PersonRef[] {
		const people = this.getFamilyGraphService().getAllPeople();
		const matches: PersonRef[] = [];

		for (const person of people) {
			if (!person.name) continue;
			const parts = person.name.trim().split(/\s+/);
			if (parts.length > 1) {
				const personSurname = parts[parts.length - 1];
				if (personSurname.toLowerCase() === surname.toLowerCase()) {
					const file = this.getPersonFile(person);
					if (file) {
						matches.push({
							crId: person.crId,
							name: person.name,
							file
						});
					}
				}
			}
		}

		return matches.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Get people associated with a specific location (birth or death place)
	 */
	getPeopleByLocation(location: string): PersonRef[] {
		const people = this.getFamilyGraphService().getAllPeople();
		const matches: PersonRef[] = [];
		const normalizedLocation = this.normalizePlace(location).toLowerCase();

		for (const person of people) {
			const birthPlace = person.birthPlace ? this.normalizePlace(person.birthPlace).toLowerCase() : null;
			const deathPlace = person.deathPlace ? this.normalizePlace(person.deathPlace).toLowerCase() : null;

			if (birthPlace === normalizedLocation || deathPlace === normalizedLocation) {
				const file = this.getPersonFile(person);
				if (file) {
					matches.push({
						crId: person.crId,
						name: person.name ?? person.crId,
						file
					});
				}
			}
		}

		return matches.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Get people with a specific occupation
	 */
	getPeopleByOccupation(occupation: string): PersonRef[] {
		const people = this.getFamilyGraphService().getAllPeople();
		const matches: PersonRef[] = [];
		const normalizedOccupation = occupation.toLowerCase().trim();

		for (const person of people) {
			if (person.occupation && person.occupation.toLowerCase().trim() === normalizedOccupation) {
				const file = this.getPersonFile(person);
				if (file) {
					matches.push({
						crId: person.crId,
						name: person.name ?? person.crId,
						file
					});
				}
			}
		}

		return matches.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Get the TFile for a person by their cr_id
	 */
	private getPersonFile(person: PersonNode): TFile | null {
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter?.cr_id === person.crId) {
				return file;
			}
		}
		return null;
	}

	// =========================================================================
	// Drill-down Methods (for Quality Issues)
	// =========================================================================

	/**
	 * Get people missing birth date
	 */
	getPeopleWithMissingBirthDate(): PersonRef[] {
		const people = this.getFamilyGraphService().getAllPeople();
		const matches: PersonRef[] = [];

		for (const person of people) {
			if (!person.birthDate) {
				const file = this.getPersonFile(person);
				if (file) {
					matches.push({
						crId: person.crId,
						name: person.name ?? person.crId,
						file
					});
				}
			}
		}

		return matches.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Get people missing death date (excluding living people)
	 */
	getPeopleWithMissingDeathDate(): PersonRef[] {
		const people = this.getFamilyGraphService().getAllPeople();
		const matches: PersonRef[] = [];

		for (const person of people) {
			// Missing death date but not marked as living (has birth but no death)
			if (!person.deathDate && person.birthDate) {
				// Check if marked as living in frontmatter
				const file = this.getPersonFile(person);
				if (file) {
					const cache = this.app.metadataCache.getFileCache(file);
					const isLiving = cache?.frontmatter?.living === true ||
						cache?.frontmatter?.living === 'true';
					if (!isLiving) {
						matches.push({
							crId: person.crId,
							name: person.name ?? person.crId,
							file
						});
					}
				}
			}
		}

		return matches.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Get orphaned people (no relationships at all)
	 */
	getOrphanedPeople(): PersonRef[] {
		const people = this.getFamilyGraphService().getAllPeople();
		const matches: PersonRef[] = [];

		for (const person of people) {
			const hasNoRelationships =
				!person.fatherCrId &&
				!person.motherCrId &&
				person.spouseCrIds.length === 0 &&
				person.childrenCrIds.length === 0;

			if (hasNoRelationships) {
				const file = this.getPersonFile(person);
				if (file) {
					matches.push({
						crId: person.crId,
						name: person.name ?? person.crId,
						file
					});
				}
			}
		}

		return matches.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Get people with incomplete parent links (one parent but not both)
	 */
	getPeopleWithIncompleteParents(): PersonRef[] {
		const people = this.getFamilyGraphService().getAllPeople();
		const matches: PersonRef[] = [];

		for (const person of people) {
			const hasOnlyFather = person.fatherCrId && !person.motherCrId;
			const hasOnlyMother = !person.fatherCrId && person.motherCrId;

			if (hasOnlyFather || hasOnlyMother) {
				const file = this.getPersonFile(person);
				if (file) {
					matches.push({
						crId: person.crId,
						name: person.name ?? person.crId,
						file
					});
				}
			}
		}

		return matches.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Get people with date inconsistencies (birth after death, age > 120)
	 */
	getPeopleWithDateInconsistencies(): PersonRef[] {
		const people = this.getFamilyGraphService().getAllPeople();
		const matches: PersonRef[] = [];

		for (const person of people) {
			if (person.birthDate && person.deathDate) {
				const birthYear = this.extractYear(person.birthDate);
				const deathYear = this.extractYear(person.deathDate);

				if (birthYear !== null && deathYear !== null) {
					// Birth after death or age over 120
					if (birthYear > deathYear || (deathYear - birthYear) > 120) {
						const file = this.getPersonFile(person);
						if (file) {
							matches.push({
								crId: person.crId,
								name: person.name ?? person.crId,
								file
							});
						}
					}
				}
			}
		}

		return matches.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Get unsourced events as file references
	 */
	getUnsourcedEvents(): TFile[] {
		const files = this.app.vault.getMarkdownFiles();
		const unsourced: TFile[] = [];

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;
			if (fm.cr_type === 'event' || cache.tags?.some(t => t.tag === '#event')) {
				if (!fm.source && !fm.sources && !fm.source_id) {
					unsourced.push(file);
				}
			}
		}

		return unsourced.sort((a, b) => a.basename.localeCompare(b.basename));
	}

	/**
	 * Get places without coordinates
	 */
	getPlacesWithoutCoordinates(): TFile[] {
		const files = this.app.vault.getMarkdownFiles();
		const noCoords: TFile[] = [];

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;
			if (fm.cr_type === 'place' || cache.tags?.some(t => t.tag === '#place')) {
				// Check for coordinates in various fields
				const hasCoords = fm.coordinates || fm.coords ||
					fm.latitude || fm.lat ||
					fm.longitude || fm.long || fm.lng;
				if (!hasCoords) {
					noCoords.push(file);
				}
			}
		}

		return noCoords.sort((a, b) => a.basename.localeCompare(b.basename));
	}

	// =========================================================================
	// Phase 3: Extended Statistics
	// =========================================================================

	/**
	 * Get all extended statistics
	 */
	getExtendedStatistics(): ExtendedStatistics {
		return {
			longevity: this.getLongevityAnalysis(),
			familySize: this.getFamilySizeAnalysis(),
			marriagePatterns: this.getMarriagePatternAnalysis(),
			migration: this.getMigrationAnalysis(),
			sourceCoverage: this.getSourceCoverageAnalysis(),
			timelineDensity: this.getTimelineDensityAnalysis()
		};
	}

	/**
	 * Get longevity analysis
	 */
	getLongevityAnalysis(): LongevityAnalysis {
		const people = this.getFamilyGraphService().getAllPeople();
		const lifespans: { person: PersonNode; age: number; birthDecade: number | null; birthPlace: string | null }[] = [];

		// Calculate lifespans for people with both birth and death dates
		for (const person of people) {
			const age = this.calculateLifespan(person);
			if (age !== null && age >= 0 && age <= 120) {
				lifespans.push({
					person,
					age,
					birthDecade: this.extractDecade(person.birthDate),
					birthPlace: person.birthPlace ? this.normalizePlace(person.birthPlace) : null
				});
			}
		}

		// Overall statistics
		const ages = lifespans.map(l => l.age);
		const overall = this.computeAgeStatistics(ages);

		// Group by birth decade
		const byDecadeMap = new Map<number, number[]>();
		for (const l of lifespans) {
			if (l.birthDecade !== null) {
				const existing = byDecadeMap.get(l.birthDecade) ?? [];
				existing.push(l.age);
				byDecadeMap.set(l.birthDecade, existing);
			}
		}

		const byBirthDecade: DecadeAgeStats[] = Array.from(byDecadeMap.entries())
			.map(([decade, ages]) => ({
				decade,
				label: `${decade}s`,
				stats: this.computeAgeStatistics(ages)
			}))
			.sort((a, b) => a.decade - b.decade);

		// Group by birth location (top 10)
		const byLocationMap = new Map<string, number[]>();
		for (const l of lifespans) {
			if (l.birthPlace) {
				const existing = byLocationMap.get(l.birthPlace) ?? [];
				existing.push(l.age);
				byLocationMap.set(l.birthPlace, existing);
			}
		}

		const byBirthLocation: LocationAgeStats[] = Array.from(byLocationMap.entries())
			.map(([location, ages]) => ({
				location,
				stats: this.computeAgeStatistics(ages)
			}))
			.sort((a, b) => b.stats.count - a.stats.count)
			.slice(0, DEFAULT_TOP_LIST_LIMIT);

		return { overall, byBirthDecade, byBirthLocation };
	}

	/**
	 * Get family size analysis
	 */
	getFamilySizeAnalysis(): FamilySizeAnalysis {
		const people = this.getFamilyGraphService().getAllPeople();
		const familySizes: { childCount: number; birthDecade: number | null }[] = [];

		// For each person with children, record their family size
		// Only include people who have at least one child recorded (to avoid
		// counting people who simply don't have their children entered yet)
		for (const person of people) {
			const childCount = person.childrenCrIds?.length ?? 0;
			if (childCount > 0) {
				familySizes.push({
					childCount,
					birthDecade: this.extractDecade(person.birthDate)
				});
			}
		}

		// Overall statistics
		const counts = familySizes.map(f => f.childCount);
		const overall = this.computeFamilySizeStats(counts);

		// Group by birth decade
		const byDecadeMap = new Map<number, number[]>();
		for (const f of familySizes) {
			if (f.birthDecade !== null) {
				const existing = byDecadeMap.get(f.birthDecade) ?? [];
				existing.push(f.childCount);
				byDecadeMap.set(f.birthDecade, existing);
			}
		}

		const byBirthDecade: DecadeFamilyStats[] = Array.from(byDecadeMap.entries())
			.map(([decade, counts]) => ({
				decade,
				label: `${decade}s`,
				stats: this.computeFamilySizeStats(counts)
			}))
			.sort((a, b) => a.decade - b.decade);

		// Size distribution buckets
		const sizeDistribution = this.computeFamilySizeDistribution(counts);

		return { overall, byBirthDecade, sizeDistribution };
	}

	/**
	 * Get marriage pattern analysis
	 */
	getMarriagePatternAnalysis(): MarriagePatternAnalysis {
		const people = this.getFamilyGraphService().getAllPeople();
		const marriageAges: { age: number; sex: string | null }[] = [];
		let totalMarried = 0;
		let remarriedCount = 0;
		const marriageCountsForRemarried: number[] = [];

		for (const person of people) {
			const spouseCount = (person.spouses?.length ?? 0) || (person.spouseCrIds?.length ?? 0);
			if (spouseCount === 0) continue;

			totalMarried++;
			if (spouseCount > 1) {
				remarriedCount++;
				marriageCountsForRemarried.push(spouseCount);
			}

			// Calculate age at first marriage
			if (person.birthDate && person.spouses && person.spouses.length > 0) {
				// Get earliest marriage date
				const marriageDates = person.spouses
					.map(s => s.marriageDate)
					.filter((d): d is string => !!d)
					.map(d => this.extractYear(d))
					.filter((y): y is number => y !== null);

				if (marriageDates.length > 0) {
					const birthYear = this.extractYear(person.birthDate);
					if (birthYear !== null) {
						const firstMarriageYear = Math.min(...marriageDates);
						const marriageAge = firstMarriageYear - birthYear;
						if (marriageAge >= 10 && marriageAge <= 80) {
							marriageAges.push({
								age: marriageAge,
								sex: person.sex?.toLowerCase() ?? null
							});
						}
					}
				}
			}
		}

		// Overall marriage age stats
		const allAges = marriageAges.map(m => m.age);
		const overall = this.computeMarriageStats(allAges);

		// By sex
		const maleAges = marriageAges.filter(m => m.sex === 'm' || m.sex === 'male').map(m => m.age);
		const femaleAges = marriageAges.filter(m => m.sex === 'f' || m.sex === 'female').map(m => m.age);

		const bySex = {
			male: this.computeMarriageStats(maleAges),
			female: this.computeMarriageStats(femaleAges)
		};

		// Remarriage stats
		const remarriage: RemarriageStats = {
			totalMarried,
			remarriedCount,
			remarriageRate: totalMarried > 0 ? Math.round((remarriedCount / totalMarried) * 100 * 10) / 10 : 0,
			averageMarriagesForRemarried: marriageCountsForRemarried.length > 0
				? Math.round((marriageCountsForRemarried.reduce((a, b) => a + b, 0) / marriageCountsForRemarried.length) * 10) / 10
				: 0
		};

		return { overall, bySex, remarriage };
	}

	/**
	 * Get migration analysis
	 */
	getMigrationAnalysis(limit: number = DEFAULT_TOP_LIST_LIMIT): MigrationAnalysis {
		const people = this.getFamilyGraphService().getAllPeople();
		const routeCount = new Map<string, number>();
		const destinationCount = new Map<string, number>();
		const originCount = new Map<string, number>();
		let analyzedCount = 0;
		let movedCount = 0;

		for (const person of people) {
			if (!person.birthPlace || !person.deathPlace) continue;

			const origin = this.normalizePlace(person.birthPlace);
			const destination = this.normalizePlace(person.deathPlace);

			if (!origin || !destination) continue;

			analyzedCount++;
			originCount.set(origin, (originCount.get(origin) ?? 0) + 1);
			destinationCount.set(destination, (destinationCount.get(destination) ?? 0) + 1);

			// Check if they moved (normalize for comparison)
			if (origin.toLowerCase() !== destination.toLowerCase()) {
				movedCount++;
				const routeKey = `${origin}|||${destination}`;
				routeCount.set(routeKey, (routeCount.get(routeKey) ?? 0) + 1);
			}
		}

		// Top routes
		const topRoutes: MigrationRoute[] = Array.from(routeCount.entries())
			.map(([key, count]) => {
				const [from, to] = key.split('|||');
				return { from, to, count };
			})
			.sort((a, b) => b.count - a.count)
			.slice(0, limit);

		// Top destinations
		const topDestinations: TopListItem[] = Array.from(destinationCount.entries())
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, limit);

		// Top origins
		const topOrigins: TopListItem[] = Array.from(originCount.entries())
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, limit);

		return {
			analyzedCount,
			movedCount,
			migrationRate: analyzedCount > 0 ? Math.round((movedCount / analyzedCount) * 100) : 0,
			topRoutes,
			topDestinations,
			topOrigins
		};
	}

	/**
	 * Get source coverage analysis
	 */
	getSourceCoverageAnalysis(rootCrId?: string): SourceCoverageAnalysis {
		const familyGraph = this.getFamilyGraphService();
		const people = familyGraph.getAllPeople();

		// Overall coverage
		const overall = this.computeSourceCoverageStats(people);

		// By generation (if root person specified)
		const byGeneration: GenerationSourceStats[] = [];

		if (rootCrId) {
			// Build generation map using BFS
			const generationMap = new Map<string, number>();
			const visited = new Set<string>();
			const queue: { crId: string; generation: number }[] = [{ crId: rootCrId, generation: 0 }];

			while (queue.length > 0) {
				const { crId, generation } = queue.shift()!;
				if (visited.has(crId)) continue;
				visited.add(crId);
				generationMap.set(crId, generation);

				const person = familyGraph.getPersonByCrId(crId);
				if (person) {
					// Add parents (generation + 1)
					if (person.fatherCrId && !visited.has(person.fatherCrId)) {
						queue.push({ crId: person.fatherCrId, generation: generation + 1 });
					}
					if (person.motherCrId && !visited.has(person.motherCrId)) {
						queue.push({ crId: person.motherCrId, generation: generation + 1 });
					}
				}
			}

			// Group by generation
			const peopleByGeneration = new Map<number, PersonNode[]>();
			for (const person of people) {
				const gen = generationMap.get(person.crId);
				if (gen !== undefined) {
					const existing = peopleByGeneration.get(gen) ?? [];
					existing.push(person);
					peopleByGeneration.set(gen, existing);
				}
			}

			// Compute stats for each generation
			for (const [generation, genPeople] of Array.from(peopleByGeneration.entries()).sort((a, b) => a[0] - b[0])) {
				byGeneration.push({
					generation,
					label: getGenerationLabel(generation),
					stats: this.computeSourceCoverageStats(genPeople)
				});
			}
		}

		return { overall, byGeneration };
	}

	/**
	 * Get timeline density analysis
	 */
	getTimelineDensityAnalysis(): TimelineDensityAnalysis {
		const decadeCount = new Map<number, number>();
		let totalEvents = 0;

		// Count events by decade from vault stats
		// Parse event dates from all files
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;
			if (fm.cr_type === 'event' || cache.tags?.some(t => t.tag === '#event')) {
				const dateStr = fm.date as string | undefined;
				if (dateStr) {
					const year = this.extractYear(dateStr);
					if (year !== null) {
						totalEvents++;
						const decade = Math.floor(year / 10) * 10;
						decadeCount.set(decade, (decadeCount.get(decade) ?? 0) + 1);
					}
				}
			}
		}

		// Also count birth/death dates as events
		const people = this.getFamilyGraphService().getAllPeople();
		for (const person of people) {
			if (person.birthDate) {
				const year = this.extractYear(person.birthDate);
				if (year !== null) {
					totalEvents++;
					const decade = Math.floor(year / 10) * 10;
					decadeCount.set(decade, (decadeCount.get(decade) ?? 0) + 1);
				}
			}
			if (person.deathDate) {
				const year = this.extractYear(person.deathDate);
				if (year !== null) {
					totalEvents++;
					const decade = Math.floor(year / 10) * 10;
					decadeCount.set(decade, (decadeCount.get(decade) ?? 0) + 1);
				}
			}
		}

		// Build decade list
		const byDecade: DecadeEventCount[] = Array.from(decadeCount.entries())
			.map(([decade, count]) => ({
				decade,
				label: `${decade}s`,
				count
			}))
			.sort((a, b) => a.decade - b.decade);

		// Detect gaps
		const gaps = this.detectTimelineGaps(byDecade);

		return { totalEvents, byDecade, gaps };
	}

	// =========================================================================
	// Helper Methods for Extended Statistics
	// =========================================================================

	/**
	 * Calculate lifespan from birth and death dates
	 */
	private calculateLifespan(person: PersonNode): number | null {
		if (!person.birthDate || !person.deathDate) return null;

		const birthYear = this.extractYear(person.birthDate);
		const deathYear = this.extractYear(person.deathDate);

		if (birthYear === null || deathYear === null) return null;

		return deathYear - birthYear;
	}

	/**
	 * Extract year from a date string (supports various formats)
	 */
	private extractYear(dateStr: string | undefined): number | null {
		if (!dateStr) return null;

		// Try to extract 4-digit year
		const match = dateStr.match(/\b(\d{4})\b/);
		if (match) {
			return parseInt(match[1], 10);
		}

		return null;
	}

	/**
	 * Extract decade from a date string
	 */
	private extractDecade(dateStr: string | undefined): number | null {
		const year = this.extractYear(dateStr);
		if (year === null) return null;
		return Math.floor(year / 10) * 10;
	}

	/**
	 * Compute age statistics from an array of ages
	 */
	private computeAgeStatistics(ages: number[]): AgeStatistics {
		if (ages.length === 0) {
			return { count: 0, averageAge: 0, medianAge: 0, minAge: 0, maxAge: 0 };
		}

		const sorted = [...ages].sort((a, b) => a - b);
		const sum = ages.reduce((a, b) => a + b, 0);

		return {
			count: ages.length,
			averageAge: Math.round((sum / ages.length) * 10) / 10,
			medianAge: this.computeMedian(sorted),
			minAge: sorted[0],
			maxAge: sorted[sorted.length - 1]
		};
	}

	/**
	 * Compute median from a sorted array
	 */
	private computeMedian(sorted: number[]): number {
		if (sorted.length === 0) return 0;
		const mid = Math.floor(sorted.length / 2);
		if (sorted.length % 2 === 0) {
			return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
		}
		return sorted[mid];
	}

	/**
	 * Compute family size statistics
	 */
	private computeFamilySizeStats(counts: number[]): FamilySizeStats {
		if (counts.length === 0) {
			return { count: 0, averageChildren: 0, medianChildren: 0, maxChildren: 0, totalChildren: 0 };
		}

		const sorted = [...counts].sort((a, b) => a - b);
		const total = counts.reduce((a, b) => a + b, 0);

		return {
			count: counts.length,
			averageChildren: Math.round((total / counts.length) * 10) / 10,
			medianChildren: this.computeMedian(sorted),
			maxChildren: sorted[sorted.length - 1],
			totalChildren: total
		};
	}

	/**
	 * Compute family size distribution buckets
	 */
	private computeFamilySizeDistribution(counts: number[]): FamilySizeBucket[] {
		if (counts.length === 0) {
			return [];
		}

		const buckets = [
			{ label: '1-2', min: 1, max: 2, count: 0 },
			{ label: '3-4', min: 3, max: 4, count: 0 },
			{ label: '5-6', min: 5, max: 6, count: 0 },
			{ label: '7+', min: 7, max: Infinity, count: 0 }
		];

		for (const c of counts) {
			for (const bucket of buckets) {
				if (c >= bucket.min && c <= bucket.max) {
					bucket.count++;
					break;
				}
			}
		}

		return buckets.map(b => ({
			label: b.label,
			count: b.count,
			percent: Math.round((b.count / counts.length) * 100)
		}));
	}

	/**
	 * Compute marriage statistics
	 */
	private computeMarriageStats(ages: number[]): MarriageStats {
		if (ages.length === 0) {
			return { count: 0, averageAge: 0, medianAge: 0, minAge: 0, maxAge: 0 };
		}

		const sorted = [...ages].sort((a, b) => a - b);
		const sum = ages.reduce((a, b) => a + b, 0);

		return {
			count: ages.length,
			averageAge: Math.round((sum / ages.length) * 10) / 10,
			medianAge: this.computeMedian(sorted),
			minAge: sorted[0],
			maxAge: sorted[sorted.length - 1]
		};
	}

	/**
	 * Compute source coverage statistics for a set of people
	 */
	private computeSourceCoverageStats(people: PersonNode[]): SourceCoverageStats {
		if (people.length === 0) {
			return { peopleCount: 0, withSources: 0, coveragePercent: 0, averageSourcesPerPerson: 0 };
		}

		const withSources = people.filter(p => (p.sourceCount ?? 0) > 0).length;
		const totalSources = people.reduce((sum, p) => sum + (p.sourceCount ?? 0), 0);

		return {
			peopleCount: people.length,
			withSources,
			coveragePercent: Math.round((withSources / people.length) * 100),
			averageSourcesPerPerson: Math.round((totalSources / people.length) * 10) / 10
		};
	}

	/**
	 * Detect gaps in timeline (periods with unusually low activity)
	 */
	private detectTimelineGaps(byDecade: DecadeEventCount[]): TimelineGap[] {
		if (byDecade.length < 3) return [];

		const gaps: TimelineGap[] = [];
		const counts = byDecade.map(d => d.count);
		const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;

		// A gap is when a decade has less than 25% of average activity
		// and is surrounded by more active decades
		for (let i = 1; i < byDecade.length - 1; i++) {
			const current = byDecade[i];
			const prev = byDecade[i - 1];
			const next = byDecade[i + 1];

			const threshold = avgCount * 0.25;
			if (current.count < threshold && prev.count > threshold && next.count > threshold) {
				gaps.push({
					startYear: current.decade,
					endYear: current.decade + 9,
					eventCount: current.count,
					expectedCount: Math.round((prev.count + next.count) / 2)
				});
			}
		}

		return gaps;
	}
}

/**
 * Factory function to create a StatisticsService
 */
export function createStatisticsService(app: App, settings: CanvasRootsSettings): StatisticsService {
	return new StatisticsService(app, settings);
}
