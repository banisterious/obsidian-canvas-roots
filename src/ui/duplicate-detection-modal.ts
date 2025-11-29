/**
 * Duplicate Detection Modal
 *
 * Displays potential duplicate person records and allows users
 * to review and manage them.
 */

import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import {
	DuplicateDetectionService,
	DuplicateMatch,
	DuplicateDetectionOptions
} from '../core/duplicate-detection';
import { getLogger } from '../core/logging';

const logger = getLogger('DuplicateModal');

/**
 * Modal for viewing and managing duplicate detections
 */
export class DuplicateDetectionModal extends Modal {
	private matches: DuplicateMatch[] = [];
	private options: DuplicateDetectionOptions = {};
	private service: DuplicateDetectionService;
	private resultsContainer: HTMLElement | null = null;

	constructor(app: App) {
		super(app);
		this.service = new DuplicateDetectionService(app);
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText('Duplicate detection');
		contentEl.empty();
		contentEl.addClass('cr-duplicate-modal');

		// Options section
		this.buildOptionsSection(contentEl);

		// Results container (will be populated after scan)
		this.resultsContainer = contentEl.createDiv({ cls: 'cr-duplicate-results' });

		// Initial empty state
		this.showEmptyState();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	/**
	 * Build the options/settings section
	 */
	private buildOptionsSection(container: HTMLElement): void {
		const optionsSection = container.createDiv({ cls: 'cr-duplicate-options' });

		// Minimum confidence threshold
		new Setting(optionsSection)
			.setName('Minimum confidence')
			.setDesc('Only show matches above this confidence level (0-100)')
			.addSlider(slider => slider
				.setLimits(40, 90, 5)
				.setValue(60)
				.setDynamicTooltip()
				.onChange(value => {
					this.options.minConfidence = value;
				})
			);

		// Minimum name similarity
		new Setting(optionsSection)
			.setName('Minimum name similarity')
			.setDesc('Required name match percentage (0-100)')
			.addSlider(slider => slider
				.setLimits(50, 95, 5)
				.setValue(70)
				.setDynamicTooltip()
				.onChange(value => {
					this.options.minNameSimilarity = value;
				})
			);

		// Max year difference
		new Setting(optionsSection)
			.setName('Maximum year difference')
			.setDesc('How many years apart dates can be to still match')
			.addSlider(slider => slider
				.setLimits(1, 20, 1)
				.setValue(5)
				.setDynamicTooltip()
				.onChange(value => {
					this.options.maxYearDifference = value;
				})
			);

		// Same collection only toggle
		new Setting(optionsSection)
			.setName('Same collection only')
			.setDesc('Only compare people within the same collection')
			.addToggle(toggle => toggle
				.setValue(false)
				.onChange(value => {
					this.options.sameCollectionOnly = value;
				})
			);

		// Scan button
		const buttonContainer = optionsSection.createDiv({ cls: 'cr-duplicate-button-container' });
		const scanBtn = buttonContainer.createEl('button', {
			cls: 'mod-cta',
			text: 'Scan for duplicates'
		});
		scanBtn.addEventListener('click', () => {
			void this.runScan();
		});
	}

	/**
	 * Show empty state before scan
	 */
	private showEmptyState(): void {
		if (!this.resultsContainer) return;
		this.resultsContainer.empty();

		const emptyState = this.resultsContainer.createDiv({ cls: 'cr-duplicate-empty' });
		emptyState.createEl('p', {
			text: 'Configure options above and click "Scan for duplicates" to find potential duplicate person records.',
			cls: 'setting-item-description'
		});
	}

	/**
	 * Run the duplicate detection scan
	 */
	private async runScan(): Promise<void> {
		if (!this.resultsContainer) return;

		// Show loading state
		this.resultsContainer.empty();
		const loadingEl = this.resultsContainer.createDiv({ cls: 'cr-duplicate-loading' });
		loadingEl.createEl('p', { text: 'Scanning for duplicates...' });

		// Run detection (use setTimeout to allow UI to update)
		await new Promise(resolve => setTimeout(resolve, 50));

		try {
			this.matches = this.service.findDuplicates(this.options);
			this.displayResults();
		} catch (error) {
			logger.error('scan', 'Duplicate scan failed', error);
			this.resultsContainer.empty();
			this.resultsContainer.createEl('p', {
				text: `Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				cls: 'cr-error-text'
			});
		}
	}

	/**
	 * Display scan results
	 */
	private displayResults(): void {
		if (!this.resultsContainer) return;
		this.resultsContainer.empty();

		// Summary
		const summary = this.service.getSummary(this.matches);
		const summaryEl = this.resultsContainer.createDiv({ cls: 'cr-duplicate-summary' });

		if (this.matches.length === 0) {
			summaryEl.createEl('p', {
				text: 'No potential duplicates found. Your data appears to be clean!',
				cls: 'cr-success-text'
			});
			return;
		}

		summaryEl.createEl('h4', { text: `Found ${summary.totalMatches} potential duplicate(s)` });

		const statsEl = summaryEl.createDiv({ cls: 'cr-duplicate-stats' });
		if (summary.highConfidence > 0) {
			statsEl.createSpan({
				text: `${summary.highConfidence} high confidence`,
				cls: 'cr-badge cr-badge--danger'
			});
		}
		if (summary.mediumConfidence > 0) {
			statsEl.createSpan({
				text: `${summary.mediumConfidence} medium confidence`,
				cls: 'cr-badge cr-badge--warning'
			});
		}
		if (summary.lowConfidence > 0) {
			statsEl.createSpan({
				text: `${summary.lowConfidence} low confidence`,
				cls: 'cr-badge cr-badge--info'
			});
		}

		// Match list
		const listEl = this.resultsContainer.createDiv({ cls: 'cr-duplicate-list' });

		for (const match of this.matches) {
			this.renderMatchItem(listEl, match);
		}
	}

	/**
	 * Render a single match item
	 */
	private renderMatchItem(container: HTMLElement, match: DuplicateMatch): void {
		const itemEl = container.createDiv({ cls: 'cr-duplicate-item' });

		// Confidence badge
		const confidenceClass = match.confidence >= 80 ? 'cr-badge--danger' :
			match.confidence >= 60 ? 'cr-badge--warning' : 'cr-badge--info';

		const headerEl = itemEl.createDiv({ cls: 'cr-duplicate-item-header' });
		headerEl.createSpan({
			text: `${match.confidence}% confidence`,
			cls: `cr-badge ${confidenceClass}`
		});

		// People comparison
		const comparisonEl = itemEl.createDiv({ cls: 'cr-duplicate-comparison' });

		// Person 1
		const person1El = comparisonEl.createDiv({ cls: 'cr-duplicate-person' });
		person1El.createEl('strong', { text: match.person1.name || 'Unknown' });
		if (match.person1.birthDate || match.person1.deathDate) {
			const datesEl = person1El.createEl('small', { cls: 'cr-text-muted' });
			const dates: string[] = [];
			if (match.person1.birthDate) dates.push(`b. ${match.person1.birthDate}`);
			if (match.person1.deathDate) dates.push(`d. ${match.person1.deathDate}`);
			datesEl.textContent = ` (${dates.join(', ')})`;
		}
		const file1Btn = person1El.createEl('button', {
			cls: 'cr-btn-link',
			text: 'Open note'
		});
		file1Btn.addEventListener('click', () => {
			void this.openPersonNote(match.person1.file);
		});

		// VS separator
		comparisonEl.createSpan({ text: 'vs', cls: 'cr-duplicate-vs' });

		// Person 2
		const person2El = comparisonEl.createDiv({ cls: 'cr-duplicate-person' });
		person2El.createEl('strong', { text: match.person2.name || 'Unknown' });
		if (match.person2.birthDate || match.person2.deathDate) {
			const datesEl = person2El.createEl('small', { cls: 'cr-text-muted' });
			const dates: string[] = [];
			if (match.person2.birthDate) dates.push(`b. ${match.person2.birthDate}`);
			if (match.person2.deathDate) dates.push(`d. ${match.person2.deathDate}`);
			datesEl.textContent = ` (${dates.join(', ')})`;
		}
		const file2Btn = person2El.createEl('button', {
			cls: 'cr-btn-link',
			text: 'Open note'
		});
		file2Btn.addEventListener('click', () => {
			void this.openPersonNote(match.person2.file);
		});

		// Match details
		const detailsEl = itemEl.createDiv({ cls: 'cr-duplicate-details' });
		detailsEl.createEl('small', {
			text: `Name similarity: ${match.nameSimilarity}% | Date proximity: ${match.dateProximity}%`,
			cls: 'cr-text-muted'
		});

		// Reasons
		if (match.reasons.length > 0) {
			const reasonsEl = itemEl.createDiv({ cls: 'cr-duplicate-reasons' });
			reasonsEl.createEl('small', {
				text: match.reasons.join(' • '),
				cls: 'cr-text-muted'
			});
		}

		// Actions
		const actionsEl = itemEl.createDiv({ cls: 'cr-duplicate-actions' });
		const dismissBtn = actionsEl.createEl('button', {
			cls: 'cr-btn-secondary',
			text: 'Not a duplicate'
		});
		dismissBtn.addEventListener('click', () => {
			itemEl.remove();
			this.matches = this.matches.filter(m => m !== match);
			new Notice('Match dismissed');
		});
	}

	/**
	 * Open a person note in the editor
	 */
	private async openPersonNote(file: TFile): Promise<void> {
		await this.app.workspace.getLeaf(false).openFile(file);
	}
}
