/**
 * Place Timeline Component
 *
 * Displays a chronological timeline of events at a specific location.
 * Shows all events that occurred at a place, useful for tracking
 * family presence in an area over time.
 */

import { App } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import { createLucideIcon } from '../../ui/lucide-icons';
import { EventService } from '../services/event-service';
import { EventNote, getEventType, DATE_PRECISION_LABELS } from '../types/event-types';

/**
 * Sort events chronologically
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

	let dateStr = event.date;

	// Add end date for ranges
	if (event.dateEnd) {
		dateStr += ` – ${event.dateEnd}`;
	}

	// Add precision indicator if not exact
	if (event.datePrecision && event.datePrecision !== 'exact') {
		const precisionLabel = DATE_PRECISION_LABELS[event.datePrecision];
		if (precisionLabel && precisionLabel !== 'Exact date') {
			dateStr += ` (${precisionLabel.toLowerCase()})`;
		}
	}

	return dateStr;
}

/**
 * Extract year from a date string
 */
function extractYear(dateStr: string): number | null {
	const match = dateStr.match(/^(\d{4})/);
	return match ? parseInt(match[1]) : null;
}

/**
 * Get unique people from events
 */
function getUniquePeopleFromEvents(events: EventNote[]): string[] {
	const people = new Set<string>();
	for (const event of events) {
		if (event.person) {
			people.add(event.person.replace(/^\[\[/, '').replace(/\]\]$/, ''));
		}
		if (event.persons) {
			for (const p of event.persons) {
				people.add(p.replace(/^\[\[/, '').replace(/\]\]$/, ''));
			}
		}
	}
	return Array.from(people).sort();
}

/**
 * Options for rendering the place timeline
 */
export interface PlaceTimelineOptions {
	/** Maximum events to show (0 = unlimited) */
	maxEvents?: number;
	/** Whether to show the empty state */
	showEmptyState?: boolean;
	/** Callback when an event is clicked */
	onEventClick?: (event: EventNote) => void;
}

/**
 * Render a place timeline card into a container
 */
export function renderPlaceTimelineCard(
	container: HTMLElement,
	app: App,
	settings: CanvasRootsSettings,
	eventService: EventService,
	options?: {
		onPlaceSelect?: (placeName: string) => void;
	}
): void {
	container.empty();
	container.addClass('crc-place-timeline-card');

	// Get all unique places from events
	const places = eventService.getUniquePlaces();

	if (places.length === 0) {
		const emptyState = container.createDiv({ cls: 'crc-place-timeline__empty' });
		emptyState.createEl('p', {
			text: 'No events with places recorded.',
			cls: 'crc-text--muted'
		});
		return;
	}

	// Filter controls
	const filterRow = container.createDiv({ cls: 'crc-place-timeline-filters' });

	// Place dropdown
	const placeSelect = filterRow.createEl('select', { cls: 'crc-timeline-filter' });
	placeSelect.createEl('option', { text: 'Select a place...', attr: { value: '' } });

	for (const place of places) {
		const events = eventService.getEventsAtPlace(`[[${place}]]`);
		placeSelect.createEl('option', {
			text: `${place} (${events.length})`,
			attr: { value: place }
		});
	}

	// Timeline container
	const timelineContainer = container.createDiv({ cls: 'crc-place-timeline-content' });

	// Initial state
	renderPlaceSelectionPrompt(timelineContainer);

	// Handle place selection
	placeSelect.addEventListener('change', () => {
		const selectedPlace = placeSelect.value;
		if (selectedPlace) {
			renderPlaceTimeline(
				timelineContainer,
				selectedPlace,
				app,
				settings,
				eventService,
				options?.onPlaceSelect
			);
		} else {
			renderPlaceSelectionPrompt(timelineContainer);
		}
	});
}

/**
 * Render the place selection prompt
 */
function renderPlaceSelectionPrompt(container: HTMLElement): void {
	container.empty();
	const prompt = container.createDiv({ cls: 'crc-place-timeline__prompt' });
	const icon = createLucideIcon('map-pin', 24);
	prompt.appendChild(icon);
	prompt.createEl('p', {
		text: 'Select a place to view its timeline',
		cls: 'crc-text--muted'
	});
}

/**
 * Render the timeline for a specific place
 */
function renderPlaceTimeline(
	container: HTMLElement,
	placeName: string,
	app: App,
	settings: CanvasRootsSettings,
	eventService: EventService,
	onPlaceSelect?: (placeName: string) => void
): void {
	container.empty();

	// Get events for this place
	const placeLink = `[[${placeName}]]`;
	const events = eventService.getEventsAtPlace(placeLink);
	const sortedEvents = sortEventsChronologically(events);

	if (sortedEvents.length === 0) {
		const emptyState = container.createDiv({ cls: 'crc-place-timeline__empty' });
		emptyState.createEl('p', {
			text: 'No events at this location.',
			cls: 'crc-text--muted'
		});
		return;
	}

	// Summary section
	const summary = container.createDiv({ cls: 'crc-place-timeline__summary' });

	// Date range
	const datedEvents = sortedEvents.filter(e => e.date);
	if (datedEvents.length > 0) {
		const firstDate = datedEvents[0].date!;
		const lastDate = datedEvents[datedEvents.length - 1].date!;
		const dateRange = firstDate === lastDate ? firstDate : `${firstDate} – ${lastDate}`;

		summary.createEl('span', {
			text: `${sortedEvents.length} events • ${dateRange}`,
			cls: 'crc-place-timeline__summary-text'
		});
	} else {
		summary.createEl('span', {
			text: `${sortedEvents.length} events`,
			cls: 'crc-place-timeline__summary-text'
		});
	}

	// People present section
	const uniquePeople = getUniquePeopleFromEvents(sortedEvents);
	if (uniquePeople.length > 0) {
		const peopleSection = container.createDiv({ cls: 'crc-place-timeline__people' });
		const peopleIcon = createLucideIcon('users', 14);
		peopleSection.appendChild(peopleIcon);
		peopleSection.createEl('span', {
			text: `${uniquePeople.length} ${uniquePeople.length === 1 ? 'person' : 'people'}: `,
			cls: 'crc-place-timeline__people-label'
		});

		// Show first few people, then "and X more"
		const maxDisplay = 5;
		const displayPeople = uniquePeople.slice(0, maxDisplay);
		const remaining = uniquePeople.length - maxDisplay;

		peopleSection.createEl('span', {
			text: displayPeople.join(', ') + (remaining > 0 ? ` and ${remaining} more` : ''),
			cls: 'crc-place-timeline__people-list'
		});
	}

	// Family presence analysis
	renderFamilyPresenceAnalysis(container, sortedEvents);

	// Timeline list
	const timeline = container.createDiv({ cls: 'crc-place-timeline__list' });

	for (const event of sortedEvents) {
		renderPlaceTimelineEvent(timeline, event, app, settings);
	}

	// Notify callback if provided
	if (onPlaceSelect) {
		onPlaceSelect(placeName);
	}
}

/**
 * Render family presence analysis
 * Shows periods when families were present at this location
 */
function renderFamilyPresenceAnalysis(
	container: HTMLElement,
	events: EventNote[]
): void {
	// Group events by person
	const eventsByPerson = new Map<string, EventNote[]>();

	for (const event of events) {
		const people: string[] = [];
		if (event.person) {
			people.push(event.person.replace(/^\[\[/, '').replace(/\]\]$/, ''));
		}
		if (event.persons) {
			for (const p of event.persons) {
				people.push(p.replace(/^\[\[/, '').replace(/\]\]$/, ''));
			}
		}

		for (const person of people) {
			if (!eventsByPerson.has(person)) {
				eventsByPerson.set(person, []);
			}
			eventsByPerson.get(person)!.push(event);
		}
	}

	// Calculate date ranges for each person
	const presenceData: Array<{ person: string; firstYear: number | null; lastYear: number | null; eventCount: number }> = [];

	for (const [person, personEvents] of eventsByPerson) {
		const datedEvents = personEvents.filter(e => e.date);
		let firstYear: number | null = null;
		let lastYear: number | null = null;

		for (const event of datedEvents) {
			const year = extractYear(event.date!);
			if (year !== null) {
				if (firstYear === null || year < firstYear) firstYear = year;
				if (lastYear === null || year > lastYear) lastYear = year;
			}
		}

		presenceData.push({
			person,
			firstYear,
			lastYear,
			eventCount: personEvents.length
		});
	}

	// Sort by first year, then by event count
	presenceData.sort((a, b) => {
		if (a.firstYear !== null && b.firstYear !== null) {
			return a.firstYear - b.firstYear;
		}
		if (a.firstYear !== null) return -1;
		if (b.firstYear !== null) return 1;
		return b.eventCount - a.eventCount;
	});

	// Only show if there's meaningful data
	if (presenceData.length === 0 || presenceData.every(p => p.firstYear === null)) {
		return;
	}

	// Render presence bars
	const presenceSection = container.createDiv({ cls: 'crc-place-timeline__presence' });
	presenceSection.createEl('h4', {
		text: 'Family presence',
		cls: 'crc-place-timeline__presence-title'
	});

	// Find overall date range for scaling
	let minYear = Infinity;
	let maxYear = -Infinity;
	for (const data of presenceData) {
		if (data.firstYear !== null && data.firstYear < minYear) minYear = data.firstYear;
		if (data.lastYear !== null && data.lastYear > maxYear) maxYear = data.lastYear;
	}

	const yearSpan = maxYear - minYear || 1;

	// Show top 5 people by presence
	const topPresence = presenceData.slice(0, 5);

	for (const data of topPresence) {
		if (data.firstYear === null) continue;

		const row = presenceSection.createDiv({ cls: 'crc-place-timeline__presence-row' });

		// Person name
		row.createEl('span', {
			text: data.person,
			cls: 'crc-place-timeline__presence-name'
		});

		// Presence bar
		const barContainer = row.createDiv({ cls: 'crc-place-timeline__presence-bar-container' });
		const bar = barContainer.createDiv({ cls: 'crc-place-timeline__presence-bar' });

		const startPercent = ((data.firstYear - minYear) / yearSpan) * 100;
		const endPercent = ((data.lastYear || data.firstYear) - minYear) / yearSpan * 100;
		const widthPercent = Math.max(endPercent - startPercent, 2); // Minimum width for visibility

		bar.style.left = `${startPercent}%`;
		bar.style.width = `${widthPercent}%`;

		// Year labels
		row.createEl('span', {
			text: data.firstYear === data.lastYear
				? `${data.firstYear}`
				: `${data.firstYear}–${data.lastYear}`,
			cls: 'crc-place-timeline__presence-years'
		});
	}

	// Year axis
	const axis = presenceSection.createDiv({ cls: 'crc-place-timeline__presence-axis' });
	axis.createEl('span', { text: String(minYear), cls: 'crc-place-timeline__presence-axis-start' });
	axis.createEl('span', { text: String(maxYear), cls: 'crc-place-timeline__presence-axis-end' });
}

/**
 * Render a single place timeline event
 */
function renderPlaceTimelineEvent(
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

	const item = container.createDiv({ cls: 'crc-place-timeline-event' });

	// Timeline connector
	const connector = item.createDiv({ cls: 'crc-place-timeline-event__connector' });

	// Node with icon
	const node = connector.createDiv({ cls: 'crc-place-timeline-event__node' });
	if (eventType) {
		node.setCssProps({ '--event-color': eventType.color });
		const icon = createLucideIcon(eventType.icon, 14);
		node.appendChild(icon);
	} else {
		const icon = createLucideIcon('calendar', 14);
		node.appendChild(icon);
	}

	// Event content
	const content = item.createDiv({ cls: 'crc-place-timeline-event__content' });

	// Date row
	const dateRow = content.createDiv({ cls: 'crc-place-timeline-event__date' });
	dateRow.createEl('span', {
		text: formatDateForDisplay(event),
		cls: event.date ? '' : 'crc-text--muted'
	});

	// Title row
	const titleRow = content.createDiv({ cls: 'crc-place-timeline-event__title' });
	const titleLink = titleRow.createEl('a', {
		text: event.title,
		cls: 'crc-place-timeline-event__link'
	});

	titleLink.addEventListener('click', (e) => {
		e.preventDefault();
		if (onEventClick) {
			onEventClick(event);
		} else {
			void app.workspace.getLeaf(false).openFile(event.file);
		}
	});

	// Event type label
	if (eventType) {
		titleRow.createEl('span', {
			text: eventType.name,
			cls: 'crc-place-timeline-event__type',
			attr: { style: `color: ${eventType.color}` }
		});
	}

	// Person row
	const people: string[] = [];
	if (event.person) {
		people.push(event.person.replace(/^\[\[/, '').replace(/\]\]$/, ''));
	}
	if (event.persons) {
		for (const p of event.persons) {
			people.push(p.replace(/^\[\[/, '').replace(/\]\]$/, ''));
		}
	}

	if (people.length > 0) {
		const personRow = content.createDiv({ cls: 'crc-place-timeline-event__person' });
		const personIcon = createLucideIcon('user', 12);
		personRow.appendChild(personIcon);
		personRow.createEl('span', {
			text: people.join(', '),
			cls: 'crc-place-timeline-event__person-name'
		});
	}

	// Source info
	if (event.sources && event.sources.length > 0) {
		const sourceRow = content.createDiv({ cls: 'crc-place-timeline-event__details' });
		sourceRow.createEl('span', {
			text: `${event.sources.length} source${event.sources.length !== 1 ? 's' : ''}`,
			cls: 'crc-text--muted'
		});
	}
}

/**
 * Get summary statistics for a place
 */
export function getPlaceTimelineSummary(
	placeName: string,
	eventService: EventService
): { eventCount: number; peopleCount: number; dateRange: string } {
	const placeLink = `[[${placeName}]]`;
	const events = eventService.getEventsAtPlace(placeLink);
	const sortedEvents = sortEventsChronologically(events);

	const uniquePeople = getUniquePeopleFromEvents(events);

	// Calculate date range
	const datedEvents = sortedEvents.filter(e => e.date);
	let dateRange = '';

	if (datedEvents.length > 0) {
		const firstDate = datedEvents[0].date!;
		const lastDate = datedEvents[datedEvents.length - 1].date!;
		dateRange = firstDate === lastDate ? firstDate : `${firstDate} – ${lastDate}`;
	}

	return {
		eventCount: events.length,
		peopleCount: uniquePeople.length,
		dateRange
	};
}
