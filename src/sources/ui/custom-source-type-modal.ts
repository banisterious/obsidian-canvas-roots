/**
 * Custom Source Type Modal
 *
 * Modal for creating and editing custom source types.
 */

import { App, Modal, Setting, Notice, TextAreaComponent } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { SourceTypeDefinition } from '../types/source-types';
import type { LucideIconName } from '../../ui/lucide-icons';
import { setLucideIcon } from '../../ui/lucide-icons';
import { DEFAULT_SOURCE_TEMPLATE } from '../types/source-templates';

/**
 * Category options for source types
 */
const CATEGORY_OPTIONS: Array<{ value: SourceTypeDefinition['category']; label: string }> = [
	{ value: 'vital', label: 'Vital records' },
	{ value: 'census', label: 'Census' },
	{ value: 'church', label: 'Church records' },
	{ value: 'legal', label: 'Legal & property' },
	{ value: 'military', label: 'Military' },
	{ value: 'media', label: 'Media & correspondence' },
	{ value: 'other', label: 'Other' }
];

/**
 * Common icons for source types
 */
const ICON_SUGGESTIONS: LucideIconName[] = [
	'file-text', 'file', 'bookmark', 'users', 'church', 'gavel',
	'map', 'scroll', 'shield', 'ship', 'image', 'mail', 'newspaper',
	'mic', 'archive', 'folder', 'file-check', 'graduation-cap', 'building',
	'landmark', 'home', 'calendar', 'book-open', 'layers', 'link-2',
	'globe', 'map-pin', 'building-2', 'hammer'
];

/**
 * Color presets for source types
 */
const COLOR_PRESETS: string[] = [
	'#4a90d9', // Blue
	'#5ba55b', // Green
	'#9b59b6', // Purple
	'#8b4513', // Brown
	'#228b22', // Forest green
	'#daa520', // Goldenrod
	'#2e8b57', // Sea green
	'#4169e1', // Royal blue
	'#ff6b6b', // Coral
	'#ff8c00', // Dark orange
	'#696969', // Dim gray
	'#e91e63', // Pink
	'#7c7c7c', // Gray
	'#808080'  // Default gray
];

interface CustomSourceTypeModalOptions {
	/** Callback after successful save */
	onSave: () => void;
	/** Existing type to edit (if editing) */
	editType?: SourceTypeDefinition;
}

/**
 * Modal for creating or editing custom source types
 */
export class CustomSourceTypeModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private onSave: () => void;
	private editMode: boolean = false;
	private originalId?: string;

	// Form fields
	private id: string = '';
	private name: string = '';
	private description: string = '';
	private icon: LucideIconName = 'file';
	private color: string = '#808080';
	private category: SourceTypeDefinition['category'] = 'other';
	private template: string = DEFAULT_SOURCE_TEMPLATE;

	constructor(app: App, plugin: CanvasRootsPlugin, options: CustomSourceTypeModalOptions) {
		super(app);
		this.plugin = plugin;
		this.onSave = options.onSave;

		if (options.editType) {
			this.editMode = true;
			this.originalId = options.editType.id;
			this.id = options.editType.id;
			this.name = options.editType.name;
			this.description = options.editType.description;
			this.icon = options.editType.icon;
			this.color = options.editType.color;
			this.category = options.editType.category;
			this.template = options.editType.template || DEFAULT_SOURCE_TEMPLATE;
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-custom-source-type-modal');

		contentEl.createEl('h2', {
			text: this.editMode ? 'Edit source type' : 'Create source type'
		});

		// Name (required)
		new Setting(contentEl)
			.setName('Name')
			.setDesc('Display name for this source type')
			.addText(text => text
				.setPlaceholder('e.g., Family Bible')
				.setValue(this.name)
				.onChange(value => {
					this.name = value;
					// Auto-generate ID from name if not editing
					if (!this.editMode) {
						this.id = this.slugify(value);
					}
				}));

		// ID (auto-generated or editable for new types)
		new Setting(contentEl)
			.setName('ID')
			.setDesc('Unique identifier (used in frontmatter)')
			.addText(text => text
				.setPlaceholder('family_bible')
				.setValue(this.id)
				.setDisabled(this.editMode)
				.onChange(value => this.id = this.slugify(value)));

		// Description
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Brief description of this source type')
			.addText(text => text
				.setPlaceholder('e.g., Family records in Bibles')
				.setValue(this.description)
				.onChange(value => this.description = value));

		// Category
		new Setting(contentEl)
			.setName('Category')
			.setDesc('Group this type with similar sources')
			.addDropdown(dropdown => {
				CATEGORY_OPTIONS.forEach(opt => {
					dropdown.addOption(opt.value, opt.label);
				});
				dropdown.setValue(this.category);
				dropdown.onChange(value => {
					this.category = value as SourceTypeDefinition['category'];
				});
			});

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

		// Template editor
		new Setting(contentEl)
			.setName('Note template')
			.setDesc('Markdown template for new source notes. Use {{title}} for the source title.');

		const templateContainer = contentEl.createDiv({ cls: 'cr-template-editor' });
		let templateArea: TextAreaComponent;
		new Setting(templateContainer)
			.addTextArea(textArea => {
				templateArea = textArea;
				textArea
					.setPlaceholder('# {{title}}\n\n## Transcription\n\n## Research Notes')
					.setValue(this.template)
					.onChange(value => this.template = value);
				textArea.inputEl.rows = 10;
				textArea.inputEl.addClass('cr-template-textarea');
			});

		// Reset template button
		const resetBtn = templateContainer.createEl('button', {
			text: 'Reset to default',
			cls: 'cr-reset-template-btn'
		});
		resetBtn.addEventListener('click', (e) => {
			e.preventDefault();
			this.template = DEFAULT_SOURCE_TEMPLATE;
			templateArea.setValue(this.template);
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'cr-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const saveBtn = buttonContainer.createEl('button', {
			text: this.editMode ? 'Save changes' : 'Create type',
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

		if (!this.id.trim()) {
			new Notice('Please enter an ID');
			return;
		}

		// Check for ID conflicts (but not with itself when editing)
		const existingTypes = this.plugin.settings.customSourceTypes;
		const conflictingType = existingTypes.find(t =>
			t.id === this.id && t.id !== this.originalId
		);
		if (conflictingType) {
			new Notice('A source type with this ID already exists');
			return;
		}

		// Create the type definition
		const typeDef: SourceTypeDefinition = {
			id: this.id,
			name: this.name.trim(),
			description: this.description.trim(),
			icon: this.icon,
			color: this.color,
			category: this.category,
			isBuiltIn: false,
			template: this.template
		};

		try {
			if (this.editMode && this.originalId) {
				// Update existing type
				const index = existingTypes.findIndex(t => t.id === this.originalId);
				if (index !== -1) {
					existingTypes[index] = typeDef;
				}
			} else {
				// Add new type
				existingTypes.push(typeDef);
			}

			await this.plugin.saveSettings();
			new Notice(this.editMode ? 'Source type updated' : 'Source type created');
			this.close();
			this.onSave();
		} catch (error) {
			new Notice(`Failed to save source type: ${error}`);
		}
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
