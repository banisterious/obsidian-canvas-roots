/**
 * Create Event Modal
 * Modal for creating or editing event notes
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
	DATE_PRECISION_LABELS,
	CONFIDENCE_LABELS,
	EVENT_CATEGORY_NAMES,
	getEventTypesByCategory
} from '../types/event-types';

/**
 * Modal for creating or editing event notes
 */
export class CreateEventModal extends Modal {
	private eventService: EventService;
	private settings: CanvasRootsSettings;
	private onCreated?: (file: TFile) => void;

	// Form data
	private title = '';
	private eventType = 'custom';
	private date = '';
	private dateEnd = '';
	private datePrecision: DatePrecision = 'exact';
	private person = '';
	private personCrId = '';
	private persons: { name: string; crId: string }[] = [];
	private place = '';
	private confidence: EventConfidence = 'medium';
	private description = '';
	private isCanonical = false;
	private universe = '';
	private dateSystem = '';
	private timeline = '';

	constructor(
		app: App,
		eventService: EventService,
		settings: CanvasRootsSettings,
		options?: {
			onCreated?: (file: TFile) => void;
			initialPerson?: { name: string; crId: string };
			initialEventType?: string;
		}
	) {
		super(app);
		this.eventService = eventService;
		this.settings = settings;
		this.onCreated = options?.onCreated;

		if (options?.initialPerson) {
			this.person = options.initialPerson.name;
			this.personCrId = options.initialPerson.crId;
		}
		if (options?.initialEventType) {
			this.eventType = options.initialEventType;
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-create-event-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('calendar', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Create event note');

		// Form container
		const form = contentEl.createDiv({ cls: 'crc-form' });

		// Title (required)
		new Setting(form)
			.setName('Title')
			.setDesc('Descriptive title for this event')
			.addText(text => text
				.setPlaceholder('e.g., Birth of John Smith')
				.setValue(this.title)
				.onChange(value => {
					this.title = value;
				}));

		// Event type
		this.createEventTypeDropdown(form);

		// Date section
		const dateSection = form.createDiv({ cls: 'crc-event-date-section' });
		dateSection.createEl('h4', { text: 'Date information', cls: 'crc-section-header' });

		// Date precision
		new Setting(dateSection)
			.setName('Date precision')
			.setDesc('How precise is the date information?')
			.addDropdown(dropdown => {
				for (const [key, label] of Object.entries(DATE_PRECISION_LABELS)) {
					dropdown.addOption(key, label);
				}
				dropdown.setValue(this.datePrecision);
				dropdown.onChange((value: DatePrecision) => {
					this.datePrecision = value;
				});
			});

		// Date
		new Setting(dateSection)
			.setName('Date')
			.setDesc('Event date (YYYY-MM-DD format or fictional calendar format)')
			.addText(text => text
				.setPlaceholder('e.g., 1888-05-15 or 3019 T.A.')
				.setValue(this.date)
				.onChange(value => {
					this.date = value;
				}));

		// End date (for ranges)
		new Setting(dateSection)
			.setName('End date')
			.setDesc('For date ranges only (e.g., residence periods)')
			.addText(text => text
				.setPlaceholder('e.g., 1895-12-31')
				.setValue(this.dateEnd)
				.onChange(value => {
					this.dateEnd = value;
				}));

		// Fictional date system (if enabled)
		if (this.settings.enableFictionalDates) {
			const availableSystems = [
				{ id: '', name: '(Real world dates)' },
				...this.settings.fictionalDateSystems.map(s => ({ id: s.id, name: s.name }))
			];

			if (this.settings.showBuiltInDateSystems) {
				// Add built-in date systems
				availableSystems.push(
					{ id: 'middle_earth', name: 'Middle-earth' },
					{ id: 'westeros', name: 'Westeros' }
				);
			}

			new Setting(dateSection)
				.setName('Date system')
				.setDesc('Fictional calendar system (for worldbuilders)')
				.addDropdown(dropdown => {
					for (const sys of availableSystems) {
						dropdown.addOption(sys.id, sys.name);
					}
					dropdown.setValue(this.dateSystem);
					dropdown.onChange(value => {
						this.dateSystem = value;
					});
				});
		}

		// People section
		const peopleSection = form.createDiv({ cls: 'crc-event-people-section' });
		peopleSection.createEl('h4', { text: 'People involved', cls: 'crc-section-header' });

		// Primary person
		this.createPersonField(peopleSection, 'Primary person', 'The main person this event is about');

		// Additional people (for marriages, group events, etc.)
		// TODO: Add multiple person picker support

		// Place
		new Setting(form)
			.setName('Place')
			.setDesc('Where did this event occur? (wikilink to place note)')
			.addText(text => text
				.setPlaceholder('e.g., [[London, England]]')
				.setValue(this.place)
				.onChange(value => {
					this.place = value;
				}));

		// Timeline
		new Setting(form)
			.setName('Timeline')
			.setDesc('Parent timeline note (wikilink, optional)')
			.addText(text => text
				.setPlaceholder('e.g., [[Smith Family Timeline]]')
				.setValue(this.timeline)
				.onChange(value => {
					this.timeline = value;
				}));

		// Confidence
		new Setting(form)
			.setName('Confidence')
			.setDesc('How confident are you in this event data?')
			.addDropdown(dropdown => {
				for (const [key, label] of Object.entries(CONFIDENCE_LABELS)) {
					dropdown.addOption(key, label);
				}
				dropdown.setValue(this.confidence);
				dropdown.onChange((value: EventConfidence) => {
					this.confidence = value;
				});
			});

		// Description
		new Setting(form)
			.setName('Description')
			.setDesc('Additional details about this event')
			.addTextArea(textArea => {
				textArea.inputEl.rows = 3;
				textArea
					.setPlaceholder('Enter any additional details...')
					.setValue(this.description)
					.onChange(value => {
						this.description = value;
					});
			});

		// Worldbuilder section (for narrative events)
		const narrativeTypes = ['anecdote', 'lore_event', 'plot_point', 'flashback', 'foreshadowing', 'backstory', 'climax', 'resolution'];
		if (narrativeTypes.includes(this.eventType)) {
			const worldSection = form.createDiv({ cls: 'crc-event-world-section' });
			worldSection.createEl('h4', { text: 'Worldbuilding options', cls: 'crc-section-header' });

			// Is canonical
			new Setting(worldSection)
				.setName('Canonical event')
				.setDesc('Mark this as authoritative truth in your world')
				.addToggle(toggle => toggle
					.setValue(this.isCanonical)
					.onChange(value => {
						this.isCanonical = value;
					}));

			// Universe
			new Setting(worldSection)
				.setName('Universe')
				.setDesc('Fictional universe this event belongs to')
				.addText(text => text
					.setPlaceholder('e.g., Middle-earth')
					.setValue(this.universe)
					.onChange(value => {
						this.universe = value;
					}));
		}

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const submitBtn = buttonContainer.createEl('button', {
			text: 'Create event',
			cls: 'crc-btn crc-btn--primary'
		});
		submitBtn.addEventListener('click', () => {
			void this.createEvent();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Create the event type dropdown with categories
	 */
	private createEventTypeDropdown(container: HTMLElement): void {
		const eventTypes = getEventTypesByCategory(
			this.settings.customEventTypes || [],
			this.settings.showBuiltInEventTypes !== false
		);

		new Setting(container)
			.setName('Event type')
			.setDesc('Type of event')
			.addDropdown(dropdown => {
				// Add options grouped by category
				for (const [category, types] of Object.entries(eventTypes)) {
					if (types.length === 0) continue;

					const categoryName = EVENT_CATEGORY_NAMES[category as keyof typeof EVENT_CATEGORY_NAMES];

					// Add category header as disabled option
					dropdown.addOption(`__category_${category}__`, `── ${categoryName} ──`);

					for (const type of types) {
						dropdown.addOption(type.id, `  ${type.name}`);
					}
				}

				dropdown.setValue(this.eventType);
				dropdown.onChange(value => {
					// Ignore category headers
					if (!value.startsWith('__category_')) {
						this.eventType = value;
					}
				});
			});
	}

	/**
	 * Create a person picker field
	 */
	private createPersonField(container: HTMLElement, label: string, description: string): void {
		const setting = new Setting(container)
			.setName(label)
			.setDesc(this.person ? `Linked to: ${this.person}` : description);

		// Text input (readonly, shows selected person name)
		let inputEl: HTMLInputElement;

		setting.addText(text => {
			inputEl = text.inputEl;
			text.setPlaceholder('Click "Link" to select person')
				.setValue(this.person);
			text.inputEl.readOnly = true;
			if (this.person) {
				text.inputEl.addClass('crc-input--linked');
			}
		});

		// Link/Unlink button
		setting.addButton(btn => {
			const updateButton = (isLinked: boolean) => {
				btn.buttonEl.empty();
				btn.buttonEl.addClass('crc-btn', 'crc-btn--secondary');
				if (isLinked) {
					const unlinkIcon = createLucideIcon('unlink', 16);
					btn.buttonEl.appendChild(unlinkIcon);
					btn.buttonEl.appendText(' Unlink');
				} else {
					const linkIcon = createLucideIcon('link', 16);
					btn.buttonEl.appendChild(linkIcon);
					btn.buttonEl.appendText(' Link');
				}
			};

			updateButton(!!this.person);

			btn.onClick(() => {
				if (this.person) {
					// Unlink
					this.person = '';
					this.personCrId = '';
					inputEl.value = '';
					inputEl.removeClass('crc-input--linked');
					setting.setDesc(description);
					updateButton(false);
				} else {
					// Open person picker
					const picker = new PersonPickerModal(this.app, (person: PersonInfo) => {
						this.person = person.name;
						this.personCrId = person.crId;
						inputEl.value = person.name;
						inputEl.addClass('crc-input--linked');
						setting.setDesc(`Linked to: ${person.name}`);
						updateButton(true);
					});
					picker.open();
				}
			});
		});
	}

	/**
	 * Create the event note
	 */
	private async createEvent(): Promise<void> {
		// Validate required fields
		if (!this.title.trim()) {
			new Notice('Please enter a title for the event');
			return;
		}

		try {
			const data: CreateEventData = {
				title: this.title.trim(),
				eventType: this.eventType,
				datePrecision: this.datePrecision,
				confidence: this.confidence
			};

			// Add optional fields if provided
			if (this.date.trim()) {
				data.date = this.date.trim();
			}
			if (this.dateEnd.trim()) {
				data.dateEnd = this.dateEnd.trim();
			}
			if (this.person.trim()) {
				data.person = this.person.trim();
			}
			if (this.place.trim()) {
				data.place = this.place.trim();
			}
			if (this.description.trim()) {
				data.description = this.description.trim();
			}
			if (this.timeline.trim()) {
				data.timeline = this.timeline.trim();
			}
			if (this.isCanonical) {
				data.isCanonical = true;
			}
			if (this.universe.trim()) {
				data.universe = this.universe.trim();
			}
			if (this.dateSystem) {
				data.dateSystem = this.dateSystem;
			}

			const file = await this.eventService.createEvent(data);

			new Notice(`Created event note: ${file.basename}`);

			// Open the created file
			await this.app.workspace.openLinkText(file.path, '', false);

			if (this.onCreated) {
				this.onCreated(file);
			}

			this.close();
		} catch (error) {
			console.error('Failed to create event note:', error);
			new Notice(`Failed to create event note: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
}
