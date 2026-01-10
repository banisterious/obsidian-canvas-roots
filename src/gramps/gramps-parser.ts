/**
 * Gramps XML Parser for Charted Roots
 *
 * Parses Gramps XML files and converts them to Charted Roots data structures.
 */

import {
	GrampsDatabase,
	GrampsPerson,
	GrampsFamily,
	GrampsEvent,
	GrampsPlace,
	GrampsSource,
	GrampsCitation,
	GrampsNote,
	GrampsNoteFormat,
	GrampsStyleRange,
	GrampsRepository,
	GrampsRepoRef,
	GrampsMedia,
	GrampsName,
	GrampsDate,
	GrampsValidationResult,
	GrampsGender,
	GrampsFamilyRelType,
	GrampsRelType,
	convertGrampsGender,
	formatGrampsDate,
	mapGrampsConfidence
} from './gramps-types';
import { getLogger } from '../core/logging';

const logger = getLogger('GrampsParser');

/**
 * Parsed person from Gramps format
 * Intermediate format before converting to Charted Roots PersonData
 */
export interface ParsedGrampsPerson {
	id: string;
	handle: string;
	name: string;
	givenName?: string;
	surname?: string;
	nickname?: string;          // Informal name or alias from Gramps <nick> element
	gender?: 'M' | 'F';
	birthDate?: string;
	birthPlace?: string;
	deathDate?: string;
	deathPlace?: string;
	occupation?: string;
	// Parent references (filled during relationship processing)
	fatherRef?: string;
	motherRef?: string;
	// Step-parent references (filled during relationship processing)
	stepfatherRefs: string[];
	stepmotherRefs: string[];
	// Adoptive parent references (filled during relationship processing)
	adoptiveFatherRef?: string;
	adoptiveMotherRef?: string;
	// Spouse references (filled during relationship processing)
	spouseRefs: string[];
	// Marriage data per spouse
	marriages: Map<string, { date?: string; place?: string }>;
	// Media references
	mediaRefs: string[];
	// Note references
	noteRefs: string[];
	// Custom attributes (e.g., Research Level)
	attributes: Record<string, string>;
}

/**
 * Parsed place from Gramps format
 */
export interface ParsedGrampsPlace {
	handle: string;
	id?: string;
	name?: string;
	type?: string;
	/** Handle link to parent place (for place hierarchy) */
	parentRef?: string;
	/** Whether this place has a ptitle (full hierarchical name) */
	hasPtitle?: boolean;
	mediaRefs: string[];
	/** Note references */
	noteRefs: string[];
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
	/** Map of person handle to their role in the event (e.g., "Primary", "Family", "Witness") */
	personRoles?: Map<string, string>;
	/** Citation handles for this event */
	citationHandles: string[];
	/** Media references */
	mediaRefs: string[];
	/** Note references (from event + family if applicable) */
	noteRefs: string[];
	/** Family handle if this event comes from a family (for family notes fallback) */
	familyHandle?: string;
}

/**
 * Parsed source from Gramps format
 */
export interface ParsedGrampsSource {
	handle: string;
	id?: string;
	title?: string;
	author?: string;
	pubinfo?: string;
	abbrev?: string;
	/** Note text content (resolved from noteRefs) */
	noteText?: string;
	/** Repository name (resolved from repoRef) - Phase 2.1 */
	repositoryName?: string;
	/** Repository type (e.g., Library, Archive) - Phase 2.1 */
	repositoryType?: string;
	/** Source medium (e.g., Book, Electronic) - Phase 2.1 */
	sourceMedium?: string;
	/** Media reference handles (for user to resolve manually) - Phase 2.2 */
	mediaRefs?: string[];
}

/**
 * Parsed citation from Gramps format
 */
export interface ParsedGrampsCitation {
	handle: string;
	id?: string;
	/** Charted Roots confidence level (high/medium/low) */
	confidence: 'high' | 'medium' | 'low';
	/** Source handle this citation references */
	sourceHandle?: string;
	/** Page/volume details */
	page?: string;
}

/**
 * Complete parsed Gramps data
 */
export interface ParsedGrampsData {
	persons: Map<string, ParsedGrampsPerson>;
	places: Map<string, ParsedGrampsPlace>;
	events: Map<string, ParsedGrampsEvent>;
	sources: Map<string, ParsedGrampsSource>;
	citations: Map<string, ParsedGrampsCitation>;
	header: {
		source?: string;
		version?: string;
	};
	/** Raw database for accessing media objects and other unparsed data */
	database: GrampsDatabase;
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
				placeCount: 0,
				sourceCount: 0,
				citationCount: 0,
				noteCount: 0
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
			const sources = doc.querySelectorAll('sources > source');
			const citations = doc.querySelectorAll('citations > citation');
			const notes = doc.querySelectorAll('notes > note');

			result.stats.personCount = people.length;
			result.stats.familyCount = families.length;
			result.stats.eventCount = events.length;
			result.stats.placeCount = places.length;
			result.stats.sourceCount = sources.length;
			result.stats.citationCount = citations.length;
			result.stats.noteCount = notes.length;

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
				type: grampsPlace.type,
				parentRef: grampsPlace.parentRef,
				hasPtitle: grampsPlace.hasPtitle,
				mediaRefs: grampsPlace.mediaRefs || [],
				noteRefs: grampsPlace.noteRefs || []
			});
		}

		// Convert events to parsed format and link to persons
		const events = new Map<string, ParsedGrampsEvent>();
		for (const [handle, grampsEvent] of database.events) {
			// Find persons associated with this event
			const personHandles: string[] = [];
			// Track family handle for family events (to attach family notes)
			let familyHandle: string | undefined;
			// Collect note references (event + family notes for family events)
			const noteRefs: string[] = [...(grampsEvent.noteRefs || [])];

			// Check person event references
			const personRoles = new Map<string, string>();
			for (const [personHandle, person] of database.persons) {
				const eventRef = person.eventrefs.find(ref => ref.hlink === handle);
				if (eventRef) {
					personHandles.push(personHandle);
					if (eventRef.role) {
						personRoles.set(personHandle, eventRef.role);
					}
				}
			}

			// Check family event references (for marriage, divorce, residence, etc.)
			// These events are attached to families, not directly to persons
			for (const [famHandle, family] of database.families) {
				if (family.eventrefs.some(ref => ref.hlink === handle)) {
					// Add father and mother as participants
					if (family.father && !personHandles.includes(family.father)) {
						personHandles.push(family.father);
					}
					if (family.mother && !personHandles.includes(family.mother)) {
						personHandles.push(family.mother);
					}
					// Track family handle for this event
					familyHandle = famHandle;
					// Include family notes on family events (family notes fallback)
					if (family.noteRefs && family.noteRefs.length > 0) {
						for (const noteRef of family.noteRefs) {
							if (!noteRefs.includes(noteRef)) {
								noteRefs.push(noteRef);
							}
						}
					}
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
				personHandles,
				personRoles: personRoles.size > 0 ? personRoles : undefined,
				citationHandles: grampsEvent.citationRefs || [],
				mediaRefs: grampsEvent.mediaRefs || [],
				noteRefs,
				familyHandle
			});
		}

		// Convert sources to parsed format with resolved notes and repositories
		const sources = new Map<string, ParsedGrampsSource>();
		for (const [handle, grampsSource] of database.sources) {
			// Resolve note text from noteRefs
			let noteText: string | undefined;
			if (grampsSource.noteRefs.length > 0) {
				const noteTexts: string[] = [];
				for (const noteRef of grampsSource.noteRefs) {
					const note = database.notes.get(noteRef);
					if (note?.text) {
						noteTexts.push(note.text);
					}
				}
				if (noteTexts.length > 0) {
					noteText = noteTexts.join('\n\n');
				}
			}

			// Resolve repository data (Phase 2.1)
			let repositoryName: string | undefined;
			let repositoryType: string | undefined;
			let sourceMedium: string | undefined;
			if (grampsSource.repoRef) {
				const repo = database.repositories.get(grampsSource.repoRef.hlink);
				if (repo) {
					repositoryName = repo.name;
					repositoryType = repo.type;
				}
				sourceMedium = grampsSource.repoRef.medium;
			}

			// Collect media refs for user to resolve (Phase 2.2)
			const mediaRefs = grampsSource.mediaRefs.length > 0 ? grampsSource.mediaRefs : undefined;

			sources.set(handle, {
				handle: grampsSource.handle,
				id: grampsSource.id,
				title: grampsSource.title,
				author: grampsSource.author,
				pubinfo: grampsSource.pubinfo,
				abbrev: grampsSource.abbrev,
				noteText,
				repositoryName,
				repositoryType,
				sourceMedium,
				mediaRefs
			});
		}

		// Convert citations to parsed format with mapped confidence
		const citations = new Map<string, ParsedGrampsCitation>();
		for (const [handle, grampsCitation] of database.citations) {
			citations.set(handle, {
				handle: grampsCitation.handle,
				id: grampsCitation.id,
				confidence: mapGrampsConfidence(grampsCitation.confidence),
				sourceHandle: grampsCitation.sourceRef,
				page: grampsCitation.page
			});
		}

		logger.info('parse', `Parsed ${persons.size} persons, ${places.size} places, ${events.size} events, ${sources.size} sources, ${citations.size} citations, and ${database.media.size} media objects from Gramps XML`);

		return {
			persons,
			places,
			events,
			sources,
			citations,
			header: {
				source: database.header?.createdBy,
				version: database.header?.version
			},
			database
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
			places: new Map(),
			sources: new Map(),
			citations: new Map(),
			notes: new Map(),
			repositories: new Map(),
			media: new Map()
		};

		// Parse header
		const header = doc.querySelector('header');
		if (header) {
			database.header = {
				createdBy: header.querySelector('researcher > resname')?.textContent || undefined,
				createdDate: header.getAttribute('created') || undefined,
				version: header.querySelector('grampsversion')?.textContent || undefined,
				mediapath: header.querySelector('mediapath')?.textContent || undefined
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

		// Parse notes (needed for sources)
		const notes = doc.querySelectorAll('notes > note');
		notes.forEach(noteEl => {
			const note = this.parseNote(noteEl);
			if (note) {
				database.notes.set(note.handle, note);
			}
		});

		// Parse repositories (needed for sources)
		const repositories = doc.querySelectorAll('repositories > repository');
		repositories.forEach(repoEl => {
			const repo = this.parseRepository(repoEl);
			if (repo) {
				database.repositories.set(repo.handle, repo);
			}
		});

		// Parse sources (needed for citations)
		const sources = doc.querySelectorAll('sources > source');
		sources.forEach(sourceEl => {
			const source = this.parseSource(sourceEl);
			if (source) {
				database.sources.set(source.handle, source);
			}
		});

		// Parse media objects
		const mediaObjects = doc.querySelectorAll('objects > object');
		mediaObjects.forEach(mediaEl => {
			const media = this.parseMedia(mediaEl);
			if (media) {
				database.media.set(media.handle, media);
			}
		});

		// Parse citations (needed for events)
		const citations = doc.querySelectorAll('citations > citation');
		citations.forEach(citationEl => {
			const citation = this.parseCitation(citationEl);
			if (citation) {
				database.citations.set(citation.handle, citation);
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
			parentin: [],
			mediaRefs: [],
			attributes: [],
			noteRefs: []
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

		// Parse media references
		el.querySelectorAll('objref').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				person.mediaRefs.push(hlink);
			}
		});

		// Parse person attributes (e.g., Research Level)
		el.querySelectorAll(':scope > attribute').forEach(attrEl => {
			const type = attrEl.getAttribute('type');
			const value = attrEl.getAttribute('value');
			if (type && value) {
				person.attributes.push({ type, value });
			}
		});

		// Parse note references
		el.querySelectorAll('noteref').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				person.noteRefs.push(hlink);
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

		// Parse citation references
		const citationRefs: string[] = [];
		el.querySelectorAll('citationref').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				citationRefs.push(hlink);
			}
		});

		// Parse media references
		const mediaRefs: string[] = [];
		el.querySelectorAll('objref').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				mediaRefs.push(hlink);
			}
		});

		// Parse note references
		const noteRefs: string[] = [];
		el.querySelectorAll('noteref').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				noteRefs.push(hlink);
			}
		});

		const event: GrampsEvent = {
			handle,
			id: el.getAttribute('id') || undefined,
			type: el.querySelector('type')?.textContent || undefined,
			date: this.parseDate(el),
			place: el.querySelector('place')?.getAttribute('hlink') || undefined,
			description: el.querySelector('description')?.textContent || undefined,
			citationRefs,
			mediaRefs,
			noteRefs
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

		// Parse media references
		const mediaRefs: string[] = [];
		el.querySelectorAll('objref').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				mediaRefs.push(hlink);
			}
		});

		// Parse parent place reference (placeref element)
		const placeRefEl = el.querySelector('placeref');
		const parentRef = placeRefEl?.getAttribute('hlink') || undefined;

		// Gramps places can have:
		// - <ptitle> - Full hierarchical name (e.g., "Atlanta, Fulton County, Georgia, USA")
		// - <pname value="..."> - Individual place name component (e.g., "Atlanta")
		// Prefer ptitle if available as it contains the full place hierarchy
		let ptitle = el.querySelector('ptitle')?.textContent?.trim();
		const pname = el.querySelector('pname')?.getAttribute('value');

		// Strip wikilink brackets if present (some Gramps exports include these)
		if (ptitle) {
			ptitle = ptitle.replace(/^\[\[/, '').replace(/\]\]$/, '');
		}

		// Parse note references
		const noteRefs: string[] = [];
		el.querySelectorAll('noteref').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				noteRefs.push(hlink);
			}
		});

		const place: GrampsPlace = {
			handle,
			id: el.getAttribute('id') || undefined,
			name: ptitle || pname || undefined,
			type: el.getAttribute('type') || undefined,
			parentRef,
			hasPtitle: !!ptitle,
			mediaRefs,
			noteRefs
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
			children: [],
			noteRefs: []
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

		// Parse note references
		el.querySelectorAll('noteref').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				family.noteRefs.push(hlink);
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
	 * Parse a note element
	 */
	private static parseNote(el: Element): GrampsNote | null {
		const handle = el.getAttribute('handle');
		if (!handle) return null;

		// Parse format attribute: 0 = FLOWED, 1 = FORMATTED
		const formatAttr = el.getAttribute('format');
		const format: GrampsNoteFormat | undefined = formatAttr === '1' ? 'formatted' :
			formatAttr === '0' ? 'flowed' : undefined;

		// Parse privacy attribute
		const priv = el.getAttribute('priv') === '1';

		// Parse style elements
		const styles: GrampsStyleRange[] = [];
		el.querySelectorAll('style').forEach(styleEl => {
			const styleRange = this.parseStyle(styleEl);
			if (styleRange) {
				styles.push(styleRange);
			}
		});

		const note: GrampsNote = {
			handle,
			id: el.getAttribute('id') || undefined,
			type: el.getAttribute('type') || undefined,
			text: el.querySelector('text')?.textContent || undefined,
			format,
			private: priv || undefined,
			styles: styles.length > 0 ? styles : undefined
		};

		return note;
	}

	/**
	 * Parse a style element from a note
	 */
	private static parseStyle(el: Element): GrampsStyleRange | null {
		const name = el.getAttribute('name')?.toLowerCase();
		const value = el.getAttribute('value');

		// Map Gramps style names to our types
		let type: GrampsStyleRange['type'] | undefined;
		switch (name) {
			case 'bold':
				type = 'bold';
				break;
			case 'italic':
				type = 'italic';
				break;
			case 'underline':
				type = 'underline';
				break;
			case 'strikethrough':
				type = 'strikethrough';
				break;
			case 'superscript':
				type = 'superscript';
				break;
			case 'subscript':
				type = 'subscript';
				break;
			case 'link':
				type = 'link';
				break;
			default:
				// Skip unsupported styles (fontface, fontsize, fontcolor, highlight)
				return null;
		}

		// Parse range element to get start/end positions
		const rangeEl = el.querySelector('range');
		if (!rangeEl) return null;

		const start = parseInt(rangeEl.getAttribute('start') || '0', 10);
		const end = parseInt(rangeEl.getAttribute('end') || '0', 10);

		if (isNaN(start) || isNaN(end) || start >= end) return null;

		return {
			type,
			start,
			end,
			value: type === 'link' ? (value || undefined) : undefined
		};
	}

	/**
	 * Parse a media object element
	 */
	private static parseMedia(el: Element): GrampsMedia | null {
		const handle = el.getAttribute('handle');
		if (!handle) return null;

		// Get the file element which contains path and mime
		const fileEl = el.querySelector('file');
		const path = fileEl?.getAttribute('src') || '';

		if (!path) {
			logger.warn('parseMedia', `Media object ${handle} has no file path`);
			return null;
		}

		const media: GrampsMedia = {
			handle,
			id: el.getAttribute('id') || undefined,
			path,
			mime: fileEl?.getAttribute('mime') || undefined,
			description: fileEl?.getAttribute('description') || el.querySelector('attribute[type="description"]')?.getAttribute('value') || undefined,
			date: this.parseDate(el),
			noteRefs: [],
			citationRefs: []
		};

		// Parse note references
		el.querySelectorAll('noteref').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				media.noteRefs.push(hlink);
			}
		});

		// Parse citation references
		el.querySelectorAll('citationref').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				media.citationRefs.push(hlink);
			}
		});

		return media;
	}

	/**
	 * Parse a repository element
	 */
	private static parseRepository(el: Element): GrampsRepository | null {
		const handle = el.getAttribute('handle');
		if (!handle) return null;

		const repo: GrampsRepository = {
			handle,
			id: el.getAttribute('id') || undefined,
			name: el.querySelector('rname')?.textContent || undefined,
			type: el.querySelector('type')?.textContent || undefined
		};

		return repo;
	}

	/**
	 * Parse a source element
	 */
	private static parseSource(el: Element): GrampsSource | null {
		const handle = el.getAttribute('handle');
		if (!handle) return null;

		// Parse note references
		const noteRefs: string[] = [];
		el.querySelectorAll('noteref').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				noteRefs.push(hlink);
			}
		});

		// Parse repository reference with medium (Phase 2.1)
		let repoRef: GrampsRepoRef | undefined;
		const repoRefEl = el.querySelector('reporef');
		if (repoRefEl) {
			const hlink = repoRefEl.getAttribute('hlink');
			if (hlink) {
				repoRef = {
					hlink,
					medium: repoRefEl.getAttribute('medium') || undefined,
					callno: repoRefEl.getAttribute('callno') || undefined
				};
			}
		}

		// Parse media references (Phase 2.2)
		const mediaRefs: string[] = [];
		el.querySelectorAll('objref').forEach(refEl => {
			const hlink = refEl.getAttribute('hlink');
			if (hlink) {
				mediaRefs.push(hlink);
			}
		});

		const source: GrampsSource = {
			handle,
			id: el.getAttribute('id') || undefined,
			title: el.querySelector('stitle')?.textContent || undefined,
			author: el.querySelector('sauthor')?.textContent || undefined,
			pubinfo: el.querySelector('spubinfo')?.textContent || undefined,
			abbrev: el.querySelector('sabbrev')?.textContent || undefined,
			noteRefs,
			repoRef,
			mediaRefs
		};

		return source;
	}

	/**
	 * Parse a citation element
	 */
	private static parseCitation(el: Element): GrampsCitation | null {
		const handle = el.getAttribute('handle');
		if (!handle) return null;

		// Parse confidence - Gramps uses integer 0-4
		const confidenceText = el.querySelector('confidence')?.textContent;
		const confidenceNum = confidenceText ? parseInt(confidenceText, 10) : undefined;

		const citation: GrampsCitation = {
			handle,
			id: el.getAttribute('id') || undefined,
			confidence: isNaN(confidenceNum as number) ? undefined : confidenceNum,
			sourceRef: el.querySelector('sourceref')?.getAttribute('hlink') || undefined,
			page: el.querySelector('page')?.textContent || undefined
		};

		return citation;
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

		// Convert attributes array to Record for easier access
		const attributes: Record<string, string> = {};
		for (const attr of person.attributes || []) {
			attributes[attr.type] = attr.value;
		}

		return {
			id: person.id || person.handle,
			handle: person.handle,
			name: fullName || `Unknown (${person.id || person.handle})`,
			givenName: primaryName?.first,
			surname: primaryName?.surname,
			nickname: primaryName?.nick,
			gender: convertGrampsGender(person.gender),
			birthDate,
			birthPlace,
			deathDate,
			deathPlace,
			occupation,
			stepfatherRefs: [],
			stepmotherRefs: [],
			spouseRefs: [],
			marriages: new Map(),
			mediaRefs: person.mediaRefs || [],
			noteRefs: person.noteRefs || [],
			attributes
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

			// Set parent references for children based on mrel/frel relationship types
			for (const childRef of family.children) {
				const child = persons.get(childRef.hlink);
				if (child) {
					// Handle father relationship based on frel type
					if (fatherHandle && persons.has(fatherHandle)) {
						const frel = childRef.frel;
						if (frel === 'Stepchild') {
							// Step-father (can have multiple)
							if (!child.stepfatherRefs.includes(fatherHandle)) {
								child.stepfatherRefs.push(fatherHandle);
							}
						} else if (frel === 'Adopted') {
							// Adoptive father (typically one)
							if (!child.adoptiveFatherRef) {
								child.adoptiveFatherRef = fatherHandle;
							}
						} else {
							// Birth or absent/unknown = biological father
							child.fatherRef = fatherHandle;
						}
					}

					// Handle mother relationship based on mrel type
					if (motherHandle && persons.has(motherHandle)) {
						const mrel = childRef.mrel;
						if (mrel === 'Stepchild') {
							// Step-mother (can have multiple)
							if (!child.stepmotherRefs.includes(motherHandle)) {
								child.stepmotherRefs.push(motherHandle);
							}
						} else if (mrel === 'Adopted') {
							// Adoptive mother (typically one)
							if (!child.adoptiveMotherRef) {
								child.adoptiveMotherRef = motherHandle;
							}
						} else {
							// Birth or absent/unknown = biological mother
							child.motherRef = motherHandle;
						}
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
