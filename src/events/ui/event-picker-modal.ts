/**
 * Event Picker Modal
 *
 * Allows users to search and select an event to link to a person note.
 * Similar pattern to SourcePickerModal.
 */

import { App, Modal, TFile } from 'obsidian';
import { createLucideIcon } from '../../ui/lucide-icons';
import { EventService } from '../services/event-service';
import type { EventNote } from '../types/event-types';
import { getEventType } from '../types/event-types';
import type CanvasRootsPlugin from '../../../main';

/**
 * Sort options for event list
 */
type SortOption = 'title-asc' | 'title-desc' | 'date-asc' | 'date-desc' | 'recent';

/**
 * Filter options for event list
 */
interface FilterOptions {
	eventType: string; // 'all' or specific type id
}

/**
 * Options for configuring the EventPickerModal
 */
export interface EventPickerOptions {
	/** Callback when an event is selected */
	onSelect: (event: EventNote) => void | Promise<void>;
	/** cr_ids of events to exclude from the list (e.g., already linked) */
	excludeEvents?: string[];
	/** Whether to show the "Create new" button (default: true) */
	allowCreate?: boolean;
}

/**
 * Event Picker Modal
 * Allows users to search and select an event from the vault
 */
export class EventPickerModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private searchQuery: string = '';
	private allEvents: EventNote[] = [];
	private filteredEvents: EventNote[] = [];
	private options: EventPickerOptions;
	private searchInput!: HTMLInputElement;
	private resultsContainer!: HTMLElement;
	private sortOption: SortOption = 'date-desc';
	private filters: FilterOptions = {
		eventType: 'all'
	};

	constructor(app: App, plugin: CanvasRootsPlugin, options: EventPickerOptions) {
		super(app);
		this.plugin = plugin;
		this.options = {
			allowCreate: true,  // Default to true
			...options
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('cr-event-picker-modal');

		// Load all events from vault
		this.loadEvents();

		// Create modal structure
		this.createModalContent();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Load all event notes from the vault
	 */
	private loadEvents(): void {
		const eventService = this.plugin.getEventService();
		if (!eventService) {
			this.allEvents = [];
			return;
		}

		let events = eventService.getAllEvents();

		// Filter out excluded events if specified
		if (this.options.excludeEvents && this.options.excludeEvents.length > 0) {
			const excludeSet = new Set(this.options.excludeEvents);
			events = events.filter(e => !excludeSet.has(e.crId));
		}

		this.allEvents = events;

		// Initial sort by date (newest first)
		this.sortEvents();
		this.filteredEvents = [...this.allEvents];
	}

	/**
	 * Sort events based on current sort option
	 */
	private sortEvents(): void {
		switch (this.sortOption) {
			case 'title-asc':
				this.allEvents.sort((a, b) => a.title.localeCompare(b.title));
				break;
			case 'title-desc':
				this.allEvents.sort((a, b) => b.title.localeCompare(a.title));
				break;
			case 'date-asc':
				this.allEvents.sort((a, b) => this.compareDates(a.date, b.date, true));
				break;
			case 'date-desc':
				this.allEvents.sort((a, b) => this.compareDates(a.date, b.date, false));
				break;
			case 'recent':
				// Sort by file modification time
				this.allEvents.sort((a, b) => {
					const fileA = this.app.vault.getAbstractFileByPath(a.filePath);
					const fileB = this.app.vault.getAbstractFileByPath(b.filePath);
					if (fileA instanceof TFile && fileB instanceof TFile) {
						return fileB.stat.mtime - fileA.stat.mtime;
					}
					return 0;
				});
				break;
		}
	}

	/**
	 * Compare dates for sorting
	 */
	private compareDates(dateA: string | undefined, dateB: string | undefined, ascending: boolean): number {
		if (!dateA && !dateB) return 0;
		if (!dateA) return 1;
		if (!dateB) return -1;

		const comparison = dateA.localeCompare(dateB);
		return ascending ? comparison : -comparison;
	}

	/**
	 * Create the modal content
	 */
	private createModalContent(): void {
		const { contentEl } = this;

		// Header
		const header = contentEl.createDiv({ cls: 'crc-picker-header' });
		const titleSection = header.createDiv({ cls: 'crc-picker-title' });
		const icon = createLucideIcon('calendar', 20);
		titleSection.appendChild(icon);
		titleSection.appendText('Select event');

		// Search section
		const searchSection = contentEl.createDiv({ cls: 'crc-picker-search' });

		this.searchInput = searchSection.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'text',
				placeholder: 'Search by title, type, date...'
			}
		});

		this.searchInput.addEventListener('input', () => {
			this.searchQuery = this.searchInput.value.toLowerCase();
			this.filterEvents();
		});

		// Auto-focus search input
		setTimeout(() => this.searchInput.focus(), 50);

		// Sort dropdown
		const sortContainer = contentEl.createDiv({ cls: 'crc-picker-sort' });
		sortContainer.createSpan({ cls: 'crc-picker-sort__label', text: 'Sort by:' });
		const sortSelect = sortContainer.createEl('select', { cls: 'crc-form-select' });

		const sortOptions: Array<{ value: SortOption; label: string }> = [
			{ value: 'date-desc', label: 'Date (newest first)' },
			{ value: 'date-asc', label: 'Date (oldest first)' },
			{ value: 'title-asc', label: 'Title (A-Z)' },
			{ value: 'title-desc', label: 'Title (Z-A)' },
			{ value: 'recent', label: 'Recently modified' }
		];

		sortOptions.forEach(opt => {
			const option = sortSelect.createEl('option', { value: opt.value, text: opt.label });
			if (opt.value === this.sortOption) {
				option.selected = true;
			}
		});

		sortSelect.addEventListener('change', () => {
			this.sortOption = sortSelect.value as SortOption;
			this.sortEvents();
			this.filteredEvents = [...this.allEvents];
			this.filterEvents();
		});

		// Filters section
		const filtersContainer = contentEl.createDiv({ cls: 'crc-picker-filters' });

		// Event type filter
		const typeFilter = filtersContainer.createDiv({ cls: 'crc-picker-filter' });
		typeFilter.createSpan({ cls: 'crc-picker-filter__label', text: 'Type:' });
		const typeSelect = typeFilter.createEl('select', { cls: 'crc-form-select crc-form-select--small' });

		// Get unique event types from current events
		const eventTypes = new Set<string>();
		this.allEvents.forEach(e => eventTypes.add(e.eventType));

		typeSelect.createEl('option', { value: 'all', text: 'All types' });
		Array.from(eventTypes).sort().forEach(typeId => {
			const typeDef = getEventType(
				typeId,
				this.plugin.settings.customEventTypes,
				this.plugin.settings.showBuiltInEventTypes
			);
			const label = typeDef ? typeDef.name : typeId;
			typeSelect.createEl('option', { value: typeId, text: label });
		});

		typeSelect.addEventListener('change', () => {
			this.filters.eventType = typeSelect.value;
			this.filterEvents();
		});

		// Results section
		this.resultsContainer = contentEl.createDiv({ cls: 'crc-picker-results' });
		this.renderResults();
	}

	/**
	 * Filter events based on search query and filter options
	 */
	private filterEvents(): void {
		this.filteredEvents = this.allEvents.filter(event => {
			// Search query filter
			if (this.searchQuery) {
				const matchesSearch =
					event.title.toLowerCase().includes(this.searchQuery) ||
					event.eventType.toLowerCase().includes(this.searchQuery) ||
					event.date?.toLowerCase().includes(this.searchQuery) ||
					event.crId.toLowerCase().includes(this.searchQuery);
				if (!matchesSearch) return false;
			}

			// Event type filter
			if (this.filters.eventType !== 'all') {
				if (event.eventType !== this.filters.eventType) return false;
			}

			return true;
		});

		this.renderResults();
	}

	/**
	 * Render the filtered results
	 */
	private renderResults(): void {
		this.resultsContainer.empty();

		if (this.filteredEvents.length === 0) {
			const emptyState = this.resultsContainer.createDiv({ cls: 'crc-picker-empty' });
			const emptyIcon = createLucideIcon('calendar', 48);
			emptyState.appendChild(emptyIcon);
			emptyState.createEl('p', { text: 'No events found' });
			emptyState.createEl('p', {
				text: this.allEvents.length === 0
					? 'Create event notes to link them to people'
					: 'Try a different search term or filter',
				cls: 'crc-text-muted'
			});
			return;
		}

		// Render event cards
		this.filteredEvents.forEach(event => {
			this.renderEventCard(event);
		});
	}

	/**
	 * Render a single event card
	 */
	private renderEventCard(event: EventNote): void {
		const typeDef = getEventType(
			event.eventType,
			this.plugin.settings.customEventTypes,
			this.plugin.settings.showBuiltInEventTypes
		);

		const card = this.resultsContainer.createDiv({ cls: 'crc-picker-item' });

		// Main info
		const mainInfo = card.createDiv({ cls: 'crc-picker-item__main' });
		mainInfo.createDiv({ cls: 'crc-picker-item__name', text: event.title });

		// Meta info
		const metaInfo = card.createDiv({ cls: 'crc-picker-item__meta' });

		// Type badge
		if (typeDef) {
			const typeBadge = metaInfo.createDiv({ cls: 'crc-picker-badge' });
			if (typeDef.color) {
				typeBadge.style.setProperty('background-color', typeDef.color);
				typeBadge.style.setProperty('color', this.getContrastColor(typeDef.color));
			}
			typeBadge.textContent = typeDef.name;
		}

		// Date if available
		if (event.date) {
			const dateBadge = metaInfo.createDiv({ cls: 'crc-picker-badge crc-picker-badge--muted' });
			const dateIcon = createLucideIcon('calendar', 12);
			dateBadge.appendChild(dateIcon);
			dateBadge.appendText(event.date);
		}

		// Click handler
		card.addEventListener('click', () => {
			void this.options.onSelect(event);
			this.close();
		});

		// Hover effect
		card.addEventListener('mouseenter', () => {
			card.addClass('crc-picker-item--hover');
		});
		card.addEventListener('mouseleave', () => {
			card.removeClass('crc-picker-item--hover');
		});
	}

	/**
	 * Get contrasting text color for a background
	 */
	private getContrastColor(hexColor: string): string {
		const hex = hexColor.replace('#', '');
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		return luminance > 0.5 ? '#000000' : '#ffffff';
	}
}
