/**
 * Timeline Report Generator
 *
 * Generates chronological reports of events with dates, participants,
 * places, and optional grouping by year/decade/person/place.
 *
 * Supports multiple output formats:
 * - markdown_table: Traditional table format (default)
 * - markdown_callout: Styled callout blocks with year grouping
 * - markdown_list: Simple bullet list
 * - markdown_dataview: Dynamic Dataview query
 * - canvas: Obsidian Canvas visual timeline
 * - excalidraw: Excalidraw visual timeline
 * - pdf: PDF document (uses existing PDF export)
 * - odt: ODT document (uses existing ODT export)
 */

import { App } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import type {
	TimelineReportOptions,
	TimelineReportResult,
	TimelineEntry,
	ReportPerson,
	TimelineExportFormat
} from '../types/report-types';
import { FamilyGraphService } from '../../core/family-graph';
import { FolderFilterService } from '../../core/folder-filter';
import { EventService } from '../../events/services/event-service';
import { EventNote } from '../../events/types/event-types';
import { TimelineCanvasExporter, TimelineCanvasOptions } from '../../events/services/timeline-canvas-exporter';
import { getLogger } from '../../core/logging';

const logger = getLogger('TimelineGenerator');

/**
 * Result type for canvas/excalidraw exports
 */
export interface TimelineVisualExportResult {
	success: boolean;
	path?: string;
	error?: string;
	warnings?: string[];
}

/**
 * Generator for Timeline reports
 */
export class TimelineGenerator {
	private app: App;
	private settings: CanvasRootsSettings;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Generate a Timeline report
	 */
	async generate(options: TimelineReportOptions): Promise<TimelineReportResult> {
		await Promise.resolve(); // Satisfy async requirement
		logger.info('generate', 'Generating Timeline Report', { grouping: options.grouping });

		const warnings: string[] = [];

		// Initialize services
		const eventService = new EventService(this.app, this.settings);
		const familyGraph = new FamilyGraphService(this.app);
		if (this.settings.folderFilterMode !== 'disabled') {
			familyGraph.setFolderFilter(new FolderFilterService(this.settings));
		}
		familyGraph.setPropertyAliases(this.settings.propertyAliases);
		familyGraph.setValueAliases(this.settings.valueAliases);
		familyGraph.setSettings(this.settings);
		familyGraph.ensureCacheLoaded();

		// Get all events
		let events = eventService.getAllEvents();

		// Apply filters
		events = this.applyFilters(events, options);

		// Convert to timeline entries
		const entries: TimelineEntry[] = events.map(event =>
			this.eventToTimelineEntry(event, familyGraph)
		);

		// Sort chronologically
		entries.sort((a, b) => a.sortDate.localeCompare(b.sortDate));

		// Calculate summary
		const participantSet = new Set<string>();
		const placeSet = new Set<string>();
		for (const entry of entries) {
			for (const p of entry.participants) {
				participantSet.add(p.crId);
			}
			if (entry.placeCrId) {
				placeSet.add(entry.placeCrId);
			}
		}

		const summary = {
			eventCount: entries.length,
			participantCount: participantSet.size,
			placeCount: placeSet.size
		};

		// Determine date range
		const dateRange: { from?: string; to?: string } = {};
		if (entries.length > 0) {
			dateRange.from = entries[0].date || entries[0].sortDate;
			dateRange.to = entries[entries.length - 1].date || entries[entries.length - 1].sortDate;
		}

		// Group entries if requested
		let groupedEntries: Record<string, TimelineEntry[]> | undefined;
		if (options.grouping !== 'none') {
			groupedEntries = this.groupEntries(entries, options.grouping);
		}

		// Determine format (default to markdown_table for backwards compatibility)
		const format: TimelineExportFormat = options.format || 'markdown_table';

		// Generate content based on format
		const content = await this.generateContent(
			format,
			events,
			dateRange,
			summary,
			entries,
			groupedEntries,
			options
		);

		const date = new Date().toISOString().split('T')[0];
		const suggestedFilename = this.getSuggestedFilename(format, date);

		return {
			success: true,
			content,
			suggestedFilename,
			stats: {
				peopleCount: participantSet.size,
				eventsCount: entries.length,
				sourcesCount: 0
			},
			warnings,
			dateRange,
			summary,
			entries,
			groupedEntries
		};
	}

	/**
	 * Export timeline to Obsidian Canvas format
	 *
	 * This creates a visual canvas file with positioned event nodes.
	 */
	async exportToCanvas(options: TimelineReportOptions): Promise<TimelineVisualExportResult> {
		logger.info('exportToCanvas', 'Exporting timeline to Canvas', { options });

		// Initialize services
		const eventService = new EventService(this.app, this.settings);

		// Get all events
		let events = eventService.getAllEvents();

		// Apply filters
		events = this.applyFilters(events, options);

		if (events.length === 0) {
			return { success: false, error: 'No events to export after filtering' };
		}

		// Build canvas options from report options
		const canvasOptions: TimelineCanvasOptions = {
			title: 'Timeline Report',
			colorScheme: options.canvasOptions?.colorScheme || 'event_type',
			layoutStyle: options.canvasOptions?.layoutStyle || 'horizontal',
			nodeWidth: options.canvasOptions?.nodeWidth || 200,
			nodeHeight: options.canvasOptions?.nodeHeight || 100,
			spacingX: options.canvasOptions?.spacingX || 50,
			spacingY: options.canvasOptions?.spacingY || 50,
			includeOrderingEdges: options.canvasOptions?.includeOrderingEdges ?? true,
			groupByPerson: options.grouping === 'by_person',
			filterGroup: options.groupFilter
		};

		// Convert person filter CR IDs to wikilinks if needed
		if (options.personFilter && options.personFilter.length > 0) {
			// Use first person for single-person filter
			canvasOptions.filterPerson = `[[${options.personFilter[0]}]]`;
		}

		// Use the existing canvas exporter
		const canvasExporter = new TimelineCanvasExporter(this.app, this.settings);
		return canvasExporter.exportToCanvas(events, canvasOptions);
	}

	/**
	 * Generate content based on the selected format
	 */
	private async generateContent(
		format: TimelineExportFormat,
		events: EventNote[],
		dateRange: { from?: string; to?: string },
		summary: { eventCount: number; participantCount: number; placeCount: number },
		entries: TimelineEntry[],
		groupedEntries: Record<string, TimelineEntry[]> | undefined,
		options: TimelineReportOptions
	): Promise<string> {
		switch (format) {
			case 'markdown_table':
				return this.generateMarkdownTable(dateRange, summary, entries, groupedEntries, options);

			case 'markdown_callout':
				return this.generateMarkdownCallout(entries, groupedEntries, options);

			case 'markdown_list':
				return this.generateMarkdownList(entries, groupedEntries, options);

			case 'markdown_dataview':
				return this.generateMarkdownDataview(options);

			case 'canvas':
				// Canvas export is handled separately - return placeholder
				// The actual canvas file is created by TimelineCanvasExporter
				return `Canvas export requested. Use exportToCanvas() for visual output.`;

			case 'excalidraw':
				// Excalidraw export is handled separately - return placeholder
				return `Excalidraw export requested. Use exportToExcalidraw() for visual output.`;

			case 'pdf':
			case 'odt':
				// PDF/ODT use the table format as base, then convert
				return this.generateMarkdownTable(dateRange, summary, entries, groupedEntries, options);

			default:
				logger.warn('generateContent', `Unknown format: ${format}, falling back to table`);
				return this.generateMarkdownTable(dateRange, summary, entries, groupedEntries, options);
		}
	}

	/**
	 * Get suggested filename based on format
	 */
	private getSuggestedFilename(format: TimelineExportFormat, date: string): string {
		const extensions: Record<TimelineExportFormat, string> = {
			markdown_table: '.md',
			markdown_callout: '.md',
			markdown_list: '.md',
			markdown_dataview: '.md',
			canvas: '.canvas',
			excalidraw: '.excalidraw.md',
			pdf: '.pdf',
			odt: '.odt'
		};
		return `Timeline Report - ${date}${extensions[format] || '.md'}`;
	}

	/**
	 * Apply filters to events
	 */
	private applyFilters(events: EventNote[], options: TimelineReportOptions): EventNote[] {
		let filtered = events;

		// Date range filter
		if (options.dateFrom) {
			filtered = filtered.filter(e => {
				if (!e.date) return false;
				const sortDate = this.extractSortDate(e.date);
				return sortDate >= options.dateFrom!;
			});
		}
		if (options.dateTo) {
			filtered = filtered.filter(e => {
				if (!e.date) return false;
				const sortDate = this.extractSortDate(e.date);
				return sortDate <= options.dateTo!;
			});
		}

		// Event type filter
		if (options.eventTypes && options.eventTypes.length > 0) {
			filtered = filtered.filter(e => options.eventTypes.includes(e.eventType));
		}

		// Person filter
		if (options.personFilter && options.personFilter.length > 0) {
			filtered = filtered.filter(e => {
				// Check if any participant matches the filter
				const participants = this.getEventParticipants(e);
				return participants.some(p => options.personFilter.includes(p));
			});
		}

		// Place filter
		if (options.placeFilter && options.placeFilter.length > 0) {
			filtered = filtered.filter(e => {
				if (!e.place) return false;
				const placeName = this.extractLinkName(e.place);
				// TODO: If includeChildPlaces, expand place hierarchy
				return options.placeFilter.includes(placeName);
			});
		}

		// Universe filter
		if (options.universeCrId) {
			filtered = filtered.filter(e => e.universe === options.universeCrId);
		}

		return filtered;
	}

	/**
	 * Get participant identifiers from an event
	 */
	private getEventParticipants(event: EventNote): string[] {
		const participants: string[] = [];
		if (event.person) {
			participants.push(this.extractLinkName(event.person));
		}
		if (event.persons) {
			for (const p of event.persons) {
				participants.push(this.extractLinkName(p));
			}
		}
		return participants;
	}

	/**
	 * Convert an EventNote to a TimelineEntry
	 */
	private eventToTimelineEntry(event: EventNote, familyGraph: FamilyGraphService): TimelineEntry {
		// Get participants
		const participants: ReportPerson[] = [];
		const participantNames = this.getEventParticipants(event);
		const allPeople = familyGraph.getAllPeople();

		for (const name of participantNames) {
			// Try to find person in graph by name
			const personNode = allPeople.find(p => p.name === name);
			if (personNode) {
				participants.push({
					crId: personNode.crId,
					name: personNode.name,
					birthDate: personNode.birthDate,
					birthPlace: personNode.birthPlace,
					deathDate: personNode.deathDate,
					deathPlace: personNode.deathPlace,
					filePath: personNode.file.path
				});
			} else {
				// Create a minimal entry
				participants.push({
					crId: '',
					name,
					filePath: ''
				});
			}
		}

		// Extract place info
		const placeName = event.place ? this.extractLinkName(event.place) : undefined;

		return {
			date: event.date || '',
			sortDate: this.extractSortDate(event.date || '') || '9999-99-99',
			type: event.eventType,
			description: event.description,
			participants,
			place: placeName,
			placeCrId: placeName, // Using name as ID for now
			sources: event.sources || []
		};
	}

	/**
	 * Group entries by the specified method
	 */
	private groupEntries(
		entries: TimelineEntry[],
		grouping: 'none' | 'by_year' | 'by_decade' | 'by_person' | 'by_place'
	): Record<string, TimelineEntry[]> {
		const grouped: Record<string, TimelineEntry[]> = {};

		for (const entry of entries) {
			let key: string;

			switch (grouping) {
				case 'by_year': {
					const year = this.extractYear(entry.sortDate);
					key = year || 'Unknown date';
					break;
				}
				case 'by_decade': {
					const year = this.extractYear(entry.sortDate);
					if (year) {
						const decade = Math.floor(parseInt(year, 10) / 10) * 10;
						key = `${decade}s`;
					} else {
						key = 'Unknown date';
					}
					break;
				}
				case 'by_person': {
					if (entry.participants.length > 0) {
						key = entry.participants[0].name;
					} else {
						key = 'Unknown participant';
					}
					break;
				}
				case 'by_place': {
					key = entry.place || 'Unknown place';
					break;
				}
				default:
					key = 'All events';
			}

			if (!grouped[key]) {
				grouped[key] = [];
			}
			grouped[key].push(entry);
		}

		return grouped;
	}

	/**
	 * Extract year from a date string
	 */
	private extractYear(date: string): string | null {
		const match = date.match(/\d{4}/);
		return match ? match[0] : null;
	}

	/**
	 * Extract a sortable date from various date formats
	 */
	private extractSortDate(date: string): string {
		if (!date) return '';

		// Already in YYYY-MM-DD format
		if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return date;
		}

		// YYYY-MM format
		if (/^\d{4}-\d{2}$/.test(date)) {
			return date + '-01';
		}

		// YYYY format
		if (/^\d{4}$/.test(date)) {
			return date + '-01-01';
		}

		// Try to extract year
		const yearMatch = date.match(/\d{4}/);
		if (yearMatch) {
			return yearMatch[0] + '-01-01';
		}

		return '';
	}

	/**
	 * Extract the name from a wikilink
	 */
	private extractLinkName(link: string): string {
		// Remove [[ and ]]
		let name = link.replace(/^\[\[/, '').replace(/\]\]$/, '');
		// Handle aliases [[Name|Alias]] - take the name part
		if (name.includes('|')) {
			name = name.split('|')[0];
		}
		return name.trim();
	}

	/**
	 * Generate markdown table content for the Timeline Report
	 */
	private generateMarkdownTable(
		dateRange: { from?: string; to?: string },
		summary: { eventCount: number; participantCount: number; placeCount: number },
		entries: TimelineEntry[],
		groupedEntries: Record<string, TimelineEntry[]> | undefined,
		options: TimelineReportOptions
	): string {
		const lines: string[] = [];
		const date = new Date().toLocaleDateString();

		// Title
		lines.push('# Timeline Report');
		lines.push('');
		lines.push(`Generated: ${date}`);
		if (dateRange.from || dateRange.to) {
			const rangeStr = [dateRange.from, dateRange.to].filter(Boolean).join(' to ');
			lines.push(`Date range: ${rangeStr}`);
		}
		lines.push('');

		// Summary
		lines.push('## Summary');
		lines.push('');
		lines.push(`- **Total events:** ${summary.eventCount}`);
		lines.push(`- **Participants:** ${summary.participantCount}`);
		lines.push(`- **Places:** ${summary.placeCount}`);
		lines.push('');

		// Events (grouped or flat)
		if (groupedEntries) {
			// Sort group keys appropriately
			const keys = Object.keys(groupedEntries).sort((a, b) => {
				// Numeric/date-based groups should sort numerically
				if (a.match(/^\d/) && b.match(/^\d/)) {
					return a.localeCompare(b);
				}
				return a.localeCompare(b);
			});

			for (const key of keys) {
				const groupEntries = groupedEntries[key];
				lines.push(`## ${key}`);
				lines.push('');
				this.renderEventTable(lines, groupEntries, options);
				lines.push('');
			}
		} else {
			lines.push('## Events');
			lines.push('');
			this.renderEventTable(lines, entries, options);
			lines.push('');
		}

		// Footer
		lines.push('---');
		lines.push('*Generated by Canvas Roots*');

		return lines.join('\n');
	}

	/**
	 * Render a table of events
	 */
	private renderEventTable(
		lines: string[],
		entries: TimelineEntry[],
		options: TimelineReportOptions
	): void {
		if (options.includeDescriptions) {
			lines.push('| Date | Event | Participants | Place | Description |');
			lines.push('|------|-------|--------------|-------|-------------|');
		} else {
			lines.push('| Date | Event | Participants | Place |');
			lines.push('|------|-------|--------------|-------|');
		}

		for (const entry of entries) {
			const date = entry.date || '';
			const type = entry.type;
			const participants = entry.participants
				.map(p => p.crId ? `[[${p.name}]]` : p.name)
				.join(', ');
			const place = entry.place ? `[[${entry.place}]]` : '';
			const description = entry.description || '';

			if (options.includeDescriptions) {
				lines.push(`| ${date} | ${type} | ${participants} | ${place} | ${description} |`);
			} else {
				lines.push(`| ${date} | ${type} | ${participants} | ${place} |`);
			}
		}
	}

	/**
	 * Generate markdown callout format (vertical timeline with year columns)
	 */
	private generateMarkdownCallout(
		entries: TimelineEntry[],
		groupedEntries: Record<string, TimelineEntry[]> | undefined,
		options: TimelineReportOptions
	): string {
		const lines: string[] = [];
		const calloutType = options.calloutOptions?.calloutType || 'cr-timeline';

		// Group by year if not already grouped
		const byYear = groupedEntries && options.grouping === 'by_year'
			? groupedEntries
			: this.groupEntries(entries, 'by_year');

		// Sort years chronologically
		const years = Object.keys(byYear).sort();

		// Outer container callout
		lines.push(`> [!cr-timeline-outer] Timeline`);
		lines.push('>');

		for (const year of years) {
			const yearEntries = byYear[year];
			// Use a color based on the most common event type in this year
			const color = this.getCalloutColorForEntries(yearEntries);

			lines.push(`>> [!${calloutType}|${color}] [[${year}]]`);

			for (const entry of yearEntries) {
				const participants = entry.participants
					.map(p => p.crId ? `[[${p.name}]]` : p.name)
					.join(', ');

				// Event title line
				lines.push(`>> - [[${entry.type}${participants ? ` of ${participants}` : ''}]]`);

				// Date line (indented)
				if (entry.date) {
					lines.push(`>> \t- (${entry.date})`);
				}

				// Place line (indented)
				if (entry.place && options.includeDescriptions) {
					lines.push(`>> \t- Location: [[${entry.place}]]`);
				}

				// Description line (indented)
				if (entry.description && options.includeDescriptions) {
					lines.push(`>> \t- ${entry.description}`);
				}
			}

			lines.push('>>');
		}

		return lines.join('\n');
	}

	/**
	 * Get callout color for a group of entries based on event types
	 */
	private getCalloutColorForEntries(entries: TimelineEntry[]): string {
		// Map event types to callout colors
		const typeColors: Record<string, string> = {
			birth: 'green',
			death: 'red',
			marriage: 'pink',
			divorce: 'orange',
			baptism: 'cyan',
			burial: 'purple',
			residence: 'blue',
			occupation: 'yellow'
		};

		// Find the most common event type
		const typeCounts: Record<string, number> = {};
		for (const entry of entries) {
			const type = entry.type.toLowerCase();
			typeCounts[type] = (typeCounts[type] || 0) + 1;
		}

		let maxCount = 0;
		let dominantType = '';
		for (const [type, count] of Object.entries(typeCounts)) {
			if (count > maxCount) {
				maxCount = count;
				dominantType = type;
			}
		}

		return typeColors[dominantType] || 'blue';
	}

	/**
	 * Generate markdown list format (simple bullet list with year headers)
	 */
	private generateMarkdownList(
		entries: TimelineEntry[],
		groupedEntries: Record<string, TimelineEntry[]> | undefined,
		options: TimelineReportOptions
	): string {
		const lines: string[] = [];
		const date = new Date().toLocaleDateString();

		// Title
		lines.push('# Timeline');
		lines.push('');
		lines.push(`Generated: ${date}`);
		lines.push('');

		// Use grouping if specified, otherwise group by year
		const grouped = groupedEntries || this.groupEntries(entries, 'by_year');
		const keys = Object.keys(grouped).sort();

		for (const key of keys) {
			const groupEntries = grouped[key];

			// Section header
			lines.push(`## ${key}`);
			lines.push('');

			for (const entry of groupEntries) {
				const participants = entry.participants
					.map(p => p.crId ? `[[${p.name}]]` : p.name)
					.join(', ');

				// Main bullet point
				let line = `- **${entry.type}**`;
				if (participants) {
					line += `: ${participants}`;
				}
				if (entry.date) {
					line += ` (${entry.date})`;
				}
				lines.push(line);

				// Sub-bullets for additional info
				if (entry.place) {
					lines.push(`  - Location: [[${entry.place}]]`);
				}
				if (entry.description && options.includeDescriptions) {
					lines.push(`  - ${entry.description}`);
				}
				if (options.includeSources && entry.sources.length > 0) {
					lines.push(`  - Sources: ${entry.sources.join(', ')}`);
				}
			}

			lines.push('');
		}

		return lines.join('\n');
	}

	/**
	 * Generate markdown Dataview query format
	 */
	private generateMarkdownDataview(options: TimelineReportOptions): string {
		const lines: string[] = [];

		lines.push('# Timeline (Dataview)');
		lines.push('');
		lines.push('This timeline updates automatically based on your event notes.');
		lines.push('');

		// Build the Dataview query
		lines.push('```dataview');
		lines.push('TABLE WITHOUT ID');
		lines.push('  date as "Date",');
		lines.push('  event_type as "Event",');
		lines.push('  person as "Person",');
		lines.push('  place as "Place"');
		lines.push('FROM ""');
		lines.push('WHERE cr_type = "event"');

		// Add filters if specified
		if (options.eventTypes && options.eventTypes.length > 0) {
			const types = options.eventTypes.map(t => `"${t}"`).join(', ');
			lines.push(`  AND contains([${types}], event_type)`);
		}

		if (options.personFilter && options.personFilter.length > 0) {
			// Person filter - check if person field contains any of the filtered people
			const people = options.personFilter.map(p => `"${p}"`).join(', ');
			lines.push(`  AND contains([${people}], person)`);
		}

		if (options.dateFrom) {
			lines.push(`  AND date >= date("${options.dateFrom}")`);
		}

		if (options.dateTo) {
			lines.push(`  AND date <= date("${options.dateTo}")`);
		}

		// Sorting
		lines.push('SORT date ASC');

		// Grouping
		if (options.grouping === 'by_year') {
			lines.push('GROUP BY dateformat(date, "yyyy")');
		} else if (options.grouping === 'by_decade') {
			lines.push('GROUP BY floor(year(date) / 10) * 10');
		} else if (options.grouping === 'by_person') {
			lines.push('GROUP BY person');
		} else if (options.grouping === 'by_place') {
			lines.push('GROUP BY place');
		}

		lines.push('```');
		lines.push('');
		lines.push('> [!note] Requirements');
		lines.push('> This query requires the [Dataview](https://github.com/blacksmithgu/obsidian-dataview) plugin.');

		return lines.join('\n');
	}
}
