/**
 * Geocoding Service
 *
 * Provides geocoding functionality using OpenStreetMap's Nominatim API.
 * Handles single and bulk geocoding with rate limiting.
 */

import { requestUrl, TFile, App } from 'obsidian';
import { getLogger } from '../../core/logging';
import type { GeoCoordinates } from '../../models/place';

const logger = getLogger('GeocodingService');

/**
 * Result of a geocoding lookup
 */
export interface GeocodingResult {
	/** Whether the lookup was successful */
	success: boolean;
	/** The coordinates if found */
	coordinates?: GeoCoordinates;
	/** Display name returned by the API */
	displayName?: string;
	/** Error message if unsuccessful */
	error?: string;
	/** The original place name queried */
	placeName: string;
	/** Structured address components from Nominatim (when using geocodeWithDetails) */
	addressComponents?: Record<string, string>;
}

/**
 * Progress callback for bulk geocoding operations
 */
export interface GeocodingProgressCallback {
	/** Called when a single place is processed */
	onProgress: (current: number, total: number, result: GeocodingResult) => void;
	/** Called to check if the operation should be cancelled */
	isCancelled: () => boolean;
}

/**
 * Summary of bulk geocoding operation
 */
export interface BulkGeocodingResult {
	/** Total places processed */
	total: number;
	/** Number of successful lookups */
	success: number;
	/** Number of failed lookups */
	failed: number;
	/** Number of places skipped (already had coordinates) */
	skipped: number;
	/** Number cancelled before processing */
	cancelled: number;
	/** Individual results */
	results: GeocodingResult[];
}

/**
 * User-Agent header for Nominatim API
 * Required by Nominatim usage policy
 */
const USER_AGENT = 'Charted Roots Obsidian plugin (https://github.com/banisterious/obsidian-charted-roots)';

/**
 * Rate limit delay in milliseconds (Nominatim requires 1 request/second)
 */
const RATE_LIMIT_DELAY = 1100; // Slightly over 1 second to be safe

/**
 * Nominatim API base URL
 */
const NOMINATIM_API_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Service for geocoding place names to coordinates
 */
export class GeocodingService {
	private app: App;
	private lastRequestTime = 0;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Look up coordinates for a single place
	 *
	 * @param placeName - The name of the place to look up
	 * @param parentPlace - Optional parent place for more accurate results
	 * @returns The geocoding result
	 */
	async geocodeSingle(placeName: string, parentPlace?: string): Promise<GeocodingResult> {
		if (!placeName.trim()) {
			return {
				success: false,
				error: 'Place name is empty',
				placeName
			};
		}

		// Build search query including parent place for better accuracy
		let searchQuery = placeName.trim();
		if (parentPlace) {
			// Strip wikilinks if present
			const parentName = parentPlace.replace(/\[\[|\]\]/g, '');
			searchQuery = `${placeName}, ${parentName}`;
		}

		// Enforce rate limiting
		await this.enforceRateLimit();

		try {
			const url = `${NOMINATIM_API_URL}?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`;

			logger.debug('geocode-request', `Geocoding: ${searchQuery}`);

			const response = await requestUrl({
				url,
				headers: {
					'User-Agent': USER_AGENT
				}
			});

			const results = response.json as unknown[];

			if (!results || results.length === 0) {
				logger.debug('geocode-not-found', `No results for: ${searchQuery}`);
				return {
					success: false,
					error: 'No location found',
					placeName
				};
			}

			const result = results[0] as { lat: string; lon: string; display_name: string };
			const lat = parseFloat(result.lat);
			const long = parseFloat(result.lon);

			logger.debug('geocode-success', `Found: ${result.display_name} (${lat}, ${long})`);

			return {
				success: true,
				coordinates: { lat, long },
				displayName: result.display_name,
				placeName
			};

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.warn('geocode-error', `Failed to geocode "${searchQuery}": ${errorMessage}`);

			return {
				success: false,
				error: errorMessage,
				placeName
			};
		}
	}

	/**
	 * Geocode multiple places with rate limiting and progress reporting
	 *
	 * @param places - Array of places to geocode
	 * @param progressCallback - Callback for progress updates and cancellation
	 * @returns Summary of the bulk operation
	 */
	async geocodeBulk(
		places: Array<{ name: string; parentPlace?: string; hasCoordinates: boolean }>,
		progressCallback?: GeocodingProgressCallback
	): Promise<BulkGeocodingResult> {
		const results: GeocodingResult[] = [];
		let success = 0;
		let failed = 0;
		let skipped = 0;
		let cancelled = 0;

		for (let i = 0; i < places.length; i++) {
			// Check for cancellation
			if (progressCallback?.isCancelled()) {
				cancelled = places.length - i;
				logger.info('geocode-bulk-cancelled', `Bulk geocoding cancelled. ${cancelled} places remaining.`);
				break;
			}

			const place = places[i];

			// Skip places that already have coordinates
			if (place.hasCoordinates) {
				skipped++;
				const result: GeocodingResult = {
					success: true,
					placeName: place.name,
					error: 'Already has coordinates'
				};
				results.push(result);
				progressCallback?.onProgress(i + 1, places.length, result);
				continue;
			}

			// Geocode the place
			const result = await this.geocodeSingle(place.name, place.parentPlace);
			results.push(result);

			if (result.success && result.coordinates) {
				success++;
			} else {
				failed++;
			}

			progressCallback?.onProgress(i + 1, places.length, result);
		}

		const summary: BulkGeocodingResult = {
			total: places.length,
			success,
			failed,
			skipped,
			cancelled,
			results
		};

		logger.info('geocode-bulk-complete', `Bulk geocoding complete`, summary);

		return summary;
	}

	/**
	 * Update a place note's frontmatter with new coordinates
	 *
	 * @param file - The file to update
	 * @param coordinates - The new coordinates
	 */
	async updatePlaceCoordinates(file: TFile, coordinates: GeoCoordinates): Promise<void> {
		// Use Obsidian's processFrontMatter API for clean flat property handling
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			// Remove any legacy nested coordinates property
			if (frontmatter.coordinates !== undefined) {
				delete frontmatter.coordinates;
			}
			// Write flat properties (preferred format)
			frontmatter.coordinates_lat = coordinates.lat;
			frontmatter.coordinates_long = coordinates.long;
		});

		logger.debug('coordinates-updated', `Updated coordinates for ${file.path}`);
	}

	/**
	 * Enforce rate limiting by waiting if necessary
	 */
	private async enforceRateLimit(): Promise<void> {
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;

		if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
			const waitTime = RATE_LIMIT_DELAY - timeSinceLastRequest;
			logger.debug('rate-limit-wait', `Waiting ${waitTime}ms for rate limit`);
			await this.sleep(waitTime);
		}

		this.lastRequestTime = Date.now();
	}

	/**
	 * Sleep for specified milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Look up coordinates and detailed address components for a place
	 * Uses Nominatim's addressdetails parameter to get structured address info
	 *
	 * @param placeName - The name of the place to look up
	 * @param parentPlace - Optional parent place for more accurate results
	 * @returns The geocoding result with address components
	 */
	async geocodeWithDetails(placeName: string, parentPlace?: string): Promise<GeocodingResult> {
		if (!placeName.trim()) {
			return {
				success: false,
				error: 'Place name is empty',
				placeName
			};
		}

		// Build search query including parent place for better accuracy
		let searchQuery = placeName.trim();
		if (parentPlace) {
			// Strip wikilinks if present
			const parentName = parentPlace.replace(/\[\[|\]\]/g, '');
			searchQuery = `${placeName}, ${parentName}`;
		}

		// Enforce rate limiting
		await this.enforceRateLimit();

		try {
			// Add addressdetails=1 to get structured address components
			const url = `${NOMINATIM_API_URL}?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&addressdetails=1`;

			logger.debug('geocode-details-request', `Geocoding with details: ${searchQuery}`);

			const response = await requestUrl({
				url,
				headers: {
					'User-Agent': USER_AGENT
				}
			});

			const results = response.json as unknown[];

			if (!results || results.length === 0) {
				logger.debug('geocode-not-found', `No results for: ${searchQuery}`);
				return {
					success: false,
					error: 'No location found',
					placeName
				};
			}

			const result = results[0] as {
				lat: string;
				lon: string;
				display_name: string;
				address?: Record<string, string>;
			};

			const lat = parseFloat(result.lat);
			const long = parseFloat(result.lon);

			logger.debug('geocode-details-success', `Found: ${result.display_name} (${lat}, ${long})`, result.address);

			return {
				success: true,
				coordinates: { lat, long },
				displayName: result.display_name,
				placeName,
				addressComponents: result.address
			};

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.warn('geocode-error', `Failed to geocode "${searchQuery}": ${errorMessage}`);

			return {
				success: false,
				error: errorMessage,
				placeName
			};
		}
	}
}
