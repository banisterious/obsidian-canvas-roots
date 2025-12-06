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

/**
 * Render the Preferences tab content
 */
export function renderPreferencesTab(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const aliasService = new PropertyAliasService(plugin);

	// Property Aliases card
	renderPropertyAliasesCard(container, plugin, aliasService, createCard, showTab);

	// Folder Locations card
	renderFolderLocationsCard(container, plugin, createCard);
}

/**
 * Render the Property Aliases card
 */
function renderPropertyAliasesCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	aliasService: PropertyAliasService,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const card = createCard({
		title: 'Property aliases',
		icon: 'hash',
		subtitle: 'Map your custom property names to Canvas Roots fields'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Description
	content.createEl('p', {
		cls: 'crc-text-muted',
		text: 'Your frontmatter stays unchanged — Canvas Roots reads your property names and treats them as the mapped field.'
	});

	// Get all configured aliases
	const aliases = aliasService.getAllAliases();

	if (aliases.length === 0) {
		// Empty state
		const emptyState = content.createDiv({ cls: 'crc-empty-state' });
		emptyState.createEl('p', {
			text: 'No property aliases configured.',
			cls: 'crc-text-muted'
		});
		emptyState.createEl('p', {
			text: 'Add aliases if your vault uses different property names (e.g., "birthdate" instead of "born").',
			cls: 'crc-text-muted crc-text-small'
		});
	} else {
		// Aliases table
		const table = content.createEl('table', { cls: 'cr-aliases-table' });

		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Your property' });
		headerRow.createEl('th', { text: 'Maps to' });
		headerRow.createEl('th', { text: '', cls: 'cr-aliases-table__actions' });

		// Body
		const tbody = table.createEl('tbody');
		for (const alias of aliases) {
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
				await aliasService.removeAlias(alias.userProperty);
				new Notice(`Removed alias: ${alias.userProperty}`);
				showTab('preferences');
			});
		}
	}

	// Add button
	const addButtonContainer = content.createDiv({ cls: 'cr-aliases-add' });
	const addButton = addButtonContainer.createEl('button', {
		cls: 'mod-cta'
	});
	setIcon(addButton.createSpan({ cls: 'crc-button-icon' }), 'plus');
	addButton.createSpan({ text: 'Add alias' });
	addButton.addEventListener('click', () => {
		new PropertyAliasModal(
			plugin.app,
			plugin,
			'',
			'',
			() => showTab('preferences')
		).open();
	});

	// Tip
	const tipContainer = content.createDiv({ cls: 'cr-info-box' });
	const tipIcon = tipContainer.createSpan({ cls: 'cr-info-box-icon' });
	setIcon(tipIcon, 'info');
	tipContainer.createSpan({
		text: 'If both your alias and the Canvas Roots property exist in a note, the Canvas Roots property takes precedence.'
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
