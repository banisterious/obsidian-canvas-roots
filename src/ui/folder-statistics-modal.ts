/**
 * Folder Statistics Modal for Canvas Roots
 *
 * Displays comprehensive statistics about person notes in a folder,
 * including data completeness, relationship health, and family structure.
 */

import { App, Modal, TFolder } from 'obsidian';
import { FamilyGraphService, CollectionAnalytics } from '../core/family-graph';
import { FolderFilterService } from '../core/folder-filter';
import { createLucideIcon, LucideIconName } from './lucide-icons';

/**
 * Modal to display folder-level statistics and health reports
 */
export class FolderStatisticsModal extends Modal {
	private folder: TFolder;
	private analytics: CollectionAnalytics | null = null;
	private loading = true;
	private folderFilter?: FolderFilterService;

	constructor(app: App, folder: TFolder, folderFilter?: FolderFilterService) {
		super(app);
		this.folder = folder;
		this.folderFilter = folderFilter;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		this.modalEl.addClass('cr-folder-statistics-modal');

		// Title
		contentEl.createEl('h2', {
			text: `Statistics: ${this.folder.name}`,
			cls: 'crc-modal-title'
		});

		// Loading state
		const loadingEl = contentEl.createDiv({ cls: 'cr-loading' });
		loadingEl.createEl('p', { text: 'Analyzing folder...' });

		// Load analytics
		try {
			const graphService = new FamilyGraphService(this.app);
			if (this.folderFilter) {
				graphService.setFolderFilter(this.folderFilter);
			}
			this.analytics = graphService.calculateCollectionAnalytics();
			this.loading = false;

			// Remove loading and render stats
			loadingEl.remove();
			this.renderStatistics(contentEl);
		} catch (error) {
			loadingEl.empty();
			loadingEl.createEl('p', {
				text: `Error loading statistics: ${error}`,
				cls: 'cr-error-text'
			});
		}
	}

	private renderStatistics(container: HTMLElement): void {
		if (!this.analytics) return;

		// Overview section
		const overviewSection = container.createDiv({ cls: 'cr-stats-section' });
		overviewSection.createEl('h3', { text: 'Overview' });

		const overviewGrid = overviewSection.createDiv({ cls: 'cr-stats-grid' });

		this.createStatCard(overviewGrid, 'users', 'Total people', this.analytics.totalPeople.toString());
		this.createStatCard(overviewGrid, 'home', 'Family groups', this.analytics.totalFamilies.toString());
		this.createStatCard(overviewGrid, 'folder', 'Collections', this.analytics.totalUserCollections.toString());

		if (this.analytics.dateRange.earliest && this.analytics.dateRange.latest) {
			const dateRangeText = `${this.analytics.dateRange.earliest} - ${this.analytics.dateRange.latest}`;
			this.createStatCard(overviewGrid, 'calendar', 'Date range', dateRangeText);
		}

		// Data completeness section
		const completenessSection = container.createDiv({ cls: 'cr-stats-section' });
		completenessSection.createEl('h3', { text: 'Data completeness' });

		const completenessGrid = completenessSection.createDiv({ cls: 'cr-completeness-grid' });

		this.createProgressBar(completenessGrid, 'Birth dates', this.analytics.dataCompleteness.birthDatePercent);
		this.createProgressBar(completenessGrid, 'Death dates', this.analytics.dataCompleteness.deathDatePercent);
		this.createProgressBar(completenessGrid, 'Gender/Sex', this.analytics.dataCompleteness.sexPercent);

		// Relationship health section
		const relationshipSection = container.createDiv({ cls: 'cr-stats-section' });
		relationshipSection.createEl('h3', { text: 'Relationship coverage' });

		const relationshipGrid = relationshipSection.createDiv({ cls: 'cr-stats-grid' });

		const withParentsPercent = this.analytics.totalPeople > 0
			? Math.round((this.analytics.relationshipMetrics.peopleWithParents / this.analytics.totalPeople) * 100)
			: 0;
		const withSpousesPercent = this.analytics.totalPeople > 0
			? Math.round((this.analytics.relationshipMetrics.peopleWithSpouses / this.analytics.totalPeople) * 100)
			: 0;
		const withChildrenPercent = this.analytics.totalPeople > 0
			? Math.round((this.analytics.relationshipMetrics.peopleWithChildren / this.analytics.totalPeople) * 100)
			: 0;

		this.createStatCard(
			relationshipGrid,
			'users',
			'Have parents',
			`${this.analytics.relationshipMetrics.peopleWithParents} (${withParentsPercent}%)`
		);
		this.createStatCard(
			relationshipGrid,
			'heart',
			'Have spouses',
			`${this.analytics.relationshipMetrics.peopleWithSpouses} (${withSpousesPercent}%)`
		);
		this.createStatCard(
			relationshipGrid,
			'baby',
			'Have children',
			`${this.analytics.relationshipMetrics.peopleWithChildren} (${withChildrenPercent}%)`
		);

		// Orphaned people warning
		if (this.analytics.relationshipMetrics.orphanedPeople > 0) {
			const orphanWarning = relationshipSection.createDiv({ cls: 'cr-stats-warning' });
			const warnIcon = createLucideIcon('alert-triangle', 16);
			warnIcon.addClass('cr-icon--warning');
			orphanWarning.appendChild(warnIcon);
			orphanWarning.createEl('span', {
				text: ` ${this.analytics.relationshipMetrics.orphanedPeople} people have no relationships (isolated)`
			});
		}

		// Collection sizes section
		if (this.analytics.largestCollection && this.analytics.smallestCollection) {
			const sizeSection = container.createDiv({ cls: 'cr-stats-section' });
			sizeSection.createEl('h3', { text: 'Collection sizes' });

			const sizeGrid = sizeSection.createDiv({ cls: 'cr-stats-grid' });

			this.createStatCard(
				sizeGrid,
				'maximize-2',
				'Largest',
				`${this.analytics.largestCollection.name} (${this.analytics.largestCollection.size})`
			);
			this.createStatCard(
				sizeGrid,
				'minimize-2',
				'Smallest',
				`${this.analytics.smallestCollection.name} (${this.analytics.smallestCollection.size})`
			);
			this.createStatCard(
				sizeGrid,
				'bar-chart',
				'Average size',
				this.analytics.averageCollectionSize.toString()
			);
		}

		// Cross-collection connections
		if (this.analytics.crossCollectionMetrics.totalConnections > 0) {
			const connectionsSection = container.createDiv({ cls: 'cr-stats-section' });
			connectionsSection.createEl('h3', { text: 'Cross-collection connections' });

			const connectionsInfo = connectionsSection.createDiv({ cls: 'cr-stats-info' });
			connectionsInfo.createEl('p', {
				text: `${this.analytics.crossCollectionMetrics.totalConnections} connections between collections`
			});
			connectionsInfo.createEl('p', {
				text: `${this.analytics.crossCollectionMetrics.totalBridgePeople} bridge people connecting different groups`
			});

			if (this.analytics.crossCollectionMetrics.topConnections.length > 0) {
				const topList = connectionsSection.createEl('ul', { cls: 'cr-stats-list' });
				for (const conn of this.analytics.crossCollectionMetrics.topConnections) {
					topList.createEl('li', {
						text: `${conn.from} ↔ ${conn.to}: ${conn.bridgeCount} bridge people`
					});
				}
			}
		}

		// Close button
		const buttonContainer = container.createDiv({ cls: 'cr-modal-buttons' });
		const closeBtn = buttonContainer.createEl('button', {
			cls: 'crc-btn crc-btn--primary',
			text: 'Close'
		});
		closeBtn.addEventListener('click', () => this.close());
	}

	private createStatCard(container: HTMLElement, icon: LucideIconName, label: string, value: string): void {
		const card = container.createDiv({ cls: 'cr-stat-card' });

		const iconEl = createLucideIcon(icon, 20);
		iconEl.addClass('cr-stat-icon');
		card.appendChild(iconEl);

		const textDiv = card.createDiv({ cls: 'cr-stat-text' });
		textDiv.createEl('div', { text: label, cls: 'cr-stat-label' });
		textDiv.createEl('div', { text: value, cls: 'cr-stat-value' });
	}

	private createProgressBar(container: HTMLElement, label: string, percent: number): void {
		const row = container.createDiv({ cls: 'cr-progress-row' });

		row.createEl('span', { text: label, cls: 'cr-progress-label' });

		const barContainer = row.createDiv({ cls: 'cr-progress-bar-container' });
		const bar = barContainer.createDiv({ cls: 'cr-progress-bar' });
		bar.style.width = `${percent}%`;

		// Color based on percent
		if (percent >= 80) {
			bar.addClass('cr-progress-bar--good');
		} else if (percent >= 50) {
			bar.addClass('cr-progress-bar--medium');
		} else {
			bar.addClass('cr-progress-bar--low');
		}

		row.createEl('span', { text: `${percent}%`, cls: 'cr-progress-percent' });
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
