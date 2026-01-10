/**
 * Family Timeline Component
 *
 * Displays a chronological timeline of events for an entire family unit:
 * - The focal person
 * - Their spouses
 * - Their children
 *
 * Events are color-coded by person and show relationship context.
 * Supports expand/collapse by generation.
 */

import { App, TFile } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import { createLucideIcon } from '../../ui/lucide-icons';
import { EventService } from '../services/event-service';
import { EventNote, getEventType, DATE_PRECISION_LABELS } from '../types/event-types';
import { FamilyGraphService, PersonNode } from '../../core/family-graph';
import { formatDisplayDate } from '../../dates';

/**
 * A family member with their events and relationship context
 */
interface FamilyMember {
	person: PersonNode;
	relationship: 'self' | 'spouse' | 'child';
	events: EventNote[];
	color: string;
}

/**
 * Combined event with person context for display
 */
interface FamilyEvent {
	event: EventNote;
	member: FamilyMember;
}

/**
 * Color palette for family members
 */
const FAMILY_COLORS = [
	'#4a9eff', // Blue (self)
	'#ff6b9d', // Pink (spouse 1)
	'#22c55e', // Green (child 1)
	'#f59e0b', // Amber (child 2)
	'#8b5cf6', // Purple (spouse 2 / child 3)
	'#06b6d4', // Cyan (child 4)
	'#ec4899', // Pink (child 5)
	'#84cc16', // Lime (child 6)
	'#f97316', // Orange (child 7)
	'#6366f1', // Indigo (child 8+)
];

/**
 * Get a color for a family member based on their index
 */
function getFamilyColor(index: number): string {
	return FAMILY_COLORS[index % FAMILY_COLORS.length];
}

/**
 * Sort events chronologically
 */
function sortEventsChronologically(events: FamilyEvent[]): FamilyEvent[] {
	return events.sort((a, b) => {
		const aEvent = a.event;
		const bEvent = b.event;

		// Events with sortOrder use that first
		if (aEvent.sortOrder !== undefined && bEvent.sortOrder !== undefined) {
			return aEvent.sortOrder - bEvent.sortOrder;
		}
		if (aEvent.sortOrder !== undefined) return -1;
		if (bEvent.sortOrder !== undefined) return 1;

		// Then sort by date
		if (aEvent.date && bEvent.date) {
			return aEvent.date.localeCompare(bEvent.date);
		}
		if (aEvent.date) return -1;
		if (bEvent.date) return 1;

		// Finally sort by title
		return aEvent.title.localeCompare(bEvent.title);
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
 * Get relationship label for display
 */
function getRelationshipLabel(relationship: 'self' | 'spouse' | 'child', personName: string): string {
	switch (relationship) {
		case 'self':
			return personName;
		case 'spouse':
			return `${personName} (spouse)`;
		case 'child':
			return `${personName} (child)`;
	}
}

/**
 * Options for rendering the family timeline
 */
export interface FamilyTimelineOptions {
	/** Maximum events to show (0 = unlimited) */
	maxEvents?: number;
	/** Whether to show the empty state */
	showEmptyState?: boolean;
	/** Callback when an event is clicked */
	onEventClick?: (event: EventNote) => void;
	/** Whether to show children's events (default: true) */
	showChildren?: boolean;
	/** Whether to show spouses' events (default: true) */
	showSpouses?: boolean;
}

/**
 * Render a family timeline into a container
 */
export function renderFamilyTimeline(
	container: HTMLElement,
	personFile: TFile,
	app: App,
	settings: CanvasRootsSettings,
	eventService: EventService,
	familyGraph: FamilyGraphService,
	options?: FamilyTimelineOptions
): void {
	container.empty();
	container.addClass('crc-family-timeline');

	// Get the focal person from the family graph
	familyGraph.ensureCacheLoaded();
	const focalPerson = findPersonByFile(familyGraph, personFile);

	if (!focalPerson) {
		if (options?.showEmptyState !== false) {
			renderEmptyState(container, 'Person not found in family graph.');
		}
		return;
	}

	// Collect family members
	const familyMembers: FamilyMember[] = [];
	let colorIndex = 0;

	// Add focal person
	const selfEvents = eventService.getEventsForPerson(`[[${personFile.basename}]]`);
	familyMembers.push({
		person: focalPerson,
		relationship: 'self',
		events: selfEvents,
		color: getFamilyColor(colorIndex++)
	});

	// Add spouses
	if (options?.showSpouses !== false) {
		for (const spouseCrId of focalPerson.spouseCrIds) {
			const spouse = familyGraph.getPerson(spouseCrId);
			if (spouse) {
				const spouseEvents = eventService.getEventsForPerson(`[[${spouse.file.basename}]]`);
				familyMembers.push({
					person: spouse,
					relationship: 'spouse',
					events: spouseEvents,
					color: getFamilyColor(colorIndex++)
				});
			}
		}
	}

	// Add children
	if (options?.showChildren !== false) {
		for (const childCrId of focalPerson.childrenCrIds) {
			const child = familyGraph.getPerson(childCrId);
			if (child) {
				const childEvents = eventService.getEventsForPerson(`[[${child.file.basename}]]`);
				familyMembers.push({
					person: child,
					relationship: 'child',
					events: childEvents,
					color: getFamilyColor(colorIndex++)
				});
			}
		}
	}

	// Combine all events with member context
	const allEvents: FamilyEvent[] = [];
	for (const member of familyMembers) {
		for (const event of member.events) {
			allEvents.push({ event, member });
		}
	}

	// Sort chronologically
	const sortedEvents = sortEventsChronologically(allEvents);

	// Apply max limit if specified
	const displayEvents = options?.maxEvents
		? sortedEvents.slice(0, options.maxEvents)
		: sortedEvents;

	// Empty state
	if (displayEvents.length === 0) {
		if (options?.showEmptyState !== false) {
			renderEmptyState(container, 'No family events recorded.');
		}
		return;
	}

	// Render legend (family member color key)
	renderFamilyLegend(container, familyMembers);

	// Timeline container
	const timeline = container.createDiv({ cls: 'crc-family-timeline__list' });

	// Render each event
	for (const familyEvent of displayEvents) {
		renderFamilyTimelineEvent(
			timeline,
			familyEvent,
			app,
			settings,
			options?.onEventClick
		);
	}

	// Show "more" indicator if truncated
	if (options?.maxEvents && sortedEvents.length > options.maxEvents) {
		const moreIndicator = container.createDiv({ cls: 'crc-family-timeline__more' });
		moreIndicator.createEl('span', {
			text: `+ ${sortedEvents.length - options.maxEvents} more events`,
			cls: 'crc-text--muted'
		});
	}
}

/**
 * Find a PersonNode by its TFile
 */
function findPersonByFile(familyGraph: FamilyGraphService, file: TFile): PersonNode | undefined {
	const allPeople = familyGraph.getAllPeople();
	return allPeople.find(p => p.file.path === file.path);
}

/**
 * Render the empty state
 */
function renderEmptyState(container: HTMLElement, message: string): void {
	const emptyState = container.createDiv({ cls: 'crc-family-timeline__empty' });
	emptyState.createEl('p', {
		text: message,
		cls: 'crc-text--muted'
	});
}

/**
 * Render the family member legend (color key)
 */
function renderFamilyLegend(container: HTMLElement, members: FamilyMember[]): void {
	const legend = container.createDiv({ cls: 'crc-family-timeline__legend' });

	for (const member of members) {
		const item = legend.createEl('span', { cls: 'crc-family-timeline__legend-item' });

		// Color dot
		const dot = item.createEl('span', { cls: 'crc-family-timeline__legend-dot' });
		dot.style.setProperty('background-color', member.color);

		// Name with relationship
		const label = getRelationshipLabel(member.relationship, member.person.name);
		item.createEl('span', {
			text: label,
			cls: 'crc-family-timeline__legend-label'
		});

		// Event count
		if (member.events.length > 0) {
			item.createEl('span', {
				text: `(${member.events.length})`,
				cls: 'crc-family-timeline__legend-count'
			});
		}
	}
}

/**
 * Render a single family timeline event
 */
function renderFamilyTimelineEvent(
	container: HTMLElement,
	familyEvent: FamilyEvent,
	app: App,
	settings: CanvasRootsSettings,
	onEventClick?: (event: EventNote) => void
): void {
	const { event, member } = familyEvent;

	const eventType = getEventType(
		event.eventType,
		settings.customEventTypes || [],
		settings.showBuiltInEventTypes !== false
	);

	const item = container.createDiv({ cls: 'crc-family-timeline-event' });

	// Timeline connector (vertical line + node)
	const connector = item.createDiv({ cls: 'crc-family-timeline-event__connector' });

	// Node with person color
	const node = connector.createDiv({ cls: 'crc-family-timeline-event__node' });
	node.setCssProps({ '--event-color': member.color });
	node.setCssStyles({ borderColor: member.color });

	if (eventType) {
		const icon = createLucideIcon(eventType.icon, 14);
		node.appendChild(icon);
	} else {
		const icon = createLucideIcon('calendar', 14);
		node.appendChild(icon);
	}

	// Event content
	const content = item.createDiv({ cls: 'crc-family-timeline-event__content' });

	// Date row
	const dateRow = content.createDiv({ cls: 'crc-family-timeline-event__date' });
	dateRow.createEl('span', {
		text: formatDateForDisplay(event),
		cls: event.date ? '' : 'crc-text--muted'
	});

	// Title row (clickable)
	const titleRow = content.createDiv({ cls: 'crc-family-timeline-event__title' });
	const titleLink = titleRow.createEl('a', {
		text: event.title,
		cls: 'crc-family-timeline-event__link'
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
			cls: 'crc-family-timeline-event__type',
			attr: {
				style: `color: ${eventType.color}`
			}
		});
	}

	// Person indicator (with color)
	const personIndicator = content.createDiv({ cls: 'crc-family-timeline-event__person' });
	const personDot = personIndicator.createEl('span', { cls: 'crc-family-timeline-event__person-dot' });
	personDot.style.setProperty('background-color', member.color);
	personIndicator.createEl('span', {
		text: getRelationshipLabel(member.relationship, member.person.name),
		cls: 'crc-family-timeline-event__person-name'
	});

	// Details row (place, sources)
	const details: string[] = [];

	if (event.place) {
		const placeName = event.place.replace(/^\[\[/, '').replace(/\]\]$/, '');
		details.push(placeName);
	}

	if (event.sources && event.sources.length > 0) {
		const sourceCount = event.sources.length;
		details.push(`${sourceCount} source${sourceCount !== 1 ? 's' : ''}`);
	}

	if (details.length > 0) {
		const detailsRow = content.createDiv({ cls: 'crc-family-timeline-event__details' });
		detailsRow.createEl('span', {
			text: details.join(' • '),
			cls: 'crc-text--muted'
		});
	}

	// Confidence indicator for low/unknown confidence
	if (event.confidence === 'low' || event.confidence === 'unknown') {
		const warningRow = content.createDiv({ cls: 'crc-family-timeline-event__warning' });
		const warningIcon = createLucideIcon('alert-triangle', 12);
		warningRow.appendChild(warningIcon);
		warningRow.appendText(event.confidence === 'low' ? 'Low confidence' : 'Confidence unknown');
	}
}

/**
 * Get summary statistics for a family timeline
 */
export function getFamilyTimelineSummary(
	personFile: TFile,
	eventService: EventService,
	familyGraph: FamilyGraphService
): { totalEvents: number; memberCount: number; dateRange: string } {
	familyGraph.ensureCacheLoaded();
	const focalPerson = findPersonByFile(familyGraph, personFile);

	if (!focalPerson) {
		return { totalEvents: 0, memberCount: 0, dateRange: '' };
	}

	// Count family members
	let memberCount = 1; // Self
	memberCount += focalPerson.spouseCrIds.length;
	memberCount += focalPerson.childrenCrIds.length;

	// Collect all events
	const allEvents: EventNote[] = [];

	// Self
	allEvents.push(...eventService.getEventsForPerson(`[[${personFile.basename}]]`));

	// Spouses
	for (const spouseCrId of focalPerson.spouseCrIds) {
		const spouse = familyGraph.getPerson(spouseCrId);
		if (spouse) {
			allEvents.push(...eventService.getEventsForPerson(`[[${spouse.file.basename}]]`));
		}
	}

	// Children
	for (const childCrId of focalPerson.childrenCrIds) {
		const child = familyGraph.getPerson(childCrId);
		if (child) {
			allEvents.push(...eventService.getEventsForPerson(`[[${child.file.basename}]]`));
		}
	}

	// Calculate date range
	const datedEvents = allEvents.filter(e => e.date).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
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

	return {
		totalEvents: allEvents.length,
		memberCount,
		dateRange
	};
}
