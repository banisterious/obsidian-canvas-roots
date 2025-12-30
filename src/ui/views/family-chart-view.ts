/**
 * Interactive Family Chart View
 *
 * An Obsidian ItemView that renders the family-chart library for interactive
 * exploration and editing of family trees.
 */

import { ItemView, WorkspaceLeaf, Menu, TFile, Notice, setIcon, Modal, App } from 'obsidian';
import f3 from 'family-chart';
import * as d3 from 'd3';
import { jsPDF } from 'jspdf';
import type CanvasRootsPlugin from '../../../main';
import { FamilyGraphService, PersonNode } from '../../core/family-graph';
import type { ColorScheme, FamilyChartColors } from '../../settings';
import { getLogger } from '../../core/logging';
import { PersonPickerModal } from '../person-picker';
import { FamilyChartExportWizard } from './family-chart-export-wizard';
import type { ProgressCallback } from './family-chart-export-progress-modal';
import { generateOdt } from './odt-generator';

const logger = getLogger('FamilyChartView');

export const VIEW_TYPE_FAMILY_CHART = 'canvas-roots-family-chart';

/**
 * family-chart person data format
 * Matches the Datum interface from family-chart
 */
interface FamilyChartPerson {
	id: string;
	data: {
		'first name': string;
		'last name': string;
		gender: 'M' | 'F';
		birthday?: string;
		deathday?: string;
		avatar?: string;
		[key: string]: unknown;
	};
	rels: {
		parents: string[];
		spouses: string[];
		children: string[];
	};
	[key: string]: unknown;
}

/**
 * View state that gets persisted
 */
interface FamilyChartViewState {
	rootPersonId: string | null;
	colorScheme: ColorScheme;
	editMode: boolean;
	nodeSpacing?: number;
	levelSpacing?: number;
	showBirthDates?: boolean;
	showDeathDates?: boolean;
	showKinshipLabels?: boolean;
	showAvatars?: boolean;
	isHorizontal?: boolean;
	// Tree depth limits
	ancestryDepth?: number | null;  // null = unlimited
	progenyDepth?: number | null;   // null = unlimited
	// Display options
	showSiblingsOfMain?: boolean;
	showSingleParentEmptyCard?: boolean;
	sortChildrenByBirthDate?: boolean;
	hidePrivateLiving?: boolean;
	[key: string]: unknown;  // Index signature for Record<string, unknown> compatibility
}

/**
 * Interactive Family Chart View
 */
export class FamilyChartView extends ItemView {
	plugin: CanvasRootsPlugin;

	// View state
	private rootPersonId: string | null = null;
	private colorScheme: ColorScheme = 'sex';
	private editMode: boolean = false;
	private nodeSpacing: number = 250; // X spacing between nodes
	private levelSpacing: number = 150; // Y spacing between generations
	private showBirthDates: boolean = true;
	private showDeathDates: boolean = false;
	private showKinshipLabels: boolean = false;
	private showAvatars: boolean = true; // Show person avatar thumbnails on cards
	private isHorizontal: boolean = false; // Tree orientation: false = vertical (top-to-bottom), true = horizontal (left-to-right)
	// Tree depth limits (null = unlimited)
	private ancestryDepth: number | null = null;
	private progenyDepth: number | null = null;
	// Display options
	private showSiblingsOfMain: boolean = true;
	private showSingleParentEmptyCard: boolean = false;
	private sortChildrenByBirthDate: boolean = false;
	private hidePrivateLiving: boolean = false;

	// family-chart instances
	private f3Chart: ReturnType<typeof f3.createChart> | null = null;
	private f3Card: ReturnType<ReturnType<typeof f3.createChart>['setCardSvg']> | null = null;
	private f3EditTree: ReturnType<ReturnType<typeof f3.createChart>['editTree']> | null = null;

	// UI elements
	private toolbarEl: HTMLElement | null = null;
	private chartContainerEl: HTMLElement | null = null;
	private zoomLevelEl: HTMLElement | null = null;
	private editModeBtn: HTMLElement | null = null;
	private historyBackBtn: HTMLElement | null = null;
	private historyForwardBtn: HTMLElement | null = null;

	// Info panel UI elements
	private infoPanelEl: HTMLElement | null = null;
	private infoPanelContentEl: HTMLElement | null = null;
	private infoPanelActionsEl: HTMLElement | null = null;
	private selectedPersonId: string | null = null;
	private infoPanelEditMode: boolean = false;
	private infoPanelEditData: { firstName: string; lastName: string; birthDate: string; deathDate: string; gender: 'M' | 'F' | '' } | null = null;

	// Sync state (prevent infinite loops during sync)
	private isSyncing: boolean = false;

	// Services
	private familyGraphService: FamilyGraphService;

	// Data cache
	private chartData: FamilyChartPerson[] = [];
	// Avatar URL cache - maps crId to resolved avatar URL
	// Persists across chart re-initializations to avoid repeated file lookups
	private avatarUrlCache: Map<string, string> = new Map();

	constructor(leaf: WorkspaceLeaf, plugin: CanvasRootsPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.familyGraphService = new FamilyGraphService(plugin.app);
		const folderFilter = plugin.getFolderFilter();
		if (folderFilter) {
			this.familyGraphService.setFolderFilter(folderFilter);
		}
		this.familyGraphService.setPropertyAliases(plugin.settings.propertyAliases);
		this.familyGraphService.setValueAliases(plugin.settings.valueAliases);
	}

	getViewType(): string {
		return VIEW_TYPE_FAMILY_CHART;
	}

	getDisplayText(): string {
		return 'Family chart';
	}

	getIcon(): string {
		return 'git-fork';
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- Base class requires Promise<void> return type
	async onOpen(): Promise<void> {
		// Build UI structure
		this.buildUI();

		// Initialize chart if we have state
		if (this.rootPersonId) {
			this.initializeChart();
		} else {
			// Check for a marked root person before showing empty state
			const familyGraph = this.plugin.createFamilyGraphService();
			const { rootPerson } = familyGraph.getMarkedRootPerson();
			if (rootPerson) {
				this.rootPersonId = rootPerson.crId;
				this.initializeChart();
			} else {
				this.showEmptyState();
			}
		}

		// Register event handlers
		this.registerEventHandlers();
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- Base class requires Promise<void> return type
	async onClose(): Promise<void> {
		logger.debug('view-close', 'Closing FamilyChartView');
		this.destroyChart();
	}

	/**
	 * Build the UI structure: toolbar, chart container, and info panel
	 */
	private buildUI(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass('cr-family-chart-view');

		// Create toolbar
		this.toolbarEl = container.createDiv({ cls: 'cr-fcv-toolbar' });
		this.buildToolbar();

		// Create main content area with chart and info panel side by side
		const contentArea = container.createDiv({ cls: 'cr-fcv-content' });

		// Create chart container
		this.chartContainerEl = contentArea.createDiv({ cls: 'cr-fcv-chart-container f3' });

		// Create info panel (hidden by default)
		this.infoPanelEl = contentArea.createDiv({ cls: 'cr-fcv-info-panel crc-hidden' });
		this.buildInfoPanel();
	}

	/**
	 * Build the toolbar controls
	 */
	private buildToolbar(): void {
		if (!this.toolbarEl) return;

		const toolbar = this.toolbarEl;
		toolbar.empty();

		// Left side controls
		const leftControls = toolbar.createDiv({ cls: 'cr-fcv-toolbar-left' });

		// Color scheme dropdown
		const colorGroup = leftControls.createDiv({ cls: 'cr-fcv-control-group' });
		colorGroup.createSpan({ text: 'Color:', cls: 'cr-fcv-label' });
		const colorSelect = colorGroup.createEl('select', { cls: 'cr-fcv-select dropdown' });

		const colorOptions: { value: ColorScheme; label: string }[] = [
			{ value: 'sex', label: 'Sex' },
			{ value: 'generation', label: 'Generation' },
			{ value: 'collection', label: 'Collection' },
			{ value: 'monochrome', label: 'Monochrome' }
		];

		for (const opt of colorOptions) {
			const option = colorSelect.createEl('option', { value: opt.value, text: opt.label });
			if (opt.value === this.colorScheme) {
				option.selected = true;
			}
		}

		colorSelect.addEventListener('change', () => {
			this.colorScheme = colorSelect.value as ColorScheme;
			void this.refreshChart();
		});

		// Zoom controls group
		const zoomGroup = leftControls.createDiv({ cls: 'cr-fcv-control-group cr-fcv-zoom-group' });

		// Zoom out button
		const zoomOutBtn = zoomGroup.createEl('button', {
			cls: 'cr-fcv-btn cr-fcv-zoom-btn clickable-icon',
			attr: { 'aria-label': 'Zoom out' }
		});
		setIcon(zoomOutBtn, 'zoom-out');
		zoomOutBtn.addEventListener('click', () => this.zoomOut());

		// Zoom level indicator
		this.zoomLevelEl = zoomGroup.createSpan({ cls: 'cr-fcv-zoom-level', text: '100%' });

		// Zoom in button
		const zoomInBtn = zoomGroup.createEl('button', {
			cls: 'cr-fcv-btn cr-fcv-zoom-btn clickable-icon',
			attr: { 'aria-label': 'Zoom in' }
		});
		setIcon(zoomInBtn, 'zoom-in');
		zoomInBtn.addEventListener('click', () => this.zoomIn());

		// Right side controls
		const rightControls = toolbar.createDiv({ cls: 'cr-fcv-toolbar-right' });

		// Search button
		const searchBtn = rightControls.createEl('button', {
			cls: 'cr-fcv-btn clickable-icon',
			attr: { 'aria-label': 'Search for person' }
		});
		setIcon(searchBtn, 'search');
		searchBtn.addEventListener('click', () => { void this.openPersonSearch(); });

		// Note: Edit mode toggle and undo/redo buttons removed - editing is now done via the info panel

		// Fit to view button
		const fitBtn = rightControls.createEl('button', {
			cls: 'cr-fcv-btn clickable-icon',
			attr: { 'aria-label': 'Fit to view' }
		});
		setIcon(fitBtn, 'maximize-2');
		fitBtn.addEventListener('click', () => this.fitToView());

		// Pop out to main workspace button (only show if in sidebar)
		if (this.isInSidebar()) {
			const popOutBtn = rightControls.createEl('button', {
				cls: 'cr-fcv-btn clickable-icon',
				attr: { 'aria-label': 'Open in main workspace' }
			});
			setIcon(popOutBtn, 'external-link');
			popOutBtn.addEventListener('click', () => this.popOutToMainWorkspace());
		}

		// Layout settings button (orientation, spacing)
		const layoutBtn = rightControls.createEl('button', {
			cls: 'cr-fcv-btn clickable-icon',
			attr: { 'aria-label': 'Layout settings' }
		});
		setIcon(layoutBtn, 'sliders');
		layoutBtn.addEventListener('click', (e) => this.showLayoutMenu(e));

		// Display settings button (card display, visibility options)
		const displayBtn = rightControls.createEl('button', {
			cls: 'cr-fcv-btn clickable-icon',
			attr: { 'aria-label': 'Display settings' }
		});
		setIcon(displayBtn, 'eye');
		displayBtn.addEventListener('click', (e) => this.showDisplayMenu(e));

		// Style settings button (colors, themes)
		const styleBtn = rightControls.createEl('button', {
			cls: 'cr-fcv-btn clickable-icon',
			attr: { 'aria-label': 'Chart colors' }
		});
		setIcon(styleBtn, 'palette');
		styleBtn.addEventListener('click', (e) => this.showStyleMenu(e));

		// Depth settings button (ancestry/progeny limits)
		const depthBtn = rightControls.createEl('button', {
			cls: 'cr-fcv-btn clickable-icon',
			attr: { 'aria-label': 'Tree depth' }
		});
		setIcon(depthBtn, 'git-branch');
		depthBtn.addEventListener('click', (e) => this.showDepthMenu(e));

		// Export button
		const exportBtn = rightControls.createEl('button', {
			cls: 'cr-fcv-btn clickable-icon',
			attr: { 'aria-label': 'Export chart' }
		});
		setIcon(exportBtn, 'download');
		exportBtn.addEventListener('click', () => this.openExportWizard());

		// Refresh button
		const refreshBtn = rightControls.createEl('button', {
			cls: 'cr-fcv-btn clickable-icon',
			attr: { 'aria-label': 'Refresh chart' }
		});
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.addEventListener('click', () => { void this.refreshChart(); });
	}

	/**
	 * Build the info panel structure
	 */
	private buildInfoPanel(): void {
		if (!this.infoPanelEl) return;

		this.infoPanelEl.empty();

		// Header
		const header = this.infoPanelEl.createDiv({ cls: 'cr-fcv-info-panel-header' });
		const headerTitle = header.createEl('h3', { text: 'Person details', cls: 'cr-fcv-info-panel-title' });
		headerTitle.setAttribute('data-view-title', 'Person details');
		headerTitle.setAttribute('data-edit-title', 'Edit person');

		const closeBtn = header.createEl('button', { cls: 'cr-fcv-info-panel-close', attr: { 'aria-label': 'Close panel' } });
		setIcon(closeBtn, 'x');
		closeBtn.addEventListener('click', () => this.closeInfoPanel());

		// Content area (populated dynamically)
		this.infoPanelContentEl = this.infoPanelEl.createDiv({ cls: 'cr-fcv-info-panel-content' });

		// Actions area (Edit button or Save/Cancel)
		this.infoPanelActionsEl = this.infoPanelEl.createDiv({ cls: 'cr-fcv-info-panel-actions' });
	}

	/**
	 * Open the info panel for a specific person
	 */
	private openInfoPanel(personId: string): void {
		if (!this.infoPanelEl) return;

		this.selectedPersonId = personId;
		this.infoPanelEditMode = false;
		this.infoPanelEditData = null;

		// Show the panel
		this.infoPanelEl.removeClass('crc-hidden');

		// Render content
		this.renderInfoPanelContent();
	}

	/**
	 * Close the info panel
	 */
	private closeInfoPanel(): void {
		if (!this.infoPanelEl) return;

		// If in edit mode with changes, ask for confirmation
		if (this.infoPanelEditMode && this.infoPanelEditData) {
			// For now, just discard - could add a confirmation dialog later
		}

		this.selectedPersonId = null;
		this.infoPanelEditMode = false;
		this.infoPanelEditData = null;
		this.infoPanelEl.addClass('crc-hidden');
	}

	/**
	 * Render the info panel content based on current mode (view/edit)
	 */
	private renderInfoPanelContent(): void {
		if (!this.infoPanelContentEl || !this.infoPanelActionsEl || !this.selectedPersonId) return;

		// Find the person data
		const personData = this.chartData.find(p => p.id === this.selectedPersonId);
		if (!personData) {
			this.infoPanelContentEl.empty();
			this.infoPanelContentEl.createEl('p', { text: 'Person not found', cls: 'cr-fcv-info-panel-error' });
			return;
		}

		// Update header title
		const headerTitle = this.infoPanelEl?.querySelector('.cr-fcv-info-panel-header h3');
		if (headerTitle) {
			headerTitle.textContent = this.infoPanelEditMode ? 'Edit person' : 'Person details';
		}

		this.infoPanelContentEl.empty();
		this.infoPanelActionsEl.empty();

		if (this.infoPanelEditMode) {
			this.renderInfoPanelEditMode(personData);
		} else {
			this.renderInfoPanelViewMode(personData);
		}
	}

	/**
	 * Render info panel in view (read-only) mode
	 */
	private renderInfoPanelViewMode(personData: FamilyChartPerson): void {
		if (!this.infoPanelContentEl || !this.infoPanelActionsEl) return;

		// Fields section
		const fieldsSection = this.infoPanelContentEl.createDiv({ cls: 'cr-fcv-info-panel-fields' });

		// First name
		this.createInfoField(fieldsSection, 'First name', personData.data['first name'] || '');

		// Last name
		this.createInfoField(fieldsSection, 'Last name', personData.data['last name'] || '');

		// Birth date
		this.createInfoField(fieldsSection, 'Birth date', personData.data.birthday || '');

		// Death date
		this.createInfoField(fieldsSection, 'Death date', personData.data.deathday || '');

		// Sex
		const sexDisplay = personData.data.gender === 'F' ? 'Female' : personData.data.gender === 'M' ? 'Male' : '';
		this.createInfoField(fieldsSection, 'Sex', sexDisplay);

		// Relationships section
		this.renderRelationshipsSection(personData);

		// Actions - View mode (settings-style: description left, buttons right)
		this.infoPanelActionsEl.addClass('view-mode');
		this.infoPanelActionsEl.removeClass('edit-mode');

		// Description (left side)
		this.infoPanelActionsEl.createDiv({
			cls: 'cr-fcv-info-panel-actions-description',
			text: 'View or edit this person'
		});

		// Buttons container (right side)
		const buttonsContainer = this.infoPanelActionsEl.createDiv({
			cls: 'cr-fcv-info-panel-actions-buttons'
		});

		// Open note button
		const openNoteBtn = buttonsContainer.createEl('button', {
			text: 'Open'
		});
		openNoteBtn.addEventListener('click', () => {
			if (this.selectedPersonId) {
				void this.openPersonNote(this.selectedPersonId);
			}
		});

		// Edit button (primary action)
		const editBtn = buttonsContainer.createEl('button', {
			text: 'Edit',
			cls: 'mod-cta'
		});
		editBtn.addEventListener('click', () => this.enterInfoPanelEditMode(personData));
	}

	/**
	 * Render info panel in edit mode
	 */
	private renderInfoPanelEditMode(personData: FamilyChartPerson): void {
		if (!this.infoPanelContentEl || !this.infoPanelActionsEl) return;

		// Initialize edit data if not already set
		if (!this.infoPanelEditData) {
			this.infoPanelEditData = {
				firstName: personData.data['first name'] || '',
				lastName: personData.data['last name'] || '',
				birthDate: personData.data.birthday || '',
				deathDate: personData.data.deathday || '',
				gender: (personData.data.gender as 'M' | 'F' | '') || ''
			};
		}

		// Fields section
		const fieldsSection = this.infoPanelContentEl.createDiv({ cls: 'cr-fcv-info-panel-fields' });

		// First name input
		this.createInfoFieldInput(fieldsSection, 'First name', this.infoPanelEditData.firstName, (value) => {
			if (this.infoPanelEditData) this.infoPanelEditData.firstName = value;
		});

		// Last name input
		this.createInfoFieldInput(fieldsSection, 'Last name', this.infoPanelEditData.lastName, (value) => {
			if (this.infoPanelEditData) this.infoPanelEditData.lastName = value;
		});

		// Birth date input
		this.createInfoFieldInput(fieldsSection, 'Birth date', this.infoPanelEditData.birthDate, (value) => {
			if (this.infoPanelEditData) this.infoPanelEditData.birthDate = value;
		}, 'Not recorded');

		// Death date input
		this.createInfoFieldInput(fieldsSection, 'Death date', this.infoPanelEditData.deathDate, (value) => {
			if (this.infoPanelEditData) this.infoPanelEditData.deathDate = value;
		}, 'Not recorded');

		// Sex dropdown
		const sexField = fieldsSection.createDiv({ cls: 'cr-fcv-info-field' });
		sexField.createDiv({ cls: 'cr-fcv-info-field-label', text: 'Sex' });
		const sexSelect = sexField.createEl('select', { cls: 'cr-fcv-info-field-select dropdown' });
		const options = [
			{ value: '', label: 'Unknown' },
			{ value: 'M', label: 'Male' },
			{ value: 'F', label: 'Female' }
		];
		for (const opt of options) {
			const optionEl = sexSelect.createEl('option', { value: opt.value, text: opt.label });
			if (this.infoPanelEditData.gender === opt.value) {
				optionEl.selected = true;
			}
		}
		sexSelect.addEventListener('change', () => {
			if (this.infoPanelEditData) {
				this.infoPanelEditData.gender = sexSelect.value as 'M' | 'F' | '';
			}
		});

		// Relationships section (read-only in edit mode for now)
		this.renderRelationshipsSection(personData);

		// Actions - Edit mode (buttons right-aligned)
		this.infoPanelActionsEl.removeClass('view-mode');
		this.infoPanelActionsEl.addClass('edit-mode');

		// Buttons container
		const buttonsContainer = this.infoPanelActionsEl.createDiv({
			cls: 'cr-fcv-info-panel-actions-buttons'
		});

		// Cancel button (secondary)
		const cancelBtn = buttonsContainer.createEl('button', {
			text: 'Cancel'
		});
		cancelBtn.addEventListener('click', () => this.cancelInfoPanelEdit());

		// Save button (primary)
		const saveBtn = buttonsContainer.createEl('button', {
			text: 'Save',
			cls: 'mod-cta'
		});
		saveBtn.addEventListener('click', () => void this.saveInfoPanelChanges());
	}

	/**
	 * Create a read-only info field
	 */
	private createInfoField(container: HTMLElement, label: string, value: string): void {
		const field = container.createDiv({ cls: 'cr-fcv-info-field' });
		field.createDiv({ cls: 'cr-fcv-info-field-label', text: label });
		const valueEl = field.createDiv({ cls: 'cr-fcv-info-field-value' });
		if (value) {
			valueEl.textContent = value;
		} else {
			valueEl.textContent = 'Not recorded';
			valueEl.addClass('empty');
		}
	}

	/**
	 * Create an editable info field input
	 */
	private createInfoFieldInput(container: HTMLElement, label: string, value: string, onChange: (value: string) => void, placeholder?: string): void {
		const field = container.createDiv({ cls: 'cr-fcv-info-field' });
		field.createDiv({ cls: 'cr-fcv-info-field-label', text: label });
		const input = field.createEl('input', {
			type: 'text',
			value: value,
			placeholder: placeholder || '',
			cls: 'cr-fcv-info-field-input'
		});
		input.addEventListener('input', () => onChange(input.value));
	}

	/**
	 * Render the relationships section
	 */
	private renderRelationshipsSection(personData: FamilyChartPerson): void {
		if (!this.infoPanelContentEl) return;

		const relSection = this.infoPanelContentEl.createDiv({ cls: 'cr-fcv-info-panel-relationships' });
		relSection.createEl('h4', { text: 'Relationships' });

		// Parents
		if (personData.rels.parents.length > 0) {
			this.renderRelationshipGroup(relSection, 'Parents', personData.rels.parents);
		}

		// Spouses
		if (personData.rels.spouses.length > 0) {
			this.renderRelationshipGroup(relSection, 'Spouses', personData.rels.spouses);
		}

		// Children
		if (personData.rels.children.length > 0) {
			this.renderRelationshipGroup(relSection, 'Children', personData.rels.children);
		}

		// If no relationships
		if (personData.rels.parents.length === 0 && personData.rels.spouses.length === 0 && personData.rels.children.length === 0) {
			relSection.createEl('p', { text: 'No relationships recorded', cls: 'cr-fcv-info-panel-no-rels' });
		}
	}

	/**
	 * Render a group of relationships (parents, spouses, or children)
	 */
	private renderRelationshipGroup(container: HTMLElement, label: string, personIds: string[]): void {
		const group = container.createDiv({ cls: 'cr-fcv-relationship-group' });
		group.createDiv({ cls: 'cr-fcv-relationship-group-label', text: label });

		for (const personId of personIds) {
			const relPerson = this.chartData.find(p => p.id === personId);
			const name = relPerson
				? `${relPerson.data['first name'] || ''} ${relPerson.data['last name'] || ''}`.trim() || 'Unknown'
				: 'Unknown';

			const link = group.createEl('a', {
				cls: 'cr-fcv-relationship-link',
				href: '#',
				text: name
			});
			link.addEventListener('click', (e) => {
				e.preventDefault();
				this.navigateToPersonInChart(personId);
			});
		}
	}

	/**
	 * Navigate to a person in the chart and open their info panel
	 */
	private navigateToPersonInChart(personId: string): void {
		// Update chart to center on the person
		if (this.f3Chart) {
			this.f3Chart.updateMainId(personId);
			this.f3Chart.updateTree({});
		}

		// Open their info panel
		this.openInfoPanel(personId);
	}

	/**
	 * Enter edit mode in the info panel
	 */
	private enterInfoPanelEditMode(personData: FamilyChartPerson): void {
		this.infoPanelEditMode = true;
		this.infoPanelEditData = {
			firstName: personData.data['first name'] || '',
			lastName: personData.data['last name'] || '',
			birthDate: personData.data.birthday || '',
			deathDate: personData.data.deathday || '',
			gender: (personData.data.gender as 'M' | 'F' | '') || ''
		};
		this.renderInfoPanelContent();
	}

	/**
	 * Cancel edit mode and revert to view mode
	 */
	private cancelInfoPanelEdit(): void {
		this.infoPanelEditMode = false;
		this.infoPanelEditData = null;
		this.renderInfoPanelContent();
	}

	/**
	 * Save changes from the info panel edit mode
	 */
	private async saveInfoPanelChanges(): Promise<void> {
		if (!this.selectedPersonId || !this.infoPanelEditData) return;

		logger.info('info-panel-save', 'Saving info panel changes', {
			personId: this.selectedPersonId,
			data: this.infoPanelEditData
		});

		// Build datum object for syncDatumToMarkdown
		const datum = {
			id: this.selectedPersonId,
			data: {
				'first name': this.infoPanelEditData.firstName,
				'last name': this.infoPanelEditData.lastName,
				'birthday': this.infoPanelEditData.birthDate,
				'deathday': this.infoPanelEditData.deathDate,
				'gender': this.infoPanelEditData.gender
			}
		};

		// Sync to markdown
		await this.syncDatumToMarkdown(datum);

		// Update local chart data
		const personIndex = this.chartData.findIndex(p => p.id === this.selectedPersonId);
		if (personIndex >= 0) {
			this.chartData[personIndex].data['first name'] = this.infoPanelEditData.firstName;
			this.chartData[personIndex].data['last name'] = this.infoPanelEditData.lastName;
			this.chartData[personIndex].data.birthday = this.infoPanelEditData.birthDate;
			this.chartData[personIndex].data.deathday = this.infoPanelEditData.deathDate;
			if (this.infoPanelEditData.gender === 'M' || this.infoPanelEditData.gender === 'F') {
				this.chartData[personIndex].data.gender = this.infoPanelEditData.gender;
			}
		}

		// Exit edit mode
		this.infoPanelEditMode = false;
		this.infoPanelEditData = null;

		// Refresh the chart to show updated data
		await this.refreshChart();

		// Re-render the panel in view mode
		this.renderInfoPanelContent();

		new Notice('Changes saved');
	}

	/**
	 * Show empty state when no root person is selected
	 */
	private showEmptyState(): void {
		if (!this.chartContainerEl) return;

		this.chartContainerEl.empty();
		const emptyState = this.chartContainerEl.createDiv({ cls: 'cr-fcv-empty-state' });

		emptyState.createEl('h3', { text: 'No person selected' });

		const instructions = emptyState.createDiv({ cls: 'cr-fcv-empty-state__instructions' });
		instructions.createEl('p', { text: 'To view a family chart:' });

		const list = instructions.createEl('ul');
		list.createEl('li', { text: 'Click "Select a person" below, or' });
		list.createEl('li', { text: 'Open a person note (with cr_id property) and run "Open family chart"' });

		const selectBtn = emptyState.createEl('button', {
			text: 'Select a person',
			cls: 'mod-cta'
		});
		selectBtn.addEventListener('click', () => { void this.promptSelectPerson(); });

		// Add hint about cr_id requirement
		const hint = emptyState.createDiv({ cls: 'cr-fcv-empty-state__hint' });
		hint.createEl('small', {
			text: 'Tip: Person notes need a cr_id property to appear in the chart.',
			cls: 'mod-muted'
		});
	}

	/**
	 * Open person picker to select root person
	 */
	private promptSelectPerson(): void {
		const folderFilter = this.plugin.getFolderFilter() ?? undefined;

		new PersonPickerModal(this.app, (selectedPerson) => {
			this.rootPersonId = selectedPerson.crId;
			void this.initializeChart();
		}, folderFilter).open();
	}

	/**
	 * Initialize the family-chart instance
	 */
	private initializeChart(): void {
		if (!this.chartContainerEl) return;

		logger.debug('chart-init', 'Initializing chart', { rootPersonId: this.rootPersonId });

		// Close info panel when switching to a new chart
		this.closeInfoPanel();

		// Clear container
		this.chartContainerEl.empty();

		// Load family data
		this.loadChartData();

		if (this.chartData.length === 0) {
			this.showEmptyState();
			return;
		}

		// Apply theme-appropriate styling
		const isDarkMode = document.body.classList.contains('theme-dark');
		const customColors = this.plugin.settings.familyChartColors;

		// Set CSS variables - family-chart relies on these for card colors
		// Use custom colors if set, otherwise use defaults
		this.chartContainerEl.setCssProps({
			'--female-color': customColors?.femaleColor ?? 'rgb(196, 138, 146)',
			'--male-color': customColors?.maleColor ?? 'rgb(120, 159, 172)',
			'--genderless-color': customColors?.unknownColor ?? 'lightgray',
			'--background-color': isDarkMode
				? (customColors?.backgroundDark ?? 'rgb(33, 33, 33)')
				: (customColors?.backgroundLight ?? 'rgb(250, 250, 250)'),
			'--text-color': isDarkMode
				? (customColors?.textDark ?? '#fff')
				: (customColors?.textLight ?? '#333')
		});
		// Set direct styles on container (hidden until chart is positioned)
		this.chartContainerEl.setCssStyles({
			backgroundColor: isDarkMode
				? (customColors?.backgroundDark ?? 'rgb(33, 33, 33)')
				: (customColors?.backgroundLight ?? 'rgb(250, 250, 250)'),
			color: isDarkMode
				? (customColors?.textDark ?? '#fff')
				: (customColors?.textLight ?? '#333'),
			visibility: 'hidden'
		});

		// Show loading overlay during initial positioning (positioned absolutely over the container)
		const loadingOverlay = this.chartContainerEl.createDiv({ cls: 'cr-family-chart-loading' });
		loadingOverlay.createSpan({ cls: 'cr-family-chart-loading__spinner' });
		loadingOverlay.createSpan({ cls: 'cr-family-chart-loading__text', text: 'Loading chart...' });

		try {
			// Create the chart with normal transition time
			this.f3Chart = f3.createChart(this.chartContainerEl, this.chartData)
				.setTransitionTime(800)
				.setCardXSpacing(this.nodeSpacing)
				.setCardYSpacing(this.levelSpacing);

			// Apply tree orientation
			if (this.isHorizontal) {
				this.f3Chart.setOrientationHorizontal();
			}

			// Apply tree depth limits
			if (this.ancestryDepth !== null) {
				this.f3Chart.setAncestryDepth(this.ancestryDepth);
			}
			if (this.progenyDepth !== null) {
				this.f3Chart.setProgenyDepth(this.progenyDepth);
			}

			// Apply display options
			this.f3Chart.setShowSiblingsOfMain(this.showSiblingsOfMain);
			this.f3Chart.setSingleParentEmptyCard(this.showSingleParentEmptyCard, { label: 'Unknown' });

			// Apply sort children by birth date
			if (this.sortChildrenByBirthDate) {
				this.f3Chart.setSortChildrenFunction((a, b) => {
					const aBirthday = a.data?.birthday || '';
					const bBirthday = b.data?.birthday || '';
					// Sort by birthday string (works for ISO dates)
					if (!aBirthday && !bBirthday) return 0;
					if (!aBirthday) return 1; // No date goes last
					if (!bBirthday) return -1;
					return aBirthday.localeCompare(bBirthday);
				});
			}

			// Apply privacy filter for living persons
			if (this.hidePrivateLiving) {
				this.f3Chart.setPrivateCardsConfig({
					condition: (d) => {
						// Consider a person "living" if they have no death date
						return !d.data?.deathday;
					}
				});
			}

			// Configure SVG cards with current display options
			const displayFields: string[][] = [['first name', 'last name']];
			if (this.showBirthDates && this.showDeathDates) {
				displayFields.push(['birthday', 'deathday']);
			} else if (this.showBirthDates) {
				displayFields.push(['birthday']);
			} else if (this.showDeathDates) {
				displayFields.push(['deathday']);
			}

			this.f3Card = this.f3Chart.setCardSvg()
				.setCardDisplay(displayFields)
				.setCardDim({ w: 200, h: 70, text_x: 75, text_y: 15, img_w: 60, img_h: 60, img_x: 5, img_y: 5 })
				.setOnCardClick((e, d) => this.handleCardClick(e, d))
				.setOnCardUpdate(this.createOpenNoteButtonCallback());

			// Initialize EditTree for editing capabilities
			this.initializeEditTree();

			// Set main/root person if specified
			if (this.rootPersonId) {
				this.f3Chart.updateMainId(this.rootPersonId);
			}

			// Initial render without fit (just get the tree in the DOM)
			this.f3Chart.updateTree({ initial: true });

			// Defer fit operation until container dimensions are stable
			setTimeout(() => {
				if (this.f3Chart && this.chartContainerEl) {
					// Trigger fit when container has proper dimensions
					this.f3Chart.updateTree({ tree_position: 'fit' });
					// Show container after animation completes
					setTimeout(() => {
						if (this.chartContainerEl) {
							this.chartContainerEl.setCssStyles({ visibility: 'visible' });
							loadingOverlay.remove();
						}
					}, 850);
				}
			}, 50);

			// Render kinship labels if enabled (after chart is rendered)
			if (this.showKinshipLabels) {
				setTimeout(() => this.renderKinshipLabels(), 100);
			}
		} catch (error) {
			// Remove loading overlay and show error state
			loadingOverlay.remove();
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;
			logger.error('chart-init', 'Failed to initialize chart', { message: errorMessage, stack: errorStack });
			console.error('[Canvas Roots] Family chart initialization error:', error);

			// Show error state with more detail
			const errorContainer = this.chartContainerEl.createDiv({ cls: 'cr-family-chart-error' });
			errorContainer.createEl('h3', { text: 'Chart Error' });
			errorContainer.createEl('p', { text: errorMessage || 'Failed to render family chart. Check the console for details.' });
			return;
		}

		logger.info('chart-init', 'Chart initialized', {
			personCount: this.chartData.length,
			rootPersonId: this.rootPersonId
		});
	}

	/**
	 * Load and transform data from person notes to family-chart format
	 */
	private loadChartData(): void {
		const startTime = performance.now();

		// Ensure cache is loaded first
		this.familyGraphService.ensureCacheLoaded();
		const cacheLoadTime = performance.now();

		// Get all people from the vault
		const people = this.familyGraphService.getAllPeople();
		const getAllPeopleTime = performance.now();

		// Build set of valid IDs first (needed to filter out broken relationship references)
		const validIds = new Set(people.map(p => p.crId));

		// Build a map for O(1) lookups during child validation
		const peopleMap = new Map(people.map(p => [p.crId, p]));
		const buildMapsTime = performance.now();

		// Pre-resolve avatar URLs for people not already cached
		// This allows the cache to persist across chart re-initializations
		if (this.showAvatars) {
			this.preResolveAvatars(people);
		}
		const avatarResolveTime = performance.now();

		// Transform to family-chart format, filtering relationship IDs to only valid ones
		this.chartData = people.map(person => this.transformPersonNode(person, validIds, peopleMap));
		const transformTime = performance.now();

		logger.debug('data-load', 'Loaded chart data', {
			count: this.chartData.length,
			avatarsCached: this.avatarUrlCache.size,
			timing: {
				cacheLoad: `${(cacheLoadTime - startTime).toFixed(1)}ms`,
				getAllPeople: `${(getAllPeopleTime - cacheLoadTime).toFixed(1)}ms`,
				buildMaps: `${(buildMapsTime - getAllPeopleTime).toFixed(1)}ms`,
				avatarResolve: `${(avatarResolveTime - buildMapsTime).toFixed(1)}ms`,
				transform: `${(transformTime - avatarResolveTime).toFixed(1)}ms`,
				total: `${(transformTime - startTime).toFixed(1)}ms`
			}
		});
	}

	/**
	 * Pre-resolve avatar URLs for all people with media.
	 * Only resolves URLs not already in the cache, making subsequent
	 * chart initializations faster (e.g., when toggling avatars).
	 */
	private preResolveAvatars(people: PersonNode[]): void {
		const mediaService = this.plugin.getMediaService();
		if (!mediaService) return;

		let newlyResolved = 0;
		let cachedHits = 0;

		for (const person of people) {
			// Skip if already cached
			if (this.avatarUrlCache.has(person.crId)) {
				cachedHits++;
				continue;
			}

			// Skip if no media
			if (!person.media || person.media.length === 0) {
				continue;
			}

			// Resolve and cache the avatar URL
			const thumbnailFile = mediaService.getFirstThumbnailFile(person.media);
			if (thumbnailFile) {
				const avatarUrl = this.app.vault.getResourcePath(thumbnailFile);
				this.avatarUrlCache.set(person.crId, avatarUrl);
				newlyResolved++;
			}
		}

		logger.debug('avatar-cache', 'Pre-resolved avatar URLs', {
			newlyResolved,
			cachedHits,
			totalCached: this.avatarUrlCache.size
		});
	}

	/**
	 * Transform PersonNode to family-chart format
	 * @param person The person node to transform
	 * @param validIds Set of valid person IDs (for filtering broken relationship references)
	 * @param peopleMap Map of crId to PersonNode for O(1) lookups
	 */
	private transformPersonNode(person: PersonNode, validIds: Set<string>, peopleMap: Map<string, PersonNode>): FamilyChartPerson {
		// Parse name into first and last
		const nameParts = (person.name || '').trim().split(' ');
		const firstName = nameParts[0] || '';
		const lastName = nameParts.slice(1).join(' ');

		// Map gender - family-chart requires 'M' or 'F', default to 'M' if unknown
		let gender: 'M' | 'F' = 'M';
		const sex = person.sex?.toLowerCase();
		if (sex === 'f' || sex === 'female') {
			gender = 'F';
		}

		// Build parents array - family-chart library allows max 2 parents per person
		// Priority: biological parents first, then adoptive if no biological
		// Step-parents are not included (would require separate representation)
		// Filter to only valid IDs (prevents family-chart crash when referenced person is outside folder filter)
		const parents: string[] = [];

		// Try biological parents first
		if (person.fatherCrId && validIds.has(person.fatherCrId)) {
			parents.push(person.fatherCrId);
		}
		if (person.motherCrId && validIds.has(person.motherCrId)) {
			parents.push(person.motherCrId);
		}

		// If no biological parents, try gender-neutral parents
		if (parents.length === 0 && person.parentCrIds) {
			for (const parentId of person.parentCrIds) {
				if (validIds.has(parentId)) {
					parents.push(parentId);
				}
			}
		}

		// If no biological or gender-neutral parents, use adoptive parents as fallback
		// This ensures adopted children appear connected to their adoptive family
		if (parents.length === 0) {
			if (person.adoptiveFatherCrId && validIds.has(person.adoptiveFatherCrId)) {
				parents.push(person.adoptiveFatherCrId);
			}
			if (person.adoptiveMotherCrId && validIds.has(person.adoptiveMotherCrId)) {
				parents.push(person.adoptiveMotherCrId);
			}
		}

		// Filter spouses to only valid IDs
		const spouses = (person.spouseCrIds || []).filter(id => validIds.has(id));

		// Filter children to only valid IDs AND only those who reference this person as a parent
		// family-chart requires strict bidirectional relationships: if parent lists child,
		// the child MUST list the parent back, otherwise family-chart throws
		// "child has more than 1 parent" error during tree construction
		// Include biological, gender-neutral, and adoptive children (matching the parent logic above)
		const children = (person.childrenCrIds || []).filter(childId => {
			if (!validIds.has(childId)) return false;
			// Use the pre-built map for O(1) lookup instead of service call
			const childPerson = peopleMap.get(childId);
			if (!childPerson) return false;
			// Check biological parent relationship
			if (childPerson.fatherCrId === person.crId || childPerson.motherCrId === person.crId) {
				return true;
			}
			// Check gender-neutral parent relationship (if child has no biological parents)
			if (!childPerson.fatherCrId && !childPerson.motherCrId) {
				if (childPerson.parentCrIds && childPerson.parentCrIds.includes(person.crId)) {
					return true;
				}
			}
			// Check adoptive parent relationship (only if child has no biological or gender-neutral parents)
			// This matches the parent logic: adoptive parents only used when no biological/gender-neutral parents
			if (!childPerson.fatherCrId && !childPerson.motherCrId && (!childPerson.parentCrIds || childPerson.parentCrIds.length === 0)) {
				if (childPerson.adoptiveFatherCrId === person.crId || childPerson.adoptiveMotherCrId === person.crId) {
					return true;
				}
			}
			return false;
		});

		// Get avatar from cache (pre-resolved in loadChartData)
		// The cache persists across re-initializations, making avatar toggle fast
		let avatar: string | undefined;
		if (this.showAvatars) {
			avatar = this.avatarUrlCache.get(person.crId);
		}

		return {
			id: person.crId,
			data: {
				'first name': firstName,
				'last name': lastName,
				gender,
				birthday: person.birthDate,
				deathday: person.deathDate,
				avatar,
			},
			rels: {
				parents,
				spouses,
				children,
			}
		};
	}

	/**
	 * Handle click on a person card
	 * The d parameter is a TreeDatum from family-chart
	 */
	private handleCardClick(_e: MouseEvent, d: { data: { id: string; [key: string]: unknown } }): void {
		const personId = d.data.id;

		logger.debug('card-click', 'Card clicked', { personId });

		// Open the info panel for this person
		// Note: We don't call onCardClickDefault here because it would re-center the tree
		// and reset the zoom level. Users can navigate to a person via the relationships
		// section which will re-center intentionally.
		this.openInfoPanel(personId);
	}

	/**
	 * Create the onCardUpdate callback for adding "Open note" buttons to cards
	 *
	 * family-chart's onCardUpdate callback is called with `this` bound to the card's
	 * SVG group element (<g class="card">). We need to return a regular function
	 * (not arrow) to preserve that binding, while capturing a reference to the view
	 * instance for the click handler.
	 */
	private createOpenNoteButtonCallback(): (d: { data: { id: string } }) => void {
		// eslint-disable-next-line @typescript-eslint/no-this-alias -- Capture view reference for use inside regular function below
		const view = this;

		// Return a regular function so `this` is bound to the card element by family-chart
		return function(this: SVGGElement, d: { data: { id: string } }) {
			// eslint-disable-next-line @typescript-eslint/no-this-alias -- Capture card element reference for d3 operations
			const cardEl = this;
			const personId = d.data.id;

			// Check if button already exists (prevents duplicates on re-render)
			if (d3.select(cardEl).select('.cr-open-note-btn').size() > 0) return;

			// Create button group positioned in top-right corner
			// Card dimensions: w=200, h=70
			// Position at (185, 12) to keep button visible within card bounds
			const btnGroup = d3.select(cardEl)
				.select('.card-inner')
				.append('g')
				.attr('class', 'cr-open-note-btn')
				.attr('transform', 'translate(185, 12)')
				.style('cursor', 'pointer');

			// Add circle background
			btnGroup.append('circle')
				.attr('r', 9)
				.attr('fill', 'var(--background-primary)')
				.attr('stroke', 'var(--text-muted)')
				.attr('stroke-width', 1);

			// Add file-text icon (simplified SVG path for a document)
			btnGroup.append('path')
				.attr('d', 'M-4,-5 L2,-5 L5,-2 L5,5 L-4,5 Z M2,-5 L2,-2 L5,-2')
				.attr('fill', 'none')
				.attr('stroke', 'var(--text-muted)')
				.attr('stroke-width', 1.2)
				.attr('stroke-linecap', 'round')
				.attr('stroke-linejoin', 'round');

			// Add click handler
			btnGroup.on('click', function(event: MouseEvent) {
				event.stopPropagation(); // Prevent card click from triggering
				void view.openPersonNote(personId);
			});

			// Add hover effect
			btnGroup.on('mouseenter', function() {
				d3.select(this).select('circle')
					.attr('fill', 'var(--interactive-accent)')
					.attr('stroke', 'var(--interactive-accent)');
				d3.select(this).select('path')
					.attr('stroke', 'var(--text-on-accent)');
			});

			btnGroup.on('mouseleave', function() {
				d3.select(this).select('circle')
					.attr('fill', 'var(--background-primary)')
					.attr('stroke', 'var(--text-muted)');
				d3.select(this).select('path')
					.attr('stroke', 'var(--text-muted)');
			});
		};
	}

	/**
	 * Open the note for a person by their cr_id
	 */
	private async openPersonNote(crId: string): Promise<void> {
		// Find the file for this person
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter?.cr_id === crId) {
				// Open in a new leaf beside this one
				const leaf = this.app.workspace.getLeaf('tab');
				await leaf.openFile(file);
				return;
			}
		}

		logger.warn('open-note', 'Could not find note for person', { crId });
	}

	/**
	 * Refresh the chart with current data
	 * @param waitForMetadataCache If true, waits for Obsidian's metadata cache to process (needed after batch operations).
	 *                             If false, reloads immediately (suitable for live updates triggered by file change events).
	 */
	async refreshChart(waitForMetadataCache: boolean = false): Promise<void> {
		// Clear and reload the caches
		this.familyGraphService.clearCache();
		// Also clear avatar cache so we pick up any media changes
		this.avatarUrlCache.clear();

		if (waitForMetadataCache) {
			// Wait for Obsidian's metadata cache to finish processing (needed after batch operations)
			await new Promise(resolve => setTimeout(resolve, 2000));
		}

		// Check if root_person marking has changed
		const familyGraph = this.plugin.createFamilyGraphService();
		const { rootPerson } = familyGraph.getMarkedRootPerson();

		if (rootPerson) {
			// A root person is marked - use them
			this.rootPersonId = rootPerson.crId;
			this.initializeChart();
		} else if (this.rootPersonId) {
			// No marked root, but we have a current selection - keep it
			this.initializeChart();
		} else {
			// No marked root and no current selection
			this.showEmptyState();
		}
	}

	/**
	 * Fit chart to view (zoom to show all nodes)
	 */
	private fitToView(): void {
		if (this.f3Chart) {
			this.f3Chart.updateTree({ tree_position: 'fit' });
			// Delay display update to allow fit animation to complete
			setTimeout(() => this.updateZoomLevelDisplay(), 300);
		}
	}

	/**
	 * Zoom in by a fixed amount
	 */
	private zoomIn(): void {
		if (!this.f3Chart) return;

		const svg = this.f3Chart.svg;
		if (svg) {
			// Get current zoom to validate before zooming
			const currentTransform = f3.handlers.getCurrentZoom(svg);
			if (!currentTransform || !isFinite(currentTransform.k)) {
				logger.warn('zoom', 'Invalid zoom state, resetting to fit');
				this.fitToView();
				return;
			}
			// manualZoom uses scaleBy which multiplies, so 1.2 = zoom in by 20%
			f3.handlers.manualZoom({ amount: 1.2, svg, transition_time: 200 });
			this.updateZoomLevelDisplay();
		}
	}

	/**
	 * Zoom out by a fixed amount
	 */
	private zoomOut(): void {
		if (!this.f3Chart) return;

		const svg = this.f3Chart.svg;
		if (svg) {
			// Get current zoom to validate before zooming
			const currentTransform = f3.handlers.getCurrentZoom(svg);
			if (!currentTransform || !isFinite(currentTransform.k)) {
				logger.warn('zoom', 'Invalid zoom state, resetting to fit');
				this.fitToView();
				return;
			}
			// Prevent zooming out too far (minimum 10% zoom)
			if (currentTransform.k <= 0.1) {
				logger.debug('zoom', 'Already at minimum zoom level');
				return;
			}
			// manualZoom uses scaleBy which multiplies, so 0.8 = zoom out by 20%
			f3.handlers.manualZoom({ amount: 0.8, svg, transition_time: 200 });
			this.updateZoomLevelDisplay();
		}
	}

	/**
	 * Update the zoom level display in the toolbar
	 */
	private updateZoomLevelDisplay(): void {
		if (!this.f3Chart || !this.zoomLevelEl) return;

		const svg = this.f3Chart.svg;
		if (svg) {
			// Delay slightly to allow zoom transition to complete
			setTimeout(() => {
				const transform = f3.handlers.getCurrentZoom(svg);
				// Guard against NaN or invalid transform
				if (!transform || !isFinite(transform.k)) {
					logger.warn('zoom', 'Invalid zoom transform', { transform });
					if (this.zoomLevelEl) {
						this.zoomLevelEl.textContent = '100%';
					}
					return;
				}
				const percentage = Math.round(transform.k * 100);
				if (this.zoomLevelEl) {
					this.zoomLevelEl.textContent = `${percentage}%`;
				}
			}, 250);
		}
	}

	// ============ Search ============

	/**
	 * Open person search modal to find and center on a person
	 */
	private openPersonSearch(): void {
		const folderFilter = this.plugin.getFolderFilter() ?? undefined;

		new PersonPickerModal(this.app, (selectedPerson) => {
			this.centerOnPerson(selectedPerson.crId);
		}, folderFilter).open();
	}

	/**
	 * Center the chart on a specific person
	 */
	private centerOnPerson(crId: string): void {
		if (!this.f3Chart) return;

		// Find the datum for this person
		const datum = this.chartData.find(p => p.id === crId);
		if (!datum) {
			logger.warn('center-person', 'Person not found in chart data', { crId });
			return;
		}

		// Update main ID to make this person the focus
		this.f3Chart.updateMainId(crId);
		this.f3Chart.updateTree({ tree_position: 'main_to_middle' });

		logger.debug('center-person', 'Centered on person', { crId, name: `${datum.data['first name']} ${datum.data['last name']}` });
	}

	// ============ History (Undo/Redo) ============

	/**
	 * Go back in edit history (undo)
	 */
	private historyBack(): void {
		if (!this.f3EditTree) return;

		const history = this.f3EditTree.history;
		if (history && history.canBack()) {
			history.back();
			this.updateHistoryButtons();
			logger.debug('history', 'Undo performed');
		}
	}

	/**
	 * Go forward in edit history (redo)
	 */
	private historyForward(): void {
		if (!this.f3EditTree) return;

		const history = this.f3EditTree.history;
		if (history && history.canForward()) {
			history.forward();
			this.updateHistoryButtons();
			logger.debug('history', 'Redo performed');
		}
	}

	/**
	 * Update the enabled/disabled state of history buttons
	 */
	private updateHistoryButtons(): void {
		if (!this.f3EditTree || !this.historyBackBtn || !this.historyForwardBtn) return;

		const history = this.f3EditTree.history;
		if (!history) {
			this.historyBackBtn.setAttribute('disabled', 'true');
			this.historyForwardBtn.setAttribute('disabled', 'true');
			return;
		}

		// Update back button
		if (history.canBack()) {
			this.historyBackBtn.removeAttribute('disabled');
		} else {
			this.historyBackBtn.setAttribute('disabled', 'true');
		}

		// Update forward button
		if (history.canForward()) {
			this.historyForwardBtn.removeAttribute('disabled');
		} else {
			this.historyForwardBtn.setAttribute('disabled', 'true');
		}
	}

	// ============ Export ============

	/**
	 * Open the export wizard modal
	 */
	private openExportWizard(): void {
		const wizard = new FamilyChartExportWizard(this.plugin, this);
		wizard.open();
	}

	/**
	 * Get export information for the wizard to display estimates
	 */
	getExportInfo(): {
		rootPersonName: string;
		peopleCount: number;
		avatarCount: number;
	} {
		// Get root person name
		let rootPersonName = 'unknown';
		if (this.rootPersonId && this.chartData.length > 0) {
			const rootPerson = this.chartData.find(p => p.id === this.rootPersonId);
			if (rootPerson) {
				const firstName = rootPerson.data['first name'] || '';
				const lastName = rootPerson.data['last name'] || '';
				rootPersonName = `${firstName} ${lastName}`.trim() || 'unknown';
			}
		}

		// Count avatars
		let avatarCount = 0;
		for (const person of this.chartData) {
			if (person.data.avatar) {
				avatarCount++;
			}
		}

		return {
			rootPersonName,
			peopleCount: this.chartData.length,
			avatarCount
		};
	}

	/**
	 * PDF page size definitions (in points, 72 points = 1 inch)
	 */
	private static readonly PDF_PAGE_SIZES: Record<string, { width: number; height: number; label: string } | null> = {
		fit: null, // Dynamic sizing to match content
		a4: { width: 595, height: 842, label: 'A4' },
		letter: { width: 612, height: 792, label: 'Letter' },
		legal: { width: 612, height: 1008, label: 'Legal' },
		tabloid: { width: 792, height: 1224, label: 'Tabloid' }
	};

	/**
	 * Export chart with options from the wizard
	 */
	async exportWithOptions(options: {
		format: 'png' | 'svg' | 'pdf' | 'odt';
		filename: string;
		includeAvatars: boolean;
		scale?: number;
		// PDF/ODT-specific options
		pageSize?: 'fit' | 'a4' | 'letter' | 'legal' | 'tabloid';
		layout?: 'single' | 'tiled';
		orientation?: 'auto' | 'portrait' | 'landscape';
		includeCoverPage?: boolean;
		coverTitle?: string;
		coverSubtitle?: string;
		// Progress tracking
		onProgress?: ProgressCallback;
		isCancelled?: () => boolean;
	}): Promise<void> {
		const { format, filename, includeAvatars, scale, onProgress, isCancelled } = options;

		switch (format) {
			case 'png':
				await this.exportAsPngWithOptions(filename, includeAvatars, scale ?? 2, onProgress, isCancelled);
				break;
			case 'svg':
				await this.exportAsSvgWithOptions(filename, includeAvatars, onProgress, isCancelled);
				break;
			case 'pdf':
				await this.exportAsPdfWithOptions(filename, includeAvatars, scale ?? 2, {
					pageSize: options.pageSize ?? 'fit',
					layout: options.layout ?? 'single',
					orientation: options.orientation ?? 'auto',
					includeCoverPage: options.includeCoverPage ?? false,
					coverTitle: options.coverTitle ?? '',
					coverSubtitle: options.coverSubtitle ?? ''
				}, onProgress, isCancelled);
				break;
			case 'odt':
				await this.exportAsOdtWithOptions(filename, includeAvatars, scale ?? 2, {
					includeCoverPage: options.includeCoverPage ?? false,
					coverTitle: options.coverTitle ?? '',
					coverSubtitle: options.coverSubtitle ?? ''
				}, onProgress, isCancelled);
				break;
		}
	}

	/**
	 * Export as PNG with options
	 */
	private async exportAsPngWithOptions(
		filename: string,
		includeAvatars: boolean,
		scale: number,
		onProgress?: ProgressCallback,
		isCancelled?: () => boolean
	): Promise<void> {
		if (!this.f3Chart) return;

		const svg = this.f3Chart.svg;
		if (!svg) {
			new Notice('No chart to export');
			return;
		}

		try {
			onProgress?.({ phase: 'preparing', current: 0, total: 100, message: 'Preparing chart...' });

			const { svgClone, width, height } = this.prepareSvgForExport(svg as SVGSVGElement);

			logger.debug('export-png', 'Preparing PNG export', { width, height, scale, includeAvatars });

			// Check for canvas size limits
			const maxDimension = 16384;
			const maxArea = 268435456;
			const scaledWidth = width * scale;
			const scaledHeight = height * scale;
			const scaledArea = scaledWidth * scaledHeight;

			if (scaledWidth > maxDimension || scaledHeight > maxDimension) {
				new Notice(`Chart too large for PNG export (${Math.round(width)}x${Math.round(height)}px). Try SVG export instead.`, 0);
				return;
			}

			if (scaledArea > maxArea) {
				new Notice(`Chart too large for PNG export (${Math.round(scaledArea / 1000000)}M pixels). Try SVG export instead.`, 0);
				return;
			}

			// Check for cancellation
			if (isCancelled?.()) return;

			// Handle avatars based on option
			if (includeAvatars) {
				await this.embedImagesAsBase64WithProgress(svgClone, onProgress, isCancelled);
				if (isCancelled?.()) return;
			} else {
				// Remove avatar images
				const imageElements = svgClone.querySelectorAll('image[href]');
				imageElements.forEach((imgEl) => {
					const href = imgEl.getAttribute('href') || imgEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
					if (href?.startsWith('app://')) {
						imgEl.remove();
					}
				});
			}

			onProgress?.({ phase: 'rendering', current: 0, total: 100, message: 'Rendering image...' });

			// Serialize SVG
			const serializer = new XMLSerializer();
			const svgString = serializer.serializeToString(svgClone);
			const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
			const svgUrl = URL.createObjectURL(svgBlob);

			// Create canvas and draw SVG
			const canvas = document.createElement('canvas');
			canvas.width = scaledWidth;
			canvas.height = scaledHeight;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				new Notice('Failed to create canvas context');
				return;
			}

			const img = new Image();
			img.onload = () => {
				ctx.scale(scale, scale);
				ctx.drawImage(img, 0, 0);
				URL.revokeObjectURL(svgUrl);

				onProgress?.({ phase: 'encoding', current: 0, total: 100, message: 'Creating PNG...' });

				canvas.toBlob((blob) => {
					if (blob) {
						onProgress?.({ phase: 'saving', current: 0, total: 100, message: 'Saving file...' });
						const url = URL.createObjectURL(blob);
						const link = document.createElement('a');
						link.href = url;
						link.download = filename;
						link.click();
						URL.revokeObjectURL(url);
						onProgress?.({ phase: 'complete', current: 100, total: 100, message: 'Done!' });
						new Notice('PNG exported successfully');
					} else {
						new Notice('Failed to create PNG image');
					}
				}, 'image/png');
			};
			img.onerror = () => {
				URL.revokeObjectURL(svgUrl);
				new Notice('Failed to render chart as PNG. Try SVG export instead.');
			};
			img.src = svgUrl;

		} catch (error) {
			logger.error('export-png', 'Failed to export PNG', { error });
			new Notice('Failed to export PNG');
		}
	}

	/**
	 * Export as SVG with options
	 */
	private async exportAsSvgWithOptions(
		filename: string,
		includeAvatars: boolean,
		onProgress?: ProgressCallback,
		isCancelled?: () => boolean
	): Promise<void> {
		if (!this.f3Chart) return;

		const svg = this.f3Chart.svg;
		if (!svg) {
			new Notice('No chart to export');
			return;
		}

		try {
			onProgress?.({ phase: 'preparing', current: 0, total: 100, message: 'Preparing chart...' });

			const { svgClone } = this.prepareSvgForExport(svg as SVGSVGElement);

			// Check for cancellation
			if (isCancelled?.()) return;

			// Handle avatars based on option
			const imageElements = svgClone.querySelectorAll('image[href]');
			if (includeAvatars) {
				await this.embedImagesAsBase64WithProgress(svgClone, onProgress, isCancelled);
				if (isCancelled?.()) return;
			} else {
				imageElements.forEach((imgEl) => {
					const href = imgEl.getAttribute('href') || imgEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
					if (href?.startsWith('app://')) {
						imgEl.remove();
					}
				});
			}

			onProgress?.({ phase: 'saving', current: 0, total: 100, message: 'Saving file...' });

			// Serialize and download
			const serializer = new XMLSerializer();
			const svgString = serializer.serializeToString(svgClone);
			const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			link.click();
			URL.revokeObjectURL(url);

			onProgress?.({ phase: 'complete', current: 100, total: 100, message: 'Done!' });
			new Notice('SVG exported successfully');

		} catch (error) {
			logger.error('export-svg', 'Failed to export SVG', { error });
			new Notice('Failed to export SVG');
		}
	}

	/**
	 * Export as PDF with options
	 */
	private async exportAsPdfWithOptions(
		filename: string,
		includeAvatars: boolean,
		scale: number,
		pdfOptions: {
			pageSize: 'fit' | 'a4' | 'letter' | 'legal' | 'tabloid';
			layout: 'single' | 'tiled';
			orientation: 'auto' | 'portrait' | 'landscape';
			includeCoverPage: boolean;
			coverTitle: string;
			coverSubtitle: string;
		},
		onProgress?: ProgressCallback,
		isCancelled?: () => boolean
	): Promise<void> {
		if (!this.f3Chart) return;

		const svg = this.f3Chart.svg;
		if (!svg) {
			new Notice('No chart to export');
			return;
		}

		try {
			onProgress?.({ phase: 'preparing', current: 0, total: 100, message: 'Preparing chart...' });

			const { svgClone, width, height } = this.prepareSvgForExport(svg as SVGSVGElement);

			logger.debug('export-pdf', 'Preparing PDF export', {
				width, height, scale, includeAvatars, pdfOptions
			});

			// Check for canvas size limits
			const maxDimension = 16384;
			const maxArea = 268435456;
			const scaledWidth = width * scale;
			const scaledHeight = height * scale;
			const scaledArea = scaledWidth * scaledHeight;

			if (scaledWidth > maxDimension || scaledHeight > maxDimension) {
				new Notice(`Chart too large for PDF export (${Math.round(width)}x${Math.round(height)}px). Try SVG export instead.`, 0);
				return;
			}

			if (scaledArea > maxArea) {
				new Notice(`Chart too large for PDF export (${Math.round(scaledArea / 1000000)}M pixels). Try SVG export instead.`, 0);
				return;
			}

			// Check for cancellation
			if (isCancelled?.()) return;

			// Handle avatars based on option
			if (includeAvatars) {
				await this.embedImagesAsBase64WithProgress(svgClone, onProgress, isCancelled);
				if (isCancelled?.()) return;
			} else {
				const imageElements = svgClone.querySelectorAll('image[href]');
				imageElements.forEach((imgEl) => {
					const href = imgEl.getAttribute('href') || imgEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
					if (href?.startsWith('app://')) {
						imgEl.remove();
					}
				});
			}

			// Load Roboto fonts from pdfmake VFS for visual consistency with report PDFs
			const robotoFonts = await this.loadRobotoFonts();

			// Serialize SVG
			const serializer = new XMLSerializer();
			const svgString = serializer.serializeToString(svgClone);
			const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
			const svgUrl = URL.createObjectURL(svgBlob);

			onProgress?.({ phase: 'rendering', current: 0, total: 100, message: 'Rendering image...' });

			// Create canvas
			const canvas = document.createElement('canvas');
			canvas.width = scaledWidth;
			canvas.height = scaledHeight;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				new Notice('Failed to create canvas context');
				return;
			}

			const img = new Image();
			img.onload = () => {
				ctx.scale(scale, scale);
				ctx.drawImage(img, 0, 0);
				URL.revokeObjectURL(svgUrl);

				onProgress?.({ phase: 'encoding', current: 0, total: 100, message: 'Creating PDF...' });

				// Determine PDF dimensions and orientation
				const pageSpec = FamilyChartView.PDF_PAGE_SIZES[pdfOptions.pageSize];

				let pdfOrientation: 'portrait' | 'landscape';
				let pdfFormat: [number, number] | string;

				if (pageSpec === null) {
					// "Fit to content" mode - use chart dimensions
					pdfOrientation = width > height ? 'landscape' : 'portrait';
					pdfFormat = [width, height];
				} else {
					// Fixed page size
					if (pdfOptions.orientation === 'auto') {
						pdfOrientation = width > height ? 'landscape' : 'portrait';
					} else {
						pdfOrientation = pdfOptions.orientation;
					}

					// For fixed page sizes, we scale the chart to fit
					pdfFormat = pdfOptions.pageSize.toUpperCase();
				}

				// Create PDF
				const pdf = new jsPDF({
					orientation: pdfOrientation,
					unit: 'pt', // Use points for standard page sizes
					format: pdfFormat
				});

				// Register Roboto fonts if available
				const useRoboto = robotoFonts !== null;
				if (robotoFonts) {
					this.registerRobotoFonts(pdf, robotoFonts);
				}

				// Set document metadata
				pdf.setDocumentProperties({
					title: pdfOptions.coverTitle || filename.replace('.pdf', ''),
					subject: 'Family Tree Chart',
					author: 'Canvas Roots - Obsidian Plugin',
					keywords: 'family tree, genealogy, chart',
					creator: 'Canvas Roots'
				});

				// Track total pages for footer
				const totalPages = pdfOptions.includeCoverPage ? 2 : 1;
				let currentPage = 1;

				// Add cover page if requested
				// Note: Cover page has its own footer section with date, people count, and branding
				// so we don't add the standard footer (which would duplicate "Generated on")
				if (pdfOptions.includeCoverPage) {
					this.addPdfCoverPage(pdf, pdfOptions.coverTitle, pdfOptions.coverSubtitle, useRoboto);
					currentPage++;
					pdf.addPage(pdfFormat, pdfOrientation);
				}

				// Calculate image placement
				const pdfWidth = pdf.internal.pageSize.getWidth();
				const pdfHeight = pdf.internal.pageSize.getHeight();
				const imgData = canvas.toDataURL('image/png');

				if (pageSpec === null) {
					// Fit to content - image fills the page
					pdf.addImage(imgData, 'PNG', 0, 0, width, height);
				} else {
					// Fixed page size - scale image to fit with padding
					const padding = 20; // points
					const footerHeight = 30; // Reserve space for footer
					const availableWidth = pdfWidth - (padding * 2);
					const availableHeight = pdfHeight - (padding * 2) - footerHeight;

					const chartAspect = width / height;
					const pageAspect = availableWidth / availableHeight;

					let imgWidth: number, imgHeight: number;
					if (chartAspect > pageAspect) {
						// Chart is wider - fit to width
						imgWidth = availableWidth;
						imgHeight = availableWidth / chartAspect;
					} else {
						// Chart is taller - fit to height
						imgHeight = availableHeight;
						imgWidth = availableHeight * chartAspect;
					}

					// Center the image (vertically adjusted for footer)
					const x = (pdfWidth - imgWidth) / 2;
					const y = (pdfHeight - imgHeight - footerHeight) / 2;

					pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
				}

				// Add footer to chart page
				this.addPdfFooter(pdf, currentPage, totalPages, useRoboto);

				onProgress?.({ phase: 'saving', current: 0, total: 100, message: 'Saving file...' });
				pdf.save(filename);
				onProgress?.({ phase: 'complete', current: 100, total: 100, message: 'Done!' });
				new Notice('PDF exported successfully');
			};
			img.onerror = () => {
				URL.revokeObjectURL(svgUrl);
				new Notice('Failed to render chart as PDF. Try SVG export instead.');
			};
			img.src = svgUrl;

		} catch (error) {
			logger.error('export-pdf', 'Failed to export PDF', { error });
			new Notice('Failed to export PDF');
		}
	}

	/**
	 * Export as ODT with options
	 */
	private async exportAsOdtWithOptions(
		filename: string,
		includeAvatars: boolean,
		scale: number,
		odtOptions: {
			includeCoverPage: boolean;
			coverTitle: string;
			coverSubtitle: string;
		},
		onProgress?: ProgressCallback,
		isCancelled?: () => boolean
	): Promise<void> {
		if (!this.f3Chart) return;

		const svg = this.f3Chart.svg;
		if (!svg) {
			new Notice('No chart to export');
			return;
		}

		try {
			onProgress?.({ phase: 'preparing', current: 0, total: 100, message: 'Preparing chart...' });

			const { svgClone, width, height } = this.prepareSvgForExport(svg as SVGSVGElement);

			logger.debug('export-odt', 'Preparing ODT export', {
				width, height, scale, includeAvatars, odtOptions
			});

			// Check for canvas size limits
			const maxDimension = 16384;
			const maxArea = 268435456;
			const scaledWidth = width * scale;
			const scaledHeight = height * scale;
			const scaledArea = scaledWidth * scaledHeight;

			if (scaledWidth > maxDimension || scaledHeight > maxDimension) {
				new Notice(`Chart too large for ODT export (${Math.round(width)}x${Math.round(height)}px). Try SVG export instead.`, 0);
				return;
			}

			if (scaledArea > maxArea) {
				new Notice(`Chart too large for ODT export (${Math.round(scaledArea / 1000000)}M pixels). Try SVG export instead.`, 0);
				return;
			}

			// Check for cancellation
			if (isCancelled?.()) return;

			// Handle avatars based on option
			if (includeAvatars) {
				await this.embedImagesAsBase64WithProgress(svgClone, onProgress, isCancelled);
				if (isCancelled?.()) return;
			} else {
				const imageElements = svgClone.querySelectorAll('image[href]');
				imageElements.forEach((imgEl) => {
					const href = imgEl.getAttribute('href') || imgEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
					if (href?.startsWith('app://')) {
						imgEl.remove();
					}
				});
			}

			onProgress?.({ phase: 'rendering', current: 0, total: 100, message: 'Rendering image...' });

			// Serialize SVG
			const serializer = new XMLSerializer();
			const svgString = serializer.serializeToString(svgClone);
			const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
			const svgUrl = URL.createObjectURL(svgBlob);

			// Create canvas
			const canvas = document.createElement('canvas');
			canvas.width = scaledWidth;
			canvas.height = scaledHeight;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				new Notice('Failed to create canvas context');
				return;
			}

			const img = new Image();
			img.onload = async () => {
				ctx.scale(scale, scale);
				ctx.drawImage(img, 0, 0);
				URL.revokeObjectURL(svgUrl);

				onProgress?.({ phase: 'encoding', current: 0, total: 100, message: 'Creating ODT...' });

				// Get PNG data from canvas
				const pngDataUrl = canvas.toDataURL('image/png');

				// Get export info for cover page
				const exportInfo = this.getExportInfo();

				// Generate ODT using the odt-generator module
				const odtBlob = await generateOdt({
					title: odtOptions.coverTitle || `${exportInfo.rootPersonName} Family Tree`,
					chartImageData: pngDataUrl,
					chartWidth: scaledWidth,
					chartHeight: scaledHeight,
					includeCoverPage: odtOptions.includeCoverPage,
					coverTitle: odtOptions.coverTitle,
					coverSubtitle: odtOptions.coverSubtitle,
					peopleCount: exportInfo.peopleCount,
					rootPersonName: exportInfo.rootPersonName
				});

				onProgress?.({ phase: 'saving', current: 0, total: 100, message: 'Saving file...' });

				// Download the ODT file
				const url = URL.createObjectURL(odtBlob);
				const link = document.createElement('a');
				link.href = url;
				link.download = filename;
				link.click();
				URL.revokeObjectURL(url);

				onProgress?.({ phase: 'complete', current: 100, total: 100, message: 'Done!' });
				new Notice('ODT exported successfully');
			};
			img.onerror = () => {
				URL.revokeObjectURL(svgUrl);
				new Notice('Failed to render chart as ODT. Try SVG export instead.');
			};
			img.src = svgUrl;

		} catch (error) {
			logger.error('export-odt', 'Failed to export ODT', { error });
			new Notice('Failed to export ODT');
		}
	}

	/**
	 * Load Roboto fonts from pdfmake's VFS for use in jsPDF
	 * This provides visual consistency with report PDFs which use pdfmake
	 */
	private async loadRobotoFonts(): Promise<Record<string, string> | null> {
		try {
			const vfsFonts = await import('pdfmake/build/vfs_fonts');
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- vfs_fonts export structure varies
			const vfsModule = vfsFonts as any;

			// Debug: log the actual structure we're getting
			logger.debug('pdf-fonts', 'VFS module structure', {
				topLevelKeys: Object.keys(vfsModule),
				hasPdfMake: !!vfsModule.pdfMake,
				hasDefault: !!vfsModule.default,
				hasVfs: !!vfsModule.vfs,
				defaultKeys: vfsModule.default ? Object.keys(vfsModule.default) : []
			});

			// Try multiple possible structures based on bundler behavior
			let vfs = null;

			// Structure 1: Direct pdfMake.vfs
			if (vfsModule.pdfMake?.vfs) {
				vfs = vfsModule.pdfMake.vfs;
				logger.debug('pdf-fonts', 'Found VFS at pdfMake.vfs');
			}
			// Structure 2: default.pdfMake.vfs
			else if (vfsModule.default?.pdfMake?.vfs) {
				vfs = vfsModule.default.pdfMake.vfs;
				logger.debug('pdf-fonts', 'Found VFS at default.pdfMake.vfs');
			}
			// Structure 3: Direct vfs property
			else if (vfsModule.vfs) {
				vfs = vfsModule.vfs;
				logger.debug('pdf-fonts', 'Found VFS at vfs');
			}
			// Structure 4: default.vfs
			else if (vfsModule.default?.vfs) {
				vfs = vfsModule.default.vfs;
				logger.debug('pdf-fonts', 'Found VFS at default.vfs');
			}
			// Structure 5: The module itself might be the vfs object (check for Roboto keys)
			else if (vfsModule['Roboto-Regular.ttf']) {
				vfs = vfsModule;
				logger.debug('pdf-fonts', 'Module itself is the VFS');
			}
			// Structure 6: default is the vfs object
			else if (vfsModule.default?.['Roboto-Regular.ttf']) {
				vfs = vfsModule.default;
				logger.debug('pdf-fonts', 'default is the VFS');
			}

			if (!vfs) {
				logger.warn('pdf-fonts', 'Could not locate VFS in module structure');
				return null;
			}

			// Debug: log available font keys
			const fontKeys = Object.keys(vfs).filter(k => k.includes('Roboto'));
			logger.debug('pdf-fonts', 'Available Roboto fonts in VFS', { fontKeys });

			const regular = vfs['Roboto-Regular.ttf'];
			const medium = vfs['Roboto-Medium.ttf'];
			const italic = vfs['Roboto-Italic.ttf'];
			const mediumItalic = vfs['Roboto-MediumItalic.ttf'];

			// Verify fonts were found
			if (!regular || !medium) {
				logger.warn('pdf-fonts', 'Roboto fonts not found in VFS', {
					hasRegular: !!regular,
					hasMedium: !!medium,
					hasItalic: !!italic,
					hasMediumItalic: !!mediumItalic
				});
				return null;
			}

			logger.debug('pdf-fonts', 'Successfully loaded Roboto fonts from pdfmake VFS');

			return {
				regular,
				medium,
				italic: italic || regular, // Fallback to regular if italic missing
				mediumItalic: mediumItalic || medium // Fallback to medium if mediumItalic missing
			};
		} catch (error) {
			logger.warn('pdf-fonts', 'Failed to load Roboto fonts, falling back to Helvetica', { error });
			return null;
		}
	}

	/**
	 * Register Roboto fonts with jsPDF instance
	 */
	private registerRobotoFonts(pdf: jsPDF, fonts: Record<string, string>): void {
		try {
			// Add font files to jsPDF's virtual file system
			pdf.addFileToVFS('Roboto-Regular.ttf', fonts.regular);
			pdf.addFileToVFS('Roboto-Medium.ttf', fonts.medium);
			pdf.addFileToVFS('Roboto-Italic.ttf', fonts.italic);
			pdf.addFileToVFS('Roboto-MediumItalic.ttf', fonts.mediumItalic);

			// Register the fonts with jsPDF
			pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
			pdf.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');
			pdf.addFont('Roboto-Italic.ttf', 'Roboto', 'italic');
			pdf.addFont('Roboto-MediumItalic.ttf', 'Roboto', 'bolditalic');

			logger.debug('pdf-fonts', 'Roboto fonts registered with jsPDF');
		} catch (error) {
			logger.error('pdf-fonts', 'Failed to register Roboto fonts with jsPDF', { error });
			throw error;
		}
	}

	/**
	 * Add a styled cover page to the PDF
	 * Design matches the report PDF cover page style from pdf-report-renderer.ts
	 * Uses Roboto font for visual consistency with report PDFs
	 */
	private addPdfCoverPage(pdf: jsPDF, title: string, subtitle: string, useRoboto: boolean): void {
		const pageWidth = pdf.internal.pageSize.getWidth();
		const pageHeight = pdf.internal.pageSize.getHeight();

		// Font family - use Roboto if loaded, otherwise fall back to Helvetica
		const fontFamily = useRoboto ? 'Roboto' : 'helvetica';

		// Vertical position for title (about 42% from top - better visual balance)
		const titleY = pageHeight * 0.42;

		// Title - centered, large font (28pt in reports, same here for consistency)
		pdf.setFontSize(28);
		pdf.setFont(fontFamily, 'bold');
		pdf.setTextColor(51, 51, 51); // #333333 - primary text color
		pdf.text(title, pageWidth / 2, titleY, { align: 'center' });

		// Subtitle if provided (italics, secondary color)
		if (subtitle) {
			const subtitleY = titleY + 28;
			pdf.setFontSize(16);
			pdf.setFont(fontFamily, 'italic');
			pdf.setTextColor(102, 102, 102); // #666666 - secondary text color
			pdf.text(subtitle, pageWidth / 2, subtitleY, { align: 'center' });
		}

		// Generation info near bottom (compact layout)
		const now = new Date();
		const dateStr = now.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});

		const footerY = pageHeight - 55;

		// "Generated on" date
		pdf.setFontSize(10);
		pdf.setFont(fontFamily, 'normal');
		pdf.setTextColor(128, 128, 128); // #808080 - muted text
		pdf.text(`Generated on ${dateStr}`, pageWidth / 2, footerY, { align: 'center' });

		// People count
		pdf.text(`${this.chartData.length} people`, pageWidth / 2, footerY + 14, { align: 'center' });

		// "Canvas Roots for Obsidian" branding
		pdf.setFontSize(9);
		pdf.setTextColor(170, 170, 170); // #aaaaaa - light muted
		pdf.text('Canvas Roots for Obsidian', pageWidth / 2, footerY + 26, { align: 'center' });

		// Reset text color for subsequent pages
		pdf.setTextColor(0, 0, 0);
	}

	/**
	 * Add a footer to the current page
	 * Design matches the report PDF footer style from pdf-report-renderer.ts
	 * Page numbers only shown for multi-page documents (2+ pages)
	 * Uses Roboto font for visual consistency with report PDFs
	 */
	private addPdfFooter(pdf: jsPDF, currentPage: number, totalPages: number, useRoboto: boolean): void {
		const pageWidth = pdf.internal.pageSize.getWidth();
		const pageHeight = pdf.internal.pageSize.getHeight();

		// Font family - use Roboto if loaded, otherwise fall back to Helvetica
		const fontFamily = useRoboto ? 'Roboto' : 'helvetica';

		// Format date like reports
		const now = new Date();
		const dateStr = now.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});

		// Footer Y position (near bottom with margin)
		const footerY = pageHeight - 20;
		const margin = 40;

		pdf.setFontSize(9);
		pdf.setFont(fontFamily, 'normal');
		pdf.setTextColor(128, 128, 128); // Muted gray

		// Left side: Generated date
		pdf.text(`Generated: ${dateStr}`, margin, footerY, { align: 'left' });

		// Right side: Page X of Y (only for multi-page documents)
		if (totalPages > 1) {
			pdf.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
		}

		// Reset text color
		pdf.setTextColor(0, 0, 0);
	}

	/**
	 * Show export menu with PNG and SVG options
	 * @deprecated Use openExportWizard() instead - kept for potential fallback
	 */
	private showExportMenu(e: MouseEvent): void {
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle('Export as PNG')
				.setIcon('image')
				.onClick(() => void this.exportAsPng());
		});

		menu.addItem((item) => {
			item.setTitle('Export as SVG')
				.setIcon('file-code')
				.onClick(() => void this.exportAsSvg(true));
		});

		menu.addItem((item) => {
			item.setTitle('Export as SVG (no avatars)')
				.setIcon('file-code')
				.onClick(() => void this.exportAsSvg(false));
		});

		menu.addItem((item) => {
			item.setTitle('Export as PDF')
				.setIcon('file-text')
				.onClick(() => void this.exportAsPdf());
		});

		menu.showAtMouseEvent(e);
	}

	/**
	 * Inline computed styles into SVG elements for export
	 * This is necessary because CSS styles are not included when serializing SVG
	 */
	private inlineStyles(source: Element, target: Element): void {
		const computedStyle = window.getComputedStyle(source);

		// Copy relevant style properties
		const relevantProperties = [
			'fill', 'stroke', 'stroke-width', 'font-family', 'font-size',
			'font-weight', 'text-anchor', 'dominant-baseline', 'opacity',
			'fill-opacity', 'stroke-opacity', 'visibility', 'display'
		];

		let styleString = '';
		for (const prop of relevantProperties) {
			const value = computedStyle.getPropertyValue(prop);
			if (value) {
				styleString += `${prop}:${value};`;
			}
		}

		// For text elements, ensure fill is set (SVG text uses fill, not color)
		const isTextElement = source.tagName === 'text' || source.tagName === 'tspan';
		if (isTextElement) {
			const fill = computedStyle.getPropertyValue('fill');
			const color = computedStyle.getPropertyValue('color');
			// If fill is not set or is default black, try using color property
			if ((!fill || fill === 'none' || fill === 'rgb(0, 0, 0)') && color && color !== 'rgb(0, 0, 0)') {
				styleString += `fill:${color};`;
			}
			// Fallback: ensure text is visible based on theme
			if (!styleString.includes('fill:') || styleString.includes('fill:rgb(0, 0, 0)')) {
				const isDark = document.body.classList.contains('theme-dark');
				styleString += `fill:${isDark ? '#ffffff' : '#333333'};`;
			}
		}

		if (styleString && target instanceof SVGElement) {
			const existingStyle = target.getAttribute('style') || '';
			target.setAttribute('style', existingStyle + styleString);
		}

		// Recursively inline styles for children
		const sourceChildren = Array.from(source.children);
		const targetChildren = Array.from(target.children);
		for (let i = 0; i < sourceChildren.length && i < targetChildren.length; i++) {
			this.inlineStyles(sourceChildren[i], targetChildren[i]);
		}
	}

	/**
	 * Generate export filename from pattern
	 * Replaces {name} with root person's name and {date} with current date
	 */
	private generateExportFilename(extension: string): string {
		const pattern = this.plugin.settings.exportFilenamePattern || '{name}-family-chart-{date}';

		// Get root person's name
		let personName = 'unknown';
		if (this.rootPersonId && this.chartData.length > 0) {
			const rootPerson = this.chartData.find(p => p.id === this.rootPersonId);
			if (rootPerson) {
				const firstName = rootPerson.data['first name'] || '';
				const lastName = rootPerson.data['last name'] || '';
				personName = `${firstName} ${lastName}`.trim() || 'unknown';
			}
		}

		// Sanitize name for filename (remove characters invalid in filenames)
		const sanitizedName = personName.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '-');

		// Format date as YYYY-MM-DD
		const date = new Date().toISOString().split('T')[0];

		// Replace placeholders
		const filename = pattern
			.replace(/{name}/g, sanitizedName)
			.replace(/{date}/g, date);

		return `${filename}.${extension}`;
	}

	/**
	 * Export the chart as PNG
	 */
	private async exportAsPng(): Promise<void> {
		if (!this.f3Chart) return;

		const svg = this.f3Chart.svg;
		if (!svg) {
			new Notice('No chart to export');
			return;
		}

		try {
			// Prepare SVG for export using shared helper
			const { svgClone, width, height } = this.prepareSvgForExport(svg as SVGSVGElement);

			logger.debug('export-png', 'Preparing PNG export', { width, height, area: width * height });

			// Check for canvas size limits (browsers typically cap at ~16384px or ~268 million pixels)
			const maxDimension = 16384;
			const maxArea = 268435456; // 2^28 pixels
			const scaledWidth = width * 2;
			const scaledHeight = height * 2;
			const scaledArea = scaledWidth * scaledHeight;

			if (scaledWidth > maxDimension || scaledHeight > maxDimension) {
				logger.warn('export-png', 'Canvas dimensions exceed browser limits', { scaledWidth, scaledHeight, maxDimension });
				new Notice(`Chart too large for PNG export (${Math.round(width)}x${Math.round(height)}px). Try SVG export instead.`, 0);
				return;
			}

			if (scaledArea > maxArea) {
				logger.warn('export-png', 'Canvas area exceeds browser limits', { scaledArea, maxArea });
				new Notice(`Chart too large for PNG export (${Math.round(scaledArea / 1000000)}M pixels). Try SVG export instead.`, 0);
				return;
			}

			// Embed avatar images as base64 for export
			await this.embedImagesAsBase64(svgClone);

			// Serialize SVG
			const serializer = new XMLSerializer();
			const svgString = serializer.serializeToString(svgClone);
			const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
			const svgUrl = URL.createObjectURL(svgBlob);

			logger.debug('export-png', 'SVG serialized', { svgStringLength: svgString.length });

			// Create canvas and draw SVG
			const canvas = document.createElement('canvas');
			canvas.width = scaledWidth;
			canvas.height = scaledHeight;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				new Notice('Failed to create canvas context');
				return;
			}

			// Generate filename before the async callback
			const filename = this.generateExportFilename('png');

			const img = new Image();
			img.onload = () => {
				logger.debug('export-png', 'Image loaded, drawing to canvas');
				ctx.scale(2, 2);
				ctx.drawImage(img, 0, 0);
				URL.revokeObjectURL(svgUrl);

				// Download PNG
				canvas.toBlob((blob) => {
					if (blob) {
						logger.debug('export-png', 'Blob created', { size: blob.size });
						const url = URL.createObjectURL(blob);
						const link = document.createElement('a');
						link.href = url;
						link.download = filename;
						link.click();
						URL.revokeObjectURL(url);
						new Notice('PNG exported successfully');
					} else {
						logger.error('export-png', 'Failed to create blob from canvas');
						new Notice('Failed to create PNG image');
					}
				}, 'image/png');
			};
			img.onerror = (e) => {
				URL.revokeObjectURL(svgUrl);
				logger.error('export-png', 'Failed to load SVG as image', { error: e });
				new Notice('Failed to render chart as PNG. Try SVG export instead.');
			};
			img.src = svgUrl;

		} catch (error) {
			logger.error('export-png', 'Failed to export PNG', { error });
			new Notice('Failed to export PNG');
		}
	}

	/**
	 * Prepare SVG for export by handling transforms and styling
	 * Family-chart uses CSS transforms on .view group for pan/zoom, which must be
	 * converted to a proper viewBox for standalone SVG export
	 */
	private prepareSvgForExport(svg: SVGSVGElement): { svgClone: SVGSVGElement; width: number; height: number } {
		// Get bounds from the view group which contains all content
		// Use getBBox on the cards_view and links_view to get untransformed bounds
		const cardsView = svg.querySelector('.cards_view') as SVGGElement;
		const linksView = svg.querySelector('.links_view') as SVGGElement;

		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

		// Get the bounding box of cards view (in its local coordinate system)
		if (cardsView) {
			try {
				const cardsBBox = cardsView.getBBox();
				minX = Math.min(minX, cardsBBox.x);
				minY = Math.min(minY, cardsBBox.y);
				maxX = Math.max(maxX, cardsBBox.x + cardsBBox.width);
				maxY = Math.max(maxY, cardsBBox.y + cardsBBox.height);
			} catch {
				// getBBox can throw if element is not rendered
			}
		}

		// Get the bounding box of links view
		if (linksView) {
			try {
				const linksBBox = linksView.getBBox();
				minX = Math.min(minX, linksBBox.x);
				minY = Math.min(minY, linksBBox.y);
				maxX = Math.max(maxX, linksBBox.x + linksBBox.width);
				maxY = Math.max(maxY, linksBBox.y + linksBBox.height);
			} catch {
				// getBBox can throw if element is not rendered
			}
		}

		// Fallback if bounds couldn't be calculated
		if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
			const rect = svg.getBoundingClientRect();
			minX = 0;
			minY = 0;
			maxX = rect.width || 800;
			maxY = rect.height || 600;
		}

		// Add padding
		const padding = 50;
		minX -= padding;
		minY -= padding;
		maxX += padding;
		maxY += padding;

		// Calculate dimensions
		const width = maxX - minX;
		const height = maxY - minY;

		// Clone SVG
		const svgClone = svg.cloneNode(true) as SVGSVGElement;
		svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
		svgClone.setAttribute('width', String(width));
		svgClone.setAttribute('height', String(height));
		svgClone.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);

		// Reset the transform on the view group since we're using viewBox
		const viewGroup = svgClone.querySelector('.view') as SVGGElement;
		if (viewGroup) {
			viewGroup.removeAttribute('style');
			viewGroup.setAttribute('transform', '');
		}

		// Theme colors
		const isDark = document.body.classList.contains('theme-dark');
		const textColor = isDark ? '#ffffff' : '#333333';
		const bgColor = isDark ? 'rgb(33, 33, 33)' : 'rgb(250, 250, 250)';
		const femaleColor = 'rgba(154, 89, 113, 1)';
		const maleColor = 'rgba(69, 123, 141, 1)';
		const genderlessColor = 'rgb(59, 85, 96)';

		// Embed CSS styles directly in the SVG for standalone rendering
		const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
		styleEl.textContent = `
			text, tspan {
				fill: ${textColor};
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
				font-size: 14px;
			}
			.card-body-rect { fill: ${bgColor}; }
			.card-female .card-body-rect { fill: ${femaleColor}; }
			.card-male .card-body-rect { fill: ${maleColor}; }
			.card-genderless .card-body-rect { fill: ${genderlessColor}; }
			.link { stroke: ${textColor}; stroke-width: 2px; fill: none; }
			.card-main-outline { stroke: ${textColor}; stroke-width: 3px; }
		`;
		svgClone.insertBefore(styleEl, svgClone.firstChild);

		// Set fill on all text elements for maximum compatibility
		// Also remove any inline styles that might override our fill, and ensure visibility
		svgClone.querySelectorAll('text, tspan').forEach((el) => {
			el.setAttribute('fill', textColor);
			// Remove any inline style that might contain CSS variables or override fill
			const style = el.getAttribute('style');
			if (style) {
				// Remove fill, color, and any CSS variable references from inline style
				const cleanedStyle = style
					.replace(/fill:[^;]+;?/gi, '')
					.replace(/color:[^;]+;?/gi, '')
					.replace(/var\([^)]+\)/gi, textColor)
					.trim();
				if (cleanedStyle) {
					el.setAttribute('style', cleanedStyle);
				} else {
					el.removeAttribute('style');
				}
			}
			// Ensure text is visible
			el.setAttribute('opacity', '1');
			el.setAttribute('visibility', 'visible');
		});

		// Remove clip-path and mask references
		svgClone.querySelectorAll('[clip-path]').forEach((el) => {
			el.removeAttribute('clip-path');
		});
		svgClone.querySelectorAll('[mask]').forEach((el) => {
			el.removeAttribute('mask');
		});
		svgClone.querySelectorAll('[style*="clip-path"], [style*="mask"]').forEach((el) => {
			const style = el.getAttribute('style') || '';
			el.setAttribute('style', style.replace(/clip-path:[^;]+;?/g, '').replace(/mask:[^;]+;?/g, ''));
		});

		// CRITICAL: Remove text-overflow-mask elements - they cover the text when mask is removed!
		svgClone.querySelectorAll('.text-overflow-mask').forEach((el) => {
			el.remove();
		});

		// Replace CSS variables in Open note buttons with actual colors
		// These buttons use Obsidian CSS variables that won't work in standalone SVG
		const buttonBgColor = isDark ? 'rgb(30, 30, 30)' : 'rgb(255, 255, 255)';
		const buttonStrokeColor = isDark ? 'rgb(150, 150, 150)' : 'rgb(100, 100, 100)';

		svgClone.querySelectorAll('.cr-open-note-btn').forEach((btnGroup) => {
			// Fix circle background
			const circle = btnGroup.querySelector('circle');
			if (circle) {
				const fill = circle.getAttribute('fill');
				if (fill && fill.includes('var(')) {
					circle.setAttribute('fill', buttonBgColor);
				}
				const stroke = circle.getAttribute('stroke');
				if (stroke && stroke.includes('var(')) {
					circle.setAttribute('stroke', buttonStrokeColor);
				}
			}
			// Fix path (icon) stroke
			const path = btnGroup.querySelector('path');
			if (path) {
				const stroke = path.getAttribute('stroke');
				if (stroke && stroke.includes('var(')) {
					path.setAttribute('stroke', buttonStrokeColor);
				}
			}
		});

		// Add background rect
		const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		bgRect.setAttribute('x', String(minX));
		bgRect.setAttribute('y', String(minY));
		bgRect.setAttribute('width', String(width));
		bgRect.setAttribute('height', String(height));
		bgRect.setAttribute('fill', bgColor);
		svgClone.insertBefore(bgRect, svgClone.firstChild);

		return { svgClone, width, height };
	}

	/**
	 * Convert image URLs in SVG to base64 data URIs for export
	 * This is necessary because app:// URLs don't work outside Obsidian
	 */
	private async embedImagesAsBase64(svgClone: SVGSVGElement): Promise<void> {
		const imageElements = svgClone.querySelectorAll('image[href]');

		// Filter to only app:// URLs that need conversion
		const imagesToConvert: { element: Element; href: string }[] = [];
		imageElements.forEach((imgEl) => {
			const href = imgEl.getAttribute('href') || imgEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
			if (!href) return;
			// Only convert app:// URLs (Obsidian internal)
			if (!href.startsWith('app://')) return;
			imagesToConvert.push({ element: imgEl, href });
		});

		if (imagesToConvert.length === 0) return;

		const totalImages = imagesToConvert.length;

		// Warn user about large exports
		if (totalImages > 50) {
			new Notice(`Embedding ${totalImages} images... This may take a moment.`, 5000);
		}

		logger.debug('export', 'Embedding images as base64', { totalImages });

		// Process images ONE AT A TIME to prevent memory pressure
		// Each image creates temporary Image + Canvas objects that need GC
		for (let i = 0; i < totalImages; i++) {
			const { element, href } = imagesToConvert[i];

			try {
				const base64 = await this.convertImageToBase64(href);
				if (base64) {
					element.setAttribute('href', base64);
					// Also set xlink:href for older SVG viewers
					element.setAttributeNS('http://www.w3.org/1999/xlink', 'href', base64);
				}
			} catch (error) {
				logger.warn('export', 'Failed to convert image to base64', { href, error });
			}

			// Yield after EVERY image for large exports to allow GC
			// Longer delay (50ms) gives browser time to reclaim memory
			await new Promise(resolve => setTimeout(resolve, totalImages > 50 ? 50 : 10));
		}
	}

	/**
	 * Convert image URLs in SVG to base64 data URIs with progress reporting
	 * Used by the export wizard to show progress during avatar embedding
	 */
	private async embedImagesAsBase64WithProgress(
		svgClone: SVGSVGElement,
		onProgress?: ProgressCallback,
		isCancelled?: () => boolean
	): Promise<void> {
		const imageElements = svgClone.querySelectorAll('image[href]');

		// Filter to only app:// URLs that need conversion
		const imagesToConvert: { element: Element; href: string }[] = [];
		imageElements.forEach((imgEl) => {
			const href = imgEl.getAttribute('href') || imgEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
			if (!href) return;
			// Only convert app:// URLs (Obsidian internal)
			if (!href.startsWith('app://')) return;
			imagesToConvert.push({ element: imgEl, href });
		});

		if (imagesToConvert.length === 0) return;

		const totalImages = imagesToConvert.length;

		logger.debug('export', 'Embedding images as base64 with progress', { totalImages });

		// Process images ONE AT A TIME to prevent memory pressure
		for (let i = 0; i < totalImages; i++) {
			// Check for cancellation
			if (isCancelled?.()) {
				logger.debug('export', 'Image embedding cancelled');
				return;
			}

			const { element, href } = imagesToConvert[i];

			// Report progress
			onProgress?.({
				phase: 'embedding',
				current: i + 1,
				total: totalImages,
				message: `Embedding avatar ${i + 1} of ${totalImages}...`
			});

			try {
				const base64 = await this.convertImageToBase64(href);
				if (base64) {
					element.setAttribute('href', base64);
					element.setAttributeNS('http://www.w3.org/1999/xlink', 'href', base64);
				}
			} catch (error) {
				logger.warn('export', 'Failed to convert image to base64', { href, error });
			}

			// Yield after EVERY image for large exports to allow GC
			await new Promise(resolve => setTimeout(resolve, totalImages > 50 ? 50 : 10));
		}
	}

	/**
	 * Convert an image URL to a base64 data URI
	 * Downscales large images to reduce memory usage and base64 string size
	 */
	private async convertImageToBase64(url: string, maxSize: number = 150): Promise<string | null> {
		return new Promise((resolve) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';

			img.onload = () => {
				try {
					// Downscale large images to reduce memory and base64 size
					// Avatars display at ~60-80px, so 150px is plenty
					let width = img.naturalWidth;
					let height = img.naturalHeight;

					if (width > maxSize || height > maxSize) {
						const scale = maxSize / Math.max(width, height);
						width = Math.round(width * scale);
						height = Math.round(height * scale);
					}

					const canvas = document.createElement('canvas');
					canvas.width = width;
					canvas.height = height;

					const ctx = canvas.getContext('2d');
					if (!ctx) {
						resolve(null);
						return;
					}

					ctx.drawImage(img, 0, 0, width, height);
					// Use JPEG for photos (smaller) with good quality
					const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
					resolve(dataUrl);
				} catch (error) {
					logger.warn('export', 'Failed to convert image to canvas', { url, error });
					resolve(null);
				}
			};

			img.onerror = () => {
				logger.warn('export', 'Failed to load image for conversion', { url });
				resolve(null);
			};

			img.src = url;
		});
	}

	// ============ Layout Configuration ============

	/**
	 * Show layout settings menu (orientation, spacing)
	 */
	private showLayoutMenu(e: MouseEvent): void {
		const menu = new Menu();

		// Tree orientation
		menu.addItem((item) => {
			item.setTitle('Tree orientation')
				.setIcon('layout')
				.setDisabled(true);
		});

		menu.addItem((item) => {
			item.setTitle(`${!this.isHorizontal ? '✓ ' : ''}Vertical (top to bottom)`)
				.onClick(() => this.setOrientation(false));
		});
		menu.addItem((item) => {
			item.setTitle(`${this.isHorizontal ? '✓ ' : ''}Horizontal (left to right)`)
				.onClick(() => this.setOrientation(true));
		});

		menu.addSeparator();

		// Node spacing (horizontal)
		menu.addItem((item) => {
			item.setTitle(`Node spacing: ${this.nodeSpacing}px`)
				.setIcon('arrow-left-right')
				.setDisabled(true);
		});

		menu.addItem((item) => {
			item.setTitle('Compact (200px)')
				.onClick(() => this.setNodeSpacing(200));
		});
		menu.addItem((item) => {
			item.setTitle('Normal (250px)')
				.onClick(() => this.setNodeSpacing(250));
		});
		menu.addItem((item) => {
			item.setTitle('Spacious (350px)')
				.onClick(() => this.setNodeSpacing(350));
		});

		menu.addSeparator();

		// Level spacing (vertical)
		menu.addItem((item) => {
			item.setTitle(`Level spacing: ${this.levelSpacing}px`)
				.setIcon('arrow-up-down')
				.setDisabled(true);
		});

		menu.addItem((item) => {
			item.setTitle('Compact (100px)')
				.onClick(() => this.setLevelSpacing(100));
		});
		menu.addItem((item) => {
			item.setTitle('Normal (150px)')
				.onClick(() => this.setLevelSpacing(150));
		});
		menu.addItem((item) => {
			item.setTitle('Spacious (200px)')
				.onClick(() => this.setLevelSpacing(200));
		});

		menu.showAtMouseEvent(e);
	}

	/**
	 * Show display settings menu (card display, visibility options)
	 */
	private showDisplayMenu(e: MouseEvent): void {
		const menu = new Menu();

		// Card display options
		menu.addItem((item) => {
			item.setTitle('Card display')
				.setIcon('credit-card')
				.setDisabled(true);
		});

		menu.addItem((item) => {
			item.setTitle(`${this.showBirthDates ? '✓ ' : ''}Show birth dates`)
				.onClick(() => this.toggleBirthDates());
		});

		menu.addItem((item) => {
			item.setTitle(`${this.showDeathDates ? '✓ ' : ''}Show death dates`)
				.onClick(() => this.toggleDeathDates());
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item.setTitle(`${this.showKinshipLabels ? '✓ ' : ''}Show kinship labels`)
				.setIcon('tag')
				.onClick(() => this.toggleKinshipLabels());
		});

		menu.addItem((item) => {
			item.setTitle(`${this.showAvatars ? '✓ ' : ''}Show avatars`)
				.setIcon('image')
				.onClick(() => this.toggleAvatars());
		});

		menu.addSeparator();

		// Visibility options
		menu.addItem((item) => {
			item.setTitle('Visibility')
				.setIcon('eye')
				.setDisabled(true);
		});

		menu.addItem((item) => {
			item.setTitle(`${this.showSiblingsOfMain ? '✓ ' : ''}Show siblings of root person`)
				.onClick(() => this.toggleShowSiblingsOfMain());
		});

		menu.addItem((item) => {
			item.setTitle(`${this.showSingleParentEmptyCard ? '✓ ' : ''}Show unknown parent placeholders`)
				.onClick(() => this.toggleSingleParentEmptyCard());
		});

		menu.addItem((item) => {
			item.setTitle(`${this.sortChildrenByBirthDate ? '✓ ' : ''}Sort children by birth date`)
				.onClick(() => this.toggleSortChildrenByBirthDate());
		});

		menu.addItem((item) => {
			item.setTitle(`${this.hidePrivateLiving ? '✓ ' : ''}Hide living persons`)
				.onClick(() => this.toggleHidePrivateLiving());
		});

		menu.showAtMouseEvent(e);
	}

	/**
	 * Show depth settings menu (ancestry/progeny limits)
	 */
	private showDepthMenu(e: MouseEvent): void {
		const menu = new Menu();

		// Tree depth limits - Ancestry
		const ancestryLabel = this.ancestryDepth === null ? 'Unlimited' : `${this.ancestryDepth} gen`;
		menu.addItem((item) => {
			item.setTitle(`Ancestors: ${ancestryLabel}`)
				.setIcon('arrow-up')
				.setDisabled(true);
		});

		const ancestryOptions: (number | null)[] = [null, 1, 2, 3, 5];
		for (const depth of ancestryOptions) {
			const label = depth === null ? 'Unlimited' : `${depth} generation${depth === 1 ? '' : 's'}`;
			const isSelected = this.ancestryDepth === depth;
			menu.addItem((item) => {
				item.setTitle(`${isSelected ? '✓ ' : '  '}${label}`)
					.onClick(() => this.setAncestryDepth(depth));
			});
		}

		menu.addSeparator();

		// Tree depth limits - Descendants
		const progenyLabel = this.progenyDepth === null ? 'Unlimited' : `${this.progenyDepth} gen`;
		menu.addItem((item) => {
			item.setTitle(`Descendants: ${progenyLabel}`)
				.setIcon('arrow-down')
				.setDisabled(true);
		});

		const progenyOptions: (number | null)[] = [null, 1, 2, 3, 5];
		for (const depth of progenyOptions) {
			const label = depth === null ? 'Unlimited' : `${depth} generation${depth === 1 ? '' : 's'}`;
			const isSelected = this.progenyDepth === depth;
			menu.addItem((item) => {
				item.setTitle(`${isSelected ? '✓ ' : '  '}${label}`)
					.onClick(() => this.setProgenyDepth(depth));
			});
		}

		menu.showAtMouseEvent(e);
	}

	/**
	 * Theme preset definitions for family chart colors
	 */
	private static readonly THEME_PRESETS: Record<string, { name: string; colors: FamilyChartColors }> = {
		classic: {
			name: 'Classic',
			colors: {
				femaleColor: 'rgb(196, 138, 146)',
				maleColor: 'rgb(120, 159, 172)',
				unknownColor: 'rgb(211, 211, 211)',
				backgroundLight: 'rgb(250, 250, 250)',
				backgroundDark: 'rgb(33, 33, 33)',
				textLight: '#333333',
				textDark: '#ffffff'
			}
		},
		pastel: {
			name: 'Pastel',
			colors: {
				femaleColor: '#f4c2c2',
				maleColor: '#a7c7e7',
				unknownColor: '#e6e6fa',
				backgroundLight: 'rgb(250, 250, 250)',
				backgroundDark: 'rgb(33, 33, 33)',
				textLight: '#333333',
				textDark: '#ffffff'
			}
		},
		earth: {
			name: 'Earth Tones',
			colors: {
				femaleColor: '#cc7a6f',
				maleColor: '#8fbc8f',
				unknownColor: '#d2b48c',
				backgroundLight: 'rgb(250, 250, 250)',
				backgroundDark: 'rgb(33, 33, 33)',
				textLight: '#333333',
				textDark: '#ffffff'
			}
		},
		contrast: {
			name: 'High Contrast',
			colors: {
				femaleColor: '#ff00ff',
				maleColor: '#00ffff',
				unknownColor: '#ffff00',
				backgroundLight: '#ffffff',
				backgroundDark: '#000000',
				textLight: '#000000',
				textDark: '#ffffff'
			}
		},
		mono: {
			name: 'Monochrome',
			colors: {
				femaleColor: '#666666',
				maleColor: '#888888',
				unknownColor: '#aaaaaa',
				backgroundLight: 'rgb(250, 250, 250)',
				backgroundDark: 'rgb(33, 33, 33)',
				textLight: '#333333',
				textDark: '#ffffff'
			}
		}
	};

	/**
	 * Show style/theme menu
	 */
	private showStyleMenu(e: MouseEvent): void {
		const menu = new Menu();
		const currentColors = this.plugin.settings.familyChartColors;

		// Header
		menu.addItem((item) => {
			item.setTitle('Theme')
				.setIcon('palette')
				.setDisabled(true);
		});

		menu.addSeparator();

		// Preset themes
		for (const [key, preset] of Object.entries(FamilyChartView.THEME_PRESETS)) {
			const isSelected = this.isPresetActive(key, currentColors);
			menu.addItem((item) => {
				item.setTitle(`${isSelected ? '✓ ' : '  '}${preset.name}`)
					.onClick(() => this.applyThemePreset(key));
			});
		}

		menu.addSeparator();

		// Customize option
		menu.addItem((item) => {
			item.setTitle('Customize...')
				.setIcon('settings')
				.onClick(() => this.showCustomizeModal());
		});

		// Reset option
		menu.addItem((item) => {
			item.setTitle('Reset to defaults')
				.setIcon('rotate-ccw')
				.onClick(() => this.resetToDefaultColors());
		});

		menu.showAtMouseEvent(e);
	}

	/**
	 * Check if a preset is currently active
	 */
	private isPresetActive(presetKey: string, currentColors?: FamilyChartColors): boolean {
		if (!currentColors) {
			// No custom colors = classic/default
			return presetKey === 'classic';
		}

		const preset = FamilyChartView.THEME_PRESETS[presetKey];
		if (!preset) return false;

		// Compare key colors (female, male, unknown)
		return currentColors.femaleColor === preset.colors.femaleColor &&
			currentColors.maleColor === preset.colors.maleColor &&
			currentColors.unknownColor === preset.colors.unknownColor;
	}

	/**
	 * Apply a theme preset
	 */
	private async applyThemePreset(presetKey: string): Promise<void> {
		const preset = FamilyChartView.THEME_PRESETS[presetKey];
		if (!preset) return;

		// Save to settings
		this.plugin.settings.familyChartColors = { ...preset.colors };
		await this.plugin.saveSettings();

		// Apply to chart
		this.applyCustomColors();

		new Notice(`Applied "${preset.name}" theme`);
	}

	/**
	 * Reset to default colors (removes custom settings)
	 */
	private async resetToDefaultColors(): Promise<void> {
		delete this.plugin.settings.familyChartColors;
		await this.plugin.saveSettings();

		// Clear inline styles
		this.clearCustomColors();

		new Notice('Colors reset to defaults');
	}

	/**
	 * Apply custom colors from settings to the chart container
	 */
	private applyCustomColors(): void {
		const colors = this.plugin.settings.familyChartColors;
		if (!colors || !this.chartContainerEl) return;

		const el = this.chartContainerEl;
		const isDark = document.body.classList.contains('theme-dark');

		// Set family-chart library variables (used for card colors)
		el.style.setProperty('--female-color', colors.femaleColor);
		el.style.setProperty('--male-color', colors.maleColor);
		el.style.setProperty('--genderless-color', colors.unknownColor);
		el.style.setProperty('--background-color', isDark ? colors.backgroundDark : colors.backgroundLight);
		el.style.setProperty('--text-color', isDark ? colors.textDark : colors.textLight);

		// Also set our cr-fcv variables for consistency with Style Settings
		el.style.setProperty('--cr-fcv-female-color', colors.femaleColor);
		el.style.setProperty('--cr-fcv-male-color', colors.maleColor);
		el.style.setProperty('--cr-fcv-unknown-color', colors.unknownColor);
		if (isDark) {
			el.style.setProperty('--cr-fcv-background-dark', colors.backgroundDark);
			el.style.setProperty('--cr-fcv-text-dark', colors.textDark);
		} else {
			el.style.setProperty('--cr-fcv-background-light', colors.backgroundLight);
			el.style.setProperty('--cr-fcv-text-light', colors.textLight);
		}

		// Update container background directly
		el.style.backgroundColor = isDark ? colors.backgroundDark : colors.backgroundLight;
		el.style.color = isDark ? colors.textDark : colors.textLight;
	}

	/**
	 * Clear custom color inline styles (reverts to CSS defaults or Style Settings)
	 */
	private clearCustomColors(): void {
		if (!this.chartContainerEl) return;

		const el = this.chartContainerEl;
		const isDark = document.body.classList.contains('theme-dark');

		// Clear family-chart library variables
		el.style.removeProperty('--female-color');
		el.style.removeProperty('--male-color');
		el.style.removeProperty('--genderless-color');
		el.style.removeProperty('--background-color');
		el.style.removeProperty('--text-color');

		// Clear our cr-fcv variables
		el.style.removeProperty('--cr-fcv-female-color');
		el.style.removeProperty('--cr-fcv-male-color');
		el.style.removeProperty('--cr-fcv-unknown-color');
		el.style.removeProperty('--cr-fcv-background-light');
		el.style.removeProperty('--cr-fcv-background-dark');
		el.style.removeProperty('--cr-fcv-text-light');
		el.style.removeProperty('--cr-fcv-text-dark');

		// Reset container background to defaults
		el.style.backgroundColor = isDark ? 'rgb(33, 33, 33)' : 'rgb(250, 250, 250)';
		el.style.color = isDark ? '#fff' : '#333';
	}

	/**
	 * Show the customize colors modal
	 */
	private showCustomizeModal(): void {
		new FamilyChartStyleModal(this.app, this.plugin, this).open();
	}

	/**
	 * Toggle birth dates display
	 */
	private toggleBirthDates(): void {
		this.showBirthDates = !this.showBirthDates;
		this.updateCardDisplay();
		new Notice(`Birth dates ${this.showBirthDates ? 'shown' : 'hidden'}`);
	}

	/**
	 * Toggle death dates display
	 */
	private toggleDeathDates(): void {
		this.showDeathDates = !this.showDeathDates;
		this.updateCardDisplay();
		new Notice(`Death dates ${this.showDeathDates ? 'shown' : 'hidden'}`);
	}

	/**
	 * Toggle kinship labels display
	 */
	private toggleKinshipLabels(): void {
		this.showKinshipLabels = !this.showKinshipLabels;
		this.renderKinshipLabels();
		new Notice(`Kinship labels ${this.showKinshipLabels ? 'shown' : 'hidden'}`);
	}

	/**
	 * Toggle avatar display on cards
	 */
	private toggleAvatars(): void {
		this.showAvatars = !this.showAvatars;
		// Need to re-initialize chart to re-transform person data with/without avatars
		if (this.f3Chart && this.rootPersonId) {
			this.initializeChart();
		}
		new Notice(`Avatars ${this.showAvatars ? 'shown' : 'hidden'}`);
	}

	/**
	 * Set tree orientation (vertical or horizontal)
	 */
	private setOrientation(horizontal: boolean): void {
		if (this.isHorizontal === horizontal) return; // No change

		this.isHorizontal = horizontal;

		// Re-initialize chart with new orientation
		if (this.f3Chart && this.rootPersonId) {
			this.initializeChart();
		}

		new Notice(`Tree orientation: ${horizontal ? 'horizontal' : 'vertical'}`);
	}

	/**
	 * Set ancestry depth limit
	 */
	private setAncestryDepth(depth: number | null): void {
		if (this.ancestryDepth === depth) return;

		this.ancestryDepth = depth;

		// Re-initialize chart with new depth
		if (this.f3Chart && this.rootPersonId) {
			this.initializeChart();
		}

		const label = depth === null ? 'unlimited' : `${depth} generation${depth === 1 ? '' : 's'}`;
		new Notice(`Ancestry depth: ${label}`);
	}

	/**
	 * Set progeny depth limit
	 */
	private setProgenyDepth(depth: number | null): void {
		if (this.progenyDepth === depth) return;

		this.progenyDepth = depth;

		// Re-initialize chart with new depth
		if (this.f3Chart && this.rootPersonId) {
			this.initializeChart();
		}

		const label = depth === null ? 'unlimited' : `${depth} generation${depth === 1 ? '' : 's'}`;
		new Notice(`Descendant depth: ${label}`);
	}

	/**
	 * Toggle show siblings of main person
	 */
	private toggleShowSiblingsOfMain(): void {
		this.showSiblingsOfMain = !this.showSiblingsOfMain;

		// Re-initialize chart with new setting
		if (this.f3Chart && this.rootPersonId) {
			this.initializeChart();
		}

		new Notice(`Siblings of root person ${this.showSiblingsOfMain ? 'shown' : 'hidden'}`);
	}

	/**
	 * Toggle single parent empty card display
	 */
	private toggleSingleParentEmptyCard(): void {
		this.showSingleParentEmptyCard = !this.showSingleParentEmptyCard;

		// Re-initialize chart with new setting
		if (this.f3Chart && this.rootPersonId) {
			this.initializeChart();
		}

		new Notice(`Unknown parent placeholders ${this.showSingleParentEmptyCard ? 'shown' : 'hidden'}`);
	}

	/**
	 * Toggle sort children by birth date
	 */
	private toggleSortChildrenByBirthDate(): void {
		this.sortChildrenByBirthDate = !this.sortChildrenByBirthDate;

		// Re-initialize chart with new setting
		if (this.f3Chart && this.rootPersonId) {
			this.initializeChart();
		}

		new Notice(`Sort children by birth date ${this.sortChildrenByBirthDate ? 'enabled' : 'disabled'}`);
	}

	/**
	 * Toggle hide private/living persons
	 */
	private toggleHidePrivateLiving(): void {
		this.hidePrivateLiving = !this.hidePrivateLiving;

		// Re-initialize chart with new setting
		if (this.f3Chart && this.rootPersonId) {
			this.initializeChart();
		}

		new Notice(`Living persons ${this.hidePrivateLiving ? 'hidden' : 'shown'}`);
	}

	/**
	 * Render kinship labels on links
	 * Adds text labels showing relationship type (Father, Mother, Spouse, etc.)
	 */
	private renderKinshipLabels(): void {
		if (!this.chartContainerEl) return;

		// Remove existing kinship labels
		const existingLabels = this.chartContainerEl.querySelectorAll('.cr-kinship-label');
		existingLabels.forEach(label => label.remove());

		if (!this.showKinshipLabels) return;

		// Get the SVG element
		const svg = this.chartContainerEl.querySelector('svg.main_svg');
		if (!svg) return;

		// Build a lookup map of person ID to person data
		const personMap = new Map<string, FamilyChartPerson>();
		for (const person of this.chartData) {
			personMap.set(person.id, person);
		}

		// Find the links group and add labels
		const linksGroup = svg.querySelector('.links_view');
		if (!linksGroup) return;

		// Create a group for kinship labels
		const labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		labelsGroup.setAttribute('class', 'cr-kinship-labels');

		// Get all link paths
		const links = linksGroup.querySelectorAll('path.link');

		links.forEach((linkPath) => {
			// Get link data from the path's d attribute to calculate midpoint
			const pathData = linkPath.getAttribute('d');
			if (!pathData) return;

			// Calculate midpoint of the path
			const midpoint = this.getPathMidpoint(linkPath as SVGPathElement);
			if (!midpoint) return;

			// Determine relationship type from link structure
			// Links in family-chart connect children to parents or spouses
			const linkEl = linkPath as SVGPathElement;
			const isSpouseLink = linkEl.classList.contains('spouse') ||
				pathData.includes('L') && !pathData.includes('C'); // Straight lines are typically spouse links

			// Create label text
			const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			label.setAttribute('class', 'cr-kinship-label');
			label.setAttribute('x', String(midpoint.x));
			label.setAttribute('y', String(midpoint.y));
			label.setAttribute('text-anchor', 'middle');
			label.setAttribute('dominant-baseline', 'middle');

			// Set appropriate label text
			if (isSpouseLink) {
				label.textContent = 'Spouse';
				label.classList.add('cr-kinship-label--spouse');
			} else {
				// Parent-child link - label based on direction
				// Links go from child to parent in family-chart
				label.textContent = 'Parent';
				label.classList.add('cr-kinship-label--parent');
			}

			labelsGroup.appendChild(label);
		});

		// Append labels group to SVG (after links so labels appear on top)
		svg.appendChild(labelsGroup);
	}

	/**
	 * Get the midpoint of an SVG path element
	 */
	private getPathMidpoint(path: SVGPathElement): { x: number; y: number } | null {
		try {
			const pathLength = path.getTotalLength();
			const midpoint = path.getPointAtLength(pathLength / 2);
			return { x: midpoint.x, y: midpoint.y };
		} catch {
			return null;
		}
	}

	/**
	 * Update card display based on current options
	 */
	private updateCardDisplay(): void {
		if (!this.f3Chart || !this.f3Card) return;

		// Build card display array based on options
		const displayFields: string[][] = [['first name', 'last name']];

		if (this.showBirthDates && this.showDeathDates) {
			displayFields.push(['birthday', 'deathday']);
		} else if (this.showBirthDates) {
			displayFields.push(['birthday']);
		} else if (this.showDeathDates) {
			displayFields.push(['deathday']);
		}

		this.f3Card.setCardDisplay(displayFields);
		this.f3Chart.updateTree({});

		// Re-render kinship labels after tree update
		if (this.showKinshipLabels) {
			// Small delay to ensure SVG is fully rendered
			setTimeout(() => this.renderKinshipLabels(), 100);
		}
	}

	/**
	 * Set node (horizontal) spacing and refresh
	 */
	private setNodeSpacing(spacing: number): void {
		this.nodeSpacing = spacing;
		if (this.f3Chart) {
			this.f3Chart.setCardXSpacing(spacing);
			this.f3Chart.updateTree({});
			new Notice(`Node spacing set to ${spacing}px`);
		}
	}

	/**
	 * Set level (vertical) spacing and refresh
	 */
	private setLevelSpacing(spacing: number): void {
		this.levelSpacing = spacing;
		if (this.f3Chart) {
			this.f3Chart.setCardYSpacing(spacing);
			this.f3Chart.updateTree({});
			new Notice(`Level spacing set to ${spacing}px`);
		}
	}

	/**
	 * Export the chart as SVG
	 * @param includeAvatars Whether to embed avatar images as base64
	 */
	private async exportAsSvg(includeAvatars: boolean = true): Promise<void> {
		if (!this.f3Chart) return;

		const svg = this.f3Chart.svg;
		if (!svg) {
			new Notice('No chart to export');
			return;
		}

		try {
			// Prepare SVG for export using shared helper
			const { svgClone } = this.prepareSvgForExport(svg as SVGSVGElement);

			// Count avatar images
			const imageElements = svgClone.querySelectorAll('image[href]');
			let avatarCount = 0;
			imageElements.forEach((imgEl) => {
				const href = imgEl.getAttribute('href') || imgEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
				if (href?.startsWith('app://')) {
					avatarCount++;
				}
			});

			if (includeAvatars && avatarCount > 0) {
				// Warn about large exports that may crash due to memory exhaustion
				if (avatarCount > 75) {
					const depthHint = (this.ancestryDepth === null || this.progenyDepth === null)
						? ' Try reducing tree depth first (branch icon in toolbar).'
						: '';
					new Notice(
						`Warning: Exporting ${avatarCount} avatars may cause issues.${depthHint} Consider "Export as SVG (no avatars)" for large trees.`,
						10000
					);
				}
				// Embed avatar images as base64 for export
				await this.embedImagesAsBase64(svgClone);
			} else if (!includeAvatars) {
				// Remove avatar images entirely for faster/smaller export
				imageElements.forEach((imgEl) => {
					const href = imgEl.getAttribute('href') || imgEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
					if (href?.startsWith('app://')) {
						imgEl.remove();
					}
				});
				logger.debug('export-svg', 'Removed avatar images', { count: avatarCount });
			}

			// Serialize
			const serializer = new XMLSerializer();
			const svgString = serializer.serializeToString(svgClone);
			logger.debug('export-svg', 'SVG serialized', { length: svgString.length });

			// Download
			const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = this.generateExportFilename('svg');
			link.click();
			URL.revokeObjectURL(url);

			new Notice('SVG exported successfully');

		} catch (error) {
			logger.error('export-svg', 'Failed to export SVG', { error });
			new Notice('Failed to export SVG');
		}
	}

	/**
	 * Export the chart as PDF
	 */
	private async exportAsPdf(): Promise<void> {
		if (!this.f3Chart) return;

		const svg = this.f3Chart.svg;
		if (!svg) {
			new Notice('No chart to export');
			return;
		}

		try {
			// Prepare SVG for export using shared helper
			const { svgClone, width, height } = this.prepareSvgForExport(svg as SVGSVGElement);

			logger.debug('export-pdf', 'Preparing PDF export', { width, height, area: width * height });

			// Check for canvas size limits (same as PNG - PDF uses canvas internally)
			const maxDimension = 16384;
			const maxArea = 268435456; // 2^28 pixels
			const scale = 2; // Higher quality
			const scaledWidth = width * scale;
			const scaledHeight = height * scale;
			const scaledArea = scaledWidth * scaledHeight;

			if (scaledWidth > maxDimension || scaledHeight > maxDimension) {
				logger.warn('export-pdf', 'Canvas dimensions exceed browser limits', { scaledWidth, scaledHeight, maxDimension });
				new Notice(`Chart too large for PDF export (${Math.round(width)}x${Math.round(height)}px). Try SVG export instead.`, 0);
				return;
			}

			if (scaledArea > maxArea) {
				logger.warn('export-pdf', 'Canvas area exceeds browser limits', { scaledArea, maxArea });
				new Notice(`Chart too large for PDF export (${Math.round(scaledArea / 1000000)}M pixels). Try SVG export instead.`, 0);
				return;
			}

			// Embed avatar images as base64 for export
			await this.embedImagesAsBase64(svgClone);

			// Serialize SVG
			const serializer = new XMLSerializer();
			const svgString = serializer.serializeToString(svgClone);
			const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
			const svgUrl = URL.createObjectURL(svgBlob);

			// Create canvas and draw SVG (same as PNG export)
			const canvas = document.createElement('canvas');
			canvas.width = scaledWidth;
			canvas.height = scaledHeight;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				new Notice('Failed to create canvas context');
				return;
			}

			// Generate filename before the async callback
			const filename = this.generateExportFilename('pdf');

			const img = new Image();
			img.onload = () => {
				logger.debug('export-pdf', 'Image loaded, drawing to canvas');
				ctx.scale(scale, scale);
				ctx.drawImage(img, 0, 0);
				URL.revokeObjectURL(svgUrl);

				// Create PDF with appropriate page size
				// Use landscape if wider than tall, portrait otherwise
				const orientation = width > height ? 'landscape' : 'portrait';
				const pdf = new jsPDF({
					orientation,
					unit: 'px',
					format: [width, height]
				});

				// Add canvas image to PDF
				const imgData = canvas.toDataURL('image/png');
				pdf.addImage(imgData, 'PNG', 0, 0, width, height);

				// Save PDF
				pdf.save(filename);
				new Notice('PDF exported successfully');
			};
			img.onerror = (e) => {
				URL.revokeObjectURL(svgUrl);
				logger.error('export-pdf', 'Failed to load SVG as image', { error: e });
				new Notice('Failed to render chart as PDF. Try SVG export instead.');
			};
			img.src = svgUrl;

		} catch (error) {
			logger.error('export-pdf', 'Failed to export PDF', { error });
			new Notice('Failed to export PDF');
		}
	}

	// ============ Edit Mode ============

	/**
	 * Toggle edit mode on/off
	 */
	private toggleEditMode(): void {
		this.editMode = !this.editMode;

		// Update button state
		if (this.editModeBtn) {
			this.editModeBtn.classList.toggle('is-active', this.editMode);
		}

		// Update container class for styling
		if (this.chartContainerEl) {
			this.chartContainerEl.classList.toggle('is-edit-mode', this.editMode);
		}

		logger.info('edit-mode', `Edit mode ${this.editMode ? 'enabled' : 'disabled'}`);

		// If edit mode is enabled, make sure EditTree is configured
		if (this.editMode && this.f3EditTree) {
			this.f3EditTree.setEdit();
		} else if (!this.editMode && this.f3EditTree) {
			this.f3EditTree.setNoEdit();
			this.f3EditTree.closeForm();
		}
	}

	/**
	 * Initialize EditTree for editing capabilities
	 */
	private initializeEditTree(): void {
		if (!this.f3Chart || !this.f3Card) return;

		logger.debug('edit-tree-init', 'Initializing EditTree');

		// Create EditTree instance
		// Note: We don't use setCardClickOpen() here because we have our own custom info panel
		// that handles editing. The EditTree is kept for its data management and export capabilities.
		this.f3EditTree = this.f3Chart.editTree()
			// Configure editable fields (still needed for data export structure)
			.setFields([
				{ type: 'text', label: 'First name', id: 'first name' },
				{ type: 'text', label: 'Last name', id: 'last name' },
				{ type: 'text', label: 'Birth date', id: 'birthday' },
				{ type: 'text', label: 'Death date', id: 'deathday' }
			])
			// Handle data changes for bidirectional sync
			.setOnChange(() => this.handleChartDataChange())
			// Custom submit handler for sync to markdown
			.setOnSubmit((e, datum, applyChanges, postSubmit) => {
				// Apply changes in family-chart first
				applyChanges();
				// Then sync to markdown
				void this.syncDatumToMarkdown(datum);
				// Complete the submission
				postSubmit();
			})
			// Custom delete handler
			.setOnDelete((datum, deletePerson, postSubmit) => {
				// Show confirmation modal
				const personName = `${datum.data['first name']} ${datum.data['last name']}`;
				new DeletePersonConfirmModal(this.app, personName, (confirmed) => {
					if (confirmed) {
						// Delete in family-chart
						deletePerson();
						// Note: actual file deletion would be a separate concern
						// For now, just remove from chart (file remains but relationships are cleaned)
						logger.info('edit-delete', 'Person deleted from chart', { id: datum.id });
						postSubmit({});
					}
				}).open();
			})
			// Start in no-edit mode (toggle button enables it)
			.setNoEdit();

		// If edit mode is already enabled, activate it
		if (this.editMode) {
			this.f3EditTree.setEdit();
		}

		logger.debug('edit-tree-init', 'EditTree initialized');
	}

	/**
	 * Handle data changes from the chart (bidirectional sync)
	 */
	private handleChartDataChange(): void {
		if (!this.f3EditTree || this.isSyncing) return;

		logger.debug('chart-change', 'Chart data changed, syncing to markdown');

		// Export the updated data
		const updatedData = this.f3EditTree.exportData();

		// The onChange fires on any edit, we'll handle the actual sync
		// in the onSubmit handler for individual changes
		logger.debug('chart-change', 'Data exported', { count: Array.isArray(updatedData) ? updatedData.length : 0 });

		// Update history buttons state
		this.updateHistoryButtons();
	}

	/**
	 * Sync a single datum (person) to their markdown file
	 */
	private async syncDatumToMarkdown(datum: { id: string; data: Record<string, unknown>; rels?: { parents?: string[]; spouses?: string[]; children?: string[] } }): Promise<void> {
		if (this.isSyncing) return;

		this.isSyncing = true;

		try {
			const crId = datum.id;
			logger.debug('sync-to-md', 'Syncing datum to markdown', { crId, data: datum.data });

			// Find the file for this person
			const files = this.app.vault.getMarkdownFiles();
			let targetFile: TFile | null = null;

			for (const file of files) {
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache?.frontmatter?.cr_id === crId) {
					targetFile = file;
					break;
				}
			}

			if (!targetFile) {
				logger.warn('sync-to-md', 'Could not find file for person', { crId });
				return;
			}

			// Read current content
			const content = await this.app.vault.read(targetFile);

			// Parse frontmatter
			const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (!frontmatterMatch) {
				logger.warn('sync-to-md', 'No frontmatter found in file', { path: targetFile.path });
				return;
			}

			const frontmatterContent = frontmatterMatch[1];
			const bodyContent = content.slice(frontmatterMatch[0].length);

			// Build updated frontmatter
			const updatedFrontmatter = this.buildUpdatedFrontmatter(frontmatterContent, datum);

			// Write back to file
			const newContent = `---\n${updatedFrontmatter}\n---${bodyContent}`;
			await this.app.vault.modify(targetFile, newContent);

			logger.info('sync-to-md', 'Successfully synced frontmatter', { path: targetFile.path });

			// Check if file should be renamed based on name change
			const firstName = (datum.data['first name'] as string) || '';
			const lastName = (datum.data['last name'] as string) || '';
			const newFullName = `${firstName} ${lastName}`.trim();

			if (newFullName) {
				// Sanitize the new name for use as filename
				const sanitizedName = this.sanitizeFilename(newFullName);
				const currentBasename = targetFile.basename;

				if (sanitizedName && sanitizedName !== currentBasename) {
					// Build new path preserving the directory
					const directory = targetFile.parent?.path || '';
					const newPath = directory ? `${directory}/${sanitizedName}.md` : `${sanitizedName}.md`;

					// Check if target file already exists
					const existingFile = this.app.vault.getAbstractFileByPath(newPath);
					if (existingFile) {
						logger.warn('sync-to-md', 'Cannot rename: file already exists', { newPath });
					} else {
						await this.app.vault.rename(targetFile, newPath);
						logger.info('sync-to-md', 'Renamed file', { from: targetFile.path, to: newPath });
					}
				}
			}

		} catch (error) {
			logger.error('sync-to-md', 'Failed to sync datum to markdown', { error });
		} finally {
			this.isSyncing = false;
		}
	}

	/**
	 * Build updated frontmatter content from datum data
	 */
	private buildUpdatedFrontmatter(currentFrontmatter: string, datum: { data: Record<string, unknown>; rels?: { parents?: string[]; spouses?: string[]; children?: string[] } }): string {
		const lines = currentFrontmatter.split('\n');
		const updatedLines: string[] = [];
		const processedKeys = new Set<string>();

		// Combine first and last name
		const firstName = (datum.data['first name'] as string) || '';
		const lastName = (datum.data['last name'] as string) || '';
		const fullName = `${firstName} ${lastName}`.trim();

		// Process existing lines
		for (const line of lines) {
			const keyMatch = line.match(/^(\w+):/);
			if (keyMatch) {
				const key = keyMatch[1];
				processedKeys.add(key);

				// Update name
				if (key === 'name') {
					updatedLines.push(`name: "${fullName}"`);
					continue;
				}

				// Update birth_date
				if (key === 'birth_date') {
					const birthDate = datum.data['birthday'] as string;
					if (birthDate) {
						updatedLines.push(`birth_date: "${birthDate}"`);
					} else {
						updatedLines.push(line); // Keep original if no value
					}
					continue;
				}

				// Update death_date
				if (key === 'death_date') {
					const deathDate = datum.data['deathday'] as string;
					if (deathDate) {
						updatedLines.push(`death_date: "${deathDate}"`);
					} else {
						updatedLines.push(line);
					}
					continue;
				}

				// Update sex
				if (key === 'sex') {
					const sex = datum.data['gender'] as string; // family-chart uses 'gender' internally
					if (sex) {
						const sexValue = sex === 'F' ? 'female' : 'male';
						updatedLines.push(`sex: ${sexValue}`);
					} else {
						updatedLines.push(line);
					}
					continue;
				}
			}

			// Keep other lines unchanged
			updatedLines.push(line);
		}

		// Add new properties if they don't exist
		if (!processedKeys.has('name') && fullName) {
			updatedLines.push(`name: "${fullName}"`);
		}

		const birthDate = datum.data['birthday'] as string;
		if (!processedKeys.has('birth_date') && birthDate) {
			updatedLines.push(`birth_date: "${birthDate}"`);
		}

		const deathDate = datum.data['deathday'] as string;
		if (!processedKeys.has('death_date') && deathDate) {
			updatedLines.push(`death_date: "${deathDate}"`);
		}

		return updatedLines.join('\n');
	}

	/**
	 * Sanitize a string for use as a filename
	 * Removes/replaces characters that are invalid in filenames
	 */
	private sanitizeFilename(name: string): string {
		// Replace characters that are invalid in filenames on most OS
		// Windows: \ / : * ? " < > |
		// Also replace # and ^ which can cause issues in Obsidian
		return name
			.replace(/[\\/:*?"<>|#^]/g, '')
			.replace(/\s+/g, ' ')  // Collapse multiple spaces
			.trim();
	}

	/**
	 * Sync filename to frontmatter name property when file is renamed
	 */
	private async syncFilenameToFrontmatter(file: TFile): Promise<void> {
		if (this.isSyncing) return;

		this.isSyncing = true;

		try {
			const newName = file.basename;
			logger.debug('sync-filename', 'Syncing filename to frontmatter', { filename: newName });

			// Read current content
			const content = await this.app.vault.read(file);

			// Parse frontmatter
			const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (!frontmatterMatch) {
				logger.warn('sync-filename', 'No frontmatter found in file', { path: file.path });
				return;
			}

			const frontmatterContent = frontmatterMatch[1];
			const bodyContent = content.slice(frontmatterMatch[0].length);

			// Check if name property exists and differs
			const nameMatch = frontmatterContent.match(/^name:\s*["']?(.+?)["']?\s*$/m);
			const currentName = nameMatch ? nameMatch[1] : '';

			if (currentName === newName) {
				logger.debug('sync-filename', 'Name already matches filename', { name: newName });
				return;
			}

			// Update name in frontmatter
			let updatedFrontmatter: string;
			if (nameMatch) {
				// Replace existing name
				updatedFrontmatter = frontmatterContent.replace(
					/^name:\s*["']?.+?["']?\s*$/m,
					`name: "${newName}"`
				);
			} else {
				// Add name property at the beginning
				updatedFrontmatter = `name: "${newName}"\n${frontmatterContent}`;
			}

			// Write back to file
			const newContent = `---\n${updatedFrontmatter}\n---${bodyContent}`;
			await this.app.vault.modify(file, newContent);

			logger.info('sync-filename', 'Successfully synced filename to frontmatter', { path: file.path, name: newName });

		} catch (error) {
			logger.error('sync-filename', 'Failed to sync filename to frontmatter', { error });
		} finally {
			this.isSyncing = false;
		}
	}

	/**
	 * Check if the view is currently in a sidebar
	 */
	private isInSidebar(): boolean {
		const root = this.leaf.getRoot();
		// Check if we're in left or right sidebar by checking the root type
		// Sidebar roots have different types than the main workspace root
		return root !== this.app.workspace.rootSplit;
	}

	/**
	 * Move this view from sidebar to main workspace
	 */
	private popOutToMainWorkspace(): void {
		void this.plugin.moveFamilyChartToMainWorkspace(this.leaf);
	}

	/**
	 * Destroy the chart instance and clean up
	 */
	private destroyChart(): void {
		// Clean up EditTree
		if (this.f3EditTree) {
			this.f3EditTree.destroy();
			this.f3EditTree = null;
		}

		// family-chart doesn't have an explicit destroy method
		// Clean up by clearing the container
		if (this.chartContainerEl) {
			this.chartContainerEl.empty();
		}
		this.f3Chart = null;
		this.f3Card = null;
		this.chartData = [];
	}

	/**
	 * Register event handlers for vault changes
	 */
	private registerEventHandlers(): void {
		// Listen for metadata changes (fires after frontmatter is parsed)
		this.registerEvent(
			this.app.metadataCache.on('changed', (file: TFile) => {
				if (file.extension !== 'md') return;

				// Check if this is a person note
				const cache = this.app.metadataCache.getFileCache(file);
				if (!cache?.frontmatter?.cr_id) return;

				// Debounce rapid changes
				this.scheduleRefresh();
			})
		);

		// Listen for file deletions
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					this.scheduleRefresh();
				}
			})
		);

		// Listen for file renames to update chart with new names
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFile && file.extension === 'md') {
					// Check if this is a person note
					const cache = this.app.metadataCache.getFileCache(file);
					if (cache?.frontmatter?.cr_id) {
						logger.debug('file-rename', 'Person note renamed', { oldPath, newPath: file.path });
						// Update frontmatter name to match new filename
						void this.syncFilenameToFrontmatter(file);
						this.scheduleRefresh();
					}
				}
			})
		);
	}

	private refreshTimeout: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Schedule a debounced refresh
	 */
	private scheduleRefresh(): void {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
		}
		this.refreshTimeout = setTimeout(() => {
			this.refreshTimeout = null;
			void this.refreshChart();
		}, 500);
	}

	// ============ State Persistence ============

	getState(): FamilyChartViewState {
		return {
			rootPersonId: this.rootPersonId,
			colorScheme: this.colorScheme,
			editMode: this.editMode,
			nodeSpacing: this.nodeSpacing,
			levelSpacing: this.levelSpacing,
			showBirthDates: this.showBirthDates,
			showDeathDates: this.showDeathDates,
			showKinshipLabels: this.showKinshipLabels,
			showAvatars: this.showAvatars,
			isHorizontal: this.isHorizontal,
			ancestryDepth: this.ancestryDepth,
			progenyDepth: this.progenyDepth,
			showSiblingsOfMain: this.showSiblingsOfMain,
			showSingleParentEmptyCard: this.showSingleParentEmptyCard,
			sortChildrenByBirthDate: this.sortChildrenByBirthDate,
			hidePrivateLiving: this.hidePrivateLiving,
		};
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- Base class requires Promise<void> return type
	async setState(state: Partial<FamilyChartViewState>): Promise<void> {
		logger.debug('set-state', 'Restoring view state', state);

		if (state.rootPersonId !== undefined) {
			this.rootPersonId = state.rootPersonId;
		}
		if (state.colorScheme !== undefined) {
			this.colorScheme = state.colorScheme;
		}
		if (state.editMode !== undefined) {
			this.editMode = state.editMode;
		}
		if (state.nodeSpacing !== undefined) {
			this.nodeSpacing = state.nodeSpacing;
		}
		if (state.levelSpacing !== undefined) {
			this.levelSpacing = state.levelSpacing;
		}
		if (state.showBirthDates !== undefined) {
			this.showBirthDates = state.showBirthDates;
		}
		if (state.showDeathDates !== undefined) {
			this.showDeathDates = state.showDeathDates;
		}
		if (state.showKinshipLabels !== undefined) {
			this.showKinshipLabels = state.showKinshipLabels;
		}
		if (state.showAvatars !== undefined) {
			this.showAvatars = state.showAvatars;
		}
		if (state.isHorizontal !== undefined) {
			this.isHorizontal = state.isHorizontal;
		}
		if (state.ancestryDepth !== undefined) {
			this.ancestryDepth = state.ancestryDepth;
		}
		if (state.progenyDepth !== undefined) {
			this.progenyDepth = state.progenyDepth;
		}
		if (state.showSiblingsOfMain !== undefined) {
			this.showSiblingsOfMain = state.showSiblingsOfMain;
		}
		if (state.showSingleParentEmptyCard !== undefined) {
			this.showSingleParentEmptyCard = state.showSingleParentEmptyCard;
		}
		if (state.sortChildrenByBirthDate !== undefined) {
			this.sortChildrenByBirthDate = state.sortChildrenByBirthDate;
		}
		if (state.hidePrivateLiving !== undefined) {
			this.hidePrivateLiving = state.hidePrivateLiving;
		}

		// Re-initialize chart if the view is already open (chartContainerEl exists)
		// If called before onOpen(), the state is just stored and onOpen() will use it
		if (this.chartContainerEl) {
			if (this.rootPersonId) {
				this.initializeChart();
			} else {
				this.showEmptyState();
			}
		}
	}

	// ============ Pane Menu ============

	onPaneMenu(menu: Menu, source: string): void {
		menu.addItem((item) => {
			item.setTitle('Refresh chart')
				.setIcon('refresh-cw')
				.onClick(() => void this.refreshChart());
		});

		menu.addItem((item) => {
			item.setTitle('Select person')
				.setIcon('user')
				.onClick(() => void this.promptSelectPerson());
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item.setTitle('Duplicate in new tab')
				.setIcon('copy')
				.onClick(() => void this.duplicateView());
		});

		menu.addSeparator();

		super.onPaneMenu(menu, source);
	}

	/**
	 * Duplicate this view in a new tab with the same root person
	 */
	private async duplicateView(): Promise<void> {
		// Open a new family chart view with the same root person
		await this.plugin.activateFamilyChartView(this.rootPersonId || undefined, true, true);
	}

	// ============ Public API ============

	/**
	 * Set the root person and refresh the chart
	 */
	setRootPerson(crId: string): void {
		this.rootPersonId = crId;
		this.initializeChart();
	}
}

/**
 * Confirmation modal for deleting a person from the chart
 */
class DeletePersonConfirmModal extends Modal {
	private personName: string;
	private onResult: (confirmed: boolean) => void;

	constructor(app: App, personName: string, onResult: (confirmed: boolean) => void) {
		super(app);
		this.personName = personName;
		this.onResult = onResult;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText('Delete person from chart?');

		contentEl.createEl('p', {
			text: `Are you sure you want to remove "${this.personName}" from the chart?`
		});
		contentEl.createEl('p', {
			text: 'The person note file will not be deleted, only their entry in the chart.',
			cls: 'mod-muted'
		});

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
			text: 'Delete',
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
 * Modal for customizing family chart colors
 */
class FamilyChartStyleModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private view: FamilyChartView;
	private colors: FamilyChartColors;
	private originalColors: FamilyChartColors | undefined;

	constructor(app: App, plugin: CanvasRootsPlugin, view: FamilyChartView) {
		super(app);
		this.plugin = plugin;
		this.view = view;
		this.originalColors = plugin.settings.familyChartColors
			? { ...plugin.settings.familyChartColors }
			: undefined;
		// Start with current colors or defaults
		this.colors = plugin.settings.familyChartColors
			? { ...plugin.settings.familyChartColors }
			: { ...FamilyChartView['THEME_PRESETS'].classic.colors };
	}

	onOpen(): void {
		const { contentEl, titleEl, modalEl } = this;
		titleEl.setText('Chart Colors');
		modalEl.addClass('cr-fcv-style-modal');

		// Card colors section
		const cardSection = contentEl.createDiv({ cls: 'cr-fcv-color-section' });
		cardSection.createEl('h3', { text: 'Card Colors' });

		this.createColorRow(cardSection, 'Female', this.colors.femaleColor, (val) => {
			this.colors.femaleColor = val;
			this.previewColors();
		});

		this.createColorRow(cardSection, 'Male', this.colors.maleColor, (val) => {
			this.colors.maleColor = val;
			this.previewColors();
		});

		this.createColorRow(cardSection, 'Unknown', this.colors.unknownColor, (val) => {
			this.colors.unknownColor = val;
			this.previewColors();
		});

		// Background section
		const bgSection = contentEl.createDiv({ cls: 'cr-fcv-color-section' });
		const isDark = document.body.classList.contains('theme-dark');
		bgSection.createEl('h3', { text: `Background (${isDark ? 'dark' : 'light'} theme)` });

		if (isDark) {
			this.createColorRow(bgSection, 'Background', this.colors.backgroundDark, (val) => {
				this.colors.backgroundDark = val;
				this.previewColors();
			});
			this.createColorRow(bgSection, 'Text', this.colors.textDark, (val) => {
				this.colors.textDark = val;
				this.previewColors();
			});
		} else {
			this.createColorRow(bgSection, 'Background', this.colors.backgroundLight, (val) => {
				this.colors.backgroundLight = val;
				this.previewColors();
			});
			this.createColorRow(bgSection, 'Text', this.colors.textLight, (val) => {
				this.colors.textLight = val;
				this.previewColors();
			});
		}

		// Presets section
		const presetsSection = contentEl.createDiv({ cls: 'cr-fcv-color-section' });
		presetsSection.createEl('h3', { text: 'Presets' });
		const presetsRow = presetsSection.createDiv({ cls: 'cr-fcv-presets-row' });

		for (const [, preset] of Object.entries(FamilyChartView['THEME_PRESETS'])) {
			const presetBtn = presetsRow.createEl('button', {
				text: preset.name,
				cls: 'cr-fcv-preset-btn'
			});
			presetBtn.addEventListener('click', () => {
				this.colors = { ...preset.colors };
				this.previewColors();
				this.refreshColorInputs();
			});
		}

		// Button row
		const buttonRow = contentEl.createDiv({ cls: 'cr-fcv-button-row' });

		const resetBtn = buttonRow.createEl('button', {
			text: 'Reset',
			cls: 'cr-fcv-btn-secondary'
		});
		resetBtn.addEventListener('click', () => {
			this.colors = { ...FamilyChartView['THEME_PRESETS'].classic.colors };
			this.previewColors();
			this.refreshColorInputs();
		});

		// Spacer
		buttonRow.createDiv({ cls: 'cr-fcv-button-spacer' });

		const cancelBtn = buttonRow.createEl('button', {
			text: 'Cancel',
			cls: 'cr-fcv-btn-secondary'
		});
		cancelBtn.addEventListener('click', () => {
			// Restore original colors
			if (this.originalColors) {
				this.plugin.settings.familyChartColors = this.originalColors;
				this.view['applyCustomColors']();
			} else {
				delete this.plugin.settings.familyChartColors;
				this.view['clearCustomColors']();
			}
			this.close();
		});

		const applyBtn = buttonRow.createEl('button', {
			text: 'Apply',
			cls: 'mod-cta'
		});
		applyBtn.addEventListener('click', () => {
			void (async () => {
				// Save colors
				this.plugin.settings.familyChartColors = { ...this.colors };
				await this.plugin.saveSettings();
				new Notice('Colors applied');
				this.close();
			})();
		});
	}

	/**
	 * Create a color picker row
	 */
	private createColorRow(
		container: HTMLElement,
		label: string,
		value: string,
		onChange: (value: string) => void
	): HTMLElement {
		const row = container.createDiv({ cls: 'cr-fcv-color-row' });

		row.createEl('label', { text: label });

		const inputContainer = row.createDiv({ cls: 'cr-fcv-color-input-container' });

		const colorInput = inputContainer.createEl('input', {
			type: 'color',
			cls: 'cr-fcv-color-input',
			value: this.toHex(value)
		});
		colorInput.dataset.field = label.toLowerCase();

		const hexDisplay = inputContainer.createEl('span', {
			text: this.toHex(value),
			cls: 'cr-fcv-hex-display'
		});

		colorInput.addEventListener('input', (e) => {
			const hex = (e.target as HTMLInputElement).value;
			hexDisplay.setText(hex);
			onChange(hex);
		});

		return row;
	}

	/**
	 * Convert various color formats to hex
	 */
	private toHex(color: string): string {
		// If already hex, return as-is
		if (color.startsWith('#')) {
			return color.length === 4
				? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
				: color;
		}

		// Parse rgb/rgba
		const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (rgbMatch) {
			const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
			const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
			const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
			return `#${r}${g}${b}`;
		}

		return '#808080'; // Fallback gray
	}

	/**
	 * Preview colors in real-time
	 */
	private previewColors(): void {
		this.plugin.settings.familyChartColors = { ...this.colors };
		this.view['applyCustomColors']();
	}

	/**
	 * Refresh all color inputs after preset selection
	 */
	private refreshColorInputs(): void {
		const inputs = this.contentEl.querySelectorAll<HTMLInputElement>('.cr-fcv-color-input');
		const isDark = document.body.classList.contains('theme-dark');

		inputs.forEach((input) => {
			const field = input.dataset.field;
			let value = '';

			switch (field) {
				case 'female':
					value = this.colors.femaleColor;
					break;
				case 'male':
					value = this.colors.maleColor;
					break;
				case 'unknown':
					value = this.colors.unknownColor;
					break;
				case 'background':
					value = isDark ? this.colors.backgroundDark : this.colors.backgroundLight;
					break;
				case 'text':
					value = isDark ? this.colors.textDark : this.colors.textLight;
					break;
			}

			if (value) {
				const hex = this.toHex(value);
				input.value = hex;
				const hexDisplay = input.parentElement?.querySelector('.cr-fcv-hex-display');
				if (hexDisplay) hexDisplay.setText(hex);
			}
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
