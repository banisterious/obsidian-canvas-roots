/**
 * Place Generator Modal
 *
 * UI for generating place notes from place strings found in person and event notes.
 * Part of the Data Enhancement Pass feature.
 */

import { App, Modal, Notice, Setting } from 'obsidian';
import { createLucideIcon } from '../../ui/lucide-icons';
import {
	PlaceGeneratorService,
	PlaceGeneratorOptions,
	PlaceGeneratorResult,
	FoundPlace,
	DEFAULT_PLACE_GENERATOR_OPTIONS
} from '../services/place-generator';
import type { CanvasRootsSettings } from '../../settings';

/**
 * Options for the place generator modal
 */
export interface PlaceGeneratorModalOptions {
	/** Callback when generation is complete */
	onComplete?: (result: PlaceGeneratorResult) => void;
}

/**
 * Modal for generating place notes from existing data
 */
export class PlaceGeneratorModal extends Modal {
	private settings: CanvasRootsSettings;
	private modalOptions: PlaceGeneratorModalOptions;
	private service: PlaceGeneratorService;

	// Options state
	private options: PlaceGeneratorOptions;

	// UI state
	private previewResult: PlaceGeneratorResult | null = null;
	private isScanning = false;
	private isGenerating = false;

	// Table state for places list
	private allPlaces: FoundPlace[] = [];
	private filteredPlaces: FoundPlace[] = [];
	private searchQuery = '';
	private sortField: 'name' | 'refs' = 'name';
	private sortAscending = true;
	private currentPage = 0;
	private pageSize = 20;

	// UI elements
	private contentContainer: HTMLElement | null = null;
	private previewButton: HTMLButtonElement | null = null;
	private generateButton: HTMLButtonElement | null = null;
	private progressContainer: HTMLElement | null = null;
	private resultsContainer: HTMLElement | null = null;
	private placesTableBody: HTMLTableSectionElement | null = null;
	private placesCountEl: HTMLElement | null = null;
	private paginationContainer: HTMLElement | null = null;

	constructor(
		app: App,
		settings: CanvasRootsSettings,
		modalOptions: PlaceGeneratorModalOptions = {}
	) {
		super(app);
		this.settings = settings;
		this.modalOptions = modalOptions;
		this.service = new PlaceGeneratorService(app, settings);

		// Initialize options with defaults
		this.options = {
			...DEFAULT_PLACE_GENERATOR_OPTIONS,
			placesFolder: settings.placesFolder || DEFAULT_PLACE_GENERATOR_OPTIONS.placesFolder
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass('cr-place-generator-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('map-pin', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Generate place notes');

		// Description
		const description = contentEl.createDiv({ cls: 'crc-modal-description' });
		description.createEl('p', {
			text: 'Scans person and event notes for place strings (not wikilinks) and creates place notes with proper hierarchy. ' +
				'Optionally updates references to use wikilinks.'
		});

		// Content container
		this.contentContainer = contentEl.createDiv({ cls: 'cr-place-generator-content' });

		// Options section
		this.renderOptionsSection();

		// Progress container (hidden initially)
		this.progressContainer = this.contentContainer.createDiv({ cls: 'cr-place-generator-progress' });
		this.progressContainer.style.display = 'none';

		// Results container
		this.resultsContainer = this.contentContainer.createDiv({ cls: 'cr-place-generator-results' });
		this.renderInitialPrompt();

		// Footer with buttons
		const footer = contentEl.createDiv({ cls: 'crc-modal-footer' });

		this.previewButton = footer.createEl('button', {
			text: 'Preview',
			cls: 'mod-cta'
		});
		this.previewButton.addEventListener('click', () => void this.runPreview());

		this.generateButton = footer.createEl('button', {
			text: 'Generate',
			cls: 'mod-warning'
		});
		this.generateButton.disabled = true;
		this.generateButton.addEventListener('click', () => void this.runGenerate());

		footer.createEl('button', { text: 'Close' })
			.addEventListener('click', () => this.close());
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Render the options section
	 */
	private renderOptionsSection(): void {
		if (!this.contentContainer) return;

		const optionsSection = this.contentContainer.createDiv({ cls: 'cr-place-generator-options' });
		optionsSection.createEl('h3', { text: 'Options' });

		// Scan person notes
		new Setting(optionsSection)
			.setName('Scan person notes')
			.setDesc('Look for birth_place and death_place properties')
			.addToggle(toggle => toggle
				.setValue(this.options.scanPersonNotes)
				.onChange(value => {
					this.options.scanPersonNotes = value;
					this.previewResult = null;
					this.updateButtonStates();
				})
			);

		// Scan event notes
		new Setting(optionsSection)
			.setName('Scan event notes')
			.setDesc('Look for place properties in event notes')
			.addToggle(toggle => toggle
				.setValue(this.options.scanEventNotes)
				.onChange(value => {
					this.options.scanEventNotes = value;
					this.previewResult = null;
					this.updateButtonStates();
				})
			);

		// Parse hierarchy
		new Setting(optionsSection)
			.setName('Parse place hierarchy')
			.setDesc('Create parent places (e.g., "Dublin, Ireland" creates both Dublin and Ireland)')
			.addToggle(toggle => toggle
				.setValue(this.options.parseHierarchy)
				.onChange(value => {
					this.options.parseHierarchy = value;
					this.previewResult = null;
					this.updateButtonStates();
				})
			);

		// Update references
		new Setting(optionsSection)
			.setName('Update references')
			.setDesc('Convert place strings to wikilinks after creating notes')
			.addToggle(toggle => toggle
				.setValue(this.options.updateReferences)
				.onChange(value => {
					this.options.updateReferences = value;
					this.previewResult = null;
					this.updateButtonStates();
				})
			);

		// Places folder
		new Setting(optionsSection)
			.setName('Places folder')
			.setDesc('Where to create new place notes')
			.addText(text => text
				.setValue(this.options.placesFolder)
				.onChange(value => {
					this.options.placesFolder = value || DEFAULT_PLACE_GENERATOR_OPTIONS.placesFolder;
				})
			);
	}

	/**
	 * Render initial prompt before preview
	 */
	private renderInitialPrompt(): void {
		if (!this.resultsContainer) return;

		this.resultsContainer.empty();
		this.resultsContainer.createEl('p', {
			text: 'Click "Preview" to scan for place strings that can be converted to place notes.',
			cls: 'crc-text--muted'
		});
	}

	/**
	 * Run preview scan
	 */
	private async runPreview(): Promise<void> {
		if (this.isScanning || this.isGenerating) return;

		this.isScanning = true;
		this.updateButtonStates();

		// Show progress
		if (this.progressContainer) {
			this.progressContainer.style.display = 'block';
			this.progressContainer.empty();
			this.progressContainer.createEl('p', { text: 'Scanning notes for place strings...' });
		}

		try {
			this.previewResult = await this.service.preview(this.options);
			this.renderPreviewResults();
		} catch (error) {
			console.error('Error scanning for places:', error);
			new Notice('Error scanning notes. Check console for details.');
		} finally {
			this.isScanning = false;
			this.updateButtonStates();
			if (this.progressContainer) {
				this.progressContainer.style.display = 'none';
			}
		}
	}

	/**
	 * Render preview results
	 */
	private renderPreviewResults(): void {
		if (!this.resultsContainer || !this.previewResult) return;

		this.resultsContainer.empty();
		const result = this.previewResult;

		// No places found
		if (result.placesFound === 0) {
			const successMsg = this.resultsContainer.createDiv({ cls: 'crc-success-callout' });
			const successIcon = createLucideIcon('check-circle', 16);
			successMsg.appendChild(successIcon);
			successMsg.appendText(' No place strings found. All places may already be using wikilinks.');
			return;
		}

		// Summary section
		const summary = this.resultsContainer.createDiv({ cls: 'cr-place-generator-summary' });
		summary.createEl('h4', { text: 'Preview summary' });

		const statsGrid = summary.createDiv({ cls: 'cr-place-generator-stats' });

		this.createStatItem(statsGrid, 'map-pin', 'Places found', result.placesFound);
		this.createStatItem(statsGrid, 'plus-circle', 'New notes to create', result.notesCreated);
		this.createStatItem(statsGrid, 'check-circle', 'Existing notes matched', result.existingMatched);

		if (this.options.updateReferences) {
			this.createStatItem(statsGrid, 'link', 'References to update', result.referencesUpdated);
		}

		// Place list section
		const placesSection = this.resultsContainer.createDiv({ cls: 'cr-place-generator-places' });
		placesSection.createEl('h4', { text: 'Places to create' });

		// Filter to show only places that would be new (have referencing files)
		this.allPlaces = result.foundPlaces.filter(p => p.referencingFiles.length > 0);
		this.currentPage = 0;
		this.searchQuery = '';

		if (this.allPlaces.length === 0) {
			placesSection.createEl('p', {
				text: 'No new place notes needed. All places already exist.',
				cls: 'crc-text--muted'
			});
		} else {
			// Count display
			this.placesCountEl = placesSection.createEl('p', { cls: 'crc-batch-count' });

			// Controls row: search + sort
			const controlsRow = placesSection.createDiv({ cls: 'crc-batch-controls' });

			// Search input
			const searchContainer = controlsRow.createDiv({ cls: 'crc-batch-search' });
			const searchInput = searchContainer.createEl('input', {
				type: 'text',
				placeholder: 'Search places...',
				cls: 'crc-batch-search-input'
			});
			searchInput.addEventListener('input', () => {
				this.searchQuery = searchInput.value.toLowerCase();
				this.currentPage = 0;
				this.applyFiltersAndSort();
			});

			// Sort dropdown
			const sortContainer = controlsRow.createDiv({ cls: 'crc-batch-filter' });
			const sortSelect = sortContainer.createEl('select', { cls: 'crc-batch-filter-select' });
			sortSelect.createEl('option', { text: 'Sort by name', value: 'name' });
			sortSelect.createEl('option', { text: 'Sort by references', value: 'refs' });
			sortSelect.addEventListener('change', () => {
				this.sortField = sortSelect.value as 'name' | 'refs';
				this.applyFiltersAndSort();
			});

			// Sort direction toggle
			const sortDirContainer = controlsRow.createDiv({ cls: 'crc-batch-sort' });
			const sortDirBtn = sortDirContainer.createEl('button', {
				text: 'A→Z',
				cls: 'crc-batch-sort-btn'
			});
			sortDirBtn.addEventListener('click', () => {
				this.sortAscending = !this.sortAscending;
				sortDirBtn.textContent = this.sortAscending ? 'A→Z' : 'Z→A';
				this.applyFiltersAndSort();
			});

			// Scrollable table container
			const tableContainer = placesSection.createDiv({ cls: 'crc-batch-table-container' });
			const table = tableContainer.createEl('table', { cls: 'crc-batch-preview-table' });
			const thead = table.createEl('thead');
			const headerRow = thead.createEl('tr');
			headerRow.createEl('th', { text: 'Place' });
			headerRow.createEl('th', { text: 'References' });
			if (this.options.parseHierarchy) {
				headerRow.createEl('th', { text: 'Hierarchy' });
			}
			headerRow.createEl('th', { text: '', cls: 'cr-place-generator-action-header' });

			this.placesTableBody = table.createEl('tbody');

			// Pagination container
			this.paginationContainer = placesSection.createDiv({ cls: 'cr-place-generator-pagination' });

			// Initial render
			this.applyFiltersAndSort();
		}

		// Warning callout
		const warning = this.resultsContainer.createDiv({ cls: 'crc-warning-callout' });
		const warningIcon = createLucideIcon('alert-triangle', 16);
		warning.appendChild(warningIcon);
		warning.createSpan({
			text: ' Backup your vault before proceeding. This operation will create new files and modify existing notes.'
		});

		this.updateButtonStates();
	}

	/**
	 * Apply filters and sorting, then re-render the table
	 */
	private applyFiltersAndSort(): void {
		// Filter
		this.filteredPlaces = this.allPlaces.filter(place => {
			if (this.searchQuery && !place.placeString.toLowerCase().includes(this.searchQuery)) {
				return false;
			}
			return true;
		});

		// Sort
		this.filteredPlaces.sort((a, b) => {
			let cmp: number;
			if (this.sortField === 'refs') {
				cmp = a.referencingFiles.length - b.referencingFiles.length;
			} else {
				cmp = a.placeString.localeCompare(b.placeString);
			}
			return this.sortAscending ? cmp : -cmp;
		});

		// Update count
		if (this.placesCountEl) {
			if (this.filteredPlaces.length === this.allPlaces.length) {
				this.placesCountEl.textContent = `${this.allPlaces.length} place${this.allPlaces.length === 1 ? '' : 's'} to create:`;
			} else {
				this.placesCountEl.textContent = `Showing ${this.filteredPlaces.length} of ${this.allPlaces.length} places:`;
			}
		}

		// Re-render table and pagination
		this.renderPlacesTable();
		this.renderPagination();
	}

	/**
	 * Render the places table for the current page
	 */
	private renderPlacesTable(): void {
		if (!this.placesTableBody) return;

		this.placesTableBody.empty();

		const startIdx = this.currentPage * this.pageSize;
		const endIdx = Math.min(startIdx + this.pageSize, this.filteredPlaces.length);
		const pageItems = this.filteredPlaces.slice(startIdx, endIdx);

		for (const place of pageItems) {
			const row = this.placesTableBody.createEl('tr');

			// Place name
			row.createEl('td', { text: place.placeString });

			// Reference count
			row.createEl('td', {
				text: String(place.referencingFiles.length),
				cls: 'cr-place-generator-refs-cell'
			});

			// Hierarchy (if enabled)
			if (this.options.parseHierarchy) {
				row.createEl('td', {
					text: place.hierarchyParts.length > 1 ? place.hierarchyParts.join(' → ') : '—',
					cls: 'crc-text--muted'
				});
			}

			// Action button
			const actionCell = row.createEl('td', { cls: 'cr-place-generator-action-cell' });
			const createBtn = actionCell.createEl('button', {
				text: 'Create',
				cls: 'cr-place-generator-create-btn'
			});
			createBtn.addEventListener('click', () => {
				void this.generateSinglePlace(place, row, createBtn);
			});
		}

		// Empty state
		if (pageItems.length === 0 && this.allPlaces.length > 0) {
			const row = this.placesTableBody.createEl('tr');
			const cell = row.createEl('td', {
				text: 'No matches found',
				cls: 'crc-text--muted'
			});
			cell.setAttribute('colspan', this.options.parseHierarchy ? '4' : '3');
			cell.style.textAlign = 'center';
		}
	}

	/**
	 * Render pagination controls
	 */
	private renderPagination(): void {
		if (!this.paginationContainer) return;

		this.paginationContainer.empty();

		const totalPages = Math.ceil(this.filteredPlaces.length / this.pageSize);

		if (totalPages <= 1) {
			return;
		}

		// Previous button
		const prevBtn = this.paginationContainer.createEl('button', {
			text: '← Prev',
			cls: 'cr-place-generator-page-btn'
		});
		prevBtn.disabled = this.currentPage === 0;
		prevBtn.addEventListener('click', () => {
			if (this.currentPage > 0) {
				this.currentPage--;
				this.renderPlacesTable();
				this.renderPagination();
			}
		});

		// Page info
		const startItem = this.currentPage * this.pageSize + 1;
		const endItem = Math.min((this.currentPage + 1) * this.pageSize, this.filteredPlaces.length);
		this.paginationContainer.createSpan({
			text: `${startItem}–${endItem} of ${this.filteredPlaces.length}`,
			cls: 'cr-place-generator-page-info'
		});

		// Next button
		const nextBtn = this.paginationContainer.createEl('button', {
			text: 'Next →',
			cls: 'cr-place-generator-page-btn'
		});
		nextBtn.disabled = this.currentPage >= totalPages - 1;
		nextBtn.addEventListener('click', () => {
			if (this.currentPage < totalPages - 1) {
				this.currentPage++;
				this.renderPlacesTable();
				this.renderPagination();
			}
		});
	}

	/**
	 * Generate a single place note
	 */
	private async generateSinglePlace(
		place: FoundPlace,
		row: HTMLTableRowElement,
		button: HTMLButtonElement
	): Promise<void> {
		// Disable button and show loading state
		button.disabled = true;
		button.textContent = '...';
		button.addClass('cr-place-generator-create-btn--loading');

		try {
			// Generate just this one place
			const result = await this.service.generateSinglePlace(place, this.options);

			if (result.success) {
				// Mark row as completed
				row.addClass('cr-place-generator-row--created');
				button.textContent = '✓';
				button.addClass('cr-place-generator-create-btn--done');

				// Remove from allPlaces so it won't show on re-render
				const idx = this.allPlaces.findIndex(p => p.placeString === place.placeString);
				if (idx !== -1) {
					this.allPlaces.splice(idx, 1);
				}

				// Update the count display
				if (this.placesCountEl && this.previewResult) {
					this.previewResult.notesCreated--;
					const remaining = this.allPlaces.length;
					this.placesCountEl.textContent = `${remaining} place${remaining === 1 ? '' : 's'} to create:`;
				}

				new Notice(`Created place note: ${place.placeString}`);
			} else {
				// Show error state
				button.textContent = '✗';
				button.addClass('cr-place-generator-create-btn--error');
				new Notice(`Failed to create ${place.placeString}: ${result.error}`);
			}
		} catch (error) {
			console.error('Error generating single place:', error);
			button.textContent = '✗';
			button.addClass('cr-place-generator-create-btn--error');
			new Notice(`Error creating ${place.placeString}`);
		}
	}

	/**
	 * Create a stat item
	 */
	private createStatItem(
		container: HTMLElement,
		iconName: 'map-pin' | 'plus-circle' | 'check-circle' | 'link' | 'file-text',
		label: string,
		value: number
	): void {
		const item = container.createDiv({ cls: 'cr-place-generator-stat-item' });
		const icon = createLucideIcon(iconName, 16);
		item.appendChild(icon);
		item.createSpan({ text: `${label}: ` });
		item.createSpan({ text: String(value), cls: 'cr-place-generator-stat-value' });
	}

	/**
	 * Run place generation
	 */
	private async runGenerate(): Promise<void> {
		if (this.isScanning || this.isGenerating || !this.previewResult) return;

		// Confirm before proceeding
		if (this.previewResult.notesCreated > 0 || this.previewResult.referencesUpdated > 0) {
			const confirmMessage = `This will create ${this.previewResult.notesCreated} place note(s)`;
			const updateMessage = this.options.updateReferences
				? ` and update ${this.previewResult.referencesUpdated} reference(s)`
				: '';
			const proceed = confirm(`${confirmMessage}${updateMessage}. Continue?`);
			if (!proceed) return;
		}

		this.isGenerating = true;
		this.updateButtonStates();

		// Show progress
		if (this.progressContainer) {
			this.progressContainer.style.display = 'block';
			this.progressContainer.empty();
		}

		try {
			const result = await this.service.generate({
				...this.options,
				dryRun: false
			});

			this.renderGenerationResults(result);

			// Callback
			if (this.modalOptions.onComplete) {
				this.modalOptions.onComplete(result);
			}

			// Success notice
			if (result.errors.length === 0) {
				new Notice(`Created ${result.notesCreated} place note(s), updated ${result.referencesUpdated} reference(s).`);
			} else {
				new Notice(`Completed with ${result.errors.length} error(s). Check console for details.`);
			}

		} catch (error) {
			console.error('Error generating place notes:', error);
			new Notice('Error generating place notes. Check console for details.');
		} finally {
			this.isGenerating = false;
			this.updateButtonStates();
			if (this.progressContainer) {
				this.progressContainer.style.display = 'none';
			}
		}
	}

	/**
	 * Render generation results
	 */
	private renderGenerationResults(result: PlaceGeneratorResult): void {
		if (!this.resultsContainer) return;

		this.resultsContainer.empty();

		// Success header
		const header = this.resultsContainer.createDiv({ cls: 'cr-place-generator-complete-header' });
		const successIcon = createLucideIcon('check-circle', 24);
		header.appendChild(successIcon);
		header.createEl('h4', { text: 'Generation complete' });

		// Stats grid
		const statsGrid = this.resultsContainer.createDiv({ cls: 'cr-place-generator-stats' });

		this.createStatItem(statsGrid, 'plus-circle', 'Notes created', result.notesCreated);
		this.createStatItem(statsGrid, 'check-circle', 'Existing matched', result.existingMatched);
		this.createStatItem(statsGrid, 'link', 'References updated', result.referencesUpdated);
		this.createStatItem(statsGrid, 'file-text', 'Files modified', result.filesModified);

		// Errors section
		if (result.errors.length > 0) {
			const errorsSection = this.resultsContainer.createDiv({ cls: 'cr-place-generator-errors' });
			errorsSection.createEl('h4', { text: 'Errors' });

			const errorList = errorsSection.createEl('ul', { cls: 'cr-place-generator-error-list' });
			for (const error of result.errors.slice(0, 10)) {
				errorList.createEl('li', {
					text: `${error.place}: ${error.error}`,
					cls: 'crc-text--error'
				});
			}

			if (result.errors.length > 10) {
				errorList.createEl('li', {
					text: `... and ${result.errors.length - 10} more errors`,
					cls: 'crc-text--muted'
				});
			}
		}

		// Created notes section
		if (result.placeNotes.length > 0) {
			const notesSection = this.resultsContainer.createDiv({ cls: 'cr-place-generator-created-notes' });
			notesSection.createEl('h4', { text: 'Created notes' });

			const newNotes = result.placeNotes.filter(n => n.isNew);
			if (newNotes.length > 0) {
				const list = notesSection.createEl('ul', { cls: 'cr-place-generator-note-list' });

				for (const note of newNotes.slice(0, 20)) {
					const li = list.createEl('li');
					const link = li.createEl('a', {
						text: note.name,
						cls: 'cr-place-generator-note-link'
					});
					link.addEventListener('click', (e) => {
						e.preventDefault();
						void this.app.workspace.openLinkText(note.path, '');
					});
				}

				if (newNotes.length > 20) {
					list.createEl('li', {
						text: `... and ${newNotes.length - 20} more`,
						cls: 'crc-text--muted'
					});
				}
			}
		}

		// Clear preview result so generate button is disabled
		this.previewResult = null;
		this.updateButtonStates();
	}

	/**
	 * Update button states
	 */
	private updateButtonStates(): void {
		const canScan = !this.isScanning && !this.isGenerating &&
			(this.options.scanPersonNotes || this.options.scanEventNotes);

		const canGenerate = !this.isScanning && !this.isGenerating &&
			this.previewResult !== null &&
			(this.previewResult.notesCreated > 0 || this.previewResult.referencesUpdated > 0);

		if (this.previewButton) {
			this.previewButton.disabled = !canScan;
			this.previewButton.textContent = this.isScanning ? 'Scanning...' : 'Preview';
		}

		if (this.generateButton) {
			this.generateButton.disabled = !canGenerate;
			this.generateButton.textContent = this.isGenerating ? 'Generating...' : 'Generate';
		}
	}
}
