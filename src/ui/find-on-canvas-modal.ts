import { App, Modal, Notice } from 'obsidian';
import { CanvasSearchResult, CanvasFinder } from '../core/canvas-finder';
import { createLucideIcon } from './lucide-icons';

/**
 * Modal to display canvases containing a specific person
 */
export class FindOnCanvasModal extends Modal {
	private personName: string;
	private crId: string;
	private results: CanvasSearchResult[] = [];
	private finder: CanvasFinder;

	constructor(app: App, personName: string, crId: string) {
		super(app);
		this.personName = personName;
		this.crId = crId;
		this.finder = new CanvasFinder(app);
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class
		this.modalEl.addClass('cr-find-on-canvas-modal');

		// Title
		contentEl.createEl('h2', {
			text: `Find "${this.personName}" on canvas`,
			cls: 'crc-modal-title'
		});

		// Search for canvases
		const loadingEl = contentEl.createDiv({ cls: 'cr-find-loading' });
		loadingEl.createEl('p', {
			text: 'Searching canvases...',
			cls: 'cr-text-muted'
		});

		try {
			this.results = await this.finder.findCanvasesWithPerson(this.crId);
			loadingEl.remove();

			if (this.results.length === 0) {
				this.showNoResults(contentEl);
			} else {
				this.showResults(contentEl);
			}
		} catch (error) {
			loadingEl.remove();
			contentEl.createEl('p', {
				text: 'Error searching canvases',
				cls: 'cr-text-error'
			});
			console.error('Canvas search error:', error);
		}
	}

	private showNoResults(container: HTMLElement) {
		const emptyState = container.createDiv({ cls: 'cr-find-empty' });

		const icon = createLucideIcon('search', 48);
		icon.addClass('cr-icon--muted');
		emptyState.appendChild(icon);

		emptyState.createEl('p', {
			text: 'Not found on any canvas',
			cls: 'cr-find-empty__title'
		});

		emptyState.createEl('p', {
			text: 'This person does not appear on any family tree canvases.',
			cls: 'cr-find-empty__description'
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
		// Summary
		const summary = container.createDiv({ cls: 'cr-find-summary' });
		summary.createEl('p', {
			text: `Found on ${this.results.length} canvas${this.results.length === 1 ? '' : 'es'}`,
			cls: 'cr-find-summary__text'
		});

		// Results list
		const resultsList = container.createDiv({ cls: 'cr-find-results' });

		this.results.forEach(result => {
			const resultItem = resultsList.createDiv({ cls: 'cr-find-result' });

			// Canvas icon and name
			const resultHeader = resultItem.createDiv({ cls: 'cr-find-result__header' });
			const canvasIcon = createLucideIcon('layout', 16);
			resultHeader.appendChild(canvasIcon);

			const nameSpan = resultHeader.createEl('span', {
				text: result.canvasFile.basename,
				cls: 'cr-find-result__name'
			});

			// Result metadata
			const resultMeta = resultItem.createDiv({ cls: 'cr-find-result__meta' });

			// Node count badge
			const nodeCountBadge = resultMeta.createEl('span', {
				text: `${result.nodeCount} people`,
				cls: 'cr-find-result__badge'
			});

			// Tree type if available
			if (result.treeType) {
				const treeTypeBadge = resultMeta.createEl('span', {
					text: result.treeType,
					cls: 'cr-find-result__badge cr-find-result__badge--tree-type'
				});
			}

			// Root person if available
			if (result.rootPerson) {
				resultMeta.createEl('span', {
					text: `Root: ${result.rootPerson}`,
					cls: 'cr-find-result__root'
				});
			}

			// Click to open
			resultItem.addClass('cr-find-result--clickable');
			resultItem.addEventListener('click', async () => {
				await this.finder.openCanvas(result.canvasFile);
				this.close();
				new Notice(`Opened ${result.canvasFile.basename}`);
			});
		});

		// Close button
		const buttonContainer = container.createDiv({ cls: 'cr-modal-buttons' });
		const closeBtn = buttonContainer.createEl('button', {
			cls: 'crc-btn crc-btn--secondary',
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
