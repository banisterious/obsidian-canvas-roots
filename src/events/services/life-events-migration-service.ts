/**
 * Life Events Migration Service
 *
 * Handles migration from inline `events` arrays to separate event note files.
 * The new format uses `life_events` property with wikilinks to event notes.
 *
 * This service is used by:
 * - Post-Import Cleanup Wizard (Step 13)
 * - Migration Notice view (v0.18.9)
 */

import { App, TFile, TFolder, normalizePath } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import { getLogger } from '../../core/logging';
import { isPersonNote } from '../../utils/note-type-detection';
import { generateCrId } from '../../core/uuid';
import type { EventType } from '../../maps/types/map-types';

const logger = getLogger('LifeEventsMigration');

/** Track if legacy format warning has been shown (only warn once per session) */
let legacyWarningShown = false;

/**
 * Log a warning for legacy events array
 */
function logLegacyFormatWarning(count: number): void {
	if (legacyWarningShown) return;
	legacyWarningShown = true;

	console.warn(
		`[Canvas Roots] Found ${count} person note(s) using inline 'events' arrays. ` +
		`This format is deprecated in favor of separate event note files. ` +
		`Use the Cleanup Wizard to migrate to event notes.`
	);
}

/**
 * Inline event from the legacy events array
 */
interface InlineEvent {
	event_type: EventType;
	place?: string;
	date_from?: string | number;
	date_to?: string | number;
	description?: string;
}

/**
 * A person note with inline events that can be migrated
 */
export interface LegacyEventsNote {
	/** The file containing the inline events array */
	file: TFile;
	/** The person's name (for generating event titles) */
	personName: string;
	/** The person's cr_id (for linking) */
	personCrId: string;
	/** The inline events array */
	events: InlineEvent[];
	/** Number of events to migrate */
	eventCount: number;
}

/**
 * Preview of what migration would create for a single event
 */
export interface EventMigrationPreview {
	/** Suggested title for the event note */
	title: string;
	/** The event type */
	eventType: EventType;
	/** Place (if any) */
	place?: string;
	/** Date from */
	dateFrom?: string;
	/** Date to */
	dateTo?: string;
	/** Description */
	description?: string;
}

/**
 * Preview of what migration would do for a single person note
 */
export interface LifeEventsMigrationPreview {
	/** The file that would be modified */
	file: TFile;
	/** Person name */
	personName: string;
	/** Number of events that would be created */
	eventCount: number;
	/** The events that would be created */
	events: EventMigrationPreview[];
}

/**
 * Result of the migration operation
 */
export interface LifeEventsMigrationResult {
	/** Total person notes processed */
	processed: number;
	/** Person notes actually modified */
	modified: number;
	/** Person notes skipped */
	skipped: number;
	/** Errors encountered */
	errors: Array<{ file: string; error: string }>;
	/** Total event notes created */
	eventNotesCreated: number;
	/** Paths of created event notes */
	createdEventPaths: string[];
}

/**
 * Event type display names for generating titles
 */
const EVENT_TYPE_NAMES: Record<EventType, string> = {
	residence: 'Residence',
	occupation: 'Occupation',
	education: 'Education',
	military: 'Military Service',
	immigration: 'Immigration',
	baptism: 'Baptism',
	confirmation: 'Confirmation',
	ordination: 'Ordination',
	custom: 'Event'
};

/**
 * Service for migrating inline events to event note files
 */
export class LifeEventsMigrationService {
	constructor(
		private app: App,
		private settings: CanvasRootsSettings
	) {}

	/**
	 * Detect all person notes with inline events arrays
	 */
	detectInlineEvents(): LegacyEventsNote[] {
		const results: LegacyEventsNote[] = [];
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter as Record<string, unknown>;

			// Only process person notes (must have cr_id)
			if (!fm.cr_id) continue;

			// Must be a person note
			if (!isPersonNote(fm, cache, this.settings.noteTypeDetection)) continue;

			// Check for events array
			const events = fm.events;
			if (!events || !Array.isArray(events) || events.length === 0) continue;

			// Get person info
			const personName = typeof fm.name === 'string' ? fm.name : file.basename;
			const personCrId = fm.cr_id as string;

			// Parse events
			const parsedEvents: InlineEvent[] = [];
			for (const event of events) {
				if (typeof event !== 'object' || event === null) continue;
				const e = event as Record<string, unknown>;

				// Must have event_type
				if (!e.event_type || typeof e.event_type !== 'string') continue;

				parsedEvents.push({
					event_type: e.event_type as EventType,
					place: typeof e.place === 'string' ? e.place : undefined,
					date_from: e.date_from as string | number | undefined,
					date_to: e.date_to as string | number | undefined,
					description: typeof e.description === 'string' ? e.description : undefined
				});
			}

			if (parsedEvents.length > 0) {
				results.push({
					file,
					personName,
					personCrId,
					events: parsedEvents,
					eventCount: parsedEvents.length
				});
			}
		}

		if (results.length > 0) {
			logLegacyFormatWarning(results.length);
		}

		logger.info('detectInlineEvents', `Found ${results.length} person notes with inline events arrays`);
		return results;
	}

	/**
	 * Preview migration for a set of notes
	 */
	previewMigration(notes: LegacyEventsNote[]): LifeEventsMigrationPreview[] {
		return notes.map(note => {
			const events: EventMigrationPreview[] = note.events.map(event => {
				return {
					title: this.generateEventTitle(note.personName, event),
					eventType: event.event_type,
					place: event.place,
					dateFrom: this.formatDate(event.date_from),
					dateTo: this.formatDate(event.date_to),
					description: event.description
				};
			});

			return {
				file: note.file,
				personName: note.personName,
				eventCount: note.eventCount,
				events
			};
		});
	}

	/**
	 * Migrate all detected notes to event note format
	 */
	async migrateToEventNotes(
		notes: LegacyEventsNote[],
		onProgress?: (current: number, total: number, currentFile?: string) => void
	): Promise<LifeEventsMigrationResult> {
		const result: LifeEventsMigrationResult = {
			processed: 0,
			modified: 0,
			skipped: 0,
			errors: [],
			eventNotesCreated: 0,
			createdEventPaths: []
		};

		const eventsFolder = this.settings.eventsFolder || 'Canvas Roots/Events';

		// Ensure events folder exists
		await this.ensureFolderExists(eventsFolder);

		for (let i = 0; i < notes.length; i++) {
			const note = notes[i];
			// Report progress
			onProgress?.(i + 1, notes.length, note.file.basename);

			result.processed++;

			try {
				const createdEventLinks: string[] = [];

				// Create event notes for each inline event
				for (const event of note.events) {
					const eventFile = await this.createEventNote(
						note.personName,
						note.personCrId,
						event,
						eventsFolder
					);

					createdEventLinks.push(`[[${eventFile.basename}]]`);
					result.eventNotesCreated++;
					result.createdEventPaths.push(eventFile.path);
				}

				// Update person note: add life_events, remove events
				await this.app.fileManager.processFrontMatter(note.file, (frontmatter) => {
					// Add life_events with wikilinks to created event notes
					const existingLifeEvents = frontmatter.life_events;
					if (existingLifeEvents && Array.isArray(existingLifeEvents)) {
						// Merge with existing, avoiding duplicates
						const merged = [...existingLifeEvents];
						for (const link of createdEventLinks) {
							if (!merged.includes(link)) {
								merged.push(link);
							}
						}
						frontmatter.life_events = merged;
					} else {
						frontmatter.life_events = createdEventLinks;
					}

					// Remove the old events array
					delete frontmatter.events;
				});

				result.modified++;

				logger.debug('migrateToEventNotes', `Migrated ${note.file.path}`, {
					eventsCreated: note.eventCount,
					lifeEventsAdded: createdEventLinks.length
				});
			} catch (error) {
				result.errors.push({
					file: note.file.path,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}

		logger.info('migrateToEventNotes', `Migration complete`, result);
		return result;
	}

	/**
	 * Quick check if vault has any inline events arrays
	 * Used for showing migration notices
	 */
	hasInlineEvents(): boolean {
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter as Record<string, unknown>;

			// Only check person notes
			if (!fm.cr_id) continue;
			if (!isPersonNote(fm, cache, this.settings.noteTypeDetection)) continue;

			// Check for events array with data
			const events = fm.events;
			if (events && Array.isArray(events) && events.length > 0) {
				return true;
			}
		}

		return false;
	}

	// ============ Private Methods ============

	/**
	 * Create an event note for an inline event
	 */
	private async createEventNote(
		personName: string,
		personCrId: string,
		event: InlineEvent,
		folder: string
	): Promise<TFile> {
		const crId = generateCrId();
		const title = this.generateEventTitle(personName, event);
		const fileName = this.slugify(title) + '.md';
		const filePath = normalizePath(`${folder}/${fileName}`);

		// Handle duplicate filenames by appending a number
		let finalPath = filePath;
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(finalPath)) {
			const baseName = this.slugify(title);
			finalPath = normalizePath(`${folder}/${baseName}-${counter}.md`);
			counter++;
		}

		// Build frontmatter
		const frontmatterLines: string[] = [
			'---',
			'cr_type: event',
			`cr_id: ${crId}`,
			`title: "${title.replace(/"/g, '\\"')}"`,
			`event_type: ${event.event_type}`,
			'date_precision: exact',
			'persons:',
			`  - "[[${personName}]]"`
		];

		// Add date if present
		const dateFrom = this.formatDate(event.date_from);
		if (dateFrom) {
			frontmatterLines.push(`date: "${dateFrom}"`);
		}

		const dateTo = this.formatDate(event.date_to);
		if (dateTo) {
			frontmatterLines.push(`date_end: "${dateTo}"`);
		}

		// Add place if present
		if (event.place) {
			// Ensure wikilink format
			const placeValue = event.place.startsWith('[[') ? event.place : `[[${event.place.replace(/^\[\[/, '').replace(/\]\]$/, '')}]]`;
			frontmatterLines.push(`place: "${placeValue}"`);
		}

		// Add description if present
		if (event.description) {
			frontmatterLines.push(`description: "${event.description.replace(/"/g, '\\"')}"`);
		}

		frontmatterLines.push('confidence: medium');
		frontmatterLines.push('---');

		// Build note body
		const body = `\n# ${title}\n\n${event.description || ''}\n`;

		const content = frontmatterLines.join('\n') + body;

		// Create the file
		const file = await this.app.vault.create(finalPath, content);

		logger.debug('createEventNote', `Created event note: ${file.path}`);
		return file;
	}

	/**
	 * Generate a title for an event note
	 */
	private generateEventTitle(personName: string, event: InlineEvent): string {
		const typeName = EVENT_TYPE_NAMES[event.event_type] || 'Event';
		const dateStr = this.formatDate(event.date_from);

		if (dateStr) {
			// Extract year for the title
			const year = dateStr.substring(0, 4);
			return `${personName} - ${typeName} ${year}`;
		}

		return `${personName} - ${typeName}`;
	}

	/**
	 * Format a date value to string
	 */
	private formatDate(value: string | number | undefined): string | undefined {
		if (value === undefined || value === null) return undefined;

		if (typeof value === 'number') {
			// Assume year only
			return String(value);
		}

		return String(value);
	}

	/**
	 * Convert a title to a URL-safe filename
	 */
	private slugify(title: string): string {
		return title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.substring(0, 100); // Limit length
	}

	/**
	 * Ensure a folder exists, creating it if necessary
	 */
	private async ensureFolderExists(folderPath: string): Promise<void> {
		const normalizedPath = normalizePath(folderPath);
		const folder = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (!folder) {
			await this.app.vault.createFolder(normalizedPath);
		} else if (!(folder instanceof TFolder)) {
			throw new Error(`Path exists but is not a folder: ${normalizedPath}`);
		}
	}
}
