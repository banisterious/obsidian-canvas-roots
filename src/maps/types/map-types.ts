/**
 * Type definitions for Canvas Roots Map View
 */

import type * as L from 'leaflet';

// ============================================================================
// Core Map Data Types
// ============================================================================

/**
 * Types of markers displayed on the map
 * Core life events: birth, death, marriage, burial
 * Additional events: residence, occupation, education, military, immigration, baptism, confirmation, ordination, custom
 */
export type MarkerType =
	| 'birth'
	| 'death'
	| 'marriage'
	| 'burial'
	| 'residence'
	| 'occupation'
	| 'education'
	| 'military'
	| 'immigration'
	| 'baptism'
	| 'confirmation'
	| 'ordination'
	| 'custom';

/**
 * Event types that can be stored in the events array
 */
export type EventType =
	| 'residence'
	| 'occupation'
	| 'education'
	| 'military'
	| 'immigration'
	| 'baptism'
	| 'confirmation'
	| 'ordination'
	| 'custom';

/**
 * A life event from the events array in person frontmatter
 */
export interface LifeEvent {
	/** Type of event */
	event_type: EventType;
	/** Wikilink to place note */
	place: string;
	/** Start date (YYYY, YYYY-MM, or YYYY-MM-DD) */
	date_from?: string;
	/** End date for duration events */
	date_to?: string;
	/** Brief description */
	description?: string;
}

/**
 * A marker representing a person's life event location
 */
export interface MapMarker {
	/** cr_id of the person */
	personId: string;
	/** Display name of the person */
	personName: string;
	/** Type of life event */
	type: MarkerType;
	/** Latitude coordinate (for geographic coordinate system) */
	lat: number;
	/** Longitude coordinate (for geographic coordinate system) */
	lng: number;
	/** Pixel X coordinate (for pixel coordinate system) */
	pixelX?: number;
	/** Pixel Y coordinate (for pixel coordinate system) */
	pixelY?: number;
	/** Name of the place */
	placeName: string;
	/** cr_id of the place note (if linked) */
	placeId?: string;
	/** Date of the event (ISO format) */
	date?: string;
	/** Year extracted from date (for filtering) */
	year?: number;
	/** Collection the person belongs to */
	collection?: string;
	/** Universe for fictional places */
	universe?: string;
	/** Place category (real, fictional, etc.) */
	placeCategory?: string;
	/** Description of the event (for events array entries) */
	description?: string;
	/** End date for duration events (ISO format) */
	dateTo?: string;
	/** End year extracted from dateTo (for filtering) */
	yearTo?: number;
}

/**
 * A migration path connecting birth to death location
 */
export interface MigrationPath {
	/** cr_id of the person */
	personId: string;
	/** Display name of the person */
	personName: string;
	/** Origin location (typically birth) */
	origin: {
		lat: number;
		lng: number;
		pixelX?: number;
		pixelY?: number;
		name: string;
	};
	/** Destination location (typically death) */
	destination: {
		lat: number;
		lng: number;
		pixelX?: number;
		pixelY?: number;
		name: string;
	};
	/** Birth year for filtering */
	birthYear?: number;
	/** Death year for filtering */
	deathYear?: number;
	/** Collection the person belongs to */
	collection?: string;
	/** Universe for fictional places */
	universe?: string;
}

/**
 * Aggregated path for routes shared by multiple people
 */
export interface AggregatedPath extends MigrationPath {
	/** Number of people who traveled this route */
	count: number;
	/** List of person IDs who traveled this route */
	personIds: string[];
	/** List of person names who traveled this route */
	personNames: string[];
}

// ============================================================================
// Custom Image Map Types
// ============================================================================

/**
 * Coordinate system type for custom maps
 * - 'geographic': Uses lat/lng coordinates (default, for maps with real-world reference points)
 * - 'pixel': Uses pixel coordinates with L.CRS.Simple (for custom image maps)
 */
export type CoordinateSystemType = 'geographic' | 'pixel';

/**
 * Four corner positions for distortable image alignment
 * Order: NW, NE, SW, SE (in a "Z" pattern)
 */
export interface ImageCorners {
	nw: { lat: number; lng: number };
	ne: { lat: number; lng: number };
	sw: { lat: number; lng: number };
	se: { lat: number; lng: number };
}

/**
 * Configuration for a custom image map (fictional worlds)
 */
export interface CustomMapConfig {
	/** Unique identifier for this map */
	id: string;
	/** Display name */
	name: string;
	/** Universe this map belongs to */
	universe: string;
	/** Path to the map image in the vault */
	imagePath: string;
	/** Coordinate system type ('geographic' or 'pixel') */
	coordinateSystem: CoordinateSystemType;
	/** Coordinate bounds for the image */
	bounds: {
		/** Top-left corner */
		topLeft: { x: number; y: number };
		/** Bottom-right corner */
		bottomRight: { x: number; y: number };
	};
	/** Image dimensions in pixels (required for pixel coordinate system) */
	imageDimensions?: { width: number; height: number };
	/** Optional center point for initial view */
	center?: { x: number; y: number };
	/** Optional initial zoom level */
	defaultZoom?: number;
	/** Optional minimum zoom level */
	minZoom?: number;
	/** Optional maximum zoom level */
	maxZoom?: number;
	/**
	 * Corner positions for distortable image alignment.
	 * When present, enables distortable image mode for interactive
	 * scale/rotate/distort operations on the map image.
	 */
	corners?: ImageCorners;
	/** Path to the source file for saving corner updates */
	sourcePath?: string;
}

// ============================================================================
// Filter and Display Options
// ============================================================================

/**
 * Filter options for map display
 */
export interface MapFilters {
	/** Filter by collection name */
	collection?: string;
	/** Filter by universe (for fictional maps) */
	universe?: string;
	/** Minimum year (inclusive) */
	yearFrom?: number;
	/** Maximum year (inclusive) */
	yearTo?: number;
	/** Place categories to include */
	placeCategories?: string[];
	/** Marker types to show */
	markerTypes?: MarkerType[];
}

/**
 * Layer visibility toggles
 */
export interface LayerVisibility {
	// Core life events
	/** Show birth markers */
	births: boolean;
	/** Show death markers */
	deaths: boolean;
	/** Show marriage markers */
	marriages: boolean;
	/** Show burial markers */
	burials: boolean;

	// Additional life events
	/** Show residence markers */
	residences: boolean;
	/** Show occupation markers */
	occupations: boolean;
	/** Show education markers */
	educations: boolean;
	/** Show military markers */
	military: boolean;
	/** Show immigration markers */
	immigrations: boolean;
	/** Show religious event markers (baptism, confirmation, ordination) */
	religious: boolean;
	/** Show custom event markers */
	custom: boolean;

	// Other layers
	/** Show migration paths */
	paths: boolean;
	/** Show heat map layer */
	heatMap: boolean;
}

/**
 * Heat map configuration
 */
export interface HeatMapConfig {
	/** Which marker types to include in heat map */
	includeTypes: MarkerType[];
	/** Blur radius */
	blur: number;
	/** Point radius */
	radius: number;
	/** Maximum intensity */
	maxIntensity: number;
}

/**
 * Time slider state for "who was alive" animation
 */
export interface TimeSliderState {
	/** Whether the time slider is enabled */
	enabled: boolean;
	/** Currently selected year */
	currentYear: number;
	/** Whether animation is playing */
	isPlaying: boolean;
	/** Animation speed in milliseconds per year */
	speed: number;
	/** Show only people alive at current year (vs cumulative) */
	snapshotMode: boolean;
}

// ============================================================================
// Map State
// ============================================================================

/**
 * Current state of the map view
 */
export interface MapState {
	/** Current center coordinates */
	center: { lat: number; lng: number };
	/** Current zoom level */
	zoom: number;
	/** Active filters */
	filters: MapFilters;
	/** Layer visibility */
	layers: LayerVisibility;
	/** Currently active map (OSM or custom map ID) */
	activeMap: 'openstreetmap' | string;
	/** Heat map configuration */
	heatMapConfig: HeatMapConfig;
}

/**
 * Person life span data for time slider filtering
 */
export interface PersonLifeSpan {
	/** cr_id of the person */
	personId: string;
	/** Display name */
	personName: string;
	/** Birth year (undefined if unknown) */
	birthYear?: number;
	/** Death year (undefined if still alive or unknown) */
	deathYear?: number;
	/** Collection the person belongs to */
	collection?: string;
}

/**
 * Data prepared for map display
 */
export interface MapData {
	/** All markers to display */
	markers: MapMarker[];
	/** All migration paths to display */
	paths: MigrationPath[];
	/** Aggregated paths (for line weight visualization) */
	aggregatedPaths: AggregatedPath[];
	/** Available collections for filtering */
	collections: string[];
	/** Available universes for filtering */
	universes: string[];
	/** Year range in the data */
	yearRange: { min: number; max: number };
	/** Custom maps available */
	customMaps: CustomMapConfig[];
	/** Life span data for all people (for time slider) */
	personLifeSpans: PersonLifeSpan[];
}

// ============================================================================
// Export Types
// ============================================================================

/**
 * GeoJSON Feature for export
 */
export interface GeoJSONFeature {
	type: 'Feature';
	geometry: {
		type: 'Point' | 'LineString';
		coordinates: number[] | number[][];
	};
	properties: Record<string, unknown>;
}

/**
 * GeoJSON FeatureCollection for export
 */
export interface GeoJSONFeatureCollection {
	type: 'FeatureCollection';
	features: GeoJSONFeature[];
}

/**
 * Options for SVG export
 */
export interface SVGExportOptions {
	/** Include person name labels */
	includeLabels: boolean;
	/** Title for the SVG */
	title?: string;
	/** Width of the SVG */
	width: number;
	/** Height of the SVG */
	height: number;
	/** Include legend */
	includeLegend: boolean;
	/** Include coordinate labels */
	includeCoordinates: boolean;
}

// ============================================================================
// Leaflet Extension Types
// ============================================================================

/**
 * Extended marker with Canvas Roots metadata
 */
export interface CRMarker extends L.Marker {
	crData?: MapMarker;
}

/**
 * Extended polyline with Canvas Roots metadata
 */
export interface CRPolyline extends L.Polyline {
	crData?: MigrationPath | AggregatedPath;
}

// ============================================================================
// Settings Types
// ============================================================================

/**
 * Map-related plugin settings
 */
export interface MapSettings {
	/** Tile provider for real-world maps */
	tileProvider: 'openstreetmap' | 'custom';
	/** Custom tile URL template (if tileProvider is 'custom') */
	customTileUrl?: string;

	/** Default center for initial map view */
	defaultCenter: { lat: number; lng: number };
	/** Default zoom level */
	defaultZoom: number;

	// Core life event colors
	/** Birth marker color */
	birthMarkerColor: string;
	/** Death marker color */
	deathMarkerColor: string;
	/** Marriage marker color */
	marriageMarkerColor: string;
	/** Burial marker color */
	burialMarkerColor: string;

	// Additional event colors
	/** Residence marker color */
	residenceMarkerColor: string;
	/** Occupation marker color */
	occupationMarkerColor: string;
	/** Education marker color */
	educationMarkerColor: string;
	/** Military marker color */
	militaryMarkerColor: string;
	/** Immigration marker color */
	immigrationMarkerColor: string;
	/** Religious event marker color (baptism, confirmation, ordination) */
	religiousMarkerColor: string;
	/** Custom event marker color */
	customMarkerColor: string;

	/** Show migration paths by default */
	showMigrationPaths: boolean;
	/** Migration path color */
	pathColor: string;
	/** Migration path line weight */
	pathWeight: number;
	/** Show person name labels on migration paths */
	showPathLabels: boolean;

	/** Heat map blur radius */
	heatMapBlur: number;
	/** Heat map point radius */
	heatMapRadius: number;

	/** Folder for custom map images */
	customMapsFolder: string;
}

/**
 * Default map settings
 */
export const DEFAULT_MAP_SETTINGS: MapSettings = {
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

	showMigrationPaths: true,
	pathColor: '#6366f1',  // indigo
	pathWeight: 2,
	showPathLabels: true,
	heatMapBlur: 15,
	heatMapRadius: 25,
	customMapsFolder: 'Canvas Roots/Places/Maps'
};

/**
 * Get the marker color for a given event type
 */
export function getMarkerColor(type: MarkerType, settings: MapSettings): string {
	switch (type) {
		case 'birth':
			return settings.birthMarkerColor;
		case 'death':
			return settings.deathMarkerColor;
		case 'marriage':
			return settings.marriageMarkerColor;
		case 'burial':
			return settings.burialMarkerColor;
		case 'residence':
			return settings.residenceMarkerColor;
		case 'occupation':
			return settings.occupationMarkerColor;
		case 'education':
			return settings.educationMarkerColor;
		case 'military':
			return settings.militaryMarkerColor;
		case 'immigration':
			return settings.immigrationMarkerColor;
		case 'baptism':
		case 'confirmation':
		case 'ordination':
			return settings.religiousMarkerColor;
		case 'custom':
			return settings.customMarkerColor;
		default:
			return settings.residenceMarkerColor; // fallback
	}
}

/**
 * Check if a marker type is visible based on layer settings
 */
export function isMarkerTypeVisible(type: MarkerType, layers: LayerVisibility): boolean {
	switch (type) {
		case 'birth':
			return layers.births;
		case 'death':
			return layers.deaths;
		case 'marriage':
			return layers.marriages;
		case 'burial':
			return layers.burials;
		case 'residence':
			return layers.residences;
		case 'occupation':
			return layers.occupations;
		case 'education':
			return layers.educations;
		case 'military':
			return layers.military;
		case 'immigration':
			return layers.immigrations;
		case 'baptism':
		case 'confirmation':
		case 'ordination':
			return layers.religious;
		case 'custom':
			return layers.custom;
		default:
			return true;
	}
}

/**
 * Default layer visibility (all enabled)
 */
export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
	// Core life events
	births: true,
	deaths: true,
	marriages: true,
	burials: true,

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
