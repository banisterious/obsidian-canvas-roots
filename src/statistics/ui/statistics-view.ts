/**
 * Statistics Dashboard View
 *
 * A dedicated workspace view for exploring vault statistics in detail.
 * Provides expandable sections, auto-refresh, and drill-down capabilities.
 */

import { ItemView, WorkspaceLeaf, setIcon, TFile, Menu } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import { StatisticsService } from '../services/statistics-service';
import type {
	StatisticsData,
	StatisticsViewState,
	TopListItem,
	TopListType,
	PersonRef,
	QualityIssueType,
	LongevityAnalysis,
	FamilySizeAnalysis,
	MarriagePatternAnalysis,
	MigrationAnalysis,
	SourceCoverageAnalysis,
	TimelineDensityAnalysis
} from '../types/statistics-types';
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
	/** Tracks which drill-down rows are expanded (key: "type:name") */
	private expandedDrilldowns: Set<string> = new Set();
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

	// eslint-disable-next-line @typescript-eslint/require-await
	async onOpen(): Promise<void> {
		this.service = new StatisticsService(this.plugin.app, this.plugin.settings);
		this.stats = this.service.getAllStatistics();

		this.buildUI();
		this.registerEventHandlers();
	}

	// eslint-disable-next-line @typescript-eslint/require-await
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

		// Reports section (actions at top for discoverability)
		this.buildSection(sectionsContainer, SECTION_IDS.REPORTS, 'Generate reports', 'file-text', () => {
			return this.buildReportsContent();
		});

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
			return this.buildTopListContent(this.stats!.topSurnames, 'surname');
		});

		// Top Locations section
		this.buildSection(sectionsContainer, SECTION_IDS.TOP_LOCATIONS, 'Top locations', 'map-pin', () => {
			return this.buildTopListContent(this.stats!.topLocations, 'location');
		});

		// Top Occupations section
		this.buildSection(sectionsContainer, SECTION_IDS.TOP_OCCUPATIONS, 'Top occupations', 'briefcase', () => {
			return this.buildTopListContent(this.stats!.topOccupations, 'occupation');
		});

		// Top Sources section
		this.buildSection(sectionsContainer, SECTION_IDS.TOP_SOURCES, 'Top sources', 'archive', () => {
			return this.buildTopListContent(this.stats!.topSources, 'source');
		});

		// Events by Type section
		this.buildSection(sectionsContainer, SECTION_IDS.EVENTS_BY_TYPE, 'Events by type', 'calendar', () => {
			const items = Object.entries(this.stats!.eventsByType)
				.map(([name, count]) => ({ name, count }))
				.sort((a, b) => b.count - a.count);
			return this.buildTopListContent(items, 'generic');
		});

		// Sources by Type section
		this.buildSection(sectionsContainer, SECTION_IDS.SOURCES_BY_TYPE, 'Sources by type', 'file-type', () => {
			const items = Object.entries(this.stats!.sourcesByType)
				.map(([name, count]) => ({ name, count }))
				.sort((a, b) => b.count - a.count);
			return this.buildTopListContent(items, 'generic');
		});

		// Sources by Confidence section
		this.buildSection(sectionsContainer, SECTION_IDS.SOURCES_BY_CONFIDENCE, 'Sources by confidence', 'shield', () => {
			return this.buildConfidenceContent();
		});

		// Places by Category section
		this.buildSection(sectionsContainer, SECTION_IDS.PLACES_BY_CATEGORY, 'Places by category', 'map-pin', () => {
			const items = Object.entries(this.stats!.placesByCategory)
				.map(([name, count]) => ({ name, count }))
				.sort((a, b) => b.count - a.count);
			return this.buildTopListContent(items, 'generic');
		});

		// === Extended Statistics (Phase 3) ===

		// Longevity Analysis section
		this.buildSection(sectionsContainer, SECTION_IDS.LONGEVITY, 'Longevity analysis', 'heart-pulse', () => {
			return this.buildLongevityContent();
		});

		// Family Size Patterns section
		this.buildSection(sectionsContainer, SECTION_IDS.FAMILY_SIZE, 'Family size patterns', 'users', () => {
			return this.buildFamilySizeContent();
		});

		// Marriage Patterns section
		this.buildSection(sectionsContainer, SECTION_IDS.MARRIAGE_PATTERNS, 'Marriage patterns', 'heart', () => {
			return this.buildMarriagePatternsContent();
		});

		// Migration Flows section
		this.buildSection(sectionsContainer, SECTION_IDS.MIGRATION, 'Migration flows', 'plane', () => {
			return this.buildMigrationContent();
		});

		// Source Coverage by Generation section
		this.buildSection(sectionsContainer, SECTION_IDS.SOURCE_COVERAGE_GEN, 'Source coverage by generation', 'archive', () => {
			return this.buildSourceCoverageContent();
		});

		// Timeline Density section
		this.buildSection(sectionsContainer, SECTION_IDS.TIMELINE_DENSITY, 'Timeline density', 'bar-chart-2', () => {
			return this.buildTimelineDensityContent();
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

		// Parent type breakdown subsection (if data exists)
		if (completeness.parentTypeBreakdown) {
			const breakdown = completeness.parentTypeBreakdown;
			const hasStepOrAdoptive = breakdown.stepFather > 0 ||
				breakdown.stepMother > 0 ||
				breakdown.adoptiveFather > 0 ||
				breakdown.adoptiveMother > 0;

			if (hasStepOrAdoptive) {
				const breakdownSection = content.createDiv({ cls: 'cr-sv-parent-breakdown' });
				breakdownSection.createEl('h5', {
					text: 'Parent type breakdown',
					cls: 'cr-sv-subsection-title'
				});

				const grid = breakdownSection.createDiv({ cls: 'cr-sv-parent-grid' });

				const createCountRow = (label: string, count: number, colorClass?: string) => {
					const row = grid.createDiv({ cls: 'cr-sv-parent-count-row' });
					const labelEl = row.createSpan({ cls: 'cr-sv-parent-label' });
					if (colorClass) labelEl.addClass(colorClass);
					labelEl.setText(label);
					row.createSpan({ cls: 'cr-sv-parent-count', text: String(count) });
				};

				// Biological (always shown)
				createCountRow('Biological father', breakdown.biologicalFather);
				createCountRow('Biological mother', breakdown.biologicalMother);

				// Step-parents (only if any)
				if (breakdown.stepFather > 0 || breakdown.stepMother > 0) {
					createCountRow('Step-father', breakdown.stepFather, 'cr-sv-parent-step');
					createCountRow('Step-mother', breakdown.stepMother, 'cr-sv-parent-step');
				}

				// Adoptive parents (only if any)
				if (breakdown.adoptiveFather > 0 || breakdown.adoptiveMother > 0) {
					createCountRow('Adoptive father', breakdown.adoptiveFather, 'cr-sv-parent-adoptive');
					createCountRow('Adoptive mother', breakdown.adoptiveMother, 'cr-sv-parent-adoptive');
				}
			}
		}

		return content;
	}

	/**
	 * Build quality content with drill-down support
	 */
	private buildQualityContent(): HTMLElement {
		const content = document.createElement('div');
		content.addClass('cr-sv-quality');

		if (!this.stats) return content;

		const { quality } = this.stats;

		const hasIssues = quality.missingBirthDate > 0 ||
			quality.missingDeathDate > 0 ||
			quality.orphanedPeople > 0 ||
			quality.unsourcedEvents > 0 ||
			quality.placesWithoutCoordinates > 0 ||
			quality.incompleteParents > 0 ||
			quality.dateInconsistencies > 0;

		if (!hasIssues) {
			const success = content.createDiv({ cls: 'cr-sv-quality-success' });
			const iconEl = success.createSpan({ cls: 'cr-sv-quality-success-icon' });
			setIcon(iconEl, 'check-circle');
			success.createSpan({ text: 'No data quality issues detected' });
			return content;
		}

		const alertsList = content.createDiv({ cls: 'cr-sv-quality-alerts' });

		// Helper to create expandable quality alerts
		const createExpandableAlert = (
			icon: string,
			label: string,
			count: number,
			severity: 'error' | 'warning' | 'info',
			issueType: QualityIssueType
		) => {
			if (count === 0) return;

			const drilldownKey = `quality:${issueType}`;
			const isExpanded = this.expandedDrilldowns.has(drilldownKey);

			const alertWrapper = alertsList.createDiv({ cls: 'cr-sv-quality-alert-wrapper' });
			const alert = alertWrapper.createDiv({
				cls: `cr-sv-quality-alert cr-sv-quality-${severity} cr-sv-quality-clickable ${isExpanded ? 'cr-sv-quality-expanded' : ''}`
			});

			const chevron = alert.createSpan({ cls: 'cr-sv-quality-chevron' });
			setIcon(chevron, isExpanded ? 'chevron-down' : 'chevron-right');

			const iconEl = alert.createSpan({ cls: 'cr-sv-quality-alert-icon' });
			setIcon(iconEl, icon);
			alert.createSpan({ cls: 'cr-sv-quality-alert-label', text: label });
			alert.createSpan({ cls: 'cr-sv-quality-alert-count', text: formatNumber(count) });

			// Click to toggle drill-down
			alert.addEventListener('click', () => {
				this.toggleQualityDrilldown(drilldownKey, issueType, alertWrapper, chevron);
			});

			// If already expanded, show the drill-down content
			if (isExpanded) {
				this.addQualityDrilldownContent(alertWrapper, issueType);
			}
		};

		// High severity (errors)
		createExpandableAlert('alert-triangle', 'Date inconsistencies', quality.dateInconsistencies, 'error', 'dateInconsistencies');

		// Medium severity (warnings)
		createExpandableAlert('alert-circle', 'Missing birth dates', quality.missingBirthDate, 'warning', 'missingBirthDate');
		createExpandableAlert('calendar-x', 'Missing death dates', quality.missingDeathDate, 'warning', 'missingDeathDate');
		createExpandableAlert('link', 'Orphaned people', quality.orphanedPeople, 'warning', 'orphanedPeople');
		createExpandableAlert('users', 'Incomplete parents', quality.incompleteParents, 'warning', 'incompleteParents');

		// Low severity (info)
		createExpandableAlert('archive', 'Unsourced events', quality.unsourcedEvents, 'info', 'unsourcedEvents');
		createExpandableAlert('map-pin', 'Places without coordinates', quality.placesWithoutCoordinates, 'info', 'placesWithoutCoordinates');

		// Living people count (informational, not an issue)
		if (quality.livingPeople > 0) {
			const info = content.createDiv({ cls: 'cr-sv-quality-info crc-text-muted' });
			info.createSpan({ text: `${formatNumber(quality.livingPeople)} people marked as living` });
		}

		// Blended family insights (informational)
		if (quality.biologicallyOrphaned && quality.biologicallyOrphaned > 0) {
			const info = content.createDiv({ cls: 'cr-sv-quality-info cr-sv-quality-info--insight' });
			const iconEl = info.createSpan({ cls: 'cr-sv-quality-info-icon' });
			setIcon(iconEl, 'heart');
			info.createSpan({
				text: `${formatNumber(quality.biologicallyOrphaned)} people with non-biological parents only (adoption/step)`
			});
		}

		if (quality.blendedFamilyCount && quality.blendedFamilyCount > 0) {
			const info = content.createDiv({ cls: 'cr-sv-quality-info cr-sv-quality-info--insight' });
			const iconEl = info.createSpan({ cls: 'cr-sv-quality-info-icon' });
			setIcon(iconEl, 'users');
			info.createSpan({
				text: `${formatNumber(quality.blendedFamilyCount)} people in blended families (bio + step/adoptive parents)`
			});
		}

		return content;
	}

	/**
	 * Toggle drill-down for a quality issue
	 */
	private toggleQualityDrilldown(
		key: string,
		issueType: QualityIssueType,
		wrapper: HTMLElement,
		chevron: HTMLElement
	): void {
		const wasExpanded = this.expandedDrilldowns.has(key);

		if (wasExpanded) {
			// Collapse
			this.expandedDrilldowns.delete(key);
			wrapper.querySelector('.cr-sv-quality-alert')?.removeClass('cr-sv-quality-expanded');
			chevron.empty();
			setIcon(chevron, 'chevron-right');

			// Remove drill-down content
			wrapper.querySelector('.cr-sv-quality-drilldown')?.remove();
		} else {
			// Expand
			this.expandedDrilldowns.add(key);
			wrapper.querySelector('.cr-sv-quality-alert')?.addClass('cr-sv-quality-expanded');
			chevron.empty();
			setIcon(chevron, 'chevron-down');

			// Add drill-down content
			this.addQualityDrilldownContent(wrapper, issueType);
		}
	}

	/**
	 * Add drill-down content for a quality issue
	 */
	private addQualityDrilldownContent(wrapper: HTMLElement, issueType: QualityIssueType): void {
		if (!this.service) return;

		const drilldown = wrapper.createDiv({ cls: 'cr-sv-quality-drilldown' });

		// Get the affected items based on issue type
		let personRefs: PersonRef[] = [];
		let fileRefs: TFile[] = [];

		switch (issueType) {
			case 'missingBirthDate':
				personRefs = this.service.getPeopleWithMissingBirthDate();
				break;
			case 'missingDeathDate':
				personRefs = this.service.getPeopleWithMissingDeathDate();
				break;
			case 'orphanedPeople':
				personRefs = this.service.getOrphanedPeople();
				break;
			case 'incompleteParents':
				personRefs = this.service.getPeopleWithIncompleteParents();
				break;
			case 'dateInconsistencies':
				personRefs = this.service.getPeopleWithDateInconsistencies();
				break;
			case 'unsourcedEvents':
				fileRefs = this.service.getUnsourcedEvents();
				break;
			case 'placesWithoutCoordinates':
				fileRefs = this.service.getPlacesWithoutCoordinates();
				break;
		}

		// Render person refs
		if (personRefs.length > 0) {
			const list = drilldown.createDiv({ cls: 'cr-sv-drilldown-list' });
			const maxToShow = 50;
			const itemsToShow = personRefs.slice(0, maxToShow);

			for (const person of itemsToShow) {
				const personLink = list.createEl('a', {
					text: person.name,
					cls: 'cr-sv-drilldown-person internal-link',
					attr: { 'data-href': person.file.path }
				});
				personLink.addEventListener('click', (e) => {
					e.preventDefault();
					void this.app.workspace.getLeaf('tab').openFile(person.file);
				});
				personLink.addEventListener('contextmenu', (e) => {
					e.preventDefault();
					this.showPersonContextMenu(e, person.file);
				});
				personLink.addEventListener('mouseover', (e) => {
					this.triggerHoverPreview(e, person.file, personLink);
				});
			}

			if (personRefs.length > maxToShow) {
				list.createDiv({
					cls: 'cr-sv-drilldown-more crc-text-muted',
					text: `...and ${formatNumber(personRefs.length - maxToShow)} more`
				});
			}
		}

		// Render file refs (for events and places)
		if (fileRefs.length > 0) {
			const list = drilldown.createDiv({ cls: 'cr-sv-drilldown-list' });
			const maxToShow = 50;
			const itemsToShow = fileRefs.slice(0, maxToShow);

			for (const file of itemsToShow) {
				const fileLink = list.createEl('a', {
					text: file.basename,
					cls: 'cr-sv-drilldown-person internal-link',
					attr: { 'data-href': file.path }
				});
				fileLink.addEventListener('click', (e) => {
					e.preventDefault();
					void this.app.workspace.getLeaf('tab').openFile(file);
				});
				fileLink.addEventListener('contextmenu', (e) => {
					e.preventDefault();
					this.showPersonContextMenu(e, file);
				});
				fileLink.addEventListener('mouseover', (e) => {
					this.triggerHoverPreview(e, file, fileLink);
				});
			}

			if (fileRefs.length > maxToShow) {
				list.createDiv({
					cls: 'cr-sv-drilldown-more crc-text-muted',
					text: `...and ${formatNumber(fileRefs.length - maxToShow)} more`
				});
			}
		}

		// Empty state
		if (personRefs.length === 0 && fileRefs.length === 0) {
			drilldown.createDiv({
				cls: 'cr-sv-drilldown-empty crc-text-muted',
				text: 'No items found'
			});
		}
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
	 * Build source confidence distribution content
	 */
	private buildConfidenceContent(): HTMLElement {
		const content = document.createElement('div');
		content.addClass('cr-sv-confidence');

		if (!this.stats) return content;

		const { high, medium, low, unknown } = this.stats.sourcesByConfidence;
		const total = high + medium + low + unknown;

		if (total === 0) {
			content.createSpan({ cls: 'crc-text-muted', text: 'No sources available' });
			return content;
		}

		const grid = content.createDiv({ cls: 'cr-sv-confidence-grid' });

		const createConfidenceItem = (label: string, count: number, colorClass: string) => {
			const percent = Math.round((count / total) * 100);
			const item = grid.createDiv({ cls: `cr-sv-confidence-item ${colorClass}` });
			item.createDiv({ cls: 'cr-sv-confidence-count', text: formatNumber(count) });
			item.createDiv({ cls: 'cr-sv-confidence-label', text: label });
			item.createDiv({ cls: 'cr-sv-confidence-percent crc-text-muted', text: `${percent}%` });
		};

		createConfidenceItem('High', high, 'cr-sv-confidence-high');
		createConfidenceItem('Medium', medium, 'cr-sv-confidence-medium');
		createConfidenceItem('Low', low, 'cr-sv-confidence-low');
		if (unknown > 0) createConfidenceItem('Unknown', unknown, 'cr-sv-confidence-unknown');

		// Visual bar
		const bar = content.createDiv({ cls: 'cr-sv-confidence-bar' });
		if (high > 0) {
			const highBar = bar.createDiv({ cls: 'cr-sv-confidence-bar-segment cr-sv-confidence-high' });
			highBar.style.width = `${(high / total) * 100}%`;
		}
		if (medium > 0) {
			const mediumBar = bar.createDiv({ cls: 'cr-sv-confidence-bar-segment cr-sv-confidence-medium' });
			mediumBar.style.width = `${(medium / total) * 100}%`;
		}
		if (low > 0) {
			const lowBar = bar.createDiv({ cls: 'cr-sv-confidence-bar-segment cr-sv-confidence-low' });
			lowBar.style.width = `${(low / total) * 100}%`;
		}
		if (unknown > 0) {
			const unknownBar = bar.createDiv({ cls: 'cr-sv-confidence-bar-segment cr-sv-confidence-unknown' });
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
	 * Build top list content with optional drill-down support
	 */
	private buildTopListContent(items: TopListItem[], listType: TopListType): HTMLElement {
		const content = document.createElement('div');
		content.addClass('cr-sv-top-list');

		if (items.length === 0) {
			content.createSpan({ cls: 'crc-text-muted', text: 'No data available' });
			return content;
		}

		const table = content.createEl('table', { cls: 'cr-sv-top-list-table' });
		const tbody = table.createEl('tbody');

		for (const item of items) {
			const drilldownKey = `${listType}:${item.name}`;
			const isExpanded = this.expandedDrilldowns.has(drilldownKey);
			const canDrillDown = this.canDrillDown(listType, item);

			const row = tbody.createEl('tr', { cls: isExpanded ? 'cr-sv-top-list-expanded' : '' });
			const nameCell = row.createEl('td', { cls: 'cr-sv-top-list-name' });

			// Make clickable if we have a file reference (direct link) or can drill down
			if (item.file) {
				// Direct file link (e.g., for sources)
				const link = nameCell.createEl('a', {
					text: item.name,
					cls: 'cr-sv-top-list-link internal-link',
					attr: { 'data-href': item.file.path }
				});
				link.addEventListener('click', (e) => {
					e.preventDefault();
					if (item.file) {
						void this.app.workspace.getLeaf('tab').openFile(item.file);
					}
				});
				link.addEventListener('contextmenu', (e) => {
					e.preventDefault();
					if (item.file) {
						this.showPersonContextMenu(e, item.file);
					}
				});
				link.addEventListener('mouseover', (e) => {
					if (item.file) {
						this.triggerHoverPreview(e, item.file, link);
					}
				});
			} else if (canDrillDown) {
				// Expandable drill-down for aggregate items
				const expandWrapper = nameCell.createDiv({ cls: 'cr-sv-drilldown-header' });
				const chevron = expandWrapper.createSpan({ cls: 'cr-sv-drilldown-chevron' });
				setIcon(chevron, isExpanded ? 'chevron-down' : 'chevron-right');
				expandWrapper.createSpan({ text: item.name, cls: 'cr-sv-drilldown-name' });

				expandWrapper.addEventListener('click', () => {
					this.toggleDrilldown(drilldownKey, item, listType, row, tbody);
				});
			} else {
				nameCell.setText(item.name);
			}

			row.createEl('td', {
				cls: 'cr-sv-top-list-count crc-text-muted',
				text: formatNumber(item.count)
			});

			// If already expanded, add the drill-down content
			if (isExpanded && canDrillDown) {
				this.addDrilldownContent(tbody, item, listType);
			}
		}

		return content;
	}

	/**
	 * Check if drill-down is available for a given list type and item
	 */
	private canDrillDown(listType: TopListType, item: TopListItem): boolean {
		// Sources already have direct file links, no drill-down needed
		// Generic items (event types, source types, place categories) don't support drill-down yet
		return (listType === 'surname' || listType === 'location' || listType === 'occupation') && !item.file;
	}

	/**
	 * Toggle drill-down expansion for an item
	 */
	private toggleDrilldown(key: string, item: TopListItem, listType: TopListType, row: HTMLTableRowElement, tbody: HTMLTableSectionElement): void {
		const wasExpanded = this.expandedDrilldowns.has(key);

		if (wasExpanded) {
			// Collapse: remove drill-down rows and update state
			this.expandedDrilldowns.delete(key);
			row.removeClass('cr-sv-top-list-expanded');

			// Update chevron
			const chevron = row.querySelector('.cr-sv-drilldown-chevron');
			if (chevron) {
				chevron.empty();
				setIcon(chevron as HTMLElement, 'chevron-right');
			}

			// Remove drill-down content rows
			let sibling = row.nextElementSibling;
			while (sibling && sibling.hasClass('cr-sv-drilldown-row')) {
				const toRemove = sibling;
				sibling = sibling.nextElementSibling;
				toRemove.remove();
			}
		} else {
			// Expand: add drill-down rows
			this.expandedDrilldowns.add(key);
			row.addClass('cr-sv-top-list-expanded');

			// Update chevron
			const chevron = row.querySelector('.cr-sv-drilldown-chevron');
			if (chevron) {
				chevron.empty();
				setIcon(chevron as HTMLElement, 'chevron-down');
			}

			// Insert drill-down content after this row
			this.addDrilldownContent(tbody, item, listType, row);
		}
	}

	/**
	 * Add drill-down content rows to the table
	 */
	private addDrilldownContent(tbody: HTMLTableSectionElement, item: TopListItem, listType: TopListType, afterRow?: HTMLTableRowElement): void {
		if (!this.service) return;

		// Get the people for this item
		let people: PersonRef[] = [];
		switch (listType) {
			case 'surname':
				people = this.service.getPeopleBySurname(item.name);
				break;
			case 'location':
				people = this.service.getPeopleByLocation(item.name);
				break;
			case 'occupation':
				people = this.service.getPeopleByOccupation(item.name);
				break;
		}

		if (people.length === 0) return;

		// Create the drill-down row
		const drilldownRow = document.createElement('tr');
		drilldownRow.addClass('cr-sv-drilldown-row');
		const drilldownCell = drilldownRow.createEl('td', {
			attr: { colspan: '2' },
			cls: 'cr-sv-drilldown-cell'
		});

		const peopleList = drilldownCell.createDiv({ cls: 'cr-sv-drilldown-list' });
		for (const person of people) {
			const personLink = peopleList.createEl('a', {
				text: person.name,
				cls: 'cr-sv-drilldown-person internal-link',
				attr: { 'data-href': person.file.path }
			});
			personLink.addEventListener('click', (e) => {
				e.preventDefault();
				void this.app.workspace.getLeaf('tab').openFile(person.file);
			});
			personLink.addEventListener('contextmenu', (e) => {
				e.preventDefault();
				this.showPersonContextMenu(e, person.file);
			});
			personLink.addEventListener('mouseover', (e) => {
				this.triggerHoverPreview(e, person.file, personLink);
			});
		}

		// Insert the drill-down row
		if (afterRow && afterRow.nextSibling) {
			tbody.insertBefore(drilldownRow, afterRow.nextSibling);
		} else {
			tbody.appendChild(drilldownRow);
		}
	}

	// ==========================================================================
	// Extended Statistics Content Builders (Phase 3)
	// ==========================================================================

	/**
	 * Build longevity analysis content
	 */
	private buildLongevityContent(): HTMLElement {
		const content = document.createElement('div');
		content.addClass('cr-sv-longevity');

		if (!this.service) return content;

		const analysis: LongevityAnalysis = this.service.getLongevityAnalysis();

		if (analysis.overall.count === 0) {
			content.createSpan({
				cls: 'crc-text-muted',
				text: 'No data available (requires people with both birth and death dates)'
			});
			return content;
		}

		// Overall statistics grid
		const overallLabel = content.createDiv({ cls: 'cr-sv-section-label' });
		overallLabel.setText('Overall');

		const statsGrid = content.createDiv({ cls: 'cr-sv-stats-grid' });
		this.createStatCell(statsGrid, 'Average', `${analysis.overall.averageAge.toFixed(1)} yrs`);
		this.createStatCell(statsGrid, 'Median', `${analysis.overall.medianAge} yrs`);
		this.createStatCell(statsGrid, 'Min', `${analysis.overall.minAge} yrs`);
		this.createStatCell(statsGrid, 'Max', `${analysis.overall.maxAge} yrs`);

		const countInfo = content.createDiv({ cls: 'cr-sv-count-info crc-text-muted' });
		countInfo.setText(`Based on ${formatNumber(analysis.overall.count)} people with calculable lifespans`);

		// By birth decade
		if (analysis.byBirthDecade.length > 0) {
			const decadeLabel = content.createDiv({ cls: 'cr-sv-section-label cr-sv-section-label-spaced' });
			decadeLabel.setText('By birth decade');

			const maxAge = Math.max(...analysis.byBirthDecade.map(d => d.stats.averageAge));
			const barsContainer = content.createDiv({ cls: 'cr-sv-decade-bars' });

			for (const decade of analysis.byBirthDecade) {
				const row = barsContainer.createDiv({ cls: 'cr-sv-decade-row' });
				row.createSpan({ cls: 'cr-sv-decade-label', text: decade.label });

				const barContainer = row.createDiv({ cls: 'cr-sv-bar-container' });
				const bar = barContainer.createDiv({ cls: 'cr-sv-bar cr-sv-bar-primary' });
				bar.style.width = `${(decade.stats.averageAge / maxAge) * 100}%`;

				row.createSpan({
					cls: 'cr-sv-decade-value',
					text: `${decade.stats.averageAge.toFixed(1)} yrs (${decade.stats.count})`
				});
			}
		}

		// By birth location (top 5)
		if (analysis.byBirthLocation.length > 0) {
			const locationLabel = content.createDiv({ cls: 'cr-sv-section-label cr-sv-section-label-spaced' });
			locationLabel.setText('By birth location');

			const locTable = content.createEl('table', { cls: 'cr-sv-location-table' });
			const locBody = locTable.createEl('tbody');

			for (const loc of analysis.byBirthLocation.slice(0, 5)) {
				const row = locBody.createEl('tr');
				row.createEl('td', { text: loc.location, cls: 'cr-sv-loc-name' });
				row.createEl('td', {
					text: `${loc.stats.averageAge.toFixed(1)} yrs avg`,
					cls: 'cr-sv-loc-value'
				});
				row.createEl('td', {
					text: `(${loc.stats.count} people)`,
					cls: 'cr-sv-loc-count crc-text-muted'
				});
			}
		}

		return content;
	}

	/**
	 * Build family size patterns content
	 */
	private buildFamilySizeContent(): HTMLElement {
		const content = document.createElement('div');
		content.addClass('cr-sv-family-size');

		if (!this.service) return content;

		const analysis: FamilySizeAnalysis = this.service.getFamilySizeAnalysis();

		if (analysis.overall.count === 0) {
			content.createSpan({
				cls: 'crc-text-muted',
				text: 'No data available (requires people with children)'
			});
			return content;
		}

		// Overall summary
		const summary = content.createDiv({ cls: 'cr-sv-summary-text' });
		summary.createSpan({ text: `${analysis.overall.averageChildren.toFixed(1)}`, cls: 'cr-sv-highlight-value' });
		summary.createSpan({ text: ' children per family on average' });

		const countInfo = content.createDiv({ cls: 'cr-sv-count-info crc-text-muted' });
		countInfo.setText(`${formatNumber(analysis.overall.count)} families analyzed, ${formatNumber(analysis.overall.totalChildren)} total children`);

		// Distribution buckets
		if (analysis.sizeDistribution.length > 0) {
			const distLabel = content.createDiv({ cls: 'cr-sv-section-label cr-sv-section-label-spaced' });
			distLabel.setText('Distribution');

			const barsContainer = content.createDiv({ cls: 'cr-sv-distribution-bars' });

			for (const bucket of analysis.sizeDistribution) {
				const row = barsContainer.createDiv({ cls: 'cr-sv-dist-row' });
				row.createSpan({ cls: 'cr-sv-dist-label', text: bucket.label });

				const barContainer = row.createDiv({ cls: 'cr-sv-bar-container' });
				const bar = barContainer.createDiv({ cls: 'cr-sv-bar cr-sv-bar-secondary' });
				bar.style.width = `${bucket.percent}%`;

				row.createSpan({ cls: 'cr-sv-dist-value', text: `${bucket.percent}%` });
			}
		}

		// By birth decade
		if (analysis.byBirthDecade.length > 0) {
			const decadeLabel = content.createDiv({ cls: 'cr-sv-section-label cr-sv-section-label-spaced' });
			decadeLabel.setText('By birth decade of parent');

			const decadeTable = content.createEl('table', { cls: 'cr-sv-decade-table' });
			const decadeBody = decadeTable.createEl('tbody');

			for (const decade of analysis.byBirthDecade) {
				const row = decadeBody.createEl('tr');
				row.createEl('td', { text: decade.label, cls: 'cr-sv-decade-name' });
				row.createEl('td', { text: `${decade.stats.averageChildren.toFixed(1)} children` });
				row.createEl('td', {
					text: `(${decade.stats.count} families)`,
					cls: 'crc-text-muted'
				});
			}
		}

		return content;
	}

	/**
	 * Build marriage patterns content
	 */
	private buildMarriagePatternsContent(): HTMLElement {
		const content = document.createElement('div');
		content.addClass('cr-sv-marriage');

		if (!this.service) return content;

		const analysis: MarriagePatternAnalysis = this.service.getMarriagePatternAnalysis();

		if (analysis.overall.count === 0) {
			content.createSpan({
				cls: 'crc-text-muted',
				text: 'No data available (requires people with birth and marriage dates)'
			});
			return content;
		}

		// Age at first marriage comparison
		const ageLabel = content.createDiv({ cls: 'cr-sv-section-label' });
		ageLabel.setText('Age at first marriage');

		const comparisonGrid = content.createDiv({ cls: 'cr-sv-comparison-grid' });

		// Male column
		if (analysis.bySex.male.count > 0) {
			const maleCol = comparisonGrid.createDiv({ cls: 'cr-sv-comparison-col' });
			maleCol.createDiv({ cls: 'cr-sv-comparison-header', text: 'Men' });
			maleCol.createDiv({
				cls: 'cr-sv-comparison-value',
				text: `Avg: ${analysis.bySex.male.averageAge.toFixed(1)} yrs`
			});
			maleCol.createDiv({
				cls: 'cr-sv-comparison-subvalue crc-text-muted',
				text: `Med: ${analysis.bySex.male.medianAge} yrs`
			});
			maleCol.createDiv({
				cls: 'cr-sv-comparison-count crc-text-muted',
				text: `(${analysis.bySex.male.count} people)`
			});
		}

		// Female column
		if (analysis.bySex.female.count > 0) {
			const femaleCol = comparisonGrid.createDiv({ cls: 'cr-sv-comparison-col' });
			femaleCol.createDiv({ cls: 'cr-sv-comparison-header', text: 'Women' });
			femaleCol.createDiv({
				cls: 'cr-sv-comparison-value',
				text: `Avg: ${analysis.bySex.female.averageAge.toFixed(1)} yrs`
			});
			femaleCol.createDiv({
				cls: 'cr-sv-comparison-subvalue crc-text-muted',
				text: `Med: ${analysis.bySex.female.medianAge} yrs`
			});
			femaleCol.createDiv({
				cls: 'cr-sv-comparison-count crc-text-muted',
				text: `(${analysis.bySex.female.count} people)`
			});
		}

		// Remarriage statistics
		if (analysis.remarriage.totalMarried > 0) {
			const remarriageLabel = content.createDiv({ cls: 'cr-sv-section-label cr-sv-section-label-spaced' });
			remarriageLabel.setText('Remarriage');

			const remarriageInfo = content.createDiv({ cls: 'cr-sv-remarriage-info' });
			remarriageInfo.createSpan({
				cls: 'cr-sv-highlight-value',
				text: `${analysis.remarriage.remarriageRate.toFixed(1)}%`
			});
			remarriageInfo.createSpan({
				text: ` remarried (${analysis.remarriage.remarriedCount} of ${analysis.remarriage.totalMarried} married people)`
			});

			if (analysis.remarriage.remarriedCount > 0) {
				const avgMarriages = content.createDiv({ cls: 'cr-sv-count-info crc-text-muted' });
				avgMarriages.setText(
					`Average ${analysis.remarriage.averageMarriagesForRemarried.toFixed(1)} marriages for those who remarried`
				);
			}
		}

		return content;
	}

	/**
	 * Build migration flows content
	 */
	private buildMigrationContent(): HTMLElement {
		const content = document.createElement('div');
		content.addClass('cr-sv-migration');

		if (!this.service) return content;

		const analysis: MigrationAnalysis = this.service.getMigrationAnalysis();

		if (analysis.analyzedCount === 0) {
			content.createSpan({
				cls: 'crc-text-muted',
				text: 'No data available (requires people with both birth and death places)'
			});
			return content;
		}

		// Migration rate
		const rateInfo = content.createDiv({ cls: 'cr-sv-summary-text' });
		rateInfo.createSpan({ cls: 'cr-sv-highlight-value', text: `${analysis.migrationRate.toFixed(0)}%` });
		rateInfo.createSpan({
			text: ` migration rate (${analysis.movedCount} of ${analysis.analyzedCount} moved from birthplace)`
		});

		// Top migration routes
		if (analysis.topRoutes.length > 0) {
			const routesLabel = content.createDiv({ cls: 'cr-sv-section-label cr-sv-section-label-spaced' });
			routesLabel.setText('Top migration routes');

			const routesTable = content.createEl('table', { cls: 'cr-sv-routes-table' });
			const routesBody = routesTable.createEl('tbody');

			for (const route of analysis.topRoutes.slice(0, 10)) {
				const row = routesBody.createEl('tr');
				row.createEl('td', { text: route.from, cls: 'cr-sv-route-from' });
				const arrowCell = row.createEl('td', { cls: 'cr-sv-route-arrow' });
				setIcon(arrowCell, 'arrow-right');
				row.createEl('td', { text: route.to, cls: 'cr-sv-route-to' });
				row.createEl('td', {
					text: `${route.count} people`,
					cls: 'cr-sv-route-count crc-text-muted'
				});
			}
		}

		// Top destinations
		if (analysis.topDestinations.length > 0) {
			const destLabel = content.createDiv({ cls: 'cr-sv-section-label cr-sv-section-label-spaced' });
			destLabel.setText('Top destinations');

			const destList = content.createDiv({ cls: 'cr-sv-inline-list' });
			for (const dest of analysis.topDestinations.slice(0, 5)) {
				destList.createSpan({ cls: 'cr-sv-inline-item', text: `${dest.name}: ${dest.count}` });
			}
		}

		return content;
	}

	/**
	 * Build source coverage by generation content
	 */
	private buildSourceCoverageContent(): HTMLElement {
		const content = document.createElement('div');
		content.addClass('cr-sv-source-coverage');

		if (!this.service) return content;

		// Note: Root person is context-specific (per tree/report), not a global setting.
		// Without a root person, we show overall stats only.
		const analysis: SourceCoverageAnalysis = this.service.getSourceCoverageAnalysis();

		if (analysis.overall.peopleCount === 0) {
			content.createSpan({ cls: 'crc-text-muted', text: 'No data available' });
			return content;
		}

		// Overall coverage
		const overallInfo = content.createDiv({ cls: 'cr-sv-summary-text' });
		overallInfo.createSpan({
			cls: 'cr-sv-highlight-value',
			text: `${analysis.overall.coveragePercent.toFixed(0)}%`
		});
		overallInfo.createSpan({ text: ' overall source coverage' });

		const avgInfo = content.createDiv({ cls: 'cr-sv-count-info crc-text-muted' });
		avgInfo.setText(
			`${analysis.overall.averageSourcesPerPerson.toFixed(1)} sources per person on average (${analysis.overall.withSources} of ${analysis.overall.peopleCount} have sources)`
		);

		// By generation table
		if (analysis.byGeneration.length > 0) {
			const genLabel = content.createDiv({ cls: 'cr-sv-section-label cr-sv-section-label-spaced' });
			genLabel.setText('By generation');

			const genTable = content.createEl('table', { cls: 'cr-sv-generation-table' });
			const genHead = genTable.createEl('thead');
			const headerRow = genHead.createEl('tr');
			headerRow.createEl('th', { text: 'Generation' });
			headerRow.createEl('th', { text: 'People' });
			headerRow.createEl('th', { text: 'Coverage' });
			headerRow.createEl('th', { text: 'Avg sources' });

			const genBody = genTable.createEl('tbody');

			for (const gen of analysis.byGeneration) {
				const row = genBody.createEl('tr');
				row.createEl('td', { text: gen.label });
				row.createEl('td', { text: String(gen.stats.peopleCount) });

				const coverageCell = row.createEl('td');
				const coverageBar = coverageCell.createDiv({ cls: 'cr-sv-mini-progress' });
				const coverageFill = coverageBar.createDiv({
					cls: `cr-sv-mini-progress-fill ${getProgressColorClass(gen.stats.coveragePercent)}`
				});
				coverageFill.style.width = `${gen.stats.coveragePercent}%`;
				coverageCell.createSpan({
					cls: 'cr-sv-mini-progress-label',
					text: `${gen.stats.coveragePercent.toFixed(0)}%`
				});

				row.createEl('td', { text: gen.stats.averageSourcesPerPerson.toFixed(1) });
			}
		} else {
			const hint = content.createDiv({ cls: 'cr-sv-count-info crc-text-muted cr-sv-section-label-spaced' });
			hint.setText('Generation breakdown requires a root person (available in ancestry reports).');
		}

		return content;
	}

	/**
	 * Build timeline density content
	 */
	private buildTimelineDensityContent(): HTMLElement {
		const content = document.createElement('div');
		content.addClass('cr-sv-timeline');

		if (!this.service) return content;

		const analysis: TimelineDensityAnalysis = this.service.getTimelineDensityAnalysis();

		if (analysis.totalEvents === 0) {
			content.createSpan({ cls: 'crc-text-muted', text: 'No dated events available' });
			return content;
		}

		// Total events info
		const totalInfo = content.createDiv({ cls: 'cr-sv-count-info crc-text-muted' });
		totalInfo.setText(`${formatNumber(analysis.totalEvents)} dated events analyzed`);

		// Events by decade chart
		if (analysis.byDecade.length > 0) {
			const decadeLabel = content.createDiv({ cls: 'cr-sv-section-label cr-sv-section-label-spaced' });
			decadeLabel.setText('Events by decade');

			const maxCount = Math.max(...analysis.byDecade.map(d => d.count));
			const barsContainer = content.createDiv({ cls: 'cr-sv-timeline-bars' });

			for (const decade of analysis.byDecade) {
				const row = barsContainer.createDiv({ cls: 'cr-sv-decade-row' });
				row.createSpan({ cls: 'cr-sv-decade-label', text: decade.label });

				const barContainer = row.createDiv({ cls: 'cr-sv-bar-container' });
				const bar = barContainer.createDiv({ cls: 'cr-sv-bar cr-sv-bar-timeline' });
				bar.style.width = `${(decade.count / maxCount) * 100}%`;

				row.createSpan({ cls: 'cr-sv-decade-value', text: String(decade.count) });
			}
		}

		// Timeline gaps
		if (analysis.gaps.length > 0) {
			const gapsLabel = content.createDiv({ cls: 'cr-sv-section-label cr-sv-section-label-spaced' });
			const gapsIcon = gapsLabel.createSpan({ cls: 'cr-sv-warning-icon' });
			setIcon(gapsIcon, 'alert-triangle');
			gapsLabel.createSpan({ text: ' Gaps detected' });

			const gapsList = content.createDiv({ cls: 'cr-sv-gaps-list' });
			for (const gap of analysis.gaps) {
				const gapItem = gapsList.createDiv({ cls: 'cr-sv-gap-item' });
				gapItem.createSpan({
					cls: 'cr-sv-gap-range',
					text: `${gap.startYear}–${gap.endYear}`
				});
				gapItem.createSpan({
					cls: 'cr-sv-gap-info crc-text-muted',
					text: `: ${gap.eventCount} events (expected ~${gap.expectedCount})`
				});
			}
		}

		return content;
	}

	/**
	 * Helper: Create a stat cell in a grid
	 */
	private createStatCell(container: HTMLElement, label: string, value: string): void {
		const cell = container.createDiv({ cls: 'cr-sv-stat-cell' });
		cell.createDiv({ cls: 'cr-sv-stat-label', text: label });
		cell.createDiv({ cls: 'cr-sv-stat-value', text: value });
	}

	/**
	 * Show context menu for a person link
	 */
	private showPersonContextMenu(event: MouseEvent, file: TFile): void {
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle('Open in new tab')
				.setIcon('file-plus')
				.onClick(() => {
					void this.app.workspace.getLeaf('tab').openFile(file);
				});
		});

		menu.addItem((item) => {
			item.setTitle('Open to the right')
				.setIcon('separator-vertical')
				.onClick(() => {
					void this.app.workspace.getLeaf('split').openFile(file);
				});
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item.setTitle('Open in new window')
				.setIcon('picture-in-picture-2')
				.onClick(() => {
					void this.app.workspace.getLeaf('window').openFile(file);
				});
		});

		menu.showAtMouseEvent(event);
	}

	/**
	 * Trigger hover preview for a file link (Ctrl+hover)
	 */
	private triggerHoverPreview(event: MouseEvent, file: TFile, targetEl: HTMLElement): void {
		this.app.workspace.trigger('hover-link', {
			event,
			source: VIEW_TYPE_STATISTICS,
			hoverParent: this,
			targetEl,
			linktext: file.path,
			sourcePath: file.path
		});
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

	// eslint-disable-next-line @typescript-eslint/require-await
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
