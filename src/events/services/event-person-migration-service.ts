/**
 * Event Person Migration Service
 *
 * Handles migration from singular `person` property to array format `persons: [...]`.
 * This consolidates the dual-property approach into a single consistent format.
 *
 * This service is used by:
 * - Post-Import Cleanup Wizard (Step 11)
 * - Migration Notice view (v0.18.0)
 */

import { App, TFile } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import { getLogger } from '../../core/logging';
import { isEventNote } from '../../utils/note-type-detection';

const logger = getLogger('EventPersonMigration');

/**
 * Property aliases mapping type
 */
type PropertyAliases = Record<string, string>;

/**
 * Get the user-defined property name for a canonical property
 * If an alias exists, returns the user's aliased name; otherwise returns the canonical name
 */
function getPropertyName(canonical: string, aliases: PropertyAliases): string {
	// Find if user has an alias for this canonical property
	for (const [userProp, canonicalProp] of Object.entries(aliases)) {
		if (canonicalProp === canonical) {
			return userProp;
		}
	}
	return canonical;
}

/** Track if legacy format warning has been shown (only warn once per session) */
let legacyWarningShown = false;

/**
 * Log a warning for legacy person property
 */
function logLegacyFormatWarning(count: number): void {
	if (legacyWarningShown) return;
	legacyWarningShown = true;

	console.warn(
		`[Canvas Roots] Found ${count} event note(s) using the legacy 'person' property. ` +
		`This format is deprecated in favor of the 'persons' array. ` +
		`Use the Cleanup Wizard to migrate to the array format (persons: [...]).`
	);
}

/**
 * An event note with legacy person property that can be migrated
 */
export interface LegacyPersonEventNote {
	/** The file containing the legacy person property */
	file: TFile;
	/** The person value (wikilink string) */
	personValue: string;
	/** Whether the note already has a persons array */
	hasPersonsArray: boolean;
	/** Existing persons array values (if any) */
	existingPersons: string[];
}

/**
 * Preview of what migration would do for a single note
 */
export interface EventPersonMigrationPreview {
	/** The file that would be modified */
	file: TFile;
	/** The person value that would be moved */
	personValue: string;
	/** The merged persons array that would be written */
	newPersonsArray: string[];
	/** Whether this is a merge (has existing persons array) */
	isMerge: boolean;
}

/**
 * Result of the migration operation
 */
export interface EventPersonMigrationResult {
	/** Total notes processed */
	processed: number;
	/** Notes actually modified */
	modified: number;
	/** Notes skipped (already migrated or no person property) */
	skipped: number;
	/** Errors encountered */
	errors: Array<{ file: string; error: string }>;
}

/**
 * Service for migrating event person property to persons array format
 */
export class EventPersonMigrationService {
	constructor(
		private app: App,
		private settings: CanvasRootsSettings
	) {}

	/**
	 * Detect all event notes with the legacy person property
	 * Returns notes that have person but should use persons array
	 */
	detectLegacyPersonProperty(): LegacyPersonEventNote[] {
		const results: LegacyPersonEventNote[] = [];
		const files = this.app.vault.getMarkdownFiles();
		const personProp = getPropertyName('person', this.settings.propertyAliases);
		const personsProp = getPropertyName('persons', this.settings.propertyAliases);

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter as Record<string, unknown>;

			// Only process Event notes
			if (!isEventNote(fm, cache, this.settings.noteTypeDetection)) {
				continue;
			}

			// Check for person property (singular)
			const personValue = fm[personProp];
			if (!personValue || typeof personValue !== 'string') {
				continue;
			}

			// Check if note already has a persons array
			const hasPersonsArray = Array.isArray(fm[personsProp]);
			const existingPersons: string[] = [];

			if (hasPersonsArray) {
				for (const item of fm[personsProp] as unknown[]) {
					if (typeof item === 'string') {
						existingPersons.push(item);
					}
				}
			}

			results.push({
				file,
				personValue,
				hasPersonsArray,
				existingPersons
			});
		}

		if (results.length > 0) {
			logLegacyFormatWarning(results.length);
		}

		logger.info('detectLegacyPersonProperty', `Found ${results.length} event notes with legacy person property`);
		return results;
	}

	/**
	 * Preview migration for a set of notes
	 */
	previewMigration(notes: LegacyPersonEventNote[]): EventPersonMigrationPreview[] {
		return notes.map(note => {
			// Merge: add person to front of persons array (if not already present)
			const newPersonsArray = note.hasPersonsArray
				? this.mergePersonIntoArray(note.personValue, note.existingPersons)
				: [note.personValue];

			return {
				file: note.file,
				personValue: note.personValue,
				newPersonsArray,
				isMerge: note.hasPersonsArray && note.existingPersons.length > 0
			};
		});
	}

	/**
	 * Merge a single person value into an existing persons array
	 * Avoids duplicates and adds to front
	 */
	private mergePersonIntoArray(person: string, existing: string[]): string[] {
		// Normalize wikilinks for comparison
		const normalize = (s: string) => s.toLowerCase().trim();
		const personNorm = normalize(person);

		// Check if already in array
		const alreadyExists = existing.some(e => normalize(e) === personNorm);
		if (alreadyExists) {
			return [...existing];
		}

		// Add to front
		return [person, ...existing];
	}

	/**
	 * Migrate all detected notes to array format
	 */
	async migrateToArrayFormat(
		notes: LegacyPersonEventNote[],
		onProgress?: (current: number, total: number, currentFile?: string) => void
	): Promise<EventPersonMigrationResult> {
		const result: EventPersonMigrationResult = {
			processed: 0,
			modified: 0,
			skipped: 0,
			errors: []
		};

		const personProp = getPropertyName('person', this.settings.propertyAliases);
		const personsProp = getPropertyName('persons', this.settings.propertyAliases);

		for (let i = 0; i < notes.length; i++) {
			const note = notes[i];
			// Report progress
			onProgress?.(i + 1, notes.length, note.file.basename);

			result.processed++;

			try {
				const content = await this.app.vault.read(note.file);
				const lines = content.split('\n');

				// Find frontmatter boundaries
				const fmStart = lines.findIndex(l => l.trim() === '---');
				if (fmStart === -1) {
					result.skipped++;
					continue;
				}

				const fmEnd = lines.slice(fmStart + 1).findIndex(l => l.trim() === '---');
				if (fmEnd === -1) {
					result.skipped++;
					continue;
				}

				const fmEndIndex = fmStart + 1 + fmEnd;
				const fmLines = lines.slice(fmStart + 1, fmEndIndex);

				// Find and remove person property
				let personLineIndex = -1;
				for (let i = 0; i < fmLines.length; i++) {
					if (fmLines[i].startsWith(`${personProp}:`)) {
						personLineIndex = i;
						break;
					}
				}

				if (personLineIndex === -1) {
					result.skipped++;
					continue;
				}

				// Build new persons array
				const newPersonsArray = note.hasPersonsArray
					? this.mergePersonIntoArray(note.personValue, note.existingPersons)
					: [note.personValue];

				// Remove the person line
				fmLines.splice(personLineIndex, 1);

				// Find persons array or where to insert it
				let personsLineIndex = -1;
				let personsEndIndex = -1;

				for (let i = 0; i < fmLines.length; i++) {
					if (fmLines[i].startsWith(`${personsProp}:`)) {
						personsLineIndex = i;
						// Find end of array (next property or end of frontmatter)
						for (let j = i + 1; j < fmLines.length; j++) {
							if (!fmLines[j].startsWith('  - ')) {
								personsEndIndex = j;
								break;
							}
						}
						if (personsEndIndex === -1) {
							personsEndIndex = fmLines.length;
						}
						break;
					}
				}

				// Build new persons lines
				const newPersonsLines = [`${personsProp}:`];
				for (const p of newPersonsArray) {
					newPersonsLines.push(`  - "${p.replace(/"/g, '\\"')}"`);
				}

				if (personsLineIndex !== -1) {
					// Replace existing persons array
					fmLines.splice(personsLineIndex, personsEndIndex - personsLineIndex, ...newPersonsLines);
				} else {
					// Insert after event_type or at end of frontmatter
					const eventTypeIndex = fmLines.findIndex(l => l.startsWith('event_type:'));
					const insertIndex = eventTypeIndex !== -1 ? eventTypeIndex + 1 : fmLines.length;
					fmLines.splice(insertIndex, 0, ...newPersonsLines);
				}

				// Reconstruct content
				const newLines = [
					...lines.slice(0, fmStart + 1),
					...fmLines,
					...lines.slice(fmEndIndex)
				];
				const newContent = newLines.join('\n');

				await this.app.vault.modify(note.file, newContent);
				result.modified++;

				logger.debug('migrateToArrayFormat', `Migrated ${note.file.path}`, {
					oldPerson: note.personValue,
					newPersons: newPersonsArray
				});
			} catch (error) {
				result.errors.push({
					file: note.file.path,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}

		logger.info('migrateToArrayFormat', `Migration complete`, result);
		return result;
	}

	/**
	 * Quick check if vault has any legacy person properties
	 * Used for showing migration notices
	 */
	hasLegacyPersonProperties(): boolean {
		const files = this.app.vault.getMarkdownFiles();
		const personProp = getPropertyName('person', this.settings.propertyAliases);

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter as Record<string, unknown>;

			if (!isEventNote(fm, cache, this.settings.noteTypeDetection)) {
				continue;
			}

			if (fm[personProp] && typeof fm[personProp] === 'string') {
				return true;
			}
		}

		return false;
	}
}
