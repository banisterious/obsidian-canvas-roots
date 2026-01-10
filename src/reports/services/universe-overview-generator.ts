/**
 * Universe Overview Generator
 *
 * Generates a summary report of all entities in a universe with statistics,
 * date ranges, and entity type breakdown.
 */

import { App, TFile } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import type {
	UniverseOverviewOptions,
	UniverseOverviewResult
} from '../types/report-types';
import { isUniverseNote } from '../../utils/note-type-detection';
import { getLogger } from '../../core/logging';

const logger = getLogger('UniverseOverviewGenerator');

/**
 * Universe info extracted from frontmatter
 */
interface UniverseInfo {
	crId: string;
	name: string;
	description?: string;
	file: TFile;
}

/**
 * Entity counts by type
 */
interface EntityCounts {
	people: number;
	places: number;
	events: number;
	organizations: number;
	sources: number;
	calendars: number;
	maps: number;
}

/**
 * Generator for Universe Overview reports
 */
export class UniverseOverviewGenerator {
	private app: App;
	private settings: CanvasRootsSettings;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Generate a Universe Overview report
	 */
	async generate(options: UniverseOverviewOptions): Promise<UniverseOverviewResult> {
		await Promise.resolve(); // Satisfy async requirement
		logger.info('generate', 'Generating Universe Overview', { universeCrId: options.universeCrId });

		const warnings: string[] = [];

		// Find the universe note
		const universe = this.findUniverse(options.universeCrId);
		if (!universe) {
			return this.errorResult(`Universe not found: ${options.universeCrId}`);
		}

		// Count entities in this universe
		const counts = this.countEntitiesInUniverse(universe.crId, universe.name);
		const totalEntities = Object.values(counts).reduce((a, b) => a + b, 0);

		// Get date range from entities
		const dateRange = this.getDateRangeForUniverse(universe.crId, universe.name);

		// Get date systems used
		const dateSystems = options.showDateSystems
			? this.getDateSystemsForUniverse(universe.crId, universe.name)
			: [];

		// Get geographic summary
		const geographicSummary = options.showGeographicSummary
			? this.getGeographicSummary(universe.crId, universe.name)
			: undefined;

		// Get entity lists (if requested)
		const entityLists = options.includeEntityList
			? this.getEntityLists(universe.crId, universe.name, options.maxEntitiesPerType)
			: undefined;

		// Get recent activity (if requested)
		const recentActivity = options.showRecentActivity
			? this.getRecentActivity(universe.crId, universe.name)
			: undefined;

		const summary = {
			totalEntities,
			byType: counts as unknown as Record<string, number>,
			dateRange: dateRange.earliest || dateRange.latest
				? { earliest: dateRange.earliest, latest: dateRange.latest }
				: undefined
		};

		// Generate markdown content
		const content = this.generateMarkdown(
			universe,
			summary,
			dateSystems,
			geographicSummary,
			entityLists,
			recentActivity,
			options
		);

		const suggestedFilename = `Universe Overview - ${universe.name}.md`;

		return {
			success: true,
			content,
			suggestedFilename: this.sanitizeFilename(suggestedFilename),
			stats: {
				peopleCount: counts.people,
				eventsCount: counts.events,
				sourcesCount: counts.sources
			},
			warnings,
			universe: {
				crId: universe.crId,
				name: universe.name,
				description: universe.description
			},
			summary,
			dateSystems,
			geographicSummary,
			entityLists,
			recentActivity
		};
	}

	/**
	 * Find a universe by cr_id or name
	 */
	private findUniverse(crIdOrName: string): UniverseInfo | null {
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (!fm) continue;

			// Check if it's a universe note
			if (!isUniverseNote(fm, cache, this.settings.noteTypeDetection)) {
				continue;
			}

			// Check for match by cr_id or name
			if (fm.cr_id === crIdOrName ||
				(fm.name && fm.name.toLowerCase() === crIdOrName.toLowerCase())) {
				return {
					crId: fm.cr_id,
					name: fm.name || file.basename,
					description: fm.description,
					file
				};
			}
		}

		return null;
	}

	/**
	 * Count entities in a universe
	 */
	private countEntitiesInUniverse(crId: string, name: string): EntityCounts {
		const counts: EntityCounts = {
			people: 0,
			places: 0,
			events: 0,
			organizations: 0,
			sources: 0,
			calendars: 0,
			maps: 0
		};

		const files = this.app.vault.getMarkdownFiles();
		const lowerName = name.toLowerCase();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (!fm?.universe) continue;

			const universeValue = String(fm.universe);
			if (universeValue !== crId && universeValue.toLowerCase() !== lowerName) {
				continue;
			}

			const crType = fm.cr_type || fm.type;
			switch (crType) {
				case 'person':
					counts.people++;
					break;
				case 'place':
					counts.places++;
					break;
				case 'event':
					counts.events++;
					break;
				case 'organization':
					counts.organizations++;
					break;
				case 'source':
					counts.sources++;
					break;
				case 'map':
					counts.maps++;
					break;
				default:
					// Check for calendar-related properties
					if (fm.calendar_type || fm.year_length || fm.months) {
						counts.calendars++;
					}
			}
		}

		return counts;
	}

	/**
	 * Get date range for entities in a universe
	 */
	private getDateRangeForUniverse(crId: string, name: string): { earliest?: string; latest?: string } {
		const dates: string[] = [];
		const files = this.app.vault.getMarkdownFiles();
		const lowerName = name.toLowerCase();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (!fm?.universe) continue;

			const universeValue = String(fm.universe);
			if (universeValue !== crId && universeValue.toLowerCase() !== lowerName) {
				continue;
			}

			// Collect relevant dates
			if (fm.birth_date) dates.push(String(fm.birth_date));
			if (fm.death_date) dates.push(String(fm.death_date));
			if (fm.date) dates.push(String(fm.date));
		}

		if (dates.length === 0) return {};

		// Sort dates
		const sortedDates = dates
			.map(d => this.extractSortDate(d))
			.filter(Boolean)
			.sort();

		return {
			earliest: sortedDates[0],
			latest: sortedDates[sortedDates.length - 1]
		};
	}

	/**
	 * Get date systems used in a universe
	 */
	private getDateSystemsForUniverse(crId: string, name: string): string[] {
		const dateSystems = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();
		const lowerName = name.toLowerCase();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (!fm?.universe) continue;

			const universeValue = String(fm.universe);
			if (universeValue !== crId && universeValue.toLowerCase() !== lowerName) {
				continue;
			}

			if (fm.date_system) {
				dateSystems.add(String(fm.date_system));
			}
		}

		return Array.from(dateSystems).sort();
	}

	/**
	 * Get geographic summary for a universe
	 */
	private getGeographicSummary(crId: string, name: string): { placesWithCoordinates: number; totalPlaces: number } {
		let totalPlaces = 0;
		let placesWithCoordinates = 0;

		const files = this.app.vault.getMarkdownFiles();
		const lowerName = name.toLowerCase();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (!fm?.universe) continue;

			const universeValue = String(fm.universe);
			if (universeValue !== crId && universeValue.toLowerCase() !== lowerName) {
				continue;
			}

			const crType = fm.cr_type || fm.type;
			if (crType === 'place') {
				totalPlaces++;
				if (fm.coordinates || fm.lat || fm.custom_coordinates) {
					placesWithCoordinates++;
				}
			}
		}

		return { placesWithCoordinates, totalPlaces };
	}

	/**
	 * Get entity lists for a universe
	 */
	private getEntityLists(crId: string, name: string, maxPerType: number): Record<string, Array<{ crId: string; name: string }>> {
		const lists: Record<string, Array<{ crId: string; name: string }>> = {
			people: [],
			places: [],
			events: [],
			organizations: []
		};

		const files = this.app.vault.getMarkdownFiles();
		const lowerName = name.toLowerCase();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (!fm?.universe || !fm.cr_id) continue;

			const universeValue = String(fm.universe);
			if (universeValue !== crId && universeValue.toLowerCase() !== lowerName) {
				continue;
			}

			const crType = fm.cr_type || fm.type;
			const entityName = fm.name || file.basename;
			const entry = { crId: fm.cr_id, name: entityName };

			switch (crType) {
				case 'person':
					if (lists.people.length < maxPerType) lists.people.push(entry);
					break;
				case 'place':
					if (lists.places.length < maxPerType) lists.places.push(entry);
					break;
				case 'event':
					if (lists.events.length < maxPerType) lists.events.push(entry);
					break;
				case 'organization':
					if (lists.organizations.length < maxPerType) lists.organizations.push(entry);
					break;
			}
		}

		return lists;
	}

	/**
	 * Get recently modified entities in a universe
	 */
	private getRecentActivity(crId: string, name: string): Array<{ crId: string; name: string; type: string; modified: string }> {
		const activity: Array<{ crId: string; name: string; type: string; modified: string; mtime: number }> = [];
		const files = this.app.vault.getMarkdownFiles();
		const lowerName = name.toLowerCase();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (!fm?.universe || !fm.cr_id) continue;

			const universeValue = String(fm.universe);
			if (universeValue !== crId && universeValue.toLowerCase() !== lowerName) {
				continue;
			}

			const crType = fm.cr_type || fm.type;
			const entityName = fm.name || file.basename;

			activity.push({
				crId: fm.cr_id,
				name: entityName,
				type: crType || 'unknown',
				modified: new Date(file.stat.mtime).toISOString().split('T')[0],
				mtime: file.stat.mtime
			});
		}

		// Sort by modification time (most recent first) and take top 20
		return activity
			.sort((a, b) => b.mtime - a.mtime)
			.slice(0, 20)
			.map(({ mtime, ...rest }) => rest);
	}

	/**
	 * Extract a sortable date from various date formats
	 */
	private extractSortDate(date: string): string {
		if (!date) return '';
		if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
		if (/^\d{4}-\d{2}$/.test(date)) return date + '-01';
		if (/^\d{4}$/.test(date)) return date + '-01-01';
		const yearMatch = date.match(/\d{4}/);
		if (yearMatch) return yearMatch[0] + '-01-01';
		return '';
	}

	/**
	 * Generate markdown content
	 */
	private generateMarkdown(
		universe: UniverseInfo,
		summary: { totalEntities: number; byType: Record<string, number>; dateRange?: { earliest?: string; latest?: string } },
		dateSystems: string[],
		geographicSummary: { placesWithCoordinates: number; totalPlaces: number } | undefined,
		entityLists: Record<string, Array<{ crId: string; name: string }>> | undefined,
		recentActivity: Array<{ crId: string; name: string; type: string; modified: string }> | undefined,
		options: UniverseOverviewOptions
	): string {
		const lines: string[] = [];
		const date = new Date().toLocaleDateString();

		// Title
		lines.push(`# Universe Overview: ${universe.name}`);
		lines.push('');
		lines.push(`Generated: ${date}`);
		lines.push('');

		if (universe.description) {
			lines.push(`*${universe.description}*`);
			lines.push('');
		}

		// Summary
		lines.push('## Summary');
		lines.push('');
		lines.push(`- **Total entities:** ${summary.totalEntities}`);
		if (summary.dateRange?.earliest || summary.dateRange?.latest) {
			const range = [summary.dateRange.earliest, summary.dateRange.latest].filter(Boolean).join(' to ');
			lines.push(`- **Date range:** ${range}`);
		}
		lines.push('');

		// Entity breakdown
		lines.push('## Entity breakdown');
		lines.push('');
		lines.push('| Type | Count |');
		lines.push('|------|-------|');
		for (const [type, count] of Object.entries(summary.byType)) {
			if (count > 0) {
				lines.push(`| ${type} | ${count} |`);
			}
		}
		lines.push('');

		// Date systems
		if (options.showDateSystems && dateSystems.length > 0) {
			lines.push('## Date systems');
			lines.push('');
			for (const ds of dateSystems) {
				lines.push(`- ${ds}`);
			}
			lines.push('');
		}

		// Geographic summary
		if (options.showGeographicSummary && geographicSummary) {
			lines.push('## Geographic summary');
			lines.push('');
			lines.push(`- **Total places:** ${geographicSummary.totalPlaces}`);
			lines.push(`- **With coordinates:** ${geographicSummary.placesWithCoordinates}`);
			if (geographicSummary.totalPlaces > 0) {
				const pct = Math.round((geographicSummary.placesWithCoordinates / geographicSummary.totalPlaces) * 100);
				lines.push(`- **Coverage:** ${pct}%`);
			}
			lines.push('');
		}

		// Entity lists
		if (options.includeEntityList && entityLists) {
			for (const [type, entities] of Object.entries(entityLists)) {
				if (entities.length > 0) {
					lines.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)}`);
					lines.push('');
					for (const entity of entities) {
						lines.push(`- [[${entity.name}]]`);
					}
					lines.push('');
				}
			}
		}

		// Recent activity
		if (options.showRecentActivity && recentActivity && recentActivity.length > 0) {
			lines.push('## Recent activity');
			lines.push('');
			lines.push('| Entity | Type | Modified |');
			lines.push('|--------|------|----------|');
			for (const item of recentActivity) {
				lines.push(`| [[${item.name}]] | ${item.type} | ${item.modified} |`);
			}
			lines.push('');
		}

		// Footer
		lines.push('---');
		lines.push('*Generated by Charted Roots*');

		return lines.join('\n');
	}

	/**
	 * Create an error result
	 */
	private errorResult(error: string): UniverseOverviewResult {
		return {
			success: false,
			content: '',
			suggestedFilename: 'universe-overview.md',
			stats: { peopleCount: 0, eventsCount: 0, sourcesCount: 0 },
			error,
			warnings: [],
			universe: { crId: '', name: 'Unknown' },
			summary: { totalEntities: 0, byType: {} },
			dateSystems: []
		};
	}

	/**
	 * Sanitize a filename
	 */
	private sanitizeFilename(filename: string): string {
		return filename.replace(/[<>:"/\\|?*]/g, '-');
	}
}
