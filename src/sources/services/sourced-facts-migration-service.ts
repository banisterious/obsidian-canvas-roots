/**
 * Sourced Facts Migration Service
 *
 * Handles migration from nested `sourced_facts` object to flat `sourced_*` properties.
 * The new flat format is compatible with Obsidian's Properties panel.
 *
 * This service is used by:
 * - Post-Import Cleanup Wizard (Step 12)
 * - Migration Notice view (v0.18.9)
 */

import { App, TFile } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import { getLogger } from '../../core/logging';
import {
	FACT_KEYS,
	FACT_KEY_TO_SOURCED_PROPERTY,
	type FactKey,
	type SourcedFacts
} from '../types/source-types';

const logger = getLogger('SourcedFactsMigration');

/** Track if legacy format warning has been shown (only warn once per session) */
let legacyWarningShown = false;

/**
 * Log a warning for legacy sourced_facts property
 */
function logLegacyFormatWarning(count: number): void {
	if (legacyWarningShown) return;
	legacyWarningShown = true;

	console.warn(
		`[Canvas Roots] Found ${count} person note(s) using the legacy 'sourced_facts' property. ` +
		`This nested format is deprecated in favor of flat 'sourced_*' properties. ` +
		`Use the Cleanup Wizard to migrate to the flat format.`
	);
}

/**
 * A person note with legacy sourced_facts that can be migrated
 */
export interface LegacySourcedFactsNote {
	/** The file containing the legacy sourced_facts property */
	file: TFile;
	/** The sourced_facts object */
	sourcedFacts: SourcedFacts;
	/** Which fact keys have data */
	factKeys: FactKey[];
	/** Total number of source citations in the nested structure */
	totalSources: number;
}

/**
 * Preview of what migration would do for a single note
 */
export interface SourcedFactsMigrationPreview {
	/** The file that would be modified */
	file: TFile;
	/** Number of fact keys that would be migrated */
	factKeysCount: number;
	/** Total source citations that would be migrated */
	totalSources: number;
	/** The flat properties that would be created */
	flatProperties: Array<{ propName: string; sources: string[] }>;
}

/**
 * Result of the migration operation
 */
export interface SourcedFactsMigrationResult {
	/** Total notes processed */
	processed: number;
	/** Notes actually modified */
	modified: number;
	/** Notes skipped */
	skipped: number;
	/** Errors encountered */
	errors: Array<{ file: string; error: string }>;
	/** Total fact properties migrated */
	factPropertiesMigrated: number;
	/** Total source citations migrated */
	sourceCitationsMigrated: number;
}

/**
 * Service for migrating sourced_facts to flat sourced_* properties
 */
export class SourcedFactsMigrationService {
	constructor(
		private app: App,
		private settings: CanvasRootsSettings
	) {}

	/**
	 * Detect all person notes with the legacy sourced_facts property
	 */
	detectLegacySourcedFacts(): LegacySourcedFactsNote[] {
		const results: LegacySourcedFactsNote[] = [];
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter as Record<string, unknown>;

			// Only process person notes (must have cr_id)
			if (!fm.cr_id) continue;

			// Check for sourced_facts property
			const sourcedFacts = fm.sourced_facts as SourcedFacts | undefined;
			if (!sourcedFacts || typeof sourcedFacts !== 'object') continue;

			// Count which fact keys have data and total sources
			const factKeys: FactKey[] = [];
			let totalSources = 0;

			for (const factKey of FACT_KEYS) {
				const entry = sourcedFacts[factKey];
				if (entry && Array.isArray(entry.sources) && entry.sources.length > 0) {
					factKeys.push(factKey);
					totalSources += entry.sources.length;
				}
			}

			// Only include if there's actual data to migrate
			if (factKeys.length > 0) {
				results.push({
					file,
					sourcedFacts,
					factKeys,
					totalSources
				});
			}
		}

		if (results.length > 0) {
			logLegacyFormatWarning(results.length);
		}

		logger.info('detectLegacySourcedFacts', `Found ${results.length} person notes with legacy sourced_facts property`);
		return results;
	}

	/**
	 * Preview migration for a set of notes
	 */
	previewMigration(notes: LegacySourcedFactsNote[]): SourcedFactsMigrationPreview[] {
		return notes.map(note => {
			const flatProperties: Array<{ propName: string; sources: string[] }> = [];

			for (const factKey of note.factKeys) {
				const entry = note.sourcedFacts[factKey];
				if (entry && entry.sources && entry.sources.length > 0) {
					const propName = FACT_KEY_TO_SOURCED_PROPERTY[factKey];
					flatProperties.push({
						propName,
						sources: [...entry.sources]
					});
				}
			}

			return {
				file: note.file,
				factKeysCount: note.factKeys.length,
				totalSources: note.totalSources,
				flatProperties
			};
		});
	}

	/**
	 * Migrate all detected notes to flat property format
	 */
	async migrateToFlatFormat(
		notes: LegacySourcedFactsNote[],
		onProgress?: (current: number, total: number, currentFile?: string) => void
	): Promise<SourcedFactsMigrationResult> {
		const result: SourcedFactsMigrationResult = {
			processed: 0,
			modified: 0,
			skipped: 0,
			errors: [],
			factPropertiesMigrated: 0,
			sourceCitationsMigrated: 0
		};

		for (let i = 0; i < notes.length; i++) {
			const note = notes[i];
			// Report progress
			onProgress?.(i + 1, notes.length, note.file.basename);

			result.processed++;

			try {
				// Use Obsidian's processFrontMatter for safe YAML handling
				await this.app.fileManager.processFrontMatter(note.file, (frontmatter) => {
					// Create flat properties from sourced_facts
					for (const factKey of note.factKeys) {
						const entry = note.sourcedFacts[factKey];
						if (entry && entry.sources && entry.sources.length > 0) {
							const propName = FACT_KEY_TO_SOURCED_PROPERTY[factKey];

							// Check if flat property already exists
							const existingSources = frontmatter[propName];
							if (existingSources && Array.isArray(existingSources) && existingSources.length > 0) {
								// Merge without duplicates
								const merged = [...existingSources];
								for (const source of entry.sources) {
									if (!merged.includes(source)) {
										merged.push(source);
									}
								}
								frontmatter[propName] = merged;
							} else {
								// Create new flat property
								frontmatter[propName] = [...entry.sources];
							}

							result.factPropertiesMigrated++;
							result.sourceCitationsMigrated += entry.sources.length;
						}
					}

					// Remove the old sourced_facts property
					delete frontmatter.sourced_facts;
				});

				result.modified++;

				logger.debug('migrateToFlatFormat', `Migrated ${note.file.path}`, {
					factKeys: note.factKeys,
					totalSources: note.totalSources
				});
			} catch (error) {
				result.errors.push({
					file: note.file.path,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}

		logger.info('migrateToFlatFormat', `Migration complete`, result);
		return result;
	}

	/**
	 * Quick check if vault has any legacy sourced_facts properties
	 * Used for showing migration notices and auto-completion detection
	 */
	hasLegacySourcedFacts(): boolean {
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter as Record<string, unknown>;

			// Only check person notes
			if (!fm.cr_id) continue;

			// Check for sourced_facts with actual data
			const sourcedFacts = fm.sourced_facts as SourcedFacts | undefined;
			if (sourcedFacts && typeof sourcedFacts === 'object') {
				for (const factKey of FACT_KEYS) {
					const entry = sourcedFacts[factKey];
					if (entry && Array.isArray(entry.sources) && entry.sources.length > 0) {
						return true;
					}
				}
			}
		}

		return false;
	}
}
