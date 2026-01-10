/**
 * Person Timeline Component
 *
 * Displays a chronological timeline of events for a specific person.
 * Used in the Control Center People tab as an expandable section.
 */

import { App, TFile } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import { createLucideIcon } from '../../ui/lucide-icons';
import { EventService } from '../services/event-service';
import { EventNote, getEventType, DATE_PRECISION_LABELS } from '../types/event-types';
import { formatDisplayDate } from '../../dates';

/**
 * Extract unique calendar/date system values from events
 * Returns sorted array of calendar names, with undefined values grouped as "Unknown"
 */
function getUniqueCalendars(events: EventNote[]): string[] {
	const calendars = new Set<string>();
	for (const event of events) {
		if (event.dateSystem) {
			calendars.add(event.dateSystem);
		}
	}
	return Array.from(calendars).sort();
}

/**
 * Sort events chronologically
 * Events with dates come first (sorted by date), then events without dates
 */
function sortEventsChronologically(events: EventNote[]): EventNote[] {
	return events.sort((a, b) => {
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
}

/**
 * Format date for display with precision indicator
 */
function formatDateForDisplay(event: EventNote): string {
	if (!event.date) {
		return 'Date unknown';
	}

	let dateStr = formatDisplayDate(event.date);

	// Add end date for ranges
	if (event.dateEnd) {
		dateStr += ` – ${formatDisplayDate(event.dateEnd)}`;
	}

	// Add precision indicator if not exact and not already shown in the formatted date
	// Skip if the date format already conveys the precision (e.g., "c. 1878" for approximate)
	const hasQualifier = /^(c\.|before|after|\d{4}–\d{4})/.test(dateStr);
	if (!hasQualifier && event.datePrecision && event.datePrecision !== 'exact') {
		const precisionLabel = DATE_PRECISION_LABELS[event.datePrecision];
		if (precisionLabel && precisionLabel !== 'Exact date') {
			dateStr += ` (${precisionLabel.toLowerCase()})`;
		}
	}

	return dateStr;
}

/**
 * Render a person's timeline into a container
 */
export function renderPersonTimeline(
	container: HTMLElement,
	personFile: TFile,
	personName: string,
	app: App,
	settings: CanvasRootsSettings,
	eventService: EventService,
	options?: {
		maxEvents?: number;
		showEmptyState?: boolean;
		onEventClick?: (event: EventNote) => void;
	}
): void {
	container.empty();
	container.addClass('crc-person-timeline');

	// Get events for this person using wikilink format
	const personLink = `[[${personFile.basename}]]`;
	const allEvents = eventService.getEventsForPerson(personLink);

	// Empty state
	if (allEvents.length === 0) {
		if (options?.showEmptyState !== false) {
			const emptyState = container.createDiv({ cls: 'crc-person-timeline__empty' });
			emptyState.createEl('p', {
				text: 'No events recorded.',
				cls: 'crc-text--muted'
			});
		}
		return;
	}

	// Check if we have multiple calendars
	const calendars = getUniqueCalendars(allEvents);
	let selectedCalendar: string | null = null;

	// Render the timeline with optional filter
	const renderTimeline = () => {
		// Clear existing content (but keep filter if it exists)
		const existingTimeline = container.querySelector('.crc-person-timeline__list');
		const existingMore = container.querySelector('.crc-person-timeline__more');
		if (existingTimeline) existingTimeline.remove();
		if (existingMore) existingMore.remove();

		// Filter events by selected calendar
		const filteredEvents = selectedCalendar
			? allEvents.filter(e => e.dateSystem === selectedCalendar)
			: allEvents;

		// Sort chronologically
		const sortedEvents = sortEventsChronologically(filteredEvents);

		// Apply max limit if specified
		const displayEvents = options?.maxEvents
			? sortedEvents.slice(0, options.maxEvents)
			: sortedEvents;

		// Empty state after filtering
		if (displayEvents.length === 0) {
			const emptyState = container.createDiv({ cls: 'crc-person-timeline__list' });
			emptyState.createEl('p', {
				text: selectedCalendar
					? `No events found for calendar "${selectedCalendar}".`
					: 'No events recorded.',
				cls: 'crc-text--muted'
			});
			return;
		}

		// Timeline container
		const timeline = container.createDiv({ cls: 'crc-person-timeline__list' });

		// Render each event
		for (const event of displayEvents) {
			renderTimelineEvent(timeline, event, app, settings, options?.onEventClick);
		}

		// Show "more" indicator if truncated
		if (options?.maxEvents && sortedEvents.length > options.maxEvents) {
			const moreIndicator = container.createDiv({ cls: 'crc-person-timeline__more' });
			moreIndicator.createEl('span', {
				text: `+ ${sortedEvents.length - options.maxEvents} more events`,
				cls: 'crc-text--muted'
			});
		}
	};

	// Add calendar filter dropdown if multiple calendars exist
	if (calendars.length > 1) {
		const filterContainer = container.createDiv({ cls: 'crc-person-timeline__filter' });

		const filterLabel = filterContainer.createEl('label', {
			cls: 'crc-timeline-filter-label'
		});
		const calendarIcon = createLucideIcon('calendar', 14);
		filterLabel.appendChild(calendarIcon);
		filterLabel.appendText(' Calendar:');

		const filterSelect = filterContainer.createEl('select', { cls: 'crc-timeline-filter' });
		filterSelect.createEl('option', { text: 'All calendars', attr: { value: '' } });

		for (const calendar of calendars) {
			const eventsInCalendar = allEvents.filter(e => e.dateSystem === calendar).length;
			filterSelect.createEl('option', {
				text: `${calendar} (${eventsInCalendar})`,
				attr: { value: calendar }
			});
		}

		filterSelect.addEventListener('change', () => {
			selectedCalendar = filterSelect.value || null;
			renderTimeline();
		});
	}

	// Initial render
	renderTimeline();
}

/**
 * Render a single timeline event
 */
function renderTimelineEvent(
	container: HTMLElement,
	event: EventNote,
	app: App,
	settings: CanvasRootsSettings,
	onEventClick?: (event: EventNote) => void
): void {
	const eventType = getEventType(
		event.eventType,
		settings.customEventTypes || [],
		settings.showBuiltInEventTypes !== false
	);

	const item = container.createDiv({ cls: 'crc-timeline-event' });

	// Timeline connector (vertical line + node)
	const connector = item.createDiv({ cls: 'crc-timeline-event__connector' });

	// Node with icon
	const node = connector.createDiv({ cls: 'crc-timeline-event__node' });
	if (eventType) {
		node.setCssProps({ '--event-color': eventType.color });
		const icon = createLucideIcon(eventType.icon, 14);
		node.appendChild(icon);
	} else {
		// Default for custom/unknown types
		const icon = createLucideIcon('calendar', 14);
		node.appendChild(icon);
	}

	// Event content
	const content = item.createDiv({ cls: 'crc-timeline-event__content' });

	// Date row
	const dateRow = content.createDiv({ cls: 'crc-timeline-event__date' });
	dateRow.createEl('span', {
		text: formatDateForDisplay(event),
		cls: event.date ? '' : 'crc-text--muted'
	});

	// Title row (clickable)
	const titleRow = content.createDiv({ cls: 'crc-timeline-event__title' });
	const titleLink = titleRow.createEl('a', {
		text: event.title,
		cls: 'crc-timeline-event__link'
	});

	titleLink.addEventListener('click', (e) => {
		e.preventDefault();
		if (onEventClick) {
			onEventClick(event);
		} else {
			// Default: open the event file
			void app.workspace.getLeaf(false).openFile(event.file);
		}
	});

	// Event type label
	if (eventType) {
		titleRow.createEl('span', {
			text: eventType.name,
			cls: 'crc-timeline-event__type',
			attr: {
				style: `color: ${eventType.color}`
			}
		});
	}

	// Details row (place, sources)
	const details: string[] = [];

	if (event.place) {
		// Strip wikilink brackets for display
		const placeName = event.place.replace(/^\[\[/, '').replace(/\]\]$/, '');
		details.push(placeName);
	}

	if (event.sources && event.sources.length > 0) {
		const sourceCount = event.sources.length;
		details.push(`${sourceCount} source${sourceCount !== 1 ? 's' : ''}`);
	}

	if (details.length > 0) {
		const detailsRow = content.createDiv({ cls: 'crc-timeline-event__details' });
		detailsRow.createEl('span', {
			text: details.join(' • '),
			cls: 'crc-text--muted'
		});
	}

	// Confidence indicator for low/unknown confidence
	if (event.confidence === 'low' || event.confidence === 'unknown') {
		const warningRow = content.createDiv({ cls: 'crc-timeline-event__warning' });
		const warningIcon = createLucideIcon('alert-triangle', 12);
		warningRow.appendChild(warningIcon);
		warningRow.appendText(event.confidence === 'low' ? 'Low confidence' : 'Confidence unknown');
	}

	// No sources warning
	if (!event.sources || event.sources.length === 0) {
		const noSourceRow = content.createDiv({ cls: 'crc-timeline-event__warning' });
		const infoIcon = createLucideIcon('info', 12);
		noSourceRow.appendChild(infoIcon);
		noSourceRow.appendText('No sources');
	}
}

/**
 * Create a compact timeline summary for inline display
 * Returns a fragment with event count and date range
 */
export function createTimelineSummary(
	events: EventNote[]
): { count: number; dateRange: string } {
	if (events.length === 0) {
		return { count: 0, dateRange: '' };
	}

	const sorted = sortEventsChronologically(events);
	const datedEvents = sorted.filter(e => e.date);

	let dateRange = '';
	if (datedEvents.length > 0) {
		const firstDate = datedEvents[0].date!;
		const lastDate = datedEvents[datedEvents.length - 1].date!;
		if (firstDate === lastDate) {
			dateRange = firstDate;
		} else {
			dateRange = `${firstDate} – ${lastDate}`;
		}
	}

	return { count: events.length, dateRange };
}
