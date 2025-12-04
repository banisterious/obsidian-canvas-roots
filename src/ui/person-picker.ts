import { App, Modal, TFile } from 'obsidian';
import { createLucideIcon } from './lucide-icons';
import { FamilyGraphService, PersonNode } from '../core/family-graph';
import { FolderFilterService } from '../core/folder-filter';

/**
 * Place reference info for person detail view
 */
export interface PlaceInfo {
	/** Raw value from frontmatter */
	rawValue: string;
	/** Extracted place name (without wikilink brackets) */
	placeName: string;
	/** Whether this is a wikilink to a place note */
	isLinked: boolean;
}

/**
 * Extract place info from a frontmatter place field value
 * @param value - Raw value from frontmatter (can be string, wikilink, or undefined)
 * @returns PlaceInfo if value exists, undefined otherwise
 */
export function extractPlaceInfo(value: unknown): PlaceInfo | undefined {
	if (!value || typeof value !== 'string') {
		return undefined;
	}

	const rawValue = String(value);
	const wikilinkMatch = rawValue.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);

	if (wikilinkMatch) {
		return {
			rawValue,
			placeName: wikilinkMatch[1],
			isLinked: true
		};
	}

	return {
		rawValue,
		placeName: rawValue,
		isLinked: false
	};
}

/**
 * Person data extracted from note frontmatter
 */
export interface PersonInfo {
	name: string;
	crId: string;
	birthDate?: string;
	deathDate?: string;
	sex?: string;
	birthPlace?: PlaceInfo;
	deathPlace?: PlaceInfo;
	burialPlace?: PlaceInfo;
	file: TFile;
}

/**
 * Sort options for person list
 */
type SortOption = 'name-asc' | 'name-desc' | 'birth-asc' | 'birth-desc' | 'recent';

/**
 * Filter options for person list
 */
interface FilterOptions {
	livingStatus: 'all' | 'living' | 'deceased';
	hasBirthDate: 'all' | 'yes' | 'no';
	sex: 'all' | 'M' | 'F';
}

/**
 * Person Picker Modal
 * Allows users to search and select a person from the vault
 */
export class PersonPickerModal extends Modal {
	private searchQuery: string = '';
	private allPeople: PersonInfo[] = [];
	private filteredPeople: PersonInfo[] = [];
	private onSelect: (person: PersonInfo) => void;
	private searchInput: HTMLInputElement;
	private resultsContainer: HTMLElement;
	private sortOption: SortOption = 'name-asc';
	private filters: FilterOptions = {
		livingStatus: 'all',
		hasBirthDate: 'all',
		sex: 'all'
	};
	private familyComponents: Array<{ representative: PersonNode; size: number; people: PersonNode[] }> = [];
	private componentMap: Map<string, number> = new Map(); // Maps cr_id to component index
	private activeComponentIndex: number | null = null; // null = show all, number = show specific component
	private tabsContainer?: HTMLElement;
	private folderFilter?: FolderFilterService;

	constructor(app: App, onSelect: (person: PersonInfo) => void, folderFilter?: FolderFilterService) {
		super(app);
		this.onSelect = onSelect;
		this.folderFilter = folderFilter;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-person-picker-modal');

		// Load all people from vault
		this.loadPeople();

		// Create modal structure
		this.createModalContent();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Load all person notes from the vault
	 */
	private loadPeople(): void {
		this.allPeople = [];
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			// Apply folder filter if configured
			if (this.folderFilter && !this.folderFilter.shouldIncludeFile(file)) {
				continue;
			}

			const personInfo = this.extractPersonInfo(file);
			if (personInfo) {
				this.allPeople.push(personInfo);
			}
		}

		// Load family components
		this.loadFamilyComponents();

		// Initial sort by name
		this.sortPeople();
		this.filteredPeople = [...this.allPeople];
	}

	/**
	 * Load family components and build component map
	 */
	private loadFamilyComponents(): void {
		try {
			const graphService = new FamilyGraphService(this.app);
			if (this.folderFilter) {
				graphService.setFolderFilter(this.folderFilter);
			}
			this.familyComponents = graphService.findAllFamilyComponents();

			// Build component map (cr_id -> component index)
			this.componentMap.clear();
			this.familyComponents.forEach((component, index) => {
				component.people.forEach(person => {
					this.componentMap.set(person.crId, index);
				});
			});
		} catch (error: unknown) {
			console.error('Error loading family components:', error);
			// Gracefully degrade - continue without component grouping
			this.familyComponents = [];
			this.componentMap.clear();
		}
	}

	/**
	 * Sort people based on current sort option
	 */
	private sortPeople(): void {
		switch (this.sortOption) {
			case 'name-asc':
				this.allPeople.sort((a, b) => a.name.localeCompare(b.name));
				break;
			case 'name-desc':
				this.allPeople.sort((a, b) => b.name.localeCompare(a.name));
				break;
			case 'birth-asc':
				this.allPeople.sort((a, b) => this.compareBirthDates(a.birthDate, b.birthDate, true));
				break;
			case 'birth-desc':
				this.allPeople.sort((a, b) => this.compareBirthDates(a.birthDate, b.birthDate, false));
				break;
			case 'recent':
				this.allPeople.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
				break;
		}
	}

	/**
	 * Compare birth dates for sorting
	 * @param ascending - true for oldest first, false for youngest first
	 */
	private compareBirthDates(dateA: string | undefined, dateB: string | undefined, ascending: boolean): number {
		// Put people without birth dates at the end
		if (!dateA && !dateB) return 0;
		if (!dateA) return 1;
		if (!dateB) return -1;

		// Parse dates - try to extract year from various formats
		const yearA = this.extractYear(dateA);
		const yearB = this.extractYear(dateB);

		if (yearA === null && yearB === null) return 0;
		if (yearA === null) return 1;
		if (yearB === null) return -1;

		return ascending ? yearA - yearB : yearB - yearA;
	}

	/**
	 * Extract year from a date string (supports various formats)
	 */
	private extractYear(dateStr: string): number | null {
		// Try to match a 4-digit year
		const yearMatch = dateStr.match(/\b(\d{4})\b/);
		if (yearMatch) {
			return parseInt(yearMatch[1], 10);
		}
		return null;
	}

	/**
	 * Extract person information from a note file
	 */
	private extractPersonInfo(file: TFile): PersonInfo | null {
		try {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache || !cache.frontmatter) {
				return null;
			}

			const fm = cache.frontmatter;

			// Must have cr_id to be a valid person note
			if (!fm.cr_id) {
				return null;
			}

			// Extract name (from frontmatter or filename)
			const name = fm.name || file.basename;

			// Note: Frontmatter uses 'born'/'died' properties, mapped to birthDate/deathDate internally
			// Convert Date objects to ISO strings if necessary (Obsidian parses YAML dates as Date objects)
			const birthDate = fm.born instanceof Date ? fm.born.toISOString().split('T')[0] : fm.born;
			const deathDate = fm.died instanceof Date ? fm.died.toISOString().split('T')[0] : fm.died;

			return {
				name,
				crId: fm.cr_id,
				birthDate,
				deathDate,
				sex: fm.sex || fm.gender,
				birthPlace: extractPlaceInfo(fm.birth_place),
				deathPlace: extractPlaceInfo(fm.death_place),
				burialPlace: extractPlaceInfo(fm.burial_place),
				file
			};
		} catch (error: unknown) {
			console.error('Error extracting person info from file:', file.path, error);
			return null;
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
		const icon = createLucideIcon('users', 20);
		titleSection.appendChild(icon);
		titleSection.appendText('Select person');

		// Search and sort section
		const searchSection = contentEl.createDiv({ cls: 'crc-picker-search' });

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
			this.filterPeople();
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
			{ value: 'birth-asc', label: 'Birth year (oldest first)' },
			{ value: 'birth-desc', label: 'Birth year (youngest first)' },
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
			this.sortPeople();
			this.filteredPeople = [...this.allPeople];
			this.filterPeople();
		});

		// Filters section
		const filtersContainer = contentEl.createDiv({ cls: 'crc-picker-filters' });

		// Living status filter
		const livingFilter = filtersContainer.createDiv({ cls: 'crc-picker-filter' });
		livingFilter.createSpan({ cls: 'crc-picker-filter__label', text: 'Living:' });
		const livingSelect = livingFilter.createEl('select', { cls: 'crc-form-select crc-form-select--small' });
		[
			{ value: 'all', label: 'All' },
			{ value: 'living', label: 'Living only' },
			{ value: 'deceased', label: 'Deceased only' }
		].forEach(opt => {
			livingSelect.createEl('option', { value: opt.value, text: opt.label });
		});
		livingSelect.addEventListener('change', () => {
			this.filters.livingStatus = livingSelect.value as FilterOptions['livingStatus'];
			this.filterPeople();
		});

		// Birth date filter
		const birthFilter = filtersContainer.createDiv({ cls: 'crc-picker-filter' });
		birthFilter.createSpan({ cls: 'crc-picker-filter__label', text: 'Birth date:' });
		const birthSelect = birthFilter.createEl('select', { cls: 'crc-form-select crc-form-select--small' });
		[
			{ value: 'all', label: 'All' },
			{ value: 'yes', label: 'Has date' },
			{ value: 'no', label: 'Missing date' }
		].forEach(opt => {
			birthSelect.createEl('option', { value: opt.value, text: opt.label });
		});
		birthSelect.addEventListener('change', () => {
			this.filters.hasBirthDate = birthSelect.value as FilterOptions['hasBirthDate'];
			this.filterPeople();
		});

		// Sex filter
		const sexFilter = filtersContainer.createDiv({ cls: 'crc-picker-filter' });
		sexFilter.createSpan({ cls: 'crc-picker-filter__label', text: 'Sex:' });
		const sexSelect = sexFilter.createEl('select', { cls: 'crc-form-select crc-form-select--small' });
		[
			{ value: 'all', label: 'All' },
			{ value: 'M', label: 'Male' },
			{ value: 'F', label: 'Female' }
		].forEach(opt => {
			sexSelect.createEl('option', { value: opt.value, text: opt.label });
		});
		sexSelect.addEventListener('change', () => {
			this.filters.sex = sexSelect.value as FilterOptions['sex'];
			this.filterPeople();
		});

		// Create main container with sidebar layout if multiple components exist
		if (this.familyComponents.length > 1) {
			const mainContainer = contentEl.createDiv({ cls: 'crc-picker-main' });

			// Family group sidebar
			this.createFamilySidebar(mainContainer);

			// Results section
			this.resultsContainer = mainContainer.createDiv({ cls: 'crc-picker-results' });
		} else {
			// Results section (no sidebar for single component)
			this.resultsContainer = contentEl.createDiv({ cls: 'crc-picker-results' });
		}

		this.renderResults();
	}

	/**
	 * Create family group sidebar with vertical tabs
	 */
	private createFamilySidebar(container: HTMLElement): void {
		this.tabsContainer = container.createDiv({ cls: 'crc-picker-sidebar' });

		// Sidebar header
		const sidebarHeader = this.tabsContainer.createDiv({ cls: 'crc-picker-sidebar__header' });
		sidebarHeader.setText('Family groups');

		// Sidebar tabs container
		const tabsWrapper = this.tabsContainer.createDiv({ cls: 'crc-picker-sidebar__tabs' });

		// "All" tab
		const allTab = tabsWrapper.createDiv({ cls: 'crc-picker-sidebar-tab' });
		if (this.activeComponentIndex === null) {
			allTab.addClass('crc-picker-sidebar-tab--active');
		}

		const allTabLabel = allTab.createSpan({ cls: 'crc-picker-sidebar-tab__label' });
		allTabLabel.setText('All families');

		const allTabBadge = allTab.createSpan({ cls: 'crc-picker-sidebar-tab__badge' });
		const totalPeople = this.familyComponents.reduce((sum, c) => sum + c.size, 0);
		allTabBadge.setText(totalPeople.toString());

		allTab.addEventListener('click', () => {
			this.activeComponentIndex = null;
			this.updateActiveSidebarTab();
			this.filterPeople();
		});

		// Individual family group tabs
		this.familyComponents.forEach((component, index) => {
			const tab = tabsWrapper.createDiv({ cls: 'crc-picker-sidebar-tab' });
			if (this.activeComponentIndex === index) {
				tab.addClass('crc-picker-sidebar-tab--active');
			}

			const tabLabel = tab.createSpan({ cls: 'crc-picker-sidebar-tab__label' });
			tabLabel.setText(`Family ${index + 1}`);

			const tabBadge = tab.createSpan({ cls: 'crc-picker-sidebar-tab__badge' });
			tabBadge.setText(component.size.toString());

			tab.addEventListener('click', () => {
				this.activeComponentIndex = index;
				this.updateActiveSidebarTab();
				this.filterPeople();
			});
		});
	}

	/**
	 * Update active sidebar tab styling
	 */
	private updateActiveSidebarTab(): void {
		if (!this.tabsContainer) return;

		const tabs = this.tabsContainer.querySelectorAll('.crc-picker-sidebar-tab');
		tabs.forEach((tab, index) => {
			if (index === 0) {
				// "All families" tab
				if (this.activeComponentIndex === null) {
					tab.addClass('crc-picker-sidebar-tab--active');
				} else {
					tab.removeClass('crc-picker-sidebar-tab--active');
				}
			} else {
				// Family group tab (index - 1 because "All" is index 0)
				if (this.activeComponentIndex === index - 1) {
					tab.addClass('crc-picker-sidebar-tab--active');
				} else {
					tab.removeClass('crc-picker-sidebar-tab--active');
				}
			}
		});
	}

	/**
	 * Filter people based on search query and filter options
	 */
	private filterPeople(): void {
		this.filteredPeople = this.allPeople.filter(person => {
			// Family component filter (based on active tab)
			if (this.activeComponentIndex !== null) {
				const personComponentIndex = this.componentMap.get(person.crId);
				if (personComponentIndex !== this.activeComponentIndex) return false;
			}

			// Search query filter
			if (this.searchQuery) {
				const matchesSearch = person.name.toLowerCase().includes(this.searchQuery) ||
					person.crId.toLowerCase().includes(this.searchQuery);
				if (!matchesSearch) return false;
			}

			// Living status filter
			if (this.filters.livingStatus !== 'all') {
				const isDeceased = !!person.deathDate;
				if (this.filters.livingStatus === 'living' && isDeceased) return false;
				if (this.filters.livingStatus === 'deceased' && !isDeceased) return false;
			}

			// Birth date filter
			if (this.filters.hasBirthDate !== 'all') {
				const hasBirth = !!person.birthDate;
				if (this.filters.hasBirthDate === 'yes' && !hasBirth) return false;
				if (this.filters.hasBirthDate === 'no' && hasBirth) return false;
			}

			// Sex filter
			if (this.filters.sex !== 'all') {
				if (person.sex !== this.filters.sex) return false;
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

		if (this.filteredPeople.length === 0) {
			const emptyState = this.resultsContainer.createDiv({ cls: 'crc-picker-empty' });
			const emptyIcon = createLucideIcon('search', 48);
			emptyState.appendChild(emptyIcon);
			emptyState.createEl('p', { text: 'No people found' });
			emptyState.createEl('p', {
				text: this.allPeople.length === 0
					? 'Create person notes to link them as relationships'
					: 'Try a different search term',
				cls: 'crc-text-muted'
			});
			return;
		}

		// With tabs, we just render the filtered people directly
		this.filteredPeople.forEach(person => {
			this.renderPersonCard(person);
		});
	}

	/**
	 * Render a single person card
	 */
	private renderPersonCard(person: PersonInfo): void {
		const card = this.resultsContainer.createDiv({ cls: 'crc-picker-item' });

		// Main info
		const mainInfo = card.createDiv({ cls: 'crc-picker-item__main' });
		mainInfo.createDiv({ cls: 'crc-picker-item__name', text: person.name });

		// Meta info (dates if available, otherwise cr_id)
		const metaInfo = card.createDiv({ cls: 'crc-picker-item__meta' });

		const hasDates = person.birthDate || person.deathDate;

		if (hasDates) {
			// Show birth-death date range
			const dateBadge = metaInfo.createDiv({ cls: 'crc-picker-badge' });
			const dateIcon = createLucideIcon('calendar', 12);
			dateBadge.appendChild(dateIcon);

			// Format: "1888-1952" or "b. 1888" or "d. 1952"
			if (person.birthDate && person.deathDate) {
				dateBadge.appendText(`${person.birthDate} – ${person.deathDate}`);
			} else if (person.birthDate) {
				dateBadge.appendText(`b. ${person.birthDate}`);
			} else if (person.deathDate) {
				dateBadge.appendText(`d. ${person.deathDate}`);
			}
		} else {
			// Fallback: show cr_id only when no dates available
			const idBadge = metaInfo.createDiv({ cls: 'crc-picker-badge crc-picker-badge--id' });
			const idIcon = createLucideIcon('hash', 12);
			idBadge.appendChild(idIcon);
			idBadge.appendText(person.crId);
		}

		// Click handler
		card.addEventListener('click', () => {
			this.onSelect(person);
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
}
