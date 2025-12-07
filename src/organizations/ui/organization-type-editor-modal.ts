/**
 * Organization Type Editor Modal
 *
 * Modal for creating, editing, and customizing organization types.
 * Supports both creating new user-defined types and customizing built-in types.
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { OrganizationTypeDefinition } from '../types/organization-types';
import { BUILT_IN_ORGANIZATION_TYPES, getAllOrganizationCategories } from '../constants/organization-types';
import type { LucideIconName } from '../../ui/lucide-icons';
import { setLucideIcon } from '../../ui/lucide-icons';

/**
 * Common icons for organization types
 */
const ICON_SUGGESTIONS: LucideIconName[] = [
	'crown', 'landmark', 'building-2', 'shield', 'church', 'graduation-cap',
	'hammer', 'folder', 'users', 'star', 'flag', 'globe',
	'home', 'building', 'scroll', 'book-open',
	'heart', 'ship', 'layers', 'file-text'
];

/**
 * Color presets for organization types
 */
const COLOR_PRESETS: string[] = [
	'#9b59b6', // Purple (noble house)
	'#e67e22', // Orange (guild)
	'#3498db', // Blue (corporation)
	'#e74c3c', // Red (military)
	'#f1c40f', // Gold (religious)
	'#27ae60', // Green (political)
	'#1abc9c', // Teal (educational)
	'#95a5a6', // Gray (custom)
	'#2ecc71', // Emerald
	'#34495e', // Dark gray
	'#8e44ad', // Deep purple
	'#d35400', // Dark orange
	'#16a085', // Sea green
	'#c0392b', // Dark red
	'#2980b9', // Royal blue
	'#7f8c8d'  // Silver
];

interface OrganizationTypeEditorModalOptions {
	/** Callback after successful save */
	onSave: () => void;
	/** Existing type to edit (for user-created types) */
	editType?: OrganizationTypeDefinition;
	/** Built-in type to customize (for overriding defaults) */
	customizeBuiltIn?: OrganizationTypeDefinition;
}

/**
 * Modal for creating, editing, or customizing organization types
 */
export class OrganizationTypeEditorModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private onSave: () => void;
	private editMode: boolean = false;
	private customizeMode: boolean = false;
	private originalId?: string;
	private builtInDefaults?: OrganizationTypeDefinition;

	// Form fields
	private id: string = '';
	private name: string = '';
	private description: string = '';
	private icon: LucideIconName = 'folder';
	private color: string = '#95a5a6';
	private category: string = 'other';

	constructor(app: App, plugin: CanvasRootsPlugin, options: OrganizationTypeEditorModalOptions) {
		super(app);
		this.plugin = plugin;
		this.onSave = options.onSave;

		if (options.editType) {
			// Editing an existing user-created type
			this.editMode = true;
			this.originalId = options.editType.id;
			this.id = options.editType.id;
			this.name = options.editType.name;
			this.description = options.editType.description || '';
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
			const existing = this.plugin.settings.organizationTypeCustomizations?.[this.id];
			if (existing) {
				this.name = existing.name ?? options.customizeBuiltIn.name;
				this.description = existing.description ?? options.customizeBuiltIn.description ?? '';
				this.icon = existing.icon ?? options.customizeBuiltIn.icon;
				this.color = existing.color ?? options.customizeBuiltIn.color;
				this.category = existing.category ?? options.customizeBuiltIn.category;
			} else {
				this.name = options.customizeBuiltIn.name;
				this.description = options.customizeBuiltIn.description || '';
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
				? 'Edit organization type'
				: 'Create organization type';
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
			.setDesc('Display name for this organization type')
			.addText(text => text
				.setPlaceholder('e.g., Secret society')
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
					.setPlaceholder('secret_society')
					.setValue(this.id)
					.onChange(value => this.id = this.slugify(value)));
		}

		// Description
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Brief description of this organization type')
			.addText(text => text
				.setPlaceholder('e.g., Clandestine organizations with hidden membership')
				.setValue(this.description)
				.onChange(value => this.description = value));

		// Category (only for new types and editing user types)
		if (!this.customizeMode) {
			new Setting(contentEl)
				.setName('Category')
				.setDesc('Group this type with similar organizations')
				.addDropdown(dropdown => {
					// Get all categories (built-in + custom, with customizations and hiding)
					const categories = getAllOrganizationCategories(
						this.plugin.settings.customOrganizationCategories || [],
						this.plugin.settings.organizationCategoryCustomizations,
						this.plugin.settings.hiddenOrganizationCategories
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
			.setDesc('Badge color for this organization type');

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
			.setDesc('Icon to display with this organization type');

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
			new Notice(`Failed to save organization type: ${error}`);
		}
	}

	private async saveCustomization(): Promise<void> {
		// Initialize customizations if needed
		if (!this.plugin.settings.organizationTypeCustomizations) {
			this.plugin.settings.organizationTypeCustomizations = {};
		}

		const builtIn = this.builtInDefaults!;
		const customization: Partial<OrganizationTypeDefinition> = {};

		// Only store properties that differ from built-in defaults
		if (this.name !== builtIn.name) customization.name = this.name.trim();
		if (this.description !== (builtIn.description || '')) customization.description = this.description.trim();
		if (this.icon !== builtIn.icon) customization.icon = this.icon;
		if (this.color !== builtIn.color) customization.color = this.color;

		if (Object.keys(customization).length > 0) {
			this.plugin.settings.organizationTypeCustomizations[this.id] = customization;
		} else {
			// No customizations - remove any existing
			delete this.plugin.settings.organizationTypeCustomizations[this.id];
		}

		await this.plugin.saveSettings();
		new Notice('Organization type customized');
	}

	private async updateUserType(): Promise<void> {
		const existingTypes = this.plugin.settings.customOrganizationTypes;
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
		new Notice('Organization type updated');
	}

	private async createUserType(): Promise<void> {
		// Check for ID conflicts
		const existingTypes = this.plugin.settings.customOrganizationTypes;
		const builtInConflict = BUILT_IN_ORGANIZATION_TYPES.find(t => t.id === this.id);
		const customConflict = existingTypes.find(t => t.id === this.id);

		if (builtInConflict || customConflict) {
			new Notice('An organization type with this ID already exists');
			return;
		}

		const typeDef: OrganizationTypeDefinition = {
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
		new Notice('Organization type created');
	}

	private async resetToDefault(): Promise<void> {
		if (!this.customizeMode || !this.builtInDefaults) return;

		// Remove customization
		if (this.plugin.settings.organizationTypeCustomizations) {
			delete this.plugin.settings.organizationTypeCustomizations[this.id];
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
