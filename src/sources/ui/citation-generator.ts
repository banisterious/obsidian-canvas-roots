/**
 * Citation Generator UI Component
 *
 * Modal and UI components for generating and copying citations
 * in various academic and genealogical formats.
 */

import { App, Modal, Notice, setIcon } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { SourceNote, CitationFormat } from '../types/source-types';
import {
	generateCitation,
	generateAllCitations,
	getCitationFormats,
	copyCitationToClipboard
} from '../services/citation-service';

/**
 * Modal for generating citations from a source
 */
export class CitationGeneratorModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private source: SourceNote;
	private selectedFormat: CitationFormat = 'evidence_explained';
	private citationContainer: HTMLElement | null = null;

	constructor(app: App, plugin: CanvasRootsPlugin, source: SourceNote) {
		super(app);
		this.plugin = plugin;
		this.source = source;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-citation-modal');

		// Header
		contentEl.createEl('h2', { text: 'Generate citation' });

		// Source info
		const sourceInfo = contentEl.createDiv({ cls: 'cr-citation-source-info' });
		sourceInfo.createEl('strong', { text: this.source.title });
		if (this.source.date) {
			sourceInfo.createSpan({ text: ` (${this.source.date})`, cls: 'crc-text-muted' });
		}

		// Format selector
		const formatSection = contentEl.createDiv({ cls: 'cr-citation-format-section' });
		formatSection.createEl('label', { text: 'Citation format', cls: 'cr-citation-label' });

		const formatGrid = formatSection.createDiv({ cls: 'cr-citation-format-grid' });
		const formats = getCitationFormats();

		for (const format of formats) {
			const formatOption = formatGrid.createDiv({
				cls: `cr-citation-format-option ${format.id === this.selectedFormat ? 'is-selected' : ''}`
			});

			formatOption.createDiv({ text: format.name, cls: 'cr-citation-format-name' });
			formatOption.createDiv({ text: format.description, cls: 'cr-citation-format-desc' });

			formatOption.addEventListener('click', () => {
				// Update selection
				formatGrid.querySelectorAll('.cr-citation-format-option').forEach(el => {
					el.removeClass('is-selected');
				});
				formatOption.addClass('is-selected');
				this.selectedFormat = format.id;
				this.renderCitation();
			});
		}

		// Citation output
		const citationSection = contentEl.createDiv({ cls: 'cr-citation-output-section' });
		citationSection.createEl('label', { text: 'Generated citation', cls: 'cr-citation-label' });

		this.citationContainer = citationSection.createDiv({ cls: 'cr-citation-output' });
		this.renderCitation();

		// Action buttons
		const actions = contentEl.createDiv({ cls: 'cr-citation-actions' });

		const copyBtn = actions.createEl('button', { cls: 'mod-cta' });
		const copyIcon = copyBtn.createSpan({ cls: 'crc-button-icon' });
		setIcon(copyIcon, 'copy');
		copyBtn.createSpan({ text: 'Copy to clipboard' });
		copyBtn.addEventListener('click', () => void this.copyCurrentCitation());

		const copyAllBtn = actions.createEl('button');
		const copyAllIcon = copyAllBtn.createSpan({ cls: 'crc-button-icon' });
		setIcon(copyAllIcon, 'files');
		copyAllBtn.createSpan({ text: 'Copy all formats' });
		copyAllBtn.addEventListener('click', () => void this.copyAllCitations());

		const closeBtn = actions.createEl('button', { text: 'Close' });
		closeBtn.addEventListener('click', () => this.close());
	}

	private renderCitation(): void {
		if (!this.citationContainer) return;

		this.citationContainer.empty();

		const citation = generateCitation(this.source, this.selectedFormat);

		// Citation text
		const textEl = this.citationContainer.createDiv({ cls: 'cr-citation-text' });
		textEl.textContent = citation.text;

		// Missing fields warning
		if (!citation.isComplete) {
			const warning = this.citationContainer.createDiv({ cls: 'cr-citation-warning' });
			const warningIcon = warning.createSpan({ cls: 'cr-citation-warning-icon' });
			setIcon(warningIcon, 'alert-triangle');
			warning.createSpan({
				text: `Missing fields: ${citation.missingFields.join(', ')}`,
				cls: 'cr-citation-warning-text'
			});
		}
	}

	private async copyCurrentCitation(): Promise<void> {
		const citation = generateCitation(this.source, this.selectedFormat);
		await copyCitationToClipboard(citation);
		new Notice(`Copied ${this.selectedFormat.replace('_', ' ')} citation to clipboard`);
	}

	private async copyAllCitations(): Promise<void> {
		const allCitations = generateAllCitations(this.source);
		const formats = getCitationFormats();

		const text = formats
			.map(f => `## ${f.name}\n${allCitations[f.id].text}`)
			.join('\n\n');

		await navigator.clipboard.writeText(text);
		new Notice('Copied all citation formats to clipboard');
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Render inline citation generator widget
 *
 * Can be embedded in other UI components.
 */
export function renderCitationWidget(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	source: SourceNote
): void {
	const widget = container.createDiv({ cls: 'cr-citation-widget' });

	// Quick copy buttons for each format
	const formats = getCitationFormats();

	const header = widget.createDiv({ cls: 'cr-citation-widget-header' });
	header.createSpan({ text: 'Quick copy citation:', cls: 'cr-citation-widget-label' });

	const buttons = widget.createDiv({ cls: 'cr-citation-widget-buttons' });

	for (const format of formats) {
		const btn = buttons.createEl('button', {
			cls: 'cr-citation-widget-btn',
			attr: { 'aria-label': `Copy ${format.name} citation` }
		});
		btn.createSpan({ text: format.name });

		btn.addEventListener('click', () => {
			const citation = generateCitation(source, format.id);
			void copyCitationToClipboard(citation);
			new Notice(`Copied ${format.name} citation`);
		});
	}

	// Full generator button
	const moreBtn = buttons.createEl('button', {
		cls: 'cr-citation-widget-btn cr-citation-widget-btn--more',
		attr: { 'aria-label': 'Open citation generator' }
	});
	setIcon(moreBtn, 'external-link');

	moreBtn.addEventListener('click', () => {
		new CitationGeneratorModal(plugin.app, plugin, source).open();
	});
}

/**
 * Render citation preview in a card or panel
 */
export function renderCitationPreview(
	container: HTMLElement,
	source: SourceNote,
	format: CitationFormat = 'evidence_explained'
): HTMLElement {
	const preview = container.createDiv({ cls: 'cr-citation-preview' });

	const citation = generateCitation(source, format);

	const formatLabel = preview.createDiv({ cls: 'cr-citation-preview-format' });
	formatLabel.textContent = getCitationFormats().find(f => f.id === format)?.name || format;

	const textEl = preview.createDiv({ cls: 'cr-citation-preview-text' });
	textEl.textContent = citation.text;

	return preview;
}
