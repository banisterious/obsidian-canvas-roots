/**
 * Unlinked Media Modal
 *
 * Discovers and displays media files in the vault that aren't linked to any entity.
 * Features:
 * - Grid/list view of orphaned media files
 * - Quick link action to connect to entities
 * - Bulk selection for batch operations
 * - Filter by media type
 * - Search by filename
 */

import { App, Modal, TFile, Menu, setIcon, Notice } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import {
	MediaService,
	MediaType,
	IMAGE_EXTENSIONS,
	VIDEO_EXTENSIONS,
	AUDIO_EXTENSIONS,
	PDF_EXTENSIONS,
	DOCUMENT_EXTENSIONS
} from '../media-service';
import { FamilyGraphService } from '../family-graph';
import { PlaceGraphService } from '../place-graph';
import { EventService } from '../../events/services/event-service';
import { OrganizationService } from '../../organizations/services/organization-service';
import { SourceService } from '../../sources/services/source-service';
import { FolderFilterService } from '../folder-filter';

/**
 * All supported media extensions
 */
const ALL_MEDIA_EXTENSIONS = [
	...IMAGE_EXTENSIONS,
	...VIDEO_EXTENSIONS,
	...AUDIO_EXTENSIONS,
	...PDF_EXTENSIONS,
	...DOCUMENT_EXTENSIONS
];

/**
 * Media type filter options
 */
type MediaFilter = 'all' | 'image' | 'video' | 'audio' | 'document';

/**
 * Unlinked media item
 */
interface UnlinkedItem {
	/** The media file */
	file: TFile;
	/** Media type */
	mediaType: MediaType;
	/** Whether this item is selected */
	selected: boolean;
}

/**
 * Unlinked Media Modal
 */
export class UnlinkedMediaModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private mediaService: MediaService;

	// State
	private allItems: UnlinkedItem[] = [];
	private filteredItems: UnlinkedItem[] = [];
	private linkedPaths: Set<string> = new Set();
	private searchQuery: string = '';
	private mediaFilter: MediaFilter = 'all';
	private isLoading: boolean = true;

	// UI elements
	private searchInput!: HTMLInputElement;
	private gridContainer!: HTMLElement;
	private countEl!: HTMLElement;
	private selectAllCheckbox!: HTMLInputElement;

	constructor(app: App, plugin: CanvasRootsPlugin) {
		super(app);
		this.plugin = plugin;
		this.mediaService = new MediaService(app, plugin.settings);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('crc-unlinked-media-modal');

		this.renderContent();
		this.loadUnlinkedMedia();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Load all unlinked media from the vault
	 */
	private loadUnlinkedMedia(): void {
		this.isLoading = true;
		this.linkedPaths.clear();

		// Collect all linked media paths from entities
		const folderFilter = new FolderFilterService(this.plugin.settings);

		// People
		const familyGraph = new FamilyGraphService(this.app);
		familyGraph.setFolderFilter(folderFilter);
		familyGraph.setPropertyAliases(this.plugin.settings.propertyAliases);
		familyGraph.setValueAliases(this.plugin.settings.valueAliases);
		familyGraph.ensureCacheLoaded();

		for (const person of familyGraph.getAllPeople()) {
			if (person.media && person.media.length > 0) {
				for (const ref of person.media) {
					const item = this.mediaService.resolveMediaItem(ref);
					if (item.file) this.linkedPaths.add(item.file.path);
				}
			}
		}

		// Events
		const eventService = new EventService(this.app, this.plugin.settings);
		for (const event of eventService.getAllEvents()) {
			if (event.media && event.media.length > 0) {
				for (const ref of event.media) {
					const item = this.mediaService.resolveMediaItem(ref);
					if (item.file) this.linkedPaths.add(item.file.path);
				}
			}
		}

		// Places
		const placeGraph = new PlaceGraphService(this.app);
		placeGraph.setSettings(this.plugin.settings);
		placeGraph.setFolderFilter(folderFilter);

		for (const place of placeGraph.getAllPlaces()) {
			if (place.media && place.media.length > 0) {
				for (const ref of place.media) {
					const item = this.mediaService.resolveMediaItem(ref);
					if (item.file) this.linkedPaths.add(item.file.path);
				}
			}
		}

		// Organizations
		const orgService = new OrganizationService(this.plugin);
		for (const org of orgService.getAllOrganizations()) {
			if (org.media && org.media.length > 0) {
				for (const ref of org.media) {
					const item = this.mediaService.resolveMediaItem(ref);
					if (item.file) this.linkedPaths.add(item.file.path);
				}
			}
		}

		// Sources
		const sourceService = new SourceService(this.app, this.plugin.settings);
		for (const source of sourceService.getAllSources()) {
			if (source.media && source.media.length > 0) {
				for (const ref of source.media) {
					const item = this.mediaService.resolveMediaItem(ref);
					if (item.file) this.linkedPaths.add(item.file.path);
				}
			}
		}

		// Find all media files not in linkedPaths
		this.allItems = [];
		const allFiles = this.app.vault.getFiles();

		for (const file of allFiles) {
			const ext = '.' + file.extension.toLowerCase();
			if (!ALL_MEDIA_EXTENSIONS.includes(ext)) continue;
			if (this.linkedPaths.has(file.path)) continue;

			// Apply media folder filter if enabled
			if (!this.isInMediaFolders(file.path)) continue;

			const mediaType = this.getMediaType(ext);
			this.allItems.push({
				file,
				mediaType,
				selected: false
			});
		}

		// Sort by filename
		this.allItems.sort((a, b) => a.file.name.localeCompare(b.file.name));
		this.filteredItems = [...this.allItems];

		this.isLoading = false;
		this.updateCount();
		this.renderGrid();
	}

	/**
	 * Check if a file path is within the configured media folders.
	 * Returns true if filter is disabled, folders are empty, or file is in a media folder.
	 */
	private isInMediaFolders(filePath: string): boolean {
		const { enableMediaFolderFilter, mediaFolders } = this.plugin.settings;

		// If filter is disabled or no folders configured, accept all files
		if (!enableMediaFolderFilter || mediaFolders.length === 0) {
			return true;
		}

		// Check if file is in any of the configured folders
		return mediaFolders.some(folder => {
			const normalizedFolder = folder.endsWith('/') ? folder : `${folder}/`;
			return filePath.startsWith(normalizedFolder) || filePath.startsWith(folder + '/');
		});
	}

	/**
	 * Get media type from extension
	 */
	private getMediaType(ext: string): MediaType {
		if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
		if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
		if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
		if (PDF_EXTENSIONS.includes(ext)) return 'pdf';
		if (DOCUMENT_EXTENSIONS.includes(ext)) return 'document';
		return 'other';
	}

	/**
	 * Render the modal content
	 */
	private renderContent(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Header
		const header = contentEl.createDiv({ cls: 'crc-unlinked-media-header' });
		const headerIcon = header.createDiv({ cls: 'crc-unlinked-media-header-icon' });
		setIcon(headerIcon, 'unlink');
		header.createEl('h2', { text: 'Unlinked Media' });

		// Search and filters
		const controls = contentEl.createDiv({ cls: 'crc-unlinked-media-controls' });

		// Search input
		const searchWrapper = controls.createDiv({ cls: 'crc-unlinked-media-search' });
		const searchIcon = searchWrapper.createSpan({ cls: 'crc-unlinked-media-search-icon' });
		setIcon(searchIcon, 'search');
		this.searchInput = searchWrapper.createEl('input', {
			type: 'text',
			placeholder: 'Search files...',
			cls: 'crc-unlinked-media-search-input'
		});
		this.searchInput.addEventListener('input', () => {
			this.searchQuery = this.searchInput.value.toLowerCase();
			this.applyFilters();
		});

		// Filter buttons
		const filters = controls.createDiv({ cls: 'crc-unlinked-media-filters' });
		const filterOptions: Array<{ value: MediaFilter; label: string }> = [
			{ value: 'all', label: 'All' },
			{ value: 'image', label: 'Images' },
			{ value: 'video', label: 'Video' },
			{ value: 'audio', label: 'Audio' },
			{ value: 'document', label: 'Docs' }
		];

		for (const opt of filterOptions) {
			const btn = filters.createEl('button', {
				cls: `crc-unlinked-media-filter-btn ${opt.value === this.mediaFilter ? 'crc-unlinked-media-filter-btn--active' : ''}`,
				text: opt.label
			});
			btn.addEventListener('click', () => {
				this.mediaFilter = opt.value;
				filters.querySelectorAll('.crc-unlinked-media-filter-btn').forEach(b => {
					b.removeClass('crc-unlinked-media-filter-btn--active');
				});
				btn.addClass('crc-unlinked-media-filter-btn--active');
				this.applyFilters();
			});
		}

		// Media folder filter toggle
		this.renderFolderFilterToggle(controls);

		// Selection controls and count
		const selectionBar = contentEl.createDiv({ cls: 'crc-unlinked-media-selection-bar' });

		const selectAllWrapper = selectionBar.createDiv({ cls: 'crc-unlinked-media-select-all' });
		this.selectAllCheckbox = selectAllWrapper.createEl('input', {
			type: 'checkbox',
			cls: 'crc-unlinked-media-checkbox'
		});
		selectAllWrapper.createSpan({ text: 'Select all' });
		this.selectAllCheckbox.addEventListener('change', () => {
			this.toggleSelectAll(this.selectAllCheckbox.checked);
		});

		// Bulk action buttons
		const bulkActions = selectionBar.createDiv({ cls: 'crc-unlinked-media-bulk-actions' });

		const linkSelectedBtn = bulkActions.createEl('button', {
			cls: 'crc-unlinked-media-bulk-btn',
			text: 'Link selected'
		});
		const linkIcon = linkSelectedBtn.createSpan({ cls: 'crc-unlinked-media-bulk-icon' });
		setIcon(linkIcon, 'link');
		linkSelectedBtn.prepend(linkIcon);
		linkSelectedBtn.addEventListener('click', () => this.linkSelected());

		// Count display
		this.countEl = selectionBar.createDiv({ cls: 'crc-unlinked-media-count' });
		this.updateCount();

		// Grid container
		this.gridContainer = contentEl.createDiv({ cls: 'crc-unlinked-media-grid' });

		// Show loading state initially
		this.renderLoadingState();

		// Focus search
		setTimeout(() => this.searchInput.focus(), 50);
	}

	/**
	 * Apply search and media type filters
	 */
	private applyFilters(): void {
		this.filteredItems = this.allItems.filter(item => {
			// Media type filter
			if (this.mediaFilter !== 'all' && item.mediaType !== this.mediaFilter) {
				return false;
			}

			// Search filter
			if (this.searchQuery) {
				const matchesFilename = item.file.name.toLowerCase().includes(this.searchQuery);
				const matchesPath = item.file.path.toLowerCase().includes(this.searchQuery);
				if (!matchesFilename && !matchesPath) {
					return false;
				}
			}

			return true;
		});

		this.updateCount();
		this.renderGrid();
	}

	/**
	 * Update the count display
	 */
	private updateCount(): void {
		if (this.isLoading) {
			this.countEl.textContent = 'Loading...';
			return;
		}

		const selected = this.filteredItems.filter(i => i.selected).length;
		const showing = this.filteredItems.length;
		const total = this.allItems.length;

		if (selected > 0) {
			this.countEl.textContent = `${selected} selected`;
		} else if (showing === total) {
			this.countEl.textContent = `${total} unlinked files`;
		} else {
			this.countEl.textContent = `Showing ${showing} of ${total}`;
		}
	}

	/**
	 * Render loading state
	 */
	private renderLoadingState(): void {
		this.gridContainer.empty();
		const loading = this.gridContainer.createDiv({ cls: 'crc-unlinked-media-loading' });
		loading.createDiv({ cls: 'crc-unlinked-media-spinner' });
		loading.createEl('p', { text: 'Scanning vault...' });
	}

	/**
	 * Render the media grid
	 */
	private renderGrid(): void {
		this.gridContainer.empty();

		if (this.filteredItems.length === 0) {
			this.renderEmptyState();
			return;
		}

		for (const item of this.filteredItems) {
			this.renderGridItem(item);
		}
	}

	/**
	 * Render empty state
	 */
	private renderEmptyState(): void {
		const empty = this.gridContainer.createDiv({ cls: 'crc-unlinked-media-empty' });
		const emptyIcon = empty.createSpan();
		setIcon(emptyIcon, 'check-circle');

		if (this.allItems.length === 0) {
			empty.createEl('p', { text: 'All media files are linked!' });
			empty.createEl('p', {
				text: 'Every media file in your vault is connected to an entity.',
				cls: 'crc-text-muted'
			});
		} else {
			empty.createEl('p', { text: 'No matching files' });
			empty.createEl('p', {
				text: 'Try a different search term or filter',
				cls: 'crc-text-muted'
			});
		}
	}

	/**
	 * Render a single grid item
	 */
	private renderGridItem(item: UnlinkedItem): void {
		const card = this.gridContainer.createDiv({
			cls: `crc-unlinked-media-item ${item.selected ? 'crc-unlinked-media-item--selected' : ''}`
		});

		// Checkbox for selection
		const checkbox = card.createEl('input', {
			type: 'checkbox',
			cls: 'crc-unlinked-media-item-checkbox'
		});
		checkbox.checked = item.selected;
		checkbox.addEventListener('click', (e) => {
			e.stopPropagation();
		});
		checkbox.addEventListener('change', () => {
			item.selected = checkbox.checked;
			card.toggleClass('crc-unlinked-media-item--selected', item.selected);
			this.updateSelectAllState();
			this.updateCount();
		});

		// Thumbnail area
		const thumbnail = card.createDiv({ cls: 'crc-unlinked-media-item-thumbnail' });

		if (item.mediaType === 'image') {
			const imgUrl = this.app.vault.getResourcePath(item.file);
			const img = thumbnail.createEl('img', {
				attr: {
					src: imgUrl,
					alt: item.file.name,
					loading: 'lazy'
				}
			});
			img.onerror = () => {
				img.remove();
				this.renderPlaceholderIcon(thumbnail, item.mediaType);
			};
		} else {
			this.renderPlaceholderIcon(thumbnail, item.mediaType);
		}

		// Media type badge
		card.createDiv({
			cls: `crc-unlinked-media-item-badge crc-unlinked-media-item-badge--${item.mediaType}`,
			text: this.getMediaLabel(item.mediaType)
		});

		// Info overlay
		const overlay = card.createDiv({ cls: 'crc-unlinked-media-item-overlay' });
		overlay.createDiv({
			cls: 'crc-unlinked-media-item-name',
			text: item.file.name,
			attr: { title: item.file.path }
		});

		// Folder path
		const folderPath = item.file.parent?.path || '';
		if (folderPath) {
			overlay.createDiv({
				cls: 'crc-unlinked-media-item-path',
				text: folderPath
			});
		}

		// Click to select/deselect
		card.addEventListener('click', (e) => {
			if (e.target === checkbox) return;
			item.selected = !item.selected;
			checkbox.checked = item.selected;
			card.toggleClass('crc-unlinked-media-item--selected', item.selected);
			this.updateSelectAllState();
			this.updateCount();
		});

		// Right-click context menu
		card.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			this.showContextMenu(e, item);
		});
	}

	/**
	 * Render placeholder icon for non-image media
	 */
	private renderPlaceholderIcon(container: HTMLElement, type: MediaType): void {
		const iconWrapper = container.createDiv({ cls: 'crc-unlinked-media-item-icon' });
		const iconName = this.getIconForType(type);
		setIcon(iconWrapper, iconName);
	}

	/**
	 * Get icon name for media type
	 */
	private getIconForType(type: MediaType): string {
		switch (type) {
			case 'image': return 'image';
			case 'video': return 'video';
			case 'audio': return 'music';
			case 'pdf': return 'file-text';
			case 'document': return 'file-text';
			default: return 'file';
		}
	}

	/**
	 * Get display label for media type
	 */
	private getMediaLabel(type: MediaType): string {
		switch (type) {
			case 'image': return 'Image';
			case 'video': return 'Video';
			case 'audio': return 'Audio';
			case 'pdf': return 'PDF';
			case 'document': return 'Doc';
			default: return 'File';
		}
	}

	/**
	 * Toggle select all
	 */
	private toggleSelectAll(selected: boolean): void {
		for (const item of this.filteredItems) {
			item.selected = selected;
		}
		this.renderGrid();
		this.updateCount();
	}

	/**
	 * Update select all checkbox state
	 */
	private updateSelectAllState(): void {
		const allSelected = this.filteredItems.length > 0 &&
			this.filteredItems.every(i => i.selected);
		const someSelected = this.filteredItems.some(i => i.selected);

		this.selectAllCheckbox.checked = allSelected;
		this.selectAllCheckbox.indeterminate = someSelected && !allSelected;
	}

	/**
	 * Link selected files to an entity
	 */
	private linkSelected(): void {
		const selected = this.filteredItems.filter(i => i.selected);
		if (selected.length === 0) {
			new Notice('No files selected');
			return;
		}

		// Open bulk link modal with pre-selected files
		this.close();

		// Import and open BulkMediaLinkModal with the selected files
		void import('./bulk-media-link-modal').then(({ BulkMediaLinkModal }) => {
			const modal = new BulkMediaLinkModal(this.app, this.plugin);
			modal.setPreselectedFiles(selected.map(i => i.file));
			modal.open();
		});
	}

	/**
	 * Show context menu for an item
	 */
	private showContextMenu(e: MouseEvent, item: UnlinkedItem): void {
		const menu = new Menu();

		menu.addItem((menuItem) => {
			menuItem
				.setTitle('Open file')
				.setIcon('file')
				.onClick(() => {
					this.close();
					void this.app.workspace.getLeaf().openFile(item.file);
				});
		});

		menu.addItem((menuItem) => {
			menuItem
				.setTitle('Link to entity...')
				.setIcon('link')
				.onClick(() => {
					// Select only this item and link
					for (const i of this.filteredItems) {
						i.selected = i === item;
					}
					this.linkSelected();
				});
		});

		menu.addSeparator();

		menu.addItem((menuItem) => {
			menuItem
				.setTitle('Reveal in file explorer')
				.setIcon('folder')
				.onClick(() => {
					// @ts-expect-error - showInFolder is available
					this.app.showInFolder(item.file.path);
				});
		});

		menu.addItem((menuItem) => {
			menuItem
				.setTitle('Copy file path')
				.setIcon('copy')
				.onClick(() => {
					void navigator.clipboard.writeText(item.file.path);
					new Notice('Path copied to clipboard');
				});
		});

		menu.showAtMouseEvent(e);
	}

	/**
	 * Render the folder filter toggle in the controls area
	 */
	private renderFolderFilterToggle(container: HTMLElement): void {
		const { enableMediaFolderFilter, mediaFolders } = this.plugin.settings;
		const hasFolders = mediaFolders.length > 0;

		const toggleWrapper = container.createDiv({ cls: 'crc-media-folder-filter-toggle' });

		// Folder icon
		const iconEl = toggleWrapper.createSpan({ cls: 'crc-media-folder-filter-icon' });
		setIcon(iconEl, 'folder');

		// Toggle checkbox
		const checkbox = toggleWrapper.createEl('input', {
			type: 'checkbox',
			cls: 'crc-media-folder-filter-checkbox'
		});
		checkbox.checked = enableMediaFolderFilter;
		checkbox.disabled = !hasFolders;

		// Label
		toggleWrapper.createSpan({
			cls: 'crc-media-folder-filter-label',
			text: 'Media folders only'
		});

		// Tooltip/hint for no folders configured
		if (!hasFolders) {
			toggleWrapper.addClass('crc-media-folder-filter-toggle--disabled');
			toggleWrapper.setAttribute('aria-label', 'No media folders configured. Set up in Preferences > Folder locations.');
			toggleWrapper.setAttribute('title', 'No media folders configured. Set up in Preferences > Folder locations.');
		} else {
			const folderList = mediaFolders.length === 1
				? mediaFolders[0]
				: `${mediaFolders.length} folders`;
			toggleWrapper.setAttribute('title', `Filter to: ${folderList}`);
		}

		// Handle toggle change
		checkbox.addEventListener('change', () => {
			this.plugin.settings.enableMediaFolderFilter = checkbox.checked;
			void this.plugin.saveSettings();
			// Reload data with new filter setting
			this.loadUnlinkedMedia();
		});

		// Clicking the wrapper also toggles (except on checkbox itself)
		toggleWrapper.addEventListener('click', (e) => {
			if (e.target === checkbox || !hasFolders) return;
			checkbox.checked = !checkbox.checked;
			this.plugin.settings.enableMediaFolderFilter = checkbox.checked;
			void this.plugin.saveSettings();
			this.loadUnlinkedMedia();
		});
	}
}
