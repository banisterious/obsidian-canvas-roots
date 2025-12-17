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
import type { ColorScheme } from '../../settings';
import { getLogger } from '../../core/logging';
import { PersonPickerModal } from '../person-picker';

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

	// Sync state (prevent infinite loops during sync)
	private isSyncing: boolean = false;

	// Services
	private familyGraphService: FamilyGraphService;

	// Data cache
	private chartData: FamilyChartPerson[] = [];

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
			this.showEmptyState();
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
	 * Build the UI structure: toolbar and chart container
	 */
	private buildUI(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass('cr-family-chart-view');

		// Create toolbar
		this.toolbarEl = container.createDiv({ cls: 'cr-fcv-toolbar' });
		this.buildToolbar();

		// Create chart container
		this.chartContainerEl = container.createDiv({ cls: 'cr-fcv-chart-container f3' });
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

		// Edit mode toggle button
		this.editModeBtn = rightControls.createEl('button', {
			cls: `cr-fcv-btn clickable-icon ${this.editMode ? 'is-active' : ''}`,
			attr: { 'aria-label': 'Toggle edit mode' }
		});
		setIcon(this.editModeBtn, 'edit');
		this.editModeBtn.addEventListener('click', () => this.toggleEditMode());

		// History buttons (undo/redo for edit mode)
		this.historyBackBtn = rightControls.createEl('button', {
			cls: 'cr-fcv-btn clickable-icon',
			attr: { 'aria-label': 'Undo', disabled: 'true' }
		});
		setIcon(this.historyBackBtn, 'undo');
		this.historyBackBtn.addEventListener('click', () => this.historyBack());

		this.historyForwardBtn = rightControls.createEl('button', {
			cls: 'cr-fcv-btn clickable-icon',
			attr: { 'aria-label': 'Redo', disabled: 'true' }
		});
		setIcon(this.historyForwardBtn, 'redo');
		this.historyForwardBtn.addEventListener('click', () => this.historyForward());

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

		// Layout settings button
		const layoutBtn = rightControls.createEl('button', {
			cls: 'cr-fcv-btn clickable-icon',
			attr: { 'aria-label': 'Layout settings' }
		});
		setIcon(layoutBtn, 'sliders');
		layoutBtn.addEventListener('click', (e) => this.showLayoutMenu(e));

		// Export button
		const exportBtn = rightControls.createEl('button', {
			cls: 'cr-fcv-btn clickable-icon',
			attr: { 'aria-label': 'Export chart' }
		});
		setIcon(exportBtn, 'download');
		exportBtn.addEventListener('click', (e) => this.showExportMenu(e));

		// Refresh button
		const refreshBtn = rightControls.createEl('button', {
			cls: 'cr-fcv-btn clickable-icon',
			attr: { 'aria-label': 'Refresh chart' }
		});
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.addEventListener('click', () => { void this.refreshChart(); });
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

		// Set CSS variables - family-chart relies on these for card colors
		this.chartContainerEl.setCssProps({
			'--female-color': 'rgb(196, 138, 146)',
			'--male-color': 'rgb(120, 159, 172)',
			'--genderless-color': 'lightgray',
			'--background-color': isDarkMode ? 'rgb(33, 33, 33)' : 'rgb(250, 250, 250)',
			'--text-color': isDarkMode ? '#fff' : '#333'
		});
		// Set direct styles on container (hidden until chart is positioned)
		this.chartContainerEl.setCssStyles({
			backgroundColor: isDarkMode ? 'rgb(33, 33, 33)' : 'rgb(250, 250, 250)',
			color: isDarkMode ? '#fff' : '#333',
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

		// Transform to family-chart format, filtering relationship IDs to only valid ones
		this.chartData = people.map(person => this.transformPersonNode(person, validIds, peopleMap));
		const transformTime = performance.now();

		logger.debug('data-load', 'Loaded chart data', {
			count: this.chartData.length,
			timing: {
				cacheLoad: `${(cacheLoadTime - startTime).toFixed(1)}ms`,
				getAllPeople: `${(getAllPeopleTime - cacheLoadTime).toFixed(1)}ms`,
				buildMaps: `${(buildMapsTime - getAllPeopleTime).toFixed(1)}ms`,
				transform: `${(transformTime - buildMapsTime).toFixed(1)}ms`,
				total: `${(transformTime - startTime).toFixed(1)}ms`
			}
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

		// If no biological parents, use adoptive parents instead
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
		// Include biological and adoptive children (matching the parent logic above)
		const children = (person.childrenCrIds || []).filter(childId => {
			if (!validIds.has(childId)) return false;
			// Use the pre-built map for O(1) lookup instead of service call
			const childPerson = peopleMap.get(childId);
			if (!childPerson) return false;
			// Check biological parent relationship
			if (childPerson.fatherCrId === person.crId || childPerson.motherCrId === person.crId) {
				return true;
			}
			// Check adoptive parent relationship (only if child has no biological parents)
			// This matches the parent logic: adoptive parents only used when no biological parents
			if (!childPerson.fatherCrId && !childPerson.motherCrId) {
				if (childPerson.adoptiveFatherCrId === person.crId || childPerson.adoptiveMotherCrId === person.crId) {
					return true;
				}
			}
			return false;
		});

		return {
			id: person.crId,
			data: {
				'first name': firstName,
				'last name': lastName,
				gender,
				birthday: person.birthDate,
				deathday: person.deathDate,
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
	private handleCardClick(e: MouseEvent, d: { data: { id: string; [key: string]: unknown } }): void {
		const personId = d.data.id;

		logger.debug('card-click', 'Card clicked', { personId, editMode: this.editMode });

		// In edit mode, EditTree handles the click via setCardClickOpen
		// In view mode, open the person's note in addition to navigation
		if (!this.editMode) {
			void this.openPersonNote(personId);
		}

		// Call default card click behavior for navigation (centers on the person)
		if (this.f3Card) {
			// Cast to unknown first, then to expected type - the f3 library expects its internal TreeDatum type
			this.f3Card.onCardClickDefault(e, d as unknown as Parameters<typeof this.f3Card.onCardClickDefault>[1]);
		}
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
		const view = this;

		// Return a regular function so `this` is bound to the card element by family-chart
		return function(this: SVGGElement, d: { data: { id: string } }) {
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
		// Clear and reload the cache
		this.familyGraphService.clearCache();

		if (waitForMetadataCache) {
			// Wait for Obsidian's metadata cache to finish processing (needed after batch operations)
			await new Promise(resolve => setTimeout(resolve, 2000));
		}

		// ensureCacheLoaded will reload since cache was cleared
		if (this.rootPersonId) {
			this.initializeChart();
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
	 * Show export menu with PNG and SVG options
	 */
	private showExportMenu(e: MouseEvent): void {
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle('Export as PNG')
				.setIcon('image')
				.onClick(() => this.exportAsPng());
		});

		menu.addItem((item) => {
			item.setTitle('Export as SVG')
				.setIcon('file-code')
				.onClick(() => this.exportAsSvg());
		});

		menu.addItem((item) => {
			item.setTitle('Export as PDF')
				.setIcon('file-text')
				.onClick(() => this.exportAsPdf());
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
	private exportAsPng(): void {
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

	// ============ Layout Configuration ============

	/**
	 * Show layout settings menu
	 */
	private showLayoutMenu(e: MouseEvent): void {
		const menu = new Menu();

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

		menu.addSeparator();

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

		menu.showAtMouseEvent(e);
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
	 */
	private exportAsSvg(): void {
		if (!this.f3Chart) return;

		const svg = this.f3Chart.svg;
		if (!svg) {
			new Notice('No chart to export');
			return;
		}

		try {
			// Prepare SVG for export using shared helper
			const { svgClone } = this.prepareSvgForExport(svg as SVGSVGElement);

			// Serialize
			const serializer = new XMLSerializer();
			const svgString = serializer.serializeToString(svgClone);

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
	private exportAsPdf(): void {
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
		this.f3EditTree = this.f3Chart.editTree()
			// Configure editable fields
			.setFields([
				{ type: 'text', label: 'First name', id: 'first name' },
				{ type: 'text', label: 'Last name', id: 'last name' },
				{ type: 'text', label: 'Birth date', id: 'birthday' },
				{ type: 'text', label: 'Death date', id: 'deathday' }
			])
			// Set up card click to open edit form when in edit mode
			.setCardClickOpen(this.f3Card)
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
		// Listen for note modifications to refresh the chart
		this.registerEvent(
			this.app.vault.on('modify', (file: TFile) => {
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
