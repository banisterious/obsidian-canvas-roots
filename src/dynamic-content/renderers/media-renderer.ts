/**
 * Media Renderer
 *
 * Renders media gallery HTML for the canvas-roots-media code block.
 * Creates a styled grid of thumbnails from the note's `media` frontmatter property.
 */

import { MarkdownRenderChild, TFile, Notice, setIcon, setTooltip } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { DynamicBlockContext, DynamicBlockConfig } from '../services/dynamic-content-service';
import type { DynamicContentService } from '../services/dynamic-content-service';

/**
 * Media item extracted from frontmatter
 */
export interface MediaItem {
	/** Original wikilink from frontmatter (e.g., "[[media/photo.jpg]]") */
	wikilink: string;
	/** Resolved file path */
	path: string;
	/** File extension (lowercase) */
	extension: string;
	/** Resolved TFile if it exists */
	file?: TFile;
	/** Whether this is an image (vs document) */
	isImage: boolean;
	/** Whether this is the first item (thumbnail) */
	isThumbnail: boolean;
}

/**
 * Gallery size configuration
 */
type GallerySize = 'small' | 'medium' | 'large';

/**
 * Gallery filter type
 */
type GalleryFilter = 'all' | 'images' | 'documents';

/**
 * Renders media gallery content into an HTML element
 */
export class MediaRenderer {
	private plugin: CanvasRootsPlugin;
	private service: DynamicContentService;
	private currentItems: MediaItem[] = [];
	private currentContext: DynamicBlockContext | null = null;
	private isEditable: boolean = false;
	private gridElement: HTMLElement | null = null;
	private draggedItem: HTMLElement | null = null;
	private draggedIndex: number = -1;

	constructor(plugin: CanvasRootsPlugin, service: DynamicContentService) {
		this.plugin = plugin;
		this.service = service;
	}

	/**
	 * Render the media gallery block
	 */
	render(
		el: HTMLElement,
		context: DynamicBlockContext,
		config: DynamicBlockConfig,
		component: MarkdownRenderChild
	): void {
		// Parse editable option
		this.isEditable = this.parseEditable(config.editable);

		const containerClasses = ['cr-dynamic-block', 'cr-media'];
		if (this.isEditable) {
			containerClasses.push('cr-media--editable');
		}
		const container = el.createDiv({ cls: containerClasses.join(' ') });

		// Get media items from frontmatter
		const items = this.getMediaItems(context, config);

		// Store for freeze functionality
		this.currentItems = items;
		this.currentContext = context;

		// Parse config options
		const columns = this.parseColumns(config.columns);
		const size = this.parseSize(config.size);

		// Render header
		this.renderHeader(container, items.length, config);

		// Render content
		const contentEl = container.createDiv({ cls: 'cr-dynamic-block__content' });

		if (items.length === 0) {
			this.renderEmptyState(contentEl);
			return;
		}

		// Render gallery grid
		this.renderGalleryGrid(contentEl, items, columns, size, component);
	}

	/**
	 * Get media items from the note's frontmatter
	 */
	private getMediaItems(context: DynamicBlockContext, config: DynamicBlockConfig): MediaItem[] {
		const { file } = context;
		const app = this.plugin.app;

		// Get frontmatter
		const cache = app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;

		if (!frontmatter) {
			return [];
		}

		// Get media array from frontmatter
		const mediaProperty = this.plugin.resolveFrontmatterProperty<string | string[]>(frontmatter, 'media');

		if (!mediaProperty) {
			return [];
		}

		// Normalize to array
		const mediaLinks = Array.isArray(mediaProperty) ? mediaProperty : [mediaProperty];

		// Parse filter option
		const filter = this.parseFilter(config.filter);

		// Convert to MediaItem objects
		const items: MediaItem[] = [];

		for (let i = 0; i < mediaLinks.length; i++) {
			const link = mediaLinks[i];
			const item = this.parseMediaLink(link, i === 0);

			if (!item) continue;

			// Apply filter
			if (filter === 'images' && !item.isImage) continue;
			if (filter === 'documents' && item.isImage) continue;

			items.push(item);
		}

		return items;
	}

	/**
	 * Parse a media wikilink into a MediaItem
	 */
	private parseMediaLink(link: string, isFirst: boolean): MediaItem | null {
		if (!link) return null;

		// Strip wikilink brackets
		const path = link.replace(/^\[\[/, '').replace(/\]\]$/, '').trim();

		if (!path) return null;

		// Get extension
		const lastDot = path.lastIndexOf('.');
		const extension = lastDot !== -1 ? path.substring(lastDot + 1).toLowerCase() : '';

		// Check if it's an image
		const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tif', 'tiff'];
		const isImage = imageExtensions.includes(extension);

		// Try to resolve the file
		const file = this.plugin.app.metadataCache.getFirstLinkpathDest(path, '');

		return {
			wikilink: link,
			path,
			extension,
			file: file instanceof TFile ? file : undefined,
			isImage,
			isThumbnail: isFirst
		};
	}

	/**
	 * Parse columns config option
	 */
	private parseColumns(value: unknown): number | 'auto' {
		if (value === 'auto') return 'auto';
		if (typeof value === 'number' && value >= 2 && value <= 6) return value;
		return 3; // default
	}

	/**
	 * Parse size config option
	 */
	private parseSize(value: unknown): GallerySize {
		if (value === 'small' || value === 'medium' || value === 'large') {
			return value;
		}
		return 'medium'; // default
	}

	/**
	 * Parse filter config option
	 */
	private parseFilter(value: unknown): GalleryFilter {
		if (value === 'images' || value === 'documents' || value === 'all') {
			return value;
		}
		return 'all'; // default
	}

	/**
	 * Parse editable config option
	 */
	private parseEditable(value: unknown): boolean {
		if (value === true || value === 'true') return true;
		return false; // default
	}

	/**
	 * Render the header with title and toolbar
	 */
	private renderHeader(container: HTMLElement, itemCount: number, config: DynamicBlockConfig): void {
		const header = container.createDiv({ cls: 'cr-dynamic-block__header' });

		// Title with count
		const titleText = config.title as string || 'Media Gallery';
		const titleWithCount = itemCount > 0 ? `${titleText} (${itemCount})` : titleText;

		const titleEl = header.createSpan({ cls: 'cr-dynamic-block__title' });

		// Add icon
		const iconEl = titleEl.createSpan({ cls: 'cr-dynamic-block__icon' });
		setIcon(iconEl, 'image');

		titleEl.createSpan({ text: ` ${titleWithCount}` });

		// Toolbar
		const toolbar = header.createDiv({ cls: 'cr-dynamic-block__toolbar' });

		// Freeze button
		const freezeBtn = toolbar.createEl('button', {
			cls: 'cr-dynamic-block__btn clickable-icon',
			attr: { 'aria-label': 'Freeze to markdown' }
		});
		freezeBtn.textContent = '❄️';
		freezeBtn.addEventListener('click', () => {
			void this.freezeToMarkdown();
		});

		// Copy button
		const copyBtn = toolbar.createEl('button', {
			cls: 'cr-dynamic-block__btn clickable-icon',
			attr: { 'aria-label': 'Copy as embeds' }
		});
		copyBtn.textContent = '📋';
		copyBtn.addEventListener('click', () => {
			this.copyAsEmbeds();
		});
	}

	/**
	 * Render empty state when no media is linked
	 */
	private renderEmptyState(contentEl: HTMLElement): void {
		const empty = contentEl.createDiv({ cls: 'cr-media__empty' });

		// Icon
		const iconEl = empty.createDiv({ cls: 'cr-media__empty-icon' });
		setIcon(iconEl, 'image');

		empty.createDiv({ cls: 'cr-media__empty-text', text: 'No media linked to this note.' });
		empty.createDiv({ cls: 'cr-media__empty-hint', text: 'Add media wikilinks to the "media" frontmatter property.' });
	}

	/**
	 * Render the gallery grid
	 */
	private renderGalleryGrid(
		contentEl: HTMLElement,
		items: MediaItem[],
		columns: number | 'auto',
		size: GallerySize,
		_component: MarkdownRenderChild
	): void {
		// Create grid with appropriate classes
		const gridClasses = ['cr-media__grid'];

		if (columns === 'auto') {
			gridClasses.push('cr-media__grid--auto');
		} else {
			gridClasses.push(`cr-media__grid--cols-${columns}`);
		}

		gridClasses.push(`cr-media__grid--${size}`);

		const grid = contentEl.createDiv({ cls: gridClasses.join(' ') });
		this.gridElement = grid;

		// Render each item with index for drag-and-drop
		for (let i = 0; i < items.length; i++) {
			this.renderGalleryItem(grid, items[i], i);
		}
	}

	/**
	 * Render a single gallery item
	 */
	private renderGalleryItem(grid: HTMLElement, item: MediaItem, index: number): void {
		const itemClasses = ['cr-media__item'];
		if (item.isThumbnail) {
			itemClasses.push('cr-media__item--thumbnail');
		}

		const itemEl = grid.createDiv({ cls: itemClasses.join(' ') });
		itemEl.dataset.index = String(index);
		itemEl.dataset.wikilink = item.wikilink;

		// Add drag handle when editable
		if (this.isEditable) {
			itemEl.setAttribute('draggable', 'true');
			this.setupDragEvents(itemEl, index);

			// Add drag handle indicator using Lucide grip-vertical icon
			const handle = itemEl.createDiv({ cls: 'cr-media__drag-handle' });
			setIcon(handle, 'grip-vertical');
			setTooltip(handle, 'Drag to reorder');
		}

		if (item.isImage && item.file) {
			// Render image thumbnail
			const img = itemEl.createEl('img', {
				cls: 'cr-media__image',
				attr: {
					alt: item.file.basename,
					loading: 'lazy'
				}
			});

			// Get resource path for the image
			const resourcePath = this.plugin.app.vault.getResourcePath(item.file);
			img.src = resourcePath;

			// Add click handler to open in default viewer
			// In editable mode, use double-click to avoid conflicts with drag
			const clickEvent = this.isEditable ? 'dblclick' : 'click';
			itemEl.addEventListener(clickEvent, () => {
				if (item.file) {
					void this.plugin.app.workspace.openLinkText(item.path, '', false);
				}
			});

			// Add thumbnail badge if applicable
			if (item.isThumbnail) {
				const badge = itemEl.createDiv({ cls: 'cr-media__badge', text: 'Thumbnail' });
				badge.setAttribute('aria-label', 'This image is used as the thumbnail');
			}

		} else {
			// Render document placeholder
			itemEl.addClass('cr-media__item--doc');

			const iconEl = itemEl.createDiv({ cls: 'cr-media__doc-icon' });
			setIcon(iconEl, this.getDocumentIconName(item.extension));

			const nameEl = itemEl.createDiv({ cls: 'cr-media__doc-name' });
			nameEl.textContent = item.file?.basename || item.path.split('/').pop() || 'Document';

			// Add click handler to open document
			// In editable mode, use double-click to avoid conflicts with drag
			const clickEvent = this.isEditable ? 'dblclick' : 'click';
			itemEl.addEventListener(clickEvent, () => {
				if (item.file) {
					void this.plugin.app.workspace.openLinkText(item.path, '', false);
				}
			});
		}
	}

	/**
	 * Setup drag-and-drop event handlers for an item
	 */
	private setupDragEvents(itemEl: HTMLElement, index: number): void {
		itemEl.addEventListener('dragstart', (e) => {
			this.draggedItem = itemEl;
			this.draggedIndex = index;
			itemEl.addClass('cr-media__item--dragging');
			e.dataTransfer?.setData('text/plain', String(index));
			e.dataTransfer!.effectAllowed = 'move';
		});

		itemEl.addEventListener('dragend', () => {
			itemEl.removeClass('cr-media__item--dragging');
			this.draggedItem = null;
			this.draggedIndex = -1;

			// Remove all drag-over classes
			if (this.gridElement) {
				this.gridElement.querySelectorAll('.cr-media__item--drag-over').forEach(el => {
					el.removeClass('cr-media__item--drag-over');
				});
			}
		});

		itemEl.addEventListener('dragover', (e) => {
			e.preventDefault();
			e.dataTransfer!.dropEffect = 'move';

			// Don't highlight self
			if (this.draggedIndex === index) return;

			itemEl.addClass('cr-media__item--drag-over');
		});

		itemEl.addEventListener('dragleave', () => {
			itemEl.removeClass('cr-media__item--drag-over');
		});

		itemEl.addEventListener('drop', (e) => {
			e.preventDefault();
			itemEl.removeClass('cr-media__item--drag-over');

			const fromIndex = this.draggedIndex;
			const toIndex = index;

			if (fromIndex === -1 || fromIndex === toIndex) return;

			// Reorder items
			void this.reorderItems(fromIndex, toIndex);
		});
	}

	/**
	 * Reorder items and update frontmatter
	 */
	private async reorderItems(fromIndex: number, toIndex: number): Promise<void> {
		if (!this.currentContext || !this.gridElement) return;

		// Move item in array
		const [movedItem] = this.currentItems.splice(fromIndex, 1);
		this.currentItems.splice(toIndex, 0, movedItem);

		// Update isThumbnail flags
		this.currentItems.forEach((item, i) => {
			item.isThumbnail = i === 0;
		});

		// Visually reorder DOM elements
		this.updateGridOrder();

		// Update frontmatter
		const newMediaRefs = this.currentItems.map(item => item.wikilink);
		await this.updateMediaFrontmatter(this.currentContext.file, newMediaRefs);

		new Notice('Media order updated');
	}

	/**
	 * Update the visual order of grid items to match currentItems
	 */
	private updateGridOrder(): void {
		if (!this.gridElement) return;

		const domItems = Array.from(this.gridElement.children) as HTMLElement[];

		// Build a map of wikilink -> DOM element for matching
		const domMap = new Map<string, HTMLElement>();
		for (const domItem of domItems) {
			const wikilink = this.getWikilinkFromDom(domItem);
			if (wikilink) {
				domMap.set(wikilink, domItem);
			}
		}

		// Re-append in new order based on currentItems
		for (let i = 0; i < this.currentItems.length; i++) {
			const mediaItem = this.currentItems[i];
			const domItem = domMap.get(mediaItem.wikilink);

			if (domItem) {
				// Update thumbnail styling
				if (i === 0) {
					domItem.addClass('cr-media__item--thumbnail');
					// Add badge if not present
					if (!domItem.querySelector('.cr-media__badge')) {
						const badge = domItem.createDiv({ cls: 'cr-media__badge', text: 'Thumbnail' });
						badge.setAttribute('aria-label', 'This image is used as the thumbnail');
					}
				} else {
					domItem.removeClass('cr-media__item--thumbnail');
					// Remove badge if present
					const badge = domItem.querySelector('.cr-media__badge');
					if (badge) badge.remove();
				}

				// Update index
				domItem.dataset.index = String(i);
				domItem.dataset.wikilink = mediaItem.wikilink;

				// Re-append to move to correct position
				this.gridElement.appendChild(domItem);
			}
		}

		// Re-setup drag events with new indices
		const newItems = Array.from(this.gridElement.children) as HTMLElement[];
		newItems.forEach((el, i) => {
			// Remove old listeners by cloning (simplest approach)
			const newEl = el.cloneNode(true) as HTMLElement;
			el.replaceWith(newEl);
			this.setupDragEvents(newEl, i);
		});
	}

	/**
	 * Extract the wikilink from a DOM element for matching
	 */
	private getWikilinkFromDom(el: HTMLElement): string | null {
		// Check stored data attribute first
		if (el.dataset.wikilink) {
			return el.dataset.wikilink;
		}

		// For images, extract from src
		const img = el.querySelector('img');
		if (img && img.src) {
			// Match against current items by checking if src contains the file path
			for (const item of this.currentItems) {
				if (item.file && img.src.includes(encodeURIComponent(item.file.name))) {
					return item.wikilink;
				}
			}
		}

		// For documents, match by name
		const docName = el.querySelector('.cr-media__doc-name');
		if (docName?.textContent) {
			for (const item of this.currentItems) {
				const expectedName = item.file?.basename || item.path.split('/').pop() || '';
				if (docName.textContent === expectedName) {
					return item.wikilink;
				}
			}
		}

		return null;
	}

	/**
	 * Update the media frontmatter property with new order
	 */
	private async updateMediaFrontmatter(file: TFile, mediaRefs: string[]): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			if (mediaRefs.length > 0) {
				fm.media = mediaRefs;
			} else {
				delete fm.media;
			}
		});
	}

	/**
	 * Get Lucide icon name for document type
	 */
	private getDocumentIconName(extension: string): string {
		// PDF files use file-text icon
		if (extension === 'pdf') {
			return 'file-text';
		}

		// Generic document icon
		return 'file';
	}

	/**
	 * Copy media items as embed syntax to clipboard
	 */
	private copyAsEmbeds(): void {
		if (this.currentItems.length === 0) {
			new Notice('No media to copy');
			return;
		}

		const embeds = this.currentItems.map(item => `!${item.wikilink}`).join('\n');
		void navigator.clipboard.writeText(embeds);
		new Notice('Copied media embeds to clipboard');
	}

	/**
	 * Generate markdown from current items and replace the code block
	 */
	private async freezeToMarkdown(): Promise<void> {
		if (!this.currentContext || this.currentItems.length === 0) {
			new Notice('No media to freeze');
			return;
		}

		const markdown = this.generateFrozenMarkdown();
		await this.service.freezeToMarkdown(
			this.currentContext.file,
			'canvas-roots-media',
			markdown
		);
	}

	/**
	 * Generate frozen markdown representation using callout syntax
	 */
	private generateFrozenMarkdown(): string {
		const calloutType = this.plugin.settings.frozenGalleryCalloutType || 'info';
		const lines: string[] = [`> [!${calloutType}|cr-frozen-gallery]`];

		for (const item of this.currentItems) {
			lines.push(`> !${item.wikilink}`);
		}

		return lines.join('\n');
	}
}
