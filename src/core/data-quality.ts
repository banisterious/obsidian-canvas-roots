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
}

/**
 * Service for analyzing data quality in person notes
 */
export class DataQualityService {
	constructor(
		private app: App,
		private settings: CanvasRootsSettings,
		private familyGraph: FamilyGraphService,
		private folderFilter: FolderFilterService
	) {}

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

		// Non-standard date format for birth
		if (person.birthDate && !this.isStandardDateFormat(person.birthDate)) {
			issues.push({
				code: 'NON_STANDARD_DATE',
				message: `Birth date "${person.birthDate}" is not in standard format (YYYY-MM-DD or YYYY)`,
				severity: 'info',
				category: 'data_format',
				person,
				details: { field: 'birthDate', value: person.birthDate },
			});
		}

		// Non-standard date format for death
		if (person.deathDate && !this.isStandardDateFormat(person.deathDate)) {
			issues.push({
				code: 'NON_STANDARD_DATE',
				message: `Death date "${person.deathDate}" is not in standard format (YYYY-MM-DD or YYYY)`,
				severity: 'info',
				category: 'data_format',
				person,
				details: { field: 'deathDate', value: person.deathDate },
			});
		}

		// Invalid gender value
		const validGenders = ['M', 'F', 'Male', 'Female', 'male', 'female', 'nonbinary', 'Nonbinary', 'unknown', 'Unknown'];
		if (person.sex && !validGenders.includes(person.sex)) {
			issues.push({
				code: 'INVALID_GENDER',
				message: `Gender value "${person.sex}" is not standard (expected male/female/nonbinary/unknown)`,
				severity: 'warning',
				category: 'data_format',
				person,
				details: { value: person.sex },
			});
		}

		return issues;
	}

	/**
	 * Check for orphan references (links to non-existent people)
	 */
	private checkOrphanReferences(
		person: PersonNode,
		peopleMap: Map<string, PersonNode>
	): DataQualityIssue[] {
		const issues: DataQualityIssue[] = [];

		// Father reference doesn't exist
		if (person.fatherCrId && !peopleMap.has(person.fatherCrId)) {
			issues.push({
				code: 'ORPHAN_FATHER_REF',
				message: `Father reference (${person.fatherCrId}) points to non-existent person`,
				severity: 'warning',
				category: 'orphan_reference',
				person,
				details: { missingCrId: person.fatherCrId, relationship: 'father' },
			});
		}

		// Mother reference doesn't exist
		if (person.motherCrId && !peopleMap.has(person.motherCrId)) {
			issues.push({
				code: 'ORPHAN_MOTHER_REF',
				message: `Mother reference (${person.motherCrId}) points to non-existent person`,
				severity: 'warning',
				category: 'orphan_reference',
				person,
				details: { missingCrId: person.motherCrId, relationship: 'mother' },
			});
		}

		// Spouse references don't exist
		for (const spouseCrId of person.spouseCrIds) {
			if (!peopleMap.has(spouseCrId)) {
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

		// Child references don't exist
		for (const childCrId of person.childrenCrIds) {
			if (!peopleMap.has(childCrId)) {
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

			if (this.isNestedObject(value)) {
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
	private isNestedObject(value: unknown): boolean {
		if (value === null || value === undefined) return false;
		if (typeof value !== 'object') return false;

		// Date objects are not considered nested
		if (value instanceof Date) return false;

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
			return Object.keys(value as object);
		}

		return [];
	}

	/**
	 * Parse a year from a date string
	 */
	private parseYear(dateStr?: string): number | null {
		if (!dateStr) return null;

		// Try YYYY-MM-DD format
		const isoMatch = dateStr.match(/^(\d{4})/);
		if (isoMatch) {
			return parseInt(isoMatch[1], 10);
		}

		// Try various formats with year
		const yearMatch = dateStr.match(/\b(\d{4})\b/);
		if (yearMatch) {
			return parseInt(yearMatch[1], 10);
		}

		return null;
	}

	/**
	 * Check if a date is in standard format
	 */
	private isStandardDateFormat(dateStr: string): boolean {
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

		for (const person of people) {
			let modified = false;
			const updates: Record<string, string> = {};

			// Check birth date
			if (person.birthDate && !this.isStandardDateFormat(person.birthDate)) {
				const normalized = this.normalizeDateString(person.birthDate);
				if (normalized && normalized !== person.birthDate) {
					updates['birth_date'] = normalized;
					modified = true;
				}
			}

			// Check death date
			if (person.deathDate && !this.isStandardDateFormat(person.deathDate)) {
				const normalized = this.normalizeDateString(person.deathDate);
				if (normalized && normalized !== person.deathDate) {
					updates['death_date'] = normalized;
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
	 * Normalize gender values to standard M/F format
	 * Returns the number of files modified
	 */
	async normalizeGenderValues(options: DataQualityOptions = {}): Promise<BatchOperationResult> {
		const people = this.getPeopleForScope(options);
		const results: BatchOperationResult = {
			processed: 0,
			modified: 0,
			errors: [],
		};

		for (const person of people) {
			if (person.sex) {
				const normalized = this.normalizeGender(person.sex);
				if (normalized && normalized !== person.sex) {
					try {
						await this.updatePersonFrontmatter(person.file, { gender: normalized });
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

		logger.info('normalize-gender', `Normalized gender values: ${results.modified}/${results.processed} files modified`);
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

		for (const person of people) {
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
	 */
	previewNormalization(options: DataQualityOptions = {}): NormalizationPreview {
		const people = this.getPeopleForScope(options);
		const preview: NormalizationPreview = {
			dateNormalization: [],
			genderNormalization: [],
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

			// Check sex
			if (person.sex) {
				const normalized = this.normalizeGender(person.sex);
				if (normalized && normalized !== person.sex) {
					// Can be normalized to M/F
					preview.genderNormalization.push({
						person,
						field: 'sex',
						oldValue: person.sex,
						newValue: normalized,
					});
				} else if (!normalized && person.sex.toLowerCase() !== 'm' && person.sex.toLowerCase() !== 'f') {
					// Unrecognized value - show in preview but won't change
					preview.genderNormalization.push({
						person,
						field: 'sex',
						oldValue: person.sex,
						newValue: '(unrecognized - no change)',
					});
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
	 * Normalize gender value to M or F
	 */
	private normalizeGender(value: string): string | null {
		const normalized = value.toLowerCase().trim();
		if (normalized === 'm' || normalized === 'male') {
			return 'M';
		}
		if (normalized === 'f' || normalized === 'female') {
			return 'F';
		}
		// Unknown value, can't normalize
		return null;
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
 * Preview of normalization changes
 */
export interface NormalizationPreview {
	dateNormalization: NormalizationChange[];
	genderNormalization: NormalizationChange[];
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
