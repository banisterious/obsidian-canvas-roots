/**
 * Universe Setup Wizard
 *
 * Multi-step wizard for creating new universes with optional
 * calendar, map, and schema configuration.
 */

import { Modal, Setting, Notice, TFile, setIcon } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import { UniverseService } from '../services/universe-service';
import type { UniverseStatus, CreateUniverseData } from '../types/universe-types';
import type { FictionalDateSystem, FictionalEra } from '../../dates/types/date-types';
import { createLucideIcon, setLucideIcon } from '../../ui/lucide-icons';

/**
 * Wizard step identifiers
 */
type WizardStep = 'universe' | 'calendar' | 'map' | 'schema' | 'summary';

/**
 * Step configuration
 */
interface StepConfig {
	id: WizardStep;
	title: string;
	subtitle: string;
	skippable: boolean;
}

const WIZARD_STEPS: StepConfig[] = [
	{ id: 'universe', title: 'Create universe', subtitle: 'Basic information', skippable: false },
	{ id: 'calendar', title: 'Custom calendar', subtitle: 'Optional', skippable: true },
	{ id: 'map', title: 'Custom map', subtitle: 'Optional', skippable: true },
	{ id: 'schema', title: 'Validation rules', subtitle: 'Optional', skippable: true },
	{ id: 'summary', title: 'Summary', subtitle: 'Review and create', skippable: false }
];

/**
 * Form data for universe creation
 */
interface UniverseFormData {
	name: string;
	description: string;
	author: string;
	genre: string;
	status: UniverseStatus;
}

/**
 * Form data for calendar step
 */
interface CalendarFormData {
	enabled: boolean;
	name: string;
	eras: FictionalEra[];
	defaultEra: string;
}

/**
 * Form data for map step
 */
interface MapFormData {
	enabled: boolean;
	name: string;
	imagePath: string;
	coordinateSystem: 'geographic' | 'pixel';
	boundsNorth: number;
	boundsSouth: number;
	boundsEast: number;
	boundsWest: number;
}

/**
 * Form data for schema step
 */
interface SchemaFormData {
	enabled: boolean;
	name: string;
	requiredProperties: string[];
}

/**
 * Created entities tracking
 */
interface CreatedEntities {
	universe?: TFile;
	calendar?: boolean;
	map?: TFile;
	schema?: TFile;
}

/**
 * Universe Setup Wizard Modal
 */
export class UniverseWizardModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private universeService: UniverseService;
	private currentStep: number = 0;
	private onComplete?: (universeFile: TFile) => void;

	// Form data
	private universeData: UniverseFormData;
	private calendarData: CalendarFormData;
	private mapData: MapFormData;
	private schemaData: SchemaFormData;

	// Created entities
	private created: CreatedEntities = {};

	// UI elements
	private contentContainer?: HTMLElement;
	private progressContainer?: HTMLElement;

	constructor(
		plugin: CanvasRootsPlugin,
		options?: {
			onComplete?: (universeFile: TFile) => void;
		}
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.universeService = new UniverseService(plugin);
		this.onComplete = options?.onComplete;

		// Initialize form data with defaults
		this.universeData = {
			name: '',
			description: '',
			author: '',
			genre: '',
			status: 'active'
		};

		this.calendarData = {
			enabled: false,
			name: '',
			eras: [],
			defaultEra: ''
		};

		this.mapData = {
			enabled: false,
			name: '',
			imagePath: '',
			coordinateSystem: 'geographic',
			boundsNorth: 100,
			boundsSouth: -100,
			boundsEast: 100,
			boundsWest: -100
		};

		this.schemaData = {
			enabled: false,
			name: '',
			requiredProperties: []
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass('cr-universe-wizard');

		// Header
		const header = contentEl.createDiv({ cls: 'cr-wizard-header' });
		const titleContainer = header.createDiv({ cls: 'cr-wizard-title' });
		const icon = createLucideIcon('globe', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Universe setup wizard');

		// Progress indicator
		this.progressContainer = contentEl.createDiv({ cls: 'cr-wizard-progress' });
		this.renderProgress();

		// Content area
		this.contentContainer = contentEl.createDiv({ cls: 'cr-wizard-content' });
		this.renderCurrentStep();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	/**
	 * Render the progress indicator
	 */
	private renderProgress(): void {
		if (!this.progressContainer) return;
		this.progressContainer.empty();

		const stepsContainer = this.progressContainer.createDiv({ cls: 'cr-wizard-steps' });

		for (let i = 0; i < WIZARD_STEPS.length; i++) {
			const step = WIZARD_STEPS[i];
			const stepEl = stepsContainer.createDiv({
				cls: `cr-wizard-step ${i === this.currentStep ? 'cr-wizard-step--active' : ''} ${i < this.currentStep ? 'cr-wizard-step--completed' : ''}`
			});

			const stepNumber = stepEl.createDiv({ cls: 'cr-wizard-step-number' });
			if (i < this.currentStep) {
				setLucideIcon(stepNumber, 'check', 14);
			} else {
				stepNumber.setText(String(i + 1));
			}

			const stepInfo = stepEl.createDiv({ cls: 'cr-wizard-step-info' });
			stepInfo.createDiv({ cls: 'cr-wizard-step-title', text: step.title });

			// Add connector line (except for last step)
			if (i < WIZARD_STEPS.length - 1) {
				stepsContainer.createDiv({
					cls: `cr-wizard-connector ${i < this.currentStep ? 'cr-wizard-connector--completed' : ''}`
				});
			}
		}
	}

	/**
	 * Render the current step content
	 */
	private renderCurrentStep(): void {
		if (!this.contentContainer) return;
		this.contentContainer.empty();

		const step = WIZARD_STEPS[this.currentStep];

		// Step header
		const stepHeader = this.contentContainer.createDiv({ cls: 'cr-wizard-step-header' });
		stepHeader.createEl('h3', { text: step.title, cls: 'cr-wizard-step-heading' });
		stepHeader.createEl('p', { text: `Step ${this.currentStep + 1} of ${WIZARD_STEPS.length}`, cls: 'cr-wizard-step-counter' });

		// Step content
		const stepContent = this.contentContainer.createDiv({ cls: 'cr-wizard-step-content' });

		switch (step.id) {
			case 'universe':
				this.renderUniverseStep(stepContent);
				break;
			case 'calendar':
				this.renderCalendarStep(stepContent);
				break;
			case 'map':
				this.renderMapStep(stepContent);
				break;
			case 'schema':
				this.renderSchemaStep(stepContent);
				break;
			case 'summary':
				this.renderSummaryStep(stepContent);
				break;
		}

		// Navigation buttons
		this.renderNavigation();
	}

	/**
	 * Render Step 1: Universe basic info
	 */
	private renderUniverseStep(container: HTMLElement): void {
		container.createEl('p', {
			text: 'Enter basic information about your fictional universe.',
			cls: 'cr-wizard-step-desc'
		});

		const form = container.createDiv({ cls: 'cr-wizard-form' });

		// Name (required)
		new Setting(form)
			.setName('Universe name')
			.setDesc('The name of your fictional world')
			.addText(text => text
				.setPlaceholder('e.g., Middle-earth, Westeros')
				.setValue(this.universeData.name)
				.onChange(value => {
					this.universeData.name = value;
					// Auto-fill related names if empty
					if (!this.calendarData.name) {
						this.calendarData.name = `${value} Calendar`;
					}
					if (!this.mapData.name) {
						this.mapData.name = `${value} Map`;
					}
					if (!this.schemaData.name) {
						this.schemaData.name = `${value} Schema`;
					}
				}));

		// Description
		new Setting(form)
			.setName('Description')
			.setDesc('Brief description of the universe')
			.addTextArea(text => {
				text.setPlaceholder('A fantasy world where...')
					.setValue(this.universeData.description)
					.onChange(value => {
						this.universeData.description = value;
					});
				text.inputEl.rows = 3;
			});

		// Collapsible additional details
		const detailsContainer = form.createDiv({ cls: 'cr-wizard-details' });
		const detailsHeader = detailsContainer.createDiv({ cls: 'cr-wizard-details-header' });
		const detailsToggle = detailsHeader.createEl('button', {
			cls: 'cr-wizard-details-toggle',
			attr: { type: 'button' }
		});
		const toggleIcon = createLucideIcon('chevron-right', 16);
		detailsToggle.appendChild(toggleIcon);
		detailsToggle.createSpan({ text: 'Additional details (optional)' });

		const detailsContent = detailsContainer.createDiv({ cls: 'cr-wizard-details-content cr-hidden' });

		detailsToggle.addEventListener('click', () => {
			const isHidden = detailsContent.hasClass('cr-hidden');
			detailsContent.toggleClass('cr-hidden', !isHidden);
			// Update the icon
			toggleIcon.empty();
			setIcon(toggleIcon, isHidden ? 'chevron-down' : 'chevron-right');
		});

		// Author
		new Setting(detailsContent)
			.setName('Author')
			.setDesc('Creator of the fictional world')
			.addText(text => text
				.setPlaceholder('e.g., J.R.R. Tolkien')
				.setValue(this.universeData.author)
				.onChange(value => {
					this.universeData.author = value;
				}));

		// Genre
		new Setting(detailsContent)
			.setName('Genre')
			.setDesc('Genre or category')
			.addDropdown(dropdown => dropdown
				.addOption('', 'Select genre...')
				.addOption('fantasy', 'Fantasy')
				.addOption('sci-fi', 'Science Fiction')
				.addOption('historical', 'Historical Fiction')
				.addOption('horror', 'Horror')
				.addOption('mystery', 'Mystery')
				.addOption('romance', 'Romance')
				.addOption('other', 'Other')
				.setValue(this.universeData.genre)
				.onChange(value => {
					this.universeData.genre = value;
				}));

		// Status
		new Setting(detailsContent)
			.setName('Status')
			.setDesc('Universe status')
			.addDropdown(dropdown => dropdown
				.addOption('active', 'Active')
				.addOption('draft', 'Draft')
				.addOption('archived', 'Archived')
				.setValue(this.universeData.status)
				.onChange(value => {
					this.universeData.status = value as UniverseStatus;
				}));
	}

	/**
	 * Render Step 2: Custom calendar
	 */
	private renderCalendarStep(container: HTMLElement): void {
		container.createEl('p', {
			text: `Would you like a custom calendar for ${this.universeData.name || 'this universe'}?`,
			cls: 'cr-wizard-step-desc'
		});

		container.createEl('p', {
			text: 'Custom calendars let you use fictional dates like "Third Age 3019" instead of real-world dates.',
			cls: 'cr-wizard-step-hint'
		});

		const form = container.createDiv({ cls: 'cr-wizard-form' });

		// Enable toggle
		new Setting(form)
			.setName('Create custom calendar')
			.setDesc('Set up a fictional date system for this universe')
			.addToggle(toggle => toggle
				.setValue(this.calendarData.enabled)
				.onChange(value => {
					this.calendarData.enabled = value;
					this.renderCurrentStep();
				}));

		if (!this.calendarData.enabled) {
			return;
		}

		// Calendar name
		new Setting(form)
			.setName('Calendar name')
			.setDesc('Display name for the calendar system')
			.addText(text => text
				.setPlaceholder('e.g., Shire Reckoning')
				.setValue(this.calendarData.name)
				.onChange(value => {
					this.calendarData.name = value;
				}));

		// Eras section
		form.createEl('h4', { text: 'Eras', cls: 'cr-wizard-subsection' });
		form.createEl('p', {
			text: 'Define the time periods (eras) used in your calendar.',
			cls: 'cr-wizard-hint'
		});

		const erasContainer = form.createDiv({ cls: 'cr-wizard-eras' });
		this.renderEras(erasContainer);

		const addEraBtn = form.createEl('button', {
			text: 'Add era',
			cls: 'cr-btn cr-btn--secondary cr-btn--small'
		});
		addEraBtn.prepend(createLucideIcon('plus', 14));
		addEraBtn.addEventListener('click', () => {
			this.calendarData.eras.push({
				id: `era_${this.calendarData.eras.length + 1}`,
				name: '',
				abbrev: '',
				epoch: 0,
				direction: 'forward'
			});
			this.renderEras(erasContainer);
		});
	}

	/**
	 * Render eras list
	 */
	private renderEras(container: HTMLElement): void {
		container.empty();

		if (this.calendarData.eras.length === 0) {
			container.createEl('p', {
				text: 'No eras defined. Add at least one era for the calendar.',
				cls: 'cr-wizard-empty'
			});
			return;
		}

		const table = container.createEl('table', { cls: 'cr-wizard-era-table' });
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Name' });
		headerRow.createEl('th', { text: 'Abbreviation' });
		headerRow.createEl('th', { text: 'Epoch' });
		headerRow.createEl('th', { text: '' });

		const tbody = table.createEl('tbody');

		for (let i = 0; i < this.calendarData.eras.length; i++) {
			const era = this.calendarData.eras[i];
			const row = tbody.createEl('tr');

			// Name
			const nameCell = row.createEl('td');
			const nameInput = nameCell.createEl('input', {
				type: 'text',
				cls: 'cr-wizard-input',
				value: era.name,
				attr: { placeholder: 'e.g., Third Age' }
			});
			nameInput.addEventListener('input', () => {
				era.name = nameInput.value;
				era.id = nameInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '_');
			});

			// Abbreviation
			const abbrevCell = row.createEl('td');
			const abbrevInput = abbrevCell.createEl('input', {
				type: 'text',
				cls: 'cr-wizard-input cr-wizard-input--short',
				value: era.abbrev,
				attr: { placeholder: 'TA' }
			});
			abbrevInput.addEventListener('input', () => {
				era.abbrev = abbrevInput.value;
			});

			// Epoch
			const epochCell = row.createEl('td');
			const epochInput = epochCell.createEl('input', {
				type: 'number',
				cls: 'cr-wizard-input cr-wizard-input--short',
				value: String(era.epoch),
				attr: { placeholder: '0' }
			});
			epochInput.addEventListener('input', () => {
				era.epoch = parseInt(epochInput.value) || 0;
			});

			// Remove button
			const actionsCell = row.createEl('td');
			const removeBtn = actionsCell.createEl('button', {
				cls: 'cr-btn cr-btn--icon cr-btn--danger',
				attr: { 'aria-label': 'Remove era' }
			});
			setLucideIcon(removeBtn, 'x', 14);
			removeBtn.addEventListener('click', () => {
				this.calendarData.eras.splice(i, 1);
				this.renderEras(container);
			});
		}
	}

	/**
	 * Render Step 3: Custom map
	 */
	private renderMapStep(container: HTMLElement): void {
		container.createEl('p', {
			text: `Would you like a custom map for ${this.universeData.name || 'this universe'}?`,
			cls: 'cr-wizard-step-desc'
		});

		container.createEl('p', {
			text: 'Custom maps let you visualize places on a fictional world map.',
			cls: 'cr-wizard-step-hint'
		});

		const form = container.createDiv({ cls: 'cr-wizard-form' });

		// Enable toggle
		new Setting(form)
			.setName('Create custom map')
			.setDesc('Set up a fictional world map for this universe')
			.addToggle(toggle => toggle
				.setValue(this.mapData.enabled)
				.onChange(value => {
					this.mapData.enabled = value;
					this.renderCurrentStep();
				}));

		if (!this.mapData.enabled) {
			return;
		}

		// Map name
		new Setting(form)
			.setName('Map name')
			.setDesc('Display name for the map')
			.addText(text => text
				.setPlaceholder('e.g., Middle-earth Map')
				.setValue(this.mapData.name)
				.onChange(value => {
					this.mapData.name = value;
				}));

		// Image path
		const imagePathSetting = new Setting(form)
			.setName('Image path')
			.setDesc('Path to the map image file in your vault');

		imagePathSetting.addText(text => text
			.setPlaceholder('e.g., assets/maps/world-map.jpg')
			.setValue(this.mapData.imagePath)
			.onChange(value => {
				this.mapData.imagePath = value;
			}));

		imagePathSetting.addButton(btn => {
			btn.setButtonText('Browse')
				.onClick(() => {
					this.browseForImage();
				});
		});

		// Note about configuring bounds later
		form.createEl('p', {
			text: 'You can configure map bounds and coordinates after creation by editing the map note.',
			cls: 'cr-wizard-hint'
		});
	}

	/**
	 * Browse for an image file
	 */
	private browseForImage(): void {
		const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
		const allFiles = this.app.vault.getFiles();
		const imageFiles = allFiles.filter(f =>
			imageExtensions.includes(f.extension.toLowerCase())
		);

		if (imageFiles.length === 0) {
			new Notice('No image files found in vault');
			return;
		}

		// Create a simple file picker modal
		const picker = new ImagePickerModal(this.app, imageFiles, (selectedPath) => {
			this.mapData.imagePath = selectedPath;
			this.renderCurrentStep();
		});
		picker.open();
	}

	/**
	 * Render Step 4: Validation schema
	 */
	private renderSchemaStep(container: HTMLElement): void {
		container.createEl('p', {
			text: `Would you like validation rules for ${this.universeData.name || 'this universe'}?`,
			cls: 'cr-wizard-step-desc'
		});

		container.createEl('p', {
			text: 'Schemas validate that entity notes have required properties and correct data types.',
			cls: 'cr-wizard-step-hint'
		});

		const form = container.createDiv({ cls: 'cr-wizard-form' });

		// Enable toggle
		new Setting(form)
			.setName('Create validation schema')
			.setDesc('Set up validation rules for entities in this universe')
			.addToggle(toggle => toggle
				.setValue(this.schemaData.enabled)
				.onChange(value => {
					this.schemaData.enabled = value;
					this.renderCurrentStep();
				}));

		if (!this.schemaData.enabled) {
			return;
		}

		// Schema name
		new Setting(form)
			.setName('Schema name')
			.setDesc('Display name for the schema')
			.addText(text => text
				.setPlaceholder('e.g., Middle-earth Schema')
				.setValue(this.schemaData.name)
				.onChange(value => {
					this.schemaData.name = value;
				}));

		// Required properties
		form.createEl('h4', { text: 'Required properties', cls: 'cr-wizard-subsection' });
		form.createEl('p', {
			text: 'Properties that must be present on all people in this universe.',
			cls: 'cr-wizard-hint'
		});

		const propsContainer = form.createDiv({ cls: 'cr-wizard-props' });
		this.renderRequiredProps(propsContainer);

		const addPropBtn = form.createEl('button', {
			text: 'Add property',
			cls: 'cr-btn cr-btn--secondary cr-btn--small'
		});
		addPropBtn.prepend(createLucideIcon('plus', 14));
		addPropBtn.addEventListener('click', () => {
			this.schemaData.requiredProperties.push('');
			this.renderRequiredProps(propsContainer);
		});

		// Note about advanced configuration
		form.createEl('p', {
			text: 'You can add more complex validation rules by editing the schema note after creation.',
			cls: 'cr-wizard-hint cr-mt-2'
		});
	}

	/**
	 * Render required properties list
	 */
	private renderRequiredProps(container: HTMLElement): void {
		container.empty();

		if (this.schemaData.requiredProperties.length === 0) {
			container.createEl('p', {
				text: 'No required properties. Add properties that all entities must have.',
				cls: 'cr-wizard-empty'
			});
			return;
		}

		for (let i = 0; i < this.schemaData.requiredProperties.length; i++) {
			const propRow = container.createDiv({ cls: 'cr-wizard-prop-row' });

			const input = propRow.createEl('input', {
				type: 'text',
				cls: 'cr-wizard-input',
				value: this.schemaData.requiredProperties[i],
				attr: { placeholder: 'e.g., allegiance, house' }
			});
			input.addEventListener('input', () => {
				this.schemaData.requiredProperties[i] = input.value;
			});

			const removeBtn = propRow.createEl('button', {
				cls: 'cr-btn cr-btn--icon cr-btn--danger',
				attr: { 'aria-label': 'Remove' }
			});
			setLucideIcon(removeBtn, 'x', 14);
			removeBtn.addEventListener('click', () => {
				this.schemaData.requiredProperties.splice(i, 1);
				this.renderRequiredProps(container);
			});
		}
	}

	/**
	 * Render Step 5: Summary
	 */
	private renderSummaryStep(container: HTMLElement): void {
		container.createEl('p', {
			text: 'Review your universe configuration before creating.',
			cls: 'cr-wizard-step-desc'
		});

		const summary = container.createDiv({ cls: 'cr-wizard-summary' });

		// Universe info
		const universeCard = summary.createDiv({ cls: 'cr-wizard-summary-card' });
		const universeHeader = universeCard.createDiv({ cls: 'cr-wizard-summary-header' });
		universeHeader.appendChild(createLucideIcon('globe', 18));
		universeHeader.createSpan({ text: 'Universe' });
		universeCard.createDiv({ cls: 'cr-wizard-summary-item', text: `Name: ${this.universeData.name}` });
		if (this.universeData.description) {
			universeCard.createDiv({ cls: 'cr-wizard-summary-item cr-wizard-summary-item--desc', text: this.universeData.description });
		}
		if (this.universeData.author) {
			universeCard.createDiv({ cls: 'cr-wizard-summary-item', text: `Author: ${this.universeData.author}` });
		}
		if (this.universeData.genre) {
			universeCard.createDiv({ cls: 'cr-wizard-summary-item', text: `Genre: ${this.universeData.genre}` });
		}

		// Calendar
		const calendarCard = summary.createDiv({ cls: 'cr-wizard-summary-card' });
		const calendarHeader = calendarCard.createDiv({ cls: 'cr-wizard-summary-header' });
		calendarHeader.appendChild(createLucideIcon('calendar', 18));
		calendarHeader.createSpan({ text: 'Calendar' });
		if (this.calendarData.enabled) {
			calendarCard.createDiv({ cls: 'cr-wizard-summary-item', text: `Name: ${this.calendarData.name}` });
			const erasText = this.calendarData.eras.map(e => e.abbrev || e.name).filter(Boolean).join(', ');
			if (erasText) {
				calendarCard.createDiv({ cls: 'cr-wizard-summary-item', text: `Eras: ${erasText}` });
			}
		} else {
			calendarCard.createDiv({ cls: 'cr-wizard-summary-item cr-wizard-summary-item--skipped', text: 'Skipped' });
		}

		// Map
		const mapCard = summary.createDiv({ cls: 'cr-wizard-summary-card' });
		const mapHeader = mapCard.createDiv({ cls: 'cr-wizard-summary-header' });
		mapHeader.appendChild(createLucideIcon('map', 18));
		mapHeader.createSpan({ text: 'Map' });
		if (this.mapData.enabled) {
			mapCard.createDiv({ cls: 'cr-wizard-summary-item', text: `Name: ${this.mapData.name}` });
			if (this.mapData.imagePath) {
				mapCard.createDiv({ cls: 'cr-wizard-summary-item', text: `Image: ${this.mapData.imagePath}` });
			}
		} else {
			mapCard.createDiv({ cls: 'cr-wizard-summary-item cr-wizard-summary-item--skipped', text: 'Skipped' });
		}

		// Schema
		const schemaCard = summary.createDiv({ cls: 'cr-wizard-summary-card' });
		const schemaHeader = schemaCard.createDiv({ cls: 'cr-wizard-summary-header' });
		schemaHeader.appendChild(createLucideIcon('clipboard-check', 18));
		schemaHeader.createSpan({ text: 'Schema' });
		if (this.schemaData.enabled) {
			schemaCard.createDiv({ cls: 'cr-wizard-summary-item', text: `Name: ${this.schemaData.name}` });
			const validProps = this.schemaData.requiredProperties.filter(p => p.trim());
			if (validProps.length > 0) {
				schemaCard.createDiv({ cls: 'cr-wizard-summary-item', text: `Required: ${validProps.join(', ')}` });
			}
		} else {
			schemaCard.createDiv({ cls: 'cr-wizard-summary-item cr-wizard-summary-item--skipped', text: 'Skipped' });
		}
	}

	/**
	 * Render navigation buttons
	 */
	private renderNavigation(): void {
		if (!this.contentContainer) return;

		const nav = this.contentContainer.createDiv({ cls: 'cr-wizard-nav' });
		const step = WIZARD_STEPS[this.currentStep];

		// Cancel/Back button
		if (this.currentStep === 0) {
			const cancelBtn = nav.createEl('button', {
				text: 'Cancel',
				cls: 'cr-btn'
			});
			cancelBtn.addEventListener('click', () => this.close());
		} else {
			const backBtn = nav.createEl('button', {
				text: 'Back',
				cls: 'cr-btn'
			});
			backBtn.prepend(createLucideIcon('chevron-left', 16));
			backBtn.addEventListener('click', () => this.goBack());
		}

		// Right side buttons
		const rightBtns = nav.createDiv({ cls: 'cr-wizard-nav-right' });

		// Skip button (for skippable steps)
		if (step.skippable && this.currentStep < WIZARD_STEPS.length - 1) {
			const skipBtn = rightBtns.createEl('button', {
				text: 'Skip',
				cls: 'cr-btn cr-btn--secondary'
			});
			skipBtn.addEventListener('click', () => this.goNext(true));
		}

		// Next/Create button
		if (this.currentStep < WIZARD_STEPS.length - 1) {
			const nextBtn = rightBtns.createEl('button', {
				text: 'Next',
				cls: 'cr-btn cr-btn--primary'
			});
			nextBtn.appendChild(createLucideIcon('arrow-right', 16));
			nextBtn.addEventListener('click', () => this.goNext(false));
		} else {
			const createBtn = rightBtns.createEl('button', {
				text: 'Create universe',
				cls: 'cr-btn cr-btn--primary'
			});
			createBtn.prepend(createLucideIcon('check', 16));
			createBtn.addEventListener('click', () => void this.createUniverse());
		}
	}

	/**
	 * Go to next step
	 */
	private goNext(skip: boolean): void {
		const step = WIZARD_STEPS[this.currentStep];

		// Validate current step if not skipping
		if (!skip && !this.validateCurrentStep()) {
			return;
		}

		// If skipping, disable the feature for this step
		if (skip) {
			switch (step.id) {
				case 'calendar':
					this.calendarData.enabled = false;
					break;
				case 'map':
					this.mapData.enabled = false;
					break;
				case 'schema':
					this.schemaData.enabled = false;
					break;
			}
		}

		if (this.currentStep < WIZARD_STEPS.length - 1) {
			this.currentStep++;
			this.renderProgress();
			this.renderCurrentStep();
		}
	}

	/**
	 * Go to previous step
	 */
	private goBack(): void {
		if (this.currentStep > 0) {
			this.currentStep--;
			this.renderProgress();
			this.renderCurrentStep();
		}
	}

	/**
	 * Validate current step
	 */
	private validateCurrentStep(): boolean {
		const step = WIZARD_STEPS[this.currentStep];

		switch (step.id) {
			case 'universe':
				if (!this.universeData.name.trim()) {
					new Notice('Please enter a universe name');
					return false;
				}
				// Check for duplicate name
				const existing = this.universeService.getUniverseByName(this.universeData.name);
				if (existing) {
					new Notice(`A universe named "${this.universeData.name}" already exists`);
					return false;
				}
				return true;

			case 'calendar':
				if (this.calendarData.enabled) {
					if (!this.calendarData.name.trim()) {
						new Notice('Please enter a calendar name');
						return false;
					}
					const validEras = this.calendarData.eras.filter(e => e.name && e.abbrev);
					if (validEras.length === 0) {
						new Notice('Please add at least one era with name and abbreviation');
						return false;
					}
				}
				return true;

			case 'map':
				if (this.mapData.enabled) {
					if (!this.mapData.name.trim()) {
						new Notice('Please enter a map name');
						return false;
					}
				}
				return true;

			case 'schema':
				if (this.schemaData.enabled) {
					if (!this.schemaData.name.trim()) {
						new Notice('Please enter a schema name');
						return false;
					}
				}
				return true;

			default:
				return true;
		}
	}

	/**
	 * Create the universe and all associated entities
	 */
	private async createUniverse(): Promise<void> {
		try {
			// Create universe note
			const universeData: CreateUniverseData = {
				name: this.universeData.name,
				description: this.universeData.description || undefined,
				author: this.universeData.author || undefined,
				genre: this.universeData.genre || undefined,
				status: this.universeData.status
			};

			const universeFile = await this.universeService.createUniverse(universeData);
			this.created.universe = universeFile;

			// Get the actual cr_id from the created universe file
			// Need to wait for metadata cache to update
			await new Promise(resolve => setTimeout(resolve, 100));
			const cache = this.app.metadataCache.getFileCache(universeFile);
			const universeCrId = cache?.frontmatter?.cr_id as string | undefined;

			if (!universeCrId) {
				throw new Error('Failed to get universe cr_id from created file');
			}

			// Create calendar if enabled
			if (this.calendarData.enabled) {
				await this.createCalendar(universeCrId);
			}

			// Create map if enabled
			if (this.mapData.enabled) {
				await this.createMap(universeCrId);
			}

			// Create schema if enabled
			if (this.schemaData.enabled) {
				await this.createSchema(universeCrId);
			}

			// Show success and close
			this.showSuccess(universeFile);

		} catch (error) {
			console.error('Failed to create universe:', error);
			new Notice(`Failed to create universe: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Create the calendar date system
	 */
	private async createCalendar(universeId: string): Promise<void> {
		const validEras = this.calendarData.eras.filter(e => e.name && e.abbrev);

		const dateSystem: FictionalDateSystem = {
			id: this.calendarData.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
			name: this.calendarData.name,
			universe: universeId,
			eras: validEras,
			defaultEra: validEras.length > 0 ? validEras[0].id : undefined,
			builtIn: false
		};

		// Add to plugin settings
		this.plugin.settings.fictionalDateSystems.push(dateSystem);
		await this.plugin.saveSettings();

		this.created.calendar = true;
		new Notice(`Created calendar: ${this.calendarData.name}`);
	}

	/**
	 * Create the map note
	 */
	private async createMap(universeId: string): Promise<void> {
		const mapId = this.mapData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
		const folder = this.plugin.settings.mapsFolder || '';

		// Build frontmatter
		const frontmatterLines = [
			'---',
			'cr_type: map',
			`map_id: ${mapId}`,
			`name: "${this.mapData.name}"`,
			`universe: ${universeId}`,
			`coordinate_system: ${this.mapData.coordinateSystem}`
		];

		if (this.mapData.imagePath) {
			frontmatterLines.push(`image: ${this.mapData.imagePath}`);
		}

		if (this.mapData.coordinateSystem === 'geographic') {
			frontmatterLines.push(`bounds_north: ${this.mapData.boundsNorth}`);
			frontmatterLines.push(`bounds_south: ${this.mapData.boundsSouth}`);
			frontmatterLines.push(`bounds_east: ${this.mapData.boundsEast}`);
			frontmatterLines.push(`bounds_west: ${this.mapData.boundsWest}`);
		}

		frontmatterLines.push('---');
		frontmatterLines.push('');
		frontmatterLines.push(`# ${this.mapData.name}`);
		frontmatterLines.push('');
		frontmatterLines.push(`A custom map for ${this.universeData.name}.`);

		const content = frontmatterLines.join('\n');

		// Ensure folder exists
		if (folder) {
			const folderExists = this.app.vault.getAbstractFileByPath(folder);
			if (!folderExists) {
				await this.app.vault.createFolder(folder);
			}
		}

		// Create file
		const filename = `${this.mapData.name}.md`;
		const filepath = folder ? `${folder}/${filename}` : filename;
		const file = await this.app.vault.create(filepath, content);

		this.created.map = file;
		new Notice(`Created map: ${this.mapData.name}`);
	}

	/**
	 * Create the schema note
	 */
	private async createSchema(universeId: string): Promise<void> {
		const schemaId = `schema-${this.schemaData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
		const folder = this.plugin.settings.schemasFolder || '';

		const validProps = this.schemaData.requiredProperties.filter(p => p.trim());

		// Build frontmatter
		const frontmatterLines = [
			'---',
			'cr_type: schema',
			`cr_id: ${schemaId}`,
			`name: "${this.schemaData.name}"`,
			`description: "Validation schema for ${this.universeData.name}"`,
			'applies_to_type: universe',
			`applies_to_value: ${universeId}`
		];

		if (validProps.length > 0) {
			frontmatterLines.push('definition:');
			frontmatterLines.push('  required_properties:');
			for (const prop of validProps) {
				frontmatterLines.push(`    - ${prop}`);
			}
			frontmatterLines.push('  properties: {}');
			frontmatterLines.push('  constraints: []');
		}

		frontmatterLines.push('---');
		frontmatterLines.push('');
		frontmatterLines.push(`# ${this.schemaData.name}`);
		frontmatterLines.push('');
		frontmatterLines.push(`Validation schema for entities in ${this.universeData.name}.`);

		const content = frontmatterLines.join('\n');

		// Ensure folder exists
		if (folder) {
			const folderExists = this.app.vault.getAbstractFileByPath(folder);
			if (!folderExists) {
				await this.app.vault.createFolder(folder);
			}
		}

		// Create file
		const filename = `${this.schemaData.name}.md`;
		const filepath = folder ? `${folder}/${filename}` : filename;
		const file = await this.app.vault.create(filepath, content);

		this.created.schema = file;
		new Notice(`Created schema: ${this.schemaData.name}`);
	}

	/**
	 * Show success message and options
	 */
	private showSuccess(universeFile: TFile): void {
		if (!this.contentContainer) return;
		this.contentContainer.empty();

		const success = this.contentContainer.createDiv({ cls: 'cr-wizard-success' });

		const icon = success.createDiv({ cls: 'cr-wizard-success-icon' });
		setLucideIcon(icon, 'check-circle', 48);

		success.createEl('h3', { text: 'Universe created successfully!' });
		success.createEl('p', { text: this.universeData.name, cls: 'cr-wizard-success-name' });

		// Created entities list
		const entitiesList = success.createDiv({ cls: 'cr-wizard-success-entities' });
		entitiesList.createEl('p', { text: 'Created entities:', cls: 'cr-wizard-success-label' });

		const list = entitiesList.createEl('ul');
		list.createEl('li', { text: `✓ Universe note: ${universeFile.basename}` });

		if (this.created.calendar) {
			list.createEl('li', { text: `✓ Date system: ${this.calendarData.name}` });
		} else {
			list.createEl('li', { text: '○ Calendar: skipped', cls: 'cr-wizard-skipped' });
		}

		if (this.created.map) {
			list.createEl('li', { text: `✓ Map note: ${this.created.map.basename}` });
		} else {
			list.createEl('li', { text: '○ Map: skipped', cls: 'cr-wizard-skipped' });
		}

		if (this.created.schema) {
			list.createEl('li', { text: `✓ Schema note: ${this.created.schema.basename}` });
		} else {
			list.createEl('li', { text: '○ Schema: skipped', cls: 'cr-wizard-skipped' });
		}

		// What's next
		const nextSteps = success.createDiv({ cls: 'cr-wizard-next-steps' });
		nextSteps.createEl('p', { text: "What's next?", cls: 'cr-wizard-success-label' });
		const stepsList = nextSteps.createEl('ul');
		stepsList.createEl('li', { text: 'Add people, places, and events to your universe' });
		stepsList.createEl('li', { text: 'Open the universe note to add your own documentation' });

		// Buttons
		const buttons = success.createDiv({ cls: 'cr-wizard-success-buttons' });

		const openBtn = buttons.createEl('button', {
			text: 'Open universe note',
			cls: 'cr-btn cr-btn--primary'
		});
		openBtn.addEventListener('click', () => {
			void this.app.workspace.getLeaf(false).openFile(universeFile);
			this.close();
		});

		const doneBtn = buttons.createEl('button', {
			text: 'Done',
			cls: 'cr-btn'
		});
		doneBtn.addEventListener('click', () => {
			this.close();
			if (this.onComplete) {
				this.onComplete(universeFile);
			}
		});
	}
}

/**
 * Simple image picker modal
 */
class ImagePickerModal extends Modal {
	private files: TFile[];
	private onSelect: (path: string) => void;
	private searchInput?: HTMLInputElement;
	private listContainer?: HTMLElement;

	constructor(app: InstanceType<typeof Modal>['app'], files: TFile[], onSelect: (path: string) => void) {
		super(app);
		this.files = files;
		this.onSelect = onSelect;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-image-picker-modal');

		contentEl.createEl('h3', { text: 'Select map image' });

		const searchContainer = contentEl.createDiv({ cls: 'cr-search-container' });
		this.searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search images...',
			cls: 'cr-search-input'
		});
		this.searchInput.addEventListener('input', () => this.filterFiles());

		this.listContainer = contentEl.createDiv({ cls: 'cr-file-list' });
		this.renderFiles(this.files);

		this.searchInput.focus();
	}

	onClose() {
		this.contentEl.empty();
	}

	private filterFiles(): void {
		const query = this.searchInput?.value.toLowerCase() || '';
		const filtered = this.files.filter(f =>
			f.path.toLowerCase().includes(query) ||
			f.basename.toLowerCase().includes(query)
		);
		this.renderFiles(filtered);
	}

	private renderFiles(files: TFile[]): void {
		if (!this.listContainer) return;
		this.listContainer.empty();

		if (files.length === 0) {
			this.listContainer.createEl('p', {
				text: 'No matching images found',
				cls: 'cr-no-results'
			});
			return;
		}

		for (const file of files.slice(0, 50)) {
			const item = this.listContainer.createDiv({ cls: 'cr-file-item' });
			item.createSpan({ text: file.basename, cls: 'cr-file-name' });
			item.createSpan({ text: file.path, cls: 'cr-file-path' });

			item.addEventListener('click', () => {
				this.onSelect(file.path);
				this.close();
			});
		}

		if (files.length > 50) {
			this.listContainer.createEl('p', {
				text: `Showing 50 of ${files.length} results. Refine your search.`,
				cls: 'cr-more-results'
			});
		}
	}
}
