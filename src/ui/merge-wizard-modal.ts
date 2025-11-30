/**
 * Merge Wizard Modal
 *
 * Provides a UI for merging two duplicate person records with
 * field-by-field conflict resolution.
 */

import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import {
	MergeService,
	MergeFieldChoice,
	FieldDifference,
	PersonFrontmatter
} from '../core/merge-service';
import type { CanvasRootsSettings } from '../settings';
import { getLogger } from '../core/logging';

const logger = getLogger('MergeWizard');

/**
 * Modal for merging two person records
 */
export class MergeWizardModal extends Modal {
	private mergeService: MergeService;
	private differences: FieldDifference[];
	private choices: Map<string, 'main' | 'staging' | 'both'>;
	private onMergeComplete?: () => void;

	constructor(
		app: App,
		private settings: CanvasRootsSettings,
		private stagingFile: TFile,
		private mainFile: TFile,
		onMergeComplete?: () => void
	) {
		super(app);
		this.mergeService = new MergeService(app, settings);
		this.differences = this.mergeService.getFieldDifferences(stagingFile, mainFile);
		this.choices = new Map();
		this.onMergeComplete = onMergeComplete;

		// Initialize choices - default to 'main' for all fields
		for (const diff of this.differences) {
			this.choices.set(diff.field, 'main');
		}
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText('Merge records');
		contentEl.addClass('cr-merge-wizard');

		this.renderContent();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderContent(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Header info
		const headerEl = contentEl.createDiv({ cls: 'cr-merge-header' });
		headerEl.createEl('p', {
			text: `Merging data from staging into main tree record.`,
			cls: 'cr-merge-header__desc'
		});

		const filesEl = headerEl.createDiv({ cls: 'cr-merge-files' });
		filesEl.createDiv({
			text: `Staging: ${this.stagingFile.basename}`,
			cls: 'cr-merge-files__staging'
		});
		filesEl.createDiv({
			text: `Main: ${this.mainFile.basename}`,
			cls: 'cr-merge-files__main'
		});

		// Field comparison table
		const tableEl = contentEl.createDiv({ cls: 'cr-merge-table' });

		// Table header
		const headerRow = tableEl.createDiv({ cls: 'cr-merge-row cr-merge-row--header' });
		headerRow.createDiv({ text: 'Field', cls: 'cr-merge-cell cr-merge-cell--field' });
		headerRow.createDiv({ text: 'Staging', cls: 'cr-merge-cell cr-merge-cell--staging' });
		headerRow.createDiv({ text: 'Main', cls: 'cr-merge-cell cr-merge-cell--main' });
		headerRow.createDiv({ text: 'Use', cls: 'cr-merge-cell cr-merge-cell--choice' });

		// Field rows
		for (const diff of this.differences) {
			this.renderFieldRow(tableEl, diff);
		}

		// Info section
		const infoEl = contentEl.createDiv({ cls: 'cr-merge-info' });
		infoEl.createEl('p', {
			text: 'After merge:',
			cls: 'cr-merge-info__title'
		});
		const infoList = infoEl.createEl('ul', { cls: 'cr-merge-info__list' });
		infoList.createEl('li', { text: 'The staging file will be deleted' });
		infoList.createEl('li', { text: 'The main file will be updated with merged data' });
		infoList.createEl('li', { text: 'Relationships pointing to staging will be updated' });

		// Action buttons
		const actionsEl = contentEl.createDiv({ cls: 'cr-merge-actions' });

		const cancelBtn = actionsEl.createEl('button', {
			text: 'Cancel',
			cls: 'cr-merge-btn cr-merge-btn--secondary'
		});
		cancelBtn.addEventListener('click', () => this.close());

		const previewBtn = actionsEl.createEl('button', {
			text: 'Preview',
			cls: 'cr-merge-btn cr-merge-btn--secondary'
		});
		previewBtn.addEventListener('click', () => this.showPreview());

		const mergeBtn = actionsEl.createEl('button', {
			text: 'Merge',
			cls: 'cr-merge-btn mod-cta'
		});
		mergeBtn.addEventListener('click', () => this.executeMerge());
	}

	private renderFieldRow(container: HTMLElement, diff: FieldDifference): void {
		const rowEl = container.createDiv({
			cls: `cr-merge-row ${diff.isDifferent ? 'cr-merge-row--different' : ''}`
		});

		// Field label
		rowEl.createDiv({
			text: diff.label,
			cls: 'cr-merge-cell cr-merge-cell--field'
		});

		// Staging value
		const stagingCell = rowEl.createDiv({ cls: 'cr-merge-cell cr-merge-cell--staging' });
		stagingCell.createSpan({
			text: this.formatValue(diff.stagingValue),
			cls: diff.stagingValue ? '' : 'cr-merge-empty'
		});

		// Main value
		const mainCell = rowEl.createDiv({ cls: 'cr-merge-cell cr-merge-cell--main' });
		mainCell.createSpan({
			text: this.formatValue(diff.mainValue),
			cls: diff.mainValue ? '' : 'cr-merge-empty'
		});

		// Choice dropdown
		const choiceCell = rowEl.createDiv({ cls: 'cr-merge-cell cr-merge-cell--choice' });

		if (!diff.isDifferent) {
			// No conflict - show checkmark
			choiceCell.createSpan({ text: '✓', cls: 'cr-merge-same' });
		} else {
			const select = choiceCell.createEl('select', { cls: 'cr-merge-select' });

			const mainOption = select.createEl('option', { value: 'main', text: 'Main' });
			const stagingOption = select.createEl('option', { value: 'staging', text: 'Staging' });

			if (diff.canCombine) {
				select.createEl('option', { value: 'both', text: 'Both' });
			}

			// Set current choice
			select.value = this.choices.get(diff.field) || 'main';

			select.addEventListener('change', () => {
				this.choices.set(diff.field, select.value as 'main' | 'staging' | 'both');
			});
		}
	}

	private formatValue(value: string | string[] | undefined): string {
		if (value === undefined) {
			return '(empty)';
		}
		if (Array.isArray(value)) {
			return value.join(', ');
		}
		// Clean up wikilink formatting for display
		return value.replace(/"\[\[([^\]]+)\]\]"/g, '[[$1]]');
	}

	private showPreview(): void {
		const choices = this.getChoices();
		const preview = this.mergeService.previewMerge(this.stagingFile, this.mainFile, choices);

		if (!preview) {
			new Notice('Could not generate preview');
			return;
		}

		// Show preview modal
		const previewModal = new MergePreviewModal(this.app, preview);
		previewModal.open();
	}

	private getChoices(): MergeFieldChoice[] {
		const choices: MergeFieldChoice[] = [];

		for (const diff of this.differences) {
			if (diff.isDifferent) {
				choices.push({
					field: diff.field,
					choice: this.choices.get(diff.field) || 'main'
				});
			}
		}

		return choices;
	}

	private async executeMerge(): Promise<void> {
		const choices = this.getChoices();

		try {
			const result = await this.mergeService.merge(
				this.stagingFile,
				this.mainFile,
				choices
			);

			if (result.success) {
				let message = 'Records merged successfully';
				if (result.relationshipsUpdated > 0) {
					message += ` (${result.relationshipsUpdated} relationships updated)`;
				}
				new Notice(message);
				this.close();

				if (this.onMergeComplete) {
					this.onMergeComplete();
				}
			} else {
				new Notice(`Merge failed: ${result.error}`);
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			logger.error('merge', `Merge execution failed: ${msg}`);
			new Notice(`Merge failed: ${msg}`);
		}
	}
}

/**
 * Modal for previewing merged result
 */
class MergePreviewModal extends Modal {
	constructor(app: App, private preview: PersonFrontmatter) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText('Merge preview');
		contentEl.addClass('cr-merge-preview');

		contentEl.createEl('p', {
			text: 'This is what the merged record will look like:',
			cls: 'cr-merge-preview__desc'
		});

		const previewEl = contentEl.createDiv({ cls: 'cr-merge-preview__content' });

		// Show key fields
		const fields = [
			{ key: 'name', label: 'Name' },
			{ key: 'born', label: 'Birth date' },
			{ key: 'died', label: 'Death date' },
			{ key: 'birth_place', label: 'Birth place' },
			{ key: 'death_place', label: 'Death place' },
			{ key: 'gender', label: 'Gender' },
			{ key: 'father', label: 'Father' },
			{ key: 'mother', label: 'Mother' },
			{ key: 'spouse', label: 'Spouse(s)' },
			{ key: 'child', label: 'Children' }
		];

		for (const { key, label } of fields) {
			const value = this.preview[key];
			if (value !== undefined && value !== '') {
				const row = previewEl.createDiv({ cls: 'cr-merge-preview__row' });
				row.createSpan({ text: `${label}: `, cls: 'cr-merge-preview__label' });
				row.createSpan({
					text: this.formatValue(value),
					cls: 'cr-merge-preview__value'
				});
			}
		}

		const closeBtn = contentEl.createEl('button', {
			text: 'Close',
			cls: 'mod-cta'
		});
		closeBtn.addEventListener('click', () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private formatValue(value: unknown): string {
		if (Array.isArray(value)) {
			return value.join(', ');
		}
		return String(value).replace(/"\[\[([^\]]+)\]\]"/g, '[[$1]]');
	}
}
