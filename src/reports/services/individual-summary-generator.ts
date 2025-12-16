/**
 * Individual Summary Generator
 *
 * Generates a comprehensive summary report for a single person.
 */

import { App } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import type {
	IndividualSummaryOptions,
	IndividualSummaryResult,
	ReportPerson,
	ReportEvent
} from '../types/report-types';
import { FamilyGraphService, PersonNode } from '../../core/family-graph';
import { FolderFilterService } from '../../core/folder-filter';
import { EventService } from '../../events/services/event-service';
import { getLogger } from '../../core/logging';

const logger = getLogger('IndividualSummaryGenerator');

/**
 * Generator for Individual Summary reports
 */
export class IndividualSummaryGenerator {
	private app: App;
	private settings: CanvasRootsSettings;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Generate an Individual Summary report
	 */
	async generate(options: IndividualSummaryOptions): Promise<IndividualSummaryResult> {
		logger.info('generate', 'Generating Individual Summary', { personCrId: options.personCrId });

		const warnings: string[] = [];
		const sourcesSet = new Set<string>();
		const events: ReportEvent[] = [];

		// Initialize family graph service
		const familyGraph = new FamilyGraphService(this.app);
		if (this.settings.folderFilterMode !== 'disabled') {
			familyGraph.setFolderFilter(new FolderFilterService(this.settings));
		}
		familyGraph.setPropertyAliases(this.settings.propertyAliases);
		familyGraph.setValueAliases(this.settings.valueAliases);
		familyGraph.setSettings(this.settings);
		familyGraph.ensureCacheLoaded();

		// Get the person
		const personNode = familyGraph.getPersonByCrId(options.personCrId);
		if (!personNode) {
			return {
				success: false,
				content: '',
				suggestedFilename: 'individual-summary.md',
				stats: { peopleCount: 0, eventsCount: 0, sourcesCount: 0 },
				error: `Person not found: ${options.personCrId}`,
				warnings: [],
				person: { crId: '', name: 'Unknown', filePath: '' },
				events: []
			};
		}

		const person = this.nodeToReportPerson(personNode);

		// Get events if requested
		if (options.includeEvents) {
			const eventService = new EventService(this.app, this.settings);
			const personEvents = await this.getPersonEvents(personNode, eventService);
			events.push(...personEvents);

			// Collect sources from events
			for (const event of events) {
				for (const source of event.sources) {
					sourcesSet.add(source);
				}
			}
		}

		// Get family relationships
		const family = this.getFamily(personNode, familyGraph);

		// Generate markdown content
		const content = this.generateMarkdown(
			person,
			family,
			events,
			options,
			sourcesSet
		);

		const suggestedFilename = `Individual Summary - ${person.name}.md`;

		return {
			success: true,
			content,
			suggestedFilename: this.sanitizeFilename(suggestedFilename),
			stats: {
				peopleCount: 1,
				eventsCount: events.length,
				sourcesCount: sourcesSet.size
			},
			warnings,
			person,
			events
		};
	}

	/**
	 * Convert a PersonNode to ReportPerson
	 */
	private nodeToReportPerson(node: PersonNode): ReportPerson {
		return {
			crId: node.crId,
			name: node.name,
			birthDate: node.birthDate,
			birthPlace: node.birthPlace,
			deathDate: node.deathDate,
			deathPlace: node.deathPlace,
			sex: this.normalizeSex(node.sex),
			occupation: node.occupation,
			filePath: node.file.path
		};
	}

	/**
	 * Normalize sex value to expected type
	 */
	private normalizeSex(sex?: string): 'male' | 'female' | 'other' | 'unknown' | undefined {
		if (!sex) return undefined;
		const lower = sex.toLowerCase();
		if (lower === 'male' || lower === 'm') return 'male';
		if (lower === 'female' || lower === 'f') return 'female';
		if (lower === 'other') return 'other';
		return 'unknown';
	}

	/**
	 * Get family relationships for a person
	 */
	private getFamily(node: PersonNode, familyGraph: FamilyGraphService): {
		father?: ReportPerson;
		mother?: ReportPerson;
		spouses: ReportPerson[];
		children: ReportPerson[];
	} {
		const family: {
			father?: ReportPerson;
			mother?: ReportPerson;
			spouses: ReportPerson[];
			children: ReportPerson[];
		} = {
			spouses: [],
			children: []
		};

		// Parents
		if (node.fatherCrId) {
			const father = familyGraph.getPersonByCrId(node.fatherCrId);
			if (father) family.father = this.nodeToReportPerson(father);
		}
		if (node.motherCrId) {
			const mother = familyGraph.getPersonByCrId(node.motherCrId);
			if (mother) family.mother = this.nodeToReportPerson(mother);
		}

		// Spouses
		for (const spouseCrId of node.spouseCrIds) {
			const spouse = familyGraph.getPersonByCrId(spouseCrId);
			if (spouse) family.spouses.push(this.nodeToReportPerson(spouse));
		}

		// Children
		for (const childCrId of node.childrenCrIds) {
			const child = familyGraph.getPersonByCrId(childCrId);
			if (child) family.children.push(this.nodeToReportPerson(child));
		}

		return family;
	}

	/**
	 * Get events associated with a person
	 */
	private async getPersonEvents(node: PersonNode, eventService: EventService): Promise<ReportEvent[]> {
		const events: ReportEvent[] = [];

		// Get all events from vault
		const allEvents = await eventService.getAllEvents();

		// Filter events that reference this person
		const personName = node.name;
		const personLink = `[[${personName}]]`;

		for (const event of allEvents) {
			// Check if this event involves the person
			// Events can have 'person' (single) or 'persons' (multiple) fields
			const personRef = event.person ?? '';
			const personsRefs = event.persons ?? [];
			const allRefs = [personRef, ...personsRefs].filter(Boolean);

			const isParticipant = allRefs.some((p: string) =>
				p.includes(personName) || p === personLink
			);

			if (isParticipant) {
				events.push({
					type: event.eventType,
					date: event.date,
					place: event.place,
					description: event.description,
					sources: event.sources || []
				});
			}
		}

		// Add implicit events from vitals
		if (node.birthDate || node.birthPlace) {
			events.push({
				type: 'Birth',
				date: node.birthDate,
				place: node.birthPlace,
				sources: []
			});
		}

		if (node.deathDate || node.deathPlace) {
			events.push({
				type: 'Death',
				date: node.deathDate,
				place: node.deathPlace,
				sources: []
			});
		}

		// Sort events by date
		events.sort((a, b) => {
			if (!a.date && !b.date) return 0;
			if (!a.date) return 1;
			if (!b.date) return -1;
			return a.date.localeCompare(b.date);
		});

		return events;
	}

	/**
	 * Generate markdown content for the Individual Summary
	 */
	private generateMarkdown(
		person: ReportPerson,
		family: {
			father?: ReportPerson;
			mother?: ReportPerson;
			spouses: ReportPerson[];
			children: ReportPerson[];
		},
		events: ReportEvent[],
		options: IndividualSummaryOptions,
		sourcesSet: Set<string>
	): string {
		const lines: string[] = [];

		// Title
		lines.push(`# Individual Summary: ${person.name}`);
		lines.push('');

		// Vital Statistics
		lines.push('## Vital statistics');
		if (person.birthDate || person.birthPlace) {
			const birthParts = [person.birthDate, person.birthPlace].filter(Boolean);
			lines.push(`- **Birth:** ${birthParts.join(', ')}`);
		}
		if (person.deathDate || person.deathPlace) {
			const deathParts = [person.deathDate, person.deathPlace].filter(Boolean);
			lines.push(`- **Death:** ${deathParts.join(', ')}`);
		}
		if (person.sex) {
			lines.push(`- **Sex:** ${person.sex.charAt(0).toUpperCase() + person.sex.slice(1)}`);
		}
		if (options.includeAttributes && person.occupation) {
			lines.push(`- **Occupation:** ${person.occupation}`);
		}
		lines.push('');

		// Family section
		if (options.includeFamily) {
			// Parents
			lines.push('## Parents');
			if (family.father || family.mother) {
				if (family.father) lines.push(`- **Father:** [[${family.father.name}]]`);
				if (family.mother) lines.push(`- **Mother:** [[${family.mother.name}]]`);
			} else {
				lines.push('No parents recorded.');
			}
			lines.push('');

			// Spouses
			lines.push('## Spouses');
			if (family.spouses.length > 0) {
				for (let i = 0; i < family.spouses.length; i++) {
					const spouse = family.spouses[i];
					lines.push(`${i + 1}. [[${spouse.name}]]`);
				}
			} else {
				lines.push('No spouses recorded.');
			}
			lines.push('');

			// Children
			lines.push('## Children');
			if (family.children.length > 0) {
				for (let i = 0; i < family.children.length; i++) {
					const child = family.children[i];
					const dates = [child.birthDate, child.deathDate].filter(Boolean).join('-');
					const datesStr = dates ? ` (${dates})` : '';
					lines.push(`${i + 1}. [[${child.name}]]${datesStr}`);
				}
			} else {
				lines.push('No children recorded.');
			}
			lines.push('');
		}

		// Life Events
		if (options.includeEvents && events.length > 0) {
			lines.push('## Life events');
			lines.push('| Date | Event | Place | Source |');
			lines.push('|------|-------|-------|--------|');

			for (const event of events) {
				const date = event.date ?? '';
				const type = event.type;
				const place = event.place ?? '';
				const source = event.sources.length > 0 ? `[[${event.sources[0]}]]` : '';
				lines.push(`| ${date} | ${type} | ${place} | ${source} |`);
			}
			lines.push('');
		}

		// Sources section
		if (options.includeSources && sourcesSet.size > 0) {
			lines.push('## Sources');
			for (const source of Array.from(sourcesSet).sort()) {
				lines.push(`- [[${source}]]`);
			}
			lines.push('');
		}

		// Footer
		lines.push('---');
		lines.push('*Generated by Canvas Roots*');

		return lines.join('\n');
	}

	/**
	 * Sanitize a filename by removing invalid characters
	 */
	private sanitizeFilename(filename: string): string {
		return filename.replace(/[<>:"/\\|?*]/g, '-');
	}
}
