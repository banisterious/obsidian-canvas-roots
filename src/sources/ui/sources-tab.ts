/**
 * Sources Tab UI Component
 *
 * Renders the Sources tab in the Control Center, showing
 * sources list, statistics, and source types.
 */

import { setIcon, TFile, Menu } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { LucideIconName } from '../../ui/lucide-icons';
import { createLucideIcon } from '../../ui/lucide-icons';
import { SourceService } from '../services/source-service';
import { CreateSourceModal } from './create-source-modal';
import { renderMediaGallery } from './media-gallery';
import { renderSourceTypeManagerCard } from './source-type-manager-card';
import type { SourceNote } from '../types/source-types';
import { getSourceType } from '../types/source-types';
import { TemplateSnippetsModal } from '../../ui/template-snippets-modal';
import { ExtractEventsModal } from '../../events/ui/extract-events-modal';

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

	// Source Type Manager card (customize, hide, create source types)
	renderSourceTypeManagerCard(container, plugin, createCard, () => {
		// Refresh the tab content when types change
		container.empty();
		renderSourcesTab(container, plugin, createCard, showTab);
	});
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

	const templateBtn = toolbar.createEl('button');
	setIcon(templateBtn.createSpan({ cls: 'crc-button-icon' }), 'file-code');
	templateBtn.createSpan({ text: 'View templates' });
	templateBtn.addEventListener('click', () => {
		new TemplateSnippetsModal(plugin.app, 'source').open();
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
		headerRow.createEl('th', { text: '', cls: 'cr-source-th-actions' }); // Actions column

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

	// Context menu for additional actions
	row.addEventListener('contextmenu', (e) => {
		e.preventDefault();
		const menu = new Menu();

		menu.addItem((item) => {
			item
				.setTitle('Edit source')
				.setIcon('edit')
				.onClick(() => {
					const file = plugin.app.vault.getAbstractFileByPath(source.filePath);
					if (file instanceof TFile) {
						new CreateSourceModal(plugin.app, plugin, {
							editFile: file,
							editSource: source,
							onSuccess: () => showTab('sources')
						}).open();
					}
				});
		});

		menu.addItem((item) => {
			item
				.setTitle('Extract events')
				.setIcon('calendar-plus')
				.onClick(() => {
					const eventService = plugin.getEventService();
					const file = plugin.app.vault.getAbstractFileByPath(source.filePath);
					if (eventService && file instanceof TFile) {
						new ExtractEventsModal(
							plugin.app,
							eventService,
							plugin.settings,
							source,
							file,
							{
								onComplete: () => showTab('events')
							}
						).open();
					}
				});
		});

		menu.addItem((item) => {
			item
				.setTitle('Open note')
				.setIcon('file')
				.onClick(() => {
					const file = plugin.app.vault.getAbstractFileByPath(source.filePath);
					if (file instanceof TFile) {
						void plugin.app.workspace.getLeaf(false).openFile(file);
					}
				});
		});

		menu.showAtMouseEvent(e);
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

	// Actions cell with Extract Events button
	const actionsCell = row.createEl('td', { cls: 'cr-source-cell-actions' });
	const extractBtn = actionsCell.createEl('button', {
		cls: 'crc-btn crc-btn--small crc-btn--ghost',
		attr: { title: 'Extract events from this source' }
	});
	const calIcon = createLucideIcon('calendar-plus', 14);
	extractBtn.appendChild(calIcon);

	extractBtn.addEventListener('click', (e) => {
		e.stopPropagation(); // Don't trigger row click
		const eventService = plugin.getEventService();
		const file = plugin.app.vault.getAbstractFileByPath(source.filePath);
		if (eventService && file instanceof TFile) {
			new ExtractEventsModal(
				plugin.app,
				eventService,
				plugin.settings,
				source,
				file,
				{
					onComplete: () => showTab('events')
				}
			).open();
		}
	});
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

