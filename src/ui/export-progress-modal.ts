import { App, Modal } from 'obsidian';
import { createLucideIcon, LucideIconName } from './lucide-icons';

/**
 * Export progress phases
 */
export type ExportPhase =
	| 'loading'
	| 'filtering'
	| 'privacy'
	| 'events'
	| 'sources'
	| 'places'
	| 'generating'
	| 'writing'
	| 'complete';

/**
 * Progress state for export operations
 */
export interface ExportProgress {
	phase: ExportPhase;
	current: number;
	total: number;
	message?: string;
}

/**
 * Phase display configuration
 */
const PHASE_CONFIG: Record<ExportPhase, { label: string; icon: LucideIconName }> = {
	loading: { label: 'Loading data', icon: 'folder' },
	filtering: { label: 'Filtering records', icon: 'search' },
	privacy: { label: 'Applying privacy settings', icon: 'shield' },
	events: { label: 'Loading events', icon: 'calendar' },
	sources: { label: 'Loading sources', icon: 'book-open' },
	places: { label: 'Loading places', icon: 'map-pin' },
	generating: { label: 'Generating export', icon: 'file-code' },
	writing: { label: 'Saving file', icon: 'download' },
	complete: { label: 'Complete', icon: 'check' }
};

/**
 * Modal to display export progress
 */
export class ExportProgressModal extends Modal {
	private progressBar: HTMLElement | null = null;
	private progressText: HTMLElement | null = null;
	private phaseLabel: HTMLElement | null = null;
	private phaseIcon: HTMLElement | null = null;
	private statsContainer: HTMLElement | null = null;
	private currentPhase: ExportPhase = 'loading';
	private formatName: string;

	// Running totals for stats display
	private stats = {
		people: 0,
		events: 0,
		sources: 0,
		places: 0,
		relationships: 0
	};

	constructor(app: App, formatName: string) {
		super(app);
		this.formatName = formatName;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class and prevent closing by clicking outside
		this.modalEl.addClass('cr-export-progress-modal');

		// Title
		contentEl.createEl('h2', {
			text: `Exporting ${this.formatName}`,
			cls: 'crc-modal-title'
		});

		// Phase indicator
		const phaseContainer = contentEl.createDiv({ cls: 'cr-export-phase' });
		this.phaseIcon = phaseContainer.createDiv({ cls: 'cr-export-phase__icon' });
		this.phaseLabel = phaseContainer.createEl('span', {
			cls: 'cr-export-phase__label',
			text: 'Loading data…'
		});

		// Progress bar container
		const progressContainer = contentEl.createDiv({ cls: 'cr-export-progress' });
		const progressTrack = progressContainer.createDiv({ cls: 'cr-export-progress__track' });
		this.progressBar = progressTrack.createDiv({ cls: 'cr-export-progress__bar' });
		this.progressBar.style.width = '0%';

		// Progress text
		this.progressText = contentEl.createDiv({
			cls: 'cr-export-progress__text',
			text: 'Starting…'
		});

		// Stats container (shows running totals)
		this.statsContainer = contentEl.createDiv({ cls: 'cr-export-running-stats' });
		this.updateStatsDisplay();

		// Update icon for initial phase
		this.updatePhaseIcon('loading');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Update the progress display
	 */
	updateProgress(progress: ExportProgress): void {
		if (!this.progressBar || !this.progressText || !this.phaseLabel) return;

		// Update phase if changed
		if (progress.phase !== this.currentPhase) {
			this.currentPhase = progress.phase;
			const config = PHASE_CONFIG[progress.phase];
			this.phaseLabel.textContent = config.label + '…';
			this.updatePhaseIcon(progress.phase);
		}

		// Update progress bar
		const percentage = progress.total > 0
			? Math.round((progress.current / progress.total) * 100)
			: 0;
		this.progressBar.style.width = `${percentage}%`;

		// Update progress text
		if (progress.message) {
			this.progressText.textContent = progress.message;
		} else if (progress.total > 0) {
			this.progressText.textContent = `${progress.current} of ${progress.total}`;
		} else {
			this.progressText.textContent = 'Processing…';
		}
	}

	/**
	 * Update running statistics
	 */
	updateStats(stats: Partial<typeof this.stats>): void {
		Object.assign(this.stats, stats);
		this.updateStatsDisplay();
	}

	/**
	 * Mark export as complete
	 */
	markComplete(): void {
		if (!this.progressBar || !this.progressText || !this.phaseLabel) return;

		this.currentPhase = 'complete';
		this.phaseLabel.textContent = 'Export complete';
		this.updatePhaseIcon('complete');
		this.progressBar.style.width = '100%';
		this.progressText.textContent = 'Done!';
	}

	/**
	 * Update the phase icon
	 */
	private updatePhaseIcon(phase: ExportPhase): void {
		if (!this.phaseIcon) return;

		this.phaseIcon.empty();
		const config = PHASE_CONFIG[phase];
		const icon = createLucideIcon(config.icon, 24);
		if (phase === 'complete') {
			icon.addClass('cr-icon--success');
		}
		this.phaseIcon.appendChild(icon);
	}

	/**
	 * Update the stats display
	 */
	private updateStatsDisplay(): void {
		if (!this.statsContainer) return;

		this.statsContainer.empty();

		const items: { label: string; value: number; icon: LucideIconName }[] = [];

		if (this.stats.people > 0) {
			items.push({ label: 'People', value: this.stats.people, icon: 'users' });
		}
		if (this.stats.events > 0) {
			items.push({ label: 'Events', value: this.stats.events, icon: 'calendar' });
		}
		if (this.stats.sources > 0) {
			items.push({ label: 'Sources', value: this.stats.sources, icon: 'book-open' });
		}
		if (this.stats.places > 0) {
			items.push({ label: 'Places', value: this.stats.places, icon: 'map-pin' });
		}
		if (this.stats.relationships > 0) {
			items.push({ label: 'Relationships', value: this.stats.relationships, icon: 'git-branch' });
		}

		for (const item of items) {
			const statEl = this.statsContainer.createDiv({ cls: 'cr-export-stat' });
			const icon = createLucideIcon(item.icon, 16);
			statEl.appendChild(icon);
			statEl.createEl('span', { text: `${item.value} ${item.label.toLowerCase()}` });
		}
	}
}
