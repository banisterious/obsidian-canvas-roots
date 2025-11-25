import { App, Modal } from 'obsidian';
import { GedcomImportResult } from '../gedcom/gedcom-importer';
import { GedcomValidationResult } from '../gedcom/gedcom-parser';
import { createLucideIcon } from './lucide-icons';

/**
 * Modal to display GEDCOM import results with errors and warnings
 */
export class GedcomImportResultsModal extends Modal {
	private result: GedcomImportResult;
	private validation?: GedcomValidationResult;

	constructor(app: App, result: GedcomImportResult, validation?: GedcomValidationResult) {
		super(app);
		this.result = result;
		this.validation = validation;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class
		this.modalEl.addClass('cr-import-results-modal');

		// Title
		contentEl.createEl('h2', {
			text: 'GEDCOM Import Results',
			cls: 'crc-modal-title'
		});

		// Summary stats
		const statsDiv = contentEl.createDiv({ cls: 'cr-import-stats' });

		const successIcon = this.result.success ? createLucideIcon('check', 24) : createLucideIcon('alert-circle', 24);
		successIcon.addClass(this.result.success ? 'cr-icon--success' : 'cr-icon--error');
		statsDiv.appendChild(successIcon);

		const statsText = statsDiv.createDiv({ cls: 'cr-import-stats__text' });
		statsText.createEl('div', {
			text: this.result.success ? 'Import completed' : 'Import completed with errors',
			cls: 'cr-import-stats__status'
		});

		const detailsText = statsText.createEl('div', { cls: 'cr-import-stats__details' });
		detailsText.createEl('span', {
			text: `${this.result.individualsImported} people imported`
		});
		detailsText.createEl('span', {
			text: ` • ${this.result.familiesCreated} families`
		});

		// Validation info
		if (this.validation) {
			const valInfo = contentEl.createDiv({ cls: 'cr-import-validation-info' });
			valInfo.createEl('strong', { text: 'File validation:' });
			valInfo.createEl('span', {
				text: ` ${this.validation.stats.individualCount} individuals, ${this.validation.stats.familyCount} families`
			});
			if (this.validation.stats.version) {
				valInfo.createEl('span', {
					text: ` • Version ${this.validation.stats.version}`
				});
			}
		}

		// Warnings
		if (this.validation && this.validation.warnings.length > 0) {
			const warningsSection = contentEl.createDiv({ cls: 'cr-import-section' });
			const warningsHeader = warningsSection.createDiv({ cls: 'cr-import-section__header' });
			const warnIcon = createLucideIcon('alert-triangle', 18);
			warnIcon.addClass('cr-icon--warning');
			warningsHeader.appendChild(warnIcon);
			warningsHeader.createEl('span', {
				text: ` ${this.validation.warnings.length} Warning${this.validation.warnings.length === 1 ? '' : 's'}`,
				cls: 'cr-import-section__title'
			});

			const warningsList = warningsSection.createDiv({ cls: 'cr-import-issues-list' });
			this.validation.warnings.forEach((warning) => {
				const item = warningsList.createDiv({ cls: 'cr-import-issue' });
				item.createEl('span', { text: warning.message });
				if (warning.line) {
					item.createEl('span', {
						text: ` (line ${warning.line})`,
						cls: 'cr-import-issue__line'
					});
				}
			});
		}

		// Errors
		if (this.result.errors.length > 0) {
			const errorsSection = contentEl.createDiv({ cls: 'cr-import-section' });
			const errorsHeader = errorsSection.createDiv({ cls: 'cr-import-section__header' });
			const errorIcon = createLucideIcon('x', 18);
			errorIcon.addClass('cr-icon--error');
			errorsHeader.appendChild(errorIcon);
			errorsHeader.createEl('span', {
				text: ` ${this.result.errors.length} Error${this.result.errors.length === 1 ? '' : 's'}`,
				cls: 'cr-import-section__title'
			});

			const errorsList = errorsSection.createDiv({ cls: 'cr-import-issues-list' });
			this.result.errors.forEach((error) => {
				const item = errorsList.createDiv({ cls: 'cr-import-issue cr-import-issue--error' });
				item.createEl('span', { text: error });
			});
		}

		// Success message
		if (this.result.success && this.result.errors.length === 0 && (!this.validation || this.validation.warnings.length === 0)) {
			const successMsg = contentEl.createDiv({ cls: 'cr-import-success-message' });
			successMsg.createEl('p', {
				text: 'All individuals and families were imported successfully with no issues.'
			});
		}

		// Close button
		const buttonContainer = contentEl.createDiv({ cls: 'cr-modal-buttons' });
		const closeBtn = buttonContainer.createEl('button', {
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
