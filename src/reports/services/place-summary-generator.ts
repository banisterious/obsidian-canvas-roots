/**
 * Place Summary Generator
 *
 * Generates a report of events and people associated with a location,
 * including births, deaths, marriages, residences, and other events.
 */

import { App } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import type {
	PlaceSummaryOptions,
	PlaceSummaryResult,
	TimelineEntry,
	ReportPerson
} from '../types/report-types';
import { FamilyGraphService } from '../../core/family-graph';
import { PlaceGraphService } from '../../core/place-graph';
import { FolderFilterService } from '../../core/folder-filter';
import { EventService } from '../../events/services/event-service';
import { PlaceNode } from '../../models/place';
import { getLogger } from '../../core/logging';
import { extractWikilinkPath } from '../../utils/wikilink-resolver';

const logger = getLogger('PlaceSummaryGenerator');

/**
 * Generator for Place Summary reports
 */
export class PlaceSummaryGenerator {
	private app: App;
	private settings: CanvasRootsSettings;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Generate a Place Summary report
	 */
	async generate(options: PlaceSummaryOptions): Promise<PlaceSummaryResult> {
		await Promise.resolve(); // Satisfy async requirement
		logger.info('generate', 'Generating Place Summary', { placeCrId: options.placeCrId });

		const warnings: string[] = [];

		// Initialize services
		const placeGraph = new PlaceGraphService(this.app);
		placeGraph.setSettings(this.settings);
		placeGraph.setValueAliases(this.settings.valueAliases);
		if (this.settings.folderFilterMode !== 'disabled') {
			placeGraph.setFolderFilter(new FolderFilterService(this.settings));
		}
		placeGraph.ensureCacheLoaded();

		const familyGraph = new FamilyGraphService(this.app);
		if (this.settings.folderFilterMode !== 'disabled') {
			familyGraph.setFolderFilter(new FolderFilterService(this.settings));
		}
		familyGraph.setPropertyAliases(this.settings.propertyAliases);
		familyGraph.setValueAliases(this.settings.valueAliases);
		familyGraph.setSettings(this.settings);
		familyGraph.ensureCacheLoaded();

		const eventService = new EventService(this.app, this.settings);

		// Get the place
		const placeNode = placeGraph.getPlaceByCrId(options.placeCrId);
		if (!placeNode) {
			return this.errorResult(`Place not found: ${options.placeCrId}`);
		}

		// Build place hierarchy
		const hierarchy = this.buildHierarchy(placeNode, placeGraph);

		// Get child places if requested
		const placesToInclude: PlaceNode[] = [placeNode];
		if (options.includeChildPlaces) {
			const children = this.getDescendants(placeNode.id, placeGraph);
			placesToInclude.push(...children);
		}

		const placeNames = new Set(placesToInclude.map(p => p.name));

		// Collect people associated with this place
		const births: Array<{ person: ReportPerson; date?: string }> = [];
		const deaths: Array<{ person: ReportPerson; date?: string }> = [];
		const residences: Array<{ person: ReportPerson; period?: string }> = [];
		const marriages: Array<{ couple: string; date?: string }> = [];
		const personSet = new Set<string>();

		// Scan all people for place associations
		const allPeople = familyGraph.getAllPeople();
		for (const person of allPeople) {
			// Check birth place
			if (person.birthPlace && this.matchesPlace(person.birthPlace, placeNames)) {
				births.push({
					person: this.nodeToReportPerson(person),
					date: person.birthDate
				});
				personSet.add(person.crId);
			}

			// Check death place
			if (person.deathPlace && this.matchesPlace(person.deathPlace, placeNames)) {
				deaths.push({
					person: this.nodeToReportPerson(person),
					date: person.deathDate
				});
				personSet.add(person.crId);
			}
		}

		// Collect events at this place
		const allEvents = eventService.getAllEvents();
		const otherEvents: TimelineEntry[] = [];
		const marriageEvents: Array<{ couple: string; date?: string }> = [];

		for (const event of allEvents) {
			if (!event.place) continue;

			const eventPlaceName = this.extractLinkName(event.place);
			if (!placeNames.has(eventPlaceName)) continue;

			// Apply date filters
			if (options.dateFrom && event.date) {
				const sortDate = this.extractSortDate(event.date);
				if (sortDate < options.dateFrom) continue;
			}
			if (options.dateTo && event.date) {
				const sortDate = this.extractSortDate(event.date);
				if (sortDate > options.dateTo) continue;
			}

			// Apply event type filter
			if (options.eventTypes.length > 0 && !options.eventTypes.includes(event.eventType)) {
				continue;
			}

			// Categorize event
			const eventTypeLower = event.eventType.toLowerCase();
			if (eventTypeLower === 'marriage' || eventTypeLower === 'wedding') {
				const participants = this.getEventParticipants(event);
				marriageEvents.push({
					couple: participants.join(' & '),
					date: event.date
				});
			} else if (eventTypeLower === 'residence') {
				// Get participants for residence
				const participants = this.getEventParticipants(event);
				for (const name of participants) {
					const person = allPeople.find(p => p.name === name);
					if (person) {
						residences.push({
							person: this.nodeToReportPerson(person),
							period: event.date
						});
						personSet.add(person.crId);
					}
				}
			} else {
				// Other events
				const participants: ReportPerson[] = [];
				const participantNames = this.getEventParticipants(event);
				for (const name of participantNames) {
					const person = allPeople.find(p => p.name === name);
					if (person) {
						participants.push(this.nodeToReportPerson(person));
						personSet.add(person.crId);
					} else {
						participants.push({ crId: '', name, filePath: '' });
					}
				}

				otherEvents.push({
					date: event.date || '',
					sortDate: this.extractSortDate(event.date || '') || '9999-99-99',
					type: event.eventType,
					eventName: event.title,
					description: event.description,
					participants,
					place: eventPlaceName,
					placeCrId: placeNode.id,
					sources: event.sources || []
				});
			}
		}

		// Merge marriage events
		marriages.push(...marriageEvents);

		// Sort events chronologically
		otherEvents.sort((a, b) => a.sortDate.localeCompare(b.sortDate));

		// Calculate date range
		const allDates: string[] = [];
		for (const b of births) if (b.date) allDates.push(b.date);
		for (const d of deaths) if (d.date) allDates.push(d.date);
		for (const m of marriages) if (m.date) allDates.push(m.date);
		for (const e of otherEvents) if (e.date) allDates.push(e.date);

		const sortedDates = allDates
			.map(d => this.extractSortDate(d))
			.filter(Boolean)
			.sort();

		const dateRange: { earliest?: string; latest?: string } = {};
		if (sortedDates.length > 0) {
			dateRange.earliest = sortedDates[0];
			dateRange.latest = sortedDates[sortedDates.length - 1];
		}

		const summary = {
			eventCount: births.length + deaths.length + marriages.length + residences.length + otherEvents.length,
			personCount: personSet.size,
			dateRange
		};

		// Generate markdown content
		const content = this.generateMarkdown(
			placeNode,
			hierarchy,
			summary,
			births,
			deaths,
			marriages,
			residences,
			otherEvents,
			options
		);

		const suggestedFilename = `Place Summary - ${placeNode.name}.md`;

		return {
			success: true,
			content,
			suggestedFilename: this.sanitizeFilename(suggestedFilename),
			stats: {
				peopleCount: personSet.size,
				eventsCount: summary.eventCount,
				sourcesCount: 0
			},
			warnings,
			place: {
				crId: placeNode.id,
				name: placeNode.name,
				type: placeNode.placeType,
				hierarchy,
				coordinates: placeNode.coordinates
					? { lat: placeNode.coordinates.lat, lng: placeNode.coordinates.long }
					: undefined
			},
			summary,
			births,
			deaths,
			marriages,
			residences,
			otherEvents
		};
	}

	/**
	 * Build hierarchy path for a place
	 */
	private buildHierarchy(place: PlaceNode, placeGraph: PlaceGraphService): string[] {
		const hierarchy: string[] = [];
		let currentId = place.parentId;
		const visited = new Set<string>();

		while (currentId && !visited.has(currentId)) {
			visited.add(currentId);
			const parent = placeGraph.getPlaceByCrId(currentId);
			if (parent) {
				hierarchy.unshift(parent.name);
				currentId = parent.parentId;
			} else {
				break;
			}
		}

		return hierarchy;
	}

	/**
	 * Get all descendant places
	 */
	private getDescendants(placeId: string, placeGraph: PlaceGraphService): PlaceNode[] {
		const descendants: PlaceNode[] = [];
		const allPlaces = placeGraph.getAllPlaces();

		const collectDescendants = (parentId: string) => {
			for (const place of allPlaces) {
				if (place.parentId === parentId) {
					descendants.push(place);
					collectDescendants(place.id);
				}
			}
		};

		collectDescendants(placeId);
		return descendants;
	}

	/**
	 * Check if a place string matches any of the target places
	 */
	private matchesPlace(placeValue: string, targetNames: Set<string>): boolean {
		const placeName = this.extractLinkName(placeValue);
		return targetNames.has(placeName);
	}

	/**
	 * Get participant names from an event
	 */
	private getEventParticipants(event: { person?: string; persons?: string[] }): string[] {
		const participants: string[] = [];
		if (event.person) {
			participants.push(this.extractLinkName(event.person));
		}
		if (event.persons) {
			for (const p of event.persons) {
				participants.push(this.extractLinkName(p));
			}
		}
		return participants;
	}

	/**
	 * Convert a person node to ReportPerson
	 */
	private nodeToReportPerson(node: { crId: string; name: string; birthDate?: string; birthPlace?: string; deathDate?: string; deathPlace?: string; file: { path: string } }): ReportPerson {
		return {
			crId: node.crId,
			name: node.name,
			birthDate: node.birthDate,
			birthPlace: node.birthPlace,
			deathDate: node.deathDate,
			deathPlace: node.deathPlace,
			filePath: node.file.path
		};
	}

	/**
	 * Extract the name from a wikilink
	 */
	private extractLinkName(link: string): string {
		return extractWikilinkPath(link);
	}

	/**
	 * Extract a sortable date from various date formats
	 */
	private extractSortDate(date: string): string {
		if (!date) return '';
		if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
		if (/^\d{4}-\d{2}$/.test(date)) return date + '-01';
		if (/^\d{4}$/.test(date)) return date + '-01-01';
		const yearMatch = date.match(/\d{4}/);
		if (yearMatch) return yearMatch[0] + '-01-01';
		return '';
	}

	/**
	 * Generate markdown content
	 */
	private generateMarkdown(
		place: PlaceNode,
		hierarchy: string[],
		summary: { eventCount: number; personCount: number; dateRange: { earliest?: string; latest?: string } },
		births: Array<{ person: ReportPerson; date?: string }>,
		deaths: Array<{ person: ReportPerson; date?: string }>,
		marriages: Array<{ couple: string; date?: string }>,
		residences: Array<{ person: ReportPerson; period?: string }>,
		otherEvents: TimelineEntry[],
		options: PlaceSummaryOptions
	): string {
		const lines: string[] = [];
		const date = new Date().toLocaleDateString();

		// Title
		lines.push(`# Place Summary: ${place.name}`);
		lines.push('');
		lines.push(`Generated: ${date}`);
		lines.push('');

		// Place info
		if (options.showHierarchy && hierarchy.length > 0) {
			lines.push(`**Location:** ${[...hierarchy, place.name].join(' > ')}`);
			lines.push('');
		}

		if (place.placeType) {
			lines.push(`**Type:** ${place.placeType}`);
		}

		if (options.showCoordinates && place.coordinates) {
			lines.push(`**Coordinates:** ${place.coordinates.lat}, ${place.coordinates.long}`);
		}
		lines.push('');

		// Summary
		lines.push('## Summary');
		lines.push('');
		lines.push(`- **Total events:** ${summary.eventCount}`);
		lines.push(`- **People associated:** ${summary.personCount}`);
		if (summary.dateRange.earliest || summary.dateRange.latest) {
			const range = [summary.dateRange.earliest, summary.dateRange.latest].filter(Boolean).join(' to ');
			lines.push(`- **Date range:** ${range}`);
		}
		lines.push('');

		// Births
		if (births.length > 0) {
			lines.push(`## Births (${births.length})`);
			lines.push('');
			lines.push('| Person | Date |');
			lines.push('|--------|------|');
			for (const b of births) {
				lines.push(`| [[${b.person.name}]] | ${b.date || ''} |`);
			}
			lines.push('');
		}

		// Deaths
		if (deaths.length > 0) {
			lines.push(`## Deaths (${deaths.length})`);
			lines.push('');
			lines.push('| Person | Date |');
			lines.push('|--------|------|');
			for (const d of deaths) {
				lines.push(`| [[${d.person.name}]] | ${d.date || ''} |`);
			}
			lines.push('');
		}

		// Marriages
		if (marriages.length > 0) {
			lines.push(`## Marriages (${marriages.length})`);
			lines.push('');
			lines.push('| Couple | Date |');
			lines.push('|--------|------|');
			for (const m of marriages) {
				lines.push(`| ${m.couple} | ${m.date || ''} |`);
			}
			lines.push('');
		}

		// Residences
		if (residences.length > 0) {
			lines.push(`## Residences (${residences.length})`);
			lines.push('');
			lines.push('| Person | Period |');
			lines.push('|--------|--------|');
			for (const r of residences) {
				lines.push(`| [[${r.person.name}]] | ${r.period || ''} |`);
			}
			lines.push('');
		}

		// Other events
		if (otherEvents.length > 0) {
			lines.push(`## Other Events (${otherEvents.length})`);
			lines.push('');
			lines.push('| Date | Event | Participants |');
			lines.push('|------|-------|--------------|');
			for (const e of otherEvents) {
				const participants = e.participants.map(p => p.crId ? `[[${p.name}]]` : p.name).join(', ');
				lines.push(`| ${e.date} | ${e.type} | ${participants} |`);
			}
			lines.push('');
		}

		// Footer
		lines.push('---');
		lines.push('*Generated by Canvas Roots*');

		return lines.join('\n');
	}

	/**
	 * Create an error result
	 */
	private errorResult(error: string): PlaceSummaryResult {
		return {
			success: false,
			content: '',
			suggestedFilename: 'place-summary.md',
			stats: { peopleCount: 0, eventsCount: 0, sourcesCount: 0 },
			error,
			warnings: [],
			place: { crId: '', name: 'Unknown', hierarchy: [] },
			summary: { eventCount: 0, personCount: 0, dateRange: {} },
			births: [],
			deaths: [],
			marriages: [],
			residences: [],
			otherEvents: []
		};
	}

	/**
	 * Sanitize a filename
	 */
	private sanitizeFilename(filename: string): string {
		return filename.replace(/[<>:"/\\|?*]/g, '-');
	}
}
