/**
 * Create Event Modal
 * Modal for creating or editing event notes
 */

import { App, Modal, Setting, TFile, Notice } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import { createLucideIcon } from '../../ui/lucide-icons';
import { PersonPickerModal, PersonInfo } from '../../ui/person-picker';
import { PlacePickerModal, SelectedPlaceInfo } from '../../ui/place-picker';
import { RelationshipContext } from '../../ui/quick-create-person-modal';
import { EventService } from '../services/event-service';
import {
	CreateEventData,
	DatePrecision,
	EventConfidence,
	EventNote,
	DATE_PRECISION_LABELS,
	CONFIDENCE_LABELS,
	getCategoryName,
	getEventTypesByCategory
} from '../types/event-types';
import { DEFAULT_DATE_SYSTEMS } from '../../dates/constants/default-date-systems';
import { getCalendariumBridge } from '../../integrations/calendarium-bridge';
import type CanvasRootsPlugin from '../../../main';
import { ModalStatePersistence, renderResumePromptBanner } from '../../ui/modal-state-persistence';

/**
 * Form data structure for persistence
 */
interface EventFormData {
	title: string;
	eventType: string;
	date: string;
	dateEnd: string;
	datePrecision: DatePrecision;
	person: string;
	personCrId: string;
	place: string;
	confidence: EventConfidence;
	description: string;
	isCanonical: boolean;
	universe: string;
	dateSystem: string;
	timeline: string;
}

/**
 * Modal for creating or editing event notes
 */
export class CreateEventModal extends Modal {
	private eventService: EventService;
	private settings: CanvasRootsSettings;
	private onCreated?: (file: TFile) => void;
	private onUpdated?: (file: TFile) => void;

	// Edit mode properties
	private editMode = false;
	private editingFile?: TFile;

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

	// State persistence
	private plugin?: CanvasRootsPlugin;
	private persistence?: ModalStatePersistence<EventFormData>;
	private savedSuccessfully = false;
	private resumeBanner?: HTMLElement;

	constructor(
		app: App,
		eventService: EventService,
		settings: CanvasRootsSettings,
		options?: {
			onCreated?: (file: TFile) => void;
			onUpdated?: (file: TFile) => void;
			initialPerson?: { name: string; crId: string };
			initialEventType?: string;
			// Edit mode options
			editEvent?: EventNote;
			editFile?: TFile;
			// Plugin reference for state persistence
			plugin?: CanvasRootsPlugin;
		}
	) {
		super(app);
		this.eventService = eventService;
		this.settings = settings;
		this.onCreated = options?.onCreated;
		this.onUpdated = options?.onUpdated;
		this.plugin = options?.plugin;

		// Set up persistence (only in create mode)
		if (this.plugin && !options?.editEvent) {
			this.persistence = new ModalStatePersistence<EventFormData>(this.plugin, 'event');
		}

		// Check for edit mode
		if (options?.editEvent && options?.editFile) {
			this.editMode = true;
			this.editingFile = options.editFile;
			const event = options.editEvent;

			// Populate form data from event
			this.title = event.title;
			this.eventType = event.eventType;
			this.date = event.date || '';
			this.dateEnd = event.dateEnd || '';
			this.datePrecision = event.datePrecision;
			// Check persons array first (new format), then fall back to person (legacy)
			const primaryPerson = event.persons?.[0] || event.person || '';
			this.person = primaryPerson.replace(/^\[\[/, '').replace(/\]\]$/, '');
			this.place = event.place?.replace(/^\[\[/, '').replace(/\]\]$/, '') || '';
			this.confidence = event.confidence;
			this.description = event.description || '';
			this.isCanonical = event.isCanonical || false;
			this.universe = event.universe || '';
			this.dateSystem = event.dateSystem || '';
			this.timeline = event.timeline?.replace(/^\[\[/, '').replace(/\]\]$/, '') || '';
		} else {
			// Create mode
			if (options?.initialPerson) {
				this.person = options.initialPerson.name;
				this.personCrId = options.initialPerson.crId;
			}
			if (options?.initialEventType) {
				this.eventType = options.initialEventType;
			}
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
		titleContainer.appendText(this.editMode ? 'Edit event note' : 'Create event note');

		// Check for persisted state (only in create mode)
		if (this.persistence && !this.editMode) {
			const existingState = this.persistence.getValidState();
			if (existingState) {
				const timeAgo = this.persistence.getTimeAgoString(existingState);
				this.resumeBanner = renderResumePromptBanner(
					contentEl,
					timeAgo,
					() => {
						// Discard - clear state and remove banner
						void this.persistence?.clear();
						this.resumeBanner?.remove();
						this.resumeBanner = undefined;
					},
					() => {
						// Restore - populate form with saved data
						this.restoreFromPersistedState(existingState.formData as unknown as EventFormData);
						this.resumeBanner?.remove();
						this.resumeBanner = undefined;
						// Re-render form with restored data
						contentEl.empty();
						this.onOpen();
					}
				);
			}
		}

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
			const availableSystems: { id: string; name: string }[] = [
				{ id: '', name: '(Real world dates)' }
			];

			// Add built-in date systems
			if (this.settings.showBuiltInDateSystems) {
				for (const sys of DEFAULT_DATE_SYSTEMS) {
					availableSystems.push({ id: sys.id, name: sys.name });
				}
			}

			// Add Calendarium calendars if integration is enabled
			if (this.settings.calendariumIntegration === 'read') {
				const bridge = getCalendariumBridge(this.app);
				if (bridge.isAvailable()) {
					const calendariumSystems = bridge.importCalendars();
					for (const sys of calendariumSystems) {
						availableSystems.push({ id: sys.id, name: sys.name });
					}
				}
			}

			// Add custom date systems
			for (const sys of this.settings.fictionalDateSystems) {
				availableSystems.push({ id: sys.id, name: sys.name });
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
		this.createPlaceField(form, 'Place', 'Where did this event occur?');

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
			text: this.editMode ? 'Save changes' : 'Create event',
			cls: 'crc-btn crc-btn--primary'
		});
		submitBtn.addEventListener('click', () => {
			if (this.editMode) {
				void this.updateEvent();
			} else {
				void this.createEvent();
			}
		});
	}

	onClose() {
		const { contentEl } = this;

		// Persist state if not saved successfully and we have persistence enabled
		if (this.persistence && !this.editMode && !this.savedSuccessfully) {
			const formData = this.gatherFormData();
			if (this.persistence.hasContent(formData)) {
				void this.persistence.persist(formData);
			}
		}

		contentEl.empty();
	}

	/**
	 * Gather current form data for persistence
	 */
	private gatherFormData(): EventFormData {
		return {
			title: this.title,
			eventType: this.eventType,
			date: this.date,
			dateEnd: this.dateEnd,
			datePrecision: this.datePrecision,
			person: this.person,
			personCrId: this.personCrId,
			place: this.place,
			confidence: this.confidence,
			description: this.description,
			isCanonical: this.isCanonical,
			universe: this.universe,
			dateSystem: this.dateSystem,
			timeline: this.timeline
		};
	}

	/**
	 * Restore form state from persisted data
	 */
	private restoreFromPersistedState(formData: EventFormData): void {
		this.title = formData.title || '';
		this.eventType = formData.eventType || 'custom';
		this.date = formData.date || '';
		this.dateEnd = formData.dateEnd || '';
		this.datePrecision = formData.datePrecision || 'exact';
		this.person = formData.person || '';
		this.personCrId = formData.personCrId || '';
		this.place = formData.place || '';
		this.confidence = formData.confidence || 'medium';
		this.description = formData.description || '';
		this.isCanonical = formData.isCanonical || false;
		this.universe = formData.universe || '';
		this.dateSystem = formData.dateSystem || '';
		this.timeline = formData.timeline || '';
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

					const categoryName = getCategoryName(
						category,
						this.settings.customEventCategories || [],
						this.settings.categoryCustomizations
					);

					// Add category header as disabled option
					dropdown.addOption(`__category_${category}__`, `── ${categoryName} ──`);

					for (const type of types) {
						dropdown.addOption(type.id, `  ${type.name}`);
					}
				}

				// Disable category header options in the select element
				const selectEl = dropdown.selectEl;
				for (const option of Array.from(selectEl.options)) {
					if (option.value.startsWith('__category_')) {
						option.disabled = true;
						option.addClass('crc-dropdown-category-header');
					}
				}

				dropdown.setValue(this.eventType);
				dropdown.onChange(value => {
					// Safety: ignore category headers if somehow selected
					if (value.startsWith('__category_')) {
						dropdown.setValue(this.eventType);
					} else {
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
					// Open person picker with create context
					const directory = this.settings.peopleFolder || '';

					const createContext: RelationshipContext = {
						relationshipType: 'event_person',
						suggestedSex: undefined,
						parentCrId: undefined,
						directory: directory
					};

					const picker = new PersonPickerModal(this.app, (person: PersonInfo) => {
						this.person = person.name;
						this.personCrId = person.crId;
						inputEl.value = person.name;
						inputEl.addClass('crc-input--linked');
						setting.setDesc(`Linked to: ${person.name}`);
						updateButton(true);
					}, {
						title: 'Select person',
						createContext: createContext,
						onCreateNew: () => {
							// Callback signals inline creation support
						},
						plugin: this.plugin
					});
					picker.open();
				}
			});
		});
	}

	/**
	 * Create a place picker field
	 */
	private createPlaceField(container: HTMLElement, label: string, description: string): void {
		const setting = new Setting(container)
			.setName(label)
			.setDesc(this.place ? `Linked to: ${this.place}` : description);

		// Text input (readonly, shows selected place name)
		let inputEl: HTMLInputElement;

		setting.addText(text => {
			inputEl = text.inputEl;
			text.setPlaceholder('Click "Link" to select place')
				.setValue(this.place);
			text.inputEl.readOnly = true;
			if (this.place) {
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

			updateButton(!!this.place);

			btn.onClick(() => {
				if (this.place) {
					// Unlink
					this.place = '';
					inputEl.value = '';
					inputEl.removeClass('crc-input--linked');
					setting.setDesc(description);
					updateButton(false);
				} else {
					// Open place picker
					const picker = new PlacePickerModal(this.app, (place: SelectedPlaceInfo) => {
						this.place = place.name;
						inputEl.value = place.name;
						inputEl.addClass('crc-input--linked');
						setting.setDesc(`Linked to: ${place.name}`);
						updateButton(true);
					}, {
						settings: this.settings,
						plugin: this.plugin
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

			// Mark as saved successfully and clear persisted state
			this.savedSuccessfully = true;
			if (this.persistence) {
				void this.persistence.clear();
			}

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

	/**
	 * Update an existing event note
	 */
	private async updateEvent(): Promise<void> {
		if (!this.editingFile) {
			new Notice('No file to update');
			return;
		}

		// Validate required fields
		if (!this.title.trim()) {
			new Notice('Please enter a title for the event');
			return;
		}

		try {
			// Read current file content
			const content = await this.app.vault.read(this.editingFile);

			// Parse existing frontmatter
			const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (!frontmatterMatch) {
				new Notice('Could not parse frontmatter');
				return;
			}

			const bodyContent = content.slice(frontmatterMatch[0].length).trim();

			// Build updated frontmatter
			const frontmatterLines: string[] = [];
			frontmatterLines.push(`cr_type: event`);
			frontmatterLines.push(`title: "${this.title.trim().replace(/"/g, '\\"')}"`);
			frontmatterLines.push(`event_type: ${this.eventType}`);

			if (this.date.trim()) {
				frontmatterLines.push(`date: "${this.date.trim()}"`);
			}
			if (this.dateEnd.trim()) {
				frontmatterLines.push(`date_end: "${this.dateEnd.trim()}"`);
			}
			frontmatterLines.push(`date_precision: ${this.datePrecision}`);

			if (this.person.trim()) {
				frontmatterLines.push(`person: "[[${this.person.trim()}]]"`);
			}
			if (this.place.trim()) {
				// Check if already has wikilink brackets
				const placeValue = this.place.trim().startsWith('[[') ? this.place.trim() : `[[${this.place.trim()}]]`;
				frontmatterLines.push(`place: "${placeValue}"`);
			}
			frontmatterLines.push(`confidence: ${this.confidence}`);

			if (this.description.trim()) {
				frontmatterLines.push(`description: "${this.description.trim().replace(/"/g, '\\"')}"`);
			}
			if (this.timeline.trim()) {
				const timelineValue = this.timeline.trim().startsWith('[[') ? this.timeline.trim() : `[[${this.timeline.trim()}]]`;
				frontmatterLines.push(`timeline: "${timelineValue}"`);
			}
			if (this.isCanonical) {
				frontmatterLines.push(`is_canonical: true`);
			}
			if (this.universe.trim()) {
				frontmatterLines.push(`universe: "${this.universe.trim()}"`);
			}
			if (this.dateSystem) {
				frontmatterLines.push(`date_system: ${this.dateSystem}`);
			}

			// Preserve cr_id from original frontmatter
			const crIdMatch = frontmatterMatch[1].match(/cr_id:\s*(.+)/);
			if (crIdMatch) {
				frontmatterLines.push(`cr_id: ${crIdMatch[1].trim()}`);
			}

			// Preserve before/after relationships if they exist
			const beforeMatch = frontmatterMatch[1].match(/before:\s*([\s\S]*?)(?=\n[a-z_]+:|$)/);
			if (beforeMatch) {
				frontmatterLines.push(`before:${beforeMatch[1]}`);
			}
			const afterMatch = frontmatterMatch[1].match(/after:\s*([\s\S]*?)(?=\n[a-z_]+:|$)/);
			if (afterMatch) {
				frontmatterLines.push(`after:${afterMatch[1]}`);
			}

			// Preserve sources if they exist
			const sourcesMatch = frontmatterMatch[1].match(/sources:\s*([\s\S]*?)(?=\n[a-z_]+:|$)/);
			if (sourcesMatch) {
				frontmatterLines.push(`sources:${sourcesMatch[1]}`);
			}

			// Preserve sort_order if it exists
			const sortOrderMatch = frontmatterMatch[1].match(/sort_order:\s*(\d+)/);
			if (sortOrderMatch) {
				frontmatterLines.push(`sort_order: ${sortOrderMatch[1]}`);
			}

			// Build new content
			const newContent = `---\n${frontmatterLines.join('\n')}\n---\n\n${bodyContent}`;

			// Write updated content
			await this.app.vault.modify(this.editingFile, newContent);

			new Notice(`Updated event note: ${this.editingFile.basename}`);

			// Invalidate cache
			this.eventService.invalidateCache();

			if (this.onUpdated) {
				this.onUpdated(this.editingFile);
			}

			this.close();
		} catch (error) {
			console.error('Failed to update event note:', error);
			new Notice(`Failed to update event note: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
}
