import { App, Modal, TFolder, TFile } from 'obsidian';
import { RelationshipValidator, ValidationResult } from '../core/relationship-validator';
import { createLucideIcon } from './lucide-icons';

/**
 * Modal to display folder-wide validation scan results
 */
export class FolderScanModal extends Modal {
	private folder: TFolder;
	private validator: RelationshipValidator;
	private results: ValidationResult[] = [];

	constructor(app: App, folder: TFolder) {
		super(app);
		this.folder = folder;
		this.validator = new RelationshipValidator(app);
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class
		this.modalEl.addClass('cr-folder-scan-modal');

		// Title
		contentEl.createEl('h2', {
			text: `Scan: ${this.folder.name}`,
			cls: 'crc-modal-title'
		});

		// Scanning message
		const loadingEl = contentEl.createDiv({ cls: 'cr-scan-loading' });
		loadingEl.createEl('p', {
			text: 'Scanning person notes...',
			cls: 'cr-text-muted'
		});

		try {
			// Find all person notes in folder (recursively)
			const personNotes = await this.findPersonNotes(this.folder);

			if (personNotes.length === 0) {
				loadingEl.remove();
				this.showNoPersonNotes(contentEl);
				return;
			}

			// Validate each person note
			for (const file of personNotes) {
				const result = await this.validator.validatePersonNote(file);
				this.results.push(result);
			}

			loadingEl.remove();
			this.showResults(contentEl);
		} catch (error) {
			loadingEl.remove();
			contentEl.createEl('p', {
				text: 'Error scanning folder',
				cls: 'cr-text-error'
			});
			console.error('Folder scan error:', error);
		}
	}

	private async findPersonNotes(folder: TFolder): Promise<TFile[]> {
		const personNotes: TFile[] = [];

		const processFolder = (currentFolder: TFolder) => {
			for (const child of currentFolder.children) {
				if (child instanceof TFile && child.extension === 'md') {
					const cache = this.app.metadataCache.getFileCache(child);
					if (cache?.frontmatter?.cr_id) {
						personNotes.push(child);
					}
				} else if (child instanceof TFolder) {
					processFolder(child);
				}
			}
		};

		processFolder(folder);
		return personNotes;
	}

	private showNoPersonNotes(container: HTMLElement) {
		const emptyState = container.createDiv({ cls: 'cr-scan-empty' });

		const icon = createLucideIcon('users', 48);
		icon.addClass('cr-icon--muted');
		emptyState.appendChild(icon);

		emptyState.createEl('p', {
			text: 'No person notes found',
			cls: 'cr-scan-empty__title'
		});

		emptyState.createEl('p', {
			text: 'This folder does not contain any person notes with cr_id fields.',
			cls: 'cr-scan-empty__description'
		});

		// Close button
		const buttonContainer = container.createDiv({ cls: 'cr-modal-buttons' });
		const closeBtn = buttonContainer.createEl('button', {
			cls: 'crc-btn crc-btn--primary',
			text: 'Close'
		});
		closeBtn.addEventListener('click', () => {
			this.close();
		});
	}

	private showResults(container: HTMLElement) {
		const totalNotes = this.results.length;
		const notesWithIssues = this.results.filter(r => !r.isValid).length;
		const totalIssues = this.results.reduce((sum, r) => sum + r.issues.length, 0);

		// Summary
		const summary = container.createDiv({ cls: 'cr-scan-summary' });

		// Summary stats
		const stats = summary.createDiv({ cls: 'cr-scan-stats' });

		const totalStat = stats.createDiv({ cls: 'cr-scan-stat' });
		totalStat.createEl('div', {
			text: totalNotes.toString(),
			cls: 'cr-scan-stat__value'
		});
		totalStat.createEl('div', {
			text: 'person notes',
			cls: 'cr-scan-stat__label'
		});

		const issuesStat = stats.createDiv({ cls: 'cr-scan-stat' });
		issuesStat.createEl('div', {
			text: notesWithIssues.toString(),
			cls: 'cr-scan-stat__value cr-scan-stat__value--' + (notesWithIssues > 0 ? 'warning' : 'success')
		});
		issuesStat.createEl('div', {
			text: 'with issues',
			cls: 'cr-scan-stat__label'
		});

		const totalIssuesStat = stats.createDiv({ cls: 'cr-scan-stat' });
		totalIssuesStat.createEl('div', {
			text: totalIssues.toString(),
			cls: 'cr-scan-stat__value cr-scan-stat__value--' + (totalIssues > 0 ? 'error' : 'success')
		});
		totalIssuesStat.createEl('div', {
			text: 'total issues',
			cls: 'cr-scan-stat__label'
		});

		// Results list (only show notes with issues)
		if (notesWithIssues > 0) {
			const resultsHeader = container.createEl('h3', {
				text: 'Notes with issues',
				cls: 'cr-scan-results-header'
			});

			const resultsList = container.createDiv({ cls: 'cr-scan-results' });

			this.results
				.filter(r => !r.isValid)
				.forEach(result => {
					const resultItem = resultsList.createDiv({ cls: 'cr-scan-result' });

					// Person name and issue count
					const resultHeader = resultItem.createDiv({ cls: 'cr-scan-result__header' });

					const icon = createLucideIcon('alert-triangle', 16);
					icon.addClass('cr-icon--warning');
					resultHeader.appendChild(icon);

					resultHeader.createEl('span', {
						text: result.personName,
						cls: 'cr-scan-result__name'
					});

					const issueBadge = resultHeader.createEl('span', {
						text: `${result.issues.length} issue${result.issues.length === 1 ? '' : 's'}`,
						cls: 'cr-scan-result__badge'
					});

					// Issue list
					const issueList = resultItem.createDiv({ cls: 'cr-scan-result__issues' });
					result.issues.forEach(issue => {
						const issueEl = issueList.createDiv({ cls: 'cr-scan-issue' });
						issueEl.createEl('span', {
							text: `${issue.field}: `,
							cls: 'cr-scan-issue__field'
						});
						issueEl.createEl('span', {
							text: issue.message,
							cls: 'cr-scan-issue__message'
						});
					});

					// Click to open file
					resultItem.addClass('cr-scan-result--clickable');
					resultItem.addEventListener('click', async () => {
						const leaf = this.app.workspace.getLeaf(false);
						await leaf.openFile(result.file);
						this.close();
					});
				});
		}

		// Close button
		const buttonContainer = container.createDiv({ cls: 'cr-modal-buttons' });
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
}
