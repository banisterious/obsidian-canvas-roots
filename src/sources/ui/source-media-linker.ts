/**
 * Source Media Linker Wizard
 *
 * Multi-step wizard for linking existing media files to existing source notes.
 * Unlike the import wizard which creates new sources, this wizard attaches
 * media to sources that already exist but don't have media attached.
 */

import { App, Modal, Notice, Setting, TFile, TFolder, TextComponent, AbstractInputSuggest } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import { createLucideIcon } from '../../ui/lucide-icons';
import { SourceService } from '../services/source-service';
import { isImageFile, shouldFilterFile, parseFilename } from '../services/image-filename-parser';
import type { SourceNote } from '../types/source-types';

/**
 * Simple folder suggest for text inputs
 */
class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private textComponent: TextComponent;
	private onSelectValue?: (value: string) => void;

	constructor(app: App, textComponent: TextComponent, onSelectValue?: (value: string) => void) {
		super(app, textComponent.inputEl);
		this.textComponent = textComponent;
		this.onSelectValue = onSelectValue;
	}

	getSuggestions(query: string): TFolder[] {
		const folders: TFolder[] = [];
		const lowerQuery = query.toLowerCase();

		const collectFolders = (folder: TFolder) => {
			if (folder.path.toLowerCase().includes(lowerQuery) || !query) {
				folders.push(folder);
			}
			for (const child of folder.children) {
				if (child instanceof TFolder) {
					collectFolders(child);
				}
			}
		};

		collectFolders(this.app.vault.getRoot());
		return folders.slice(0, 20);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path || '(Root)');
	}

	selectSuggestion(folder: TFolder): void {
		this.textComponent.setValue(folder.path);
		this.onSelectValue?.(folder.path);
		this.close();
	}
}

/**
 * Wizard step type
 */
type WizardStep = 'select' | 'link' | 'review' | 'execute';

/**
 * Media file with linking info
 */
interface MediaFileInfo {
	file: TFile;
	linkedSource: SourceNote | null;
	suggestedSources: ScoredSource[];
	isFiltered: boolean;
}

/**
 * Source with match score for suggestions
 */
interface ScoredSource {
	source: SourceNote;
	score: number;
	matchReasons: string[];
}

/**
 * Link result for a single media file
 */
interface LinkResult {
	success: boolean;
	mediaPath: string;
	sourcePath?: string;
	error?: string;
}

/**
 * Source Media Linker Wizard Modal
 */
export class SourceMediaLinkerModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private sourceService: SourceService;

	// Wizard state
	private currentStep: WizardStep = 'select';

	// Step 1: Select Media
	private selectedFolder: string = '';
	private excludeThumbnails: boolean = true;
	private excludeHidden: boolean = true;

	// File and source data
	private allFiles: MediaFileInfo[] = [];
	private filteredFiles: MediaFileInfo[] = [];
	private sourcesWithoutMedia: SourceNote[] = [];

	// Step 3: Execute
	private isExecuting: boolean = false;
	private executionResults: LinkResult[] = [];
	private executionProgress: number = 0;

	constructor(app: App, plugin: CanvasRootsPlugin) {
		super(app);
		this.plugin = plugin;
		this.sourceService = new SourceService(app, plugin.settings);
	}

	onOpen(): void {
		const { titleEl, modalEl } = this;
		titleEl.setText('Link media to existing sources');
		modalEl.addClass('cr-media-linker');

		// Load sources without media
		this.loadSourcesWithoutMedia();

		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	/**
	 * Load all source notes that don't have media attached
	 */
	private loadSourcesWithoutMedia(): void {
		this.sourcesWithoutMedia = this.sourceService.getSourcesWithoutMedia();
	}

	/**
	 * Render the current wizard step
	 */
	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Progress indicator
		this.renderProgressIndicator();

		// Step content
		const stepContent = contentEl.createDiv({ cls: 'cr-media-linker__content' });

		switch (this.currentStep) {
			case 'select':
				this.renderSelectStep(stepContent);
				break;
			case 'link':
				this.renderLinkStep(stepContent);
				break;
			case 'review':
				this.renderReviewStep(stepContent);
				break;
			case 'execute':
				this.renderExecuteStep(stepContent);
				break;
		}

		// Navigation buttons
		this.renderNavigationButtons();
	}

	/**
	 * Render step progress indicator
	 */
	private renderProgressIndicator(): void {
		const { contentEl } = this;
		const steps: WizardStep[] = ['select', 'link', 'review', 'execute'];
		const stepLabels = ['Select media', 'Link to sources', 'Review', 'Execute'];

		const progressEl = contentEl.createDiv({ cls: 'cr-media-linker__progress' });

		steps.forEach((step, index) => {
			const stepIndex = steps.indexOf(this.currentStep);
			const isActive = step === this.currentStep;
			const isCompleted = stepIndex > index;

			const stepEl = progressEl.createDiv({
				cls: `cr-media-linker__step ${isActive ? 'cr-media-linker__step--active' : ''} ${isCompleted ? 'cr-media-linker__step--completed' : ''}`,
			});

			stepEl.createDiv({
				cls: 'cr-media-linker__step-number',
				text: isCompleted ? '✓' : String(index + 1),
			});

			stepEl.createDiv({
				cls: 'cr-media-linker__step-label',
				text: stepLabels[index],
			});
		});
	}

	/**
	 * Step 1: Select Media Folder
	 */
	private renderSelectStep(container: HTMLElement): void {
		container.createDiv({
			cls: 'cr-media-linker__step-header',
			text: 'Select media folder',
		});

		// Info about sources without media
		const infoBox = container.createDiv({ cls: 'cr-media-linker__info-box' });
		const infoIcon = createLucideIcon('info', 16);
		infoBox.appendChild(infoIcon);
		infoBox.createSpan({
			text: `${this.sourcesWithoutMedia.length} source notes found without media attached`,
		});

		if (this.sourcesWithoutMedia.length === 0) {
			const warningBox = container.createDiv({ cls: 'cr-media-linker__warning-box' });
			const warningIcon = createLucideIcon('alert-triangle', 16);
			warningBox.appendChild(warningIcon);
			warningBox.createSpan({
				text: 'All source notes already have media attached. Create sources first or use the Import wizard to create new sources from images.',
			});
			return;
		}

		// Folder selection
		new Setting(container)
			.setName('Media folder')
			.setDesc('Select the vault folder containing images to link')
			.addText((text) => {
				text.setPlaceholder('Canvas Roots/Sources/Media').setValue(this.selectedFolder);

				new FolderSuggest(this.app, text, (value) => {
					this.selectedFolder = value;
					this.loadFilesFromFolder();
					this.render();
				});

				text.onChange((value) => {
					this.selectedFolder = value;
					this.loadFilesFromFolder();
					this.render();
				});
			});

		// Filter options
		container.createDiv({
			cls: 'cr-media-linker__section-header',
			text: 'Filter options',
		});

		new Setting(container)
			.setName('Exclude thumbnails')
			.setDesc('Skip files starting with thumb_ or thumbnail_')
			.addToggle((toggle) => {
				toggle.setValue(this.excludeThumbnails).onChange((value) => {
					this.excludeThumbnails = value;
					this.applyFilters();
					this.render();
				});
			});

		new Setting(container)
			.setName('Exclude hidden files')
			.setDesc('Skip files starting with a dot (.)')
			.addToggle((toggle) => {
				toggle.setValue(this.excludeHidden).onChange((value) => {
					this.excludeHidden = value;
					this.applyFilters();
					this.render();
				});
			});

		// File preview
		if (this.selectedFolder) {
			this.renderFilePreview(container);
		}
	}

	/**
	 * Load files from selected folder
	 */
	private loadFilesFromFolder(): void {
		this.allFiles = [];
		this.filteredFiles = [];

		if (!this.selectedFolder) return;

		const folder = this.app.vault.getAbstractFileByPath(this.selectedFolder);
		if (!(folder instanceof TFolder)) return;

		// Recursively get all files in folder
		const getAllFiles = (f: TFolder): TFile[] => {
			const files: TFile[] = [];
			for (const child of f.children) {
				if (child instanceof TFile) {
					files.push(child);
				} else if (child instanceof TFolder) {
					files.push(...getAllFiles(child));
				}
			}
			return files;
		};

		const files = getAllFiles(folder);

		// Process each file
		for (const file of files) {
			if (!isImageFile(file.name)) continue;

			const suggestions = this.calculateSuggestions(file);

			this.allFiles.push({
				file,
				// Auto-select top suggestion if available
				linkedSource: suggestions.length > 0 ? suggestions[0].source : null,
				suggestedSources: suggestions,
				isFiltered: false,
			});
		}

		this.applyFilters();
	}

	/**
	 * Calculate source suggestions for a file based on filename analysis
	 */
	private calculateSuggestions(file: TFile): ScoredSource[] {
		const scored: ScoredSource[] = [];
		const parsed = parseFilename(file.name);
		const filenameLower = file.name.toLowerCase();

		for (const source of this.sourcesWithoutMedia) {
			const score = this.scoreSourceMatch(source, parsed, filenameLower);
			if (score.score > 0) {
				scored.push(score);
			}
		}

		// Sort by score descending
		scored.sort((a, b) => b.score - a.score);

		// Return top 5 suggestions
		return scored.slice(0, 5);
	}

	/**
	 * Score how well a source matches a file
	 */
	private scoreSourceMatch(
		source: SourceNote,
		parsed: ReturnType<typeof parseFilename>,
		filenameLower: string
	): ScoredSource {
		let score = 0;
		const matchReasons: string[] = [];
		const titleLower = source.title.toLowerCase();
		const titleWords = titleLower.split(/[\s\-_]+/);

		// Check for surname matches
		for (const surname of parsed.surnames) {
			if (titleLower.includes(surname.toLowerCase())) {
				score += 30;
				matchReasons.push(`Surname: ${surname}`);
			}
		}

		// Check for year matches
		if (parsed.recordYear && source.date) {
			const sourceYear = source.date.match(/\d{4}/)?.[0];
			if (sourceYear && String(parsed.recordYear) === sourceYear) {
				score += 25;
				matchReasons.push(`Year: ${parsed.recordYear}`);
			}
		}

		// Check for type keyword matches
		if (parsed.recordType) {
			const typeKeywords: Record<string, string[]> = {
				census: ['census'],
				vital_record: ['birth', 'death', 'marriage', 'vital'],
				military_record: ['military', 'draft', 'wwi', 'wwii', 'war', 'veteran'],
				immigration: ['immigration', 'passenger', 'ellis', 'naturalization'],
				church_record: ['baptism', 'church', 'parish', 'christening'],
				court_record: ['probate', 'court', 'deed', 'land'],
				obituary: ['obituary', 'obit', 'death notice'],
				cemetery: ['cemetery', 'grave', 'burial', 'headstone'],
			};

			const keywords = typeKeywords[parsed.recordType] || [parsed.recordType];
			for (const kw of keywords) {
				if (titleLower.includes(kw)) {
					score += 20;
					matchReasons.push(`Type: ${kw}`);
					break;
				}
			}
		}

		// Check for location matches
		if (parsed.location?.state) {
			if (titleLower.includes(parsed.location.state.toLowerCase())) {
				score += 15;
				matchReasons.push(`Location: ${parsed.location.state}`);
			}
		}

		// Check for any word overlap between filename tokens and title words
		const filenameTokens = filenameLower.replace(/\.[^.]+$/, '').split(/[\s\-_]+/);
		for (const token of filenameTokens) {
			if (token.length >= 3 && titleWords.includes(token)) {
				score += 5;
				if (!matchReasons.some((r) => r.includes(token))) {
					matchReasons.push(`Word: ${token}`);
				}
			}
		}

		return { source, score, matchReasons };
	}

	/**
	 * Apply filters to file list
	 */
	private applyFilters(): void {
		for (const info of this.allFiles) {
			let filtered = false;

			if (this.excludeThumbnails && shouldFilterFile(info.file.name)) {
				filtered = true;
			}

			if (this.excludeHidden && info.file.name.startsWith('.')) {
				filtered = true;
			}

			info.isFiltered = filtered;
		}

		this.filteredFiles = this.allFiles.filter((f) => !f.isFiltered);
	}

	/**
	 * Render file preview list
	 */
	private renderFilePreview(container: HTMLElement): void {
		const preview = container.createDiv({ cls: 'cr-media-linker__preview' });

		const header = preview.createDiv({ cls: 'cr-media-linker__preview-header' });
		header.createSpan({ text: 'Images found', cls: 'cr-media-linker__preview-title' });

		const filteredCount = this.allFiles.filter((f) => f.isFiltered).length;
		header.createSpan({
			text: `${this.filteredFiles.length} images${filteredCount > 0 ? ` (${filteredCount} excluded)` : ''}`,
			cls: 'cr-media-linker__preview-count',
		});

		if (this.filteredFiles.length === 0) {
			preview.createDiv({
				cls: 'cr-media-linker__empty',
				text: 'No image files found in this folder',
			});
			return;
		}

		const list = preview.createDiv({ cls: 'cr-media-linker__file-list' });

		// Show up to 10 files
		const displayFiles = this.filteredFiles.slice(0, 10);
		for (const info of displayFiles) {
			const item = list.createDiv({ cls: 'cr-media-linker__file-item' });
			const icon = createLucideIcon('image', 14);
			item.appendChild(icon);
			item.createSpan({ text: info.file.name });

			// Show suggestion count
			if (info.suggestedSources.length > 0) {
				const suggestionBadge = item.createSpan({ cls: 'cr-media-linker__suggestion-badge' });
				suggestionBadge.textContent = `${info.suggestedSources.length} suggestion${info.suggestedSources.length > 1 ? 's' : ''}`;
			}
		}

		if (this.filteredFiles.length > 10) {
			list.createDiv({
				cls: 'cr-media-linker__file-more',
				text: `... and ${this.filteredFiles.length - 10} more files`,
			});
		}
	}

	/**
	 * Step 2: Link Media to Sources
	 */
	private renderLinkStep(container: HTMLElement): void {
		container.createDiv({
			cls: 'cr-media-linker__step-header',
			text: 'Link media to sources',
		});

		container.createDiv({
			cls: 'cr-media-linker__help',
			text: 'Select a source for each image. Suggestions are based on filename analysis.',
		});

		// Summary with breakdown
		const linkedCount = this.filteredFiles.filter((f) => f.linkedSource !== null).length;
		const autoMatchedCount = this.filteredFiles.filter((f) => f.suggestedSources.length > 0).length;
		const manualCount = this.filteredFiles.length - autoMatchedCount;

		const summaryEl = container.createDiv({ cls: 'cr-media-linker__link-summary' });
		summaryEl.createSpan({ text: `${linkedCount} of ${this.filteredFiles.length} images linked` });
		if (manualCount > 0) {
			summaryEl.createSpan({
				cls: 'cr-media-linker__summary-detail',
				text: ` · ${autoMatchedCount} auto-matched, ${manualCount} need manual selection`,
			});
		}

		// Table
		const tableContainer = container.createDiv({ cls: 'cr-media-linker__table-container' });
		const table = tableContainer.createEl('table', { cls: 'cr-media-linker__table' });

		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Image' });
		headerRow.createEl('th', { text: 'Link to source' });
		headerRow.createEl('th', { text: '', cls: 'cr-media-linker__th-status' });

		// Body
		const tbody = table.createEl('tbody');

		for (const info of this.filteredFiles.slice(0, 50)) {
			this.renderLinkRow(tbody, info);
		}

		if (this.filteredFiles.length > 50) {
			container.createDiv({
				cls: 'cr-media-linker__info',
				text: `Showing 50 of ${this.filteredFiles.length} files`,
			});
		}
	}

	/**
	 * Get confidence level based on top suggestion score
	 */
	private getMatchConfidence(info: MediaFileInfo): 'high' | 'medium' | 'low' | 'none' {
		if (info.suggestedSources.length === 0) return 'none';
		const topScore = info.suggestedSources[0].score;
		if (topScore >= 50) return 'high'; // Surname + year + type
		if (topScore >= 30) return 'medium'; // Surname or strong single match
		return 'low'; // Weak matches
	}

	/**
	 * Render a row in the link table
	 */
	private renderLinkRow(tbody: HTMLElement, info: MediaFileInfo): void {
		const hasSuggestions = info.suggestedSources.length > 0;
		const confidence = this.getMatchConfidence(info);

		// Add row class based on match status
		const rowClasses = ['cr-media-linker__row'];
		if (!hasSuggestions) {
			rowClasses.push('cr-media-linker__row--no-match');
		}
		const row = tbody.createEl('tr', { cls: rowClasses.join(' ') });

		// Image cell with confidence indicator
		const imageCell = row.createEl('td', { cls: 'cr-media-linker__cell-image' });

		// Confidence dot
		if (hasSuggestions) {
			const confidenceDot = imageCell.createSpan({
				cls: `cr-media-linker__confidence cr-media-linker__confidence--${confidence}`,
			});
			confidenceDot.setAttribute('aria-label', `${confidence} confidence match`);
		} else {
			const confidenceDot = imageCell.createSpan({
				cls: 'cr-media-linker__confidence cr-media-linker__confidence--none',
			});
			confidenceDot.setAttribute('aria-label', 'No suggestions found');
		}

		const fileNameEl = imageCell.createEl('code', { cls: 'cr-media-linker__filename' });
		fileNameEl.textContent = info.file.name;

		// Source dropdown cell
		const sourceCell = row.createEl('td', { cls: 'cr-media-linker__cell-source' });

		// Wrapper for dropdown and badge
		const selectWrapper = sourceCell.createDiv({ cls: 'cr-media-linker__select-wrapper' });

		// Use standard DOM API for select/option elements (Obsidian's createEl doesn't handle them well)
		const select = document.createElement('select');
		select.className = 'dropdown';
		selectWrapper.appendChild(select);

		// Empty option - different text based on whether suggestions exist
		const emptyOpt = document.createElement('option');
		emptyOpt.value = '';
		emptyOpt.textContent = hasSuggestions ? '— Select source —' : '— No suggestions (select manually) —';
		select.appendChild(emptyOpt);

		// Suggestions group (if any)
		if (hasSuggestions) {
			const suggestGroup = document.createElement('optgroup');
			suggestGroup.label = 'Suggestions';
			for (const suggestion of info.suggestedSources) {
				const opt = document.createElement('option');
				opt.value = suggestion.source.crId;
				opt.textContent = `${suggestion.source.title} (${suggestion.matchReasons.slice(0, 2).join(', ')})`;
				if (info.linkedSource?.crId === suggestion.source.crId) {
					opt.selected = true;
				}
				suggestGroup.appendChild(opt);
			}
			select.appendChild(suggestGroup);
		}

		// All sources group
		const allGroup = document.createElement('optgroup');
		allGroup.label = 'All sources';
		for (const source of this.sourcesWithoutMedia) {
			// Skip if already in suggestions
			if (info.suggestedSources.some((s) => s.source.crId === source.crId)) continue;

			const opt = document.createElement('option');
			opt.value = source.crId;
			opt.textContent = source.title;
			if (info.linkedSource?.crId === source.crId) {
				opt.selected = true;
			}
			allGroup.appendChild(opt);
		}
		select.appendChild(allGroup);

		// "+N more" badge if there are alternative suggestions
		if (info.suggestedSources.length > 1) {
			const moreBadge = selectWrapper.createSpan({ cls: 'cr-media-linker__more-badge' });
			moreBadge.textContent = `+${info.suggestedSources.length - 1} more`;
			moreBadge.setAttribute('aria-label', `${info.suggestedSources.length - 1} alternative suggestion${info.suggestedSources.length > 2 ? 's' : ''}`);
		}

		// Handle selection
		select.addEventListener('change', () => {
			const selectedId = select.value;
			if (selectedId) {
				info.linkedSource = this.sourcesWithoutMedia.find((s) => s.crId === selectedId) || null;
			} else {
				info.linkedSource = null;
			}
			this.render();
		});

		// Status cell
		const statusCell = row.createEl('td', { cls: 'cr-media-linker__cell-status' });
		if (info.linkedSource) {
			statusCell.createSpan({ text: '✓', cls: 'cr-media-linker__status-ok' });
		} else {
			statusCell.createSpan({ text: '—', cls: 'crc-text-muted' });
		}
	}

	/**
	 * Step 3: Review Changes
	 */
	private renderReviewStep(container: HTMLElement): void {
		container.createDiv({
			cls: 'cr-media-linker__step-header',
			text: 'Review changes',
		});

		const linkedFiles = this.filteredFiles.filter((f) => f.linkedSource !== null);

		if (linkedFiles.length === 0) {
			const emptyEl = container.createDiv({ cls: 'cr-media-linker__empty' });
			emptyEl.createSpan({ text: 'No images have been linked to sources.' });
			emptyEl.createSpan({ cls: 'crc-text-muted', text: ' Go back and select sources for your images.' });
			return;
		}

		// Summary grid
		const summaryGrid = container.createDiv({ cls: 'cr-media-linker__summary-grid' });

		const createSummaryItem = (label: string, value: string) => {
			const item = summaryGrid.createDiv({ cls: 'cr-media-linker__summary-item' });
			item.createDiv({ cls: 'cr-media-linker__summary-label', text: label });
			item.createDiv({ cls: 'cr-media-linker__summary-value', text: value });
		};

		createSummaryItem('Images to link', String(linkedFiles.length));
		createSummaryItem('Sources to update', String(new Set(linkedFiles.map((f) => f.linkedSource!.crId)).size));

		// Preview list
		container.createDiv({ cls: 'cr-media-linker__section-header', text: 'Changes to be made' });

		const previewList = container.createDiv({ cls: 'cr-media-linker__review-list' });

		for (const info of linkedFiles) {
			const item = previewList.createDiv({ cls: 'cr-media-linker__review-item' });

			// Image name
			const imageEl = item.createDiv({ cls: 'cr-media-linker__review-image' });
			const imageIcon = createLucideIcon('image', 14);
			imageEl.appendChild(imageIcon);
			imageEl.createEl('code', { text: info.file.name });

			// Arrow
			item.createSpan({ text: '→', cls: 'cr-media-linker__review-arrow' });

			// Source name
			const sourceEl = item.createDiv({ cls: 'cr-media-linker__review-source' });
			const fileIcon = createLucideIcon('file-text', 14);
			sourceEl.appendChild(fileIcon);
			sourceEl.createSpan({ text: info.linkedSource!.title });
		}
	}

	/**
	 * Step 4: Execute Linking
	 */
	private renderExecuteStep(container: HTMLElement): void {
		container.createDiv({
			cls: 'cr-media-linker__step-header',
			text: this.isExecuting ? 'Linking...' : 'Linking complete',
		});

		if (this.isExecuting) {
			// Progress bar
			const progressContainer = container.createDiv({ cls: 'cr-media-linker__progress-container' });
			const progressBar = progressContainer.createDiv({ cls: 'cr-media-linker__progress-bar' });
			const progressFill = progressBar.createDiv({ cls: 'cr-media-linker__progress-fill' });
			progressFill.style.width = `${this.executionProgress}%`;

			const progressText = progressContainer.createDiv({ cls: 'cr-media-linker__progress-text' });
			progressText.createSpan({ text: `${Math.round(this.executionProgress)}%` });

			return;
		}

		// Results summary
		const successCount = this.executionResults.filter((r) => r.success).length;
		const failCount = this.executionResults.filter((r) => !r.success).length;

		const resultsGrid = container.createDiv({ cls: 'cr-media-linker__results-grid' });

		const createResultCard = (value: string, label: string) => {
			const card = resultsGrid.createDiv({ cls: 'cr-media-linker__result-card' });
			card.createDiv({ cls: 'cr-media-linker__result-value', text: value });
			card.createDiv({ cls: 'cr-media-linker__result-label', text: label });
		};

		createResultCard(String(successCount), 'Images linked');
		if (failCount > 0) {
			createResultCard(String(failCount), 'Failed');
		}

		// Status log
		const logContainer = container.createDiv({ cls: 'cr-media-linker__log' });

		for (const result of this.executionResults) {
			const logItem = logContainer.createDiv({
				cls: `cr-media-linker__log-item ${result.success ? 'cr-media-linker__log-item--success' : 'cr-media-linker__log-item--error'}`,
			});

			if (result.success) {
				logItem.createSpan({ text: `✓ Linked: ${result.mediaPath} → ${result.sourcePath}` });
			} else {
				logItem.createSpan({ text: `✗ Failed: ${result.error}` });
			}
		}
	}

	/**
	 * Render navigation buttons
	 */
	private renderNavigationButtons(): void {
		const { contentEl } = this;
		const buttonsEl = contentEl.createDiv({ cls: 'cr-media-linker__buttons' });

		// Done button on execute step (completed)
		if (this.currentStep === 'execute' && !this.isExecuting) {
			const doneBtn = buttonsEl.createEl('button', {
				text: 'Done',
				cls: 'mod-cta',
			});
			doneBtn.addEventListener('click', () => this.close());
			return;
		}

		// Cancel button
		const cancelBtn = buttonsEl.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		// Back button (not on first step or during execution)
		if (this.currentStep !== 'select' && !this.isExecuting) {
			const backBtn = buttonsEl.createEl('button', { text: 'Back' });
			backBtn.addEventListener('click', () => this.goBack());
		}

		// Next/Start button
		if (this.currentStep === 'review') {
			const startBtn = buttonsEl.createEl('button', {
				text: 'Link media',
				cls: 'mod-cta',
			});
			startBtn.disabled = !this.canProceed();
			startBtn.addEventListener('click', () => void this.executeLinking());
		} else if (this.currentStep !== 'execute') {
			const nextBtn = buttonsEl.createEl('button', {
				text: 'Next',
				cls: 'mod-cta',
			});
			nextBtn.disabled = !this.canProceed();
			nextBtn.addEventListener('click', () => this.goNext());
		}
	}

	/**
	 * Check if we can proceed to the next step
	 */
	private canProceed(): boolean {
		switch (this.currentStep) {
			case 'select':
				return this.filteredFiles.length > 0 && this.sourcesWithoutMedia.length > 0;
			case 'link':
				// At least one file must be linked
				return this.filteredFiles.some((f) => f.linkedSource !== null);
			case 'review':
				return this.filteredFiles.some((f) => f.linkedSource !== null);
			default:
				return false;
		}
	}

	/**
	 * Go to next step
	 */
	private goNext(): void {
		const steps: WizardStep[] = ['select', 'link', 'review', 'execute'];
		const currentIndex = steps.indexOf(this.currentStep);
		if (currentIndex < steps.length - 1) {
			this.currentStep = steps[currentIndex + 1];
			this.render();
		}
	}

	/**
	 * Go back to previous step
	 */
	private goBack(): void {
		const steps: WizardStep[] = ['select', 'link', 'review', 'execute'];
		const currentIndex = steps.indexOf(this.currentStep);
		if (currentIndex > 0) {
			this.currentStep = steps[currentIndex - 1];
			this.render();
		}
	}

	/**
	 * Execute the linking process
	 */
	private async executeLinking(): Promise<void> {
		this.isExecuting = true;
		this.executionResults = [];
		this.executionProgress = 0;
		this.currentStep = 'execute';
		this.render();

		try {
			const linkedFiles = this.filteredFiles.filter((f) => f.linkedSource !== null);
			const total = linkedFiles.length;

			for (let i = 0; i < linkedFiles.length; i++) {
				const info = linkedFiles[i];
				try {
					await this.linkMediaToSource(info);
					this.executionResults.push({
						success: true,
						mediaPath: info.file.name,
						sourcePath: info.linkedSource!.title,
					});
				} catch (error) {
					this.executionResults.push({
						success: false,
						mediaPath: info.file.name,
						error: error instanceof Error ? error.message : String(error),
					});
				}

				this.executionProgress = ((i + 1) / total) * 100;
				this.render();
			}
		} catch (error) {
			new Notice(`Linking failed: ${error instanceof Error ? error.message : String(error)}`);
		}

		this.isExecuting = false;
		this.render();
	}

	/**
	 * Link a single media file to a source
	 */
	private async linkMediaToSource(info: MediaFileInfo): Promise<void> {
		if (!info.linkedSource) return;

		const sourceFile = this.app.vault.getAbstractFileByPath(info.linkedSource.filePath);
		if (!(sourceFile instanceof TFile)) {
			throw new Error(`Source file not found: ${info.linkedSource.filePath}`);
		}

		// Build wikilink to media file
		const mediaWikilink = `[[${info.file.path}]]`;

		// Update the source file's frontmatter
		await this.app.fileManager.processFrontMatter(sourceFile, (frontmatter) => {
			// Find the next available media slot
			if (!frontmatter.media) {
				frontmatter.media = mediaWikilink;
			} else {
				// Find next available media_N slot
				let slot = 2;
				while (frontmatter[`media_${slot}`]) {
					slot++;
				}
				frontmatter[`media_${slot}`] = mediaWikilink;
			}
		});

		// Invalidate source cache
		this.sourceService.invalidateCache();
	}
}
