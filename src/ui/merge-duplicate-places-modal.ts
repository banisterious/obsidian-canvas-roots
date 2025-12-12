/**
 * Modal for finding and merging duplicate place notes
 * Identifies place notes that may represent the same location and allows merging them
 */

import { App, Menu, Modal, Notice, TFile } from 'obsidian';
import { createLucideIcon } from './lucide-icons';
import { PlaceGraphService } from '../core/place-graph';
import { PlaceNode } from '../models/place';
import type { CanvasRootsSettings } from '../settings';
import { FolderFilterService } from '../core/folder-filter';

/**
 * A group of duplicate place notes that may represent the same location
 */
interface DuplicatePlaceGroup {
	/** All place nodes in this duplicate group */
	places: PlaceNode[];
	/** Suggested canonical place (most complete data) */
	suggestedCanonical: PlaceNode;
	/** Reason these were grouped as duplicates */
	matchReason: 'exact_name' | 'similar_name' | 'same_parent_and_name' | 'similar_full_name' | 'same_parent_shared_base' | 'state_abbreviation_variant';
}

interface MergeDuplicatePlacesOptions {
	onComplete?: (merged: number, deleted: number) => void;
}

/**
 * Modal for reviewing and merging duplicate place notes
 */
type SortOption = 'duplicates-desc' | 'duplicates-asc' | 'name-asc' | 'name-desc';
type FilterOption = 'all' | 'pending' | 'has-content' | 'has-coords';

export class MergeDuplicatePlacesModal extends Modal {
	private placeService: PlaceGraphService;
	private duplicateGroups: DuplicatePlaceGroup[];
	private filteredGroups: DuplicatePlaceGroup[]; // Groups after filtering/sorting
	private selectedCanonicals: Map<DuplicatePlaceGroup, PlaceNode>; // group -> chosen canonical
	private newFilenames: Map<DuplicatePlaceGroup, string>; // group -> new filename (without extension)
	private appliedGroups: Set<DuplicatePlaceGroup>; // groups that have been merged
	private groupElements: Map<DuplicatePlaceGroup, HTMLElement>; // group -> DOM element
	private groupImpactElements: Map<DuplicatePlaceGroup, HTMLElement>; // group -> impact display
	private groupApplyButtons: Map<DuplicatePlaceGroup, HTMLButtonElement>; // group -> merge button
	private groupFilenameElements: Map<DuplicatePlaceGroup, HTMLElement>; // group -> filename display
	private groupsContainer: HTMLElement | null = null;
	private statusEl: HTMLElement | null = null;
	private currentSort: SortOption = 'duplicates-desc';
	private currentFilter: FilterOption = 'all';
	private searchQuery = '';
	private onComplete?: (merged: number, deleted: number) => void;
	private totalMerged = 0;
	private totalDeleted = 0;

	constructor(
		app: App,
		duplicateGroups: DuplicatePlaceGroup[],
		options: MergeDuplicatePlacesOptions = {}
	) {
		super(app);
		this.placeService = new PlaceGraphService(app);
		this.duplicateGroups = duplicateGroups;
		this.filteredGroups = [...duplicateGroups]; // Start with all groups
		this.selectedCanonicals = new Map();
		this.newFilenames = new Map();
		this.appliedGroups = new Set();
		this.groupElements = new Map();
		this.groupImpactElements = new Map();
		this.groupApplyButtons = new Map();
		this.groupFilenameElements = new Map();
		this.onComplete = options.onComplete;

		// Pre-select the suggested canonical for each group
		for (const group of duplicateGroups) {
			this.selectedCanonicals.set(group, group.suggestedCanonical);
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-merge-duplicates-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('copy', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Merge duplicate places');

		// Help link
		const helpBtn = header.createEl('a', {
			cls: 'crc-modal-help-link',
			attr: {
				href: 'https://github.com/flyingmat/canvas-roots/wiki/Geographic-Features#merge-duplicate-places',
				'aria-label': 'Documentation'
			}
		});
		helpBtn.appendChild(createLucideIcon('book-open', 16));
		helpBtn.appendText('Help');
		helpBtn.addEventListener('click', (e) => {
			e.preventDefault();
			window.open(helpBtn.href, '_blank');
		});

		// Description - what the modal does
		const descriptionEl = contentEl.createDiv({ cls: 'crc-standardize-description' });
		descriptionEl.createEl('p', {
			text: `Found ${this.duplicateGroups.length} group${this.duplicateGroups.length !== 1 ? 's' : ''} of place notes that may represent the same location.`,
			cls: 'crc-text--muted'
		});

		// Explanation of what happens
		const explanationEl = descriptionEl.createDiv({ cls: 'crc-standardize-explanation' });
		explanationEl.createEl('p', {
			text: 'For each group, select the place note to keep as the canonical version. Merging will:',
			cls: 'crc-text--muted'
		});
		const actionsList = explanationEl.createEl('ul', { cls: 'crc-field-list' });
		actionsList.createEl('li', { text: 'Update person notes to reference the canonical place' });
		actionsList.createEl('li', { text: 'Update child places to use the canonical as parent' });
		const trashItem = actionsList.createEl('li');
		trashItem.appendText('Move duplicate notes to trash ');
		trashItem.createEl('span', {
			text: '(check Settings → Files and links → Deleted files to ensure recovery is possible)',
			cls: 'crc-text--muted'
		});

		if (this.duplicateGroups.length === 0) {
			contentEl.createEl('p', {
				text: 'No duplicate place notes found. Your place notes are unique!',
				cls: 'crc-text--success crc-mt-3'
			});

			const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });
			const closeBtn = buttonContainer.createEl('button', {
				text: 'Close',
				cls: 'crc-btn crc-btn--primary'
			});
			closeBtn.addEventListener('click', () => this.close());
			return;
		}

		// Sort and filter controls
		this.renderControls(contentEl);

		// Duplicate groups container
		this.groupsContainer = contentEl.createDiv({ cls: 'crc-variation-groups' });
		this.applyFilterAndSort();
		this.renderGroups(this.groupsContainer);

		// Backup warning
		const warning = contentEl.createDiv({ cls: 'crc-warning-callout' });
		const warningIcon = createLucideIcon('alert-triangle', 16);
		warning.appendChild(warningIcon);
		warning.createSpan({
			text: ' Backup your vault before proceeding. This operation will modify and delete existing notes.'
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Close',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => this.close());

		// Calculate total impact for the main button
		const totalImpact = this.calculateTotalImpact();
		const applyBtn = buttonContainer.createEl('button', {
			text: `Merge all (${totalImpact.duplicateCount} duplicates)`,
			cls: 'crc-btn crc-btn--primary'
		});
		applyBtn.title = `Merge ${totalImpact.duplicateCount} duplicate place notes across ${totalImpact.groupCount} groups`;
		applyBtn.addEventListener('click', () => void this.applyAllMerges());
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();

		// Call completion callback if any groups were merged
		if ((this.totalMerged > 0 || this.totalDeleted > 0) && this.onComplete) {
			this.onComplete(this.totalMerged, this.totalDeleted);
		}
	}

	/**
	 * Calculate total impact across all groups
	 */
	private calculateTotalImpact(): { duplicateCount: number; groupCount: number } {
		let duplicateCount = 0;
		let groupCount = 0;

		for (const group of this.duplicateGroups) {
			if (this.appliedGroups.has(group)) continue;
			// Duplicates = total places - 1 (the canonical)
			duplicateCount += group.places.length - 1;
			groupCount++;
		}

		return { duplicateCount, groupCount };
	}

	/**
	 * Render sort and filter controls
	 */
	private renderControls(container: HTMLElement): void {
		const controlsRow = container.createDiv({ cls: 'crc-duplicate-controls' });

		// Search input
		const searchGroup = controlsRow.createDiv({ cls: 'crc-control-group crc-control-group--search' });
		const searchInput = searchGroup.createEl('input', {
			type: 'text',
			cls: 'crc-input crc-input--small crc-search-input',
			placeholder: 'Search places...'
		});
		searchInput.value = this.searchQuery;

		// Debounce search to avoid excessive re-renders
		let searchTimeout: ReturnType<typeof setTimeout> | null = null;
		searchInput.addEventListener('input', () => {
			if (searchTimeout) clearTimeout(searchTimeout);
			searchTimeout = setTimeout(() => {
				this.searchQuery = searchInput.value;
				this.applyFilterAndSort();
				if (this.groupsContainer) this.renderGroups(this.groupsContainer);
			}, 200);
		});

		// Clear search on Escape
		searchInput.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && this.searchQuery) {
				searchInput.value = '';
				this.searchQuery = '';
				this.applyFilterAndSort();
				if (this.groupsContainer) this.renderGroups(this.groupsContainer);
			}
		});

		// Sort dropdown
		const sortGroup = controlsRow.createDiv({ cls: 'crc-control-group' });
		sortGroup.createEl('label', { text: 'Sort:', cls: 'crc-control-label' });
		const sortSelect = sortGroup.createEl('select', { cls: 'crc-select crc-select--small' });

		const sortOptions: Array<{ value: SortOption; label: string }> = [
			{ value: 'duplicates-desc', label: 'Most duplicates' },
			{ value: 'duplicates-asc', label: 'Fewest duplicates' },
			{ value: 'name-asc', label: 'Name (A-Z)' },
			{ value: 'name-desc', label: 'Name (Z-A)' }
		];

		for (const opt of sortOptions) {
			const option = sortSelect.createEl('option', { value: opt.value, text: opt.label });
			if (opt.value === this.currentSort) option.selected = true;
		}

		sortSelect.addEventListener('change', () => {
			this.currentSort = sortSelect.value as SortOption;
			this.applyFilterAndSort();
			if (this.groupsContainer) this.renderGroups(this.groupsContainer);
		});

		// Filter dropdown
		const filterGroup = controlsRow.createDiv({ cls: 'crc-control-group' });
		filterGroup.createEl('label', { text: 'Show:', cls: 'crc-control-label' });
		const filterSelect = filterGroup.createEl('select', { cls: 'crc-select crc-select--small' });

		const filterOptions: Array<{ value: FilterOption; label: string }> = [
			{ value: 'all', label: 'All groups' },
			{ value: 'pending', label: 'Pending only' },
			{ value: 'has-content', label: 'Has metadata' },
			{ value: 'has-coords', label: 'Has coordinates' }
		];

		for (const opt of filterOptions) {
			const option = filterSelect.createEl('option', { value: opt.value, text: opt.label });
			if (opt.value === this.currentFilter) option.selected = true;
		}

		filterSelect.addEventListener('change', () => {
			this.currentFilter = filterSelect.value as FilterOption;
			this.applyFilterAndSort();
			if (this.groupsContainer) this.renderGroups(this.groupsContainer);
		});

		// Status display
		this.statusEl = controlsRow.createDiv({ cls: 'crc-duplicate-status' });
		this.updateStatusDisplay();
	}

	/**
	 * Update the status display showing filtered/total counts
	 */
	private updateStatusDisplay(): void {
		if (!this.statusEl) return;
		this.statusEl.empty();

		const pending = this.duplicateGroups.filter(g => !this.appliedGroups.has(g)).length;
		const showing = this.filteredGroups.length;
		const total = this.duplicateGroups.length;

		if (showing === total) {
			this.statusEl.createEl('span', {
				text: `${showing} group${showing !== 1 ? 's' : ''}`,
				cls: 'crc-text--muted'
			});
		} else {
			this.statusEl.createEl('span', {
				text: `Showing ${showing} of ${total} groups`,
				cls: 'crc-text--muted'
			});
		}

		if (pending < total) {
			this.statusEl.createEl('span', {
				text: ` (${total - pending} merged)`,
				cls: 'crc-text--success'
			});
		}
	}

	/**
	 * Apply current filter and sort to the groups
	 */
	private applyFilterAndSort(): void {
		// Start with all groups
		let groups = [...this.duplicateGroups];

		// Apply search filter first
		if (this.searchQuery.trim()) {
			const query = this.searchQuery.toLowerCase().trim();
			groups = groups.filter(g =>
				g.places.some(p =>
					p.name.toLowerCase().includes(query) ||
					p.filePath.toLowerCase().includes(query)
				)
			);
		}

		// Apply dropdown filter
		switch (this.currentFilter) {
			case 'pending':
				groups = groups.filter(g => !this.appliedGroups.has(g));
				break;
			case 'has-content':
				// Groups where any place has content - we can't check this synchronously,
				// so we check if fullName or placeType is set as a proxy for "has data"
				// Note: The actual body content check happens asynchronously in renderGroups
				groups = groups.filter(g => g.places.some(p => p.placeType || p.universe));
				break;
			case 'has-coords':
				groups = groups.filter(g => g.places.some(p => p.coordinates));
				break;
			// 'all' - no filtering
		}

		// Apply sort
		switch (this.currentSort) {
			case 'duplicates-desc':
				groups.sort((a, b) => b.places.length - a.places.length);
				break;
			case 'duplicates-asc':
				groups.sort((a, b) => a.places.length - b.places.length);
				break;
			case 'name-asc':
				groups.sort((a, b) => a.suggestedCanonical.name.localeCompare(b.suggestedCanonical.name));
				break;
			case 'name-desc':
				groups.sort((a, b) => b.suggestedCanonical.name.localeCompare(a.suggestedCanonical.name));
				break;
		}

		this.filteredGroups = groups;
		this.updateStatusDisplay();
	}

	/**
	 * Render the duplicate groups
	 */
	private renderGroups(container: HTMLElement): void {
		container.empty();
		this.groupElements.clear();
		this.groupImpactElements.clear();
		this.groupApplyButtons.clear();

		if (this.filteredGroups.length === 0) {
			container.createEl('p', {
				text: 'No groups match the current filter.',
				cls: 'crc-text--muted crc-mt-2'
			});
			return;
		}

		for (const group of this.filteredGroups) {
			const groupEl = container.createDiv({ cls: 'crc-variation-group' });
			this.groupElements.set(group, groupEl);

			// Group header with merge button
			const groupHeader = groupEl.createDiv({ cls: 'crc-variation-group-header' });

			const headerInfo = groupHeader.createDiv({ cls: 'crc-variation-group-info' });
			headerInfo.createEl('strong', {
				text: `${group.places.length} place notes`,
				cls: 'crc-variation-count'
			});

			// Show match reason
			const reasonText = this.getMatchReasonText(group.matchReason);
			headerInfo.createEl('span', {
				text: ` • ${reasonText}`,
				cls: 'crc-text--muted'
			});

			// Merge button for this group
			const mergeBtn = groupHeader.createEl('button', {
				text: `Merge (${group.places.length - 1})`,
				cls: 'crc-btn crc-btn--small'
			});
			mergeBtn.title = `Merge ${group.places.length - 1} duplicate${group.places.length - 1 !== 1 ? 's' : ''} into the selected canonical place`;
			this.groupApplyButtons.set(group, mergeBtn);
			mergeBtn.addEventListener('click', () => void this.applyGroupMerge(group, groupEl, mergeBtn));

			// Radio buttons for each place note
			const placesEl = groupEl.createDiv({ cls: 'crc-variation-options' });
			const groupIndex = this.duplicateGroups.indexOf(group);

			for (const place of group.places) {
				const optionEl = placesEl.createDiv({ cls: 'crc-variation-option crc-duplicate-place-option' });

				const radioId = `place-${groupIndex}-${place.id}`;
				const radio = optionEl.createEl('input', {
					type: 'radio',
					cls: 'crc-radio'
				});
				radio.name = `group-${groupIndex}`;
				radio.id = radioId;
				radio.checked = this.selectedCanonicals.get(group)?.id === place.id;
				radio.addEventListener('change', () => {
					if (radio.checked) {
						this.selectedCanonicals.set(group, place);
						// Clear custom filename when changing selection
						this.newFilenames.delete(group);
						this.updateGroupImpactDisplay(group);
						this.updateFilenameDisplay(group);
					}
				});

				const label = optionEl.createEl('label', { cls: 'crc-radio-label crc-duplicate-place-label' });
				label.setAttribute('for', radioId);

				// Place name and file path
				const nameSpan = label.createEl('span', { cls: 'crc-duplicate-place-name' });
				nameSpan.createEl('strong', { text: place.name });

				// Open note button (outside label to avoid triggering radio)
				const openBtn = optionEl.createEl('button', {
					cls: 'crc-btn crc-btn--icon crc-btn--ghost crc-duplicate-open-btn',
					attr: { 'aria-label': 'Open note' }
				});
				openBtn.title = 'Open note to inspect content (right-click for options)';
				const openIcon = createLucideIcon('external-link', 14);
				openBtn.appendChild(openIcon);
				openBtn.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					this.openPlaceNote(place, 'tab');
				});
				openBtn.addEventListener('contextmenu', (e) => {
					e.preventDefault();
					e.stopPropagation();
					this.showOpenNoteMenu(e, place);
				});

				// Show file path
				label.createEl('span', {
					text: place.filePath,
					cls: 'crc-duplicate-place-path crc-text--muted'
				});

				// Show metadata completeness indicators
				const metaEl = label.createEl('div', { cls: 'crc-duplicate-place-meta' });

				// Parent place
				if (place.parentId) {
					const parent = this.placeService.getPlaceByCrId(place.parentId);
					metaEl.createEl('span', {
						text: `↑ ${parent?.name || 'Parent'}`,
						cls: 'crc-badge crc-badge--small'
					});
				}

				// Coordinates
				if (place.coordinates) {
					metaEl.createEl('span', {
						text: '📍 Coords',
						cls: 'crc-badge crc-badge--small crc-badge--success'
					});
				}

				// Place type
				if (place.placeType) {
					metaEl.createEl('span', {
						text: place.placeType,
						cls: 'crc-badge crc-badge--small'
					});
				}

				// Reference count
				const refCount = this.getPlaceReferenceCount(place);
				if (refCount > 0) {
					metaEl.createEl('span', {
						text: `${refCount} ref${refCount !== 1 ? 's' : ''}`,
						cls: 'crc-badge crc-badge--small crc-badge--info'
					});
				}

				// Suggested badge
				if (place.id === group.suggestedCanonical.id) {
					metaEl.createEl('span', {
						text: 'suggested',
						cls: 'crc-badge crc-badge--small crc-badge--accent'
					});
				}

				// Async: Check for note content, custom properties, and full_name
				void this.hasNoteContent(place).then(({ hasBody, bodyCharCount, hasCustomProps, fullName }) => {
					// Show full_name if available (inserted before other badges)
					if (fullName) {
						const fullNameEl = metaEl.createEl('span', {
							text: fullName,
							cls: 'crc-duplicate-place-fullname crc-text--muted'
						});
						fullNameEl.title = 'Full place hierarchy from GEDCOM import';
						// Insert at the beginning of metaEl
						metaEl.insertBefore(fullNameEl, metaEl.firstChild);
					}
					if (hasBody) {
						const charLabel = this.formatCharCount(bodyCharCount);
						const bodyBadge = metaEl.createEl('span', {
							text: charLabel,
							cls: 'crc-badge crc-badge--small crc-badge--warning'
						});
						bodyBadge.title = `This note has ${bodyCharCount.toLocaleString()} characters of text content below the frontmatter`;
					}
					if (hasCustomProps) {
						const propsBadge = metaEl.createEl('span', {
							text: 'custom props',
							cls: 'crc-badge crc-badge--small crc-badge--warning'
						});
						propsBadge.title = 'This note has non-standard frontmatter properties';
					}
				});
			}

			// Impact display area
			const impactEl = groupEl.createDiv({ cls: 'crc-variation-impact' });
			this.groupImpactElements.set(group, impactEl);
			this.updateGroupImpactDisplay(group);

			// Filename edit section
			const filenameEl = groupEl.createDiv({ cls: 'crc-duplicate-filename-section' });
			this.groupFilenameElements.set(group, filenameEl);
			this.updateFilenameDisplay(group);
		}
	}

	/**
	 * Update the filename display for a group based on current selection
	 */
	private updateFilenameDisplay(group: DuplicatePlaceGroup): void {
		const filenameEl = this.groupFilenameElements.get(group);
		if (!filenameEl) return;

		filenameEl.empty();

		const canonical = this.selectedCanonicals.get(group);
		if (!canonical) return;

		// Extract current filename (without path and extension)
		const currentFilename = canonical.filePath.split('/').pop()?.replace(/\.md$/, '') || '';
		const newFilename = this.newFilenames.get(group);
		const displayFilename = newFilename ?? currentFilename;

		const container = filenameEl.createDiv({ cls: 'crc-filename-row' });

		container.createEl('span', {
			text: 'Final filename:',
			cls: 'crc-text--muted'
		});

		const filenameDisplay = container.createEl('span', {
			text: displayFilename + '.md',
			cls: newFilename ? 'crc-filename-edited' : 'crc-filename-original'
		});

		// Edit button
		const editBtn = container.createEl('button', {
			cls: 'crc-btn crc-btn--icon crc-btn--ghost crc-btn--small',
			attr: { 'aria-label': 'Edit filename' }
		});
		editBtn.title = 'Change filename after merge';
		editBtn.appendChild(createLucideIcon('edit', 14));
		editBtn.addEventListener('click', (e) => {
			e.preventDefault();
			this.showFilenameEditor(group, filenameEl, currentFilename);
		});

		// Reset button (only show if filename was changed)
		if (newFilename) {
			const resetBtn = container.createEl('button', {
				cls: 'crc-btn crc-btn--icon crc-btn--ghost crc-btn--small',
				attr: { 'aria-label': 'Reset filename' }
			});
			resetBtn.title = 'Reset to original filename';
			resetBtn.appendChild(createLucideIcon('undo-2', 14));
			resetBtn.addEventListener('click', (e) => {
				e.preventDefault();
				this.newFilenames.delete(group);
				this.updateFilenameDisplay(group);
			});
		}
	}

	/**
	 * Show inline filename editor
	 */
	private showFilenameEditor(group: DuplicatePlaceGroup, container: HTMLElement, currentFilename: string): void {
		container.empty();

		const editorRow = container.createDiv({ cls: 'crc-filename-editor' });

		editorRow.createEl('span', {
			text: 'Final filename:',
			cls: 'crc-text--muted'
		});

		const input = editorRow.createEl('input', {
			type: 'text',
			cls: 'crc-input crc-filename-input',
			value: this.newFilenames.get(group) ?? currentFilename
		});
		input.placeholder = currentFilename;

		const suffix = editorRow.createEl('span', {
			text: '.md',
			cls: 'crc-text--muted'
		});

		const saveBtn = editorRow.createEl('button', {
			cls: 'crc-btn crc-btn--small crc-btn--primary',
			text: 'Save'
		});
		saveBtn.addEventListener('click', () => {
			const value = input.value.trim();
			if (value && value !== currentFilename) {
				// Sanitize filename (remove invalid characters)
				const sanitized = value.replace(/[\\/:*?"<>|]/g, '-');
				this.newFilenames.set(group, sanitized);
			} else {
				this.newFilenames.delete(group);
			}
			this.updateFilenameDisplay(group);
		});

		const cancelBtn = editorRow.createEl('button', {
			cls: 'crc-btn crc-btn--small',
			text: 'Cancel'
		});
		cancelBtn.addEventListener('click', () => {
			this.updateFilenameDisplay(group);
		});

		// Handle Enter and Escape keys
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				saveBtn.click();
			} else if (e.key === 'Escape') {
				cancelBtn.click();
			}
		});

		// Focus the input
		input.focus();
		input.select();
	}

	/**
	 * Get human-readable match reason text
	 */
	private getMatchReasonText(reason: 'exact_name' | 'similar_name' | 'same_parent_and_name' | 'similar_full_name' | 'same_parent_shared_base' | 'state_abbreviation_variant'): string {
		switch (reason) {
			case 'exact_name':
				return 'exact name match';
			case 'similar_name':
				return 'similar names';
			case 'same_parent_and_name':
				return 'same name and parent';
			case 'similar_full_name':
				return 'similar full name';
			case 'same_parent_shared_base':
				return 'same parent, shared base name';
			case 'state_abbreviation_variant':
				return 'state abbreviation variant';
			default:
				return 'potential duplicate';
		}
	}

	/**
	 * Get the count of references to a place from person notes
	 */
	private getPlaceReferenceCount(place: PlaceNode): number {
		this.placeService.ensureCacheLoaded();
		const refs = this.placeService.getPlaceReferences();
		return refs.filter(r => r.placeId === place.id || r.rawValue === place.name).length;
	}

	/**
	 * Format character count for display (e.g., "1.2k chars", "500 chars")
	 */
	private formatCharCount(count: number): string {
		if (count >= 1000) {
			const k = count / 1000;
			return `${k.toFixed(k >= 10 ? 0 : 1)}k chars`;
		}
		return `${count} chars`;
	}

	/**
	 * Check if a place note has body content (text below the frontmatter)
	 * Also returns the full_name property if present
	 */
	private async hasNoteContent(place: PlaceNode): Promise<{ hasBody: boolean; bodyCharCount: number; hasCustomProps: boolean; fullName?: string }> {
		const file = this.app.vault.getAbstractFileByPath(place.filePath);
		if (!(file instanceof TFile)) {
			return { hasBody: false, bodyCharCount: 0, hasCustomProps: false };
		}

		const content = await this.app.vault.read(file);
		const cache = this.app.metadataCache.getFileCache(file);

		// Check for body content (anything after frontmatter)
		let hasBody = false;
		let bodyCharCount = 0;
		const lines = content.split('\n');
		if (lines[0] === '---') {
			let endIndex = -1;
			for (let i = 1; i < lines.length; i++) {
				if (lines[i] === '---') {
					endIndex = i;
					break;
				}
			}
			if (endIndex !== -1) {
				// Check if there's non-whitespace content after frontmatter
				const bodyContent = lines.slice(endIndex + 1).join('\n').trim();
				bodyCharCount = bodyContent.length;
				hasBody = bodyCharCount > 0;
			}
		}

		// Check for custom properties (non-standard place properties)
		let hasCustomProps = false;
		let fullName: string | undefined;
		if (cache?.frontmatter) {
			const standardProps = new Set([
				'cr_id', 'cr_type', 'type', 'name', 'title', 'aliases',
				'parent', 'parent_place', 'parent_place_id',
				'place_type', 'place_category', 'universe', 'collection',
				'coordinates', 'coordinates_lat', 'coordinates_long',
				'custom_coordinates', 'custom_coordinates_x', 'custom_coordinates_y', 'custom_coordinates_map',
				'tags', 'cssclasses', 'position', // common Obsidian props
				'full_name' // GEDCOM import property
			]);
			for (const key of Object.keys(cache.frontmatter)) {
				if (!standardProps.has(key)) {
					hasCustomProps = true;
					break;
				}
			}
			// Extract full_name if present
			if (cache.frontmatter.full_name && typeof cache.frontmatter.full_name === 'string') {
				fullName = cache.frontmatter.full_name;
			}
		}

		return { hasBody, bodyCharCount, hasCustomProps, fullName };
	}

	/**
	 * Open a place note in a new pane
	 */
	private openPlaceNote(place: PlaceNode, mode: 'tab' | 'split' | 'window' = 'tab'): void {
		const file = this.app.vault.getAbstractFileByPath(place.filePath);
		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf(mode);
			void leaf.openFile(file);
		}
	}

	/**
	 * Show context menu for opening a place note
	 */
	private showOpenNoteMenu(event: MouseEvent, place: PlaceNode): void {
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle('Open in new tab')
				.setIcon('file-plus')
				.onClick(() => this.openPlaceNote(place, 'tab'));
		});

		menu.addItem((item) => {
			item.setTitle('Open to the right')
				.setIcon('separator-vertical')
				.onClick(() => this.openPlaceNote(place, 'split'));
		});

		menu.addItem((item) => {
			item.setTitle('Open in new window')
				.setIcon('picture-in-picture-2')
				.onClick(() => this.openPlaceNote(place, 'window'));
		});

		menu.showAtMouseEvent(event);
	}

	/**
	 * Update the impact display for a group based on current selection
	 */
	private updateGroupImpactDisplay(group: DuplicatePlaceGroup): void {
		const impactEl = this.groupImpactElements.get(group);
		const mergeBtn = this.groupApplyButtons.get(group);
		if (!impactEl) return;

		impactEl.empty();

		const canonical = this.selectedCanonicals.get(group);
		if (!canonical) return;

		const duplicates = group.places.filter(p => p.id !== canonical.id);
		const duplicateCount = duplicates.length;

		// Update button label
		if (mergeBtn && !mergeBtn.disabled) {
			mergeBtn.textContent = `Merge (${duplicateCount})`;
			mergeBtn.title = `Merge ${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''} into "${canonical.name}"`;
		}

		// Calculate what will be updated
		let totalRefsToUpdate = 0;
		let childPlacesToUpdate = 0;

		for (const dup of duplicates) {
			totalRefsToUpdate += this.getPlaceReferenceCount(dup);
			// Count child places that have this as parent
			const children = this.placeService.getChildren(dup.id);
			childPlacesToUpdate += children.length;
		}

		const impactText = impactEl.createEl('div', { cls: 'crc-impact-message' });

		impactText.createEl('span', {
			text: `Keep "${canonical.name}" (${canonical.filePath})`,
			cls: 'crc-text--accent'
		});

		const detailsEl = impactText.createEl('div', { cls: 'crc-impact-details' });

		if (duplicateCount > 0) {
			detailsEl.createEl('span', {
				text: `• ${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''} will be moved to trash`,
				cls: 'crc-text--muted'
			});
		}

		if (totalRefsToUpdate > 0) {
			detailsEl.createEl('span', {
				text: `• ${totalRefsToUpdate} person reference${totalRefsToUpdate !== 1 ? 's' : ''} will be updated`,
				cls: 'crc-text--muted'
			});
		}

		if (childPlacesToUpdate > 0) {
			detailsEl.createEl('span', {
				text: `• ${childPlacesToUpdate} child place${childPlacesToUpdate !== 1 ? 's' : ''} will be re-parented`,
				cls: 'crc-text--muted'
			});
		}
	}

	/**
	 * Apply merge for a single group
	 */
	private async applyGroupMerge(
		group: DuplicatePlaceGroup,
		groupEl: HTMLElement,
		mergeBtn: HTMLButtonElement
	): Promise<void> {
		const canonical = this.selectedCanonicals.get(group);
		if (!canonical) return;

		// Disable the button while processing
		mergeBtn.disabled = true;
		mergeBtn.textContent = 'Merging...';

		const duplicates = group.places.filter(p => p.id !== canonical.id);
		let refsUpdated = 0;
		let childrenReparented = 0;
		let filesDeleted = 0;
		const errors: string[] = [];

		for (const duplicate of duplicates) {
			try {
				// 1. Update person notes that reference this duplicate
				const personRefsUpdated = await this.updatePersonReferences(duplicate, canonical);
				refsUpdated += personRefsUpdated;

				// 2. Update child places to point to canonical
				const childrenUpdated = await this.reparentChildPlaces(duplicate, canonical);
				childrenReparented += childrenUpdated;

				// 3. Move duplicate file to trash
				const duplicateFile = this.app.vault.getAbstractFileByPath(duplicate.filePath);
				if (duplicateFile instanceof TFile) {
					await this.app.fileManager.trashFile(duplicateFile);
					filesDeleted++;
				}
			} catch (error) {
				errors.push(`${duplicate.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		// 4. Rename canonical file if a new filename was specified
		const newFilename = this.newFilenames.get(group);
		let renamed = false;
		if (newFilename) {
			try {
				const canonicalFile = this.app.vault.getAbstractFileByPath(canonical.filePath);
				if (canonicalFile instanceof TFile) {
					const dir = canonical.filePath.substring(0, canonical.filePath.lastIndexOf('/'));
					const newPath = dir ? `${dir}/${newFilename}.md` : `${newFilename}.md`;
					await this.app.fileManager.renameFile(canonicalFile, newPath);
					renamed = true;
				}
			} catch (error) {
				errors.push(`Rename failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		this.totalMerged += refsUpdated + childrenReparented;
		this.totalDeleted += filesDeleted;
		this.appliedGroups.add(group);

		// Update the group element to show completion
		groupEl.addClass('crc-variation-group--applied');
		mergeBtn.textContent = `Done (${filesDeleted} deleted)`;
		mergeBtn.addClass('crc-btn--success');

		// Disable radio buttons and hide filename editor
		const radios = groupEl.querySelectorAll('input[type="radio"]');
		radios.forEach(radio => (radio as HTMLInputElement).disabled = true);
		const filenameSection = this.groupFilenameElements.get(group);
		if (filenameSection) {
			filenameSection.empty();
			if (renamed && newFilename) {
				filenameSection.createEl('span', {
					text: `✓ Renamed to ${newFilename}.md`,
					cls: 'crc-text--success'
				});
			}
		}

		if (errors.length > 0) {
			console.error('Errors during merge:', errors);
			new Notice(`Merged with ${errors.length} errors. Check console for details.`);
		} else {
			const renameMsg = renamed ? ` and renamed to "${newFilename}.md"` : '';
			new Notice(`Merged ${filesDeleted} duplicate${filesDeleted !== 1 ? 's' : ''} into "${canonical.name}"${renameMsg}`);
		}
	}

	/**
	 * Apply all remaining merges
	 */
	private async applyAllMerges(): Promise<void> {
		let totalDeleted = 0;
		let totalRefsUpdated = 0;
		let totalRenamed = 0;
		const errors: string[] = [];

		for (const group of this.duplicateGroups) {
			if (this.appliedGroups.has(group)) continue;

			const canonical = this.selectedCanonicals.get(group);
			if (!canonical) continue;

			const duplicates = group.places.filter(p => p.id !== canonical.id);

			for (const duplicate of duplicates) {
				try {
					// Update person references
					const refsUpdated = await this.updatePersonReferences(duplicate, canonical);
					totalRefsUpdated += refsUpdated;

					// Reparent children
					await this.reparentChildPlaces(duplicate, canonical);

					// Move to trash
					const duplicateFile = this.app.vault.getAbstractFileByPath(duplicate.filePath);
					if (duplicateFile instanceof TFile) {
						await this.app.fileManager.trashFile(duplicateFile);
						totalDeleted++;
					}
				} catch (error) {
					errors.push(`${duplicate.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
				}
			}

			// Rename canonical file if a new filename was specified
			const newFilename = this.newFilenames.get(group);
			if (newFilename) {
				try {
					const canonicalFile = this.app.vault.getAbstractFileByPath(canonical.filePath);
					if (canonicalFile instanceof TFile) {
						const dir = canonical.filePath.substring(0, canonical.filePath.lastIndexOf('/'));
						const newPath = dir ? `${dir}/${newFilename}.md` : `${newFilename}.md`;
						await this.app.fileManager.renameFile(canonicalFile, newPath);
						totalRenamed++;
					}
				} catch (error) {
					errors.push(`Rename "${canonical.name}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
				}
			}

			this.appliedGroups.add(group);
		}

		this.totalMerged += totalRefsUpdated;
		this.totalDeleted += totalDeleted;

		if (errors.length > 0) {
			console.error('Errors during bulk merge:', errors);
			new Notice(`Merged ${totalDeleted} duplicates with ${errors.length} errors`);
		} else if (totalDeleted > 0) {
			const renameMsg = totalRenamed > 0 ? `, renamed ${totalRenamed}` : '';
			new Notice(`Merged ${totalDeleted} duplicate place note${totalDeleted !== 1 ? 's' : ''}${renameMsg}`);
		} else {
			new Notice('No duplicates to merge');
		}

		if (this.onComplete) {
			this.onComplete(this.totalMerged, this.totalDeleted);
		}

		this.close();
	}

	/**
	 * Update person notes that reference the duplicate place to reference the canonical instead
	 */
	private async updatePersonReferences(duplicate: PlaceNode, canonical: PlaceNode): Promise<number> {
		let updated = 0;
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;

			// Skip place notes
			if (fm.cr_type === 'place') continue;

			// Check if any place fields reference the duplicate
			const fieldsToUpdate: Array<{ field: string; isId: boolean }> = [];

			// Check birth place
			if (this.placeMatches(fm.birth_place, duplicate)) {
				fieldsToUpdate.push({ field: 'birth_place', isId: false });
			}
			if (fm.birth_place_id === duplicate.id) {
				fieldsToUpdate.push({ field: 'birth_place_id', isId: true });
			}

			// Check death place
			if (this.placeMatches(fm.death_place, duplicate)) {
				fieldsToUpdate.push({ field: 'death_place', isId: false });
			}
			if (fm.death_place_id === duplicate.id) {
				fieldsToUpdate.push({ field: 'death_place_id', isId: true });
			}

			// Check burial place
			if (this.placeMatches(fm.burial_place, duplicate)) {
				fieldsToUpdate.push({ field: 'burial_place', isId: false });
			}
			if (fm.burial_place_id === duplicate.id) {
				fieldsToUpdate.push({ field: 'burial_place_id', isId: true });
			}

			// Check spouse marriage locations
			let spouseIndex = 1;
			while (fm[`spouse${spouseIndex}`] || fm[`spouse${spouseIndex}_id`]) {
				if (this.placeMatches(fm[`spouse${spouseIndex}_marriage_location`], duplicate)) {
					fieldsToUpdate.push({ field: `spouse${spouseIndex}_marriage_location`, isId: false });
				}
				spouseIndex++;
			}

			if (fieldsToUpdate.length > 0) {
				await this.updateFilePlaceReferences(file, fieldsToUpdate, duplicate, canonical);
				updated += fieldsToUpdate.length;
			}
		}

		return updated;
	}

	/**
	 * Check if a frontmatter value matches a place (by name or wikilink)
	 */
	private placeMatches(value: unknown, place: PlaceNode): boolean {
		if (!value) return false;
		const str = String(value);

		// Check for wikilink match
		const wikilinkMatch = str.match(/\[\[([^\]|#]+)/);
		if (wikilinkMatch) {
			const linkTarget = wikilinkMatch[1];
			// Match if link target equals place name or file basename
			const fileBasename = place.filePath.replace(/\.md$/, '').split('/').pop();
			return linkTarget === place.name || linkTarget === fileBasename;
		}

		// Plain text match
		return str === place.name;
	}

	/**
	 * Update place references in a file's frontmatter
	 */
	private async updateFilePlaceReferences(
		file: TFile,
		fields: Array<{ field: string; isId: boolean }>,
		duplicate: PlaceNode,
		canonical: PlaceNode
	): Promise<void> {
		const content = await this.app.vault.read(file);
		const lines = content.split('\n');

		// Find frontmatter boundaries
		if (lines[0] !== '---') return;

		let endIndex = -1;
		for (let i = 1; i < lines.length; i++) {
			if (lines[i] === '---') {
				endIndex = i;
				break;
			}
		}

		if (endIndex === -1) return;

		// Update matching fields
		for (let i = 1; i < endIndex; i++) {
			const line = lines[i];
			for (const { field, isId } of fields) {
				const regex = new RegExp(`^(${field}:\\s*)(.+)$`);
				const match = line.match(regex);
				if (match) {
					let newValue: string;
					if (isId) {
						// For ID fields, just replace with canonical ID
						newValue = canonical.id;
					} else {
						// For name/wikilink fields, preserve wikilink format
						const oldVal = match[2];
						if (oldVal.includes('[[')) {
							newValue = `"[[${canonical.name}]]"`;
						} else if (oldVal.startsWith('"') || oldVal.startsWith("'")) {
							newValue = `"${canonical.name}"`;
						} else {
							newValue = canonical.name.includes(':') ? `"${canonical.name}"` : canonical.name;
						}
					}
					lines[i] = `${match[1]}${newValue}`;
				}
			}
		}

		await this.app.vault.modify(file, lines.join('\n'));
	}

	/**
	 * Update child places to point to canonical instead of duplicate
	 */
	private async reparentChildPlaces(duplicate: PlaceNode, canonical: PlaceNode): Promise<number> {
		const children = this.placeService.getChildren(duplicate.id);
		let updated = 0;

		for (const child of children) {
			const childFile = this.app.vault.getAbstractFileByPath(child.filePath);
			if (!(childFile instanceof TFile)) continue;

			const content = await this.app.vault.read(childFile);
			const lines = content.split('\n');

			if (lines[0] !== '---') continue;

			let endIndex = -1;
			for (let i = 1; i < lines.length; i++) {
				if (lines[i] === '---') {
					endIndex = i;
					break;
				}
			}

			if (endIndex === -1) continue;

			let modified = false;
			for (let i = 1; i < endIndex; i++) {
				const line = lines[i];

				// Update parent_place_id
				if (line.match(/^parent_place_id:\s*/)) {
					lines[i] = `parent_place_id: ${canonical.id}`;
					modified = true;
				}

				// Update parent_place wikilink
				const parentPlaceMatch = line.match(/^(parent_place:\s*)(.+)$/);
				if (parentPlaceMatch) {
					const oldVal = parentPlaceMatch[2];
					if (oldVal.includes('[[')) {
						lines[i] = `${parentPlaceMatch[1]}"[[${canonical.name}]]"`;
					} else {
						lines[i] = `${parentPlaceMatch[1]}"[[${canonical.name}]]"`;
					}
					modified = true;
				}

				// Also check 'parent' property (used by GEDCOM import)
				const parentMatch = line.match(/^(parent:\s*)(.+)$/);
				if (parentMatch && !line.match(/^parent_place/)) {
					const oldVal = parentMatch[2];
					if (oldVal.includes('[[')) {
						lines[i] = `${parentMatch[1]}"[[${canonical.name}]]"`;
					} else {
						lines[i] = `${parentMatch[1]}"[[${canonical.name}]]"`;
					}
					modified = true;
				}
			}

			if (modified) {
				await this.app.vault.modify(childFile, lines.join('\n'));
				updated++;
			}
		}

		return updated;
	}
}

/**
 * Options for finding duplicate place notes
 */
interface FindDuplicatesOptions {
	settings?: CanvasRootsSettings;
	folderFilter?: FolderFilterService | null;
}

/**
 * Normalize a full_name for comparison
 * - Lowercase
 * - Remove common trailing country suffixes (", USA", ", United States", etc.)
 * - Trim whitespace
 */
function normalizeFullName(fullName: string): string {
	let normalized = fullName.toLowerCase().trim();

	// Remove common trailing country/region suffixes
	const suffixesToRemove = [
		/, usa$/,
		/, united states$/,
		/, united states of america$/,
		/, u\.s\.a\.$/,
		/, uk$/,
		/, united kingdom$/,
		/, great britain$/,
		/, england$/,
		/, canada$/,
		/, australia$/,
		/, germany$/,
		/, france$/,
		/, italy$/,
		/, spain$/
	];

	for (const suffix of suffixesToRemove) {
		normalized = normalized.replace(suffix, '');
	}

	return normalized.trim();
}

/**
 * Get the full_name property from a place's frontmatter
 */
function getPlaceFullName(app: App, place: PlaceNode): string | null {
	const file = app.vault.getAbstractFileByPath(place.filePath);
	if (!(file instanceof TFile)) return null;

	const cache = app.metadataCache.getFileCache(file);
	if (!cache?.frontmatter?.full_name) return null;

	const fullName = cache.frontmatter.full_name;
	return typeof fullName === 'string' ? fullName : null;
}

/**
 * Find groups of duplicate place notes
 * Groups places with the same name AND equivalent parents (same parent name)
 * Also groups places with similar full_name values (normalized)
 * This handles cases where parent places are themselves duplicates
 */
export function findDuplicatePlaceNotes(app: App, options: FindDuplicatesOptions = {}): DuplicatePlaceGroup[] {
	const placeService = new PlaceGraphService(app);

	// Configure the service with settings and folder filter
	if (options.settings) {
		placeService.setSettings(options.settings);
	}
	if (options.folderFilter) {
		placeService.setFolderFilter(options.folderFilter);
	}

	placeService.reloadCache();

	const allPlaces = placeService.getAllPlaces();
	const groups: DuplicatePlaceGroup[] = [];

	// Track which places have been grouped (to avoid double-grouping)
	const groupedPlaceIds = new Set<string>();

	// Helper to get the parent's name (normalized) for grouping
	// This allows us to group places whose parents have the same name
	// even if the parent IDs are different (parent places are duplicates)
	function getParentNameKey(place: PlaceNode): string {
		if (!place.parentId) {
			return 'ROOT';
		}
		const parent = placeService.getPlaceByCrId(place.parentId);
		if (!parent) {
			// Parent not found - use the ID as fallback
			return place.parentId;
		}
		// Use the parent's name (lowercase) as the grouping key
		return parent.name.toLowerCase();
	}

	// === Pass 1: Group by name + parent name (both case-insensitive) ===
	// This groups places that have:
	// 1. Same name
	// 2. Parents with the same name (even if different parent IDs)
	const parentNameGroupingMap = new Map<string, PlaceNode[]>();

	for (const place of allPlaces) {
		const lowerName = place.name.toLowerCase();
		const parentNameKey = getParentNameKey(place);

		// Create a composite key: name + parent name
		const groupKey = `${lowerName}::${parentNameKey}`;

		if (!parentNameGroupingMap.has(groupKey)) {
			parentNameGroupingMap.set(groupKey, []);
		}
		parentNameGroupingMap.get(groupKey)!.push(place);
	}

	for (const [, places] of parentNameGroupingMap) {
		if (places.length > 1) {
			// Find the best canonical (most complete data)
			const suggestedCanonical = selectBestCanonical(places, placeService);

			groups.push({
				places,
				suggestedCanonical,
				matchReason: 'same_parent_and_name'
			});

			// Mark these places as grouped
			for (const place of places) {
				groupedPlaceIds.add(place.id);
			}
		}
	}

	// === Pass 2: Group by normalized full_name ===
	// This catches places like "Hartford, CT" and "Hartford, CT, USA"
	// which have different parents but represent the same location
	const fullNameGroupingMap = new Map<string, PlaceNode[]>();

	for (const place of allPlaces) {
		// Skip places already grouped in Pass 1
		if (groupedPlaceIds.has(place.id)) continue;

		const fullName = getPlaceFullName(app, place);
		if (!fullName) continue;

		const normalizedFullName = normalizeFullName(fullName);
		if (!normalizedFullName) continue;

		if (!fullNameGroupingMap.has(normalizedFullName)) {
			fullNameGroupingMap.set(normalizedFullName, []);
		}
		fullNameGroupingMap.get(normalizedFullName)!.push(place);
	}

	for (const [, places] of fullNameGroupingMap) {
		if (places.length > 1) {
			// Find the best canonical (most complete data)
			const suggestedCanonical = selectBestCanonical(places, placeService);

			groups.push({
				places,
				suggestedCanonical,
				matchReason: 'similar_full_name'
			});

			// Mark these places as grouped
			for (const place of places) {
				groupedPlaceIds.add(place.id);
			}
		}
	}

	// === Pass 3: Check if any ungrouped places match already-grouped places by full_name ===
	// This handles the case where one Hartford was grouped (by parent) but another Hartford
	// with a different parent has a matching full_name
	for (const place of allPlaces) {
		if (groupedPlaceIds.has(place.id)) continue;

		const fullName = getPlaceFullName(app, place);
		if (!fullName) continue;

		const normalizedFullName = normalizeFullName(fullName);
		if (!normalizedFullName) continue;

		// Check if this place matches any place in existing groups
		for (const group of groups) {
			for (const groupedPlace of group.places) {
				const groupedFullName = getPlaceFullName(app, groupedPlace);
				if (!groupedFullName) continue;

				const normalizedGroupedFullName = normalizeFullName(groupedFullName);
				if (normalizedFullName === normalizedGroupedFullName) {
					// Add this place to the existing group
					group.places.push(place);
					groupedPlaceIds.add(place.id);

					// Update match reason if it was same_parent_and_name
					if (group.matchReason === 'same_parent_and_name') {
						group.matchReason = 'similar_full_name';
					}

					// Recalculate best canonical
					group.suggestedCanonical = selectBestCanonical(group.places, placeService);
					break;
				}
			}
			if (groupedPlaceIds.has(place.id)) break;
		}
	}

	// === Pass 4: Group by same parent + shared base name ===
	// This catches fragmented GEDCOM imports where the same location creates multiple notes
	// e.g., "Abbeville", "Abbeville SC" with the same parent
	//
	// IMPORTANT: We separate administrative divisions (County, Parish, etc.) from settlements
	// to avoid grouping "Abbeville County" with "Abbeville" (the city) - they're different entities
	const parentIdGroupingMap = new Map<string, PlaceNode[]>();

	for (const place of allPlaces) {
		// Skip places already grouped in earlier passes
		if (groupedPlaceIds.has(place.id)) continue;
		// Only consider places with a parent
		if (!place.parentId) continue;

		if (!parentIdGroupingMap.has(place.parentId)) {
			parentIdGroupingMap.set(place.parentId, []);
		}
		parentIdGroupingMap.get(place.parentId)!.push(place);
	}

	// For each parent, check if any children share a base name
	for (const [, siblings] of parentIdGroupingMap) {
		if (siblings.length < 2) continue;

		// First, separate siblings into administrative divisions vs settlements
		const adminPlaces: PlaceNode[] = [];
		const settlementPlaces: PlaceNode[] = [];

		for (const place of siblings) {
			if (isAdministrativeDivision(place.name)) {
				adminPlaces.push(place);
			} else {
				settlementPlaces.push(place);
			}
		}

		// Group administrative divisions by base name (e.g., multiple "Abbeville County" variants)
		const adminBaseNameGroups = new Map<string, PlaceNode[]>();
		for (const place of adminPlaces) {
			const baseName = extractBaseName(place.name);
			if (!baseName) continue;

			if (!adminBaseNameGroups.has(baseName)) {
				adminBaseNameGroups.set(baseName, []);
			}
			adminBaseNameGroups.get(baseName)!.push(place);
		}

		// Group settlements by base name (e.g., "Abbeville", "Abbeville SC")
		const settlementBaseNameGroups = new Map<string, PlaceNode[]>();
		for (const place of settlementPlaces) {
			const baseName = extractBaseName(place.name);
			if (!baseName) continue;

			if (!settlementBaseNameGroups.has(baseName)) {
				settlementBaseNameGroups.set(baseName, []);
			}
			settlementBaseNameGroups.get(baseName)!.push(place);
		}

		// Create duplicate groups for administrative divisions sharing the same base name
		for (const [, placesWithSameBase] of adminBaseNameGroups) {
			if (placesWithSameBase.length > 1) {
				const suggestedCanonical = selectBestCanonical(placesWithSameBase, placeService);

				groups.push({
					places: placesWithSameBase,
					suggestedCanonical,
					matchReason: 'same_parent_shared_base'
				});

				for (const place of placesWithSameBase) {
					groupedPlaceIds.add(place.id);
				}
			}
		}

		// Create duplicate groups for settlements sharing the same base name
		for (const [, placesWithSameBase] of settlementBaseNameGroups) {
			if (placesWithSameBase.length > 1) {
				const suggestedCanonical = selectBestCanonical(placesWithSameBase, placeService);

				groups.push({
					places: placesWithSameBase,
					suggestedCanonical,
					matchReason: 'same_parent_shared_base'
				});

				for (const place of placesWithSameBase) {
					groupedPlaceIds.add(place.id);
				}
			}
		}
	}

	// === Pass 5: Group places with state abbreviation variants ===
	// This detects places like "Abbeville SC" and "Abbeville South Carolina"
	// that differ only in state name format (abbreviated vs full)
	//
	// Strategy: Extract "base name + normalized state" from places that have a state component,
	// then group by this normalized key. This catches:
	// - "Abbeville SC" → key: "abbeville|south carolina"
	// - "Abbeville South Carolina" → key: "abbeville|south carolina"
	// - "Abbeville" (plain) → no state component, won't match
	const stateNormalizedGroups = new Map<string, PlaceNode[]>();

	for (const place of allPlaces) {
		if (groupedPlaceIds.has(place.id)) continue;

		// Extract base name and state component (if any)
		// Try the place name first, then fall back to filename (basename without extension)
		// This handles cases where title: "Abbeville" but filename is "Abbeville South Carolina.md"
		let stateKey = extractBaseNameAndState(place.name);
		if (!stateKey) {
			// Extract filename from path (without .md extension)
			const filename = place.filePath.split('/').pop()?.replace(/\.md$/, '') || '';
			stateKey = extractBaseNameAndState(filename);
		}

		// Only group places that have a recognizable state component
		if (!stateKey) continue;

		if (!stateNormalizedGroups.has(stateKey)) {
			stateNormalizedGroups.set(stateKey, []);
		}
		stateNormalizedGroups.get(stateKey)!.push(place);
	}

	// Create duplicate groups for places with the same base name + state
	for (const [, placesWithSameKey] of stateNormalizedGroups) {
		if (placesWithSameKey.length < 2) continue;

		const suggestedCanonical = selectBestCanonical(placesWithSameKey, placeService);

		groups.push({
			places: placesWithSameKey,
			suggestedCanonical,
			matchReason: 'state_abbreviation_variant'
		});

		for (const place of placesWithSameKey) {
			groupedPlaceIds.add(place.id);
		}
	}

	// === Pass 6: Fuzzy name matching for misspellings ===
	// This catches places like "Massachusetts", "Massachusettes", "Masachussettes"
	// that have the same parent but misspelled names
	//
	// Strategy: For ungrouped places with the same parent, compare names using
	// Levenshtein distance and group those with high similarity (>= 75%)
	const MIN_FUZZY_SIMILARITY = 75; // Minimum similarity percentage to consider a match

	// Group remaining ungrouped places by parent
	const ungroupedByParent = new Map<string, PlaceNode[]>();
	for (const place of allPlaces) {
		if (groupedPlaceIds.has(place.id)) continue;

		const parentKey = place.parentId || 'ROOT';
		if (!ungroupedByParent.has(parentKey)) {
			ungroupedByParent.set(parentKey, []);
		}
		ungroupedByParent.get(parentKey)!.push(place);
	}

	// For each parent group, find fuzzy matches
	for (const [, siblings] of ungroupedByParent) {
		if (siblings.length < 2) continue;

		// Track which siblings have been grouped in this pass
		const groupedInPass = new Set<string>();

		for (let i = 0; i < siblings.length; i++) {
			if (groupedInPass.has(siblings[i].id)) continue;

			const fuzzyGroup: PlaceNode[] = [siblings[i]];
			groupedInPass.add(siblings[i].id);

			for (let j = i + 1; j < siblings.length; j++) {
				if (groupedInPass.has(siblings[j].id)) continue;

				// Skip if both are distinct known US states (avoid "South Carolina" vs "North Carolina")
				if (areBothDistinctKnownStates(siblings[i].name, siblings[j].name)) {
					continue;
				}

				// Skip if names differ only by geographic prefix (avoid "West Hartford" vs "New Hartford")
				if (differOnlyByGeographicPrefix(siblings[i].name, siblings[j].name)) {
					continue;
				}

				// Skip if names share same suffix but different base names (avoid "Ware County" vs "Dade County")
				if (shareGeographicSuffixOnly(siblings[i].name, siblings[j].name)) {
					continue;
				}

				// Calculate similarity between the two names
				const similarity = calculateNameSimilarity(siblings[i].name, siblings[j].name);

				if (similarity >= MIN_FUZZY_SIMILARITY) {
					fuzzyGroup.push(siblings[j]);
					groupedInPass.add(siblings[j].id);
				}
			}

			// If we found fuzzy matches, create a group
			if (fuzzyGroup.length > 1) {
				const suggestedCanonical = selectBestCanonical(fuzzyGroup, placeService);

				groups.push({
					places: fuzzyGroup,
					suggestedCanonical,
					matchReason: 'similar_name'
				});

				for (const place of fuzzyGroup) {
					groupedPlaceIds.add(place.id);
				}
			}
		}
	}

	// Sort groups by number of duplicates (most first)
	groups.sort((a, b) => b.places.length - a.places.length);

	return groups;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
	const m = str1.length;
	const n = str2.length;

	// Create a 2D array for dynamic programming
	const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

	// Initialize base cases
	for (let i = 0; i <= m; i++) dp[i][0] = i;
	for (let j = 0; j <= n; j++) dp[0][j] = j;

	// Fill in the rest of the matrix
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
			dp[i][j] = Math.min(
				dp[i - 1][j] + 1,      // deletion
				dp[i][j - 1] + 1,      // insertion
				dp[i - 1][j - 1] + cost // substitution
			);
		}
	}

	return dp[m][n];
}

/**
 * Calculate name similarity as a percentage (0-100)
 * Uses Levenshtein distance normalized by the longer string length
 */
function calculateNameSimilarity(name1: string, name2: string): number {
	// Normalize names: lowercase, trim
	const n1 = name1.toLowerCase().trim();
	const n2 = name2.toLowerCase().trim();

	if (n1 === n2) return 100;
	if (n1.length === 0 || n2.length === 0) return 0;

	const distance = levenshteinDistance(n1, n2);
	const maxLength = Math.max(n1.length, n2.length);

	// Convert distance to similarity percentage
	return Math.round((1 - distance / maxLength) * 100);
}

/**
 * Check if both names are distinct known US states
 * This prevents false positives like "South Carolina" vs "North Carolina"
 */
function areBothDistinctKnownStates(name1: string, name2: string): boolean {
	const n1 = name1.toLowerCase().trim();
	const n2 = name2.toLowerCase().trim();

	// If names are the same, they're not "distinct"
	if (n1 === n2) return false;

	const isState1 = US_STATE_FULL_NAMES.has(n1);
	const isState2 = US_STATE_FULL_NAMES.has(n2);

	// Both must be known states and different from each other
	return isState1 && isState2;
}

/**
 * Common geographic prefix modifiers that distinguish otherwise similar place names
 * Examples: "West Hartford" vs "New Hartford", "North Adams" vs "South Adams"
 */
const GEOGRAPHIC_PREFIXES = new Set([
	'north', 'south', 'east', 'west',
	'new', 'old',
	'upper', 'lower',
	'greater', 'lesser',
	'inner', 'outer',
	'central',
	'fort', 'port', 'mount', 'lake', 'saint', 'san', 'santa', 'los', 'las', 'el', 'la'
]);

/**
 * Check if two place names differ only by a geographic prefix modifier
 * This prevents false positives like "West Hartford" vs "New Hartford"
 * Returns true if they share the same base name but have different prefixes
 */
function differOnlyByGeographicPrefix(name1: string, name2: string): boolean {
	const n1 = name1.toLowerCase().trim();
	const n2 = name2.toLowerCase().trim();

	// If names are the same, they don't differ by prefix
	if (n1 === n2) return false;

	// Split into words
	const words1 = n1.split(/\s+/);
	const words2 = n2.split(/\s+/);

	// Need at least 2 words to have a prefix + base name
	if (words1.length < 2 || words2.length < 2) return false;

	// Check if first word of each is a geographic prefix
	const hasPrefix1 = GEOGRAPHIC_PREFIXES.has(words1[0]);
	const hasPrefix2 = GEOGRAPHIC_PREFIXES.has(words2[0]);

	// Both must have a prefix
	if (!hasPrefix1 || !hasPrefix2) return false;

	// Prefixes must be different
	if (words1[0] === words2[0]) return false;

	// Base names (everything after the prefix) must be the same
	const baseName1 = words1.slice(1).join(' ');
	const baseName2 = words2.slice(1).join(' ');

	return baseName1 === baseName2;
}

/**
 * Common geographic suffix modifiers that indicate administrative divisions
 * Examples: "Ware County" vs "Dade County", "Springfield Township" vs "Hamilton Township"
 */
const GEOGRAPHIC_SUFFIXES = new Set([
	'county', 'parish', 'borough',
	'township', 'twp',
	'city', 'town', 'village', 'hamlet',
	'district', 'ward', 'precinct',
	'state', 'province', 'territory',
	'region', 'area', 'zone'
]);

/**
 * Check if two place names share the same geographic suffix but have different base names
 * This prevents false positives like "Ware County" vs "Dade County"
 * Returns true if they both end with the same suffix but have different preceding names
 */
function shareGeographicSuffixOnly(name1: string, name2: string): boolean {
	const n1 = name1.toLowerCase().trim();
	const n2 = name2.toLowerCase().trim();

	// If names are the same, they're not just sharing a suffix
	if (n1 === n2) return false;

	// Split into words
	const words1 = n1.split(/\s+/);
	const words2 = n2.split(/\s+/);

	// Need at least 2 words to have a base name + suffix
	if (words1.length < 2 || words2.length < 2) return false;

	// Check if last word of each is a geographic suffix
	const lastWord1 = words1[words1.length - 1];
	const lastWord2 = words2[words2.length - 1];

	const hasSuffix1 = GEOGRAPHIC_SUFFIXES.has(lastWord1);
	const hasSuffix2 = GEOGRAPHIC_SUFFIXES.has(lastWord2);

	// Both must have a suffix
	if (!hasSuffix1 || !hasSuffix2) return false;

	// Suffixes must be the same (both "County", both "Township", etc.)
	if (lastWord1 !== lastWord2) return false;

	// Base names (everything before the suffix) must be different
	const baseName1 = words1.slice(0, -1).join(' ');
	const baseName2 = words2.slice(0, -1).join(' ');

	// If base names are identical, this isn't a false positive - they're likely duplicates
	if (baseName1 === baseName2) return false;

	// Base names are different but share suffix - these are distinct places
	return true;
}

/**
 * US State abbreviation to full name mapping
 */
const US_STATE_ABBREVIATIONS: Record<string, string> = {
	'al': 'alabama', 'ak': 'alaska', 'az': 'arizona', 'ar': 'arkansas',
	'ca': 'california', 'co': 'colorado', 'ct': 'connecticut', 'de': 'delaware',
	'fl': 'florida', 'ga': 'georgia', 'hi': 'hawaii', 'id': 'idaho',
	'il': 'illinois', 'in': 'indiana', 'ia': 'iowa', 'ks': 'kansas',
	'ky': 'kentucky', 'la': 'louisiana', 'me': 'maine', 'md': 'maryland',
	'ma': 'massachusetts', 'mi': 'michigan', 'mn': 'minnesota', 'ms': 'mississippi',
	'mo': 'missouri', 'mt': 'montana', 'ne': 'nebraska', 'nv': 'nevada',
	'nh': 'new hampshire', 'nj': 'new jersey', 'nm': 'new mexico', 'ny': 'new york',
	'nc': 'north carolina', 'nd': 'north dakota', 'oh': 'ohio', 'ok': 'oklahoma',
	'or': 'oregon', 'pa': 'pennsylvania', 'ri': 'rhode island', 'sc': 'south carolina',
	'sd': 'south dakota', 'tn': 'tennessee', 'tx': 'texas', 'ut': 'utah',
	'vt': 'vermont', 'va': 'virginia', 'wa': 'washington', 'wv': 'west virginia',
	'wi': 'wisconsin', 'wy': 'wyoming', 'dc': 'district of columbia'
};

/**
 * Full state name to normalized form mapping (for matching "South Carolina" to "south carolina")
 */
const US_STATE_FULL_NAMES: Set<string> = new Set(Object.values(US_STATE_ABBREVIATIONS));

/**
 * Extract base name and normalized state from a place name
 * Returns a key like "abbeville|south carolina" or null if no state component found
 *
 * Handles patterns like:
 * - "Abbeville SC" → "abbeville|south carolina"
 * - "Abbeville South Carolina" → "abbeville|south carolina"
 * - "Abbeville, SC" → "abbeville|south carolina"
 * - "abbeville-south-carolina" → "abbeville|south carolina" (kebab-case)
 * - "abbeville_south_carolina" → "abbeville|south carolina" (snake_case)
 * - "Abbeville" → null (no state)
 */
function extractBaseNameAndState(name: string): string | null {
	// Normalize: lowercase, replace hyphens/underscores with spaces, split on whitespace/comma
	const normalized = name.toLowerCase().trim().replace(/[-_]/g, ' ');
	const parts = normalized.split(/[\s,]+/).filter(p => p.length > 0);

	if (parts.length < 2) return null;

	// Check if the last part is a state abbreviation
	const lastPart = parts[parts.length - 1];
	if (US_STATE_ABBREVIATIONS[lastPart]) {
		const baseName = parts.slice(0, -1).join(' ');
		const stateName = US_STATE_ABBREVIATIONS[lastPart];
		return `${baseName}|${stateName}`;
	}

	// Check if the last two parts form a two-word state name
	if (parts.length >= 3) {
		const lastTwoParts = `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
		if (US_STATE_FULL_NAMES.has(lastTwoParts)) {
			const baseName = parts.slice(0, -2).join(' ');
			return `${baseName}|${lastTwoParts}`;
		}
	}

	// Check if the last part is a single-word state name
	if (US_STATE_FULL_NAMES.has(lastPart)) {
		const baseName = parts.slice(0, -1).join(' ');
		return `${baseName}|${lastPart}`;
	}

	return null;
}

/**
 * Administrative division keywords that indicate a place is a county-level
 * or higher administrative unit, not a settlement
 */
const ADMINISTRATIVE_KEYWORDS = [
	'county', 'co.', 'parish', 'borough', 'township', 'twp', 'twp.',
	'district', 'province', 'region', 'department', 'canton', 'prefecture',
	'municipality', 'shire', 'hundred'
];

/**
 * Check if a place name indicates an administrative division (county-level or higher)
 * rather than a settlement (city, town, village)
 */
function isAdministrativeDivision(name: string): boolean {
	const nameLower = name.toLowerCase();
	return ADMINISTRATIVE_KEYWORDS.some(keyword =>
		nameLower.includes(keyword)
	);
}

/**
 * Extract the base name from a place name for grouping
 * Returns the place name with trailing state/administrative suffixes removed, lowercased
 * e.g., "Abbeville County" -> "abbeville county", "Abbeville SC" -> "abbeville"
 *
 * This is used for Pass 4 duplicate detection to group places like:
 * - "Abbeville" and "Abbeville SC" (same base after removing state abbrev)
 * - "Abbeville County" variants
 *
 * IMPORTANT: This must return the FULL base name to avoid false matches.
 * "San Mateo" and "San Francisco" should NOT match (different base names).
 */
function extractBaseName(name: string): string {
	// Normalize: lowercase, trim
	const normalized = name.toLowerCase().trim();

	// Split on comma first - content after comma is usually location context
	// e.g., "Abbeville, SC" -> keep "abbeville"
	const commaParts = normalized.split(',');
	let basePart = commaParts[0].trim();

	// If no comma, split on spaces and check for trailing state abbreviations
	if (commaParts.length === 1) {
		const spaceParts = normalized.split(/\s+/);

		if (spaceParts.length >= 2) {
			const lastPart = spaceParts[spaceParts.length - 1];

			// Check if last part is a US state abbreviation (2 letters)
			if (lastPart.length === 2 && US_STATE_ABBREVIATIONS[lastPart]) {
				// Remove the state abbreviation to get base name
				basePart = spaceParts.slice(0, -1).join(' ');
			}
			// Check if last two parts form a full state name (e.g., "South Carolina")
			else if (spaceParts.length >= 3) {
				const lastTwoParts = `${spaceParts[spaceParts.length - 2]} ${spaceParts[spaceParts.length - 1]}`;
				if (US_STATE_FULL_NAMES.has(lastTwoParts)) {
					basePart = spaceParts.slice(0, -2).join(' ');
				}
			}
			// Check if last part is a single-word state name
			else if (US_STATE_FULL_NAMES.has(lastPart)) {
				basePart = spaceParts.slice(0, -1).join(' ');
			}
		}
	}

	// Return the full base part (not just the first word!)
	return basePart;
}

/**
 * Select the best place to be the canonical version
 * Criteria (in order of importance):
 * 1. Has parent place defined
 * 2. Has coordinates
 * 3. Has place_type defined
 * 4. Has more references from person notes
 * 5. Has shorter file path (likely in main places folder)
 */
function selectBestCanonical(places: PlaceNode[], placeService: PlaceGraphService): PlaceNode {
	return places.reduce((best, current) => {
		const bestScore = calculateCompletenessScore(best, placeService);
		const currentScore = calculateCompletenessScore(current, placeService);
		return currentScore > bestScore ? current : best;
	});
}

/**
 * Calculate a completeness score for a place note
 */
function calculateCompletenessScore(place: PlaceNode, placeService: PlaceGraphService): number {
	let score = 0;

	// Parent place (most important for hierarchy)
	if (place.parentId) score += 100;

	// Coordinates
	if (place.coordinates) score += 50;

	// Place type
	if (place.placeType) score += 25;

	// Universe (for fictional places)
	if (place.universe) score += 10;

	// Reference count from person notes
	const refs = placeService.getPlaceReferences();
	const refCount = refs.filter(r => r.placeId === place.id).length;
	score += refCount * 5;

	// Prefer shorter paths (main folder vs deeply nested)
	const pathDepth = place.filePath.split('/').length;
	score -= pathDepth;

	return score;
}
