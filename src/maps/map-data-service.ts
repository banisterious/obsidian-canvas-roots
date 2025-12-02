/**
 * Map Data Service
 *
 * Prepares map data from person and place notes for visualization.
 */

import { TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../main';
import { getLogger } from '../core/logging';
import type {
	MapData,
	MapMarker,
	MigrationPath,
	AggregatedPath,
	MapFilters,
	CustomMapConfig,
	MarkerType,
	PersonLifeSpan
} from './types/map-types';

const logger = getLogger('MapDataService');

/**
 * Place note data extracted from frontmatter
 */
interface PlaceData {
	crId: string;
	name: string;
	/** Latitude (geographic coordinate system) */
	lat?: number;
	/** Longitude (geographic coordinate system) */
	lng?: number;
	/** Pixel X coordinate (pixel coordinate system) */
	pixelX?: number;
	/** Pixel Y coordinate (pixel coordinate system) */
	pixelY?: number;
	category?: string;
	universe?: string;
	parentPlace?: string;
}

/**
 * Person note data extracted from frontmatter
 */
interface PersonData {
	crId: string;
	name: string;
	born?: string;
	died?: string;
	birthPlace?: string;
	birthPlaceId?: string;
	deathPlace?: string;
	deathPlaceId?: string;
	collection?: string;
}

/**
 * Service for preparing map data from vault notes
 */
export class MapDataService {
	private plugin: CanvasRootsPlugin;

	// Cache for place data (keyed by cr_id)
	private placeCache: Map<string, PlaceData> = new Map();

	// Cache for place data by name (for string-based references)
	private placeByNameCache: Map<string, PlaceData> = new Map();

	constructor(plugin: CanvasRootsPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Get map data for the given filters
	 * @param filters Filter options for map display
	 * @param forceRefresh If true, read directly from files instead of metadata cache
	 */
	async getMapData(filters: MapFilters, forceRefresh = false): Promise<MapData> {
		logger.debug('get-data', 'Getting map data', { filters, forceRefresh });

		// Refresh place cache (force file read if requested)
		await this.refreshPlaceCache(forceRefresh);

		// Get person data
		const people = await this.getPersonData();

		// Build markers
		const markers = this.buildMarkers(people, filters);

		// Build migration paths
		const paths = this.buildPaths(people, filters);

		// Aggregate paths
		const aggregatedPaths = this.aggregatePaths(paths);

		// Build life span data for time slider
		const personLifeSpans = this.buildLifeSpans(people, filters);

		// Get available collections
		const collections = [...new Set(people.map(p => p.collection).filter(Boolean) as string[])];

		// Get available universes
		const universes = [...new Set([...this.placeCache.values()].map(p => p.universe).filter(Boolean) as string[])];

		// Calculate year range from life spans (more complete than just markers)
		const allYears: number[] = [];
		for (const span of personLifeSpans) {
			if (span.birthYear) allYears.push(span.birthYear);
			if (span.deathYear) allYears.push(span.deathYear);
		}
		const yearRange = {
			min: allYears.length > 0 ? Math.min(...allYears) : 1800,
			max: allYears.length > 0 ? Math.max(...allYears) : 2000
		};

		// Get custom maps (placeholder for Phase 4.5)
		const customMaps: CustomMapConfig[] = [];

		logger.debug('get-data-complete', 'Map data prepared', {
			markers: markers.length,
			paths: paths.length,
			collections: collections.length,
			personLifeSpans: personLifeSpans.length
		});

		return {
			markers,
			paths,
			aggregatedPaths,
			collections,
			universes,
			yearRange,
			customMaps,
			personLifeSpans
		};
	}

	/**
	 * Refresh the place cache from vault
	 * @param forceFileRead If true, read directly from files instead of metadata cache
	 */
	private async refreshPlaceCache(forceFileRead = false): Promise<void> {
		this.placeCache.clear();
		this.placeByNameCache.clear();

		const placesFolder = this.plugin.settings.placesFolder;
		if (!placesFolder) {
			logger.debug('no-places-folder', 'No places folder configured');
			return;
		}

		const files = this.plugin.app.vault.getMarkdownFiles();

		for (const file of files) {
			// Only process files in places folder
			if (!file.path.startsWith(placesFolder)) continue;

			let fm: Record<string, unknown> | undefined;

			if (forceFileRead) {
				// Read directly from file to get latest frontmatter
				// This bypasses the metadata cache which may be stale
				fm = await this.readFrontmatterFromFile(file);
			} else {
				const cache = this.plugin.app.metadataCache.getFileCache(file);
				fm = cache?.frontmatter;
			}

			if (!fm) continue;

			// Only process place notes
			if (fm.type !== 'place') continue;

			// Parse coordinates (handles both object and JSON string formats)
			const coords = this.parseCoordinates(fm.coordinates);

			// Parse pixel coordinates for pixel-based maps
			// Supports both flat (pixel_x, pixel_y) and nested (pixel_coordinates.x, pixel_coordinates.y) formats
			const pixelX = this.parseCoordinate(fm.pixel_x) ?? this.parsePixelCoordinates(fm.pixel_coordinates).x;
			const pixelY = this.parseCoordinate(fm.pixel_y) ?? this.parsePixelCoordinates(fm.pixel_coordinates).y;

			const placeData: PlaceData = {
				crId: String(fm.cr_id || ''),
				name: String(fm.name || file.basename),
				lat: coords.lat,
				lng: coords.lng,
				pixelX,
				pixelY,
				category: fm.place_category ? String(fm.place_category) : undefined,
				universe: fm.universe ? String(fm.universe) : undefined,
				parentPlace: this.extractLinkTarget(fm.parent_place) || undefined
			};

			if (placeData.crId) {
				this.placeCache.set(placeData.crId, placeData);
			}

			// Also cache by name for string-based lookups
			const nameLower = placeData.name.toLowerCase();
			if (!this.placeByNameCache.has(nameLower)) {
				this.placeByNameCache.set(nameLower, placeData);
			}
		}

		logger.debug('place-cache', `Cached ${this.placeCache.size} places`);
	}

	/**
	 * Get person data from vault
	 */
	private async getPersonData(): Promise<PersonData[]> {
		const people: PersonData[] = [];

		const peopleFolder = this.plugin.settings.peopleFolder;
		const files = this.plugin.app.vault.getMarkdownFiles();

		for (const file of files) {
			// Only process files in people folder if configured
			if (peopleFolder && !file.path.startsWith(peopleFolder)) continue;

			const cache = this.plugin.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;

			// Skip non-person notes
			if (fm.type && fm.type !== 'person') continue;

			// Must have cr_id to be a person note
			if (!fm.cr_id) continue;

			const personData: PersonData = {
				crId: fm.cr_id,
				name: fm.name || file.basename,
				born: fm.born,
				died: fm.died,
				birthPlace: this.extractPlaceString(fm.birth_place),
				birthPlaceId: fm.birth_place_id,
				deathPlace: this.extractPlaceString(fm.death_place),
				deathPlaceId: fm.death_place_id,
				collection: fm.collection
			};

			people.push(personData);
		}

		logger.debug('person-data', `Found ${people.length} people`);
		return people;
	}

	/**
	 * Build markers from person data
	 */
	private buildMarkers(people: PersonData[], filters: MapFilters): MapMarker[] {
		const markers: MapMarker[] = [];

		for (const person of people) {
			// Apply collection filter
			if (filters.collection && person.collection !== filters.collection) {
				continue;
			}

			// Birth marker
			const birthPlace = this.resolvePlace(person.birthPlaceId, person.birthPlace);
			if (birthPlace && this.hasValidCoordinates(birthPlace)) {
				// Apply universe filter - only show markers matching the selected universe
				if (filters.universe && birthPlace.universe !== filters.universe) {
					// Skip this marker - wrong universe
				} else {
					const birthYear = this.extractYear(person.born);

					// Apply year filter
					if (this.isInYearRange(birthYear, filters)) {
						markers.push({
							personId: person.crId,
							personName: person.name,
							type: 'birth',
							lat: birthPlace.lat ?? 0,
							lng: birthPlace.lng ?? 0,
							pixelX: birthPlace.pixelX,
							pixelY: birthPlace.pixelY,
							placeName: birthPlace.name,
							placeId: birthPlace.crId,
							date: person.born,
							year: birthYear,
							collection: person.collection,
							universe: birthPlace.universe,
							placeCategory: birthPlace.category
						});
					}
				}
			}

			// Death marker
			const deathPlace = this.resolvePlace(person.deathPlaceId, person.deathPlace);
			if (deathPlace && this.hasValidCoordinates(deathPlace)) {
				// Apply universe filter - only show markers matching the selected universe
				if (filters.universe && deathPlace.universe !== filters.universe) {
					// Skip this marker - wrong universe
				} else {
					const deathYear = this.extractYear(person.died);

					// Apply year filter
					if (this.isInYearRange(deathYear, filters)) {
						markers.push({
							personId: person.crId,
							personName: person.name,
							type: 'death',
							lat: deathPlace.lat ?? 0,
							lng: deathPlace.lng ?? 0,
							pixelX: deathPlace.pixelX,
							pixelY: deathPlace.pixelY,
							placeName: deathPlace.name,
							placeId: deathPlace.crId,
							date: person.died,
							year: deathYear,
							collection: person.collection,
							universe: deathPlace.universe,
							placeCategory: deathPlace.category
						});
					}
				}
			}
		}

		return markers;
	}

	/**
	 * Check if a place has valid coordinates (either geographic or pixel)
	 */
	private hasValidCoordinates(place: PlaceData): boolean {
		const hasGeographic = place.lat !== undefined && place.lng !== undefined;
		const hasPixel = place.pixelX !== undefined && place.pixelY !== undefined;
		return hasGeographic || hasPixel;
	}

	/**
	 * Build migration paths from person data
	 */
	private buildPaths(people: PersonData[], filters: MapFilters): MigrationPath[] {
		const paths: MigrationPath[] = [];

		for (const person of people) {
			// Apply collection filter
			if (filters.collection && person.collection !== filters.collection) {
				continue;
			}

			const birthPlace = this.resolvePlace(person.birthPlaceId, person.birthPlace);
			const deathPlace = this.resolvePlace(person.deathPlaceId, person.deathPlace);

			// Need both places with valid coordinates to create a path
			if (!birthPlace || !deathPlace) continue;
			if (!this.hasValidCoordinates(birthPlace) || !this.hasValidCoordinates(deathPlace)) continue;

			// Apply universe filter - both places must match the universe filter
			const pathUniverse = birthPlace.universe || deathPlace.universe;
			if (filters.universe && pathUniverse !== filters.universe) {
				continue;
			}

			// Skip if same location (check both geographic and pixel coordinates)
			const sameGeographic = birthPlace.lat === deathPlace.lat && birthPlace.lng === deathPlace.lng;
			const samePixel = birthPlace.pixelX === deathPlace.pixelX && birthPlace.pixelY === deathPlace.pixelY;
			if (sameGeographic && samePixel) continue;

			const birthYear = this.extractYear(person.born);
			const deathYear = this.extractYear(person.died);

			// Apply year filter (check both years)
			if (!this.isInYearRange(birthYear, filters) && !this.isInYearRange(deathYear, filters)) {
				continue;
			}

			paths.push({
				personId: person.crId,
				personName: person.name,
				origin: {
					lat: birthPlace.lat ?? 0,
					lng: birthPlace.lng ?? 0,
					pixelX: birthPlace.pixelX,
					pixelY: birthPlace.pixelY,
					name: birthPlace.name
				},
				destination: {
					lat: deathPlace.lat ?? 0,
					lng: deathPlace.lng ?? 0,
					pixelX: deathPlace.pixelX,
					pixelY: deathPlace.pixelY,
					name: deathPlace.name
				},
				birthYear,
				deathYear,
				collection: person.collection,
				universe: pathUniverse
			});
		}

		return paths;
	}

	/**
	 * Aggregate paths that share the same origin and destination
	 */
	private aggregatePaths(paths: MigrationPath[]): AggregatedPath[] {
		const pathMap = new Map<string, AggregatedPath>();

		for (const path of paths) {
			// Create a key based on origin and destination coordinates
			const key = `${path.origin.lat.toFixed(4)},${path.origin.lng.toFixed(4)}-${path.destination.lat.toFixed(4)},${path.destination.lng.toFixed(4)}`;

			const existing = pathMap.get(key);
			if (existing) {
				existing.count++;
				existing.personIds.push(path.personId);
				existing.personNames.push(path.personName);
			} else {
				pathMap.set(key, {
					...path,
					count: 1,
					personIds: [path.personId],
					personNames: [path.personName]
				});
			}
		}

		return [...pathMap.values()];
	}

	/**
	 * Build life span data for all people (used by time slider)
	 */
	private buildLifeSpans(people: PersonData[], filters: MapFilters): PersonLifeSpan[] {
		const lifeSpans: PersonLifeSpan[] = [];

		for (const person of people) {
			// Apply collection filter
			if (filters.collection && person.collection !== filters.collection) {
				continue;
			}

			const birthYear = this.extractYear(person.born);
			const deathYear = this.extractYear(person.died);

			// Only include people with at least one year defined
			if (birthYear !== undefined || deathYear !== undefined) {
				lifeSpans.push({
					personId: person.crId,
					personName: person.name,
					birthYear,
					deathYear,
					collection: person.collection
				});
			}
		}

		return lifeSpans;
	}

	/**
	 * Resolve a place by ID or name
	 */
	private resolvePlace(placeId?: string, placeName?: string): PlaceData | null {
		// Try by ID first
		if (placeId) {
			const place = this.placeCache.get(placeId);
			if (place) return place;
		}

		// Try by name (extract from wikilink if needed)
		if (placeName) {
			const linkTarget = this.extractLinkTarget(placeName);
			const searchName = (linkTarget || placeName).toLowerCase();

			// Search in cache
			const place = this.placeByNameCache.get(searchName);
			if (place) return place;

			// Try partial match (city name without country, etc.)
			for (const [name, data] of this.placeByNameCache) {
				if (name.includes(searchName) || searchName.includes(name)) {
					return data;
				}
			}
		}

		return null;
	}

	/**
	 * Extract link target from wikilink string
	 */
	private extractLinkTarget(value: unknown): string | null {
		if (typeof value !== 'string') return null;

		// Match [[Target]] or [[Target|Display]]
		const match = value.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
		return match ? match[1] : null;
	}

	/**
	 * Extract place string (handle wikilinks or plain strings)
	 */
	private extractPlaceString(value: unknown): string | undefined {
		if (typeof value !== 'string') return undefined;

		// Extract from wikilink or return as-is
		const linkTarget = this.extractLinkTarget(value);
		return linkTarget || value;
	}

	/**
	 * Parse a coordinate value
	 * Handles numbers, strings, and also extracts from coordinate objects
	 */
	private parseCoordinate(value: unknown): number | undefined {
		if (typeof value === 'number') return value;
		if (typeof value === 'string') {
			const parsed = parseFloat(value);
			return isNaN(parsed) ? undefined : parsed;
		}
		return undefined;
	}

	/**
	 * Parse coordinates from frontmatter
	 * Handles both object format and string JSON format
	 */
	private parseCoordinates(coords: unknown): { lat?: number; lng?: number } {
		if (!coords) return {};

		// If it's a string, try to parse as JSON
		if (typeof coords === 'string') {
			try {
				coords = JSON.parse(coords);
			} catch {
				return {};
			}
		}

		// Now handle as object
		if (typeof coords === 'object' && coords !== null) {
			const coordObj = coords as Record<string, unknown>;
			return {
				lat: this.parseCoordinate(coordObj.lat),
				lng: this.parseCoordinate(coordObj.long || coordObj.lng)
			};
		}

		return {};
	}

	/**
	 * Parse pixel coordinates from frontmatter
	 * Handles both object format { x: number, y: number } and string JSON format
	 */
	private parsePixelCoordinates(coords: unknown): { x?: number; y?: number } {
		if (!coords) return {};

		// If it's a string, try to parse as JSON
		if (typeof coords === 'string') {
			try {
				coords = JSON.parse(coords);
			} catch {
				return {};
			}
		}

		// Now handle as object
		if (typeof coords === 'object' && coords !== null) {
			const coordObj = coords as Record<string, unknown>;
			return {
				x: this.parseCoordinate(coordObj.x),
				y: this.parseCoordinate(coordObj.y)
			};
		}

		return {};
	}

	/**
	 * Extract year from a date string
	 */
	private extractYear(dateStr?: string): number | undefined {
		if (!dateStr) return undefined;

		// Try ISO format (YYYY-MM-DD)
		const isoMatch = dateStr.match(/^(\d{4})/);
		if (isoMatch) return parseInt(isoMatch[1]);

		// Try other common formats
		const yearMatch = dateStr.match(/\b(\d{4})\b/);
		if (yearMatch) return parseInt(yearMatch[1]);

		return undefined;
	}

	/**
	 * Check if a year is within the filter range
	 */
	private isInYearRange(year: number | undefined, filters: MapFilters): boolean {
		if (year === undefined) return true; // No year = include by default

		if (filters.yearFrom !== undefined && year < filters.yearFrom) {
			return false;
		}

		if (filters.yearTo !== undefined && year > filters.yearTo) {
			return false;
		}

		return true;
	}

	/**
	 * Read frontmatter directly from a file (bypasses metadata cache)
	 */
	private async readFrontmatterFromFile(file: TFile): Promise<Record<string, unknown> | undefined> {
		try {
			const content = await this.plugin.app.vault.read(file);

			// Check if file starts with frontmatter delimiter
			if (!content.startsWith('---')) {
				return undefined;
			}

			// Find closing delimiter
			const endIndex = content.indexOf('---', 3);
			if (endIndex === -1) {
				return undefined;
			}

			// Extract YAML content
			const yamlContent = content.slice(4, endIndex).trim();

			// Parse YAML manually (simple key: value parsing)
			// For complex cases, this relies on Obsidian's parser, but for
			// coordinates we do a basic parse
			const result: Record<string, unknown> = {};
			const lines = yamlContent.split('\n');
			let currentKey = '';
			let inObject = false;
			let objectContent: Record<string, unknown> = {};

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith('#')) continue;

				// Check for object start (key followed by nested content)
				if (!line.startsWith(' ') && !line.startsWith('\t')) {
					// Save previous object if any
					if (inObject && currentKey) {
						result[currentKey] = objectContent;
						objectContent = {};
						inObject = false;
					}

					const colonIndex = trimmed.indexOf(':');
					if (colonIndex > 0) {
						const key = trimmed.slice(0, colonIndex).trim();
						const value = trimmed.slice(colonIndex + 1).trim();

						if (value === '' || value === '|' || value === '>') {
							// Start of object or multiline
							currentKey = key;
							inObject = true;
							objectContent = {};
						} else {
							// Simple key: value
							result[key] = this.parseYamlValue(value);
						}
					}
				} else if (inObject) {
					// Nested content
					const colonIndex = trimmed.indexOf(':');
					if (colonIndex > 0) {
						const key = trimmed.slice(0, colonIndex).trim();
						const value = trimmed.slice(colonIndex + 1).trim();
						objectContent[key] = this.parseYamlValue(value);
					}
				}
			}

			// Save final object if any
			if (inObject && currentKey) {
				result[currentKey] = objectContent;
			}

			return result;
		} catch (error) {
			logger.warn('read-frontmatter', `Failed to read frontmatter from ${file.path}`, { error });
			return undefined;
		}
	}

	/**
	 * Parse a simple YAML value
	 */
	private parseYamlValue(value: string): unknown {
		// Remove quotes
		if ((value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))) {
			return value.slice(1, -1);
		}

		// Check for number
		const num = parseFloat(value);
		if (!isNaN(num) && value === String(num)) {
			return num;
		}

		// Check for boolean
		if (value === 'true') return true;
		if (value === 'false') return false;
		if (value === 'null') return null;

		return value;
	}
}
