/**
 * Import Wizard Modal
 *
 * A 7-step wizard for importing genealogical data.
 *
 * Step 1: Format — Select import format (GEDCOM, GEDCOM X, Gramps, CSV)
 * Step 2: File — Drag-and-drop file picker
 * Step 3: Options — Entity types, target folder, conflict handling
 * Step 4: Preview — Entity counts, duplicate warnings
 * Step 5: Import — Progress with real-time log
 * Step 6: Numbering — Optional reference numbering
 * Step 7: Complete — Summary with actions
 */

import { App, Modal, Notice, setIcon } from 'obsidian';
import type CanvasRootsPlugin from '../../main';
import { GedcomImporterV2 } from '../gedcom/gedcom-importer-v2';
import type { GedcomDataV2, GedcomImportOptionsV2, GedcomImportResultV2 } from '../gedcom/gedcom-types';
import { ReferenceNumberingService, type NumberingSystem as RefNumberingSystem, type NumberingStats } from '../core/reference-numbering';
import { PersonPickerModal, type PersonInfo } from './person-picker';
import { GrampsParser } from '../gramps/gramps-parser';
import { extractGpkg, type GpkgExtractionResult } from '../gramps/gpkg-extractor';
import { GrampsImporter, type GrampsImportOptions, type GrampsImportResult } from '../gramps/gramps-importer';
import { readFileWithDecompression } from '../core/compression-utils';
import { PrivacyNoticeModal } from './privacy-notice-modal';

/**
 * Import format types
 */
export type ImportFormat = 'gedcom' | 'gedcomx' | 'gramps' | 'csv';

/**
 * Numbering system types
 */
export type NumberingSystem = 'ahnentafel' | 'daboville' | 'henry' | 'generation' | 'none';

/**
 * Conflict handling options
 */
export type ConflictHandling = 'skip' | 'overwrite' | 'rename';

/**
 * Import wizard form data
 */
interface ImportWizardFormData {
	// Step 1: Format
	format: ImportFormat;

	// Step 2: File
	file: File | null;
	fileName: string;
	fileSize: number;

	// Step 3: Options
	importPeople: boolean;
	importPlaces: boolean;
	importSources: boolean;
	importEvents: boolean;
	importMedia: boolean;
	importNotes: boolean;  // Import notes attached to entities (Gramps only)
	createSeparateNoteFiles: boolean;  // Create separate note files instead of embedding (Gramps only)
	mediaFolder: string;
	preserveMediaFolderStructure: boolean;
	includeDynamicBlocks: boolean;
	targetFolder: string;
	conflictHandling: ConflictHandling;

	// Step 4: Preview (populated after parsing)
	previewCounts: {
		people: number;
		places: number;
		sources: number;
		events: number;
		media: number;
	};
	duplicateCount: number;
	fileContent: string | null;
	parsedData: GedcomDataV2 | null;
	parseErrors: string[];
	parseWarnings: string[];
	gpkgExtractionResult: GpkgExtractionResult | null;

	// Step 5: Import (progress)
	importedCount: number;
	totalCount: number;
	importLog: string[];
	importResult: GedcomImportResultV2 | GrampsImportResult | null;

	// Step 6: Numbering
	numberingSystem: NumberingSystem;
	rootPersonCrId: string | null;
	rootPersonName: string | null;
	numberingStats: NumberingStats | null;
	isAssigningNumbers: boolean;

	// Step 7: Complete
	importComplete: boolean;
	skippedCount: number;
	privacyNoticeShown: boolean;
}

/**
 * Format configuration
 */
interface FormatConfig {
	id: ImportFormat;
	name: string;
	description: string;
	extension: string;
	icon: string;
}

const IMPORT_FORMATS: FormatConfig[] = [
	{
		id: 'gedcom',
		name: 'GEDCOM 5.5.1',
		description: 'Standard genealogy format (.ged)',
		extension: '.ged',
		icon: 'file-text'
	},
	{
		id: 'gedcomx',
		name: 'GEDCOM X (JSON)',
		description: 'Modern JSON-based format',
		extension: '.json',
		icon: 'file-json'
	},
	{
		id: 'gramps',
		name: 'Gramps XML/.gpkg',
		description: 'Gramps software (.gpkg includes media)',
		extension: '.gpkg,.gramps',
		icon: 'file-archive'
	},
	{
		id: 'csv',
		name: 'CSV',
		description: 'Spreadsheet data (.csv)',
		extension: '.csv',
		icon: 'table'
	}
];

/**
 * Import Wizard Modal
 */
export class ImportWizardModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private currentStep: number = 0;
	private formData: ImportWizardFormData;
	private contentContainer: HTMLElement | null = null;
	private progressContainer: HTMLElement | null = null;
	private importer: GedcomImporterV2;
	private isImporting: boolean = false;
	private isParsing: boolean = false;

	// Step definitions
	private readonly steps = [
		{ number: 1, title: 'Format', description: 'Choose import format' },
		{ number: 2, title: 'File', description: 'Select file to import' },
		{ number: 3, title: 'Options', description: 'Configure import options' },
		{ number: 4, title: 'Preview', description: 'Review before importing' },
		{ number: 5, title: 'Import', description: 'Importing data...' },
		{ number: 6, title: 'Numbering', description: 'Assign reference numbers' },
		{ number: 7, title: 'Complete', description: 'Import finished' }
	];

	constructor(app: App, plugin: CanvasRootsPlugin) {
		super(app);
		this.plugin = plugin;
		this.formData = this.getDefaultFormData();
		this.importer = new GedcomImporterV2(app);
	}

	/**
	 * Get default form data
	 */
	private getDefaultFormData(): ImportWizardFormData {
		return {
			// Step 1
			format: 'gedcom',

			// Step 2
			file: null,
			fileName: '',
			fileSize: 0,

			// Step 3
			importPeople: true,
			importPlaces: true,
			importSources: true,
			importEvents: true,
			importMedia: true,
			importNotes: true,  // Default: import notes (Gramps only)
			createSeparateNoteFiles: false,  // Default: embed notes (Gramps only)
			mediaFolder: this.plugin?.settings?.mediaFolders?.[0] || 'Charted Roots/Media',
			preserveMediaFolderStructure: false,
			includeDynamicBlocks: true,
			targetFolder: this.plugin?.settings?.peopleFolder || 'People',
			conflictHandling: 'skip',

			// Step 4
			previewCounts: {
				people: 0,
				places: 0,
				sources: 0,
				events: 0,
				media: 0
			},
			duplicateCount: 0,
			fileContent: null,
			parsedData: null,
			parseErrors: [],
			parseWarnings: [],
			gpkgExtractionResult: null,

			// Step 5
			importedCount: 0,
			totalCount: 0,
			importLog: [],
			importResult: null,

			// Step 6
			numberingSystem: 'none',
			rootPersonCrId: null,
			rootPersonName: null,
			numberingStats: null,
			isAssigningNumbers: false,

			// Step 7
			importComplete: false,
			skippedCount: 0,
			privacyNoticeShown: false
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('crc-import-wizard');

		// Modal header with icon and title
		const header = contentEl.createDiv({ cls: 'crc-import-wizard-header' });

		const titleRow = header.createDiv({ cls: 'crc-wizard-title' });
		const iconEl = titleRow.createDiv({ cls: 'crc-wizard-title-icon' });
		setIcon(iconEl, 'download');
		titleRow.createSpan({ text: 'Import Data' });

		// Step progress indicator
		this.renderStepProgress(contentEl);

		// Content container
		this.contentContainer = contentEl.createDiv({ cls: 'crc-import-wizard-content' });

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
		this.progressContainer = container.createDiv({ cls: 'crc-wizard-progress' });
		this.updateStepProgress();
	}

	/**
	 * Update the step progress indicator
	 */
	private updateStepProgress(): void {
		if (!this.progressContainer) return;
		this.progressContainer.empty();

		const stepsRow = this.progressContainer.createDiv({ cls: 'crc-wizard-steps' });

		// Only show 5 step circles (steps 1-5) to keep UI compact
		// Steps 6 and 7 are conditional/post-import
		const visibleSteps = this.steps.slice(0, 5);

		visibleSteps.forEach((step, index) => {
			// Step circle with number
			const stepEl = stepsRow.createDiv({ cls: 'crc-wizard-step' });

			// Map currentStep to visible step index
			const effectiveStep = Math.min(this.currentStep, 4);

			// Mark active or completed
			if (index === effectiveStep) {
				stepEl.addClass('crc-wizard-step--active');
			} else if (index < effectiveStep) {
				stepEl.addClass('crc-wizard-step--completed');
			}

			// Step number circle
			const numberEl = stepEl.createDiv({ cls: 'crc-wizard-step-number' });
			if (index < effectiveStep) {
				// Show checkmark for completed steps
				setIcon(numberEl, 'check');
			} else {
				numberEl.textContent = String(step.number);
			}

			// Add connector between steps (except after last visible step)
			if (index < visibleSteps.length - 1) {
				const connector = stepsRow.createDiv({ cls: 'crc-wizard-connector' });
				if (index < effectiveStep) {
					connector.addClass('crc-wizard-connector--completed');
				}
			}
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
				this.renderStep1Format(this.contentContainer);
				break;
			case 1:
				this.renderStep2File(this.contentContainer);
				break;
			case 2:
				this.renderStep3Options(this.contentContainer);
				break;
			case 3:
				this.renderStep4Preview(this.contentContainer);
				break;
			case 4:
				this.renderStep5Import(this.contentContainer);
				break;
			case 5:
				this.renderStep6Numbering(this.contentContainer);
				break;
			case 6:
				this.renderStep7Complete(this.contentContainer);
				break;
		}

		// Render footer with navigation buttons
		this.renderFooter(this.contentContainer);
	}

	/**
	 * Step 1: Format Selection
	 */
	private renderStep1Format(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'crc-import-section' });
		section.createEl('h3', { text: 'Choose import format', cls: 'crc-import-section-title' });

		const formatGrid = section.createDiv({ cls: 'crc-import-format-grid' });

		for (const format of IMPORT_FORMATS) {
			const card = formatGrid.createDiv({ cls: 'crc-import-format-card' });
			if (this.formData.format === format.id) {
				card.addClass('crc-import-format-card--selected');
			}

			const cardHeader = card.createDiv({ cls: 'crc-import-format-card-header' });
			const iconEl = cardHeader.createDiv({ cls: 'crc-import-format-card-icon' });
			setIcon(iconEl, format.icon);
			cardHeader.createDiv({ cls: 'crc-import-format-card-title', text: format.name });

			card.createDiv({ cls: 'crc-import-format-card-description', text: format.description });

			card.addEventListener('click', () => {
				this.formData.format = format.id;
				this.renderCurrentStep();
			});
		}
	}

	/**
	 * Step 2: File Selection
	 */
	private renderStep2File(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'crc-import-section' });
		const selectedFormat = IMPORT_FORMATS.find(f => f.id === this.formData.format);
		section.createEl('h3', { text: `Select ${selectedFormat?.name || ''} file`, cls: 'crc-import-section-title' });

		// File dropzone
		const dropzone = section.createDiv({ cls: 'crc-import-dropzone' });

		if (this.formData.file) {
			dropzone.addClass('crc-import-dropzone--has-file');

			const fileInfo = dropzone.createDiv({ cls: 'crc-import-file-info' });
			const fileIcon = fileInfo.createDiv({ cls: 'crc-import-file-icon' });
			setIcon(fileIcon, 'file');

			const fileDetails = fileInfo.createDiv({ cls: 'crc-import-file-details' });
			fileDetails.createDiv({ cls: 'crc-import-file-name', text: this.formData.fileName });
			fileDetails.createDiv({
				cls: 'crc-import-file-size',
				text: this.formatFileSize(this.formData.fileSize)
			});

			const removeBtn = fileInfo.createDiv({ cls: 'crc-import-file-remove' });
			setIcon(removeBtn, 'x');
			removeBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.formData.file = null;
				this.formData.fileName = '';
				this.formData.fileSize = 0;
				this.renderCurrentStep();
			});
		} else {
			const dropzoneContent = dropzone.createDiv({ cls: 'crc-import-dropzone-content' });
			const dropzoneIcon = dropzoneContent.createDiv({ cls: 'crc-import-dropzone-icon' });
			setIcon(dropzoneIcon, 'upload');

			dropzoneContent.createDiv({
				cls: 'crc-import-dropzone-text',
				text: 'Drag and drop your file here'
			});
			dropzoneContent.createDiv({
				cls: 'crc-import-dropzone-subtext',
				text: 'or click to browse'
			});
		}

		// Hidden file input
		const fileInput = section.createEl('input', {
			type: 'file',
			cls: 'crc-import-file-input'
		});
		fileInput.accept = selectedFormat?.extension || '*';
		fileInput.setCssProps({ display: 'none' });

		fileInput.addEventListener('change', () => {
			if (fileInput.files && fileInput.files.length > 0) {
				const file = fileInput.files[0];
				this.formData.file = file;
				this.formData.fileName = file.name;
				this.formData.fileSize = file.size;
				this.renderCurrentStep();
			}
		});

		dropzone.addEventListener('click', () => {
			fileInput.click();
		});

		// Drag and drop handlers
		dropzone.addEventListener('dragover', (e) => {
			e.preventDefault();
			dropzone.addClass('crc-import-dropzone--dragover');
		});

		dropzone.addEventListener('dragleave', () => {
			dropzone.removeClass('crc-import-dropzone--dragover');
		});

		dropzone.addEventListener('drop', (e) => {
			e.preventDefault();
			dropzone.removeClass('crc-import-dropzone--dragover');

			if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
				const file = e.dataTransfer.files[0];
				this.formData.file = file;
				this.formData.fileName = file.name;
				this.formData.fileSize = file.size;
				this.renderCurrentStep();
			}
		});
	}

	/**
	 * Step 3: Options
	 */
	private renderStep3Options(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'crc-import-section' });

		// Entity types
		section.createEl('h4', { text: 'Entity types to import', cls: 'crc-import-options-title' });

		const entityOptions = section.createDiv({ cls: 'crc-import-options-grid' });

		this.renderToggleOption(entityOptions, 'People', 'Individual and family records', this.formData.importPeople, (val) => {
			this.formData.importPeople = val;
		});

		this.renderToggleOption(entityOptions, 'Places', 'Location records', this.formData.importPlaces, (val) => {
			this.formData.importPlaces = val;
		});

		this.renderToggleOption(entityOptions, 'Sources', 'Source citations', this.formData.importSources, (val) => {
			this.formData.importSources = val;
		});

		this.renderToggleOption(entityOptions, 'Events', 'Historical events', this.formData.importEvents, (val) => {
			this.formData.importEvents = val;
		});

		if (this.formData.format === 'gramps') {
			this.renderToggleOption(entityOptions, 'Media', 'Attached media files', this.formData.importMedia, (val) => {
				this.formData.importMedia = val;
			});

			this.renderToggleOption(entityOptions, 'Notes', 'Append Gramps notes to entity content', this.formData.importNotes, (val) => {
				this.formData.importNotes = val;
				// Refresh to show/hide dependent option
				this.renderCurrentStep();
			});

			// Show separate note files option only when Notes is enabled
			if (this.formData.importNotes) {
				this.renderToggleOption(entityOptions, 'Create separate note files', 'Create individual note files instead of embedding content', this.formData.createSeparateNoteFiles, (val) => {
					this.formData.createSeparateNoteFiles = val;
				});
			}
		}

		this.renderToggleOption(entityOptions, 'Dynamic blocks', 'Timeline, relationships, and media renderers in notes', this.formData.includeDynamicBlocks, (val) => {
			this.formData.includeDynamicBlocks = val;
		});

		// Target folder
		section.createEl('h4', { text: 'Target folder', cls: 'crc-import-options-title crc-mt-3' });

		const folderRow = section.createDiv({ cls: 'crc-import-option-row' });
		const folderInput = folderRow.createEl('input', {
			type: 'text',
			cls: 'crc-import-input',
			value: this.formData.targetFolder,
			placeholder: 'People'
		});
		folderInput.addEventListener('input', () => {
			this.formData.targetFolder = folderInput.value;
		});

		// Conflict handling
		section.createEl('h4', { text: 'Duplicate handling', cls: 'crc-import-options-title crc-mt-3' });

		const conflictOptions = section.createDiv({ cls: 'crc-import-conflict-options' });

		const conflictChoices: Array<{ id: ConflictHandling; label: string; description: string }> = [
			{ id: 'skip', label: 'Skip duplicates', description: 'Keep existing notes, skip new ones with same cr_id' },
			{ id: 'overwrite', label: 'Overwrite', description: 'Replace existing notes with imported data' },
			{ id: 'rename', label: 'Create new', description: 'Import as new notes with different names' }
		];

		for (const choice of conflictChoices) {
			const optionEl = conflictOptions.createDiv({ cls: 'crc-import-conflict-option' });
			if (this.formData.conflictHandling === choice.id) {
				optionEl.addClass('crc-import-conflict-option--selected');
			}

			optionEl.createDiv({ cls: 'crc-import-radio' });
			const radioContent = optionEl.createDiv({ cls: 'crc-import-radio-content' });
			radioContent.createDiv({ cls: 'crc-import-radio-label', text: choice.label });
			radioContent.createDiv({ cls: 'crc-import-radio-description', text: choice.description });

			optionEl.addEventListener('click', () => {
				this.formData.conflictHandling = choice.id;
				this.renderCurrentStep();
			});
		}
	}

	/**
	 * Step 4: Preview
	 */
	private renderStep4Preview(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'crc-import-section' });
		section.createEl('h3', { text: 'Preview', cls: 'crc-import-section-title' });

		// File info
		const fileCard = section.createDiv({ cls: 'crc-import-preview-card' });
		const fileHeader = fileCard.createDiv({ cls: 'crc-import-preview-header' });
		const fileIcon = fileHeader.createDiv({ cls: 'crc-import-preview-icon' });
		setIcon(fileIcon, 'file');
		fileHeader.createDiv({ cls: 'crc-import-preview-filename', text: this.formData.fileName });

		// Check if file needs parsing (GEDCOM or Gramps format)
		const needsParsing = (this.formData.format === 'gedcom' || this.formData.format === 'gramps')
			&& this.formData.previewCounts.people === 0
			&& this.formData.file
			&& !this.isParsing;  // Don't parse if already parsing

		if (needsParsing) {
			// Show loading state
			const loadingEl = section.createDiv({ cls: 'crc-import-preview-loading' });
			loadingEl.textContent = 'Parsing file...';

			// Parse the file asynchronously
			void this.parseFileForPreview();
			return;
		}

		// Show loading state if parsing is in progress
		if (this.isParsing) {
			const loadingEl = section.createDiv({ cls: 'crc-import-preview-loading' });
			loadingEl.textContent = 'Parsing file...';
			return;
		}

		// Show counts from parsed data
		const counts = section.createDiv({ cls: 'crc-import-preview-counts' });

		const { previewCounts } = this.formData;
		const countItems = [
			{ label: 'People', count: previewCounts.people, icon: 'users', enabled: this.formData.importPeople },
			{ label: 'Places', count: previewCounts.places, icon: 'map-pin', enabled: this.formData.importPlaces },
			{ label: 'Sources', count: previewCounts.sources, icon: 'archive', enabled: this.formData.importSources },
			{ label: 'Events', count: previewCounts.events, icon: 'calendar', enabled: this.formData.importEvents }
		];

		for (const item of countItems) {
			if (item.enabled) {
				const countEl = counts.createDiv({ cls: 'crc-import-preview-count' });
				const countIcon = countEl.createDiv({ cls: 'crc-import-preview-count-icon' });
				setIcon(countIcon, item.icon);
				countEl.createDiv({ cls: 'crc-import-preview-count-value', text: String(item.count) });
				countEl.createDiv({ cls: 'crc-import-preview-count-label', text: item.label });
			}
		}

		// Media folder selection (only show for Gramps with media files)
		if (this.formData.format === 'gramps' &&
			this.formData.importMedia &&
			this.formData.gpkgExtractionResult &&
			this.formData.gpkgExtractionResult.mediaFiles.size > 0) {

			const mediaCount = this.formData.gpkgExtractionResult.mediaFiles.size;
			const mediaFolderSection = section.createDiv({ cls: 'crc-import-media-folder-section crc-mt-3' });
			mediaFolderSection.createEl('h4', {
				text: `Media destination (${mediaCount} files)`,
				cls: 'crc-import-options-title'
			});

			const mediaFolderRow = mediaFolderSection.createDiv({ cls: 'crc-import-option-row' });
			const mediaFolderSelect = mediaFolderRow.createEl('select', { cls: 'crc-import-select' });

			// Build folder options
			const settings = this.plugin?.settings;
			const configuredFolders = settings?.mediaFolders?.filter((f: string) => f.trim()) || [];
			const defaultFolder = 'Charted Roots/Media';

			// Option 1: Configured folders from settings
			for (const folder of configuredFolders) {
				const option = mediaFolderSelect.createEl('option', { value: folder, text: folder });
				if (this.formData.mediaFolder === folder) {
					option.selected = true;
				}
			}

			// Option 2: Default folder (if not in configured list)
			if (!configuredFolders.includes(defaultFolder)) {
				const option = mediaFolderSelect.createEl('option', {
					value: defaultFolder,
					text: `${defaultFolder} (default)`
				});
				if (this.formData.mediaFolder === defaultFolder) {
					option.selected = true;
				}
			}

			// Option 3: Custom folder
			const customOption = mediaFolderSelect.createEl('option', { value: '__custom__', text: 'Custom folder...' });
			const isCustom = !configuredFolders.includes(this.formData.mediaFolder) &&
				this.formData.mediaFolder !== defaultFolder;
			if (isCustom) {
				customOption.selected = true;
			}

			// Custom folder input (hidden by default)
			const customFolderRow = mediaFolderSection.createDiv({ cls: `crc-import-option-row crc-mt-1${isCustom ? '' : ' crc-hidden'}` });
			const customFolderInput = customFolderRow.createEl('input', {
				type: 'text',
				cls: 'crc-import-input',
				placeholder: 'Enter custom folder path',
				value: isCustom ? this.formData.mediaFolder : ''
			});

			mediaFolderSelect.addEventListener('change', () => {
				if (mediaFolderSelect.value === '__custom__') {
					customFolderRow.removeClass('crc-hidden');
					customFolderInput.focus();
				} else {
					customFolderRow.addClass('crc-hidden');
					this.formData.mediaFolder = mediaFolderSelect.value;
				}
			});

			customFolderInput.addEventListener('input', () => {
				this.formData.mediaFolder = customFolderInput.value || defaultFolder;
			});

			// Checkbox to preserve folder structure from .gpkg
			const preserveStructureRow = mediaFolderSection.createDiv({ cls: 'crc-import-option-row crc-mt-2' });
			const preserveCheckbox = preserveStructureRow.createEl('input', {
				type: 'checkbox',
				cls: 'crc-import-checkbox'
			});
			preserveCheckbox.id = 'preserve-media-structure';
			preserveCheckbox.checked = this.formData.preserveMediaFolderStructure;

			const preserveLabel = preserveStructureRow.createEl('label', {
				cls: 'crc-import-checkbox-label',
				text: 'Preserve folder structure from package'
			});
			preserveLabel.setAttribute('for', 'preserve-media-structure');

			// Show example of original paths
			const examplePaths = Array.from(this.formData.gpkgExtractionResult.mediaFiles.keys()).slice(0, 2);
			if (examplePaths.length > 0) {
				const exampleEl = mediaFolderSection.createDiv({ cls: 'crc-import-option-hint crc-mt-1' });
				const firstPath = examplePaths[0];
				const pathParts = firstPath.split('/');
				if (pathParts.length > 1) {
					const folderPath = pathParts.slice(0, -1).join('/');
					exampleEl.textContent = `e.g., ${this.formData.mediaFolder}/${folderPath}/...`;
				}
			}

			preserveCheckbox.addEventListener('change', () => {
				this.formData.preserveMediaFolderStructure = preserveCheckbox.checked;
			});
		}

		// Show warnings if any
		if (this.formData.parseWarnings.length > 0) {
			const warningEl = section.createDiv({ cls: 'crc-import-preview-warning' });
			const warningHeader = warningEl.createDiv({ cls: 'crc-import-preview-warning-header' });
			const warningIcon = warningHeader.createDiv({ cls: 'crc-import-preview-warning-icon' });
			setIcon(warningIcon, 'alert-triangle');
			warningHeader.createDiv({
				cls: 'crc-import-preview-warning-text',
				text: `${this.formData.parseWarnings.length} warning(s) found during parsing`
			});
			const expandIcon = warningHeader.createDiv({ cls: 'crc-import-preview-warning-expand' });
			setIcon(expandIcon, 'chevron-down');

			// Create collapsible details container
			const warningDetails = warningEl.createDiv({ cls: 'crc-import-preview-warning-details crc-hidden' });
			for (const warning of this.formData.parseWarnings.slice(0, 10)) {
				warningDetails.createDiv({ cls: 'crc-import-preview-warning-detail', text: warning });
			}
			if (this.formData.parseWarnings.length > 10) {
				warningDetails.createDiv({
					cls: 'crc-import-preview-warning-more',
					text: `...and ${this.formData.parseWarnings.length - 10} more`
				});
			}

			// Toggle expansion on click
			warningHeader.addClass('crc-clickable');
			warningHeader.addEventListener('click', () => {
				const isExpanded = !warningDetails.hasClass('crc-hidden');
				warningDetails.toggleClass('crc-hidden', isExpanded);
				setIcon(expandIcon, isExpanded ? 'chevron-down' : 'chevron-up');
			});
		}

		// Show errors if any
		if (this.formData.parseErrors.length > 0) {
			const errorEl = section.createDiv({ cls: 'crc-import-preview-error' });
			const errorIcon = errorEl.createDiv({ cls: 'crc-import-preview-error-icon' });
			setIcon(errorIcon, 'x-circle');
			errorEl.createDiv({
				cls: 'crc-import-preview-error-text',
				text: `${this.formData.parseErrors.length} error(s) found. Import may fail.`
			});
			for (const error of this.formData.parseErrors.slice(0, 3)) {
				errorEl.createDiv({ cls: 'crc-import-preview-error-detail', text: error });
			}
		}

		// Ready message
		if (this.formData.parseErrors.length === 0) {
			const readyEl = section.createDiv({ cls: 'crc-import-preview-ready' });
			readyEl.createSpan({ text: 'Ready to import. Click Next to proceed.' });
		}
	}

	/**
	 * Parse file for preview counts
	 */
	private async parseFileForPreview(): Promise<void> {
		if (!this.formData.file) return;

		// Guard against concurrent parsing
		if (this.isParsing) return;
		this.isParsing = true;

		try {
			// Parse based on format
			if (this.formData.format === 'gedcom') {
				// Read file content as text
				const content = await this.formData.file.text();
				this.formData.fileContent = content;

				// Use the importer to analyze and parse
				const analysis = this.importer.analyzeFile(content);

				this.formData.previewCounts = {
					people: analysis.individualCount,
					places: analysis.uniquePlaces,
					sources: analysis.sourceCount,
					events: analysis.eventCount,
					media: 0 // GEDCOM doesn't include media count in analysis
				};

				// Parse for validation
				const parseResult = this.importer.parseContent(content);
				this.formData.parseErrors = parseResult.errors;
				this.formData.parseWarnings = parseResult.warnings;

				if (parseResult.valid && parseResult.data) {
					this.formData.parsedData = parseResult.data;
				}
			} else if (this.formData.format === 'gramps') {
				// Read file as ArrayBuffer for .gpkg extraction
				const arrayBuffer = await this.formData.file.arrayBuffer();
				const fileName = this.formData.fileName.toLowerCase();

				let grampsXml: string;
				let mediaCount = 0;

				if (fileName.endsWith('.gpkg')) {
					// Extract XML from .gpkg package (ZIP or gzip-compressed tar)
					const extraction = await extractGpkg(arrayBuffer, this.formData.fileName);
					grampsXml = extraction.grampsXml;
					mediaCount = extraction.mediaFiles.size;

					// Store extraction result for use during import
					this.formData.gpkgExtractionResult = extraction;
				} else {
					// Plain .gramps XML file - may be gzip-compressed
					grampsXml = await readFileWithDecompression(this.formData.file);
				}

				// Store the extracted/read XML content
				this.formData.fileContent = grampsXml;

				// Validate and get counts
				const validation = GrampsParser.validate(grampsXml);

				this.formData.previewCounts = {
					people: validation.stats.personCount,
					places: validation.stats.placeCount,
					sources: validation.stats.sourceCount,
					events: validation.stats.eventCount,
					media: mediaCount
				};

				// Convert validation errors and warnings
				this.formData.parseErrors = validation.errors.map(e => e.message);
				this.formData.parseWarnings = validation.warnings.map(w => w.message);
			}
		} catch (error) {
			this.formData.parseErrors = [`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`];
		} finally {
			// Clear the parsing flag before re-rendering
			this.isParsing = false;
			// Re-render to show results
			this.renderCurrentStep();
		}
	}

	/**
	 * Step 5: Import Progress
	 */
	private renderStep5Import(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'crc-import-section' });
		section.createEl('h3', { text: 'Importing...', cls: 'crc-import-section-title' });

		// Progress bar
		const progressBar = section.createDiv({ cls: 'crc-import-progress-bar' });
		const progressFill = progressBar.createDiv({ cls: 'crc-import-progress-fill' });
		progressFill.setCssProps({ width: '0%' });

		// Status text
		const statusEl = section.createDiv({ cls: 'crc-import-progress-status' });
		statusEl.textContent = 'Starting import...';

		// Log area
		const logArea = section.createDiv({ cls: 'crc-import-log' });

		// Start import if not already running
		if (!this.isImporting) {
			void this.runImport(progressFill, statusEl, logArea);
		}
	}

	/**
	 * Run the actual import
	 */
	private async runImport(
		progressFill: HTMLElement,
		statusEl: HTMLElement,
		logArea: HTMLElement
	): Promise<void> {
		if (this.isImporting) return;
		this.isImporting = true;

		const addLogEntry = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
			const entry = logArea.createDiv({ cls: `crc-import-log-entry crc-import-log-entry--${type}` });
			entry.textContent = message;
			logArea.scrollTop = logArea.scrollHeight;
			this.formData.importLog.push(message);
		};

		try {
			if (this.formData.format === 'gedcom') {
				addLogEntry('Starting GEDCOM import...');

				if (!this.formData.fileContent) {
					throw new Error('No file content available');
				}

				// Build import options
				const settings = this.plugin.settings;
				const options: GedcomImportOptionsV2 = {
					peopleFolder: this.formData.targetFolder || settings.peopleFolder,
					eventsFolder: settings.eventsFolder,
					sourcesFolder: settings.sourcesFolder,
					placesFolder: settings.placesFolder,
					overwriteExisting: this.formData.conflictHandling === 'overwrite',
					fileName: this.formData.fileName,
					createPeopleNotes: this.formData.importPeople,
					createEventNotes: this.formData.importEvents,
					createSourceNotes: this.formData.importSources,
					createPlaceNotes: this.formData.importPlaces,
					includeDynamicBlocks: this.formData.includeDynamicBlocks,
					dynamicBlockTypes: ['media', 'timeline', 'relationships'],
					compatibilityMode: settings.gedcomCompatibilityMode,
					onProgress: (progress) => {
						// Update UI based on progress
						const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
						progressFill.setCssProps({ width: `${percent}%` });
						statusEl.textContent = progress.message || `${progress.phase}: ${progress.current}/${progress.total}`;

						if (progress.message) {
							addLogEntry(progress.message);
						}
					}
				};

				// Run import
				const result = await this.importer.importFile(
					this.formData.fileContent,
					options,
					this.formData.parsedData || undefined
				);

				this.formData.importResult = result;
				this.formData.importedCount = result.individualsImported;

				// Calculate total notes created
				const totalCreated = result.individualsImported + result.eventsCreated + result.sourcesCreated + result.placesCreated;

				if (result.success) {
					progressFill.setCssProps({ width: '100%' });
					addLogEntry(`Import complete! ${result.individualsImported} people imported.`, 'success');

					if (result.eventsCreated > 0) {
						addLogEntry(`Created ${result.eventsCreated} event notes.`, 'success');
					}
					if (result.sourcesCreated > 0) {
						addLogEntry(`Created ${result.sourcesCreated} source notes.`, 'success');
					}
					if (result.placesCreated > 0) {
						addLogEntry(`Created ${result.placesCreated} place notes.`, 'success');
					}

					// Show any warnings
					for (const warning of result.warnings.slice(0, 5)) {
						addLogEntry(warning, 'warning');
					}

					// Auto-advance to numbering step after a short delay
					setTimeout(() => {
						this.currentStep = 5; // Numbering step
						this.isImporting = false;
						this.renderCurrentStep();
					}, 1500);
				} else {
					addLogEntry('Import failed!', 'error');
					for (const error of result.errors) {
						addLogEntry(error, 'error');
					}
					this.isImporting = false;
				}

				// Auto-create bases for imported note types (even if some errors occurred)
				if (totalCreated > 0) {
					void this.plugin.createAllBases({ silent: true });
				}
			} else if (this.formData.format === 'gramps') {
				addLogEntry('Starting Gramps import...');

				if (!this.formData.fileContent) {
					throw new Error('No file content available');
				}

				// Disable bidirectional sync during import to prevent duplicate relationships
				// The file watcher would otherwise trigger syncRelationships before Phase 2 replaces Gramps handles with cr_ids
				this.plugin.disableBidirectionalSync();
				this.plugin.bidirectionalLinker?.suspend();

				try {
					// Build import options
					const settings = this.plugin.settings;
					const options: GrampsImportOptions = {
						peopleFolder: this.formData.targetFolder || settings.peopleFolder,
						overwriteExisting: this.formData.conflictHandling === 'overwrite',
						fileName: this.formData.fileName,
						createSourceNotes: this.formData.importSources,
						sourcesFolder: settings.sourcesFolder,
						createPlaceNotes: this.formData.importPlaces,
						placesFolder: settings.placesFolder,
						createEventNotes: this.formData.importEvents,
						eventsFolder: settings.eventsFolder,
						propertyAliases: settings.propertyAliases,
						includeDynamicBlocks: this.formData.includeDynamicBlocks,
						dynamicBlockTypes: ['media', 'timeline', 'relationships'],
						// Pass media files from .gpkg extraction if available
						mediaFiles: this.formData.gpkgExtractionResult?.mediaFiles,
						mediaFolder: this.formData.mediaFolder,
						preserveMediaFolderStructure: this.formData.preserveMediaFolderStructure,
						extractMedia: this.formData.importMedia && this.formData.gpkgExtractionResult !== null,
						importNotes: this.formData.importNotes,
						createSeparateNoteFiles: this.formData.createSeparateNoteFiles,
						notesFolder: settings.notesFolder,
						onProgress: (progress) => {
							// Update UI based on progress
							const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
							progressFill.setCssProps({ width: `${percent}%` });
							statusEl.textContent = progress.message || `${progress.phase}: ${progress.current}/${progress.total}`;

							if (progress.message) {
								addLogEntry(progress.message);
							}
						}
					};

					// Run import
					const grampsImporter = new GrampsImporter(this.app);
					const result = await grampsImporter.importFile(
						this.formData.fileContent,
						options
					);

					this.formData.importResult = result;
					this.formData.importedCount = result.individualsImported;

					// Calculate total notes created
					const grampsTotal = result.individualsImported +
						(result.placeNotesCreated || 0) +
						(result.sourceNotesCreated || 0) +
						(result.eventNotesCreated || 0);

					if (result.success) {
						progressFill.setCssProps({ width: '100%' });
						addLogEntry(`Import complete! ${result.individualsImported} people imported.`, 'success');

						if (result.mediaFilesExtracted && result.mediaFilesExtracted > 0) {
							addLogEntry(`Extracted ${result.mediaFilesExtracted} media files.`, 'success');
						}
						if (result.placeNotesCreated && result.placeNotesCreated > 0) {
							addLogEntry(`Created ${result.placeNotesCreated} place notes.`, 'success');
						}
						if (result.sourceNotesCreated && result.sourceNotesCreated > 0) {
							addLogEntry(`Created ${result.sourceNotesCreated} source notes.`, 'success');
						}
						if (result.eventNotesCreated && result.eventNotesCreated > 0) {
							addLogEntry(`Created ${result.eventNotesCreated} event notes.`, 'success');
						}
						if (result.duplicateEventsSkipped && result.duplicateEventsSkipped > 0) {
							addLogEntry(`Skipped ${result.duplicateEventsSkipped} duplicate event(s) in source file.`, 'warning');
						}

						// Show any errors as warnings
						for (const error of result.errors.slice(0, 5)) {
							addLogEntry(error, 'warning');
						}

						// Auto-advance to numbering step after a short delay
						setTimeout(() => {
							this.currentStep = 5; // Numbering step
							this.isImporting = false;
							this.renderCurrentStep();
						}, 1500);
					} else {
						addLogEntry('Import failed!', 'error');
						for (const error of result.errors) {
							addLogEntry(error, 'error');
						}
						this.isImporting = false;
					}

					// Auto-create bases for imported note types (even if some errors occurred)
					if (grampsTotal > 0) {
						void this.plugin.createAllBases({ silent: true });
					}
				} finally {
					// Re-enable bidirectional sync after import completes (success or failure)
					this.plugin.enableBidirectionalSync();
					this.plugin.bidirectionalLinker?.resume();
				}
			} else {
				// Other formats not yet implemented
				addLogEntry(`Import format '${this.formData.format}' is not yet supported.`, 'warning');
				this.isImporting = false;
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			addLogEntry(`Import failed: ${message}`, 'error');
			this.isImporting = false;
		}
	}

	/**
	 * Step 6: Reference Numbering
	 */
	private renderStep6Numbering(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'crc-import-section' });

		// Success message
		const successEl = section.createDiv({ cls: 'crc-import-success' });
		const successIcon = successEl.createDiv({ cls: 'crc-import-success-icon' });
		setIcon(successIcon, 'check-circle');
		successEl.createDiv({ cls: 'crc-import-success-text', text: 'Import successful!' });
		successEl.createDiv({ cls: 'crc-import-success-count', text: `${this.formData.importedCount} people imported` });

		section.createEl('h3', { text: 'Assign reference numbers?', cls: 'crc-import-section-title crc-mt-3' });

		const helpText = section.createDiv({ cls: 'crc-import-help-text' });
		helpText.textContent = 'Reference numbers help organize and cite individuals in your tree. You can also do this later from the context menu.';

		// Numbering system options
		section.createEl('h4', { text: 'Numbering system', cls: 'crc-import-options-title crc-mt-3' });

		const numberingOptions = section.createDiv({ cls: 'crc-import-numbering-options' });

		const systems: Array<{ id: NumberingSystem; label: string; description: string }> = [
			{ id: 'ahnentafel', label: 'Ahnentafel', description: 'Ancestor numbering: self=1, father=2, mother=3, paternal grandfather=4, etc.' },
			{ id: 'daboville', label: "d'Aboville", description: 'Descendant numbering with dots: 1, 1.1, 1.2, 1.1.1, etc.' },
			{ id: 'henry', label: 'Henry', description: 'Compact descendant numbering: 1, 11, 12, 111, etc.' },
			{ id: 'generation', label: 'Generation', description: 'Relative generation depth: 0=self, -1=parents, +1=children' }
		];

		for (const system of systems) {
			const optionEl = numberingOptions.createDiv({ cls: 'crc-import-numbering-option' });
			if (this.formData.numberingSystem === system.id) {
				optionEl.addClass('crc-import-numbering-option--selected');
			}

			optionEl.createDiv({ cls: 'crc-import-radio' });
			const radioContent = optionEl.createDiv({ cls: 'crc-import-radio-content' });
			radioContent.createDiv({ cls: 'crc-import-radio-label', text: system.label });
			radioContent.createDiv({ cls: 'crc-import-radio-description', text: system.description });

			optionEl.addEventListener('click', () => {
				this.formData.numberingSystem = system.id;
				this.renderCurrentStep();
			});
		}

		// Root person picker (if a numbering system is selected)
		if (this.formData.numberingSystem !== 'none') {
			section.createEl('h4', { text: 'Root person', cls: 'crc-import-options-title crc-mt-3' });

			const rootPersonNote = section.createDiv({ cls: 'crc-import-help-text' });
			rootPersonNote.textContent = 'Numbers are assigned relative to this person.';

			// Person picker button
			const pickerContainer = section.createDiv({ cls: 'crc-import-person-picker' });

			if (this.formData.rootPersonName) {
				// Show selected person
				const selectedPerson = pickerContainer.createDiv({ cls: 'crc-import-selected-person' });
				const personIcon = selectedPerson.createDiv({ cls: 'crc-import-selected-person-icon' });
				setIcon(personIcon, 'user');
				selectedPerson.createDiv({ cls: 'crc-import-selected-person-name', text: this.formData.rootPersonName });

				const changeBtn = selectedPerson.createEl('button', {
					cls: 'crc-btn crc-btn--small crc-btn--secondary',
					text: 'Change'
				});
				changeBtn.addEventListener('click', () => this.openPersonPicker());
			} else {
				// Show picker button
				const pickerBtn = pickerContainer.createEl('button', {
					cls: 'crc-btn crc-btn--secondary'
				});
				const btnIcon = pickerBtn.createSpan({ cls: 'crc-btn-icon' });
				setIcon(btnIcon, 'user-plus');
				pickerBtn.createSpan({ text: 'Select root person' });

				pickerBtn.addEventListener('click', () => this.openPersonPicker());
			}
		}
	}

	/**
	 * Open the person picker modal
	 */
	private openPersonPicker(): void {
		const picker = new PersonPickerModal(
			this.app,
			(person: PersonInfo) => {
				this.formData.rootPersonCrId = person.crId;
				this.formData.rootPersonName = person.name;
				this.renderCurrentStep();
			},
			{
				title: 'Select root person',
				subtitle: 'Choose the person to use as the root for numbering'
			}
		);
		picker.open();
	}

	/**
	 * Assign reference numbers using the selected system
	 */
	private async assignReferenceNumbers(): Promise<void> {
		if (!this.formData.rootPersonCrId || this.formData.numberingSystem === 'none') {
			return;
		}

		this.formData.isAssigningNumbers = true;
		this.renderCurrentStep();

		try {
			const numberingService = new ReferenceNumberingService(this.app);
			let stats: NumberingStats;

			// Map our NumberingSystem to RefNumberingSystem (they're the same values except 'none')
			const system = this.formData.numberingSystem as RefNumberingSystem;

			switch (system) {
				case 'ahnentafel':
					stats = await numberingService.assignAhnentafel(this.formData.rootPersonCrId);
					break;
				case 'daboville':
					stats = await numberingService.assignDAboville(this.formData.rootPersonCrId);
					break;
				case 'henry':
					stats = await numberingService.assignHenry(this.formData.rootPersonCrId);
					break;
				case 'generation':
					stats = await numberingService.assignGeneration(this.formData.rootPersonCrId);
					break;
				default:
					throw new Error(`Unknown numbering system: ${system}`);
			}

			this.formData.numberingStats = stats;
			new Notice(`Assigned ${stats.totalAssigned} ${this.getNumberingSystemName()} numbers`);

			// Advance to complete step
			this.formData.isAssigningNumbers = false;
			this.currentStep = 6;
			this.renderCurrentStep();
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			new Notice(`Failed to assign numbers: ${message}`);
			this.formData.isAssigningNumbers = false;
			this.renderCurrentStep();
		}
	}

	/**
	 * Step 7: Complete
	 */
	private renderStep7Complete(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'crc-import-section' });

		// Completion message
		const completeEl = section.createDiv({ cls: 'crc-import-complete' });
		const completeIcon = completeEl.createDiv({ cls: 'crc-import-complete-icon' });
		setIcon(completeIcon, 'check-circle');
		completeEl.createDiv({ cls: 'crc-import-complete-title', text: 'Import Complete!' });
		completeEl.createDiv({ cls: 'crc-import-complete-message', text: 'Your data has been successfully imported.' });

		// Summary stats - use actual imported counts from result, not file preview counts
		const stats = section.createDiv({ cls: 'crc-import-complete-stats' });

		// Get actual counts from import result, falling back to 0 if entity type wasn't imported
		const result = this.formData.importResult;
		const actualPeople = this.formData.importPeople ? (result?.individualsImported ?? 0) : 0;
		const actualPlaces = this.formData.importPlaces ? (this.getImportedPlaceCount() ?? 0) : 0;
		const actualSources = this.formData.importSources ? (this.getImportedSourceCount() ?? 0) : 0;
		const actualEvents = this.formData.importEvents ? (this.getImportedEventCount() ?? 0) : 0;

		const statItems = [
			{ label: 'People', value: actualPeople, color: 'blue', enabled: this.formData.importPeople },
			{ label: 'Places', value: actualPlaces, color: 'green', enabled: this.formData.importPlaces },
			{ label: 'Sources', value: actualSources, color: 'purple', enabled: this.formData.importSources },
			{ label: 'Events', value: actualEvents, color: 'orange', enabled: this.formData.importEvents }
		];

		for (const stat of statItems) {
			// Only show stats for entity types that were selected for import
			if (stat.enabled && stat.value > 0) {
				const statEl = stats.createDiv({ cls: 'crc-import-complete-stat' });
				statEl.createDiv({ cls: `crc-import-complete-stat-value crc-import-complete-stat-value--${stat.color}`, text: String(stat.value) });
				statEl.createDiv({ cls: 'crc-import-complete-stat-label', text: stat.label });
			}
		}

		// Preprocessing info (MyHeritage compatibility fixes) - only for GEDCOM imports
		const gedcomResult = result as GedcomImportResultV2 | undefined;
		if (gedcomResult?.preprocessingApplied && gedcomResult.preprocessingFixes) {
			const preprocessingEl = section.createDiv({ cls: 'crc-import-preprocessing-info' });
			const preprocessingTitle = preprocessingEl.createDiv({ cls: 'crc-import-preprocessing-title' });
			const preprocessingIcon = preprocessingTitle.createSpan({ cls: 'crc-import-preprocessing-icon' });
			setIcon(preprocessingIcon, 'wrench');
			preprocessingTitle.createSpan({ text: 'Compatibility Fixes Applied' });

			const fixesList = preprocessingEl.createEl('ul', { cls: 'crc-import-preprocessing-fixes' });

			if (gedcomResult.preprocessingFixes.bomRemoved) {
				fixesList.createEl('li', { text: 'Removed UTF-8 byte order mark (BOM)' });
			}

			if (gedcomResult.preprocessingFixes.concFieldsNormalized > 0) {
				fixesList.createEl('li', {
					text: `Fixed ${gedcomResult.preprocessingFixes.concFieldsNormalized} fields with HTML encoding issues`
				});
			}

			const preprocessingNote = preprocessingEl.createDiv({ cls: 'crc-import-preprocessing-note' });
			preprocessingNote.createSpan({ text: 'MyHeritage GEDCOM issues were automatically corrected. Your original file was not modified.' });
		}

		// Skipped/duplicates info
		if (this.formData.skippedCount > 0) {
			const skippedEl = section.createDiv({ cls: 'crc-import-complete-skipped' });
			skippedEl.textContent = `${this.formData.skippedCount} duplicates were skipped.`;
		}

		// Numbering result
		if (this.formData.numberingStats) {
			const numberingEl = section.createDiv({ cls: 'crc-import-complete-numbering' });
			const checkIcon = numberingEl.createSpan({ cls: 'crc-import-complete-numbering-icon' });
			setIcon(checkIcon, 'check');
			numberingEl.createSpan({
				text: `${this.getNumberingSystemName()} numbers assigned to ${this.formData.numberingStats.totalAssigned} people from ${this.formData.rootPersonName}`
			});
		}

		// Cleanup Wizard prompt
		const cleanupSection = section.createDiv({ cls: 'crc-import-cleanup-prompt crc-mt-3' });
		const cleanupNote = cleanupSection.createDiv({ cls: 'crc-import-cleanup-note' });
		const infoIcon = cleanupNote.createSpan({ cls: 'crc-import-cleanup-note-icon' });
		setIcon(infoIcon, 'info');
		cleanupNote.createSpan({
			text: 'Run the Cleanup Wizard to fix data quality issues like date formats, missing relationships, and place standardization.'
		});

		const cleanupBtn = cleanupSection.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-mt-2'
		});
		const cleanupBtnIcon = cleanupBtn.createSpan({ cls: 'crc-btn-icon' });
		setIcon(cleanupBtnIcon, 'sparkles');
		cleanupBtn.createSpan({ text: 'Run Cleanup Wizard' });
		cleanupBtn.addEventListener('click', () => {
			this.close();
			void import('./cleanup-wizard-modal').then(({ CleanupWizardModal }) => {
				new CleanupWizardModal(this.app, this.plugin).open();
			});
		});

		// Staging Manager prompt (show when imported to staging folder)
		if (this.isImportedToStaging()) {
			const stagingSection = section.createDiv({ cls: 'crc-import-staging-prompt crc-mt-3' });
			const stagingNote = stagingSection.createDiv({ cls: 'crc-import-staging-note' });
			const stagingInfoIcon = stagingNote.createSpan({ cls: 'crc-import-staging-note-icon' });
			setIcon(stagingInfoIcon, 'archive');
			stagingNote.createSpan({
				text: 'Data imported to staging. Review and promote to your main tree when ready.'
			});

			const stagingBtn = stagingSection.createEl('button', {
				cls: 'crc-btn crc-btn--secondary crc-mt-2'
			});
			const stagingBtnIcon = stagingBtn.createSpan({ cls: 'crc-btn-icon' });
			setIcon(stagingBtnIcon, 'archive');
			stagingBtn.createSpan({ text: 'Manage Staging' });
			stagingBtn.addEventListener('click', () => {
				this.close();
				void import('./staging-management-modal').then(({ StagingManagementModal }) => {
					new StagingManagementModal(this.app, this.plugin).open();
				});
			});
		}

		// Check for privacy notice (after first import with living persons)
		void this.checkPrivacyNotice();
	}

	/**
	 * Check if we should show the privacy notice after import.
	 * Shows notice when:
	 * - Privacy protection is not enabled
	 * - User hasn't dismissed the notice
	 * - People were imported (potential living persons)
	 */
	private async checkPrivacyNotice(): Promise<void> {
		// Don't show if already shown this session
		if (this.formData.privacyNoticeShown) {
			return;
		}

		// Don't show if user has permanently dismissed
		if (this.plugin.settings.privacyNoticeDismissed) {
			return;
		}

		// Don't show if privacy protection is already enabled
		if (this.plugin.settings.enablePrivacyProtection) {
			return;
		}

		// Don't show if no people were imported
		const result = this.formData.importResult;
		if (!result || result.individualsImported === 0) {
			return;
		}

		// Count potential living persons using the threshold logic
		const livingCount = this.countPotentialLivingPersons();
		if (livingCount === 0) {
			return;
		}

		// Mark as shown for this session
		this.formData.privacyNoticeShown = true;

		// Show the privacy notice modal
		const modal = new PrivacyNoticeModal(this.app, livingCount);
		const decision = await modal.waitForDecision();

		if (decision === 'configure') {
			// Open plugin settings (privacy section)
			// @ts-expect-error - Obsidian internal API for opening plugin settings
			this.app.setting?.open();
			// @ts-expect-error - Navigate to plugin tab
			this.app.setting?.openTabById?.(this.plugin.manifest.id);
		} else if (decision === 'dismiss') {
			// Remember not to show again
			this.plugin.settings.privacyNoticeDismissed = true;
			await this.plugin.saveSettings();
		}
		// 'later' - do nothing, notice will show again next import
	}

	/**
	 * Count people who might be living based on birth/death data.
	 * Uses same logic as privacy service but without requiring privacy to be enabled.
	 */
	private countPotentialLivingPersons(): number {
		const currentYear = new Date().getFullYear();
		const threshold = this.plugin.settings.livingPersonAgeThreshold;
		let count = 0;

		// Get all people from cache
		const files = this.app.vault.getMarkdownFiles();
		const peopleFolder = this.plugin.settings.peopleFolder;

		for (const file of files) {
			// Only check files in people folder
			if (!file.path.startsWith(peopleFolder)) {
				continue;
			}

			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (!fm) continue;

			// Check if person has entity type marker
			if (fm.cr_type !== 'person' && !fm.cr_id) continue;

			// Has death date = not living
			if (fm.death_date || fm.deathDate) continue;

			// Check birth date
			const birthDate = fm.birth_date || fm.birthDate;
			if (birthDate) {
				const birthYear = this.extractBirthYear(String(birthDate));
				if (birthYear && (currentYear - birthYear) < threshold) {
					count++;
				}
			}
		}

		return count;
	}

	/**
	 * Extract year from a date string
	 */
	private extractBirthYear(dateStr: string): number | null {
		const match = dateStr.match(/\b(1[89]\d{2}|20\d{2})\b/);
		return match ? parseInt(match[1], 10) : null;
	}

	/**
	 * Render footer with navigation buttons
	 */
	private renderFooter(container: HTMLElement): void {
		const footer = container.createDiv({ cls: 'crc-import-footer' });

		// Left side: Cancel or Back
		const leftBtns = footer.createDiv({ cls: 'crc-import-footer-left' });

		if (this.currentStep === 0) {
			// Step 0: Show Cancel button
			const cancelBtn = leftBtns.createEl('button', {
				cls: 'crc-btn crc-btn--secondary',
				text: 'Cancel'
			});
			cancelBtn.addEventListener('click', () => this.close());
		} else if (this.currentStep < 4) {
			// Steps 1-3: Show Back button
			const backBtn = leftBtns.createEl('button', {
				cls: 'crc-btn crc-btn--secondary',
				text: 'Back'
			});
			backBtn.addEventListener('click', () => {
				this.currentStep--;
				this.renderCurrentStep();
			});
		} else if (this.currentStep === 5) {
			// Step 5 (Numbering): Show Skip button
			const skipBtn = leftBtns.createEl('button', {
				cls: 'crc-btn crc-btn--secondary',
				text: 'Skip'
			});
			skipBtn.addEventListener('click', () => {
				this.formData.numberingSystem = 'none';
				this.currentStep = 6;
				this.renderCurrentStep();
			});
		}

		// Right side: Next or action buttons
		const rightBtns = footer.createDiv({ cls: 'crc-import-footer-right' });

		if (this.currentStep < 3) {
			// Steps 0-2: Show Next button
			const nextBtn = rightBtns.createEl('button', {
				cls: 'crc-btn crc-btn--primary',
				text: 'Next'
			});

			// Disable if requirements not met
			if (!this.canProceedToNextStep()) {
				nextBtn.disabled = true;
				nextBtn.addClass('crc-btn--disabled');
			}

			nextBtn.addEventListener('click', () => {
				if (this.canProceedToNextStep()) {
					this.currentStep++;
					this.renderCurrentStep();
				}
			});
		} else if (this.currentStep === 3) {
			// Step 3: Show Import button
			const importBtn = rightBtns.createEl('button', {
				cls: 'crc-btn crc-btn--primary',
				text: 'Import'
			});
			importBtn.addEventListener('click', () => {
				this.currentStep = 4;
				this.renderCurrentStep();
				// TODO: Start actual import
			});
		} else if (this.currentStep === 5) {
			// Step 5 (Numbering): Show Assign Numbers button
			const assignBtn = rightBtns.createEl('button', {
				cls: 'crc-btn crc-btn--primary',
				text: this.formData.isAssigningNumbers ? 'Assigning...' : 'Assign Numbers'
			});

			if (this.formData.numberingSystem === 'none' || !this.formData.rootPersonCrId || this.formData.isAssigningNumbers) {
				assignBtn.disabled = true;
				assignBtn.addClass('crc-btn--disabled');
			}

			assignBtn.addEventListener('click', () => {
				void this.assignReferenceNumbers();
			});
		} else if (this.currentStep === 6) {
			// Step 6 (Complete): Show Done and Import Another buttons
			const importAnotherBtn = rightBtns.createEl('button', {
				cls: 'crc-btn crc-btn--secondary',
				text: 'Import Another'
			});
			importAnotherBtn.addEventListener('click', () => {
				this.formData = this.getDefaultFormData();
				this.currentStep = 0;
				this.renderCurrentStep();
			});

			const doneBtn = rightBtns.createEl('button', {
				cls: 'crc-btn crc-btn--primary',
				text: 'Done'
			});
			doneBtn.addEventListener('click', () => this.close());
		}
	}

	/**
	 * Check if we can proceed to the next step
	 */
	private canProceedToNextStep(): boolean {
		switch (this.currentStep) {
			case 0:
				// Step 1: Format - always can proceed
				return true;
			case 1:
				// Step 2: File - need file selected
				return this.formData.file !== null;
			case 2:
				// Step 3: Options - always can proceed
				return true;
			default:
				return true;
		}
	}

	/**
	 * Render a toggle option
	 */
	private renderToggleOption(
		container: HTMLElement,
		label: string,
		description: string,
		value: boolean,
		onChange: (value: boolean) => void
	): void {
		const row = container.createDiv({ cls: 'crc-import-toggle-row' });

		const labelEl = row.createDiv({ cls: 'crc-import-toggle-label' });
		labelEl.createSpan({ text: label });
		labelEl.createEl('small', { text: description });

		const toggle = row.createDiv({ cls: 'crc-import-toggle' });
		if (value) {
			toggle.addClass('crc-import-toggle--on');
		}

		toggle.addEventListener('click', () => {
			// Check current state from the DOM class, not the captured initial value
			const isCurrentlyOn = toggle.hasClass('crc-import-toggle--on');
			toggle.toggleClass('crc-import-toggle--on', !isCurrentlyOn);
			onChange(!isCurrentlyOn);
		});
	}

	/**
	 * Format file size for display
	 */
	private formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} bytes`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	/**
	 * Get numbering system display name
	 */
	private getNumberingSystemName(): string {
		switch (this.formData.numberingSystem) {
			case 'ahnentafel': return 'Ahnentafel';
			case 'daboville': return "d'Aboville";
			case 'henry': return 'Henry';
			case 'generation': return 'Generation';
			default: return '';
		}
	}

	/**
	 * Check if the import was to the staging folder
	 */
	private isImportedToStaging(): boolean {
		const stagingFolder = this.plugin.settings.stagingFolder;
		if (!stagingFolder || !this.plugin.settings.enableStagingIsolation) {
			return false;
		}

		const targetFolder = this.formData.targetFolder.toLowerCase().replace(/^\/|\/$/g, '');
		const normalizedStaging = stagingFolder.toLowerCase().replace(/^\/|\/$/g, '');

		// Check if target is the staging folder or a subfolder of it
		return targetFolder === normalizedStaging || targetFolder.startsWith(normalizedStaging + '/');
	}

	/**
	 * Get imported place count from result (handles both GEDCOM and Gramps result types)
	 */
	private getImportedPlaceCount(): number {
		const result = this.formData.importResult;
		if (!result) return 0;

		// GEDCOM result uses 'placesCreated', Gramps uses 'placeNotesCreated'
		if ('placesCreated' in result) {
			return result.placesCreated;
		}
		if ('placeNotesCreated' in result) {
			return result.placeNotesCreated ?? 0;
		}
		return 0;
	}

	/**
	 * Get imported source count from result (handles both GEDCOM and Gramps result types)
	 */
	private getImportedSourceCount(): number {
		const result = this.formData.importResult;
		if (!result) return 0;

		// GEDCOM result uses 'sourcesCreated', Gramps uses 'sourceNotesCreated'
		if ('sourcesCreated' in result) {
			return result.sourcesCreated;
		}
		if ('sourceNotesCreated' in result) {
			return result.sourceNotesCreated ?? 0;
		}
		return 0;
	}

	/**
	 * Get imported event count from result (handles both GEDCOM and Gramps result types)
	 */
	private getImportedEventCount(): number {
		const result = this.formData.importResult;
		if (!result) return 0;

		// GEDCOM result uses 'eventsCreated', Gramps uses 'eventNotesCreated'
		if ('eventsCreated' in result) {
			return result.eventsCreated;
		}
		if ('eventNotesCreated' in result) {
			return result.eventNotesCreated ?? 0;
		}
		return 0;
	}
}
