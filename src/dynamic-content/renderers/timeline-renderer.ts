/**
 * Timeline Renderer
 *
 * Renders timeline HTML for the canvas-roots-timeline code block.
 * Creates a styled list of events with dates and descriptions.
 */

import { MarkdownRenderer, MarkdownRenderChild } from 'obsidian';
import type { DynamicBlockContext, DynamicBlockConfig } from '../services/dynamic-content-service';
import type { DynamicContentService } from '../services/dynamic-content-service';

/**
 * Timeline entry combining events from EventService with person birth/death
 */
export interface TimelineEntry {
	date: string;
	year: string;
	type: string;
	title: string;
	place?: string;
	description?: string;
	/** For linking to the event note */
	eventFile?: string;
}

/**
 * Renders timeline content into an HTML element
 */
export class TimelineRenderer {
	private service: DynamicContentService;
	/** Store entries for freeze functionality */
	private currentEntries: TimelineEntry[] = [];
	private currentContext: DynamicBlockContext | null = null;

	constructor(service: DynamicContentService) {
		this.service = service;
	}

	/**
	 * Render the timeline block
	 */
	async render(
		el: HTMLElement,
		context: DynamicBlockContext,
		config: DynamicBlockConfig,
		component: MarkdownRenderChild
	): Promise<void> {
		const container = el.createDiv({ cls: 'cr-dynamic-block cr-timeline' });

		// Build timeline entries
		const entries = this.buildTimelineEntries(context, config);

		// Store for freeze functionality
		this.currentEntries = entries;
		this.currentContext = context;

		// Render header (needs entries for freeze)
		this.renderHeader(container, config);

		// Render content
		const contentEl = container.createDiv({ cls: 'cr-dynamic-block__content' });

		if (entries.length === 0) {
			contentEl.createDiv({
				cls: 'cr-dynamic-block__empty',
				text: 'No events found for this person.'
			});
			return;
		}

		// Render timeline list
		await this.renderTimelineList(contentEl, entries, context, component);
	}

	/**
	 * Render the header with title and toolbar
	 */
	private renderHeader(container: HTMLElement, config: DynamicBlockConfig): void {
		const header = container.createDiv({ cls: 'cr-dynamic-block__header' });

		const title = config.title as string || 'Timeline';
		header.createSpan({ cls: 'cr-dynamic-block__title', text: title });

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
			attr: { 'aria-label': 'Copy timeline' }
		});
		copyBtn.textContent = '📋';
		copyBtn.addEventListener('click', () => {
			this.copyTimelineToClipboard(container);
		});
	}

	/**
	 * Build timeline entries from events and person data
	 */
	private buildTimelineEntries(
		context: DynamicBlockContext,
		config: DynamicBlockConfig
	): TimelineEntry[] {
		const entries: TimelineEntry[] = [];
		const { person } = context;

		// Check what event types to include
		const include = config.include as string[] | undefined;
		const shouldInclude = (type: string): boolean => {
			if (!include || include.length === 0) return true;
			return include.includes(type);
		};

		// Add birth from person note
		if (person?.birthDate && shouldInclude('birth')) {
			entries.push({
				date: this.service.formatDate(person.birthDate),
				year: this.service.extractYear(person.birthDate),
				type: 'birth',
				title: 'Born',
				place: person.birthPlace ? this.service.stripWikilink(person.birthPlace) : undefined
			});
		}

		// Add events from EventService
		const events = this.service.getPersonEvents(context, config);
		for (const event of events) {
			// Skip birth/death if they're from EventService but we already have them from person
			if (event.eventType === 'birth' && person?.birthDate) continue;
			if (event.eventType === 'death' && person?.deathDate) continue;

			entries.push({
				date: this.service.formatDate(event.date),
				year: this.service.extractYear(event.date),
				type: event.eventType,
				title: event.title,
				place: event.place ? this.service.stripWikilink(event.place) : undefined,
				description: event.description,
				eventFile: event.file?.basename
			});
		}

		// Add death from person note
		if (person?.deathDate && shouldInclude('death')) {
			entries.push({
				date: this.service.formatDate(person.deathDate),
				year: this.service.extractYear(person.deathDate),
				type: 'death',
				title: 'Died',
				place: person.deathPlace ? this.service.stripWikilink(person.deathPlace) : undefined
			});
		}

		// Sort entries by date
		const sortOrder = config.sort as string || 'chronological';
		entries.sort((a, b) => {
			const yearA = parseInt(a.year) || 0;
			const yearB = parseInt(b.year) || 0;

			if (sortOrder === 'reverse') {
				return yearB - yearA;
			}
			return yearA - yearB;
		});

		// Apply limit
		const limit = config.limit as number | undefined;
		if (limit && limit > 0 && entries.length > limit) {
			return entries.slice(0, limit);
		}

		return entries;
	}

	/**
	 * Render the timeline list
	 */
	private async renderTimelineList(
		contentEl: HTMLElement,
		entries: TimelineEntry[],
		context: DynamicBlockContext,
		component: MarkdownRenderChild
	): Promise<void> {
		const list = contentEl.createEl('ul', { cls: 'cr-timeline__list' });

		for (const entry of entries) {
			const li = list.createEl('li', { cls: 'cr-timeline__item' });

			// Year/date
			const yearSpan = li.createSpan({ cls: 'cr-timeline__year' });
			yearSpan.textContent = entry.year || entry.date || '?';

			// Separator
			li.createSpan({ cls: 'cr-timeline__separator', text: ' — ' });

			// Event title with optional link
			const titleSpan = li.createSpan({ cls: 'cr-timeline__title' });
			if (entry.eventFile) {
				// Render as wikilink
				await MarkdownRenderer.render(
					context.familyGraph['app'], // Access app from familyGraph
					`[[${entry.eventFile}|${entry.title}]]`,
					titleSpan,
					context.file.path,
					component
				);
			} else {
				titleSpan.textContent = entry.title;
			}

			// Place (if present)
			if (entry.place) {
				li.createSpan({ cls: 'cr-timeline__place', text: ` in ${entry.place}` });
			}
		}
	}

	/**
	 * Copy timeline to clipboard as plain text
	 */
	private copyTimelineToClipboard(container: HTMLElement): void {
		const items = container.querySelectorAll('.cr-timeline__item');
		const lines: string[] = [];

		items.forEach(item => {
			const year = item.querySelector('.cr-timeline__year')?.textContent || '';
			const title = item.querySelector('.cr-timeline__title')?.textContent || '';
			const place = item.querySelector('.cr-timeline__place')?.textContent || '';
			lines.push(`${year} — ${title}${place}`);
		});

		const text = lines.join('\n');
		void navigator.clipboard.writeText(text);
	}

	/**
	 * Generate markdown from current entries and replace the code block
	 */
	private async freezeToMarkdown(): Promise<void> {
		if (!this.currentContext || this.currentEntries.length === 0) {
			return;
		}

		const markdown = this.generateMarkdown();
		await this.service.freezeToMarkdown(
			this.currentContext.file,
			'canvas-roots-timeline',
			markdown
		);
	}

	/**
	 * Generate markdown representation of the timeline
	 */
	private generateMarkdown(): string {
		const lines: string[] = ['## Timeline', ''];

		for (const entry of this.currentEntries) {
			let line = `- **${entry.year || entry.date || '?'}** — `;

			// Add title with wikilink if it's an event
			if (entry.eventFile) {
				line += `[[${entry.eventFile}|${entry.title}]]`;
			} else {
				line += entry.title;
			}

			// Add place
			if (entry.place) {
				line += ` in ${entry.place}`;
			}

			lines.push(line);
		}

		return lines.join('\n');
	}
}
