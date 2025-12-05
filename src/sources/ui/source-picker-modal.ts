/**
 * Source Picker Modal
 *
 * Allows users to search and select a source to link to a person note.
 * Similar pattern to PersonPickerModal.
 */

import { App, Modal, TFile } from 'obsidian';
import { createLucideIcon } from '../../ui/lucide-icons';
import { SourceService } from '../services/source-service';
import { CreateSourceModal } from './create-source-modal';
import type { SourceNote } from '../types/source-types';
import { getSourceType } from '../types/source-types';
import type CanvasRootsPlugin from '../../../main';

/**
 * Sort options for source list
 */
type SortOption = 'title-asc' | 'title-desc' | 'date-asc' | 'date-desc' | 'recent';

/**
 * Filter options for source list
 */
interface FilterOptions {
	sourceType: string; // 'all' or specific type id
	confidence: 'all' | 'high' | 'medium' | 'low' | 'unknown';
}

/**
 * Source Picker Modal
 * Allows users to search and select a source from the vault
 */
export class SourcePickerModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private searchQuery: string = '';
	private allSources: SourceNote[] = [];
	private filteredSources: SourceNote[] = [];
	private onSelect: (source: SourceNote) => void | Promise<void>;
	private searchInput!: HTMLInputElement;
	private resultsContainer!: HTMLElement;
	private sortOption: SortOption = 'title-asc';
	private filters: FilterOptions = {
		sourceType: 'all',
		confidence: 'all'
	};

	constructor(app: App, plugin: CanvasRootsPlugin, onSelect: (source: SourceNote) => void | Promise<void>) {
		super(app);
		this.plugin = plugin;
		this.onSelect = onSelect;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('cr-source-picker-modal');

		// Load all sources from vault
		this.loadSources();

		// Create modal structure
		this.createModalContent();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Load all source notes from the vault
	 */
	private loadSources(): void {
		const sourceService = new SourceService(this.app, this.plugin.settings);
		this.allSources = sourceService.getAllSources();

		// Initial sort by title
		this.sortSources();
		this.filteredSources = [...this.allSources];
	}

	/**
	 * Sort sources based on current sort option
	 */
	private sortSources(): void {
		switch (this.sortOption) {
			case 'title-asc':
				this.allSources.sort((a, b) => a.title.localeCompare(b.title));
				break;
			case 'title-desc':
				this.allSources.sort((a, b) => b.title.localeCompare(a.title));
				break;
			case 'date-asc':
				this.allSources.sort((a, b) => this.compareDates(a.date, b.date, true));
				break;
			case 'date-desc':
				this.allSources.sort((a, b) => this.compareDates(a.date, b.date, false));
				break;
			case 'recent':
				// Sort by file modification time
				this.allSources.sort((a, b) => {
					const fileA = this.app.vault.getAbstractFileByPath(a.filePath);
					const fileB = this.app.vault.getAbstractFileByPath(b.filePath);
					if (fileA instanceof TFile && fileB instanceof TFile) {
						return fileB.stat.mtime - fileA.stat.mtime;
					}
					return 0;
				});
				break;
		}
	}

	/**
	 * Compare dates for sorting
	 */
	private compareDates(dateA: string | undefined, dateB: string | undefined, ascending: boolean): number {
		if (!dateA && !dateB) return 0;
		if (!dateA) return 1;
		if (!dateB) return -1;

		const comparison = dateA.localeCompare(dateB);
		return ascending ? comparison : -comparison;
	}

	/**
	 * Create the modal content
	 */
	private createModalContent(): void {
		const { contentEl } = this;

		// Header
		const header = contentEl.createDiv({ cls: 'crc-picker-header' });
		const titleSection = header.createDiv({ cls: 'crc-picker-title' });
		const icon = createLucideIcon('archive', 20);
		titleSection.appendChild(icon);
		titleSection.appendText('Select source');

		// Create new source button
		const createBtn = header.createEl('button', { cls: 'mod-cta cr-source-picker-create-btn' });
		createBtn.createSpan({ text: 'Create new' });
		createBtn.addEventListener('click', () => {
			this.close();
			new CreateSourceModal(this.app, this.plugin, {
				onSuccess: (file) => {
					// After creating, get the source and call onSelect
					if (file) {
						const sourceService = new SourceService(this.app, this.plugin.settings);
						const source = sourceService.getSourceByPath(file.path);
						if (source) {
							this.onSelect(source);
						}
					}
				}
			}).open();
		});

		// Search section
		const searchSection = contentEl.createDiv({ cls: 'crc-picker-search' });

		this.searchInput = searchSection.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'text',
				placeholder: 'Search by title, repository...'
			}
		});

		this.searchInput.addEventListener('input', () => {
			this.searchQuery = this.searchInput.value.toLowerCase();
			this.filterSources();
		});

		// Auto-focus search input
		setTimeout(() => this.searchInput.focus(), 50);

		// Sort dropdown
		const sortContainer = contentEl.createDiv({ cls: 'crc-picker-sort' });
		sortContainer.createSpan({ cls: 'crc-picker-sort__label', text: 'Sort by:' });
		const sortSelect = sortContainer.createEl('select', { cls: 'crc-form-select' });

		const sortOptions: Array<{ value: SortOption; label: string }> = [
			{ value: 'title-asc', label: 'Title (A-Z)' },
			{ value: 'title-desc', label: 'Title (Z-A)' },
			{ value: 'date-asc', label: 'Date (oldest first)' },
			{ value: 'date-desc', label: 'Date (newest first)' },
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
			this.sortSources();
			this.filteredSources = [...this.allSources];
			this.filterSources();
		});

		// Filters section
		const filtersContainer = contentEl.createDiv({ cls: 'crc-picker-filters' });

		// Source type filter
		const typeFilter = filtersContainer.createDiv({ cls: 'crc-picker-filter' });
		typeFilter.createSpan({ cls: 'crc-picker-filter__label', text: 'Type:' });
		const typeSelect = typeFilter.createEl('select', { cls: 'crc-form-select crc-form-select--small' });

		// Get unique source types from current sources
		const sourceTypes = new Set<string>();
		this.allSources.forEach(s => sourceTypes.add(s.sourceType));

		typeSelect.createEl('option', { value: 'all', text: 'All types' });
		Array.from(sourceTypes).sort().forEach(typeId => {
			const typeDef = getSourceType(
				typeId,
				this.plugin.settings.customSourceTypes,
				this.plugin.settings.showBuiltInSourceTypes
			);
			const label = typeDef ? typeDef.name : typeId;
			typeSelect.createEl('option', { value: typeId, text: label });
		});

		typeSelect.addEventListener('change', () => {
			this.filters.sourceType = typeSelect.value;
			this.filterSources();
		});

		// Confidence filter
		const confFilter = filtersContainer.createDiv({ cls: 'crc-picker-filter' });
		confFilter.createSpan({ cls: 'crc-picker-filter__label', text: 'Confidence:' });
		const confSelect = confFilter.createEl('select', { cls: 'crc-form-select crc-form-select--small' });
		[
			{ value: 'all', label: 'All' },
			{ value: 'high', label: 'High' },
			{ value: 'medium', label: 'Medium' },
			{ value: 'low', label: 'Low' },
			{ value: 'unknown', label: 'Unknown' }
		].forEach(opt => {
			confSelect.createEl('option', { value: opt.value, text: opt.label });
		});
		confSelect.addEventListener('change', () => {
			this.filters.confidence = confSelect.value as FilterOptions['confidence'];
			this.filterSources();
		});

		// Results section
		this.resultsContainer = contentEl.createDiv({ cls: 'crc-picker-results' });
		this.renderResults();
	}

	/**
	 * Filter sources based on search query and filter options
	 */
	private filterSources(): void {
		this.filteredSources = this.allSources.filter(source => {
			// Search query filter
			if (this.searchQuery) {
				const matchesSearch =
					source.title.toLowerCase().includes(this.searchQuery) ||
					source.repository?.toLowerCase().includes(this.searchQuery) ||
					source.collection?.toLowerCase().includes(this.searchQuery) ||
					source.crId.toLowerCase().includes(this.searchQuery);
				if (!matchesSearch) return false;
			}

			// Source type filter
			if (this.filters.sourceType !== 'all') {
				if (source.sourceType !== this.filters.sourceType) return false;
			}

			// Confidence filter
			if (this.filters.confidence !== 'all') {
				if (source.confidence !== this.filters.confidence) return false;
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

		if (this.filteredSources.length === 0) {
			const emptyState = this.resultsContainer.createDiv({ cls: 'crc-picker-empty' });
			const emptyIcon = createLucideIcon('archive', 48);
			emptyState.appendChild(emptyIcon);
			emptyState.createEl('p', { text: 'No sources found' });
			emptyState.createEl('p', {
				text: this.allSources.length === 0
					? 'Create source notes to link them to people'
					: 'Try a different search term or filter',
				cls: 'crc-text-muted'
			});
			return;
		}

		// Render source cards
		this.filteredSources.forEach(source => {
			this.renderSourceCard(source);
		});
	}

	/**
	 * Render a single source card
	 */
	private renderSourceCard(source: SourceNote): void {
		const typeDef = getSourceType(
			source.sourceType,
			this.plugin.settings.customSourceTypes,
			this.plugin.settings.showBuiltInSourceTypes
		);

		const card = this.resultsContainer.createDiv({ cls: 'crc-picker-item' });

		// Main info
		const mainInfo = card.createDiv({ cls: 'crc-picker-item__main' });
		mainInfo.createDiv({ cls: 'crc-picker-item__name', text: source.title });

		// Meta info
		const metaInfo = card.createDiv({ cls: 'crc-picker-item__meta' });

		// Type badge
		if (typeDef) {
			const typeBadge = metaInfo.createDiv({ cls: 'crc-picker-badge' });
			typeBadge.style.backgroundColor = typeDef.color;
			typeBadge.style.color = this.getContrastColor(typeDef.color);
			typeBadge.textContent = typeDef.name;
		}

		// Date if available
		if (source.date) {
			const dateBadge = metaInfo.createDiv({ cls: 'crc-picker-badge crc-picker-badge--muted' });
			const dateIcon = createLucideIcon('calendar', 12);
			dateBadge.appendChild(dateIcon);
			dateBadge.appendText(source.date);
		}

		// Repository if available
		if (source.repository) {
			const repoBadge = metaInfo.createDiv({ cls: 'crc-picker-badge crc-picker-badge--muted' });
			const repoIcon = createLucideIcon('building', 12);
			repoBadge.appendChild(repoIcon);
			repoBadge.appendText(source.repository);
		}

		// Click handler
		card.addEventListener('click', () => {
			this.onSelect(source);
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
	 * Get contrasting text color for a background
	 */
	private getContrastColor(hexColor: string): string {
		const hex = hexColor.replace('#', '');
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		return luminance > 0.5 ? '#000000' : '#ffffff';
	}
}
