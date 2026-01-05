/**
 * Staging Management Modal
 *
 * Provides UI for managing staged imports:
 * - View staging folder status and statistics
 * - Check for duplicates against main tree
 * - Promote staging files to main tree
 * - Delete staging data
 */

import { App, Modal, Notice, setIcon, TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../main';
import {
	StagingService,
	type EntityTypeCounts,
	type StagingSubfolderInfo
} from '../core/staging-service';
import { CrossImportDetectionService } from '../core/cross-import-detection';
import { FolderFilterService } from '../core/folder-filter';
import type { NoteType } from '../utils/note-type-detection';

/**
 * Options for StagingManagementModal
 */
export interface StagingManagementOptions {
	filterClipped?: boolean;
}

/**
 * Staging Management Modal
 */
export class StagingManagementModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private stagingService: StagingService;
	private crossImportService: CrossImportDetectionService | null = null;
	private expandedBatches: Set<string> = new Set();
	private filterClipped: boolean;

	constructor(app: App, plugin: CanvasRootsPlugin, options?: StagingManagementOptions) {
		super(app);
		this.plugin = plugin;
		this.stagingService = new StagingService(app, plugin.settings);
		this.filterClipped = options?.filterClipped ?? false;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('crc-staging-modal');

		this.renderContent();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Render the modal content
	 */
	private renderContent(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Header
		this.renderHeader(contentEl);

		// Check if staging is configured
		if (!this.stagingService.isConfigured()) {
			this.renderNotConfigured(contentEl);
			return;
		}

		// Get staging stats
		const stats = this.stagingService.getStagingStats();

		// Empty state
		if (stats.totalFiles === 0) {
			this.renderEmptyState(contentEl);
			return;
		}

		// Staging overview
		this.renderOverview(contentEl, stats);

		// Subfolder list
		this.renderSubfolderList(contentEl);

		// Bulk actions
		this.renderBulkActions(contentEl, stats);
	}

	/**
	 * Render the modal header
	 */
	private renderHeader(container: HTMLElement): void {
		const header = container.createDiv({ cls: 'crc-staging-header' });
		const headerIcon = header.createDiv({ cls: 'crc-staging-header-icon' });
		setIcon(headerIcon, 'archive');
		header.createEl('h2', { text: 'Staging Manager' });
	}

	/**
	 * Render not configured state
	 */
	private renderNotConfigured(container: HTMLElement): void {
		const empty = container.createDiv({ cls: 'crc-staging-empty' });
		const icon = empty.createDiv({ cls: 'crc-staging-empty-icon' });
		setIcon(icon, 'settings');

		empty.createEl('h3', { text: 'Staging not configured' });
		empty.createEl('p', {
			text: 'Enable staging isolation and configure a staging folder in settings to use this feature.'
		});

		const openSettings = empty.createEl('button', {
			text: 'Open Settings',
			cls: 'mod-cta'
		});
		openSettings.addEventListener('click', () => {
			this.close();
			// Open plugin settings
			// @ts-expect-error - accessing private API
			this.app.setting.open();
			// @ts-expect-error - accessing private API
			this.app.setting.openTabById('canvas-roots');
		});
	}

	/**
	 * Render empty staging state
	 */
	private renderEmptyState(container: HTMLElement): void {
		const empty = container.createDiv({ cls: 'crc-staging-empty' });
		const icon = empty.createDiv({ cls: 'crc-staging-empty-icon' });
		setIcon(icon, 'inbox');

		empty.createEl('h3', { text: 'No staged imports' });
		empty.createEl('p', {
			text: 'Use the Import Wizard to import data to staging, or configure Web Clipper to save clips here.'
		});

		const stagingPath = this.stagingService.getStagingFolder();
		if (stagingPath) {
			empty.createDiv({
				cls: 'crc-staging-path',
				text: `Staging folder: ${stagingPath}`
			});
		}

		const openImport = empty.createEl('button', {
			text: 'Open Import Wizard',
			cls: 'mod-cta'
		});
		openImport.addEventListener('click', () => {
			this.close();
			void import('./import-wizard-modal').then(({ ImportWizardModal }) => {
				new ImportWizardModal(this.app, this.plugin).open();
			});
		});
	}

	/**
	 * Render staging overview with stats
	 */
	private renderOverview(
		container: HTMLElement,
		stats: {
			totalFiles: number;
			totalEntities: number;
			entityCounts: EntityTypeCounts;
			subfolderCount: number;
		}
	): void {
		const overview = container.createDiv({ cls: 'crc-staging-overview' });

		// Staging folder path
		const stagingPath = this.stagingService.getStagingFolder();
		overview.createDiv({
			cls: 'crc-staging-info',
			text: `Staging folder: ${stagingPath}`
		});

		// Stats grid
		const statsGrid = overview.createDiv({ cls: 'crc-staging-stats' });

		// Total entities
		this.renderStatCard(statsGrid, 'users', stats.totalEntities.toString(), 'Total Entities');

		// Subfolders
		this.renderStatCard(statsGrid, 'folders', stats.subfolderCount.toString(), 'Import Batches');

		// Entity breakdown
		const breakdown = overview.createDiv({ cls: 'crc-staging-breakdown' });
		breakdown.createEl('span', { text: 'By type: ', cls: 'crc-staging-breakdown-label' });

		const counts: Array<{ type: string; count: number; icon: string }> = [
			{ type: 'People', count: stats.entityCounts.person, icon: 'user' },
			{ type: 'Places', count: stats.entityCounts.place, icon: 'map-pin' },
			{ type: 'Sources', count: stats.entityCounts.source, icon: 'book-open' },
			{ type: 'Events', count: stats.entityCounts.event, icon: 'calendar' },
			{ type: 'Organizations', count: stats.entityCounts.organization, icon: 'building' }
		];

		const nonZeroCounts = counts.filter(c => c.count > 0);
		nonZeroCounts.forEach((c, idx) => {
			const badge = breakdown.createSpan({ cls: 'crc-staging-type-badge' });
			const badgeIcon = badge.createSpan({ cls: 'crc-staging-type-badge-icon' });
			setIcon(badgeIcon, c.icon);
			badge.createSpan({ text: `${c.count} ${c.type}` });
			if (idx < nonZeroCounts.length - 1) {
				breakdown.createSpan({ text: ', ', cls: 'crc-staging-separator' });
			}
		});

		if (stats.entityCounts.other > 0) {
			if (nonZeroCounts.length > 0) {
				breakdown.createSpan({ text: ', ', cls: 'crc-staging-separator' });
			}
			breakdown.createSpan({ text: `${stats.entityCounts.other} other` });
		}
	}

	/**
	 * Render a stat card
	 */
	private renderStatCard(
		container: HTMLElement,
		icon: string,
		value: string,
		label: string
	): void {
		const card = container.createDiv({ cls: 'crc-staging-stat-card' });
		const iconEl = card.createDiv({ cls: 'crc-staging-stat-icon' });
		setIcon(iconEl, icon);
		card.createDiv({ cls: 'crc-staging-stat-value', text: value });
		card.createDiv({ cls: 'crc-staging-stat-label', text: label });
	}

	/**
	 * Render the subfolder list
	 */
	private renderSubfolderList(container: HTMLElement): void {
		const subfolders = this.stagingService.getStagingSubfolders();
		if (subfolders.length === 0) return;

		const list = container.createDiv({ cls: 'crc-staging-list' });
		list.createEl('h3', { text: 'Import Batches' });

		for (const subfolder of subfolders) {
			this.renderSubfolderItem(list, subfolder);
		}
	}

	/**
	 * Render a single subfolder item
	 */
	private renderSubfolderItem(container: HTMLElement, subfolder: StagingSubfolderInfo): void {
		const isExpanded = this.expandedBatches.has(subfolder.path);
		const item = container.createDiv({
			cls: `crc-staging-item ${isExpanded ? 'is-expanded' : ''}`
		});

		// Clickable header with folder icon and name
		const header = item.createDiv({ cls: 'crc-staging-item-header' });
		header.setAttribute('role', 'button');
		header.setAttribute('tabindex', '0');
		header.setAttribute('aria-expanded', isExpanded.toString());

		// Chevron for expand/collapse
		const chevron = header.createDiv({ cls: 'crc-staging-item-chevron' });
		setIcon(chevron, 'chevron-right');

		const iconEl = header.createDiv({ cls: 'crc-staging-item-icon' });
		setIcon(iconEl, 'folder');

		const info = header.createDiv({ cls: 'crc-staging-item-info' });
		info.createDiv({ cls: 'crc-staging-item-name', text: subfolder.name });

		// Stats line
		const statsText = this.formatEntityCounts(subfolder.entityCounts);
		const modifiedText = subfolder.modifiedDate
			? `Modified: ${this.formatDate(subfolder.modifiedDate)}`
			: '';

		const statsLine = info.createDiv({ cls: 'crc-staging-item-stats' });
		statsLine.createSpan({ text: statsText });
		if (modifiedText) {
			statsLine.createSpan({ text: ' — ' });
			statsLine.createSpan({ text: modifiedText, cls: 'crc-staging-item-date' });
		}

		// Toggle expand on header click
		header.addEventListener('click', (e) => {
			// Don't toggle if clicking on actions
			if ((e.target as HTMLElement).closest('.crc-staging-item-actions')) return;
			this.toggleBatchExpanded(subfolder.path);
		});
		header.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				this.toggleBatchExpanded(subfolder.path);
			}
		});

		// Actions
		const actions = item.createDiv({ cls: 'crc-staging-item-actions' });

		// Check duplicates button
		const checkBtn = actions.createEl('button', {
			cls: 'crc-staging-btn crc-staging-btn-check',
			attr: { 'aria-label': 'Check duplicates' }
		});
		setIcon(checkBtn, 'search');
		checkBtn.createSpan({ text: 'Check duplicates' });
		checkBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.handleCheckDuplicates(subfolder.path);
		});

		// Promote button
		const promoteBtn = actions.createEl('button', {
			cls: 'crc-staging-btn crc-staging-btn-promote',
			attr: { 'aria-label': 'Promote' }
		});
		setIcon(promoteBtn, 'arrow-up-right');
		promoteBtn.createSpan({ text: 'Promote' });
		promoteBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.handlePromoteSubfolder(subfolder);
		});

		// Delete button
		const deleteBtn = actions.createEl('button', {
			cls: 'crc-staging-btn crc-staging-btn-delete',
			attr: { 'aria-label': 'Delete' }
		});
		setIcon(deleteBtn, 'trash-2');
		deleteBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.handleDeleteSubfolder(subfolder);
		});

		// Expandable file list
		if (isExpanded) {
			this.renderFileList(item, subfolder.path);
		}
	}

	/**
	 * Toggle batch expansion state
	 */
	private toggleBatchExpanded(path: string): void {
		if (this.expandedBatches.has(path)) {
			this.expandedBatches.delete(path);
		} else {
			this.expandedBatches.add(path);
		}
		this.renderContent();
	}

	/**
	 * Render the file list for an expanded batch
	 */
	private renderFileList(container: HTMLElement, subfolderPath: string): void {
		let files = this.stagingService.getSubfolderFiles(subfolderPath);

		// Apply clipped notes filter if enabled
		if (this.filterClipped) {
			const webClipperService = this.plugin.getWebClipperService();
			if (webClipperService) {
				files = files.filter(({ file }) => webClipperService.isClippedNote(file));
			}
		}

		if (files.length === 0) return;

		const fileList = container.createDiv({ cls: 'crc-staging-file-list' });

		for (const { file, entityType } of files) {
			const fileRow = fileList.createDiv({ cls: 'crc-staging-file-row' });
			fileRow.setAttribute('role', 'button');
			fileRow.setAttribute('tabindex', '0');

			// Entity type icon
			const typeIcon = fileRow.createDiv({ cls: 'crc-staging-file-icon' });
			setIcon(typeIcon, this.getEntityTypeIcon(entityType));

			// File name
			fileRow.createDiv({
				cls: 'crc-staging-file-name',
				text: file.basename
			});

			// Entity type badge
			if (entityType) {
				fileRow.createDiv({
					cls: 'crc-staging-file-type',
					text: entityType
				});
			}

			// Click to open file
			const openFile = () => {
				this.app.workspace.openLinkText(file.path, '', true);
			};
			fileRow.addEventListener('click', openFile);
			fileRow.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					openFile();
				}
			});
		}
	}

	/**
	 * Get icon for entity type
	 */
	private getEntityTypeIcon(entityType: NoteType | null): string {
		switch (entityType) {
			case 'person': return 'user';
			case 'place': return 'map-pin';
			case 'source': return 'book-open';
			case 'event': return 'calendar';
			case 'organization': return 'building';
			default: return 'file';
		}
	}

	/**
	 * Render bulk actions
	 */
	private renderBulkActions(
		container: HTMLElement,
		stats: { totalEntities: number }
	): void {
		const actions = container.createDiv({ cls: 'crc-staging-actions' });
		actions.createEl('h3', { text: 'Bulk Actions', cls: 'crc-staging-actions-header' });

		const buttonRow = actions.createDiv({ cls: 'crc-staging-actions-row' });

		// Check all duplicates
		const checkAllBtn = buttonRow.createEl('button', {
			cls: 'crc-staging-btn crc-staging-btn-check'
		});
		setIcon(checkAllBtn, 'search');
		checkAllBtn.createSpan({ text: 'Check all duplicates' });
		checkAllBtn.addEventListener('click', () => this.handleCheckDuplicates());

		// Promote all
		const promoteAllBtn = buttonRow.createEl('button', {
			cls: 'crc-staging-btn crc-staging-btn-promote'
		});
		setIcon(promoteAllBtn, 'arrow-up-right');
		promoteAllBtn.createSpan({ text: 'Promote all' });
		promoteAllBtn.addEventListener('click', () => this.handlePromoteAll(stats.totalEntities));

		// Delete all
		const deleteAllBtn = buttonRow.createEl('button', {
			cls: 'crc-staging-btn crc-staging-btn-delete'
		});
		setIcon(deleteAllBtn, 'trash-2');
		deleteAllBtn.createSpan({ text: 'Delete all' });
		deleteAllBtn.addEventListener('click', () => this.handleDeleteAll(stats.totalEntities));
	}

	/**
	 * Handle check duplicates action
	 */
	private async handleCheckDuplicates(subfolderPath?: string): Promise<void> {
		// Initialize cross-import service if needed
		if (!this.crossImportService) {
			const folderFilter = new FolderFilterService(this.plugin.settings);
			this.crossImportService = new CrossImportDetectionService(
				this.app,
				this.plugin.settings,
				folderFilter,
				this.stagingService
			);
		}

		// Find matches
		const matches = this.crossImportService.findCrossImportMatches(subfolderPath);

		if (matches.length === 0) {
			new Notice('No duplicates found. All staging data appears unique.');
			return;
		}

		// TODO: Open CrossImportReviewModal when implemented
		new Notice(`Found ${matches.length} potential duplicate(s). Review modal coming soon.`);
	}

	/**
	 * Handle promote subfolder action
	 */
	private async handlePromoteSubfolder(subfolder: StagingSubfolderInfo): Promise<void> {
		const totalEntities = this.getTotalEntities(subfolder.entityCounts);
		const confirmed = await this.confirmAction(
			'Promote Staging Data',
			`This will move ${totalEntities} entities from "${subfolder.name}" to your main folder. Continue?`
		);

		if (!confirmed) return;

		// Build shouldSkip callback from resolutions
		const shouldSkip = this.crossImportService
			? (_file: import('obsidian').TFile, crId: string | undefined) => {
				if (!crId || !this.crossImportService) return false;
				const resolutions = this.crossImportService.getResolutions();
				return resolutions.some(r => r.stagingCrId === crId && r.resolution === 'same');
			}
			: undefined;

		const result = await this.stagingService.promoteSubfolder(subfolder.path, { shouldSkip });

		if (result.success) {
			let message = `Promoted ${result.filesPromoted} entities to main tree`;
			if (result.filesSkipped > 0) {
				message += ` (${result.filesSkipped} skipped as duplicates)`;
			}
			if (result.filesRenamed > 0) {
				message += ` (${result.filesRenamed} renamed to avoid conflicts)`;
			}
			new Notice(message);
		} else {
			new Notice(`Promote failed: ${result.errors.join(', ')}`);
		}

		// Refresh UI
		this.renderContent();
	}

	/**
	 * Handle promote all action
	 */
	private async handlePromoteAll(totalEntities: number): Promise<void> {
		const confirmed = await this.confirmAction(
			'Promote All Staging Data',
			`This will move ${totalEntities} entities from staging to your main folder. Files marked as 'same entity' will be skipped. Continue?`
		);

		if (!confirmed) return;

		// Build shouldSkip callback from resolutions
		const shouldSkip = this.crossImportService
			? (_file: import('obsidian').TFile, crId: string | undefined) => {
				if (!crId || !this.crossImportService) return false;
				const resolutions = this.crossImportService.getResolutions();
				return resolutions.some(r => r.stagingCrId === crId && r.resolution === 'same');
			}
			: undefined;

		const result = await this.stagingService.promoteAll({ shouldSkip });

		if (result.success) {
			let message = `Promoted ${result.filesPromoted} entities to main tree`;
			if (result.filesSkipped > 0) {
				message += ` (${result.filesSkipped} skipped as duplicates)`;
			}
			if (result.filesRenamed > 0) {
				message += ` (${result.filesRenamed} renamed to avoid conflicts)`;
			}
			new Notice(message);
		} else {
			new Notice(`Promote failed: ${result.errors.join(', ')}`);
		}

		// Refresh UI
		this.renderContent();
	}

	/**
	 * Handle delete subfolder action
	 */
	private async handleDeleteSubfolder(subfolder: StagingSubfolderInfo): Promise<void> {
		const totalEntities = this.getTotalEntities(subfolder.entityCounts);
		const confirmed = await this.confirmAction(
			'Delete Staging Data',
			`This will permanently delete ${totalEntities} entities from "${subfolder.name}". This cannot be undone. Continue?`
		);

		if (!confirmed) return;

		const result = await this.stagingService.deleteSubfolder(subfolder.path);

		if (result.success) {
			new Notice(`Deleted ${result.filesDeleted} files from staging`);
		} else {
			new Notice(`Delete failed: ${result.error}`);
		}

		// Refresh UI
		this.renderContent();
	}

	/**
	 * Handle delete all action
	 */
	private async handleDeleteAll(totalEntities: number): Promise<void> {
		const confirmed = await this.confirmAction(
			'Delete All Staging Data',
			`This will permanently delete ${totalEntities} entities from staging. This cannot be undone. Continue?`
		);

		if (!confirmed) return;

		const result = await this.stagingService.deleteAllStaging();

		if (result.success) {
			new Notice(`Deleted ${result.filesDeleted} files from staging`);
		} else {
			new Notice(`Delete failed: ${result.error}`);
		}

		// Refresh UI
		this.renderContent();
	}

	/**
	 * Show confirmation dialog
	 */
	private confirmAction(title: string, message: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmationModal(this.app, title, message, resolve);
			modal.open();
		});
	}

	/**
	 * Format entity counts for display
	 */
	private formatEntityCounts(counts: EntityTypeCounts): string {
		const parts: string[] = [];

		if (counts.person > 0) parts.push(`${counts.person} people`);
		if (counts.place > 0) parts.push(`${counts.place} places`);
		if (counts.source > 0) parts.push(`${counts.source} sources`);
		if (counts.event > 0) parts.push(`${counts.event} events`);
		if (counts.organization > 0) parts.push(`${counts.organization} organizations`);
		if (counts.other > 0) parts.push(`${counts.other} other`);

		return parts.length > 0 ? parts.join(', ') : 'Empty';
	}

	/**
	 * Get total entity count
	 */
	private getTotalEntities(counts: EntityTypeCounts): number {
		return counts.person + counts.place + counts.source +
			counts.event + counts.organization + counts.other;
	}

	/**
	 * Format a date for display
	 */
	private formatDate(date: Date): string {
		return date.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
}

/**
 * Simple confirmation modal
 */
class ConfirmationModal extends Modal {
	private titleText: string;
	private message: string;
	private onResult: (confirmed: boolean) => void;

	constructor(app: App, title: string, message: string, onResult: (confirmed: boolean) => void) {
		super(app);
		this.titleText = title;
		this.message = message;
		this.onResult = onResult;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText(this.titleText);

		contentEl.createEl('p', { text: this.message });

		const buttonContainer = contentEl.createDiv({ cls: 'crc-confirmation-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn-secondary'
		});
		cancelBtn.addEventListener('click', () => {
			this.onResult(false);
			this.close();
		});

		const confirmBtn = buttonContainer.createEl('button', {
			text: 'Continue',
			cls: 'mod-warning'
		});
		confirmBtn.addEventListener('click', () => {
			this.onResult(true);
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
