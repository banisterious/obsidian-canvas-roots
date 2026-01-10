/**
 * Source Migration Service
 *
 * Handles migration from indexed source properties (source, source_2, source_3, etc.)
 * to the array format (sources: [...]).
 *
 * This service is used by:
 * - Post-Import Cleanup Wizard (Step 6)
 * - Control Center Data Quality tab (future)
 */

import { App, TFile } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import { getLogger } from '../../core/logging';
import { isPersonNote, isEventNote } from '../../utils/note-type-detection';

const logger = getLogger('SourceMigration');

/** Track if legacy format warning has been shown (only warn once per session) */
let legacyWarningShown = false;

/**
 * Log a warning for legacy indexed source properties
 * These are no longer supported but can still be migrated via the wizard
 */
function logLegacyFormatWarning(count: number): void {
	if (legacyWarningShown) return;
	legacyWarningShown = true;

	console.warn(
		`[Charted Roots] Found ${count} note(s) using legacy indexed source properties ` +
		`(source, source_2, source_3...). This format is no longer supported. ` +
		`Use the Cleanup Wizard (Step 6) to migrate to the array format (sources: [...]).`
	);
}

/**
 * A note with indexed source properties that can be migrated
 */
export interface IndexedSourceNote {
	/** The file containing indexed sources */
	file: TFile;
	/** The indexed source values found (source, source_2, etc.) */
	indexedSources: string[];
	/** Whether the note already has a sources array */
	hasSourcesArray: boolean;
	/** Existing sources array values (if any) */
	existingSources: string[];
}

/**
 * Preview of what migration would do for a single note
 */
export interface SourceMigrationPreview {
	/** The file that would be modified */
	file: TFile;
	/** Properties that would be removed */
	removedProperties: string[];
	/** The merged sources array that would be written */
	newSourcesArray: string[];
	/** Whether this is a merge (has existing sources array) */
	isMerge: boolean;
}

/**
 * Result of the migration operation
 */
export interface SourceMigrationResult {
	/** Total notes processed */
	processed: number;
	/** Notes actually modified */
	modified: number;
	/** Notes skipped (already migrated or no sources) */
	skipped: number;
	/** Errors encountered */
	errors: Array<{ file: string; error: string }>;
}

/**
 * Service for migrating indexed source properties to array format
 */
export class SourceMigrationService {
	constructor(
		private app: App,
		private settings: CanvasRootsSettings
	) {}

	/**
	 * Detect all notes with indexed source properties
	 * Returns notes that have source, source_2, source_3, etc.
	 */
	detectIndexedSources(): IndexedSourceNote[] {
		const results: IndexedSourceNote[] = [];
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter as Record<string, unknown>;

			// Only process Person and Event notes (the types that have source references)
			if (!isPersonNote(fm, cache, this.settings.noteTypeDetection) &&
				!isEventNote(fm, cache, this.settings.noteTypeDetection)) {
				continue;
			}

			// Check for indexed source properties
			const indexedSources: string[] = [];

			// Check for 'source' (the first/primary source)
			if (fm.source && typeof fm.source === 'string') {
				indexedSources.push(fm.source);
			}

			// Check for source_2, source_3, ..., source_N
			for (let i = 2; i <= 20; i++) {
				const key = `source_${i}`;
				if (fm[key] && typeof fm[key] === 'string') {
					indexedSources.push(fm[key] as string);
				} else {
					break; // Stop at first missing index
				}
			}

			// Skip if no indexed sources found
			if (indexedSources.length === 0) continue;

			// Check if note already has a sources array
			const hasSourcesArray = Array.isArray(fm.sources);
			const existingSources: string[] = [];

			if (hasSourcesArray) {
				for (const item of fm.sources as unknown[]) {
					if (typeof item === 'string') {
						existingSources.push(item);
					}
				}
			}

			results.push({
				file,
				indexedSources,
				hasSourcesArray,
				existingSources
			});
		}

		logger.info('detectIndexedSources', `Found ${results.length} notes with indexed source properties`);

		// Log deprecation warning if indexed sources were found
		if (results.length > 0) {
			logLegacyFormatWarning(results.length);
		}

		return results;
	}

	/**
	 * Preview what migration would do without making changes
	 */
	previewMigration(notes?: IndexedSourceNote[]): SourceMigrationPreview[] {
		const notesToPreview = notes ?? this.detectIndexedSources();
		const previews: SourceMigrationPreview[] = [];

		for (const note of notesToPreview) {
			// Determine which properties would be removed
			const removedProperties: string[] = [];

			if (note.indexedSources.length > 0) {
				removedProperties.push('source');
			}
			for (let i = 2; i <= note.indexedSources.length; i++) {
				removedProperties.push(`source_${i}`);
			}

			// Merge existing sources array with indexed sources (deduplicated)
			const allSources = new Set<string>();

			// Add existing sources first (preserve order)
			for (const src of note.existingSources) {
				allSources.add(src);
			}

			// Add indexed sources
			for (const src of note.indexedSources) {
				allSources.add(src);
			}

			previews.push({
				file: note.file,
				removedProperties,
				newSourcesArray: Array.from(allSources),
				isMerge: note.hasSourcesArray
			});
		}

		return previews;
	}

	/**
	 * Migrate indexed source properties to array format
	 * Converts source, source_2, source_3 → sources: [...]
	 */
	async migrateToArrayFormat(
		notes?: IndexedSourceNote[],
		onProgress?: (current: number, total: number) => void
	): Promise<SourceMigrationResult> {
		const notesToMigrate = notes ?? this.detectIndexedSources();

		const result: SourceMigrationResult = {
			processed: 0,
			modified: 0,
			skipped: 0,
			errors: []
		};

		const total = notesToMigrate.length;

		for (let i = 0; i < notesToMigrate.length; i++) {
			const note = notesToMigrate[i];
			result.processed++;

			if (onProgress) {
				onProgress(i + 1, total);
			}

			try {
				// Get preview to know what changes to make
				const preview = this.previewMigration([note])[0];

				await this.app.fileManager.processFrontMatter(note.file, (frontmatter) => {
					// Remove indexed properties
					delete frontmatter.source;
					for (let j = 2; j <= 20; j++) {
						const key = `source_${j}`;
						if (frontmatter[key] !== undefined) {
							delete frontmatter[key];
						} else {
							break;
						}
					}

					// Write the merged sources array
					frontmatter.sources = preview.newSourcesArray;
				});

				result.modified++;
				logger.debug('migrateToArrayFormat', `Migrated: ${note.file.path}`);
			} catch (error) {
				result.errors.push({
					file: note.file.path,
					error: error instanceof Error ? error.message : String(error)
				});
				logger.error('migrateToArrayFormat', `Failed to migrate ${note.file.path}:`, error);
			}
		}

		logger.info('migrateToArrayFormat', `Migration complete: ${result.modified}/${result.processed} notes migrated, ${result.errors.length} errors`);
		return result;
	}

	/**
	 * Get count of notes with indexed sources (for wizard pre-scan)
	 */
	getIndexedSourceCount(): number {
		return this.detectIndexedSources().length;
	}
}
