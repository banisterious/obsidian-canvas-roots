/**
 * Place Generator Service
 *
 * Scans person and event notes for place strings (not wikilinks),
 * creates place notes with proper hierarchy, and updates references.
 */

import { App, TFile } from 'obsidian';
import { getLogger } from '../../core/logging';
import { generateCrId } from '../../core/uuid';
import { createPlaceNote, PlaceData, findAllPlaceNotes } from '../../core/place-note-writer';
import { isPersonNote, isEventNote, isPlaceNote } from '../../utils/note-type-detection';
import { isWikilink } from '../../relationships/types/relationship-types';
import type { CanvasRootsSettings } from '../../settings';

const logger = getLogger('PlaceGenerator');

/**
 * Options for place generation
 */
export interface PlaceGeneratorOptions {
	/** Scan person notes for place strings */
	scanPersonNotes: boolean;
	/** Scan event notes for place strings */
	scanEventNotes: boolean;
	/** Update references to use wikilinks after creation */
	updateReferences: boolean;
	/** Parse place hierarchy (create parent places) */
	parseHierarchy: boolean;
	/** Folder for new place notes */
	placesFolder: string;
	/** Dry run - don't actually create/modify files */
	dryRun: boolean;
}

/**
 * A place string found in the vault
 */
export interface FoundPlace {
	/** The raw place string */
	placeString: string;
	/** Normalized version for comparison */
	normalizedString: string;
	/** Hierarchy parts (most specific first) */
	hierarchyParts: string[];
	/** Files referencing this place */
	referencingFiles: TFile[];
	/** Properties where this place was found */
	properties: string[];
}

/**
 * Information about a place note (created or existing)
 */
export interface PlaceNoteInfo {
	path: string;
	crId: string;
	name: string;
	isNew: boolean;
}

/**
 * Result of place generation
 */
export interface PlaceGeneratorResult {
	/** Total place strings found */
	placesFound: number;
	/** Place notes created */
	notesCreated: number;
	/** Existing place notes that were matched */
	existingMatched: number;
	/** References updated to wikilinks */
	referencesUpdated: number;
	/** Files modified */
	filesModified: number;
	/** Errors encountered */
	errors: Array<{ place: string; error: string }>;
	/** Details of found places (for preview) */
	foundPlaces: FoundPlace[];
	/** Created/matched place notes (for summary) */
	placeNotes: PlaceNoteInfo[];
}

/**
 * Result of generating a single place
 */
export interface SinglePlaceResult {
	success: boolean;
	error?: string;
	noteInfo?: PlaceNoteInfo;
}

/**
 * Default options for place generation
 */
export const DEFAULT_PLACE_GENERATOR_OPTIONS: PlaceGeneratorOptions = {
	scanPersonNotes: true,
	scanEventNotes: true,
	updateReferences: true,
	parseHierarchy: true,
	placesFolder: 'Canvas Roots/Places',
	dryRun: true
};

/**
 * US State abbreviation to full name mapping
 */
const US_STATE_ABBREVIATIONS: Record<string, string> = {
	'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
	'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
	'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
	'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
	'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
	'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
	'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
	'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
	'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
	'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
	'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
	'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
	'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
};

/**
 * Place Generator Service
 */
export class PlaceGeneratorService {
	private app: App;
	private settings: CanvasRootsSettings;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Preview place generation (dry run)
	 */
	async preview(options: Partial<PlaceGeneratorOptions> = {}): Promise<PlaceGeneratorResult> {
		const fullOptions: PlaceGeneratorOptions = {
			...DEFAULT_PLACE_GENERATOR_OPTIONS,
			placesFolder: this.settings.placesFolder || DEFAULT_PLACE_GENERATOR_OPTIONS.placesFolder,
			...options,
			dryRun: true
		};
		return this.generate(fullOptions);
	}

	/**
	 * Generate place notes
	 */
	async generate(options: Partial<PlaceGeneratorOptions> = {}): Promise<PlaceGeneratorResult> {
		const fullOptions: PlaceGeneratorOptions = {
			...DEFAULT_PLACE_GENERATOR_OPTIONS,
			placesFolder: this.settings.placesFolder || DEFAULT_PLACE_GENERATOR_OPTIONS.placesFolder,
			...options
		};

		const result: PlaceGeneratorResult = {
			placesFound: 0,
			notesCreated: 0,
			existingMatched: 0,
			referencesUpdated: 0,
			filesModified: 0,
			errors: [],
			foundPlaces: [],
			placeNotes: []
		};

		try {
			// Step 1: Scan for place strings
			const placeMap = await this.scanForPlaces(fullOptions);
			result.placesFound = placeMap.size;
			result.foundPlaces = Array.from(placeMap.values());

			if (fullOptions.dryRun) {
				// For preview, also check which places would be new vs existing
				const existingPlaces = await this.buildExistingPlaceCache();
				for (const place of result.foundPlaces) {
					const existingFile = this.findExistingPlace(place.normalizedString, existingPlaces);
					if (existingFile) {
						result.existingMatched++;
					} else {
						result.notesCreated++;
					}
				}
				// Count references that would be updated
				for (const place of result.foundPlaces) {
					result.referencesUpdated += place.referencingFiles.length;
				}
				return result;
			}

			// Step 2: Build existing place cache
			const existingPlaces = await this.buildExistingPlaceCache();

			// Step 3: Create place notes (hierarchy order - most general first)
			const placeToNoteInfo = new Map<string, PlaceNoteInfo>();
			const sortedPlaces = this.sortByHierarchyDepth(result.foundPlaces);

			for (const place of sortedPlaces) {
				try {
					const noteInfo = await this.createOrMatchPlaceNote(
						place,
						existingPlaces,
						placeToNoteInfo,
						fullOptions
					);
					placeToNoteInfo.set(place.normalizedString, noteInfo);
					result.placeNotes.push(noteInfo);

					if (noteInfo.isNew) {
						result.notesCreated++;
					} else {
						result.existingMatched++;
					}
				} catch (error) {
					result.errors.push({
						place: place.placeString,
						error: error instanceof Error ? error.message : String(error)
					});
				}
			}

			// Step 4: Update references to use wikilinks
			if (fullOptions.updateReferences) {
				const modifiedFiles = new Set<string>();
				for (const place of result.foundPlaces) {
					const noteInfo = placeToNoteInfo.get(place.normalizedString);
					if (!noteInfo) continue;

					for (const file of place.referencingFiles) {
						try {
							const updated = await this.updatePlaceReference(
								file,
								place,
								noteInfo
							);
							if (updated) {
								result.referencesUpdated++;
								modifiedFiles.add(file.path);
							}
						} catch (error) {
							result.errors.push({
								place: place.placeString,
								error: `Failed to update ${file.path}: ${error instanceof Error ? error.message : String(error)}`
							});
						}
					}
				}
				result.filesModified = modifiedFiles.size;
			}

			logger.info('generate', 'Place generation complete', {
				found: result.placesFound,
				created: result.notesCreated,
				matched: result.existingMatched,
				updated: result.referencesUpdated
			});

		} catch (error) {
			logger.error('generate', 'Place generation failed', { error });
			result.errors.push({
				place: 'general',
				error: error instanceof Error ? error.message : String(error)
			});
		}

		return result;
	}

	/**
	 * Generate a single place note (and optionally update references)
	 */
	async generateSinglePlace(
		place: FoundPlace,
		options: Partial<PlaceGeneratorOptions> = {}
	): Promise<SinglePlaceResult> {
		const fullOptions: PlaceGeneratorOptions = {
			...DEFAULT_PLACE_GENERATOR_OPTIONS,
			placesFolder: this.settings.placesFolder || DEFAULT_PLACE_GENERATOR_OPTIONS.placesFolder,
			...options,
			dryRun: false // Never dry run for single place generation
		};

		try {
			// Build existing place cache
			const existingPlaces = await this.buildExistingPlaceCache();

			// Check if place already exists
			const existingFile = this.findExistingPlace(place.normalizedString, existingPlaces);
			if (existingFile) {
				const fileCache = this.app.metadataCache.getFileCache(existingFile);
				const crId = fileCache?.frontmatter?.cr_id || generateCrId();
				return {
					success: true,
					noteInfo: {
						path: existingFile.path,
						crId,
						name: place.hierarchyParts[0],
						isNew: false
					}
				};
			}

			// For hierarchy support, we need to create parents first
			const placeToNoteInfo = new Map<string, PlaceNoteInfo>();

			if (fullOptions.parseHierarchy && place.hierarchyParts.length > 1) {
				// Create parent places first (from most general to more specific)
				for (let i = place.hierarchyParts.length - 1; i > 0; i--) {
					const parentParts = place.hierarchyParts.slice(i);
					const parentString = parentParts.join(', ');

					// Check if parent already exists or was already created
					if (placeToNoteInfo.has(parentString)) continue;
					const existingParent = this.findExistingPlace(parentString, existingPlaces);
					if (existingParent) {
						const fileCache = this.app.metadataCache.getFileCache(existingParent);
						const crId = fileCache?.frontmatter?.cr_id || generateCrId();
						placeToNoteInfo.set(parentString, {
							path: existingParent.path,
							crId,
							name: parentParts[0],
							isNew: false
						});
						continue;
					}

					// Create parent place
					const parentPlace: FoundPlace = {
						placeString: parentString,
						normalizedString: parentString,
						hierarchyParts: parentParts,
						referencingFiles: [],
						properties: []
					};

					const parentNoteInfo = await this.createOrMatchPlaceNote(
						parentPlace,
						existingPlaces,
						placeToNoteInfo,
						fullOptions
					);
					placeToNoteInfo.set(parentString, parentNoteInfo);
				}
			}

			// Create the place note
			const noteInfo = await this.createOrMatchPlaceNote(
				place,
				existingPlaces,
				placeToNoteInfo,
				fullOptions
			);

			// Update references if enabled
			if (fullOptions.updateReferences && place.referencingFiles.length > 0) {
				for (const file of place.referencingFiles) {
					try {
						await this.updatePlaceReference(file, place, noteInfo);
					} catch (error) {
						logger.warn('generateSinglePlace', 'Failed to update reference', {
							file: file.path,
							error
						});
					}
				}
			}

			logger.info('generateSinglePlace', 'Place note created', {
				name: noteInfo.name,
				path: noteInfo.path
			});

			return {
				success: true,
				noteInfo
			};
		} catch (error) {
			logger.error('generateSinglePlace', 'Failed to create place note', { error });
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	/**
	 * Scan for place strings in person and event notes
	 */
	private async scanForPlaces(options: PlaceGeneratorOptions): Promise<Map<string, FoundPlace>> {
		const placeMap = new Map<string, FoundPlace>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;

			// Check person notes
			if (options.scanPersonNotes && isPersonNote(fm, cache)) {
				this.extractPlaceFromProperty(file, fm, 'birth_place', placeMap, options);
				this.extractPlaceFromProperty(file, fm, 'death_place', placeMap, options);
				// Also check legacy camelCase properties
				this.extractPlaceFromProperty(file, fm, 'birthPlace', placeMap, options);
				this.extractPlaceFromProperty(file, fm, 'deathPlace', placeMap, options);
			}

			// Check event notes
			if (options.scanEventNotes && isEventNote(fm, cache)) {
				this.extractPlaceFromProperty(file, fm, 'place', placeMap, options);
			}
		}

		return placeMap;
	}

	/**
	 * Extract place string from a property if it's not already a wikilink
	 */
	private extractPlaceFromProperty(
		file: TFile,
		frontmatter: Record<string, unknown>,
		property: string,
		placeMap: Map<string, FoundPlace>,
		options: PlaceGeneratorOptions
	): void {
		const value = frontmatter[property];
		if (typeof value !== 'string' || !value.trim()) return;

		// Skip if already a wikilink
		if (isWikilink(value)) return;

		const normalizedString = this.normalizePlaceString(value);
		if (!normalizedString) return;

		const hierarchyParts = options.parseHierarchy
			? this.parsePlaceHierarchy(normalizedString)
			: [normalizedString];

		if (hierarchyParts.length === 0) return;

		// Add the full place
		this.addPlaceToMap(placeMap, value, normalizedString, hierarchyParts, file, property);

		// Add parent places if hierarchy parsing is enabled
		if (options.parseHierarchy && hierarchyParts.length > 1) {
			for (let i = 1; i < hierarchyParts.length; i++) {
				const parentString = hierarchyParts.slice(i).join(', ');
				const parentParts = hierarchyParts.slice(i);
				// Parent places don't have referencing files - they're created for hierarchy
				this.addPlaceToMap(placeMap, parentString, parentString, parentParts, null, null);
			}
		}
	}

	/**
	 * Add a place to the map, merging with existing entry if present
	 */
	private addPlaceToMap(
		placeMap: Map<string, FoundPlace>,
		placeString: string,
		normalizedString: string,
		hierarchyParts: string[],
		file: TFile | null,
		property: string | null
	): void {
		const existing = placeMap.get(normalizedString);
		if (existing) {
			if (file && !existing.referencingFiles.includes(file)) {
				existing.referencingFiles.push(file);
			}
			if (property && !existing.properties.includes(property)) {
				existing.properties.push(property);
			}
		} else {
			placeMap.set(normalizedString, {
				placeString,
				normalizedString,
				hierarchyParts,
				referencingFiles: file ? [file] : [],
				properties: property ? [property] : []
			});
		}
	}

	/**
	 * Normalize a place string for consistent comparison
	 */
	private normalizePlaceString(placeString: string): string {
		if (!placeString) return '';

		let normalized = placeString.trim();

		// Expand US state abbreviations (2-letter codes at end of string)
		const parts = normalized.split(',').map(p => p.trim());
		if (parts.length >= 2) {
			const lastPart = parts[parts.length - 1].toUpperCase();
			const secondLastPart = parts.length >= 3 ? parts[parts.length - 2].toUpperCase() : '';

			// Check if last part is a US state abbreviation
			if (US_STATE_ABBREVIATIONS[lastPart]) {
				parts[parts.length - 1] = US_STATE_ABBREVIATIONS[lastPart];
			}
			// Check if second-to-last is state and last is "USA" or "US"
			else if ((lastPart === 'USA' || lastPart === 'US') && US_STATE_ABBREVIATIONS[secondLastPart]) {
				parts[parts.length - 2] = US_STATE_ABBREVIATIONS[secondLastPart];
			}
		}

		// Rejoin and normalize whitespace
		normalized = parts.join(', ').replace(/\s+/g, ' ').trim();

		return normalized;
	}

	/**
	 * Parse a place string into hierarchy parts (most specific first)
	 */
	private parsePlaceHierarchy(placeString: string): string[] {
		if (!placeString) return [];

		return placeString
			.split(',')
			.map(p => p.trim())
			.filter(p => p.length > 0);
	}

	/**
	 * Sort places by hierarchy depth (fewest parts first = most general)
	 */
	private sortByHierarchyDepth(places: FoundPlace[]): FoundPlace[] {
		return [...places].sort((a, b) => a.hierarchyParts.length - b.hierarchyParts.length);
	}

	/**
	 * Build a cache of existing place notes for fast lookup
	 */
	private async buildExistingPlaceCache(): Promise<Map<string, TFile>> {
		const cache = new Map<string, TFile>();
		const placeNotes = findAllPlaceNotes(this.app);

		for (const file of placeNotes) {
			const fileCache = this.app.metadataCache.getFileCache(file);
			if (!fileCache?.frontmatter) continue;

			const fm = fileCache.frontmatter;

			// Index by full_name (normalized)
			if (fm.full_name) {
				const normalized = this.normalizePlaceString(String(fm.full_name)).toLowerCase();
				if (normalized) {
					cache.set(normalized, file);
				}
			}

			// Index by name (normalized)
			if (fm.name) {
				const normalized = this.normalizePlaceString(String(fm.name)).toLowerCase();
				if (normalized && !cache.has(normalized)) {
					cache.set(normalized, file);
				}
			}

			// Index by filename (without extension)
			const baseName = file.basename.toLowerCase();
			if (!cache.has(baseName)) {
				cache.set(baseName, file);
			}
		}

		return cache;
	}

	/**
	 * Find an existing place note matching a place string
	 */
	private findExistingPlace(normalizedString: string, cache: Map<string, TFile>): TFile | null {
		// Try exact match on normalized string
		const exact = cache.get(normalizedString.toLowerCase());
		if (exact) return exact;

		// Try matching just the first part (locality name)
		const parts = this.parsePlaceHierarchy(normalizedString);
		if (parts.length > 0) {
			const localityMatch = cache.get(parts[0].toLowerCase());
			if (localityMatch) return localityMatch;
		}

		return null;
	}

	/**
	 * Create or match a place note
	 */
	private async createOrMatchPlaceNote(
		place: FoundPlace,
		existingCache: Map<string, TFile>,
		placeToNoteInfo: Map<string, PlaceNoteInfo>,
		options: PlaceGeneratorOptions
	): Promise<PlaceNoteInfo> {
		// Check if place already exists
		const existingFile = this.findExistingPlace(place.normalizedString, existingCache);
		if (existingFile) {
			const fileCache = this.app.metadataCache.getFileCache(existingFile);
			const crId = fileCache?.frontmatter?.cr_id || generateCrId();
			return {
				path: existingFile.path,
				crId,
				name: place.hierarchyParts[0],
				isNew: false
			};
		}

		// Create new place note
		const crId = generateCrId();
		const name = place.hierarchyParts[0];

		// Get parent info if hierarchy parsing is enabled
		let parentPlace: string | undefined;
		let parentPlaceId: string | undefined;
		if (options.parseHierarchy && place.hierarchyParts.length > 1) {
			const parentString = place.hierarchyParts.slice(1).join(', ');
			const parentInfo = placeToNoteInfo.get(parentString);
			if (parentInfo) {
				parentPlace = parentInfo.name;
				parentPlaceId = parentInfo.crId;
			}
		}

		const placeData: PlaceData = {
			name,
			crId,
			parentPlace,
			parentPlaceId,
			placeCategory: 'real',
			placeType: this.inferPlaceType(name, place.hierarchyParts)
		};

		// Ensure folder exists
		const folder = this.app.vault.getAbstractFileByPath(options.placesFolder);
		if (!folder) {
			await this.app.vault.createFolder(options.placesFolder);
		}

		const file = await createPlaceNote(this.app, placeData, {
			directory: options.placesFolder,
			openAfterCreate: false
		});

		// Add full_name to the created note
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			fm.full_name = place.normalizedString;
		});

		// Add to existing cache for subsequent lookups
		existingCache.set(place.normalizedString.toLowerCase(), file);

		return {
			path: file.path,
			crId,
			name,
			isNew: true
		};
	}

	/**
	 * Infer place type from name and hierarchy
	 */
	private inferPlaceType(name: string, parts: string[]): string {
		const nameLower = name.toLowerCase();
		const depth = parts.length;

		// Common suffixes
		if (nameLower.includes('county') || nameLower.includes('parish')) return 'county';
		if (nameLower.includes('township') || nameLower.includes('twp')) return 'township';
		if (nameLower.includes('city')) return 'city';
		if (nameLower.includes('village')) return 'village';
		if (nameLower.includes('town')) return 'town';
		if (nameLower.includes('state') || nameLower.includes('province')) return 'state';

		// Infer from hierarchy depth (typical US pattern: locality, county, state, country)
		if (depth === 1) return 'country';
		if (depth === 2) return 'state';
		if (depth === 3) return 'county';
		if (depth >= 4) return 'locality';

		return 'unknown';
	}

	/**
	 * Update a place reference in a file to use a wikilink
	 */
	private async updatePlaceReference(
		file: TFile,
		place: FoundPlace,
		noteInfo: PlaceNoteInfo
	): Promise<boolean> {
		let updated = false;

		await this.app.fileManager.processFrontMatter(file, (fm) => {
			for (const property of place.properties) {
				const currentValue = fm[property];
				if (typeof currentValue === 'string' && !isWikilink(currentValue)) {
					// Check if this is the place we're looking for
					const normalized = this.normalizePlaceString(currentValue);
					if (normalized === place.normalizedString) {
						fm[property] = `[[${noteInfo.name}]]`;
						updated = true;
					}
				}
			}
		});

		return updated;
	}
}
