/**
 * Merge Service for Canvas Roots
 *
 * Provides functionality to merge two person records, handling field-level
 * conflict resolution and relationship reconciliation.
 */

import { App, TFile } from 'obsidian';
import type { CanvasRootsSettings } from '../settings';
import { getLogger } from './logging';

const logger = getLogger('MergeService');

/**
 * Represents a single field difference between two records
 */
export interface FieldDifference {
	/** Field name (e.g., 'name', 'born', 'father') */
	field: string;

	/** Human-readable label for the field */
	label: string;

	/** Value from staging record */
	stagingValue: string | string[] | undefined;

	/** Value from main record */
	mainValue: string | string[] | undefined;

	/** Whether this field can be combined (arrays only) */
	canCombine: boolean;

	/** Whether values are different */
	isDifferent: boolean;
}

/**
 * User's choice for how to resolve a field conflict
 */
export interface MergeFieldChoice {
	/** Field name */
	field: string;

	/** How to resolve: use main, staging, or combine both */
	choice: 'main' | 'staging' | 'both';
}

/**
 * Result of a merge operation
 */
export interface MergeResult {
	success: boolean;
	mainFile: TFile;
	stagingFileDeleted: boolean;
	relationshipsUpdated: number;
	error?: string;
}

/**
 * Person data extracted from frontmatter
 */
export interface PersonFrontmatter {
	cr_id?: string;
	name?: string;
	born?: string;
	died?: string;
	birth_place?: string;
	death_place?: string;
	occupation?: string;
	gender?: string;
	father?: string;
	father_id?: string;
	mother?: string;
	mother_id?: string;
	spouse?: string | string[];
	spouse_id?: string | string[];
	child?: string | string[];
	children_id?: string | string[];
	collection?: string;
	[key: string]: unknown;
}

/**
 * Fields that can be merged
 */
const MERGEABLE_FIELDS: { field: string; label: string; isArray: boolean }[] = [
	{ field: 'name', label: 'Name', isArray: false },
	{ field: 'born', label: 'Birth date', isArray: false },
	{ field: 'died', label: 'Death date', isArray: false },
	{ field: 'birth_place', label: 'Birth place', isArray: false },
	{ field: 'death_place', label: 'Death place', isArray: false },
	{ field: 'occupation', label: 'Occupation', isArray: false },
	{ field: 'gender', label: 'Gender', isArray: false },
	{ field: 'father', label: 'Father', isArray: false },
	{ field: 'mother', label: 'Mother', isArray: false },
	{ field: 'spouse', label: 'Spouse(s)', isArray: true },
	{ field: 'child', label: 'Children', isArray: true },
	{ field: 'collection', label: 'Collection', isArray: false }
];

/**
 * Service for merging duplicate person records
 */
export class MergeService {
	constructor(
		private app: App,
		private settings: CanvasRootsSettings
	) {}

	/**
	 * Get frontmatter from a file
	 */
	getFrontmatter(file: TFile): PersonFrontmatter | null {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) {
			return null;
		}
		return cache.frontmatter as PersonFrontmatter;
	}

	/**
	 * Get field differences between staging and main records
	 */
	getFieldDifferences(stagingFile: TFile, mainFile: TFile): FieldDifference[] {
		const staging = this.getFrontmatter(stagingFile);
		const main = this.getFrontmatter(mainFile);

		if (!staging || !main) {
			return [];
		}

		const differences: FieldDifference[] = [];

		for (const { field, label, isArray } of MERGEABLE_FIELDS) {
			const stagingValue = this.normalizeValue(staging[field]);
			const mainValue = this.normalizeValue(main[field]);

			const isDifferent = !this.valuesEqual(stagingValue, mainValue);

			differences.push({
				field,
				label,
				stagingValue,
				mainValue,
				canCombine: isArray,
				isDifferent
			});
		}

		return differences;
	}

	/**
	 * Normalize a value to string or string array
	 */
	private normalizeValue(value: unknown): string | string[] | undefined {
		if (value === undefined || value === null || value === '') {
			return undefined;
		}
		if (Array.isArray(value)) {
			return value.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).filter(v => v !== '');
		}
		if (typeof value === 'object') {
			return JSON.stringify(value);
		}
		return String(value);
	}

	/**
	 * Check if two values are equal
	 */
	private valuesEqual(
		a: string | string[] | undefined,
		b: string | string[] | undefined
	): boolean {
		if (a === undefined && b === undefined) return true;
		if (a === undefined || b === undefined) return false;

		if (Array.isArray(a) && Array.isArray(b)) {
			if (a.length !== b.length) return false;
			const sortedA = [...a].sort();
			const sortedB = [...b].sort();
			return sortedA.every((v, i) => v === sortedB[i]);
		}

		return a === b;
	}

	/**
	 * Merge staging record into main record
	 */
	async merge(
		stagingFile: TFile,
		mainFile: TFile,
		choices: MergeFieldChoice[]
	): Promise<MergeResult> {
		try {
			const staging = this.getFrontmatter(stagingFile);
			const main = this.getFrontmatter(mainFile);

			if (!staging || !main) {
				return {
					success: false,
					mainFile,
					stagingFileDeleted: false,
					relationshipsUpdated: 0,
					error: 'Could not read frontmatter from one or both files'
				};
			}

			const stagingCrId = staging.cr_id;
			const mainCrId = main.cr_id;

			if (!stagingCrId || !mainCrId) {
				return {
					success: false,
					mainFile,
					stagingFileDeleted: false,
					relationshipsUpdated: 0,
					error: 'Missing cr_id in one or both files'
				};
			}

			// Build merged frontmatter
			const merged = this.buildMergedFrontmatter(staging, main, choices);

			// Update the main file with merged data
			await this.updateFileFrontmatter(mainFile, merged);

			// Update relationships pointing to staging to point to main
			const relationshipsUpdated = await this.updateRelationships(stagingCrId, mainCrId);

			// Delete the staging file
			await this.app.fileManager.trashFile(stagingFile);

			logger.info('merge', `Merged ${stagingFile.path} into ${mainFile.path}`, {
				relationshipsUpdated
			});

			return {
				success: true,
				mainFile,
				stagingFileDeleted: true,
				relationshipsUpdated
			};
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			logger.error('merge', `Merge failed: ${errorMsg}`);
			return {
				success: false,
				mainFile,
				stagingFileDeleted: false,
				relationshipsUpdated: 0,
				error: errorMsg
			};
		}
	}

	/**
	 * Build merged frontmatter based on user choices
	 */
	private buildMergedFrontmatter(
		staging: PersonFrontmatter,
		main: PersonFrontmatter,
		choices: MergeFieldChoice[]
	): PersonFrontmatter {
		// Start with main as base
		const merged: PersonFrontmatter = { ...main };

		// Apply choices
		for (const choice of choices) {
			const stagingValue = staging[choice.field];
			const mainValue = main[choice.field];

			switch (choice.choice) {
				case 'staging':
					if (stagingValue !== undefined) {
						merged[choice.field] = stagingValue;
						// Also copy related _id field if it exists
						const idField = this.getIdField(choice.field);
						if (idField && staging[idField] !== undefined) {
							merged[idField] = staging[idField];
						}
					}
					break;

				case 'both': {
					// Combine arrays
					merged[choice.field] = this.combineArrayValues(stagingValue, mainValue);
					// Also combine _id fields
					const idField = this.getIdField(choice.field);
					if (idField) {
						merged[idField] = this.combineArrayValues(staging[idField], main[idField]);
					}
					break;
				}

				case 'main':
				default:
					// Keep main value (already in merged)
					break;
			}
		}

		return merged;
	}

	/**
	 * Get the corresponding _id field for a relationship field
	 */
	private getIdField(field: string): string | null {
		const idFieldMap: Record<string, string> = {
			'father': 'father_id',
			'mother': 'mother_id',
			'spouse': 'spouse_id',
			'child': 'children_id'
		};
		return idFieldMap[field] || null;
	}

	/**
	 * Combine two values into an array, removing duplicates
	 */
	private combineArrayValues(
		a: unknown,
		b: unknown
	): string | string[] | undefined {
		const aArr = this.toArray(a);
		const bArr = this.toArray(b);

		if (aArr.length === 0 && bArr.length === 0) {
			return undefined;
		}

		// Combine and deduplicate
		const combined = [...new Set([...aArr, ...bArr])];

		if (combined.length === 0) return undefined;
		if (combined.length === 1) return combined[0];
		return combined;
	}

	/**
	 * Convert a value to an array
	 */
	private toArray(value: unknown): string[] {
		if (value === undefined || value === null || value === '') {
			return [];
		}
		if (Array.isArray(value)) {
			return value.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).filter(v => v !== '');
		}
		if (typeof value === 'object') {
			return [JSON.stringify(value)];
		}
		return [String(value)];
	}

	/**
	 * Update file frontmatter
	 */
	private async updateFileFrontmatter(file: TFile, newFrontmatter: PersonFrontmatter): Promise<void> {
		const content = await this.app.vault.read(file);

		// Parse existing content
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		const bodyContent = frontmatterMatch
			? content.slice(frontmatterMatch[0].length).trim()
			: content.trim();

		// Build new YAML frontmatter
		const yaml = this.buildYaml(newFrontmatter);

		// Combine frontmatter and body
		const newContent = `---\n${yaml}---\n\n${bodyContent}`;

		await this.app.vault.modify(file, newContent);
	}

	/**
	 * Build YAML string from frontmatter object
	 */
	private buildYaml(fm: PersonFrontmatter): string {
		const lines: string[] = [];

		// Order fields for readability
		const orderedFields = [
			'cr_id', 'name', 'born', 'died', 'birth_place', 'death_place',
			'occupation', 'gender', 'father', 'father_id', 'mother', 'mother_id',
			'spouse', 'spouse_id', 'child', 'children_id', 'collection'
		];

		for (const field of orderedFields) {
			const value = fm[field];
			if (value !== undefined && value !== null && value !== '') {
				lines.push(this.formatYamlField(field, value));
			}
		}

		// Add any other fields not in the ordered list
		for (const [field, value] of Object.entries(fm)) {
			if (!orderedFields.includes(field) && value !== undefined && value !== null && value !== '') {
				lines.push(this.formatYamlField(field, value));
			}
		}

		return lines.join('\n') + '\n';
	}

	/**
	 * Format a single YAML field
	 */
	private formatYamlField(field: string, value: unknown): string {
		if (Array.isArray(value)) {
			if (value.length === 0) return '';
			if (value.length === 1) {
				return `${field}: ${this.formatYamlValue(value[0])}`;
			}
			return `${field}:\n${value.map(v => `  - ${this.formatYamlValue(v)}`).join('\n')}`;
		}
		return `${field}: ${this.formatYamlValue(value)}`;
	}

	/**
	 * Format a YAML value with proper quoting
	 */
	private formatYamlValue(value: unknown): string {
		const str = String(value);
		// Quote strings that contain special characters or look like wikilinks
		if (str.includes(':') || str.includes('#') || str.includes('[') || str.includes('"')) {
			// If already quoted, keep as is
			if (str.startsWith('"') && str.endsWith('"')) {
				return str;
			}
			return `"${str.replace(/"/g, '\\"')}"`;
		}
		return str;
	}

	/**
	 * Update all relationships pointing to old cr_id to point to new cr_id
	 */
	async updateRelationships(oldCrId: string, newCrId: string): Promise<number> {
		let updatedCount = 0;

		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;
			let needsUpdate = false;
			const updates: Record<string, unknown> = {};

			// Check relationship _id fields
			const idFields = ['father_id', 'mother_id', 'spouse_id', 'children_id'];

			for (const field of idFields) {
				const value = fm[field];
				if (value === oldCrId) {
					updates[field] = newCrId;
					needsUpdate = true;
				} else if (Array.isArray(value) && value.includes(oldCrId)) {
					updates[field] = value.map((v: string) => v === oldCrId ? newCrId : v);
					needsUpdate = true;
				}
			}

			if (needsUpdate) {
				await this.updateFileFields(file, updates);
				updatedCount++;
			}
		}

		logger.info('relationships', `Updated ${updatedCount} files with new cr_id reference`);
		return updatedCount;
	}

	/**
	 * Update specific fields in a file's frontmatter
	 */
	private async updateFileFields(file: TFile, updates: Record<string, unknown>): Promise<void> {
		const content = await this.app.vault.read(file);
		const cache = this.app.metadataCache.getFileCache(file);

		if (!cache?.frontmatter) return;

		// Merge updates with existing frontmatter
		const newFm = { ...cache.frontmatter, ...updates } as PersonFrontmatter;

		// Parse body content
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		const bodyContent = frontmatterMatch
			? content.slice(frontmatterMatch[0].length).trim()
			: content.trim();

		// Build new content
		const yaml = this.buildYaml(newFm);
		const newContent = `---\n${yaml}---\n\n${bodyContent}`;

		await this.app.vault.modify(file, newContent);
	}

	/**
	 * Preview what the merged record would look like
	 */
	previewMerge(
		stagingFile: TFile,
		mainFile: TFile,
		choices: MergeFieldChoice[]
	): PersonFrontmatter | null {
		const staging = this.getFrontmatter(stagingFile);
		const main = this.getFrontmatter(mainFile);

		if (!staging || !main) {
			return null;
		}

		return this.buildMergedFrontmatter(staging, main, choices);
	}
}
