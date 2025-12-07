/**
 * Relationship Type Editor Modal
 *
 * Modal for creating, editing, and customizing relationship types.
 * Supports both creating new user-defined types and customizing built-in types.
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { RelationshipTypeDefinition, RelationshipLineStyle } from '../types/relationship-types';
import {
	DEFAULT_RELATIONSHIP_TYPES,
	getAllRelationshipCategories,
	getAllRelationshipTypesWithCustomizations
} from '../constants/default-relationship-types';

/**
 * Color presets for relationship types
 */
const COLOR_PRESETS: string[] = [
	'#14b8a6', // Teal (legal)
	'#06b6d4', // Cyan (adoption)
	'#0ea5e9', // Sky (foster)
	'#3b82f6', // Blue (godparent)
	'#8b5cf6', // Violet (mentor)
	'#f97316', // Orange (professional)
	'#ea580c', // Dark orange (employer)
	'#6b7280', // Gray (witness)
	'#9ca3af', // Light gray (neighbor)
	'#22c55e', // Green (companion)
	'#ec4899', // Pink (betrothed)
	'#eab308', // Gold (feudal)
	'#10b981', // Emerald (ally)
	'#ef4444', // Red (rival)
	'#95a5a6', // Silver (custom)
	'#2ecc71'  // Emerald
];

interface RelationshipTypeEditorModalOptions {
	/** Callback after successful save */
	onSave: () => void;
	/** Existing type to edit (for user-created types) */
	editType?: RelationshipTypeDefinition;
	/** Built-in type to customize (for overriding defaults) */
	customizeBuiltIn?: RelationshipTypeDefinition;
}

/**
 * Modal for creating, editing, or customizing relationship types
 */
export class RelationshipTypeEditorModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private onSave: () => void;
	private editMode: boolean = false;
	private customizeMode: boolean = false;
	private originalId?: string;
	private builtInDefaults?: RelationshipTypeDefinition;

	// Form fields
	private id: string = '';
	private name: string = '';
	private description: string = '';
	private color: string = '#95a5a6';
	private lineStyle: RelationshipLineStyle = 'solid';
	private category: string = 'social';
	private inverse: string = '';
	private symmetric: boolean = false;

	constructor(app: App, plugin: CanvasRootsPlugin, options: RelationshipTypeEditorModalOptions) {
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
			this.color = options.editType.color;
			this.lineStyle = options.editType.lineStyle;
			this.category = options.editType.category;
			this.inverse = options.editType.inverse || '';
			this.symmetric = options.editType.symmetric;
		} else if (options.customizeBuiltIn) {
			// Customizing a built-in type
			this.customizeMode = true;
			this.builtInDefaults = options.customizeBuiltIn;
			this.originalId = options.customizeBuiltIn.id;
			this.id = options.customizeBuiltIn.id;

			// Check for existing customization
			const existing = this.plugin.settings.relationshipTypeCustomizations?.[this.id];
			if (existing) {
				this.name = existing.name ?? options.customizeBuiltIn.name;
				this.description = existing.description ?? options.customizeBuiltIn.description ?? '';
				this.color = existing.color ?? options.customizeBuiltIn.color;
				this.lineStyle = existing.lineStyle ?? options.customizeBuiltIn.lineStyle;
			} else {
				this.name = options.customizeBuiltIn.name;
				this.description = options.customizeBuiltIn.description || '';
				this.color = options.customizeBuiltIn.color;
				this.lineStyle = options.customizeBuiltIn.lineStyle;
			}
			// These can't be customized for built-ins
			this.category = options.customizeBuiltIn.category;
			this.inverse = options.customizeBuiltIn.inverse || '';
			this.symmetric = options.customizeBuiltIn.symmetric;
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-event-type-editor-modal');

		const title = this.customizeMode
			? `Customize "${this.builtInDefaults?.name}"`
			: this.editMode
				? 'Edit relationship type'
				: 'Create relationship type';
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
			.setDesc('Display name for this relationship type')
			.addText(text => text
				.setPlaceholder('e.g., Blood brother')
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
					.setPlaceholder('blood_brother')
					.setValue(this.id)
					.onChange(value => this.id = this.slugify(value)));
		}

		// Description
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Brief description of this relationship type')
			.addText(text => text
				.setPlaceholder('e.g., Sworn brothers bound by oath')
				.setValue(this.description)
				.onChange(value => this.description = value));

		// Category (only for new types and editing user types)
		if (!this.customizeMode) {
			new Setting(contentEl)
				.setName('Category')
				.setDesc('Group this type with similar relationships')
				.addDropdown(dropdown => {
					// Get all categories (built-in + custom, with customizations and hiding)
					const categories = getAllRelationshipCategories(
						this.plugin.settings.customRelationshipCategories || [],
						this.plugin.settings.relationshipCategoryCustomizations,
						this.plugin.settings.hiddenRelationshipCategories
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

		// Line style
		new Setting(contentEl)
			.setName('Line style')
			.setDesc('Style of edge when displayed on canvas')
			.addDropdown(dropdown => dropdown
				.addOption('solid', 'Solid')
				.addOption('dashed', 'Dashed')
				.addOption('dotted', 'Dotted')
				.setValue(this.lineStyle)
				.onChange(value => {
					this.lineStyle = value as RelationshipLineStyle;
				}));

		// Inverse relationship (only for new types and editing user types)
		if (!this.customizeMode) {
			new Setting(contentEl)
				.setName('Inverse relationship')
				.setDesc('The relationship type that represents the other direction (e.g., mentor → disciple)')
				.addDropdown(dropdown => {
					dropdown.addOption('', '(none - or symmetric)');

					// Get all types for inverse selection
					const allTypes = getAllRelationshipTypesWithCustomizations(
						this.plugin.settings.customRelationshipTypes || [],
						true,
						this.plugin.settings.relationshipTypeCustomizations,
						[]
					);

					for (const type of allTypes) {
						if (type.id !== this.id) {
							dropdown.addOption(type.id, type.name);
						}
					}

					dropdown.setValue(this.inverse);
					dropdown.onChange(value => {
						this.inverse = value;
						if (value) {
							this.symmetric = false;
						}
					});
				});

			// Symmetric
			new Setting(contentEl)
				.setName('Symmetric')
				.setDesc('Whether this relationship is the same in both directions (e.g., neighbor, ally)')
				.addToggle(toggle => toggle
					.setValue(this.symmetric)
					.onChange(value => {
						this.symmetric = value;
						if (value) {
							this.inverse = '';
						}
					}));
		}

		// Color picker
		const colorSetting = new Setting(contentEl)
			.setName('Color')
			.setDesc('Edge color for this relationship type');

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
			new Notice(`Failed to save relationship type: ${error}`);
		}
	}

	private async saveCustomization(): Promise<void> {
		// Initialize customizations if needed
		if (!this.plugin.settings.relationshipTypeCustomizations) {
			this.plugin.settings.relationshipTypeCustomizations = {};
		}

		const builtIn = this.builtInDefaults!;
		const customization: Partial<RelationshipTypeDefinition> = {};

		// Only store properties that differ from built-in defaults
		if (this.name !== builtIn.name) customization.name = this.name.trim();
		if (this.description !== (builtIn.description || '')) customization.description = this.description.trim();
		if (this.color !== builtIn.color) customization.color = this.color;
		if (this.lineStyle !== builtIn.lineStyle) customization.lineStyle = this.lineStyle;

		if (Object.keys(customization).length > 0) {
			this.plugin.settings.relationshipTypeCustomizations[this.id] = customization;
		} else {
			// No customizations - remove any existing
			delete this.plugin.settings.relationshipTypeCustomizations[this.id];
		}

		await this.plugin.saveSettings();
		new Notice('Relationship type customized');
	}

	private async updateUserType(): Promise<void> {
		const existingTypes = this.plugin.settings.customRelationshipTypes;
		const index = existingTypes.findIndex(t => t.id === this.originalId);

		if (index !== -1) {
			existingTypes[index] = {
				id: this.id,
				name: this.name.trim(),
				description: this.description.trim(),
				color: this.color,
				lineStyle: this.lineStyle,
				category: this.category,
				inverse: this.inverse || undefined,
				symmetric: this.symmetric,
				builtIn: false
			};
		}

		await this.plugin.saveSettings();
		new Notice('Relationship type updated');
	}

	private async createUserType(): Promise<void> {
		// Check for ID conflicts
		const existingTypes = this.plugin.settings.customRelationshipTypes;
		const builtInConflict = DEFAULT_RELATIONSHIP_TYPES.find(t => t.id === this.id);
		const customConflict = existingTypes.find(t => t.id === this.id);

		if (builtInConflict || customConflict) {
			new Notice('A relationship type with this ID already exists');
			return;
		}

		const typeDef: RelationshipTypeDefinition = {
			id: this.id,
			name: this.name.trim(),
			description: this.description.trim(),
			color: this.color,
			lineStyle: this.lineStyle,
			category: this.category,
			inverse: this.inverse || undefined,
			symmetric: this.symmetric,
			builtIn: false
		};

		existingTypes.push(typeDef);
		await this.plugin.saveSettings();
		new Notice('Relationship type created');
	}

	private async resetToDefault(): Promise<void> {
		if (!this.customizeMode || !this.builtInDefaults) return;

		// Remove customization
		if (this.plugin.settings.relationshipTypeCustomizations) {
			delete this.plugin.settings.relationshipTypeCustomizations[this.id];
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
