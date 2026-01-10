/**
 * Place note writer utilities for Charted Roots
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
import { isPlaceNote } from '../utils/note-type-detection';

const logger = getLogger('PlaceNoteWriter');

/**
 * Get the property name to write, respecting aliases
 * If user has an alias for this canonical property, return the user's property name
 */
function getWriteProperty(canonical: string, aliases: Record<string, string>): string {
	for (const [userProp, canonicalProp] of Object.entries(aliases)) {
		if (canonicalProp === canonical) {
			return userProp;
		}
	}
	return canonical;
}

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
	media?: string[];          // Wikilinks to media files
	notesContent?: string;     // Markdown notes content to append
	private?: boolean;         // Privacy flag (if any attached note is private)
}

/**
 * Options for place note creation
 */
export interface CreatePlaceNoteOptions {
	/** Directory path where place notes are stored (default: root) */
	directory?: string;
	/** Whether to open the note after creation (default: false) */
	openAfterCreate?: boolean;
	/** Property aliases for writing custom property names (user property → canonical) */
	propertyAliases?: Record<string, string>;
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
	const { directory = '', openAfterCreate = false, propertyAliases = {} } = options;

	// Helper to get aliased property name
	const prop = (canonical: string) => getWriteProperty(canonical, propertyAliases);

	// Generate cr_id if not provided
	const crId = place.crId || generateCrId();

	// Sanitize name - strip wikilink brackets if present
	const cleanName = stripWikilinkBrackets(place.name || '');

	// Build frontmatter with aliased property names
	const frontmatter: Record<string, unknown> = {
		[prop('cr_type')]: 'place',
		[prop('cr_id')]: crId,
		[prop('name')]: cleanName
	};

	// Aliases
	if (place.aliases && place.aliases.length > 0) {
		frontmatter.aliases = place.aliases;
	}

	// Category (only include if not default)
	if (place.placeCategory && place.placeCategory !== DEFAULT_PLACE_CATEGORY) {
		frontmatter[prop('place_category')] = place.placeCategory;
	}

	// Place type
	if (place.placeType) {
		frontmatter[prop('place_type')] = place.placeType;
	}

	// Universe (only for fictional/mythological/legendary places)
	if (place.universe && isUniverseApplicable(place.placeCategory)) {
		frontmatter[prop('universe')] = place.universe;
	}

	// Parent place (dual storage)
	if (place.parentPlaceId && place.parentPlace) {
		frontmatter[prop('parent_place')] = createSmartWikilink(place.parentPlace, app);
		frontmatter.parent_place_id = place.parentPlaceId;
	} else if (place.parentPlaceId) {
		frontmatter.parent_place_id = place.parentPlaceId;
	} else if (place.parentPlace) {
		frontmatter[prop('parent_place')] = createSmartWikilink(place.parentPlace, app);
	}

	// Coordinates (only for real/historical/disputed places) - flat properties
	if (place.coordinates && isCoordinatesApplicable(place.placeCategory)) {
		frontmatter.coordinates_lat = place.coordinates.lat;
		frontmatter.coordinates_long = place.coordinates.long;
	}

	// Custom coordinates (applicable to all place types) - flat properties
	if (place.customCoordinates) {
		frontmatter.custom_coordinates_x = place.customCoordinates.x;
		frontmatter.custom_coordinates_y = place.customCoordinates.y;
		if (place.customCoordinates.map) {
			frontmatter.custom_coordinates_map = place.customCoordinates.map;
		}
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
		frontmatter[prop('collection')] = place.collection;
	}

	// Media references
	if (place.media && place.media.length > 0) {
		frontmatter[prop('media')] = place.media;
	}

	// Privacy flag (if any attached note is private)
	if (place.private) {
		frontmatter[prop('private')] = true;
	}

	logger.debug('frontmatter', `Final: ${JSON.stringify(frontmatter)}`);

	// Build YAML frontmatter string
	const yamlContent = buildYamlFrontmatter(frontmatter);

	// Build note content with optional notes section
	const contentParts = [
		yamlContent,
		'',
		`# ${cleanName}`,
		'',
		''
	];

	// Append notes content if provided
	if (place.notesContent) {
		contentParts.push(place.notesContent);
	}

	contentParts.push('');
	const noteContent = contentParts.join('\n');

	// Sanitize filename (remove invalid characters)
	const filename = sanitizeFilename(cleanName || 'Untitled Place');

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
		newFrontmatter.parent_place = createSmartWikilink(updates.parentPlace, app);
	}
	if (updates.parentPlaceId !== undefined) {
		newFrontmatter.parent_place_id = updates.parentPlaceId;
	}
	if (updates.coordinates !== undefined) {
		// Remove any legacy nested coordinates
		delete newFrontmatter.coordinates;
		// Write flat properties
		if (updates.coordinates) {
			newFrontmatter.coordinates_lat = updates.coordinates.lat;
			newFrontmatter.coordinates_long = updates.coordinates.long;
		} else {
			delete newFrontmatter.coordinates_lat;
			delete newFrontmatter.coordinates_long;
		}
	}
	if (updates.customCoordinates !== undefined) {
		// Remove any legacy nested custom_coordinates
		delete newFrontmatter.custom_coordinates;
		// Write flat properties
		if (updates.customCoordinates) {
			newFrontmatter.custom_coordinates_x = updates.customCoordinates.x;
			newFrontmatter.custom_coordinates_y = updates.customCoordinates.y;
			if (updates.customCoordinates.map) {
				newFrontmatter.custom_coordinates_map = updates.customCoordinates.map;
			} else {
				delete newFrontmatter.custom_coordinates_map;
			}
		} else {
			delete newFrontmatter.custom_coordinates_x;
			delete newFrontmatter.custom_coordinates_y;
			delete newFrontmatter.custom_coordinates_map;
		}
	}
	if (updates.historicalNames !== undefined) {
		newFrontmatter.historical_names = updates.historicalNames;
	}
	if (updates.collection !== undefined) {
		if (updates.collection) {
			newFrontmatter.collection = updates.collection;
		} else {
			delete newFrontmatter.collection;
		}
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
export function findPlaceNoteByCrId(
	app: App,
	crId: string,
	directory?: string
): TFile | null {
	const files = app.vault.getMarkdownFiles();

	for (const file of files) {
		// Filter by directory if specified
		if (directory && !file.path.startsWith(directory)) {
			continue;
		}

		const cache = app.metadataCache.getFileCache(file);
		if (isPlaceNote(cache?.frontmatter, cache) && cache?.frontmatter?.cr_id === crId) {
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
		if (isPlaceNote(cache?.frontmatter, cache)) {
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
 * Create a wikilink with proper handling of duplicate filenames
 * Uses [[basename|name]] format when basename differs from name
 * @param name The display name
 * @param app The Obsidian app instance for file resolution
 */
function createSmartWikilink(name: string, app: App): string {
	// If already a wikilink, quote and return as-is
	if (name.startsWith('[[') && name.endsWith(']]')) {
		return `"${name}"`;
	}

	// Try to resolve the name to a file
	const resolvedFile = app.metadataCache.getFirstLinkpathDest(name, '');
	if (resolvedFile && resolvedFile.basename !== name) {
		return `"[[${resolvedFile.basename}|${name}]]"`;
	}

	// Standard format
	return `"[[${name}]]"`;
}

/**
 * Safely convert a value to string for YAML output
 */
function toYamlValue(value: unknown): string {
	if (typeof value === 'object' && value !== null) {
		return JSON.stringify(value);
	}
	return String(value);
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
			lines.push(`${key}: ${toYamlValue(value)}`);
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
			lines.push(`${key}: ${toYamlValue(value)}`);
		} else {
			lines.push(`${key}: ${toYamlValue(value)}`);
		}
	}

	return lines;
}

/**
 * Strip wikilink brackets from a string if present
 */
function stripWikilinkBrackets(value: string): string {
	return value
		.replace(/^\[\[/, '')
		.replace(/\]\]$/, '');
}

/**
 * Sanitize a filename by removing invalid characters
 */
function sanitizeFilename(filename: string): string {
	return filename
		// Remove filesystem-invalid characters (including brackets)
		.replace(/[\\/:*?"<>|[\]]/g, '-')
		.replace(/\s+/g, ' ')
		.trim();
}
