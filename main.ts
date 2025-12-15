import { Plugin, Notice, TFile, TFolder, Menu, Platform, Modal, EventRef, WorkspaceLeaf } from 'obsidian';
import { CanvasRootsSettings, DEFAULT_SETTINGS, CanvasRootsSettingTab } from './src/settings';
import { ControlCenterModal } from './src/ui/control-center';
import { RegenerateOptionsModal } from './src/ui/regenerate-options-modal';
import { TreeStatisticsModal } from './src/ui/tree-statistics-modal';
import { PersonPickerModal } from './src/ui/person-picker';
import { RelationshipManager } from './src/core/relationship-manager';
import { RelationshipValidator } from './src/core/relationship-validator';
import { ValidationResultsModal } from './src/ui/validation-results-modal';
import { FindOnCanvasModal } from './src/ui/find-on-canvas-modal';
import { FolderScanModal } from './src/ui/folder-scan-modal';
import { FolderStatisticsModal } from './src/ui/folder-statistics-modal';
import { RelationshipCalculatorModal } from './src/ui/relationship-calculator-modal';
import { LoggerFactory, getLogger } from './src/core/logging';
import { getErrorMessage } from './src/core/error-utils';
import { FamilyGraphService } from './src/core/family-graph';
import { CanvasGenerator } from './src/core/canvas-generator';
import { generatePeopleBaseTemplate } from './src/constants/base-template';
import { generatePlacesBaseTemplate } from './src/constants/places-base-template';
import { ORGANIZATIONS_BASE_TEMPLATE } from './src/constants/organizations-base-template';
import { SOURCES_BASE_TEMPLATE } from './src/constants/sources-base-template';
import { generateEventsBaseTemplate } from './src/constants/events-base-template';
import { ExcalidrawExporter } from './src/excalidraw/excalidraw-exporter';
import { BidirectionalLinker } from './src/core/bidirectional-linker';
import { generateCrId } from './src/core/uuid';
import { ReferenceNumberingService, NumberingSystem } from './src/core/reference-numbering';
import { LineageTrackingService, LineageType } from './src/core/lineage-tracking';
import { RelationshipHistoryService, RelationshipHistoryData, formatChangeDescription } from './src/core/relationship-history';
import { RelationshipHistoryModal } from './src/ui/relationship-history-modal';
import { FamilyChartView, VIEW_TYPE_FAMILY_CHART } from './src/ui/views/family-chart-view';
import { MapView, VIEW_TYPE_MAP } from './src/maps/map-view';
import { TreePreviewRenderer } from './src/ui/tree-preview';
import { FolderFilterService } from './src/core/folder-filter';
import { SplitWizardModal } from './src/ui/split-wizard-modal';
import { CreatePlaceModal } from './src/ui/create-place-modal';
import { CreatePersonModal } from './src/ui/create-person-modal';
import { PlaceGraphService } from './src/core/place-graph';
import { MergeDuplicatePlacesModal, findDuplicatePlaceNotes } from './src/ui/merge-duplicate-places-modal';
import { SchemaService, ValidationService } from './src/schemas';
import { AddRelationshipModal } from './src/ui/add-relationship-modal';
import { SourcePickerModal, SourceService, CreateSourceModal, CitationGeneratorModal, EvidenceService, ProofSummaryService } from './src/sources';
import { EventService } from './src/events/services/event-service';
import { CreateEventModal } from './src/events/ui/create-event-modal';
import { isPlaceNote, isSourceNote, isEventNote, isMapNote, isSchemaNote } from './src/utils/note-type-detection';
import { GeocodingService } from './src/maps/services/geocoding-service';
import { TimelineProcessor, RelationshipsProcessor } from './src/dynamic-content';

const logger = getLogger('CanvasRootsPlugin');

export default class CanvasRootsPlugin extends Plugin {
	settings: CanvasRootsSettings;
	private fileModifyEventRef: EventRef | null = null;
	public bidirectionalLinker: BidirectionalLinker | null = null;
	private relationshipHistory: RelationshipHistoryService | null = null;
	private folderFilter: FolderFilterService | null = null;
	private eventService: EventService | null = null;

	/**
	 * Get the folder filter service for filtering person notes by folder
	 */
	getFolderFilter(): FolderFilterService | null {
		return this.folderFilter;
	}

	/**
	 * Resolve a frontmatter property value, checking aliases if canonical property not found.
	 * Canonical property takes precedence over aliased property.
	 * @param frontmatter The frontmatter object from a note
	 * @param canonicalProperty The canonical property name (e.g., 'cr_id', 'born', 'died')
	 * @returns The property value, or undefined if not found
	 */
	resolveFrontmatterProperty<T>(frontmatter: Record<string, unknown> | undefined, canonicalProperty: string): T | undefined {
		if (!frontmatter) return undefined;

		// Canonical property takes precedence
		if (frontmatter[canonicalProperty] !== undefined) {
			return frontmatter[canonicalProperty] as T;
		}

		// Check aliases - find user property that maps to this canonical property
		const aliases = this.settings.propertyAliases ?? {};
		for (const [userProp, canonicalProp] of Object.entries(aliases)) {
			if (canonicalProp === canonicalProperty && frontmatter[userProp] !== undefined) {
				return frontmatter[userProp] as T;
			}
		}

		return undefined;
	}

	/**
	 * Get the event service for managing event notes
	 */
	getEventService(): EventService | null {
		return this.eventService;
	}

	/**
	 * Create a FamilyGraphService configured with the folder filter
	 * and optionally populated with research coverage and conflict data when fact tracking is enabled
	 */
	createFamilyGraphService(): FamilyGraphService {
		const graphService = new FamilyGraphService(this.app);
		if (this.folderFilter) {
			graphService.setFolderFilter(this.folderFilter);
		}
		// Set settings for note type detection
		graphService.setSettings(this.settings);

		// Populate research coverage and conflict counts when fact-level tracking is enabled
		if (this.settings.trackFactSourcing) {
			this.populateResearchCoverage(graphService);
			this.populateConflictCounts(graphService);
		}

		return graphService;
	}

	/**
	 * Populate research coverage percentages for all people in the graph
	 */
	private populateResearchCoverage(graphService: FamilyGraphService): void {
		const evidenceService = new EvidenceService(this.app, this.settings);
		const people = graphService.getAllPeople();

		for (const person of people) {
			const coverage = evidenceService.getFactCoverageForFile(person.file);
			if (coverage) {
				graphService.setResearchCoverage(person.crId, coverage.coveragePercent);
			}
		}
	}

	/**
	 * Populate conflict counts for all people in the graph
	 * Counts proof summaries with status 'conflicted' or evidence with 'conflicts' support
	 */
	private populateConflictCounts(graphService: FamilyGraphService): void {
		const proofService = new ProofSummaryService(this.app, this.settings);
		const people = graphService.getAllPeople();

		for (const person of people) {
			const proofs = proofService.getProofsForPerson(person.crId);

			// Count conflicts: proofs with status 'conflicted' OR proofs with any conflicting evidence
			let conflictCount = 0;
			for (const proof of proofs) {
				if (proof.status === 'conflicted') {
					conflictCount++;
				} else if (proof.evidence.some(e => e.supports === 'conflicts')) {
					conflictCount++;
				}
			}

			if (conflictCount > 0) {
				graphService.setConflictCount(person.crId, conflictCount);
			}
		}
	}

	/**
	 * Create a PlaceGraphService configured with folder filter and settings
	 */
	createPlaceGraphService(): PlaceGraphService {
		const placeGraph = new PlaceGraphService(this.app);
		if (this.folderFilter) {
			placeGraph.setFolderFilter(this.folderFilter);
		}
		placeGraph.setSettings(this.settings);
		placeGraph.setValueAliases(this.settings.valueAliases);
		return placeGraph;
	}

	async onload() {
		console.debug('Loading Canvas Roots plugin');

		await this.loadSettings();

		// Initialize logger with saved log level
		LoggerFactory.setLogLevel(this.settings.logLevel);

		// Initialize folder filter service
		this.folderFilter = new FolderFilterService(this.settings);

		// Initialize event service
		this.eventService = new EventService(this.app, this.settings);

		// Run migration for property rename (collection_name -> group_name)
		await this.migrateCollectionNameToGroupName();

		// Add settings tab
		this.addSettingTab(new CanvasRootsSettingTab(this.app, this));

		// Trigger Style Settings plugin to parse our CSS settings block
		// Delay to ensure Style Settings plugin is loaded first
		this.app.workspace.onLayoutReady(() => {
			this.app.workspace.trigger('parse-style-settings');
		});

		// Register family chart view
		this.registerView(
			VIEW_TYPE_FAMILY_CHART,
			(leaf) => new FamilyChartView(leaf, this)
		);

		// Register map view
		this.registerView(
			VIEW_TYPE_MAP,
			(leaf) => new MapView(leaf, this)
		);

		// Register dynamic content code block processors
		const timelineProcessor = new TimelineProcessor(this);
		this.registerMarkdownCodeBlockProcessor(
			'canvas-roots-timeline',
			(source, el, ctx) => timelineProcessor.process(source, el, ctx)
		);

		const relationshipsProcessor = new RelationshipsProcessor(this);
		this.registerMarkdownCodeBlockProcessor(
			'canvas-roots-relationships',
			(source, el, ctx) => relationshipsProcessor.process(source, el, ctx)
		);

		// Add ribbon icon for control center
		this.addRibbonIcon('users', 'Open Canvas Roots control center', () => {
			new ControlCenterModal(this.app, this).open();
		});

		// Add command: Open Control Center
		this.addCommand({
			id: 'open-control-center',
			name: 'Open control center',
			callback: () => {
				new ControlCenterModal(this.app, this).open();
			}
		});

		// Register workspace event to open Control Center to a specific tab
		// Used by Plugin Settings to link to Preferences tab
		this.registerEvent(
			this.app.workspace.on('canvas-roots:open-control-center' as 'layout-change', (initialTab?: string) => {
				new ControlCenterModal(this.app, this, initialTab).open();
			})
		);

		// Add command: Generate Tree for Current Note
		this.addCommand({
			id: 'generate-tree-for-current-note',
			name: 'Generate tree for current note',
			callback: () => {
				void this.generateTreeForCurrentNote();
			}
		});

		// Add command: Regenerate Canvas
		this.addCommand({
			id: 'regenerate-canvas',
			name: 'Regenerate canvas',
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile();

				if (!activeFile || activeFile.extension !== 'canvas') {
					new Notice('No active canvas. Please open a canvas file first.');
					return;
				}

				// Show options modal
				new RegenerateOptionsModal(this.app, this, activeFile).open();
			}
		});

		// Add command: Create Person Note
		this.addCommand({
			id: 'create-person-note',
			name: 'Create person note',
			callback: () => {
				this.createPersonNote();
			}
		});

		// Add command: Create Event Note
		this.addCommand({
			id: 'create-event-note',
			name: 'Create event note',
			callback: () => {
				if (this.eventService) {
					new CreateEventModal(this.app, this.eventService, this.settings).open();
				}
			}
		});

		// Add command: Generate All Trees (for multi-family vaults)
		this.addCommand({
			id: 'generate-all-trees',
			name: 'Generate all trees',
			callback: () => {
				void this.generateAllTrees();
			}
		});

		// Add command: Create Base Template
		this.addCommand({
			id: 'create-base-template',
			name: 'Create base template',
			callback: () => {
				void this.createBaseTemplate();
			}
		});

		// Add command: Create Organizations Base Template
		this.addCommand({
			id: 'create-organizations-base-template',
			name: 'Create organizations base template',
			callback: () => {
				void this.createOrganizationsBaseTemplate();
			}
		});

		// Add command: Create Sources Base Template
		this.addCommand({
			id: 'create-sources-base-template',
			name: 'Create sources base template',
			callback: () => {
				void this.createSourcesBaseTemplate();
			}
		});

		// Add command: Create Places Base Template
		this.addCommand({
			id: 'create-places-base-template',
			name: 'Create places base template',
			callback: () => {
				void this.createPlacesBaseTemplate();
			}
		});

		// Add command: Create Events Base Template
		this.addCommand({
			id: 'create-events-base-template',
			name: 'Create events base template',
			callback: () => {
				void this.createEventsBaseTemplate();
			}
		});

		// Add command: Calculate Relationship
		this.addCommand({
			id: 'calculate-relationship',
			name: 'Calculate relationship between people',
			callback: () => {
				new RelationshipCalculatorModal(this.app).open();
			}
		});

		// Add command: Find Duplicates
		this.addCommand({
			id: 'find-duplicates',
			name: 'Find duplicate people',
			callback: async () => {
				const { DuplicateDetectionModal } = await import('./src/ui/duplicate-detection-modal');
				new DuplicateDetectionModal(this.app, this.settings).open();
			}
		});

		// Add command: Open Family Chart
		// If a person note is active, use it as the root; otherwise show picker/empty state
		this.addCommand({
			id: 'open-family-chart',
			name: 'Open family chart',
			callback: () => {
				// Try to get cr_id from active note if it's a person note
				const activeFile = this.app.workspace.getActiveFile();
				let crId: string | undefined;
				if (activeFile && activeFile.extension === 'md') {
					const cache = this.app.metadataCache.getFileCache(activeFile);
					crId = this.resolveFrontmatterProperty<string>(cache?.frontmatter, 'cr_id');
				}
				void this.activateFamilyChartView(crId);
			}
		});

		// Add command: Open Map View
		this.addCommand({
			id: 'open-map-view',
			name: 'Open map view',
			callback: () => {
				void this.activateMapView();
			}
		});

		// Add command: Open New Map View (for side-by-side comparison)
		this.addCommand({
			id: 'open-new-map-view',
			name: 'Open new map view (for comparison)',
			callback: () => {
				void this.activateMapView(undefined, true);
			}
		});

		// Add command: Open new Family Chart (always creates new tab)
		this.addCommand({
			id: 'open-new-family-chart',
			name: 'Open new family chart',
			callback: () => {
				void this.activateFamilyChartView(undefined, true, true);
			}
		});

		// Add command: Open Family Chart for Current Note
		this.addCommand({
			id: 'open-family-chart-for-note',
			name: 'Open current note in family chart',
			checkCallback: (checking) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile || activeFile.extension !== 'md') {
					return false;
				}
				const cache = this.app.metadataCache.getFileCache(activeFile);
				const crId = this.resolveFrontmatterProperty<string>(cache?.frontmatter, 'cr_id');
				if (!crId) {
					return false;
				}
				if (!checking) {
					void this.activateFamilyChartView(crId);
				}
				return true;
			}
		});

		// Add command: Assign Ahnentafel Numbers
		this.addCommand({
			id: 'assign-ahnentafel',
			name: 'Assign Ahnentafel numbers (ancestors)',
			callback: () => {
				this.promptAssignReferenceNumbers('ahnentafel');
			}
		});

		// Add command: Assign d'Aboville Numbers
		this.addCommand({
			id: 'assign-daboville',
			name: "Assign d'Aboville numbers (descendants)",
			callback: () => {
				this.promptAssignReferenceNumbers('daboville');
			}
		});

		// Add command: Assign Henry Numbers
		this.addCommand({
			id: 'assign-henry',
			name: 'Assign Henry numbers (descendants)',
			callback: () => {
				this.promptAssignReferenceNumbers('henry');
			}
		});

		// Add command: Assign Generation Numbers
		this.addCommand({
			id: 'assign-generation',
			name: 'Assign generation numbers (all relatives)',
			callback: () => {
				this.promptAssignReferenceNumbers('generation');
			}
		});

		// Add command: Clear Reference Numbers
		this.addCommand({
			id: 'clear-reference-numbers',
			name: 'Clear reference numbers',
			callback: () => {
				this.promptClearReferenceNumbers();
			}
		});

		// Add command: Assign Lineage
		this.addCommand({
			id: 'assign-lineage',
			name: 'Assign lineage from root person',
			callback: () => {
				this.promptAssignLineage();
			}
		});

		// Add command: Remove Lineage
		this.addCommand({
			id: 'remove-lineage',
			name: 'Remove lineage tags',
			callback: () => {
				this.promptRemoveLineage();
			}
		});

		// Add command: View relationship history
		this.addCommand({
			id: 'view-relationship-history',
			name: 'View relationship history',
			callback: () => {
				this.showRelationshipHistory();
			}
		});

		// Add command: Undo last relationship change
		this.addCommand({
			id: 'undo-relationship-change',
			name: 'Undo last relationship change',
			callback: () => {
				void this.undoLastRelationshipChange();
			}
		});

		// Add command: Split Canvas Wizard
		this.addCommand({
			id: 'split-canvas-wizard',
			name: 'Split canvas wizard',
			callback: () => {
				new SplitWizardModal(this.app, this.settings, this.folderFilter ?? undefined).open();
			}
		});

		// Add command: Create Place Note
		this.addCommand({
			id: 'create-place-note',
			name: 'Create place note',
			callback: () => {
				new CreatePlaceModal(this.app, {
					directory: this.settings.placesFolder || '',
					familyGraph: this.createFamilyGraphService(),
					placeGraph: this.createPlaceGraphService(),
					settings: this.settings
				}).open();
			}
		});

		// Add command: Open Places Tab
		this.addCommand({
			id: 'open-places-tab',
			name: 'Open places tab',
			callback: () => {
				const modal = new ControlCenterModal(this.app, this);
				modal.openToTab('places');
			}
		});

		// Add command: Merge Duplicate Places
		this.addCommand({
			id: 'merge-duplicate-places',
			name: 'Merge duplicate place notes',
			callback: () => {
				const duplicateGroups = findDuplicatePlaceNotes(this.app, {
					settings: this.settings,
					folderFilter: this.folderFilter
				});
				if (duplicateGroups.length === 0) {
					new Notice('No duplicate place notes found. Your places are unique!');
					return;
				}
				new MergeDuplicatePlacesModal(this.app, duplicateGroups).open();
			}
		});

		// Add command: Open Schemas Tab
		this.addCommand({
			id: 'open-schemas-tab',
			name: 'Open schemas tab',
			callback: () => {
				const modal = new ControlCenterModal(this.app, this);
				modal.openToTab('schemas');
			}
		});

		// Add command: Validate Vault Against Schemas
		this.addCommand({
			id: 'validate-vault-schemas',
			name: 'Validate vault against schemas',
			callback: async () => {
				const schemaService = new SchemaService(this);
				const validationService = new ValidationService(this, schemaService);

				new Notice('Running schema validation...');

				try {
					const results = await validationService.validateVault();
					const summary = validationService.getSummary(results);

					const failedCount = new Set(results.filter(r => !r.isValid).map(r => r.filePath)).size;
					const passedCount = summary.totalPeopleValidated - failedCount;

					new Notice(`Schema validation: ${passedCount} passed, ${failedCount} failed, ${summary.totalErrors} errors`);

					// Open Control Center to Schemas tab to show full results
					const modal = new ControlCenterModal(this.app, this);
					modal.openToTab('schemas');
				} catch (error) {
					new Notice(`Schema validation failed: ${getErrorMessage(error)}`);
				}
			}
		});

		// Add command: Add Custom Relationship
		this.addCommand({
			id: 'add-custom-relationship',
			name: 'Add custom relationship to current person',
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile();

				if (!activeFile || activeFile.extension !== 'md') {
					new Notice('No active markdown file. Please open a person note first.');
					return;
				}

				// Check if the file has a cr_id (is a person note)
				const cache = this.app.metadataCache.getFileCache(activeFile);
				if (!cache?.frontmatter?.cr_id) {
					new Notice('Current file is not a person note (missing cr_id)');
					return;
				}

				new AddRelationshipModal(this.app, this, activeFile).open();
			}
		});

		// Add command: Insert Dynamic Blocks
		this.addCommand({
			id: 'insert-dynamic-blocks',
			name: 'Insert dynamic blocks in current person note',
			callback: async () => {
				const activeFile = this.app.workspace.getActiveFile();

				if (!activeFile || activeFile.extension !== 'md') {
					new Notice('No active markdown file. Please open a person note first.');
					return;
				}

				// Check if the file has a cr_id (is a person note)
				const cache = this.app.metadataCache.getFileCache(activeFile);
				if (!cache?.frontmatter?.cr_id) {
					new Notice('Current file is not a person note (missing cr_id)');
					return;
				}

				await this.insertDynamicBlocks([activeFile]);
			}
		});

		// Add command: Open Relationships Tab
		this.addCommand({
			id: 'open-relationships-tab',
			name: 'Open relationships tab',
			callback: () => {
				const modal = new ControlCenterModal(this.app, this);
				modal.openToTab('relationships');
			}
		});

		// Add command: Create Organization Note
		this.addCommand({
			id: 'create-organization-note',
			name: 'Create organization note',
			callback: async () => {
				const { CreateOrganizationModal } = await import('./src/organizations');
				new CreateOrganizationModal(this.app, this, () => {
					// Optionally open to organizations tab after creation
				}).open();
			}
		});

		// Add command: Open Organizations Tab
		this.addCommand({
			id: 'open-organizations-tab',
			name: 'Open organizations tab',
			callback: () => {
				const modal = new ControlCenterModal(this.app, this);
				modal.openToTab('organizations');
			}
		});

		// Add command: Create Source Note
		this.addCommand({
			id: 'create-source-note',
			name: 'Create source note',
			callback: async () => {
				const { CreateSourceModal } = await import('./src/sources');
				new CreateSourceModal(this.app, this, () => {
					// Optionally open to sources tab after creation
				}).open();
			}
		});

		// Add command: Open Sources Tab
		this.addCommand({
			id: 'open-sources-tab',
			name: 'Open sources tab',
			callback: () => {
				const modal = new ControlCenterModal(this.app, this);
				modal.openToTab('sources');
			}
		});

		// Add command: Generate Place Notes
		this.addCommand({
			id: 'generate-place-notes',
			name: 'Generate place notes from place strings',
			callback: async () => {
				const { PlaceGeneratorModal } = await import('./src/enhancement/ui/place-generator-modal');
				new PlaceGeneratorModal(this.app, this.settings).open();
			}
		});

		// Add context menu items for person notes, canvas files, and folders
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				// Only show submenus on desktop (mobile doesn't support them)
				const useSubmenu = Platform.isDesktop && !Platform.isMobile;

				// Canvas files: Regenerate canvas
				if (file instanceof TFile && file.extension === 'canvas') {
					menu.addSeparator();

					// Check if this is a timeline canvas (async check for context menu)
					const checkTimelineCanvas = async (): Promise<boolean> => {
						try {
							const content = await this.app.vault.read(file);
							const data = JSON.parse(content);
							return data.metadata?.frontmatter?.['canvas-roots']?.type === 'timeline-export';
						} catch {
							return false;
						}
					};

					if (useSubmenu) {
						menu.addItem((item) => {
							const submenu: Menu = item
								.setTitle('Canvas Roots')
								.setIcon('git-fork')
								.setSubmenu();

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Regenerate canvas')
									.setIcon('refresh-cw')
									.onClick(async () => {
										// Check if timeline or tree canvas
										const isTimeline = await checkTimelineCanvas();
										if (isTimeline) {
											// Regenerate timeline
											await this.regenerateTimelineCanvas(file);
										} else {
											// Open the canvas file first
											const leaf = this.app.workspace.getLeaf(false);
											await leaf.openFile(file);

											// Give canvas a moment to load
											await new Promise(resolve => setTimeout(resolve, 100));

											// Show options modal
											new RegenerateOptionsModal(this.app, this, file).open();
										}
									});
							});

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Show tree statistics')
									.setIcon('bar-chart')
									.onClick(() => {
										new TreeStatisticsModal(this.app, file).open();
									});
							});

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Customize canvas styles')
									.setIcon('layout')
									.onClick(async () => {
										// Check if timeline or tree canvas
										const isTimeline = await checkTimelineCanvas();
										if (isTimeline) {
											const { TimelineStyleModal } = await import('./src/events/ui/timeline-style-modal');
											new TimelineStyleModal(this.app, this, file).open();
										} else {
											const { CanvasStyleModal } = await import('./src/ui/canvas-style-modal');
											new CanvasStyleModal(this.app, this, file).open();
										}
									});
							});

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Open in family chart')
									.setIcon('git-fork')
									.onClick(async () => {
										await this.openCanvasInFamilyChart(file);
									});
							});

							// Export submenu (Excalidraw + images)
							submenu.addItem((subItem) => {
								const exportSubmenu: Menu = subItem
									.setTitle('Export')
									.setIcon('share')
									.setSubmenu();

								exportSubmenu.addItem((expItem) => {
									expItem
										.setTitle('Export to Excalidraw')
										.setIcon('pencil')
										.onClick(async () => {
											await this.exportCanvasToExcalidraw(file);
										});
								});

								exportSubmenu.addSeparator();

								exportSubmenu.addItem((expItem) => {
									expItem
										.setTitle('Export as PNG')
										.setIcon('image')
										.onClick(async () => {
											await this.exportCanvasAsImage(file, 'png');
										});
								});

								exportSubmenu.addItem((expItem) => {
									expItem
										.setTitle('Export as SVG')
										.setIcon('file-code')
										.onClick(async () => {
											await this.exportCanvasAsImage(file, 'svg');
										});
								});

								exportSubmenu.addItem((expItem) => {
									expItem
										.setTitle('Export as PDF')
										.setIcon('file-text')
										.onClick(async () => {
											await this.exportCanvasAsImage(file, 'pdf');
										});
								});
							});

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Split canvas wizard')
									.setIcon('layers')
									.onClick(() => {
										new SplitWizardModal(this.app, this.settings, this.folderFilter ?? undefined).open();
									});
							});

							submenu.addSeparator();

							submenu.addItem((subItem) => {
								subItem
									.setTitle('More options...')
									.setIcon('settings')
									.onClick(() => {
										const modal = new ControlCenterModal(this.app, this);
										modal.openToTab('tree-generation');
									});
							});
						});
					} else {
						// Mobile: flat menu with prefix
						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Regenerate canvas')
								.setIcon('refresh-cw')
								.onClick(async () => {
									// Check if timeline or tree canvas
									const isTimeline = await checkTimelineCanvas();
									if (isTimeline) {
										await this.regenerateTimelineCanvas(file);
									} else {
										const leaf = this.app.workspace.getLeaf(false);
										await leaf.openFile(file);
										await new Promise(resolve => setTimeout(resolve, 100));
										new RegenerateOptionsModal(this.app, this, file).open();
									}
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Show tree statistics')
								.setIcon('bar-chart')
								.onClick(() => {
									new TreeStatisticsModal(this.app, file).open();
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Customize canvas styles')
								.setIcon('layout')
								.onClick(async () => {
									// Check if timeline or tree canvas
									const isTimeline = await checkTimelineCanvas();
									if (isTimeline) {
										const { TimelineStyleModal } = await import('./src/events/ui/timeline-style-modal');
										new TimelineStyleModal(this.app, this, file).open();
									} else {
										const { CanvasStyleModal } = await import('./src/ui/canvas-style-modal');
										new CanvasStyleModal(this.app, this, file).open();
									}
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Open in family chart')
								.setIcon('git-fork')
								.onClick(async () => {
									await this.openCanvasInFamilyChart(file);
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Export to Excalidraw')
								.setIcon('pencil')
								.onClick(async () => {
									await this.exportCanvasToExcalidraw(file);
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Export as PNG')
								.setIcon('image')
								.onClick(async () => {
									await this.exportCanvasAsImage(file, 'png');
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Export as SVG')
								.setIcon('file-code')
								.onClick(async () => {
									await this.exportCanvasAsImage(file, 'svg');
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Export as PDF')
								.setIcon('file-text')
								.onClick(async () => {
									await this.exportCanvasAsImage(file, 'pdf');
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Split canvas wizard')
								.setIcon('layers')
								.onClick(() => {
									new SplitWizardModal(this.app, this.settings, this.folderFilter ?? undefined).open();
								});
						});
					}
				}

				// Markdown files: Person notes, Place notes, Source notes, Map notes, Schema notes, or plain notes
				if (file instanceof TFile && file.extension === 'md') {
					const cache = this.app.metadataCache.getFileCache(file);
					const fm = cache?.frontmatter;
					const hasCrId = !!fm?.cr_id;

					// Use centralized note type detection (supports cr_type, type, and tags)
					const detectionSettings = this.settings.noteTypeDetection;
					const isPlace = isPlaceNote(fm, cache, detectionSettings);
					const isSource = isSourceNote(fm, cache, detectionSettings);
					const isMap = isMapNote(fm, cache, detectionSettings);
					const isSchema = isSchemaNote(fm, cache, detectionSettings);
					const isEvent = isEventNote(fm, cache, detectionSettings);

					// Also check if file is in maps folder (for notes not yet typed as map)
					const mapsFolder = this.settings.mapsFolder;
					const isInMapsFolder = mapsFolder && file.path.startsWith(mapsFolder + '/');

					// Schema notes get schema-specific options
					if (isSchema) {
						menu.addSeparator();

						const schemaName = fm?.name || file.basename;

						if (useSubmenu) {
							menu.addItem((item) => {
								const submenu: Menu = item
									.setTitle('Canvas Roots')
									.setIcon('clipboard-check')
									.setSubmenu();

								submenu.addItem((subItem) => {
									subItem
										.setTitle('Edit schema')
										.setIcon('edit')
										.onClick(() => {
											const modal = new ControlCenterModal(this.app, this);
											modal.openToTab('schemas');
											// Note: The actual editing would require passing the schema to the modal
										});
								});

								submenu.addItem((subItem) => {
									subItem
										.setTitle('Validate matching notes')
										.setIcon('play')
										.onClick(async () => {
											const schemaService = new SchemaService(this);
											const validationService = new ValidationService(this, schemaService);

											new Notice(`Validating notes against "${schemaName}"...`);

											try {
												const results = await validationService.validateVault();
												// Filter results to only this schema
												const schemaCrId = cache?.frontmatter?.cr_id;
												const schemaResults = results.filter(r => r.schemaCrId === schemaCrId);

												if (schemaResults.length === 0) {
													new Notice(`No notes match schema "${schemaName}"`);
												} else {
													const errors = schemaResults.filter(r => !r.isValid).length;
													new Notice(`Validated ${schemaResults.length} notes: ${schemaResults.length - errors} passed, ${errors} failed`);
												}
											} catch (error) {
												new Notice(`Validation failed: ${getErrorMessage(error)}`);
											}
										});
								});

								submenu.addItem((subItem) => {
									subItem
										.setTitle('Open schemas tab')
										.setIcon('external-link')
										.onClick(() => {
											const modal = new ControlCenterModal(this.app, this);
											modal.openToTab('schemas');
										});
								});
							});
						} else {
							// Mobile: flat menu for schema notes
							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Open schemas tab')
									.setIcon('clipboard-check')
									.onClick(() => {
										const modal = new ControlCenterModal(this.app, this);
										modal.openToTab('schemas');
									});
							});
						}
					}
					// Map notes get map-specific options (open map view with this map selected)
					// Also show for files in maps folder that aren't yet typed as map
					else if (isMap || isInMapsFolder) {
						menu.addSeparator();

						const mapId = fm?.map_id;
						const mapName = fm?.name || file.basename;

						if (useSubmenu) {
							menu.addItem((item) => {
								const submenu: Menu = item
									.setTitle('Canvas Roots')
									.setIcon('map')
									.setSubmenu();

								submenu.addItem((subItem) => {
									subItem
										.setTitle(`Open "${mapName}" in map view`)
										.setIcon('map')
										.onClick(async () => {
											await this.activateMapView(mapId);
										});
								});

								submenu.addItem((subItem) => {
									subItem
										.setTitle('Edit map')
										.setIcon('edit')
										.onClick(async () => {
											const { CreateMapModal } = await import('./src/ui/create-map-modal');
											new CreateMapModal(this.app, {
												editFile: file,
												editFrontmatter: fm || {},
												propertyAliases: this.settings.propertyAliases
											}).open();
										});
								});

								submenu.addSeparator();

								submenu.addItem((subItem) => {
									subItem
										.setTitle('Add essential map properties')
										.setIcon('globe')
										.onClick(async () => {
											await this.addEssentialMapProperties([file]);
										});
								});

								// Add cr_id only
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Add cr_id')
										.setIcon('key')
										.onClick(async () => {
											await this.addCrId([file]);
										});
								});
							});
						} else {
							// Mobile: flat menu for map notes
							menu.addItem((item) => {
								item
									.setTitle(`Canvas Roots: Open "${mapName}" in map view`)
									.setIcon('map')
									.onClick(async () => {
										await this.activateMapView(mapId);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Edit map')
									.setIcon('edit')
									.onClick(async () => {
										const { CreateMapModal } = await import('./src/ui/create-map-modal');
										new CreateMapModal(this.app, {
											editFile: file,
											editFrontmatter: fm || {},
											propertyAliases: this.settings.propertyAliases
										}).open();
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential map properties')
									.setIcon('globe')
									.onClick(async () => {
										await this.addEssentialMapProperties([file]);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add cr_id')
									.setIcon('key')
									.onClick(async () => {
										await this.addCrId([file]);
									});
							});
						}
					}
					// Place notes with cr_id get place-specific options
					else if (hasCrId && isPlace) {
						menu.addSeparator();

						if (useSubmenu) {
							menu.addItem((item) => {
								const submenu: Menu = item
									.setTitle('Canvas Roots')
									.setIcon('map-pin')
									.setSubmenu();

								// Set collection
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Set collection')
										.setIcon('folder')
										.onClick(async () => {
											await this.promptSetCollection(file);
										});
								});

								// Open in map view
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Open in map view')
										.setIcon('map')
										.onClick(async () => {
											await this.activateMapView();
										});
								});

								// Edit place
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Edit place')
										.setIcon('edit')
										.onClick(() => {
											this.openEditPlaceModal(file);
										});
								});

								// Geocode place
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Geocode place')
										.setIcon('map-pin')
										.onClick(async () => {
											await this.geocodeSinglePlace(file);
										});
								});

								submenu.addSeparator();

								// Add essential properties submenu
								submenu.addItem((subItem) => {
									const propsSubmenu: Menu = subItem
										.setTitle('Add essential properties')
										.setIcon('file-plus')
										.setSubmenu();

									propsSubmenu.addItem((propItem) => {
										propItem
											.setTitle('Add essential person properties')
											.setIcon('user')
											.onClick(async () => {
												await this.addEssentialPersonProperties([file]);
											});
									});

									propsSubmenu.addItem((propItem) => {
										propItem
											.setTitle('Add essential place properties')
											.setIcon('map-pin')
											.onClick(async () => {
												await this.addEssentialPlaceProperties([file]);
											});
									});

									propsSubmenu.addItem((propItem) => {
										propItem
											.setTitle('Add essential source properties')
											.setIcon('archive')
											.onClick(async () => {
												await this.addEssentialSourceProperties([file]);
											});
									});
								});

								// Add cr_id only
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Add cr_id')
										.setIcon('key')
										.onClick(async () => {
											await this.addCrId([file]);
										});
								});
							});
						} else {
							// Mobile: flat menu for place notes
							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Set collection')
									.setIcon('folder')
									.onClick(async () => {
										await this.promptSetCollection(file);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Open in map view')
									.setIcon('map')
									.onClick(async () => {
										await this.activateMapView();
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Edit place')
									.setIcon('edit')
									.onClick(() => {
										this.openEditPlaceModal(file);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Geocode place')
									.setIcon('map-pin')
									.onClick(async () => {
										await this.geocodeSinglePlace(file);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential person properties')
									.setIcon('user')
									.onClick(async () => {
										await this.addEssentialPersonProperties([file]);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential place properties')
									.setIcon('map-pin')
									.onClick(async () => {
										await this.addEssentialPlaceProperties([file]);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential source properties')
									.setIcon('archive')
									.onClick(async () => {
										await this.addEssentialSourceProperties([file]);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add cr_id')
									.setIcon('key')
									.onClick(async () => {
										await this.addCrId([file]);
									});
							});
						}
					}
					// Source notes with cr_id get source-specific options
					else if (hasCrId && isSource) {
						menu.addSeparator();

						if (useSubmenu) {
							menu.addItem((item) => {
								const submenu: Menu = item
									.setTitle('Canvas Roots')
									.setIcon('archive')
									.setSubmenu();

								// Edit source
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Edit source')
										.setIcon('edit')
										.onClick(() => {
											this.openEditSourceModal(file);
										});
								});

								// Generate citation
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Generate citation')
										.setIcon('quote')
										.onClick(() => {
											this.openCitationGenerator(file);
										});
								});

								// Open in Sources tab
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Open sources tab')
										.setIcon('archive')
										.onClick(() => {
											const modal = new ControlCenterModal(this.app, this);
											modal.openToTab('sources');
										});
								});

								submenu.addSeparator();

								// Add essential properties submenu
								submenu.addItem((subItem) => {
									const propsSubmenu: Menu = subItem
										.setTitle('Add essential properties')
										.setIcon('file-plus')
										.setSubmenu();

									propsSubmenu.addItem((propItem) => {
										propItem
											.setTitle('Add essential person properties')
											.setIcon('user')
											.onClick(async () => {
												await this.addEssentialPersonProperties([file]);
											});
									});

									propsSubmenu.addItem((propItem) => {
										propItem
											.setTitle('Add essential place properties')
											.setIcon('map-pin')
											.onClick(async () => {
												await this.addEssentialPlaceProperties([file]);
											});
									});

									propsSubmenu.addItem((propItem) => {
										propItem
											.setTitle('Add essential source properties')
											.setIcon('archive')
											.onClick(async () => {
												await this.addEssentialSourceProperties([file]);
											});
									});
								});

								// Add cr_id only
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Add cr_id')
										.setIcon('key')
										.onClick(async () => {
											await this.addCrId([file]);
										});
								});
							});
						} else {
							// Mobile: flat menu for source notes
							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Edit source')
									.setIcon('edit')
									.onClick(() => {
										this.openEditSourceModal(file);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Generate citation')
									.setIcon('quote')
									.onClick(() => {
										this.openCitationGenerator(file);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Open sources tab')
									.setIcon('archive')
									.onClick(() => {
										const modal = new ControlCenterModal(this.app, this);
										modal.openToTab('sources');
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential person properties')
									.setIcon('user')
									.onClick(async () => {
										await this.addEssentialPersonProperties([file]);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential place properties')
									.setIcon('map-pin')
									.onClick(async () => {
										await this.addEssentialPlaceProperties([file]);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential source properties')
									.setIcon('archive')
									.onClick(async () => {
										await this.addEssentialSourceProperties([file]);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add cr_id')
									.setIcon('key')
									.onClick(async () => {
										await this.addCrId([file]);
									});
							});
						}
					}
					// Person notes with cr_id get full person options
					else if (hasCrId && !isPlace && !isSource && !isEvent) {
						menu.addSeparator();

						if (useSubmenu) {
							menu.addItem((item) => {
								const submenu: Menu = item
									.setTitle('Canvas Roots')
									.setIcon('git-fork')
									.setSubmenu();

								// Generate tree submenu
								submenu.addItem((subItem) => {
									const generateTreeSubmenu: Menu = subItem
										.setTitle('Generate tree')
										.setIcon('git-fork')
										.setSubmenu();

									// Open in family chart (interactive view, no file created)
									generateTreeSubmenu.addItem((genItem) => {
										genItem
											.setTitle('Open in family chart')
											.setIcon('git-fork')
											.onClick(async () => {
												// Try cache first, fall back to reading file directly
												let crId = this.app.metadataCache.getFileCache(file)?.frontmatter?.cr_id;
												if (!crId) {
													// Fallback: read frontmatter directly from file
													const content = await this.app.vault.read(file);
													const match = content.match(/^cr_id:\s*["']?([^"'\n]+)["']?\s*$/m);
													crId = match?.[1];
												}
												if (crId) {
													await this.activateFamilyChartView(crId);
												} else {
													new Notice('Could not find cr_id for this person note');
												}
											});
									});

									generateTreeSubmenu.addSeparator();

									generateTreeSubmenu.addItem((genItem) => {
										genItem
											.setTitle('Generate Canvas tree')
											.setIcon('layout')
											.onClick(() => {
												const modal = new ControlCenterModal(this.app, this);
												modal.openWithPerson(file);
											});
									});

									generateTreeSubmenu.addItem((genItem) => {
										genItem
											.setTitle('Generate Excalidraw tree')
											.setIcon('pencil')
											.onClick(async () => {
												await this.generateExcalidrawTreeForPerson(file);
											});
									});
								});

								submenu.addItem((subItem) => {
									subItem
										.setTitle('More options...')
										.setIcon('settings')
										.onClick(() => {
											const modal = new ControlCenterModal(this.app, this);
											modal.openWithPerson(file);
										});
								});

								// Edit person
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Edit person')
										.setIcon('edit')
										.onClick(() => {
											this.openEditPersonModal(file);
										});
								});

								submenu.addSeparator();

								// Add relationship submenu
								submenu.addItem((subItem) => {
									const relationshipSubmenu: Menu = subItem
										.setTitle('Add relationship...')
										.setIcon('user-plus')
										.setSubmenu();

									relationshipSubmenu.addItem((relItem) => {
										relItem
											.setTitle('Add parent')
											.setIcon('user')
											.onClick(() => {
												const picker = new PersonPickerModal(this.app, (selectedPerson) => {
													void (async () => {
														const relationshipMgr = new RelationshipManager(this.app, this.relationshipHistory);

														// Ask which parent type
														const parentType = await this.promptParentType();
														if (parentType) {
															await relationshipMgr.addParentRelationship(
																file,
																selectedPerson.file,
																parentType
															);
														}
													})();
												});
												picker.open();
											});
									});

									relationshipSubmenu.addItem((relItem) => {
										relItem
											.setTitle('Add spouse')
											.setIcon('heart')
											.onClick(() => {
												const picker = new PersonPickerModal(this.app, (selectedPerson) => {
													void (async () => {
														const relationshipMgr = new RelationshipManager(this.app, this.relationshipHistory);
														await relationshipMgr.addSpouseRelationship(file, selectedPerson.file);
													})();
												});
												picker.open();
											});
									});

									relationshipSubmenu.addItem((relItem) => {
										relItem
											.setTitle('Add child')
											.setIcon('baby')
											.onClick(() => {
												const picker = new PersonPickerModal(this.app, (selectedPerson) => {
													void (async () => {
														const relationshipMgr = new RelationshipManager(this.app, this.relationshipHistory);
														await relationshipMgr.addChildRelationship(file, selectedPerson.file);
													})();
												});
												picker.open();
											});
									});

									relationshipSubmenu.addSeparator();

									relationshipSubmenu.addItem((relItem) => {
										relItem
											.setTitle('Add custom relationship...')
											.setIcon('link-2')
											.onClick(() => {
												new AddRelationshipModal(this.app, this, file).open();
											});
									});

									relationshipSubmenu.addItem((relItem) => {
										relItem
											.setTitle('Add organization membership...')
											.setIcon('building')
											.onClick(async () => {
												const { AddMembershipModal } = await import('./src/organizations/ui/add-membership-modal');
												new AddMembershipModal(this.app, this, file, () => {
													new Notice('Membership added');
												}).open();
											});
									});
								});

								// Validate relationships
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Validate relationships')
										.setIcon('shield-check')
										.onClick(async () => {
											const validator = new RelationshipValidator(this.app);
											if (this.folderFilter) {
												validator.setFolderFilter(this.folderFilter);
											}
											const result = await validator.validatePersonNote(file);
											new ValidationResultsModal(this.app, result).open();
										});
								});

								// Validate against schemas
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Validate against schemas')
										.setIcon('clipboard-check')
										.onClick(async () => {
											const schemaService = new SchemaService(this);
											const validationService = new ValidationService(this, schemaService);

											const results = await validationService.validatePerson(file);

											if (results.length === 0) {
												new Notice('No schemas apply to this person.');
												return;
											}

											const errors = results.reduce((sum, r) => sum + r.errors.length, 0);
											const warnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

											if (errors === 0 && warnings === 0) {
												new Notice(`✓ Validated against ${results.length} schema${results.length > 1 ? 's' : ''} - all passed`);
											} else {
												new Notice(`Schema validation: ${errors} error${errors !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''}`);
												// Open schemas tab to show details
												const modal = new ControlCenterModal(this.app, this);
												modal.openToTab('schemas');
											}
										});
								});

								// Find on canvas
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Find on canvas')
										.setIcon('search')
										.onClick(() => {
											const cache = this.app.metadataCache.getFileCache(file);
											const crId = cache?.frontmatter?.cr_id;
											const personName = cache?.frontmatter?.name || file.basename;
											if (crId) {
												new FindOnCanvasModal(this.app, personName, crId).open();
											}
										});
								});

								// Open in map view
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Open in map view')
										.setIcon('map')
										.onClick(async () => {
											await this.activateMapView();
										});
								});

								// Calculate relationship
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Calculate relationship...')
										.setIcon('git-compare')
										.onClick(() => {
											const cache = this.app.metadataCache.getFileCache(file);
											const crId = cache?.frontmatter?.cr_id;
											const personName = cache?.frontmatter?.name || file.basename;
											if (crId) {
												const modal = new RelationshipCalculatorModal(this.app);
												modal.openWithPersonA({
													name: personName,
													crId: crId,
													birthDate: cache?.frontmatter?.born,
													deathDate: cache?.frontmatter?.died,
													sex: cache?.frontmatter?.sex || cache?.frontmatter?.gender,
													file: file
												});
											}
										});
								});

								// Set group name
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Set group name')
										.setIcon('tag')
										.onClick(async () => {
											await this.promptSetCollectionName(file);
										});
								});

								// Set collection
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Set collection')
										.setIcon('folder')
										.onClick(async () => {
											await this.promptSetCollection(file);
										});
								});

								// Add source
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Add source...')
										.setIcon('archive')
										.onClick(() => {
											this.addSourceToPersonNote(file);
										});
								});

								// Insert dynamic blocks
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Insert dynamic blocks')
										.setIcon('layout-template')
										.onClick(async () => {
											await this.insertDynamicBlocks([file]);
										});
								});

								// Events submenu
								submenu.addItem((subItem) => {
									const eventsSubmenu: Menu = subItem
										.setTitle('Events')
										.setIcon('calendar')
										.setSubmenu();

									eventsSubmenu.addItem((evItem) => {
										evItem
											.setTitle('Create event for this person')
											.setIcon('calendar-plus')
											.onClick(async () => {
												const eventService = this.getEventService();
												if (eventService) {
													const cache = this.app.metadataCache.getFileCache(file);
													const personName = cache?.frontmatter?.name || file.basename;
													const crId = cache?.frontmatter?.cr_id;
													const { CreateEventModal } = await import('./src/events/ui/create-event-modal');
													new CreateEventModal(
														this.app,
														eventService,
														this.settings,
														{
															initialPerson: { name: personName, crId: crId }
														}
													).open();
												}
											});
									});

									eventsSubmenu.addItem((evItem) => {
										evItem
											.setTitle('Export timeline to Canvas')
											.setIcon('layout')
											.onClick(async () => {
												await this.exportPersonTimelineFromFile(file, 'canvas');
											});
									});

									eventsSubmenu.addItem((evItem) => {
										evItem
											.setTitle('Export timeline to Excalidraw')
											.setIcon('pencil')
											.onClick(async () => {
												await this.exportPersonTimelineFromFile(file, 'excalidraw');
											});
									});
								});

								// Mark as root person
								submenu.addItem((subItem) => {
									const cache = this.app.metadataCache.getFileCache(file);
									const isRootPerson = cache?.frontmatter?.root_person === true;
									subItem
										.setTitle(isRootPerson ? 'Unmark as root person' : 'Mark as root person')
										.setIcon('crown')
										.onClick(async () => {
											await this.toggleRootPerson(file);
										});
								});

								// Reference numbering submenu
								submenu.addItem((subItem) => {
									const refNumberSubmenu: Menu = subItem
										.setTitle('Assign reference numbers')
										.setIcon('hash')
										.setSubmenu();

									refNumberSubmenu.addItem((numItem) => {
										numItem
											.setTitle('Ahnentafel (ancestors)')
											.setIcon('arrow-up')
											.onClick(async () => {
												await this.assignReferenceNumbersFromPerson(file, 'ahnentafel');
											});
									});

									refNumberSubmenu.addItem((numItem) => {
										numItem
											.setTitle("d'Aboville (descendants)")
											.setIcon('arrow-down')
											.onClick(async () => {
												await this.assignReferenceNumbersFromPerson(file, 'daboville');
											});
									});

									refNumberSubmenu.addItem((numItem) => {
										numItem
											.setTitle('Henry (descendants)')
											.setIcon('arrow-down')
											.onClick(async () => {
												await this.assignReferenceNumbersFromPerson(file, 'henry');
											});
									});

									refNumberSubmenu.addItem((numItem) => {
										numItem
											.setTitle('Generation (all relatives)')
											.setIcon('users')
											.onClick(async () => {
												await this.assignReferenceNumbersFromPerson(file, 'generation');
											});
									});
								});

								// Lineage tracking submenu
								submenu.addItem((subItem) => {
									const lineageSubmenu: Menu = subItem
										.setTitle('Assign lineage')
										.setIcon('git-branch')
										.setSubmenu();

									lineageSubmenu.addItem((linItem) => {
										linItem
											.setTitle('All descendants')
											.setIcon('users')
											.onClick(async () => {
												await this.assignLineageFromPerson(file, 'all');
											});
									});

									lineageSubmenu.addItem((linItem) => {
										linItem
											.setTitle('Patrilineal (father\'s line)')
											.setIcon('arrow-down')
											.onClick(async () => {
												await this.assignLineageFromPerson(file, 'patrilineal');
											});
									});

									lineageSubmenu.addItem((linItem) => {
										linItem
											.setTitle('Matrilineal (mother\'s line)')
											.setIcon('arrow-down')
											.onClick(async () => {
												await this.assignLineageFromPerson(file, 'matrilineal');
											});
									});
								});

								submenu.addSeparator();

								// Create place notes from references
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Create place notes...')
										.setIcon('map-pin')
										.onClick(async () => {
											await this.showCreatePlaceNotesForPerson(file);
										});
								});

								// Add essential properties submenu
								submenu.addItem((subItem) => {
									const propsSubmenu: Menu = subItem
										.setTitle('Add essential properties')
										.setIcon('file-plus')
										.setSubmenu();

									propsSubmenu.addItem((propItem) => {
										propItem
											.setTitle('Add essential person properties')
											.setIcon('user')
											.onClick(async () => {
												await this.addEssentialPersonProperties([file]);
											});
									});

									propsSubmenu.addItem((propItem) => {
										propItem
											.setTitle('Add essential place properties')
											.setIcon('map-pin')
											.onClick(async () => {
												await this.addEssentialPlaceProperties([file]);
											});
									});

									propsSubmenu.addItem((propItem) => {
										propItem
											.setTitle('Add essential source properties')
											.setIcon('archive')
											.onClick(async () => {
												await this.addEssentialSourceProperties([file]);
											});
									});
								});

								// Add cr_id only
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Add cr_id')
										.setIcon('key')
										.onClick(async () => {
											await this.addCrId([file]);
										});
								});
							});
						} else {
							// Mobile: flat menu with prefix
							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Generate family tree')
									.setIcon('git-fork')
									.onClick(() => {
										const modal = new ControlCenterModal(this.app, this);
										modal.openWithPerson(file);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Edit person')
									.setIcon('edit')
									.onClick(() => {
										this.openEditPersonModal(file);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add parent')
									.setIcon('user')
									.onClick(() => {
										const picker = new PersonPickerModal(this.app, (selectedPerson) => {
											void (async () => {
												const relationshipMgr = new RelationshipManager(this.app, this.relationshipHistory);
												const parentType = await this.promptParentType();
												if (parentType) {
													await relationshipMgr.addParentRelationship(
														file,
														selectedPerson.file,
														parentType
													);
												}
											})();
										});
										picker.open();
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add spouse')
									.setIcon('heart')
									.onClick(() => {
										const picker = new PersonPickerModal(this.app, (selectedPerson) => {
											void (async () => {
												const relationshipMgr = new RelationshipManager(this.app, this.relationshipHistory);
												await relationshipMgr.addSpouseRelationship(file, selectedPerson.file);
											})();
										});
										picker.open();
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add child')
									.setIcon('baby')
									.onClick(() => {
										const picker = new PersonPickerModal(this.app, (selectedPerson) => {
											void (async () => {
												const relationshipMgr = new RelationshipManager(this.app, this.relationshipHistory);
												await relationshipMgr.addChildRelationship(file, selectedPerson.file);
											})();
										});
										picker.open();
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Validate relationships')
									.setIcon('shield-check')
									.onClick(async () => {
										const validator = new RelationshipValidator(this.app);
										if (this.folderFilter) {
											validator.setFolderFilter(this.folderFilter);
										}
										const result = await validator.validatePersonNote(file);
										new ValidationResultsModal(this.app, result).open();
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Find on canvas')
									.setIcon('search')
									.onClick(() => {
										const cache = this.app.metadataCache.getFileCache(file);
										const crId = cache?.frontmatter?.cr_id;
										const personName = cache?.frontmatter?.name || file.basename;
										if (crId) {
											new FindOnCanvasModal(this.app, personName, crId).open();
										}
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Open in map view')
									.setIcon('map')
									.onClick(async () => {
										await this.activateMapView();
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Open in family chart')
									.setIcon('git-fork')
									.onClick(async () => {
										const cache = this.app.metadataCache.getFileCache(file);
										const crId = cache?.frontmatter?.cr_id;
										if (crId) {
											await this.activateFamilyChartView(crId);
										} else {
											new Notice('Could not find cr_id for this person note');
										}
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Calculate relationship...')
									.setIcon('git-compare')
									.onClick(() => {
										const cache = this.app.metadataCache.getFileCache(file);
										const crId = cache?.frontmatter?.cr_id;
										const personName = cache?.frontmatter?.name || file.basename;
										if (crId) {
											const modal = new RelationshipCalculatorModal(this.app);
											modal.openWithPersonA({
												name: personName,
												crId: crId,
												birthDate: cache?.frontmatter?.born,
												deathDate: cache?.frontmatter?.died,
												sex: cache?.frontmatter?.sex || cache?.frontmatter?.gender,
												file: file
											});
										}
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Set group name')
									.setIcon('tag')
									.onClick(async () => {
										await this.promptSetCollectionName(file);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Set collection')
									.setIcon('folder')
									.onClick(async () => {
										await this.promptSetCollection(file);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add source...')
									.setIcon('archive')
									.onClick(() => {
										this.addSourceToPersonNote(file);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Insert dynamic blocks')
									.setIcon('layout-template')
									.onClick(async () => {
										await this.insertDynamicBlocks([file]);
									});
							});

							// Events actions (mobile - flat menu)
							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Create event')
									.setIcon('calendar-plus')
									.onClick(async () => {
										const eventService = this.getEventService();
										if (eventService) {
											const cache = this.app.metadataCache.getFileCache(file);
											const personName = cache?.frontmatter?.name || file.basename;
											const crId = cache?.frontmatter?.cr_id;
											const { CreateEventModal } = await import('./src/events/ui/create-event-modal');
											new CreateEventModal(
												this.app,
												eventService,
												this.settings,
												{
													initialPerson: { name: personName, crId: crId }
												}
											).open();
										}
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Export timeline to Canvas')
									.setIcon('layout')
									.onClick(async () => {
										await this.exportPersonTimelineFromFile(file, 'canvas');
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Export timeline to Excalidraw')
									.setIcon('pencil')
									.onClick(async () => {
										await this.exportPersonTimelineFromFile(file, 'excalidraw');
									});
							});

							menu.addItem((item) => {
								const cache = this.app.metadataCache.getFileCache(file);
								const isRootPerson = cache?.frontmatter?.root_person === true;
								item
									.setTitle(isRootPerson ? 'Canvas Roots: Unmark as root person' : 'Canvas Roots: Mark as root person')
									.setIcon('crown')
									.onClick(async () => {
										await this.toggleRootPerson(file);
									});
							});

							// Reference numbering (mobile - flat menu)
							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Assign Ahnentafel numbers')
									.setIcon('hash')
									.onClick(async () => {
										await this.assignReferenceNumbersFromPerson(file, 'ahnentafel');
									});
							});

							menu.addItem((item) => {
								item
									.setTitle("Canvas Roots: Assign d'Aboville numbers")
									.setIcon('hash')
									.onClick(async () => {
										await this.assignReferenceNumbersFromPerson(file, 'daboville');
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Assign Henry numbers')
									.setIcon('hash')
									.onClick(async () => {
										await this.assignReferenceNumbersFromPerson(file, 'henry');
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Assign generation numbers')
									.setIcon('hash')
									.onClick(async () => {
										await this.assignReferenceNumbersFromPerson(file, 'generation');
									});
							});

							// Lineage tracking (mobile - flat menu)
							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Assign lineage (all)')
									.setIcon('git-branch')
									.onClick(async () => {
										await this.assignLineageFromPerson(file, 'all');
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Assign lineage (patrilineal)')
									.setIcon('git-branch')
									.onClick(async () => {
										await this.assignLineageFromPerson(file, 'patrilineal');
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Assign lineage (matrilineal)')
									.setIcon('git-branch')
									.onClick(async () => {
										await this.assignLineageFromPerson(file, 'matrilineal');
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Create place notes...')
									.setIcon('map-pin')
									.onClick(async () => {
										await this.showCreatePlaceNotesForPerson(file);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential person properties')
									.setIcon('user')
									.onClick(async () => {
										await this.addEssentialPersonProperties([file]);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential place properties')
									.setIcon('map-pin')
									.onClick(async () => {
										await this.addEssentialPlaceProperties([file]);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential source properties')
									.setIcon('archive')
									.onClick(async () => {
										await this.addEssentialSourceProperties([file]);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add cr_id')
									.setIcon('key')
									.onClick(async () => {
										await this.addCrId([file]);
									});
							});
						}
					}
					// Event notes with cr_id get event-specific options
					else if (hasCrId && isEvent) {
						menu.addSeparator();

						if (useSubmenu) {
							menu.addItem((item) => {
								const submenu: Menu = item
									.setTitle('Canvas Roots')
									.setIcon('calendar')
									.setSubmenu();

								// Open event
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Open event')
										.setIcon('file')
										.onClick(() => {
											void this.app.workspace.getLeaf(false).openFile(file);
										});
								});

								// Open in new tab
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Open in new tab')
										.setIcon('file-plus')
										.onClick(() => {
											void this.app.workspace.getLeaf('tab').openFile(file);
										});
								});

								// Edit event
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Edit event')
										.setIcon('edit')
										.onClick(() => {
											this.openEditEventModal(file);
										});
								});

								submenu.addSeparator();

								// Add essential event properties
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Add essential event properties')
										.setIcon('file-plus')
										.onClick(async () => {
											await this.addEssentialEventProperties([file]);
										});
								});

								// Add cr_id only
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Add cr_id')
										.setIcon('key')
										.onClick(async () => {
											await this.addCrId([file]);
										});
								});

								submenu.addSeparator();

								// Delete event
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Delete event')
										.setIcon('trash')
										.onClick(async () => {
											const eventTitle = cache?.frontmatter?.title || file.basename;
											const confirmed = await this.confirmDeleteEvent(eventTitle);
											if (confirmed) {
												await this.app.fileManager.trashFile(file);
												new Notice(`Deleted event: ${eventTitle}`);
											}
										});
								});
							});
						} else {
							// Mobile: flat menu
							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Open event')
									.setIcon('file')
									.onClick(() => {
										void this.app.workspace.getLeaf(false).openFile(file);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Open in new tab')
									.setIcon('file-plus')
									.onClick(() => {
										void this.app.workspace.getLeaf('tab').openFile(file);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Edit event')
									.setIcon('edit')
									.onClick(() => {
										this.openEditEventModal(file);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential event properties')
									.setIcon('file-plus')
									.onClick(async () => {
										await this.addEssentialEventProperties([file]);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add cr_id')
									.setIcon('key')
									.onClick(async () => {
										await this.addCrId([file]);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Delete event')
									.setIcon('trash')
									.onClick(async () => {
										const eventTitle = cache?.frontmatter?.title || file.basename;
										const confirmed = await this.confirmDeleteEvent(eventTitle);
										if (confirmed) {
											await this.app.fileManager.trashFile(file);
											new Notice(`Deleted event: ${eventTitle}`);
										}
									});
							});
						}
					}
					// Notes without cr_id still get "Add essential properties" option
					else if (!hasCrId) {
						menu.addSeparator();

						if (useSubmenu) {
							menu.addItem((item) => {
								const submenu: Menu = item
									.setTitle('Canvas Roots')
									.setIcon('git-fork')
									.setSubmenu();

								// Add essential properties submenu
								submenu.addItem((subItem) => {
									const propsSubmenu: Menu = subItem
										.setTitle('Add essential properties')
										.setIcon('file-plus')
										.setSubmenu();

									propsSubmenu.addItem((propItem) => {
										propItem
											.setTitle('Add essential person properties')
											.setIcon('user')
											.onClick(async () => {
												await this.addEssentialPersonProperties([file]);
											});
									});

									propsSubmenu.addItem((propItem) => {
										propItem
											.setTitle('Add essential place properties')
											.setIcon('map-pin')
											.onClick(async () => {
												await this.addEssentialPlaceProperties([file]);
											});
									});

									propsSubmenu.addItem((propItem) => {
										propItem
											.setTitle('Add essential source properties')
											.setIcon('archive')
											.onClick(async () => {
												await this.addEssentialSourceProperties([file]);
											});
									});

									propsSubmenu.addItem((propItem) => {
										propItem
											.setTitle('Add essential event properties')
											.setIcon('calendar')
											.onClick(async () => {
												await this.addEssentialEventProperties([file]);
											});
									});
								});

								// Add cr_id only
								submenu.addItem((subItem) => {
									subItem
										.setTitle('Add cr_id')
										.setIcon('key')
										.onClick(async () => {
											await this.addCrId([file]);
										});
								});
							});
						} else {
							// Mobile: flat menu
							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential person properties')
									.setIcon('user')
									.onClick(async () => {
										await this.addEssentialPersonProperties([file]);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential place properties')
									.setIcon('map-pin')
									.onClick(async () => {
										await this.addEssentialPlaceProperties([file]);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential source properties')
									.setIcon('archive')
									.onClick(async () => {
										await this.addEssentialSourceProperties([file]);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add essential event properties')
									.setIcon('calendar')
									.onClick(async () => {
										await this.addEssentialEventProperties([file]);
									});
							});

							menu.addItem((item) => {
								item
									.setTitle('Canvas Roots: Add cr_id')
									.setIcon('key')
									.onClick(async () => {
										await this.addCrId([file]);
									});
							});
						}
					}
				}

				// Folders: Set as people folder
				if (file instanceof TFolder) {
					menu.addSeparator();

					if (useSubmenu) {
						menu.addItem((item) => {
							const submenu: Menu = item
								.setTitle('Canvas Roots')
								.setIcon('git-fork')
								.setSubmenu();

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Set as people folder')
									.setIcon('users')
									.onClick(async () => {
										this.settings.peopleFolder = file.path;
										await this.saveSettings();
										new Notice(`People folder set to: ${file.path}`);
									});
							});

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Import GEDCOM to this folder')
									.setIcon('upload')
									.onClick(async () => {
										// Set this folder as the people folder
										this.settings.peopleFolder = file.path;
										await this.saveSettings();

										// Open Control Center to GEDCOM tab
										const modal = new ControlCenterModal(this.app, this);
										modal.openToTab('gedcom');
									});
							});

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Export GEDCOM from this folder')
									.setIcon('download')
									.onClick(() => {
										// Set this folder as the people folder temporarily for export
										const originalFolder = this.settings.peopleFolder;
										this.settings.peopleFolder = file.path;

										// Open Control Center to GEDCOM tab
										const modal = new ControlCenterModal(this.app, this);
										modal.openToTab('gedcom');

										// Restore original folder (without saving)
										this.settings.peopleFolder = originalFolder;
									});
							});

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Scan for relationship issues')
									.setIcon('shield-alert')
									.onClick(() => {
										new FolderScanModal(this.app, file).open();
									});
							});

							submenu.addSeparator();

							// Places folder actions
							submenu.addItem((subItem) => {
								subItem
									.setTitle('Set as places folder')
									.setIcon('map-pin')
									.onClick(async () => {
										this.settings.placesFolder = file.path;
										await this.saveSettings();
										new Notice(`Places folder set to: ${file.path}`);
									});
							});

							submenu.addSeparator();

							// Add essential properties submenu
							submenu.addItem((subItem) => {
								const propsSubmenu: Menu = subItem
									.setTitle('Add essential properties')
									.setIcon('file-plus')
									.setSubmenu();

								propsSubmenu.addItem((propItem) => {
									propItem
										.setTitle('Add essential person properties')
										.setIcon('user')
										.onClick(async () => {
											const files = this.app.vault.getMarkdownFiles()
												.filter(f => f.path.startsWith(file.path + '/'));
											await this.addEssentialPersonProperties(files);
										});
								});

								propsSubmenu.addItem((propItem) => {
									propItem
										.setTitle('Add essential place properties')
										.setIcon('map-pin')
										.onClick(async () => {
											const files = this.app.vault.getMarkdownFiles()
												.filter(f => f.path.startsWith(file.path + '/'));
											await this.addEssentialPlaceProperties(files);
										});
								});

								propsSubmenu.addItem((propItem) => {
									propItem
										.setTitle('Add essential source properties')
										.setIcon('archive')
										.onClick(async () => {
											const files = this.app.vault.getMarkdownFiles()
												.filter(f => f.path.startsWith(file.path + '/'));
											await this.addEssentialSourceProperties(files);
										});
								});

								propsSubmenu.addItem((propItem) => {
									propItem
										.setTitle('Add essential map properties')
										.setIcon('globe')
										.onClick(async () => {
											const files = this.app.vault.getMarkdownFiles()
												.filter(f => f.path.startsWith(file.path + '/'));
											await this.addEssentialMapProperties(files);
										});
								});
							});

							// Add cr_id only
							submenu.addItem((subItem) => {
								subItem
									.setTitle('Add cr_id')
									.setIcon('key')
									.onClick(async () => {
										const files = this.app.vault.getMarkdownFiles()
											.filter(f => f.path.startsWith(file.path + '/'));
										await this.addCrId(files);
									});
							});

							// Insert dynamic blocks to all person notes in folder
							submenu.addItem((subItem) => {
								subItem
									.setTitle('Insert dynamic blocks')
									.setIcon('layout-template')
									.onClick(async () => {
										const files = this.app.vault.getMarkdownFiles()
											.filter(f => f.path.startsWith(file.path + '/'));
										await this.insertDynamicBlocks(files);
									});
							});

							submenu.addSeparator();

							// Bases submenu
							submenu.addItem((subItem) => {
								const basesSubmenu: Menu = subItem
									.setTitle('Bases')
									.setIcon('table')
									.setSubmenu();

								basesSubmenu.addItem((baseItem) => {
									baseItem
										.setTitle('New people base from template')
										.setIcon('users')
										.onClick(async () => {
											await this.createBaseTemplate(file);
										});
								});

								basesSubmenu.addItem((baseItem) => {
									baseItem
										.setTitle('New places base from template')
										.setIcon('map-pin')
										.onClick(async () => {
											await this.createPlacesBaseTemplate(file);
										});
								});

								basesSubmenu.addItem((baseItem) => {
									baseItem
										.setTitle('New organizations base from template')
										.setIcon('building')
										.onClick(async () => {
											await this.createOrganizationsBaseTemplate(file);
										});
								});

								basesSubmenu.addItem((baseItem) => {
									baseItem
										.setTitle('New sources base from template')
										.setIcon('archive')
										.onClick(async () => {
											await this.createSourcesBaseTemplate(file);
										});
								});

								basesSubmenu.addItem((baseItem) => {
									baseItem
										.setTitle('New events base from template')
										.setIcon('calendar')
										.onClick(async () => {
											await this.createEventsBaseTemplate(file);
										});
								});
							});

							submenu.addSeparator();

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Generate all trees')
									.setIcon('git-fork')
									.onClick(async () => {
										// Temporarily set this folder as people folder
										const originalFolder = this.settings.peopleFolder;
										this.settings.peopleFolder = file.path;
										await this.saveSettings();

										// Generate all trees
										await this.generateAllTrees();

										// Restore original if needed
										if (originalFolder !== file.path) {
											this.settings.peopleFolder = originalFolder;
											await this.saveSettings();
										}
									});
							});

							submenu.addItem((subItem) => {
								subItem
									.setTitle('Show folder statistics')
									.setIcon('bar-chart-2')
									.onClick(() => {
										this.showFolderStatistics(file);
									});
							});
						});
					} else {
						// Mobile: flat menu with prefix
						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Set as people folder')
								.setIcon('users')
								.onClick(async () => {
									this.settings.peopleFolder = file.path;
									await this.saveSettings();
									new Notice(`People folder set to: ${file.path}`);
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Import GEDCOM to this folder')
								.setIcon('upload')
								.onClick(async () => {
									// Set this folder as the people folder
									this.settings.peopleFolder = file.path;
									await this.saveSettings();

									// Open Control Center to GEDCOM tab
									const modal = new ControlCenterModal(this.app, this);
									modal.openToTab('gedcom');
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Export GEDCOM from this folder')
								.setIcon('download')
								.onClick(() => {
									// Set this folder as the people folder temporarily for export
									const originalFolder = this.settings.peopleFolder;
									this.settings.peopleFolder = file.path;

									// Open Control Center to GEDCOM tab
									const modal = new ControlCenterModal(this.app, this);
									modal.openToTab('gedcom');

									// Restore original folder (without saving)
									this.settings.peopleFolder = originalFolder;
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Scan for relationship issues')
								.setIcon('shield-alert')
								.onClick(() => {
									new FolderScanModal(this.app, file).open();
								});
						});

						// Places folder actions (mobile)
						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Set as places folder')
								.setIcon('map-pin')
								.onClick(async () => {
									this.settings.placesFolder = file.path;
									await this.saveSettings();
									new Notice(`Places folder set to: ${file.path}`);
								});
						});

						// Essential properties (mobile)
						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Add essential person properties')
								.setIcon('user')
								.onClick(async () => {
									const files = this.app.vault.getMarkdownFiles()
										.filter(f => f.path.startsWith(file.path + '/'));
									await this.addEssentialPersonProperties(files);
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Add essential place properties')
								.setIcon('map-pin')
								.onClick(async () => {
									const files = this.app.vault.getMarkdownFiles()
										.filter(f => f.path.startsWith(file.path + '/'));
									await this.addEssentialPlaceProperties(files);
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Add essential source properties')
								.setIcon('archive')
								.onClick(async () => {
									const files = this.app.vault.getMarkdownFiles()
										.filter(f => f.path.startsWith(file.path + '/'));
									await this.addEssentialSourceProperties(files);
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Add essential map properties')
								.setIcon('globe')
								.onClick(async () => {
									const files = this.app.vault.getMarkdownFiles()
										.filter(f => f.path.startsWith(file.path + '/'));
									await this.addEssentialMapProperties(files);
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Add cr_id')
								.setIcon('key')
								.onClick(async () => {
									const files = this.app.vault.getMarkdownFiles()
										.filter(f => f.path.startsWith(file.path + '/'));
									await this.addCrId(files);
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Insert dynamic blocks')
								.setIcon('layout-template')
								.onClick(async () => {
									const files = this.app.vault.getMarkdownFiles()
										.filter(f => f.path.startsWith(file.path + '/'));
									await this.insertDynamicBlocks(files);
								});
						});

						// Bases templates (mobile)
						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: New people base from template')
								.setIcon('users')
								.onClick(async () => {
									await this.createBaseTemplate(file);
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: New places base from template')
								.setIcon('map-pin')
								.onClick(async () => {
									await this.createPlacesBaseTemplate(file);
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: New organizations base from template')
								.setIcon('building')
								.onClick(async () => {
									await this.createOrganizationsBaseTemplate(file);
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: New sources base from template')
								.setIcon('archive')
								.onClick(async () => {
									await this.createSourcesBaseTemplate(file);
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: New events base from template')
								.setIcon('calendar')
								.onClick(async () => {
									await this.createEventsBaseTemplate(file);
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Generate all trees')
								.setIcon('git-fork')
								.onClick(async () => {
									// Temporarily set this folder as people folder
									const originalFolder = this.settings.peopleFolder;
									this.settings.peopleFolder = file.path;
									await this.saveSettings();

									// Generate all trees
									await this.generateAllTrees();

									// Restore original if needed
									if (originalFolder !== file.path) {
										this.settings.peopleFolder = originalFolder;
										await this.saveSettings();
									}
								});
						});

						menu.addItem((item) => {
							item
								.setTitle('Canvas Roots: Show folder statistics')
								.setIcon('bar-chart-2')
								.onClick(() => {
									this.showFolderStatistics(file);
								});
						});
					}
				}
			})
		);

		// Add context menu for multi-file selections
		this.registerEvent(
			this.app.workspace.on('files-menu', (menu, files) => {
				// Only show for multiple markdown files
				const markdownFiles = files.filter((f): f is TFile => f instanceof TFile && f.extension === 'md');

				if (markdownFiles.length === 0) return;

				// Check if any files are missing essential properties
				let hasMissingPersonProperties = false;
				let hasMissingPlaceProperties = false;
				let hasMissingSourceProperties = false;

				for (const file of markdownFiles) {
					const fileCache = this.app.metadataCache.getFileCache(file);
					const frontmatter = fileCache?.frontmatter || {};

					// Check person properties
					const hasAllPersonProperties =
						frontmatter.cr_id &&
						frontmatter.name &&
						('born' in frontmatter) &&
						('died' in frontmatter) &&
						(('father' in frontmatter) || ('father_id' in frontmatter)) &&
						(('mother' in frontmatter) || ('mother_id' in frontmatter)) &&
						(('spouses' in frontmatter) || ('spouse' in frontmatter) || ('spouse_id' in frontmatter)) &&
						(('children' in frontmatter) || ('children_id' in frontmatter)) &&
						('group_name' in frontmatter);

					// Check place properties (supports both cr_type and legacy type)
					const hasAllPlaceProperties =
						(frontmatter.cr_type === 'place' || frontmatter.type === 'place') &&
						frontmatter.cr_id &&
						frontmatter.name &&
						('place_type' in frontmatter) &&
						('place_category' in frontmatter);

					// Check source properties (supports both cr_type and legacy type)
					const hasAllSourceProperties =
						(frontmatter.cr_type === 'source' || frontmatter.type === 'source') &&
						frontmatter.cr_id &&
						frontmatter.title &&
						frontmatter.source_type &&
						('confidence' in frontmatter);

					if (!hasAllPersonProperties) hasMissingPersonProperties = true;
					if (!hasAllPlaceProperties) hasMissingPlaceProperties = true;
					if (!hasAllSourceProperties) hasMissingSourceProperties = true;

					// If all types are missing properties, no need to keep checking
					if (hasMissingPersonProperties && hasMissingPlaceProperties && hasMissingSourceProperties) break;
				}

				// Only show submenu if at least one type is missing properties
				if (hasMissingPersonProperties || hasMissingPlaceProperties || hasMissingSourceProperties) {
					const useSubmenu = Platform.isDesktop && !Platform.isMobile;
					menu.addSeparator();

					if (useSubmenu) {
						menu.addItem((item) => {
							const propsSubmenu: Menu = item
								.setTitle(`Canvas Roots: Add essential properties (${markdownFiles.length} files)`)
								.setIcon('file-plus')
								.setSubmenu();

							if (hasMissingPersonProperties) {
								propsSubmenu.addItem((subItem) => {
									subItem
										.setTitle('Add essential person properties')
										.setIcon('user')
										.onClick(async () => {
											await this.addEssentialPersonProperties(markdownFiles);
										});
								});
							}

							if (hasMissingPlaceProperties) {
								propsSubmenu.addItem((subItem) => {
									subItem
										.setTitle('Add essential place properties')
										.setIcon('map-pin')
										.onClick(async () => {
											await this.addEssentialPlaceProperties(markdownFiles);
										});
								});
							}

								if (hasMissingSourceProperties) {
									propsSubmenu.addItem((subItem) => {
									subItem
										.setTitle('Add essential source properties')
										.setIcon('archive')
										.onClick(async () => {
											await this.addEssentialSourceProperties(markdownFiles);
										});
									});
								}

							// Add cr_id option
							propsSubmenu.addItem((subItem) => {
								subItem
									.setTitle('Add cr_id')
									.setIcon('key')
									.onClick(async () => {
										await this.addCrId(markdownFiles);
									});
							});
						});
					} else {
						// Mobile: flat menu
						if (hasMissingPersonProperties) {
							menu.addItem((item) => {
								item
									.setTitle(`Canvas Roots: Add essential person properties (${markdownFiles.length} files)`)
									.setIcon('user')
									.onClick(async () => {
										await this.addEssentialPersonProperties(markdownFiles);
									});
							});
						}

						if (hasMissingPlaceProperties) {
							menu.addItem((item) => {
								item
									.setTitle(`Canvas Roots: Add essential place properties (${markdownFiles.length} files)`)
									.setIcon('map-pin')
									.onClick(async () => {
										await this.addEssentialPlaceProperties(markdownFiles);
									});
							});
						}

						if (hasMissingSourceProperties) {
							menu.addItem((item) => {
								item
								.setTitle(`Canvas Roots: Add essential source properties (${markdownFiles.length} files)`)
								.setIcon('archive')
								.onClick(async () => {
									await this.addEssentialSourceProperties(markdownFiles);
								});
							});
						}

						// Add cr_id option (mobile)
						menu.addItem((item) => {
							item
								.setTitle(`Canvas Roots: Add cr_id (${markdownFiles.length} files)`)
								.setIcon('key')
								.onClick(async () => {
									await this.addCrId(markdownFiles);
								});
						});
					}
					}
			})
		);

		// Register file modification handler for bidirectional sync
		this.registerFileModificationHandler();

		// Initialize bidirectional relationship snapshots
		// This enables deletion detection from the first edit after plugin load
		if (this.settings.enableBidirectionalSync) {
			this.initializeBidirectionalSnapshots();
		}

		// Initialize relationship history service
		await this.initializeRelationshipHistory();
	}

	/**
	 * Initialize bidirectional relationship snapshots for all person notes
	 * Runs asynchronously after a short delay to avoid blocking plugin startup
	 */
	private initializeBidirectionalSnapshots() {
		// Create the shared bidirectional linker instance
		if (!this.bidirectionalLinker) {
			this.bidirectionalLinker = new BidirectionalLinker(this.app);
			if (this.folderFilter) {
				this.bidirectionalLinker.setFolderFilter(this.folderFilter);
			}
		}

		// Run after a 1-second delay to not impact plugin load performance
		setTimeout(() => {
			try {
				this.bidirectionalLinker!.initializeSnapshots();
			} catch (error: unknown) {
				logger.error('snapshot-init', 'Failed to initialize relationship snapshots', {
					error: getErrorMessage(error)
				});
			}
		}, 1000);
	}

	/**
	 * Initialize the relationship history service
	 */
	private async initializeRelationshipHistory() {
		if (!this.settings.enableRelationshipHistory) {
			return;
		}

		// Load existing history data
		const dataKey = RelationshipHistoryService.getDataKey();
		const savedData = await this.loadData();
		const historyData: RelationshipHistoryData | null = savedData?.[dataKey] || null;

		// Create save callback
		const saveCallback = async (data: RelationshipHistoryData) => {
			const allData = await this.loadData() || {};
			allData[dataKey] = data;
			await this.saveData(allData);
		};

		this.relationshipHistory = new RelationshipHistoryService(
			this.app,
			historyData,
			saveCallback
		);

		// Cleanup old entries on startup
		if (this.settings.historyRetentionDays > 0) {
			await this.relationshipHistory.cleanupOldEntries(this.settings.historyRetentionDays);
		}

		logger.info('history-init', 'Relationship history service initialized');
	}

	/**
	 * Show the relationship history modal
	 */
	private showRelationshipHistory(personFile?: TFile) {
		if (!this.relationshipHistory) {
			new Notice('Relationship history is disabled. Enable it in settings.');
			return;
		}

		new RelationshipHistoryModal(this.app, this.relationshipHistory, personFile).open();
	}

	/**
	 * Undo the most recent relationship change
	 */
	private async undoLastRelationshipChange() {
		if (!this.relationshipHistory) {
			new Notice('Relationship history is disabled. Enable it in settings.');
			return;
		}

		const change = await this.relationshipHistory.undoLastChange();
		if (change) {
			new Notice(`Undone: ${formatChangeDescription(change)}`);
		}
	}

	/**
	 * Get the relationship history service (for external use)
	 */
	getRelationshipHistory(): RelationshipHistoryService | null {
		return this.relationshipHistory;
	}

	/**
	 * Register event handler for file modifications to auto-sync relationships
	 * Public to allow settings tab to re-register when settings change
	 */
	registerFileModificationHandler() {
		// Unregister existing handler if present
		if (this.fileModifyEventRef) {
			this.app.metadataCache.offref(this.fileModifyEventRef);
			this.fileModifyEventRef = null;
		}

		// Register new handler if sync is enabled
		if (this.settings.enableBidirectionalSync && this.settings.syncOnFileModify) {
			logger.debug('file-watcher', 'Registering file modification handler for bidirectional sync');

			this.fileModifyEventRef = this.app.metadataCache.on('changed', async (file: TFile) => {
				// Only process markdown files
				if (file.extension !== 'md') {
					return;
				}

				// Only process files with cr_id (person notes)
				const cache = this.app.metadataCache.getFileCache(file);
				if (!cache?.frontmatter?.cr_id) {
					return;
				}

				logger.debug('file-watcher', 'Person note modified, syncing relationships', {
					file: file.path
				});

				// Sync relationships for this file
				try {
					// Create shared instance if not exists
					if (!this.bidirectionalLinker) {
						this.bidirectionalLinker = new BidirectionalLinker(this.app);
						if (this.folderFilter) {
							this.bidirectionalLinker.setFolderFilter(this.folderFilter);
						}
					}
					await this.bidirectionalLinker.syncRelationships(file);
				} catch (error: unknown) {
					logger.error('file-watcher', 'Failed to sync relationships on file modify', {
						file: file.path,
						error: getErrorMessage(error)
					});
				}
			});

			this.registerEvent(this.fileModifyEventRef);
		}
	}

	onunload() {
		console.debug('Unloading Canvas Roots plugin');

		// Clean up event handlers
		if (this.fileModifyEventRef) {
			this.app.metadataCache.offref(this.fileModifyEventRef);
		}
	}

	async loadSettings() {
		const savedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);

		// Migration: Existing users (who have saved settings but no noteTypeDetection)
		// should keep 'type' as primary for backwards compatibility.
		// New users get 'cr_type' as the default.
		if (savedData && !savedData.noteTypeDetection) {
			// User has existing settings but never configured noteTypeDetection
			// Preserve legacy behavior by using 'type' as primary
			this.settings.noteTypeDetection = {
				enableTagDetection: true,
				primaryTypeProperty: 'type'
			};
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Confirm deletion of an event note
	 */
	private async confirmDeleteEvent(eventTitle: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Delete event');
			modal.contentEl.createEl('p', {
				text: `Are you sure you want to delete "${eventTitle}"? This action cannot be undone.`
			});

			const buttonContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });

			const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
			cancelBtn.addEventListener('click', () => {
				modal.close();
				resolve(false);
			});

			const deleteBtn = buttonContainer.createEl('button', {
				text: 'Delete',
				cls: 'mod-warning'
			});
			deleteBtn.addEventListener('click', () => {
				modal.close();
				resolve(true);
			});

			modal.open();
		});
	}

	/**
	 * Prompt user to select parent type (father or mother)
	 * Returns 'father', 'mother', or null if cancelled
	 */
	private async promptParentType(): Promise<'father' | 'mother' | null> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Select parent type');

			modal.contentEl.createEl('p', {
				text: 'Is this person the father or mother?'
			});

			const buttonContainer = modal.contentEl.createDiv({ cls: 'cr-prompt-buttons' });

			const fatherBtn = buttonContainer.createEl('button', {
				text: 'Father',
				cls: 'mod-cta'
			});
			fatherBtn.addEventListener('click', () => {
				modal.close();
				resolve('father');
			});

			const motherBtn = buttonContainer.createEl('button', {
				text: 'Mother',
				cls: 'mod-cta'
			});
			motherBtn.addEventListener('click', () => {
				modal.close();
				resolve('mother');
			});

			const cancelBtn = buttonContainer.createEl('button', {
				text: 'Cancel'
			});
			cancelBtn.addEventListener('click', () => {
				modal.close();
				resolve(null);
			});

			modal.open();
		});
	}

	private async promptSetCollectionName(file: TFile): Promise<void> {
		// Get current group_name if it exists
		const cache = this.app.metadataCache.getFileCache(file);
		const currentCollectionName = cache?.frontmatter?.group_name || '';

		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Set group name');

			modal.contentEl.createEl('p', {
				text: 'Enter a name for this connected group (family, faction, organization, etc.):'
			});

			const inputContainer = modal.contentEl.createDiv({ cls: 'setting-item-control' });
			const input = inputContainer.createEl('input', {
				type: 'text',
				placeholder: 'e.g., "Smith Family", "House Stark", "The Council"',
				value: currentCollectionName,
				cls: 'cr-prompt-input'
			});

			modal.contentEl.createEl('p', {
				text: 'Leave empty to remove the group name.',
				cls: 'cr-help-text'
			});

			const buttonContainer = modal.contentEl.createDiv({ cls: 'cr-prompt-buttons' });

			const saveBtn = buttonContainer.createEl('button', {
				text: 'Save',
				cls: 'mod-cta'
			});
			saveBtn.addEventListener('click', () => {
				void (async () => {
					const collectionName = input.value.trim();

					// Update or remove group_name in frontmatter
					await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
						if (collectionName) {
							frontmatter.group_name = collectionName;
						} else {
							delete frontmatter.group_name;
						}
					});

					new Notice(collectionName
						? `Group name set to "${collectionName}"`
						: 'Group name removed'
					);

					modal.close();
					resolve();
				})();
			});

			const cancelBtn = buttonContainer.createEl('button', {
				text: 'Cancel'
			});
			cancelBtn.addEventListener('click', () => {
				modal.close();
				resolve();
			});

			// Allow Enter key to save
			input.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					saveBtn.click();
				} else if (e.key === 'Escape') {
					cancelBtn.click();
				}
			});

			modal.open();

			// Focus the input
			setTimeout(() => {
				input.focus();
				input.select();
			}, 50);
		});
	}

	private async promptSetCollection(file: TFile): Promise<void> {
		// Get current collection if it exists
		const cache = this.app.metadataCache.getFileCache(file);
		const currentCollection = cache?.frontmatter?.collection || '';

		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Set collection');

			modal.contentEl.createEl('p', {
				text: 'Enter a collection to organize this person (e.g., "Paternal Line", "House Stark", "1800s Branch"):'
			});

			const inputContainer = modal.contentEl.createDiv({ cls: 'setting-item-control' });
			const input = inputContainer.createEl('input', {
				type: 'text',
				placeholder: 'e.g., "Paternal Line", "Maternal Branch"',
				value: currentCollection,
				cls: 'cr-prompt-input'
			});

			modal.contentEl.createEl('p', {
				text: 'Collections let you organize people across family groups. Leave empty to remove.',
				cls: 'cr-help-text'
			});

			const buttonContainer = modal.contentEl.createDiv({ cls: 'cr-prompt-buttons' });

			const saveBtn = buttonContainer.createEl('button', {
				text: 'Save',
				cls: 'mod-cta'
			});
			saveBtn.addEventListener('click', () => {
				void (async () => {
					const collection = input.value.trim();

					// Update or remove collection in frontmatter
					await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
						if (collection) {
							frontmatter.collection = collection;
						} else {
							delete frontmatter.collection;
						}
					});

					new Notice(collection
						? `Collection set to "${collection}"`
						: 'Collection removed'
					);

					modal.close();
					resolve();
				})();
			});

			const cancelBtn = buttonContainer.createEl('button', {
				text: 'Cancel'
			});
			cancelBtn.addEventListener('click', () => {
				modal.close();
				resolve();
			});

			// Allow Enter key to save
			input.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					saveBtn.click();
				} else if (e.key === 'Escape') {
					cancelBtn.click();
				}
			});

			modal.open();

			// Focus the input
			setTimeout(() => {
				input.focus();
				input.select();
			}, 50);
		});
	}

	/**
	 * Add a source link to a person note
	 * Opens source picker, then adds the selected source to the person's sources
	 */
	private addSourceToPersonNote(file: TFile): void {
		new SourcePickerModal(this.app, this, async (source) => {
			// Get current sources from frontmatter
			const cache = this.app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter || {};

			// Find the next available source slot
			let nextSlot = 1;
			if (frontmatter.source) {
				nextSlot = 2;
				while (frontmatter[`source_${nextSlot}`]) {
					nextSlot++;
				}
			}

			// Create the wikilink
			const sourceLink = `[[${source.filePath.replace(/\.md$/, '')}]]`;

			// Check if this source is already linked
			const existingSources: string[] = [];
			if (frontmatter.source) existingSources.push(String(frontmatter.source));
			for (let i = 2; i <= 50; i++) {
				const key = `source_${i}`;
				if (frontmatter[key]) {
					existingSources.push(String(frontmatter[key]));
				} else {
					break;
				}
			}

			if (existingSources.some(s => s.includes(source.filePath.replace(/\.md$/, '')))) {
				new Notice(`Source "${source.title}" is already linked to this person`);
				return;
			}

			// Add the source to frontmatter
			await this.app.fileManager.processFrontMatter(file, (fm) => {
				if (nextSlot === 1) {
					fm.source = sourceLink;
				} else {
					fm[`source_${nextSlot}`] = sourceLink;
				}
			});

			new Notice(`Linked source: ${source.title}`);
		}).open();
	}

	/**
	 * Open the place edit modal for a place note
	 */
	private openEditPlaceModal(file: TFile): void {
		// Get the place cr_id from frontmatter
		const cache = this.app.metadataCache.getFileCache(file);
		const crId = cache?.frontmatter?.cr_id;

		if (!crId) {
			new Notice('Place note does not have a cr_id');
			return;
		}

		// Load the place from the place graph
		const placeGraph = this.createPlaceGraphService();
		placeGraph.reloadCache();
		const place = placeGraph.getPlaceByCrId(crId);

		if (!place) {
			new Notice('Could not find place in graph');
			return;
		}

		// Get family graph for collection options
		const familyGraph = new FamilyGraphService(this.app);
		void familyGraph.reloadCache();

		// Open the modal in edit mode
		new CreatePlaceModal(this.app, {
			editPlace: place,
			editFile: file,
			familyGraph,
			placeGraph,
			settings: this.settings
		}).open();
	}

	/**
	 * Geocode a single place note using Nominatim
	 */
	private async geocodeSinglePlace(file: TFile): Promise<void> {
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;

		if (!fm) {
			new Notice('Could not read place frontmatter');
			return;
		}

		// Check if already has coordinates
		if (fm.latitude && fm.longitude) {
			new Notice('Place already has coordinates');
			return;
		}

		// Get the place name - prefer full_name, fall back to title or name
		const placeName = fm.full_name || fm.title || fm.name || file.basename;

		if (!placeName) {
			new Notice('Could not determine place name for geocoding');
			return;
		}

		// Get parent place name if available
		let parentName: string | undefined;
		if (fm.parent) {
			const placeGraph = this.createPlaceGraphService();
			placeGraph.reloadCache();
			const parentPlace = placeGraph.getPlaceByCrId(fm.parent);
			parentName = parentPlace?.name;
		}

		new Notice(`Geocoding "${placeName}"...`);

		const geocodingService = new GeocodingService(this.app);
		const result = await geocodingService.geocodeSingle(placeName, parentName);

		if (result.success && result.coordinates) {
			// Update the file with coordinates
			await geocodingService.updatePlaceCoordinates(file, result.coordinates);
			new Notice(`Found coordinates: ${result.coordinates.lat.toFixed(4)}, ${result.coordinates.long.toFixed(4)}`);
		} else {
			new Notice(result.error || 'Could not find coordinates for this place');
		}
	}

	/**
	 * Open the source edit modal for a source note
	 */
	private openEditSourceModal(file: TFile): void {
		// Get source data from frontmatter
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;

		if (!fm?.cr_id) {
			new Notice('Source note does not have a cr_id');
			return;
		}

		// Get source from service
		const sourceService = new SourceService(this.app, this.settings);
		const source = sourceService.getSourceByPath(file.path);

		if (!source) {
			new Notice('Could not find source data');
			return;
		}

		// Open the modal in edit mode
		new CreateSourceModal(this.app, this, {
			editFile: file,
			editSource: source,
			onSuccess: () => {
				new Notice('Source updated');
			}
		}).open();
	}

	/**
	 * Open the citation generator modal for a source note
	 */
	private openCitationGenerator(file: TFile): void {
		// Get source data from frontmatter
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;

		if (!fm?.cr_id) {
			new Notice('Source note does not have a cr_id');
			return;
		}

		// Get source from service
		const sourceService = new SourceService(this.app, this.settings);
		const source = sourceService.getSourceByPath(file.path);

		if (!source) {
			new Notice('Could not find source data');
			return;
		}

		// Open the citation generator modal
		new CitationGeneratorModal(this.app, this, source).open();
	}

	/**
	 * Open the event edit modal for an event note
	 */
	private openEditEventModal(file: TFile): void {
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;

		if (!fm?.cr_id) {
			new Notice('Event note does not have a cr_id');
			return;
		}

		// Get event from service
		const eventService = new EventService(this.app, this.settings);
		const event = eventService.getEventByFile(file);

		if (!event) {
			new Notice('Could not find event data');
			return;
		}

		// Open the edit modal
		new CreateEventModal(this.app, eventService, this.settings, {
			editEvent: event,
			editFile: file,
			onUpdated: () => {
				new Notice('Event updated');
			}
		}).open();
	}

	/**
	 * Open the person edit modal for a person note
	 */
	private openEditPersonModal(file: TFile): void {
		// Get frontmatter data
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;

		if (!fm?.cr_id) {
			new Notice('Person note does not have a cr_id');
			return;
		}

		// Extract relationship names from wikilinks
		const extractName = (value: string | undefined): string | undefined => {
			if (!value) return undefined;
			// Handle wikilink format: [[Name]] or "[[Name]]"
			const match = value.match(/\[\[([^\]]+)\]\]/);
			return match ? match[1] : value;
		};

		// Extract spouse names/IDs
		const spouseNames: string[] = [];
		const spouseIds: string[] = [];
		if (fm.spouse) {
			const spouses = Array.isArray(fm.spouse) ? fm.spouse : [fm.spouse];
			for (const s of spouses) {
				const name = extractName(String(s));
				if (name) spouseNames.push(name);
			}
		}
		if (fm.spouse_id) {
			const ids = Array.isArray(fm.spouse_id) ? fm.spouse_id : [fm.spouse_id];
			for (const id of ids) {
				spouseIds.push(String(id));
			}
		}

		// Get family graph for collection options
		const familyGraph = new FamilyGraphService(this.app);
		void familyGraph.reloadCache();

		// Open the modal in edit mode
		new CreatePersonModal(this.app, {
			editFile: file,
			editPersonData: {
				crId: String(fm.cr_id),
				name: String(fm.name || ''),
				gender: fm.gender || fm.sex,
				born: fm.born,
				died: fm.died,
				birthPlace: fm.birth_place,
				deathPlace: fm.death_place,
				occupation: fm.occupation,
				fatherId: fm.father_id,
				fatherName: extractName(fm.father),
				motherId: fm.mother_id,
				motherName: extractName(fm.mother),
				spouseIds: spouseIds.length > 0 ? spouseIds : undefined,
				spouseNames: spouseNames.length > 0 ? spouseNames : undefined,
				collection: fm.collection
			},
			familyGraph,
			propertyAliases: this.settings.propertyAliases
		}).open();
	}

	private async toggleRootPerson(file: TFile): Promise<void> {
		// Get current root_person status
		const cache = this.app.metadataCache.getFileCache(file);
		const isRootPerson = cache?.frontmatter?.root_person === true;

		// Toggle the root_person property
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			if (isRootPerson) {
				delete frontmatter.root_person;
			} else {
				frontmatter.root_person = true;
			}
		});

		new Notice(isRootPerson
			? 'Unmarked as root person'
			: 'Marked as root person'
		);
	}

	/**
	 * Prompt user to select a person and assign reference numbers
	 */
	private promptAssignReferenceNumbers(system: NumberingSystem): void {
		const picker = new PersonPickerModal(this.app, (selectedPerson) => {
			void (async () => {
				try {
					const service = new ReferenceNumberingService(this.app);
					let stats;

					new Notice(`Assigning ${system} numbers from ${selectedPerson.name}...`);

					switch (system) {
						case 'ahnentafel':
							stats = await service.assignAhnentafel(selectedPerson.crId);
							break;
						case 'daboville':
							stats = await service.assignDAboville(selectedPerson.crId);
							break;
						case 'henry':
							stats = await service.assignHenry(selectedPerson.crId);
							break;
						case 'generation':
							stats = await service.assignGeneration(selectedPerson.crId);
							break;
					}

					new Notice(`Assigned ${stats.totalAssigned} ${system} numbers from ${stats.rootPerson}`);
				} catch (error) {
					logger.error('reference-numbering', `Failed to assign ${system} numbers`, error);
					new Notice(`Failed to assign numbers: ${getErrorMessage(error)}`);
				}
			})();
		});
		picker.open();
	}

	/**
	 * Assign reference numbers from a specific person (for context menu)
	 */
	private async assignReferenceNumbersFromPerson(file: TFile, system: NumberingSystem): Promise<void> {
		const cache = this.app.metadataCache.getFileCache(file);
		const crId = cache?.frontmatter?.cr_id;
		const personName = cache?.frontmatter?.name || file.basename;

		if (!crId) {
			new Notice('Invalid person note: missing cr_id');
			return;
		}

		try {
			const service = new ReferenceNumberingService(this.app);
			let stats;

			new Notice(`Assigning ${system} numbers from ${personName}...`);

			switch (system) {
				case 'ahnentafel':
					stats = await service.assignAhnentafel(crId);
					break;
				case 'daboville':
					stats = await service.assignDAboville(crId);
					break;
				case 'henry':
					stats = await service.assignHenry(crId);
					break;
				case 'generation':
					stats = await service.assignGeneration(crId);
					break;
			}

			new Notice(`Assigned ${stats.totalAssigned} ${system} numbers from ${stats.rootPerson}`);
		} catch (error) {
			logger.error('reference-numbering', `Failed to assign ${system} numbers`, error);
			new Notice(`Failed to assign numbers: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Prompt user to select a numbering system and clear those numbers
	 */
	private promptClearReferenceNumbers(): void {
		const systemChoices: { system: NumberingSystem; label: string }[] = [
			{ system: 'ahnentafel', label: 'Ahnentafel numbers' },
			{ system: 'daboville', label: "d'Aboville numbers" },
			{ system: 'henry', label: 'Henry numbers' },
			{ system: 'generation', label: 'Generation numbers' }
		];

		const menu = new Menu();
		for (const choice of systemChoices) {
			menu.addItem((item) => {
				item
					.setTitle(`Clear ${choice.label}`)
					.setIcon('trash-2')
					.onClick(async () => {
						try {
							const service = new ReferenceNumberingService(this.app);
							new Notice(`Clearing ${choice.label}...`);
							const count = await service.clearNumbers(choice.system);
							new Notice(`Cleared ${count} ${choice.label}`);
						} catch (error) {
							logger.error('clear-numbers', `Failed to clear ${choice.label}`, error);
							new Notice(`Failed to clear numbers: ${getErrorMessage(error)}`);
						}
					});
			});
		}
		menu.showAtMouseEvent(new MouseEvent('click'));
	}

	/**
	 * Prompt user to select a person and lineage type, then assign lineage
	 */
	private promptAssignLineage(): void {
		const picker = new PersonPickerModal(this.app, (selectedPerson) => {
			void (async () => {
				// Show lineage type selection
				const lineageType = await this.promptLineageType();
				if (!lineageType) return;

				// Prompt for lineage name
				const lineageName = await this.promptLineageName(selectedPerson.name);
				if (!lineageName) return;

				try {
					const service = new LineageTrackingService(this.app);
					new Notice(`Assigning "${lineageName}" lineage from ${selectedPerson.name}...`);

					const stats = await service.assignLineage({
						name: lineageName,
						rootCrId: selectedPerson.crId,
						type: lineageType
					});

					new Notice(`Assigned "${lineageName}" to ${stats.totalMembers} descendants (${stats.maxGeneration} generations)`);
				} catch (error) {
					logger.error('lineage-tracking', 'Failed to assign lineage', error);
					new Notice(`Failed to assign lineage: ${getErrorMessage(error)}`);
				}
			})();
		});
		picker.open();
	}

	/**
	 * Prompt user to select and remove a lineage
	 */
	private promptRemoveLineage(): void {
		try {
			const service = new LineageTrackingService(this.app);
			const lineages = service.getAllLineages();

			if (lineages.length === 0) {
				new Notice('No lineages found in vault');
				return;
			}

			const menu = new Menu();
			for (const lineage of lineages) {
				menu.addItem((item) => {
					item
						.setTitle(`Remove "${lineage}"`)
						.setIcon('trash-2')
						.onClick(async () => {
							try {
								new Notice(`Removing "${lineage}" lineage...`);
								const count = await service.removeLineage(lineage);
								new Notice(`Removed "${lineage}" from ${count} people`);
							} catch (error) {
								logger.error('lineage-tracking', 'Failed to remove lineage', error);
								new Notice(`Failed to remove lineage: ${getErrorMessage(error)}`);
							}
						});
				});
			}
			menu.showAtMouseEvent(new MouseEvent('click'));
		} catch (error) {
			logger.error('lineage-tracking', 'Failed to get lineages', error);
			new Notice(`Failed to get lineages: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Assign lineage from a specific person (for context menu)
	 */
	private async assignLineageFromPerson(file: TFile, type: LineageType): Promise<void> {
		const cache = this.app.metadataCache.getFileCache(file);
		const crId = cache?.frontmatter?.cr_id;
		const personName = cache?.frontmatter?.name || file.basename;

		if (!crId) {
			new Notice('Invalid person note: missing cr_id');
			return;
		}

		// Prompt for lineage name
		const lineageName = await this.promptLineageName(personName);
		if (!lineageName) return;

		try {
			const service = new LineageTrackingService(this.app);
			new Notice(`Assigning "${lineageName}" lineage from ${personName}...`);

			const stats = await service.assignLineage({
				name: lineageName,
				rootCrId: crId,
				type: type
			});

			new Notice(`Assigned "${lineageName}" to ${stats.totalMembers} descendants (${stats.maxGeneration} generations)`);
		} catch (error) {
			logger.error('lineage-tracking', 'Failed to assign lineage', error);
			new Notice(`Failed to assign lineage: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Show create place notes dialog for a person note
	 * Extracts place references from the person note and offers to create missing place notes
	 */
	private async showCreatePlaceNotesForPerson(file: TFile): Promise<void> {
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;

		if (!fm) {
			new Notice('No frontmatter found in this note');
			return;
		}

		// Collect all place references from this person
		const placeFields: string[] = [];

		// Birth/death/burial places
		if (fm.birth_place && typeof fm.birth_place === 'string') {
			placeFields.push(fm.birth_place);
		}
		if (fm.death_place && typeof fm.death_place === 'string') {
			placeFields.push(fm.death_place);
		}
		if (fm.burial_place && typeof fm.burial_place === 'string') {
			placeFields.push(fm.burial_place);
		}

		// Spouse marriage locations
		let spouseIndex = 1;
		while (fm[`spouse${spouseIndex}`] || fm[`spouse${spouseIndex}_id`]) {
			const marriageLocation = fm[`spouse${spouseIndex}_marriage_location`];
			if (marriageLocation && typeof marriageLocation === 'string') {
				placeFields.push(marriageLocation);
			}
			spouseIndex++;
		}

		// Deduplicate and filter out wikilinks (already linked to place notes)
		const uniquePlaces = [...new Set(placeFields)]
			.map(p => p.trim())
			.filter(p => p && !p.startsWith('[['));

		if (uniquePlaces.length === 0) {
			new Notice('No unlinked place references found in this person note');
			return;
		}

		// Check which places already have notes
		const placeGraph = this.createPlaceGraphService();
		placeGraph.reloadCache();

		const missingPlaces: string[] = [];
		for (const placeName of uniquePlaces) {
			const existingPlace = placeGraph.getPlaceByName(placeName);
			if (!existingPlace) {
				missingPlaces.push(placeName);
			}
		}

		if (missingPlaces.length === 0) {
			new Notice('All place references already have corresponding place notes');
			return;
		}

		// Show modal to select which places to create
		const { CreateMissingPlacesModal } = await import('./src/ui/create-missing-places-modal');

		const modal = new CreateMissingPlacesModal(
			this.app,
			missingPlaces.map(name => ({ name, count: 1 })),
			{
				directory: this.settings.peopleFolder || '',
				placeGraph, // Reuse the placeGraph from earlier in this function
				onComplete: (created: number) => {
					if (created > 0) {
						new Notice(`Created ${created} place note${created !== 1 ? 's' : ''}`);
					}
				}
			}
		);
		modal.open();
	}

	/**
	 * Prompt user to select a lineage type
	 */
	private async promptLineageType(): Promise<LineageType | null> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Select lineage type');

			modal.contentEl.createEl('p', {
				text: 'How should descendants be traced?'
			});

			const buttonContainer = modal.contentEl.createDiv({ cls: 'cr-prompt-buttons' });

			const allBtn = buttonContainer.createEl('button', {
				text: 'All descendants',
				cls: 'mod-cta'
			});
			allBtn.addEventListener('click', () => {
				modal.close();
				resolve('all');
			});

			const patriBtn = buttonContainer.createEl('button', {
				text: 'Patrilineal'
			});
			patriBtn.addEventListener('click', () => {
				modal.close();
				resolve('patrilineal');
			});

			const matriBtn = buttonContainer.createEl('button', {
				text: 'Matrilineal'
			});
			matriBtn.addEventListener('click', () => {
				modal.close();
				resolve('matrilineal');
			});

			const cancelBtn = buttonContainer.createEl('button', {
				text: 'Cancel'
			});
			cancelBtn.addEventListener('click', () => {
				modal.close();
				resolve(null);
			});

			modal.open();
		});
	}

	/**
	 * Prompt user for a lineage name
	 */
	private async promptLineageName(suggestedName: string): Promise<string | null> {
		// Extract surname for suggestion
		const nameParts = suggestedName.trim().split(/\s+/);
		const surname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : suggestedName;
		const suggestion = `${surname} Line`;

		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Enter lineage name');

			modal.contentEl.createEl('p', {
				text: 'Enter a name for this lineage (e.g., "Smith Line", "Tudor Dynasty"):'
			});

			const inputContainer = modal.contentEl.createDiv({ cls: 'setting-item-control' });
			const input = inputContainer.createEl('input', {
				type: 'text',
				placeholder: 'e.g., "Smith Line", "Tudor Dynasty"',
				value: suggestion,
				cls: 'cr-prompt-input'
			});

			const buttonContainer = modal.contentEl.createDiv({ cls: 'cr-prompt-buttons' });

			const saveBtn = buttonContainer.createEl('button', {
				text: 'Assign',
				cls: 'mod-cta'
			});
			saveBtn.addEventListener('click', () => {
				const lineageName = input.value.trim();
				if (lineageName) {
					modal.close();
					resolve(lineageName);
				} else {
					new Notice('Please enter a lineage name');
				}
			});

			const cancelBtn = buttonContainer.createEl('button', {
				text: 'Cancel'
			});
			cancelBtn.addEventListener('click', () => {
				modal.close();
				resolve(null);
			});

			// Allow Enter key to save
			input.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					saveBtn.click();
				} else if (e.key === 'Escape') {
					cancelBtn.click();
				}
			});

			modal.open();

			// Focus the input
			setTimeout(() => {
				input.focus();
				input.select();
			}, 50);
		});
	}

	private generateTreeForCurrentNote(): void {
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			new Notice('No active note. Please open a person note first.');
			return;
		}

		// Check if the active file is a person note (has cr_id)
		const cache = this.app.metadataCache.getFileCache(activeFile);
		if (!cache?.frontmatter?.cr_id) {
			new Notice('Current note is not a person note (missing cr_id field)');
			return;
		}

		// Open Control Center with this person pre-selected
		const modal = new ControlCenterModal(this.app, this);
		modal.openWithPerson(activeFile);
	}

	async regenerateCanvas(canvasFile: TFile, direction?: 'vertical' | 'horizontal') {
		try {
			new Notice('Regenerating canvas...');

			// 1. Read current Canvas JSON
			const canvasContent = await this.app.vault.read(canvasFile);
			const canvasData = JSON.parse(canvasContent);

			if (!canvasData.nodes || canvasData.nodes.length === 0) {
				new Notice('Canvas is empty - nothing to regenerate');
				return;
			}

			// 2. Try to read original generation metadata from canvas
			const storedMetadata = canvasData.metadata?.frontmatter;
			const isCanvasRootsTree = storedMetadata?.plugin === 'canvas-roots';

			// 3. Extract person note nodes (file nodes only)
			const personNodes = canvasData.nodes.filter(
				(node: { type: string; file?: string }) =>
					node.type === 'file' && node.file?.endsWith('.md')
			);

			if (personNodes.length === 0) {
				new Notice('No person notes found in canvas');
				return;
			}

			// 4. Determine root person and tree parameters
			let rootCrId: string | undefined;
			let rootPersonName: string | undefined;
			let treeType: 'full' | 'ancestors' | 'descendants' = 'full';
			let maxGenerations: number | undefined;
			let includeSpouses: boolean = true;

			if (isCanvasRootsTree && storedMetadata.generation) {
				// Use stored metadata if available
				rootCrId = storedMetadata.generation.rootCrId;
				rootPersonName = storedMetadata.generation.rootPersonName;
				treeType = storedMetadata.generation.treeType;
				maxGenerations = storedMetadata.generation.maxGenerations || undefined;
				includeSpouses = storedMetadata.generation.includeSpouses;
			} else {
				// Fallback: find first node with cr_id
				for (const node of personNodes) {
					const file = this.app.vault.getAbstractFileByPath(node.file);
					if (file instanceof TFile) {
						const cache = this.app.metadataCache.getFileCache(file);
						if (cache?.frontmatter?.cr_id) {
							rootCrId = cache.frontmatter.cr_id;
							rootPersonName = file.basename;
							break;
						}
					}
				}

				if (!rootCrId || !rootPersonName) {
					new Notice('No person notes with cr_id found in canvas');
					return;
				}

				// Default to full tree for canvases without metadata
				treeType = 'full';
				maxGenerations = undefined;
				includeSpouses = true;
			}

			// Validate we have root person info before proceeding
			if (!rootCrId || !rootPersonName) {
				new Notice('No person notes with cr_id found in canvas');
				return;
			}

			// 5. Build family tree using original parameters
			const graphService = this.createFamilyGraphService();
			const familyTree = graphService.generateTree({
				rootCrId,
				treeType,
				maxGenerations,
				includeSpouses
			});

			if (!familyTree) {
				new Notice('Failed to build family tree from canvas nodes');
				return;
			}

			// 6. Determine layout settings (prefer stored, fall back to current settings)
			const nodeWidth = storedMetadata?.layout?.nodeWidth ?? this.settings.defaultNodeWidth;
			const nodeHeight = storedMetadata?.layout?.nodeHeight ?? this.settings.defaultNodeHeight;
			const nodeSpacingX = storedMetadata?.layout?.nodeSpacingX ?? this.settings.horizontalSpacing;
			const nodeSpacingY = storedMetadata?.layout?.nodeSpacingY ?? this.settings.verticalSpacing;
			const originalDirection = storedMetadata?.generation?.direction ?? 'vertical';

			// 7. Recalculate layout preserving original parameters (except direction if user changed it)
			const canvasGenerator = new CanvasGenerator();

			// Convert plural tree type (from TreeOptions) to singular (for LayoutOptions)
			const layoutTreeType: 'ancestor' | 'descendant' | 'full' =
				treeType === 'ancestors' ? 'ancestor' :
				treeType === 'descendants' ? 'descendant' :
				'full';

			// Preserve style overrides from stored metadata if present
			const styleOverrides = storedMetadata?.styleOverrides;

			const newCanvasData = canvasGenerator.generateCanvas(familyTree, {
				nodeSpacingX,
				nodeSpacingY,
				nodeWidth,
				nodeHeight,
				direction: direction ?? originalDirection,
				treeType: layoutTreeType,
				nodeColorScheme: this.settings.nodeColorScheme,
				showLabels: true,
				useFamilyChartLayout: true,
				parentChildArrowStyle: this.settings.parentChildArrowStyle,
				spouseArrowStyle: this.settings.spouseArrowStyle,
				parentChildEdgeColor: this.settings.parentChildEdgeColor,
				spouseEdgeColor: this.settings.spouseEdgeColor,
				showSpouseEdges: this.settings.showSpouseEdges,
				spouseEdgeLabelFormat: this.settings.spouseEdgeLabelFormat,
				showSourceIndicators: this.settings.showSourceIndicators,
				showResearchCoverage: this.settings.trackFactSourcing,
				canvasRootsMetadata: {
					plugin: 'canvas-roots',
					generation: {
						rootCrId: rootCrId,
						rootPersonName: rootPersonName,
						treeType: treeType,
						maxGenerations: maxGenerations || 0,
						includeSpouses,
						direction: direction ?? originalDirection,
						timestamp: Date.now()
					},
					layout: {
						nodeWidth,
						nodeHeight,
						nodeSpacingX,
						nodeSpacingY
					},
					// Preserve style overrides during regeneration
					styleOverrides: styleOverrides
				}
			});

			// 6. Update Canvas JSON with new data (preserves any non-person nodes)
			const updatedCanvasData = {
				...canvasData,
				nodes: newCanvasData.nodes,
				edges: newCanvasData.edges,
				metadata: newCanvasData.metadata
			};

			// 7. Format and write back to Canvas file (using same formatting as Control Center)
			const formattedJson = this.formatCanvasJson(updatedCanvasData);
			await this.app.vault.modify(canvasFile, formattedJson);

			new Notice(`Canvas regenerated successfully! (${newCanvasData.nodes.length} people)`);
		} catch (error: unknown) {
			console.error('Error regenerating canvas:', error);
			new Notice('Failed to regenerate canvas. Check console for details.');
		}
	}

	/**
	 * Regenerate a timeline canvas using its stored metadata and style overrides.
	 * Uses the EventService to get current events and re-exports with the stored options.
	 */
	async regenerateTimelineCanvas(canvasFile: TFile): Promise<void> {
		try {
			new Notice('Regenerating timeline...');

			// Get event service
			const eventService = this.getEventService();
			if (!eventService) {
				new Notice('Event service not available');
				return;
			}

			// Get all events
			const events = eventService.getAllEvents();
			if (events.length === 0) {
				new Notice('No events found');
				return;
			}

			// Import and use TimelineCanvasExporter
			const { TimelineCanvasExporter } = await import('./src/events/services/timeline-canvas-exporter');
			const exporter = new TimelineCanvasExporter(this.app, this.settings);

			const result = await exporter.regenerateCanvas(canvasFile, events);

			if (result.success) {
				new Notice(`Timeline regenerated successfully! (${events.length} events)`);
			} else {
				new Notice(`Failed to regenerate timeline: ${result.error}`);
			}
		} catch (error: unknown) {
			console.error('Error regenerating timeline canvas:', error);
			new Notice('Failed to regenerate timeline. Check console for details.');
		}
	}

	/**
	 * Format canvas JSON to match Obsidian's exact format
	 * Uses tabs for structure and compact objects on single lines
	 */
	private formatCanvasJson(data: unknown): string {
		const canvasData = data as {
			nodes: Array<Record<string, unknown>>;
			edges: Array<Record<string, unknown>>;
			metadata?: Record<string, unknown>;
		};

		const lines: string[] = [];
		lines.push('{');

		// Nodes array
		lines.push('\t"nodes":[');
		canvasData.nodes.forEach((node, i) => {
			const isLast = i === canvasData.nodes.length - 1;
			const nodeStr = JSON.stringify(node);
			lines.push(`\t\t${nodeStr}${isLast ? '' : ','}`);
		});
		lines.push('\t],');

		// Edges array
		lines.push('\t"edges":[');
		canvasData.edges.forEach((edge, i) => {
			const isLast = i === canvasData.edges.length - 1;
			const edgeStr = JSON.stringify(edge);
			lines.push(`\t\t${edgeStr}${isLast ? '' : ','}`);
		});
		lines.push('\t],');

		// Metadata
		lines.push('\t"metadata":{');
		lines.push('\t\t"version":"1.0-1.0",');
		const frontmatter = canvasData.metadata?.frontmatter || {};
		lines.push(`\t\t"frontmatter":${JSON.stringify(frontmatter)}`);
		lines.push('\t}');

		lines.push('}');

		return lines.join('\n');
	}

	private createPersonNote() {
		// Open Control Center to the Data Entry tab
		const modal = new ControlCenterModal(this.app, this);
		modal.openToTab('data-entry');
	}

	private async generateAllTrees() {
		new Notice('Finding all family groups...');

		try {
			// Open Control Center to generate all trees
			const modal = new ControlCenterModal(this.app, this);
			await modal.openAndGenerateAllTrees();
		} catch (error: unknown) {
			console.error('Error generating all trees:', error);
			new Notice('Failed to generate all trees. Check console for details.');
		}
	}

	private async exportCanvasToExcalidraw(canvasFile: TFile) {
		try {
			new Notice('Exporting to Excalidraw...');

			// Initialize exporter
			const exporter = new ExcalidrawExporter(this.app);

			// Export canvas
			const result = await exporter.exportToExcalidraw({
				canvasFile,
				preserveColors: true,
				fontSize: 16,
				strokeWidth: 2
			});

			if (!result.success) {
				new Notice(`Export failed: ${result.errors.join(', ')}`);
				return;
			}

			// Save Excalidraw file to vault root
			const outputPath = `${result.fileName}.excalidraw.md`;
			await this.app.vault.create(outputPath, result.excalidrawContent!);

			new Notice(`Exported ${result.elementsExported} elements to ${result.fileName}.excalidraw.md`);

			// Open the newly created file
			const excalidrawFile = this.app.vault.getAbstractFileByPath(outputPath);
			if (excalidrawFile instanceof TFile) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(excalidrawFile);
			}
		} catch (error: unknown) {
			console.error('Error exporting to Excalidraw:', error);
			new Notice(`Failed to export to Excalidraw: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Export canvas tree as PNG, SVG, or PDF image
	 */
	private async exportCanvasAsImage(canvasFile: TFile, format: 'png' | 'svg' | 'pdf') {
		try {
			new Notice(`Exporting as ${format.toUpperCase()}...`);

			// Read canvas to get root person
			const canvasContent = await this.app.vault.read(canvasFile);
			const canvasData = JSON.parse(canvasContent);
			const metadata = canvasData.metadata?.frontmatter;

			if (metadata?.plugin !== 'canvas-roots' || !metadata.generation?.rootCrId) {
				new Notice('This canvas does not contain Canvas Roots tree data');
				return;
			}

			const rootCrId = metadata.generation.rootCrId;
			const treeType = metadata.generation.treeType || 'full';
			const maxGenerations = metadata.generation.maxGenerations || 0;
			const includeSpouses = metadata.generation.includeSpouses ?? true;

			// Build family tree
			const graphService = this.createFamilyGraphService();

			const familyTree = graphService.generateTree({
				rootCrId,
				treeType,
				maxGenerations,
				includeSpouses
			});

			if (!familyTree) {
				new Notice('Failed to build family tree from canvas data');
				return;
			}

			// Create a temporary container for the preview renderer
			const tempContainer = document.createElement('div');
			tempContainer.addClass('cr-offscreen-render');
			document.body.appendChild(tempContainer);

			try {
				// Render tree
				const renderer = new TreePreviewRenderer(tempContainer);
				renderer.setColorScheme(this.settings.nodeColorScheme);
				renderer.renderPreview(familyTree, {
					layoutType: metadata.generation.layoutType || this.settings.defaultLayoutType,
					treeType: treeType === 'ancestors' ? 'ancestor' : treeType === 'descendants' ? 'descendant' : 'full',
					direction: 'vertical',
					nodeWidth: this.settings.defaultNodeWidth,
					nodeHeight: this.settings.defaultNodeHeight,
					nodeSpacingX: this.settings.horizontalSpacing,
					nodeSpacingY: this.settings.verticalSpacing
				});

				// Export based on format
				if (format === 'png') {
					await renderer.exportAsPNG();
				} else if (format === 'svg') {
					renderer.exportAsSVG();
				} else if (format === 'pdf') {
					await renderer.exportAsPDF();
				}

				new Notice(`${format.toUpperCase()} exported successfully`);
			} finally {
				// Clean up temporary container
				document.body.removeChild(tempContainer);
			}
		} catch (error: unknown) {
			console.error(`Error exporting canvas as ${format}:`, error);
			new Notice(`Failed to export as ${format.toUpperCase()}: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Export a person's timeline to Canvas or Excalidraw from their note file
	 */
	private async exportPersonTimelineFromFile(
		personFile: TFile,
		format: 'canvas' | 'excalidraw' = 'canvas'
	): Promise<void> {
		const eventService = this.getEventService();
		if (!eventService) {
			new Notice('Event service not available');
			return;
		}

		const cache = this.app.metadataCache.getFileCache(personFile);
		const personName = cache?.frontmatter?.name || personFile.basename;
		const allEvents = eventService.getAllEvents();
		const personLink = `[[${personName}]]`;

		// Filter events for this person
		const personEvents = allEvents.filter(e => {
			if (e.person) {
				const normalizedPerson = e.person.replace(/^\[\[/, '').replace(/\]\]$/, '').toLowerCase();
				return normalizedPerson === personName.toLowerCase();
			}
			return false;
		});

		if (personEvents.length === 0) {
			new Notice(`No events found for ${personName}`);
			return;
		}

		try {
			const { TimelineCanvasExporter } = await import('./src/events/services/timeline-canvas-exporter');
			const exporter = new TimelineCanvasExporter(this.app, this.settings);

			const result = await exporter.exportToCanvas(allEvents, {
				title: `${personName} Timeline`,
				filterPerson: personLink,
				layoutStyle: 'horizontal',
				colorScheme: 'event_type',
				includeOrderingEdges: true
			});

			if (result.success && result.path) {
				if (format === 'excalidraw') {
					// Convert to Excalidraw
					const { ExcalidrawExporter } = await import('./src/excalidraw/excalidraw-exporter');
					const excalidrawExporter = new ExcalidrawExporter(this.app);

					const canvasFile = this.app.vault.getAbstractFileByPath(result.path);
					if (!(canvasFile instanceof TFile)) {
						throw new Error('Canvas file not found after export');
					}

					const excalidrawResult = await excalidrawExporter.exportToExcalidraw({
						canvasFile,
						fileName: result.path.replace('.canvas', '').split('/').pop(),
						preserveColors: true
					});

					if (excalidrawResult.success && excalidrawResult.excalidrawContent) {
						// Save to vault root
						const excalidrawFileName = result.path.replace('.canvas', '.excalidraw.md').split('/').pop();
						const excalidrawPath = excalidrawFileName || result.path.replace('.canvas', '.excalidraw.md');
						await this.app.vault.create(excalidrawPath, excalidrawResult.excalidrawContent);
						new Notice(`Timeline exported to ${excalidrawPath}`);
						const file = this.app.vault.getAbstractFileByPath(excalidrawPath);
						if (file instanceof TFile) {
							void this.app.workspace.getLeaf(false).openFile(file);
						}
					} else {
						new Notice(`Excalidraw export failed: ${excalidrawResult.errors?.join(', ') || 'Unknown error'}`);
					}
				} else {
					new Notice(`Timeline exported to ${result.path}`);
					const file = this.app.vault.getAbstractFileByPath(result.path);
					if (file instanceof TFile) {
						void this.app.workspace.getLeaf(false).openFile(file);
					}
				}
			} else {
				new Notice(`Export failed: ${result.error || 'Unknown error'}`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Export failed: ${message}`);
		}
	}

	/**
	 * Add essential properties to person note(s)
	 * Supports batch operations on multiple files
	 */
	private async addEssentialPersonProperties(files: TFile[]) {
		try {
			let processedCount = 0;
			let skippedCount = 0;
			let errorCount = 0;

			for (const file of files) {
				try {
					let propertiesAdded = false;

					await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
						// cr_id: Generate if missing
						if (!frontmatter.cr_id) {
							frontmatter.cr_id = generateCrId();
							propertiesAdded = true;
						}

						// cr_type: Set to 'person' if missing
						if (!frontmatter.cr_type) {
							frontmatter.cr_type = 'person';
							propertiesAdded = true;
						}

						// name: Use filename if missing
						if (!frontmatter.name) {
							frontmatter.name = file.basename;
							propertiesAdded = true;
						}

						// born: Add as empty if missing
						if (!frontmatter.born) {
							frontmatter.born = '';
							propertiesAdded = true;
						}

						// died: Add as empty if missing
						if (!frontmatter.died) {
							frontmatter.died = '';
							propertiesAdded = true;
						}

						// father: Add as empty if missing
						if (!frontmatter.father) {
							frontmatter.father = '';
							propertiesAdded = true;
						}

						// mother: Add as empty if missing
						if (!frontmatter.mother) {
							frontmatter.mother = '';
							propertiesAdded = true;
						}

						// spouses: Add as empty array if missing
						if (!frontmatter.spouses) {
							frontmatter.spouses = [];
							propertiesAdded = true;
						}

						// children: Add as empty array if missing
						if (!frontmatter.children) {
							frontmatter.children = [];
							propertiesAdded = true;
						}

						// group_name: Add as empty if missing
						if (!frontmatter.group_name) {
							frontmatter.group_name = '';
							propertiesAdded = true;
						}
					});

					if (propertiesAdded) {
						processedCount++;
					} else {
						skippedCount++;
					}

				} catch (error: unknown) {
					console.error(`Error processing ${file.path}:`, error);
					errorCount++;
				}
			}

			// Show summary
			if (files.length === 1) {
				if (processedCount === 1) {
					new Notice('Added essential properties');
				} else if (skippedCount === 1) {
					new Notice('File already has all essential properties');
				} else {
					new Notice('Failed to add essential properties');
				}
			} else {
				const parts = [];
				if (processedCount > 0) parts.push(`${processedCount} updated`);
				if (skippedCount > 0) parts.push(`${skippedCount} already complete`);
				if (errorCount > 0) parts.push(`${errorCount} errors`);
				new Notice(`Essential properties: ${parts.join(', ')}`);
			}

		} catch (error: unknown) {
			console.error('Error adding essential person properties:', error);
			new Notice('Failed to add essential person properties');
		}
	}

	/**
	 * Add essential properties to place note(s)
	 * Supports batch operations on multiple files
	 */
	private async addEssentialPlaceProperties(files: TFile[]) {
		try {
			let processedCount = 0;
			let skippedCount = 0;
			let errorCount = 0;

			for (const file of files) {
				try {
					let propertiesAdded = false;

					await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
						// cr_type: Must be "place" (migrate from legacy 'type' property)
						if (frontmatter.cr_type !== 'place') {
							frontmatter.cr_type = 'place';
							propertiesAdded = true;
						}
						// Remove legacy 'type' property if it exists (migrated to cr_type)
						if (frontmatter.type === 'place') {
							delete frontmatter.type;
							propertiesAdded = true;
						}

						// cr_id: Generate if missing
						if (!frontmatter.cr_id) {
							frontmatter.cr_id = generateCrId();
							propertiesAdded = true;
						}

						// name: Use filename if missing
						if (!frontmatter.name) {
							frontmatter.name = file.basename;
							propertiesAdded = true;
						}

						// place_type: Add as empty if missing
						if (!frontmatter.place_type) {
							frontmatter.place_type = '';
							propertiesAdded = true;
						}

						// place_category: Default to 'real' if missing
						if (!frontmatter.place_category) {
							frontmatter.place_category = 'real';
							propertiesAdded = true;
						}
					});

					if (propertiesAdded) {
						processedCount++;
					} else {
						skippedCount++;
					}

				} catch (error: unknown) {
					console.error(`Error processing ${file.path}:`, error);
					errorCount++;
				}
			}

			// Show summary
			if (files.length === 1) {
				if (processedCount === 1) {
					new Notice('Added essential place properties');
				} else if (skippedCount === 1) {
					new Notice('File already has all essential place properties');
				} else {
					new Notice('Failed to add essential place properties');
				}
			} else {
				const parts = [];
				if (processedCount > 0) parts.push(`${processedCount} updated`);
				if (skippedCount > 0) parts.push(`${skippedCount} already complete`);
				if (errorCount > 0) parts.push(`${errorCount} errors`);
				new Notice(`Essential place properties: ${parts.join(', ')}`);
			}

		} catch (error: unknown) {
			console.error('Error adding essential place properties:', error);
			new Notice('Failed to add essential place properties');
		}
	}

	private async addEssentialMapProperties(files: TFile[]) {
		try {
			let processedCount = 0;
			let skippedCount = 0;
			let errorCount = 0;

			for (const file of files) {
				try {
					let propertiesAdded = false;

					await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
						// cr_type: Must be "map"
						if (frontmatter.cr_type !== 'map') {
							frontmatter.cr_type = 'map';
							propertiesAdded = true;
						}

						// map_id: Generate from filename if missing
						if (!frontmatter.map_id) {
							frontmatter.map_id = file.basename.toLowerCase().replace(/\s+/g, '-');
							propertiesAdded = true;
						}

						// name: Use filename if missing
						if (!frontmatter.name) {
							frontmatter.name = file.basename;
							propertiesAdded = true;
						}

						// universe: Add empty if missing
						if (!frontmatter.universe) {
							frontmatter.universe = '';
							propertiesAdded = true;
						}

						// image: Add empty if missing
						if (!frontmatter.image) {
							frontmatter.image = '';
							propertiesAdded = true;
						}

						// bounds: Add flat properties if missing (check for both flat and nested)
						const hasFlatBounds = frontmatter.bounds_north !== undefined;
						const hasNestedBounds = frontmatter.bounds && typeof frontmatter.bounds === 'object';
						if (!hasFlatBounds && !hasNestedBounds) {
							frontmatter.bounds_north = 100;
							frontmatter.bounds_south = -100;
							frontmatter.bounds_east = 100;
							frontmatter.bounds_west = -100;
							propertiesAdded = true;
						}
					});

					if (propertiesAdded) {
						processedCount++;
					} else {
						skippedCount++;
					}

				} catch (error: unknown) {
					console.error(`Error processing ${file.path}:`, error);
					errorCount++;
				}
			}

			// Show summary
			if (files.length === 1) {
				if (processedCount === 1) {
					new Notice('Added essential map properties');
				} else if (skippedCount === 1) {
					new Notice('File already has all essential map properties');
				} else {
					new Notice('Failed to add essential map properties');
				}
			} else {
				const parts = [];
				if (processedCount > 0) parts.push(`${processedCount} updated`);
				if (skippedCount > 0) parts.push(`${skippedCount} already complete`);
				if (errorCount > 0) parts.push(`${errorCount} errors`);
				new Notice(`Essential map properties: ${parts.join(', ')}`);
			}

		} catch (error: unknown) {
			console.error('Error adding essential map properties:', error);
			new Notice('Failed to add essential map properties');
		}
	}

	/**
	 * Add essential properties to source note(s)
	 * Supports batch operations on multiple files
	 */
	private async addEssentialSourceProperties(files: TFile[]) {
		try {
			let processedCount = 0;
			let skippedCount = 0;
			let errorCount = 0;

			for (const file of files) {
				try {
					let propertiesAdded = false;

					await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
						// type: Must be "source"
						if (frontmatter.type !== 'source') {
							frontmatter.type = 'source';
							propertiesAdded = true;
						}

						// cr_id: Generate if missing
						if (!frontmatter.cr_id) {
							frontmatter.cr_id = generateCrId();
							propertiesAdded = true;
						}

						// title: Use filename if missing
						if (!frontmatter.title) {
							frontmatter.title = file.basename;
							propertiesAdded = true;
						}

						// source_type: Default to 'other' if missing
						if (!frontmatter.source_type) {
							frontmatter.source_type = 'other';
							propertiesAdded = true;
						}

						// confidence: Default to 'unknown' if missing
						if (!frontmatter.confidence) {
							frontmatter.confidence = 'unknown';
							propertiesAdded = true;
						}

						// source_repository: Add empty if missing (check both new and legacy names)
						if (!frontmatter.source_repository && !frontmatter.repository) {
							frontmatter.source_repository = '';
							propertiesAdded = true;
						}

						// source_date: Add empty if missing (check both new and legacy names)
						if (!frontmatter.source_date && !frontmatter.date) {
							frontmatter.source_date = '';
							propertiesAdded = true;
						}
					});

					if (propertiesAdded) {
						processedCount++;
					} else {
						skippedCount++;
					}

				} catch (error: unknown) {
					console.error(`Error processing ${file.path}:`, error);
					errorCount++;
				}
			}

			// Show summary
			if (files.length === 1) {
				if (processedCount === 1) {
					new Notice('Added essential source properties');
				} else if (skippedCount === 1) {
					new Notice('File already has all essential source properties');
				} else {
					new Notice('Failed to add essential source properties');
				}
			} else {
				const parts = [];
				if (processedCount > 0) parts.push(`${processedCount} updated`);
				if (skippedCount > 0) parts.push(`${skippedCount} already complete`);
				if (errorCount > 0) parts.push(`${errorCount} errors`);
				new Notice(`Essential source properties: ${parts.join(', ')}`);
			}

		} catch (error: unknown) {
			console.error('Error adding essential source properties:', error);
			new Notice('Failed to add essential source properties');
		}
	}

	/**
	 * Add essential properties to event note(s)
	 * Supports batch operations on multiple files
	 */
	private async addEssentialEventProperties(files: TFile[]) {
		try {
			let processedCount = 0;
			let skippedCount = 0;
			let errorCount = 0;

			for (const file of files) {
				try {
					let propertiesAdded = false;

					await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
						// type: Must be "event"
						if (frontmatter.type !== 'event') {
							frontmatter.type = 'event';
							propertiesAdded = true;
						}

						// cr_id: Generate if missing
						if (!frontmatter.cr_id) {
							frontmatter.cr_id = generateCrId();
							propertiesAdded = true;
						}

						// title: Use filename if missing
						if (!frontmatter.title) {
							frontmatter.title = file.basename;
							propertiesAdded = true;
						}

						// event_type: Default to 'custom' if missing
						if (!frontmatter.event_type) {
							frontmatter.event_type = 'custom';
							propertiesAdded = true;
						}

						// date: Add empty if missing
						if (!frontmatter.date) {
							frontmatter.date = '';
							propertiesAdded = true;
						}

						// date_precision: Default to 'unknown' if missing
						if (!frontmatter.date_precision) {
							frontmatter.date_precision = 'unknown';
							propertiesAdded = true;
						}

						// person: Add empty if missing
						if (!frontmatter.person) {
							frontmatter.person = '';
							propertiesAdded = true;
						}

						// place: Add empty if missing
						if (!frontmatter.place) {
							frontmatter.place = '';
							propertiesAdded = true;
						}

						// confidence: Default to 'unknown' if missing
						if (!frontmatter.confidence) {
							frontmatter.confidence = 'unknown';
							propertiesAdded = true;
						}
					});

					if (propertiesAdded) {
						processedCount++;
					} else {
						skippedCount++;
					}

				} catch (error: unknown) {
					console.error(`Error processing ${file.path}:`, error);
					errorCount++;
				}
			}

			// Show summary
			if (files.length === 1) {
				if (processedCount === 1) {
					new Notice('Added essential event properties');
				} else if (skippedCount === 1) {
					new Notice('File already has all essential event properties');
				} else {
					new Notice('Failed to add essential event properties');
				}
			} else {
				const parts = [];
				if (processedCount > 0) parts.push(`${processedCount} updated`);
				if (skippedCount > 0) parts.push(`${skippedCount} already complete`);
				if (errorCount > 0) parts.push(`${errorCount} errors`);
				new Notice(`Essential event properties: ${parts.join(', ')}`);
			}

		} catch (error: unknown) {
			console.error('Error adding essential event properties:', error);
			new Notice('Failed to add essential event properties');
		}
	}

	/**
	 * Add cr_id to note(s) if missing
	 * Detects note type from frontmatter and uses appropriate prefix
	 * Supports batch operations on multiple files
	 */
	private async addCrId(files: TFile[]) {
		try {
			let processedCount = 0;
			let skippedCount = 0;
			let errorCount = 0;

			for (const file of files) {
				try {
					let idAdded = false;

					await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
						// Skip if cr_id already exists
						if (frontmatter.cr_id) {
							return;
						}

						// All note types use plain cr_id format (cr_type identifies the note type)
						frontmatter.cr_id = generateCrId();
						idAdded = true;
					});

					if (idAdded) {
						processedCount++;
					} else {
						skippedCount++;
					}

				} catch (error: unknown) {
					console.error(`Error processing ${file.path}:`, error);
					errorCount++;
				}
			}

			// Show summary
			if (files.length === 1) {
				if (processedCount === 1) {
					new Notice('Added cr_id');
				} else if (skippedCount === 1) {
					new Notice('File already has cr_id');
				} else {
					new Notice('Failed to add cr_id');
				}
			} else {
				const parts = [];
				if (processedCount > 0) parts.push(`${processedCount} updated`);
				if (skippedCount > 0) parts.push(`${skippedCount} already have cr_id`);
				if (errorCount > 0) parts.push(`${errorCount} errors`);
				new Notice(`Add cr_id: ${parts.join(', ')}`);
			}

		} catch (error: unknown) {
			console.error('Error adding cr_id:', error);
			new Notice('Failed to add cr_id');
		}
	}

	/**
	 * Insert dynamic content blocks into person note(s)
	 * Adds canvas-roots-timeline and canvas-roots-relationships code blocks
	 */
	private async insertDynamicBlocks(files: TFile[]): Promise<void> {
		// For bulk operations (10+ files), show progress
		const showProgress = files.length >= 10;
		let progressNotice: Notice | null = null;

		if (showProgress) {
			progressNotice = new Notice(
				`Inserting dynamic blocks: 0/${files.length}...`,
				0 // Don't auto-dismiss
			);
		}

		try {
			let addedCount = 0;
			let skippedCount = 0;
			let errorCount = 0;
			let processedCount = 0;

			for (const file of files) {
				try {
					// Check if this is a person note with cr_id
					const cache = this.app.metadataCache.getFileCache(file);
					if (!cache?.frontmatter?.cr_id) {
						skippedCount++;
						processedCount++;
						continue;
					}

					// Check if it already has dynamic blocks
					const content = await this.app.vault.read(file);
					const hasRelationships = content.includes('```canvas-roots-relationships');
					const hasTimeline = content.includes('```canvas-roots-timeline');

					if (hasRelationships && hasTimeline) {
						skippedCount++;
						processedCount++;
						continue;
					}

					// Build the blocks to add
					const blocksToAdd: string[] = [];

					if (!hasRelationships) {
						blocksToAdd.push('```canvas-roots-relationships');
						blocksToAdd.push('type: immediate');
						blocksToAdd.push('```');
						blocksToAdd.push('');
					}

					if (!hasTimeline) {
						blocksToAdd.push('```canvas-roots-timeline');
						blocksToAdd.push('sort: chronological');
						blocksToAdd.push('```');
						blocksToAdd.push('');
					}

					if (blocksToAdd.length === 0) {
						skippedCount++;
						processedCount++;
						continue;
					}

					// Find insertion point after frontmatter
					const frontmatterEnd = content.indexOf('---', 3);
					if (frontmatterEnd === -1) {
						// No frontmatter, add at start
						const newContent = blocksToAdd.join('\n') + '\n' + content;
						await this.app.vault.modify(file, newContent);
					} else {
						// Insert after frontmatter
						const insertPoint = frontmatterEnd + 3;
						const before = content.slice(0, insertPoint);
						const after = content.slice(insertPoint);
						// Ensure proper spacing
						const newContent = before + '\n\n' + blocksToAdd.join('\n') + after;
						await this.app.vault.modify(file, newContent);
					}

					addedCount++;
					processedCount++;

					// Update progress notice every 5 files or at the end
					if (progressNotice && (processedCount % 5 === 0 || processedCount === files.length)) {
						progressNotice.setMessage(
							`Inserting dynamic blocks: ${processedCount}/${files.length} (${addedCount} added)...`
						);
					}

				} catch (error: unknown) {
					console.error(`Error adding dynamic blocks to ${file.path}:`, error);
					errorCount++;
					processedCount++;
				}
			}

			// Hide progress notice
			if (progressNotice) {
				progressNotice.hide();
			}

			// Show summary
			if (files.length === 1) {
				if (addedCount === 1) {
					new Notice('Added dynamic content blocks');
				} else if (skippedCount === 1) {
					new Notice('Note already has dynamic blocks or is not a person note');
				} else {
					new Notice('Failed to add dynamic blocks');
				}
			} else {
				const parts = [];
				if (addedCount > 0) parts.push(`${addedCount} updated`);
				if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
				if (errorCount > 0) parts.push(`${errorCount} errors`);
				new Notice(`Dynamic blocks: ${parts.join(', ')}`);
			}

		} catch (error: unknown) {
			// Hide progress notice on error
			if (progressNotice) {
				progressNotice.hide();
			}
			console.error('Error inserting dynamic blocks:', error);
			new Notice('Failed to add dynamic blocks');
		}
	}

	/**
	 * Generate an Excalidraw tree directly from a person note
	 * Uses default settings for quick generation
	 */
	private async generateExcalidrawTreeForPerson(personFile: TFile) {
		try {
			new Notice('Generating Excalidraw tree...');

			// Get person info from file metadata
			const cache = this.app.metadataCache.getFileCache(personFile);
			if (!cache?.frontmatter?.cr_id) {
				new Notice('Invalid person note: missing cr_id');
				return;
			}

			const rootCrId = cache.frontmatter.cr_id;
			const rootName = cache.frontmatter.name || personFile.basename;

			// Generate tree with default settings
			const graphService = this.createFamilyGraphService();
			const familyTree = graphService.generateTree({
				rootCrId,
				treeType: 'full',
				maxGenerations: 5,
				includeSpouses: true
			});

			if (!familyTree) {
				new Notice('Failed to generate tree: root person not found');
				return;
			}

			// Generate canvas with default options
			const canvasGenerator = new CanvasGenerator();
			const canvasData = canvasGenerator.generateCanvas(familyTree, {
				direction: 'vertical',
				nodeSpacingX: 300,
				nodeSpacingY: 200,
				layoutType: this.settings.defaultLayoutType,
				nodeColorScheme: this.settings.nodeColorScheme,
				showLabels: true,
				useFamilyChartLayout: true,
				parentChildArrowStyle: this.settings.parentChildArrowStyle,
				spouseArrowStyle: this.settings.spouseArrowStyle,
				parentChildEdgeColor: this.settings.parentChildEdgeColor,
				spouseEdgeColor: this.settings.spouseEdgeColor,
				showSpouseEdges: this.settings.showSpouseEdges,
				spouseEdgeLabelFormat: this.settings.spouseEdgeLabelFormat,
				showSourceIndicators: this.settings.showSourceIndicators,
				showResearchCoverage: this.settings.trackFactSourcing
			});

			// Create temporary canvas file
			const tempCanvasName = `temp-${Date.now()}.canvas`;
			const tempCanvasPath = `${personFile.parent?.path || ''}/${tempCanvasName}`;
			const tempCanvasFile = await this.app.vault.create(tempCanvasPath, JSON.stringify(canvasData, null, '\t'));

			// Export to Excalidraw
			const exporter = new ExcalidrawExporter(this.app);
			const result = await exporter.exportToExcalidraw({
				canvasFile: tempCanvasFile,
				preserveColors: true,
				fontSize: 16,
				strokeWidth: 2
			});

			// Delete temporary canvas file (respects user's deletion preference)
			await this.app.fileManager.trashFile(tempCanvasFile);

			if (!result.success) {
				new Notice(`Export failed: ${result.errors.join(', ')}`);
				return;
			}

			// Save Excalidraw file to vault root
			const outputFileName = `Family Tree - ${rootName}.excalidraw.md`;

			// Check if file exists and create unique name if needed
			let finalPath = outputFileName;
			let counter = 1;
			while (this.app.vault.getAbstractFileByPath(finalPath)) {
				finalPath = `Family Tree - ${rootName} (${counter}).excalidraw.md`;
				counter++;
			}

			await this.app.vault.create(finalPath, result.excalidrawContent!);

			new Notice(`Generated Excalidraw tree with ${result.elementsExported} elements`);

			// Open the newly created file
			const excalidrawFile = this.app.vault.getAbstractFileByPath(finalPath);
			if (excalidrawFile instanceof TFile) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(excalidrawFile);
			}
		} catch (error: unknown) {
			console.error('Error generating Excalidraw tree:', error);
			new Notice(`Failed to generate Excalidraw tree: ${getErrorMessage(error)}`);
		}
	}

	private async createBaseTemplate(folder?: TFolder) {
		try {
			// Validate: Check if Bases feature is available
			// Bases is a core Obsidian feature (1.9.0+), not a community plugin
			const baseFiles = this.app.vault.getFiles().filter(f => f.extension === 'base');
			// @ts-expect-error - accessing internal plugins
			const basesInternalPlugin = this.app.internalPlugins?.plugins?.['bases'];
			const isBasesAvailable = baseFiles.length > 0 ||
				(basesInternalPlugin?.enabled === true);

			if (!isBasesAvailable) {
				const proceed = await this.confirmBaseCreation();
				if (!proceed) return;
			}

			// Determine the target path - use basesFolder if configured, otherwise use context folder
			const targetFolder = this.settings.basesFolder || (folder ? folder.path : '');
			const folderPath = targetFolder ? targetFolder + '/' : '';
			const defaultPath = folderPath + 'family-members.base';

			// Create the bases folder if it doesn't exist
			if (this.settings.basesFolder && !this.app.vault.getAbstractFileByPath(this.settings.basesFolder)) {
				await this.app.vault.createFolder(this.settings.basesFolder);
			}

			// Check if file already exists
			const existingFile = this.app.vault.getAbstractFileByPath(defaultPath);
			if (existingFile) {
				new Notice(`Base template already exists at ${defaultPath}`);
				// Open the existing file
				if (existingFile instanceof TFile) {
					const leaf = this.app.workspace.getLeaf(false);
					await leaf.openFile(existingFile);
				}
				return;
			}

			// Create the file with template content (using aliased property names)
			const templateContent = generatePeopleBaseTemplate({
				aliases: this.settings.propertyAliases,
				maxLivingAge: this.settings.livingPersonAgeThreshold
			});
			const file = await this.app.vault.create(defaultPath, templateContent);

			new Notice('Base template created with 22 pre-configured views!');
			logger.info('base-template', `Created base template at ${defaultPath}`);

			// Open the newly created file
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('base-template', 'Failed to create base template', error);

			// Provide specific error messages
			if (errorMsg.includes('already exists')) {
				new Notice('A file with this name already exists.');
			} else if (errorMsg.includes('permission') || errorMsg.includes('EACCES')) {
				new Notice('Permission denied. Check file system permissions.');
			} else if (errorMsg.includes('ENOSPC')) {
				new Notice('Disk full. Free up space and try again.');
			} else {
				new Notice(`Failed to create Base template: ${errorMsg}`);
			}
		}
	}

	/**
	 * Create a places base template file in the specified folder
	 */
	private async createPlacesBaseTemplate(folder?: TFolder) {
		try {
			// Validate: Check if Bases feature is available
			// Bases is a core Obsidian feature (1.9.0+), not a community plugin
			const baseFiles = this.app.vault.getFiles().filter(f => f.extension === 'base');
			// @ts-expect-error - accessing internal plugins
			const basesInternalPlugin = this.app.internalPlugins?.plugins?.['bases'];
			const isBasesAvailable = baseFiles.length > 0 ||
				(basesInternalPlugin?.enabled === true);

			if (!isBasesAvailable) {
				const proceed = await this.confirmBaseCreation();
				if (!proceed) return;
			}

			// Determine the target path - use basesFolder if configured, otherwise use context folder
			const targetFolder = this.settings.basesFolder || (folder ? folder.path : '');
			const folderPath = targetFolder ? targetFolder + '/' : '';
			const defaultPath = folderPath + 'places.base';

			// Create the bases folder if it doesn't exist
			if (this.settings.basesFolder && !this.app.vault.getAbstractFileByPath(this.settings.basesFolder)) {
				await this.app.vault.createFolder(this.settings.basesFolder);
			}

			// Check if file already exists
			const existingFile = this.app.vault.getAbstractFileByPath(defaultPath);
			if (existingFile) {
				new Notice(`Places base template already exists at ${defaultPath}`);
				// Open the existing file
				if (existingFile instanceof TFile) {
					const leaf = this.app.workspace.getLeaf(false);
					await leaf.openFile(existingFile);
				}
				return;
			}

			// Create the file with template content (using aliased property names)
			const templateContent = generatePlacesBaseTemplate(this.settings.propertyAliases);
			const file = await this.app.vault.create(defaultPath, templateContent);

			new Notice('Places base template created with 14 pre-configured views!');
			logger.info('places-base-template', `Created places base template at ${defaultPath}`);

			// Open the newly created file
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('places-base-template', 'Failed to create places base template', error);

			// Provide specific error messages
			if (errorMsg.includes('already exists')) {
				new Notice('A file with this name already exists.');
			} else if (errorMsg.includes('permission') || errorMsg.includes('EACCES')) {
				new Notice('Permission denied. Check file system permissions.');
			} else if (errorMsg.includes('ENOSPC')) {
				new Notice('Disk full. Free up space and try again.');
			} else {
				new Notice(`Failed to create Places base template: ${errorMsg}`);
			}
		}
	}

	/**
	 * Create an organizations base template file in the specified folder
	 */
	private async createOrganizationsBaseTemplate(folder?: TFolder) {
		try {
			// Validate: Check if Bases feature is available
			// Bases is a core Obsidian feature (1.9.0+), not a community plugin
			const baseFiles = this.app.vault.getFiles().filter(f => f.extension === 'base');
			// @ts-expect-error - accessing internal plugins
			const basesInternalPlugin = this.app.internalPlugins?.plugins?.['bases'];
			const isBasesAvailable = baseFiles.length > 0 ||
				(basesInternalPlugin?.enabled === true);

			if (!isBasesAvailable) {
				const proceed = await this.confirmBaseCreation();
				if (!proceed) return;
			}

			// Determine the target path - use basesFolder if configured, otherwise use context folder
			const targetFolder = this.settings.basesFolder || (folder ? folder.path : '');
			const folderPath = targetFolder ? targetFolder + '/' : '';
			const defaultPath = folderPath + 'organizations.base';

			// Create the bases folder if it doesn't exist
			if (this.settings.basesFolder && !this.app.vault.getAbstractFileByPath(this.settings.basesFolder)) {
				await this.app.vault.createFolder(this.settings.basesFolder);
			}

			// Check if file already exists
			const existingFile = this.app.vault.getAbstractFileByPath(defaultPath);
			if (existingFile) {
				new Notice(`Organizations base template already exists at ${defaultPath}`);
				// Open the existing file
				if (existingFile instanceof TFile) {
					const leaf = this.app.workspace.getLeaf(false);
					await leaf.openFile(existingFile);
				}
				return;
			}

			// Create the file with template content
			const file = await this.app.vault.create(defaultPath, ORGANIZATIONS_BASE_TEMPLATE);

			new Notice('Organizations base template created with 17 pre-configured views!');
			logger.info('organizations-base-template', `Created organizations base template at ${defaultPath}`);

			// Open the newly created file
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('organizations-base-template', 'Failed to create organizations base template', error);

			// Provide specific error messages
			if (errorMsg.includes('already exists')) {
				new Notice('A file with this name already exists.');
			} else if (errorMsg.includes('permission') || errorMsg.includes('EACCES')) {
				new Notice('Permission denied. Check file system permissions.');
			} else if (errorMsg.includes('ENOSPC')) {
				new Notice('Disk full. Free up space and try again.');
			} else {
				new Notice(`Failed to create Organizations base template: ${errorMsg}`);
			}
		}
	}

	/**
	 * Create a sources base template file in the specified folder
	 */
	private async createSourcesBaseTemplate(folder?: TFolder) {
		try {
			// Validate: Check if Bases feature is available
			// Bases is a core Obsidian feature (1.9.0+), not a community plugin
			const baseFiles = this.app.vault.getFiles().filter(f => f.extension === 'base');
			// @ts-expect-error - accessing internal plugins
			const basesInternalPlugin = this.app.internalPlugins?.plugins?.['bases'];
			const isBasesAvailable = baseFiles.length > 0 ||
				(basesInternalPlugin?.enabled === true);

			if (!isBasesAvailable) {
				const proceed = await this.confirmBaseCreation();
				if (!proceed) return;
			}

			// Determine the target path - use basesFolder if configured, otherwise use context folder
			const targetFolder = this.settings.basesFolder || (folder ? folder.path : '');
			const folderPath = targetFolder ? targetFolder + '/' : '';
			const defaultPath = folderPath + 'sources.base';

			// Create the bases folder if it doesn't exist
			if (this.settings.basesFolder && !this.app.vault.getAbstractFileByPath(this.settings.basesFolder)) {
				await this.app.vault.createFolder(this.settings.basesFolder);
			}

			// Check if file already exists
			const existingFile = this.app.vault.getAbstractFileByPath(defaultPath);
			if (existingFile) {
				new Notice(`Sources base template already exists at ${defaultPath}`);
				// Open the existing file
				if (existingFile instanceof TFile) {
					const leaf = this.app.workspace.getLeaf(false);
					await leaf.openFile(existingFile);
				}
				return;
			}

			// Create the file with template content
			const file = await this.app.vault.create(defaultPath, SOURCES_BASE_TEMPLATE);

			new Notice('Sources base template created with 18 pre-configured views!');
			logger.info('sources-base-template', `Created sources base template at ${defaultPath}`);

			// Open the newly created file
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('sources-base-template', 'Failed to create sources base template', error);

			// Provide specific error messages
			if (errorMsg.includes('already exists')) {
				new Notice('A file with this name already exists.');
			} else if (errorMsg.includes('permission') || errorMsg.includes('EACCES')) {
				new Notice('Permission denied. Check file system permissions.');
			} else if (errorMsg.includes('ENOSPC')) {
				new Notice('Disk full. Free up space and try again.');
			} else {
				new Notice(`Failed to create Sources base template: ${errorMsg}`);
			}
		}
	}

	/**
	 * Create an events base template file in the specified folder
	 */
	private async createEventsBaseTemplate(folder?: TFolder) {
		try {
			// Validate: Check if Bases feature is available
			// Bases is a core Obsidian feature (1.9.0+), not a community plugin
			const baseFiles = this.app.vault.getFiles().filter(f => f.extension === 'base');
			// @ts-expect-error - accessing internal plugins
			const basesInternalPlugin = this.app.internalPlugins?.plugins?.['bases'];
			const isBasesAvailable = baseFiles.length > 0 ||
				(basesInternalPlugin?.enabled === true);

			if (!isBasesAvailable) {
				const proceed = await this.confirmBaseCreation();
				if (!proceed) return;
			}

			// Determine the target path - use basesFolder if configured, otherwise use context folder
			const targetFolder = this.settings.basesFolder || (folder ? folder.path : '');
			const folderPath = targetFolder ? targetFolder + '/' : '';
			const defaultPath = folderPath + 'events.base';

			// Create the bases folder if it doesn't exist
			if (this.settings.basesFolder && !this.app.vault.getAbstractFileByPath(this.settings.basesFolder)) {
				await this.app.vault.createFolder(this.settings.basesFolder);
			}

			// Check if file already exists
			const existingFile = this.app.vault.getAbstractFileByPath(defaultPath);
			if (existingFile) {
				new Notice(`Events base template already exists at ${defaultPath}`);
				// Open the existing file
				if (existingFile instanceof TFile) {
					const leaf = this.app.workspace.getLeaf(false);
					await leaf.openFile(existingFile);
				}
				return;
			}

			// Create the file with template content (using aliased property names)
			const templateContent = generateEventsBaseTemplate(this.settings.propertyAliases);
			const file = await this.app.vault.create(defaultPath, templateContent);

			new Notice('Events base template created with 20 pre-configured views!');
			logger.info('events-base-template', `Created events base template at ${defaultPath}`);

			// Open the newly created file
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('events-base-template', 'Failed to create events base template', error);

			// Provide specific error messages
			if (errorMsg.includes('already exists')) {
				new Notice('A file with this name already exists.');
			} else if (errorMsg.includes('permission') || errorMsg.includes('EACCES')) {
				new Notice('Permission denied. Check file system permissions.');
			} else if (errorMsg.includes('ENOSPC')) {
				new Notice('Disk full. Free up space and try again.');
			} else {
				new Notice(`Failed to create Events base template: ${errorMsg}`);
			}
		}
	}

	/**
	 * Confirm base creation if Bases plugin may not be installed
	 */
	private async confirmBaseCreation(): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Bases plugin not detected');

			modal.contentEl.createEl('p', {
				text: 'The Obsidian Bases plugin does not appear to be installed. The .base file will be created, but you\'ll need to install the Bases plugin to use it.'
			});

			modal.contentEl.createEl('p', {
				text: 'Would you like to create the template anyway?',
				cls: 'cr-confirm-text'
			});

			const buttonContainer = modal.contentEl.createDiv({ cls: 'cr-prompt-buttons' });

			const createBtn = buttonContainer.createEl('button', {
				text: 'Create anyway',
				cls: 'mod-cta'
			});
			createBtn.addEventListener('click', () => {
				modal.close();
				resolve(true);
			});

			const cancelBtn = buttonContainer.createEl('button', {
				text: 'Cancel'
			});
			cancelBtn.addEventListener('click', () => {
				modal.close();
				resolve(false);
			});

			modal.open();
		});
	}

	/**
	 * Migrate collection_name property to group_name
	 * Runs once on plugin load to ensure all person notes use the new property name
	 */
	private async migrateCollectionNameToGroupName() {
		try {
			const files = this.app.vault.getMarkdownFiles();
			let migratedCount = 0;

			for (const file of files) {
				const cache = this.app.metadataCache.getFileCache(file);

				// Check if this file has collection_name but not group_name
				if (cache?.frontmatter?.collection_name && !cache.frontmatter?.group_name) {
					await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
						// Copy collection_name to group_name
						frontmatter.group_name = frontmatter.collection_name;
						// Remove old property
						delete frontmatter.collection_name;
					});
					migratedCount++;
				}
			}

			if (migratedCount > 0) {
				logger.info('migration', `Migrated ${migratedCount} files from collection_name to group_name`);
			}
		} catch (error: unknown) {
			logger.error('migration', 'Error during collection_name to group_name migration', error);
		}
	}

	/**
	 * Show folder statistics modal
	 */
	private showFolderStatistics(folder: TFolder): void {
		new FolderStatisticsModal(this.app, folder).open();
	}

	/**
	 * Open a canvas file's tree in the Family Chart view
	 * Extracts the root person from canvas metadata
	 */
	async openCanvasInFamilyChart(file: TFile): Promise<void> {
		try {
			const canvasContent = await this.app.vault.read(file);
			const canvasData = JSON.parse(canvasContent);
			const metadata = canvasData.metadata?.frontmatter;

			if (metadata?.plugin !== 'canvas-roots' || !metadata.generation?.rootCrId) {
				new Notice('This canvas does not contain Canvas Roots tree data');
				return;
			}

			const rootCrId = metadata.generation.rootCrId;
			// Open in main workspace when triggered from canvas context menu
			await this.activateFamilyChartView(rootCrId, true);
		} catch (error) {
			logger.error('open-canvas-chart', 'Failed to open canvas in family chart', error);
			new Notice('Failed to read canvas file');
		}
	}

	/**
	 * Activate the Family Chart view
	 * Opens an existing view or creates a new one
	 * @param rootPersonId - Optional cr_id to set as root person
	 * @param useMainWorkspace - If true, opens in main workspace instead of sidebar
	 * @param forceNew - If true, always creates a new view even if one exists
	 */
	async activateFamilyChartView(rootPersonId?: string, useMainWorkspace: boolean = true, forceNew: boolean = false): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_FAMILY_CHART);
		let isNewLeaf = false;

		// Check if we should reuse an existing leaf
		// Only reuse if one exists, we're not forcing new, AND we have a root person to show
		// (without a root person, opening existing view would show stale data)
		if (leaves.length > 0 && !forceNew && rootPersonId) {
			// Find an existing leaf, preferring one in main workspace if useMainWorkspace is true
			if (useMainWorkspace) {
				// Try to find a leaf in main workspace first
				const mainLeaf = leaves.find(l => l.getRoot() === workspace.rootSplit);
				leaf = mainLeaf || leaves[0];
			} else {
				leaf = leaves[0];
			}
		}

		// If no suitable existing leaf or if we need a new one
		if (!leaf) {
			// Create a new leaf based on placement preference
			if (useMainWorkspace) {
				// Open in main workspace as a new tab
				leaf = workspace.getLeaf('tab');
			} else {
				// Open in right sidebar
				leaf = workspace.getRightLeaf(false);
			}
			if (leaf) {
				// Pass rootPersonId in the initial state to avoid timing issues
				// The view's setState() will be called with this state before onOpen()
				await leaf.setViewState({
					type: VIEW_TYPE_FAMILY_CHART,
					active: true,
					state: rootPersonId ? { rootPersonId } : undefined
				});
				isNewLeaf = true;
			}
		}

		// Reveal the leaf in case it is in a collapsed sidebar
		if (leaf) {
			void workspace.revealLeaf(leaf);

			// If reusing an existing leaf, set the root person directly
			// (for new leaves, the state was already passed via setViewState)
			if (!isNewLeaf && rootPersonId && leaf.view instanceof FamilyChartView) {
				leaf.view.setRootPerson(rootPersonId);
			}
		}
	}

	/**
	 * Activate the Map view
	 * Opens an existing view or creates a new one
	 * @param mapId Optional map ID to switch to after opening
	 * @param forceNew If true, always create a new map view (for side-by-side comparison)
	 * @param splitDirection If provided, split the existing map view in this direction
	 */
	async activateMapView(mapId?: string, forceNew = false, splitDirection?: 'horizontal' | 'vertical'): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_MAP);

		if (!forceNew && leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else if (forceNew && leaves.length > 0 && splitDirection) {
			// Split an existing map view
			const existingLeaf = leaves[0];
			leaf = workspace.createLeafBySplit(existingLeaf, splitDirection);
			if (leaf) {
				await leaf.setViewState({ type: VIEW_TYPE_MAP, active: true });
			}
		} else {
			// Open in main workspace as a new tab
			leaf = workspace.getLeaf('tab');
			if (leaf) {
				await leaf.setViewState({ type: VIEW_TYPE_MAP, active: true });
			}
		}

		// Reveal the leaf
		if (leaf) {
			void workspace.revealLeaf(leaf);

			// If a specific map was requested, switch to it after the view is ready
			if (mapId && leaf.view) {
				// Use a short delay to ensure the map controller is initialized
				setTimeout(() => {
					const mapView = leaf?.view as { mapController?: { setActiveMap: (id: string) => Promise<void> } };
					if (mapView?.mapController?.setActiveMap) {
						void mapView.mapController.setActiveMap(mapId);
					}
				}, 100);
			}
		}
	}

	/**
	 * Move a Family Chart view from sidebar to main workspace
	 * Called from the view's toolbar
	 */
	async moveFamilyChartToMainWorkspace(currentLeaf: WorkspaceLeaf): Promise<void> {
		const { workspace } = this.app;

		// Get the current state before moving
		const currentView = currentLeaf.view;
		let rootPersonId: string | null = null;
		if (currentView instanceof FamilyChartView) {
			const state = currentView.getState();
			rootPersonId = state.rootPersonId;
		}

		// Close the current leaf
		currentLeaf.detach();

		// Open in main workspace
		const newLeaf = workspace.getLeaf('tab');
		await newLeaf.setViewState({ type: VIEW_TYPE_FAMILY_CHART, active: true });
		void workspace.revealLeaf(newLeaf);

		// Restore the root person
		if (rootPersonId && newLeaf.view instanceof FamilyChartView) {
			newLeaf.view.setRootPerson(rootPersonId);
		}
	}
}
