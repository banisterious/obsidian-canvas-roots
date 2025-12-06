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
	'gender',
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
	'spouse',
	'spouse_id',
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
 * Human-readable labels for canonical properties (for UI display)
 */
export const CANONICAL_PROPERTY_LABELS: Record<CanonicalPersonProperty, string> = {
	name: 'Name',
	cr_id: 'CR ID',
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
	spouse: 'Spouse',
	spouse_id: 'Spouse ID',
	child: 'Child/Children',
	children_id: 'Children ID',
	occupation: 'Occupation',
	universe: 'Universe',
	image: 'Image',
	sourced_facts: 'Sourced facts',
	relationships: 'Relationships'
};

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
}

/**
 * Create a PropertyAliasService instance
 */
export function createPropertyAliasService(plugin: CanvasRootsPlugin): PropertyAliasService {
	return new PropertyAliasService(plugin);
}
