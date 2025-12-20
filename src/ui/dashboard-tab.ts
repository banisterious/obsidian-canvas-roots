/**
 * Dashboard Tab for Canvas Roots Control Center
 *
 * Provides quick-action tiles for common operations and vault overview.
 */

import { App, setIcon } from 'obsidian';
import CanvasRootsPlugin from '../../main';
import { LucideIconName, setLucideIcon } from './lucide-icons';
import { VaultStatsService, FullVaultStats } from '../core/vault-stats';
import { getErrorMessage } from '../core/error-utils';

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

	// Quick Actions section
	renderQuickActionsSection(container, plugin, app, switchTab, closeModal);

	// Vault Health section (collapsible)
	void renderVaultHealthSection(container, plugin, app, createCard, closeModal);
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

	// Define the 9 tiles
	const tiles: DashboardTile[] = [
		{
			id: 'create-person',
			label: 'Person',
			icon: 'user',
			description: 'Create a new person note',
			action: () => {
				closeModal();
				plugin.openCreatePersonModal();
			}
		},
		{
			id: 'create-event',
			label: 'Event',
			icon: 'calendar',
			description: 'Create a new event note',
			action: () => {
				closeModal();
				plugin.openCreateEventModal();
			}
		},
		{
			id: 'create-source',
			label: 'Source',
			icon: 'file-text',
			description: 'Create a new source note',
			action: () => {
				closeModal();
				plugin.openCreateSourceModal();
			}
		},
		{
			id: 'generate-report',
			label: 'Report',
			icon: 'bar-chart',
			description: 'Generate a genealogical report',
			action: () => {
				closeModal();
				plugin.openReportGenerator();
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
			id: 'import-data',
			label: 'Import',
			icon: 'upload',
			description: 'Import genealogical data',
			action: () => {
				switchTab('import-export');
			}
		},
		{
			id: 'create-place',
			label: 'Place',
			icon: 'map-pin',
			description: 'Create a new place note',
			action: () => {
				closeModal();
				plugin.openCreatePlaceModal();
			}
		},
		{
			id: 'tree-output',
			label: 'Tree Output',
			icon: 'git-branch',
			description: 'Generate a family tree',
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
 * Render the Vault Health section (collapsible)
 */
async function renderVaultHealthSection(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	app: App,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement,
	closeModal: () => void
): Promise<void> {
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
	await renderVaultHealthContent(content, plugin, app, closeModal);
}

/**
 * Render the vault health metrics content
 */
async function renderVaultHealthContent(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	app: App,
	closeModal: () => void
): Promise<void> {
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
		{ label: 'Organizations', value: stats.organizations?.totalOrganizations ?? 0 }
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
	const issuesBadge = issuesLabel.createSpan({
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
