import type { App } from 'obsidian';
import { Setting } from 'obsidian';
import type CanvasRootsPlugin from '../../main';
import { PersonPickerModal, type PersonInfo } from './person-picker';
import type { ExportFilterOptions, ExportStatistics } from '../core/export-statistics-service';
import { ExportStatisticsService } from '../core/export-statistics-service';
import type { LastExportInfo } from '../settings';

/**
 * Export options state that will be used for actual export
 */
export interface ExportOptions {
	/** Collection to filter by (undefined = all) */
	collectionFilter?: string;
	/** Branch root person cr_id */
	branchRootCrId?: string;
	/** Branch direction */
	branchDirection?: 'ancestors' | 'descendants';
	/** Include spouses when filtering descendants */
	branchIncludeSpouses: boolean;
	/** Privacy override enabled */
	privacyOverrideEnabled: boolean;
	/** Privacy protection enabled (when override is on) */
	privacyOverrideProtection: boolean;
	/** Privacy display format (when override is on) */
	privacyOverrideFormat: 'living' | 'private' | 'initials' | 'hidden';
	/** Export file name (without extension) */
	exportFileName: string;
	/** GEDCOM version (for GEDCOM exports) */
	gedcomVersion?: '5.5.1' | '7.0';
	/** Include collection codes (for GEDCOM exports) */
	includeCollectionCodes?: boolean;
	/** Include custom relationships as ASSO records (for GEDCOM exports) */
	includeCustomRelationships?: boolean;
	/** Entity inclusion options */
	includeEntities: {
		people: boolean;
		events: boolean;
		sources: boolean;
		places: boolean;
	};
	/** Output destination */
	outputDestination: 'download' | 'vault';
	/** Output folder path (when saving to vault) */
	outputFolder: string;
}

/**
 * Callback type for when export options change
 */
export type ExportOptionsChangeCallback = (options: ExportOptions) => void | Promise<void>;

/**
 * Builder for common export UI options across all export formats
 * Reduces code duplication by centralizing filter, privacy, and export configuration UI
 */
export class ExportOptionsBuilder {
	private app: App;
	private plugin: CanvasRootsPlugin;
	private settings: CanvasRootsPlugin['settings'];
	private options: ExportOptions;
	private changeCallbacks: ExportOptionsChangeCallback[] = [];

	constructor(app: App, plugin: CanvasRootsPlugin) {
		this.app = app;
		this.plugin = plugin;
		this.settings = plugin.settings;
		this.options = {
			branchIncludeSpouses: false,
			privacyOverrideEnabled: false,
			privacyOverrideProtection: plugin.settings.enablePrivacyProtection,
			privacyOverrideFormat: plugin.settings.privacyDisplayFormat,
			exportFileName: 'family-tree',
			includeEntities: {
				people: true,
				events: true,
				sources: true,
				places: true
			},
			outputDestination: 'download',
			outputFolder: ''
		};
	}

	/**
	 * Register a callback for when export options change
	 */
	public onChange(callback: ExportOptionsChangeCallback): this {
		this.changeCallbacks.push(callback);
		return this;
	}

	/**
	 * Get current export options
	 */
	public getOptions(): ExportOptions {
		return { ...this.options };
	}

	/**
	 * Notify all registered callbacks that options have changed
	 */
	private notifyChange(): void {
		this.changeCallbacks.forEach(cb => void cb(this.options));
	}

	/**
	 * Build collection filter dropdown
	 */
	public buildCollectionFilter(container: HTMLElement): Setting {
		const setting = new Setting(container)
			.setName('Collection filter (optional)')
			.setDesc('Only export people in a specific collection')
			.addDropdown(async dropdown => {
				dropdown.addOption('', 'All people');

				// Load collections
				const graphService = new (await import('../core/family-graph')).FamilyGraphService(this.app);
				const collections = graphService.getUserCollections();
				collections.forEach(collection => {
					dropdown.addOption(collection.name, collection.name);
				});

				dropdown.onChange(value => {
					this.options.collectionFilter = value || undefined;
					this.notifyChange();
				});
			});

		return setting;
	}

	/**
	 * Build branch filter section (person picker + direction + include spouses)
	 */
	public buildBranchFilter(container: HTMLElement): Setting[] {
		const settings: Setting[] = [];

		// Person picker
		const personBtn = new Setting(container)
			.setName('Branch filter (optional)')
			.setDesc('Export only ancestors or descendants of a specific person')
			.addButton(btn => {
				btn.setButtonText('Select person')
					.onClick(() => {
						const picker = new PersonPickerModal(this.app, (info: PersonInfo) => {
							this.options.branchRootCrId = info.crId;
							btn.setButtonText(info.name);
							this.notifyChange();
						});
						picker.open();
					});
			});
		settings.push(personBtn);

		// Direction dropdown
		const directionSetting = new Setting(container)
			.setName('Branch direction')
			.setDesc('Include ancestors (up) or descendants (down)')
			.addDropdown(dropdown => {
				dropdown.addOption('', 'No branch filter');
				dropdown.addOption('ancestors', 'Ancestors only');
				dropdown.addOption('descendants', 'Descendants only');
				dropdown.onChange(value => {
					this.options.branchDirection = (value as 'ancestors' | 'descendants') || undefined;
					this.notifyChange();
				});
			});
		settings.push(directionSetting);

		// Include spouses toggle
		const spousesSetting = new Setting(container)
			.setName('Include spouses in descendants')
			.setDesc('When exporting descendants, also include their spouses')
			.addToggle(toggle => toggle
				.setValue(false)
				.onChange(value => {
					this.options.branchIncludeSpouses = value;
					this.notifyChange();
				})
			);
		settings.push(spousesSetting);

		return settings;
	}

	/**
	 * Build privacy override section
	 */
	public buildPrivacyOverride(container: HTMLElement): Setting[] {
		const settings: Setting[] = [];

		// Privacy override toggle
		const overrideSetting = new Setting(container)
			.setName('Override privacy settings')
			.setDesc('Use different privacy settings for this export only')
			.addToggle(toggle => toggle
				.setValue(false)
				.onChange(value => {
					this.options.privacyOverrideEnabled = value;
					protectionSetting.settingEl.toggleClass('cr-hidden', !value);
					formatSetting.settingEl.toggleClass('cr-hidden', !(value && this.options.privacyOverrideProtection));
					this.notifyChange();
				})
			);
		settings.push(overrideSetting);

		// Privacy protection toggle
		const protectionSetting = new Setting(container)
			.setName('Enable privacy protection')
			.setDesc('Protect living persons in this export')
			.addToggle(toggle => toggle
				.setValue(this.options.privacyOverrideProtection)
				.onChange(value => {
					this.options.privacyOverrideProtection = value;
					formatSetting.settingEl.toggleClass('cr-hidden', !value);
					this.notifyChange();
				})
			);
		protectionSetting.settingEl.addClass('cr-hidden');
		settings.push(protectionSetting);

		// Privacy format dropdown
		const formatSetting = new Setting(container)
			.setName('Privacy display format')
			.setDesc('How to display protected living persons')
			.addDropdown(dropdown => dropdown
				.addOption('living', 'Living')
				.addOption('private', 'Private')
				.addOption('initials', 'Initials only')
				.addOption('hidden', 'Exclude from export')
				.setValue(this.options.privacyOverrideFormat)
				.onChange(value => {
					this.options.privacyOverrideFormat = value as 'living' | 'private' | 'initials' | 'hidden';
					this.notifyChange();
				})
			);
		formatSetting.settingEl.addClass('cr-hidden');
		settings.push(formatSetting);

		return settings;
	}

	/**
	 * Build and auto-update export statistics preview
	 */
	public buildStatsPreview(container: HTMLElement): HTMLElement {
		const statsPreviewEl = container.createDiv({ cls: 'crc-export-stats-preview crc-mb-4' });

		// Update function
		const updateStatsPreview = async (): Promise<void> => {
			// Import services
			const { FamilyGraphService } = await import('../core/family-graph');
			const { PrivacyService } = await import('../core/privacy-service');

			// Setup graph service
			const graphService = new FamilyGraphService(this.app);
			graphService.setFolderFilter(new (await import('../core/folder-filter')).FolderFilterService(this.settings));
			graphService.setPropertyAliases(this.settings.propertyAliases);
			graphService.setValueAliases(this.settings.valueAliases);
			await graphService.reloadCache();

			// Determine effective privacy settings
			const effectiveProtection = this.options.privacyOverrideEnabled
				? this.options.privacyOverrideProtection
				: this.settings.enablePrivacyProtection;
			const effectiveFormat = this.options.privacyOverrideEnabled
				? this.options.privacyOverrideFormat
				: this.settings.privacyDisplayFormat;

			const privacyService = effectiveProtection
				? new PrivacyService({
						enablePrivacyProtection: effectiveProtection,
						livingPersonAgeThreshold: this.settings.livingPersonAgeThreshold,
						privacyDisplayFormat: effectiveFormat,
						hideDetailsForLiving: this.settings.hideDetailsForLiving
					})
				: null;

			// Build filter options for statistics calculation
			const filterOptions: ExportFilterOptions = {
				collectionFilter: this.options.collectionFilter,
				branchRootCrId: this.options.branchRootCrId,
				branchDirection: this.options.branchDirection,
				branchIncludeSpouses: this.options.branchIncludeSpouses,
				privacySettings: effectiveProtection
					? {
							enablePrivacyProtection: effectiveProtection,
							privacyDisplayFormat: effectiveFormat
						}
					: undefined
			};

			// Calculate statistics
			const statsService = new ExportStatisticsService(this.app);
			const stats = statsService.calculateStatistics(graphService, privacyService, filterOptions);

			// Render statistics
			this.renderStats(statsPreviewEl, stats);
		};

		// Register onChange handler to update stats when options change
		this.onChange(() => void updateStatsPreview());

		// Initial render
		void updateStatsPreview();

		return statsPreviewEl;
	}

	/**
	 * Render statistics preview UI
	 */
	private renderStats(container: HTMLElement, stats: ExportStatistics): void {
		container.empty();

		container.createEl('div', {
			cls: 'crc-export-stats-preview__title',
			text: 'Export preview'
		});

		const statsList = container.createEl('ul', {
			cls: 'crc-export-stats-preview__list'
		});

		// People count with living status
		const peopleText = stats.excludedPeople > 0
			? `${stats.totalPeople - stats.excludedPeople} people (${stats.excludedPeople} living will be excluded)`
			: stats.livingPeople > 0
			? `${stats.totalPeople} people (${stats.livingPeople} living will be protected)`
			: `${stats.totalPeople} people`;

		statsList.createEl('li', { text: peopleText });
		statsList.createEl('li', { text: `${stats.totalRelationships} relationships` });
		statsList.createEl('li', { text: `${stats.totalEvents} events` });
		statsList.createEl('li', { text: `${stats.totalSources} sources` });
		statsList.createEl('li', { text: `${stats.totalPlaces} places` });

		container.createEl('div', {
			cls: 'crc-export-stats-preview__size crc-text-muted crc-text-sm crc-mt-2',
			text: `Estimated export size: ${ExportStatisticsService.formatBytes(stats.estimatedSize)}`
		});

		// Warning if no people selected
		if (stats.totalPeople === 0 || stats.totalPeople - stats.excludedPeople === 0) {
			container.createEl('div', {
				cls: 'crc-export-stats-preview__warning crc-mt-2',
				text: '⚠ No people will be exported with current filters'
			});
		}
	}

	/**
	 * Build export file name input
	 */
	public buildFileNameInput(container: HTMLElement, defaultName = 'family-tree', fileExtension = '.ged'): Setting {
		this.options.exportFileName = defaultName;

		const setting = new Setting(container)
			.setName('Export file name')
			.setDesc(`Name for the exported ${fileExtension} file (without extension)`)
			.addText(text => text
				.setPlaceholder(defaultName)
				.setValue(defaultName)
				.onChange(value => {
					this.options.exportFileName = value || defaultName;
					this.notifyChange();
				})
			);

		return setting;
	}

	/**
	 * Build GEDCOM version selector (GEDCOM exports only)
	 */
	public buildGedcomVersionSelector(container: HTMLElement): Setting {
		this.options.gedcomVersion = this.settings.preferredGedcomVersion;

		const versionSetting = new Setting(container)
			.setName('GEDCOM version')
			.setDesc('Choose the GEDCOM standard version for export');

		// Create radio-style buttons for version selection
		const versionContainer = versionSetting.settingEl.createDiv({ cls: 'crc-gedcom-version-selector' });

		const version551Button = versionContainer.createDiv({ cls: 'crc-version-option crc-version-option--selected' });
		version551Button.createEl('div', { cls: 'crc-version-option__radio' });
		const version551Content = version551Button.createDiv({ cls: 'crc-version-option__content' });
		version551Content.createEl('div', { cls: 'crc-version-option__title', text: 'GEDCOM 5.5.1 (Legacy)' });
		version551Content.createEl('div', { cls: 'crc-version-option__desc', text: 'Maximum compatibility with older software. Widely supported standard.' });

		const version70Button = versionContainer.createDiv({ cls: 'crc-version-option crc-version-option--disabled' });
		version70Button.createEl('div', { cls: 'crc-version-option__radio' });
		const version70Content = version70Button.createDiv({ cls: 'crc-version-option__content' });
		version70Content.createEl('div', { cls: 'crc-version-option__title', text: 'GEDCOM 7.0 (Coming Soon)' });
		version70Content.createEl('div', { cls: 'crc-version-option__desc', text: 'Modern format with enhanced features. Not yet implemented.' });

		// 5.5.1 click handler
		version551Button.addEventListener('click', () => {
			this.options.gedcomVersion = '5.5.1';
			this.plugin.settings.preferredGedcomVersion = '5.5.1';
			void this.plugin.saveSettings();
			version551Button.addClass('crc-version-option--selected');
			version70Button.removeClass('crc-version-option--selected');
			this.notifyChange();
		});

		// 7.0 click handler (disabled for now)
		version70Button.addEventListener('click', () => {
			// Currently disabled - ready for future implementation
		});

		return versionSetting;
	}

	/**
	 * Build include collection codes toggle (GEDCOM exports only)
	 */
	public buildIncludeCollectionCodes(container: HTMLElement): Setting {
		this.options.includeCollectionCodes = true;

		const setting = new Setting(container)
			.setName('Include collection codes')
			.setDesc('Preserve Charted Roots collection data in export')
			.addToggle(toggle => toggle
				.setValue(true)
				.onChange(value => {
					this.options.includeCollectionCodes = value;
					this.notifyChange();
				})
			);

		return setting;
	}

	/**
	 * Build include custom relationships toggle (GEDCOM exports only)
	 */
	public buildIncludeCustomRelationships(container: HTMLElement): Setting {
		this.options.includeCustomRelationships = true;

		const setting = new Setting(container)
			.setName('Include custom relationships')
			.setDesc('Export custom relationships (godparent, witness, guardian, etc.) as ASSO records')
			.addToggle(toggle => toggle
				.setValue(true)
				.onChange(value => {
					this.options.includeCustomRelationships = value;
					this.notifyChange();
				})
			);

		return setting;
	}

	/**
	 * Build entity inclusion checkboxes
	 */
	public buildEntityInclusion(container: HTMLElement): HTMLElement {
		const entitySection = container.createDiv({ cls: 'crc-entity-inclusion crc-mb-4' });

		entitySection.createEl('div', {
			cls: 'crc-entity-inclusion__title',
			text: 'Include in export'
		});

		const entityList = entitySection.createDiv({ cls: 'crc-entity-inclusion__list' });

		// People checkbox
		const peopleSetting = new Setting(entityList)
			.setName('People')
			.setDesc('Include person records')
			.addToggle(toggle => toggle
				.setValue(this.options.includeEntities.people)
				.onChange(value => {
					this.options.includeEntities.people = value;
					this.notifyChange();
				})
			);
		peopleSetting.settingEl.addClass('crc-entity-inclusion__item');

		// Events checkbox
		const eventsSetting = new Setting(entityList)
			.setName('Events')
			.setDesc('Include event records')
			.addToggle(toggle => toggle
				.setValue(this.options.includeEntities.events)
				.onChange(value => {
					this.options.includeEntities.events = value;
					this.notifyChange();
				})
			);
		eventsSetting.settingEl.addClass('crc-entity-inclusion__item');

		// Sources checkbox
		const sourcesSetting = new Setting(entityList)
			.setName('Sources')
			.setDesc('Include source records')
			.addToggle(toggle => toggle
				.setValue(this.options.includeEntities.sources)
				.onChange(value => {
					this.options.includeEntities.sources = value;
					this.notifyChange();
				})
			);
		sourcesSetting.settingEl.addClass('crc-entity-inclusion__item');

		// Places checkbox
		const placesSetting = new Setting(entityList)
			.setName('Places')
			.setDesc('Include place records')
			.addToggle(toggle => toggle
				.setValue(this.options.includeEntities.places)
				.onChange(value => {
					this.options.includeEntities.places = value;
					this.notifyChange();
				})
			);
		placesSetting.settingEl.addClass('crc-entity-inclusion__item');

		return entitySection;
	}

	/**
	 * Build output location selector
	 */
	public buildOutputLocation(container: HTMLElement): HTMLElement {
		const locationSection = container.createDiv({ cls: 'crc-output-location crc-mb-4' });

		locationSection.createEl('div', {
			cls: 'crc-output-location__title',
			text: 'Output location'
		});

		// Radio buttons for destination
		const destinationContainer = locationSection.createDiv({ cls: 'crc-output-location__destinations' });

		const downloadOption = destinationContainer.createDiv({
			cls: 'crc-output-option crc-output-option--selected'
		});
		downloadOption.createEl('div', { cls: 'crc-output-option__radio' });
		const downloadContent = downloadOption.createDiv({ cls: 'crc-output-option__content' });
		downloadContent.createEl('div', { cls: 'crc-output-option__title', text: 'Download file' });
		downloadContent.createEl('div', { cls: 'crc-output-option__desc', text: 'Save to your downloads folder' });

		const vaultOption = destinationContainer.createDiv({ cls: 'crc-output-option' });
		vaultOption.createEl('div', { cls: 'crc-output-option__radio' });
		const vaultContent = vaultOption.createDiv({ cls: 'crc-output-option__content' });
		vaultContent.createEl('div', { cls: 'crc-output-option__title', text: 'Save to vault' });
		vaultContent.createEl('div', { cls: 'crc-output-option__desc', text: 'Save to a folder in your vault' });

		// Folder path input (hidden initially)
		const folderPathContainer = locationSection.createDiv({ cls: 'crc-output-location__folder-path cr-hidden' });
		new Setting(folderPathContainer)
			.setName('Vault folder')
			.setDesc('Path to folder in vault (leave empty for vault root)')
			.addText(text => text
				.setPlaceholder('exports')
				.setValue(this.options.outputFolder)
				.onChange(value => {
					this.options.outputFolder = value;
					this.notifyChange();
				})
			);

		// Download click handler
		downloadOption.addEventListener('click', () => {
			this.options.outputDestination = 'download';
			downloadOption.addClass('crc-output-option--selected');
			vaultOption.removeClass('crc-output-option--selected');
			folderPathContainer.addClass('cr-hidden');
			this.notifyChange();
		});

		// Vault click handler
		vaultOption.addEventListener('click', () => {
			this.options.outputDestination = 'vault';
			vaultOption.addClass('crc-output-option--selected');
			downloadOption.removeClass('crc-output-option--selected');
			folderPathContainer.removeClass('cr-hidden');
			this.notifyChange();
		});

		return locationSection;
	}

	/**
	 * Build last export info display (static method for use in export cards)
	 */
	public static buildLastExportInfo(container: HTMLElement, lastExport: LastExportInfo | undefined, formatName: string): HTMLElement | null {
		if (!lastExport) {
			return null;
		}

		const infoSection = container.createDiv({ cls: 'crc-last-export-info crc-mb-4' });

		// Format the timestamp as a relative time (e.g., "2 hours ago")
		const now = Date.now();
		const diff = now - lastExport.timestamp;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		let timeAgo: string;
		if (days > 0) {
			timeAgo = `${days} day${days > 1 ? 's' : ''} ago`;
		} else if (hours > 0) {
			timeAgo = `${hours} hour${hours > 1 ? 's' : ''} ago`;
		} else if (minutes > 0) {
			timeAgo = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
		} else {
			timeAgo = 'just now';
		}

		// Build the info text
		let infoText = `Last ${formatName} export: ${lastExport.peopleCount} people, ${timeAgo}`;
		if (lastExport.destination === 'vault' && lastExport.filePath) {
			infoText += ` (saved to ${lastExport.filePath})`;
		}
		if (lastExport.privacyExcluded && lastExport.privacyExcluded > 0) {
			infoText += ` — ${lastExport.privacyExcluded} living excluded`;
		}

		infoSection.createEl('div', {
			cls: 'crc-last-export-info__text',
			text: infoText
		});

		return infoSection;
	}

	/**
	 * Get effective privacy settings for export
	 */
	public getEffectivePrivacySettings(): {
		enablePrivacyProtection: boolean;
		privacyDisplayFormat: 'living' | 'private' | 'initials' | 'hidden';
	} {
		return {
			enablePrivacyProtection: this.options.privacyOverrideEnabled
				? this.options.privacyOverrideProtection
				: this.settings.enablePrivacyProtection,
			privacyDisplayFormat: this.options.privacyOverrideEnabled
				? this.options.privacyOverrideFormat
				: this.settings.privacyDisplayFormat
		};
	}
}
