/**
 * Map Data Service
 *
 * Prepares map data from person and place notes for visualization.
 */

import { TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../main';
import { getLogger } from '../core/logging';
import { ValueAliasService, CANONICAL_EVENT_TYPES } from '../core/value-alias-service';
import type {
	MapData,
	MapMarker,
	MigrationPath,
	AggregatedPath,
	JourneyPath,
	JourneyWaypoint,
	MapFilters,
	CustomMapConfig,
	MarkerType,
	PersonLifeSpan,
	LifeEvent,
	EventType
} from './types/map-types';

const logger = getLogger('MapDataService');

/**
 * Safely convert frontmatter value to string
 */
function fmToString(value: unknown, fallback = ''): string {
	if (value === undefined || value === null) return fallback;
	if (typeof value === 'object' && value !== null) return JSON.stringify(value);
	// At this point, value is a primitive
	return String(value);
}

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
	marriagePlace?: string;
	marriagePlaceId?: string;
	marriageDate?: string;
	burialPlace?: string;
	burialPlaceId?: string;
	collection?: string;
	/** Life events from the events array */
	events?: LifeEvent[];
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
		const people = this.getPersonData();

		// Build markers
		const markers = this.buildMarkers(people, filters);

		// Build migration paths (birth → death)
		const paths = this.buildPaths(people, filters);

		// Aggregate paths
		const aggregatedPaths = this.aggregatePaths(paths);

		// Build journey paths (all life events connected chronologically)
		const journeyPaths = this.buildJourneyPaths(people, filters);

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
			journeyPaths: journeyPaths.length,
			collections: collections.length,
			personLifeSpans: personLifeSpans.length
		});

		return {
			markers,
			paths,
			aggregatedPaths,
			journeyPaths,
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
				crId: fmToString(fm.cr_id, ''),
				name: fmToString(fm.name, file.basename),
				lat: coords.lat,
				lng: coords.lng,
				pixelX,
				pixelY,
				category: fm.place_category ? fmToString(fm.place_category) : undefined,
				universe: fm.universe ? fmToString(fm.universe) : undefined,
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
	private getPersonData(): PersonData[] {
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
				marriagePlace: this.extractPlaceString(fm.marriage_place),
				marriagePlaceId: fm.marriage_place_id,
				marriageDate: fm.marriage_date,
				burialPlace: this.extractPlaceString(fm.burial_place),
				burialPlaceId: fm.burial_place_id,
				collection: fm.collection,
				events: this.parseEventsArray(fm.events)
			};

			people.push(personData);
		}

		logger.debug('person-data', `Found ${people.length} people`);
		return people;
	}

	/**
	 * Parse the events array from frontmatter
	 */
	private parseEventsArray(events: unknown): LifeEvent[] | undefined {
		if (!Array.isArray(events)) return undefined;

		const parsed: LifeEvent[] = [];
		const valueAliasService = new ValueAliasService(this.plugin);

		for (const event of events) {
			if (typeof event !== 'object' || event === null) continue;

			const eventObj = event as Record<string, unknown>;
			const rawEventType = eventObj.event_type as string;
			const place = eventObj.place as string;

			// Must have event_type and place
			if (!rawEventType || !place) continue;

			// Resolve event type using value aliases (unknown types become 'custom')
			const resolvedEventType = valueAliasService.resolve('eventType', rawEventType) as EventType;

			// Valid types for the events array (excluding birth/death/marriage which have dedicated fields)
			const validTypes: EventType[] = [
				'residence', 'occupation', 'education', 'military',
				'immigration', 'baptism', 'confirmation', 'ordination', 'custom'
			];
			if (!validTypes.includes(resolvedEventType)) continue;

			parsed.push({
				event_type: resolvedEventType,
				place: place,
				date_from: eventObj.date_from as string | undefined,
				date_to: eventObj.date_to as string | undefined,
				description: eventObj.description as string | undefined
			});
		}

		return parsed.length > 0 ? parsed : undefined;
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
			const birthMarker = this.createMarkerFromPlace(
				person, 'birth', person.birthPlaceId, person.birthPlace, person.born, filters
			);
			if (birthMarker) markers.push(birthMarker);

			// Death marker
			const deathMarker = this.createMarkerFromPlace(
				person, 'death', person.deathPlaceId, person.deathPlace, person.died, filters
			);
			if (deathMarker) markers.push(deathMarker);

			// Marriage marker
			const marriageMarker = this.createMarkerFromPlace(
				person, 'marriage', person.marriagePlaceId, person.marriagePlace, person.marriageDate, filters
			);
			if (marriageMarker) markers.push(marriageMarker);

			// Burial marker
			const burialMarker = this.createMarkerFromPlace(
				person, 'burial', person.burialPlaceId, person.burialPlace, person.died, filters
			);
			if (burialMarker) markers.push(burialMarker);

			// Event markers from events array
			if (person.events) {
				for (const event of person.events) {
					const eventMarker = this.createMarkerFromEvent(person, event, filters);
					if (eventMarker) markers.push(eventMarker);
				}
			}
		}

		return markers;
	}

	/**
	 * Create a marker from a place reference
	 */
	private createMarkerFromPlace(
		person: PersonData,
		type: MarkerType,
		placeId: string | undefined,
		placeName: string | undefined,
		date: string | undefined,
		filters: MapFilters
	): MapMarker | null {
		const place = this.resolvePlace(placeId, placeName);
		if (!place || !this.hasValidCoordinates(place)) return null;

		// Apply universe filter
		if (filters.universe && place.universe !== filters.universe) return null;

		const year = this.extractYear(date);

		// Apply year filter
		if (!this.isInYearRange(year, filters)) return null;

		return {
			personId: person.crId,
			personName: person.name,
			type,
			lat: place.lat ?? 0,
			lng: place.lng ?? 0,
			pixelX: place.pixelX,
			pixelY: place.pixelY,
			placeName: place.name,
			placeId: place.crId,
			date,
			year,
			collection: person.collection,
			universe: place.universe,
			placeCategory: place.category
		};
	}

	/**
	 * Create a marker from a life event
	 */
	private createMarkerFromEvent(
		person: PersonData,
		event: LifeEvent,
		filters: MapFilters
	): MapMarker | null {
		// Extract place from wikilink in event.place
		const placeName = this.extractPlaceString(event.place);
		const place = this.resolvePlace(undefined, placeName);
		if (!place || !this.hasValidCoordinates(place)) return null;

		// Apply universe filter
		if (filters.universe && place.universe !== filters.universe) return null;

		const year = this.extractYear(event.date_from);
		const yearTo = this.extractYear(event.date_to);

		// Apply year filter (check if event overlaps with filter range)
		if (!this.isEventInYearRange(year, yearTo, filters)) return null;

		return {
			personId: person.crId,
			personName: person.name,
			type: event.event_type,
			lat: place.lat ?? 0,
			lng: place.lng ?? 0,
			pixelX: place.pixelX,
			pixelY: place.pixelY,
			placeName: place.name,
			placeId: place.crId,
			date: event.date_from,
			year,
			dateTo: event.date_to,
			yearTo,
			description: event.description,
			collection: person.collection,
			universe: place.universe,
			placeCategory: place.category
		};
	}

	/**
	 * Check if an event with date range overlaps with the filter range
	 */
	private isEventInYearRange(
		yearFrom: number | undefined,
		yearTo: number | undefined,
		filters: MapFilters
	): boolean {
		// No years defined = include by default
		if (yearFrom === undefined && yearTo === undefined) return true;

		// If no filter range, include all
		if (filters.yearFrom === undefined && filters.yearTo === undefined) return true;

		// Check for overlap
		const eventStart = yearFrom ?? yearTo;
		const eventEnd = yearTo ?? yearFrom;

		if (eventStart === undefined || eventEnd === undefined) {
			// Single year defined, use simple range check
			return this.isInYearRange(yearFrom ?? yearTo, filters);
		}

		// Check if ranges overlap
		const filterStart = filters.yearFrom ?? -Infinity;
		const filterEnd = filters.yearTo ?? Infinity;

		return eventStart <= filterEnd && eventEnd >= filterStart;
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
	 * Build journey paths for all people (all life events connected chronologically)
	 */
	private buildJourneyPaths(people: PersonData[], filters: MapFilters): JourneyPath[] {
		const journeyPaths: JourneyPath[] = [];

		for (const person of people) {
			// Apply collection filter
			if (filters.collection && person.collection !== filters.collection) {
				continue;
			}

			const waypoints: JourneyWaypoint[] = [];
			let pathUniverse: string | undefined;

			// Add birth waypoint
			const birthPlace = this.resolvePlace(person.birthPlaceId, person.birthPlace);
			if (birthPlace && this.hasValidCoordinates(birthPlace)) {
				// Apply universe filter
				if (!filters.universe || birthPlace.universe === filters.universe) {
					const birthYear = this.extractYear(person.born);
					waypoints.push({
						lat: birthPlace.lat ?? 0,
						lng: birthPlace.lng ?? 0,
						pixelX: birthPlace.pixelX,
						pixelY: birthPlace.pixelY,
						name: birthPlace.name,
						placeId: birthPlace.crId,
						eventType: 'birth',
						date: person.born,
						year: birthYear
					});
					pathUniverse = birthPlace.universe;
				}
			}

			// Add marriage waypoint (if has date for chronological ordering)
			const marriagePlace = this.resolvePlace(person.marriagePlaceId, person.marriagePlace);
			if (marriagePlace && this.hasValidCoordinates(marriagePlace) && person.marriageDate) {
				if (!filters.universe || marriagePlace.universe === filters.universe) {
					const marriageYear = this.extractYear(person.marriageDate);
					waypoints.push({
						lat: marriagePlace.lat ?? 0,
						lng: marriagePlace.lng ?? 0,
						pixelX: marriagePlace.pixelX,
						pixelY: marriagePlace.pixelY,
						name: marriagePlace.name,
						placeId: marriagePlace.crId,
						eventType: 'marriage',
						date: person.marriageDate,
						year: marriageYear
					});
					if (!pathUniverse) pathUniverse = marriagePlace.universe;
				}
			}

			// Add events from events array
			if (person.events) {
				for (const event of person.events) {
					const placeName = this.extractPlaceString(event.place);
					const place = this.resolvePlace(undefined, placeName);
					if (place && this.hasValidCoordinates(place)) {
						if (!filters.universe || place.universe === filters.universe) {
							const year = this.extractYear(event.date_from);
							const yearTo = this.extractYear(event.date_to);
							waypoints.push({
								lat: place.lat ?? 0,
								lng: place.lng ?? 0,
								pixelX: place.pixelX,
								pixelY: place.pixelY,
								name: place.name,
								placeId: place.crId,
								eventType: event.event_type,
								date: event.date_from,
								year,
								dateTo: event.date_to,
								yearTo,
								description: event.description
							});
							if (!pathUniverse) pathUniverse = place.universe;
						}
					}
				}
			}

			// Add death waypoint
			const deathPlace = this.resolvePlace(person.deathPlaceId, person.deathPlace);
			if (deathPlace && this.hasValidCoordinates(deathPlace)) {
				if (!filters.universe || deathPlace.universe === filters.universe) {
					const deathYear = this.extractYear(person.died);
					waypoints.push({
						lat: deathPlace.lat ?? 0,
						lng: deathPlace.lng ?? 0,
						pixelX: deathPlace.pixelX,
						pixelY: deathPlace.pixelY,
						name: deathPlace.name,
						placeId: deathPlace.crId,
						eventType: 'death',
						date: person.died,
						year: deathYear
					});
					if (!pathUniverse) pathUniverse = deathPlace.universe;
				}
			}

			// Add burial waypoint (after death)
			const burialPlace = this.resolvePlace(person.burialPlaceId, person.burialPlace);
			if (burialPlace && this.hasValidCoordinates(burialPlace)) {
				if (!filters.universe || burialPlace.universe === filters.universe) {
					// Use death date for burial if no separate date
					const burialYear = this.extractYear(person.died);
					waypoints.push({
						lat: burialPlace.lat ?? 0,
						lng: burialPlace.lng ?? 0,
						pixelX: burialPlace.pixelX,
						pixelY: burialPlace.pixelY,
						name: burialPlace.name,
						placeId: burialPlace.crId,
						eventType: 'burial',
						date: person.died,
						year: burialYear
					});
					if (!pathUniverse) pathUniverse = burialPlace.universe;
				}
			}

			// Sort waypoints chronologically by year
			// Events without years are placed at the end
			waypoints.sort((a, b) => {
				// Birth always comes first
				if (a.eventType === 'birth') return -1;
				if (b.eventType === 'birth') return 1;
				// Death and burial always come last
				if (a.eventType === 'death' || a.eventType === 'burial') return 1;
				if (b.eventType === 'death' || b.eventType === 'burial') return -1;
				// Sort by year
				if (a.year === undefined && b.year === undefined) return 0;
				if (a.year === undefined) return 1;
				if (b.year === undefined) return -1;
				return a.year - b.year;
			});

			// Need at least 2 waypoints to make a journey path
			if (waypoints.length >= 2) {
				// Remove consecutive duplicate locations (same lat/lng)
				const uniqueWaypoints: JourneyWaypoint[] = [];
				for (const wp of waypoints) {
					const prev = uniqueWaypoints[uniqueWaypoints.length - 1];
					if (!prev || wp.lat !== prev.lat || wp.lng !== prev.lng) {
						uniqueWaypoints.push(wp);
					}
				}

				// Still need at least 2 unique locations
				if (uniqueWaypoints.length >= 2) {
					const birthYear = this.extractYear(person.born);
					const deathYear = this.extractYear(person.died);

					journeyPaths.push({
						personId: person.crId,
						personName: person.name,
						waypoints: uniqueWaypoints,
						birthYear,
						deathYear,
						collection: person.collection,
						universe: pathUniverse
					});
				}
			}
		}

		return journeyPaths;
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
