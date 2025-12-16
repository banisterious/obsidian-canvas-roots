/**
 * Report Generator Modal
 *
 * Modal for configuring and generating genealogy reports.
 */

import { App, Modal, Setting, Notice, DropdownComponent } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type {
	ReportType,
	FamilyGroupSheetOptions,
	IndividualSummaryOptions,
	AhnentafelOptions,
	GapsReportOptions
} from '../types/report-types';
import { REPORT_METADATA } from '../types/report-types';
import { ReportGenerationService } from '../services/report-generation-service';
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

	// Form state
	private selectedReportType: ReportType = 'family-group-sheet';
	private selectedPersonCrId: string = '';
	private selectedPersonName: string = '';
	private outputMethod: 'vault' | 'download' = 'vault';
	private outputFolder: string = '';

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

	// UI elements
	private optionsContainer: HTMLElement | null = null;
	private personPickerSetting: Setting | null = null;

	constructor(app: App, plugin: CanvasRootsPlugin, options: ReportGeneratorModalOptions = {}) {
		super(app);
		this.plugin = plugin;
		this.options = options;
		this.reportService = new ReportGenerationService(app, plugin.settings);

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
				dropdown.addOption('download', 'Download file');
				dropdown.setValue(this.outputMethod);
				dropdown.onChange(value => {
					this.outputMethod = value as 'vault' | 'download';
				});
			});

		new Setting(outputSection)
			.setName('Output folder')
			.setDesc('Folder to save report (leave empty for vault root)')
			.addText(text => {
				text.setPlaceholder('Reports')
					.setValue(this.outputFolder)
					.onChange(value => {
						this.outputFolder = value;
					});
			});

		// Actions
		const actionsContainer = contentEl.createDiv({ cls: 'cr-report-modal__actions' });

		const cancelBtn = actionsContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const generateBtn = actionsContainer.createEl('button', {
			text: 'Generate report',
			cls: 'mod-cta'
		});
		generateBtn.addEventListener('click', () => this.generateReport());
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
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
		let options: FamilyGroupSheetOptions | IndividualSummaryOptions | AhnentafelOptions | GapsReportOptions;

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
		}

		try {
			new Notice('Generating report...');

			const result = await this.reportService.generateReport(this.selectedReportType, options);

			if (!result.success) {
				new Notice(`Report generation failed: ${result.error}`);
				return;
			}

			// Handle output
			if (this.outputMethod === 'download') {
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
}
