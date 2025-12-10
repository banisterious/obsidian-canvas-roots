/**
 * Value Alias Service
 *
 * Allows users to map custom property values to Canvas Roots canonical values.
 * This enables compatibility with existing vaults that use different terminology
 * (e.g., "nameday" instead of "birth" for event types).
 */

import type CanvasRootsPlugin from '../../main';

/**
 * Field types that support value aliasing
 */
export type ValueAliasField = 'eventType' | 'sex' | 'gender_identity' | 'placeCategory' | 'noteType';

/**
 * Canonical event types
 */
export const CANONICAL_EVENT_TYPES = [
	'birth',
	'death',
	'marriage',
	'burial',
	'residence',
	'occupation',
	'education',
	'military',
	'immigration',
	'baptism',
	'confirmation',
	'ordination',
	'custom'
] as const;

export type CanonicalEventType = typeof CANONICAL_EVENT_TYPES[number];

/**
 * Canonical sex values (used for both sex and gender properties)
 * Using GEDCOM-aligned terminology for genealogical accuracy
 */
export const CANONICAL_SEX_VALUES = [
	'male',
	'female',
	'nonbinary',
	'unknown'
] as const;

export type CanonicalSex = typeof CANONICAL_SEX_VALUES[number];

// Backwards compatibility alias
export const CANONICAL_GENDERS = CANONICAL_SEX_VALUES;
export type CanonicalGender = CanonicalSex;

/**
 * Canonical gender_identity values
 * For self-identified gender (distinct from biological sex)
 * Users can define custom values via value aliases
 */
export const CANONICAL_GENDER_IDENTITY_VALUES = [
	'male',
	'female',
	'nonbinary',
	'genderfluid',
	'agender',
	'other'
] as const;

export type CanonicalGenderIdentity = typeof CANONICAL_GENDER_IDENTITY_VALUES[number];

/**
 * Canonical place categories
 */
export const CANONICAL_PLACE_CATEGORIES = [
	'real',
	'historical',
	'disputed',
	'legendary',
	'mythological',
	'fictional'
] as const;

export type CanonicalPlaceCategory = typeof CANONICAL_PLACE_CATEGORIES[number];

/**
 * Canonical note types (cr_type/type values)
 */
export const CANONICAL_NOTE_TYPES = [
	'person',
	'place',
	'event',
	'source',
	'organization',
	'map',
	'schema',
	'timeline'
] as const;

export type CanonicalNoteType = typeof CANONICAL_NOTE_TYPES[number];

/**
 * Human-readable labels for field types (for UI display)
 */
export const VALUE_ALIAS_FIELD_LABELS: Record<ValueAliasField, string> = {
	eventType: 'Event type',
	sex: 'Sex',
	gender_identity: 'Gender identity',
	placeCategory: 'Place category',
	noteType: 'Note type (cr_type)'
};

/**
 * Human-readable labels for canonical event types
 */
export const EVENT_TYPE_LABELS: Record<CanonicalEventType, string> = {
	birth: 'Birth',
	death: 'Death',
	marriage: 'Marriage',
	burial: 'Burial',
	residence: 'Residence',
	occupation: 'Occupation',
	education: 'Education',
	military: 'Military',
	immigration: 'Immigration',
	baptism: 'Baptism',
	confirmation: 'Confirmation',
	ordination: 'Ordination',
	custom: 'Custom'
};

/**
 * Human-readable labels for canonical sex values
 */
export const SEX_LABELS: Record<CanonicalSex, string> = {
	male: 'Male',
	female: 'Female',
	nonbinary: 'Non-binary',
	unknown: 'Unknown'
};

// Backwards compatibility alias
export const GENDER_LABELS = SEX_LABELS;

/**
 * Human-readable labels for canonical gender_identity values
 */
export const GENDER_IDENTITY_LABELS: Record<CanonicalGenderIdentity, string> = {
	male: 'Male',
	female: 'Female',
	nonbinary: 'Non-binary',
	genderfluid: 'Genderfluid',
	agender: 'Agender',
	other: 'Other'
};

/**
 * Human-readable labels for canonical place categories
 */
export const PLACE_CATEGORY_LABELS: Record<CanonicalPlaceCategory, string> = {
	real: 'Real',
	historical: 'Historical',
	disputed: 'Disputed',
	legendary: 'Legendary',
	mythological: 'Mythological',
	fictional: 'Fictional'
};

/**
 * Human-readable labels for canonical note types
 */
export const NOTE_TYPE_LABELS: Record<CanonicalNoteType, string> = {
	person: 'Person',
	place: 'Place',
	event: 'Event',
	source: 'Source',
	organization: 'Organization',
	map: 'Map',
	schema: 'Schema',
	timeline: 'Timeline'
};

/**
 * Built-in synonyms that are automatically resolved (case-insensitive)
 * These don't require user configuration - common alternative names are handled automatically
 * User-defined aliases take precedence over these built-in synonyms
 */
export const BUILTIN_SYNONYMS: Record<ValueAliasField, Record<string, string>> = {
	eventType: {
		// Common alternatives for residence
		'move': 'residence',
		'moved': 'residence',
		'relocation': 'residence',
		'migration': 'residence',
		// Common alternatives for birth
		'born': 'birth',
		'nameday': 'birth',
		// Common alternatives for death
		'died': 'death',
		'passing': 'death',
		// Common alternatives for marriage
		'wedding': 'marriage',
		'married': 'marriage'
	},
	sex: {
		// Common alternatives
		'm': 'male',
		'f': 'female',
		'man': 'male',
		'woman': 'female',
		'nb': 'nonbinary',
		'enby': 'nonbinary'
	},
	gender_identity: {
		// Common alternatives
		'm': 'male',
		'f': 'female',
		'man': 'male',
		'woman': 'female',
		'nb': 'nonbinary',
		'enby': 'nonbinary',
		'non-binary': 'nonbinary',
		'genderqueer': 'nonbinary',
		'gender-fluid': 'genderfluid',
		'fluid': 'genderfluid'
	},
	placeCategory: {
		// Common alternatives
		'actual': 'real',
		'fantasy': 'fictional',
		'imaginary': 'fictional',
		'myth': 'mythological',
		'legend': 'legendary'
	},
	noteType: {
		// Common alternatives for organization
		'org': 'organization',
		'company': 'organization',
		'group': 'organization',
		'faction': 'organization',
		'guild': 'organization',
		'house': 'organization',
		// Common alternatives for person
		'character': 'person',
		'individual': 'person',
		// Common alternatives for place
		'location': 'place',
		'locale': 'place',
		// Common alternatives for source
		'reference': 'source',
		'citation': 'source',
		'document': 'source'
	}
};

/**
 * Service for resolving value aliases
 */
export class ValueAliasService {
	private plugin: CanvasRootsPlugin;

	constructor(plugin: CanvasRootsPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Get the configured aliases for a field type
	 */
	getAliases(field: ValueAliasField): Record<string, string> {
		return this.plugin.settings.valueAliases?.[field] ?? {};
	}

	/**
	 * Get canonical values for a field type
	 */
	getCanonicalValues(field: ValueAliasField): readonly string[] {
		switch (field) {
			case 'eventType':
				return CANONICAL_EVENT_TYPES;
			case 'sex':
				return CANONICAL_SEX_VALUES;
			case 'gender_identity':
				return CANONICAL_GENDER_IDENTITY_VALUES;
			case 'placeCategory':
				return CANONICAL_PLACE_CATEGORIES;
			case 'noteType':
				return CANONICAL_NOTE_TYPES;
		}
	}

	/**
	 * Get human-readable label for a canonical value
	 */
	getValueLabel(field: ValueAliasField, value: string): string {
		switch (field) {
			case 'eventType':
				return EVENT_TYPE_LABELS[value as CanonicalEventType] || value;
			case 'sex':
				return SEX_LABELS[value as CanonicalSex] || value;
			case 'gender_identity':
				return GENDER_IDENTITY_LABELS[value as CanonicalGenderIdentity] || value;
			case 'placeCategory':
				return PLACE_CATEGORY_LABELS[value as CanonicalPlaceCategory] || value;
			case 'noteType':
				return NOTE_TYPE_LABELS[value as CanonicalNoteType] || value;
		}
	}

	/**
	 * Resolve a user value to its canonical equivalent.
	 *
	 * Resolution order:
	 * 1. If value is already canonical, return it
	 * 2. If value has a user-defined alias configured, return the canonical value
	 * 3. If value matches a built-in synonym, return the canonical value
	 * 4. For event types: return 'custom' as fallback
	 * 5. For other fields: return original value (may trigger validation warning)
	 *
	 * @param field - The field type (eventType, gender, placeCategory)
	 * @param userValue - The value from frontmatter
	 * @returns The canonical value
	 */
	resolve(field: ValueAliasField, userValue: string): string {
		if (!userValue) return userValue;

		const normalized = userValue.toLowerCase().trim();
		const canonicalValues = this.getCanonicalValues(field);

		// Check if already canonical (case-insensitive)
		const canonicalMatch = canonicalValues.find(v => v.toLowerCase() === normalized);
		if (canonicalMatch) {
			return canonicalMatch;
		}

		// Check user-defined aliases (take precedence over built-in synonyms)
		const aliases = this.getAliases(field);
		const aliasedValue = aliases[normalized];
		if (aliasedValue) {
			return aliasedValue;
		}

		// Check built-in synonyms
		const synonyms = BUILTIN_SYNONYMS[field];
		const synonymValue = synonyms[normalized];
		if (synonymValue) {
			return synonymValue;
		}

		// Fallback behavior
		if (field === 'eventType') {
			// Unknown event types become 'custom'
			return 'custom';
		}

		// For gender and placeCategory, pass through (may cause validation warning)
		return userValue;
	}

	/**
	 * Get the user's preferred value for writing.
	 * Returns alias if configured, otherwise canonical value.
	 *
	 * @param field - The field type
	 * @param canonicalValue - The canonical value to write
	 * @returns The user's preferred value (alias) or the canonical value
	 */
	getWriteValue(field: ValueAliasField, canonicalValue: string): string {
		const aliases = this.getAliases(field);

		// Find if user has an alias for this canonical value
		for (const [userVal, canonical] of Object.entries(aliases)) {
			if (canonical === canonicalValue) {
				return userVal;
			}
		}
		return canonicalValue;
	}

	/**
	 * Check if a value is valid (either canonical or aliased)
	 *
	 * @param field - The field type
	 * @param value - The value to check
	 * @returns True if valid
	 */
	isValidValue(field: ValueAliasField, value: string): boolean {
		if (!value) return false;

		const normalized = value.toLowerCase().trim();
		const canonicalValues = this.getCanonicalValues(field);

		// Check if canonical
		if (canonicalValues.some(v => v.toLowerCase() === normalized)) {
			return true;
		}

		// Check if user-defined alias
		const aliases = this.getAliases(field);
		if (normalized in aliases) {
			return true;
		}

		// Check if built-in synonym
		const synonyms = BUILTIN_SYNONYMS[field];
		return normalized in synonyms;
	}

	/**
	 * Check if a canonical value has an alias configured
	 *
	 * @param field - The field type
	 * @param canonicalValue - The canonical value
	 * @returns True if an alias exists for this canonical value
	 */
	hasAlias(field: ValueAliasField, canonicalValue: string): boolean {
		const aliases = this.getAliases(field);
		return Object.values(aliases).includes(canonicalValue);
	}

	/**
	 * Get the alias for a canonical value, if configured
	 *
	 * @param field - The field type
	 * @param canonicalValue - The canonical value
	 * @returns The alias, or undefined if not configured
	 */
	getAlias(field: ValueAliasField, canonicalValue: string): string | undefined {
		const aliases = this.getAliases(field);
		for (const [userVal, canonical] of Object.entries(aliases)) {
			if (canonical === canonicalValue) {
				return userVal;
			}
		}
		return undefined;
	}

	/**
	 * Add or update an alias
	 *
	 * @param field - The field type
	 * @param userValue - The user's value
	 * @param canonicalValue - The canonical value it maps to
	 */
	async setAlias(field: ValueAliasField, userValue: string, canonicalValue: string): Promise<void> {
		const normalized = userValue.toLowerCase().trim();

		// Remove any existing alias that maps to this canonical value
		const aliases = this.getAliases(field);
		for (const [existingUser, existingCanonical] of Object.entries(aliases)) {
			if (existingCanonical === canonicalValue) {
				delete this.plugin.settings.valueAliases[field][existingUser];
			}
		}

		// Set the new alias
		this.plugin.settings.valueAliases[field][normalized] = canonicalValue;
		await this.plugin.saveSettings();
	}

	/**
	 * Remove an alias
	 *
	 * @param field - The field type
	 * @param userValue - The user's value to remove
	 */
	async removeAlias(field: ValueAliasField, userValue: string): Promise<void> {
		const normalized = userValue.toLowerCase().trim();
		delete this.plugin.settings.valueAliases[field][normalized];
		await this.plugin.saveSettings();
	}

	/**
	 * Get all configured aliases for a field as an array for display
	 *
	 * @param field - The field type
	 * @returns Array of { userValue, canonicalValue } objects
	 */
	getAllAliases(field: ValueAliasField): Array<{ userValue: string; canonicalValue: string }> {
		const aliases = this.getAliases(field);
		return Object.entries(aliases).map(([userValue, canonicalValue]) => ({
			userValue,
			canonicalValue
		}));
	}

	/**
	 * Get all configured aliases across all fields
	 *
	 * @returns Array of { field, userValue, canonicalValue } objects
	 */
	getAllAliasesAllFields(): Array<{ field: ValueAliasField; userValue: string; canonicalValue: string }> {
		const result: Array<{ field: ValueAliasField; userValue: string; canonicalValue: string }> = [];

		for (const field of ['eventType', 'sex', 'placeCategory'] as ValueAliasField[]) {
			const aliases = this.getAllAliases(field);
			for (const alias of aliases) {
				result.push({ field, ...alias });
			}
		}

		return result;
	}
}

/**
 * Create a ValueAliasService instance
 */
export function createValueAliasService(plugin: CanvasRootsPlugin): ValueAliasService {
	return new ValueAliasService(plugin);
}
