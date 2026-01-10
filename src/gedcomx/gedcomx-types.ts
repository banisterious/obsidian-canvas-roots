/**
 * GEDCOM X Type Definitions
 *
 * TypeScript interfaces for FamilySearch GEDCOM X JSON format.
 * Based on the GEDCOM X specification: https://github.com/FamilySearch/gedcomx
 */

/**
 * GEDCOM X URI constants for types
 */
export const GEDCOMX_TYPES = {
	// Gender types
	MALE: 'http://gedcomx.org/Male',
	FEMALE: 'http://gedcomx.org/Female',
	UNKNOWN: 'http://gedcomx.org/Unknown',

	// Relationship types
	PARENT_CHILD: 'http://gedcomx.org/ParentChild',
	COUPLE: 'http://gedcomx.org/Couple',

	// Fact types
	BIRTH: 'http://gedcomx.org/Birth',
	DEATH: 'http://gedcomx.org/Death',
	MARRIAGE: 'http://gedcomx.org/Marriage',
	OCCUPATION: 'http://gedcomx.org/Occupation',
	RESIDENCE: 'http://gedcomx.org/Residence',
	BURIAL: 'http://gedcomx.org/Burial',
	CHRISTENING: 'http://gedcomx.org/Christening',
	BAPTISM: 'http://gedcomx.org/Baptism',

	// Parent-child relationship lineage types
	ADOPTIVE_PARENT: 'http://gedcomx.org/AdoptiveParent',
	BIOLOGICAL_PARENT: 'http://gedcomx.org/BiologicalParent',
	FOSTER_PARENT: 'http://gedcomx.org/FosterParent',
	GUARDIAN_PARENT: 'http://gedcomx.org/GuardianParent',
	STEP_PARENT: 'http://gedcomx.org/StepParent',
	SOCIOLOGICAL_PARENT: 'http://gedcomx.org/SociologicalParent',

	// Name types
	BIRTH_NAME: 'http://gedcomx.org/BirthName',
	MARRIED_NAME: 'http://gedcomx.org/MarriedName',
	ALSO_KNOWN_AS: 'http://gedcomx.org/AlsoKnownAs'
} as const;

/**
 * Resource reference (used in relationships)
 */
export interface GedcomXResourceReference {
	resource: string; // "#P001" or full URI
}

/**
 * Text value with optional language
 */
export interface GedcomXTextValue {
	lang?: string;
	value: string;
}

/**
 * Date representation
 */
export interface GedcomXDate {
	original?: string; // Original text (e.g., "about 1850")
	formal?: string; // Formal date (e.g., "+1850")
}

/**
 * Place representation
 */
export interface GedcomXPlace {
	original?: string; // Original text
	description?: string; // Place description reference
}

/**
 * Name form (one way of writing a name)
 */
export interface GedcomXNameForm {
	lang?: string;
	fullText?: string;
	parts?: GedcomXNamePart[];
}

/**
 * Name part (given name, surname, etc.)
 */
export interface GedcomXNamePart {
	type?: string; // http://gedcomx.org/Given, http://gedcomx.org/Surname, etc.
	value: string;
}

/**
 * Name (a person can have multiple names)
 */
export interface GedcomXName {
	id?: string;
	type?: string; // BirthName, MarriedName, etc.
	nameForms: GedcomXNameForm[];
	preferred?: boolean;
}

/**
 * Gender
 */
export interface GedcomXGender {
	type: string; // http://gedcomx.org/Male, Female, Unknown
}

/**
 * Source reference for facts
 */
export interface GedcomXSourceReference {
	description?: string; // Reference to source description (e.g., "#SD1")
}

/**
 * Fact (birth, death, marriage, etc.)
 */
export interface GedcomXFact {
	id?: string;
	type: string; // http://gedcomx.org/Birth, Death, etc.
	date?: GedcomXDate;
	place?: GedcomXPlace;
	value?: string; // For facts like occupation
	qualifiers?: GedcomXQualifier[];
	sources?: GedcomXSourceReference[]; // Source references
}

/**
 * Qualifier for facts
 */
export interface GedcomXQualifier {
	name: string;
	value?: string;
}

/**
 * Link to external resource
 */
export interface GedcomXLink {
	rel?: string;
	href?: string;
	type?: string;
}

/**
 * Person record
 */
export interface GedcomXPerson {
	id: string;
	identifiers?: Record<string, string[]>; // External identifiers
	names: GedcomXName[];
	gender?: GedcomXGender;
	facts?: GedcomXFact[];
	links?: GedcomXLink[];
	living?: boolean;
	principal?: boolean; // Is this the main subject of the document
}

/**
 * Relationship between two persons
 */
export interface GedcomXRelationship {
	id?: string;
	type: string; // ParentChild, Couple
	person1: GedcomXResourceReference;
	person2: GedcomXResourceReference;
	facts?: GedcomXFact[]; // Marriage date/place for Couple relationships
}

/**
 * Source description
 */
export interface GedcomXSourceDescription {
	id?: string;
	resourceType?: string;
	citations?: GedcomXTextValue[];
	titles?: GedcomXTextValue[];
	about?: string;
}

/**
 * Complete GEDCOM X document
 */
export interface GedcomXDocument {
	id?: string;
	lang?: string;
	description?: string; // Reference to main source description
	persons?: GedcomXPerson[];
	relationships?: GedcomXRelationship[];
	sourceDescriptions?: GedcomXSourceDescription[];
	agents?: GedcomXAgent[];
	events?: GedcomXEvent[];
	places?: GedcomXPlaceDescription[];
	documents?: GedcomXDocument[];
}

/**
 * Agent (contributor, submitter)
 */
export interface GedcomXAgent {
	id?: string;
	names?: GedcomXTextValue[];
	emails?: GedcomXResourceReference[];
}

/**
 * Event (standalone event not attached to a person)
 */
export interface GedcomXEvent {
	id?: string;
	type?: string;
	date?: GedcomXDate;
	place?: GedcomXPlace;
}

/**
 * Place description
 */
export interface GedcomXPlaceDescription {
	id?: string;
	names?: GedcomXTextValue[];
	type?: string;
	latitude?: number;
	longitude?: number;
	jurisdiction?: GedcomXResourceReference;
}

/**
 * Validation result for GEDCOM X documents
 */
export interface GedcomXValidationResult {
	valid: boolean;
	errors: Array<{ path?: string; message: string }>;
	warnings: Array<{ path?: string; message: string }>;
	stats: {
		personCount: number;
		relationshipCount: number;
		sourceCount: number;
	};
}

/**
 * Helper to extract person ID from resource reference
 * Handles both "#P001" and full URI formats
 */
export function extractPersonId(reference: GedcomXResourceReference): string {
	const resource = reference.resource;
	if (resource.startsWith('#')) {
		return resource.substring(1);
	}
	// Handle full URI format
	const lastSlash = resource.lastIndexOf('/');
	if (lastSlash >= 0) {
		return resource.substring(lastSlash + 1);
	}
	return resource;
}

/**
 * Helper to extract type name from URI
 * e.g., "http://gedcomx.org/Male" -> "Male"
 */
export function extractTypeName(typeUri: string): string {
	const lastSlash = typeUri.lastIndexOf('/');
	if (lastSlash >= 0) {
		return typeUri.substring(lastSlash + 1);
	}
	return typeUri;
}

/**
 * Helper to convert GEDCOM X gender to Charted Roots format
 */
export function convertGender(gender?: GedcomXGender): 'M' | 'F' | undefined {
	if (!gender?.type) return undefined;

	const typeName = extractTypeName(gender.type);
	switch (typeName) {
		case 'Male':
			return 'M';
		case 'Female':
			return 'F';
		default:
			return undefined;
	}
}
