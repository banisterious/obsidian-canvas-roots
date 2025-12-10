/**
 * Property Alias Service
 *
 * Allows users to map custom frontmatter property names to Canvas Roots
 * canonical names. This enables compatibility with existing vaults that
 * use different naming conventions (e.g., "birthdate" instead of "born").
 */

import type CanvasRootsPlugin from '../../main';

/**
 * Canonical person note properties that can be aliased
 */
export const CANONICAL_PERSON_PROPERTIES = [
	// Core identity
	'name',
	'cr_id',
	'type',
	'sex',
	'gender', // Kept for users who prefer gender over sex
	'nickname',
	'maiden_name',
	// Dates
	'born',
	'died',
	// Places
	'birth_place',
	'death_place',
	// Relationships
	'father',
	'father_id',
	'mother',
	'mother_id',
	'parents',       // Array of parent links (alternative to father/mother)
	'parents_id',    // Array of parent cr_ids
	'spouse',
	'spouse_id',
	'partners',      // Array of partner/spouse links (alternative to spouse)
	'partners_id',   // Array of partner cr_ids
	'child',
	'children_id',
	// Other
	'occupation',
	'universe',
	'image',
	'sourced_facts',
	'relationships'
] as const;

export type CanonicalPersonProperty = typeof CANONICAL_PERSON_PROPERTIES[number];

/**
 * Canonical event note properties that can be aliased
 */
export const CANONICAL_EVENT_PROPERTIES = [
	// Core
	'cr_id',
	'cr_type',
	'title',
	'event_type',
	// Dates
	'date',
	'date_end',
	'date_precision',
	'date_system',
	// People
	'person',      // Primary person involved
	'persons',     // Multiple people involved (alias: participants)
	// Location
	'place',
	// Sources and confidence
	'sources',
	'confidence',
	// Description and metadata
	'description',
	'is_canonical',
	'universe',
	// Ordering
	'before',
	'after',
	'timeline',
	// Groups/factions
	'groups'
] as const;

export type CanonicalEventProperty = typeof CANONICAL_EVENT_PROPERTIES[number];

/**
 * Canonical place note properties that can be aliased
 */
export const CANONICAL_PLACE_PROPERTIES = [
	'cr_id',
	'cr_type',
	'name',
	'place_type',
	'parent_place',
	'coordinates',
	'universe',
	'collection'
] as const;

export type CanonicalPlaceProperty = typeof CANONICAL_PLACE_PROPERTIES[number];

/**
 * All canonical properties across all note types
 */
export const ALL_CANONICAL_PROPERTIES = [
	...CANONICAL_PERSON_PROPERTIES,
	...CANONICAL_EVENT_PROPERTIES,
	...CANONICAL_PLACE_PROPERTIES
] as const;

/**
 * Human-readable labels for canonical properties (for UI display)
 */
export const CANONICAL_PROPERTY_LABELS: Record<string, string> = {
	// Person properties
	name: 'Name',
	cr_id: 'CR ID',
	type: 'Type',
	sex: 'Sex',
	gender: 'Gender',
	nickname: 'Nickname',
	maiden_name: 'Maiden name',
	born: 'Birth date',
	died: 'Death date',
	birth_place: 'Birth place',
	death_place: 'Death place',
	father: 'Father',
	father_id: 'Father ID',
	mother: 'Mother',
	mother_id: 'Mother ID',
	parents: 'Parents (array)',
	parents_id: 'Parents ID (array)',
	spouse: 'Spouse',
	spouse_id: 'Spouse ID',
	partners: 'Partners (array)',
	partners_id: 'Partners ID (array)',
	child: 'Child/Children',
	children_id: 'Children ID',
	occupation: 'Occupation',
	universe: 'Universe',
	image: 'Image',
	sourced_facts: 'Sourced facts',
	relationships: 'Relationships',
	// Event properties
	cr_type: 'CR type',
	title: 'Title',
	event_type: 'Event type',
	date: 'Date',
	date_end: 'End date',
	date_precision: 'Date precision',
	date_system: 'Date system',
	person: 'Person',
	persons: 'Persons/Participants',
	place: 'Place',
	sources: 'Sources',
	confidence: 'Confidence',
	description: 'Description',
	is_canonical: 'Is canonical',
	before: 'Before',
	after: 'After',
	timeline: 'Timeline',
	groups: 'Groups',
	// Place properties
	place_type: 'Place type',
	parent_place: 'Parent place',
	coordinates: 'Coordinates',
	collection: 'Collection'
};

/**
 * Property metadata for unified configuration UI
 */
export interface PropertyMetadata {
	canonical: string;
	label: string;
	description: string;
	category: 'person' | 'event' | 'place' | 'source' | 'organization';
	commonAliases?: string[];  // For search/suggestions
}

/**
 * Person property metadata
 */
export const PERSON_PROPERTY_METADATA: PropertyMetadata[] = [
	// Core identity
	{
		canonical: 'name',
		label: 'Name',
		description: 'The person\'s full name',
		category: 'person',
		commonAliases: ['full_name', 'display_name', 'person_name']
	},
	{
		canonical: 'cr_id',
		label: 'CR ID',
		description: 'Unique identifier for the person',
		category: 'person',
		commonAliases: ['id', 'person_id', 'uuid']
	},
	{
		canonical: 'cr_type',
		label: 'CR type',
		description: 'Note type identifier (usually "person")',
		category: 'person',
		commonAliases: ['type', 'note_type']
	},
	{
		canonical: 'sex',
		label: 'Sex',
		description: 'Biological sex (male, female, nonbinary, unknown)',
		category: 'person',
		commonAliases: ['gender', 'sex_at_birth']
	},
	{
		canonical: 'gender',
		label: 'Gender',
		description: 'Gender identity (alternative to sex field)',
		category: 'person',
		commonAliases: ['gender_identity']
	},
	{
		canonical: 'nickname',
		label: 'Nickname',
		description: 'Informal name or alias',
		category: 'person',
		commonAliases: ['alias', 'known_as', 'goes_by']
	},
	{
		canonical: 'maiden_name',
		label: 'Maiden name',
		description: 'Birth surname (before marriage)',
		category: 'person',
		commonAliases: ['birth_name', 'birth_surname', 'née', 'nee']
	},
	// Dates
	{
		canonical: 'born',
		label: 'Birth date',
		description: 'Date when the person was born',
		category: 'person',
		commonAliases: ['birthdate', 'birth_date', 'dob', 'date_of_birth']
	},
	{
		canonical: 'died',
		label: 'Death date',
		description: 'Date when the person died',
		category: 'person',
		commonAliases: ['deathdate', 'death_date', 'dod', 'date_of_death']
	},
	// Places
	{
		canonical: 'birth_place',
		label: 'Birth place',
		description: 'Location where the person was born',
		category: 'person',
		commonAliases: ['birthplace', 'place_of_birth', 'born_in']
	},
	{
		canonical: 'death_place',
		label: 'Death place',
		description: 'Location where the person died',
		category: 'person',
		commonAliases: ['deathplace', 'place_of_death', 'died_in']
	},
	// Relationships
	{
		canonical: 'father',
		label: 'Father',
		description: 'Link to father\'s note',
		category: 'person',
		commonAliases: ['father_name', 'dad', 'père']
	},
	{
		canonical: 'father_id',
		label: 'Father ID',
		description: 'CR ID of father',
		category: 'person',
		commonAliases: ['father_cr_id']
	},
	{
		canonical: 'mother',
		label: 'Mother',
		description: 'Link to mother\'s note',
		category: 'person',
		commonAliases: ['mother_name', 'mom', 'mère']
	},
	{
		canonical: 'mother_id',
		label: 'Mother ID',
		description: 'CR ID of mother',
		category: 'person',
		commonAliases: ['mother_cr_id']
	},
	{
		canonical: 'parents',
		label: 'Parents',
		description: 'Array of parent links (alternative to father/mother)',
		category: 'person',
		commonAliases: ['parent']
	},
	{
		canonical: 'parents_id',
		label: 'Parents ID',
		description: 'Array of parent CR IDs',
		category: 'person',
		commonAliases: ['parent_ids']
	},
	{
		canonical: 'spouse',
		label: 'Spouse',
		description: 'Link to spouse\'s note',
		category: 'person',
		commonAliases: ['spouse_name', 'partner', 'husband', 'wife']
	},
	{
		canonical: 'spouse_id',
		label: 'Spouse ID',
		description: 'CR ID of spouse',
		category: 'person',
		commonAliases: ['spouse_cr_id', 'partner_id']
	},
	{
		canonical: 'partners',
		label: 'Partners',
		description: 'Array of partner/spouse links',
		category: 'person',
		commonAliases: ['spouses']
	},
	{
		canonical: 'partners_id',
		label: 'Partners ID',
		description: 'Array of partner CR IDs',
		category: 'person',
		commonAliases: ['partner_ids', 'spouse_ids']
	},
	{
		canonical: 'child',
		label: 'Children',
		description: 'Links to children\'s notes',
		category: 'person',
		commonAliases: ['children', 'kids', 'offspring']
	},
	{
		canonical: 'children_id',
		label: 'Children ID',
		description: 'CR IDs of children',
		category: 'person',
		commonAliases: ['child_ids', 'kid_ids']
	},
	// Other
	{
		canonical: 'occupation',
		label: 'Occupation',
		description: 'Person\'s profession or role',
		category: 'person',
		commonAliases: ['job', 'profession', 'career', 'work']
	},
	{
		canonical: 'universe',
		label: 'Universe',
		description: 'Fictional universe or world',
		category: 'person',
		commonAliases: ['world', 'setting', 'realm']
	},
	{
		canonical: 'image',
		label: 'Image',
		description: 'Link to portrait or photo',
		category: 'person',
		commonAliases: ['photo', 'portrait', 'picture', 'avatar']
	},
	{
		canonical: 'sourced_facts',
		label: 'Sourced facts',
		description: 'Facts with source citations',
		category: 'person',
		commonAliases: ['sources', 'citations', 'evidence']
	},
	{
		canonical: 'relationships',
		label: 'Relationships',
		description: 'Custom relationship definitions',
		category: 'person',
		commonAliases: ['custom_relationships', 'relations']
	}
];

/**
 * Event property metadata
 */
export const EVENT_PROPERTY_METADATA: PropertyMetadata[] = [
	// Core
	{
		canonical: 'cr_id',
		label: 'CR ID',
		description: 'Unique identifier for the event',
		category: 'event',
		commonAliases: ['id', 'event_id', 'uuid']
	},
	{
		canonical: 'cr_type',
		label: 'CR type',
		description: 'Note type identifier (usually "event")',
		category: 'event',
		commonAliases: ['type', 'note_type']
	},
	{
		canonical: 'title',
		label: 'Title',
		description: 'Event name or title',
		category: 'event',
		commonAliases: ['name', 'event_name', 'event_title']
	},
	{
		canonical: 'event_type',
		label: 'Event type',
		description: 'Type of event (birth, death, marriage, etc.)',
		category: 'event',
		commonAliases: ['type', 'category', 'kind']
	},
	// Dates
	{
		canonical: 'date',
		label: 'Date',
		description: 'When the event occurred',
		category: 'event',
		commonAliases: ['event_date', 'occurred', 'happened', 'when']
	},
	{
		canonical: 'date_end',
		label: 'End date',
		description: 'When the event ended (for date ranges)',
		category: 'event',
		commonAliases: ['end_date', 'concluded', 'finished']
	},
	{
		canonical: 'date_precision',
		label: 'Date precision',
		description: 'Precision of the date (exact, approximate, etc.)',
		category: 'event',
		commonAliases: ['precision', 'date_accuracy']
	},
	{
		canonical: 'date_system',
		label: 'Date system',
		description: 'Calendar system used (Gregorian, fictional, etc.)',
		category: 'event',
		commonAliases: ['calendar', 'calendar_system']
	},
	// People
	{
		canonical: 'person',
		label: 'Person',
		description: 'Primary person involved in the event',
		category: 'event',
		commonAliases: ['primary_person', 'subject']
	},
	{
		canonical: 'persons',
		label: 'Persons',
		description: 'Multiple people involved in the event',
		category: 'event',
		commonAliases: ['participants', 'people', 'attendees']
	},
	// Location
	{
		canonical: 'place',
		label: 'Place',
		description: 'Where the event occurred',
		category: 'event',
		commonAliases: ['location', 'where', 'event_place']
	},
	// Sources and confidence
	{
		canonical: 'sources',
		label: 'Sources',
		description: 'Source citations for the event',
		category: 'event',
		commonAliases: ['citations', 'references', 'evidence']
	},
	{
		canonical: 'confidence',
		label: 'Confidence',
		description: 'Confidence level in the event data',
		category: 'event',
		commonAliases: ['reliability', 'certainty']
	},
	// Description and metadata
	{
		canonical: 'description',
		label: 'Description',
		description: 'Details about the event',
		category: 'event',
		commonAliases: ['details', 'notes', 'summary']
	},
	{
		canonical: 'is_canonical',
		label: 'Is canonical',
		description: 'Whether this event is canonical in the story',
		category: 'event',
		commonAliases: ['canonical']
	},
	{
		canonical: 'universe',
		label: 'Universe',
		description: 'Fictional universe or world',
		category: 'event',
		commonAliases: ['world', 'setting', 'realm']
	},
	// Ordering
	{
		canonical: 'before',
		label: 'Before',
		description: 'Events that occur before this one',
		category: 'event',
		commonAliases: ['precedes', 'earlier']
	},
	{
		canonical: 'after',
		label: 'After',
		description: 'Events that occur after this one',
		category: 'event',
		commonAliases: ['follows', 'later']
	},
	{
		canonical: 'timeline',
		label: 'Timeline',
		description: 'Timeline this event belongs to',
		category: 'event',
		commonAliases: ['sequence', 'chronology']
	},
	// Groups/factions
	{
		canonical: 'groups',
		label: 'Groups',
		description: 'Organizations or factions involved',
		category: 'event',
		commonAliases: ['organizations', 'factions', 'parties']
	}
];

/**
 * Place property metadata
 */
export const PLACE_PROPERTY_METADATA: PropertyMetadata[] = [
	{
		canonical: 'cr_id',
		label: 'CR ID',
		description: 'Unique identifier for the place',
		category: 'place',
		commonAliases: ['id', 'place_id', 'uuid']
	},
	{
		canonical: 'cr_type',
		label: 'CR type',
		description: 'Note type identifier (usually "place")',
		category: 'place',
		commonAliases: ['type', 'note_type']
	},
	{
		canonical: 'name',
		label: 'Name',
		description: 'Name of the place',
		category: 'place',
		commonAliases: ['place_name', 'location_name']
	},
	{
		canonical: 'place_type',
		label: 'Place type',
		description: 'Type of place (city, country, region, etc.)',
		category: 'place',
		commonAliases: ['type', 'category', 'kind']
	},
	{
		canonical: 'parent_place',
		label: 'Parent place',
		description: 'Larger place this is part of',
		category: 'place',
		commonAliases: ['parent', 'contains', 'within', 'part_of']
	},
	{
		canonical: 'coordinates',
		label: 'Coordinates',
		description: 'Geographic coordinates (latitude, longitude)',
		category: 'place',
		commonAliases: ['coords', 'location', 'lat_long', 'latlng']
	},
	{
		canonical: 'universe',
		label: 'Universe',
		description: 'Fictional universe or world',
		category: 'place',
		commonAliases: ['world', 'setting', 'realm']
	},
	{
		canonical: 'collection',
		label: 'Collection',
		description: 'Collection or dataset this place belongs to',
		category: 'place',
		commonAliases: ['dataset', 'group']
	}
];

/**
 * All property metadata combined
 */
export const ALL_PROPERTY_METADATA: PropertyMetadata[] = [
	...PERSON_PROPERTY_METADATA,
	...EVENT_PROPERTY_METADATA,
	...PLACE_PROPERTY_METADATA
];

/**
 * Service for resolving property aliases
 */
export class PropertyAliasService {
	private plugin: CanvasRootsPlugin;

	constructor(plugin: CanvasRootsPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Get the configured aliases
	 */
	get aliases(): Record<string, string> {
		return this.plugin.settings.propertyAliases;
	}

	/**
	 * Resolve a property value from frontmatter using alias mapping.
	 * Checks canonical property first, then falls back to aliases.
	 *
	 * @param frontmatter - The note's frontmatter object
	 * @param canonicalProperty - The Canvas Roots canonical property name
	 * @returns The property value, or undefined if not found
	 */
	resolve(frontmatter: Record<string, unknown>, canonicalProperty: string): unknown {
		// Canonical property takes precedence
		if (frontmatter[canonicalProperty] !== undefined) {
			return frontmatter[canonicalProperty];
		}

		// Check aliases - find user property that maps to this canonical property
		for (const [userProp, mappedCanonical] of Object.entries(this.aliases)) {
			if (mappedCanonical === canonicalProperty && frontmatter[userProp] !== undefined) {
				return frontmatter[userProp];
			}
		}

		return undefined;
	}

	/**
	 * Get the property name to use when writing to frontmatter.
	 * Returns the aliased name if configured, otherwise the canonical name.
	 *
	 * @param canonicalProperty - The Canvas Roots canonical property name
	 * @returns The property name to write to
	 */
	getWriteProperty(canonicalProperty: string): string {
		// Find if user has an alias for this canonical property
		for (const [userProp, mappedCanonical] of Object.entries(this.aliases)) {
			if (mappedCanonical === canonicalProperty) {
				return userProp;
			}
		}
		return canonicalProperty;
	}

	/**
	 * Get the property name to display in UI.
	 * Returns the aliased name if configured, otherwise the canonical name.
	 * Same as getWriteProperty - users should see their preferred names.
	 *
	 * @param canonicalProperty - The Canvas Roots canonical property name
	 * @returns The property name to display
	 */
	getDisplayProperty(canonicalProperty: string): string {
		return this.getWriteProperty(canonicalProperty);
	}

	/**
	 * Check if a property has an alias configured
	 *
	 * @param canonicalProperty - The Canvas Roots canonical property name
	 * @returns True if an alias is configured for this property
	 */
	hasAlias(canonicalProperty: string): boolean {
		return Object.values(this.aliases).includes(canonicalProperty);
	}

	/**
	 * Get the alias for a canonical property, if configured
	 *
	 * @param canonicalProperty - The Canvas Roots canonical property name
	 * @returns The alias, or undefined if not configured
	 */
	getAlias(canonicalProperty: string): string | undefined {
		for (const [userProp, mappedCanonical] of Object.entries(this.aliases)) {
			if (mappedCanonical === canonicalProperty) {
				return userProp;
			}
		}
		return undefined;
	}

	/**
	 * Add or update an alias
	 *
	 * @param userProperty - The user's property name
	 * @param canonicalProperty - The Canvas Roots canonical property name
	 */
	async setAlias(userProperty: string, canonicalProperty: string): Promise<void> {
		// Remove any existing alias for this canonical property
		for (const [existingUser, existingCanonical] of Object.entries(this.aliases)) {
			if (existingCanonical === canonicalProperty) {
				delete this.plugin.settings.propertyAliases[existingUser];
			}
		}

		// Set the new alias
		this.plugin.settings.propertyAliases[userProperty] = canonicalProperty;
		await this.plugin.saveSettings();
	}

	/**
	 * Remove an alias
	 *
	 * @param userProperty - The user's property name to remove
	 */
	async removeAlias(userProperty: string): Promise<void> {
		delete this.plugin.settings.propertyAliases[userProperty];
		await this.plugin.saveSettings();
	}

	/**
	 * Get all configured aliases as an array for display
	 *
	 * @returns Array of { userProperty, canonicalProperty } objects
	 */
	getAllAliases(): Array<{ userProperty: string; canonicalProperty: string }> {
		return Object.entries(this.aliases).map(([userProperty, canonicalProperty]) => ({
			userProperty,
			canonicalProperty
		}));
	}

	/**
	 * Resolve multiple properties at once from frontmatter.
	 * Convenience method for resolving all person properties.
	 *
	 * @param frontmatter - The note's frontmatter object
	 * @param properties - Array of canonical property names to resolve
	 * @returns Object with resolved values
	 */
	resolveAll(
		frontmatter: Record<string, unknown>,
		properties: string[]
	): Record<string, unknown> {
		const result: Record<string, unknown> = {};
		for (const prop of properties) {
			const value = this.resolve(frontmatter, prop);
			if (value !== undefined) {
				result[prop] = value;
			}
		}
		return result;
	}

	/**
	 * Get metadata for a canonical property
	 *
	 * @param canonicalProperty - The canonical property name
	 * @returns Property metadata, or undefined if not found
	 */
	getMetadata(canonicalProperty: string): PropertyMetadata | undefined {
		return ALL_PROPERTY_METADATA.find(m => m.canonical === canonicalProperty);
	}

	/**
	 * Get all properties for a specific category
	 *
	 * @param category - The property category (person, event, place, etc.)
	 * @returns Array of property metadata for that category
	 */
	getPropertiesByCategory(category: string): PropertyMetadata[] {
		return ALL_PROPERTY_METADATA.filter(m => m.category === category);
	}

	/**
	 * Search properties by name, description, canonical name, or common aliases
	 *
	 * @param query - Search query string
	 * @returns Array of matching property metadata
	 */
	searchProperties(query: string): PropertyMetadata[] {
		if (!query || query.trim() === '') {
			return ALL_PROPERTY_METADATA;
		}

		const normalized = query.toLowerCase().trim();

		return ALL_PROPERTY_METADATA.filter(meta => {
			// Match against label
			if (meta.label.toLowerCase().includes(normalized)) {
				return true;
			}

			// Match against description
			if (meta.description.toLowerCase().includes(normalized)) {
				return true;
			}

			// Match against canonical property name
			if (meta.canonical.toLowerCase().includes(normalized)) {
				return true;
			}

			// Match against common aliases
			if (meta.commonAliases?.some(alias => alias.toLowerCase().includes(normalized))) {
				return true;
			}

			return false;
		});
	}

	/**
	 * Get all properties with configured aliases
	 *
	 * @returns Array of property metadata that have aliases configured
	 */
	getAliasedProperties(): PropertyMetadata[] {
		const aliasedCanonicals = Object.values(this.aliases);
		return ALL_PROPERTY_METADATA.filter(meta =>
			aliasedCanonicals.includes(meta.canonical)
		);
	}

	/**
	 * Check if a property is valid (exists in metadata)
	 *
	 * @param canonicalProperty - The canonical property name to check
	 * @returns True if the property exists in metadata
	 */
	isValidProperty(canonicalProperty: string): boolean {
		return ALL_PROPERTY_METADATA.some(m => m.canonical === canonicalProperty);
	}
}

/**
 * Create a PropertyAliasService instance
 */
export function createPropertyAliasService(plugin: CanvasRootsPlugin): PropertyAliasService {
	return new PropertyAliasService(plugin);
}
