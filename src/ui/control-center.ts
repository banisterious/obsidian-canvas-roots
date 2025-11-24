import { App, Modal, Notice, Setting, TFile, TFolder, setIcon, ToggleComponent } from 'obsidian';
import CanvasRootsPlugin from '../../main';
import { TAB_CONFIGS, createLucideIcon, setLucideIcon, LucideIconName } from './lucide-icons';
import { createPersonNote, PersonData } from '../core/person-note-writer';
import { PersonPickerModal, PersonInfo } from './person-picker';
import { VaultStatsService, FullVaultStats } from '../core/vault-stats';
import { FamilyGraphService, TreeOptions } from '../core/family-graph';
import { CanvasGenerator, CanvasData, CanvasGenerationOptions } from '../core/canvas-generator';
import { getLogger, LoggerFactory, type LogLevel } from '../core/logging';
import { GedcomImporter } from '../gedcom/gedcom-importer';
import { GedcomImportResultsModal } from './gedcom-import-results-modal';
import { BidirectionalLinker } from '../core/bidirectional-linker';
import type { RecentTreeInfo, RecentImportInfo, ArrowStyle, ColorScheme, SpouseEdgeLabelFormat } from '../settings';

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

	// Tree Generation tab state
	private treeCanvasNameInput?: HTMLInputElement;
	private treeGenerateBtn?: HTMLButtonElement;
	private pendingRootPerson?: PersonInfo;

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
				this.showStatusTab();
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
				this.showCollectionsTab();
				break;
			case 'tree-generation':
				this.showTreeGenerationTab();
				break;
			case 'gedcom':
				this.showGedcomTab();
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
	 * Opens to the Tree Generation tab with the specified person already populated
	 *
	 * @param file - The TFile of the person note
	 */
	public async openWithPerson(file: TFile): Promise<void> {
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

		// Open to Tree Generation tab
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
			const graphService = new FamilyGraphService(this.app);

			// Find all family components
			logger.info('generate-all-trees', 'Finding all family components in vault');
			new Notice('Scanning vault for family groups...');
			const components = await graphService.findAllFamilyComponents();

			if (components.length === 0) {
				new Notice('No family trees found in vault. Please add some person notes first.');
				return;
			}

			if (components.length === 1) {
				new Notice('Only one family tree found. Use "Generate Tree" instead.');
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
						: `Family Tree ${i + 1} - ${rep.name}.canvas`;
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
				} catch (error) {
					logger.error('generate-all-trees', `Failed to generate tree for ${rep.name}`, error);
					results.push({
						success: false,
						familyName: component.collectionName || rep.name,
						peopleCount: component.size,
						error: error instanceof Error ? error.message : 'Unknown error'
					});
				}
			}

			// Save settings with all the recent trees we just added
			await this.plugin.saveSettings();

			// Show results summary modal
			this.showGenerateAllTreesResults(results);
		} catch (error) {
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
		const title = this.contentContainer.createEl('h2', {
			text: 'Generate all trees - Results'
		});
		title.style.marginTop = '0';

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
			successMsg.innerHTML = `<strong>✓ All trees generated successfully!</strong>`;
		} else {
			const warningMsg = this.contentContainer.createEl('p', {
				cls: 'crc-text-warning crc-mt-3'
			});
			warningMsg.innerHTML = `<strong>⚠ ${failureCount} tree${failureCount === 1 ? '' : 's'} failed to generate.</strong> See details below.`;
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
				openBtn.addEventListener('click', async () => {
					if (result.file) {
						const leaf = this.app.workspace.getLeaf(false);
						await leaf.openFile(result.file);
						this.close();
					}
				});

				const relayoutBtn = actions.createEl('button', {
					cls: 'crc-btn crc-btn--small crc-btn--secondary',
					text: 'Re-layout'
				});
				const relayoutIcon = createLucideIcon('refresh-cw', 14);
				relayoutBtn.prepend(relayoutIcon);
				relayoutBtn.addEventListener('click', async () => {
					if (result.file) {
						// Call the plugin's relayout method
						await (this.plugin as any).relayoutCanvas(result.file);
					}
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
			text: 'Back to Tree Generation'
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
		const stats = await statsService.collectStats();

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
			text: `Data Completeness: ${completeness}%`,
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
			clearButton.addEventListener('click', async () => {
				this.plugin.settings.recentTrees = [];
				await this.plugin.saveSettings();
				new Notice('Tree history cleared');
				this.showTab('status'); // Refresh the tab
			});

			existingTrees.forEach((tree) => {
				const treeRow = recentTreesContent.createDiv({ cls: 'crc-recent-tree' });

				// Tree name (clickable link)
				const treeHeader = treeRow.createDiv({ cls: 'crc-recent-tree__header' });
				const treeLink = treeHeader.createEl('a', {
					cls: 'crc-recent-tree__name',
					text: tree.canvasName
				});
				treeLink.addEventListener('click', async (e) => {
					e.preventDefault();
					const file = this.app.vault.getAbstractFileByPath(tree.canvasPath);
					if (file instanceof TFile) {
						const leaf = this.app.workspace.getLeaf(false);
						await leaf.openFile(file);
						this.close();
					} else {
						new Notice(`Canvas file not found: ${tree.canvasPath}`);
					}
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
			clearButton.addEventListener('click', async () => {
				this.plugin.settings.recentImports = [];
				await this.plugin.saveSettings();
				new Notice('Import history cleared');
				this.showTab('status'); // Refresh the tab
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
				action: 'Go to GEDCOM tab to import →'
			},
			{
				number: '2',
				title: 'Generate the tree',
				description: 'Select a root person and configure tree options (ancestors, descendants, or full family tree).',
				action: 'Go to Tree Generation tab →'
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
					if (index === 0) this.switchTab('gedcom');
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
		groupDetails.createEl('li', { text: 'Auto-detected: Based on relationship connections' });
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
			cls: 'crc-link crc-mt-3'
		});
		actionLink.style.display = 'inline-block';
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
			text: 'In the Tree Generation tab, use the "Layout algorithm" dropdown to choose your preferred layout. Canvas filenames will automatically include the layout type (e.g., "Family Tree - John Smith (timeline).canvas").',
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
		filterDetails.createEl('li', { text: 'Available in Tree Generation tab' });
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
			text: 'When generating a new tree, you can optionally customize its styles in the Tree Generation tab.',
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
		optionsList.createEl('li', { text: 'Node coloring: Gender, generation, collection, or monochrome' });
		optionsList.createEl('li', { text: 'Parent-child arrows: Directed, bidirectional, or undirected' });
		optionsList.createEl('li', { text: 'Spouse arrows: Directed, bidirectional, or undirected' });
		optionsList.createEl('li', { text: 'Parent-child edge color: 6 colors or theme default' });
		optionsList.createEl('li', { text: 'Spouse edge color: 6 colors or theme default' });
		optionsList.createEl('li', { text: 'Show spouse edges: Enable or disable marriage relationship edges' });
		optionsList.createEl('li', { text: 'Spouse edge labels: None, date-only, date-location, or full' });

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
		exportMethods.createEl('li', { text: 'GEDCOM tab: Configure export options and export all people or a specific collection' });
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
		whatSyncedList.createEl('li', { text: 'Parent → Child: Setting father/mother adds person to parent\'s children array' });
		whatSyncedList.createEl('li', { text: 'Spouse ↔ Spouse: Adding spouse creates reciprocal link in both notes' });
		whatSyncedList.createEl('li', { text: 'Indexed spouses: Full support for spouse1, spouse2, etc.' });
		whatSyncedList.createEl('li', { text: 'Deletions: Removing a relationship removes the reciprocal link' });

		// Settings
		const settingsSection = bidirectionalSyncContent.createDiv({ cls: 'crc-mb-4' });
		settingsSection.createEl('h4', { text: 'Enable or disable', cls: 'crc-mb-2' });
		settingsSection.createEl('p', {
			text: 'Go to Settings → Canvas Roots → Data section:',
			cls: 'crc-text-muted crc-mb-2'
		});

		const settingsList = settingsSection.createEl('ul');
		settingsList.createEl('li', { text: 'Enable bidirectional relationship sync: Master toggle (default: ON)' });
		settingsList.createEl('li', { text: 'Sync on file modify: Auto-sync when editing notes (default: ON)' });

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

		// Common Tasks Card
		const tasksCard = this.createCard({
			title: 'Common tasks',
			icon: 'check'
		});
		const tasksContent = tasksCard.querySelector('.crc-card__content') as HTMLElement;

		const tasks = [
			{
				icon: 'upload',
				title: 'Import GEDCOM file',
				description: 'Import genealogical data from Family Tree Maker, Gramps, or other tools',
				tab: 'gedcom'
			},
			{
				icon: 'download',
				title: 'Export GEDCOM file',
				description: 'Export your family tree to share with other genealogy software',
				tab: 'gedcom'
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
			text: 'Create Base template'
		});
		createBaseBtn.addEventListener('click', async () => {
			this.close();
			await (this.app as any).commands.executeCommandById('canvas-roots:create-base-template');
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

				treeBtn.addEventListener('click', async () => {
					const file = this.app.vault.getAbstractFileByPath(tree.canvasPath);
					if (file instanceof TFile) {
						const leaf = this.app.workspace.getLeaf(false);
						await leaf.openFile(file);
						this.close();
					} else {
						new Notice(`Canvas file not found: ${tree.canvasPath}`);
					}
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
		const title = container.createEl('h2', { text: 'Canvas settings' });
		title.style.marginTop = '0';

		// Intro text with re-layout feature note
		const intro = container.createEl('p', {
			cls: 'crc-text-muted crc-mb-3'
		});
		intro.innerHTML = 'Adjust canvas layout and arrow styling. Changes apply immediately to new tree generations. ' +
			'<strong>To apply to existing canvases:</strong> right-click the canvas file and select "Re-layout family tree".';

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
				.addOption('directed', 'Directed (→) - Single arrow pointing to child')
				.addOption('bidirectional', 'Bidirectional (↔) - Arrows on both ends')
				.addOption('undirected', 'Undirected (—) - No arrows')
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
				.addOption('directed', 'Directed (→) - Single arrow')
				.addOption('bidirectional', 'Bidirectional (↔) - Arrows on both ends')
				.addOption('undirected', 'Undirected (—) - No arrows')
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
				.addOption('gender', 'Gender - Green for males, purple for females')
				.addOption('generation', 'Generation - Color by generation level')
				.addOption('collection', 'Collection - Different color per collection')
				.addOption('monochrome', 'Monochrome - No coloring')
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
				.addOption('none', 'None - No labels')
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
			text: 'Create & Open Note'
		});
		createOpenBtn.addEventListener('click', () => {
			this.createPersonNote(
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
			text: 'Create & Add Another'
		});
		createAnotherBtn.addEventListener('click', () => {
			this.createPersonNote(
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
		} catch (error) {
			console.error('Failed to create person note:', error);
			new Notice(`❌ Failed to create person note: ${error.message}`);
		}
	}

	/**
	 * Show Tree Generation tab
	 */
	/**
	 * Show Tree Generation tab
	 */
	private async showTreeGenerationTab(): Promise<void> {
		const container = this.contentContainer;

		// Title
		const title = container.createEl('h2', { text: 'Generate family tree' });
		title.style.marginTop = '0';

		// Intro text
		container.createEl('p', {
			text: 'Generate a visual family tree on an Obsidian Canvas. Select a root person and configure the tree options below.',
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
		const graphService = new FamilyGraphService(this.app);
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
		const nodeColorSetting = new Setting(styleContent)
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
		const parentChildArrowSetting = new Setting(styleContent)
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
		const spouseArrowSetting = new Setting(styleContent)
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
		const parentChildColorSetting = new Setting(styleContent)
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
		const spouseColorSetting = new Setting(styleContent)
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
		const spouseEdgesSetting = new Setting(styleContent)
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
		const spouseLabelsSetting = new Setting(styleContent)
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

		// Wire up the Generate button (in Root person card)
		this.treeGenerateBtn?.addEventListener('click', async () => {
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

			const graphService = new FamilyGraphService(this.app);
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
		} catch (error) {
			console.error('Error generating tree:', error);
			new Notice(`Error generating tree: ${error.message}`);
		}
	}

	/**
	 * Generates a collection overview canvas showing all collections and connections
	 */
	private async generateCollectionOverviewCanvas(): Promise<void> {
		try {
			new Notice('Generating collection overview...');

			const graphService = new FamilyGraphService(this.app);

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
		} catch (error) {
			console.error('Error generating collection overview:', error);
			new Notice(`Error generating overview: ${error.message}`);
		}
	}

	/**
	 * Loads and displays analytics data
	 */
	private async loadAnalyticsData(container: HTMLElement): Promise<void> {
		try {
			const graphService = new FamilyGraphService(this.app);
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

			createStatBox('Total People', analytics.totalPeople);
			createStatBox('Collections', analytics.totalCollections,
				`${analytics.totalFamilies} families, ${analytics.totalUserCollections} custom`);
			createStatBox('Average Size', analytics.averageCollectionSize, 'people per collection');
			createStatBox('Bridge People', analytics.crossCollectionMetrics.totalBridgePeople,
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

		} catch (error) {
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
		const lines: string[] = [];
		lines.push('{');

		// Format nodes array
		lines.push('\t"nodes":[');
		data.nodes.forEach((node, index) => {
			const compact = JSON.stringify(node);
			const suffix = index < data.nodes.length - 1 ? ',' : '';
			lines.push(`\t\t${compact}${suffix}`);
		});
		lines.push('\t],');

		// Format edges array
		lines.push('\t"edges":[');
		data.edges.forEach((edge, index) => {
			const compact = JSON.stringify(edge);
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
		lines.push(`\t\t"frontmatter":${JSON.stringify(frontmatter)}`);
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
		fileBtn: HTMLButtonElement
	): Promise<void> {
		try {
			// Show loading state
			analysisContainer.empty();
			analysisContainer.style.display = 'block';
			fileBtn.style.display = 'none';

			analysisContainer.createEl('p', {
				text: `File: ${file.name}`,
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
				helpText.innerHTML = `This file contains multiple separate family trees. After import, use the <strong>"Generate all trees"</strong> command to create canvases for all family groups.`;
			}

			// Action buttons
			const actions = analysisContainer.createDiv({ cls: 'crc-gedcom-actions crc-mt-4' });

			const importBtn = actions.createEl('button', {
				cls: 'crc-btn crc-btn--primary',
				text: 'Import to Vault'
			});
			importBtn.addEventListener('click', async () => {
				analysisContainer.style.display = 'none';
				fileBtn.style.display = 'block';
				await this.handleGedcomImport(file);
			});

			const cancelBtn = actions.createEl('button', {
				cls: 'crc-btn crc-btn--secondary crc-ml-2',
				text: 'Cancel'
			});
			cancelBtn.addEventListener('click', () => {
				analysisContainer.style.display = 'none';
				fileBtn.style.display = 'block';
			});

		} catch (error) {
			logger.error('gedcom', `GEDCOM analysis failed: ${error.message}`);
			analysisContainer.empty();
			analysisContainer.createEl('p', {
				text: `Failed to analyze file: ${error.message}`,
				cls: 'crc-error-text'
			});

			const retryBtn = analysisContainer.createEl('button', {
				cls: 'crc-btn crc-btn--secondary crc-mt-2',
				text: 'Try Different File'
			});
			retryBtn.addEventListener('click', () => {
				analysisContainer.style.display = 'none';
				fileBtn.style.display = 'block';
			});
		}
	}

	/**
	 * Handle GEDCOM file import
	 */
	private async handleGedcomImport(file: File): Promise<void> {
		try {
			logger.info('gedcom', `Starting GEDCOM import: ${file.name}`);

			// Read file content
			const content = await file.text();

			// Create importer
			const importer = new GedcomImporter(this.app);

			// Import GEDCOM file
			const result = await importer.importFile(content, {
				peopleFolder: this.plugin.settings.peopleFolder,
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

			// Show detailed import results modal
			const resultsModal = new GedcomImportResultsModal(this.app, result, result.validation);
			resultsModal.open();

			// Refresh status tab
			if (result.notesCreated > 0) {
				this.showTab('status');
			}
		} catch (error) {
			logger.error('gedcom', `GEDCOM import failed: ${error.message}`);
			new Notice(`Failed to import GEDCOM: ${error.message}`);
		}
	}

	/**
	 * Handle GEDCOM file export
	 */
	private async handleGedcomExport(options: {
		fileName: string;
		collectionFilter?: string;
		includeCollectionCodes: boolean;
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
				includeCollectionCodes: options.includeCollectionCodes,
				fileName: options.fileName,
				sourceApp: 'Canvas Roots',
				sourceVersion: this.plugin.manifest.version
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

				new Notice(
					`GEDCOM exported: ${result.individualsExported} people, ${result.familiesExported} families`
				);
			} else {
				throw new Error('Export failed to generate content');
			}
		} catch (error) {
			logger.error('gedcom-export', `GEDCOM export failed: ${error.message}`);
			new Notice(`Failed to export GEDCOM: ${error.message}`);
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
				.addOption('all', 'All people - Show everyone in the vault')
				.addOption('families', 'Detected families - Auto-detected family groups')
				.addOption('collections', 'My collections - User-defined collections')
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
		this.loadAnalyticsData(analyticsContent);

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

		const graphService = new FamilyGraphService(this.app);

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
	 * Show GEDCOM tab
	 */
	private showGedcomTab(): void {
		const container = this.contentContainer;

		// Import Card
		const importCard = this.createCard({
			title: 'Import GEDCOM',
			icon: 'upload'
		});

		const importContent = importCard.querySelector('.crc-card__content') as HTMLElement;

		importContent.createEl('p', {
			text: 'Import creates person notes for all individuals in your GEDCOM file',
			cls: 'crc-text-muted crc-mb-4'
		});

		// File selection button
		const fileBtn = importContent.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-mt-4',
			text: 'Select GEDCOM file'
		});

		// Create hidden file input
		const fileInput = importContent.createEl('input', {
			attr: {
				type: 'file',
				accept: '.ged,.gedcom',
				style: 'display: none;'
			}
		});

		// Analysis results container (hidden initially)
		const analysisContainer = importContent.createDiv({ cls: 'crc-gedcom-analysis' });
		analysisContainer.style.display = 'none';

		fileBtn.addEventListener('click', () => {
			fileInput.click();
		});

		fileInput.addEventListener('change', async (event) => {
			const target = event.target as HTMLInputElement;
			const file = target.files?.[0];
			if (file) {
				await this.showGedcomAnalysis(file, analysisContainer, fileBtn);
			}
		});

		container.appendChild(importCard);

		// Export Card
		const exportCard = this.createCard({
			title: 'Export GEDCOM',
			icon: 'download'
		});

		const exportContent = exportCard.querySelector('.crc-card__content') as HTMLElement;

		exportContent.createEl('p', {
			text: 'Export your family tree data to GEDCOM 5.5.1 format for sharing with other genealogy software',
			cls: 'crc-text-muted crc-mb-4'
		});

		// Export options
		new Setting(exportContent)
			.setName('People folder')
			.setDesc('Folder containing person notes to export')
			.addText(text => text
				.setPlaceholder('People')
				.setValue(this.plugin.settings.peopleFolder)
				.setDisabled(true)
			);

		// Collection filter option
		let collectionFilter: string | undefined;
		new Setting(exportContent)
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

		// Include collection codes option
		let includeCollectionCodes = true;
		new Setting(exportContent)
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
		new Setting(exportContent)
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
		const exportBtn = exportContent.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-mt-4',
			text: 'Export to GEDCOM'
		});

		exportBtn.addEventListener('click', async () => {
			await this.handleGedcomExport({
				fileName: exportFileName,
				collectionFilter,
				includeCollectionCodes
			});
		});

		container.appendChild(exportCard);
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

		// Export Path Display
		let pathInput: HTMLInputElement;
		new Setting(loggingContent)
			.setName('Export directory')
			.setDesc('Directory for exported log files')
			.addText(text => {
				pathInput = text.inputEl;
				text.inputEl.readOnly = true;
				text.setPlaceholder('No directory selected (will prompt on export)');
				if (this.plugin.settings.logExportPath) {
					text.setValue(this.plugin.settings.logExportPath);
				}
			})
			.addButton(button => button
				.setButtonText('Change')
				.onClick(async () => {
					try {
						// Access Electron dialog (Obsidian provides this via require)
						const { remote } = require('electron');
						const result = await remote.dialog.showOpenDialog({
							properties: ['openDirectory', 'createDirectory'],
							title: 'Select Log Export Directory',
							buttonLabel: 'Select Directory'
						});

						if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
							this.plugin.settings.logExportPath = result.filePaths[0];
							await this.plugin.saveSettings();
							pathInput.value = result.filePaths[0];
							logger.info('settings', 'Log export path changed', { path: result.filePaths[0] });
							new Notice('Export directory updated');
						}
					} catch (error) {
						console.error('Error selecting directory:', error);
						new Notice('Could not open directory picker');
					}
				}));

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
			this.handleExportLogs();
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
	 * Export logs to a file
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

			const logData = JSON.stringify(logs, null, 2);

			// Prompt for directory if not set
			let exportDir = this.plugin.settings.logExportPath;

			if (!exportDir) {
				// Use Electron's dialog to select directory
				const { remote } = require('electron');
				const result = await remote.dialog.showOpenDialog({
					properties: ['openDirectory', 'createDirectory'],
					title: 'Select Log Export Directory',
					buttonLabel: 'Select Directory'
				});

				if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
					new Notice('Log export cancelled');
					return;
				}

				exportDir = result.filePaths[0];

				// Save the selected path for future use
				this.plugin.settings.logExportPath = exportDir;
				await this.plugin.saveSettings();

				logger.info('settings', 'Log export path saved', { path: exportDir });
			}

			const exportPath = require('path').join(exportDir, filename);

			// Use Node.js fs to write to the selected path
			const fs = require('fs');
			fs.writeFileSync(exportPath, logData, 'utf-8');

			logger.info('export', 'Logs exported successfully', {
				filename,
				path: exportPath,
				logCount: logs.length
			});

			new Notice(`Logs exported to ${filename}`);
		} catch (error) {
			console.error('Error exporting logs:', error);
			logger.error('export', 'Failed to export logs', error);
			new Notice(`Error exporting logs: ${error.message}`);
		}
	}

	/**
	 * Show placeholder for unimplemented tabs
	 */
	private showPlaceholderTab(tabId: string): void {
		const container = this.contentContainer;
		const tabConfig = TAB_CONFIGS.find(t => t.id === tabId);

		const card = this.createCard({
			title: tabConfig?.name || 'Coming Soon',
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
			const personInfo = await this.extractPersonInfoFromFile(file);
			if (personInfo) {
				allPeople.push(personInfo);
			}
		}

		// Load family components
		const graphService = new FamilyGraphService(this.app);
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
		allTreesDesc.innerHTML = 'Automatically generate separate canvases for <strong>all disconnected family groups</strong> in your vault. ' +
			'A root person will be automatically selected for each family group.';

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
		(async () => {
			try {
				const graphService = new FamilyGraphService(this.app);
				const components = await graphService.findAllFamilyComponents();

				if (components.length > 1) {
					countBadge.setText(`${components.length} groups`);
					allTreesDesc.innerHTML = `Automatically generate separate canvases for <strong>all ${components.length} disconnected family groups</strong> in your vault. ` +
						`A root person will be automatically selected for each family group.`;
				} else {
					countBadge.setText('1 group');
					allTreesBtn.disabled = true;
					allTreesBtn.addClass('crc-btn--disabled');
					allTreesDesc.setText('Only one family tree detected. Use the "Generate family tree" button above instead.');
				}
			} catch (error) {
				countBadge.setText('');
			}
		})();

		allTreesBtn.addEventListener('click', async () => {
			await this.openAndGenerateAllTrees();
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
	private async extractPersonInfoFromFile(file: TFile): Promise<PersonInfo | null> {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) return null;

		const crId = cache.frontmatter.cr_id;
		if (!crId) return null;

		const fm = cache.frontmatter;

		// Note: Frontmatter uses 'born'/'died' properties, mapped to birthDate/deathDate internally
		// Convert Date objects to ISO strings if necessary (Obsidian parses YAML dates as Date objects)
		const birthDate = fm.born instanceof Date ? fm.born.toISOString().split('T')[0] : fm.born;
		const deathDate = fm.died instanceof Date ? fm.died.toISOString().split('T')[0] : fm.died;

		// Debug logging for William Anderson
		if (file.basename === 'William Anderson') {
			console.log('[Canvas Roots DEBUG - ControlCenter.extractPersonInfoFromFile] William Anderson:', {
				'fm.born': fm.born,
				'fm.born type': typeof fm.born,
				'fm.born instanceof Date': fm.born instanceof Date,
				'birthDate (converted)': birthDate,
				'fm.died': fm.died,
				'deathDate (converted)': deathDate
			});
		}

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
				} catch (error) {
					logger.error('gedcom-sync', `Failed to sync relationships for ${file.path}`, {
						error: error.message
					});
				}
			}

			// Hide progress notice and show completion
			progressNotice.hide();
			new Notice(`✓ Relationships synced for ${syncedCount} people`);

			logger.info('gedcom-sync', `Relationship sync complete: ${syncedCount}/${personFiles.length} files processed`);
		} catch (error) {
			progressNotice.hide();
			logger.error('gedcom-sync', 'Failed to sync imported relationships', {
				error: error.message
			});
			new Notice(`Relationship sync failed: ${error.message}`);
		}
	}
}
