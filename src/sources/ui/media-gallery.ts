/**
 * Source Media Gallery Component
 *
 * Displays media files attached to sources in a thumbnail grid with
 * lightbox viewing and filtering capabilities.
 */

import { App, TFile, setIcon, Modal } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import { SourceService } from '../services/source-service';
import type { SourceNote } from '../types/source-types';
import { getSourceType } from '../types/source-types';

/**
 * Supported image extensions for thumbnails
 */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif'];

/**
 * Supported document extensions (shown with icon placeholder)
 */
const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];

/**
 * Media item with resolved file information
 */
interface MediaItem {
	/** The source note this media belongs to */
	source: SourceNote;
	/** Original media reference from frontmatter */
	mediaRef: string;
	/** Resolved file in vault (if found) */
	file: TFile | null;
	/** Type of media */
	type: 'image' | 'document' | 'other';
	/** Display name */
	displayName: string;
}

/**
 * Filter options for the gallery
 */
interface GalleryFilterOptions {
	/** Filter by source type */
	sourceType?: string;
	/** Filter by media type */
	mediaType?: 'image' | 'document' | 'all';
	/** Search query for source title or filename */
	searchQuery?: string;
}

/**
 * Render the media gallery
 */
export function renderMediaGallery(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: string }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const card = createCard({
		title: 'Media gallery',
		icon: 'image'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	const sourceService = new SourceService(plugin.app, plugin.settings);
	const sources = sourceService.getAllSources();
	const sourcesWithMedia = sources.filter(s => s.media.length > 0);

	if (sourcesWithMedia.length === 0) {
		renderEmptyState(content);
		container.appendChild(card);
		return;
	}

	// Collect all media items
	const allMediaItems = collectMediaItems(plugin.app, sourcesWithMedia);

	if (allMediaItems.length === 0) {
		renderEmptyState(content);
		container.appendChild(card);
		return;
	}

	// Filter toolbar
	const filterState: GalleryFilterOptions = {
		mediaType: 'all',
		searchQuery: ''
	};

	const toolbar = content.createDiv({ cls: 'cr-media-gallery-toolbar' });
	renderFilterToolbar(toolbar, plugin, allMediaItems, filterState, () => {
		renderGalleryGrid(gridContainer, plugin, allMediaItems, filterState);
	});

	// Gallery grid container
	const gridContainer = content.createDiv({ cls: 'cr-media-gallery-grid-container' });
	renderGalleryGrid(gridContainer, plugin, allMediaItems, filterState);

	// Stats footer
	const imageCount = allMediaItems.filter(m => m.type === 'image').length;
	const docCount = allMediaItems.filter(m => m.type === 'document').length;
	const footer = content.createDiv({ cls: 'cr-media-gallery-footer' });
	footer.createSpan({
		text: `${allMediaItems.length} media items (${imageCount} images, ${docCount} documents) from ${sourcesWithMedia.length} sources`,
		cls: 'crc-text-muted'
	});

	container.appendChild(card);
}

/**
 * Collect all media items from sources
 */
function collectMediaItems(app: App, sources: SourceNote[]): MediaItem[] {
	const items: MediaItem[] = [];

	for (const source of sources) {
		for (const mediaRef of source.media) {
			const item = resolveMediaItem(app, source, mediaRef);
			items.push(item);
		}
	}

	return items;
}

/**
 * Resolve a media reference to a MediaItem
 */
function resolveMediaItem(app: App, source: SourceNote, mediaRef: string): MediaItem {
	// Parse wikilink or path
	let path = mediaRef;

	// Handle wikilinks: [[path]] or [[path|alias]]
	const wikilinkMatch = mediaRef.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
	if (wikilinkMatch) {
		path = wikilinkMatch[1];
	}

	// Try to find the file
	const file = app.vault.getAbstractFileByPath(path);
	const resolvedFile = file instanceof TFile ? file : null;

	// Determine type from extension
	const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
	let type: 'image' | 'document' | 'other' = 'other';
	if (IMAGE_EXTENSIONS.includes(ext)) {
		type = 'image';
	} else if (DOCUMENT_EXTENSIONS.includes(ext)) {
		type = 'document';
	}

	// Get display name
	const displayName = path.substring(path.lastIndexOf('/') + 1);

	return {
		source,
		mediaRef,
		file: resolvedFile,
		type,
		displayName
	};
}

/**
 * Render empty state
 */
function renderEmptyState(container: HTMLElement): void {
	const emptyState = container.createDiv({ cls: 'crc-empty-state' });
	const iconSpan = emptyState.createSpan({ cls: 'crc-empty-icon' });
	setIcon(iconSpan, 'image');
	emptyState.createEl('p', { text: 'No media found.' });
	emptyState.createEl('p', {
		cls: 'crc-text-muted',
		text: 'Add media files to your source notes using the "media" frontmatter property.'
	});
}

/**
 * Render filter toolbar
 */
function renderFilterToolbar(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	allItems: MediaItem[],
	filterState: GalleryFilterOptions,
	onFilterChange: () => void
): void {
	// Search input
	const searchContainer = container.createDiv({ cls: 'cr-media-gallery-search' });
	const searchIcon = searchContainer.createSpan({ cls: 'cr-media-gallery-search-icon' });
	setIcon(searchIcon, 'search');
	const searchInput = searchContainer.createEl('input', {
		type: 'text',
		placeholder: 'Search media...',
		cls: 'cr-media-gallery-search-input'
	});
	searchInput.addEventListener('input', () => {
		filterState.searchQuery = searchInput.value.toLowerCase();
		onFilterChange();
	});

	// Media type filter
	const typeFilter = container.createEl('select', { cls: 'cr-media-gallery-filter' });
	typeFilter.createEl('option', { value: 'all', text: 'All types' });
	typeFilter.createEl('option', { value: 'image', text: 'Images only' });
	typeFilter.createEl('option', { value: 'document', text: 'Documents only' });
	typeFilter.addEventListener('change', () => {
		filterState.mediaType = typeFilter.value as 'image' | 'document' | 'all';
		onFilterChange();
	});

	// Source type filter
	const sourceTypes = new Set<string>();
	for (const item of allItems) {
		sourceTypes.add(item.source.sourceType);
	}

	if (sourceTypes.size > 1) {
		const sourceTypeFilter = container.createEl('select', { cls: 'cr-media-gallery-filter' });
		sourceTypeFilter.createEl('option', { value: '', text: 'All source types' });

		for (const typeId of Array.from(sourceTypes).sort()) {
			const typeDef = getSourceType(
				typeId,
				plugin.settings.customSourceTypes,
				plugin.settings.showBuiltInSourceTypes
			);
			const label = typeDef?.name || typeId;
			sourceTypeFilter.createEl('option', { value: typeId, text: label });
		}

		sourceTypeFilter.addEventListener('change', () => {
			filterState.sourceType = sourceTypeFilter.value || undefined;
			onFilterChange();
		});
	}
}

/**
 * Render gallery grid with current filters
 */
function renderGalleryGrid(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	allItems: MediaItem[],
	filterState: GalleryFilterOptions
): void {
	container.empty();

	// Apply filters
	let filteredItems = allItems;

	if (filterState.mediaType && filterState.mediaType !== 'all') {
		filteredItems = filteredItems.filter(item => item.type === filterState.mediaType);
	}

	if (filterState.sourceType) {
		filteredItems = filteredItems.filter(item => item.source.sourceType === filterState.sourceType);
	}

	if (filterState.searchQuery) {
		const query = filterState.searchQuery.toLowerCase();
		filteredItems = filteredItems.filter(item =>
			item.displayName.toLowerCase().includes(query) ||
			item.source.title.toLowerCase().includes(query)
		);
	}

	if (filteredItems.length === 0) {
		const noResults = container.createDiv({ cls: 'cr-media-gallery-no-results' });
		noResults.createEl('p', { text: 'No media matches your filters.', cls: 'crc-text-muted' });
		return;
	}

	// Create grid
	const grid = container.createDiv({ cls: 'cr-media-gallery-grid' });

	for (const item of filteredItems) {
		renderMediaThumbnail(grid, plugin, item, filteredItems);
	}
}

/**
 * Render a single media thumbnail
 */
function renderMediaThumbnail(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	item: MediaItem,
	allItems: MediaItem[]
): void {
	const thumbnail = container.createDiv({ cls: 'cr-media-thumbnail' });

	// Get source type for badge color
	const typeDef = getSourceType(
		item.source.sourceType,
		plugin.settings.customSourceTypes,
		plugin.settings.showBuiltInSourceTypes
	);

	if (item.type === 'image' && item.file) {
		// Render image thumbnail
		const imgUrl = plugin.app.vault.getResourcePath(item.file);
		const img = thumbnail.createEl('img', {
			cls: 'cr-media-thumbnail-image',
			attr: {
				src: imgUrl,
				alt: item.displayName,
				loading: 'lazy'
			}
		});
		img.onerror = () => {
			img.remove();
			renderPlaceholder(thumbnail, 'image');
		};

		// Click to open lightbox
		thumbnail.addEventListener('click', () => {
			openMediaLightbox(plugin, item, allItems);
		});
	} else if (item.type === 'document') {
		// Render document placeholder
		renderPlaceholder(thumbnail, 'file-text');

		// Click to open file
		if (item.file) {
			thumbnail.addEventListener('click', () => {
				void plugin.app.workspace.openLinkText(item.file!.path, '');
			});
		}
	} else {
		// Other type
		renderPlaceholder(thumbnail, 'file');

		if (item.file) {
			thumbnail.addEventListener('click', () => {
				void plugin.app.workspace.openLinkText(item.file!.path, '');
			});
		}
	}

	// Overlay with info
	const overlay = thumbnail.createDiv({ cls: 'cr-media-thumbnail-overlay' });

	// File name
	const fileName = overlay.createDiv({ cls: 'cr-media-thumbnail-name' });
	fileName.textContent = item.displayName;

	// Source info
	const sourceInfo = overlay.createDiv({ cls: 'cr-media-thumbnail-source' });
	if (typeDef) {
		const badge = sourceInfo.createSpan({ cls: 'cr-media-thumbnail-badge' });
		badge.style.backgroundColor = typeDef.color;
		badge.textContent = typeDef.name;
	}

	// Missing file indicator
	if (!item.file) {
		thumbnail.addClass('cr-media-thumbnail--missing');
		const missingBadge = thumbnail.createDiv({ cls: 'cr-media-thumbnail-missing' });
		setIcon(missingBadge, 'alert-circle');
		missingBadge.createSpan({ text: 'Missing' });
	}
}

/**
 * Render placeholder icon
 */
function renderPlaceholder(container: HTMLElement, iconName: string): void {
	const placeholder = container.createDiv({ cls: 'cr-media-thumbnail-placeholder' });
	setIcon(placeholder, iconName);
}

/**
 * Open media lightbox for viewing images
 */
function openMediaLightbox(
	plugin: CanvasRootsPlugin,
	currentItem: MediaItem,
	allItems: MediaItem[]
): void {
	// Filter to only images with files
	const imageItems = allItems.filter(item => item.type === 'image' && item.file);
	const currentIndex = imageItems.findIndex(item =>
		item.file?.path === currentItem.file?.path && item.source.crId === currentItem.source.crId
	);

	if (currentIndex === -1 || imageItems.length === 0) return;

	new MediaLightboxModal(plugin.app, plugin, imageItems, currentIndex).open();
}

/**
 * Modal for viewing media in a lightbox
 */
class MediaLightboxModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private items: MediaItem[];
	private currentIndex: number;
	private imageContainer: HTMLElement | null = null;
	private captionEl: HTMLElement | null = null;
	private counterEl: HTMLElement | null = null;

	constructor(app: App, plugin: CanvasRootsPlugin, items: MediaItem[], startIndex: number) {
		super(app);
		this.plugin = plugin;
		this.items = items;
		this.currentIndex = startIndex;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-media-lightbox');

		// Close button
		const closeBtn = contentEl.createDiv({ cls: 'cr-media-lightbox-close' });
		setIcon(closeBtn, 'x');
		closeBtn.addEventListener('click', () => this.close());

		// Navigation (if multiple images)
		if (this.items.length > 1) {
			// Previous button
			const prevBtn = contentEl.createDiv({ cls: 'cr-media-lightbox-nav cr-media-lightbox-prev' });
			setIcon(prevBtn, 'chevron-left');
			prevBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.navigate(-1);
			});

			// Next button
			const nextBtn = contentEl.createDiv({ cls: 'cr-media-lightbox-nav cr-media-lightbox-next' });
			setIcon(nextBtn, 'chevron-right');
			nextBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.navigate(1);
			});
		}

		// Image container
		this.imageContainer = contentEl.createDiv({ cls: 'cr-media-lightbox-image-container' });

		// Footer with caption and counter
		const footer = contentEl.createDiv({ cls: 'cr-media-lightbox-footer' });
		this.captionEl = footer.createDiv({ cls: 'cr-media-lightbox-caption' });
		this.counterEl = footer.createDiv({ cls: 'cr-media-lightbox-counter' });

		// Render current image
		this.renderCurrentImage();

		// Keyboard navigation
		this.scope.register([], 'ArrowLeft', () => {
			this.navigate(-1);
			return false;
		});
		this.scope.register([], 'ArrowRight', () => {
			this.navigate(1);
			return false;
		});
		this.scope.register([], 'Escape', () => {
			this.close();
			return false;
		});

		// Click outside to close
		contentEl.addEventListener('click', (e) => {
			if (e.target === contentEl || e.target === this.imageContainer) {
				this.close();
			}
		});
	}

	private navigate(direction: number): void {
		const newIndex = this.currentIndex + direction;
		if (newIndex >= 0 && newIndex < this.items.length) {
			this.currentIndex = newIndex;
			this.renderCurrentImage();
		}
	}

	private renderCurrentImage(): void {
		if (!this.imageContainer || !this.captionEl || !this.counterEl) return;

		const item = this.items[this.currentIndex];
		if (!item.file) return;

		// Clear container
		this.imageContainer.empty();

		// Load image
		const imgUrl = this.app.vault.getResourcePath(item.file);
		this.imageContainer.createEl('img', {
			cls: 'cr-media-lightbox-image',
			attr: {
				src: imgUrl,
				alt: item.displayName
			}
		});

		// Update caption
		this.captionEl.empty();
		this.captionEl.createDiv({ cls: 'cr-media-lightbox-filename', text: item.displayName });
		this.captionEl.createDiv({
			cls: 'cr-media-lightbox-source',
			text: `Source: ${item.source.title}`
		});

		// Update counter
		this.counterEl.textContent = `${this.currentIndex + 1} / ${this.items.length}`;
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
