/**
 * Timeline Markdown Exporter
 *
 * Exports event timelines to styled markdown using nested callouts.
 * Compatible with the Charted Roots timeline callout CSS.
 *
 * Output format:
 * > [!cr-timeline-outer] Timeline Title
 * >
 * >> [!cr-timeline|green] [[1850]]
 * >> - [[Birth of John Smith]]
 * >> 	- (March 15, 1850)
 * >> 	- Dublin, Ireland
 */

import { App, TFile, normalizePath } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import { getLogger } from '../../core/logging';
import { ensureFolderExists, toSafeFilename } from '../../core/canvas-utils';
import { EventNote, getEventType } from '../types/event-types';

const logger = getLogger('TimelineMarkdownExporter');

/**
 * Extract year from a date string
 */
function extractYear(dateStr: string): number | null {
	const match = dateStr.match(/^(\d{4})/);
	return match ? parseInt(match[1]) : null;
}

/**
 * Sort events chronologically with topological sort for before/after constraints
 */
function sortEventsChronologically(events: EventNote[]): EventNote[] {
	// First, sort by date
	const byDate = [...events].sort((a, b) => {
		// Events with sortOrder use that first
		if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
			return a.sortOrder - b.sortOrder;
		}
		if (a.sortOrder !== undefined) return -1;
		if (b.sortOrder !== undefined) return 1;

		// Then sort by date
		if (a.date && b.date) {
			return a.date.localeCompare(b.date);
		}
		if (a.date) return -1;
		if (b.date) return 1;

		// Finally sort by title
		return a.title.localeCompare(b.title);
	});

	// Build dependency graph for before/after constraints
	const eventByCrId = new Map<string, EventNote>();
	const eventByPath = new Map<string, EventNote>();

	for (const event of events) {
		eventByCrId.set(event.crId, event);
		eventByPath.set(event.filePath, event);
	}

	// Simple topological adjustment: events with 'after' constraints should come after
	// their referenced events. This is a simple heuristic, not full topological sort.
	const result: EventNote[] = [];
	const added = new Set<string>();

	function addEvent(event: EventNote): void {
		if (added.has(event.crId)) return;

		// First add any events this one should come after
		if (event.after) {
			for (const afterRef of event.after) {
				const refPath = afterRef.replace(/^\[\[/, '').replace(/\]\]$/, '');
				const afterEvent = eventByPath.get(refPath) || eventByPath.get(refPath + '.md');
				if (afterEvent && !added.has(afterEvent.crId)) {
					addEvent(afterEvent);
				}
			}
		}

		result.push(event);
		added.add(event.crId);
	}

	for (const event of byDate) {
		addEvent(event);
	}

	return result;
}

/**
 * Export format types
 */
export type TimelineExportFormat = 'callout' | 'table' | 'list' | 'dataview';

/**
 * Options for markdown timeline export
 */
export interface TimelineMarkdownOptions {
	/** Title for the timeline */
	title?: string;
	/** Export format (default: 'callout') */
	format?: TimelineExportFormat;
	/** Filter by person (wikilink) */
	filterPerson?: string;
	/** Filter by event type */
	filterEventType?: string;
	/** Filter by group/faction */
	filterGroup?: string;
	/** Group events by year (default: true) */
	groupByYear?: boolean;
	/** Include place information */
	includePlaces?: boolean;
	/** Include source count */
	includeSources?: boolean;
	/** Use multi-column layout for events within a year */
	multiColumn?: boolean;
	/** Columns to include in table format */
	tableColumns?: ('year' | 'date' | 'event' | 'persons' | 'place' | 'sources')[];
}

/**
 * Result of a markdown export operation
 */
export interface TimelineMarkdownResult {
	success: boolean;
	path?: string;
	error?: string;
	warnings?: string[];
}

/**
 * Map event type to timeline callout color
 * Colors match the CSS snippet: red, orange, yellow, green, cyan, blue, purple, pink
 */
function eventTypeToCalloutColor(eventType: string): string {
	// Get the event type definition
	const typeDef = getEventType(eventType);
	if (!typeDef) return 'blue'; // default

	// Map hex colors to named colors for the callout metadata
	const hex = typeDef.color.toLowerCase();

	// Green tones → green
	if (hex.includes('4ade80') || hex.includes('22c55e') || hex.includes('10b981')) {
		return 'green';
	}
	// Gray tones → gray (not in standard set, will need CSS override)
	if (hex.includes('6b7280') || hex.includes('9ca3af')) {
		return 'bright-gray';
	}
	// Pink tones → pink
	if (hex.includes('f472b6') || hex.includes('ec4899') || hex.includes('db2777')) {
		return 'pink';
	}
	// Red tones → red
	if (hex.includes('ef4444') || hex.includes('dc2626') || hex.includes('f87171')) {
		return 'red';
	}
	// Blue tones → blue
	if (hex.includes('3b82f6') || hex.includes('2563eb') || hex.includes('60a5fa')) {
		return 'blue';
	}
	// Cyan/Teal tones → cyan
	if (hex.includes('06b6d4') || hex.includes('14b8a6') || hex.includes('22d3ee')) {
		return 'cyan';
	}
	// Purple/Violet tones → purple
	if (hex.includes('a855f7') || hex.includes('8b5cf6') || hex.includes('7c3aed')) {
		return 'purple';
	}
	// Orange/Amber tones → orange
	if (hex.includes('f59e0b') || hex.includes('f97316') || hex.includes('fb923c')) {
		return 'orange';
	}
	// Yellow tones → yellow
	if (hex.includes('eab308') || hex.includes('facc15') || hex.includes('fde047')) {
		return 'yellow';
	}

	// Default based on category
	switch (typeDef.category) {
		case 'vital':
			return 'green';
		case 'life':
			return 'blue';
		case 'narrative':
			return 'purple';
		default:
			return 'orange';
	}
}

/**
 * Format a date for display
 */
function formatDate(date: string | undefined, precision: string | undefined): string {
	if (!date) return '';

	// Already formatted dates (e.g., "March 15, 1850")
	if (date.includes(',')) return date;

	// ISO format dates
	const parts = date.split('-');
	if (parts.length === 3) {
		const [year, month, day] = parts;
		const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
			'July', 'August', 'September', 'October', 'November', 'December'];
		const monthIndex = parseInt(month, 10) - 1;
		if (monthIndex >= 0 && monthIndex < 12) {
			return `${monthNames[monthIndex]} ${parseInt(day, 10)}, ${year}`;
		}
	}

	// Return as-is for non-standard formats (fictional dates, etc.)
	return date;
}

/**
 * Extract the filename from a path for display
 */
function extractFilename(path: string): string {
	const parts = path.split('/');
	const filename = parts[parts.length - 1];
	return filename.replace(/\.md$/, '');
}

/**
 * Escape pipe characters in a string for use in markdown table cells
 * Pipes (|) are used as column delimiters, so they need to be escaped
 */
function escapeTableCell(text: string): string {
	return text.replace(/\|/g, '\\|');
}

/**
 * Extract person name from a wikilink
 * Handles both [[Name]] and [[path/to/Name|Display Name]]
 */
function extractPersonName(wikilink: string): string {
	// Remove [[ and ]]
	const inner = wikilink.replace(/^\[\[/, '').replace(/\]\]$/, '');
	// Check for alias (display name after |)
	if (inner.includes('|')) {
		return inner.split('|')[1];
	}
	// Get filename without path
	const parts = inner.split('/');
	return parts[parts.length - 1];
}

/**
 * Format event display with separate links for event type and people
 * e.g., "Marriage of [[Matthew Marvin]] and [[Elizabeth Gregory]]"
 */
function formatEventDisplay(event: EventNote): string {
	const eventFile = extractFilename(event.filePath);
	const eventType = event.eventType;

	// Get the event type definition for display name
	const typeDef = getEventType(eventType);
	const typeLabel = typeDef?.name || eventType.charAt(0).toUpperCase() + eventType.slice(1);

	// Build the event link (just the type word links to the event)
	const eventLink = `[[${eventFile}|${typeLabel}]]`;

	// Get person links
	const personLinks: string[] = [];

	if (event.person) {
		const personName = extractPersonName(event.person);
		// Create wikilink from the person field (already a wikilink, just clean it up)
		const personPath = event.person.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0];
		personLinks.push(`[[${personPath}|${personName}]]`);
	}

	if (event.persons && event.persons.length > 0) {
		for (const p of event.persons) {
			const personName = extractPersonName(p);
			const personPath = p.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0];
			// Avoid duplicating the primary person
			const link = `[[${personPath}|${personName}]]`;
			if (!personLinks.includes(link)) {
				personLinks.push(link);
			}
		}
	}

	// Format based on number of people
	if (personLinks.length === 0) {
		// No people, just show the event title as before
		return `[[${eventFile}|${event.title || eventFile}]]`;
	} else if (personLinks.length === 1) {
		return `${eventLink} of ${personLinks[0]}`;
	} else if (personLinks.length === 2) {
		return `${eventLink} of ${personLinks[0]} and ${personLinks[1]}`;
	} else {
		// 3+ people: comma-separated with "and" before last
		const lastPerson = personLinks.pop();
		return `${eventLink} of ${personLinks.join(', ')}, and ${lastPerson}`;
	}
}

/**
 * Timeline Markdown Exporter
 */
export class TimelineMarkdownExporter {
	constructor(
		private app: App,
		private settings: CanvasRootsSettings
	) {}

	/**
	 * Export events to a markdown file with timeline callout structure
	 */
	async exportToMarkdown(
		events: EventNote[],
		options: TimelineMarkdownOptions = {}
	): Promise<TimelineMarkdownResult> {
		const {
			title = 'Event Timeline',
			filterPerson,
			filterEventType,
			filterGroup,
			groupByYear = true,
			includePlaces = true,
			includeSources = true,
			multiColumn = false
		} = options;

		const warnings: string[] = [];

		try {
			// Filter events
			let filteredEvents = [...events];

			if (filterPerson) {
				filteredEvents = filteredEvents.filter(e =>
					e.person === filterPerson ||
					(e.persons && e.persons.includes(filterPerson))
				);
			}

			if (filterEventType) {
				filteredEvents = filteredEvents.filter(e => e.eventType === filterEventType);
			}

			if (filterGroup) {
				filteredEvents = filteredEvents.filter(e =>
					e.groups && e.groups.includes(filterGroup)
				);
			}

			if (filteredEvents.length === 0) {
				return { success: false, error: 'No events to export after filtering' };
			}

			// Sort events chronologically
			const sortedEvents = sortEventsChronologically(filteredEvents);

			// Group by year if requested
			const eventsByYear = new Map<number | string, EventNote[]>();

			if (groupByYear) {
				for (const event of sortedEvents) {
					const year = event.date ? extractYear(event.date) : null;
					const key = year !== null ? year : 'undated';

					if (!eventsByYear.has(key)) {
						eventsByYear.set(key, []);
					}
					eventsByYear.get(key)!.push(event);
				}
			} else {
				// All events in one group
				eventsByYear.set('all', sortedEvents);
			}

			// Build markdown content
			const lines: string[] = [];

			// Outer timeline callout
			lines.push(`> [!cr-timeline-outer] ${title}`);
			lines.push('>');

			// Sort years
			const sortedYears = [...eventsByYear.keys()].sort((a, b) => {
				if (a === 'undated') return 1;
				if (b === 'undated') return -1;
				if (a === 'all' || b === 'all') return 0;
				return (a as number) - (b as number);
			});

			for (const yearKey of sortedYears) {
				const yearEvents = eventsByYear.get(yearKey)!;
				const yearLabel = yearKey === 'undated' ? 'Undated' :
					yearKey === 'all' ? '' : String(yearKey);

				// Determine color for the year group (use first event's type)
				const firstEvent = yearEvents[0];
				const color = eventTypeToCalloutColor(firstEvent.eventType);

				// Year callout
				if (groupByYear && yearLabel) {
					lines.push(`>> [!cr-timeline|${color}] [[${yearLabel}]]`);
				} else {
					lines.push(`>> [!cr-timeline|${color}]`);
				}

				// Events within the year
				const useMultiColumn = multiColumn && yearEvents.length > 1;
				for (let i = 0; i < yearEvents.length; i++) {
					const event = yearEvents[i];
					const eventDisplay = formatEventDisplay(event);

					// Add MCL list-column tag to first item only
					const mclTag = (useMultiColumn && i === 0) ? ' #mcl/list-column' : '';
					lines.push(`>> - ${eventDisplay}${mclTag}`);

					// Date detail (if we have more precision than just year)
					if (event.date && event.datePrecision !== 'year' && event.datePrecision !== 'decade') {
						const formattedDate = formatDate(event.date, event.datePrecision);
						if (formattedDate && formattedDate !== yearLabel) {
							lines.push(`>> \t- (${formattedDate})`);
						}
					}

					// Place
					if (includePlaces && event.place) {
						const placeLink = event.place.startsWith('[[') ? event.place : `[[${event.place}]]`;
						lines.push(`>> \t- ${placeLink}`);
					}

					// Source count
					if (includeSources && event.sources && event.sources.length > 0) {
						const sourceCount = event.sources.length;
						lines.push(`>> \t- ${sourceCount} source${sourceCount > 1 ? 's' : ''}`);
					}
				}

				lines.push('>');
			}

			// Generate markdown content
			const content = lines.join('\n');

			// Write file
			const folder = this.settings.timelinesFolder || this.settings.eventsFolder || 'Charted Roots/Timelines';
			await ensureFolderExists(this.app, folder);

			const filename = `${toSafeFilename(title)}.md`;
			const path = normalizePath(`${folder}/${filename}`);

			// Check for existing file
			const existingFile = this.app.vault.getAbstractFileByPath(path);

			if (existingFile instanceof TFile) {
				await this.app.vault.modify(existingFile, content);
				logger.info('exportToMarkdown', `Updated existing timeline: ${path}`);
			} else {
				await this.app.vault.create(path, content);
				logger.info('exportToMarkdown', `Created new timeline: ${path}`);
			}

			return {
				success: true,
				path,
				warnings: warnings.length > 0 ? warnings : undefined
			};

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error('exportToMarkdown', 'Failed to export timeline', error);
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Get export summary for preview
	 */
	getExportSummary(
		events: EventNote[],
		options: TimelineMarkdownOptions = {}
	): {
		totalEvents: number;
		datedEvents: number;
		undatedEvents: number;
		uniqueYears: number;
		uniquePeople: number;
		uniquePlaces: number;
	} {
		const { filterPerson, filterEventType, filterGroup } = options;

		// Filter events
		let filteredEvents = [...events];

		if (filterPerson) {
			filteredEvents = filteredEvents.filter(e =>
				e.person === filterPerson ||
				(e.persons && e.persons.includes(filterPerson))
			);
		}

		if (filterEventType) {
			filteredEvents = filteredEvents.filter(e => e.eventType === filterEventType);
		}

		if (filterGroup) {
			filteredEvents = filteredEvents.filter(e =>
				e.groups && e.groups.includes(filterGroup)
			);
		}

		const years = new Set<number>();
		const people = new Set<string>();
		const places = new Set<string>();
		let datedEvents = 0;
		let undatedEvents = 0;

		for (const event of filteredEvents) {
			const year = event.date ? extractYear(event.date) : null;
			if (year !== null) {
				years.add(year);
				datedEvents++;
			} else {
				undatedEvents++;
			}

			if (event.person) people.add(event.person);
			if (event.persons) {
				for (const p of event.persons) people.add(p);
			}
			if (event.place) places.add(event.place);
		}

		return {
			totalEvents: filteredEvents.length,
			datedEvents,
			undatedEvents,
			uniqueYears: years.size,
			uniquePeople: people.size,
			uniquePlaces: places.size
		};
	}

	/**
	 * Get the date range from a list of events
	 */
	getDateRange(events: EventNote[]): { earliest: number | null; latest: number | null } {
		let earliest: number | null = null;
		let latest: number | null = null;

		for (const event of events) {
			const year = event.date ? extractYear(event.date) : null;
			if (year !== null) {
				if (earliest === null || year < earliest) earliest = year;
				if (latest === null || year > latest) latest = year;
			}
		}

		return { earliest, latest };
	}

	/**
	 * Export events to a markdown table
	 */
	async exportToTable(
		events: EventNote[],
		options: TimelineMarkdownOptions = {}
	): Promise<TimelineMarkdownResult> {
		const {
			title = 'Event Timeline',
			filterPerson,
			filterEventType,
			filterGroup,
			includePlaces = true,
			includeSources = true,
			tableColumns = ['year', 'event', 'persons', 'place', 'sources']
		} = options;

		try {
			// Filter events
			const filteredEvents = this.filterEvents(events, { filterPerson, filterEventType, filterGroup });

			if (filteredEvents.length === 0) {
				return { success: false, error: 'No events to export after filtering' };
			}

			// Sort events chronologically
			const sortedEvents = sortEventsChronologically(filteredEvents);

			// Build markdown content
			const lines: string[] = [];

			// Title
			lines.push(`# ${title}`);
			lines.push('');

			// Determine which columns to include
			const cols = tableColumns.filter(col => {
				if (col === 'place' && !includePlaces) return false;
				if (col === 'sources' && !includeSources) return false;
				return true;
			});

			// Table header
			const headerMap: Record<string, string> = {
				year: 'Year',
				date: 'Date',
				event: 'Event',
				persons: 'Person(s)',
				place: 'Place',
				sources: 'Sources'
			};
			const header = cols.map(col => headerMap[col]).join(' | ');
			lines.push(`| ${header} |`);
			lines.push(`| ${cols.map(() => '---').join(' | ')} |`);

			// Table rows
			for (const event of sortedEvents) {
				const row: string[] = [];

				for (const col of cols) {
					switch (col) {
						case 'year': {
							const year = event.date ? extractYear(event.date) : null;
							row.push(year !== null ? String(year) : '—');
							break;
						}
						case 'date': {
							const formatted = formatDate(event.date, event.datePrecision);
							row.push(formatted || '—');
							break;
						}
						case 'event': {
							// Escape pipes in wikilink aliases for table compatibility
							row.push(escapeTableCell(formatEventDisplay(event)));
							break;
						}
						case 'persons': {
							const persons = this.getPersonLinks(event);
							// Escape pipes in wikilink aliases for table compatibility
							row.push(persons.length > 0 ? escapeTableCell(persons.join(', ')) : '—');
							break;
						}
						case 'place': {
							if (event.place) {
								const placeLink = event.place.startsWith('[[') ? event.place : `[[${event.place}]]`;
								// Escape pipes in wikilink aliases for table compatibility
								row.push(escapeTableCell(placeLink));
							} else {
								row.push('—');
							}
							break;
						}
						case 'sources': {
							const count = event.sources?.length || 0;
							row.push(count > 0 ? String(count) : '—');
							break;
						}
					}
				}

				lines.push(`| ${row.join(' | ')} |`);
			}

			// Write file
			const content = lines.join('\n');
			return this.writeExportFile(title, content);

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error('exportToTable', 'Failed to export timeline table', error);
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Export events to a simple markdown list
	 */
	async exportToList(
		events: EventNote[],
		options: TimelineMarkdownOptions = {}
	): Promise<TimelineMarkdownResult> {
		const {
			title = 'Event Timeline',
			filterPerson,
			filterEventType,
			filterGroup,
			groupByYear = true,
			includePlaces = true
		} = options;

		try {
			// Filter events
			const filteredEvents = this.filterEvents(events, { filterPerson, filterEventType, filterGroup });

			if (filteredEvents.length === 0) {
				return { success: false, error: 'No events to export after filtering' };
			}

			// Sort events chronologically
			const sortedEvents = sortEventsChronologically(filteredEvents);

			// Build markdown content
			const lines: string[] = [];

			// Title
			lines.push(`# ${title}`);
			lines.push('');

			if (groupByYear) {
				// Group by year
				const eventsByYear = new Map<number | string, EventNote[]>();

				for (const event of sortedEvents) {
					const year = event.date ? extractYear(event.date) : null;
					const key = year !== null ? year : 'undated';

					if (!eventsByYear.has(key)) {
						eventsByYear.set(key, []);
					}
					eventsByYear.get(key)!.push(event);
				}

				// Sort years
				const sortedYears = [...eventsByYear.keys()].sort((a, b) => {
					if (a === 'undated') return 1;
					if (b === 'undated') return -1;
					return (a as number) - (b as number);
				});

				for (const yearKey of sortedYears) {
					const yearEvents = eventsByYear.get(yearKey)!;
					const yearLabel = yearKey === 'undated' ? 'Undated' : String(yearKey);

					lines.push(`## ${yearLabel}`);
					lines.push('');

					for (const event of yearEvents) {
						let line = `- ${formatEventDisplay(event)}`;
						if (includePlaces && event.place) {
							const placeLink = event.place.startsWith('[[') ? event.place : `[[${event.place}]]`;
							line += ` — ${placeLink}`;
						}
						lines.push(line);
					}
					lines.push('');
				}
			} else {
				// Flat list
				for (const event of sortedEvents) {
					const year = event.date ? extractYear(event.date) : null;
					const yearStr = year !== null ? `**${year}** — ` : '';
					let line = `- ${yearStr}${formatEventDisplay(event)}`;
					if (includePlaces && event.place) {
						const placeLink = event.place.startsWith('[[') ? event.place : `[[${event.place}]]`;
						line += ` — ${placeLink}`;
					}
					lines.push(line);
				}
			}

			// Write file
			const content = lines.join('\n');
			return this.writeExportFile(title, content);

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error('exportToList', 'Failed to export timeline list', error);
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Export a Dataview query that will display the timeline
	 * Note: Requires the Dataview plugin to be installed
	 */
	async exportToDataviewQuery(
		events: EventNote[],
		options: TimelineMarkdownOptions = {}
	): Promise<TimelineMarkdownResult> {
		const {
			title = 'Event Timeline',
			filterPerson,
			filterEventType,
			filterGroup
		} = options;

		try {
			const eventsFolder = this.settings.eventsFolder || 'Charted Roots/Events';

			// Build markdown content with Dataview query
			const lines: string[] = [];

			// Title and note
			lines.push(`# ${title}`);
			lines.push('');
			lines.push('> [!note] Dynamic Timeline');
			lines.push('> This timeline uses [Dataview](https://blacksmithgu.github.io/obsidian-dataview/) to display events dynamically.');
			lines.push('> Events will update automatically as you add or modify event notes.');
			lines.push('');

			// Build WHERE clause
			const whereConditions: string[] = ['type = "event"'];

			if (filterEventType) {
				whereConditions.push(`eventType = "${filterEventType}"`);
			}

			if (filterPerson) {
				// Handle wikilink format
				const personPath = filterPerson.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0];
				whereConditions.push(`(contains(person, "${personPath}") OR contains(persons, "${personPath}"))`);
			}

			if (filterGroup) {
				const groupPath = filterGroup.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0];
				whereConditions.push(`contains(groups, "${groupPath}")`);
			}

			const whereClause = whereConditions.join(' AND ');

			// Dataview query
			lines.push('```dataview');
			lines.push('TABLE WITHOUT ID');
			lines.push('  link(file.link, eventType) as Event,');
			lines.push('  date as Date,');
			lines.push('  person as Person,');
			lines.push('  place as Place');
			lines.push(`FROM "${eventsFolder}"`);
			lines.push(`WHERE ${whereClause}`);
			lines.push('SORT date ASC');
			lines.push('```');
			lines.push('');

			// Also include a DataviewJS version for more control
			lines.push('<details>');
			lines.push('<summary>Alternative: DataviewJS version (more customizable)</summary>');
			lines.push('');
			lines.push('```dataviewjs');
			lines.push(`const events = dv.pages('"${eventsFolder}"')`);
			lines.push('  .where(p => p.type === "event")');
			if (filterEventType) {
				lines.push(`  .where(p => p.eventType === "${filterEventType}")`);
			}
			lines.push('  .sort(p => p.date, "asc");');
			lines.push('');
			lines.push('dv.table(');
			lines.push('  ["Year", "Event", "Person", "Place"],');
			lines.push('  events.map(e => [');
			lines.push('    e.date ? e.date.toString().slice(0, 4) : "—",');
			lines.push('    dv.fileLink(e.file.path, false, e.eventType),');
			lines.push('    e.person || "—",');
			lines.push('    e.place || "—"');
			lines.push('  ])');
			lines.push(');');
			lines.push('```');
			lines.push('');
			lines.push('</details>');

			// Write file
			const content = lines.join('\n');
			return this.writeExportFile(title, content);

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error('exportToDataviewQuery', 'Failed to export dataview query', error);
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Main export method that routes to the appropriate format
	 */
	async export(
		events: EventNote[],
		options: TimelineMarkdownOptions = {}
	): Promise<TimelineMarkdownResult> {
		const format = options.format || 'callout';

		switch (format) {
			case 'table':
				return this.exportToTable(events, options);
			case 'list':
				return this.exportToList(events, options);
			case 'dataview':
				return this.exportToDataviewQuery(events, options);
			case 'callout':
			default:
				return this.exportToMarkdown(events, options);
		}
	}

	/**
	 * Helper: Filter events based on options
	 */
	private filterEvents(
		events: EventNote[],
		options: Pick<TimelineMarkdownOptions, 'filterPerson' | 'filterEventType' | 'filterGroup'>
	): EventNote[] {
		const { filterPerson, filterEventType, filterGroup } = options;
		let filtered = [...events];

		if (filterPerson) {
			filtered = filtered.filter(e =>
				e.person === filterPerson ||
				(e.persons && e.persons.includes(filterPerson))
			);
		}

		if (filterEventType) {
			filtered = filtered.filter(e => e.eventType === filterEventType);
		}

		if (filterGroup) {
			filtered = filtered.filter(e =>
				e.groups && e.groups.includes(filterGroup)
			);
		}

		return filtered;
	}

	/**
	 * Helper: Get person links from an event
	 */
	private getPersonLinks(event: EventNote): string[] {
		const links: string[] = [];

		if (event.person) {
			const personName = extractPersonName(event.person);
			const personPath = event.person.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0];
			links.push(`[[${personPath}|${personName}]]`);
		}

		if (event.persons && event.persons.length > 0) {
			for (const p of event.persons) {
				const personName = extractPersonName(p);
				const personPath = p.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0];
				const link = `[[${personPath}|${personName}]]`;
				if (!links.includes(link)) {
					links.push(link);
				}
			}
		}

		return links;
	}

	/**
	 * Helper: Write export file
	 */
	private async writeExportFile(title: string, content: string): Promise<TimelineMarkdownResult> {
		const folder = this.settings.timelinesFolder || this.settings.eventsFolder || 'Charted Roots/Timelines';
		await ensureFolderExists(this.app, folder);

		const filename = `${toSafeFilename(title)}.md`;
		const path = normalizePath(`${folder}/${filename}`);

		const existingFile = this.app.vault.getAbstractFileByPath(path);

		if (existingFile instanceof TFile) {
			await this.app.vault.modify(existingFile, content);
			logger.info('writeExportFile', `Updated existing file: ${path}`);
		} else {
			await this.app.vault.create(path, content);
			logger.info('writeExportFile', `Created new file: ${path}`);
		}

		return { success: true, path };
	}
}
