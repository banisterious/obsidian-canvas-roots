/**
 * Post-Import Cleanup Wizard Modal
 *
 * A 14-step wizard for post-import data cleanup operations.
 *
 * Step 1: Quality Report — Review data quality issues (review-only)
 * Step 2: Bidirectional Relationships — Fix parent-child link consistency (batch)
 * Step 3: Date Formats — Normalize dates to ISO 8601 (batch)
 * Step 4: Gender Values — Normalize gender/sex values (batch)
 * Step 5: Orphan References — Clear dangling links (batch)
 * Step 6: Source Migration — Convert indexed sources to array format (batch)
 * Step 7: Place Variants — Standardize place name variants (interactive)
 * Step 8: Bulk Geocode — Add coordinates to places (interactive)
 * Step 9: Place Hierarchy — Build containment chains (interactive)
 * Step 10: Flatten Properties — Fix nested frontmatter (batch)
 * Step 11: Event Person Migration — Convert person to persons array (batch)
 * Step 12: Evidence Tracking Migration — Convert sourced_facts to flat properties (batch)
 * Step 13: Life Events Migration — Convert inline events to event notes (batch)
 * Step 14: Normalize Children Property — Rename child to children (batch)
 */

import { App, Modal, Notice, setIcon, TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../main';
import {
	DataQualityService,
	type BatchOperationResult,
	type DataQualityReport,
	type DataQualityIssue,
	type IssueCategory,
	type BidirectionalInconsistency
} from '../core/data-quality';
import { FolderFilterService } from '../core/folder-filter';
import { getLogger } from '../core/logging';
import type { CleanupWizardPersistedState } from '../settings';
import { findPlaceNameVariants, findDuplicatePlaceNotes, mergeDuplicatePlaces, type PlaceVariantMatch, type PlaceDuplicateGroup } from './standardize-place-variants-modal';
import { GeocodingService, type GeocodingResult } from '../maps/services/geocoding-service';
import { PlaceGraphService } from '../core/place-graph';
import { createPlaceNote, updatePlaceNote, type PlaceData } from '../core/place-note-writer';
import type { PlaceNode, PlaceType } from '../models/place';
import { SourceMigrationService, type IndexedSourceNote } from '../sources/services/source-migration-service';
import { EventPersonMigrationService, type LegacyPersonEventNote } from '../events/services/event-person-migration-service';
import { SourcedFactsMigrationService, type LegacySourcedFactsNote } from '../sources/services/sourced-facts-migration-service';
import { LifeEventsMigrationService, type LegacyEventsNote } from '../events/services/life-events-migration-service';

const logger = getLogger('CleanupWizard');

/** Maximum age of persisted state before it's considered stale (24 hours) */
const STATE_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Wizard step types
 */
export type StepType = 'review' | 'batch' | 'interactive';

/**
 * Step status
 */
export type StepStatus = 'pending' | 'in_progress' | 'complete' | 'skipped';

/**
 * Wizard step configuration
 */
interface WizardStepConfig {
	id: string;
	number: number;
	title: string;
	shortTitle: string;
	description: string;
	type: StepType;
	service: string;
	detectMethod?: string;
	previewMethod?: string;
	applyMethod?: string;
	dependencies: number[];
}

/**
 * Step state
 */
interface StepState {
	status: StepStatus;
	issueCount: number;
	fixCount: number;
	skippedReason?: string;
}

/**
 * Wizard state
 */
interface CleanupWizardState {
	currentStep: number;
	steps: Record<number, StepState>;
	startTime: number;
	isPreScanning: boolean;
	preScanComplete: boolean;
}

/**
 * Result of hierarchy enrichment for a single place
 */
interface HierarchyEnrichmentResult {
	placeName: string;
	success: boolean;
	/** Parsed hierarchy components from geocoding */
	hierarchy?: string[];
	/** Parent places created */
	parentsCreated?: string[];
	/** Parent place linked to */
	parentLinked?: string;
	/** Error message if failed */
	error?: string;
	/** Whether place was skipped (already has parent) */
	skipped?: boolean;
}

/**
 * Known place type mappings from OSM/Nominatim address components
 */
const OSM_TYPE_MAP: Record<string, PlaceType> = {
	country: 'country',
	state: 'state',
	province: 'province',
	region: 'region',
	county: 'county',
	city: 'city',
	town: 'town',
	village: 'village',
	municipality: 'city',
	district: 'district',
	suburb: 'district',
	neighbourhood: 'district',
	hamlet: 'village'
};

/**
 * Wizard step definitions
 */
const WIZARD_STEPS: WizardStepConfig[] = [
	{
		id: 'quality-report',
		number: 1,
		title: 'Quality Report',
		shortTitle: 'Quality Report',
		description: 'Review data quality issues identified in your vault.',
		type: 'review',
		service: 'DataQualityService',
		detectMethod: 'getIssuesSummary',
		dependencies: []
	},
	{
		id: 'bidirectional',
		number: 2,
		title: 'Fix Bidirectional Relationships',
		shortTitle: 'Bidir Rels',
		description: 'Ensure parent-child relationships are properly linked in both directions.',
		type: 'batch',
		service: 'DataQualityService',
		detectMethod: 'detectBidirectionalIssues',
		applyMethod: 'fixBidirectionalInconsistencies',
		dependencies: [1]
	},
	{
		id: 'date-normalize',
		number: 3,
		title: 'Normalize Date Formats',
		shortTitle: 'Dates',
		description: 'Convert non-standard date formats to ISO 8601 (YYYY-MM-DD).',
		type: 'batch',
		service: 'DataQualityService',
		detectMethod: 'detectDateIssues',
		applyMethod: 'normalizeDateFormats',
		dependencies: [2]
	},
	{
		id: 'gender-normalize',
		number: 4,
		title: 'Normalize Gender Values',
		shortTitle: 'Gender',
		description: 'Standardize gender/sex values to consistent format.',
		type: 'batch',
		service: 'DataQualityService',
		detectMethod: 'detectGenderIssues',
		applyMethod: 'normalizeGenderValues',
		dependencies: [2]
	},
	{
		id: 'orphan-clear',
		number: 5,
		title: 'Clear Orphan References',
		shortTitle: 'Orphans',
		description: 'Remove dangling links to non-existent notes.',
		type: 'batch',
		service: 'DataQualityService',
		detectMethod: 'detectOrphanReferences',
		applyMethod: 'clearOrphanReferences',
		dependencies: [2]
	},
	{
		id: 'source-migrate',
		number: 6,
		title: 'Migrate Source Properties',
		shortTitle: 'Sources',
		description: 'Convert indexed source properties (source_2, source_3) to array format.',
		type: 'batch',
		service: 'SourceMigrationService',
		detectMethod: 'detectIndexedSources',
		applyMethod: 'migrateToArrayFormat',
		dependencies: [5]
	},
	{
		id: 'place-variants',
		number: 7,
		title: 'Standardize Place Variants',
		shortTitle: 'Place Names',
		description: 'Choose canonical names for places with multiple variants.',
		type: 'interactive',
		service: 'PlaceGraphService',
		detectMethod: 'detectPlaceVariants',
		applyMethod: 'standardizeVariant',
		dependencies: []
	},
	{
		id: 'geocode',
		number: 8,
		title: 'Bulk Geocode',
		shortTitle: 'Geocode',
		description: 'Add geographic coordinates to place notes.',
		type: 'interactive',
		service: 'GeocodingService',
		detectMethod: 'detectUngeocoded',
		applyMethod: 'geocodePlace',
		dependencies: [7]
	},
	{
		id: 'place-hierarchy',
		number: 9,
		title: 'Enrich Place Hierarchy',
		shortTitle: 'Hierarchy',
		description: 'Build containment chains (city → county → state → country).',
		type: 'interactive',
		service: 'PlaceGraphService',
		detectMethod: 'detectMissingHierarchy',
		applyMethod: 'enrichHierarchy',
		dependencies: [8]
	},
	{
		id: 'flatten-props',
		number: 10,
		title: 'Flatten Nested Properties',
		shortTitle: 'Flatten',
		description: 'Convert nested YAML objects to flat property format.',
		type: 'batch',
		service: 'DataQualityService',
		detectMethod: 'detectNestedProperties',
		applyMethod: 'flattenProperties',
		dependencies: []
	},
	{
		id: 'event-person-migrate',
		number: 11,
		title: 'Migrate Event Person Properties',
		shortTitle: 'Event Persons',
		description: 'Convert singular person property to persons array format.',
		type: 'batch',
		service: 'EventPersonMigrationService',
		detectMethod: 'detectLegacyPersonProperty',
		applyMethod: 'migrateToArrayFormat',
		dependencies: [6]
	},
	{
		id: 'sourced-facts-migrate',
		number: 12,
		title: 'Migrate Evidence Tracking',
		shortTitle: 'Evidence',
		description: 'Convert nested sourced_facts to flat sourced_* properties.',
		type: 'batch',
		service: 'SourcedFactsMigrationService',
		detectMethod: 'detectLegacySourcedFacts',
		applyMethod: 'migrateToFlatFormat',
		dependencies: []
	},
	{
		id: 'life-events-migrate',
		number: 13,
		title: 'Migrate Life Events',
		shortTitle: 'Life Events',
		description: 'Convert inline events arrays to separate event note files.',
		type: 'batch',
		service: 'LifeEventsMigrationService',
		detectMethod: 'detectInlineEvents',
		applyMethod: 'migrateToEventNotes',
		dependencies: []
	},
	{
		id: 'child-to-children',
		number: 14,
		title: 'Normalize Children Property',
		shortTitle: 'Children',
		description: 'Rename legacy "child" property to "children" for consistency.',
		type: 'batch',
		service: 'inline', // No external service needed
		detectMethod: 'detectLegacyChildProperty',
		applyMethod: 'migrateChildToChildren',
		dependencies: []
	}
];

/**
 * Cleanup Wizard Modal
 */
export class CleanupWizardModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private state: CleanupWizardState;
	private contentContainer: HTMLElement | null = null;
	private footerContainer: HTMLElement | null = null;
	private progressContainer: HTMLElement | null = null;
	private dataQualityService: DataQualityService | null = null;

	// View state
	private currentView: 'overview' | 'step' | 'summary' = 'overview';

	// Cached analysis results
	private qualityReport: DataQualityReport | null = null;
	private bidirectionalIssues: BidirectionalInconsistency[] = [];
	private placeVariantMatches: PlaceVariantMatch[] = [];
	private placeDuplicateGroups: PlaceDuplicateGroup[] = [];
	private showDeduplicationStep = false;

	// Geocoding state
	private ungeocodedPlaces: PlaceNode[] = [];
	private geocodingService: GeocodingService | null = null;
	private isGeocoding = false;
	private geocodingCancelled = false;
	private geocodingResults: GeocodingResult[] = [];

	// Hierarchy enrichment state
	private placesWithoutParent: PlaceNode[] = [];
	private isEnrichingHierarchy = false;
	private hierarchyEnrichmentCancelled = false;
	private hierarchyEnrichmentResults: HierarchyEnrichmentResult[] = [];
	private hierarchyCreateMissingParents = true;
	private hierarchyPlacesDirectory = '';

	// Source migration state
	private sourceMigrationService: SourceMigrationService | null = null;
	private indexedSourceNotes: IndexedSourceNote[] = [];

	// Event person migration state
	private eventPersonMigrationService: EventPersonMigrationService | null = null;
	private legacyPersonEventNotes: LegacyPersonEventNote[] = [];

	// Sourced facts migration state
	private sourcedFactsMigrationService: SourcedFactsMigrationService | null = null;
	private legacySourcedFactsNotes: LegacySourcedFactsNote[] = [];

	// Life events migration state
	private lifeEventsMigrationService: LifeEventsMigrationService | null = null;
	private legacyEventsNotes: LegacyEventsNote[] = [];

	// Child→children migration state (Step 14)
	private legacyChildNotes: TFile[] = [];

	// Step completion tracking for dependency checks
	private stepCompletion: Record<string, { completed: boolean; completedAt: number; issuesFixed: number }> = {};

	// Batch operation progress state
	private batchProgress: { current: number; total: number; currentFile?: string } | null = null;

	// Keyboard navigation state
	private focusedTileIndex = 0;
	private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

	constructor(app: App, plugin: CanvasRootsPlugin) {
		super(app);
		this.plugin = plugin;
		this.state = this.getDefaultState();
	}

	/**
	 * Initialize the DataQualityService (lazy initialization)
	 */
	private getDataQualityService(): DataQualityService {
		if (!this.dataQualityService) {
			const familyGraph = this.plugin.createFamilyGraphService();
			familyGraph.ensureCacheLoaded();
			const folderFilter = new FolderFilterService(this.plugin.settings);
			this.dataQualityService = new DataQualityService(
				this.app,
				this.plugin.settings,
				familyGraph,
				folderFilter,
				this.plugin
			);
		}
		return this.dataQualityService;
	}

	/**
	 * Initialize the GeocodingService (lazy initialization)
	 */
	private getGeocodingService(): GeocodingService {
		if (!this.geocodingService) {
			this.geocodingService = new GeocodingService(this.app);
		}
		return this.geocodingService;
	}

	/**
	 * Initialize the SourceMigrationService (lazy initialization)
	 */
	private getSourceMigrationService(): SourceMigrationService {
		if (!this.sourceMigrationService) {
			this.sourceMigrationService = new SourceMigrationService(this.app, this.plugin.settings);
		}
		return this.sourceMigrationService;
	}

	/**
	 * Initialize the EventPersonMigrationService (lazy initialization)
	 */
	private getEventPersonMigrationService(): EventPersonMigrationService {
		if (!this.eventPersonMigrationService) {
			this.eventPersonMigrationService = new EventPersonMigrationService(this.app, this.plugin.settings);
		}
		return this.eventPersonMigrationService;
	}

	/**
	 * Initialize the SourcedFactsMigrationService (lazy initialization)
	 */
	private getSourcedFactsMigrationService(): SourcedFactsMigrationService {
		if (!this.sourcedFactsMigrationService) {
			this.sourcedFactsMigrationService = new SourcedFactsMigrationService(this.app, this.plugin.settings);
		}
		return this.sourcedFactsMigrationService;
	}

	/**
	 * Initialize the LifeEventsMigrationService (lazy initialization)
	 */
	private getLifeEventsMigrationService(): LifeEventsMigrationService {
		if (!this.lifeEventsMigrationService) {
			this.lifeEventsMigrationService = new LifeEventsMigrationService(this.app, this.plugin.settings);
		}
		return this.lifeEventsMigrationService;
	}

	/**
	 * Get default wizard state
	 */
	private getDefaultState(): CleanupWizardState {
		const steps: Record<number, StepState> = {};
		for (const step of WIZARD_STEPS) {
			steps[step.number] = {
				status: 'pending',
				issueCount: 0,
				fixCount: 0
			};
		}

		return {
			currentStep: 0,
			steps,
			startTime: Date.now(),
			isPreScanning: false,
			preScanComplete: false
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('crc-cleanup-wizard');

		// Check for persisted state and offer to resume
		const persistedState = this.getPersistedState();
		if (persistedState) {
			this.showResumePrompt(contentEl, persistedState);
			return;
		}

		this.initializeWizardUI(contentEl);
	}

	/**
	 * Initialize the wizard UI (called on fresh start or after resume decision)
	 */
	private initializeWizardUI(contentEl: HTMLElement): void {
		// Modal header with icon and title
		const header = contentEl.createDiv({ cls: 'crc-cleanup-wizard-header' });

		const titleRow = header.createDiv({ cls: 'crc-wizard-title' });
		const iconEl = titleRow.createDiv({ cls: 'crc-wizard-title-icon' });
		setIcon(iconEl, 'sparkles');
		titleRow.createSpan({ text: 'Post-Import Cleanup Wizard' });

		// Progress container (used in step view)
		this.progressContainer = contentEl.createDiv({ cls: 'crc-wizard-progress crc-cleanup-wizard-progress crc-hidden' });

		// Content container
		this.contentContainer = contentEl.createDiv({ cls: 'crc-cleanup-wizard-content' });

		// Footer container
		this.footerContainer = contentEl.createDiv({ cls: 'crc-cleanup-wizard-footer' });

		// Setup keyboard navigation
		this.setupKeyboardNavigation();

		// Start pre-scan and render
		this.renderCurrentView();
	}

	/**
	 * Show a prompt to resume or start fresh
	 */
	private showResumePrompt(contentEl: HTMLElement, persistedState: CleanupWizardPersistedState): void {
		// Header
		const header = contentEl.createDiv({ cls: 'crc-cleanup-wizard-header' });
		const titleRow = header.createDiv({ cls: 'crc-wizard-title' });
		const iconEl = titleRow.createDiv({ cls: 'crc-wizard-title-icon' });
		setIcon(iconEl, 'sparkles');
		titleRow.createSpan({ text: 'Post-Import Cleanup Wizard' });

		// Resume prompt content
		const content = contentEl.createDiv({ cls: 'crc-cleanup-wizard-content' });
		const prompt = content.createDiv({ cls: 'crc-cleanup-resume-prompt' });

		const promptIcon = prompt.createDiv({ cls: 'crc-cleanup-resume-icon' });
		setIcon(promptIcon, 'clock');

		prompt.createEl('h3', { text: 'Resume Previous Session?' });

		const savedDate = new Date(persistedState.savedAt);
		const timeAgo = this.formatTimeAgo(savedDate);

		const stats = this.getPersistedStateStats(persistedState);
		prompt.createEl('p', {
			text: `You have an incomplete cleanup session from ${timeAgo}. ${stats.completed} of ${stats.total} steps completed.`
		});

		// Buttons
		const footer = contentEl.createDiv({ cls: 'crc-cleanup-wizard-footer' });
		const leftBtns = footer.createDiv({ cls: 'crc-cleanup-footer-left' });
		const rightBtns = footer.createDiv({ cls: 'crc-cleanup-footer-right' });

		const startFreshBtn = leftBtns.createEl('button', {
			cls: 'crc-btn crc-btn--secondary',
			text: 'Start Fresh'
		});
		startFreshBtn.addEventListener('click', () => {
			void this.clearPersistedState();
			this.state = this.getDefaultState();
			contentEl.empty();
			this.initializeWizardUI(contentEl);
		});

		const resumeBtn = rightBtns.createEl('button', {
			cls: 'crc-btn crc-btn--primary'
		});
		const resumeIcon = resumeBtn.createSpan({ cls: 'crc-btn-icon' });
		setIcon(resumeIcon, 'play');
		resumeBtn.createSpan({ text: 'Resume' });
		resumeBtn.addEventListener('click', () => {
			this.restoreFromPersistedState(persistedState);
			contentEl.empty();
			this.initializeWizardUI(contentEl);
		});
	}

	/**
	 * Get persisted state from plugin settings (if valid)
	 */
	private getPersistedState(): CleanupWizardPersistedState | null {
		const saved = this.plugin.settings.cleanupWizardState;
		if (!saved) return null;

		// Check if state is expired
		const age = Date.now() - saved.savedAt;
		if (age > STATE_EXPIRY_MS) {
			logger.debug('getPersistedState', 'Persisted state is expired, clearing');
			void this.clearPersistedState();
			return null;
		}

		// Check if any steps are in progress or complete
		const hasProgress = Object.values(saved.steps).some(
			s => s.status === 'complete' || s.status === 'in_progress'
		);
		if (!hasProgress) {
			return null;
		}

		return saved;
	}

	/**
	 * Restore state from persisted data
	 */
	private restoreFromPersistedState(persisted: CleanupWizardPersistedState): void {
		logger.info('restoreFromPersistedState', `Restoring state from step ${persisted.currentStep}`);

		this.state = {
			currentStep: persisted.currentStep,
			steps: {},
			startTime: Date.now(),
			isPreScanning: false,
			// Re-run pre-scan to repopulate cached analysis data (bidirectionalIssues, qualityReport)
			preScanComplete: false
		};

		// Restore step states
		for (const step of WIZARD_STEPS) {
			const savedStep = persisted.steps[step.number];
			this.state.steps[step.number] = savedStep ? { ...savedStep } : {
				status: 'pending',
				issueCount: 0,
				fixCount: 0
			};
		}

		// Restore step completion tracking
		if (persisted.stepCompletion) {
			this.stepCompletion = { ...persisted.stepCompletion };
		}

		// Set the correct view based on current step
		if (persisted.currentStep > 0) {
			this.currentView = 'step';
		}
	}

	/**
	 * Persist current state to plugin settings
	 */
	private async persistState(): Promise<void> {
		// Don't persist if we're at summary (wizard is complete)
		if (this.currentView === 'summary') {
			await this.clearPersistedState();
			return;
		}

		const persistedState: CleanupWizardPersistedState = {
			currentStep: this.state.currentStep,
			steps: {},
			savedAt: Date.now(),
			stepCompletion: { ...this.stepCompletion }
		};

		for (const [stepNum, stepState] of Object.entries(this.state.steps)) {
			persistedState.steps[Number(stepNum)] = {
				status: stepState.status,
				issueCount: stepState.issueCount,
				fixCount: stepState.fixCount,
				skippedReason: stepState.skippedReason
			};
		}

		this.plugin.settings.cleanupWizardState = persistedState;
		await this.plugin.saveSettings();
		logger.debug('persistState', `Saved state at step ${this.state.currentStep}`);
	}

	/**
	 * Clear persisted state
	 */
	private async clearPersistedState(): Promise<void> {
		this.plugin.settings.cleanupWizardState = undefined;
		await this.plugin.saveSettings();
		logger.debug('clearPersistedState', 'Cleared persisted state');
	}

	/**
	 * Record step completion for dependency tracking
	 * @param stepId - The step ID (e.g., 'place-variants', 'geocode')
	 * @param issuesFixed - Number of issues fixed in this step
	 */
	private recordStepCompletion(stepId: string, issuesFixed: number): void {
		this.stepCompletion[stepId] = {
			completed: true,
			completedAt: Date.now(),
			issuesFixed
		};
		logger.debug('recordStepCompletion', `Recorded completion for step: ${stepId}`, { issuesFixed });
	}

	/**
	 * Check if a step has been completed in this session
	 * @param stepId - The step ID to check
	 */
	private isStepCompleted(stepId: string): boolean {
		return this.stepCompletion[stepId]?.completed === true;
	}

	/**
	 * Get unmet dependencies for a step
	 * Returns array of step titles that should be completed first
	 */
	private getUnmetDependencies(stepConfig: WizardStepConfig): string[] {
		const unmet: string[] = [];

		// Special dependency chain for place steps: 7 → 7b → 8 → 9
		if (stepConfig.id === 'geocode') {
			// Step 8 depends on Step 7 (place-variants) and 7b (place-dedup)
			if (!this.isStepCompleted('place-variants')) {
				unmet.push('Step 7: Standardize Place Variants');
			}
			// Note: 7b is optional, only warn if variants were run but dedup wasn't
			if (this.isStepCompleted('place-variants') && !this.isStepCompleted('place-dedup') && this.placeDuplicateGroups.length > 0) {
				unmet.push('Step 7b: Deduplicate Places');
			}
		} else if (stepConfig.id === 'place-hierarchy') {
			// Step 9 depends on Step 8 (geocode)
			if (!this.isStepCompleted('geocode')) {
				unmet.push('Step 8: Bulk Geocode');
			}
		}

		return unmet;
	}

	/**
	 * Render a dependency warning callout
	 * @param container - Container element to render into
	 * @param missingSteps - Array of step names that should be completed first
	 * @returns The warning element (for potential removal)
	 */
	private renderDependencyWarning(container: HTMLElement, missingSteps: string[]): HTMLElement {
		const warning = container.createDiv({ cls: 'crc-dependency-warning' });

		const iconEl = warning.createSpan({ cls: 'crc-dependency-warning-icon' });
		setIcon(iconEl, 'alert-triangle');

		const textEl = warning.createSpan({ cls: 'crc-dependency-warning-text' });
		textEl.setText(`Recommended: Complete ${missingSteps.join(' and ')} first for best results.`);

		const dismissBtn = warning.createEl('button', {
			text: 'Continue anyway',
			cls: 'crc-dependency-warning-dismiss'
		});
		dismissBtn.addEventListener('click', () => {
			warning.remove();
		});

		return warning;
	}

	/**
	 * Get stats from persisted state for display
	 */
	private getPersistedStateStats(state: CleanupWizardPersistedState): { completed: number; total: number } {
		let completed = 0;
		const total = WIZARD_STEPS.length;
		for (const step of Object.values(state.steps)) {
			if (step.status === 'complete' || step.status === 'skipped') {
				completed++;
			}
		}
		return { completed, total };
	}

	/**
	 * Format a date as relative time (e.g., "2 hours ago")
	 */
	private formatTimeAgo(date: Date): string {
		const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

		if (seconds < 60) return 'just now';
		if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
		return `${Math.floor(seconds / 86400)} days ago`;
	}

	onClose(): void {
		const { contentEl } = this;

		// Persist state if wizard is incomplete
		if (this.currentView !== 'summary') {
			void this.persistState();
		}

		// Clean up keyboard handler
		if (this.keyboardHandler) {
			this.modalEl.removeEventListener('keydown', this.keyboardHandler);
			this.keyboardHandler = null;
		}

		contentEl.empty();
	}

	// ========================================
	// Keyboard Navigation (Phase 4)
	// ========================================

	/**
	 * Setup keyboard navigation for the wizard
	 */
	private setupKeyboardNavigation(): void {
		this.keyboardHandler = (e: KeyboardEvent) => {
			// Only handle navigation on overview screen
			if (this.currentView === 'overview') {
				this.handleOverviewKeyboard(e);
			} else if (this.currentView === 'step') {
				this.handleStepKeyboard(e);
			}
		};
		this.modalEl.addEventListener('keydown', this.keyboardHandler);
	}

	/**
	 * Handle keyboard events on the overview screen
	 */
	private handleOverviewKeyboard(e: KeyboardEvent): void {
		const totalTiles = WIZARD_STEPS.length;
		const tilesPerRow = 5;

		switch (e.key) {
			case 'ArrowRight':
				this.focusedTileIndex = Math.min(this.focusedTileIndex + 1, totalTiles - 1);
				this.updateTileFocus();
				e.preventDefault();
				break;
			case 'ArrowLeft':
				this.focusedTileIndex = Math.max(this.focusedTileIndex - 1, 0);
				this.updateTileFocus();
				e.preventDefault();
				break;
			case 'ArrowDown':
				this.focusedTileIndex = Math.min(this.focusedTileIndex + tilesPerRow, totalTiles - 1);
				this.updateTileFocus();
				e.preventDefault();
				break;
			case 'ArrowUp':
				this.focusedTileIndex = Math.max(this.focusedTileIndex - tilesPerRow, 0);
				this.updateTileFocus();
				e.preventDefault();
				break;
			case 'Enter':
			case ' ':
				this.activateFocusedTile();
				e.preventDefault();
				break;
		}
	}

	/**
	 * Handle keyboard events on the step screen
	 */
	private handleStepKeyboard(e: KeyboardEvent): void {
		// Escape goes back to overview
		if (e.key === 'Escape') {
			this.currentView = 'overview';
			this.renderCurrentView();
			e.preventDefault();
			e.stopPropagation();
		}
	}

	/**
	 * Update tile focus visual state
	 */
	private updateTileFocus(): void {
		const tiles = this.contentContainer?.querySelectorAll('.crc-cleanup-tile');
		if (!tiles) return;

		tiles.forEach((tile, index) => {
			if (index === this.focusedTileIndex) {
				tile.addClass('crc-cleanup-tile--focused');
				(tile as HTMLElement).focus();
			} else {
				tile.removeClass('crc-cleanup-tile--focused');
			}
		});
	}

	/**
	 * Activate the currently focused tile
	 */
	private activateFocusedTile(): void {
		const tiles = this.contentContainer?.querySelectorAll('.crc-cleanup-tile');
		if (!tiles || this.focusedTileIndex >= tiles.length) return;

		const tile = tiles[this.focusedTileIndex] as HTMLElement;
		tile.click();
	}

	/**
	 * Render the current view
	 */
	private renderCurrentView(): void {
		if (!this.contentContainer || !this.footerContainer) return;

		this.contentContainer.empty();
		this.footerContainer.empty();

		switch (this.currentView) {
			case 'overview':
				this.renderOverview();
				break;
			case 'step':
				this.renderStepView();
				break;
			case 'summary':
				this.renderSummary();
				break;
		}
	}

	/**
	 * Render the overview tile grid
	 */
	private renderOverview(): void {
		if (!this.contentContainer || !this.footerContainer || !this.progressContainer) return;

		// Hide step progress in overview
		this.progressContainer.addClass('crc-hidden');

		const section = this.contentContainer.createDiv({ cls: 'crc-cleanup-section' });

		// Intro text
		const intro = section.createDiv({ cls: 'crc-cleanup-intro' });
		intro.textContent = 'Clean up your vault after import. Click a step to begin, or start from the first step.';

		// Pre-scan status
		if (this.state.isPreScanning) {
			const scanningEl = section.createDiv({ cls: 'crc-cleanup-scanning' });
			const spinnerEl = scanningEl.createDiv({ cls: 'crc-cleanup-spinner' });
			setIcon(spinnerEl, 'loader-2');
			scanningEl.createSpan({ text: 'Analyzing vault...' });
		}

		// Tile grid (5x2)
		const grid = section.createDiv({ cls: 'crc-cleanup-tile-grid' });

		for (const stepConfig of WIZARD_STEPS) {
			this.renderStepTile(grid, stepConfig);
		}

		// Apply keyboard focus to the first tile (or current focus index)
		this.updateTileFocus();

		// Footer buttons
		const leftBtns = this.footerContainer.createDiv({ cls: 'crc-cleanup-footer-left' });
		const cancelBtn = leftBtns.createEl('button', {
			cls: 'crc-btn crc-btn--secondary',
			text: 'Close'
		});
		cancelBtn.addEventListener('click', () => this.close());

		const rightBtns = this.footerContainer.createDiv({ cls: 'crc-cleanup-footer-right' });

		// Skip All button
		const skipAllBtn = rightBtns.createEl('button', {
			cls: 'crc-btn crc-btn--secondary',
			text: 'Skip All & Exit'
		});
		skipAllBtn.addEventListener('click', () => {
			// Mark all as skipped and close
			for (const step of WIZARD_STEPS) {
				if (this.state.steps[step.number].status === 'pending') {
					this.state.steps[step.number].status = 'skipped';
					this.state.steps[step.number].skippedReason = 'Skipped by user';
				}
			}
			this.currentView = 'summary';
			this.renderCurrentView();
		});

		// Start Cleanup button
		const startBtn = rightBtns.createEl('button', {
			cls: 'crc-btn crc-btn--primary'
		});
		const startIcon = startBtn.createSpan({ cls: 'crc-btn-icon' });
		setIcon(startIcon, 'play');
		startBtn.createSpan({ text: 'Start Cleanup' });

		startBtn.addEventListener('click', () => {
			this.state.currentStep = 1;
			this.currentView = 'step';
			this.renderCurrentView();
		});

		// Start pre-scan if not done
		if (!this.state.preScanComplete && !this.state.isPreScanning) {
			void this.runPreScan();
		}
	}

	/**
	 * Render a single step tile
	 */
	private renderStepTile(container: HTMLElement, stepConfig: WizardStepConfig): void {
		const stepState = this.state.steps[stepConfig.number];
		const tile = container.createDiv({ cls: 'crc-cleanup-tile' });

		// Make tile focusable for keyboard navigation
		tile.setAttribute('tabindex', '0');
		tile.setAttribute('role', 'button');
		tile.setAttribute('aria-label', `Step ${stepConfig.number}: ${stepConfig.title}`);

		// Check for unmet dependencies
		const unmetDeps = this.getUnmetDependencies(stepConfig);
		const hasUnmetDeps = unmetDeps.length > 0;

		// Add status class
		tile.addClass(`crc-cleanup-tile--${stepState.status}`);

		// Add dependency class if has unmet dependencies
		if (hasUnmetDeps && stepState.status === 'pending') {
			tile.addClass('crc-cleanup-tile--has-deps');
			tile.setAttribute('title', `Recommended: Complete ${unmetDeps.join(' and ')} first`);
		}

		// Step number badge
		const numberBadge = tile.createDiv({ cls: 'crc-cleanup-tile-number' });
		numberBadge.textContent = String(stepConfig.number);

		// Title
		const title = tile.createDiv({ cls: 'crc-cleanup-tile-title' });
		title.textContent = stepConfig.shortTitle;

		// Status/count badge
		const badge = tile.createDiv({ cls: 'crc-cleanup-tile-badge' });

		switch (stepState.status) {
			case 'pending':
				// Show dependency indicator if has unmet dependencies
				if (hasUnmetDeps) {
					const depIcon = badge.createSpan({ cls: 'crc-cleanup-tile-badge-icon' });
					setIcon(depIcon, 'link');
					badge.createSpan({ text: 'Has deps' });
					badge.addClass('crc-cleanup-tile-badge--deps');
				} else if (stepState.issueCount > 0) {
					badge.textContent = `${stepState.issueCount} ${stepState.issueCount === 1 ? 'fix' : 'fixes'}`;
					badge.addClass('crc-cleanup-tile-badge--count');
				} else if (this.state.preScanComplete) {
					badge.textContent = '0 issues';
					badge.addClass('crc-cleanup-tile-badge--empty');
				} else {
					badge.textContent = 'Pending';
					badge.addClass('crc-cleanup-tile-badge--pending');
				}
				break;
			case 'in_progress':
				badge.textContent = 'In progress';
				badge.addClass('crc-cleanup-tile-badge--progress');
				break;
			case 'complete': {
				const checkIcon = badge.createSpan({ cls: 'crc-cleanup-tile-badge-icon' });
				setIcon(checkIcon, 'check');
				if (stepState.fixCount > 0) {
					badge.createSpan({ text: `${stepState.fixCount} fixed` });
				} else {
					badge.createSpan({ text: 'Done' });
				}
				badge.addClass('crc-cleanup-tile-badge--complete');
				break;
			}
			case 'skipped':
				badge.textContent = 'Skipped';
				badge.addClass('crc-cleanup-tile-badge--skipped');
				break;
		}

		// Click handler
		tile.addEventListener('click', () => {
			this.state.currentStep = stepConfig.number;
			this.currentView = 'step';
			this.renderCurrentView();
		});
	}

	/**
	 * Render the step progress indicator
	 */
	private renderStepProgress(): void {
		if (!this.progressContainer) return;
		this.progressContainer.empty();
		this.progressContainer.removeClass('crc-hidden');

		const stepsRow = this.progressContainer.createDiv({ cls: 'crc-wizard-steps crc-cleanup-progress-steps' });

		// Show step dots (more compact than numbered circles)
		const totalSteps = WIZARD_STEPS.length;
		for (let i = 1; i <= totalSteps; i++) {
			const stepState = this.state.steps[i];
			const dot = stepsRow.createDiv({ cls: 'crc-cleanup-progress-dot' });

			if (i === this.state.currentStep) {
				dot.addClass('crc-cleanup-progress-dot--active');
			} else if (stepState.status === 'complete') {
				dot.addClass('crc-cleanup-progress-dot--complete');
			} else if (stepState.status === 'skipped') {
				dot.addClass('crc-cleanup-progress-dot--skipped');
			}

			// Connector line (except after last)
			if (i < totalSteps) {
				const connector = stepsRow.createDiv({ cls: 'crc-cleanup-progress-connector' });
				if (stepState.status === 'complete' || stepState.status === 'skipped') {
					connector.addClass('crc-cleanup-progress-connector--done');
				}
			}
		}

		// Step label
		const stepLabel = this.progressContainer.createDiv({ cls: 'crc-cleanup-step-label' });
		stepLabel.textContent = `Step ${this.state.currentStep} of ${totalSteps}`;
	}

	/**
	 * Render the current step view
	 */
	private renderStepView(): void {
		if (!this.contentContainer || !this.footerContainer) return;

		// Trigger pre-scan if not done (e.g., when resuming directly to a step)
		// Show loading state and return - runPreScan will call renderCurrentView when complete
		if (!this.state.preScanComplete && !this.state.isPreScanning) {
			const section = this.contentContainer.createDiv({ cls: 'crc-cleanup-section' });
			const scanning = section.createDiv({ cls: 'crc-cleanup-scanning' });
			const spinner = scanning.createDiv({ cls: 'crc-cleanup-spinner' });
			setIcon(spinner, 'loader-2');
			scanning.createSpan({ text: 'Analyzing vault...' });
			void this.runPreScan();
			return;
		}

		// Show step progress
		this.renderStepProgress();

		const stepConfig = WIZARD_STEPS.find(s => s.number === this.state.currentStep);
		if (!stepConfig) return;

		const stepState = this.state.steps[this.state.currentStep];

		const section = this.contentContainer.createDiv({ cls: 'crc-cleanup-section' });

		// Step title
		section.createEl('h3', {
			text: `Step ${stepConfig.number}: ${stepConfig.title}`,
			cls: 'crc-cleanup-step-title'
		});

		// Step description
		const desc = section.createDiv({ cls: 'crc-cleanup-step-description' });
		desc.textContent = stepConfig.description;

		// Step content based on type
		const contentArea = section.createDiv({ cls: 'crc-cleanup-step-content' });

		switch (stepConfig.type) {
			case 'review':
				this.renderReviewStep(contentArea, stepConfig, stepState);
				break;
			case 'batch':
				this.renderBatchStep(contentArea, stepConfig, stepState);
				break;
			case 'interactive':
				this.renderInteractiveStep(contentArea, stepConfig, stepState);
				break;
		}

		// Footer navigation
		this.renderStepFooter(stepConfig, stepState);
	}

	/**
	 * Render a review-only step (Step 1)
	 */
	private renderReviewStep(
		container: HTMLElement,
		_stepConfig: WizardStepConfig,
		stepState: StepState
	): void {
		if (stepState.issueCount === 0 && this.state.preScanComplete) {
			const noIssues = container.createDiv({ cls: 'crc-cleanup-no-issues' });
			const icon = noIssues.createDiv({ cls: 'crc-cleanup-no-issues-icon' });
			setIcon(icon, 'check-circle');
			noIssues.createDiv({ cls: 'crc-cleanup-no-issues-text', text: 'No quality issues detected!' });
			noIssues.createDiv({ cls: 'crc-cleanup-no-issues-hint', text: 'Your vault looks good. You can skip to the next step or review the other steps.' });
			return;
		}

		// Show loading state
		if (this.state.isPreScanning) {
			const scanningEl = container.createDiv({ cls: 'crc-cleanup-scanning' });
			const spinner = scanningEl.createDiv({ cls: 'crc-cleanup-spinner' });
			setIcon(spinner, 'loader-2');
			scanningEl.createSpan({ text: 'Analyzing quality issues...' });
			return;
		}

		// Show quality report summary
		if (this.qualityReport) {
			this.renderQualityReport(container, this.qualityReport);
		}
	}

	/**
	 * Render the quality report with issue categories
	 */
	private renderQualityReport(container: HTMLElement, report: DataQualityReport): void {
		// Summary stats row
		const statsRow = container.createDiv({ cls: 'crc-cleanup-quality-stats' });

		// Quality score card
		const scoreCard = statsRow.createDiv({ cls: 'crc-cleanup-quality-score' });
		const scoreValue = scoreCard.createDiv({ cls: 'crc-cleanup-quality-score-value' });
		scoreValue.textContent = String(report.summary.qualityScore);

		// Color based on score
		if (report.summary.qualityScore >= 80) {
			scoreValue.addClass('crc-cleanup-quality-score--good');
		} else if (report.summary.qualityScore >= 50) {
			scoreValue.addClass('crc-cleanup-quality-score--moderate');
		} else {
			scoreValue.addClass('crc-cleanup-quality-score--poor');
		}
		scoreCard.createDiv({ cls: 'crc-cleanup-quality-score-label', text: 'Quality Score' });

		// Stats mini cards
		const statsGrid = statsRow.createDiv({ cls: 'crc-cleanup-quality-mini-stats' });

		this.renderMiniStat(statsGrid, 'users', String(report.summary.totalPeople), 'People');
		this.renderMiniStat(statsGrid, 'alert-circle', String(report.summary.bySeverity.error), 'Errors');
		this.renderMiniStat(statsGrid, 'alert-triangle', String(report.summary.bySeverity.warning), 'Warnings');
		this.renderMiniStat(statsGrid, 'info', String(report.summary.bySeverity.info), 'Info');

		// Issue categories
		const categoriesSection = container.createDiv({ cls: 'crc-cleanup-categories' });
		categoriesSection.createEl('h4', { text: 'Issues by Category', cls: 'crc-cleanup-categories-title' });

		const service = this.getDataQualityService();
		const groupedIssues = service.groupIssuesByCategory(report.issues);

		// Category display config
		const categoryConfig: Record<IssueCategory, { icon: string; label: string; stepRef?: number }> = {
			'date_inconsistency': { icon: 'calendar-x', label: 'Date Inconsistencies', stepRef: 3 },
			'relationship_inconsistency': { icon: 'git-branch', label: 'Relationship Issues', stepRef: 2 },
			'missing_data': { icon: 'file-question', label: 'Missing Data' },
			'data_format': { icon: 'type', label: 'Format Issues', stepRef: 4 },
			'orphan_reference': { icon: 'unlink', label: 'Orphan References', stepRef: 5 },
			'nested_property': { icon: 'layers', label: 'Nested Properties', stepRef: 10 },
			'legacy_type_property': { icon: 'tag', label: 'Legacy Type Property' }
		};

		// Render each category that has issues
		for (const [category, config] of Object.entries(categoryConfig)) {
			const issues = groupedIssues.get(category as IssueCategory);
			if (!issues || issues.length === 0) continue;

			this.renderIssueCategoryCard(categoriesSection, category as IssueCategory, config, issues);
		}

		// If no issues in any category, show a message
		if (report.issues.length === 0) {
			const noIssues = categoriesSection.createDiv({ cls: 'crc-cleanup-no-issues' });
			noIssues.textContent = 'No issues found in any category.';
		}
	}

	/**
	 * Render a mini stat card
	 */
	private renderMiniStat(container: HTMLElement, icon: string, value: string, label: string): void {
		const stat = container.createDiv({ cls: 'crc-cleanup-mini-stat' });
		const iconEl = stat.createDiv({ cls: 'crc-cleanup-mini-stat-icon' });
		setIcon(iconEl, icon);
		stat.createDiv({ cls: 'crc-cleanup-mini-stat-value', text: value });
		stat.createDiv({ cls: 'crc-cleanup-mini-stat-label', text: label });
	}

	/**
	 * Render an issue category card with collapsible issue list
	 */
	private renderIssueCategoryCard(
		container: HTMLElement,
		category: IssueCategory,
		config: { icon: string; label: string; stepRef?: number },
		issues: DataQualityIssue[]
	): void {
		const card = container.createDiv({ cls: 'crc-cleanup-category-card' });

		// Header (clickable to expand/collapse)
		const header = card.createDiv({ cls: 'crc-cleanup-category-header' });

		const iconEl = header.createDiv({ cls: 'crc-cleanup-category-icon' });
		setIcon(iconEl, config.icon);

		const labelEl = header.createDiv({ cls: 'crc-cleanup-category-label' });
		labelEl.textContent = config.label;

		const badge = header.createDiv({ cls: 'crc-cleanup-category-badge' });
		badge.textContent = String(issues.length);

		// Add severity indicator based on issue mix
		const hasErrors = issues.some(i => i.severity === 'error');
		const hasWarnings = issues.some(i => i.severity === 'warning');
		if (hasErrors) {
			badge.addClass('crc-cleanup-category-badge--error');
		} else if (hasWarnings) {
			badge.addClass('crc-cleanup-category-badge--warning');
		}

		const chevron = header.createDiv({ cls: 'crc-cleanup-category-chevron' });
		setIcon(chevron, 'chevron-right');

		// Collapsible content
		const content = card.createDiv({ cls: 'crc-cleanup-category-content crc-hidden' });

		// Toggle behavior
		let isExpanded = false;
		header.addEventListener('click', () => {
			isExpanded = !isExpanded;
			content.toggleClass('crc-hidden', !isExpanded);
			chevron.empty();
			setIcon(chevron, isExpanded ? 'chevron-down' : 'chevron-right');
			header.toggleClass('crc-cleanup-category-header--expanded', isExpanded);
		});

		// Issue list (limit to first 20, show "and X more" if needed)
		const maxDisplay = 20;
		const displayIssues = issues.slice(0, maxDisplay);
		const remaining = issues.length - maxDisplay;

		const issueList = content.createDiv({ cls: 'crc-cleanup-issue-list' });

		for (const issue of displayIssues) {
			const issueRow = issueList.createDiv({ cls: 'crc-cleanup-issue-row' });

			// Severity icon
			const severityIcon = issueRow.createDiv({ cls: `crc-cleanup-issue-severity crc-cleanup-issue-severity--${issue.severity}` });
			setIcon(severityIcon, issue.severity === 'error' ? 'x-circle' : issue.severity === 'warning' ? 'alert-triangle' : 'info');

			// Person name (clickable link)
			const personLink = issueRow.createDiv({ cls: 'crc-cleanup-issue-person' });
			personLink.textContent = issue.person.name || issue.person.file.basename;
			personLink.addEventListener('click', (e) => {
				e.stopPropagation();
				this.close();
				void this.app.workspace.openLinkText(issue.person.file.path, '', false);
			});

			// Issue message
			const messageEl = issueRow.createDiv({ cls: 'crc-cleanup-issue-message' });
			messageEl.textContent = issue.message;
		}

		if (remaining > 0) {
			const moreEl = issueList.createDiv({ cls: 'crc-cleanup-issue-more' });
			moreEl.textContent = `... and ${remaining} more`;
		}

		// Step reference link if applicable
		if (config.stepRef) {
			const stepLink = content.createDiv({ cls: 'crc-cleanup-category-step-link' });
			const stepBtn = stepLink.createEl('button', {
				cls: 'crc-btn crc-btn--secondary crc-btn--small'
			});
			stepBtn.textContent = `Go to Step ${config.stepRef} to fix`;
			stepBtn.addEventListener('click', () => {
				this.state.currentStep = config.stepRef!;
				this.currentView = 'step';
				this.renderCurrentView();
			});
		}
	}

	/**
	 * Render a batch-fix step (Steps 2-6, 10)
	 */
	private renderBatchStep(
		container: HTMLElement,
		stepConfig: WizardStepConfig,
		stepState: StepState
	): void {
		// Show progress during batch operation
		if (stepState.status === 'in_progress' && this.batchProgress) {
			this.renderBatchProgress(container, stepConfig);
			return;
		}

		if (stepState.status === 'complete') {
			// Special handling for Step 2 with conflicts
			if (stepConfig.id === 'bidirectional') {
				const conflicts = this.bidirectionalIssues.filter(i => i.type === 'conflicting-parent-claim');
				if (conflicts.length > 0) {
					this.renderBidirectionalCompleteWithConflicts(container, stepState.fixCount, conflicts);
					return;
				}
			}

			const complete = container.createDiv({ cls: 'crc-cleanup-step-complete' });
			const icon = complete.createDiv({ cls: 'crc-cleanup-step-complete-icon' });
			setIcon(icon, 'check-circle');
			complete.createDiv({ cls: 'crc-cleanup-step-complete-text', text: 'Step complete!' });
			if (stepState.fixCount > 0) {
				complete.createDiv({ cls: 'crc-cleanup-step-complete-count', text: `${stepState.fixCount} items fixed` });
			}
			return;
		}

		if (stepState.issueCount === 0 && this.state.preScanComplete) {
			const noIssues = container.createDiv({ cls: 'crc-cleanup-no-issues' });
			const icon = noIssues.createDiv({ cls: 'crc-cleanup-no-issues-icon' });
			setIcon(icon, 'check-circle');
			noIssues.createDiv({ cls: 'crc-cleanup-no-issues-text', text: 'No issues to fix!' });
			noIssues.createDiv({ cls: 'crc-cleanup-no-issues-hint', text: 'This step has nothing to do. You can skip to the next step.' });
			return;
		}

		// Show loading state
		if (this.state.isPreScanning) {
			const scanning = container.createDiv({ cls: 'crc-cleanup-scanning' });
			const spinner = scanning.createDiv({ cls: 'crc-cleanup-spinner' });
			setIcon(spinner, 'loader-2');
			scanning.createSpan({ text: 'Detecting issues...' });
			return;
		}

		// Render step-specific preview
		switch (stepConfig.id) {
			case 'bidirectional':
				this.renderBidirectionalPreview(container);
				break;
			case 'date-normalize':
				this.renderDatePreview(container);
				break;
			case 'gender-normalize':
				this.renderGenderPreview(container);
				break;
			case 'orphan-clear':
				this.renderOrphanPreview(container);
				break;
			case 'source-migrate':
				this.renderSourceMigrationPreview(container);
				break;
			case 'flatten-props':
				this.renderNestedPropsPreview(container);
				break;
			case 'event-person-migrate':
				this.renderEventPersonMigrationPreview(container);
				break;
			case 'sourced-facts-migrate':
				this.renderSourcedFactsMigrationPreview(container);
				break;
			case 'life-events-migrate':
				this.renderLifeEventsMigrationPreview(container);
				break;
			case 'child-to-children':
				this.renderChildToChildrenPreview(container);
				break;
			default:
				// Fallback for unimplemented previews
				this.renderGenericPreview(container, stepConfig, stepState);
		}
	}

	/**
	 * Render batch operation progress
	 */
	private renderBatchProgress(container: HTMLElement, stepConfig: WizardStepConfig): void {
		if (!this.batchProgress) return;

		const { current, total, currentFile } = this.batchProgress;
		const percent = total > 0 ? Math.round((current / total) * 100) : 0;

		const progress = container.createDiv({ cls: 'crc-cleanup-batch-progress' });

		// Progress header
		const header = progress.createDiv({ cls: 'crc-cleanup-batch-progress-header' });
		const spinner = header.createSpan({ cls: 'crc-cleanup-batch-progress-spinner' });
		setIcon(spinner, 'loader-2');
		header.createSpan({ text: `Processing ${stepConfig.shortTitle}...`, cls: 'crc-cleanup-batch-progress-title' });

		// Progress stats
		const stats = progress.createDiv({ cls: 'crc-cleanup-batch-progress-stats' });
		stats.createSpan({ text: `${current} of ${total} (${percent}%)` });

		// Progress bar
		const barContainer = progress.createDiv({ cls: 'crc-cleanup-batch-progress-bar-container' });
		const bar = barContainer.createDiv({ cls: 'crc-cleanup-batch-progress-bar' });
		bar.style.width = `${percent}%`;

		// Current file
		if (currentFile) {
			const fileText = progress.createDiv({ cls: 'crc-cleanup-batch-progress-file' });
			fileText.textContent = currentFile;
		}
	}

	/**
	 * Render preview for Step 2: Bidirectional Relationships
	 */
	private renderBidirectionalPreview(container: HTMLElement): void {
		if (this.bidirectionalIssues.length === 0) {
			return;
		}

		// Separate auto-fixable from conflicts
		const autoFixable = this.bidirectionalIssues.filter(i => i.type !== 'conflicting-parent-claim');
		const conflicts = this.bidirectionalIssues.filter(i => i.type === 'conflicting-parent-claim');

		const preview = container.createDiv({ cls: 'crc-cleanup-preview' });

		// Auto-fixable section
		if (autoFixable.length > 0) {
			const summary = preview.createDiv({ cls: 'crc-cleanup-preview-summary' });
			summary.textContent = `${autoFixable.length} relationship${autoFixable.length === 1 ? '' : 's'} will be fixed:`;

			const list = preview.createDiv({ cls: 'crc-cleanup-preview-list' });

			const maxDisplay = 15;
			const displayItems = autoFixable.slice(0, maxDisplay);
			const remaining = autoFixable.length - maxDisplay;

			for (const issue of displayItems) {
				const row = list.createDiv({ cls: 'crc-cleanup-preview-row' });

				// Icon based on type
				const iconEl = row.createDiv({ cls: 'crc-cleanup-preview-icon' });
				if (issue.type === 'missing-child-in-parent') {
					setIcon(iconEl, 'user-plus');
				} else if (issue.type === 'missing-parent-in-child') {
					setIcon(iconEl, 'arrow-up');
				} else if (issue.type === 'missing-spouse-in-spouse') {
					setIcon(iconEl, 'heart');
				} else {
					setIcon(iconEl, 'alert-triangle');
				}

				// Description
				const desc = row.createDiv({ cls: 'crc-cleanup-preview-desc' });
				desc.textContent = issue.description;
			}

			if (remaining > 0) {
				const moreEl = list.createDiv({ cls: 'crc-cleanup-preview-more' });
				moreEl.textContent = `... and ${remaining} more`;
			}
		}

		// Conflicts section (require manual resolution)
		if (conflicts.length > 0) {
			const conflictSection = preview.createDiv({ cls: 'crc-cleanup-preview-conflicts' });

			const conflictHeader = conflictSection.createDiv({ cls: 'crc-cleanup-preview-conflict-header' });
			const warningIcon = conflictHeader.createSpan({ cls: 'crc-cleanup-preview-conflict-icon' });
			setIcon(warningIcon, 'alert-triangle');
			conflictHeader.createSpan({ text: `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} require manual resolution:` });

			const conflictHint = conflictSection.createDiv({ cls: 'crc-cleanup-preview-conflict-hint' });
			conflictHint.textContent = 'Click a row to open the person note for editing.';

			const conflictList = conflictSection.createDiv({ cls: 'crc-cleanup-preview-list' });

			for (const issue of conflicts.slice(0, 10)) {
				const row = conflictList.createDiv({ cls: 'crc-cleanup-preview-row crc-cleanup-preview-row--conflict crc-cleanup-preview-row--clickable' });

				const iconEl = row.createDiv({ cls: 'crc-cleanup-preview-icon' });
				setIcon(iconEl, 'alert-triangle');

				// Show person name as clickable link (person is the child with conflicting parent claims)
				const personLink = row.createDiv({ cls: 'crc-cleanup-preview-person' });
				personLink.textContent = issue.person.name || issue.person.file.basename;

				const desc = row.createDiv({ cls: 'crc-cleanup-preview-desc' });
				desc.textContent = issue.description;

				// Click to open the person file (the one with conflicting parent claims)
				row.addEventListener('click', () => {
					this.close();
					void this.app.workspace.openLinkText(issue.person.file.path, '', false);
				});
			}

			if (conflicts.length > 10) {
				const moreEl = conflictList.createDiv({ cls: 'crc-cleanup-preview-more' });
				moreEl.textContent = `... and ${conflicts.length - 10} more`;
			}
		}
	}

	/**
	 * Render Step 2 completion view when conflicts remain
	 */
	private renderBidirectionalCompleteWithConflicts(
		container: HTMLElement,
		fixCount: number,
		conflicts: BidirectionalInconsistency[]
	): void {
		// Show success for auto-fixed items
		if (fixCount > 0) {
			const successSection = container.createDiv({ cls: 'crc-cleanup-step-partial-complete' });
			const successIcon = successSection.createDiv({ cls: 'crc-cleanup-step-complete-icon' });
			setIcon(successIcon, 'check-circle');
			successSection.createDiv({
				cls: 'crc-cleanup-step-complete-text',
				text: `${fixCount} relationship${fixCount === 1 ? '' : 's'} fixed automatically`
			});
		}

		// Show conflicts that need manual resolution
		const conflictSection = container.createDiv({ cls: 'crc-cleanup-preview-conflicts' });

		const conflictHeader = conflictSection.createDiv({ cls: 'crc-cleanup-preview-conflict-header' });
		const warningIcon = conflictHeader.createSpan({ cls: 'crc-cleanup-preview-conflict-icon' });
		setIcon(warningIcon, 'alert-triangle');
		conflictHeader.createSpan({
			text: `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} require manual resolution`
		});

		const conflictHint = conflictSection.createDiv({ cls: 'crc-cleanup-preview-conflict-hint' });
		conflictHint.textContent = 'These people have multiple parents claiming them. Click a row to open the note and correct the parent references.';

		const conflictList = conflictSection.createDiv({ cls: 'crc-cleanup-preview-list' });

		for (const issue of conflicts.slice(0, 10)) {
			const row = conflictList.createDiv({ cls: 'crc-cleanup-preview-row crc-cleanup-preview-row--conflict crc-cleanup-preview-row--clickable' });

			const iconEl = row.createDiv({ cls: 'crc-cleanup-preview-icon' });
			setIcon(iconEl, 'alert-triangle');

			// Show person name as clickable link (person is the child with conflicting parent claims)
			const personLink = row.createDiv({ cls: 'crc-cleanup-preview-person' });
			personLink.textContent = issue.person.name || issue.person.file.basename;

			const desc = row.createDiv({ cls: 'crc-cleanup-preview-desc' });
			desc.textContent = issue.description;

			// Click to open the person file
			row.addEventListener('click', () => {
				this.close();
				void this.app.workspace.openLinkText(issue.person.file.path, '', false);
			});
		}

		if (conflicts.length > 10) {
			const moreEl = conflictList.createDiv({ cls: 'crc-cleanup-preview-more' });
			moreEl.textContent = `... and ${conflicts.length - 10} more`;
		}
	}

	/**
	 * Render preview for Step 3: Date Normalization
	 */
	private renderDatePreview(container: HTMLElement): void {
		if (!this.qualityReport) return;

		const dateIssues = this.qualityReport.issues.filter(i => i.code === 'NON_STANDARD_DATE');
		if (dateIssues.length === 0) return;

		const preview = container.createDiv({ cls: 'crc-cleanup-preview' });
		const summary = preview.createDiv({ cls: 'crc-cleanup-preview-summary' });
		summary.textContent = `${dateIssues.length} date${dateIssues.length === 1 ? '' : 's'} will be normalized to YYYY-MM-DD format:`;

		const hint = preview.createDiv({ cls: 'crc-cleanup-preview-hint' });
		hint.textContent = 'Click a row to open the person note for editing.';

		const list = preview.createDiv({ cls: 'crc-cleanup-preview-list' });

		const maxDisplay = 15;
		const displayItems = dateIssues.slice(0, maxDisplay);
		const remaining = dateIssues.length - maxDisplay;

		for (const issue of displayItems) {
			const row = list.createDiv({ cls: 'crc-cleanup-preview-row crc-cleanup-preview-row--clickable' });

			const iconEl = row.createDiv({ cls: 'crc-cleanup-preview-icon' });
			setIcon(iconEl, 'calendar');

			const content = row.createDiv({ cls: 'crc-cleanup-preview-content' });

			const personName = content.createSpan({ cls: 'crc-cleanup-preview-person' });
			personName.textContent = issue.person.name || issue.person.file.basename;

			const arrow = content.createSpan({ cls: 'crc-cleanup-preview-arrow' });
			arrow.textContent = ' → ';

			const change = content.createSpan({ cls: 'crc-cleanup-preview-change' });
			const oldValue = issue.details?.['value'] as string || '?';
			const field = issue.details?.['field'] as string || 'date';
			change.textContent = `${field}: "${oldValue}"`;

			// Click to open the person file
			row.addEventListener('click', () => {
				this.close();
				void this.app.workspace.openLinkText(issue.person.file.path, '', false);
			});
		}

		if (remaining > 0) {
			const moreEl = list.createDiv({ cls: 'crc-cleanup-preview-more' });
			moreEl.textContent = `... and ${remaining} more`;
		}
	}

	/**
	 * Render preview for Step 4: Gender Normalization
	 */
	private renderGenderPreview(container: HTMLElement): void {
		if (!this.qualityReport) return;

		const genderIssues = this.qualityReport.issues.filter(i => i.code === 'INVALID_GENDER');
		if (genderIssues.length === 0) return;

		const preview = container.createDiv({ cls: 'crc-cleanup-preview' });
		const summary = preview.createDiv({ cls: 'crc-cleanup-preview-summary' });
		summary.textContent = `${genderIssues.length} gender value${genderIssues.length === 1 ? '' : 's'} will be normalized:`;

		const hint = preview.createDiv({ cls: 'crc-cleanup-preview-hint' });
		hint.textContent = 'Click a row to open the person note for editing.';

		const list = preview.createDiv({ cls: 'crc-cleanup-preview-list' });

		const maxDisplay = 15;
		const displayItems = genderIssues.slice(0, maxDisplay);
		const remaining = genderIssues.length - maxDisplay;

		for (const issue of displayItems) {
			const row = list.createDiv({ cls: 'crc-cleanup-preview-row crc-cleanup-preview-row--clickable' });

			const iconEl = row.createDiv({ cls: 'crc-cleanup-preview-icon' });
			setIcon(iconEl, 'user');

			const content = row.createDiv({ cls: 'crc-cleanup-preview-content' });

			const personName = content.createSpan({ cls: 'crc-cleanup-preview-person' });
			personName.textContent = issue.person.name || issue.person.file.basename;

			const arrow = content.createSpan({ cls: 'crc-cleanup-preview-arrow' });
			arrow.textContent = ': ';

			const change = content.createSpan({ cls: 'crc-cleanup-preview-change' });
			const currentValue = issue.details?.['value'] as string || '?';
			change.textContent = `"${currentValue}" → standard format`;

			// Click to open the person file
			row.addEventListener('click', () => {
				this.close();
				void this.app.workspace.openLinkText(issue.person.file.path, '', false);
			});
		}

		if (remaining > 0) {
			const moreEl = list.createDiv({ cls: 'crc-cleanup-preview-more' });
			moreEl.textContent = `... and ${remaining} more`;
		}
	}

	/**
	 * Render preview for Step 5: Orphan References
	 */
	private renderOrphanPreview(container: HTMLElement): void {
		if (!this.qualityReport) return;

		const orphanIssues = this.qualityReport.issues.filter(i => i.category === 'orphan_reference');
		if (orphanIssues.length === 0) return;

		const preview = container.createDiv({ cls: 'crc-cleanup-preview' });
		const summary = preview.createDiv({ cls: 'crc-cleanup-preview-summary' });
		summary.textContent = `${orphanIssues.length} orphan reference${orphanIssues.length === 1 ? '' : 's'} will be cleared:`;

		const hint = preview.createDiv({ cls: 'crc-cleanup-preview-hint' });
		hint.textContent = 'Click a row to open the person note for editing.';

		const list = preview.createDiv({ cls: 'crc-cleanup-preview-list' });

		const maxDisplay = 15;
		const displayItems = orphanIssues.slice(0, maxDisplay);
		const remaining = orphanIssues.length - maxDisplay;

		for (const issue of displayItems) {
			const row = list.createDiv({ cls: 'crc-cleanup-preview-row crc-cleanup-preview-row--clickable' });

			const iconEl = row.createDiv({ cls: 'crc-cleanup-preview-icon' });
			setIcon(iconEl, 'unlink');

			const content = row.createDiv({ cls: 'crc-cleanup-preview-content' });

			const personName = content.createSpan({ cls: 'crc-cleanup-preview-person' });
			personName.textContent = issue.person.name || issue.person.file.basename;

			const desc = content.createSpan({ cls: 'crc-cleanup-preview-desc' });
			desc.textContent = `: ${issue.message}`;

			// Click to open the person file
			row.addEventListener('click', () => {
				this.close();
				void this.app.workspace.openLinkText(issue.person.file.path, '', false);
			});
		}

		if (remaining > 0) {
			const moreEl = list.createDiv({ cls: 'crc-cleanup-preview-more' });
			moreEl.textContent = `... and ${remaining} more`;
		}
	}

	/**
	 * Render preview for Step 6: Source Migration
	 */
	private renderSourceMigrationPreview(container: HTMLElement): void {
		if (this.indexedSourceNotes.length === 0) return;

		const preview = container.createDiv({ cls: 'crc-cleanup-preview' });
		const summary = preview.createDiv({ cls: 'crc-cleanup-preview-summary' });
		summary.textContent = `${this.indexedSourceNotes.length} note${this.indexedSourceNotes.length === 1 ? '' : 's'} will be migrated:`;

		const hint = preview.createDiv({ cls: 'crc-cleanup-preview-hint' });
		hint.textContent = 'Indexed properties (source, source_2, source_3...) will be converted to a sources array.';

		const list = preview.createDiv({ cls: 'crc-cleanup-preview-list' });

		const maxDisplay = 15;
		const displayItems = this.indexedSourceNotes.slice(0, maxDisplay);
		const remaining = this.indexedSourceNotes.length - maxDisplay;

		for (const note of displayItems) {
			const row = list.createDiv({ cls: 'crc-cleanup-preview-row crc-cleanup-preview-row--clickable' });

			const iconEl = row.createDiv({ cls: 'crc-cleanup-preview-icon' });
			setIcon(iconEl, 'file-text');

			const content = row.createDiv({ cls: 'crc-cleanup-preview-content' });

			const fileName = content.createSpan({ cls: 'crc-cleanup-preview-person' });
			fileName.textContent = note.file.basename;

			const desc = content.createSpan({ cls: 'crc-cleanup-preview-desc' });
			const sourceCount = note.indexedSources.length;
			desc.textContent = `: ${sourceCount} source${sourceCount === 1 ? '' : 's'} → sources array`;

			// Click to open the file
			row.addEventListener('click', () => {
				this.close();
				void this.app.workspace.openLinkText(note.file.path, '', false);
			});
		}

		if (remaining > 0) {
			const moreEl = list.createDiv({ cls: 'crc-cleanup-preview-more' });
			moreEl.textContent = `... and ${remaining} more`;
		}
	}

	/**
	 * Render preview for Step 10: Nested Properties
	 */
	private renderNestedPropsPreview(container: HTMLElement): void {
		if (!this.qualityReport) return;

		const nestedIssues = this.qualityReport.issues.filter(i => i.category === 'nested_property');
		if (nestedIssues.length === 0) return;

		const preview = container.createDiv({ cls: 'crc-cleanup-preview' });
		const summary = preview.createDiv({ cls: 'crc-cleanup-preview-summary' });
		summary.textContent = `${nestedIssues.length} nested propert${nestedIssues.length === 1 ? 'y' : 'ies'} will be flattened:`;

		const hint = preview.createDiv({ cls: 'crc-cleanup-preview-hint' });
		hint.textContent = 'Click a row to open the person note for editing.';

		const list = preview.createDiv({ cls: 'crc-cleanup-preview-list' });

		const maxDisplay = 15;
		const displayItems = nestedIssues.slice(0, maxDisplay);
		const remaining = nestedIssues.length - maxDisplay;

		for (const issue of displayItems) {
			const row = list.createDiv({ cls: 'crc-cleanup-preview-row crc-cleanup-preview-row--clickable' });

			const iconEl = row.createDiv({ cls: 'crc-cleanup-preview-icon' });
			setIcon(iconEl, 'layers');

			const content = row.createDiv({ cls: 'crc-cleanup-preview-content' });

			const personName = content.createSpan({ cls: 'crc-cleanup-preview-person' });
			personName.textContent = issue.person.name || issue.person.file.basename;

			const propInfo = content.createSpan({ cls: 'crc-cleanup-preview-desc' });
			const propName = issue.details?.['property'] as string || 'unknown';
			const nestedKeys = issue.details?.['nestedKeys'] as string || '';
			propInfo.textContent = `: ${propName} → ${propName}_${nestedKeys.split(', ').join(`, ${propName}_`)}`;

			// Click to open the person file
			row.addEventListener('click', () => {
				this.close();
				void this.app.workspace.openLinkText(issue.person.file.path, '', false);
			});
		}

		if (remaining > 0) {
			const moreEl = list.createDiv({ cls: 'crc-cleanup-preview-more' });
			moreEl.textContent = `... and ${remaining} more`;
		}
	}

	/**
	 * Render preview for Step 11: Event Person Migration
	 */
	private renderEventPersonMigrationPreview(container: HTMLElement): void {
		if (this.legacyPersonEventNotes.length === 0) return;

		const preview = container.createDiv({ cls: 'crc-cleanup-preview' });
		const summary = preview.createDiv({ cls: 'crc-cleanup-preview-summary' });
		summary.textContent = `${this.legacyPersonEventNotes.length} event note${this.legacyPersonEventNotes.length === 1 ? '' : 's'} will be migrated:`;

		const hint = preview.createDiv({ cls: 'crc-cleanup-preview-hint' });
		hint.textContent = 'The singular "person" property will be converted to a "persons" array.';

		const list = preview.createDiv({ cls: 'crc-cleanup-preview-list' });

		const maxDisplay = 15;
		const displayItems = this.legacyPersonEventNotes.slice(0, maxDisplay);
		const remaining = this.legacyPersonEventNotes.length - maxDisplay;

		for (const note of displayItems) {
			const row = list.createDiv({ cls: 'crc-cleanup-preview-row crc-cleanup-preview-row--clickable' });

			const iconEl = row.createDiv({ cls: 'crc-cleanup-preview-icon' });
			setIcon(iconEl, 'calendar');

			const content = row.createDiv({ cls: 'crc-cleanup-preview-content' });

			const fileName = content.createSpan({ cls: 'crc-cleanup-preview-person' });
			fileName.textContent = note.file.basename;

			const desc = content.createSpan({ cls: 'crc-cleanup-preview-desc' });
			const personName = note.personValue.replace(/\[\[|\]\]/g, '');
			desc.textContent = `: person → persons["${personName}"]`;

			// Click to open the file
			row.addEventListener('click', () => {
				this.close();
				void this.app.workspace.openLinkText(note.file.path, '', false);
			});
		}

		if (remaining > 0) {
			const moreEl = list.createDiv({ cls: 'crc-cleanup-preview-more' });
			moreEl.textContent = `... and ${remaining} more`;
		}
	}

	/**
	 * Render preview for Step 12: Sourced Facts Migration
	 */
	private renderSourcedFactsMigrationPreview(container: HTMLElement): void {
		if (this.legacySourcedFactsNotes.length === 0) return;

		const preview = container.createDiv({ cls: 'crc-cleanup-preview' });
		const summary = preview.createDiv({ cls: 'crc-cleanup-preview-summary' });

		// Calculate total sources
		const totalSources = this.legacySourcedFactsNotes.reduce((sum, note) => sum + note.totalSources, 0);

		summary.textContent = `${this.legacySourcedFactsNotes.length} person note${this.legacySourcedFactsNotes.length === 1 ? '' : 's'} with ${totalSources} source citation${totalSources === 1 ? '' : 's'} will be migrated:`;

		const hint = preview.createDiv({ cls: 'crc-cleanup-preview-hint' });
		hint.textContent = 'The nested "sourced_facts" object will be converted to flat "sourced_*" properties.';

		const list = preview.createDiv({ cls: 'crc-cleanup-preview-list' });

		const maxDisplay = 15;
		const displayItems = this.legacySourcedFactsNotes.slice(0, maxDisplay);
		const remaining = this.legacySourcedFactsNotes.length - maxDisplay;

		for (const note of displayItems) {
			const row = list.createDiv({ cls: 'crc-cleanup-preview-row crc-cleanup-preview-row--clickable' });

			const iconEl = row.createDiv({ cls: 'crc-cleanup-preview-icon' });
			setIcon(iconEl, 'user');

			const content = row.createDiv({ cls: 'crc-cleanup-preview-content' });

			const fileName = content.createSpan({ cls: 'crc-cleanup-preview-person' });
			fileName.textContent = note.file.basename;

			const desc = content.createSpan({ cls: 'crc-cleanup-preview-desc' });
			desc.textContent = `: ${note.factKeys.length} fact type${note.factKeys.length === 1 ? '' : 's'}, ${note.totalSources} source${note.totalSources === 1 ? '' : 's'}`;

			// Click to open the file
			row.addEventListener('click', () => {
				this.close();
				void this.app.workspace.openLinkText(note.file.path, '', false);
			});
		}

		if (remaining > 0) {
			const moreEl = list.createDiv({ cls: 'crc-cleanup-preview-more' });
			moreEl.textContent = `... and ${remaining} more`;
		}
	}

	/**
	 * Render preview for Step 13: Life Events Migration
	 */
	private renderLifeEventsMigrationPreview(container: HTMLElement): void {
		if (this.legacyEventsNotes.length === 0) return;

		const preview = container.createDiv({ cls: 'crc-cleanup-preview' });
		const summary = preview.createDiv({ cls: 'crc-cleanup-preview-summary' });

		// Calculate total events
		const totalEvents = this.legacyEventsNotes.reduce((sum, note) => sum + note.eventCount, 0);

		summary.textContent = `${this.legacyEventsNotes.length} person note${this.legacyEventsNotes.length === 1 ? '' : 's'} with ${totalEvents} inline event${totalEvents === 1 ? '' : 's'} will be migrated:`;

		const hint = preview.createDiv({ cls: 'crc-cleanup-preview-hint' });
		hint.textContent = 'Inline events will be converted to separate event note files linked via "life_events".';

		const list = preview.createDiv({ cls: 'crc-cleanup-preview-list' });

		const maxDisplay = 15;
		const displayItems = this.legacyEventsNotes.slice(0, maxDisplay);
		const remaining = this.legacyEventsNotes.length - maxDisplay;

		for (const note of displayItems) {
			const row = list.createDiv({ cls: 'crc-cleanup-preview-row crc-cleanup-preview-row--clickable' });

			const iconEl = row.createDiv({ cls: 'crc-cleanup-preview-icon' });
			setIcon(iconEl, 'user');

			const content = row.createDiv({ cls: 'crc-cleanup-preview-content' });

			const fileName = content.createSpan({ cls: 'crc-cleanup-preview-person' });
			fileName.textContent = note.personName;

			const desc = content.createSpan({ cls: 'crc-cleanup-preview-desc' });
			const eventTypes = [...new Set(note.events.map(e => e.event_type))];
			desc.textContent = `: ${note.eventCount} event${note.eventCount === 1 ? '' : 's'} (${eventTypes.join(', ')})`;

			// Click to open the file
			row.addEventListener('click', () => {
				this.close();
				void this.app.workspace.openLinkText(note.file.path, '', false);
			});
		}

		if (remaining > 0) {
			const moreEl = list.createDiv({ cls: 'crc-cleanup-preview-more' });
			moreEl.textContent = `... and ${remaining} more`;
		}
	}

	/**
	 * Render preview for Step 14: Child→Children Migration
	 */
	private renderChildToChildrenPreview(container: HTMLElement): void {
		if (this.legacyChildNotes.length === 0) return;

		const preview = container.createDiv({ cls: 'crc-cleanup-preview' });
		const summary = preview.createDiv({ cls: 'crc-cleanup-preview-summary' });
		summary.textContent = `${this.legacyChildNotes.length} person note${this.legacyChildNotes.length === 1 ? '' : 's'} will be updated:`;

		const hint = preview.createDiv({ cls: 'crc-cleanup-preview-hint' });
		hint.textContent = 'The legacy "child" property will be converted to the "children" property.';

		const list = preview.createDiv({ cls: 'crc-cleanup-preview-list' });

		const maxDisplay = 15;
		const displayItems = this.legacyChildNotes.slice(0, maxDisplay);
		const remaining = this.legacyChildNotes.length - maxDisplay;

		for (const file of displayItems) {
			const row = list.createDiv({ cls: 'crc-cleanup-preview-row crc-cleanup-preview-row--clickable' });

			const iconEl = row.createDiv({ cls: 'crc-cleanup-preview-icon' });
			setIcon(iconEl, 'user');

			const content = row.createDiv({ cls: 'crc-cleanup-preview-content' });

			const fileName = content.createSpan({ cls: 'crc-cleanup-preview-person' });
			fileName.textContent = file.basename;

			const desc = content.createSpan({ cls: 'crc-cleanup-preview-desc' });
			desc.textContent = ': child → children';

			// Click to open the file
			row.addEventListener('click', () => {
				this.close();
				void this.app.workspace.openLinkText(file.path, '', false);
			});
		}

		if (remaining > 0) {
			const moreEl = list.createDiv({ cls: 'crc-cleanup-preview-more' });
			moreEl.textContent = `... and ${remaining} more`;
		}
	}

	/**
	 * Render generic preview for steps without specific implementation
	 */
	private renderGenericPreview(
		container: HTMLElement,
		stepConfig: WizardStepConfig,
		stepState: StepState
	): void {
		const preview = container.createDiv({ cls: 'crc-cleanup-preview' });

		if (stepState.issueCount > 0) {
			const summary = preview.createDiv({ cls: 'crc-cleanup-preview-summary' });
			summary.textContent = `${stepState.issueCount} ${stepState.issueCount === 1 ? 'item' : 'items'} will be fixed.`;

			const note = preview.createDiv({ cls: 'crc-cleanup-note' });
			const noteIcon = note.createDiv({ cls: 'crc-cleanup-note-icon' });
			setIcon(noteIcon, 'info');
			note.createSpan({ text: `Detailed preview for ${stepConfig.title} coming in a future update.` });
		}
	}

	/**
	 * Render an interactive step (Steps 7-9)
	 */
	private renderInteractiveStep(
		container: HTMLElement,
		stepConfig: WizardStepConfig,
		stepState: StepState
	): void {
		if (stepState.status === 'complete') {
			const complete = container.createDiv({ cls: 'crc-cleanup-step-complete' });
			const icon = complete.createDiv({ cls: 'crc-cleanup-step-complete-icon' });
			setIcon(icon, 'check-circle');
			complete.createDiv({ cls: 'crc-cleanup-step-complete-text', text: 'Step complete!' });
			if (stepState.fixCount > 0) {
				complete.createDiv({ cls: 'crc-cleanup-step-complete-count', text: `${stepState.fixCount} items processed` });
			}
			return;
		}

		// Route to step-specific rendering
		switch (stepConfig.id) {
			case 'place-variants':
				this.renderPlaceVariantsStep(container, stepState);
				break;
			case 'geocode':
				this.renderGeocodeStep(container, stepState);
				break;
			case 'place-hierarchy':
				this.renderHierarchyStep(container, stepState);
				break;
			default:
				// Placeholder for unimplemented interactive steps
				this.renderInteractiveStepPlaceholder(container, stepConfig);
		}
	}

	/**
	 * Render placeholder for unimplemented interactive steps
	 */
	private renderInteractiveStepPlaceholder(container: HTMLElement, stepConfig: WizardStepConfig): void {
		const interactive = container.createDiv({ cls: 'crc-cleanup-interactive' });
		const placeholder = interactive.createDiv({ cls: 'crc-cleanup-placeholder' });
		placeholder.textContent = `Interactive UI for ${stepConfig.title} will be implemented in Phase 2.`;

		// Note about interactive steps
		const note = interactive.createDiv({ cls: 'crc-cleanup-note' });
		const noteIcon = note.createDiv({ cls: 'crc-cleanup-note-icon' });
		setIcon(noteIcon, 'info');
		note.createSpan({ text: 'This step requires manual decisions for each item. You can skip it for now and run it individually later.' });
	}

	/**
	 * Render Step 7: Place Variants interactive UI
	 */
	private renderPlaceVariantsStep(container: HTMLElement, stepState: StepState): void {
		// Check if we should show deduplication step (after variants are fixed)
		if (this.showDeduplicationStep) {
			this.renderPlaceDeduplicationStep(container, stepState);
			return;
		}

		if (this.placeVariantMatches.length === 0 && this.state.preScanComplete) {
			// No variants found - check for duplicates instead
			this.placeDuplicateGroups = findDuplicatePlaceNotes(this.app);
			if (this.placeDuplicateGroups.length > 0) {
				this.showDeduplicationStep = true;
				this.renderPlaceDeduplicationStep(container, stepState);
				return;
			}

			const noIssues = container.createDiv({ cls: 'crc-cleanup-no-issues' });
			const icon = noIssues.createDiv({ cls: 'crc-cleanup-no-issues-icon' });
			setIcon(icon, 'check-circle');
			noIssues.createDiv({ cls: 'crc-cleanup-no-issues-text', text: 'No place name variants found!' });
			noIssues.createDiv({ cls: 'crc-cleanup-no-issues-hint', text: 'Your place names are already standardized. You can skip to the next step.' });
			return;
		}

		const preview = container.createDiv({ cls: 'crc-cleanup-preview' });

		// Summary
		const totalRefs = this.placeVariantMatches.reduce((sum, m) => sum + m.count, 0);
		const summary = preview.createDiv({ cls: 'crc-cleanup-preview-summary' });
		summary.textContent = `Found ${this.placeVariantMatches.length} place name variant${this.placeVariantMatches.length === 1 ? '' : 's'} across ${totalRefs} reference${totalRefs === 1 ? '' : 's'}.`;

		const hint = preview.createDiv({ cls: 'crc-cleanup-preview-hint' });
		hint.textContent = 'Select variants to standardize. The canonical form is shown on the right.';

		// Table container
		const tableContainer = preview.createDiv({ cls: 'crc-cleanup-variant-table-container' });
		const table = tableContainer.createEl('table', { cls: 'crc-cleanup-variant-table' });

		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		const thCheck = headerRow.createEl('th', { cls: 'crc-cleanup-variant-th-check' });

		// Select all checkbox
		const selectAllCheckbox = thCheck.createEl('input', { type: 'checkbox' });
		selectAllCheckbox.checked = true;

		headerRow.createEl('th', { text: 'Current Value' });
		headerRow.createEl('th', { text: 'Standardize To' });
		headerRow.createEl('th', { text: 'Refs', cls: 'crc-cleanup-variant-th-count' });

		const tbody = table.createEl('tbody');

		// Track selected variants
		const selectedVariants = new Set<PlaceVariantMatch>(this.placeVariantMatches);
		const canonicalOverrides = new Map<PlaceVariantMatch, string>();

		// Render each variant row
		for (const match of this.placeVariantMatches) {
			const row = tbody.createEl('tr', { cls: 'crc-cleanup-variant-row' });

			// Checkbox
			const tdCheck = row.createEl('td', { cls: 'crc-cleanup-variant-td-check' });
			const checkbox = tdCheck.createEl('input', { type: 'checkbox' });
			checkbox.checked = true;
			checkbox.addEventListener('change', () => {
				if (checkbox.checked) {
					selectedVariants.add(match);
				} else {
					selectedVariants.delete(match);
				}
				updateSelectAllCheckbox();
			});

			// Current value (strikethrough when selected)
			const tdCurrent = row.createEl('td', { cls: 'crc-cleanup-variant-current' });
			const currentSpan = tdCurrent.createEl('span', { text: match.variant });
			if (selectedVariants.has(match)) {
				currentSpan.addClass('crc-cleanup-variant-strike');
			}

			// Update strikethrough on checkbox change
			checkbox.addEventListener('change', () => {
				currentSpan.toggleClass('crc-cleanup-variant-strike', checkbox.checked);
			});

			// Canonical dropdown
			const tdCanonical = row.createEl('td', { cls: 'crc-cleanup-variant-canonical' });
			const select = tdCanonical.createEl('select', { cls: 'dropdown crc-cleanup-variant-select' });

			// Default canonical option
			select.createEl('option', { value: match.canonical, text: match.canonical });

			// Keep as-is option
			if (match.variant !== match.canonical) {
				select.createEl('option', { value: match.variant, text: `${match.variant} (keep)` });
			}

			select.addEventListener('change', () => {
				if (select.value === match.canonical) {
					canonicalOverrides.delete(match);
				} else {
					canonicalOverrides.set(match, select.value);
				}
			});

			// Reference count
			const tdCount = row.createEl('td', { cls: 'crc-cleanup-variant-count' });
			tdCount.textContent = String(match.count);
		}

		// Update select all checkbox state
		const updateSelectAllCheckbox = () => {
			selectAllCheckbox.checked = selectedVariants.size === this.placeVariantMatches.length;
			selectAllCheckbox.indeterminate = selectedVariants.size > 0 && selectedVariants.size < this.placeVariantMatches.length;
		};

		// Select all handler
		selectAllCheckbox.addEventListener('change', () => {
			const checkboxes = tbody.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
			checkboxes.forEach((cb, idx) => {
				cb.checked = selectAllCheckbox.checked;
				const match = this.placeVariantMatches[idx];
				if (selectAllCheckbox.checked) {
					selectedVariants.add(match);
				} else {
					selectedVariants.delete(match);
				}
			});
			// Update strikethrough for all rows
			const currentSpans = tbody.querySelectorAll('.crc-cleanup-variant-current span');
			currentSpans.forEach(span => {
				span.toggleClass('crc-cleanup-variant-strike', selectAllCheckbox.checked);
			});
		});

		// Apply button (in addition to footer)
		const applyContainer = preview.createDiv({ cls: 'crc-cleanup-variant-apply' });
		const applyBtn = applyContainer.createEl('button', {
			cls: 'crc-btn crc-btn--primary'
		});
		const applyIcon = applyBtn.createSpan({ cls: 'crc-btn-icon' });
		setIcon(applyIcon, 'zap');
		applyBtn.createSpan({ text: `Standardize ${selectedVariants.size} variants` });

		// Update button text when selection changes
		const updateApplyButton = () => {
			const textSpan = applyBtn.querySelector('span:last-child');
			if (textSpan) {
				textSpan.textContent = `Standardize ${selectedVariants.size} variant${selectedVariants.size === 1 ? '' : 's'}`;
			}
			applyBtn.disabled = selectedVariants.size === 0;
		};

		// Attach selection change listener
		tbody.addEventListener('change', updateApplyButton);

		applyBtn.addEventListener('click', () => {
			void this.applyPlaceVariantFixes(selectedVariants, canonicalOverrides, stepState);
		});
	}

	/**
	 * Apply place variant fixes
	 */
	private async applyPlaceVariantFixes(
		selectedVariants: Set<PlaceVariantMatch>,
		canonicalOverrides: Map<PlaceVariantMatch, string>,
		stepState: StepState
	): Promise<void> {
		stepState.status = 'in_progress';
		this.renderCurrentView();

		let totalUpdated = 0;
		const errors: string[] = [];

		for (const match of selectedVariants) {
			const targetCanonical = canonicalOverrides.get(match) || match.canonical;

			// Skip if keeping as-is
			if (targetCanonical === match.variant) continue;

			try {
				const updated = await this.updatePlaceReferences(match.variant, targetCanonical, match.files);
				totalUpdated += updated;
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				errors.push(`${match.variant}: ${message}`);
			}
		}

		stepState.fixCount = totalUpdated;

		if (errors.length > 0) {
			console.error('Errors during variant standardization:', errors);
			new Notice(`Updated ${totalUpdated} references. ${errors.length} errors occurred.`);
		} else if (totalUpdated > 0) {
			new Notice(`Standardized ${totalUpdated} place reference${totalUpdated !== 1 ? 's' : ''}`);
		} else {
			new Notice('No changes were needed');
		}

		// Check for duplicates after variant standardization
		this.placeDuplicateGroups = findDuplicatePlaceNotes(this.app);
		if (this.placeDuplicateGroups.length > 0) {
			// Show deduplication step instead of marking complete
			this.showDeduplicationStep = true;
			stepState.status = 'in_progress'; // Keep in progress for deduplication
			new Notice(`Found ${this.placeDuplicateGroups.length} duplicate place${this.placeDuplicateGroups.length !== 1 ? 's' : ''} to merge`);
		} else {
			stepState.status = 'complete';
			this.recordStepCompletion('place-variants', stepState.fixCount);
		}

		this.renderCurrentView();
	}

	/**
	 * Render Step 7b: Place Deduplication UI
	 */
	private renderPlaceDeduplicationStep(container: HTMLElement, stepState: StepState): void {
		if (this.placeDuplicateGroups.length === 0) {
			// No duplicates - step is complete
			stepState.status = 'complete';
			// Record both place-variants and place-dedup as complete
			this.recordStepCompletion('place-variants', stepState.fixCount);
			this.recordStepCompletion('place-dedup', 0);
			const complete = container.createDiv({ cls: 'crc-cleanup-step-complete' });
			const icon = complete.createDiv({ cls: 'crc-cleanup-step-complete-icon' });
			setIcon(icon, 'check-circle');
			complete.createDiv({ cls: 'crc-cleanup-step-complete-text', text: 'Place cleanup complete!' });
			if (stepState.fixCount > 0) {
				complete.createDiv({ cls: 'crc-cleanup-step-complete-count', text: `${stepState.fixCount} items processed` });
			}
			return;
		}

		const preview = container.createDiv({ cls: 'crc-cleanup-preview' });

		// Summary
		const totalDupes = this.placeDuplicateGroups.reduce((sum, g) => sum + g.files.length - 1, 0);
		const summary = preview.createDiv({ cls: 'crc-cleanup-preview-summary' });
		summary.textContent = `Found ${this.placeDuplicateGroups.length} place${this.placeDuplicateGroups.length === 1 ? '' : 's'} with duplicates (${totalDupes} duplicate file${totalDupes === 1 ? '' : 's'} to merge).`;

		const hint = preview.createDiv({ cls: 'crc-cleanup-preview-hint' });
		hint.textContent = 'Select which file to keep as canonical for each place. Duplicates will be merged and deleted.';

		// Table container
		const tableContainer = preview.createDiv({ cls: 'crc-cleanup-dedup-table-container' });
		const table = tableContainer.createEl('table', { cls: 'crc-cleanup-dedup-table' });

		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Place Name' });
		headerRow.createEl('th', { text: 'Files', cls: 'crc-cleanup-dedup-th-files' });
		headerRow.createEl('th', { text: 'Keep', cls: 'crc-cleanup-dedup-th-keep' });

		const tbody = table.createEl('tbody');

		// Track selected canonical files for each group
		const canonicalSelections = new Map<PlaceDuplicateGroup, import('obsidian').TFile>();

		// Initialize with recommended canonicals
		for (const group of this.placeDuplicateGroups) {
			canonicalSelections.set(group, group.recommendedCanonical);
		}

		// Render each duplicate group
		for (const group of this.placeDuplicateGroups) {
			const row = tbody.createEl('tr', { cls: 'crc-cleanup-dedup-row' });

			// Place name
			const tdName = row.createEl('td', { cls: 'crc-cleanup-dedup-name' });
			tdName.textContent = group.fullName;

			// Files list
			const tdFiles = row.createEl('td', { cls: 'crc-cleanup-dedup-files' });
			const fileList = tdFiles.createDiv({ cls: 'crc-cleanup-dedup-file-list' });

			for (const file of group.files) {
				const fileItem = fileList.createDiv({ cls: 'crc-cleanup-dedup-file-item' });
				const fileName = fileItem.createSpan({ cls: 'crc-cleanup-dedup-file-name' });
				fileName.textContent = file.basename;

				const refCount = group.refCounts.get(file) || 0;
				const refBadge = fileItem.createSpan({ cls: 'crc-cleanup-dedup-ref-badge' });
				refBadge.textContent = `${refCount} ref${refCount === 1 ? '' : 's'}`;

				if (file === group.recommendedCanonical) {
					const recBadge = fileItem.createSpan({ cls: 'crc-cleanup-dedup-rec-badge' });
					recBadge.textContent = 'recommended';
				}
			}

			// Canonical selector
			const tdKeep = row.createEl('td', { cls: 'crc-cleanup-dedup-keep' });
			const select = tdKeep.createEl('select', { cls: 'dropdown crc-cleanup-dedup-select' });

			for (const file of group.files) {
				const refCount = group.refCounts.get(file) || 0;
				const option = select.createEl('option', {
					value: file.path,
					text: `${file.basename} (${refCount} refs)`
				});
				if (file === group.recommendedCanonical) {
					option.selected = true;
				}
			}

			select.addEventListener('change', () => {
				const selectedFile = group.files.find(f => f.path === select.value);
				if (selectedFile) {
					canonicalSelections.set(group, selectedFile);
				}
			});
		}

		// Warning
		const warning = preview.createDiv({ cls: 'crc-cleanup-warning' });
		const warningIcon = warning.createDiv({ cls: 'crc-cleanup-warning-icon' });
		setIcon(warningIcon, 'alert-triangle');
		warning.createSpan({ text: 'Duplicate files will be moved to trash. All references will be updated to point to the canonical file.' });

		// Apply button
		const applyContainer = preview.createDiv({ cls: 'crc-cleanup-dedup-apply' });
		const applyBtn = applyContainer.createEl('button', {
			cls: 'crc-btn crc-btn--primary'
		});
		const applyIcon = applyBtn.createSpan({ cls: 'crc-btn-icon' });
		setIcon(applyIcon, 'git-merge');
		applyBtn.createSpan({ text: `Merge ${this.placeDuplicateGroups.length} duplicate group${this.placeDuplicateGroups.length === 1 ? '' : 's'}` });

		applyBtn.addEventListener('click', () => {
			void this.applyPlaceDeduplication(canonicalSelections, stepState);
		});

		// Skip button
		const skipBtn = applyContainer.createEl('button', {
			cls: 'crc-btn crc-btn--secondary',
			text: 'Skip Deduplication'
		});
		skipBtn.addEventListener('click', () => {
			this.showDeduplicationStep = false;
			stepState.status = 'complete';
			// Record completion (skipped dedup still counts as variants completed)
			this.recordStepCompletion('place-variants', stepState.fixCount);
			this.renderCurrentView();
		});
	}

	/**
	 * Apply place deduplication
	 */
	private async applyPlaceDeduplication(
		canonicalSelections: Map<PlaceDuplicateGroup, import('obsidian').TFile>,
		stepState: StepState
	): Promise<void> {
		let totalUpdatedLinks = 0;
		let totalDeletedFiles = 0;
		const errors: string[] = [];

		for (const [group, canonicalFile] of canonicalSelections.entries()) {
			try {
				const result = await mergeDuplicatePlaces(this.app, group, canonicalFile);
				totalUpdatedLinks += result.updatedLinks;
				totalDeletedFiles += result.deletedFiles;
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				errors.push(`${group.fullName}: ${message}`);
			}
		}

		// Update step state
		stepState.fixCount += totalDeletedFiles;
		stepState.status = 'complete';
		this.showDeduplicationStep = false;
		this.placeDuplicateGroups = [];

		// Record completion for both variants and dedup
		this.recordStepCompletion('place-variants', stepState.fixCount);
		this.recordStepCompletion('place-dedup', totalDeletedFiles);

		if (errors.length > 0) {
			console.error('Errors during deduplication:', errors);
			new Notice(`Merged ${totalDeletedFiles} duplicates, updated ${totalUpdatedLinks} links. ${errors.length} errors.`);
		} else {
			new Notice(`Merged ${totalDeletedFiles} duplicate${totalDeletedFiles !== 1 ? 's' : ''}, updated ${totalUpdatedLinks} link${totalUpdatedLinks !== 1 ? 's' : ''}`);
		}

		this.renderCurrentView();
	}

	/**
	 * Render Step 8: Bulk Geocode interactive UI
	 */
	private renderGeocodeStep(container: HTMLElement, stepState: StepState): void {
		// If geocoding is in progress, show progress view
		if (this.isGeocoding) {
			this.renderGeocodeProgress(container, stepState);
			return;
		}

		// If we have results from a completed run, show results
		if (this.geocodingResults.length > 0) {
			this.renderGeocodeResults(container, stepState);
			return;
		}

		// Check for unmet dependencies and show warning
		const stepConfig = WIZARD_STEPS.find(s => s.id === 'geocode');
		if (stepConfig) {
			const unmetDeps = this.getUnmetDependencies(stepConfig);
			if (unmetDeps.length > 0) {
				this.renderDependencyWarning(container, unmetDeps);
			}
		}

		// Check for ungeocoded places
		if (this.ungeocodedPlaces.length === 0 && this.state.preScanComplete) {
			const noIssues = container.createDiv({ cls: 'crc-cleanup-no-issues' });
			const icon = noIssues.createDiv({ cls: 'crc-cleanup-no-issues-icon' });
			setIcon(icon, 'check-circle');
			noIssues.createDiv({ cls: 'crc-cleanup-no-issues-text', text: 'All places have coordinates!' });
			noIssues.createDiv({ cls: 'crc-cleanup-no-issues-hint', text: 'Your place notes already have geographic coordinates. You can skip to the next step.' });
			return;
		}

		const preview = container.createDiv({ cls: 'crc-cleanup-preview' });

		// Summary
		const summary = preview.createDiv({ cls: 'crc-cleanup-preview-summary' });
		summary.textContent = `Found ${this.ungeocodedPlaces.length} place${this.ungeocodedPlaces.length === 1 ? '' : 's'} without coordinates.`;

		// Description
		const desc = preview.createDiv({ cls: 'crc-cleanup-preview-hint' });
		desc.textContent = 'This will use OpenStreetMap\'s Nominatim service to look up coordinates. The process respects the API rate limit (1 request per second).';

		// Estimated time
		const estimatedMinutes = Math.ceil(this.ungeocodedPlaces.length / 60);
		const timeText = estimatedMinutes === 1 ? 'about 1 minute' : `about ${estimatedMinutes} minutes`;
		const timeEstimate = preview.createDiv({ cls: 'crc-cleanup-geocode-time' });
		const timeIcon = timeEstimate.createSpan({ cls: 'crc-cleanup-geocode-time-icon' });
		setIcon(timeIcon, 'clock');
		timeEstimate.createSpan({ text: `Estimated time: ${timeText}` });

		// Places list preview
		const listContainer = preview.createDiv({ cls: 'crc-cleanup-geocode-list-container' });
		const listTitle = listContainer.createDiv({ cls: 'crc-cleanup-geocode-list-title' });
		listTitle.textContent = 'Places to geocode:';

		const placesList = listContainer.createDiv({ cls: 'crc-cleanup-geocode-list' });
		const maxDisplay = 20;
		const displayPlaces = this.ungeocodedPlaces.slice(0, maxDisplay);

		for (const place of displayPlaces) {
			const item = placesList.createDiv({ cls: 'crc-cleanup-geocode-list-item' });
			const iconEl = item.createSpan({ cls: 'crc-cleanup-geocode-list-icon' });
			setIcon(iconEl, 'map-pin');
			item.createSpan({ text: place.name, cls: 'crc-cleanup-geocode-list-name' });
		}

		if (this.ungeocodedPlaces.length > maxDisplay) {
			const moreEl = placesList.createDiv({ cls: 'crc-cleanup-geocode-list-more' });
			moreEl.textContent = `... and ${this.ungeocodedPlaces.length - maxDisplay} more`;
		}

		// Warning
		const warning = preview.createDiv({ cls: 'crc-cleanup-warning' });
		const warningIcon = warning.createDiv({ cls: 'crc-cleanup-warning-icon' });
		setIcon(warningIcon, 'alert-triangle');
		warning.createSpan({ text: 'Backup your vault before proceeding. This operation will modify place notes to add coordinates.' });

		// Start button
		const applyContainer = preview.createDiv({ cls: 'crc-cleanup-geocode-apply' });
		const startBtn = applyContainer.createEl('button', {
			cls: 'crc-btn crc-btn--primary'
		});
		const startIcon = startBtn.createSpan({ cls: 'crc-btn-icon' });
		setIcon(startIcon, 'map');
		startBtn.createSpan({ text: `Start geocoding ${this.ungeocodedPlaces.length} places` });

		startBtn.addEventListener('click', () => {
			void this.startGeocoding(stepState);
		});
	}

	/**
	 * Render geocoding progress view
	 */
	private renderGeocodeProgress(container: HTMLElement, stepState: StepState): void {
		const progress = container.createDiv({ cls: 'crc-cleanup-geocode-progress' });

		// Progress header
		const header = progress.createDiv({ cls: 'crc-cleanup-geocode-progress-header' });
		header.createSpan({ text: 'Geocoding in progress...', cls: 'crc-cleanup-geocode-progress-title' });

		// Progress stats
		const stats = progress.createDiv({ cls: 'crc-cleanup-geocode-progress-stats' });
		const processed = this.geocodingResults.length;
		const total = this.ungeocodedPlaces.length;
		const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

		const successCount = this.geocodingResults.filter(r => r.success && r.coordinates).length;
		const failedCount = this.geocodingResults.filter(r => !r.success || !r.coordinates).length;

		stats.createSpan({ text: `${processed} of ${total} (${percent}%)` });

		// Progress bar
		const progressBarContainer = progress.createDiv({ cls: 'crc-cleanup-geocode-progress-bar-container' });
		const progressBar = progressBarContainer.createDiv({ cls: 'crc-cleanup-geocode-progress-bar' });
		progressBar.style.width = `${percent}%`;

		// Stats breakdown
		const breakdown = progress.createDiv({ cls: 'crc-cleanup-geocode-progress-breakdown' });

		const successStat = breakdown.createSpan({ cls: 'crc-cleanup-geocode-stat crc-cleanup-geocode-stat--success' });
		const successIcon = successStat.createSpan({ cls: 'crc-cleanup-geocode-stat-icon' });
		setIcon(successIcon, 'check');
		successStat.createSpan({ text: `${successCount} found` });

		const failedStat = breakdown.createSpan({ cls: 'crc-cleanup-geocode-stat crc-cleanup-geocode-stat--failed' });
		const failedIcon = failedStat.createSpan({ cls: 'crc-cleanup-geocode-stat-icon' });
		setIcon(failedIcon, 'x');
		failedStat.createSpan({ text: `${failedCount} not found` });

		// Results list (live updating)
		const resultsList = progress.createDiv({ cls: 'crc-cleanup-geocode-results-list' });

		// Show last 10 results
		const recentResults = this.geocodingResults.slice(-10);
		for (const result of recentResults) {
			const item = resultsList.createDiv({ cls: 'crc-cleanup-geocode-result-item' });

			const icon = item.createSpan({ cls: 'crc-cleanup-geocode-result-icon' });
			if (result.success && result.coordinates) {
				setIcon(icon, 'check');
				icon.addClass('crc-cleanup-geocode-result-icon--success');
			} else {
				setIcon(icon, 'x');
				icon.addClass('crc-cleanup-geocode-result-icon--failed');
			}

			const name = item.createSpan({ cls: 'crc-cleanup-geocode-result-name' });
			name.textContent = result.placeName;

			if (result.success && result.coordinates) {
				const coords = item.createSpan({ cls: 'crc-cleanup-geocode-result-coords' });
				coords.textContent = `(${result.coordinates.lat.toFixed(4)}, ${result.coordinates.long.toFixed(4)})`;
			} else if (result.error) {
				const error = item.createSpan({ cls: 'crc-cleanup-geocode-result-error' });
				error.textContent = result.error;
			}
		}

		// Cancel button
		const cancelContainer = progress.createDiv({ cls: 'crc-cleanup-geocode-cancel' });
		const cancelBtn = cancelContainer.createEl('button', {
			cls: 'crc-btn crc-btn--secondary'
		});
		cancelBtn.textContent = this.geocodingCancelled ? 'Cancelling...' : 'Cancel';
		cancelBtn.disabled = this.geocodingCancelled;

		cancelBtn.addEventListener('click', () => {
			this.geocodingCancelled = true;
			cancelBtn.textContent = 'Cancelling...';
			cancelBtn.disabled = true;
		});
	}

	/**
	 * Render geocoding results view
	 */
	private renderGeocodeResults(container: HTMLElement, stepState: StepState): void {
		const results = container.createDiv({ cls: 'crc-cleanup-geocode-results' });

		// Summary
		const successCount = this.geocodingResults.filter(r => r.success && r.coordinates).length;
		const failedCount = this.geocodingResults.filter(r => !r.success || !r.coordinates).length;

		const summary = results.createDiv({ cls: 'crc-cleanup-geocode-results-summary' });

		const successSummary = summary.createDiv({ cls: 'crc-cleanup-geocode-summary-stat crc-cleanup-geocode-summary-stat--success' });
		const successIcon = successSummary.createDiv({ cls: 'crc-cleanup-geocode-summary-icon' });
		setIcon(successIcon, 'check-circle');
		successSummary.createDiv({ cls: 'crc-cleanup-geocode-summary-value', text: String(successCount) });
		successSummary.createDiv({ cls: 'crc-cleanup-geocode-summary-label', text: 'Coordinates found' });

		const failedSummary = summary.createDiv({ cls: 'crc-cleanup-geocode-summary-stat crc-cleanup-geocode-summary-stat--failed' });
		const failedIcon = failedSummary.createDiv({ cls: 'crc-cleanup-geocode-summary-icon' });
		setIcon(failedIcon, 'x-circle');
		failedSummary.createDiv({ cls: 'crc-cleanup-geocode-summary-value', text: String(failedCount) });
		failedSummary.createDiv({ cls: 'crc-cleanup-geocode-summary-label', text: 'Not found' });

		// Results table
		const tableContainer = results.createDiv({ cls: 'crc-cleanup-geocode-table-container' });
		const table = tableContainer.createEl('table', { cls: 'crc-cleanup-geocode-table' });

		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: '', cls: 'crc-cleanup-geocode-th-status' });
		headerRow.createEl('th', { text: 'Place' });
		headerRow.createEl('th', { text: 'Result' });

		const tbody = table.createEl('tbody');

		// Show all results (with scroll)
		for (const result of this.geocodingResults) {
			const row = tbody.createEl('tr', { cls: 'crc-cleanup-geocode-row' });

			// Status icon
			const tdStatus = row.createEl('td', { cls: 'crc-cleanup-geocode-td-status' });
			const statusIcon = tdStatus.createSpan();
			if (result.success && result.coordinates) {
				setIcon(statusIcon, 'check');
				statusIcon.addClass('crc-cleanup-geocode-status--success');
			} else {
				setIcon(statusIcon, 'x');
				statusIcon.addClass('crc-cleanup-geocode-status--failed');
			}

			// Place name
			row.createEl('td', { text: result.placeName, cls: 'crc-cleanup-geocode-td-name' });

			// Result
			const tdResult = row.createEl('td', { cls: 'crc-cleanup-geocode-td-result' });
			if (result.success && result.coordinates) {
				tdResult.textContent = `${result.coordinates.lat.toFixed(4)}, ${result.coordinates.long.toFixed(4)}`;
				tdResult.addClass('crc-cleanup-geocode-result--coords');
			} else {
				tdResult.textContent = result.error || 'Not found';
				tdResult.addClass('crc-cleanup-geocode-result--error');
			}
		}

		// Show failed places if any
		if (failedCount > 0) {
			const failedNote = results.createDiv({ cls: 'crc-cleanup-geocode-failed-note' });
			const noteIcon = failedNote.createSpan({ cls: 'crc-cleanup-geocode-failed-note-icon' });
			setIcon(noteIcon, 'info');
			failedNote.createSpan({ text: 'Places not found may have unusual names or be too specific. You can try geocoding them manually.' });
		}

		// Update step state
		stepState.status = 'complete';
		stepState.fixCount = successCount;
		this.recordStepCompletion('geocode', successCount);

		// Done button
		const doneContainer = results.createDiv({ cls: 'crc-cleanup-geocode-done' });
		const doneBtn = doneContainer.createEl('button', {
			cls: 'crc-btn crc-btn--primary'
		});
		const doneIcon = doneBtn.createSpan({ cls: 'crc-btn-icon' });
		setIcon(doneIcon, 'check');
		doneBtn.createSpan({ text: 'Done' });

		doneBtn.addEventListener('click', () => {
			// Clear results and re-render
			this.geocodingResults = [];
			this.renderCurrentView();
		});
	}

	/**
	 * Start the geocoding process
	 */
	private async startGeocoding(stepState: StepState): Promise<void> {
		if (this.isGeocoding) return;

		this.isGeocoding = true;
		this.geocodingCancelled = false;
		this.geocodingResults = [];
		stepState.status = 'in_progress';
		this.renderCurrentView();

		const geocodingService = this.getGeocodingService();
		const placeGraph = this.plugin.createPlaceGraphService();

		for (let i = 0; i < this.ungeocodedPlaces.length; i++) {
			// Check for cancellation
			if (this.geocodingCancelled) {
				logger.info('startGeocoding', `Geocoding cancelled at ${i} of ${this.ungeocodedPlaces.length}`);
				break;
			}

			const place = this.ungeocodedPlaces[i];

			// Get parent place name for more accurate lookup
			let parentName: string | undefined;
			if (place.parentId) {
				const parentPlace = placeGraph.getPlaceByCrId(place.parentId);
				parentName = parentPlace?.name;
			}

			// Geocode the place
			const result = await geocodingService.geocodeSingle(place.name, parentName);
			this.geocodingResults.push(result);

			// Update the file if successful
			if (result.success && result.coordinates) {
				const file = this.app.vault.getAbstractFileByPath(place.filePath);
				if (file instanceof TFile) {
					try {
						await geocodingService.updatePlaceCoordinates(file, result.coordinates);
					} catch (error) {
						logger.warn('startGeocoding', `Failed to update ${place.name}: ${error}`);
					}
				}
			}

			// Re-render to show progress (every 5 items to avoid too much re-rendering)
			if (i % 5 === 0 || i === this.ungeocodedPlaces.length - 1) {
				this.renderCurrentView();
			}
		}

		// Complete
		this.isGeocoding = false;

		const successCount = this.geocodingResults.filter(r => r.success && r.coordinates).length;
		const failedCount = this.geocodingResults.filter(r => !r.success || !r.coordinates).length;

		if (this.geocodingCancelled) {
			new Notice(`Geocoding cancelled. Found ${successCount} coordinates.`);
		} else {
			new Notice(`Geocoding complete! Found ${successCount} coordinates, ${failedCount} not found.`);
		}

		// Clear the ungeocoded places list since we've processed them
		this.ungeocodedPlaces = [];

		this.renderCurrentView();
	}

	// ========================================
	// Step 9: Place Hierarchy Enrichment
	// ========================================

	/**
	 * Render Step 9: Place Hierarchy interactive UI
	 */
	private renderHierarchyStep(container: HTMLElement, stepState: StepState): void {
		// If enrichment is in progress, show progress view
		if (this.isEnrichingHierarchy) {
			this.renderHierarchyProgress(container, stepState);
			return;
		}

		// If we have results from a completed run, show results
		if (this.hierarchyEnrichmentResults.length > 0) {
			this.renderHierarchyResults(container, stepState);
			return;
		}

		// Check for unmet dependencies and show warning
		const stepConfig = WIZARD_STEPS.find(s => s.id === 'place-hierarchy');
		if (stepConfig) {
			const unmetDeps = this.getUnmetDependencies(stepConfig);
			if (unmetDeps.length > 0) {
				this.renderDependencyWarning(container, unmetDeps);
			}
		}

		// Check for places without parent
		if (this.placesWithoutParent.length === 0 && this.state.preScanComplete) {
			const noIssues = container.createDiv({ cls: 'crc-cleanup-no-issues' });
			const icon = noIssues.createDiv({ cls: 'crc-cleanup-no-issues-icon' });
			setIcon(icon, 'check-circle');
			noIssues.createDiv({ cls: 'crc-cleanup-no-issues-text', text: 'All places have parent hierarchies!' });
			noIssues.createDiv({ cls: 'crc-cleanup-no-issues-hint', text: 'Your place notes already have parent places defined. You can skip to the next step.' });
			return;
		}

		const preview = container.createDiv({ cls: 'crc-cleanup-preview' });

		// Summary
		const summary = preview.createDiv({ cls: 'crc-cleanup-preview-summary' });
		summary.textContent = `Found ${this.placesWithoutParent.length} place${this.placesWithoutParent.length === 1 ? '' : 's'} without parent hierarchy.`;

		// Description
		const desc = preview.createDiv({ cls: 'crc-cleanup-preview-hint' });
		desc.textContent = 'This will geocode each place, parse the full address into hierarchy components (city → county → state → country), and create or link parent place notes.';

		// Estimated time
		const estimatedMinutes = Math.ceil(this.placesWithoutParent.length / 60);
		const timeText = estimatedMinutes === 1 ? 'about 1 minute' : `about ${estimatedMinutes} minutes`;
		const timeEstimate = preview.createDiv({ cls: 'crc-cleanup-hierarchy-time' });
		const timeIcon = timeEstimate.createSpan({ cls: 'crc-cleanup-hierarchy-time-icon' });
		setIcon(timeIcon, 'clock');
		timeEstimate.createSpan({ text: `Estimated time: ${timeText}` });

		// Settings
		const settingsContainer = preview.createDiv({ cls: 'crc-cleanup-hierarchy-settings' });

		// Create missing parents toggle
		const createParentsRow = settingsContainer.createDiv({ cls: 'crc-cleanup-hierarchy-setting' });
		const createParentsLabel = createParentsRow.createEl('label', { cls: 'crc-cleanup-hierarchy-setting-label' });
		const createParentsCheckbox = createParentsLabel.createEl('input', { type: 'checkbox' });
		createParentsCheckbox.checked = this.hierarchyCreateMissingParents;
		createParentsCheckbox.addEventListener('change', () => {
			this.hierarchyCreateMissingParents = createParentsCheckbox.checked;
		});
		createParentsLabel.createSpan({ text: ' Create missing parent places' });
		createParentsRow.createDiv({ cls: 'crc-cleanup-hierarchy-setting-desc', text: 'Automatically create place notes for missing parents in the hierarchy' });

		// Directory input
		const dirRow = settingsContainer.createDiv({ cls: 'crc-cleanup-hierarchy-setting' });
		dirRow.createDiv({ cls: 'crc-cleanup-hierarchy-setting-label', text: 'Directory for new places' });
		const dirInput = dirRow.createEl('input', {
			type: 'text',
			cls: 'crc-cleanup-hierarchy-input',
			placeholder: 'e.g., Places'
		});
		dirInput.value = this.hierarchyPlacesDirectory;
		dirInput.addEventListener('change', () => {
			this.hierarchyPlacesDirectory = dirInput.value;
		});
		dirRow.createDiv({ cls: 'crc-cleanup-hierarchy-setting-desc', text: 'Where to create new parent place notes' });

		// Places list preview
		const listContainer = preview.createDiv({ cls: 'crc-cleanup-hierarchy-list-container' });
		const listTitle = listContainer.createDiv({ cls: 'crc-cleanup-hierarchy-list-title' });
		listTitle.textContent = 'Places to enrich:';

		const placesList = listContainer.createDiv({ cls: 'crc-cleanup-hierarchy-list' });
		const maxDisplay = 20;
		const displayPlaces = this.placesWithoutParent.slice(0, maxDisplay);

		for (const place of displayPlaces) {
			const item = placesList.createDiv({ cls: 'crc-cleanup-hierarchy-list-item' });
			const iconEl = item.createSpan({ cls: 'crc-cleanup-hierarchy-list-icon' });
			setIcon(iconEl, 'map-pin');
			item.createSpan({ text: place.name, cls: 'crc-cleanup-hierarchy-list-name' });
			if (place.placeType) {
				item.createSpan({ text: ` (${place.placeType})`, cls: 'crc-cleanup-hierarchy-list-type' });
			}
		}

		if (this.placesWithoutParent.length > maxDisplay) {
			const moreEl = placesList.createDiv({ cls: 'crc-cleanup-hierarchy-list-more' });
			moreEl.textContent = `... and ${this.placesWithoutParent.length - maxDisplay} more`;
		}

		// Warning
		const warning = preview.createDiv({ cls: 'crc-cleanup-warning' });
		const warningIcon = warning.createDiv({ cls: 'crc-cleanup-warning-icon' });
		setIcon(warningIcon, 'alert-triangle');
		warning.createSpan({ text: 'Backup your vault before proceeding. This operation will create new files and modify existing place notes.' });

		// Start button
		const applyContainer = preview.createDiv({ cls: 'crc-cleanup-hierarchy-apply' });
		const startBtn = applyContainer.createEl('button', {
			cls: 'crc-btn crc-btn--primary'
		});
		const startIcon = startBtn.createSpan({ cls: 'crc-btn-icon' });
		setIcon(startIcon, 'git-branch');
		startBtn.createSpan({ text: `Start enriching ${this.placesWithoutParent.length} places` });

		startBtn.addEventListener('click', () => {
			void this.startHierarchyEnrichment(stepState);
		});
	}

	/**
	 * Render hierarchy enrichment progress view
	 */
	private renderHierarchyProgress(container: HTMLElement, stepState: StepState): void {
		const progress = container.createDiv({ cls: 'crc-cleanup-hierarchy-progress' });

		// Progress header
		const header = progress.createDiv({ cls: 'crc-cleanup-hierarchy-progress-header' });
		header.createSpan({ text: 'Enriching place hierarchies...', cls: 'crc-cleanup-hierarchy-progress-title' });

		// Progress stats
		const stats = progress.createDiv({ cls: 'crc-cleanup-hierarchy-progress-stats' });
		const processed = this.hierarchyEnrichmentResults.length;
		const total = this.placesWithoutParent.length;
		const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

		const successCount = this.hierarchyEnrichmentResults.filter(r => r.success).length;
		const failedCount = this.hierarchyEnrichmentResults.filter(r => !r.success && !r.skipped).length;
		const parentsCreated = this.hierarchyEnrichmentResults.reduce((sum, r) => sum + (r.parentsCreated?.length || 0), 0);

		stats.createSpan({ text: `${processed} of ${total} (${percent}%)` });

		// Progress bar
		const progressBarContainer = progress.createDiv({ cls: 'crc-cleanup-hierarchy-progress-bar-container' });
		const progressBar = progressBarContainer.createDiv({ cls: 'crc-cleanup-hierarchy-progress-bar' });
		progressBar.style.width = `${percent}%`;

		// Stats breakdown
		const breakdown = progress.createDiv({ cls: 'crc-cleanup-hierarchy-progress-breakdown' });

		const successStat = breakdown.createSpan({ cls: 'crc-cleanup-hierarchy-stat crc-cleanup-hierarchy-stat--success' });
		const successIcon = successStat.createSpan({ cls: 'crc-cleanup-hierarchy-stat-icon' });
		setIcon(successIcon, 'check');
		successStat.createSpan({ text: `${successCount} enriched` });

		const createdStat = breakdown.createSpan({ cls: 'crc-cleanup-hierarchy-stat crc-cleanup-hierarchy-stat--created' });
		const createdIcon = createdStat.createSpan({ cls: 'crc-cleanup-hierarchy-stat-icon' });
		setIcon(createdIcon, 'plus');
		createdStat.createSpan({ text: `${parentsCreated} parents created` });

		const failedStat = breakdown.createSpan({ cls: 'crc-cleanup-hierarchy-stat crc-cleanup-hierarchy-stat--failed' });
		const failedIcon = failedStat.createSpan({ cls: 'crc-cleanup-hierarchy-stat-icon' });
		setIcon(failedIcon, 'x');
		failedStat.createSpan({ text: `${failedCount} failed` });

		// Results list (live updating)
		const resultsList = progress.createDiv({ cls: 'crc-cleanup-hierarchy-results-list' });

		// Show last 10 results
		const recentResults = this.hierarchyEnrichmentResults.slice(-10);
		for (const result of recentResults) {
			const item = resultsList.createDiv({ cls: 'crc-cleanup-hierarchy-result-item' });

			const icon = item.createSpan({ cls: 'crc-cleanup-hierarchy-result-icon' });
			if (result.success) {
				setIcon(icon, 'check');
				icon.addClass('crc-cleanup-hierarchy-result-icon--success');
			} else if (result.skipped) {
				setIcon(icon, 'minus');
				icon.addClass('crc-cleanup-hierarchy-result-icon--skipped');
			} else {
				setIcon(icon, 'x');
				icon.addClass('crc-cleanup-hierarchy-result-icon--failed');
			}

			const name = item.createSpan({ cls: 'crc-cleanup-hierarchy-result-name' });
			name.textContent = result.placeName;

			if (result.success && result.parentLinked) {
				const detail = item.createSpan({ cls: 'crc-cleanup-hierarchy-result-detail' });
				const createdText = result.parentsCreated && result.parentsCreated.length > 0
					? ` (+${result.parentsCreated.length})`
					: '';
				detail.textContent = ` → ${result.parentLinked}${createdText}`;
			} else if (result.error) {
				const error = item.createSpan({ cls: 'crc-cleanup-hierarchy-result-error' });
				error.textContent = result.error;
			}
		}

		// Cancel button
		const cancelContainer = progress.createDiv({ cls: 'crc-cleanup-hierarchy-cancel' });
		const cancelBtn = cancelContainer.createEl('button', {
			cls: 'crc-btn crc-btn--secondary'
		});
		cancelBtn.textContent = this.hierarchyEnrichmentCancelled ? 'Cancelling...' : 'Cancel';
		cancelBtn.disabled = this.hierarchyEnrichmentCancelled;

		cancelBtn.addEventListener('click', () => {
			this.hierarchyEnrichmentCancelled = true;
			cancelBtn.textContent = 'Cancelling...';
			cancelBtn.disabled = true;
		});
	}

	/**
	 * Render hierarchy enrichment results view
	 */
	private renderHierarchyResults(container: HTMLElement, stepState: StepState): void {
		const results = container.createDiv({ cls: 'crc-cleanup-hierarchy-results' });

		// Summary
		const successCount = this.hierarchyEnrichmentResults.filter(r => r.success).length;
		const failedCount = this.hierarchyEnrichmentResults.filter(r => !r.success && !r.skipped).length;
		const parentsCreated = this.hierarchyEnrichmentResults.reduce((sum, r) => sum + (r.parentsCreated?.length || 0), 0);

		const summary = results.createDiv({ cls: 'crc-cleanup-hierarchy-results-summary' });

		const successSummary = summary.createDiv({ cls: 'crc-cleanup-hierarchy-summary-stat crc-cleanup-hierarchy-summary-stat--success' });
		const successIcon = successSummary.createDiv({ cls: 'crc-cleanup-hierarchy-summary-icon' });
		setIcon(successIcon, 'check-circle');
		successSummary.createDiv({ cls: 'crc-cleanup-hierarchy-summary-value', text: String(successCount) });
		successSummary.createDiv({ cls: 'crc-cleanup-hierarchy-summary-label', text: 'Places enriched' });

		const createdSummary = summary.createDiv({ cls: 'crc-cleanup-hierarchy-summary-stat crc-cleanup-hierarchy-summary-stat--created' });
		const createdIcon = createdSummary.createDiv({ cls: 'crc-cleanup-hierarchy-summary-icon' });
		setIcon(createdIcon, 'plus-circle');
		createdSummary.createDiv({ cls: 'crc-cleanup-hierarchy-summary-value', text: String(parentsCreated) });
		createdSummary.createDiv({ cls: 'crc-cleanup-hierarchy-summary-label', text: 'Parents created' });

		const failedSummary = summary.createDiv({ cls: 'crc-cleanup-hierarchy-summary-stat crc-cleanup-hierarchy-summary-stat--failed' });
		const failedIcon = failedSummary.createDiv({ cls: 'crc-cleanup-hierarchy-summary-icon' });
		setIcon(failedIcon, 'x-circle');
		failedSummary.createDiv({ cls: 'crc-cleanup-hierarchy-summary-value', text: String(failedCount) });
		failedSummary.createDiv({ cls: 'crc-cleanup-hierarchy-summary-label', text: 'Failed' });

		// Results table
		const tableContainer = results.createDiv({ cls: 'crc-cleanup-hierarchy-table-container' });
		const table = tableContainer.createEl('table', { cls: 'crc-cleanup-hierarchy-table' });

		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: '', cls: 'crc-cleanup-hierarchy-th-status' });
		headerRow.createEl('th', { text: 'Place' });
		headerRow.createEl('th', { text: 'Result' });

		const tbody = table.createEl('tbody');

		// Show all results (with scroll)
		for (const result of this.hierarchyEnrichmentResults) {
			const row = tbody.createEl('tr', { cls: 'crc-cleanup-hierarchy-row' });

			// Status icon
			const tdStatus = row.createEl('td', { cls: 'crc-cleanup-hierarchy-td-status' });
			const statusIcon = tdStatus.createSpan();
			if (result.success) {
				setIcon(statusIcon, 'check');
				statusIcon.addClass('crc-cleanup-hierarchy-status--success');
			} else if (result.skipped) {
				setIcon(statusIcon, 'minus');
				statusIcon.addClass('crc-cleanup-hierarchy-status--skipped');
			} else {
				setIcon(statusIcon, 'x');
				statusIcon.addClass('crc-cleanup-hierarchy-status--failed');
			}

			// Place name
			row.createEl('td', { text: result.placeName, cls: 'crc-cleanup-hierarchy-td-name' });

			// Result
			const tdResult = row.createEl('td', { cls: 'crc-cleanup-hierarchy-td-result' });
			if (result.success && result.parentLinked) {
				const createdText = result.parentsCreated && result.parentsCreated.length > 0
					? ` (created: ${result.parentsCreated.join(', ')})`
					: '';
				tdResult.textContent = `→ ${result.parentLinked}${createdText}`;
				tdResult.addClass('crc-cleanup-hierarchy-result--success');
			} else if (result.skipped) {
				tdResult.textContent = 'Already has parent';
				tdResult.addClass('crc-cleanup-hierarchy-result--skipped');
			} else {
				tdResult.textContent = result.error || 'Failed';
				tdResult.addClass('crc-cleanup-hierarchy-result--error');
			}
		}

		// Show failed places note if any
		if (failedCount > 0) {
			const failedNote = results.createDiv({ cls: 'crc-cleanup-hierarchy-failed-note' });
			const noteIcon = failedNote.createSpan({ cls: 'crc-cleanup-hierarchy-failed-note-icon' });
			setIcon(noteIcon, 'info');
			failedNote.createSpan({ text: 'Places that failed may have unusual names or not be found in OpenStreetMap. You can enrich them manually.' });
		}

		// Update step state
		stepState.status = 'complete';
		stepState.fixCount = successCount;
		this.recordStepCompletion('place-hierarchy', successCount);

		// Done button
		const doneContainer = results.createDiv({ cls: 'crc-cleanup-hierarchy-done' });
		const doneBtn = doneContainer.createEl('button', {
			cls: 'crc-btn crc-btn--primary'
		});
		const doneIcon = doneBtn.createSpan({ cls: 'crc-btn-icon' });
		setIcon(doneIcon, 'check');
		doneBtn.createSpan({ text: 'Done' });

		doneBtn.addEventListener('click', () => {
			// Clear results and re-render
			this.hierarchyEnrichmentResults = [];
			this.renderCurrentView();
		});
	}

	/**
	 * Start the hierarchy enrichment process
	 */
	private async startHierarchyEnrichment(stepState: StepState): Promise<void> {
		if (this.isEnrichingHierarchy) return;

		this.isEnrichingHierarchy = true;
		this.hierarchyEnrichmentCancelled = false;
		this.hierarchyEnrichmentResults = [];
		stepState.status = 'in_progress';
		this.renderCurrentView();

		const geocodingService = this.getGeocodingService();
		const placeGraph = this.plugin.createPlaceGraphService();

		for (let i = 0; i < this.placesWithoutParent.length; i++) {
			// Check for cancellation
			if (this.hierarchyEnrichmentCancelled) {
				logger.info('startHierarchyEnrichment', `Enrichment cancelled at ${i} of ${this.placesWithoutParent.length}`);
				break;
			}

			const place = this.placesWithoutParent[i];

			// Enrich this place's hierarchy
			const result = await this.enrichPlaceHierarchy(place, geocodingService, placeGraph);
			this.hierarchyEnrichmentResults.push(result);

			// Re-render to show progress (every 5 items to avoid too much re-rendering)
			if (i % 5 === 0 || i === this.placesWithoutParent.length - 1) {
				this.renderCurrentView();
			}
		}

		// Complete
		this.isEnrichingHierarchy = false;

		const successCount = this.hierarchyEnrichmentResults.filter(r => r.success).length;
		const parentsCreated = this.hierarchyEnrichmentResults.reduce((sum, r) => sum + (r.parentsCreated?.length || 0), 0);
		const failedCount = this.hierarchyEnrichmentResults.filter(r => !r.success && !r.skipped).length;

		if (this.hierarchyEnrichmentCancelled) {
			new Notice(`Hierarchy enrichment cancelled. Enriched ${successCount} places, created ${parentsCreated} parents.`);
		} else {
			new Notice(`Hierarchy enrichment complete! Enriched ${successCount} places, created ${parentsCreated} parents. ${failedCount} failed.`);
		}

		// Clear the places list since we've processed them
		this.placesWithoutParent = [];

		this.renderCurrentView();
	}

	/**
	 * Enrich hierarchy for a single place
	 */
	private async enrichPlaceHierarchy(
		place: PlaceNode,
		geocodingService: GeocodingService,
		placeGraph: PlaceGraphService
	): Promise<HierarchyEnrichmentResult> {
		const result: HierarchyEnrichmentResult = {
			placeName: place.name,
			success: false
		};

		try {
			// Build search query - use existing parent if available for better accuracy
			let searchQuery = place.name;
			if (place.parentId) {
				const parent = placeGraph.getPlaceByCrId(place.parentId);
				if (parent) {
					searchQuery = `${place.name}, ${parent.name}`;
				}
			}

			// Geocode the place with detailed address info
			const geocodeResult = await geocodingService.geocodeWithDetails(searchQuery);

			if (!geocodeResult.success || !geocodeResult.addressComponents) {
				result.error = geocodeResult.error || 'No address found';
				return result;
			}

			// Parse hierarchy from address components
			const hierarchy = this.parseHierarchyFromAddress(geocodeResult.addressComponents, place.name);
			result.hierarchy = hierarchy;

			// Check if this place IS a country (top-level, no parent needed)
			const isCountry = geocodeResult.addressComponents.country?.toLowerCase() === place.name.toLowerCase();

			if (hierarchy.length === 0) {
				if (isCountry) {
					// Countries are top-level - just update coordinates, no parent needed
					const file = this.app.vault.getAbstractFileByPath(place.filePath);
					if (file instanceof TFile) {
						await updatePlaceNote(this.app, file, {
							placeType: 'country',
							coordinates: geocodeResult.coordinates
						});
					}
					result.success = true;
					result.parentsCreated = [];
					result.parentLinked = '(top-level country)';
					return result;
				}
				result.error = 'Could not parse hierarchy';
				return result;
			}

			// Find or create parent places and link them
			const { parentId, parentsCreated } = await this.findOrCreateParentChain(
				hierarchy,
				place,
				geocodeResult.addressComponents,
				placeGraph
			);

			if (parentId) {
				// Update the original place to link to its parent
				const file = this.app.vault.getAbstractFileByPath(place.filePath);
				if (file instanceof TFile) {
					const parentPlace = placeGraph.getPlaceByCrId(parentId);
					await updatePlaceNote(this.app, file, {
						parentPlace: parentPlace?.name,
						parentPlaceId: parentId,
						// Also update coordinates if we got them
						coordinates: geocodeResult.coordinates
					});
				}

				result.success = true;
				result.parentsCreated = parentsCreated;
				result.parentLinked = placeGraph.getPlaceByCrId(parentId)?.name;
			} else {
				result.error = 'Could not establish parent chain';
			}

		} catch (error) {
			result.error = error instanceof Error ? error.message : 'Unknown error';
		}

		return result;
	}

	/**
	 * Parse hierarchy from Nominatim address components
	 * Returns array from most specific to least specific (excluding the place itself)
	 */
	private parseHierarchyFromAddress(
		addressComponents: Record<string, string>,
		placeName: string
	): string[] {
		const hierarchy: string[] = [];

		// Order of address components from most specific to least
		const componentOrder = [
			'city', 'town', 'village', 'municipality', 'hamlet',
			'county', 'district', 'suburb',
			'state', 'province', 'region',
			'country'
		];

		// Track what we've added to avoid duplicates
		const added = new Set<string>();
		added.add(placeName.toLowerCase()); // Don't include the place itself

		for (const component of componentOrder) {
			const value = addressComponents[component];
			if (value && !added.has(value.toLowerCase())) {
				hierarchy.push(value);
				added.add(value.toLowerCase());
			}
		}

		return hierarchy;
	}

	/**
	 * Find or create the parent chain for a place
	 * Returns the cr_id of the immediate parent
	 */
	private async findOrCreateParentChain(
		hierarchy: string[],
		place: PlaceNode,
		addressComponents: Record<string, string>,
		placeGraph: PlaceGraphService
	): Promise<{ parentId: string | undefined; parentsCreated: string[] }> {
		const parentsCreated: string[] = [];
		let childId: string | undefined;

		// Work backwards from country to most specific parent
		// This ensures each place has its parent created before it
		const reversedHierarchy = [...hierarchy].reverse();

		for (let i = 0; i < reversedHierarchy.length; i++) {
			const name = reversedHierarchy[i];
			const isImmediateParent = i === reversedHierarchy.length - 1;

			// Try to find existing place with this name
			let existingPlace = this.findPlaceByName(name, placeGraph);

			if (!existingPlace && this.hierarchyCreateMissingParents) {
				// Determine place type from address components
				const placeType = this.inferPlaceType(name, addressComponents);

				// Create the place
				const placeData: PlaceData = {
					name,
					placeType,
					// Link to previously created parent if we have one
					parentPlaceId: childId,
					parentPlace: childId ? placeGraph.getPlaceByCrId(childId)?.name : undefined
				};

				try {
					const file = await createPlaceNote(this.app, placeData, {
						directory: this.hierarchyPlacesDirectory,
						openAfterCreate: false
					});

					// Get the cr_id from the created file
					const cache = this.app.metadataCache.getFileCache(file);
					const newCrId = cache?.frontmatter?.cr_id;

					if (newCrId) {
						parentsCreated.push(name);

						// Refresh the place graph to include the new place
						placeGraph.reloadCache();

						existingPlace = placeGraph.getPlaceByCrId(newCrId);
						childId = newCrId;
					}
				} catch (error) {
					console.error(`Failed to create place "${name}":`, error);
				}
			} else if (existingPlace) {
				childId = existingPlace.id;
			}

			// Return the immediate parent's ID
			if (isImmediateParent && existingPlace) {
				return { parentId: existingPlace.id, parentsCreated };
			}
		}

		// Return the most specific parent we found/created
		return { parentId: childId, parentsCreated };
	}

	/**
	 * Find an existing place by name
	 */
	private findPlaceByName(name: string, placeGraph: PlaceGraphService): PlaceNode | undefined {
		const allPlaces = placeGraph.getAllPlaces();
		const nameLower = name.toLowerCase();

		return allPlaces.find(p =>
			p.name.toLowerCase() === nameLower ||
			p.aliases.some(a => a.toLowerCase() === nameLower)
		);
	}

	/**
	 * Infer place type from address components
	 */
	private inferPlaceType(name: string, addressComponents: Record<string, string>): PlaceType | undefined {
		// Check which component matches this name
		for (const [component, value] of Object.entries(addressComponents)) {
			if (value.toLowerCase() === name.toLowerCase()) {
				return OSM_TYPE_MAP[component];
			}
		}
		return undefined;
	}

	/**
	 * Update place references in specific files
	 */
	private async updatePlaceReferences(oldValue: string, newValue: string, files: import('obsidian').TFile[]): Promise<number> {
		let updated = 0;

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;

			// Check if any place fields contain the old value (as a component)
			const fieldsToUpdate: Array<{ field: string; oldVal: string; newVal: string }> = [];

			// Helper to check and queue field updates
			const checkField = (fieldName: string) => {
				const value = fm[fieldName];
				if (typeof value === 'string' && this.containsPlaceVariant(value, oldValue)) {
					const newFieldValue = this.replacePlaceVariant(value, oldValue, newValue);
					if (newFieldValue !== value) {
						fieldsToUpdate.push({ field: fieldName, oldVal: value, newVal: newFieldValue });
					}
				}
			};

			// Check if this is a Place note - update full_name and title
			if (fm.cr_type === 'place') {
				checkField('full_name');
				checkField('title');
			} else {
				// Person notes - check place fields
				checkField('birth_place');
				checkField('death_place');
				checkField('burial_place');

				// Check spouse marriage locations
				let spouseIndex = 1;
				while (fm[`spouse${spouseIndex}`] || fm[`spouse${spouseIndex}_id`]) {
					checkField(`spouse${spouseIndex}_marriage_location`);
					spouseIndex++;
				}
			}

			if (fieldsToUpdate.length > 0) {
				await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
					for (const update of fieldsToUpdate) {
						frontmatter[update.field] = update.newVal;
					}
				});
				updated += fieldsToUpdate.length;
			}
		}

		return updated;
	}

	/**
	 * Strip wikilink brackets from a place value
	 */
	private stripWikilink(value: string): { inner: string; hadBrackets: boolean } {
		if (value.startsWith('[[') && value.endsWith(']]')) {
			return { inner: value.slice(2, -2), hadBrackets: true };
		}
		return { inner: value, hadBrackets: false };
	}

	/**
	 * Check if a place value contains the variant (as a standalone component)
	 */
	private containsPlaceVariant(value: string, variant: string): boolean {
		const { inner } = this.stripWikilink(value);
		const parts = inner.split(',').map(p => p.trim());
		return parts.some(part => part.toLowerCase() === variant.toLowerCase());
	}

	/**
	 * Replace a variant in a place value with the canonical form
	 */
	private replacePlaceVariant(value: string, oldVariant: string, newCanonical: string): string {
		const { inner, hadBrackets } = this.stripWikilink(value);
		const parts = inner.split(',').map(p => p.trim());
		const newParts = parts.map(part => {
			if (part.toLowerCase() === oldVariant.toLowerCase()) {
				return newCanonical;
			}
			return part;
		});
		const result = newParts.join(', ');
		return hadBrackets ? `[[${result}]]` : result;
	}

	/**
	 * Render step footer with navigation buttons
	 */
	private renderStepFooter(stepConfig: WizardStepConfig, stepState: StepState): void {
		if (!this.footerContainer) return;

		const leftBtns = this.footerContainer.createDiv({ cls: 'crc-cleanup-footer-left' });

		// Overview button
		const overviewBtn = leftBtns.createEl('button', {
			cls: 'crc-btn crc-btn--secondary'
		});
		const overviewIcon = overviewBtn.createSpan({ cls: 'crc-btn-icon' });
		setIcon(overviewIcon, 'layout-grid');
		overviewBtn.createSpan({ text: 'Overview' });
		overviewBtn.addEventListener('click', () => {
			this.currentView = 'overview';
			this.renderCurrentView();
		});

		// Back button (if not first step)
		if (this.state.currentStep > 1) {
			const backBtn = leftBtns.createEl('button', {
				cls: 'crc-btn crc-btn--secondary',
				text: 'Back'
			});
			backBtn.addEventListener('click', () => {
				this.state.currentStep--;
				this.renderCurrentView();
			});
		}

		const rightBtns = this.footerContainer.createDiv({ cls: 'crc-cleanup-footer-right' });

		// Skip button
		const skipBtn = rightBtns.createEl('button', {
			cls: 'crc-btn crc-btn--secondary',
			text: 'Skip Step'
		});
		skipBtn.addEventListener('click', () => {
			this.state.steps[this.state.currentStep].status = 'skipped';
			this.state.steps[this.state.currentStep].skippedReason = 'Skipped by user';
			this.advanceToNextStep();
		});

		// Apply/Continue button
		if (stepConfig.type === 'review' || stepState.status === 'complete') {
			// Review step or already complete - just show Next
			const nextBtn = rightBtns.createEl('button', {
				cls: 'crc-btn crc-btn--primary',
				text: this.state.currentStep === WIZARD_STEPS.length ? 'Finish' : 'Next'
			});
			nextBtn.addEventListener('click', () => {
				if (stepState.status === 'pending') {
					this.state.steps[this.state.currentStep].status = 'complete';
					this.recordStepCompletion(stepConfig.id, 0);
				}
				this.advanceToNextStep();
			});
		} else if (stepConfig.type === 'batch' && stepState.issueCount > 0) {
			// Batch step with issues - show Apply button
			const applyBtn = rightBtns.createEl('button', {
				cls: 'crc-btn crc-btn--primary'
			});
			const applyIcon = applyBtn.createSpan({ cls: 'crc-btn-icon' });
			setIcon(applyIcon, 'zap');
			applyBtn.createSpan({ text: 'Apply Fixes' });
			applyBtn.addEventListener('click', () => {
				void this.applyBatchFixes(stepConfig);
			});
		} else {
			// No issues or interactive step - show Next
			const nextBtn = rightBtns.createEl('button', {
				cls: 'crc-btn crc-btn--primary',
				text: this.state.currentStep === WIZARD_STEPS.length ? 'Finish' : 'Next'
			});
			nextBtn.addEventListener('click', () => {
				if (stepState.status === 'pending' && stepState.issueCount === 0) {
					this.state.steps[this.state.currentStep].status = 'skipped';
					this.state.steps[this.state.currentStep].skippedReason = 'No issues found';
				}
				this.advanceToNextStep();
			});
		}
	}

	/**
	 * Advance to the next step or summary
	 */
	private advanceToNextStep(): void {
		if (this.state.currentStep >= WIZARD_STEPS.length) {
			this.currentView = 'summary';
		} else {
			this.state.currentStep++;
		}
		this.renderCurrentView();
	}

	/**
	 * Apply batch fixes for a step
	 */
	private async applyBatchFixes(stepConfig: WizardStepConfig): Promise<void> {
		const stepState = this.state.steps[stepConfig.number];
		stepState.status = 'in_progress';
		this.batchProgress = null;
		this.renderCurrentView();

		// Progress callback that updates state and re-renders periodically
		const onProgress = (current: number, total: number, currentFile?: string) => {
			this.batchProgress = { current, total, currentFile };
			// Re-render every 5 items to avoid excessive updates
			if (current % 5 === 0 || current === total) {
				this.renderCurrentView();
			}
		};

		try {
			let result: BatchOperationResult | null = null;
			const service = this.getDataQualityService();

			// Call the appropriate service method using cached issues from pre-scan
			switch (stepConfig.id) {
				case 'bidirectional':
					result = await service.fixBidirectionalInconsistencies(this.bidirectionalIssues, { onProgress });
					break;
				case 'date-normalize':
					result = await service.normalizeDateFormats({ progress: { onProgress } });
					break;
				case 'gender-normalize':
					result = await service.normalizeGenderValues({ progress: { onProgress } });
					break;
				case 'orphan-clear':
					result = await service.clearOrphanReferences({ progress: { onProgress } });
					break;
				case 'flatten-props':
					result = await service.flattenNestedProperties({ progress: { onProgress } });
					break;
				case 'source-migrate': {
					const sourceMigrationService = this.getSourceMigrationService();
					const migrationResult = await sourceMigrationService.migrateToArrayFormat(this.indexedSourceNotes, onProgress);
					result = {
						processed: migrationResult.processed,
						modified: migrationResult.modified,
						errors: migrationResult.errors
					};
					break;
				}
				case 'event-person-migrate': {
					const eventPersonMigrationService = this.getEventPersonMigrationService();
					const migrationResult = await eventPersonMigrationService.migrateToArrayFormat(this.legacyPersonEventNotes, onProgress);
					result = {
						processed: migrationResult.processed,
						modified: migrationResult.modified,
						errors: migrationResult.errors
					};
					break;
				}
				case 'sourced-facts-migrate': {
					const sourcedFactsMigrationService = this.getSourcedFactsMigrationService();
					const migrationResult = await sourcedFactsMigrationService.migrateToFlatFormat(this.legacySourcedFactsNotes, onProgress);
					result = {
						processed: migrationResult.processed,
						modified: migrationResult.modified,
						errors: migrationResult.errors
					};
					// Mark the nestedPropertiesMigration as complete for sourced_facts
					if (!this.plugin.settings.nestedPropertiesMigration) {
						this.plugin.settings.nestedPropertiesMigration = {};
					}
					this.plugin.settings.nestedPropertiesMigration.sourcedFactsComplete = true;
					await this.plugin.saveSettings();
					break;
				}
				case 'life-events-migrate': {
					const lifeEventsMigrationService = this.getLifeEventsMigrationService();
					const migrationResult = await lifeEventsMigrationService.migrateToEventNotes(this.legacyEventsNotes, onProgress);
					result = {
						processed: migrationResult.processed,
						modified: migrationResult.modified,
						errors: migrationResult.errors
					};
					// Mark the nestedPropertiesMigration as complete for events
					if (!this.plugin.settings.nestedPropertiesMigration) {
						this.plugin.settings.nestedPropertiesMigration = {};
					}
					this.plugin.settings.nestedPropertiesMigration.eventsComplete = true;
					await this.plugin.saveSettings();
					// Custom notice for life events to show how many notes were created
					new Notice(`Created ${migrationResult.eventNotesCreated} event notes from ${migrationResult.modified} person notes`);
					break;
				}
				case 'child-to-children': {
					const migrationResult = await this.migrateChildToChildren(onProgress);
					result = {
						processed: migrationResult.processed,
						modified: migrationResult.modified,
						errors: migrationResult.errors
					};
					break;
				}
				default:
					// Placeholder for unimplemented methods
					await new Promise(resolve => setTimeout(resolve, 500));
					result = { processed: 0, modified: stepState.issueCount, errors: [] };
			}

			if (result) {
				stepState.status = 'complete';
				stepState.fixCount = result.modified;
				this.recordStepCompletion(stepConfig.id, result.modified);

				// Custom notice for bidirectional step to mention conflicts
				if (stepConfig.id === 'bidirectional') {
					const conflicts = this.bidirectionalIssues.filter(i => i.type === 'conflicting-parent-claim').length;
					if (conflicts > 0) {
						new Notice(`Fixed ${result.modified} issues (${conflicts} conflicts require manual resolution)`);
					} else {
						new Notice(`Fixed ${result.modified} issues`);
					}
				} else {
					new Notice(`Fixed ${result.modified} issues`);
				}
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			new Notice(`Error: ${message}`);
			stepState.status = 'pending';
		}

		this.batchProgress = null;
		this.renderCurrentView();
	}

	/**
	 * Render the summary screen
	 */
	private renderSummary(): void {
		if (!this.contentContainer || !this.footerContainer || !this.progressContainer) return;

		// Hide step progress
		this.progressContainer.addClass('crc-hidden');

		const section = this.contentContainer.createDiv({ cls: 'crc-cleanup-section' });

		// Success header
		const header = section.createDiv({ cls: 'crc-cleanup-summary-header' });
		const headerIcon = header.createDiv({ cls: 'crc-cleanup-summary-icon' });
		setIcon(headerIcon, 'check-circle');
		header.createEl('h2', { text: 'Cleanup Complete!' });

		// Stats cards
		const stats = section.createDiv({ cls: 'crc-cleanup-summary-stats' });

		let totalFixes = 0;
		let skippedCount = 0;
		const manualCount = 0;

		for (const step of WIZARD_STEPS) {
			const stepState = this.state.steps[step.number];
			if (stepState.status === 'complete') {
				totalFixes += stepState.fixCount;
			} else if (stepState.status === 'skipped') {
				skippedCount++;
			}
			// Count manual issues (step 1 review items that weren't auto-fixable)
			if (step.number === 1 && stepState.issueCount > 0) {
				// This is a simplification - in reality we'd track manual vs auto-fixable
			}
		}

		this.renderStatCard(stats, String(totalFixes), 'Fixes Applied', 'zap');
		this.renderStatCard(stats, String(skippedCount), 'Steps Skipped', 'skip-forward');
		this.renderStatCard(stats, String(manualCount), 'Manual Issues', 'hand');

		// Step breakdown
		section.createEl('h4', { text: 'Step Breakdown', cls: 'crc-cleanup-breakdown-title' });

		const breakdown = section.createDiv({ cls: 'crc-cleanup-breakdown' });

		for (const step of WIZARD_STEPS) {
			const stepState = this.state.steps[step.number];
			const row = breakdown.createDiv({ cls: 'crc-cleanup-breakdown-row' });

			const label = row.createDiv({ cls: 'crc-cleanup-breakdown-label' });
			label.textContent = `Step ${step.number}: ${step.title}`;

			const status = row.createDiv({ cls: 'crc-cleanup-breakdown-status' });

			switch (stepState.status) {
				case 'complete': {
					const checkIcon = status.createSpan({ cls: 'crc-cleanup-breakdown-icon crc-cleanup-breakdown-icon--complete' });
					setIcon(checkIcon, 'check');
					if (stepState.fixCount > 0) {
						status.createSpan({ text: `${stepState.fixCount} fixed` });
					} else {
						status.createSpan({ text: 'Reviewed' });
					}
					break;
				}
				case 'skipped': {
					const skipIcon = status.createSpan({ cls: 'crc-cleanup-breakdown-icon crc-cleanup-breakdown-icon--skipped' });
					setIcon(skipIcon, 'skip-forward');
					status.createSpan({ text: stepState.skippedReason || 'Skipped' });
					break;
				}
				case 'pending':
					status.createSpan({ text: 'Not started', cls: 'crc-cleanup-breakdown-pending' });
					break;
			}
		}

		// Footer
		const leftBtns = this.footerContainer.createDiv({ cls: 'crc-cleanup-footer-left' });

		const saveReportBtn = leftBtns.createEl('button', {
			cls: 'crc-btn crc-btn--secondary'
		});
		const saveIcon = saveReportBtn.createSpan({ cls: 'crc-btn-icon' });
		setIcon(saveIcon, 'file-text');
		saveReportBtn.createSpan({ text: 'Save Report' });
		saveReportBtn.addEventListener('click', () => {
			void this.saveReport();
		});

		const rightBtns = this.footerContainer.createDiv({ cls: 'crc-cleanup-footer-right' });

		const doneBtn = rightBtns.createEl('button', {
			cls: 'crc-btn crc-btn--primary',
			text: 'Done'
		});
		doneBtn.addEventListener('click', () => this.close());
	}

	/**
	 * Render a stat card
	 */
	private renderStatCard(container: HTMLElement, value: string, label: string, icon: string): void {
		const card = container.createDiv({ cls: 'crc-cleanup-stat-card' });
		const iconEl = card.createDiv({ cls: 'crc-cleanup-stat-icon' });
		setIcon(iconEl, icon);
		card.createDiv({ cls: 'crc-cleanup-stat-value', text: value });
		card.createDiv({ cls: 'crc-cleanup-stat-label', text: label });
	}

	/**
	 * Run pre-scan to populate issue counts
	 */
	private runPreScan(): void {
		this.state.isPreScanning = true;
		this.renderCurrentView();

		try {
			const service = this.getDataQualityService();
			logger.info('runPreScan', 'Starting pre-scan analysis...');

			// Run full analysis to get issue counts
			const report: DataQualityReport = service.analyze({});
			this.qualityReport = report;

			logger.info('runPreScan', `Analysis complete: ${report.summary.totalPeople} people, ${report.summary.totalIssues} total issues`);
			logger.debug('runPreScan', `By category: ${JSON.stringify(report.summary.byCategory)}`);
			logger.debug('runPreScan', `By severity: ${JSON.stringify(report.summary.bySeverity)}`);

			// Populate step 1 with total issues from report
			this.state.steps[1].issueCount = report.summary.totalIssues;

			// Step 2: Bidirectional - detect inconsistencies
			this.bidirectionalIssues = service.detectBidirectionalInconsistencies({});
			this.state.steps[2].issueCount = this.bidirectionalIssues.length;
			logger.debug('runPreScan', `Step 2 (Bidir): ${this.bidirectionalIssues.length} issues`);

			// Step 3: Date issues - count NON_STANDARD_DATE code specifically
			const dateIssues = report.issues.filter(i => i.code === 'NON_STANDARD_DATE');
			this.state.steps[3].issueCount = dateIssues.length;
			logger.debug('runPreScan', `Step 3 (Dates): ${dateIssues.length} issues`);

			// Step 4: Gender issues - count INVALID_GENDER code specifically
			const genderIssues = report.issues.filter(i => i.code === 'INVALID_GENDER');
			this.state.steps[4].issueCount = genderIssues.length;
			logger.debug('runPreScan', `Step 4 (Gender): ${genderIssues.length} issues`);

			// Step 5: Orphan references
			this.state.steps[5].issueCount = report.summary.byCategory['orphan_reference'] || 0;
			logger.debug('runPreScan', `Step 5 (Orphans): ${this.state.steps[5].issueCount} issues`);

			// Step 10: Nested properties
			this.state.steps[10].issueCount = report.summary.byCategory['nested_property'] || 0;
			logger.debug('runPreScan', `Step 10 (Nested): ${this.state.steps[10].issueCount} issues`);

			// Step 7: Place variants
			this.placeVariantMatches = findPlaceNameVariants(this.app);
			this.state.steps[7].issueCount = this.placeVariantMatches.length;
			logger.debug('runPreScan', `Step 7 (Place Variants): ${this.placeVariantMatches.length} issues`);

			// Step 8: Ungeocoded places
			const placeGraph = this.plugin.createPlaceGraphService();
			placeGraph.reloadCache();
			const allPlaces = placeGraph.getAllPlaces();
			// Filter to places without coordinates that are "real" category
			this.ungeocodedPlaces = allPlaces.filter(place =>
				!place.coordinates &&
				['real', 'historical', 'disputed'].includes(place.category)
			);
			this.state.steps[8].issueCount = this.ungeocodedPlaces.length;
			logger.debug('runPreScan', `Step 8 (Geocode): ${this.ungeocodedPlaces.length} places without coordinates`);

			// Step 9: Places without parent hierarchy
			// Filter to places without parent that are "real" category
			// Exclude top-level types (countries, regions) - they don't need parent linking
			const topLevelTypes = ['country', 'region'];
			this.placesWithoutParent = allPlaces.filter(place =>
				!place.parentId &&
				!topLevelTypes.includes(place.placeType || '') &&
				['real', 'historical', 'disputed'].includes(place.category)
			);
			this.state.steps[9].issueCount = this.placesWithoutParent.length;
			logger.debug('runPreScan', `Step 9 (Hierarchy): ${this.placesWithoutParent.length} places without parent`);

			// Step 6: Source migration (indexed → array format)
			const sourceMigrationService = this.getSourceMigrationService();
			this.indexedSourceNotes = sourceMigrationService.detectIndexedSources();
			this.state.steps[6].issueCount = this.indexedSourceNotes.length;
			logger.debug('runPreScan', `Step 6 (Sources): ${this.indexedSourceNotes.length} notes with indexed sources`);

			// Step 11: Event person migration (person → persons array)
			const eventPersonMigrationService = this.getEventPersonMigrationService();
			this.legacyPersonEventNotes = eventPersonMigrationService.detectLegacyPersonProperty();
			this.state.steps[11].issueCount = this.legacyPersonEventNotes.length;
			logger.debug('runPreScan', `Step 11 (Event Persons): ${this.legacyPersonEventNotes.length} events with legacy person property`);

			// Step 12: Sourced facts migration (sourced_facts → sourced_* flat properties)
			const sourcedFactsMigrationService = this.getSourcedFactsMigrationService();
			this.legacySourcedFactsNotes = sourcedFactsMigrationService.detectLegacySourcedFacts();
			this.state.steps[12].issueCount = this.legacySourcedFactsNotes.length;
			logger.debug('runPreScan', `Step 12 (Evidence): ${this.legacySourcedFactsNotes.length} notes with legacy sourced_facts`);

			// Step 13: Life events migration (inline events → event note files)
			const lifeEventsMigrationService = this.getLifeEventsMigrationService();
			this.legacyEventsNotes = lifeEventsMigrationService.detectInlineEvents();
			this.state.steps[13].issueCount = this.legacyEventsNotes.length;
			logger.debug('runPreScan', `Step 13 (Life Events): ${this.legacyEventsNotes.length} notes with inline events`);

			// Step 14: Child→children migration (child → children property rename)
			this.legacyChildNotes = this.detectLegacyChildProperty();
			this.state.steps[14].issueCount = this.legacyChildNotes.length;
			logger.debug('runPreScan', `Step 14 (Children): ${this.legacyChildNotes.length} notes with legacy child property`);

			this.state.preScanComplete = true;
			logger.info('runPreScan', 'Pre-scan complete');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.error('runPreScan', `Pre-scan failed: ${message}`);
			console.error('Pre-scan failed:', error);
		} finally {
			this.state.isPreScanning = false;
			this.renderCurrentView();
		}
	}

	/**
	 * Save cleanup report to vault
	 */
	private async saveReport(): Promise<void> {
		const date = new Date().toISOString().split('T')[0];
		const fileName = `Cleanup Summary ${date}.md`;
		const folderPath = 'Canvas Roots/Reports';

		// Build report content
		let content = `# Cleanup Summary\n\n`;
		content += `**Date:** ${new Date().toLocaleString()}\n\n`;
		content += `## Summary\n\n`;

		let totalFixes = 0;
		let skippedCount = 0;

		for (const step of WIZARD_STEPS) {
			const stepState = this.state.steps[step.number];
			if (stepState.status === 'complete') {
				totalFixes += stepState.fixCount;
			} else if (stepState.status === 'skipped') {
				skippedCount++;
			}
		}

		content += `- **Fixes Applied:** ${totalFixes}\n`;
		content += `- **Steps Skipped:** ${skippedCount}\n\n`;

		content += `## Step Details\n\n`;

		for (const step of WIZARD_STEPS) {
			const stepState = this.state.steps[step.number];
			let statusText = '';

			switch (stepState.status) {
				case 'complete':
					statusText = stepState.fixCount > 0 ? `${stepState.fixCount} fixed` : 'Reviewed';
					break;
				case 'skipped':
					statusText = stepState.skippedReason || 'Skipped';
					break;
				case 'pending':
					statusText = 'Not started';
					break;
			}

			const icon = stepState.status === 'complete' ? '✅' : stepState.status === 'skipped' ? '⏭️' : '⏳';
			content += `${icon} **Step ${step.number}: ${step.title}** - ${statusText}\n`;
		}

		content += `\n---\n*Generated by Canvas Roots Cleanup Wizard*\n`;

		try {
			// Ensure folder exists
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			if (!folder) {
				await this.app.vault.createFolder(folderPath);
			}

			// Create report file
			const filePath = `${folderPath}/${fileName}`;
			await this.app.vault.create(filePath, content);
			new Notice(`Report saved to ${filePath}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			new Notice(`Failed to save report: ${message}`);
		}
	}

	/**
	 * Detect person notes with legacy "child" property (Step 14)
	 */
	private detectLegacyChildProperty(): TFile[] {
		const files: TFile[] = [];
		for (const file of this.app.vault.getMarkdownFiles()) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter as Record<string, unknown>;

			// Only check person notes (must have cr_id)
			if (!fm.cr_id) continue;

			// Check for legacy "child" property
			if (fm.child !== undefined) {
				files.push(file);
			}
		}
		return files;
	}

	/**
	 * Migrate child→children property (Step 14)
	 */
	private async migrateChildToChildren(
		onProgress?: (current: number, total: number, currentFile?: string) => void
	): Promise<{ processed: number; modified: number; errors: Array<{ file: string; error: string }> }> {
		const result = {
			processed: 0,
			modified: 0,
			errors: [] as Array<{ file: string; error: string }>
		};

		for (let i = 0; i < this.legacyChildNotes.length; i++) {
			const file = this.legacyChildNotes[i];
			// Report progress
			onProgress?.(i + 1, this.legacyChildNotes.length, file.basename);

			result.processed++;

			try {
				await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
					if (frontmatter.child !== undefined) {
						const childValue = frontmatter.child;
						const childrenValue = frontmatter.children;

						if (childrenValue !== undefined) {
							// Merge with existing children, deduplicate
							const childArray = Array.isArray(childValue) ? childValue : [childValue];
							const childrenArray = Array.isArray(childrenValue) ? childrenValue : [childrenValue];
							const merged = [...new Set([...childrenArray, ...childArray])];
							frontmatter.children = merged.length === 1 ? merged[0] : merged;
						} else {
							// Simply rename
							frontmatter.children = childValue;
						}

						delete frontmatter.child;
					}
				});

				result.modified++;
				logger.debug('migrateChildToChildren', `Migrated ${file.path}`);
			} catch (error) {
				result.errors.push({
					file: file.path,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}

		logger.info('migrateChildToChildren', `Migration complete`, result);
		return result;
	}
}
