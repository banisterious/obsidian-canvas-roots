/**
 * Dashboard Tab for Canvas Roots Control Center
 *
 * Provides quick-action tiles for common operations and vault overview.
 */

import { App, Menu, TFile } from 'obsidian';
import CanvasRootsPlugin from '../../main';
import { LucideIconName, setLucideIcon } from './lucide-icons';
import { VaultStatsService, FullVaultStats } from '../core/vault-stats';
import { getErrorMessage } from '../core/error-utils';
import { CreatePersonModal } from './create-person-modal';
import { CreatePlaceModal } from './create-place-modal';
import { CreateEventModal } from '../events/ui/create-event-modal';
import { CreateSourceModal } from '../sources/ui/create-source-modal';
import { CreateOrganizationModal } from '../organizations/ui/create-organization-modal';
import { ReportWizardModal } from '../reports/ui/report-wizard-modal';
import { MediaManagerModal } from '../core/ui/media-manager-modal';
import { ImportExportHubModal } from './import-export-hub-modal';
import { FamilyGraphService } from '../core/family-graph';
import { PlaceGraphService } from '../core/place-graph';
import { EventService } from '../events/services/event-service';
import type { RecentFileEntry } from '../settings';

/**
 * Dashboard tile configuration
 */
interface DashboardTile {
	id: string;
	label: string;
	icon: LucideIconName;
	action: () => void;
	description?: string;
}

/**
 * Options for rendering the dashboard tab
 */
interface DashboardTabOptions {
	container: HTMLElement;
	plugin: CanvasRootsPlugin;
	app: App;
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement;
	switchTab: (tabId: string) => void;
	closeModal: () => void;
}

/**
 * Render the Dashboard tab content
 */
export function renderDashboardTab(options: DashboardTabOptions): void {
	const { container, plugin, app, createCard, switchTab, closeModal } = options;

	// Show first-run notice if this is the first visit to the new Dashboard
	if (!plugin.settings.dashboardFirstVisitDone) {
		renderFirstRunNotice(container, plugin);
	}

	// Documentation links card
	renderDocumentationCard(container);

	// Quick Actions section
	renderQuickActionsSection(container, plugin, app, switchTab, closeModal);

	// Recent section (if there are recent files)
	renderRecentSection(container, plugin, app, closeModal);

	// Vault Health section (collapsible)
	void renderVaultHealthSection(container, plugin, app, createCard, closeModal);
}

/**
 * Render a first-run welcome notice for the new Dashboard
 */
function renderFirstRunNotice(container: HTMLElement, plugin: CanvasRootsPlugin): void {
	const notice = container.createDiv({ cls: 'crc-dashboard-first-run-notice' });

	const content = notice.createDiv({ cls: 'crc-dashboard-first-run-content' });
	const iconEl = content.createSpan({ cls: 'crc-dashboard-first-run-icon' });
	setLucideIcon(iconEl, 'sparkles', 18);

	const textEl = content.createDiv({ cls: 'crc-dashboard-first-run-text' });
	textEl.createEl('strong', { text: 'Welcome to the new Dashboard!' });
	textEl.createSpan({
		text: ' Quick actions, recent files, and vault health at a glance.'
	});

	const dismissBtn = notice.createEl('button', {
		cls: 'crc-dashboard-first-run-dismiss',
		attr: { 'aria-label': 'Dismiss notice' }
	});
	setLucideIcon(dismissBtn, 'x', 14);

	dismissBtn.addEventListener('click', () => {
		plugin.settings.dashboardFirstVisitDone = true;
		void plugin.saveSettings();
		notice.remove();
	});
}

const WIKI_BASE = 'https://github.com/banisterious/obsidian-canvas-roots/wiki';

/**
 * Render the documentation links card
 */
function renderDocumentationCard(container: HTMLElement): void {
	const card = container.createDiv({ cls: 'crc-dashboard-docs-card' });

	// Icon
	const iconEl = card.createSpan({ cls: 'crc-dashboard-docs-icon' });
	setLucideIcon(iconEl, 'book-open', 18);

	// Content
	const content = card.createDiv({ cls: 'crc-dashboard-docs-content' });
	content.createSpan({ text: 'New to Canvas Roots? Start with ', cls: 'crc-text-muted' });

	const essentialLink = content.createEl('a', {
		text: 'Essential Properties',
		href: `${WIKI_BASE}/Essential-Properties`,
		cls: 'crc-link'
	});
	essentialLink.setAttr('target', '_blank');

	content.createSpan({ text: ' or explore the ', cls: 'crc-text-muted' });

	const wikiLink = content.createEl('a', {
		text: 'full documentation',
		href: WIKI_BASE,
		cls: 'crc-link'
	});
	wikiLink.setAttr('target', '_blank');

	content.createSpan({ text: '.', cls: 'crc-text-muted' });
}

/**
 * Render the Quick Actions tile grid
 */
function renderQuickActionsSection(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	app: App,
	switchTab: (tabId: string) => void,
	closeModal: () => void
): void {
	// Section header
	const header = container.createDiv({ cls: 'crc-dashboard-section-header' });
	header.createSpan({ text: 'Quick Actions', cls: 'crc-dashboard-section-title' });

	// Tile grid
	const grid = container.createDiv({ cls: 'crc-dashboard-tile-grid' });

	// Helper to open create person modal
	const openCreatePerson = () => {
		closeModal();
		const familyGraph = new FamilyGraphService(app);

		new CreatePersonModal(app, {
			directory: plugin.settings.peopleFolder || '',
			familyGraph,
			propertyAliases: plugin.settings.propertyAliases,
			plugin,
			onCreated: (file) => {
				// Track the newly created person in recent files
				const recentService = plugin.getRecentFilesService();
				if (recentService) {
					void recentService.trackFile(file, 'person');
				}
			}
		}).open();
	};

	// Helper to open create event modal
	const openCreateEvent = () => {
		closeModal();
		const eventService = new EventService(app, plugin.settings);
		new CreateEventModal(app, eventService, plugin.settings, {
			plugin,
			onCreated: (file) => {
				// Track the newly created event in recent files
				const recentService = plugin.getRecentFilesService();
				if (recentService) {
					void recentService.trackFile(file, 'event');
				}
			}
		}).open();
	};

	// Helper to open create source modal
	const openCreateSource = () => {
		closeModal();
		new CreateSourceModal(app, plugin, {
			onSuccess: (file) => {
				// Track the newly created source in recent files
				if (file) {
					const recentService = plugin.getRecentFilesService();
					if (recentService) {
						void recentService.trackFile(file, 'source');
					}
				}
			}
		}).open();
	};

	// Helper to open create place modal
	const openCreatePlace = () => {
		closeModal();
		new CreatePlaceModal(app, {
			directory: plugin.settings.placesFolder || 'Canvas Roots/Places',
			settings: plugin.settings,
			plugin,
			onCreated: (file) => {
				// Track the newly created place in recent files
				const recentService = plugin.getRecentFilesService();
				if (recentService) {
					void recentService.trackFile(file, 'place');
				}
			}
		}).open();
	};

	// Helper to open create organization modal
	const openCreateOrganization = () => {
		closeModal();
		new CreateOrganizationModal(app, plugin, {
			onSuccess: () => {
				// Note: We can't track the file here since the modal doesn't pass it back
				// The file tracking could be added to the modal itself if needed
			}
		}).open();
	};

	// Define the 12 tiles
	const tiles: DashboardTile[] = [
		{
			id: 'create-person',
			label: 'Person',
			icon: 'user',
			description: 'Create a new person note',
			action: () => void openCreatePerson()
		},
		{
			id: 'create-event',
			label: 'Event',
			icon: 'calendar',
			description: 'Create a new event note',
			action: openCreateEvent
		},
		{
			id: 'create-source',
			label: 'Source',
			icon: 'file-text',
			description: 'Create a new source note',
			action: openCreateSource
		},
		{
			id: 'generate-report',
			label: 'Report',
			icon: 'bar-chart',
			description: 'Generate a genealogical report',
			action: () => {
				closeModal();
				new ReportWizardModal(plugin).open();
			}
		},
		{
			id: 'open-statistics',
			label: 'Statistics',
			icon: 'bar-chart-2',
			description: 'Open Statistics Dashboard view',
			action: () => {
				closeModal();
				void plugin.activateStatisticsView();
			}
		},
		{
			id: 'import-export',
			label: 'Import/Export',
			icon: 'arrow-up-down',
			description: 'Import or export genealogical data',
			action: () => {
				closeModal();
				new ImportExportHubModal(app, plugin).open();
			}
		},
		{
			id: 'create-place',
			label: 'Place',
			icon: 'map-pin',
			description: 'Create a new place note',
			action: openCreatePlace
		},
		{
			id: 'tree-output',
			label: 'Canvas Trees',
			icon: 'git-branch',
			description: 'Generate interactive tree canvases',
			action: () => {
				switchTab('tree-generation');
			}
		},
		{
			id: 'open-map',
			label: 'Map',
			icon: 'map',
			description: 'Open the interactive map view',
			action: () => {
				closeModal();
				void plugin.activateMapView();
			}
		},
		{
			id: 'media-manager',
			label: 'Media',
			icon: 'image',
			description: 'Manage media files linked to entities',
			action: () => {
				closeModal();
				new MediaManagerModal(app, plugin).open();
			}
		},
		{
			id: 'create-organization',
			label: 'Organization',
			icon: 'building',
			description: 'Create a new organization note',
			action: openCreateOrganization
		},
		{
			id: 'family-chart',
			label: 'Family Chart',
			icon: 'users',
			description: 'Open the interactive family chart',
			action: () => {
				closeModal();
				void plugin.activateFamilyChartView();
			}
		}
	];

	// Render each tile
	for (const tile of tiles) {
		renderTile(grid, tile);
	}
}

/**
 * Render a single dashboard tile
 */
function renderTile(container: HTMLElement, tile: DashboardTile): void {
	const tileEl = container.createDiv({ cls: 'crc-dashboard-tile' });
	tileEl.setAttribute('data-tile-id', tile.id);
	if (tile.description) {
		tileEl.setAttribute('aria-label', tile.description);
		tileEl.setAttribute('title', tile.description);
	}

	// Icon container
	const iconContainer = tileEl.createDiv({ cls: 'crc-dashboard-tile-icon' });
	setLucideIcon(iconContainer, tile.icon, 24);

	// Label
	tileEl.createDiv({ cls: 'crc-dashboard-tile-label', text: tile.label });

	// Click handler
	tileEl.addEventListener('click', () => {
		tile.action();
	});

	// Keyboard accessibility
	tileEl.setAttribute('tabindex', '0');
	tileEl.setAttribute('role', 'button');
	tileEl.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			tile.action();
		}
	});
}

/**
 * Get icon for entity type
 */
function getEntityIcon(type: RecentFileEntry['type']): LucideIconName {
	switch (type) {
		case 'person': return 'user';
		case 'event': return 'calendar';
		case 'source': return 'file-text';
		case 'place': return 'map-pin';
		case 'canvas': return 'git-branch';
		case 'map': return 'map';
		case 'organization': return 'building';
		default: return 'file';
	}
}

/**
 * Render the Recent section (only if there are recent files)
 */
function renderRecentSection(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	app: App,
	closeModal: () => void
): void {
	const recentService = plugin.getRecentFilesService();
	if (!recentService) return;

	const recentFiles = recentService.getValidRecentFiles();
	if (recentFiles.length === 0) return;

	// Section header
	const header = container.createDiv({ cls: 'crc-dashboard-section-header crc-dashboard-recent-header' });
	header.createSpan({ text: 'Recent', cls: 'crc-dashboard-section-title' });

	// Recent list
	const list = container.createDiv({ cls: 'crc-dashboard-recent-list' });

	for (const entry of recentFiles) {
		const item = list.createDiv({ cls: 'crc-dashboard-recent-item' });

		// Icon
		const iconEl = item.createSpan({ cls: 'crc-dashboard-recent-icon' });
		setLucideIcon(iconEl, getEntityIcon(entry.type), 16);

		// Name
		item.createSpan({ cls: 'crc-dashboard-recent-name', text: entry.name });

		// Type badge
		item.createSpan({ cls: 'crc-dashboard-recent-type', text: entry.type });

		// Click to open file
		item.addEventListener('click', () => {
			const file = app.vault.getAbstractFileByPath(entry.path);
			if (file instanceof TFile) {
				closeModal();
				void app.workspace.getLeaf().openFile(file);
			}
		});

		// Context menu for type-specific actions
		item.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			showRecentItemContextMenu(e, entry, plugin, app, closeModal);
		});

		// Keyboard accessibility
		item.setAttribute('tabindex', '0');
		item.setAttribute('role', 'button');
		item.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				const file = app.vault.getAbstractFileByPath(entry.path);
				if (file instanceof TFile) {
					closeModal();
					void app.workspace.getLeaf().openFile(file);
				}
			}
		});
	}
}

/**
 * Show context menu for a recent item with type-specific actions
 */
function showRecentItemContextMenu(
	event: MouseEvent,
	entry: RecentFileEntry,
	plugin: CanvasRootsPlugin,
	app: App,
	closeModal: () => void
): void {
	const menu = new Menu();

	// Always show "Open note" option
	menu.addItem((item) =>
		item
			.setTitle('Open note')
			.setIcon('file-text')
			.onClick(() => {
				const file = app.vault.getAbstractFileByPath(entry.path);
				if (file instanceof TFile) {
					closeModal();
					void app.workspace.getLeaf().openFile(file);
				}
			})
	);

	// Type-specific actions
	if (entry.type === 'place') {
		menu.addItem((item) =>
			item
				.setTitle('Open in Map View')
				.setIcon('map')
				.onClick(() => {
					closeModal();
					openPlaceInMapView(entry.path, plugin, app);
				})
		);
	}

	if (entry.type === 'person') {
		menu.addItem((item) =>
			item
				.setTitle('Open in Family Chart')
				.setIcon('git-branch')
				.onClick(() => {
					closeModal();
					openPersonInFamilyChart(entry.path, plugin, app);
				})
		);
	}

	menu.showAtMouseEvent(event);
}

/**
 * Open a place in Map View, zooming to its coordinates if available
 */
function openPlaceInMapView(
	placePath: string,
	plugin: CanvasRootsPlugin,
	app: App
): void {
	// Load place data to get coordinates
	const placeGraph = new PlaceGraphService(app);
	const folderFilter = plugin.getFolderFilter();
	if (folderFilter) {
		placeGraph.setFolderFilter(folderFilter);
	}
	placeGraph.setSettings(plugin.settings);

	const allPlaces = placeGraph.getAllPlaces();
	const place = allPlaces.find(p => p.filePath === placePath);

	if (place?.coordinates) {
		// Open map view centered on this place
		void plugin.activateMapView(undefined, false, undefined, {
			lat: place.coordinates.lat,
			lng: place.coordinates.long,
			zoom: 12
		});
	} else {
		// No coordinates, just open map view
		void plugin.activateMapView();
	}
}

/**
 * Open a person in Family Chart view
 */
function openPersonInFamilyChart(
	personPath: string,
	plugin: CanvasRootsPlugin,
	app: App
): void {
	const file = app.vault.getAbstractFileByPath(personPath);
	if (!(file instanceof TFile)) return;

	const cache = app.metadataCache.getFileCache(file);
	const crId = cache?.frontmatter?.cr_id;

	if (crId) {
		void plugin.activateFamilyChartView(crId);
	} else {
		// No cr_id, just open the chart without a specific root
		void plugin.activateFamilyChartView();
	}
}

/**
 * Render the Vault Health section (collapsible)
 */
function renderVaultHealthSection(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	app: App,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement,
	closeModal: () => void
): void {
	// Create collapsible details element
	const details = container.createEl('details', { cls: 'crc-dashboard-collapsible' });

	// Check if this is the first visit (expanded by default)
	const isFirstVisit = !plugin.settings.dashboardVaultHealthCollapsed;
	if (isFirstVisit) {
		details.setAttribute('open', '');
	}

	// Summary (header)
	const summary = details.createEl('summary', { cls: 'crc-dashboard-collapsible-header' });
	const chevron = summary.createSpan({ cls: 'crc-dashboard-chevron' });
	setLucideIcon(chevron, 'chevron-right', 14);
	summary.createSpan({ text: 'Vault Health', cls: 'crc-dashboard-collapsible-title' });

	// Content container
	const content = details.createDiv({ cls: 'crc-dashboard-collapsible-content' });

	// Remember collapse state
	details.addEventListener('toggle', () => {
		plugin.settings.dashboardVaultHealthCollapsed = !details.open;
		void plugin.saveSettings();
	});

	// Load and render stats
	renderVaultHealthContent(content, plugin, app, closeModal);
}

/**
 * Render the vault health metrics content
 */
function renderVaultHealthContent(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	app: App,
	closeModal: () => void
): void {
	// Show loading state
	const loadingEl = container.createDiv({ cls: 'crc-dashboard-loading' });
	loadingEl.createSpan({ text: 'Loading statistics...', cls: 'crc-text-muted' });

	// Collect statistics
	let stats: FullVaultStats;
	try {
		const statsService = new VaultStatsService(app);
		const folderFilter = plugin.getFolderFilter();
		if (folderFilter) {
			statsService.setFolderFilter(folderFilter);
		}
		statsService.setSettings(plugin.settings);
		stats = statsService.collectStats();
	} catch (error) {
		container.empty();
		container.createEl('p', {
			text: `Failed to load statistics: ${getErrorMessage(error)}`,
			cls: 'crc-text-error'
		});
		return;
	}

	// Clear loading state
	container.empty();

	// Metrics grid
	const metricsGrid = container.createDiv({ cls: 'crc-dashboard-metrics-grid' });

	// Entity counts
	const metrics = [
		{ label: 'People', value: stats.people.totalPeople },
		{ label: 'Events', value: stats.events.totalEvents },
		{ label: 'Sources', value: stats.sources.totalSources },
		{ label: 'Places', value: stats.places.totalPlaces },
		{ label: 'Canvases', value: stats.canvases.totalCanvases },
		{ label: 'Maps', value: stats.maps.totalMaps }
	];

	for (const metric of metrics) {
		const metricEl = metricsGrid.createDiv({ cls: 'crc-dashboard-metric' });
		metricEl.createDiv({ cls: 'crc-dashboard-metric-value', text: metric.value.toLocaleString() });
		metricEl.createDiv({ cls: 'crc-dashboard-metric-label', text: metric.label });
	}

	// Data completeness progress bar
	const completenessContainer = container.createDiv({ cls: 'crc-dashboard-completeness' });
	const completenessHeader = completenessContainer.createDiv({ cls: 'crc-dashboard-completeness-header' });
	completenessHeader.createSpan({ text: 'Data completeness', cls: 'crc-dashboard-completeness-label' });

	// Calculate completeness percentage
	const totalPeople = stats.people.totalPeople;
	const completenessScore = totalPeople > 0
		? Math.round(
			((stats.people.peopleWithBirthDate + stats.people.peopleWithFather + stats.people.peopleWithMother) /
				(totalPeople * 3)) * 100
		)
		: 0;

	completenessHeader.createSpan({
		text: `${completenessScore}%`,
		cls: 'crc-dashboard-completeness-value'
	});

	const progressBar = completenessContainer.createDiv({ cls: 'crc-dashboard-progress-bar' });
	const progressFill = progressBar.createDiv({ cls: 'crc-dashboard-progress-fill' });
	progressFill.style.width = `${completenessScore}%`;

	// Data issues row
	const issuesRow = container.createDiv({ cls: 'crc-dashboard-issues-row' });
	const issuesLabel = issuesRow.createDiv({ cls: 'crc-dashboard-issues-label' });
	const issuesIcon = issuesLabel.createSpan({ cls: 'crc-dashboard-issues-icon' });
	setLucideIcon(issuesIcon, 'alert-triangle', 16);
	issuesLabel.createSpan({ text: 'Data issues' });

	// Count orphaned people as issues
	const issueCount = stats.people.orphanedPeople;
	issuesLabel.createSpan({
		cls: 'crc-dashboard-issues-badge',
		text: issueCount.toString()
	});

	const viewDetailsLink = issuesRow.createEl('a', {
		text: 'View details',
		cls: 'crc-dashboard-view-details-link'
	});
	viewDetailsLink.addEventListener('click', (e) => {
		e.preventDefault();
		closeModal();
		void plugin.activateStatisticsView();
	});
}
