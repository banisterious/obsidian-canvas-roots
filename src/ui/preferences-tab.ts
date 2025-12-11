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
import type { ArrowStyle, ColorScheme, SpouseEdgeLabelFormat } from '../settings';
import {
	PropertyAliasService,
	CANONICAL_PERSON_PROPERTIES,
	CANONICAL_EVENT_PROPERTIES,
	CANONICAL_PLACE_PROPERTIES,
	CANONICAL_PROPERTY_LABELS,
	type CanonicalPersonProperty,
	type CanonicalEventProperty,
	type CanonicalPlaceProperty,
	type PropertyMetadata,
	PERSON_PROPERTY_METADATA,
	EVENT_PROPERTY_METADATA,
	PLACE_PROPERTY_METADATA
} from '../core/property-alias-service';
import {
	ValueAliasService,
	VALUE_ALIAS_FIELD_LABELS,
	EVENT_TYPE_LABELS,
	SEX_LABELS,
	GENDER_IDENTITY_LABELS,
	PLACE_CATEGORY_LABELS,
	NOTE_TYPE_LABELS,
	CANONICAL_EVENT_TYPES,
	CANONICAL_SEX_VALUES,
	CANONICAL_GENDER_IDENTITY_VALUES,
	CANONICAL_PLACE_CATEGORIES,
	CANONICAL_NOTE_TYPES,
	type ValueAliasField,
	type CanonicalEventType,
	type CanonicalSex,
	type CanonicalGenderIdentity,
	type CanonicalPlaceCategory,
	type CanonicalNoteType
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

	// Canvas Layout card
	renderCanvasLayoutCard(container, plugin, createCard);

	// Canvas Styling card
	renderCanvasStylingCard(container, plugin, createCard);

	// Date Validation card
	renderDateValidationCard(container, plugin, createCard);
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

	summary.createSpan({
		text: `(${properties.length})`,
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
					text.inputEl.addEventListener('blur', async () => {
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

					// Hide clear button if no alias
					if (!currentAlias) {
						button.extraSettingsEl.style.opacity = '0.3';
					}
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
					text.inputEl.addEventListener('blur', async () => {
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

					// Hide clear button if no alias
					if (!userValue) {
						button.extraSettingsEl.style.opacity = '0.3';
					}
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

	// Filter function for search
	function filterProperties(query: string): void {
		const sections = sectionsContainer.querySelectorAll('.cr-property-section');
		const normalized = query.toLowerCase().trim();

		if (!normalized) {
			// Show all
			sections.forEach(section => {
				const settingItems = section.querySelectorAll('.setting-item');
				settingItems.forEach(item => {
					(item as HTMLElement).style.display = '';
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

				settingItem.style.display = matches ? '' : 'none';
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
		case 'sex':
			return SEX_LABELS[value as CanonicalSex] || value;
		case 'gender_identity':
			return GENDER_IDENTITY_LABELS[value as CanonicalGenderIdentity] || value;
		case 'placeCategory':
			return PLACE_CATEGORY_LABELS[value as CanonicalPlaceCategory] || value;
		case 'noteType':
			return NOTE_TYPE_LABELS[value as CanonicalNoteType] || value;
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
	card.id = 'cr-folder-locations-card';
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Folder explanation
	const folderInfo = content.createDiv({ cls: 'cr-info-box' });
	const folderIcon = folderInfo.createSpan({ cls: 'cr-info-box-icon' });
	setIcon(folderIcon, 'folder');
	folderInfo.createSpan({
		text: 'Set these to match your vault\'s folder structure. Imports and new notes will be created in these locations.'
	});

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

	// Events folder
	new Setting(content)
		.setName('Events folder')
		.setDesc('Default folder for event notes')
		.addText(text => text
			.setPlaceholder('Canvas Roots/Events')
			.setValue(plugin.settings.eventsFolder)
			.onChange(async (value) => {
				plugin.settings.eventsFolder = value;
				await plugin.saveSettings();
			}));

	// Timelines folder
	new Setting(content)
		.setName('Timelines folder')
		.setDesc('Default folder for timeline notes (grouping events)')
		.addText(text => text
			.setPlaceholder('Canvas Roots/Timelines')
			.setValue(plugin.settings.timelinesFolder)
			.onChange(async (value) => {
				plugin.settings.timelinesFolder = value;
				await plugin.saveSettings();
			}));

	// Bases folder
	new Setting(content)
		.setName('Bases folder')
		.setDesc('Default folder for Obsidian Bases files')
		.addText(text => text
			.setPlaceholder('Canvas Roots/Bases')
			.setValue(plugin.settings.basesFolder)
			.onChange(async (value) => {
				plugin.settings.basesFolder = value;
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

	// Horizontal Spacing
	new Setting(content)
		.setName('Horizontal spacing')
		.setDesc('Space between nodes horizontally (pixels)')
		.addText(text => text
			.setPlaceholder('400')
			.setValue(String(plugin.settings.horizontalSpacing))
			.onChange(async (value) => {
				const numValue = parseInt(value);
				if (!isNaN(numValue) && numValue >= 100 && numValue <= 1000) {
					plugin.settings.horizontalSpacing = numValue;
					await plugin.saveSettings();
				}
			}));

	// Vertical Spacing
	new Setting(content)
		.setName('Vertical spacing')
		.setDesc('Space between generations vertically (pixels)')
		.addText(text => text
			.setPlaceholder('250')
			.setValue(String(plugin.settings.verticalSpacing))
			.onChange(async (value) => {
				const numValue = parseInt(value);
				if (!isNaN(numValue) && numValue >= 100 && numValue <= 1000) {
					plugin.settings.verticalSpacing = numValue;
					await plugin.saveSettings();
				}
			}));

	// Node Width
	new Setting(content)
		.setName('Node width')
		.setDesc('Width of person nodes (pixels)')
		.addText(text => text
			.setPlaceholder('200')
			.setValue(String(plugin.settings.defaultNodeWidth))
			.onChange(async (value) => {
				const numValue = parseInt(value);
				if (!isNaN(numValue) && numValue >= 100 && numValue <= 500) {
					plugin.settings.defaultNodeWidth = numValue;
					await plugin.saveSettings();
				}
			}));

	// Node Height
	new Setting(content)
		.setName('Node height')
		.setDesc('Height of person nodes (pixels)')
		.addText(text => text
			.setPlaceholder('100')
			.setValue(String(plugin.settings.defaultNodeHeight))
			.onChange(async (value) => {
				const numValue = parseInt(value);
				if (!isNaN(numValue) && numValue >= 50 && numValue <= 300) {
					plugin.settings.defaultNodeHeight = numValue;
					await plugin.saveSettings();
				}
			}));

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
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement
): void {
	const card = createCard({
		title: 'Date validation',
		icon: 'calendar',
		subtitle: 'Configure date format standards for batch validation'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Info text
	content.createEl('p', {
		cls: 'crc-text-muted',
		text: 'These settings control how dates are validated in the "Validate date formats" batch operation. Fictional dates (with fc-calendar property) are automatically skipped.'
	});

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

				// Group properties by category with headers
				const personCategories: Record<string, CanonicalPersonProperty[]> = {
					'Identity': ['name', 'cr_id', 'type', 'sex', 'gender', 'nickname', 'maiden_name'],
					'Dates': ['born', 'died'],
					'Places': ['birth_place', 'death_place'],
					'Relationships': ['father', 'father_id', 'mother', 'mother_id', 'parents', 'parents_id', 'spouse', 'spouse_id', 'partners', 'partners_id', 'child', 'children_id'],
					'Other': ['occupation', 'universe', 'image', 'sourced_facts', 'relationships']
				};

				const eventCategories: Record<string, CanonicalEventProperty[]> = {
					'Core': ['cr_id', 'cr_type', 'title', 'event_type'],
					'Dates': ['date', 'date_end', 'date_precision', 'date_system'],
					'People': ['person', 'persons'],
					'Location': ['place'],
					'Metadata': ['sources', 'confidence', 'description', 'is_canonical', 'universe'],
					'Ordering': ['before', 'after', 'timeline'],
					'Groups': ['groups']
				};

				const placeCategories: Record<string, CanonicalPlaceProperty[]> = {
					'Core': ['cr_id', 'cr_type', 'name', 'place_type'],
					'Hierarchy': ['parent_place'],
					'Location': ['coordinates'],
					'Metadata': ['universe', 'collection']
				};

				// Add Person properties with section header
				dropdown.addOption('__category_person', '── Person Properties ──');
				for (const [_category, props] of Object.entries(personCategories)) {
					for (const prop of props) {
						const label = CANONICAL_PROPERTY_LABELS[prop];
						dropdown.addOption(prop, `${prop} (${label})`);
					}
				}

				// Add Event properties with section header
				dropdown.addOption('__category_event', '── Event Properties ──');
				for (const [_category, props] of Object.entries(eventCategories)) {
					for (const prop of props) {
						// Skip cr_id and universe as they're already in person properties
						if (prop === 'cr_id' || prop === 'universe') continue;
						const label = CANONICAL_PROPERTY_LABELS[prop];
						dropdown.addOption(prop, `${prop} (${label})`);
					}
				}

				// Add Place properties with section header
				dropdown.addOption('__category_place', '── Place Properties ──');
				for (const [_category, props] of Object.entries(placeCategories)) {
					for (const prop of props) {
						// Skip properties already added
						if (prop === 'cr_id' || prop === 'cr_type' || prop === 'name' || prop === 'universe' || prop === 'coordinates') continue;
						const label = CANONICAL_PROPERTY_LABELS[prop];
						dropdown.addOption(prop, `${prop} (${label})`);
					}
				}

				// Disable category header options
				const selectEl = dropdown.selectEl;
				for (const option of Array.from(selectEl.options)) {
					if (option.value.startsWith('__category_')) {
						option.disabled = true;
						option.style.fontWeight = 'bold';
						option.style.color = 'var(--text-muted)';
					}
				}

				dropdown.setValue(this.canonicalProperty);
				dropdown.onChange(value => {
					// Safety: ignore category headers if somehow selected
					if (value.startsWith('__category_')) {
						dropdown.setValue(this.canonicalProperty);
					} else {
						this.canonicalProperty = value;
					}
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
				dropdown.addOption('sex', 'Sex');
				dropdown.addOption('placeCategory', 'Place category');
				dropdown.addOption('noteType', 'Note type (cr_type)');

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
			case 'sex':
				return 'masc';
			case 'gender_identity':
				return 'genderqueer';
			case 'placeCategory':
				return 'canon';
			case 'noteType':
				return 'cohort';
		}
	}

	private getCanonicalValuesForField(): readonly string[] {
		switch (this.field) {
			case 'eventType':
				return CANONICAL_EVENT_TYPES;
			case 'sex':
				return CANONICAL_SEX_VALUES;
			case 'gender_identity':
				return CANONICAL_GENDER_IDENTITY_VALUES;
			case 'placeCategory':
				return CANONICAL_PLACE_CATEGORIES;
			case 'noteType':
				return CANONICAL_NOTE_TYPES;
		}
	}

	private getLabelForValue(value: string): string {
		switch (this.field) {
			case 'eventType':
				return EVENT_TYPE_LABELS[value as CanonicalEventType] || value;
			case 'sex':
				return SEX_LABELS[value as CanonicalSex] || value;
			case 'gender_identity':
				return GENDER_IDENTITY_LABELS[value as CanonicalGenderIdentity] || value;
			case 'placeCategory':
				return PLACE_CATEGORY_LABELS[value as CanonicalPlaceCategory] || value;
			case 'noteType':
				return NOTE_TYPE_LABELS[value as CanonicalNoteType] || value;
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
