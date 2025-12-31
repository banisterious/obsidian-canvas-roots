/**
 * Data Quality Service
 *
 * Detects data quality issues in person notes including:
 * - Date inconsistencies (impossible dates, chronological errors)
 * - Relationship inconsistencies (circular refs, orphan links, gender mismatches)
 * - Missing required data (no parents, no dates, etc.)
 * - Data format issues (non-standard date formats, etc.)
 */

import { App, TFile } from 'obsidian';
import { getLogger } from './logging';
import { FamilyGraphService, PersonNode } from './family-graph';
import { FolderFilterService } from './folder-filter';
import { CanvasRootsSettings } from '../settings';
import { ALL_NOTE_TYPES, NoteType } from '../utils/note-type-detection';
import { CANONICAL_SEX_VALUES, CanonicalSex, BUILTIN_SYNONYMS } from './value-alias-service';
import { SchemaService } from '../schemas/services/schema-service';
import type { SchemaNote } from '../schemas/types/schema-types';
import type CanvasRootsPlugin from '../../main';

const logger = getLogger('DataQuality');

/**
 * Severity levels for data quality issues
 */
export type IssueSeverity = 'error' | 'warning' | 'info';

/**
 * Categories of data quality issues
 */
export type IssueCategory =
	| 'date_inconsistency'
	| 'relationship_inconsistency'
	| 'missing_data'
	| 'data_format'
	| 'orphan_reference'
	| 'nested_property'
	| 'legacy_type_property';

/**
 * A single data quality issue
 */
export interface DataQualityIssue {
	/** Unique identifier for the issue type */
	code: string;

	/** Human-readable description */
	message: string;

	/** Severity level */
	severity: IssueSeverity;

	/** Issue category */
	category: IssueCategory;

	/** The person affected */
	person: PersonNode;

	/** Related person (if applicable) */
	relatedPerson?: PersonNode;

	/** Additional context data */
	details?: Record<string, string | number | boolean>;
}

/**
 * Summary statistics for a data quality report
 */
export interface DataQualitySummary {
	/** Total people analyzed */
	totalPeople: number;

	/** Total issues found */
	totalIssues: number;

	/** Issues by severity */
	bySeverity: {
		error: number;
		warning: number;
		info: number;
	};

	/** Issues by category */
	byCategory: Record<IssueCategory, number>;

	/** Data completeness metrics */
	completeness: {
		withBirthDate: number;
		withDeathDate: number;
		withBothParents: number;
		withAtLeastOneParent: number;
		withSpouse: number;
		withChildren: number;
		withGender: number;
	};

	/** Overall quality score (0-100) */
	qualityScore: number;
}

/**
 * Full data quality report
 */
export interface DataQualityReport {
	/** When the report was generated */
	generatedAt: Date;

	/** Scope of the report */
	scope: 'all' | 'staging' | 'folder';

	/** Folder path if scope is 'folder' */
	folderPath?: string;

	/** Summary statistics */
	summary: DataQualitySummary;

	/** All issues found */
	issues: DataQualityIssue[];
}

/**
 * Progress callback for batch operations
 */
export interface BatchProgressCallback {
	/** Called with current progress */
	onProgress: (current: number, total: number, currentFile?: string) => void;
}

/**
 * Options for running data quality checks
 */
export interface DataQualityOptions {
	/** Scope of analysis */
	scope?: 'all' | 'staging' | 'folder';

	/** Folder path if scope is 'folder' */
	folderPath?: string;

	/** Which checks to run (default: all) */
	checks?: {
		dateInconsistencies?: boolean;
		relationshipInconsistencies?: boolean;
		missingData?: boolean;
		dataFormat?: boolean;
		orphanReferences?: boolean;
		nestedProperties?: boolean;
		legacyTypeProperty?: boolean;
	};

	/** Minimum severity to include */
	minSeverity?: IssueSeverity;

	/** Progress callback for batch operations */
	progress?: BatchProgressCallback;
}

/**
 * Service for analyzing data quality in person notes
 */
export class DataQualityService {
	private schemaService: SchemaService | null = null;

	constructor(
		private app: App,
		private settings: CanvasRootsSettings,
		private familyGraph: FamilyGraphService,
		private folderFilter: FolderFilterService,
		private plugin?: CanvasRootsPlugin
	) {
		// Initialize schema service if plugin is available
		if (plugin) {
			this.schemaService = new SchemaService(plugin);
		}
	}

	/**
	 * Check if a schema defines custom sex enum values
	 */
	private hasCustomSexSchema(schemas: SchemaNote[]): boolean {
		for (const schema of schemas) {
			const sexProp = schema.definition?.properties?.['sex'];
			if (sexProp?.type === 'enum' && sexProp.values && sexProp.values.length > 0) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Run a full data quality analysis
	 */
	analyze(options: DataQualityOptions = {}): DataQualityReport {
		const startTime = Date.now();
		logger.info('analyze', `Starting data quality analysis with scope: ${options.scope ?? 'all'}`);

		// Get all people to analyze based on scope
		const people = this.getPeopleForScope(options);
		logger.info('analyze', `Analyzing ${people.length} people`);

		// Build lookup map for relationship checks
		const peopleMap = new Map<string, PersonNode>();
		for (const person of people) {
			peopleMap.set(person.crId, person);
		}

		// Run all enabled checks
		const issues: DataQualityIssue[] = [];
		const checks = options.checks ?? {
			dateInconsistencies: true,
			relationshipInconsistencies: true,
			missingData: true,
			dataFormat: true,
			orphanReferences: true,
			nestedProperties: true,
			legacyTypeProperty: true,
		};

		for (const person of people) {
			if (checks.dateInconsistencies) {
				issues.push(...this.checkDateInconsistencies(person, peopleMap));
			}
			if (checks.relationshipInconsistencies) {
				issues.push(...this.checkRelationshipInconsistencies(person, peopleMap));
			}
			if (checks.missingData) {
				issues.push(...this.checkMissingData(person));
			}
			if (checks.dataFormat) {
				issues.push(...this.checkDataFormat(person));
			}
			if (checks.orphanReferences) {
				issues.push(...this.checkOrphanReferences(person, peopleMap));
			}
			if (checks.nestedProperties) {
				issues.push(...this.checkNestedProperties(person));
			}
			if (checks.legacyTypeProperty) {
				issues.push(...this.checkLegacyTypeProperty(person));
			}
		}

		// Filter by minimum severity if specified
		const filteredIssues = options.minSeverity
			? this.filterBySeverity(issues, options.minSeverity)
			: issues;

		// Calculate summary
		const summary = this.calculateSummary(people, filteredIssues);

		const report: DataQualityReport = {
			generatedAt: new Date(),
			scope: options.scope ?? 'all',
			folderPath: options.folderPath,
			summary,
			issues: filteredIssues,
		};

		logger.info('analyze', `Data quality analysis complete in ${Date.now() - startTime}ms: ${people.length} people, ${filteredIssues.length} issues, score ${summary.qualityScore}`);

		return report;
	}

	/**
	 * Get people based on the analysis scope
	 */
	private getPeopleForScope(options: DataQualityOptions): PersonNode[] {
		// Ensure the family graph cache is loaded
		this.familyGraph.ensureCacheLoaded();

		// Get all people from the cache
		const allPeople = this.familyGraph.getAllPeople();

		if (options.scope === 'staging' && this.settings.stagingFolder) {
			// Only staging folder
			return allPeople.filter(p =>
				p.file.path.toLowerCase().startsWith(this.settings.stagingFolder.toLowerCase() + '/')
			);
		}

		if (options.scope === 'folder' && options.folderPath) {
			// Specific folder
			return allPeople.filter(p =>
				p.file.path.toLowerCase().startsWith(options.folderPath!.toLowerCase() + '/')
			);
		}

		// Default: all people (respecting folder filter)
		return allPeople;
	}

	/**
	 * Check for date-related inconsistencies
	 */
	private checkDateInconsistencies(
		person: PersonNode,
		peopleMap: Map<string, PersonNode>
	): DataQualityIssue[] {
		const issues: DataQualityIssue[] = [];

		const birthYear = this.parseYear(person.birthDate);
		const deathYear = this.parseYear(person.deathDate);

		// Death before birth
		if (birthYear && deathYear && deathYear < birthYear) {
			issues.push({
				code: 'DEATH_BEFORE_BIRTH',
				message: `Death year (${deathYear}) is before birth year (${birthYear})`,
				severity: 'error',
				category: 'date_inconsistency',
				person,
				details: { birthYear, deathYear },
			});
		}

		// Unreasonable age (> 120 years)
		if (birthYear && deathYear && deathYear - birthYear > 120) {
			issues.push({
				code: 'UNREASONABLE_AGE',
				message: `Lived for ${deathYear - birthYear} years (over 120)`,
				severity: 'warning',
				category: 'date_inconsistency',
				person,
				details: { age: deathYear - birthYear },
			});
		}

		// Future birth date
		const currentYear = new Date().getFullYear();
		if (birthYear && birthYear > currentYear) {
			issues.push({
				code: 'FUTURE_BIRTH',
				message: `Birth year (${birthYear}) is in the future`,
				severity: 'error',
				category: 'date_inconsistency',
				person,
				details: { birthYear },
			});
		}

		// Future death date
		if (deathYear && deathYear > currentYear) {
			issues.push({
				code: 'FUTURE_DEATH',
				message: `Death year (${deathYear}) is in the future`,
				severity: 'error',
				category: 'date_inconsistency',
				person,
				details: { deathYear },
			});
		}

		// Born before parent
		if (person.fatherCrId && birthYear) {
			const father = peopleMap.get(person.fatherCrId);
			if (father) {
				const fatherBirthYear = this.parseYear(father.birthDate);
				if (fatherBirthYear && birthYear <= fatherBirthYear) {
					issues.push({
						code: 'BORN_BEFORE_PARENT',
						message: `Born in ${birthYear}, but father was born in ${fatherBirthYear}`,
						severity: 'error',
						category: 'date_inconsistency',
						person,
						relatedPerson: father,
						details: { personBirth: birthYear, parentBirth: fatherBirthYear, parentType: 'father' },
					});
				}
				// Parent too young (< 12 years old at child's birth)
				if (fatherBirthYear && birthYear - fatherBirthYear < 12) {
					issues.push({
						code: 'PARENT_TOO_YOUNG',
						message: `Father was only ${birthYear - fatherBirthYear} years old at birth`,
						severity: 'warning',
						category: 'date_inconsistency',
						person,
						relatedPerson: father,
						details: { parentAge: birthYear - fatherBirthYear, parentType: 'father' },
					});
				}
				// Parent too old (> 80 years old at child's birth for father)
				if (fatherBirthYear && birthYear - fatherBirthYear > 80) {
					issues.push({
						code: 'PARENT_TOO_OLD',
						message: `Father was ${birthYear - fatherBirthYear} years old at birth`,
						severity: 'warning',
						category: 'date_inconsistency',
						person,
						relatedPerson: father,
						details: { parentAge: birthYear - fatherBirthYear, parentType: 'father' },
					});
				}
			}
		}

		if (person.motherCrId && birthYear) {
			const mother = peopleMap.get(person.motherCrId);
			if (mother) {
				const motherBirthYear = this.parseYear(mother.birthDate);
				if (motherBirthYear && birthYear <= motherBirthYear) {
					issues.push({
						code: 'BORN_BEFORE_PARENT',
						message: `Born in ${birthYear}, but mother was born in ${motherBirthYear}`,
						severity: 'error',
						category: 'date_inconsistency',
						person,
						relatedPerson: mother,
						details: { personBirth: birthYear, parentBirth: motherBirthYear, parentType: 'mother' },
					});
				}
				// Parent too young
				if (motherBirthYear && birthYear - motherBirthYear < 12) {
					issues.push({
						code: 'PARENT_TOO_YOUNG',
						message: `Mother was only ${birthYear - motherBirthYear} years old at birth`,
						severity: 'warning',
						category: 'date_inconsistency',
						person,
						relatedPerson: mother,
						details: { parentAge: birthYear - motherBirthYear, parentType: 'mother' },
					});
				}
				// Parent too old (> 55 for mother)
				if (motherBirthYear && birthYear - motherBirthYear > 55) {
					issues.push({
						code: 'PARENT_TOO_OLD',
						message: `Mother was ${birthYear - motherBirthYear} years old at birth`,
						severity: 'warning',
						category: 'date_inconsistency',
						person,
						relatedPerson: mother,
						details: { parentAge: birthYear - motherBirthYear, parentType: 'mother' },
					});
				}
				// Born after mother's death
				const motherDeathYear = this.parseYear(mother.deathDate);
				if (motherDeathYear && birthYear > motherDeathYear) {
					issues.push({
						code: 'BORN_AFTER_PARENT_DEATH',
						message: `Born in ${birthYear}, but mother died in ${motherDeathYear}`,
						severity: 'error',
						category: 'date_inconsistency',
						person,
						relatedPerson: mother,
						details: { personBirth: birthYear, parentDeath: motherDeathYear, parentType: 'mother' },
					});
				}
			}
		}

		return issues;
	}

	/**
	 * Check for relationship inconsistencies
	 */
	private checkRelationshipInconsistencies(
		person: PersonNode,
		peopleMap: Map<string, PersonNode>
	): DataQualityIssue[] {
		const issues: DataQualityIssue[] = [];

		// Gender mismatch: marked as father but gender is F
		if (person.sex === 'F') {
			for (const [, other] of peopleMap) {
				if (other.fatherCrId === person.crId) {
					issues.push({
						code: 'GENDER_ROLE_MISMATCH',
						message: `Listed as father of ${other.name}, but gender is Female`,
						severity: 'warning',
						category: 'relationship_inconsistency',
						person,
						relatedPerson: other,
					});
					break; // Only report once per person
				}
			}
		}

		// Gender mismatch: marked as mother but gender is M
		if (person.sex === 'M') {
			for (const [, other] of peopleMap) {
				if (other.motherCrId === person.crId) {
					issues.push({
						code: 'GENDER_ROLE_MISMATCH',
						message: `Listed as mother of ${other.name}, but gender is Male`,
						severity: 'warning',
						category: 'relationship_inconsistency',
						person,
						relatedPerson: other,
					});
					break;
				}
			}
		}

		// Self-referential relationships
		if (person.fatherCrId === person.crId) {
			issues.push({
				code: 'SELF_REFERENCE',
				message: 'Person is listed as their own father',
				severity: 'error',
				category: 'relationship_inconsistency',
				person,
			});
		}
		if (person.motherCrId === person.crId) {
			issues.push({
				code: 'SELF_REFERENCE',
				message: 'Person is listed as their own mother',
				severity: 'error',
				category: 'relationship_inconsistency',
				person,
			});
		}
		if (person.spouseCrIds.includes(person.crId)) {
			issues.push({
				code: 'SELF_REFERENCE',
				message: 'Person is listed as their own spouse',
				severity: 'error',
				category: 'relationship_inconsistency',
				person,
			});
		}

		// Circular parent-child (A is parent of B, B is parent of A)
		if (person.fatherCrId) {
			const father = peopleMap.get(person.fatherCrId);
			if (father && (father.fatherCrId === person.crId || father.motherCrId === person.crId)) {
				issues.push({
					code: 'CIRCULAR_RELATIONSHIP',
					message: `Circular parent-child relationship with ${father.name}`,
					severity: 'error',
					category: 'relationship_inconsistency',
					person,
					relatedPerson: father,
				});
			}
		}
		if (person.motherCrId) {
			const mother = peopleMap.get(person.motherCrId);
			if (mother && (mother.fatherCrId === person.crId || mother.motherCrId === person.crId)) {
				issues.push({
					code: 'CIRCULAR_RELATIONSHIP',
					message: `Circular parent-child relationship with ${mother.name}`,
					severity: 'error',
					category: 'relationship_inconsistency',
					person,
					relatedPerson: mother,
				});
			}
		}

		// Duplicate spouse entries
		const uniqueSpouses = new Set(person.spouseCrIds);
		if (uniqueSpouses.size < person.spouseCrIds.length) {
			issues.push({
				code: 'DUPLICATE_SPOUSE',
				message: 'Same spouse listed multiple times',
				severity: 'warning',
				category: 'relationship_inconsistency',
				person,
			});
		}

		return issues;
	}

	/**
	 * Check for missing data
	 */
	private checkMissingData(person: PersonNode): DataQualityIssue[] {
		const issues: DataQualityIssue[] = [];

		// No parents at all
		if (!person.fatherCrId && !person.motherCrId) {
			issues.push({
				code: 'NO_PARENTS',
				message: 'No parents defined',
				severity: 'info',
				category: 'missing_data',
				person,
			});
		}

		// Only one parent
		if ((person.fatherCrId && !person.motherCrId) || (!person.fatherCrId && person.motherCrId)) {
			issues.push({
				code: 'ONE_PARENT_ONLY',
				message: person.fatherCrId ? 'Mother not defined' : 'Father not defined',
				severity: 'info',
				category: 'missing_data',
				person,
			});
		}

		// No birth date
		if (!person.birthDate) {
			issues.push({
				code: 'NO_BIRTH_DATE',
				message: 'No birth date',
				severity: 'info',
				category: 'missing_data',
				person,
			});
		}

		// No gender
		if (!person.sex) {
			issues.push({
				code: 'NO_GENDER',
				message: 'Gender not specified',
				severity: 'info',
				category: 'missing_data',
				person,
			});
		}

		return issues;
	}

	/**
	 * Check for data format issues
	 */
	private checkDataFormat(person: PersonNode): DataQualityIssue[] {
		const issues: DataQualityIssue[] = [];

		// Read raw frontmatter to get actual on-disk values
		// The PersonNode cache may have stale values after fixes are applied
		const cache = this.app.metadataCache.getFileCache(person.file);
		const fm = cache?.frontmatter as Record<string, unknown> | undefined;

		// Get raw date values from frontmatter (handle Date objects and numbers)
		const rawBorn = fm?.['born'];
		const rawDied = fm?.['died'];
		const birthDate = rawBorn instanceof Date
			? rawBorn.toISOString().split('T')[0]
			: typeof rawBorn === 'number'
				? String(rawBorn)
				: typeof rawBorn === 'string' ? rawBorn : undefined;
		const deathDate = rawDied instanceof Date
			? rawDied.toISOString().split('T')[0]
			: typeof rawDied === 'number'
				? String(rawDied)
				: typeof rawDied === 'string' ? rawDied : undefined;

		// Non-standard date format for birth
		if (birthDate && !this.isStandardDateFormat(birthDate)) {
			issues.push({
				code: 'NON_STANDARD_DATE',
				message: `Birth date "${birthDate}" is not in standard format (YYYY-MM-DD or YYYY)`,
				severity: 'info',
				category: 'data_format',
				person,
				details: { field: 'birthDate', value: birthDate },
			});
		}

		// Non-standard date format for death
		if (deathDate && !this.isStandardDateFormat(deathDate)) {
			issues.push({
				code: 'NON_STANDARD_DATE',
				message: `Death date "${deathDate}" is not in standard format (YYYY-MM-DD or YYYY)`,
				severity: 'info',
				category: 'data_format',
				person,
				details: { field: 'deathDate', value: deathDate },
			});
		}

		// Non-standard gender value - flag values that can be normalized to canonical GEDCOM codes
		// Canonical values are: M, F, X (nonbinary/other), U (unknown)
		const canonicalGenders = ['M', 'F', 'X', 'U'];
		const rawSex = fm?.['sex'] as string | undefined;
		if (rawSex && !canonicalGenders.includes(rawSex)) {
			issues.push({
				code: 'INVALID_GENDER',
				message: `Gender value "${rawSex}" is not standard GEDCOM format (expected M/F/X/U)`,
				severity: 'warning',
				category: 'data_format',
				person,
				details: { value: rawSex },
			});
		}

		return issues;
	}

	/**
	 * Check if a cr_id has a valid format (xxx-123-xxx-123)
	 * Valid format: 3 letters - 3 digits - 3 letters - 3 digits
	 */
	private isValidCrIdFormat(crId: string): boolean {
		if (!crId) return false;
		const pattern = /^[a-z]{3}-\d{3}-[a-z]{3}-\d{3}$/;
		return pattern.test(crId);
	}

	/**
	 * Check for orphan references (links to non-existent people)
	 * Also checks for corrupt cr_id formats
	 */
	private checkOrphanReferences(
		person: PersonNode,
		peopleMap: Map<string, PersonNode>
	): DataQualityIssue[] {
		const issues: DataQualityIssue[] = [];

		// Father reference
		if (person.fatherCrId) {
			if (!this.isValidCrIdFormat(person.fatherCrId)) {
				issues.push({
					code: 'CORRUPT_CRID_FORMAT',
					message: `Father reference has invalid cr_id format: ${person.fatherCrId}`,
					severity: 'error',
					category: 'orphan_reference',
					person,
					details: { corruptCrId: person.fatherCrId, relationship: 'father' },
				});
			} else if (!peopleMap.has(person.fatherCrId)) {
				issues.push({
					code: 'ORPHAN_FATHER_REF',
					message: `Father reference (${person.fatherCrId}) points to non-existent person`,
					severity: 'warning',
					category: 'orphan_reference',
					person,
					details: { missingCrId: person.fatherCrId, relationship: 'father' },
				});
			}
		}

		// Mother reference
		if (person.motherCrId) {
			if (!this.isValidCrIdFormat(person.motherCrId)) {
				issues.push({
					code: 'CORRUPT_CRID_FORMAT',
					message: `Mother reference has invalid cr_id format: ${person.motherCrId}`,
					severity: 'error',
					category: 'orphan_reference',
					person,
					details: { corruptCrId: person.motherCrId, relationship: 'mother' },
				});
			} else if (!peopleMap.has(person.motherCrId)) {
				issues.push({
					code: 'ORPHAN_MOTHER_REF',
					message: `Mother reference (${person.motherCrId}) points to non-existent person`,
					severity: 'warning',
					category: 'orphan_reference',
					person,
					details: { missingCrId: person.motherCrId, relationship: 'mother' },
				});
			}
		}

		// Spouse references
		for (const spouseCrId of person.spouseCrIds) {
			if (!this.isValidCrIdFormat(spouseCrId)) {
				issues.push({
					code: 'CORRUPT_CRID_FORMAT',
					message: `Spouse reference has invalid cr_id format: ${spouseCrId}`,
					severity: 'error',
					category: 'orphan_reference',
					person,
					details: { corruptCrId: spouseCrId, relationship: 'spouse' },
				});
			} else if (!peopleMap.has(spouseCrId)) {
				issues.push({
					code: 'ORPHAN_SPOUSE_REF',
					message: `Spouse reference (${spouseCrId}) points to non-existent person`,
					severity: 'warning',
					category: 'orphan_reference',
					person,
					details: { missingCrId: spouseCrId, relationship: 'spouse' },
				});
			}
		}

		// Child references
		for (const childCrId of person.childrenCrIds) {
			if (!this.isValidCrIdFormat(childCrId)) {
				issues.push({
					code: 'CORRUPT_CRID_FORMAT',
					message: `Child reference has invalid cr_id format: ${childCrId}`,
					severity: 'error',
					category: 'orphan_reference',
					person,
					details: { corruptCrId: childCrId, relationship: 'child' },
				});
			} else if (!peopleMap.has(childCrId)) {
				issues.push({
					code: 'ORPHAN_CHILD_REF',
					message: `Child reference (${childCrId}) points to non-existent person`,
					severity: 'warning',
					category: 'orphan_reference',
					person,
					details: { missingCrId: childCrId, relationship: 'child' },
				});
			}
		}

		return issues;
	}

	/**
	 * Check for nested/non-flat frontmatter properties
	 * Obsidian recommends flat frontmatter structure for best compatibility
	 */
	private checkNestedProperties(person: PersonNode): DataQualityIssue[] {
		const issues: DataQualityIssue[] = [];

		// Get the cached frontmatter for this file
		const cache = this.app.metadataCache.getFileCache(person.file);
		if (!cache?.frontmatter) {
			return issues;
		}

		const fm = cache.frontmatter as Record<string, unknown>;

		// Check each frontmatter property for nested objects
		for (const [key, value] of Object.entries(fm)) {
			// Skip Obsidian's internal 'position' property
			if (key === 'position') continue;

			if (this.isNestedObject(value, key)) {
				const nestedKeys = this.getNestedKeys(value);
				issues.push({
					code: 'NESTED_PROPERTY',
					message: `Property "${key}" contains nested structure with keys: ${nestedKeys.join(', ')}`,
					severity: 'warning',
					category: 'nested_property',
					person,
					details: {
						property: key,
						nestedKeys: nestedKeys.join(', '),
					},
				});
			}
		}

		return issues;
	}

	/**
	 * Check for legacy 'type' property usage when 'cr_type' is configured as primary
	 * This helps users migrate from the old 'type' property to the namespaced 'cr_type'
	 */
	private checkLegacyTypeProperty(person: PersonNode): DataQualityIssue[] {
		const issues: DataQualityIssue[] = [];

		// Only check if cr_type is configured as the primary type property
		const primaryProperty = this.settings.noteTypeDetection?.primaryTypeProperty ?? 'cr_type';
		if (primaryProperty !== 'cr_type') {
			return issues;
		}

		// Get the cached frontmatter for this file
		const cache = this.app.metadataCache.getFileCache(person.file);
		if (!cache?.frontmatter) {
			return issues;
		}

		const fm = cache.frontmatter as Record<string, unknown>;

		// Check if note has 'type' property with a valid Canvas Roots type value
		const typeValue = fm['type'];
		if (typeof typeValue !== 'string') {
			return issues;
		}

		// Check if the type value is a recognized Canvas Roots note type
		const isCanvasRootsType = ALL_NOTE_TYPES.includes(typeValue as NoteType);
		if (!isCanvasRootsType) {
			return issues;
		}

		// Check if note already has cr_type (no migration needed)
		const crTypeValue = fm['cr_type'];
		if (crTypeValue !== undefined) {
			return issues;
		}

		// Found a note with legacy 'type' property that should be migrated
		issues.push({
			code: 'LEGACY_TYPE_PROPERTY',
			message: `Uses legacy 'type' property (${typeValue}) instead of 'cr_type'. Migration recommended.`,
			severity: 'info',
			category: 'legacy_type_property',
			person,
			details: {
				typeValue,
				property: 'type',
			},
		});

		return issues;
	}

	/**
	 * Check if a value is a nested object (not a primitive or array of primitives)
	 */
	private isNestedObject(value: unknown, key?: string): boolean {
		if (value === null || value === undefined) return false;
		if (typeof value !== 'object') return false;

		// Date objects are not considered nested
		if (value instanceof Date) return false;

		// Whitelist intentional schema-defined nested structures
		if (key === 'sourced_facts') return false;  // GPS research tracking
		if (key === 'evidence') return false;       // Evidence documentation

		// Arrays of primitives are fine
		if (Array.isArray(value)) {
			return value.some(item => this.isNestedObject(item));
		}

		// Plain objects are nested
		return true;
	}

	/**
	 * Get the top-level keys of a nested object (for display purposes)
	 */
	private getNestedKeys(value: unknown): string[] {
		if (Array.isArray(value)) {
			// For arrays, find nested objects and get their keys
			const keys = new Set<string>();
			for (const item of value) {
				if (typeof item === 'object' && item !== null && !(item instanceof Date)) {
					Object.keys(item as object).forEach(k => keys.add(k));
				}
			}
			return Array.from(keys);
		}

		if (typeof value === 'object' && value !== null) {
			return Object.keys(value);
		}

		return [];
	}

	/**
	 * Parse a year from a date string
	 */
	private parseYear(dateStr?: unknown): number | null {
		if (!dateStr) return null;

		// Handle number directly (e.g., year as number)
		if (typeof dateStr === 'number') {
			return dateStr;
		}

		// Convert to string if needed
		let str: string;
		if (typeof dateStr === 'string') {
			str = dateStr;
		} else if (typeof dateStr === 'number') {
			// Handle numeric dates (e.g., born: 1845)
			str = String(dateStr);
		} else if (dateStr instanceof Date) {
			// Handle Date objects
			str = dateStr.toISOString().split('T')[0];
		} else {
			// Unknown type - can't extract year
			return null;
		}

		// Try YYYY-MM-DD format
		const isoMatch = str.match(/^(\d{4})/);
		if (isoMatch) {
			return parseInt(isoMatch[1], 10);
		}

		// Try various formats with year
		const yearMatch = str.match(/\b(\d{4})\b/);
		if (yearMatch) {
			return parseInt(yearMatch[1], 10);
		}

		return null;
	}

	/**
	 * Check if a date is in standard format
	 */
	private isStandardDateFormat(dateStr: unknown): boolean {
		// Handle non-string values
		if (typeof dateStr === 'number') {
			// A plain year number is considered standard
			return dateStr >= 1 && dateStr <= 9999;
		}
		if (typeof dateStr !== 'string') {
			return false;
		}
		// YYYY-MM-DD
		if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return true;
		// YYYY-MM
		if (/^\d{4}-\d{2}$/.test(dateStr)) return true;
		// YYYY
		if (/^\d{4}$/.test(dateStr)) return true;
		return false;
	}

	/**
	 * Filter issues by minimum severity
	 */
	private filterBySeverity(
		issues: DataQualityIssue[],
		minSeverity: IssueSeverity
	): DataQualityIssue[] {
		const severityOrder: IssueSeverity[] = ['error', 'warning', 'info'];
		const minIndex = severityOrder.indexOf(minSeverity);
		return issues.filter(issue => severityOrder.indexOf(issue.severity) <= minIndex);
	}

	/**
	 * Calculate summary statistics
	 */
	private calculateSummary(
		people: PersonNode[],
		issues: DataQualityIssue[]
	): DataQualitySummary {
		const totalPeople = people.length;

		// Count by severity
		const bySeverity = {
			error: issues.filter(i => i.severity === 'error').length,
			warning: issues.filter(i => i.severity === 'warning').length,
			info: issues.filter(i => i.severity === 'info').length,
		};

		// Count by category
		const byCategory: Record<IssueCategory, number> = {
			date_inconsistency: 0,
			relationship_inconsistency: 0,
			missing_data: 0,
			data_format: 0,
			orphan_reference: 0,
			nested_property: 0,
			legacy_type_property: 0,
		};
		for (const issue of issues) {
			byCategory[issue.category]++;
		}

		// Completeness metrics
		const completeness = {
			withBirthDate: people.filter(p => p.birthDate).length,
			withDeathDate: people.filter(p => p.deathDate).length,
			withBothParents: people.filter(p => p.fatherCrId && p.motherCrId).length,
			withAtLeastOneParent: people.filter(p => p.fatherCrId || p.motherCrId).length,
			withSpouse: people.filter(p => p.spouseCrIds.length > 0).length,
			withChildren: people.filter(p => p.childrenCrIds.length > 0).length,
			withGender: people.filter(p => p.sex).length,
		};

		// Calculate quality score (0-100)
		// Weighted: errors=-10, warnings=-3, info=-1
		// Base score starts at 100
		const errorPenalty = bySeverity.error * 10;
		const warningPenalty = bySeverity.warning * 3;
		const infoPenalty = bySeverity.info * 1;
		const totalPenalty = errorPenalty + warningPenalty + infoPenalty;

		// Scale penalty relative to number of people
		const scaledPenalty = totalPeople > 0 ? (totalPenalty / totalPeople) * 10 : 0;
		const qualityScore = Math.max(0, Math.min(100, Math.round(100 - scaledPenalty)));

		return {
			totalPeople,
			totalIssues: issues.length,
			bySeverity,
			byCategory,
			completeness,
			qualityScore,
		};
	}

	/**
	 * Get issues grouped by person
	 */
	groupIssuesByPerson(issues: DataQualityIssue[]): Map<string, DataQualityIssue[]> {
		const grouped = new Map<string, DataQualityIssue[]>();
		for (const issue of issues) {
			const crId = issue.person.crId;
			if (!grouped.has(crId)) {
				grouped.set(crId, []);
			}
			grouped.get(crId)!.push(issue);
		}
		return grouped;
	}

	/**
	 * Get issues grouped by category
	 */
	groupIssuesByCategory(issues: DataQualityIssue[]): Map<IssueCategory, DataQualityIssue[]> {
		const grouped = new Map<IssueCategory, DataQualityIssue[]>();
		for (const issue of issues) {
			if (!grouped.has(issue.category)) {
				grouped.set(issue.category, []);
			}
			grouped.get(issue.category)!.push(issue);
		}
		return grouped;
	}

	// =========================================================================
	// BATCH NORMALIZATION OPERATIONS
	// =========================================================================

	/**
	 * Normalize date formats to YYYY-MM-DD standard
	 * Returns the number of files modified
	 */
	async normalizeDateFormats(options: DataQualityOptions = {}): Promise<BatchOperationResult> {
		const people = this.getPeopleForScope(options);
		const results: BatchOperationResult = {
			processed: 0,
			modified: 0,
			errors: [],
		};

		for (let i = 0; i < people.length; i++) {
			const person = people[i];
			// Report progress
			options.progress?.onProgress(i + 1, people.length, person.file.basename);
			// Read raw frontmatter to get actual field names used
			const cache = this.app.metadataCache.getFileCache(person.file);
			const fm = cache?.frontmatter as Record<string, unknown> | undefined;

			let modified = false;
			const updates: Record<string, string> = {};

			// Get raw date values and determine which field to update
			const rawBorn = fm?.['born'];
			const birthDate = rawBorn instanceof Date
				? rawBorn.toISOString().split('T')[0]
				: typeof rawBorn === 'number'
					? String(rawBorn)
					: typeof rawBorn === 'string' ? rawBorn : undefined;

			if (birthDate && !this.isStandardDateFormat(birthDate)) {
				const normalized = this.normalizeDateString(birthDate);
				if (normalized && normalized !== birthDate) {
					// Update the 'born' field (canonical name used in frontmatter)
					updates['born'] = normalized;
					modified = true;
				}
			}

			// Get raw death date
			const rawDied = fm?.['died'];
			const deathDate = rawDied instanceof Date
				? rawDied.toISOString().split('T')[0]
				: typeof rawDied === 'number'
					? String(rawDied)
					: typeof rawDied === 'string' ? rawDied : undefined;

			if (deathDate && !this.isStandardDateFormat(deathDate)) {
				const normalized = this.normalizeDateString(deathDate);
				if (normalized && normalized !== deathDate) {
					// Update the 'died' field (canonical name used in frontmatter)
					updates['died'] = normalized;
					modified = true;
				}
			}

			if (modified) {
				try {
					await this.updatePersonFrontmatter(person.file, updates);
					results.modified++;
				} catch (error) {
					results.errors.push({
						file: person.file.path,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}
			results.processed++;
		}

		logger.info('normalize-dates', `Normalized date formats: ${results.modified}/${results.processed} files modified`);
		return results;
	}

	/**
	 * Normalize sex values using value alias system
	 * Converts user values to canonical GEDCOM values (M, F, X, U)
	 * Uses built-in synonyms (male→M, female→F, etc.) and user-defined aliases
	 * Returns the number of files modified
	 *
	 * Behavior depends on settings.sexNormalizationMode:
	 * - 'standard': Normalize all values to canonical GEDCOM M/F/X/U
	 * - 'schema-aware': Skip notes with schemas that define custom sex enum values
	 * - 'disabled': Do nothing (return early)
	 */
	async normalizeGenderValues(options: DataQualityOptions = {}): Promise<BatchOperationResult> {
		const mode = this.settings.sexNormalizationMode ?? 'standard';

		// If disabled, return early with no changes
		if (mode === 'disabled') {
			logger.info('normalize-sex', 'Sex value normalization is disabled');
			return { processed: 0, modified: 0, errors: [] };
		}

		const people = this.getPeopleForScope(options);
		const results: BatchOperationResult = {
			processed: 0,
			modified: 0,
			errors: [],
		};

		const canonicalValues = new Set<string>(CANONICAL_SEX_VALUES);

		for (let i = 0; i < people.length; i++) {
			const person = people[i];
			// Report progress
			options.progress?.onProgress(i + 1, people.length, person.file.basename);

			// In schema-aware mode, skip notes protected by schemas with custom sex values
			if (mode === 'schema-aware' && this.schemaService) {
				const schemas = await this.schemaService.getSchemasForPerson(person.file);
				if (this.hasCustomSexSchema(schemas)) {
					results.processed++;
					continue;
				}
			}

			// Read raw frontmatter value (not the resolved value from person.sex)
			const cache = this.app.metadataCache.getFileCache(person.file);
			const fm = cache?.frontmatter as Record<string, unknown> | undefined;
			const rawSexValue = (fm?.['sex'] ?? fm?.['gender']) as string | undefined;

			if (rawSexValue && typeof rawSexValue === 'string') {
				const currentValue = rawSexValue.trim();
				const normalizedKey = currentValue.toLowerCase();

				// Check if already canonical (M, F, X, U)
				if (canonicalValues.has(currentValue)) {
					results.processed++;
					continue;
				}

				// Check user-defined aliases first, then built-in synonyms
				const userAliases = this.settings.valueAliases?.sex || {};
				const normalizedValue = userAliases[normalizedKey] || BUILTIN_SYNONYMS.sex[normalizedKey];

				// If we have a mapping and it's different, apply it
				if (normalizedValue && normalizedValue !== currentValue) {
					try {
						await this.updatePersonFrontmatter(person.file, { sex: normalizedValue });
						results.modified++;
					} catch (error) {
						results.errors.push({
							file: person.file.path,
							error: error instanceof Error ? error.message : String(error),
						});
					}
				}
			}
			results.processed++;
		}

		logger.info('normalize-sex', `Normalized sex values: ${results.modified}/${results.processed} files modified`);
		return results;
	}

	/**
	 * Clear orphan references (references to non-existent cr_ids)
	 * Returns the number of files modified
	 */
	async clearOrphanReferences(options: DataQualityOptions = {}): Promise<BatchOperationResult> {
		const people = this.getPeopleForScope(options);
		const results: BatchOperationResult = {
			processed: 0,
			modified: 0,
			errors: [],
		};

		// Build lookup of valid cr_ids
		const validCrIds = new Set(people.map(p => p.crId));

		for (let i = 0; i < people.length; i++) {
			const person = people[i];
			// Report progress
			options.progress?.onProgress(i + 1, people.length, person.file.basename);

			const updates: Record<string, string | null> = {};
			let modified = false;

			// Check father reference
			if (person.fatherCrId && !validCrIds.has(person.fatherCrId)) {
				updates['father_id'] = null;
				modified = true;
			}

			// Check mother reference
			if (person.motherCrId && !validCrIds.has(person.motherCrId)) {
				updates['mother_id'] = null;
				modified = true;
			}

			// Note: We don't clear spouse/child arrays as that's more complex
			// and could have unintended consequences

			if (modified) {
				try {
					await this.updatePersonFrontmatter(person.file, updates);
					results.modified++;
				} catch (error) {
					results.errors.push({
						file: person.file.path,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}
			results.processed++;
		}

		logger.info('clear-orphans', `Cleared orphan references: ${results.modified}/${results.processed} files modified`);
		return results;
	}

	/**
	 * Flatten nested properties in frontmatter
	 * Converts nested YAML objects to flat dot-notation or underscore-separated keys
	 * Returns the number of files modified
	 */
	async flattenNestedProperties(options: DataQualityOptions = {}): Promise<BatchOperationResult> {
		const people = this.getPeopleForScope(options);
		const results: BatchOperationResult = {
			processed: 0,
			modified: 0,
			errors: [],
		};

		for (let i = 0; i < people.length; i++) {
			const person = people[i];
			// Report progress
			options.progress?.onProgress(i + 1, people.length, person.file.basename);

			// Get the cached frontmatter for this file
			const cache = this.app.metadataCache.getFileCache(person.file);
			if (!cache?.frontmatter) {
				results.processed++;
				continue;
			}

			const fm = cache.frontmatter as Record<string, unknown>;
			const flattenedUpdates: Record<string, unknown> = {};
			const keysToRemove: string[] = [];
			let hasNested = false;

			// Check each frontmatter property for nested objects
			for (const [key, value] of Object.entries(fm)) {
				// Skip Obsidian's internal 'position' property
				if (key === 'position') continue;

				if (this.isNestedObject(value, key)) {
					hasNested = true;
					keysToRemove.push(key);

					// Flatten the nested object using underscore separator
					const flattened = this.flattenObject(value, key);
					Object.assign(flattenedUpdates, flattened);
				}
			}

			if (hasNested) {
				try {
					await this.app.fileManager.processFrontMatter(person.file, (frontmatter) => {
						// Remove nested keys
						for (const key of keysToRemove) {
							delete frontmatter[key];
						}
						// Add flattened keys
						Object.assign(frontmatter, flattenedUpdates);
					});
					results.modified++;
				} catch (error) {
					results.errors.push({
						file: person.file.path,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}
			results.processed++;
		}

		logger.info('flatten-nested', `Flattened nested properties: ${results.modified}/${results.processed} files modified`);
		return results;
	}

	/**
	 * Flatten a nested object into a flat object with underscore-separated keys
	 */
	private flattenObject(obj: unknown, prefix: string): Record<string, unknown> {
		const result: Record<string, unknown> = {};

		if (Array.isArray(obj)) {
			// For arrays, flatten each item if it's an object
			for (let i = 0; i < obj.length; i++) {
				const item = obj[i];
				if (typeof item === 'object' && item !== null && !(item instanceof Date)) {
					const flattened = this.flattenObject(item, `${prefix}_${i}`);
					Object.assign(result, flattened);
				} else {
					result[`${prefix}_${i}`] = item;
				}
			}
		} else if (typeof obj === 'object' && obj !== null && !(obj instanceof Date)) {
			for (const [key, value] of Object.entries(obj)) {
				const newKey = `${prefix}_${key}`;
				if (typeof value === 'object' && value !== null && !(value instanceof Date) && !Array.isArray(value)) {
					// Recursively flatten nested objects
					const flattened = this.flattenObject(value, newKey);
					Object.assign(result, flattened);
				} else if (Array.isArray(value)) {
					// Keep arrays as-is (they're acceptable in frontmatter)
					result[newKey] = value;
				} else {
					result[newKey] = value;
				}
			}
		}

		return result;
	}

	/**
	 * Detect bidirectional relationship inconsistencies
	 * Returns array of detected inconsistencies across all person notes
	 */
	detectBidirectionalInconsistencies(options: DataQualityOptions = {}): BidirectionalInconsistency[] {
		const people = this.getPeopleForScope(options);
		const inconsistencies: BidirectionalInconsistency[] = [];

		// Build lookup of all person cr_ids
		const crIdMap = new Map<string, PersonNode>();
		for (const person of people) {
			crIdMap.set(person.crId, person);
		}

		// Track conflicts we've already recorded to avoid duplicates
		// Key format: "father:childCrId" or "mother:childCrId"
		const seenConflicts = new Set<string>();

		for (const person of people) {
			// Check if father lists this person as child
			if (person.fatherCrId) {
				const father = crIdMap.get(person.fatherCrId);
				if (father) {
					// Use PersonNode data instead of reading from metadata cache
					if (!father.childrenCrIds.includes(person.crId)) {
						inconsistencies.push({
							type: 'missing-child-in-parent',
							person,
							relatedPerson: father,
							field: 'father_id',
							description: `Will add ${person.name || person.file.basename} to ${father.name || father.file.basename}'s children_id (${person.name || person.file.basename} lists them as father)`
						});
					}
				}
			}

			// Check if mother lists this person as child
			if (person.motherCrId) {
				const mother = crIdMap.get(person.motherCrId);
				if (mother) {
					// Use PersonNode data instead of reading from metadata cache
					if (!mother.childrenCrIds.includes(person.crId)) {
						inconsistencies.push({
							type: 'missing-child-in-parent',
							person,
							relatedPerson: mother,
							field: 'mother_id',
							description: `Will add ${person.name || person.file.basename} to ${mother.name || mother.file.basename}'s children_id (${person.name || person.file.basename} lists them as mother)`
						});
					}
				}
			}

			// Check if children list this person as parent
			if (person.childrenCrIds) {
				for (const childCrId of person.childrenCrIds) {
					const child = crIdMap.get(childCrId);
					if (child) {
						// Use PersonNode data instead of reading from metadata cache
						// This ensures we're checking against current in-memory data, not stale cache
						const childFatherId = child.fatherCrId;
						const childMotherId = child.motherCrId;

						if (childFatherId !== person.crId && childMotherId !== person.crId) {
							// Determine which parent field this person should occupy based on their sex
							const sex = person.sex;
							const shouldBeFather = sex === 'male' || sex === 'M';
							const shouldBeMother = sex === 'female' || sex === 'F';

							// Only create inconsistency if:
							// 1. Person's sex indicates they should be father, but child doesn't list them as father
							// 2. Person's sex indicates they should be mother, but child doesn't list them as mother
							// Skip if sex is unknown or if child already has correct parent type filled
							//
							// IMPORTANT: Also skip if the child's current parent ALSO claims this child
							// This prevents flip-flopping when two people both claim the same child
							let shouldCreateInconsistency = false;
							let targetField = '';
							let currentValue: string | undefined = undefined;

							if (shouldBeFather && childFatherId !== person.crId) {
								// Check if this person is listed as a step-father or adoptive father of the child
								// If so, this is not a conflict - they're a non-biological parent
								const isStepOrAdoptiveFather = child.stepfatherCrIds.includes(person.crId) ||
									child.adoptiveFatherCrId === person.crId;

								if (!isStepOrAdoptiveFather) {
									// Check if current father also claims this child - if so, it's a conflict
									const currentFather = childFatherId ? crIdMap.get(childFatherId) : undefined;
									const currentFatherClaimsChild = currentFather?.childrenCrIds.includes(child.crId);
									if (currentFatherClaimsChild && currentFather && currentFather.crId !== person.crId) {
										// Both people claim this child - record as conflict for manual resolution
										// Only record once per child - use a consistent key to deduplicate
										const conflictKey = `father:${child.crId}`;
										if (!seenConflicts.has(conflictKey)) {
											seenConflicts.add(conflictKey);
											inconsistencies.push({
												type: 'conflicting-parent-claim',
												person: currentFather,  // Current father (listed in child's father_id)
												relatedPerson: child,
												field: 'father_id',
												description: `${child.name || child.file.basename} has conflicting father claims: ${currentFather.name} (in father_id) vs ${person.name} (in children_id)`,
												conflictingPerson: person,  // The other claimant
												conflictType: 'father'
											});
										}
									} else if (!currentFatherClaimsChild) {
										// Person is male, should be father, but child doesn't list them (or lists someone else who doesn't claim them)
										shouldCreateInconsistency = true;
										targetField = 'father_id';
										currentValue = childFatherId;
									}
								}
								// If person is a step/adoptive father, no action needed - relationship is correctly tracked
							} else if (shouldBeMother && childMotherId !== person.crId) {
								// Check if this person is listed as a step-mother or adoptive mother of the child
								// If so, this is not a conflict - they're a non-biological parent
								const isStepOrAdoptiveMother = child.stepmotherCrIds.includes(person.crId) ||
									child.adoptiveMotherCrId === person.crId;

								if (!isStepOrAdoptiveMother) {
									// Check if current mother also claims this child - if so, it's a conflict
									const currentMother = childMotherId ? crIdMap.get(childMotherId) : undefined;
									const currentMotherClaimsChild = currentMother?.childrenCrIds.includes(child.crId);
									if (currentMotherClaimsChild && currentMother && currentMother.crId !== person.crId) {
										// Both people claim this child - record as conflict for manual resolution
										const conflictKey = `mother:${child.crId}`;
										if (!seenConflicts.has(conflictKey)) {
											seenConflicts.add(conflictKey);
											inconsistencies.push({
												type: 'conflicting-parent-claim',
												person: currentMother,  // Current mother (listed in child's mother_id)
												relatedPerson: child,
												field: 'mother_id',
												description: `${child.name || child.file.basename} has conflicting mother claims: ${currentMother.name} (in mother_id) vs ${person.name} (in children_id)`,
												conflictingPerson: person,  // The other claimant
												conflictType: 'mother'
											});
										}
									} else if (!currentMotherClaimsChild) {
										// Person is female, should be mother, but child doesn't list them (or lists someone else who doesn't claim them)
										shouldCreateInconsistency = true;
										targetField = 'mother_id';
										currentValue = childMotherId;
									}
								}
								// If person is a step/adoptive mother, no action needed - relationship is correctly tracked
							}

							if (shouldCreateInconsistency) {
								const description = currentValue
									? `Will update ${child.name || child.file.basename}'s ${targetField} from ${currentValue} to ${person.crId} (${person.name || person.file.basename} lists them as child)`
									: `Will set ${child.name || child.file.basename}'s ${targetField} to ${person.crId} (${person.name || person.file.basename} lists them as child)`;

								inconsistencies.push({
									type: 'missing-parent-in-child',
									person,
									relatedPerson: child,
									field: 'children_id',
									description
								});
							}
						}
					}
				}
			}

			// Check if spouses list this person as spouse
			if (person.spouseCrIds) {
				for (const spouseCrId of person.spouseCrIds) {
					const spouse = crIdMap.get(spouseCrId);
					if (spouse) {
						// Use PersonNode data instead of reading from metadata cache
						// PersonNode.spouseCrIds includes all spouses (from spouse_id array and indexed spouse1_id, spouse2_id, etc.)
						const spouseListsThisPerson = spouse.spouseCrIds.includes(person.crId);

						if (!spouseListsThisPerson) {
							inconsistencies.push({
								type: 'missing-spouse-in-spouse',
								person,
								relatedPerson: spouse,
								field: 'spouse_id',
								description: `Will add ${person.name || person.file.basename} to ${spouse.name || spouse.file.basename}'s spouse_id (${person.name || person.file.basename} lists them as spouse)`
							});
						}
					}
				}
			}
		}

		logger.info('detect-bidirectional', `Found ${inconsistencies.length} bidirectional relationship inconsistencies`);
		return inconsistencies;
	}

	/**
	 * Fix bidirectional relationship inconsistencies
	 * Adds missing reciprocal relationships
	 */
	async fixBidirectionalInconsistencies(
		inconsistencies: BidirectionalInconsistency[],
		progress?: BatchProgressCallback
	): Promise<BatchOperationResult> {
		const results: BatchOperationResult = {
			processed: 0,
			modified: 0,
			errors: [],
		};

		// Filter out conflicting-parent-claim issues - they require manual resolution
		const autoFixable = inconsistencies.filter(i => i.type !== 'conflicting-parent-claim');
		const conflicts = inconsistencies.filter(i => i.type === 'conflicting-parent-claim');

		if (conflicts.length > 0) {
			logger.info('fix-bidirectional', `Skipping ${conflicts.length} conflicting-parent-claim issues (require manual resolution)`);
		}

		for (let i = 0; i < autoFixable.length; i++) {
			const issue = autoFixable[i];
			// Report progress
			progress?.onProgress(i + 1, autoFixable.length, issue.person.file.basename);

			results.processed++;
			logger.debug('fix-bidirectional', `Processing ${issue.type}: ${issue.description}`);

			try {
				if (issue.type === 'missing-child-in-parent') {
					// Add person to parent's children_id array
					await this.addToArrayField(issue.relatedPerson.file, 'children_id', issue.person.crId);
					// Also add wikilink to child array (canonical property name)
					const childName = issue.person.name || issue.person.file.basename;
					await this.addToArrayField(issue.relatedPerson.file, 'child', `[[${childName}]]`);
					results.modified++;
				} else if (issue.type === 'missing-parent-in-child') {
					// Determine if this person should be father or mother based on sex
					const sex = issue.person.sex;
					const shouldBeMother = sex === 'female' || sex === 'F';
					const parentField = shouldBeMother ? 'mother_id' : 'father_id';
					const parentWikilinkField = shouldBeMother ? 'mother' : 'father';

					// Apply the fix (detection phase already validated this)
					await this.updatePersonFrontmatter(issue.relatedPerson.file, {
						[parentField]: issue.person.crId,
						[parentWikilinkField]: `[[${issue.person.name || issue.person.file.basename}]]`
					});
					results.modified++;
				} else if (issue.type === 'missing-spouse-in-spouse') {
					// Add person to spouse's spouse_id array
					await this.addToArrayField(issue.relatedPerson.file, 'spouse_id', issue.person.crId);
					// Also add wikilink to spouse array
					const personName = issue.person.name || issue.person.file.basename;
					await this.addToArrayField(issue.relatedPerson.file, 'spouse', `[[${personName}]]`);
					results.modified++;
				}
			} catch (error) {
				results.errors.push({
					file: issue.person.file.path,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		logger.info('fix-bidirectional', `Fixed ${results.modified}/${results.processed} bidirectional inconsistencies (${conflicts.length} conflicts require manual resolution)`);
		return results;
	}

	/**
	 * Helper method to extract array field from frontmatter
	 */
	private extractArrayField(frontmatter: Record<string, unknown> | undefined, fieldName: string): string[] {
		if (!frontmatter) return [];

		const value = frontmatter[fieldName];
		if (!value) return [];
		if (Array.isArray(value)) return value.filter(v => typeof v === 'string') as string[];
		if (typeof value === 'string') return [value];
		return [];
	}

	/**
	 * Helper method to add value to array field in frontmatter
	 */
	private async addToArrayField(file: TFile, fieldName: string, value: string): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const existing = frontmatter[fieldName];

			if (!existing) {
				// Field doesn't exist, create as array with single value
				frontmatter[fieldName] = [value];
			} else if (Array.isArray(existing)) {
				// Already an array, add if not present
				if (!existing.includes(value)) {
					existing.push(value);
				}
			} else {
				// Single value, convert to array if different
				if (existing !== value) {
					frontmatter[fieldName] = [existing, value];
				}
			}
		});
	}

	/**
	 * Detect impossible dates (preview only)
	 * Finds logical date errors like birth after death, unrealistic lifespans, etc.
	 */
	detectImpossibleDates(options: DataQualityOptions = {}): ImpossibleDateIssue[] {
		const people = this.getPeopleForScope(options);
		const issues: ImpossibleDateIssue[] = [];

		// Build lookup map for relationship checks
		const peopleMap = new Map<string, PersonNode>();
		for (const person of people) {
			peopleMap.set(person.crId, person);
		}

		for (const person of people) {
			const birthDate = person.birthDate ? this.parseDate(person.birthDate) : null;
			const deathDate = person.deathDate ? this.parseDate(person.deathDate) : null;

			// Check: Birth after death
			if (birthDate && deathDate && birthDate > deathDate) {
				issues.push({
					type: 'birth-after-death',
					person,
					description: `Born ${person.birthDate} after death ${person.deathDate}`,
					personDate: person.birthDate,
					relatedDate: person.deathDate
				});
			}

			// Check: Unrealistic lifespan (>120 years)
			if (birthDate && deathDate) {
				const ageInYears = (deathDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
				if (ageInYears > 120) {
					issues.push({
						type: 'unrealistic-lifespan',
						person,
						description: `Lived ${Math.round(ageInYears)} years (birth: ${person.birthDate}, death: ${person.deathDate})`,
						personDate: person.birthDate,
						relatedDate: person.deathDate
					});
				}
			}

			// Check parent relationships
			if (person.fatherCrId) {
				const father = peopleMap.get(person.fatherCrId);
				if (father) {
					const fatherBirthDate = father.birthDate ? this.parseDate(father.birthDate) : null;
					const fatherDeathDate = father.deathDate ? this.parseDate(father.deathDate) : null;

					// Parent born after child
					if (fatherBirthDate && birthDate && fatherBirthDate > birthDate) {
						issues.push({
							type: 'parent-born-after-child',
							person,
							relatedPerson: father,
							description: `Father ${father.name || father.file.basename} born ${father.birthDate} after child born ${person.birthDate}`,
							personDate: person.birthDate,
							relatedDate: father.birthDate
						});
					}

					// Parent too young (<10 years)
					if (fatherBirthDate && birthDate) {
						const parentAgeAtBirth = (birthDate.getTime() - fatherBirthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
						if (parentAgeAtBirth < 10) {
							issues.push({
								type: 'parent-too-young',
								person,
								relatedPerson: father,
								description: `Father ${father.name || father.file.basename} was ${Math.round(parentAgeAtBirth)} years old at child's birth`,
								personDate: person.birthDate,
								relatedDate: father.birthDate
							});
						}
					}

					// Child born after parent death (allowing 1 year for posthumous births)
					if (fatherDeathDate && birthDate) {
						const monthsAfterDeath = (birthDate.getTime() - fatherDeathDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
						if (monthsAfterDeath > 12) {
							issues.push({
								type: 'child-born-after-parent-death',
								person,
								relatedPerson: father,
								description: `Born ${person.birthDate}, ${Math.round(monthsAfterDeath)} months after father died ${father.deathDate}`,
								personDate: person.birthDate,
								relatedDate: father.deathDate
							});
						}
					}
				}
			}

			// Same checks for mother
			if (person.motherCrId) {
				const mother = peopleMap.get(person.motherCrId);
				if (mother) {
					const motherBirthDate = mother.birthDate ? this.parseDate(mother.birthDate) : null;
					const motherDeathDate = mother.deathDate ? this.parseDate(mother.deathDate) : null;

					// Parent born after child
					if (motherBirthDate && birthDate && motherBirthDate > birthDate) {
						issues.push({
							type: 'parent-born-after-child',
							person,
							relatedPerson: mother,
							description: `Mother ${mother.name || mother.file.basename} born ${mother.birthDate} after child born ${person.birthDate}`,
							personDate: person.birthDate,
							relatedDate: mother.birthDate
						});
					}

					// Parent too young (<10 years)
					if (motherBirthDate && birthDate) {
						const parentAgeAtBirth = (birthDate.getTime() - motherBirthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
						if (parentAgeAtBirth < 10) {
							issues.push({
								type: 'parent-too-young',
								person,
								relatedPerson: mother,
								description: `Mother ${mother.name || mother.file.basename} was ${Math.round(parentAgeAtBirth)} years old at child's birth`,
								personDate: person.birthDate,
								relatedDate: mother.birthDate
							});
						}
					}

					// Child born after parent death (mother can't have posthumous births)
					if (motherDeathDate && birthDate && motherDeathDate < birthDate) {
						issues.push({
							type: 'child-born-after-parent-death',
							person,
							relatedPerson: mother,
							description: `Born ${person.birthDate} after mother died ${mother.deathDate}`,
							personDate: person.birthDate,
							relatedDate: mother.deathDate
						});
					}
				}
			}
		}

		logger.info('detect-impossible-dates', `Found ${issues.length} impossible date issues`);
		return issues;
	}

	/**
	 * Helper to parse date string to Date object
	 * Handles YYYY-MM-DD and partial dates (YYYY-MM, YYYY)
	 */
	private parseDate(dateStr: string): Date | null {
		if (!dateStr) return null;

		// Remove any circa indicators
		const cleaned = dateStr.replace(/^(c\.|ca\.|circa|~)\s*/i, '').trim();

		// Handle date ranges - use the first date
		const rangeMatch = cleaned.match(/^(\d{4}(?:-\d{2}(?:-\d{2})?)?)/);
		const datePart = rangeMatch ? rangeMatch[1] : cleaned;

		// Try to parse ISO format
		const parts = datePart.split('-');
		if (parts.length >= 1) {
			const year = parseInt(parts[0]);
			const month = parts.length >= 2 ? parseInt(parts[1]) - 1 : 0; // Default to January
			const day = parts.length >= 3 ? parseInt(parts[2]) : 1; // Default to 1st

			if (!isNaN(year)) {
				return new Date(year, month, day);
			}
		}

		return null;
	}

	/**
	 * Migrate legacy 'type' property to 'cr_type'
	 * Only migrates notes with valid Canvas Roots type values that don't already have cr_type
	 * Returns the number of files modified
	 */
	async migrateLegacyTypeProperty(options: DataQualityOptions = {}): Promise<BatchOperationResult> {
		const people = this.getPeopleForScope(options);
		const results: BatchOperationResult = {
			processed: 0,
			modified: 0,
			errors: [],
		};

		for (const person of people) {
			// Get the cached frontmatter for this file
			const cache = this.app.metadataCache.getFileCache(person.file);
			if (!cache?.frontmatter) {
				results.processed++;
				continue;
			}

			const fm = cache.frontmatter as Record<string, unknown>;

			// Check if note has 'type' property with a valid Canvas Roots type value
			const typeValue = fm['type'];
			if (typeof typeValue !== 'string') {
				results.processed++;
				continue;
			}

			// Check if the type value is a recognized Canvas Roots note type
			const isCanvasRootsType = ALL_NOTE_TYPES.includes(typeValue as NoteType);
			if (!isCanvasRootsType) {
				results.processed++;
				continue;
			}

			// Check if note already has cr_type (no migration needed)
			const crTypeValue = fm['cr_type'];
			if (crTypeValue !== undefined) {
				results.processed++;
				continue;
			}

			// Migrate: add cr_type and remove type
			try {
				await this.app.fileManager.processFrontMatter(person.file, (frontmatter) => {
					frontmatter['cr_type'] = typeValue;
					delete frontmatter['type'];
				});
				results.modified++;
			} catch (error) {
				results.errors.push({
					file: person.file.path,
					error: error instanceof Error ? error.message : String(error),
				});
			}

			results.processed++;
		}

		logger.info('migrate-type', `Migrated legacy type property: ${results.modified}/${results.processed} files modified`);
		return results;
	}

	/**
	 * Preview what batch normalization would do without making changes
	 *
	 * For sex normalization, behavior depends on settings.sexNormalizationMode:
	 * - 'standard': Show all non-canonical values that would be normalized
	 * - 'schema-aware': Also track notes skipped due to schema-defined sex values
	 * - 'disabled': Still show what would be normalized, but indicate disabled
	 */
	async previewNormalization(options: DataQualityOptions = {}): Promise<NormalizationPreview> {
		const people = this.getPeopleForScope(options);
		const mode = this.settings.sexNormalizationMode ?? 'standard';
		const preview: NormalizationPreview = {
			dateNormalization: [],
			genderNormalization: [],
			genderSkipped: [],
			orphanClearing: [],
			legacyTypeMigration: [],
		};

		// Build lookup of valid cr_ids for orphan detection
		const validCrIds = new Set(people.map(p => p.crId));

		for (const person of people) {
			// Check dates
			if (person.birthDate && !this.isStandardDateFormat(person.birthDate)) {
				const normalized = this.normalizeDateString(person.birthDate);
				if (normalized) {
					preview.dateNormalization.push({
						person,
						field: 'birth_date',
						oldValue: person.birthDate,
						newValue: normalized,
					});
				}
			}
			if (person.deathDate && !this.isStandardDateFormat(person.deathDate)) {
				const normalized = this.normalizeDateString(person.deathDate);
				if (normalized) {
					preview.dateNormalization.push({
						person,
						field: 'death_date',
						oldValue: person.deathDate,
						newValue: normalized,
					});
				}
			}

			// Check sex - use value alias system with built-in synonyms
			// Read raw frontmatter value (not the resolved value from person.sex)
			const sexCache = this.app.metadataCache.getFileCache(person.file);
			const sexFm = sexCache?.frontmatter as Record<string, unknown> | undefined;
			const rawSexValue = (sexFm?.['sex'] ?? sexFm?.['gender']) as string | undefined;

			if (rawSexValue && typeof rawSexValue === 'string') {
				const currentValue = rawSexValue.trim();
				const normalizedKey = currentValue.toLowerCase();

				// In schema-aware mode, check if protected by schema
				if (mode === 'schema-aware' && this.schemaService) {
					const schemas = await this.schemaService.getSchemasForPerson(person.file);
					if (this.hasCustomSexSchema(schemas)) {
						// Find the schema name that defines the sex enum
						const schemaWithSex = schemas.find(s => {
							const sexProp = s.definition?.properties?.['sex'];
							return sexProp?.type === 'enum' && sexProp.values && sexProp.values.length > 0;
						});
						preview.genderSkipped.push({
							person,
							schemaName: schemaWithSex?.name ?? 'Unknown Schema',
							currentValue,
						});
						// Skip to next person - don't add to genderNormalization
						continue;
					}
				}

				// Check if already canonical (M, F, X, U)
				const isCanonical = CANONICAL_SEX_VALUES.includes(currentValue as CanonicalSex);
				if (!isCanonical) {
					// Check user-defined aliases first, then built-in synonyms
					const userAliases = this.settings.valueAliases?.sex || {};
					const normalizedValue = userAliases[normalizedKey] || BUILTIN_SYNONYMS.sex[normalizedKey];

					// Check if we have a mapping that's different from current
					if (normalizedValue && normalizedValue !== currentValue) {
						preview.genderNormalization.push({
							person,
							field: 'sex',
							oldValue: currentValue,
							newValue: normalizedValue,
						});
					}
				}
			}

			// Check orphan references
			if (person.fatherCrId && !validCrIds.has(person.fatherCrId)) {
				preview.orphanClearing.push({
					person,
					field: 'father_id',
					oldValue: person.fatherCrId,
					newValue: '(cleared)',
				});
			}
			if (person.motherCrId && !validCrIds.has(person.motherCrId)) {
				preview.orphanClearing.push({
					person,
					field: 'mother_id',
					oldValue: person.motherCrId,
					newValue: '(cleared)',
				});
			}

			// Check legacy type property
			const cache = this.app.metadataCache.getFileCache(person.file);
			if (cache?.frontmatter) {
				const fm = cache.frontmatter as Record<string, unknown>;
				const typeValue = fm['type'];
				const crTypeValue = fm['cr_type'];

				if (typeof typeValue === 'string' &&
					ALL_NOTE_TYPES.includes(typeValue as NoteType) &&
					crTypeValue === undefined) {
					preview.legacyTypeMigration.push({
						person,
						field: 'type → cr_type',
						oldValue: typeValue,
						newValue: typeValue,
					});
				}
			}
		}

		return preview;
	}

	/**
	 * Normalize a date string to YYYY-MM-DD format
	 */
	private normalizeDateString(dateStr: string): string | null {
		// Already standard format
		if (this.isStandardDateFormat(dateStr)) {
			return dateStr;
		}

		// Try to parse common formats
		const trimmed = dateStr.trim();

		// DD MMM YYYY (e.g., "15 Mar 1920")
		const dmyMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
		if (dmyMatch) {
			const day = dmyMatch[1].padStart(2, '0');
			const month = this.parseMonthName(dmyMatch[2]);
			const year = dmyMatch[3];
			if (month) {
				return `${year}-${month}-${day}`;
			}
		}

		// MMM DD, YYYY (e.g., "Mar 15, 1920")
		const mdyMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
		if (mdyMatch) {
			const month = this.parseMonthName(mdyMatch[1]);
			const day = mdyMatch[2].padStart(2, '0');
			const year = mdyMatch[3];
			if (month) {
				return `${year}-${month}-${day}`;
			}
		}

		// DD/MM/YYYY or DD-MM-YYYY
		const dmySlashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
		if (dmySlashMatch) {
			const day = dmySlashMatch[1].padStart(2, '0');
			const month = dmySlashMatch[2].padStart(2, '0');
			const year = dmySlashMatch[3];
			return `${year}-${month}-${day}`;
		}

		// MM/DD/YYYY (US format) - assume if first number > 12, it's day first
		const mdySlashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
		if (mdySlashMatch) {
			const first = parseInt(mdySlashMatch[1], 10);
			const second = parseInt(mdySlashMatch[2], 10);
			const year = mdySlashMatch[3];
			// If first > 12, assume DD/MM/YYYY
			if (first > 12) {
				const day = mdySlashMatch[1].padStart(2, '0');
				const month = mdySlashMatch[2].padStart(2, '0');
				return `${year}-${month}-${day}`;
			}
			// If second > 12, assume MM/DD/YYYY
			if (second > 12) {
				const month = mdySlashMatch[1].padStart(2, '0');
				const day = mdySlashMatch[2].padStart(2, '0');
				return `${year}-${month}-${day}`;
			}
			// Ambiguous - default to DD/MM/YYYY (more common internationally)
			const day = mdySlashMatch[1].padStart(2, '0');
			const month = mdySlashMatch[2].padStart(2, '0');
			return `${year}-${month}-${day}`;
		}

		// Just a year with surrounding text (e.g., "about 1920", "c. 1920")
		const yearOnlyMatch = trimmed.match(/\b(\d{4})\b/);
		if (yearOnlyMatch) {
			return yearOnlyMatch[1];
		}

		// Could not parse
		return null;
	}

	/**
	 * Parse month name to two-digit string
	 */
	private parseMonthName(name: string): string | null {
		const months: Record<string, string> = {
			jan: '01', january: '01',
			feb: '02', february: '02',
			mar: '03', march: '03',
			apr: '04', april: '04',
			may: '05',
			jun: '06', june: '06',
			jul: '07', july: '07',
			aug: '08', august: '08',
			sep: '09', sept: '09', september: '09',
			oct: '10', october: '10',
			nov: '11', november: '11',
			dec: '12', december: '12',
		};
		return months[name.toLowerCase()] || null;
	}

	/**
	 * Update frontmatter fields in a person file
	 */
	private async updatePersonFrontmatter(
		file: TFile,
		updates: Record<string, string | null>
	): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			for (const [key, value] of Object.entries(updates)) {
				if (value === null) {
					delete frontmatter[key];
				} else {
					frontmatter[key] = value;
				}
			}
		});
	}
}

/**
 * Result of a batch operation
 */
export interface BatchOperationResult {
	processed: number;
	modified: number;
	errors: Array<{ file: string; error: string }>;
}

/**
 * A note skipped from gender normalization due to schema override
 */
export interface SkippedGenderNote {
	person: PersonNode;
	schemaName: string;
	currentValue: string;
}

/**
 * Preview of normalization changes
 */
export interface NormalizationPreview {
	dateNormalization: NormalizationChange[];
	genderNormalization: NormalizationChange[];
	/** Notes skipped due to schema-defined sex values (schema-aware mode) */
	genderSkipped: SkippedGenderNote[];
	orphanClearing: NormalizationChange[];
	legacyTypeMigration: NormalizationChange[];
}

/**
 * A single normalization change
 */
export interface NormalizationChange {
	person: PersonNode;
	field: string;
	oldValue: string;
	newValue: string;
}

/**
 * Types of bidirectional relationship inconsistencies
 */
export type BidirectionalInconsistencyType =
	| 'missing-child-in-parent'
	| 'missing-parent-in-child'
	| 'missing-spouse-in-spouse'
	| 'conflicting-parent-claim';

/**
 * A bidirectional relationship inconsistency
 */
export interface BidirectionalInconsistency {
	type: BidirectionalInconsistencyType;
	person: PersonNode;
	relatedPerson: PersonNode;
	field: string;
	description: string;
	/** For conflicts: the other person also claiming the relationship */
	conflictingPerson?: PersonNode;
	/** For conflicts: whether this is a father or mother conflict */
	conflictType?: 'father' | 'mother';
}

/**
 * Types of impossible date issues
 */
export type ImpossibleDateType =
	| 'birth-after-death'
	| 'death-before-birth'
	| 'unrealistic-lifespan'
	| 'parent-born-after-child'
	| 'parent-died-before-child'
	| 'parent-too-young'
	| 'child-born-after-parent-death';

/**
 * An impossible date issue
 */
export interface ImpossibleDateIssue {
	type: ImpossibleDateType;
	person: PersonNode;
	relatedPerson?: PersonNode;
	description: string;
	personDate?: string;
	relatedDate?: string;
}
