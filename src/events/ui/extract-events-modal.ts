/**
 * Extract Events Modal
 *
 * Modal for extracting event notes from a source document.
 * Pre-populates event data from source metadata and allows
 * batch creation of multiple events.
 */

import { App, Modal, Setting, TFile, Notice } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import { createLucideIcon } from '../../ui/lucide-icons';
import { PersonPickerModal, PersonInfo } from '../../ui/person-picker';
import { EventService } from '../services/event-service';
import {
	CreateEventData,
	DatePrecision,
	EventConfidence,
	EventTypeDefinition,
	getAllEventTypes,
	getEventTypesByCategory,
	EVENT_CATEGORY_NAMES
} from '../types/event-types';
import type { SourceNote } from '../../sources/types/source-types';

/**
 * Suggested event to extract from a source
 */
interface SuggestedEvent {
	id: string;
	selected: boolean;
	eventType: string;
	title: string;
	date: string;
	datePrecision: DatePrecision;
	person: string;
	personCrId: string;
	place: string;
	description: string;
}

/**
 * Modal for extracting events from a source note
 */
export class ExtractEventsModal extends Modal {
	private eventService: EventService;
	private settings: CanvasRootsSettings;
	private source: SourceNote;
	private sourceFile: TFile;
	private onComplete?: () => void;

	// Suggested events
	private suggestedEvents: SuggestedEvent[] = [];

	// Default values from source
	private defaultDate: string = '';
	private defaultPlace: string = '';
	private defaultConfidence: EventConfidence = 'medium';

	constructor(
		app: App,
		eventService: EventService,
		settings: CanvasRootsSettings,
		source: SourceNote,
		sourceFile: TFile,
		options?: {
			onComplete?: () => void;
		}
	) {
		super(app);
		this.eventService = eventService;
		this.settings = settings;
		this.source = source;
		this.sourceFile = sourceFile;
		this.onComplete = options?.onComplete;

		// Extract defaults from source
		this.defaultDate = source.date || '';
		this.defaultPlace = source.location || '';
		this.defaultConfidence = source.confidence || 'medium';

		// Generate initial suggestions based on source type
		this.generateSuggestions();
	}

	/**
	 * Generate event suggestions based on source type
	 */
	private generateSuggestions(): void {
		const sourceType = this.source.sourceType;

		// Common event types by source type
		const eventTypesBySrc: Record<string, string[]> = {
			'vital_record': ['birth', 'death', 'marriage'],
			'census': ['residence', 'occupation'],
			'church_record': ['baptism', 'marriage', 'burial', 'confirmation'],
			'obituary': ['death', 'burial'],
			'military_record': ['military'],
			'immigration_record': ['immigration'],
			'court_record': ['marriage', 'divorce'],
			'land_record': ['residence'],
			'newspaper': ['death', 'marriage', 'anecdote'],
			'photograph': ['anecdote'],
			'letter': ['anecdote'],
			'will': ['death']
		};

		const suggestedTypes = eventTypesBySrc[sourceType] || ['custom'];

		// Create one suggestion per event type
		suggestedTypes.forEach((eventType, index) => {
			const eventTypeDef = this.getEventTypeDef(eventType);
			this.suggestedEvents.push({
				id: `event-${index}`,
				selected: index === 0, // Select first by default
				eventType,
				title: eventTypeDef ? `${eventTypeDef.name} from ${this.source.title}` : this.source.title,
				date: this.defaultDate,
				datePrecision: this.defaultDate ? 'exact' : 'unknown',
				person: '',
				personCrId: '',
				place: this.defaultPlace,
				description: ''
			});
		});
	}

	private getEventTypeDef(typeId: string): EventTypeDefinition | undefined {
		const allTypes = getAllEventTypes(
			this.settings.customEventTypes || [],
			this.settings.showBuiltInEventTypes !== false
		);
		return allTypes.find(t => t.id === typeId);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-extract-events-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('calendar-plus', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Extract events from source');

		// Source info
		const sourceInfo = contentEl.createDiv({ cls: 'crc-extract-source-info' });
		sourceInfo.createEl('strong', { text: this.source.title });
		if (this.source.date) {
			sourceInfo.createEl('span', { text: ` (${this.source.date})`, cls: 'crc-text--muted' });
		}

		// Instructions
		contentEl.createEl('p', {
			text: 'Select events to create from this source. Each event will be linked to this source automatically.',
			cls: 'crc-text--muted crc-mb-3'
		});

		// Events container
		const eventsContainer = contentEl.createDiv({ cls: 'crc-extract-events-list' });

		// Render each suggested event
		this.suggestedEvents.forEach(event => {
			this.renderEventSuggestion(eventsContainer, event);
		});

		// Add event button
		const addBtnContainer = contentEl.createDiv({ cls: 'crc-extract-add-event' });
		const addBtn = addBtnContainer.createEl('button', {
			cls: 'crc-btn crc-btn--secondary'
		});
		const plusIcon = createLucideIcon('plus', 16);
		addBtn.appendChild(plusIcon);
		addBtn.appendText(' Add another event');
		addBtn.addEventListener('click', () => {
			const newEvent: SuggestedEvent = {
				id: `event-${Date.now()}`,
				selected: true,
				eventType: 'custom',
				title: '',
				date: this.defaultDate,
				datePrecision: this.defaultDate ? 'exact' : 'unknown',
				person: '',
				personCrId: '',
				place: this.defaultPlace,
				description: ''
			};
			this.suggestedEvents.push(newEvent);
			this.renderEventSuggestion(eventsContainer, newEvent);
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const extractBtn = buttonContainer.createEl('button', {
			cls: 'crc-btn crc-btn--primary'
		});
		const calIcon = createLucideIcon('calendar-check', 16);
		extractBtn.appendChild(calIcon);
		extractBtn.appendText(' Create selected events');
		extractBtn.addEventListener('click', () => {
			void this.createEvents();
		});
	}

	/**
	 * Render a single event suggestion
	 */
	private renderEventSuggestion(container: HTMLElement, event: SuggestedEvent): void {
		const eventCard = container.createDiv({
			cls: `crc-extract-event-card ${event.selected ? 'crc-extract-event-card--selected' : ''}`,
			attr: { 'data-event-id': event.id }
		});

		// Selection checkbox
		const headerRow = eventCard.createDiv({ cls: 'crc-extract-event-header' });

		new Setting(headerRow)
			.setName('Include this event')
			.addToggle(toggle => toggle
				.setValue(event.selected)
				.onChange(value => {
					event.selected = value;
					eventCard.toggleClass('crc-extract-event-card--selected', value);
				}));

		// Event type
		const eventTypes = getEventTypesByCategory(
			this.settings.customEventTypes || [],
			this.settings.showBuiltInEventTypes !== false
		);

		new Setting(eventCard)
			.setName('Event type')
			.addDropdown(dropdown => {
				for (const [category, types] of Object.entries(eventTypes)) {
					if (types.length === 0) continue;
					const categoryName = EVENT_CATEGORY_NAMES[category as keyof typeof EVENT_CATEGORY_NAMES];
					dropdown.addOption(`__category_${category}__`, `── ${categoryName} ──`);
					for (const type of types) {
						dropdown.addOption(type.id, `  ${type.name}`);
					}
				}
				dropdown.setValue(event.eventType);
				dropdown.onChange(value => {
					if (!value.startsWith('__category_')) {
						event.eventType = value;
						// Update title if it's the default pattern
						const typeDef = this.getEventTypeDef(value);
						if (typeDef && (!event.title || event.title.includes(' from '))) {
							event.title = `${typeDef.name} from ${this.source.title}`;
							// Re-render to update title field
							const titleInput = eventCard.querySelector('.crc-extract-event-title input') as HTMLInputElement;
							if (titleInput) titleInput.value = event.title;
						}
					}
				});
			});

		// Title
		new Setting(eventCard)
			.setClass('crc-extract-event-title')
			.setName('Title')
			.addText(text => text
				.setPlaceholder('Event title')
				.setValue(event.title)
				.onChange(value => {
					event.title = value;
				}));

		// Date row
		const dateRow = eventCard.createDiv({ cls: 'crc-extract-event-row' });

		new Setting(dateRow)
			.setName('Date')
			.addText(text => text
				.setPlaceholder('YYYY-MM-DD')
				.setValue(event.date)
				.onChange(value => {
					event.date = value;
				}));

		// Person picker
		const personSetting = new Setting(eventCard)
			.setName('Person')
			.setDesc(event.person ? `Linked: ${event.person}` : 'Primary person for this event');

		let personInput: HTMLInputElement;
		personSetting.addText(text => {
			personInput = text.inputEl;
			text.setPlaceholder('Click Link to select')
				.setValue(event.person);
			text.inputEl.readOnly = true;
		});

		personSetting.addButton(btn => {
			btn.buttonEl.empty();
			btn.buttonEl.addClass('crc-btn', 'crc-btn--secondary');
			if (event.person) {
				const unlinkIcon = createLucideIcon('unlink', 16);
				btn.buttonEl.appendChild(unlinkIcon);
				btn.buttonEl.appendText(' Unlink');
			} else {
				const linkIcon = createLucideIcon('link', 16);
				btn.buttonEl.appendChild(linkIcon);
				btn.buttonEl.appendText(' Link');
			}

			btn.onClick(() => {
				if (event.person) {
					event.person = '';
					event.personCrId = '';
					personInput.value = '';
					personSetting.setDesc('Primary person for this event');
					// Re-render button
					btn.buttonEl.empty();
					btn.buttonEl.addClass('crc-btn', 'crc-btn--secondary');
					const linkIcon = createLucideIcon('link', 16);
					btn.buttonEl.appendChild(linkIcon);
					btn.buttonEl.appendText(' Link');
				} else {
					const picker = new PersonPickerModal(this.app, (person: PersonInfo) => {
						event.person = person.name;
						event.personCrId = person.crId;
						personInput.value = person.name;
						personSetting.setDesc(`Linked: ${person.name}`);
						// Re-render button
						btn.buttonEl.empty();
						btn.buttonEl.addClass('crc-btn', 'crc-btn--secondary');
						const unlinkIcon = createLucideIcon('unlink', 16);
						btn.buttonEl.appendChild(unlinkIcon);
						btn.buttonEl.appendText(' Unlink');
					});
					picker.open();
				}
			});
		});

		// Place
		new Setting(eventCard)
			.setName('Place')
			.addText(text => text
				.setPlaceholder('[[Place Name]]')
				.setValue(event.place)
				.onChange(value => {
					event.place = value;
				}));

		// Remove button
		const removeBtn = eventCard.createEl('button', {
			cls: 'crc-extract-event-remove',
			attr: { title: 'Remove this event' }
		});
		const removeIcon = createLucideIcon('x', 16);
		removeBtn.appendChild(removeIcon);
		removeBtn.addEventListener('click', () => {
			const index = this.suggestedEvents.findIndex(e => e.id === event.id);
			if (index !== -1) {
				this.suggestedEvents.splice(index, 1);
				eventCard.remove();
			}
		});
	}

	/**
	 * Create the selected events
	 */
	private async createEvents(): Promise<void> {
		const selectedEvents = this.suggestedEvents.filter(e => e.selected);

		if (selectedEvents.length === 0) {
			new Notice('No events selected. Please select at least one event to create.');
			return;
		}

		// Validate
		for (const event of selectedEvents) {
			if (!event.title.trim()) {
				new Notice('Please enter a title for all selected events');
				return;
			}
		}

		try {
			let createdCount = 0;

			for (const event of selectedEvents) {
				const data: CreateEventData = {
					title: event.title.trim(),
					eventType: event.eventType,
					datePrecision: event.datePrecision,
					confidence: this.defaultConfidence,
					sources: [`[[${this.sourceFile.basename}]]`]
				};

				if (event.date.trim()) {
					data.date = event.date.trim();
				}
				if (event.person.trim()) {
					data.person = event.person.trim();
				}
				if (event.place.trim()) {
					data.place = event.place.trim();
				}

				await this.eventService.createEvent(data);
				createdCount++;
			}

			new Notice(`Created ${createdCount} event${createdCount !== 1 ? 's' : ''} from source`);

			if (this.onComplete) {
				this.onComplete();
			}

			this.close();
		} catch (error) {
			console.error('Failed to create events:', error);
			new Notice(`Failed to create events: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
