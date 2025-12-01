import { App, Modal, Notice, Setting, TFile, TFolder, setIcon, ToggleComponent } from 'obsidian';
import CanvasRootsPlugin from '../../main';
import { TAB_CONFIGS, createLucideIcon, setLucideIcon, LucideIconName } from './lucide-icons';
import { createPersonNote, PersonData } from '../core/person-note-writer';
import { PersonPickerModal, PersonInfo } from './person-picker';
import { VaultStatsService, FullVaultStats } from '../core/vault-stats';
import { FamilyGraphService, TreeOptions } from '../core/family-graph';
import { CanvasGenerator, CanvasData, CanvasGenerationOptions } from '../core/canvas-generator';
import { getLogger, LoggerFactory, type LogLevel } from '../core/logging';
import { getErrorMessage } from '../core/error-utils';
import { GedcomImporter } from '../gedcom/gedcom-importer';
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

const logger = getLogger('ControlCenter');

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
			case 'quick-actions':
				this.showQuickActionsTab();
				break;
			case 'quick-settings':
				this.showCanvasSettingsTab();
				break;
			case 'data-entry':
				this.showDataEntryTab();
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
			case 'staging':
				this.showStagingTab();
				break;
			case 'data-quality':
				this.showDataQualityTab();
				break;
			case 'person-detail':
				this.showPersonDetailTab();
				break;
			case 'advanced':
				this.showAdvancedTab();
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
			const components = await graphService.findAllFamilyComponents();

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

					const familyTree = await graphService.generateTree(treeOptions);

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

		// Relationships Card
		const relCard = this.createCard({
			title: 'Relationships',
			icon: 'link'
		});
		const relContent = relCard.querySelector('.crc-card__content') as HTMLElement;

		this.createStatRow(relContent, 'Total relationships', stats.relationships.totalRelationships);
		this.createStatRow(relContent, 'Father links', stats.relationships.totalFatherLinks);
		this.createStatRow(relContent, 'Mother links', stats.relationships.totalMotherLinks);
		this.createStatRow(relContent, 'Spouse links', stats.relationships.totalSpouseLinks);
		this.createStatRow(relContent, 'People with father', stats.people.peopleWithFather);
		this.createStatRow(relContent, 'People with mother', stats.people.peopleWithMother);
		this.createStatRow(relContent, 'People with spouse', stats.people.peopleWithSpouse);

		container.appendChild(relCard);

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
	 */
	private showGuideTab(): void {
		const container = this.contentContainer;

		// Welcome Section
		const welcomeCard = this.createCard({
			title: 'Welcome to Canvas Roots',
			icon: 'book-open'
		});
		const welcomeContent = welcomeCard.querySelector('.crc-card__content') as HTMLElement;

		welcomeContent.createEl('p', {
			text: 'Canvas Roots automatically generates family trees on the Obsidian Canvas using specialized genealogical layout algorithms.',
			cls: 'crc-mb-3'
		});

		welcomeContent.createEl('p', {
			text: 'This guide will help you get started quickly.',
			cls: 'crc-text-muted'
		});

		container.appendChild(welcomeCard);

		// Quick Start Card
		const quickStartCard = this.createCard({
			title: 'Quick start',
			icon: 'zap'
		});
		const quickStartContent = quickStartCard.querySelector('.crc-card__content') as HTMLElement;

		const steps = [
			{
				number: '1',
				title: 'Enter your data',
				description: 'Create person notes with YAML frontmatter, import a GEDCOM file, or use Obsidian Bases for bulk entry.',
				action: 'Go to Import/Export tab →'
			},
			{
				number: '2',
				title: 'Generate the tree',
				description: 'Select a root person and configure tree options (ancestors, descendants, or full family tree).',
				action: 'Go to Tree Output tab →'
			},
			{
				number: '3',
				title: 'Maintain the layout',
				description: 'After editing relationships or changing settings, right-click any canvas file and select "Regenerate canvas".',
				action: null
			}
		];

		steps.forEach((step, index) => {
			const stepEl = quickStartContent.createDiv({ cls: 'crc-guide-step' });

			// Step number badge
			const badge = stepEl.createDiv({ cls: 'crc-guide-step__badge' });
			badge.textContent = step.number;

			// Step content
			const content = stepEl.createDiv({ cls: 'crc-guide-step__content' });
			content.createEl('h4', { text: step.title, cls: 'crc-mb-1' });
			content.createEl('p', { text: step.description, cls: 'crc-text-muted crc-mb-2' });

			if (step.action) {
				const actionLink = content.createEl('a', {
					text: step.action,
					cls: 'crc-link'
				});
				actionLink.addEventListener('click', (e) => {
					e.preventDefault();
					if (index === 0) this.switchTab('import-export');
					if (index === 1) this.switchTab('tree-generation');
				});
			}
		});

		container.appendChild(quickStartCard);

		// Essential Frontmatter Card
		const frontmatterCard = this.createCard({
			title: 'Essential person note fields',
			icon: 'file-text'
		});
		const frontmatterContent = frontmatterCard.querySelector('.crc-card__content') as HTMLElement;

		frontmatterContent.createEl('p', {
			text: 'Add these fields to your person notes (YAML frontmatter):',
			cls: 'crc-mb-3'
		});

		const fieldsList = frontmatterContent.createEl('ul', { cls: 'crc-field-list' });

		const fields = [
			{ name: 'cr_id', description: 'Unique identifier (auto-generated or from GEDCOM UUID)', required: true },
			{ name: 'name', description: 'Full name of the person', required: true },
			{ name: 'sex', description: 'M (male), F (female), or U (unknown)', required: false },
			{ name: 'father', description: 'Wikilink to father\'s note: [[John Smith]]', required: false },
			{ name: 'mother', description: 'Wikilink to mother\'s note: [[Jane Doe]]', required: false },
			{ name: 'spouse', description: 'Array of spouse wikilinks: [[[Mary Jones]]]', required: false },
			{ name: 'born', description: 'Birth date (YYYY-MM-DD format preferred)', required: false },
			{ name: 'died', description: 'Death date (YYYY-MM-DD format preferred)', required: false }
		];

		fields.forEach(field => {
			const li = fieldsList.createEl('li');
			const fieldName = li.createEl('code', { text: field.name });
			if (field.required) {
				fieldName.addClass('crc-field--required');
			}
			li.appendText(` - ${field.description}`);
		});

		container.appendChild(frontmatterCard);

		// Groups and Collections Card
		const organizationCard = this.createCard({
			title: 'Understanding groups and collections',
			icon: 'folder'
		});
		const organizationContent = organizationCard.querySelector('.crc-card__content') as HTMLElement;

		organizationContent.createEl('p', {
			text: 'Canvas Roots offers two complementary ways to organize your people:',
			cls: 'crc-mb-3'
		});

		// Group Names section
		const groupSection = organizationContent.createDiv({ cls: 'crc-mb-4' });
		const groupHeader = groupSection.createDiv({ cls: 'crc-flex crc-items-center crc-mb-2' });
		const groupIcon = groupHeader.createDiv({ cls: 'crc-mr-2' });
		setLucideIcon(groupIcon, 'users', 18);
		groupHeader.createEl('h4', { text: 'Group names', cls: 'crc-mb-0' });

		groupSection.createEl('p', {
			text: 'Names for auto-detected connected groups (families, factions, organizations).',
			cls: 'crc-text-muted crc-mb-2'
		});

		const groupDetails = groupSection.createEl('ul', { cls: 'crc-mb-2' });
		groupDetails.createEl('li', { text: 'Set via: Right-click person note → "Set group name"' });
		groupDetails.createEl('li', { text: 'Property: group_name in YAML frontmatter' });
		groupDetails.createEl('li', { text: 'Auto-detected: based on relationship connections' });
		groupDetails.createEl('li', { text: 'Examples: "Smith Family", "House Stark", "The Council"' });

		groupSection.createEl('p', {
			text: 'When to use: Name each connected family/faction/organization for clear canvas filenames.',
			cls: 'crc-text-muted crc-font-italic'
		});

		// Collections section
		const collectionSection = organizationContent.createDiv({ cls: 'crc-mb-4' });
		const collectionHeader = collectionSection.createDiv({ cls: 'crc-flex crc-items-center crc-mb-2' });
		const collectionIcon = collectionHeader.createDiv({ cls: 'crc-mr-2' });
		setLucideIcon(collectionIcon, 'folder', 18);
		collectionHeader.createEl('h4', { text: 'Collections', cls: 'crc-mb-0' });

		collectionSection.createEl('p', {
			text: 'User-defined groups for organizing people across family boundaries.',
			cls: 'crc-text-muted crc-mb-2'
		});

		const collectionDetails = collectionSection.createEl('ul', { cls: 'crc-mb-2' });
		collectionDetails.createEl('li', { text: 'Set via: Right-click person note → "Add to collection"' });
		collectionDetails.createEl('li', { text: 'Property: collection in YAML frontmatter' });
		collectionDetails.createEl('li', { text: 'Manual assignment: You decide who belongs' });
		collectionDetails.createEl('li', { text: 'Examples: "Paternal Line", "First Generation", "Main Characters"' });

		collectionSection.createEl('p', {
			text: 'When to use: Organize by lineage, time period, story role, or research focus.',
			cls: 'crc-text-muted crc-font-italic'
		});

		// Quick comparison
		const comparisonSection = organizationContent.createDiv({ cls: 'crc-info-box' });
		comparisonSection.createEl('strong', { text: 'Quick comparison:' });
		const comparisonList = comparisonSection.createEl('ul', { cls: 'crc-mt-2' });
		comparisonList.createEl('li', { text: 'Group name = "What is this connected group called?" (auto-detected)' });
		comparisonList.createEl('li', { text: 'Collection = "How do I want to organize people?" (manual)' });

		const actionLink = organizationContent.createEl('a', {
			text: 'Browse your collections →',
			cls: 'crc-link crc-mt-3 cr-inline-block'
		});
		actionLink.addEventListener('click', (e) => {
			e.preventDefault();
			this.switchTab('collections');
		});

		container.appendChild(organizationCard);

		// Root Person Card
		const rootPersonCard = this.createCard({
			title: 'Marking root people',
			icon: 'crown'
		});
		const rootPersonContent = rootPersonCard.querySelector('.crc-card__content') as HTMLElement;

		rootPersonContent.createEl('p', {
			text: 'Mark specific people as "root persons" to track ancestors and descendants in your family tree.',
			cls: 'crc-mb-3'
		});

		// What is a root person
		const whatSection = rootPersonContent.createDiv({ cls: 'crc-mb-4' });
		whatSection.createEl('h4', { text: 'What is a root person?', cls: 'crc-mb-2' });
		whatSection.createEl('p', {
			text: 'A root person is an anchor point in your family tree - typically the person whose ancestors and descendants you want to explore. In genealogy research, this is often yourself, a specific ancestor, or a person of interest.',
			cls: 'crc-text-muted crc-mb-2'
		});

		// How to mark
		const howSection = rootPersonContent.createDiv({ cls: 'crc-mb-4' });
		howSection.createEl('h4', { text: 'How to mark someone as a root person', cls: 'crc-mb-2' });

		const howDetails = howSection.createEl('ul', { cls: 'crc-mb-2' });
		howDetails.createEl('li', { text: 'Right-click a person note in the file explorer' });
		howDetails.createEl('li', { text: 'Select "Canvas Roots" → "Mark as root person"' });
		howDetails.createEl('li', { text: 'To unmark, use the same menu and select "Unmark as root person"' });
		howDetails.createEl('li', { text: 'Property: root_person: true in YAML frontmatter' });

		// When to use
		const whenSection = rootPersonContent.createDiv({ cls: 'crc-mb-4' });
		whenSection.createEl('h4', { text: 'When to use root person marking', cls: 'crc-mb-2' });

		const whenDetails = whenSection.createEl('ul', { cls: 'crc-mb-2' });
		whenDetails.createEl('li', { text: 'Track your direct lineage from multiple ancestral starting points' });
		whenDetails.createEl('li', { text: 'Identify key figures in world-building projects (founders, monarchs)' });
		whenDetails.createEl('li', { text: 'Use Obsidian Bases views to filter and analyze root generations' });
		whenDetails.createEl('li', { text: 'Focus research on specific lineages or family branches' });

		// Bases integration
		const basesSection = rootPersonContent.createDiv({ cls: 'crc-info-box' });
		basesSection.createEl('strong', { text: 'Obsidian Bases integration:' });
		basesSection.createEl('p', {
			text: 'The Canvas Roots base template includes a "Root Generation" view that automatically shows all people marked as root persons. This helps you track your starting points and see the beginning of each lineage at a glance.',
			cls: 'crc-mt-2'
		});

		container.appendChild(rootPersonCard);

		// Layout Algorithms Card
		const layoutCard = this.createCard({
			title: 'Layout algorithms',
			icon: 'layout'
		});
		const layoutContent = layoutCard.querySelector('.crc-card__content') as HTMLElement;

		layoutContent.createEl('p', {
			text: 'Canvas Roots offers multiple layout algorithms to visualize your family tree in different ways.',
			cls: 'crc-mb-3'
		});

		// Standard Layout
		const standardSection = layoutContent.createDiv({ cls: 'crc-mb-4' });
		standardSection.createEl('h4', { text: 'Standard', cls: 'crc-mb-2' });
		standardSection.createEl('p', {
			text: 'The default family-chart layout with proper spouse handling and hierarchical positioning.',
			cls: 'crc-text-muted crc-mb-2'
		});

		// Compact Layout
		const compactSection = layoutContent.createDiv({ cls: 'crc-mb-4' });
		compactSection.createEl('h4', { text: 'Compact', cls: 'crc-mb-2' });
		compactSection.createEl('p', {
			text: '50% tighter spacing (both horizontal and vertical) - ideal for large family trees.',
			cls: 'crc-text-muted crc-mb-2'
		});
		const compactDetails = compactSection.createEl('ul');
		compactDetails.createEl('li', { text: 'Same layout algorithm as Standard' });
		compactDetails.createEl('li', { text: 'Reduces canvas size for better overview' });
		compactDetails.createEl('li', { text: 'Best for trees with 50+ people' });

		// Timeline Layout
		const timelineSection = layoutContent.createDiv({ cls: 'crc-mb-4' });
		timelineSection.createEl('h4', { text: 'Timeline', cls: 'crc-mb-2' });
		timelineSection.createEl('p', {
			text: 'Positions people chronologically by birth year, showing which family members were alive during the same time period.',
			cls: 'crc-text-muted crc-mb-2'
		});
		const timelineDetails = timelineSection.createEl('ul');
		timelineDetails.createEl('li', { text: 'X-axis: Birth year (chronological)' });
		timelineDetails.createEl('li', { text: 'Y-axis: Generation number' });
		timelineDetails.createEl('li', { text: 'Estimates positions for missing birth dates' });
		timelineDetails.createEl('li', { text: 'Falls back to generation layout if no dates available' });

		// Hourglass Layout
		const hourglassSection = layoutContent.createDiv({ cls: 'crc-mb-4' });
		hourglassSection.createEl('h4', { text: 'Hourglass', cls: 'crc-mb-2' });
		hourglassSection.createEl('p', {
			text: 'Focuses on a single person\'s complete lineage, with ancestors above and descendants below.',
			cls: 'crc-text-muted crc-mb-2'
		});
		const hourglassDetails = hourglassSection.createEl('ul');
		hourglassDetails.createEl('li', { text: 'Root person centered at Y=0' });
		hourglassDetails.createEl('li', { text: 'Ancestors positioned above (negative Y)' });
		hourglassDetails.createEl('li', { text: 'Descendants positioned below (positive Y)' });
		hourglassDetails.createEl('li', { text: 'Each generation horizontally centered' });

		// How to Select
		const selectSection = layoutContent.createDiv({ cls: 'crc-info-box' });
		selectSection.createEl('strong', { text: 'How to select a layout:' });
		selectSection.createEl('p', {
			text: 'In the Tree Output tab, use the "Layout algorithm" dropdown to choose your preferred layout. Canvas filenames will automatically include the layout type (e.g., "Family Tree - John Smith (timeline).canvas").',
			cls: 'crc-mt-2'
		});

		container.appendChild(layoutCard);

		// Advanced Collections Features Card
		const advancedCollectionsCard = this.createCard({
			title: 'Advanced collections features',
			icon: 'git-branch'
		});
		const advancedCollectionsContent = advancedCollectionsCard.querySelector('.crc-card__content') as HTMLElement;

		advancedCollectionsContent.createEl('p', {
			text: 'Canvas Roots includes powerful features for working with multiple collections:',
			cls: 'crc-mb-3'
		});

		// Collection Color Scheme
		const colorSection = advancedCollectionsContent.createDiv({ cls: 'crc-mb-4' });
		colorSection.createEl('h4', { text: 'Collection color scheme', cls: 'crc-mb-2' });
		colorSection.createEl('p', {
			text: 'Color nodes by collection instead of gender or generation. Each collection gets a consistent color based on its name.',
			cls: 'crc-text-muted crc-mb-2'
		});

		const colorDetails = colorSection.createEl('ul', { cls: 'crc-mb-2' });
		colorDetails.createEl('li', { text: 'Enable in Canvas Settings → Node coloring → Collection' });
		colorDetails.createEl('li', { text: 'Same collection = same color across all canvases' });
		colorDetails.createEl('li', { text: 'People without collections appear gray' });
		colorDetails.createEl('li', { text: 'Perfect for multi-collection canvases' });

		// Collection Overview Canvas
		const overviewSection = advancedCollectionsContent.createDiv({ cls: 'crc-mb-4' });
		overviewSection.createEl('h4', { text: 'Collection overview canvas', cls: 'crc-mb-2' });
		overviewSection.createEl('p', {
			text: 'Generate a master canvas showing all your collections and how they connect.',
			cls: 'crc-text-muted crc-mb-2'
		});

		const overviewDetails = overviewSection.createEl('ul', { cls: 'crc-mb-2' });
		overviewDetails.createEl('li', { text: 'Shows all detected families and user collections' });
		overviewDetails.createEl('li', { text: 'Displays connection lines between related collections' });
		overviewDetails.createEl('li', { text: 'Includes statistics (person count, representative)' });
		overviewDetails.createEl('li', { text: 'Generate from Collections tab → "Generate overview"' });

		// Collection Filtering
		const filterSection = advancedCollectionsContent.createDiv({ cls: 'crc-mb-4' });
		filterSection.createEl('h4', { text: 'Collection filtering', cls: 'crc-mb-2' });
		filterSection.createEl('p', {
			text: 'Generate trees showing only people from specific collections.',
			cls: 'crc-text-muted crc-mb-2'
		});

		const filterDetails = filterSection.createEl('ul');
		filterDetails.createEl('li', { text: 'Available in Tree Output tab' });
		filterDetails.createEl('li', { text: 'Works with all tree types (ancestors, descendants, full)' });
		filterDetails.createEl('li', { text: 'Filter by detected family groups or user collections' });
		filterDetails.createEl('li', { text: 'Perfect for focusing on specific lineages or story arcs' });

		container.appendChild(advancedCollectionsCard);

		// Per-Canvas Style Settings Card
		const styleSettingsCard = this.createCard({
			title: 'Per-canvas style customization',
			icon: 'layout'
		});
		const styleSettingsContent = styleSettingsCard.querySelector('.crc-card__content') as HTMLElement;

		styleSettingsContent.createEl('p', {
			text: 'Customize the appearance of individual canvases with style overrides that take precedence over global settings.',
			cls: 'crc-mb-3'
		});

		// During Tree Generation
		const duringGenSection = styleSettingsContent.createDiv({ cls: 'crc-mb-4' });
		duringGenSection.createEl('h4', { text: 'Setting styles during tree generation', cls: 'crc-mb-2' });
		duringGenSection.createEl('p', {
			text: 'When generating a new tree, you can optionally customize its styles in the Tree Output tab.',
			cls: 'crc-text-muted crc-mb-2'
		});

		const duringGenDetails = duringGenSection.createEl('ul', { cls: 'crc-mb-2' });
		duringGenDetails.createEl('li', { text: 'Look for the "Style customization (optional)" card' });
		duringGenDetails.createEl('li', { text: 'Toggle individual style options to enable overrides' });
		duringGenDetails.createEl('li', { text: 'Disabled options will use global plugin settings' });
		duringGenDetails.createEl('li', { text: 'Style overrides are saved in canvas metadata' });

		// After Creation
		const afterCreationSection = styleSettingsContent.createDiv({ cls: 'crc-mb-4' });
		afterCreationSection.createEl('h4', { text: 'Editing styles after creation', cls: 'crc-mb-2' });
		afterCreationSection.createEl('p', {
			text: 'You can customize the styles of any existing canvas using the context menu.',
			cls: 'crc-text-muted crc-mb-2'
		});

		const afterCreationDetails = afterCreationSection.createEl('ul', { cls: 'crc-mb-2' });
		afterCreationDetails.createEl('li', { text: 'Right-click any canvas file in the file explorer' });
		afterCreationDetails.createEl('li', { text: 'Select "Canvas Roots" → "Customize canvas styles"' });
		afterCreationDetails.createEl('li', { text: 'Choose "(Use global setting)" to clear an override' });
		afterCreationDetails.createEl('li', { text: 'Click "Save styles" to apply changes' });
		afterCreationDetails.createEl('li', { text: 'Regenerate the canvas to see the updated styles' });

		// Available Style Options
		const optionsSection = styleSettingsContent.createDiv({ cls: 'crc-mb-4' });
		optionsSection.createEl('h4', { text: 'Customizable style options', cls: 'crc-mb-2' });

		const optionsList = optionsSection.createEl('ul');
		optionsList.createEl('li', { text: 'Node coloring: gender, generation, collection, or monochrome' });
		optionsList.createEl('li', { text: 'Parent-child arrows: directed, bidirectional, or undirected' });
		optionsList.createEl('li', { text: 'Spouse arrows: directed, bidirectional, or undirected' });
		optionsList.createEl('li', { text: 'Parent-child edge color: 6 colors or theme default' });
		optionsList.createEl('li', { text: 'Spouse edge color: 6 colors or theme default' });
		optionsList.createEl('li', { text: 'Show spouse edges: enable or disable marriage relationship edges' });
		optionsList.createEl('li', { text: 'Spouse edge labels: none, date-only, date-location, or full' });

		// Use Case Example
		const useCaseSection = styleSettingsContent.createDiv({ cls: 'crc-info-box' });
		useCaseSection.createEl('strong', { text: 'Example use case:' });
		useCaseSection.createEl('p', {
			text: 'Use collection-based coloring for your main family tree to see lineages at a glance, but use generation-based coloring for ancestor charts to emphasize historical depth. Each canvas maintains its own style while sharing the same global settings as defaults.',
			cls: 'crc-mt-2'
		});

		container.appendChild(styleSettingsCard);

		// GEDCOM Export Card
		const gedcomExportCard = this.createCard({
			title: 'GEDCOM export',
			icon: 'download'
		});
		const gedcomExportContent = gedcomExportCard.querySelector('.crc-card__content') as HTMLElement;

		gedcomExportContent.createEl('p', {
			text: 'Export your family tree data to GEDCOM 5.5.1 format for sharing with other genealogy software or creating backups.',
			cls: 'crc-mb-3'
		});

		// Export Methods
		const exportMethodsSection = gedcomExportContent.createDiv({ cls: 'crc-mb-4' });
		exportMethodsSection.createEl('h4', { text: 'How to export', cls: 'crc-mb-2' });

		const exportMethods = exportMethodsSection.createEl('ul', { cls: 'crc-mb-2' });
		exportMethods.createEl('li', { text: 'Import/Export tab: Configure export options and export all people or a specific collection' });
		exportMethods.createEl('li', { text: 'Folder context menu: Right-click any folder → "Export GEDCOM from this folder"' });

		// Export Features
		const featuresSection = gedcomExportContent.createDiv({ cls: 'crc-mb-4' });
		featuresSection.createEl('h4', { text: 'Export features', cls: 'crc-mb-2' });

		const features = featuresSection.createEl('ul', { cls: 'crc-mb-2' });
		features.createEl('li', { text: 'GEDCOM 5.5.1 standard format for maximum compatibility' });
		features.createEl('li', { text: 'UUID preservation using custom _UID tags' });
		features.createEl('li', { text: 'Collection code preservation for round-trip imports' });
		features.createEl('li', { text: 'Marriage metadata (dates, locations, status)' });
		features.createEl('li', { text: 'Collection filtering to export specific family groups' });
		features.createEl('li', { text: 'Automatic sex inference from relationships' });

		// Use Cases
		const exportUseCaseSection = gedcomExportContent.createDiv({ cls: 'crc-info-box' });
		exportUseCaseSection.createEl('strong', { text: 'Common use cases:' });
		const useCases = exportUseCaseSection.createEl('ul', { cls: 'crc-mt-2' });
		useCases.createEl('li', { text: 'Share your research with family members using other genealogy software' });
		useCases.createEl('li', { text: 'Create backups of your family tree data' });
		useCases.createEl('li', { text: 'Export specific collections for collaborative research' });
		useCases.createEl('li', { text: 'Migrate data to other genealogy platforms' });

		container.appendChild(gedcomExportCard);

		// Bidirectional Relationship Sync Card
		const bidirectionalSyncCard = this.createCard({
			title: 'Bidirectional relationship sync',
			icon: 'refresh-cw'
		});
		const bidirectionalSyncContent = bidirectionalSyncCard.querySelector('.crc-card__content') as HTMLElement;

		bidirectionalSyncContent.createEl('p', {
			text: 'Canvas Roots automatically maintains reciprocal relationships to ensure data consistency across your family tree.',
			cls: 'crc-mb-3'
		});

		// How It Works
		const howItWorksSection = bidirectionalSyncContent.createDiv({ cls: 'crc-mb-4' });
		howItWorksSection.createEl('h4', { text: 'How it works', cls: 'crc-mb-2' });
		howItWorksSection.createEl('p', {
			text: 'When enabled (default), editing relationships automatically updates both person notes:',
			cls: 'crc-text-muted crc-mb-2'
		});

		const howItWorksList = howItWorksSection.createEl('ul', { cls: 'crc-mb-2' });
		howItWorksList.createEl('li', { text: 'Set someone as a parent → automatically added as child in parent\'s note' });
		howItWorksList.createEl('li', { text: 'Add a spouse → reciprocal spouse link created in both notes' });
		howItWorksList.createEl('li', { text: 'Delete a relationship → reciprocal link automatically removed' });
		howItWorksList.createEl('li', { text: 'Works with Bases edits, frontmatter changes, and external editors' });

		// What Gets Synced
		const whatSyncedSection = bidirectionalSyncContent.createDiv({ cls: 'crc-mb-4' });
		whatSyncedSection.createEl('h4', { text: 'What gets synced', cls: 'crc-mb-2' });

		const whatSyncedList = whatSyncedSection.createEl('ul');
		whatSyncedList.createEl('li', { text: 'Parent → Child: setting father/mother adds person to parent\'s children array' });
		whatSyncedList.createEl('li', { text: 'Spouse ↔ Spouse: adding spouse creates reciprocal link in both notes' });
		whatSyncedList.createEl('li', { text: 'Indexed spouses: full support for spouse1, spouse2, etc.' });
		whatSyncedList.createEl('li', { text: 'Deletions: removing a relationship removes the reciprocal link' });

		// Settings
		const settingsSection = bidirectionalSyncContent.createDiv({ cls: 'crc-mb-4' });
		settingsSection.createEl('h4', { text: 'Enable or disable', cls: 'crc-mb-2' });
		settingsSection.createEl('p', {
			text: 'Go to Settings → Canvas Roots → Data section:',
			cls: 'crc-text-muted crc-mb-2'
		});

		const settingsList = settingsSection.createEl('ul');
		settingsList.createEl('li', { text: 'Enable bidirectional relationship sync: master toggle (default: ON)' });
		settingsList.createEl('li', { text: 'Sync on file modify: auto-sync when editing notes (default: ON)' });

		// Known Limitations
		const limitationsSection = bidirectionalSyncContent.createDiv({ cls: 'crc-info-box' });
		limitationsSection.createEl('strong', { text: 'Known limitations:' });
		const limitationsList = limitationsSection.createEl('ul', { cls: 'crc-mt-2' });
		limitationsList.createEl('li', { text: 'Sync disabled during deletion: Reciprocal links won\'t be auto-cleaned' });
		limitationsList.createEl('li', { text: 'Bulk external edits while Obsidian closed: Only final state is synced' });

		limitationsSection.createEl('p', {
			text: 'These are expected behaviors and don\'t affect normal usage. Sync works reliably for day-to-day editing.',
			cls: 'crc-mt-2 crc-text-muted crc-font-italic'
		});

		container.appendChild(bidirectionalSyncCard);

		// Split Canvas Wizard Card
		const splitWizardCard = this.createCard({
			title: 'Split canvas wizard',
			icon: 'layers'
		});
		const splitWizardContent = splitWizardCard.querySelector('.crc-card__content') as HTMLElement;

		splitWizardContent.createEl('p', {
			text: 'Split large family trees into manageable segments with the multi-step Split Canvas Wizard.',
			cls: 'crc-mb-3'
		});

		// Split Methods
		const methodsSection = splitWizardContent.createDiv({ cls: 'crc-mb-4' });
		methodsSection.createEl('h4', { text: 'Available split methods', cls: 'crc-mb-2' });

		const methodsList = methodsSection.createEl('ul', { cls: 'crc-mb-2' });
		methodsList.createEl('li', { text: 'By generation: Split every N generations' });
		methodsList.createEl('li', { text: 'By branch: Separate paternal/maternal lines' });
		methodsList.createEl('li', { text: 'Single lineage: Direct line between two people' });
		methodsList.createEl('li', { text: 'By collection: One canvas per user-defined collection' });
		methodsList.createEl('li', { text: 'Ancestor + descendant pair: Linked canvases for same root' });
		methodsList.createEl('li', { text: 'By surname: Extract people sharing a surname (even unconnected)' });

		// How to Access
		const accessSection = splitWizardContent.createDiv({ cls: 'crc-mb-4' });
		accessSection.createEl('h4', { text: 'How to access', cls: 'crc-mb-2' });
		accessSection.createEl('p', {
			text: 'Right-click any canvas file → Canvas Roots → Split canvas wizard',
			cls: 'crc-text-muted'
		});

		// Surname Split Highlight
		const surnameSection = splitWizardContent.createDiv({ cls: 'crc-info-box' });
		surnameSection.createEl('strong', { text: 'Surname extraction:' });
		surnameSection.createEl('p', {
			text: 'Extract all people with a given surname, even without established family connections. Useful for consolidating unconnected GEDCOM imports or surname-focused research. Options include matching maiden names and including spouses.',
			cls: 'crc-mt-2'
		});

		container.appendChild(splitWizardCard);

		// Common Tasks Card
		const tasksCard = this.createCard({
			title: 'Common tasks',
			icon: 'check'
		});
		const tasksContent = tasksCard.querySelector('.crc-card__content') as HTMLElement;

		const tasks = [
			{
				icon: 'upload',
				title: 'Import data (GEDCOM/CSV)',
				description: 'Import genealogical data from Family Tree Maker, Gramps, spreadsheets, or other tools',
				tab: 'import-export'
			},
			{
				icon: 'download',
				title: 'Export data (GEDCOM/CSV)',
				description: 'Export your family tree to share with other genealogy software or spreadsheets',
				tab: 'import-export'
			},
			{
				icon: 'git-branch',
				title: 'Generate family tree',
				description: 'Create a visual canvas from your person notes',
				tab: 'tree-generation'
			},
			{
				icon: 'user-plus',
				title: 'Create person note',
				description: 'Add a new individual to your family tree',
				tab: 'data-entry'
			},
			{
				icon: 'settings',
				title: 'Customize styling',
				description: 'Configure node colors, arrow styles, and edge colors',
				tab: 'quick-settings'
			}
		];

		tasks.forEach(task => {
			const taskEl = tasksContent.createDiv({ cls: 'crc-task-item' });

			// Icon
			const iconEl = taskEl.createDiv({ cls: 'crc-task-item__icon' });
			setLucideIcon(iconEl, task.icon as LucideIconName, 20);

			// Content
			const taskContent = taskEl.createDiv({ cls: 'crc-task-item__content' });
			taskContent.createEl('h4', { text: task.title, cls: 'crc-mb-1' });
			taskContent.createEl('p', { text: task.description, cls: 'crc-text-muted' });

			// Arrow
			const arrow = taskEl.createDiv({ cls: 'crc-task-item__arrow' });
			setLucideIcon(arrow, 'chevron-right', 16);

			// Click handler
			taskEl.addClass('crc-task-item--clickable');
			taskEl.addEventListener('click', () => {
				this.switchTab(task.tab);
			});
		});

		container.appendChild(tasksCard);

		// Tips Card
		const tipsCard = this.createCard({
			title: 'Pro tips',
			icon: 'info'
		});
		const tipsContent = tipsCard.querySelector('.crc-card__content') as HTMLElement;

		const tips = [
			'Use Obsidian Bases for efficient bulk data entry and table-view editing',
			'After changing layout or styling settings, use "Regenerate canvas" to apply changes to existing trees',
			'The cr_id field ensures stable identity mapping between notes and canvas nodes',
			'Generation-based coloring creates visual layers that make tree structure clearer',
			'Use per-canvas style settings to customize individual canvases while keeping global defaults',
			'Canvas Roots stays JSON Canvas 1.0 compliant for maximum portability'
		];

		const tipsList = tipsContent.createEl('ul', { cls: 'crc-tips-list' });
		tips.forEach(tip => {
			tipsList.createEl('li', { text: tip });
		});

		container.appendChild(tipsCard);
	}

	/**
	 * Show Quick Actions tab
	 */
	private showQuickActionsTab(): void {
		const container = this.contentContainer;

		// Tree Operations Card
		const treeOpsCard = this.createCard({
			title: 'Tree operations',
			icon: 'git-branch'
		});

		const treeOpsContent = treeOpsCard.querySelector('.crc-card__content') as HTMLElement;

		// Generate tree for current note button
		const generateCurrentBtn = treeOpsContent.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-btn--block',
			text: 'Generate tree for current note'
		});
		generateCurrentBtn.addEventListener('click', () => {
			this.switchTab('tree-generation');
		});
		treeOpsContent.createEl('p', {
			cls: 'crc-form-help',
			text: 'Create a family tree centered on the currently active person note'
		});

		// Re-layout current canvas button
		const relayoutBtn = treeOpsContent.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-btn--block crc-mt-2',
			text: 'Re-layout current canvas'
		});
		relayoutBtn.addEventListener('click', () => {
			new Notice('⚠️ Re-layout functionality coming in Phase 2');
		});
		treeOpsContent.createEl('p', {
			cls: 'crc-form-help',
			text: 'Recalculate layout for the currently open canvas file'
		});

		container.appendChild(treeOpsCard);

		// Person Management Card
		const personMgmtCard = this.createCard({
			title: 'Person management',
			icon: 'users'
		});

		const personMgmtContent = personMgmtCard.querySelector('.crc-card__content') as HTMLElement;

		// Create new person button
		const createPersonBtn = personMgmtContent.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-btn--block',
			text: 'Create new person note'
		});
		createPersonBtn.addEventListener('click', () => {
			this.switchTab('data-entry');
		});
		personMgmtContent.createEl('p', {
			cls: 'crc-form-help',
			text: 'Open the data entry form to create a new person'
		});

		// Open person detail panel button
		const detailPanelBtn = personMgmtContent.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-btn--block crc-mt-2',
			text: 'Open person detail panel'
		});
		detailPanelBtn.addEventListener('click', () => {
			new Notice('⚠️ Person detail panel coming in Phase 4');
		});
		personMgmtContent.createEl('p', {
			cls: 'crc-form-help',
			text: 'View and edit person details in a side panel'
		});

		// Validate relationships button
		const validateBtn = personMgmtContent.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-btn--block crc-mt-2',
			text: 'Validate all relationships'
		});
		validateBtn.addEventListener('click', () => {
			new Notice('⚠️ Relationship validation coming soon');
		});
		personMgmtContent.createEl('p', {
			cls: 'crc-form-help',
			text: 'Check for broken links and missing cr_id values'
		});

		container.appendChild(personMgmtCard);

		// Data Tools Card
		const dataToolsCard = this.createCard({
			title: 'Data tools',
			icon: 'file-text'
		});

		const dataToolsContent = dataToolsCard.querySelector('.crc-card__content') as HTMLElement;

		// Create Base template button
		const createBaseBtn = dataToolsContent.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-btn--block',
			text: 'Create base template'
		});
		createBaseBtn.addEventListener('click', () => {
			this.close();
			this.app.commands.executeCommandById('canvas-roots:create-base-template');
		});
		dataToolsContent.createEl('p', {
			cls: 'crc-form-help',
			text: 'Create a ready-to-use Obsidian Bases template for managing family members in table view'
		});

		container.appendChild(dataToolsCard);

		// Recent Trees Card
		const recentTrees = this.plugin.settings.recentTrees?.slice(0, 5) || [];
		if (recentTrees.length > 0) {
			const recentTreesCard = this.createCard({
				title: 'Recent trees',
				icon: 'clock'
			});

			const recentTreesContent = recentTreesCard.querySelector('.crc-card__content') as HTMLElement;

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

			// "View all" link
			const viewAllLink = recentTreesContent.createDiv({ cls: 'crc-mt-3 crc-text--center' });
			const link = viewAllLink.createEl('a', {
				cls: 'crc-link',
				text: 'View all recent trees →'
			});
			link.addEventListener('click', (e) => {
				e.preventDefault();
				this.switchTab('status');
			});

			container.appendChild(recentTreesCard);
		}
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
	 * Show Data Entry tab
	 */
	private showDataEntryTab(): void {
		const container = this.contentContainer;

		// Create card for person entry form
		const card = this.createCard({
			title: 'Create new person',
			icon: 'user-plus'
		});

		const content = card.querySelector('.crc-card__content') as HTMLElement;

		// Name field
		let nameInput: HTMLInputElement;
		new Setting(content)
			.setName('Name')
			.addText(text => {
				nameInput = text.inputEl;
				text.setPlaceholder('John Robert Smith');
			});

		// cr_id field (read-only when auto-generate is checked)
		let uuidInput: HTMLInputElement;
		new Setting(content)
			.setName('cr_id')
			.setDesc('Unique identifier for this person')
			.addText(text => {
				uuidInput = text.inputEl;
				text.setPlaceholder('abc-123-def-456');
				// Set initial readonly state based on plugin settings
				if (this.plugin.settings.autoGenerateCrId) {
					uuidInput.setAttribute('readonly', 'true');
				}
			});

		// Auto-generate cr_id toggle
		let autoGenToggle: ToggleComponent;
		new Setting(content)
			.setName('Auto-generate cr_id')
			.addToggle(toggle => {
				autoGenToggle = toggle;
				toggle
					.setValue(this.plugin.settings.autoGenerateCrId)
					.onChange(async (value) => {
						// Update plugin settings
						this.plugin.settings.autoGenerateCrId = value;
						await this.plugin.saveSettings();

						// Update UI state
						if (value) {
							uuidInput.setAttribute('readonly', 'true');
							uuidInput.value = '';
						} else {
							uuidInput.removeAttribute('readonly');
						}
					});
			});

		// Birth date field
		let birthInput: HTMLInputElement;
		new Setting(content)
			.setName('Birth date')
			.setDesc('Optional. Format: YYYY-MM-DD')
			.addText(text => {
				birthInput = text.inputEl;
				text.inputEl.type = 'date';
				text.setPlaceholder('YYYY-MM-DD');
			});

		// Death date field
		let deathInput: HTMLInputElement;
		new Setting(content)
			.setName('Death date')
			.setDesc('Optional. Format: YYYY-MM-DD')
			.addText(text => {
				deathInput = text.inputEl;
				text.inputEl.type = 'date';
				text.setPlaceholder('YYYY-MM-DD');
			});

		// Relationship fields with person picker
		const fatherResult = this.createRelationshipField(content, 'Father', 'Click "Link" to select father', this.fatherField);
		this.fatherInput = fatherResult.input;
		this.fatherBtn = fatherResult.linkBtn;
		this.fatherHelp = fatherResult.helpEl;

		const motherResult = this.createRelationshipField(content, 'Mother', 'Click "Link" to select mother', this.motherField);
		this.motherInput = motherResult.input;
		this.motherBtn = motherResult.linkBtn;
		this.motherHelp = motherResult.helpEl;

		const spouseResult = this.createRelationshipField(content, 'Spouse', 'Click "Link" to select spouse', this.spouseField);
		this.spouseInput = spouseResult.input;
		this.spouseBtn = spouseResult.linkBtn;
		this.spouseHelp = spouseResult.helpEl;

		// Action buttons
		const actions = card.createDiv({ cls: 'crc-card__actions' });

		// Create & Open button
		const createOpenBtn = actions.createEl('button', {
			cls: 'crc-btn crc-btn--primary',
			text: 'Create & open note'
		});
		createOpenBtn.addEventListener('click', () => {
			void this.createPersonNote(
				nameInput.value,
				birthInput.value,
				deathInput.value,
				autoGenToggle.getValue(),
				uuidInput.value,
				this.fatherField.crId,
				this.motherField.crId,
				this.spouseField.crId,
				true
			);
		});

		// Create & Add Another button
		const createAnotherBtn = actions.createEl('button', {
			cls: 'crc-btn crc-btn--secondary',
			text: 'Create & add another'
		});
		createAnotherBtn.addEventListener('click', () => {
			void this.createPersonNote(
				nameInput.value,
				birthInput.value,
				deathInput.value,
				autoGenToggle.getValue(),
				uuidInput.value,
				this.fatherField.crId,
				this.motherField.crId,
				this.spouseField.crId,
				false
			);
			// Clear form
			nameInput.value = '';
			birthInput.value = '';
			deathInput.value = '';
			uuidInput.value = '';
			this.clearRelationshipFields();
			autoGenToggle.setValue(true);
			uuidInput.setAttribute('readonly', 'true');
			nameInput.focus();
		});

		container.appendChild(card);
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
	/**
	 * Show Tree Output tab
	 */
	private async showTreeGenerationTab(): Promise<void> {
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

		await this.createRootPersonCard(container, rootPersonField);

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
		const userCollections = await graphService.getUserCollections();

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
			void (async () => {
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
						collectionFilter: collectionSelect.value || undefined
					};

					const familyTree = await graphService.generateTree(treeOptions);

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
				collectionFilter
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
			const familyTree = await graphService.generateTree(treeOptions);

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
				const totalPeople = await graphService.getTotalPeopleCount();
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
			const families = await graphService.findAllFamilyComponents();
			const userCollections = await graphService.getUserCollections();

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
			const connections = await graphService.detectCollectionConnections();

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
	private async loadAnalyticsData(container: HTMLElement): Promise<void> {
		try {
			const graphService = this.plugin.createFamilyGraphService();
			const analytics = await graphService.calculateCollectionAnalytics();

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
	}): Promise<void> {
		try {
			logger.info('gedcom-export', `Starting GEDCOM export: ${options.fileName}`);

			// Create exporter
			const { GedcomExporter } = await import('../gedcom/gedcom-exporter');
			const exporter = new GedcomExporter(this.app);

			// Export to GEDCOM
			const result = await exporter.exportToGedcom({
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
					enablePrivacyProtection: this.plugin.settings.enablePrivacyProtection,
					livingPersonAgeThreshold: this.plugin.settings.livingPersonAgeThreshold,
					privacyDisplayFormat: this.plugin.settings.privacyDisplayFormat,
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
	private async showCollectionsTab(): Promise<void> {
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
				.onChange(async (value) => {
					selectedMode = value;
					await this.updateCollectionsList(container, selectedMode);
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
		await this.updateCollectionsList(container, selectedMode);
	}

	/**
	 * Update the collections list based on selected browse mode
	 */
	private async updateCollectionsList(container: HTMLElement, mode: string): Promise<void> {
		// Remove existing list card if present
		const existingList = container.querySelector('.crc-collections-list');
		if (existingList) {
			existingList.remove();
		}

		const graphService = this.plugin.createFamilyGraphService();

		if (mode === 'all') {
			// Show all people
			await graphService.getTotalPeopleCount(); // This loads the cache
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
			const components = await graphService.findAllFamilyComponents();

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
			const collections = await graphService.getUserCollections();

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
				const connections = await graphService.detectCollectionConnections();

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
	 * State for Import/Export tab
	 */
	private importExportFormat: 'gedcom' | 'csv' = 'gedcom';
	private importExportDirection: 'import' | 'export' = 'import';

	/**
	 * Show combined Import/Export tab
	 */
	private showImportExportTab(): void {
		const container = this.contentContainer;

		// Header with format and direction selectors
		const headerCard = this.createCard({
			title: 'Import/Export data',
			icon: 'file-text'
		});
		const headerContent = headerCard.querySelector('.crc-card__content') as HTMLElement;

		// Format and direction selectors in a row
		const selectorRow = headerContent.createDiv({ cls: 'crc-selector-row' });

		// Format selector
		new Setting(selectorRow)
			.setName('Format')
			.addDropdown(dropdown => dropdown
				.addOption('gedcom', 'GEDCOM')
				.addOption('csv', 'CSV')
				.setValue(this.importExportFormat)
				.onChange(value => {
					this.importExportFormat = value as 'gedcom' | 'csv';
					this.renderImportExportContent(contentContainer);
				})
			);

		// Direction selector
		new Setting(selectorRow)
			.setName('Direction')
			.addDropdown(dropdown => dropdown
				.addOption('import', 'Import')
				.addOption('export', 'Export')
				.setValue(this.importExportDirection)
				.onChange(value => {
					this.importExportDirection = value as 'import' | 'export';
					this.renderImportExportContent(contentContainer);
				})
			);

		// Collapsible folder configuration section
		this.renderFolderConfigSection(headerContent);

		container.appendChild(headerCard);

		// Content area for format-specific options
		const contentContainer = container.createDiv({ cls: 'crc-import-export-content' });
		this.renderImportExportContent(contentContainer);
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
	 * Render the content area based on current format and direction selections
	 */
	private renderImportExportContent(container: HTMLElement): void {
		container.empty();

		if (this.importExportFormat === 'gedcom') {
			if (this.importExportDirection === 'import') {
				this.renderGedcomImport(container);
			} else {
				this.renderGedcomExport(container);
			}
		} else {
			if (this.importExportDirection === 'import') {
				this.renderCsvImport(container);
			} else {
				this.renderCsvExport(container);
			}
		}
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
						if (subfolderSetting) {
							subfolderSetting.settingEl.style.display = value === 'staging' ? '' : 'none';
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
			subfolderSetting.settingEl.style.display = 'none';
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
				const collections = await graphService.getUserCollections();
				collections.forEach(collection => {
					dropdown.addOption(collection.name, collection.name);
				});

				dropdown.onChange(value => {
					collectionFilter = value || undefined;
				});
			});

		// Branch filter options
		let branchRootCrId: string | undefined;
		let branchRootName: string | undefined;
		let branchDirection: 'ancestors' | 'descendants' | undefined;
		let branchIncludeSpouses = false;

		new Setting(content)
			.setName('Branch filter (optional)')
			.setDesc('Export only ancestors or descendants of a specific person')
			.addButton(btn => {
				btn.setButtonText('Select person')
					.onClick(async () => {
						const picker = new PersonPickerModal(this.app, (info) => {
							branchRootCrId = info.crId;
							branchRootName = info.name;
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
					branchIncludeSpouses
				});
			})();
		});

		container.appendChild(card);
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
						if (csvSubfolderSetting) {
							csvSubfolderSetting.settingEl.style.display = value === 'staging' ? '' : 'none';
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
			csvSubfolderSetting.settingEl.style.display = 'none';
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
				const collections = await graphService.getUserCollections();
				collections.forEach(collection => {
					dropdown.addOption(collection.name, collection.name);
				});

				dropdown.onChange(value => {
					collectionFilter = value || undefined;
				});
			});

		// Branch filter options for CSV
		let csvBranchRootCrId: string | undefined;
		let csvBranchRootName: string | undefined;
		let csvBranchDirection: 'ancestors' | 'descendants' | undefined;
		let csvBranchIncludeSpouses = false;

		new Setting(content)
			.setName('Branch filter (optional)')
			.setDesc('Export only ancestors or descendants of a specific person')
			.addButton(btn => {
				btn.setButtonText('Select person')
					.onClick(async () => {
						const picker = new PersonPickerModal(this.app, (info) => {
							csvBranchRootCrId = info.crId;
							csvBranchRootName = info.name;
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
					branchIncludeSpouses: csvBranchIncludeSpouses
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
					enablePrivacyProtection: this.plugin.settings.enablePrivacyProtection,
					livingPersonAgeThreshold: this.plugin.settings.livingPersonAgeThreshold,
					privacyDisplayFormat: this.plugin.settings.privacyDisplayFormat,
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
	// STAGING TAB
	// ==========================================================================

	/**
	 * Show Staging tab - manage imported data before promoting to main tree
	 */
	private showStagingTab(): void {
		const container = this.contentContainer;
		const settings = this.plugin.settings;

		// Check if staging is configured
		if (!settings.stagingFolder) {
			this.showStagingNotConfigured(container);
			return;
		}

		// Create staging service instances
		const folderFilter = new FolderFilterService(settings);
		const stagingService = new StagingService(this.app, settings);
		const crossImportService = new CrossImportDetectionService(
			this.app,
			settings,
			folderFilter,
			stagingService
		);

		// Get staging data
		const subfolders = stagingService.getStagingSubfolders();
		const stats = stagingService.getStagingStats();

		// Header card with summary
		const headerCard = this.createCard({
			title: 'Staging area',
			icon: 'package',
			subtitle: `${stats.totalPeople} people in ${stats.subfolderCount} import(s)`
		});

		const headerContent = headerCard.querySelector('.crc-card__content') as HTMLElement;

		if (stats.totalPeople === 0) {
			headerContent.createEl('p', {
				text: 'No data in staging. Import GEDCOM or CSV files to the staging folder to review them here before promoting to your main tree.',
				cls: 'crc-text-muted'
			});

			// Quick link to import tabs
			const linkContainer = headerContent.createDiv({ cls: 'crc-staging-links' });
			const importLink = linkContainer.createEl('button', {
				text: 'Go to Import/Export',
				cls: 'mod-cta'
			});
			importLink.addEventListener('click', () => this.switchTab('import-export'));
		} else {
			// Show staging folder info
			const infoEl = headerContent.createDiv({ cls: 'crc-staging-info' });
			infoEl.createEl('span', {
				text: `Staging folder: ${settings.stagingFolder}`,
				cls: 'crc-text-muted'
			});
		}

		container.appendChild(headerCard);

		// If no data, stop here
		if (stats.totalPeople === 0) {
			return;
		}

		// Subfolders card
		const subfoldersCard = this.createCard({
			title: 'Imports',
			icon: 'folder'
		});

		const subfoldersContent = subfoldersCard.querySelector('.crc-card__content') as HTMLElement;

		if (subfolders.length === 0) {
			// Files are directly in staging folder, not in subfolders
			this.renderStagingRootFiles(subfoldersContent, stagingService, crossImportService);
		} else {
			// Render each subfolder
			for (const subfolder of subfolders) {
				this.renderStagingSubfolder(subfoldersContent, subfolder, stagingService, crossImportService);
			}
		}

		container.appendChild(subfoldersCard);

		// Bulk actions card
		const actionsCard = this.createCard({
			title: 'Bulk actions',
			icon: 'zap'
		});

		const actionsContent = actionsCard.querySelector('.crc-card__content') as HTMLElement;

		// Check all for duplicates
		new Setting(actionsContent)
			.setName('Check all for duplicates')
			.setDesc('Scan all staging data against your main tree')
			.addButton(btn => btn
				.setButtonText('Check all')
				.onClick(() => {
					this.runCrossImportCheck(crossImportService);
				})
			);

		// Promote all (if no pending matches)
		new Setting(actionsContent)
			.setName('Promote all to main tree')
			.setDesc('Move all staging data to your main people folder (skips duplicates)')
			.addButton(btn => btn
				.setButtonText('Promote all')
				.setWarning()
				.onClick(() => {
					void this.promoteAllStaging(stagingService, crossImportService);
				})
			);

		// Delete all staging
		new Setting(actionsContent)
			.setName('Delete all staging data')
			.setDesc('Permanently remove all data from staging')
			.addButton(btn => btn
				.setButtonText('Delete all')
				.setWarning()
				.onClick(() => {
					void this.deleteAllStaging(stagingService);
				})
			);

		container.appendChild(actionsCard);
	}

	/**
	 * Show message when staging is not configured
	 */
	private showStagingNotConfigured(container: HTMLElement): void {
		const card = this.createCard({
			title: 'Staging not configured',
			icon: 'package'
		});

		const content = card.querySelector('.crc-card__content') as HTMLElement;

		content.createEl('p', {
			text: 'A staging folder allows you to import GEDCOM or CSV data for review before adding it to your main family tree.',
			cls: 'crc-text-muted'
		});

		content.createEl('p', {
			text: 'This helps you:',
			cls: 'crc-staging-benefits-intro'
		});

		const benefitsList = content.createEl('ul', { cls: 'crc-staging-benefits' });
		benefitsList.createEl('li', { text: 'Review imported data before it affects your tree' });
		benefitsList.createEl('li', { text: 'Check for duplicates against existing people' });
		benefitsList.createEl('li', { text: 'Promote clean data or discard unwanted imports' });

		new Setting(content)
			.setName('Configure staging folder')
			.setDesc('Set a folder for staging imported data')
			.addButton(btn => btn
				.setButtonText('Open settings')
				.setCta()
				.onClick(() => {
					// Open plugin settings
					// @ts-expect-error - Obsidian API
					this.app.setting.open();
					// @ts-expect-error - Obsidian API
					this.app.setting.openTabById(this.plugin.manifest.id);
				})
			);

		container.appendChild(card);
	}

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
				this.showStagingTab();
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
				this.showStagingTab();
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
				this.showStagingTab();
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
				this.showStagingTab();
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
	 * Show Person Detail tab
	 */
	private showPersonDetailTab(): void {
		this.showPlaceholderTab('person-detail');
	}

	/**
	 * Show Advanced tab
	 */
	private showAdvancedTab(): void {
		const container = this.contentContainer;

		// Logging Card
		const loggingCard = this.createCard({
			title: 'Logging',
			icon: 'file-text'
		});

		const loggingContent = loggingCard.querySelector('.crc-card__content') as HTMLElement;

		// Log Level Selector
		new Setting(loggingContent)
			.setName('Log level')
			.setDesc('Controls console output verbosity. Logs are always collected for export.')
			.addDropdown(dropdown => {
				const logLevels: LogLevel[] = ['off', 'error', 'warn', 'info', 'debug'];
				logLevels.forEach(level => {
					dropdown.addOption(level, level.toUpperCase());
				});
				dropdown
					.setValue(LoggerFactory.getLogLevel())
					.onChange((value) => {
						const newLevel = value as LogLevel;
						LoggerFactory.setLogLevel(newLevel);
						logger.info('settings', 'Log level changed from Control Center', {
							level: newLevel
						});
						new Notice(`Log level set to ${newLevel.toUpperCase()}`);
					});
			});

		// Export Path Setting (vault-relative folder)
		new Setting(loggingContent)
			.setName('Export folder')
			.setDesc('Vault folder for exported log files (e.g., ".canvas-roots/logs")')
			.addText(text => {
				text.setPlaceholder('.canvas-roots/logs');
				text.setValue(this.plugin.settings.logExportPath);
				text.onChange(async (value) => {
					// Normalize the path (remove leading/trailing slashes)
					const normalized = value.replace(/^\/+|\/+$/g, '');
					this.plugin.settings.logExportPath = normalized;
					await this.plugin.saveSettings();
					logger.info('settings', 'Log export folder changed', { folder: normalized });
				});
			});

		// Obfuscation Toggle
		new Setting(loggingContent)
			.setName('Obfuscate log exports')
			.setDesc('Replace personally identifiable information (names, dates, paths) with placeholders when exporting logs. Recommended for sharing logs publicly.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.obfuscateLogExports)
				.onChange(async (value) => {
					this.plugin.settings.obfuscateLogExports = value;
					await this.plugin.saveSettings();
					logger.info('settings', 'Log export obfuscation changed', { enabled: value });
					if (value) {
						new Notice('Log exports will be obfuscated (secure)');
					} else {
						new Notice('⚠️ Warning: Log exports will contain unobfuscated personal information!', 5000);
					}
				}));

		// Log Statistics
		const statsGroup = loggingContent.createDiv({ cls: 'crc-form-group crc-mt-4' });
		const logs = LoggerFactory.getLogs();
		const logCount = logs.length;
		const errorCount = logs.filter(l => l.level === 'error').length;
		const warnCount = logs.filter(l => l.level === 'warn').length;

		statsGroup.createEl('p', {
			text: `Total logs collected: ${logCount}`,
			cls: 'crc-text-muted'
		});
		statsGroup.createEl('p', {
			text: `Errors: ${errorCount} | Warnings: ${warnCount}`,
			cls: 'crc-text-muted'
		});

		// Export and Clear Buttons
		const buttonGroup = loggingContent.createDiv({
			cls: 'crc-form-group crc-mt-4'
		});
		buttonGroup.setAttr('style', 'display: flex; gap: 8px;');

		const exportButton = buttonGroup.createEl('button', {
			text: 'Export logs',
			cls: 'crc-btn crc-btn--primary'
		});

		exportButton.addEventListener('click', () => {
			void this.handleExportLogs();
		});

		const clearButton = buttonGroup.createEl('button', {
			text: 'Clear logs',
			cls: 'crc-btn crc-btn--secondary'
		});

		clearButton.addEventListener('click', () => {
			logger.info('maintenance', 'Logs cleared from Control Center');
			LoggerFactory.clearLogs();
			new Notice('Logs cleared');
			this.showTab('advanced'); // Refresh the tab
		});

		container.appendChild(loggingCard);
	}

	/**
	 * Export logs to a file in the vault
	 */
	private async handleExportLogs(): Promise<void> {
		try {
			logger.info('export', 'Exporting logs from Control Center');

			const now = new Date();
			const pad = (n: number) => n.toString().padStart(2, '0');
			const obfuscated = this.plugin.settings.obfuscateLogExports ? '-obfuscated' : '';
			const filename = `canvas-roots-logs${obfuscated}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;

			let logs = LoggerFactory.getLogs();

			// Obfuscate logs if setting is enabled (secure by default)
			if (this.plugin.settings.obfuscateLogExports) {
				const { obfuscateLogs } = await import('../core/logging');
				logs = obfuscateLogs(logs);
				logger.info('export', 'Logs obfuscated for PII protection', { logCount: logs.length });
			} else {
				// Warn user about exporting unobfuscated logs
				new Notice('⚠️ Warning: Exporting logs WITHOUT obfuscation may expose personal information!', 5000);
			}

			// Safely stringify logs handling circular references
			const seen = new WeakSet();
			const logData = JSON.stringify(logs, (_key, value) => {
				if (typeof value === 'object' && value !== null) {
					if (seen.has(value)) {
						return '[Circular]';
					}
					seen.add(value);
				}
				return value;
			}, 2);

			// Get export folder (vault-relative path)
			const exportFolder = this.plugin.settings.logExportPath || '.canvas-roots/logs';
			const exportPath = `${exportFolder}/${filename}`;

			// Ensure the export folder exists
			const folderExists = await this.app.vault.adapter.exists(exportFolder);
			if (!folderExists) {
				await this.app.vault.createFolder(exportFolder);
				logger.info('export', 'Created log export folder', { folder: exportFolder });
			}

			// Write the log file using Obsidian's vault adapter
			await this.app.vault.adapter.write(exportPath, logData);

			logger.info('export', 'Logs exported successfully', {
				filename,
				path: exportPath,
				logCount: logs.length
			});

			new Notice(`Logs exported to ${exportPath}`);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			logger.error('export', 'Failed to export logs', error);
			new Notice(`Error exporting logs: ${message}`);
		}
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
	private async createRootPersonCard(container: HTMLElement, rootPersonField: RelationshipField): Promise<void> {
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
		const { FamilyGraphService } = await import('../core/family-graph');
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
		const familyComponents = await graphService.findAllFamilyComponents();

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
		void (async () => {
			try {
				const graphService = this.plugin.createFamilyGraphService();
				const components = await graphService.findAllFamilyComponents();

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

		// Analysis scope selector
		const scopeSection = container.createDiv({ cls: 'crc-section' });
		scopeSection.createEl('h3', { text: 'Analysis scope' });

		let selectedScope: 'all' | 'staging' | 'folder' = 'all';
		let selectedFolder = '';

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
				.onClick(() => {
					this.runBatchOperation('dates', selectedScope, selectedFolder);
				})
			);

		// Normalize gender
		new Setting(batchSection)
			.setName('Normalize gender values')
			.setDesc('Standardize to M/F format')
			.addButton(btn => btn
				.setButtonText('Preview')
				.onClick(() => {
					this.previewBatchOperation('gender', selectedScope, selectedFolder);
				})
			)
			.addButton(btn => btn
				.setButtonText('Apply')
				.setCta()
				.onClick(() => {
					this.runBatchOperation('gender', selectedScope, selectedFolder);
				})
			);

		// Clear orphan references
		new Setting(batchSection)
			.setName('Clear orphan references')
			.setDesc('Remove parent references that point to non-existent records')
			.addButton(btn => btn
				.setButtonText('Preview')
				.onClick(() => {
					this.previewBatchOperation('orphans', selectedScope, selectedFolder);
				})
			)
			.addButton(btn => btn
				.setButtonText('Apply')
				.setWarning()
				.onClick(() => {
					this.runBatchOperation('orphans', selectedScope, selectedFolder);
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
				this.app.workspace.openLinkText(file.path, '', false);
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
			() => this.runBatchOperation(operation, scope, folderPath)
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
