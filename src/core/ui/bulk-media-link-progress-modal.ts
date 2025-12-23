/**
 * Bulk Media Link Progress Modal
 *
 * Shows progress while linking media files to multiple entities.
 * Reuses the import progress modal styling.
 */

import { App, Modal, setIcon } from 'obsidian';

/**
 * Progress state for bulk media linking
 */
export interface BulkLinkProgress {
	current: number;
	total: number;
	currentEntityName?: string;
}

/**
 * Modal to display bulk media linking progress
 */
export class BulkMediaLinkProgressModal extends Modal {
	private progressBar: HTMLElement | null = null;
	private progressText: HTMLElement | null = null;
	private phaseLabel: HTMLElement | null = null;
	private phaseIcon: HTMLElement | null = null;
	private statsContainer: HTMLElement | null = null;
	private cancelButton: HTMLButtonElement | null = null;

	private mediaCount: number = 0;
	private successCount: number = 0;
	private errorCount: number = 0;
	private isCancelled: boolean = false;

	constructor(app: App, mediaCount: number) {
		super(app);
		this.mediaCount = mediaCount;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class and prevent closing by clicking outside
		this.modalEl.addClass('cr-import-progress-modal');

		// Title
		contentEl.createEl('h2', {
			text: 'Linking Media',
			cls: 'crc-modal-title'
		});

		// Phase indicator
		const phaseContainer = contentEl.createDiv({ cls: 'cr-import-phase' });
		this.phaseIcon = phaseContainer.createDiv({ cls: 'cr-import-phase__icon' });
		setIcon(this.phaseIcon, 'image-plus');
		this.phaseLabel = phaseContainer.createEl('span', {
			cls: 'cr-import-phase__label',
			text: 'Linking media to entities…'
		});

		// Progress bar container
		const progressContainer = contentEl.createDiv({ cls: 'cr-import-progress' });
		const progressTrack = progressContainer.createDiv({ cls: 'cr-import-progress__track' });
		this.progressBar = progressTrack.createDiv({ cls: 'cr-import-progress__bar' });
		this.progressBar.setCssProps({ '--progress-width': '0%' });

		// Progress text
		this.progressText = contentEl.createDiv({
			cls: 'cr-import-progress__text',
			text: 'Starting…'
		});

		// Stats container (shows running totals)
		this.statsContainer = contentEl.createDiv({ cls: 'cr-import-running-stats' });
		this.updateStatsDisplay();

		// Cancel button
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });
		this.cancelButton = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'mod-warning'
		});
		this.cancelButton.addEventListener('click', () => {
			this.isCancelled = true;
			if (this.cancelButton) {
				this.cancelButton.disabled = true;
				this.cancelButton.textContent = 'Cancelling...';
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Check if the user requested cancellation
	 */
	wasCancelled(): boolean {
		return this.isCancelled;
	}

	/**
	 * Update the progress display
	 */
	updateProgress(progress: BulkLinkProgress): void {
		if (!this.progressBar || !this.progressText || !this.phaseLabel) return;

		// Update progress bar
		const percentage = progress.total > 0
			? Math.round((progress.current / progress.total) * 100)
			: 0;
		this.progressBar.setCssProps({ '--progress-width': `${percentage}%` });

		// Update progress text
		if (progress.currentEntityName) {
			this.progressText.textContent = `${progress.current} of ${progress.total}: ${progress.currentEntityName}`;
		} else {
			this.progressText.textContent = `${progress.current} of ${progress.total}`;
		}
	}

	/**
	 * Record a successful link operation
	 */
	recordSuccess(): void {
		this.successCount++;
		this.updateStatsDisplay();
	}

	/**
	 * Record a failed link operation
	 */
	recordError(): void {
		this.errorCount++;
		this.updateStatsDisplay();
	}

	/**
	 * Mark linking as complete
	 */
	markComplete(): void {
		if (!this.progressBar || !this.progressText || !this.phaseLabel || !this.phaseIcon) return;

		this.phaseIcon.empty();
		setIcon(this.phaseIcon, 'check');
		this.phaseIcon.addClass('cr-icon--success');

		if (this.isCancelled) {
			this.phaseLabel.textContent = 'Cancelled';
			this.progressText.textContent = 'Operation cancelled by user';
		} else {
			this.phaseLabel.textContent = 'Complete';
			this.progressBar.setCssProps({ '--progress-width': '100%' });
			this.progressText.textContent = 'Done!';
		}

		// Change cancel button to close button
		if (this.cancelButton) {
			this.cancelButton.textContent = 'Close';
			this.cancelButton.disabled = false;
			this.cancelButton.removeClass('mod-warning');
			this.cancelButton.onclick = () => this.close();
		}
	}

	/**
	 * Update the stats display
	 */
	private updateStatsDisplay(): void {
		if (!this.statsContainer) return;

		this.statsContainer.empty();

		// Media files being linked
		const mediaStatEl = this.statsContainer.createDiv({ cls: 'cr-import-stat' });
		setIcon(mediaStatEl.createSpan(), 'image');
		mediaStatEl.createEl('span', { text: `${this.mediaCount} media file${this.mediaCount !== 1 ? 's' : ''}` });

		// Success count
		if (this.successCount > 0) {
			const successStatEl = this.statsContainer.createDiv({ cls: 'cr-import-stat' });
			setIcon(successStatEl.createSpan(), 'check');
			successStatEl.createEl('span', { text: `${this.successCount} linked` });
		}

		// Error count
		if (this.errorCount > 0) {
			const errorStatEl = this.statsContainer.createDiv({ cls: 'cr-import-stat' });
			setIcon(errorStatEl.createSpan(), 'alert-circle');
			errorStatEl.createEl('span', { text: `${this.errorCount} failed` });
		}
	}
}
