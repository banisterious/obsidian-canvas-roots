/**
 * Preferences Tab UI Component
 *
 * Renders the Preferences tab in the Control Center, showing
 * property aliases, folder locations, and other user preferences.
 */

import { Modal, Setting, Notice, App } from 'obsidian';
import { setIcon } from 'obsidian';
import type CanvasRootsPlugin from '../../main';
import type { LucideIconName } from './lucide-icons';
import {
	PropertyAliasService,
	CANONICAL_PERSON_PROPERTIES,
	CANONICAL_PROPERTY_LABELS,
	type CanonicalPersonProperty
} from '../core/property-alias-service';
import {
	ValueAliasService,
	VALUE_ALIAS_FIELD_LABELS,
	EVENT_TYPE_LABELS,
	GENDER_LABELS,
	PLACE_CATEGORY_LABELS,
	CANONICAL_EVENT_TYPES,
	CANONICAL_GENDERS,
	CANONICAL_PLACE_CATEGORIES,
	type ValueAliasField,
	type CanonicalEventType,
	type CanonicalGender,
	type CanonicalPlaceCategory
} from '../core/value-alias-service';

/**
 * Render the Preferences tab content
 */
export function renderPreferencesTab(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const propertyAliasService = new PropertyAliasService(plugin);
	const valueAliasService = new ValueAliasService(plugin);

	// Aliases card (property names + property values)
	renderAliasesCard(container, plugin, propertyAliasService, valueAliasService, createCard, showTab);

	// Folder Locations card
	renderFolderLocationsCard(container, plugin, createCard);
}

/**
 * Render the Aliases card (property names + property values)
 */
function renderAliasesCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	propertyAliasService: PropertyAliasService,
	valueAliasService: ValueAliasService,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const card = createCard({
		title: 'Aliases',
		icon: 'hash',
		subtitle: 'Map your custom names and values to Canvas Roots fields'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Description
	content.createEl('p', {
		cls: 'crc-text-muted',
		text: 'Your frontmatter stays unchanged — Canvas Roots reads your names and values and treats them as the mapped fields.'
	});

	// ===== PROPERTY NAMES SECTION =====
	content.createEl('h4', {
		text: 'Property names',
		cls: 'cr-aliases-section-title'
	});

	// Get all configured property aliases
	const propertyAliases = propertyAliasService.getAllAliases();

	if (propertyAliases.length === 0) {
		// Empty state
		const emptyState = content.createDiv({ cls: 'crc-empty-state' });
		emptyState.createEl('p', {
			text: 'No property name aliases configured.',
			cls: 'crc-text-muted'
		});
		emptyState.createEl('p', {
			text: 'Add aliases if your vault uses different property names (e.g., "birthdate" instead of "born").',
			cls: 'crc-text-muted crc-text-small'
		});
	} else {
		// Property aliases table
		const table = content.createEl('table', { cls: 'cr-aliases-table' });

		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Your property' });
		headerRow.createEl('th', { text: 'Maps to' });
		headerRow.createEl('th', { text: '', cls: 'cr-aliases-table__actions' });

		// Body
		const tbody = table.createEl('tbody');
		for (const alias of propertyAliases) {
			const row = tbody.createEl('tr');

			// User property
			row.createEl('td', {
				text: alias.userProperty,
				cls: 'cr-alias-user-prop'
			});

			// Canonical property with label
			const canonicalCell = row.createEl('td');
			const label = CANONICAL_PROPERTY_LABELS[alias.canonicalProperty as CanonicalPersonProperty] || alias.canonicalProperty;
			canonicalCell.createSpan({ text: alias.canonicalProperty });
			canonicalCell.createSpan({
				text: ` (${label})`,
				cls: 'crc-text-muted'
			});

			// Actions
			const actionsCell = row.createEl('td', { cls: 'cr-aliases-table__actions' });

			// Edit button
			const editBtn = actionsCell.createEl('button', {
				cls: 'cr-btn-icon',
				attr: { 'aria-label': 'Edit alias' }
			});
			setIcon(editBtn, 'edit');
			editBtn.addEventListener('click', () => {
				new PropertyAliasModal(
					plugin.app,
					plugin,
					alias.userProperty,
					alias.canonicalProperty,
					() => showTab('preferences')
				).open();
			});

			// Delete button
			const deleteBtn = actionsCell.createEl('button', {
				cls: 'cr-btn-icon cr-btn-icon--danger',
				attr: { 'aria-label': 'Remove alias' }
			});
			setIcon(deleteBtn, 'trash');
			deleteBtn.addEventListener('click', async () => {
				await propertyAliasService.removeAlias(alias.userProperty);
				new Notice(`Removed alias: ${alias.userProperty}`);
				showTab('preferences');
			});
		}
	}

	// Add property alias button
	const addPropertyButtonContainer = content.createDiv({ cls: 'cr-aliases-add' });
	const addPropertyButton = addPropertyButtonContainer.createEl('button', {
		cls: 'mod-cta'
	});
	setIcon(addPropertyButton.createSpan({ cls: 'crc-button-icon' }), 'plus');
	addPropertyButton.createSpan({ text: 'Add property alias' });
	addPropertyButton.addEventListener('click', () => {
		new PropertyAliasModal(
			plugin.app,
			plugin,
			'',
			'',
			() => showTab('preferences')
		).open();
	});

	// ===== PROPERTY VALUES SECTION =====
	content.createEl('h4', {
		text: 'Property values',
		cls: 'cr-aliases-section-title'
	});

	// Get all configured value aliases
	const valueAliases = valueAliasService.getAllAliasesAllFields();

	if (valueAliases.length === 0) {
		// Empty state
		const emptyState = content.createDiv({ cls: 'crc-empty-state' });
		emptyState.createEl('p', {
			text: 'No property value aliases configured.',
			cls: 'crc-text-muted'
		});
		emptyState.createEl('p', {
			text: 'Add aliases if your vault uses different values (e.g., "nameday" instead of "birth" for event types).',
			cls: 'crc-text-muted crc-text-small'
		});
	} else {
		// Value aliases table
		const table = content.createEl('table', { cls: 'cr-aliases-table' });

		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Your value' });
		headerRow.createEl('th', { text: 'Maps to' });
		headerRow.createEl('th', { text: 'Field' });
		headerRow.createEl('th', { text: '', cls: 'cr-aliases-table__actions' });

		// Body
		const tbody = table.createEl('tbody');
		for (const alias of valueAliases) {
			const row = tbody.createEl('tr');

			// User value
			row.createEl('td', {
				text: alias.userValue,
				cls: 'cr-alias-user-prop'
			});

			// Canonical value with label
			const canonicalCell = row.createEl('td');
			const valueLabel = getCanonicalValueLabel(alias.field, alias.canonicalValue);
			canonicalCell.createSpan({ text: alias.canonicalValue });
			if (valueLabel !== alias.canonicalValue) {
				canonicalCell.createSpan({
					text: ` (${valueLabel})`,
					cls: 'crc-text-muted'
				});
			}

			// Field type
			row.createEl('td', {
				text: VALUE_ALIAS_FIELD_LABELS[alias.field],
				cls: 'crc-text-muted'
			});

			// Actions
			const actionsCell = row.createEl('td', { cls: 'cr-aliases-table__actions' });

			// Edit button
			const editBtn = actionsCell.createEl('button', {
				cls: 'cr-btn-icon',
				attr: { 'aria-label': 'Edit alias' }
			});
			setIcon(editBtn, 'edit');
			editBtn.addEventListener('click', () => {
				new ValueAliasModal(
					plugin.app,
					plugin,
					alias.field,
					alias.userValue,
					alias.canonicalValue,
					() => showTab('preferences')
				).open();
			});

			// Delete button
			const deleteBtn = actionsCell.createEl('button', {
				cls: 'cr-btn-icon cr-btn-icon--danger',
				attr: { 'aria-label': 'Remove alias' }
			});
			setIcon(deleteBtn, 'trash');
			deleteBtn.addEventListener('click', async () => {
				await valueAliasService.removeAlias(alias.field, alias.userValue);
				new Notice(`Removed alias: ${alias.userValue}`);
				showTab('preferences');
			});
		}
	}

	// Add value alias button
	const addValueButtonContainer = content.createDiv({ cls: 'cr-aliases-add' });
	const addValueButton = addValueButtonContainer.createEl('button', {
		cls: 'mod-cta'
	});
	setIcon(addValueButton.createSpan({ cls: 'crc-button-icon' }), 'plus');
	addValueButton.createSpan({ text: 'Add value alias' });
	addValueButton.addEventListener('click', () => {
		new ValueAliasModal(
			plugin.app,
			plugin,
			'eventType',
			'',
			'',
			() => showTab('preferences')
		).open();
	});

	// ===== INFO BOXES =====
	// Tip
	const tipContainer = content.createDiv({ cls: 'cr-info-box' });
	const tipIcon = tipContainer.createSpan({ cls: 'cr-info-box-icon' });
	setIcon(tipIcon, 'info');
	tipContainer.createSpan({
		text: 'Canonical values take precedence over aliases. Unknown event types are treated as "custom".'
	});

	// Base files warning
	const baseWarning = content.createDiv({ cls: 'cr-info-box cr-info-box--warning' });
	const baseWarningIcon = baseWarning.createSpan({ cls: 'cr-info-box-icon' });
	setIcon(baseWarningIcon, 'alert-triangle');
	baseWarning.createSpan({
		text: 'Existing Bases files are not automatically updated when aliases change. Delete and recreate the base file to apply new aliases.'
	});

	container.appendChild(card);
}

/**
 * Get human-readable label for a canonical value
 */
function getCanonicalValueLabel(field: ValueAliasField, value: string): string {
	switch (field) {
		case 'eventType':
			return EVENT_TYPE_LABELS[value as CanonicalEventType] || value;
		case 'gender':
			return GENDER_LABELS[value as CanonicalGender] || value;
		case 'placeCategory':
			return PLACE_CATEGORY_LABELS[value as CanonicalPlaceCategory] || value;
	}
}

/**
 * Render the Folder Locations card
 */
function renderFolderLocationsCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement
): void {
	const card = createCard({
		title: 'Folder locations',
		icon: 'folder',
		subtitle: 'Configure where Canvas Roots stores and finds notes'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// People folder
	new Setting(content)
		.setName('People folder')
		.setDesc('Default folder for person notes')
		.addText(text => text
			.setPlaceholder('Canvas Roots/People')
			.setValue(plugin.settings.peopleFolder)
			.onChange(async (value) => {
				plugin.settings.peopleFolder = value;
				await plugin.saveSettings();
			}));

	// Places folder
	new Setting(content)
		.setName('Places folder')
		.setDesc('Default folder for place notes')
		.addText(text => text
			.setPlaceholder('Canvas Roots/Places')
			.setValue(plugin.settings.placesFolder)
			.onChange(async (value) => {
				plugin.settings.placesFolder = value;
				await plugin.saveSettings();
			}));

	// Maps folder
	new Setting(content)
		.setName('Maps folder')
		.setDesc('Default folder for custom map images')
		.addText(text => text
			.setPlaceholder('Canvas Roots/Places/Maps')
			.setValue(plugin.settings.mapsFolder)
			.onChange(async (value) => {
				plugin.settings.mapsFolder = value;
				await plugin.saveSettings();
			}));

	// Organizations folder
	new Setting(content)
		.setName('Organizations folder')
		.setDesc('Default folder for organization notes')
		.addText(text => text
			.setPlaceholder('Canvas Roots/Organizations')
			.setValue(plugin.settings.organizationsFolder)
			.onChange(async (value) => {
				plugin.settings.organizationsFolder = value;
				await plugin.saveSettings();
			}));

	// Sources folder
	new Setting(content)
		.setName('Sources folder')
		.setDesc('Default folder for source notes')
		.addText(text => text
			.setPlaceholder('Canvas Roots/Sources')
			.setValue(plugin.settings.sourcesFolder)
			.onChange(async (value) => {
				plugin.settings.sourcesFolder = value;
				await plugin.saveSettings();
			}));

	// Schemas folder
	new Setting(content)
		.setName('Schemas folder')
		.setDesc('Default folder for validation schemas')
		.addText(text => text
			.setPlaceholder('Canvas Roots/Schemas')
			.setValue(plugin.settings.schemasFolder)
			.onChange(async (value) => {
				plugin.settings.schemasFolder = value;
				await plugin.saveSettings();
			}));

	// Canvases folder
	new Setting(content)
		.setName('Canvases folder')
		.setDesc('Default folder for generated canvas files')
		.addText(text => text
			.setPlaceholder('Canvas Roots/Canvases')
			.setValue(plugin.settings.canvasesFolder)
			.onChange(async (value) => {
				plugin.settings.canvasesFolder = value;
				await plugin.saveSettings();
			}));

	// Staging folder
	new Setting(content)
		.setName('Staging folder')
		.setDesc('Folder for import staging (isolated from main vault during processing)')
		.addText(text => text
			.setPlaceholder('Canvas Roots/Staging')
			.setValue(plugin.settings.stagingFolder)
			.onChange(async (value) => {
				plugin.settings.stagingFolder = value;
				await plugin.saveSettings();
			}));

	container.appendChild(card);
}

/**
 * Modal for adding/editing a property alias
 */
class PropertyAliasModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private userProperty: string;
	private canonicalProperty: string;
	private onSave: () => void;
	private isEdit: boolean;
	private originalUserProperty: string;

	constructor(
		app: App,
		plugin: CanvasRootsPlugin,
		userProperty: string,
		canonicalProperty: string,
		onSave: () => void
	) {
		super(app);
		this.plugin = plugin;
		this.userProperty = userProperty;
		this.canonicalProperty = canonicalProperty;
		this.onSave = onSave;
		this.isEdit = userProperty !== '';
		this.originalUserProperty = userProperty;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-property-alias-modal');

		// Title
		this.titleEl.setText(this.isEdit ? 'Edit property alias' : 'Add property alias');

		// Form
		const form = contentEl.createDiv({ cls: 'cr-alias-form' });

		// User property input
		new Setting(form)
			.setName('Your property name')
			.setDesc('The property name used in your frontmatter')
			.addText(text => text
				.setPlaceholder('birthdate')
				.setValue(this.userProperty)
				.onChange(value => {
					this.userProperty = value.trim().toLowerCase();
				}));

		// Canonical property dropdown
		new Setting(form)
			.setName('Maps to Canvas Roots property')
			.setDesc('The Canvas Roots property this should be treated as')
			.addDropdown(dropdown => {
				// Add empty option
				dropdown.addOption('', '— Select property —');

				// Group properties by category
				const categories: Record<string, CanonicalPersonProperty[]> = {
					'Identity': ['name', 'cr_id', 'gender', 'nickname', 'maiden_name'],
					'Dates': ['born', 'died'],
					'Places': ['birth_place', 'death_place'],
					'Relationships': ['father', 'father_id', 'mother', 'mother_id', 'spouse', 'spouse_id', 'child', 'children_id'],
					'Other': ['occupation', 'universe', 'image', 'sourced_facts', 'relationships']
				};

				for (const [category, props] of Object.entries(categories)) {
					for (const prop of props) {
						const label = CANONICAL_PROPERTY_LABELS[prop];
						dropdown.addOption(prop, `${prop} (${label})`);
					}
				}

				dropdown.setValue(this.canonicalProperty);
				dropdown.onChange(value => {
					this.canonicalProperty = value;
				});
			});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const saveBtn = buttonContainer.createEl('button', {
			cls: 'mod-cta',
			text: this.isEdit ? 'Save' : 'Add alias'
		});
		saveBtn.addEventListener('click', async () => {
			if (this.validate()) {
				await this.save();
			}
		});
	}

	private validate(): boolean {
		if (!this.userProperty) {
			new Notice('Please enter your property name');
			return false;
		}

		if (!this.canonicalProperty) {
			new Notice('Please select a Canvas Roots property');
			return false;
		}

		// Check if user property already exists (for new aliases)
		if (!this.isEdit || this.userProperty !== this.originalUserProperty) {
			const existing = this.plugin.settings.propertyAliases[this.userProperty];
			if (existing) {
				new Notice(`"${this.userProperty}" is already aliased to "${existing}"`);
				return false;
			}
		}

		// Check if canonical property already has an alias (except when editing the same one)
		const aliasService = new PropertyAliasService(this.plugin);
		const existingAlias = aliasService.getAlias(this.canonicalProperty);
		if (existingAlias && existingAlias !== this.originalUserProperty) {
			new Notice(`"${this.canonicalProperty}" already has an alias: "${existingAlias}"`);
			return false;
		}

		return true;
	}

	private async save(): Promise<void> {
		const aliasService = new PropertyAliasService(this.plugin);

		// If editing and user property changed, remove old alias
		if (this.isEdit && this.userProperty !== this.originalUserProperty) {
			await aliasService.removeAlias(this.originalUserProperty);
		}

		// Set the new/updated alias
		await aliasService.setAlias(this.userProperty, this.canonicalProperty);

		new Notice(this.isEdit
			? `Updated alias: ${this.userProperty} → ${this.canonicalProperty}`
			: `Added alias: ${this.userProperty} → ${this.canonicalProperty}`
		);

		this.close();
		this.onSave();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/**
 * Modal for adding/editing a value alias
 */
class ValueAliasModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private field: ValueAliasField;
	private userValue: string;
	private canonicalValue: string;
	private onSave: () => void;
	private isEdit: boolean;
	private originalField: ValueAliasField;
	private originalUserValue: string;

	constructor(
		app: App,
		plugin: CanvasRootsPlugin,
		field: ValueAliasField,
		userValue: string,
		canonicalValue: string,
		onSave: () => void
	) {
		super(app);
		this.plugin = plugin;
		this.field = field;
		this.userValue = userValue;
		this.canonicalValue = canonicalValue;
		this.onSave = onSave;
		this.isEdit = userValue !== '';
		this.originalField = field;
		this.originalUserValue = userValue;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-value-alias-modal');

		// Title
		this.titleEl.setText(this.isEdit ? 'Edit value alias' : 'Add value alias');

		// Form
		const form = contentEl.createDiv({ cls: 'cr-alias-form' });

		// Field type dropdown
		new Setting(form)
			.setName('Field type')
			.setDesc('The type of field this value belongs to')
			.addDropdown(dropdown => {
				dropdown.addOption('eventType', 'Event type');
				dropdown.addOption('gender', 'Gender');
				dropdown.addOption('placeCategory', 'Place category');

				dropdown.setValue(this.field);
				dropdown.onChange(value => {
					this.field = value as ValueAliasField;
					// Reset canonical value when field changes
					this.canonicalValue = '';
					// Re-render to update the canonical dropdown
					this.onOpen();
				});
			});

		// User value input
		new Setting(form)
			.setName('Your value')
			.setDesc('The value used in your frontmatter')
			.addText(text => text
				.setPlaceholder(this.getPlaceholder())
				.setValue(this.userValue)
				.onChange(value => {
					this.userValue = value.trim().toLowerCase();
				}));

		// Canonical value dropdown (dynamic based on field)
		new Setting(form)
			.setName('Maps to')
			.setDesc('The canonical value this should be treated as')
			.addDropdown(dropdown => {
				dropdown.addOption('', '— Select value —');

				const canonicalValues = this.getCanonicalValuesForField();
				for (const value of canonicalValues) {
					const label = this.getLabelForValue(value);
					dropdown.addOption(value, `${value} (${label})`);
				}

				dropdown.setValue(this.canonicalValue);
				dropdown.onChange(value => {
					this.canonicalValue = value;
				});
			});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const saveBtn = buttonContainer.createEl('button', {
			cls: 'mod-cta',
			text: this.isEdit ? 'Save' : 'Add alias'
		});
		saveBtn.addEventListener('click', async () => {
			if (this.validate()) {
				await this.save();
			}
		});
	}

	private getPlaceholder(): string {
		switch (this.field) {
			case 'eventType':
				return 'nameday';
			case 'gender':
				return 'masc';
			case 'placeCategory':
				return 'canon';
		}
	}

	private getCanonicalValuesForField(): readonly string[] {
		switch (this.field) {
			case 'eventType':
				return CANONICAL_EVENT_TYPES;
			case 'gender':
				return CANONICAL_GENDERS;
			case 'placeCategory':
				return CANONICAL_PLACE_CATEGORIES;
		}
	}

	private getLabelForValue(value: string): string {
		switch (this.field) {
			case 'eventType':
				return EVENT_TYPE_LABELS[value as CanonicalEventType] || value;
			case 'gender':
				return GENDER_LABELS[value as CanonicalGender] || value;
			case 'placeCategory':
				return PLACE_CATEGORY_LABELS[value as CanonicalPlaceCategory] || value;
		}
	}

	private validate(): boolean {
		if (!this.userValue) {
			new Notice('Please enter your value');
			return false;
		}

		if (!this.canonicalValue) {
			new Notice('Please select a canonical value');
			return false;
		}

		const valueAliasService = new ValueAliasService(this.plugin);

		// Check if user value already exists for this field (for new aliases)
		if (!this.isEdit || this.userValue !== this.originalUserValue || this.field !== this.originalField) {
			if (valueAliasService.isValidValue(this.field, this.userValue)) {
				// Check if it's an alias or a canonical value
				const canonicalValues = this.getCanonicalValuesForField();
				if (canonicalValues.includes(this.userValue)) {
					new Notice(`"${this.userValue}" is already a canonical value`);
				} else {
					new Notice(`"${this.userValue}" is already aliased in ${VALUE_ALIAS_FIELD_LABELS[this.field]}`);
				}
				return false;
			}
		}

		// Check if canonical value already has an alias (one-to-one mapping)
		const existingAlias = valueAliasService.getAlias(this.field, this.canonicalValue);
		if (existingAlias && existingAlias !== this.originalUserValue) {
			new Notice(`"${this.canonicalValue}" already has an alias: "${existingAlias}"`);
			return false;
		}

		return true;
	}

	private async save(): Promise<void> {
		const valueAliasService = new ValueAliasService(this.plugin);

		// If editing and user value or field changed, remove old alias
		if (this.isEdit && (this.userValue !== this.originalUserValue || this.field !== this.originalField)) {
			await valueAliasService.removeAlias(this.originalField, this.originalUserValue);
		}

		// Set the new/updated alias
		await valueAliasService.setAlias(this.field, this.userValue, this.canonicalValue);

		new Notice(this.isEdit
			? `Updated alias: ${this.userValue} → ${this.canonicalValue}`
			: `Added alias: ${this.userValue} → ${this.canonicalValue}`
		);

		this.close();
		this.onSave();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
