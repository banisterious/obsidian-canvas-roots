/**
 * Gramps XML Parser for Canvas Roots
 *
 * Parses Gramps XML files and converts them to Canvas Roots data structures.
 */

import {
	GrampsDatabase,
	GrampsPerson,
	GrampsFamily,
	GrampsEvent,
	GrampsPlace,
	GrampsName,
	GrampsDate,
	GrampsValidationResult,
	GrampsGender,
	GrampsFamilyRelType,
	GrampsRelType,
	convertGrampsGender,
	formatGrampsDate
} from './gramps-types';
import { getLogger } from '../core/logging';

const logger = getLogger('GrampsParser');

/**
 * Parsed person from Gramps format
 * Intermediate format before converting to Canvas Roots PersonData
 */
export interface ParsedGrampsPerson {
	id: string;
	handle: string;
	name: string;
	givenName?: string;
	surname?: string;
	gender?: 'M' | 'F';
	birthDate?: string;
	birthPlace?: string;
	deathDate?: string;
	deathPlace?: string;
	occupation?: string;
	// Parent references (filled during relationship processing)
	fatherRef?: string;
	motherRef?: string;
	// Spouse references (filled during relationship processing)
	spouseRefs: string[];
	// Marriage data per spouse
	marriages: Map<string, { date?: string; place?: string }>;
}

/**
 * Parsed place from Gramps format
 */
export interface ParsedGrampsPlace {
	handle: string;
	id?: string;
	name?: string;
	type?: string;
}

/**
 * Parsed event from Gramps format
 */
export interface ParsedGrampsEvent {
	handle: string;
	id?: string;
	type?: string;
	date?: string;
	placeName?: string;
	description?: string;
	/** Person handles associated with this event */
	personHandles: string[];
}

/**
 * Complete parsed Gramps data
 */
export interface ParsedGrampsData {
	persons: Map<string, ParsedGrampsPerson>;
	places: Map<string, ParsedGrampsPlace>;
	events: Map<string, ParsedGrampsEvent>;
	header: {
		source?: string;
		version?: string;
	};
}

/**
 * Gramps XML parsing error
 */
export class GrampsParseError extends Error {
	constructor(
		message: string,
		public path?: string
	) {
		super(message);
		this.name = 'GrampsParseError';
	}
}

/**
 * Gramps XML Parser
 */
export class GrampsParser {
	/**
	 * Validate Gramps XML content before parsing
	 */
	static validate(content: string): GrampsValidationResult {
		const result: GrampsValidationResult = {
			valid: true,
			errors: [],
			warnings: [],
			stats: {
				personCount: 0,
				familyCount: 0,
				eventCount: 0,
				placeCount: 0
			}
		};

		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(content, 'text/xml');

			// Check for XML parsing errors
			const parseError = doc.querySelector('parsererror');
			if (parseError) {
				result.valid = false;
				result.errors.push({
					message: `XML parsing error: ${parseError.textContent || 'Unknown error'}`
				});
				return result;
			}

			// Check for database element
			const database = doc.querySelector('database');
			if (!database) {
				result.valid = false;
				result.errors.push({
					message: 'No <database> element found - not a valid Gramps XML file'
				});
				return result;
			}

			// Count elements
			const people = doc.querySelectorAll('people > person');
			const families = doc.querySelectorAll('families > family');
			const events = doc.querySelectorAll('events > event');
			const places = doc.querySelectorAll('places > placeobj');

			result.stats.personCount = people.length;
			result.stats.familyCount = families.length;
			result.stats.eventCount = events.length;
			result.stats.placeCount = places.length;

			// Validate each person has required elements
			people.forEach((person, index) => {
				const handle = person.getAttribute('handle');
				if (!handle) {
					result.errors.push({
						path: `people/person[${index}]`,
						message: 'Person is missing required handle attribute'
					});
					result.valid = false;
				}

				// Check for gender
				const gender = person.querySelector('gender');
				if (!gender) {
					result.warnings.push({
						path: `people/person[${index}]`,
						message: `Person ${handle || index} has no gender element`
					});
				}

				// Check for name
				const name = person.querySelector('name');
				if (!name) {
					result.warnings.push({
						path: `people/person[${index}]`,
						message: `Person ${handle || index} has no name`
					});
				}
			});

			// Validate families
			families.forEach((family, index) => {
				const handle = family.getAttribute('handle');
				if (!handle) {
					result.errors.push({
						path: `families/family[${index}]`,
						message: 'Family is missing required handle attribute'
					});
					result.valid = false;
				}
			});

		} catch (error) {
			result.valid = false;
			result.errors.push({
				message: `Validation error: ${error instanceof Error ? error.message : String(error)}`
			});
		}

		return result;
	}

	/**
	 * Parse Gramps XML content
	 */
	static parse(content: string): ParsedGrampsData {
		const parser = new DOMParser();
		const doc = parser.parseFromString(content, 'text/xml');

		// Check for XML parsing errors
		const parseError = doc.querySelector('parsererror');
		if (parseError) {
			throw new GrampsParseError(
				`XML parsing error: ${parseError.textContent || 'Unknown error'}`
			);
		}

		// Parse raw Gramps database
		const database = this.parseDatabase(doc);

		// Convert to parsed format with resolved relationships
		const persons = new Map<string, ParsedGrampsPerson>();

		// First pass: create all persons
		for (const [handle, grampsPerson] of database.persons) {
			const parsed = this.convertPerson(grampsPerson, database);
			if (parsed) {
				persons.set(handle, parsed);
			}
		}

		// Second pass: resolve family relationships
		this.resolveRelationships(persons, database);

		// Convert places to parsed format
		const places = new Map<string, ParsedGrampsPlace>();
		for (const [handle, grampsPlace] of database.places) {
			places.set(handle, {
				handle: grampsPlace.handle,
				id: grampsPlace.id,
				name: grampsPlace.name,
				type: grampsPlace.type
			});
		}

		// Convert events to parsed format and link to persons
		const events = new Map<string, ParsedGrampsEvent>();
		for (const [handle, grampsEvent] of database.events) {
			// Find persons associated with this event
			const personHandles: string[] = [];
			for (const [personHandle, person] of database.persons) {
				if (person.eventrefs.some(ref => ref.hlink === handle)) {
					personHandles.push(personHandle);
				}
			}

			// Resolve place name
			let placeName: string | undefined;
			if (grampsEvent.place) {
				const place = database.places.get(grampsEvent.place);
				placeName = place?.name;
			}

			events.set(handle, {
				handle: grampsEvent.handle,
				id: grampsEvent.id,
				type: grampsEvent.type,
				date: formatGrampsDate(grampsEvent.date),
				placeName,
				description: grampsEvent.description,
				personHandles
			});
		}

		logger.info('parse', `Parsed ${persons.size} persons, ${places.size} places, and ${events.size} events from Gramps XML`);

		return {
			persons,
			places,
			events,
			header: {
				source: database.header?.createdBy,
				version: database.header?.version
			}
		};
	}

	/**
	 * Parse the raw Gramps database structure
	 */
	private static parseDatabase(doc: Document): GrampsDatabase {
		const database: GrampsDatabase = {
			persons: new Map(),
			families: new Map(),
			events: new Map(),
			places: new Map()
		};

		// Parse header
		const header = doc.querySelector('header');
		if (header) {
			database.header = {
				createdBy: header.querySelector('researcher > resname')?.textContent || undefined,
				createdDate: header.getAttribute('created') || undefined,
				version: header.querySelector('mediapath')?.textContent || undefined
			};
		}

		// Parse events first (needed for person/family data)
		const events = doc.querySelectorAll('events > event');
		events.forEach(eventEl => {
			const event = this.parseEvent(eventEl);
			if (event) {
				database.events.set(event.handle, event);
			}
		});

		// Parse places
		const places = doc.querySelectorAll('places > placeobj');
		places.forEach(placeEl => {
			const place = this.parsePlace(placeEl);
			if (place) {
				database.places.set(place.handle, place);
			}
		});

		// Parse persons
		const people = doc.querySelectorAll('people > person');
		people.forEach(personEl => {
			const person = this.parsePerson(personEl);
			if (person) {
				database.persons.set(person.handle, person);
			}
		});

		// Parse families
		const families = doc.querySelectorAll('families > family');
		families.forEach(familyEl => {
			const family = this.parseFamily(familyEl);
			if (family) {
				database.families.set(family.handle, family);
			}
		});

		return database;
	}

	/**
	 * Parse a person element
	 */
	private static parsePerson(el: Element): GrampsPerson | null {
		const handle = el.getAttribute('handle');
		if (!handle) return null;

		const person: GrampsPerson = {
			handle,
			id: el.getAttribute('id') || undefined,
			gender: this.parseGender(el.querySelector('gender')?.textContent),
			names: [],
			eventrefs: [],
			childof: [],
			parentin: []
		};

		// Parse names
		el.querySelectorAll('name').forEach(nameEl => {
			const name = this.parseName(nameEl);
			if (name) {
				person.names.push(name);
			}
		});

		// Parse event references
		el.querySelectorAll('eventref').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				person.eventrefs.push({
					hlink,
					role: refEl.getAttribute('role') || undefined
				});
			}
		});

		// Parse family references
		el.querySelectorAll('childof').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				person.childof.push(hlink);
			}
		});

		el.querySelectorAll('parentin').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				person.parentin.push(hlink);
			}
		});

		return person;
	}

	/**
	 * Parse gender text to type
	 */
	private static parseGender(text?: string | null): GrampsGender | undefined {
		if (!text) return undefined;
		const g = text.trim().toUpperCase();
		if (g === 'M' || g === 'MALE') return 'M';
		if (g === 'F' || g === 'FEMALE') return 'F';
		return 'U';
	}

	/**
	 * Parse a name element
	 */
	private static parseName(el: Element): GrampsName | null {
		const name: GrampsName = {
			type: el.getAttribute('type') || undefined,
			first: el.querySelector('first')?.textContent || undefined,
			call: el.querySelector('call')?.textContent || undefined,
			surname: el.querySelector('surname')?.textContent || undefined,
			suffix: el.querySelector('suffix')?.textContent || undefined,
			title: el.querySelector('title')?.textContent || undefined,
			nick: el.querySelector('nick')?.textContent || undefined,
			primary: el.getAttribute('alt') !== '1'
		};

		return name;
	}

	/**
	 * Parse an event element
	 */
	private static parseEvent(el: Element): GrampsEvent | null {
		const handle = el.getAttribute('handle');
		if (!handle) return null;

		const event: GrampsEvent = {
			handle,
			id: el.getAttribute('id') || undefined,
			type: el.querySelector('type')?.textContent || undefined,
			date: this.parseDate(el),
			place: el.querySelector('place')?.getAttribute('hlink') || undefined,
			description: el.querySelector('description')?.textContent || undefined
		};

		return event;
	}

	/**
	 * Parse date elements
	 */
	private static parseDate(el: Element): GrampsDate | undefined {
		// Try dateval first (most common)
		const dateval = el.querySelector('dateval');
		if (dateval) {
			return {
				type: 'dateval',
				val: dateval.getAttribute('val') || undefined,
				quality: dateval.getAttribute('quality') as 'estimated' | 'calculated' | undefined
			};
		}

		// Try daterange
		const daterange = el.querySelector('daterange');
		if (daterange) {
			return {
				type: 'daterange',
				start: daterange.getAttribute('start') || undefined,
				stop: daterange.getAttribute('stop') || undefined,
				quality: daterange.getAttribute('quality') as 'estimated' | 'calculated' | undefined
			};
		}

		// Try datespan
		const datespan = el.querySelector('datespan');
		if (datespan) {
			return {
				type: 'datespan',
				start: datespan.getAttribute('start') || undefined,
				stop: datespan.getAttribute('stop') || undefined,
				quality: datespan.getAttribute('quality') as 'estimated' | 'calculated' | undefined
			};
		}

		// Try datestr (free-form text)
		const datestr = el.querySelector('datestr');
		if (datestr) {
			return {
				type: 'datestr',
				text: datestr.getAttribute('val') || undefined
			};
		}

		return undefined;
	}

	/**
	 * Parse a place element
	 */
	private static parsePlace(el: Element): GrampsPlace | null {
		const handle = el.getAttribute('handle');
		if (!handle) return null;

		const place: GrampsPlace = {
			handle,
			id: el.getAttribute('id') || undefined,
			name: el.querySelector('pname')?.getAttribute('value') || undefined,
			type: el.getAttribute('type') || undefined
		};

		return place;
	}

	/**
	 * Parse a family element
	 */
	private static parseFamily(el: Element): GrampsFamily | null {
		const handle = el.getAttribute('handle');
		if (!handle) return null;

		const family: GrampsFamily = {
			handle,
			id: el.getAttribute('id') || undefined,
			reltype: this.parseFamilyRelType(el.querySelector('rel')?.getAttribute('type')),
			father: el.querySelector('father')?.getAttribute('hlink') || undefined,
			mother: el.querySelector('mother')?.getAttribute('hlink') || undefined,
			eventrefs: [],
			children: []
		};

		// Parse event references
		el.querySelectorAll('eventref').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				family.eventrefs.push({
					hlink,
					role: refEl.getAttribute('role') || undefined
				});
			}
		});

		// Parse children
		el.querySelectorAll('childref').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				family.children.push({
					hlink,
					mrel: this.parseRelType(refEl.getAttribute('mrel')),
					frel: this.parseRelType(refEl.getAttribute('frel'))
				});
			}
		});

		return family;
	}

	/**
	 * Parse relationship type
	 */
	private static parseRelType(text?: string | null): GrampsRelType | undefined {
		if (!text) return undefined;
		const t = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
		if (['Birth', 'Adopted', 'Stepchild', 'Sponsored', 'Foster', 'Unknown'].includes(t)) {
			return t as GrampsRelType;
		}
		return undefined;
	}

	/**
	 * Parse family relationship type
	 */
	private static parseFamilyRelType(text?: string | null): GrampsFamilyRelType | undefined {
		if (!text) return undefined;
		const t = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
		if (['Married', 'Unmarried', 'Civil Union', 'Unknown'].includes(t)) {
			return t as GrampsFamilyRelType;
		}
		return undefined;
	}

	/**
	 * Convert a GrampsPerson to ParsedGrampsPerson
	 */
	private static convertPerson(
		person: GrampsPerson,
		database: GrampsDatabase
	): ParsedGrampsPerson | null {
		// Get primary name
		const primaryName = person.names.find(n => n.primary) || person.names[0];
		const fullName = this.formatName(primaryName);

		// Find birth and death events
		let birthDate: string | undefined;
		let birthPlace: string | undefined;
		let deathDate: string | undefined;
		let deathPlace: string | undefined;
		let occupation: string | undefined;

		for (const ref of person.eventrefs) {
			const event = database.events.get(ref.hlink);
			if (!event) continue;

			const eventType = event.type?.toLowerCase();
			if (eventType === 'birth') {
				birthDate = formatGrampsDate(event.date);
				if (event.place) {
					const place = database.places.get(event.place);
					birthPlace = place?.name;
				}
			} else if (eventType === 'death') {
				deathDate = formatGrampsDate(event.date);
				if (event.place) {
					const place = database.places.get(event.place);
					deathPlace = place?.name;
				}
			} else if (eventType === 'occupation') {
				occupation = event.description;
			}
		}

		return {
			id: person.id || person.handle,
			handle: person.handle,
			name: fullName || `Unknown (${person.id || person.handle})`,
			givenName: primaryName?.first,
			surname: primaryName?.surname,
			gender: convertGrampsGender(person.gender),
			birthDate,
			birthPlace,
			deathDate,
			deathPlace,
			occupation,
			spouseRefs: [],
			marriages: new Map()
		};
	}

	/**
	 * Format a name from its components
	 */
	private static formatName(name?: GrampsName): string | undefined {
		if (!name) return undefined;

		const parts: string[] = [];

		if (name.title) parts.push(name.title);
		if (name.first) parts.push(name.first);
		if (name.surname) parts.push(name.surname);
		if (name.suffix) parts.push(name.suffix);

		return parts.length > 0 ? parts.join(' ') : undefined;
	}

	/**
	 * Resolve family relationships to build parent/spouse references
	 */
	private static resolveRelationships(
		persons: Map<string, ParsedGrampsPerson>,
		database: GrampsDatabase
	): void {
		// Process each family to set parent/spouse/child relationships
		for (const [, family] of database.families) {
			const fatherHandle = family.father;
			const motherHandle = family.mother;

			// Set parent references for children
			for (const childRef of family.children) {
				const child = persons.get(childRef.hlink);
				if (child) {
					if (fatherHandle && persons.has(fatherHandle)) {
						child.fatherRef = fatherHandle;
					}
					if (motherHandle && persons.has(motherHandle)) {
						child.motherRef = motherHandle;
					}
				}
			}

			// Set spouse references
			if (fatherHandle && motherHandle) {
				const father = persons.get(fatherHandle);
				const mother = persons.get(motherHandle);

				if (father && mother) {
					if (!father.spouseRefs.includes(motherHandle)) {
						father.spouseRefs.push(motherHandle);
					}
					if (!mother.spouseRefs.includes(fatherHandle)) {
						mother.spouseRefs.push(fatherHandle);
					}

					// Extract marriage info from family events
					for (const ref of family.eventrefs) {
						const event = database.events.get(ref.hlink);
						if (event?.type?.toLowerCase() === 'marriage') {
							const marriageData = {
								date: formatGrampsDate(event.date),
								place: event.place ? database.places.get(event.place)?.name : undefined
							};
							father.marriages.set(motherHandle, marriageData);
							mother.marriages.set(fatherHandle, marriageData);
						}
					}
				}
			}
		}
	}

	/**
	 * Check if content looks like Gramps XML
	 */
	static isGrampsXml(content: string): boolean {
		const trimmed = content.trim();
		// Must start with XML declaration or <database
		if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<database')) {
			return false;
		}

		// Check for Gramps-specific elements
		return (
			trimmed.includes('<database') &&
			(trimmed.includes('<people') || trimmed.includes('<families'))
		);
	}
}
