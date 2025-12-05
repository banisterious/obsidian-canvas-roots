/**
 * Sources Tab UI Component
 *
 * Renders the Sources tab in the Control Center, showing
 * sources list, statistics, and source types.
 */

import { setIcon, ToggleComponent, TFile, Notice, Modal, App } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { LucideIconName } from '../../ui/lucide-icons';
import { SourceService } from '../services/source-service';
import { CreateSourceModal } from './create-source-modal';
import { CustomSourceTypeModal } from './custom-source-type-modal';
import { renderMediaGallery } from './media-gallery';
import type { SourceNote, SourceTypeDefinition } from '../types/source-types';
import {
	getSourceType,
	getSourceTypesByCategory,
	SOURCE_CATEGORY_NAMES
} from '../types/source-types';

/**
 * Render the Sources tab content
 */
export function renderSourcesTab(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const sourceService = new SourceService(plugin.app, plugin.settings);

	// Sources List card (with Create button toolbar)
	renderSourcesListCard(container, plugin, sourceService, createCard, showTab);

	// Media Gallery card
	renderMediaGallery(container, plugin, createCard, showTab);

	// Sources Overview/Statistics card
	renderSourcesOverviewCard(container, plugin, sourceService, createCard, showTab);

	// Source Types card
	renderSourceTypesCard(container, plugin, createCard, showTab);
}

/**
 * Render the Sources Overview card with statistics
 */
function renderSourcesOverviewCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	sourceService: SourceService,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const card = createCard({
		title: 'Source overview',
		icon: 'archive'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	const stats = sourceService.getSourceStats();

	// Summary stats grid
	const statsGrid = content.createDiv({ cls: 'cr-stats-grid' });

	const createStatItem = (label: string, value: string | number) => {
		const item = statsGrid.createDiv({ cls: 'cr-stat-item' });
		item.createDiv({ cls: 'cr-stat-value', text: String(value) });
		item.createDiv({ cls: 'cr-stat-label', text: label });
	};

	createStatItem('Total sources', stats.totalSources);
	createStatItem('With media', stats.withMedia);
	createStatItem('Without media', stats.withoutMedia);

	// Confidence breakdown
	if (stats.totalSources > 0) {
		const breakdown = content.createDiv({ cls: 'cr-stats-breakdown' });
		breakdown.createEl('h4', { text: 'By confidence', cls: 'cr-subsection-heading' });

		const confidenceList = breakdown.createDiv({ cls: 'cr-type-breakdown-list' });

		const confidenceColors: Record<string, string> = {
			high: '#22c55e',
			medium: '#f59e0b',
			low: '#ef4444',
			unknown: '#6b7280'
		};

		for (const [level, count] of Object.entries(stats.byConfidence)) {
			if (count === 0) continue;

			const row = confidenceList.createDiv({ cls: 'cr-type-breakdown-row' });
			const swatch = row.createDiv({ cls: 'cr-type-swatch' });
			swatch.style.backgroundColor = confidenceColors[level] || '#6b7280';
			row.createSpan({ text: level.charAt(0).toUpperCase() + level.slice(1) });
			row.createSpan({ text: String(count), cls: 'crc-text-muted' });
		}

		// By type breakdown
		if (Object.keys(stats.byType).length > 0) {
			breakdown.createEl('h4', { text: 'By type', cls: 'cr-subsection-heading' });
			const typeList = breakdown.createDiv({ cls: 'cr-type-breakdown-list' });

			for (const [typeId, count] of Object.entries(stats.byType)) {
				const typeDef = getSourceType(
					typeId,
					plugin.settings.customSourceTypes,
					plugin.settings.showBuiltInSourceTypes
				);
				if (!typeDef) continue;

				const row = typeList.createDiv({ cls: 'cr-type-breakdown-row' });
				const swatch = row.createDiv({ cls: 'cr-type-swatch' });
				swatch.style.backgroundColor = typeDef.color;
				row.createSpan({ text: typeDef.name });
				row.createSpan({ text: String(count), cls: 'crc-text-muted' });
			}
		}
	}

	container.appendChild(card);
}

/**
 * Render the Sources List card
 */
function renderSourcesListCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	sourceService: SourceService,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const card = createCard({
		title: 'Sources',
		icon: 'file-text'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Toolbar with Create button and Base template button
	const toolbar = content.createDiv({ cls: 'crc-card-toolbar' });

	const addBtn = toolbar.createEl('button', { cls: 'mod-cta' });
	setIcon(addBtn.createSpan({ cls: 'crc-button-icon' }), 'plus');
	addBtn.createSpan({ text: 'Create source' });
	addBtn.addEventListener('click', () => {
		plugin.app.commands.executeCommandById('canvas-roots:create-source-note');
	});

	const baseBtn = toolbar.createEl('button');
	setIcon(baseBtn.createSpan({ cls: 'crc-button-icon' }), 'table');
	baseBtn.createSpan({ text: 'Create base' });
	baseBtn.addEventListener('click', () => {
		plugin.app.commands.executeCommandById('canvas-roots:create-sources-base-template');
	});

	const sources = sourceService.getAllSources();

	if (sources.length === 0) {
		const emptyState = content.createDiv({ cls: 'crc-empty-state' });
		setIcon(emptyState.createSpan({ cls: 'crc-empty-icon' }), 'archive');
		emptyState.createEl('p', { text: 'No sources found.' });
		emptyState.createEl('p', {
			cls: 'crc-text-muted',
			text: 'Create source notes with type: source in frontmatter to document your evidence.'
		});
	} else {
		// Render as table
		const table = content.createEl('table', { cls: 'cr-source-table' });

		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Title' });
		headerRow.createEl('th', { text: 'Type' });
		headerRow.createEl('th', { text: 'Date' });
		headerRow.createEl('th', { text: 'Repository' });
		headerRow.createEl('th', { text: 'Confidence' });

		// Body
		const tbody = table.createEl('tbody');
		const sortedSources = sources.sort((a, b) => a.title.localeCompare(b.title));

		for (const source of sortedSources) {
			renderSourceRow(tbody, source, plugin, showTab);
		}
	}

	container.appendChild(card);
}

/**
 * Render a single source as a table row
 */
function renderSourceRow(
	tbody: HTMLTableSectionElement,
	source: SourceNote,
	plugin: CanvasRootsPlugin,
	showTab: (tabId: string) => void
): void {
	const typeDef = getSourceType(
		source.sourceType,
		plugin.settings.customSourceTypes,
		plugin.settings.showBuiltInSourceTypes
	);

	const row = tbody.createEl('tr', { cls: 'cr-source-row' });
	row.addEventListener('click', () => {
		// Get the file and open edit modal
		const file = plugin.app.vault.getAbstractFileByPath(source.filePath);
		if (file instanceof TFile) {
			new CreateSourceModal(plugin.app, plugin, {
				editFile: file,
				editSource: source,
				onSuccess: () => showTab('sources')
			}).open();
		}
	});

	// Title cell
	const titleCell = row.createEl('td', { cls: 'cr-source-cell-title' });
	titleCell.createSpan({ text: source.title });

	// Type cell with badge
	const typeCell = row.createEl('td', { cls: 'cr-source-cell-type' });
	if (typeDef) {
		const typeBadge = typeCell.createSpan({ cls: 'cr-source-type-badge' });
		typeBadge.style.backgroundColor = typeDef.color;
		typeBadge.style.color = getContrastColor(typeDef.color);
		typeBadge.textContent = typeDef.name;
	} else {
		typeCell.textContent = source.sourceType;
	}

	// Date cell
	const dateCell = row.createEl('td', { cls: 'cr-source-cell-date' });
	dateCell.textContent = source.date || '—';

	// Repository cell
	const repoCell = row.createEl('td', { cls: 'cr-source-cell-repository' });
	repoCell.textContent = source.repository || '—';

	// Confidence cell with colored indicator
	const confCell = row.createEl('td', { cls: 'cr-source-cell-confidence' });
	const confBadge = confCell.createSpan({ cls: `cr-confidence-badge cr-confidence-${source.confidence}` });
	confBadge.textContent = source.confidence;
}

/**
 * Get contrasting text color for a background
 */
function getContrastColor(hexColor: string): string {
	const hex = hexColor.replace('#', '');
	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Render the Source Types card
 */
function renderSourceTypesCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const card = createCard({
		title: 'Source types',
		icon: 'layers'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Toolbar with Create button and toggle
	const toolbar = content.createDiv({ cls: 'crc-card-toolbar' });

	// Create custom type button
	const createBtn = toolbar.createEl('button', { cls: 'mod-cta' });
	setIcon(createBtn.createSpan({ cls: 'crc-button-icon' }), 'plus');
	createBtn.createSpan({ text: 'Create type' });
	createBtn.addEventListener('click', () => {
		new CustomSourceTypeModal(plugin.app, plugin, {
			onSave: () => showTab('sources')
		}).open();
	});

	// Toggle for built-in types
	const toggleContainer = toolbar.createDiv({ cls: 'crc-toggle-inline' });
	const toggleLabel = toggleContainer.createEl('label', { text: 'Show built-in types' });
	const toggle = new ToggleComponent(toggleContainer);
	toggle.setValue(plugin.settings.showBuiltInSourceTypes);
	toggle.onChange(async (value) => {
		plugin.settings.showBuiltInSourceTypes = value;
		await plugin.saveSettings();
		showTab('sources');
	});
	toggleLabel.htmlFor = toggle.toggleEl.id;

	// Get types grouped by category
	const groupedTypes = getSourceTypesByCategory(
		plugin.settings.customSourceTypes,
		plugin.settings.showBuiltInSourceTypes
	);

	if (Object.keys(groupedTypes).length === 0) {
		content.createEl('p', {
			cls: 'crc-text-muted',
			text: 'No source types available. Toggle "Show built-in types" to see default types.'
		});
	} else {
		// Render types grouped by category
		for (const [categoryId, types] of Object.entries(groupedTypes)) {
			const categoryName = SOURCE_CATEGORY_NAMES[categoryId] || categoryId;

			const section = content.createDiv({ cls: 'cr-source-type-section' });
			section.createEl('h4', { text: categoryName, cls: 'cr-subsection-heading' });

			const typeList = section.createDiv({ cls: 'cr-source-type-list' });
			for (const typeDef of types) {
				renderSourceTypeItem(typeList, typeDef, plugin, showTab);
			}
		}
	}

	container.appendChild(card);
}

/**
 * Render a source type item
 */
function renderSourceTypeItem(
	container: HTMLElement,
	typeDef: SourceTypeDefinition,
	plugin: CanvasRootsPlugin,
	showTab: (tabId: string) => void
): void {
	const item = container.createDiv({ cls: 'cr-source-type-item' });

	// Color swatch
	const swatch = item.createDiv({ cls: 'cr-type-swatch' });
	swatch.style.backgroundColor = typeDef.color;

	// Icon
	const iconSpan = item.createSpan({ cls: 'cr-type-icon' });
	setIcon(iconSpan, typeDef.icon);

	// Name and description
	const info = item.createDiv({ cls: 'cr-source-type-info' });
	info.createSpan({ text: typeDef.name, cls: 'cr-source-type-name' });
	info.createSpan({ text: typeDef.description, cls: 'cr-source-type-desc crc-text-muted' });

	// Built-in badge or action buttons
	if (typeDef.isBuiltIn) {
		item.createSpan({ text: 'built-in', cls: 'crc-badge crc-badge--muted' });
	} else {
		// Custom type - show edit and delete buttons
		const actions = item.createDiv({ cls: 'cr-source-type-actions' });

		// Edit button
		const editBtn = actions.createEl('button', {
			cls: 'cr-source-type-action clickable-icon',
			attr: { 'aria-label': 'Edit' }
		});
		setIcon(editBtn, 'pencil');
		editBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			new CustomSourceTypeModal(plugin.app, plugin, {
				editType: typeDef,
				onSave: () => showTab('sources')
			}).open();
		});

		// Delete button
		const deleteBtn = actions.createEl('button', {
			cls: 'cr-source-type-action clickable-icon cr-source-type-action--delete',
			attr: { 'aria-label': 'Delete' }
		});
		setIcon(deleteBtn, 'trash-2');
		deleteBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			// Confirm deletion via modal
			new DeleteSourceTypeModal(plugin.app, typeDef.name, async () => {
				const index = plugin.settings.customSourceTypes.findIndex(t => t.id === typeDef.id);
				if (index !== -1) {
					plugin.settings.customSourceTypes.splice(index, 1);
					await plugin.saveSettings();
					new Notice('Source type deleted');
					showTab('sources');
				}
			}).open();
		});

		// Custom badge
		item.createSpan({ text: 'custom', cls: 'crc-badge crc-badge--accent' });
	}
}

/**
 * Simple confirmation modal for deleting source types
 */
class DeleteSourceTypeModal extends Modal {
	private typeName: string;
	private onConfirm: () => void | Promise<void>;

	constructor(app: App, typeName: string, onConfirm: () => void | Promise<void>) {
		super(app);
		this.typeName = typeName;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText('Delete source type');

		contentEl.createEl('p', {
			text: `Delete source type "${this.typeName}"? This cannot be undone.`
		});

		const buttonContainer = contentEl.createDiv({ cls: 'crc-confirmation-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn-secondary'
		});
		cancelBtn.addEventListener('click', () => this.close());

		const confirmBtn = buttonContainer.createEl('button', {
			text: 'Delete',
			cls: 'mod-warning'
		});
		confirmBtn.addEventListener('click', () => {
			this.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
