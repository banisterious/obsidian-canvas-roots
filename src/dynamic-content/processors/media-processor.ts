/**
 * Media Processor
 *
 * Handles the `canvas-roots-media` code block.
 * Renders a gallery of media files linked to the current note.
 *
 * Usage in a note:
 * ```canvas-roots-media
 * columns: 4
 * size: medium
 * filter: images
 * ```
 */

import { MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import { DynamicContentService } from '../services/dynamic-content-service';
import { MediaRenderer } from '../renderers/media-renderer';

/**
 * Processor for canvas-roots-media code blocks
 */
export class MediaProcessor {
	private plugin: CanvasRootsPlugin;
	private service: DynamicContentService;
	private renderer: MediaRenderer;

	constructor(plugin: CanvasRootsPlugin) {
		this.plugin = plugin;
		this.service = new DynamicContentService(plugin);
		this.renderer = new MediaRenderer(plugin, this.service);
	}

	/**
	 * Process a canvas-roots-media code block
	 */
	process(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	): void {
		try {
			// Parse config from code block source
			const config = this.service.parseConfig(source);

			// Build context (resolves file, cr_id, person)
			const context = this.service.buildContext(ctx);

			// Create a MarkdownRenderChild for proper cleanup
			const component = new MarkdownRenderChild(el);
			ctx.addChild(component);

			// Render the media gallery
			this.renderer.render(el, context, config, component);

		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.renderError(el, `Error rendering media gallery: ${message}`);
		}
	}

	/**
	 * Render an error message
	 */
	private renderError(el: HTMLElement, message: string): void {
		const container = el.createDiv({ cls: 'cr-dynamic-block cr-dynamic-block--error' });
		container.createDiv({ cls: 'cr-dynamic-block__error-message', text: message });
	}
}
