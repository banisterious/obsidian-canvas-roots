/**
 * Image Map Manager
 *
 * Handles custom image maps for fictional worlds and historical maps.
 * Allows users to use their own map images with custom coordinate systems.
 * Supports distortable images for interactive alignment and georeferencing.
 */

import { TFile } from 'obsidian';
import type { App } from 'obsidian';
import * as L from 'leaflet';
import { getLogger } from '../core/logging';
import type { CustomMapConfig, ImageCorners } from './types/map-types';
import { isMapNote } from '../utils/note-type-detection';

// Initialize logger early so it can be used by helper functions
const logger = getLogger('ImageMapManager');

/**
 * Safely convert frontmatter value to string
 */
function fmToString(value: unknown, fallback = ''): string {
	if (value === undefined || value === null) return fallback;
	if (typeof value === 'object' && value !== null) return JSON.stringify(value);
	// At this point, value is a primitive
	return String(value as string | number | boolean | bigint | symbol);
}

// Track state for plugin initialization
let distortableImageLoaded = false;

/**
 * Initialize the distortable image plugins
 * These libraries expect L to be globally available on window
 * We use require() instead of import because we need to set window.L first
 */
function initDistortableImagePlugins(): void {
	if (distortableImageLoaded) return;

	// Ensure L is on window BEFORE loading the plugins
	if (typeof window !== 'undefined') {
		(window as unknown as { L: typeof L }).L = L;
	}

	// Use require() to load the plugins after setting window.L
	require('leaflet-toolbar');
	require('leaflet-distortableimage');

	distortableImageLoaded = true;
	logger.debug('init-plugins', 'Distortable image plugins initialized');
}

/**
 * Ensure the distortable image plugins are loaded
 * This is called before creating a distortable overlay
 * Note: CSS is now in styles/leaflet-distortable.css (bundled with plugin)
 */
function ensureDistortableImageLoaded(): void {
	// Initialize the plugins (sets window.L and requires the libraries)
	initDistortableImagePlugins();

	// Verify the plugins loaded correctly
	const globalWindow = window as unknown as { L: typeof L & { Toolbar2?: unknown; distortableImageOverlay?: unknown } };
	if (!globalWindow.L.distortableImageOverlay) {
		throw new Error('L.distortableImageOverlay not found after loading leaflet-distortableimage');
	}
}

/**
 * Configuration for a custom image map stored in frontmatter
 *
 * Supports both flat and nested property formats for Obsidian compatibility.
 * Flat properties (image_width, center_x) are preferred as they work better
 * with Obsidian's Properties view.
 */
export interface ImageMapFrontmatter {
	/** Type must be 'map' to be recognized */
	type: 'map';
	/** Unique identifier for this map */
	map_id: string;
	/** Display name for the map */
	name: string;
	/** Universe this map belongs to (for filtering) */
	universe: string;
	/** Path to the image file (relative to vault) */
	image: string;
	/**
	 * Coordinate system type:
	 * - 'geographic': Use lat/lng bounds (default, backward compatible)
	 * - 'pixel': Use pixel coordinates with L.CRS.Simple
	 */
	coordinate_system?: 'geographic' | 'pixel';

	// === Geographic mode bounds (flat format preferred) ===
	/** North bound (geographic mode) */
	bounds_north?: number;
	/** South bound (geographic mode) */
	bounds_south?: number;
	/** East bound (geographic mode) */
	bounds_east?: number;
	/** West bound (geographic mode) */
	bounds_west?: number;
	/** Legacy nested bounds (still supported) */
	bounds?: {
		south: number;
		west: number;
		north: number;
		east: number;
	};

	// === Pixel mode image dimensions (flat format preferred) ===
	/** Image width in pixels */
	image_width?: number;
	/** Image height in pixels */
	image_height?: number;
	/** Legacy nested dimensions (still supported) */
	image_dimensions?: {
		width: number;
		height: number;
	};

	// === Center point (flat format preferred) ===
	/** Center latitude (geographic mode) */
	center_lat?: number;
	/** Center longitude (geographic mode) */
	center_lng?: number;
	/** Center X coordinate (pixel mode) */
	center_x?: number;
	/** Center Y coordinate (pixel mode) */
	center_y?: number;
	/** Legacy nested center (still supported) */
	center?: {
		lat?: number;
		lng?: number;
		x?: number;
		y?: number;
	};

	/** Optional default zoom level */
	default_zoom?: number;
	/** Optional minimum zoom */
	min_zoom?: number;
	/** Optional maximum zoom */
	max_zoom?: number;

	// === Distortable image corners (for aligned/georeferenced maps) ===
	/**
	 * Four corner positions for distortable image alignment.
	 * When present, the image will be rendered using these corners
	 * instead of the standard bounds, allowing for rotation/distortion.
	 * Format: Array of 4 lat/lng objects in NW, NE, SW, SE order
	 */
	corners?: Array<{ lat: number; lng: number }>;
	/** Flat corner properties (preferred format for Obsidian Properties view) */
	corner_nw_lat?: number;
	corner_nw_lng?: number;
	corner_ne_lat?: number;
	corner_ne_lng?: number;
	corner_sw_lat?: number;
	corner_sw_lng?: number;
	corner_se_lat?: number;
	corner_se_lng?: number;
}

/**
 * Manages custom image maps loaded from vault
 */
export class ImageMapManager {
	private app: App;
	private mapsFolder: string;
	private mapConfigs: Map<string, CustomMapConfig> = new Map();
	private imageOverlays: Map<string, L.ImageOverlay> = new Map();

	constructor(app: App, mapsFolder: string) {
		this.app = app;
		this.mapsFolder = mapsFolder;
	}

	/**
	 * Load all custom map configurations from the vault
	 */
	loadMapConfigs(): CustomMapConfig[] {
		this.mapConfigs.clear();
		const configs: CustomMapConfig[] = [];

		// Look for map config files (markdown files with cr_type: map in frontmatter)
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			// Check if file is in the maps folder or has map type
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;
			// Uses flexible detection with default settings for backwards compatibility
			if (!isMapNote(fm, cache)) continue;

			try {
				const config = this.parseMapConfig(fm, file);
				if (config) {
					this.mapConfigs.set(config.id, config);
					configs.push(config);
					logger.debug('load-config', `Loaded map config: ${config.name}`, { id: config.id });
				}
			} catch (error) {
				logger.warn('parse-config', `Failed to parse map config from ${file.path}`, { error });
			}
		}

		logger.info('load-complete', `Loaded ${configs.length} custom map configs`);
		return configs;
	}

	/**
	 * Parse a map configuration from frontmatter
	 * Supports both flat (preferred) and nested (legacy) property formats
	 */
	private parseMapConfig(fm: Record<string, unknown>, file: TFile): CustomMapConfig | null {
		// Validate required fields
		if (!fm.map_id || !fm.name || !fm.universe || !fm.image) {
			logger.warn('invalid-config', `Map config in ${file.path} missing required fields`);
			return null;
		}

		const coordinateSystem = fm.coordinate_system === 'pixel' ? 'pixel' : 'geographic';

		// Parse bounds - support both flat and nested formats
		const boundsNested = fm.bounds as Record<string, unknown> | undefined;
		const hasFlatBounds = typeof fm.bounds_north === 'number' || typeof fm.bounds_south === 'number';
		const hasNestedBounds = boundsNested && typeof boundsNested.north === 'number';

		// For geographic mode, bounds are required
		if (coordinateSystem === 'geographic' && !hasFlatBounds && !hasNestedBounds) {
			logger.warn('invalid-config', `Map config in ${file.path} missing bounds (required for geographic mode)`);
			return null;
		}

		let bounds: { topLeft: { x: number; y: number }; bottomRight: { x: number; y: number } };
		let imageDimensions: { width: number; height: number } | undefined;

		if (coordinateSystem === 'pixel') {
			// For pixel mode, use image dimensions (flat format preferred)
			const width = typeof fm.image_width === 'number' ? fm.image_width : undefined;
			const height = typeof fm.image_height === 'number' ? fm.image_height : undefined;

			// Fall back to nested format
			const dimsNested = fm.image_dimensions as Record<string, unknown> | undefined;
			const finalWidth = width ?? (dimsNested && typeof dimsNested.width === 'number' ? dimsNested.width : undefined);
			const finalHeight = height ?? (dimsNested && typeof dimsNested.height === 'number' ? dimsNested.height : undefined);

			if (finalWidth !== undefined && finalHeight !== undefined) {
				imageDimensions = { width: finalWidth, height: finalHeight };
				// In pixel/Simple CRS: y increases upward, so bounds go from [0,0] to [height, width]
				bounds = {
					topLeft: { x: 0, y: finalHeight },      // top-left in Simple CRS
					bottomRight: { x: finalWidth, y: 0 }    // bottom-right in Simple CRS
				};
			} else {
				// Dimensions will be auto-detected later when loading the image
				// Use placeholder bounds
				bounds = {
					topLeft: { x: 0, y: 1000 },
					bottomRight: { x: 1000, y: 0 }
				};
			}
		} else {
			// Geographic mode - parse bounds (flat format preferred)
			let north: number, south: number, east: number, west: number;

			if (hasFlatBounds) {
				north = typeof fm.bounds_north === 'number' ? fm.bounds_north : 100;
				south = typeof fm.bounds_south === 'number' ? fm.bounds_south : -100;
				east = typeof fm.bounds_east === 'number' ? fm.bounds_east : 100;
				west = typeof fm.bounds_west === 'number' ? fm.bounds_west : -100;
			} else if (boundsNested) {
				if (
					typeof boundsNested.south !== 'number' ||
					typeof boundsNested.west !== 'number' ||
					typeof boundsNested.north !== 'number' ||
					typeof boundsNested.east !== 'number'
				) {
					logger.warn('invalid-bounds', `Map config in ${file.path} has invalid bounds`);
					return null;
				}
				north = boundsNested.north;
				south = boundsNested.south;
				east = boundsNested.east;
				west = boundsNested.west;
			} else {
				// Should not reach here due to earlier check
				return null;
			}

			bounds = {
				topLeft: { x: west, y: north },
				bottomRight: { x: east, y: south }
			};
		}

		// Parse center - support both flat and nested formats
		const centerNested = fm.center as Record<string, unknown> | undefined;
		let centerPoint: { x: number; y: number } | undefined;

		if (coordinateSystem === 'pixel') {
			// Pixel mode: prefer flat center_x/center_y
			const cx = typeof fm.center_x === 'number' ? fm.center_x : (centerNested?.x as number | undefined);
			const cy = typeof fm.center_y === 'number' ? fm.center_y : (centerNested?.y as number | undefined);
			if (cx !== undefined || cy !== undefined) {
				centerPoint = {
					x: cx ?? (bounds.bottomRight.x / 2),
					y: cy ?? (bounds.topLeft.y / 2)
				};
			}
		} else {
			// Geographic mode: prefer flat center_lat/center_lng
			const clat = typeof fm.center_lat === 'number' ? fm.center_lat : (centerNested?.lat as number | undefined);
			const clng = typeof fm.center_lng === 'number' ? fm.center_lng : (centerNested?.lng as number | undefined);
			if (clat !== undefined || clng !== undefined) {
				centerPoint = {
					x: clng ?? 0,
					y: clat ?? 0
				};
			}
		}

		// Parse corner positions for distortable image alignment
		// Supports both flat (corner_nw_lat, etc.) and nested (corners array) formats
		let corners: ImageCorners | undefined;
		const cornersArray = fm.corners as Array<{ lat: number; lng: number }> | undefined;

		// Check for flat corner properties first (preferred format)
		if (
			typeof fm.corner_nw_lat === 'number' &&
			typeof fm.corner_nw_lng === 'number' &&
			typeof fm.corner_ne_lat === 'number' &&
			typeof fm.corner_ne_lng === 'number' &&
			typeof fm.corner_sw_lat === 'number' &&
			typeof fm.corner_sw_lng === 'number' &&
			typeof fm.corner_se_lat === 'number' &&
			typeof fm.corner_se_lng === 'number'
		) {
			corners = {
				nw: { lat: fm.corner_nw_lat, lng: fm.corner_nw_lng },
				ne: { lat: fm.corner_ne_lat, lng: fm.corner_ne_lng },
				sw: { lat: fm.corner_sw_lat, lng: fm.corner_sw_lng },
				se: { lat: fm.corner_se_lat, lng: fm.corner_se_lng }
			};
		} else if (
			cornersArray &&
			Array.isArray(cornersArray) &&
			cornersArray.length === 4 &&
			cornersArray.every(c => typeof c.lat === 'number' && typeof c.lng === 'number')
		) {
			// Nested array format: [NW, NE, SW, SE]
			corners = {
				nw: { lat: cornersArray[0].lat, lng: cornersArray[0].lng },
				ne: { lat: cornersArray[1].lat, lng: cornersArray[1].lng },
				sw: { lat: cornersArray[2].lat, lng: cornersArray[2].lng },
				se: { lat: cornersArray[3].lat, lng: cornersArray[3].lng }
			};
		}

		return {
			id: fmToString(fm.map_id),
			name: fmToString(fm.name),
			universe: fmToString(fm.universe),
			imagePath: fmToString(fm.image),
			coordinateSystem,
			bounds,
			imageDimensions,
			center: centerPoint,
			defaultZoom: typeof fm.default_zoom === 'number' ? fm.default_zoom : (coordinateSystem === 'pixel' ? 0 : 2),
			minZoom: typeof fm.min_zoom === 'number' ? fm.min_zoom : (coordinateSystem === 'pixel' ? -2 : undefined),
			maxZoom: typeof fm.max_zoom === 'number' ? fm.max_zoom : (coordinateSystem === 'pixel' ? 4 : undefined),
			corners,
			sourcePath: file.path
		};
	}

	/**
	 * Get a map configuration by ID
	 */
	getMapConfig(mapId: string): CustomMapConfig | undefined {
		return this.mapConfigs.get(mapId);
	}

	/**
	 * Get all map configurations
	 */
	getAllConfigs(): CustomMapConfig[] {
		return [...this.mapConfigs.values()];
	}

	/**
	 * Get map configurations for a specific universe
	 */
	getConfigsForUniverse(universe: string): CustomMapConfig[] {
		return [...this.mapConfigs.values()].filter(c => c.universe === universe);
	}

	/**
	 * Create a Leaflet image overlay for a custom map
	 * For pixel coordinate maps, also auto-detects image dimensions if needed
	 */
	async createImageOverlay(mapId: string): Promise<L.ImageOverlay | null> {
		const config = this.mapConfigs.get(mapId);
		if (!config) {
			logger.warn('create-overlay', `Map config not found: ${mapId}`);
			return null;
		}

		// Check if we already have this overlay cached
		const cached = this.imageOverlays.get(mapId);
		if (cached) {
			return cached;
		}

		try {
			const imageUrl = await this.getImageUrl(config.imagePath);
			if (!imageUrl) {
				logger.error('image-not-found', `Image not found: ${config.imagePath}`);
				return null;
			}

			// For pixel coordinate system, auto-detect dimensions if not provided
			if (config.coordinateSystem === 'pixel' && !config.imageDimensions) {
				const dimensions = await this.getImageDimensions(imageUrl);
				if (dimensions) {
					config.imageDimensions = dimensions;
					// Update bounds based on actual image dimensions
					config.bounds = {
						topLeft: { x: 0, y: dimensions.height },
						bottomRight: { x: dimensions.width, y: 0 }
					};
					logger.debug('auto-detect-dimensions', `Auto-detected image dimensions: ${dimensions.width}x${dimensions.height}`);
				}
			}

			// Create bounds based on coordinate system
			let bounds: L.LatLngBounds;

			if (config.coordinateSystem === 'pixel') {
				// For Simple CRS: [y, x] format where y=0 is bottom
				// Image bounds: [[0, 0], [height, width]]
				bounds = L.latLngBounds(
					[0, 0],                                                    // Southwest (bottom-left)
					[config.bounds.topLeft.y, config.bounds.bottomRight.x]     // Northeast (top-right)
				);
			} else {
				// Geographic mode: standard lat/lng bounds
				bounds = L.latLngBounds(
					[config.bounds.bottomRight.y, config.bounds.topLeft.x],   // Southwest (bottom-left)
					[config.bounds.topLeft.y, config.bounds.bottomRight.x]    // Northeast (top-right)
				);
			}

			const overlay = L.imageOverlay(imageUrl, bounds, {
				opacity: 1,
				interactive: false
			});

			this.imageOverlays.set(mapId, overlay);
			logger.debug('create-overlay', `Created image overlay for ${config.name} (${config.coordinateSystem} mode)`);
			return overlay;
		} catch (error) {
			logger.error('create-overlay-error', `Failed to create overlay for ${mapId}`, { error });
		}

		return null;
	}

	/**
	 * Get the coordinate system for a map
	 */
	getCoordinateSystem(mapId: string): 'geographic' | 'pixel' {
		const config = this.mapConfigs.get(mapId);
		return config?.coordinateSystem ?? 'geographic';
	}

	/**
	 * Get image dimensions by loading the image
	 */
	private async getImageDimensions(imageUrl: string): Promise<{ width: number; height: number } | null> {
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				resolve({ width: img.naturalWidth, height: img.naturalHeight });
			};
			img.onerror = () => {
				logger.warn('image-dimensions', 'Failed to load image for dimension detection');
				resolve(null);
			};
			img.src = imageUrl;
		});
	}

	/**
	 * Get a data URL for an image in the vault
	 */
	private async getImageUrl(imagePath: string): Promise<string | null> {
		try {
			const file = this.app.vault.getAbstractFileByPath(imagePath);
			if (file && file instanceof TFile) {
				const arrayBuffer = await this.app.vault.readBinary(file);
				const blob = new Blob([arrayBuffer]);
				return URL.createObjectURL(blob);
			}

			// Try with vault adapter directly
			const exists = await this.app.vault.adapter.exists(imagePath);
			if (exists) {
				const data = await this.app.vault.adapter.readBinary(imagePath);
				const blob = new Blob([data]);
				return URL.createObjectURL(blob);
			}

			return null;
		} catch (error) {
			logger.error('get-image-url', `Failed to get image URL for ${imagePath}`, { error });
			return null;
		}
	}

	/**
	 * Get the Leaflet bounds for a custom map
	 */
	getMapBounds(mapId: string): L.LatLngBounds | null {
		const config = this.mapConfigs.get(mapId);
		if (!config) return null;

		return L.latLngBounds(
			[config.bounds.bottomRight.y, config.bounds.topLeft.x],   // Southwest
			[config.bounds.topLeft.y, config.bounds.bottomRight.x]    // Northeast
		);
	}

	/**
	 * Get the default center for a custom map
	 */
	getMapCenter(mapId: string): L.LatLng | null {
		const config = this.mapConfigs.get(mapId);
		if (!config) return null;

		if (config.center) {
			return L.latLng(config.center.y, config.center.x);
		}

		// Calculate center from bounds
		const bounds = this.getMapBounds(mapId);
		return bounds?.getCenter() ?? null;
	}

	/**
	 * Get the default zoom for a custom map
	 */
	getDefaultZoom(mapId: string): number {
		const config = this.mapConfigs.get(mapId);
		return config?.defaultZoom ?? 2;
	}

	/**
	 * Get the universe for a custom map
	 */
	getMapUniverse(mapId: string): string | null {
		const config = this.mapConfigs.get(mapId);
		return config?.universe ?? null;
	}

	/**
	 * Check if a map has distortable corners configured
	 */
	hasDistortableCorners(mapId: string): boolean {
		const config = this.mapConfigs.get(mapId);
		return config?.corners !== undefined;
	}

	/**
	 * Get the distortable corners for a map
	 */
	getDistortableCorners(mapId: string): ImageCorners | undefined {
		const config = this.mapConfigs.get(mapId);
		return config?.corners;
	}

	/**
	 * Create a distortable image overlay for interactive alignment
	 * This allows users to scale, rotate, and distort the map image
	 */
	async createDistortableOverlay(mapId: string): Promise<L.DistortableImageOverlay | null> {
		const config = this.mapConfigs.get(mapId);
		if (!config) {
			logger.warn('create-distortable', `Map config not found: ${mapId}`);
			return null;
		}

		try {
			// Ensure distortable image plugin is loaded (synchronous with require())
			ensureDistortableImageLoaded();

			const imageUrl = await this.getImageUrl(config.imagePath);
			if (!imageUrl) {
				logger.error('image-not-found', `Image not found: ${config.imagePath}`);
				return null;
			}

			const globalL = (window as unknown as { L: typeof L }).L;

			// Build options for distortable overlay
			// The library expects corners as plain { lat, lon } objects, NOT L.LatLng
			// If no corners are saved, DON'T pass corners - let the library auto-calculate
			// from the image dimensions (it does this in _initImageDimensions)
			interface DistortableOptions {
				editable: boolean;
				mode: 'distort' | 'drag' | 'rotate' | 'scale' | 'freeRotate' | 'lock';
				selected: boolean;
				suppressToolbar: boolean;
				corners?: Array<{ lat: number; lon: number }>;
			}

			// ALWAYS start with editable:false to prevent the library from auto-calling
			// editing.enable() on image load (which can fail before corners are fully ready)
			// We'll manually enable editing in map-controller after verifying everything
			const hasSavedCorners = !!config.corners;

			const options: DistortableOptions = {
				editable: false,  // Always false - we enable manually
				mode: 'distort',
				selected: false,
				suppressToolbar: true  // Suppress default toolbar - we'll add our own controls
			};

			// Pass corners in options so _initImageDimensions uses them on image load
			// The library checks this.options.corners before auto-calculating
			if (hasSavedCorners && config.corners) {
				// Use plain objects matching the local interface (library accepts { lat, lon })
				options.corners = [
					{ lat: config.corners.nw.lat, lon: config.corners.nw.lng },
					{ lat: config.corners.ne.lat, lon: config.corners.ne.lng },
					{ lat: config.corners.sw.lat, lon: config.corners.sw.lng },
					{ lat: config.corners.se.lat, lon: config.corners.se.lng }
				];
				logger.debug('create-distortable', `Using saved corners for ${config.name}`);
			} else {
				// No corners saved - library will auto-calculate from image dimensions
				logger.debug('create-distortable', `No saved corners, library will auto-calculate for ${config.name}`);
			}

			// Create distortable overlay
			// Use the global L to access the distortableImageOverlay factory
			// Cast options because the library accepts plain { lat, lon } objects for corners,
			// even though our type definitions say LatLng[]
			const distortableOverlay = globalL.distortableImageOverlay(
				imageUrl,
				options as unknown as L.DistortableImageOverlayOptions
			);

			// CRITICAL: If we have corners, pre-set _corners on the overlay
			// The library normally sets this in _initImageDimensions on image load,
			// but we need it set earlier to prevent errors when editing.enable() is called
			if (config.corners) {
				// Convert to L.LatLng objects and set directly on the overlay
				distortableOverlay._corners = [
					L.latLng(config.corners.nw.lat, config.corners.nw.lng),
					L.latLng(config.corners.ne.lat, config.corners.ne.lng),
					L.latLng(config.corners.sw.lat, config.corners.sw.lng),
					L.latLng(config.corners.se.lat, config.corners.se.lng)
				];
				logger.debug('create-distortable', `Pre-set _corners on overlay for ${config.name}`);
			}

			logger.debug('create-distortable', `Created distortable overlay for ${config.name}`);
			return distortableOverlay;
		} catch (error) {
			// Capture the actual error message and stack for debugging
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;
			logger.error('create-distortable-error', `Failed to create distortable overlay for ${mapId}: ${errorMessage}`, {
				error: errorMessage,
				stack: errorStack
			});
			return null;
		}
	}

	/**
	 * Save corner positions to the map note's frontmatter
	 * Uses flat property format for Obsidian Properties view compatibility
	 */
	async saveCorners(mapId: string, corners: L.LatLng[]): Promise<boolean> {
		const config = this.mapConfigs.get(mapId);
		if (!config || !config.sourcePath) {
			logger.warn('save-corners', `Cannot save corners: map config or source path not found for ${mapId}`);
			return false;
		}

		try {
			const file = this.app.vault.getAbstractFileByPath(config.sourcePath);
			if (!(file instanceof TFile)) {
				logger.error('save-corners', `Source file not found: ${config.sourcePath}`);
				return false;
			}

			// Read file content
			const content = await this.app.vault.read(file);

			// Parse frontmatter
			const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (!frontmatterMatch) {
				logger.error('save-corners', `No frontmatter found in ${config.sourcePath}`);
				return false;
			}

			const frontmatterContent = frontmatterMatch[1];
			let newFrontmatter = frontmatterContent;

			// Corners array should be [NW, NE, SW, SE]
			const cornerData = {
				corner_nw_lat: corners[0].lat,
				corner_nw_lng: corners[0].lng,
				corner_ne_lat: corners[1].lat,
				corner_ne_lng: corners[1].lng,
				corner_sw_lat: corners[2].lat,
				corner_sw_lng: corners[2].lng,
				corner_se_lat: corners[3].lat,
				corner_se_lng: corners[3].lng
			};

			// Update or add each corner property
			for (const [key, value] of Object.entries(cornerData)) {
				const propRegex = new RegExp(`^${key}:.*$`, 'm');
				const newLine = `${key}: ${value}`;

				if (propRegex.test(newFrontmatter)) {
					// Update existing property
					newFrontmatter = newFrontmatter.replace(propRegex, newLine);
				} else {
					// Add new property at end of frontmatter
					newFrontmatter = newFrontmatter.trimEnd() + `\n${newLine}`;
				}
			}

			// Rebuild file content with updated frontmatter
			const newContent = content.replace(
				/^---\n[\s\S]*?\n---/,
				`---\n${newFrontmatter}\n---`
			);

			// Write back to file
			await this.app.vault.modify(file, newContent);

			// Update in-memory config
			config.corners = {
				nw: { lat: corners[0].lat, lng: corners[0].lng },
				ne: { lat: corners[1].lat, lng: corners[1].lng },
				sw: { lat: corners[2].lat, lng: corners[2].lng },
				se: { lat: corners[3].lat, lng: corners[3].lng }
			};

			logger.info('save-corners', `Saved corners for map ${mapId} to ${config.sourcePath}`);
			return true;
		} catch (error) {
			logger.error('save-corners-error', `Failed to save corners for ${mapId}`, { error });
			return false;
		}
	}

	/**
	 * Clear corner positions from the map note's frontmatter
	 * This resets the map to use default rectangular bounds
	 */
	async clearCorners(mapId: string): Promise<boolean> {
		const config = this.mapConfigs.get(mapId);
		if (!config || !config.sourcePath) {
			logger.warn('clear-corners', `Cannot clear corners: map config or source path not found for ${mapId}`);
			return false;
		}

		try {
			const file = this.app.vault.getAbstractFileByPath(config.sourcePath);
			if (!(file instanceof TFile)) {
				logger.error('clear-corners', `Source file not found: ${config.sourcePath}`);
				return false;
			}

			// Read file content
			const content = await this.app.vault.read(file);

			// Parse frontmatter
			const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (!frontmatterMatch) {
				logger.error('clear-corners', `No frontmatter found in ${config.sourcePath}`);
				return false;
			}

			let frontmatterContent = frontmatterMatch[1];

			// Remove all corner properties
			const cornerProps = [
				'corner_nw_lat', 'corner_nw_lng',
				'corner_ne_lat', 'corner_ne_lng',
				'corner_sw_lat', 'corner_sw_lng',
				'corner_se_lat', 'corner_se_lng'
			];

			for (const prop of cornerProps) {
				// Remove the property line (including any trailing newline)
				const propRegex = new RegExp(`^${prop}:.*\\n?`, 'gm');
				frontmatterContent = frontmatterContent.replace(propRegex, '');
			}

			// Clean up any double newlines that may have been created
			frontmatterContent = frontmatterContent.replace(/\n{3,}/g, '\n\n').trim();

			// Rebuild file content with updated frontmatter
			const newContent = content.replace(
				/^---\n[\s\S]*?\n---/,
				`---\n${frontmatterContent}\n---`
			);

			// Write back to file
			await this.app.vault.modify(file, newContent);

			// Clear in-memory config corners
			config.corners = undefined;

			logger.info('clear-corners', `Cleared corners for map ${mapId} from ${config.sourcePath}`);
			return true;
		} catch (error) {
			logger.error('clear-corners-error', `Failed to clear corners for ${mapId}`, { error });
			return false;
		}
	}

	/**
	 * Clean up resources (revoke object URLs)
	 */
	destroy(): void {
		// Revoke any object URLs we created
		for (const overlay of this.imageOverlays.values()) {
			const url = (overlay).getElement()?.src;
			if (url && url.startsWith('blob:')) {
				URL.revokeObjectURL(url);
			}
		}
		this.imageOverlays.clear();
		this.mapConfigs.clear();
	}
}

/**
 * Example map configuration files:
 *
 * ## Geographic Coordinate System (default)
 * Use this when you want to define arbitrary lat/lng-style coordinates for your map.
 *
 * ```yaml
 * ---
 * cr_type: map
 * map_id: middle-earth
 * name: Middle-earth
 * universe: tolkien
 * image: assets/maps/middle-earth.jpg
 * coordinate_system: geographic
 * bounds_north: 50
 * bounds_south: -50
 * bounds_west: -100
 * bounds_east: 100
 * center_lat: 0
 * center_lng: 0
 * default_zoom: 3
 * min_zoom: 1
 * max_zoom: 6
 * ---
 *
 * # Middle-earth Map
 *
 * Place coordinates use lat/lng values within the defined bounds.
 * ```
 *
 * ## Pixel Coordinate System
 * Use this when you want to place markers directly using pixel coordinates.
 * This is ideal for custom maps where you want coordinates to match image editor positions.
 *
 * ```yaml
 * ---
 * cr_type: map
 * map_id: westeros
 * name: Westeros
 * universe: got
 * image: assets/maps/westeros.png
 * coordinate_system: pixel
 * image_width: 2048
 * image_height: 3072
 * center_x: 1024
 * center_y: 1536
 * default_zoom: 0
 * min_zoom: -2
 * max_zoom: 3
 * ---
 *
 * # Westeros Map
 *
 * Place coordinates use pixel positions (x, y) where:
 * - x: 0 is the left edge, increases rightward
 * - y: 0 is the bottom edge, increases upward
 *
 * Tip: Use an image editor to find pixel coordinates for places.
 * Note: If image_width/image_height are omitted, they will be auto-detected.
 * ```
 *
 * ## Place Note Example (Pixel Mode)
 *
 * ```yaml
 * ---
 * cr_type: place
 * cr_id: winterfell
 * name: Winterfell
 * universe: got
 * pixel_x: 1200
 * pixel_y: 2400
 * ---
 * ```
 */
