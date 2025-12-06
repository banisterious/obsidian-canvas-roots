/**
 * Event Service for Chronological Story Mapping
 *
 * Handles CRUD operations for event notes and event-related queries.
 */

import { App, TFile, TFolder, normalizePath } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import {
	EventNote,
	EventStats,
	EventConfidence,
	DatePrecision,
	EventTypeDefinition,
	CreateEventData,
	UpdateEventData,
	getAllEventTypes,
	getEventType
} from '../types/event-types';
import { generateCrId } from '../../core/uuid';

/**
 * Safely convert frontmatter value to string
 */
function fmToString(value: unknown): string {
	if (value === undefined || value === null) return '';
	if (typeof value === 'object' && value !== null) return JSON.stringify(value);
	return String(value);
}

/**
 * Safely convert frontmatter value to string array
 */
function fmToStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map(v => fmToString(v)).filter(v => v.length > 0);
	}
	if (typeof value === 'string' && value.length > 0) {
		return [value];
	}
	return [];
}

/**
 * Format a wikilink - ensure it has [[ ]] brackets
 */
function formatWikilink(value: string): string {
	const trimmed = value.trim();
	if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
		return trimmed;
	}
	return `[[${trimmed}]]`;
}

/**
 * Service for managing event notes
 */
export class EventService {
	private app: App;
	private settings: CanvasRootsSettings;
	private eventCache: Map<string, EventNote> = new Map();
	private cacheValid = false;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Update settings reference (called when settings change)
	 */
	updateSettings(settings: CanvasRootsSettings): void {
		this.settings = settings;
		this.invalidateCache();
	}

	/**
	 * Invalidate the event cache
	 */
	invalidateCache(): void {
		this.cacheValid = false;
		this.eventCache.clear();
	}

	/**
	 * Get all event notes in the vault
	 */
	getAllEvents(): EventNote[] {
		if (!this.cacheValid) {
			this.loadEventCache();
		}
		return Array.from(this.eventCache.values());
	}

	/**
	 * Get an event note by cr_id
	 */
	getEventById(crId: string): EventNote | undefined {
		if (!this.cacheValid) {
			this.loadEventCache();
		}
		return this.eventCache.get(crId);
	}

	/**
	 * Get an event note by file path
	 */
	getEventByPath(filePath: string): EventNote | undefined {
		if (!this.cacheValid) {
			this.loadEventCache();
		}
		return Array.from(this.eventCache.values()).find(e => e.filePath === filePath);
	}

	/**
	 * Get an event note by file
	 */
	getEventByFile(file: TFile): EventNote | undefined {
		return this.getEventByPath(file.path);
	}

	/**
	 * Get events by type
	 */
	getEventsByType(eventType: string): EventNote[] {
		const events = this.getAllEvents();
		return events.filter(e => e.eventType === eventType);
	}

	/**
	 * Get events for a person (by wikilink)
	 */
	getEventsForPerson(personLink: string): EventNote[] {
		const events = this.getAllEvents();
		const normalizedLink = this.normalizeWikilink(personLink);
		return events.filter(e => {
			if (e.person && this.normalizeWikilink(e.person) === normalizedLink) {
				return true;
			}
			if (e.persons?.some(p => this.normalizeWikilink(p) === normalizedLink)) {
				return true;
			}
			return false;
		});
	}

	/**
	 * Get events at a place (by wikilink)
	 */
	getEventsAtPlace(placeLink: string): EventNote[] {
		const events = this.getAllEvents();
		const normalizedLink = this.normalizeWikilink(placeLink);
		return events.filter(e => e.place && this.normalizeWikilink(e.place) === normalizedLink);
	}

	/**
	 * Get events in a timeline (by wikilink)
	 */
	getEventsInTimeline(timelineLink: string): EventNote[] {
		const events = this.getAllEvents();
		const normalizedLink = this.normalizeWikilink(timelineLink);
		return events.filter(e => e.timeline && this.normalizeWikilink(e.timeline) === normalizedLink);
	}

	/**
	 * Get events by group/faction
	 */
	getEventsByGroup(groupName: string): EventNote[] {
		const events = this.getAllEvents();
		return events.filter(e => e.groups?.includes(groupName));
	}

	/**
	 * Get all unique groups referenced in events
	 */
	getUniqueGroups(): string[] {
		const events = this.getAllEvents();
		const groups = new Set<string>();
		for (const event of events) {
			if (event.groups) {
				for (const g of event.groups) {
					groups.add(g);
				}
			}
		}
		return Array.from(groups).sort();
	}

	/**
	 * Get events with relative ordering (no exact date)
	 */
	getEventsWithRelativeOrdering(): EventNote[] {
		const events = this.getAllEvents();
		return events.filter(e =>
			e.datePrecision === 'unknown' &&
			((e.before && e.before.length > 0) || (e.after && e.after.length > 0))
		);
	}

	/**
	 * Get events without sources
	 */
	getUnsourcedEvents(): EventNote[] {
		const events = this.getAllEvents();
		return events.filter(e => !e.sources || e.sources.length === 0);
	}

	/**
	 * Get events with low confidence
	 */
	getLowConfidenceEvents(): EventNote[] {
		const events = this.getAllEvents();
		return events.filter(e => e.confidence === 'low' || e.confidence === 'unknown');
	}

	/**
	 * Get all unique persons referenced in events
	 */
	getUniquePeople(): string[] {
		const events = this.getAllEvents();
		const people = new Set<string>();
		for (const event of events) {
			if (event.person) {
				people.add(this.normalizeWikilink(event.person));
			}
			if (event.persons) {
				for (const p of event.persons) {
					people.add(this.normalizeWikilink(p));
				}
			}
		}
		return Array.from(people).sort();
	}

	/**
	 * Get all unique places referenced in events
	 */
	getUniquePlaces(): string[] {
		const events = this.getAllEvents();
		const places = new Set<string>();
		for (const event of events) {
			if (event.place) {
				places.add(this.normalizeWikilink(event.place));
			}
		}
		return Array.from(places).sort();
	}

	/**
	 * Get all unique timelines referenced in events
	 */
	getUniqueTimelines(): string[] {
		const events = this.getAllEvents();
		const timelines = new Set<string>();
		for (const event of events) {
			if (event.timeline) {
				timelines.add(this.normalizeWikilink(event.timeline));
			}
		}
		return Array.from(timelines).sort();
	}

	/**
	 * Calculate event statistics
	 */
	getEventStats(): EventStats {
		const events = this.getAllEvents();

		const stats: EventStats = {
			totalEvents: events.length,
			byType: {},
			byPerson: {},
			byPlace: {},
			byGroup: {},
			byConfidence: {
				high: 0,
				medium: 0,
				low: 0,
				unknown: 0
			},
			withSources: 0,
			withoutSources: 0,
			withDates: 0,
			withRelativeOrdering: 0
		};

		for (const event of events) {
			// Count by type
			stats.byType[event.eventType] = (stats.byType[event.eventType] || 0) + 1;

			// Count by person
			if (event.person) {
				const personKey = this.normalizeWikilink(event.person);
				stats.byPerson[personKey] = (stats.byPerson[personKey] || 0) + 1;
			}
			if (event.persons) {
				for (const p of event.persons) {
					const personKey = this.normalizeWikilink(p);
					stats.byPerson[personKey] = (stats.byPerson[personKey] || 0) + 1;
				}
			}

			// Count by place
			if (event.place) {
				const placeKey = this.normalizeWikilink(event.place);
				stats.byPlace[placeKey] = (stats.byPlace[placeKey] || 0) + 1;
			}

			// Count by group
			if (event.groups) {
				for (const g of event.groups) {
					stats.byGroup[g] = (stats.byGroup[g] || 0) + 1;
				}
			}

			// Count by confidence
			stats.byConfidence[event.confidence]++;

			// Count sources
			if (event.sources && event.sources.length > 0) {
				stats.withSources++;
			} else {
				stats.withoutSources++;
			}

			// Count dates vs relative ordering
			if (event.date && event.datePrecision !== 'unknown') {
				stats.withDates++;
			}
			if ((event.before && event.before.length > 0) || (event.after && event.after.length > 0)) {
				stats.withRelativeOrdering++;
			}
		}

		return stats;
	}

	/**
	 * Create a new event note
	 */
	async createEvent(data: CreateEventData): Promise<TFile> {
		// Generate cr_id
		const crId = generateCrId();

		// Build frontmatter
		const frontmatterLines: string[] = [
			'---',
			'type: event',
			`cr_id: ${crId}`,
			`title: "${data.title.replace(/"/g, '\\"')}"`,
			`event_type: ${data.eventType}`,
			`date_precision: ${data.datePrecision}`
		];

		if (data.date) {
			frontmatterLines.push(`date: ${data.date}`);
		}
		if (data.dateEnd) {
			frontmatterLines.push(`date_end: ${data.dateEnd}`);
		}
		if (data.person) {
			frontmatterLines.push(`person: "${formatWikilink(data.person)}"`);
		}
		if (data.persons && data.persons.length > 0) {
			const formattedPersons = data.persons.map(p => formatWikilink(p));
			frontmatterLines.push(`persons:`);
			for (const p of formattedPersons) {
				frontmatterLines.push(`  - "${p}"`);
			}
		}
		if (data.place) {
			frontmatterLines.push(`place: "${formatWikilink(data.place)}"`);
		}
		if (data.sources && data.sources.length > 0) {
			const formattedSources = data.sources.map(s => formatWikilink(s));
			frontmatterLines.push(`sources:`);
			for (const s of formattedSources) {
				frontmatterLines.push(`  - "${s}"`);
			}
		}
		if (data.confidence) {
			frontmatterLines.push(`confidence: ${data.confidence}`);
		}
		if (data.description) {
			frontmatterLines.push(`description: "${data.description.replace(/"/g, '\\"')}"`);
		}
		if (data.isCanonical) {
			frontmatterLines.push(`is_canonical: true`);
		}
		if (data.universe) {
			frontmatterLines.push(`universe: "${data.universe.replace(/"/g, '\\"')}"`);
		}
		if (data.dateSystem) {
			frontmatterLines.push(`date_system: ${data.dateSystem}`);
		}
		if (data.before && data.before.length > 0) {
			const formattedBefore = data.before.map(b => formatWikilink(b));
			frontmatterLines.push(`before:`);
			for (const b of formattedBefore) {
				frontmatterLines.push(`  - "${b}"`);
			}
		}
		if (data.after && data.after.length > 0) {
			const formattedAfter = data.after.map(a => formatWikilink(a));
			frontmatterLines.push(`after:`);
			for (const a of formattedAfter) {
				frontmatterLines.push(`  - "${a}"`);
			}
		}
		if (data.timeline) {
			frontmatterLines.push(`timeline: "${formatWikilink(data.timeline)}"`);
		}
		if (data.groups && data.groups.length > 0) {
			frontmatterLines.push(`groups:`);
			for (const g of data.groups) {
				frontmatterLines.push(`  - "${g.replace(/"/g, '\\"')}"`);
			}
		}

		frontmatterLines.push('---');

		// Build note body
		const body = `\n# ${data.title}\n\n${data.description || ''}\n`;

		const content = frontmatterLines.join('\n') + body;

		// Create file
		const fileName = this.slugify(data.title) + '.md';
		const folder = this.settings.eventsFolder || 'Canvas Roots/Events';
		const filePath = normalizePath(`${folder}/${fileName}`);

		// Ensure folder exists
		await this.ensureFolderExists(folder);

		// Create the file
		const file = await this.app.vault.create(filePath, content);

		// Invalidate cache
		this.invalidateCache();

		return file;
	}

	/**
	 * Update an existing event note's frontmatter
	 */
	async updateEvent(file: TFile, data: UpdateEventData): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			// Update fields that are provided
			if (data.title !== undefined) {
				frontmatter.title = data.title;
			}
			if (data.eventType !== undefined) {
				frontmatter.event_type = data.eventType;
			}
			if (data.datePrecision !== undefined) {
				frontmatter.date_precision = data.datePrecision;
			}

			// Optional fields - set or remove
			if (data.date !== undefined) {
				if (data.date) {
					frontmatter.date = data.date;
				} else {
					delete frontmatter.date;
				}
			}
			if (data.dateEnd !== undefined) {
				if (data.dateEnd) {
					frontmatter.date_end = data.dateEnd;
				} else {
					delete frontmatter.date_end;
				}
			}
			if (data.person !== undefined) {
				if (data.person) {
					frontmatter.person = formatWikilink(data.person);
				} else {
					delete frontmatter.person;
				}
			}
			if (data.persons !== undefined) {
				if (data.persons && data.persons.length > 0) {
					frontmatter.persons = data.persons.map(p => formatWikilink(p));
				} else {
					delete frontmatter.persons;
				}
			}
			if (data.place !== undefined) {
				if (data.place) {
					frontmatter.place = formatWikilink(data.place);
				} else {
					delete frontmatter.place;
				}
			}
			if (data.sources !== undefined) {
				if (data.sources && data.sources.length > 0) {
					frontmatter.sources = data.sources.map(s => formatWikilink(s));
				} else {
					delete frontmatter.sources;
				}
			}
			if (data.confidence !== undefined) {
				if (data.confidence) {
					frontmatter.confidence = data.confidence;
				} else {
					delete frontmatter.confidence;
				}
			}
			if (data.description !== undefined) {
				if (data.description) {
					frontmatter.description = data.description;
				} else {
					delete frontmatter.description;
				}
			}
			if (data.isCanonical !== undefined) {
				if (data.isCanonical) {
					frontmatter.is_canonical = true;
				} else {
					delete frontmatter.is_canonical;
				}
			}
			if (data.universe !== undefined) {
				if (data.universe) {
					frontmatter.universe = data.universe;
				} else {
					delete frontmatter.universe;
				}
			}
			if (data.dateSystem !== undefined) {
				if (data.dateSystem) {
					frontmatter.date_system = data.dateSystem;
				} else {
					delete frontmatter.date_system;
				}
			}
			if (data.before !== undefined) {
				if (data.before && data.before.length > 0) {
					frontmatter.before = data.before.map(b => formatWikilink(b));
				} else {
					delete frontmatter.before;
				}
			}
			if (data.after !== undefined) {
				if (data.after && data.after.length > 0) {
					frontmatter.after = data.after.map(a => formatWikilink(a));
				} else {
					delete frontmatter.after;
				}
			}
			if (data.timeline !== undefined) {
				if (data.timeline) {
					frontmatter.timeline = formatWikilink(data.timeline);
				} else {
					delete frontmatter.timeline;
				}
			}
			if (data.groups !== undefined) {
				if (data.groups && data.groups.length > 0) {
					frontmatter.groups = data.groups;
				} else {
					delete frontmatter.groups;
				}
			}
		});

		// Invalidate cache
		this.invalidateCache();
	}

	/**
	 * Parse a file into an EventNote object
	 */
	parseEventNote(file: TFile, frontmatter: Record<string, unknown>): EventNote | null {
		// Must have type: event
		if (frontmatter.type !== 'event') {
			return null;
		}

		// Must have required fields
		const crId = frontmatter.cr_id as string;
		const title = frontmatter.title as string;
		const eventType = frontmatter.event_type as string;

		if (!crId || !title || !eventType) {
			return null;
		}

		// Parse date precision
		let datePrecision: DatePrecision = 'unknown';
		if (frontmatter.date_precision) {
			const precision = fmToString(frontmatter.date_precision).toLowerCase();
			if (['exact', 'month', 'year', 'decade', 'estimated', 'range', 'unknown'].includes(precision)) {
				datePrecision = precision as DatePrecision;
			}
		}

		// Parse confidence
		let confidence: EventConfidence = 'medium';
		if (frontmatter.confidence) {
			const conf = fmToString(frontmatter.confidence).toLowerCase();
			if (['high', 'medium', 'low', 'unknown'].includes(conf)) {
				confidence = conf as EventConfidence;
			}
		}

		return {
			file,
			filePath: file.path,
			crId,
			title,
			eventType,
			date: frontmatter.date ? fmToString(frontmatter.date) : undefined,
			dateEnd: frontmatter.date_end ? fmToString(frontmatter.date_end) : undefined,
			datePrecision,
			person: frontmatter.person ? fmToString(frontmatter.person) : undefined,
			persons: fmToStringArray(frontmatter.persons),
			place: frontmatter.place ? fmToString(frontmatter.place) : undefined,
			sources: fmToStringArray(frontmatter.sources),
			confidence,
			description: frontmatter.description ? fmToString(frontmatter.description) : undefined,
			isCanonical: frontmatter.is_canonical === true,
			universe: frontmatter.universe ? fmToString(frontmatter.universe) : undefined,
			dateSystem: frontmatter.date_system ? fmToString(frontmatter.date_system) : undefined,
			before: fmToStringArray(frontmatter.before),
			after: fmToStringArray(frontmatter.after),
			timeline: frontmatter.timeline ? fmToString(frontmatter.timeline) : undefined,
			sortOrder: typeof frontmatter.sort_order === 'number' ? frontmatter.sort_order : undefined,
			groups: fmToStringArray(frontmatter.groups)
		};
	}

	/**
	 * Get event type definition for an event
	 */
	getEventTypeDefinition(event: EventNote): EventTypeDefinition | undefined {
		return getEventType(
			event.eventType,
			this.settings.customEventTypes || [],
			this.settings.showBuiltInEventTypes !== false
		);
	}

	/**
	 * Get all available event types
	 */
	getAvailableEventTypes(): EventTypeDefinition[] {
		return getAllEventTypes(
			this.settings.customEventTypes || [],
			this.settings.showBuiltInEventTypes !== false
		);
	}

	// ============ Private Methods ============

	/**
	 * Load all event notes into the cache
	 */
	private loadEventCache(): void {
		this.eventCache.clear();

		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const event = this.parseEventNote(file, cache.frontmatter);
			if (event) {
				this.eventCache.set(event.crId, event);
			}
		}

		this.cacheValid = true;
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
	 * Normalize a wikilink for comparison (remove brackets and trim)
	 */
	private normalizeWikilink(link: string): string {
		return link
			.replace(/^\[\[/, '')
			.replace(/\]\]$/, '')
			.trim();
	}
}
