/**
 * Place Picker Modal
 * Modal for searching and selecting place notes, with option to create new places
 */

import { App, Modal, TFile } from 'obsidian';
import { createLucideIcon } from './lucide-icons';
import { PlaceGraphService } from '../core/place-graph';
import { PlaceCategory } from '../models/place';
import { FolderFilterService } from '../core/folder-filter';
import { CreatePlaceModal } from './create-place-modal';
import type { CanvasRootsSettings } from '../settings';
import type CanvasRootsPlugin from '../../main';

/**
 * Place data returned when a place is selected
 */
export interface SelectedPlaceInfo {
	/** Place name */
	name: string;
	/** Place cr_id for reliable resolution */
	crId: string;
	/** Place category (real, fictional, etc.) */
	category?: PlaceCategory;
	/** Place type (city, country, etc.) */
	placeType?: string;
	/** The place note file */
	file: TFile;
}

/**
 * Sort options for place list
 */
type SortOption = 'name-asc' | 'name-desc' | 'category' | 'type' | 'recent';

/**
 * Filter options for place list
 */
interface FilterOptions {
	category: 'all' | PlaceCategory;
	hasCoordinates: 'all' | 'yes' | 'no';
}

/**
 * Place Picker Modal
 * Allows users to search and select a place from the vault
 */
export class PlacePickerModal extends Modal {
	private searchQuery: string = '';
	private allPlaces: SelectedPlaceInfo[] = [];
	private filteredPlaces: SelectedPlaceInfo[] = [];
	private onSelect: (place: SelectedPlaceInfo) => void;
	private searchInput: HTMLInputElement;
	private resultsContainer: HTMLElement;
	private sortOption: SortOption = 'name-asc';
	private filters: FilterOptions = {
		category: 'all',
		hasCoordinates: 'all'
	};
	private folderFilter?: FolderFilterService;
	private placeGraph?: PlaceGraphService;
	private settings?: CanvasRootsSettings;
	private loadingEl?: HTMLElement;
	private directory?: string;
	private plugin?: CanvasRootsPlugin;

	constructor(
		app: App,
		onSelect: (place: SelectedPlaceInfo) => void,
		options?: {
			folderFilter?: FolderFilterService;
			placeGraph?: PlaceGraphService;
			settings?: CanvasRootsSettings;
			directory?: string;
			plugin?: CanvasRootsPlugin;
		}
	) {
		super(app);
		this.onSelect = onSelect;
		this.folderFilter = options?.folderFilter;
		this.placeGraph = options?.placeGraph;
		this.settings = options?.settings;
		this.directory = options?.directory;
		this.plugin = options?.plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-place-picker-modal');

		// Show loading state and load data asynchronously
		this.showLoadingState();

		// Use setTimeout to allow UI to render before heavy computation
		setTimeout(() => {
			this.loadPlaces();
			this.hideLoadingState();
			this.createModalContent();
		}, 10);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Show loading indicator
	 */
	private showLoadingState(): void {
		const { contentEl } = this;
		this.loadingEl = contentEl.createDiv({ cls: 'crc-picker-loading' });
		this.loadingEl.createDiv({ cls: 'crc-picker-loading__spinner' });
		this.loadingEl.createDiv({ cls: 'crc-picker-loading__text', text: 'Loading places...' });
	}

	/**
	 * Hide loading indicator
	 */
	private hideLoadingState(): void {
		if (this.loadingEl) {
			this.loadingEl.remove();
			this.loadingEl = undefined;
		}
	}

	/**
	 * Load all place notes from the vault
	 */
	private loadPlaces(): void {
		this.allPlaces = [];

		// Always create a fresh PlaceGraphService to ensure we get current data
		const graphService = new PlaceGraphService(this.app);
		if (this.folderFilter) {
			graphService.setFolderFilter(this.folderFilter);
		}
		if (this.settings) {
			graphService.setSettings(this.settings);
		}
		graphService.reloadCache(); // Force fresh load

		const placeNodes = graphService.getAllPlaces();
		for (const node of placeNodes) {
			// Skip places without an id - they can't be linked
			if (!node.id) continue;

			const file = this.app.vault.getAbstractFileByPath(node.filePath);
			if (!file || !(file instanceof TFile)) continue;

			this.allPlaces.push({
				name: node.name,
				crId: node.id,
				category: node.category,
				placeType: node.placeType,
				file
			});
		}

		// Initial sort by name
		this.sortPlaces();
		this.filteredPlaces = [...this.allPlaces];
	}

	/**
	 * Sort places based on current sort option
	 */
	private sortPlaces(): void {
		switch (this.sortOption) {
			case 'name-asc':
				this.allPlaces.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
				break;
			case 'name-desc':
				this.allPlaces.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
				break;
			case 'category':
				this.allPlaces.sort((a, b) => {
					const catA = a.category || 'real';
					const catB = b.category || 'real';
					const catCompare = catA.localeCompare(catB);
					if (catCompare !== 0) return catCompare;
					return (a.name || '').localeCompare(b.name || '');
				});
				break;
			case 'type':
				this.allPlaces.sort((a, b) => {
					const typeA = a.placeType || '';
					const typeB = b.placeType || '';
					const typeCompare = typeA.localeCompare(typeB);
					if (typeCompare !== 0) return typeCompare;
					return (a.name || '').localeCompare(b.name || '');
				});
				break;
			case 'recent':
				this.allPlaces.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
				break;
		}
	}

	/**
	 * Create the modal content
	 */
	private createModalContent(): void {
		const { contentEl } = this;

		// Header
		const header = contentEl.createDiv({ cls: 'crc-picker-header' });
		const titleSection = header.createDiv({ cls: 'crc-picker-title' });
		const icon = createLucideIcon('map-pin', 20);
		titleSection.appendChild(icon);
		titleSection.appendText('Select place');

		// Search section
		const searchSection = contentEl.createDiv({ cls: 'crc-picker-search' });

		// "Create new" button (shown at top)
		const createNewBtn = searchSection.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-picker-create-new-btn'
		});
		const plusIcon = createLucideIcon('plus', 16);
		createNewBtn.appendChild(plusIcon);
		createNewBtn.appendText(' Create new place');

		createNewBtn.addEventListener('click', () => {
			this.openCreatePlaceModal();
		});

		// Search input
		this.searchInput = searchSection.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'text',
				placeholder: 'Search by name...'
			}
		});

		this.searchInput.addEventListener('input', () => {
			this.searchQuery = this.searchInput.value.toLowerCase();
			this.filterPlaces();
		});

		// Auto-focus search input
		setTimeout(() => this.searchInput.focus(), 50);

		// Sort dropdown
		const sortContainer = contentEl.createDiv({ cls: 'crc-picker-sort' });
		sortContainer.createSpan({ cls: 'crc-picker-sort__label', text: 'Sort by:' });
		const sortSelect = sortContainer.createEl('select', { cls: 'crc-form-select' });

		const sortOptions: Array<{ value: SortOption; label: string }> = [
			{ value: 'name-asc', label: 'Name (A-Z)' },
			{ value: 'name-desc', label: 'Name (Z-A)' },
			{ value: 'category', label: 'Category' },
			{ value: 'type', label: 'Place type' },
			{ value: 'recent', label: 'Recently modified' }
		];

		sortOptions.forEach(opt => {
			const option = sortSelect.createEl('option', { value: opt.value, text: opt.label });
			if (opt.value === this.sortOption) {
				option.selected = true;
			}
		});

		sortSelect.addEventListener('change', () => {
			this.sortOption = sortSelect.value as SortOption;
			this.sortPlaces();
			this.filteredPlaces = [...this.allPlaces];
			this.filterPlaces();
		});

		// Filters section
		const filtersContainer = contentEl.createDiv({ cls: 'crc-picker-filters' });

		// Category filter
		const categoryFilter = filtersContainer.createDiv({ cls: 'crc-picker-filter' });
		categoryFilter.createSpan({ cls: 'crc-picker-filter__label', text: 'Category:' });
		const categorySelect = categoryFilter.createEl('select', { cls: 'crc-form-select crc-form-select--small' });

		const categoryOptions: Array<{ value: string; label: string }> = [
			{ value: 'all', label: 'All' },
			{ value: 'real', label: 'Real' },
			{ value: 'historical', label: 'Historical' },
			{ value: 'fictional', label: 'Fictional' },
			{ value: 'mythological', label: 'Mythological' },
			{ value: 'legendary', label: 'Legendary' },
			{ value: 'disputed', label: 'Disputed' }
		];

		categoryOptions.forEach(opt => {
			categorySelect.createEl('option', { value: opt.value, text: opt.label });
		});

		categorySelect.addEventListener('change', () => {
			this.filters.category = categorySelect.value as FilterOptions['category'];
			this.filterPlaces();
		});

		// Results container
		this.resultsContainer = contentEl.createDiv({ cls: 'crc-picker-results' });
		this.renderResults();
	}

	/**
	 * Filter places based on search query and filter options
	 */
	private filterPlaces(): void {
		this.filteredPlaces = this.allPlaces.filter(place => {
			// Search query filter
			if (this.searchQuery) {
				const matchesSearch = place.name.toLowerCase().includes(this.searchQuery) ||
					place.crId.toLowerCase().includes(this.searchQuery) ||
					(place.placeType && place.placeType.toLowerCase().includes(this.searchQuery));
				if (!matchesSearch) return false;
			}

			// Category filter
			if (this.filters.category !== 'all') {
				const placeCategory = place.category || 'real';
				if (placeCategory !== this.filters.category) return false;
			}

			return true;
		});

		this.renderResults();
	}

	/**
	 * Render the filtered results
	 */
	private renderResults(): void {
		this.resultsContainer.empty();

		if (this.filteredPlaces.length === 0) {
			const emptyState = this.resultsContainer.createDiv({ cls: 'crc-picker-empty' });
			const emptyIcon = createLucideIcon('search', 48);
			emptyState.appendChild(emptyIcon);
			emptyState.createEl('p', { text: 'No places found' });
			emptyState.createEl('p', {
				text: this.allPlaces.length === 0
					? 'Create place notes to link them here'
					: 'Try a different search term or create a new place',
				cls: 'crc-text-muted'
			});
			return;
		}

		this.filteredPlaces.forEach(place => {
			this.renderPlaceCard(place);
		});
	}

	/**
	 * Render a single place card
	 */
	private renderPlaceCard(place: SelectedPlaceInfo): void {
		const card = this.resultsContainer.createDiv({ cls: 'crc-picker-item' });

		// Main info
		const mainInfo = card.createDiv({ cls: 'crc-picker-item__main' });
		mainInfo.createDiv({ cls: 'crc-picker-item__name', text: place.name });

		// Meta info
		const metaInfo = card.createDiv({ cls: 'crc-picker-item__meta' });

		// Show place type if available
		if (place.placeType) {
			const typeBadge = metaInfo.createDiv({ cls: 'crc-picker-badge' });
			const typeIcon = createLucideIcon('layers', 12);
			typeBadge.appendChild(typeIcon);
			typeBadge.appendText(place.placeType);
		}

		// Show category if not 'real' (default)
		if (place.category && place.category !== 'real') {
			const categoryBadge = metaInfo.createDiv({ cls: 'crc-picker-badge' });
			const categoryIcon = createLucideIcon('globe', 12);
			categoryBadge.appendChild(categoryIcon);
			categoryBadge.appendText(place.category);
		}

		// Fallback: show cr_id if no other metadata
		if (!place.placeType && (!place.category || place.category === 'real')) {
			const idBadge = metaInfo.createDiv({ cls: 'crc-picker-badge crc-picker-badge--id' });
			const idIcon = createLucideIcon('hash', 12);
			idBadge.appendChild(idIcon);
			idBadge.appendText(place.crId);
		}

		// Click handler
		card.addEventListener('click', () => {
			this.onSelect(place);
			this.close();
		});

		// Hover effect
		card.addEventListener('mouseenter', () => {
			card.addClass('crc-picker-item--hover');
		});
		card.addEventListener('mouseleave', () => {
			card.removeClass('crc-picker-item--hover');
		});
	}

	/**
	 * Open the Create Place modal
	 */
	private openCreatePlaceModal(): void {
		// Use placesFolder from settings, not the person directory
		const placesFolder = this.settings?.placesFolder || 'Charted Roots/Places';
		new CreatePlaceModal(this.app, {
			directory: placesFolder,
			placeGraph: this.placeGraph,
			settings: this.settings,
			plugin: this.plugin,
			onCreated: (file: TFile) => {
				// Wait for metadata cache to update before reading frontmatter
				setTimeout(() => {
					const cache = this.app.metadataCache.getFileCache(file);
					if (cache?.frontmatter) {
						const fm = cache.frontmatter;
						const newPlace: SelectedPlaceInfo = {
							name: fm.name || file.basename,
							crId: fm.cr_id,
							category: fm.place_category,
							placeType: fm.place_type,
							file
						};

						// Select the newly created place and close this modal
						this.onSelect(newPlace);
						this.close();
					} else {
						// Fallback: use file basename if cache not ready
						const newPlace: SelectedPlaceInfo = {
							name: file.basename,
							crId: '', // Will be populated when note is read
							file
						};
						this.onSelect(newPlace);
						this.close();
					}
				}, 100);
			}
		}).open();
	}
}
