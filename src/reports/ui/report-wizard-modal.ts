/**
 * Report Wizard Modal
 *
 * A four-step wizard for generating genealogical reports.
 *
 * Step 1: Select — Report type and subject (person/place)
 * Step 2: Format — Output format selection (Vault, PDF, ODT, MD)
 * Step 3: Customize — Content options, format-specific settings
 * Step 4: Generate — Filename, estimate panel, and generate button
 *
 * Design inspired by FamilyChartExportWizard for consistency.
 */

import { Modal, Notice, setIcon } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import { createLucideIcon, setLucideIcon, LucideIconName } from '../../ui/lucide-icons';
import type { PersonInfo } from '../../ui/person-picker';
import { PlacePickerModal, SelectedPlaceInfo } from '../../ui/place-picker';
import { isPersonNote } from '../../utils/note-type-detection';

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
import { ReportGenerationService } from '../services/report-generation-service';
import { PdfReportRenderer } from '../services/pdf-report-renderer';
import { OdtGenerator } from '../services/odt-generator';
import {
	ReportType,
	ReportCategory,
	REPORT_METADATA,
	getReportsByCategory,
	FamilyGroupSheetResult,
	IndividualSummaryResult,
	AhnentafelResult,
	GapsReportResult,
	RegisterReportResult,
	PedigreeChartResult,
	DescendantChartResult,
	SourceSummaryResult,
	TimelineReportResult,
	PlaceSummaryResult,
	MediaInventoryResult,
	UniverseOverviewResult,
	CollectionOverviewResult
} from '../types/report-types';
import { UnifiedTreeWizardModal } from '../../trees/ui/unified-tree-wizard-modal';

/**
 * Output format types
 */
type OutputFormat = 'vault' | 'pdf' | 'odt' | 'md';

/**
 * Category display info with report count
 */
interface CategoryInfo {
	category: ReportCategory;
	name: string;
	icon: string;
	reportCount: number;
	/** Single report categories go directly to report selection */
	directReport?: ReportType;
}

/**
 * Category definitions for the wizard
 */
const WIZARD_CATEGORIES: CategoryInfo[] = [
	{
		category: 'genealogical',
		name: 'Genealogical',
		icon: 'users',
		reportCount: 6
	},
	{
		category: 'research',
		name: 'Research',
		icon: 'search',
		reportCount: 3
	},
	{
		category: 'timeline',
		name: 'Timeline',
		icon: 'calendar',
		reportCount: 1,
		directReport: 'timeline-report'
	},
	{
		category: 'geographic',
		name: 'Geographic',
		icon: 'map-pin',
		reportCount: 1,
		directReport: 'place-summary'
	},
	{
		category: 'summary',
		name: 'Summary',
		icon: 'bar-chart-2',
		reportCount: 2
	},
	{
		category: 'visual-trees',
		name: 'Visual Trees',
		icon: 'git-branch',
		reportCount: 4
	}
];

/**
 * Form data for wizard state
 */
/**
 * Options for opening the report wizard with pre-selected values
 */
export interface ReportWizardOptions {
	/** Pre-select a report type */
	reportType?: ReportType;
	/** Pre-select a person subject */
	personCrId?: string;
	personName?: string;
}

interface WizardFormData {
	// Step 1: Quick Generate
	selectedCategory: ReportCategory | null;
	reportType: ReportType | null;
	subject: {
		personCrId?: string;
		personName?: string;
		placeCrId?: string;
		placeName?: string;
		universeCrId?: string;
		universeName?: string;
		collectionId?: string;
		collectionName?: string;
	};
	outputFormat: OutputFormat;
	filename: string;

	// Step 2: Customize - Content Options
	includeSpouses: boolean;
	includeSources: boolean;
	includeDetails: boolean;
	includeChildren: boolean;
	maxGenerations: number;

	// Step 3: PDF Options
	pdfPageSize: 'A4' | 'LETTER';
	pdfDateFormat: 'mdy' | 'dmy' | 'ymd';
	pdfIncludeCoverPage: boolean;
	pdfCoverTitle: string;
	pdfCoverSubtitle: string;
	pdfCoverNotes: string;

	// Step 3: ODT Options
	odtIncludeCoverPage: boolean;
	odtCoverTitle: string;
	odtCoverSubtitle: string;
	odtCoverNotes: string;

	// Step 2: Vault Options
	outputFolder: string;
}

/**
 * Report Wizard Modal
 */
export class ReportWizardModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private reportService: ReportGenerationService;
	private pdfRenderer: PdfReportRenderer;
	private odtGenerator: OdtGenerator;

	// Current step (0 = Quick Generate, 1 = Customize)
	private currentStep: number = 0;

	// Form data
	private formData: WizardFormData;

	// UI containers
	private contentContainer?: HTMLElement;
	private progressContainer?: HTMLElement;
	private personListContainer?: HTMLElement;
	private personSectionContainer?: HTMLElement;

	// Person list state
	private allPeople: PersonInfo[] = [];
	private filteredPeople: PersonInfo[] = [];
	private searchQuery: string = '';
	private sortOption: PersonSortOption = 'name-asc';
	private filterOptions: PersonFilterOptions = { sex: 'all', hasConnections: false };
	private peopleLoaded: boolean = false;

	// Step definitions
	private readonly steps = [
		{ number: 1, title: 'Select', description: 'Choose report type and subject' },
		{ number: 2, title: 'Format', description: 'Choose output format' },
		{ number: 3, title: 'Customize', description: 'Fine-tune report options' },
		{ number: 4, title: 'Generate', description: 'Review and generate' }
	];

	constructor(plugin: CanvasRootsPlugin, options?: ReportWizardOptions) {
		super(plugin.app);
		this.plugin = plugin;
		this.reportService = new ReportGenerationService(plugin.app, plugin.settings);
		this.pdfRenderer = new PdfReportRenderer();
		this.odtGenerator = new OdtGenerator();

		// Initialize form data with defaults
		this.formData = this.getDefaultFormData();

		// Apply any pre-selected options
		if (options?.reportType) {
			this.formData.reportType = options.reportType;
			// Set the category based on the report type
			const reportMeta = REPORT_METADATA[options.reportType];
			if (reportMeta) {
				this.formData.selectedCategory = reportMeta.category;
			}
			this.updateFilename();
		}

		if (options?.personCrId) {
			this.formData.subject.personCrId = options.personCrId;
			this.formData.subject.personName = options.personName;
			this.updateFilename();
		}
	}

	/**
	 * Get default form data
	 */
	private getDefaultFormData(): WizardFormData {
		const date = new Date().toISOString().split('T')[0];

		return {
			selectedCategory: null,
			reportType: null,
			subject: {},
			outputFormat: 'pdf',
			filename: `report-${date}`,

			// Content options
			includeSpouses: true,
			includeSources: true,
			includeDetails: true,
			includeChildren: true,
			maxGenerations: 5,

			// PDF options
			pdfPageSize: 'A4',
			pdfDateFormat: 'mdy',
			pdfIncludeCoverPage: false,
			pdfCoverTitle: '',
			pdfCoverSubtitle: '',
			pdfCoverNotes: '',

			// ODT options
			odtIncludeCoverPage: false,
			odtCoverTitle: '',
			odtCoverSubtitle: '',
			odtCoverNotes: '',

			// Vault options
			outputFolder: this.plugin.settings.reportsFolder || ''
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-report-wizard');

		// Modal header with icon and title
		const header = contentEl.createDiv({ cls: 'cr-report-wizard-header' });

		const titleRow = header.createDiv({ cls: 'cr-wizard-title' });
		titleRow.appendChild(createLucideIcon('file-text', 24));
		titleRow.createSpan({ text: 'Generate Report' });

		// Step progress indicator
		this.renderStepProgress(contentEl);

		// Content container
		this.contentContainer = contentEl.createDiv({ cls: 'cr-report-wizard-content' });

		// Render current step
		this.renderCurrentStep();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Render the step progress indicator
	 */
	private renderStepProgress(container: HTMLElement): void {
		this.progressContainer = container.createDiv({ cls: 'cr-wizard-progress' });
		this.updateStepProgress();
	}

	/**
	 * Update the step progress indicator
	 */
	private updateStepProgress(): void {
		if (!this.progressContainer) return;
		this.progressContainer.empty();

		const stepsRow = this.progressContainer.createDiv({ cls: 'cr-wizard-steps' });

		this.steps.forEach((step, index) => {
			// Step circle with number
			const stepEl = stepsRow.createDiv({ cls: 'cr-wizard-step' });

			// Mark active or completed
			if (index === this.currentStep) {
				stepEl.addClass('cr-wizard-step--active');
			} else if (index < this.currentStep) {
				stepEl.addClass('cr-wizard-step--completed');
			}

			// Step number circle
			const numberEl = stepEl.createDiv({ cls: 'cr-wizard-step-number' });
			if (index < this.currentStep) {
				// Show checkmark for completed steps
				setIcon(numberEl, 'check');
			} else {
				numberEl.textContent = String(step.number);
			}

			// Step info (title shown only for active step)
			const infoEl = stepEl.createDiv({ cls: 'cr-wizard-step-info' });
			infoEl.createDiv({ cls: 'cr-wizard-step-title', text: step.title });

			// Add connector between steps (except after last step)
			if (index < this.steps.length - 1) {
				const connector = stepsRow.createDiv({ cls: 'cr-wizard-connector' });
				if (index < this.currentStep) {
					connector.addClass('cr-wizard-connector--completed');
				}
			}
		});

		// Step counter and description below the circles
		const stepInfo = this.progressContainer.createDiv({ cls: 'cr-report-step-info' });
		const currentStepData = this.steps[this.currentStep];

		stepInfo.createDiv({
			cls: 'cr-report-step-counter',
			text: `Step ${this.currentStep + 1} of ${this.steps.length}`
		});

		stepInfo.createDiv({
			cls: 'cr-report-step-description',
			text: currentStepData.description
		});
	}

	/**
	 * Render the current step
	 */
	private renderCurrentStep(): void {
		if (!this.contentContainer) return;
		this.contentContainer.empty();

		// Update step progress indicator
		this.updateStepProgress();

		switch (this.currentStep) {
			case 0:
				this.renderStep1(this.contentContainer);
				break;
			case 1:
				this.renderStep2(this.contentContainer);
				break;
			case 2:
				this.renderStep3(this.contentContainer);
				break;
			case 3:
				this.renderStep4(this.contentContainer);
				break;
		}

		this.renderFooter(this.contentContainer);
	}

	// ========== STEP 1: SELECT (Report Type & Subject) ==========

	private renderStep1(container: HTMLElement): void {
		// Report Type section with dropdown
		const reportSection = container.createDiv({ cls: 'cr-report-section' });
		reportSection.createEl('h3', { text: 'Report Type', cls: 'cr-report-section-title' });

		this.renderReportTypeDropdown(reportSection);

		// Subject section (shown when a report type is selected)
		if (this.formData.reportType) {
			container.createEl('hr', { cls: 'cr-report-separator' });
			this.renderSubjectSection(container);
		}
	}

	// ========== STEP 2: FORMAT ==========

	private renderStep2(container: HTMLElement): void {
		// Format section
		const formatSection = container.createDiv({ cls: 'cr-report-section' });
		formatSection.createEl('h3', { text: 'Output Format', cls: 'cr-report-section-title' });

		this.renderFormatSection(formatSection);
	}

	/**
	 * Render report type dropdown with optgroups by category
	 */
	private renderReportTypeDropdown(container: HTMLElement): void {
		const selectRow = container.createDiv({ cls: 'cr-report-dropdown-row' });

		const select = selectRow.createEl('select', { cls: 'cr-report-dropdown' });

		// Default option
		const defaultOption = select.createEl('option', {
			value: '',
			text: 'Select a report type...'
		});
		defaultOption.disabled = true;
		if (!this.formData.reportType) {
			defaultOption.selected = true;
		}

		// Group reports by category
		for (const categoryInfo of WIZARD_CATEGORIES) {
			const reports = getReportsByCategory(categoryInfo.category);
			if (reports.length === 0) continue;

			const optgroup = select.createEl('optgroup');
			optgroup.label = categoryInfo.name;

			for (const report of reports) {
				const option = optgroup.createEl('option', {
					value: report.type,
					text: report.name
				});
				if (this.formData.reportType === report.type) {
					option.selected = true;
				}
			}
		}

		select.addEventListener('change', () => {
			const selectedType = select.value as ReportType;
			if (selectedType) {
				this.formData.reportType = selectedType;
				// Find and set the category
				const reportMeta = REPORT_METADATA[selectedType];
				this.formData.selectedCategory = reportMeta.category;
				// Reset subject when changing report type
				this.formData.subject = {};
				this.updateFilename();
				this.renderCurrentStep();
			}
		});

		// Show description for selected report
		if (this.formData.reportType) {
			const reportMeta = REPORT_METADATA[this.formData.reportType];
			const descEl = container.createDiv({ cls: 'cr-report-dropdown-desc' });
			descEl.createSpan({ text: reportMeta.description });
		}
	}

	/**
	 * Render subject selection section
	 */
	private renderSubjectSection(container: HTMLElement): void {
		const reportMeta = this.formData.reportType ? REPORT_METADATA[this.formData.reportType] : null;
		if (!reportMeta) return;

		const section = container.createDiv({ cls: 'cr-report-section' });
		section.createEl('h3', { text: 'Subject', cls: 'cr-report-section-title' });

		if (!reportMeta.requiresPerson) {
			// No subject needed
			section.createDiv({
				cls: 'cr-report-no-subject',
				text: 'This report analyzes the entire vault.'
			});
			return;
		}

		// For person entities, render inline person picker
		if (reportMeta.entityType === 'person') {
			this.renderInlinePersonPicker(section);
			return;
		}

		// For other entity types, use button picker (place, universe, collection)
		const pickerRow = section.createDiv({ cls: 'cr-report-subject-picker' });

		const subjectName = this.getSubjectDisplayName();
		const placeholder = this.getSubjectPlaceholder(reportMeta.entityType);

		const pickerButton = pickerRow.createEl('button', {
			cls: 'cr-report-subject-button',
			text: subjectName || placeholder
		});

		if (subjectName) {
			pickerButton.addClass('cr-report-subject-button--selected');
		}

		// Icon
		const iconName = this.getSubjectIcon(reportMeta.entityType);
		const icon = createLucideIcon(iconName, 16);
		pickerButton.insertBefore(icon, pickerButton.firstChild);

		pickerButton.addEventListener('click', () => {
			void this.openSubjectPicker(reportMeta.entityType);
		});
	}

	// ========== INLINE PERSON PICKER ==========

	/**
	 * Render inline person picker with search and filters
	 */
	private renderInlinePersonPicker(container: HTMLElement): void {
		this.personSectionContainer = container;

		// Selected person display (if any)
		if (this.formData.subject.personCrId) {
			const selectedContainer = container.createDiv({ cls: 'crc-wizard-selected-person' });
			this.renderSelectedPerson(selectedContainer);
		}

		// Toolbar row with search and sort
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

		// Results count
		const resultsCount = container.createDiv({ cls: 'crc-wizard-results-count' });
		resultsCount.createSpan({ text: `${this.filteredPeople.length} of ${this.allPeople.length} people` });

		// Person list container
		this.personListContainer = container.createDiv({ cls: 'crc-wizard-person-list' });

		// Load people if not already loaded
		if (!this.peopleLoaded) {
			void this.loadPeople();
		} else {
			this.renderPersonList(this.personListContainer);
		}

		// Filter row (below the person list)
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
	}

	/**
	 * Render selected person card with clear button
	 */
	private renderSelectedPerson(container: HTMLElement): void {
		container.empty();
		const { subject } = this.formData;
		if (!subject.personCrId) return;

		const card = container.createDiv({ cls: 'crc-wizard-selected-card' });
		card.appendChild(createLucideIcon('user', 20));

		const info = card.createDiv({ cls: 'crc-wizard-selected-info' });
		info.createDiv({ cls: 'crc-wizard-selected-name', text: subject.personName || 'Unknown' });

		// Try to find birth/death dates from the person info
		const person = this.allPeople.find(p => p.crId === subject.personCrId);
		if (person) {
			const dates = this.formatDates(person.birthDate, person.deathDate);
			if (dates) {
				info.createDiv({ cls: 'crc-wizard-selected-dates', text: dates });
			}
		}

		const clearBtn = card.createEl('button', {
			cls: 'crc-wizard-clear-btn',
			attr: { type: 'button', 'aria-label': 'Clear selection' }
		});
		setLucideIcon(clearBtn, 'x', 16);
		clearBtn.addEventListener('click', () => {
			this.formData.subject = {};
			this.updateFilename();
			this.renderCurrentStep();
		});
	}

	/**
	 * Load all people from the vault
	 */
	private loadPeople(): void {
		const files = this.app.vault.getMarkdownFiles();
		const people: PersonInfo[] = [];

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			if (isPersonNote(cache.frontmatter, cache)) {
				const fm = cache.frontmatter;
				people.push({
					crId: fm.cr_id as string || file.basename,
					name: fm.cr_full_name as string || file.basename,
					birthDate: fm.cr_birth_date as string | undefined,
					deathDate: fm.cr_death_date as string | undefined,
					sex: fm.cr_sex as string | undefined,
					file: file
				});
			}
		}

		this.allPeople = people;
		this.peopleLoaded = true;
		this.applyFiltersAndSort();
		this.refreshPersonList();
	}

	/**
	 * Apply filters and sorting to the person list
	 */
	private applyFiltersAndSort(): void {
		const query = this.searchQuery.toLowerCase().trim();
		let result = [...this.allPeople];

		// Apply search filter
		if (query) {
			result = result.filter(p => p.name.toLowerCase().includes(query));
		}

		// Apply sex filter
		if (this.filterOptions.sex !== 'all') {
			result = result.filter(p => {
				const sex = p.sex?.toLowerCase();
				if (this.filterOptions.sex === 'male') return sex === 'm' || sex === 'male';
				if (this.filterOptions.sex === 'female') return sex === 'f' || sex === 'female';
				if (this.filterOptions.sex === 'unknown') return !sex || (sex !== 'm' && sex !== 'male' && sex !== 'f' && sex !== 'female');
				return true;
			});
		}

		// Apply sorting
		result.sort((a, b) => {
			switch (this.sortOption) {
				case 'name-asc':
					return a.name.localeCompare(b.name);
				case 'name-desc':
					return b.name.localeCompare(a.name);
				case 'birth-asc':
					return (a.birthDate || '9999').localeCompare(b.birthDate || '9999');
				case 'birth-desc':
					return (b.birthDate || '0000').localeCompare(a.birthDate || '0000');
				default:
					return 0;
			}
		});

		this.filteredPeople = result;
	}

	/**
	 * Refresh the person list UI
	 */
	private refreshPersonList(): void {
		if (this.personListContainer) {
			this.renderPersonList(this.personListContainer);
		}
		if (this.personSectionContainer) {
			this.updateResultsCount(this.personSectionContainer);
		}
	}

	/**
	 * Update the results count display
	 */
	private updateResultsCount(container: HTMLElement): void {
		const resultsDiv = container.querySelector('.crc-wizard-results-count');
		if (resultsDiv) {
			resultsDiv.empty();
			(resultsDiv as HTMLElement).createSpan({ text: `${this.filteredPeople.length} of ${this.allPeople.length} people` });
		}
	}

	/**
	 * Render the person list
	 */
	private renderPersonList(container: HTMLElement): void {
		container.empty();

		if (!this.peopleLoaded) {
			container.createDiv({
				cls: 'crc-wizard-empty',
				text: 'Loading people...'
			});
			return;
		}

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
			const isSelected = this.formData.subject.personCrId === person.crId;
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
				this.formData.subject = {
					personCrId: person.crId,
					personName: person.name
				};
				this.updateFilename();
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

	/**
	 * Format birth/death dates for display
	 */
	private formatDates(birthDate?: string, deathDate?: string): string | null {
		if (!birthDate && !deathDate) return null;
		const birth = birthDate ? birthDate.substring(0, 4) : '?';
		const death = deathDate ? deathDate.substring(0, 4) : '?';
		return `${birth} – ${death}`;
	}

	/**
	 * Get display name for current subject
	 */
	private getSubjectDisplayName(): string | null {
		const { subject } = this.formData;
		return subject.personName || subject.placeName || subject.universeName || subject.collectionName || null;
	}

	/**
	 * Get placeholder text for subject picker
	 */
	private getSubjectPlaceholder(entityType?: string): string {
		switch (entityType) {
			case 'person': return 'Select a person...';
			case 'place': return 'Select a place...';
			case 'universe': return 'Select a universe...';
			case 'collection': return 'Select a collection...';
			default: return 'Select...';
		}
	}

	/**
	 * Get icon for subject type
	 */
	private getSubjectIcon(entityType?: string): LucideIconName {
		switch (entityType) {
			case 'person': return 'user';
			case 'place': return 'map-pin';
			case 'universe': return 'globe';
			case 'collection': return 'folder';
			default: return 'search';
		}
	}

	/**
	 * Open appropriate subject picker (for non-person entities)
	 */
	private async openSubjectPicker(entityType?: string): Promise<void> {
		switch (entityType) {
			case 'place':
				await this.openPlacePicker();
				break;
			case 'universe':
				// TODO: Implement universe picker
				new Notice('Universe picker not yet implemented');
				break;
			case 'collection':
				// TODO: Implement collection picker
				new Notice('Collection picker not yet implemented');
				break;
		}
	}

	/**
	 * Open place picker modal
	 */
	private async openPlacePicker(): Promise<void> {
		return new Promise((resolve) => {
			const picker = new PlacePickerModal(
				this.app,
				(place: SelectedPlaceInfo) => {
					this.formData.subject = {
						placeCrId: place.crId,
						placeName: place.name
					};
					this.updateFilename();
					this.renderCurrentStep();
					resolve();
				}
			);
			picker.open();
		});
	}

	/**
	 * Check if subject selection is complete
	 */
	private isSubjectComplete(): boolean {
		if (!this.formData.reportType) return false;

		const reportMeta = REPORT_METADATA[this.formData.reportType];
		if (!reportMeta.requiresPerson) return true;

		const { subject } = this.formData;
		switch (reportMeta.entityType) {
			case 'person': return !!subject.personCrId;
			case 'place': return !!subject.placeCrId;
			case 'universe': return !!subject.universeCrId;
			case 'collection': return !!subject.collectionId;
			default: return true;
		}
	}

	/**
	 * Render format selection section
	 */
	private renderFormatSection(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'cr-report-section' });
		section.createEl('h3', { text: 'Format', cls: 'cr-report-section-title' });

		const formatGrid = section.createDiv({ cls: 'cr-report-format-grid' });

		const formats: { id: OutputFormat; label: string; icon: string; desc: string }[] = [
			{ id: 'vault', label: 'Vault', icon: 'file', desc: 'Save as markdown' },
			{ id: 'pdf', label: 'PDF', icon: 'file-text', desc: 'Download PDF' },
			{ id: 'odt', label: 'ODT', icon: 'file', desc: 'Editable document' },
			{ id: 'md', label: 'MD', icon: 'download', desc: 'Download markdown' }
		];

		for (const format of formats) {
			const isSelected = this.formData.outputFormat === format.id;
			const tile = formatGrid.createDiv({
				cls: `cr-report-format-tile ${isSelected ? 'cr-report-format-tile--selected' : ''}`
			});

			const iconEl = tile.createDiv({ cls: 'cr-report-tile-icon' });
			setIcon(iconEl, format.icon);

			tile.createDiv({ cls: 'cr-report-tile-label', text: format.label });

			tile.addEventListener('click', () => {
				this.formData.outputFormat = format.id;
				this.updateFilename();
				this.renderCurrentStep();
			});
		}
	}

	/**
	 * Render filename section
	 */
	private renderFilenameSection(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'cr-report-section' });
		section.createEl('h3', { text: 'Filename', cls: 'cr-report-section-title' });

		const filenameRow = section.createDiv({ cls: 'cr-report-filename-row' });

		const filenameInput = filenameRow.createEl('input', {
			type: 'text',
			cls: 'cr-report-filename-input',
			value: this.formData.filename
		});

		filenameInput.addEventListener('input', (e) => {
			this.formData.filename = (e.target as HTMLInputElement).value;
		});

		const ext = this.getFileExtension();
		filenameRow.createSpan({ cls: 'cr-report-filename-ext', text: `.${ext}` });
	}

	/**
	 * Get file extension based on output format
	 */
	private getFileExtension(): string {
		switch (this.formData.outputFormat) {
			case 'pdf': return 'pdf';
			case 'odt': return 'odt';
			case 'vault':
			case 'md':
			default: return 'md';
		}
	}

	/**
	 * Update filename based on selections
	 */
	private updateFilename(): void {
		const parts: string[] = [];

		if (this.formData.reportType) {
			const reportMeta = REPORT_METADATA[this.formData.reportType];
			parts.push(reportMeta.name.toLowerCase().replace(/\s+/g, '-'));
		}

		const subjectName = this.getSubjectDisplayName();
		if (subjectName) {
			const sanitized = subjectName
				.replace(/[<>:"/\\|?*]/g, '')
				.replace(/\s+/g, '-')
				.toLowerCase();
			parts.push(sanitized);
		}

		const date = new Date().toISOString().split('T')[0];
		parts.push(date);

		this.formData.filename = parts.join('-');
	}

	// ========== STEP 3: CUSTOMIZE ==========

	private renderStep3(container: HTMLElement): void {
		// Content Options section
		this.renderContentOptionsSection(container);

		// Format-specific options
		container.createEl('hr', { cls: 'cr-report-separator' });
		this.renderFormatSpecificOptions(container);
	}

	// ========== STEP 4: GENERATE ==========

	private renderStep4(container: HTMLElement): void {
		// Estimate panel (summary of what will be generated)
		this.renderEstimatePanel(container);

		container.createEl('hr', { cls: 'cr-report-separator' });

		// Filename section
		const filenameSection = container.createDiv({ cls: 'cr-report-section' });
		filenameSection.createEl('h3', { text: 'Filename', cls: 'cr-report-section-title' });
		this.renderFilenameSection(filenameSection);
	}

	/**
	 * Render estimate panel showing summary of report to be generated
	 */
	private renderEstimatePanel(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'cr-report-section' });
		section.createEl('h3', { text: 'Summary', cls: 'cr-report-section-title' });

		const panel = section.createDiv({ cls: 'cr-report-estimate-panel' });

		// Report type
		const reportMeta = this.formData.reportType ? REPORT_METADATA[this.formData.reportType] : null;
		if (reportMeta) {
			const reportRow = panel.createDiv({ cls: 'cr-report-estimate-row' });
			reportRow.createSpan({ cls: 'cr-report-estimate-label', text: 'Report:' });
			reportRow.createSpan({ cls: 'cr-report-estimate-value', text: reportMeta.name });
		}

		// Subject
		const subjectName = this.getSubjectDisplayName();
		if (subjectName) {
			const subjectRow = panel.createDiv({ cls: 'cr-report-estimate-row' });
			subjectRow.createSpan({ cls: 'cr-report-estimate-label', text: 'Subject:' });
			subjectRow.createSpan({ cls: 'cr-report-estimate-value', text: subjectName });
		}

		// Format
		const formatRow = panel.createDiv({ cls: 'cr-report-estimate-row' });
		formatRow.createSpan({ cls: 'cr-report-estimate-label', text: 'Format:' });
		formatRow.createSpan({ cls: 'cr-report-estimate-value', text: this.getFormatDisplayName() });

		// Generations (if applicable)
		if (this.shouldShowOption('generations')) {
			const genRow = panel.createDiv({ cls: 'cr-report-estimate-row' });
			genRow.createSpan({ cls: 'cr-report-estimate-label', text: 'Generations:' });
			genRow.createSpan({ cls: 'cr-report-estimate-value', text: String(this.formData.maxGenerations) });
		}

		// Estimated people count (placeholder - can be enhanced later)
		const countRow = panel.createDiv({ cls: 'cr-report-estimate-row' });
		countRow.createSpan({ cls: 'cr-report-estimate-label', text: 'Est. people:' });
		const estimatedPeople = this.estimatePeopleCount();
		countRow.createSpan({ cls: 'cr-report-estimate-value', text: estimatedPeople });
	}

	/**
	 * Get display name for current output format
	 */
	private getFormatDisplayName(): string {
		switch (this.formData.outputFormat) {
			case 'vault': return 'Save to Vault';
			case 'pdf': return 'PDF Document';
			case 'odt': return 'ODT Document';
			case 'md': return 'Markdown File';
		}
	}

	/**
	 * Estimate people count for the report (placeholder implementation)
	 */
	private estimatePeopleCount(): string {
		const gens = this.formData.maxGenerations;
		const type = this.formData.reportType;

		if (!type) return '—';

		// Rough estimates based on report type
		if (type === 'ahnentafel' || type === 'pedigree-chart') {
			// Ancestors: 2^n - 1 max, but typically 60-70% filled
			const maxAncestors = Math.pow(2, gens) - 1;
			const estimated = Math.round(maxAncestors * 0.65);
			return `~${estimated}`;
		} else if (type === 'descendant-chart' || type === 'register-report') {
			// Descendants vary widely, rough estimate
			const estimated = Math.round(gens * 8);
			return `~${estimated}`;
		} else if (type === 'family-group-sheet') {
			return '2-15';
		}

		return '—';
	}

	/**
	 * Render content options section
	 */
	private renderContentOptionsSection(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'cr-report-section' });
		section.createEl('h3', { text: 'Content Options', cls: 'cr-report-section-title' });

		const optionsGrid = section.createDiv({ cls: 'cr-report-options-grid' });

		// Include spouses (for applicable reports)
		if (this.shouldShowOption('spouses')) {
			this.renderToggleOption(optionsGrid, 'Include spouses', this.formData.includeSpouses, (value) => {
				this.formData.includeSpouses = value;
			});
		}

		// Include sources
		this.renderToggleOption(optionsGrid, 'Include sources', this.formData.includeSources, (value) => {
			this.formData.includeSources = value;
		});

		// Include details
		if (this.shouldShowOption('details')) {
			this.renderToggleOption(optionsGrid, 'Include details', this.formData.includeDetails, (value) => {
				this.formData.includeDetails = value;
			});
		}

		// Include children (for family group sheet)
		if (this.shouldShowOption('children')) {
			this.renderToggleOption(optionsGrid, 'Include children', this.formData.includeChildren, (value) => {
				this.formData.includeChildren = value;
			});
		}

		// Generations (for ancestor/descendant reports)
		if (this.shouldShowOption('generations')) {
			const genRow = section.createDiv({ cls: 'cr-report-option-row' });
			genRow.createSpan({ text: 'Generations:', cls: 'cr-report-option-label' });

			const genSelect = genRow.createEl('select', { cls: 'cr-report-select' });
			for (const num of [3, 4, 5, 6, 7, 8, 10]) {
				const option = genSelect.createEl('option', {
					value: String(num),
					text: String(num)
				});
				if (num === this.formData.maxGenerations) option.selected = true;
			}

			genSelect.addEventListener('change', () => {
				this.formData.maxGenerations = parseInt(genSelect.value);
			});
		}
	}

	/**
	 * Check if an option should be shown for current report type
	 */
	private shouldShowOption(option: string): boolean {
		const type = this.formData.reportType;
		if (!type) return false;

		switch (option) {
			case 'spouses':
				return ['register-report', 'descendant-chart'].includes(type);
			case 'details':
				return ['ahnentafel', 'pedigree-chart', 'descendant-chart', 'register-report'].includes(type);
			case 'children':
				return type === 'family-group-sheet';
			case 'generations':
				return ['ahnentafel', 'register-report', 'pedigree-chart', 'descendant-chart'].includes(type);
			default:
				return false;
		}
	}

	/**
	 * Render a toggle option
	 */
	private renderToggleOption(
		container: HTMLElement,
		label: string,
		checked: boolean,
		onChange: (value: boolean) => void
	): void {
		const row = container.createDiv({ cls: 'cr-report-toggle-row' });

		const checkbox = row.createEl('input', {
			type: 'checkbox',
			cls: 'cr-report-checkbox'
		});
		checkbox.checked = checked;

		row.createEl('label', { text: label, cls: 'cr-report-toggle-label' });

		checkbox.addEventListener('change', () => {
			onChange(checkbox.checked);
		});
	}

	/**
	 * Render format-specific options
	 */
	private renderFormatSpecificOptions(container: HTMLElement): void {
		switch (this.formData.outputFormat) {
			case 'pdf':
				this.renderPdfOptions(container);
				break;
			case 'odt':
				this.renderOdtOptions(container);
				break;
			case 'vault':
				this.renderVaultOptions(container);
				break;
			// MD has no additional options for now
		}
	}

	/**
	 * Render PDF-specific options
	 */
	private renderPdfOptions(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'cr-report-section' });
		section.createEl('h3', { text: 'PDF Options', cls: 'cr-report-section-title' });

		// Page size
		const pageSizeRow = section.createDiv({ cls: 'cr-report-option-row' });
		pageSizeRow.createSpan({ text: 'Page size:', cls: 'cr-report-option-label' });

		const pageSizeSelect = pageSizeRow.createEl('select', { cls: 'cr-report-select' });
		for (const size of ['A4', 'LETTER']) {
			const option = pageSizeSelect.createEl('option', {
				value: size,
				text: size
			});
			if (size === this.formData.pdfPageSize) option.selected = true;
		}

		pageSizeSelect.addEventListener('change', () => {
			this.formData.pdfPageSize = pageSizeSelect.value as 'A4' | 'LETTER';
		});

		// Date format
		const dateFormatRow = section.createDiv({ cls: 'cr-report-option-row' });
		dateFormatRow.createSpan({ text: 'Date format:', cls: 'cr-report-option-label' });

		const dateFormatSelect = dateFormatRow.createEl('select', { cls: 'cr-report-select' });
		const dateFormats: { value: 'mdy' | 'dmy' | 'ymd'; label: string }[] = [
			{ value: 'mdy', label: 'MM/DD/YYYY' },
			{ value: 'dmy', label: 'DD/MM/YYYY' },
			{ value: 'ymd', label: 'YYYY-MM-DD' }
		];
		for (const format of dateFormats) {
			const option = dateFormatSelect.createEl('option', {
				value: format.value,
				text: format.label
			});
			if (format.value === this.formData.pdfDateFormat) option.selected = true;
		}

		dateFormatSelect.addEventListener('change', () => {
			this.formData.pdfDateFormat = dateFormatSelect.value as 'mdy' | 'dmy' | 'ymd';
		});

		// Cover page
		this.renderToggleOption(section, 'Include cover page', this.formData.pdfIncludeCoverPage, (value) => {
			this.formData.pdfIncludeCoverPage = value;
			this.renderCurrentStep();
		});

		// Cover page details (if enabled)
		if (this.formData.pdfIncludeCoverPage) {
			const titleRow = section.createDiv({ cls: 'cr-report-option-row' });
			titleRow.createSpan({ text: 'Title:', cls: 'cr-report-option-label' });

			const titleInput = titleRow.createEl('input', {
				type: 'text',
				cls: 'cr-report-input',
				value: this.formData.pdfCoverTitle,
				placeholder: this.getDefaultCoverTitle()
			});

			titleInput.addEventListener('input', (e) => {
				this.formData.pdfCoverTitle = (e.target as HTMLInputElement).value;
			});

			const subtitleRow = section.createDiv({ cls: 'cr-report-option-row' });
			subtitleRow.createSpan({ text: 'Subtitle:', cls: 'cr-report-option-label' });

			const subtitleInput = subtitleRow.createEl('input', {
				type: 'text',
				cls: 'cr-report-input',
				value: this.formData.pdfCoverSubtitle,
				placeholder: 'Optional'
			});

			subtitleInput.addEventListener('input', (e) => {
				this.formData.pdfCoverSubtitle = (e.target as HTMLInputElement).value;
			});

			// Cover notes textarea
			const notesRow = section.createDiv({ cls: 'cr-report-option-row cr-report-option-row--vertical' });
			notesRow.createSpan({ text: 'Cover notes:', cls: 'cr-report-option-label' });

			const notesTextarea = notesRow.createEl('textarea', {
				cls: 'cr-report-textarea',
				value: this.formData.pdfCoverNotes,
				placeholder: 'Optional dedication, preface, or notes...',
				attr: { rows: '3' }
			});
			notesTextarea.value = this.formData.pdfCoverNotes;

			notesTextarea.addEventListener('input', (e) => {
				this.formData.pdfCoverNotes = (e.target as HTMLTextAreaElement).value;
			});
		}
	}

	/**
	 * Get default cover title
	 */
	private getDefaultCoverTitle(): string {
		if (!this.formData.reportType) return 'Report';
		const reportMeta = REPORT_METADATA[this.formData.reportType];
		const subjectName = this.getSubjectDisplayName();
		if (subjectName) {
			return `${reportMeta.name}: ${subjectName}`;
		}
		return reportMeta.name;
	}

	/**
	 * Render ODT-specific options
	 */
	private renderOdtOptions(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'cr-report-section' });
		section.createEl('h3', { text: 'ODT Options', cls: 'cr-report-section-title' });

		// Cover page toggle
		this.renderToggleOption(section, 'Include cover page', this.formData.odtIncludeCoverPage, (value) => {
			this.formData.odtIncludeCoverPage = value;
			this.renderCurrentStep();
		});

		// Cover page details (if enabled)
		if (this.formData.odtIncludeCoverPage) {
			const titleRow = section.createDiv({ cls: 'cr-report-option-row' });
			titleRow.createSpan({ text: 'Title:', cls: 'cr-report-option-label' });

			const titleInput = titleRow.createEl('input', {
				type: 'text',
				cls: 'cr-report-input',
				value: this.formData.odtCoverTitle,
				placeholder: this.getDefaultCoverTitle()
			});

			titleInput.addEventListener('input', (e) => {
				this.formData.odtCoverTitle = (e.target as HTMLInputElement).value;
			});

			const subtitleRow = section.createDiv({ cls: 'cr-report-option-row' });
			subtitleRow.createSpan({ text: 'Subtitle:', cls: 'cr-report-option-label' });

			const subtitleInput = subtitleRow.createEl('input', {
				type: 'text',
				cls: 'cr-report-input',
				value: this.formData.odtCoverSubtitle,
				placeholder: 'Optional'
			});

			subtitleInput.addEventListener('input', (e) => {
				this.formData.odtCoverSubtitle = (e.target as HTMLInputElement).value;
			});

			// Cover notes textarea
			const notesRow = section.createDiv({ cls: 'cr-report-option-row cr-report-option-row--vertical' });
			notesRow.createSpan({ text: 'Cover notes:', cls: 'cr-report-option-label' });

			const notesTextarea = notesRow.createEl('textarea', {
				cls: 'cr-report-textarea',
				value: this.formData.odtCoverNotes,
				placeholder: 'Optional dedication, preface, or notes...',
				attr: { rows: '3' }
			});
			notesTextarea.value = this.formData.odtCoverNotes;

			notesTextarea.addEventListener('input', (e) => {
				this.formData.odtCoverNotes = (e.target as HTMLTextAreaElement).value;
			});
		}
	}

	/**
	 * Render vault-specific options
	 */
	private renderVaultOptions(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'cr-report-section' });
		section.createEl('h3', { text: 'Vault Options', cls: 'cr-report-section-title' });

		const folderRow = section.createDiv({ cls: 'cr-report-option-row' });
		folderRow.createSpan({ text: 'Output folder:', cls: 'cr-report-option-label' });

		const folderInput = folderRow.createEl('input', {
			type: 'text',
			cls: 'cr-report-input',
			value: this.formData.outputFolder,
			placeholder: 'Root of vault'
		});

		folderInput.addEventListener('input', (e) => {
			this.formData.outputFolder = (e.target as HTMLInputElement).value;
		});
	}

	// ========== FOOTER ==========

	/**
	 * Render the footer with navigation buttons
	 */
	private renderFooter(container: HTMLElement): void {
		const footer = container.createDiv({ cls: 'cr-report-wizard-footer' });

		// Left side: Cancel (step 0) or Back (steps 1-3)
		if (this.currentStep === 0) {
			const cancelBtn = footer.createEl('button', {
				cls: 'cr-btn',
				text: 'Cancel'
			});
			cancelBtn.addEventListener('click', () => this.close());
		} else {
			const backBtn = footer.createEl('button', {
				cls: 'cr-btn'
			});
			backBtn.appendChild(createLucideIcon('chevron-left', 16));
			backBtn.appendText('Back');
			backBtn.addEventListener('click', () => {
				this.currentStep--;
				this.renderCurrentStep();
			});
		}

		// Right side: Next or Generate
		const rightBtns = footer.createDiv({ cls: 'cr-report-footer-right' });

		if (this.currentStep < 3) {
			// Steps 0-2: Show Next button
			const nextBtn = rightBtns.createEl('button', {
				cls: 'cr-btn cr-btn--primary'
			});
			nextBtn.appendText('Next');
			nextBtn.appendChild(createLucideIcon('arrow-right', 16));

			// Determine if Next should be enabled
			const canProceed = this.canProceedToNextStep();
			if (!canProceed) {
				nextBtn.addClass('cr-btn--disabled');
			} else {
				nextBtn.addEventListener('click', () => {
					this.currentStep++;
					this.renderCurrentStep();
				});
			}
		} else {
			// Step 3: Show Generate button
			const generateBtn = rightBtns.createEl('button', {
				cls: 'cr-btn cr-btn--primary'
			});
			generateBtn.appendText('Generate');
			generateBtn.appendChild(createLucideIcon('file-text', 16));
			generateBtn.addEventListener('click', () => { void this.doGenerate(); });
		}
	}

	/**
	 * Check if we can proceed to the next step
	 */
	private canProceedToNextStep(): boolean {
		switch (this.currentStep) {
			case 0:
				// Step 1: Need report type and subject (if required)
				return this.formData.reportType !== null && this.isSubjectComplete();
			case 1:
				// Step 2: Format is always selected (has default)
				return true;
			case 2:
				// Step 3: Customize options are always valid
				return true;
			default:
				return false;
		}
	}

	/**
	 * Check if we can generate the report
	 */
	private canGenerate(): boolean {
		return this.formData.reportType !== null && this.isSubjectComplete();
	}

	/**
	 * Generate the report
	 */
	private async doGenerate(): Promise<void> {
		if (!this.formData.reportType) {
			new Notice('Please select a report type');
			return;
		}

		// Check if this is a visual tree type - delegate to unified tree wizard
		if (this.isVisualTreeType(this.formData.reportType)) {
			this.close();
			this.openTreeWizard();
			return;
		}

		try {
			// Build report options
			const options = this.buildReportOptions();

			// Generate the report
			const result = await this.reportService.generateReport(
				this.formData.reportType,
				options
			);

			if (!result.success) {
				new Notice(`Report generation failed: ${result.error}`);
				return;
			}

			// Handle output based on format
			await this.handleOutput(result);

			// Close the wizard
			this.close();

			// Show success notice
			const formatName = this.formData.outputFormat.toUpperCase();
			new Notice(`${formatName} report generated successfully`);

		} catch (error) {
			console.error('Report generation failed:', error);
			new Notice(`Report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Check if report type is a visual tree
	 */
	private isVisualTreeType(reportType: ReportType): boolean {
		return reportType === 'pedigree-tree-pdf' ||
			reportType === 'descendant-tree-pdf' ||
			reportType === 'hourglass-tree-pdf' ||
			reportType === 'fan-chart-pdf';
	}

	/**
	 * Open the tree wizard for visual tree reports
	 */
	private openTreeWizard(): void {
		// Map report types to UnifiedTreeWizardModal tree types
		const treeTypeMap: Record<string, 'full' | 'ancestors' | 'descendants' | 'fan'> = {
			'pedigree-tree-pdf': 'ancestors',
			'descendant-tree-pdf': 'descendants',
			'hourglass-tree-pdf': 'full',
			'fan-chart-pdf': 'fan'
		};

		const wizard = new UnifiedTreeWizardModal(this.plugin, {
			outputFormat: 'pdf',
			treeType: treeTypeMap[this.formData.reportType!],
			personCrId: this.formData.subject.personCrId,
			personName: this.formData.subject.personName
		});
		wizard.open();
	}

	/**
	 * Build report options from form data
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private buildReportOptions(): any {
		const options: Record<string, unknown> = {
			outputMethod: this.formData.outputFormat === 'md' ? 'download' : this.formData.outputFormat,
			outputFolder: this.formData.outputFolder,
			filename: this.formData.filename,
			includeSources: this.formData.includeSources
		};

		// Add subject based on report type
		const reportMeta = REPORT_METADATA[this.formData.reportType!];
		switch (reportMeta.entityType) {
			case 'person':
				options.personCrId = this.formData.subject.personCrId;
				options.rootPersonCrId = this.formData.subject.personCrId;
				break;
			case 'place':
				options.placeCrId = this.formData.subject.placeCrId;
				break;
			case 'universe':
				options.universeCrId = this.formData.subject.universeCrId;
				break;
			case 'collection':
				options.collectionId = this.formData.subject.collectionId;
				break;
		}

		// Add report-specific options
		options.includeSpouses = this.formData.includeSpouses;
		options.includeDetails = this.formData.includeDetails;
		options.includeChildren = this.formData.includeChildren;
		options.maxGenerations = this.formData.maxGenerations;

		return options;
	}

	/**
	 * Handle output based on format
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private async handleOutput(result: any): Promise<void> {
		const filename = `${this.formData.filename}.${this.getFileExtension()}`;

		switch (this.formData.outputFormat) {
			case 'pdf':
				await this.generatePdf(result);
				break;

			case 'odt':
				await this.generateOdt(result);
				break;

			case 'md':
				this.reportService.downloadReport(result.content, filename);
				break;

			case 'vault':
				// Already saved by report service
				break;
		}
	}

	/**
	 * Generate PDF from result
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private async generatePdf(result: any): Promise<void> {
		const pdfOptions = {
			pageSize: this.formData.pdfPageSize,
			fontStyle: 'serif' as const,
			dateFormat: this.formData.pdfDateFormat,
			includeCoverPage: this.formData.pdfIncludeCoverPage,
			customTitle: this.formData.pdfCoverTitle || undefined,
			customSubtitle: this.formData.pdfCoverSubtitle || undefined,
			coverNotes: this.formData.pdfCoverNotes || undefined
		};

		// Use appropriate renderer based on report type
		switch (this.formData.reportType) {
			case 'family-group-sheet':
				await this.pdfRenderer.renderFamilyGroupSheet(result as FamilyGroupSheetResult, pdfOptions);
				break;
			case 'individual-summary':
				await this.pdfRenderer.renderIndividualSummary(result as IndividualSummaryResult, pdfOptions);
				break;
			case 'ahnentafel':
				await this.pdfRenderer.renderAhnentafel(result as AhnentafelResult, pdfOptions);
				break;
			case 'gaps-report':
				await this.pdfRenderer.renderGapsReport(result as GapsReportResult, pdfOptions);
				break;
			case 'register-report':
				await this.pdfRenderer.renderRegisterReport(result as RegisterReportResult, pdfOptions);
				break;
			case 'pedigree-chart':
				await this.pdfRenderer.renderPedigreeChart(result as PedigreeChartResult, pdfOptions);
				break;
			case 'descendant-chart':
				await this.pdfRenderer.renderDescendantChart(result as DescendantChartResult, pdfOptions);
				break;
			case 'source-summary':
				await this.pdfRenderer.renderSourceSummary(result as SourceSummaryResult, pdfOptions);
				break;
			case 'timeline-report':
				await this.pdfRenderer.renderTimelineReport(result as TimelineReportResult, pdfOptions);
				break;
			case 'place-summary':
				await this.pdfRenderer.renderPlaceSummary(result as PlaceSummaryResult, pdfOptions);
				break;
			case 'media-inventory':
				await this.pdfRenderer.renderMediaInventory(result as MediaInventoryResult, pdfOptions);
				break;
			case 'universe-overview':
				await this.pdfRenderer.renderUniverseOverview(result as UniverseOverviewResult, pdfOptions);
				break;
			case 'collection-overview':
				await this.pdfRenderer.renderCollectionOverview(result as CollectionOverviewResult, pdfOptions);
				break;
			default:
				throw new Error(`PDF rendering not supported for report type: ${this.formData.reportType}`);
		}
	}

	/**
	 * Generate ODT from result
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private async generateOdt(result: any): Promise<void> {
		const odtOptions = {
			title: this.formData.odtCoverTitle || this.getDefaultCoverTitle(),
			subtitle: this.formData.odtCoverSubtitle || (this.formData.subject.personName
				? `Report for ${this.formData.subject.personName}`
				: undefined),
			includeCoverPage: this.formData.odtIncludeCoverPage,
			coverNotes: this.formData.odtCoverNotes || undefined
		};

		const blob = await this.odtGenerator.generate(result.content, odtOptions);
		OdtGenerator.download(blob, `${this.formData.filename}.odt`);
	}
}
