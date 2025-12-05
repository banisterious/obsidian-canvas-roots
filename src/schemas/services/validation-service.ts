/**
 * Validation Service
 *
 * Validates person notes against schema definitions.
 */

import { TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import { getLogger } from '../../core/logging';
import { SchemaService } from './schema-service';
import { FACT_KEYS } from '../../sources';
import type {
	SchemaNote,
	PropertyDefinition,
	SchemaConstraint,
	ConditionalRequirement,
	ValidationResult,
	ValidationError,
	ValidationWarning,
	ValidationErrorType,
	ValidationSummary
} from '../types/schema-types';

const logger = getLogger('ValidationService');

/**
 * Wikilink regex pattern to extract link target
 * Matches [[Target]] or [[Target|Display]]
 */
const WIKILINK_REGEX = /^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/;

/**
 * Service for validating person notes against schemas
 */
export class ValidationService {
	private plugin: CanvasRootsPlugin;
	private schemaService: SchemaService;

	constructor(plugin: CanvasRootsPlugin, schemaService: SchemaService) {
		this.plugin = plugin;
		this.schemaService = schemaService;
	}

	/**
	 * Validate a single person note against all applicable schemas
	 */
	async validatePerson(file: TFile): Promise<ValidationResult[]> {
		const schemas = await this.schemaService.getSchemasForPerson(file);
		if (schemas.length === 0) {
			return [];
		}

		const cache = this.plugin.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) {
			return schemas.map(schema => ({
				filePath: file.path,
				personName: file.basename,
				schemaCrId: schema.cr_id,
				schemaName: schema.name,
				isValid: false,
				errors: [{
					type: 'missing_required' as ValidationErrorType,
					message: 'Note has no frontmatter'
				}],
				warnings: []
			}));
		}

		const fm = cache.frontmatter;
		const personName = (fm.name as string) || file.basename;

		return schemas.map(schema =>
			this.validateAgainstSchema(file.path, personName, fm, schema)
		);
	}

	/**
	 * Validate all person notes in the vault
	 */
	async validateVault(): Promise<ValidationResult[]> {
		const results: ValidationResult[] = [];
		const files = this.plugin.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.plugin.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter?.cr_id) continue;

			// Skip non-person notes (place, map, schema)
			if (cache.frontmatter.type) continue;

			const personResults = await this.validatePerson(file);
			results.push(...personResults);
		}

		logger.info('validate-vault', 'Vault validation complete', {
			totalResults: results.length,
			errors: results.filter(r => !r.isValid).length
		});

		return results;
	}

	/**
	 * Get a summary of validation results
	 */
	getSummary(results: ValidationResult[]): ValidationSummary {
		const errorsByType: Record<ValidationErrorType, number> = {
			missing_required: 0,
			invalid_type: 0,
			invalid_enum: 0,
			out_of_range: 0,
			constraint_failed: 0,
			conditional_required: 0,
			invalid_wikilink_target: 0
		};

		const errorsBySchema: Record<string, number> = {};
		const schemaIds = new Set<string>();
		let totalErrors = 0;
		let totalWarnings = 0;

		for (const result of results) {
			schemaIds.add(result.schemaCrId);

			for (const error of result.errors) {
				errorsByType[error.type]++;
				errorsBySchema[result.schemaCrId] = (errorsBySchema[result.schemaCrId] || 0) + 1;
				totalErrors++;
			}

			totalWarnings += result.warnings.length;
		}

		return {
			totalPeopleValidated: new Set(results.map(r => r.filePath)).size,
			totalSchemas: schemaIds.size,
			totalErrors,
			totalWarnings,
			errorsByType,
			errorsBySchema,
			validatedAt: new Date()
		};
	}

	/**
	 * Validate a person's frontmatter against a single schema
	 */
	private validateAgainstSchema(
		filePath: string,
		personName: string,
		frontmatter: Record<string, unknown>,
		schema: SchemaNote
	): ValidationResult {
		const errors: ValidationError[] = [];
		const warnings: ValidationWarning[] = [];

		// Check required properties
		for (const propName of schema.definition.requiredProperties) {
			if (!this.hasValue(frontmatter[propName])) {
				errors.push({
					type: 'missing_required',
					property: propName,
					message: `Missing required property: ${propName}`
				});
			}
		}

		// Check property definitions
		for (const [propName, propDef] of Object.entries(schema.definition.properties)) {
			const value = frontmatter[propName];

			// Check conditional requirements
			if (propDef.requiredIf && this.isConditionallyRequired(frontmatter, propDef.requiredIf)) {
				if (!this.hasValue(value)) {
					errors.push({
						type: 'conditional_required',
						property: propName,
						message: `Property "${propName}" is required when ${this.describeCondition(propDef.requiredIf)}`
					});
					continue;
				}
			}

			// Skip validation if value is not present and not required
			if (!this.hasValue(value)) continue;

			// Validate type
			const typeError = this.validateType(propName, value, propDef);
			if (typeError) {
				errors.push(typeError);
				continue;
			}

			// Validate enum values
			if (propDef.type === 'enum' && propDef.values) {
				const enumError = this.validateEnum(propName, value, propDef.values);
				if (enumError) {
					errors.push(enumError);
				}
			}

			// Validate number range
			if (propDef.type === 'number') {
				const rangeError = this.validateRange(propName, value as number, propDef);
				if (rangeError) {
					errors.push(rangeError);
				}
			}

			// Validate wikilink target type
			if (propDef.type === 'wikilink' && propDef.targetType) {
				const targetError = this.validateWikilinkTarget(propName, value, propDef.targetType);
				if (targetError) {
					errors.push(targetError);
				}
			}
		}

		// Check constraints
		for (const constraint of schema.definition.constraints) {
			if (!this.evaluateConstraint(frontmatter, constraint)) {
				errors.push({
					type: 'constraint_failed',
					message: constraint.message,
					constraint
				});
			}
		}

		return {
			filePath,
			personName,
			schemaCrId: schema.cr_id,
			schemaName: schema.name,
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}

	/**
	 * Check if a value is present (not undefined, null, or empty string)
	 */
	private hasValue(value: unknown): boolean {
		if (value === undefined || value === null) return false;
		if (typeof value === 'string' && value.trim() === '') return false;
		if (Array.isArray(value) && value.length === 0) return false;
		return true;
	}

	/**
	 * Check if a conditional requirement is satisfied
	 */
	private isConditionallyRequired(
		frontmatter: Record<string, unknown>,
		condition: ConditionalRequirement
	): boolean {
		const value = frontmatter[condition.property];

		if (condition.exists !== undefined) {
			return condition.exists ? this.hasValue(value) : !this.hasValue(value);
		}

		if (condition.equals !== undefined) {
			return value === condition.equals;
		}

		if (condition.notEquals !== undefined) {
			return value !== condition.notEquals;
		}

		return false;
	}

	/**
	 * Describe a conditional requirement for error messages
	 */
	private describeCondition(condition: ConditionalRequirement): string {
		if (condition.exists !== undefined) {
			return condition.exists
				? `"${condition.property}" is set`
				: `"${condition.property}" is not set`;
		}
		if (condition.equals !== undefined) {
			const eqStr = typeof condition.equals === 'object' ? JSON.stringify(condition.equals) : String(condition.equals);
			return `"${condition.property}" equals "${eqStr}"`;
		}
		if (condition.notEquals !== undefined) {
			const neqStr = typeof condition.notEquals === 'object' ? JSON.stringify(condition.notEquals) : String(condition.notEquals);
			return `"${condition.property}" is not "${neqStr}"`;
		}
		return 'condition is met';
	}

	/**
	 * Validate the type of a value
	 */
	private validateType(
		propName: string,
		value: unknown,
		propDef: PropertyDefinition
	): ValidationError | null {
		switch (propDef.type) {
			case 'string':
				if (typeof value !== 'string') {
					return {
						type: 'invalid_type',
						property: propName,
						message: `Expected string for "${propName}", got ${typeof value}`,
						expectedType: 'string'
					};
				}
				break;

			case 'number':
				if (typeof value !== 'number' || isNaN(value)) {
					return {
						type: 'invalid_type',
						property: propName,
						message: `Expected number for "${propName}", got ${typeof value}`,
						expectedType: 'number'
					};
				}
				break;

			case 'boolean':
				if (typeof value !== 'boolean') {
					return {
						type: 'invalid_type',
						property: propName,
						message: `Expected boolean for "${propName}", got ${typeof value}`,
						expectedType: 'boolean'
					};
				}
				break;

			case 'date':
				// Dates can be strings in various formats
				if (typeof value !== 'string' && typeof value !== 'number') {
					return {
						type: 'invalid_type',
						property: propName,
						message: `Expected date for "${propName}", got ${typeof value}`,
						expectedType: 'date'
					};
				}
				break;

			case 'wikilink':
				if (typeof value !== 'string' || !WIKILINK_REGEX.test(value)) {
					return {
						type: 'invalid_type',
						property: propName,
						message: `Expected wikilink for "${propName}" (format: [[Target]])`,
						expectedType: 'wikilink'
					};
				}
				break;

			case 'array':
				if (!Array.isArray(value)) {
					return {
						type: 'invalid_type',
						property: propName,
						message: `Expected array for "${propName}", got ${typeof value}`,
						expectedType: 'array'
					};
				}
				break;

			case 'enum':
				// Enum values should be strings
				if (typeof value !== 'string') {
					return {
						type: 'invalid_type',
						property: propName,
						message: `Expected string for enum "${propName}", got ${typeof value}`,
						expectedType: 'enum'
					};
				}
				break;

			case 'sourced_facts':
				// Validate sourced_facts structure
				const sourcedFactsError = this.validateSourcedFacts(propName, value);
				if (sourcedFactsError) {
					return sourcedFactsError;
				}
				break;
		}

		return null;
	}

	/**
	 * Validate the sourced_facts property structure
	 * Expected format:
	 * {
	 *   birth_date: { sources: ["[[Source1]]", "[[Source2]]"] },
	 *   death_date: { sources: ["[[Source1]]"] }
	 * }
	 */
	private validateSourcedFacts(
		propName: string,
		value: unknown
	): ValidationError | null {
		// Must be an object
		if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			return {
				type: 'invalid_type',
				property: propName,
				message: `Expected object for "${propName}", got ${Array.isArray(value) ? 'array' : typeof value}`,
				expectedType: 'sourced_facts'
			};
		}

		const obj = value as Record<string, unknown>;

		// Validate each fact key entry
		for (const [factKey, factEntry] of Object.entries(obj)) {
			// Check if factKey is valid
			if (!FACT_KEYS.includes(factKey as typeof FACT_KEYS[number])) {
				return {
					type: 'invalid_type',
					property: propName,
					message: `Invalid fact key "${factKey}" in "${propName}". Valid keys: ${FACT_KEYS.join(', ')}`,
					expectedType: 'sourced_facts'
				};
			}

			// Check fact entry structure
			if (typeof factEntry !== 'object' || factEntry === null) {
				return {
					type: 'invalid_type',
					property: propName,
					message: `Expected object for "${propName}.${factKey}", got ${typeof factEntry}`,
					expectedType: 'sourced_facts'
				};
			}

			const entry = factEntry as Record<string, unknown>;

			// Check sources array
			if (!('sources' in entry)) {
				return {
					type: 'invalid_type',
					property: propName,
					message: `Missing "sources" array in "${propName}.${factKey}"`,
					expectedType: 'sourced_facts'
				};
			}

			if (!Array.isArray(entry.sources)) {
				return {
					type: 'invalid_type',
					property: propName,
					message: `Expected array for "${propName}.${factKey}.sources", got ${typeof entry.sources}`,
					expectedType: 'sourced_facts'
				};
			}

			// Validate each source is a wikilink
			for (let i = 0; i < entry.sources.length; i++) {
				const source = entry.sources[i];
				if (typeof source !== 'string' || !WIKILINK_REGEX.test(source)) {
					return {
						type: 'invalid_type',
						property: propName,
						message: `Invalid source at "${propName}.${factKey}.sources[${i}]": expected wikilink format [[Source]]`,
						expectedType: 'sourced_facts'
					};
				}
			}
		}

		return null;
	}

	/**
	 * Validate that a value is in the allowed enum values
	 */
	private validateEnum(
		propName: string,
		value: unknown,
		allowedValues: string[]
	): ValidationError | null {
		if (typeof value !== 'string' || !allowedValues.includes(value)) {
			return {
				type: 'invalid_enum',
				property: propName,
				message: `Invalid value "${String(value)}" for "${propName}". Allowed: ${allowedValues.join(', ')}`,
				expectedValues: allowedValues
			};
		}
		return null;
	}

	/**
	 * Validate that a number is within the allowed range
	 */
	private validateRange(
		propName: string,
		value: number,
		propDef: PropertyDefinition
	): ValidationError | null {
		if (propDef.min !== undefined && value < propDef.min) {
			return {
				type: 'out_of_range',
				property: propName,
				message: `Value ${value} for "${propName}" is below minimum ${propDef.min}`
			};
		}

		if (propDef.max !== undefined && value > propDef.max) {
			return {
				type: 'out_of_range',
				property: propName,
				message: `Value ${value} for "${propName}" is above maximum ${propDef.max}`
			};
		}

		return null;
	}

	/**
	 * Validate that a wikilink points to a note of the expected type
	 */
	private validateWikilinkTarget(
		propName: string,
		value: unknown,
		targetType: string
	): ValidationError | null {
		if (typeof value !== 'string') return null;

		const match = value.match(WIKILINK_REGEX);
		if (!match) return null;

		const linkTarget = match[1];
		const targetFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkTarget, '');

		if (!targetFile) {
			// Link doesn't resolve - could be a warning, but we'll skip validation
			return null;
		}

		const targetCache = this.plugin.app.metadataCache.getFileCache(targetFile);
		const targetNoteType = targetCache?.frontmatter?.type as string | undefined;

		// Check if target note is of the expected type
		if (targetType === 'place' && targetNoteType !== 'place') {
			return {
				type: 'invalid_wikilink_target',
				property: propName,
				message: `"${propName}" should link to a place note, but "${linkTarget}" is not a place`
			};
		}

		if (targetType === 'map' && targetNoteType !== 'map') {
			return {
				type: 'invalid_wikilink_target',
				property: propName,
				message: `"${propName}" should link to a map note, but "${linkTarget}" is not a map`
			};
		}

		if (targetType === 'person' && !targetCache?.frontmatter?.cr_id) {
			return {
				type: 'invalid_wikilink_target',
				property: propName,
				message: `"${propName}" should link to a person note, but "${linkTarget}" is not a person`
			};
		}

		return null;
	}

	/**
	 * Evaluate a constraint expression against frontmatter
	 * Uses a safe expression parser (no eval)
	 */
	private evaluateConstraint(
		frontmatter: Record<string, unknown>,
		constraint: SchemaConstraint
	): boolean {
		try {
			// Create a sandboxed context with only frontmatter properties
			const sandbox = this.createSandbox(frontmatter);

			// Parse and evaluate the expression safely
			const result = this.safeEvaluate(constraint.rule, sandbox);

			return Boolean(result);
		} catch (error) {
			logger.warn('constraint', 'Failed to evaluate constraint', {
				rule: constraint.rule,
				error: String(error)
			});
			// If constraint can't be evaluated, treat as passed (don't block on bad rules)
			return true;
		}
	}

	/**
	 * Safely evaluate a simple expression without using eval or Function constructor
	 * Supports: comparisons (==, !=, <, >, <=, >=), logical operators (&&, ||, !),
	 * property access, string/number literals, and basic arithmetic
	 */
	private safeEvaluate(expression: string, context: Record<string, unknown>): unknown {
		const trimmed = expression.trim();

		// Handle logical NOT
		if (trimmed.startsWith('!')) {
			return !this.safeEvaluate(trimmed.slice(1), context);
		}

		// Handle parentheses
		if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
			// Find matching closing paren
			let depth = 1;
			let i = 1;
			while (i < trimmed.length && depth > 0) {
				if (trimmed[i] === '(') depth++;
				else if (trimmed[i] === ')') depth--;
				i++;
			}
			if (i === trimmed.length && depth === 0) {
				return this.safeEvaluate(trimmed.slice(1, -1), context);
			}
		}

		// Handle logical OR (lowest precedence)
		const orIndex = this.findOperator(trimmed, '||');
		if (orIndex !== -1) {
			const left = this.safeEvaluate(trimmed.slice(0, orIndex), context);
			const right = this.safeEvaluate(trimmed.slice(orIndex + 2), context);
			return left || right;
		}

		// Handle logical AND
		const andIndex = this.findOperator(trimmed, '&&');
		if (andIndex !== -1) {
			const left = this.safeEvaluate(trimmed.slice(0, andIndex), context);
			const right = this.safeEvaluate(trimmed.slice(andIndex + 2), context);
			return left && right;
		}

		// Handle comparisons
		const comparisons: [string, (a: unknown, b: unknown) => boolean][] = [
			['===', (a, b) => a === b],
			['!==', (a, b) => a !== b],
			['==', (a, b) => a == b],
			['!=', (a, b) => a != b],
			['<=', (a, b) => Number(a) <= Number(b)],
			['>=', (a, b) => Number(a) >= Number(b)],
			['<', (a, b) => Number(a) < Number(b)],
			['>', (a, b) => Number(a) > Number(b)],
		];

		for (const [op, fn] of comparisons) {
			const idx = this.findOperator(trimmed, op);
			if (idx !== -1) {
				const left = this.safeEvaluate(trimmed.slice(0, idx), context);
				const right = this.safeEvaluate(trimmed.slice(idx + op.length), context);
				return fn(left, right);
			}
		}

		// Handle arithmetic (for completeness)
		const addIndex = this.findOperator(trimmed, '+');
		if (addIndex !== -1) {
			const left = this.safeEvaluate(trimmed.slice(0, addIndex), context);
			const right = this.safeEvaluate(trimmed.slice(addIndex + 1), context);
			return Number(left) + Number(right);
		}

		const subIndex = this.findOperator(trimmed, '-');
		if (subIndex !== -1 && subIndex > 0) {
			const left = this.safeEvaluate(trimmed.slice(0, subIndex), context);
			const right = this.safeEvaluate(trimmed.slice(subIndex + 1), context);
			return Number(left) - Number(right);
		}

		// Handle literals and variable references
		return this.evaluatePrimitive(trimmed, context);
	}

	/**
	 * Find operator index, respecting parentheses and string literals
	 */
	private findOperator(expr: string, op: string): number {
		let depth = 0;
		let inString: string | null = null;

		for (let i = 0; i < expr.length - op.length + 1; i++) {
			const char = expr[i];

			// Handle string literals
			if ((char === '"' || char === "'") && (i === 0 || expr[i - 1] !== '\\')) {
				if (inString === char) {
					inString = null;
				} else if (!inString) {
					inString = char;
				}
				continue;
			}

			if (inString) continue;

			// Handle parentheses
			if (char === '(') depth++;
			else if (char === ')') depth--;

			// Check for operator at this position
			if (depth === 0 && expr.slice(i, i + op.length) === op) {
				// Avoid matching part of longer operators
				if (op === '=' && (expr[i + 1] === '=' || expr[i - 1] === '=' || expr[i - 1] === '!' || expr[i - 1] === '<' || expr[i - 1] === '>')) {
					continue;
				}
				if (op === '|' && expr[i + 1] === '|') continue;
				if (op === '&' && expr[i + 1] === '&') continue;
				return i;
			}
		}

		return -1;
	}

	/**
	 * Evaluate a primitive value (literal or variable reference)
	 */
	private evaluatePrimitive(expr: string, context: Record<string, unknown>): unknown {
		const trimmed = expr.trim();

		// Null/undefined literals
		if (trimmed === 'null') return null;
		if (trimmed === 'undefined') return undefined;
		if (trimmed === 'true') return true;
		if (trimmed === 'false') return false;

		// Number literals
		if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
			return parseFloat(trimmed);
		}

		// String literals
		if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
			(trimmed.startsWith("'") && trimmed.endsWith("'"))) {
			return trimmed.slice(1, -1);
		}

		// Variable reference (property from context)
		if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
			return context[trimmed];
		}

		// Unsupported expression
		throw new Error(`Unsupported expression: ${trimmed}`);
	}

	/**
	 * Create a sandboxed object for constraint evaluation
	 * Only includes simple values, no functions or dangerous objects
	 */
	private createSandbox(frontmatter: Record<string, unknown>): Record<string, unknown> {
		const sandbox: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(frontmatter)) {
			// Only include primitive values and arrays
			if (
				typeof value === 'string' ||
				typeof value === 'number' ||
				typeof value === 'boolean' ||
				value === null ||
				value === undefined ||
				Array.isArray(value)
			) {
				sandbox[key] = value;
			}
		}

		return sandbox;
	}
}
