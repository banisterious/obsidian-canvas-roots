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
export type ValueAliasField = 'eventType' | 'gender' | 'placeCategory';

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
 * Canonical gender values
 */
export const CANONICAL_GENDERS = [
	'male',
	'female',
	'nonbinary',
	'unknown'
] as const;

export type CanonicalGender = typeof CANONICAL_GENDERS[number];

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
 * Human-readable labels for field types (for UI display)
 */
export const VALUE_ALIAS_FIELD_LABELS: Record<ValueAliasField, string> = {
	eventType: 'Event type',
	gender: 'Gender',
	placeCategory: 'Place category'
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
 * Human-readable labels for canonical genders
 */
export const GENDER_LABELS: Record<CanonicalGender, string> = {
	male: 'Male',
	female: 'Female',
	nonbinary: 'Non-binary',
	unknown: 'Unknown'
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
		return this.plugin.settings.valueAliases[field];
	}

	/**
	 * Get canonical values for a field type
	 */
	getCanonicalValues(field: ValueAliasField): readonly string[] {
		switch (field) {
			case 'eventType':
				return CANONICAL_EVENT_TYPES;
			case 'gender':
				return CANONICAL_GENDERS;
			case 'placeCategory':
				return CANONICAL_PLACE_CATEGORIES;
		}
	}

	/**
	 * Get human-readable label for a canonical value
	 */
	getValueLabel(field: ValueAliasField, value: string): string {
		switch (field) {
			case 'eventType':
				return EVENT_TYPE_LABELS[value as CanonicalEventType] || value;
			case 'gender':
				return GENDER_LABELS[value as CanonicalGender] || value;
			case 'placeCategory':
				return PLACE_CATEGORY_LABELS[value as CanonicalPlaceCategory] || value;
		}
	}

	/**
	 * Resolve a user value to its canonical equivalent.
	 *
	 * Resolution order:
	 * 1. If value is already canonical, return it
	 * 2. If value has an alias configured, return the canonical value
	 * 3. For event types: return 'custom' as fallback
	 * 4. For other fields: return original value (may trigger validation warning)
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

		// Check aliases
		const aliases = this.getAliases(field);
		const aliasedValue = aliases[normalized];
		if (aliasedValue) {
			return aliasedValue;
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

		// Check if aliased
		const aliases = this.getAliases(field);
		return normalized in aliases;
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

		for (const field of ['eventType', 'gender', 'placeCategory'] as ValueAliasField[]) {
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
