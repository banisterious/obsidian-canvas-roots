/**
 * Source Type Editor Modal
 *
 * Modal for creating, editing, and customizing source types.
 * Supports both creating new user-defined types and customizing built-in types.
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { SourceTypeDefinition } from '../types/source-types';
import { BUILT_IN_SOURCE_TYPES, getAllSourceCategories } from '../types/source-types';
import type { LucideIconName } from '../../ui/lucide-icons';
import { setLucideIcon } from '../../ui/lucide-icons';

/**
 * Common icons for source types
 */
const ICON_SUGGESTIONS: LucideIconName[] = [
	'file-text', 'file', 'bookmark', 'users', 'church', 'gavel', 'map',
	'scroll', 'shield', 'ship', 'image', 'mail', 'newspaper', 'mic',
	'archive', 'book-open', 'folder', 'file-check',
	'landmark', 'building', 'building-2',
	'globe', 'flag', 'star', 'heart', 'home'
];

/**
 * Color presets for source types
 */
const COLOR_PRESETS: string[] = [
	'#4a90d9', // Blue (vital records)
	'#7c7c7c', // Gray (obituary)
	'#5ba55b', // Green (census)
	'#9b59b6', // Purple (church)
	'#8b4513', // Brown (court)
	'#228b22', // Forest green (land deed)
	'#daa520', // Goldenrod (probate)
	'#2e8b57', // Sea green (military)
	'#4169e1', // Royal blue (immigration)
	'#ff6b6b', // Coral (photo)
	'#ff8c00', // Orange (correspondence)
	'#696969', // Dim gray (newspaper)
	'#e91e63', // Pink (oral history)
	'#808080', // Gray (custom)
	'#3498db', // Light blue
	'#27ae60'  // Emerald
];

interface SourceTypeEditorModalOptions {
	/** Callback after successful save */
	onSave: () => void;
	/** Existing type to edit (for user-created types) */
	editType?: SourceTypeDefinition;
	/** Built-in type to customize (for overriding defaults) */
	customizeBuiltIn?: SourceTypeDefinition;
}

/**
 * Modal for creating, editing, or customizing source types
 */
export class SourceTypeEditorModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private onSave: () => void;
	private editMode: boolean = false;
	private customizeMode: boolean = false;
	private originalId?: string;
	private builtInDefaults?: SourceTypeDefinition;

	// Form fields
	private id: string = '';
	private name: string = '';
	private description: string = '';
	private icon: LucideIconName = 'file';
	private color: string = '#808080';
	private category: string = 'other';

	constructor(app: App, plugin: CanvasRootsPlugin, options: SourceTypeEditorModalOptions) {
		super(app);
		this.plugin = plugin;
		this.onSave = options.onSave;

		if (options.editType) {
			// Editing an existing user-created type
			this.editMode = true;
			this.originalId = options.editType.id;
			this.id = options.editType.id;
			this.name = options.editType.name;
			this.description = options.editType.description;
			this.icon = options.editType.icon;
			this.color = options.editType.color;
			this.category = options.editType.category;
		} else if (options.customizeBuiltIn) {
			// Customizing a built-in type
			this.customizeMode = true;
			this.builtInDefaults = options.customizeBuiltIn;
			this.originalId = options.customizeBuiltIn.id;
			this.id = options.customizeBuiltIn.id;

			// Check for existing customization
			const existing = this.plugin.settings.sourceTypeCustomizations?.[this.id];
			if (existing) {
				this.name = existing.name ?? options.customizeBuiltIn.name;
				this.description = existing.description ?? options.customizeBuiltIn.description;
				this.icon = existing.icon ?? options.customizeBuiltIn.icon;
				this.color = existing.color ?? options.customizeBuiltIn.color;
				this.category = existing.category ?? options.customizeBuiltIn.category;
			} else {
				this.name = options.customizeBuiltIn.name;
				this.description = options.customizeBuiltIn.description;
				this.icon = options.customizeBuiltIn.icon;
				this.color = options.customizeBuiltIn.color;
				this.category = options.customizeBuiltIn.category;
			}
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-event-type-editor-modal');

		const title = this.customizeMode
			? `Customize "${this.builtInDefaults?.name}"`
			: this.editMode
				? 'Edit source type'
				: 'Create source type';
		contentEl.createEl('h2', { text: title });

		if (this.customizeMode) {
			const info = contentEl.createDiv({ cls: 'cr-modal-info' });
			info.createEl('p', {
				text: 'Customize this built-in type. Changes only affect display; existing notes still work.',
				cls: 'crc-text-muted'
			});
		}

		// Name
		new Setting(contentEl)
			.setName('Name')
			.setDesc('Display name for this source type')
			.addText(text => text
				.setPlaceholder('e.g., Tax record')
				.setValue(this.name)
				.onChange(value => {
					this.name = value;
					// Auto-generate ID from name if creating new
					if (!this.editMode && !this.customizeMode) {
						this.id = this.slugify(value);
					}
					updateColorPreview();
				}));

		// ID (only for new types, not editable for existing or customizations)
		if (!this.editMode && !this.customizeMode) {
			new Setting(contentEl)
				.setName('ID')
				.setDesc('Unique identifier (used in frontmatter)')
				.addText(text => text
					.setPlaceholder('tax_record')
					.setValue(this.id)
					.onChange(value => this.id = this.slugify(value)));
		}

		// Description
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Brief description of this source type')
			.addText(text => text
				.setPlaceholder('e.g., Property and income tax records')
				.setValue(this.description)
				.onChange(value => this.description = value));

		// Category (only for new types and editing user types)
		if (!this.customizeMode) {
			new Setting(contentEl)
				.setName('Category')
				.setDesc('Group this type with similar sources')
				.addDropdown(dropdown => {
					// Get all categories (built-in + custom, with customizations and hiding)
					const categories = getAllSourceCategories(
						this.plugin.settings.customSourceCategories || [],
						this.plugin.settings.sourceCategoryCustomizations,
						this.plugin.settings.hiddenSourceCategories
					);
					categories.forEach(cat => {
						dropdown.addOption(cat.id, cat.name);
					});
					dropdown.setValue(this.category);
					dropdown.onChange(value => {
						this.category = value;
					});
				});
		}

		// Color picker
		const colorSetting = new Setting(contentEl)
			.setName('Color')
			.setDesc('Badge color for this source type');

		const colorContainer = colorSetting.controlEl.createDiv({ cls: 'cr-color-picker' });

		// Color input
		const colorInput = colorContainer.createEl('input', {
			type: 'color',
			value: this.color,
			cls: 'cr-color-input'
		});
		colorInput.addEventListener('input', (e) => {
			this.color = (e.target as HTMLInputElement).value;
			updateColorPreview();
		});

		// Color presets
		const presetsContainer = colorContainer.createDiv({ cls: 'cr-color-presets' });
		COLOR_PRESETS.forEach(preset => {
			const presetBtn = presetsContainer.createEl('button', { cls: 'cr-color-preset' });
			presetBtn.style.backgroundColor = preset;
			presetBtn.addEventListener('click', (e) => {
				e.preventDefault();
				this.color = preset;
				colorInput.value = preset;
				updateColorPreview();
			});
		});

		// Color preview
		const colorPreview = colorContainer.createDiv({ cls: 'cr-color-preview' });
		const updateColorPreview = () => {
			colorPreview.style.backgroundColor = this.color;
			colorPreview.style.color = this.getContrastColor(this.color);
			colorPreview.textContent = this.name || 'Preview';
		};
		updateColorPreview();

		// Icon picker
		const iconSetting = new Setting(contentEl)
			.setName('Icon')
			.setDesc('Icon to display with this source type');

		const iconContainer = iconSetting.controlEl.createDiv({ cls: 'cr-icon-picker' });

		// Current icon preview
		const currentIconContainer = iconContainer.createDiv({ cls: 'cr-current-icon' });
		const iconPreview = currentIconContainer.createSpan({ cls: 'cr-icon-preview' });
		setLucideIcon(iconPreview, this.icon);

		// Icon grid
		const iconGrid = iconContainer.createDiv({ cls: 'cr-icon-grid' });
		ICON_SUGGESTIONS.forEach(iconName => {
			const iconBtn = iconGrid.createEl('button', { cls: 'cr-icon-option' });
			setLucideIcon(iconBtn, iconName);
			iconBtn.setAttribute('title', iconName);
			if (iconName === this.icon) {
				iconBtn.addClass('is-selected');
			}
			iconBtn.addEventListener('click', (e) => {
				e.preventDefault();
				this.icon = iconName;
				// Update selection
				iconGrid.querySelectorAll('.cr-icon-option').forEach(btn => {
					btn.removeClass('is-selected');
				});
				iconBtn.addClass('is-selected');
				iconPreview.empty();
				setLucideIcon(iconPreview, iconName);
			});
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'cr-modal-buttons' });

		// Reset button for customizations
		if (this.customizeMode) {
			const resetBtn = buttonContainer.createEl('button', { text: 'Reset to default' });
			resetBtn.addEventListener('click', () => void this.resetToDefault());
		}

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const saveBtn = buttonContainer.createEl('button', {
			text: this.customizeMode ? 'Save customization' : this.editMode ? 'Save changes' : 'Create type',
			cls: 'mod-cta'
		});
		saveBtn.addEventListener('click', () => void this.saveType());
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	private async saveType(): Promise<void> {
		// Validation
		if (!this.name.trim()) {
			new Notice('Please enter a name');
			return;
		}

		if (!this.customizeMode && !this.id.trim()) {
			new Notice('Please enter an ID');
			return;
		}

		try {
			if (this.customizeMode) {
				// Save as customization of built-in type
				await this.saveCustomization();
			} else if (this.editMode) {
				// Update existing user type
				await this.updateUserType();
			} else {
				// Create new user type
				await this.createUserType();
			}

			this.close();
			this.onSave();
		} catch (error) {
			new Notice(`Failed to save source type: ${error}`);
		}
	}

	private async saveCustomization(): Promise<void> {
		// Initialize customizations if needed
		if (!this.plugin.settings.sourceTypeCustomizations) {
			this.plugin.settings.sourceTypeCustomizations = {};
		}

		const builtIn = this.builtInDefaults!;
		const customization: Partial<SourceTypeDefinition> = {};

		// Only store properties that differ from built-in defaults
		if (this.name !== builtIn.name) customization.name = this.name.trim();
		if (this.description !== builtIn.description) customization.description = this.description.trim();
		if (this.icon !== builtIn.icon) customization.icon = this.icon;
		if (this.color !== builtIn.color) customization.color = this.color;

		if (Object.keys(customization).length > 0) {
			this.plugin.settings.sourceTypeCustomizations[this.id] = customization;
		} else {
			// No customizations - remove any existing
			delete this.plugin.settings.sourceTypeCustomizations[this.id];
		}

		await this.plugin.saveSettings();
		new Notice('Source type customized');
	}

	private async updateUserType(): Promise<void> {
		const existingTypes = this.plugin.settings.customSourceTypes;
		const index = existingTypes.findIndex(t => t.id === this.originalId);

		if (index !== -1) {
			existingTypes[index] = {
				id: this.id,
				name: this.name.trim(),
				description: this.description.trim(),
				icon: this.icon,
				color: this.color,
				category: this.category,
				isBuiltIn: false
			};
		}

		await this.plugin.saveSettings();
		new Notice('Source type updated');
	}

	private async createUserType(): Promise<void> {
		// Check for ID conflicts
		const existingTypes = this.plugin.settings.customSourceTypes;
		const builtInConflict = BUILT_IN_SOURCE_TYPES.find(t => t.id === this.id);
		const customConflict = existingTypes.find(t => t.id === this.id);

		if (builtInConflict || customConflict) {
			new Notice('A source type with this ID already exists');
			return;
		}

		const typeDef: SourceTypeDefinition = {
			id: this.id,
			name: this.name.trim(),
			description: this.description.trim(),
			icon: this.icon,
			color: this.color,
			category: this.category,
			isBuiltIn: false
		};

		existingTypes.push(typeDef);
		await this.plugin.saveSettings();
		new Notice('Source type created');
	}

	private async resetToDefault(): Promise<void> {
		if (!this.customizeMode || !this.builtInDefaults) return;

		// Remove customization
		if (this.plugin.settings.sourceTypeCustomizations) {
			delete this.plugin.settings.sourceTypeCustomizations[this.id];
		}

		await this.plugin.saveSettings();
		new Notice('Reset to default');
		this.close();
		this.onSave();
	}

	private slugify(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.substring(0, 50);
	}

	private getContrastColor(hexColor: string): string {
		const hex = hexColor.replace('#', '');
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		return luminance > 0.5 ? '#000000' : '#ffffff';
	}
}
