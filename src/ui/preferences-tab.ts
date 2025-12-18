/**
 * Preferences Tab UI Component
 *
 * Renders the Preferences tab in the Control Center, showing
 * property aliases, folder locations, and other user preferences.
 */

import { Setting, Notice, App, SliderComponent, AbstractInputSuggest, TextComponent, TFolder } from 'obsidian';
import { setIcon } from 'obsidian';

/**
 * Inline suggest for folder paths with autocomplete from existing vault folders
 */
class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private textComponent: TextComponent;
	private onSelectValue: (value: string) => void;

	constructor(app: App, textComponent: TextComponent, onSelectValue: (value: string) => void) {
		super(app, textComponent.inputEl);
		this.textComponent = textComponent;
		this.onSelectValue = onSelectValue;
	}

	getSuggestions(inputStr: string): TFolder[] {
		const lowerInput = inputStr.toLowerCase();
		const folders: TFolder[] = [];

		// Get all folders from the vault
		const rootFolder = this.app.vault.getRoot();
		this.collectFolders(rootFolder, folders);

		// Filter by input
		return folders
			.filter(folder => folder.path.toLowerCase().includes(lowerInput))
			.sort((a, b) => a.path.localeCompare(b.path))
			.slice(0, 20); // Limit results
	}

	private collectFolders(folder: TFolder, result: TFolder[]): void {
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				result.push(child);
				this.collectFolders(child, result);
			}
		}
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.addClass('cr-folder-suggestion');
		const iconSpan = el.createSpan({ cls: 'cr-folder-suggestion-icon' });
		setIcon(iconSpan, 'folder');
		el.createSpan({ text: folder.path });
	}

	selectSuggestion(folder: TFolder): void {
		this.textComponent.setValue(folder.path);
		this.onSelectValue(folder.path);
		this.close();
	}
}
import type CanvasRootsPlugin from '../../main';
import type { LucideIconName } from './lucide-icons';
import type { ArrowStyle, ColorScheme, SpouseEdgeLabelFormat, SexNormalizationMode } from '../settings';
import {
	PropertyAliasService,
	type PropertyMetadata,
	PERSON_PROPERTY_METADATA,
	EVENT_PROPERTY_METADATA,
	PLACE_PROPERTY_METADATA,
	SOURCE_PROPERTY_METADATA
} from '../core/property-alias-service';
import {
	ValueAliasService,
	EVENT_TYPE_LABELS,
	SEX_LABELS,
	PLACE_CATEGORY_LABELS,
	NOTE_TYPE_LABELS,
	CANONICAL_EVENT_TYPES,
	CANONICAL_SEX_VALUES,
	CANONICAL_PLACE_CATEGORIES,
	CANONICAL_NOTE_TYPES,
	type ValueAliasField
} from '../core/value-alias-service';
import { createIntegrationsCard } from '../integrations/integrations-settings';

/**
 * Render the Preferences tab content
 */
export function renderPreferencesTab(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement,
	showTab: (tabId: string) => void,
	closeModal?: () => void
): void {
	const propertyAliasService = new PropertyAliasService(plugin);
	const valueAliasService = new ValueAliasService(plugin);

	// Cross-reference callout pointing to Plugin Settings
	const settingsCallout = container.createDiv({ cls: 'cr-info-box cr-settings-callout' });
	const settingsIcon = settingsCallout.createSpan({ cls: 'cr-info-box-icon' });
	setIcon(settingsIcon, 'settings');
	settingsCallout.appendText('For privacy, research tools, logging, and advanced options, see ');
	const settingsLink = settingsCallout.createEl('a', {
		text: 'Settings → Canvas Roots',
		href: '#'
	});
	settingsLink.addEventListener('click', (e) => {
		e.preventDefault();
		// Close Control Center first, then open Obsidian settings to Canvas Roots plugin
		closeModal?.();
		// Access Obsidian's internal settings API (not exported in types)
		const appWithSettings = plugin.app as App & { setting?: { open: () => void; openTabById: (id: string) => void } };
		appWithSettings.setting?.open();
		appWithSettings.setting?.openTabById('canvas-roots');
	});
	settingsCallout.appendText('.');

	// Aliases card (property names + property values)
	renderAliasesCard(container, plugin, propertyAliasService, valueAliasService, createCard, showTab);

	// Folder Locations card
	renderFolderLocationsCard(container, plugin, createCard);

	// Canvas Layout card
	renderCanvasLayoutCard(container, plugin, createCard);

	// Canvas Styling card
	renderCanvasStylingCard(container, plugin, createCard);

	// Date Validation card
	renderDateValidationCard(container, plugin, createCard, showTab);

	// Sex Normalization card
	renderSexNormalizationCard(container, plugin, createCard);

	// Integrations card (only shows if Calendarium or other integrations are available)
	createIntegrationsCard(container, plugin, createCard);
}

/**
 * Render a collapsible property section with Setting rows for each property
 */
function renderPropertySection(
	container: HTMLElement,
	title: string,
	properties: PropertyMetadata[],
	propertyAliasService: PropertyAliasService,
	showTab: (tabId: string) => void,
	openByDefault: boolean
): void {
	// Count how many properties have aliases configured
	const configuredCount = properties.filter(meta =>
		propertyAliasService.getAlias(meta.canonical)
	).length;

	// Create details element for collapsibility
	const section = container.createEl('details', {
		cls: 'cr-property-section'
	});

	if (openByDefault) {
		section.setAttribute('open', '');
	}

	// Create summary (clickable header)
	const summary = section.createEl('summary', {
		cls: 'cr-property-section-summary'
	});

	summary.createSpan({
		text: title,
		cls: 'cr-property-section-title'
	});

	// Show "X configured" if any are configured, otherwise show total count
	const countText = configuredCount > 0
		? `${configuredCount} configured`
		: `${properties.length} properties`;
	summary.createSpan({
		text: countText,
		cls: 'cr-property-section-count'
	});

	// Create content container
	const sectionContent = section.createDiv({
		cls: 'cr-property-section-content'
	});

	// Lazy rendering: only render content when section is opened
	let rendered = false;

	const renderContent = () => {
		if (rendered) return;
		rendered = true;

		// Render each property as a Setting
		properties.forEach(meta => {
			const currentAlias = propertyAliasService.getAlias(meta.canonical) || '';

			const setting = new Setting(sectionContent)
				.setName(meta.label)
				.setDesc(meta.description)
				.addText(text => {
					text
						.setPlaceholder(meta.canonical)
						.setValue(currentAlias);

					// Validate and save only on blur (when user finishes typing)
					text.inputEl.addEventListener('blur', () => {
						void (async () => {
							const value = text.inputEl.value;
							const trimmed = value.trim();

							if (trimmed === '') {
								// Empty = remove alias
								if (currentAlias) {
									await propertyAliasService.removeAlias(currentAlias);
									showTab('preferences'); // Refresh
								}
								return;
							}

							// Check if aliasing to itself (warning)
							if (trimmed === meta.canonical) {
								new Notice(`"${trimmed}" is already the canonical name`);
								text.inputEl.value = currentAlias; // Restore previous value
								return;
							}

							// Check for duplicate
							const existingMapping = propertyAliasService.aliases[trimmed];
							if (existingMapping && existingMapping !== meta.canonical) {
								new Notice(`"${trimmed}" is already mapped to "${existingMapping}"`);
								text.inputEl.value = currentAlias; // Restore previous value
								return;
							}

							// Valid - save
							if (trimmed !== currentAlias) {
								await propertyAliasService.setAlias(trimmed, meta.canonical);
								showTab('preferences'); // Refresh
							}
						})();
					});
				})
				.addExtraButton(button => {
					button
						.setIcon('x')
						.setTooltip('Clear alias')
						.onClick(async () => {
							if (currentAlias) {
								await propertyAliasService.removeAlias(currentAlias);
								new Notice(`Cleared alias for ${meta.label}`);
								showTab('preferences'); // Refresh
							}
						});

					// Style clear button based on alias state
					button.extraSettingsEl.addClass(currentAlias ? 'cr-clear-btn--enabled' : 'cr-clear-btn--disabled');
				});

			// Store metadata for search filtering
			setting.settingEl.dataset.canonical = meta.canonical;
			setting.settingEl.dataset.label = meta.label;
			setting.settingEl.dataset.description = meta.description;
		});
	};

	// Render immediately if open by default, otherwise render on first open
	if (openByDefault) {
		renderContent();
	} else {
		section.addEventListener('toggle', () => {
			if (section.open) {
				renderContent();
			}
		}, { once: true });
	}
}

/**
 * Render a value alias section (e.g., Event type values, Sex values)
 */
function renderValueSection(
	container: HTMLElement,
	title: string,
	field: ValueAliasField,
	canonicalValues: readonly string[],
	valueLabels: Record<string, string>,
	valueAliasService: ValueAliasService,
	showTab: (tabId: string) => void,
	openByDefault: boolean
): void {
	// Get aliases for this field
	const aliases = valueAliasService.getAliases(field);
	const aliasCount = Object.keys(aliases).length;

	// Create details element for collapsibility
	const section = container.createEl('details', {
		cls: 'cr-property-section'
	});

	if (openByDefault) {
		section.setAttribute('open', '');
	}

	// Create summary (clickable header)
	const summary = section.createEl('summary', {
		cls: 'cr-property-section-summary'
	});

	summary.createSpan({
		text: title,
		cls: 'cr-property-section-title'
	});

	// Alias count badge
	summary.createSpan({
		text: `${aliasCount} ${aliasCount === 1 ? 'alias' : 'aliases'}`,
		cls: 'cr-property-section-count'
	});

	// Create content container
	const sectionContent = section.createDiv({
		cls: 'cr-property-section-content'
	});

	// Lazy rendering: only render content when section is opened
	let rendered = false;

	const renderContent = () => {
		if (rendered) return;
		rendered = true;

		// Render each canonical value with its alias field
		canonicalValues.forEach(canonicalValue => {
			// Find if there's an alias for this canonical value
			const userValue = Object.entries(aliases).find(
				([_, canonical]) => canonical === canonicalValue
			)?.[0] || '';

			const valueLabel = valueLabels[canonicalValue] || canonicalValue;

			const setting = new Setting(sectionContent)
				.setName(valueLabel)
				.setDesc(canonicalValue)
				.addText(text => {
					text
						.setPlaceholder('your value')
						.setValue(userValue);

					// Validate and save only on blur
					text.inputEl.addEventListener('blur', () => {
						void (async () => {
							const value = text.inputEl.value;
							const trimmed = value.trim();

							if (trimmed === '') {
								// Empty = remove alias if it exists
								if (userValue) {
									await valueAliasService.removeAlias(field, userValue);
									showTab('preferences'); // Refresh
								}
								return;
							}

							// Check if aliasing to itself (warning)
							if (trimmed.toLowerCase() === canonicalValue.toLowerCase()) {
								new Notice(`"${trimmed}" is already the canonical value`);
								text.inputEl.value = userValue; // Restore previous value
								return;
							}

							// Check for duplicate (mapping to different canonical value)
							const existingMapping = aliases[trimmed.toLowerCase()];
							if (existingMapping && existingMapping !== canonicalValue) {
								new Notice(`"${trimmed}" is already mapped to "${existingMapping}"`);
								text.inputEl.value = userValue; // Restore previous value
								return;
							}

							// Valid - save
							if (trimmed !== userValue) {
								// Remove old alias if it exists
								if (userValue) {
									await valueAliasService.removeAlias(field, userValue);
								}
								await valueAliasService.setAlias(field, trimmed, canonicalValue);
								showTab('preferences'); // Refresh
							}
						})();
					});
				})
				.addExtraButton(button => {
					button
						.setIcon('x')
						.setTooltip('Clear alias')
						.onClick(async () => {
							if (userValue) {
								await valueAliasService.removeAlias(field, userValue);
								new Notice(`Cleared alias for ${valueLabel}`);
								showTab('preferences'); // Refresh
							}
						});

					// Style clear button based on alias state
					button.extraSettingsEl.addClass(userValue ? 'cr-clear-btn--enabled' : 'cr-clear-btn--disabled');
				});

			// Store metadata for potential filtering later
			setting.settingEl.dataset.canonical = canonicalValue;
			setting.settingEl.dataset.label = valueLabel;
		});
	};

	// Render immediately if open by default, otherwise render on first open
	if (openByDefault) {
		renderContent();
	} else {
		section.addEventListener('toggle', () => {
			if (section.open) {
				renderContent();
			}
		}, { once: true });
	}
}

/**
 * Render the unified property and value configuration card
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
		title: 'Property and value configuration',
		icon: 'hash',
		subtitle: 'Configure custom property names and values'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Description
	content.createEl('p', {
		cls: 'crc-text-muted',
		text: 'Use your own property names and values - Canvas Roots will recognize them without rewriting your files.'
	});

	// Base files note (prominent position)
	const baseNote = content.createDiv({ cls: 'cr-info-box' });
	const baseNoteIcon = baseNote.createSpan({ cls: 'cr-info-box-icon' });
	setIcon(baseNoteIcon, 'info');
	baseNote.createSpan({
		text: 'Existing Bases files are not automatically updated when aliases change. Delete and recreate the base file to apply new aliases.'
	});

	// ===== SEARCH BOX =====
	const searchContainer = content.createDiv({ cls: 'cr-property-search' });
	let currentSearchQuery = '';

	new Setting(searchContainer)
		.addSearch(search => {
			search
				.setPlaceholder('Search properties...')
				.onChange((query) => {
					currentSearchQuery = query;
					filterProperties(query);
				});
		});

	// ===== PROPERTY SECTIONS =====
	const sectionsContainer = content.createDiv({ cls: 'cr-property-sections' });

	// Person properties section
	renderPropertySection(
		sectionsContainer,
		'Person properties',
		PERSON_PROPERTY_METADATA,
		propertyAliasService,
		showTab,
		false // closed by default
	);

	// Event properties section
	renderPropertySection(
		sectionsContainer,
		'Event properties',
		EVENT_PROPERTY_METADATA,
		propertyAliasService,
		showTab,
		false // closed by default
	);

	// Place properties section
	renderPropertySection(
		sectionsContainer,
		'Place properties',
		PLACE_PROPERTY_METADATA,
		propertyAliasService,
		showTab,
		false // closed by default
	);

	// Source properties section
	renderPropertySection(
		sectionsContainer,
		'Source properties',
		SOURCE_PROPERTY_METADATA,
		propertyAliasService,
		showTab,
		false // closed by default
	);

	// Filter function for search
	function filterProperties(query: string): void {
		const sections = sectionsContainer.querySelectorAll('.cr-property-section');
		const normalized = query.toLowerCase().trim();

		if (!normalized) {
			// Show all
			sections.forEach(section => {
				const settingItems = section.querySelectorAll('.setting-item');
				settingItems.forEach(item => {
					(item as HTMLElement).removeClass('crc-hidden');
				});
				updateSectionCount(section as HTMLElement, settingItems.length, settingItems.length);
			});
			return;
		}

		// Filter each section
		sections.forEach(section => {
			const settingItems = section.querySelectorAll('.setting-item');
			let visibleCount = 0;

			settingItems.forEach(item => {
				const settingItem = item as HTMLElement;
				const canonical = settingItem.dataset.canonical || '';
				const label = settingItem.dataset.label || '';
				const description = settingItem.dataset.description || '';

				const matches = canonical.toLowerCase().includes(normalized) ||
					label.toLowerCase().includes(normalized) ||
					description.toLowerCase().includes(normalized);

				settingItem.toggleClass('crc-hidden', !matches);
				if (matches) visibleCount++;
			});

			updateSectionCount(section as HTMLElement, visibleCount, settingItems.length);
		});
	}

	function updateSectionCount(section: HTMLElement, visible: number, total: number): void {
		const countEl = section.querySelector('.cr-property-section-count');
		if (countEl) {
			if (currentSearchQuery && visible < total) {
				countEl.textContent = `(${visible} of ${total})`;
			} else {
				countEl.textContent = `(${total})`;
			}
		}
	}

	// ===== DIVIDER =====
	content.createEl('hr', { cls: 'cr-property-divider' });

	// ===== VALUE ALIASES SECTION =====
	content.createEl('h4', {
		text: 'Value aliases',
		cls: 'cr-aliases-section-title'
	});

	content.createEl('p', {
		cls: 'crc-text-muted',
		text: 'Map your custom values to Canvas Roots canonical values. For example, map "nameday" to "birth" event type.'
	});

	// Value sections container
	const valueSectionsContainer = content.createDiv({ cls: 'cr-property-sections' });

	// Event type values
	renderValueSection(
		valueSectionsContainer,
		'Event type values',
		'eventType',
		CANONICAL_EVENT_TYPES,
		EVENT_TYPE_LABELS,
		valueAliasService,
		showTab,
		false
	);

	// Sex values
	renderValueSection(
		valueSectionsContainer,
		'Sex values',
		'sex',
		CANONICAL_SEX_VALUES,
		SEX_LABELS,
		valueAliasService,
		showTab,
		false
	);

	// Place category values
	renderValueSection(
		valueSectionsContainer,
		'Place category values',
		'placeCategory',
		CANONICAL_PLACE_CATEGORIES,
		PLACE_CATEGORY_LABELS,
		valueAliasService,
		showTab,
		false
	);

	// Note type values
	renderValueSection(
		valueSectionsContainer,
		'Note type values (cr_type)',
		'noteType',
		CANONICAL_NOTE_TYPES,
		NOTE_TYPE_LABELS,
		valueAliasService,
		showTab,
		false
	);

	// ===== INFO BOXES =====
	// Tip about canonical values
	const tipContainer = content.createDiv({ cls: 'cr-info-box' });
	const tipIcon = tipContainer.createSpan({ cls: 'cr-info-box-icon' });
	setIcon(tipIcon, 'info');
	tipContainer.createSpan({
		text: 'Canonical values take precedence over aliases. Unknown event types are treated as "custom".'
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
	card.id = 'cr-folder-locations-card';
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Folder explanation
	content.createEl('p', {
		cls: 'crc-text-muted',
		text: 'These folders determine where new notes are created during imports and when using "Create new" actions. Canvas Roots identifies notes by their properties (cr_type), not their location—your notes can live anywhere in your vault.'
	});

	// Helper to create folder setting with autocomplete
	const createFolderSetting = (
		name: string,
		desc: string,
		placeholder: string,
		getValue: () => string,
		setValue: (v: string) => void
	) => {
		new Setting(content)
			.setName(name)
			.setDesc(desc)
			.addText(text => {
				text
					.setPlaceholder(placeholder)
					.setValue(getValue())
					.onChange(async (value) => {
						setValue(value);
						await plugin.saveSettings();
					});

				// Attach folder autocomplete
				new FolderSuggest(plugin.app, text, (value) => {
					void (async () => {
						setValue(value);
						await plugin.saveSettings();
					})();
				});
			});
	};

	// People folder
	createFolderSetting(
		'People folder',
		'Default folder for person notes',
		'Canvas Roots/People',
		() => plugin.settings.peopleFolder,
		(v) => { plugin.settings.peopleFolder = v; }
	);

	// Places folder
	createFolderSetting(
		'Places folder',
		'Default folder for place notes',
		'Canvas Roots/Places',
		() => plugin.settings.placesFolder,
		(v) => { plugin.settings.placesFolder = v; }
	);

	// Maps folder
	createFolderSetting(
		'Maps folder',
		'Default folder for custom map images',
		'Canvas Roots/Places/Maps',
		() => plugin.settings.mapsFolder,
		(v) => { plugin.settings.mapsFolder = v; }
	);

	// Organizations folder
	createFolderSetting(
		'Organizations folder',
		'Default folder for organization notes',
		'Canvas Roots/Organizations',
		() => plugin.settings.organizationsFolder,
		(v) => { plugin.settings.organizationsFolder = v; }
	);

	// Sources folder
	createFolderSetting(
		'Sources folder',
		'Default folder for source notes',
		'Canvas Roots/Sources',
		() => plugin.settings.sourcesFolder,
		(v) => { plugin.settings.sourcesFolder = v; }
	);

	// Events folder
	createFolderSetting(
		'Events folder',
		'Default folder for event notes',
		'Canvas Roots/Events',
		() => plugin.settings.eventsFolder,
		(v) => { plugin.settings.eventsFolder = v; }
	);

	// Timelines folder
	createFolderSetting(
		'Timelines folder',
		'Default folder for timeline notes (grouping events)',
		'Canvas Roots/Timelines',
		() => plugin.settings.timelinesFolder,
		(v) => { plugin.settings.timelinesFolder = v; }
	);

	// Bases folder
	createFolderSetting(
		'Bases folder',
		'Default folder for Obsidian Bases files',
		'Canvas Roots/Bases',
		() => plugin.settings.basesFolder,
		(v) => { plugin.settings.basesFolder = v; }
	);

	// Schemas folder
	createFolderSetting(
		'Schemas folder',
		'Default folder for validation schemas',
		'Canvas Roots/Schemas',
		() => plugin.settings.schemasFolder,
		(v) => { plugin.settings.schemasFolder = v; }
	);

	// Universes folder
	createFolderSetting(
		'Universes folder',
		'Default folder for universe notes (fictional worlds)',
		'Canvas Roots/Universes',
		() => plugin.settings.universesFolder,
		(v) => { plugin.settings.universesFolder = v; }
	);

	// Canvases folder
	createFolderSetting(
		'Canvases folder',
		'Default folder for generated canvas files',
		'Canvas Roots/Canvases',
		() => plugin.settings.canvasesFolder,
		(v) => { plugin.settings.canvasesFolder = v; }
	);

	// Reports folder
	createFolderSetting(
		'Reports folder',
		'Default folder for generated reports (Individual Summary, Family Group Sheet, etc.)',
		'Canvas Roots/Reports',
		() => plugin.settings.reportsFolder,
		(v) => { plugin.settings.reportsFolder = v; }
	);

	// Staging folder
	createFolderSetting(
		'Staging folder',
		'Folder for import staging (isolated from main vault during processing)',
		'Canvas Roots/Staging',
		() => plugin.settings.stagingFolder,
		(v) => { plugin.settings.stagingFolder = v; }
	);

	// Note about advanced settings
	const advancedNote = content.createDiv({ cls: 'cr-info-box cr-info-box--muted' });
	const advancedIcon = advancedNote.createSpan({ cls: 'cr-info-box-icon' });
	setIcon(advancedIcon, 'settings');
	advancedNote.createSpan({
		text: 'For staging isolation and folder filtering options, see Settings → Canvas Roots → Advanced.'
	});

	container.appendChild(card);
}

/**
 * Render the Canvas Layout card
 */
function renderCanvasLayoutCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement
): void {
	const card = createCard({
		title: 'Canvas layout',
		icon: 'layout',
		subtitle: 'Node dimensions and spacing for tree generation'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Info text
	content.createEl('p', {
		cls: 'crc-text-muted crc-mb-2',
		text: 'Changes apply to new tree generations. To update existing canvases, right-click the canvas file and select "Re-layout family tree".'
	});

	// Helper to create a slider setting with reset button
	const createSliderSetting = (
		name: string,
		desc: string,
		min: number,
		max: number,
		step: number,
		defaultValue: number,
		getValue: () => number,
		setValue: (v: number) => void
	) => {
		let sliderComponent: SliderComponent;

		new Setting(content)
			.setName(name)
			.setDesc(desc)
			.addSlider(slider => {
				sliderComponent = slider;
				slider
					.setLimits(min, max, step)
					.setValue(getValue())
					.setDynamicTooltip()
					.onChange(async (value) => {
						setValue(value);
						await plugin.saveSettings();
					});
			})
			.addExtraButton(button => button
				.setIcon('rotate-ccw')
				.setTooltip(`Reset to default (${defaultValue})`)
				.onClick(async () => {
					setValue(defaultValue);
					await plugin.saveSettings();
					sliderComponent.setValue(defaultValue);
				}));
	};

	// Horizontal Spacing
	createSliderSetting(
		'Horizontal spacing',
		'Space between nodes horizontally',
		100, 1000, 50, 400,
		() => plugin.settings.horizontalSpacing,
		(v) => { plugin.settings.horizontalSpacing = v; }
	);

	// Vertical Spacing
	createSliderSetting(
		'Vertical spacing',
		'Space between generations vertically',
		100, 1000, 50, 250,
		() => plugin.settings.verticalSpacing,
		(v) => { plugin.settings.verticalSpacing = v; }
	);

	// Node Width
	createSliderSetting(
		'Node width',
		'Width of person nodes',
		100, 500, 25, 200,
		() => plugin.settings.defaultNodeWidth,
		(v) => { plugin.settings.defaultNodeWidth = v; }
	);

	// Node Height
	createSliderSetting(
		'Node height',
		'Height of person nodes',
		50, 300, 25, 100,
		() => plugin.settings.defaultNodeHeight,
		(v) => { plugin.settings.defaultNodeHeight = v; }
	);

	container.appendChild(card);
}

/**
 * Render the Canvas Styling card
 */
function renderCanvasStylingCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement
): void {
	const card = createCard({
		title: 'Canvas styling',
		icon: 'settings',
		subtitle: 'Arrow styles and node coloring options'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Node Color Scheme
	new Setting(content)
		.setName('Color scheme')
		.setDesc('How to color person nodes in family trees')
		.addDropdown(dropdown => dropdown
			.addOption('sex', 'Sex - green for males, purple for females')
			.addOption('generation', 'Generation - color by generation level')
			.addOption('collection', 'Collection - different color per collection')
			.addOption('monochrome', 'Monochrome - no coloring')
			.setValue(plugin.settings.nodeColorScheme)
			.onChange(async (value) => {
				plugin.settings.nodeColorScheme = value as ColorScheme;
				await plugin.saveSettings();
				new Notice('Node color scheme updated');
			}));

	// Section: Arrow Styling
	content.createEl('h4', {
		text: 'Arrow styling',
		cls: 'cr-aliases-section-title'
	});

	// Parent-Child Arrow Style
	new Setting(content)
		.setName('Parent → child arrows')
		.setDesc('Arrow style for parent-child relationships')
		.addDropdown(dropdown => dropdown
			.addOption('directed', 'Directed (→) - single arrow pointing to child')
			.addOption('bidirectional', 'Bidirectional (↔) - arrows on both ends')
			.addOption('undirected', 'Undirected (—) - no arrows')
			.setValue(plugin.settings.parentChildArrowStyle)
			.onChange(async (value) => {
				plugin.settings.parentChildArrowStyle = value as ArrowStyle;
				await plugin.saveSettings();
				new Notice('Parent-child arrow style updated');
			}));

	// Spouse Arrow Style
	new Setting(content)
		.setName('Spouse arrows')
		.setDesc('Arrow style for spouse relationships')
		.addDropdown(dropdown => dropdown
			.addOption('directed', 'Directed (→) - single arrow')
			.addOption('bidirectional', 'Bidirectional (↔) - arrows on both ends')
			.addOption('undirected', 'Undirected (—) - no arrows')
			.setValue(plugin.settings.spouseArrowStyle)
			.onChange(async (value) => {
				plugin.settings.spouseArrowStyle = value as ArrowStyle;
				await plugin.saveSettings();
				new Notice('Spouse arrow style updated');
			}));

	// Section: Spouse Edges
	content.createEl('h4', {
		text: 'Spouse edge display',
		cls: 'cr-aliases-section-title'
	});

	// Show Spouse Edges Toggle
	new Setting(content)
		.setName('Show spouse edges')
		.setDesc('Display edges between spouses with marriage metadata. When disabled (default), spouses are visually grouped by positioning only.')
		.addToggle(toggle => toggle
			.setValue(plugin.settings.showSpouseEdges)
			.onChange(async (value) => {
				plugin.settings.showSpouseEdges = value;
				await plugin.saveSettings();
				new Notice('Spouse edge display updated');
			}));

	// Spouse Edge Label Format
	new Setting(content)
		.setName('Spouse edge label format')
		.setDesc('How to display marriage information on spouse edges (only applies when "Show spouse edges" is enabled)')
		.addDropdown(dropdown => dropdown
			.addOption('none', 'None - no labels')
			.addOption('date-only', 'Date only - e.g., "m. 1985"')
			.addOption('date-location', 'Date and location - e.g., "m. 1985 | Boston, MA"')
			.addOption('full', 'Full details - e.g., "m. 1985 | Boston, MA | div. 1992"')
			.setValue(plugin.settings.spouseEdgeLabelFormat)
			.onChange(async (value) => {
				plugin.settings.spouseEdgeLabelFormat = value as SpouseEdgeLabelFormat;
				await plugin.saveSettings();
				new Notice('Spouse edge label format updated');
			}));

	container.appendChild(card);
}

/**
 * Render the Date Validation card
 */
function renderDateValidationCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const card = createCard({
		title: 'Date validation',
		icon: 'calendar',
		subtitle: 'Configure date format standards for batch validation'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Info text with link to Events tab
	const infoText = content.createEl('p', {
		cls: 'crc-text-muted'
	});
	infoText.appendText('These settings control how dates are validated in the "Validate date formats" batch operation. Fictional dates (with fc-calendar property) are automatically skipped. ');

	const link = infoText.createEl('a', {
		text: 'Fictional date systems are defined in the Events tab',
		href: '#',
		cls: 'crc-text-link'
	});
	link.addEventListener('click', (e) => {
		e.preventDefault();
		showTab('events');
	});
	infoText.appendText('.');

	// Date Format Standard
	new Setting(content)
		.setName('Date format standard')
		.setDesc('Preferred date format standard for validation')
		.addDropdown(dropdown => dropdown
			.addOption('iso8601', 'ISO 8601 - strict YYYY-MM-DD format')
			.addOption('gedcom', 'GEDCOM - DD MMM YYYY (e.g., 15 JAN 1920)')
			.addOption('flexible', 'Flexible - allows multiple formats')
			.setValue(plugin.settings.dateFormatStandard)
			.onChange(async (value) => {
				plugin.settings.dateFormatStandard = value as 'iso8601' | 'gedcom' | 'flexible';
				await plugin.saveSettings();
			}));

	// Allow Partial Dates
	new Setting(content)
		.setName('Allow partial dates')
		.setDesc('Accept dates with missing day or month (e.g., "1920-05" or "1920")')
		.addToggle(toggle => toggle
			.setValue(plugin.settings.allowPartialDates)
			.onChange(async (value) => {
				plugin.settings.allowPartialDates = value;
				await plugin.saveSettings();
			}));

	// Allow Circa Dates
	new Setting(content)
		.setName('Allow circa dates')
		.setDesc('Accept approximate dates with "c.", "ca.", "circa", or "~" prefix (e.g., "c. 1850")')
		.addToggle(toggle => toggle
			.setValue(plugin.settings.allowCircaDates)
			.onChange(async (value) => {
				plugin.settings.allowCircaDates = value;
				await plugin.saveSettings();
			}));

	// Allow Date Ranges
	new Setting(content)
		.setName('Allow date ranges')
		.setDesc('Accept date ranges with hyphen or "to" (e.g., "1850-1920" or "1850 to 1920")')
		.addToggle(toggle => toggle
			.setValue(plugin.settings.allowDateRanges)
			.onChange(async (value) => {
				plugin.settings.allowDateRanges = value;
				await plugin.saveSettings();
			}));

	// Require Leading Zeros
	new Setting(content)
		.setName('Require leading zeros')
		.setDesc('Require zero-padded months and days (e.g., "1920-05-01" instead of "1920-5-1")')
		.addToggle(toggle => toggle
			.setValue(plugin.settings.requireLeadingZeros)
			.onChange(async (value) => {
				plugin.settings.requireLeadingZeros = value;
				await plugin.saveSettings();
			}));

	container.appendChild(card);
}

/**
 * Render the sex value normalization card
 */
function renderSexNormalizationCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement
): void {
	const card = createCard({
		title: 'Sex value normalization',
		icon: 'sliders',
		subtitle: 'Configure batch normalization behavior for sex values'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Info text
	content.createEl('p', {
		cls: 'crc-text-muted',
		text: 'Controls how the "Normalize sex values" batch operation in Data Quality behaves. Standard mode normalizes all values to GEDCOM M/F, while schema-aware mode respects schemas that define custom sex values.'
	});

	// Normalization Mode dropdown
	new Setting(content)
		.setName('Normalization mode')
		.setDesc('How sex values are normalized in batch operations')
		.addDropdown(dropdown => dropdown
			.addOption('standard', 'Standard - normalize to GEDCOM M/F')
			.addOption('schema-aware', 'Schema-aware - skip notes with custom schemas')
			.addOption('disabled', 'Disabled - never normalize sex values')
			.setValue(plugin.settings.sexNormalizationMode)
			.onChange(async (value) => {
				plugin.settings.sexNormalizationMode = value as SexNormalizationMode;
				await plugin.saveSettings();
			}));

	container.appendChild(card);
}
