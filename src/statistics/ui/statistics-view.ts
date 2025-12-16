/**
 * Statistics Dashboard View
 *
 * A dedicated workspace view for exploring vault statistics in detail.
 * Provides expandable sections, auto-refresh, and drill-down capabilities.
 */

import { ItemView, WorkspaceLeaf, setIcon, TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import { StatisticsService } from '../services/statistics-service';
import type { StatisticsData, StatisticsViewState, TopListItem } from '../types/statistics-types';
import { VIEW_TYPE_STATISTICS, SECTION_IDS } from '../constants/statistics-constants';
import { REPORT_METADATA } from '../../reports/types/report-types';
import type { ReportType } from '../../reports/types/report-types';
import { ReportGeneratorModal } from '../../reports/ui/report-generator-modal';

/**
 * Statistics Dashboard workspace view
 */
export class StatisticsView extends ItemView {
	plugin: CanvasRootsPlugin;
	private service: StatisticsService | null = null;
	private stats: StatisticsData | null = null;
	private expandedSections: Set<string> = new Set([
		SECTION_IDS.OVERVIEW,
		SECTION_IDS.COMPLETENESS,
		SECTION_IDS.QUALITY
	]);
	private refreshTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: CanvasRootsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_STATISTICS;
	}

	getDisplayText(): string {
		return 'Statistics dashboard';
	}

	getIcon(): string {
		return 'bar-chart-2';
	}

	async onOpen(): Promise<void> {
		this.service = new StatisticsService(this.plugin.app, this.plugin.settings);
		this.stats = this.service.getAllStatistics();

		this.buildUI();
		this.registerEventHandlers();
	}

	async onClose(): Promise<void> {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
		}
	}

	/**
	 * Build the dashboard UI
	 */
	private buildUI(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass('cr-statistics-view');

		if (!this.stats) {
			this.showEmptyState(container);
			return;
		}

		// Header
		this.buildHeader(container);

		// Main content area
		const mainContent = container.createDiv({ cls: 'cr-sv-content' });

		// Summary cards row
		this.buildSummaryCards(mainContent);

		// Expandable sections
		this.buildExpandableSections(mainContent);
	}

	/**
	 * Build the header with title and refresh button
	 */
	private buildHeader(container: HTMLElement): void {
		const header = container.createDiv({ cls: 'cr-sv-header' });

		const titleSection = header.createDiv({ cls: 'cr-sv-title-section' });
		titleSection.createEl('h1', { text: 'Statistics Dashboard', cls: 'cr-sv-title' });
		if (this.stats) {
			titleSection.createEl('span', {
				cls: 'cr-sv-updated crc-text-muted',
				text: `Last updated: ${this.stats.lastUpdated.toLocaleString()}`
			});
		}

		const actions = header.createDiv({ cls: 'cr-sv-actions' });

		// Refresh button
		const refreshBtn = actions.createEl('button', {
			cls: 'cr-sv-btn clickable-icon',
			attr: { 'aria-label': 'Refresh statistics' }
		});
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.addEventListener('click', () => this.refresh());

		// Expand all button
		const expandBtn = actions.createEl('button', {
			cls: 'cr-sv-btn clickable-icon',
			attr: { 'aria-label': 'Expand all sections' }
		});
		setIcon(expandBtn, 'chevron-down');
		expandBtn.addEventListener('click', () => this.expandAllSections());

		// Collapse all button
		const collapseBtn = actions.createEl('button', {
			cls: 'cr-sv-btn clickable-icon',
			attr: { 'aria-label': 'Collapse all sections' }
		});
		setIcon(collapseBtn, 'chevron-up');
		collapseBtn.addEventListener('click', () => this.collapseAllSections());
	}

	/**
	 * Build summary cards row
	 */
	private buildSummaryCards(container: HTMLElement): void {
		if (!this.stats) return;

		const cardsRow = container.createDiv({ cls: 'cr-sv-summary-cards' });

		const createSummaryCard = (
			title: string,
			value: string | number,
			icon: string,
			subtitle?: string,
			colorClass?: string
		) => {
			const card = cardsRow.createDiv({ cls: `cr-sv-summary-card ${colorClass ?? ''}` });
			const iconEl = card.createDiv({ cls: 'cr-sv-card-icon' });
			setIcon(iconEl, icon);
			card.createDiv({ cls: 'cr-sv-card-value', text: String(value) });
			card.createDiv({ cls: 'cr-sv-card-title', text: title });
			if (subtitle) {
				card.createDiv({ cls: 'cr-sv-card-subtitle crc-text-muted', text: subtitle });
			}
		};

		const { entityCounts, completeness, quality } = this.stats;

		createSummaryCard('People', formatNumber(entityCounts.people), 'users');
		createSummaryCard('Events', formatNumber(entityCounts.events), 'calendar');
		createSummaryCard('Sources', formatNumber(entityCounts.sources), 'archive');
		createSummaryCard('Places', formatNumber(entityCounts.places), 'map-pin');

		// Completeness summary
		const avgCompleteness = Math.round(
			(completeness.withBirthDate + completeness.withDeathDate + completeness.withSources) / 3
		);
		createSummaryCard(
			'Completeness',
			`${avgCompleteness}%`,
			'check-circle',
			'Average across key fields',
			avgCompleteness >= 80 ? 'cr-sv-card-good' : avgCompleteness >= 50 ? 'cr-sv-card-moderate' : 'cr-sv-card-low'
		);

		// Issues count
		const totalIssues = quality.missingBirthDate + quality.orphanedPeople + quality.unsourcedEvents;
		createSummaryCard(
			'Issues',
			formatNumber(totalIssues),
			'alert-triangle',
			'Items needing attention',
			totalIssues === 0 ? 'cr-sv-card-good' : 'cr-sv-card-warning'
		);
	}

	/**
	 * Build expandable sections
	 */
	private buildExpandableSections(container: HTMLElement): void {
		if (!this.stats) return;

		const sectionsContainer = container.createDiv({ cls: 'cr-sv-sections' });

		// Entity Overview section
		this.buildSection(sectionsContainer, SECTION_IDS.OVERVIEW, 'Entity overview', 'layers', () => {
			return this.buildEntityOverviewContent();
		});

		// Data Completeness section
		this.buildSection(sectionsContainer, SECTION_IDS.COMPLETENESS, 'Data completeness', 'check-circle', () => {
			return this.buildCompletenessContent();
		});

		// Data Quality section
		this.buildSection(sectionsContainer, SECTION_IDS.QUALITY, 'Data quality', 'shield-check', () => {
			return this.buildQualityContent();
		});

		// Gender Distribution section
		this.buildSection(sectionsContainer, SECTION_IDS.GENDER_DISTRIBUTION, 'Sex distribution', 'users', () => {
			return this.buildGenderContent();
		});

		// Top Surnames section
		this.buildSection(sectionsContainer, SECTION_IDS.TOP_SURNAMES, 'Top surnames', 'users', () => {
			return this.buildTopListContent(this.stats!.topSurnames);
		});

		// Top Locations section
		this.buildSection(sectionsContainer, SECTION_IDS.TOP_LOCATIONS, 'Top locations', 'map-pin', () => {
			return this.buildTopListContent(this.stats!.topLocations);
		});

		// Top Occupations section
		this.buildSection(sectionsContainer, SECTION_IDS.TOP_OCCUPATIONS, 'Top occupations', 'briefcase', () => {
			return this.buildTopListContent(this.stats!.topOccupations);
		});

		// Events by Type section
		this.buildSection(sectionsContainer, SECTION_IDS.EVENTS_BY_TYPE, 'Events by type', 'calendar', () => {
			const items = Object.entries(this.stats!.eventsByType)
				.map(([name, count]) => ({ name, count }))
				.sort((a, b) => b.count - a.count);
			return this.buildTopListContent(items);
		});

		// Reports section
		this.buildSection(sectionsContainer, SECTION_IDS.REPORTS, 'Generate reports', 'file-text', () => {
			return this.buildReportsContent();
		});
	}

	/**
	 * Build a collapsible section
	 */
	private buildSection(
		container: HTMLElement,
		id: string,
		title: string,
		icon: string,
		contentBuilder: () => HTMLElement
	): void {
		const section = container.createDiv({ cls: 'cr-sv-section' });
		section.dataset.sectionId = id;

		const header = section.createDiv({ cls: 'cr-sv-section-header' });

		const headerLeft = header.createDiv({ cls: 'cr-sv-section-header-left' });
		const iconEl = headerLeft.createSpan({ cls: 'cr-sv-section-icon' });
		setIcon(iconEl, icon);
		headerLeft.createSpan({ text: title, cls: 'cr-sv-section-title' });

		const chevron = header.createSpan({ cls: 'cr-sv-section-chevron' });
		const isExpanded = this.expandedSections.has(id);
		setIcon(chevron, isExpanded ? 'chevron-up' : 'chevron-down');

		const contentWrapper = section.createDiv({ cls: 'cr-sv-section-content' });
		contentWrapper.style.display = isExpanded ? 'block' : 'none';

		if (isExpanded) {
			contentWrapper.appendChild(contentBuilder());
		}

		// Toggle on click
		header.addEventListener('click', () => {
			const nowExpanded = this.expandedSections.has(id);
			if (nowExpanded) {
				this.expandedSections.delete(id);
				contentWrapper.style.display = 'none';
				setIcon(chevron, 'chevron-down');
			} else {
				this.expandedSections.add(id);
				contentWrapper.style.display = 'block';
				setIcon(chevron, 'chevron-up');
				// Build content lazily
				if (contentWrapper.childElementCount === 0) {
					contentWrapper.appendChild(contentBuilder());
				}
			}
		});
	}

	/**
	 * Build entity overview content
	 */
	private buildEntityOverviewContent(): HTMLElement {
		const content = document.createElement('div');
		content.addClass('cr-sv-entity-overview');

		if (!this.stats) return content;

		const grid = content.createDiv({ cls: 'cr-sv-entity-grid' });

		const createEntityRow = (label: string, count: number, icon: string) => {
			const row = grid.createDiv({ cls: 'cr-sv-entity-row' });
			const iconEl = row.createSpan({ cls: 'cr-sv-entity-icon' });
			setIcon(iconEl, icon);
			row.createSpan({ cls: 'cr-sv-entity-label', text: label });
			row.createSpan({ cls: 'cr-sv-entity-count', text: formatNumber(count) });
		};

		createEntityRow('People', this.stats.entityCounts.people, 'users');
		createEntityRow('Events', this.stats.entityCounts.events, 'calendar');
		createEntityRow('Places', this.stats.entityCounts.places, 'map-pin');
		createEntityRow('Sources', this.stats.entityCounts.sources, 'archive');
		createEntityRow('Organizations', this.stats.entityCounts.organizations, 'building');
		createEntityRow('Canvases', this.stats.entityCounts.canvases, 'file');

		// Date range
		if (this.stats.dateRange.earliest || this.stats.dateRange.latest) {
			const dateRange = content.createDiv({ cls: 'cr-sv-date-range' });
			dateRange.createSpan({ text: 'Date range: ', cls: 'cr-sv-date-range-label' });
			dateRange.createSpan({
				text: `${this.stats.dateRange.earliest ?? '?'} — ${this.stats.dateRange.latest ?? '?'}`,
				cls: 'cr-sv-date-range-value'
			});
			if (this.stats.dateRange.spanYears) {
				dateRange.createSpan({
					text: ` (${this.stats.dateRange.spanYears} years)`,
					cls: 'crc-text-muted'
				});
			}
		}

		return content;
	}

	/**
	 * Build completeness content
	 */
	private buildCompletenessContent(): HTMLElement {
		const content = document.createElement('div');
		content.addClass('cr-sv-completeness');

		if (!this.stats) return content;

		const { completeness } = this.stats;

		const createProgressRow = (label: string, percent: number) => {
			const row = content.createDiv({ cls: 'cr-sv-progress-row' });

			const labelDiv = row.createDiv({ cls: 'cr-sv-progress-label' });
			labelDiv.createSpan({ text: label });
			labelDiv.createSpan({ cls: 'cr-sv-progress-percent', text: `${percent}%` });

			const progressContainer = row.createDiv({ cls: 'cr-sv-progress-container' });
			const progressBar = progressContainer.createDiv({
				cls: `cr-sv-progress-bar ${getProgressColorClass(percent)}`
			});
			progressBar.style.width = `${percent}%`;
		};

		createProgressRow('With birth date', completeness.withBirthDate);
		createProgressRow('With death date', completeness.withDeathDate);
		createProgressRow('With sources', completeness.withSources);
		createProgressRow('With father', completeness.withFather);
		createProgressRow('With mother', completeness.withMother);
		createProgressRow('With spouse', completeness.withSpouse);

		return content;
	}

	/**
	 * Build quality content
	 */
	private buildQualityContent(): HTMLElement {
		const content = document.createElement('div');
		content.addClass('cr-sv-quality');

		if (!this.stats) return content;

		const { quality } = this.stats;

		const hasIssues = quality.missingBirthDate > 0 ||
			quality.orphanedPeople > 0 ||
			quality.unsourcedEvents > 0 ||
			quality.placesWithoutCoordinates > 0;

		if (!hasIssues) {
			const success = content.createDiv({ cls: 'cr-sv-quality-success' });
			const iconEl = success.createSpan({ cls: 'cr-sv-quality-success-icon' });
			setIcon(iconEl, 'check-circle');
			success.createSpan({ text: 'No data quality issues detected' });
			return content;
		}

		const alertsList = content.createDiv({ cls: 'cr-sv-quality-alerts' });

		const createAlert = (icon: string, label: string, count: number, severity: 'warning' | 'info') => {
			if (count === 0) return;

			const alert = alertsList.createDiv({ cls: `cr-sv-quality-alert cr-sv-quality-${severity}` });
			const iconEl = alert.createSpan({ cls: 'cr-sv-quality-alert-icon' });
			setIcon(iconEl, icon);
			alert.createSpan({ cls: 'cr-sv-quality-alert-label', text: label });
			alert.createSpan({ cls: 'cr-sv-quality-alert-count', text: formatNumber(count) });
		};

		createAlert('alert-circle', 'Missing birth dates', quality.missingBirthDate, 'warning');
		createAlert('link', 'Orphaned people', quality.orphanedPeople, 'warning');
		createAlert('archive', 'Unsourced events', quality.unsourcedEvents, 'info');
		createAlert('map-pin', 'Places without coordinates', quality.placesWithoutCoordinates, 'info');

		if (quality.livingPeople > 0) {
			const info = content.createDiv({ cls: 'cr-sv-quality-info crc-text-muted' });
			info.createSpan({ text: `${formatNumber(quality.livingPeople)} people marked as living` });
		}

		return content;
	}

	/**
	 * Build gender distribution content
	 */
	private buildGenderContent(): HTMLElement {
		const content = document.createElement('div');
		content.addClass('cr-sv-gender');

		if (!this.stats) return content;

		const { male, female, other, unknown } = this.stats.genderDistribution;
		const total = male + female + other + unknown;

		if (total === 0) {
			content.createSpan({ cls: 'crc-text-muted', text: 'No data available' });
			return content;
		}

		const grid = content.createDiv({ cls: 'cr-sv-gender-grid' });

		const createGenderItem = (label: string, count: number, colorClass: string) => {
			const percent = Math.round((count / total) * 100);
			const item = grid.createDiv({ cls: `cr-sv-gender-item ${colorClass}` });
			item.createDiv({ cls: 'cr-sv-gender-count', text: formatNumber(count) });
			item.createDiv({ cls: 'cr-sv-gender-label', text: label });
			item.createDiv({ cls: 'cr-sv-gender-percent', text: `${percent}%` });
		};

		createGenderItem('Male', male, 'cr-sv-gender-male');
		createGenderItem('Female', female, 'cr-sv-gender-female');
		if (other > 0) createGenderItem('Other', other, 'cr-sv-gender-other');
		if (unknown > 0) createGenderItem('Unknown', unknown, 'cr-sv-gender-unknown');

		// Visual bar
		const bar = content.createDiv({ cls: 'cr-sv-gender-bar' });
		if (male > 0) {
			const maleBar = bar.createDiv({ cls: 'cr-sv-gender-bar-segment cr-sv-gender-male' });
			maleBar.style.width = `${(male / total) * 100}%`;
		}
		if (female > 0) {
			const femaleBar = bar.createDiv({ cls: 'cr-sv-gender-bar-segment cr-sv-gender-female' });
			femaleBar.style.width = `${(female / total) * 100}%`;
		}
		if (other > 0) {
			const otherBar = bar.createDiv({ cls: 'cr-sv-gender-bar-segment cr-sv-gender-other' });
			otherBar.style.width = `${(other / total) * 100}%`;
		}
		if (unknown > 0) {
			const unknownBar = bar.createDiv({ cls: 'cr-sv-gender-bar-segment cr-sv-gender-unknown' });
			unknownBar.style.width = `${(unknown / total) * 100}%`;
		}

		return content;
	}

	/**
	 * Build reports section content
	 */
	private buildReportsContent(): HTMLElement {
		const content = document.createElement('div');
		content.addClass('cr-sv-reports');

		const description = content.createDiv({ cls: 'cr-sv-reports-desc crc-text-muted' });
		description.setText('Generate formatted reports from your genealogy data.');

		const cardsGrid = content.createDiv({ cls: 'cr-sv-reports-grid' });

		// Create a card for each report type
		for (const [type, metadata] of Object.entries(REPORT_METADATA)) {
			const card = cardsGrid.createDiv({ cls: 'cr-sv-report-card' });

			const cardHeader = card.createDiv({ cls: 'cr-sv-report-card-header' });
			const iconEl = cardHeader.createSpan({ cls: 'cr-sv-report-card-icon' });
			setIcon(iconEl, metadata.icon);
			cardHeader.createSpan({ cls: 'cr-sv-report-card-title', text: metadata.name });

			card.createDiv({ cls: 'cr-sv-report-card-desc crc-text-muted', text: metadata.description });

			const cardActions = card.createDiv({ cls: 'cr-sv-report-card-actions' });
			const generateBtn = cardActions.createEl('button', {
				cls: 'mod-cta',
				text: 'Generate'
			});

			generateBtn.addEventListener('click', () => {
				const modal = new ReportGeneratorModal(this.app, this.plugin, {
					reportType: type as ReportType
				});
				modal.open();
			});
		}

		return content;
	}

	/**
	 * Build top list content
	 */
	private buildTopListContent(items: TopListItem[]): HTMLElement {
		const content = document.createElement('div');
		content.addClass('cr-sv-top-list');

		if (items.length === 0) {
			content.createSpan({ cls: 'crc-text-muted', text: 'No data available' });
			return content;
		}

		const table = content.createEl('table', { cls: 'cr-sv-top-list-table' });
		const tbody = table.createEl('tbody');

		for (const item of items) {
			const row = tbody.createEl('tr');
			const nameCell = row.createEl('td', { cls: 'cr-sv-top-list-name' });

			// Make clickable if we have a file reference
			if (item.file) {
				const link = nameCell.createEl('a', { text: item.name, cls: 'cr-sv-top-list-link' });
				link.addEventListener('click', (e) => {
					e.preventDefault();
					if (item.file) {
						void this.app.workspace.getLeaf('tab').openFile(item.file);
					}
				});
			} else {
				nameCell.setText(item.name);
			}

			row.createEl('td', {
				cls: 'cr-sv-top-list-count crc-text-muted',
				text: formatNumber(item.count)
			});
		}

		return content;
	}

	/**
	 * Refresh statistics
	 */
	private refresh(): void {
		if (this.service) {
			this.service.invalidateCache();
			this.stats = this.service.getAllStatistics();
			this.buildUI();
		}
	}

	/**
	 * Expand all sections
	 */
	private expandAllSections(): void {
		this.expandedSections = new Set(Object.values(SECTION_IDS));
		this.buildUI();
	}

	/**
	 * Collapse all sections
	 */
	private collapseAllSections(): void {
		this.expandedSections.clear();
		this.buildUI();
	}

	/**
	 * Show empty state
	 */
	private showEmptyState(container: HTMLElement): void {
		const emptyState = container.createDiv({ cls: 'cr-sv-empty-state' });
		const iconEl = emptyState.createDiv({ cls: 'cr-sv-empty-icon' });
		setIcon(iconEl, 'bar-chart-2');
		emptyState.createEl('h3', { text: 'No statistics available' });
		emptyState.createEl('p', {
			cls: 'crc-text-muted',
			text: 'Add person notes with cr_id property to see statistics.'
		});
	}

	/**
	 * Register event handlers for vault changes
	 */
	private registerEventHandlers(): void {
		// Listen for vault changes to schedule refresh
		this.registerEvent(
			this.app.vault.on('modify', () => this.scheduleRefresh())
		);
		this.registerEvent(
			this.app.vault.on('create', () => this.scheduleRefresh())
		);
		this.registerEvent(
			this.app.vault.on('delete', () => this.scheduleRefresh())
		);
	}

	/**
	 * Schedule a debounced refresh
	 */
	private scheduleRefresh(): void {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
		}
		this.refreshTimeout = setTimeout(() => {
			this.refreshTimeout = null;
			this.refresh();
		}, 2000); // 2 second debounce for view refresh
	}

	// State persistence
	getState(): StatisticsViewState {
		return {
			expandedSections: Array.from(this.expandedSections)
		};
	}

	async setState(state: Partial<StatisticsViewState>): Promise<void> {
		if (state.expandedSections) {
			this.expandedSections = new Set(state.expandedSections);
		}
		// Rebuild UI if already open
		if (this.service) {
			this.buildUI();
		}
	}
}

/**
 * Format number with thousands separator
 */
function formatNumber(num: number): string {
	return num.toLocaleString();
}

/**
 * Get progress bar color class
 */
function getProgressColorClass(percent: number): string {
	if (percent >= 80) return 'cr-sv-progress-good';
	if (percent >= 50) return 'cr-sv-progress-moderate';
	return 'cr-sv-progress-low';
}

export { VIEW_TYPE_STATISTICS };
