/**
 * Unified Media Gallery Modal
 *
 * Displays all media files linked to entities across all types.
 * Features:
 * - Grid view of all linked media
 * - Filter by entity type (person, event, place, organization, source)
 * - Search by filename
 * - Click to open file, right-click for context menu
 * - Shows entity type badge on each item
 */

import { App, Modal, TFile, Menu, setIcon } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import {
	MediaService,
	MediaType
} from '../media-service';
import { FamilyGraphService } from '../family-graph';
import { PlaceGraphService } from '../place-graph';
import { EventService } from '../../events/services/event-service';
import { OrganizationService } from '../../organizations/services/organization-service';
import { SourceService } from '../../sources/services/source-service';
import { FolderFilterService } from '../folder-filter';

/**
 * Entity type filter options
 */
type EntityFilter = 'all' | 'person' | 'event' | 'place' | 'organization' | 'source';

/**
 * Gallery item representing a linked media file
 */
interface GalleryItem {
	/** The media file */
	file: TFile;
	/** Media type (image, video, etc.) */
	mediaType: MediaType;
	/** Entity type this is linked to */
	entityType: EntityFilter;
	/** Entity name */
	entityName: string;
	/** Entity file (for opening/navigation) */
	entityFile: TFile;
	/** Original media reference from frontmatter */
	mediaRef: string;
}

/**
 * Unified Media Gallery Modal
 */
export class MediaGalleryModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private mediaService: MediaService;

	// State
	private allItems: GalleryItem[] = [];
	private filteredItems: GalleryItem[] = [];
	private searchQuery: string = '';
	private entityFilter: EntityFilter = 'all';

	// UI elements
	private searchInput!: HTMLInputElement;
	private gridContainer!: HTMLElement;
	private countEl!: HTMLElement;

	constructor(app: App, plugin: CanvasRootsPlugin) {
		super(app);
		this.plugin = plugin;
		this.mediaService = new MediaService(app, plugin.settings);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('crc-media-gallery-modal');

		this.loadAllMedia();
		this.renderContent();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Load all linked media from all entity types
	 */
	private loadAllMedia(): void {
		this.allItems = [];
		const folderFilter = new FolderFilterService(this.plugin.settings);

		// People
		const familyGraph = new FamilyGraphService(this.app);
		familyGraph.setFolderFilter(folderFilter);
		familyGraph.setPropertyAliases(this.plugin.settings.propertyAliases);
		familyGraph.setValueAliases(this.plugin.settings.valueAliases);
		familyGraph.ensureCacheLoaded();

		const allPeople = familyGraph.getAllPeople();

		for (const person of allPeople) {
			if (person.media && person.media.length > 0) {
				for (const ref of person.media) {
					const item = this.mediaService.resolveMediaItem(ref);
					if (item.file) {
						this.allItems.push({
							file: item.file,
							mediaType: item.type,
							entityType: 'person',
							entityName: person.name,
							entityFile: person.file,
							mediaRef: ref
						});
					}
				}
			}
		}

		// Events
		const eventService = new EventService(this.app, this.plugin.settings);
		const allEvents = eventService.getAllEvents();

		for (const event of allEvents) {
			if (event.media && event.media.length > 0) {
				for (const ref of event.media) {
					const item = this.mediaService.resolveMediaItem(ref);
					if (item.file) {
						this.allItems.push({
							file: item.file,
							mediaType: item.type,
							entityType: 'event',
							entityName: event.title,
							entityFile: event.file,
							mediaRef: ref
						});
					}
				}
			}
		}

		// Places
		const placeGraph = new PlaceGraphService(this.app);
		placeGraph.setSettings(this.plugin.settings);
		placeGraph.setFolderFilter(folderFilter);

		for (const place of placeGraph.getAllPlaces()) {
			if (place.media && place.media.length > 0) {
				const placeFile = this.app.vault.getAbstractFileByPath(place.filePath);
				if (placeFile instanceof TFile) {
					for (const ref of place.media) {
						const item = this.mediaService.resolveMediaItem(ref);
						if (item.file) {
							this.allItems.push({
								file: item.file,
								mediaType: item.type,
								entityType: 'place',
								entityName: place.name,
								entityFile: placeFile,
								mediaRef: ref
							});
						}
					}
				}
			}
		}

		// Organizations
		const orgService = new OrganizationService(this.plugin);
		for (const org of orgService.getAllOrganizations()) {
			if (org.media && org.media.length > 0) {
				for (const ref of org.media) {
					const item = this.mediaService.resolveMediaItem(ref);
					if (item.file) {
						this.allItems.push({
							file: item.file,
							mediaType: item.type,
							entityType: 'organization',
							entityName: org.name,
							entityFile: org.file,
							mediaRef: ref
						});
					}
				}
			}
		}

		// Sources
		const sourceService = new SourceService(this.app, this.plugin.settings);
		const allSources = sourceService.getAllSources();

		for (const source of allSources) {
			if (source.media && source.media.length > 0) {
				const sourceFile = this.app.vault.getAbstractFileByPath(source.filePath);
				if (sourceFile instanceof TFile) {
					for (const ref of source.media) {
						const item = this.mediaService.resolveMediaItem(ref);
						if (item.file) {
							this.allItems.push({
								file: item.file,
								mediaType: item.type,
								entityType: 'source',
								entityName: source.title,
								entityFile: sourceFile,
								mediaRef: ref
							});
						}
					}
				}
			}
		}

		// Sort by filename
		this.allItems.sort((a, b) => a.file.name.localeCompare(b.file.name));
		this.filteredItems = [...this.allItems];
	}

	/**
	 * Render the modal content
	 */
	private renderContent(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Header
		const header = contentEl.createDiv({ cls: 'crc-media-gallery-header' });
		const headerIcon = header.createDiv({ cls: 'crc-media-gallery-header-icon' });
		setIcon(headerIcon, 'layout-grid');
		header.createEl('h2', { text: 'Linked Media Gallery' });

		// Search and filters
		const controls = contentEl.createDiv({ cls: 'crc-media-gallery-controls' });

		// Search input
		const searchWrapper = controls.createDiv({ cls: 'crc-media-gallery-search' });
		const searchIcon = searchWrapper.createSpan({ cls: 'crc-media-gallery-search-icon' });
		setIcon(searchIcon, 'search');
		this.searchInput = searchWrapper.createEl('input', {
			type: 'text',
			placeholder: 'Search media files...',
			cls: 'crc-media-gallery-search-input'
		});
		this.searchInput.addEventListener('input', () => {
			this.searchQuery = this.searchInput.value.toLowerCase();
			this.applyFilters();
		});

		// Filter buttons
		const filters = controls.createDiv({ cls: 'crc-media-gallery-filters' });
		const filterOptions: Array<{ value: EntityFilter; label: string }> = [
			{ value: 'all', label: 'All' },
			{ value: 'person', label: 'People' },
			{ value: 'event', label: 'Events' },
			{ value: 'place', label: 'Places' },
			{ value: 'organization', label: 'Orgs' },
			{ value: 'source', label: 'Sources' }
		];

		for (const opt of filterOptions) {
			const btn = filters.createEl('button', {
				cls: `crc-media-gallery-filter-btn ${opt.value === this.entityFilter ? 'crc-media-gallery-filter-btn--active' : ''}`,
				text: opt.label
			});
			btn.addEventListener('click', () => {
				this.entityFilter = opt.value;
				filters.querySelectorAll('.crc-media-gallery-filter-btn').forEach(b => {
					b.removeClass('crc-media-gallery-filter-btn--active');
				});
				btn.addClass('crc-media-gallery-filter-btn--active');
				this.applyFilters();
			});
		}

		// Media folder filter toggle
		this.renderFolderFilterToggle(controls);

		// Count display
		this.countEl = contentEl.createDiv({ cls: 'crc-media-gallery-count' });
		this.updateCount();

		// Grid container
		this.gridContainer = contentEl.createDiv({ cls: 'crc-media-gallery-grid' });
		this.renderGrid();

		// Focus search
		setTimeout(() => this.searchInput.focus(), 50);
	}

	/**
	 * Apply search and entity filters
	 */
	private applyFilters(): void {
		this.filteredItems = this.allItems.filter(item => {
			// Entity type filter
			if (this.entityFilter !== 'all' && item.entityType !== this.entityFilter) {
				return false;
			}

			// Search filter
			if (this.searchQuery) {
				const matchesFilename = item.file.name.toLowerCase().includes(this.searchQuery);
				const matchesEntity = item.entityName.toLowerCase().includes(this.searchQuery);
				if (!matchesFilename && !matchesEntity) {
					return false;
				}
			}

			// Media folder filter - filters linked media to only show those within configured folders
			if (!this.isInMediaFolders(item.file.path)) {
				return false;
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
		const showing = this.filteredItems.length;
		const total = this.allItems.length;
		if (showing === total) {
			this.countEl.textContent = `${total} media files`;
		} else {
			this.countEl.textContent = `Showing ${showing} of ${total} files`;
		}
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
		const empty = this.gridContainer.createDiv({ cls: 'crc-media-gallery-empty' });
		const emptyIcon = empty.createSpan();
		setIcon(emptyIcon, 'image-off');

		if (this.allItems.length === 0) {
			empty.createEl('p', { text: 'No media files linked yet' });
			empty.createEl('p', {
				text: 'Use "Link media" from the context menu to add media to entities',
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
	private renderGridItem(item: GalleryItem): void {
		const card = this.gridContainer.createDiv({ cls: 'crc-media-gallery-item' });

		// Thumbnail area
		const thumbnail = card.createDiv({ cls: 'crc-media-gallery-item-thumbnail' });

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
		} else if (item.mediaType === 'video') {
			// Show video icon
			this.renderPlaceholderIcon(thumbnail, 'video');
		} else {
			this.renderPlaceholderIcon(thumbnail, item.mediaType);
		}

		// Entity type badge
		card.createDiv({
			cls: `crc-media-gallery-item-badge crc-media-gallery-item-badge--${item.entityType}`,
			text: this.getEntityLabel(item.entityType)
		});

		// Info overlay
		const overlay = card.createDiv({ cls: 'crc-media-gallery-item-overlay' });
		overlay.createDiv({
			cls: 'crc-media-gallery-item-name',
			text: item.file.name,
			attr: { title: item.file.path }
		});
		overlay.createDiv({
			cls: 'crc-media-gallery-item-entity',
			text: item.entityName
		});

		// Click to open
		card.addEventListener('click', () => {
			this.openMediaFile(item);
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
		const iconWrapper = container.createDiv({ cls: 'crc-media-gallery-item-icon' });
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
	 * Get display label for entity type
	 */
	private getEntityLabel(type: EntityFilter): string {
		switch (type) {
			case 'person': return 'Person';
			case 'event': return 'Event';
			case 'place': return 'Place';
			case 'organization': return 'Org';
			case 'source': return 'Source';
			default: return '';
		}
	}

	/**
	 * Open a media file
	 */
	private openMediaFile(item: GalleryItem): void {
		this.close();
		void this.app.workspace.getLeaf().openFile(item.file);
	}

	/**
	 * Show context menu for a gallery item
	 */
	private showContextMenu(e: MouseEvent, item: GalleryItem): void {
		const menu = new Menu();

		menu.addItem((menuItem) => {
			menuItem
				.setTitle('Open media file')
				.setIcon('file')
				.onClick(() => {
					this.openMediaFile(item);
				});
		});

		menu.addItem((menuItem) => {
			menuItem
				.setTitle(`Open ${item.entityType} note`)
				.setIcon(this.getEntityIcon(item.entityType))
				.onClick(() => {
					this.close();
					void this.app.workspace.getLeaf().openFile(item.entityFile);
				});
		});

		menu.addSeparator();

		menu.addItem((menuItem) => {
			menuItem
				.setTitle('Manage entity media...')
				.setIcon('images')
				.onClick(() => {
					this.close();
					this.plugin.openManageMediaModal(
						item.entityFile,
						item.entityType,
						item.entityName
					);
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
				});
		});

		menu.showAtMouseEvent(e);
	}

	/**
	 * Get icon for entity type
	 */
	private getEntityIcon(type: EntityFilter): string {
		switch (type) {
			case 'person': return 'user';
			case 'event': return 'calendar';
			case 'place': return 'map-pin';
			case 'organization': return 'building';
			case 'source': return 'file-text';
			default: return 'file';
		}
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
			// Re-apply filters with new setting
			this.applyFilters();
		});

		// Clicking the wrapper also toggles (except on checkbox itself)
		toggleWrapper.addEventListener('click', (e) => {
			if (e.target === checkbox || !hasFolders) return;
			checkbox.checked = !checkbox.checked;
			this.plugin.settings.enableMediaFolderFilter = checkbox.checked;
			void this.plugin.saveSettings();
			this.applyFilters();
		});
	}
}
