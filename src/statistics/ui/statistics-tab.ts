/**
 * Statistics Tab UI Component
 *
 * Renders the Statistics tab in the Control Center, showing
 * vault statistics, data completeness, and quality metrics.
 */

import { setIcon, Setting } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { LucideIconName } from '../../ui/lucide-icons';
import { createLucideIcon } from '../../ui/lucide-icons';
import { StatisticsService } from '../services/statistics-service';
import type { StatisticsData, TopListItem } from '../types/statistics-types';
import { VIEW_TYPE_STATISTICS } from '../constants/statistics-constants';

/**
 * Render the Statistics tab content
 */
export function renderStatisticsTab(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const service = new StatisticsService(plugin.app, plugin.settings);
	const stats = service.getAllStatistics();

	// Overview card with entity counts
	renderOverviewCard(container, stats, createCard);

	// Data completeness card
	renderCompletenessCard(container, stats, createCard);

	// Quality alerts card
	renderQualityCard(container, stats, createCard, showTab);

	// Top lists card
	renderTopListsCard(container, stats, createCard);

	// Actions card
	renderActionsCard(container, plugin, createCard);
}

/**
 * Render the Overview card with entity counts
 */
function renderOverviewCard(
	container: HTMLElement,
	stats: StatisticsData,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement
): void {
	const card = createCard({
		title: 'Overview',
		icon: 'bar-chart-2',
		subtitle: `Last updated: ${formatTime(stats.lastUpdated)}`
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Entity counts grid
	const statsGrid = content.createDiv({ cls: 'cr-stats-grid' });

	const createStatItem = (label: string, value: number, icon: LucideIconName) => {
		const item = statsGrid.createDiv({ cls: 'cr-stat-item' });
		const iconEl = item.createDiv({ cls: 'cr-stat-icon' });
		setIcon(iconEl, icon);
		item.createDiv({ cls: 'cr-stat-value', text: formatNumber(value) });
		item.createDiv({ cls: 'cr-stat-label', text: label });
	};

	createStatItem('People', stats.entityCounts.people, 'users');
	createStatItem('Events', stats.entityCounts.events, 'calendar');
	createStatItem('Places', stats.entityCounts.places, 'map-pin');
	createStatItem('Sources', stats.entityCounts.sources, 'archive');
	createStatItem('Organizations', stats.entityCounts.organizations, 'building');
	createStatItem('Canvases', stats.entityCounts.canvases, 'file');

	// Date range
	if (stats.dateRange.earliest || stats.dateRange.latest) {
		const dateRangeDiv = content.createDiv({ cls: 'cr-date-range' });
		dateRangeDiv.createEl('span', { cls: 'cr-date-range-label', text: 'Date range: ' });
		const rangeText = `${stats.dateRange.earliest ?? '?'} — ${stats.dateRange.latest ?? '?'}`;
		dateRangeDiv.createEl('span', { cls: 'cr-date-range-value', text: rangeText });
		if (stats.dateRange.spanYears) {
			dateRangeDiv.createEl('span', {
				cls: 'crc-text-muted',
				text: ` (${stats.dateRange.spanYears} years)`
			});
		}
	}

	container.appendChild(card);
}

/**
 * Render the Data Completeness card
 */
function renderCompletenessCard(
	container: HTMLElement,
	stats: StatisticsData,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement
): void {
	const card = createCard({
		title: 'Data completeness',
		icon: 'check-circle'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	const createProgressRow = (label: string, percent: number, colorClass?: string) => {
		const row = content.createDiv({ cls: 'cr-progress-row' });
		const labelDiv = row.createDiv({ cls: 'cr-progress-label' });
		labelDiv.createSpan({ text: label });
		labelDiv.createSpan({ cls: 'cr-progress-percent', text: `${percent}%` });

		const progressContainer = row.createDiv({ cls: 'cr-progress-container' });
		const progressBar = progressContainer.createDiv({ cls: `cr-progress-bar ${colorClass ?? ''}` });
		progressBar.style.width = `${percent}%`;
	};

	createProgressRow('With birth date', stats.completeness.withBirthDate, getProgressColor(stats.completeness.withBirthDate));
	createProgressRow('With death date', stats.completeness.withDeathDate, getProgressColor(stats.completeness.withDeathDate));
	createProgressRow('With sources', stats.completeness.withSources, getProgressColor(stats.completeness.withSources));
	createProgressRow('With father', stats.completeness.withFather, getProgressColor(stats.completeness.withFather));
	createProgressRow('With mother', stats.completeness.withMother, getProgressColor(stats.completeness.withMother));
	createProgressRow('With spouse', stats.completeness.withSpouse, getProgressColor(stats.completeness.withSpouse));

	// Gender distribution
	const { male, female, other, unknown } = stats.genderDistribution;
	const total = male + female + other + unknown;
	if (total > 0) {
		const genderSection = content.createDiv({ cls: 'cr-gender-section' });
		genderSection.createEl('h4', { text: 'Sex distribution', cls: 'cr-subsection-heading' });

		const genderGrid = genderSection.createDiv({ cls: 'cr-gender-grid' });
		const createGenderItem = (label: string, count: number, colorClass: string) => {
			const item = genderGrid.createDiv({ cls: `cr-gender-item ${colorClass}` });
			item.createSpan({ cls: 'cr-gender-count', text: formatNumber(count) });
			item.createSpan({ cls: 'cr-gender-label', text: label });
			item.createSpan({ cls: 'cr-gender-percent crc-text-muted', text: `${Math.round((count / total) * 100)}%` });
		};

		createGenderItem('Male', male, 'cr-gender-male');
		createGenderItem('Female', female, 'cr-gender-female');
		if (other > 0) createGenderItem('Other', other, 'cr-gender-other');
		if (unknown > 0) createGenderItem('Unknown', unknown, 'cr-gender-unknown');
	}

	container.appendChild(card);
}

/**
 * Get progress bar color class based on percentage
 */
function getProgressColor(percent: number): string {
	if (percent >= 80) return 'cr-progress-good';
	if (percent >= 50) return 'cr-progress-moderate';
	return 'cr-progress-low';
}

/**
 * Render the Quality Alerts card
 */
function renderQualityCard(
	container: HTMLElement,
	stats: StatisticsData,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const card = createCard({
		title: 'Data quality',
		icon: 'shield-check'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	const { quality } = stats;

	// Only show alerts if there are issues
	const hasIssues = quality.missingBirthDate > 0 ||
		quality.orphanedPeople > 0 ||
		quality.unsourcedEvents > 0 ||
		quality.placesWithoutCoordinates > 0;

	if (!hasIssues) {
		const successMsg = content.createDiv({ cls: 'cr-quality-success' });
		setIcon(successMsg.createSpan({ cls: 'cr-quality-success-icon' }), 'check-circle');
		successMsg.createSpan({ text: 'No data quality issues detected' });
	} else {
		const alertsList = content.createDiv({ cls: 'cr-quality-alerts' });

		const createAlert = (icon: LucideIconName, text: string, count: number, severity: 'warning' | 'info') => {
			if (count === 0) return;
			const alert = alertsList.createDiv({ cls: `cr-quality-alert cr-quality-${severity}` });
			const iconEl = alert.createSpan({ cls: 'cr-quality-alert-icon' });
			setIcon(iconEl, icon);
			alert.createSpan({ cls: 'cr-quality-alert-text', text: `${text}: ` });
			alert.createSpan({ cls: 'cr-quality-alert-count', text: formatNumber(count) });
		};

		createAlert('alert-circle', 'Missing birth dates', quality.missingBirthDate, 'warning');
		createAlert('link', 'Orphaned people (no relationships)', quality.orphanedPeople, 'warning');
		createAlert('archive', 'Unsourced events', quality.unsourcedEvents, 'info');
		createAlert('map-pin', 'Places without coordinates', quality.placesWithoutCoordinates, 'info');

		// Living people is informational, not an alert
		if (quality.livingPeople > 0) {
			const infoDiv = content.createDiv({ cls: 'cr-quality-info-text' });
			infoDiv.createSpan({ cls: 'crc-text-muted', text: `${formatNumber(quality.livingPeople)} people marked as living (birth date but no death date)` });
		}
	}

	// Link to Data Quality tab
	const linkDiv = content.createDiv({ cls: 'cr-quality-link' });
	const link = linkDiv.createEl('a', { text: 'Open Data quality tab for detailed analysis' });
	link.addEventListener('click', (e) => {
		e.preventDefault();
		showTab('data-quality');
	});

	container.appendChild(card);
}

/**
 * Render the Top Lists card
 */
function renderTopListsCard(
	container: HTMLElement,
	stats: StatisticsData,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement
): void {
	const card = createCard({
		title: 'Top lists',
		icon: 'list-checks'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Collapsible sections
	const createTopListSection = (title: string, items: TopListItem[], icon: LucideIconName) => {
		if (items.length === 0) return;

		const section = content.createDiv({ cls: 'cr-top-list-section' });
		const header = section.createDiv({ cls: 'cr-top-list-header' });

		const headerLeft = header.createDiv({ cls: 'cr-top-list-header-left' });
		const iconEl = headerLeft.createSpan({ cls: 'cr-top-list-icon' });
		setIcon(iconEl, icon);
		headerLeft.createSpan({ text: title });

		const chevron = header.createSpan({ cls: 'cr-top-list-chevron' });
		setIcon(chevron, 'chevron-down');

		const listContent = section.createDiv({ cls: 'cr-top-list-content' });
		listContent.style.display = 'none';

		for (const item of items) {
			const row = listContent.createDiv({ cls: 'cr-top-list-row' });
			row.createSpan({ cls: 'cr-top-list-name', text: item.name });
			row.createSpan({ cls: 'cr-top-list-count crc-text-muted', text: formatNumber(item.count) });
		}

		// Toggle on click
		header.addEventListener('click', () => {
			const isExpanded = listContent.style.display !== 'none';
			listContent.style.display = isExpanded ? 'none' : 'block';
			setIcon(chevron, isExpanded ? 'chevron-down' : 'chevron-up');
			section.classList.toggle('cr-top-list-expanded', !isExpanded);
		});
	};

	createTopListSection('Top surnames', stats.topSurnames, 'users');
	createTopListSection('Top locations', stats.topLocations, 'map-pin');
	createTopListSection('Top occupations', stats.topOccupations, 'briefcase');
	createTopListSection('Most cited sources', stats.topSources, 'archive');

	// Event types breakdown
	const eventTypes = Object.entries(stats.eventsByType);
	if (eventTypes.length > 0) {
		createTopListSection(
			'Events by type',
			eventTypes.map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
			'calendar'
		);
	}

	container.appendChild(card);
}

/**
 * Render the Actions card
 */
function renderActionsCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement
): void {
	const card = createCard({
		title: 'Actions',
		icon: 'zap'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	new Setting(content)
		.setName('Open statistics dashboard')
		.setDesc('Open the full statistics dashboard in a new tab for detailed exploration')
		.addButton(button => button
			.setButtonText('Open dashboard')
			.setCta()
			.onClick(() => {
				void plugin.app.workspace.getLeaf('tab').setViewState({
					type: VIEW_TYPE_STATISTICS,
					active: true
				});
			}));

	container.appendChild(card);
}

/**
 * Format a number with thousands separators
 */
function formatNumber(num: number): string {
	return num.toLocaleString();
}

/**
 * Format a date/time for display
 */
function formatTime(date: Date): string {
	return date.toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit'
	});
}
