import { App, Modal } from 'obsidian';
import CanvasRootsPlugin from '../../main';
import { TAB_CONFIGS, createLucideIcon, setLucideIcon, LucideIconName } from './lucide-icons';

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
	private createHeaderActions(container: HTMLElement): void {
		// Close button
		const closeBtn = container.createEl('button', { cls: 'crc-btn crc-btn--secondary' });
		const closeIcon = createLucideIcon('x', 16);
		closeBtn.appendChild(closeIcon);
		closeBtn.appendText('Close');
		closeBtn.addEventListener('click', () => this.close());
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

	// ==========================================================================
	// TAB CONTENT METHODS
	// ==========================================================================

	/**
	 * Show Status tab
	 */
	private showStatusTab(): void {
		const container = this.contentContainer;

		// Create a simple card
		const card = this.createCard({
			title: 'Vault Statistics',
			icon: 'activity'
		});

		const content = card.querySelector('.crc-card__content') as HTMLElement;
		content.createEl('p', { text: 'Total People: 0', cls: 'crc-mb-2' });
		content.createEl('p', { text: 'Total Families: 0', cls: 'crc-mb-2' });
		content.createEl('p', { text: 'Relationship Links: 0', cls: 'crc-mb-2' });

		container.appendChild(card);
	}

	/**
	 * Show Quick Actions tab
	 */
	private showQuickActionsTab(): void {
		this.showPlaceholderTab('quick-actions');
	}

	/**
	 * Show Data Entry tab
	 */
	private showDataEntryTab(): void {
		this.showPlaceholderTab('data-entry');
	}

	/**
	 * Show Tree Generation tab
	 */
	private showTreeGenerationTab(): void {
		this.showPlaceholderTab('tree-generation');
	}

	/**
	 * Show GEDCOM tab
	 */
	private showGedcomTab(): void {
		this.showPlaceholderTab('gedcom');
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
		this.showPlaceholderTab('advanced');
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
}
