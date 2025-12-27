/**
 * Wikilink resolver utility
 *
 * Resolves wikilink syntax ([[path/to/file]] or ![[path/to/file]])
 * to actual file paths using Obsidian's metadata cache.
 */

import { TFile } from 'obsidian';
import type { App } from 'obsidian';
import { getLogger } from '../core/logging';

const logger = getLogger('WikilinkResolver');

/**
 * Wikilink pattern - matches [[path]] or ![[path]] with optional display text
 * Groups:
 *   1: The link path (before any pipe for display text)
 */
const WIKILINK_PATTERN = /^!?\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/;

/**
 * Check if a string is in wikilink format
 */
export function isWikilink(value: string): boolean {
	return WIKILINK_PATTERN.test(value.trim());
}

/**
 * Extract the path from a wikilink
 * Returns the original value if not a wikilink
 * Also handles edge cases where quotes may be embedded
 */
export function extractWikilinkPath(value: string): string {
	let trimmed = value.trim();

	// Handle case where YAML parsed [["path"]] as a nested structure
	// which becomes the string "[["path"]]" with embedded quotes
	// Strip outer quotes if present
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		trimmed = trimmed.slice(1, -1);
	}

	const match = trimmed.match(WIKILINK_PATTERN);
	if (match) {
		let path = match[1];
		// Strip quotes from the path if present (from malformed YAML like [["path"]])
		if ((path.startsWith('"') && path.endsWith('"')) ||
			(path.startsWith("'") && path.endsWith("'"))) {
			path = path.slice(1, -1);
		}
		return path;
	}
	return value;
}

/**
 * Convert a path to wikilink format
 * If already a wikilink, returns as-is
 */
export function toWikilink(path: string): string {
	if (isWikilink(path)) {
		return path;
	}
	return `[[${path}]]`;
}

/**
 * Resolve a path (possibly a wikilink) to a TFile
 *
 * @param app - Obsidian App instance
 * @param value - The path or wikilink to resolve
 * @param sourcePath - Optional source file path for relative link resolution
 * @returns The resolved TFile, or null if not found
 */
export function resolvePathToFile(
	app: App,
	value: string,
	sourcePath?: string
): TFile | null {
	if (!value || !value.trim()) {
		return null;
	}

	// Extract path from wikilink if needed
	const linkPath = extractWikilinkPath(value);

	// First try exact path match
	const exactFile = app.vault.getAbstractFileByPath(linkPath);
	if (exactFile instanceof TFile) {
		return exactFile;
	}

	// Use Obsidian's link resolution which handles:
	// - Relative paths
	// - Shortest path matching
	// - Case-insensitive matching on some systems
	const resolved = app.metadataCache.getFirstLinkpathDest(
		linkPath,
		sourcePath ?? ''
	);

	return resolved;
}

/**
 * Resolve an image path (possibly a wikilink) to a blob URL
 * This is useful for loading images in Leaflet or other contexts
 * that need a URL rather than a TFile
 *
 * @param app - Obsidian App instance
 * @param value - The path or wikilink to resolve
 * @param sourcePath - Optional source file path for relative link resolution
 * @returns A blob URL for the image, or null if not found
 */
export async function resolveImageToUrl(
	app: App,
	value: string,
	sourcePath?: string
): Promise<string | null> {
	const linkPath = extractWikilinkPath(value);
	const file = resolvePathToFile(app, value, sourcePath);

	if (file) {
		try {
			const arrayBuffer = await app.vault.readBinary(file);
			const blob = new Blob([arrayBuffer]);
			return URL.createObjectURL(blob);
		} catch (error) {
			logger.error('resolve-image', `Failed to read file: ${file.path}`, { error });
			return null;
		}
	}

	// Fallback: try reading directly with vault adapter
	// This handles cases where the file might exist but isn't in the cache
	try {
		const exists = await app.vault.adapter.exists(linkPath);
		if (exists) {
			const data = await app.vault.adapter.readBinary(linkPath);
			const blob = new Blob([data]);
			return URL.createObjectURL(blob);
		}
	} catch (error) {
		logger.error('resolve-image', `Adapter fallback failed for "${linkPath}"`, { error });
	}

	logger.warn('resolve-image', `Could not resolve: "${value}"`);
	return null;
}
