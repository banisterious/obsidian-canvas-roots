/**
 * Sources Tab UI Component
 *
 * Renders the Sources tab in the Control Center, showing
 * sources list, statistics, and source types.
 */

import { setIcon, TFile, Menu, Setting } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { LucideIconName } from '../../ui/lucide-icons';
import { createLucideIcon } from '../../ui/lucide-icons';
import { SourceService } from '../services/source-service';
import { CreateSourceModal } from './create-source-modal';
import { renderMediaGallery } from './media-gallery';
import { renderSourceTypeManagerCard } from './source-type-manager-card';
import type { SourceNote } from '../types/source-types';
import { getSourceType, getAllSourceTypes } from '../types/source-types';
import { TemplateSnippetsModal } from '../../ui/template-snippets-modal';
import { ExtractEventsModal } from '../../events/ui/extract-events-modal';

/**
 * Filter options for sources list
 */
type SourceFilter = 'all' | 'has_media' | 'no_media' | 'confidence_high' | 'confidence_medium' | 'confidence_low' | string;

/**
 * Sort options for sources list
 */
type SourceSort = 'title_asc' | 'title_desc' | 'date_asc' | 'date_desc' | 'type' | 'confidence';

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

	// Create source button
	new Setting(content)
		.setName('Create source')
		.setDesc('Create a new source note to document evidence')
		.addButton(button => button
			.setButtonText('Create')
			.setCta()
			.onClick(() => {
				plugin.app.commands.executeCommandById('canvas-roots:create-source-note');
			}));

	// Create base button
	new Setting(content)
		.setName('Create base')
		.setDesc('Create an Obsidian Base to view sources in a table')
		.addButton(button => button
			.setButtonText('Create')
			.onClick(() => {
				plugin.app.commands.executeCommandById('canvas-roots:create-sources-base-template');
			}));

	// View templates button
	new Setting(content)
		.setName('Templater templates')
		.setDesc('Copy ready-to-use templates for Templater integration')
		.addButton(button => button
			.setButtonText('View templates')
			.onClick(() => {
				new TemplateSnippetsModal(plugin.app, 'source').open();
			}));

	const allSources = sourceService.getAllSources();

	if (allSources.length === 0) {
		const emptyState = content.createDiv({ cls: 'crc-empty-state' });
		setIcon(emptyState.createSpan({ cls: 'crc-empty-icon' }), 'archive');
		emptyState.createEl('p', { text: 'No sources found.' });
		emptyState.createEl('p', {
			cls: 'crc-text-muted',
			text: 'Create source notes with cr_type: source in frontmatter to document your evidence.'
		});
	} else {
		// State for filters, sorting, and pagination
		let currentFilter: SourceFilter = 'all';
		let currentSort: SourceSort = 'title_asc';
		let displayLimit = 25;

		// Filter and sort controls
		const controls = content.createDiv({ cls: 'crc-source-controls' });

		// Filter dropdown
		const filterContainer = controls.createDiv({ cls: 'crc-filter-container' });
		filterContainer.createEl('label', { text: 'Filter: ', cls: 'crc-text-small crc-text-muted' });
		const filterSelect = filterContainer.createEl('select', { cls: 'dropdown crc-filter-select' });

		// Build filter options
		filterSelect.createEl('option', { value: 'all', text: 'All sources' });

		// Add type-based filters dynamically
		const sourceTypes = getAllSourceTypes(
			plugin.settings.customSourceTypes,
			plugin.settings.showBuiltInSourceTypes
		);
		if (sourceTypes.length > 0) {
			const typeGroup = filterSelect.createEl('optgroup', { attr: { label: 'By type' } });
			for (const st of sourceTypes) {
				typeGroup.createEl('option', { value: `type_${st.id}`, text: st.name });
			}
		}

		// Confidence filters
		const confGroup = filterSelect.createEl('optgroup', { attr: { label: 'By confidence' } });
		confGroup.createEl('option', { value: 'confidence_high', text: 'High confidence' });
		confGroup.createEl('option', { value: 'confidence_medium', text: 'Medium confidence' });
		confGroup.createEl('option', { value: 'confidence_low', text: 'Low confidence' });

		// Media filters
		const mediaGroup = filterSelect.createEl('optgroup', { attr: { label: 'By media' } });
		mediaGroup.createEl('option', { value: 'has_media', text: 'Has media' });
		mediaGroup.createEl('option', { value: 'no_media', text: 'No media' });

		// Sort dropdown
		const sortContainer = controls.createDiv({ cls: 'crc-filter-container' });
		sortContainer.createEl('label', { text: 'Sort: ', cls: 'crc-text-small crc-text-muted' });
		const sortSelect = sortContainer.createEl('select', { cls: 'dropdown crc-filter-select' });
		sortSelect.createEl('option', { value: 'title_asc', text: 'Title A-Z' });
		sortSelect.createEl('option', { value: 'title_desc', text: 'Title Z-A' });
		sortSelect.createEl('option', { value: 'date_desc', text: 'Date (newest)' });
		sortSelect.createEl('option', { value: 'date_asc', text: 'Date (oldest)' });
		sortSelect.createEl('option', { value: 'type', text: 'Type' });
		sortSelect.createEl('option', { value: 'confidence', text: 'Confidence' });

		// Table container (for refreshing)
		const tableContainer = content.createDiv({ cls: 'crc-source-table-container' });

		// Filter function
		const filterSources = (sources: SourceNote[]): SourceNote[] => {
			return sources.filter(source => {
				switch (currentFilter) {
					case 'all':
						return true;
					case 'has_media':
						return source.media && source.media.length > 0;
					case 'no_media':
						return !source.media || source.media.length === 0;
					case 'confidence_high':
						return source.confidence === 'high';
					case 'confidence_medium':
						return source.confidence === 'medium';
					case 'confidence_low':
						return source.confidence === 'low';
					default:
						// Type-based filter (type_xxx)
						if (currentFilter.startsWith('type_')) {
							const typeId = currentFilter.replace('type_', '');
							return source.sourceType === typeId;
						}
						return true;
				}
			});
		};

		// Sort function
		const sortSources = (sources: SourceNote[]): SourceNote[] => {
			return [...sources].sort((a, b) => {
				switch (currentSort) {
					case 'title_asc':
						return a.title.localeCompare(b.title);
					case 'title_desc':
						return b.title.localeCompare(a.title);
					case 'date_asc':
						return (a.date || '').localeCompare(b.date || '');
					case 'date_desc':
						return (b.date || '').localeCompare(a.date || '');
					case 'type':
						return (a.sourceType || '').localeCompare(b.sourceType || '');
					case 'confidence': {
						const order = { high: 0, medium: 1, low: 2, unknown: 3 };
						return (order[a.confidence] ?? 3) - (order[b.confidence] ?? 3);
					}
					default:
						return 0;
				}
			});
		};

		// Render table function
		const renderTable = () => {
			tableContainer.empty();

			const filtered = filterSources(allSources);
			const sorted = sortSources(filtered);
			const displayed = sorted.slice(0, displayLimit);

			if (filtered.length === 0) {
				const noResults = tableContainer.createDiv({ cls: 'crc-empty-state' });
				noResults.createEl('p', { text: 'No sources match the current filter.' });
				return;
			}

			const table = tableContainer.createEl('table', { cls: 'cr-source-table' });

			// Header
			const thead = table.createEl('thead');
			const headerRow = thead.createEl('tr');
			headerRow.createEl('th', { text: 'Title' });
			headerRow.createEl('th', { text: 'Type' });
			headerRow.createEl('th', { text: 'Date' });
			headerRow.createEl('th', { text: 'Repository' });
			headerRow.createEl('th', { text: 'Confidence' });
			headerRow.createEl('th', { text: '', cls: 'cr-source-th-actions' });

			// Body
			const tbody = table.createEl('tbody');
			for (const source of displayed) {
				renderSourceRow(tbody, source, plugin, showTab);
			}

			// Show count and load more button
			if (filtered.length > displayLimit) {
				const loadMoreContainer = tableContainer.createDiv({ cls: 'crc-load-more-container' });
				loadMoreContainer.createSpan({
					text: `Showing ${displayed.length} of ${filtered.length} sources`,
					cls: 'crc-text-muted'
				});
				const loadMoreBtn = loadMoreContainer.createEl('button', { cls: 'mod-cta' });
				loadMoreBtn.textContent = 'Load more';
				loadMoreBtn.addEventListener('click', () => {
					displayLimit += 25;
					renderTable();
				});
			} else if (filtered.length > 0) {
				const countInfo = tableContainer.createDiv({ cls: 'crc-count-info' });
				countInfo.createSpan({
					text: `Showing all ${filtered.length} source${filtered.length !== 1 ? 's' : ''}`,
					cls: 'crc-text-muted'
				});
			}
		};

		// Event listeners
		filterSelect.addEventListener('change', () => {
			currentFilter = filterSelect.value as SourceFilter;
			displayLimit = 25; // Reset pagination on filter change
			renderTable();
		});

		sortSelect.addEventListener('change', () => {
			currentSort = sortSelect.value as SourceSort;
			renderTable();
		});

		// Initial render
		renderTable();
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

	// Actions cell with Extract Events and Open Note buttons
	const actionsCell = row.createEl('td', { cls: 'cr-source-cell-actions' });

	// Extract events button
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

	// Open note button
	const openBtn = actionsCell.createEl('button', {
		cls: 'crc-btn crc-btn--small crc-btn--ghost',
		attr: { title: 'Open source note' }
	});
	const fileIcon = createLucideIcon('file-text', 14);
	openBtn.appendChild(fileIcon);

	openBtn.addEventListener('click', (e) => {
		e.stopPropagation(); // Don't trigger row click
		const file = plugin.app.vault.getAbstractFileByPath(source.filePath);
		if (file instanceof TFile) {
			void plugin.app.workspace.getLeaf(false).openFile(file);
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

