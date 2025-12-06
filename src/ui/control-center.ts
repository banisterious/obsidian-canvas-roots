import { App, Menu, MenuItem, Modal, Notice, Setting, TFile, TFolder, setIcon, ToggleComponent } from 'obsidian';
import CanvasRootsPlugin from '../../main';
import { TAB_CONFIGS, createLucideIcon, setLucideIcon, LucideIconName } from './lucide-icons';
import { createPersonNote, PersonData } from '../core/person-note-writer';
import { PersonPickerModal, PersonInfo, PlaceInfo, extractPlaceInfo } from './person-picker';
import { VaultStatsService, FullVaultStats } from '../core/vault-stats';
import { FamilyGraphService, TreeOptions } from '../core/family-graph';
import { CanvasGenerator, CanvasData, CanvasGenerationOptions } from '../core/canvas-generator';
import { getLogger } from '../core/logging';
import { getErrorMessage } from '../core/error-utils';
import { GedcomImporter } from '../gedcom/gedcom-importer';
import { GedcomXImporter, GedcomXImportResult } from '../gedcomx/gedcomx-importer';
import { GedcomXParser } from '../gedcomx/gedcomx-parser';
import { GrampsImporter, GrampsImportResult } from '../gramps/gramps-importer';
import { GrampsParser } from '../gramps/gramps-parser';
import { GedcomImportResultsModal } from './gedcom-import-results-modal';
import { BidirectionalLinker } from '../core/bidirectional-linker';
import { TreePreviewRenderer } from './tree-preview';
import { ReferenceNumberingService, NumberingSystem } from '../core/reference-numbering';
import type { RecentTreeInfo, RecentImportInfo, ArrowStyle, ColorScheme, SpouseEdgeLabelFormat } from '../settings';
import { FolderFilterService } from '../core/folder-filter';
import { StagingService, StagingSubfolderInfo } from '../core/staging-service';
import { CrossImportDetectionService, CrossImportMatch } from '../core/cross-import-detection';
import { MergeWizardModal } from './merge-wizard-modal';
import { DataQualityService, DataQualityReport, DataQualityIssue, IssueSeverity, IssueCategory, NormalizationPreview, BatchOperationResult } from '../core/data-quality';
import { PlaceGraphService } from '../core/place-graph';
import { PlaceCategory, PlaceIssue } from '../models/place';
import { CreatePlaceModal } from './create-place-modal';
import { CreateMissingPlacesModal } from './create-missing-places-modal';
import { BuildPlaceHierarchyModal } from './build-place-hierarchy-modal';
import { StandardizePlacesModal, findPlaceNameVariations } from './standardize-places-modal';
import { MigrationDiagramModal } from './migration-diagram-modal';
import { PlaceNetworkModal } from './place-network-modal';
import { TemplateSnippetsModal } from './template-snippets-modal';
import { CreatePersonModal } from './create-person-modal';
import { CreateMapModal } from './create-map-modal';
import { CreateSchemaModal } from './create-schema-modal';
import { SchemaService, ValidationService } from '../schemas';
import type { SchemaNote, ValidationResult, ValidationSummary } from '../schemas';
import { RelationshipService, RELATIONSHIP_CATEGORY_NAMES } from '../relationships';
import type { RelationshipCategory } from '../relationships';
import { renderEventsTab } from '../dates';
import { renderOrganizationsTab } from '../organizations';
import { renderPreferencesTab } from './preferences-tab';
import { PropertyAliasService } from '../core/property-alias-service';
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
	return String(value);
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
	private activeTab: string = 'status';
	private drawer: HTMLElement;
	private contentContainer: HTMLElement;
	private appBar: HTMLElement;

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

	constructor(app: App, plugin: CanvasRootsPlugin) {
		super(app);
		this.plugin = plugin;
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
	 * Create navigation drawer with tab list
	 */
	private createNavigationDrawer(container: HTMLElement): void {
		this.drawer = container.createDiv({ cls: 'crc-drawer' });

		// Drawer header
		const header = this.drawer.createDiv({ cls: 'crc-drawer__header' });
		const headerTitle = header.createDiv({ cls: 'crc-drawer__title' });
		headerTitle.textContent = 'Navigation';

		// Drawer content
		const content = this.drawer.createDiv({ cls: 'crc-drawer__content' });
		this.createNavigationList(content);
	}

	/**
	 * Create navigation list with all tabs
	 */
	private createNavigationList(container: HTMLElement): void {
		const list = container.createEl('ul', { cls: 'crc-nav-list' });

		TAB_CONFIGS.forEach((tabConfig) => {
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

		// Update active tab and show content
		this.activeTab = tabId;
		this.showTab(tabId);
	}

	/**
	 * Show content for the specified tab
	 */
	private showTab(tabId: string): void {
		this.contentContainer.empty();

		switch (tabId) {
			case 'status':
				void this.showStatusTab();
				break;
			case 'guide':
				this.showGuideTab();
				break;
			case 'quick-settings':
				this.showCanvasSettingsTab();
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

					let file: TFile;
					const existingFile = this.app.vault.getAbstractFileByPath(fileName);
					if (existingFile instanceof TFile) {
						await this.app.vault.modify(existingFile, canvasContent);
						file = existingFile;
					} else {
						file = await this.app.vault.create(fileName, canvasContent);
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
	 * Show Status tab
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

		// Collect statistics
		const statsService = new VaultStatsService(this.app);
		const folderFilter = this.plugin.getFolderFilter();
		if (folderFilter) {
			statsService.setFolderFilter(folderFilter);
		}
		const stats = statsService.collectStats();

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

		this.createStatRow(mapsContent, 'Total custom maps', stats.maps.totalMaps);

		if (stats.maps.universes.length > 0) {
			const universesRow = mapsContent.createDiv({ cls: 'crc-stat-row crc-mt-2' });
			universesRow.createDiv({ cls: 'crc-stat-label', text: 'Universes' });
			universesRow.createDiv({
				cls: 'crc-stat-value crc-text-muted',
				text: stats.maps.universes.join(', ')
			});
		}

		container.appendChild(mapsCard);

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
		fill.style.width = `${percentage}%`;

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
			text: 'Canvas Roots generates family trees on the Obsidian Canvas from your markdown notes. Get started in three steps:',
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

		const wikiLink = welcomeContent.createEl('a', {
			text: 'Read the full Getting Started guide →',
			href: `${WIKI_BASE}/Getting-Started`,
			cls: 'crc-link crc-mt-3 cr-inline-block'
		});
		wikiLink.setAttr('target', '_blank');

		container.appendChild(welcomeCard);

		// =========================================================================
		// Card 2: Essential Properties (Collapsible)
		// =========================================================================
		const propsCard = this.createCard({
			title: 'Essential properties',
			icon: 'file-text',
			subtitle: 'YAML frontmatter fields for person, place, source, and map notes'
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
				{ name: 'type', desc: 'Must be "place"', req: true },
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
				{ name: 'type', desc: 'Must be "map"', req: true },
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
				{ name: 'type', desc: 'Must be "source"', req: true },
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
				{ name: 'type', desc: 'Must be "schema"', req: true },
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

		const schemaLink = propsContent.createEl('a', {
			text: 'Full frontmatter reference →',
			href: `${WIKI_BASE}/Frontmatter-Reference`,
			cls: 'crc-link crc-mt-3 cr-inline-block'
		});
		schemaLink.setAttr('target', '_blank');

		container.appendChild(propsCard);

		// =========================================================================
		// Card 3: Key Concepts
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
				title: 'Schema validation',
				desc: 'Define validation rules to ensure data consistency. Require properties, validate types, and create custom constraints.',
				wiki: 'Schema-Validation'
			},
			{
				title: 'Layout algorithms',
				desc: 'Choose Standard, Compact, Timeline, or Hourglass layouts depending on your tree size and visualization needs.',
				wiki: 'Tree-Generation#layout-algorithms'
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
		// Card 4: Common Tasks (Navigation Grid)
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
		// Card 5: Learn More
		// =========================================================================
		const learnCard = this.createCard({
			title: 'Learn more',
			icon: 'book-open',
			subtitle: 'Documentation, templates, and tips'
		});
		const learnContent = learnCard.querySelector('.crc-card__content') as HTMLElement;

		// Wiki links section
		const wikiSection = learnContent.createDiv({ cls: 'crc-mb-4' });
		wikiSection.createEl('h4', { text: 'Documentation', cls: 'crc-mb-2' });
		const wikiLinks = [
			{ text: 'Getting started', wiki: 'Getting-Started' },
			{ text: 'Data entry guide', wiki: 'Data-Entry' },
			{ text: 'Tree generation', wiki: 'Tree-Generation' },
			{ text: 'Geographic features', wiki: 'Geographic-Features' },
			{ text: 'Context menus', wiki: 'Context-Menus' }
		];
		const wikiList = wikiSection.createEl('ul', { cls: 'crc-wiki-links' });
		wikiLinks.forEach(link => {
			const li = wikiList.createEl('li');
			const a = li.createEl('a', { text: link.text, href: `${WIKI_BASE}/${link.wiki}`, cls: 'crc-link' });
			a.setAttr('target', '_blank');
		});

		// Templater button
		const templaterSection = learnContent.createDiv({ cls: 'crc-mb-4' });
		templaterSection.createEl('h4', { text: 'Templates', cls: 'crc-mb-2' });
		templaterSection.createEl('p', {
			text: 'Ready-to-use Templater snippets for person and place notes.',
			cls: 'crc-text-muted crc-mb-2'
		});
		const templaterBtn = templaterSection.createEl('button', {
			text: 'View Templater snippets',
			cls: 'crc-btn crc-btn--secondary'
		});
		templaterBtn.addEventListener('click', () => {
			new TemplateSnippetsModal(this.app).open();
		});

		// Pro tips
		const tipsSection = learnContent.createDiv();
		tipsSection.createEl('h4', { text: 'Pro tips', cls: 'crc-mb-2' });
		const tips = [
			'Use Obsidian Bases for efficient bulk data entry',
			'Use "Regenerate canvas" after changing layout settings',
			'Per-canvas styles override global settings'
		];
		const tipsList = tipsSection.createEl('ul', { cls: 'crc-text-muted' });
		tips.forEach(tip => tipsList.createEl('li', { text: tip }));

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
	 * Show Canvas Settings tab
	 */
	private showCanvasSettingsTab(): void {
		const container = this.contentContainer;

		// Title
		container.createEl('h2', { text: 'Canvas settings', cls: 'cr-card-title--no-margin' });

		// Intro text with re-layout feature note
		const intro = container.createEl('p', {
			cls: 'crc-text-muted crc-mb-3'
		});
		intro.appendText('Adjust canvas layout and arrow styling. Changes apply immediately to new tree generations. ');
		intro.createEl('strong', { text: 'To apply to existing canvases:' });
		intro.appendText(' right-click the canvas file and select "Re-layout family tree".');

		// Layout Settings Section
		container.createEl('h3', { text: 'Layout settings', cls: 'crc-section-heading' });

		// Horizontal Spacing
		new Setting(container)
			.setName('Horizontal spacing')
			.setDesc('Space between nodes horizontally (pixels)')
			.addText(text => text
				.setPlaceholder('400')
				.setValue(String(this.plugin.settings.horizontalSpacing))
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue >= 100 && numValue <= 1000) {
						this.plugin.settings.horizontalSpacing = numValue;
						await this.plugin.saveSettings();
					}
				}));

		// Vertical Spacing
		new Setting(container)
			.setName('Vertical spacing')
			.setDesc('Space between generations vertically (pixels)')
			.addText(text => text
				.setPlaceholder('250')
				.setValue(String(this.plugin.settings.verticalSpacing))
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue >= 100 && numValue <= 1000) {
						this.plugin.settings.verticalSpacing = numValue;
						await this.plugin.saveSettings();
					}
				}));

		// Node Width
		new Setting(container)
			.setName('Node width')
			.setDesc('Width of person nodes (pixels)')
			.addText(text => text
				.setPlaceholder('200')
				.setValue(String(this.plugin.settings.defaultNodeWidth))
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue >= 100 && numValue <= 500) {
						this.plugin.settings.defaultNodeWidth = numValue;
						await this.plugin.saveSettings();
					}
				}));

		// Node Height
		new Setting(container)
			.setName('Node height')
			.setDesc('Height of person nodes (pixels)')
			.addText(text => text
				.setPlaceholder('100')
				.setValue(String(this.plugin.settings.defaultNodeHeight))
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue >= 50 && numValue <= 300) {
						this.plugin.settings.defaultNodeHeight = numValue;
						await this.plugin.saveSettings();
					}
				}));

		// Arrow Styling Card
		const arrowCard = this.createCard({
			title: 'Arrow styling',
			icon: 'link'
		});

		const arrowContent = arrowCard.querySelector('.crc-card__content') as HTMLElement;

		// Parent-Child Arrow Style
		new Setting(arrowContent)
			.setName('Parent → child arrows')
			.setDesc('Arrow style for parent-child relationships')
			.addDropdown(dropdown => dropdown
				.addOption('directed', 'Directed (→) - single arrow pointing to child')
				.addOption('bidirectional', 'Bidirectional (↔) - arrows on both ends')
				.addOption('undirected', 'Undirected (—) - no arrows')
				.setValue(this.plugin.settings.parentChildArrowStyle)
				.onChange(async (value) => {
					this.plugin.settings.parentChildArrowStyle = value as ArrowStyle;
					await this.plugin.saveSettings();
					new Notice('Parent-child arrow style updated');
				}));

		// Spouse Arrow Style
		new Setting(arrowContent)
			.setName('Spouse arrows')
			.setDesc('Arrow style for spouse relationships')
			.addDropdown(dropdown => dropdown
				.addOption('directed', 'Directed (→) - single arrow')
				.addOption('bidirectional', 'Bidirectional (↔) - arrows on both ends')
				.addOption('undirected', 'Undirected (—) - no arrows')
				.setValue(this.plugin.settings.spouseArrowStyle)
				.onChange(async (value) => {
					this.plugin.settings.spouseArrowStyle = value as ArrowStyle;
					await this.plugin.saveSettings();
					new Notice('Spouse arrow style updated');
				}));

		container.appendChild(arrowCard);

		// Node Color Scheme Card
		const colorCard = this.createCard({
			title: 'Node coloring',
			icon: 'layout'
		});

		const colorContent = colorCard.querySelector('.crc-card__content') as HTMLElement;

		// Color Scheme Dropdown
		new Setting(colorContent)
			.setName('Color scheme')
			.setDesc('How to color person nodes in family trees')
			.addDropdown(dropdown => dropdown
				.addOption('gender', 'Gender - green for males, purple for females')
				.addOption('generation', 'Generation - color by generation level')
				.addOption('collection', 'Collection - different color per collection')
				.addOption('monochrome', 'Monochrome - no coloring')
				.setValue(this.plugin.settings.nodeColorScheme)
				.onChange(async (value) => {
					this.plugin.settings.nodeColorScheme = value as ColorScheme;
					await this.plugin.saveSettings();
					new Notice('Node color scheme updated');
				}));

		container.appendChild(colorCard);

		// Spouse Edge Display Card
		const spouseEdgeCard = this.createCard({
			title: 'Spouse edge display',
			icon: 'link'
		});

		const spouseEdgeContent = spouseEdgeCard.querySelector('.crc-card__content') as HTMLElement;

		// Show Spouse Edges Toggle
		new Setting(spouseEdgeContent)
			.setName('Show spouse edges')
			.setDesc('Display edges between spouses with marriage metadata. When disabled (default), spouses are visually grouped by positioning only.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showSpouseEdges)
				.onChange(async (value) => {
					this.plugin.settings.showSpouseEdges = value;
					await this.plugin.saveSettings();
					new Notice('Spouse edge display updated');
				}));

		// Spouse Edge Label Format
		new Setting(spouseEdgeContent)
			.setName('Spouse edge label format')
			.setDesc('How to display marriage information on spouse edges (only applies when "Show spouse edges" is enabled)')
			.addDropdown(dropdown => dropdown
				.addOption('none', 'None - no labels')
				.addOption('date-only', 'Date only - e.g., "m. 1985"')
				.addOption('date-location', 'Date and location - e.g., "m. 1985 | Boston, MA"')
				.addOption('full', 'Full details - e.g., "m. 1985 | Boston, MA | div. 1992"')
				.setValue(this.plugin.settings.spouseEdgeLabelFormat)
				.onChange(async (value) => {
					this.plugin.settings.spouseEdgeLabelFormat = value as SpouseEdgeLabelFormat;
					await this.plugin.saveSettings();
					new Notice('Spouse edge label format updated');
				}));

		container.appendChild(spouseEdgeCard);

		// Link to full settings
		const fullSettingsBtn = container.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-btn--block crc-mt-3',
			text: 'Open full settings'
		});
		fullSettingsBtn.addEventListener('click', () => {
			// Close modal and open settings
			this.close();
			// @ts-ignore - Obsidian internal API
			this.app.setting.open();
			// @ts-ignore - Obsidian internal API
			this.app.setting.openTabById('canvas-roots');
		});

		container.createEl('p', {
			cls: 'crc-form-help crc-text-center',
			text: 'Access all plugin settings including data management and logging'
		});
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
					new CreatePersonModal(this.app, {
						directory: this.plugin.settings.peopleFolder || '',
						familyGraph: this.plugin.createFamilyGraphService(),
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
					new TemplateSnippetsModal(this.app).open();
				}));

		container.appendChild(actionsCard);

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

		// Sort by name
		this.personListItems.sort((a, b) => a.name.localeCompare(b.name));

		// Create search/filter input
		const filterContainer = container.createDiv({ cls: 'crc-filter-container crc-mb-3' });
		const filterInput = filterContainer.createEl('input', {
			cls: 'crc-filter-input',
			attr: {
				type: 'text',
				placeholder: `Search ${this.personListItems.length} people...`
			}
		});

		// List container
		const listContainer = container.createDiv({ cls: 'crc-person-list' });

		// Render initial list
		this.renderPersonListItems(listContainer, this.personListItems);

		// Filter handler
		filterInput.addEventListener('input', () => {
			const query = filterInput.value.toLowerCase();
			const filtered = this.personListItems.filter(p =>
				p.name.toLowerCase().includes(query) ||
				(p.birthDate && p.birthDate.includes(query)) ||
				(p.deathDate && p.deathDate.includes(query))
			);
			this.renderPersonListItems(listContainer, filtered);
		});
	}

	/**
	 * Render person list items with expandable place details
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

		// Create alphabetical index
		const byLetter = new Map<string, typeof people>();
		for (const person of people) {
			const letter = person.name.charAt(0).toUpperCase();
			if (!byLetter.has(letter)) {
				byLetter.set(letter, []);
			}
			byLetter.get(letter)!.push(person);
		}

		// Render by letter
		const sortedLetters = Array.from(byLetter.keys()).sort();
		for (const letter of sortedLetters) {
			const letterSection = container.createDiv({ cls: 'crc-person-letter-section' });
			letterSection.createEl('h5', { text: letter, cls: 'crc-person-letter-header' });

			const letterList = letterSection.createDiv({ cls: 'crc-person-letter-list' });
			for (const person of byLetter.get(letter)!) {
				const item = letterList.createDiv({ cls: 'crc-person-list-item' });

				// Main row (name + dates + expand toggle if has unlinked places)
				const mainRow = item.createDiv({ cls: 'crc-person-list-item__main' });

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

				// Name (clickable)
				const nameEl = mainRow.createEl('span', {
					text: person.name,
					cls: 'crc-person-list-name'
				});
				nameEl.addEventListener('click', () => {
					// Open the person's file
					void this.app.workspace.getLeaf(false).openFile(person.file);
				});

				// Dates
				const dates = [];
				if (person.birthDate) dates.push(`b. ${person.birthDate}`);
				if (person.deathDate) dates.push(`d. ${person.deathDate}`);
				if (dates.length > 0) {
					mainRow.createEl('span', {
						text: dates.join(' – '),
						cls: 'crc-person-list-dates crc-text--muted'
					});
				}

				// Unlinked place indicator badge
				if (unlinkedPlaces.length > 0) {
					const badge = mainRow.createEl('span', {
						cls: 'crc-person-list-badge crc-person-list-badge--unlinked',
						attr: {
							title: `${unlinkedPlaces.length} unlinked place${unlinkedPlaces.length !== 1 ? 's' : ''}`
						}
					});
					const mapIcon = createLucideIcon('map-pin', 12);
					badge.appendChild(mapIcon);
					badge.appendText(unlinkedPlaces.length.toString());

					// Create expandable details section
					const detailsSection = item.createDiv({ cls: 'crc-person-list-details crc-person-list-details--hidden' });

					// Toggle on badge click
					badge.addEventListener('click', (e) => {
						e.stopPropagation();
						detailsSection.toggleClass('crc-person-list-details--hidden', !detailsSection.hasClass('crc-person-list-details--hidden'));
						badge.toggleClass('crc-person-list-badge--active', !badge.hasClass('crc-person-list-badge--active'));
					});

					// Render place details with action buttons
					for (const { type, info } of unlinkedPlaces) {
						const placeRow = detailsSection.createDiv({ cls: 'crc-person-list-place' });

						placeRow.createEl('span', {
							text: `${type}: `,
							cls: 'crc-person-list-place__label'
						});
						placeRow.createEl('span', {
							text: info.placeName,
							cls: 'crc-person-list-place__name'
						});

						// Action button to create place note
						const createBtn = placeRow.createEl('button', {
							cls: 'crc-btn crc-btn--small crc-btn--ghost crc-person-list-place__action',
							attr: { title: 'Create place note' }
						});
						const plusIcon = createLucideIcon('plus', 12);
						createBtn.appendChild(plusIcon);
						createBtn.appendText('Create');

						createBtn.addEventListener('click', (e) => {
							e.stopPropagation();
							void this.showQuickCreatePlaceModal(info.placeName);
						});
					}
				}

				// Research coverage badge (only when fact tracking is enabled)
				if (this.plugin.settings.trackFactSourcing) {
					this.renderPersonResearchCoverageBadge(item, mainRow, person.file);
				}
			}
		}
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
		progressFill.style.width = `${coverage.coveragePercent}%`;
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
			new TemplateSnippetsModal(this.app, 'proof').open();
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
	 * Show Tree Output tab
	 */
	private showTreeGenerationTab(): void {
		const container = this.contentContainer;

		// Title
		container.createEl('h2', { text: 'Tree output', cls: 'cr-card-title--no-margin' });

		// Intro text
		container.createEl('p', {
			text: 'Generate visual family trees and export to various formats. Start by selecting a root person and configuring tree options.',
			cls: 'crc-text-muted'
		});

		// Root Person Card
		const rootPersonField: RelationshipField = { name: '' };

		// Check if we have a pending root person to pre-populate
		if (this.pendingRootPerson) {
			rootPersonField.name = this.pendingRootPerson.name;
			rootPersonField.crId = this.pendingRootPerson.crId;
			rootPersonField.birthDate = this.pendingRootPerson.birthDate;
			rootPersonField.deathDate = this.pendingRootPerson.deathDate;
			// Clear pending after using it
			this.pendingRootPerson = undefined;
		}

		this.createRootPersonCard(container, rootPersonField);

		// Configuration Card
		const configCard = container.createDiv({ cls: 'crc-card' });
		const configHeader = configCard.createDiv({ cls: 'crc-card__header' });
		const configTitle = configHeader.createEl('h3', {
			cls: 'crc-card__title',
			text: 'Tree configuration'
		});
		const configIcon = createLucideIcon('settings', 20);
		configTitle.prepend(configIcon);

		const configContent = configCard.createDiv({ cls: 'crc-card__content' });

		// Tree type selection
		let typeSelect: HTMLSelectElement;
		new Setting(configContent)
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
		let genSlider: HTMLInputElement;
		new Setting(configContent)
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
		let spouseToggle: ToggleComponent;
		new Setting(configContent)
			.setName('Include spouses in tree')
			.addToggle(toggle => {
				spouseToggle = toggle;
				toggle.setValue(true);
			});

		// Collection filter dropdown
		let collectionSelect: HTMLSelectElement;
		const graphService = this.plugin.createFamilyGraphService();
		const userCollections = graphService.getUserCollections();

		new Setting(configContent)
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
		let placeFilterInput: HTMLInputElement;
		const placeFilterTypes: Set<'birth' | 'death' | 'marriage' | 'burial'> = new Set(['birth', 'death']);

		new Setting(configContent)
			.setName('Filter by place')
			.setDesc('Limit tree to people associated with a specific place (optional)')
			.addText(text => {
				placeFilterInput = text.inputEl;
				text.setPlaceholder('e.g., London, England');
			});

		// Place filter type checkboxes
		const placeTypesSetting = new Setting(configContent)
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

		// Layout Options Card
		const layoutCard = container.createDiv({ cls: 'crc-card' });
		const layoutHeader = layoutCard.createDiv({ cls: 'crc-card__header' });
		const layoutTitle = layoutHeader.createEl('h3', {
			cls: 'crc-card__title',
			text: 'Layout options'
		});
		const layoutIcon = createLucideIcon('layout', 20);
		layoutTitle.prepend(layoutIcon);

		const layoutContent = layoutCard.createDiv({ cls: 'crc-card__content' });

		// Direction selection
		let dirSelect: HTMLSelectElement;
		new Setting(layoutContent)
			.setName('Tree direction')
			.addDropdown(dropdown => {
				dirSelect = dropdown.selectEl;
				dropdown
					.addOption('vertical', 'Vertical (top to bottom)')
					.addOption('horizontal', 'Horizontal (left to right)');
			});

		// Layout type selection
		let layoutTypeSelect: HTMLSelectElement;
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
		let spacingXInput: HTMLInputElement;
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
		let spacingYInput: HTMLInputElement;
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

		// Tree Preview Card
		const previewCard = container.createDiv({ cls: 'crc-card' });
		const previewHeader = previewCard.createDiv({ cls: 'crc-card__header' });
		const previewTitle = previewHeader.createEl('h3', {
			cls: 'crc-card__title',
			text: 'Tree preview'
		});
		const previewIcon = createLucideIcon('eye', 20);
		previewTitle.prepend(previewIcon);

		const previewContent = previewCard.createDiv({ cls: 'crc-card__content' });

		// Description
		previewContent.createEl('p', {
			text: 'Preview your family tree layout before generating the canvas.',
			cls: 'crc-text-muted crc-mb-3'
		});

		// Preview controls row
		const previewControlsRow = previewContent.createDiv({ cls: 'crc-preview-controls crc-mb-3' });

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
			{ value: 'gender', label: 'Gender' },
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

		// Preview container
		this.treePreviewContainer = previewContent.createDiv({
			cls: 'crc-tree-preview-container'
		});

		// Initialize preview renderer
		this.treePreviewRenderer = new TreePreviewRenderer(this.treePreviewContainer);
		// Set initial color scheme from settings
		this.treePreviewRenderer.setColorScheme(this.plugin.settings.nodeColorScheme);

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
			void (() => {
				if (!rootPersonField.crId) {
					new Notice('Please select a root person first');
					return;
				}

				try {
					generatePreviewBtn.disabled = true;
					generatePreviewBtn.setText('Generating preview...');

					// Build family tree
					const graphService = this.plugin.createFamilyGraphService();
					const treeOptions: TreeOptions = {
						rootCrId: rootPersonField.crId,
						treeType: typeSelect.value as 'ancestors' | 'descendants' | 'full',
						maxGenerations: parseInt(genSlider.value) || 0,
						includeSpouses: spouseToggle.getValue(),
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

					// Render preview
					this.treePreviewRenderer?.renderPreview(familyTree, layoutOptions);

					new Notice('Preview generated successfully');
				} catch (error: unknown) {
					console.error('Preview generation failed:', error);
					new Notice('Failed to generate preview. See console for details.');
				} finally {
					generatePreviewBtn.disabled = false;
					generatePreviewBtn.setText('Generate preview');
				}
			})();
		});

		// Style Customization Card
		const styleCard = container.createDiv({ cls: 'crc-card' });
		const styleHeader = styleCard.createDiv({ cls: 'crc-card__header' });
		const styleTitle = styleHeader.createEl('h3', {
			cls: 'crc-card__title',
			text: 'Style customization (optional)'
		});
		const styleIcon = createLucideIcon('layout', 20);
		styleTitle.prepend(styleIcon);

		const styleContent = styleCard.createDiv({ cls: 'crc-card__content' });

		// Add description
		styleContent.createEl('p', {
			text: 'Override global style settings for this canvas only. Leave options unchecked to use global settings.',
			cls: 'setting-item-description'
		});

		// Style override toggles and controls
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
					.addOption('gender', 'Gender (green/purple)')
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

		// Export Tree Card
		const exportCard = container.createDiv({ cls: 'crc-card' });
		const exportHeader = exportCard.createDiv({ cls: 'crc-card__header' });
		const exportTitle = exportHeader.createEl('h3', {
			cls: 'crc-card__title',
			text: 'Export tree'
		});
		const exportIcon = createLucideIcon('download', 20);
		exportTitle.prepend(exportIcon);

		const exportContent = exportCard.createDiv({ cls: 'crc-card__content' });

		// Intro text
		exportContent.createEl('p', {
			text: 'Export an existing canvas to other formats.',
			cls: 'crc-text-muted crc-mb-3'
		});

		// Excalidraw export section
		exportContent.createEl('h4', {
			text: 'Excalidraw export',
			cls: 'crc-section-heading'
		});

		exportContent.createEl('p', {
			text: 'To export a canvas to Excalidraw format, right-click on any Canvas Roots canvas file and select "Export to Excalidraw". The export creates an editable Excalidraw file that preserves your tree structure.',
			cls: 'crc-text-muted crc-mb-3'
		});

		// Note about context menu
		const contextMenuNote = exportContent.createDiv({ cls: 'crc-info-box' });
		contextMenuNote.createEl('strong', { text: 'Quick access:' });
		contextMenuNote.createEl('p', {
			text: 'The fastest way to export is via the canvas file context menu. Just right-click any Canvas Roots canvas in your file explorer.',
			cls: 'crc-mt-1'
		});

		// Recent Trees Card (collapsible)
		const recentTrees = this.plugin.settings.recentTrees?.slice(0, 5) || [];
		if (recentTrees.length > 0) {
			const recentTreesCard = container.createDiv({ cls: 'crc-card' });
			const recentTreesHeader = recentTreesCard.createDiv({ cls: 'crc-card__header' });
			const recentTreesTitle = recentTreesHeader.createEl('h3', {
				cls: 'crc-card__title',
				text: 'Recent trees'
			});
			const recentTreesIcon = createLucideIcon('clock', 20);
			recentTreesTitle.prepend(recentTreesIcon);

			const recentTreesContent = recentTreesCard.createDiv({ cls: 'crc-card__content' });

			recentTreesContent.createEl('p', {
				cls: 'crc-form-help crc-mb-3',
				text: 'Quickly re-open your recently generated family trees'
			});

			recentTrees.forEach((tree, index) => {
				const treeBtn = recentTreesContent.createEl('button', {
					cls: `crc-btn crc-btn--secondary crc-btn--block ${index > 0 ? 'crc-mt-2' : ''}`,
					text: tree.canvasName.replace('.canvas', '')
				});
				const treeIcon = createLucideIcon('file', 16);
				treeBtn.prepend(treeIcon);

				// Add metadata badge
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

		// Wire up the Generate button (in Root person card)
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
			const filePath = `${fileName}`;

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
			const filePath = fileName;

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
				barFill.style.width = `${percent}%`;

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
	 * Show GEDCOM analysis before import
	 */
	private async showGedcomAnalysis(
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
			const importer = new GedcomImporter(this.app);
			const analysis = importer.analyzeFile(content);

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

			// Action buttons
			const actions = analysisContainer.createDiv({ cls: 'crc-gedcom-actions crc-mt-4' });

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
					await this.handleGedcomImport(file, destFolder);
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
	 * Handle GEDCOM file import
	 */
	private async handleGedcomImport(file: File, targetFolder?: string): Promise<void> {
		try {
			// Use target folder if provided, otherwise use settings
			const destFolder = targetFolder || this.plugin.settings.peopleFolder;
			logger.info('gedcom', `Starting GEDCOM import: ${file.name} to ${destFolder}`);

			// Read file content
			const content = await file.text();

			// Create importer
			const importer = new GedcomImporter(this.app);

			// Import GEDCOM file
			const result = await importer.importFile(content, {
				peopleFolder: destFolder,
				overwriteExisting: false,
				fileName: file.name
			});

			// Log results
			logger.info('gedcom', `Import complete: ${result.individualsProcessed} individuals processed`);

			if (result.errors.length > 0) {
				logger.warn('gedcom', `Import had ${result.errors.length} errors`);
				result.errors.forEach(error => logger.error('gedcom', error));
			}

			// Track import in recent imports history (limit to 10)
			if (result.success && result.notesCreated > 0) {
				const importInfo: RecentImportInfo = {
					fileName: file.name,
					recordsImported: result.individualsProcessed,
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

			// Show detailed import results modal with option to assign reference numbers
			const resultsModal = new GedcomImportResultsModal(
				this.app,
				result,
				result.validation,
				() => this.promptAssignReferenceNumbersAfterImport()
			);
			resultsModal.open();

			// Refresh status tab
			if (result.notesCreated > 0) {
				this.showTab('status');
			}
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('gedcom', `GEDCOM import failed: ${errorMsg}`);
			new Notice(`Failed to import GEDCOM: ${errorMsg}`);
		}
	}

	/**
	 * Prompt user to assign reference numbers after GEDCOM import
	 */
	private promptAssignReferenceNumbersAfterImport(): void {
		// Show menu to select numbering system
		const systemChoices: { system: NumberingSystem; label: string; description: string }[] = [
			{ system: 'ahnentafel', label: 'Ahnentafel', description: 'Ancestor numbering (1=self, 2=father, 3=mother)' },
			{ system: 'daboville', label: "d'Aboville", description: 'Descendant numbering with dots (1, 1.1, 1.2)' },
			{ system: 'henry', label: 'Henry', description: 'Compact descendant numbering (1, 11, 12)' },
			{ system: 'generation', label: 'Generation', description: 'Relative generation (0=self, -1=parents, +1=children)' }
		];

		// Create a simple selection modal
		const modal = new Modal(this.app);
		modal.titleEl.setText('Select numbering system');

		const content = modal.contentEl;
		content.createEl('p', {
			text: 'Choose a numbering system, then select the root person.',
			cls: 'crc-text-muted'
		});

		const buttonContainer = content.createDiv({ cls: 'cr-numbering-system-buttons' });

		for (const choice of systemChoices) {
			const btn = buttonContainer.createEl('button', {
				cls: 'crc-btn crc-btn--block',
				text: choice.label
			});
			btn.createEl('small', {
				text: ` - ${choice.description}`,
				cls: 'crc-text-muted'
			});
			btn.addEventListener('click', () => {
				modal.close();
				this.selectRootPersonForNumbering(choice.system);
			});
		}

		modal.open();
	}

	/**
	 * Select root person and assign reference numbers
	 */
	private selectRootPersonForNumbering(system: NumberingSystem): void {
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
		});
		picker.open();
	}

	/**
	 * Handle GEDCOM file export
	 */
	private async handleGedcomExport(options: {
		fileName: string;
		collectionFilter?: string;
		includeCollectionCodes: boolean;
		branchRootCrId?: string;
		branchDirection?: 'ancestors' | 'descendants';
		branchIncludeSpouses?: boolean;
		privacyOverride?: {
			enablePrivacyProtection: boolean;
			privacyDisplayFormat: 'living' | 'private' | 'initials' | 'hidden';
		};
	}): Promise<void> {
		try {
			logger.info('gedcom-export', `Starting GEDCOM export: ${options.fileName}`);

			// Create exporter
			const { GedcomExporter } = await import('../gedcom/gedcom-exporter');
			const exporter = new GedcomExporter(this.app);

			// Export to GEDCOM
			const result = exporter.exportToGedcom({
				peopleFolder: this.plugin.settings.peopleFolder,
				collectionFilter: options.collectionFilter,
				branchRootCrId: options.branchRootCrId,
				branchDirection: options.branchDirection,
				branchIncludeSpouses: options.branchIncludeSpouses,
				includeCollectionCodes: options.includeCollectionCodes,
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

			if (result.success && result.gedcomContent) {
				// Create blob and trigger download
				const blob = new Blob([result.gedcomContent], { type: 'text/plain' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${result.fileName}.ged`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);

				let noticeMsg = `GEDCOM exported: ${result.individualsExported} people, ${result.familiesExported} families`;
				if (result.privacyExcluded && result.privacyExcluded > 0) {
					noticeMsg += ` (${result.privacyExcluded} living excluded)`;
				} else if (result.privacyObfuscated && result.privacyObfuscated > 0) {
					noticeMsg += ` (${result.privacyObfuscated} living obfuscated)`;
				}
				new Notice(noticeMsg);
			} else {
				throw new Error('Export failed to generate content');
			}
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('gedcom-export', `GEDCOM export failed: ${errorMsg}`);
			new Notice(`Failed to export GEDCOM: ${errorMsg}`);
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
				components.forEach((component, index) => {
					const familyItem = listContent.createDiv({ cls: 'crc-collection-item' });

					const familyName = component.collectionName || `Family ${index + 1}`;
					const familyHeader = familyItem.createDiv({ cls: 'crc-collection-header' });
					familyHeader.createEl('strong', { text: `${familyName} ` }); // Added space after name
					familyHeader.createEl('span', {
						cls: 'crc-badge',
						text: `${component.size} ${component.size === 1 ? 'person' : 'people'}`
					});

					familyItem.createEl('div', {
						cls: 'crc-text--muted',
						text: `Representative: ${component.representative.name}`
					});
				});
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
		const container = this.contentContainer;

		// Actions Card
		const actionsCard = this.createCard({
			title: 'Actions',
			icon: 'plus',
			subtitle: 'Create and manage place notes'
		});

		const actionsContent = actionsCard.querySelector('.crc-card__content') as HTMLElement;

		new Setting(actionsContent)
			.setName('Create new place note')
			.setDesc('Create a new place note with geographic information')
			.addButton(button => button
				.setButtonText('Create place')
				.setCta()
				.onClick(() => {
					new CreatePlaceModal(this.app, {
						directory: this.plugin.settings.placesFolder || '',
						familyGraph: this.plugin.createFamilyGraphService(),
						placeGraph: new PlaceGraphService(this.app),
						settings: this.plugin.settings,
						onCreated: () => {
							// Refresh the Places tab
							this.showTab('places');
						}
					}).open();
				}));

		new Setting(actionsContent)
			.setName('Create missing place notes')
			.setDesc('Generate place notes for locations referenced in person notes')
			.addButton(button => button
				.setButtonText('Find missing')
				.onClick(() => {
					void this.showCreateMissingPlacesModal();
				}));

		new Setting(actionsContent)
			.setName('Build place hierarchy')
			.setDesc('Assign parent places to orphan locations')
			.addButton(button => button
				.setButtonText('Build hierarchy')
				.onClick(() => {
					void this.showBuildHierarchyModal();
				}));

		new Setting(actionsContent)
			.setName('Standardize place names')
			.setDesc('Find and unify variations of place names')
			.addButton(button => button
				.setButtonText('Find variations')
				.onClick(() => {
					void this.showStandardizePlacesModal();
				}));

		new Setting(actionsContent)
			.setName('Templater templates')
			.setDesc('Copy ready-to-use templates for Templater integration')
			.addButton(button => button
				.setButtonText('View templates')
				.onClick(() => {
					new TemplateSnippetsModal(this.app).open();
				}));

		container.appendChild(actionsCard);

		// Overview Card
		const overviewCard = this.createCard({
			title: 'Place statistics',
			icon: 'map-pin',
			subtitle: 'Geographic data overview'
		});

		const overviewContent = overviewCard.querySelector('.crc-card__content') as HTMLElement;
		overviewContent.createEl('p', {
			text: 'Loading statistics...',
			cls: 'crc-text--muted'
		});

		container.appendChild(overviewCard);

		// Load statistics asynchronously
		void this.loadPlaceStatistics(overviewContent);

		// Place List Card
		const listCard = this.createCard({
			title: 'Place notes',
			icon: 'globe',
			subtitle: 'Defined place notes in your vault'
		});

		const listContent = listCard.querySelector('.crc-card__content') as HTMLElement;
		listContent.createEl('p', {
			text: 'Loading places...',
			cls: 'crc-text--muted'
		});

		container.appendChild(listCard);

		// Load place list asynchronously
		void this.loadPlaceList(listContent);

		// Referenced Places Card (places mentioned in person notes)
		const referencedCard = this.createCard({
			title: 'Referenced places',
			icon: 'link',
			subtitle: 'Places mentioned in person notes'
		});

		const referencedContent = referencedCard.querySelector('.crc-card__content') as HTMLElement;
		referencedContent.createEl('p', {
			text: 'Loading references...',
			cls: 'crc-text--muted'
		});

		container.appendChild(referencedCard);

		// Load referenced places asynchronously
		void this.loadReferencedPlaces(referencedContent);

		// Issues Card
		const issuesCard = this.createCard({
			title: 'Data quality issues',
			icon: 'alert-triangle',
			subtitle: 'Place-related issues requiring attention'
		});

		const issuesContent = issuesCard.querySelector('.crc-card__content') as HTMLElement;
		issuesContent.createEl('p', {
			text: 'Loading issues...',
			cls: 'crc-text--muted'
		});

		container.appendChild(issuesCard);

		// Load issues asynchronously
		void this.loadPlaceIssues(issuesContent);
	}

	/**
	 * Load place statistics into container
	 */
	private loadPlaceStatistics(container: HTMLElement): void {
		container.empty();

		const placeService = new PlaceGraphService(this.app);
		placeService.setValueAliases(this.plugin.settings.valueAliases);
		placeService.reloadCache();

		const stats = placeService.calculateStatistics();

		// If no places, show getting started message
		if (stats.totalPlaces === 0) {
			const emptyState = container.createDiv({ cls: 'crc-empty-state' });
			emptyState.createEl('p', {
				text: 'No place notes found in your vault.',
				cls: 'crc-text--muted'
			});
			emptyState.createEl('p', {
				text: 'Place notes use type: place in their frontmatter. Create place notes to track geographic locations associated with your family tree.',
				cls: 'crc-text--muted crc-text--small'
			});
			return;
		}

		// Overview statistics grid
		const statsGrid = container.createDiv({ cls: 'crc-stats-grid' });

		// Total places
		this.createStatItem(statsGrid, 'Total places', stats.totalPlaces.toString(), 'map-pin');

		// With coordinates
		const coordPercent = stats.totalPlaces > 0
			? Math.round((stats.withCoordinates / stats.totalPlaces) * 100)
			: 0;
		this.createStatItem(statsGrid, 'With coordinates', `${stats.withCoordinates} (${coordPercent}%)`, 'globe');

		// Hierarchy depth
		this.createStatItem(statsGrid, 'Max hierarchy depth', stats.maxHierarchyDepth.toString(), 'layers');

		// Orphan places
		this.createStatItem(statsGrid, 'Orphan places', stats.orphanPlaces.toString(), 'alert-circle');

		// By Category breakdown
		const categorySection = container.createDiv({ cls: 'crc-mt-4' });
		categorySection.createEl('h4', { text: 'By category', cls: 'crc-section-title' });

		const categoryGrid = categorySection.createDiv({ cls: 'crc-stats-grid crc-stats-grid--compact' });

		const categories: PlaceCategory[] = ['real', 'historical', 'disputed', 'legendary', 'mythological', 'fictional'];
		for (const category of categories) {
			const count = stats.byCategory[category];
			if (count > 0) {
				this.createStatItem(categoryGrid, this.formatPlaceCategoryName(category), count.toString());
			}
		}

		// Universes (if any fictional/mythological places)
		const universeCount = Object.keys(stats.byUniverse).length;
		if (universeCount > 0) {
			const universeSection = container.createDiv({ cls: 'crc-mt-4' });
			universeSection.createEl('h4', { text: 'By universe', cls: 'crc-section-title' });

			const universeList = universeSection.createEl('ul', { cls: 'crc-list' });
			for (const [universe, count] of Object.entries(stats.byUniverse).sort((a, b) => b[1] - a[1])) {
				const item = universeList.createEl('li');
				item.createEl('span', { text: universe });
				item.createEl('span', { text: ` (${count})`, cls: 'crc-text--muted' });
			}
		}

		// Collections (user-defined groupings)
		const collectionCount = Object.keys(stats.byCollection).length;
		if (collectionCount > 0) {
			const collectionSection = container.createDiv({ cls: 'crc-mt-4' });
			collectionSection.createEl('h4', { text: 'By collection', cls: 'crc-section-title' });

			const collectionList = collectionSection.createEl('ul', { cls: 'crc-list' });
			for (const [collection, count] of Object.entries(stats.byCollection).sort((a, b) => b[1] - a[1])) {
				const item = collectionList.createEl('li');
				item.createEl('span', { text: collection });
				item.createEl('span', { text: ` (${count})`, cls: 'crc-text--muted' });
			}
		}

		// Top birth places
		if (stats.topBirthPlaces.length > 0) {
			const birthSection = container.createDiv({ cls: 'crc-mt-4' });
			birthSection.createEl('h4', { text: 'Most common birth places', cls: 'crc-section-title' });

			const birthList = birthSection.createEl('ol', { cls: 'crc-list crc-list--numbered' });
			for (const place of stats.topBirthPlaces.slice(0, 5)) {
				const item = birthList.createEl('li');
				item.createEl('span', { text: place.place });
				item.createEl('span', { text: ` (${place.count})`, cls: 'crc-text--muted' });
			}
		}

		// Top death places
		if (stats.topDeathPlaces.length > 0) {
			const deathSection = container.createDiv({ cls: 'crc-mt-4' });
			deathSection.createEl('h4', { text: 'Most common death places', cls: 'crc-section-title' });

			const deathList = deathSection.createEl('ol', { cls: 'crc-list crc-list--numbered' });
			for (const place of stats.topDeathPlaces.slice(0, 5)) {
				const item = deathList.createEl('li');
				item.createEl('span', { text: place.place });
				item.createEl('span', { text: ` (${place.count})`, cls: 'crc-text--muted' });
			}
		}

		// Migration patterns
		if (stats.migrationPatterns.length > 0) {
			const migrationSection = container.createDiv({ cls: 'crc-mt-4' });
			migrationSection.createEl('h4', { text: 'Migration patterns (birth → death)', cls: 'crc-section-title' });

			const migrationList = migrationSection.createEl('ul', { cls: 'crc-list' });
			for (const pattern of stats.migrationPatterns.slice(0, 5)) {
				const item = migrationList.createEl('li');
				item.createEl('span', { text: `${pattern.from} → ${pattern.to}` });
				item.createEl('span', { text: ` (${pattern.count})`, cls: 'crc-text--muted' });
			}
		}
	}

	/**
	 * Load place list into container
	 */
	private loadPlaceList(container: HTMLElement): void {
		container.empty();

		const placeService = new PlaceGraphService(this.app);
		placeService.setValueAliases(this.plugin.settings.valueAliases);
		placeService.reloadCache();

		const places = placeService.getAllPlaces();

		if (places.length === 0) {
			container.createEl('p', {
				text: 'No place notes found. Create place notes with type: place in frontmatter.',
				cls: 'crc-text--muted'
			});
			return;
		}

		// Sort by name
		places.sort((a, b) => a.name.localeCompare(b.name));

		// Group by category
		const byCategory = new Map<PlaceCategory, typeof places>();
		for (const place of places) {
			if (!byCategory.has(place.category)) {
				byCategory.set(place.category, []);
			}
			byCategory.get(place.category)!.push(place);
		}

		// Display categories in order
		const categories: PlaceCategory[] = ['real', 'historical', 'disputed', 'legendary', 'mythological', 'fictional'];

		for (const category of categories) {
			const categoryPlaces = byCategory.get(category);
			if (!categoryPlaces || categoryPlaces.length === 0) continue;

			const categorySection = container.createDiv({ cls: 'crc-place-category' });

			const categoryHeader = categorySection.createDiv({ cls: 'crc-collection-header' });
			categoryHeader.createEl('strong', { text: `${this.formatPlaceCategoryName(category)} ` });
			categoryHeader.createEl('span', {
				cls: 'crc-badge',
				text: categoryPlaces.length.toString()
			});

			const placeList = categorySection.createEl('ul', { cls: 'crc-list crc-mt-2' });

			for (const place of categoryPlaces.slice(0, 10)) {
				const item = placeList.createEl('li', { cls: 'crc-place-item' });

				// Place name as link
				const link = item.createEl('a', {
					text: place.name,
					cls: 'crc-link'
				});
				link.addEventListener('click', (e) => {
					e.preventDefault();
					const file = this.app.vault.getAbstractFileByPath(place.filePath);
					if (file instanceof TFile) {
						void this.app.workspace.getLeaf(false).openFile(file);
						this.close();
					}
				});

				// Edit button
				const editBtn = item.createEl('button', {
					cls: 'crc-place-edit-btn clickable-icon',
					attr: { 'aria-label': 'Edit place' }
				});
				const editIcon = createLucideIcon('edit', 14);
				editBtn.appendChild(editIcon);
				editBtn.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					const file = this.app.vault.getAbstractFileByPath(place.filePath);
					if (file instanceof TFile) {
						new CreatePlaceModal(this.app, {
							editPlace: place,
							editFile: file,
							placeGraph: placeService,
							settings: this.plugin.settings,
							onUpdated: () => {
								// Refresh the place list after edit
								void this.loadPlaceList(container);
							}
						}).open();
					}
				});

				// Person count
				const peopleAtPlace = placeService.getPeopleAtPlace(place.id);
				if (peopleAtPlace.length > 0) {
					item.createEl('span', {
						text: ` (${peopleAtPlace.length} ${peopleAtPlace.length === 1 ? 'person' : 'people'})`,
						cls: 'crc-text--muted'
					});
				}

				// Place type badge
				if (place.placeType) {
					item.createEl('span', {
						text: place.placeType,
						cls: 'crc-badge crc-badge--small crc-ml-2'
					});
				}

				// Universe badge for fictional places
				if (place.universe) {
					item.createEl('span', {
						text: place.universe,
						cls: 'crc-badge crc-badge--accent crc-badge--small crc-ml-1'
					});
				}
			}

			// Show "more" indicator if truncated
			if (categoryPlaces.length > 10) {
				categorySection.createEl('p', {
					text: `+${categoryPlaces.length - 10} more...`,
					cls: 'crc-text--muted crc-text--small'
				});
			}
		}
	}

	/**
	 * Load referenced places into container
	 */
	private loadReferencedPlaces(container: HTMLElement): void {
		container.empty();

		const placeService = new PlaceGraphService(this.app);
		placeService.setValueAliases(this.plugin.settings.valueAliases);
		placeService.reloadCache();

		const references = placeService.getReferencedPlaces();

		if (references.size === 0) {
			container.createEl('p', {
				text: 'No place references found in person notes.',
				cls: 'crc-text--muted'
			});
			return;
		}

		// Separate linked vs unlinked
		const linked: Array<{ name: string; count: number }> = [];
		const unlinked: Array<{ name: string; count: number }> = [];

		for (const [name, info] of references.entries()) {
			if (info.linked) {
				linked.push({ name, count: info.count });
			} else {
				unlinked.push({ name, count: info.count });
			}
		}

		// State for filtering and sorting
		let filterText = '';
		let sortBy: 'count' | 'name' = 'count';
		let showLinked = true;
		let showUnlinked = true;

		// Summary
		const summary = container.createDiv({ cls: 'crc-stats-summary crc-mb-3' });
		summary.createEl('span', { text: `${linked.length} linked`, cls: 'crc-text--success' });
		summary.createEl('span', { text: ' • ', cls: 'crc-text--muted' });
		summary.createEl('span', { text: `${unlinked.length} unlinked`, cls: unlinked.length > 0 ? 'crc-text--warning' : 'crc-text--muted' });

		// Controls row
		const controlsRow = container.createDiv({ cls: 'crc-referenced-controls crc-mb-3' });

		// Filter input
		const filterContainer = controlsRow.createDiv({ cls: 'crc-filter-container' });
		const filterInput = filterContainer.createEl('input', {
			type: 'text',
			placeholder: 'Filter places...',
			cls: 'crc-filter-input'
		});

		// Sort dropdown
		const sortContainer = controlsRow.createDiv({ cls: 'crc-sort-container' });
		sortContainer.createEl('span', { text: 'Sort: ', cls: 'crc-text--muted crc-text--small' });
		const sortSelect = sortContainer.createEl('select', { cls: 'crc-sort-select dropdown' });
		sortSelect.createEl('option', { value: 'count', text: 'By count' });
		sortSelect.createEl('option', { value: 'name', text: 'By name' });

		// Filter checkboxes
		const filterToggles = controlsRow.createDiv({ cls: 'crc-filter-toggles' });

		const linkedToggle = filterToggles.createEl('label', { cls: 'crc-filter-toggle' });
		const linkedCheckbox = linkedToggle.createEl('input', { type: 'checkbox' });
		linkedCheckbox.checked = true;
		linkedToggle.createEl('span', { text: 'Linked', cls: 'crc-text--small' });

		const unlinkedToggle = filterToggles.createEl('label', { cls: 'crc-filter-toggle' });
		const unlinkedCheckbox = unlinkedToggle.createEl('input', { type: 'checkbox' });
		unlinkedCheckbox.checked = true;
		unlinkedToggle.createEl('span', { text: 'Unlinked', cls: 'crc-text--small' });

		// List container
		const listContainer = container.createDiv({ cls: 'crc-referenced-list' });

		// Render function
		const renderList = () => {
			listContainer.empty();

			// Apply sorting
			const sortFn = sortBy === 'count'
				? (a: { name: string; count: number }, b: { name: string; count: number }) => b.count - a.count
				: (a: { name: string; count: number }, b: { name: string; count: number }) => a.name.localeCompare(b.name);

			// Filter and combine lists
			const allPlaces: Array<{ name: string; count: number; linked: boolean }> = [];

			if (showUnlinked) {
				for (const p of unlinked) {
					if (!filterText || p.name.toLowerCase().includes(filterText.toLowerCase())) {
						allPlaces.push({ ...p, linked: false });
					}
				}
			}

			if (showLinked) {
				for (const p of linked) {
					if (!filterText || p.name.toLowerCase().includes(filterText.toLowerCase())) {
						allPlaces.push({ ...p, linked: true });
					}
				}
			}

			// Sort
			allPlaces.sort((a, b) => {
				// Unlinked first when sorting by count
				if (sortBy === 'count' && a.linked !== b.linked) {
					return a.linked ? 1 : -1;
				}
				return sortFn(a, b);
			});

			if (allPlaces.length === 0) {
				listContainer.createEl('p', {
					text: filterText ? 'No places match the filter.' : 'No places to show.',
					cls: 'crc-text--muted'
				});
				return;
			}

			// Render list
			const list = listContainer.createEl('ul', { cls: 'crc-list crc-referenced-places-list' });

			for (const place of allPlaces) {
				const item = list.createEl('li', {
					cls: `crc-referenced-place-item ${place.linked ? 'crc-referenced-place-item--linked' : 'crc-referenced-place-item--unlinked'}`
				});

				const content = item.createDiv({ cls: 'crc-referenced-place-content' });

				// Status indicator
				const statusIcon = content.createSpan({ cls: 'crc-referenced-place-status' });
				if (place.linked) {
					setLucideIcon(statusIcon, 'check', 14);
					statusIcon.addClass('crc-text--success');
				} else {
					setLucideIcon(statusIcon, 'alert-circle', 14);
					statusIcon.addClass('crc-text--warning');
				}

				// Name and count
				content.createEl('span', { text: place.name, cls: 'crc-referenced-place-name' });
				content.createEl('span', { text: ` (${place.count})`, cls: 'crc-text--muted' });

				// Quick-create button for unlinked
				if (!place.linked) {
					const createBtn = item.createEl('button', {
						cls: 'crc-btn crc-btn--small crc-btn--ghost',
						text: 'Create'
					});
					createBtn.addEventListener('click', () => {
						this.showQuickCreatePlaceModal(place.name);
					});
				}
			}

			// Show count
			const countText = listContainer.createEl('p', {
				cls: 'crc-text--muted crc-text--small crc-mt-2'
			});
			countText.textContent = `Showing ${allPlaces.length} of ${linked.length + unlinked.length} places`;
		};

		// Event handlers
		filterInput.addEventListener('input', () => {
			filterText = filterInput.value;
			renderList();
		});

		sortSelect.addEventListener('change', () => {
			sortBy = sortSelect.value as 'count' | 'name';
			renderList();
		});

		linkedCheckbox.addEventListener('change', () => {
			showLinked = linkedCheckbox.checked;
			renderList();
		});

		unlinkedCheckbox.addEventListener('change', () => {
			showUnlinked = unlinkedCheckbox.checked;
			renderList();
		});

		// Initial render
		renderList();
	}

	/**
	 * Load place issues into container
	 */
	private loadPlaceIssues(container: HTMLElement): void {
		container.empty();

		const placeService = new PlaceGraphService(this.app);
		placeService.setValueAliases(this.plugin.settings.valueAliases);
		placeService.reloadCache();

		const stats = placeService.calculateStatistics();
		const issues = stats.issues;

		if (issues.length === 0) {
			container.createEl('p', {
				text: 'No issues found.',
				cls: 'crc-text--success'
			});
			return;
		}

		// Group by issue type
		const byType = new Map<string, PlaceIssue[]>();
		for (const issue of issues) {
			if (!byType.has(issue.type)) {
				byType.set(issue.type, []);
			}
			byType.get(issue.type)!.push(issue);
		}

		// Display issue groups
		for (const [type, typeIssues] of byType.entries()) {
			const issueSection = container.createDiv({ cls: 'crc-issue-group crc-mb-3' });

			const header = issueSection.createDiv({ cls: 'crc-collection-header' });
			header.createEl('strong', { text: `${this.formatIssueType(type)} ` });
			header.createEl('span', {
				cls: 'crc-badge crc-badge--warning',
				text: typeIssues.length.toString()
			});

			const issueList = issueSection.createEl('ul', { cls: 'crc-list crc-list--compact' });
			for (const issue of typeIssues.slice(0, 5)) {
				const item = issueList.createEl('li', { cls: 'crc-text--small' });
				item.textContent = issue.message;
			}

			if (typeIssues.length > 5) {
				issueSection.createEl('p', {
					text: `+${typeIssues.length - 5} more...`,
					cls: 'crc-text--muted crc-text--small'
				});
			}
		}
	}

	// ==========================================================================
	// Maps Tab
	// ==========================================================================

	/**
	 * Show the Maps tab content
	 */
	private showMapsTab(): void {
		const container = this.contentContainer;

		// Card 1: Open map view
		const mapViewCard = this.createCard({
			title: 'Open map view',
			icon: 'map',
			subtitle: 'Interactive geographic visualization'
		});

		const mapViewContent = mapViewCard.querySelector('.crc-card__content') as HTMLElement;

		// Quick stats
		const placeService = new PlaceGraphService(this.app);
		placeService.setValueAliases(this.plugin.settings.valueAliases);
		placeService.reloadCache();
		const stats = placeService.calculateStatistics();

		const statsDiv = mapViewContent.createDiv({ cls: 'crc-stats-row crc-mb-3' });
		statsDiv.createEl('span', {
			text: `${stats.withCoordinates} places with coordinates`,
			cls: 'crc-text--muted'
		});

		new Setting(mapViewContent)
			.setName('Open map view')
			.setDesc('View all geographic data on an interactive map')
			.addButton(button => button
				.setButtonText('Open map')
				.setCta()
				.onClick(() => {
					this.app.commands.executeCommandById('canvas-roots:open-map-view');
					this.close();
				}));

		new Setting(mapViewContent)
			.setName('Open new map view')
			.setDesc('Open a second map view for side-by-side comparison')
			.addButton(button => button
				.setButtonText('Open new map')
				.onClick(() => {
					this.app.commands.executeCommandById('canvas-roots:open-new-map-view');
					this.close();
				}));

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

		// Card 4: Map Statistics
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

		// Find all map notes (type: map in frontmatter)
		const customMaps = this.getCustomMaps();

		if (customMaps.length === 0) {
			const emptyState = container.createDiv({ cls: 'crc-empty-state' });
			emptyState.createEl('p', {
				text: 'No custom maps found.',
				cls: 'crc-text--muted'
			});
			emptyState.createEl('p', {
				text: 'Create a note with type: map in frontmatter to define custom image maps for fictional worlds.',
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

		while (true) {
			const testPath = parentPath
				? `${parentPath}/${finalName}.md`
				: `${finalName}.md`;
			const existingFile = this.app.vault.getAbstractFileByPath(testPath);
			if (!existingFile) break;

			suffix++;
			finalName = `${originalName} (copy ${suffix})`;
			finalId = originalId ? `${originalId}-copy-${suffix}` : this.generateMapId(finalName);
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
					'type: map',
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
	}

	/**
	 * Format place category name for display
	 */
	private formatPlaceCategoryName(category: PlaceCategory): string {
		const names: Record<PlaceCategory, string> = {
			real: 'Real',
			historical: 'Historical',
			disputed: 'Disputed',
			legendary: 'Legendary',
			mythological: 'Mythological',
			fictional: 'Fictional'
		};
		return names[category] || category;
	}

	/**
	 * Format issue type for display
	 */
	private formatIssueType(type: string): string {
		const names: Record<string, string> = {
			orphan_place: 'Orphan places',
			missing_place_note: 'Missing place notes',
			circular_hierarchy: 'Circular hierarchies',
			duplicate_name: 'Duplicate names',
			fictional_with_coords: 'Fictional places with coordinates',
			real_missing_coords: 'Real places missing coordinates',
			invalid_category: 'Invalid categories'
		};
		return names[type] || type;
	}

	/**
	 * Show modal to create missing place notes
	 */
	private showCreateMissingPlacesModal(): void {
		const placeService = new PlaceGraphService(this.app);
		placeService.setValueAliases(this.plugin.settings.valueAliases);
		placeService.reloadCache();

		const references = placeService.getReferencedPlaces();

		// Find unlinked places (referenced but no note exists)
		const unlinked: Array<{ name: string; count: number }> = [];
		for (const [name, info] of references.entries()) {
			if (!info.linked) {
				unlinked.push({ name, count: info.count });
			}
		}

		// Sort by reference count (most referenced first)
		unlinked.sort((a, b) => b.count - a.count);

		if (unlinked.length === 0) {
			new Notice('All referenced places already have notes!');
			return;
		}

		// Create a selection modal
		const modal = new CreateMissingPlacesModal(this.app, unlinked, {
			directory: this.plugin.settings.placesFolder || '',
			placeGraph: placeService,
			onComplete: (created: number) => {
				if (created > 0) {
					// Refresh the Places tab
					this.showTab('places');
				}
			}
		});
		modal.open();
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
	 * Show modal to build place hierarchy (assign parents to orphan places)
	 */
	private showBuildHierarchyModal(): void {
		const placeService = new PlaceGraphService(this.app);
		placeService.setValueAliases(this.plugin.settings.valueAliases);
		placeService.reloadCache();

		const allPlaces = placeService.getAllPlaces();

		// Find orphan places (no parent and not top-level types)
		const orphanPlaces = allPlaces.filter(place =>
			!place.parentId &&
			place.placeType &&
			!['continent', 'country'].includes(place.placeType)
		);

		if (orphanPlaces.length === 0) {
			new Notice('No orphan places found! All places have parent assignments or are top-level.');
			return;
		}

		// Get potential parent places (higher-level places)
		const potentialParents = allPlaces.filter(place =>
			place.placeType && ['continent', 'country', 'state', 'province', 'region', 'county'].includes(place.placeType)
		);

		// Create hierarchy wizard modal
		const modal = new BuildPlaceHierarchyModal(this.app, orphanPlaces, potentialParents, {
			onComplete: (updated: number) => {
				new Notice(`Updated ${updated} place${updated !== 1 ? 's' : ''} with parent assignments`);
				// Refresh the Places tab
				this.showTab('places');
			}
		});
		modal.open();
	}

	/**
	 * Show modal to standardize place name variations
	 */
	private showStandardizePlacesModal(): void {
		// Find place name variations
		const variationGroups = findPlaceNameVariations(this.app);

		if (variationGroups.length === 0) {
			new Notice('No place name variations found. Your place names are already consistent!');
			return;
		}

		const modal = new StandardizePlacesModal(this.app, variationGroups, {
			onComplete: (updated: number) => {
				if (updated > 0) {
					// Refresh the Places tab
					this.showTab('places');
				}
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
			title: 'Validation',
			icon: 'clipboard-check',
			subtitle: 'Run schema validation on person notes'
		});

		const validationContent = validationCard.querySelector('.crc-card__content') as HTMLElement;

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
		const validateButtonContainer = validationContent.createDiv({ cls: 'crc-button-row' });
		const validateBtn = validateButtonContainer.createEl('button', {
			cls: 'crc-btn crc-btn--primary',
			text: 'Validate vault'
		});
		setIcon(validateBtn, 'play');
		validateBtn.prepend(createLucideIcon('play', 16));

		const validateStatus = validationContent.createDiv({ cls: 'crc-validation-status crc-mt-2' });

		validateBtn.addEventListener('click', () => void (async () => {
			validateBtn.disabled = true;
			validateBtn.textContent = 'Validating...';
			validateStatus.empty();
			validateStatus.createEl('span', { text: 'Running validation...', cls: 'crc-text--muted' });

			try {
				this.lastValidationResults = await validationService.validateVault();
				this.lastValidationSummary = validationService.getSummary(this.lastValidationResults);

				// Refresh the tab to show updated results
				void this.showSchemasTab();

				const errorCount = this.lastValidationSummary.totalErrors;
				if (errorCount === 0) {
					new Notice('✓ Validation passed! No schema violations found.');
				} else {
					new Notice(`Found ${errorCount} validation error${errorCount === 1 ? '' : 's'}`);
				}
			} catch (error) {
				validateStatus.empty();
				validateStatus.createEl('span', {
					text: `Error: ${getErrorMessage(error)}`,
					cls: 'crc-text--error'
				});
				new Notice('Validation failed: ' + getErrorMessage(error));
			} finally {
				validateBtn.disabled = false;
				validateBtn.textContent = 'Validate vault';
				validateBtn.prepend(createLucideIcon('play', 16));
			}
		})());

		container.appendChild(validationCard);

		// Card 2: Schemas Gallery
		const schemasCard = this.createCard({
			title: 'Schemas',
			icon: 'file-check',
			subtitle: 'Define validation rules for person notes'
		});

		const schemasContent = schemasCard.querySelector('.crc-card__content') as HTMLElement;

		// Create schema buttons
		new Setting(schemasContent)
			.setName('Create schema')
			.setDesc('Define a new validation schema for person notes')
			.addButton(button => button
				.setButtonText('Create schema')
				.onClick(() => {
					new CreateSchemaModal(this.app, this.plugin, {
						onCreated: () => {
							void this.loadSchemasGallery(schemaService, schemasGridContainer);
						}
					}).open();
				}))
			.addButton(button => button
				.setButtonText('Import JSON')
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
	 * Render schema violations section in Data Quality tab
	 * Shows summary of schema validation results with quick actions
	 */
	private renderSchemaViolationsSection(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'crc-section crc-schema-violations-section' });

		// Header with link to Schemas tab
		const header = section.createDiv({ cls: 'crc-section-header' });
		header.createEl('h3', { text: 'Schema validation' });

		const schemaLink = header.createEl('button', {
			cls: 'crc-link-button',
			text: 'Open schemas tab'
		});
		setIcon(schemaLink.createSpan({ cls: 'crc-button-icon-right' }), 'external-link');
		schemaLink.addEventListener('click', () => {
			this.showTab('schemas');
		});

		// Check if we have validation results
		if (!this.lastValidationSummary || this.lastValidationResults.length === 0) {
			const emptyState = section.createDiv({ cls: 'crc-empty-state crc-compact' });
			setIcon(emptyState.createSpan({ cls: 'crc-empty-icon' }), 'clipboard-check');
			emptyState.createEl('p', { text: 'No schema validation has been run yet.' });

			const validateBtn = emptyState.createEl('button', {
				cls: 'mod-cta',
				text: 'Run schema validation'
			});
			validateBtn.addEventListener('click', () => void this.runSchemaValidationFromDataQuality(section));
			return;
		}

		// Summary stats
		const summary = this.lastValidationSummary;
		const statsRow = section.createDiv({ cls: 'crc-schema-summary-row' });

		// Calculate passed/failed from results
		const uniquePeople = new Set(this.lastValidationResults.map(r => r.filePath));
		const failedPeople = new Set(this.lastValidationResults.filter(r => !r.isValid).map(r => r.filePath));
		const passedCount = uniquePeople.size - failedPeople.size;
		const failedCount = failedPeople.size;

		// Total validated
		const validatedStat = statsRow.createDiv({ cls: 'crc-schema-stat' });
		setIcon(validatedStat.createSpan({ cls: 'crc-schema-stat-icon' }), 'users');
		validatedStat.createSpan({ text: `${summary.totalPeopleValidated} validated`, cls: 'crc-schema-stat-text' });

		// Passed
		const passedStat = statsRow.createDiv({ cls: 'crc-schema-stat crc-schema-stat-success' });
		setIcon(passedStat.createSpan({ cls: 'crc-schema-stat-icon' }), 'check');
		passedStat.createSpan({ text: `${passedCount} passed`, cls: 'crc-schema-stat-text' });

		// Failed
		const failedStat = statsRow.createDiv({ cls: 'crc-schema-stat crc-schema-stat-error' });
		setIcon(failedStat.createSpan({ cls: 'crc-schema-stat-icon' }), 'alert-circle');
		failedStat.createSpan({ text: `${failedCount} failed`, cls: 'crc-schema-stat-text' });

		// If there are errors, show breakdown by type
		if (summary.totalErrors > 0) {
			const errorBreakdown = section.createDiv({ cls: 'crc-schema-error-breakdown' });
			errorBreakdown.createEl('h4', { text: 'Error breakdown', cls: 'crc-section-subtitle' });

			const errorGrid = errorBreakdown.createDiv({ cls: 'crc-schema-error-grid' });
			const errorTypes = summary.errorsByType;

			const errorTypeLabels: Record<string, string> = {
				missing_required: 'Missing required',
				invalid_type: 'Invalid type',
				invalid_enum: 'Invalid enum',
				out_of_range: 'Out of range',
				constraint_failed: 'Constraint failed',
				conditional_required: 'Conditional required',
				invalid_wikilink_target: 'Invalid wikilink'
			};

			for (const [type, count] of Object.entries(errorTypes)) {
				if (count > 0) {
					const errorItem = errorGrid.createDiv({ cls: 'crc-schema-error-item' });
					errorItem.createSpan({ text: errorTypeLabels[type] || type, cls: 'crc-schema-error-label' });
					errorItem.createSpan({ text: count.toString(), cls: 'crc-schema-error-count' });
				}
			}
		}

		// Recent violations (top 5)
		const failedResults = this.lastValidationResults.filter(r => !r.isValid);
		if (failedResults.length > 0) {
			const recentSection = section.createDiv({ cls: 'crc-schema-recent-violations' });
			recentSection.createEl('h4', { text: 'Recent violations', cls: 'crc-section-subtitle' });

			const violationsList = recentSection.createDiv({ cls: 'crc-schema-violations-list' });
			const displayCount = Math.min(5, failedResults.length);

			for (let i = 0; i < displayCount; i++) {
				const result = failedResults[i];
				const item = violationsList.createDiv({ cls: 'crc-schema-violation-item' });

				// Person link
				const personLink = item.createEl('a', {
					cls: 'crc-schema-violation-person',
					text: result.personName
				});
				personLink.addEventListener('click', (e) => {
					e.preventDefault();
					void this.app.workspace.openLinkText(result.filePath, '');
				});

				// Error count badge
				item.createSpan({
					cls: 'crc-schema-violation-count',
					text: `${result.errors.length} error${result.errors.length > 1 ? 's' : ''}`
				});

				// First error preview
				if (result.errors.length > 0) {
					const firstError = result.errors[0];
					item.createSpan({
						cls: 'crc-schema-violation-preview',
						text: firstError.message
					});
				}
			}

			if (failedResults.length > 5) {
				recentSection.createEl('p', {
					cls: 'crc-text-muted crc-schema-more-link',
					text: `+${failedResults.length - 5} more violations. View all in Schemas tab.`
				});
			}
		}

		// Action buttons
		const actions = section.createDiv({ cls: 'crc-schema-actions' });

		const revalidateBtn = actions.createEl('button', {
			text: 'Re-validate'
		});
		setIcon(revalidateBtn.createSpan({ cls: 'crc-button-icon' }), 'refresh-cw');
		revalidateBtn.addEventListener('click', () => void this.runSchemaValidationFromDataQuality(section));
	}

	/**
	 * Render research gaps section in Data Quality tab
	 * Shows summary of unsourced facts aligned with GPS methodology
	 */
	private renderResearchGapsSection(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'crc-section crc-research-gaps-section' });

		// Header with link to Sources tab
		const header = section.createDiv({ cls: 'crc-section-header' });
		header.createEl('h3', { text: 'Research gaps' });

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
			return;
		}

		// Render initial breakdown and people list
		this.renderResearchGapsBreakdown(section, gaps, 'all');
		this.renderLowestCoveragePeople(section, gaps.lowestCoverage, evidenceService, 'all');
	}

	/**
	 * Render source conflicts section
	 * Shows proofs with conflicting evidence that need resolution
	 */
	private renderSourceConflictsSection(container: HTMLElement): void {
		const proofService = new ProofSummaryService(this.app, this.plugin.settings);
		const conflictedProofs = proofService.getProofsByStatus('conflicted');

		const section = container.createDiv({ cls: 'crc-section crc-conflicts-section' });

		// Header
		const header = section.createDiv({ cls: 'crc-section-header' });
		header.createEl('h3', { text: 'Source conflicts' });

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
				new TemplateSnippetsModal(this.app, 'proof').open();
			});

			return;
		}

		// If no conflicts, show success state
		if (conflictedProofs.length === 0) {
			const successState = section.createDiv({ cls: 'crc-dq-no-issues' });
			const successIcon = successState.createDiv({ cls: 'crc-dq-no-issues-icon' });
			setIcon(successIcon, 'check');
			successState.createSpan({ text: 'No unresolved source conflicts' });
			return;
		}

		// Show conflicted proofs
		const conflictList = section.createDiv({ cls: 'crc-conflicts-list' });

		for (const proof of conflictedProofs) {
			this.renderConflictItem(conflictList, proof);
		}
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
			progressFill.style.width = `${person.coveragePercent}%`;

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

	/**
	 * Run schema validation from Data Quality tab and update section
	 */
	private async runSchemaValidationFromDataQuality(sectionToReplace: HTMLElement): Promise<void> {
		// Show loading state
		sectionToReplace.empty();
		const loading = sectionToReplace.createDiv({ cls: 'crc-loading' });
		loading.createSpan({ text: 'Running schema validation...' });

		try {
			const schemaService = new SchemaService(this.plugin);
			const validationService = new ValidationService(this.plugin, schemaService);

			const results = await validationService.validateVault();
			const summary = validationService.getSummary(results);

			// Store results
			this.lastValidationResults = results;
			this.lastValidationSummary = summary;

			// Clear and re-render the section
			const parent = sectionToReplace.parentElement;
			sectionToReplace.remove();

			if (parent) {
				// Find where to insert (at the beginning after the intro text)
				const firstSection = parent.querySelector('.crc-section');
				if (firstSection) {
					const newSection = document.createElement('div');
					parent.insertBefore(newSection, firstSection);
					this.renderSchemaViolationsSection(newSection.parentElement!);
					newSection.remove();
				} else {
					this.renderSchemaViolationsSection(parent);
				}
			}

			// Calculate passed/failed counts for notice
			const failedResultsCount = new Set(results.filter(r => !r.isValid).map(r => r.filePath)).size;
			const passedResultsCount = summary.totalPeopleValidated - failedResultsCount;
			new Notice(`Schema validation complete: ${passedResultsCount} passed, ${failedResultsCount} failed`);
		} catch (error) {
			sectionToReplace.empty();
			sectionToReplace.createEl('p', {
				cls: 'crc-error',
				text: `Validation failed: ${getErrorMessage(error)}`
			});
		}
	}

	// ==========================================================================
	// RELATIONSHIPS TAB
	// ==========================================================================

	/**
	 * Show Relationships tab with type management and relationship overview
	 */
	private showRelationshipsTab(): void {
		const container = this.contentContainer;
		const relationshipService = new RelationshipService(this.plugin);

		// Relationship Types card
		this.renderRelationshipTypesCard(container, relationshipService);

		// Relationships Overview card
		this.renderRelationshipsOverviewCard(container, relationshipService);

		// Statistics card
		this.renderRelationshipStatsCard(container, relationshipService);
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
			(tabId) => this.showTab(tabId)
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
			(tabId) => this.showTab(tabId)
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
			(tabId) => this.showTab(tabId)
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
			(tabId) => this.showTab(tabId)
		);
	}

	/**
	 * Render Custom Relationship Types management card with table layout
	 */
	private renderRelationshipTypesCard(container: HTMLElement, service: RelationshipService): void {
		const card = this.createCard({
			title: 'Custom relationship types',
			icon: 'link-2'
		});
		const content = card.querySelector('.crc-card__content') as HTMLElement;

		// Toolbar at top: Add button + toggle
		const toolbar = content.createDiv({ cls: 'crc-card-toolbar' });

		const addBtn = toolbar.createEl('button', { cls: 'mod-cta' });
		setIcon(addBtn.createSpan({ cls: 'crc-button-icon' }), 'plus');
		addBtn.createSpan({ text: 'Add type' });
		addBtn.addEventListener('click', () => {
			new Notice('Create relationship type (coming soon)');
		});

		// Toggle built-in visibility
		const toggleContainer = toolbar.createDiv({ cls: 'crc-toggle-inline' });
		const toggleLabel = toggleContainer.createEl('label', { text: 'Show built-in types' });
		const toggle = new ToggleComponent(toggleContainer);
		toggle.setValue(this.plugin.settings.showBuiltInRelationshipTypes);
		toggle.onChange(async (value) => {
			this.plugin.settings.showBuiltInRelationshipTypes = value;
			await this.plugin.saveSettings();
			this.showTab('relationships'); // Refresh the tab properly
		});
		toggleLabel.htmlFor = toggle.toggleEl.id;

		const types = service.getAllRelationshipTypes();

		if (types.length === 0) {
			const emptyMsg = this.plugin.settings.showBuiltInRelationshipTypes
				? 'No relationship types defined.'
				: 'No custom relationship types defined. Toggle "Show built-in types" to see default types.';
			content.createEl('p', {
				cls: 'crc-text-muted',
				text: emptyMsg
			});
		} else {
			// Create table
			const tableContainer = content.createDiv({ cls: 'crc-relationship-types-table-container' });
			const table = tableContainer.createEl('table', { cls: 'crc-relationship-types-table' });

			// Header
			const thead = table.createEl('thead');
			const headerRow = thead.createEl('tr');
			headerRow.createEl('th', { text: 'Type' });
			headerRow.createEl('th', { text: 'Category' });
			headerRow.createEl('th', { text: 'Inverse' });
			headerRow.createEl('th', { text: 'Source' });
			headerRow.createEl('th', { text: '' }); // Actions column

			// Body
			const tbody = table.createEl('tbody');

			for (const type of types) {
				const row = tbody.createEl('tr');

				// Type name with color swatch
				const nameCell = row.createEl('td');
				const nameWrapper = nameCell.createDiv({ cls: 'crc-type-name-wrapper' });
				const swatch = nameWrapper.createDiv({ cls: 'crc-type-swatch' });
				swatch.style.backgroundColor = type.color;
				nameWrapper.createSpan({ text: type.name });

				// Category
				row.createEl('td', { text: RELATIONSHIP_CATEGORY_NAMES[type.category], cls: 'crc-text-muted' });

				// Inverse/symmetric
				const inverseCell = row.createEl('td');
				if (type.symmetric) {
					inverseCell.createSpan({ text: '↔ symmetric', cls: 'crc-text-muted' });
				} else if (type.inverse) {
					inverseCell.createSpan({ text: `→ ${type.inverse}`, cls: 'crc-text-muted' });
				} else {
					inverseCell.createSpan({ text: '—', cls: 'crc-text-muted' });
				}

				// Source (built-in vs custom)
				const sourceCell = row.createEl('td');
				if (type.builtIn) {
					sourceCell.createSpan({ text: 'built-in', cls: 'crc-badge crc-badge--muted' });
				} else {
					sourceCell.createSpan({ text: 'custom', cls: 'crc-badge crc-badge--accent' });
				}

				// Actions (only for custom types)
				const actionsCell = row.createEl('td', { cls: 'crc-type-actions-cell' });
				if (!type.builtIn) {
					const editBtn = actionsCell.createEl('button', { cls: 'crc-icon-button clickable-icon' });
					setIcon(editBtn, 'edit');
					editBtn.setAttribute('aria-label', 'Edit');
					editBtn.addEventListener('click', () => {
						new Notice('Edit relationship type (coming soon)');
					});

					const deleteBtn = actionsCell.createEl('button', { cls: 'crc-icon-button clickable-icon crc-icon-button--danger' });
					setIcon(deleteBtn, 'trash');
					deleteBtn.setAttribute('aria-label', 'Delete');
					deleteBtn.addEventListener('click', () => void (async () => {
						const confirmed = await this.confirmAction(
							'Delete relationship type',
							`Are you sure you want to delete "${type.name}"? This cannot be undone.`
						);
						if (confirmed) {
							try {
								await service.deleteRelationshipType(type.id);
								new Notice(`Deleted relationship type: ${type.name}`);
								void this.showRelationshipsTab();
							} catch (error) {
								new Notice(`Failed to delete: ${getErrorMessage(error)}`);
							}
						}
					})());
				}
			}
		}

		container.appendChild(card);
	}

	/**
	 * Render Custom Relationships card with table of all custom relationships
	 */
	private renderRelationshipsOverviewCard(container: HTMLElement, service: RelationshipService): void {
		const card = this.createCard({
			title: 'Custom relationships',
			icon: 'users'
		});
		const content = card.querySelector('.crc-card__content') as HTMLElement;

		// Loading
		const loading = content.createDiv({ cls: 'crc-loading' });
		loading.createSpan({ text: 'Loading relationships...' });

		try {
			const relationships = service.getAllRelationships();
			const stats = service.getStats();

			loading.remove();

			if (relationships.length === 0) {
				const emptyState = content.createDiv({ cls: 'crc-empty-state' });
				setIcon(emptyState.createSpan({ cls: 'crc-empty-icon' }), 'link-2');
				emptyState.createEl('p', { text: 'No custom relationships found.' });
				emptyState.createEl('p', {
					cls: 'crc-text-muted',
					text: 'Custom relationships (godparent, guardian, mentor, etc.) are defined in person note frontmatter. Standard family links (spouse, parent, child) are handled separately on canvas trees.'
				});
			} else {
				// Summary row
				const summaryRow = content.createDiv({ cls: 'crc-relationship-summary-row' });
				summaryRow.createSpan({
					text: `${stats.totalDefined} defined relationships`,
					cls: 'crc-relationship-stat'
				});
				summaryRow.createSpan({
					text: `${stats.totalInferred} inferred`,
					cls: 'crc-relationship-stat crc-text-muted'
				});
				summaryRow.createSpan({
					text: `${stats.peopleWithRelationships} people`,
					cls: 'crc-relationship-stat'
				});

				// Table
				const tableContainer = content.createDiv({ cls: 'crc-table-container' });
				const table = tableContainer.createEl('table', { cls: 'crc-table' });

				// Header
				const thead = table.createEl('thead');
				const headerRow = thead.createEl('tr');
				headerRow.createEl('th', { text: 'From' });
				headerRow.createEl('th', { text: 'Type' });
				headerRow.createEl('th', { text: 'To' });
				headerRow.createEl('th', { text: 'Dates' });

				// Body
				const tbody = table.createEl('tbody');

				// Limit display to first 50
				const displayRels = relationships.slice(0, 50);
				for (const rel of displayRels) {
					const row = tbody.createEl('tr');
					if (rel.isInferred) {
						row.classList.add('crc-table-row--muted');
					}

					// From
					const fromCell = row.createEl('td');
					const fromLink = fromCell.createEl('a', {
						text: rel.sourceName,
						cls: 'crc-person-link'
					});
					fromLink.addEventListener('click', (e) => {
						e.preventDefault();
						void this.app.workspace.openLinkText(rel.sourceFilePath, '');
					});

					// Type
					const typeCell = row.createEl('td');
					const typeBadge = typeCell.createSpan({ cls: 'crc-relationship-badge' });
					typeBadge.style.backgroundColor = rel.type.color;
					typeBadge.style.color = this.getContrastColor(rel.type.color);
					typeBadge.textContent = rel.type.name;
					if (rel.isInferred) {
						typeCell.createSpan({ text: ' (inferred)', cls: 'crc-text-muted' });
					}

					// To
					const toCell = row.createEl('td');
					if (rel.targetFilePath) {
						const toLink = toCell.createEl('a', {
							text: rel.targetName,
							cls: 'crc-person-link'
						});
						toLink.addEventListener('click', (e) => {
							e.preventDefault();
							void this.app.workspace.openLinkText(rel.targetFilePath!, '');
						});
					} else {
						toCell.createSpan({ text: rel.targetName, cls: 'crc-text-muted' });
					}

					// Dates
					const datesCell = row.createEl('td');
					const dateParts: string[] = [];
					if (rel.from) dateParts.push(rel.from);
					if (rel.to) dateParts.push(rel.to);
					datesCell.textContent = dateParts.length > 0 ? dateParts.join(' – ') : '—';
				}

				if (relationships.length > 50) {
					content.createEl('p', {
						cls: 'crc-text-muted',
						text: `Showing 50 of ${relationships.length} relationships.`
					});
				}
			}
		} catch (error) {
			loading.remove();
			content.createEl('p', {
				cls: 'crc-error',
				text: `Failed to load relationships: ${getErrorMessage(error)}`
			});
		}

		container.appendChild(card);
	}

	/**
	 * Render Relationship Statistics card
	 */
	private renderRelationshipStatsCard(container: HTMLElement, service: RelationshipService): void {
		const card = this.createCard({
			title: 'Statistics',
			icon: 'bar-chart'
		});
		const content = card.querySelector('.crc-card__content') as HTMLElement;

		try {
			const stats = service.getStats();

			if (stats.totalDefined === 0) {
				content.createEl('p', {
					cls: 'crc-text-muted',
					text: 'No relationship statistics available yet.'
				});
			} else {
				// By Type
				const byTypeSection = content.createDiv({ cls: 'crc-stats-section' });
				byTypeSection.createEl('h4', { text: 'By type', cls: 'crc-section-subtitle' });

				const typeList = byTypeSection.createDiv({ cls: 'crc-stats-list' });
				const sortedTypes = Object.entries(stats.byType)
					.sort((a, b) => b[1] - a[1])
					.slice(0, 10);

				for (const [typeId, count] of sortedTypes) {
					const typeDef = service.getRelationshipType(typeId);
					const item = typeList.createDiv({ cls: 'crc-stats-item' });

					const swatch = item.createSpan({ cls: 'crc-stats-swatch' });
					swatch.style.backgroundColor = typeDef?.color || '#666';

					item.createSpan({ text: typeDef?.name || typeId, cls: 'crc-stats-label' });
					item.createSpan({ text: count.toString(), cls: 'crc-stats-value' });
				}

				// By Category
				const byCatSection = content.createDiv({ cls: 'crc-stats-section' });
				byCatSection.createEl('h4', { text: 'By category', cls: 'crc-section-subtitle' });

				const catList = byCatSection.createDiv({ cls: 'crc-stats-list' });
				for (const [cat, count] of Object.entries(stats.byCategory)) {
					if (count > 0) {
						const item = catList.createDiv({ cls: 'crc-stats-item' });
						item.createSpan({
							text: RELATIONSHIP_CATEGORY_NAMES[cat as RelationshipCategory],
							cls: 'crc-stats-label'
						});
						item.createSpan({ text: count.toString(), cls: 'crc-stats-value' });
					}
				}
			}
		} catch (error) {
			content.createEl('p', {
				cls: 'crc-error',
				text: `Failed to load statistics: ${getErrorMessage(error)}`
			});
		}

		container.appendChild(card);
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

		// Shared folder configuration card
		const folderCard = this.createCard({
			title: 'Folder configuration',
			icon: 'folder'
		});
		const folderContent = folderCard.querySelector('.crc-card__content') as HTMLElement;
		this.renderFolderConfigInline(folderContent);
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
	 * Render inline folder configuration (non-collapsible version)
	 */
	private renderFolderConfigInline(container: HTMLElement): void {
		// People folder setting
		new Setting(container)
			.setName('People folder')
			.setDesc('Where person notes are stored')
			.addText(text => text
				.setPlaceholder('People')
				.setValue(this.plugin.settings.peopleFolder)
				.onChange(async value => {
					this.plugin.settings.peopleFolder = value;
					await this.plugin.saveSettings();
				})
			);

		// Staging folder setting
		new Setting(container)
			.setName('Staging folder')
			.setDesc('Optional folder for reviewing imports before promoting')
			.addText(text => text
				.setPlaceholder('People-Staging')
				.setValue(this.plugin.settings.stagingFolder || '')
				.onChange(async value => {
					this.plugin.settings.stagingFolder = value;
					await this.plugin.saveSettings();
				})
			);
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
			text: 'Import creates person notes for all individuals in your GEDCOM file',
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
					// Determine target folder based on import destination
					let targetFolder: string;
					if (importDestination === 'staging' && stagingFolder) {
						targetFolder = stagingSubfolder
							? `${stagingFolder}/${stagingSubfolder}`
							: stagingFolder;
					} else {
						targetFolder = this.plugin.settings.peopleFolder;
					}
					await this.showGedcomAnalysis(file, analysisContainer, fileBtn, targetFolder);
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

		// Export options
		new Setting(content)
			.setName('People folder')
			.setDesc('Folder containing person notes to export')
			.addText(text => text
				.setPlaceholder('People')
				.setValue(this.plugin.settings.peopleFolder)
				.setDisabled(true)
			);

		// Collection filter option
		let collectionFilter: string | undefined;
		new Setting(content)
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
					collectionFilter = value || undefined;
				});
			});

		// Branch filter options
		let branchRootCrId: string | undefined;
		let branchDirection: 'ancestors' | 'descendants' | undefined;
		let branchIncludeSpouses = false;

		new Setting(content)
			.setName('Branch filter (optional)')
			.setDesc('Export only ancestors or descendants of a specific person')
			.addButton(btn => {
				btn.setButtonText('Select person')
					.onClick(() => {
						const picker = new PersonPickerModal(this.app, (info) => {
							branchRootCrId = info.crId;
							btn.setButtonText(info.name);
						});
						picker.open();
					});
			});

		new Setting(content)
			.setName('Branch direction')
			.setDesc('Include ancestors (up) or descendants (down)')
			.addDropdown(dropdown => {
				dropdown.addOption('', 'No branch filter');
				dropdown.addOption('ancestors', 'Ancestors only');
				dropdown.addOption('descendants', 'Descendants only');
				dropdown.onChange(value => {
					branchDirection = value as 'ancestors' | 'descendants' || undefined;
				});
			});

		new Setting(content)
			.setName('Include spouses in descendants')
			.setDesc('When exporting descendants, also include their spouses')
			.addToggle(toggle => toggle
				.setValue(false)
				.onChange(value => {
					branchIncludeSpouses = value;
				})
			);

		// Include collection codes option
		let includeCollectionCodes = true;
		new Setting(content)
			.setName('Include collection codes')
			.setDesc('Preserve Canvas Roots collection data in export')
			.addToggle(toggle => toggle
				.setValue(true)
				.onChange(value => {
					includeCollectionCodes = value;
				})
			);

		// Privacy override options
		let privacyOverrideEnabled = false;
		let privacyOverrideProtection = this.plugin.settings.enablePrivacyProtection;
		let privacyOverrideFormat: 'living' | 'private' | 'initials' | 'hidden' = this.plugin.settings.privacyDisplayFormat;

		// Define updatePrivacyPreview before the settings that use it
		let updatePrivacyPreview: () => Promise<void>;

		new Setting(content)
			.setName('Override privacy settings')
			.setDesc('Use different privacy settings for this export only')
			.addToggle(toggle => toggle
				.setValue(false)
				.onChange(value => {
					privacyOverrideEnabled = value;
					privacyProtectionSetting.settingEl.toggleClass('cr-hidden', !value);
					privacyFormatSetting.settingEl.toggleClass('cr-hidden', !(value && privacyOverrideProtection));
					void updatePrivacyPreview();
				})
			);

		const privacyProtectionSetting = new Setting(content)
			.setName('Enable privacy protection')
			.setDesc('Protect living persons in this export')
			.addToggle(toggle => toggle
				.setValue(privacyOverrideProtection)
				.onChange(value => {
					privacyOverrideProtection = value;
					privacyFormatSetting.settingEl.toggleClass('cr-hidden', !value);
					void updatePrivacyPreview();
				})
			);
		privacyProtectionSetting.settingEl.addClass('cr-hidden');

		const privacyFormatSetting = new Setting(content)
			.setName('Privacy display format')
			.setDesc('How to display protected living persons')
			.addDropdown(dropdown => dropdown
				.addOption('living', 'Living')
				.addOption('private', 'Private')
				.addOption('initials', 'Initials only')
				.addOption('hidden', 'Exclude from export')
				.setValue(privacyOverrideFormat)
				.onChange(value => {
					privacyOverrideFormat = value as 'living' | 'private' | 'initials' | 'hidden';
					void updatePrivacyPreview();
				})
			);
		privacyFormatSetting.settingEl.addClass('cr-hidden');

		// Privacy preview section
		const privacyPreviewEl = content.createDiv({ cls: 'crc-privacy-preview crc-mb-4 cr-hidden' });

		updatePrivacyPreview = async (): Promise<void> => {
			const effectiveProtection = privacyOverrideEnabled
				? privacyOverrideProtection
				: this.plugin.settings.enablePrivacyProtection;
			const effectiveFormat = privacyOverrideEnabled
				? privacyOverrideFormat
				: this.plugin.settings.privacyDisplayFormat;

			if (!effectiveProtection) {
				privacyPreviewEl.addClass('cr-hidden');
				return;
			}

			// Load people and calculate privacy summary
			const { FamilyGraphService } = await import('../core/family-graph');
			const { PrivacyService } = await import('../core/privacy-service');

			const graphService = new FamilyGraphService(this.app);
			graphService.setFolderFilter(new (await import('../core/folder-filter')).FolderFilterService(this.plugin.settings));
			graphService.setPropertyAliases(this.plugin.settings.propertyAliases);
			graphService.setValueAliases(this.plugin.settings.valueAliases);
			graphService.reloadCache();
			const allPeople = graphService.getAllPeople();

			const privacyService = new PrivacyService({
				enablePrivacyProtection: effectiveProtection,
				livingPersonAgeThreshold: this.plugin.settings.livingPersonAgeThreshold,
				privacyDisplayFormat: effectiveFormat,
				hideDetailsForLiving: this.plugin.settings.hideDetailsForLiving
			});

			const summary = privacyService.getPrivacySummary(allPeople);

			privacyPreviewEl.empty();
			privacyPreviewEl.removeClass('cr-hidden');

			const previewText = effectiveFormat === 'hidden'
				? `${summary.excluded} of ${summary.total} people will be excluded (living)`
				: `${summary.protected} of ${summary.total} people will be obfuscated (living)`;

			privacyPreviewEl.createEl('span', {
				text: previewText,
				cls: 'crc-text-muted crc-text-sm'
			});
		};

		// Initial preview based on global settings
		void updatePrivacyPreview();

		// Export file name
		let exportFileName = 'family-tree';
		new Setting(content)
			.setName('Export file name')
			.setDesc('Name for the exported .ged file (without extension)')
			.addText(text => text
				.setPlaceholder('family-tree')
				.setValue(exportFileName)
				.onChange(value => {
					exportFileName = value || 'family-tree';
				})
			);

		// Export button
		const exportBtn = content.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-mt-4',
			text: 'Export to GEDCOM'
		});

		exportBtn.addEventListener('click', () => {
			void (async () => {
				await this.handleGedcomExport({
					fileName: exportFileName,
					collectionFilter,
					includeCollectionCodes,
					branchRootCrId,
					branchDirection,
					branchIncludeSpouses,
					privacyOverride: privacyOverrideEnabled ? {
						enablePrivacyProtection: privacyOverrideProtection,
						privacyDisplayFormat: privacyOverrideFormat
					} : undefined
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

			const importer = new GedcomXImporter(this.app);
			const result = await importer.importFile(content, {
				peopleFolder: destFolder,
				overwriteExisting: false,
				fileName: file.name
			});

			// Show results notification
			this.showGedcomXImportResults(result);

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

		// Export options
		new Setting(content)
			.setName('People folder')
			.setDesc('Folder containing person notes to export')
			.addText(text => text
				.setPlaceholder('People')
				.setValue(this.plugin.settings.peopleFolder)
				.setDisabled(true)
			);

		// Collection filter option
		let collectionFilter: string | undefined;
		new Setting(content)
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
					collectionFilter = value || undefined;
				});
			});

		// Branch filter options
		let gxBranchRootCrId: string | undefined;
		let gxBranchDirection: 'ancestors' | 'descendants' | undefined;
		let gxBranchIncludeSpouses = false;

		new Setting(content)
			.setName('Branch filter (optional)')
			.setDesc('Export only ancestors or descendants of a specific person')
			.addButton(btn => {
				btn.setButtonText('Select person')
					.onClick(() => {
						const picker = new PersonPickerModal(this.app, (info) => {
							gxBranchRootCrId = info.crId;
							btn.setButtonText(info.name);
						});
						picker.open();
					});
			});

		new Setting(content)
			.setName('Branch direction')
			.setDesc('Include ancestors (up) or descendants (down)')
			.addDropdown(dropdown => {
				dropdown.addOption('', 'No branch filter');
				dropdown.addOption('ancestors', 'Ancestors only');
				dropdown.addOption('descendants', 'Descendants only');
				dropdown.onChange(value => {
					gxBranchDirection = value as 'ancestors' | 'descendants' || undefined;
				});
			});

		new Setting(content)
			.setName('Include spouses in descendants')
			.setDesc('When exporting descendants, also include their spouses')
			.addToggle(toggle => toggle
				.setValue(false)
				.onChange(value => {
					gxBranchIncludeSpouses = value;
				})
			);

		// Privacy override options
		let gxPrivacyOverrideEnabled = false;
		let gxPrivacyOverrideProtection = this.plugin.settings.enablePrivacyProtection;
		let gxPrivacyOverrideFormat: 'living' | 'private' | 'initials' | 'hidden' = this.plugin.settings.privacyDisplayFormat;

		// Define updateGxPrivacyPreview before the settings that use it
		let updateGxPrivacyPreview: () => Promise<void>;

		new Setting(content)
			.setName('Override privacy settings')
			.setDesc('Use different privacy settings for this export only')
			.addToggle(toggle => toggle
				.setValue(false)
				.onChange(value => {
					gxPrivacyOverrideEnabled = value;
					gxPrivacyProtectionSetting.settingEl.toggleClass('cr-hidden', !value);
					gxPrivacyFormatSetting.settingEl.toggleClass('cr-hidden', !(value && gxPrivacyOverrideProtection));
					void updateGxPrivacyPreview();
				})
			);

		const gxPrivacyProtectionSetting = new Setting(content)
			.setName('Enable privacy protection')
			.setDesc('Protect living persons in this export')
			.addToggle(toggle => toggle
				.setValue(gxPrivacyOverrideProtection)
				.onChange(value => {
					gxPrivacyOverrideProtection = value;
					gxPrivacyFormatSetting.settingEl.toggleClass('cr-hidden', !value);
					void updateGxPrivacyPreview();
				})
			);
		gxPrivacyProtectionSetting.settingEl.addClass('cr-hidden');

		const gxPrivacyFormatSetting = new Setting(content)
			.setName('Privacy display format')
			.setDesc('How to display protected living persons')
			.addDropdown(dropdown => dropdown
				.addOption('living', 'Living')
				.addOption('private', 'Private')
				.addOption('initials', 'Initials only')
				.addOption('hidden', 'Exclude from export')
				.setValue(gxPrivacyOverrideFormat)
				.onChange(value => {
					gxPrivacyOverrideFormat = value as 'living' | 'private' | 'initials' | 'hidden';
					void updateGxPrivacyPreview();
				})
			);
		gxPrivacyFormatSetting.settingEl.addClass('cr-hidden');

		// Privacy preview section
		const gxPrivacyPreviewEl = content.createDiv({ cls: 'crc-privacy-preview crc-mb-4 cr-hidden' });

		updateGxPrivacyPreview = async (): Promise<void> => {
			const effectiveProtection = gxPrivacyOverrideEnabled
				? gxPrivacyOverrideProtection
				: this.plugin.settings.enablePrivacyProtection;
			const effectiveFormat = gxPrivacyOverrideEnabled
				? gxPrivacyOverrideFormat
				: this.plugin.settings.privacyDisplayFormat;

			if (!effectiveProtection) {
				gxPrivacyPreviewEl.addClass('cr-hidden');
				return;
			}

			const { FamilyGraphService } = await import('../core/family-graph');
			const { PrivacyService } = await import('../core/privacy-service');

			const graphService = new FamilyGraphService(this.app);
			graphService.setFolderFilter(new (await import('../core/folder-filter')).FolderFilterService(this.plugin.settings));
			graphService.setPropertyAliases(this.plugin.settings.propertyAliases);
			graphService.setValueAliases(this.plugin.settings.valueAliases);
			graphService.reloadCache();
			const allPeople = graphService.getAllPeople();

			const privacyService = new PrivacyService({
				enablePrivacyProtection: effectiveProtection,
				livingPersonAgeThreshold: this.plugin.settings.livingPersonAgeThreshold,
				privacyDisplayFormat: effectiveFormat,
				hideDetailsForLiving: this.plugin.settings.hideDetailsForLiving
			});

			const summary = privacyService.getPrivacySummary(allPeople);

			gxPrivacyPreviewEl.empty();
			gxPrivacyPreviewEl.removeClass('cr-hidden');

			const previewText = effectiveFormat === 'hidden'
				? `${summary.excluded} of ${summary.total} people will be excluded (living)`
				: `${summary.protected} of ${summary.total} people will be obfuscated (living)`;

			gxPrivacyPreviewEl.createEl('span', {
				text: previewText,
				cls: 'crc-text-muted crc-text-sm'
			});
		};

		// Initial preview based on global settings
		void updateGxPrivacyPreview();

		// Export file name
		let gxExportFileName = 'family-tree';
		new Setting(content)
			.setName('Export file name')
			.setDesc('Name for the exported .json file (without extension)')
			.addText(text => text
				.setPlaceholder('family-tree')
				.setValue(gxExportFileName)
				.onChange(value => {
					gxExportFileName = value || 'family-tree';
				})
			);

		// Export button
		const exportBtn = content.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-mt-4',
			text: 'Export to GEDCOM X'
		});

		exportBtn.addEventListener('click', () => {
			void (async () => {
				await this.handleGedcomXExport({
					fileName: gxExportFileName,
					collectionFilter,
					branchRootCrId: gxBranchRootCrId,
					branchDirection: gxBranchDirection,
					branchIncludeSpouses: gxBranchIncludeSpouses,
					privacyOverride: gxPrivacyOverrideEnabled ? {
						enablePrivacyProtection: gxPrivacyOverrideProtection,
						privacyDisplayFormat: gxPrivacyOverrideFormat
					} : undefined
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
	}): Promise<void> {
		try {
			logger.info('gedcomx-export', `Starting GEDCOM X export: ${options.fileName}`);

			// Create exporter
			const { GedcomXExporter } = await import('../gedcomx/gedcomx-exporter');
			const exporter = new GedcomXExporter(this.app);

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

			if (result.success && result.jsonContent) {
				// Create blob and trigger download
				const blob = new Blob([result.jsonContent], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${result.fileName}.json`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);

				let noticeMsg = `GEDCOM X exported: ${result.personsExported} people, ${result.relationshipsExported} relationships`;
				if (result.privacyExcluded && result.privacyExcluded > 0) {
					noticeMsg += ` (${result.privacyExcluded} living excluded)`;
				} else if (result.privacyObfuscated && result.privacyObfuscated > 0) {
					noticeMsg += ` (${result.privacyObfuscated} living obfuscated)`;
				}
				new Notice(noticeMsg);
			} else {
				throw new Error('Export failed to generate content');
			}
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('gedcomx-export', `GEDCOM X export failed: ${errorMsg}`);
			new Notice(`Failed to export GEDCOM X: ${errorMsg}`);
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
			const content = await file.text();

			// Validate it's a Gramps XML file
			if (!GrampsParser.isGrampsXml(content)) {
				analysisContainer.empty();
				analysisContainer.createEl('p', {
					text: 'This file does not appear to be a valid Gramps XML file.',
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
				void this.handleGrampsImport(file, targetFolder);
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
	private async handleGrampsImport(file: File, destFolder: string): Promise<void> {
		try {
			const content = await file.text();

			logger.info('gramps', `Starting Gramps import: ${file.name} to ${destFolder}`);

			const importer = new GrampsImporter(this.app);
			const result = await importer.importFile(content, {
				peopleFolder: destFolder,
				overwriteExisting: false,
				fileName: file.name
			});

			// Show results notification
			this.showGrampsImportResults(result);

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
			logger.error('gramps', `Gramps import failed: ${errorMsg}`);
			new Notice(`Import failed: ${errorMsg}`);
		}
	}

	/**
	 * Show Gramps XML import results
	 */
	private showGrampsImportResults(result: GrampsImportResult): void {
		new Notice(
			`Gramps import complete: ${result.individualsImported} people imported` +
			(result.errors.length > 0 ? ` (${result.errors.length} errors)` : ''),
			5000
		);

		// Log detailed results
		logger.info('gramps', 'Import results:', {
			imported: result.individualsImported,
			created: result.notesCreated,
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

		// Export options
		new Setting(content)
			.setName('People folder')
			.setDesc('Folder containing person notes to export')
			.addText(text => text
				.setPlaceholder('People')
				.setValue(this.plugin.settings.peopleFolder)
				.setDisabled(true)
			);

		// Collection filter option
		let collectionFilter: string | undefined;
		new Setting(content)
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
					collectionFilter = value || undefined;
				});
			});

		// Branch filter options
		let grampsBranchRootCrId: string | undefined;
		let grampsBranchDirection: 'ancestors' | 'descendants' | undefined;
		let grampsBranchIncludeSpouses = false;

		new Setting(content)
			.setName('Branch filter (optional)')
			.setDesc('Export only ancestors or descendants of a specific person')
			.addButton(btn => {
				btn.setButtonText('Select person')
					.onClick(() => {
						const picker = new PersonPickerModal(this.app, (info) => {
							grampsBranchRootCrId = info.crId;
							btn.setButtonText(info.name);
						});
						picker.open();
					});
			});

		new Setting(content)
			.setName('Branch direction')
			.setDesc('Include ancestors (up) or descendants (down)')
			.addDropdown(dropdown => {
				dropdown.addOption('', 'No branch filter');
				dropdown.addOption('ancestors', 'Ancestors only');
				dropdown.addOption('descendants', 'Descendants only');
				dropdown.onChange(value => {
					grampsBranchDirection = value as 'ancestors' | 'descendants' || undefined;
				});
			});

		new Setting(content)
			.setName('Include spouses in descendants')
			.setDesc('When exporting descendants, also include their spouses')
			.addToggle(toggle => toggle
				.setValue(false)
				.onChange(value => {
					grampsBranchIncludeSpouses = value;
				})
			);

		// Privacy override options
		let grampsPrivacyOverrideEnabled = false;
		let grampsPrivacyOverrideProtection = this.plugin.settings.enablePrivacyProtection;
		let grampsPrivacyOverrideFormat: 'living' | 'private' | 'initials' | 'hidden' = this.plugin.settings.privacyDisplayFormat;

		// Define updateGrampsPrivacyPreview before the settings that use it
		let updateGrampsPrivacyPreview: () => Promise<void>;

		new Setting(content)
			.setName('Override privacy settings')
			.setDesc('Use different privacy settings for this export only')
			.addToggle(toggle => toggle
				.setValue(false)
				.onChange(value => {
					grampsPrivacyOverrideEnabled = value;
					grampsPrivacyProtectionSetting.settingEl.toggleClass('cr-hidden', !value);
					grampsPrivacyFormatSetting.settingEl.toggleClass('cr-hidden', !(value && grampsPrivacyOverrideProtection));
					void updateGrampsPrivacyPreview();
				})
			);

		const grampsPrivacyProtectionSetting = new Setting(content)
			.setName('Enable privacy protection')
			.setDesc('Protect living persons in this export')
			.addToggle(toggle => toggle
				.setValue(grampsPrivacyOverrideProtection)
				.onChange(value => {
					grampsPrivacyOverrideProtection = value;
					grampsPrivacyFormatSetting.settingEl.toggleClass('cr-hidden', !value);
					void updateGrampsPrivacyPreview();
				})
			);
		grampsPrivacyProtectionSetting.settingEl.addClass('cr-hidden');

		const grampsPrivacyFormatSetting = new Setting(content)
			.setName('Privacy display format')
			.setDesc('How to display protected living persons')
			.addDropdown(dropdown => dropdown
				.addOption('living', 'Living')
				.addOption('private', 'Private')
				.addOption('initials', 'Initials only')
				.addOption('hidden', 'Exclude from export')
				.setValue(grampsPrivacyOverrideFormat)
				.onChange(value => {
					grampsPrivacyOverrideFormat = value as 'living' | 'private' | 'initials' | 'hidden';
					void updateGrampsPrivacyPreview();
				})
			);
		grampsPrivacyFormatSetting.settingEl.addClass('cr-hidden');

		// Privacy preview section
		const grampsPrivacyPreviewEl = content.createDiv({ cls: 'crc-privacy-preview crc-mb-4 cr-hidden' });

		updateGrampsPrivacyPreview = async (): Promise<void> => {
			const effectiveProtection = grampsPrivacyOverrideEnabled
				? grampsPrivacyOverrideProtection
				: this.plugin.settings.enablePrivacyProtection;
			const effectiveFormat = grampsPrivacyOverrideEnabled
				? grampsPrivacyOverrideFormat
				: this.plugin.settings.privacyDisplayFormat;

			if (!effectiveProtection) {
				grampsPrivacyPreviewEl.addClass('cr-hidden');
				return;
			}

			const { FamilyGraphService } = await import('../core/family-graph');
			const { PrivacyService } = await import('../core/privacy-service');

			const graphService = new FamilyGraphService(this.app);
			graphService.setFolderFilter(new (await import('../core/folder-filter')).FolderFilterService(this.plugin.settings));
			graphService.setPropertyAliases(this.plugin.settings.propertyAliases);
			graphService.setValueAliases(this.plugin.settings.valueAliases);
			graphService.reloadCache();
			const allPeople = graphService.getAllPeople();

			const privacyService = new PrivacyService({
				enablePrivacyProtection: effectiveProtection,
				livingPersonAgeThreshold: this.plugin.settings.livingPersonAgeThreshold,
				privacyDisplayFormat: effectiveFormat,
				hideDetailsForLiving: this.plugin.settings.hideDetailsForLiving
			});

			const summary = privacyService.getPrivacySummary(allPeople);

			grampsPrivacyPreviewEl.empty();
			grampsPrivacyPreviewEl.removeClass('cr-hidden');

			const previewText = effectiveFormat === 'hidden'
				? `${summary.excluded} of ${summary.total} people will be excluded (living)`
				: `${summary.protected} of ${summary.total} people will be obfuscated (living)`;

			grampsPrivacyPreviewEl.createEl('span', {
				text: previewText,
				cls: 'crc-text-muted crc-text-sm'
			});
		};

		// Initial preview based on global settings
		void updateGrampsPrivacyPreview();

		// Export file name
		let grampsExportFileName = 'family-tree';
		new Setting(content)
			.setName('Export file name')
			.setDesc('Name for the exported .gramps file (without extension)')
			.addText(text => text
				.setPlaceholder('family-tree')
				.setValue(grampsExportFileName)
				.onChange(value => {
					grampsExportFileName = value || 'family-tree';
				})
			);

		// Export button
		const exportBtn = content.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-mt-4',
			text: 'Export to Gramps'
		});

		exportBtn.addEventListener('click', () => {
			void (async () => {
				await this.handleGrampsExport({
					fileName: grampsExportFileName,
					collectionFilter,
					branchRootCrId: grampsBranchRootCrId,
					branchDirection: grampsBranchDirection,
					branchIncludeSpouses: grampsBranchIncludeSpouses,
					privacyOverride: grampsPrivacyOverrideEnabled ? {
						enablePrivacyProtection: grampsPrivacyOverrideProtection,
						privacyDisplayFormat: grampsPrivacyOverrideFormat
					} : undefined
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
	}): Promise<void> {
		try {
			logger.info('gramps-export', `Starting Gramps export: ${options.fileName}`);

			// Create exporter
			const { GrampsExporter } = await import('../gramps/gramps-exporter');
			const exporter = new GrampsExporter(this.app);

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

			if (result.success && result.xmlContent) {
				// Create blob and trigger download
				const blob = new Blob([result.xmlContent], { type: 'application/xml' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${result.fileName}.gramps`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);

				let noticeMsg = `Gramps exported: ${result.personsExported} people, ${result.familiesExported} families`;
				if (result.privacyExcluded && result.privacyExcluded > 0) {
					noticeMsg += ` (${result.privacyExcluded} living excluded)`;
				} else if (result.privacyObfuscated && result.privacyObfuscated > 0) {
					noticeMsg += ` (${result.privacyObfuscated} living obfuscated)`;
				}
				new Notice(noticeMsg);
			} else {
				throw new Error('Export failed to generate content');
			}
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('gramps-export', `Gramps export failed: ${errorMsg}`);
			new Notice(`Failed to export Gramps: ${errorMsg}`);
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

		// Export options
		new Setting(content)
			.setName('People folder')
			.setDesc('Folder containing person notes to export')
			.addText(text => text
				.setPlaceholder('People')
				.setValue(this.plugin.settings.peopleFolder)
				.setDisabled(true)
			);

		// Collection filter option
		let collectionFilter: string | undefined;
		new Setting(content)
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
					collectionFilter = value || undefined;
				});
			});

		// Branch filter options for CSV
		let csvBranchRootCrId: string | undefined;
		let csvBranchDirection: 'ancestors' | 'descendants' | undefined;
		let csvBranchIncludeSpouses = false;

		new Setting(content)
			.setName('Branch filter (optional)')
			.setDesc('Export only ancestors or descendants of a specific person')
			.addButton(btn => {
				btn.setButtonText('Select person')
					.onClick(() => {
						const picker = new PersonPickerModal(this.app, (info) => {
							csvBranchRootCrId = info.crId;
							btn.setButtonText(info.name);
						});
						picker.open();
					});
			});

		new Setting(content)
			.setName('Branch direction')
			.setDesc('Include ancestors (up) or descendants (down)')
			.addDropdown(dropdown => {
				dropdown.addOption('', 'No branch filter');
				dropdown.addOption('ancestors', 'Ancestors only');
				dropdown.addOption('descendants', 'Descendants only');
				dropdown.onChange(value => {
					csvBranchDirection = value as 'ancestors' | 'descendants' || undefined;
				});
			});

		new Setting(content)
			.setName('Include spouses in descendants')
			.setDesc('When exporting descendants, also include their spouses')
			.addToggle(toggle => toggle
				.setValue(false)
				.onChange(value => {
					csvBranchIncludeSpouses = value;
				})
			);

		// Privacy override options for CSV
		let csvPrivacyOverrideEnabled = false;
		let csvPrivacyOverrideProtection = this.plugin.settings.enablePrivacyProtection;
		let csvPrivacyOverrideFormat: 'living' | 'private' | 'initials' | 'hidden' = this.plugin.settings.privacyDisplayFormat;

		// Define updateCsvPrivacyPreview before the settings that use it
		let updateCsvPrivacyPreview: () => Promise<void>;

		new Setting(content)
			.setName('Override privacy settings')
			.setDesc('Use different privacy settings for this export only')
			.addToggle(toggle => toggle
				.setValue(false)
				.onChange(value => {
					csvPrivacyOverrideEnabled = value;
					csvPrivacyProtectionSetting.settingEl.toggleClass('cr-hidden', !value);
					csvPrivacyFormatSetting.settingEl.toggleClass('cr-hidden', !(value && csvPrivacyOverrideProtection));
					void updateCsvPrivacyPreview();
				})
			);

		const csvPrivacyProtectionSetting = new Setting(content)
			.setName('Enable privacy protection')
			.setDesc('Protect living persons in this export')
			.addToggle(toggle => toggle
				.setValue(csvPrivacyOverrideProtection)
				.onChange(value => {
					csvPrivacyOverrideProtection = value;
					csvPrivacyFormatSetting.settingEl.toggleClass('cr-hidden', !value);
					void updateCsvPrivacyPreview();
				})
			);
		csvPrivacyProtectionSetting.settingEl.addClass('cr-hidden');

		const csvPrivacyFormatSetting = new Setting(content)
			.setName('Privacy display format')
			.setDesc('How to display protected living persons')
			.addDropdown(dropdown => dropdown
				.addOption('living', 'Living')
				.addOption('private', 'Private')
				.addOption('initials', 'Initials only')
				.addOption('hidden', 'Exclude from export')
				.setValue(csvPrivacyOverrideFormat)
				.onChange(value => {
					csvPrivacyOverrideFormat = value as 'living' | 'private' | 'initials' | 'hidden';
					void updateCsvPrivacyPreview();
				})
			);
		csvPrivacyFormatSetting.settingEl.addClass('cr-hidden');

		// Privacy preview section for CSV
		const csvPrivacyPreviewEl = content.createDiv({ cls: 'crc-privacy-preview crc-mb-4 cr-hidden' });

		updateCsvPrivacyPreview = async (): Promise<void> => {
			const effectiveProtection = csvPrivacyOverrideEnabled
				? csvPrivacyOverrideProtection
				: this.plugin.settings.enablePrivacyProtection;
			const effectiveFormat = csvPrivacyOverrideEnabled
				? csvPrivacyOverrideFormat
				: this.plugin.settings.privacyDisplayFormat;

			if (!effectiveProtection) {
				csvPrivacyPreviewEl.addClass('cr-hidden');
				return;
			}

			// Load people and calculate privacy summary
			const { FamilyGraphService } = await import('../core/family-graph');
			const { PrivacyService } = await import('../core/privacy-service');

			const graphService = new FamilyGraphService(this.app);
			graphService.setFolderFilter(new (await import('../core/folder-filter')).FolderFilterService(this.plugin.settings));
			graphService.setPropertyAliases(this.plugin.settings.propertyAliases);
			graphService.setValueAliases(this.plugin.settings.valueAliases);
			graphService.reloadCache();
			const allPeople = graphService.getAllPeople();

			const privacyService = new PrivacyService({
				enablePrivacyProtection: effectiveProtection,
				livingPersonAgeThreshold: this.plugin.settings.livingPersonAgeThreshold,
				privacyDisplayFormat: effectiveFormat,
				hideDetailsForLiving: this.plugin.settings.hideDetailsForLiving
			});

			const summary = privacyService.getPrivacySummary(allPeople);

			csvPrivacyPreviewEl.empty();
			csvPrivacyPreviewEl.removeClass('cr-hidden');

			const previewText = effectiveFormat === 'hidden'
				? `${summary.excluded} of ${summary.total} people will be excluded (living)`
				: `${summary.protected} of ${summary.total} people will be obfuscated (living)`;

			csvPrivacyPreviewEl.createEl('span', {
				text: previewText,
				cls: 'crc-text-muted crc-text-sm'
			});
		};

		// Initial preview based on global settings
		void updateCsvPrivacyPreview();

		// Export file name
		let exportFileName = 'family-tree';
		new Setting(content)
			.setName('Export file name')
			.setDesc('Name for the exported .csv file (without extension)')
			.addText(text => text
				.setPlaceholder('family-tree')
				.setValue(exportFileName)
				.onChange(value => {
					exportFileName = value || 'family-tree';
				})
			);

		// Export button
		const exportBtn = content.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-mt-4',
			text: 'Export to CSV'
		});

		exportBtn.addEventListener('click', () => {
			void (async () => {
				await this.handleCsvExport({
					fileName: exportFileName,
					collectionFilter,
					branchRootCrId: csvBranchRootCrId,
					branchDirection: csvBranchDirection,
					branchIncludeSpouses: csvBranchIncludeSpouses,
					privacyOverride: csvPrivacyOverrideEnabled ? {
						enablePrivacyProtection: csvPrivacyOverrideProtection,
						privacyDisplayFormat: csvPrivacyOverrideFormat
					} : undefined
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

			// Create importer
			const { CsvImporter } = await import('../csv/csv-importer');
			const importer = new CsvImporter(this.app);

			// Import CSV file
			const result = await importer.importFile(content, {
				peopleFolder: destFolder,
				overwriteExisting: false,
				fileName: file.name,
				parseOptions
			});

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
	}): Promise<void> {
		try {
			logger.info('csv-export', `Starting CSV export: ${options.fileName}`);

			// Create exporter
			const { CsvExporter } = await import('../csv/csv-exporter');
			const exporter = new CsvExporter(this.app);

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

			if (result.success && result.csvContent) {
				// Create blob and trigger download
				const blob = new Blob([result.csvContent], { type: 'text/csv;charset=utf-8' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${result.fileName}.csv`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);

				let noticeMsg = `CSV exported: ${result.recordsExported} people`;
				if (result.privacyExcluded && result.privacyExcluded > 0) {
					noticeMsg += ` (${result.privacyExcluded} living excluded)`;
				} else if (result.privacyObfuscated && result.privacyObfuscated > 0) {
					noticeMsg += ` (${result.privacyObfuscated} living obfuscated)`;
				}
				new Notice(noticeMsg);
			} else {
				throw new Error('Export failed to generate content');
			}
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('csv-export', `CSV export failed: ${errorMsg}`);
			new Notice(`Failed to export CSV: ${errorMsg}`);
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
	 * Extract person info from file (for inline person browser)
	 */
	private extractPersonInfoFromFile(file: TFile): PersonInfo | null {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) return null;

		const crId = cache.frontmatter.cr_id;
		if (!crId) return null;

		const fm = cache.frontmatter;

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

		// Header
		container.createEl('h2', { text: 'Data quality' });
		container.createEl('p', {
			text: 'Analyze your genealogy data for inconsistencies, missing information, and potential errors.',
			cls: 'crc-text-muted'
		});

		// Schema Violations Section (at the top for visibility)
		this.renderSchemaViolationsSection(container);

		// Research Gaps Section (only when fact-level tracking is enabled)
		if (this.plugin.settings.trackFactSourcing) {
			this.renderResearchGapsSection(container);

			// Source Conflicts Section
			this.renderSourceConflictsSection(container);
		}

		// Analysis scope selector
		const scopeSection = container.createDiv({ cls: 'crc-section' });
		scopeSection.createEl('h3', { text: 'Analysis scope' });

		let selectedScope: 'all' | 'staging' | 'folder' = 'all';
		const selectedFolder = '';

		new Setting(scopeSection)
			.setName('Scope')
			.setDesc('Choose which records to analyze')
			.addDropdown(dropdown => dropdown
				.addOption('all', 'All records (main tree)')
				.addOption('staging', 'Staging folder only')
				.setValue(selectedScope)
				.onChange(value => {
					selectedScope = value as 'all' | 'staging' | 'folder';
				})
			);

		// Run Analysis button
		const actionSection = container.createDiv({ cls: 'crc-section' });

		const runButton = actionSection.createEl('button', {
			text: 'Run analysis',
			cls: 'mod-cta'
		});
		setIcon(runButton.createSpan({ cls: 'crc-button-icon' }), 'play');

		// Results container (initially empty)
		const resultsContainer = container.createDiv({ cls: 'crc-data-quality-results' });

		runButton.addEventListener('click', () => {
			this.runDataQualityAnalysis(resultsContainer, selectedScope, selectedFolder);
		});

		// Batch Operations section
		const batchSection = container.createDiv({ cls: 'crc-section' });
		batchSection.createEl('h3', { text: 'Batch operations' });
		batchSection.createEl('p', {
			text: 'Fix common data issues across all records. Preview changes before applying.',
			cls: 'crc-text-muted'
		});

		// Normalize dates
		new Setting(batchSection)
			.setName('Normalize date formats')
			.setDesc('Convert dates to standard YYYY-MM-DD format')
			.addButton(btn => btn
				.setButtonText('Preview')
				.onClick(() => {
					this.previewBatchOperation('dates', selectedScope, selectedFolder);
				})
			)
			.addButton(btn => btn
				.setButtonText('Apply')
				.setCta()
				.onClick(() => void this.runBatchOperation('dates', selectedScope, selectedFolder))
			);

		// Normalize gender
		new Setting(batchSection)
			.setName('Normalize gender values')
			.setDesc('Standardize to M/F format')
			.addButton(btn => btn
				.setButtonText('Preview')
				.onClick(() => void this.previewBatchOperation('gender', selectedScope, selectedFolder))
			)
			.addButton(btn => btn
				.setButtonText('Apply')
				.setCta()
				.onClick(() => void this.runBatchOperation('gender', selectedScope, selectedFolder))
			);

		// Clear orphan references
		new Setting(batchSection)
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

		// Data Tools section
		const toolsSection = container.createDiv({ cls: 'crc-section' });
		toolsSection.createEl('h3', { text: 'Data tools' });

		new Setting(toolsSection)
			.setName('Create base template')
			.setDesc('Create a ready-to-use Obsidian Bases template for managing family members in table view')
			.addButton(btn => btn
				.setButtonText('Create template')
				.setCta()
				.onClick(() => {
					this.close();
					this.app.commands.executeCommandById('canvas-roots:create-base-template');
				})
			);
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
			folderFilter
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
		bar.style.width = `${percent}%`;

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
		};
		return names[category] || category;
	}

	/**
	 * Preview a batch operation
	 */
	private previewBatchOperation(
		operation: 'dates' | 'gender' | 'orphans',
		scope: 'all' | 'staging' | 'folder',
		folderPath?: string
	): void {
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
			folderFilter
		);

		// Get preview
		const preview = dataQualityService.previewNormalization({ scope, folderPath });

		// Show preview modal
		const modal = new BatchPreviewModal(
			this.app,
			operation,
			preview,
			() => void this.runBatchOperation(operation, scope, folderPath)
		);
		modal.open();
	}

	/**
	 * Run a batch operation
	 */
	private async runBatchOperation(
		operation: 'dates' | 'gender' | 'orphans',
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
			folderFilter
		);

		let result: BatchOperationResult;
		let operationName: string;

		try {
			switch (operation) {
				case 'dates':
					operationName = 'Date normalization';
					result = await dataQualityService.normalizeDateFormats({ scope, folderPath });
					break;
				case 'gender':
					operationName = 'Gender normalization';
					result = await dataQualityService.normalizeGenderValues({ scope, folderPath });
					break;
				case 'orphans':
					operationName = 'Orphan reference clearing';
					result = await dataQualityService.clearOrphanReferences({ scope, folderPath });
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
			familyGraph.reloadCache();

		} catch (error) {
			new Notice(`${operation} failed: ${getErrorMessage(error)}`);
		}
	}
}

/**
 * Modal for previewing batch operation changes
 */
class BatchPreviewModal extends Modal {
	private operation: 'dates' | 'gender' | 'orphans';
	private preview: NormalizationPreview;
	private onApply: () => void;

	constructor(
		app: App,
		operation: 'dates' | 'gender' | 'orphans',
		preview: NormalizationPreview,
		onApply: () => void
	) {
		super(app);
		this.operation = operation;
		this.preview = preview;
		this.onApply = onApply;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;

		// Set title based on operation
		const titles: Record<string, string> = {
			dates: 'Preview: Date normalization',
			gender: 'Preview: Gender normalization',
			orphans: 'Preview: Clear orphan references',
		};
		titleEl.setText(titles[this.operation]);

		// Get changes for this operation
		let changes: Array<{ person: { name: string }; field: string; oldValue: string; newValue: string }>;
		switch (this.operation) {
			case 'dates':
				changes = this.preview.dateNormalization;
				break;
			case 'gender':
				changes = this.preview.genderNormalization;
				break;
			case 'orphans':
				changes = this.preview.orphanClearing;
				break;
		}

		if (changes.length === 0) {
			contentEl.createEl('p', {
				text: 'No changes needed. All values are already in the correct format.',
				cls: 'crc-text-muted'
			});
		} else {
			contentEl.createEl('p', {
				text: `${changes.length} change${changes.length === 1 ? '' : 's'} will be made:`,
			});

			// Changes table
			const table = contentEl.createEl('table', { cls: 'crc-batch-preview-table' });
			const thead = table.createEl('thead');
			const headerRow = thead.createEl('tr');
			headerRow.createEl('th', { text: 'Person' });
			headerRow.createEl('th', { text: 'Field' });
			headerRow.createEl('th', { text: 'Current' });
			headerRow.createEl('th', { text: 'New' });

			const tbody = table.createEl('tbody');
			const displayChanges = changes.slice(0, 50); // Limit display for performance
			for (const change of displayChanges) {
				const row = tbody.createEl('tr');
				row.createEl('td', { text: change.person.name });
				row.createEl('td', { text: change.field });
				row.createEl('td', { text: change.oldValue, cls: 'crc-batch-old-value' });
				row.createEl('td', { text: change.newValue, cls: 'crc-batch-new-value' });
			}

			if (changes.length > 50) {
				contentEl.createEl('p', {
					text: `... and ${changes.length - 50} more changes`,
					cls: 'crc-text-muted'
				});
			}
		}

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-confirmation-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn-secondary'
		});
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		if (changes.length > 0) {
			const applyBtn = buttonContainer.createEl('button', {
				text: `Apply ${changes.length} change${changes.length === 1 ? '' : 's'}`,
				cls: 'mod-cta'
			});
			applyBtn.addEventListener('click', () => {
				this.close();
				this.onApply();
			});
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
