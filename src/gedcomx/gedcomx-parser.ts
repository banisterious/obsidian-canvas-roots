/**
 * GEDCOM X Parser for Canvas Roots
 *
 * Parses GEDCOM X JSON files and converts them to Canvas Roots data structures.
 */

import {
	GedcomXDocument,
	GedcomXPerson,
	GedcomXRelationship,
	GedcomXFact,
	GedcomXValidationResult,
	GEDCOMX_TYPES,
	extractPersonId,
	extractTypeName,
	convertGender
} from './gedcomx-types';
import { getLogger } from '../core/logging';

const logger = getLogger('GedcomXParser');

/**
 * Parsed person from GEDCOM X format
 * Intermediate format before converting to Canvas Roots PersonData
 */
export interface ParsedGedcomXPerson {
	id: string;
	name: string;
	givenName?: string;
	surname?: string;
	gender?: 'M' | 'F';
	birthDate?: string;
	birthPlace?: string;
	deathDate?: string;
	deathPlace?: string;
	occupation?: string;
	living?: boolean;
	// Parent references (filled during relationship processing)
	fatherRef?: string;
	motherRef?: string;
	// Spouse references (filled during relationship processing)
	spouseRefs: string[];
	// Marriage data per spouse
	marriages: Map<string, { date?: string; place?: string }>;
}

/**
 * Complete parsed GEDCOM X data
 */
export interface ParsedGedcomXData {
	persons: Map<string, ParsedGedcomXPerson>;
	header: {
		source?: string;
		version?: string;
	};
}

/**
 * GEDCOM X parsing error
 */
export class GedcomXParseError extends Error {
	constructor(
		message: string,
		public path?: string
	) {
		super(message);
		this.name = 'GedcomXParseError';
	}
}

/**
 * GEDCOM X Parser
 */
export class GedcomXParser {
	/**
	 * Validate GEDCOM X JSON content before parsing
	 */
	static validate(content: string): GedcomXValidationResult {
		const result: GedcomXValidationResult = {
			valid: true,
			errors: [],
			warnings: [],
			stats: {
				personCount: 0,
				relationshipCount: 0,
				sourceCount: 0
			}
		};

		try {
			const data = JSON.parse(content) as GedcomXDocument;

			// Check for persons array
			if (!data.persons || !Array.isArray(data.persons)) {
				result.warnings.push({
					path: 'persons',
					message: 'No persons array found in document'
				});
			} else {
				result.stats.personCount = data.persons.length;

				// Validate each person has an ID
				data.persons.forEach((person, index) => {
					if (!person.id) {
						result.errors.push({
							path: `persons[${index}]`,
							message: 'Person is missing required id field'
						});
						result.valid = false;
					}

					// Check for names
					if (!person.names || person.names.length === 0) {
						result.warnings.push({
							path: `persons[${index}]`,
							message: `Person ${person.id || index} has no name`
						});
					}
				});
			}

			// Check relationships
			if (data.relationships && Array.isArray(data.relationships)) {
				result.stats.relationshipCount = data.relationships.length;

				data.relationships.forEach((rel, index) => {
					if (!rel.type) {
						result.warnings.push({
							path: `relationships[${index}]`,
							message: 'Relationship is missing type'
						});
					}
					if (!rel.person1?.resource || !rel.person2?.resource) {
						result.errors.push({
							path: `relationships[${index}]`,
							message: 'Relationship is missing person references'
						});
						result.valid = false;
					}
				});
			}

			// Check source descriptions
			if (data.sourceDescriptions && Array.isArray(data.sourceDescriptions)) {
				result.stats.sourceCount = data.sourceDescriptions.length;
			}
		} catch (error) {
			result.valid = false;
			result.errors.push({
				message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`
			});
		}

		return result;
	}

	/**
	 * Parse GEDCOM X JSON content
	 */
	static parse(content: string): ParsedGedcomXData {
		let data: GedcomXDocument;

		try {
			data = JSON.parse(content) as GedcomXDocument;
		} catch (error) {
			throw new GedcomXParseError(
				`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`
			);
		}

		const persons = new Map<string, ParsedGedcomXPerson>();

		// Parse persons
		if (data.persons && Array.isArray(data.persons)) {
			for (const person of data.persons) {
				const parsed = this.parsePerson(person);
				if (parsed) {
					persons.set(parsed.id, parsed);
				}
			}
		}

		// Process relationships to build parent/spouse references
		if (data.relationships && Array.isArray(data.relationships)) {
			this.processRelationships(data.relationships, persons);
		}

		logger.info('parse', `Parsed ${persons.size} persons from GEDCOM X`);

		return {
			persons,
			header: {
				source: data.description
			}
		};
	}

	/**
	 * Parse a single person record
	 */
	private static parsePerson(person: GedcomXPerson): ParsedGedcomXPerson | null {
		if (!person.id) {
			logger.warn('parsePerson', 'Person missing ID, skipping');
			return null;
		}

		// Extract name
		const { fullName, givenName, surname } = this.extractName(person);

		// Extract facts
		const birthFact = this.findFact(person.facts, GEDCOMX_TYPES.BIRTH);
		const deathFact = this.findFact(person.facts, GEDCOMX_TYPES.DEATH);
		const occupationFact = this.findFact(person.facts, GEDCOMX_TYPES.OCCUPATION);

		return {
			id: person.id,
			name: fullName || `Unknown (${person.id})`,
			givenName,
			surname,
			gender: convertGender(person.gender),
			birthDate: this.extractDate(birthFact),
			birthPlace: this.extractPlace(birthFact),
			deathDate: this.extractDate(deathFact),
			deathPlace: this.extractPlace(deathFact),
			occupation: occupationFact?.value,
			living: person.living,
			spouseRefs: [],
			marriages: new Map()
		};
	}

	/**
	 * Extract name components from a person
	 */
	private static extractName(person: GedcomXPerson): {
		fullName: string | undefined;
		givenName: string | undefined;
		surname: string | undefined;
	} {
		if (!person.names || person.names.length === 0) {
			return { fullName: undefined, givenName: undefined, surname: undefined };
		}

		// Find preferred name or use first name
		const name = person.names.find(n => n.preferred) || person.names[0];

		if (!name.nameForms || name.nameForms.length === 0) {
			return { fullName: undefined, givenName: undefined, surname: undefined };
		}

		const nameForm = name.nameForms[0];

		// Try to get full text first
		let fullName = nameForm.fullText;
		let givenName: string | undefined;
		let surname: string | undefined;

		// Extract parts if available
		if (nameForm.parts && nameForm.parts.length > 0) {
			for (const part of nameForm.parts) {
				const partType = part.type ? extractTypeName(part.type) : '';
				if (partType === 'Given' || partType === 'GivenName') {
					givenName = part.value;
				} else if (partType === 'Surname' || partType === 'Family') {
					surname = part.value;
				}
			}

			// Build full name from parts if not available
			if (!fullName && (givenName || surname)) {
				fullName = [givenName, surname].filter(Boolean).join(' ');
			}
		}

		return { fullName, givenName, surname };
	}

	/**
	 * Find a fact of a specific type
	 */
	private static findFact(
		facts: GedcomXFact[] | undefined,
		type: string
	): GedcomXFact | undefined {
		if (!facts) return undefined;
		return facts.find(f => f.type === type);
	}

	/**
	 * Extract date string from a fact
	 */
	private static extractDate(fact: GedcomXFact | undefined): string | undefined {
		if (!fact?.date) return undefined;

		// Prefer original text, fall back to formal date
		if (fact.date.original) {
			return fact.date.original;
		}

		if (fact.date.formal) {
			// Convert formal GEDCOM X date to readable format
			// Formal dates start with + for CE dates
			let formal = fact.date.formal;
			if (formal.startsWith('+')) {
				formal = formal.substring(1);
			}
			return formal;
		}

		return undefined;
	}

	/**
	 * Extract place string from a fact
	 */
	private static extractPlace(fact: GedcomXFact | undefined): string | undefined {
		if (!fact?.place) return undefined;
		return fact.place.original || fact.place.description;
	}

	/**
	 * Process relationships to build parent/spouse references
	 */
	private static processRelationships(
		relationships: GedcomXRelationship[],
		persons: Map<string, ParsedGedcomXPerson>
	): void {
		for (const rel of relationships) {
			const person1Id = extractPersonId(rel.person1);
			const person2Id = extractPersonId(rel.person2);

			const typeName = extractTypeName(rel.type);

			if (typeName === 'ParentChild') {
				// person1 is parent, person2 is child
				const child = persons.get(person2Id);
				const parent = persons.get(person1Id);

				if (child && parent) {
					// Determine if father or mother based on gender
					if (parent.gender === 'M') {
						child.fatherRef = person1Id;
					} else if (parent.gender === 'F') {
						child.motherRef = person1Id;
					} else {
						// Unknown gender - try to assign to empty slot
						if (!child.fatherRef) {
							child.fatherRef = person1Id;
						} else if (!child.motherRef) {
							child.motherRef = person1Id;
						}
					}
				}
			} else if (typeName === 'Couple') {
				// Add spouse references
				const person1 = persons.get(person1Id);
				const person2 = persons.get(person2Id);

				if (person1 && person2) {
					if (!person1.spouseRefs.includes(person2Id)) {
						person1.spouseRefs.push(person2Id);
					}
					if (!person2.spouseRefs.includes(person1Id)) {
						person2.spouseRefs.push(person1Id);
					}

					// Extract marriage facts
					const marriageFact = this.findFact(rel.facts, GEDCOMX_TYPES.MARRIAGE);
					if (marriageFact) {
						const marriageData = {
							date: this.extractDate(marriageFact),
							place: this.extractPlace(marriageFact)
						};
						person1.marriages.set(person2Id, marriageData);
						person2.marriages.set(person1Id, marriageData);
					}
				}
			}
		}
	}

	/**
	 * Check if content looks like GEDCOM X JSON
	 */
	static isGedcomX(content: string): boolean {
		try {
			const trimmed = content.trim();
			// Must start with { to be JSON
			if (!trimmed.startsWith('{')) {
				return false;
			}

			const data = JSON.parse(content);
			// Check for GEDCOM X specific fields
			return (
				Array.isArray(data.persons) ||
				Array.isArray(data.relationships) ||
				data.description !== undefined
			);
		} catch {
			return false;
		}
	}
}
