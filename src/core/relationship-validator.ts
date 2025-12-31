import { App, TFile } from 'obsidian';
import { FolderFilterService } from './folder-filter';

/**
 * Validation issue types
 */
export type ValidationIssueType =
	| 'broken-father-ref'
	| 'broken-mother-ref'
	| 'broken-parent-ref'
	| 'broken-spouse-ref'
	| 'broken-child-ref'
	| 'missing-bidirectional-parent'
	| 'missing-bidirectional-spouse'
	| 'missing-bidirectional-child';

/**
 * A single validation issue found in a person note
 */
export interface ValidationIssue {
	type: ValidationIssueType;
	message: string;
	field: string;
	referencedCrId?: string;
}

/**
 * Validation results for a person note
 */
export interface ValidationResult {
	file: TFile;
	personName: string;
	crId: string;
	issues: ValidationIssue[];
	isValid: boolean;
}

/**
 * Service for validating relationships in person notes
 */
export class RelationshipValidator {
	private folderFilter: FolderFilterService | null = null;

	constructor(private app: App) {}

	/**
	 * Set the folder filter service for filtering person notes by folder
	 */
	setFolderFilter(folderFilter: FolderFilterService): void {
		this.folderFilter = folderFilter;
	}

	/**
	 * Validate a single person note
	 */
	async validatePersonNote(file: TFile): Promise<ValidationResult> {
		const issues: ValidationIssue[] = [];

		// Read file content
		const content = await this.app.vault.read(file);

		// Extract frontmatter fields
		const crId = this.extractField(content, 'cr_id');
		const personName = this.extractField(content, 'name') || file.basename;
		const fatherId = this.extractField(content, 'father_id');
		const motherId = this.extractField(content, 'mother_id');
		const parentsIds = this.extractArrayField(content, 'parents_id');
		const spouseIds = this.extractArrayField(content, 'spouse_id');
		const childrenIds = this.extractArrayField(content, 'children_id');

		if (!crId) {
			issues.push({
				type: 'broken-father-ref',
				message: 'Missing cr_id field',
				field: 'cr_id'
			});
			return {
				file,
				personName,
				crId: '',
				issues,
				isValid: false
			};
		}

		// Build a map of all person cr_ids in the vault
		const allPersonCrIds = this.getAllPersonCrIds();

		// Validate father reference
		if (fatherId && !allPersonCrIds.has(fatherId)) {
			issues.push({
				type: 'broken-father-ref',
				message: `Father reference points to non-existent person`,
				field: 'father_id',
				referencedCrId: fatherId
			});
		}

		// Validate mother reference
		if (motherId && !allPersonCrIds.has(motherId)) {
			issues.push({
				type: 'broken-mother-ref',
				message: `Mother reference points to non-existent person`,
				field: 'mother_id',
				referencedCrId: motherId
			});
		}

		// Validate parents references (gender-neutral)
		for (const parentId of parentsIds) {
			if (!allPersonCrIds.has(parentId)) {
				issues.push({
					type: 'broken-parent-ref',
					message: `Parent reference points to non-existent person`,
					field: 'parents_id',
					referencedCrId: parentId
				});
			}
		}

		// Validate spouse references
		for (const spouseId of spouseIds) {
			if (!allPersonCrIds.has(spouseId)) {
				issues.push({
					type: 'broken-spouse-ref',
					message: `Spouse reference points to non-existent person`,
					field: 'spouse_id',
					referencedCrId: spouseId
				});
			} else {
				// Check bidirectional relationship
				const spouseFile = allPersonCrIds.get(spouseId);
				if (spouseFile) {
					const hasBackReference = await this.checkSpouseBackReference(spouseFile, crId);
					if (!hasBackReference) {
						issues.push({
							type: 'missing-bidirectional-spouse',
							message: `Spouse doesn't list this person as spouse`,
							field: 'spouse_id',
							referencedCrId: spouseId
						});
					}
				}
			}
		}

		// Validate children references
		for (const childId of childrenIds) {
			if (!allPersonCrIds.has(childId)) {
				issues.push({
					type: 'broken-child-ref',
					message: `Child reference points to non-existent person`,
					field: 'children_id',
					referencedCrId: childId
				});
			} else {
				// Check bidirectional relationship
				const childFile = allPersonCrIds.get(childId);
				if (childFile) {
					const hasBackReference = await this.checkParentBackReference(childFile, crId);
					if (!hasBackReference) {
						issues.push({
							type: 'missing-bidirectional-child',
							message: `Child doesn't list this person as parent`,
							field: 'children_id',
							referencedCrId: childId
						});
					}
				}
			}
		}

		// Check bidirectional parent relationships
		if (fatherId && allPersonCrIds.has(fatherId)) {
			const fatherFile = allPersonCrIds.get(fatherId);
			if (fatherFile) {
				const fatherListsChild = await this.checkChildBackReference(fatherFile, crId);
				if (!fatherListsChild) {
					issues.push({
						type: 'missing-bidirectional-parent',
						message: `Father doesn't list this person as child`,
						field: 'father_id',
						referencedCrId: fatherId
					});
				}
			}
		}

		if (motherId && allPersonCrIds.has(motherId)) {
			const motherFile = allPersonCrIds.get(motherId);
			if (motherFile) {
				const motherListsChild = await this.checkChildBackReference(motherFile, crId);
				if (!motherListsChild) {
					issues.push({
						type: 'missing-bidirectional-parent',
						message: `Mother doesn't list this person as child`,
						field: 'mother_id',
						referencedCrId: motherId
					});
				}
			}
		}

		// Check bidirectional parent relationships for gender-neutral parents
		for (const parentId of parentsIds) {
			if (allPersonCrIds.has(parentId)) {
				const parentFile = allPersonCrIds.get(parentId);
				if (parentFile) {
					const parentListsChild = await this.checkChildBackReference(parentFile, crId);
					if (!parentListsChild) {
						issues.push({
							type: 'missing-bidirectional-parent',
							message: `Parent doesn't list this person as child`,
							field: 'parents_id',
							referencedCrId: parentId
						});
					}
				}
			}
		}

		return {
			file,
			personName,
			crId,
			issues,
			isValid: issues.length === 0
		};
	}

	/**
	 * Get all person cr_ids in the vault
	 */
	private getAllPersonCrIds(): Map<string, TFile> {
		const crIdMap = new Map<string, TFile>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			// Apply folder filter if configured
			if (this.folderFilter && !this.folderFilter.shouldIncludeFile(file)) {
				continue;
			}

			const cache = this.app.metadataCache.getFileCache(file);
			const crId = cache?.frontmatter?.cr_id;
			if (crId) {
				crIdMap.set(crId, file);
			}
		}

		return crIdMap;
	}

	/**
	 * Extract a single field from frontmatter
	 */
	private extractField(content: string, fieldName: string): string | null {
		const match = content.match(new RegExp(`^${fieldName}:\\s*(.+)$`, 'm'));
		return match ? match[1].trim() : null;
	}

	/**
	 * Extract an array field from frontmatter
	 */
	private extractArrayField(content: string, fieldName: string): string[] {
		const result: string[] = [];

		// Check for single value format
		const singleMatch = content.match(new RegExp(`^${fieldName}:\\s*(.+)$`, 'm'));
		if (singleMatch) {
			const value = singleMatch[1].trim();
			// Check if it's followed by array items
			const arrayMatch = content.match(
				new RegExp(`^${fieldName}:\\s*\\n((?: {2}- .+\\n)*)`, 'm')
			);
			if (arrayMatch) {
				// Array format
				const arrayContent = arrayMatch[1];
				const items = arrayContent.match(/ {2}- (.+)/g);
				if (items) {
					items.forEach(item => {
						const cleaned = item.replace(/ {2}- /, '').trim();
						if (cleaned) result.push(cleaned);
					});
				}
			} else if (value && value !== '') {
				// Single value
				result.push(value);
			}
		}

		return result;
	}

	/**
	 * Check if a spouse file lists the given cr_id as spouse
	 */
	private async checkSpouseBackReference(spouseFile: TFile, crId: string): Promise<boolean> {
		const content = await this.app.vault.read(spouseFile);
		const spouseIds = this.extractArrayField(content, 'spouse_id');
		return spouseIds.includes(crId);
	}

	/**
	 * Check if a child file lists the given cr_id as parent
	 * Checks father_id, mother_id, and parents_id (gender-neutral)
	 */
	private async checkParentBackReference(childFile: TFile, crId: string): Promise<boolean> {
		const content = await this.app.vault.read(childFile);
		const fatherId = this.extractField(content, 'father_id');
		const motherId = this.extractField(content, 'mother_id');
		const parentsIds = this.extractArrayField(content, 'parents_id');
		return fatherId === crId || motherId === crId || parentsIds.includes(crId);
	}

	/**
	 * Check if a parent file lists the given cr_id as child
	 */
	private async checkChildBackReference(parentFile: TFile, crId: string): Promise<boolean> {
		const content = await this.app.vault.read(parentFile);
		const childrenIds = this.extractArrayField(content, 'children_id');
		return childrenIds.includes(crId);
	}
}
