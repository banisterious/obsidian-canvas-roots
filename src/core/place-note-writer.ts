/**
 * Place note writer utilities for Canvas Roots
 * Creates place notes with proper YAML frontmatter
 */

import { App, TFile, normalizePath } from 'obsidian';
import { generateCrId } from './uuid';
import { getLogger } from './logging';
import {
	PlaceCategory,
	PlaceType,
	GeoCoordinates,
	CustomCoordinates,
	HistoricalName,
	DEFAULT_PLACE_CATEGORY
} from '../models/place';

const logger = getLogger('PlaceNoteWriter');

/**
 * Place data for note creation
 */
export interface PlaceData {
	name: string;
	crId?: string;
	aliases?: string[];
	placeCategory?: PlaceCategory;
	placeType?: PlaceType;
	universe?: string;
	parentPlace?: string;      // Wikilink or name for display
	parentPlaceId?: string;    // Parent's cr_id for reliable resolution
	coordinates?: GeoCoordinates;
	customCoordinates?: CustomCoordinates;
	historicalNames?: HistoricalName[];
	collection?: string;       // User-defined collection/grouping
}

/**
 * Options for place note creation
 */
export interface CreatePlaceNoteOptions {
	/** Directory path where place notes are stored (default: root) */
	directory?: string;
	/** Whether to open the note after creation (default: false) */
	openAfterCreate?: boolean;
}

/**
 * Create a place note with YAML frontmatter
 *
 * @param app - Obsidian app instance
 * @param place - Place data
 * @param options - Creation options
 * @returns The created TFile
 *
 * @example
 * const file = await createPlaceNote(app, {
 *   name: "London",
 *   placeCategory: "real",
 *   placeType: "city",
 *   parentPlace: "[[England]]",
 *   coordinates: { lat: 51.5074, long: -0.1278 }
 * }, {
 *   directory: "Places",
 *   openAfterCreate: true
 * });
 */
export async function createPlaceNote(
	app: App,
	place: PlaceData,
	options: CreatePlaceNoteOptions = {}
): Promise<TFile> {
	const { directory = '', openAfterCreate = false } = options;

	// Generate cr_id if not provided
	const crId = place.crId || generateCrId();

	// Build frontmatter
	const frontmatter: Record<string, unknown> = {
		type: 'place',
		cr_id: crId,
		name: place.name || ''
	};

	// Aliases
	if (place.aliases && place.aliases.length > 0) {
		frontmatter.aliases = place.aliases;
	}

	// Category (only include if not default)
	if (place.placeCategory && place.placeCategory !== DEFAULT_PLACE_CATEGORY) {
		frontmatter.place_category = place.placeCategory;
	}

	// Place type
	if (place.placeType) {
		frontmatter.place_type = place.placeType;
	}

	// Universe (only for fictional/mythological/legendary places)
	if (place.universe && isUniverseApplicable(place.placeCategory)) {
		frontmatter.universe = place.universe;
	}

	// Parent place (dual storage)
	if (place.parentPlaceId && place.parentPlace) {
		frontmatter.parent_place = formatWikilink(place.parentPlace);
		frontmatter.parent_place_id = place.parentPlaceId;
	} else if (place.parentPlaceId) {
		frontmatter.parent_place_id = place.parentPlaceId;
	} else if (place.parentPlace) {
		frontmatter.parent_place = formatWikilink(place.parentPlace);
	}

	// Coordinates (only for real/historical/disputed places)
	if (place.coordinates && isCoordinatesApplicable(place.placeCategory)) {
		frontmatter.coordinates = {
			lat: place.coordinates.lat,
			long: place.coordinates.long
		};
	}

	// Custom coordinates (applicable to all place types)
	if (place.customCoordinates) {
		const customCoords: Record<string, unknown> = {
			x: place.customCoordinates.x,
			y: place.customCoordinates.y
		};
		if (place.customCoordinates.map) {
			customCoords.map = place.customCoordinates.map;
		}
		frontmatter.custom_coordinates = customCoords;
	}

	// Historical names
	if (place.historicalNames && place.historicalNames.length > 0) {
		frontmatter.historical_names = place.historicalNames.map(hn => {
			const entry: Record<string, string> = { name: hn.name };
			if (hn.period) {
				entry.period = hn.period;
			}
			return entry;
		});
	}

	// Collection (user-defined grouping)
	if (place.collection) {
		frontmatter.collection = place.collection;
	}

	logger.debug('frontmatter', `Final: ${JSON.stringify(frontmatter)}`);

	// Build YAML frontmatter string
	const yamlContent = buildYamlFrontmatter(frontmatter);

	// Build note content
	const noteContent = [
		yamlContent,
		'',
		`# ${place.name}`,
		'',
		'',
		''
	].join('\n');

	// Sanitize filename (remove invalid characters)
	const filename = sanitizeFilename(place.name || 'Untitled Place');

	// Build full path
	const fullPath = directory
		? normalizePath(`${directory}/${filename}.md`)
		: normalizePath(`${filename}.md`);

	// Check if file already exists
	let finalPath = fullPath;
	let counter = 1;
	while (app.vault.getAbstractFileByPath(finalPath)) {
		const baseName = filename;
		const newFilename = `${baseName} ${counter}`;
		finalPath = directory
			? normalizePath(`${directory}/${newFilename}.md`)
			: normalizePath(`${newFilename}.md`);
		counter++;
	}

	// Create the file
	const file = await app.vault.create(finalPath, noteContent);
	logger.info('create', `Created place note: ${finalPath}`);

	// Open the file if requested
	if (openAfterCreate) {
		const leaf = app.workspace.getLeaf(false);
		await leaf.openFile(file);
	}

	return file;
}

/**
 * Update an existing place note's frontmatter
 *
 * @param app - Obsidian app instance
 * @param file - The place note file to update
 * @param updates - Partial place data to update
 */
export async function updatePlaceNote(
	app: App,
	file: TFile,
	updates: Partial<PlaceData>
): Promise<void> {
	const content = await app.vault.read(file);

	// Parse existing frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		logger.warn('update', `No frontmatter found in: ${file.path}`);
		return;
	}

	const bodyContent = content.substring(frontmatterMatch[0].length);

	// Get current frontmatter from cache
	const cache = app.metadataCache.getFileCache(file);
	const currentFrontmatter = cache?.frontmatter || {};

	// Apply updates
	const newFrontmatter: Record<string, unknown> = { ...currentFrontmatter };

	if (updates.name !== undefined) {
		newFrontmatter.name = updates.name;
	}
	if (updates.aliases !== undefined) {
		newFrontmatter.aliases = updates.aliases;
	}
	if (updates.placeCategory !== undefined) {
		if (updates.placeCategory === DEFAULT_PLACE_CATEGORY) {
			delete newFrontmatter.place_category;
		} else {
			newFrontmatter.place_category = updates.placeCategory;
		}
	}
	if (updates.placeType !== undefined) {
		newFrontmatter.place_type = updates.placeType;
	}
	if (updates.universe !== undefined) {
		if (updates.universe && isUniverseApplicable(updates.placeCategory || currentFrontmatter.place_category)) {
			newFrontmatter.universe = updates.universe;
		} else {
			delete newFrontmatter.universe;
		}
	}
	if (updates.parentPlace !== undefined) {
		newFrontmatter.parent_place = formatWikilink(updates.parentPlace);
	}
	if (updates.parentPlaceId !== undefined) {
		newFrontmatter.parent_place_id = updates.parentPlaceId;
	}
	if (updates.coordinates !== undefined) {
		newFrontmatter.coordinates = updates.coordinates;
	}
	if (updates.customCoordinates !== undefined) {
		newFrontmatter.custom_coordinates = updates.customCoordinates;
	}
	if (updates.historicalNames !== undefined) {
		newFrontmatter.historical_names = updates.historicalNames;
	}

	// Remove Obsidian metadata properties that shouldn't be in YAML output
	delete newFrontmatter.position;

	// Build new content
	const yamlContent = buildYamlFrontmatter(newFrontmatter);
	const newContent = yamlContent + bodyContent;

	await app.vault.modify(file, newContent);
	logger.info('update', `Updated place note: ${file.path}`);
}

/**
 * Find a place note by cr_id
 *
 * @param app - Obsidian app instance
 * @param crId - The place's cr_id
 * @param directory - Optional directory to limit search
 * @returns The TFile if found, null otherwise
 */
export async function findPlaceNoteByCrId(
	app: App,
	crId: string,
	directory?: string
): Promise<TFile | null> {
	const files = app.vault.getMarkdownFiles();

	for (const file of files) {
		// Filter by directory if specified
		if (directory && !file.path.startsWith(directory)) {
			continue;
		}

		const cache = app.metadataCache.getFileCache(file);
		if (cache?.frontmatter?.type === 'place' && cache.frontmatter.cr_id === crId) {
			return file;
		}
	}

	return null;
}

/**
 * Find all place notes in the vault
 *
 * @param app - Obsidian app instance
 * @param directory - Optional directory to limit search
 * @returns Array of place note files
 */
export function findAllPlaceNotes(
	app: App,
	directory?: string
): TFile[] {
	const files = app.vault.getMarkdownFiles();
	const placeNotes: TFile[] = [];

	for (const file of files) {
		// Filter by directory if specified
		if (directory && !file.path.startsWith(directory)) {
			continue;
		}

		const cache = app.metadataCache.getFileCache(file);
		if (cache?.frontmatter?.type === 'place') {
			placeNotes.push(file);
		}
	}

	return placeNotes;
}

/**
 * Check if universe field is applicable for a place category
 */
function isUniverseApplicable(category?: PlaceCategory): boolean {
	if (!category) return false;
	return ['fictional', 'mythological', 'legendary'].includes(category);
}

/**
 * Check if real-world coordinates are applicable for a place category
 */
function isCoordinatesApplicable(category?: PlaceCategory): boolean {
	// Default category is 'real', so if not specified, coordinates are applicable
	if (!category) return true;
	return ['real', 'historical', 'disputed'].includes(category);
}

/**
 * Format a value as a wikilink if it isn't already
 */
function formatWikilink(value: string): string {
	// Already a wikilink
	if (value.startsWith('[[') && value.endsWith(']]')) {
		return `"${value}"`;
	}
	// Plain text - convert to wikilink
	return `"[[${value}]]"`;
}

/**
 * Build YAML frontmatter string from an object
 */
function buildYamlFrontmatter(frontmatter: Record<string, unknown>): string {
	const lines: string[] = ['---'];

	for (const [key, value] of Object.entries(frontmatter)) {
		if (value === undefined || value === null) continue;

		if (Array.isArray(value)) {
			if (value.length === 0) continue;

			lines.push(`${key}:`);
			for (const item of value) {
				if (typeof item === 'object' && item !== null) {
					// Object in array (e.g., historical_names)
					const objLines = formatObjectForYaml(item as Record<string, unknown>, 4);
					lines.push(`  - ${objLines[0]}`);
					for (let i = 1; i < objLines.length; i++) {
						lines.push(`    ${objLines[i]}`);
					}
				} else {
					lines.push(`  - ${item}`);
				}
			}
		} else if (typeof value === 'object' && value !== null) {
			// Nested object (e.g., coordinates)
			lines.push(`${key}:`);
			const objLines = formatObjectForYaml(value as Record<string, unknown>, 2);
			for (const line of objLines) {
				lines.push(`  ${line}`);
			}
		} else if (typeof value === 'string' && value.includes('\n')) {
			// Multiline string
			lines.push(`${key}: |`);
			for (const line of value.split('\n')) {
				lines.push(`  ${line}`);
			}
		} else {
			lines.push(`${key}: ${value}`);
		}
	}

	lines.push('---');
	return lines.join('\n');
}

/**
 * Format an object for YAML output
 */
function formatObjectForYaml(obj: Record<string, unknown>, indent: number = 0): string[] {
	const lines: string[] = [];
	const entries = Object.entries(obj);

	for (let i = 0; i < entries.length; i++) {
		const [key, value] = entries[i];
		if (value === undefined || value === null) continue;

		if (i === 0 && indent > 0) {
			// First property on same line as array dash
			lines.push(`${key}: ${value}`);
		} else {
			lines.push(`${key}: ${value}`);
		}
	}

	return lines;
}

/**
 * Sanitize a filename by removing invalid characters
 */
function sanitizeFilename(filename: string): string {
	return filename
		.replace(/[\\/:*?"<>|]/g, '-')
		.replace(/\s+/g, ' ')
		.trim();
}
