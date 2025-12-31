/**
 * Timeline Processor
 *
 * Handles the `canvas-roots-timeline` code block.
 * Renders a chronological list of events for the current person note.
 *
 * Usage in a note:
 * ```canvas-roots-timeline
 * sort: chronological
 * include: birth, death, marriage, residence
 * limit: 10
 * ```
 */

import { MarkdownPostProcessorContext, MarkdownRenderChild, TAbstractFile, TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import { DynamicContentService } from '../services/dynamic-content-service';
import { TimelineRenderer } from '../renderers/timeline-renderer';

/**
 * Processor for canvas-roots-timeline code blocks
 */
export class TimelineProcessor {
	private plugin: CanvasRootsPlugin;
	private service: DynamicContentService;
	private renderer: TimelineRenderer;

	constructor(plugin: CanvasRootsPlugin) {
		this.plugin = plugin;
		this.service = new DynamicContentService(plugin);
		this.renderer = new TimelineRenderer(this.service);
	}

	/**
	 * Process a canvas-roots-timeline code block
	 */
	async process(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	): Promise<void> {
		try {
			// Parse config from code block source
			const config = this.service.parseConfig(source);

			// Build context (resolves file, cr_id, person)
			const context = this.service.buildContext(ctx);

			// Create a MarkdownRenderChild for proper cleanup of rendered markdown
			const component = new MarkdownRenderChild(el);
			ctx.addChild(component);

			// If cr_id not found, the metadata cache may not be ready yet
			// Show loading state and wait for the 'changed' event to re-render
			if (!context.crId) {
				this.renderLoading(el, 'Waiting for metadata...');

				// Register for metadata changes - will re-render when cache is ready
				const metadataHandler = async (changedFile: TFile) => {
					if (changedFile.path === context.file.path) {
						// Re-build context to get fresh data
						const freshContext = this.service.buildContext(ctx);
						// Clear and re-render
						el.empty();
						if (freshContext.crId) {
							await this.renderer.render(el, freshContext, config, component);
						} else {
							this.renderError(el, 'This note does not have a cr_id. Timeline can only be rendered in person notes.');
						}
					}
				};

				component.registerEvent(
					this.plugin.app.metadataCache.on('changed', metadataHandler)
				);
				return;
			}

			// Initial render
			await this.renderer.render(el, context, config, component);

			// Get the events folder for filtering event note changes
			const eventsFolder = this.plugin.settings.eventsFolder || '';

			// Register for metadata changes to re-render when frontmatter changes
			const metadataHandler = async (changedFile: TFile) => {
				// Re-render if the person's own file changed
				if (changedFile.path === context.file.path) {
					// Re-build context to get fresh data
					const freshContext = this.service.buildContext(ctx);
					// Clear and re-render
					el.empty();
					await this.renderer.render(el, freshContext, config, component);
					return;
				}

				// Also re-render if an event note changed (it might reference this person)
				if (eventsFolder && changedFile.path.startsWith(eventsFolder)) {
					// Re-build context to get fresh data (this will reload events)
					const freshContext = this.service.buildContext(ctx);
					// Clear and re-render
					el.empty();
					await this.renderer.render(el, freshContext, config, component);
				}
			};

			// Register the event and store reference for cleanup
			component.registerEvent(
				this.plugin.app.metadataCache.on('changed', metadataHandler)
			);

			// Also listen for file creation events (for newly created event notes)
			const createHandler = (file: TAbstractFile) => {
				if (file instanceof TFile && eventsFolder && file.path.startsWith(eventsFolder)) {
					// Small delay to allow metadata cache to process the new file
					setTimeout(() => {
						const freshContext = this.service.buildContext(ctx);
						el.empty();
						void this.renderer.render(el, freshContext, config, component);
					}, 100);
				}
			};

			component.registerEvent(
				this.plugin.app.vault.on('create', createHandler)
			);

		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.renderError(el, `Error rendering timeline: ${message}`);
		}
	}

	/**
	 * Render an error message
	 */
	private renderError(el: HTMLElement, message: string): void {
		const container = el.createDiv({ cls: 'cr-dynamic-block cr-dynamic-block--error' });
		container.createDiv({ cls: 'cr-dynamic-block__error-message', text: message });
	}

	/**
	 * Render a loading state
	 */
	private renderLoading(el: HTMLElement, message: string): void {
		const container = el.createDiv({ cls: 'cr-dynamic-block cr-dynamic-block--loading' });
		container.createDiv({ cls: 'cr-dynamic-block__loading-message', text: message });
	}
}
