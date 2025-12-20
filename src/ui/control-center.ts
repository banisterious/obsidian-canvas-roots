import { App, Menu, MenuItem, Modal, Notice, Platform, Setting, TFile, TFolder, setIcon, ToggleComponent, normalizePath } from 'obsidian';
import CanvasRootsPlugin from '../../main';
import { TAB_CONFIGS, createLucideIcon, setLucideIcon, LucideIconName } from './lucide-icons';
import { ensureFolderExists } from '../core/canvas-utils';
import { createPersonNote, PersonData } from '../core/person-note-writer';
import { PersonPickerModal, PersonInfo, PlaceInfo, extractPlaceInfo } from './person-picker';
import { VaultStatsService, FullVaultStats } from '../core/vault-stats';
import { FamilyGraphService, TreeOptions, PersonNode } from '../core/family-graph';
import { CanvasGenerator, CanvasData, CanvasGenerationOptions } from '../core/canvas-generator';
import { getLogger } from '../core/logging';
import { getErrorMessage } from '../core/error-utils';
import { GedcomImporterV2 } from '../gedcom/gedcom-importer-v2';
import type { GedcomImportOptionsV2, FilenameFormat, FilenameFormatOptions, GedcomDataV2 } from '../gedcom/gedcom-types';
import { analyzeGedcomQuality, applyQualityFixes } from '../gedcom/gedcom-quality-analyzer';
import { GedcomQualityPreviewModal } from './gedcom-quality-preview-modal';
import { GedcomXImporter, GedcomXImportResult } from '../gedcomx/gedcomx-importer';
import { GedcomXParser } from '../gedcomx/gedcomx-parser';
import { GrampsImporter, GrampsImportResult } from '../gramps/gramps-importer';
import { GrampsParser } from '../gramps/gramps-parser';
import { readFileWithDecompression } from '../core/compression-utils';
import { GedcomImportProgressModal } from './gedcom-import-progress-modal';
import { SchemaValidationProgressModal } from './schema-validation-progress-modal';
import { BidirectionalLinker } from '../core/bidirectional-linker';
import { TreePreviewRenderer } from './tree-preview';
import { ReferenceNumberingService, NumberingSystem } from '../core/reference-numbering';
import type { RecentTreeInfo, RecentImportInfo, ColorScheme } from '../settings';
import { FolderFilterService } from '../core/folder-filter';
import { StagingService, StagingSubfolderInfo } from '../core/staging-service';
import { CrossImportDetectionService, CrossImportMatch } from '../core/cross-import-detection';
import { MergeWizardModal } from './merge-wizard-modal';
import { DataQualityService, DataQualityReport, DataQualityIssue, IssueSeverity, IssueCategory, NormalizationPreview, BatchOperationResult, BidirectionalInconsistency, ImpossibleDateIssue } from '../core/data-quality';
import { PlaceGraphService } from '../core/place-graph';
import { CreatePlaceModal } from './create-place-modal';
import { MigrationDiagramModal } from './migration-diagram-modal';
import { PlaceNetworkModal } from './place-network-modal';
import { TemplateSnippetsModal } from './template-snippets-modal';
import { CreatePersonModal } from './create-person-modal';
import { CreateMapModal } from './create-map-modal';
import { renderWorldMapPreview } from '../maps/ui/world-map-preview';
import { BulkGeocodeModal } from '../maps/ui/bulk-geocode-modal';
import { CreateSchemaModal } from './create-schema-modal';
import { SchemaService, ValidationService } from '../schemas';
import type { SchemaNote, ValidationResult, ValidationSummary } from '../schemas';
import { renderRelationshipsTab } from '../relationships';
import { renderEventsTab } from '../dates';
import { renderOrganizationsTab } from '../organizations';
import { renderStatisticsTab } from '../statistics';
import { renderPersonTimeline, createTimelineSummary } from '../events/ui/person-timeline';
import { AddPersonTypePreviewModal } from './add-person-type-modal';
import { renderFamilyTimeline, getFamilyTimelineSummary } from '../events/ui/family-timeline';
import { renderPlaceTimelineCard } from '../events/ui/place-timeline';
import { renderPreferencesTab } from './preferences-tab';
import { renderDashboardTab } from './dashboard-tab';
import { renderPlacesTab } from './places-tab';
import { PropertyAliasService } from '../core/property-alias-service';
import { CreateEventModal } from '../events/ui/create-event-modal';
import { ExportOptionsBuilder } from './export-options-builder';
import { FlattenNestedPropertiesModal } from './flatten-nested-properties-modal';
import { PlaceGeneratorModal } from '../enhancement/ui/place-generator-modal';
import {
	renderSourcesTab,
	EvidenceService,
	FACT_KEY_LABELS,
	FACT_KEYS,
	SourcePickerModal,
	SOURCE_QUALITY_LABELS,
	ProofSummaryService,
	CreateProofModal,
	PROOF_STATUS_LABELS,
	PROOF_CONFIDENCE_LABELS
} from '../sources';
import { isPersonNote } from '../utils/note-type-detection';
import { UniverseService } from '../universes/services/universe-service';
import { UniverseWizardModal } from '../universes/ui/universe-wizard';
import { EditUniverseModal } from '../universes/ui/edit-universe-modal';
import type { UniverseInfo, UniverseEntityCounts } from '../universes/types';
import type {
	FactKey,
	ResearchGapsSummary,
	PersonResearchCoverage,
	FactCoverageStatus,
	SourcedFacts,
	ProofSummaryNote
} from '../sources';

const logger = getLogger('ControlCenter');

/**
 * Safely convert frontmatter/data value to string
 */
function toSafeString(value: unknown): string {
	if (value === undefined || value === null) return '';
	if (typeof value === 'object' && value !== null) return JSON.stringify(value);
	// At this point, value is a primitive
	return String(value as string | number | boolean | bigint | symbol);
}

/**
 * Relationship field data
 */
interface RelationshipField {
	name: string;
	crId?: string;
	birthDate?: string;
	deathDate?: string;
}

/**
 * Canvas Roots Control Center Modal
 * Centralized interface for all plugin operations
 */
export class ControlCenterModal extends Modal {
	plugin: CanvasRootsPlugin;
	private activeTab: string = 'dashboard';
	private drawer: HTMLElement;
	private contentContainer: HTMLElement;
	private appBar: HTMLElement;
	private drawerBackdrop: HTMLElement;

	// Relationship field data
	private fatherField: RelationshipField = { name: '' };
	private motherField: RelationshipField = { name: '' };
	private spouseField: RelationshipField = { name: '' };

	// Relationship field UI elements (for Data Entry tab)
	private fatherInput?: HTMLInputElement;
	private fatherBtn?: HTMLButtonElement;
	private fatherHelp?: HTMLElement;
	private motherInput?: HTMLInputElement;
	private motherBtn?: HTMLButtonElement;
	private motherHelp?: HTMLElement;
	private spouseInput?: HTMLInputElement;
	private spouseBtn?: HTMLButtonElement;
	private spouseHelp?: HTMLElement;

	// Tree Output tab state
	private treeCanvasNameInput?: HTMLInputElement;
	private treeGenerateBtn?: HTMLButtonElement;
	private pendingRootPerson?: PersonInfo;
	private treePreviewRenderer?: TreePreviewRenderer;
	private treePreviewContainer?: HTMLElement;

	constructor(app: App, plugin: CanvasRootsPlugin, initialTab?: string) {
		super(app);
		this.plugin = plugin;
		if (initialTab) {
			this.activeTab = initialTab;
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-control-center-modal');

		// Create modal structure
		this.createModalContainer();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Create the main modal container with header, drawer, and content
	 */
	private createModalContainer(): void {
		const { contentEl } = this;

		// Main modal container
		const modalContainer = contentEl.createDiv({ cls: 'crc-modal-container' });

		// Sticky header
		this.createStickyHeader(modalContainer);

		// Main container (drawer + content)
		const mainContainer = modalContainer.createDiv({ cls: 'crc-main-container' });

		// Navigation drawer
		this.createNavigationDrawer(mainContainer);

		// Content area
		this.contentContainer = mainContainer.createDiv({ cls: 'crc-content-area' });

		// Show initial tab
		this.showTab(this.activeTab);
	}

	/**
	 * Create sticky header with title
	 */
	private createStickyHeader(container: HTMLElement): void {
		this.appBar = container.createDiv({ cls: 'crc-sticky-header' });

		// Mobile menu toggle button (hidden on desktop via CSS)
		const menuToggle = this.appBar.createEl('button', {
			cls: 'crc-mobile-menu-toggle',
			attr: { type: 'button' }
		});
		setIcon(menuToggle, 'menu');
		menuToggle.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.toggleMobileDrawer();
		});

		// Title section
		const titleSection = this.appBar.createDiv({ cls: 'crc-header-title' });
		const titleIcon = createLucideIcon('git-branch', 20);
		titleSection.appendChild(titleIcon);
		titleSection.appendText('Canvas Roots Control Center');

		// Action buttons section
		const actionsSection = this.appBar.createDiv({ cls: 'crc-header-actions' });
		this.createHeaderActions(actionsSection);
	}

	/**
	 * Create header action buttons
	 */
	private createHeaderActions(_container: HTMLElement): void {
		// Reserved for future header actions (e.g., help, settings)
		// The modal's native close button (X) is sufficient
	}

	/**
	 * Check if we're in mobile mode
	 */
	private isMobileMode(): boolean {
		return Platform.isMobile || document.body.classList.contains('is-mobile');
	}

	/**
	 * Create navigation drawer with tab list
	 */
	private createNavigationDrawer(container: HTMLElement): void {
		// Mobile backdrop (hidden on desktop via CSS)
		this.drawerBackdrop = container.createDiv({ cls: 'crc-drawer-backdrop' });
		this.drawerBackdrop.addEventListener('click', () => this.closeMobileDrawer());

		this.drawer = container.createDiv({ cls: 'crc-drawer' });

		// Add mobile class directly if in mobile mode
		if (this.isMobileMode()) {
			this.drawer.addClass('crc-drawer--mobile');
			this.drawerBackdrop.addClass('crc-drawer-backdrop--mobile');
			this.modalEl.addClass('crc-mobile-mode');
		}

		// Mobile close button (hidden on desktop via CSS)
		const closeBtn = this.drawer.createEl('button', {
			cls: 'crc-drawer-close',
			attr: { type: 'button' }
		});
		setIcon(closeBtn, 'x');
		closeBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.closeMobileDrawer();
		});

		// Drawer header
		const header = this.drawer.createDiv({ cls: 'crc-drawer__header' });
		const headerTitle = header.createDiv({ cls: 'crc-drawer__title' });
		headerTitle.textContent = 'Navigation';

		// Drawer content
		const content = this.drawer.createDiv({ cls: 'crc-drawer__content' });
		this.createNavigationList(content);
	}

	/**
	 * Toggle mobile drawer visibility
	 */
	private toggleMobileDrawer(): void {
		const isOpen = this.drawer.classList.contains('crc-drawer--open');
		if (isOpen) {
			this.closeMobileDrawer();
		} else {
			this.openMobileDrawer();
		}
	}

	/**
	 * Open mobile drawer
	 */
	private openMobileDrawer(): void {
		this.drawer.classList.add('crc-drawer--open');
		this.drawerBackdrop.classList.add('crc-drawer-backdrop--visible');
	}

	/**
	 * Close mobile drawer
	 */
	private closeMobileDrawer(): void {
		this.drawer.classList.remove('crc-drawer--open');
		this.drawerBackdrop.classList.remove('crc-drawer-backdrop--visible');
	}

	/**
	 * Check if the Universes tab should be visible
	 * Shows when universes exist or orphan universe references exist
	 */
	private shouldShowUniversesTab(): boolean {
		const universeService = new UniverseService(this.plugin);
		const universes = universeService.getAllUniverses();
		const orphans = universeService.findOrphanUniverses();
		return universes.length > 0 || orphans.length > 0;
	}

	/**
	 * Create navigation list with all tabs
	 */
	private createNavigationList(container: HTMLElement): void {
		const list = container.createEl('ul', { cls: 'crc-nav-list' });

		// Check conditional visibility for universes tab
		const showUniverses = this.shouldShowUniversesTab();

		TAB_CONFIGS.forEach((tabConfig) => {
			// Skip universes tab if no universes exist
			if (tabConfig.id === 'universes' && !showUniverses) {
				return;
			}

			const listItem = list.createEl('li', {
				cls: `crc-nav-item ${tabConfig.id === this.activeTab ? 'crc-nav-item--active' : ''}`
			});
			listItem.setAttribute('data-tab', tabConfig.id);

			// Icon
			const graphic = listItem.createDiv({ cls: 'crc-nav-item__icon' });
			setLucideIcon(graphic, tabConfig.icon, 20);

			// Text
			const text = listItem.createDiv({ cls: 'crc-nav-item__text' });
			text.textContent = tabConfig.name;

			// Click handler
			listItem.addEventListener('click', () => {
				this.switchTab(tabConfig.id);
			});
		});
	}

	/**
	 * Switch to a different tab
	 */
	private switchTab(tabId: string): void {
		// Update active state in navigation
		this.drawer.querySelectorAll('.crc-nav-item').forEach(item => {
			item.classList.remove('crc-nav-item--active');
		});

		const activeItem = this.drawer.querySelector(`[data-tab="${tabId}"]`);
		if (activeItem) {
			activeItem.classList.add('crc-nav-item--active');
		}

		// Reset scroll position to top
		this.contentContainer.scrollTop = 0;

		// Update active tab and show content
		this.activeTab = tabId;
		this.showTab(tabId);

		// Close drawer on mobile after selecting a tab
		if (Platform.isMobile) {
			this.closeMobileDrawer();
		}
	}

	/**
	 * Show content for the specified tab
	 */
	private showTab(tabId: string): void {
		this.contentContainer.empty();

		switch (tabId) {
			case 'dashboard':
				this.showDashboardTab();
				break;
			case 'guide':
				this.showGuideTab();
				break;
			case 'people':
				void this.showPeopleTab();
				break;
			case 'collections':
				void this.showCollectionsTab();
				break;
			case 'tree-generation':
				void this.showTreeGenerationTab();
				break;
			case 'import-export':
				this.showImportExportTab();
				break;
			case 'data-quality':
				this.showDataQualityTab();
				break;
			case 'statistics':
				this.showStatisticsTab();
				break;
			case 'places':
				void this.showPlacesTab();
				break;
			case 'maps':
				void this.showMapsTab();
				break;
			case 'schemas':
				void this.showSchemasTab();
				break;
			case 'relationships':
				void this.showRelationshipsTab();
				break;
			case 'events':
				this.showEventsTab();
				break;
			case 'organizations':
				void this.showOrganizationsTab();
				break;
			case 'universes':
				this.showUniversesTab();
				break;
			case 'sources':
				void this.showSourcesTab();
				break;
			case 'preferences':
				this.showPreferencesTab();
				break;
			default:
				this.showPlaceholderTab(tabId);
		}
	}

	/**
	 * Open Control Center to a specific tab
	 */
	public openToTab(tabId: string): void {
		this.activeTab = tabId;
		this.open();
	}

	/**
	 * Open Control Center with a person pre-selected as the tree root
	 * Opens to the Tree Output tab with the specified person already populated
	 *
	 * @param file - The TFile of the person note
	 */
	public openWithPerson(file: TFile): void {
		// Get person info from file metadata
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) {
			new Notice('Unable to read person data from file');
			return;
		}

		const crId = cache.frontmatter.cr_id;
		const name = cache.frontmatter.name || file.basename;

		if (!crId) {
			new Notice('This note does not have a cr_id field');
			return;
		}

		const fm = cache.frontmatter;

		// Convert Date objects to ISO strings if necessary (Obsidian parses YAML dates as Date objects)
		const birthDate = fm.born instanceof Date ? fm.born.toISOString().split('T')[0] : fm.born;
		const deathDate = fm.died instanceof Date ? fm.died.toISOString().split('T')[0] : fm.died;

		// Store the person info to be used when the tab renders
		this.pendingRootPerson = {
			name,
			crId,
			birthDate,
			deathDate,
			file
		};

		// Open to Tree Output tab
		this.openToTab('tree-generation');
	}

	/**
	 * Find all disconnected family components and generate a tree for each
	 * Creates separate canvases for each family group found in the vault
	 */
	public async openAndGenerateAllTrees(): Promise<void> {
		// Track results for summary
		interface TreeResult {
			success: boolean;
			familyName: string;
			peopleCount: number;
			fileName?: string;
			file?: TFile;
			error?: string;
		}

		const results: TreeResult[] = [];

		try {
			// Initialize services
			const graphService = this.plugin.createFamilyGraphService();

			// Find all family components
			logger.info('generate-all-trees', 'Finding all family components in vault');
			new Notice('Scanning vault for family groups...');
			const components = graphService.findAllFamilyComponents();

			if (components.length === 0) {
				new Notice('No family trees found in vault. Please add some person notes first.');
				return;
			}

			if (components.length === 1) {
				new Notice('Only one family tree found. Use "Generate tree" instead.');
				return;
			}

			logger.info('generate-all-trees', `Found ${components.length} family groups`, {
				sizes: components.map(c => c.size)
			});

			new Notice(`Found ${components.length} family groups. Generating trees...`);

			// Generate a tree for each component
			for (let i = 0; i < components.length; i++) {
				const component = components[i];
				const rep = component.representative;

				// Update progress
				new Notice(`Generating tree ${i + 1}/${components.length}: ${rep.name}...`, 2000);

				logger.info('generate-all-trees', `Generating tree ${i + 1}/${components.length}`, {
					representative: rep.name,
					size: component.size
				});

				try {
					// Generate full family tree for this component
					const treeOptions: TreeOptions = {
						rootCrId: rep.crId,
						treeType: 'full',
						maxGenerations: 0, // unlimited
						includeSpouses: true
					};

					const familyTree = graphService.generateTree(treeOptions);

					if (!familyTree) {
						logger.error('generate-all-trees', `Failed to generate tree for ${rep.name}: root not found`);
						results.push({
							success: false,
							familyName: component.collectionName || rep.name,
							peopleCount: component.size,
							error: 'Root person not found'
						});
						continue;
					}

					// Generate canvas with a numbered name
					const canvasGenerator = new CanvasGenerator();
					const canvasOptions = {
						nodeWidth: this.plugin.settings.defaultNodeWidth,
						nodeHeight: this.plugin.settings.defaultNodeHeight,
						nodeSpacingX: this.plugin.settings.horizontalSpacing,
						nodeSpacingY: this.plugin.settings.verticalSpacing,
						direction: 'vertical' as const,
						nodeColorScheme: this.plugin.settings.nodeColorScheme,
						showLabels: false,
						parentChildArrowStyle: this.plugin.settings.parentChildArrowStyle,
						spouseArrowStyle: this.plugin.settings.spouseArrowStyle,
						parentChildEdgeColor: this.plugin.settings.parentChildEdgeColor,
						spouseEdgeColor: this.plugin.settings.spouseEdgeColor,
						showSpouseEdges: this.plugin.settings.showSpouseEdges,
						spouseEdgeLabelFormat: this.plugin.settings.spouseEdgeLabelFormat,
						showSourceIndicators: this.plugin.settings.showSourceIndicators,
						showResearchCoverage: this.plugin.settings.trackFactSourcing,
						canvasRootsMetadata: {
							plugin: 'canvas-roots' as const,
							generation: {
								rootCrId: rep.crId,
								rootPersonName: rep.name,
								treeType: 'full' as const,
								maxGenerations: 0,
								includeSpouses: true,
								direction: 'vertical' as const,
								timestamp: Date.now()
							},
							layout: {
								nodeWidth: this.plugin.settings.defaultNodeWidth,
								nodeHeight: this.plugin.settings.defaultNodeHeight,
								nodeSpacingX: this.plugin.settings.horizontalSpacing,
								nodeSpacingY: this.plugin.settings.verticalSpacing
							}
						}
					};

					const canvasData = canvasGenerator.generateCanvas(familyTree, canvasOptions);

					// Create canvas file with collection name if available
					const fileName = component.collectionName
						? `${component.collectionName} - ${rep.name}.canvas`
						: `Family tree ${i + 1} - ${rep.name}.canvas`;
					const canvasContent = this.formatCanvasJson(canvasData);

					// Use canvasesFolder setting
					const folder = this.plugin.settings.canvasesFolder || 'Canvas Roots/Canvases';
					await ensureFolderExists(this.app, folder);
					const filePath = normalizePath(`${folder}/${fileName}`);

					let file: TFile;
					const existingFile = this.app.vault.getAbstractFileByPath(filePath);
					if (existingFile instanceof TFile) {
						await this.app.vault.modify(existingFile, canvasContent);
						file = existingFile;
					} else {
						file = await this.app.vault.create(filePath, canvasContent);
					}

					results.push({
						success: true,
						familyName: component.collectionName || rep.name,
						peopleCount: canvasData.nodes.length,
						fileName,
						file
					});

					// Save to recent trees history
					const treeInfo: RecentTreeInfo = {
						canvasPath: file.path,
						canvasName: fileName,
						peopleCount: canvasData.nodes.length,
						edgeCount: canvasData.edges.length,
						rootPerson: rep.name,
						timestamp: Date.now()
					};

					// Ensure recentTrees array exists (defensive)
					if (!this.plugin.settings.recentTrees) {
						this.plugin.settings.recentTrees = [];
					}

					// Add to beginning of array and keep only last 10
					this.plugin.settings.recentTrees = [treeInfo, ...this.plugin.settings.recentTrees].slice(0, 10);

					logger.info('generate-all-trees', `Successfully generated tree ${i + 1}`, {
						fileName,
						nodeCount: canvasData.nodes.length
					});
				} catch (error: unknown) {
					logger.error('generate-all-trees', `Failed to generate tree for ${rep.name}`, error);
					results.push({
						success: false,
						familyName: component.collectionName || rep.name,
						peopleCount: component.size,
						error: getErrorMessage(error)
					});
				}
			}

			// Save settings with all the recent trees we just added
			await this.plugin.saveSettings();

			// Show results summary modal
			this.showGenerateAllTreesResults(results);
		} catch (error: unknown) {
			logger.error('generate-all-trees', 'Failed to generate all trees', error);
			throw error;
		}
	}

	/**
	 * Show results summary for Generate All Trees operation
	 */
	private showGenerateAllTreesResults(results: Array<{
		success: boolean;
		familyName: string;
		peopleCount: number;
		fileName?: string;
		file?: TFile;
		error?: string;
	}>): void {
		const successCount = results.filter(r => r.success).length;
		const failureCount = results.length - successCount;

		// Clear current content and show results
		this.contentContainer.empty();

		// Title
		this.contentContainer.createEl('h2', {
			text: 'Generate all trees - Results',
			cls: 'cr-card-title--no-margin'
		});

		// Summary stats
		const summaryCard = this.createCard({
			title: 'Summary',
			icon: 'check'
		});

		const summaryContent = summaryCard.querySelector('.crc-card__content') as HTMLElement;

		const statsGrid = summaryContent.createDiv({ cls: 'crc-stats-grid' });

		// Success count
		const successStat = statsGrid.createDiv({ cls: 'crc-stat' });
		successStat.createDiv({ cls: 'crc-stat__label', text: 'Successfully generated' });
		successStat.createDiv({
			cls: 'crc-stat__value',
			text: String(successCount)
		});

		// Failure count (if any)
		if (failureCount > 0) {
			const failureStat = statsGrid.createDiv({ cls: 'crc-stat' });
			failureStat.createDiv({ cls: 'crc-stat__label', text: 'Failed' });
			failureStat.createDiv({
				cls: 'crc-stat__value',
				text: String(failureCount)
			});
		}

		// Total trees
		const totalStat = statsGrid.createDiv({ cls: 'crc-stat' });
		totalStat.createDiv({ cls: 'crc-stat__label', text: 'Total family groups' });
		totalStat.createDiv({
			cls: 'crc-stat__value',
			text: String(results.length)
		});

		this.contentContainer.appendChild(summaryCard);

		// Success message or warning
		if (failureCount === 0) {
			const successMsg = this.contentContainer.createEl('p', {
				cls: 'crc-text-success crc-mt-3'
			});
			successMsg.createEl('strong', { text: '✓ All trees generated successfully!' });
		} else {
			const warningMsg = this.contentContainer.createEl('p', {
				cls: 'crc-text-warning crc-mt-3'
			});
			warningMsg.createEl('strong', { text: `⚠ ${failureCount} tree${failureCount === 1 ? '' : 's'} failed to generate.` });
			warningMsg.appendText(' See details below.');
		}

		// Details card
		const detailsCard = this.createCard({
			title: 'Generated trees',
			icon: 'file'
		});

		const detailsContent = detailsCard.querySelector('.crc-card__content') as HTMLElement;

		// List of results
		const resultsList = detailsContent.createDiv({ cls: 'crc-results-list' });

		results.forEach((result) => {
			const resultItem = resultsList.createDiv({
				cls: `crc-result-item ${result.success ? 'crc-result-item--success' : 'crc-result-item--error'}`
			});

			// Icon and family name
			const resultHeader = resultItem.createDiv({ cls: 'crc-result-item__header' });

			const icon = createLucideIcon(result.success ? 'check' : 'alert-circle', 16);
			resultHeader.appendChild(icon);

			resultHeader.createSpan({
				cls: 'crc-result-item__name',
				text: result.familyName
			});

			resultHeader.createSpan({
				cls: 'crc-result-item__count',
				text: `${result.peopleCount} people`
			});

			// Success: show file name and action buttons
			if (result.success && result.file) {
				const resultBody = resultItem.createDiv({ cls: 'crc-result-item__body' });

				resultBody.createEl('p', {
					cls: 'crc-text-muted',
					text: result.fileName || ''
				});

				// Action buttons
				const actions = resultBody.createDiv({ cls: 'crc-result-item__actions' });

				const openBtn = actions.createEl('button', {
					cls: 'crc-btn crc-btn--small',
					text: 'Open canvas'
				});
				const openIcon = createLucideIcon('external-link', 14);
				openBtn.prepend(openIcon);
				openBtn.addEventListener('click', () => {
					void (async () => {
						if (result.file) {
							const leaf = this.app.workspace.getLeaf(false);
							await leaf.openFile(result.file);
							this.close();
						}
					})();
				});

				const relayoutBtn = actions.createEl('button', {
					cls: 'crc-btn crc-btn--small crc-btn--secondary',
					text: 'Re-layout'
				});
				const relayoutIcon = createLucideIcon('refresh-cw', 14);
				relayoutBtn.prepend(relayoutIcon);
				relayoutBtn.addEventListener('click', () => {
					void (async () => {
						if (result.file) {
							// Call the plugin's regenerate method
							await this.plugin.regenerateCanvas(result.file);
						}
					})();
				});
			}

			// Failure: show error message
			if (!result.success && result.error) {
				const resultBody = resultItem.createDiv({ cls: 'crc-result-item__body' });

				resultBody.createEl('p', {
					cls: 'crc-text-error',
					text: `Error: ${result.error}`
				});
			}
		});

		this.contentContainer.appendChild(detailsCard);

		// Back button
		const backBtn = this.contentContainer.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-btn--block crc-mt-3',
			text: 'Back to tree output'
		});
		const backIcon = createLucideIcon('chevron-right', 16);
		backBtn.prepend(backIcon);
		backBtn.addEventListener('click', () => {
			this.showTab('tree-generation');
		});

		// Final success notice
		if (failureCount === 0) {
			new Notice(`Successfully generated ${successCount} family trees!`, 5000);
		} else {
			new Notice(`Generated ${successCount} of ${results.length} trees. ${failureCount} failed.`, 5000);
		}
	}

	// ==========================================================================
	// TAB CONTENT METHODS
	// ==========================================================================

	/**
	 * Show Dashboard tab with quick actions and vault overview
	 */
	private showDashboardTab(): void {
		renderDashboardTab({
			container: this.contentContainer,
			plugin: this.plugin,
			app: this.app,
			createCard: this.createCard.bind(this),
			switchTab: this.switchTab.bind(this),
			closeModal: () => this.close()
		});
	}

	/**
	 * Show Status tab (legacy - kept for reference during migration)
	 */
	private async showStatusTab(): Promise<void> {
		const container = this.contentContainer;

		// Show loading state
		const loadingCard = this.createCard({
			title: 'Vault statistics',
			icon: 'activity'
		});
		const loadingContent = loadingCard.querySelector('.crc-card__content') as HTMLElement;
		loadingContent.createEl('p', { text: 'Loading statistics...', cls: 'crc-text-muted' });
		container.appendChild(loadingCard);

		// Collect statistics with error handling
		let stats: FullVaultStats;
		try {
			const statsService = new VaultStatsService(this.app);
			const folderFilter = this.plugin.getFolderFilter();
			if (folderFilter) {
				statsService.setFolderFilter(folderFilter);
			}
			statsService.setSettings(this.plugin.settings);
			stats = statsService.collectStats();
		} catch (error) {
			// Clear loading state and show error
			container.empty();
			const errorCard = this.createCard({
				title: 'Error loading statistics',
				icon: 'alert-triangle'
			});
			const errorContent = errorCard.querySelector('.crc-card__content') as HTMLElement;
			errorContent.createEl('p', {
				text: `Failed to collect vault statistics: ${getErrorMessage(error)}`,
				cls: 'crc-text-error'
			});
			errorContent.createEl('p', {
				text: 'Please check the developer console for more details.',
				cls: 'crc-text-muted'
			});
			container.appendChild(errorCard);
			console.error('Error collecting vault statistics:', error);
			return;
		}

		// Clear loading state
		container.empty();

		// People Statistics Card
		const peopleCard = this.createCard({
			title: 'People',
			icon: 'users'
		});
		const peopleContent = peopleCard.querySelector('.crc-card__content') as HTMLElement;

		this.createStatRow(peopleContent, 'Total people', stats.people.totalPeople);
		this.createStatRow(peopleContent, 'With birth date', stats.people.peopleWithBirthDate);
		this.createStatRow(peopleContent, 'With death date', stats.people.peopleWithDeathDate);
		this.createStatRow(peopleContent, 'Living', stats.people.livingPeople, 'crc-text-success');
		this.createStatRow(peopleContent, 'Orphaned (no relationships)', stats.people.orphanedPeople,
			stats.people.orphanedPeople > 0 ? 'crc-text-warning' : undefined);

		// View full statistics link
		const statsLink = peopleContent.createDiv({ cls: 'cr-stats-link' });
		const link = statsLink.createEl('a', { text: 'View full statistics →', cls: 'crc-text-muted' });
		link.addEventListener('click', (e) => {
			e.preventDefault();
			this.close();
			void this.plugin.activateStatisticsView();
		});

		container.appendChild(peopleCard);

		// Family Links Card (standard genealogical relationships)
		const relCard = this.createCard({
			title: 'Family links',
			icon: 'link'
		});
		const relContent = relCard.querySelector('.crc-card__content') as HTMLElement;

		this.createStatRow(relContent, 'Total links', stats.relationships.totalRelationships);
		this.createStatRow(relContent, 'Father links', stats.relationships.totalFatherLinks);
		this.createStatRow(relContent, 'Mother links', stats.relationships.totalMotherLinks);
		this.createStatRow(relContent, 'Spouse links', stats.relationships.totalSpouseLinks);
		this.createStatRow(relContent, 'People with father', stats.people.peopleWithFather);
		this.createStatRow(relContent, 'People with mother', stats.people.peopleWithMother);
		this.createStatRow(relContent, 'People with spouse', stats.people.peopleWithSpouse);

		container.appendChild(relCard);

		// Places Card
		const placesCard = this.createCard({
			title: 'Places',
			icon: 'map-pin'
		});
		const placesContent = placesCard.querySelector('.crc-card__content') as HTMLElement;

		this.createStatRow(placesContent, 'Total places', stats.places.totalPlaces);
		this.createStatRow(placesContent, 'With coordinates', stats.places.placesWithCoordinates);

		// Show category breakdown if there are places
		if (stats.places.totalPlaces > 0) {
			const categories = Object.entries(stats.places.byCategory)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 5); // Top 5 categories

			if (categories.length > 0) {
				const categoryLabel = placesContent.createDiv({ cls: 'crc-stat-row crc-mt-2' });
				categoryLabel.createDiv({ cls: 'crc-stat-label crc-text-muted', text: 'By category:' });

				for (const [category, count] of categories) {
					this.createStatRow(placesContent, `  ${category}`, count, 'crc-text-muted');
				}
			}
		}

		container.appendChild(placesCard);

		// Maps Card
		const mapsCard = this.createCard({
			title: 'Custom maps',
			icon: 'map'
		});
		const mapsContent = mapsCard.querySelector('.crc-card__content') as HTMLElement;

		mapsContent.createEl('p', {
			text: 'The built-in interactive map handles most real-world genealogy. Custom maps are for historical maps, cemetery plots, land surveys, or fictional worlds.',
			cls: 'crc-text-muted crc-mb-2'
		});

		this.createStatRow(mapsContent, 'Total custom maps', stats.maps.totalMaps);

		if (stats.maps.universes.length > 0) {
			const universesRow = mapsContent.createDiv({ cls: 'crc-stat-row crc-mt-2' });
			universesRow.createDiv({ cls: 'crc-stat-label', text: 'Universes' });
			universesRow.createDiv({
				cls: 'crc-stat-value crc-text-muted',
				text: stats.maps.universes.join(', ')
			});
		}

		// View full statistics link
		const mapsStatsLink = mapsContent.createDiv({ cls: 'cr-stats-link' });
		const mapsLink = mapsStatsLink.createEl('a', { text: 'View full statistics →', cls: 'crc-text-muted' });
		mapsLink.addEventListener('click', (e) => {
			e.preventDefault();
			this.close();
			void this.plugin.activateStatisticsView();
		});

		container.appendChild(mapsCard);

		// Events Card
		const eventsCard = this.createCard({
			title: 'Events',
			icon: 'calendar'
		});
		const eventsContent = eventsCard.querySelector('.crc-card__content') as HTMLElement;

		this.createStatRow(eventsContent, 'Total events', stats.events.totalEvents);

		// Show event type breakdown if there are events
		if (stats.events.totalEvents > 0) {
			const eventTypes = Object.entries(stats.events.byType)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 5); // Top 5 types

			if (eventTypes.length > 0) {
				const typeLabel = eventsContent.createDiv({ cls: 'crc-stat-row crc-mt-2' });
				typeLabel.createDiv({ cls: 'crc-stat-label crc-text-muted', text: 'By type:' });

				for (const [eventType, count] of eventTypes) {
					this.createStatRow(eventsContent, `  ${eventType}`, count, 'crc-text-muted');
				}
			}
		}

		container.appendChild(eventsCard);

		// Sources Card
		const sourcesCard = this.createCard({
			title: 'Sources',
			icon: 'book-open'
		});
		const sourcesContent = sourcesCard.querySelector('.crc-card__content') as HTMLElement;

		this.createStatRow(sourcesContent, 'Total sources', stats.sources.totalSources);

		// Show source type breakdown if there are sources
		if (stats.sources.totalSources > 0) {
			const sourceTypes = Object.entries(stats.sources.byType)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 5); // Top 5 types

			if (sourceTypes.length > 0) {
				const typeLabel = sourcesContent.createDiv({ cls: 'crc-stat-row crc-mt-2' });
				typeLabel.createDiv({ cls: 'crc-stat-label crc-text-muted', text: 'By type:' });

				for (const [sourceType, count] of sourceTypes) {
					this.createStatRow(sourcesContent, `  ${sourceType}`, count, 'crc-text-muted');
				}
			}
		}

		container.appendChild(sourcesCard);

		// Canvases Card
		const canvasesCard = this.createCard({
			title: 'Canvases',
			icon: 'layout'
		});
		const canvasesContent = canvasesCard.querySelector('.crc-card__content') as HTMLElement;

		this.createStatRow(canvasesContent, 'Total canvases', stats.canvases.totalCanvases);

		container.appendChild(canvasesCard);

		// Vault Health Card
		const healthCard = this.createCard({
			title: 'Vault health',
			icon: 'heart'
		});
		const healthContent = healthCard.querySelector('.crc-card__content') as HTMLElement;

		const completeness = this.calculateCompleteness(stats);
		this.createHealthBar(healthContent, completeness);

		const healthInfo = healthContent.createDiv({ cls: 'crc-mt-4' });
		healthInfo.createEl('p', {
			text: `Data completeness: ${completeness}%`,
			cls: 'crc-mb-2'
		});

		const lastUpdated = healthContent.createDiv({ cls: 'crc-text-muted crc-mt-2' });
		lastUpdated.createEl('small', {
			text: `Last updated: ${stats.lastUpdated.toLocaleTimeString()}`
		});

		container.appendChild(healthCard);

		// Recent Trees Card
		// First, clean up deleted files from the history
		const existingTrees = this.plugin.settings.recentTrees.filter(tree => {
			const file = this.app.vault.getAbstractFileByPath(tree.canvasPath);
			return file instanceof TFile;
		});

		// Update settings if any were removed
		if (existingTrees.length !== this.plugin.settings.recentTrees.length) {
			this.plugin.settings.recentTrees = existingTrees;
			await this.plugin.saveSettings();
		}

		if (existingTrees.length > 0) {
			const recentTreesCard = this.createCard({
				title: 'Recently generated trees',
				icon: 'git-branch'
			});
			const recentTreesContent = recentTreesCard.querySelector('.crc-card__content') as HTMLElement;

			// Add clear history button to card header
			const cardHeader = recentTreesCard.querySelector('.crc-card__header') as HTMLElement;
			const clearButton = cardHeader.createEl('button', {
				cls: 'crc-button crc-button--small',
				text: 'Clear history'
			});
			clearButton.addEventListener('click', () => {
				void (async () => {
					this.plugin.settings.recentTrees = [];
					await this.plugin.saveSettings();
					new Notice('Tree history cleared');
					this.showTab('status'); // Refresh the tab
				})();
			});

			existingTrees.forEach((tree) => {
				const treeRow = recentTreesContent.createDiv({ cls: 'crc-recent-tree' });

				// Tree name (clickable link)
				const treeHeader = treeRow.createDiv({ cls: 'crc-recent-tree__header' });
				const treeLink = treeHeader.createEl('a', {
					cls: 'crc-recent-tree__name',
					text: tree.canvasName
				});
				treeLink.addEventListener('click', (e) => {
					void (async () => {
						e.preventDefault();
						const file = this.app.vault.getAbstractFileByPath(tree.canvasPath);
						if (file instanceof TFile) {
							const leaf = this.app.workspace.getLeaf(false);
							await leaf.openFile(file);
							this.close();
						} else {
							new Notice(`Canvas file not found: ${tree.canvasPath}`);
						}
					})();
				});

				// Root person
				const rootInfo = treeHeader.createDiv({ cls: 'crc-recent-tree__root' });
				rootInfo.createEl('small', { text: `Root: ${tree.rootPerson}`, cls: 'crc-text-muted' });

				// Stats row
				const statsRow = treeRow.createDiv({ cls: 'crc-recent-tree__stats' });

				// People count
				const peopleCount = statsRow.createDiv({ cls: 'crc-recent-tree__stat' });
				const peopleIcon = createLucideIcon('users', 14);
				peopleCount.appendChild(peopleIcon);
				peopleCount.appendText(` ${tree.peopleCount} people`);

				// Edge count
				const edgeCount = statsRow.createDiv({ cls: 'crc-recent-tree__stat' });
				const edgeIcon = createLucideIcon('link', 14);
				edgeCount.appendChild(edgeIcon);
				edgeCount.appendText(` ${tree.edgeCount} edges`);

				// Timestamp
				const timestamp = statsRow.createDiv({ cls: 'crc-recent-tree__stat' });
				const timeIcon = document.createElement('span');
				timeIcon.classList.add('crc-icon');
				setIcon(timeIcon, 'clock');
				timestamp.appendChild(timeIcon);
				const timeAgo = this.formatTimeAgo(tree.timestamp);
				timestamp.appendText(` ${timeAgo}`);
			});

			container.appendChild(recentTreesCard);
		}

		// Recent Imports Section
		const recentImports = this.plugin.settings.recentImports;
		if (recentImports.length > 0) {
			const recentImportsCard = this.createCard({
				title: 'Recent GEDCOM imports',
				icon: 'upload'
			});
			const recentImportsContent = recentImportsCard.querySelector('.crc-card__content') as HTMLElement;

			// Add clear history button to card header
			const cardHeader = recentImportsCard.querySelector('.crc-card__header') as HTMLElement;
			const clearButton = cardHeader.createEl('button', {
				cls: 'crc-button crc-button--small',
				text: 'Clear history'
			});
			clearButton.addEventListener('click', () => {
				void (async () => {
					this.plugin.settings.recentImports = [];
					await this.plugin.saveSettings();
					new Notice('Import history cleared');
					this.showTab('status'); // Refresh the tab
				})();
			});

			recentImports.forEach((importInfo) => {
				const importRow = recentImportsContent.createDiv({ cls: 'crc-recent-tree' });

				// Import file name
				const importHeader = importRow.createDiv({ cls: 'crc-recent-tree__header' });
				importHeader.createEl('span', {
					cls: 'crc-recent-tree__name',
					text: importInfo.fileName
				});

				// Stats row
				const statsRow = importRow.createDiv({ cls: 'crc-recent-tree__stats' });

				// Records imported
				const recordsCount = statsRow.createDiv({ cls: 'crc-recent-tree__stat' });
				const recordsIcon = createLucideIcon('folder', 14);
				recordsCount.appendChild(recordsIcon);
				recordsCount.appendText(` ${importInfo.recordsImported} records`);

				// Notes created
				const notesCount = statsRow.createDiv({ cls: 'crc-recent-tree__stat' });
				const notesIcon = createLucideIcon('file-text', 14);
				notesCount.appendChild(notesIcon);
				notesCount.appendText(` ${importInfo.notesCreated} notes`);

				// Timestamp
				const timestamp = statsRow.createDiv({ cls: 'crc-recent-tree__stat' });
				const timeIcon = document.createElement('span');
				timeIcon.classList.add('crc-icon');
				setIcon(timeIcon, 'clock');
				timestamp.appendChild(timeIcon);
				const timeAgo = this.formatTimeAgo(importInfo.timestamp);
				timestamp.appendText(` ${timeAgo}`);
			});

			container.appendChild(recentImportsCard);
		}
	}

	/**
	 * Format timestamp as relative time
	 */
	private formatTimeAgo(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return days === 1 ? '1 day ago' : `${days} days ago`;
		} else if (hours > 0) {
			return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
		} else if (minutes > 0) {
			return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
		} else {
			return 'just now';
		}
	}

	/**
	 * Create a statistic row
	 */
	private createStatRow(
		container: HTMLElement,
		label: string,
		value: number,
		valueClass?: string
	): void {
		const row = container.createDiv({ cls: 'crc-stat-row' });
		row.createDiv({ cls: 'crc-stat-label', text: label });
		const valueEl = row.createDiv({ cls: 'crc-stat-value', text: value.toString() });
		if (valueClass) {
			valueEl.addClass(valueClass);
		}
	}

	/**
	 * Calculate data completeness percentage
	 */
	private calculateCompleteness(stats: FullVaultStats): number {
		if (stats.people.totalPeople === 0) return 0;

		const withBirth = stats.people.peopleWithBirthDate;
		const withDeath = stats.people.peopleWithDeathDate;
		const withRelationships = stats.people.totalPeople - stats.people.orphanedPeople;

		// Weight: 40% birth dates, 30% death dates, 30% relationships
		const birthScore = (withBirth / stats.people.totalPeople) * 40;
		const deathScore = (withDeath / stats.people.totalPeople) * 30;
		const relScore = (withRelationships / stats.people.totalPeople) * 30;

		return Math.round(birthScore + deathScore + relScore);
	}

	/**
	 * Create health bar visualization
	 */
	private createHealthBar(container: HTMLElement, percentage: number): HTMLElement {
		const barContainer = container.createDiv({ cls: 'crc-health-bar-container' });
		const bar = barContainer.createDiv({ cls: 'crc-health-bar' });
		const fill = bar.createDiv({ cls: 'crc-health-bar-fill' });
		fill.style.setProperty('width', `${percentage}%`);

		// Color based on percentage
		if (percentage >= 80) {
			fill.addClass('crc-health-bar-fill--success');
		} else if (percentage >= 50) {
			fill.addClass('crc-health-bar-fill--warning');
		} else {
			fill.addClass('crc-health-bar-fill--error');
		}

		return barContainer;
	}

	/**
	 * Show Guide tab - Quick start and getting started information
	 * Streamlined version with wiki links for detailed documentation
	 */
	private showGuideTab(): void {
		const container = this.contentContainer;
		const WIKI_BASE = 'https://github.com/banisterious/obsidian-canvas-roots/wiki';

		// =========================================================================
		// Card 1: Welcome & Quick Start
		// =========================================================================
		const welcomeCard = this.createCard({
			title: 'Welcome to Canvas Roots',
			icon: 'book-open'
		});
		const welcomeContent = welcomeCard.querySelector('.crc-card__content') as HTMLElement;

		welcomeContent.createEl('p', {
			text: 'Canvas Roots generates family trees on the Obsidian canvas from your markdown notes. Get started in three steps:',
			cls: 'crc-mb-3'
		});

		const steps = [
			{ number: '1', title: 'Enter your data', tab: 'import-export', desc: 'Import GEDCOM, use Bases, or create notes manually' },
			{ number: '2', title: 'Generate the tree', tab: 'tree-generation', desc: 'Select a root person and generate' },
			{ number: '3', title: 'Maintain the layout', tab: null, desc: 'Right-click canvas → Regenerate after edits' }
		];

		steps.forEach((step) => {
			const stepEl = welcomeContent.createDiv({ cls: 'crc-guide-step' });
			const badge = stepEl.createDiv({ cls: 'crc-guide-step__badge' });
			badge.textContent = step.number;
			const content = stepEl.createDiv({ cls: 'crc-guide-step__content' });
			const titleEl = content.createEl('h4', { cls: 'crc-mb-1' });
			if (step.tab) {
				const link = titleEl.createEl('a', { text: step.title, cls: 'crc-link' });
				link.addEventListener('click', (e) => { e.preventDefault(); this.switchTab(step.tab); });
			} else {
				titleEl.textContent = step.title;
			}
			content.createEl('p', { text: step.desc, cls: 'crc-text-muted' });
		});

		const wikiLinkWrapper = welcomeContent.createDiv({ cls: 'cr-stats-link' });
		const wikiLink = wikiLinkWrapper.createEl('a', {
			text: 'Read the full Getting Started guide →',
			href: `${WIKI_BASE}/Getting-Started`,
			cls: 'crc-text-muted'
		});
		wikiLink.setAttr('target', '_blank');

		container.appendChild(welcomeCard);

		// =========================================================================
		// Card 2: After Importing
		// =========================================================================
		const afterImportCard = this.createCard({
			title: 'After importing',
			icon: 'sparkles',
			subtitle: 'Clean up and enhance your imported data'
		});
		const afterImportContent = afterImportCard.querySelector('.crc-card__content') as HTMLElement;

		afterImportContent.createEl('p', {
			text: 'Imported data often needs cleanup. GEDCOM files may have inconsistent dates, missing reciprocal relationships, or varied place name spellings.',
			cls: 'crc-mb-3'
		});

		const cleanupSteps = afterImportContent.createEl('ol', { cls: 'crc-cleanup-steps crc-mb-3' });
		[
			'Run the Quality Report to see what needs attention',
			'Fix bidirectional relationships for graph integrity',
			'Normalize dates and gender values',
			'Standardize and geocode places'
		].forEach(step => {
			cleanupSteps.createEl('li', { text: step });
		});

		const afterImportBtnRow = afterImportContent.createDiv({ cls: 'crc-btn-row' });
		const cleanupBtn = afterImportBtnRow.createEl('button', {
			text: 'Open Data Quality',
			cls: 'crc-btn crc-btn--primary'
		});
		cleanupBtn.addEventListener('click', () => {
			this.switchTab('data-quality');
		});

		const workflowLink = afterImportBtnRow.createEl('a', {
			text: 'Full workflow guide →',
			href: `${WIKI_BASE}/Data-Quality#post-import-cleanup-workflow`,
			cls: 'crc-link'
		});
		workflowLink.setAttr('target', '_blank');

		container.appendChild(afterImportCard);

		// =========================================================================
		// Card 3: Essential Properties (Collapsible)
		// =========================================================================
		const propsCard = this.createCard({
			title: 'Essential properties',
			icon: 'file-text',
			subtitle: 'YAML frontmatter fields for person, place, source, event, map, and universe notes'
		});
		const propsContent = propsCard.querySelector('.crc-card__content') as HTMLElement;

		// Person properties collapsible
		this.createCollapsible(propsContent, 'Person notes', 'user', (body) => {
			const aliasService = new PropertyAliasService(this.plugin);

			// Helper to get display name with alias indicator
			const getDisplayName = (canonical: string): string => {
				const alias = aliasService.getAlias(canonical);
				return alias ? `${alias}` : canonical;
			};

			// Helper for combined properties like "father / mother"
			const getCombinedDisplayName = (props: string[]): string => {
				return props.map(p => getDisplayName(p)).join(' / ');
			};

			const list = body.createEl('ul', { cls: 'crc-field-list' });

			// Properties with aliasing support
			const personProps = [
				{ canonical: 'cr_id', desc: 'Unique identifier', req: true },
				{ canonical: 'cr_type', desc: 'Must be "person"', req: true },
				{ canonical: 'name', desc: 'Full name', req: true },
				{ combined: ['father', 'mother'], desc: 'Wikilinks to parents', req: false },
				{ canonical: 'spouse', desc: 'Array of spouse wikilinks', req: false },
				{ combined: ['born', 'died'], desc: 'Dates (YYYY-MM-DD)', req: false }
			];

			personProps.forEach(p => {
				const li = list.createEl('li');
				let displayName: string;
				let hasAlias: boolean;

				if ('canonical' in p && p.canonical) {
					displayName = getDisplayName(p.canonical);
					hasAlias = aliasService.hasAlias(p.canonical);
				} else if ('combined' in p && p.combined) {
					displayName = getCombinedDisplayName(p.combined);
					hasAlias = p.combined.some(prop => aliasService.hasAlias(prop));
				} else {
					displayName = '';
					hasAlias = false;
				}

				const code = li.createEl('code', { text: displayName });
				if (p.req) code.addClass('crc-field--required');
				li.appendText(` - ${p.desc}`);

				// Show alias indicator if any property is aliased
				if (hasAlias) {
					const indicator = li.createEl('span', {
						text: ' (aliased)',
						cls: 'crc-text-muted cr-alias-indicator'
					});
					indicator.setAttribute('title', 'This property uses a custom name configured in Preferences');
				}
			});
		});

		// Place properties collapsible
		this.createCollapsible(propsContent, 'Place notes', 'map-pin', (body) => {
			const list = body.createEl('ul', { cls: 'crc-field-list' });
			[
				{ name: 'cr_type', desc: 'Must be "place"', req: true },
				{ name: 'cr_id', desc: 'Unique identifier', req: true },
				{ name: 'name', desc: 'Place name', req: true },
				{ name: 'coordinates', desc: 'lat/long for map display', req: false },
				{ name: 'parent_place', desc: 'Wikilink to parent place', req: false }
			].forEach(p => {
				const li = list.createEl('li');
				const code = li.createEl('code', { text: p.name });
				if (p.req) code.addClass('crc-field--required');
				li.appendText(` - ${p.desc}`);
			});
		});

		// Map properties collapsible
		this.createCollapsible(propsContent, 'Custom map notes', 'globe', (body) => {
			const list = body.createEl('ul', { cls: 'crc-field-list' });
			[
				{ name: 'cr_type', desc: 'Must be "map"', req: true },
				{ name: 'map_id', desc: 'Unique map identifier', req: true },
				{ name: 'universe', desc: 'Universe for filtering places', req: true },
				{ name: 'image', desc: 'Path to map image', req: true },
				{ name: 'bounds', desc: 'Coordinate bounds (north/south/east/west)', req: true }
			].forEach(p => {
				const li = list.createEl('li');
				const code = li.createEl('code', { text: p.name });
				if (p.req) code.addClass('crc-field--required');
				li.appendText(` - ${p.desc}`);
			});
		});

		// Source properties collapsible
		this.createCollapsible(propsContent, 'Source notes', 'archive', (body) => {
			const list = body.createEl('ul', { cls: 'crc-field-list' });
			[
				{ name: 'cr_type', desc: 'Must be "source"', req: true },
				{ name: 'cr_id', desc: 'Unique identifier', req: true },
				{ name: 'title', desc: 'Source title', req: true },
				{ name: 'source_type', desc: 'Type (census, vital_record, etc.)', req: true },
				{ name: 'source_repository', desc: 'Archive or website holding source', req: false },
				{ name: 'source_date', desc: 'Document date', req: false },
				{ name: 'confidence', desc: 'high, medium, low, or unknown', req: false }
			].forEach(p => {
				const li = list.createEl('li');
				const code = li.createEl('code', { text: p.name });
				if (p.req) code.addClass('crc-field--required');
				li.appendText(` - ${p.desc}`);
			});
		});

		// Schema properties collapsible
		this.createCollapsible(propsContent, 'Schema notes', 'clipboard-check', (body) => {
			const list = body.createEl('ul', { cls: 'crc-field-list' });
			[
				{ name: 'cr_type', desc: 'Must be "schema"', req: true },
				{ name: 'cr_id', desc: 'Unique schema identifier', req: true },
				{ name: 'name', desc: 'Display name', req: true },
				{ name: 'applies_to_type', desc: 'Scope: collection, folder, universe, all', req: true },
				{ name: 'applies_to_value', desc: 'Value for scope (if not "all")', req: false }
			].forEach(p => {
				const li = list.createEl('li');
				const code = li.createEl('code', { text: p.name });
				if (p.req) code.addClass('crc-field--required');
				li.appendText(` - ${p.desc}`);
			});
			body.createEl('p', {
				text: 'Schema definition goes in a json schema code block in the note body.',
				cls: 'crc-text-muted crc-mt-2'
			});
		});

		// Event properties collapsible
		this.createCollapsible(propsContent, 'Event notes', 'calendar', (body) => {
			const list = body.createEl('ul', { cls: 'crc-field-list' });
			[
				{ name: 'cr_type', desc: 'Must be "event"', req: true },
				{ name: 'cr_id', desc: 'Unique identifier', req: true },
				{ name: 'title', desc: 'Event title', req: true },
				{ name: 'event_type', desc: 'Type (birth, death, marriage, etc.)', req: true },
				{ name: 'date', desc: 'Event date (ISO format)', req: false },
				{ name: 'date_precision', desc: 'exact, month, year, decade, estimated, range', req: false },
				{ name: 'person', desc: 'Primary person wikilink', req: false },
				{ name: 'place', desc: 'Location wikilink', req: false },
				{ name: 'confidence', desc: 'high, medium, low, or unknown', req: false }
			].forEach(p => {
				const li = list.createEl('li');
				const code = li.createEl('code', { text: p.name });
				if (p.req) code.addClass('crc-field--required');
				li.appendText(` - ${p.desc}`);
			});
		});

		// Universe properties collapsible
		this.createCollapsible(propsContent, 'Universe notes', 'globe', (body) => {
			const list = body.createEl('ul', { cls: 'crc-field-list' });
			[
				{ name: 'cr_type', desc: 'Must be "universe"', req: true },
				{ name: 'cr_id', desc: 'Unique identifier', req: true },
				{ name: 'name', desc: 'Universe name', req: true },
				{ name: 'description', desc: 'Brief description of the world', req: false },
				{ name: 'author', desc: 'Creator of the fictional world', req: false },
				{ name: 'genre', desc: 'Fantasy, sci-fi, historical, etc.', req: false },
				{ name: 'status', desc: 'active, draft, or archived', req: false },
				{ name: 'default_calendar', desc: 'Default calendar cr_id', req: false },
				{ name: 'default_map', desc: 'Default map cr_id', req: false }
			].forEach(p => {
				const li = list.createEl('li');
				const code = li.createEl('code', { text: p.name });
				if (p.req) code.addClass('crc-field--required');
				li.appendText(` - ${p.desc}`);
			});
		});

		const schemaLinkWrapper = propsContent.createDiv({ cls: 'cr-stats-link' });
		const schemaLink = schemaLinkWrapper.createEl('a', {
			text: 'Full frontmatter reference →',
			href: `${WIKI_BASE}/Frontmatter-Reference`,
			cls: 'crc-text-muted'
		});
		schemaLink.setAttr('target', '_blank');

		container.appendChild(propsCard);

		// =========================================================================
		// Card 4: Key Concepts
		// =========================================================================
		const conceptsCard = this.createCard({
			title: 'Key concepts',
			icon: 'lightbulb',
			subtitle: 'Important features to understand'
		});
		const conceptsContent = conceptsCard.querySelector('.crc-card__content') as HTMLElement;

		const concepts = [
			{
				title: 'Groups vs Collections',
				desc: 'Groups are auto-detected connected families. Collections are user-defined categories for organizing people across families.',
				wiki: 'Data-Management#groups-and-collections'
			},
			{
				title: 'Bidirectional sync',
				desc: 'When you set someone as a parent, the reciprocal child link is automatically created. Works for all relationships.',
				wiki: 'Data-Management#bidirectional-sync'
			},
			{
				title: 'Post-import cleanup',
				desc: 'After importing GEDCOM files, run cleanup operations to fix relationships, normalize dates, and standardize places.',
				wiki: 'Data-Quality#post-import-cleanup-workflow'
			},
			{
				title: 'Schema validation',
				desc: 'Define validation rules to ensure data consistency. Require properties, validate types, and create custom constraints.',
				wiki: 'Schema-Validation'
			},
			{
				title: 'Layout algorithms',
				desc: 'Choose Standard, Compact, Timeline, or Hourglass layouts depending on your tree size and visualization needs.',
				wiki: 'Tree-Generation#layout-algorithms'
			},
			{
				title: 'Universe notes',
				desc: 'Organize fictional worlds as first-class entities. Universes scope people, places, events, calendars, and maps.',
				wiki: 'Universe-Notes'
			}
		];

		concepts.forEach(c => {
			const item = conceptsContent.createDiv({ cls: 'crc-mb-3' });
			item.createEl('strong', { text: c.title });
			item.createEl('p', { text: c.desc, cls: 'crc-text-muted crc-mb-1' });
			const link = item.createEl('a', { text: 'Learn more →', href: `${WIKI_BASE}/${c.wiki}`, cls: 'crc-link' });
			link.setAttr('target', '_blank');
		});

		container.appendChild(conceptsCard);

		// =========================================================================
		// Card 5: Fictional Universes
		// =========================================================================
		const universesCard = this.createCard({
			title: 'Fictional universes',
			icon: 'globe',
			subtitle: 'For worldbuilders and fiction writers'
		});
		const universesContent = universesCard.querySelector('.crc-card__content') as HTMLElement;

		// Check if universes exist
		const universeService = new UniverseService(this.plugin);
		const universes = universeService.getAllUniverses();
		const hasUniverses = universes.length > 0;

		if (hasUniverses) {
			// Show universe summary
			universesContent.createEl('p', {
				text: `You have ${universes.length} universe${universes.length === 1 ? '' : 's'}:`,
				cls: 'crc-mb-2'
			});

			const universeList = universesContent.createEl('ul', { cls: 'crc-universe-list crc-mb-3' });
			// Show up to 3 universes
			const displayUniverses = universes.slice(0, 3);
			displayUniverses.forEach(universe => {
				const counts = universeService.getEntityCountsForUniverse(universe.crId);
				const countParts: string[] = [];
				if (counts.people > 0) countParts.push(`${counts.people} people`);
				if (counts.places > 0) countParts.push(`${counts.places} places`);
				if (counts.events > 0) countParts.push(`${counts.events} events`);

				const li = universeList.createEl('li');
				const nameLink = li.createEl('a', {
					text: universe.name,
					cls: 'crc-link'
				});
				nameLink.addEventListener('click', (e) => {
					e.preventDefault();
					this.close();
					const leaf = this.app.workspace.getLeaf(false);
					void leaf.openFile(universe.file);
				});
				if (countParts.length > 0) {
					li.createSpan({
						text: ` (${countParts.join(', ')})`,
						cls: 'crc-text-muted'
					});
				}
			});

			if (universes.length > 3) {
				universesContent.createEl('p', {
					text: `...and ${universes.length - 3} more`,
					cls: 'crc-text-muted crc-mb-3'
				});
			}

			// Buttons
			const btnRow = universesContent.createDiv({ cls: 'crc-btn-row' });
			const createBtn = btnRow.createEl('button', {
				text: 'Create universe',
				cls: 'crc-btn crc-btn--primary'
			});
			createBtn.addEventListener('click', () => {
				new UniverseWizardModal(this.plugin, {
					onComplete: () => this.switchTab('universes')
				}).open();
			});

			const manageBtn = btnRow.createEl('button', {
				text: 'Manage universes',
				cls: 'crc-btn crc-btn--secondary'
			});
			manageBtn.addEventListener('click', () => {
				this.switchTab('universes');
			});

			// Wiki link
			const wikiLinkWrapper = universesContent.createDiv({ cls: 'cr-stats-link' });
			const wikiLink = wikiLinkWrapper.createEl('a', {
				text: 'Learn more about universes →',
				href: `${WIKI_BASE}/Universe-Notes`,
				cls: 'crc-text-muted'
			});
			wikiLink.setAttr('target', '_blank');
		} else {
			// No universes - show explanation
			universesContent.createEl('p', {
				text: 'Universes help you organize fictional worlds. Create a universe to group related calendars, maps, places, and characters together.',
				cls: 'crc-mb-3'
			});

			universesContent.createEl('p', {
				text: 'No universes yet.',
				cls: 'crc-text-muted crc-mb-3'
			});

			// Buttons
			const btnRow = universesContent.createDiv({ cls: 'crc-btn-row' });
			const createBtn = btnRow.createEl('button', {
				text: 'Create universe',
				cls: 'crc-btn crc-btn--primary'
			});
			createBtn.addEventListener('click', () => {
				new UniverseWizardModal(this.plugin, {
					onComplete: () => this.switchTab('universes')
				}).open();
			});

			const learnLink = btnRow.createEl('a', {
				text: 'Learn more about universes →',
				href: `${WIKI_BASE}/Universe-Notes`,
				cls: 'crc-link'
			});
			learnLink.setAttr('target', '_blank');
		}

		container.appendChild(universesCard);

		// =========================================================================
		// Card 6: Common Tasks (Navigation Grid)
		// =========================================================================
		const tasksCard = this.createCard({
			title: 'Common tasks',
			icon: 'list-checks',
			subtitle: 'Quick links to frequently used features'
		});
		const tasksContent = tasksCard.querySelector('.crc-card__content') as HTMLElement;

		const tasks = [
			{ icon: 'upload', title: 'Import data', desc: 'GEDCOM, CSV, Gramps', tab: 'import-export' },
			{ icon: 'download', title: 'Export data', desc: 'GEDCOM, CSV formats', tab: 'import-export' },
			{ icon: 'shield-check', title: 'Clean up data', desc: 'Post-import workflow', tab: 'data-quality' },
			{ icon: 'git-branch', title: 'Generate tree', desc: 'Create visual canvas', tab: 'tree-generation' },
			{ icon: 'map', title: 'Open map view', desc: 'Geographic visualization', tab: null, command: 'canvas-roots:open-map-view' },
			{ icon: 'users', title: 'Manage people', desc: 'Browse and edit', tab: 'people' },
			{ icon: 'clipboard-check', title: 'Validate schemas', desc: 'Check data consistency', tab: 'schemas' }
		];

		const taskGrid = tasksContent.createDiv({ cls: 'crc-task-grid' });
		tasks.forEach(task => {
			const taskEl = taskGrid.createDiv({ cls: 'crc-task-grid__item' });
			const iconWrap = taskEl.createDiv({ cls: 'crc-task-grid__icon' });
			setLucideIcon(iconWrap, task.icon as LucideIconName, 20);
			taskEl.createEl('strong', { text: task.title, cls: 'crc-task-grid__title' });
			taskEl.createEl('span', { text: task.desc, cls: 'crc-task-grid__desc' });

			taskEl.addEventListener('click', () => {
				if (task.command) {
					this.close();
					this.app.commands.executeCommandById(task.command);
				} else if (task.tab) {
					this.switchTab(task.tab);
				}
			});
		});

		container.appendChild(tasksCard);

		// =========================================================================
		// Card 6: Base Templates (Obsidian Bases)
		// =========================================================================
		const templatesCard = this.createCard({
			title: 'Base templates',
			icon: 'table-2',
			subtitle: 'Obsidian Bases integration'
		});
		const templatesContent = templatesCard.querySelector('.crc-card__content') as HTMLElement;

		templatesContent.createEl('p', {
			text: 'Quickly create bases for organizing your data:',
			cls: 'crc-mb-3'
		});

		const baseTemplates = [
			{ icon: 'user', title: 'People', desc: 'Family members with relationships', command: 'canvas-roots:create-base-template' },
			{ icon: 'map-pin', title: 'Places', desc: 'Geographic locations', command: 'canvas-roots:create-places-base-template' },
			{ icon: 'calendar', title: 'Events', desc: 'Life events and milestones', command: 'canvas-roots:create-events-base-template' },
			{ icon: 'building', title: 'Organizations', desc: 'Businesses, churches, schools', command: 'canvas-roots:create-organizations-base-template' },
			{ icon: 'book', title: 'Sources', desc: 'Citations and references', command: 'canvas-roots:create-sources-base-template' },
			{ icon: 'globe', title: 'Universes', desc: 'Fictional worlds and settings', command: 'canvas-roots:create-universes-base-template' }
		];

		const templateGrid = templatesContent.createDiv({ cls: 'crc-template-grid' });
		baseTemplates.forEach(template => {
			const templateEl = templateGrid.createDiv({ cls: 'crc-template-grid__item' });
			const iconWrap = templateEl.createDiv({ cls: 'crc-template-grid__icon' });
			setLucideIcon(iconWrap, template.icon as LucideIconName, 18);
			const textWrap = templateEl.createDiv({ cls: 'crc-template-grid__text' });
			textWrap.createEl('div', { text: template.title, cls: 'crc-template-grid__title' });
			textWrap.createEl('small', { text: template.desc });
			const btn = templateEl.createEl('button', { text: 'Create', cls: 'crc-btn crc-btn--small' });
			btn.addEventListener('click', () => {
				this.close();
				this.app.commands.executeCommandById(template.command);
			});
		});

		// Create all bases button
		const createAllContainer = templatesContent.createDiv({ cls: 'crc-mt-3' });
		const createAllBtn = createAllContainer.createEl('button', {
			text: 'Create all bases',
			cls: 'crc-btn crc-btn--secondary'
		});
		createAllBtn.addEventListener('click', () => {
			this.close();
			this.app.commands.executeCommandById('canvas-roots:create-all-bases');
		});

		container.appendChild(templatesCard);

		// =========================================================================
		// Card 7: Learn More
		// =========================================================================
		const learnCard = this.createCard({
			title: 'Learn more',
			icon: 'book-open',
			subtitle: 'Documentation, templates, and tips'
		});
		const learnContent = learnCard.querySelector('.crc-card__content') as HTMLElement;

		// Documentation grid with categories
		const docsGrid = learnContent.createDiv({ cls: 'crc-docs-grid crc-mb-4' });

		const docCategories = [
			{
				title: 'Getting started',
				icon: 'rocket' as LucideIconName,
				links: [
					{ text: 'Getting started', wiki: 'Getting-Started' },
					{ text: 'Data entry', wiki: 'Data-Entry' },
					{ text: 'Templater integration', wiki: 'Templater-Integration' },
					{ text: 'Context menus', wiki: 'Context-Menus' }
				]
			},
			{
				title: 'Visualization',
				icon: 'git-branch' as LucideIconName,
				links: [
					{ text: 'Tree generation', wiki: 'Tree-Generation' },
					{ text: 'Geographic features', wiki: 'Geographic-Features' },
					{ text: 'Styling & theming', wiki: 'Styling-And-Theming' }
				]
			},
			{
				title: 'Data management',
				icon: 'database' as LucideIconName,
				links: [
					{ text: 'Import/Export', wiki: 'Import-Export' },
					{ text: 'Schema validation', wiki: 'Schema-Validation' },
					{ text: 'Evidence & sources', wiki: 'Evidence-And-Sources' }
				]
			},
			{
				title: 'Reference',
				icon: 'book-open' as LucideIconName,
				links: [
					{ text: 'Frontmatter reference', wiki: 'Frontmatter-Reference' },
					{ text: 'Settings & configuration', wiki: 'Settings-And-Configuration' },
					{ text: 'Fictional date systems', wiki: 'Fictional-Date-Systems' }
				]
			}
		];

		docCategories.forEach(category => {
			const categoryDiv = docsGrid.createDiv({ cls: 'crc-docs-category' });

			// Category title with icon
			const titleDiv = categoryDiv.createDiv({ cls: 'crc-docs-category__title' });
			const iconEl = titleDiv.createSpan({ cls: 'crc-docs-category__icon' });
			setLucideIcon(iconEl, category.icon, 14);
			titleDiv.createSpan({ text: category.title });

			// Links
			const linksList = categoryDiv.createEl('ul', { cls: 'crc-docs-category__links' });
			category.links.forEach(link => {
				const li = linksList.createEl('li');
				const a = li.createEl('a', { text: link.text, href: `${WIKI_BASE}/${link.wiki}` });
				a.setAttr('target', '_blank');
			});
		});

		// Templater section
		const templaterSection = learnContent.createDiv();
		templaterSection.createEl('h4', { text: 'Templater integration', cls: 'crc-mb-2' });
		templaterSection.createEl('p', {
			text: 'Use the Templater plugin to create notes with consistent formatting and unique cr_id values.',
			cls: 'crc-text-muted crc-mb-2'
		});
		const templaterBtnRow = templaterSection.createDiv({ cls: 'crc-btn-row' });
		const templaterBtn = templaterBtnRow.createEl('button', {
			text: 'View snippets',
			cls: 'crc-btn crc-btn--secondary'
		});
		templaterBtn.addEventListener('click', () => {
			new TemplateSnippetsModal(this.app, undefined, this.plugin.settings.propertyAliases).open();
		});
		const templaterDocsLink = templaterBtnRow.createEl('a', {
			text: 'Full guide →',
			href: `${WIKI_BASE}/Templater-Integration`,
			cls: 'crc-link'
		});
		templaterDocsLink.setAttr('target', '_blank');

		container.appendChild(learnCard);
	}

	/**
	 * Create a collapsible section within a card
	 */
	private createCollapsible(
		container: HTMLElement,
		title: string,
		icon: LucideIconName,
		renderContent: (body: HTMLElement) => void
	): HTMLElement {
		const wrapper = container.createDiv({ cls: 'crc-collapsible' });

		const header = wrapper.createDiv({ cls: 'crc-collapsible__header' });
		const headerLeft = header.createDiv({ cls: 'crc-collapsible__header-left' });
		const iconEl = headerLeft.createDiv({ cls: 'crc-collapsible__icon' });
		setLucideIcon(iconEl, icon, 16);
		headerLeft.createSpan({ text: title, cls: 'crc-collapsible__title' });

		const chevron = header.createDiv({ cls: 'crc-collapsible__chevron' });
		setLucideIcon(chevron, 'chevron-down', 16);

		const body = wrapper.createDiv({ cls: 'crc-collapsible__body' });
		renderContent(body);

		header.addEventListener('click', () => {
			wrapper.toggleClass('crc-collapsible--open', !wrapper.hasClass('crc-collapsible--open'));
		});

		return wrapper;
	}

	/**
	 * Create an accordion section for the Tree Output two-panel layout
	 */
	private createAccordionSection(
		container: HTMLElement,
		title: string,
		icon: LucideIconName,
		defaultExpanded: boolean,
		badge?: string,
		renderContent?: (body: HTMLElement) => void
	): { wrapper: HTMLElement; content: HTMLElement } {
		const wrapper = container.createDiv({ cls: 'crc-accordion-section' });

		const header = wrapper.createDiv({ cls: 'crc-accordion-header' });

		// Chevron
		const chevron = header.createSpan({ cls: 'crc-accordion-chevron' });
		setLucideIcon(chevron, defaultExpanded ? 'chevron-down' : 'chevron-right', 14);
		if (defaultExpanded) {
			chevron.addClass('crc-accordion-chevron--expanded');
		}

		// Icon
		const iconEl = header.createSpan({ cls: 'crc-accordion-icon' });
		setLucideIcon(iconEl, icon, 16);

		// Title
		header.createSpan({ text: title, cls: 'crc-accordion-title' });

		// Optional badge
		if (badge) {
			header.createSpan({ text: badge, cls: 'crc-accordion-badge' });
		}

		// Content
		const content = wrapper.createDiv({
			cls: defaultExpanded ? 'crc-accordion-content' : 'crc-accordion-content crc-accordion-content--collapsed'
		});

		// Render content if provided
		if (renderContent) {
			renderContent(content);
		}

		// Toggle handler
		header.addEventListener('click', () => {
			const isExpanded = !content.hasClass('crc-accordion-content--collapsed');
			content.toggleClass('crc-accordion-content--collapsed', isExpanded);
			chevron.toggleClass('crc-accordion-chevron--expanded', !isExpanded);
			setLucideIcon(chevron, isExpanded ? 'chevron-right' : 'chevron-down', 14);
		});

		return { wrapper, content };
	}

	/**
	 * Show People tab - combined statistics, actions, and person list
	 */
	private showPeopleTab(): void {
		const container = this.contentContainer;

		// Actions Card
		const actionsCard = this.createCard({
			title: 'Actions',
			icon: 'plus',
			subtitle: 'Create and manage person notes'
		});

		const actionsContent = actionsCard.querySelector('.crc-card__content') as HTMLElement;

		new Setting(actionsContent)
			.setName('Create new person note')
			.setDesc('Create a new person note with family relationships')
			.addButton(button => button
				.setButtonText('Create person')
				.setCta()
				.onClick(() => {
					const placeGraph = this.plugin.createPlaceGraphService();
					const familyGraph = this.plugin.createFamilyGraphService();
					// Merge universes from both places and people
					const placeUniverses = placeGraph.getAllUniverses();
					const personUniverses = familyGraph.getAllUniverses();
					const allUniverses = [...new Set([
						...placeUniverses,
						...personUniverses
					])].sort();
					new CreatePersonModal(this.app, {
						directory: this.plugin.settings.peopleFolder || '',
						familyGraph,
						propertyAliases: this.plugin.settings.propertyAliases,
						includeDynamicBlocks: false,
						dynamicBlockTypes: ['timeline', 'relationships'],
						existingUniverses: allUniverses,
						onCreated: () => {
							// Refresh the People tab
							this.showTab('people');
						}
					}).open();
				}));

		new Setting(actionsContent)
			.setName('Templater templates')
			.setDesc('Copy ready-to-use templates for Templater integration')
			.addButton(button => button
				.setButtonText('View templates')
				.onClick(() => {
					new TemplateSnippetsModal(this.app, undefined, this.plugin.settings.propertyAliases).open();
				}));

		new Setting(actionsContent)
			.setName('Create People base')
			.setDesc('Create an Obsidian base for managing People notes. After creating, click "Properties" to enable columns like Name, Parents, Spouse, Children, Birth, and Death.')
			.addButton(button => button
				.setButtonText('Create')
				.onClick(() => {
					this.app.commands.executeCommandById('canvas-roots:create-base-template');
				}));

		container.appendChild(actionsCard);

		// Batch Operations Card
		const batchCard = this.createCard({
			title: 'Batch operations',
			icon: 'zap',
			subtitle: 'Fix common data issues across person notes'
		});

		const batchContent = batchCard.querySelector('.crc-card__content') as HTMLElement;

		// Navigation guidance
		const navInfo = batchContent.createEl('p', {
			cls: 'crc-text-muted',
			text: 'These operations work on all person notes in your vault. For comprehensive data quality analysis across all entities, see the '
		});
		const dataQualityLink = navInfo.createEl('a', {
			text: 'Data Quality tab',
			href: '#',
			cls: 'crc-text-link'
		});
		dataQualityLink.addEventListener('click', (e) => {
			e.preventDefault();
			this.showTab('data-quality');
		});
		navInfo.appendText('.');

		new Setting(batchContent)
			.setName('Remove duplicate relationships')
			.setDesc('Clean up duplicate entries in spouse and children arrays')
			.addButton(button => button
				.setButtonText('Preview')
				.onClick(() => {
					void this.previewRemoveDuplicateRelationships();
				}))
			.addButton(button => button
				.setButtonText('Apply')
				.setCta()
				.onClick(() => {
					void this.removeDuplicateRelationships();
				}));

		new Setting(batchContent)
			.setName('Remove placeholder values')
			.setDesc('Clean up placeholder text like "Unknown", "N/A", "???", and malformed wikilinks')
			.addButton(button => button
				.setButtonText('Preview')
				.onClick(() => {
					void this.previewRemovePlaceholders();
				}))
			.addButton(button => button
				.setButtonText('Apply')
				.setCta()
				.onClick(() => {
					void this.removePlaceholders();
				}));

		new Setting(batchContent)
			.setName('Add cr_type property to person notes')
			.setDesc('Add cr_type: person to all person notes that don\'t have it (recommended for better compatibility)')
			.addButton(button => button
				.setButtonText('Preview')
				.onClick(() => {
					void this.previewAddPersonType();
				}))
			.addButton(button => button
				.setButtonText('Apply')
				.setCta()
				.onClick(() => {
					void this.addPersonType();
				}));

		// Third operation: Normalize name formatting
		new Setting(batchContent)
			.setName('Normalize name formatting')
			.setDesc('Standardize name capitalization: "JOHN SMITH" → "John Smith", handle prefixes like van, de, Mac')
			.addButton(button => button
				.setButtonText('Preview')
				.onClick(() => {
					void this.previewNormalizeNames();
				}))
			.addButton(button => button
				.setButtonText('Apply')
				.setCta()
				.onClick(() => {
					void this.normalizeNames();
				}));

		// Fourth operation: Fix bidirectional relationship inconsistencies
		new Setting(batchContent)
			.setName('Fix bidirectional relationship inconsistencies')
			.setDesc('Add missing reciprocal relationship links (parent↔child, spouse↔spouse)')
			.addButton(button => button
				.setButtonText('Preview')
				.onClick(() => {
					void this.previewFixBidirectionalRelationships();
				}))
			.addButton(button => button
				.setButtonText('Apply')
				.setCta()
				.onClick(() => {
					void this.fixBidirectionalRelationships();
				}));

		// Fifth operation: Validate date formats
		new Setting(batchContent)
			.setName('Validate date formats')
			.setDesc('Check all date fields (born, died, birth_date, death_date) for format issues based on your date validation preferences')
			.addButton(button => button
				.setButtonText('Preview')
				.onClick(() => {
					void this.previewValidateDates();
				}))
			.addButton(button => button
				.setButtonText('Apply')
				.setCta()
				.onClick(() => {
					void this.validateDates();
				}));

		// Sixth operation: Detect impossible dates
		new Setting(batchContent)
			.setName('Detect impossible dates')
			.setDesc('Find logical date errors (birth after death, unrealistic lifespans, parent-child date conflicts)')
			.addButton(button => button
				.setButtonText('Preview')
				.onClick(() => {
					void this.previewDetectImpossibleDates();
				}));

		container.appendChild(batchCard);

		// Parent Claim Conflicts Card
		const conflictsCard = this.createCard({
			title: 'Parent claim conflicts',
			icon: 'alert-triangle',
			subtitle: 'Children claimed by multiple parents'
		});
		const conflictsContent = conflictsCard.querySelector('.crc-card__content') as HTMLElement;
		conflictsContent.createEl('p', {
			text: 'Scanning for conflicts...',
			cls: 'crc-text--muted'
		});
		container.appendChild(conflictsCard);

		// Load conflicts asynchronously
		void this.loadParentClaimConflicts(conflictsContent);

		// Statistics Card
		const statsCard = this.createCard({
			title: 'Person statistics',
			icon: 'users',
			subtitle: 'Overview of person notes in your vault'
		});

		const statsContent = statsCard.querySelector('.crc-card__content') as HTMLElement;
		statsContent.createEl('p', {
			text: 'Loading statistics...',
			cls: 'crc-text--muted'
		});

		container.appendChild(statsCard);

		// Load statistics asynchronously
		void this.loadPersonStatistics(statsContent);

		// Person List Card
		const listCard = this.createCard({
			title: 'Person notes',
			icon: 'user',
			subtitle: 'All person notes in your vault'
		});

		const listContent = listCard.querySelector('.crc-card__content') as HTMLElement;
		listContent.createEl('p', {
			text: 'Loading people...',
			cls: 'crc-text--muted'
		});

		container.appendChild(listCard);

		// Load person list asynchronously
		void this.loadPersonList(listContent);
	}

	/**
	 * Load person statistics into container
	 */
	private loadPersonStatistics(container: HTMLElement): void {
		container.empty();

		const statsService = new VaultStatsService(this.app);
		statsService.setSettings(this.plugin.settings);
		const stats = statsService.collectStats();

		// If no people, show getting started message
		if (stats.people.totalPeople === 0) {
			const emptyState = container.createDiv({ cls: 'crc-empty-state' });
			emptyState.createEl('p', {
				text: 'No person notes found in your vault.',
				cls: 'crc-text--muted'
			});
			emptyState.createEl('p', {
				text: 'Person notes require a cr_id property in their frontmatter. Create person notes to start building your family tree.',
				cls: 'crc-text--muted crc-text--small'
			});
			return;
		}

		// Overview statistics grid
		const statsGrid = container.createDiv({ cls: 'crc-stats-grid' });

		// Total people
		this.createStatItem(statsGrid, 'Total people', stats.people.totalPeople.toString(), 'users');

		// With birth date
		const birthPercent = stats.people.totalPeople > 0
			? Math.round((stats.people.peopleWithBirthDate / stats.people.totalPeople) * 100)
			: 0;
		this.createStatItem(statsGrid, 'With birth date', `${stats.people.peopleWithBirthDate} (${birthPercent}%)`, 'calendar');

		// Living people
		this.createStatItem(statsGrid, 'Living', stats.people.livingPeople.toString(), 'heart');

		// Orphaned (no relationships)
		this.createStatItem(statsGrid, 'No relationships', stats.people.orphanedPeople.toString(), 'user-minus');

		// Relationship statistics section
		const relSection = container.createDiv({ cls: 'crc-mt-4' });
		relSection.createEl('h4', { text: 'Relationships', cls: 'crc-section-title' });

		const relGrid = relSection.createDiv({ cls: 'crc-stats-grid crc-stats-grid--compact' });

		// With father
		const fatherPercent = stats.people.totalPeople > 0
			? Math.round((stats.people.peopleWithFather / stats.people.totalPeople) * 100)
			: 0;
		this.createStatItem(relGrid, 'With father', `${stats.people.peopleWithFather} (${fatherPercent}%)`);

		// With mother
		const motherPercent = stats.people.totalPeople > 0
			? Math.round((stats.people.peopleWithMother / stats.people.totalPeople) * 100)
			: 0;
		this.createStatItem(relGrid, 'With mother', `${stats.people.peopleWithMother} (${motherPercent}%)`);

		// With spouse
		const spousePercent = stats.people.totalPeople > 0
			? Math.round((stats.people.peopleWithSpouse / stats.people.totalPeople) * 100)
			: 0;
		this.createStatItem(relGrid, 'With spouse', `${stats.people.peopleWithSpouse} (${spousePercent}%)`);

		// Total relationships
		this.createStatItem(relGrid, 'Total relationships', stats.relationships.totalRelationships.toString());

		// View full statistics link
		const statsLink = container.createDiv({ cls: 'cr-stats-link' });
		const link = statsLink.createEl('a', { text: 'View full statistics →', cls: 'crc-text-muted' });
		link.addEventListener('click', (e) => {
			e.preventDefault();
			this.close();
			void this.plugin.activateStatisticsView();
		});
	}

	/**
	 * Load parent claim conflicts into container
	 */
	private loadParentClaimConflicts(container: HTMLElement): void {
		container.empty();

		// Create services
		const folderFilter = new FolderFilterService(this.plugin.settings);
		const familyGraph = this.plugin.createFamilyGraphService();
		familyGraph.ensureCacheLoaded();

		const dataQuality = new DataQualityService(
			this.app,
			this.plugin.settings,
			familyGraph,
			folderFilter,
			this.plugin
		);

		// Detect conflicts
		const inconsistencies = dataQuality.detectBidirectionalInconsistencies();
		const conflicts = inconsistencies.filter(i => i.type === 'conflicting-parent-claim');

		if (conflicts.length === 0) {
			const emptyState = container.createDiv({ cls: 'crc-empty-state' });
			emptyState.createEl('p', {
				text: 'No parent claim conflicts found.',
				cls: 'crc-text--muted'
			});
			emptyState.createEl('p', {
				text: 'Conflicts occur when multiple people list the same child in their children_id field.',
				cls: 'crc-text--muted crc-text--small'
			});
			return;
		}

		// Explanation
		const explanation = container.createDiv({ cls: 'crc-info-callout crc-mb-3' });
		explanation.createEl('p', {
			text: `Found ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} where multiple people claim the same child. Review each and choose which parent is correct.`,
			cls: 'crc-text--small'
		});

		// Create table
		const tableContainer = container.createDiv({ cls: 'crc-batch-table-container' });
		const table = tableContainer.createEl('table', { cls: 'crc-batch-preview-table crc-conflicts-table' });

		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Child' });
		headerRow.createEl('th', { text: 'Type' });
		headerRow.createEl('th', { text: 'Claimant 1' });
		headerRow.createEl('th', { text: 'Claimant 2' });
		headerRow.createEl('th', { text: 'Actions' });

		const tbody = table.createEl('tbody');

		for (const conflict of conflicts) {
			const child = conflict.relatedPerson;
			const claimant1 = conflict.person;  // Current parent in child's father_id/mother_id
			const claimant2 = conflict.conflictingPerson;  // Other claimant

			if (!claimant2) continue;

			const row = tbody.createEl('tr');

			// Child cell (clickable)
			const childCell = row.createEl('td');
			const childLink = childCell.createEl('a', {
				text: child.name || child.file.basename,
				cls: 'crc-person-link'
			});
			childLink.addEventListener('click', (e) => {
				e.preventDefault();
				void this.app.workspace.openLinkText(child.file.path, '', false);
			});
			childLink.addEventListener('contextmenu', (e) => {
				e.preventDefault();
				this.showPersonLinkContextMenu(child.file, e);
			});

			// Conflict type
			row.createEl('td', { text: conflict.conflictType === 'father' ? 'Father' : 'Mother' });

			// Claimant 1 cell - show name and cr_id for disambiguation
			const claimant1Cell = row.createEl('td');
			const claimant1Link = claimant1Cell.createEl('a', {
				text: claimant1.name || claimant1.file.basename,
				cls: 'crc-person-link'
			});
			claimant1Link.addEventListener('click', (e) => {
				e.preventDefault();
				void this.app.workspace.openLinkText(claimant1.file.path, '', false);
			});
			claimant1Link.addEventListener('contextmenu', (e) => {
				e.preventDefault();
				this.showPersonLinkContextMenu(claimant1.file, e);
			});
			claimant1Cell.createEl('span', {
				text: ` (${claimant1.crId})`,
				cls: 'crc-text--muted crc-text--small'
			});

			// Claimant 2 cell - show name and cr_id for disambiguation
			const claimant2Cell = row.createEl('td');
			const claimant2Link = claimant2Cell.createEl('a', {
				text: claimant2.name || claimant2.file.basename,
				cls: 'crc-person-link'
			});
			claimant2Link.addEventListener('click', (e) => {
				e.preventDefault();
				void this.app.workspace.openLinkText(claimant2.file.path, '', false);
			});
			claimant2Link.addEventListener('contextmenu', (e) => {
				e.preventDefault();
				this.showPersonLinkContextMenu(claimant2.file, e);
			});
			claimant2Cell.createEl('span', {
				text: ` (${claimant2.crId})`,
				cls: 'crc-text--muted crc-text--small'
			});

			// Actions cell
			const actionsCell = row.createEl('td', { cls: 'crc-conflict-actions' });

			// Keep Claimant 1 button
			const keepBtn1 = actionsCell.createEl('button', {
				text: 'Keep 1',
				cls: 'crc-btn-small',
				attr: { title: `Keep ${claimant1.name || claimant1.file.basename} as ${conflict.conflictType}` }
			});
			keepBtn1.addEventListener('click', () => {
				void (async () => {
					await this.resolveParentConflict(child, claimant1, claimant2, conflict.conflictType!, 'keep1');
					row.remove();
					this.updateConflictCardCount(container, tbody);
				})();
			});

			// Keep Claimant 2 button
			const keepBtn2 = actionsCell.createEl('button', {
				text: 'Keep 2',
				cls: 'crc-btn-small',
				attr: { title: `Keep ${claimant2.name || claimant2.file.basename} as ${conflict.conflictType}` }
			});
			keepBtn2.addEventListener('click', () => {
				void (async () => {
					await this.resolveParentConflict(child, claimant1, claimant2, conflict.conflictType!, 'keep2');
					row.remove();
					this.updateConflictCardCount(container, tbody);
				})();
			});
		}

		// Count display
		const countDiv = container.createDiv({ cls: 'crc-conflicts-count crc-mt-2' });
		countDiv.createSpan({
			text: `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} to resolve`,
			cls: 'crc-text--muted'
		});
	}

	/**
	 * Resolve a parent claim conflict
	 */
	private async resolveParentConflict(
		child: PersonNode,
		claimant1: PersonNode,
		claimant2: PersonNode,
		conflictType: 'father' | 'mother',
		resolution: 'keep1' | 'keep2'
	): Promise<void> {
		const parentField = conflictType === 'father' ? 'father_id' : 'mother_id';
		const parentWikilinkField = conflictType === 'father' ? 'father' : 'mother';

		// Suspend linker during changes
		this.plugin.bidirectionalLinker?.suspend();

		try {
			if (resolution === 'keep1') {
				// Keep claimant1: remove child from claimant2's children_id
				await this.removeChildFromParent(claimant2.file, child.crId);
				new Notice(`Removed ${child.name || child.file.basename} from ${claimant2.name || claimant2.file.basename}'s children`);
			} else {
				// Keep claimant2: update child's parent field and remove from claimant1's children_id
				await this.app.fileManager.processFrontMatter(child.file, (fm) => {
					fm[parentField] = claimant2.crId;
					fm[parentWikilinkField] = `[[${claimant2.name || claimant2.file.basename}]]`;
				});
				await this.removeChildFromParent(claimant1.file, child.crId);
				new Notice(`Changed ${child.name || child.file.basename}'s ${conflictType} to ${claimant2.name || claimant2.file.basename}`);
			}

			// Reload cache
			const familyGraph = this.plugin.createFamilyGraphService();
			await familyGraph.reloadCache();
		} finally {
			// Resume linker after a short delay
			setTimeout(() => {
				this.plugin.bidirectionalLinker?.resume();
			}, 500);
		}
	}

	/**
	 * Remove a child from a parent's children_id array
	 */
	private async removeChildFromParent(parentFile: TFile, childCrId: string): Promise<void> {
		await this.app.fileManager.processFrontMatter(parentFile, (fm) => {
			if (fm.children_id) {
				if (Array.isArray(fm.children_id)) {
					fm.children_id = fm.children_id.filter((id: string) => id !== childCrId);
					if (fm.children_id.length === 0) {
						delete fm.children_id;
					}
				} else if (fm.children_id === childCrId) {
					delete fm.children_id;
				}
			}
		});
	}

	/**
	 * Update conflict card count after resolving one
	 */
	private updateConflictCardCount(container: HTMLElement, tbody: HTMLElement): void {
		const remainingRows = tbody.querySelectorAll('tr').length;
		const countEl = container.querySelector('.crc-conflicts-count span');

		if (remainingRows === 0) {
			// All conflicts resolved - show empty state
			container.empty();
			const emptyState = container.createDiv({ cls: 'crc-empty-state' });
			emptyState.createEl('p', {
				text: 'All parent claim conflicts have been resolved!',
				cls: 'crc-text--muted'
			});
		} else if (countEl) {
			countEl.textContent = `${remainingRows} conflict${remainingRows === 1 ? '' : 's'} to resolve`;
		}
	}

	/**
	 * Person list item for display (includes place info for action buttons)
	 */
	private personListItems: {
		crId: string;
		name: string;
		birthDate?: string;
		deathDate?: string;
		birthPlace?: PlaceInfo;
		deathPlace?: PlaceInfo;
		burialPlace?: PlaceInfo;
		file: TFile;
	}[] = [];

	/**
	 * Load person list into container
	 */
	/** Current person list filter */
	private personListFilter: 'all' | 'has-dates' | 'missing-dates' | 'unlinked-places' | 'living' = 'all';

	/** Current person list sort */
	private personListSort: 'name-asc' | 'name-desc' | 'birth-asc' | 'birth-desc' | 'death-asc' | 'death-desc' = 'name-asc';

	/** Current universe list filter */
	private universeListFilter: 'all' | 'active' | 'draft' | 'archived' | 'has-entities' | 'empty' = 'all';

	/** Current universe list sort */
	private universeListSort: 'name-asc' | 'name-desc' | 'created-asc' | 'created-desc' | 'entities-asc' | 'entities-desc' = 'name-asc';

	private loadPersonList(container: HTMLElement): void {
		container.empty();

		const familyGraph = this.plugin.createFamilyGraphService();
		familyGraph.ensureCacheLoaded();
		const people = familyGraph.getAllPeople();

		if (people.length === 0) {
			container.createEl('p', {
				text: 'No person notes found. Create person notes with a cr_id in frontmatter.',
				cls: 'crc-text--muted'
			});
			return;
		}

		// Map to display format with place info
		this.personListItems = people.map(p => {
			// Get place info from frontmatter (need raw values for isLinked detection)
			const cache = this.app.metadataCache.getFileCache(p.file);
			const fm = cache?.frontmatter || {};

			return {
				crId: p.crId,
				name: p.name,
				birthDate: p.birthDate,
				deathDate: p.deathDate,
				birthPlace: extractPlaceInfo(fm.birth_place),
				deathPlace: extractPlaceInfo(fm.death_place),
				burialPlace: extractPlaceInfo(fm.burial_place),
				file: p.file
			};
		});

		// Create controls row (filter + sort + search)
		const controlsRow = container.createDiv({ cls: 'crc-person-controls' });

		// Filter dropdown
		const filterSelect = controlsRow.createEl('select', {
			cls: 'dropdown'
		});
		const filterOptions = [
			{ value: 'all', label: 'All people' },
			{ value: 'has-dates', label: 'Has dates' },
			{ value: 'missing-dates', label: 'Missing dates' },
			{ value: 'unlinked-places', label: 'Unlinked places' },
			{ value: 'living', label: 'Living (no death)' }
		];
		filterOptions.forEach(opt => {
			const option = filterSelect.createEl('option', { text: opt.label, value: opt.value });
			if (opt.value === this.personListFilter) option.selected = true;
		});

		// Sort dropdown
		const sortSelect = controlsRow.createEl('select', {
			cls: 'dropdown'
		});
		const sortOptions = [
			{ value: 'name-asc', label: 'Name (A–Z)' },
			{ value: 'name-desc', label: 'Name (Z–A)' },
			{ value: 'birth-asc', label: 'Birth (oldest)' },
			{ value: 'birth-desc', label: 'Birth (newest)' },
			{ value: 'death-asc', label: 'Death (oldest)' },
			{ value: 'death-desc', label: 'Death (newest)' }
		];
		sortOptions.forEach(opt => {
			const option = sortSelect.createEl('option', { text: opt.label, value: opt.value });
			if (opt.value === this.personListSort) option.selected = true;
		});

		// Search input
		const searchInput = controlsRow.createEl('input', {
			cls: 'crc-filter-input',
			attr: {
				type: 'text',
				placeholder: `Search ${this.personListItems.length} people...`
			}
		});

		// Usage hint
		const hint = container.createEl('p', {
			cls: 'crc-text-muted crc-text-small crc-mb-2'
		});
		hint.appendText('Click a row to edit. ');
		// File icon for "open note"
		const fileIconHint = createLucideIcon('file-text', 12);
		fileIconHint.addClass('crc-icon-inline');
		hint.appendChild(fileIconHint);
		hint.appendText(' opens the note. ');
		// Unlinked places badge
		const exampleBadge = hint.createEl('span', {
			cls: 'crc-person-list-badge crc-person-list-badge--unlinked crc-person-list-badge--hint'
		});
		const badgeIcon = createLucideIcon('map-pin', 10);
		exampleBadge.appendChild(badgeIcon);
		exampleBadge.appendText('1');
		hint.appendText(' creates place notes.');

		// List container
		const listContainer = container.createDiv({ cls: 'crc-person-list' });

		// Helper to check if person has unlinked places
		const hasUnlinkedPlaces = (p: typeof this.personListItems[0]): boolean => {
			return (p.birthPlace && !p.birthPlace.isLinked) ||
				(p.deathPlace && !p.deathPlace.isLinked) ||
				(p.burialPlace && !p.burialPlace.isLinked) || false;
		};

		// Apply filter, sort, and render
		const applyFiltersAndRender = () => {
			const query = searchInput.value.toLowerCase();

			// Filter by search query
			let filtered = this.personListItems.filter(p =>
				p.name.toLowerCase().includes(query) ||
				(p.birthDate && p.birthDate.includes(query)) ||
				(p.deathDate && p.deathDate.includes(query))
			);

			// Apply category filter
			switch (this.personListFilter) {
				case 'has-dates':
					filtered = filtered.filter(p => p.birthDate || p.deathDate);
					break;
				case 'missing-dates':
					filtered = filtered.filter(p => !p.birthDate && !p.deathDate);
					break;
				case 'unlinked-places':
					filtered = filtered.filter(hasUnlinkedPlaces);
					break;
				case 'living':
					filtered = filtered.filter(p => p.birthDate && !p.deathDate);
					break;
			}

			// Apply sort
			filtered.sort((a, b) => {
				switch (this.personListSort) {
					case 'name-asc':
						return a.name.localeCompare(b.name);
					case 'name-desc':
						return b.name.localeCompare(a.name);
					case 'birth-asc':
						return (a.birthDate || '9999').localeCompare(b.birthDate || '9999');
					case 'birth-desc':
						return (b.birthDate || '0000').localeCompare(a.birthDate || '0000');
					case 'death-asc':
						return (a.deathDate || '9999').localeCompare(b.deathDate || '9999');
					case 'death-desc':
						return (b.deathDate || '0000').localeCompare(a.deathDate || '0000');
					default:
						return 0;
				}
			});

			this.renderPersonListItems(listContainer, filtered);
		};

		// Event handlers
		searchInput.addEventListener('input', applyFiltersAndRender);

		filterSelect.addEventListener('change', () => {
			this.personListFilter = filterSelect.value as typeof this.personListFilter;
			applyFiltersAndRender();
		});

		sortSelect.addEventListener('change', () => {
			this.personListSort = sortSelect.value as typeof this.personListSort;
			applyFiltersAndRender();
		});

		// Initial render
		applyFiltersAndRender();
	}

	/** Maximum people to render initially (for performance) */
	private static readonly PERSON_LIST_PAGE_SIZE = 100;

	/**
	 * Render person list items as a table with pagination
	 */
	private renderPersonListItems(
		container: HTMLElement,
		people: {
			crId: string;
			name: string;
			birthDate?: string;
			deathDate?: string;
			birthPlace?: PlaceInfo;
			deathPlace?: PlaceInfo;
			burialPlace?: PlaceInfo;
			file: TFile;
		}[]
	): void {
		container.empty();

		if (people.length === 0) {
			container.createEl('p', {
				text: 'No matching people found.',
				cls: 'crc-text--muted'
			});
			return;
		}

		// For large lists, show count and paginate
		const totalCount = people.length;
		const needsPagination = totalCount > ControlCenterModal.PERSON_LIST_PAGE_SIZE;
		let renderedCount = 0;

		// Create table structure
		const table = container.createEl('table', { cls: 'crc-person-table' });
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Name', cls: 'crc-person-table__th' });
		headerRow.createEl('th', { text: 'Born', cls: 'crc-person-table__th' });
		headerRow.createEl('th', { text: 'Died', cls: 'crc-person-table__th' });
		headerRow.createEl('th', { text: '', cls: 'crc-person-table__th crc-person-table__th--icon' }); // For badges

		const tbody = table.createEl('tbody');

		const renderBatch = (startFrom: number, limit: number): number => {
			let rendered = 0;
			for (let i = startFrom; i < people.length && rendered < limit; i++) {
				this.renderPersonTableRow(tbody, people[i]);
				rendered++;
			}
			return rendered;
		};

		// Initial render
		renderedCount = renderBatch(0, ControlCenterModal.PERSON_LIST_PAGE_SIZE);

		// Show "Load more" button if needed
		if (needsPagination && renderedCount < totalCount) {
			const loadMoreContainer = container.createDiv({ cls: 'crc-load-more-container' });
			const loadMoreBtn = loadMoreContainer.createEl('button', {
				cls: 'crc-btn crc-btn--secondary',
				text: `Load more (${renderedCount} of ${totalCount} shown)`
			});

			loadMoreBtn.addEventListener('click', () => {
				const newRendered = renderBatch(renderedCount, ControlCenterModal.PERSON_LIST_PAGE_SIZE);
				renderedCount += newRendered;

				if (renderedCount >= totalCount) {
					loadMoreContainer.remove();
				} else {
					loadMoreBtn.setText(`Load more (${renderedCount} of ${totalCount} shown)`);
				}
			});
		}
	}

	/**
	 * Render a single person as a table row
	 */
	private renderPersonTableRow(
		tbody: HTMLElement,
		person: {
			crId: string;
			name: string;
			birthDate?: string;
			deathDate?: string;
			birthPlace?: PlaceInfo;
			deathPlace?: PlaceInfo;
			burialPlace?: PlaceInfo;
			file: TFile;
		}
	): void {
		const row = tbody.createEl('tr', { cls: 'crc-person-table__row' });

		// Name cell
		row.createEl('td', {
			text: person.name,
			cls: 'crc-person-table__td crc-person-table__td--name'
		});

		// Birth date cell
		row.createEl('td', {
			text: person.birthDate || '—',
			cls: 'crc-person-table__td crc-person-table__td--date'
		});

		// Death date cell
		row.createEl('td', {
			text: person.deathDate || '—',
			cls: 'crc-person-table__td crc-person-table__td--date'
		});

		// Actions cell (unlinked places badge + open note button)
		const actionsCell = row.createEl('td', { cls: 'crc-person-table__td crc-person-table__td--actions' });

		// Check for unlinked places
		const unlinkedPlaces: { type: string; info: PlaceInfo }[] = [];
		if (person.birthPlace && !person.birthPlace.isLinked) {
			unlinkedPlaces.push({ type: 'Birth', info: person.birthPlace });
		}
		if (person.deathPlace && !person.deathPlace.isLinked) {
			unlinkedPlaces.push({ type: 'Death', info: person.deathPlace });
		}
		if (person.burialPlace && !person.burialPlace.isLinked) {
			unlinkedPlaces.push({ type: 'Burial', info: person.burialPlace });
		}

		if (unlinkedPlaces.length > 0) {
			const badge = actionsCell.createEl('span', {
				cls: 'crc-person-list-badge crc-person-list-badge--unlinked',
				attr: {
					title: `${unlinkedPlaces.length} unlinked place${unlinkedPlaces.length !== 1 ? 's' : ''}: ${unlinkedPlaces.map(p => p.info.placeName).join(', ')}`
				}
			});
			const mapIcon = createLucideIcon('map-pin', 12);
			badge.appendChild(mapIcon);
			badge.appendText(unlinkedPlaces.length.toString());

			// Click to show place creation options
			badge.addEventListener('click', (e) => {
				e.stopPropagation();
				this.showUnlinkedPlacesMenu(unlinkedPlaces, e);
			});
		}

		// Open note button
		const openBtn = actionsCell.createEl('button', {
			cls: 'crc-person-table__open-btn clickable-icon',
			attr: { 'aria-label': 'Open note' }
		});
		const fileIcon = createLucideIcon('file-text', 14);
		openBtn.appendChild(fileIcon);
		openBtn.addEventListener('click', async (e) => {
			e.stopPropagation();
			await this.plugin.trackRecentFile(person.file, 'person');
			void this.app.workspace.getLeaf(false).openFile(person.file);
		});

		// Click row to open edit modal
		row.addEventListener('click', () => {
			// Get full person data from frontmatter for edit modal
			const cache = this.app.metadataCache.getFileCache(person.file);
			const fm = cache?.frontmatter || {};

			// Extract relationship data
			const fatherId = fm.father_id || fm.father;
			const motherId = fm.mother_id || fm.mother;
			const spouseIds = fm.spouse_id || fm.spouse;

			const placeGraph = this.plugin.createPlaceGraphService();
			const familyGraph = this.plugin.createFamilyGraphService();
			// Merge universes from both places and people
			const placeUniverses = placeGraph.getAllUniverses();
			const personUniverses = familyGraph.getAllUniverses();
			const allUniverses = [...new Set([
				...placeUniverses,
				...personUniverses
			])].sort();
			const modal = new CreatePersonModal(this.app, {
				editFile: person.file,
				editPersonData: {
					crId: person.crId,
					name: person.name,
					sex: fm.sex,
					gender: fm.gender,
					born: person.birthDate,
					died: person.deathDate,
					birthPlace: person.birthPlace?.placeName,
					deathPlace: person.deathPlace?.placeName,
					birthPlaceId: fm.birth_place_id,
					birthPlaceName: person.birthPlace?.placeName,
					deathPlaceId: fm.death_place_id,
					deathPlaceName: person.deathPlace?.placeName,
					occupation: fm.occupation,
					fatherId: typeof fatherId === 'string' ? fatherId : undefined,
					motherId: typeof motherId === 'string' ? motherId : undefined,
					spouseIds: Array.isArray(spouseIds) ? spouseIds : (spouseIds ? [spouseIds] : undefined),
					collection: fm.collection,
					universe: fm.universe
				},
				familyGraph,
				placeGraph,
				settings: this.plugin.settings,
				propertyAliases: this.plugin.settings.propertyAliases,
				existingUniverses: allUniverses,
				onUpdated: () => {
					// Refresh the People tab
					this.showTab('people');
				}
			});
			modal.open();
		});

		// Context menu for row
		row.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			this.showPersonContextMenu(person, e);
		});
	}

	/**
	 * Show menu for creating unlinked place notes
	 */
	private showUnlinkedPlacesMenu(
		unlinkedPlaces: { type: string; info: PlaceInfo }[],
		event: MouseEvent
	): void {
		const menu = new Menu();

		for (const { type, info } of unlinkedPlaces) {
			menu.addItem((item) => {
				item
					.setTitle(`Create "${info.placeName}" (${type.toLowerCase()})`)
					.setIcon('map-pin')
					.onClick(() => {
						void this.showQuickCreatePlaceModal(info.placeName);
					});
			});
		}

		menu.showAtMouseEvent(event);
	}

	/**
	 * Show context menu for a person list item
	 */
	private showPersonContextMenu(
		person: {
			crId: string;
			name: string;
			birthDate?: string;
			deathDate?: string;
			birthPlace?: PlaceInfo;
			deathPlace?: PlaceInfo;
			burialPlace?: PlaceInfo;
			file: TFile;
		},
		event: MouseEvent
	): void {
		const menu = new Menu();
		const useSubmenu = Platform.isDesktop && !Platform.isMobile;

		// Open actions
		menu.addItem((item) => {
			item
				.setTitle('Open note')
				.setIcon('file')
				.onClick(async () => {
					await this.plugin.trackRecentFile(person.file, 'person');
					void this.app.workspace.getLeaf(false).openFile(person.file);
				});
		});

		menu.addItem((item) => {
			item
				.setTitle('Open in new tab')
				.setIcon('file-plus')
				.onClick(async () => {
					await this.plugin.trackRecentFile(person.file, 'person');
					void this.app.workspace.getLeaf('tab').openFile(person.file);
				});
		});

		menu.addSeparator();

		// Events actions - submenu on desktop, flat on mobile
		if (useSubmenu) {
			menu.addItem((item) => {
				item
					.setTitle('Events')
					.setIcon('calendar');
				const submenu = item.setSubmenu();

				submenu.addItem((subitem) => {
					subitem
						.setTitle('Create event for this person')
						.setIcon('calendar-plus')
						.onClick(() => {
							const eventService = this.plugin.getEventService();
							if (eventService) {
								new CreateEventModal(
									this.app,
									eventService,
									this.plugin.settings,
									{
										initialPerson: { name: person.name, crId: person.crId }
									}
								).open();
							}
						});
				});

				submenu.addItem((subitem) => {
					subitem
						.setTitle('Export timeline to Canvas')
						.setIcon('layout')
						.onClick(() => {
							void this.exportPersonTimeline(person, 'canvas');
						});
				});

				submenu.addItem((subitem) => {
					subitem
						.setTitle('Export timeline to Excalidraw')
						.setIcon('edit')
						.onClick(() => {
							void this.exportPersonTimeline(person, 'excalidraw');
						});
				});
			});
		} else {
			// Mobile: flat menu with descriptive titles
			menu.addItem((item) => {
				item
					.setTitle('Create event for this person')
					.setIcon('calendar-plus')
					.onClick(() => {
						const eventService = this.plugin.getEventService();
						if (eventService) {
							new CreateEventModal(
								this.app,
								eventService,
								this.plugin.settings,
								{
									initialPerson: { name: person.name, crId: person.crId }
								}
							).open();
						}
					});
			});

			menu.addItem((item) => {
				item
					.setTitle('Export timeline to Canvas')
					.setIcon('layout')
					.onClick(() => {
						void this.exportPersonTimeline(person, 'canvas');
					});
			});

			menu.addItem((item) => {
				item
					.setTitle('Export timeline to Excalidraw')
					.setIcon('edit')
					.onClick(() => {
						void this.exportPersonTimeline(person, 'excalidraw');
					});
			});
		}

		menu.showAtMouseEvent(event);
	}

	/**
	 * Show a simple context menu for person links with open options
	 */
	private showPersonLinkContextMenu(file: TFile, event: MouseEvent): void {
		const menu = new Menu();

		menu.addItem((item) => {
			item
				.setTitle('Open')
				.setIcon('file')
				.onClick(async () => {
					await this.plugin.trackRecentFile(file, 'person');
					void this.app.workspace.getLeaf(false).openFile(file);
				});
		});

		menu.addItem((item) => {
			item
				.setTitle('Open in new tab')
				.setIcon('file-plus')
				.onClick(async () => {
					await this.plugin.trackRecentFile(file, 'person');
					void this.app.workspace.getLeaf('tab').openFile(file);
				});
		});

		menu.addItem((item) => {
			item
				.setTitle('Open in new window')
				.setIcon('external-link')
				.onClick(async () => {
					await this.plugin.trackRecentFile(file, 'person');
					void this.app.workspace.getLeaf('window').openFile(file);
				});
		});

		menu.showAtMouseEvent(event);
	}

	/**
	 * Export a person's timeline to Canvas or Excalidraw
	 */
	private async exportPersonTimeline(
		person: {
			crId: string;
			name: string;
			file: TFile;
		},
		format: 'canvas' | 'excalidraw' = 'canvas'
	): Promise<void> {
		const eventService = this.plugin.getEventService();
		if (!eventService) {
			new Notice('Event service not available');
			return;
		}

		const allEvents = eventService.getAllEvents();
		const personLink = `[[${person.name}]]`;

		// Filter events for this person
		const personEvents = allEvents.filter(e => {
			if (e.person) {
				const normalizedPerson = e.person.replace(/^\[\[/, '').replace(/\]\]$/, '').toLowerCase();
				return normalizedPerson === person.name.toLowerCase();
			}
			return false;
		});

		if (personEvents.length === 0) {
			new Notice(`No events found for ${person.name}`);
			return;
		}

		try {
			const { TimelineCanvasExporter } = await import('../events/services/timeline-canvas-exporter');
			const exporter = new TimelineCanvasExporter(this.app, this.plugin.settings);

			const result = await exporter.exportToCanvas(allEvents, {
				title: `${person.name} Timeline`,
				filterPerson: personLink,
				layoutStyle: 'horizontal',
				colorScheme: 'event_type',
				includeOrderingEdges: true
			});

			if (result.success && result.path) {
				if (format === 'excalidraw') {
					// Convert to Excalidraw
					const { ExcalidrawExporter } = await import('../excalidraw/excalidraw-exporter');
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
						const excalidrawPath = result.path.replace('.canvas', '.excalidraw.md');
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
	 * Render a timeline badge for a person list item
	 */
	private renderPersonTimelineBadge(
		item: HTMLElement,
		mainRow: HTMLElement,
		file: TFile,
		personName: string
	): void {
		const eventService = this.plugin.getEventService();
		if (!eventService) return;

		// Get events for this person
		const personLink = `[[${file.basename}]]`;
		const events = eventService.getEventsForPerson(personLink);

		// Don't show badge if no events
		if (events.length === 0) return;

		// Get summary info
		const summary = createTimelineSummary(events);

		// Create badge
		const badge = mainRow.createEl('span', {
			cls: 'crc-person-list-badge crc-person-list-badge--timeline',
			attr: {
				title: summary.dateRange
					? `${summary.count} events (${summary.dateRange})`
					: `${summary.count} events`
			}
		});
		const calendarIcon = createLucideIcon('calendar', 12);
		badge.appendChild(calendarIcon);
		badge.appendText(summary.count.toString());

		// Create expandable timeline section
		const timelineSection = item.createDiv({
			cls: 'crc-person-list-details crc-person-list-details--hidden crc-person-timeline-section'
		});

		// Toggle on badge click
		badge.addEventListener('click', (e) => {
			e.stopPropagation();
			const isHidden = timelineSection.hasClass('crc-person-list-details--hidden');
			timelineSection.toggleClass('crc-person-list-details--hidden', !isHidden);
			badge.toggleClass('crc-person-list-badge--active', isHidden);

			// Render timeline on first expand (lazy loading)
			if (isHidden && timelineSection.childElementCount === 0) {
				renderPersonTimeline(
					timelineSection,
					file,
					personName,
					this.app,
					this.plugin.settings,
					eventService,
					{
						maxEvents: 10,
						showEmptyState: false,
						onEventClick: (event) => {
							void this.app.workspace.getLeaf(false).openFile(event.file);
						}
					}
				);
			}
		});
	}

	/**
	 * Render a family timeline badge for a person list item
	 */
	private renderFamilyTimelineBadge(
		item: HTMLElement,
		mainRow: HTMLElement,
		file: TFile
	): void {
		const eventService = this.plugin.getEventService();
		if (!eventService) return;

		const familyGraph = this.plugin.createFamilyGraphService();
		familyGraph.ensureCacheLoaded();

		// Get family timeline summary
		const summary = getFamilyTimelineSummary(file, eventService, familyGraph);

		// Only show badge if there are family members with events beyond just the person
		// (memberCount > 1 means there are spouses/children)
		if (summary.memberCount <= 1 || summary.totalEvents === 0) return;

		// Create badge
		const badge = mainRow.createEl('span', {
			cls: 'crc-person-list-badge crc-person-list-badge--family-timeline',
			attr: {
				title: summary.dateRange
					? `Family: ${summary.totalEvents} events, ${summary.memberCount} members (${summary.dateRange})`
					: `Family: ${summary.totalEvents} events, ${summary.memberCount} members`
			}
		});
		const usersIcon = createLucideIcon('users', 12);
		badge.appendChild(usersIcon);
		badge.appendText(summary.totalEvents.toString());

		// Create expandable family timeline section
		const familySection = item.createDiv({
			cls: 'crc-person-list-details crc-person-list-details--hidden crc-family-timeline-section'
		});

		// Toggle on badge click
		badge.addEventListener('click', (e) => {
			e.stopPropagation();
			const isHidden = familySection.hasClass('crc-person-list-details--hidden');
			familySection.toggleClass('crc-person-list-details--hidden', !isHidden);
			badge.toggleClass('crc-person-list-badge--active', isHidden);

			// Render family timeline on first expand (lazy loading)
			if (isHidden && familySection.childElementCount === 0) {
				renderFamilyTimeline(
					familySection,
					file,
					this.app,
					this.plugin.settings,
					eventService,
					familyGraph,
					{
						maxEvents: 20,
						showEmptyState: false,
						onEventClick: (event) => {
							void this.app.workspace.getLeaf(false).openFile(event.file);
						}
					}
				);
			}
		});
	}

	/**
	 * Render a research coverage badge for a person list item
	 */
	private renderPersonResearchCoverageBadge(
		item: HTMLElement,
		mainRow: HTMLElement,
		file: TFile
	): void {
		const evidenceService = new EvidenceService(this.app, this.plugin.settings);
		const coverage = evidenceService.getFactCoverageForFile(file);

		if (!coverage) return;

		// Determine badge color based on coverage percent
		let badgeClass = 'crc-person-list-badge--coverage';
		if (coverage.coveragePercent >= 75) {
			badgeClass += ' crc-person-list-badge--coverage-good';
		} else if (coverage.coveragePercent >= 50) {
			badgeClass += ' crc-person-list-badge--coverage-warning';
		} else {
			badgeClass += ' crc-person-list-badge--coverage-poor';
		}

		const badge = mainRow.createEl('span', {
			cls: `crc-person-list-badge ${badgeClass}`,
			attr: {
				title: `Research coverage: ${coverage.coveragePercent}% (${coverage.sourcedFactCount}/${coverage.totalFactCount} facts sourced)`
			}
		});
		const bookIcon = createLucideIcon('book-open', 12);
		badge.appendChild(bookIcon);
		badge.appendText(`${coverage.coveragePercent}%`);

		// Create expandable details section
		const detailsSection = item.createDiv({ cls: 'crc-person-list-details crc-person-list-details--hidden crc-research-coverage-details' });

		// Toggle on badge click
		badge.addEventListener('click', (e) => {
			e.stopPropagation();
			detailsSection.toggleClass('crc-person-list-details--hidden', !detailsSection.hasClass('crc-person-list-details--hidden'));
			badge.toggleClass('crc-person-list-badge--active', !badge.hasClass('crc-person-list-badge--active'));
		});

		// Render fact coverage details
		this.renderFactCoverageDetails(detailsSection, coverage);
	}

	/**
	 * Render fact coverage details in an expandable section
	 */
	private renderFactCoverageDetails(container: HTMLElement, coverage: PersonResearchCoverage): void {
		// Summary header
		const header = container.createDiv({ cls: 'crc-coverage-header' });
		header.createSpan({
			text: `Research coverage: ${coverage.coveragePercent}%`,
			cls: 'crc-coverage-title'
		});

		// Progress bar
		const progressContainer = header.createDiv({ cls: 'crc-progress-bar crc-progress-bar--inline' });
		const progressFill = progressContainer.createDiv({ cls: 'crc-progress-bar__fill' });
		progressFill.style.setProperty('width', `${coverage.coveragePercent}%`);
		if (coverage.coveragePercent < 50) {
			progressFill.addClass('crc-progress-bar__fill--danger');
		} else if (coverage.coveragePercent < 75) {
			progressFill.addClass('crc-progress-bar__fill--warning');
		}

		// Quality summary (count facts by quality level)
		const qualityCounts = this.calculateQualityCounts(coverage);
		if (qualityCounts.total > 0) {
			const qualitySummary = container.createDiv({ cls: 'crc-quality-summary' });

			if (qualityCounts.primary > 0) {
				const item = qualitySummary.createDiv({ cls: 'crc-quality-summary-item' });
				item.createSpan({ cls: 'crc-quality-dot crc-quality-dot--primary' });
				item.createSpan({ cls: 'crc-quality-summary-count', text: String(qualityCounts.primary) });
				item.createSpan({ text: 'primary', cls: 'crc-text--muted' });
			}

			if (qualityCounts.secondary > 0) {
				const item = qualitySummary.createDiv({ cls: 'crc-quality-summary-item' });
				item.createSpan({ cls: 'crc-quality-dot crc-quality-dot--secondary' });
				item.createSpan({ cls: 'crc-quality-summary-count', text: String(qualityCounts.secondary) });
				item.createSpan({ text: 'secondary', cls: 'crc-text--muted' });
			}

			if (qualityCounts.derivative > 0) {
				const item = qualitySummary.createDiv({ cls: 'crc-quality-summary-item' });
				item.createSpan({ cls: 'crc-quality-dot crc-quality-dot--derivative' });
				item.createSpan({ cls: 'crc-quality-summary-count', text: String(qualityCounts.derivative) });
				item.createSpan({ text: 'derivative', cls: 'crc-text--muted' });
			}

			if (qualityCounts.unsourced > 0) {
				const item = qualitySummary.createDiv({ cls: 'crc-quality-summary-item' });
				item.createSpan({ cls: 'crc-quality-dot', attr: { style: 'background: var(--text-faint)' } });
				item.createSpan({ cls: 'crc-quality-summary-count', text: String(qualityCounts.unsourced) });
				item.createSpan({ text: 'unsourced', cls: 'crc-text--muted' });
			}
		}

		// Fact list
		const factList = container.createDiv({ cls: 'crc-coverage-fact-list' });

		for (const fact of coverage.facts) {
			const factRow = factList.createDiv({ cls: 'crc-coverage-fact-row' });

			// Status icon
			const statusIcon = factRow.createSpan({ cls: `crc-coverage-status crc-coverage-status--${fact.status}` });
			const iconName = this.getFactStatusIcon(fact.status);
			setIcon(statusIcon, iconName);

			// Fact label
			factRow.createSpan({
				text: FACT_KEY_LABELS[fact.factKey],
				cls: 'crc-coverage-fact-label'
			});

			// Source count and quality badge
			if (fact.sourceCount > 0) {
				const sourceInfo = factRow.createSpan({ cls: 'crc-coverage-source-info' });
				sourceInfo.textContent = `${fact.sourceCount} source${fact.sourceCount !== 1 ? 's' : ''}`;

				// Quality badge (color-coded)
				if (fact.bestQuality) {
					const qualityBadge = factRow.createSpan({
						cls: `crc-quality-badge crc-quality-badge--${fact.bestQuality}`,
						attr: { 'aria-label': SOURCE_QUALITY_LABELS[fact.bestQuality].description }
					});
					qualityBadge.textContent = SOURCE_QUALITY_LABELS[fact.bestQuality].label;
				}
			}

			// Add source button for each fact
			const addBtn = factRow.createEl('button', {
				cls: 'crc-icon-button crc-icon-button--small crc-coverage-add-btn',
				attr: { 'aria-label': `Add source for ${FACT_KEY_LABELS[fact.factKey]}` }
			});
			setIcon(addBtn, 'plus');
			addBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.addSourceCitationForFact(coverage.filePath, fact.factKey);
			});
		}

		// Proof Summaries section
		this.renderProofSummariesSection(container, coverage);
	}

	/**
	 * Render proof summaries section for a person
	 */
	private renderProofSummariesSection(container: HTMLElement, coverage: PersonResearchCoverage): void {
		const proofService = new ProofSummaryService(this.app, this.plugin.settings);
		const proofs = proofService.getProofsForPerson(coverage.personCrId);

		// Section container
		const section = container.createDiv({ cls: 'crc-proof-section' });

		// Header with "Create proof" button
		const sectionHeader = section.createDiv({ cls: 'crc-proof-section-header' });
		const headerTitle = sectionHeader.createSpan({ cls: 'crc-proof-section-title' });
		const scaleIcon = createLucideIcon('scale', 14);
		headerTitle.appendChild(scaleIcon);
		headerTitle.appendText(`Proof summaries (${proofs.length})`);

		const headerActions = sectionHeader.createDiv({ cls: 'crc-proof-section-actions' });

		const createBtn = headerActions.createEl('button', {
			cls: 'crc-btn crc-btn--small',
			text: 'New proof'
		});
		createBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			new CreateProofModal(this.app, this.plugin, {
				subjectPerson: `[[${coverage.personName}]]`,
				onSuccess: () => {
					// Refresh the view
					this.showPeopleTab();
				}
			}).open();
		});

		const templateBtn = headerActions.createEl('button', {
			cls: 'crc-btn crc-btn--small crc-btn--icon',
			attr: { 'aria-label': 'View proof templates' }
		});
		const templateIcon = createLucideIcon('file-code', 14);
		templateBtn.appendChild(templateIcon);
		templateBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			new TemplateSnippetsModal(this.app, 'proof', this.plugin.settings.propertyAliases).open();
		});

		// Proof list
		if (proofs.length === 0) {
			section.createDiv({
				cls: 'crc-proof-list-empty',
				text: 'No proof summaries yet. Create one to document your research reasoning.'
			});
		} else {
			const proofList = section.createDiv({ cls: 'crc-proof-list' });

			for (const proof of proofs) {
				this.renderProofCard(proofList, proof, () => this.showPeopleTab());
			}
		}
	}

	/**
	 * Render a single proof summary card
	 */
	private renderProofCard(container: HTMLElement, proof: ProofSummaryNote, onRefresh?: () => void): void {
		const card = container.createDiv({ cls: `crc-proof-card crc-proof-card--${proof.confidence}` });

		// Header row
		const header = card.createDiv({ cls: 'crc-proof-card-header' });

		const title = header.createSpan({ cls: 'crc-proof-card-title', text: proof.title });
		title.addEventListener('click', () => {
			void this.app.workspace.openLinkText(proof.filePath, '', true);
		});

		// Actions (edit/delete)
		const actions = header.createDiv({ cls: 'crc-proof-card-actions' });

		// Edit button
		const editBtn = actions.createEl('button', {
			cls: 'crc-btn crc-btn--icon',
			attr: { 'aria-label': 'Edit proof summary' }
		});
		const editIcon = createLucideIcon('edit', 14);
		editBtn.appendChild(editIcon);
		editBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			const file = this.app.vault.getAbstractFileByPath(proof.filePath);
			if (file instanceof TFile) {
				new CreateProofModal(this.app, this.plugin, {
					editProof: proof,
					editFile: file,
					onUpdated: () => {
						if (onRefresh) onRefresh();
					}
				}).open();
			}
		});

		// Delete button
		const deleteBtn = actions.createEl('button', {
			cls: 'crc-btn crc-btn--icon crc-btn--danger',
			attr: { 'aria-label': 'Delete proof summary' }
		});
		const deleteIcon = createLucideIcon('trash', 14);
		deleteBtn.appendChild(deleteIcon);
		deleteBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			void this.deleteProofSummary(proof, onRefresh);
		});

		// Badges
		const badges = header.createDiv({ cls: 'crc-proof-card-badges' });

		// Status badge
		const statusBadge = badges.createSpan({
			cls: `crc-proof-badge crc-proof-badge--status crc-proof-badge--${proof.status}`,
			text: PROOF_STATUS_LABELS[proof.status].label
		});
		statusBadge.setAttribute('title', PROOF_STATUS_LABELS[proof.status].description);

		// Confidence badge
		const confidenceBadge = badges.createSpan({
			cls: 'crc-proof-badge crc-proof-badge--confidence',
			text: PROOF_CONFIDENCE_LABELS[proof.confidence].label
		});
		confidenceBadge.setAttribute('title', PROOF_CONFIDENCE_LABELS[proof.confidence].description);

		// Conclusion (truncated)
		if (proof.conclusion) {
			const maxLen = 100;
			const conclusionText = proof.conclusion.length > maxLen
				? proof.conclusion.substring(0, maxLen) + '...'
				: proof.conclusion;

			card.createDiv({ cls: 'crc-proof-card-conclusion', text: conclusionText });
		}

		// Meta info
		const meta = card.createDiv({ cls: 'crc-proof-card-meta' });

		// Fact type
		const factItem = meta.createSpan({ cls: 'crc-proof-card-meta-item' });
		const tagIcon = createLucideIcon('hash', 12);
		factItem.appendChild(tagIcon);
		factItem.appendText(FACT_KEY_LABELS[proof.factType]);

		// Evidence count
		const evidenceItem = meta.createSpan({ cls: 'crc-proof-card-meta-item' });
		const archiveIcon = createLucideIcon('archive', 12);
		evidenceItem.appendChild(archiveIcon);
		evidenceItem.appendText(`${proof.evidence.length} source${proof.evidence.length !== 1 ? 's' : ''}`);

		// Date if available
		if (proof.dateWritten) {
			const dateItem = meta.createSpan({ cls: 'crc-proof-card-meta-item' });
			const calendarIcon = createLucideIcon('calendar', 12);
			dateItem.appendChild(calendarIcon);
			dateItem.appendText(proof.dateWritten);
		}
	}

	/**
	 * Delete a proof summary with confirmation
	 */
	private deleteProofSummary(proof: ProofSummaryNote, onRefresh?: () => void): void {
		const file = this.app.vault.getAbstractFileByPath(proof.filePath);
		if (!(file instanceof TFile)) {
			new Notice('Proof summary file not found.');
			return;
		}

		// Confirmation modal
		const confirmModal = new Modal(this.app);
		confirmModal.titleEl.setText('Delete proof summary');

		const content = confirmModal.contentEl;
		content.createEl('p', {
			text: `Are you sure you want to delete "${proof.title}"?`
		});
		content.createEl('p', {
			text: 'The file will be moved to trash.',
			cls: 'mod-warning'
		});

		const buttonContainer = content.createDiv({ cls: 'crc-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => confirmModal.close());

		const deleteBtn = buttonContainer.createEl('button', {
			text: 'Delete',
			cls: 'crc-btn crc-btn--danger'
		});
		deleteBtn.addEventListener('click', () => {
			void (async () => {
				try {
					await this.app.fileManager.trashFile(file);
					new Notice(`Deleted proof summary: ${proof.title}`);
					confirmModal.close();
					if (onRefresh) onRefresh();
				} catch (error) {
					console.error('Failed to delete proof summary:', error);
					new Notice('Failed to delete proof summary.');
				}
			})();
		});

		confirmModal.open();
	}

	/**
	 * Get the icon name for a fact coverage status
	 */
	private getFactStatusIcon(status: FactCoverageStatus): string {
		switch (status) {
			case 'well-sourced':
				return 'check-circle-2';
			case 'sourced':
				return 'check-circle';
			case 'weakly-sourced':
				return 'alert-circle';
			case 'unsourced':
				return 'circle';
			default:
				return 'circle';
		}
	}

	/**
	 * Calculate counts of facts by source quality level
	 */
	private calculateQualityCounts(coverage: PersonResearchCoverage): {
		primary: number;
		secondary: number;
		derivative: number;
		unsourced: number;
		total: number;
	} {
		const counts = { primary: 0, secondary: 0, derivative: 0, unsourced: 0, total: 0 };

		for (const fact of coverage.facts) {
			if (fact.status === 'unsourced') {
				counts.unsourced++;
			} else if (fact.bestQuality === 'primary') {
				counts.primary++;
			} else if (fact.bestQuality === 'secondary') {
				counts.secondary++;
			} else if (fact.bestQuality === 'derivative') {
				counts.derivative++;
			} else {
				// Has sources but no quality determined - count as secondary
				counts.secondary++;
			}
			counts.total++;
		}

		return counts;
	}

	/**
	 * Add a source citation to a specific fact on a person note
	 */
	private addSourceCitationForFact(personFilePath: string, factKey: FactKey): void {
		const file = this.app.vault.getAbstractFileByPath(personFilePath);
		if (!(file instanceof TFile)) {
			new Notice('Could not find person file');
			return;
		}

		// Open source picker modal
		new SourcePickerModal(this.app, this.plugin, async (source) => {
			// Create wikilink from source file path
			const sourceFileName = source.filePath.split('/').pop()?.replace('.md', '') || source.title;
			const wikilink = `[[${sourceFileName}]]`;

			// Update the person's sourced_facts frontmatter
			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				// Initialize sourced_facts if it doesn't exist
				if (!frontmatter.sourced_facts) {
					frontmatter.sourced_facts = {};
				}

				const sourcedFacts = frontmatter.sourced_facts as SourcedFacts;

				// Initialize the fact entry if it doesn't exist
				if (!sourcedFacts[factKey]) {
					sourcedFacts[factKey] = { sources: [] };
				}

				// Add the source if not already present
				// TypeScript doesn't narrow index signatures, so we use non-null assertion
				const sources = sourcedFacts[factKey]!.sources;
				if (!sources.includes(wikilink)) {
					sources.push(wikilink);
					new Notice(`Added "${source.title}" as source for ${FACT_KEY_LABELS[factKey]}`);
				} else {
					new Notice(`"${source.title}" is already linked to ${FACT_KEY_LABELS[factKey]}`);
				}
			});

			// Refresh the people tab to show updated coverage
			this.showPeopleTab();
		}).open();
	}

	/**
	 * Create a person note
	 */
	private async createPersonNote(
		name: string,
		birthDate: string,
		deathDate: string,
		autoGenUuid: boolean,
		manualUuid: string,
		fatherCrId: string | undefined,
		motherCrId: string | undefined,
		spouseCrId: string | undefined,
		openNote: boolean
	): Promise<void> {
		// Validate required fields
		if (!name || name.trim() === '') {
			new Notice('⚠️ Name is required');
			return;
		}

		// Validate manual UUID if provided
		if (!autoGenUuid && manualUuid) {
			const { validateCrId } = await import('../core/uuid');
			if (!validateCrId(manualUuid)) {
				new Notice('⚠️ Invalid cr_id format. Expected: abc-123-def-456');
				return;
			}
		}

		// Build person data with dual storage (names + cr_ids)
		const personData: PersonData = {
			name: name.trim(),
			crId: autoGenUuid ? undefined : manualUuid || undefined,
			birthDate: birthDate || undefined,
			deathDate: deathDate || undefined,
			fatherCrId: fatherCrId || undefined,
			fatherName: this.fatherField.name || undefined,
			motherCrId: motherCrId || undefined,
			motherName: this.motherField.name || undefined,
			spouseCrId: spouseCrId ? [spouseCrId] : undefined,
			spouseName: this.spouseField.name ? [this.spouseField.name] : undefined
		};

		// Debug logging
		logger.info('create-person', `Creating person note - name: ${personData.name}, crId: ${personData.crId}, birthDate: ${personData.birthDate}, deathDate: ${personData.deathDate}, fatherCrId: ${personData.fatherCrId}, motherCrId: ${personData.motherCrId}, spouseCrId: ${JSON.stringify(personData.spouseCrId)}`);

		try {
			// Create the note
			const file = await createPersonNote(this.app, personData, {
				directory: this.plugin.settings.peopleFolder || '',
				openAfterCreate: openNote
			});

			// Sync bidirectional relationships if enabled
			if (this.plugin.settings.enableBidirectionalSync) {
				const bidirectionalLinker = new BidirectionalLinker(this.app);
				await bidirectionalLinker.syncRelationships(file);
			}

			// Show success message
			new Notice(`✅ Created person note: ${file.basename}`);

			// Close modal if opening the note
			if (openNote) {
				this.close();
			}
		} catch (error: unknown) {
			console.error('Failed to create person note:', error);
			new Notice(`❌ Failed to create person note: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Show Tree Output tab - Two-Panel Layout
	 *
	 * Left panel: Scrollable configuration with collapsible accordions
	 * Right panel: Sticky preview area + generate section
	 */
	private showTreeGenerationTab(): void {
		const container = this.contentContainer;

		// Title
		container.createEl('h2', { text: 'Tree output', cls: 'cr-card-title--no-margin' });

		// Intro text
		container.createEl('p', {
			text: 'Generate visual family trees and export to various formats.',
			cls: 'crc-text-muted'
		});

		// Root Person Field (shared state)
		const rootPersonField: RelationshipField = { name: '' };

		// Check if we have a pending root person to pre-populate
		if (this.pendingRootPerson) {
			rootPersonField.name = this.pendingRootPerson.name;
			rootPersonField.crId = this.pendingRootPerson.crId;
			rootPersonField.birthDate = this.pendingRootPerson.birthDate;
			rootPersonField.deathDate = this.pendingRootPerson.deathDate;
			this.pendingRootPerson = undefined;
		}

		// =====================================================================
		// TWO-PANEL CONTAINER
		// =====================================================================
		const twoPanelContainer = container.createDiv({ cls: 'crc-tree-output-container' });

		// =====================================================================
		// LEFT PANEL - Scrollable Configuration
		// =====================================================================
		const leftPanel = twoPanelContainer.createDiv({ cls: 'crc-tree-output-left' });

		// ----- Section 1: Root Person (expanded by default) -----
		const rootPersonSection = this.createAccordionSection(
			leftPanel,
			'Root person',
			'user',
			true
		);
		this.buildRootPersonAccordionContent(rootPersonSection.content, rootPersonField);

		// ----- Section 2: Tree Scope (expanded by default) -----
		// Need to declare all config variables at this scope for later access
		let typeSelect: HTMLSelectElement;
		let genSlider: HTMLInputElement;
		let spouseToggle: ToggleComponent;
		let stepParentToggle: ToggleComponent;
		let adoptiveParentToggle: ToggleComponent;
		let collectionSelect: HTMLSelectElement;
		let placeFilterInput: HTMLInputElement;
		const placeFilterTypes: Set<'birth' | 'death' | 'marriage' | 'burial'> = new Set(['birth', 'death']);

		const treeScopeSection = this.createAccordionSection(
			leftPanel,
			'Tree scope',
			'git-branch',
			true
		);
		const treeScopeContent = treeScopeSection.content;

		// Tree type selection
		new Setting(treeScopeContent)
			.setName('Tree type')
			.setDesc('Choose which relatives to include in the tree')
			.addDropdown(dropdown => {
				typeSelect = dropdown.selectEl;
				dropdown
					.addOption('full', 'Full family tree (ancestors + descendants)')
					.addOption('ancestors', 'Ancestors only (parents, grandparents, etc.)')
					.addOption('descendants', 'Descendants only (children, grandchildren, etc.)')
					.setValue('full');
			});

		// Max generations
		new Setting(treeScopeContent)
			.setName('Maximum generations')
			.setDesc('Limit the depth of the tree. Set to 0 for unlimited (use with caution on large trees)')
			.addSlider(slider => {
				genSlider = slider.sliderEl;
				slider
					.setLimits(0, 10, 1)
					.setValue(5)
					.setDynamicTooltip()
					.onChange((value) => {
						// Update the display to show "Unlimited" for 0
						slider.showTooltip();
					});
			});

		// Include spouses toggle
		new Setting(treeScopeContent)
			.setName('Include spouses in tree')
			.addToggle(toggle => {
				spouseToggle = toggle;
				toggle.setValue(true);
			});

		// Include step-parents toggle
		new Setting(treeScopeContent)
			.setName('Include step-parents')
			.setDesc('Show step-parent relationships with dashed lines')
			.addToggle(toggle => {
				stepParentToggle = toggle;
				toggle.setValue(false);
			});

		// Include adoptive parents toggle
		new Setting(treeScopeContent)
			.setName('Include adoptive parents')
			.setDesc('Show adoptive parent relationships with dotted lines')
			.addToggle(toggle => {
				adoptiveParentToggle = toggle;
				toggle.setValue(false);
			});

		// Collection filter dropdown
		const graphService = this.plugin.createFamilyGraphService();
		const userCollections = graphService.getUserCollections();

		new Setting(treeScopeContent)
			.setName('Filter by collection')
			.setDesc('Limit tree to people in a specific collection (optional)')
			.addDropdown(dropdown => {
				collectionSelect = dropdown.selectEl;
				dropdown.addOption('', 'All collections (no filter)');
				userCollections.forEach(collection => {
					dropdown.addOption(collection.name, collection.name);
				});
			});

		// Place filter input and type selection
		new Setting(treeScopeContent)
			.setName('Filter by place')
			.setDesc('Limit tree to people associated with a specific place (optional)')
			.addText(text => {
				placeFilterInput = text.inputEl;
				text.setPlaceholder('e.g., London, England');
			});

		// Place filter type checkboxes
		const placeTypesSetting = new Setting(treeScopeContent)
			.setName('Place filter types')
			.setDesc('Which place fields to check when filtering');

		const placeTypesContainer = placeTypesSetting.controlEl.createDiv({ cls: 'crc-place-filter-types' });

		const placeTypes: Array<{ value: 'birth' | 'death' | 'marriage' | 'burial'; label: string }> = [
			{ value: 'birth', label: 'Birth' },
			{ value: 'death', label: 'Death' },
			{ value: 'marriage', label: 'Marriage' },
			{ value: 'burial', label: 'Burial' }
		];

		for (const type of placeTypes) {
			const label = placeTypesContainer.createEl('label', { cls: 'crc-place-filter-type' });
			const checkbox = label.createEl('input', { type: 'checkbox' });
			checkbox.checked = placeFilterTypes.has(type.value);
			checkbox.addEventListener('change', () => {
				if (checkbox.checked) {
					placeFilterTypes.add(type.value);
				} else {
					placeFilterTypes.delete(type.value);
				}
			});
			label.appendText(type.label);
		}

		// ----- Section 3: Layout Options (collapsed by default) -----
		let dirSelect: HTMLSelectElement;
		let layoutTypeSelect: HTMLSelectElement;
		let spacingXInput: HTMLInputElement;
		let spacingYInput: HTMLInputElement;

		const layoutSection = this.createAccordionSection(
			leftPanel,
			'Layout options',
			'layout',
			false
		);
		const layoutContent = layoutSection.content;

		// Direction selection
		new Setting(layoutContent)
			.setName('Tree direction')
			.addDropdown(dropdown => {
				dirSelect = dropdown.selectEl;
				dropdown
					.addOption('vertical', 'Vertical (top to bottom)')
					.addOption('horizontal', 'Horizontal (left to right)');
			});

		// Layout type selection
		new Setting(layoutContent)
			.setName('Layout algorithm')
			.setDesc('Choose the layout style for your tree')
			.addDropdown(dropdown => {
				layoutTypeSelect = dropdown.selectEl;
				dropdown
					.addOption('standard', 'Standard (default spacing)')
					.addOption('compact', 'Compact (50% tighter for large trees)')
					.addOption('timeline', 'Timeline (chronological by birth year)')
					.addOption('hourglass', 'Hourglass (ancestors above, descendants below)')
					.setValue(this.plugin.settings.defaultLayoutType);
			});

		// Horizontal spacing
		new Setting(layoutContent)
			.setName('Horizontal spacing')
			.setDesc('Space between nodes horizontally (pixels). Default: 400')
			.addText(text => {
				spacingXInput = text.inputEl;
				text.inputEl.type = 'number';
				text.inputEl.min = '100';
				text.inputEl.max = '1000';
				text.inputEl.step = '50';
				text.setValue('300');
			});

		// Vertical spacing
		new Setting(layoutContent)
			.setName('Vertical spacing')
			.setDesc('Space between nodes vertically (pixels). Default: 200')
			.addText(text => {
				spacingYInput = text.inputEl;
				text.inputEl.type = 'number';
				text.inputEl.min = '100';
				text.inputEl.max = '1000';
				text.inputEl.step = '50';
				text.setValue('200');
			});

		// ----- Section 4: Style Customization (collapsed by default) -----
		let useCustomNodeColor = false;
		let useCustomParentChildArrow = false;
		let useCustomSpouseArrow = false;
		let useCustomParentChildColor = false;
		let useCustomSpouseColor = false;
		let useCustomSpouseEdges = false;
		let useCustomSpouseLabels = false;

		let customNodeColorSelect: HTMLSelectElement;
		let customParentChildArrowSelect: HTMLSelectElement;
		let customSpouseArrowSelect: HTMLSelectElement;
		let customParentChildColorSelect: HTMLSelectElement;
		let customSpouseColorSelect: HTMLSelectElement;
		let customSpouseEdgesToggle: ToggleComponent;
		let customSpouseLabelsSelect: HTMLSelectElement;

		const styleSection = this.createAccordionSection(
			leftPanel,
			'Style customization',
			'sliders',
			false
		);
		const styleContent = styleSection.content;

		styleContent.createEl('p', {
			text: 'Override global style settings for this canvas only. Leave options unchecked to use global settings.',
			cls: 'setting-item-description crc-mb-2'
		});

		// Node color scheme override
		new Setting(styleContent)
			.setName('Node coloring')
			.addToggle(toggle => {
				toggle.setValue(false).onChange(value => {
					useCustomNodeColor = value;
					customNodeColorSelect.disabled = !value;
				});
			})
			.addDropdown(dropdown => {
				customNodeColorSelect = dropdown.selectEl;
				dropdown
					.addOption('sex', 'Sex (green/purple)')
					.addOption('generation', 'Generation (gradient)')
					.addOption('collection', 'Collection (multi-color)')
					.addOption('monochrome', 'Monochrome (neutral)')
					.setValue(this.plugin.settings.nodeColorScheme);
				customNodeColorSelect.disabled = true;
			});

		// Parent-child arrow style override
		new Setting(styleContent)
			.setName('Parent-child arrows')
			.addToggle(toggle => {
				toggle.setValue(false).onChange(value => {
					useCustomParentChildArrow = value;
					customParentChildArrowSelect.disabled = !value;
				});
			})
			.addDropdown(dropdown => {
				customParentChildArrowSelect = dropdown.selectEl;
				dropdown
					.addOption('directed', 'Directed (→)')
					.addOption('bidirectional', 'Bidirectional (↔)')
					.addOption('undirected', 'Undirected (—)')
					.setValue(this.plugin.settings.parentChildArrowStyle);
				customParentChildArrowSelect.disabled = true;
			});

		// Spouse arrow style override
		new Setting(styleContent)
			.setName('Spouse arrows')
			.addToggle(toggle => {
				toggle.setValue(false).onChange(value => {
					useCustomSpouseArrow = value;
					customSpouseArrowSelect.disabled = !value;
				});
			})
			.addDropdown(dropdown => {
				customSpouseArrowSelect = dropdown.selectEl;
				dropdown
					.addOption('directed', 'Directed (→)')
					.addOption('bidirectional', 'Bidirectional (↔)')
					.addOption('undirected', 'Undirected (—)')
					.setValue(this.plugin.settings.spouseArrowStyle);
				customSpouseArrowSelect.disabled = true;
			});

		// Parent-child edge color override
		new Setting(styleContent)
			.setName('Parent-child edge color')
			.addToggle(toggle => {
				toggle.setValue(false).onChange(value => {
					useCustomParentChildColor = value;
					customParentChildColorSelect.disabled = !value;
				});
			})
			.addDropdown(dropdown => {
				customParentChildColorSelect = dropdown.selectEl;
				dropdown
					.addOption('none', 'Theme default')
					.addOption('1', 'Red')
					.addOption('2', 'Orange')
					.addOption('3', 'Yellow')
					.addOption('4', 'Green')
					.addOption('5', 'Cyan')
					.addOption('6', 'Purple')
					.setValue(this.plugin.settings.parentChildEdgeColor);
				customParentChildColorSelect.disabled = true;
			});

		// Spouse edge color override
		new Setting(styleContent)
			.setName('Spouse edge color')
			.addToggle(toggle => {
				toggle.setValue(false).onChange(value => {
					useCustomSpouseColor = value;
					customSpouseColorSelect.disabled = !value;
				});
			})
			.addDropdown(dropdown => {
				customSpouseColorSelect = dropdown.selectEl;
				dropdown
					.addOption('none', 'Theme default')
					.addOption('1', 'Red')
					.addOption('2', 'Orange')
					.addOption('3', 'Yellow')
					.addOption('4', 'Green')
					.addOption('5', 'Cyan')
					.addOption('6', 'Purple')
					.setValue(this.plugin.settings.spouseEdgeColor);
				customSpouseColorSelect.disabled = true;
			});

		// Show spouse edges override
		new Setting(styleContent)
			.setName('Show spouse edges')
			.setDesc('Enable/disable marriage relationship edges')
			.addToggle(toggle => {
				toggle.setValue(false).onChange(value => {
					useCustomSpouseEdges = value;
					(customSpouseEdgesToggle.toggleEl as HTMLInputElement).disabled = !value;
				});
			})
			.addToggle(toggle => {
				customSpouseEdgesToggle = toggle;
				toggle.setValue(this.plugin.settings.showSpouseEdges);
				(toggle.toggleEl as HTMLInputElement).disabled = true;
			});

		// Spouse label format override
		new Setting(styleContent)
			.setName('Spouse edge labels')
			.addToggle(toggle => {
				toggle.setValue(false).onChange(value => {
					useCustomSpouseLabels = value;
					customSpouseLabelsSelect.disabled = !value;
				});
			})
			.addDropdown(dropdown => {
				customSpouseLabelsSelect = dropdown.selectEl;
				dropdown
					.addOption('none', 'None')
					.addOption('date-only', 'Date only')
					.addOption('date-location', 'Date + location')
					.addOption('full', 'Full (date + location + status)')
					.setValue(this.plugin.settings.spouseEdgeLabelFormat);
				customSpouseLabelsSelect.disabled = true;
			});

		// ----- Section 5: Recent Trees (collapsed by default) -----
		const recentTrees = this.plugin.settings.recentTrees?.slice(0, 5) || [];
		if (recentTrees.length > 0) {
			const recentSection = this.createAccordionSection(
				leftPanel,
				'Recent trees',
				'clock',
				false,
				`${recentTrees.length}`
			);
			const recentContent = recentSection.content;

			recentTrees.forEach((tree, index) => {
				const treeBtn = recentContent.createEl('button', {
					cls: `crc-btn crc-btn--secondary crc-btn--block ${index > 0 ? 'crc-mt-2' : ''}`,
					text: tree.canvasName.replace('.canvas', '')
				});
				const treeIcon = createLucideIcon('file', 16);
				treeBtn.prepend(treeIcon);
				treeBtn.createSpan({
					cls: 'crc-badge crc-ml-2',
					text: `${tree.peopleCount} people`
				});

				treeBtn.addEventListener('click', () => {
					void (async () => {
						const file = this.app.vault.getAbstractFileByPath(tree.canvasPath);
						if (file instanceof TFile) {
							const leaf = this.app.workspace.getLeaf(false);
							await leaf.openFile(file);
							this.close();
						} else {
							new Notice(`Canvas file not found: ${tree.canvasPath}`);
						}
					})();
				});
			});
		}

		// =====================================================================
		// RIGHT PANEL - Sticky Preview + Generate
		// =====================================================================
		const rightPanel = twoPanelContainer.createDiv({ cls: 'crc-tree-output-right' });

		// ----- Preview Panel -----
		const previewPanel = rightPanel.createDiv({ cls: 'crc-tree-preview-panel' });

		// Preview container (SVG will go here)
		this.treePreviewContainer = previewPanel.createDiv({
			cls: 'crc-tree-preview-container'
		});

		// Initialize preview renderer
		this.treePreviewRenderer = new TreePreviewRenderer(this.treePreviewContainer);
		this.treePreviewRenderer.setColorScheme(this.plugin.settings.nodeColorScheme);

		// Preview controls bar
		const previewControlsRow = previewPanel.createDiv({ cls: 'crc-preview-controls-panel' });

		// Generate preview button
		const generatePreviewBtn = previewControlsRow.createEl('button', {
			text: 'Generate preview',
			cls: 'mod-cta'
		});

		// Zoom controls
		const zoomControls = previewControlsRow.createDiv({ cls: 'crc-preview-zoom-controls' });
		const zoomOutBtn = zoomControls.createEl('button', {
			text: '−',
			cls: 'crc-preview-zoom-btn',
			attr: { 'aria-label': 'Zoom out' }
		});
		const resetViewBtn = zoomControls.createEl('button', {
			text: 'Reset',
			cls: 'crc-preview-zoom-btn',
			attr: { 'aria-label': 'Reset view' }
		});
		const zoomInBtn = zoomControls.createEl('button', {
			text: '+',
			cls: 'crc-preview-zoom-btn',
			attr: { 'aria-label': 'Zoom in' }
		});

		// Label toggle
		const labelToggle = previewControlsRow.createDiv({ cls: 'crc-preview-label-toggle' });
		const labelCheckbox = labelToggle.createEl('input', {
			type: 'checkbox',
			cls: 'crc-preview-checkbox',
			attr: { id: 'preview-labels-toggle' }
		});
		labelCheckbox.checked = true;
		labelToggle.createEl('label', {
			text: 'Show labels',
			attr: { for: 'preview-labels-toggle' }
		});

		// Color scheme selector
		const colorSchemeControl = previewControlsRow.createDiv({ cls: 'crc-preview-color-scheme' });
		colorSchemeControl.createEl('label', {
			text: 'Color scheme:',
			cls: 'crc-preview-color-scheme-label'
		});
		const colorSchemeSelect = colorSchemeControl.createEl('select', {
			cls: 'crc-preview-color-scheme-select dropdown'
		});

		// Add color scheme options
		const colorSchemes = [
			{ value: 'sex', label: 'Sex' },
			{ value: 'generation', label: 'Generation' },
			{ value: 'monochrome', label: 'Monochrome' }
		];

		for (const scheme of colorSchemes) {
			const option = colorSchemeSelect.createEl('option', {
				text: scheme.label,
				value: scheme.value
			});
			if (scheme.value === this.plugin.settings.nodeColorScheme) {
				option.selected = true;
			}
		}

		// Export button with dropdown
		const exportControl = previewControlsRow.createDiv({ cls: 'crc-preview-export' });
		const exportBtn = exportControl.createEl('button', {
			text: 'Export',
			cls: 'crc-preview-export-btn'
		});

		// Create dropdown menu (hidden by default)
		const exportDropdown = exportControl.createDiv({ cls: 'crc-preview-export-dropdown cr-hidden' });

		const exportPNG = exportDropdown.createEl('div', {
			text: 'Export as PNG',
			cls: 'crc-preview-export-option'
		});

		const exportSVG = exportDropdown.createEl('div', {
			text: 'Export as SVG',
			cls: 'crc-preview-export-option'
		});

		const exportPDF = exportDropdown.createEl('div', {
			text: 'Export as PDF',
			cls: 'crc-preview-export-option'
		});

		// Toggle dropdown on button click
		exportBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			exportDropdown.toggleClass('cr-hidden', !exportDropdown.hasClass('cr-hidden'));
		});

		// Close dropdown when clicking outside
		document.addEventListener('click', () => {
			exportDropdown.addClass('cr-hidden');
		});

		// Wire up zoom controls
		zoomInBtn.addEventListener('click', () => {
			this.treePreviewRenderer?.zoomIn();
		});

		zoomOutBtn.addEventListener('click', () => {
			this.treePreviewRenderer?.zoomOut();
		});

		resetViewBtn.addEventListener('click', () => {
			this.treePreviewRenderer?.resetView();
		});

		// Wire up label toggle
		labelCheckbox.addEventListener('change', () => {
			this.treePreviewRenderer?.toggleLabels(labelCheckbox.checked);
		});

		// Wire up color scheme selector
		colorSchemeSelect.addEventListener('change', () => {
			const scheme = colorSchemeSelect.value as ColorScheme;
			this.treePreviewRenderer?.setColorScheme(scheme);
		});

		// Wire up export options
		exportPNG.addEventListener('click', () => {
			void (async () => {
				try {
					await this.treePreviewRenderer?.exportAsPNG();
					new Notice('Preview exported as PNG');
					exportDropdown.addClass('cr-hidden');
				} catch (err) {
					new Notice('Failed to export preview: ' + (err as Error).message);
				}
			})();
		});

		exportSVG.addEventListener('click', () => {
			try {
				this.treePreviewRenderer?.exportAsSVG();
				new Notice('Preview exported as SVG');
				exportDropdown.addClass('cr-hidden');
			} catch (err) {
				new Notice('Failed to export preview: ' + (err as Error).message);
			}
		});

		exportPDF.addEventListener('click', () => {
			void (async () => {
				try {
					await this.treePreviewRenderer?.exportAsPDF();
					new Notice('Preview exported as PDF');
					exportDropdown.addClass('cr-hidden');
				} catch (err) {
					new Notice('Failed to export preview: ' + (err as Error).message);
				}
			})();
		});

		// Wire up preview button
		generatePreviewBtn.addEventListener('click', () => {
			void (async () => {
				if (!rootPersonField.crId) {
					new Notice('Please select a root person first');
					return;
				}

				try {
					generatePreviewBtn.disabled = true;
					generatePreviewBtn.setText('Generating preview...');

					// Yield to allow button state to render before expensive work
					await new Promise(resolve => setTimeout(resolve, 50));

					// Build family tree
					const graphService = this.plugin.createFamilyGraphService();
					const treeOptions: TreeOptions = {
						rootCrId: rootPersonField.crId,
						treeType: typeSelect.value as 'ancestors' | 'descendants' | 'full',
						maxGenerations: parseInt(genSlider.value) || 0,
						includeSpouses: spouseToggle.getValue(),
						includeStepParents: stepParentToggle.getValue(),
						includeAdoptiveParents: adoptiveParentToggle.getValue(),
						collectionFilter: collectionSelect.value || undefined,
						placeFilter: placeFilterInput.value.trim() ? {
							placeName: placeFilterInput.value.trim(),
							types: Array.from(placeFilterTypes)
						} : undefined
					};

					const familyTree = graphService.generateTree(treeOptions);

					if (!familyTree) {
						new Notice('Failed to build family tree. Root person may not exist.');
						return;
					}

					// Disable preview for large trees - the layout algorithm can freeze
					const PREVIEW_LIMIT = 200;
					const totalNodeCount = familyTree.nodes.size;

					if (totalNodeCount > PREVIEW_LIMIT) {
						new Notice(`Tree has ${totalNodeCount} people - too large for preview. Generate the canvas directly instead.`, 5000);
						return;
					}

					// Build layout options
					// Map tree type values (ancestors/descendants -> ancestor/descendant for layout engine)
					const treeTypeValue: 'ancestor' | 'descendant' | 'full' = typeSelect.value === 'ancestors' ? 'ancestor' :
						typeSelect.value === 'descendants' ? 'descendant' : 'full';

					const layoutOptions = {
						nodeSpacingX: parseInt(spacingXInput.value) || 400,
						nodeSpacingY: parseInt(spacingYInput.value) || 200,
						direction: dirSelect.value as 'vertical' | 'horizontal',
						treeType: treeTypeValue,
						layoutType: layoutTypeSelect.value as import('../settings').LayoutType,
						nodeWidth: this.plugin.settings.defaultNodeWidth,
						nodeHeight: this.plugin.settings.defaultNodeHeight
					};

					// Yield before layout calculation
					await new Promise(resolve => setTimeout(resolve, 0));

					// Render preview
					this.treePreviewRenderer?.renderPreview(familyTree, layoutOptions);

					new Notice(`Preview generated (${totalNodeCount} people)`);
				} catch (error: unknown) {
					console.error('Preview generation failed:', error);
					new Notice('Failed to generate preview. See console for details.');
				} finally {
					generatePreviewBtn.disabled = false;
					generatePreviewBtn.setText('Generate preview');
				}
			})();
		});

		// ----- Generate Panel (in right panel) -----
		const generatePanel = rightPanel.createDiv({ cls: 'crc-tree-generate-panel' });

		// Canvas name input
		generatePanel.createEl('label', {
			cls: 'crc-form-label',
			text: 'Canvas name (optional)'
		});
		const canvasNameInput = generatePanel.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'text',
				placeholder: 'Auto-generated from root person name'
			}
		});
		this.treeCanvasNameInput = canvasNameInput;

		// Generate buttons container
		const generateButtons = generatePanel.createDiv({ cls: 'crc-tree-generate-buttons' });

		// Primary generate button
		const generateBtn = generateButtons.createEl('button', {
			cls: 'mod-cta',
			text: 'Generate family tree'
		});
		this.treeGenerateBtn = generateBtn;

		// Generate all trees button (if multiple family groups)
		const familyComponents = graphService.findAllFamilyComponents();
		if (familyComponents.length > 1) {
			const allTreesBtn = generateButtons.createEl('button', {
				cls: 'crc-btn crc-btn--secondary',
				text: `Generate all trees (${familyComponents.length} groups)`
			});
			allTreesBtn.addEventListener('click', () => {
				void (async () => {
					await this.openAndGenerateAllTrees();
				})();
			});
		}

		// Wire up the Generate button
		this.treeGenerateBtn?.addEventListener('click', () => {
			void (async () => {
				// Build style overrides object (only include enabled overrides)
				const styleOverrides: import('../core/canvas-style-overrides').StyleOverrides = {};
				if (useCustomNodeColor) {
					styleOverrides.nodeColorScheme = customNodeColorSelect.value as import('../settings').ColorScheme;
				}
				if (useCustomParentChildArrow) {
					styleOverrides.parentChildArrowStyle = customParentChildArrowSelect.value as import('../settings').ArrowStyle;
				}
				if (useCustomSpouseArrow) {
					styleOverrides.spouseArrowStyle = customSpouseArrowSelect.value as import('../settings').ArrowStyle;
				}
				if (useCustomParentChildColor) {
					styleOverrides.parentChildEdgeColor = customParentChildColorSelect.value as import('../settings').CanvasColor;
				}
				if (useCustomSpouseColor) {
					styleOverrides.spouseEdgeColor = customSpouseColorSelect.value as import('../settings').CanvasColor;
				}
				if (useCustomSpouseEdges) {
					styleOverrides.showSpouseEdges = customSpouseEdgesToggle.getValue();
				}
				if (useCustomSpouseLabels) {
					styleOverrides.spouseEdgeLabelFormat = customSpouseLabelsSelect.value as import('../settings').SpouseEdgeLabelFormat;
				}

				await this.handleTreeGeneration(
					rootPersonField,
					typeSelect.value as 'ancestors' | 'descendants' | 'full',
					parseInt(genSlider.value) || 0,
					spouseToggle.getValue(),
					stepParentToggle.getValue(),
					adoptiveParentToggle.getValue(),
					dirSelect.value as 'vertical' | 'horizontal',
					parseInt(spacingXInput.value),
					parseInt(spacingYInput.value),
					layoutTypeSelect.value as import('../settings').LayoutType,
					this.treeCanvasNameInput?.value || '',
					collectionSelect.value || undefined,
					placeFilterInput.value.trim() ? {
						placeName: placeFilterInput.value.trim(),
						types: Array.from(placeFilterTypes)
					} : undefined,
					Object.keys(styleOverrides).length > 0 ? styleOverrides : undefined
				);
			})();
		});
	}

	/**
	 * Handles tree generation logic
	 */
	private async handleTreeGeneration(
		rootPersonField: RelationshipField,
		treeType: 'ancestors' | 'descendants' | 'full',
		maxGenerations: number,
		includeSpouses: boolean,
		includeStepParents: boolean,
		includeAdoptiveParents: boolean,
		direction: 'vertical' | 'horizontal',
		spacingX: number,
		spacingY: number,
		layoutType: import('../settings').LayoutType,
		canvasFileName: string,
		collectionFilter?: string,
		placeFilter?: { placeName: string; types: ('birth' | 'death' | 'marriage' | 'burial')[] },
		styleOverrides?: import('../core/canvas-style-overrides').StyleOverrides
	): Promise<void> {
		// Validate root person
		if (!rootPersonField.crId) {
			new Notice('Please select a root person');
			return;
		}

		try {
			new Notice('Generating family tree...');

			// Create tree options
			const treeOptions: TreeOptions = {
				rootCrId: rootPersonField.crId,
				treeType,
				maxGenerations: maxGenerations || undefined,
				includeSpouses,
				includeStepParents,
				includeAdoptiveParents,
				collectionFilter,
				placeFilter
			};

			// Create canvas generation options with embedded metadata
			const canvasOptions: CanvasGenerationOptions = {
				direction,
				nodeSpacingX: spacingX,
				nodeSpacingY: spacingY,
				layoutType: layoutType,
				nodeColorScheme: this.plugin.settings.nodeColorScheme,
				showLabels: true,
				useFamilyChartLayout: true,  // Use family-chart for proper spouse handling
				parentChildArrowStyle: this.plugin.settings.parentChildArrowStyle,
				spouseArrowStyle: this.plugin.settings.spouseArrowStyle,
				parentChildEdgeColor: this.plugin.settings.parentChildEdgeColor,
				spouseEdgeColor: this.plugin.settings.spouseEdgeColor,
				showSpouseEdges: this.plugin.settings.showSpouseEdges,
				spouseEdgeLabelFormat: this.plugin.settings.spouseEdgeLabelFormat,
				showSourceIndicators: this.plugin.settings.showSourceIndicators,
				showResearchCoverage: this.plugin.settings.trackFactSourcing,
				canvasRootsMetadata: {
					plugin: 'canvas-roots',
					generation: {
						rootCrId: rootPersonField.crId,
						rootPersonName: rootPersonField.name,
						treeType,
						maxGenerations: maxGenerations || 0,
						includeSpouses,
						direction,
						timestamp: Date.now()
					},
					layout: {
						nodeWidth: this.plugin.settings.defaultNodeWidth,
						nodeHeight: this.plugin.settings.defaultNodeHeight,
						nodeSpacingX: spacingX,
						nodeSpacingY: spacingY,
						layoutType: layoutType
					},
					// Include style overrides if provided
					styleOverrides: styleOverrides
				}
			};

			// Generate tree
			logger.info('tree-generation', 'Starting tree generation', {
				rootCrId: treeOptions.rootCrId,
				treeType: treeOptions.treeType,
				maxGenerations: treeOptions.maxGenerations
			});

			const graphService = this.plugin.createFamilyGraphService();
			const familyTree = graphService.generateTree(treeOptions);

			if (!familyTree) {
				logger.error('tree-generation', 'Failed to generate tree: root person not found');
				new Notice('Failed to generate tree: root person not found');
				return;
			}

			// Log tree structure
			logger.info('tree-generation', 'Family tree generated', {
				rootPerson: familyTree.root.name,
				rootCrId: familyTree.root.crId,
				totalNodes: familyTree.nodes.size,
				totalEdges: familyTree.edges.length,
				nodeList: Array.from(familyTree.nodes.values()).map(n => ({
					name: n.name,
					crId: n.crId,
					hasFather: !!n.fatherCrId,
					hasMother: !!n.motherCrId,
					childrenCount: n.childrenCrIds.length
				})),
				edgeList: familyTree.edges.map(e => ({
					from: familyTree.nodes.get(e.from)?.name || e.from,
					to: familyTree.nodes.get(e.to)?.name || e.to,
					type: e.type
				}))
			});

			// Check for disconnected people (only for full trees)
			if (treeOptions.treeType === 'full') {
				const totalPeople = graphService.getTotalPeopleCount();
				const connectedPeople = familyTree.nodes.size;
				const disconnectedCount = totalPeople - connectedPeople;

				if (disconnectedCount > 0) {
					logger.info('tree-generation', 'Disconnected people detected', {
						totalPeople,
						connectedPeople,
						disconnectedCount
					});

					// Show helpful notice to user (persists until dismissed)
					const msg = `Full Family Tree shows ${connectedPeople} of ${totalPeople} people.\n\n` +
						`${disconnectedCount} people are not connected to ${familyTree.root.name} ` +
						`through family relationships.\n\n` +
						`This usually means your vault has multiple separate family trees. ` +
						`Use the "Generate all trees" command to create canvases for all family groups at once.`;

					new Notice(msg, 0); // 0 = persist until user dismisses
				}
			}

			// Generate canvas
			const canvasGenerator = new CanvasGenerator();
			const canvasData = canvasGenerator.generateCanvas(familyTree, canvasOptions);

			// Log canvas generation
			logger.info('canvas-generation', 'Canvas data generated', {
				nodeCount: canvasData.nodes.length,
				edgeCount: canvasData.edges.length,
				canvasNodes: canvasData.nodes.map(n => ({
					id: n.id,
					file: n.file
				}))
			});

			// Determine canvas file name
			let fileName = canvasFileName.trim();
			if (!fileName) {
				// Auto-generate filename with layout type
				const layoutSuffix = layoutType === 'standard' ? '' : ` (${layoutType})`;
				fileName = `Family Tree - ${rootPersonField.name}${layoutSuffix}`;
			}
			if (!fileName.endsWith('.canvas')) {
				fileName += '.canvas';
			}

			// Create canvas file
			// Note: Obsidian uses a specific JSON format: tabs for indentation,
			// but objects within arrays are compact (single line, no spaces)
			const canvasContent = this.formatCanvasJson(canvasData);

			// Use canvasesFolder setting
			const folder = this.plugin.settings.canvasesFolder || 'Canvas Roots/Canvases';
			await ensureFolderExists(this.app, folder);
			const filePath = normalizePath(`${folder}/${fileName}`);

			// Log the actual canvas content being written
			logger.info('canvas-generation', 'Canvas JSON content to write', {
				contentLength: canvasContent.length,
				contentPreview: canvasContent.substring(0, 500),
				hasNodes: canvasContent.includes('"nodes"'),
				hasEdges: canvasContent.includes('"edges"')
			});

			let file: TFile;
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);
			if (existingFile instanceof TFile) {
				// Update existing file
				await this.app.vault.modify(existingFile, canvasContent);
				file = existingFile;
				new Notice(`Updated existing canvas: ${fileName}`);
			} else {
				// Create new file
				file = await this.app.vault.create(filePath, canvasContent);
				new Notice(`Created canvas: ${fileName}`);
			}

			// Wait a moment for file system to settle before opening
			// This helps prevent race conditions where Obsidian tries to parse
			// the canvas before the write is fully complete
			await new Promise(resolve => setTimeout(resolve, 100));

			// Save to recent trees history
			const treeInfo: RecentTreeInfo = {
				canvasPath: file.path,
				canvasName: fileName,
				peopleCount: canvasData.nodes.length,
				edgeCount: canvasData.edges.length,
				rootPerson: rootPersonField.name,
				timestamp: Date.now()
			};

			logger.info('tree-generation', 'Saving to recent trees history', {
				treeInfo,
				currentRecentTreesCount: this.plugin.settings.recentTrees?.length || 0
			});

			// Ensure recentTrees array exists (defensive)
			if (!this.plugin.settings.recentTrees) {
				this.plugin.settings.recentTrees = [];
			}

			// Add to beginning of array and keep only last 10
			this.plugin.settings.recentTrees = [treeInfo, ...this.plugin.settings.recentTrees].slice(0, 10);

			logger.info('tree-generation', 'After adding to recent trees', {
				newRecentTreesCount: this.plugin.settings.recentTrees.length,
				recentTrees: this.plugin.settings.recentTrees
			});

			await this.plugin.saveSettings();

			logger.info('tree-generation', 'Settings saved successfully');

			// Open the canvas file
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);

			new Notice(`Family tree generated successfully! (${canvasData.nodes.length} people)`);
			this.close();
		} catch (error: unknown) {
			console.error('Error generating tree:', error);
			new Notice(`Error generating tree: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Generates a collection overview canvas showing all collections and connections
	 */
	private async generateCollectionOverviewCanvas(): Promise<void> {
		try {
			new Notice('Generating collection overview...');

			const graphService = this.plugin.createFamilyGraphService();

			// Get both detected families and user collections
			const families = graphService.findAllFamilyComponents();
			const userCollections = graphService.getUserCollections();

			// Combine them into a single collection list
			const allCollections = [
				...families.map(f => ({
					name: f.collectionName || `Family ${families.indexOf(f) + 1}`,
					size: f.size,
					representative: f.representative
				})),
				...userCollections.map(c => ({
					name: c.name,
					size: c.size,
					representative: undefined // User collections don't have a single representative
				}))
			];

			if (allCollections.length === 0) {
				new Notice('No collections found. Add some person notes to get started.');
				return;
			}

			// Get connections between collections
			const connections = graphService.detectCollectionConnections();

			// Generate the overview canvas
			const canvasGenerator = new CanvasGenerator();
			const canvasData = canvasGenerator.generateCollectionOverviewCanvas(
				allCollections,
				connections,
				{
					nodeWidth: this.plugin.settings.defaultNodeWidth,
					nodeHeight: this.plugin.settings.defaultNodeHeight
				}
			);

			// Create canvas file
			const fileName = 'Collection Overview.canvas';
			const canvasContent = this.formatCanvasJson(canvasData);

			// Use canvasesFolder setting
			const folder = this.plugin.settings.canvasesFolder || 'Canvas Roots/Canvases';
			await ensureFolderExists(this.app, folder);
			const filePath = normalizePath(`${folder}/${fileName}`);

			let file: TFile;
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);
			if (existingFile instanceof TFile) {
				// Update existing file
				await this.app.vault.modify(existingFile, canvasContent);
				file = existingFile;
				new Notice(`Updated existing overview: ${fileName}`);
			} else {
				// Create new file
				file = await this.app.vault.create(filePath, canvasContent);
				new Notice(`Created overview: ${fileName}`);
			}

			// Wait for file system to settle
			await new Promise(resolve => setTimeout(resolve, 100));

			// Open the canvas file
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);

			new Notice(`Collection overview generated! (${allCollections.length} collections)`);
			this.close();
		} catch (error: unknown) {
			console.error('Error generating collection overview:', error);
			new Notice(`Error generating overview: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Loads and displays analytics data
	 */
	private loadAnalyticsData(container: HTMLElement): void {
		try {
			const graphService = this.plugin.createFamilyGraphService();
			const analytics = graphService.calculateCollectionAnalytics();

			// Clear loading message
			container.empty();

			// Quick Stats Section
			const statsGrid = container.createDiv({ cls: 'crc-stats-grid' });

			const createStatBox = (label: string, value: string | number, subtitle?: string) => {
				const box = statsGrid.createDiv({ cls: 'crc-stat-box' });
				box.createEl('div', { text: String(value), cls: 'crc-stat-value' });
				box.createEl('div', { text: label, cls: 'crc-stat-label' });
				if (subtitle) {
					box.createEl('div', { text: subtitle, cls: 'crc-stat-subtitle' });
				}
				return box;
			};

			createStatBox('Total people', analytics.totalPeople);
			createStatBox('Collections', analytics.totalCollections,
				`${analytics.totalFamilies} families, ${analytics.totalUserCollections} custom`);
			createStatBox('Average size', analytics.averageCollectionSize, 'people per collection');
			createStatBox('Bridge people', analytics.crossCollectionMetrics.totalBridgePeople,
				'connecting collections');

			// Data Quality Section
			container.createEl('h4', { text: 'Data completeness', cls: 'crc-mt-4 crc-mb-2' });
			const qualityGrid = container.createDiv({ cls: 'crc-quality-grid' });

			const createProgressBar = (label: string, percent: number) => {
				const item = qualityGrid.createDiv({ cls: 'crc-quality-item' });
				const header = item.createDiv({ cls: 'crc-quality-header' });
				header.createEl('span', { text: label });
				header.createEl('span', { text: `${percent}%`, cls: 'crc-quality-percent' });

				const barBg = item.createDiv({ cls: 'crc-progress-bar-bg' });
				const barFill = barBg.createDiv({ cls: 'crc-progress-bar-fill' });
				barFill.style.setProperty('width', `${percent}%`);

				return item;
			};

			createProgressBar('Birth dates', analytics.dataCompleteness.birthDatePercent);
			createProgressBar('Death dates', analytics.dataCompleteness.deathDatePercent);
			createProgressBar('Sex/Gender', analytics.dataCompleteness.sexPercent);

			// Top Collections Section
			if (analytics.largestCollection) {
				container.createEl('h4', { text: 'Collection highlights', cls: 'crc-mt-4 crc-mb-2' });
				const highlightsList = container.createEl('ul', { cls: 'crc-highlights-list' });

				highlightsList.createEl('li', {
					text: `Largest: ${analytics.largestCollection.name} (${analytics.largestCollection.size} people)`
				});

				if (analytics.smallestCollection) {
					highlightsList.createEl('li', {
						text: `Smallest: ${analytics.smallestCollection.name} (${analytics.smallestCollection.size} people)`
					});
				}

				if (analytics.dateRange.earliest && analytics.dateRange.latest) {
					highlightsList.createEl('li', {
						text: `Date range: ${analytics.dateRange.earliest} - ${analytics.dateRange.latest} (${analytics.dateRange.span} years)`
					});
				}
			}

			// Cross-Collection Connections
			if (analytics.crossCollectionMetrics.topConnections.length > 0) {
				container.createEl('h4', { text: 'Top connections', cls: 'crc-mt-4 crc-mb-2' });
				const connectionsList = container.createEl('ul', { cls: 'crc-connections-list' });

				analytics.crossCollectionMetrics.topConnections.forEach(conn => {
					connectionsList.createEl('li', {
						text: `${conn.from} ↔ ${conn.to} (${conn.bridgeCount} ${conn.bridgeCount === 1 ? 'person' : 'people'})`
					});
				});
			}

		} catch (error: unknown) {
			console.error('Error loading analytics:', error);
			container.empty();
			container.createEl('p', {
				text: 'Failed to load analytics data.',
				cls: 'crc-error-text'
			});
		}
	}

	/**
	 * Formats canvas data to match Obsidian's exact JSON format.
	 *
	 * Obsidian canvases use a specific format:
	 * - Tabs for indentation
	 * - Objects within arrays are compact (single line, no spaces after colons/commas)
	 * - Top-level structure is indented with newlines
	 *
	 * @param data Canvas data to format
	 * @returns Formatted JSON string matching Obsidian's format
	 */
	private formatCanvasJson(data: CanvasData): string {
		// Helper to safely stringify handling circular references
		const safeStringify = (obj: unknown): string => {
			const seen = new WeakSet();
			return JSON.stringify(obj, (_key, value) => {
				if (typeof value === 'object' && value !== null) {
					if (seen.has(value)) {
						return '[Circular]';
					}
					seen.add(value);
				}
				return value;
			});
		};

		const lines: string[] = [];
		lines.push('{');

		// Format nodes array
		lines.push('\t"nodes":[');
		data.nodes.forEach((node, index) => {
			const compact = safeStringify(node);
			const suffix = index < data.nodes.length - 1 ? ',' : '';
			lines.push(`\t\t${compact}${suffix}`);
		});
		lines.push('\t],');

		// Format edges array
		lines.push('\t"edges":[');
		data.edges.forEach((edge, index) => {
			const compact = safeStringify(edge);
			const suffix = index < data.edges.length - 1 ? ',' : '';
			lines.push(`\t\t${compact}${suffix}`);
		});
		lines.push('\t],');

		// Format metadata
		lines.push('\t"metadata":{');
		if (data.metadata?.version) {
			lines.push(`\t\t"version":"${data.metadata.version}",`);
		}
		const frontmatter = data.metadata?.frontmatter || {};
		lines.push(`\t\t"frontmatter":${safeStringify(frontmatter)}`);
		lines.push('\t}');

		lines.push('}');

		return lines.join('\n');
	}

	/**
	 * Show GEDCOM analysis before import (v2)
	 */
	private async showGedcomAnalysis(
		file: File,
		analysisContainer: HTMLElement,
		fileBtn: HTMLButtonElement,
		stagingBaseFolder?: string
	): Promise<void> {
		try {
			// Show loading state
			analysisContainer.empty();
			analysisContainer.removeClass('cr-hidden');
			fileBtn.addClass('cr-hidden');

			// Determine if using staging or configured folders
			const useStaging = !!stagingBaseFolder;

			analysisContainer.createEl('p', {
				text: `File: ${file.name}`,
				cls: 'crc-text-muted'
			});

			// Show destination info
			if (useStaging) {
				analysisContainer.createEl('p', {
					text: `Destination: ${stagingBaseFolder}/ (People/, Events/, Sources/, Places/)`,
					cls: 'crc-text-muted'
				});
			} else {
				const destFolders = [
					`People → ${this.plugin.settings.peopleFolder || 'vault root'}`,
					`Events → ${this.plugin.settings.eventsFolder || 'Events'}`,
					`Sources → ${this.plugin.settings.sourcesFolder || 'Sources'}`,
					`Places → ${this.plugin.settings.placesFolder || 'Places'}`
				];
				analysisContainer.createEl('p', {
					text: `Destination: ${destFolders[0]}`,
					cls: 'crc-text-muted'
				});
			}

			const loadingMsg = analysisContainer.createEl('p', {
				text: 'Analyzing file...',
				cls: 'crc-text-muted'
			});

			// Read and analyze file using v2 importer
			const content = await file.text();
			const importerV2 = new GedcomImporterV2(this.app);
			const analysis = importerV2.analyzeFile(content);

			// Update UI with analysis results
			loadingMsg.remove();

			const results = analysisContainer.createDiv({ cls: 'crc-analysis-results' });

			// Basic stats
			results.createEl('p', {
				text: `✓ ${analysis.individualCount} people found`
			});
			results.createEl('p', {
				text: `✓ ${analysis.familyCount} families found`
			});

			// Extended stats from v2 (events, sources, places)
			if (analysis.eventCount > 0) {
				results.createEl('p', {
					text: `✓ ${analysis.eventCount} events found`
				});
			}
			if (analysis.sourceCount > 0) {
				results.createEl('p', {
					text: `✓ ${analysis.sourceCount} sources found`
				});
			}
			if (analysis.uniquePlaces > 0) {
				results.createEl('p', {
					text: `✓ ${analysis.uniquePlaces} places found`
				});
			}

			// Component analysis
			if (analysis.componentCount > 1) {
				results.createEl('p', {
					text: `⚠ ${analysis.componentCount} disconnected family groups`,
					cls: 'crc-warning-text'
				});

				const helpText = results.createEl('p', {
					cls: 'crc-text-muted crc-mt-2'
				});
				helpText.appendText('This file contains multiple separate family trees. After import, use the ');
				helpText.createEl('strong', { text: '"Generate all trees"' });
				helpText.appendText(' command to create canvases for all family groups.');
			}

			// Import options (checkboxes for event/source/place notes)
			let createPeopleNotes = true;
			let createEventNotes = analysis.eventCount > 0;
			let createSourceNotes = analysis.sourceCount > 0;
			let createPlaceNotes = analysis.uniquePlaces > 0;

			// Import options section - always show since people toggle is always available
			const optionsSection = analysisContainer.createDiv({ cls: 'crc-import-options crc-mt-4' });
			optionsSection.createEl('p', {
				text: 'Import options',
				cls: 'crc-text-muted crc-font-medium'
			});
			optionsSection.createEl('p', {
				text: 'Choose which note types to create. Disable people notes if you already have them in your vault.',
				cls: 'crc-text-muted crc-text--small crc-mb-2'
			});

			// People notes toggle (always shown)
			const peopleFolder = this.plugin.settings.peopleFolder || 'People';
			new Setting(optionsSection)
				.setName(`Create people notes (${analysis.individualCount.toLocaleString()} found)`)
				.setDesc(`Person notes with relationships and life events → ${peopleFolder}/`)
				.addToggle(toggle => toggle
					.setValue(createPeopleNotes)
					.onChange(value => {
						createPeopleNotes = value;
					})
				);

			if (analysis.eventCount > 0) {
				const eventsFolder = this.plugin.settings.eventsFolder || 'Events';
				new Setting(optionsSection)
					.setName(`Create event notes (${analysis.eventCount.toLocaleString()} found)`)
					.setDesc(`Births, deaths, marriages, and other life events → ${eventsFolder}/`)
					.addToggle(toggle => toggle
						.setValue(createEventNotes)
						.onChange(value => {
							createEventNotes = value;
						})
					);
			}

			if (analysis.sourceCount > 0) {
				const sourcesFolder = this.plugin.settings.sourcesFolder || 'Sources';
				new Setting(optionsSection)
					.setName(`Create source notes (${analysis.sourceCount.toLocaleString()} found)`)
					.setDesc(`Citations and references for genealogical records → ${sourcesFolder}/`)
					.addToggle(toggle => toggle
						.setValue(createSourceNotes)
						.onChange(value => {
							createSourceNotes = value;
						})
					);
			}

			if (analysis.uniquePlaces > 0) {
				const placesFolder = this.plugin.settings.placesFolder || 'Places';
				new Setting(optionsSection)
					.setName(`Create place notes (${analysis.uniquePlaces.toLocaleString()} found)`)
					.setDesc(`Locations with parent/child hierarchy (city → county → state) → ${placesFolder}/`)
					.addToggle(toggle => toggle
						.setValue(createPlaceNotes)
						.onChange(value => {
							createPlaceNotes = value;
						})
					);
			}

			// Dynamic content blocks toggle
			let includeDynamicBlocks = false;
			new Setting(optionsSection)
				.setName('Include dynamic content blocks')
				.setDesc('Add timeline and family relationship blocks to person notes (can be frozen to static markdown later)')
				.addToggle(toggle => toggle
					.setValue(includeDynamicBlocks)
					.onChange(value => {
						includeDynamicBlocks = value;
					})
				);

			// Filename format options
			let filenameFormat: FilenameFormat = 'original';
			let useAdvancedFormats = false;
			const filenameFormats: FilenameFormatOptions = {
				people: 'original',
				events: 'original',
				sources: 'original',
				places: 'original'
			};

			const formatSection = analysisContainer.createDiv({ cls: 'crc-import-options crc-mt-4' });

			// Main format dropdown (applies to all when not using advanced)
			const mainFormatSetting = new Setting(formatSection)
				.setName('Filename format')
				.setDesc('How to format filenames for all created notes')
				.addDropdown(dropdown => dropdown
					.addOption('original', 'Original (John Smith.md)')
					.addOption('kebab-case', 'Kebab-case (john-smith.md)')
					.addOption('snake_case', 'Snake_case (john_smith.md)')
					.setValue(filenameFormat)
					.onChange(value => {
						filenameFormat = value as FilenameFormat;
						// Sync to all per-type formats when changing main
						filenameFormats.people = filenameFormat;
						filenameFormats.events = filenameFormat;
						filenameFormats.sources = filenameFormat;
						filenameFormats.places = filenameFormat;
					})
				);

			// Advanced toggle
			const advancedContainer = formatSection.createDiv({ cls: 'crc-advanced-formats' });
			const advancedToggle = new Setting(advancedContainer)
				.setName('Customize per note type')
				.setDesc('Set different filename formats for each note type')
				.addToggle(toggle => toggle
					.setValue(useAdvancedFormats)
					.onChange(value => {
						useAdvancedFormats = value;
						advancedSection.toggleClass('cr-hidden', !value);
						mainFormatSetting.settingEl.toggleClass('cr-hidden', value);
					})
				);
			advancedToggle.settingEl.addClass('crc-setting--compact');

			// Per-type format dropdowns (hidden by default)
			const advancedSection = advancedContainer.createDiv({ cls: 'crc-advanced-formats__options cr-hidden' });

			const createFormatDropdown = (
				container: HTMLElement,
				label: string,
				type: keyof FilenameFormatOptions
			) => {
				new Setting(container)
					.setName(label)
					.addDropdown(dropdown => dropdown
						.addOption('original', 'Original')
						.addOption('kebab-case', 'Kebab-case')
						.addOption('snake_case', 'Snake_case')
						.setValue(filenameFormats[type])
						.onChange(value => {
							filenameFormats[type] = value as FilenameFormat;
						})
					)
					.settingEl.addClass('crc-setting--compact');
			};

			createFormatDropdown(advancedSection, 'People', 'people');
			createFormatDropdown(advancedSection, 'Events', 'events');
			createFormatDropdown(advancedSection, 'Sources', 'sources');
			createFormatDropdown(advancedSection, 'Places', 'places');

			// Action buttons
			const actions = analysisContainer.createDiv({ cls: 'crc-gedcom-actions crc-mt-4' });

			const importBtn = actions.createEl('button', {
				cls: 'crc-btn crc-btn--primary',
				text: useStaging ? 'Import to staging' : 'Import to vault'
			});
			importBtn.addEventListener('click', () => {
				void (async () => {
					analysisContainer.addClass('cr-hidden');
					fileBtn.removeClass('cr-hidden');
					await this.handleGedcomImportV2(
						file,
						stagingBaseFolder,
						createPeopleNotes,
						createEventNotes,
						createSourceNotes,
						createPlaceNotes,
						useAdvancedFormats ? undefined : filenameFormat,
						useAdvancedFormats ? filenameFormats : undefined,
						includeDynamicBlocks
					);
				})();
			});

			const cancelBtn = actions.createEl('button', {
				cls: 'crc-btn crc-btn--secondary crc-ml-2',
				text: 'Cancel'
			});
			cancelBtn.addEventListener('click', () => {
				analysisContainer.addClass('cr-hidden');
				fileBtn.removeClass('cr-hidden');
			});

		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('gedcom', `GEDCOM analysis failed: ${errorMsg}`);
			analysisContainer.empty();
			analysisContainer.createEl('p', {
				text: `Failed to analyze file: ${errorMsg}`,
				cls: 'crc-error-text'
			});

			const retryBtn = analysisContainer.createEl('button', {
				cls: 'crc-btn crc-btn--secondary crc-mt-2',
				text: 'Try different file'
			});
			retryBtn.addEventListener('click', () => {
				analysisContainer.addClass('cr-hidden');
				fileBtn.removeClass('cr-hidden');
			});
		}
	}

	/**
	 * Handle GEDCOM file import using v2 importer
	 */
	private async handleGedcomImportV2(
		file: File,
		stagingBaseFolder: string | undefined,
		createPeopleNotes: boolean,
		createEventNotes: boolean,
		createSourceNotes: boolean,
		createPlaceNotes: boolean,
		filenameFormat?: FilenameFormat,
		filenameFormats?: FilenameFormatOptions,
		includeDynamicBlocks?: boolean
	): Promise<void> {
		try {
			const useStaging = !!stagingBaseFolder;
			logger.info('gedcom', `Starting GEDCOM v2 import: ${file.name} to ${useStaging ? stagingBaseFolder : 'configured folders'}`);

			// Read file content
			const content = await file.text();

			// Create v2 importer
			const importer = new GedcomImporterV2(this.app);

			// Parse and validate GEDCOM first (for quality preview)
			const parseResult = importer.parseContent(content);
			if (!parseResult.valid || !parseResult.data) {
				new Notice(`Invalid GEDCOM file: ${parseResult.errors.join(', ')}`);
				return;
			}

			// Analyze data quality
			const qualityAnalysis = analyzeGedcomQuality(parseResult.data);

			// Show quality preview modal if there are issues or place variants
			const hasIssues = qualityAnalysis.summary.totalIssues > 0;
			const hasVariants = qualityAnalysis.summary.placeVariants.length > 0;

			if (hasIssues || hasVariants) {
				// Show quality preview and wait for user decision
				const previewResult = await new Promise<{ proceed: boolean; data: GedcomDataV2 }>((resolve) => {
					const previewModal = new GedcomQualityPreviewModal(this.app, qualityAnalysis, {
						onComplete: (result) => {
							if (result.proceed) {
								// Apply user's fix choices to the data
								applyQualityFixes(parseResult.data!, result.choices);
							}
							resolve({ proceed: result.proceed, data: parseResult.data! });
						}
					});
					previewModal.open();
				});

				if (!previewResult.proceed) {
					logger.info('gedcom', 'Import cancelled by user after quality preview');
					return;
				}

				// Continue with the (potentially modified) data
				await this.executeGedcomImport(
					content,
					previewResult.data,
					importer,
					useStaging,
					stagingBaseFolder,
					createPeopleNotes,
					createEventNotes,
					createSourceNotes,
					createPlaceNotes,
					filenameFormat,
					filenameFormats,
					file.name,
					includeDynamicBlocks
				);
			} else {
				// No issues - proceed directly
				await this.executeGedcomImport(
					content,
					parseResult.data,
					importer,
					useStaging,
					stagingBaseFolder,
					createPeopleNotes,
					createEventNotes,
					createSourceNotes,
					createPlaceNotes,
					filenameFormat,
					filenameFormats,
					file.name,
					includeDynamicBlocks
				);
			}
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('gedcom', `GEDCOM v2 import failed: ${errorMsg}`);
			new Notice(`Failed to import GEDCOM: ${errorMsg}`);
		}
	}

	/**
	 * Execute the actual GEDCOM import with pre-parsed data
	 */
	private async executeGedcomImport(
		content: string,
		gedcomData: GedcomDataV2,
		importer: GedcomImporterV2,
		useStaging: boolean,
		stagingBaseFolder: string | undefined,
		createPeopleNotes: boolean,
		createEventNotes: boolean,
		createSourceNotes: boolean,
		createPlaceNotes: boolean,
		filenameFormat?: FilenameFormat,
		filenameFormats?: FilenameFormatOptions,
		fileName?: string,
		includeDynamicBlocks?: boolean
	): Promise<void> {
		// Disable bidirectional sync during import to prevent duplicate relationships
		// The file watcher would otherwise trigger syncRelationships before Phase 2 replaces GEDCOM IDs with cr_ids
		this.plugin.disableBidirectionalSync();
		this.plugin.bidirectionalLinker?.suspend();

		// Show progress modal
		const progressModal = new GedcomImportProgressModal(this.app);
		progressModal.open();

		try {
			// Build import options - use staging subfolders or configured folders
			const options: GedcomImportOptionsV2 = {
				peopleFolder: useStaging
					? `${stagingBaseFolder}/People`
					: (this.plugin.settings.peopleFolder || 'People'),
				eventsFolder: useStaging
					? `${stagingBaseFolder}/Events`
					: (this.plugin.settings.eventsFolder || 'Events'),
				sourcesFolder: useStaging
					? `${stagingBaseFolder}/Sources`
					: (this.plugin.settings.sourcesFolder || 'Sources'),
				placesFolder: useStaging
					? `${stagingBaseFolder}/Places`
					: (this.plugin.settings.placesFolder || 'Places'),
				overwriteExisting: false,
				fileName: fileName,
				createPeopleNotes,
				createEventNotes,
				createSourceNotes,
				createPlaceNotes,
				filenameFormat: filenameFormat || 'original',
				filenameFormats,
				propertyAliases: this.plugin.settings.propertyAliases,
				includeDynamicBlocks,
				dynamicBlockTypes: ['timeline', 'relationships'],
				onProgress: (progress) => {
					progressModal.updateProgress({
						phase: progress.phase,
						current: progress.current,
						total: progress.total,
						message: progress.message
					});
					// Update running stats based on phase
					if (progress.phase === 'places' && progress.current > 0) {
						progressModal.updateStats({ places: progress.current });
					} else if (progress.phase === 'sources' && progress.current > 0) {
						progressModal.updateStats({ sources: progress.current });
					} else if (progress.phase === 'people' && progress.current > 0) {
						progressModal.updateStats({ people: progress.current });
					} else if (progress.phase === 'events' && progress.current > 0) {
						progressModal.updateStats({ events: progress.current });
					}
				}
			};

			// Import GEDCOM file with pre-parsed data
			const result = await importer.importFile(content, options, gedcomData);

			// Mark progress as complete and close modal after a brief delay
			progressModal.markComplete();
			setTimeout(() => progressModal.close(), 1500);

			// Log results
			logger.info('gedcom', `Import complete: ${result.individualsImported} people, ${result.eventsCreated} events, ${result.sourcesCreated} sources, ${result.placesCreated} places`);

			if (result.errors.length > 0) {
				logger.warn('gedcom', `Import had ${result.errors.length} errors`);
				result.errors.forEach(error => logger.error('gedcom', error));
			}

			// Track import in recent imports history
			const totalNotesCreated = result.individualsImported + result.eventsCreated + result.sourcesCreated + result.placesCreated;
			if (result.success && totalNotesCreated > 0 && fileName) {
				const importInfo: RecentImportInfo = {
					fileName: fileName,
					recordsImported: result.individualsImported,
					notesCreated: totalNotesCreated,
					timestamp: Date.now()
				};

				this.plugin.settings.recentImports.unshift(importInfo);
				if (this.plugin.settings.recentImports.length > 10) {
					this.plugin.settings.recentImports = this.plugin.settings.recentImports.slice(0, 10);
				}
				await this.plugin.saveSettings();
			}

			// Note: Bidirectional relationship sync after GEDCOM import is intentionally skipped.
			// GEDCOM data already contains complete bidirectional relationships, and running
			// syncImportedRelationships causes corruption when there are duplicate names
			// (e.g., two "John Smith" people) because the sync matches by filename, not cr_id.

			// Show results notice
			let noticeMsg = `Import complete: ${result.individualsImported} people`;
			if (result.eventsCreated > 0) {
				noticeMsg += `, ${result.eventsCreated} events`;
			}
			if (result.sourcesCreated > 0) {
				noticeMsg += `, ${result.sourcesCreated} sources`;
			}
			if (result.errors.length > 0) {
				noticeMsg += `. ${result.errors.length} errors occurred`;
			}
			new Notice(noticeMsg, 8000);

			// Auto-create bases for imported note types (silently, skips if already exist)
			if (totalNotesCreated > 0) {
				await this.plugin.createAllBases({ silent: true });
			}

			// Refresh status tab
			if (totalNotesCreated > 0) {
				this.showTab('status');
			}

			// If successful, offer to assign reference numbers
			if (result.success && result.individualsImported > 0) {
				this.promptAssignReferenceNumbersAfterImport();
			}
		} catch (error: unknown) {
			progressModal.close();
			const errorMsg = getErrorMessage(error);
			logger.error('gedcom', `GEDCOM v2 import failed: ${errorMsg}`);
			new Notice(`Failed to import GEDCOM: ${errorMsg}`);
		} finally {
			// Re-enable bidirectional sync and resume linker after import completes (success or failure)
			this.plugin.enableBidirectionalSync();
			this.plugin.bidirectionalLinker?.resume();
		}
	}

	/**
	 * Prompt user to assign reference numbers after GEDCOM import
	 */
	private promptAssignReferenceNumbersAfterImport(): void {
		// Get person count for preview
		const graphService = this.plugin.createFamilyGraphService();
		const allPeople = graphService.getAllPeople();
		const personCount = allPeople.length;

		// Show menu to select numbering system
		const systemChoices: { system: NumberingSystem; icon: string; label: string; description: string }[] = [
			{ system: 'ahnentafel', icon: 'arrow-up', label: 'Ahnentafel', description: 'Best for pedigree charts — numbers ancestors (1=self, 2=father, 3=mother, 4=paternal grandfather...)' },
			{ system: 'daboville', icon: 'git-branch', label: "d'Aboville", description: 'Best for descendant reports — clear lineage paths using dots (1.1, 1.2, 1.1.1)' },
			{ system: 'henry', icon: 'list-ordered', label: 'Henry', description: 'Compact descendant numbering — shorter than d\'Aboville but uses letters after 9 children' },
			{ system: 'generation', icon: 'layers', label: 'Generation', description: 'Shows generational distance from root person (0=self, −1=parents, +1=children)' }
		];

		// Create a simple selection modal
		const modal = new Modal(this.app);
		modal.titleEl.setText('Assign reference numbers');

		const content = modal.contentEl;
		content.addClass('cr-ref-numbers-modal');

		content.createEl('p', {
			text: 'Reference numbers uniquely identify individuals when names are ambiguous and follow standard genealogical notation for sharing research.',
			cls: 'crc-text-muted'
		});

		// Person count preview
		if (personCount > 0) {
			const previewEl = content.createDiv({ cls: 'cr-ref-numbers-preview' });
			previewEl.createSpan({ text: `This will update ` });
			previewEl.createEl('strong', { text: `${personCount} person${personCount !== 1 ? 's' : ''}` });
			previewEl.createSpan({ text: ' in your tree.' });
		}

		const buttonContainer = content.createDiv({ cls: 'cr-numbering-system-buttons' });

		for (const choice of systemChoices) {
			const btn = buttonContainer.createDiv({
				cls: 'cr-numbering-btn'
			});

			// Icon
			const iconSpan = btn.createSpan({ cls: 'cr-numbering-btn-icon' });
			setIcon(iconSpan, choice.icon);

			// Text content
			const textContainer = btn.createDiv({ cls: 'cr-numbering-btn-text' });
			textContainer.createEl('div', { cls: 'cr-numbering-btn-label', text: choice.label });
			textContainer.createEl('div', { cls: 'cr-numbering-btn-desc', text: choice.description });

			btn.addEventListener('click', () => {
				modal.close();
				this.selectRootPersonForNumbering(choice.system);
			});
		}

		// Footer with skip link and learn more
		const footerContainer = content.createDiv({ cls: 'cr-ref-numbers-footer' });

		const skipLink = footerContainer.createEl('a', {
			cls: 'cr-ref-numbers-skip',
			text: 'Skip for now'
		});
		skipLink.addEventListener('click', (e) => {
			e.preventDefault();
			modal.close();
		});

		const learnMoreLink = footerContainer.createEl('a', {
			cls: 'cr-ref-numbers-learn-more',
			text: 'Learn more',
			href: 'https://github.com/banisterious/obsidian-canvas-roots/wiki/Relationship-Tools#reference-numbering-systems'
		});
		learnMoreLink.setAttr('target', '_blank');
		learnMoreLink.setAttr('rel', 'noopener noreferrer');

		modal.open();
	}

	/**
	 * Select root person and assign reference numbers
	 */
	private selectRootPersonForNumbering(system: NumberingSystem): void {
		// Build context-specific title and subtitle based on numbering system
		const systemInfo: Record<NumberingSystem, { title: string; subtitle: string }> = {
			ahnentafel: {
				title: 'Select root person',
				subtitle: 'This person will be #1; ancestors are numbered upward'
			},
			daboville: {
				title: 'Select progenitor',
				subtitle: 'This person will be 1; descendants are numbered downward'
			},
			henry: {
				title: 'Select progenitor',
				subtitle: 'This person will be 1; descendants are numbered downward'
			},
			generation: {
				title: 'Select reference person',
				subtitle: 'This person will be generation 0'
			}
		};

		const { title, subtitle } = systemInfo[system];

		const picker = new PersonPickerModal(this.app, (selectedPerson) => {
			void (async () => {
				try {
					const service = new ReferenceNumberingService(this.app);
					new Notice(`Assigning ${system} numbers from ${selectedPerson.name}...`);

					let stats;
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
		}, { title, subtitle });
		picker.open();
	}

	/**
	 * Handle GEDCOM file export
	 */
	private async handleGedcomExport(options: {
		fileName: string;
		collectionFilter?: string;
		includeCollectionCodes: boolean;
		includeCustomRelationships?: boolean;
		branchRootCrId?: string;
		branchDirection?: 'ancestors' | 'descendants';
		branchIncludeSpouses?: boolean;
		privacyOverride?: {
			enablePrivacyProtection: boolean;
			privacyDisplayFormat: 'living' | 'private' | 'initials' | 'hidden';
		};
		includeEntities?: {
			people: boolean;
			events: boolean;
			sources: boolean;
			places: boolean;
		};
		outputDestination?: 'download' | 'vault';
		outputFolder?: string;
	}): Promise<void> {
		// Create and open progress modal
		const { ExportProgressModal } = await import('./export-progress-modal');
		const progressModal = new ExportProgressModal(this.app, 'GEDCOM');
		progressModal.open();

		try {
			logger.info('gedcom-export', `Starting GEDCOM export: ${options.fileName}`);

			// Update progress: loading data
			progressModal.updateProgress({ phase: 'loading', current: 0, total: 1 });

			// Create exporter
			const { GedcomExporter } = await import('../gedcom/gedcom-exporter');
			const exporter = new GedcomExporter(this.app);

			// Conditionally set services based on includeEntities flags
			const includeEntities = options.includeEntities ?? {
				people: true,
				events: true,
				sources: true,
				places: true
			};

			if (includeEntities.events) {
				exporter.setEventService(this.plugin.settings);
			}

			if (includeEntities.sources) {
				exporter.setSourceService(this.plugin.settings);
			}

			if (includeEntities.places) {
				exporter.setPlaceGraphService(this.plugin.settings);
			}

			// Set property/value alias services (always needed for person data)
			const { PropertyAliasService } = await import('../core/property-alias-service');
			const { ValueAliasService } = await import('../core/value-alias-service');
			const propertyAliasService = new PropertyAliasService(this.plugin);
			const valueAliasService = new ValueAliasService(this.plugin);
			exporter.setPropertyAliasService(propertyAliasService);
			exporter.setValueAliasService(valueAliasService);

			// Set relationship service if custom relationships are enabled
			if (options.includeCustomRelationships) {
				const { RelationshipService } = await import('../relationships/services/relationship-service');
				const relationshipService = new RelationshipService(this.plugin);
				exporter.setRelationshipService(relationshipService);
			}

			// Update progress: generating export
			progressModal.updateProgress({ phase: 'generating', current: 1, total: 2 });

			// Export to GEDCOM
			const result = exporter.exportToGedcom({
				peopleFolder: this.plugin.settings.peopleFolder,
				collectionFilter: options.collectionFilter,
				branchRootCrId: options.branchRootCrId,
				branchDirection: options.branchDirection,
				branchIncludeSpouses: options.branchIncludeSpouses,
				includeCollectionCodes: options.includeCollectionCodes,
				includeCustomRelationships: options.includeCustomRelationships,
				fileName: options.fileName,
				sourceApp: 'Canvas Roots',
				sourceVersion: this.plugin.manifest.version,
				privacySettings: {
					enablePrivacyProtection: options.privacyOverride?.enablePrivacyProtection ?? this.plugin.settings.enablePrivacyProtection,
					livingPersonAgeThreshold: this.plugin.settings.livingPersonAgeThreshold,
					privacyDisplayFormat: options.privacyOverride?.privacyDisplayFormat ?? this.plugin.settings.privacyDisplayFormat,
					hideDetailsForLiving: this.plugin.settings.hideDetailsForLiving
				}
			});

			// Log results
			logger.info('gedcom-export', `Export complete: ${result.individualsExported} individuals, ${result.familiesExported} families`);

			if (result.errors.length > 0) {
				logger.warn('gedcom-export', `Export had ${result.errors.length} errors`);
				result.errors.forEach(error => logger.error('gedcom-export', error));
			}

			// Update stats
			progressModal.updateStats({
				people: result.individualsExported,
				relationships: result.familiesExported
			});

			if (result.success && result.gedcomContent) {
				const outputDestination = options.outputDestination ?? 'download';

				// Update progress: writing file
				progressModal.updateProgress({ phase: 'writing', current: 2, total: 2 });

				if (outputDestination === 'vault') {
					// Save to vault
					const outputFolder = options.outputFolder || '';
					const fileName = `${result.fileName}.ged`;
					const filePath = outputFolder ? `${outputFolder}/${fileName}` : fileName;

					await this.app.vault.adapter.write(filePath, result.gedcomContent);

					// Save last export info
					this.plugin.settings.lastGedcomExport = {
						timestamp: Date.now(),
						peopleCount: result.individualsExported,
						destination: 'vault',
						filePath: filePath,
						privacyExcluded: result.privacyExcluded
					};
					await this.plugin.saveSettings();

					let noticeMsg = `GEDCOM saved to vault: ${filePath}`;
					if (result.privacyExcluded && result.privacyExcluded > 0) {
						noticeMsg += ` (${result.privacyExcluded} living excluded)`;
					} else if (result.privacyObfuscated && result.privacyObfuscated > 0) {
						noticeMsg += ` (${result.privacyObfuscated} living obfuscated)`;
					}
					new Notice(noticeMsg);
				} else {
					// Download file
					const blob = new Blob([result.gedcomContent], { type: 'text/plain' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = `${result.fileName}.ged`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);

					// Save last export info
					this.plugin.settings.lastGedcomExport = {
						timestamp: Date.now(),
						peopleCount: result.individualsExported,
						destination: 'download',
						privacyExcluded: result.privacyExcluded
					};
					await this.plugin.saveSettings();

					let noticeMsg = `GEDCOM exported: ${result.individualsExported} people, ${result.familiesExported} families`;
					if (result.privacyExcluded && result.privacyExcluded > 0) {
						noticeMsg += ` (${result.privacyExcluded} living excluded)`;
					} else if (result.privacyObfuscated && result.privacyObfuscated > 0) {
						noticeMsg += ` (${result.privacyObfuscated} living obfuscated)`;
					}
					new Notice(noticeMsg);
				}

				// Mark export as complete
				progressModal.markComplete();

				// Close the modal after a short delay
				setTimeout(() => {
					progressModal.close();
				}, 1500);
			} else {
				throw new Error('Export failed to generate content');
			}
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('gedcom-export', `GEDCOM export failed: ${errorMsg}`);
			new Notice(`Failed to export GEDCOM: ${errorMsg}`);
			progressModal.close();
		}
	}

	/**
	 * Show Collections tab
	 */
	private showCollectionsTab(): void {
		const container = this.contentContainer;

		// Browse Mode Card
		const browseCard = this.createCard({
			title: 'Browse by',
			icon: 'folder',
			subtitle: 'Choose how to organize and view people'
		});

		const browseContent = browseCard.createDiv({ cls: 'crc-card__content' });

		// Browse mode selection using dropdown
		let selectedMode = 'families'; // Default to families

		new Setting(browseContent)
			.setName('View')
			.setDesc('Choose how to organize and view people')
			.addDropdown(dropdown => dropdown
				.addOption('all', 'All people - show everyone in the vault')
				.addOption('families', 'Detected families - auto-detected family groups')
				.addOption('collections', 'My collections - user-defined collections')
				.setValue(selectedMode)
				.onChange((value) => {
					selectedMode = value;
					this.updateCollectionsList(container, selectedMode);
				}));

		container.appendChild(browseCard);

		// Generate Overview Canvas button
		const overviewCard = this.createCard({
			title: 'Collection overview',
			icon: 'git-branch'
		});

		const overviewContent = overviewCard.querySelector('.crc-card__content') as HTMLElement;

		new Setting(overviewContent)
			.setName('Generate overview canvas')
			.setDesc('Create a master canvas showing all collections and their connections')
			.addButton(button => button
				.setButtonText('Generate overview')
				.setCta()
				.onClick(async () => {
					await this.generateCollectionOverviewCanvas();
				}));

		container.appendChild(overviewCard);

		// Analytics Card
		const analyticsCard = this.createCard({
			title: 'Analytics',
			icon: 'activity'
		});

		const analyticsContent = analyticsCard.querySelector('.crc-card__content') as HTMLElement;
		analyticsContent.createEl('p', {
			text: 'Loading analytics...',
			cls: 'crc-text--muted'
		});

		container.appendChild(analyticsCard);

		// Load analytics data asynchronously
		void this.loadAnalyticsData(analyticsContent);

		// Collections List Card
		this.updateCollectionsList(container, selectedMode);
	}

	/**
	 * Update the collections list based on selected browse mode
	 */
	private updateCollectionsList(container: HTMLElement, mode: string): void {
		// Remove existing list card if present
		const existingList = container.querySelector('.crc-collections-list');
		if (existingList) {
			existingList.remove();
		}

		const graphService = this.plugin.createFamilyGraphService();

		if (mode === 'all') {
			// Show all people
			graphService.getTotalPeopleCount(); // This loads the cache
			const allPeople = graphService.getAllPeople();

			const listCard = this.createCard({
				title: `All people (${allPeople.length})`,
				icon: 'users',
				subtitle: 'Everyone in your vault'
			});
			listCard.addClass('crc-collections-list');

			const listContent = listCard.createDiv({ cls: 'crc-card__content' });
			listContent.createEl('p', {
				cls: 'crc-text--muted',
				text: `Found ${allPeople.length} ${allPeople.length === 1 ? 'person' : 'people'} in your vault.`
			});

			container.appendChild(listCard);

		} else if (mode === 'families') {
			// Show detected families
			const components = graphService.findAllFamilyComponents();

			const listCard = this.createCard({
				title: `Detected families (${components.length})`,
				icon: 'users',
				subtitle: 'Auto-detected family groups'
			});
			listCard.addClass('crc-collections-list');

			const listContent = listCard.createDiv({ cls: 'crc-card__content' });

			if (components.length === 0) {
				listContent.createEl('p', {
					cls: 'crc-text--muted',
					text: 'No families found. Add some person notes to get started.'
				});
			} else {
				// Paginated table display
				const PAGE_SIZE = 25;
				let displayLimit = PAGE_SIZE;

				const tableContainer = listContent.createDiv({ cls: 'crc-families-table-container' });

				const renderFamiliesTable = () => {
					tableContainer.empty();

					// Create table
					const table = tableContainer.createEl('table', { cls: 'crc-person-table' });
					const thead = table.createEl('thead');
					const headerRow = thead.createEl('tr');
					headerRow.createEl('th', { text: 'Family name', cls: 'crc-person-table__th' });
					headerRow.createEl('th', { text: 'Size', cls: 'crc-person-table__th' });
					headerRow.createEl('th', { text: 'Representative', cls: 'crc-person-table__th' });

					const tbody = table.createEl('tbody');

					// Display only up to displayLimit
					const displayedComponents = components.slice(0, displayLimit);

					displayedComponents.forEach((component, index) => {
						const row = tbody.createEl('tr', { cls: 'crc-person-table__row' });

						// Family name cell
						const nameCell = row.createEl('td', { cls: 'crc-person-table__td crc-person-table__td--name' });
						const familyName = component.collectionName || `Family ${index + 1}`;
						nameCell.createEl('strong', { text: familyName });

						// Size cell
						const sizeCell = row.createEl('td', { cls: 'crc-person-table__td' });
						sizeCell.createEl('span', {
							cls: 'crc-badge',
							text: `${component.size} ${component.size === 1 ? 'person' : 'people'}`
						});

						// Representative cell
						const repCell = row.createEl('td', { cls: 'crc-person-table__td' });
						repCell.textContent = component.representative.name;
					});

					// Footer with count and load more
					const footer = tableContainer.createDiv({ cls: 'crc-place-table-footer crc-mt-2' });

					const countText = footer.createEl('span', {
						cls: 'crc-text-muted crc-text-small'
					});
					countText.textContent = `Showing ${displayedComponents.length} of ${components.length} ${components.length !== 1 ? 'families' : 'family'}`;

					if (components.length > displayLimit) {
						const remaining = components.length - displayLimit;
						const loadMoreBtn = footer.createEl('button', {
							text: `Load more (${Math.min(PAGE_SIZE, remaining)} more)`,
							cls: 'crc-btn crc-btn--small crc-btn--ghost crc-ml-2'
						});
						loadMoreBtn.addEventListener('click', () => {
							displayLimit += PAGE_SIZE;
							renderFamiliesTable();
						});
					}
				};

				renderFamiliesTable();
			}

			container.appendChild(listCard);

		} else if (mode === 'collections') {
			// Show user collections
			const collections = graphService.getUserCollections();

			const listCard = this.createCard({
				title: `My collections (${collections.length})`,
				icon: 'folder',
				subtitle: 'User-defined collections'
			});
			listCard.addClass('crc-collections-list');

			const listContent = listCard.createDiv({ cls: 'crc-card__content' });

			if (collections.length === 0) {
				listContent.createEl('p', {
					cls: 'crc-text--muted',
					text: 'No collections yet. Right-click a person note and select "Set collection" to create one.'
				});
			} else {
				collections.forEach(collection => {
					const collectionItem = listContent.createDiv({ cls: 'crc-collection-item' });

					const collectionHeader = collectionItem.createDiv({ cls: 'crc-collection-header' });
					collectionHeader.createEl('strong', { text: `${collection.name} ` }); // Added space after name
					collectionHeader.createEl('span', {
						cls: 'crc-badge',
						text: `${collection.size} ${collection.size === 1 ? 'person' : 'people'}`
					});
				});
			}

			container.appendChild(listCard);

			// Show cross-collection connections if there are multiple collections
			if (collections.length >= 2) {
				const connections = graphService.detectCollectionConnections();

				if (connections.length > 0) {
					const connectionsCard = this.createCard({
						title: `Collection connections (${connections.length})`,
						icon: 'link',
						subtitle: 'People who bridge multiple collections'
					});
					connectionsCard.addClass('crc-collections-list');

					const connectionsContent = connectionsCard.createDiv({ cls: 'crc-card__content' });

					connections.forEach(connection => {
						const connectionItem = connectionsContent.createDiv({ cls: 'crc-collection-item' });

						const connectionHeader = connectionItem.createDiv({ cls: 'crc-collection-header' });
						connectionHeader.createEl('strong', {
							text: `${connection.fromCollection} ↔ ${connection.toCollection} ` // Added space
						});
						connectionHeader.createEl('span', {
							cls: 'crc-badge',
							text: `${connection.relationshipCount} ${connection.relationshipCount === 1 ? 'link' : 'links'}`
						});

						const bridgeInfo = connectionItem.createDiv({ cls: 'crc-text--muted' });
						const bridgeNames = connection.bridgePeople.map(p => p.name).slice(0, 3).join(', ');
						const remainingCount = connection.bridgePeople.length - 3;
						bridgeInfo.textContent = `Bridge people: ${bridgeNames}${remainingCount > 0 ? ` +${remainingCount} more` : ''}`;
					});

					container.appendChild(connectionsCard);
				}
			}
		}
	}

	/**
	 * Show the Places tab with geographic statistics
	 */
	private showPlacesTab(): void {
		renderPlacesTab(
			this.contentContainer,
			this.plugin,
			this.createCard.bind(this),
			this.showTab.bind(this)
		);
	}

	// ==========================================================================
	// Maps Tab
	// ==========================================================================

	/**
	 * Show the Maps tab content
	 */
	private showMapsTab(): void {
		const container = this.contentContainer;

		// Card 1: World map preview
		const mapViewCard = this.createCard({
			title: 'World map',
			icon: 'map',
			subtitle: 'Interactive geographic visualization'
		});

		const mapViewContent = mapViewCard.querySelector('.crc-card__content') as HTMLElement;

		// Get place data for the map preview and statistics
		const placeService = new PlaceGraphService(this.app);
		placeService.setValueAliases(this.plugin.settings.valueAliases);
		placeService.reloadCache();
		const places = placeService.getAllPlaces();
		const stats = placeService.calculateStatistics();

		// Render the clickable world map preview
		renderWorldMapPreview(mapViewContent, this.app, {
			places,
			onClick: () => {
				this.app.commands.executeCommandById('canvas-roots:open-map-view');
				this.close();
			}
		});

		// Open new map button (for side-by-side comparison)
		new Setting(mapViewContent)
			.setName('Open new map view')
			.setDesc('Open a second map view for side-by-side comparison')
			.addButton(button => button
				.setButtonText('Open new map')
				.onClick(() => {
					this.app.commands.executeCommandById('canvas-roots:open-new-map-view');
					this.close();
				}));

		// Bulk geocode places without coordinates
		const placesWithoutCoords = places.filter(p =>
			!p.coordinates && ['real', 'historical', 'disputed'].includes(p.category)
		);

		if (placesWithoutCoords.length > 0) {
			new Setting(mapViewContent)
				.setName('Bulk geocode places')
				.setDesc(`${placesWithoutCoords.length} place${placesWithoutCoords.length !== 1 ? 's' : ''} without coordinates. Look up using OpenStreetMap.`)
				.addButton(button => button
					.setButtonText('Geocode')
					.onClick(() => {
						new BulkGeocodeModal(this.app, placeService, {
							onComplete: () => {
								// Refresh the Maps tab
								this.showTab('maps');
							}
						}).open();
					}));
		}

		container.appendChild(mapViewCard);

		// Card 2: Custom Maps
		const customMapsCard = this.createCard({
			title: 'Custom maps',
			icon: 'globe',
			subtitle: 'Image maps for fictional worlds'
		});

		const customMapsContent = customMapsCard.querySelector('.crc-card__content') as HTMLElement;

		// Create map button
		new Setting(customMapsContent)
			.setName('Create custom map')
			.setDesc('Create a new map note for a fictional or historical world')
			.addButton(button => button
				.setButtonText('Create map')
				.onClick(() => {
					new CreateMapModal(this.app, {
						directory: this.plugin.settings.mapsFolder,
						propertyAliases: this.plugin.settings.propertyAliases,
						onCreated: () => {
							// Refresh the maps grid after creation
							void this.loadCustomMapsGrid(mapsGridContainer);
						}
					}).open();
				}))
			.addButton(button => button
				.setButtonText('Import JSON')
				.onClick(() => {
					void this.importMapFromJson(mapsGridContainer);
				}));

		// Gallery section with heading
		const gallerySection = customMapsContent.createDiv({ cls: 'cr-map-gallery-section' });
		gallerySection.createEl('h4', { text: 'Gallery', cls: 'cr-map-gallery-heading' });

		// Placeholder for loading maps
		const mapsGridContainer = gallerySection.createDiv();
		mapsGridContainer.createEl('p', {
			text: 'Loading custom maps...',
			cls: 'crc-text--muted'
		});

		container.appendChild(customMapsCard);

		// Load custom maps asynchronously
		void this.loadCustomMapsGrid(mapsGridContainer);

		// Card 3: Visualizations
		const vizCard = this.createCard({
			title: 'Visualizations',
			icon: 'activity',
			subtitle: 'Migration and network diagrams'
		});

		const vizContent = vizCard.querySelector('.crc-card__content') as HTMLElement;

		new Setting(vizContent)
			.setName('Migration diagram')
			.setDesc('Visualize migration patterns from birth to death locations')
			.addButton(button => button
				.setButtonText('View diagram')
				.onClick(() => {
					new MigrationDiagramModal(this.app).open();
				}));

		new Setting(vizContent)
			.setName('Place hierarchy')
			.setDesc('Visualize place relationships as a network diagram')
			.addButton(button => button
				.setButtonText('View hierarchy')
				.onClick(() => {
					new PlaceNetworkModal(this.app).open();
				}));

		container.appendChild(vizCard);

		// Card 4: Place Timeline
		const placeTimelineCard = this.createCard({
			title: 'Place timeline',
			icon: 'map-pin',
			subtitle: 'Events at a location over time'
		});

		const placeTimelineContent = placeTimelineCard.querySelector('.crc-card__content') as HTMLElement;

		const eventService = this.plugin.getEventService();
		if (eventService) {
			renderPlaceTimelineCard(
				placeTimelineContent,
				this.app,
				this.plugin.settings,
				eventService,
				{
					onPlaceSelect: (placeName) => {
						// Could navigate to place on map in future
					}
				}
			);
		} else {
			placeTimelineContent.createEl('p', {
				text: 'Event service not available.',
				cls: 'crc-text--muted'
			});
		}

		container.appendChild(placeTimelineCard);

		// Card 5: Map Statistics
		const statsCard = this.createCard({
			title: 'Map statistics',
			icon: 'bar-chart',
			subtitle: 'Geographic data overview'
		});

		const statsContent = statsCard.querySelector('.crc-card__content') as HTMLElement;
		this.renderMapStatistics(statsContent, stats);

		container.appendChild(statsCard);
	}

	/**
	 * Load custom maps into a thumbnail grid
	 */
	private loadCustomMapsGrid(container: HTMLElement): void {
		container.empty();

		// Find all map notes (cr_type: map in frontmatter)
		const customMaps = this.getCustomMaps();

		if (customMaps.length === 0) {
			const emptyState = container.createDiv({ cls: 'crc-empty-state' });
			emptyState.createEl('p', {
				text: 'No custom maps found.',
				cls: 'crc-text--muted'
			});
			emptyState.createEl('p', {
				text: 'Create a note with cr_type: map in frontmatter to define custom image maps for fictional worlds.',
				cls: 'crc-text--muted crc-text--small'
			});

			// Link to wiki
			const wikiLink = emptyState.createEl('a', {
				text: 'Learn more about custom maps →',
				href: 'https://github.com/banisterious/obsidian-canvas-roots/wiki/Geographic-Features#custom-image-maps',
				cls: 'crc-link external-link crc-mt-2'
			});
			wikiLink.setAttr('target', '_blank');
			return;
		}

		// Create thumbnail grid
		const grid = container.createDiv({ cls: 'cr-map-grid' });

		for (const mapNote of customMaps) {
			const thumbnail = grid.createDiv({ cls: 'cr-map-thumbnail' });

			// Try to load image preview
			if (mapNote.imagePath) {
				const imageFile = this.app.vault.getAbstractFileByPath(mapNote.imagePath);
				if (imageFile instanceof TFile) {
					const imgUrl = this.app.vault.getResourcePath(imageFile);
					const img = thumbnail.createEl('img', {
						attr: {
							src: imgUrl,
							alt: mapNote.name
						}
					});
					img.onerror = () => {
						// Replace with placeholder on error
						img.remove();
						const placeholder = thumbnail.createDiv({ cls: 'cr-map-thumbnail__placeholder' });
						setLucideIcon(placeholder, 'map', 32);
					};
				} else {
					// Image not found - show placeholder
					const placeholder = thumbnail.createDiv({ cls: 'cr-map-thumbnail__placeholder' });
					setLucideIcon(placeholder, 'map', 32);
				}
			} else {
				// No image path - show placeholder
				const placeholder = thumbnail.createDiv({ cls: 'cr-map-thumbnail__placeholder' });
				setLucideIcon(placeholder, 'map', 32);
			}

			// Overlay with name and universe
			const overlay = thumbnail.createDiv({ cls: 'cr-map-thumbnail__overlay' });
			overlay.createDiv({ cls: 'cr-map-thumbnail__name', text: mapNote.name });
			if (mapNote.universe) {
				overlay.createDiv({ cls: 'cr-map-thumbnail__universe', text: mapNote.universe });
			}

			// Action buttons container (stacked vertically on right)
			const actionsContainer = thumbnail.createDiv({ cls: 'cr-map-thumbnail__actions' });

			// Edit button
			const editBtn = actionsContainer.createDiv({ cls: 'cr-map-thumbnail__action-btn' });
			setLucideIcon(editBtn, 'edit', 14);
			editBtn.setAttribute('aria-label', 'Edit map');
			editBtn.addEventListener('click', (e) => {
				e.stopPropagation(); // Prevent thumbnail click
				const file = this.app.vault.getAbstractFileByPath(mapNote.filePath);
				if (file instanceof TFile) {
					const cache = this.app.metadataCache.getFileCache(file);
					const frontmatter = cache?.frontmatter;
					new CreateMapModal(this.app, {
						editFile: file,
						editFrontmatter: frontmatter,
						propertyAliases: this.plugin.settings.propertyAliases,
						onCreated: () => {
							// Refresh the maps grid after editing
							void this.loadCustomMapsGrid(container);
						}
					}).open();
				}
			});

			// Menu button
			const menuBtn = actionsContainer.createDiv({ cls: 'cr-map-thumbnail__action-btn' });
			setLucideIcon(menuBtn, 'more-vertical', 14);
			menuBtn.setAttribute('aria-label', 'More options');
			menuBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.showMapContextMenu(mapNote, container, e);
			});

			// Click to open in Map View with this specific map
			thumbnail.addEventListener('click', () => {
				this.close();
				void this.plugin.activateMapView(mapNote.id);
			});

			// Right-click context menu
			thumbnail.addEventListener('contextmenu', (e) => {
				e.preventDefault();
				this.showMapContextMenu(mapNote, container, e);
			});
		}
	}

	/**
	 * Show context menu for a custom map
	 */
	private showMapContextMenu(
		mapNote: { name: string; filePath: string; imagePath?: string; universe?: string; id?: string },
		gridContainer: HTMLElement,
		event: MouseEvent
	): void {
		const menu = new Menu();

		menu.addItem((item: MenuItem) => {
			item
				.setTitle('Open in map view')
				.setIcon('map')
				.onClick(async () => {
					this.close();
					await this.plugin.activateMapView(mapNote.id);
				});
		});

		menu.addItem((item: MenuItem) => {
			item
				.setTitle('Edit map')
				.setIcon('edit')
				.onClick(() => {
					const file = this.app.vault.getAbstractFileByPath(mapNote.filePath);
					if (file instanceof TFile) {
						const cache = this.app.metadataCache.getFileCache(file);
						const frontmatter = cache?.frontmatter;
						new CreateMapModal(this.app, {
							editFile: file,
							editFrontmatter: frontmatter,
							propertyAliases: this.plugin.settings.propertyAliases,
							onCreated: () => {
								// Refresh the maps grid after editing
								void this.loadCustomMapsGrid(gridContainer);
							}
						}).open();
					}
				});
		});

		menu.addItem((item: MenuItem) => {
			item
				.setTitle('Duplicate map')
				.setIcon('copy')
				.onClick(async () => {
					await this.duplicateMap(mapNote.filePath, gridContainer);
				});
		});

		menu.addItem((item: MenuItem) => {
			item
				.setTitle('Export to JSON')
				.setIcon('download')
				.onClick(async () => {
					await this.exportMapToJson(mapNote.filePath);
				});
		});

		menu.addSeparator();

		menu.addItem((item: MenuItem) => {
			item
				.setTitle('Open note')
				.setIcon('file-text')
				.onClick(async () => {
					const file = this.app.vault.getAbstractFileByPath(mapNote.filePath);
					if (file instanceof TFile) {
						await this.app.workspace.getLeaf(false).openFile(file);
						this.close();
					}
				});
		});

		menu.addItem((item: MenuItem) => {
			item
				.setTitle('Delete map')
				.setIcon('trash')
				.onClick(async () => {
					await this.deleteMap(mapNote.filePath, mapNote.name, gridContainer);
				});
		});

		menu.showAtMouseEvent(event);
	}

	/**
	 * Get all custom map notes from the vault
	 */
	private getCustomMaps(): Array<{
		name: string;
		filePath: string;
		imagePath?: string;
		universe?: string;
		id?: string;
	}> {
		const maps: Array<{
			name: string;
			filePath: string;
			imagePath?: string;
			universe?: string;
			id?: string;
		}> = [];

		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter;

			if (frontmatter?.type === 'map') {
				maps.push({
					name: frontmatter.name || file.basename,
					filePath: file.path,
					imagePath: frontmatter.image || frontmatter.image_path || frontmatter.imagePath,
					universe: frontmatter.universe,
					id: frontmatter.map_id
				});
			}
		}

		// Sort by name
		maps.sort((a, b) => a.name.localeCompare(b.name));

		return maps;
	}

	/**
	 * Duplicate a custom map note
	 */
	private async duplicateMap(filePath: string, gridContainer: HTMLElement): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			new Notice('Map file not found');
			return;
		}

		// Read original file content
		const content = await this.app.vault.read(file);
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;

		if (!frontmatter) {
			new Notice('Could not read map frontmatter');
			return;
		}

		// Generate new name and ID
		const originalName = frontmatter.name || file.basename;
		const newName = `${originalName} (copy)`;
		const originalId = frontmatter.map_id || '';
		const newId = originalId ? `${originalId}-copy` : this.generateMapId(newName);

		// Check if copy already exists, increment suffix if needed
		let finalName = newName;
		let finalId = newId;
		let suffix = 1;
		const parentPath = file.parent?.path || '';

		let testPath = parentPath ? `${parentPath}/${finalName}.md` : `${finalName}.md`;
		while (this.app.vault.getAbstractFileByPath(testPath)) {
			suffix++;
			finalName = `${originalName} (copy ${suffix})`;
			finalId = originalId ? `${originalId}-copy-${suffix}` : this.generateMapId(finalName);
			testPath = parentPath ? `${parentPath}/${finalName}.md` : `${finalName}.md`;
		}

		// Update frontmatter in content
		let newContent = content;

		// Replace name in frontmatter
		if (frontmatter.name) {
			newContent = newContent.replace(
				/^(name:\s*).+$/m,
				`$1${finalName}`
			);
		} else {
			// Add name if not present
			newContent = newContent.replace(
				/^(---\s*\n)/,
				`$1name: ${finalName}\n`
			);
		}

		// Replace map_id in frontmatter
		if (frontmatter.map_id) {
			newContent = newContent.replace(
				/^(map_id:\s*).+$/m,
				`$1${finalId}`
			);
		} else {
			// Add map_id if not present
			newContent = newContent.replace(
				/^(---\s*\n)/,
				`$1map_id: ${finalId}\n`
			);
		}

		// Create new file in same directory
		const newFilePath = parentPath
			? `${parentPath}/${finalName}.md`
			: `${finalName}.md`;

		try {
			const newFile = await this.app.vault.create(newFilePath, newContent);
			new Notice(`Created "${finalName}"`);

			// Refresh the grid
			this.loadCustomMapsGrid(gridContainer);

			// Open the new map in edit mode
			const newCache = this.app.metadataCache.getFileCache(newFile);
			new CreateMapModal(this.app, {
				editFile: newFile,
				editFrontmatter: newCache?.frontmatter,
				propertyAliases: this.plugin.settings.propertyAliases,
				onCreated: () => {
					void this.loadCustomMapsGrid(gridContainer);
				}
			}).open();
		} catch (error) {
			new Notice(`Failed to duplicate map: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Generate a URL-friendly map ID from a name
	 */
	private generateMapId(name: string): string {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');
	}

	/**
	 * Export a custom map's configuration to JSON
	 */
	private async exportMapToJson(filePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			new Notice('Map file not found');
			return;
		}

		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;

		if (!frontmatter) {
			new Notice('Could not read map frontmatter');
			return;
		}

		// Build export object with relevant map properties
		const exportData: Record<string, unknown> = {
			name: frontmatter.name || file.basename,
			map_id: frontmatter.map_id,
			type: 'map',
			universe: frontmatter.universe,
			image: frontmatter.image || frontmatter.image_path || frontmatter.imagePath,
			coordinate_system: frontmatter.coordinate_system || 'geographic',
			exported_at: new Date().toISOString(),
			exported_from: 'Canvas Roots'
		};

		// Add coordinate system specific fields
		if (frontmatter.coordinate_system === 'pixel') {
			exportData.width = frontmatter.width;
			exportData.height = frontmatter.height;
		} else {
			// Geographic bounds
			if (frontmatter.bounds) {
				exportData.bounds = frontmatter.bounds;
			} else {
				exportData.bounds = {
					north: frontmatter.north,
					south: frontmatter.south,
					east: frontmatter.east,
					west: frontmatter.west
				};
			}
		}

		// Add optional fields if present
		if (frontmatter.default_zoom !== undefined) {
			exportData.default_zoom = frontmatter.default_zoom;
		}
		if (frontmatter.min_zoom !== undefined) {
			exportData.min_zoom = frontmatter.min_zoom;
		}
		if (frontmatter.max_zoom !== undefined) {
			exportData.max_zoom = frontmatter.max_zoom;
		}
		if (frontmatter.center) {
			exportData.center = frontmatter.center;
		}

		// Remove undefined values
		const cleanExport = Object.fromEntries(
			Object.entries(exportData).filter(([, v]) => v !== undefined)
		);

		const jsonContent = JSON.stringify(cleanExport, null, 2);

		// Create filename from map name
		const mapName = frontmatter.name || file.basename;
		const safeFileName = mapName.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-');
		const exportFileName = `${safeFileName}-map-export.json`;

		// Save to vault root or Downloads equivalent
		try {
			// Check if file already exists
			const existingFile = this.app.vault.getAbstractFileByPath(exportFileName);
			if (existingFile instanceof TFile) {
				await this.app.vault.modify(existingFile, jsonContent);
			} else if (!existingFile) {
				await this.app.vault.create(exportFileName, jsonContent);
			}
			new Notice(`Exported "${mapName}" to ${exportFileName}`);
		} catch (error) {
			new Notice(`Failed to export: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Import a custom map from a JSON file
	 */
	private importMapFromJson(gridContainer: HTMLElement): void {
		// Create file input element
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';

		input.addEventListener('change', () => void (async () => {
			const file = input.files?.[0];
			if (!file) return;

			try {
				const text = await file.text();
				const data = JSON.parse(text) as Record<string, unknown>;

				// Validate required fields
				if (!data.name || typeof data.name !== 'string') {
					new Notice('Invalid JSON: missing "name" field');
					return;
				}

				// Check for map_id or generate one
				let mapId = data.map_id as string | undefined;
				if (!mapId) {
					mapId = this.generateMapId(data.name);
				}

				// Check if a map with this ID already exists
				const existingMaps = this.getCustomMaps();
				const existingMap = existingMaps.find(m => m.id === mapId);
				if (existingMap) {
					new Notice(`A map with ID "${mapId}" already exists. Please edit the JSON or delete the existing map.`);
					return;
				}

				// Build frontmatter
				const frontmatterLines: string[] = [
					'---',
					'cr_type: map',
					`name: ${data.name}`,
					`map_id: ${mapId}`
				];

				if (data.universe) {
					frontmatterLines.push(`universe: ${toSafeString(data.universe)}`);
				}
				if (data.image) {
					frontmatterLines.push(`image: ${toSafeString(data.image)}`);
				}
				if (data.coordinate_system) {
					frontmatterLines.push(`coordinate_system: ${toSafeString(data.coordinate_system)}`);
				}

				// Handle bounds (geographic) or dimensions (pixel)
				if (data.coordinate_system === 'pixel') {
					if (data.width !== undefined) {
						frontmatterLines.push(`width: ${toSafeString(data.width)}`);
					}
					if (data.height !== undefined) {
						frontmatterLines.push(`height: ${toSafeString(data.height)}`);
					}
				} else {
					// Geographic bounds
					if (data.bounds && typeof data.bounds === 'object') {
						const bounds = data.bounds as Record<string, number>;
						if (bounds.north !== undefined) frontmatterLines.push(`north: ${toSafeString(bounds.north)}`);
						if (bounds.south !== undefined) frontmatterLines.push(`south: ${toSafeString(bounds.south)}`);
						if (bounds.east !== undefined) frontmatterLines.push(`east: ${toSafeString(bounds.east)}`);
						if (bounds.west !== undefined) frontmatterLines.push(`west: ${toSafeString(bounds.west)}`);
					}
				}

				// Optional fields
				if (data.default_zoom !== undefined) {
					frontmatterLines.push(`default_zoom: ${toSafeString(data.default_zoom)}`);
				}
				if (data.min_zoom !== undefined) {
					frontmatterLines.push(`min_zoom: ${toSafeString(data.min_zoom)}`);
				}
				if (data.max_zoom !== undefined) {
					frontmatterLines.push(`max_zoom: ${toSafeString(data.max_zoom)}`);
				}
				if (data.center && typeof data.center === 'object') {
					const center = data.center as Record<string, number>;
					frontmatterLines.push(`center:`);
					if (center.lat !== undefined) frontmatterLines.push(`  lat: ${toSafeString(center.lat)}`);
					if (center.lng !== undefined) frontmatterLines.push(`  lng: ${toSafeString(center.lng)}`);
				}

				frontmatterLines.push('---');
				frontmatterLines.push('');
				frontmatterLines.push(`# ${String(data.name)}`);
				frontmatterLines.push('');
				frontmatterLines.push('*Imported from JSON*');

				const content = frontmatterLines.join('\n');

				// Determine file path - use configured maps folder or vault root
				const mapsDir = this.plugin.settings.mapsFolder || '';
				const safeFileName = String(data.name).replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-');
				const filePath = mapsDir
					? `${mapsDir}/${safeFileName}.md`
					: `${safeFileName}.md`;

				// Check if file already exists
				const existingFile = this.app.vault.getAbstractFileByPath(filePath);
				if (existingFile) {
					new Notice(`File "${filePath}" already exists`);
					return;
				}

				// Ensure directory exists
				if (mapsDir) {
					const folder = this.app.vault.getAbstractFileByPath(mapsDir);
					if (!folder) {
						await this.app.vault.createFolder(mapsDir);
					}
				}

				// Create the file
				await this.app.vault.create(filePath, content);
				new Notice(`Imported "${data.name}" from JSON`);

				// Refresh the grid
				this.loadCustomMapsGrid(gridContainer);

			} catch (error) {
				if (error instanceof SyntaxError) {
					new Notice('Invalid JSON file');
				} else {
					new Notice(`Failed to import: ${getErrorMessage(error)}`);
				}
			}
		})());

		// Trigger file picker
		input.click();
	}

	/**
	 * Delete a custom map note with confirmation
	 */
	private async deleteMap(filePath: string, mapName: string, gridContainer: HTMLElement): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			new Notice('Map file not found');
			return;
		}

		// Show confirmation dialog
		const confirmed = await this.showDeleteConfirmation(mapName);
		if (!confirmed) {
			return;
		}

		try {
			await this.app.fileManager.trashFile(file);
			new Notice(`Deleted "${mapName}"`);
			this.loadCustomMapsGrid(gridContainer);
		} catch (error) {
			new Notice(`Failed to delete: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Show a confirmation dialog for deleting a map
	 */
	private showDeleteConfirmation(mapName: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Delete map');

			modal.contentEl.createEl('p', {
				text: `Are you sure you want to delete "${mapName}"?`
			});
			modal.contentEl.createEl('p', {
				text: 'The map note will be moved to trash. The image file will not be deleted.',
				cls: 'crc-text--muted'
			});

			const buttonContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });

			buttonContainer.createEl('button', { text: 'Cancel' })
				.addEventListener('click', () => {
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
	 * Render map statistics
	 */
	private renderMapStatistics(container: HTMLElement, stats: ReturnType<PlaceGraphService['calculateStatistics']>): void {
		const statsGrid = container.createDiv({ cls: 'crc-stats-grid' });

		// Places with coordinates
		const coordPercent = stats.totalPlaces > 0
			? Math.round((stats.withCoordinates / stats.totalPlaces) * 100)
			: 0;
		this.createStatItem(statsGrid, 'With coordinates', `${stats.withCoordinates}/${stats.totalPlaces} (${coordPercent}%)`, 'globe');

		// Places without coordinates
		const withoutCoords = stats.totalPlaces - stats.withCoordinates;
		this.createStatItem(statsGrid, 'Without coordinates', withoutCoords.toString(), 'map-pin');

		// Universes
		const universeCount = Object.keys(stats.byUniverse).length;
		if (universeCount > 0) {
			this.createStatItem(statsGrid, 'Universes', universeCount.toString(), 'globe');

			// List universes
			const universeSection = container.createDiv({ cls: 'crc-mt-3' });
			universeSection.createEl('h4', { text: 'Universes', cls: 'crc-section-title' });
			const universeList = universeSection.createEl('ul', { cls: 'crc-list' });

			for (const [universe, count] of Object.entries(stats.byUniverse).sort((a, b) => b[1] - a[1])) {
				const item = universeList.createEl('li');
				item.createEl('span', { text: universe });
				item.createEl('span', { text: ` (${count} places)`, cls: 'crc-text--muted' });
			}
		}

		// View full statistics link
		const statsLink = container.createDiv({ cls: 'cr-stats-link' });
		const link = statsLink.createEl('a', { text: 'View full statistics →', cls: 'crc-text-muted' });
		link.addEventListener('click', (e) => {
			e.preventDefault();
			this.close();
			void this.plugin.activateStatisticsView();
		});
	}

	/**
	 * Quick-create a single place note from an unlinked place name
	 */
	private showQuickCreatePlaceModal(placeName: string): void {
		const modal = new CreatePlaceModal(this.app, {
			directory: this.plugin.settings.placesFolder || '',
			initialName: placeName,
			familyGraph: this.plugin.createFamilyGraphService(),
			placeGraph: new PlaceGraphService(this.app),
			settings: this.plugin.settings,
			onCreated: () => {
				new Notice(`Created place note: ${placeName}`);
				// Refresh the Places tab
				this.showTab('places');
			}
		});
		modal.open();
	}

	/**
	 * Create a stat item for the statistics grid
	 */
	private createStatItem(container: HTMLElement, label: string, value: string, icon?: LucideIconName): void {
		const item = container.createDiv({ cls: 'crc-stat-item' });

		if (icon) {
			const iconEl = createLucideIcon(icon, 16);
			iconEl.addClass('crc-stat-icon');
			item.appendChild(iconEl);
		}

		const content = item.createDiv({ cls: 'crc-stat-content' });
		content.createEl('div', { text: value, cls: 'crc-stat-value' });
		content.createEl('div', { text: label, cls: 'crc-stat-label' });
	}

	// ============================================
	// SCHEMAS TAB
	// ============================================

	/**
	 * State for Schemas tab
	 */
	private lastValidationResults: ValidationResult[] = [];
	private lastValidationSummary: ValidationSummary | null = null;

	/**
	 * Show Schemas tab with validation controls and schema gallery
	 */
	private async showSchemasTab(): Promise<void> {
		const container = this.contentContainer;

		// Initialize services
		const schemaService = new SchemaService(this.plugin);
		const validationService = new ValidationService(this.plugin, schemaService);

		// Card 1: Validation
		const validationCard = this.createCard({
			title: 'Validate vault',
			icon: 'clipboard-check',
			subtitle: 'Check person notes against your schemas'
		});

		const validationContent = validationCard.querySelector('.crc-card__content') as HTMLElement;

		// Explanation for users
		const explanation = validationContent.createDiv({ cls: 'crc-info-callout crc-mb-3' });
		explanation.createEl('p', {
			text: 'Schema validation checks your person notes against rules you define. ' +
				'Use it to ensure required properties are filled in, values are the correct type, ' +
				'and data follows your standards.',
			cls: 'crc-text--small'
		});

		// Check if there are any schemas
		const hasSchemas = await schemaService.getAllSchemas().then(s => s.length > 0);
		if (!hasSchemas) {
			const noSchemasNote = validationContent.createDiv({ cls: 'crc-empty-state crc-compact' });
			setIcon(noSchemasNote.createSpan({ cls: 'crc-empty-icon' }), 'info');
			noSchemasNote.createEl('p', {
				text: 'No schemas defined yet. Create a schema below to start validating your data.',
				cls: 'crc-text--muted'
			});
			container.appendChild(validationCard);
		}

		// Only show validation controls if schemas exist
		if (hasSchemas) {
			// Show last validation summary if available
			if (this.lastValidationSummary) {
				const summaryDiv = validationContent.createDiv({ cls: 'crc-validation-summary crc-mb-3' });
				const summary = this.lastValidationSummary;

				const statsRow = summaryDiv.createDiv({ cls: 'crc-stats-row' });
				statsRow.createEl('span', {
					text: `Last validated: ${summary.validatedAt.toLocaleString()}`,
					cls: 'crc-text--muted crc-text--small'
				});

				const statsGrid = summaryDiv.createDiv({ cls: 'crc-stats-grid crc-mt-2' });
				this.createStatItem(statsGrid, 'People', summary.totalPeopleValidated.toString(), 'users');
				this.createStatItem(statsGrid, 'Schemas', summary.totalSchemas.toString(), 'clipboard-check');
				this.createStatItem(statsGrid, 'Errors', summary.totalErrors.toString(), summary.totalErrors > 0 ? 'alert-circle' : 'check');
				this.createStatItem(statsGrid, 'Warnings', summary.totalWarnings.toString(), 'alert-triangle');
			}

			// Validate vault button
			new Setting(validationContent)
				.setName('Run validation')
				.setDesc('Check all person notes against your schemas')
				.addButton(button => button
					.setButtonText('Validate')
					.setCta()
					.onClick(() => void (async () => {
				// Open progress modal
				const progressModal = new SchemaValidationProgressModal(this.app);
				progressModal.open();

				try {
					// Run validation with progress callback
					this.lastValidationResults = await validationService.validateVault(
						(progress) => progressModal.updateProgress(progress)
					);
					this.lastValidationSummary = validationService.getSummary(this.lastValidationResults);

					// Mark complete and close after a short delay
					progressModal.markComplete(this.lastValidationSummary);
					setTimeout(() => {
						progressModal.close();
						// Refresh the tab to show updated results
						void this.showSchemasTab();
					}, 1500);

					const errorCount = this.lastValidationSummary.totalErrors;
					if (errorCount === 0) {
						new Notice('✓ Validation passed! No schema violations found.');
					} else {
						new Notice(`Found ${errorCount} validation error${errorCount === 1 ? '' : 's'}`);
					}
				} catch (error) {
					progressModal.close();
					new Notice('Validation failed: ' + getErrorMessage(error));
				}
			})()));
		}

		container.appendChild(validationCard);

		// Card 2: Schemas Gallery
		const schemasCard = this.createCard({
			title: 'Schemas',
			icon: 'file-check',
			subtitle: 'Define validation rules for person notes'
		});

		const schemasContent = schemasCard.querySelector('.crc-card__content') as HTMLElement;

		// Create schema button
		new Setting(schemasContent)
			.setName('Create schema')
			.setDesc('Define a new validation schema for person notes')
			.addButton(button => button
				.setButtonText('Create')
				.setCta()
				.onClick(() => {
					new CreateSchemaModal(this.app, this.plugin, {
						onCreated: () => {
							void this.loadSchemasGallery(schemaService, schemasGridContainer);
						}
					}).open();
				}));

		// Import schema button
		new Setting(schemasContent)
			.setName('Import schema')
			.setDesc('Import a schema from a JSON file')
			.addButton(button => button
				.setButtonText('Import')
				.onClick(() => {
					void this.importSchemaFromJson(schemaService, schemasGridContainer);
				}));

		// Gallery section
		const gallerySection = schemasContent.createDiv({ cls: 'cr-schema-gallery-section' });
		gallerySection.createEl('h4', { text: 'Gallery', cls: 'cr-schema-gallery-heading' });

		const schemasGridContainer = gallerySection.createDiv();
		schemasGridContainer.createEl('p', {
			text: 'Loading schemas...',
			cls: 'crc-text--muted'
		});

		container.appendChild(schemasCard);

		// Load schemas asynchronously
		void this.loadSchemasGallery(schemaService, schemasGridContainer);

		// Card 3: Recent Violations
		if (this.lastValidationResults.length > 0) {
			const violationsCard = this.createCard({
				title: 'Recent violations',
				icon: 'alert-circle',
				subtitle: 'Issues found in last validation'
			});

			const violationsContent = violationsCard.querySelector('.crc-card__content') as HTMLElement;
			this.renderRecentViolations(violationsContent);

			container.appendChild(violationsCard);
		}

		// Card 4: Schema Statistics
		const statsCard = this.createCard({
			title: 'Statistics',
			icon: 'bar-chart',
			subtitle: 'Schema overview'
		});

		const statsContent = statsCard.querySelector('.crc-card__content') as HTMLElement;
		await this.renderSchemaStatistics(statsContent, schemaService);

		container.appendChild(statsCard);
	}

	/**
	 * Load schemas into the gallery
	 */
	private async loadSchemasGallery(schemaService: SchemaService, container: HTMLElement): Promise<void> {
		container.empty();

		const schemas = await schemaService.getAllSchemas();

		if (schemas.length === 0) {
			const emptyState = container.createDiv({ cls: 'crc-empty-state' });
			emptyState.createEl('p', {
				text: 'No schemas found.',
				cls: 'crc-text--muted'
			});
			emptyState.createEl('p', {
				text: 'Create a schema to define validation rules for person notes.',
				cls: 'crc-text--muted crc-text--small'
			});
			return;
		}

		// Create list of schemas
		const list = container.createEl('ul', { cls: 'crc-schema-list' });

		for (const schema of schemas) {
			const item = list.createEl('li', { cls: 'crc-schema-list-item' });

			// Schema info
			const info = item.createDiv({ cls: 'crc-schema-info' });
			const nameRow = info.createDiv({ cls: 'crc-schema-name-row' });

			nameRow.createEl('span', { text: schema.name, cls: 'crc-schema-name' });

			// Scope badge
			nameRow.createEl('span', {
				text: this.formatSchemaScope(schema),
				cls: 'crc-badge crc-badge--muted'
			});

			if (schema.description) {
				info.createEl('div', { text: schema.description, cls: 'crc-schema-desc crc-text--muted crc-text--small' });
			}

			// Properties count
			const propCount = Object.keys(schema.definition.properties).length;
			const reqCount = schema.definition.requiredProperties.length;
			const constraintCount = schema.definition.constraints.length;
			info.createEl('div', {
				text: `${propCount} properties, ${reqCount} required, ${constraintCount} constraints`,
				cls: 'crc-text--muted crc-text--small'
			});

			// Action buttons
			const actions = item.createDiv({ cls: 'crc-schema-actions' });

			// Edit button
			const editBtn = actions.createEl('button', {
				cls: 'crc-btn crc-btn--icon',
				attr: { 'aria-label': 'Edit schema' }
			});
			setLucideIcon(editBtn, 'edit', 14);
			editBtn.addEventListener('click', () => {
				new CreateSchemaModal(this.app, this.plugin, {
					editSchema: schema,
					onUpdated: () => {
						void this.loadSchemasGallery(schemaService, container);
					}
				}).open();
			});

			// More options button
			const moreBtn = actions.createEl('button', {
				cls: 'crc-btn crc-btn--icon',
				attr: { 'aria-label': 'More options' }
			});
			setLucideIcon(moreBtn, 'more-vertical', 14);
			moreBtn.addEventListener('click', (e) => {
				this.showSchemaContextMenu(schema, schemaService, container, e);
			});

			// Click to open note
			item.addEventListener('click', (e) => {
				if ((e.target as HTMLElement).closest('.crc-schema-actions')) return;
				const file = this.app.vault.getAbstractFileByPath(schema.filePath);
				if (file instanceof TFile) {
					void this.app.workspace.getLeaf(false).openFile(file);
					this.close();
				}
			});
		}
	}

	/**
	 * Format schema scope for display
	 */
	private formatSchemaScope(schema: SchemaNote): string {
		switch (schema.appliesToType) {
			case 'all':
				return 'All people';
			case 'collection':
				return `Collection: ${schema.appliesToValue}`;
			case 'folder':
				return `Folder: ${schema.appliesToValue}`;
			case 'universe':
				return `Universe: ${schema.appliesToValue}`;
			default:
				return schema.appliesToType;
		}
	}

	/**
	 * Show context menu for a schema
	 */
	private showSchemaContextMenu(
		schema: SchemaNote,
		schemaService: SchemaService,
		galleryContainer: HTMLElement,
		event: MouseEvent
	): void {
		const menu = new Menu();

		menu.addItem((item: MenuItem) => {
			item
				.setTitle('Edit schema')
				.setIcon('edit')
				.onClick(() => {
					new CreateSchemaModal(this.app, this.plugin, {
						editSchema: schema,
						onUpdated: () => {
							void this.loadSchemasGallery(schemaService, galleryContainer);
						}
					}).open();
				});
		});

		menu.addItem((item: MenuItem) => {
			item
				.setTitle('Validate matching notes')
				.setIcon('play')
				.onClick(() => {
					new Notice(`Validating notes matching schema: ${schema.name}...`);
					// TODO: Implement targeted validation
				});
		});

		menu.addItem((item: MenuItem) => {
			item
				.setTitle('Duplicate schema')
				.setIcon('copy')
				.onClick(async () => {
					try {
						await schemaService.duplicateSchema(schema.cr_id);
						new Notice(`Schema duplicated: ${schema.name} (Copy)`);
						void this.loadSchemasGallery(schemaService, galleryContainer);
					} catch (error) {
						new Notice('Failed to duplicate schema: ' + getErrorMessage(error));
					}
				});
		});

		menu.addItem((item: MenuItem) => {
			item
				.setTitle('Export to JSON')
				.setIcon('download')
				.onClick(async () => {
					try {
						const json = await schemaService.exportSchemaAsJson(schema.cr_id);
						await navigator.clipboard.writeText(json);
						new Notice('Schema JSON copied to clipboard');
					} catch (error) {
						new Notice('Failed to export schema: ' + getErrorMessage(error));
					}
				});
		});

		menu.addSeparator();

		menu.addItem((item: MenuItem) => {
			item
				.setTitle('Open note')
				.setIcon('file-text')
				.onClick(async () => {
					const file = this.app.vault.getAbstractFileByPath(schema.filePath);
					if (file instanceof TFile) {
						await this.app.workspace.getLeaf(false).openFile(file);
						this.close();
					}
				});
		});

		menu.addItem((item: MenuItem) => {
			item
				.setTitle('Delete schema')
				.setIcon('trash')
				.onClick(async () => {
					const confirmed = await this.confirmSchemaDelete(schema.name);
					if (confirmed) {
						try {
							await schemaService.deleteSchema(schema.cr_id);
							new Notice(`Schema deleted: ${schema.name}`);
							void this.loadSchemasGallery(schemaService, galleryContainer);
						} catch (error) {
							new Notice('Failed to delete schema: ' + getErrorMessage(error));
						}
					}
				});
		});

		menu.showAtMouseEvent(event);
	}

	/**
	 * Confirm schema deletion
	 */
	private async confirmSchemaDelete(schemaName: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Delete schema?');

			modal.contentEl.createEl('p', {
				text: `Are you sure you want to delete the schema "${schemaName}"?`
			});
			modal.contentEl.createEl('p', {
				text: 'This will delete the schema note file. This action cannot be undone.',
				cls: 'crc-text--muted'
			});

			const buttonContainer = modal.contentEl.createDiv({ cls: 'crc-button-row crc-mt-3' });

			const cancelBtn = buttonContainer.createEl('button', {
				text: 'Cancel',
				cls: 'crc-btn'
			});
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
	 * Import a schema from JSON
	 */
	private importSchemaFromJson(schemaService: SchemaService, galleryContainer: HTMLElement): void {
		const modal = new Modal(this.app);
		modal.titleEl.setText('Import schema from JSON');

		const textarea = modal.contentEl.createEl('textarea', {
			cls: 'crc-form-textarea crc-form-textarea--code',
			attr: {
				placeholder: 'Paste schema JSON here...',
				rows: '10'
			}
		});

		const buttonContainer = modal.contentEl.createDiv({ cls: 'crc-button-row crc-mt-3' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => modal.close());

		const importBtn = buttonContainer.createEl('button', {
			text: 'Import',
			cls: 'crc-btn crc-btn--primary'
		});
		importBtn.addEventListener('click', () => void (async () => {
			const json = textarea.value.trim();
			if (!json) {
				new Notice('Please paste schema JSON');
				return;
			}

			try {
				await schemaService.importSchemaFromJson(json);
				new Notice('Schema imported successfully');
				modal.close();
				void this.loadSchemasGallery(schemaService, galleryContainer);
			} catch (error) {
				new Notice('Failed to import schema: ' + getErrorMessage(error));
			}
		})());

		modal.open();
	}

	/**
	 * Render recent validation violations
	 */
	private renderRecentViolations(container: HTMLElement): void {
		const invalidResults = this.lastValidationResults.filter(r => !r.isValid);

		if (invalidResults.length === 0) {
			container.createEl('p', {
				text: 'No violations found in last validation.',
				cls: 'crc-text--muted'
			});
			return;
		}

		// Show top 10 violations
		const topViolations = invalidResults.slice(0, 10);
		const list = container.createEl('ul', { cls: 'crc-violations-list' });

		for (const result of topViolations) {
			const item = list.createEl('li', { cls: 'crc-violation-item crc-clickable' });

			const header = item.createDiv({ cls: 'crc-violation-header' });
			header.createEl('span', { text: result.personName, cls: 'crc-violation-person' });
			header.createEl('span', {
				text: `(${result.schemaName})`,
				cls: 'crc-text--muted crc-text--small'
			});

			const errorList = item.createEl('ul', { cls: 'crc-error-list' });
			for (const error of result.errors.slice(0, 3)) {
				errorList.createEl('li', {
					text: error.message,
					cls: 'crc-text--error crc-text--small'
				});
			}

			if (result.errors.length > 3) {
				errorList.createEl('li', {
					text: `... and ${result.errors.length - 3} more`,
					cls: 'crc-text--muted crc-text--small'
				});
			}

			// Click to open person note
			item.addEventListener('click', () => {
				const file = this.app.vault.getAbstractFileByPath(result.filePath);
				if (file instanceof TFile) {
					void this.app.workspace.getLeaf(false).openFile(file);
					this.close();
				}
			});
		}

		if (invalidResults.length > 10) {
			container.createEl('p', {
				text: `... and ${invalidResults.length - 10} more violations`,
				cls: 'crc-text--muted crc-mt-2'
			});
		}

		// Link to Data Quality tab
		const linkDiv = container.createDiv({ cls: 'crc-mt-2' });
		const viewAllLink = linkDiv.createEl('a', {
			text: 'View all in data quality →',
			cls: 'crc-link'
		});
		viewAllLink.addEventListener('click', () => {
			this.switchTab('data-quality');
		});
	}

	/**
	 * Render schema statistics
	 */
	private async renderSchemaStatistics(container: HTMLElement, schemaService: SchemaService): Promise<void> {
		const stats = await schemaService.getStats();

		const statsGrid = container.createDiv({ cls: 'crc-stats-grid' });

		this.createStatItem(statsGrid, 'Total schemas', stats.totalSchemas.toString(), 'clipboard-check');
		this.createStatItem(statsGrid, 'Global (all)', stats.byScope.all.toString(), 'globe');
		this.createStatItem(statsGrid, 'By collection', stats.byScope.collection.toString(), 'folder');
		this.createStatItem(statsGrid, 'By folder', stats.byScope.folder.toString(), 'folder');
		this.createStatItem(statsGrid, 'By universe', stats.byScope.universe.toString(), 'globe');

		// Error breakdown from last validation
		if (this.lastValidationSummary && this.lastValidationSummary.totalErrors > 0) {
			container.createEl('h4', { text: 'Error types from last validation', cls: 'crc-section-title crc-mt-3' });

			const errorGrid = container.createDiv({ cls: 'crc-stats-grid' });
			const errorsByType = this.lastValidationSummary.errorsByType;

			if (errorsByType.missing_required > 0) {
				this.createStatItem(errorGrid, 'Missing required', errorsByType.missing_required.toString(), 'alert-circle');
			}
			if (errorsByType.invalid_type > 0) {
				this.createStatItem(errorGrid, 'Invalid type', errorsByType.invalid_type.toString(), 'alert-circle');
			}
			if (errorsByType.invalid_enum > 0) {
				this.createStatItem(errorGrid, 'Invalid enum', errorsByType.invalid_enum.toString(), 'alert-circle');
			}
			if (errorsByType.out_of_range > 0) {
				this.createStatItem(errorGrid, 'Out of range', errorsByType.out_of_range.toString(), 'alert-circle');
			}
			if (errorsByType.constraint_failed > 0) {
				this.createStatItem(errorGrid, 'Constraint failed', errorsByType.constraint_failed.toString(), 'alert-circle');
			}
			if (errorsByType.conditional_required > 0) {
				this.createStatItem(errorGrid, 'Conditional required', errorsByType.conditional_required.toString(), 'alert-circle');
			}
			if (errorsByType.invalid_wikilink_target > 0) {
				this.createStatItem(errorGrid, 'Invalid wikilink', errorsByType.invalid_wikilink_target.toString(), 'alert-circle');
			}
		}
	}

	/**
	 * Render research gaps section in Data Quality tab
	 * Shows summary of unsourced facts aligned with GPS methodology
	 */
	private renderResearchGapsSection(container: HTMLElement): void {
		// Create card for Research Gaps
		const card = this.createCard({
			title: 'Research gaps',
			icon: 'search',
			subtitle: 'Track unsourced and weakly sourced facts'
		});
		const section = card.querySelector('.crc-card__content') as HTMLElement;
		section.addClass('crc-research-gaps-section');

		// Explanation
		const explanation = section.createDiv({ cls: 'crc-info-callout crc-mb-3' });
		explanation.createEl('p', {
			text: 'Identify facts that need sources or stronger evidence. Focus research efforts on gaps in your documentation.',
			cls: 'crc-text--small'
		});

		// Header actions
		const header = section.createDiv({ cls: 'crc-section-header' });

		const headerActions = header.createDiv({ cls: 'crc-section-header-actions' });

		// Export button
		const exportBtn = headerActions.createEl('button', {
			cls: 'crc-icon-button',
			attr: { 'aria-label': 'Export research gaps to CSV' }
		});
		setIcon(exportBtn, 'download');
		exportBtn.addEventListener('click', () => {
			this.exportResearchGapsToCSV();
		});

		const sourcesLink = headerActions.createEl('button', {
			cls: 'crc-link-button',
			text: 'Open sources tab'
		});
		setIcon(sourcesLink.createSpan({ cls: 'crc-button-icon-right' }), 'external-link');
		sourcesLink.addEventListener('click', () => {
			this.showTab('sources');
		});

		// Get research gaps data
		const evidenceService = new EvidenceService(this.app, this.plugin.settings);
		const gaps = evidenceService.getResearchGaps(10);

		// Summary stats
		const statsRow = section.createDiv({ cls: 'crc-schema-summary-row' });

		// People tracked
		const trackedStat = statsRow.createDiv({ cls: 'crc-schema-stat' });
		setIcon(trackedStat.createSpan({ cls: 'crc-schema-stat-icon' }), 'users');
		trackedStat.createSpan({
			text: `${gaps.totalPeopleTracked} tracked`,
			cls: 'crc-schema-stat-text'
		});

		// Count total unsourced
		const totalUnsourced = Object.values(gaps.unsourcedByFact).reduce((a, b) => a + b, 0);
		const unsourcedStat = statsRow.createDiv({ cls: 'crc-schema-stat crc-schema-stat-warning' });
		setIcon(unsourcedStat.createSpan({ cls: 'crc-schema-stat-icon' }), 'alert-triangle');
		unsourcedStat.createSpan({
			text: `${totalUnsourced} unsourced facts`,
			cls: 'crc-schema-stat-text'
		});

		// Count weakly sourced
		const totalWeakly = Object.values(gaps.weaklySourcedByFact).reduce((a, b) => a + b, 0);
		const weaklyStat = statsRow.createDiv({ cls: 'crc-schema-stat crc-schema-stat-info' });
		setIcon(weaklyStat.createSpan({ cls: 'crc-schema-stat-icon' }), 'info');
		weaklyStat.createSpan({
			text: `${totalWeakly} weakly sourced`,
			cls: 'crc-schema-stat-text'
		});

		// Quality filter dropdown
		const filterRow = section.createDiv({ cls: 'crc-filter-row' });
		filterRow.createSpan({ text: 'Filter by:', cls: 'crc-filter-label' });
		const qualityFilter = filterRow.createEl('select', { cls: 'dropdown crc-filter-select' });
		qualityFilter.createEl('option', { value: 'all', text: 'All research gaps' });
		qualityFilter.createEl('option', { value: 'unsourced', text: 'Unsourced only' });
		qualityFilter.createEl('option', { value: 'weakly-sourced', text: 'Weakly sourced only' });
		qualityFilter.createEl('option', { value: 'needs-primary', text: 'Needs primary source' });

		// Store current filter state
		let currentQualityFilter = 'all';

		// Re-render function for when filter changes
		const rerenderBreakdown = (): void => {
			// Remove existing breakdown and people sections
			section.querySelectorAll('.crc-research-gaps-breakdown, .crc-research-gaps-lowest').forEach(el => el.remove());

			// Filter data based on selection
			const filteredGaps = this.filterResearchGapsByQuality(gaps, currentQualityFilter);

			// Render breakdown
			this.renderResearchGapsBreakdown(section, filteredGaps, currentQualityFilter);

			// Render lowest coverage people
			this.renderLowestCoveragePeople(section, filteredGaps.lowestCoverage, evidenceService, currentQualityFilter);
		};

		qualityFilter.addEventListener('change', () => {
			currentQualityFilter = qualityFilter.value;
			rerenderBreakdown();
		});

		// If no tracking data, show empty state
		if (gaps.totalPeopleTracked === 0 && gaps.totalPeopleUntracked > 0) {
			const emptyState = section.createDiv({ cls: 'crc-empty-state crc-compact' });
			setIcon(emptyState.createSpan({ cls: 'crc-empty-icon' }), 'file-search');
			emptyState.createEl('p', {
				text: `No fact-level source tracking data found. Add sourced_facts to your person notes to track research coverage.`
			});
			container.appendChild(card);
			return;
		}

		// Render initial breakdown and people list
		this.renderResearchGapsBreakdown(section, gaps, 'all');
		this.renderLowestCoveragePeople(section, gaps.lowestCoverage, evidenceService, 'all');

		container.appendChild(card);
	}

	/**
	 * Render source conflicts section
	 * Shows proofs with conflicting evidence that need resolution
	 */
	private renderSourceConflictsSection(container: HTMLElement): void {
		const proofService = new ProofSummaryService(this.app, this.plugin.settings);
		const conflictedProofs = proofService.getProofsByStatus('conflicted');

		// Create card for Source Conflicts
		const card = this.createCard({
			title: 'Source conflicts',
			icon: 'scale',
			subtitle: 'Resolve conflicting evidence in your research'
		});
		const section = card.querySelector('.crc-card__content') as HTMLElement;
		section.addClass('crc-conflicts-section');

		// Explanation
		const explanation = section.createDiv({ cls: 'crc-info-callout crc-mb-3' });
		explanation.createEl('p', {
			text: 'Track and resolve cases where multiple sources provide conflicting information about the same fact.',
			cls: 'crc-text--small'
		});

		// Summary stats
		const statsRow = section.createDiv({ cls: 'crc-schema-summary-row' });

		// Count of conflicted proofs
		const conflictStat = statsRow.createDiv({
			cls: `crc-schema-stat ${conflictedProofs.length > 0 ? 'crc-schema-stat-warning' : ''}`
		});
		const conflictIcon = conflictStat.createSpan({ cls: 'crc-schema-stat-icon' });
		setIcon(conflictIcon, conflictedProofs.length > 0 ? 'alert-triangle' : 'check');
		conflictStat.createSpan({
			text: `${conflictedProofs.length} unresolved conflict${conflictedProofs.length !== 1 ? 's' : ''}`,
			cls: 'crc-schema-stat-text'
		});

		// Total proofs
		const allProofs = proofService.getAllProofs();
		const proofStat = statsRow.createDiv({ cls: 'crc-schema-stat' });
		const proofIcon = proofStat.createSpan({ cls: 'crc-schema-stat-icon' });
		setIcon(proofIcon, 'scale');
		proofStat.createSpan({
			text: `${allProofs.length} proof summar${allProofs.length !== 1 ? 'ies' : 'y'}`,
			cls: 'crc-schema-stat-text'
		});

		// Empty state if no proofs
		if (allProofs.length === 0) {
			const emptyState = section.createDiv({ cls: 'crc-empty-state crc-compact' });
			const emptyIcon = emptyState.createSpan({ cls: 'crc-empty-icon' });
			setIcon(emptyIcon, 'scale');
			emptyState.createEl('p', {
				text: 'No proof summaries created yet. Use proof summaries to document your research reasoning and resolve conflicting evidence.'
			});

			// Buttons container
			const buttonRow = emptyState.createDiv({ cls: 'crc-empty-state-buttons' });

			// Create proof button
			const createBtn = buttonRow.createEl('button', {
				cls: 'crc-btn crc-btn--primary',
				text: 'Create proof summary'
			});
			createBtn.addEventListener('click', () => {
				new CreateProofModal(this.app, this.plugin, {
					onSuccess: () => {
						this.showDataQualityTab();
					}
				}).open();
			});

			// View templates button
			const templateBtn = buttonRow.createEl('button', {
				cls: 'crc-btn',
				text: 'View templates'
			});
			const templateIcon = createLucideIcon('file-code', 14);
			templateBtn.insertBefore(templateIcon, templateBtn.firstChild);
			templateBtn.addEventListener('click', () => {
				new TemplateSnippetsModal(this.app, 'proof', this.plugin.settings.propertyAliases).open();
			});

			container.appendChild(card);
			return;
		}

		// If no conflicts, show success state
		if (conflictedProofs.length === 0) {
			const successState = section.createDiv({ cls: 'crc-dq-no-issues' });
			const successIcon = successState.createDiv({ cls: 'crc-dq-no-issues-icon' });
			setIcon(successIcon, 'check');
			successState.createSpan({ text: 'No unresolved source conflicts' });
			container.appendChild(card);
			return;
		}

		// Show conflicted proofs
		const conflictList = section.createDiv({ cls: 'crc-conflicts-list' });

		for (const proof of conflictedProofs) {
			this.renderConflictItem(conflictList, proof);
		}

		container.appendChild(card);
	}

	/**
	 * Render a single conflict item
	 */
	private renderConflictItem(container: HTMLElement, proof: ProofSummaryNote): void {
		const item = container.createDiv({ cls: 'crc-conflict-item' });

		// Header with alert icon
		const header = item.createDiv({ cls: 'crc-conflict-item-header' });
		const alertIcon = header.createSpan({ cls: 'crc-conflict-icon' });
		setIcon(alertIcon, 'alert-triangle');

		// Title (clickable)
		const title = header.createSpan({ cls: 'crc-conflict-title', text: proof.title });
		title.addEventListener('click', () => {
			void this.app.workspace.openLinkText(proof.filePath, '', true);
		});

		// Fact type badge
		header.createSpan({
			cls: 'crc-proof-badge',
			text: FACT_KEY_LABELS[proof.factType]
		});

		// Subject person
		const personRow = item.createDiv({ cls: 'crc-conflict-person' });
		const personIcon = personRow.createSpan();
		setIcon(personIcon, 'user');
		personRow.createSpan({ text: proof.subjectPerson.replace(/\[\[|\]\]/g, '') });

		// Conflicting evidence
		const evidenceSection = item.createDiv({ cls: 'crc-conflict-evidence' });
		evidenceSection.createSpan({ cls: 'crc-conflict-evidence-label', text: 'Conflicting evidence:' });

		const evidenceList = evidenceSection.createDiv({ cls: 'crc-conflict-evidence-list' });

		for (const ev of proof.evidence) {
			const evItem = evidenceList.createDiv({
				cls: `crc-conflict-evidence-item ${ev.supports === 'conflicts' ? 'crc-conflict-evidence-item--conflicts' : ''}`
			});

			// Support indicator
			const supportIcon = evItem.createSpan({ cls: 'crc-conflict-support-icon' });
			if (ev.supports === 'conflicts') {
				setIcon(supportIcon, 'x');
			} else {
				setIcon(supportIcon, 'check');
			}

			// Source name
			evItem.createSpan({
				cls: 'crc-conflict-source',
				text: ev.source.replace(/\[\[|\]\]/g, '')
			});

			// Information (claim)
			if (ev.information) {
				evItem.createSpan({
					cls: 'crc-conflict-claim',
					text: `: "${ev.information}"`
				});
			}
		}

		// Resolve button
		const actions = item.createDiv({ cls: 'crc-conflict-actions' });
		const resolveBtn = actions.createEl('button', {
			cls: 'crc-btn crc-btn--small',
			text: 'Open to resolve'
		});
		resolveBtn.addEventListener('click', () => {
			void this.app.workspace.openLinkText(proof.filePath, '', true);
		});
	}

	/**
	 * Filter research gaps data by quality level
	 */
	private filterResearchGapsByQuality(
		gaps: ResearchGapsSummary,
		filter: string
	): ResearchGapsSummary {
		if (filter === 'all') {
			return gaps;
		}

		// Create filtered copy
		const filtered: ResearchGapsSummary = {
			totalPeopleTracked: gaps.totalPeopleTracked,
			totalPeopleUntracked: gaps.totalPeopleUntracked,
			unsourcedByFact: { ...gaps.unsourcedByFact },
			weaklySourcedByFact: { ...gaps.weaklySourcedByFact },
			lowestCoverage: []
		};

		// Filter the people list based on selected criteria
		for (const person of gaps.lowestCoverage) {
			const hasMatchingGap = person.facts.some(fact => {
				switch (filter) {
					case 'unsourced':
						return fact.status === 'unsourced';
					case 'weakly-sourced':
						return fact.status === 'weakly-sourced';
					case 'needs-primary':
						// Any fact that doesn't have a primary source
						return fact.bestQuality !== 'primary';
					default:
						return true;
				}
			});

			if (hasMatchingGap) {
				filtered.lowestCoverage.push(person);
			}
		}

		return filtered;
	}

	/**
	 * Render research gaps breakdown by fact type
	 */
	private renderResearchGapsBreakdown(
		container: HTMLElement,
		gaps: ResearchGapsSummary,
		filter: string
	): void {
		// Determine which counts to show based on filter
		let factCounts: Record<FactKey, number>;
		let title: string;

		switch (filter) {
			case 'unsourced':
				factCounts = gaps.unsourcedByFact;
				title = 'Unsourced facts by type';
				break;
			case 'weakly-sourced':
				factCounts = gaps.weaklySourcedByFact;
				title = 'Weakly sourced facts by type';
				break;
			case 'needs-primary':
				// Combine unsourced + weakly sourced for "needs primary"
				factCounts = {} as Record<FactKey, number>;
				for (const key of FACT_KEYS) {
					factCounts[key] = (gaps.unsourcedByFact[key] || 0) + (gaps.weaklySourcedByFact[key] || 0);
				}
				title = 'Facts needing primary sources';
				break;
			default: // 'all'
				factCounts = gaps.unsourcedByFact;
				title = 'Unsourced facts by type';
		}

		const totalCount = Object.values(factCounts).reduce((a, b) => a + b, 0);
		if (totalCount === 0) return;

		const breakdownSection = container.createDiv({ cls: 'crc-research-gaps-breakdown' });
		breakdownSection.createEl('h4', { text: title, cls: 'crc-section-subtitle' });

		const grid = breakdownSection.createDiv({ cls: 'crc-schema-error-grid' });

		// Sort by count descending
		const sortedFacts = (Object.entries(factCounts) as [FactKey, number][])
			.filter(([, count]) => count > 0)
			.sort((a, b) => b[1] - a[1]);

		for (const [factKey, count] of sortedFacts) {
			const item = grid.createDiv({ cls: 'crc-schema-error-item' });
			item.createSpan({ text: FACT_KEY_LABELS[factKey], cls: 'crc-schema-error-label' });
			item.createSpan({ text: String(count), cls: 'crc-schema-error-count' });
		}
	}

	/**
	 * Render lowest coverage people list
	 */
	private renderLowestCoveragePeople(
		container: HTMLElement,
		people: PersonResearchCoverage[],
		_evidenceService: EvidenceService,
		filter: string
	): void {
		if (people.length === 0) {
			const emptySection = container.createDiv({ cls: 'crc-research-gaps-lowest' });
			emptySection.createEl('p', {
				text: `No people match the "${filter}" filter.`,
				cls: 'crc-text--muted'
			});
			return;
		}

		const lowestSection = container.createDiv({ cls: 'crc-research-gaps-lowest' });
		lowestSection.createEl('h4', { text: 'Lowest research coverage', cls: 'crc-section-subtitle' });

		const list = lowestSection.createDiv({ cls: 'crc-research-gaps-list' });

		for (const person of people.slice(0, 5)) {
			const item = list.createDiv({ cls: 'crc-research-gaps-person' });

			// Progress bar
			const progressBar = item.createDiv({ cls: 'crc-progress-bar crc-progress-bar--small' });
			const progressFill = progressBar.createDiv({ cls: 'crc-progress-bar__fill' });
			progressFill.style.setProperty('width', `${person.coveragePercent}%`);

			// Adjust color based on coverage
			if (person.coveragePercent < 25) {
				progressFill.addClass('crc-progress-bar__fill--danger');
			} else if (person.coveragePercent < 50) {
				progressFill.addClass('crc-progress-bar__fill--warning');
			}

			// Name and stats
			const info = item.createDiv({ cls: 'crc-research-gaps-info' });
			const nameLink = info.createEl('a', {
				text: person.personName,
				cls: 'crc-link',
				href: '#'
			});
			nameLink.addEventListener('click', (e) => {
				e.preventDefault();
				const file = this.app.vault.getAbstractFileByPath(person.filePath);
				if (file instanceof TFile) {
					void this.app.workspace.openLinkText(file.path, '', false);
				}
			});

			info.createSpan({
				text: `${person.coveragePercent}% (${person.sourcedFactCount}/${person.totalFactCount} facts)`,
				cls: 'crc-text-muted crc-text-small'
			});
		}
	}

	/**
	 * Export research gaps data to CSV and copy to clipboard
	 */
	private exportResearchGapsToCSV(): void {
		const evidenceService = new EvidenceService(this.app, this.plugin.settings);
		const gaps = evidenceService.getResearchGaps(1000); // Get all, not just top 10

		if (gaps.lowestCoverage.length === 0) {
			new Notice('No research coverage data to export');
			return;
		}

		// Build CSV with headers
		const headers = ['Name', 'File Path', 'Coverage %', 'Sourced Facts', 'Total Facts', ...FACT_KEYS.map(k => FACT_KEY_LABELS[k])];
		const rows: string[][] = [];

		for (const person of gaps.lowestCoverage) {
			const row: string[] = [
				`"${person.personName.replace(/"/g, '""')}"`,
				`"${person.filePath.replace(/"/g, '""')}"`,
				String(person.coveragePercent),
				String(person.sourcedFactCount),
				String(person.totalFactCount)
			];

			// Add status for each fact type
			for (const factKey of FACT_KEYS) {
				const fact = person.facts.find(f => f.factKey === factKey);
				if (fact) {
					row.push(fact.status);
				} else {
					row.push('unsourced');
				}
			}

			rows.push(row);
		}

		const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

		void navigator.clipboard.writeText(csv).then(() => {
			new Notice(`Research gaps exported: ${gaps.lowestCoverage.length} people copied to clipboard as CSV`);
		}).catch(() => {
			new Notice('Failed to copy to clipboard');
		});
	}

	// ==========================================================================
	// RELATIONSHIPS TAB
	// ==========================================================================

	/**
	 * Show Relationships tab with type management and relationship overview
	 */
	private showRelationshipsTab(): void {
		const container = this.contentContainer;
		renderRelationshipsTab(
			container,
			this.plugin,
			(options) => this.createCard(options),
			(tabId) => this.switchTab(tabId)
		);
	}

	/**
	 * Show Events tab with date systems and temporal statistics
	 */
	private showEventsTab(): void {
		const container = this.contentContainer;
		renderEventsTab(
			container,
			this.plugin,
			(options) => this.createCard(options),
			(tabId) => this.switchTab(tabId)
		);
	}

	/**
	 * Show Organizations tab with organization list and statistics
	 */
	private showOrganizationsTab(): void {
		const container = this.contentContainer;
		renderOrganizationsTab(
			container,
			this.plugin,
			(options) => this.createCard(options),
			(tabId) => this.switchTab(tabId)
		);
	}

	/**
	 * Show Universes tab with universe management
	 */
	private showUniversesTab(): void {
		const container = this.contentContainer;
		const universeService = new UniverseService(this.plugin);
		const universes = universeService.getAllUniverses();
		const orphans = universeService.findOrphanUniverses();

		// Build universe list with entity counts for filtering/sorting
		const universeItems = universes.map(u => {
			const counts = universeService.getEntityCountsForUniverse(u.crId);
			const totalEntities = counts.people + counts.places + counts.events +
				counts.organizations + counts.maps + counts.calendars;
			return { ...u, counts, totalEntities };
		});

		// Universe List Card (main card, similar to Person notes)
		const listCard = this.createCard({
			title: 'Universe notes',
			icon: 'globe',
			subtitle: 'All universe notes in your vault'
		});
		const listContent = listCard.querySelector('.crc-card__content') as HTMLElement;

		if (universeItems.length === 0) {
			// Empty state
			const emptyState = listContent.createDiv({ cls: 'crc-empty-state' });
			emptyState.createEl('p', {
				text: 'No universe notes found in your vault.',
				cls: 'crc-text--muted'
			});
			emptyState.createEl('p', {
				text: 'Create your first universe to start organizing fictional worlds with custom calendars, maps, and validation rules.',
				cls: 'crc-text--muted crc-text--small crc-mb-3'
			});
			const startBtn = emptyState.createEl('button', {
				text: 'Create universe',
				cls: 'crc-btn crc-btn--primary'
			});
			startBtn.addEventListener('click', () => {
				new UniverseWizardModal(this.plugin, {
					onComplete: () => this.showUniversesTab()
				}).open();
			});
		} else {
			// Controls row (filter + sort + search)
			const controlsRow = listContent.createDiv({ cls: 'crc-person-controls' });

			// Filter dropdown
			const filterSelect = controlsRow.createEl('select', { cls: 'dropdown' });
			const filterOptions = [
				{ value: 'all', label: 'All universes' },
				{ value: 'active', label: 'Active' },
				{ value: 'draft', label: 'Draft' },
				{ value: 'archived', label: 'Archived' },
				{ value: 'has-entities', label: 'Has entities' },
				{ value: 'empty', label: 'Empty' }
			];
			filterOptions.forEach(opt => {
				const option = filterSelect.createEl('option', { text: opt.label, value: opt.value });
				if (opt.value === this.universeListFilter) option.selected = true;
			});

			// Sort dropdown
			const sortSelect = controlsRow.createEl('select', { cls: 'dropdown' });
			const sortOptions = [
				{ value: 'name-asc', label: 'Name (A–Z)' },
				{ value: 'name-desc', label: 'Name (Z–A)' },
				{ value: 'created-asc', label: 'Created (oldest)' },
				{ value: 'created-desc', label: 'Created (newest)' },
				{ value: 'entities-asc', label: 'Entities (fewest)' },
				{ value: 'entities-desc', label: 'Entities (most)' }
			];
			sortOptions.forEach(opt => {
				const option = sortSelect.createEl('option', { text: opt.label, value: opt.value });
				if (opt.value === this.universeListSort) option.selected = true;
			});

			// Search input
			const searchInput = controlsRow.createEl('input', {
				cls: 'crc-filter-input',
				attr: {
					type: 'text',
					placeholder: `Search ${universeItems.length} universes...`
				}
			});

			// Usage hint
			const hint = listContent.createEl('p', {
				cls: 'crc-text-muted crc-text-small crc-mb-2'
			});
			hint.appendText('Click a row to edit. ');
			const fileIconHint = createLucideIcon('file-text', 12);
			fileIconHint.addClass('crc-icon-inline');
			hint.appendChild(fileIconHint);
			hint.appendText(' opens the note.');

			// List container
			const listContainer = listContent.createDiv({ cls: 'crc-person-list' });

			// Apply filter, sort, and render
			const applyFiltersAndRender = () => {
				const query = searchInput.value.toLowerCase();

				// Filter by search query
				let filtered = universeItems.filter(u =>
					u.name.toLowerCase().includes(query) ||
					(u.description && u.description.toLowerCase().includes(query)) ||
					(u.author && u.author.toLowerCase().includes(query)) ||
					(u.genre && u.genre.toLowerCase().includes(query))
				);

				// Apply category filter
				switch (this.universeListFilter) {
					case 'active':
						filtered = filtered.filter(u => u.status === 'active');
						break;
					case 'draft':
						filtered = filtered.filter(u => u.status === 'draft');
						break;
					case 'archived':
						filtered = filtered.filter(u => u.status === 'archived');
						break;
					case 'has-entities':
						filtered = filtered.filter(u => u.totalEntities > 0);
						break;
					case 'empty':
						filtered = filtered.filter(u => u.totalEntities === 0);
						break;
				}

				// Apply sort
				filtered.sort((a, b) => {
					switch (this.universeListSort) {
						case 'name-asc':
							return a.name.localeCompare(b.name);
						case 'name-desc':
							return b.name.localeCompare(a.name);
						case 'created-asc':
							return (a.created || '0000').localeCompare(b.created || '0000');
						case 'created-desc':
							return (b.created || '9999').localeCompare(a.created || '9999');
						case 'entities-asc':
							return a.totalEntities - b.totalEntities;
						case 'entities-desc':
							return b.totalEntities - a.totalEntities;
						default:
							return 0;
					}
				});

				this.renderUniverseListItems(listContainer, filtered, universeService);
			};

			// Event handlers
			searchInput.addEventListener('input', applyFiltersAndRender);
			filterSelect.addEventListener('change', () => {
				this.universeListFilter = filterSelect.value as typeof this.universeListFilter;
				applyFiltersAndRender();
			});
			sortSelect.addEventListener('change', () => {
				this.universeListSort = sortSelect.value as typeof this.universeListSort;
				applyFiltersAndRender();
			});

			// Initial render
			applyFiltersAndRender();

			// View full statistics link
			const statsLink = listContent.createDiv({ cls: 'cr-stats-link' });
			const link = statsLink.createEl('a', { text: 'View full statistics →', cls: 'crc-text-muted' });
			link.addEventListener('click', (e) => {
				e.preventDefault();
				this.close();
				void this.plugin.activateStatisticsView();
			});
		}

		container.appendChild(listCard);

		// Orphan universes section
		if (orphans.length > 0) {
			const orphanCard = this.createCard({
				title: 'Orphan universe values',
				icon: 'alert-triangle',
				subtitle: 'Universe references without matching notes'
			});
			const orphanContent = orphanCard.querySelector('.crc-card__content') as HTMLElement;

			orphanContent.createEl('p', {
				text: 'These universe values are used by entities but don\'t have corresponding universe notes. Create notes to enable full universe management.',
				cls: 'crc-text-muted crc-mb-3'
			});

			orphans.forEach(orphan => {
				const row = orphanContent.createDiv({ cls: 'crc-flex crc-justify-between crc-items-center crc-mb-2' });
				row.createSpan({ text: `"${orphan.value}"`, cls: 'crc-code' });
				row.createSpan({ text: `${orphan.entityCount} entities`, cls: 'crc-text-muted' });
				const createNoteBtn = row.createEl('button', {
					text: 'Create note',
					cls: 'crc-btn crc-btn--small'
				});
				createNoteBtn.addEventListener('click', () => {
					void (async () => {
						try {
							// Create universe from orphan value, using the orphan value as cr_id
							// so existing entity references will match
							await universeService.createUniverse({
								name: orphan.value.charAt(0).toUpperCase() + orphan.value.slice(1).replace(/-/g, ' '),
								crId: orphan.value
							});
							new Notice(`Created universe: ${orphan.value}`);
							// Refresh the tab
							this.showUniversesTab();
						} catch (err) {
							new Notice(`Failed to create universe: ${getErrorMessage(err)}`);
						}
					})();
				});
			});

			// Create all button
			if (orphans.length > 1) {
				const createAllBtn = orphanContent.createEl('button', {
					text: 'Create all',
					cls: 'crc-btn crc-btn--secondary crc-mt-3'
				});
				createAllBtn.addEventListener('click', () => {
					void (async () => {
						for (const orphan of orphans) {
							try {
								await universeService.createUniverse({
									name: orphan.value.charAt(0).toUpperCase() + orphan.value.slice(1).replace(/-/g, ' '),
									crId: orphan.value
								});
							} catch (err) {
								logger.error('createOrphanUniverse', `Failed: ${orphan.value}`, err);
							}
						}
						new Notice(`Created ${orphans.length} universe notes`);
						this.showUniversesTab();
					})();
				});
			}

			container.appendChild(orphanCard);
		}
	}

	/**
	 * Render universe list items as a table
	 */
	private renderUniverseListItems(
		container: HTMLElement,
		universes: (UniverseInfo & { counts: UniverseEntityCounts; totalEntities: number })[],
		universeService: UniverseService
	): void {
		container.empty();

		if (universes.length === 0) {
			container.createEl('p', {
				text: 'No matching universes found.',
				cls: 'crc-text--muted'
			});
			return;
		}

		// Create table structure
		const table = container.createEl('table', { cls: 'crc-person-table' });
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Name', cls: 'crc-person-table__th' });
		headerRow.createEl('th', { text: 'Status', cls: 'crc-person-table__th' });
		headerRow.createEl('th', { text: 'Entities', cls: 'crc-person-table__th' });
		headerRow.createEl('th', { text: '', cls: 'crc-person-table__th crc-person-table__th--icon' });

		const tbody = table.createEl('tbody');

		for (const universe of universes) {
			this.renderUniverseTableRow(tbody, universe, universeService);
		}
	}

	/**
	 * Render a single universe as a table row
	 */
	private renderUniverseTableRow(
		tbody: HTMLElement,
		universe: UniverseInfo & { counts: UniverseEntityCounts; totalEntities: number },
		universeService: UniverseService
	): void {
		const row = tbody.createEl('tr', { cls: 'crc-person-table__row' });

		// Name cell
		const nameCell = row.createEl('td', { cls: 'crc-person-table__td crc-person-table__td--name' });
		nameCell.createSpan({ text: universe.name });
		if (universe.description) {
			nameCell.createEl('br');
			nameCell.createSpan({
				text: universe.description,
				cls: 'crc-text--muted crc-text--small'
			});
		}

		// Status cell
		const statusCell = row.createEl('td', { cls: 'crc-person-table__td' });
		const _statusBadge = statusCell.createSpan({
			text: universe.status || 'active',
			cls: `crc-badge crc-badge--${universe.status || 'active'}`
		});

		// Entities cell - show count breakdown
		const entitiesCell = row.createEl('td', { cls: 'crc-person-table__td crc-person-table__td--date' });
		if (universe.totalEntities > 0) {
			const countParts: string[] = [];
			if (universe.counts.people > 0) countParts.push(`${universe.counts.people} people`);
			if (universe.counts.places > 0) countParts.push(`${universe.counts.places} places`);
			if (universe.counts.events > 0) countParts.push(`${universe.counts.events} events`);
			if (universe.counts.organizations > 0) countParts.push(`${universe.counts.organizations} orgs`);
			if (universe.counts.maps > 0) countParts.push(`${universe.counts.maps} maps`);
			if (universe.counts.calendars > 0) countParts.push(`${universe.counts.calendars} calendars`);
			entitiesCell.setText(countParts.join(', '));
		} else {
			entitiesCell.setText('—');
		}

		// Actions cell
		const actionsCell = row.createEl('td', { cls: 'crc-person-table__td crc-person-table__td--actions' });

		// Open note button
		const openBtn = actionsCell.createEl('button', {
			cls: 'crc-person-table__open-btn clickable-icon',
			attr: { 'aria-label': 'Open note' }
		});
		const fileIcon = createLucideIcon('file-text', 14);
		openBtn.appendChild(fileIcon);
		openBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			void this.app.workspace.getLeaf(false).openFile(universe.file);
		});

		// Click row to open edit modal
		row.addEventListener('click', () => {
			new EditUniverseModal(this.app, this.plugin, {
				universe,
				file: universe.file,
				onUpdated: () => this.showUniversesTab()
			}).open();
		});

		// Context menu for row
		row.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			this.showUniverseContextMenu(universe, e);
		});
	}

	/**
	 * Show context menu for a universe row
	 */
	private showUniverseContextMenu(
		universe: UniverseInfo,
		event: MouseEvent
	): void {
		const menu = new Menu();

		menu.addItem(item => item
			.setTitle('Open note')
			.setIcon('file-text')
			.onClick(() => {
				void this.app.workspace.getLeaf(false).openFile(universe.file);
			}));

		menu.addItem(item => item
			.setTitle('Edit universe')
			.setIcon('pencil')
			.onClick(() => {
				new EditUniverseModal(this.app, this.plugin, {
					universe,
					file: universe.file,
					onUpdated: () => this.showUniversesTab()
				}).open();
			}));

		menu.addSeparator();

		menu.addItem(item => item
			.setTitle('Delete universe')
			.setIcon('trash-2')
			.onClick(async () => {
				const confirmed = await this.plugin.confirmDeleteUniverse(universe.name);
				if (confirmed) {
					await this.app.fileManager.trashFile(universe.file);
					new Notice(`Deleted universe: ${universe.name}`);
					this.showUniversesTab();
				}
			}));

		menu.showAtMouseEvent(event);
	}

	/**
	 * Show Statistics tab with vault statistics and data quality metrics
	 */
	private showStatisticsTab(): void {
		const container = this.contentContainer;
		renderStatisticsTab(
			container,
			this.plugin,
			(options) => this.createCard(options),
			(tabId) => this.switchTab(tabId),
			() => this.close()
		);
	}

	/**
	 * Show Sources tab with source list and statistics
	 */
	private showSourcesTab(): void {
		const container = this.contentContainer;
		renderSourcesTab(
			container,
			this.plugin,
			(options) => this.createCard(options),
			(tabId) => this.switchTab(tabId)
		);
	}

	/**
	 * Show Preferences tab with property aliases and folder locations
	 */
	private showPreferencesTab(): void {
		const container = this.contentContainer;
		renderPreferencesTab(
			container,
			this.plugin,
			(options) => this.createCard(options),
			(tabId) => this.switchTab(tabId),
			() => this.close()
		);
	}

	/**
	 * Get contrasting text color for a background color
	 */
	private getContrastColor(hexColor: string): string {
		// Remove # if present
		const hex = hexColor.replace('#', '');

		// Convert to RGB
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);

		// Calculate luminance
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

		return luminance > 0.5 ? '#000000' : '#ffffff';
	}

	// ==========================================================================
	// IMPORT/EXPORT TAB
	// ==========================================================================

	/**
	 * State for Import/Export tab
	 */
	private importFormat: 'gedcom' | 'gedcomx' | 'gramps' | 'csv' = 'gedcom';
	private exportFormat: 'gedcom' | 'gedcomx' | 'gramps' | 'csv' = 'gedcom';

	/**
	 * Show Import/Export tab with separate Import and Export cards
	 */
	private showImportExportTab(): void {
		const container = this.contentContainer;

		// Folder configuration info card (points to Preferences)
		const folderCard = this.createCard({
			title: 'Folder configuration',
			icon: 'folder',
			subtitle: 'Configure where imports are saved'
		});
		const folderContent = folderCard.querySelector('.crc-card__content') as HTMLElement;

		// Info about folders
		const folderInfo = folderContent.createDiv({ cls: 'cr-info-box' });
		const folderIcon = folderInfo.createSpan({ cls: 'cr-info-box-icon' });
		setIcon(folderIcon, 'folder');
		folderInfo.createSpan({
			text: 'Imports create notes in the folders configured in your preferences. Make sure to set your People folder and other locations before importing.'
		});

		// Link to Preferences tab
		const linkContainer = folderContent.createDiv({ cls: 'crc-folder-link' });
		const linkButton = linkContainer.createEl('button', {
			cls: 'mod-cta',
			text: 'Open folder settings'
		});
		const linkIcon = linkButton.createSpan({ cls: 'crc-button-icon' });
		setIcon(linkIcon, 'settings');
		linkButton.prepend(linkIcon);
		linkButton.addEventListener('click', () => {
			this.switchTab('preferences');
			// Scroll to folder locations card after tab renders
			setTimeout(() => {
				const folderCard = this.contentContainer.querySelector('#cr-folder-locations-card');
				if (folderCard) {
					folderCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			}, 50);
		});

		// Current folder summary
		const summaryContainer = folderContent.createDiv({ cls: 'crc-folder-summary crc-mt-3' });
		summaryContainer.createEl('p', {
			text: 'Current settings:',
			cls: 'crc-text-muted crc-text-small crc-mb-1'
		});
		const summaryList = summaryContainer.createEl('ul', { cls: 'crc-folder-summary-list' });

		// Helper to format folder path
		const formatFolder = (path: string) => path || '(vault root)';

		// Core import folders
		summaryList.createEl('li', {
			text: `People: ${formatFolder(this.plugin.settings.peopleFolder)}`,
			cls: 'crc-text-small'
		});
		summaryList.createEl('li', {
			text: `Places: ${formatFolder(this.plugin.settings.placesFolder)}`,
			cls: 'crc-text-small'
		});
		summaryList.createEl('li', {
			text: `Events: ${formatFolder(this.plugin.settings.eventsFolder)}`,
			cls: 'crc-text-small'
		});
		summaryList.createEl('li', {
			text: `Sources: ${formatFolder(this.plugin.settings.sourcesFolder)}`,
			cls: 'crc-text-small'
		});
		summaryList.createEl('li', {
			text: `Organizations: ${formatFolder(this.plugin.settings.organizationsFolder)}`,
			cls: 'crc-text-small'
		});

		// Staging folder (only shown if configured)
		if (this.plugin.settings.stagingFolder) {
			summaryList.createEl('li', {
				text: `Staging: ${this.plugin.settings.stagingFolder}`,
				cls: 'crc-text-small crc-text-accent'
			});
		}

		container.appendChild(folderCard);

		// === IMPORT CARD ===
		const importCard = this.createCard({
			title: 'Import data',
			icon: 'upload'
		});
		const importCardContent = importCard.querySelector('.crc-card__content') as HTMLElement;

		importCardContent.createEl('p', {
			text: 'Import genealogical data from external files into your vault.',
			cls: 'crc-text-muted crc-mb-4'
		});

		// Format selector for import
		const importFormatContainer = importCardContent.createDiv();
		new Setting(importFormatContainer)
			.setName('Format')
			.addDropdown(dropdown => {
				dropdown.addOption('gedcom', 'GEDCOM 5.5.1');
				dropdown.addOption('gedcomx', 'GEDCOM X (JSON)');
				dropdown.addOption('gramps', 'Gramps XML');
				dropdown.addOption('csv', 'CSV');

				dropdown.setValue(this.importFormat);
				dropdown.onChange(value => {
					this.importFormat = value as 'gedcom' | 'gedcomx' | 'gramps' | 'csv';
					this.renderImportContent(importContentContainer);
				});
			});

		// Content area for import options
		const importContentContainer = importCardContent.createDiv({ cls: 'crc-import-content' });
		this.renderImportContent(importContentContainer);

		container.appendChild(importCard);

		// === EXPORT CARD ===
		const exportCard = this.createCard({
			title: 'Export data',
			icon: 'download'
		});
		const exportCardContent = exportCard.querySelector('.crc-card__content') as HTMLElement;

		exportCardContent.createEl('p', {
			text: 'Export your family tree data to share with other genealogy software.',
			cls: 'crc-text-muted crc-mb-4'
		});

		// Format selector for export
		const exportFormatContainer = exportCardContent.createDiv();
		new Setting(exportFormatContainer)
			.setName('Format')
			.addDropdown(dropdown => {
				dropdown.addOption('gedcom', 'GEDCOM 5.5.1');
				dropdown.addOption('gedcomx', 'GEDCOM X (JSON)');
				dropdown.addOption('gramps', 'Gramps XML');
				dropdown.addOption('csv', 'CSV');

				dropdown.setValue(this.exportFormat);
				dropdown.onChange(value => {
					this.exportFormat = value as 'gedcom' | 'gedcomx' | 'gramps' | 'csv';
					this.renderExportContent(exportContentContainer);
				});
			});

		// Content area for export options
		const exportContentContainer = exportCardContent.createDiv({ cls: 'crc-export-content' });
		this.renderExportContent(exportContentContainer);

		container.appendChild(exportCard);

		// === STAGING AREA CARD ===
		// Only show if staging folder is configured
		if (this.plugin.settings.stagingFolder) {
			this.renderStagingAreaCard(container);
		}
	}

	/**
	 * Render the staging area card within Import/Export tab
	 */
	private renderStagingAreaCard(container: HTMLElement): void {
		const settings = this.plugin.settings;
		const stagingService = new StagingService(this.app, settings);
		const folderFilter = new FolderFilterService(settings);
		const crossImportService = new CrossImportDetectionService(
			this.app,
			settings,
			folderFilter,
			stagingService
		);

		const stats = stagingService.getStagingStats();
		const subfolders = stagingService.getStagingSubfolders();

		const stagingCard = this.createCard({
			title: 'Staging area',
			icon: 'package',
			subtitle: stats.totalPeople > 0
				? `${stats.totalPeople} people in ${stats.subfolderCount} import(s)`
				: 'No data in staging'
		});
		const stagingContent = stagingCard.querySelector('.crc-card__content') as HTMLElement;

		if (stats.totalPeople === 0) {
			stagingContent.createEl('p', {
				text: 'Import data to your staging folder to review it here before promoting to your main tree.',
				cls: 'crc-text-muted'
			});
		} else {
			// Staging folder path info
			const infoEl = stagingContent.createDiv({ cls: 'crc-staging-info crc-mb-4' });
			infoEl.createEl('span', {
				text: `Staging folder: ${settings.stagingFolder}`,
				cls: 'crc-text-muted'
			});

			// Render subfolders list
			const subfoldersContainer = stagingContent.createDiv({ cls: 'crc-staging-list' });

			if (subfolders.length === 0) {
				// Files are directly in staging folder
				this.renderStagingRootFiles(subfoldersContainer, stagingService, crossImportService);
			} else {
				// Render each subfolder
				for (const subfolder of subfolders) {
					this.renderStagingSubfolder(subfoldersContainer, subfolder, stagingService, crossImportService);
				}
			}

			// Bulk actions section
			const actionsSection = stagingContent.createDiv({ cls: 'crc-staging-actions crc-mt-4' });
			actionsSection.createEl('h4', {
				text: 'Bulk actions',
				cls: 'crc-staging-actions-header'
			});

			// Check all for duplicates
			new Setting(actionsSection)
				.setName('Check all for duplicates')
				.setDesc('Scan all staging data against your main tree')
				.addButton(btn => btn
					.setButtonText('Check all')
					.onClick(() => {
						this.runCrossImportCheck(crossImportService);
					})
				);

			// Promote all
			new Setting(actionsSection)
				.setName('Promote all to main tree')
				.setDesc('Move all staging data to your main people folder (skips duplicates)')
				.addButton(btn => btn
					.setButtonText('Promote all')
					.setWarning()
					.onClick(() => {
						void this.promoteAllStagingAndRefresh(stagingService, crossImportService, container);
					})
				);

			// Delete all
			new Setting(actionsSection)
				.setName('Delete all staging data')
				.setDesc('Permanently remove all data from staging')
				.addButton(btn => btn
					.setButtonText('Delete all')
					.setWarning()
					.onClick(() => {
						void this.deleteAllStagingAndRefresh(stagingService, container);
					})
				);
		}

		container.appendChild(stagingCard);
	}

	/**
	 * Promote all staging and refresh Import/Export tab
	 */
	private async promoteAllStagingAndRefresh(
		stagingService: StagingService,
		crossImportService: CrossImportDetectionService,
		_container: HTMLElement
	): Promise<void> {
		await this.promoteAllStaging(stagingService, crossImportService);
		// Refresh the Import/Export tab
		this.showImportExportTab();
	}

	/**
	 * Delete all staging and refresh Import/Export tab
	 */
	private async deleteAllStagingAndRefresh(
		stagingService: StagingService,
		_container: HTMLElement
	): Promise<void> {
		await this.deleteAllStaging(stagingService);
		// Refresh the Import/Export tab
		this.showImportExportTab();
	}

	/**
	 * Render import content based on selected format
	 */
	private renderImportContent(container: HTMLElement): void {
		container.empty();

		switch (this.importFormat) {
			case 'gedcom':
				this.renderGedcomImport(container);
				break;
			case 'gedcomx':
				this.renderGedcomXImport(container);
				break;
			case 'gramps':
				this.renderGrampsImport(container);
				break;
			case 'csv':
				this.renderCsvImport(container);
				break;
		}
	}

	/**
	 * Render export content based on selected format
	 */
	private renderExportContent(container: HTMLElement): void {
		container.empty();

		switch (this.exportFormat) {
			case 'gedcom':
				this.renderGedcomExport(container);
				break;
			case 'gedcomx':
				this.renderGedcomXExport(container);
				break;
			case 'gramps':
				this.renderGrampsExport(container);
				break;
			case 'csv':
				this.renderCsvExport(container);
				break;
		}
	}

	/**
	 * Render collapsible folder configuration section
	 */
	private renderFolderConfigSection(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'crc-folder-config-section' });

		// Collapsible header
		const header = section.createDiv({ cls: 'crc-folder-config-header' });
		const chevron = header.createSpan({ cls: 'crc-folder-config-chevron' });
		setIcon(chevron, 'chevron-right');
		header.createSpan({ text: 'Configure folders', cls: 'crc-folder-config-title' });

		// Current status summary
		const statusText = this.getFolderStatusSummary();
		const status = header.createSpan({ text: statusText, cls: 'crc-folder-config-status' });

		// Collapsible content
		const content = section.createDiv({ cls: 'crc-folder-config-content cr-hidden' });

		// Toggle collapse
		header.addEventListener('click', () => {
			const isExpanded = !content.hasClass('cr-hidden');
			if (isExpanded) {
				content.addClass('cr-hidden');
				setIcon(chevron, 'chevron-right');
			} else {
				content.removeClass('cr-hidden');
				setIcon(chevron, 'chevron-down');
			}
		});

		// People folder setting
		new Setting(content)
			.setName('People folder')
			.setDesc('Where person notes are stored (main tree)')
			.addText(text => text
				.setPlaceholder('People')
				.setValue(this.plugin.settings.peopleFolder)
				.onChange(async value => {
					this.plugin.settings.peopleFolder = value;
					await this.plugin.saveSettings();
					status.setText(this.getFolderStatusSummary());
				})
			);

		// Staging folder setting
		new Setting(content)
			.setName('Staging folder')
			.setDesc('Optional folder for reviewing imports before promoting to main')
			.addText(text => text
				.setPlaceholder('People-Staging')
				.setValue(this.plugin.settings.stagingFolder || '')
				.onChange(async value => {
					this.plugin.settings.stagingFolder = value;
					await this.plugin.saveSettings();
					status.setText(this.getFolderStatusSummary());
				})
			);

		// Staging isolation toggle (only show if staging folder is set)
		if (this.plugin.settings.stagingFolder) {
			new Setting(content)
				.setName('Staging isolation')
				.setDesc('Exclude staging folder from tree generation, duplicate detection, etc.')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.enableStagingIsolation ?? true)
					.onChange(async value => {
						this.plugin.settings.enableStagingIsolation = value;
						await this.plugin.saveSettings();
					})
				);
		}

		// Link to full settings
		const settingsLink = content.createDiv({ cls: 'crc-folder-config-link' });
		settingsLink.createSpan({ text: 'More options in ' });
		const link = settingsLink.createEl('a', { text: 'plugin settings' });
		link.addEventListener('click', (e) => {
			e.preventDefault();
			// Open Obsidian settings to this plugin
			// @ts-ignore - accessing internal API
			this.app.setting?.open();
			// @ts-ignore
			this.app.setting?.openTabById?.('canvas-roots');
		});
	}

	/**
	 * Get a summary of folder configuration status
	 */
	private getFolderStatusSummary(): string {
		const peopleFolder = this.plugin.settings.peopleFolder;
		const stagingFolder = this.plugin.settings.stagingFolder;

		if (!peopleFolder) {
			return '⚠ Not configured';
		}

		if (stagingFolder) {
			return `${peopleFolder} + staging`;
		}

		return peopleFolder;
	}

	/**
	 * Render GEDCOM import options
	 */
	private renderGedcomImport(container: HTMLElement): void {
		const card = this.createCard({
			title: 'Import GEDCOM',
			icon: 'upload'
		});
		const content = card.querySelector('.crc-card__content') as HTMLElement;

		content.createEl('p', {
			text: 'Import family tree data from a GEDCOM file. After selecting a file, you\'ll see a summary of what was found and can choose which note types to create (people, events, sources, places).',
			cls: 'crc-text-muted crc-mb-4'
		});

		// Import destination options (only show if staging folder is configured)
		let importDestination: 'configured' | 'staging' = 'configured';
		let stagingSubfolder = `import-${new Date().toISOString().slice(0, 7)}`;

		const stagingFolder = this.plugin.settings.stagingFolder;
		if (stagingFolder) {
			new Setting(content)
				.setName('Import destination')
				.setDesc('Where to create notes')
				.addDropdown(dropdown => dropdown
					.addOption('configured', 'Configured folders')
					.addOption('staging', 'Staging folder')
					.setValue(importDestination)
					.onChange(value => {
						importDestination = value as 'configured' | 'staging';
						// Show/hide subfolder input
						// eslint-disable-next-line @typescript-eslint/no-misused-promises -- subfolderSetting is hoisted Setting, not a Promise
						if (subfolderSetting) {
							subfolderSetting.settingEl.toggleClass('cr-hidden', value !== 'staging');
						}
					})
				);

			// Subfolder input (hidden by default, shown when staging is selected)
			const subfolderSetting = new Setting(content)
				.setName('Subfolder name')
				.setDesc('Organize imports in a dated subfolder')
				.addText(text => text
					.setPlaceholder(stagingSubfolder)
					.setValue(stagingSubfolder)
					.onChange(value => {
						stagingSubfolder = value || `import-${new Date().toISOString().slice(0, 7)}`;
					})
				);
			subfolderSetting.settingEl.addClass('cr-hidden');
		}

		// File selection button
		const fileBtn = content.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-mt-4',
			text: 'Select GEDCOM file'
		});

		// Create hidden file input
		const fileInput = content.createEl('input', {
			attr: {
				type: 'file',
				accept: '.ged,.gedcom',
				style: 'display: none;'
			}
		});

		// Analysis results container (hidden initially)
		const analysisContainer = content.createDiv({ cls: 'crc-gedcom-analysis cr-hidden' });

		fileBtn.addEventListener('click', () => {
			fileInput.click();
		});

		fileInput.addEventListener('change', (event) => {
			void (async () => {
				const target = event.target as HTMLInputElement;
				const file = target.files?.[0];
				if (file) {
					// Determine staging base folder if staging is selected
					let stagingBaseFolder: string | undefined;
					if (importDestination === 'staging' && stagingFolder) {
						stagingBaseFolder = stagingSubfolder
							? `${stagingFolder}/${stagingSubfolder}`
							: stagingFolder;
					}
					await this.showGedcomAnalysis(file, analysisContainer, fileBtn, stagingBaseFolder);
				}
			})();
		});

		container.appendChild(card);
	}

	/**
	 * Render GEDCOM export options
	 */
	private renderGedcomExport(container: HTMLElement): void {
		const card = this.createCard({
			title: 'Export GEDCOM',
			icon: 'download'
		});
		const content = card.querySelector('.crc-card__content') as HTMLElement;

		content.createEl('p', {
			text: 'Export your family tree data to GEDCOM 5.5.1 format for sharing with other genealogy software',
			cls: 'crc-text-muted crc-mb-4'
		});

		// Use the new ExportOptionsBuilder
		const optionsBuilder = new ExportOptionsBuilder(this.app, this.plugin);

		// Last export info
		ExportOptionsBuilder.buildLastExportInfo(content, this.plugin.settings.lastGedcomExport, 'GEDCOM');

		// GEDCOM version selector
		optionsBuilder.buildGedcomVersionSelector(content);

		// People folder (read-only display)
		new Setting(content)
			.setName('People folder')
			.setDesc('Folder containing person notes to export')
			.addText(text => text
				.setPlaceholder('People')
				.setValue(this.plugin.settings.peopleFolder)
				.setDisabled(true)
			);

		// Build shared export options using the builder
		optionsBuilder.buildCollectionFilter(content);
		optionsBuilder.buildBranchFilter(content);
		optionsBuilder.buildIncludeCollectionCodes(content);
		optionsBuilder.buildIncludeCustomRelationships(content);
		optionsBuilder.buildPrivacyOverride(content);
		optionsBuilder.buildEntityInclusion(content);
		optionsBuilder.buildOutputLocation(content);
		optionsBuilder.buildStatsPreview(content);

		// Export file name
		optionsBuilder.buildFileNameInput(content, 'family-tree', '.ged');

		// Export button
		const exportBtn = content.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-mt-4',
			text: 'Export to GEDCOM'
		});

		exportBtn.addEventListener('click', () => {
			void (async () => {
				const options = optionsBuilder.getOptions();
				const privacySettings = optionsBuilder.getEffectivePrivacySettings();

				await this.handleGedcomExport({
					fileName: options.exportFileName,
					collectionFilter: options.collectionFilter,
					includeCollectionCodes: options.includeCollectionCodes ?? true,
					includeCustomRelationships: options.includeCustomRelationships ?? true,
					branchRootCrId: options.branchRootCrId,
					branchDirection: options.branchDirection,
					branchIncludeSpouses: options.branchIncludeSpouses,
					privacyOverride: options.privacyOverrideEnabled ? {
						enablePrivacyProtection: privacySettings.enablePrivacyProtection,
						privacyDisplayFormat: privacySettings.privacyDisplayFormat
					} : undefined,
					includeEntities: options.includeEntities,
					outputDestination: options.outputDestination,
					outputFolder: options.outputFolder
				});
			})();
		});

		container.appendChild(card);
	}

	/**
	 * Render GEDCOM X import options
	 */
	private renderGedcomXImport(container: HTMLElement): void {
		const card = this.createCard({
			title: 'Import GEDCOM X',
			icon: 'upload'
		});
		const content = card.querySelector('.crc-card__content') as HTMLElement;

		content.createEl('p', {
			text: 'Import family tree data from GEDCOM X JSON format (FamilySearch standard)',
			cls: 'crc-text-muted crc-mb-4'
		});

		// Import destination options (only show if staging folder is configured)
		let importDestination: 'main' | 'staging' = 'main';
		let stagingSubfolder = `import-${new Date().toISOString().slice(0, 7)}`;

		const stagingFolder = this.plugin.settings.stagingFolder;
		if (stagingFolder) {
			new Setting(content)
				.setName('Import destination')
				.setDesc('Where to create person notes')
				.addDropdown(dropdown => dropdown
					.addOption('main', `Main tree (${this.plugin.settings.peopleFolder || 'vault root'})`)
					.addOption('staging', `Staging (${stagingFolder})`)
					.setValue(importDestination)
					.onChange(value => {
						importDestination = value as 'main' | 'staging';
						// Show/hide subfolder input
						// eslint-disable-next-line @typescript-eslint/no-misused-promises -- subfolderSetting is hoisted Setting, not a Promise
						if (subfolderSetting) {
							subfolderSetting.settingEl.toggleClass('cr-hidden', value !== 'staging');
						}
					})
				);

			// Subfolder input (hidden by default, shown when staging is selected)
			const subfolderSetting = new Setting(content)
				.setName('Subfolder name')
				.setDesc('Create imports in a subfolder for organization')
				.addText(text => text
					.setPlaceholder(stagingSubfolder)
					.setValue(stagingSubfolder)
					.onChange(value => {
						stagingSubfolder = value || `import-${new Date().toISOString().slice(0, 7)}`;
					})
				);
			subfolderSetting.settingEl.addClass('cr-hidden');
		}

		// File selection button
		const fileBtn = content.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-mt-4',
			text: 'Select GEDCOM X file'
		});

		// Create hidden file input
		const fileInput = content.createEl('input', {
			attr: {
				type: 'file',
				accept: '.json,.gedx',
				style: 'display: none;'
			}
		});

		// Analysis results container (hidden initially)
		const analysisContainer = content.createDiv({ cls: 'crc-gedcom-analysis cr-hidden' });

		fileBtn.addEventListener('click', () => {
			fileInput.click();
		});

		fileInput.addEventListener('change', (event) => {
			void (async () => {
				const target = event.target as HTMLInputElement;
				const file = target.files?.[0];
				if (file) {
					// Determine target folder based on import destination
					let targetFolder: string;
					if (importDestination === 'staging' && stagingFolder) {
						targetFolder = stagingSubfolder
							? `${stagingFolder}/${stagingSubfolder}`
							: stagingFolder;
					} else {
						targetFolder = this.plugin.settings.peopleFolder;
					}
					await this.showGedcomXAnalysis(file, analysisContainer, fileBtn, targetFolder);
				}
			})();
		});

		container.appendChild(card);
	}

	/**
	 * Show GEDCOM X file analysis before import
	 */
	private async showGedcomXAnalysis(
		file: File,
		analysisContainer: HTMLElement,
		_fileBtn: HTMLButtonElement,
		targetFolder: string
	): Promise<void> {
		analysisContainer.empty();
		analysisContainer.removeClass('cr-hidden');

		// Show loading state
		analysisContainer.createEl('p', {
			text: 'Analyzing GEDCOM X file...',
			cls: 'crc-text-muted'
		});

		try {
			const content = await file.text();

			// Validate it's a GEDCOM X file
			if (!GedcomXParser.isGedcomX(content)) {
				analysisContainer.empty();
				analysisContainer.createEl('p', {
					text: 'This file does not appear to be a valid GEDCOM X JSON file.',
					cls: 'crc-text-error'
				});
				return;
			}

			const importer = new GedcomXImporter(this.app);
			const analysis = importer.analyzeFile(content);

			analysisContainer.empty();

			// Show analysis results
			const statsGrid = analysisContainer.createDiv({ cls: 'crc-stats-grid' });

			const createStat = (label: string, value: string | number) => {
				const stat = statsGrid.createDiv({ cls: 'crc-stat' });
				stat.createSpan({ text: String(value), cls: 'crc-stat-value' });
				stat.createSpan({ text: label, cls: 'crc-stat-label' });
			};

			createStat('Individuals', analysis.individualCount);
			createStat('Relationships', analysis.relationshipCount);
			createStat('Family groups', analysis.componentCount);

			// Import destination info
			analysisContainer.createEl('p', {
				text: `Import destination: ${targetFolder || 'vault root'}`,
				cls: 'crc-text-muted crc-mt-4'
			});

			// Import button
			const importBtn = analysisContainer.createEl('button', {
				cls: 'crc-btn crc-btn--primary crc-mt-4',
				text: 'Import'
			});

			importBtn.addEventListener('click', () => {
				void this.handleGedcomXImport(file, targetFolder);
			});

		} catch (error: unknown) {
			analysisContainer.empty();
			analysisContainer.createEl('p', {
				text: `Error analyzing file: ${getErrorMessage(error)}`,
				cls: 'crc-text-error'
			});
		}
	}

	/**
	 * Handle GEDCOM X file import
	 */
	private async handleGedcomXImport(file: File, destFolder: string): Promise<void> {
		try {
			const content = await file.text();

			logger.info('gedcomx', `Starting GEDCOM X import: ${file.name} to ${destFolder}`);

			// Disable bidirectional sync during import to prevent duplicate relationships
			this.plugin.disableBidirectionalSync();

			const importer = new GedcomXImporter(this.app);
			let result;
			try {
				result = await importer.importFile(content, {
					peopleFolder: destFolder,
					overwriteExisting: false,
					fileName: file.name
				});
			} finally {
				// Re-enable bidirectional sync after import
				this.plugin.enableBidirectionalSync();
			}

			// Show results notification
			this.showGedcomXImportResults(result);

			// Auto-create bases for imported note types (silently, skips if already exist)
			if (result.notesCreated > 0) {
				await this.plugin.createAllBases({ silent: true });
			}

			// Refresh status tab
			if (result.notesCreated > 0) {
				this.showTab('status');
			}

			// If successful, offer to assign reference numbers
			if (result.success && result.individualsImported > 0) {
				this.promptAssignReferenceNumbersAfterImport();
			}

		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('gedcomx', `GEDCOM X import failed: ${errorMsg}`);
			new Notice(`Import failed: ${errorMsg}`);
		}
	}

	/**
	 * Show GEDCOM X import results
	 */
	private showGedcomXImportResults(result: GedcomXImportResult): void {
		new Notice(
			`GEDCOM X import complete: ${result.individualsImported} people imported` +
			(result.errors.length > 0 ? ` (${result.errors.length} errors)` : ''),
			5000
		);

		// Log detailed results
		logger.info('gedcomx', 'Import results:', {
			imported: result.individualsImported,
			created: result.notesCreated,
			errors: result.errors.length
		});

		if (result.errors.length > 0) {
			logger.warn('gedcomx', 'Import errors:', result.errors);
		}
	}

	/**
	 * Render GEDCOM X export options
	 */
	private renderGedcomXExport(container: HTMLElement): void {
		const card = this.createCard({
			title: 'Export GEDCOM X',
			icon: 'download'
		});
		const content = card.querySelector('.crc-card__content') as HTMLElement;

		content.createEl('p', {
			text: 'Export your family tree data to GEDCOM X JSON format (FamilySearch standard)',
			cls: 'crc-text-muted crc-mb-4'
		});

		// Use the ExportOptionsBuilder
		const optionsBuilder = new ExportOptionsBuilder(this.app, this.plugin);

		// Last export info
		ExportOptionsBuilder.buildLastExportInfo(content, this.plugin.settings.lastGedcomXExport, 'GEDCOM X');

		// People folder (read-only display)
		new Setting(content)
			.setName('People folder')
			.setDesc('Folder containing person notes to export')
			.addText(text => text
				.setPlaceholder('People')
				.setValue(this.plugin.settings.peopleFolder)
				.setDisabled(true)
			);

		// Build shared export options using the builder
		optionsBuilder.buildCollectionFilter(content);
		optionsBuilder.buildBranchFilter(content);
		optionsBuilder.buildIncludeCustomRelationships(content);
		optionsBuilder.buildPrivacyOverride(content);
		optionsBuilder.buildEntityInclusion(content);
		optionsBuilder.buildOutputLocation(content);
		optionsBuilder.buildStatsPreview(content);
		optionsBuilder.buildFileNameInput(content, 'family-tree', '.json');

		// Export button
		const exportBtn = content.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-mt-4',
			text: 'Export to GEDCOM X'
		});

		exportBtn.addEventListener('click', () => {
			void (async () => {
				const options = optionsBuilder.getOptions();
				const privacySettings = optionsBuilder.getEffectivePrivacySettings();

				await this.handleGedcomXExport({
					fileName: options.exportFileName,
					collectionFilter: options.collectionFilter,
					branchRootCrId: options.branchRootCrId,
					branchDirection: options.branchDirection,
					branchIncludeSpouses: options.branchIncludeSpouses,
					privacyOverride: options.privacyOverrideEnabled ? {
						enablePrivacyProtection: privacySettings.enablePrivacyProtection,
						privacyDisplayFormat: privacySettings.privacyDisplayFormat
					} : undefined,
					includeEntities: options.includeEntities,
					outputDestination: options.outputDestination,
					outputFolder: options.outputFolder
				});
			})();
		});

		container.appendChild(card);
	}

	/**
	 * Handle GEDCOM X file export
	 */
	private async handleGedcomXExport(options: {
		fileName: string;
		collectionFilter?: string;
		branchRootCrId?: string;
		branchDirection?: 'ancestors' | 'descendants';
		branchIncludeSpouses?: boolean;
		privacyOverride?: {
			enablePrivacyProtection: boolean;
			privacyDisplayFormat: 'living' | 'private' | 'initials' | 'hidden';
		};
		includeEntities?: {
			people: boolean;
			events: boolean;
			sources: boolean;
			places: boolean;
		};
		outputDestination?: 'download' | 'vault';
		outputFolder?: string;
	}): Promise<void> {
		// Create and open progress modal
		const { ExportProgressModal } = await import('./export-progress-modal');
		const progressModal = new ExportProgressModal(this.app, 'GEDCOM X');
		progressModal.open();

		try {
			logger.info('gedcomx-export', `Starting GEDCOM X export: ${options.fileName}`);

			// Update progress: loading data
			progressModal.updateProgress({ phase: 'loading', current: 0, total: 1 });

			// Create exporter
			const { GedcomXExporter } = await import('../gedcomx/gedcomx-exporter');
			const exporter = new GedcomXExporter(this.app);

			// Conditionally set services based on includeEntities flags
			const includeEntities = options.includeEntities ?? {
				people: true,
				events: true,
				sources: true,
				places: true
			};

			if (includeEntities.events) {
				exporter.setEventService(this.plugin.settings);
			}

			if (includeEntities.sources) {
				exporter.setSourceService(this.plugin.settings);
			}

			if (includeEntities.places) {
				exporter.setPlaceGraphService(this.plugin.settings);
			}

			// Set property/value alias services (always needed for person data)
			const { PropertyAliasService } = await import('../core/property-alias-service');
			const { ValueAliasService } = await import('../core/value-alias-service');
			const propertyAliasService = new PropertyAliasService(this.plugin);
			const valueAliasService = new ValueAliasService(this.plugin);
			exporter.setPropertyAliasService(propertyAliasService);
			exporter.setValueAliasService(valueAliasService);

			// Update progress: generating export
			progressModal.updateProgress({ phase: 'generating', current: 1, total: 2 });

			// Export to GEDCOM X
			const result = exporter.exportToGedcomX({
				peopleFolder: this.plugin.settings.peopleFolder,
				collectionFilter: options.collectionFilter,
				branchRootCrId: options.branchRootCrId,
				branchDirection: options.branchDirection,
				branchIncludeSpouses: options.branchIncludeSpouses,
				fileName: options.fileName,
				sourceApp: 'Canvas Roots',
				sourceVersion: this.plugin.manifest.version,
				privacySettings: {
					enablePrivacyProtection: options.privacyOverride?.enablePrivacyProtection ?? this.plugin.settings.enablePrivacyProtection,
					livingPersonAgeThreshold: this.plugin.settings.livingPersonAgeThreshold,
					privacyDisplayFormat: options.privacyOverride?.privacyDisplayFormat ?? this.plugin.settings.privacyDisplayFormat,
					hideDetailsForLiving: this.plugin.settings.hideDetailsForLiving
				}
			});

			// Log results
			logger.info('gedcomx-export', `Export complete: ${result.personsExported} persons, ${result.relationshipsExported} relationships`);

			if (result.errors.length > 0) {
				logger.warn('gedcomx-export', `Export had ${result.errors.length} errors`);
				result.errors.forEach(error => logger.error('gedcomx-export', error));
			}

			// Update stats
			progressModal.updateStats({
				people: result.personsExported,
				relationships: result.relationshipsExported
			});

			if (result.success && result.jsonContent) {
				const outputDestination = options.outputDestination ?? 'download';

				// Update progress: writing file
				progressModal.updateProgress({ phase: 'writing', current: 2, total: 2 });

				if (outputDestination === 'vault') {
					// Save to vault
					const outputFolder = options.outputFolder || '';
					const fileName = `${result.fileName}.json`;
					const filePath = outputFolder ? `${outputFolder}/${fileName}` : fileName;

					await this.app.vault.adapter.write(filePath, result.jsonContent);

					// Save last export info
					this.plugin.settings.lastGedcomXExport = {
						timestamp: Date.now(),
						peopleCount: result.personsExported,
						destination: 'vault',
						filePath: filePath,
						privacyExcluded: result.privacyExcluded
					};
					await this.plugin.saveSettings();

					let noticeMsg = `GEDCOM X saved to vault: ${filePath}`;
					if (result.privacyExcluded && result.privacyExcluded > 0) {
						noticeMsg += ` (${result.privacyExcluded} living excluded)`;
					} else if (result.privacyObfuscated && result.privacyObfuscated > 0) {
						noticeMsg += ` (${result.privacyObfuscated} living obfuscated)`;
					}
					new Notice(noticeMsg);
				} else {
					// Download file
					const blob = new Blob([result.jsonContent], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = `${result.fileName}.json`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);

					// Save last export info
					this.plugin.settings.lastGedcomXExport = {
						timestamp: Date.now(),
						peopleCount: result.personsExported,
						destination: 'download',
						privacyExcluded: result.privacyExcluded
					};
					await this.plugin.saveSettings();

					let noticeMsg = `GEDCOM X exported: ${result.personsExported} people, ${result.relationshipsExported} relationships`;
					if (result.privacyExcluded && result.privacyExcluded > 0) {
						noticeMsg += ` (${result.privacyExcluded} living excluded)`;
					} else if (result.privacyObfuscated && result.privacyObfuscated > 0) {
						noticeMsg += ` (${result.privacyObfuscated} living obfuscated)`;
					}
					new Notice(noticeMsg);
				}

				// Mark export as complete
				progressModal.markComplete();

				// Close the modal after a short delay
				setTimeout(() => {
					progressModal.close();
				}, 1500);
			} else {
				throw new Error('Export failed to generate content');
			}
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('gedcomx-export', `GEDCOM X export failed: ${errorMsg}`);
			new Notice(`Failed to export GEDCOM X: ${errorMsg}`);
			progressModal.close();
		}
	}

	/**
	 * Render Gramps XML import options
	 */
	private renderGrampsImport(container: HTMLElement): void {
		const card = this.createCard({
			title: 'Import Gramps XML',
			icon: 'upload'
		});
		const content = card.querySelector('.crc-card__content') as HTMLElement;

		content.createEl('p', {
			text: 'Import family tree data from Gramps genealogy software XML format',
			cls: 'crc-text-muted crc-mb-4'
		});

		// Import destination options (only show if staging folder is configured)
		let importDestination: 'main' | 'staging' = 'main';
		let stagingSubfolder = `import-${new Date().toISOString().slice(0, 7)}`;

		const stagingFolder = this.plugin.settings.stagingFolder;
		if (stagingFolder) {
			new Setting(content)
				.setName('Import destination')
				.setDesc('Where to create person notes')
				.addDropdown(dropdown => dropdown
					.addOption('main', `Main tree (${this.plugin.settings.peopleFolder || 'vault root'})`)
					.addOption('staging', `Staging (${stagingFolder})`)
					.setValue(importDestination)
					.onChange(value => {
						importDestination = value as 'main' | 'staging';
						// Show/hide subfolder input
						// eslint-disable-next-line @typescript-eslint/no-misused-promises -- subfolderSetting is hoisted Setting, not a Promise
						if (subfolderSetting) {
							subfolderSetting.settingEl.toggleClass('cr-hidden', value !== 'staging');
						}
					})
				);

			// Subfolder input (hidden by default, shown when staging is selected)
			const subfolderSetting = new Setting(content)
				.setName('Subfolder name')
				.setDesc('Create imports in a subfolder for organization')
				.addText(text => text
					.setPlaceholder(stagingSubfolder)
					.setValue(stagingSubfolder)
					.onChange(value => {
						stagingSubfolder = value || `import-${new Date().toISOString().slice(0, 7)}`;
					})
				);
			subfolderSetting.settingEl.addClass('cr-hidden');
		}

		// File selection button
		const fileBtn = content.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-mt-4',
			text: 'Select Gramps XML file'
		});

		// Create hidden file input
		const fileInput = content.createEl('input', {
			attr: {
				type: 'file',
				accept: '.gramps,.xml',
				style: 'display: none;'
			}
		});

		// Analysis results container (hidden initially)
		const analysisContainer = content.createDiv({ cls: 'crc-gedcom-analysis cr-hidden' });

		fileBtn.addEventListener('click', () => {
			fileInput.click();
		});

		fileInput.addEventListener('change', (event) => {
			void (async () => {
				const target = event.target as HTMLInputElement;
				const file = target.files?.[0];
				if (file) {
					// Determine target folder based on import destination
					let targetFolder: string;
					if (importDestination === 'staging' && stagingFolder) {
						targetFolder = stagingSubfolder
							? `${stagingFolder}/${stagingSubfolder}`
							: stagingFolder;
					} else {
						targetFolder = this.plugin.settings.peopleFolder;
					}
					await this.showGrampsAnalysis(file, analysisContainer, fileBtn, targetFolder);
				}
			})();
		});

		container.appendChild(card);
	}

	/**
	 * Show Gramps XML file analysis before import
	 */
	private async showGrampsAnalysis(
		file: File,
		analysisContainer: HTMLElement,
		_fileBtn: HTMLButtonElement,
		targetFolder: string
	): Promise<void> {
		analysisContainer.empty();
		analysisContainer.removeClass('cr-hidden');

		// Show loading state
		analysisContainer.createEl('p', {
			text: 'Analyzing Gramps XML file...',
			cls: 'crc-text-muted'
		});

		try {
			// Read file with automatic gzip decompression for .gramps files
			const content = await readFileWithDecompression(file);

			// Validate it's a Gramps XML file
			if (!GrampsParser.isGrampsXml(content)) {
				analysisContainer.empty();
				analysisContainer.createEl('p', {
					text: 'This file does not appear to be a valid Gramps XML file. If this is a .gpkg package file, please extract the .gramps file from it first.',
					cls: 'crc-text-error'
				});
				return;
			}

			const importer = new GrampsImporter(this.app);
			const analysis = importer.analyzeFile(content);

			analysisContainer.empty();

			// Show analysis results
			const statsGrid = analysisContainer.createDiv({ cls: 'crc-stats-grid' });

			const createStat = (label: string, value: string | number) => {
				const stat = statsGrid.createDiv({ cls: 'crc-stat' });
				stat.createSpan({ text: String(value), cls: 'crc-stat-value' });
				stat.createSpan({ text: label, cls: 'crc-stat-label' });
			};

			createStat('Individuals', analysis.individualCount);
			createStat('Relationships', analysis.familyCount);
			createStat('Sources', analysis.sourceCount);
			createStat('Places', analysis.placeCount);
			createStat('Events', analysis.eventCount);
			createStat('Family groups', analysis.componentCount);

			// Import destination info
			analysisContainer.createEl('p', {
				text: `Import destination: ${targetFolder || 'vault root'}`,
				cls: 'crc-text-muted crc-mt-4'
			});

			// Import options
			let createSourceNotes = analysis.sourceCount > 0;
			let createPlaceNotes = analysis.placeCount > 0;
			let createEventNotes = analysis.eventCount > 0;
			const sourcesFolder = this.plugin.settings.sourcesFolder || 'Canvas Roots/Sources';
			const placesFolder = this.plugin.settings.placesFolder || 'Canvas Roots/Places';
			const eventsFolder = this.plugin.settings.eventsFolder || 'Canvas Roots/Events';

			const optionsSection = analysisContainer.createDiv({ cls: 'crc-mt-4' });

			if (analysis.sourceCount > 0) {
				new Setting(optionsSection)
					.setName(`Create source notes (${analysis.sourceCount.toLocaleString()} found)`)
					.setDesc(`Citations and references for genealogical records → ${sourcesFolder}/`)
					.addToggle(toggle => toggle
						.setValue(createSourceNotes)
						.onChange(value => {
							createSourceNotes = value;
						})
					);
			}

			if (analysis.placeCount > 0) {
				new Setting(optionsSection)
					.setName(`Create place notes (${analysis.placeCount.toLocaleString()} found)`)
					.setDesc(`Locations with parent/child hierarchy → ${placesFolder}/`)
					.addToggle(toggle => toggle
						.setValue(createPlaceNotes)
						.onChange(value => {
							createPlaceNotes = value;
						})
					);
			}

			if (analysis.eventCount > 0) {
				new Setting(optionsSection)
					.setName(`Create event notes (${analysis.eventCount.toLocaleString()} found)`)
					.setDesc(`Births, deaths, marriages, and other life events → ${eventsFolder}/`)
					.addToggle(toggle => toggle
						.setValue(createEventNotes)
						.onChange(value => {
							createEventNotes = value;
						})
					);
			}

			// Import button
			const importBtn = analysisContainer.createEl('button', {
				cls: 'crc-btn crc-btn--primary crc-mt-4',
				text: 'Import'
			});

			importBtn.addEventListener('click', () => {
				void this.handleGrampsImport(
					file,
					targetFolder,
					createSourceNotes,
					sourcesFolder,
					createPlaceNotes,
					placesFolder,
					createEventNotes,
					eventsFolder
				);
			});

		} catch (error: unknown) {
			analysisContainer.empty();
			analysisContainer.createEl('p', {
				text: `Error analyzing file: ${getErrorMessage(error)}`,
				cls: 'crc-text-error'
			});
		}
	}

	/**
	 * Handle Gramps XML file import
	 */
	private async handleGrampsImport(
		file: File,
		destFolder: string,
		createSourceNotes: boolean = true,
		sourcesFolder?: string,
		createPlaceNotes: boolean = false,
		placesFolder?: string,
		createEventNotes: boolean = false,
		eventsFolder?: string
	): Promise<void> {
		// Show progress modal (reuse GEDCOM modal, update title after open)
		const progressModal = new GedcomImportProgressModal(this.app);
		progressModal.open();
		// Update title for Gramps
		const title = progressModal.contentEl.querySelector('.crc-modal-title');
		if (title) {
			title.textContent = 'Importing Gramps';
		}

		try {
			// Read file with automatic gzip decompression for .gramps files
			const content = await readFileWithDecompression(file);

			logger.info('gramps', `Starting Gramps import: ${file.name} to ${destFolder}`);

			// Disable bidirectional sync during import to prevent duplicate relationships
			this.plugin.disableBidirectionalSync();

			const importer = new GrampsImporter(this.app);
			const result = await importer.importFile(content, {
				peopleFolder: destFolder,
				overwriteExisting: false,
				fileName: file.name,
				createSourceNotes,
				sourcesFolder,
				createPlaceNotes,
				placesFolder,
				createEventNotes,
				eventsFolder,
				propertyAliases: this.plugin.settings.propertyAliases,
				onProgress: (progress) => {
					progressModal.updateProgress({
						phase: progress.phase,
						current: progress.current,
						total: progress.total,
						message: progress.message
					});
					// Update running stats based on phase
					if (progress.phase === 'places' && progress.current > 0) {
						progressModal.updateStats({ places: progress.current });
					} else if (progress.phase === 'sources' && progress.current > 0) {
						progressModal.updateStats({ sources: progress.current });
					} else if (progress.phase === 'people' && progress.current > 0) {
						progressModal.updateStats({ people: progress.current });
					} else if (progress.phase === 'events' && progress.current > 0) {
						progressModal.updateStats({ events: progress.current });
					}
				}
			});

			// Re-enable bidirectional sync now that import is complete
			this.plugin.enableBidirectionalSync();

			// Mark progress as complete and close modal after a brief delay
			progressModal.markComplete();
			setTimeout(() => progressModal.close(), 1500);

			// Show results notification
			this.showGrampsImportResults(result);

			// Auto-create bases for imported note types (silently, skips if already exist)
			if (result.notesCreated > 0) {
				await this.plugin.createAllBases({ silent: true });
			}

			// Refresh status tab
			if (result.notesCreated > 0) {
				this.showTab('status');
			}

			// If successful, offer to assign reference numbers
			if (result.success && result.individualsImported > 0) {
				this.promptAssignReferenceNumbersAfterImport();
			}

		} catch (error: unknown) {
			// Re-enable bidirectional sync even on error
			this.plugin.enableBidirectionalSync();

			progressModal.close();
			const errorMsg = getErrorMessage(error);
			logger.error('gramps', `Gramps import failed: ${errorMsg}`);
			new Notice(`Import failed: ${errorMsg}`);
		}
	}

	/**
	 * Show Gramps XML import results
	 */
	private showGrampsImportResults(result: GrampsImportResult): void {
		let message = `Gramps import complete: ${result.individualsImported} people imported`;
		if (result.placeNotesCreated && result.placeNotesCreated > 0) {
			message += `, ${result.placeNotesCreated} places`;
		}
		if (result.eventNotesCreated && result.eventNotesCreated > 0) {
			message += `, ${result.eventNotesCreated} events`;
		}
		if (result.errors.length > 0) {
			message += ` (${result.errors.length} errors)`;
		}

		new Notice(message, 5000);

		// Log detailed results
		logger.info('gramps', 'Import results:', {
			imported: result.individualsImported,
			created: result.notesCreated,
			places: result.placeNotesCreated || 0,
			events: result.eventNotesCreated || 0,
			errors: result.errors.length
		});

		if (result.errors.length > 0) {
			logger.warn('gramps', 'Import errors:', result.errors);
		}
	}

	/**
	 * Render Gramps XML export options
	 */
	private renderGrampsExport(container: HTMLElement): void {
		const card = this.createCard({
			title: 'Export Gramps XML',
			icon: 'download'
		});
		const content = card.querySelector('.crc-card__content') as HTMLElement;

		content.createEl('p', {
			text: 'Export your family tree data to Gramps XML format for use with Gramps genealogy software',
			cls: 'crc-text-muted crc-mb-4'
		});

		// Use the new ExportOptionsBuilder
		const optionsBuilder = new ExportOptionsBuilder(this.app, this.plugin);

		// Last export info
		ExportOptionsBuilder.buildLastExportInfo(content, this.plugin.settings.lastGrampsExport, 'Gramps XML');

		// People folder (read-only display)
		new Setting(content)
			.setName('People folder')
			.setDesc('Folder containing person notes to export')
			.addText(text => text
				.setPlaceholder('People')
				.setValue(this.plugin.settings.peopleFolder)
				.setDisabled(true)
			);

		// Build shared export options using the builder
		optionsBuilder.buildCollectionFilter(content);
		optionsBuilder.buildBranchFilter(content);
		optionsBuilder.buildPrivacyOverride(content);
		optionsBuilder.buildEntityInclusion(content);
		optionsBuilder.buildOutputLocation(content);
		optionsBuilder.buildStatsPreview(content);

		// Export file name
		optionsBuilder.buildFileNameInput(content, 'family-tree', '.gramps');

		// Export button
		const exportBtn = content.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-mt-4',
			text: 'Export to Gramps'
		});

		exportBtn.addEventListener('click', () => {
			void (async () => {
				const options = optionsBuilder.getOptions();
				const privacySettings = optionsBuilder.getEffectivePrivacySettings();

				await this.handleGrampsExport({
					fileName: options.exportFileName,
					collectionFilter: options.collectionFilter,
					branchRootCrId: options.branchRootCrId,
					branchDirection: options.branchDirection,
					branchIncludeSpouses: options.branchIncludeSpouses,
					privacyOverride: options.privacyOverrideEnabled ? {
						enablePrivacyProtection: privacySettings.enablePrivacyProtection,
						privacyDisplayFormat: privacySettings.privacyDisplayFormat
					} : undefined,
					includeEntities: options.includeEntities,
					outputDestination: options.outputDestination,
					outputFolder: options.outputFolder
				});
			})();
		});

		container.appendChild(card);
	}

	/**
	 * Handle Gramps XML file export
	 */
	private async handleGrampsExport(options: {
		fileName: string;
		collectionFilter?: string;
		branchRootCrId?: string;
		branchDirection?: 'ancestors' | 'descendants';
		branchIncludeSpouses?: boolean;
		privacyOverride?: {
			enablePrivacyProtection: boolean;
			privacyDisplayFormat: 'living' | 'private' | 'initials' | 'hidden';
		};
		includeEntities?: {
			people: boolean;
			events: boolean;
			sources: boolean;
			places: boolean;
		};
		outputDestination?: 'download' | 'vault';
		outputFolder?: string;
	}): Promise<void> {
		// Create and open progress modal
		const { ExportProgressModal } = await import('./export-progress-modal');
		const progressModal = new ExportProgressModal(this.app, 'Gramps XML');
		progressModal.open();

		try {
			logger.info('gramps-export', `Starting Gramps export: ${options.fileName}`);

			// Update progress: loading data
			progressModal.updateProgress({ phase: 'loading', current: 0, total: 1 });

			// Create exporter
			const { GrampsExporter } = await import('../gramps/gramps-exporter');
			const exporter = new GrampsExporter(this.app);

			// Conditionally set services based on includeEntities flags
			const includeEntities = options.includeEntities ?? {
				people: true,
				events: true,
				sources: true,
				places: true
			};

			if (includeEntities.events) {
				exporter.setEventService(this.plugin.settings);
			}

			if (includeEntities.sources) {
				exporter.setSourceService(this.plugin.settings);
			}

			if (includeEntities.places) {
				exporter.setPlaceGraphService(this.plugin.settings);
			}

			// Set property/value alias services (always needed for person data)
			const { PropertyAliasService } = await import('../core/property-alias-service');
			const { ValueAliasService } = await import('../core/value-alias-service');
			const propertyAliasService = new PropertyAliasService(this.plugin);
			const valueAliasService = new ValueAliasService(this.plugin);
			exporter.setPropertyAliasService(propertyAliasService);
			exporter.setValueAliasService(valueAliasService);

			// Update progress: generating export
			progressModal.updateProgress({ phase: 'generating', current: 1, total: 2 });

			// Export to Gramps
			const result = exporter.exportToGramps({
				peopleFolder: this.plugin.settings.peopleFolder,
				collectionFilter: options.collectionFilter,
				branchRootCrId: options.branchRootCrId,
				branchDirection: options.branchDirection,
				branchIncludeSpouses: options.branchIncludeSpouses,
				fileName: options.fileName,
				sourceApp: 'Canvas Roots',
				sourceVersion: this.plugin.manifest.version,
				privacySettings: {
					enablePrivacyProtection: options.privacyOverride?.enablePrivacyProtection ?? this.plugin.settings.enablePrivacyProtection,
					livingPersonAgeThreshold: this.plugin.settings.livingPersonAgeThreshold,
					privacyDisplayFormat: options.privacyOverride?.privacyDisplayFormat ?? this.plugin.settings.privacyDisplayFormat,
					hideDetailsForLiving: this.plugin.settings.hideDetailsForLiving
				}
			});

			// Log results
			logger.info('gramps-export', `Export complete: ${result.personsExported} persons, ${result.familiesExported} families, ${result.eventsExported} events`);

			if (result.errors.length > 0) {
				logger.warn('gramps-export', `Export had ${result.errors.length} errors`);
				result.errors.forEach(error => logger.error('gramps-export', error));
			}

			// Update stats
			progressModal.updateStats({
				people: result.personsExported,
				relationships: result.familiesExported,
				events: result.eventsExported
			});

			if (result.success && result.xmlContent) {
				const outputDestination = options.outputDestination ?? 'download';

				// Update progress: writing file
				progressModal.updateProgress({ phase: 'writing', current: 2, total: 2 });

				if (outputDestination === 'vault') {
					// Save to vault
					const outputFolder = options.outputFolder || '';
					const fileName = `${result.fileName}.gramps`;
					const filePath = outputFolder ? `${outputFolder}/${fileName}` : fileName;

					await this.app.vault.adapter.write(filePath, result.xmlContent);

					// Save last export info
					this.plugin.settings.lastGrampsExport = {
						timestamp: Date.now(),
						peopleCount: result.personsExported,
						destination: 'vault',
						filePath: filePath,
						privacyExcluded: result.privacyExcluded
					};
					await this.plugin.saveSettings();

					let noticeMsg = `Gramps saved to vault: ${filePath}`;
					if (result.privacyExcluded && result.privacyExcluded > 0) {
						noticeMsg += ` (${result.privacyExcluded} living excluded)`;
					} else if (result.privacyObfuscated && result.privacyObfuscated > 0) {
						noticeMsg += ` (${result.privacyObfuscated} living obfuscated)`;
					}
					new Notice(noticeMsg);
				} else {
					// Download file
					const blob = new Blob([result.xmlContent], { type: 'application/xml' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = `${result.fileName}.gramps`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);

					// Save last export info
					this.plugin.settings.lastGrampsExport = {
						timestamp: Date.now(),
						peopleCount: result.personsExported,
						destination: 'download',
						privacyExcluded: result.privacyExcluded
					};
					await this.plugin.saveSettings();

					let noticeMsg = `Gramps exported: ${result.personsExported} people, ${result.familiesExported} families`;
					if (result.privacyExcluded && result.privacyExcluded > 0) {
						noticeMsg += ` (${result.privacyExcluded} living excluded)`;
					} else if (result.privacyObfuscated && result.privacyObfuscated > 0) {
						noticeMsg += ` (${result.privacyObfuscated} living obfuscated)`;
					}
					new Notice(noticeMsg);
				}

				// Mark export as complete
				progressModal.markComplete();

				// Close the modal after a short delay
				setTimeout(() => {
					progressModal.close();
				}, 1500);
			} else {
				throw new Error('Export failed to generate content');
			}
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('gramps-export', `Gramps export failed: ${errorMsg}`);
			new Notice(`Failed to export Gramps: ${errorMsg}`);
			progressModal.close();
		}
	}

	/**
	 * Render CSV import options
	 */
	private renderCsvImport(container: HTMLElement): void {
		const card = this.createCard({
			title: 'Import CSV',
			icon: 'upload'
		});
		const content = card.querySelector('.crc-card__content') as HTMLElement;

		content.createEl('p', {
			text: 'Import person data from a CSV/spreadsheet file. Column mapping is auto-detected.',
			cls: 'crc-text-muted crc-mb-4'
		});

		// Import destination options (only show if staging folder is configured)
		let csvImportDestination: 'main' | 'staging' = 'main';
		let csvStagingSubfolder = `import-${new Date().toISOString().slice(0, 7)}`;

		const csvStagingFolder = this.plugin.settings.stagingFolder;
		if (csvStagingFolder) {
			new Setting(content)
				.setName('Import destination')
				.setDesc('Where to create person notes')
				.addDropdown(dropdown => dropdown
					.addOption('main', `Main tree (${this.plugin.settings.peopleFolder || 'vault root'})`)
					.addOption('staging', `Staging (${csvStagingFolder})`)
					.setValue(csvImportDestination)
					.onChange(value => {
						csvImportDestination = value as 'main' | 'staging';
						// Show/hide subfolder input
						// eslint-disable-next-line @typescript-eslint/no-misused-promises -- csvSubfolderSetting is hoisted Setting, not a Promise
						if (csvSubfolderSetting) {
							csvSubfolderSetting.settingEl.toggleClass('cr-hidden', value !== 'staging');
						}
					})
				);

			// Subfolder input (hidden by default, shown when staging is selected)
			const csvSubfolderSetting = new Setting(content)
				.setName('Subfolder name')
				.setDesc('Create imports in a subfolder for organization')
				.addText(text => text
					.setPlaceholder(csvStagingSubfolder)
					.setValue(csvStagingSubfolder)
					.onChange(value => {
						csvStagingSubfolder = value || `import-${new Date().toISOString().slice(0, 7)}`;
					})
				);
			csvSubfolderSetting.settingEl.addClass('cr-hidden');
		}

		// File selection button
		const fileBtn = content.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-mt-4',
			text: 'Select CSV file'
		});

		// Create hidden file input
		const fileInput = content.createEl('input', {
			attr: {
				type: 'file',
				accept: '.csv,.tsv,.txt',
				style: 'display: none;'
			}
		});

		// Analysis results container (hidden initially)
		const analysisContainer = content.createDiv({ cls: 'crc-csv-analysis cr-hidden' });

		fileBtn.addEventListener('click', () => {
			fileInput.click();
		});

		fileInput.addEventListener('change', (event) => {
			void (async () => {
				const target = event.target as HTMLInputElement;
				const file = target.files?.[0];
				if (file) {
					// Determine target folder based on import destination
					let csvTargetFolder: string;
					if (csvImportDestination === 'staging' && csvStagingFolder) {
						csvTargetFolder = csvStagingSubfolder
							? `${csvStagingFolder}/${csvStagingSubfolder}`
							: csvStagingFolder;
					} else {
						csvTargetFolder = this.plugin.settings.peopleFolder;
					}
					await this.showCsvAnalysis(file, analysisContainer, fileBtn, csvTargetFolder);
				}
			})();
		});

		container.appendChild(card);
	}

	/**
	 * Render CSV export options
	 */
	private renderCsvExport(container: HTMLElement): void {
		const card = this.createCard({
			title: 'Export CSV',
			icon: 'download'
		});
		const content = card.querySelector('.crc-card__content') as HTMLElement;

		content.createEl('p', {
			text: 'Export your family tree data to CSV format for use in spreadsheet applications',
			cls: 'crc-text-muted crc-mb-4'
		});

		// Use the new ExportOptionsBuilder
		const optionsBuilder = new ExportOptionsBuilder(this.app, this.plugin);

		// Last export info
		ExportOptionsBuilder.buildLastExportInfo(content, this.plugin.settings.lastCsvExport, 'CSV');

		// People folder (read-only display)
		new Setting(content)
			.setName('People folder')
			.setDesc('Folder containing person notes to export')
			.addText(text => text
				.setPlaceholder('People')
				.setValue(this.plugin.settings.peopleFolder)
				.setDisabled(true)
			);

		// Build shared export options using the builder
		optionsBuilder.buildCollectionFilter(content);
		optionsBuilder.buildBranchFilter(content);
		optionsBuilder.buildPrivacyOverride(content);
		optionsBuilder.buildEntityInclusion(content);
		optionsBuilder.buildOutputLocation(content);
		optionsBuilder.buildStatsPreview(content);

		// Export file name
		optionsBuilder.buildFileNameInput(content, 'family-tree', '.csv');

		// Export button
		const exportBtn = content.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-mt-4',
			text: 'Export to CSV'
		});

		exportBtn.addEventListener('click', () => {
			void (async () => {
				const options = optionsBuilder.getOptions();
				const privacySettings = optionsBuilder.getEffectivePrivacySettings();

				await this.handleCsvExport({
					fileName: options.exportFileName,
					collectionFilter: options.collectionFilter,
					branchRootCrId: options.branchRootCrId,
					branchDirection: options.branchDirection,
					branchIncludeSpouses: options.branchIncludeSpouses,
					privacyOverride: options.privacyOverrideEnabled ? {
						enablePrivacyProtection: privacySettings.enablePrivacyProtection,
						privacyDisplayFormat: privacySettings.privacyDisplayFormat
					} : undefined,
					includeEntities: options.includeEntities,
					outputDestination: options.outputDestination,
					outputFolder: options.outputFolder
				});
			})();
		});

		container.appendChild(card);
	}

	/**
	 * Show CSV analysis before import
	 */
	private async showCsvAnalysis(
		file: File,
		analysisContainer: HTMLElement,
		fileBtn: HTMLButtonElement,
		targetFolder?: string
	): Promise<void> {
		try {
			// Show loading state
			analysisContainer.empty();
			analysisContainer.removeClass('cr-hidden');
			fileBtn.addClass('cr-hidden');

			// Determine destination folder
			const destFolder = targetFolder || this.plugin.settings.peopleFolder;

			analysisContainer.createEl('p', {
				text: `File: ${file.name}`,
				cls: 'crc-text-muted'
			});

			analysisContainer.createEl('p', {
				text: `Destination: ${destFolder || 'vault root'}`,
				cls: 'crc-text-muted'
			});

			const loadingMsg = analysisContainer.createEl('p', {
				text: 'Analyzing file...',
				cls: 'crc-text-muted'
			});

			// Read and analyze file
			const content = await file.text();
			const { CsvImporter } = await import('../csv/csv-importer');
			const importer = new CsvImporter(this.app);

			// Detect delimiter based on file extension
			const parseOptions = {
				delimiter: file.name.endsWith('.tsv') ? '\t' : ','
			};

			const analysis = importer.analyzeFile(content, parseOptions);

			// Update UI with analysis results
			loadingMsg.remove();

			const results = analysisContainer.createDiv({ cls: 'crc-analysis-results' });

			// Basic stats
			results.createEl('p', {
				text: `✓ ${analysis.rowCount} people found`
			});
			results.createEl('p', {
				text: `✓ ${analysis.headers.length} columns detected`
			});

			// Show detected column mapping
			const mappedFields = Object.entries(analysis.detectedMapping).filter(([, v]) => v);
			if (mappedFields.length > 0) {
				results.createEl('p', {
					text: `✓ Auto-detected fields: ${mappedFields.map(([k]) => k).join(', ')}`,
					cls: 'crc-text-muted'
				});
			}

			// Check for required columns
			if (!analysis.detectedMapping.name) {
				results.createEl('p', {
					text: '⚠ No "name" column detected - import may fail',
					cls: 'crc-warning-text'
				});
			}

			// Action buttons
			const actions = analysisContainer.createDiv({ cls: 'crc-csv-actions crc-mt-4' });

			const importBtn = actions.createEl('button', {
				cls: 'crc-btn crc-btn--primary',
				text: destFolder.includes('Staging') || destFolder.includes('staging')
					? 'Import to Staging'
					: 'Import to Vault'
			});
			importBtn.addEventListener('click', () => {
				void (async () => {
					analysisContainer.addClass('cr-hidden');
					fileBtn.removeClass('cr-hidden');
					await this.handleCsvImport(file, parseOptions, destFolder);
				})();
			});

			const cancelBtn = actions.createEl('button', {
				cls: 'crc-btn crc-btn--secondary crc-ml-2',
				text: 'Cancel'
			});
			cancelBtn.addEventListener('click', () => {
				analysisContainer.addClass('cr-hidden');
				fileBtn.removeClass('cr-hidden');
			});

		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('csv', `CSV analysis failed: ${errorMsg}`);
			analysisContainer.empty();
			analysisContainer.createEl('p', {
				text: `Failed to analyze file: ${errorMsg}`,
				cls: 'crc-error-text'
			});

			const retryBtn = analysisContainer.createEl('button', {
				cls: 'crc-btn crc-btn--secondary crc-mt-2',
				text: 'Try different file'
			});
			retryBtn.addEventListener('click', () => {
				analysisContainer.addClass('cr-hidden');
				fileBtn.removeClass('cr-hidden');
			});
		}
	}

	/**
	 * Handle CSV file import
	 */
	private async handleCsvImport(file: File, parseOptions?: { delimiter: string }, targetFolder?: string): Promise<void> {
		try {
			// Use target folder if provided, otherwise use settings
			const destFolder = targetFolder || this.plugin.settings.peopleFolder;
			logger.info('csv', `Starting CSV import: ${file.name} to ${destFolder}`);

			// Read file content
			const content = await file.text();

			// Disable bidirectional sync during import to prevent duplicate relationships
			this.plugin.disableBidirectionalSync();

			// Create importer
			const { CsvImporter } = await import('../csv/csv-importer');
			const importer = new CsvImporter(this.app);

			// Import CSV file
			let result;
			try {
				result = await importer.importFile(content, {
					peopleFolder: destFolder,
					overwriteExisting: false,
					fileName: file.name,
					parseOptions
				});
			} finally {
				// Re-enable bidirectional sync after import
				this.plugin.enableBidirectionalSync();
			}

			// Log results
			logger.info('csv', `Import complete: ${result.recordsImported} records processed`);

			if (result.errors.length > 0) {
				logger.warn('csv', `Import had ${result.errors.length} errors`);
				result.errors.forEach(error => logger.error('csv', error));
			}

			// Track import in recent imports history
			if (result.success && result.notesCreated > 0) {
				const importInfo: RecentImportInfo = {
					fileName: file.name,
					recordsImported: result.recordsImported,
					notesCreated: result.notesCreated,
					timestamp: Date.now()
				};

				this.plugin.settings.recentImports.unshift(importInfo);
				if (this.plugin.settings.recentImports.length > 10) {
					this.plugin.settings.recentImports = this.plugin.settings.recentImports.slice(0, 10);
				}
				await this.plugin.saveSettings();
			}

			// Sync bidirectional relationships after import if enabled
			if (this.plugin.settings.enableBidirectionalSync && result.success && result.notesCreated > 0) {
				await this.syncImportedRelationships();
			}

			// Show import results notice
			let noticeMsg = `CSV import: ${result.notesCreated} created, ${result.notesUpdated} updated`;
			if (result.errors.length > 0) {
				noticeMsg += `, ${result.errors.length} errors`;
			}
			new Notice(noticeMsg, 5000);

			// Refresh status tab
			if (result.notesCreated > 0) {
				this.showTab('status');
			}

			// If successful, offer to assign reference numbers
			if (result.success && result.notesCreated > 0) {
				this.promptAssignReferenceNumbersAfterImport();
			}
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('csv', `CSV import failed: ${errorMsg}`);
			new Notice(`Failed to import CSV: ${errorMsg}`);
		}
	}

	/**
	 * Handle CSV file export
	 */
	private async handleCsvExport(options: {
		fileName: string;
		collectionFilter?: string;
		branchRootCrId?: string;
		branchDirection?: 'ancestors' | 'descendants';
		branchIncludeSpouses?: boolean;
		privacyOverride?: {
			enablePrivacyProtection: boolean;
			privacyDisplayFormat: 'living' | 'private' | 'initials' | 'hidden';
		};
		includeEntities?: {
			people: boolean;
			events: boolean;
			sources: boolean;
			places: boolean;
		};
		outputDestination?: 'download' | 'vault';
		outputFolder?: string;
	}): Promise<void> {
		// Create and open progress modal
		const { ExportProgressModal } = await import('./export-progress-modal');
		const progressModal = new ExportProgressModal(this.app, 'CSV');
		progressModal.open();

		try {
			logger.info('csv-export', `Starting CSV export: ${options.fileName}`);

			// Update progress: loading data
			progressModal.updateProgress({ phase: 'loading', current: 0, total: 1 });

			// Create exporter
			const { CsvExporter } = await import('../csv/csv-exporter');
			const exporter = new CsvExporter(this.app);

			// Conditionally set services based on includeEntities flags
			const includeEntities = options.includeEntities ?? {
				people: true,
				events: true,
				sources: true,
				places: true
			};

			if (includeEntities.events) {
				exporter.setEventService(this.plugin.settings);
			}

			if (includeEntities.sources) {
				exporter.setSourceService(this.plugin.settings);
			}

			if (includeEntities.places) {
				exporter.setPlaceGraphService(this.plugin.settings);
			}

			// Set property/value alias services (always needed for person data)
			const { PropertyAliasService } = await import('../core/property-alias-service');
			const { ValueAliasService } = await import('../core/value-alias-service');
			const propertyAliasService = new PropertyAliasService(this.plugin);
			const valueAliasService = new ValueAliasService(this.plugin);
			exporter.setPropertyAliasService(propertyAliasService);
			exporter.setValueAliasService(valueAliasService);

			// Update progress: generating export
			progressModal.updateProgress({ phase: 'generating', current: 1, total: 2 });

			// Export to CSV
			const result = exporter.exportToCsv({
				peopleFolder: this.plugin.settings.peopleFolder,
				collectionFilter: options.collectionFilter,
				branchRootCrId: options.branchRootCrId,
				branchDirection: options.branchDirection,
				branchIncludeSpouses: options.branchIncludeSpouses,
				fileName: options.fileName,
				privacySettings: {
					enablePrivacyProtection: options.privacyOverride?.enablePrivacyProtection ?? this.plugin.settings.enablePrivacyProtection,
					livingPersonAgeThreshold: this.plugin.settings.livingPersonAgeThreshold,
					privacyDisplayFormat: options.privacyOverride?.privacyDisplayFormat ?? this.plugin.settings.privacyDisplayFormat,
					hideDetailsForLiving: this.plugin.settings.hideDetailsForLiving
				}
			});

			// Log results
			logger.info('csv-export', `Export complete: ${result.recordsExported} records`);

			if (result.errors.length > 0) {
				logger.warn('csv-export', `Export had ${result.errors.length} errors`);
				result.errors.forEach(error => logger.error('csv-export', error));
			}

			// Update stats
			progressModal.updateStats({
				people: result.recordsExported
			});

			if (result.success && result.csvContent) {
				const outputDestination = options.outputDestination ?? 'download';

				// Update progress: writing file
				progressModal.updateProgress({ phase: 'writing', current: 2, total: 2 });

				if (outputDestination === 'vault') {
					// Save to vault
					const outputFolder = options.outputFolder || '';
					const fileName = `${result.fileName}.csv`;
					const filePath = outputFolder ? `${outputFolder}/${fileName}` : fileName;

					await this.app.vault.adapter.write(filePath, result.csvContent);

					// Save last export info
					this.plugin.settings.lastCsvExport = {
						timestamp: Date.now(),
						peopleCount: result.recordsExported,
						destination: 'vault',
						filePath: filePath,
						privacyExcluded: result.privacyExcluded
					};
					await this.plugin.saveSettings();

					let noticeMsg = `CSV saved to vault: ${filePath}`;
					if (result.privacyExcluded && result.privacyExcluded > 0) {
						noticeMsg += ` (${result.privacyExcluded} living excluded)`;
					} else if (result.privacyObfuscated && result.privacyObfuscated > 0) {
						noticeMsg += ` (${result.privacyObfuscated} living obfuscated)`;
					}
					new Notice(noticeMsg);
				} else {
					// Download file
					const blob = new Blob([result.csvContent], { type: 'text/csv;charset=utf-8' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = `${result.fileName}.csv`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);

					// Save last export info
					this.plugin.settings.lastCsvExport = {
						timestamp: Date.now(),
						peopleCount: result.recordsExported,
						destination: 'download',
						privacyExcluded: result.privacyExcluded
					};
					await this.plugin.saveSettings();

					let noticeMsg = `CSV exported: ${result.recordsExported} people`;
					if (result.privacyExcluded && result.privacyExcluded > 0) {
						noticeMsg += ` (${result.privacyExcluded} living excluded)`;
					} else if (result.privacyObfuscated && result.privacyObfuscated > 0) {
						noticeMsg += ` (${result.privacyObfuscated} living obfuscated)`;
					}
					new Notice(noticeMsg);
				}

				// Mark export as complete
				progressModal.markComplete();

				// Close the modal after a short delay
				setTimeout(() => {
					progressModal.close();
				}, 1500);
			} else {
				throw new Error('Export failed to generate content');
			}
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('csv-export', `CSV export failed: ${errorMsg}`);
			new Notice(`Failed to export CSV: ${errorMsg}`);
			progressModal.close();
		}
	}

	// ==========================================================================
	// STAGING HELPERS (used by Import/Export tab)
	// ==========================================================================

	/**
	 * Render files directly in staging root (no subfolders)
	 */
	private renderStagingRootFiles(
		container: HTMLElement,
		stagingService: StagingService,
		crossImportService: CrossImportDetectionService
	): void {
		const files = stagingService.getStagingPersonFiles();

		const itemEl = container.createDiv({ cls: 'crc-staging-item' });

		// Header
		const headerEl = itemEl.createDiv({ cls: 'crc-staging-item__header' });

		const iconEl = headerEl.createDiv({ cls: 'crc-staging-item__icon' });
		setLucideIcon(iconEl, 'folder', 20);

		const infoEl = headerEl.createDiv({ cls: 'crc-staging-item__info' });
		infoEl.createEl('strong', { text: 'Staging root' });
		infoEl.createEl('span', {
			text: `${files.length} people`,
			cls: 'crc-text-muted'
		});

		// Actions
		const actionsEl = itemEl.createDiv({ cls: 'crc-staging-item__actions' });

		const checkBtn = actionsEl.createEl('button', {
			text: 'Check duplicates',
			cls: 'crc-btn-secondary'
		});
		checkBtn.addEventListener('click', () => {
			this.runCrossImportCheck(crossImportService);
		});

		const promoteBtn = actionsEl.createEl('button', {
			text: 'Promote all',
			cls: 'mod-cta'
		});
		promoteBtn.addEventListener('click', () => {
			void this.promoteAllStaging(stagingService, crossImportService);
		});
	}

	/**
	 * Render a staging subfolder item
	 */
	private renderStagingSubfolder(
		container: HTMLElement,
		subfolder: StagingSubfolderInfo,
		stagingService: StagingService,
		crossImportService: CrossImportDetectionService
	): void {
		const itemEl = container.createDiv({ cls: 'crc-staging-item' });

		// Header
		const headerEl = itemEl.createDiv({ cls: 'crc-staging-item__header' });

		const iconEl = headerEl.createDiv({ cls: 'crc-staging-item__icon' });
		setLucideIcon(iconEl, 'folder', 20);

		const infoEl = headerEl.createDiv({ cls: 'crc-staging-item__info' });
		infoEl.createEl('strong', { text: subfolder.name });

		const statsEl = infoEl.createDiv({ cls: 'crc-staging-item__stats' });
		statsEl.createEl('span', {
			text: `${subfolder.personCount} people`,
			cls: 'crc-text-muted'
		});

		// Modified date
		const dateStr = subfolder.modifiedDate ? subfolder.modifiedDate.toLocaleDateString() : 'Unknown';
		statsEl.createEl('span', {
			text: `Modified: ${dateStr}`,
			cls: 'crc-text-muted'
		});

		// Actions
		const actionsEl = itemEl.createDiv({ cls: 'crc-staging-item__actions' });

		const checkBtn = actionsEl.createEl('button', {
			text: 'Check duplicates',
			cls: 'crc-btn-secondary'
		});
		checkBtn.addEventListener('click', () => {
			this.runCrossImportCheck(crossImportService, subfolder.path);
		});

		const promoteBtn = actionsEl.createEl('button', {
			text: 'Promote',
			cls: 'mod-cta'
		});
		promoteBtn.addEventListener('click', () => {
			void this.promoteStagingSubfolder(stagingService, subfolder.path, crossImportService);
		});

		const deleteBtn = actionsEl.createEl('button', {
			cls: 'crc-btn-danger'
		});
		setLucideIcon(deleteBtn, 'trash', 16);
		deleteBtn.addEventListener('click', () => {
			void this.deleteStagingSubfolder(stagingService, subfolder.path, subfolder.name);
		});
	}

	/**
	 * Run cross-import duplicate check
	 */
	private runCrossImportCheck(
		crossImportService: CrossImportDetectionService,
		subfolderPath?: string
	): void {
		const matches = crossImportService.findCrossImportMatches(subfolderPath);

		if (matches.length === 0) {
			new Notice('No duplicates found. All staging data appears unique.');
			return;
		}

		// Open the review modal
		const modal = new CrossImportReviewModal(
			this.app,
			this.plugin,
			matches,
			crossImportService
		);
		modal.open();
	}

	/**
	 * Promote all staging data to main tree
	 */
	private async promoteAllStaging(
		stagingService: StagingService,
		crossImportService?: CrossImportDetectionService
	): Promise<void> {
		const stats = stagingService.getStagingStats();

		if (stats.totalPeople === 0) {
			new Notice('No staging data to promote');
			return;
		}

		// Confirm action
		const confirmed = await this.confirmAction(
			'Promote all staging data',
			`This will move ${stats.totalPeople} people from staging to your main people folder. Files marked as "same person" will be skipped. Continue?`
		);

		if (!confirmed) return;

		try {
			// Create shouldSkip function that checks for "same person" resolutions
			const shouldSkip = crossImportService
				? (_file: TFile, crId: string | undefined) => {
					if (!crId) return false;
					// Check all resolutions for this staging crId
					const resolutions = crossImportService.getResolutions();
					return resolutions.some(r => r.stagingCrId === crId && r.resolution === 'same');
				}
				: undefined;

			const result = await stagingService.promoteAll({ shouldSkip });

			if (result.success) {
				let message = `Promoted ${result.filesPromoted} people to main tree`;
				if (result.filesSkipped > 0) {
					message += ` (${result.filesSkipped} skipped as duplicates)`;
				}
				new Notice(message);
				// Refresh the tab
				this.showImportExportTab();
			} else {
				new Notice(`Promotion failed: ${result.errors.join(', ')}`);
			}
		} catch (error) {
			const msg = getErrorMessage(error);
			logger.error('staging', `Promote all failed: ${msg}`);
			new Notice(`Failed to promote staging data: ${msg}`);
		}
	}

	/**
	 * Promote a specific staging subfolder
	 */
	private async promoteStagingSubfolder(
		stagingService: StagingService,
		subfolderPath: string,
		crossImportService?: CrossImportDetectionService
	): Promise<void> {
		try {
			// Create shouldSkip function that checks for "same person" resolutions
			const shouldSkip = crossImportService
				? (_file: TFile, crId: string | undefined) => {
					if (!crId) return false;
					const resolutions = crossImportService.getResolutions();
					return resolutions.some(r => r.stagingCrId === crId && r.resolution === 'same');
				}
				: undefined;

			const result = await stagingService.promoteSubfolder(subfolderPath, { shouldSkip });

			if (result.success) {
				let message = `Promoted ${result.filesPromoted} people to main tree`;
				if (result.filesSkipped > 0) {
					message += ` (${result.filesSkipped} skipped as duplicates)`;
				}
				new Notice(message);
				// Refresh the tab
				this.showImportExportTab();
			} else {
				new Notice(`Promotion failed: ${result.errors.join(', ')}`);
			}
		} catch (error) {
			const msg = getErrorMessage(error);
			logger.error('staging', `Promote subfolder failed: ${msg}`);
			new Notice(`Failed to promote: ${msg}`);
		}
	}

	/**
	 * Delete all staging data
	 */
	private async deleteAllStaging(stagingService: StagingService): Promise<void> {
		const stats = stagingService.getStagingStats();

		if (stats.totalPeople === 0) {
			new Notice('No staging data to delete');
			return;
		}

		// Confirm action
		const confirmed = await this.confirmAction(
			'Delete all staging data',
			`This will permanently delete ${stats.totalPeople} people from staging. This cannot be undone. Continue?`
		);

		if (!confirmed) return;

		try {
			const result = await stagingService.deleteAllStaging();

			if (result.success) {
				new Notice(`Deleted ${result.filesDeleted} files from staging`);
				// Refresh the tab
				this.showImportExportTab();
			} else {
				new Notice(`Delete failed: ${result.error}`);
			}
		} catch (error) {
			const msg = getErrorMessage(error);
			logger.error('staging', `Delete all staging failed: ${msg}`);
			new Notice(`Failed to delete staging data: ${msg}`);
		}
	}

	/**
	 * Delete a specific staging subfolder
	 */
	private async deleteStagingSubfolder(
		stagingService: StagingService,
		subfolderPath: string,
		subfolderName: string
	): Promise<void> {
		// Confirm action
		const confirmed = await this.confirmAction(
			'Delete staging import',
			`This will permanently delete all data in "${subfolderName}". This cannot be undone. Continue?`
		);

		if (!confirmed) return;

		try {
			const result = await stagingService.deleteSubfolder(subfolderPath);

			if (result.success) {
				new Notice(`Deleted ${result.filesDeleted} files`);
				// Refresh the tab
				this.showImportExportTab();
			} else {
				new Notice(`Delete failed: ${result.error}`);
			}
		} catch (error) {
			const msg = getErrorMessage(error);
			logger.error('staging', `Delete subfolder failed: ${msg}`);
			new Notice(`Failed to delete: ${msg}`);
		}
	}

	/**
	 * Show a confirmation dialog
	 */
	private confirmAction(title: string, message: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmationModal(this.app, title, message, resolve);
			modal.open();
		});
	}

	/**
	 * Show placeholder for unimplemented tabs
	 */
	private showPlaceholderTab(tabId: string): void {
		const container = this.contentContainer;
		const tabConfig = TAB_CONFIGS.find(t => t.id === tabId);

		const card = this.createCard({
			title: tabConfig?.name || 'Coming soon',
			icon: tabConfig?.icon || 'info'
		});

		const content = card.querySelector('.crc-card__content') as HTMLElement;
		content.createEl('p', {
			text: tabConfig?.description || 'This tab is under construction.',
			cls: 'crc-text-muted'
		});

		container.appendChild(card);
	}

	// ==========================================================================
	// UTILITY METHODS
	// ==========================================================================

	/**
	 * Create a Material Design card
	 */
	private createCard(options: {
		title: string;
		icon?: LucideIconName;
		subtitle?: string;
		elevation?: number;
	}): HTMLElement {
		const card = document.createElement('div');
		card.className = 'crc-card';

		if (options.elevation) {
			card.classList.add(`crc-elevation-${options.elevation}`);
		}

		// Header
		const header = card.createDiv({ cls: 'crc-card__header' });
		const titleContainer = header.createDiv({ cls: 'crc-card__title' });

		if (options.icon) {
			const icon = createLucideIcon(options.icon, 24);
			titleContainer.appendChild(icon);
		}

		titleContainer.appendText(options.title);

		if (options.subtitle) {
			const subtitle = header.createDiv({ cls: 'crc-card__subtitle' });
			subtitle.textContent = options.subtitle;
		}

		// Content (empty, to be filled by caller)
		card.createDiv({ cls: 'crc-card__content' });

		return card;
	}

	/**
	 * Create a relationship field with link button
	 */
	private createRelationshipField(
		container: HTMLElement,
		label: string,
		placeholder: string,
		fieldData: RelationshipField
	): { input: HTMLInputElement; linkBtn: HTMLButtonElement; helpEl: HTMLElement } {
		const group = container.createDiv({ cls: 'crc-form-group' });
		group.createDiv({ cls: 'crc-form-label', text: label });

		// Input container with button
		const inputContainer = group.createDiv({ cls: 'crc-input-with-button' });

		const input = inputContainer.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'text',
				placeholder: placeholder,
				readonly: true
			}
		});

		const linkBtn = inputContainer.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-input-button',
			attr: {
				type: 'button'
			}
		});
		const linkIcon = createLucideIcon('link', 16);
		linkBtn.appendChild(linkIcon);
		linkBtn.appendText('Link');

		// Help text
		const helpText = group.createDiv({ cls: 'crc-form-help' });
		this.updateHelpText(helpText, fieldData);

		// Link button handler
		linkBtn.addEventListener('click', () => {
			const picker = new PersonPickerModal(this.app, (person: PersonInfo) => {
				fieldData.name = person.name;
				fieldData.crId = person.crId;
				input.value = person.name;
				input.addClass('crc-input--linked');
				linkBtn.textContent = '';
				const unlinkIcon = createLucideIcon('unlink', 16);
				linkBtn.appendChild(unlinkIcon);
				linkBtn.appendText('Unlink');
				this.updateHelpText(helpText, fieldData);
			});
			picker.open();
		});

		return { input, linkBtn, helpEl: helpText };
	}

	/**
	 * Update help text for relationship field
	 */
	private updateHelpText(helpEl: HTMLElement, fieldData: RelationshipField): void {
		helpEl.empty();
		if (fieldData.crId) {
			helpEl.appendText('Linked to: ');
			helpEl.createEl('code', {
				text: fieldData.name,
				cls: 'crc-help-badge'
			});
		} else {
			helpEl.appendText('Click "Link" to select a person from your vault');
		}
	}

	/**
	 * Setup unlink functionality for a relationship field
	 */
	private setupUnlinkButton(
		input: HTMLInputElement,
		button: HTMLButtonElement,
		fieldData: RelationshipField,
		helpEl: HTMLElement
	): void {
		button.addEventListener('click', () => {
			if (fieldData.crId) {
				// Unlink
				fieldData.name = '';
				fieldData.crId = undefined;
				input.value = '';
				input.removeClass('crc-input--linked');
				button.textContent = '';
				const linkIcon = createLucideIcon('link', 16);
				button.appendChild(linkIcon);
				button.appendText('Link');
				this.updateHelpText(helpEl, fieldData);
			}
		});
	}

	/**
	 * Build root person accordion content for the two-panel Tree Output layout
	 * Reuses the same logic as createRootPersonCard but without the card wrapper
	 */
	private buildRootPersonAccordionContent(container: HTMLElement, rootPersonField: RelationshipField): void {
		// Selected person display (compact, hidden when empty)
		const personDisplay = container.createDiv({ cls: `crc-root-person-display crc-root-person-display--compact${rootPersonField.crId ? '' : ' crc-hidden'}` });
		this.updateRootPersonDisplayCompact(personDisplay, rootPersonField);

		// Person browser section (inline, compact)
		const browserSection = container.createDiv({ cls: 'crc-person-browser crc-person-browser--compact' });
		const browserContent = browserSection.createDiv({ cls: 'crc-person-browser__content' });

		// Load all people from vault
		const allPeople: PersonInfo[] = [];
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const personInfo = this.extractPersonInfoFromFile(file);
			if (personInfo) {
				allPeople.push(personInfo);
			}
		}

		// Load family components
		const graphService = this.plugin.createFamilyGraphService();
		const familyComponents = graphService.findAllFamilyComponents();

		// Build component map
		const componentMap = new Map<string, number>();
		familyComponents.forEach((component, index) => {
			component.people.forEach(person => {
				componentMap.set(person.crId, index);
			});
		});

		// Search bar
		const searchBar = browserContent.createDiv({ cls: 'crc-person-browser__search' });
		const searchInput = searchBar.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'text',
				placeholder: 'Search by name or ID...'
			}
		});

		// All controls on one row: Sort, Living, Sex
		const controlsBar = browserContent.createDiv({ cls: 'crc-person-browser__controls crc-person-browser__controls--inline' });

		// Sort dropdown
		const sortContainer = controlsBar.createDiv({ cls: 'crc-picker-filter' });
		sortContainer.createSpan({ cls: 'crc-picker-filter__label', text: 'Sort:' });
		const sortSelect = sortContainer.createEl('select', { cls: 'crc-form-select crc-form-select--small' });

		type SortOption = 'name-asc' | 'name-desc' | 'birth-asc' | 'birth-desc' | 'recent';
		let sortOption: SortOption = 'name-asc';

		const sortOptions: Array<{ value: SortOption; label: string }> = [
			{ value: 'name-asc', label: 'Name (A-Z)' },
			{ value: 'name-desc', label: 'Name (Z-A)' },
			{ value: 'birth-asc', label: 'Birth (oldest)' },
			{ value: 'birth-desc', label: 'Birth (newest)' },
			{ value: 'recent', label: 'Recent' }
		];

		sortOptions.forEach(opt => {
			const option = sortSelect.createEl('option', { value: opt.value, text: opt.label });
			if (opt.value === sortOption) {
				option.selected = true;
			}
		});

		// Filters
		interface FilterOptions {
			livingStatus: 'all' | 'living' | 'deceased';
			hasBirthDate: 'all' | 'yes' | 'no';
			sex: 'all' | 'M' | 'F';
		}

		const filters: FilterOptions = {
			livingStatus: 'all',
			hasBirthDate: 'all',
			sex: 'all'
		};

		// Living status filter
		const livingFilter = controlsBar.createDiv({ cls: 'crc-picker-filter' });
		livingFilter.createSpan({ cls: 'crc-picker-filter__label', text: 'Living:' });
		const livingSelect = livingFilter.createEl('select', { cls: 'crc-form-select crc-form-select--small' });
		[
			{ value: 'all', label: 'All' },
			{ value: 'living', label: 'Living' },
			{ value: 'deceased', label: 'Deceased' }
		].forEach(opt => {
			livingSelect.createEl('option', { value: opt.value, text: opt.label });
		});

		// Sex filter
		const sexFilter = controlsBar.createDiv({ cls: 'crc-picker-filter' });
		sexFilter.createSpan({ cls: 'crc-picker-filter__label', text: 'Sex:' });
		const sexSelect = sexFilter.createEl('select', { cls: 'crc-form-select crc-form-select--small' });
		[
			{ value: 'all', label: 'All' },
			{ value: 'M', label: 'Male' },
			{ value: 'F', label: 'Female' }
		].forEach(opt => {
			sexSelect.createEl('option', { value: opt.value, text: opt.label });
		});

		// Results container
		const resultsContainer = browserContent.createDiv({ cls: 'crc-picker-results' });

		// Helper: Extract year from date string
		const extractYear = (dateStr: string): number | null => {
			const yearMatch = dateStr.match(/\b(\d{4})\b/);
			return yearMatch ? parseInt(yearMatch[1], 10) : null;
		};

		// Render function
		const renderResults = (): void => {
			resultsContainer.empty();

			// Filter people
			const filteredPeople = allPeople.filter(person => {
				// Search filter
				const searchTerm = searchInput.value.toLowerCase().trim();
				if (searchTerm) {
					const nameMatch = person.name.toLowerCase().includes(searchTerm);
					const idMatch = person.crId.toLowerCase().includes(searchTerm);
					if (!nameMatch && !idMatch) return false;
				}

				// Living filter
				if (filters.livingStatus === 'living' && person.deathDate) return false;
				if (filters.livingStatus === 'deceased' && !person.deathDate) return false;

				// Sex filter
				if (filters.sex !== 'all' && person.sex !== filters.sex) return false;

				return true;
			});

			// Sort people
			filteredPeople.sort((a, b) => {
				switch (sortOption) {
					case 'name-asc':
						return a.name.localeCompare(b.name);
					case 'name-desc':
						return b.name.localeCompare(a.name);
					case 'birth-asc': {
						const aYear = a.birthDate ? extractYear(a.birthDate) : null;
						const bYear = b.birthDate ? extractYear(b.birthDate) : null;
						if (!aYear && !bYear) return 0;
						if (!aYear) return 1;
						if (!bYear) return -1;
						return aYear - bYear;
					}
					case 'birth-desc': {
						const aYear = a.birthDate ? extractYear(a.birthDate) : null;
						const bYear = b.birthDate ? extractYear(b.birthDate) : null;
						if (!aYear && !bYear) return 0;
						if (!aYear) return 1;
						if (!bYear) return -1;
						return bYear - aYear;
					}
					default:
						return 0;
				}
			});

			// Show results (limited to first 50 for performance)
			const displayPeople = filteredPeople.slice(0, 50);

			if (displayPeople.length === 0) {
				resultsContainer.createDiv({
					cls: 'crc-picker-empty',
					text: 'No people found matching your criteria'
				});
				return;
			}

			displayPeople.forEach(person => {
				const row = resultsContainer.createDiv({ cls: 'crc-picker-row' });

				// Radio button
				const radio = row.createEl('input', {
					type: 'radio',
					attr: { name: 'root-person-accordion' }
				});

				if (rootPersonField.crId === person.crId) {
					radio.checked = true;
				}

				// Person info
				const info = row.createDiv({ cls: 'crc-picker-row__info' });
				info.createDiv({ cls: 'crc-picker-row__name', text: person.name });

				const dates: string[] = [];
				if (person.birthDate) dates.push(`b. ${person.birthDate}`);
				if (person.deathDate) dates.push(`d. ${person.deathDate}`);
				if (dates.length > 0) {
					info.createDiv({ cls: 'crc-picker-row__dates', text: dates.join(' • ') });
				}

				// Click handler
				const selectPerson = () => {
					rootPersonField.name = person.name;
					rootPersonField.crId = person.crId;
					rootPersonField.birthDate = person.birthDate;
					rootPersonField.deathDate = person.deathDate;
					radio.checked = true;
					this.updateRootPersonDisplayCompact(personDisplay, rootPersonField);
				};

				radio.addEventListener('change', selectPerson);
				row.addEventListener('click', (e) => {
					if (e.target !== radio) {
						selectPerson();
					}
				});
			});

			if (filteredPeople.length > 50) {
				resultsContainer.createDiv({
					cls: 'crc-picker-more',
					text: `Showing 50 of ${filteredPeople.length} results. Refine your search to see more.`
				});
			}
		};

		// Wire up event listeners
		searchInput.addEventListener('input', renderResults);
		sortSelect.addEventListener('change', () => {
			sortOption = sortSelect.value as SortOption;
			renderResults();
		});
		livingSelect.addEventListener('change', () => {
			filters.livingStatus = livingSelect.value as FilterOptions['livingStatus'];
			renderResults();
		});
		sexSelect.addEventListener('change', () => {
			filters.sex = sexSelect.value as FilterOptions['sex'];
			renderResults();
		});

		// Initial render
		renderResults();
	}

	/**
	 * Create root person card for tree generation with inline person browser
	 */
	private createRootPersonCard(container: HTMLElement, rootPersonField: RelationshipField): void {
		const card = container.createDiv({ cls: 'crc-card' });
		const header = card.createDiv({ cls: 'crc-card__header' });
		const title = header.createEl('h3', {
			cls: 'crc-card__title',
			text: 'Root person'
		});
		const icon = createLucideIcon('user', 20);
		title.prepend(icon);

		const content = card.createDiv({ cls: 'crc-card__content' });

		// Selected person display (always shown)
		const personDisplay = content.createDiv({ cls: 'crc-root-person-display' });
		this.updateRootPersonDisplay(personDisplay, rootPersonField);

		// Person browser section (inline)
		const browserSection = content.createDiv({ cls: 'crc-person-browser' });
		const browserHeader = browserSection.createDiv({ cls: 'crc-person-browser__header' });
		browserHeader.createDiv({
			cls: 'crc-person-browser__title',
			text: 'Select a person'
		});

		const browserContent = browserSection.createDiv({ cls: 'crc-person-browser__content' });

		// Load all people from vault
		const allPeople: PersonInfo[] = [];
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const personInfo = this.extractPersonInfoFromFile(file);
			if (personInfo) {
				allPeople.push(personInfo);
			}
		}

		// Load family components
		const graphService = this.plugin.createFamilyGraphService();
		const familyComponents = graphService.findAllFamilyComponents();

		// Build component map
		const componentMap = new Map<string, number>();
		familyComponents.forEach((component, index) => {
			component.people.forEach(person => {
				componentMap.set(person.crId, index);
			});
		});

		// Search bar
		const searchBar = browserContent.createDiv({ cls: 'crc-person-browser__search' });
		const searchInput = searchBar.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'text',
				placeholder: 'Search by name or ID...'
			}
		});

		// Sort and filters row
		const controlsBar = browserContent.createDiv({ cls: 'crc-person-browser__controls' });

		// Sort dropdown
		const sortContainer = controlsBar.createDiv({ cls: 'crc-picker-sort' });
		sortContainer.createSpan({ cls: 'crc-picker-sort__label', text: 'Sort by:' });
		const sortSelect = sortContainer.createEl('select', { cls: 'crc-form-select' });

		type SortOption = 'name-asc' | 'name-desc' | 'birth-asc' | 'birth-desc' | 'recent';
		let sortOption: SortOption = 'name-asc';

		const sortOptions: Array<{ value: SortOption; label: string }> = [
			{ value: 'name-asc', label: 'Name (A-Z)' },
			{ value: 'name-desc', label: 'Name (Z-A)' },
			{ value: 'birth-asc', label: 'Birth year (oldest first)' },
			{ value: 'birth-desc', label: 'Birth year (youngest first)' },
			{ value: 'recent', label: 'Recently modified' }
		];

		sortOptions.forEach(opt => {
			const option = sortSelect.createEl('option', { value: opt.value, text: opt.label });
			if (opt.value === sortOption) {
				option.selected = true;
			}
		});

		// Filters
		interface FilterOptions {
			livingStatus: 'all' | 'living' | 'deceased';
			hasBirthDate: 'all' | 'yes' | 'no';
			sex: 'all' | 'M' | 'F';
		}

		const filters: FilterOptions = {
			livingStatus: 'all',
			hasBirthDate: 'all',
			sex: 'all'
		};

		const filtersContainer = controlsBar.createDiv({ cls: 'crc-picker-filters' });

		// Living status filter
		const livingFilter = filtersContainer.createDiv({ cls: 'crc-picker-filter' });
		livingFilter.createSpan({ cls: 'crc-picker-filter__label', text: 'Living:' });
		const livingSelect = livingFilter.createEl('select', { cls: 'crc-form-select crc-form-select--small' });
		[
			{ value: 'all', label: 'All' },
			{ value: 'living', label: 'Living only' },
			{ value: 'deceased', label: 'Deceased only' }
		].forEach(opt => {
			livingSelect.createEl('option', { value: opt.value, text: opt.label });
		});

		// Birth date filter
		const birthFilter = filtersContainer.createDiv({ cls: 'crc-picker-filter' });
		birthFilter.createSpan({ cls: 'crc-picker-filter__label', text: 'Birth date:' });
		const birthSelect = birthFilter.createEl('select', { cls: 'crc-form-select crc-form-select--small' });
		[
			{ value: 'all', label: 'All' },
			{ value: 'yes', label: 'Has date' },
			{ value: 'no', label: 'No date' }
		].forEach(opt => {
			birthSelect.createEl('option', { value: opt.value, text: opt.label });
		});

		// Sex filter
		const sexFilter = filtersContainer.createDiv({ cls: 'crc-picker-filter' });
		sexFilter.createSpan({ cls: 'crc-picker-filter__label', text: 'Sex:' });
		const sexSelect = sexFilter.createEl('select', { cls: 'crc-form-select crc-form-select--small' });
		[
			{ value: 'all', label: 'All' },
			{ value: 'M', label: 'Male' },
			{ value: 'F', label: 'Female' }
		].forEach(opt => {
			sexSelect.createEl('option', { value: opt.value, text: opt.label });
		});

		// Main layout with sidebar (if multiple families)
		let resultsContainer: HTMLElement;
		let activeComponentIndex: number | null = null;

		if (familyComponents.length > 1) {
			const mainContainer = browserContent.createDiv({ cls: 'crc-picker-main' });

			// Sidebar
			const sidebar = mainContainer.createDiv({ cls: 'crc-picker-sidebar' });
			const sidebarHeader = sidebar.createDiv({ cls: 'crc-picker-sidebar__header' });
			sidebarHeader.setText('Family groups');

			const tabsWrapper = sidebar.createDiv({ cls: 'crc-picker-sidebar__tabs' });

			// "All" tab
			const allTab = tabsWrapper.createDiv({ cls: 'crc-picker-sidebar-tab crc-picker-sidebar-tab--active' });
			const allTabLabel = allTab.createSpan({ cls: 'crc-picker-sidebar-tab__label' });
			allTabLabel.setText('All families');
			const allTabBadge = allTab.createSpan({ cls: 'crc-picker-sidebar-tab__badge' });
			const totalPeople = familyComponents.reduce((sum, c) => sum + c.size, 0);
			allTabBadge.setText(totalPeople.toString());

			// Individual family tabs
			familyComponents.forEach((component, index) => {
				const tab = tabsWrapper.createDiv({ cls: 'crc-picker-sidebar-tab' });
				const tabLabel = tab.createSpan({ cls: 'crc-picker-sidebar-tab__label' });
				tabLabel.setText(`Family ${index + 1}`);
				const tabBadge = tab.createSpan({ cls: 'crc-picker-sidebar-tab__badge' });
				tabBadge.setText(component.size.toString());

				tab.addEventListener('click', () => {
					activeComponentIndex = index;
					updateActiveSidebarTab();
					renderResults();
				});
			});

			allTab.addEventListener('click', () => {
				activeComponentIndex = null;
				updateActiveSidebarTab();
				renderResults();
			});

			const updateActiveSidebarTab = () => {
				const tabs = tabsWrapper.querySelectorAll('.crc-picker-sidebar-tab');
				tabs.forEach((tab, i) => {
					if (i === 0) {
						tab.toggleClass('crc-picker-sidebar-tab--active', activeComponentIndex === null);
					} else {
						tab.toggleClass('crc-picker-sidebar-tab--active', activeComponentIndex === i - 1);
					}
				});
			};

			resultsContainer = mainContainer.createDiv({ cls: 'crc-picker-results' });
		} else {
			resultsContainer = browserContent.createDiv({ cls: 'crc-picker-results' });
		}

		// Helper: Extract year from date string
		const extractYear = (dateStr: string): number | null => {
			const yearMatch = dateStr.match(/\b(\d{4})\b/);
			return yearMatch ? parseInt(yearMatch[1], 10) : null;
		};

		// Helper: Sort people
		const sortPeople = (people: PersonInfo[]): PersonInfo[] => {
			const sorted = [...people];
			switch (sortOption) {
				case 'name-asc':
					sorted.sort((a, b) => a.name.localeCompare(b.name));
					break;
				case 'name-desc':
					sorted.sort((a, b) => b.name.localeCompare(a.name));
					break;
				case 'birth-asc':
				case 'birth-desc': {
					const ascending = sortOption === 'birth-asc';
					sorted.sort((a, b) => {
						const yearA = a.birthDate ? extractYear(a.birthDate) : null;
						const yearB = b.birthDate ? extractYear(b.birthDate) : null;
						if (yearA === null && yearB === null) return 0;
						if (yearA === null) return 1;
						if (yearB === null) return -1;
						return ascending ? yearA - yearB : yearB - yearA;
					});
					break;
				}
				case 'recent':
					sorted.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
					break;
			}
			return sorted;
		};

		// Track currently selected item element for visual feedback
		let selectedItemElement: HTMLElement | null = null;

		// Render results function
		const renderResults = () => {
			resultsContainer.empty();
			selectedItemElement = null; // Reset on re-render

			const searchQuery = searchInput.value.toLowerCase();
			const filteredPeople = allPeople.filter(person => {
				// Family component filter
				if (activeComponentIndex !== null) {
					const personComponentIndex = componentMap.get(person.crId);
					if (personComponentIndex !== activeComponentIndex) return false;
				}

				// Search filter
				if (searchQuery) {
					const matchesSearch = person.name.toLowerCase().includes(searchQuery) ||
						person.crId.toLowerCase().includes(searchQuery);
					if (!matchesSearch) return false;
				}

				// Living status filter
				if (filters.livingStatus !== 'all') {
					const isLiving = !person.deathDate;
					if (filters.livingStatus === 'living' && !isLiving) return false;
					if (filters.livingStatus === 'deceased' && isLiving) return false;
				}

				// Birth date filter
				if (filters.hasBirthDate !== 'all') {
					const hasBirth = !!person.birthDate;
					if (filters.hasBirthDate === 'yes' && !hasBirth) return false;
					if (filters.hasBirthDate === 'no' && hasBirth) return false;
				}

				// Sex filter
				if (filters.sex !== 'all') {
					if (person.sex !== filters.sex) return false;
				}

				return true;
			});

			// Sort
			const sortedPeople = sortPeople(filteredPeople);

			if (sortedPeople.length === 0) {
				resultsContainer.createDiv({
					cls: 'crc-picker-empty',
					text: allPeople.length === 0 ? 'No people found in vault' : 'No results found'
				});
				return;
			}

			sortedPeople.forEach(person => {
				const item = resultsContainer.createDiv({ cls: 'crc-picker-item' });

				const mainInfo = item.createDiv({ cls: 'crc-picker-item__main' });
				mainInfo.createDiv({ cls: 'crc-picker-item__name', text: person.name });

				const metaInfo = item.createDiv({ cls: 'crc-picker-item__meta' });

				const hasDates = person.birthDate || person.deathDate;

				if (hasDates) {
					// Show birth year if available
					if (person.birthDate) {
						const birthYear = extractYear(person.birthDate);
						if (birthYear !== null) {
							const birthBadge = metaInfo.createDiv({ cls: 'crc-picker-badge' });
							const birthIcon = createLucideIcon('calendar', 12);
							birthBadge.appendChild(birthIcon);
							birthBadge.appendText(`b. ${birthYear}`);
						}
					}

					// Show death year if available
					if (person.deathDate) {
						const deathYear = extractYear(person.deathDate);
						if (deathYear !== null) {
							const deathBadge = metaInfo.createDiv({ cls: 'crc-picker-badge' });
							const deathIcon = createLucideIcon('calendar', 12);
							deathBadge.appendChild(deathIcon);
							deathBadge.appendText(`d. ${deathYear}`);
						}
					}
				} else {
					// Fallback: show cr_id only when no dates available
					const idBadge = metaInfo.createDiv({ cls: 'crc-picker-badge crc-picker-badge--id' });
					const idIcon = createLucideIcon('hash', 12);
					idBadge.appendChild(idIcon);
					idBadge.appendText(person.crId);
				}

				// Check if this person is currently selected
				if (rootPersonField.crId === person.crId) {
					item.addClass('crc-picker-item--selected');
					selectedItemElement = item;
				}

				item.addEventListener('click', () => {
					// Remove selection from previously selected item
					if (selectedItemElement) {
						selectedItemElement.removeClass('crc-picker-item--selected');
					}

					// Add selection to clicked item
					item.addClass('crc-picker-item--selected');
					selectedItemElement = item;

					// Update the root person field
					rootPersonField.name = person.name;
					rootPersonField.crId = person.crId;
					rootPersonField.birthDate = person.birthDate;
					rootPersonField.deathDate = person.deathDate;
					this.updateRootPersonDisplay(personDisplay, rootPersonField);
				});
			});
		};

		// Event handlers
		searchInput.addEventListener('input', () => {
			renderResults();
		});

		sortSelect.addEventListener('change', () => {
			sortOption = sortSelect.value as SortOption;
			renderResults();
		});

		livingSelect.addEventListener('change', () => {
			filters.livingStatus = livingSelect.value as FilterOptions['livingStatus'];
			renderResults();
		});

		birthSelect.addEventListener('change', () => {
			filters.hasBirthDate = birthSelect.value as FilterOptions['hasBirthDate'];
			renderResults();
		});

		sexSelect.addEventListener('change', () => {
			filters.sex = sexSelect.value as FilterOptions['sex'];
			renderResults();
		});

		// Initial render
		renderResults();

		// Canvas name and Generate button (at bottom of card)
		const actionsSection = content.createDiv({ cls: 'crc-root-person-generate' });

		// Canvas name input
		const nameGroup = actionsSection.createDiv({ cls: 'crc-form-group' });
		nameGroup.createEl('label', {
			cls: 'crc-form-label',
			text: 'Canvas name (optional)'
		});
		const nameInput = nameGroup.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'text',
				placeholder: 'Auto-generated from root person name'
			}
		});
		nameGroup.createDiv({
			cls: 'crc-form-help',
			text: 'Leave blank for auto-naming: "Family Tree - [Root Person Name] ([layout])"'
		});

		// Generate button
		const generateBtn = actionsSection.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-btn--large crc-mt-3',
			text: 'Generate family tree'
		});

		// Separator and "Generate All Trees" section (in same card)
		const separator = actionsSection.createDiv({ cls: 'crc-separator crc-mt-4' });
		separator.createEl('span', { text: 'OR', cls: 'crc-separator-text' });

		// Generate All Trees section
		const allTreesSection = actionsSection.createDiv({ cls: 'crc-mt-4' });

		const allTreesDesc = allTreesSection.createEl('p', {
			cls: 'crc-text-muted crc-text-sm crc-mb-3'
		});
		allTreesDesc.appendText('Automatically generate separate canvases for ');
		allTreesDesc.createEl('strong', { text: 'all disconnected family groups' });
		allTreesDesc.appendText(' in your vault. A root person will be automatically selected for each family group.');

		const allTreesBtn = allTreesSection.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-btn--large',
			text: 'Generate all trees'
		});

		// Add component count badge (updated dynamically)
		const countBadge = allTreesBtn.createSpan({
			cls: 'crc-badge crc-ml-2',
			text: '...'
		});

		// Check for multiple components and update badge
		void (() => {
			try {
				const graphService = this.plugin.createFamilyGraphService();
				const components = graphService.findAllFamilyComponents();

				if (components.length > 1) {
					countBadge.setText(`${components.length} groups`);
					allTreesDesc.empty();
					allTreesDesc.appendText('Automatically generate separate canvases for ');
					allTreesDesc.createEl('strong', { text: `all ${components.length} disconnected family groups` });
					allTreesDesc.appendText(' in your vault. A root person will be automatically selected for each family group.');
				} else {
					countBadge.setText('1 group');
					allTreesBtn.disabled = true;
					allTreesBtn.addClass('crc-btn--disabled');
					allTreesDesc.setText('Only one family tree detected. Use the "Generate family tree" button above instead.');
				}
			} catch {
				countBadge.setText('');
			}
		})();

		allTreesBtn.addEventListener('click', () => {
			void (async () => {
				await this.openAndGenerateAllTrees();
			})();
		});

		// Get references to configuration elements (defined later in showTreeGenerationTab)
		// We'll store these references so the button can access them
		this.treeCanvasNameInput = nameInput;
		this.treeGenerateBtn = generateBtn;
	}

	/**
	 * Update root person display
	 */
	private updateRootPersonDisplay(personDisplay: HTMLElement, rootPersonField: RelationshipField): void {
		personDisplay.empty();

		if (!rootPersonField.crId) {
			// Empty state
			const emptyState = personDisplay.createDiv({ cls: 'crc-root-person-empty' });
			const emptyIcon = createLucideIcon('user-plus', 24);
			emptyState.appendChild(emptyIcon);
			emptyState.createDiv({
				cls: 'crc-root-person-empty__text',
				text: 'No person selected'
			});
			emptyState.createDiv({
				cls: 'crc-root-person-empty__help',
				text: 'Search and select a person below to center the tree on'
			});
		} else {
			// Selected person
			const selectedPerson = personDisplay.createDiv({ cls: 'crc-root-person-selected' });
			selectedPerson.createDiv({
				cls: 'crc-root-person-selected__name',
				text: rootPersonField.name
			});

			// Show birth/death dates if available, otherwise cr_id
			const hasDates = rootPersonField.birthDate || rootPersonField.deathDate;
			if (hasDates) {
				// Format dates
				const dateText: string[] = [];
				if (rootPersonField.birthDate) {
					dateText.push(`b. ${rootPersonField.birthDate}`);
				}
				if (rootPersonField.deathDate) {
					dateText.push(`d. ${rootPersonField.deathDate}`);
				}
				selectedPerson.createDiv({
					cls: 'crc-root-person-selected__dates',
					text: dateText.join(' • ')
				});
			} else {
				selectedPerson.createDiv({
					cls: 'crc-root-person-selected__id',
					text: rootPersonField.crId
				});
			}
		}
	}

	/**
	 * Update root person display - compact version for accordion layout
	 * Only shows the selected person, hidden when empty
	 */
	private updateRootPersonDisplayCompact(personDisplay: HTMLElement, rootPersonField: RelationshipField): void {
		personDisplay.empty();

		if (rootPersonField.crId) {
			// Show the display
			personDisplay.removeClass('crc-hidden');

			// Selected person - compact inline display
			const selectedPerson = personDisplay.createDiv({ cls: 'crc-root-person-selected crc-root-person-selected--compact' });

			selectedPerson.createSpan({
				cls: 'crc-root-person-selected__name',
				text: rootPersonField.name
			});

			// Show birth/death dates if available
			const hasDates = rootPersonField.birthDate || rootPersonField.deathDate;
			if (hasDates) {
				const dateText: string[] = [];
				if (rootPersonField.birthDate) {
					dateText.push(`b. ${rootPersonField.birthDate}`);
				}
				if (rootPersonField.deathDate) {
					dateText.push(`d. ${rootPersonField.deathDate}`);
				}
				selectedPerson.createSpan({
					cls: 'crc-root-person-selected__dates',
					text: ` (${dateText.join(' • ')})`
				});
			}

			// Clear button
			const clearBtn = selectedPerson.createEl('button', {
				cls: 'crc-root-person-clear clickable-icon',
				attr: { 'aria-label': 'Clear selection' }
			});
			setIcon(clearBtn, 'x');
			clearBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				rootPersonField.name = '';
				rootPersonField.crId = '';
				rootPersonField.birthDate = undefined;
				rootPersonField.deathDate = undefined;
				this.updateRootPersonDisplayCompact(personDisplay, rootPersonField);
			});
		} else {
			// Hide the display when no person selected
			personDisplay.addClass('crc-hidden');
		}
	}

	/**
	 * Extract person info from file (for inline person browser)
	 */
	private extractPersonInfoFromFile(file: TFile): PersonInfo | null {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) return null;

		const fm = cache.frontmatter;

		// Only include person notes (not events, sources, places, etc.)
		if (!isPersonNote(fm, cache, this.plugin.settings.noteTypeDetection)) return null;

		const crId = fm.cr_id;
		if (!crId) return null;

		// Note: Frontmatter uses 'born'/'died' properties, mapped to birthDate/deathDate internally
		// Convert Date objects to ISO strings if necessary (Obsidian parses YAML dates as Date objects)
		const birthDate = fm.born instanceof Date ? fm.born.toISOString().split('T')[0] : fm.born;
		const deathDate = fm.died instanceof Date ? fm.died.toISOString().split('T')[0] : fm.died;

		return {
			name: file.basename,
			crId: crId,
			birthDate,
			deathDate,
			sex: cache.frontmatter.sex,
			birthPlace: extractPlaceInfo(fm.birth_place),
			deathPlace: extractPlaceInfo(fm.death_place),
			burialPlace: extractPlaceInfo(fm.burial_place),
			file: file
		};
	}

	/**
	 * Clear all relationship fields (data and UI)
	 */
	private clearRelationshipFields(): void {
		// Clear data
		this.fatherField = { name: '' };
		this.motherField = { name: '' };
		this.spouseField = { name: '' };

		// Clear UI elements if they exist
		if (this.fatherInput) {
			this.fatherInput.value = '';
			this.fatherInput.removeClass('crc-input--linked');
		}
		if (this.fatherBtn) {
			this.fatherBtn.textContent = '';
			const linkIcon = createLucideIcon('link', 16);
			this.fatherBtn.appendChild(linkIcon);
			this.fatherBtn.appendText('Link');
		}
		if (this.fatherHelp) {
			this.updateHelpText(this.fatherHelp, this.fatherField);
		}

		if (this.motherInput) {
			this.motherInput.value = '';
			this.motherInput.removeClass('crc-input--linked');
		}
		if (this.motherBtn) {
			this.motherBtn.textContent = '';
			const linkIcon = createLucideIcon('link', 16);
			this.motherBtn.appendChild(linkIcon);
			this.motherBtn.appendText('Link');
		}
		if (this.motherHelp) {
			this.updateHelpText(this.motherHelp, this.motherField);
		}

		if (this.spouseInput) {
			this.spouseInput.value = '';
			this.spouseInput.removeClass('crc-input--linked');
		}
		if (this.spouseBtn) {
			this.spouseBtn.textContent = '';
			const linkIcon = createLucideIcon('link', 16);
			this.spouseBtn.appendChild(linkIcon);
			this.spouseBtn.appendText('Link');
		}
		if (this.spouseHelp) {
			this.updateHelpText(this.spouseHelp, this.spouseField);
		}
	}

	/**
	 * Sync bidirectional relationships for all person notes after GEDCOM import
	 */
	private async syncImportedRelationships(): Promise<void> {
		const peopleFolder = this.plugin.settings.peopleFolder || '';
		const folder = this.app.vault.getAbstractFileByPath(peopleFolder);

		if (!(folder instanceof TFolder)) {
			logger.warn('gedcom-sync', 'People folder not found, skipping relationship sync');
			return;
		}

		// Get all person notes in the folder
		const personFiles: TFile[] = [];
		const getAllMarkdownFiles = (folder: TFolder) => {
			for (const child of folder.children) {
				if (child instanceof TFile && child.extension === 'md') {
					const cache = this.app.metadataCache.getFileCache(child);
					if (cache?.frontmatter?.cr_id) {
						personFiles.push(child);
					}
				} else if (child instanceof TFolder) {
					getAllMarkdownFiles(child);
				}
			}
		};
		getAllMarkdownFiles(folder);

		if (personFiles.length === 0) {
			logger.info('gedcom-sync', 'No person notes found to sync');
			return;
		}

		logger.info('gedcom-sync', `Syncing relationships for ${personFiles.length} person notes`);

		// Show progress notice
		const progressNotice = new Notice(
			`Syncing relationships for ${personFiles.length} people...`,
			0 // Don't auto-dismiss
		);

		try {
			const bidirectionalLinker = new BidirectionalLinker(this.app);
			let syncedCount = 0;

			// Sync all person notes
			for (const file of personFiles) {
				try {
					await bidirectionalLinker.syncRelationships(file);
					syncedCount++;

					// Update progress every 10 files
					if (syncedCount % 10 === 0) {
						progressNotice.setMessage(
							`Syncing relationships: ${syncedCount}/${personFiles.length} people processed`
						);
					}
				} catch (error: unknown) {
					logger.error('gedcom-sync', `Failed to sync relationships for ${file.path}`, {
						error: getErrorMessage(error)
					});
				}
			}

			// Hide progress notice and show completion
			progressNotice.hide();
			new Notice(`✓ Relationships synced for ${syncedCount} people`);

			logger.info('gedcom-sync', `Relationship sync complete: ${syncedCount}/${personFiles.length} files processed`);
		} catch (error: unknown) {
			progressNotice.hide();
			const errorMsg = getErrorMessage(error);
			logger.error('gedcom-sync', 'Failed to sync imported relationships', {
				error: errorMsg
			});
			new Notice(`Relationship sync failed: ${errorMsg}`);
		}
	}

	// =========================================================================
	// DATA QUALITY TAB
	// =========================================================================

	/**
	 * Show Data Quality tab - analyze data quality and find issues
	 */
	private showDataQualityTab(): void {
		const container = this.contentContainer;
		container.empty();

		// Quick Start Guidance Card
		const quickStartCard = this.createCard({
			title: 'Quick start',
			icon: 'info',
			subtitle: 'Where to find data quality tools'
		});
		const quickStartContent = quickStartCard.querySelector('.crc-card__content') as HTMLElement;

		const guidanceText = quickStartContent.createEl('p', {
			cls: 'crc-text-muted'
		});
		guidanceText.appendText('Data quality tools are organized by entity type for convenience. This tab provides vault-wide analysis and cross-domain operations.');

		// Domain-specific links
		const linksList = quickStartContent.createEl('ul', { cls: 'crc-text-muted' });

		const peopleItem = linksList.createEl('li');
		peopleItem.appendText('For person-specific batch operations, see the ');
		const peopleLink = peopleItem.createEl('a', {
			text: 'People tab',
			href: '#',
			cls: 'crc-text-link'
		});
		peopleLink.addEventListener('click', (e) => {
			e.preventDefault();
			this.showTab('people');
		});

		const placesItem = linksList.createEl('li');
		placesItem.appendText('For place-specific data quality, see the ');
		const placesLink = placesItem.createEl('a', {
			text: 'Places tab',
			href: '#',
			cls: 'crc-text-link'
		});
		placesLink.addEventListener('click', (e) => {
			e.preventDefault();
			this.showTab('places');
		});

		const schemasItem = linksList.createEl('li');
		schemasItem.appendText('For schema validation, see the ');
		const schemasLink = schemasItem.createEl('a', {
			text: 'Schemas tab',
			href: '#',
			cls: 'crc-text-link'
		});
		schemasLink.addEventListener('click', (e) => {
			e.preventDefault();
			this.showTab('schemas');
		});

		container.appendChild(quickStartCard);

		// Research Gaps Section (only when fact-level tracking is enabled)
		if (this.plugin.settings.trackFactSourcing) {
			this.renderResearchGapsSection(container);

			// Source Conflicts Section
			this.renderSourceConflictsSection(container);
		}

		// === VAULT-WIDE ANALYSIS ===
		const analysisCard = this.createCard({
			title: 'Vault-wide analysis',
			icon: 'search',
			subtitle: 'Comprehensive data quality report across all entities'
		});
		const analysisContent = analysisCard.querySelector('.crc-card__content') as HTMLElement;

		// Explanation
		const analysisExplanation = analysisContent.createDiv({ cls: 'crc-info-callout crc-mb-3' });
		analysisExplanation.createEl('p', {
			text: 'Scan your genealogy data to identify data issues like missing dates, invalid values, ' +
				'circular relationships, and orphaned parent references.',
			cls: 'crc-text--small'
		});

		let selectedScope: 'all' | 'staging' | 'folder' = 'all';
		const selectedFolder = '';

		new Setting(analysisContent)
			.setName('Analysis scope')
			.setDesc('Choose which records to analyze')
			.addDropdown(dropdown => dropdown
				.addOption('all', 'All records (main tree)')
				.addOption('staging', 'Staging folder only')
				.setValue(selectedScope)
				.onChange(value => {
					selectedScope = value as 'all' | 'staging' | 'folder';
				})
			);

		// Results container (initially empty)
		const resultsContainer = analysisContent.createDiv({ cls: 'crc-data-quality-results' });

		// Run analysis button
		new Setting(analysisContent)
			.setName('Run analysis')
			.setDesc('Scan records for data quality issues')
			.addButton(button => button
				.setButtonText('Analyze')
				.setCta()
				.onClick(() => {
					this.runDataQualityAnalysis(resultsContainer, selectedScope, selectedFolder);
				}));

		container.appendChild(analysisCard);

		// === CROSS-DOMAIN BATCH OPERATIONS ===
		const batchCard = this.createCard({
			title: 'Cross-domain batch operations',
			icon: 'zap',
			subtitle: 'Standardization operations across all entity types'
		});
		const batchContent = batchCard.querySelector('.crc-card__content') as HTMLElement;

		// Explanation
		const batchExplanation = batchContent.createDiv({ cls: 'crc-info-callout crc-mb-3' });
		batchExplanation.createEl('p', {
			text: 'These operations work across people, places, events, and sources. Use Preview to see what will change before applying. For entity-specific operations, see the domain tabs (People, Places, etc.).',
			cls: 'crc-text--small'
		});

		// Normalize dates
		new Setting(batchContent)
			.setName('Normalize date formats')
			.setDesc('Convert dates to standard YYYY-MM-DD format')
			.addButton(btn => btn
				.setButtonText('Preview')
				.onClick(() => {
					void this.previewBatchOperation('dates', selectedScope, selectedFolder);
				})
			)
			.addButton(btn => btn
				.setButtonText('Apply')
				.setCta()
				.onClick(() => void this.runBatchOperation('dates', selectedScope, selectedFolder))
			);

		// Normalize sex
		new Setting(batchContent)
			.setName('Normalize sex values')
			.setDesc('Standardize to M/F format. Uses biological sex to match historical records and GEDCOM standards.')
			.addButton(btn => btn
				.setButtonText('Preview')
				.onClick(() => void this.previewBatchOperation('sex', selectedScope, selectedFolder))
			)
			.addButton(btn => btn
				.setButtonText('Apply')
				.setCta()
				.onClick(() => void this.runBatchOperation('sex', selectedScope, selectedFolder))
			);

		// Clear orphan references
		new Setting(batchContent)
			.setName('Clear orphan references')
			.setDesc('Remove parent references that point to non-existent records')
			.addButton(btn => btn
				.setButtonText('Preview')
				.onClick(() => void this.previewBatchOperation('orphans', selectedScope, selectedFolder))
			)
			.addButton(btn => btn
				.setButtonText('Apply')
				.setWarning()
				.onClick(() => void this.runBatchOperation('orphans', selectedScope, selectedFolder))
			);

		// Migrate legacy type property (only show if cr_type is the primary)
		if (this.plugin.settings.noteTypeDetection?.primaryTypeProperty === 'cr_type') {
			new Setting(batchContent)
				.setName('Migrate legacy type property')
				.setDesc('Convert type to cr_type for all Canvas Roots notes')
				.addButton(btn => btn
					.setButtonText('Preview')
					.onClick(() => void this.previewBatchOperation('legacy_type', selectedScope, selectedFolder))
				)
				.addButton(btn => btn
					.setButtonText('Apply')
					.setCta()
					.onClick(() => void this.runBatchOperation('legacy_type', selectedScope, selectedFolder))
				);
		}

		// Flatten nested properties
		new Setting(batchContent)
			.setName('Flatten nested properties')
			.setDesc('Convert nested YAML (e.g., coordinates: { lat, long }) to flat properties')
			.addButton(btn => btn
				.setButtonText('Open')
				.setCta()
				.onClick(() => {
					new FlattenNestedPropertiesModal(this.app).open();
				})
			);

		container.appendChild(batchCard);

		// === DATA ENHANCEMENT ===
		// Data Enhancement card
		const enhancementCard = this.createCard({
			title: 'Data enhancement',
			icon: 'sparkles',
			subtitle: 'Create missing notes from existing data'
		});
		const enhancementContent = enhancementCard.querySelector('.crc-card__content') as HTMLElement;

		// Explanation
		const enhancementExplanation = enhancementContent.createDiv({ cls: 'crc-info-callout crc-mb-3' });
		enhancementExplanation.createEl('p', {
			text: 'Enhance your notes by generating place notes from place strings in person and event notes. ' +
				'Useful for data imported from CSV, manually entered records, or vaults created before place notes were supported.',
			cls: 'crc-text--small'
		});

		// Generate place notes
		new Setting(enhancementContent)
			.setName('Generate place notes')
			.setDesc('Create place notes from place strings and update references to use wikilinks')
			.addButton(btn => btn
				.setButtonText('Open')
				.setCta()
				.onClick(() => {
					const placeGraph = new PlaceGraphService(this.app);
					new PlaceGeneratorModal(this.app, this.plugin.settings, {}, placeGraph).open();
				})
			);

		container.appendChild(enhancementCard);

		// Data Tools card
		const toolsCard = this.createCard({
			title: 'Data tools',
			icon: 'sliders',
			subtitle: 'Utility tools for managing your data'
		});
		const toolsContent = toolsCard.querySelector('.crc-card__content') as HTMLElement;

		// Explanation
		const toolsExplanation = toolsContent.createDiv({ cls: 'crc-info-callout crc-mb-3' });
		toolsExplanation.createEl('p', {
			text: 'Create Obsidian Bases to view and manage your data in spreadsheet-like table views.',
			cls: 'crc-text--small'
		});

		const baseTypes = [
			{ value: 'people', label: 'People', command: 'canvas-roots:create-base-template' },
			{ value: 'places', label: 'Places', command: 'canvas-roots:create-places-base-template' },
			{ value: 'events', label: 'Events', command: 'canvas-roots:create-events-base-template' },
			{ value: 'organizations', label: 'Organizations', command: 'canvas-roots:create-organizations-base-template' },
			{ value: 'sources', label: 'Sources', command: 'canvas-roots:create-sources-base-template' },
			{ value: 'universes', label: 'Universes', command: 'canvas-roots:create-universes-base-template' }
		];

		let selectedBaseType = baseTypes[0];

		new Setting(toolsContent)
			.setName('Create base')
			.setDesc('Create an Obsidian Base for managing your data in table view')
			.addDropdown(dropdown => dropdown
				.addOptions(Object.fromEntries(baseTypes.map(t => [t.value, t.label])))
				.setValue(selectedBaseType.value)
				.onChange(value => {
					selectedBaseType = baseTypes.find(t => t.value === value) || baseTypes[0];
				})
			)
			.addButton(btn => btn
				.setButtonText('Create')
				.setCta()
				.onClick(() => {
					this.close();
					this.app.commands.executeCommandById(selectedBaseType.command);
				})
			);

		container.appendChild(toolsCard);
	}

	/**
	 * Run data quality analysis and display results
	 */
	private runDataQualityAnalysis(
		container: HTMLElement,
		scope: 'all' | 'staging' | 'folder',
		folderPath?: string
	): void {
		container.empty();

		// Show loading
		const loadingEl = container.createDiv({ cls: 'crc-loading' });
		loadingEl.createSpan({ text: 'Analyzing data quality...' });

		// Create service and run analysis
		const familyGraph = new FamilyGraphService(this.app);
		const folderFilter = new FolderFilterService(this.plugin.settings);
		familyGraph.setFolderFilter(folderFilter);
		familyGraph.setPropertyAliases(this.plugin.settings.propertyAliases);
		familyGraph.setValueAliases(this.plugin.settings.valueAliases);

		const dataQualityService = new DataQualityService(
			this.app,
			this.plugin.settings,
			familyGraph,
			folderFilter,
			this.plugin
		);

		// Run analysis (synchronous)
		const report = dataQualityService.analyze({
			scope,
			folderPath,
		});

		// Clear loading and show results
		container.empty();
		this.renderDataQualityReport(container, report);
	}

	/**
	 * Render data quality report
	 */
	private renderDataQualityReport(
		container: HTMLElement,
		report: DataQualityReport
	): void {
		const { summary, issues } = report;

		// Summary section
		const summarySection = container.createDiv({ cls: 'crc-dq-summary' });

		// Quality score
		const scoreEl = summarySection.createDiv({ cls: 'crc-dq-score' });
		const scoreValue = scoreEl.createDiv({ cls: 'crc-dq-score-value' });
		scoreValue.setText(String(summary.qualityScore));

		// Color based on score
		if (summary.qualityScore >= 80) {
			scoreValue.addClass('crc-dq-score--good');
		} else if (summary.qualityScore >= 50) {
			scoreValue.addClass('crc-dq-score--warning');
		} else {
			scoreValue.addClass('crc-dq-score--poor');
		}

		scoreEl.createDiv({ cls: 'crc-dq-score-label', text: 'Quality score' });

		// Stats grid
		const statsGrid = summarySection.createDiv({ cls: 'crc-dq-stats-grid' });

		this.renderDqStatCard(statsGrid, 'People analyzed', String(summary.totalPeople), 'users');
		this.renderDqStatCard(statsGrid, 'Total issues', String(summary.totalIssues), 'alert-circle');
		this.renderDqStatCard(statsGrid, 'Errors', String(summary.bySeverity.error), 'alert-triangle');
		this.renderDqStatCard(statsGrid, 'Warnings', String(summary.bySeverity.warning), 'alert-circle');

		// Completeness metrics
		const completenessSection = container.createDiv({ cls: 'crc-section' });
		completenessSection.createEl('h3', { text: 'Data completeness' });

		const completenessGrid = completenessSection.createDiv({ cls: 'crc-dq-completeness-grid' });

		const total = summary.totalPeople || 1; // Avoid division by zero
		this.renderCompletenessBar(completenessGrid, 'Birth date', summary.completeness.withBirthDate, total);
		this.renderCompletenessBar(completenessGrid, 'Death date', summary.completeness.withDeathDate, total);
		this.renderCompletenessBar(completenessGrid, 'Gender', summary.completeness.withGender, total);
		this.renderCompletenessBar(completenessGrid, 'Both parents', summary.completeness.withBothParents, total);
		this.renderCompletenessBar(completenessGrid, 'At least one parent', summary.completeness.withAtLeastOneParent, total);
		this.renderCompletenessBar(completenessGrid, 'Has spouse', summary.completeness.withSpouse, total);
		this.renderCompletenessBar(completenessGrid, 'Has children', summary.completeness.withChildren, total);

		// Issues by category
		if (issues.length > 0) {
			const issuesSection = container.createDiv({ cls: 'crc-section' });
			issuesSection.createEl('h3', { text: 'Issues found' });

			// Category filter
			const filterRow = issuesSection.createDiv({ cls: 'crc-dq-filter-row' });
			let selectedCategory: IssueCategory | 'all' = 'all';
			let selectedSeverity: IssueSeverity | 'all' = 'all';

			new Setting(filterRow)
				.setName('Category')
				.addDropdown(dropdown => dropdown
					.addOption('all', 'All categories')
					.addOption('date_inconsistency', 'Date issues')
					.addOption('relationship_inconsistency', 'Relationship issues')
					.addOption('missing_data', 'Missing data')
					.addOption('data_format', 'Format issues')
					.addOption('orphan_reference', 'Orphan references')
					.addOption('nested_property', 'Nested properties')
					.setValue(selectedCategory)
					.onChange(value => {
						selectedCategory = value as IssueCategory | 'all';
						this.renderIssuesList(issuesList, issues, selectedCategory, selectedSeverity);
					})
				);

			new Setting(filterRow)
				.setName('Severity')
				.addDropdown(dropdown => dropdown
					.addOption('all', 'All severities')
					.addOption('error', 'Errors only')
					.addOption('warning', 'Warnings only')
					.addOption('info', 'Info only')
					.setValue(selectedSeverity)
					.onChange(value => {
						selectedSeverity = value as IssueSeverity | 'all';
						this.renderIssuesList(issuesList, issues, selectedCategory, selectedSeverity);
					})
				);

			const issuesList = issuesSection.createDiv({ cls: 'crc-dq-issues-list' });
			this.renderIssuesList(issuesList, issues, selectedCategory, selectedSeverity);
		} else {
			const noIssuesEl = container.createDiv({ cls: 'crc-dq-no-issues' });
			setIcon(noIssuesEl.createSpan({ cls: 'crc-dq-no-issues-icon' }), 'check');
			noIssuesEl.createSpan({ text: 'No issues found! Your data looks great.' });
		}
	}

	/**
	 * Render a data quality stat card
	 */
	private renderDqStatCard(
		container: HTMLElement,
		label: string,
		value: string,
		icon: LucideIconName
	): void {
		const card = container.createDiv({ cls: 'crc-dq-stat-card' });
		const iconEl = card.createDiv({ cls: 'crc-dq-stat-icon' });
		setIcon(iconEl, icon);
		card.createDiv({ cls: 'crc-dq-stat-value', text: value });
		card.createDiv({ cls: 'crc-dq-stat-label', text: label });
	}

	/**
	 * Render a completeness bar
	 */
	private renderCompletenessBar(
		container: HTMLElement,
		label: string,
		count: number,
		total: number
	): void {
		const percent = Math.round((count / total) * 100);
		const row = container.createDiv({ cls: 'crc-dq-completeness-row' });

		row.createDiv({ cls: 'crc-dq-completeness-label', text: label });

		const barContainer = row.createDiv({ cls: 'crc-dq-completeness-bar-container' });
		const bar = barContainer.createDiv({ cls: 'crc-dq-completeness-bar' });
		bar.style.setProperty('width', `${percent}%`);

		// Color based on percentage
		if (percent >= 80) {
			bar.addClass('crc-dq-completeness-bar--good');
		} else if (percent >= 50) {
			bar.addClass('crc-dq-completeness-bar--warning');
		} else {
			bar.addClass('crc-dq-completeness-bar--poor');
		}

		row.createDiv({ cls: 'crc-dq-completeness-value', text: `${count}/${total} (${percent}%)` });
	}

	/**
	 * Render filtered issues list
	 */
	private renderIssuesList(
		container: HTMLElement,
		issues: DataQualityIssue[],
		category: IssueCategory | 'all',
		severity: IssueSeverity | 'all'
	): void {
		container.empty();

		const filtered = issues.filter(issue => {
			if (category !== 'all' && issue.category !== category) return false;
			if (severity !== 'all' && issue.severity !== severity) return false;
			return true;
		});

		if (filtered.length === 0) {
			container.createDiv({
				cls: 'crc-dq-no-matches',
				text: 'No issues match the selected filters.'
			});
			return;
		}

		// Show count
		container.createDiv({
			cls: 'crc-dq-issues-count',
			text: `Showing ${filtered.length} issue${filtered.length === 1 ? '' : 's'}`
		});

		// Render issues (limit to first 100 for performance)
		const displayIssues = filtered.slice(0, 100);
		for (const issue of displayIssues) {
			this.renderIssueItem(container, issue);
		}

		if (filtered.length > 100) {
			container.createDiv({
				cls: 'crc-dq-more-issues',
				text: `... and ${filtered.length - 100} more issues`
			});
		}
	}

	/**
	 * Render a single issue item
	 */
	private renderIssueItem(container: HTMLElement, issue: DataQualityIssue): void {
		const item = container.createDiv({ cls: `crc-dq-issue crc-dq-issue--${issue.severity}` });

		// Severity icon
		const iconEl = item.createDiv({ cls: 'crc-dq-issue-icon' });
		const iconName = issue.severity === 'error' ? 'alert-triangle' :
			issue.severity === 'warning' ? 'alert-circle' : 'info';
		setIcon(iconEl, iconName);

		// Content
		const content = item.createDiv({ cls: 'crc-dq-issue-content' });

		// Person name as clickable link
		const personLink = content.createEl('a', {
			cls: 'crc-dq-issue-person',
			text: issue.person.name
		});
		personLink.addEventListener('click', (e) => {
			e.preventDefault();
			// Open the person's file
			const file = issue.person.file;
			if (file) {
				void this.app.workspace.openLinkText(file.path, '', false);
				this.close();
			}
		});

		// Issue message
		content.createDiv({ cls: 'crc-dq-issue-message', text: issue.message });

		// Category badge
		const badge = item.createDiv({ cls: 'crc-dq-issue-badge' });
		badge.setText(this.formatCategoryName(issue.category));
	}

	/**
	 * Format category name for display
	 */
	private formatCategoryName(category: IssueCategory): string {
		const names: Record<IssueCategory, string> = {
			date_inconsistency: 'Date',
			relationship_inconsistency: 'Relationship',
			missing_data: 'Missing data',
			data_format: 'Format',
			orphan_reference: 'Orphan ref',
			nested_property: 'Nested',
			legacy_type_property: 'Legacy type',
		};
		return names[category] || category;
	}

	/**
	 * Preview a batch operation
	 */
	private async previewBatchOperation(
		operation: 'dates' | 'sex' | 'orphans' | 'legacy_type',
		scope: 'all' | 'staging' | 'folder',
		folderPath?: string
	): Promise<void> {
		// Create service
		const familyGraph = new FamilyGraphService(this.app);
		const folderFilter = new FolderFilterService(this.plugin.settings);
		familyGraph.setFolderFilter(folderFilter);
		familyGraph.setPropertyAliases(this.plugin.settings.propertyAliases);
		familyGraph.setValueAliases(this.plugin.settings.valueAliases);

		const dataQualityService = new DataQualityService(
			this.app,
			this.plugin.settings,
			familyGraph,
			folderFilter,
			this.plugin
		);

		// Get preview
		const preview = await dataQualityService.previewNormalization({ scope, folderPath });

		// Check if sex normalization is disabled
		const sexNormalizationDisabled = operation === 'sex' &&
			this.plugin.settings.sexNormalizationMode === 'disabled';

		// Show preview modal
		const modal = new BatchPreviewModal(
			this.app,
			operation,
			preview,
			async () => await this.runBatchOperation(operation, scope, folderPath),
			sexNormalizationDisabled
		);
		modal.open();
	}

	/**
	 * Run a batch operation
	 */
	private async runBatchOperation(
		operation: 'dates' | 'sex' | 'orphans' | 'legacy_type',
		scope: 'all' | 'staging' | 'folder',
		folderPath?: string
	): Promise<void> {
		// Create service
		const familyGraph = new FamilyGraphService(this.app);
		const folderFilter = new FolderFilterService(this.plugin.settings);
		familyGraph.setFolderFilter(folderFilter);
		familyGraph.setPropertyAliases(this.plugin.settings.propertyAliases);
		familyGraph.setValueAliases(this.plugin.settings.valueAliases);

		const dataQualityService = new DataQualityService(
			this.app,
			this.plugin.settings,
			familyGraph,
			folderFilter,
			this.plugin
		);

		let result: BatchOperationResult;
		let operationName: string;

		try {
			switch (operation) {
				case 'dates':
					operationName = 'Date normalization';
					result = await dataQualityService.normalizeDateFormats({ scope, folderPath });
					break;
				case 'sex':
					operationName = 'Sex normalization';
					result = await dataQualityService.normalizeGenderValues({ scope, folderPath });
					break;
				case 'orphans':
					operationName = 'Orphan reference clearing';
					result = await dataQualityService.clearOrphanReferences({ scope, folderPath });
					break;
				case 'legacy_type':
					operationName = 'Legacy type migration';
					result = await dataQualityService.migrateLegacyTypeProperty({ scope, folderPath });
					break;
			}

			// Show result
			if (result.modified > 0) {
				new Notice(`${operationName}: Modified ${result.modified} of ${result.processed} files`);
			} else {
				new Notice(`${operationName}: No changes needed`);
			}

			if (result.errors.length > 0) {
				new Notice(`${result.errors.length} errors occurred. Check console for details.`);
				console.error('Batch operation errors:', result.errors);
			}

			// Refresh the family graph cache
			await familyGraph.reloadCache();

		} catch (error) {
			new Notice(`${operation} failed: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Preview removing duplicate relationships
	 */
	private previewRemoveDuplicateRelationships(): void {
		const familyGraph = this.plugin.createFamilyGraphService();
		familyGraph.ensureCacheLoaded();
		const people = familyGraph.getAllPeople();

		const changes: Array<{ person: { name: string }; field: string; oldValue: string; newValue: string; file: TFile }> = [];

		for (const person of people) {
			const cache = this.app.metadataCache.getFileCache(person.file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter as Record<string, unknown>;

			// Check spouse array for duplicates
			if (Array.isArray(fm.spouse) && fm.spouse.length > 1) {
				const unique = [...new Set(fm.spouse)];
				const dupCount = fm.spouse.length - unique.length;
				if (dupCount > 0) {
					changes.push({
						person: { name: person.name || 'Unknown' },
						field: 'spouse',
						oldValue: `${fm.spouse.length} ${fm.spouse.length === 1 ? 'entry' : 'entries'} (${dupCount} ${dupCount === 1 ? 'duplicate' : 'duplicates'})`,
						newValue: `${unique.length} ${unique.length === 1 ? 'entry' : 'entries'} (deduplicated)`,
						file: person.file
					});
				}
			}

			// Check spouse_id array for duplicates
			if (Array.isArray(fm.spouse_id) && fm.spouse_id.length > 1) {
				const unique = [...new Set(fm.spouse_id)];
				const dupCount = fm.spouse_id.length - unique.length;
				if (dupCount > 0) {
					changes.push({
						person: { name: person.name || 'Unknown' },
						field: 'spouse_id',
						oldValue: `${fm.spouse_id.length} ${fm.spouse_id.length === 1 ? 'entry' : 'entries'} (${dupCount} ${dupCount === 1 ? 'duplicate' : 'duplicates'})`,
						newValue: `${unique.length} ${unique.length === 1 ? 'entry' : 'entries'} (deduplicated)`,
						file: person.file
					});
				}
			}

			// Check children/child arrays for duplicates
			const childrenArray = fm.children || fm.child;
			if (Array.isArray(childrenArray) && childrenArray.length > 1) {
				const unique = [...new Set(childrenArray)];
				const dupCount = childrenArray.length - unique.length;
				if (dupCount > 0) {
					const fieldName = fm.children ? 'children' : 'child';
					changes.push({
						person: { name: person.name || 'Unknown' },
						field: fieldName,
						oldValue: `${childrenArray.length} ${childrenArray.length === 1 ? 'entry' : 'entries'} (${dupCount} ${dupCount === 1 ? 'duplicate' : 'duplicates'})`,
						newValue: `${unique.length} ${unique.length === 1 ? 'entry' : 'entries'} (deduplicated)`,
						file: person.file
					});
				}
			}

			// Check children_id array for duplicates
			if (Array.isArray(fm.children_id) && fm.children_id.length > 1) {
				const unique = [...new Set(fm.children_id)];
				const dupCount = fm.children_id.length - unique.length;
				if (dupCount > 0) {
					changes.push({
						person: { name: person.name || 'Unknown' },
						field: 'children_id',
						oldValue: `${fm.children_id.length} ${fm.children_id.length === 1 ? 'entry' : 'entries'} (${dupCount} ${dupCount === 1 ? 'duplicate' : 'duplicates'})`,
						newValue: `${unique.length} ${unique.length === 1 ? 'entry' : 'entries'} (deduplicated)`,
						file: person.file
					});
				}
			}
		}

		if (changes.length === 0) {
			new Notice('No duplicate relationships found');
			return;
		}

		// Show preview modal
		const modal = new DuplicateRelationshipsPreviewModal(
			this.app,
			changes,
			async () => await this.removeDuplicateRelationships()
		);
		modal.open();
	}

	/**
	 * Remove duplicate relationships
	 */
	private async removeDuplicateRelationships(): Promise<void> {
		new Notice('Removing duplicate relationships...');

		const familyGraph = this.plugin.createFamilyGraphService();
		familyGraph.ensureCacheLoaded();
		const people = familyGraph.getAllPeople();

		let modified = 0;
		const errors: string[] = [];

		for (const person of people) {

			try {
				const cache = this.app.metadataCache.getFileCache(person.file);
				if (!cache?.frontmatter) continue;

				const fm = cache.frontmatter as Record<string, unknown>;
				let hasChanges = false;

				await this.app.fileManager.processFrontMatter(person.file, (frontmatter) => {
					// Deduplicate spouse array
					if (Array.isArray(fm.spouse) && fm.spouse.length > 1) {
						const unique = [...new Set(fm.spouse)];
						if (unique.length < fm.spouse.length) {
							frontmatter.spouse = unique;
							hasChanges = true;
						}
					}

					// Deduplicate spouse_id array
					if (Array.isArray(fm.spouse_id) && fm.spouse_id.length > 1) {
						const unique = [...new Set(fm.spouse_id)];
						if (unique.length < fm.spouse_id.length) {
							frontmatter.spouse_id = unique;
							hasChanges = true;
						}
					}

					// Deduplicate children/child arrays
					const childrenArray = fm.children || fm.child;
					if (Array.isArray(childrenArray) && childrenArray.length > 1) {
						const unique = [...new Set(childrenArray)];
						if (unique.length < childrenArray.length) {
							if (fm.children) {
								frontmatter.children = unique;
							} else {
								frontmatter.child = unique;
							}
							hasChanges = true;
						}
					}

					// Deduplicate children_id array
					if (Array.isArray(fm.children_id) && fm.children_id.length > 1) {
						const unique = [...new Set(fm.children_id)];
						if (unique.length < fm.children_id.length) {
							frontmatter.children_id = unique;
							hasChanges = true;
						}
					}
				});

				if (hasChanges) {
					modified++;
				}
			} catch (error) {
				errors.push(`${person.file.path}: ${getErrorMessage(error)}`);
			}
		}

		// Show result
		if (modified > 0) {
			new Notice(`✓ Removed duplicates from ${modified} ${modified === 1 ? 'file' : 'files'}`);
		} else {
			new Notice('No duplicate relationships found');
		}

		if (errors.length > 0) {
			new Notice(`⚠ ${errors.length} errors occurred. Check console for details.`);
			console.error('Remove duplicates errors:', errors);
		}

		// Refresh the family graph cache
		await familyGraph.reloadCache();

		// Refresh the People tab
		this.showTab('people');
	}

	/**
	 * Preview removing empty/placeholder values
	 */
	private previewRemovePlaceholders(): void {
		const familyGraph = this.plugin.createFamilyGraphService();
		familyGraph.ensureCacheLoaded();
		const people = familyGraph.getAllPeople();

		const changes: Array<{ person: { name: string }; field: string; oldValue: string; newValue: string; file: TFile }> = [];

		// Common placeholder patterns (actual placeholder text, not empty values)
		const placeholderPatterns = [
			'(unknown)',
			'(Unknown)',
			'unknown',
			'Unknown',
			'UNKNOWN',
			'N/A',
			'n/a',
			'???',
			'...',
			'Empty',
			'empty',
			'EMPTY',
			'None',
			'none',
			'NONE',
		];

		const isPlaceholder = (value: unknown): boolean => {
			// Note: null, undefined, and empty strings are NOT placeholders - they're
			// intentionally empty fields, which is valid for optional properties.
			// We only flag actual placeholder text like "Unknown", "N/A", etc.
			if (value === null || value === undefined) return false;
			if (typeof value === 'string') {
				const trimmed = value.trim();
				if (trimmed === '') return false;
				if (placeholderPatterns.includes(trimmed)) return true;
				// Check for malformed wikilinks like "[[unknown) ]]"
				if (/^\[\[.*?\)\s*\]\]$/.test(trimmed)) return true;
				// Check for strings that are just commas and spaces
				if (/^[,\s]+$/.test(trimmed)) return true;
			}
			return false;
		};

		const cleanPlaceValue = (value: string): string | null => {
			// Handle comma-separated values like ", , , Canada"
			const parts = value.split(',').map(p => p.trim()).filter(p => p && !isPlaceholder(p));
			if (parts.length === 0) return null;
			return parts.join(', ');
		};

		for (const person of people) {
			const cache = this.app.metadataCache.getFileCache(person.file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter as Record<string, unknown>;

			// Check name field
			if (fm.name && isPlaceholder(fm.name)) {
				changes.push({
					person: { name: person.name || 'Unknown' },
					field: 'name',
					oldValue: String(fm.name as string),
					newValue: '(remove field)',
					file: person.file
				});
			}

			// Check place fields with comma cleanup
			const placeFields = ['birth_place', 'death_place', 'burial_place', 'residence'];
			for (const field of placeFields) {
				const value = fm[field];
				if (typeof value === 'string' && value.trim()) {
					const cleaned = cleanPlaceValue(value);
					if (cleaned === null) {
						// Entirely placeholder
						changes.push({
							person: { name: person.name || 'Unknown' },
							field,
							oldValue: value,
							newValue: '(remove field)',
							file: person.file
						});
					} else if (cleaned !== value) {
						// Has cleanup needed
						changes.push({
							person: { name: person.name || 'Unknown' },
							field,
							oldValue: value,
							newValue: cleaned,
							file: person.file
						});
					}
				} else if (field in fm && isPlaceholder(value)) {
					changes.push({
						person: { name: person.name || 'Unknown' },
						field,
						oldValue: String(value),
						newValue: '(remove field)',
						file: person.file
					});
				}
			}

			// Check relationship fields (spouse, father, mother, child/children)
			const relationshipFields = ['spouse', 'father', 'mother', 'child', 'children'];
			for (const field of relationshipFields) {
				const value = fm[field];
				if (Array.isArray(value)) {
					// Check if array contains only placeholders
					const nonPlaceholders = value.filter(v => !isPlaceholder(v));
					if (nonPlaceholders.length === 0 && value.length > 0) {
						changes.push({
							person: { name: person.name || 'Unknown' },
							field,
							oldValue: `[${value.length} placeholder ${value.length === 1 ? 'entry' : 'entries'}]`,
							newValue: '(remove field)',
							file: person.file
						});
					} else if (nonPlaceholders.length < value.length) {
						changes.push({
							person: { name: person.name || 'Unknown' },
							field,
							oldValue: `${value.length} entries (${value.length - nonPlaceholders.length} placeholders)`,
							newValue: `${nonPlaceholders.length} entries (cleaned)`,
							file: person.file
						});
					}
				} else if (field in fm && isPlaceholder(value)) {
					changes.push({
						person: { name: person.name || 'Unknown' },
						field,
						oldValue: String(value),
						newValue: '(remove field)',
						file: person.file
					});
				}
			}

			// Note: Empty parent/spouse fields (null, undefined, '') are intentionally
			// NOT flagged as issues - they represent unknown/missing data which is valid.
		}

		if (changes.length === 0) {
			new Notice('No placeholder values found');
			return;
		}

		// Show preview modal
		const modal = new PlaceholderRemovalPreviewModal(
			this.app,
			changes,
			async () => await this.removePlaceholders()
		);
		modal.open();
	}

	/**
	 * Remove empty/placeholder values
	 */
	private async removePlaceholders(): Promise<void> {
		new Notice('Removing placeholder values...');

		const familyGraph = this.plugin.createFamilyGraphService();
		familyGraph.ensureCacheLoaded();
		const people = familyGraph.getAllPeople();

		let modified = 0;
		const errors: string[] = [];

		// Common placeholder patterns (actual placeholder text, not empty values)
		const placeholderPatterns = [
			'(unknown)',
			'(Unknown)',
			'unknown',
			'Unknown',
			'UNKNOWN',
			'N/A',
			'n/a',
			'???',
			'...',
			'Empty',
			'empty',
			'EMPTY',
			'None',
			'none',
			'NONE',
		];

		const isPlaceholder = (value: unknown): boolean => {
			// Note: null, undefined, and empty strings are NOT placeholders - they're
			// intentionally empty fields, which is valid for optional properties.
			// We only flag actual placeholder text like "Unknown", "N/A", etc.
			if (value === null || value === undefined) return false;
			if (typeof value === 'string') {
				const trimmed = value.trim();
				if (trimmed === '') return false;
				if (placeholderPatterns.includes(trimmed)) return true;
				// Check for malformed wikilinks like "[[unknown) ]]"
				if (/^\[\[.*?\)\s*\]\]$/.test(trimmed)) return true;
				// Check for strings that are just commas and spaces
				if (/^[,\s]+$/.test(trimmed)) return true;
			}
			return false;
		};

		const cleanPlaceValue = (value: string): string | null => {
			// Handle comma-separated values like ", , , Canada"
			const parts = value.split(',').map(p => p.trim()).filter(p => p && !isPlaceholder(p));
			if (parts.length === 0) return null;
			return parts.join(', ');
		};

		for (const person of people) {

			try {
				const cache = this.app.metadataCache.getFileCache(person.file);
				if (!cache?.frontmatter) continue;

				let hasChanges = false;

				await this.app.fileManager.processFrontMatter(person.file, (frontmatter) => {
					// Remove placeholder name
					if (frontmatter.name && isPlaceholder(frontmatter.name)) {
						delete frontmatter.name;
						hasChanges = true;
					}

					// Clean or remove place fields
					const placeFields = ['birth_place', 'death_place', 'burial_place', 'residence'];
					for (const field of placeFields) {
						const value = frontmatter[field];
						if (typeof value === 'string' && value.trim()) {
							const cleaned = cleanPlaceValue(value);
							if (cleaned === null) {
								delete frontmatter[field];
								hasChanges = true;
							} else if (cleaned !== value) {
								frontmatter[field] = cleaned;
								hasChanges = true;
							}
						} else if (field in frontmatter && isPlaceholder(value)) {
							delete frontmatter[field];
							hasChanges = true;
						}
					}

					// Clean relationship arrays or remove if all placeholders
					const relationshipFields = ['spouse', 'child', 'children'];
					for (const field of relationshipFields) {
						const value = frontmatter[field];
						if (Array.isArray(value)) {
							const nonPlaceholders = value.filter(v => !isPlaceholder(v));
							if (nonPlaceholders.length === 0) {
								delete frontmatter[field];
								hasChanges = true;
							} else if (nonPlaceholders.length < value.length) {
								frontmatter[field] = nonPlaceholders;
								hasChanges = true;
							}
						} else if (field in frontmatter && isPlaceholder(value)) {
							delete frontmatter[field];
							hasChanges = true;
						}
					}

					// Remove placeholder parent fields
					const parentFields = ['father', 'mother'];
					for (const field of parentFields) {
						if (field in frontmatter && isPlaceholder(frontmatter[field])) {
							delete frontmatter[field];
							hasChanges = true;
						}
					}
				});

				if (hasChanges) {
					modified++;
				}
			} catch (error) {
				errors.push(`${person.file.path}: ${getErrorMessage(error)}`);
			}
		}

		// Show result
		if (modified > 0) {
			new Notice(`✓ Removed placeholders from ${modified} ${modified === 1 ? 'file' : 'files'}`);
		} else {
			new Notice('No placeholder values found');
		}

		if (errors.length > 0) {
			new Notice(`⚠ ${errors.length} errors occurred. Check console for details.`);
			console.error('Remove placeholders errors:', errors);
		}

		// Wait for file system to sync before reloading
		// Brief delay to ensure all file writes are complete
		if (modified > 0) {
			await new Promise(resolve => setTimeout(resolve, 500));
		}

		// Refresh the family graph cache
		await familyGraph.reloadCache();

		// Refresh the People tab
		this.showTab('people');
	}

	/**
	 * Preview adding cr_type: person to person notes
	 */
	private previewAddPersonType(): void {
		const familyGraph = this.plugin.createFamilyGraphService();
		familyGraph.ensureCacheLoaded();
		const people = familyGraph.getAllPeople();

		console.debug(`[DEBUG] previewAddPersonType: Found ${people.length} people from getAllPeople()`);

		const changes: Array<{ person: { name: string }; file: TFile }> = [];

		for (const person of people) {
			const cache = this.app.metadataCache.getFileCache(person.file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter as Record<string, unknown>;

			// Check if cr_type already exists
			if (!fm.cr_type) {
				changes.push({
					person: { name: person.name || 'Unknown' },
					file: person.file
				});
			}
		}

		console.debug(`[DEBUG] previewAddPersonType: Found ${changes.length} people needing cr_type`);

		// Show preview modal
		new AddPersonTypePreviewModal(
			this.app,
			changes,
			async () => await this.addPersonType()
		).open();
	}

	/**
	 * Add cr_type: person to all person notes
	 */
	private async addPersonType(): Promise<void> {
		new Notice('Adding cr_type property...');

		const familyGraph = this.plugin.createFamilyGraphService();
		familyGraph.ensureCacheLoaded();
		const people = familyGraph.getAllPeople();

		let modified = 0;
		const errors: string[] = [];

		for (const person of people) {

			try {
				const cache = this.app.metadataCache.getFileCache(person.file);
				if (!cache?.frontmatter) continue;

				let hasChanges = false;

				await this.app.fileManager.processFrontMatter(person.file, (frontmatter) => {
					// Add cr_type if it doesn't exist
					if (!frontmatter.cr_type) {
						frontmatter.cr_type = 'person';
						hasChanges = true;
					}
				});

				if (hasChanges) {
					modified++;
				}
			} catch (error) {
				errors.push(`${person.file.path}: ${getErrorMessage(error)}`);
			}
		}

		// Show result
		if (modified > 0) {
			new Notice(`✓ Added cr_type property to ${modified} ${modified === 1 ? 'file' : 'files'}`);
		} else {
			new Notice('All person notes already have cr_type property');
		}

		if (errors.length > 0) {
			new Notice(`⚠ ${errors.length} errors occurred. Check console for details.`);
			console.error('Add person type errors:', errors);
		}

		// Refresh the family graph cache
		await familyGraph.reloadCache();

		// Refresh the People tab
		this.showTab('people');
	}

	/**
	 * Preview name formatting normalization
	 */
	private previewNormalizeNames(): void {
		const familyGraph = this.plugin.createFamilyGraphService();
		familyGraph.ensureCacheLoaded();
		const people = familyGraph.getAllPeople();

		const changes: Array<{ person: { name: string }; field: string; oldValue: string; newValue: string; file: TFile }> = [];

		/**
		 * Normalize a name to proper Title Case with smart handling of prefixes
		 */
		const normalizeName = (name: string): string | null => {
			if (!name || typeof name !== 'string') return null;

			// Trim and collapse multiple spaces
			const cleaned = name.trim().replace(/\s+/g, ' ');
			if (!cleaned) return null;

			// Helper function to normalize a single word/segment
			const normalizeWord = (word: string, isFirstWord: boolean): string => {
				if (!word) return word;

				const lowerWord = word.toLowerCase();

				// Preserve initials (A., B., A.B., H.G., etc.)
				// Matches patterns like "A.", "A.B.", "H.G.", etc.
				if (/^([a-z]\.)+$/i.test(word)) {
					return word.toUpperCase();
				}

				// Preserve Roman numerals (I, II, III, IV, V, VI, VII, VIII, IX, X, etc.)
				if (/^[ivx]+$/i.test(word)) {
					return word.toUpperCase();
				}

				// Common surname prefixes that should stay lowercase (unless at start)
				const lowercasePrefixes = ['van', 'von', 'de', 'del', 'della', 'di', 'da', 'le', 'la', 'den', 'der', 'ten', 'ter', 'du'];
				if (!isFirstWord && lowercasePrefixes.includes(lowerWord)) {
					return lowerWord;
				}

				// Handle Mac prefix (but not "Mack" as a standalone name)
				// Only apply if there are at least 2 more letters after "Mac"
				if (lowerWord.startsWith('mac') && word.length > 5) {
					return 'Mac' + word.charAt(3).toUpperCase() + word.slice(4).toLowerCase();
				}

				// Handle Mc prefix
				if (lowerWord.startsWith('mc') && word.length > 2) {
					return 'Mc' + word.charAt(2).toUpperCase() + word.slice(3).toLowerCase();
				}

				// Handle O' prefix
				if (lowerWord.startsWith("o'") && word.length > 2) {
					return "O'" + word.charAt(2).toUpperCase() + word.slice(3).toLowerCase();
				}

				// Handle hyphenated names (Abdul-Aziz, Mary-Jane, etc.)
				if (word.includes('-')) {
					return word.split('-')
						.map(part => normalizeWord(part, false))
						.join('-');
				}

				// Standard title case
				return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
			};

			// Split by spaces to get words
			const words = cleaned.split(' ');
			const normalized = words.map((word, index) => {
				// Handle parentheses - preserve content inside and apply title case
				if (word.startsWith('(') && word.endsWith(')')) {
					const inner = word.slice(1, -1);
					return '(' + normalizeWord(inner, false) + ')';
				}

				// Handle opening parenthesis
				if (word.startsWith('(')) {
					const inner = word.slice(1);
					return '(' + normalizeWord(inner, index === 0);
				}

				// Handle closing parenthesis
				if (word.endsWith(')')) {
					const inner = word.slice(0, -1);
					return normalizeWord(inner, false) + ')';
				}

				return normalizeWord(word, index === 0);
			});

			const result = normalized.join(' ');

			// Only return if it's different from the input
			return result !== cleaned ? result : null;
		};

		for (const person of people) {
			const cache = this.app.metadataCache.getFileCache(person.file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter as Record<string, unknown>;

			// Check name field
			if (fm.name && typeof fm.name === 'string') {
				const normalized = normalizeName(fm.name);
				if (normalized) {
					changes.push({
						person: { name: person.name || 'Unknown' },
						field: 'name',
						oldValue: fm.name,
						newValue: normalized,
						file: person.file
					});
				}
			}
		}

		if (changes.length === 0) {
			new Notice('No names need normalization');
			return;
		}

		const modal = new NameNormalizationPreviewModal(
			this.app,
			changes,
			async () => await this.normalizeNames()
		);
		modal.open();
	}

	/**
	 * Apply name formatting normalization
	 */
	private async normalizeNames(): Promise<void> {
		new Notice('Normalizing name formatting...');

		const familyGraph = this.plugin.createFamilyGraphService();
		familyGraph.ensureCacheLoaded();
		const people = familyGraph.getAllPeople();

		let modified = 0;
		const errors: string[] = [];

		/**
		 * Normalize a name to proper Title Case with smart handling of prefixes
		 */
		const normalizeName = (name: string): string | null => {
			if (!name || typeof name !== 'string') return null;

			// Trim and collapse multiple spaces
			const cleaned = name.trim().replace(/\s+/g, ' ');
			if (!cleaned) return null;

			// Helper function to normalize a single word/segment
			const normalizeWord = (word: string, isFirstWord: boolean): string => {
				if (!word) return word;

				const lowerWord = word.toLowerCase();

				// Preserve initials (A., B., A.B., H.G., etc.)
				// Matches patterns like "A.", "A.B.", "H.G.", etc.
				if (/^([a-z]\.)+$/i.test(word)) {
					return word.toUpperCase();
				}

				// Preserve Roman numerals (I, II, III, IV, V, VI, VII, VIII, IX, X, etc.)
				if (/^[ivx]+$/i.test(word)) {
					return word.toUpperCase();
				}

				// Common surname prefixes that should stay lowercase (unless at start)
				const lowercasePrefixes = ['van', 'von', 'de', 'del', 'della', 'di', 'da', 'le', 'la', 'den', 'der', 'ten', 'ter', 'du'];
				if (!isFirstWord && lowercasePrefixes.includes(lowerWord)) {
					return lowerWord;
				}

				// Handle Mac prefix (but not "Mack" as a standalone name)
				// Only apply if there are at least 2 more letters after "Mac"
				if (lowerWord.startsWith('mac') && word.length > 5) {
					return 'Mac' + word.charAt(3).toUpperCase() + word.slice(4).toLowerCase();
				}

				// Handle Mc prefix
				if (lowerWord.startsWith('mc') && word.length > 2) {
					return 'Mc' + word.charAt(2).toUpperCase() + word.slice(3).toLowerCase();
				}

				// Handle O' prefix
				if (lowerWord.startsWith("o'") && word.length > 2) {
					return "O'" + word.charAt(2).toUpperCase() + word.slice(3).toLowerCase();
				}

				// Handle hyphenated names (Abdul-Aziz, Mary-Jane, etc.)
				if (word.includes('-')) {
					return word.split('-')
						.map(part => normalizeWord(part, false))
						.join('-');
				}

				// Standard title case
				return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
			};

			// Split by spaces to get words
			const words = cleaned.split(' ');
			const normalized = words.map((word, index) => {
				// Handle parentheses - preserve content inside and apply title case
				if (word.startsWith('(') && word.endsWith(')')) {
					const inner = word.slice(1, -1);
					return '(' + normalizeWord(inner, false) + ')';
				}

				// Handle opening parenthesis
				if (word.startsWith('(')) {
					const inner = word.slice(1);
					return '(' + normalizeWord(inner, index === 0);
				}

				// Handle closing parenthesis
				if (word.endsWith(')')) {
					const inner = word.slice(0, -1);
					return normalizeWord(inner, false) + ')';
				}

				return normalizeWord(word, index === 0);
			});

			const result = normalized.join(' ');

			// Only return if it's different from the input
			return result !== cleaned ? result : null;
		};

		for (const person of people) {

			try {
				const cache = this.app.metadataCache.getFileCache(person.file);
				if (!cache?.frontmatter) continue;

				const fm = cache.frontmatter as Record<string, unknown>;
				let hasChanges = false;

				await this.app.fileManager.processFrontMatter(person.file, (frontmatter) => {
					// Normalize name field
					if (fm.name && typeof fm.name === 'string') {
						const normalized = normalizeName(fm.name);
						if (normalized) {
							frontmatter.name = normalized;
							hasChanges = true;
						}
					}
				});

				if (hasChanges) {
					modified++;
				}
			} catch (error) {
				errors.push(`${person.file.path}: ${getErrorMessage(error)}`);
			}
		}

		// Show result
		if (modified > 0) {
			new Notice(`✓ Normalized names in ${modified} ${modified === 1 ? 'file' : 'files'}`);
		} else {
			new Notice('No names needed normalization');
		}

		if (errors.length > 0) {
			new Notice(`⚠ ${errors.length} errors occurred. Check console for details.`);
			console.error('Normalize names errors:', errors);
		}

		// Refresh the family graph cache
		await familyGraph.reloadCache();

		// Refresh the People tab
		this.showTab('people');
	}

	/**
	 * Preview orphaned cr_id reference removal
	 */
	private previewRemoveOrphanedRefs(): void {
		const changes: Array<{ person: { name: string; file: TFile }; field: string; orphanedId: string }> = [];

		// Build a map of all valid cr_ids
		const validCrIds = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const crId = cache?.frontmatter?.cr_id;
			if (crId && typeof crId === 'string') {
				validCrIds.add(crId);
			}
		}

		// Check each person for orphaned references
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter?.cr_id) continue;

			const fm = cache.frontmatter as Record<string, unknown>;
			const personName = (fm.name as string) || file.basename;

			// Check father_id
			const fatherId = fm.father_id;
			if (fatherId && typeof fatherId === 'string' && !validCrIds.has(fatherId)) {
				changes.push({
					person: { name: personName, file },
					field: 'father_id',
					orphanedId: fatherId
				});
			}

			// Check mother_id
			const motherId = fm.mother_id;
			if (motherId && typeof motherId === 'string' && !validCrIds.has(motherId)) {
				changes.push({
					person: { name: personName, file },
					field: 'mother_id',
					orphanedId: motherId
				});
			}

			// Check spouse_id (can be string or array)
			const spouseId = fm.spouse_id;
			if (spouseId) {
				const spouseIds = Array.isArray(spouseId) ? spouseId : [spouseId];
				for (const id of spouseIds) {
					if (typeof id === 'string' && !validCrIds.has(id)) {
						changes.push({
							person: { name: personName, file },
							field: 'spouse_id',
							orphanedId: id
						});
					}
				}
			}

			// Check partners_id (alias for spouse_id)
			const partnersId = fm.partners_id;
			if (partnersId) {
				const partnerIds = Array.isArray(partnersId) ? partnersId : [partnersId];
				for (const id of partnerIds) {
					if (typeof id === 'string' && !validCrIds.has(id)) {
						changes.push({
							person: { name: personName, file },
							field: 'partners_id',
							orphanedId: id
						});
					}
				}
			}

			// Check children_id (can be string or array)
			const childrenId = fm.children_id;
			if (childrenId) {
				const childrenIds = Array.isArray(childrenId) ? childrenId : [childrenId];
				for (const id of childrenIds) {
					if (typeof id === 'string' && !validCrIds.has(id)) {
						changes.push({
							person: { name: personName, file },
							field: 'children_id',
							orphanedId: id
						});
					}
				}
			}
		}

		if (changes.length === 0) {
			new Notice('No orphaned cr_id references found');
			return;
		}

		const modal = new OrphanedRefsPreviewModal(
			this.app,
			changes,
			async () => await this.removeOrphanedRefs()
		);
		modal.open();
	}

	/**
	 * Remove orphaned cr_id references
	 */
	private async removeOrphanedRefs(): Promise<void> {
		const familyGraph = this.plugin.createFamilyGraphService();
		familyGraph.ensureCacheLoaded();

		let modified = 0;
		const errors: Array<{ file: string; error: string }> = [];

		new Notice('Removing orphaned cr_id references...');

		// Build a map of all valid cr_ids
		const validCrIds = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const crId = cache?.frontmatter?.cr_id;
			if (crId && typeof crId === 'string') {
				validCrIds.add(crId);
			}
		}

		// Process each file
		for (const file of files) {

			try {
				const cache = this.app.metadataCache.getFileCache(file);
				if (!cache?.frontmatter?.cr_id) continue;

				let hasChanges = false;

				await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
					// Clean father_id
					if (frontmatter.father_id && typeof frontmatter.father_id === 'string') {
						if (!validCrIds.has(frontmatter.father_id)) {
							delete frontmatter.father_id;
							hasChanges = true;
						}
					}

					// Clean mother_id
					if (frontmatter.mother_id && typeof frontmatter.mother_id === 'string') {
						if (!validCrIds.has(frontmatter.mother_id)) {
							delete frontmatter.mother_id;
							hasChanges = true;
						}
					}

					// Clean spouse_id
					if (frontmatter.spouse_id) {
						const spouseIds = Array.isArray(frontmatter.spouse_id)
							? frontmatter.spouse_id
							: [frontmatter.spouse_id];
						const validSpouseIds = spouseIds.filter((id: unknown) =>
							typeof id === 'string' && validCrIds.has(id)
						);

						if (validSpouseIds.length !== spouseIds.length) {
							if (validSpouseIds.length === 0) {
								delete frontmatter.spouse_id;
							} else if (validSpouseIds.length === 1) {
								frontmatter.spouse_id = validSpouseIds[0];
							} else {
								frontmatter.spouse_id = validSpouseIds;
							}
							hasChanges = true;
						}
					}

					// Clean partners_id
					if (frontmatter.partners_id) {
						const partnerIds = Array.isArray(frontmatter.partners_id)
							? frontmatter.partners_id
							: [frontmatter.partners_id];
						const validPartnerIds = partnerIds.filter((id: unknown) =>
							typeof id === 'string' && validCrIds.has(id)
						);

						if (validPartnerIds.length !== partnerIds.length) {
							if (validPartnerIds.length === 0) {
								delete frontmatter.partners_id;
							} else if (validPartnerIds.length === 1) {
								frontmatter.partners_id = validPartnerIds[0];
							} else {
								frontmatter.partners_id = validPartnerIds;
							}
							hasChanges = true;
						}
					}

					// Clean children_id
					if (frontmatter.children_id) {
						const childrenIds = Array.isArray(frontmatter.children_id)
							? frontmatter.children_id
							: [frontmatter.children_id];
						const validChildrenIds = childrenIds.filter((id: unknown) =>
							typeof id === 'string' && validCrIds.has(id)
						);

						if (validChildrenIds.length !== childrenIds.length) {
							if (validChildrenIds.length === 0) {
								delete frontmatter.children_id;
							} else if (validChildrenIds.length === 1) {
								frontmatter.children_id = validChildrenIds[0];
							} else {
								frontmatter.children_id = validChildrenIds;
							}
							hasChanges = true;
						}
					}
				});

				if (hasChanges) {
					modified++;
				}
			} catch (error) {
				errors.push({
					file: file.path,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}

		if (modified > 0) {
			new Notice(`✓ Removed orphaned references from ${modified} ${modified === 1 ? 'file' : 'files'}`);
		} else {
			new Notice('No orphaned cr_id references found');
		}

		if (errors.length > 0) {
			new Notice(`⚠ ${errors.length} errors occurred. Check console for details.`);
			console.error('Remove orphaned refs errors:', errors);
		}

		// Refresh the family graph cache
		await familyGraph.reloadCache();

		// Refresh the People tab
		this.showTab('people');
	}

	/**
	 * Preview fixing bidirectional relationship inconsistencies
	 */
	private async previewFixBidirectionalRelationships(): Promise<void> {
		// Create folder filter and family graph service
		const folderFilter1 = new FolderFilterService(this.plugin.settings);
		const familyGraph1 = this.plugin.createFamilyGraphService();
		// Force reload to ensure we have fresh data (cache may be stale after previous fixes)
		await familyGraph1.reloadCache();
		familyGraph1.setFolderFilter(folderFilter1);
		familyGraph1.setPropertyAliases(this.plugin.settings.propertyAliases);
		familyGraph1.setValueAliases(this.plugin.settings.valueAliases);

		const dataQuality1 = new DataQualityService(
			this.app,
			this.plugin.settings,
			familyGraph1,
			folderFilter1,
			this.plugin
		);

		new Notice('Detecting bidirectional relationship inconsistencies...');

		const inconsistencies = dataQuality1.detectBidirectionalInconsistencies();

		if (inconsistencies.length === 0) {
			new Notice('No bidirectional relationship inconsistencies found');
			return;
		}

		// Separate fixable inconsistencies from conflicts
		const fixableInconsistencies = inconsistencies.filter(i => i.type !== 'conflicting-parent-claim');
		const conflictCount = inconsistencies.filter(i => i.type === 'conflicting-parent-claim').length;

		// Notify about conflicts (handled separately in People tab)
		if (conflictCount > 0) {
			new Notice(`Found ${conflictCount} parent claim conflict${conflictCount === 1 ? '' : 's'}. See the "Parent claim conflicts" card in the People tab to resolve.`, 8000);
		}

		if (fixableInconsistencies.length === 0) {
			if (conflictCount > 0) {
				new Notice('No auto-fixable inconsistencies found. Only conflicts requiring manual resolution.');
			}
			return;
		}

		// Transform fixable inconsistencies to modal format
		const changes = fixableInconsistencies.map((issue: BidirectionalInconsistency) => ({
			person: {
				name: issue.person.name || issue.person.file.basename,
				file: issue.person.file
			},
			relatedPerson: {
				name: issue.relatedPerson.name || issue.relatedPerson.file.basename,
				file: issue.relatedPerson.file
			},
			type: issue.type,
			description: issue.description
		}));

		const modal = new BidirectionalInconsistencyPreviewModal(
			this.app,
			changes,
			async () => await this.fixBidirectionalRelationships()
		);
		modal.open();
	}

	/**
	 * Fix bidirectional relationship inconsistencies
	 */
	private async fixBidirectionalRelationships(): Promise<void> {
		// Create folder filter and family graph service
		const folderFilter2 = new FolderFilterService(this.plugin.settings);
		const familyGraph2 = this.plugin.createFamilyGraphService();
		// Force reload to ensure we have fresh data before fixing
		await familyGraph2.reloadCache();
		familyGraph2.setFolderFilter(folderFilter2);
		familyGraph2.setPropertyAliases(this.plugin.settings.propertyAliases);
		familyGraph2.setValueAliases(this.plugin.settings.valueAliases);

		const dataQuality2 = new DataQualityService(
			this.app,
			this.plugin.settings,
			familyGraph2,
			folderFilter2,
			this.plugin
		);

		new Notice('Detecting inconsistencies...');

		const inconsistencies = dataQuality2.detectBidirectionalInconsistencies();

		if (inconsistencies.length === 0) {
			new Notice('No bidirectional relationship inconsistencies found');
			return;
		}

		new Notice('Fixing bidirectional relationship inconsistencies...');

		// Suspend automatic bidirectional linking during batch operation
		// to prevent interference with our updates
		this.plugin.bidirectionalLinker?.suspend();

		try {
			const result = await dataQuality2.fixBidirectionalInconsistencies(inconsistencies);

			if (result.modified > 0) {
				new Notice(`✓ Fixed ${result.modified} of ${result.processed} inconsistenc${result.processed === 1 ? 'y' : 'ies'}. Wait a moment before re-checking.`, 5000);
			} else {
				new Notice('No inconsistencies were fixed');
			}

			if (result.errors.length > 0) {
				new Notice(`⚠ ${result.errors.length} errors occurred. Check console for details.`);
				console.error('Fix bidirectional relationships errors:', result.errors);
			}

			// Wait for all pending file watcher events to process before resuming linker
			// This prevents the bidirectional linker from reverting our fixes
			await new Promise(resolve => setTimeout(resolve, 500));
		} finally {
			// Always resume bidirectional linking, even if errors occurred
			this.plugin.bidirectionalLinker?.resume();
		}

		// Refresh the People tab
		this.showTab('people');
	}

	/**
	 * Preview impossible dates detection
	 */
	private previewDetectImpossibleDates(): void {
		const folderFilter3 = new FolderFilterService(this.plugin.settings);
		const familyGraph3 = this.plugin.createFamilyGraphService();
		familyGraph3.ensureCacheLoaded();
		familyGraph3.setFolderFilter(folderFilter3);
		familyGraph3.setPropertyAliases(this.plugin.settings.propertyAliases);
		familyGraph3.setValueAliases(this.plugin.settings.valueAliases);

		const dataQuality3 = new DataQualityService(
			this.app,
			this.plugin.settings,
			familyGraph3,
			folderFilter3,
			this.plugin
		);

		const issues = dataQuality3.detectImpossibleDates();

		// Transform to modal format
		const previewItems = issues.map((issue: ImpossibleDateIssue) => ({
			person: {
				name: issue.person.name || issue.person.file.basename,
				file: issue.person.file
			},
			relatedPerson: issue.relatedPerson ? {
				name: issue.relatedPerson.name || issue.relatedPerson.file.basename,
				file: issue.relatedPerson.file
			} : undefined,
			type: issue.type,
			description: issue.description,
			personDate: issue.personDate,
			relatedDate: issue.relatedDate
		}));

		// Open modal
		const modal = new ImpossibleDatesPreviewModal(this.app, previewItems);
		modal.open();
	}

	/**
	 * Preview date format validation
	 */
	private previewValidateDates(): void {
		const familyGraph = this.plugin.createFamilyGraphService();
		familyGraph.ensureCacheLoaded();

		const issues: Array<{
			file: TFile;
			name: string;
			field: string;
			value: string;
			issue: string;
		}> = [];

		new Notice('Analyzing date formats...');

		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter?.cr_id) continue;

			const fm = cache.frontmatter as Record<string, unknown>;
			const name = (fm.name as string) || file.basename;

			// Skip fictional dates (they have fc-calendar property)
			if (fm['fc-calendar']) continue;

			// Check born/birth_date field
			const born = fm.born || fm.birth_date;
			if (born && typeof born === 'string') {
				const issue = this.validateDateFormat(born);
				if (issue) {
					issues.push({
						file,
						name,
						field: fm.born ? 'born' : 'birth_date',
						value: born,
						issue
					});
				}
			}

			// Check died/death_date field
			const died = fm.died || fm.death_date;
			if (died && typeof died === 'string') {
				const issue = this.validateDateFormat(died);
				if (issue) {
					issues.push({
						file,
						name,
						field: fm.died ? 'died' : 'death_date',
						value: died,
						issue
					});
				}
			}
		}

		if (issues.length === 0) {
			new Notice('✓ All dates are valid according to your validation settings');
			return;
		}

		// Show preview modal
		new DateValidationPreviewModal(this.app, this.plugin, issues).open();
	}

	/**
	 * Validate a date string according to current settings
	 * @returns Issue description if invalid, null if valid
	 */
	private validateDateFormat(dateStr: string): string | null {
		const settings = this.plugin.settings;
		const trimmed = dateStr.trim();

		// Check for circa dates
		const circaPrefixes = ['c.', 'ca.', 'circa', '~'];
		const hasCirca = circaPrefixes.some(prefix =>
			trimmed.toLowerCase().startsWith(prefix) ||
			trimmed.toLowerCase().startsWith(prefix + ' ')
		);

		if (hasCirca && !settings.allowCircaDates) {
			return 'Circa dates not allowed (check "Allow circa dates" setting)';
		}

		// Remove circa prefix for further validation
		let cleanDate = trimmed;
		if (hasCirca) {
			for (const prefix of circaPrefixes) {
				if (cleanDate.toLowerCase().startsWith(prefix)) {
					cleanDate = cleanDate.slice(prefix.length).trim();
					break;
				}
				if (cleanDate.toLowerCase().startsWith(prefix + ' ')) {
					cleanDate = cleanDate.slice(prefix.length + 1).trim();
					break;
				}
			}
		}

		// Check for date ranges
		const hasRange = cleanDate.includes(' to ') ||
			(cleanDate.includes('-') && cleanDate.split('-').length === 3 && cleanDate.split('-')[2].length === 4);

		if (hasRange && !settings.allowDateRanges) {
			return 'Date ranges not allowed (check "Allow date ranges" setting)';
		}

		// If it's a range, validate each part separately
		if (hasRange) {
			const parts = cleanDate.includes(' to ')
				? cleanDate.split(' to ')
				: cleanDate.split('-').slice(0, 2);

			for (const part of parts) {
				const partIssue = this.validateSingleDate(part.trim());
				if (partIssue) return partIssue;
			}
			return null;
		}

		// Validate single date
		return this.validateSingleDate(cleanDate);
	}

	/**
	 * Validate a single date (not a range) according to current settings
	 */
	private validateSingleDate(dateStr: string): string | null {
		const settings = this.plugin.settings;

		// ISO 8601 format: YYYY-MM-DD or YYYY-MM or YYYY
		const iso8601Full = /^(\d{4})-(\d{2})-(\d{2})$/;
		const iso8601Month = /^(\d{4})-(\d{2})$/;
		const iso8601Year = /^(\d{4})$/;
		const iso8601NoZeros = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

		// GEDCOM format: DD MMM YYYY or DD MMM or MMM YYYY
		const gedcomFull = /^(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})$/i;
		const gedcomMonth = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})$/i;

		// Check for standard: ISO 8601
		if (settings.dateFormatStandard === 'iso8601') {
			// Check if leading zeros are required
			if (settings.requireLeadingZeros) {
				if (iso8601Full.test(dateStr)) return null;
				if (settings.allowPartialDates && iso8601Month.test(dateStr)) return null;
				if (settings.allowPartialDates && iso8601Year.test(dateStr)) return null;
				return 'ISO 8601 format required with leading zeros (YYYY-MM-DD)';
			} else {
				if (iso8601Full.test(dateStr) || iso8601NoZeros.test(dateStr)) return null;
				if (settings.allowPartialDates && (iso8601Month.test(dateStr) || iso8601Year.test(dateStr))) return null;
				return 'ISO 8601 format required (YYYY-MM-DD or YYYY-M-D)';
			}
		}

		// Check for standard: GEDCOM
		if (settings.dateFormatStandard === 'gedcom') {
			if (gedcomFull.test(dateStr)) return null;
			if (settings.allowPartialDates && gedcomMonth.test(dateStr)) return null;
			if (settings.allowPartialDates && iso8601Year.test(dateStr)) return null;
			return 'GEDCOM format required (DD MMM YYYY, e.g., 15 JAN 1920)';
		}

		// Flexible standard: accept multiple formats
		if (settings.dateFormatStandard === 'flexible') {
			// Accept ISO 8601 formats
			if (iso8601Full.test(dateStr) || (!settings.requireLeadingZeros && iso8601NoZeros.test(dateStr))) return null;
			if (settings.allowPartialDates && (iso8601Month.test(dateStr) || iso8601Year.test(dateStr))) return null;

			// Accept GEDCOM formats
			if (gedcomFull.test(dateStr)) return null;
			if (settings.allowPartialDates && gedcomMonth.test(dateStr)) return null;

			// If we got here, the format is not recognized
			return 'Unrecognized date format (expected YYYY-MM-DD or DD MMM YYYY)';
		}

		return 'Unknown date format standard';
	}

	/**
	 * Apply date format validation (currently just shows preview)
	 * Note: We don't auto-correct dates as this could introduce errors
	 */
	private validateDates(): void {
		new Notice('Date validation is preview-only. Review issues and manually correct dates in your notes.');
		this.previewValidateDates();
	}
}

/**
 * Modal for previewing duplicate relationship removal
 */
class DuplicateRelationshipsPreviewModal extends Modal {
	// All changes for this operation
	private allChanges: Array<{ person: { name: string }; field: string; oldValue: string; newValue: string; file: TFile }>;
	// Filtered/sorted changes for display
	private filteredChanges: Array<{ person: { name: string }; field: string; oldValue: string; newValue: string; file: TFile }> = [];
	private onApply: () => Promise<void>;

	// Filter state
	private searchQuery = '';
	private selectedField = 'all';
	private sortAscending = true;

	// UI elements
	private tbody: HTMLTableSectionElement | null = null;
	private countEl: HTMLElement | null = null;

	constructor(
		app: App,
		changes: Array<{ person: { name: string }; field: string; oldValue: string; newValue: string; file: TFile }>,
		onApply: () => Promise<void>
	) {
		super(app);
		this.allChanges = changes;
		this.onApply = onApply;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;

		// Add modal class for sizing
		this.modalEl.addClass('crc-batch-preview-modal');

		titleEl.setText('Preview: Remove duplicate relationships');

		// Count display
		this.countEl = contentEl.createEl('p', { cls: 'crc-batch-count' });

		// Controls row: search + filter + sort
		const controlsRow = contentEl.createDiv({ cls: 'crc-batch-controls' });

		// Search input
		const searchContainer = controlsRow.createDiv({ cls: 'crc-batch-search' });
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search by name...',
			cls: 'crc-batch-search-input'
		});
		searchInput.addEventListener('input', () => {
			this.searchQuery = searchInput.value.toLowerCase();
			this.applyFiltersAndSort();
		});

		// Field filter dropdown (only show if multiple fields)
		const uniqueFields = [...new Set(this.allChanges.map(c => c.field))];
		if (uniqueFields.length > 1) {
			const filterContainer = controlsRow.createDiv({ cls: 'crc-batch-filter' });
			const filterSelect = filterContainer.createEl('select', { cls: 'crc-batch-filter-select' });
			filterSelect.createEl('option', { text: 'All fields', value: 'all' });
			for (const field of uniqueFields.sort()) {
				filterSelect.createEl('option', { text: field, value: field });
			}
			filterSelect.addEventListener('change', () => {
				this.selectedField = filterSelect.value;
				this.applyFiltersAndSort();
			});
		}

		// Sort toggle
		const sortContainer = controlsRow.createDiv({ cls: 'crc-batch-sort' });
		const sortBtn = sortContainer.createEl('button', {
			text: 'A→Z',
			cls: 'crc-batch-sort-btn'
		});
		sortBtn.addEventListener('click', () => {
			this.sortAscending = !this.sortAscending;
			sortBtn.textContent = this.sortAscending ? 'A→Z' : 'Z→A';
			this.applyFiltersAndSort();
		});

		// Scrollable table container
		const tableContainer = contentEl.createDiv({ cls: 'crc-batch-table-container' });
		const table = tableContainer.createEl('table', { cls: 'crc-batch-preview-table' });

		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Person' });
		headerRow.createEl('th', { text: 'Field' });
		headerRow.createEl('th', { text: 'Current' });
		headerRow.createEl('th', { text: 'After' });
		headerRow.createEl('th', { text: 'Actions' });

		this.tbody = table.createEl('tbody');

		// Initial render
		this.applyFiltersAndSort();

		// Backup warning
		const warning = contentEl.createDiv({ cls: 'crc-warning-callout' });
		const warningIcon = createLucideIcon('alert-triangle', 16);
		warning.appendChild(warningIcon);
		warning.createSpan({
			text: ' Backup your vault before proceeding. This operation will modify existing notes.'
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-confirmation-buttons' });

		const cancelButton = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn-secondary'
		});
		cancelButton.addEventListener('click', () => this.close());

		const applyButton = buttonContainer.createEl('button', {
			text: `Apply ${this.allChanges.length} change${this.allChanges.length === 1 ? '' : 's'}`,
			cls: 'mod-cta'
		});
		applyButton.addEventListener('click', () => {
			void (async () => {
				// Disable buttons during operation
				applyButton.disabled = true;
				cancelButton.disabled = true;
				applyButton.textContent = 'Applying changes...';

				// Run the operation
				await this.onApply();

				// Close the modal after completion (like BuildPlaceHierarchyModal)
				// This avoids stale cache issues when user reopens the preview
				this.close();
			})();
		});
	}

	/**
	 * Apply filters and sorting, then re-render the table
	 */
	private applyFiltersAndSort(): void {
		// Filter
		this.filteredChanges = this.allChanges.filter(change => {
			// Search filter
			if (this.searchQuery && !change.person.name.toLowerCase().includes(this.searchQuery)) {
				return false;
			}
			// Field filter
			if (this.selectedField !== 'all' && change.field !== this.selectedField) {
				return false;
			}
			return true;
		});

		// Sort by person name
		this.filteredChanges.sort((a, b) => {
			const cmp = a.person.name.localeCompare(b.person.name);
			return this.sortAscending ? cmp : -cmp;
		});

		// Update count
		if (this.countEl) {
			const peopleCount = new Set(this.allChanges.map(c => c.person.name)).size;
			if (this.filteredChanges.length === this.allChanges.length) {
				this.countEl.textContent = `Found ${this.allChanges.length} duplicate relationship ${this.allChanges.length === 1 ? 'entry' : 'entries'} across ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}:`;
			} else {
				this.countEl.textContent = `Showing ${this.filteredChanges.length} of ${this.allChanges.length} duplicate entries:`;
			}
		}

		// Re-render table
		this.renderTable();
	}

	/**
	 * Render the filtered/sorted changes to the table body
	 */
	private renderTable(): void {
		if (!this.tbody) return;

		this.tbody.empty();

		for (const change of this.filteredChanges) {
			const row = this.tbody.createEl('tr');
			row.createEl('td', { text: change.person.name });
			row.createEl('td', { text: change.field });
			// Old value with strikethrough
			const oldCell = row.createEl('td', { cls: 'crc-batch-old-value' });
			oldCell.createEl('s', { text: change.oldValue, cls: 'crc-text--muted' });
			row.createEl('td', { text: change.newValue, cls: 'crc-batch-new-value' });

			// Action buttons (inline)
			const actionCell = row.createEl('td', { cls: 'crc-batch-actions crc-batch-actions--inline' });

			// Open in new tab button
			const openTabBtn = actionCell.createEl('button', {
				cls: 'crc-batch-action-btn clickable-icon',
				attr: { 'aria-label': 'Open note in new tab' }
			});
			const fileIcon = createLucideIcon('file-text', 14);
			openTabBtn.appendChild(fileIcon);
			openTabBtn.addEventListener('click', () => {
				void this.app.workspace.getLeaf('tab').openFile(change.file);
			});

			// Open in new window button
			const openWindowBtn = actionCell.createEl('button', {
				cls: 'crc-batch-action-btn clickable-icon',
				attr: { 'aria-label': 'Open note in new window' }
			});
			const windowIcon = createLucideIcon('external-link', 14);
			openWindowBtn.appendChild(windowIcon);
			openWindowBtn.addEventListener('click', () => {
				void this.app.workspace.getLeaf('window').openFile(change.file);
			});
		}

		if (this.filteredChanges.length === 0 && this.allChanges.length > 0) {
			const row = this.tbody.createEl('tr');
			const cell = row.createEl('td', {
				text: 'No matches found',
				cls: 'crc-text-muted'
			});
			cell.setAttribute('colspan', '5');
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for previewing placeholder value removal
 */
class PlaceholderRemovalPreviewModal extends Modal {
	// All changes for this operation
	private allChanges: Array<{ person: { name: string }; field: string; oldValue: string; newValue: string; file: TFile }>;
	// Filtered/sorted changes for display
	private filteredChanges: Array<{ person: { name: string }; field: string; oldValue: string; newValue: string; file: TFile }> = [];
	private onApply: () => Promise<void>;

	// Filter state
	private searchQuery = '';
	private selectedField = 'all';
	private sortAscending = true;

	// UI elements
	private tbody: HTMLTableSectionElement | null = null;
	private countEl: HTMLElement | null = null;

	constructor(
		app: App,
		changes: Array<{ person: { name: string }; field: string; oldValue: string; newValue: string; file: TFile }>,
		onApply: () => Promise<void>
	) {
		super(app);
		this.allChanges = changes;
		this.onApply = onApply;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;

		// Add modal class for sizing
		this.modalEl.addClass('crc-batch-preview-modal');

		titleEl.setText('Preview: Remove placeholder values');

		// Description
		const description = contentEl.createDiv({ cls: 'crc-batch-description' });
		description.createEl('p', {
			text: 'This operation removes common placeholder values from GEDCOM imports and data entry mistakes:'
		});
		const useCases = description.createEl('ul');
		useCases.createEl('li', { text: 'Placeholder text: (unknown), Unknown, N/A, ???, Empty, None' });
		useCases.createEl('li', { text: 'Malformed wikilinks: [[unknown) ]] with mismatched brackets' });
		useCases.createEl('li', { text: 'Leading commas in places: ", , , Canada" → "Canada"' });
		useCases.createEl('li', { text: 'Empty parent/spouse fields showing as "Empty"' });

		// Count display
		this.countEl = contentEl.createEl('p', { cls: 'crc-batch-count' });

		// Controls row: search + filter + sort
		const controlsRow = contentEl.createDiv({ cls: 'crc-batch-controls' });

		// Search input
		const searchContainer = controlsRow.createDiv({ cls: 'crc-batch-search' });
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search by name...',
			cls: 'crc-batch-search-input'
		});
		searchInput.addEventListener('input', () => {
			this.searchQuery = searchInput.value.toLowerCase();
			this.applyFiltersAndSort();
		});

		// Field filter dropdown (only show if multiple fields)
		const uniqueFields = [...new Set(this.allChanges.map(c => c.field))];
		if (uniqueFields.length > 1) {
			const filterContainer = controlsRow.createDiv({ cls: 'crc-batch-filter' });
			const filterSelect = filterContainer.createEl('select', { cls: 'crc-batch-filter-select' });
			filterSelect.createEl('option', { text: 'All fields', value: 'all' });
			for (const field of uniqueFields.sort()) {
				filterSelect.createEl('option', { text: field, value: field });
			}
			filterSelect.addEventListener('change', () => {
				this.selectedField = filterSelect.value;
				this.applyFiltersAndSort();
			});
		}

		// Sort toggle
		const sortContainer = controlsRow.createDiv({ cls: 'crc-batch-sort' });
		const sortBtn = sortContainer.createEl('button', {
			text: 'A→Z',
			cls: 'crc-batch-sort-btn'
		});
		sortBtn.addEventListener('click', () => {
			this.sortAscending = !this.sortAscending;
			sortBtn.textContent = this.sortAscending ? 'A→Z' : 'Z→A';
			this.applyFiltersAndSort();
		});

		// Scrollable table container
		const tableContainer = contentEl.createDiv({ cls: 'crc-batch-table-container' });
		const table = tableContainer.createEl('table', { cls: 'crc-batch-preview-table' });

		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Person' });
		headerRow.createEl('th', { text: 'Field' });
		headerRow.createEl('th', { text: 'Current' });
		headerRow.createEl('th', { text: 'After' });
		headerRow.createEl('th', { text: 'Actions' });

		this.tbody = table.createEl('tbody');

		// Initial render
		this.applyFiltersAndSort();

		// Backup warning
		const warning = contentEl.createDiv({ cls: 'crc-warning-callout' });
		const warningIcon = createLucideIcon('alert-triangle', 16);
		warning.appendChild(warningIcon);
		warning.createSpan({
			text: ' Backup your vault before proceeding. This operation will modify existing notes.'
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-confirmation-buttons' });

		const cancelButton = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn-secondary'
		});
		cancelButton.addEventListener('click', () => this.close());

		const applyButton = buttonContainer.createEl('button', {
			text: `Apply ${this.allChanges.length} change${this.allChanges.length === 1 ? '' : 's'}`,
			cls: 'mod-cta'
		});
		applyButton.addEventListener('click', () => {
			void (async () => {
				// Disable buttons during operation
				applyButton.disabled = true;
				cancelButton.disabled = true;
				applyButton.textContent = 'Applying changes...';

				// Run the operation
				await this.onApply();

				// Close the modal after completion (like BuildPlaceHierarchyModal)
				// This avoids stale cache issues when user reopens the preview
				this.close();
			})();
		});
	}

	/**
	 * Apply filters and sorting, then re-render the table
	 */
	private applyFiltersAndSort(): void {
		// Filter
		this.filteredChanges = this.allChanges.filter(change => {
			// Search filter
			if (this.searchQuery && !change.person.name.toLowerCase().includes(this.searchQuery)) {
				return false;
			}
			// Field filter
			if (this.selectedField !== 'all' && change.field !== this.selectedField) {
				return false;
			}
			return true;
		});

		// Sort by person name
		this.filteredChanges.sort((a, b) => {
			const cmp = a.person.name.localeCompare(b.person.name);
			return this.sortAscending ? cmp : -cmp;
		});

		// Update count
		if (this.countEl) {
			const peopleCount = new Set(this.allChanges.map(c => c.person.name)).size;
			if (this.filteredChanges.length === this.allChanges.length) {
				this.countEl.textContent = `Found ${this.allChanges.length} placeholder ${this.allChanges.length === 1 ? 'value' : 'values'} across ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}:`;
			} else {
				this.countEl.textContent = `Showing ${this.filteredChanges.length} of ${this.allChanges.length} placeholder values:`;
			}
		}

		// Re-render table
		this.renderTable();
	}

	/**
	 * Render the filtered/sorted changes to the table body
	 */
	private renderTable(): void {
		if (!this.tbody) return;

		this.tbody.empty();

		for (const change of this.filteredChanges) {
			const row = this.tbody.createEl('tr');
			row.createEl('td', { text: change.person.name });
			row.createEl('td', { text: change.field });
			row.createEl('td', { text: change.oldValue, cls: 'crc-batch-old-value' });
			row.createEl('td', { text: change.newValue, cls: 'crc-batch-new-value' });

			// Action buttons
			const actionCell = row.createEl('td', { cls: 'crc-batch-actions crc-batch-actions--inline' });

			// Open in new tab button
			const openTabBtn = actionCell.createEl('button', {
				cls: 'crc-batch-action-btn clickable-icon',
				attr: { 'aria-label': 'Open note in new tab' }
			});
			const fileIcon = createLucideIcon('file-text', 14);
			openTabBtn.appendChild(fileIcon);
			openTabBtn.addEventListener('click', () => {
				void this.app.workspace.getLeaf('tab').openFile(change.file);
			});

			// Open in new window button
			const openWindowBtn = actionCell.createEl('button', {
				cls: 'crc-batch-action-btn clickable-icon',
				attr: { 'aria-label': 'Open note in new window' }
			});
			const windowIcon = createLucideIcon('external-link', 14);
			openWindowBtn.appendChild(windowIcon);
			openWindowBtn.addEventListener('click', () => {
				void this.app.workspace.getLeaf('window').openFile(change.file);
			});
		}

		if (this.filteredChanges.length === 0 && this.allChanges.length > 0) {
			const row = this.tbody.createEl('tr');
			const cell = row.createEl('td', {
				text: 'No matches found',
				cls: 'crc-text-muted'
			});
			cell.setAttribute('colspan', '5');
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for previewing name formatting normalization
 */
class NameNormalizationPreviewModal extends Modal {
	// All changes for this operation
	private allChanges: Array<{ person: { name: string }; field: string; oldValue: string; newValue: string; file: TFile }>;
	// Filtered/sorted changes for display
	private filteredChanges: Array<{ person: { name: string }; field: string; oldValue: string; newValue: string; file: TFile }> = [];
	private onApply: () => Promise<void>;

	// Filter state
	private searchQuery = '';
	private sortAscending = true;

	// UI elements
	private tbody: HTMLTableSectionElement | null = null;
	private countEl: HTMLElement | null = null;

	constructor(
		app: App,
		changes: Array<{ person: { name: string }; field: string; oldValue: string; newValue: string; file: TFile }>,
		onApply: () => Promise<void>
	) {
		super(app);
		this.allChanges = changes;
		this.onApply = onApply;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;

		// Add modal class for sizing
		this.modalEl.addClass('crc-batch-preview-modal');

		titleEl.setText('Preview: Normalize name formatting');

		// Description
		const description = contentEl.createDiv({ cls: 'crc-batch-description' });
		description.createEl('p', {
			text: 'This operation standardizes name capitalization and handles surname prefixes:'
		});
		const useCases = description.createEl('ul');
		useCases.createEl('li', { text: 'ALL CAPS names: "JOHN SMITH" → "John Smith"' });
		useCases.createEl('li', { text: 'Lowercase names: "john doe" → "John Doe"' });
		useCases.createEl('li', { text: 'Mac/Mc prefixes: "macdonald" → "MacDonald", "mccarthy" → "McCarthy"' });
		useCases.createEl('li', { text: "O' prefix: \"o'brien\" → \"O'Brien\"" });
		useCases.createEl('li', { text: 'Dutch/German prefixes: "Vincent Van Gogh" → "Vincent van Gogh"' });
		useCases.createEl('li', { text: 'Multiple spaces collapsed to single space' });

		// Count display
		this.countEl = contentEl.createEl('p', { cls: 'crc-batch-count' });

		// Controls row: search + sort
		const controlsRow = contentEl.createDiv({ cls: 'crc-batch-controls' });

		// Search input
		const searchContainer = controlsRow.createDiv({ cls: 'crc-batch-search' });
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search by name...',
			cls: 'crc-batch-search-input'
		});
		searchInput.addEventListener('input', () => {
			this.searchQuery = searchInput.value.toLowerCase();
			this.applyFiltersAndSort();
		});

		// Sort toggle
		const sortContainer = controlsRow.createDiv({ cls: 'crc-batch-sort' });
		const sortBtn = sortContainer.createEl('button', {
			text: 'A→Z',
			cls: 'crc-batch-sort-btn'
		});
		sortBtn.addEventListener('click', () => {
			this.sortAscending = !this.sortAscending;
			sortBtn.textContent = this.sortAscending ? 'A→Z' : 'Z→A';
			this.applyFiltersAndSort();
		});

		// Scrollable table container
		const tableContainer = contentEl.createDiv({ cls: 'crc-batch-table-container' });
		const table = tableContainer.createEl('table', { cls: 'crc-batch-preview-table' });

		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Person' });
		headerRow.createEl('th', { text: 'Current name' });
		headerRow.createEl('th', { text: 'Normalized name' });
		headerRow.createEl('th', { text: 'Actions' });

		this.tbody = table.createEl('tbody');

		// Initial render
		this.applyFiltersAndSort();

		// Backup warning
		const warning = contentEl.createDiv({ cls: 'crc-warning-callout' });
		const warningIcon = createLucideIcon('alert-triangle', 16);
		warning.appendChild(warningIcon);
		warning.createSpan({
			text: ' Backup your vault before proceeding. This operation will modify existing notes.'
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-confirmation-buttons' });

		const cancelButton = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn-secondary'
		});
		cancelButton.addEventListener('click', () => this.close());

		const applyButton = buttonContainer.createEl('button', {
			text: `Apply ${this.allChanges.length} change${this.allChanges.length === 1 ? '' : 's'}`,
			cls: 'mod-cta'
		});
		applyButton.addEventListener('click', () => {
			void (async () => {
				// Disable buttons during operation
				applyButton.disabled = true;
				cancelButton.disabled = true;
				applyButton.textContent = 'Applying changes...';

				// Run the operation
				await this.onApply();

				// Close the modal after completion (like BuildPlaceHierarchyModal)
				// This avoids stale cache issues when user reopens the preview
				this.close();
			})();
		});
	}

	/**
	 * Apply filters and sorting, then re-render the table
	 */
	private applyFiltersAndSort(): void {
		// Filter
		this.filteredChanges = this.allChanges.filter(change => {
			// Search filter
			if (this.searchQuery && !change.person.name.toLowerCase().includes(this.searchQuery)) {
				return false;
			}
			return true;
		});

		// Sort by person name
		this.filteredChanges.sort((a, b) => {
			const cmp = a.person.name.localeCompare(b.person.name);
			return this.sortAscending ? cmp : -cmp;
		});

		// Update count
		if (this.countEl) {
			const peopleCount = new Set(this.allChanges.map(c => c.person.name)).size;
			if (this.filteredChanges.length === this.allChanges.length) {
				this.countEl.textContent = `Found ${this.allChanges.length} ${this.allChanges.length === 1 ? 'name' : 'names'} to normalize across ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}:`;
			} else {
				this.countEl.textContent = `Showing ${this.filteredChanges.length} of ${this.allChanges.length} names:`;
			}
		}

		// Re-render table
		this.renderTable();
	}

	/**
	 * Render the filtered/sorted changes to the table body
	 */
	private renderTable(): void {
		if (!this.tbody) return;

		this.tbody.empty();

		for (const change of this.filteredChanges) {
			const row = this.tbody.createEl('tr');
			row.createEl('td', { text: change.person.name });
			row.createEl('td', { text: change.oldValue, cls: 'crc-batch-old-value' });
			row.createEl('td', { text: change.newValue, cls: 'crc-batch-new-value' });

			// Action buttons
			const actionCell = row.createEl('td', { cls: 'crc-batch-actions crc-batch-actions--inline' });

			// Open in new tab button
			const openTabBtn = actionCell.createEl('button', {
				cls: 'crc-batch-action-btn clickable-icon',
				attr: { 'aria-label': 'Open note in new tab' }
			});
			const fileIcon = createLucideIcon('file-text', 14);
			openTabBtn.appendChild(fileIcon);
			openTabBtn.addEventListener('click', () => {
				void this.app.workspace.getLeaf('tab').openFile(change.file);
			});

			// Open in new window button
			const openWindowBtn = actionCell.createEl('button', {
				cls: 'crc-batch-action-btn clickable-icon',
				attr: { 'aria-label': 'Open note in new window' }
			});
			const windowIcon = createLucideIcon('external-link', 14);
			openWindowBtn.appendChild(windowIcon);
			openWindowBtn.addEventListener('click', () => {
				void this.app.workspace.getLeaf('window').openFile(change.file);
			});
		}

		if (this.filteredChanges.length === 0 && this.allChanges.length > 0) {
			const row = this.tbody.createEl('tr');
			const cell = row.createEl('td', {
				text: 'No matches found',
				cls: 'crc-text-muted'
			});
			cell.setAttribute('colspan', '4');
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for previewing orphaned cr_id reference removal
 */
class OrphanedRefsPreviewModal extends Modal {
	private allChanges: Array<{ person: { name: string; file: TFile }; field: string; orphanedId: string }>;
	private filteredChanges: Array<{ person: { name: string; file: TFile }; field: string; orphanedId: string }> = [];
	private onApply: () => Promise<void>;

	// Filter state
	private searchQuery = '';
	private selectedField = 'all';
	private sortAscending = true;

	// UI elements
	private tbody: HTMLTableSectionElement | null = null;
	private countEl: HTMLElement | null = null;

	constructor(
		app: App,
		changes: Array<{ person: { name: string; file: TFile }; field: string; orphanedId: string }>,
		onApply: () => Promise<void>
	) {
		super(app);
		this.allChanges = changes;
		this.filteredChanges = [...changes];
		this.onApply = onApply;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;

		this.modalEl.addClass('crc-batch-preview-modal');
		titleEl.setText('Preview: Remove orphaned cr_id references');

		// Description with use cases
		const description = contentEl.createDiv({ cls: 'crc-batch-description' });
		description.createEl('p', {
			text: 'This operation removes broken relationship references (cr_id values) that point to deleted or non-existent person notes:'
		});
		const useCases = description.createEl('ul');
		useCases.createEl('li', { text: 'father_id, mother_id: Parent references' });
		useCases.createEl('li', { text: 'spouse_id, partners_id: Spouse/partner references' });
		useCases.createEl('li', { text: 'children_id: Child references' });
		description.createEl('p', {
			text: 'Note: Only the _id fields are cleaned. Wikilink references (father, mother, spouse, children) are left unchanged.',
			cls: 'crc-text--muted'
		});

		// Search input
		const searchContainer = contentEl.createDiv({ cls: 'crc-filter-container' });
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search by person name or orphaned ID...',
			cls: 'crc-search-input'
		});
		searchInput.addEventListener('input', (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
			this.applyFiltersAndSort();
		});

		// Field filter dropdown
		const filterContainer = contentEl.createDiv({ cls: 'crc-filter-container' });
		filterContainer.createSpan({ text: 'Filter by field: ', cls: 'crc-filter-label' });
		const fieldSelect = filterContainer.createEl('select', { cls: 'dropdown' });

		const fields = ['all', 'father_id', 'mother_id', 'spouse_id', 'partners_id', 'children_id'];
		fields.forEach(field => {
			const option = fieldSelect.createEl('option', {
				value: field,
				text: field === 'all' ? 'All fields' : field
			});
			if (field === this.selectedField) {
				option.selected = true;
			}
		});

		fieldSelect.addEventListener('change', (e) => {
			this.selectedField = (e.target as HTMLSelectElement).value;
			this.applyFiltersAndSort();
		});

		// Sort toggle
		const sortContainer = contentEl.createDiv({ cls: 'crc-filter-container' });
		const sortButton = sortContainer.createEl('button', {
			text: `Sort: ${this.sortAscending ? 'A-Z' : 'Z-A'}`,
			cls: 'crc-btn-secondary'
		});
		sortButton.addEventListener('click', () => {
			this.sortAscending = !this.sortAscending;
			sortButton.textContent = `Sort: ${this.sortAscending ? 'A-Z' : 'Z-A'}`;
			this.applyFiltersAndSort();
		});

		// Count display
		this.countEl = contentEl.createDiv({ cls: 'crc-batch-count' });

		// Table
		const tableContainer = contentEl.createDiv({ cls: 'crc-table-container' });
		const table = tableContainer.createEl('table', { cls: 'crc-batch-table' });

		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Person' });
		headerRow.createEl('th', { text: 'Field' });
		headerRow.createEl('th', { text: 'Orphaned ID' });
		headerRow.createEl('th', { text: 'Actions' });

		this.tbody = table.createEl('tbody');

		// Initial render
		this.applyFiltersAndSort();

		// Backup warning
		const warning = contentEl.createDiv({ cls: 'crc-warning-callout' });
		const warningIcon = createLucideIcon('alert-triangle', 16);
		warning.appendChild(warningIcon);
		warning.createSpan({
			text: ' Backup your vault before proceeding. This operation will modify existing notes.'
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-confirmation-buttons' });

		const cancelButton = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn-secondary'
		});
		cancelButton.addEventListener('click', () => this.close());

		const applyButton = buttonContainer.createEl('button', {
			text: `Apply ${this.allChanges.length} change${this.allChanges.length === 1 ? '' : 's'}`,
			cls: 'mod-cta'
		});
		applyButton.addEventListener('click', () => {
			void (async () => {
				// Disable buttons during operation
				applyButton.disabled = true;
				cancelButton.disabled = true;
				applyButton.textContent = 'Applying changes...';

				// Run the operation
				await this.onApply();

				// Close the modal after completion (like BuildPlaceHierarchyModal)
				// This avoids stale cache issues when user reopens the preview
				this.close();
			})();
		});
	}

	private applyFiltersAndSort(): void {
		// Filter
		this.filteredChanges = this.allChanges.filter(change => {
			// Search filter
			if (this.searchQuery) {
				const matchesSearch =
					change.person.name.toLowerCase().includes(this.searchQuery) ||
					change.orphanedId.toLowerCase().includes(this.searchQuery);
				if (!matchesSearch) return false;
			}

			// Field filter
			if (this.selectedField !== 'all' && change.field !== this.selectedField) {
				return false;
			}

			return true;
		});

		// Sort
		this.filteredChanges.sort((a, b) => {
			const comparison = a.person.name.localeCompare(b.person.name);
			return this.sortAscending ? comparison : -comparison;
		});

		// Render
		this.renderTable();
	}

	private renderTable(): void {
		if (!this.tbody || !this.countEl) return;

		// Update count
		this.countEl.textContent = `Showing ${this.filteredChanges.length} of ${this.allChanges.length} orphaned reference${this.allChanges.length === 1 ? '' : 's'}`;

		// Clear table
		this.tbody.empty();

		// Render rows
		for (const change of this.filteredChanges) {
			const row = this.tbody.createEl('tr');
			row.createEl('td', { text: change.person.name });
			row.createEl('td', { text: change.field, cls: 'crc-field-name' });
			row.createEl('td', { text: change.orphanedId, cls: 'crc-monospace' });

			// Action buttons
			const actionCell = row.createEl('td', { cls: 'crc-batch-actions crc-batch-actions--inline' });

			// Open in tab button
			const openTabBtn = actionCell.createEl('button', {
				cls: 'crc-batch-action-btn clickable-icon',
				attr: { 'aria-label': 'Open note in tab' }
			});
			const fileIcon = createLucideIcon('file-text', 14);
			openTabBtn.appendChild(fileIcon);
			openTabBtn.addEventListener('click', () => {
				void this.app.workspace.getLeaf().openFile(change.person.file);
			});

			// Open in new window button
			const openWindowBtn = actionCell.createEl('button', {
				cls: 'crc-batch-action-btn clickable-icon',
				attr: { 'aria-label': 'Open note in new window' }
			});
			const windowIcon = createLucideIcon('external-link', 14);
			openWindowBtn.appendChild(windowIcon);
			openWindowBtn.addEventListener('click', () => {
				void this.app.workspace.getLeaf('window').openFile(change.person.file);
			});
		}

		// Empty state
		if (this.filteredChanges.length === 0) {
			const row = this.tbody.createEl('tr');
			const cell = row.createEl('td', {
				text: this.searchQuery || this.selectedField !== 'all'
					? 'No orphaned references match your filters'
					: 'No orphaned references found',
				cls: 'crc-text--muted'
			});
			cell.colSpan = 4;
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for previewing bidirectional relationship inconsistencies
 */
class BidirectionalInconsistencyPreviewModal extends Modal {
	private allChanges: Array<{
		person: { name: string; file: TFile };
		relatedPerson: { name: string; file: TFile };
		type: string;
		description: string;
	}>;
	private filteredChanges: Array<{
		person: { name: string; file: TFile };
		relatedPerson: { name: string; file: TFile };
		type: string;
		description: string;
	}> = [];
	private onApply: () => Promise<void>;

	// Filter state
	private searchQuery = '';
	private selectedType = 'all';
	private sortAscending = true;

	// UI elements
	private tbody: HTMLTableSectionElement | null = null;
	private countEl: HTMLElement | null = null;

	constructor(
		app: App,
		changes: Array<{
			person: { name: string; file: TFile };
			relatedPerson: { name: string; file: TFile };
			type: string;
			description: string;
		}>,
		onApply: () => Promise<void>
	) {
		super(app);
		this.allChanges = changes;
		this.onApply = onApply;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;

		// Add modal class for sizing
		this.modalEl.addClass('crc-batch-preview-modal');

		titleEl.setText('Preview: Fix bidirectional relationship inconsistencies');

		// Description
		const description = contentEl.createDiv({ cls: 'crc-batch-description' });
		description.createEl('p', {
			text: 'This operation fixes one-way relationships by adding the missing reciprocal links:'
		});
		const useCases = description.createEl('ul');
		useCases.createEl('li', { text: 'Parent lists child, but child doesn\'t list parent' });
		useCases.createEl('li', { text: 'Child lists parent, but parent doesn\'t list child' });
		useCases.createEl('li', { text: 'Person A lists Person B as spouse, but B doesn\'t list A' });

		// Count display
		this.countEl = contentEl.createEl('p', { cls: 'crc-batch-count' });

		// Controls row: search + filter + sort
		const controlsRow = contentEl.createDiv({ cls: 'crc-batch-controls' });

		// Search input
		const searchContainer = controlsRow.createDiv({ cls: 'crc-batch-search' });
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search by name...',
			cls: 'crc-batch-search-input'
		});
		searchInput.addEventListener('input', () => {
			this.searchQuery = searchInput.value.toLowerCase();
			this.applyFiltersAndSort();
		});

		// Type filter dropdown
		const uniqueTypes = [...new Set(this.allChanges.map(c => c.type))];
		if (uniqueTypes.length > 1) {
			const filterContainer = controlsRow.createDiv({ cls: 'crc-batch-filter' });
			const filterSelect = filterContainer.createEl('select', { cls: 'crc-batch-filter-select' });
			filterSelect.createEl('option', { text: 'All types', value: 'all' });
			for (const type of uniqueTypes.sort()) {
				const displayText = type
					.replace('missing-child-in-parent', 'Missing child in parent')
					.replace('missing-parent-in-child', 'Missing parent in child')
					.replace('missing-spouse-in-spouse', 'Missing spouse link');
				filterSelect.createEl('option', { text: displayText, value: type });
			}
			filterSelect.addEventListener('change', () => {
				this.selectedType = filterSelect.value;
				this.applyFiltersAndSort();
			});
		}

		// Sort toggle
		const sortContainer = controlsRow.createDiv({ cls: 'crc-batch-sort' });
		const sortBtn = sortContainer.createEl('button', {
			text: 'A→Z',
			cls: 'crc-batch-sort-btn'
		});
		sortBtn.addEventListener('click', () => {
			this.sortAscending = !this.sortAscending;
			sortBtn.textContent = this.sortAscending ? 'A→Z' : 'Z→A';
			this.applyFiltersAndSort();
		});

		// Scrollable table container
		const tableContainer = contentEl.createDiv({ cls: 'crc-batch-table-container' });
		const table = tableContainer.createEl('table', { cls: 'crc-batch-preview-table' });

		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Person' });
		headerRow.createEl('th', { text: 'Related person' });
		headerRow.createEl('th', { text: 'Issue' });
		headerRow.createEl('th', { text: 'Actions' });

		this.tbody = table.createEl('tbody');

		// Initial render
		this.applyFiltersAndSort();

		// Backup warning
		const warning = contentEl.createDiv({ cls: 'crc-warning-callout' });
		const warningIcon = createLucideIcon('alert-triangle', 16);
		warning.appendChild(warningIcon);
		warning.createSpan({
			text: ' Backup your vault before proceeding. This operation will add missing relationship links to notes.'
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-confirmation-buttons' });

		const cancelButton = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn-secondary'
		});
		cancelButton.addEventListener('click', () => this.close());

		const applyButton = buttonContainer.createEl('button', {
			text: `Fix ${this.allChanges.length} inconsistenc${this.allChanges.length === 1 ? 'y' : 'ies'}`,
			cls: 'mod-cta'
		});
		applyButton.addEventListener('click', () => {
			void (async () => {
				// Disable buttons during operation
				applyButton.disabled = true;
				cancelButton.disabled = true;
				applyButton.textContent = 'Fixing inconsistencies...';

				// Run the operation
				await this.onApply();

				// Close modal after completion
				this.close();
			})();
		});
	}

	/**
	 * Apply filters and sorting, then re-render the table
	 */
	private applyFiltersAndSort(): void {
		// Filter
		this.filteredChanges = this.allChanges.filter(change => {
			// Search filter
			if (this.searchQuery) {
				const personMatch = change.person.name.toLowerCase().includes(this.searchQuery);
				const relatedMatch = change.relatedPerson.name.toLowerCase().includes(this.searchQuery);
				if (!personMatch && !relatedMatch) {
					return false;
				}
			}
			// Type filter
			if (this.selectedType !== 'all' && change.type !== this.selectedType) {
				return false;
			}
			return true;
		});

		// Sort by person name
		this.filteredChanges.sort((a, b) => {
			const cmp = a.person.name.localeCompare(b.person.name);
			return this.sortAscending ? cmp : -cmp;
		});

		// Update count
		if (this.countEl) {
			const peopleCount = new Set(this.allChanges.map(c => c.person.name)).size;
			if (this.filteredChanges.length === this.allChanges.length) {
				this.countEl.textContent = `Found ${this.allChanges.length} inconsistenc${this.allChanges.length === 1 ? 'y' : 'ies'} across ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}:`;
			} else {
				this.countEl.textContent = `Showing ${this.filteredChanges.length} of ${this.allChanges.length} inconsistencies:`;
			}
		}

		// Re-render table
		this.renderTable();
	}

	/**
	 * Render the filtered/sorted changes to the table body
	 */
	private renderTable(): void {
		if (!this.tbody) return;

		this.tbody.empty();

		for (const change of this.filteredChanges) {
			const row = this.tbody.createEl('tr');
			row.createEl('td', { text: change.person.name });
			row.createEl('td', { text: change.relatedPerson.name });
			row.createEl('td', { text: change.description });

			// Action buttons cell
			const actionCell = row.createEl('td', { cls: 'crc-batch-actions crc-batch-actions--inline' });

			// Open person in tab
			const openPersonTabBtn = actionCell.createEl('button', {
				cls: 'crc-batch-action-btn clickable-icon',
				attr: { 'aria-label': `Open ${change.person.name} in tab` }
			});
			const fileIcon1 = createLucideIcon('file-text', 14);
			openPersonTabBtn.appendChild(fileIcon1);
			openPersonTabBtn.addEventListener('click', () => {
				void this.app.workspace.getLeaf().openFile(change.person.file);
			});

			// Open person in new window
			const openPersonWindowBtn = actionCell.createEl('button', {
				cls: 'crc-batch-action-btn clickable-icon',
				attr: { 'aria-label': `Open ${change.person.name} in new window` }
			});
			const windowIcon1 = createLucideIcon('external-link', 14);
			openPersonWindowBtn.appendChild(windowIcon1);
			openPersonWindowBtn.addEventListener('click', () => {
				void this.app.workspace.getLeaf('window').openFile(change.person.file);
			});

			// Separator
			actionCell.createSpan({ text: ' ', cls: 'crc-batch-actions-separator' });

			// Open related person in tab
			const openRelatedTabBtn = actionCell.createEl('button', {
				cls: 'crc-batch-action-btn clickable-icon',
				attr: { 'aria-label': `Open ${change.relatedPerson.name} in tab` }
			});
			const fileIcon2 = createLucideIcon('file-text', 14);
			openRelatedTabBtn.appendChild(fileIcon2);
			openRelatedTabBtn.addEventListener('click', () => {
				void this.app.workspace.getLeaf().openFile(change.relatedPerson.file);
			});

			// Open related person in new window
			const openRelatedWindowBtn = actionCell.createEl('button', {
				cls: 'crc-batch-action-btn clickable-icon',
				attr: { 'aria-label': `Open ${change.relatedPerson.name} in new window` }
			});
			const windowIcon2 = createLucideIcon('external-link', 14);
			openRelatedWindowBtn.appendChild(windowIcon2);
			openRelatedWindowBtn.addEventListener('click', () => {
				void this.app.workspace.getLeaf('window').openFile(change.relatedPerson.file);
			});
		}

		if (this.filteredChanges.length === 0 && this.allChanges.length > 0) {
			const row = this.tbody.createEl('tr');
			const cell = row.createEl('td', {
				text: 'No matches found',
				cls: 'crc-text-muted'
			});
			cell.setAttribute('colspan', '4');
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for previewing impossible date issues
 */
class ImpossibleDatesPreviewModal extends Modal {
	private allChanges: Array<{
		person: { name: string; file: TFile };
		relatedPerson?: { name: string; file: TFile };
		type: string;
		description: string;
	}>;
	private filteredChanges: Array<{
		person: { name: string; file: TFile };
		relatedPerson?: { name: string; file: TFile };
		type: string;
		description: string;
	}> = [];

	// Filter state
	private searchQuery = '';
	private selectedType = 'all';
	private sortAscending = true;

	// UI elements
	private tbody: HTMLTableSectionElement | null = null;
	private countEl: HTMLElement | null = null;

	constructor(
		app: App,
		changes: Array<{
			person: { name: string; file: TFile };
			relatedPerson?: { name: string; file: TFile };
			type: string;
			description: string;
		}>
	) {
		super(app);
		this.allChanges = changes;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;

		// Add modal class for sizing
		this.modalEl.addClass('crc-batch-preview-modal');

		titleEl.setText('Preview: Impossible date issues');

		// Description
		const description = contentEl.createDiv({ cls: 'crc-batch-description' });
		description.createEl('p', {
			text: 'This preview shows logical date errors that need manual review and correction:'
		});
		const useCases = description.createEl('ul');
		useCases.createEl('li', { text: 'Birth after death or death before birth' });
		useCases.createEl('li', { text: 'Unrealistic lifespans (>120 years)' });
		useCases.createEl('li', { text: 'Parents born after children or children born after parent death' });
		useCases.createEl('li', { text: 'Parents too young at child\'s birth (<10 years)' });

		const warningNote = contentEl.createDiv({ cls: 'crc-warning-callout' });
		const warningIcon = createLucideIcon('alert-triangle', 16);
		warningNote.appendChild(warningIcon);
		warningNote.createSpan({
			text: ' This is a preview-only tool. Review the issues and manually correct the dates in the affected notes.'
		});

		// Count display
		this.countEl = contentEl.createEl('p', { cls: 'crc-batch-count' });

		// Controls row: search + filter + sort
		const controlsRow = contentEl.createDiv({ cls: 'crc-batch-controls' });

		// Search input
		const searchContainer = controlsRow.createDiv({ cls: 'crc-batch-search' });
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search by name...',
			cls: 'crc-batch-search-input'
		});
		searchInput.addEventListener('input', () => {
			this.searchQuery = searchInput.value.toLowerCase();
			this.applyFiltersAndSort();
		});

		// Type filter dropdown
		const uniqueTypes = [...new Set(this.allChanges.map(c => c.type))];
		if (uniqueTypes.length > 1) {
			const filterContainer = controlsRow.createDiv({ cls: 'crc-batch-filter' });
			const filterSelect = filterContainer.createEl('select', { cls: 'crc-batch-filter-select' });
			filterSelect.createEl('option', { text: 'All types', value: 'all' });
			for (const type of uniqueTypes.sort()) {
				const displayText = type
					.replace('birth-after-death', 'Birth after death')
					.replace('unrealistic-lifespan', 'Unrealistic lifespan')
					.replace('parent-born-after-child', 'Parent born after child')
					.replace('parent-died-before-child', 'Parent died before child')
					.replace('parent-too-young', 'Parent too young')
					.replace('child-born-after-parent-death', 'Child born after parent death');
				filterSelect.createEl('option', { text: displayText, value: type });
			}
			filterSelect.addEventListener('change', () => {
				this.selectedType = filterSelect.value;
				this.applyFiltersAndSort();
			});
		}

		// Sort toggle
		const sortContainer = controlsRow.createDiv({ cls: 'crc-batch-sort' });
		const sortBtn = sortContainer.createEl('button', {
			text: 'A→Z',
			cls: 'crc-batch-sort-btn'
		});
		sortBtn.addEventListener('click', () => {
			this.sortAscending = !this.sortAscending;
			sortBtn.textContent = this.sortAscending ? 'A→Z' : 'Z→A';
			this.applyFiltersAndSort();
		});

		// Scrollable table container
		const tableContainer = contentEl.createDiv({ cls: 'crc-batch-table-container' });
		const table = tableContainer.createEl('table', { cls: 'crc-batch-preview-table' });

		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Person' });
		headerRow.createEl('th', { text: 'Related person' });
		headerRow.createEl('th', { text: 'Issue' });
		headerRow.createEl('th', { text: 'Actions' });

		this.tbody = table.createEl('tbody');

		// Initial render
		this.applyFiltersAndSort();

		// Close button
		const buttonContainer = contentEl.createDiv({ cls: 'crc-confirmation-buttons' });
		const closeButton = buttonContainer.createEl('button', {
			text: 'Close',
			cls: 'mod-cta'
		});
		closeButton.addEventListener('click', () => this.close());
	}

	/**
	 * Apply filters and sorting, then re-render the table
	 */
	private applyFiltersAndSort(): void {
		// Filter
		this.filteredChanges = this.allChanges.filter(change => {
			// Search filter
			if (this.searchQuery) {
				const personMatch = change.person.name.toLowerCase().includes(this.searchQuery);
				const relatedMatch = change.relatedPerson?.name.toLowerCase().includes(this.searchQuery);
				if (!personMatch && !relatedMatch) {
					return false;
				}
			}
			// Type filter
			if (this.selectedType !== 'all' && change.type !== this.selectedType) {
				return false;
			}
			return true;
		});

		// Sort by person name
		this.filteredChanges.sort((a, b) => {
			const cmp = a.person.name.localeCompare(b.person.name);
			return this.sortAscending ? cmp : -cmp;
		});

		// Update count
		if (this.countEl) {
			const peopleCount = new Set(this.allChanges.map(c => c.person.name)).size;
			if (this.filteredChanges.length === this.allChanges.length) {
				this.countEl.textContent = `Found ${this.allChanges.length} issue${this.allChanges.length === 1 ? '' : 's'} across ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}:`;
			} else {
				this.countEl.textContent = `Showing ${this.filteredChanges.length} of ${this.allChanges.length} issues:`;
			}
		}

		// Re-render table
		this.renderTable();
	}

	/**
	 * Render the filtered/sorted changes to the table body
	 */
	private renderTable(): void {
		if (!this.tbody) return;

		this.tbody.empty();

		for (const change of this.filteredChanges) {
			const row = this.tbody.createEl('tr');
			row.createEl('td', { text: change.person.name });
			row.createEl('td', { text: change.relatedPerson?.name || '—' });
			row.createEl('td', { text: change.description });

			// Action buttons cell
			const actionCell = row.createEl('td', { cls: 'crc-batch-actions crc-batch-actions--inline' });

			// Open person in tab
			const openPersonTabBtn = actionCell.createEl('button', {
				cls: 'crc-batch-action-btn clickable-icon',
				attr: { 'aria-label': `Open ${change.person.name} in tab` }
			});
			const fileIcon1 = createLucideIcon('file-text', 14);
			openPersonTabBtn.appendChild(fileIcon1);
			openPersonTabBtn.addEventListener('click', () => {
				void this.app.workspace.getLeaf().openFile(change.person.file);
			});

			// Open person in new window
			const openPersonWindowBtn = actionCell.createEl('button', {
				cls: 'crc-batch-action-btn clickable-icon',
				attr: { 'aria-label': `Open ${change.person.name} in new window` }
			});
			const windowIcon1 = createLucideIcon('external-link', 14);
			openPersonWindowBtn.appendChild(windowIcon1);
			openPersonWindowBtn.addEventListener('click', () => {
				void this.app.workspace.getLeaf('window').openFile(change.person.file);
			});

			// If there's a related person, add buttons for them too
			if (change.relatedPerson) {
				// Separator
				actionCell.createSpan({ text: ' ', cls: 'crc-batch-actions-separator' });

				// Open related person in tab
				const openRelatedTabBtn = actionCell.createEl('button', {
					cls: 'crc-batch-action-btn clickable-icon',
					attr: { 'aria-label': `Open ${change.relatedPerson.name} in tab` }
				});
				const fileIcon2 = createLucideIcon('file-text', 14);
				openRelatedTabBtn.appendChild(fileIcon2);
				openRelatedTabBtn.addEventListener('click', () => {
					void this.app.workspace.getLeaf().openFile(change.relatedPerson!.file);
				});

				// Open related person in new window
				const openRelatedWindowBtn = actionCell.createEl('button', {
					cls: 'crc-batch-action-btn clickable-icon',
					attr: { 'aria-label': `Open ${change.relatedPerson.name} in new window` }
				});
				const windowIcon2 = createLucideIcon('external-link', 14);
				openRelatedWindowBtn.appendChild(windowIcon2);
				openRelatedWindowBtn.addEventListener('click', () => {
					void this.app.workspace.getLeaf('window').openFile(change.relatedPerson!.file);
				});
			}
		}

		if (this.filteredChanges.length === 0 && this.allChanges.length > 0) {
			const row = this.tbody.createEl('tr');
			const cell = row.createEl('td', {
				text: 'No matches found',
				cls: 'crc-text-muted'
			});
			cell.setAttribute('colspan', '4');
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for previewing batch operation changes
 */
class BatchPreviewModal extends Modal {
	private operation: 'dates' | 'sex' | 'orphans' | 'legacy_type';
	private preview: NormalizationPreview;
	private onApply: () => Promise<void>;
	private sexNormalizationDisabled: boolean;

	// All changes for this operation
	private allChanges: Array<{ person: { name: string }; field: string; oldValue: string; newValue: string }> = [];
	// Filtered/sorted changes for display
	private filteredChanges: Array<{ person: { name: string }; field: string; oldValue: string; newValue: string }> = [];

	// Filter state
	private searchQuery = '';
	private selectedField = 'all';
	private sortAscending = true;

	// UI elements
	private tbody: HTMLTableSectionElement | null = null;
	private countEl: HTMLElement | null = null;

	constructor(
		app: App,
		operation: 'dates' | 'sex' | 'orphans' | 'legacy_type',
		preview: NormalizationPreview,
		onApply: () => Promise<void>,
		sexNormalizationDisabled = false
	) {
		super(app);
		this.operation = operation;
		this.preview = preview;
		this.onApply = onApply;
		this.sexNormalizationDisabled = sexNormalizationDisabled;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;

		// Add modal class for sizing
		this.modalEl.addClass('crc-batch-preview-modal');

		// Set title based on operation
		const titles: Record<string, string> = {
			dates: 'Preview: Date normalization',
			sex: 'Preview: Sex normalization',
			orphans: 'Preview: Clear orphan references',
			legacy_type: 'Preview: Migrate legacy type property',
		};
		titleEl.setText(titles[this.operation]);

		// Add operation-specific descriptions
		if (this.operation === 'sex') {
			contentEl.createEl('p', {
				text: 'Genealogical records use biological sex (M/F) rather than gender identity, as historical documents and DNA analysis require this distinction.',
				cls: 'crc-text-muted crc-text-small'
			});

			// Show disabled mode warning
			if (this.sexNormalizationDisabled) {
				const disabledWarning = contentEl.createDiv({ cls: 'crc-info-callout' });
				const infoIcon = createLucideIcon('info', 16);
				disabledWarning.appendChild(infoIcon);
				disabledWarning.createSpan({
					text: ' Sex normalization is disabled. The preview below shows what would be changed, but no changes will be applied. Change this in Preferences → Sex value normalization.'
				});
			}
		}

		// Get changes for this operation
		switch (this.operation) {
			case 'dates':
				this.allChanges = [...this.preview.dateNormalization];
				break;
			case 'sex':
				this.allChanges = [...this.preview.genderNormalization];
				break;
			case 'orphans':
				this.allChanges = [...this.preview.orphanClearing];
				break;
			case 'legacy_type':
				this.allChanges = [...this.preview.legacyTypeMigration];
				break;
		}

		if (this.allChanges.length === 0) {
			contentEl.createEl('p', {
				text: 'No changes needed. All values are already in the correct format.',
				cls: 'crc-text-muted'
			});
		} else {
			// Count display
			this.countEl = contentEl.createEl('p', { cls: 'crc-batch-count' });

			// Controls row: search + filter + sort
			const controlsRow = contentEl.createDiv({ cls: 'crc-batch-controls' });

			// Search input
			const searchContainer = controlsRow.createDiv({ cls: 'crc-batch-search' });
			const searchInput = searchContainer.createEl('input', {
				type: 'text',
				placeholder: 'Search by name...',
				cls: 'crc-batch-search-input'
			});
			searchInput.addEventListener('input', () => {
				this.searchQuery = searchInput.value.toLowerCase();
				this.applyFiltersAndSort();
			});

			// Field filter dropdown (only show if multiple fields)
			const uniqueFields = [...new Set(this.allChanges.map(c => c.field))];
			if (uniqueFields.length > 1) {
				const filterContainer = controlsRow.createDiv({ cls: 'crc-batch-filter' });
				const filterSelect = filterContainer.createEl('select', { cls: 'crc-batch-filter-select' });
				filterSelect.createEl('option', { text: 'All fields', value: 'all' });
				for (const field of uniqueFields.sort()) {
					filterSelect.createEl('option', { text: field, value: field });
				}
				filterSelect.addEventListener('change', () => {
					this.selectedField = filterSelect.value;
					this.applyFiltersAndSort();
				});
			}

			// Sort toggle
			const sortContainer = controlsRow.createDiv({ cls: 'crc-batch-sort' });
			const sortBtn = sortContainer.createEl('button', {
				text: 'A→Z',
				cls: 'crc-batch-sort-btn'
			});
			sortBtn.addEventListener('click', () => {
				this.sortAscending = !this.sortAscending;
				sortBtn.textContent = this.sortAscending ? 'A→Z' : 'Z→A';
				this.applyFiltersAndSort();
			});

			// Scrollable table container
			const tableContainer = contentEl.createDiv({ cls: 'crc-batch-table-container' });
			const table = tableContainer.createEl('table', { cls: 'crc-batch-preview-table' });
			const thead = table.createEl('thead');
			const headerRow = thead.createEl('tr');
			headerRow.createEl('th', { text: 'Person' });
			headerRow.createEl('th', { text: 'Field' });
			headerRow.createEl('th', { text: 'Current' });
			headerRow.createEl('th', { text: 'New' });

			this.tbody = table.createEl('tbody');

			// Initial render
			this.applyFiltersAndSort();
		}

		// Show skipped notes for sex operation (schema-aware mode)
		if (this.operation === 'sex' && this.preview.genderSkipped.length > 0) {
			const skippedSection = contentEl.createDiv({ cls: 'crc-batch-skipped-section' });
			const skippedHeader = skippedSection.createDiv({ cls: 'crc-batch-skipped-header' });
			const infoIcon = createLucideIcon('info', 16);
			skippedHeader.appendChild(infoIcon);
			skippedHeader.createSpan({
				text: ` ${this.preview.genderSkipped.length} note${this.preview.genderSkipped.length === 1 ? '' : 's'} skipped (schema override)`
			});

			// Collapsible details
			const detailsContainer = skippedSection.createEl('details', { cls: 'crc-batch-skipped-details' });
			detailsContainer.createEl('summary', { text: 'Show skipped notes' });

			const skippedList = detailsContainer.createEl('ul', { cls: 'crc-batch-skipped-list' });
			for (const skipped of this.preview.genderSkipped) {
				const item = skippedList.createEl('li');
				item.createSpan({ text: skipped.person.name, cls: 'crc-batch-skipped-name' });
				item.createSpan({
					text: ` (${skipped.currentValue}) — schema: ${skipped.schemaName}`,
					cls: 'crc-text-muted'
				});
			}
		}

		// Backup warning (don't show if normalization is disabled for this operation)
		if (this.allChanges.length > 0 && !this.sexNormalizationDisabled) {
			const warning = contentEl.createDiv({ cls: 'crc-warning-callout' });
			const warningIcon = createLucideIcon('alert-triangle', 16);
			warning.appendChild(warningIcon);
			warning.createSpan({
				text: ' Backup your vault before proceeding. This operation will modify existing notes.'
			});
		}

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-confirmation-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: this.sexNormalizationDisabled ? 'Close' : 'Cancel',
			cls: 'crc-btn-secondary'
		});
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		// Don't show Apply button if sex normalization is disabled
		if (this.sexNormalizationDisabled) {
			// No Apply button when disabled - user already sees the info callout
			return;
		}

		// Count actual changes (excluding unrecognized entries that won't be modified)
		const actualChanges = this.allChanges.filter(c => !c.newValue.includes('(unrecognized'));
		if (actualChanges.length > 0) {
			const applyBtn = buttonContainer.createEl('button', {
				text: `Apply ${actualChanges.length} change${actualChanges.length === 1 ? '' : 's'}`,
				cls: 'mod-cta'
			});
			applyBtn.addEventListener('click', () => {
				void (async () => {
					// Disable buttons during operation
					applyBtn.disabled = true;
					cancelBtn.disabled = true;
					applyBtn.textContent = 'Applying changes...';

					// Run the operation
					await this.onApply();

					// Show completion and enable close
					applyBtn.textContent = '✓ Changes applied';
					applyBtn.addClass('crc-btn-success');
					cancelBtn.textContent = 'Close';
					cancelBtn.disabled = false;

					// Update count to show completion
					if (this.countEl) {
						this.countEl.textContent = `✓ Successfully applied ${actualChanges.length} change${actualChanges.length === 1 ? '' : 's'}`;
					}
				})();
			});
		} else if (this.allChanges.length > 0) {
			// Only unrecognized values, no actual changes to apply
			contentEl.createEl('p', {
				text: 'No normalizable values found. The listed values are unrecognized and will not be changed.',
				cls: 'crc-text-muted'
			});
		}
	}

	/**
	 * Apply filters and sorting, then re-render the table
	 */
	private applyFiltersAndSort(): void {
		// Filter
		this.filteredChanges = this.allChanges.filter(change => {
			// Search filter
			if (this.searchQuery && !change.person.name.toLowerCase().includes(this.searchQuery)) {
				return false;
			}
			// Field filter
			if (this.selectedField !== 'all' && change.field !== this.selectedField) {
				return false;
			}
			return true;
		});

		// Sort by person name
		this.filteredChanges.sort((a, b) => {
			const cmp = a.person.name.localeCompare(b.person.name);
			return this.sortAscending ? cmp : -cmp;
		});

		// Update count
		if (this.countEl) {
			if (this.filteredChanges.length === this.allChanges.length) {
				this.countEl.textContent = `${this.allChanges.length} change${this.allChanges.length === 1 ? '' : 's'} will be made:`;
			} else {
				this.countEl.textContent = `Showing ${this.filteredChanges.length} of ${this.allChanges.length} changes:`;
			}
		}

		// Re-render table
		this.renderTable();
	}

	/**
	 * Render the filtered/sorted changes to the table body
	 */
	private renderTable(): void {
		if (!this.tbody) return;

		this.tbody.empty();

		for (const change of this.filteredChanges) {
			const isUnrecognized = change.newValue.includes('(unrecognized');
			const row = this.tbody.createEl('tr');
			if (isUnrecognized) {
				row.addClass('crc-batch-unrecognized-row');
			}
			row.createEl('td', { text: change.person.name });
			row.createEl('td', { text: change.field });
			row.createEl('td', {
				text: change.oldValue,
				cls: isUnrecognized ? 'crc-batch-unrecognized-value' : 'crc-batch-old-value'
			});
			row.createEl('td', {
				text: change.newValue,
				cls: isUnrecognized ? 'crc-text-muted' : 'crc-batch-new-value'
			});
		}

		if (this.filteredChanges.length === 0 && this.allChanges.length > 0) {
			const row = this.tbody.createEl('tr');
			const cell = row.createEl('td', {
				text: 'No matches found',
				cls: 'crc-text-muted crc-text--center'
			});
			cell.setAttribute('colspan', '4');
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/**
 * Simple confirmation modal for destructive actions
 */
class ConfirmationModal extends Modal {
	private title: string;
	private message: string;
	private onResult: (confirmed: boolean) => void;

	constructor(app: App, title: string, message: string, onResult: (confirmed: boolean) => void) {
		super(app);
		this.title = title;
		this.message = message;
		this.onResult = onResult;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText(this.title);

		contentEl.createEl('p', { text: this.message });

		const buttonContainer = contentEl.createDiv({ cls: 'crc-confirmation-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn-secondary'
		});
		cancelBtn.addEventListener('click', () => {
			this.onResult(false);
			this.close();
		});

		const confirmBtn = buttonContainer.createEl('button', {
			text: 'Continue',
			cls: 'mod-warning'
		});
		confirmBtn.addEventListener('click', () => {
			this.onResult(true);
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/**
 * Modal for reviewing cross-import duplicate matches
 */
class CrossImportReviewModal extends Modal {
	private matches: CrossImportMatch[];
	private crossImportService: CrossImportDetectionService;
	private currentIndex: number = 0;
	private plugin: CanvasRootsPlugin;

	constructor(
		app: App,
		plugin: CanvasRootsPlugin,
		matches: CrossImportMatch[],
		crossImportService: CrossImportDetectionService
	) {
		super(app);
		this.plugin = plugin;
		this.matches = matches;
		this.crossImportService = crossImportService;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText('Review potential matches');
		contentEl.addClass('cr-cross-import-modal');

		this.renderCurrentMatch();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderCurrentMatch(): void {
		const { contentEl } = this;
		contentEl.empty();

		if (this.currentIndex >= this.matches.length) {
			this.renderComplete();
			return;
		}

		const match = this.matches[this.currentIndex];
		const pendingCount = this.matches.filter(m => m.resolution === 'pending').length;

		// Progress indicator
		const progressEl = contentEl.createDiv({ cls: 'cr-cross-import-progress' });
		progressEl.createEl('span', {
			text: `Match ${this.currentIndex + 1} of ${this.matches.length}`,
			cls: 'cr-cross-import-progress__count'
		});
		progressEl.createEl('span', {
			text: `${pendingCount} pending`,
			cls: 'cr-cross-import-progress__pending'
		});

		// Confidence badge
		const confidenceClass = match.confidence >= 80 ? 'cr-badge--danger' :
			match.confidence >= 60 ? 'cr-badge--warning' : 'cr-badge--info';

		const headerEl = contentEl.createDiv({ cls: 'cr-cross-import-header' });
		headerEl.createSpan({
			text: `${match.confidence}% confidence`,
			cls: `cr-badge ${confidenceClass}`
		});

		// Side-by-side comparison
		const comparisonEl = contentEl.createDiv({ cls: 'cr-cross-import-comparison' });

		// Staging person (left)
		const stagingEl = comparisonEl.createDiv({ cls: 'cr-cross-import-person cr-cross-import-person--staging' });
		stagingEl.createEl('div', { text: 'STAGING', cls: 'cr-cross-import-person__label' });
		this.renderPersonDetails(stagingEl, match.stagingPerson);

		// VS separator
		comparisonEl.createDiv({ text: 'vs', cls: 'cr-cross-import-vs' });

		// Main tree person (right)
		const mainEl = comparisonEl.createDiv({ cls: 'cr-cross-import-person cr-cross-import-person--main' });
		mainEl.createEl('div', { text: 'MAIN TREE', cls: 'cr-cross-import-person__label' });
		this.renderPersonDetails(mainEl, match.mainPerson);

		// Match reasons
		if (match.reasons.length > 0) {
			const reasonsEl = contentEl.createDiv({ cls: 'cr-cross-import-reasons' });
			reasonsEl.createEl('strong', { text: 'Match reasons:' });
			reasonsEl.createEl('span', {
				text: match.reasons.join(' • '),
				cls: 'crc-text-muted'
			});
		}

		// Action buttons
		const actionsEl = contentEl.createDiv({ cls: 'cr-cross-import-actions' });

		const mergeBtn = actionsEl.createEl('button', {
			text: 'Merge records',
			cls: 'mod-cta'
		});
		mergeBtn.addEventListener('click', () => {
			this.openMergeWizard(match);
		});

		const sameBtn = actionsEl.createEl('button', {
			text: 'Same (skip promote)',
			cls: 'crc-btn-secondary'
		});
		sameBtn.addEventListener('click', () => {
			this.resolveMatch(match, 'same');
		});

		const differentBtn = actionsEl.createEl('button', {
			text: 'Different people',
			cls: 'crc-btn-secondary'
		});
		differentBtn.addEventListener('click', () => {
			this.resolveMatch(match, 'different');
		});

		const skipBtn = actionsEl.createEl('button', {
			text: 'Skip',
			cls: 'crc-btn-link'
		});
		skipBtn.addEventListener('click', () => {
			this.nextMatch();
		});

		// Navigation
		const navEl = contentEl.createDiv({ cls: 'cr-cross-import-nav' });

		const prevBtn = navEl.createEl('button', {
			text: '← Previous',
			cls: 'crc-btn-link'
		});
		prevBtn.disabled = this.currentIndex === 0;
		prevBtn.addEventListener('click', () => {
			if (this.currentIndex > 0) {
				this.currentIndex--;
				this.renderCurrentMatch();
			}
		});

		const finishBtn = navEl.createEl('button', {
			text: 'Finish review',
			cls: 'crc-btn-secondary'
		});
		finishBtn.addEventListener('click', () => {
			this.close();
		});
	}

	private renderPersonDetails(container: HTMLElement, person: { name?: string; birthDate?: string; deathDate?: string; sex?: string }): void {
		container.createEl('strong', { text: person.name || 'Unknown' });

		const detailsEl = container.createDiv({ cls: 'cr-cross-import-person__details' });

		if (person.birthDate) {
			detailsEl.createEl('div', { text: `Born: ${person.birthDate}` });
		}
		if (person.deathDate) {
			detailsEl.createEl('div', { text: `Died: ${person.deathDate}` });
		}
		if (person.sex) {
			detailsEl.createEl('div', { text: `Gender: ${person.sex}` });
		}
	}

	private openMergeWizard(match: CrossImportMatch): void {
		const stagingFile = match.stagingPerson.file;
		const mainFile = match.mainPerson.file;

		if (!stagingFile || !mainFile) {
			new Notice('Cannot merge: missing file reference');
			return;
		}

		const mergeModal = new MergeWizardModal(
			this.app,
			this.plugin.settings,
			stagingFile,
			mainFile,
			() => {
				// After successful merge, remove this match from the list
				this.matches = this.matches.filter(m => m !== match);
				if (this.currentIndex >= this.matches.length) {
					this.currentIndex = Math.max(0, this.matches.length - 1);
				}
				this.renderCurrentMatch();
			}
		);
		mergeModal.open();
	}

	private resolveMatch(match: CrossImportMatch, resolution: 'same' | 'different'): void {
		// Store the resolution
		this.crossImportService.setResolution(
			match.stagingPerson.crId || '',
			match.mainPerson.crId || '',
			resolution
		);

		// Update the match object
		match.resolution = resolution;

		// Move to next
		this.nextMatch();

		// Show feedback
		new Notice(resolution === 'same'
			? 'Marked as same person (will skip on promote)'
			: 'Marked as different people (will promote normally)'
		);
	}

	private nextMatch(): void {
		this.currentIndex++;
		this.renderCurrentMatch();
	}

	private renderComplete(): void {
		const { contentEl } = this;
		contentEl.empty();

		const completeEl = contentEl.createDiv({ cls: 'cr-cross-import-complete' });
		completeEl.createEl('h3', { text: 'Review complete' });

		const sameCount = this.matches.filter(m => m.resolution === 'same').length;
		const differentCount = this.matches.filter(m => m.resolution === 'different').length;
		const pendingCount = this.matches.filter(m => m.resolution === 'pending').length;

		const summaryEl = completeEl.createDiv({ cls: 'cr-cross-import-summary' });
		summaryEl.createEl('p', { text: `Same person: ${sameCount}` });
		summaryEl.createEl('p', { text: `Different people: ${differentCount}` });
		if (pendingCount > 0) {
			summaryEl.createEl('p', { text: `Pending: ${pendingCount}`, cls: 'crc-text-muted' });
		}

		const closeBtn = completeEl.createEl('button', {
			text: 'Close',
			cls: 'mod-cta'
		});
		closeBtn.addEventListener('click', () => {
			this.close();
		});
	}
}

/**
 * Modal for previewing date validation issues
 */
class DateValidationPreviewModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private allIssues: Array<{
		file: TFile;
		name: string;
		field: string;
		value: string;
		issue: string;
	}>;
	private filteredIssues: Array<{
		file: TFile;
		name: string;
		field: string;
		value: string;
		issue: string;
	}> = [];

	// Filter state
	private searchQuery = '';
	private selectedField = 'all';
	private sortAscending = true;

	// UI elements
	private tbody: HTMLTableSectionElement | null = null;
	private countEl: HTMLElement | null = null;

	constructor(
		app: App,
		plugin: CanvasRootsPlugin,
		issues: Array<{
			file: TFile;
			name: string;
			field: string;
			value: string;
			issue: string;
		}>
	) {
		super(app);
		this.plugin = plugin;
		this.allIssues = issues;
		this.filteredIssues = [...issues];
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;

		this.modalEl.addClass('crc-batch-preview-modal');
		titleEl.setText('Preview: Date format validation issues');

		// Summary
		const summaryEl = contentEl.createDiv({ cls: 'crc-batch-summary' });
		summaryEl.createEl('p', {
			text: `Found ${this.allIssues.length} date${this.allIssues.length === 1 ? '' : 's'} with format issues.`,
			cls: 'crc-batch-summary-text'
		});
		this.countEl = summaryEl.createEl('p', {
			text: `Showing ${this.filteredIssues.length} of ${this.allIssues.length}`,
			cls: 'crc-batch-summary-count'
		});

		// Search and filter controls
		const controlsEl = contentEl.createDiv({ cls: 'crc-batch-controls' });

		// Search input
		const searchContainer = controlsEl.createDiv({ cls: 'crc-batch-control' });
		searchContainer.createEl('label', { text: 'Search:', cls: 'crc-batch-label' });
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Filter by person name...',
			cls: 'crc-batch-search'
		});
		searchInput.addEventListener('input', () => {
			this.searchQuery = searchInput.value.toLowerCase();
			this.applyFiltersAndRender();
		});

		// Field filter dropdown
		const fieldContainer = controlsEl.createDiv({ cls: 'crc-batch-control' });
		fieldContainer.createEl('label', { text: 'Field:', cls: 'crc-batch-label' });
		const fieldSelect = fieldContainer.createEl('select', { cls: 'crc-batch-select' });

		const fieldOptions = [
			{ value: 'all', label: 'All fields' },
			{ value: 'born', label: 'Birth dates' },
			{ value: 'birth_date', label: 'Birth dates (birth_date)' },
			{ value: 'died', label: 'Death dates' },
			{ value: 'death_date', label: 'Death dates (death_date)' }
		];

		for (const opt of fieldOptions) {
			fieldSelect.createEl('option', {
				value: opt.value,
				text: opt.label
			});
		}

		fieldSelect.addEventListener('change', () => {
			this.selectedField = fieldSelect.value;
			this.applyFiltersAndRender();
		});

		// Sort toggle
		const sortContainer = controlsEl.createDiv({ cls: 'crc-batch-control' });
		sortContainer.createEl('label', { text: 'Sort:', cls: 'crc-batch-label' });
		const sortBtn = sortContainer.createEl('button', {
			text: this.sortAscending ? 'A → Z' : 'Z → A',
			cls: 'crc-batch-sort-btn'
		});
		sortBtn.addEventListener('click', () => {
			this.sortAscending = !this.sortAscending;
			sortBtn.setText(this.sortAscending ? 'A → Z' : 'Z → A');
			this.applyFiltersAndRender();
		});

		// Table
		const tableContainer = contentEl.createDiv({ cls: 'crc-batch-table-container' });
		const table = tableContainer.createEl('table', { cls: 'crc-batch-table' });

		// Table header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Person' });
		headerRow.createEl('th', { text: 'Field' });
		headerRow.createEl('th', { text: 'Current value' });
		headerRow.createEl('th', { text: 'Issue' });
		headerRow.createEl('th', { text: 'Action' });

		// Table body
		this.tbody = table.createEl('tbody');

		// Render initial data
		this.renderTable();

		// Info box
		const infoEl = contentEl.createDiv({ cls: 'crc-batch-info' });
		const infoIcon = infoEl.createEl('span', { cls: 'crc-batch-info-icon' });
		setIcon(infoIcon, 'info');
		infoEl.createEl('span', {
			text: 'Date validation is preview-only. Click "Open note" to manually correct each date. Configure validation rules in Control Center > Preferences > Date validation.'
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-batch-buttons' });

		const closeBtn = buttonContainer.createEl('button', {
			text: 'Close',
			cls: 'mod-cta'
		});
		closeBtn.addEventListener('click', () => {
			this.close();
		});
	}

	private applyFiltersAndRender(): void {
		// Apply search filter
		let filtered = this.allIssues.filter(issue =>
			issue.name.toLowerCase().includes(this.searchQuery)
		);

		// Apply field filter
		if (this.selectedField !== 'all') {
			filtered = filtered.filter(issue => issue.field === this.selectedField);
		}

		// Apply sort
		filtered.sort((a, b) => {
			const aName = a.name.toLowerCase();
			const bName = b.name.toLowerCase();
			return this.sortAscending
				? aName.localeCompare(bName)
				: bName.localeCompare(aName);
		});

		this.filteredIssues = filtered;

		// Update count
		if (this.countEl) {
			this.countEl.setText(`Showing ${this.filteredIssues.length} of ${this.allIssues.length}`);
		}

		// Re-render table
		this.renderTable();
	}

	private renderTable(): void {
		if (!this.tbody) return;

		this.tbody.empty();

		for (const issue of this.filteredIssues) {
			const row = this.tbody.createEl('tr');

			// Person name
			row.createEl('td', { text: issue.name });

			// Field
			row.createEl('td', { text: issue.field });

			// Current value
			row.createEl('td', {
				text: issue.value,
				cls: 'crc-batch-value'
			});

			// Issue
			row.createEl('td', {
				text: issue.issue,
				cls: 'crc-batch-issue'
			});

			// Action: Open note button
			const actionCell = row.createEl('td');
			const openBtn = actionCell.createEl('button', {
				text: 'Open note',
				cls: 'crc-batch-action-btn'
			});
			openBtn.addEventListener('click', () => {
				void this.app.workspace.getLeaf().openFile(issue.file);
			});
		}

		// Show empty state if no results
		if (this.filteredIssues.length === 0) {
			const emptyRow = this.tbody.createEl('tr');
			const emptyCell = emptyRow.createEl('td', {
				attr: { colspan: '5' },
				cls: 'crc-batch-empty'
			});
			emptyCell.createEl('p', {
				text: 'No issues match the current filters'
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
