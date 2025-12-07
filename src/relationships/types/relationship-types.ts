/**
 * Relationship types for Canvas Roots
 *
 * Custom relationship types allow users to define non-familial relationships
 * (mentor, guardian, godparent, liege, etc.) between person notes.
 */

/**
 * Category of relationship for grouping in UI
 */
export type RelationshipCategory =
	| 'family'       // Spouse, parent, child, sibling
	| 'legal'        // Guardian, adoptive parent, foster parent
	| 'religious'    // Godparent, mentor, disciple
	| 'professional' // Master, apprentice, employer
	| 'social'       // Witness, neighbor, companion, ally, rival
	| 'feudal';      // Liege, vassal (world-building)

/**
 * Definition of a relationship category for grouping types
 */
export interface RelationshipCategoryDefinition {
	/** Unique identifier */
	id: string;
	/** Display name */
	name: string;
	/** Sort order for display (lower = first) */
	sortOrder: number;
}

/**
 * Line style for relationship edges on canvas
 */
export type RelationshipLineStyle = 'solid' | 'dashed' | 'dotted';

/**
 * Definition of a relationship type
 */
export interface RelationshipTypeDefinition {
	/** Unique identifier (lowercase, no spaces) */
	id: string;
	/** Display name */
	name: string;
	/** Brief description of this relationship type */
	description?: string;
	/** Category for grouping in UI */
	category: RelationshipCategory | string;
	/** Edge color (hex format) */
	color: string;
	/** Line style for canvas edges */
	lineStyle: RelationshipLineStyle;
	/** ID of the inverse relationship type (e.g., mentor → disciple) */
	inverse?: string;
	/** Whether the relationship is symmetric (same in both directions) */
	symmetric: boolean;
	/** Whether this is a built-in type (cannot be deleted) */
	builtIn: boolean;
}

/**
 * A relationship as stored in person frontmatter
 */
export interface RawRelationship {
	/** Type ID (e.g., 'mentor', 'godparent') */
	type: string;
	/** Wikilink to target person (e.g., '[[John Smith]]') */
	target: string;
	/** Target's cr_id for reliable resolution (optional) */
	target_id?: string;
	/** Start date of relationship (optional, any date format) */
	from?: string;
	/** End date of relationship (optional, any date format) */
	to?: string;
	/** Optional notes about the relationship */
	notes?: string;
}

/**
 * A parsed relationship with resolved references
 */
export interface ParsedRelationship {
	/** The type definition */
	type: RelationshipTypeDefinition;
	/** Source person cr_id */
	sourceCrId: string;
	/** Source person display name */
	sourceName: string;
	/** Source person file path */
	sourceFilePath: string;
	/** Target person cr_id (if resolved) */
	targetCrId?: string;
	/** Target person display name */
	targetName: string;
	/** Target person file path (if resolved) */
	targetFilePath?: string;
	/** Start date of relationship */
	from?: string;
	/** End date of relationship */
	to?: string;
	/** Optional notes */
	notes?: string;
	/** Whether this relationship was inferred from an inverse */
	isInferred: boolean;
}

/**
 * Statistics about relationships in the vault
 */
export interface RelationshipStats {
	/** Total number of defined relationships (not counting inferred) */
	totalDefined: number;
	/** Total number of inferred inverse relationships */
	totalInferred: number;
	/** Number of people with at least one relationship */
	peopleWithRelationships: number;
	/** Count by relationship type ID */
	byType: Record<string, number>;
	/** Count by category */
	byCategory: Record<RelationshipCategory, number>;
}

/**
 * Result of validating a relationship
 */
export interface RelationshipValidationResult {
	isValid: boolean;
	errors: string[];
}

/**
 * Human-readable category names for display
 */
export const RELATIONSHIP_CATEGORY_NAMES: Record<RelationshipCategory, string> = {
	family: 'Family',
	legal: 'Legal/Guardianship',
	religious: 'Religious/Spiritual',
	professional: 'Professional',
	social: 'Social',
	feudal: 'Feudal/World-building'
};

/**
 * Extract the note name from a wikilink
 * e.g., '[[John Smith]]' → 'John Smith'
 * e.g., '[[People/John Smith|John]]' → 'John'
 */
export function extractWikilinkName(wikilink: string): string {
	// Remove [[ and ]]
	let content = wikilink.replace(/^\[\[/, '').replace(/\]\]$/, '');

	// Handle display text (|alias)
	if (content.includes('|')) {
		content = content.split('|')[1];
	} else {
		// Get just the filename without path
		if (content.includes('/')) {
			content = content.split('/').pop() || content;
		}
	}

	return content.trim();
}

/**
 * Extract the file path from a wikilink
 * e.g., '[[John Smith]]' → 'John Smith'
 * e.g., '[[People/John Smith|John]]' → 'People/John Smith'
 */
export function extractWikilinkPath(wikilink: string): string {
	// Remove [[ and ]]
	let content = wikilink.replace(/^\[\[/, '').replace(/\]\]$/, '');

	// Remove display text (|alias)
	if (content.includes('|')) {
		content = content.split('|')[0];
	}

	return content.trim();
}

/**
 * Check if a string is a valid wikilink format
 */
export function isWikilink(value: string): boolean {
	return /^\[\[.+\]\]$/.test(value);
}
