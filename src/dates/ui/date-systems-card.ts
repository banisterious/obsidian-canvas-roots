/**
 * Date Systems Card Component
 *
 * UI component for managing fictional date systems in Control Center.
 * Displays list of configured systems, add/edit/delete functionality,
 * and a test parsing input for validation.
 */

import { Modal, Setting, Notice, App } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { FictionalDateSystem, FictionalEra } from '../types/date-types';
import { FictionalDateParser } from '../parser/fictional-date-parser';
import { DEFAULT_DATE_SYSTEMS } from '../constants/default-date-systems';
import { setIcon } from 'obsidian';
import type { LucideIconName } from '../../ui/lucide-icons';

/**
 * Create the date systems card for Control Center
 */
export function createDateSystemsCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement
): HTMLElement {
	const card = createCard({
		title: 'Fictional date systems',
		icon: 'calendar'
	});

	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Container for conditional content (everything after the enable toggle)
	const conditionalContainer = content.createDiv({ cls: 'cr-date-systems-conditional' });

	// Helper to render/refresh conditional content
	const refreshConditionalContent = () => {
		conditionalContainer.empty();

		if (!plugin.settings.enableFictionalDates) {
			return; // Don't show anything when disabled
		}

		// Show built-in systems toggle
		new Setting(conditionalContainer)
			.setName('Show built-in systems')
			.setDesc('Include preset calendars (Middle-earth, Westeros, Star Wars)')
			.addToggle(toggle => toggle
				.setValue(plugin.settings.showBuiltInDateSystems)
				.onChange(async (value) => {
					plugin.settings.showBuiltInDateSystems = value;
					await plugin.saveSettings();
					renderDateSystemsList(listContainer, plugin, createCard);
				}));

		// Date systems list container
		const listContainer = conditionalContainer.createDiv({ cls: 'cr-date-systems-list' });
		renderDateSystemsList(listContainer, plugin, createCard);

		// Add button
		new Setting(conditionalContainer)
			.setName('Add date system')
			.setDesc('Create a new fictional calendar system')
			.addButton(button => button
				.setButtonText('Add')
				.setCta()
				.onClick(() => {
					new DateSystemModal(plugin.app, plugin, null, async (system) => {
						plugin.settings.fictionalDateSystems.push(system);
						await plugin.saveSettings();
						renderDateSystemsList(listContainer, plugin, createCard);
						new Notice(`Added date system: ${system.name}`);
					}).open();
				}));

		// Test parsing section
		conditionalContainer.createEl('h4', { text: 'Test date parsing', cls: 'cr-subsection-heading' });

		const testContainer = conditionalContainer.createDiv({ cls: 'cr-date-test-container' });
		const testInput = testContainer.createEl('input', {
			cls: 'cr-date-test-input',
			attr: { type: 'text', placeholder: 'Enter a date (e.g., "TA 2941")' }
		});
		const testResult = testContainer.createDiv({ cls: 'cr-date-test-result' });

		testInput.addEventListener('input', () => {
			const value = testInput.value.trim();
			if (!value) {
				testResult.empty();
				testResult.setText('Enter a date to test');
				testResult.removeClass('cr-date-test-result--success', 'cr-date-test-result--error');
				return;
			}

			// Get all active systems
			const activeSystems = getActiveDateSystems(plugin);
			const parser = new FictionalDateParser(activeSystems);
			const result = parser.parse(value);

			if (result.success) {
				testResult.empty();
				testResult.addClass('cr-date-test-result--success');
				testResult.removeClass('cr-date-test-result--error');
				testResult.createEl('div', { text: `${result.date.era.name}, Year ${result.date.year}` });
				testResult.createEl('div', {
					text: `System: ${result.date.system.name}`,
					cls: 'cr-date-test-result-detail'
				});
				testResult.createEl('div', {
					text: `Canonical year: ${result.date.canonicalYear}`,
					cls: 'cr-date-test-result-detail'
				});
			} else {
				testResult.empty();
				testResult.addClass('cr-date-test-result--error');
				testResult.removeClass('cr-date-test-result--success');
				testResult.setText(result.error);
			}
		});
	};

	// Enable/disable toggle (always visible)
	new Setting(content)
		.setName('Enable fictional dates')
		.setDesc('Parse and display fictional calendar dates (e.g., "TA 2941")')
		.addToggle(toggle => toggle
			.setValue(plugin.settings.enableFictionalDates)
			.onChange(async (value) => {
				plugin.settings.enableFictionalDates = value;
				await plugin.saveSettings();
				// Refresh only the conditional content
				refreshConditionalContent();
			}));

	// Initial render of conditional content
	refreshConditionalContent();

	return card;
}

/**
 * Get all active date systems (built-in + custom)
 */
function getActiveDateSystems(plugin: CanvasRootsPlugin): FictionalDateSystem[] {
	const systems: FictionalDateSystem[] = [];

	if (plugin.settings.showBuiltInDateSystems) {
		systems.push(...DEFAULT_DATE_SYSTEMS);
	}

	systems.push(...plugin.settings.fictionalDateSystems);

	return systems;
}

/**
 * Render the list of date systems
 */
function renderDateSystemsList(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement
): void {
	container.empty();

	const systems = getActiveDateSystems(plugin);

	if (systems.length === 0) {
		container.createEl('p', {
			text: 'No date systems configured. Add one or enable built-in systems.',
			cls: 'cr-empty-state'
		});
		return;
	}

	// Group by built-in vs custom
	const builtIn = systems.filter(s => s.builtIn);
	const custom = systems.filter(s => !s.builtIn);

	// Built-in systems as table
	if (builtIn.length > 0) {
		const builtInSection = container.createDiv({ cls: 'cr-date-systems-section' });
		builtInSection.createEl('h4', { text: 'Built-in systems', cls: 'cr-subsection-heading' });

		const table = builtInSection.createEl('table', { cls: 'cr-date-systems-table' });
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Name' });
		headerRow.createEl('th', { text: 'Eras' });
		headerRow.createEl('th', { text: 'Universe' });
		headerRow.createEl('th', { text: '', cls: 'cr-date-systems-table__actions' });

		const tbody = table.createEl('tbody');
		for (const system of builtIn) {
			const row = tbody.createEl('tr');
			row.createEl('td', { text: system.name });
			row.createEl('td', { text: system.eras.map(e => e.abbrev).join(', ') });
			row.createEl('td', { text: system.universe || '—' });

			// View button
			const actionsCell = row.createEl('td', { cls: 'cr-date-systems-table__actions' });
			const viewBtn = actionsCell.createEl('button', {
				cls: 'cr-btn-icon',
				attr: { 'aria-label': 'View details' }
			});
			setIcon(viewBtn, 'eye');
			viewBtn.addEventListener('click', () => {
				new DateSystemModal(plugin.app, plugin, system, async () => {
					// No-op for view-only
				}, true).open();
			});
		}
	}

	// Custom systems (keep card style for edit/delete actions)
	if (custom.length > 0) {
		const customSection = container.createDiv({ cls: 'cr-date-systems-section' });
		customSection.createEl('h4', { text: 'Custom systems', cls: 'cr-subsection-heading' });

		for (const system of custom) {
			createSystemItem(customSection, system, plugin, false, container, createCard);
		}
	}
}

/**
 * Create a single date system item in the list
 */
function createSystemItem(
	container: HTMLElement,
	system: FictionalDateSystem,
	plugin: CanvasRootsPlugin,
	isBuiltIn: boolean,
	listContainer: HTMLElement,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement
): void {
	const item = container.createDiv({ cls: 'cr-date-system-item' });

	// Icon and name
	const header = item.createDiv({ cls: 'cr-date-system-item-header' });
	const iconEl = header.createSpan({ cls: 'cr-date-system-item-icon' });
	setIcon(iconEl, 'calendar');

	const nameEl = header.createSpan({ cls: 'cr-date-system-item-name', text: system.name });
	if (isBuiltIn) {
		nameEl.createSpan({ cls: 'cr-badge cr-badge--muted', text: 'built-in' });
	}

	// Eras list
	const erasText = system.eras.map(e => e.abbrev).join(', ');
	item.createDiv({ cls: 'cr-date-system-item-eras', text: `Eras: ${erasText}` });

	// Universe
	if (system.universe) {
		item.createDiv({ cls: 'cr-date-system-item-universe', text: `Universe: ${system.universe}` });
	}

	// Actions
	const actions = item.createDiv({ cls: 'cr-date-system-item-actions' });

	if (!isBuiltIn) {
		// Edit button
		const editBtn = actions.createEl('button', { cls: 'cr-btn-icon', attr: { 'aria-label': 'Edit' } });
		setIcon(editBtn, 'edit');
		editBtn.addEventListener('click', () => {
			new DateSystemModal(plugin.app, plugin, system, async (updated) => {
				const index = plugin.settings.fictionalDateSystems.findIndex(s => s.id === system.id);
				if (index >= 0) {
					plugin.settings.fictionalDateSystems[index] = updated;
					await plugin.saveSettings();
					renderDateSystemsList(listContainer, plugin, createCard);
					new Notice(`Updated date system: ${updated.name}`);
				}
			}).open();
		});

		// Delete button
		const deleteBtn = actions.createEl('button', { cls: 'cr-btn-icon cr-btn-icon--danger', attr: { 'aria-label': 'Delete' } });
		setIcon(deleteBtn, 'trash');
		deleteBtn.addEventListener('click', () => {
			void (async () => {
				const confirm = await confirmDelete(plugin.app, system.name);
				if (confirm) {
					plugin.settings.fictionalDateSystems = plugin.settings.fictionalDateSystems.filter(
						s => s.id !== system.id
					);
					await plugin.saveSettings();
					renderDateSystemsList(listContainer, plugin, createCard);
					new Notice(`Deleted date system: ${system.name}`);
				}
			})();
		});
	} else {
		// View-only indicator for built-in
		const viewBtn = actions.createEl('button', { cls: 'cr-btn-icon', attr: { 'aria-label': 'View details' } });
		setIcon(viewBtn, 'eye');
		viewBtn.addEventListener('click', () => {
			new DateSystemModal(plugin.app, plugin, system, async () => {
				// No-op for view-only
			}, true).open();
		});
	}
}

/**
 * Confirm deletion dialog
 */
async function confirmDelete(app: App, systemName: string): Promise<boolean> {
	return new Promise((resolve) => {
		const modal = new Modal(app);
		modal.titleEl.setText('Delete date system');
		modal.contentEl.createEl('p', {
			text: `Are you sure you want to delete "${systemName}"? This action cannot be undone.`
		});

		const buttonContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => {
			modal.close();
			resolve(false);
		});

		const deleteBtn = buttonContainer.createEl('button', { cls: 'mod-warning', text: 'Delete' });
		deleteBtn.addEventListener('click', () => {
			modal.close();
			resolve(true);
		});

		modal.open();
	});
}

/**
 * Modal for adding/editing a date system
 */
class DateSystemModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private system: FictionalDateSystem | null;
	private onSave: (system: FictionalDateSystem) => Promise<void>;
	private viewOnly: boolean;

	// Form state
	private formData: {
		id: string;
		name: string;
		universe: string;
		eras: FictionalEra[];
		defaultEra: string;
	};

	constructor(
		app: App,
		plugin: CanvasRootsPlugin,
		system: FictionalDateSystem | null,
		onSave: (system: FictionalDateSystem) => Promise<void>,
		viewOnly = false
	) {
		super(app);
		this.plugin = plugin;
		this.system = system;
		this.onSave = onSave;
		this.viewOnly = viewOnly;

		// Initialize form data
		this.formData = system ? {
			id: system.id,
			name: system.name,
			universe: system.universe || '',
			eras: [...system.eras],
			defaultEra: system.defaultEra || ''
		} : {
			id: '',
			name: '',
			universe: '',
			eras: [],
			defaultEra: ''
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-date-system-modal');

		// Title
		const title = this.system
			? (this.viewOnly ? `View: ${this.system.name}` : `Edit: ${this.system.name}`)
			: 'Add date system';
		this.titleEl.setText(title);

		// Form
		const form = contentEl.createDiv({ cls: 'cr-date-system-form' });

		// Name
		new Setting(form)
			.setName('Name')
			.setDesc('Display name for this calendar system')
			.addText(text => text
				.setPlaceholder('Middle-earth Calendar')
				.setValue(this.formData.name)
				.setDisabled(this.viewOnly)
				.onChange(value => {
					this.formData.name = value;
					// Auto-generate ID if creating new
					if (!this.system) {
						this.formData.id = value.toLowerCase().replace(/[^a-z0-9]+/g, '_');
					}
				}));

		// ID (read-only for existing systems)
		new Setting(form)
			.setName('ID')
			.setDesc('Unique identifier (auto-generated from name)')
			.addText(text => text
				.setPlaceholder('middle_earth')
				.setValue(this.formData.id)
				.setDisabled(!!this.system || this.viewOnly)
				.onChange(value => {
					this.formData.id = value;
				}));

		// Universe
		new Setting(form)
			.setName('Universe')
			.setDesc('Optional: scope this calendar to a specific universe')
			.addText(text => text
				.setPlaceholder('middle-earth')
				.setValue(this.formData.universe)
				.setDisabled(this.viewOnly)
				.onChange(value => {
					this.formData.universe = value;
				}));

		// Eras section
		form.createEl('h4', { text: 'Eras', cls: 'cr-subsection-heading' });
		const erasContainer = form.createDiv({ cls: 'cr-eras-container' });
		this.renderEras(erasContainer);

		if (!this.viewOnly) {
			const addEraBtn = form.createEl('button', {
				cls: 'cr-add-era-btn',
				text: '+ Add era'
			});
			addEraBtn.addEventListener('click', () => {
				this.formData.eras.push({
					id: `era_${this.formData.eras.length + 1}`,
					name: '',
					abbrev: '',
					epoch: 0,
					direction: 'forward'
				});
				this.renderEras(erasContainer);
			});
		}

		// Default era dropdown
		const defaultEraSetting = new Setting(form)
			.setName('Default era')
			.setDesc('Era to use when creating new dates');

		if (!this.viewOnly) {
			defaultEraSetting.addDropdown(dropdown => {
				dropdown.addOption('', '(None)');
				for (const era of this.formData.eras) {
					if (era.id && era.name) {
						dropdown.addOption(era.id, era.name);
					}
				}
				dropdown.setValue(this.formData.defaultEra);
				dropdown.onChange(value => {
					this.formData.defaultEra = value;
				});
			});
		} else {
			const defaultEra = this.formData.eras.find(e => e.id === this.formData.defaultEra);
			defaultEraSetting.setDesc(defaultEra?.name || '(None)');
		}

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		if (this.viewOnly) {
			const closeBtn = buttonContainer.createEl('button', { text: 'Close' });
			closeBtn.addEventListener('click', () => this.close());
		} else {
			const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
			cancelBtn.addEventListener('click', () => this.close());

			const saveBtn = buttonContainer.createEl('button', { cls: 'mod-cta', text: 'Save' });
			saveBtn.addEventListener('click', () => {
				if (this.validate()) {
					const system: FictionalDateSystem = {
						id: this.formData.id,
						name: this.formData.name,
						universe: this.formData.universe || undefined,
						eras: this.formData.eras.filter(e => e.name && e.abbrev),
						defaultEra: this.formData.defaultEra || undefined,
						builtIn: false
					};
					void this.onSave(system).then(() => this.close());
				}
			});
		}
	}

	private renderEras(container: HTMLElement): void {
		container.empty();

		if (this.formData.eras.length === 0) {
			container.createEl('p', {
				text: 'No eras defined. Add at least one era.',
				cls: 'cr-empty-state'
			});
			return;
		}

		// Table header
		const table = container.createEl('table', { cls: 'cr-eras-table' });
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Name' });
		headerRow.createEl('th', { text: 'Abbrev' });
		headerRow.createEl('th', { text: 'Epoch' });
		headerRow.createEl('th', { text: 'Direction' });
		if (!this.viewOnly) {
			headerRow.createEl('th', { text: '' }); // Actions column
		}

		const tbody = table.createEl('tbody');

		for (let i = 0; i < this.formData.eras.length; i++) {
			const era = this.formData.eras[i];
			const row = tbody.createEl('tr');

			// Name
			const nameCell = row.createEl('td');
			if (this.viewOnly) {
				nameCell.setText(era.name);
			} else {
				const nameInput = nameCell.createEl('input', {
					cls: 'cr-era-input',
					attr: { type: 'text', placeholder: 'Third Age' }
				});
				nameInput.value = era.name;
				nameInput.addEventListener('input', () => {
					era.name = nameInput.value;
					// Auto-generate ID
					era.id = nameInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '_');
				});
			}

			// Abbreviation
			const abbrevCell = row.createEl('td');
			if (this.viewOnly) {
				abbrevCell.setText(era.abbrev);
			} else {
				const abbrevInput = abbrevCell.createEl('input', {
					cls: 'cr-era-input cr-era-input--short',
					attr: { type: 'text', placeholder: 'TA' }
				});
				abbrevInput.value = era.abbrev;
				abbrevInput.addEventListener('input', () => {
					era.abbrev = abbrevInput.value;
				});
			}

			// Epoch
			const epochCell = row.createEl('td');
			if (this.viewOnly) {
				epochCell.setText(String(era.epoch));
			} else {
				const epochInput = epochCell.createEl('input', {
					cls: 'cr-era-input cr-era-input--short',
					attr: { type: 'number', placeholder: '0' }
				});
				epochInput.value = String(era.epoch);
				epochInput.addEventListener('input', () => {
					era.epoch = parseInt(epochInput.value) || 0;
				});
			}

			// Direction
			const directionCell = row.createEl('td');
			if (this.viewOnly) {
				directionCell.setText(era.direction || 'forward');
			} else {
				const directionSelect = directionCell.createEl('select', { cls: 'cr-era-select' });
				directionSelect.createEl('option', { text: 'Forward', attr: { value: 'forward' } });
				directionSelect.createEl('option', { text: 'Backward', attr: { value: 'backward' } });
				directionSelect.value = era.direction || 'forward';
				directionSelect.addEventListener('change', () => {
					era.direction = directionSelect.value as 'forward' | 'backward';
				});
			}

			// Actions
			if (!this.viewOnly) {
				const actionsCell = row.createEl('td');
				const deleteBtn = actionsCell.createEl('button', {
					cls: 'cr-btn-icon cr-btn-icon--danger cr-btn-icon--small',
					attr: { 'aria-label': 'Remove era' }
				});
				setIcon(deleteBtn, 'x');
				deleteBtn.addEventListener('click', () => {
					this.formData.eras.splice(i, 1);
					this.renderEras(container);
				});
			}
		}
	}

	private validate(): boolean {
		if (!this.formData.name.trim()) {
			new Notice('Please enter a name for the date system');
			return false;
		}

		if (!this.formData.id.trim()) {
			new Notice('Please enter an ID for the date system');
			return false;
		}

		// Check for duplicate ID
		const existingIds = this.plugin.settings.fictionalDateSystems
			.filter(s => s.id !== this.system?.id)
			.map(s => s.id);
		if (existingIds.includes(this.formData.id)) {
			new Notice(`A date system with ID "${this.formData.id}" already exists`);
			return false;
		}

		// Must have at least one era
		const validEras = this.formData.eras.filter(e => e.name && e.abbrev);
		if (validEras.length === 0) {
			new Notice('Please add at least one era with name and abbreviation');
			return false;
		}

		// Check for duplicate abbreviations
		const abbrevs = validEras.map(e => e.abbrev.toUpperCase());
		const uniqueAbbrevs = new Set(abbrevs);
		if (abbrevs.length !== uniqueAbbrevs.size) {
			new Notice('Era abbreviations must be unique');
			return false;
		}

		return true;
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
