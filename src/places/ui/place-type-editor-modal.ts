/**
 * Place Type Editor Modal
 *
 * Modal for creating, editing, and customizing place types.
 * Supports both creating new user-defined types and customizing built-in types.
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { PlaceTypeDefinition } from '../types/place-types';
import {
	DEFAULT_PLACE_TYPES,
	getAllPlaceTypeCategories
} from '../constants/default-place-types';

interface PlaceTypeEditorModalOptions {
	/** Callback after successful save */
	onSave: () => void;
	/** Existing type to edit (for user-created types) */
	editType?: PlaceTypeDefinition;
	/** Built-in type to customize (for overriding defaults) */
	customizeBuiltIn?: PlaceTypeDefinition;
}

/**
 * Modal for creating, editing, or customizing place types
 */
export class PlaceTypeEditorModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private onSave: () => void;
	private editMode: boolean = false;
	private customizeMode: boolean = false;
	private originalId?: string;
	private builtInDefaults?: PlaceTypeDefinition;

	// Form fields
	private id: string = '';
	private name: string = '';
	private description: string = '';
	private hierarchyLevel: number = 7; // Default to city level
	private category: string = 'settlement'; // Default category

	constructor(app: App, plugin: CanvasRootsPlugin, options: PlaceTypeEditorModalOptions) {
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
			this.hierarchyLevel = options.editType.hierarchyLevel;
			this.category = options.editType.category || 'settlement';
		} else if (options.customizeBuiltIn) {
			// Customizing a built-in type
			this.customizeMode = true;
			this.builtInDefaults = options.customizeBuiltIn;
			this.originalId = options.customizeBuiltIn.id;
			this.id = options.customizeBuiltIn.id;

			// Check for existing customization
			const existing = this.plugin.settings.placeTypeCustomizations?.[this.id];
			if (existing) {
				this.name = existing.name ?? options.customizeBuiltIn.name;
				this.description = existing.description ?? options.customizeBuiltIn.description ?? '';
				this.hierarchyLevel = existing.hierarchyLevel ?? options.customizeBuiltIn.hierarchyLevel;
				this.category = existing.category ?? options.customizeBuiltIn.category;
			} else {
				this.name = options.customizeBuiltIn.name;
				this.description = options.customizeBuiltIn.description || '';
				this.hierarchyLevel = options.customizeBuiltIn.hierarchyLevel;
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
				? 'Edit place type'
				: 'Create place type';
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
			.setDesc('Display name for this place type')
			.addText(text => text
				.setPlaceholder('e.g., Township')
				.setValue(this.name)
				.onChange(value => {
					this.name = value;
					// Auto-generate ID from name if creating new
					if (!this.editMode && !this.customizeMode) {
						this.id = this.slugify(value);
					}
				}));

		// ID (only for new types, not editable for existing or customizations)
		if (!this.editMode && !this.customizeMode) {
			new Setting(contentEl)
				.setName('ID')
				.setDesc('Unique identifier (used in frontmatter)')
				.addText(text => text
					.setPlaceholder('township')
					.setValue(this.id)
					.onChange(value => this.id = this.slugify(value)));
		}

		// Description
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Brief description of this place type')
			.addText(text => text
				.setPlaceholder('e.g., Administrative subdivision')
				.setValue(this.description)
				.onChange(value => this.description = value));

		// Category dropdown
		const categories = getAllPlaceTypeCategories(
			this.plugin.settings.customPlaceTypeCategories || [],
			this.plugin.settings.placeTypeCategoryCustomizations,
			this.plugin.settings.hiddenPlaceTypeCategories
		);

		new Setting(contentEl)
			.setName('Category')
			.setDesc('Group this place type belongs to')
			.addDropdown(dropdown => {
				for (const cat of categories) {
					dropdown.addOption(cat.id, cat.name);
				}
				dropdown.setValue(this.category);
				dropdown.onChange(value => this.category = value);
			});

		// Hierarchy level with explanation
		const hierarchySetting = new Setting(contentEl)
			.setName('Hierarchy level')
			.setDesc('Determines valid parent-child relationships. Lower levels can be parents of higher levels.');

		// Hierarchy info display (example parents/children)
		const hierarchyInfo = contentEl.createDiv({ cls: 'cr-hierarchy-info' });
		const updateHierarchyInfo = () => {
			hierarchyInfo.empty();

			// Show example parents/children
			const exampleParents = DEFAULT_PLACE_TYPES.filter(t =>
				t.hierarchyLevel < this.hierarchyLevel
			).slice(-3);
			const exampleChildren = DEFAULT_PLACE_TYPES.filter(t =>
				t.hierarchyLevel > this.hierarchyLevel
			).slice(0, 3);

			if (exampleParents.length > 0) {
				hierarchyInfo.createEl('div', {
					text: `Can be child of: ${exampleParents.map(t => t.name).join(', ')}`,
					cls: 'crc-text-muted cr-hierarchy-example'
				});
			}
			if (exampleChildren.length > 0) {
				hierarchyInfo.createEl('div', {
					text: `Can be parent of: ${exampleChildren.map(t => t.name).join(', ')}`,
					cls: 'crc-text-muted cr-hierarchy-example'
				});
			}
		};

		// Level input with slider and number
		const levelContainer = hierarchySetting.controlEl.createDiv({ cls: 'cr-level-picker' });

		const levelSlider = levelContainer.createEl('input', {
			type: 'range',
			value: String(this.hierarchyLevel),
			cls: 'cr-level-slider'
		});
		levelSlider.setAttribute('min', '0');
		levelSlider.setAttribute('max', '15');

		const levelNumber = levelContainer.createEl('input', {
			type: 'number',
			value: String(this.hierarchyLevel),
			cls: 'cr-level-number'
		});
		levelNumber.setAttribute('min', '0');
		levelNumber.setAttribute('max', '99');

		const updateLevel = (value: number) => {
			this.hierarchyLevel = Math.max(0, Math.min(99, value));
			levelSlider.value = String(Math.min(15, this.hierarchyLevel));
			levelNumber.value = String(this.hierarchyLevel);
			updateHierarchyInfo();
		};

		levelSlider.addEventListener('input', () => {
			updateLevel(parseInt(levelSlider.value));
		});

		levelNumber.addEventListener('input', () => {
			updateLevel(parseInt(levelNumber.value) || 0);
		});

		updateHierarchyInfo();

		// Quick level presets
		const presetsContainer = contentEl.createDiv({ cls: 'cr-level-presets' });
		presetsContainer.createEl('span', { text: 'Quick presets:', cls: 'crc-text-muted' });

		const presets = [
			{ label: 'Geographic (0-1)', level: 1 },
			{ label: 'Country (2)', level: 2 },
			{ label: 'State/Province (3)', level: 3 },
			{ label: 'County (5)', level: 5 },
			{ label: 'City (7)', level: 7 },
			{ label: 'Town (8)', level: 8 },
			{ label: 'Village (9)', level: 9 },
			{ label: 'Structure (11-12)', level: 11 }
		];

		for (const preset of presets) {
			const presetBtn = presetsContainer.createEl('button', {
				text: preset.label,
				cls: 'cr-level-preset-btn'
			});
			presetBtn.addEventListener('click', (e) => {
				e.preventDefault();
				updateLevel(preset.level);
			});
		}

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
			new Notice(`Failed to save place type: ${error}`);
		}
	}

	private async saveCustomization(): Promise<void> {
		// Initialize customizations if needed
		if (!this.plugin.settings.placeTypeCustomizations) {
			this.plugin.settings.placeTypeCustomizations = {};
		}

		const builtIn = this.builtInDefaults!;
		const customization: Partial<PlaceTypeDefinition> = {};

		// Only store properties that differ from built-in defaults
		if (this.name !== builtIn.name) customization.name = this.name.trim();
		if (this.description !== (builtIn.description || '')) customization.description = this.description.trim();
		if (this.hierarchyLevel !== builtIn.hierarchyLevel) customization.hierarchyLevel = this.hierarchyLevel;
		if (this.category !== builtIn.category) customization.category = this.category;

		if (Object.keys(customization).length > 0) {
			this.plugin.settings.placeTypeCustomizations[this.id] = customization;
		} else {
			// No customizations - remove any existing
			delete this.plugin.settings.placeTypeCustomizations[this.id];
		}

		await this.plugin.saveSettings();
		new Notice('Place type customized');
	}

	private async updateUserType(): Promise<void> {
		const existingTypes = this.plugin.settings.customPlaceTypes;
		const index = existingTypes.findIndex(t => t.id === this.originalId);

		if (index !== -1) {
			existingTypes[index] = {
				id: this.id,
				name: this.name.trim(),
				description: this.description.trim() || undefined,
				hierarchyLevel: this.hierarchyLevel,
				category: this.category,
				builtIn: false
			};
		}

		await this.plugin.saveSettings();
		new Notice('Place type updated');
	}

	private async createUserType(): Promise<void> {
		// Check for ID conflicts
		const existingTypes = this.plugin.settings.customPlaceTypes;
		const builtInConflict = DEFAULT_PLACE_TYPES.find(t => t.id === this.id);
		const customConflict = existingTypes.find(t => t.id === this.id);

		if (builtInConflict || customConflict) {
			new Notice('A place type with this ID already exists');
			return;
		}

		const typeDef: PlaceTypeDefinition = {
			id: this.id,
			name: this.name.trim(),
			description: this.description.trim() || undefined,
			hierarchyLevel: this.hierarchyLevel,
			category: this.category,
			builtIn: false
		};

		existingTypes.push(typeDef);
		await this.plugin.saveSettings();
		new Notice('Place type created');
	}

	private async resetToDefault(): Promise<void> {
		if (!this.customizeMode || !this.builtInDefaults) return;

		// Remove customization
		if (this.plugin.settings.placeTypeCustomizations) {
			delete this.plugin.settings.placeTypeCustomizations[this.id];
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
}
