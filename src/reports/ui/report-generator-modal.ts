/**
 * Report Generator Modal
 *
 * Modal for configuring and generating genealogy reports.
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type {
	ReportType,
	FamilyGroupSheetOptions,
	IndividualSummaryOptions,
	AhnentafelOptions,
	GapsReportOptions,
	RegisterReportOptions,
	PedigreeChartOptions,
	DescendantChartOptions,
	SourceSummaryOptions,
	TimelineReportOptions,
	PlaceSummaryOptions,
	MediaInventoryOptions,
	UniverseOverviewOptions,
	CollectionOverviewOptions,
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
import { REPORT_METADATA, REPORT_CATEGORY_METADATA, getReportsByCategory } from '../types/report-types';
import type { ReportCategory } from '../types/report-types';
import { ReportGenerationService } from '../services/report-generation-service';
import { PdfReportRenderer } from '../services/pdf-report-renderer';
import { PersonPickerModal, PersonInfo } from '../../ui/person-picker';
import { PlacePickerModal, SelectedPlaceInfo } from '../../ui/place-picker';
import { FolderFilterService } from '../../core/folder-filter';
import { createLucideIcon } from '../../ui/lucide-icons';
import { UnifiedTreeWizardModal } from '../../trees/ui/unified-tree-wizard-modal';
import type { VisualTreeChartType } from '../../trees/types/visual-tree-types';

/**
 * Options for opening the report generator modal
 */
export interface ReportGeneratorModalOptions {
	/** Pre-selected report type */
	reportType?: ReportType;
	/** Pre-selected person CR ID (for person-based reports) */
	personCrId?: string;
	/** Pre-selected person name */
	personName?: string;
}

/**
 * Modal for generating reports
 */
export class ReportGeneratorModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private options: ReportGeneratorModalOptions;
	private reportService: ReportGenerationService;
	private pdfRenderer: PdfReportRenderer;

	// Form state
	private selectedCategory: ReportCategory | 'all' = 'all';
	private selectedReportType: ReportType = 'family-group-sheet';
	private selectedPersonCrId: string = '';
	private selectedPersonName: string = '';
	private outputMethod: 'vault' | 'download' | 'pdf' = 'vault';
	private outputFolder: string;

	// UI element references for dynamic updates
	private reportTypeDropdown: HTMLSelectElement | null = null;

	// Report-specific options
	private familyGroupOptions = {
		includeChildren: true,
		includeSpouseDetails: true,
		includeEvents: true,
		includeSources: true
	};

	private individualSummaryOptions = {
		includeEvents: true,
		includeFamily: true,
		includeAttributes: true,
		includeSources: true
	};

	private ahnentafelOptions = {
		maxGenerations: 5,
		includeDetails: true,
		includeSources: true
	};

	private gapsReportOptions = {
		scope: 'all' as 'all' | 'collection',
		collectionPath: '',
		fieldsToCheck: {
			birthDate: true,
			deathDate: true,
			parents: true,
			sources: true
		},
		maxItemsPerCategory: 50,
		includeSources: false
	};

	private registerReportOptions = {
		maxGenerations: 5,
		includeDetails: true,
		includeSpouses: true,
		includeSources: true
	};

	private pedigreeChartOptions = {
		maxGenerations: 5,
		includeDetails: true,
		includeSources: true
	};

	private descendantChartOptions = {
		maxGenerations: 5,
		includeDetails: true,
		includeSpouses: true,
		includeSources: true
	};

	// Extended report type options
	private sourceSummaryOptions = {
		includeChildrenSources: false,
		groupBy: 'fact_type' as 'fact_type' | 'source_type' | 'quality' | 'chronological',
		showQualityRatings: true,
		includeCitationDetails: true,
		showRepositoryInfo: true,
		highlightGaps: true,
		includeSources: true
	};

	private timelineReportOptions = {
		dateFrom: '',
		dateTo: '',
		eventTypes: [] as string[],
		personFilter: [] as string[],
		placeFilter: [] as string[],
		includeChildPlaces: false,
		grouping: 'none' as 'none' | 'by_year' | 'by_decade' | 'by_person' | 'by_place',
		includeDescriptions: true,
		includeSources: true
	};

	private placeSummaryOptions = {
		includeChildPlaces: true,
		dateFrom: '',
		dateTo: '',
		eventTypes: [] as string[],
		showCoordinates: true,
		showHierarchy: true,
		includeMapReference: false,
		includeSources: true
	};

	private mediaInventoryOptions = {
		scope: 'all' as 'all' | 'sources_only' | 'by_folder',
		folderPath: '',
		showOrphanedFiles: true,
		showCoverageGaps: true,
		groupBy: 'entity_type' as 'entity_type' | 'folder' | 'file_type',
		includeFileSizes: true,
		includeSources: false
	};

	private universeOverviewOptions = {
		includeEntityList: true,
		showGeographicSummary: true,
		showDateSystems: true,
		showRecentActivity: true,
		maxEntitiesPerType: 20,
		includeSources: false
	};

	private collectionOverviewOptions = {
		collectionType: 'component' as 'user' | 'component',
		includeMemberList: true,
		showGenerationAnalysis: true,
		showGeographicDistribution: true,
		showSurnameDistribution: true,
		sortMembersBy: 'birth_date' as 'birth_date' | 'name' | 'death_date',
		maxMembers: 100,
		includeSources: false
	};

	// Additional entity selection for new report types
	private selectedPlaceCrId: string = '';
	private selectedPlaceName: string = '';
	private selectedUniverseCrId: string = '';
	private selectedUniverseName: string = '';
	private selectedCollectionId: string = '';
	private selectedCollectionName: string = '';

	// PDF-specific options
	private pdfOptions = {
		pageSize: 'A4' as 'A4' | 'LETTER',
		dateFormat: 'mdy' as 'mdy' | 'dmy' | 'ymd',
		includeCoverPage: false,
		logoDataUrl: undefined as string | undefined,
		customTitle: '',
		customTitleScope: 'both' as 'cover' | 'headers' | 'both',
		customSubtitle: '',
		coverNotes: ''
	};

	// UI elements
	private optionsContainer: HTMLElement | null = null;
	private personPickerSetting: Setting | null = null;
	private outputFolderSetting: Setting | null = null;
	private privacyMessageEl: HTMLElement | null = null;
	private pdfOptionsContainer: HTMLElement | null = null;

	constructor(app: App, plugin: CanvasRootsPlugin, options: ReportGeneratorModalOptions = {}) {
		super(app);
		this.plugin = plugin;
		this.options = options;
		this.reportService = new ReportGenerationService(app, plugin.settings);
		this.pdfRenderer = new PdfReportRenderer();

		// Initialize output folder from settings
		this.outputFolder = plugin.settings.reportsFolder || '';

		// Apply pre-selected options
		if (options.reportType) {
			this.selectedReportType = options.reportType;
			// Set category to match the pre-selected report type
			const metadata = REPORT_METADATA[options.reportType];
			if (metadata) {
				this.selectedCategory = metadata.category;
			}
		}
		if (options.personCrId) {
			this.selectedPersonCrId = options.personCrId;
		}
		if (options.personName) {
			this.selectedPersonName = options.personName;
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-report-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'cr-report-modal__header' });
		const icon = createLucideIcon('file-text', 24);
		header.appendChild(icon);
		header.createEl('h2', { text: 'Generate report' });

		// Category filter
		new Setting(contentEl)
			.setName('Category')
			.setDesc('Filter reports by category')
			.addDropdown(dropdown => {
				dropdown.addOption('all', 'All categories');
				for (const [category, metadata] of Object.entries(REPORT_CATEGORY_METADATA)) {
					dropdown.addOption(category, metadata.name);
				}
				dropdown.setValue(this.selectedCategory);
				dropdown.onChange(value => {
					this.selectedCategory = value as ReportCategory | 'all';
					this.updateReportTypeOptions();
				});
			});

		// Report type selector
		new Setting(contentEl)
			.setName('Report type')
			.setDesc('Select the type of report to generate')
			.addDropdown(dropdown => {
				this.reportTypeDropdown = dropdown.selectEl;
				this.populateReportTypes(dropdown.selectEl);
				dropdown.setValue(this.selectedReportType);
				dropdown.onChange(value => {
					this.selectedReportType = value as ReportType;
					this.renderReportOptions();
				});
			});

		// Options container (dynamic based on report type)
		this.optionsContainer = contentEl.createDiv({ cls: 'cr-report-modal__options' });
		this.renderReportOptions();

		// Output section
		const outputSection = contentEl.createDiv({ cls: 'cr-report-modal__output' });
		outputSection.createEl('h3', { text: 'Output' });

		new Setting(outputSection)
			.setName('Output method')
			.addDropdown(dropdown => {
				dropdown.addOption('vault', 'Save to vault');
				dropdown.addOption('pdf', 'Download as PDF');
				dropdown.addOption('download', 'Download as MD');
				dropdown.setValue(this.outputMethod);
				dropdown.onChange(value => {
					this.outputMethod = value as 'vault' | 'download' | 'pdf';
					this.updateOutputVisibility();
				});
			});

		// Privacy message for download options
		this.privacyMessageEl = outputSection.createDiv({ cls: 'cr-report-modal__privacy-message' });
		this.privacyMessageEl.createSpan({ text: 'ⓘ ' });
		const messageText = this.privacyMessageEl.createSpan();
		messageText.setText(
			this.outputMethod === 'pdf'
				? 'PDF is generated locally on your device. No internet connection required. Downloads to your system\'s Downloads folder.'
				: 'File is generated locally on your device. No internet connection required. Downloads to your system\'s Downloads folder.'
		);

		// PDF-specific options (shown only when PDF output is selected)
		this.pdfOptionsContainer = outputSection.createDiv({ cls: 'cr-report-modal__pdf-options' });
		this.renderPdfOptions();

		this.outputFolderSetting = new Setting(outputSection)
			.setName('Output folder')
			.setDesc('Folder to save report (configured in Preferences → Folder locations)')
			.addText(text => {
				text.setPlaceholder('Canvas Roots/Reports')
					.setValue(this.outputFolder)
					.onChange(value => {
						this.outputFolder = value;
					});
			});

		// Set initial visibility
		this.updateOutputVisibility();

		// Actions
		const actionsContainer = contentEl.createDiv({ cls: 'cr-report-modal__actions' });

		const cancelBtn = actionsContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const generateBtn = actionsContainer.createEl('button', {
			text: 'Generate report',
			cls: 'mod-cta'
		});
		generateBtn.addEventListener('click', () => void this.generateReport());
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Populate the report type dropdown based on selected category
	 */
	private populateReportTypes(selectEl: HTMLSelectElement): void {
		selectEl.empty();

		const reports = this.selectedCategory === 'all'
			? Object.entries(REPORT_METADATA)
			: getReportsByCategory(this.selectedCategory).map(r => [r.type, r] as const);

		for (const [type, metadata] of reports) {
			const option = selectEl.createEl('option', {
				value: type,
				text: metadata.name
			});
			selectEl.appendChild(option);
		}
	}

	/**
	 * Update report type options when category changes
	 */
	private updateReportTypeOptions(): void {
		if (!this.reportTypeDropdown) return;

		this.populateReportTypes(this.reportTypeDropdown);

		// Select first report in the filtered list
		const firstOption = this.reportTypeDropdown.options[0];
		if (firstOption) {
			this.selectedReportType = firstOption.value as ReportType;
			this.reportTypeDropdown.value = this.selectedReportType;
		}

		this.renderReportOptions();
	}

	/**
	 * Update visibility of output-related UI elements based on output method
	 */
	private updateOutputVisibility(): void {
		const isDownload = this.outputMethod === 'download' || this.outputMethod === 'pdf';
		const isPdf = this.outputMethod === 'pdf';

		// Show/hide privacy message
		if (this.privacyMessageEl) {
			this.privacyMessageEl.style.display = isDownload ? 'block' : 'none';

			// Update message text based on PDF vs MD
			const messageSpan = this.privacyMessageEl.querySelector('span:last-child');
			if (messageSpan) {
				messageSpan.textContent = isPdf
					? 'PDF is generated locally on your device. No internet connection required. Downloads to your system\'s Downloads folder.'
					: 'File is generated locally on your device. No internet connection required. Downloads to your system\'s Downloads folder.';
			}
		}

		// Show/hide PDF options (only for PDF output)
		if (this.pdfOptionsContainer) {
			this.pdfOptionsContainer.style.display = isPdf ? 'block' : 'none';
		}

		// Show/hide output folder setting
		if (this.outputFolderSetting) {
			this.outputFolderSetting.settingEl.style.display = isDownload ? 'none' : '';
		}
	}

	// Reference to title scope dropdown for dynamic updates
	private titleScopeDropdown: HTMLSelectElement | null = null;

	/**
	 * Render PDF-specific options
	 */
	private renderPdfOptions(): void {
		if (!this.pdfOptionsContainer) return;
		this.pdfOptionsContainer.empty();

		// Page size
		new Setting(this.pdfOptionsContainer)
			.setName('Page size')
			.addDropdown(dropdown => {
				dropdown.addOption('A4', 'A4');
				dropdown.addOption('LETTER', 'Letter');
				dropdown.setValue(this.pdfOptions.pageSize);
				dropdown.onChange(value => {
					this.pdfOptions.pageSize = value as 'A4' | 'LETTER';
				});
			});

		// Date format - show example dates for clarity
		const exampleDate = new Date();
		const day = exampleDate.getDate();
		const month = exampleDate.getMonth() + 1;
		const year = exampleDate.getFullYear();
		const mdyExample = `${month}/${day}/${year}`;
		const dmyExample = `${day}/${month}/${year}`;
		const ymdExample = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

		new Setting(this.pdfOptionsContainer)
			.setName('Date format')
			.setDesc('Format for generated date display')
			.addDropdown(dropdown => {
				dropdown.addOption('mdy', `${mdyExample} (US)`);
				dropdown.addOption('dmy', `${dmyExample} (UK/EU)`);
				dropdown.addOption('ymd', `${ymdExample} (ISO)`);
				dropdown.setValue(this.pdfOptions.dateFormat);
				dropdown.onChange(value => {
					this.pdfOptions.dateFormat = value as 'mdy' | 'dmy' | 'ymd';
				});
			});

		// Custom title (always visible - affects headers even without cover page)
		new Setting(this.pdfOptionsContainer)
			.setName('Custom title')
			.setDesc('Override the default report title')
			.addText(text => {
				text.setPlaceholder('Leave blank for default')
					.setValue(this.pdfOptions.customTitle)
					.onChange(value => {
						this.pdfOptions.customTitle = value;
					});
			});

		// Title scope (always visible - controls where custom title appears)
		// Options change based on whether cover page is enabled
		new Setting(this.pdfOptionsContainer)
			.setName('Apply custom title to')
			.setDesc('Choose where the custom title appears')
			.addDropdown(dropdown => {
				this.titleScopeDropdown = dropdown.selectEl;
				this.updateTitleScopeOptions();
				dropdown.onChange(value => {
					this.pdfOptions.customTitleScope = value as 'cover' | 'headers' | 'both';
				});
			});

		// Cover page toggle
		new Setting(this.pdfOptionsContainer)
			.setName('Include cover page')
			.setDesc('Add a title page with report name and generation date')
			.addToggle(toggle => {
				toggle.setValue(this.pdfOptions.includeCoverPage);
				toggle.onChange(value => {
					this.pdfOptions.includeCoverPage = value;
					this.updateTitleScopeOptions();
					this.updateCoverPageFieldsVisibility();
				});
			});

		// Logo/crest (only shown when cover page is enabled)
		this.renderLogoSetting();

		// Cover page-only customization fields (subtitle, notes)
		this.renderCoverPageFields();
	}

	/**
	 * Update the title scope dropdown options based on cover page state
	 */
	private updateTitleScopeOptions(): void {
		if (!this.titleScopeDropdown) return;

		const currentValue = this.pdfOptions.customTitleScope;
		this.titleScopeDropdown.empty();

		if (this.pdfOptions.includeCoverPage) {
			// Cover page enabled: show all options
			this.titleScopeDropdown.createEl('option', { value: 'both', text: 'Cover and headers' });
			this.titleScopeDropdown.createEl('option', { value: 'cover', text: 'Cover page only' });
			this.titleScopeDropdown.createEl('option', { value: 'headers', text: 'Page headers only' });
			// Preserve current value if valid
			this.titleScopeDropdown.value = currentValue;
		} else {
			// Cover page disabled: only headers option makes sense
			this.titleScopeDropdown.createEl('option', { value: 'headers', text: 'Page headers' });
			// Force to headers since cover options don't apply
			this.pdfOptions.customTitleScope = 'headers';
			this.titleScopeDropdown.value = 'headers';
		}
	}

	/**
	 * Render logo picker setting (shown only when cover page is enabled)
	 */
	private renderLogoSetting(): void {
		if (!this.pdfOptionsContainer) return;

		// Create container for logo setting
		const logoContainer = this.pdfOptionsContainer.createDiv({ cls: 'cr-report-modal__logo-setting' });

		const logoSetting = new Setting(logoContainer)
			.setName('Logo or crest')
			.setDesc(this.pdfOptions.logoDataUrl ? 'Image selected' : 'Optional image to display on cover page');

		// Add file input button
		logoSetting.addButton(button => {
			button
				.setButtonText(this.pdfOptions.logoDataUrl ? 'Change...' : 'Select image...')
				.onClick(() => {
					const input = document.createElement('input');
					input.type = 'file';
					input.accept = 'image/png,image/jpeg,image/gif,image/webp';
					input.onchange = async () => {
						const file = input.files?.[0];
						if (file) {
							try {
								const dataUrl = await this.fileToDataUrl(file);
								this.pdfOptions.logoDataUrl = dataUrl;
								button.setButtonText('Change...');
								logoSetting.setDesc('Image selected');
								// Add remove button if not already present
								this.renderPdfOptions();
							} catch (error) {
								new Notice('Failed to load image');
								console.error('Logo load error:', error);
							}
						}
					};
					input.click();
				});
		});

		// Add remove button if logo is selected
		if (this.pdfOptions.logoDataUrl) {
			logoSetting.addButton(button => {
				button
					.setButtonText('Remove')
					.onClick(() => {
						this.pdfOptions.logoDataUrl = undefined;
						this.renderPdfOptions();
					});
			});
		}

		// Set initial visibility
		logoContainer.style.display = this.pdfOptions.includeCoverPage ? '' : 'none';
	}

	/**
	 * Render cover page customization fields (shown only when cover page is enabled)
	 */
	private renderCoverPageFields(): void {
		if (!this.pdfOptionsContainer) return;

		// Create container for cover page-only customization
		const coverFieldsContainer = this.pdfOptionsContainer.createDiv({ cls: 'cr-report-modal__cover-fields' });

		// Custom subtitle (cover page only)
		new Setting(coverFieldsContainer)
			.setName('Custom subtitle')
			.setDesc('Override the auto-generated subject line')
			.addText(text => {
				text.setPlaceholder('Leave blank for default')
					.setValue(this.pdfOptions.customSubtitle)
					.onChange(value => {
						this.pdfOptions.customSubtitle = value;
					});
			});

		// Cover notes (textarea)
		const notesSetting = new Setting(coverFieldsContainer)
			.setName('Cover notes')
			.setDesc('Additional preface or dedication text (supports multiple paragraphs)');

		// Create textarea manually since Setting doesn't have addTextArea
		const notesTextarea = notesSetting.controlEl.createEl('textarea', {
			cls: 'cr-report-modal__cover-notes-textarea',
			attr: {
				placeholder: 'Optional dedication, preface, or notes...',
				rows: '3'
			}
		});
		notesTextarea.value = this.pdfOptions.coverNotes;
		notesTextarea.addEventListener('input', () => {
			this.pdfOptions.coverNotes = notesTextarea.value;
		});

		// Set initial visibility
		coverFieldsContainer.style.display = this.pdfOptions.includeCoverPage ? '' : 'none';
	}

	/**
	 * Update cover page options visibility based on cover page toggle
	 */
	private updateCoverPageFieldsVisibility(): void {
		const logoContainer = this.pdfOptionsContainer?.querySelector('.cr-report-modal__logo-setting') as HTMLElement | null;
		if (logoContainer) {
			logoContainer.style.display = this.pdfOptions.includeCoverPage ? '' : 'none';
		}

		const coverFieldsContainer = this.pdfOptionsContainer?.querySelector('.cr-report-modal__cover-fields') as HTMLElement | null;
		if (coverFieldsContainer) {
			coverFieldsContainer.style.display = this.pdfOptions.includeCoverPage ? '' : 'none';
		}
	}

	/**
	 * Convert a File to a resized data URL
	 * Resizes image to max 200px width to reduce PDF file size
	 */
	private fileToDataUrl(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			const reader = new FileReader();

			reader.onload = () => {
				if (typeof reader.result !== 'string') {
					reject(new Error('Failed to read file'));
					return;
				}
				img.src = reader.result;
			};

			img.onload = () => {
				// Max width for logo in PDF (renders at 100pt, use 200px for retina quality)
				const maxWidth = 200;
				const maxHeight = 200;

				let { width, height } = img;

				// Only resize if larger than max dimensions
				if (width > maxWidth || height > maxHeight) {
					const ratio = Math.min(maxWidth / width, maxHeight / height);
					width = Math.round(width * ratio);
					height = Math.round(height * ratio);
				}

				// Draw to canvas at new size
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					reject(new Error('Failed to get canvas context'));
					return;
				}
				ctx.drawImage(img, 0, 0, width, height);

				// Convert to data URL (use PNG for transparency support)
				const dataUrl = canvas.toDataURL('image/png');
				resolve(dataUrl);
			};

			img.onerror = () => reject(new Error('Failed to load image'));
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(file);
		});
	}

	/**
	 * Render report-specific options based on selected type
	 */
	private renderReportOptions(): void {
		if (!this.optionsContainer) return;
		this.optionsContainer.empty();

		const metadata = REPORT_METADATA[this.selectedReportType];

		// Description
		const descDiv = this.optionsContainer.createDiv({ cls: 'cr-report-modal__desc' });
		descDiv.createSpan({ text: metadata.description });

		// Person picker (for reports that require a person)
		if (metadata.requiresPerson) {
			this.renderPersonPicker();
		}

		// Type-specific options
		switch (this.selectedReportType) {
			case 'family-group-sheet':
				this.renderFamilyGroupSheetOptions();
				break;
			case 'individual-summary':
				this.renderIndividualSummaryOptions();
				break;
			case 'ahnentafel':
				this.renderAhnentafelOptions();
				break;
			case 'gaps-report':
				this.renderGapsReportOptions();
				break;
			case 'register-report':
				this.renderRegisterReportOptions();
				break;
			case 'pedigree-chart':
				this.renderPedigreeChartOptions();
				break;
			case 'descendant-chart':
				this.renderDescendantChartOptions();
				break;
			case 'source-summary':
				this.renderSourceSummaryOptions();
				break;
			case 'timeline-report':
				this.renderTimelineReportOptions();
				break;
			case 'place-summary':
				this.renderPlaceSummaryOptions();
				break;
			case 'media-inventory':
				this.renderMediaInventoryOptions();
				break;
			case 'universe-overview':
				this.renderUniverseOverviewOptions();
				break;
			case 'collection-overview':
				this.renderCollectionOverviewOptions();
				break;
		}
	}

	/**
	 * Render person picker for person-based reports
	 */
	private renderPersonPicker(): void {
		if (!this.optionsContainer) return;

		const personContainer = this.optionsContainer.createDiv({ cls: 'cr-report-modal__person' });

		this.personPickerSetting = new Setting(personContainer)
			.setName('Select person')
			.setDesc(this.selectedPersonName || 'Click to select a person')
			.addButton(button => {
				button
					.setButtonText(this.selectedPersonName || 'Select...')
					.onClick(() => {
						const folderFilter = this.plugin.settings.folderFilterMode !== 'disabled'
							? new FolderFilterService(this.plugin.settings)
							: undefined;

						const picker = new PersonPickerModal(
							this.app,
							(person: PersonInfo) => {
								this.selectedPersonCrId = person.crId;
								this.selectedPersonName = person.name;
								button.setButtonText(person.name);
								if (this.personPickerSetting) {
									this.personPickerSetting.setDesc(`Selected: ${person.name}`);
								}
							},
							folderFilter
						);
						picker.open();
					});
			});
	}

	/**
	 * Render Family Group Sheet options
	 */
	private renderFamilyGroupSheetOptions(): void {
		if (!this.optionsContainer) return;

		new Setting(this.optionsContainer)
			.setName('Include children')
			.addToggle(toggle => {
				toggle.setValue(this.familyGroupOptions.includeChildren)
					.onChange(value => {
						this.familyGroupOptions.includeChildren = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Include events')
			.setDesc('Include marriage and other family events')
			.addToggle(toggle => {
				toggle.setValue(this.familyGroupOptions.includeEvents)
					.onChange(value => {
						this.familyGroupOptions.includeEvents = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Include sources')
			.addToggle(toggle => {
				toggle.setValue(this.familyGroupOptions.includeSources)
					.onChange(value => {
						this.familyGroupOptions.includeSources = value;
					});
			});
	}

	/**
	 * Render Individual Summary options
	 */
	private renderIndividualSummaryOptions(): void {
		if (!this.optionsContainer) return;

		new Setting(this.optionsContainer)
			.setName('Include events')
			.setDesc('Include life events timeline')
			.addToggle(toggle => {
				toggle.setValue(this.individualSummaryOptions.includeEvents)
					.onChange(value => {
						this.individualSummaryOptions.includeEvents = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Include family')
			.setDesc('Include parents, spouses, and children')
			.addToggle(toggle => {
				toggle.setValue(this.individualSummaryOptions.includeFamily)
					.onChange(value => {
						this.individualSummaryOptions.includeFamily = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Include attributes')
			.setDesc('Include occupation and other attributes')
			.addToggle(toggle => {
				toggle.setValue(this.individualSummaryOptions.includeAttributes)
					.onChange(value => {
						this.individualSummaryOptions.includeAttributes = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Include sources')
			.addToggle(toggle => {
				toggle.setValue(this.individualSummaryOptions.includeSources)
					.onChange(value => {
						this.individualSummaryOptions.includeSources = value;
					});
			});
	}

	/**
	 * Render Ahnentafel options
	 */
	private renderAhnentafelOptions(): void {
		if (!this.optionsContainer) return;

		new Setting(this.optionsContainer)
			.setName('Maximum generations')
			.setDesc('How many generations to trace back')
			.addSlider(slider => {
				slider
					.setLimits(2, 10, 1)
					.setValue(this.ahnentafelOptions.maxGenerations)
					.setDynamicTooltip()
					.onChange(value => {
						this.ahnentafelOptions.maxGenerations = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Include details')
			.setDesc('Include birth/death dates and places')
			.addToggle(toggle => {
				toggle.setValue(this.ahnentafelOptions.includeDetails)
					.onChange(value => {
						this.ahnentafelOptions.includeDetails = value;
					});
			});
	}

	/**
	 * Render Gaps Report options
	 */
	private renderGapsReportOptions(): void {
		if (!this.optionsContainer) return;

		new Setting(this.optionsContainer)
			.setName('Scope')
			.addDropdown(dropdown => {
				dropdown.addOption('all', 'All people');
				dropdown.addOption('collection', 'Specific folder');
				dropdown.setValue(this.gapsReportOptions.scope);
				dropdown.onChange(value => {
					this.gapsReportOptions.scope = value as 'all' | 'collection';
				});
			});

		new Setting(this.optionsContainer)
			.setName('Check missing birth dates')
			.addToggle(toggle => {
				toggle.setValue(this.gapsReportOptions.fieldsToCheck.birthDate)
					.onChange(value => {
						this.gapsReportOptions.fieldsToCheck.birthDate = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Check missing death dates')
			.addToggle(toggle => {
				toggle.setValue(this.gapsReportOptions.fieldsToCheck.deathDate)
					.onChange(value => {
						this.gapsReportOptions.fieldsToCheck.deathDate = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Check missing parents')
			.addToggle(toggle => {
				toggle.setValue(this.gapsReportOptions.fieldsToCheck.parents)
					.onChange(value => {
						this.gapsReportOptions.fieldsToCheck.parents = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Check unsourced people')
			.addToggle(toggle => {
				toggle.setValue(this.gapsReportOptions.fieldsToCheck.sources)
					.onChange(value => {
						this.gapsReportOptions.fieldsToCheck.sources = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Max items per category')
			.addSlider(slider => {
				slider
					.setLimits(10, 200, 10)
					.setValue(this.gapsReportOptions.maxItemsPerCategory)
					.setDynamicTooltip()
					.onChange(value => {
						this.gapsReportOptions.maxItemsPerCategory = value;
					});
			});
	}

	/**
	 * Render Register Report options
	 */
	private renderRegisterReportOptions(): void {
		if (!this.optionsContainer) return;

		new Setting(this.optionsContainer)
			.setName('Maximum generations')
			.setDesc('How many generations of descendants to include')
			.addSlider(slider => {
				slider
					.setLimits(2, 10, 1)
					.setValue(this.registerReportOptions.maxGenerations)
					.setDynamicTooltip()
					.onChange(value => {
						this.registerReportOptions.maxGenerations = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Include details')
			.setDesc('Include birth/death dates and places')
			.addToggle(toggle => {
				toggle.setValue(this.registerReportOptions.includeDetails)
					.onChange(value => {
						this.registerReportOptions.includeDetails = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Include spouses')
			.setDesc('Include spouse information for each person')
			.addToggle(toggle => {
				toggle.setValue(this.registerReportOptions.includeSpouses)
					.onChange(value => {
						this.registerReportOptions.includeSpouses = value;
					});
			});
	}

	/**
	 * Render Pedigree Chart options
	 */
	private renderPedigreeChartOptions(): void {
		if (!this.optionsContainer) return;

		new Setting(this.optionsContainer)
			.setName('Maximum generations')
			.setDesc('How many generations of ancestors to include')
			.addSlider(slider => {
				slider
					.setLimits(2, 10, 1)
					.setValue(this.pedigreeChartOptions.maxGenerations)
					.setDynamicTooltip()
					.onChange(value => {
						this.pedigreeChartOptions.maxGenerations = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Include details')
			.setDesc('Include birth/death dates and places')
			.addToggle(toggle => {
				toggle.setValue(this.pedigreeChartOptions.includeDetails)
					.onChange(value => {
						this.pedigreeChartOptions.includeDetails = value;
					});
			});
	}

	/**
	 * Render Descendant Chart options
	 */
	private renderDescendantChartOptions(): void {
		if (!this.optionsContainer) return;

		new Setting(this.optionsContainer)
			.setName('Maximum generations')
			.setDesc('How many generations of descendants to include')
			.addSlider(slider => {
				slider
					.setLimits(2, 10, 1)
					.setValue(this.descendantChartOptions.maxGenerations)
					.setDynamicTooltip()
					.onChange(value => {
						this.descendantChartOptions.maxGenerations = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Include details')
			.setDesc('Include birth/death dates and places')
			.addToggle(toggle => {
				toggle.setValue(this.descendantChartOptions.includeDetails)
					.onChange(value => {
						this.descendantChartOptions.includeDetails = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Include spouses')
			.setDesc('Include spouse information for each person')
			.addToggle(toggle => {
				toggle.setValue(this.descendantChartOptions.includeSpouses)
					.onChange(value => {
						this.descendantChartOptions.includeSpouses = value;
					});
			});
	}

	/**
	 * Render Source Summary options
	 */
	private renderSourceSummaryOptions(): void {
		if (!this.optionsContainer) return;

		new Setting(this.optionsContainer)
			.setName('Include children\'s sources')
			.setDesc('Include sources from children\'s records')
			.addToggle(toggle => {
				toggle.setValue(this.sourceSummaryOptions.includeChildrenSources)
					.onChange(value => {
						this.sourceSummaryOptions.includeChildrenSources = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Show quality ratings')
			.setDesc('Display primary/secondary/derivative classification')
			.addToggle(toggle => {
				toggle.setValue(this.sourceSummaryOptions.showQualityRatings)
					.onChange(value => {
						this.sourceSummaryOptions.showQualityRatings = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Highlight research gaps')
			.setDesc('Show unsourced facts as research opportunities')
			.addToggle(toggle => {
				toggle.setValue(this.sourceSummaryOptions.highlightGaps)
					.onChange(value => {
						this.sourceSummaryOptions.highlightGaps = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Show repository info')
			.setDesc('Include repository summary')
			.addToggle(toggle => {
				toggle.setValue(this.sourceSummaryOptions.showRepositoryInfo)
					.onChange(value => {
						this.sourceSummaryOptions.showRepositoryInfo = value;
					});
			});
	}

	/**
	 * Render Timeline Report options
	 */
	private renderTimelineReportOptions(): void {
		if (!this.optionsContainer) return;

		new Setting(this.optionsContainer)
			.setName('Grouping')
			.setDesc('How to group events in the report')
			.addDropdown(dropdown => {
				dropdown.addOption('none', 'No grouping (chronological)');
				dropdown.addOption('by_year', 'By year');
				dropdown.addOption('by_decade', 'By decade');
				dropdown.addOption('by_person', 'By person');
				dropdown.addOption('by_place', 'By place');
				dropdown.setValue(this.timelineReportOptions.grouping);
				dropdown.onChange(value => {
					this.timelineReportOptions.grouping = value as typeof this.timelineReportOptions.grouping;
				});
			});

		new Setting(this.optionsContainer)
			.setName('Include descriptions')
			.setDesc('Include event descriptions in the report')
			.addToggle(toggle => {
				toggle.setValue(this.timelineReportOptions.includeDescriptions)
					.onChange(value => {
						this.timelineReportOptions.includeDescriptions = value;
					});
			});
	}

	/**
	 * Render Place Summary options
	 */
	private renderPlaceSummaryOptions(): void {
		if (!this.optionsContainer) return;

		// Place picker
		this.renderPlacePicker();

		new Setting(this.optionsContainer)
			.setName('Include child places')
			.setDesc('Include events from subordinate locations')
			.addToggle(toggle => {
				toggle.setValue(this.placeSummaryOptions.includeChildPlaces)
					.onChange(value => {
						this.placeSummaryOptions.includeChildPlaces = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Show hierarchy')
			.setDesc('Display place hierarchy path')
			.addToggle(toggle => {
				toggle.setValue(this.placeSummaryOptions.showHierarchy)
					.onChange(value => {
						this.placeSummaryOptions.showHierarchy = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Show coordinates')
			.setDesc('Display geographic coordinates if available')
			.addToggle(toggle => {
				toggle.setValue(this.placeSummaryOptions.showCoordinates)
					.onChange(value => {
						this.placeSummaryOptions.showCoordinates = value;
					});
			});
	}

	/**
	 * Render place picker for place-based reports
	 */
	private renderPlacePicker(): void {
		if (!this.optionsContainer) return;

		const placeContainer = this.optionsContainer.createDiv({ cls: 'cr-report-modal__place' });

		const placeSetting = new Setting(placeContainer)
			.setName('Select place')
			.setDesc(this.selectedPlaceName || 'Click to select a place')
			.addButton(button => {
				button
					.setButtonText(this.selectedPlaceName || 'Select...')
					.onClick(() => {
						const folderFilter = this.plugin.settings.folderFilterMode !== 'disabled'
							? new FolderFilterService(this.plugin.settings)
							: undefined;

						const picker = new PlacePickerModal(
							this.app,
							(place: SelectedPlaceInfo) => {
								this.selectedPlaceCrId = place.crId;
								this.selectedPlaceName = place.name;
								button.setButtonText(place.name);
								placeSetting.setDesc(`Selected: ${place.name}`);
							},
							{ folderFilter }
						);
						picker.open();
					});
			});
	}

	/**
	 * Render Media Inventory options
	 */
	private renderMediaInventoryOptions(): void {
		if (!this.optionsContainer) return;

		new Setting(this.optionsContainer)
			.setName('Scope')
			.setDesc('Which media files to include')
			.addDropdown(dropdown => {
				dropdown.addOption('all', 'All media files');
				dropdown.addOption('sources_only', 'Source-linked only');
				dropdown.addOption('by_folder', 'Specific folder');
				dropdown.setValue(this.mediaInventoryOptions.scope);
				dropdown.onChange(value => {
					this.mediaInventoryOptions.scope = value as typeof this.mediaInventoryOptions.scope;
				});
			});

		new Setting(this.optionsContainer)
			.setName('Group by')
			.setDesc('How to organize the inventory')
			.addDropdown(dropdown => {
				dropdown.addOption('entity_type', 'Entity type');
				dropdown.addOption('folder', 'Folder');
				dropdown.addOption('file_type', 'File type');
				dropdown.setValue(this.mediaInventoryOptions.groupBy);
				dropdown.onChange(value => {
					this.mediaInventoryOptions.groupBy = value as typeof this.mediaInventoryOptions.groupBy;
				});
			});

		new Setting(this.optionsContainer)
			.setName('Show orphaned files')
			.setDesc('Include files not linked to any entity')
			.addToggle(toggle => {
				toggle.setValue(this.mediaInventoryOptions.showOrphanedFiles)
					.onChange(value => {
						this.mediaInventoryOptions.showOrphanedFiles = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Include file sizes')
			.setDesc('Show file size information')
			.addToggle(toggle => {
				toggle.setValue(this.mediaInventoryOptions.includeFileSizes)
					.onChange(value => {
						this.mediaInventoryOptions.includeFileSizes = value;
					});
			});
	}

	/**
	 * Render Universe Overview options
	 */
	private renderUniverseOverviewOptions(): void {
		if (!this.optionsContainer) return;

		// Universe picker
		this.renderUniversePicker();

		new Setting(this.optionsContainer)
			.setName('Include entity list')
			.setDesc('Show lists of entities by type')
			.addToggle(toggle => {
				toggle.setValue(this.universeOverviewOptions.includeEntityList)
					.onChange(value => {
						this.universeOverviewOptions.includeEntityList = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Show geographic summary')
			.setDesc('Include place coordinate coverage')
			.addToggle(toggle => {
				toggle.setValue(this.universeOverviewOptions.showGeographicSummary)
					.onChange(value => {
						this.universeOverviewOptions.showGeographicSummary = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Show date systems')
			.setDesc('List calendar systems used in this universe')
			.addToggle(toggle => {
				toggle.setValue(this.universeOverviewOptions.showDateSystems)
					.onChange(value => {
						this.universeOverviewOptions.showDateSystems = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Show recent activity')
			.setDesc('List recently modified entities')
			.addToggle(toggle => {
				toggle.setValue(this.universeOverviewOptions.showRecentActivity)
					.onChange(value => {
						this.universeOverviewOptions.showRecentActivity = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Max entities per type')
			.setDesc('Limit for entity lists')
			.addSlider(slider => {
				slider
					.setLimits(5, 50, 5)
					.setValue(this.universeOverviewOptions.maxEntitiesPerType)
					.setDynamicTooltip()
					.onChange(value => {
						this.universeOverviewOptions.maxEntitiesPerType = value;
					});
			});
	}

	/**
	 * Render universe picker
	 */
	private renderUniversePicker(): void {
		if (!this.optionsContainer) return;

		const universeContainer = this.optionsContainer.createDiv({ cls: 'cr-report-modal__universe' });

		new Setting(universeContainer)
			.setName('Select universe')
			.setDesc(this.selectedUniverseName || 'Enter universe name or CR ID')
			.addText(text => {
				text.setPlaceholder('Universe name or CR ID')
					.setValue(this.selectedUniverseName || this.selectedUniverseCrId)
					.onChange(value => {
						this.selectedUniverseCrId = value;
						this.selectedUniverseName = value;
					});
			});
	}

	/**
	 * Render Collection Overview options
	 */
	private renderCollectionOverviewOptions(): void {
		if (!this.optionsContainer) return;

		// Collection picker
		this.renderCollectionPicker();

		new Setting(this.optionsContainer)
			.setName('Collection type')
			.setDesc('Type of collection to analyze')
			.addDropdown(dropdown => {
				dropdown.addOption('component', 'Auto-detected family group');
				dropdown.addOption('user', 'User-defined collection');
				dropdown.setValue(this.collectionOverviewOptions.collectionType);
				dropdown.onChange(value => {
					this.collectionOverviewOptions.collectionType = value as 'user' | 'component';
				});
			});

		new Setting(this.optionsContainer)
			.setName('Include member list')
			.setDesc('Show list of all collection members')
			.addToggle(toggle => {
				toggle.setValue(this.collectionOverviewOptions.includeMemberList)
					.onChange(value => {
						this.collectionOverviewOptions.includeMemberList = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Show generation analysis')
			.setDesc('Analyze generation depth and distribution')
			.addToggle(toggle => {
				toggle.setValue(this.collectionOverviewOptions.showGenerationAnalysis)
					.onChange(value => {
						this.collectionOverviewOptions.showGenerationAnalysis = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Show surname distribution')
			.setDesc('Analyze surname frequency')
			.addToggle(toggle => {
				toggle.setValue(this.collectionOverviewOptions.showSurnameDistribution)
					.onChange(value => {
						this.collectionOverviewOptions.showSurnameDistribution = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Show geographic distribution')
			.setDesc('Analyze location frequency')
			.addToggle(toggle => {
				toggle.setValue(this.collectionOverviewOptions.showGeographicDistribution)
					.onChange(value => {
						this.collectionOverviewOptions.showGeographicDistribution = value;
					});
			});

		new Setting(this.optionsContainer)
			.setName('Sort members by')
			.addDropdown(dropdown => {
				dropdown.addOption('birth_date', 'Birth date');
				dropdown.addOption('name', 'Name');
				dropdown.addOption('death_date', 'Death date');
				dropdown.setValue(this.collectionOverviewOptions.sortMembersBy);
				dropdown.onChange(value => {
					this.collectionOverviewOptions.sortMembersBy = value as typeof this.collectionOverviewOptions.sortMembersBy;
				});
			});

		new Setting(this.optionsContainer)
			.setName('Max members')
			.setDesc('Limit for member list')
			.addSlider(slider => {
				slider
					.setLimits(10, 200, 10)
					.setValue(this.collectionOverviewOptions.maxMembers)
					.setDynamicTooltip()
					.onChange(value => {
						this.collectionOverviewOptions.maxMembers = value;
					});
			});
	}

	/**
	 * Render collection picker
	 */
	private renderCollectionPicker(): void {
		if (!this.optionsContainer) return;

		const collectionContainer = this.optionsContainer.createDiv({ cls: 'cr-report-modal__collection' });

		new Setting(collectionContainer)
			.setName('Select collection')
			.setDesc(this.selectedCollectionName || 'Enter collection name or representative CR ID')
			.addText(text => {
				text.setPlaceholder('Collection name or CR ID')
					.setValue(this.selectedCollectionName || this.selectedCollectionId)
					.onChange(value => {
						this.selectedCollectionId = value;
						this.selectedCollectionName = value;
					});
			});
	}

	/**
	 * Generate the report
	 */
	private async generateReport(): Promise<void> {
		const metadata = REPORT_METADATA[this.selectedReportType];

		// Handle visual tree reports - open dedicated wizard instead
		if (this.isVisualTreeType(this.selectedReportType)) {
			this.openVisualTreeWizard();
			return;
		}

		// Validate person selection for person-based reports
		if (metadata.requiresPerson && !this.selectedPersonCrId) {
			new Notice('Please select a person first');
			return;
		}

		// Validate entity selection based on report type
		if (metadata.entityType === 'place' && !this.selectedPlaceCrId) {
			new Notice('Please select a place first');
			return;
		}
		if (metadata.entityType === 'universe' && !this.selectedUniverseCrId) {
			new Notice('Please select a universe first');
			return;
		}
		if (metadata.entityType === 'collection' && !this.selectedCollectionId) {
			new Notice('Please select a collection first');
			return;
		}

		// Build options based on report type
		let options: FamilyGroupSheetOptions | IndividualSummaryOptions | AhnentafelOptions | GapsReportOptions | RegisterReportOptions | PedigreeChartOptions | DescendantChartOptions | SourceSummaryOptions | TimelineReportOptions | PlaceSummaryOptions | MediaInventoryOptions | UniverseOverviewOptions | CollectionOverviewOptions;

		switch (this.selectedReportType) {
			case 'family-group-sheet':
				options = {
					personCrId: this.selectedPersonCrId,
					outputMethod: this.outputMethod,
					outputFolder: this.outputFolder || undefined,
					includeSources: this.familyGroupOptions.includeSources,
					includeChildren: this.familyGroupOptions.includeChildren,
					includeSpouseDetails: this.familyGroupOptions.includeSpouseDetails,
					includeEvents: this.familyGroupOptions.includeEvents
				};
				break;

			case 'individual-summary':
				options = {
					personCrId: this.selectedPersonCrId,
					outputMethod: this.outputMethod,
					outputFolder: this.outputFolder || undefined,
					includeSources: this.individualSummaryOptions.includeSources,
					includeEvents: this.individualSummaryOptions.includeEvents,
					includeFamily: this.individualSummaryOptions.includeFamily,
					includeAttributes: this.individualSummaryOptions.includeAttributes
				};
				break;

			case 'ahnentafel':
				options = {
					rootPersonCrId: this.selectedPersonCrId,
					outputMethod: this.outputMethod,
					outputFolder: this.outputFolder || undefined,
					includeSources: this.ahnentafelOptions.includeSources,
					maxGenerations: this.ahnentafelOptions.maxGenerations,
					includeDetails: this.ahnentafelOptions.includeDetails
				};
				break;

			case 'gaps-report':
				options = {
					outputMethod: this.outputMethod,
					outputFolder: this.outputFolder || undefined,
					includeSources: this.gapsReportOptions.includeSources,
					scope: this.gapsReportOptions.scope,
					collectionPath: this.gapsReportOptions.collectionPath || undefined,
					fieldsToCheck: this.gapsReportOptions.fieldsToCheck,
					maxItemsPerCategory: this.gapsReportOptions.maxItemsPerCategory
				};
				break;

			case 'register-report':
				options = {
					rootPersonCrId: this.selectedPersonCrId,
					outputMethod: this.outputMethod,
					outputFolder: this.outputFolder || undefined,
					includeSources: this.registerReportOptions.includeSources,
					maxGenerations: this.registerReportOptions.maxGenerations,
					includeDetails: this.registerReportOptions.includeDetails,
					includeSpouses: this.registerReportOptions.includeSpouses
				};
				break;

			case 'pedigree-chart':
				options = {
					rootPersonCrId: this.selectedPersonCrId,
					outputMethod: this.outputMethod,
					outputFolder: this.outputFolder || undefined,
					includeSources: this.pedigreeChartOptions.includeSources,
					maxGenerations: this.pedigreeChartOptions.maxGenerations,
					includeDetails: this.pedigreeChartOptions.includeDetails
				};
				break;

			case 'descendant-chart':
				options = {
					rootPersonCrId: this.selectedPersonCrId,
					outputMethod: this.outputMethod,
					outputFolder: this.outputFolder || undefined,
					includeSources: this.descendantChartOptions.includeSources,
					maxGenerations: this.descendantChartOptions.maxGenerations,
					includeDetails: this.descendantChartOptions.includeDetails,
					includeSpouses: this.descendantChartOptions.includeSpouses
				};
				break;

			case 'source-summary':
				options = {
					personCrId: this.selectedPersonCrId,
					outputMethod: this.outputMethod,
					outputFolder: this.outputFolder || undefined,
					includeSources: this.sourceSummaryOptions.includeSources,
					includeChildrenSources: this.sourceSummaryOptions.includeChildrenSources,
					groupBy: this.sourceSummaryOptions.groupBy,
					showQualityRatings: this.sourceSummaryOptions.showQualityRatings,
					includeCitationDetails: this.sourceSummaryOptions.includeCitationDetails,
					showRepositoryInfo: this.sourceSummaryOptions.showRepositoryInfo,
					highlightGaps: this.sourceSummaryOptions.highlightGaps
				};
				break;

			case 'timeline-report':
				options = {
					outputMethod: this.outputMethod,
					outputFolder: this.outputFolder || undefined,
					includeSources: this.timelineReportOptions.includeSources,
					dateFrom: this.timelineReportOptions.dateFrom || undefined,
					dateTo: this.timelineReportOptions.dateTo || undefined,
					eventTypes: this.timelineReportOptions.eventTypes,
					personFilter: this.timelineReportOptions.personFilter,
					placeFilter: this.timelineReportOptions.placeFilter,
					includeChildPlaces: this.timelineReportOptions.includeChildPlaces,
					grouping: this.timelineReportOptions.grouping,
					includeDescriptions: this.timelineReportOptions.includeDescriptions
				};
				break;

			case 'place-summary':
				options = {
					placeCrId: this.selectedPlaceCrId,
					outputMethod: this.outputMethod,
					outputFolder: this.outputFolder || undefined,
					includeSources: this.placeSummaryOptions.includeSources,
					includeChildPlaces: this.placeSummaryOptions.includeChildPlaces,
					dateFrom: this.placeSummaryOptions.dateFrom || undefined,
					dateTo: this.placeSummaryOptions.dateTo || undefined,
					eventTypes: this.placeSummaryOptions.eventTypes,
					showCoordinates: this.placeSummaryOptions.showCoordinates,
					showHierarchy: this.placeSummaryOptions.showHierarchy,
					includeMapReference: this.placeSummaryOptions.includeMapReference
				};
				break;

			case 'media-inventory':
				options = {
					outputMethod: this.outputMethod,
					outputFolder: this.outputFolder || undefined,
					includeSources: this.mediaInventoryOptions.includeSources,
					scope: this.mediaInventoryOptions.scope,
					folderPath: this.mediaInventoryOptions.folderPath || undefined,
					showOrphanedFiles: this.mediaInventoryOptions.showOrphanedFiles,
					showCoverageGaps: this.mediaInventoryOptions.showCoverageGaps,
					groupBy: this.mediaInventoryOptions.groupBy,
					includeFileSizes: this.mediaInventoryOptions.includeFileSizes
				};
				break;

			case 'universe-overview':
				options = {
					universeCrId: this.selectedUniverseCrId,
					outputMethod: this.outputMethod,
					outputFolder: this.outputFolder || undefined,
					includeSources: this.universeOverviewOptions.includeSources,
					includeEntityList: this.universeOverviewOptions.includeEntityList,
					showGeographicSummary: this.universeOverviewOptions.showGeographicSummary,
					showDateSystems: this.universeOverviewOptions.showDateSystems,
					showRecentActivity: this.universeOverviewOptions.showRecentActivity,
					maxEntitiesPerType: this.universeOverviewOptions.maxEntitiesPerType
				};
				break;

			case 'collection-overview':
				options = {
					collectionId: this.selectedCollectionId,
					collectionType: this.collectionOverviewOptions.collectionType,
					outputMethod: this.outputMethod,
					outputFolder: this.outputFolder || undefined,
					includeSources: this.collectionOverviewOptions.includeSources,
					includeMemberList: this.collectionOverviewOptions.includeMemberList,
					showGenerationAnalysis: this.collectionOverviewOptions.showGenerationAnalysis,
					showGeographicDistribution: this.collectionOverviewOptions.showGeographicDistribution,
					showSurnameDistribution: this.collectionOverviewOptions.showSurnameDistribution,
					sortMembersBy: this.collectionOverviewOptions.sortMembersBy,
					maxMembers: this.collectionOverviewOptions.maxMembers
				};
				break;

			default:
				// Visual tree types are handled above and return early
				// This should never be reached
				new Notice(`Unsupported report type: ${this.selectedReportType}`);
				return;
		}

		try {
			new Notice('Generating report...');

			const result = await this.reportService.generateReport(this.selectedReportType, options);

			if (!result.success) {
				new Notice(`Report generation failed: ${result.error}`);
				return;
			}

			// Handle output based on method
			if (this.outputMethod === 'pdf') {
				// Generate PDF using the structured result data
				await this.generatePdfFromResult(result);
			} else if (this.outputMethod === 'download') {
				this.reportService.downloadReport(result.content, result.suggestedFilename);
				new Notice('Report downloaded');
			} else {
				new Notice(`Report saved: ${result.suggestedFilename}`);
			}

			// Show warnings if any
			if (result.warnings.length > 0) {
				new Notice(`Warnings: ${result.warnings.join(', ')}`);
			}

			// Only close modal when saving to vault; keep open for downloads
			// so user can generate multiple reports with same person selection
			if (this.outputMethod === 'vault') {
				this.close();
			}

		} catch (error) {
			console.error('Report generation error:', error);
			new Notice('Report generation failed. Check console for details.');
		}
	}

	/**
	 * Generate PDF from the report result
	 */
	private async generatePdfFromResult(result: any): Promise<void> {
		const pdfOptions = {
			pageSize: this.pdfOptions.pageSize,
			fontStyle: 'serif' as const,
			dateFormat: this.pdfOptions.dateFormat,
			includeCoverPage: this.pdfOptions.includeCoverPage,
			logoDataUrl: this.pdfOptions.logoDataUrl,
			customTitle: this.pdfOptions.customTitle || undefined,
			customTitleScope: this.pdfOptions.customTitleScope,
			customSubtitle: this.pdfOptions.customSubtitle || undefined,
			coverNotes: this.pdfOptions.coverNotes || undefined
		};

		switch (this.selectedReportType) {
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
		}
	}

	/**
	 * Check if the report type is a visual tree type
	 */
	private isVisualTreeType(reportType: ReportType): boolean {
		return reportType === 'pedigree-tree-pdf' ||
			reportType === 'descendant-tree-pdf' ||
			reportType === 'hourglass-tree-pdf' ||
			reportType === 'fan-chart-pdf';
	}

	/**
	 * Open the visual tree wizard modal
	 */
	private openVisualTreeWizard(): void {
		// Map report type to chart type
		const chartTypeMap: Record<string, VisualTreeChartType> = {
			'pedigree-tree-pdf': 'pedigree',
			'descendant-tree-pdf': 'descendant',
			'hourglass-tree-pdf': 'hourglass',
			'fan-chart-pdf': 'fan'
		};

		const chartType = chartTypeMap[this.selectedReportType] || 'pedigree';

		// Close this modal and open the unified wizard
		this.close();

		// Map chart type to tree type for unified wizard
		const treeTypeMap: Record<VisualTreeChartType, 'full' | 'ancestors' | 'descendants' | 'fan'> = {
			'pedigree': 'ancestors',
			'descendant': 'descendants',
			'hourglass': 'full',
			'fan': 'fan'
		};

		const wizard = new UnifiedTreeWizardModal(this.plugin, {
			outputFormat: 'pdf',
			treeType: treeTypeMap[chartType],
			personCrId: this.selectedPersonCrId || undefined,
			personName: this.selectedPersonName || undefined
		});
		wizard.open();
	}
}
