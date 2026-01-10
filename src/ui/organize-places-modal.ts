/**
 * Modal for organizing places into category-appropriate folders (#163)
 * Shows places in wrong folders and allows bulk migration
 */

import { App, Modal, Notice, TFile, normalizePath } from 'obsidian';
import { createLucideIcon } from './lucide-icons';
import { PlaceGraphService } from '../core/place-graph';
import type { PlaceNode, PlaceIssue } from '../models/place';
import type { CanvasRootsSettings } from '../settings';
import { getPlaceFolderForCategory } from '../settings';

interface MisplacedPlace {
	place: PlaceNode;
	currentFolder: string;
	expectedFolder: string;
	issue: PlaceIssue;
}

interface OrganizePlacesOptions {
	settings: CanvasRootsSettings;
	onComplete?: (moved: number, failed: number) => void;
}

/**
 * Modal for organizing places into their category-appropriate folders
 */
export class OrganizePlacesModal extends Modal {
	private settings: CanvasRootsSettings;
	private misplacedPlaces: MisplacedPlace[];
	private selectedPlaces: Set<string>; // Set of place IDs to move
	private onComplete?: (moved: number, failed: number) => void;
	private placeListContainer: HTMLElement | null = null;
	private selectionCountEl: HTMLElement | null = null;

	constructor(
		app: App,
		misplacedPlaces: MisplacedPlace[],
		options: OrganizePlacesOptions
	) {
		super(app);
		this.settings = options.settings;
		this.misplacedPlaces = misplacedPlaces;
		this.selectedPlaces = new Set();
		this.onComplete = options.onComplete;

		// Pre-select all places by default
		for (const mp of misplacedPlaces) {
			this.selectedPlaces.add(mp.place.id);
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-organize-places-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('folder', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Organize places by category');

		// Description
		contentEl.createEl('p', {
			text: `Found ${this.misplacedPlaces.length} place${this.misplacedPlaces.length !== 1 ? 's' : ''} not stored in their category-appropriate folder.`,
			cls: 'crc-text--muted'
		});

		// Warning callout
		const warning = contentEl.createDiv({ cls: 'crc-info-box crc-info-box--warning' });
		const warningIcon = createLucideIcon('alert-triangle', 16);
		warningIcon.addClass('crc-info-box-icon');
		warning.appendChild(warningIcon);
		warning.createSpan({
			text: 'Moving files may affect wikilinks if they use full paths. Obsidian will automatically update links for most cases.'
		});

		// Selection controls
		const controlsRow = contentEl.createDiv({ cls: 'crc-controls-row crc-mb-3 crc-mt-3' });

		const selectAllBtn = controlsRow.createEl('button', {
			text: 'Select all',
			cls: 'crc-btn crc-btn--small'
		});
		selectAllBtn.addEventListener('click', () => {
			this.selectAll();
			this.renderPlaceList();
		});

		const selectNoneBtn = controlsRow.createEl('button', {
			text: 'Select none',
			cls: 'crc-btn crc-btn--small crc-ml-2'
		});
		selectNoneBtn.addEventListener('click', () => {
			this.selectNone();
			this.renderPlaceList();
		});

		this.selectionCountEl = controlsRow.createEl('span', {
			cls: 'crc-text--muted crc-ml-3'
		});
		this.updateSelectionCount();

		// Place list container
		this.placeListContainer = contentEl.createDiv({ cls: 'crc-place-list-container' });
		this.renderPlaceList();

		// Action buttons
		const footer = contentEl.createDiv({ cls: 'crc-modal-footer crc-mt-4' });

		const cancelBtn = footer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => this.close());

		const moveBtn = footer.createEl('button', {
			text: `Move ${this.selectedPlaces.size} place${this.selectedPlaces.size !== 1 ? 's' : ''}`,
			cls: 'crc-btn crc-btn--primary crc-ml-2'
		});
		moveBtn.addEventListener('click', () => this.moveSelectedPlaces());

		// Store reference to update button text
		this.moveButton = moveBtn;
	}

	private moveButton: HTMLButtonElement | null = null;

	private selectAll(): void {
		for (const mp of this.misplacedPlaces) {
			this.selectedPlaces.add(mp.place.id);
		}
		this.updateSelectionCount();
	}

	private selectNone(): void {
		this.selectedPlaces.clear();
		this.updateSelectionCount();
	}

	private updateSelectionCount(): void {
		if (this.selectionCountEl) {
			this.selectionCountEl.textContent = `${this.selectedPlaces.size} of ${this.misplacedPlaces.length} selected`;
		}
		if (this.moveButton) {
			this.moveButton.textContent = `Move ${this.selectedPlaces.size} place${this.selectedPlaces.size !== 1 ? 's' : ''}`;
			this.moveButton.disabled = this.selectedPlaces.size === 0;
		}
	}

	private renderPlaceList(): void {
		if (!this.placeListContainer) return;
		this.placeListContainer.empty();

		if (this.misplacedPlaces.length === 0) {
			this.placeListContainer.createEl('p', {
				text: 'All places are in their correct folders!',
				cls: 'crc-text--success'
			});
			return;
		}

		// Table
		const table = this.placeListContainer.createEl('table', { cls: 'crc-place-list-table' });
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: '', cls: 'crc-place-list-th--checkbox' });
		headerRow.createEl('th', { text: 'Place' });
		headerRow.createEl('th', { text: 'Category' });
		headerRow.createEl('th', { text: 'Current folder' });
		headerRow.createEl('th', { text: 'Target folder' });

		const tbody = table.createEl('tbody');

		for (const mp of this.misplacedPlaces) {
			const row = tbody.createEl('tr', { cls: 'crc-place-list-row' });

			// Checkbox cell
			const checkboxCell = row.createEl('td', { cls: 'crc-place-list-td--checkbox' });
			const checkbox = checkboxCell.createEl('input', { type: 'checkbox' });
			checkbox.checked = this.selectedPlaces.has(mp.place.id);
			checkbox.addEventListener('change', () => {
				if (checkbox.checked) {
					this.selectedPlaces.add(mp.place.id);
				} else {
					this.selectedPlaces.delete(mp.place.id);
				}
				this.updateSelectionCount();
			});

			// Make row clickable to toggle checkbox
			row.addEventListener('click', (e) => {
				if (e.target !== checkbox) {
					checkbox.checked = !checkbox.checked;
					if (checkbox.checked) {
						this.selectedPlaces.add(mp.place.id);
					} else {
						this.selectedPlaces.delete(mp.place.id);
					}
					this.updateSelectionCount();
				}
			});

			// Place name
			const nameCell = row.createEl('td', { text: mp.place.name });

			// Category badge
			const categoryCell = row.createEl('td');
			categoryCell.createEl('span', {
				text: mp.place.category.charAt(0).toUpperCase() + mp.place.category.slice(1),
				cls: `crc-category-badge crc-category-badge--${mp.place.category}`
			});

			// Current folder
			const currentCell = row.createEl('td', { cls: 'crc-place-list-td--folder' });
			currentCell.createEl('code', { text: mp.currentFolder || '(root)' });

			// Target folder
			const targetCell = row.createEl('td', { cls: 'crc-place-list-td--folder' });
			const arrowIcon = createLucideIcon('arrow-right', 12);
			targetCell.appendChild(arrowIcon);
			targetCell.createEl('code', { text: mp.expectedFolder, cls: 'crc-ml-1' });
		}
	}

	private async moveSelectedPlaces(): Promise<void> {
		if (this.selectedPlaces.size === 0) {
			new Notice('No places selected');
			return;
		}

		const toMove = this.misplacedPlaces.filter(mp => this.selectedPlaces.has(mp.place.id));
		let moved = 0;
		let failed = 0;

		// Disable the move button while processing
		if (this.moveButton) {
			this.moveButton.disabled = true;
			this.moveButton.textContent = 'Moving...';
		}

		for (const mp of toMove) {
			try {
				const file = this.app.vault.getAbstractFileByPath(mp.place.filePath);
				if (!(file instanceof TFile)) {
					failed++;
					continue;
				}

				// Ensure target folder exists
				const targetFolder = normalizePath(mp.expectedFolder);
				const existingFolder = this.app.vault.getAbstractFileByPath(targetFolder);
				if (!existingFolder) {
					await this.app.vault.createFolder(targetFolder);
				}

				// Build new path
				const filename = file.name;
				const newPath = normalizePath(`${targetFolder}/${filename}`);

				// Check if file already exists at target
				const existingFile = this.app.vault.getAbstractFileByPath(newPath);
				if (existingFile) {
					console.warn(`File already exists at ${newPath}, skipping`);
					failed++;
					continue;
				}

				// Move the file
				await this.app.fileManager.renameFile(file, newPath);
				moved++;
			} catch (error) {
				console.error(`Failed to move ${mp.place.name}:`, error);
				failed++;
			}
		}

		// Report results
		if (moved > 0) {
			new Notice(`✓ Moved ${moved} place${moved !== 1 ? 's' : ''} to category folders`);
		}
		if (failed > 0) {
			new Notice(`⚠ Failed to move ${failed} place${failed !== 1 ? 's' : ''}`);
		}

		// Callback and close
		if (this.onComplete) {
			this.onComplete(moved, failed);
		}
		this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Find places that are in wrong category folders
 * Returns array of misplaced places with current/expected folder info
 */
export function findMisplacedPlaces(
	placeService: PlaceGraphService,
	settings: CanvasRootsSettings
): MisplacedPlace[] {
	if (!settings.useCategorySubfolders) {
		return [];
	}

	const stats = placeService.calculateStatistics();
	const wrongFolderIssues = stats.issues.filter(i => i.type === 'wrong_category_folder');

	const result: MisplacedPlace[] = [];
	const allPlaces = placeService.getAllPlaces();

	for (const issue of wrongFolderIssues) {
		const place = allPlaces.find(p => p.id === issue.placeId);
		if (!place || !place.filePath) continue;

		const currentFolder = place.filePath.substring(0, place.filePath.lastIndexOf('/'));
		const expectedFolder = getPlaceFolderForCategory(settings, place.category);

		result.push({
			place,
			currentFolder,
			expectedFolder,
			issue
		});
	}

	return result;
}
