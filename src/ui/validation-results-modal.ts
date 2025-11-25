import { App, Modal } from 'obsidian';
import { ValidationResult, ValidationIssue } from '../core/relationship-validator';
import { createLucideIcon } from './lucide-icons';

/**
 * Modal to display relationship validation results
 */
export class ValidationResultsModal extends Modal {
	private result: ValidationResult;

	constructor(app: App, result: ValidationResult) {
		super(app);
		this.result = result;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class
		this.modalEl.addClass('cr-validation-results-modal');

		// Title
		contentEl.createEl('h2', {
			text: `Validation: ${this.result.personName}`,
			cls: 'crc-modal-title'
		});

		// Summary
		const summary = contentEl.createDiv({ cls: 'cr-validation-summary' });

		if (this.result.isValid) {
			const successIcon = createLucideIcon('check', 20);
			successIcon.addClass('cr-icon--success');
			summary.appendChild(successIcon);
			summary.createEl('span', {
				text: ' No issues found',
				cls: 'cr-validation-summary__text'
			});
			summary.addClass('cr-text--success');
		} else {
			const errorIcon = createLucideIcon('alert-circle', 20);
			errorIcon.addClass('cr-icon--error');
			summary.appendChild(errorIcon);
			summary.createEl('span', {
				text: ` Found ${this.result.issues.length} issue${this.result.issues.length === 1 ? '' : 's'}`,
				cls: 'cr-validation-summary__text'
			});
			summary.addClass('cr-text--error');
		}

		// Issues list
		if (this.result.issues.length > 0) {
			const issuesList = contentEl.createDiv({ cls: 'cr-validation-issues' });

			this.result.issues.forEach((issue, index) => {
				const issueItem = issuesList.createDiv({ cls: 'cr-validation-issue' });

				// Issue icon and number
				const issueHeader = issueItem.createDiv({ cls: 'cr-validation-issue__header' });
				const warningIcon = createLucideIcon('alert-triangle', 16);
				warningIcon.addClass('cr-icon--warning');
				issueHeader.appendChild(warningIcon);
				issueHeader.createEl('span', {
					text: ` Issue ${index + 1}`,
					cls: 'cr-validation-issue__number'
				});

				// Issue details
				const issueBody = issueItem.createDiv({ cls: 'cr-validation-issue__body' });

				issueBody.createEl('div', {
					text: issue.message,
					cls: 'cr-validation-issue__message'
				});

				issueBody.createEl('div', {
					text: `Field: ${issue.field}`,
					cls: 'cr-validation-issue__field'
				});

				if (issue.referencedCrId) {
					issueBody.createEl('div', {
						text: `Referenced cr_id: ${issue.referencedCrId}`,
						cls: 'cr-validation-issue__ref'
					});
				}

				// Issue type badge
				const typeBadge = issueBody.createEl('span', {
					text: this.getIssueTypeLabel(issue.type),
					cls: 'cr-validation-issue__type-badge'
				});
			});
		}

		// Close button
		const buttonContainer = contentEl.createDiv({ cls: 'cr-modal-buttons' });
		const closeBtn = buttonContainer.createEl('button', {
			cls: 'crc-btn crc-btn--primary',
			text: 'Close'
		});
		closeBtn.addEventListener('click', () => {
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Get human-readable label for issue type
	 */
	private getIssueTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			'broken-father-ref': 'Broken Father Reference',
			'broken-mother-ref': 'Broken Mother Reference',
			'broken-spouse-ref': 'Broken Spouse Reference',
			'broken-child-ref': 'Broken Child Reference',
			'missing-bidirectional-parent': 'Missing Bidirectional (Parent)',
			'missing-bidirectional-spouse': 'Missing Bidirectional (Spouse)',
			'missing-bidirectional-child': 'Missing Bidirectional (Child)'
		};
		return labels[type] || type;
	}
}
