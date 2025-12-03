/**
 * Map View - Interactive geographic visualization
 *
 * An Obsidian ItemView that renders a Leaflet map for visualizing
 * birth/death locations and migration patterns.
 */

import { ItemView, WorkspaceLeaf, Menu, Notice } from 'obsidian';
import type CanvasRootsPlugin from '../../main';
import { getLogger } from '../core/logging';
import { MapController } from './map-controller';
import { MapDataService } from './map-data-service';
import type {
	MapState,
	MapFilters,
	LayerVisibility,
	MapSettings,
	CustomMapConfig,
	TimeSliderState,
	MapData,
	PersonLifeSpan
} from './types/map-types';

const logger = getLogger('MapView');

export const VIEW_TYPE_MAP = 'canvas-roots-map';

/**
 * View state that gets persisted
 */
interface MapViewState {
	filters: MapFilters;
	layers: LayerVisibility;
	center?: { lat: number; lng: number };
	zoom?: number;
	activeMap?: string;
	[key: string]: unknown;
}

/**
 * Interactive Map View for geographic visualization
 */
export class MapView extends ItemView {
	plugin: CanvasRootsPlugin;

	// Controllers and services
	private mapController: MapController | null = null;
	private dataService: MapDataService;

	// UI elements
	private toolbarEl: HTMLElement | null = null;
	private mapContainerEl: HTMLElement | null = null;
	private statusBarEl: HTMLElement | null = null;
	private mapSelectEl: HTMLSelectElement | null = null;
	private timeSliderContainerEl: HTMLElement | null = null;

	// View state
	private filters: MapFilters = {};
	private customMaps: CustomMapConfig[] = [];
	private layers: LayerVisibility = {
		// Core life events
		births: true,
		deaths: true,
		marriages: false,
		burials: false,
		// Additional life events
		residences: true,
		occupations: true,
		educations: true,
		military: true,
		immigrations: true,
		religious: true,
		custom: true,
		// Other layers
		paths: true,
		heatMap: false
	};

	// Time slider state
	private timeSlider: TimeSliderState = {
		enabled: false,
		currentYear: 1900,
		isPlaying: false,
		speed: 500, // ms per year
		snapshotMode: true
	};
	private animationInterval: number | null = null;
	private currentMapData: MapData | null = null;

	// Edit mode state
	private editModeEnabled: boolean = false;
	private editBannerEl: HTMLElement | null = null;
	private editBtn: HTMLButtonElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: CanvasRootsPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.dataService = new MapDataService(plugin);
	}

	getViewType(): string {
		return VIEW_TYPE_MAP;
	}

	getDisplayText(): string {
		return 'Map view';
	}

	getIcon(): string {
		return 'map';
	}

	async onOpen(): Promise<void> {
		logger.debug('view-open', 'Opening MapView');

		// Build UI structure
		this.buildUI();

		// Wait for container to have valid dimensions
		await this.waitForContainerDimensions();

		// Initialize map
		await this.initializeMap();

		// Register event handlers
		this.registerEventHandlers();
	}

	/**
	 * Wait for the map container to have valid dimensions
	 * Leaflet requires the container to have width/height when initializing
	 */
	private async waitForContainerDimensions(): Promise<void> {
		const maxAttempts = 20;
		const delayMs = 50;

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			if (this.mapContainerEl) {
				const rect = this.mapContainerEl.getBoundingClientRect();
				logger.debug('container-dimensions', `Attempt ${attempt + 1}: ${rect.width}x${rect.height}`);

				if (rect.width > 0 && rect.height > 0) {
					return;
				}
			}

			// Wait and try again
			await new Promise<void>(resolve => {
				requestAnimationFrame(() => {
					setTimeout(resolve, delayMs);
				});
			});
		}

		// Log warning but continue anyway - map might still work
		logger.warn('container-dimensions', 'Container dimensions not detected after waiting');
	}

	async onClose(): Promise<void> {
		logger.debug('view-close', 'Closing MapView');
		this.destroyMap();
	}

	/**
	 * Get state to persist
	 */
	getState(): MapViewState {
		const state: MapViewState = {
			filters: this.filters,
			layers: this.layers
		};

		if (this.mapController) {
			const mapState = this.mapController.getState();
			state.center = mapState.center;
			state.zoom = mapState.zoom;
			state.activeMap = mapState.activeMap;
		}

		return state;
	}

	/**
	 * Restore state from persistence
	 */
	async setState(state: MapViewState, result: { history: boolean }): Promise<void> {
		if (state.filters) {
			this.filters = state.filters;
		}
		if (state.layers) {
			this.layers = { ...this.layers, ...state.layers };
		}

		// Apply state to map controller if it exists
		if (this.mapController) {
			if (state.center && state.zoom !== undefined) {
				this.mapController.setView(state.center, state.zoom);
			}
			if (state.activeMap) {
				this.mapController.setActiveMap(state.activeMap);
			}
			this.mapController.setLayerVisibility(this.layers);
			await this.refreshData();
		}

		await super.setState(state, result);
	}

	/**
	 * Build the UI structure: toolbar, map container, and status bar
	 */
	private buildUI(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass('cr-map-view');

		// Create toolbar
		this.toolbarEl = container.createDiv({ cls: 'cr-map-toolbar' });
		this.buildToolbar();

		// Create time slider panel (hidden by default)
		this.timeSliderContainerEl = container.createDiv({ cls: 'cr-map-time-slider-container' });
		this.timeSliderContainerEl.style.display = 'none';
		this.buildTimeSlider();

		// Create map container
		this.mapContainerEl = container.createDiv({ cls: 'cr-map-container' });

		// Create status bar
		this.statusBarEl = container.createDiv({ cls: 'cr-map-status' });
		this.updateStatusBar();
	}

	/**
	 * Build the toolbar with controls
	 */
	private buildToolbar(): void {
		if (!this.toolbarEl) return;
		this.toolbarEl.empty();

		// Left section: Layer toggles and map selector
		const leftSection = this.toolbarEl.createDiv({ cls: 'cr-map-toolbar-left' });

		// Map selector dropdown
		this.mapSelectEl = leftSection.createEl('select', {
			cls: 'cr-map-select',
			attr: { 'aria-label': 'Select map' }
		});
		this.mapSelectEl.createEl('option', { value: 'openstreetmap', text: 'Real World' });
		// Custom maps will be populated after loading
		this.mapSelectEl.addEventListener('change', async () => {
			const mapId = this.mapSelectEl?.value || 'openstreetmap';
			// The map change callback will handle filtering and data refresh
			await this.mapController?.setActiveMap(mapId);
		});

		// Layers dropdown
		const layersBtn = leftSection.createEl('button', {
			cls: 'cr-map-btn',
			attr: { 'aria-label': 'Layers' }
		});
		layersBtn.createSpan({ text: 'Layers' });
		layersBtn.addEventListener('click', (e) => this.showLayersMenu(e));

		// Center section: Filters
		const centerSection = this.toolbarEl.createDiv({ cls: 'cr-map-toolbar-center' });

		// Collection filter
		const collectionSelect = centerSection.createEl('select', {
			cls: 'cr-map-select',
			attr: { 'aria-label': 'Filter by collection' }
		});
		collectionSelect.createEl('option', { value: '', text: 'All collections' });
		// Options will be populated when data loads
		collectionSelect.addEventListener('change', () => {
			this.filters.collection = collectionSelect.value || undefined;
			void this.refreshData();
		});

		// Year range
		const yearFromInput = centerSection.createEl('input', {
			cls: 'cr-map-input',
			attr: {
				type: 'number',
				placeholder: 'From year',
				'aria-label': 'From year'
			}
		});
		yearFromInput.addEventListener('change', () => {
			this.filters.yearFrom = yearFromInput.value ? parseInt(yearFromInput.value) : undefined;
			void this.refreshData();
		});

		centerSection.createSpan({ text: '–', cls: 'cr-map-separator' });

		const yearToInput = centerSection.createEl('input', {
			cls: 'cr-map-input',
			attr: {
				type: 'number',
				placeholder: 'To year',
				'aria-label': 'To year'
			}
		});
		yearToInput.addEventListener('change', () => {
			this.filters.yearTo = yearToInput.value ? parseInt(yearToInput.value) : undefined;
			void this.refreshData();
		});

		// Right section: Actions
		const rightSection = this.toolbarEl.createDiv({ cls: 'cr-map-toolbar-right' });

		// Edit mode button (for custom maps only)
		this.editBtn = rightSection.createEl('button', {
			cls: 'cr-map-btn cr-map-btn-edit',
			attr: { 'aria-label': 'Edit map alignment' }
		});
		this.editBtn.createSpan({ text: 'Edit' });
		this.editBtn.addEventListener('click', () => this.toggleEditMode());
		// Initially disabled (enabled when custom map is selected)
		this.editBtn.disabled = true;

		// Split view button (for side-by-side comparison)
		const splitBtn = rightSection.createEl('button', {
			cls: 'cr-map-btn',
			attr: { 'aria-label': 'Split view for comparison' }
		});
		splitBtn.createSpan({ text: 'Compare' });
		splitBtn.addEventListener('click', (e) => this.showCompareMenu(e));

		// Timeline toggle button
		const timelineBtn = rightSection.createEl('button', {
			cls: 'cr-map-btn',
			attr: { 'aria-label': 'Toggle timeline' }
		});
		timelineBtn.createSpan({ text: 'Timeline' });
		timelineBtn.addEventListener('click', () => this.toggleTimeSlider());

		// Refresh button (force refresh reads directly from files, bypassing metadata cache)
		const refreshBtn = rightSection.createEl('button', {
			cls: 'cr-map-btn',
			attr: { 'aria-label': 'Refresh data' }
		});
		refreshBtn.createSpan({ text: 'Refresh' });
		refreshBtn.addEventListener('click', () => void this.refreshData(true));

		// Export dropdown
		const exportBtn = rightSection.createEl('button', {
			cls: 'cr-map-btn',
			attr: { 'aria-label': 'Export Overlay' }
		});
		exportBtn.createSpan({ text: 'Export Overlay' });
		exportBtn.addEventListener('click', (e) => this.showExportMenu(e));
	}

	/**
	 * Show layers menu
	 */
	private showLayersMenu(e: MouseEvent): void {
		const menu = new Menu();

		// Core life events section
		menu.addItem((item) => {
			item.setTitle('Birth markers')
				.setChecked(this.layers.births)
				.onClick(() => {
					this.layers.births = !this.layers.births;
					this.mapController?.setLayerVisibility(this.layers);
				});
		});

		menu.addItem((item) => {
			item.setTitle('Death markers')
				.setChecked(this.layers.deaths)
				.onClick(() => {
					this.layers.deaths = !this.layers.deaths;
					this.mapController?.setLayerVisibility(this.layers);
				});
		});

		menu.addItem((item) => {
			item.setTitle('Marriage markers')
				.setChecked(this.layers.marriages)
				.onClick(() => {
					this.layers.marriages = !this.layers.marriages;
					this.mapController?.setLayerVisibility(this.layers);
				});
		});

		menu.addItem((item) => {
			item.setTitle('Burial markers')
				.setChecked(this.layers.burials)
				.onClick(() => {
					this.layers.burials = !this.layers.burials;
					this.mapController?.setLayerVisibility(this.layers);
				});
		});

		menu.addSeparator();

		// Additional life events section
		menu.addItem((item) => {
			item.setTitle('Residence markers')
				.setChecked(this.layers.residences)
				.onClick(() => {
					this.layers.residences = !this.layers.residences;
					this.mapController?.setLayerVisibility(this.layers);
				});
		});

		menu.addItem((item) => {
			item.setTitle('Occupation markers')
				.setChecked(this.layers.occupations)
				.onClick(() => {
					this.layers.occupations = !this.layers.occupations;
					this.mapController?.setLayerVisibility(this.layers);
				});
		});

		menu.addItem((item) => {
			item.setTitle('Education markers')
				.setChecked(this.layers.educations)
				.onClick(() => {
					this.layers.educations = !this.layers.educations;
					this.mapController?.setLayerVisibility(this.layers);
				});
		});

		menu.addItem((item) => {
			item.setTitle('Military markers')
				.setChecked(this.layers.military)
				.onClick(() => {
					this.layers.military = !this.layers.military;
					this.mapController?.setLayerVisibility(this.layers);
				});
		});

		menu.addItem((item) => {
			item.setTitle('Immigration markers')
				.setChecked(this.layers.immigrations)
				.onClick(() => {
					this.layers.immigrations = !this.layers.immigrations;
					this.mapController?.setLayerVisibility(this.layers);
				});
		});

		menu.addItem((item) => {
			item.setTitle('Religious markers')
				.setChecked(this.layers.religious)
				.onClick(() => {
					this.layers.religious = !this.layers.religious;
					this.mapController?.setLayerVisibility(this.layers);
				});
		});

		menu.addItem((item) => {
			item.setTitle('Custom markers')
				.setChecked(this.layers.custom)
				.onClick(() => {
					this.layers.custom = !this.layers.custom;
					this.mapController?.setLayerVisibility(this.layers);
				});
		});

		menu.addSeparator();

		// Other layers section
		menu.addItem((item) => {
			item.setTitle('Migration paths')
				.setChecked(this.layers.paths)
				.onClick(() => {
					this.layers.paths = !this.layers.paths;
					this.mapController?.setLayerVisibility(this.layers);
				});
		});

		menu.addItem((item) => {
			item.setTitle('Heat map')
				.setChecked(this.layers.heatMap)
				.onClick(() => {
					this.layers.heatMap = !this.layers.heatMap;
					this.mapController?.setLayerVisibility(this.layers);
				});
		});

		menu.showAtMouseEvent(e);
	}

	/**
	 * Show export menu
	 */
	private showExportMenu(e: MouseEvent): void {
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle('Export as GeoJSON Overlay')
				.setIcon('file-json')
				.onClick(() => void this.exportGeoJSON());
		});

		menu.addItem((item) => {
			item.setTitle('Export as SVG Overlay')
				.setIcon('image')
				.onClick(() => void this.exportSVG());
		});

		menu.showAtMouseEvent(e);
	}

	/**
	 * Show compare menu for splitting the view
	 */
	private showCompareMenu(e: MouseEvent): void {
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle('Split horizontally')
				.setIcon('separator-horizontal')
				.onClick(() => this.splitView('horizontal'));
		});

		menu.addItem((item) => {
			item.setTitle('Split vertically')
				.setIcon('separator-vertical')
				.onClick(() => this.splitView('vertical'));
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item.setTitle('Open in new tab')
				.setIcon('tab')
				.onClick(() => this.openNewMapTab());
		});

		menu.showAtMouseEvent(e);
	}

	/**
	 * Split this view to create a side-by-side comparison
	 */
	private splitView(direction: 'horizontal' | 'vertical'): void {
		const pluginInstance = this.plugin as unknown as {
			activateMapView: (mapId?: string, forceNew?: boolean, splitDirection?: 'horizontal' | 'vertical') => Promise<void>
		};
		void pluginInstance.activateMapView(undefined, true, direction);
	}

	/**
	 * Open a new map view in a new tab
	 */
	private openNewMapTab(): void {
		const pluginInstance = this.plugin as unknown as {
			activateMapView: (mapId?: string, forceNew?: boolean) => Promise<void>
		};
		void pluginInstance.activateMapView(undefined, true);
	}

	// =========================================================================
	// Time Slider Methods
	// =========================================================================

	/**
	 * Build the time slider panel
	 */
	private buildTimeSlider(): void {
		if (!this.timeSliderContainerEl) return;
		this.timeSliderContainerEl.empty();

		// Year display
		const yearDisplay = this.timeSliderContainerEl.createDiv({ cls: 'cr-map-time-year' });
		yearDisplay.createSpan({ cls: 'cr-map-time-year-value', text: String(this.timeSlider.currentYear) });
		yearDisplay.createSpan({ cls: 'cr-map-time-year-label', text: '' });

		// Slider row
		const sliderRow = this.timeSliderContainerEl.createDiv({ cls: 'cr-map-time-slider-row' });

		// Min year label
		const minLabel = sliderRow.createSpan({ cls: 'cr-map-time-label', text: '1800' });

		// Slider input
		const slider = sliderRow.createEl('input', {
			cls: 'cr-map-time-slider',
			attr: {
				type: 'range',
				min: '1800',
				max: '2000',
				value: String(this.timeSlider.currentYear),
				'aria-label': 'Select year'
			}
		});

		// Max year label
		const maxLabel = sliderRow.createSpan({ cls: 'cr-map-time-label', text: '2000' });

		// Update slider on change
		slider.addEventListener('input', () => {
			this.timeSlider.currentYear = parseInt(slider.value);
			this.updateTimeSliderDisplay();
			this.applyTimeFilter();
		});

		// Controls row
		const controlsRow = this.timeSliderContainerEl.createDiv({ cls: 'cr-map-time-controls' });

		// Play/Pause button
		const playBtn = controlsRow.createEl('button', {
			cls: 'cr-map-btn cr-map-time-play',
			attr: { 'aria-label': 'Play animation' }
		});
		playBtn.createSpan({ text: '▶' });
		playBtn.addEventListener('click', () => this.toggleAnimation());

		// Speed selector
		const speedLabel = controlsRow.createSpan({ cls: 'cr-map-time-speed-label', text: 'Speed:' });
		const speedSelect = controlsRow.createEl('select', {
			cls: 'cr-map-select cr-map-time-speed',
			attr: { 'aria-label': 'Animation speed' }
		});
		speedSelect.createEl('option', { value: '1000', text: 'Slow' });
		speedSelect.createEl('option', { value: '500', text: 'Normal', attr: { selected: 'selected' } });
		speedSelect.createEl('option', { value: '200', text: 'Fast' });
		speedSelect.createEl('option', { value: '50', text: 'Very fast' });
		speedSelect.value = String(this.timeSlider.speed);
		speedSelect.addEventListener('change', () => {
			this.timeSlider.speed = parseInt(speedSelect.value);
			if (this.timeSlider.isPlaying) {
				// Restart animation with new speed
				this.stopAnimation();
				this.startAnimation();
			}
		});

		// Mode toggle (snapshot vs cumulative)
		const modeLabel = controlsRow.createSpan({ cls: 'cr-map-time-mode-label', text: 'Mode:' });
		const modeSelect = controlsRow.createEl('select', {
			cls: 'cr-map-select cr-map-time-mode',
			attr: { 'aria-label': 'Display mode' }
		});
		modeSelect.createEl('option', { value: 'snapshot', text: 'Alive in year' });
		modeSelect.createEl('option', { value: 'cumulative', text: 'Born by year' });
		modeSelect.value = this.timeSlider.snapshotMode ? 'snapshot' : 'cumulative';
		modeSelect.addEventListener('change', () => {
			this.timeSlider.snapshotMode = modeSelect.value === 'snapshot';
			this.applyTimeFilter();
		});

		// Alive count display
		controlsRow.createSpan({ cls: 'cr-map-time-count', text: '' });
	}

	/**
	 * Toggle time slider visibility
	 */
	private toggleTimeSlider(): void {
		this.timeSlider.enabled = !this.timeSlider.enabled;

		if (this.timeSliderContainerEl) {
			this.timeSliderContainerEl.style.display = this.timeSlider.enabled ? 'flex' : 'none';
		}

		// Update button state
		const btn = this.toolbarEl?.querySelector('.cr-map-toolbar-right button:first-child');
		if (btn) {
			btn.classList.toggle('cr-map-btn-active', this.timeSlider.enabled);
		}

		if (this.timeSlider.enabled) {
			// Update slider range from data
			this.updateTimeSliderRange();
			// Apply initial filter
			this.applyTimeFilter();
		} else {
			// Stop animation if running
			this.stopAnimation();
			// Show all markers
			this.showAllMarkers();
		}
	}

	/**
	 * Update time slider range based on data
	 */
	private updateTimeSliderRange(): void {
		if (!this.currentMapData || !this.timeSliderContainerEl) return;

		const { yearRange } = this.currentMapData;
		const slider = this.timeSliderContainerEl.querySelector('.cr-map-time-slider') as HTMLInputElement;
		const minLabel = this.timeSliderContainerEl.querySelector('.cr-map-time-label:first-child');
		const maxLabel = this.timeSliderContainerEl.querySelector('.cr-map-time-label:last-child');

		if (slider) {
			slider.min = String(yearRange.min);
			slider.max = String(yearRange.max);

			// Set current year to middle of range if out of bounds
			if (this.timeSlider.currentYear < yearRange.min || this.timeSlider.currentYear > yearRange.max) {
				this.timeSlider.currentYear = Math.floor((yearRange.min + yearRange.max) / 2);
				slider.value = String(this.timeSlider.currentYear);
			}
		}

		if (minLabel) minLabel.textContent = String(yearRange.min);
		if (maxLabel) maxLabel.textContent = String(yearRange.max);

		this.updateTimeSliderDisplay();
	}

	/**
	 * Update the time slider display (year value and count)
	 */
	private updateTimeSliderDisplay(): void {
		if (!this.timeSliderContainerEl || !this.currentMapData) return;

		const yearValue = this.timeSliderContainerEl.querySelector('.cr-map-time-year-value');
		const yearLabel = this.timeSliderContainerEl.querySelector('.cr-map-time-year-label');
		const countDisplay = this.timeSliderContainerEl.querySelector('.cr-map-time-count');

		if (yearValue) {
			yearValue.textContent = String(this.timeSlider.currentYear);
		}

		// Calculate people alive/born
		const count = this.countPeopleForYear(this.timeSlider.currentYear);
		const total = this.currentMapData.personLifeSpans.length;

		if (yearLabel) {
			yearLabel.textContent = this.timeSlider.snapshotMode ? '' : ' (cumulative)';
		}

		if (countDisplay) {
			const label = this.timeSlider.snapshotMode ? 'alive' : 'born';
			countDisplay.textContent = `${count} of ${total} ${label}`;
		}
	}

	/**
	 * Count people alive (or born) for a given year
	 */
	private countPeopleForYear(year: number): number {
		if (!this.currentMapData) return 0;

		let count = 0;
		for (const person of this.currentMapData.personLifeSpans) {
			if (this.isPersonVisibleForYear(person, year)) {
				count++;
			}
		}
		return count;
	}

	/**
	 * Check if a person should be visible for a given year
	 */
	private isPersonVisibleForYear(person: PersonLifeSpan, year: number): boolean {
		if (this.timeSlider.snapshotMode) {
			// Snapshot mode: person was alive during this year
			const birthYear = person.birthYear ?? -Infinity;
			const deathYear = person.deathYear ?? Infinity;
			return birthYear <= year && year <= deathYear;
		} else {
			// Cumulative mode: person was born by this year
			const birthYear = person.birthYear ?? Infinity;
			return birthYear <= year;
		}
	}

	/**
	 * Apply time filter to show/hide markers
	 */
	private applyTimeFilter(): void {
		if (!this.mapController || !this.currentMapData) return;

		// Get IDs of people visible for current year
		const visiblePersonIds = new Set<string>();
		for (const person of this.currentMapData.personLifeSpans) {
			if (this.isPersonVisibleForYear(person, this.timeSlider.currentYear)) {
				visiblePersonIds.add(person.personId);
			}
		}

		// Filter markers
		const filteredMarkers = this.currentMapData.markers.filter(m => visiblePersonIds.has(m.personId));

		// Filter paths (both endpoints must be visible)
		const filteredPaths = this.currentMapData.paths.filter(p => visiblePersonIds.has(p.personId));

		// Update map controller with filtered data
		this.mapController.setFilteredData(filteredMarkers, filteredPaths);

		// Update display
		this.updateTimeSliderDisplay();
		this.updateStatusBar(filteredMarkers.length, filteredPaths.length);
	}

	/**
	 * Show all markers (disable time filtering)
	 */
	private showAllMarkers(): void {
		if (!this.mapController || !this.currentMapData) return;

		this.mapController.setData(this.currentMapData);
		this.updateStatusBar(this.currentMapData.markers.length, this.currentMapData.paths.length);
	}

	/**
	 * Toggle animation playback
	 */
	private toggleAnimation(): void {
		if (this.timeSlider.isPlaying) {
			this.stopAnimation();
		} else {
			this.startAnimation();
		}
	}

	/**
	 * Start animation
	 */
	private startAnimation(): void {
		if (!this.currentMapData) return;

		this.timeSlider.isPlaying = true;
		this.updatePlayButton();

		const { yearRange } = this.currentMapData;

		this.animationInterval = window.setInterval(() => {
			this.timeSlider.currentYear++;

			// Loop back to start when reaching end
			if (this.timeSlider.currentYear > yearRange.max) {
				this.timeSlider.currentYear = yearRange.min;
			}

			// Update slider position
			const slider = this.timeSliderContainerEl?.querySelector('.cr-map-time-slider') as HTMLInputElement;
			if (slider) {
				slider.value = String(this.timeSlider.currentYear);
			}

			this.applyTimeFilter();
		}, this.timeSlider.speed);
	}

	/**
	 * Stop animation
	 */
	private stopAnimation(): void {
		this.timeSlider.isPlaying = false;
		this.updatePlayButton();

		if (this.animationInterval !== null) {
			window.clearInterval(this.animationInterval);
			this.animationInterval = null;
		}
	}

	/**
	 * Update play button appearance
	 */
	private updatePlayButton(): void {
		const playBtn = this.timeSliderContainerEl?.querySelector('.cr-map-time-play span');
		if (playBtn) {
			playBtn.textContent = this.timeSlider.isPlaying ? '⏸' : '▶';
		}
	}

	// =========================================================================
	// Map Initialization Methods
	// =========================================================================

	/**
	 * Initialize the Leaflet map
	 */
	private async initializeMap(): Promise<void> {
		if (!this.mapContainerEl) {
			logger.error('init-error', 'Map container not found');
			return;
		}

		// Log container dimensions for debugging
		const rect = this.mapContainerEl.getBoundingClientRect();
		logger.debug('init-container', `Container dimensions: ${rect.width}x${rect.height}`);

		try {
			// Get map settings from plugin
			const settings = this.getMapSettings();

			// Create map controller
			this.mapController = new MapController(
				this.mapContainerEl,
				settings,
				this.plugin
			);

			// Initialize the map
			await this.mapController.initialize();

			// Register map change callback to filter by universe and sync dropdown
			this.mapController.onMapChange((mapId, universe) => {
				// Update universe filter
				this.filters.universe = universe ?? undefined;

				// Sync dropdown
				if (this.mapSelectEl) {
					this.mapSelectEl.value = mapId;
				}

				// Enable/disable edit button based on map type
				if (this.editBtn) {
					const canEdit = this.mapController?.canEnableEditMode() ?? false;
					this.editBtn.disabled = !canEdit;
				}

				// If edit mode was enabled and we switched maps, disable it
				if (this.editModeEnabled) {
					void this.disableEditMode();
				}

				// Refresh data with new universe filter
				void this.refreshData();
			});

			// Register edit mode change callback
			this.mapController.onEditModeChange((enabled) => {
				this.editModeEnabled = enabled;
				this.updateEditUI();
			});

			// Register corners saved callback
			this.mapController.onCornersSaved(() => {
				new Notice('Map alignment saved to frontmatter');
			});

			// Load custom maps and populate dropdown
			await this.loadCustomMaps();

			// Load initial data
			await this.refreshData();

			logger.info('init-success', 'Map initialized successfully');
		} catch (error) {
			// Log more details about the error
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;
			logger.error('init-error', 'Failed to initialize map', {
				message: errorMessage,
				stack: errorStack,
				containerWidth: rect.width,
				containerHeight: rect.height
			});
			this.showError(`Failed to initialize map: ${errorMessage}`);
		}
	}

	/**
	 * Destroy the map and clean up resources
	 */
	private destroyMap(): void {
		if (this.mapController) {
			this.mapController.destroy();
			this.mapController = null;
		}
	}

	/**
	 * Refresh map data based on current filters
	 * @param forceRefresh If true, read directly from files instead of metadata cache
	 */
	async refreshData(forceRefresh = false): Promise<void> {
		if (!this.mapController) return;

		try {
			logger.debug('refresh-start', 'Refreshing map data', { filters: this.filters, forceRefresh });

			// Get data from service (force refresh bypasses metadata cache)
			const data = await this.dataService.getMapData(this.filters, forceRefresh);

			// Store current map data for time slider
			this.currentMapData = data;

			// Update map with new data (or filtered if time slider is active)
			if (this.timeSlider.enabled) {
				this.updateTimeSliderRange();
				this.applyTimeFilter();
			} else {
				this.mapController.setData(data);
				this.updateStatusBar(data.markers.length, data.paths.length);
			}

			this.mapController.setLayerVisibility(this.layers);

			// Update collection dropdown
			this.updateCollectionDropdown(data.collections);

			logger.debug('refresh-complete', 'Map data refreshed', {
				markers: data.markers.length,
				paths: data.paths.length,
				personLifeSpans: data.personLifeSpans.length
			});
		} catch (error) {
			logger.error('refresh-error', 'Failed to refresh map data', { error });
			this.showError('Failed to load map data');
		}
	}

	/**
	 * Update the status bar with current stats
	 */
	private updateStatusBar(markerCount?: number, pathCount?: number): void {
		if (!this.statusBarEl) return;

		this.statusBarEl.empty();

		if (markerCount !== undefined && pathCount !== undefined) {
			this.statusBarEl.createSpan({
				text: `${markerCount} locations • ${pathCount} migration paths`
			});
		} else {
			this.statusBarEl.createSpan({ text: 'Loading...' });
		}

		// Attribution
		this.statusBarEl.createSpan({
			text: ' • © OpenStreetMap contributors',
			cls: 'cr-map-attribution'
		});
	}

	/**
	 * Update collection dropdown with available options
	 */
	private updateCollectionDropdown(collections: string[]): void {
		// Find collection select (second select in toolbar, after map select)
		const selects = this.toolbarEl?.querySelectorAll('.cr-map-toolbar-center .cr-map-select');
		const select = selects?.[0] as HTMLSelectElement | null;
		if (!select) return;

		// Save current selection
		const currentValue = select.value;

		// Clear and repopulate
		select.empty();
		select.createEl('option', { value: '', text: 'All collections' });

		for (const collection of collections.sort()) {
			select.createEl('option', { value: collection, text: collection });
		}

		// Restore selection if still valid
		if (currentValue && collections.includes(currentValue)) {
			select.value = currentValue;
		}
	}

	/**
	 * Load custom maps and populate the map selector dropdown
	 */
	private async loadCustomMaps(): Promise<void> {
		if (!this.mapController || !this.mapSelectEl) return;

		try {
			this.customMaps = await this.mapController.getCustomMaps();

			// Clear existing custom map options (keep OpenStreetMap)
			while (this.mapSelectEl.options.length > 1) {
				this.mapSelectEl.remove(1);
			}

			// Add separator if there are custom maps
			if (this.customMaps.length > 0) {
				const separator = this.mapSelectEl.createEl('option', {
					value: '',
					text: '── Custom Maps ──',
					attr: { disabled: 'true' }
				});
				separator.disabled = true;

				// Add custom maps grouped by universe
				const byUniverse = new Map<string, CustomMapConfig[]>();
				for (const map of this.customMaps) {
					const universe = map.universe || 'Other';
					if (!byUniverse.has(universe)) {
						byUniverse.set(universe, []);
					}
					byUniverse.get(universe)!.push(map);
				}

				for (const [universe, maps] of byUniverse) {
					for (const map of maps) {
						this.mapSelectEl.createEl('option', {
							value: map.id,
							text: `${map.name} (${universe})`
						});
					}
				}
			}

			logger.debug('load-custom-maps', `Loaded ${this.customMaps.length} custom maps`);
		} catch (error) {
			logger.error('load-custom-maps-error', 'Failed to load custom maps', { error });
		}
	}

	/**
	 * Export current view as GeoJSON
	 */
	private async exportGeoJSON(): Promise<void> {
		if (!this.mapController) return;

		try {
			const geojson = this.mapController.exportGeoJSON();
			const filename = `map-export-${new Date().toISOString().slice(0, 10)}.geojson`;

			await this.plugin.app.vault.create(filename, JSON.stringify(geojson, null, 2));
			logger.info('export-geojson', 'GeoJSON exported', { filename });
		} catch (error) {
			logger.error('export-error', 'Failed to export GeoJSON', { error });
			this.showError('Failed to export GeoJSON');
		}
	}

	/**
	 * Export current view as SVG
	 */
	private async exportSVG(): Promise<void> {
		if (!this.mapController) return;

		try {
			const svg = this.mapController.exportSVG({
				includeLabels: true,
				includeLegend: true,
				includeCoordinates: true,
				width: 800,
				height: 600
			});
			const filename = `map-export-${new Date().toISOString().slice(0, 10)}.svg`;

			await this.plugin.app.vault.create(filename, svg);
			logger.info('export-svg', 'SVG exported', { filename });
		} catch (error) {
			logger.error('export-error', 'Failed to export SVG', { error });
			this.showError('Failed to export SVG');
		}
	}

	/**
	 * Register event handlers for file changes
	 */
	private registerEventHandlers(): void {
		// Refresh when files change
		this.registerEvent(
			this.plugin.app.vault.on('modify', (file) => {
				// Only refresh if a person or place note changed
				if (this.isRelevantFile(file.path)) {
					void this.refreshData();
				}
			})
		);
	}

	/**
	 * Check if a file path is relevant to the map (person or place note)
	 */
	private isRelevantFile(path: string): boolean {
		const peopleFolder = this.plugin.settings.peopleFolder;
		const placesFolder = this.plugin.settings.placesFolder;

		return Boolean(
			(peopleFolder && path.startsWith(peopleFolder)) ||
			(placesFolder && path.startsWith(placesFolder))
		);
	}

	/**
	 * Get map settings from plugin settings
	 */
	private getMapSettings(): MapSettings {
		// Use plugin settings for maps folder, defaults for other settings
		// TODO: Add full map settings to plugin settings when implementing map settings tab
		return {
			tileProvider: 'openstreetmap',
			defaultCenter: { lat: 40, lng: -40 },
			defaultZoom: 3,
			// Core life event colors
			birthMarkerColor: '#22c55e',      // green
			deathMarkerColor: '#ef4444',      // red
			marriageMarkerColor: '#a855f7',   // purple
			burialMarkerColor: '#6b7280',     // gray
			// Additional event colors
			residenceMarkerColor: '#3b82f6',  // blue
			occupationMarkerColor: '#f97316', // orange
			educationMarkerColor: '#14b8a6',  // teal
			militaryMarkerColor: '#78716c',   // brown/stone
			immigrationMarkerColor: '#06b6d4', // cyan
			religiousMarkerColor: '#c084fc',  // light purple
			customMarkerColor: '#ec4899',     // pink
			// Path settings
			showMigrationPaths: true,
			pathColor: '#6366f1',
			pathWeight: 2,
			showPathLabels: true,
			// Heat map settings
			heatMapBlur: 15,
			heatMapRadius: 25,
			// Custom maps folder
			customMapsFolder: this.plugin.settings.mapsFolder || 'Canvas Roots/Places/Maps'
		};
	}

	// ========================================================================
	// Edit Mode Methods
	// ========================================================================

	/**
	 * Toggle edit mode for image alignment
	 */
	private async toggleEditMode(): Promise<void> {
		if (!this.mapController) return;

		if (this.editModeEnabled) {
			await this.disableEditMode();
		} else {
			await this.enableEditMode();
		}
	}

	/**
	 * Enable edit mode
	 */
	private async enableEditMode(): Promise<void> {
		if (!this.mapController) return;

		const success = await this.mapController.enableEditMode();
		if (success) {
			this.editModeEnabled = true;
			this.updateEditUI();
			logger.info('edit-mode', 'Edit mode enabled');
		}
	}

	/**
	 * Disable edit mode
	 */
	private async disableEditMode(): Promise<void> {
		if (!this.mapController) return;

		await this.mapController.disableEditMode();
		this.editModeEnabled = false;
		this.updateEditUI();
		logger.info('edit-mode', 'Edit mode disabled');
	}

	/**
	 * Update the UI to reflect edit mode state
	 */
	private updateEditUI(): void {
		// Update edit button appearance
		if (this.editBtn) {
			if (this.editModeEnabled) {
				this.editBtn.addClass('active');
				const span = this.editBtn.querySelector('span');
				if (span) span.textContent = 'Exit edit';
			} else {
				this.editBtn.removeClass('active');
				const span = this.editBtn.querySelector('span');
				if (span) span.textContent = 'Edit';
			}
		}

		// Show/hide edit banner
		if (this.editModeEnabled) {
			this.showEditBanner();
		} else {
			this.hideEditBanner();
		}
	}

	/**
	 * Show the edit mode banner with Save/Restore/Cancel buttons
	 */
	private showEditBanner(): void {
		if (this.editBannerEl) {
			logger.debug('edit-banner', 'Banner already showing');
			return; // Already showing
		}

		// contentEl itself has the .cr-map-view class
		const container = this.contentEl;
		if (!container.hasClass('cr-map-view')) {
			logger.warn('edit-banner', 'Container missing .cr-map-view class');
			return;
		}
		logger.debug('edit-banner', 'Creating edit banner');

		this.editBannerEl = document.createElement('div');
		this.editBannerEl.className = 'cr-map-edit-banner';

		// Banner text
		const textEl = this.editBannerEl.createDiv({ cls: 'cr-map-edit-banner-text' });
		textEl.innerHTML = '<strong>Edit mode:</strong> Drag corners to align the map image.';

		// Button container
		const btnContainer = this.editBannerEl.createDiv({ cls: 'cr-map-edit-controls' });

		// Save button
		const saveBtn = btnContainer.createEl('button', {
			cls: 'cr-map-btn cr-map-btn-edit cr-map-btn-save',
			text: 'Save alignment'
		});
		saveBtn.addEventListener('click', () => this.saveEditedCorners());

		// Restore button (undo unsaved changes)
		const restoreBtn = btnContainer.createEl('button', {
			cls: 'cr-map-btn cr-map-btn-edit cr-map-btn-restore',
			text: 'Undo changes'
		});
		restoreBtn.addEventListener('click', () => this.mapController?.restoreOverlay());

		// Reset button (clear saved alignment)
		const resetBtn = btnContainer.createEl('button', {
			cls: 'cr-map-btn cr-map-btn-edit cr-map-btn-reset',
			text: 'Reset to default'
		});
		resetBtn.addEventListener('click', () => this.resetAlignment());

		// Cancel button
		const cancelBtn = btnContainer.createEl('button', {
			cls: 'cr-map-btn cr-map-btn-edit',
			text: 'Cancel'
		});
		cancelBtn.addEventListener('click', () => void this.disableEditMode());

		// Insert banner before the map container (after toolbar and time slider)
		if (this.mapContainerEl) {
			container.insertBefore(this.editBannerEl, this.mapContainerEl);
		} else {
			container.appendChild(this.editBannerEl);
		}
	}

	/**
	 * Hide the edit mode banner
	 */
	private hideEditBanner(): void {
		if (this.editBannerEl) {
			this.editBannerEl.remove();
			this.editBannerEl = null;
		}
	}

	/**
	 * Save the edited corners to frontmatter
	 */
	private async saveEditedCorners(): Promise<void> {
		if (!this.mapController) return;

		const success = await this.mapController.saveEditedCorners();
		if (success) {
			new Notice('Map alignment saved');
		} else {
			new Notice('Failed to save map alignment');
		}
	}

	/**
	 * Reset alignment to default (clear saved corners)
	 */
	private async resetAlignment(): Promise<void> {
		if (!this.mapController) return;

		const success = await this.mapController.resetAlignment();
		if (success) {
			new Notice('Map alignment reset to default');
			this.hideEditBanner();
		} else {
			new Notice('Failed to reset map alignment');
		}
	}

	/**
	 * Show an error message in the view
	 */
	private showError(message: string): void {
		if (this.mapContainerEl) {
			this.mapContainerEl.empty();
			this.mapContainerEl.createDiv({
				cls: 'cr-map-error',
				text: message
			});
		}
	}
}
