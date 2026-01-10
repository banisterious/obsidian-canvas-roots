/**
 * Centralized note type detection utility
 *
 * Supports multiple detection methods with configurable priority:
 * 1. cr_type property (namespaced, avoids conflicts with other plugins)
 * 2. type property (legacy/default)
 * 3. Tags (#person, #place, #event, #source, etc.)
 *
 * This allows users to choose their preferred method and avoids conflicts
 * with other plugins that may use the `type` property.
 */

import type { CachedMetadata } from 'obsidian';
import type { NoteTypeDetectionSettings } from '../settings';

// Re-export for convenience
export type { NoteTypeDetectionSettings } from '../settings';

/**
 * Supported note types in Charted Roots
 */
export type NoteType =
	| 'person'
	| 'place'
	| 'event'
	| 'source'
	| 'map'
	| 'organization'
	| 'schema'
	| 'universe'
	| 'proof_summary'
	| 'timeline-export';

/**
 * All recognized note types for validation
 */
export const ALL_NOTE_TYPES: readonly NoteType[] = [
	'person',
	'place',
	'event',
	'source',
	'map',
	'organization',
	'schema',
	'universe',
	'proof_summary',
	'timeline-export'
] as const;

/**
 * Detection method priority options
 */
export type DetectionMethod = 'cr_type' | 'type' | 'tags';

/**
 * Default detection settings
 */
export const DEFAULT_NOTE_TYPE_DETECTION_SETTINGS: NoteTypeDetectionSettings = {
	enableTagDetection: true,
	primaryTypeProperty: 'cr_type' // Namespaced to avoid conflicts with other plugins
};

/**
 * Tag patterns that map to note types
 * Supports nested tags (e.g., #genealogy/person matches 'person')
 */
const TAG_TO_TYPE_MAP: Record<string, NoteType> = {
	'person': 'person',
	'place': 'place',
	'event': 'event',
	'source': 'source',
	'map': 'map',
	'organization': 'organization',
	'schema': 'schema',
	'universe': 'universe',
	'proof-summary': 'proof_summary',
	'proof_summary': 'proof_summary',
	'timeline': 'timeline-export'
};

/**
 * Extract note type from tags
 * Checks for direct tags (#person) and nested tags (#genealogy/person)
 */
function detectTypeFromTags(tags: string[] | undefined): NoteType | null {
	if (!tags || tags.length === 0) {
		return null;
	}

	for (const tag of tags) {
		// Skip non-string tags (can happen with malformed frontmatter)
		if (typeof tag !== 'string') {
			continue;
		}
		// Remove leading # if present
		const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;

		// Check for direct match
		if (cleanTag in TAG_TO_TYPE_MAP) {
			return TAG_TO_TYPE_MAP[cleanTag];
		}

		// Check for nested tag (e.g., #genealogy/person -> person)
		const lastSegment = cleanTag.split('/').pop();
		if (lastSegment && lastSegment in TAG_TO_TYPE_MAP) {
			return TAG_TO_TYPE_MAP[lastSegment];
		}
	}

	return null;
}

/**
 * Validate that a value is a recognized note type
 */
function isValidNoteType(value: unknown): value is NoteType {
	return typeof value === 'string' && ALL_NOTE_TYPES.includes(value as NoteType);
}

/**
 * Detect the note type from frontmatter and/or tags
 *
 * Detection priority (configurable):
 * 1. Primary property (cr_type or type based on settings)
 * 2. Fallback property (the other one)
 * 3. Tags (if enabled)
 *
 * @param frontmatter - The frontmatter object from the note
 * @param cache - Optional CachedMetadata for tag-based detection
 * @param settings - Detection settings (defaults to legacy behavior)
 * @returns The detected note type, or null if not detected
 */
export function detectNoteType(
	frontmatter: Record<string, unknown> | undefined | null,
	cache?: CachedMetadata | null,
	settings?: NoteTypeDetectionSettings | null
): NoteType | null {
	const s = settings ?? DEFAULT_NOTE_TYPE_DETECTION_SETTINGS;
	if (!frontmatter) {
		// If no frontmatter, only check tags
		if (s.enableTagDetection && cache?.tags) {
			const tagNames = cache.tags.map(t => t.tag);
			return detectTypeFromTags(tagNames);
		}
		return null;
	}

	// Determine check order based on primary property setting
	const primary = s.primaryTypeProperty;
	const fallback = primary === 'cr_type' ? 'type' : 'cr_type';

	// Check primary property
	const primaryValue = frontmatter[primary];
	if (isValidNoteType(primaryValue)) {
		return primaryValue;
	}

	// Check fallback property
	const fallbackValue = frontmatter[fallback];
	if (isValidNoteType(fallbackValue)) {
		return fallbackValue;
	}

	// Check tags if enabled
	if (s.enableTagDetection && cache?.tags) {
		const tagNames = cache.tags.map(t => t.tag);
		return detectTypeFromTags(tagNames);
	}

	// Also check frontmatter tags array (some themes/plugins store tags in frontmatter)
	if (s.enableTagDetection && frontmatter.tags) {
		const fmTags = Array.isArray(frontmatter.tags)
			? frontmatter.tags
			: typeof frontmatter.tags === 'string'
				? [frontmatter.tags]
				: [];
		return detectTypeFromTags(fmTags as string[]);
	}

	return null;
}

/**
 * Check if a note is of a specific type
 *
 * @param frontmatter - The frontmatter object from the note
 * @param expectedType - The type to check for
 * @param cache - Optional CachedMetadata for tag-based detection
 * @param settings - Detection settings
 * @returns true if the note matches the expected type
 */
export function isNoteType(
	frontmatter: Record<string, unknown> | undefined | null,
	expectedType: NoteType,
	cache?: CachedMetadata | null,
	settings?: NoteTypeDetectionSettings | null
): boolean {
	return detectNoteType(frontmatter, cache, settings) === expectedType;
}

/**
 * Check if a note has properties that indicate it's a place note
 * (used to exclude from legacy person detection)
 */
function hasPlaceProperties(frontmatter: Record<string, unknown>): boolean {
	return (
		'place_category' in frontmatter ||
		'coordinates' in frontmatter ||
		'coordinates_lat' in frontmatter ||
		'custom_coordinates' in frontmatter ||
		'custom_coordinates_x' in frontmatter ||
		'contained_by' in frontmatter
	);
}

/**
 * Check if a note has properties that indicate it's an event note
 * (used to exclude from legacy person detection)
 */
function hasEventProperties(frontmatter: Record<string, unknown>): boolean {
	return (
		'event_type' in frontmatter ||
		'date_end' in frontmatter ||
		'participants' in frontmatter
	);
}

/**
 * Check if a note has properties that indicate it's a source note
 * (used to exclude from legacy person detection)
 */
function hasSourceProperties(frontmatter: Record<string, unknown>): boolean {
	return (
		'source_type' in frontmatter ||
		'repository' in frontmatter ||
		'citation_template' in frontmatter
	);
}

/**
 * Check if a note is a person note
 */
export function isPersonNote(
	frontmatter: Record<string, unknown> | undefined | null,
	cache?: CachedMetadata | null,
	settings?: NoteTypeDetectionSettings | null
): boolean {
	// Special case: person notes can also be detected by cr_id without explicit type
	// This maintains backwards compatibility with existing vaults
	if (frontmatter?.cr_id && !detectNoteType(frontmatter, cache, settings)) {
		// Has cr_id but no explicit type - check it's not another entity type
		// by looking for distinguishing properties
		if (
			hasPlaceProperties(frontmatter) ||
			hasEventProperties(frontmatter) ||
			hasSourceProperties(frontmatter)
		) {
			return false;
		}
		// Has cr_id, no explicit type, and no other-entity properties - treat as person
		return true;
	}
	return isNoteType(frontmatter, 'person', cache, settings);
}

/**
 * Check if a note is a place note
 */
export function isPlaceNote(
	frontmatter: Record<string, unknown> | undefined | null,
	cache?: CachedMetadata | null,
	settings?: NoteTypeDetectionSettings | null
): boolean {
	return isNoteType(frontmatter, 'place', cache, settings);
}

/**
 * Check if a note is an event note
 */
export function isEventNote(
	frontmatter: Record<string, unknown> | undefined | null,
	cache?: CachedMetadata | null,
	settings?: NoteTypeDetectionSettings | null
): boolean {
	return isNoteType(frontmatter, 'event', cache, settings);
}

/**
 * Check if a note is a source note
 */
export function isSourceNote(
	frontmatter: Record<string, unknown> | undefined | null,
	cache?: CachedMetadata | null,
	settings?: NoteTypeDetectionSettings | null
): boolean {
	return isNoteType(frontmatter, 'source', cache, settings);
}

/**
 * Check if a note is a map note
 */
export function isMapNote(
	frontmatter: Record<string, unknown> | undefined | null,
	cache?: CachedMetadata | null,
	settings?: NoteTypeDetectionSettings | null
): boolean {
	return isNoteType(frontmatter, 'map', cache, settings);
}

/**
 * Check if a note is an organization note
 */
export function isOrganizationNote(
	frontmatter: Record<string, unknown> | undefined | null,
	cache?: CachedMetadata | null,
	settings?: NoteTypeDetectionSettings | null
): boolean {
	return isNoteType(frontmatter, 'organization', cache, settings);
}

/**
 * Check if a note is a schema note
 */
export function isSchemaNote(
	frontmatter: Record<string, unknown> | undefined | null,
	cache?: CachedMetadata | null,
	settings?: NoteTypeDetectionSettings | null
): boolean {
	return isNoteType(frontmatter, 'schema', cache, settings);
}

/**
 * Check if a note is a universe note
 */
export function isUniverseNote(
	frontmatter: Record<string, unknown> | undefined | null,
	cache?: CachedMetadata | null,
	settings?: NoteTypeDetectionSettings | null
): boolean {
	return isNoteType(frontmatter, 'universe', cache, settings);
}

/**
 * Check if a note is a proof summary note
 */
export function isProofSummaryNote(
	frontmatter: Record<string, unknown> | undefined | null,
	cache?: CachedMetadata | null,
	settings?: NoteTypeDetectionSettings | null
): boolean {
	return isNoteType(frontmatter, 'proof_summary', cache, settings);
}
