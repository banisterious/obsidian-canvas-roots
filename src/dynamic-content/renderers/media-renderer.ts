/**
 * Media Renderer
 *
 * Renders media gallery HTML for the canvas-roots-media code block.
 * Creates a styled grid of thumbnails from the note's `media` frontmatter property.
 */

import { MarkdownRenderChild, TFile, Notice } from 'obsidian';
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

	constructor(plugin: CanvasRootsPlugin, service: DynamicContentService) {
		this.plugin = plugin;
		this.service = service;
	}

	/**
	 * Render the media gallery block
	 */
	async render(
		el: HTMLElement,
		context: DynamicBlockContext,
		config: DynamicBlockConfig,
		component: MarkdownRenderChild
	): Promise<void> {
		const container = el.createDiv({ cls: 'cr-dynamic-block cr-media' });

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
		await this.renderGalleryGrid(contentEl, items, columns, size, component);
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
		iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
			<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
			<circle cx="8.5" cy="8.5" r="1.5"/>
			<polyline points="21,15 16,10 5,21"/>
		</svg>`;

		titleEl.createSpan({ text: ` ${titleWithCount}` });

		// Toolbar
		const toolbar = header.createDiv({ cls: 'cr-dynamic-block__toolbar' });

		// Freeze button
		const freezeBtn = toolbar.createEl('button', {
			cls: 'cr-dynamic-block__btn clickable-icon',
			attr: { 'aria-label': 'Freeze to markdown' }
		});
		freezeBtn.innerHTML = '❄️';
		freezeBtn.addEventListener('click', () => {
			void this.freezeToMarkdown();
		});

		// Copy button
		const copyBtn = toolbar.createEl('button', {
			cls: 'cr-dynamic-block__btn clickable-icon',
			attr: { 'aria-label': 'Copy as embeds' }
		});
		copyBtn.innerHTML = '📋';
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
		iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
			<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
			<circle cx="8.5" cy="8.5" r="1.5"/>
			<polyline points="21,15 16,10 5,21"/>
		</svg>`;

		empty.createDiv({ cls: 'cr-media__empty-text', text: 'No media linked to this note.' });
		empty.createDiv({ cls: 'cr-media__empty-hint', text: 'Add media wikilinks to the "media" frontmatter property.' });
	}

	/**
	 * Render the gallery grid
	 */
	private async renderGalleryGrid(
		contentEl: HTMLElement,
		items: MediaItem[],
		columns: number | 'auto',
		size: GallerySize,
		_component: MarkdownRenderChild
	): Promise<void> {
		// Create grid with appropriate classes
		const gridClasses = ['cr-media__grid'];

		if (columns === 'auto') {
			gridClasses.push('cr-media__grid--auto');
		} else {
			gridClasses.push(`cr-media__grid--cols-${columns}`);
		}

		gridClasses.push(`cr-media__grid--${size}`);

		const grid = contentEl.createDiv({ cls: gridClasses.join(' ') });

		// Render each item
		for (const item of items) {
			await this.renderGalleryItem(grid, item);
		}
	}

	/**
	 * Render a single gallery item
	 */
	private async renderGalleryItem(grid: HTMLElement, item: MediaItem): Promise<void> {
		const itemClasses = ['cr-media__item'];
		if (item.isThumbnail) {
			itemClasses.push('cr-media__item--thumbnail');
		}

		const itemEl = grid.createDiv({ cls: itemClasses.join(' ') });

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
			itemEl.addEventListener('click', () => {
				if (item.file) {
					this.plugin.app.workspace.openLinkText(item.path, '', false);
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
			iconEl.innerHTML = this.getDocumentIcon(item.extension);

			const nameEl = itemEl.createDiv({ cls: 'cr-media__doc-name' });
			nameEl.textContent = item.file?.basename || item.path.split('/').pop() || 'Document';

			// Add click handler
			itemEl.addEventListener('click', () => {
				if (item.file) {
					this.plugin.app.workspace.openLinkText(item.path, '', false);
				}
			});
		}
	}

	/**
	 * Get SVG icon for document type
	 */
	private getDocumentIcon(extension: string): string {
		// PDF icon
		if (extension === 'pdf') {
			return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
				<polyline points="14,2 14,8 20,8"/>
				<line x1="16" y1="13" x2="8" y2="13"/>
				<line x1="16" y1="17" x2="8" y2="17"/>
				<polyline points="10,9 9,9 8,9"/>
			</svg>`;
		}

		// Generic document icon
		return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
			<polyline points="14,2 14,8 20,8"/>
		</svg>`;
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
		const lines: string[] = ['> [!info|cr-frozen-gallery]'];

		for (const item of this.currentItems) {
			lines.push(`> !${item.wikilink}`);
		}

		return lines.join('\n');
	}
}
