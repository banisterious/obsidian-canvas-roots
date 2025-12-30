/**
 * Map Controller - Leaflet map management
 *
 * Handles Leaflet map initialization, layer management, and user interactions.
 */

import * as L from 'leaflet';

// Fix Leaflet's default marker icon path issue when bundled
// The default icon tries to load from incorrect paths in bundled environments
// We set an empty URL to prevent 404 errors for markers we don't use
// Our markers use L.divIcon which doesn't require external images
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
	iconUrl: '',
	iconRetinaUrl: '',
	shadowUrl: ''
});

// Track if plugins have been initialized
let pluginsInitialized = false;

/**
 * Initialize Leaflet plugins
 * Must be called before using marker clusters or other plugin features
 */
async function initializeLeafletPlugins(): Promise<void> {
	if (pluginsInitialized) return;

	// IMPORTANT: Leaflet plugins expect L to be available globally
	// We need to assign it to window before importing the plugins
	(window as unknown as { L: typeof L }).L = L;

	// Import Leaflet plugins dynamically after L is on window
	// These plugins extend the L namespace via side effects
	await import('leaflet.markercluster');
	await import('leaflet-polylinedecorator');
	await import('leaflet.heat');
	await import('leaflet-fullscreen');
	await import('leaflet-minimap');
	await import('leaflet-search');
	await import('leaflet-textpath');

	pluginsInitialized = true;
}

/**
 * Create a marker cluster group, handling different import scenarios
 */
function createMarkerClusterGroup(options?: L.MarkerClusterGroupOptions): L.MarkerClusterGroup {
	const globalL = (window as unknown as { L: typeof L }).L;

	// Try the standard L.markerClusterGroup function first
	if (typeof globalL.markerClusterGroup === 'function') {
		return globalL.markerClusterGroup(options);
	}

	// Try accessing MarkerClusterGroup constructor directly
	if (typeof globalL.MarkerClusterGroup === 'function') {
		return new globalL.MarkerClusterGroup(options);
	}

	throw new Error('leaflet.markercluster is not properly loaded');
}

import type CanvasRootsPlugin from '../../main';
import { getLogger } from '../core/logging';
import type {
	MapData,
	MapMarker,
	PlaceMarker,
	MigrationPath,
	JourneyPath,
	MapSettings,
	MapState,
	LayerVisibility,
	GeoJSONFeatureCollection,
	SVGExportOptions,
	CRMarker,
	CRPolyline,
	CustomMapConfig
} from './types/map-types';
import { getMarkerColor, isMarkerTypeVisible } from './types/map-types';
import { ImageMapManager } from './image-map-manager';

const logger = getLogger('MapController');

// OpenStreetMap tile URL
const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Controller for Leaflet map functionality
 */
export class MapController {
	private container: HTMLElement;
	private settings: MapSettings;
	private plugin: CanvasRootsPlugin;

	// Leaflet instances
	private map: L.Map | null = null;
	private tileLayer: L.TileLayer | null = null;

	// Layer groups for different marker types
	private birthClusterGroup: L.MarkerClusterGroup | null = null;
	private deathClusterGroup: L.MarkerClusterGroup | null = null;
	private marriageClusterGroup: L.MarkerClusterGroup | null = null;
	private burialClusterGroup: L.MarkerClusterGroup | null = null;
	// Single cluster group for all additional event types (residence, occupation, etc.)
	private eventsClusterGroup: L.MarkerClusterGroup | null = null;
	// Cluster group for standalone place markers (not tied to person events)
	private placesClusterGroup: L.MarkerClusterGroup | null = null;
	private pathLayer: L.LayerGroup | null = null;
	private journeyLayer: L.LayerGroup | null = null;
	private heatLayer: L.Layer | null = null;

	// Controls
	private fullscreenControl: L.Control | null = null;
	private miniMap: L.Control | null = null;
	private searchControl: L.Control | null = null;

	// Custom image maps
	private imageMapManager: ImageMapManager;
	private currentImageOverlay: L.ImageOverlay | null = null;
	private currentDistortableOverlay: L.DistortableImageOverlay | null = null;
	private activeMapId: string = 'openstreetmap';
	private currentCRS: 'geographic' | 'pixel' = 'geographic';
	private editModeEnabled: boolean = false;

	// Current data
	private currentData: MapData | null = null;
	private currentLayers: LayerVisibility = {
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
		journeys: false,
		heatMap: false,
		places: false
	};

	// Callback for when active map changes
	private onMapChangeCallback: ((mapId: string, universe: string | null) => void) | null = null;
	// Callback for when edit mode changes
	private onEditModeChangeCallback: ((enabled: boolean) => void) | null = null;
	// Callback for when corners are saved
	private onCornersSavedCallback: (() => void) | null = null;

	constructor(container: HTMLElement, settings: MapSettings, plugin: CanvasRootsPlugin) {
		this.container = container;
		this.settings = settings;
		this.plugin = plugin;
		this.imageMapManager = new ImageMapManager(plugin.app, settings.customMapsFolder);
	}

	/**
	 * Initialize the Leaflet map
	 */
	async initialize(): Promise<void> {
		logger.debug('init', 'Initializing Leaflet map');

		// Initialize Leaflet plugins first (must be done before using them)
		await initializeLeafletPlugins();

		// Create map instance
		this.map = L.map(this.container, {
			center: [this.settings.defaultCenter.lat, this.settings.defaultCenter.lng],
			zoom: this.settings.defaultZoom,
			zoomControl: true
		});

		// Add tile layer
		this.tileLayer = L.tileLayer(OSM_TILE_URL, {
			attribution: OSM_ATTRIBUTION,
			maxZoom: 19
		}).addTo(this.map);

		// Initialize cluster groups
		this.initializeClusterGroups();

		// Initialize path layer (migration paths: birth → death)
		this.pathLayer = L.layerGroup().addTo(this.map);

		// Initialize journey layer (all life events connected chronologically)
		this.journeyLayer = L.layerGroup();  // Not added by default

		// Add fullscreen control
		this.initializeFullscreen();

		// Add mini-map
		this.initializeMiniMap();

		// Add search control
		this.initializeSearch();

		logger.debug('init-complete', 'Leaflet map initialized');
	}

	/**
	 * Initialize marker cluster groups
	 */
	private initializeClusterGroups(): void {
		if (!this.map) return;

		const clusterOptions: L.MarkerClusterGroupOptions = {
			showCoverageOnHover: false,
			maxClusterRadius: 50,
			spiderfyOnMaxZoom: true,
			disableClusteringAtZoom: 15
		};

		// Birth markers (green)
		this.birthClusterGroup = createMarkerClusterGroup({
			...clusterOptions,
			iconCreateFunction: (cluster) => this.createClusterIcon(cluster, this.settings.birthMarkerColor)
		});
		this.birthClusterGroup.addTo(this.map);

		// Death markers (red)
		this.deathClusterGroup = createMarkerClusterGroup({
			...clusterOptions,
			iconCreateFunction: (cluster) => this.createClusterIcon(cluster, this.settings.deathMarkerColor)
		});
		this.deathClusterGroup.addTo(this.map);

		// Marriage markers (purple)
		this.marriageClusterGroup = createMarkerClusterGroup({
			...clusterOptions,
			iconCreateFunction: (cluster) => this.createClusterIcon(cluster, this.settings.marriageMarkerColor)
		});
		this.marriageClusterGroup.addTo(this.map);

		// Burial markers (gray)
		this.burialClusterGroup = createMarkerClusterGroup({
			...clusterOptions,
			iconCreateFunction: (cluster) => this.createClusterIcon(cluster, this.settings.burialMarkerColor)
		});
		this.burialClusterGroup.addTo(this.map);

		// Events cluster group (for additional life events: residence, occupation, etc.)
		// Uses a neutral color for the cluster since individual markers have their own colors
		this.eventsClusterGroup = createMarkerClusterGroup({
			...clusterOptions,
			iconCreateFunction: (cluster) => this.createClusterIcon(cluster, this.settings.residenceMarkerColor)
		});
		this.eventsClusterGroup.addTo(this.map);

		// Places cluster group (for standalone places not tied to person events)
		// Uses a distinct color (teal) to differentiate from event markers
		this.placesClusterGroup = createMarkerClusterGroup({
			...clusterOptions,
			iconCreateFunction: (cluster) => this.createClusterIcon(cluster, '#0891b2')
		});
		// Don't add to map by default - controlled by layer visibility
	}

	/**
	 * Create a custom cluster icon
	 */
	private createClusterIcon(cluster: L.MarkerCluster, color: string): L.DivIcon {
		const count = cluster.getChildCount();
		const size = count < 10 ? 30 : count < 100 ? 40 : 50;

		return L.divIcon({
			html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: ${size / 3}px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${count}</div>`,
			className: 'cr-cluster-icon',
			iconSize: L.point(size, size)
		});
	}

	/**
	 * Initialize fullscreen control
	 */
	private initializeFullscreen(): void {
		if (!this.map) return;

		// @ts-expect-error - leaflet-fullscreen types not available
		this.fullscreenControl = L.control.fullscreen({
			position: 'topleft',
			title: 'Enter fullscreen',
			titleCancel: 'Exit fullscreen'
		}).addTo(this.map);
	}

	/**
	 * Initialize mini-map control
	 */
	private initializeMiniMap(): void {
		if (!this.map) return;

		const miniMapTiles = L.tileLayer(OSM_TILE_URL, {
			attribution: '',
			maxZoom: 13
		});

		// @ts-expect-error - leaflet-minimap types not available
		this.miniMap = new L.Control.MiniMap(miniMapTiles, {
			position: 'bottomright',
			width: 150,
			height: 150,
			zoomLevelOffset: -5,
			toggleDisplay: true
		}).addTo(this.map);
	}

	/**
	 * Initialize search control
	 * Allows searching for places by name and zooming to them
	 */
	private initializeSearch(): void {
		if (!this.map) return;

		// Create a layer group to hold searchable markers
		// The search layer will be populated when data is set
		const searchLayer = L.layerGroup().addTo(this.map);

		try {
			const globalL = (window as unknown as { L: typeof L }).L;

			// @ts-expect-error - leaflet-search types not available
			if (globalL.Control && globalL.Control.Search) {
				// @ts-expect-error - leaflet-search types not available
				this.searchControl = new globalL.Control.Search({
					layer: searchLayer,
					propertyName: 'placeName',
					position: 'topright',
					initial: false,
					zoom: 12,
					marker: false,
					textPlaceholder: 'Search places...',
					textErr: 'Place not found',
					collapsed: true,
					autoCollapse: true,
					minLength: 2,
					hideMarkerOnCollapse: true,
					buildTip: (text: string, val: { layer: L.Marker }) => {
						// Build custom tooltip for search suggestions
						const marker = val.layer as CRMarker;
						const data = marker.crData;
						if (data) {
							return `<a href="#"><b>${data.placeName}</b><br><small>${data.personName} (${data.type})</small></a>`;
						}
						return `<a href="#">${text}</a>`;
					}
				}).addTo(this.map);

				// Store reference to search layer for updates
				(this.searchControl as { _searchLayer?: L.LayerGroup })._searchLayer = searchLayer;

				logger.debug('search-init', 'Search control initialized');
			} else {
				logger.warn('search-init', 'leaflet-search not available');
			}
		} catch (e) {
			logger.warn('search-init', 'Could not initialize search control', { error: e });
		}
	}

	/**
	 * Update search layer with current markers
	 */
	private updateSearchLayer(): void {
		if (!this.searchControl) return;

		const searchLayer = (this.searchControl as { _searchLayer?: L.LayerGroup })._searchLayer;
		if (!searchLayer) return;

		// Clear existing search markers
		searchLayer.clearLayers();

		// Add all visible markers to search layer
		// We create invisible markers with the place name as a property
		if (this.birthClusterGroup) {
			this.birthClusterGroup.eachLayer((layer) => {
				const marker = layer as CRMarker;
				if (marker.crData) {
					const searchMarker = L.marker([marker.crData.lat, marker.crData.lng], {
						opacity: 0,
						icon: L.divIcon({ className: 'cr-search-marker', iconSize: [1, 1] }),
						// @ts-expect-error - custom property for search
						placeName: marker.crData.placeName
					}) as CRMarker;
					searchMarker.crData = marker.crData;
					searchLayer.addLayer(searchMarker);
				}
			});
		}

		if (this.deathClusterGroup) {
			this.deathClusterGroup.eachLayer((layer) => {
				const marker = layer as CRMarker;
				if (marker.crData) {
					const searchMarker = L.marker([marker.crData.lat, marker.crData.lng], {
						opacity: 0,
						icon: L.divIcon({ className: 'cr-search-marker', iconSize: [1, 1] }),
						// @ts-expect-error - custom property for search
						placeName: marker.crData.placeName
					}) as CRMarker;
					searchMarker.crData = marker.crData;
					searchLayer.addLayer(searchMarker);
				}
			});
		}

		logger.debug('search-update', `Updated search layer with markers`);
	}

	/**
	 * Set map data and render markers/paths
	 */
	setData(data: MapData): void {
		try {
			this.currentData = data;
			this.renderMarkers(data.markers);
			this.renderPlaceMarkers(data.placeMarkers);
			this.renderPaths(data.paths);
			this.renderJourneyPaths(data.journeyPaths);
			this.renderHeatMap(data.markers);

			// Update search layer with new markers
			this.updateSearchLayer();

			// Fit bounds to show all markers
			this.fitBounds();
		} catch (error) {
			logger.error('set-data-error', 'Error setting map data', { error });
			throw error;
		}
	}

	/**
	 * Set filtered data (for time slider) without changing current data reference
	 * This updates only the visible markers/paths without fitting bounds
	 */
	setFilteredData(markers: MapMarker[], paths: MigrationPath[], journeyPaths?: JourneyPath[]): void {
		try {
			this.renderMarkers(markers);
			this.renderPaths(paths);
			if (journeyPaths) {
				this.renderJourneyPaths(journeyPaths);
			}
			this.renderHeatMap(markers);
			// Don't fit bounds - keep current view during animation
		} catch (error) {
			logger.error('set-filtered-data-error', 'Error setting filtered data', { error });
			throw error;
		}
	}

	/**
	 * Render markers on the map
	 */
	private renderMarkers(markers: MapMarker[]): void {
		// Clear existing markers
		this.birthClusterGroup?.clearLayers();
		this.deathClusterGroup?.clearLayers();
		this.marriageClusterGroup?.clearLayers();
		this.burialClusterGroup?.clearLayers();
		this.eventsClusterGroup?.clearLayers();

		for (const marker of markers) {
			// Check if this marker type is visible before creating it
			if (!isMarkerTypeVisible(marker.type, this.currentLayers)) {
				continue;
			}

			const leafletMarker = this.createMarker(marker);

			switch (marker.type) {
				case 'birth':
					this.birthClusterGroup?.addLayer(leafletMarker);
					break;
				case 'death':
					this.deathClusterGroup?.addLayer(leafletMarker);
					break;
				case 'marriage':
					this.marriageClusterGroup?.addLayer(leafletMarker);
					break;
				case 'burial':
					this.burialClusterGroup?.addLayer(leafletMarker);
					break;
				// Additional life events go to eventsClusterGroup
				case 'residence':
				case 'occupation':
				case 'education':
				case 'military':
				case 'immigration':
				case 'baptism':
				case 'confirmation':
				case 'ordination':
				case 'custom':
					this.eventsClusterGroup?.addLayer(leafletMarker);
					break;
			}
		}

		logger.debug('render-markers', `Rendered ${markers.length} markers`);
	}

	/**
	 * Render standalone place markers on the map
	 */
	private renderPlaceMarkers(placeMarkers: PlaceMarker[]): void {
		// Clear existing place markers
		this.placesClusterGroup?.clearLayers();

		if (!placeMarkers || placeMarkers.length === 0) {
			return;
		}

		for (const place of placeMarkers) {
			const leafletMarker = this.createPlaceMarker(place);
			this.placesClusterGroup?.addLayer(leafletMarker);
		}

		logger.debug('render-place-markers', `Rendered ${placeMarkers.length} place markers`);
	}

	/**
	 * Create a Leaflet marker from place marker data
	 */
	private createPlaceMarker(data: PlaceMarker): L.Marker {
		// Teal color for place markers
		const color = '#0891b2';
		const icon = this.createMarkerIcon(color);

		// Use pixel coordinates for pixel CRS, otherwise use lat/lng
		let coords: L.LatLngExpression;
		if (this.currentCRS === 'pixel' && data.pixelX !== undefined && data.pixelY !== undefined) {
			coords = [data.pixelY, data.pixelX];
		} else if (data.lat !== undefined && data.lng !== undefined) {
			coords = [data.lat, data.lng];
		} else {
			// No valid coordinates - skip
			return L.marker([0, 0], { icon });
		}

		const marker = L.marker(coords, { icon });

		// Create popup content
		const popupContent = this.createPlacePopupContent(data);
		marker.bindPopup(popupContent);

		return marker;
	}

	/**
	 * Create popup content for a place marker
	 */
	private createPlacePopupContent(data: PlaceMarker): HTMLElement {
		const container = document.createElement('div');
		container.className = 'cr-map-popup';

		container.createEl('div', {
			cls: 'cr-map-popup-name',
			text: data.placeName
		});

		if (data.category) {
			container.createEl('div', {
				cls: 'cr-map-popup-type',
				text: data.category.charAt(0).toUpperCase() + data.category.slice(1)
			});
		}

		if (data.universe) {
			container.createEl('div', {
				cls: 'cr-map-popup-place',
				text: `Universe: ${data.universe}`
			});
		}

		// Open place note button
		const btnContainer = container.createEl('div', {
			cls: 'cr-map-popup-buttons'
		});

		const openPlaceBtn = btnContainer.createEl('button', {
			cls: 'cr-map-popup-btn',
			text: 'Open place'
		});
		openPlaceBtn.addEventListener('click', () => {
			this.openNoteById(data.placeId);
		});

		return container;
	}

	/**
	 * Create a Leaflet marker from map marker data
	 */
	private createMarker(data: MapMarker): CRMarker {
		const color = this.getMarkerColorForType(data.type);
		const icon = this.createMarkerIcon(color);

		// Use pixel coordinates for pixel CRS, otherwise use lat/lng
		let coords: L.LatLngExpression;
		if (this.currentCRS === 'pixel' && data.pixelX !== undefined && data.pixelY !== undefined) {
			// For L.CRS.Simple: [y, x] where y=0 is at bottom
			coords = [data.pixelY, data.pixelX];
		} else {
			coords = [data.lat, data.lng];
		}

		const marker = L.marker(coords, { icon }) as CRMarker;
		marker.crData = data;

		// Create popup content
		const popupContent = this.createPopupContent(data);
		marker.bindPopup(popupContent);

		return marker;
	}

	/**
	 * Create a marker icon with the specified color
	 */
	private createMarkerIcon(color: string): L.DivIcon {
		return L.divIcon({
			html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
			className: 'cr-marker-icon',
			iconSize: L.point(16, 16),
			iconAnchor: L.point(8, 8)
		});
	}

	/**
	 * Get marker color based on type
	 */
	private getMarkerColorForType(type: MapMarker['type']): string {
		return getMarkerColor(type, this.settings);
	}

	/**
	 * Create popup content for a marker
	 */
	private createPopupContent(data: MapMarker): HTMLElement {
		const container = document.createElement('div');
		container.className = 'cr-map-popup';

		container.createEl('div', {
			cls: 'cr-map-popup-name',
			text: data.personName
		});

		const typeLabel = data.type.charAt(0).toUpperCase() + data.type.slice(1);
		const dateText = data.date ? `: ${data.date}` : '';
		container.createEl('div', {
			cls: 'cr-map-popup-type',
			text: `${typeLabel}${dateText}`
		});

		container.createEl('div', {
			cls: 'cr-map-popup-place',
			text: data.placeName
		});

		// Button container for multiple buttons
		const btnContainer = container.createEl('div', {
			cls: 'cr-map-popup-buttons'
		});

		// Open person note button
		const openPersonBtn = btnContainer.createEl('button', {
			cls: 'cr-map-popup-btn',
			text: 'Open person'
		});
		openPersonBtn.addEventListener('click', () => {
			this.openNoteById(data.personId);
		});

		// Open place note button (if place has an ID)
		if (data.placeId) {
			const openPlaceBtn = btnContainer.createEl('button', {
				cls: 'cr-map-popup-btn cr-map-popup-btn--secondary',
				text: 'Open place'
			});
			openPlaceBtn.addEventListener('click', () => {
				this.openNoteById(data.placeId!);
			});
		}

		return container;
	}

	/**
	 * Open a note by cr_id in Obsidian
	 */
	private openNoteById(crId: string): void {
		// Find the file by cr_id
		const files = this.plugin.app.vault.getMarkdownFiles();
		for (const file of files) {
			const cache = this.plugin.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter?.cr_id === crId) {
				void this.plugin.app.workspace.openLinkText(file.path, '');
				return;
			}
		}
		logger.warn('open-note', `Could not find note with cr_id: ${crId}`);
	}

	/**
	 * Render migration paths on the map
	 */
	private renderPaths(paths: MigrationPath[]): void {
		if (!this.pathLayer) return;

		this.pathLayer.clearLayers();

		for (const path of paths) {
			const polyline = this.createPath(path);
			this.pathLayer.addLayer(polyline);
		}

		logger.debug('render-paths', `Rendered ${paths.length} paths`);
	}

	/**
	 * Create a polyline with arrow decoration for a migration path
	 */
	private createPath(data: MigrationPath): L.Polyline {
		let latlngs: L.LatLngExpression[];

		// Use pixel coordinates for pixel CRS, otherwise use lat/lng
		if (this.currentCRS === 'pixel' &&
			data.origin.pixelX !== undefined && data.origin.pixelY !== undefined &&
			data.destination.pixelX !== undefined && data.destination.pixelY !== undefined) {
			// For L.CRS.Simple: [y, x] where y=0 is at bottom
			latlngs = [
				[data.origin.pixelY, data.origin.pixelX],
				[data.destination.pixelY, data.destination.pixelX]
			];
		} else {
			latlngs = [
				[data.origin.lat, data.origin.lng],
				[data.destination.lat, data.destination.lng]
			];
		}

		const polyline = L.polyline(latlngs, {
			color: this.settings.pathColor,
			weight: this.settings.pathWeight,
			opacity: 0.7
		}) as CRPolyline;

		polyline.crData = data;

		// Try to add arrow decoration (may fail if library not loaded properly)
		try {
			// @ts-expect-error - leaflet-polylinedecorator types not fully available
			const LPolylineDecorator = L.polylineDecorator;
			// @ts-expect-error - leaflet-polylinedecorator Symbol types not available
			const LSymbol = L.Symbol;

			if (LPolylineDecorator && LSymbol) {
				LPolylineDecorator(polyline, {
					patterns: [
						{
							offset: '50%',
							repeat: 0,
							symbol: LSymbol.arrowHead({
								pixelSize: 10,
								polygon: false,
								pathOptions: {
									color: this.settings.pathColor,
									weight: this.settings.pathWeight
								}
							})
						}
					]
				});
				// Note: decorator is created but we only add the polyline to the layer
				// The decorator would need to be added separately if we want arrows
			}
		} catch (e) {
			logger.warn('polyline-decorator', 'Could not add arrow decoration to path', { error: e });
		}

		// Add text label along the path (person name)
		if (this.settings.showPathLabels) {
			try {
				polyline.setText(data.personName, {
					center: true,
					offset: -5, // Position above the line
					orientation: 'flip', // Ensure text reads left-to-right
					attributes: {
						fill: this.settings.pathColor,
						'font-size': '11px',
						'font-weight': '500'
					}
				});
			} catch (e) {
				logger.warn('textpath', 'Could not add text label to path', { error: e });
			}
		}

		// Bind popup to the polyline
		polyline.bindPopup(this.createPathPopup(data));

		return polyline;
	}

	/**
	 * Create popup content for a migration path
	 */
	private createPathPopup(data: MigrationPath): HTMLElement {
		const container = document.createElement('div');
		container.className = 'cr-map-popup';

		container.createEl('div', {
			cls: 'cr-map-popup-name',
			text: data.personName
		});

		container.createEl('div', {
			cls: 'cr-map-popup-migration',
			text: `${data.origin.name} → ${data.destination.name}`
		});

		if (data.birthYear && data.deathYear) {
			container.createEl('div', {
				cls: 'cr-map-popup-years',
				text: `${data.birthYear} – ${data.deathYear}`
			});
		}

		return container;
	}

	/**
	 * Render journey paths on the map (all life events connected chronologically)
	 */
	private renderJourneyPaths(journeyPaths: JourneyPath[]): void {
		if (!this.journeyLayer) return;

		this.journeyLayer.clearLayers();

		for (const journey of journeyPaths) {
			// Need at least 2 waypoints to draw a path
			if (journey.waypoints.length < 2) continue;

			const polyline = this.createJourneyPath(journey);
			this.journeyLayer.addLayer(polyline);

			// Add arrow decorations between waypoints
			this.addJourneyArrows(journey, this.journeyLayer);
		}

		logger.debug('render-journeys', `Rendered ${journeyPaths.length} journey paths`);
	}

	/**
	 * Create a polyline for a journey path
	 */
	private createJourneyPath(journey: JourneyPath): L.Polyline {
		// Build array of coordinates from waypoints
		const latlngs: L.LatLngExpression[] = journey.waypoints.map(wp => {
			if (this.currentCRS === 'pixel' && wp.pixelX !== undefined && wp.pixelY !== undefined) {
				return [wp.pixelY, wp.pixelX] as L.LatLngTuple;
			}
			return [wp.lat, wp.lng] as L.LatLngTuple;
		});

		const polyline = L.polyline(latlngs, {
			color: this.settings.journeyPathColor,
			weight: this.settings.journeyPathWeight,
			opacity: 0.7,
			dashArray: '5, 5'  // Dashed line to distinguish from migration paths
		});

		// Add text label along the path (person name)
		if (this.settings.showJourneyLabels) {
			try {
				polyline.setText(journey.personName, {
					center: true,
					offset: -5,
					orientation: 'flip',
					attributes: {
						fill: this.settings.journeyPathColor,
						'font-size': '11px',
						'font-weight': '500'
					}
				});
			} catch (e) {
				logger.warn('textpath-journey', 'Could not add text label to journey path', { error: e });
			}
		}

		// Bind popup to the polyline
		polyline.bindPopup(this.createJourneyPopup(journey));

		return polyline;
	}

	/**
	 * Add arrow decorations between journey waypoints
	 */
	private addJourneyArrows(journey: JourneyPath, layer: L.LayerGroup): void {
		try {
			// @ts-expect-error - leaflet-polylinedecorator types not fully available
			const LPolylineDecorator = L.polylineDecorator;
			// @ts-expect-error - leaflet-polylinedecorator Symbol types not available
			const LSymbol = L.Symbol;

			if (!LPolylineDecorator || !LSymbol) return;

			// Build coordinates from waypoints
			const latlngs = journey.waypoints.map(wp => {
				if (this.currentCRS === 'pixel' && wp.pixelX !== undefined && wp.pixelY !== undefined) {
					return L.latLng(wp.pixelY, wp.pixelX);
				}
				return L.latLng(wp.lat, wp.lng);
			});

			// Create decorator for arrows at each segment midpoint
			const decorator = LPolylineDecorator(latlngs, {
				patterns: [
					{
						offset: '50%',
						repeat: 0,
						symbol: LSymbol.arrowHead({
							pixelSize: 8,
							polygon: false,
							pathOptions: {
								color: this.settings.journeyPathColor,
								weight: this.settings.journeyPathWeight
							}
						})
					}
				]
			});

			layer.addLayer(decorator);
		} catch (e) {
			logger.warn('journey-arrows', 'Could not add arrow decorations to journey path', { error: e });
		}
	}

	/**
	 * Create popup content for a journey path
	 */
	private createJourneyPopup(journey: JourneyPath): HTMLElement {
		const container = document.createElement('div');
		container.className = 'cr-map-popup cr-journey-popup';

		container.createEl('div', {
			cls: 'cr-map-popup-name',
			text: journey.personName
		});

		// Show journey summary
		const firstWp = journey.waypoints[0];
		const lastWp = journey.waypoints[journey.waypoints.length - 1];
		container.createEl('div', {
			cls: 'cr-map-popup-migration',
			text: `${journey.waypoints.length} locations: ${firstWp.name} → ... → ${lastWp.name}`
		});

		// Show years if available
		if (journey.birthYear || journey.deathYear) {
			const yearText = journey.birthYear && journey.deathYear
				? `${journey.birthYear} – ${journey.deathYear}`
				: journey.birthYear
					? `Born ${journey.birthYear}`
					: `Died ${journey.deathYear}`;
			container.createEl('div', {
				cls: 'cr-map-popup-years',
				text: yearText
			});
		}

		// List waypoints
		const waypointList = container.createEl('div', {
			cls: 'cr-journey-waypoints'
		});

		for (const wp of journey.waypoints) {
			const wpEl = waypointList.createEl('div', {
				cls: 'cr-journey-waypoint'
			});

			const eventLabel = wp.eventType.charAt(0).toUpperCase() + wp.eventType.slice(1);
			const dateText = wp.year ? ` (${wp.year})` : '';
			wpEl.createEl('span', {
				cls: 'cr-journey-waypoint-event',
				text: `${eventLabel}${dateText}: `
			});
			wpEl.createEl('span', {
				cls: 'cr-journey-waypoint-place',
				text: wp.name
			});
		}

		// Button to open person note
		const openBtn = container.createEl('button', {
			cls: 'cr-map-popup-btn',
			text: 'Open person'
		});
		openBtn.addEventListener('click', () => {
			this.openNoteById(journey.personId);
		});

		return container;
	}

	/**
	 * Render heat map layer
	 */
	private renderHeatMap(markers: MapMarker[]): void {
		if (!this.map) return;

		// Remove existing heat layer
		if (this.heatLayer) {
			this.map.removeLayer(this.heatLayer);
			this.heatLayer = null;
		}

		// Create heat data points using appropriate coordinates
		const heatData: [number, number, number][] = markers
			.filter(m => m.type === 'birth' || m.type === 'death')
			.map(m => {
				if (this.currentCRS === 'pixel' && m.pixelX !== undefined && m.pixelY !== undefined) {
					return [m.pixelY, m.pixelX, 1] as [number, number, number];
				}
				return [m.lat, m.lng, 1] as [number, number, number];
			});

		if (heatData.length === 0) return;

		// Try to create heat layer (may fail if library not loaded properly)
		try {
			// @ts-expect-error - leaflet.heat types not available
			const LHeatLayer = L.heatLayer;
			if (LHeatLayer) {
				this.heatLayer = LHeatLayer(heatData, {
					radius: this.settings.heatMapRadius,
					blur: this.settings.heatMapBlur,
					maxZoom: 10
				});

				// Only add if heat map layer is enabled
				if (this.currentLayers.heatMap && this.heatLayer) {
					this.heatLayer.addTo(this.map);
				}
			}
		} catch (e) {
			logger.warn('heat-layer', 'Could not create heat layer', { error: e });
		}
	}

	/**
	 * Set layer visibility
	 */
	setLayerVisibility(layers: LayerVisibility): void {
		if (!this.map) return;

		this.currentLayers = layers;

		// Birth markers
		if (this.birthClusterGroup) {
			if (layers.births && !this.map.hasLayer(this.birthClusterGroup)) {
				this.map.addLayer(this.birthClusterGroup);
			} else if (!layers.births && this.map.hasLayer(this.birthClusterGroup)) {
				this.map.removeLayer(this.birthClusterGroup);
			}
		}

		// Death markers
		if (this.deathClusterGroup) {
			if (layers.deaths && !this.map.hasLayer(this.deathClusterGroup)) {
				this.map.addLayer(this.deathClusterGroup);
			} else if (!layers.deaths && this.map.hasLayer(this.deathClusterGroup)) {
				this.map.removeLayer(this.deathClusterGroup);
			}
		}

		// Marriage markers
		if (this.marriageClusterGroup) {
			if (layers.marriages && !this.map.hasLayer(this.marriageClusterGroup)) {
				this.map.addLayer(this.marriageClusterGroup);
			} else if (!layers.marriages && this.map.hasLayer(this.marriageClusterGroup)) {
				this.map.removeLayer(this.marriageClusterGroup);
			}
		}

		// Burial markers
		if (this.burialClusterGroup) {
			if (layers.burials && !this.map.hasLayer(this.burialClusterGroup)) {
				this.map.addLayer(this.burialClusterGroup);
			} else if (!layers.burials && this.map.hasLayer(this.burialClusterGroup)) {
				this.map.removeLayer(this.burialClusterGroup);
			}
		}

		// Events cluster group (residence, occupation, etc.)
		// Show if any event type is enabled
		const anyEventsEnabled = layers.residences || layers.occupations ||
			layers.educations || layers.military || layers.immigrations ||
			layers.religious || layers.custom;
		if (this.eventsClusterGroup) {
			if (anyEventsEnabled && !this.map.hasLayer(this.eventsClusterGroup)) {
				this.map.addLayer(this.eventsClusterGroup);
			} else if (!anyEventsEnabled && this.map.hasLayer(this.eventsClusterGroup)) {
				this.map.removeLayer(this.eventsClusterGroup);
			}
		}

		// Re-render markers to filter by visibility settings
		// This ensures individual event types are correctly filtered
		if (this.currentData) {
			this.renderMarkers(this.currentData.markers);
		}

		// Migration paths (birth → death)
		if (this.pathLayer) {
			if (layers.paths && !this.map.hasLayer(this.pathLayer)) {
				this.map.addLayer(this.pathLayer);
			} else if (!layers.paths && this.map.hasLayer(this.pathLayer)) {
				this.map.removeLayer(this.pathLayer);
			}
		}

		// Journey paths (all life events connected chronologically)
		if (this.journeyLayer) {
			if (layers.journeys && !this.map.hasLayer(this.journeyLayer)) {
				this.map.addLayer(this.journeyLayer);
			} else if (!layers.journeys && this.map.hasLayer(this.journeyLayer)) {
				this.map.removeLayer(this.journeyLayer);
			}
		}

		// Heat map
		if (this.heatLayer) {
			if (layers.heatMap && !this.map.hasLayer(this.heatLayer)) {
				this.map.addLayer(this.heatLayer);
			} else if (!layers.heatMap && this.map.hasLayer(this.heatLayer)) {
				this.map.removeLayer(this.heatLayer);
			}
		}

		// Standalone places
		if (this.placesClusterGroup) {
			if (layers.places && !this.map.hasLayer(this.placesClusterGroup)) {
				this.map.addLayer(this.placesClusterGroup);
			} else if (!layers.places && this.map.hasLayer(this.placesClusterGroup)) {
				this.map.removeLayer(this.placesClusterGroup);
			}
		}
	}

	/**
	 * Set the map view center and zoom
	 */
	setView(center: { lat: number; lng: number }, zoom: number): void {
		this.map?.setView([center.lat, center.lng], zoom);
	}

	/**
	 * Set the active map (OpenStreetMap or custom image map)
	 */
	async setActiveMap(mapId: string): Promise<void> {
		if (!this.map) return;
		if (mapId === this.activeMapId) return;

		logger.debug('set-active-map', `Switching to map: ${mapId}`);

		// Determine if we need to switch CRS
		const targetCRS = mapId === 'openstreetmap'
			? 'geographic'
			: this.imageMapManager.getCoordinateSystem(mapId);

		// If CRS is changing, we need to recreate the map
		if (targetCRS !== this.currentCRS) {
			await this.switchCRS(mapId, targetCRS);
			return;
		}

		// Same CRS - just switch layers
		if (mapId === 'openstreetmap') {
			// Switch to OpenStreetMap tiles
			if (this.currentImageOverlay) {
				this.map.removeLayer(this.currentImageOverlay);
				this.currentImageOverlay = null;
			}

			if (!this.tileLayer) {
				this.tileLayer = L.tileLayer(OSM_TILE_URL, {
					attribution: OSM_ATTRIBUTION,
					maxZoom: 19
				});
			}

			if (!this.map.hasLayer(this.tileLayer)) {
				this.tileLayer.addTo(this.map);
			}

			// Reset to default view
			this.map.setView(
				[this.settings.defaultCenter.lat, this.settings.defaultCenter.lng],
				this.settings.defaultZoom
			);
		} else {
			// Switch to custom image map (same CRS)
			if (this.tileLayer && this.map.hasLayer(this.tileLayer)) {
				this.map.removeLayer(this.tileLayer);
			}

			if (this.currentImageOverlay) {
				this.map.removeLayer(this.currentImageOverlay);
			}

			const overlay = await this.imageMapManager.createImageOverlay(mapId);
			if (overlay) {
				this.currentImageOverlay = overlay;
				overlay.addTo(this.map);

				// Set view to custom map bounds
				const bounds = this.imageMapManager.getMapBounds(mapId);
				if (bounds) {
					this.map.fitBounds(bounds);
				}

				// Optionally set to configured center/zoom
				const center = this.imageMapManager.getMapCenter(mapId);
				const zoom = this.imageMapManager.getDefaultZoom(mapId);
				if (center) {
					this.map.setView(center, zoom);
				}

				logger.info('set-active-map', `Switched to custom map: ${mapId}`);
			} else {
				logger.error('set-active-map', `Failed to load custom map: ${mapId}`);
				// Fall back to OSM
				await this.setActiveMap('openstreetmap');
				return;
			}
		}

		this.activeMapId = mapId;

		// Notify listeners of the map change
		if (this.onMapChangeCallback) {
			const universe = mapId === 'openstreetmap' ? null : this.imageMapManager.getMapUniverse(mapId);
			this.onMapChangeCallback(mapId, universe);
		}
	}

	/**
	 * Switch the map's coordinate reference system
	 * This requires destroying and recreating the map since Leaflet doesn't allow CRS changes
	 */
	private async switchCRS(mapId: string, targetCRS: 'geographic' | 'pixel'): Promise<void> {
		logger.debug('switch-crs', `Switching CRS from ${this.currentCRS} to ${targetCRS}`);

		// Save current data to restore after map recreation
		const savedData = this.currentData;
		const savedLayers = { ...this.currentLayers };

		// Clean up existing map layers
		this.birthClusterGroup?.clearLayers();
		this.deathClusterGroup?.clearLayers();
		this.marriageClusterGroup?.clearLayers();
		this.burialClusterGroup?.clearLayers();
		this.eventsClusterGroup?.clearLayers();
		this.pathLayer?.clearLayers();
		this.journeyLayer?.clearLayers();

		if (this.heatLayer && this.map) {
			this.map.removeLayer(this.heatLayer);
			this.heatLayer = null;
		}

		if (this.currentImageOverlay && this.map) {
			this.map.removeLayer(this.currentImageOverlay);
			this.currentImageOverlay = null;
		}

		if (this.tileLayer && this.map) {
			this.map.removeLayer(this.tileLayer);
		}

		// Clean up controls before destroying the map to avoid stale references
		if (this.miniMap && this.map) {
			this.map.removeControl(this.miniMap);
		}
		if (this.fullscreenControl && this.map) {
			this.map.removeControl(this.fullscreenControl);
		}
		if (this.searchControl && this.map) {
			this.map.removeControl(this.searchControl);
		}

		// Destroy the old map
		this.map?.remove();
		this.map = null;
		this.birthClusterGroup = null;
		this.deathClusterGroup = null;
		this.marriageClusterGroup = null;
		this.burialClusterGroup = null;
		this.eventsClusterGroup = null;
		this.pathLayer = null;
		this.journeyLayer = null;
		this.fullscreenControl = null;
		this.miniMap = null;
		this.searchControl = null;

		// Create new map with appropriate CRS
		const mapConfig = mapId === 'openstreetmap' ? null : this.imageMapManager.getMapConfig(mapId);

		const mapOptions: L.MapOptions = {
			zoomControl: true
		};

		if (targetCRS === 'pixel') {
			// Use Simple CRS for pixel coordinates
			mapOptions.crs = L.CRS.Simple;
			mapOptions.minZoom = mapConfig?.minZoom ?? -2;
			mapOptions.maxZoom = mapConfig?.maxZoom ?? 4;
		}

		this.map = L.map(this.container, mapOptions);
		this.currentCRS = targetCRS;

		// Set up layers based on new CRS
		if (targetCRS === 'geographic') {
			// Geographic mode - add OSM tiles or custom image overlay
			if (mapId === 'openstreetmap') {
				this.tileLayer = L.tileLayer(OSM_TILE_URL, {
					attribution: OSM_ATTRIBUTION,
					maxZoom: 19
				}).addTo(this.map);

				this.map.setView(
					[this.settings.defaultCenter.lat, this.settings.defaultCenter.lng],
					this.settings.defaultZoom
				);
			} else {
				// Geographic mode custom map
				const overlay = await this.imageMapManager.createImageOverlay(mapId);
				if (overlay) {
					this.currentImageOverlay = overlay;
					overlay.addTo(this.map);

					const bounds = this.imageMapManager.getMapBounds(mapId);
					if (bounds) {
						this.map.fitBounds(bounds);
					}
				}
			}
		} else {
			// Pixel mode - add custom image overlay
			const overlay = await this.imageMapManager.createImageOverlay(mapId);
			if (overlay) {
				this.currentImageOverlay = overlay;
				overlay.addTo(this.map);

				const bounds = this.imageMapManager.getMapBounds(mapId);
				if (bounds) {
					this.map.fitBounds(bounds);
				}

				// Set to configured center/zoom
				const center = this.imageMapManager.getMapCenter(mapId);
				const zoom = this.imageMapManager.getDefaultZoom(mapId);
				if (center) {
					this.map.setView(center, zoom);
				}
			}
		}

		// Reinitialize cluster groups and layers
		this.initializeClusterGroups();
		this.pathLayer = L.layerGroup().addTo(this.map);
		this.journeyLayer = L.layerGroup();  // Not added by default

		// Reinitialize controls
		this.initializeFullscreen();
		// Only add mini-map for geographic CRS (doesn't make sense for pixel maps)
		if (targetCRS === 'geographic') {
			this.initializeMiniMap();
		}
		this.initializeSearch();

		this.activeMapId = mapId;

		// Restore data and layer visibility
		if (savedData) {
			this.setData(savedData);
		}
		this.setLayerVisibility(savedLayers);

		// Notify listeners
		if (this.onMapChangeCallback) {
			const universe = mapId === 'openstreetmap' ? null : this.imageMapManager.getMapUniverse(mapId);
			this.onMapChangeCallback(mapId, universe);
		}

		logger.info('switch-crs', `CRS switched to ${targetCRS} for map: ${mapId}`);
	}

	/**
	 * Get the current coordinate reference system
	 */
	getCurrentCRS(): 'geographic' | 'pixel' {
		return this.currentCRS;
	}

	/**
	 * Register a callback for when the active map changes
	 * The callback receives the new mapId and the universe (null for OpenStreetMap)
	 */
	onMapChange(callback: (mapId: string, universe: string | null) => void): void {
		this.onMapChangeCallback = callback;
	}

	/**
	 * Get available custom maps
	 */
	getCustomMaps(): CustomMapConfig[] {
		return this.imageMapManager.loadMapConfigs();
	}

	/**
	 * Get custom maps for a specific universe
	 */
	getCustomMapsForUniverse(universe: string): CustomMapConfig[] {
		return this.imageMapManager.getConfigsForUniverse(universe);
	}

	/**
	 * Get the currently active map ID
	 */
	getActiveMapId(): string {
		return this.activeMapId;
	}

	/**
	 * Get the universe associated with the current active map
	 * Returns null for OpenStreetMap (real world)
	 */
	getActiveMapUniverse(): string | null {
		if (this.activeMapId === 'openstreetmap') {
			return null;
		}
		return this.imageMapManager.getMapUniverse(this.activeMapId);
	}

	/**
	 * Get the underlying Leaflet map instance
	 * Useful for attaching event handlers or coordinate transformations
	 */
	getLeafletMap(): L.Map | null {
		return this.map;
	}

	/**
	 * Convert a mouse event to map coordinates
	 * For geographic maps, returns lat/lng
	 * For pixel maps, returns pixel x/y coordinates
	 */
	mouseEventToCoordinates(event: MouseEvent): { lat: number; lng: number; pixelX?: number; pixelY?: number } | null {
		if (!this.map) return null;

		const latlng = this.map.mouseEventToLatLng(event);

		if (this.currentCRS === 'pixel') {
			// For pixel maps, latlng values represent pixel coordinates
			// In L.CRS.Simple: lat = Y, lng = X (Y=0 at bottom, increases upward)
			// We store Y directly since markers use [pixelY, pixelX] format
			return {
				lat: latlng.lat,
				lng: latlng.lng,
				pixelX: Math.round(latlng.lng),  // X is longitude
				pixelY: Math.round(latlng.lat)   // Y is latitude (no negation needed)
			};
		}

		// Geographic map - return lat/lng
		return {
			lat: latlng.lat,
			lng: latlng.lng
		};
	}

	// ========================================================================
	// Edit Mode (Distortable Image) Methods
	// ========================================================================

	/**
	 * Check if the current map supports edit mode (distortable images)
	 * Only custom image maps can be edited, not OpenStreetMap
	 */
	canEnableEditMode(): boolean {
		return this.activeMapId !== 'openstreetmap';
	}

	/**
	 * Check if edit mode is currently enabled
	 */
	isEditModeEnabled(): boolean {
		return this.editModeEnabled;
	}

	/**
	 * Toggle edit mode for the current custom map
	 * In edit mode, the map image becomes distortable (can be dragged, rotated, scaled)
	 */
	async toggleEditMode(): Promise<boolean> {
		if (!this.map) return false;

		if (this.editModeEnabled) {
			await this.disableEditMode();
			return false;
		} else {
			return this.enableEditMode();
		}
	}

	/**
	 * Enable edit mode - replace image overlay with distortable overlay
	 */
	async enableEditMode(): Promise<boolean> {
		if (!this.map || this.activeMapId === 'openstreetmap') {
			logger.warn('edit-mode', 'Cannot enable edit mode: no custom map active');
			return false;
		}

		if (this.editModeEnabled) {
			logger.debug('edit-mode', 'Edit mode already enabled');
			return true;
		}

		try {
			// Remove current regular image overlay
			if (this.currentImageOverlay) {
				this.map.removeLayer(this.currentImageOverlay);
				this.currentImageOverlay = null;
			}

			// Create distortable overlay
			const distortableOverlay = await this.imageMapManager.createDistortableOverlay(this.activeMapId);
			if (!distortableOverlay) {
				logger.error('edit-mode', 'Failed to create distortable overlay');
				// Restore regular overlay
				await this.restoreRegularOverlay();
				return false;
			}

			// Add the 'ldi' class to the map container for distortable CSS to work
			this.container.classList.add('ldi');

			this.currentDistortableOverlay = distortableOverlay;

			// Check if corners are already pre-set (for maps with saved corners)
			const corners = distortableOverlay.getCorners?.();
			const hasPrestClearedCorners = corners && corners.length === 4;

			logger.debug('edit-mode', `Corners check: hasCorners=${!!corners}, length=${corners?.length}, valid=${hasPrestClearedCorners}`);
			if (corners) {
				logger.debug('edit-mode', `Corner 0: lat=${corners[0]?.lat}, lng=${corners[0]?.lng}`);
			}

			if (hasPrestClearedCorners) {
				// Corners are pre-set, we can add to map and then manually enable editing
				logger.debug('edit-mode', 'Taking happy path with pre-set corners');
				distortableOverlay.addTo(this.map);

				// After adding to map, verify corners are still set
				const cornersAfterAdd = distortableOverlay.getCorners?.();
				logger.debug('edit-mode', `Corners after addTo: hasCorners=${!!cornersAfterAdd}, length=${cornersAfterAdd?.length}`);

				// Overlay was created with editable:false, so we need to manually enable
				// Use a delay to ensure the image has loaded and library is fully initialized
				setTimeout(() => {
					// Check corners again before enabling
					const cornersBeforeEnable = distortableOverlay.getCorners?.();
					logger.debug('edit-mode', `Corners before enable: hasCorners=${!!cornersBeforeEnable}, length=${cornersBeforeEnable?.length}`);

					// Enable editing - set the flag and call enable()
					distortableOverlay.editable = true;
					if (distortableOverlay.editing) {
						distortableOverlay.editing.enable();
						logger.debug('edit-mode', 'Called editing.enable()');
					}

					// Verify corners still valid before select
					const cornersBeforeSelect = distortableOverlay.getCorners?.();
					logger.debug('edit-mode', `Corners right before select: length=${cornersBeforeSelect?.length}`);
					if (cornersBeforeSelect && cornersBeforeSelect.length >= 3) {
						logger.debug('edit-mode', `Corner[2] lat=${cornersBeforeSelect[2]?.lat}, lng=${cornersBeforeSelect[2]?.lng}`);
					}

					// Toolbar is suppressed, so just show the handles for corner manipulation
					// The select() call is what triggers _addToolbar() which causes the error
					// With suppressToolbar: true, we just need the handles visible
					logger.debug('edit-mode', 'Editing enabled - handles should be visible (toolbar suppressed)');
				}, 200);  // Longer delay to ensure image loads
			} else {
				// No pre-set corners - need to wait for image load and _initImageDimensions
				// Wrap select to prevent errors during initialization
				const originalSelect = distortableOverlay.select.bind(distortableOverlay);
				let cornersReady = false;

				// Override select method to prevent errors during initialization
				// The library type allows this reassignment through the interface
				distortableOverlay.select = function(this: L.DistortableImageOverlay, e?: Event) {
					if (!cornersReady) {
						logger.debug('edit-mode', 'Ignoring select() call - corners not ready yet');
						if (e) {
							L.DomEvent.stopPropagation(e);
						}
						return this;
					}
					return originalSelect(e);
				};

				distortableOverlay.addTo(this.map);

				// Poll for corners to be ready
				const waitForCorners = () => {
					let attempts = 0;
					const maxAttempts = 50;

					const checkCorners = () => {
						attempts++;
						const currentCorners = distortableOverlay.getCorners?.();
						const cornersValid = currentCorners &&
							currentCorners.length === 4 &&
							currentCorners.every((c: L.LatLng | null | undefined) =>
								c && typeof c.lat === 'number' && !isNaN(c.lat)
							);

						if (cornersValid) {
							cornersReady = true;
							distortableOverlay.editable = true;
							if (distortableOverlay.editing) {
								distortableOverlay.editing.enable();
							}
							distortableOverlay.select();
							logger.debug('edit-mode', 'Distortable overlay corners ready, editing enabled');
						} else if (attempts < maxAttempts) {
							setTimeout(checkCorners, 100);
						} else {
							logger.warn('edit-mode', 'Timed out waiting for corners to initialize');
						}
					};

					setTimeout(checkCorners, 50);
				};

				waitForCorners();
			}

			this.editModeEnabled = true;

			// Notify listeners
			if (this.onEditModeChangeCallback) {
				this.onEditModeChangeCallback(true);
			}

			logger.info('edit-mode', `Edit mode enabled for ${this.activeMapId}`);
			return true;
		} catch (error) {
			logger.error('edit-mode-error', 'Failed to enable edit mode', { error });
			// Try to restore regular overlay
			await this.restoreRegularOverlay();
			return false;
		}
	}

	/**
	 * Disable edit mode - replace distortable overlay with regular image overlay
	 */
	async disableEditMode(): Promise<void> {
		if (!this.map || !this.editModeEnabled) return;

		try {
			// Remove distortable overlay
			if (this.currentDistortableOverlay) {
				// Safely deselect and disable editing
				if (typeof this.currentDistortableOverlay.deselect === 'function') {
					try {
						this.currentDistortableOverlay.deselect();
					} catch {
						// Ignore deselect errors
					}
				}
				if (this.currentDistortableOverlay.editing) {
					try {
						this.currentDistortableOverlay.editing.disable();
					} catch {
						// Ignore disable errors
					}
				}
				this.map.removeLayer(this.currentDistortableOverlay);
				this.currentDistortableOverlay = null;
			}

			// Remove the 'ldi' class from the map container
			this.container.classList.remove('ldi');

			// Restore regular overlay
			await this.restoreRegularOverlay();

			this.editModeEnabled = false;

			// Notify listeners
			if (this.onEditModeChangeCallback) {
				this.onEditModeChangeCallback(false);
			}

			logger.info('edit-mode', 'Edit mode disabled');
		} catch (error) {
			logger.error('edit-mode-error', 'Failed to disable edit mode', { error });
		}
	}

	/**
	 * Save the current distortable overlay corners to frontmatter
	 */
	async saveEditedCorners(): Promise<boolean> {
		if (!this.currentDistortableOverlay || !this.editModeEnabled) {
			logger.warn('save-corners', 'No distortable overlay active');
			return false;
		}

		try {
			const corners = this.currentDistortableOverlay.getCorners();
			const success = await this.imageMapManager.saveCorners(this.activeMapId, corners);

			if (success && this.onCornersSavedCallback) {
				this.onCornersSavedCallback();
			}

			return success;
		} catch (error) {
			logger.error('save-corners-error', 'Failed to save corners', { error });
			return false;
		}
	}

	/**
	 * Restore the current distortable overlay to its original position
	 */
	restoreOverlay(): void {
		if (this.currentDistortableOverlay && this.editModeEnabled) {
			this.currentDistortableOverlay.restore();
			logger.debug('edit-mode', 'Restored overlay to original position');
		}
	}

	/**
	 * Restore the regular (non-distortable) image overlay
	 */
	private async restoreRegularOverlay(): Promise<void> {
		if (!this.map || this.activeMapId === 'openstreetmap') return;

		const overlay = await this.imageMapManager.createImageOverlay(this.activeMapId);
		if (overlay) {
			this.currentImageOverlay = overlay;
			overlay.addTo(this.map);
		}
	}

	/**
	 * Register a callback for when edit mode changes
	 */
	onEditModeChange(callback: (enabled: boolean) => void): void {
		this.onEditModeChangeCallback = callback;
	}

	/**
	 * Register a callback for when corners are saved
	 */
	onCornersSaved(callback: () => void): void {
		this.onCornersSavedCallback = callback;
	}

	/**
	 * Reset map alignment by clearing saved corners from frontmatter
	 * This removes any custom alignment and returns the map to default rectangular bounds
	 */
	async resetAlignment(): Promise<boolean> {
		if (!this.activeMapId || this.activeMapId === 'openstreetmap') {
			logger.warn('reset-alignment', 'Cannot reset alignment: no custom map active');
			return false;
		}

		try {
			// Clear corners from frontmatter
			const success = await this.imageMapManager.clearCorners(this.activeMapId);
			if (!success) {
				return false;
			}

			// If in edit mode, disable it first
			if (this.editModeEnabled) {
				await this.disableEditMode();
			}

			// Reload the map to apply default bounds
			await this.setActiveMap(this.activeMapId);

			logger.info('reset-alignment', `Reset alignment for map ${this.activeMapId}`);
			return true;
		} catch (error) {
			logger.error('reset-alignment-error', 'Failed to reset alignment', { error });
			return false;
		}
	}

	/**
	 * Fit map bounds to show all markers
	 */
	private fitBounds(): void {
		if (!this.map || !this.currentData) return;

		const markers = this.currentData.markers;
		if (markers.length === 0) return;

		// Create bounds using appropriate coordinates
		const coords = markers.map(m => {
			if (this.currentCRS === 'pixel' && m.pixelX !== undefined && m.pixelY !== undefined) {
				return [m.pixelY, m.pixelX] as L.LatLngTuple;
			}
			return [m.lat, m.lng] as L.LatLngTuple;
		});

		const bounds = L.latLngBounds(coords);
		this.map.fitBounds(bounds, { padding: [50, 50] });
	}

	/**
	 * Get current map state
	 */
	getState(): MapState {
		const center = this.map?.getCenter() || L.latLng(this.settings.defaultCenter.lat, this.settings.defaultCenter.lng);
		const zoom = this.map?.getZoom() || this.settings.defaultZoom;

		return {
			center: { lat: center.lat, lng: center.lng },
			zoom,
			filters: {},
			layers: this.currentLayers,
			activeMap: this.activeMapId,
			heatMapConfig: {
				includeTypes: ['birth', 'death'],
				blur: this.settings.heatMapBlur,
				radius: this.settings.heatMapRadius,
				maxIntensity: 1
			}
		};
	}

	/**
	 * Export current data as GeoJSON
	 */
	exportGeoJSON(): GeoJSONFeatureCollection {
		const features: GeoJSONFeatureCollection['features'] = [];

		if (!this.currentData) {
			return { type: 'FeatureCollection', features };
		}

		// Export markers
		for (const marker of this.currentData.markers) {
			features.push({
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [marker.lng, marker.lat]  // GeoJSON uses lng, lat order
				},
				properties: {
					personId: marker.personId,
					personName: marker.personName,
					markerType: marker.type,
					date: marker.date,
					placeName: marker.placeName,
					collection: marker.collection
				}
			});
		}

		// Export paths
		for (const path of this.currentData.paths) {
			features.push({
				type: 'Feature',
				geometry: {
					type: 'LineString',
					coordinates: [
						[path.origin.lng, path.origin.lat],
						[path.destination.lng, path.destination.lat]
					]
				},
				properties: {
					personId: path.personId,
					personName: path.personName,
					pathType: 'migration',
					origin: path.origin.name,
					destination: path.destination.name
				}
			});
		}

		return { type: 'FeatureCollection', features };
	}

	/**
	 * Export current view as SVG
	 */
	exportSVG(options: SVGExportOptions): string {
		const { width, height, includeLabels, includeLegend, includeCoordinates, title } = options;

		if (!this.currentData || !this.map) {
			return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><text x="50%" y="50%" text-anchor="middle">No data</text></svg>`;
		}

		const bounds = this.map.getBounds();
		const markers = this.currentData.markers;
		const paths = this.currentData.paths;

		// Projection function: lat/lng to SVG coordinates
		const project = (lat: number, lng: number): { x: number; y: number } => {
			const x = ((lng - bounds.getWest()) / (bounds.getEast() - bounds.getWest())) * (width - 100) + 50;
			const y = ((bounds.getNorth() - lat) / (bounds.getNorth() - bounds.getSouth())) * (height - 100) + 50;
			return { x, y };
		};

		let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">\n`;

		// Title
		if (title) {
			svg += `  <title>${this.escapeXml(title)}</title>\n`;
		}

		// Bounding box
		svg += `  <rect x="50" y="50" width="${width - 100}" height="${height - 100}" fill="none" stroke="#ccc"/>\n`;

		// Coordinate labels
		if (includeCoordinates) {
			svg += `  <text x="50" y="45" font-size="10">${bounds.getNorth().toFixed(1)}°N, ${bounds.getWest().toFixed(1)}°${bounds.getWest() < 0 ? 'W' : 'E'}</text>\n`;
			svg += `  <text x="${width - 50}" y="${height - 55}" font-size="10" text-anchor="end">${bounds.getSouth().toFixed(1)}°N, ${bounds.getEast().toFixed(1)}°${bounds.getEast() < 0 ? 'W' : 'E'}</text>\n`;
		}

		// Migration paths
		for (const path of paths) {
			const start = project(path.origin.lat, path.origin.lng);
			const end = project(path.destination.lat, path.destination.lng);

			// Bezier curve for nicer paths
			const midX = (start.x + end.x) / 2;
			const midY = (start.y + end.y) / 2 - 30;

			svg += `  <path d="M ${start.x},${start.y} Q ${midX},${midY} ${end.x},${end.y}" stroke="${this.settings.pathColor}" stroke-width="2" fill="none"/>\n`;

			// Arrow head
			const angle = Math.atan2(end.y - midY, end.x - midX);
			const arrowSize = 8;
			const ax1 = end.x - arrowSize * Math.cos(angle - Math.PI / 6);
			const ay1 = end.y - arrowSize * Math.sin(angle - Math.PI / 6);
			const ax2 = end.x - arrowSize * Math.cos(angle + Math.PI / 6);
			const ay2 = end.y - arrowSize * Math.sin(angle + Math.PI / 6);
			svg += `  <polygon points="${end.x},${end.y} ${ax1},${ay1} ${ax2},${ay2}" fill="${this.settings.pathColor}"/>\n`;
		}

		// Markers
		for (const marker of markers) {
			const pos = project(marker.lat, marker.lng);
			const color = this.getMarkerColorForType(marker.type);

			svg += `  <circle cx="${pos.x}" cy="${pos.y}" r="6" fill="${color}" stroke="white" stroke-width="1"/>\n`;

			if (includeLabels) {
				svg += `  <text x="${pos.x + 10}" y="${pos.y + 4}" font-size="10">${this.escapeXml(marker.placeName)}</text>\n`;
			}
		}

		// Legend
		if (includeLegend) {
			const legendY = height - 30;
			svg += `  <g transform="translate(50, ${legendY})">\n`;
			svg += `    <circle cx="10" cy="0" r="5" fill="${this.settings.birthMarkerColor}"/><text x="20" y="4" font-size="10">Birth</text>\n`;
			svg += `    <circle cx="80" cy="0" r="5" fill="${this.settings.deathMarkerColor}"/><text x="90" y="4" font-size="10">Death</text>\n`;
			svg += `    <line x1="150" y1="0" x2="170" y2="0" stroke="${this.settings.pathColor}" stroke-width="2"/><text x="175" y="4" font-size="10">Migration</text>\n`;
			svg += `  </g>\n`;
		}

		svg += '</svg>';

		return svg;
	}

	/**
	 * Escape XML special characters
	 */
	private escapeXml(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}

	/**
	 * Destroy the map and clean up resources
	 */
	destroy(): void {
		logger.debug('destroy', 'Destroying map controller');

		this.birthClusterGroup?.clearLayers();
		this.deathClusterGroup?.clearLayers();
		this.marriageClusterGroup?.clearLayers();
		this.burialClusterGroup?.clearLayers();
		this.eventsClusterGroup?.clearLayers();
		this.pathLayer?.clearLayers();
		this.journeyLayer?.clearLayers();

		// Clean up distortable overlay if active
		if (this.currentDistortableOverlay && this.map) {
			try {
				if (typeof this.currentDistortableOverlay.deselect === 'function') {
					this.currentDistortableOverlay.deselect();
				}
				if (this.currentDistortableOverlay.editing) {
					this.currentDistortableOverlay.editing.disable();
				}
				this.map.removeLayer(this.currentDistortableOverlay);
			} catch {
				// Ignore cleanup errors
			}
			this.currentDistortableOverlay = null;
		}

		// Clean up image map manager
		this.imageMapManager.destroy();
		this.currentImageOverlay = null;

		this.map?.remove();
		this.map = null;
	}
}
