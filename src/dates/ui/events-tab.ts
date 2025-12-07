/**
 * Events Tab UI Component
 *
 * Renders the Events tab in the Control Center, showing
 * event notes management, date systems configuration, and temporal data statistics.
 */

import { App, Menu, Modal, Notice, Setting, TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { LucideIconName } from '../../ui/lucide-icons';
import { createLucideIcon } from '../../ui/lucide-icons';
import { createDateSystemsCard } from './date-systems-card';
import { CreateEventModal } from '../../events/ui/create-event-modal';
import type { EventNote } from '../../events/types/event-types';
import { getEventType, getAllEventTypes } from '../../events/types/event-types';
import { TimelineCanvasExporter, TimelineColorScheme, TimelineLayoutStyle } from '../../events/services/timeline-canvas-exporter';
import { computeSortOrder } from '../../events/services/sort-order-service';
import { renderEventTypeManagerCard } from '../../events/ui/event-type-manager-card';

/**
 * Render the Events tab content
 */
export function renderEventsTab(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	// Event Notes card (create and manage events)
	renderEventNotesCard(container, plugin, createCard);

	// Timeline card (event list with filtering)
	renderTimelineCard(container, plugin, createCard, showTab);

	// Export card (export timeline to Canvas/Excalidraw)
	renderExportCard(container, plugin, createCard);

	// Event Type Manager card (customize, hide, create event types)
	renderEventTypeManagerCard(container, plugin, createCard, () => {
		// Refresh the tab content when types change
		container.empty();
		renderEventsTab(container, plugin, createCard, showTab);
	});

	// Date Systems card (moved from Canvas Settings)
	const dateSystemsCard = createDateSystemsCard(
		container,
		plugin,
		createCard
	);
	container.appendChild(dateSystemsCard);

	// Statistics card
	renderStatisticsCard(container, plugin, createCard);
}

/**
 * Render the Event Notes card with create button and event statistics
 */
function renderEventNotesCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement
): void {
	const card = createCard({
		title: 'Event notes',
		icon: 'calendar',
		subtitle: 'Create and manage life events for your people'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Create Event button
	const buttonRow = content.createDiv({ cls: 'crc-button-row' });

	const createBtn = buttonRow.createEl('button', {
		cls: 'crc-btn crc-btn--primary'
	});
	const icon = createLucideIcon('plus', 16);
	createBtn.appendChild(icon);
	createBtn.appendText(' Create event note');

	createBtn.addEventListener('click', () => {
		const eventService = plugin.getEventService();
		if (eventService) {
			const modal = new CreateEventModal(
				plugin.app,
				eventService,
				plugin.settings
			);
			modal.open();
		}
	});

	// Compute sort order button
	const computeBtn = buttonRow.createEl('button', {
		cls: 'crc-btn'
	});
	const computeIcon = createLucideIcon('layers', 16);
	computeBtn.appendChild(computeIcon);
	computeBtn.appendText(' Compute sort order');
	computeBtn.setAttribute('title', 'Compute sort_order values from before/after relationships');

	computeBtn.addEventListener('click', async () => {
		const eventService = plugin.getEventService();
		if (!eventService) return;

		computeBtn.disabled = true;
		computeBtn.textContent = 'Computing...';

		try {
			const events = eventService.getAllEvents();
			const result = await computeSortOrder(plugin.app, events);

			if (result.errors.length > 0) {
				new Notice(`Computed sort order with ${result.errors.length} errors. Check console.`);
			} else if (result.cycleEvents.length > 0) {
				new Notice(`Updated ${result.updatedCount} events. ${result.cycleEvents.length} events in cycles couldn't be ordered.`);
			} else {
				new Notice(`Successfully computed sort order for ${result.updatedCount} events.`);
			}

			// Invalidate cache to reload events
			eventService.invalidateCache();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Failed to compute sort order: ${message}`);
		} finally {
			computeBtn.disabled = false;
			computeBtn.empty();
			const icon = createLucideIcon('layers', 16);
			computeBtn.appendChild(icon);
			computeBtn.appendText(' Compute sort order');
		}
	});

	// Event statistics
	const stats = calculateEventStatistics(plugin);

	if (stats.totalEvents > 0) {
		const statsSection = content.createDiv({ cls: 'cr-stats-section crc-mt-3' });
		statsSection.createEl('h4', { text: 'Event statistics', cls: 'cr-subsection-heading' });

		const statsList = statsSection.createEl('ul', { cls: 'cr-stats-list' });

		// Total events
		const totalItem = statsList.createEl('li');
		totalItem.setText(`${stats.totalEvents} event notes in vault`);

		// By category breakdown
		if (stats.byCategory.core > 0 || stats.byCategory.extended > 0 || stats.byCategory.narrative > 0) {
			const categoryItem = statsList.createEl('li');
			const parts: string[] = [];
			if (stats.byCategory.core > 0) parts.push(`${stats.byCategory.core} core`);
			if (stats.byCategory.extended > 0) parts.push(`${stats.byCategory.extended} extended`);
			if (stats.byCategory.narrative > 0) parts.push(`${stats.byCategory.narrative} narrative`);
			if (stats.byCategory.custom > 0) parts.push(`${stats.byCategory.custom} custom`);
			categoryItem.setText(`By category: ${parts.join(', ')}`);
		}

		// Events with dates
		if (stats.totalEvents > 0) {
			const datedItem = statsList.createEl('li');
			const datedPercent = Math.round((stats.withDates / stats.totalEvents) * 100);
			datedItem.setText(`${stats.withDates} events have dates (${datedPercent}%)`);
		}
	} else {
		// Empty state
		const emptyState = content.createDiv({ cls: 'crc-empty-state crc-mt-3' });
		emptyState.createEl('p', {
			text: 'No event notes found.',
			cls: 'crc-text-muted'
		});
		emptyState.createEl('p', {
			text: 'Create event notes to document life events like births, deaths, marriages, and more.',
			cls: 'crc-text-muted'
		});
	}

	// Folder location setting
	const folderSection = content.createDiv({ cls: 'crc-mt-3' });
	new Setting(folderSection)
		.setName('Events folder')
		.setDesc('Default folder for new event notes')
		.addText(text => text
			.setPlaceholder('Canvas Roots/Events')
			.setValue(plugin.settings.eventsFolder)
			.onChange(async (value) => {
				plugin.settings.eventsFolder = value;
				await plugin.saveSettings();
			}));

	container.appendChild(card);
}

/**
 * Render the Timeline card with event list, filtering, and gap analysis
 */
function renderTimelineCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const eventService = plugin.getEventService();
	if (!eventService) return;

	const card = createCard({
		title: 'Timeline',
		icon: 'clock',
		subtitle: 'All events in chronological order'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Get all events
	const allEvents = eventService.getAllEvents();

	if (allEvents.length === 0) {
		const emptyState = content.createDiv({ cls: 'crc-empty-state' });
		emptyState.createEl('p', {
			text: 'No events yet.',
			cls: 'crc-text-muted'
		});
		emptyState.createEl('p', {
			text: 'Create event notes to see them in the timeline.',
			cls: 'crc-text-muted'
		});
		container.appendChild(card);
		return;
	}

	// Filter controls
	const filterRow = content.createDiv({ cls: 'crc-timeline-filters' });

	// Event type filter
	const typeFilter = filterRow.createEl('select', { cls: 'crc-timeline-filter' });
	typeFilter.createEl('option', { value: '', text: 'All types' });

	const eventTypes = getAllEventTypes(
		plugin.settings.customEventTypes || [],
		plugin.settings.showBuiltInEventTypes !== false,
		plugin.settings.eventTypeCustomizations,
		plugin.settings.hiddenEventTypes
	);
	for (const type of eventTypes) {
		typeFilter.createEl('option', { value: type.id, text: type.name });
	}

	// Person filter
	const personFilter = filterRow.createEl('select', { cls: 'crc-timeline-filter' });
	personFilter.createEl('option', { value: '', text: 'All people' });

	const uniquePeople = eventService.getUniquePeople();
	for (const person of uniquePeople) {
		// Strip wikilink brackets for display
		const displayName = person.replace(/^\[\[/, '').replace(/\]\]$/, '');
		personFilter.createEl('option', { value: person, text: displayName });
	}

	// Search input
	const searchInput = filterRow.createEl('input', {
		cls: 'crc-timeline-search',
		attr: {
			type: 'text',
			placeholder: 'Search events...'
		}
	});

	// Event table container
	const tableContainer = content.createDiv({ cls: 'crc-timeline-table-container' });

	// Render initial table
	let filteredEvents = sortEventsChronologically([...allEvents]);
	renderEventTable(tableContainer, filteredEvents, plugin);

	// Filter handler
	const applyFilters = () => {
		const typeValue = typeFilter.value;
		const personValue = personFilter.value;
		const searchValue = searchInput.value.toLowerCase();

		filteredEvents = allEvents.filter(event => {
			// Type filter
			if (typeValue && event.eventType !== typeValue) return false;

			// Person filter
			if (personValue) {
				const normalizedPersonFilter = personValue.replace(/^\[\[/, '').replace(/\]\]$/, '').toLowerCase();
				const eventPerson = event.person?.replace(/^\[\[/, '').replace(/\]\]$/, '').toLowerCase() || '';
				if (!eventPerson.includes(normalizedPersonFilter)) return false;
			}

			// Search filter
			if (searchValue) {
				const searchableText = [
					event.title,
					event.date || '',
					event.place || '',
					event.description || ''
				].join(' ').toLowerCase();
				if (!searchableText.includes(searchValue)) return false;
			}

			return true;
		});

		filteredEvents = sortEventsChronologically(filteredEvents);
		renderEventTable(tableContainer, filteredEvents, plugin);
	};

	typeFilter.addEventListener('change', applyFilters);
	personFilter.addEventListener('change', applyFilters);
	searchInput.addEventListener('input', applyFilters);

	// Timeline gap analysis section
	renderTimelineGaps(content, allEvents, plugin);

	container.appendChild(card);
}

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
 * Render event table
 */
function renderEventTable(
	container: HTMLElement,
	events: EventNote[],
	plugin: CanvasRootsPlugin
): void {
	container.empty();

	if (events.length === 0) {
		container.createEl('p', {
			text: 'No matching events.',
			cls: 'crc-text-muted crc-text-center'
		});
		return;
	}

	const table = container.createEl('table', { cls: 'crc-timeline-table' });

	// Header
	const thead = table.createEl('thead');
	const headerRow = thead.createEl('tr');
	headerRow.createEl('th', { text: 'Date' });
	headerRow.createEl('th', { text: 'Event' });
	headerRow.createEl('th', { text: 'Type' });
	headerRow.createEl('th', { text: 'Person' });
	headerRow.createEl('th', { text: 'Place' });

	// Body
	const tbody = table.createEl('tbody');

	for (const event of events) {
		const row = tbody.createEl('tr', { cls: 'crc-timeline-row' });

		// Make row clickable
		row.addEventListener('click', () => {
			void plugin.app.workspace.getLeaf(false).openFile(event.file);
		});

		// Context menu
		row.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			const menu = new Menu();

			menu.addItem((item) => {
				item
					.setTitle('Open note')
					.setIcon('file')
					.onClick(() => {
						void plugin.app.workspace.getLeaf(false).openFile(event.file);
					});
			});

			menu.addItem((item) => {
				item
					.setTitle('Open in new tab')
					.setIcon('file-plus')
					.onClick(() => {
						void plugin.app.workspace.getLeaf('tab').openFile(event.file);
					});
			});

			menu.addSeparator();

			menu.addItem((item) => {
				item
					.setTitle('Delete event')
					.setIcon('trash')
					.onClick(async () => {
						const confirmed = await confirmDeleteEvent(plugin.app, event.title);
						if (confirmed) {
							await plugin.app.vault.delete(event.file);
							new Notice(`Deleted event: ${event.title}`);
						}
					});
			});

			menu.showAtMouseEvent(e);
		});

		// Date cell
		const dateCell = row.createEl('td', { cls: 'crc-timeline-cell-date' });
		if (event.date) {
			dateCell.textContent = event.date;
			if (event.dateEnd) {
				dateCell.textContent += ` – ${event.dateEnd}`;
			}
		} else {
			dateCell.createEl('span', { text: 'Unknown', cls: 'crc-text-muted' });
		}

		// Event title cell
		const titleCell = row.createEl('td', { cls: 'crc-timeline-cell-title' });
		titleCell.textContent = event.title;

		// Type cell with badge
		const typeCell = row.createEl('td', { cls: 'crc-timeline-cell-type' });
		const typeDef = getEventType(
			event.eventType,
			plugin.settings.customEventTypes || [],
			plugin.settings.showBuiltInEventTypes !== false,
			plugin.settings.eventTypeCustomizations
		);
		if (typeDef) {
			const badge = typeCell.createEl('span', { cls: 'crc-event-type-badge' });
			badge.style.backgroundColor = typeDef.color;
			badge.style.color = getContrastColor(typeDef.color);
			const icon = createLucideIcon(typeDef.icon, 12);
			badge.appendChild(icon);
			badge.appendText(` ${typeDef.name}`);
		} else {
			typeCell.textContent = event.eventType;
		}

		// Person cell
		const personCell = row.createEl('td', { cls: 'crc-timeline-cell-person' });
		if (event.person) {
			personCell.textContent = event.person.replace(/^\[\[/, '').replace(/\]\]$/, '');
		} else {
			personCell.createEl('span', { text: '—', cls: 'crc-text-muted' });
		}

		// Place cell
		const placeCell = row.createEl('td', { cls: 'crc-timeline-cell-place' });
		if (event.place) {
			placeCell.textContent = event.place.replace(/^\[\[/, '').replace(/\]\]$/, '');
		} else {
			placeCell.createEl('span', { text: '—', cls: 'crc-text-muted' });
		}
	}

	// Show count
	container.createEl('p', {
		text: `Showing ${events.length} event${events.length !== 1 ? 's' : ''}`,
		cls: 'crc-text-muted crc-text-small crc-mt-2'
	});
}

/**
 * Render timeline gap analysis
 */
function renderTimelineGaps(
	container: HTMLElement,
	events: EventNote[],
	plugin: CanvasRootsPlugin
): void {
	// Only analyze if we have dated events
	const datedEvents = events.filter(e => e.date).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

	if (datedEvents.length < 2) return;

	// Find gaps (periods with no events)
	const gaps: { start: string; end: string; years: number }[] = [];
	const GAP_THRESHOLD_YEARS = 5; // Consider gaps of 5+ years

	for (let i = 0; i < datedEvents.length - 1; i++) {
		const current = datedEvents[i];
		const next = datedEvents[i + 1];

		if (!current.date || !next.date) continue;

		// Extract years from dates
		const currentYear = extractYear(current.date);
		const nextYear = extractYear(next.date);

		if (currentYear && nextYear) {
			const yearGap = nextYear - currentYear;
			if (yearGap >= GAP_THRESHOLD_YEARS) {
				gaps.push({
					start: current.date,
					end: next.date,
					years: yearGap
				});
			}
		}
	}

	// Count unsourced events
	const unsourcedCount = events.filter(e => !e.sources || e.sources.length === 0).length;

	// Count orphan events (no person linked)
	const orphanCount = events.filter(e => !e.person && (!e.persons || e.persons.length === 0)).length;

	// Only show section if there are issues
	if (gaps.length === 0 && unsourcedCount === 0 && orphanCount === 0) return;

	const section = container.createDiv({ cls: 'crc-timeline-gaps crc-mt-4' });
	section.createEl('h4', { text: 'Data quality insights', cls: 'cr-subsection-heading' });

	const issuesList = section.createEl('ul', { cls: 'crc-timeline-gaps-list' });

	// Timeline gaps
	if (gaps.length > 0) {
		const gapItem = issuesList.createEl('li', { cls: 'crc-timeline-gap-item crc-timeline-gap-item--warning' });
		const icon = createLucideIcon('alert-triangle', 14);
		gapItem.appendChild(icon);

		if (gaps.length === 1) {
			gapItem.appendText(` Timeline gap detected: ${gaps[0].years} years (${gaps[0].start} – ${gaps[0].end})`);
		} else {
			gapItem.appendText(` ${gaps.length} timeline gaps detected (${GAP_THRESHOLD_YEARS}+ year periods with no events)`);

			// Show first few gaps
			const gapDetails = issuesList.createEl('ul', { cls: 'crc-timeline-gap-details' });
			for (const gap of gaps.slice(0, 3)) {
				gapDetails.createEl('li', { text: `${gap.years} years: ${gap.start} – ${gap.end}` });
			}
			if (gaps.length > 3) {
				gapDetails.createEl('li', { text: `...and ${gaps.length - 3} more`, cls: 'crc-text-muted' });
			}
		}
	}

	// Unsourced events
	if (unsourcedCount > 0) {
		const unsourcedItem = issuesList.createEl('li', { cls: 'crc-timeline-gap-item crc-timeline-gap-item--info' });
		const icon = createLucideIcon('info', 14);
		unsourcedItem.appendChild(icon);
		unsourcedItem.appendText(` ${unsourcedCount} event${unsourcedCount !== 1 ? 's' : ''} without source citations`);
	}

	// Orphan events
	if (orphanCount > 0) {
		const orphanItem = issuesList.createEl('li', { cls: 'crc-timeline-gap-item crc-timeline-gap-item--info' });
		const icon = createLucideIcon('user-minus', 14);
		orphanItem.appendChild(icon);
		orphanItem.appendText(` ${orphanCount} event${orphanCount !== 1 ? 's' : ''} not linked to any person`);
	}
}

/**
 * Extract year from a date string
 */
function extractYear(dateStr: string): number | null {
	// Try ISO format first (YYYY-MM-DD or YYYY)
	const isoMatch = dateStr.match(/^(\d{4})/);
	if (isoMatch) {
		return parseInt(isoMatch[1], 10);
	}

	// Try any 4-digit number
	const yearMatch = dateStr.match(/\d{4}/);
	if (yearMatch) {
		return parseInt(yearMatch[0], 10);
	}

	return null;
}

/**
 * Render the Export card for exporting timeline to Canvas/Excalidraw
 */
function renderExportCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement
): void {
	const eventService = plugin.getEventService();
	if (!eventService) return;

	const allEvents = eventService.getAllEvents();

	const card = createCard({
		title: 'Export timeline',
		icon: 'download',
		subtitle: 'Export events to Canvas or Excalidraw'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	if (allEvents.length === 0) {
		const emptyState = content.createDiv({ cls: 'crc-empty-state' });
		emptyState.createEl('p', {
			text: 'No events to export.',
			cls: 'crc-text-muted'
		});
		emptyState.createEl('p', {
			text: 'Create event notes first to export them to a visual timeline.',
			cls: 'crc-text-muted'
		});
		container.appendChild(card);
		return;
	}

	// Export options form
	const form = content.createDiv({ cls: 'crc-export-form' });

	// Title input
	const titleRow = form.createDiv({ cls: 'crc-form-row' });
	titleRow.createEl('label', { text: 'Canvas title', cls: 'crc-form-label' });
	const titleInput = titleRow.createEl('input', {
		cls: 'crc-form-input',
		attr: { type: 'text', value: 'Event Timeline', placeholder: 'Event Timeline' }
	});

	// Layout style dropdown
	const layoutRow = form.createDiv({ cls: 'crc-form-row' });
	layoutRow.createEl('label', { text: 'Layout style', cls: 'crc-form-label' });
	const layoutSelect = layoutRow.createEl('select', { cls: 'crc-form-select' });
	layoutSelect.createEl('option', { value: 'horizontal', text: 'Horizontal (left to right)' });
	layoutSelect.createEl('option', { value: 'vertical', text: 'Vertical (top to bottom)' });
	layoutSelect.createEl('option', { value: 'gantt', text: 'Gantt (by date and person)' });

	// Color scheme dropdown
	const colorRow = form.createDiv({ cls: 'crc-form-row' });
	colorRow.createEl('label', { text: 'Color by', cls: 'crc-form-label' });
	const colorSelect = colorRow.createEl('select', { cls: 'crc-form-select' });
	colorSelect.createEl('option', { value: 'event_type', text: 'Event type' });
	colorSelect.createEl('option', { value: 'category', text: 'Category (core/extended/narrative)' });
	colorSelect.createEl('option', { value: 'confidence', text: 'Confidence level' });
	colorSelect.createEl('option', { value: 'monochrome', text: 'No color' });

	// Filter by person dropdown
	const personRow = form.createDiv({ cls: 'crc-form-row' });
	personRow.createEl('label', { text: 'Filter by person', cls: 'crc-form-label' });
	const personSelect = personRow.createEl('select', { cls: 'crc-form-select' });
	personSelect.createEl('option', { value: '', text: 'All people' });

	const uniquePeople = eventService.getUniquePeople();
	for (const person of uniquePeople) {
		const displayName = person.replace(/^\[\[/, '').replace(/\]\]$/, '');
		personSelect.createEl('option', { value: person, text: displayName });
	}

	// Filter by event type dropdown
	const typeRow = form.createDiv({ cls: 'crc-form-row' });
	typeRow.createEl('label', { text: 'Filter by type', cls: 'crc-form-label' });
	const typeSelect = typeRow.createEl('select', { cls: 'crc-form-select' });
	typeSelect.createEl('option', { value: '', text: 'All types' });

	const exportEventTypes = getAllEventTypes(
		plugin.settings.customEventTypes || [],
		plugin.settings.showBuiltInEventTypes !== false,
		plugin.settings.eventTypeCustomizations,
		plugin.settings.hiddenEventTypes
	);
	for (const type of exportEventTypes) {
		typeSelect.createEl('option', { value: type.id, text: type.name });
	}

	// Filter by group dropdown
	const groupFilterRow = form.createDiv({ cls: 'crc-form-row' });
	groupFilterRow.createEl('label', { text: 'Filter by group', cls: 'crc-form-label' });
	const groupSelect = groupFilterRow.createEl('select', { cls: 'crc-form-select' });
	groupSelect.createEl('option', { value: '', text: 'All groups' });

	const uniqueGroups = eventService.getUniqueGroups();
	for (const group of uniqueGroups) {
		groupSelect.createEl('option', { value: group, text: group });
	}

	// Include ordering edges checkbox
	const edgesRow = form.createDiv({ cls: 'crc-form-row crc-form-row--checkbox' });
	const edgesCheckbox = edgesRow.createEl('input', {
		cls: 'crc-form-checkbox',
		attr: { type: 'checkbox', id: 'include-edges', checked: 'checked' }
	});
	edgesRow.createEl('label', {
		text: 'Include before/after relationship edges',
		attr: { for: 'include-edges' }
	});

	// Group by person checkbox
	const groupByPersonRow = form.createDiv({ cls: 'crc-form-row crc-form-row--checkbox' });
	const groupCheckbox = groupByPersonRow.createEl('input', {
		cls: 'crc-form-checkbox',
		attr: { type: 'checkbox', id: 'group-by-person' }
	});
	groupByPersonRow.createEl('label', {
		text: 'Group events by person',
		attr: { for: 'group-by-person' }
	});

	// Preview section
	const previewSection = content.createDiv({ cls: 'crc-export-preview crc-mt-3' });
	previewSection.createEl('h4', { text: 'Export preview', cls: 'cr-subsection-heading' });

	const previewContent = previewSection.createDiv({ cls: 'crc-export-preview-content' });

	// Update preview function
	const updatePreview = () => {
		const exporter = new TimelineCanvasExporter(plugin.app, plugin.settings);
		const summary = exporter.getExportSummary(allEvents, {
			filterPerson: personSelect.value || undefined,
			filterEventType: typeSelect.value || undefined,
			filterGroup: groupSelect.value || undefined
		});

		previewContent.empty();

		const statsList = previewContent.createEl('ul', { cls: 'crc-export-stats' });
		statsList.createEl('li', { text: `${summary.totalEvents} events to export` });
		statsList.createEl('li', { text: `${summary.datedEvents} with dates, ${summary.undatedEvents} undated` });
		if (summary.withOrderingConstraints > 0) {
			statsList.createEl('li', { text: `${summary.withOrderingConstraints} with before/after constraints` });
		}
		statsList.createEl('li', { text: `${summary.uniquePeople} unique people` });
		statsList.createEl('li', { text: `${summary.uniquePlaces} unique places` });
	};

	// Initial preview
	updatePreview();

	// Update preview on filter changes
	personSelect.addEventListener('change', updatePreview);
	typeSelect.addEventListener('change', updatePreview);
	groupSelect.addEventListener('change', updatePreview);

	// Export buttons
	const buttonRow = content.createDiv({ cls: 'crc-button-row crc-mt-3' });

	// Export to Canvas button
	const canvasBtn = buttonRow.createEl('button', { cls: 'crc-btn crc-btn--primary' });
	const canvasIcon = createLucideIcon('layout', 16);
	canvasBtn.appendChild(canvasIcon);
	canvasBtn.appendText(' Export to Canvas');

	canvasBtn.addEventListener('click', async () => {
		const exporter = new TimelineCanvasExporter(plugin.app, plugin.settings);

		canvasBtn.disabled = true;
		canvasBtn.textContent = 'Exporting...';

		try {
			const result = await exporter.exportToCanvas(allEvents, {
				title: titleInput.value || 'Event Timeline',
				layoutStyle: layoutSelect.value as TimelineLayoutStyle,
				colorScheme: colorSelect.value as TimelineColorScheme,
				filterPerson: personSelect.value || undefined,
				filterEventType: typeSelect.value || undefined,
				filterGroup: groupSelect.value || undefined,
				includeOrderingEdges: edgesCheckbox.checked,
				groupByPerson: groupCheckbox.checked
			});

			if (result.success && result.path) {
				new Notice(`Timeline exported to ${result.path}`);
				// Open the canvas
				const file = plugin.app.vault.getAbstractFileByPath(result.path);
				if (file) {
					void plugin.app.workspace.getLeaf(false).openFile(file as TFile);
				}
			} else {
				new Notice(`Export failed: ${result.error || 'Unknown error'}`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Export failed: ${message}`);
		} finally {
			canvasBtn.disabled = false;
			canvasBtn.empty();
			const icon = createLucideIcon('layout', 16);
			canvasBtn.appendChild(icon);
			canvasBtn.appendText(' Export to Canvas');
		}
	});

	// Export to Excalidraw button (if plugin is available)
	// Use type assertion to access internal plugins API
	const excalidrawAvailable = (plugin.app as unknown as { plugins: { enabledPlugins: Set<string> } }).plugins?.enabledPlugins?.has('obsidian-excalidraw-plugin') ?? false;

	const excalidrawBtn = buttonRow.createEl('button', {
		cls: `crc-btn ${excalidrawAvailable ? '' : 'crc-btn--disabled'}`,
		attr: excalidrawAvailable ? {} : { disabled: 'disabled' }
	});
	const excalidrawIcon = createLucideIcon('edit', 16);
	excalidrawBtn.appendChild(excalidrawIcon);
	excalidrawBtn.appendText(' Export to Excalidraw');

	if (!excalidrawAvailable) {
		excalidrawBtn.setAttribute('title', 'Excalidraw plugin not installed');
	} else {
		excalidrawBtn.addEventListener('click', async () => {
			// First export to canvas, then convert to Excalidraw
			const exporter = new TimelineCanvasExporter(plugin.app, plugin.settings);

			excalidrawBtn.disabled = true;
			excalidrawBtn.textContent = 'Exporting...';

			try {
				// Export to canvas first
				const result = await exporter.exportToCanvas(allEvents, {
					title: titleInput.value || 'Event Timeline',
					layoutStyle: layoutSelect.value as TimelineLayoutStyle,
					colorScheme: colorSelect.value as TimelineColorScheme,
					filterPerson: personSelect.value || undefined,
					filterEventType: typeSelect.value || undefined,
					filterGroup: groupSelect.value || undefined,
					includeOrderingEdges: edgesCheckbox.checked,
					groupByPerson: groupCheckbox.checked
				});

				if (result.success && result.path) {
					// Use existing Excalidraw exporter
					const { ExcalidrawExporter } = await import('../../excalidraw/excalidraw-exporter');
					const excalidrawExporter = new ExcalidrawExporter(plugin.app);

					// Get the canvas file that was just created
					const canvasFile = plugin.app.vault.getAbstractFileByPath(result.path);
					if (!(canvasFile instanceof TFile)) {
						throw new Error('Canvas file not found after export');
					}

					const excalidrawResult = await excalidrawExporter.exportToExcalidraw({
						canvasFile,
						fileName: result.path.replace('.canvas', '').split('/').pop(),
						preserveColors: true
					});

					if (excalidrawResult.success && excalidrawResult.excalidrawContent) {
						// Write the Excalidraw file
						const excalidrawPath = result.path.replace('.canvas', '.excalidraw.md');
						await plugin.app.vault.create(excalidrawPath, excalidrawResult.excalidrawContent);
						new Notice(`Timeline exported to ${excalidrawPath}`);
						// Open the Excalidraw file
						const file = plugin.app.vault.getAbstractFileByPath(excalidrawPath);
						if (file) {
							void plugin.app.workspace.getLeaf(false).openFile(file as TFile);
						}
					} else {
						new Notice(`Excalidraw export failed: ${excalidrawResult.errors.join(', ') || 'Unknown error'}`);
					}
				} else {
					new Notice(`Canvas export failed: ${result.error || 'Unknown error'}`);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				new Notice(`Export failed: ${message}`);
			} finally {
				excalidrawBtn.disabled = false;
				excalidrawBtn.empty();
				const icon = createLucideIcon('edit', 16);
				excalidrawBtn.appendChild(icon);
				excalidrawBtn.appendText(' Export to Excalidraw');
			}
		});
	}

	container.appendChild(card);
}

/**
 * Get contrasting text color for a background
 */
function getContrastColor(hexColor: string): string {
	const hex = hexColor.replace('#', '');
	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Statistics about events in the vault
 */
interface EventStatistics {
	totalEvents: number;
	withDates: number;
	byCategory: {
		core: number;
		extended: number;
		narrative: number;
		custom: number;
	};
}

/**
 * Calculate event statistics from event notes
 */
function calculateEventStatistics(plugin: CanvasRootsPlugin): EventStatistics {
	const stats: EventStatistics = {
		totalEvents: 0,
		withDates: 0,
		byCategory: {
			core: 0,
			extended: 0,
			narrative: 0,
			custom: 0
		}
	};

	// Core event types
	const coreTypes = ['birth', 'death', 'marriage', 'divorce'];
	// Extended event types
	const extendedTypes = ['burial', 'residence', 'occupation', 'education', 'military', 'immigration', 'baptism', 'confirmation', 'ordination'];
	// Narrative event types
	const narrativeTypes = ['anecdote', 'lore_event', 'plot_point', 'flashback', 'foreshadowing', 'backstory', 'climax', 'resolution'];

	// Get all markdown files
	const files = plugin.app.vault.getMarkdownFiles();

	for (const file of files) {
		const cache = plugin.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;

		if (!frontmatter) continue;

		// Check if this is an event note
		if (frontmatter.type !== 'event') continue;

		stats.totalEvents++;

		// Check for date
		if (frontmatter.date) {
			stats.withDates++;
		}

		// Categorize by event type
		const eventType = frontmatter.event_type as string;
		if (coreTypes.includes(eventType)) {
			stats.byCategory.core++;
		} else if (extendedTypes.includes(eventType)) {
			stats.byCategory.extended++;
		} else if (narrativeTypes.includes(eventType)) {
			stats.byCategory.narrative++;
		} else {
			stats.byCategory.custom++;
		}
	}

	return stats;
}

/**
 * Render the Statistics card with date coverage metrics
 */
function renderStatisticsCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement
): void {
	const card = createCard({
		title: 'Statistics',
		icon: 'bar-chart'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Get person notes with date information
	const stats = calculateDateStatistics(plugin);

	// Date coverage section
	const coverageSection = content.createDiv({ cls: 'cr-stats-section' });
	coverageSection.createEl('h4', { text: 'Date coverage', cls: 'cr-subsection-heading' });

	const coverageList = coverageSection.createEl('ul', { cls: 'cr-stats-list' });

	// Birth dates
	const birthItem = coverageList.createEl('li');
	const birthPercent = stats.totalPersons > 0
		? Math.round((stats.withBirthDates / stats.totalPersons) * 100)
		: 0;
	birthItem.setText(`${stats.withBirthDates} of ${stats.totalPersons} person notes have birth dates (${birthPercent}%)`);

	// Death dates
	const deathItem = coverageList.createEl('li');
	const deathPercent = stats.totalPersons > 0
		? Math.round((stats.withDeathDates / stats.totalPersons) * 100)
		: 0;
	deathItem.setText(`${stats.withDeathDates} of ${stats.totalPersons} person notes have death dates (${deathPercent}%)`);

	// Fictional dates section (only show if fictional dates are enabled)
	if (plugin.settings.enableFictionalDates) {
		const fictionalSection = content.createDiv({ cls: 'cr-stats-section' });
		fictionalSection.createEl('h4', { text: 'Fictional dates', cls: 'cr-subsection-heading' });

		const fictionalList = fictionalSection.createEl('ul', { cls: 'cr-stats-list' });

		// Count of notes using fictional dates
		const fictionalItem = fictionalList.createEl('li');
		fictionalItem.setText(`${stats.withFictionalDates} notes use fictional date systems`);

		// Systems in use
		if (stats.systemsInUse.length > 0) {
			const systemsItem = fictionalList.createEl('li');
			const systemsText = stats.systemsInUse
				.map(s => `${s.name} (${s.count})`)
				.join(', ');
			systemsItem.setText(`Systems in use: ${systemsText}`);
		}
	}

	// Empty state if no persons
	if (stats.totalPersons === 0) {
		content.empty();
		const emptyState = content.createDiv({ cls: 'crc-empty-state' });
		emptyState.createEl('p', {
			text: 'No person notes found.',
			cls: 'crc-text-muted'
		});
		emptyState.createEl('p', {
			text: 'Create person notes with type: person in frontmatter to see date statistics.',
			cls: 'crc-text-muted'
		});
	}

	container.appendChild(card);
}

/**
 * Statistics about dates in the vault
 */
interface DateStatistics {
	totalPersons: number;
	withBirthDates: number;
	withDeathDates: number;
	withFictionalDates: number;
	systemsInUse: Array<{ name: string; count: number }>;
}

/**
 * Calculate date statistics from person notes
 */
function calculateDateStatistics(plugin: CanvasRootsPlugin): DateStatistics {
	const stats: DateStatistics = {
		totalPersons: 0,
		withBirthDates: 0,
		withDeathDates: 0,
		withFictionalDates: 0,
		systemsInUse: []
	};

	// Get all markdown files
	const files = plugin.app.vault.getMarkdownFiles();
	const systemCounts: Record<string, number> = {};

	for (const file of files) {
		const cache = plugin.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;

		if (!frontmatter) continue;

		// Check if this is a person note
		if (frontmatter.type !== 'person') continue;

		stats.totalPersons++;

		// Check for birth date
		const bornValue = frontmatter.born;
		if (bornValue !== undefined && bornValue !== null && bornValue !== '') {
			stats.withBirthDates++;

			// Check if it looks like a fictional date (has era abbreviation)
			if (typeof bornValue === 'string' && looksLikeFictionalDate(bornValue)) {
				stats.withFictionalDates++;
				const systemName = detectDateSystem(bornValue, plugin);
				if (systemName) {
					systemCounts[systemName] = (systemCounts[systemName] || 0) + 1;
				}
			}
		}

		// Check for death date
		const diedValue = frontmatter.died;
		if (diedValue !== undefined && diedValue !== null && diedValue !== '') {
			stats.withDeathDates++;

			// Also check died for fictional date (if born wasn't fictional)
			if (typeof diedValue === 'string' && looksLikeFictionalDate(diedValue)) {
				const systemName = detectDateSystem(diedValue, plugin);
				if (systemName && !systemCounts[systemName]) {
					// Only count the system once per person
					systemCounts[systemName] = (systemCounts[systemName] || 0) + 1;
				}
			}
		}
	}

	// Convert system counts to array
	stats.systemsInUse = Object.entries(systemCounts)
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count);

	return stats;
}

/**
 * Check if a date string looks like a fictional date (has era abbreviation)
 */
function looksLikeFictionalDate(dateStr: string): boolean {
	// Look for era patterns like "TA 2941", "AC 300", "BBY 19"
	return /^[A-Z]{1,4}\s+\d+/i.test(dateStr.trim()) ||
		/\d+\s+[A-Z]{1,4}$/i.test(dateStr.trim());
}

/**
 * Try to detect which date system a date string belongs to
 */
function detectDateSystem(dateStr: string, plugin: CanvasRootsPlugin): string | null {
	// Get all active systems
	const systems = [];

	if (plugin.settings.showBuiltInDateSystems) {
		// Import DEFAULT_DATE_SYSTEMS lazily to avoid circular deps
		const { DEFAULT_DATE_SYSTEMS } = require('../constants/default-date-systems');
		systems.push(...DEFAULT_DATE_SYSTEMS);
	}

	systems.push(...plugin.settings.fictionalDateSystems);

	// Check each system's era abbreviations
	const normalizedDate = dateStr.toUpperCase();
	for (const system of systems) {
		for (const era of system.eras) {
			if (normalizedDate.includes(era.abbrev.toUpperCase())) {
				return system.name;
			}
		}
	}

	return null;
}

/**
 * Confirm deletion of an event
 */
async function confirmDeleteEvent(app: App, eventTitle: string): Promise<boolean> {
	return new Promise((resolve) => {
		const modal = new Modal(app);
		modal.titleEl.setText('Delete event');
		modal.contentEl.createEl('p', {
			text: `Are you sure you want to delete "${eventTitle}"? This action cannot be undone.`
		});

		const buttonContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => {
			modal.close();
			resolve(false);
		});

		const deleteBtn = buttonContainer.createEl('button', {
			text: 'Delete',
			cls: 'mod-warning'
		});
		deleteBtn.addEventListener('click', () => {
			modal.close();
			resolve(true);
		});

		modal.open();
	});
}
