/**
 * Schema validation types for Canvas Roots
 *
 * Schemas are stored as markdown notes with `type: schema` frontmatter.
 * The schema definition is stored in a JSON code block in the note body.
 */

/**
 * Schema note frontmatter (flat properties for Obsidian compatibility)
 */
export interface SchemaNoteFrontmatter {
	type: 'schema';
	cr_id: string;
	name: string;
	description?: string;
	applies_to_type: SchemaAppliesTo;
	applies_to_value?: string;
}

/**
 * How a schema applies to person notes
 */
export type SchemaAppliesTo = 'collection' | 'folder' | 'universe' | 'all';

/**
 * Full schema including parsed JSON definition from note body
 */
export interface SchemaNote {
	cr_id: string;
	name: string;
	description?: string;
	appliesToType: SchemaAppliesTo;
	appliesToValue?: string;
	filePath: string;
	definition: SchemaDefinition;
}

/**
 * Schema definition parsed from JSON code block
 */
export interface SchemaDefinition {
	requiredProperties: string[];
	properties: Record<string, PropertyDefinition>;
	constraints: SchemaConstraint[];
}

/**
 * Property type for validation
 *
 * - string: Plain text value
 * - number: Numeric value
 * - date: Date string (various formats supported)
 * - wikilink: Link to another note [[Target]] or [[Target|Display]]
 * - array: Array of values
 * - enum: One of a predefined set of values
 * - boolean: true/false value
 * - sourced_facts: Special type for fact-level source tracking (validates SourcedFacts structure)
 */
export type PropertyType = 'string' | 'number' | 'date' | 'wikilink' | 'array' | 'enum' | 'boolean' | 'sourced_facts';

/**
 * Definition for a single property validation rule
 */
export interface PropertyDefinition {
	type: PropertyType;
	/** Allowed values for enum type */
	values?: string[];
	/** Default value if property is missing */
	default?: unknown;
	/** Conditional requirement */
	requiredIf?: ConditionalRequirement;
	/** Minimum value for number type */
	min?: number;
	/** Maximum value for number type */
	max?: number;
	/** Target note type for wikilink (place, map, person) */
	targetType?: string;
	/** Description shown in UI */
	description?: string;
}

/**
 * Conditional requirement for a property
 */
export interface ConditionalRequirement {
	/** Property to check */
	property: string;
	/** Required if property equals this value */
	equals?: unknown;
	/** Required if property does not equal this value */
	notEquals?: unknown;
	/** Required if property exists (is not undefined/null) */
	exists?: boolean;
}

/**
 * Cross-property constraint using JavaScript expression
 */
export interface SchemaConstraint {
	/** JavaScript expression to evaluate */
	rule: string;
	/** Error message if constraint fails */
	message: string;
}

/**
 * Result of validating a person against a schema
 */
export interface ValidationResult {
	filePath: string;
	personName: string;
	schemaCrId: string;
	schemaName: string;
	isValid: boolean;
	errors: ValidationError[];
	warnings: ValidationWarning[];
}

/**
 * Validation error types
 */
export type ValidationErrorType =
	| 'missing_required'
	| 'invalid_type'
	| 'invalid_enum'
	| 'out_of_range'
	| 'constraint_failed'
	| 'conditional_required'
	| 'invalid_wikilink_target';

/**
 * A single validation error
 */
export interface ValidationError {
	type: ValidationErrorType;
	property?: string;
	message: string;
	expectedType?: PropertyType;
	expectedValues?: string[];
	constraint?: SchemaConstraint;
}

/**
 * Validation warning types
 */
export type ValidationWarningType = 'missing_optional' | 'deprecated' | 'unknown_property';

/**
 * A single validation warning
 */
export interface ValidationWarning {
	type: ValidationWarningType;
	property: string;
	message: string;
}

/**
 * Summary of vault-wide validation
 */
export interface ValidationSummary {
	totalPeopleValidated: number;
	totalSchemas: number;
	totalErrors: number;
	totalWarnings: number;
	errorsByType: Record<ValidationErrorType, number>;
	errorsBySchema: Record<string, number>;
	validatedAt: Date;
}

/**
 * Schema statistics for display in UI
 */
export interface SchemaStats {
	totalSchemas: number;
	byScope: {
		collection: number;
		folder: number;
		universe: number;
		all: number;
	};
}

/**
 * Empty schema definition for creating new schemas
 */
export const EMPTY_SCHEMA_DEFINITION: SchemaDefinition = {
	requiredProperties: [],
	properties: {},
	constraints: []
};

/**
 * Default values for a new schema note
 */
export function createEmptySchemaNote(crId: string, name: string): Omit<SchemaNote, 'filePath'> {
	return {
		cr_id: crId,
		name,
		description: '',
		appliesToType: 'all',
		appliesToValue: undefined,
		definition: { ...EMPTY_SCHEMA_DEFINITION }
	};
}
