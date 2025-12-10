import type { App } from 'obsidian';
import type { PrivacyService } from './privacy-service';

/**
 * Simplified person type for statistics calculation
 * Uses the actual person cache format from FamilyGraphService
 */
interface PersonForStats {
	crId: string;
	name: string;
	collection?: string;
	birthDate?: string;
	deathDate?: string;
	[key: string]: any; // Allow other properties
}

/**
 * Export filter options that determine which entities to include
 */
export interface ExportFilterOptions {
	/** Collection name to filter by */
	collectionFilter?: string;
	/** Person cr_id to use as root for branch filtering */
	branchRootCrId?: string;
	/** Branch direction when filtering */
	branchDirection?: 'ancestors' | 'descendants';
	/** Include spouses when filtering descendants */
	branchIncludeSpouses?: boolean;
	/** Privacy settings */
	privacySettings?: {
		enablePrivacyProtection: boolean;
		privacyDisplayFormat: 'living' | 'private' | 'initials' | 'hidden';
	};
}

/**
 * Export statistics preview
 */
export interface ExportStatistics {
	/** Total number of people to export */
	totalPeople: number;
	/** Number of living people that will be protected/excluded */
	livingPeople: number;
	/** Number of living people that will be excluded entirely (if format is 'hidden') */
	excludedPeople: number;
	/** Total number of relationships to export */
	totalRelationships: number;
	/** Total number of events to export */
	totalEvents: number;
	/** Total number of sources to export */
	totalSources: number;
	/** Total number of places to export */
	totalPlaces: number;
	/** Estimated export size in bytes */
	estimatedSize: number;
}

/**
 * Service for calculating export statistics before export
 */
export class ExportStatisticsService {
	constructor(private app: App) {}

	/**
	 * Calculate export statistics based on filter options
	 */
	async calculateStatistics(
		graphService: any, // FamilyGraphService
		privacyService: PrivacyService | null,
		filterOptions: ExportFilterOptions = {}
	): Promise<ExportStatistics> {
		// Get all people from the person cache (same as exporters use)
		graphService['loadPersonCache']();
		let people = Array.from(graphService['personCache'].values()) as PersonForStats[];

		// Apply collection filter
		if (filterOptions.collectionFilter) {
			people = people.filter((person: PersonForStats) =>
				person.collection === filterOptions.collectionFilter
			);
		}

		// Apply branch filter
		if (filterOptions.branchRootCrId && filterOptions.branchDirection) {
			const branchPeople =
				filterOptions.branchDirection === 'ancestors'
					? graphService.getAncestors(filterOptions.branchRootCrId, true)
					: graphService.getDescendants(
							filterOptions.branchRootCrId,
							true,
							filterOptions.branchIncludeSpouses
					  );

			const branchCrIds = new Set(branchPeople.map((p: any) => p.crId));
			people = people.filter((person: PersonForStats) => branchCrIds.has(person.crId));
		}

		const totalPeople = people.length;

		// Calculate privacy statistics
		let livingPeople = 0;
		let excludedPeople = 0;
		if (
			privacyService &&
			filterOptions.privacySettings?.enablePrivacyProtection
		) {
			const summary = privacyService.getPrivacySummary(people);
			livingPeople = summary.protected;

			if (filterOptions.privacySettings.privacyDisplayFormat === 'hidden') {
				excludedPeople = summary.excluded;
			}
		}

		// Estimate relationship count
		// For now, use a rough estimate based on typical family tree ratios
		// A full implementation would need to parse relationships from the person data
		// Typical ratio: ~1.5 relationships per person (spouses + parent-child links)
		const totalRelationships = Math.round(totalPeople * 1.5);

		// Estimate event count
		// Typical ratio: ~2-3 events per person (birth, death, maybe marriage)
		const totalEvents = Math.round(totalPeople * 2.5);

		// For now, we'll estimate sources and places
		// A full implementation would need to track which sources/places are referenced
		// by the exported people and events
		const totalSources = await this.estimateSourceCount(people);
		const totalPlaces = await this.estimatePlaceCount(people);

		// Estimate export size
		// Rough estimate: ~500 bytes per person, ~200 per relationship, ~300 per event
		const estimatedSize =
			totalPeople * 500 +
			totalRelationships * 200 +
			totalEvents * 300 +
			totalSources * 400 +
			totalPlaces * 250;

		return {
			totalPeople,
			livingPeople,
			excludedPeople,
			totalRelationships,
			totalEvents,
			totalSources,
			totalPlaces,
			estimatedSize
		};
	}

	/**
	 * Estimate number of unique sources referenced by exported people
	 */
	private async estimateSourceCount(people: PersonForStats[]): Promise<number> {
		// Placeholder: assume 20% of people have at least one source
		return Math.round(people.length * 0.2);
	}

	/**
	 * Estimate number of unique places referenced by exported people
	 */
	private async estimatePlaceCount(people: PersonForStats[]): Promise<number> {
		// Placeholder: assume 30% of people have at least one place reference
		return Math.round(people.length * 0.3);
	}

	/**
	 * Format bytes as human-readable string
	 */
	static formatBytes(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}
}
