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
	FamilyGroupSheetResult,
	IndividualSummaryResult,
	AhnentafelResult,
	GapsReportResult,
	RegisterReportResult,
	PedigreeChartResult,
	DescendantChartResult
} from '../types/report-types';
import { REPORT_METADATA } from '../types/report-types';
import { ReportGenerationService } from '../services/report-generation-service';
import { PdfReportRenderer } from '../services/pdf-report-renderer';
import { PersonPickerModal, PersonInfo } from '../../ui/person-picker';
import { FolderFilterService } from '../../core/folder-filter';
import { createLucideIcon } from '../../ui/lucide-icons';

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
	private selectedReportType: ReportType = 'family-group-sheet';
	private selectedPersonCrId: string = '';
	private selectedPersonName: string = '';
	private outputMethod: 'vault' | 'download' | 'pdf' = 'vault';
	private outputFolder: string;

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

	// UI elements
	private optionsContainer: HTMLElement | null = null;
	private personPickerSetting: Setting | null = null;
	private outputFolderSetting: Setting | null = null;
	private privacyMessageEl: HTMLElement | null = null;

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

		// Report type selector
		new Setting(contentEl)
			.setName('Report type')
			.setDesc('Select the type of report to generate')
			.addDropdown(dropdown => {
				for (const [type, metadata] of Object.entries(REPORT_METADATA)) {
					dropdown.addOption(type, metadata.name);
				}
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
	 * Update visibility of output-related UI elements based on output method
	 */
	private updateOutputVisibility(): void {
		const isDownload = this.outputMethod === 'download' || this.outputMethod === 'pdf';

		// Show/hide privacy message
		if (this.privacyMessageEl) {
			this.privacyMessageEl.style.display = isDownload ? 'block' : 'none';

			// Update message text based on PDF vs MD
			const messageSpan = this.privacyMessageEl.querySelector('span:last-child');
			if (messageSpan) {
				messageSpan.textContent = this.outputMethod === 'pdf'
					? 'PDF is generated locally on your device. No internet connection required. Downloads to your system\'s Downloads folder.'
					: 'File is generated locally on your device. No internet connection required. Downloads to your system\'s Downloads folder.';
			}
		}

		// Show/hide output folder setting
		if (this.outputFolderSetting) {
			this.outputFolderSetting.settingEl.style.display = isDownload ? 'none' : '';
		}
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
	 * Generate the report
	 */
	private async generateReport(): Promise<void> {
		const metadata = REPORT_METADATA[this.selectedReportType];

		// Validate person selection for person-based reports
		if (metadata.requiresPerson && !this.selectedPersonCrId) {
			new Notice('Please select a person first');
			return;
		}

		// Build options based on report type
		let options: FamilyGroupSheetOptions | IndividualSummaryOptions | AhnentafelOptions | GapsReportOptions | RegisterReportOptions | PedigreeChartOptions | DescendantChartOptions;

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

			this.close();

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
			pageSize: 'A4' as const,
			fontStyle: 'serif' as const
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
		}
	}
}
