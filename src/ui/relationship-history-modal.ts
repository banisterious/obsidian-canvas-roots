/**
 * Relationship History Modal for Charted Roots
 *
 * Displays relationship change history with undo functionality.
 */

import { App, Modal, TFile, Notice, Setting } from 'obsidian';
import {
	RelationshipHistoryService,
	RelationshipChange,
	formatChangeDescription,
	formatChangeTimestamp
} from '../core/relationship-history';
import { createLucideIcon } from './lucide-icons';

/**
 * Modal to display and manage relationship history
 */
export class RelationshipHistoryModal extends Modal {
	private historyService: RelationshipHistoryService;
	private personFile?: TFile;
	private filterMode: 'all' | 'person' | 'undoable' = 'all';

	constructor(
		app: App,
		historyService: RelationshipHistoryService,
		personFile?: TFile
	) {
		super(app);
		this.historyService = historyService;
		this.personFile = personFile;

		// Default to person filter if a file is provided
		if (personFile) {
			this.filterMode = 'person';
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass('cr-relationship-history-modal');

		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Title
		const titleText = this.personFile
			? `Relationship history: ${this.personFile.basename}`
			: 'Relationship history';
		contentEl.createEl('h2', { text: titleText, cls: 'cr-modal-title' });

		// Stats summary
		this.renderStats(contentEl);

		// Filter controls
		this.renderFilters(contentEl);

		// Change list
		this.renderChangeList(contentEl);

		// Action buttons
		this.renderActions(contentEl);
	}

	private renderStats(container: HTMLElement): void {
		const stats = this.historyService.getStats();
		const statsDiv = container.createDiv({ cls: 'cr-history-stats' });

		const statsGrid = statsDiv.createDiv({ cls: 'cr-stats-grid cr-stats-grid--compact' });

		this.createMiniStat(statsGrid, 'Total', stats.totalChanges.toString());
		this.createMiniStat(statsGrid, 'Last 24h', stats.changesLast24h.toString());
		this.createMiniStat(statsGrid, 'Last 7d', stats.changesLast7d.toString());
		this.createMiniStat(statsGrid, 'Undone', stats.undoneChanges.toString());
	}

	private createMiniStat(container: HTMLElement, label: string, value: string): void {
		const stat = container.createDiv({ cls: 'cr-mini-stat' });
		stat.createEl('span', { text: value, cls: 'cr-mini-stat-value' });
		stat.createEl('span', { text: label, cls: 'cr-mini-stat-label' });
	}

	private renderFilters(container: HTMLElement): void {
		const filterDiv = container.createDiv({ cls: 'cr-history-filters' });

		new Setting(filterDiv)
			.setName('Filter')
			.addDropdown(dropdown => {
				dropdown
					.addOption('all', 'All changes')
					.addOption('undoable', 'Undoable only')
					.setValue(this.filterMode === 'person' ? 'all' : this.filterMode)
					.onChange(value => {
						this.filterMode = value as 'all' | 'undoable';
						this.render();
					});

				// Add person option if we have a person file
				if (this.personFile) {
					dropdown.addOption('person', `This person only`);
					if (this.filterMode === 'person') {
						dropdown.setValue('person');
					}
				}
			});
	}

	private renderChangeList(container: HTMLElement): void {
		const listDiv = container.createDiv({ cls: 'cr-history-list' });

		// Get filtered changes
		let changes: RelationshipChange[];
		switch (this.filterMode) {
			case 'person':
				changes = this.personFile
					? this.historyService.getChangesForPerson(this.personFile.path)
					: this.historyService.getAllChanges();
				break;
			case 'undoable':
				changes = this.historyService.getUndoableChanges();
				break;
			default:
				changes = this.historyService.getAllChanges();
		}

		if (changes.length === 0) {
			listDiv.createEl('p', {
				text: 'No relationship changes recorded.',
				cls: 'cr-history-empty'
			});
			return;
		}

		// Limit display to most recent 50
		const displayChanges = changes.slice(0, 50);

		for (const change of displayChanges) {
			this.renderChangeItem(listDiv, change);
		}

		if (changes.length > 50) {
			listDiv.createEl('p', {
				text: `Showing 50 of ${changes.length} changes`,
				cls: 'cr-history-truncated'
			});
		}
	}

	private renderChangeItem(container: HTMLElement, change: RelationshipChange): void {
		const item = container.createDiv({
			cls: `cr-history-item ${change.undone ? 'cr-history-item--undone' : ''}`
		});

		// Icon based on change type
		const iconName = this.getIconForChangeType(change.type);
		const icon = createLucideIcon(iconName, 16);
		icon.addClass('cr-history-item-icon');
		item.appendChild(icon);

		// Content
		const content = item.createDiv({ cls: 'cr-history-item-content' });

		const description = content.createDiv({ cls: 'cr-history-item-description' });
		description.setText(formatChangeDescription(change));

		const meta = content.createDiv({ cls: 'cr-history-item-meta' });
		meta.createEl('span', {
			text: formatChangeTimestamp(change.timestamp),
			cls: 'cr-history-item-time'
		});

		if (change.isBidirectionalSync) {
			meta.createEl('span', {
				text: 'auto-sync',
				cls: 'cr-history-item-tag'
			});
		}

		if (change.undone) {
			meta.createEl('span', {
				text: 'undone',
				cls: 'cr-history-item-tag cr-history-item-tag--undone'
			});
		}

		// Undo button (only for non-undone changes)
		if (!change.undone) {
			const undoBtn = item.createEl('button', {
				cls: 'cr-history-item-undo',
				attr: { 'aria-label': 'Undo this change' }
			});
			const undoIcon = createLucideIcon('undo-2', 14);
			undoBtn.appendChild(undoIcon);

			undoBtn.addEventListener('click', () => {
				void (async () => {
					const success = await this.historyService.undoChange(change.id);
					if (success) {
						new Notice('Change undone successfully');
						this.render();
					}
				})();
			});
		}
	}

	private getIconForChangeType(type: string): 'user-plus' | 'user-minus' | 'users' | 'heart' {
		if (type.includes('father') || type.includes('mother')) {
			return type.includes('add') || type.includes('update') ? 'user-plus' : 'user-minus';
		}
		if (type.includes('spouse')) {
			return 'heart';
		}
		if (type.includes('child')) {
			return 'users';
		}
		return 'users';
	}

	private renderActions(container: HTMLElement): void {
		const actionsDiv = container.createDiv({ cls: 'cr-modal-buttons' });

		// Undo last button
		const undoableCount = this.historyService.getUndoableChanges().length;
		if (undoableCount > 0) {
			const undoLastBtn = actionsDiv.createEl('button', {
				cls: 'crc-btn',
				text: 'Undo last change'
			});
			undoLastBtn.addEventListener('click', () => {
				void (async () => {
					const change = await this.historyService.undoLastChange();
					if (change) {
						new Notice(`Undone: ${formatChangeDescription(change)}`);
						this.render();
					}
				})();
			});
		}

		// Close button
		const closeBtn = actionsDiv.createEl('button', {
			cls: 'crc-btn crc-btn--primary',
			text: 'Close'
		});
		closeBtn.addEventListener('click', () => this.close());
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal to confirm clearing history
 */
export class ClearHistoryConfirmModal extends Modal {
	private historyService: RelationshipHistoryService;
	private onConfirm: () => void;

	constructor(
		app: App,
		historyService: RelationshipHistoryService,
		onConfirm: () => void
	) {
		super(app);
		this.historyService = historyService;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Clear relationship history?' });

		const stats = this.historyService.getStats();
		contentEl.createEl('p', {
			text: `This will permanently delete ${stats.totalChanges} history entries. This action cannot be undone.`
		});

		const buttonDiv = contentEl.createDiv({ cls: 'cr-modal-buttons' });

		const cancelBtn = buttonDiv.createEl('button', {
			cls: 'crc-btn',
			text: 'Cancel'
		});
		cancelBtn.addEventListener('click', () => this.close());

		const confirmBtn = buttonDiv.createEl('button', {
			cls: 'crc-btn crc-btn--danger',
			text: 'Clear history'
		});
		confirmBtn.addEventListener('click', () => {
			void (async () => {
				await this.historyService.clearHistory();
				this.onConfirm();
				this.close();
				new Notice('Relationship history cleared');
			})();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
