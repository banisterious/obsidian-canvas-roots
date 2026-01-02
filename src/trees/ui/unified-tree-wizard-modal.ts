/**
 * Unified Tree Wizard Modal
 *
 * A multi-step wizard that combines canvas tree generation and PDF visual tree
 * generation into a single unified experience. Users select a person, tree type,
 * output format, and format-specific options before generating.
 *
 * Step flow:
 * 1. Person Selection (shared)
 * 2. Tree Type (shared)
 * 3. Output Format (canvas vs PDF)
 * 4a. Canvas Options → 5a. Canvas Preview → 6a. Canvas Output
 * 4b. PDF Options → 5b. PDF Output
 */

import { Modal, Setting, Notice, TFile, setIcon, normalizePath } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import { createLucideIcon, setLucideIcon, LucideIconName } from '../../ui/lucide-icons';
import type { PersonInfo } from '../../ui/person-picker';
import { TreePreviewRenderer } from '../../ui/tree-preview';
import { FamilyGraphService, TreeOptions } from '../../core/family-graph';
import { CanvasGenerator, CanvasGenerationOptions } from '../../core/canvas-generator';
import type { LayoutOptions } from '../../core/layout-engine';
import type { CanvasColor, ColorScheme, CanvasGroupingStrategy, LayoutType, RecentTreeInfo } from '../../settings';
import { ensureFolderExists } from '../../core/canvas-utils';
import { getLogger } from '../../core/logging';
import { isPersonNote } from '../../utils/note-type-detection';
import { VisualTreeService } from '../services/visual-tree-service';
import { VisualTreeSvgRenderer } from '../services/visual-tree-svg-renderer';
import { PdfReportRenderer } from '../../reports/services/pdf-report-renderer';
import { OdtGenerator } from '../../reports/services/odt-generator';
import type {
	VisualTreeOptions,
	VisualTreePageSize,
	VisualTreeOrientation,
	VisualTreeNodeContent,
	VisualTreeColorScheme,
	LargeTreeHandling,
	TreeSizeAnalysis
} from '../types/visual-tree-types';

const logger = getLogger('unified-tree-wizard');

/**
 * Wizard step identifiers
 */
type WizardStep =
	| 'person'
	| 'tree-type'
	| 'output-format'
	| 'canvas-options'
	| 'canvas-preview'
	| 'canvas-output'
	| 'excalidraw-style'
	| 'pdf-options'
	| 'pdf-output';

/**
 * Step configuration
 */
interface StepConfig {
	id: WizardStep;
	title: string;
	subtitle: string;
}

/**
 * All possible steps - actual flow depends on output format selection
 */
const ALL_STEPS: StepConfig[] = [
	{ id: 'person', title: 'Select person', subtitle: 'Choose the root person' },
	{ id: 'tree-type', title: 'Tree type', subtitle: 'Configure tree structure' },
	{ id: 'output-format', title: 'Output format', subtitle: 'Canvas or PDF' },
	{ id: 'canvas-options', title: 'Options', subtitle: 'Scope and style settings' },
	{ id: 'canvas-preview', title: 'Preview', subtitle: 'Review your tree' },
	{ id: 'canvas-output', title: 'Output', subtitle: 'Save location' },
	{ id: 'excalidraw-style', title: 'Style', subtitle: 'Drawing options' },
	{ id: 'pdf-options', title: 'Options', subtitle: 'Page and style settings' },
	{ id: 'pdf-output', title: 'Generate', subtitle: 'Create PDF' }
];

/**
 * Tree type options (unified across canvas and PDF)
 */
type TreeType = 'full' | 'ancestors' | 'descendants' | 'fan';

/**
 * Layout algorithm options (canvas only)
 */
type LayoutAlgorithm = 'standard' | 'compact' | 'timeline' | 'hourglass';

/**
 * Sort options for person list
 */
type PersonSortOption = 'name-asc' | 'name-desc' | 'birth-asc' | 'birth-desc';

/**
 * Filter options for person list
 */
interface PersonFilterOptions {
	sex: 'all' | 'male' | 'female' | 'unknown';
	hasConnections: boolean;
}

/**
 * Output format
 */
type OutputFormat = 'canvas' | 'excalidraw' | 'pdf' | 'odt';

/**
 * Unified form data for the wizard
 */
interface UnifiedWizardFormData {
	// Step 1: Person
	rootPerson: PersonInfo | null;

	// Step 2: Tree Type
	treeType: TreeType;
	direction: 'vertical' | 'horizontal';
	maxAncestorGenerations: number;
	maxDescendantGenerations: number;
	includeSpouses: boolean;

	// Step 3: Output Format
	outputFormat: OutputFormat;

	// Canvas-specific (Step 4a)
	includeStepParents: boolean;
	includeAdoptiveParents: boolean;
	collectionFilter: string;
	placeFilter: string;
	placeFilterTypes: Set<'birth' | 'death' | 'marriage' | 'burial'>;
	universeFilter: string;
	colorScheme: ColorScheme;
	parentChildArrowStyle: 'directed' | 'bidirectional' | 'undirected';
	spouseArrowStyle: 'directed' | 'bidirectional' | 'undirected';
	parentChildEdgeColor: CanvasColor;
	spouseEdgeColor: CanvasColor;
	showSpouseEdges: boolean;
	spouseEdgeLabelFormat: 'none' | 'date-only' | 'date-location' | 'full';
	layoutAlgorithm: LayoutAlgorithm;
	canvasGroupingStrategy: CanvasGroupingStrategy;

	// PDF-specific (Step 4b)
	pageSize: VisualTreePageSize;
	orientation: VisualTreeOrientation;
	nodeContent: VisualTreeNodeContent;
	pdfColorScheme: VisualTreeColorScheme;
	largeTreeHandling: LargeTreeHandling;

	// Excalidraw-specific
	excalidrawRoughness: 0 | 1 | 2;
	excalidrawFontFamily: 1 | 2 | 3 | 4 | 5 | 6 | 7;
	excalidrawFontSize: number;
	excalidrawStrokeWidth: number;
	excalidrawFillStyle: 'solid' | 'hachure' | 'cross-hatch';
	excalidrawStrokeStyle: 'solid' | 'dashed' | 'dotted';
	excalidrawNodeContent: 'name' | 'name-dates' | 'name-dates-places';

	// Output settings
	canvasName: string;
	saveFolder: string;
	openAfterGenerate: boolean;
	pdfTitle: string;
}

/**
 * Options for opening the unified wizard
 */
export interface UnifiedTreeWizardOptions {
	/** Pre-selected output format */
	outputFormat?: OutputFormat;
	/** Pre-selected tree type */
	treeType?: TreeType;
	/** Pre-selected person CR ID */
	personCrId?: string;
	/** Pre-selected person name */
	personName?: string;
	/** Callback when generation completes */
	onComplete?: (path: string) => void;
}

/**
 * Unified Tree Wizard Modal
 */
export class UnifiedTreeWizardModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private options: UnifiedTreeWizardOptions;
	private currentStepIndex: number = 0;

	// Form data
	private formData: UnifiedWizardFormData;

	// Services
	private graphService: FamilyGraphService;
	private visualTreeService: VisualTreeService;
	private pdfRenderer: PdfReportRenderer;

	// UI elements
	private contentContainer?: HTMLElement;
	private progressContainer?: HTMLElement;
	private previewRenderer?: TreePreviewRenderer;
	private previewContainer?: HTMLElement;

	// Person list for Step 1
	private allPeople: PersonInfo[] = [];
	private filteredPeople: PersonInfo[] = [];
	private searchQuery: string = '';
	private sortOption: PersonSortOption = 'name-asc';
	private filterOptions: PersonFilterOptions = {
		sex: 'all',
		hasConnections: false
	};
	private personListContainer?: HTMLElement;
	private personStepContainer?: HTMLElement;

	// PDF tree size analysis
	private treeSizeAnalysis: TreeSizeAnalysis | null = null;

	// Pre-selected person (resolved in onOpen)
	private preSelectedPersonCrId?: string;

	constructor(plugin: CanvasRootsPlugin, options?: UnifiedTreeWizardOptions) {
		super(plugin.app);
		this.plugin = plugin;
		this.options = options ?? {};

		// Initialize services
		this.graphService = new FamilyGraphService(plugin.app);
		this.graphService.setSettings(plugin.settings);
		this.graphService.setPropertyAliases(plugin.settings.propertyAliases);
		this.graphService.setValueAliases(plugin.settings.valueAliases);

		this.visualTreeService = new VisualTreeService(plugin.app, this.graphService);
		this.pdfRenderer = new PdfReportRenderer();

		// Initialize form data with defaults
		this.formData = {
			rootPerson: null,
			treeType: options?.treeType ?? 'full',
			direction: 'vertical',
			maxAncestorGenerations: 0,
			maxDescendantGenerations: 0,
			includeSpouses: true,
			outputFormat: options?.outputFormat ?? 'canvas',

			// Canvas defaults
			includeStepParents: true,
			includeAdoptiveParents: true,
			collectionFilter: '',
			placeFilter: '',
			placeFilterTypes: new Set(['birth', 'death']),
			universeFilter: '',
			colorScheme: plugin.settings.nodeColorScheme,
			parentChildArrowStyle: plugin.settings.parentChildArrowStyle,
			spouseArrowStyle: plugin.settings.spouseArrowStyle,
			parentChildEdgeColor: plugin.settings.parentChildEdgeColor,
			spouseEdgeColor: plugin.settings.spouseEdgeColor,
			showSpouseEdges: plugin.settings.showSpouseEdges,
			spouseEdgeLabelFormat: plugin.settings.spouseEdgeLabelFormat,
			layoutAlgorithm: plugin.settings.defaultLayoutType as LayoutAlgorithm,
			canvasGroupingStrategy: plugin.settings.canvasGroupingStrategy,

			// PDF defaults
			pageSize: 'letter',
			orientation: 'landscape',
			nodeContent: 'name-dates',
			pdfColorScheme: 'gender',
			largeTreeHandling: 'auto-page-size',

			// Excalidraw defaults
			excalidrawRoughness: 1,
			excalidrawFontFamily: 1,
			excalidrawFontSize: 16,
			excalidrawStrokeWidth: 2,
			excalidrawFillStyle: 'solid',
			excalidrawStrokeStyle: 'solid',
			excalidrawNodeContent: 'name-dates-places',

			// Output defaults
			canvasName: 'Family Tree',
			saveFolder: plugin.settings.canvasesFolder || '',
			openAfterGenerate: true,
			pdfTitle: ''
		};

		// Pre-selected person will be resolved in onOpen after loadPeople()
		this.preSelectedPersonCrId = options?.personCrId;
	}

	/**
	 * Find a person file by cr_id
	 */
	private findPersonFileByCrId(crId: string): TFile | null {
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter?.cr_id === crId) {
				return file;
			}
		}
		return null;
	}

	/**
	 * Get the current step flow based on output format
	 */
	private getStepFlow(): StepConfig[] {
		const baseSteps = ALL_STEPS.filter(s => ['person', 'tree-type', 'output-format'].includes(s.id));

		if (this.formData.outputFormat === 'excalidraw') {
			// Excalidraw has an extra style step
			return [
				...baseSteps,
				ALL_STEPS.find(s => s.id === 'canvas-options')!,
				ALL_STEPS.find(s => s.id === 'canvas-preview')!,
				ALL_STEPS.find(s => s.id === 'excalidraw-style')!,
				ALL_STEPS.find(s => s.id === 'canvas-output')!
			];
		} else if (this.formData.outputFormat === 'canvas') {
			// Canvas flow
			return [
				...baseSteps,
				ALL_STEPS.find(s => s.id === 'canvas-options')!,
				ALL_STEPS.find(s => s.id === 'canvas-preview')!,
				ALL_STEPS.find(s => s.id === 'canvas-output')!
			];
		} else {
			// PDF and ODT share the same options step
			return [
				...baseSteps,
				ALL_STEPS.find(s => s.id === 'pdf-options')!,
				ALL_STEPS.find(s => s.id === 'pdf-output')!
			];
		}
	}

	/**
	 * Get the current step config
	 */
	private getCurrentStep(): StepConfig {
		const flow = this.getStepFlow();
		return flow[this.currentStepIndex];
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass('crc-tree-wizard');
		this.modalEl.addClass('crc-unified-wizard');

		// Header
		const header = contentEl.createDiv({ cls: 'cr-wizard-header' });
		const titleContainer = header.createDiv({ cls: 'cr-wizard-title' });
		const icon = createLucideIcon('git-branch', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Generate family tree');

		// Progress indicator
		this.progressContainer = contentEl.createDiv({ cls: 'cr-wizard-progress' });
		this.renderProgress();

		// Content area
		this.contentContainer = contentEl.createDiv({ cls: 'cr-wizard-content' });

		// Load people for Step 1
		this.loadPeople();

		// Apply pre-selected person if provided
		if (this.preSelectedPersonCrId) {
			const person = this.allPeople.find(p => p.crId === this.preSelectedPersonCrId);
			if (person) {
				this.formData.rootPerson = person;
			}
		}

		this.renderCurrentStep();
	}

	onClose(): void {
		this.contentEl.empty();
		if (this.previewRenderer) {
			this.previewRenderer = undefined;
		}
	}

	/**
	 * Load all people from the vault
	 */
	private loadPeople(): void {
		const files = this.app.vault.getMarkdownFiles();
		this.allPeople = [];

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter?.cr_id) continue;

			const fm = cache.frontmatter;

			if (!isPersonNote(fm, cache)) {
				continue;
			}

			const rawName = fm.name;
			const name = typeof rawName === 'string' ? rawName : (Array.isArray(rawName) ? rawName.join(' ') : file.basename);

			// Note: Frontmatter uses 'born'/'died' properties
			const birthDate = fm.born instanceof Date ? fm.born.toISOString().split('T')[0] : fm.born;
			const deathDate = fm.died instanceof Date ? fm.died.toISOString().split('T')[0] : fm.died;

			this.allPeople.push({
				name,
				crId: fm.cr_id,
				birthDate,
				deathDate,
				sex: fm.sex,
				file
			});
		}

		this.applyFiltersAndSort();
	}

	/**
	 * Render the progress indicator
	 */
	private renderProgress(): void {
		if (!this.progressContainer) return;
		this.progressContainer.empty();

		const flow = this.getStepFlow();
		const stepsContainer = this.progressContainer.createDiv({ cls: 'cr-wizard-steps' });

		for (let i = 0; i < flow.length; i++) {
			const step = flow[i];
			const stepEl = stepsContainer.createDiv({
				cls: `cr-wizard-step ${i === this.currentStepIndex ? 'cr-wizard-step--active' : ''} ${i < this.currentStepIndex ? 'cr-wizard-step--completed' : ''}`
			});

			const stepNumber = stepEl.createDiv({ cls: 'cr-wizard-step-number' });
			if (i < this.currentStepIndex) {
				setLucideIcon(stepNumber, 'check', 14);
			} else {
				stepNumber.setText(String(i + 1));
			}

			const stepInfo = stepEl.createDiv({ cls: 'cr-wizard-step-info' });
			stepInfo.createDiv({ cls: 'cr-wizard-step-title', text: step.title });

			if (i < flow.length - 1) {
				stepsContainer.createDiv({
					cls: `cr-wizard-connector ${i < this.currentStepIndex ? 'cr-wizard-connector--completed' : ''}`
				});
			}
		}
	}

	/**
	 * Render the current step content
	 */
	private renderCurrentStep(): void {
		if (!this.contentContainer) return;
		this.contentContainer.empty();

		const step = this.getCurrentStep();
		const flow = this.getStepFlow();

		// Step header
		const stepHeader = this.contentContainer.createDiv({ cls: 'cr-wizard-step-header' });

		// Show badges for selections made in previous steps
		const badgeContainer = stepHeader.createDiv({ cls: 'cr-wizard-step-badges' });

		// Show tree type badge after step 2 (tree-type)
		if (this.currentStepIndex >= 2) {
			const treeTypeBadge = badgeContainer.createDiv({ cls: 'crc-wizard-chart-badge' });
			treeTypeBadge.createSpan({
				text: this.formData.outputFormat === 'pdf'
					? this.getPdfChartTypeLabel()
					: this.getTreeTypeLabel()
			});
		}

		// Show output format badge after step 3 (output-format)
		if (this.currentStepIndex >= 3) {
			const formatBadge = badgeContainer.createDiv({ cls: 'crc-wizard-chart-badge crc-wizard-chart-badge--secondary' });
			formatBadge.createSpan({
				text: this.getOutputFormatLabel()
			});
		}

		stepHeader.createEl('h3', { text: step.title, cls: 'cr-wizard-step-heading' });
		stepHeader.createEl('p', { text: `Step ${this.currentStepIndex + 1} of ${flow.length}`, cls: 'cr-wizard-step-counter' });

		// Step content
		const stepContent = this.contentContainer.createDiv({ cls: 'cr-wizard-step-content' });

		switch (step.id) {
			case 'person':
				this.renderPersonStep(stepContent);
				break;
			case 'tree-type':
				this.renderTreeTypeStep(stepContent);
				break;
			case 'output-format':
				this.renderOutputFormatStep(stepContent);
				break;
			case 'canvas-options':
				this.renderCanvasOptionsStep(stepContent);
				break;
			case 'canvas-preview':
				this.renderCanvasPreviewStep(stepContent);
				break;
			case 'canvas-output':
				this.renderCanvasOutputStep(stepContent);
				break;
			case 'excalidraw-style':
				this.renderExcalidrawStyleStep(stepContent);
				break;
			case 'pdf-options':
				this.renderPdfOptionsStep(stepContent);
				break;
			case 'pdf-output':
				this.renderPdfOutputStep(stepContent);
				break;
		}

		this.renderNavigation();
	}

	// ========== STEP 1: PERSON SELECTION ==========

	private renderPersonStep(container: HTMLElement): void {
		container.createEl('p', {
			text: 'Choose the person who will be at the center of your family tree.',
			cls: 'cr-wizard-step-desc'
		});

		// Selected person display
		if (this.formData.rootPerson) {
			const selectedContainer = container.createDiv({ cls: 'crc-wizard-selected-person' });
			this.renderSelectedPerson(selectedContainer);
		}

		// Store container reference for use by event handlers after re-renders
		this.personStepContainer = container;

		// Toolbar row
		const toolbarRow = container.createDiv({ cls: 'crc-wizard-toolbar' });

		// Search input
		const searchWrapper = toolbarRow.createDiv({ cls: 'crc-wizard-search-wrapper' });
		searchWrapper.appendChild(createLucideIcon('search', 16));

		const searchInput = searchWrapper.createEl('input', {
			type: 'text',
			placeholder: 'Search by name...',
			cls: 'crc-wizard-search-input'
		});
		searchInput.value = this.searchQuery;

		// Store list container reference as instance property
		this.personListContainer = container.createDiv({ cls: 'crc-wizard-person-list' });

		searchInput.addEventListener('input', (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value;
			this.applyFiltersAndSort();
			this.refreshPersonList();
		});

		// Sort dropdown
		const sortContainer = toolbarRow.createDiv({ cls: 'crc-wizard-sort' });
		const sortSelect = sortContainer.createEl('select', { cls: 'crc-wizard-select' });

		const sortOptions: { value: PersonSortOption; label: string }[] = [
			{ value: 'name-asc', label: 'Name A-Z' },
			{ value: 'name-desc', label: 'Name Z-A' },
			{ value: 'birth-asc', label: 'Birth (oldest)' },
			{ value: 'birth-desc', label: 'Birth (newest)' }
		];

		for (const opt of sortOptions) {
			const option = sortSelect.createEl('option', { value: opt.value, text: opt.label });
			if (opt.value === this.sortOption) option.selected = true;
		}

		sortSelect.addEventListener('change', () => {
			this.sortOption = sortSelect.value as PersonSortOption;
			this.applyFiltersAndSort();
			this.refreshPersonList();
		});

		// Filter row
		const filterRow = container.createDiv({ cls: 'crc-wizard-filters' });

		// Sex filter
		const sexFilter = filterRow.createDiv({ cls: 'crc-wizard-filter-group' });
		sexFilter.createSpan({ text: 'Sex:', cls: 'crc-wizard-filter-label' });

		const sexOptions: { value: 'all' | 'male' | 'female' | 'unknown'; label: string }[] = [
			{ value: 'all', label: 'All' },
			{ value: 'male', label: 'Male' },
			{ value: 'female', label: 'Female' },
			{ value: 'unknown', label: 'Unknown' }
		];

		for (const opt of sexOptions) {
			const chip = sexFilter.createEl('button', {
				text: opt.label,
				cls: `crc-wizard-filter-chip ${this.filterOptions.sex === opt.value ? 'crc-wizard-filter-chip--active' : ''}`
			});
			chip.addEventListener('click', () => {
				this.filterOptions.sex = opt.value;
				// Update active state on all chips
				sexFilter.querySelectorAll('.crc-wizard-filter-chip').forEach(c => {
					c.removeClass('crc-wizard-filter-chip--active');
				});
				chip.addClass('crc-wizard-filter-chip--active');
				this.applyFiltersAndSort();
				this.refreshPersonList();
			});
		}

		// Has connections filter
		const connectionsFilter = filterRow.createDiv({ cls: 'crc-wizard-filter-group' });
		const connectionsLabel = connectionsFilter.createEl('label', { cls: 'crc-wizard-filter-toggle' });
		const connectionsCheckbox = connectionsLabel.createEl('input', { type: 'checkbox' });
		connectionsCheckbox.checked = this.filterOptions.hasConnections;
		connectionsLabel.appendText('Has family connections');

		connectionsCheckbox.addEventListener('change', () => {
			this.filterOptions.hasConnections = connectionsCheckbox.checked;
			this.applyFiltersAndSort();
			this.refreshPersonList();
		});

		// Results count
		const resultsCount = container.createDiv({ cls: 'crc-wizard-results-count' });
		resultsCount.createSpan({ text: `${this.filteredPeople.length} of ${this.allPeople.length} people` });

		this.renderPersonList(this.personListContainer);
	}

	/**
	 * Refresh the person list using instance property references
	 * This ensures we always use the current DOM elements after re-renders
	 */
	private refreshPersonList(): void {
		if (this.personListContainer) {
			this.renderPersonList(this.personListContainer);
		}
		if (this.personStepContainer) {
			this.updateResultsCount(this.personStepContainer);
		}
	}

	/**
	 * Update the results count display
	 */
	private updateResultsCount(container: HTMLElement): void {
		const resultsDiv = container.querySelector('.crc-wizard-results-count');
		if (resultsDiv) {
			resultsDiv.empty();
			resultsDiv.createSpan({ text: `${this.filteredPeople.length} of ${this.allPeople.length} people` });
		}
	}

	private renderSelectedPerson(container: HTMLElement): void {
		container.empty();
		const person = this.formData.rootPerson;
		if (!person) return;

		const card = container.createDiv({ cls: 'crc-wizard-selected-card' });
		card.appendChild(createLucideIcon('user', 20));

		const info = card.createDiv({ cls: 'crc-wizard-selected-info' });
		info.createDiv({ cls: 'crc-wizard-selected-name', text: person.name });

		const dates = this.formatDates(person.birthDate, person.deathDate);
		if (dates) {
			info.createDiv({ cls: 'crc-wizard-selected-dates', text: dates });
		}

		const clearBtn = card.createEl('button', {
			cls: 'crc-wizard-clear-btn',
			attr: { type: 'button', 'aria-label': 'Clear selection' }
		});
		setLucideIcon(clearBtn, 'x', 16);
		clearBtn.addEventListener('click', () => {
			this.formData.rootPerson = null;
			this.formData.canvasName = '';
			this.formData.pdfTitle = '';
			this.renderCurrentStep();
		});
	}

	private applyFiltersAndSort(): void {
		const query = this.searchQuery.toLowerCase().trim();
		let result = [...this.allPeople];

		if (query) {
			result = result.filter(p => p.name.toLowerCase().includes(query));
		}

		if (this.filterOptions.sex !== 'all') {
			result = result.filter(p => {
				const sex = p.sex?.toLowerCase();
				if (this.filterOptions.sex === 'male') return sex === 'm' || sex === 'male';
				if (this.filterOptions.sex === 'female') return sex === 'f' || sex === 'female';
				if (this.filterOptions.sex === 'unknown') return !sex || (sex !== 'm' && sex !== 'male' && sex !== 'f' && sex !== 'female');
				return true;
			});
		}

		if (this.filterOptions.hasConnections) {
			result = result.filter(p => {
				const cache = this.app.metadataCache.getFileCache(p.file);
				const fm = cache?.frontmatter;
				if (!fm) return false;
				return fm.father || fm.mother || fm.spouse || fm.spouses || fm.children || fm.siblings || fm.partners;
			});
		}

		result.sort((a, b) => {
			switch (this.sortOption) {
				case 'name-asc': return a.name.localeCompare(b.name);
				case 'name-desc': return b.name.localeCompare(a.name);
				case 'birth-asc': return this.compareDates(a.birthDate, b.birthDate, true);
				case 'birth-desc': return this.compareDates(a.birthDate, b.birthDate, false);
				default: return 0;
			}
		});

		this.filteredPeople = result;
	}

	private compareDates(dateA?: string, dateB?: string, ascending: boolean = true): number {
		if (!dateA && !dateB) return 0;
		if (!dateA) return 1;
		if (!dateB) return -1;

		const yearA = this.extractYear(dateA);
		const yearB = this.extractYear(dateB);

		if (yearA === null && yearB === null) return 0;
		if (yearA === null) return 1;
		if (yearB === null) return -1;

		return ascending ? yearA - yearB : yearB - yearA;
	}

	private extractYear(date: string): number | null {
		const match = date.match(/(\d{4})/);
		return match ? parseInt(match[1], 10) : null;
	}

	private renderPersonList(container: HTMLElement): void {
		container.empty();

		if (this.filteredPeople.length === 0) {
			container.createDiv({
				cls: 'crc-wizard-empty',
				text: this.searchQuery ? 'No people match your search.' : 'No people found in vault.'
			});
			return;
		}

		const displayLimit = 50;
		const displayPeople = this.filteredPeople.slice(0, displayLimit);

		for (const person of displayPeople) {
			const isSelected = this.formData.rootPerson?.crId === person.crId;
			const row = container.createDiv({
				cls: `crc-wizard-person-row ${isSelected ? 'crc-wizard-person-row--selected' : ''}`
			});

			row.createEl('input', {
				type: 'radio',
				attr: {
					name: 'root-person',
					value: person.crId,
					...(isSelected ? { checked: 'true' } : {})
				}
			});

			const info = row.createDiv({ cls: 'crc-wizard-person-info' });
			info.createDiv({ cls: 'crc-wizard-person-name', text: person.name });

			const dates = this.formatDates(person.birthDate, person.deathDate);
			if (dates) {
				info.createDiv({ cls: 'crc-wizard-person-dates', text: dates });
			}

			row.addEventListener('click', () => {
				this.formData.rootPerson = person;
				// Auto-populate canvas name if it's empty or still the default
				if (!this.formData.canvasName || this.formData.canvasName === 'Family Tree') {
					this.formData.canvasName = `${person.name} - Family Tree`;
				}
				if (!this.formData.pdfTitle) {
					this.formData.pdfTitle = `${person.name} - ${this.getTreeTypeLabel()}`;
				}
				this.renderCurrentStep();
			});
		}

		if (this.filteredPeople.length > displayLimit) {
			container.createDiv({
				cls: 'crc-wizard-more',
				text: `Showing ${displayLimit} of ${this.filteredPeople.length} people. Refine your search to see more.`
			});
		}
	}

	// ========== STEP 2: TREE TYPE ==========

	private renderTreeTypeStep(container: HTMLElement): void {
		container.createEl('p', {
			text: 'Choose how your family tree should be structured.',
			cls: 'cr-wizard-step-desc'
		});

		const form = container.createDiv({ cls: 'cr-wizard-form' });

		// Tree type selection
		form.createEl('div', { cls: 'cr-wizard-subsection', text: 'Tree type' });

		const treeTypeContainer = form.createDiv({ cls: 'crc-wizard-tree-types' });

		const treeTypes: { id: TreeType; label: string; desc: string; icon: LucideIconName; pdfOnly?: boolean }[] = [
			{ id: 'full', label: 'Full tree', desc: 'Ancestors and descendants', icon: 'cr-hourglass-tree' as LucideIconName },
			{ id: 'ancestors', label: 'Ancestors', desc: 'Parents, grandparents, etc.', icon: 'cr-pedigree-tree' as LucideIconName },
			{ id: 'descendants', label: 'Descendants', desc: 'Children, grandchildren, etc.', icon: 'cr-descendant-tree' as LucideIconName },
			{ id: 'fan', label: 'Fan chart', desc: 'Semicircular pedigree', icon: 'cr-fan-chart' as LucideIconName, pdfOnly: true }
		];

		for (const type of treeTypes) {
			const isDisabled = type.pdfOnly && this.formData.outputFormat === 'canvas';
			const card = treeTypeContainer.createDiv({
				cls: `crc-wizard-type-card ${this.formData.treeType === type.id ? 'crc-wizard-type-card--selected' : ''} ${isDisabled ? 'crc-wizard-type-card--disabled' : ''}`
			});

			card.appendChild(createLucideIcon(type.icon, 24));

			const info = card.createDiv({ cls: 'crc-wizard-type-info' });
			info.createDiv({ cls: 'crc-wizard-type-label', text: type.label });
			info.createDiv({ cls: 'crc-wizard-type-desc', text: type.desc });

			if (type.pdfOnly) {
				info.createDiv({ cls: 'crc-wizard-type-badge', text: 'PDF only' });
			}

			if (!isDisabled) {
				card.addEventListener('click', () => {
					this.formData.treeType = type.id;
					this.renderCurrentStep();
				});
			}
		}

		// Direction - only show for canvas, or for PDF pedigree/descendant (not hourglass/fan)
		const showDirection = this.formData.outputFormat === 'canvas' ||
			(this.formData.outputFormat === 'pdf' &&
				this.formData.treeType !== 'full' &&
				this.formData.treeType !== 'fan');

		if (showDirection) {
			new Setting(form)
				.setName('Direction')
				.setDesc('Primary flow direction of the tree')
				.addDropdown(dropdown => dropdown
					.addOption('vertical', 'Vertical (top to bottom)')
					.addOption('horizontal', 'Horizontal (left to right)')
					.setValue(this.formData.direction)
					.onChange(value => {
						this.formData.direction = value as 'vertical' | 'horizontal';
					}));
		}

		// Generation limits
		if (this.formData.treeType !== 'descendants') {
			new Setting(form)
				.setName('Ancestor generations')
				.setDesc('Maximum ancestor generations (0 = unlimited)')
				.addSlider(slider => slider
					.setLimits(0, 10, 1)
					.setValue(this.formData.maxAncestorGenerations)
					.setDynamicTooltip()
					.onChange(value => {
						this.formData.maxAncestorGenerations = value;
					}));
		}

		if (this.formData.treeType !== 'ancestors' && this.formData.treeType !== 'fan') {
			new Setting(form)
				.setName('Descendant generations')
				.setDesc('Maximum descendant generations (0 = unlimited)')
				.addSlider(slider => slider
					.setLimits(0, 10, 1)
					.setValue(this.formData.maxDescendantGenerations)
					.setDynamicTooltip()
					.onChange(value => {
						this.formData.maxDescendantGenerations = value;
					}));
		}

		// Include spouses
		new Setting(form)
			.setName('Include spouses')
			.setDesc('Show spouse nodes alongside each person')
			.addToggle(toggle => toggle
				.setValue(this.formData.includeSpouses)
				.onChange(value => {
					this.formData.includeSpouses = value;
				}));
	}

	// ========== STEP 3: OUTPUT FORMAT ==========

	private renderOutputFormatStep(container: HTMLElement): void {
		container.createEl('p', {
			text: 'Choose how you want to output your family tree.',
			cls: 'cr-wizard-step-desc'
		});

		const formatContainer = container.createDiv({ cls: 'crc-wizard-output-formats' });

		// Canvas card
		const canvasCard = formatContainer.createDiv({
			cls: `crc-wizard-format-card ${this.formData.outputFormat === 'canvas' ? 'crc-wizard-format-card--selected' : ''}`
		});

		const canvasIcon = canvasCard.createDiv({ cls: 'crc-wizard-format-icon' });
		canvasIcon.appendChild(createLucideIcon('layout-dashboard', 20));

		const canvasInfo = canvasCard.createDiv({ cls: 'crc-wizard-format-info' });
		canvasInfo.createDiv({ cls: 'crc-wizard-format-title', text: 'Obsidian Canvas' });
		canvasInfo.createDiv({ cls: 'crc-wizard-format-desc', text: 'Interactive tree you can edit and explore' });

		const canvasFeatures = canvasInfo.createEl('ul', { cls: 'crc-wizard-format-features' });
		canvasFeatures.createEl('li', { text: 'Click nodes to open notes' });
		canvasFeatures.createEl('li', { text: 'Pan, zoom, and edit layout' });

		canvasCard.addEventListener('click', () => {
			this.formData.outputFormat = 'canvas';
			// Reset fan chart if selected (canvas doesn't support it)
			if (this.formData.treeType === 'fan') {
				this.formData.treeType = 'ancestors';
			}
			this.renderProgress();
			this.renderCurrentStep();
		});

		// Excalidraw card
		const excalidrawCard = formatContainer.createDiv({
			cls: `crc-wizard-format-card ${this.formData.outputFormat === 'excalidraw' ? 'crc-wizard-format-card--selected' : ''}`
		});

		const excalidrawIcon = excalidrawCard.createDiv({ cls: 'crc-wizard-format-icon' });
		excalidrawIcon.appendChild(createLucideIcon('edit', 20));

		const excalidrawInfo = excalidrawCard.createDiv({ cls: 'crc-wizard-format-info' });
		excalidrawInfo.createDiv({ cls: 'crc-wizard-format-title', text: 'Excalidraw' });
		excalidrawInfo.createDiv({ cls: 'crc-wizard-format-desc', text: 'Hand-drawn style diagram for annotation' });

		const excalidrawFeatures = excalidrawInfo.createEl('ul', { cls: 'crc-wizard-format-features' });
		excalidrawFeatures.createEl('li', { text: 'Annotate with drawings and text' });
		excalidrawFeatures.createEl('li', { text: 'Export to SVG or PNG' });

		excalidrawCard.addEventListener('click', () => {
			this.formData.outputFormat = 'excalidraw';
			// Reset fan chart if selected (excalidraw doesn't support it)
			if (this.formData.treeType === 'fan') {
				this.formData.treeType = 'ancestors';
			}
			this.renderProgress();
			this.renderCurrentStep();
		});

		// PDF card
		const pdfCard = formatContainer.createDiv({
			cls: `crc-wizard-format-card ${this.formData.outputFormat === 'pdf' ? 'crc-wizard-format-card--selected' : ''}`
		});

		const pdfIcon = pdfCard.createDiv({ cls: 'crc-wizard-format-icon' });
		pdfIcon.appendChild(createLucideIcon('file-image', 20));

		const pdfInfo = pdfCard.createDiv({ cls: 'crc-wizard-format-info' });
		pdfInfo.createDiv({ cls: 'crc-wizard-format-title', text: 'PDF Document' });
		pdfInfo.createDiv({ cls: 'crc-wizard-format-desc', text: 'Printable tree diagram you can share' });

		const pdfFeatures = pdfInfo.createEl('ul', { cls: 'crc-wizard-format-features' });
		pdfFeatures.createEl('li', { text: 'Print on paper up to 24×36"' });
		pdfFeatures.createEl('li', { text: 'Multiple page sizes available' });

		pdfCard.addEventListener('click', () => {
			this.formData.outputFormat = 'pdf';
			this.renderProgress();
			this.renderCurrentStep();
		});

		// ODT card
		const odtCard = formatContainer.createDiv({
			cls: `crc-wizard-format-card ${this.formData.outputFormat === 'odt' ? 'crc-wizard-format-card--selected' : ''}`
		});

		const odtIcon = odtCard.createDiv({ cls: 'crc-wizard-format-icon' });
		odtIcon.appendChild(createLucideIcon('file-text', 20));

		const odtInfo = odtCard.createDiv({ cls: 'crc-wizard-format-info' });
		odtInfo.createDiv({ cls: 'crc-wizard-format-title', text: 'ODT Document' });
		odtInfo.createDiv({ cls: 'crc-wizard-format-desc', text: 'Editable document for word processors' });

		const odtFeatures = odtInfo.createEl('ul', { cls: 'crc-wizard-format-features' });
		odtFeatures.createEl('li', { text: 'Open in LibreOffice or Word' });
		odtFeatures.createEl('li', { text: 'Add text before printing' });

		odtCard.addEventListener('click', () => {
			this.formData.outputFormat = 'odt';
			this.renderProgress();
			this.renderCurrentStep();
		});
	}

	// ========== CANVAS OPTIONS STEP ==========

	private renderCanvasOptionsStep(container: HTMLElement): void {
		container.createEl('p', {
			text: 'Configure additional scope and style options.',
			cls: 'cr-wizard-step-desc'
		});

		const form = container.createDiv({ cls: 'cr-wizard-form crc-wizard-options-form' });

		// Scope section
		const scopeDetails = form.createEl('details', { cls: 'crc-wizard-details' });
		scopeDetails.open = true;
		const scopeSummary = scopeDetails.createEl('summary', { cls: 'crc-wizard-details-summary' });
		scopeSummary.createSpan({ text: 'Scope options', cls: 'crc-wizard-details-title' });

		const scopeContent = scopeDetails.createDiv({ cls: 'crc-wizard-details-content' });

		new Setting(scopeContent)
			.setName('Include step-parents')
			.setDesc('Show step-parent relationships with dashed lines')
			.addToggle(toggle => toggle
				.setValue(this.formData.includeStepParents)
				.onChange(value => { this.formData.includeStepParents = value; }));

		new Setting(scopeContent)
			.setName('Include adoptive parents')
			.setDesc('Show adoptive parent relationships with dotted lines')
			.addToggle(toggle => toggle
				.setValue(this.formData.includeAdoptiveParents)
				.onChange(value => { this.formData.includeAdoptiveParents = value; }));

		const collections = this.graphService.getUserCollections();
		if (collections.length > 0) {
			new Setting(scopeContent)
				.setName('Filter by collection')
				.setDesc('Limit tree to people in a specific collection')
				.addDropdown(dropdown => {
					dropdown.addOption('', 'All collections (no filter)');
					for (const collection of collections) {
						dropdown.addOption(collection.name, collection.name);
					}
					dropdown.setValue(this.formData.collectionFilter);
					dropdown.onChange(value => { this.formData.collectionFilter = value; });
				});
		}

		new Setting(scopeContent)
			.setName('Filter by place')
			.setDesc('Limit tree to people associated with a specific place')
			.addText(text => text
				.setPlaceholder('e.g., London, England')
				.setValue(this.formData.placeFilter)
				.onChange(value => { this.formData.placeFilter = value; }));

		// Style section
		const styleDetails = form.createEl('details', { cls: 'crc-wizard-details' });
		styleDetails.open = false;
		const styleSummary = styleDetails.createEl('summary', { cls: 'crc-wizard-details-summary' });
		styleSummary.createSpan({ text: 'Style options', cls: 'crc-wizard-details-title' });
		styleSummary.createSpan({ text: '(uses global settings by default)', cls: 'crc-wizard-details-hint' });

		const styleContent = styleDetails.createDiv({ cls: 'crc-wizard-details-content' });

		new Setting(styleContent)
			.setName('Layout algorithm')
			.setDesc('How nodes are arranged on the canvas')
			.addDropdown(dropdown => dropdown
				.addOption('standard', 'Standard')
				.addOption('compact', 'Compact')
				.addOption('timeline', 'Timeline (chronological)')
				.addOption('hourglass', 'Hourglass')
				.setValue(this.formData.layoutAlgorithm)
				.onChange(value => { this.formData.layoutAlgorithm = value as LayoutAlgorithm; }));

		new Setting(styleContent)
			.setName('Canvas grouping')
			.setDesc('Visual groups to organize related nodes')
			.addDropdown(dropdown => dropdown
				.addOption('none', 'None')
				.addOption('generation', 'By generation')
				.addOption('nuclear-family', 'By couples')
				.addOption('collection', 'By collection')
				.setValue(this.formData.canvasGroupingStrategy)
				.onChange(value => { this.formData.canvasGroupingStrategy = value as CanvasGroupingStrategy; }));

		new Setting(styleContent)
			.setName('Node coloring')
			.setDesc('How nodes are colored on the canvas')
			.addDropdown(dropdown => dropdown
				.addOption('sex', 'By sex (green/purple)')
				.addOption('generation', 'By generation (gradient)')
				.addOption('collection', 'By collection')
				.addOption('monochrome', 'Monochrome (neutral)')
				.setValue(this.formData.colorScheme)
				.onChange(value => { this.formData.colorScheme = value as ColorScheme; }));

		new Setting(styleContent)
			.setName('Parent-child arrows')
			.addDropdown(dropdown => dropdown
				.addOption('directed', 'Directed (arrow)')
				.addOption('bidirectional', 'Bidirectional (double arrow)')
				.addOption('undirected', 'Undirected (line)')
				.setValue(this.formData.parentChildArrowStyle)
				.onChange(value => { this.formData.parentChildArrowStyle = value as 'directed' | 'bidirectional' | 'undirected'; }));

		new Setting(styleContent)
			.setName('Spouse arrows')
			.addDropdown(dropdown => dropdown
				.addOption('directed', 'Directed (arrow)')
				.addOption('bidirectional', 'Bidirectional (double arrow)')
				.addOption('undirected', 'Undirected (line)')
				.setValue(this.formData.spouseArrowStyle)
				.onChange(value => { this.formData.spouseArrowStyle = value as 'directed' | 'bidirectional' | 'undirected'; }));

		new Setting(styleContent)
			.setName('Show spouse edges')
			.setDesc('Display marriage/partnership relationship edges')
			.addToggle(toggle => toggle
				.setValue(this.formData.showSpouseEdges)
				.onChange(value => { this.formData.showSpouseEdges = value; }));
	}

	// ========== CANVAS PREVIEW STEP ==========

	private renderCanvasPreviewStep(container: HTMLElement): void {
		const person = this.formData.rootPerson;
		if (!person) {
			container.createEl('p', {
				text: 'No root person selected. Go back to Step 1.',
				cls: 'cr-wizard-step-desc'
			});
			return;
		}

		container.createEl('p', {
			text: 'Preview your tree before generating. Pan and zoom to explore.',
			cls: 'cr-wizard-step-desc'
		});

		this.previewContainer = container.createDiv({ cls: 'crc-wizard-preview-container' });

		const controls = container.createDiv({ cls: 'crc-wizard-preview-controls' });

		const zoomInBtn = controls.createEl('button', { cls: 'cr-btn cr-btn--small cr-btn--icon' });
		setIcon(zoomInBtn, 'zoom-in');
		zoomInBtn.addEventListener('click', () => this.previewRenderer?.zoomIn());

		const zoomOutBtn = controls.createEl('button', { cls: 'cr-btn cr-btn--small cr-btn--icon' });
		setIcon(zoomOutBtn, 'zoom-out');
		zoomOutBtn.addEventListener('click', () => this.previewRenderer?.zoomOut());

		const resetBtn = controls.createEl('button', { cls: 'cr-btn cr-btn--small cr-btn--icon' });
		setIcon(resetBtn, 'maximize-2');
		resetBtn.addEventListener('click', () => this.previewRenderer?.resetView());

		const summary = container.createDiv({ cls: 'crc-wizard-preview-summary' });

		this.buildCanvasPreview(summary);
	}

	private buildCanvasPreview(summaryContainer: HTMLElement): void {
		if (!this.previewContainer || !this.formData.rootPerson) return;

		this.previewContainer.empty();
		const loading = this.previewContainer.createDiv({ cls: 'crc-wizard-loading' });
		loading.createSpan({ text: 'Building tree...' });

		try {
			const treeOptions = this.buildTreeOptions();
			const familyTree = this.graphService.generateTree(treeOptions);

			if (!familyTree || familyTree.nodes.size === 0) {
				this.previewContainer.empty();
				this.previewContainer.createDiv({
					cls: 'crc-wizard-empty',
					text: 'No family connections found for this person.'
				});
				return;
			}

			const nodeCount = familyTree.nodes.size;

			summaryContainer.empty();
			summaryContainer.createSpan({ text: `${nodeCount} people in tree` });

			if (nodeCount > 200) {
				this.previewContainer.empty();
				this.previewContainer.createDiv({
					cls: 'crc-wizard-warning',
					text: `Tree has ${nodeCount} people - too large for preview. The canvas will still generate correctly.`
				});
				return;
			}

			this.previewContainer.empty();
			this.previewRenderer = new TreePreviewRenderer(this.previewContainer);
			this.previewRenderer.setColorScheme(this.formData.colorScheme);

			const layoutOptions: LayoutOptions = {
				direction: this.formData.direction,
				nodeWidth: this.plugin.settings.defaultNodeWidth,
				nodeHeight: this.plugin.settings.defaultNodeHeight,
				nodeSpacingX: this.plugin.settings.horizontalSpacing,
				nodeSpacingY: this.plugin.settings.verticalSpacing,
				layoutType: this.formData.layoutAlgorithm
			};

			this.previewRenderer.renderPreview(familyTree, layoutOptions);

		} catch (error) {
			console.error('Error building preview:', error);
			this.previewContainer.empty();
			this.previewContainer.createDiv({
				cls: 'crc-wizard-error',
				text: 'Error building preview. Check console for details.'
			});
		}
	}

	// ========== CANVAS OUTPUT STEP ==========

	private renderCanvasOutputStep(container: HTMLElement): void {
		container.createEl('p', {
			text: 'Configure where and how to save your canvas tree.',
			cls: 'cr-wizard-step-desc'
		});

		const form = container.createDiv({ cls: 'cr-wizard-form' });

		new Setting(form)
			.setName('Canvas name')
			.setDesc('Name for the generated canvas file')
			.addText(text => text
				.setPlaceholder('Family Tree')
				.setValue(this.formData.canvasName)
				.onChange(value => {
					this.formData.canvasName = value;
					// Re-render navigation to update generate button state
					this.renderNavigation();
				}));

		new Setting(form)
			.setName('Save location')
			.setDesc('Folder where the canvas will be saved')
			.addText(text => {
				text.setPlaceholder('/')
					.setValue(this.formData.saveFolder)
					.onChange(value => { this.formData.saveFolder = value; });
			});

		new Setting(form)
			.setName('Open after generation')
			.setDesc('Automatically open the canvas after it is created')
			.addToggle(toggle => toggle
				.setValue(this.formData.openAfterGenerate)
				.onChange(value => { this.formData.openAfterGenerate = value; }));

		// Summary
		const summarySection = form.createDiv({ cls: 'crc-wizard-output-summary' });
		summarySection.createEl('h4', { text: 'Summary', cls: 'cr-wizard-subsection' });

		const summaryList = summarySection.createEl('ul', { cls: 'crc-wizard-summary-list' });
		summaryList.createEl('li', { text: `Root person: ${this.formData.rootPerson?.name || 'Not selected'}` });
		summaryList.createEl('li', { text: `Tree type: ${this.getTreeTypeLabel()}` });
		summaryList.createEl('li', { text: `Layout: ${this.formData.layoutAlgorithm}, ${this.formData.direction}` });
		summaryList.createEl('li', { text: `Spouses: ${this.formData.includeSpouses ? 'Included' : 'Not included'}` });
	}

	// ========== EXCALIDRAW STYLE STEP ==========

	private renderExcalidrawStyleStep(container: HTMLElement): void {
		container.createEl('p', {
			text: 'Configure the drawing style for your Excalidraw tree.',
			cls: 'cr-wizard-step-desc'
		});

		const form = container.createDiv({ cls: 'cr-wizard-form' });

		// Node content level
		new Setting(form)
			.setName('Node content')
			.setDesc('What information to show in each person box')
			.addDropdown(dropdown => dropdown
				.addOption('name', 'Name only')
				.addOption('name-dates', 'Name and dates')
				.addOption('name-dates-places', 'Name, dates, and places')
				.setValue(this.formData.excalidrawNodeContent)
				.onChange(value => {
					this.formData.excalidrawNodeContent = value as 'name' | 'name-dates' | 'name-dates-places';
				}));

		// Drawing style (roughness)
		const roughnessDescriptions: Record<number, string> = {
			0: 'Clean, precise lines',
			1: 'Natural hand-drawn look',
			2: 'Expressive cartoon style'
		};
		const roughnessSetting = new Setting(form)
			.setName('Drawing style')
			.setDesc(roughnessDescriptions[this.formData.excalidrawRoughness])
			.addDropdown(dropdown => dropdown
				.addOption('0', 'Architect (clean)')
				.addOption('1', 'Artist (natural)')
				.addOption('2', 'Cartoonist (rough)')
				.setValue(String(this.formData.excalidrawRoughness))
				.onChange(value => {
					this.formData.excalidrawRoughness = parseInt(value) as 0 | 1 | 2;
					roughnessSetting.setDesc(roughnessDescriptions[this.formData.excalidrawRoughness]);
				}));

		// Font family
		new Setting(form)
			.setName('Font')
			.setDesc('Font style for text labels')
			.addDropdown(dropdown => dropdown
				.addOption('1', 'Virgil (hand-drawn)')
				.addOption('5', 'Excalifont (hand-drawn)')
				.addOption('4', 'Comic Shanns (comic)')
				.addOption('2', 'Helvetica (clean)')
				.addOption('6', 'Nunito (rounded)')
				.addOption('7', 'Lilita One (display)')
				.addOption('3', 'Cascadia (monospace)')
				.setValue(String(this.formData.excalidrawFontFamily))
				.onChange(value => {
					this.formData.excalidrawFontFamily = parseInt(value) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
				}));

		// Font size
		new Setting(form)
			.setName('Font size')
			.setDesc('Size of text labels')
			.addSlider(slider => slider
				.setLimits(10, 32, 2)
				.setValue(this.formData.excalidrawFontSize)
				.setDynamicTooltip()
				.onChange(value => { this.formData.excalidrawFontSize = value; }));

		// Fill style
		new Setting(form)
			.setName('Fill style')
			.setDesc('How shapes are filled')
			.addDropdown(dropdown => dropdown
				.addOption('solid', 'Solid')
				.addOption('hachure', 'Hachure (diagonal lines)')
				.addOption('cross-hatch', 'Cross-hatch')
				.setValue(this.formData.excalidrawFillStyle)
				.onChange(value => {
					this.formData.excalidrawFillStyle = value as 'solid' | 'hachure' | 'cross-hatch';
				}));
	}

	// ========== PDF OPTIONS STEP ==========

	private renderPdfOptionsStep(container: HTMLElement): void {
		container.createEl('p', {
			text: 'Configure page and style settings for your PDF.',
			cls: 'cr-wizard-step-desc'
		});

		const form = container.createDiv({ cls: 'cr-wizard-form' });

		new Setting(form)
			.setName('Page size')
			.addDropdown(dropdown => dropdown
				.addOption('letter', 'Letter (8.5 x 11 in)')
				.addOption('a4', 'A4 (210 x 297 mm)')
				.addOption('legal', 'Legal (8.5 x 14 in)')
				.addOption('tabloid', 'Tabloid (11 x 17 in)')
				.addOption('a3', 'A3 (297 x 420 mm)')
				.addOption('arch-d', 'Arch D (24 x 36 in)')
				.setValue(this.formData.pageSize)
				.onChange(value => {
					this.formData.pageSize = value as VisualTreePageSize;
					this.analyzeTreeAndUpdateWarning(form);
				}));

		new Setting(form)
			.setName('Orientation')
			.addDropdown(dropdown => dropdown
				.addOption('landscape', 'Landscape')
				.addOption('portrait', 'Portrait')
				.setValue(this.formData.orientation)
				.onChange(value => {
					this.formData.orientation = value as VisualTreeOrientation;
					this.analyzeTreeAndUpdateWarning(form);
				}));

		new Setting(form)
			.setName('Node content')
			.setDesc('What to display in each box')
			.addDropdown(dropdown => dropdown
				.addOption('name', 'Name only')
				.addOption('name-dates', 'Name + dates')
				.addOption('name-dates-places', 'Name + dates + places')
				.setValue(this.formData.nodeContent)
				.onChange(value => { this.formData.nodeContent = value as VisualTreeNodeContent; }));

		new Setting(form)
			.setName('Color scheme')
			.addDropdown(dropdown => dropdown
				.addOption('default', 'Default (theme colors)')
				.addOption('gender', 'By gender (blue/pink)')
				.addOption('generation', 'By generation (rainbow)')
				.addOption('grayscale', 'Grayscale (for printing)')
				.setValue(this.formData.pdfColorScheme)
				.onChange(value => { this.formData.pdfColorScheme = value as VisualTreeColorScheme; }));

		// Large tree warning placeholder (hidden by default via CSS)
		const warningContainer = form.createDiv({ cls: 'cr-large-tree-warning cr-hidden' });
		warningContainer.setAttribute('data-warning-container', 'true');

		// Run initial analysis
		if (this.formData.rootPerson) {
			this.analyzeTreeAndUpdateWarning(form);
		}
	}

	private analyzeTreeAndUpdateWarning(form: HTMLElement): void {
		if (!this.formData.rootPerson) return;

		const warningContainer = form.querySelector('[data-warning-container]') as HTMLElement;
		if (!warningContainer) return;

		const maxGenerations = this.formData.treeType === 'ancestors' || this.formData.treeType === 'fan'
			? this.formData.maxAncestorGenerations || 5
			: this.formData.maxDescendantGenerations || 5;

		const options: VisualTreeOptions = {
			rootPersonCrId: this.formData.rootPerson.crId,
			chartType: this.formData.treeType === 'full' ? 'hourglass' :
				this.formData.treeType === 'ancestors' ? 'pedigree' :
					this.formData.treeType === 'descendants' ? 'descendant' : 'fan',
			maxGenerations,
			pageSize: this.formData.pageSize,
			orientation: this.formData.orientation,
			nodeContent: this.formData.nodeContent,
			colorScheme: this.formData.pdfColorScheme
		};

		this.treeSizeAnalysis = this.visualTreeService.analyzeTreeSize(options);

		if (!this.treeSizeAnalysis || !this.treeSizeAnalysis.isLarge) {
			warningContainer.addClass('cr-hidden');
			return;
		}

		warningContainer.removeClass('cr-hidden');
		warningContainer.empty();

		const analysis = this.treeSizeAnalysis;

		const header = warningContainer.createDiv({ cls: 'cr-large-tree-warning-header' });
		header.appendChild(createLucideIcon('alert-triangle', 16));
		header.createSpan({ text: 'Large tree detected' });

		const info = warningContainer.createDiv({ cls: 'cr-large-tree-warning-info' });
		info.createEl('p', {
			text: `This tree has ${analysis.generationsCount} generations with up to ${analysis.maxNodesInGeneration} people in the widest generation.`
		});

		const optionsDiv = warningContainer.createDiv({ cls: 'cr-large-tree-warning-options' });
		optionsDiv.createEl('p', { text: 'Choose how to handle this:' });

		// Auto page size option
		const autoSizeOption = optionsDiv.createDiv({ cls: 'cr-large-tree-option' });
		const autoSizeRadio = autoSizeOption.createEl('input', {
			type: 'radio',
			attr: { name: 'largeTreeHandling', value: 'auto-page-size', id: 'largeTree-autoSize' }
		});
		if (this.formData.largeTreeHandling === 'auto-page-size') autoSizeRadio.checked = true;
		autoSizeRadio.addEventListener('change', () => { this.formData.largeTreeHandling = 'auto-page-size'; });

		const autoSizeLabel = autoSizeOption.createEl('label', { attr: { for: 'largeTree-autoSize' } });
		autoSizeLabel.createEl('strong', { text: 'Use larger page size' });
		if (analysis.canFitOnSinglePage && analysis.recommendedPageSize) {
			autoSizeLabel.createEl('span', {
				text: ` - Will use ${analysis.recommendedPageSize.toUpperCase()} to fit on a single page`
			});
		} else {
			autoSizeLabel.createEl('span', { text: ' - Tree is too large for any single page' });
		}

		// Multi-page option
		const multiPageOption = optionsDiv.createDiv({ cls: 'cr-large-tree-option' });
		const multiPageRadio = multiPageOption.createEl('input', {
			type: 'radio',
			attr: { name: 'largeTreeHandling', value: 'multi-page', id: 'largeTree-multiPage' }
		});
		if (this.formData.largeTreeHandling === 'multi-page') multiPageRadio.checked = true;
		multiPageRadio.addEventListener('change', () => { this.formData.largeTreeHandling = 'multi-page'; });

		const multiPageLabel = multiPageOption.createEl('label', { attr: { for: 'largeTree-multiPage' } });
		multiPageLabel.createEl('strong', { text: 'Split across multiple pages' });
		multiPageLabel.createEl('span', {
			text: ` - Will create ${analysis.pagesNeededForMultiPage} pages, each showing 4 generations`
		});
	}

	// ========== PDF OUTPUT STEP ==========

	private renderPdfOutputStep(container: HTMLElement): void {
		const formatName = this.formData.outputFormat === 'odt' ? 'ODT' : 'PDF';
		container.createEl('p', {
			text: `Review your settings and generate the ${formatName}.`,
			cls: 'cr-wizard-step-desc'
		});

		const form = container.createDiv({ cls: 'cr-wizard-form' });

		new Setting(form)
			.setName('Title')
			.setDesc(`Custom title for the ${formatName} (optional)`)
			.addText(text => text
				.setPlaceholder('Leave blank for auto-generated title')
				.setValue(this.formData.pdfTitle)
				.onChange(value => { this.formData.pdfTitle = value; }));

		// Summary
		const summarySection = form.createDiv({ cls: 'crc-wizard-output-summary' });
		summarySection.createEl('h4', { text: 'Summary', cls: 'cr-wizard-subsection' });

		const summaryList = summarySection.createEl('ul', { cls: 'crc-wizard-summary-list' });
		summaryList.createEl('li', { text: `Root person: ${this.formData.rootPerson?.name || 'Not selected'}` });
		summaryList.createEl('li', { text: `Chart type: ${this.getPdfChartTypeLabel()}` });

		// Show effective page size (may be overridden by large tree handling)
		const effectivePageSize = this.treeSizeAnalysis?.isLarge &&
			this.formData.largeTreeHandling === 'auto-page-size' &&
			this.treeSizeAnalysis.recommendedPageSize
			? this.treeSizeAnalysis.recommendedPageSize
			: this.formData.pageSize;
		summaryList.createEl('li', { text: `Page: ${effectivePageSize.toUpperCase()}, ${this.formData.orientation}` });

		summaryList.createEl('li', { text: `Content: ${this.formData.nodeContent}` });
		summaryList.createEl('li', { text: `Colors: ${this.formData.pdfColorScheme}` });
	}

	// ========== NAVIGATION ==========

	private renderNavigation(): void {
		if (!this.contentContainer) return;

		// Remove existing nav if present (for reactivity updates)
		const existingNav = this.contentContainer.querySelector('.cr-wizard-nav');
		if (existingNav) {
			existingNav.remove();
		}

		const nav = this.contentContainer.createDiv({ cls: 'cr-wizard-nav' });
		const flow = this.getStepFlow();

		// Back/Cancel button
		if (this.currentStepIndex === 0) {
			const cancelBtn = nav.createEl('button', { text: 'Cancel', cls: 'cr-btn' });
			cancelBtn.addEventListener('click', () => this.close());
		} else {
			const backBtn = nav.createEl('button', { text: 'Back', cls: 'cr-btn' });
			backBtn.prepend(createLucideIcon('chevron-left', 16));
			backBtn.addEventListener('click', () => this.goBack());
		}

		const rightBtns = nav.createDiv({ cls: 'cr-wizard-nav-right' });

		// Next/Generate button
		const isLastStep = this.currentStepIndex === flow.length - 1;

		if (!isLastStep) {
			const nextBtn = rightBtns.createEl('button', { text: 'Next', cls: 'cr-btn cr-btn--primary' });
			nextBtn.appendChild(createLucideIcon('arrow-right', 16));

			// Disable if requirements not met
			if (this.currentStepIndex === 0 && !this.formData.rootPerson) {
				nextBtn.disabled = true;
				nextBtn.addClass('cr-btn--disabled');
			}

			nextBtn.addEventListener('click', () => this.goNext());
		} else {
			const buttonText = this.formData.outputFormat === 'canvas' ? 'Generate Canvas' :
				this.formData.outputFormat === 'excalidraw' ? 'Generate Excalidraw' :
				this.formData.outputFormat === 'pdf' ? 'Generate PDF' : 'Generate ODT';
			const generateBtn = rightBtns.createEl('button', {
				text: buttonText,
				cls: 'cr-btn cr-btn--primary'
			});
			generateBtn.prepend(createLucideIcon('sparkles', 16));

			// Disable if requirements not met
			if ((this.formData.outputFormat === 'canvas' || this.formData.outputFormat === 'excalidraw') && !this.formData.canvasName.trim()) {
				generateBtn.disabled = true;
				generateBtn.addClass('cr-btn--disabled');
			}

			generateBtn.addEventListener('click', () => {
				if (this.formData.outputFormat === 'canvas') {
					void this.generateCanvas();
				} else if (this.formData.outputFormat === 'excalidraw') {
					void this.generateExcalidraw();
				} else if (this.formData.outputFormat === 'pdf') {
					void this.generatePdf();
				} else {
					void this.generateOdt();
				}
			});
		}
	}

	private goNext(): void {
		const flow = this.getStepFlow();
		if (this.currentStepIndex < flow.length - 1) {
			this.currentStepIndex++;
			this.renderProgress();
			this.renderCurrentStep();
		}
	}

	private goBack(): void {
		if (this.currentStepIndex > 0) {
			this.currentStepIndex--;
			this.renderProgress();
			this.renderCurrentStep();
		}
	}

	// ========== GENERATION LOGIC ==========

	private buildTreeOptions(): TreeOptions {
		if (!this.formData.rootPerson) {
			throw new Error('Root person not selected');
		}

		const treeType = this.formData.treeType === 'fan' ? 'ancestors' : this.formData.treeType;

		const options: TreeOptions = {
			rootCrId: this.formData.rootPerson.crId,
			treeType,
			maxGenerations: treeType === 'ancestors'
				? this.formData.maxAncestorGenerations || undefined
				: treeType === 'descendants'
					? this.formData.maxDescendantGenerations || undefined
					: undefined,
			includeSpouses: this.formData.includeSpouses,
			includeStepParents: this.formData.includeStepParents,
			includeAdoptiveParents: this.formData.includeAdoptiveParents
		};

		if (this.formData.collectionFilter) {
			options.collectionFilter = this.formData.collectionFilter;
		}

		if (this.formData.placeFilter) {
			options.placeFilter = {
				placeName: this.formData.placeFilter,
				types: Array.from(this.formData.placeFilterTypes)
			};
		}

		return options;
	}

	private async generateCanvas(): Promise<void> {
		if (!this.formData.rootPerson || !this.formData.canvasName.trim()) {
			new Notice('Please select a root person and enter a canvas name.');
			return;
		}

		try {
			new Notice('Generating canvas...');

			const treeOptions = this.buildTreeOptions();
			logger.info('unified-wizard', 'Starting canvas generation', treeOptions);

			const familyTree = this.graphService.generateTree(treeOptions);

			if (!familyTree) {
				new Notice('Failed to generate tree: root person not found');
				return;
			}

			logger.info('unified-wizard', 'Family tree generated', {
				rootPerson: familyTree.root.name,
				totalNodes: familyTree.nodes.size,
				totalEdges: familyTree.edges.length
			});

			const canvasOptions: CanvasGenerationOptions = {
				direction: this.formData.direction,
				nodeSpacingX: this.plugin.settings.horizontalSpacing,
				nodeSpacingY: this.plugin.settings.verticalSpacing,
				layoutType: this.formData.layoutAlgorithm as LayoutType,
				nodeColorScheme: this.formData.colorScheme,
				showLabels: true,
				useFamilyChartLayout: true,
				parentChildArrowStyle: this.formData.parentChildArrowStyle,
				spouseArrowStyle: this.formData.spouseArrowStyle,
				parentChildEdgeColor: this.formData.parentChildEdgeColor,
				spouseEdgeColor: this.formData.spouseEdgeColor,
				showSpouseEdges: this.formData.showSpouseEdges,
				spouseEdgeLabelFormat: this.formData.spouseEdgeLabelFormat,
				showSourceIndicators: this.plugin.settings.showSourceIndicators,
				showResearchCoverage: this.plugin.settings.trackFactSourcing,
				canvasGroupingStrategy: this.formData.canvasGroupingStrategy,
				canvasRootsMetadata: {
					plugin: 'canvas-roots',
					generation: {
						rootCrId: this.formData.rootPerson.crId,
						rootPersonName: this.formData.rootPerson.name,
						treeType: this.formData.treeType === 'fan' ? 'ancestors' : this.formData.treeType,
						maxGenerations: treeOptions.maxGenerations || 0,
						includeSpouses: this.formData.includeSpouses,
						direction: this.formData.direction,
						timestamp: Date.now()
					},
					layout: {
						nodeWidth: this.plugin.settings.defaultNodeWidth,
						nodeHeight: this.plugin.settings.defaultNodeHeight,
						nodeSpacingX: this.plugin.settings.horizontalSpacing,
						nodeSpacingY: this.plugin.settings.verticalSpacing,
						layoutType: this.formData.layoutAlgorithm as LayoutType
					}
				}
			};

			const canvasGenerator = new CanvasGenerator();
			const canvasData = canvasGenerator.generateCanvas(familyTree, canvasOptions);

			logger.info('unified-wizard', 'Canvas data generated', {
				nodeCount: canvasData.nodes.length,
				edgeCount: canvasData.edges.length
			});

			let fileName = this.formData.canvasName.trim();
			if (!fileName.endsWith('.canvas')) {
				fileName += '.canvas';
			}

			const folder = this.formData.saveFolder.trim() ||
				this.plugin.settings.canvasesFolder ||
				'Canvas Roots/Canvases';

			await ensureFolderExists(this.app, folder);
			const filePath = normalizePath(`${folder}/${fileName}`);

			const canvasContent = this.formatCanvasJson(canvasData);

			let file: TFile;
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);
			if (existingFile instanceof TFile) {
				await this.app.vault.modify(existingFile, canvasContent);
				file = existingFile;
				new Notice(`Updated existing canvas: ${fileName}`);
			} else {
				file = await this.app.vault.create(filePath, canvasContent);
				new Notice(`Created canvas: ${fileName}`);
			}

			await new Promise(resolve => setTimeout(resolve, 100));

			// Save to recent trees
			const treeInfo: RecentTreeInfo = {
				canvasPath: file.path,
				canvasName: fileName,
				peopleCount: canvasData.nodes.length,
				edgeCount: canvasData.edges.length,
				rootPerson: this.formData.rootPerson.name,
				timestamp: Date.now()
			};

			if (!this.plugin.settings.recentTrees) {
				this.plugin.settings.recentTrees = [];
			}

			this.plugin.settings.recentTrees = this.plugin.settings.recentTrees.filter(
				t => t.canvasPath !== file.path
			);

			this.plugin.settings.recentTrees.unshift(treeInfo);

			if (this.plugin.settings.recentTrees.length > 10) {
				this.plugin.settings.recentTrees = this.plugin.settings.recentTrees.slice(0, 10);
			}

			await this.plugin.saveSettings();

			if (this.formData.openAfterGenerate) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(file);
			}

			this.options.onComplete?.(file.path);
			this.close();

		} catch (error) {
			console.error('Error generating canvas:', error);
			new Notice('Error generating canvas. Check console for details.');
		}
	}

	private async generateExcalidraw(): Promise<void> {
		if (!this.formData.rootPerson || !this.formData.canvasName.trim()) {
			new Notice('Please select a root person and enter a name.');
			return;
		}

		try {
			new Notice('Generating Excalidraw...');

			const treeOptions = this.buildTreeOptions();
			logger.info('unified-wizard', 'Starting Excalidraw generation', treeOptions);

			const familyTree = this.graphService.generateTree(treeOptions);

			if (!familyTree) {
				new Notice('Failed to generate tree: root person not found');
				return;
			}

			// First generate as canvas
			// For Excalidraw export, always include spouse edges so they can be styled differently
			const canvasOptions: CanvasGenerationOptions = {
				direction: this.formData.direction,
				nodeSpacingX: this.plugin.settings.horizontalSpacing,
				nodeSpacingY: this.plugin.settings.verticalSpacing,
				layoutType: this.formData.layoutAlgorithm as LayoutType,
				nodeColorScheme: this.formData.colorScheme,
				showLabels: true,
				useFamilyChartLayout: true,
				parentChildArrowStyle: this.formData.parentChildArrowStyle,
				spouseArrowStyle: this.formData.spouseArrowStyle,
				parentChildEdgeColor: this.formData.parentChildEdgeColor,
				spouseEdgeColor: this.formData.spouseEdgeColor,
				showSpouseEdges: true, // Always include spouse edges for Excalidraw (enables dashed styling)
				spouseEdgeLabelFormat: this.formData.spouseEdgeLabelFormat,
				showSourceIndicators: this.plugin.settings.showSourceIndicators,
				showResearchCoverage: this.plugin.settings.trackFactSourcing,
				canvasGroupingStrategy: this.formData.canvasGroupingStrategy
			};

			const canvasGenerator = new CanvasGenerator();
			const canvasData = canvasGenerator.generateCanvas(familyTree, canvasOptions);

			// Create temporary canvas file
			let fileName = this.formData.canvasName.trim();
			if (!fileName.endsWith('.canvas')) {
				fileName += '.canvas';
			}

			const folder = this.formData.saveFolder.trim() ||
				this.plugin.settings.canvasesFolder ||
				'Canvas Roots/Canvases';

			await ensureFolderExists(this.app, folder);
			const canvasPath = normalizePath(`${folder}/${fileName}`);
			const canvasContent = this.formatCanvasJson(canvasData);

			// Create or update canvas file
			let canvasFile: TFile;
			const existingCanvas = this.app.vault.getAbstractFileByPath(canvasPath);
			if (existingCanvas instanceof TFile) {
				await this.app.vault.modify(existingCanvas, canvasContent);
				canvasFile = existingCanvas;
			} else {
				canvasFile = await this.app.vault.create(canvasPath, canvasContent);
			}

			// Convert to Excalidraw
			const { ExcalidrawExporter } = await import('../../excalidraw/excalidraw-exporter');
			const excalidrawExporter = new ExcalidrawExporter(this.app);

			const excalidrawResult = await excalidrawExporter.exportToExcalidraw({
				canvasFile,
				fileName: fileName.replace('.canvas', ''),
				preserveColors: true,
				// Pass Excalidraw style options from wizard
				roughness: this.formData.excalidrawRoughness,
				fontFamily: this.formData.excalidrawFontFamily,
				fontSize: this.formData.excalidrawFontSize,
				strokeWidth: this.formData.excalidrawStrokeWidth,
				fillStyle: this.formData.excalidrawFillStyle,
				strokeStyle: this.formData.excalidrawStrokeStyle,
				nodeContent: this.formData.excalidrawNodeContent
			});

			if (excalidrawResult.success && excalidrawResult.excalidrawContent) {
				const excalidrawPath = canvasPath.replace('.canvas', '.excalidraw.md');

				// Create or update excalidraw file
				const existingExcalidraw = this.app.vault.getAbstractFileByPath(excalidrawPath);
				let excalidrawFile: TFile;
				if (existingExcalidraw instanceof TFile) {
					await this.app.vault.modify(existingExcalidraw, excalidrawResult.excalidrawContent);
					excalidrawFile = existingExcalidraw;
					new Notice(`Updated Excalidraw: ${excalidrawPath}`);
				} else {
					excalidrawFile = await this.app.vault.create(excalidrawPath, excalidrawResult.excalidrawContent);
					new Notice(`Created Excalidraw: ${excalidrawPath}`);
				}

				// Delete the temporary canvas file (we only needed it for the export)
				await this.app.fileManager.trashFile(canvasFile);

				if (this.formData.openAfterGenerate) {
					const leaf = this.app.workspace.getLeaf(false);
					await leaf.openFile(excalidrawFile);
				}

				this.options.onComplete?.(excalidrawFile.path);
				this.close();
			} else {
				// Clean up temporary canvas file even on failure
				await this.app.fileManager.trashFile(canvasFile);
				new Notice(`Excalidraw export failed: ${excalidrawResult.errors?.join(', ') || 'Unknown error'}`);
			}

		} catch (error) {
			console.error('Error generating Excalidraw:', error);
			new Notice('Error generating Excalidraw. Check console for details.');
		}
	}

	private async generatePdf(): Promise<void> {
		if (!this.formData.rootPerson) {
			new Notice('Please select a root person.');
			return;
		}

		const maxGenerations = this.formData.treeType === 'ancestors' || this.formData.treeType === 'fan'
			? this.formData.maxAncestorGenerations || 5
			: this.formData.maxDescendantGenerations || 5;

		const chartType = this.formData.treeType === 'full' ? 'hourglass' :
			this.formData.treeType === 'ancestors' ? 'pedigree' :
				this.formData.treeType === 'descendants' ? 'descendant' : 'fan';

		const options: VisualTreeOptions = {
			rootPersonCrId: this.formData.rootPerson.crId,
			chartType,
			maxGenerations,
			pageSize: this.formData.pageSize,
			orientation: this.formData.orientation,
			nodeContent: this.formData.nodeContent,
			colorScheme: this.formData.pdfColorScheme,
			includeSpouses: this.formData.includeSpouses,
			title: this.formData.pdfTitle || `${this.formData.rootPerson.name} - ${this.getTreeTypeLabel()}`,
			largeTreeHandling: this.treeSizeAnalysis?.isLarge ? this.formData.largeTreeHandling : undefined
		};

		try {
			new Notice('Generating PDF...');

			const layouts = this.visualTreeService.buildLayouts(options);

			if (layouts.length === 0) {
				new Notice('Failed to generate tree layout. The person may not have any ancestors.');
				return;
			}

			await this.pdfRenderer.renderVisualTrees(layouts, options);

			const totalPeople = layouts.reduce((sum, l) => sum + l.stats.peopleCount, 0);

			if (layouts.length > 1) {
				new Notice(`PDF generated with ${totalPeople} people across ${layouts.length} pages.`);
			} else {
				new Notice(`PDF generated with ${layouts[0].stats.peopleCount} people across ${layouts[0].stats.generationsCount} generations.`);
			}

			this.close();

		} catch (error) {
			console.error('Error generating PDF:', error);
			new Notice('Error generating PDF. Check console for details.');
		}
	}

	private async generateOdt(): Promise<void> {
		if (!this.formData.rootPerson) {
			new Notice('Please select a root person.');
			return;
		}

		const maxGenerations = this.formData.treeType === 'ancestors' || this.formData.treeType === 'fan'
			? this.formData.maxAncestorGenerations || 5
			: this.formData.maxDescendantGenerations || 5;

		const chartType = this.formData.treeType === 'full' ? 'hourglass' :
			this.formData.treeType === 'ancestors' ? 'pedigree' :
				this.formData.treeType === 'descendants' ? 'descendant' : 'fan';

		const options: VisualTreeOptions = {
			rootPersonCrId: this.formData.rootPerson.crId,
			chartType,
			maxGenerations,
			pageSize: this.formData.pageSize,
			orientation: this.formData.orientation,
			nodeContent: this.formData.nodeContent,
			colorScheme: this.formData.pdfColorScheme,
			includeSpouses: this.formData.includeSpouses,
			title: this.formData.pdfTitle || `${this.formData.rootPerson.name} - ${this.getTreeTypeLabel()}`,
			largeTreeHandling: this.treeSizeAnalysis?.isLarge ? this.formData.largeTreeHandling : undefined
		};

		try {
			new Notice('Generating ODT...');

			const layouts = this.visualTreeService.buildLayouts(options);

			if (layouts.length === 0) {
				new Notice('Failed to generate tree layout. The person may not have any ancestors.');
				return;
			}

			// Use first layout for now (multi-page ODT could be added later)
			const layout = layouts[0];

			// Render to SVG
			const svgRenderer = new VisualTreeSvgRenderer();
			const svgString = svgRenderer.renderToSvg(layout, options);

			// Convert to PNG data URL
			const imageDataUrl = await svgRenderer.svgToDataUrl(svgString, layout.page.width, layout.page.height);

			// Calculate image dimensions in cm for ODT (assuming 72 DPI)
			// A4 is 21cm wide, Letter is 21.59cm wide. Use ~18cm for margins
			const maxWidthCm = 18;
			const aspectRatio = layout.page.height / layout.page.width;
			const imageWidthCm = maxWidthCm;
			const imageHeightCm = maxWidthCm * aspectRatio;

			// Generate ODT with embedded image
			const odtGenerator = new OdtGenerator();
			const title = options.title || `${this.formData.rootPerson.name} Family Tree`;

			const odtBlob = await odtGenerator.generate('', {
				title,
				includeCoverPage: false,
				embedImage: {
					data: imageDataUrl,
					width: imageWidthCm,
					height: imageHeightCm
				}
			});

			// Download the ODT file - use the title for the filename
			const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.odt`;
			const url = URL.createObjectURL(odtBlob);
			const a = document.createElement('a');
			a.href = url;
			a.download = fileName;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			new Notice(`ODT generated with ${layout.stats.peopleCount} people across ${layout.stats.generationsCount} generations.`);
			this.close();

		} catch (error) {
			console.error('Error generating ODT:', error);
			new Notice('Error generating ODT. Check console for details.');
		}
	}

	private formatCanvasJson(data: { nodes: unknown[]; edges: unknown[]; metadata?: unknown }): string {
		const safeStringify = (obj: unknown): string => {
			const seen = new WeakSet();
			return JSON.stringify(obj, (_key, value) => {
				if (typeof value === 'object' && value !== null) {
					if (seen.has(value)) return '[Circular]';
					seen.add(value);
				}
				return value;
			});
		};

		const lines: string[] = ['{'];

		lines.push('\t"nodes":[');
		data.nodes.forEach((node, index) => {
			const compact = safeStringify(node);
			const suffix = index < data.nodes.length - 1 ? ',' : '';
			lines.push(`\t\t${compact}${suffix}`);
		});
		lines.push('\t],');

		lines.push('\t"edges":[');
		data.edges.forEach((edge, index) => {
			const compact = safeStringify(edge);
			const suffix = index < data.edges.length - 1 ? ',' : '';
			lines.push(`\t\t${compact}${suffix}`);
		});
		lines.push('\t]');

		if (data.metadata) {
			lines[lines.length - 1] = '\t],';
			lines.push(`\t"metadata":${safeStringify(data.metadata)}`);
		}

		lines.push('}');
		return lines.join('\n');
	}

	// ========== UTILITIES ==========

	private formatDates(birthDate?: string, deathDate?: string): string {
		if (!birthDate && !deathDate) return '';
		const birth = birthDate || '?';
		const death = deathDate || '';
		return death ? `(${birth} - ${death})` : `(b. ${birth})`;
	}

	private getTreeTypeLabel(): string {
		switch (this.formData.treeType) {
			case 'full': return 'Full Tree';
			case 'ancestors': return 'Pedigree Chart';
			case 'descendants': return 'Descendant Chart';
			case 'fan': return 'Fan Chart';
		}
	}

	/**
	 * Get the PDF chart type label (more specific for PDF output)
	 */
	private getPdfChartTypeLabel(): string {
		switch (this.formData.treeType) {
			case 'full': return 'Hourglass Chart';
			case 'ancestors': return 'Pedigree Chart';
			case 'descendants': return 'Descendant Chart';
			case 'fan': return 'Fan Chart';
		}
	}

	/**
	 * Get human-readable output format label
	 */
	private getOutputFormatLabel(): string {
		switch (this.formData.outputFormat) {
			case 'canvas': return 'Canvas';
			case 'excalidraw': return 'Excalidraw';
			case 'pdf': return 'PDF';
			case 'odt': return 'ODT';
		}
	}
}
