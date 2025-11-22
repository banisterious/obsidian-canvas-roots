import { App, Modal, Notice, TFile, setIcon } from 'obsidian';
import CanvasRootsPlugin from '../../main';
import { TAB_CONFIGS, createLucideIcon, setLucideIcon, LucideIconName } from './lucide-icons';
import { createPersonNote, PersonData } from '../core/person-note-writer';
import { PersonPickerModal, PersonInfo } from './person-picker';
import { VaultStatsService, FullVaultStats } from '../core/vault-stats';
import { FamilyGraphService, TreeOptions } from '../core/family-graph';
import { CanvasGenerator, CanvasData, CanvasGenerationOptions } from '../core/canvas-generator';
import { getLogger, LoggerFactory, type LogLevel } from '../core/logging';
import { GedcomImporter } from '../gedcom/gedcom-importer';
import { BidirectionalLinker } from '../core/bidirectional-linker';
import type { RecentTreeInfo, RecentImportInfo, ArrowStyle } from '../settings';

const logger = getLogger('ControlCenter');

/**
 * Relationship field data
 */
interface RelationshipField {
	name: string;
	crId?: string;
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
			case 'quick-actions':
				this.showQuickActionsTab();
				break;
			case 'quick-settings':
				this.showQuickSettingsTab();
				break;
			case 'data-entry':
				this.showDataEntryTab();
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

		// Store the person info to be used when the tab renders
		this.pendingRootPerson = {
			name,
			crId,
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
							familyName: rep.name,
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
						showLabels: false,
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

					// Create canvas file
					const fileName = `Family Tree ${i + 1} - ${rep.name}.canvas`;
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
						familyName: rep.name,
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
						familyName: rep.name,
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
		const generateIcon = createLucideIcon('git-branch', 16);
		generateCurrentBtn.prepend(generateIcon);
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
		const relayoutIcon = createLucideIcon('refresh-cw', 16);
		relayoutBtn.prepend(relayoutIcon);
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
		const createPersonIcon = createLucideIcon('user-plus', 16);
		createPersonBtn.prepend(createPersonIcon);
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
		const detailIcon = createLucideIcon('user', 16);
		detailPanelBtn.prepend(detailIcon);
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
		const validateIcon = createLucideIcon('check', 16);
		validateBtn.prepend(validateIcon);
		validateBtn.addEventListener('click', () => {
			new Notice('⚠️ Relationship validation coming soon');
		});
		personMgmtContent.createEl('p', {
			cls: 'crc-form-help',
			text: 'Check for broken links and missing cr_id values'
		});

		container.appendChild(personMgmtCard);

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
	 * Show Quick Settings tab
	 */
	private showQuickSettingsTab(): void {
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

		// Layout Settings Card
		const layoutCard = this.createCard({
			title: 'Layout settings',
			icon: 'layout'
		});

		const layoutContent = layoutCard.querySelector('.crc-card__content') as HTMLElement;

		// Horizontal Spacing
		const horizSpacingGroup = layoutContent.createDiv({ cls: 'crc-form-group' });
		const horizLabel = horizSpacingGroup.createEl('label', {
			cls: 'crc-form-label',
			text: 'Horizontal spacing'
		});
		horizLabel.htmlFor = 'quick-horiz-spacing';

		const horizInput = horizSpacingGroup.createEl('input', {
			cls: 'crc-form-input',
			type: 'number',
			attr: {
				id: 'quick-horiz-spacing',
				min: '100',
				max: '1000',
				step: '50'
			}
		}) as HTMLInputElement;
		horizInput.value = String(this.plugin.settings.horizontalSpacing);

		horizSpacingGroup.createEl('p', {
			cls: 'crc-form-help',
			text: 'Space between nodes horizontally (pixels). Default: 400'
		});

		horizInput.addEventListener('change', async () => {
			const value = parseInt(horizInput.value);
			if (!isNaN(value) && value >= 100 && value <= 1000) {
				this.plugin.settings.horizontalSpacing = value;
				await this.plugin.saveSettings();
				new Notice('Horizontal spacing updated');
			} else {
				horizInput.value = String(this.plugin.settings.horizontalSpacing);
				new Notice('Invalid value. Must be between 100 and 1000.');
			}
		});

		// Vertical Spacing
		const vertSpacingGroup = layoutContent.createDiv({ cls: 'crc-form-group' });
		const vertLabel = vertSpacingGroup.createEl('label', {
			cls: 'crc-form-label',
			text: 'Vertical spacing'
		});
		vertLabel.htmlFor = 'quick-vert-spacing';

		const vertInput = vertSpacingGroup.createEl('input', {
			cls: 'crc-form-input',
			type: 'number',
			attr: {
				id: 'quick-vert-spacing',
				min: '100',
				max: '1000',
				step: '50'
			}
		}) as HTMLInputElement;
		vertInput.value = String(this.plugin.settings.verticalSpacing);

		vertSpacingGroup.createEl('p', {
			cls: 'crc-form-help',
			text: 'Space between generations vertically (pixels). Default: 250'
		});

		vertInput.addEventListener('change', async () => {
			const value = parseInt(vertInput.value);
			if (!isNaN(value) && value >= 100 && value <= 1000) {
				this.plugin.settings.verticalSpacing = value;
				await this.plugin.saveSettings();
				new Notice('Vertical spacing updated');
			} else {
				vertInput.value = String(this.plugin.settings.verticalSpacing);
				new Notice('Invalid value. Must be between 100 and 1000.');
			}
		});

		// Node Width
		const nodeWidthGroup = layoutContent.createDiv({ cls: 'crc-form-group' });
		const widthLabel = nodeWidthGroup.createEl('label', {
			cls: 'crc-form-label',
			text: 'Node width'
		});
		widthLabel.htmlFor = 'quick-node-width';

		const widthInput = nodeWidthGroup.createEl('input', {
			cls: 'crc-form-input',
			type: 'number',
			attr: {
				id: 'quick-node-width',
				min: '100',
				max: '500',
				step: '10'
			}
		}) as HTMLInputElement;
		widthInput.value = String(this.plugin.settings.defaultNodeWidth);

		nodeWidthGroup.createEl('p', {
			cls: 'crc-form-help',
			text: 'Width of person nodes (pixels). Default: 200'
		});

		widthInput.addEventListener('change', async () => {
			const value = parseInt(widthInput.value);
			if (!isNaN(value) && value >= 100 && value <= 500) {
				this.plugin.settings.defaultNodeWidth = value;
				await this.plugin.saveSettings();
				new Notice('Node width updated');
			} else {
				widthInput.value = String(this.plugin.settings.defaultNodeWidth);
				new Notice('Invalid value. Must be between 100 and 500.');
			}
		});

		// Node Height
		const nodeHeightGroup = layoutContent.createDiv({ cls: 'crc-form-group' });
		const heightLabel = nodeHeightGroup.createEl('label', {
			cls: 'crc-form-label',
			text: 'Node height'
		});
		heightLabel.htmlFor = 'quick-node-height';

		const heightInput = nodeHeightGroup.createEl('input', {
			cls: 'crc-form-input',
			type: 'number',
			attr: {
				id: 'quick-node-height',
				min: '50',
				max: '300',
				step: '10'
			}
		}) as HTMLInputElement;
		heightInput.value = String(this.plugin.settings.defaultNodeHeight);

		nodeHeightGroup.createEl('p', {
			cls: 'crc-form-help',
			text: 'Height of person nodes (pixels). Default: 100'
		});

		heightInput.addEventListener('change', async () => {
			const value = parseInt(heightInput.value);
			if (!isNaN(value) && value >= 50 && value <= 300) {
				this.plugin.settings.defaultNodeHeight = value;
				await this.plugin.saveSettings();
				new Notice('Node height updated');
			} else {
				heightInput.value = String(this.plugin.settings.defaultNodeHeight);
				new Notice('Invalid value. Must be between 50 and 300.');
			}
		});

		container.appendChild(layoutCard);

		// Arrow Styling Card
		const arrowCard = this.createCard({
			title: 'Arrow styling',
			icon: 'link'
		});

		const arrowContent = arrowCard.querySelector('.crc-card__content') as HTMLElement;

		// Parent-Child Arrow Style
		const parentArrowGroup = arrowContent.createDiv({ cls: 'crc-form-group' });
		const parentArrowLabel = parentArrowGroup.createEl('label', {
			cls: 'crc-form-label',
			text: 'Parent → child arrows'
		});
		parentArrowLabel.htmlFor = 'quick-parent-arrow';

		const parentArrowSelect = parentArrowGroup.createEl('select', {
			cls: 'crc-form-input',
			attr: { id: 'quick-parent-arrow' }
		}) as HTMLSelectElement;

		[
			{ value: 'directed', label: 'Directed (→) - Single arrow pointing to child' },
			{ value: 'bidirectional', label: 'Bidirectional (↔) - Arrows on both ends' },
			{ value: 'undirected', label: 'Undirected (—) - No arrows' }
		].forEach(opt => {
			parentArrowSelect.createEl('option', {
				value: opt.value,
				text: opt.label
			});
		});
		parentArrowSelect.value = this.plugin.settings.parentChildArrowStyle;

		parentArrowGroup.createEl('p', {
			cls: 'crc-form-help',
			text: 'Arrow style for parent-child relationships. Default: Directed'
		});

		parentArrowSelect.addEventListener('change', async () => {
			this.plugin.settings.parentChildArrowStyle = parentArrowSelect.value as ArrowStyle;
			await this.plugin.saveSettings();
			new Notice('Parent-child arrow style updated');
		});

		// Spouse Arrow Style
		const spouseArrowGroup = arrowContent.createDiv({ cls: 'crc-form-group' });
		const spouseArrowLabel = spouseArrowGroup.createEl('label', {
			cls: 'crc-form-label',
			text: 'Spouse arrows'
		});
		spouseArrowLabel.htmlFor = 'quick-spouse-arrow';

		const spouseArrowSelect = spouseArrowGroup.createEl('select', {
			cls: 'crc-form-input',
			attr: { id: 'quick-spouse-arrow' }
		}) as HTMLSelectElement;

		[
			{ value: 'directed', label: 'Directed (→) - Single arrow' },
			{ value: 'bidirectional', label: 'Bidirectional (↔) - Arrows on both ends' },
			{ value: 'undirected', label: 'Undirected (—) - No arrows' }
		].forEach(opt => {
			spouseArrowSelect.createEl('option', {
				value: opt.value,
				text: opt.label
			});
		});
		spouseArrowSelect.value = this.plugin.settings.spouseArrowStyle;

		spouseArrowGroup.createEl('p', {
			cls: 'crc-form-help',
			text: 'Arrow style for spouse relationships. Default: Undirected (cleaner look)'
		});

		spouseArrowSelect.addEventListener('change', async () => {
			this.plugin.settings.spouseArrowStyle = spouseArrowSelect.value as ArrowStyle;
			await this.plugin.saveSettings();
			new Notice('Spouse arrow style updated');
		});

		container.appendChild(arrowCard);

		// Link to full settings
		const fullSettingsBtn = container.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-btn--block crc-mt-3',
			text: 'Open full settings'
		});
		const settingsIcon = createLucideIcon('settings', 16);
		fullSettingsBtn.prepend(settingsIcon);
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
		const nameGroup = content.createDiv({ cls: 'crc-form-group' });
		nameGroup.createDiv({ cls: 'crc-form-label', text: 'Name' });
		const nameInput = nameGroup.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'text',
				placeholder: 'John Robert Smith'
			}
		});

		// Auto-generate cr_id checkbox
		const uuidGroup = content.createDiv({ cls: 'crc-form-group' });
		const checkboxContainer = uuidGroup.createDiv({ cls: 'crc-checkbox-container' });
		const autoGenCheckbox = checkboxContainer.createEl('input', {
			cls: 'crc-checkbox',
			attr: {
				type: 'checkbox',
				id: 'auto-gen-uuid'
			}
		});
		// Set initial state from plugin settings
		autoGenCheckbox.checked = this.plugin.settings.autoGenerateCrId;
		checkboxContainer.createEl('label', {
			cls: 'crc-checkbox-label',
			text: 'Auto-generate cr_id',
			attr: { for: 'auto-gen-uuid' }
		});

		// cr_id field (read-only when auto-generate is checked)
		const uuidFieldGroup = content.createDiv({ cls: 'crc-form-group' });
		uuidFieldGroup.createDiv({ cls: 'crc-form-label', text: 'cr_id' });
		const uuidInput = uuidFieldGroup.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'text',
				placeholder: 'abc-123-def-456'
			}
		});
		// Set initial readonly state based on plugin settings
		if (this.plugin.settings.autoGenerateCrId) {
			uuidInput.setAttribute('readonly', 'true');
		}
		uuidFieldGroup.createDiv({
			cls: 'crc-form-help',
			text: 'Unique identifier for this person'
		});

		// Toggle UUID field based on checkbox
		autoGenCheckbox.addEventListener('change', async () => {
			// Update plugin settings
			this.plugin.settings.autoGenerateCrId = autoGenCheckbox.checked;
			await this.plugin.saveSettings();

			// Update UI state
			if (autoGenCheckbox.checked) {
				uuidInput.setAttribute('readonly', 'true');
				uuidInput.value = '';
			} else {
				uuidInput.removeAttribute('readonly');
			}
		});

		// Birth date field
		const birthGroup = content.createDiv({ cls: 'crc-form-group' });
		birthGroup.createDiv({ cls: 'crc-form-label', text: 'Birth date' });
		const birthInput = birthGroup.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'date',
				placeholder: 'YYYY-MM-DD'
			}
		});
		birthGroup.createDiv({
			cls: 'crc-form-help',
			text: 'Optional. Format: YYYY-MM-DD'
		});

		// Death date field
		const deathGroup = content.createDiv({ cls: 'crc-form-group' });
		deathGroup.createDiv({ cls: 'crc-form-label', text: 'Death date' });
		const deathInput = deathGroup.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'date',
				placeholder: 'YYYY-MM-DD'
			}
		});
		deathGroup.createDiv({
			cls: 'crc-form-help',
			text: 'Optional. Format: YYYY-MM-DD'
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
		const createOpenIcon = createLucideIcon('file-plus', 16);
		createOpenBtn.prepend(createOpenIcon);
		createOpenBtn.addEventListener('click', () => {
			this.createPersonNote(
				nameInput.value,
				birthInput.value,
				deathInput.value,
				autoGenCheckbox.checked,
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
		const createAnotherIcon = createLucideIcon('plus', 16);
		createAnotherBtn.prepend(createAnotherIcon);
		createAnotherBtn.addEventListener('click', () => {
			this.createPersonNote(
				nameInput.value,
				birthInput.value,
				deathInput.value,
				autoGenCheckbox.checked,
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
			autoGenCheckbox.checked = true;
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

			// Sync bidirectional relationships
			const bidirectionalLinker = new BidirectionalLinker(this.app);
			await bidirectionalLinker.syncRelationships(file);

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
		const typeGroup = configContent.createDiv({ cls: 'crc-form-group' });
		typeGroup.createEl('label', {
			cls: 'crc-form-label',
			text: 'Tree type'
		});

		const typeSelect = typeGroup.createEl('select', { cls: 'crc-form-input' });
		[
			{ value: 'full', label: 'Full family tree (ancestors + descendants)' },
			{ value: 'ancestors', label: 'Ancestors only (parents, grandparents, etc.)' },
			{ value: 'descendants', label: 'Descendants only (children, grandchildren, etc.)' }
		].forEach(option => {
			typeSelect.createEl('option', {
				value: option.value,
				text: option.label
			});
		});
		// Set default to 'full'
		typeSelect.value = 'full';

		typeGroup.createDiv({
			cls: 'crc-form-help',
			text: 'Choose which relatives to include in the tree'
		});

		// Max generations
		const genGroup = configContent.createDiv({ cls: 'crc-form-group' });
		const genLabel = genGroup.createEl('label', {
			cls: 'crc-form-label'
		});
		genLabel.createSpan({ text: 'Maximum generations' });
		const genValueDisplay = genLabel.createSpan({
			cls: 'crc-form-label__value',
			text: ' (5)'
		});

		const genSlider = genGroup.createEl('input', {
			cls: 'crc-form-range',
			attr: {
				type: 'range',
				min: '0',
				max: '10',
				value: '5',
				step: '1'
			}
		}) as HTMLInputElement;

		// Update display when slider changes
		genSlider.addEventListener('input', () => {
			const value = parseInt(genSlider.value);
			genValueDisplay.setText(value === 0 ? ' (Unlimited)' : ` (${value})`);
		});

		genGroup.createDiv({
			cls: 'crc-form-help',
			text: 'Limit the depth of the tree. Set to 0 for unlimited (use with caution on large trees)'
		});

		// Include spouses checkbox
		const spouseGroup = configContent.createDiv({ cls: 'crc-form-group' });
		const spouseContainer = spouseGroup.createDiv({ cls: 'crc-checkbox-container' });
		const spouseCheckbox = spouseContainer.createEl('input', {
			cls: 'crc-checkbox',
			attr: {
				type: 'checkbox',
				id: 'include-spouses'
			}
		});
		// Set initial state to checked
		spouseCheckbox.checked = true;
		spouseContainer.createEl('label', {
			cls: 'crc-checkbox-label',
			text: 'Include spouses in tree',
			attr: { for: 'include-spouses' }
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
		const dirGroup = layoutContent.createDiv({ cls: 'crc-form-group' });
		dirGroup.createEl('label', {
			cls: 'crc-form-label',
			text: 'Tree direction'
		});

		const dirSelect = dirGroup.createEl('select', { cls: 'crc-form-input' });
		[
			{ value: 'vertical', label: 'Vertical (top to bottom)' },
			{ value: 'horizontal', label: 'Horizontal (left to right)' }
		].forEach(option => {
			dirSelect.createEl('option', {
				value: option.value,
				text: option.label
			});
		});

		// Node spacing
		const spacingXGroup = layoutContent.createDiv({ cls: 'crc-form-group' });
		spacingXGroup.createEl('label', {
			cls: 'crc-form-label',
			text: 'Horizontal spacing'
		});
		const spacingXInput = spacingXGroup.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'number',
				min: '100',
				max: '1000',
				value: '300',
				step: '50'
			}
		});

		const spacingYGroup = layoutContent.createDiv({ cls: 'crc-form-group' });
		spacingYGroup.createEl('label', {
			cls: 'crc-form-label',
			text: 'Vertical spacing'
		});
		const spacingYInput = spacingYGroup.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'number',
				min: '100',
				max: '1000',
				value: '200',
				step: '50'
			}
		});

		// Wire up the Generate button (in Root person card)
		this.treeGenerateBtn?.addEventListener('click', async () => {
			await this.handleTreeGeneration(
				rootPersonField,
				typeSelect.value as 'ancestors' | 'descendants' | 'full',
				parseInt(genSlider.value) || 0,
				spouseCheckbox.checked,
				dirSelect.value as 'vertical' | 'horizontal',
				parseInt(spacingXInput.value),
				parseInt(spacingYInput.value),
				this.treeCanvasNameInput?.value || ''
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
		canvasFileName: string
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
				includeSpouses
			};

			// Create canvas generation options with embedded metadata
			const canvasOptions: CanvasGenerationOptions = {
				direction,
				nodeSpacingX: spacingX,
				nodeSpacingY: spacingY,
				colorByGender: true,
				showLabels: true,
				useFamilyChartLayout: true,  // Use family-chart for proper spouse handling
				parentChildArrowStyle: this.plugin.settings.parentChildArrowStyle,
				spouseArrowStyle: this.plugin.settings.spouseArrowStyle,
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
						nodeSpacingY: spacingY
					}
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
				fileName = `Family Tree - ${rootPersonField.name}`;
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

			// Show summary
			new Notice(
				`GEDCOM imported: ${result.notesCreated} notes created, ${result.errors.length} errors`
			);

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
		const fileIcon = createLucideIcon('file-text', 16);
		fileBtn.prepend(fileIcon);

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
			text: 'Export your family tree data to GEDCOM format',
			cls: 'crc-text-muted'
		});

		const exportBtn = exportContent.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-mt-4',
			text: 'Export to GEDCOM'
		});
		const exportIcon = createLucideIcon('download', 16);
		exportBtn.prepend(exportIcon);

		exportBtn.addEventListener('click', () => {
			new Notice('⚠️ GEDCOM export coming in Phase 3');
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
		const logLevelGroup = loggingContent.createDiv({ cls: 'crc-form-group' });
		logLevelGroup.createEl('label', {
			text: 'Log level',
			cls: 'crc-form-label'
		});

		const logLevelSelect = logLevelGroup.createEl('select', {
			cls: 'crc-form-input'
		});

		const logLevels: LogLevel[] = ['off', 'error', 'warn', 'info', 'debug'];
		logLevels.forEach(level => {
			const option = logLevelSelect.createEl('option', {
				text: level.toUpperCase(),
				value: level
			});
			if (level === LoggerFactory.getLogLevel()) {
				option.selected = true;
			}
		});

		logLevelSelect.addEventListener('change', () => {
			const newLevel = logLevelSelect.value as LogLevel;
			LoggerFactory.setLogLevel(newLevel);
			logger.info('settings', 'Log level changed from Control Center', {
				level: newLevel
			});
			new Notice(`Log level set to ${newLevel.toUpperCase()}`);
		});

		const helpText = logLevelGroup.createEl('div', {
			cls: 'crc-form-help'
		});
		helpText.createEl('p', {
			text: 'Controls console output verbosity. Logs are always collected for export.'
		});

		// Export Path Display
		const exportPathGroup = loggingContent.createDiv({ cls: 'crc-form-group crc-mt-4' });
		exportPathGroup.createEl('label', {
			text: 'Export directory',
			cls: 'crc-form-label'
		});

		const exportPathDisplay = exportPathGroup.createEl('div', {
			cls: 'crc-input-with-button'
		});

		const pathInput = exportPathDisplay.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'text',
				readonly: 'true',
				placeholder: 'No directory selected (will prompt on export)'
			}
		});

		if (this.plugin.settings.logExportPath) {
			pathInput.value = this.plugin.settings.logExportPath;
		}

		const changePathBtn = exportPathDisplay.createEl('button', {
			text: 'Change',
			cls: 'crc-btn crc-btn--secondary crc-input-button'
		});

		changePathBtn.addEventListener('click', async () => {
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
		});

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
		const exportIcon = createLucideIcon('download', 16);
		exportButton.prepend(exportIcon);

		exportButton.addEventListener('click', () => {
			this.handleExportLogs();
		});

		const clearButton = buttonGroup.createEl('button', {
			text: 'Clear logs',
			cls: 'crc-btn crc-btn--secondary'
		});
		const clearIcon = createLucideIcon('trash', 16);
		clearButton.prepend(clearIcon);

		clearButton.addEventListener('click', () => {
			logger.info('maintenance', 'Logs cleared from Control Center');
			LoggerFactory.clearLogs();
			new Notice('Logs cleared');
			this.showTab('advanced'); // Refresh the tab
		});

		container.appendChild(loggingCard);

		// Debug Card
		const debugCard = this.createCard({
			title: 'Debug information',
			icon: 'info'
		});

		const debugContent = debugCard.querySelector('.crc-card__content') as HTMLElement;

		debugContent.createEl('p', {
			text: 'Plugin Version: 0.1.0',
			cls: 'crc-text-muted'
		});

		debugContent.createEl('p', {
			text: `Obsidian Version: ${this.app.vault.getName()}`,
			cls: 'crc-text-muted'
		});

		container.appendChild(debugCard);
	}

	/**
	 * Export logs to a file
	 */
	private async handleExportLogs(): Promise<void> {
		try {
			logger.info('export', 'Exporting logs from Control Center');

			const now = new Date();
			const pad = (n: number) => n.toString().padStart(2, '0');
			const filename = `canvas-roots-logs-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;

			const logs = LoggerFactory.getLogs();
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

		// Render results function
		const renderResults = () => {
			resultsContainer.empty();

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

				item.addEventListener('click', () => {
					rootPersonField.name = person.name;
					rootPersonField.crId = person.crId;
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
			text: 'Leave blank for auto-naming: "Family Tree - [Root Person Name]"'
		});

		// Generate button
		const generateBtn = actionsSection.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-btn--large crc-mt-3',
			text: 'Generate family tree'
		});
		const generateIcon = createLucideIcon('play', 16);
		generateBtn.prepend(generateIcon);

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
		const allTreesIcon = createLucideIcon('git-branch', 16);
		allTreesBtn.prepend(allTreesIcon);

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
			selectedPerson.createDiv({
				cls: 'crc-root-person-selected__id',
				text: rootPersonField.crId
			});
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

		return {
			name: file.basename,
			crId: crId,
			// Support both field name conventions: born/died (spec) and birth_date/death_date (Gramps)
			birthDate: cache.frontmatter.born || cache.frontmatter.birth_date,
			deathDate: cache.frontmatter.died || cache.frontmatter.death_date,
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
}
