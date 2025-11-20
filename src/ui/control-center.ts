import { App, Modal, Notice, TFile } from 'obsidian';
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
	private treeRootPersonField?: RelationshipField;
	private treeRootPersonInput?: HTMLInputElement;
	private treeRootPersonBtn?: HTMLButtonElement;
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
			title: 'Vault Statistics',
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

		this.createStatRow(peopleContent, 'Total People', stats.people.totalPeople);
		this.createStatRow(peopleContent, 'With Birth Date', stats.people.peopleWithBirthDate);
		this.createStatRow(peopleContent, 'With Death Date', stats.people.peopleWithDeathDate);
		this.createStatRow(peopleContent, 'Living', stats.people.livingPeople, 'crc-text-success');
		this.createStatRow(peopleContent, 'Orphaned (No Relationships)', stats.people.orphanedPeople,
			stats.people.orphanedPeople > 0 ? 'crc-text-warning' : undefined);

		container.appendChild(peopleCard);

		// Relationships Card
		const relCard = this.createCard({
			title: 'Relationships',
			icon: 'link'
		});
		const relContent = relCard.querySelector('.crc-card__content') as HTMLElement;

		this.createStatRow(relContent, 'Total Relationships', stats.relationships.totalRelationships);
		this.createStatRow(relContent, 'Father Links', stats.relationships.totalFatherLinks);
		this.createStatRow(relContent, 'Mother Links', stats.relationships.totalMotherLinks);
		this.createStatRow(relContent, 'Spouse Links', stats.relationships.totalSpouseLinks);
		this.createStatRow(relContent, 'People with Father', stats.people.peopleWithFather);
		this.createStatRow(relContent, 'People with Mother', stats.people.peopleWithMother);
		this.createStatRow(relContent, 'People with Spouse', stats.people.peopleWithSpouse);

		container.appendChild(relCard);

		// Vault Health Card
		const healthCard = this.createCard({
			title: 'Vault Health',
			icon: 'heart'
		});
		const healthContent = healthCard.querySelector('.crc-card__content') as HTMLElement;

		const completeness = this.calculateCompleteness(stats);
		const healthBar = this.createHealthBar(healthContent, completeness);

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
	}

	/**
	 * Show Data Entry tab
	 */
	private showDataEntryTab(): void {
		const container = this.contentContainer;

		// Create card for person entry form
		const card = this.createCard({
			title: 'Create New Person',
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
	private showTreeGenerationTab(): void {
		const container = this.contentContainer;

		// Title
		const title = container.createEl('h2', { text: 'Generate Family Tree' });
		title.style.marginTop = '0';

		// Intro text
		const intro = container.createEl('p', {
			text: 'Generate a visual family tree on an Obsidian Canvas. Select a root person and configure the tree options below.',
			cls: 'crc-text-muted'
		});

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

		// Root person selection
		const rootPersonField: RelationshipField = { name: '' };

		// Store reference for openWithPerson() to use
		this.treeRootPersonField = rootPersonField;

		// Check if we have a pending root person to pre-populate
		if (this.pendingRootPerson) {
			rootPersonField.name = this.pendingRootPerson.name;
			rootPersonField.crId = this.pendingRootPerson.crId;
			// Clear pending after using it
			this.pendingRootPerson = undefined;
		}

		const rootGroup = configContent.createDiv({ cls: 'crc-form-group' });
		const rootLabel = rootGroup.createEl('label', {
			cls: 'crc-form-label',
			text: 'Root person'
		});
		const rootLabelBadge = rootLabel.createSpan({ cls: 'crc-help-badge', text: 'Required' });
		rootLabelBadge.style.marginLeft = '8px';

		const rootFieldResult = this.createRelationshipField(
			rootGroup,
			'',
			'Select the person to center the tree on',
			rootPersonField
		);

		// Store input and button references
		this.treeRootPersonInput = rootFieldResult.input;
		this.treeRootPersonBtn = rootFieldResult.linkBtn;

		// Tree type selection
		const typeGroup = configContent.createDiv({ cls: 'crc-form-group' });
		typeGroup.createEl('label', {
			cls: 'crc-form-label',
			text: 'Tree type'
		});

		const typeSelect = typeGroup.createEl('select', { cls: 'crc-form-input' });
		[
			{ value: 'ancestors', label: 'Ancestors (Parents, Grandparents, etc.)' },
			{ value: 'descendants', label: 'Descendants (Children, Grandchildren, etc.)' },
			{ value: 'full', label: 'Full Family Tree (Ancestors + Descendants)' }
		].forEach(option => {
			const opt = typeSelect.createEl('option', {
				value: option.value,
				text: option.label
			});
		});

		// Max generations
		const genGroup = configContent.createDiv({ cls: 'crc-form-group' });
		genGroup.createEl('label', {
			cls: 'crc-form-label',
			text: 'Maximum generations'
		});
		const genInput = genGroup.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'number',
				min: '0',
				max: '20',
				value: '5',
				placeholder: '0 = unlimited'
			}
		});
		genGroup.createDiv({
			cls: 'crc-form-help',
			text: 'Set to 0 for unlimited generations (use with caution on large trees)'
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
			{ value: 'vertical', label: 'Vertical (Top to Bottom)' },
			{ value: 'horizontal', label: 'Horizontal (Left to Right)' }
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

		// Output Card
		const outputCard = container.createDiv({ cls: 'crc-card' });
		const outputHeader = outputCard.createDiv({ cls: 'crc-card__header' });
		const outputTitle = outputHeader.createEl('h3', {
			cls: 'crc-card__title',
			text: 'Output options'
		});
		const outputIcon = createLucideIcon('file', 20);
		outputTitle.prepend(outputIcon);

		const outputContent = outputCard.createDiv({ cls: 'crc-card__content' });

		// Canvas file name
		const nameGroup = outputContent.createDiv({ cls: 'crc-form-group' });
		nameGroup.createEl('label', {
			cls: 'crc-form-label',
			text: 'Canvas file name'
		});
		const nameInput = nameGroup.createEl('input', {
			cls: 'crc-form-input',
			attr: {
				type: 'text',
				placeholder: 'Leave blank for auto-naming'
			}
		});
		nameGroup.createDiv({
			cls: 'crc-form-help',
			text: 'Auto-naming format: "Family Tree - [Root Person Name]"'
		});

		// Generate Button
		const generateBtn = outputContent.createEl('button', {
			cls: 'crc-btn crc-btn--primary crc-mt-4',
			text: 'Generate Family Tree'
		});
		const generateIcon = createLucideIcon('play', 16);
		generateBtn.prepend(generateIcon);

		generateBtn.addEventListener('click', async () => {
			await this.handleTreeGeneration(
				rootPersonField,
				typeSelect.value as 'ancestors' | 'descendants' | 'full',
				parseInt(genInput.value) || 0,
				spouseCheckbox.checked,
				dirSelect.value as 'vertical' | 'horizontal',
				parseInt(spacingXInput.value),
				parseInt(spacingYInput.value),
				nameInput.value
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

			// Create canvas generation options
			const canvasOptions: CanvasGenerationOptions = {
				direction,
				nodeSpacingX: spacingX,
				nodeSpacingY: spacingY,
				colorByGender: true,
				showLabels: true,
				useFamilyChartLayout: true  // Use family-chart for proper spouse handling
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

			// Open the canvas file
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);

			new Notice('Family tree generated successfully!');
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
		lines.push('\t\t"frontmatter":{}');
		lines.push('\t}');

		lines.push('}');

		return lines.join('\n');
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

			// Import with vault-sync mode (always create notes)
			const result = await importer.importFile(content, {
				mode: 'vault-sync',
				peopleFolder: this.plugin.settings.peopleFolder,
				overwriteExisting: false
			});

			// Log results
			logger.info('gedcom', `Import complete: ${result.individualsProcessed} individuals processed`);

			if (result.errors.length > 0) {
				logger.warn('gedcom', `Import had ${result.errors.length} errors`);
				result.errors.forEach(error => logger.error('gedcom', error));
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

		fileBtn.addEventListener('click', () => {
			fileInput.click();
		});

		fileInput.addEventListener('change', async (event) => {
			const target = event.target as HTMLInputElement;
			const file = target.files?.[0];
			if (file) {
				await this.handleGedcomImport(file);
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
			const badge = helpEl.createEl('code', {
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
