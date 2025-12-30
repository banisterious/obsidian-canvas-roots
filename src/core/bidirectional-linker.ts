import { App, TFile, Notice } from 'obsidian';
import { getLogger } from './logging';
import { getErrorMessage } from './error-utils';
import { PersonFrontmatter } from '../types/frontmatter';
import { FolderFilterService } from './folder-filter';

const logger = getLogger('BidirectionalLinker');

/**
 * Snapshot of relationship fields for deletion detection
 */
interface RelationshipSnapshot {
	father?: string;
	mother?: string;
	adoptive_father?: string;
	adoptive_mother?: string;
	stepfather?: string | string[];
	stepmother?: string | string[];
	parents?: string | string[];
	spouse?: string | string[];
	children?: string | string[];
	child?: string | string[];  // Actual property name in frontmatter
	// Indexed spouse properties
	[key: `spouse${number}`]: string | undefined;
}

/**
 * Service for maintaining bidirectional relationship links between person notes
 *
 * Ensures that when a relationship is created in one direction,
 * the inverse relationship is automatically created in the other direction.
 *
 * Also handles relationship deletions - when a relationship is removed from one note,
 * the reciprocal relationship is removed from the other note.
 *
 * Examples:
 * - father: [[John]] in Jane's note → children: [[Jane]] in John's note
 * - spouse: [[Jane]] in John's note → spouse: [[John]] in Jane's note
 * - Removing father from Jane → removes Jane from John's children
 */
export class BidirectionalLinker {
	// Track previous relationship snapshots for deletion detection
	// Map of file path → relationship snapshot
	private relationshipSnapshots: Map<string, RelationshipSnapshot> = new Map();
	private folderFilter: FolderFilterService | null = null;
	private suspended = false;

	constructor(private app: App) {}

	/**
	 * Set the folder filter service for filtering person notes by folder
	 */
	setFolderFilter(folderFilter: FolderFilterService): void {
		this.folderFilter = folderFilter;
	}

	/**
	 * Temporarily suspend automatic bidirectional linking
	 * Use this during batch operations to prevent interference
	 */
	suspend(): void {
		this.suspended = true;
		logger.info('bidirectional-linking', 'Bidirectional linker suspended');
	}

	/**
	 * Resume automatic bidirectional linking after suspension
	 */
	resume(): void {
		this.suspended = false;
		logger.info('bidirectional-linking', 'Bidirectional linker resumed');
	}

	/**
	 * Initialize relationship snapshots for all person notes in the vault
	 * This should be called on plugin load to enable deletion detection from the first edit
	 *
	 * Runs asynchronously to avoid blocking plugin initialization
	 */
	initializeSnapshots(): void {
		logger.info('snapshot-init', 'Initializing relationship snapshots for all person notes');

		const files = this.app.vault.getMarkdownFiles();
		let snapshotCount = 0;

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter?.cr_id) {
				continue;
			}

			// Apply folder filter if configured
			if (this.folderFilter && !this.folderFilter.shouldIncludeFile(file)) {
				continue;
			}

			// Capture current state without syncing
			this.updateSnapshot(file.path, cache.frontmatter);
			snapshotCount++;
		}

		logger.info('snapshot-init', `Initialized ${snapshotCount} relationship snapshots`);
	}

	/**
	 * Synchronize relationships after a person note is created or updated
	 *
	 * This should be called whenever:
	 * - A new person note is created with relationship fields
	 * - An existing person note's relationships are modified
	 *
	 * @param personFile The person note file that was created/updated
	 */
	async syncRelationships(personFile: TFile): Promise<void> {
		// Skip if suspended (during batch operations)
		if (this.suspended) {
			logger.debug('bidirectional-linking', 'Skipping sync - linker suspended', {
				file: personFile.path
			});
			return;
		}

		logger.info('bidirectional-linking', 'Starting relationship sync', {
			file: personFile.path
		});

		try {
			// Read the person's metadata
			const cache = this.app.metadataCache.getFileCache(personFile);
			if (!cache?.frontmatter) {
				logger.warn('bidirectional-linking', 'No frontmatter found', {
					file: personFile.path
				});
				return;
			}

			const frontmatter = cache.frontmatter;
			const personName = frontmatter.name || personFile.basename;
			const personCrId = frontmatter.cr_id;

			if (!personCrId) {
				logger.warn('bidirectional-linking', 'No cr_id found', {
					file: personFile.path
				});
				return;
			}

			// Get previous snapshot for deletion detection
			const previousSnapshot = this.relationshipSnapshots.get(personFile.path);

			// Detect and sync deletions if we have a previous snapshot
			if (previousSnapshot) {
				await this.syncDeletions(previousSnapshot, frontmatter, personFile, personName, personCrId);
			}

			// Sync father relationship
			if (frontmatter.father) {
				await this.syncParentChild(
					frontmatter.father,
					personFile,
					personName,
					'father'
				);
			}

			// Sync mother relationship
			if (frontmatter.mother) {
				await this.syncParentChild(
					frontmatter.mother,
					personFile,
					personName,
					'mother'
				);
			}

			// Sync adoptive father relationship
			if (frontmatter.adoptive_father) {
				await this.syncAdoptiveParentChild(
					frontmatter.adoptive_father,
					personFile,
					personName,
					personCrId,
					'adoptive_father'
				);
			}

			// Sync adoptive mother relationship
			if (frontmatter.adoptive_mother) {
				await this.syncAdoptiveParentChild(
					frontmatter.adoptive_mother,
					personFile,
					personName,
					personCrId,
					'adoptive_mother'
				);
			}

			// Sync step-father relationship(s)
			const stepfatherLinks = frontmatter.stepfather;
			const stepfatherArray = stepfatherLinks
				? Array.isArray(stepfatherLinks) ? stepfatherLinks : [stepfatherLinks]
				: [];
			for (const stepfatherLink of stepfatherArray) {
				if (stepfatherLink) {
					await this.syncStepParentChild(
						stepfatherLink,
						personFile,
						personName,
						personCrId,
						'stepfather'
					);
				}
			}

			// Sync step-mother relationship(s)
			const stepmotherLinks = frontmatter.stepmother;
			const stepmotherArray = stepmotherLinks
				? Array.isArray(stepmotherLinks) ? stepmotherLinks : [stepmotherLinks]
				: [];
			for (const stepmotherLink of stepmotherArray) {
				if (stepmotherLink) {
					await this.syncStepParentChild(
						stepmotherLink,
						personFile,
						personName,
						personCrId,
						'stepmother'
					);
				}
			}

			// Sync gender-neutral parent relationship(s)
			const parentsLinks = frontmatter.parents;
			const parentsArray = parentsLinks
				? Array.isArray(parentsLinks) ? parentsLinks : [parentsLinks]
				: [];
			for (const parentLink of parentsArray) {
				if (parentLink) {
					await this.syncParentChild(
						parentLink,
						personFile,
						personName,
						'parents'
					);
				}
			}

			// Sync spouse relationship(s)
			// Handle both simple spouse/spouse_id and indexed spouse1/spouse1_id format
			const spousesToSync: Array<{link: unknown, index?: number}> = [];

			// Check for simple spouse property
			if (frontmatter.spouse) {
				const spouses = Array.isArray(frontmatter.spouse)
					? frontmatter.spouse
					: [frontmatter.spouse];

				for (const spouse of spouses) {
					spousesToSync.push({ link: spouse });
				}
			}

			// Check for indexed spouse properties (spouse1, spouse2, etc.)
			for (const key of Object.keys(frontmatter)) {
				const match = key.match(/^spouse(\d+)$/);
				if (match) {
					const index = parseInt(match[1]);
					const spouseLink = frontmatter[key];
					if (spouseLink) {
						spousesToSync.push({ link: spouseLink, index });
					}
				}
			}

			// Sync all discovered spouse relationships
			for (const spouse of spousesToSync) {
				await this.syncSpouse(spouse.link, personFile, personName, personCrId, spouse.index);
			}

			// Sync children relationships (child → parent direction)
			// When children are linked to this person, set their father/mother based on this person's sex
			const childrenLinks = frontmatter.child || frontmatter.children || [];
			const childrenArray = Array.isArray(childrenLinks) ? childrenLinks : [childrenLinks];
			const personSex = frontmatter.sex || frontmatter.gender;

			for (const childLink of childrenArray) {
				if (childLink) {
					await this.syncChildToParent(childLink, personFile, personName, personCrId, personSex);
				}
			}

			// Update snapshot for future deletion detection
			this.updateSnapshot(personFile.path, frontmatter);

			logger.info('bidirectional-linking', 'Relationship sync completed', {
				file: personFile.path,
				spouseCount: spousesToSync.length
			});
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			logger.error('bidirectional-linking', 'Failed to sync relationships', {
				file: personFile.path,
				error: errorMsg
			});
			new Notice(`Failed to sync relationships: ${errorMsg}`);
		}
	}

	/**
	 * Detect and sync relationship deletions by comparing previous and current frontmatter
	 */
	private async syncDeletions(
		previousSnapshot: RelationshipSnapshot,
		currentFrontmatter: PersonFrontmatter,
		personFile: TFile,
		personName: string,
		personCrId: string
	): Promise<void> {
		// Check for deleted father relationship
		if (previousSnapshot.father && !currentFrontmatter.father) {
			await this.removeChildFromParent(previousSnapshot.father, personFile, personName, personCrId);
		}

		// Check for deleted mother relationship
		if (previousSnapshot.mother && !currentFrontmatter.mother) {
			await this.removeChildFromParent(previousSnapshot.mother, personFile, personName, personCrId);
		}

		// Check for deleted adoptive father relationship
		if (previousSnapshot.adoptive_father && !currentFrontmatter.adoptive_father) {
			await this.removeAdoptedChildFromParent(previousSnapshot.adoptive_father, personFile, personName, personCrId);
		}

		// Check for deleted adoptive mother relationship
		if (previousSnapshot.adoptive_mother && !currentFrontmatter.adoptive_mother) {
			await this.removeAdoptedChildFromParent(previousSnapshot.adoptive_mother, personFile, personName, personCrId);
		}

		// Check for deleted step-father relationships
		const previousStepfathers = this.extractSpouseLinks(previousSnapshot.stepfather);
		const currentStepfathers = this.extractSpouseLinks(currentFrontmatter.stepfather);

		for (const previousStepfather of previousStepfathers) {
			if (!currentStepfathers.includes(previousStepfather)) {
				await this.removeStepChildFromParent(previousStepfather, personFile, personName, personCrId);
			}
		}

		// Check for deleted step-mother relationships
		const previousStepmothers = this.extractSpouseLinks(previousSnapshot.stepmother);
		const currentStepmothers = this.extractSpouseLinks(currentFrontmatter.stepmother);

		for (const previousStepmother of previousStepmothers) {
			if (!currentStepmothers.includes(previousStepmother)) {
				await this.removeStepChildFromParent(previousStepmother, personFile, personName, personCrId);
			}
		}

		// Check for deleted gender-neutral parent relationships
		const previousParents = this.extractSpouseLinks(previousSnapshot.parents);
		const currentParents = this.extractSpouseLinks(currentFrontmatter.parents);

		for (const previousParent of previousParents) {
			if (!currentParents.includes(previousParent)) {
				await this.removeChildFromParent(previousParent, personFile, personName, personCrId);
			}
		}

		// Check for deleted spouse relationships (simple format)
		const previousSpouses = this.extractSpouseLinks(previousSnapshot.spouse);
		const currentSpouses = this.extractSpouseLinks(currentFrontmatter.spouse);

		for (const previousSpouse of previousSpouses) {
			if (!currentSpouses.includes(previousSpouse)) {
				await this.removeSpouseLink(previousSpouse, personFile, personName, personCrId);
			}
		}

		// Check for deleted indexed spouse relationships
		for (let i = 1; i <= 10; i++) { // Check up to spouse10
			const key = `spouse${i}` as keyof RelationshipSnapshot;
			const previousSpouse = previousSnapshot[key];
			const currentSpouse = currentFrontmatter[key];

			if (previousSpouse && typeof previousSpouse === 'string' && !currentSpouse) {
				await this.removeSpouseLink(previousSpouse, personFile, personName, personCrId);
			}
		}

		// Check for deleted children relationships
		// When a parent removes a child, clear the child's father/mother field
		const previousChildren = this.extractChildLinks(previousSnapshot.child);
		const currentChildren = this.extractChildLinks(currentFrontmatter.child);

		// Get parent's sex to know which field to clear (father or mother)
		const parentSex = currentFrontmatter.sex || currentFrontmatter.gender;

		for (const previousChild of previousChildren) {
			if (!currentChildren.includes(previousChild)) {
				await this.removeParentFromChild(previousChild, personFile, personName, personCrId, parentSex);
			}
		}
	}

	/**
	 * Extract spouse links as array from spouse property (handles both single and array format)
	 */
	private extractSpouseLinks(spouse: unknown): string[] {
		if (!spouse) return [];
		if (typeof spouse === 'string') return [spouse];
		if (Array.isArray(spouse)) {
			const result: string[] = [];
			for (const item of spouse) {
				const link = this.extractStringLink(item);
				if (link) result.push(link);
			}
			return result;
		}
		// Handle object with link property
		const link = this.extractStringLink(spouse);
		return link ? [link] : [];
	}

	/**
	 * Extract child links as array from child property (handles both single and array format)
	 */
	private extractChildLinks(child: unknown): string[] {
		if (!child) return [];
		if (typeof child === 'string') return [child];
		if (Array.isArray(child)) {
			const result: string[] = [];
			for (const item of child) {
				const link = this.extractStringLink(item);
				if (link) result.push(link);
			}
			return result;
		}
		// Handle object with link property
		const link = this.extractStringLink(child);
		return link ? [link] : [];
	}

	/**
	 * Update the relationship snapshot for a person
	 */
	private updateSnapshot(filePath: string, frontmatter: PersonFrontmatter): void {
		// Extract child property - may come from index signature with broader type
		const childValue = frontmatter['child'];
		const childSnapshot = (typeof childValue === 'string' || Array.isArray(childValue))
			? childValue
			: undefined;

		const snapshot: RelationshipSnapshot = {
			father: frontmatter.father,
			mother: frontmatter.mother,
			adoptive_father: frontmatter.adoptive_father,
			adoptive_mother: frontmatter.adoptive_mother,
			stepfather: frontmatter.stepfather,
			stepmother: frontmatter.stepmother,
			parents: frontmatter.parents,
			spouse: frontmatter.spouse,
			children: frontmatter.children,
			child: childSnapshot  // Capture child array for deletion detection
		};

		// Capture indexed spouse properties
		for (let i = 1; i <= 10; i++) {
			const key = `spouse${i}` as keyof RelationshipSnapshot;
			const value = frontmatter[key];
			if (value && typeof value === 'string') {
				snapshot[key] = value;
			}
		}

		this.relationshipSnapshots.set(filePath, snapshot);

		logger.debug('bidirectional-linking', 'Updated relationship snapshot', {
			filePath,
			snapshot
		});
	}

	/**
	 * Sync parent-child relationship (dual storage)
	 * Ensures parent has this person in their children array + children_id array
	 */
	private async syncParentChild(
		parentLink: unknown,
		childFile: TFile,
		childName: string,
		relationshipType: 'father' | 'mother' | 'parents'
	): Promise<void> {
		const parentFile = this.resolveLink(parentLink, childFile);
		if (!parentFile) {
			logger.warn('bidirectional-linking', `${relationshipType} file not found`, {
				parentLink,
				childFile: childFile.path
			});
			return;
		}

		// Read parent's and child's frontmatter
		const parentCache = this.app.metadataCache.getFileCache(parentFile);
		if (!parentCache?.frontmatter) {
			logger.warn('bidirectional-linking', 'Parent has no frontmatter', {
				parentFile: parentFile.path
			});
			return;
		}

		const childCache = this.app.metadataCache.getFileCache(childFile);
		const childCrId = childCache?.frontmatter?.cr_id;

		if (!childCrId) {
			logger.warn('bidirectional-linking', 'Child has no cr_id', {
				childFile: childFile.path
			});
			return;
		}

		// Check if child is already in parent's children arrays (check both fields)
		const childrenLinks = parentCache.frontmatter.children || [];
		const childrenIds = parentCache.frontmatter.children_id || [];
		const childrenLinksArray = Array.isArray(childrenLinks) ? childrenLinks : [childrenLinks];
		const childrenIdsArray = Array.isArray(childrenIds) ? childrenIds : [childrenIds];

		// Check by cr_id first (more reliable)
		const hasChildById = childrenIdsArray.includes(childCrId);

		// Create wikilink using basename if it differs from name, otherwise use name
		// This handles duplicate names correctly (e.g., "John Doe 1.md" with name "John Doe")
		const childLinkText = childFile.basename !== childName
			? `[[${childFile.basename}|${childName}]]`
			: `[[${childName}]]`;

		// Also check wikilinks for backward compatibility
		const hasChildByLink = childrenLinksArray.some(child => {
			const linkText = typeof child === 'string' ? child : String(child);
			return linkText.includes(childName) || linkText.includes(childFile.basename);
		});

		if (hasChildById || hasChildByLink) {
			logger.debug('bidirectional-linking', 'Child already in parent children', {
				parentFile: parentFile.path,
				childFile: childFile.path,
				hasById: hasChildById,
				hasByLink: hasChildByLink
			});
			return;
		}

		// Add child to parent's child arrays (dual storage)
		await this.addToArrayField(parentFile, 'child', childLinkText);
		await this.addToArrayField(parentFile, 'children_id', childCrId);

		logger.info('bidirectional-linking', 'Added child to parent (dual storage)', {
			parentFile: parentFile.path,
			childFile: childFile.path,
			relationshipType,
			wikilink: childLinkText,
			crId: childCrId
		});
	}

	/**
	 * Sync spouse relationship (bidirectional, dual storage)
	 * Ensures both spouses list each other in spouse/spouse_id or indexed spouse properties
	 * @param spouseLink Wikilink to spouse
	 * @param personFile Person's file
	 * @param personName Person's name
	 * @param personCrId Person's cr_id
	 * @param spouseIndex Optional index for indexed spouse properties (spouse1, spouse2, etc.)
	 */
	private async syncSpouse(
		spouseLink: unknown,
		personFile: TFile,
		personName: string,
		personCrId: string,
		spouseIndex?: number
	): Promise<void> {
		const spouseFile = this.resolveLink(spouseLink, personFile);
		if (!spouseFile) {
			logger.warn('bidirectional-linking', 'Spouse file not found', {
				spouseLink,
				personFile: personFile.path
			});
			return;
		}

		// Read spouse's frontmatter
		const spouseCache = this.app.metadataCache.getFileCache(spouseFile);
		if (!spouseCache?.frontmatter) {
			logger.warn('bidirectional-linking', 'Spouse has no frontmatter', {
				spouseFile: spouseFile.path
			});
			return;
		}

		const spouseFm = spouseCache.frontmatter;

		// Check if person is already linked (check both simple and indexed formats)
		let alreadyLinked = false;

		// Check simple spouse/spouse_id properties
		const spouseLinks = spouseFm.spouse;
		const spouseIds = spouseFm.spouse_id;
		const spouseLinksArray = spouseLinks
			? Array.isArray(spouseLinks) ? spouseLinks : [spouseLinks]
			: [];
		const spouseIdsArray = spouseIds
			? Array.isArray(spouseIds) ? spouseIds : [spouseIds]
			: [];

		// Create wikilink using basename if it differs from name, otherwise use name
		const personLinkText = personFile.basename !== personName
			? `[[${personFile.basename}|${personName}]]`
			: `[[${personName}]]`;

		// Check by cr_id first (more reliable)
		if (spouseIdsArray.includes(personCrId)) {
			alreadyLinked = true;
		}

		// Also check wikilinks for backward compatibility
		if (spouseLinksArray.some(spouse => {
			const linkText = typeof spouse === 'string' ? spouse : String(spouse);
			return linkText.includes(personName) || linkText.includes(personFile.basename);
		})) {
			alreadyLinked = true;
		}

		// Check indexed spouse properties (spouse1_id, spouse2_id, etc.)
		if (!alreadyLinked) {
			for (const key of Object.keys(spouseFm)) {
				const match = key.match(/^spouse(\d+)_id$/);
				if (match && spouseFm[key] === personCrId) {
					alreadyLinked = true;
					break;
				}
			}
		}

		if (alreadyLinked) {
			logger.debug('bidirectional-linking', 'Spouse already linked', {
				spouseFile: spouseFile.path,
				personFile: personFile.path
			});
			return;
		}

		// Add person to spouse's spouse fields
		// Use indexed format if the source used indexed format, otherwise use simple format
		if (spouseIndex !== undefined) {
			// Find next available index in spouse's file
			let nextIndex = 1;
			while (spouseFm[`spouse${nextIndex}`] || spouseFm[`spouse${nextIndex}_id`]) {
				nextIndex++;
			}

			// Add indexed spouse properties
			await this.setField(spouseFile, `spouse${nextIndex}`, personLinkText);
			await this.setField(spouseFile, `spouse${nextIndex}_id`, personCrId);

			logger.info('bidirectional-linking', 'Added indexed spouse bidirectional link', {
				spouseFile: spouseFile.path,
				personFile: personFile.path,
				index: nextIndex,
				wikilink: personLinkText,
				crId: personCrId
			});
		} else {
			// Use simple spouse/spouse_id format
			if (spouseLinksArray.length === 0) {
				// First spouse - set as single value
				await this.setField(spouseFile, 'spouse', personLinkText);
				await this.setField(spouseFile, 'spouse_id', personCrId);
			} else if (spouseLinksArray.length === 1) {
				// Second spouse - convert to array
				await this.setField(spouseFile, 'spouse', [spouseLinksArray[0], personLinkText]);
				// Handle spouse_id similarly
				if (spouseIdsArray.length === 1) {
					await this.setField(spouseFile, 'spouse_id', [spouseIdsArray[0], personCrId]);
				} else {
					await this.setField(spouseFile, 'spouse_id', personCrId);
				}
			} else {
				// Multiple spouses - add to array
				await this.addToArrayField(spouseFile, 'spouse', personLinkText);
				await this.addToArrayField(spouseFile, 'spouse_id', personCrId);
			}

			logger.info('bidirectional-linking', 'Added spouse bidirectional link (simple format)', {
				spouseFile: spouseFile.path,
				personFile: personFile.path,
				wikilink: personLinkText,
				crId: personCrId
			});
		}
	}

	/**
	 * Sync child-to-parent relationship (child gets parent reference)
	 * When a parent adds a child, the child's father/mother field is set based on parent's sex
	 *
	 * @param childLink Wikilink to child
	 * @param parentFile Parent's file
	 * @param parentName Parent's name
	 * @param parentCrId Parent's cr_id
	 * @param parentSex Parent's sex (male/female/other)
	 */
	private async syncChildToParent(
		childLink: unknown,
		parentFile: TFile,
		parentName: string,
		parentCrId: string,
		parentSex?: string
	): Promise<void> {
		const childFile = this.resolveLink(childLink, parentFile);
		if (!childFile) {
			logger.warn('bidirectional-linking', 'Child file not found', {
				childLink,
				parentFile: parentFile.path
			});
			return;
		}

		// Read child's frontmatter
		const childCache = this.app.metadataCache.getFileCache(childFile);
		if (!childCache?.frontmatter) {
			logger.warn('bidirectional-linking', 'Child has no frontmatter', {
				childFile: childFile.path
			});
			return;
		}

		const childFm = childCache.frontmatter;

		// Create wikilink using basename if it differs from name, otherwise use name
		const parentLinkText = parentFile.basename !== parentName
			? `[[${parentFile.basename}|${parentName}]]`
			: `[[${parentName}]]`;

		// Determine which parent field to set based on parent's sex
		let parentField: 'father' | 'mother' | undefined;
		let parentIdField: 'father_id' | 'mother_id' | undefined;

		if (parentSex === 'male') {
			parentField = 'father';
			parentIdField = 'father_id';
		} else if (parentSex === 'female') {
			parentField = 'mother';
			parentIdField = 'mother_id';
		} else {
			// Unknown/other sex - log warning and skip auto-setting
			// User can manually set the relationship in the child's note
			logger.debug('bidirectional-linking', 'Parent sex unknown, skipping automatic child-parent link', {
				parentFile: parentFile.path,
				childFile: childFile.path,
				parentSex
			});
			return;
		}

		// Check if parent is already set in child's field
		const existingParent = childFm[parentField];
		const existingParentId = childFm[parentIdField];

		// Check if already linked by cr_id
		if (existingParentId === parentCrId) {
			logger.debug('bidirectional-linking', 'Parent already set in child', {
				childFile: childFile.path,
				parentField,
				parentCrId
			});
			return;
		}

		// Check if already linked by wikilink
		if (existingParent) {
			const existingParentStr = typeof existingParent === 'string' ? existingParent : String(existingParent);
			if (existingParentStr.includes(parentName) || existingParentStr.includes(parentFile.basename)) {
				logger.debug('bidirectional-linking', 'Parent already set in child (by link)', {
					childFile: childFile.path,
					parentField,
					existingParent: existingParentStr
				});
				return;
			}

			// A different parent is already set - don't overwrite
			logger.debug('bidirectional-linking', 'Child already has a different parent, not overwriting', {
				childFile: childFile.path,
				parentField,
				existingParent: existingParentStr
			});
			return;
		}

		// Set the parent field on the child (dual storage)
		await this.setField(childFile, parentField, parentLinkText);
		await this.setField(childFile, parentIdField, parentCrId);

		logger.info('bidirectional-linking', 'Set parent on child (child-to-parent sync)', {
			childFile: childFile.path,
			parentFile: parentFile.path,
			parentField,
			wikilink: parentLinkText,
			crId: parentCrId
		});
	}

	/**
	 * Sync adoptive parent-child relationship (dual storage)
	 * Ensures adoptive parent has this person in their adopted_child/adopted_child_id arrays
	 *
	 * @param adoptiveParentLink Wikilink to adoptive parent
	 * @param childFile Child's file
	 * @param childName Child's name
	 * @param childCrId Child's cr_id
	 * @param relationshipType 'adoptive_father' or 'adoptive_mother'
	 */
	private async syncAdoptiveParentChild(
		adoptiveParentLink: unknown,
		childFile: TFile,
		childName: string,
		childCrId: string,
		relationshipType: 'adoptive_father' | 'adoptive_mother'
	): Promise<void> {
		const adoptiveParentFile = this.resolveLink(adoptiveParentLink, childFile);
		if (!adoptiveParentFile) {
			logger.warn('bidirectional-linking', `${relationshipType} file not found`, {
				adoptiveParentLink,
				childFile: childFile.path
			});
			return;
		}

		// Read adoptive parent's frontmatter
		const adoptiveParentCache = this.app.metadataCache.getFileCache(adoptiveParentFile);
		if (!adoptiveParentCache?.frontmatter) {
			logger.warn('bidirectional-linking', 'Adoptive parent has no frontmatter', {
				adoptiveParentFile: adoptiveParentFile.path
			});
			return;
		}

		// Check if child is already in adoptive parent's adopted_child arrays
		const adoptedChildLinks = adoptiveParentCache.frontmatter.adopted_child || [];
		const adoptedChildIds = adoptiveParentCache.frontmatter.adopted_child_id || [];
		const adoptedChildLinksArray = Array.isArray(adoptedChildLinks) ? adoptedChildLinks : [adoptedChildLinks];
		const adoptedChildIdsArray = Array.isArray(adoptedChildIds) ? adoptedChildIds : [adoptedChildIds];

		// Check by cr_id first (more reliable)
		const hasChildById = adoptedChildIdsArray.includes(childCrId);

		// Create wikilink using basename if it differs from name, otherwise use name
		const childLinkText = childFile.basename !== childName
			? `[[${childFile.basename}|${childName}]]`
			: `[[${childName}]]`;

		// Also check wikilinks for backward compatibility
		const hasChildByLink = adoptedChildLinksArray.some(child => {
			const linkText = typeof child === 'string' ? child : String(child);
			return linkText.includes(childName) || linkText.includes(childFile.basename);
		});

		if (hasChildById || hasChildByLink) {
			logger.debug('bidirectional-linking', 'Adopted child already in adoptive parent', {
				adoptiveParentFile: adoptiveParentFile.path,
				childFile: childFile.path,
				hasById: hasChildById,
				hasByLink: hasChildByLink
			});
			return;
		}

		// Add child to adoptive parent's adopted_child arrays (dual storage)
		await this.addToArrayField(adoptiveParentFile, 'adopted_child', childLinkText);
		await this.addToArrayField(adoptiveParentFile, 'adopted_child_id', childCrId);

		logger.info('bidirectional-linking', 'Added adopted child to adoptive parent (dual storage)', {
			adoptiveParentFile: adoptiveParentFile.path,
			childFile: childFile.path,
			relationshipType,
			wikilink: childLinkText,
			crId: childCrId
		});
	}

	/**
	 * Sync step-parent-child relationship (dual storage)
	 * Ensures step-parent has this person in their step_child/step_child_id arrays
	 *
	 * @param stepParentLink Wikilink to step-parent
	 * @param childFile Child's file
	 * @param childName Child's name
	 * @param childCrId Child's cr_id
	 * @param relationshipType 'stepfather' or 'stepmother'
	 */
	private async syncStepParentChild(
		stepParentLink: unknown,
		childFile: TFile,
		childName: string,
		childCrId: string,
		relationshipType: 'stepfather' | 'stepmother'
	): Promise<void> {
		const stepParentFile = this.resolveLink(stepParentLink, childFile);
		if (!stepParentFile) {
			logger.warn('bidirectional-linking', `${relationshipType} file not found`, {
				stepParentLink,
				childFile: childFile.path
			});
			return;
		}

		// Read step-parent's frontmatter
		const stepParentCache = this.app.metadataCache.getFileCache(stepParentFile);
		if (!stepParentCache?.frontmatter) {
			logger.warn('bidirectional-linking', 'Step-parent has no frontmatter', {
				stepParentFile: stepParentFile.path
			});
			return;
		}

		// Check if child is already in step-parent's step_child arrays
		const stepChildLinks = stepParentCache.frontmatter.step_child || [];
		const stepChildIds = stepParentCache.frontmatter.step_child_id || [];
		const stepChildLinksArray = Array.isArray(stepChildLinks) ? stepChildLinks : [stepChildLinks];
		const stepChildIdsArray = Array.isArray(stepChildIds) ? stepChildIds : [stepChildIds];

		// Check by cr_id first (more reliable)
		const hasChildById = stepChildIdsArray.includes(childCrId);

		// Create wikilink using basename if it differs from name, otherwise use name
		const childLinkText = childFile.basename !== childName
			? `[[${childFile.basename}|${childName}]]`
			: `[[${childName}]]`;

		// Also check wikilinks for backward compatibility
		const hasChildByLink = stepChildLinksArray.some(child => {
			const linkText = typeof child === 'string' ? child : String(child);
			return linkText.includes(childName) || linkText.includes(childFile.basename);
		});

		if (hasChildById || hasChildByLink) {
			logger.debug('bidirectional-linking', 'Step-child already in step-parent', {
				stepParentFile: stepParentFile.path,
				childFile: childFile.path,
				hasById: hasChildById,
				hasByLink: hasChildByLink
			});
			return;
		}

		// Add child to step-parent's step_child arrays (dual storage)
		await this.addToArrayField(stepParentFile, 'step_child', childLinkText);
		await this.addToArrayField(stepParentFile, 'step_child_id', childCrId);

		logger.info('bidirectional-linking', 'Added step-child to step-parent (dual storage)', {
			stepParentFile: stepParentFile.path,
			childFile: childFile.path,
			relationshipType,
			wikilink: childLinkText,
			crId: childCrId
		});
	}

	/**
	 * Remove a child from a parent's children array (handles deletion sync)
	 */
	private async removeChildFromParent(
		parentLink: unknown,
		childFile: TFile,
		childName: string,
		childCrId: string
	): Promise<void> {
		const parentFile = this.resolveLink(parentLink, childFile);
		if (!parentFile) {
			logger.warn('bidirectional-linking', 'Parent file not found for deletion sync', {
				parentLink,
				childFile: childFile.path
			});
			return;
		}

		// Remove from both child and children_id arrays
		// Try all possible formats: [[name]], [[basename]], [[basename|name]]
		await this.removeFromArrayField(parentFile, 'child', `[[${childName}]]`);
		await this.removeFromArrayField(parentFile, 'child', `[[${childFile.basename}]]`);
		await this.removeFromArrayField(parentFile, 'child', `[[${childFile.basename}|${childName}]]`);
		await this.removeFromArrayField(parentFile, 'children_id', childCrId);

		logger.info('bidirectional-linking', 'Removed child from parent (deletion sync)', {
			parentFile: parentFile.path,
			childFile: childFile.path,
			childName,
			childCrId
		});
	}

	/**
	 * Remove parent reference from a child's father/mother field (handles deletion sync)
	 * When a parent removes a child from their child array, clear the child's father/mother field
	 *
	 * @param childLink Wikilink to child
	 * @param parentFile Parent's file
	 * @param parentName Parent's name
	 * @param parentCrId Parent's cr_id
	 * @param parentSex Parent's sex (male/female) - determines which field to clear
	 */
	private async removeParentFromChild(
		childLink: unknown,
		parentFile: TFile,
		parentName: string,
		parentCrId: string,
		parentSex?: string
	): Promise<void> {
		const childFile = this.resolveLink(childLink, parentFile);
		if (!childFile) {
			logger.warn('bidirectional-linking', 'Child file not found for parent deletion sync', {
				childLink,
				parentFile: parentFile.path
			});
			return;
		}

		// Determine which parent field to clear based on parent's sex
		let parentField: 'father' | 'mother' | undefined;
		let parentIdField: 'father_id' | 'mother_id' | undefined;

		if (parentSex === 'male') {
			parentField = 'father';
			parentIdField = 'father_id';
		} else if (parentSex === 'female') {
			parentField = 'mother';
			parentIdField = 'mother_id';
		} else {
			// Unknown sex - log warning and skip
			logger.debug('bidirectional-linking', 'Parent sex unknown, skipping child parent field removal', {
				parentFile: parentFile.path,
				childFile: childFile.path,
				parentSex
			});
			return;
		}

		// Verify the child's parent field actually points to this parent before clearing
		const childCache = this.app.metadataCache.getFileCache(childFile);
		if (!childCache?.frontmatter) {
			logger.warn('bidirectional-linking', 'Child has no frontmatter for parent removal', {
				childFile: childFile.path
			});
			return;
		}

		const childFm = childCache.frontmatter;
		const existingParent = childFm[parentField];
		const existingParentId = childFm[parentIdField];

		// Check if the child's parent field matches this parent
		const isLinkedByName = existingParent &&
			(String(existingParent).includes(parentName) || String(existingParent).includes(parentFile.basename));
		const isLinkedByCrId = existingParentId === parentCrId;

		if (!isLinkedByName && !isLinkedByCrId) {
			logger.debug('bidirectional-linking', 'Child parent field does not match removed parent, skipping', {
				childFile: childFile.path,
				parentField,
				existingParent,
				existingParentId,
				parentName,
				parentCrId
			});
			return;
		}

		// Remove the parent field and id from the child
		await this.removeField(childFile, parentField);
		await this.removeField(childFile, parentIdField);

		logger.info('bidirectional-linking', 'Removed parent from child (deletion sync)', {
			childFile: childFile.path,
			parentFile: parentFile.path,
			parentField,
			parentName,
			parentCrId
		});
	}

	/**
	 * Remove an adopted child from an adoptive parent's adopted_child arrays (handles deletion sync)
	 */
	private async removeAdoptedChildFromParent(
		adoptiveParentLink: unknown,
		childFile: TFile,
		childName: string,
		childCrId: string
	): Promise<void> {
		const adoptiveParentFile = this.resolveLink(adoptiveParentLink, childFile);
		if (!adoptiveParentFile) {
			logger.warn('bidirectional-linking', 'Adoptive parent file not found for deletion sync', {
				adoptiveParentLink,
				childFile: childFile.path
			});
			return;
		}

		// Remove from both adopted_child and adopted_child_id arrays
		// Try all possible formats: [[name]], [[basename]], [[basename|name]]
		await this.removeFromArrayField(adoptiveParentFile, 'adopted_child', `[[${childName}]]`);
		await this.removeFromArrayField(adoptiveParentFile, 'adopted_child', `[[${childFile.basename}]]`);
		await this.removeFromArrayField(adoptiveParentFile, 'adopted_child', `[[${childFile.basename}|${childName}]]`);
		await this.removeFromArrayField(adoptiveParentFile, 'adopted_child_id', childCrId);

		logger.info('bidirectional-linking', 'Removed adopted child from adoptive parent (deletion sync)', {
			adoptiveParentFile: adoptiveParentFile.path,
			childFile: childFile.path,
			childName,
			childCrId
		});
	}

	/**
	 * Remove a step-child from a step-parent's step_child arrays (handles deletion sync)
	 */
	private async removeStepChildFromParent(
		stepParentLink: unknown,
		childFile: TFile,
		childName: string,
		childCrId: string
	): Promise<void> {
		const stepParentFile = this.resolveLink(stepParentLink, childFile);
		if (!stepParentFile) {
			logger.warn('bidirectional-linking', 'Step-parent file not found for deletion sync', {
				stepParentLink,
				childFile: childFile.path
			});
			return;
		}

		// Remove from both step_child and step_child_id arrays
		// Try all possible formats: [[name]], [[basename]], [[basename|name]]
		await this.removeFromArrayField(stepParentFile, 'step_child', `[[${childName}]]`);
		await this.removeFromArrayField(stepParentFile, 'step_child', `[[${childFile.basename}]]`);
		await this.removeFromArrayField(stepParentFile, 'step_child', `[[${childFile.basename}|${childName}]]`);
		await this.removeFromArrayField(stepParentFile, 'step_child_id', childCrId);

		logger.info('bidirectional-linking', 'Removed step-child from step-parent (deletion sync)', {
			stepParentFile: stepParentFile.path,
			childFile: childFile.path,
			childName,
			childCrId
		});
	}

	/**
	 * Remove spouse link from the other spouse's note (handles deletion sync)
	 */
	private async removeSpouseLink(
		spouseLink: unknown,
		personFile: TFile,
		personName: string,
		personCrId: string
	): Promise<void> {
		const spouseFile = this.resolveLink(spouseLink, personFile);
		if (!spouseFile) {
			logger.warn('bidirectional-linking', 'Spouse file not found for deletion sync', {
				spouseLink,
				personFile: personFile.path
			});
			return;
		}

		const spouseCache = this.app.metadataCache.getFileCache(spouseFile);
		if (!spouseCache?.frontmatter) {
			logger.warn('bidirectional-linking', 'Spouse has no frontmatter for deletion sync', {
				spouseFile: spouseFile.path
			});
			return;
		}

		// Remove from simple spouse/spouse_id arrays
		// Try all possible formats: [[name]], [[basename]], [[basename|name]]
		await this.removeFromArrayField(spouseFile, 'spouse', `[[${personName}]]`);
		await this.removeFromArrayField(spouseFile, 'spouse', `[[${personFile.basename}]]`);
		await this.removeFromArrayField(spouseFile, 'spouse', `[[${personFile.basename}|${personName}]]`);
		await this.removeFromArrayField(spouseFile, 'spouse_id', personCrId);

		// Remove from indexed spouse properties (spouse1, spouse2, etc.)
		for (let i = 1; i <= 10; i++) {
			const key = `spouse${i}`;
			const idKey = `spouse${i}_id`;

			if (spouseCache.frontmatter[idKey] === personCrId) {
				// Remove this indexed spouse entry
				await this.removeField(spouseFile, key);
				await this.removeField(spouseFile, idKey);

				// Also remove associated marriage metadata if present
				await this.removeField(spouseFile, `${key}_marriage_date`);
				await this.removeField(spouseFile, `${key}_marriage_location`);
				await this.removeField(spouseFile, `${key}_divorce_date`);

				logger.info('bidirectional-linking', 'Removed indexed spouse bidirectional link (deletion sync)', {
					spouseFile: spouseFile.path,
					personFile: personFile.path,
					index: i
				});
				break;
			}
		}

		logger.info('bidirectional-linking', 'Removed spouse bidirectional link (deletion sync)', {
			spouseFile: spouseFile.path,
			personFile: personFile.path,
			personName,
			personCrId
		});
	}

	/**
	 * Extract a string link from a frontmatter value that might be string, array, or object
	 * GEDCOM imports may create unexpected data types
	 */
	private extractStringLink(value: unknown): string | null {
		if (typeof value === 'string') {
			return value;
		}
		if (Array.isArray(value) && value.length > 0) {
			// Use first element if it's a string
			if (typeof value[0] === 'string') {
				return value[0];
			}
			// Handle array of objects with link property
			if (value[0] && typeof value[0] === 'object' && 'link' in value[0]) {
				return this.extractStringLink(value[0].link);
			}
		}
		if (value && typeof value === 'object' && 'link' in value) {
			return this.extractStringLink((value as { link: unknown }).link);
		}
		return null;
	}

	/**
	 * Resolve a wikilink to a TFile
	 */
	private resolveLink(link: unknown, sourceFile: TFile): TFile | null {
		// Extract string from potentially complex value
		const stringLink = this.extractStringLink(link);
		if (!stringLink) {
			logger.warn('bidirectional-linking', 'Could not extract string link', {
				linkType: typeof link,
				linkValue: JSON.stringify(link)?.substring(0, 100)
			});
			return null;
		}

		// Remove wikilink brackets and any aliases
		const cleanLink = stringLink.replace(/\[\[|\]\]/g, '').split('|')[0].trim();

		// Try to resolve the link
		const linkedFile = this.app.metadataCache.getFirstLinkpathDest(cleanLink, sourceFile.path);

		return linkedFile instanceof TFile ? linkedFile : null;
	}

	/**
	 * Add a value to an array field in frontmatter
	 * Uses processFrontMatter to safely modify without corrupting other fields
	 */
	private async addToArrayField(
		file: TFile,
		fieldName: string,
		value: string
	): Promise<void> {
		try {
			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				const existing = frontmatter[fieldName];

				if (!existing) {
					// Field doesn't exist, create as array with single value
					frontmatter[fieldName] = [value];
				} else if (Array.isArray(existing)) {
					// Already an array, add to it
					if (!existing.includes(value)) {
						existing.push(value);
					}
				} else {
					// Single value, convert to array
					if (existing !== value) {
						frontmatter[fieldName] = [existing, value];
					}
				}
			});
		} catch (error) {
			logger.error('bidirectional-linking', 'Failed to add to array field', {
				file: file.path,
				fieldName,
				error: getErrorMessage(error)
			});
		}
	}

	/**
	 * Set a field value in frontmatter (replacing existing value)
	 * Uses processFrontMatter to safely modify without corrupting other fields
	 */
	private async setField(
		file: TFile,
		fieldName: string,
		value: string | string[]
	): Promise<void> {
		try {
			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				frontmatter[fieldName] = value;
			});
		} catch (error) {
			logger.error('bidirectional-linking', 'Failed to set field', {
				file: file.path,
				fieldName,
				error: getErrorMessage(error)
			});
		}
	}

	/**
	 * Remove a value from an array field in frontmatter
	 * Uses processFrontMatter to safely modify without corrupting other fields
	 */
	private async removeFromArrayField(
		file: TFile,
		fieldName: string,
		value: string
	): Promise<void> {
		try {
			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				const existing = frontmatter[fieldName];

				if (!existing) {
					// Field doesn't exist, nothing to remove
					return;
				}

				if (Array.isArray(existing)) {
					// Filter out the value (check for exact match and partial match for wikilinks)
					const filtered = existing.filter(item => {
						if (item === value) return false;
						// Also check if item contains the value (for wikilink matching)
						if (typeof item === 'string' && item.includes(value.replace(/\[\[|\]\]/g, ''))) {
							return false;
						}
						return true;
					});

					if (filtered.length === 0) {
						// Array is now empty, remove the field entirely
						delete frontmatter[fieldName];
					} else if (filtered.length !== existing.length) {
						frontmatter[fieldName] = filtered;
					}
				} else if (existing === value || (typeof existing === 'string' && existing.includes(value.replace(/\[\[|\]\]/g, '')))) {
					// Single value matches, remove the field
					delete frontmatter[fieldName];
				}
			});
		} catch (error) {
			logger.error('bidirectional-linking', 'Failed to remove from array field', {
				file: file.path,
				fieldName,
				error: getErrorMessage(error)
			});
		}
	}

	/**
	 * Remove a field entirely from frontmatter
	 * Uses processFrontMatter to safely modify without corrupting other fields
	 */
	private async removeField(
		file: TFile,
		fieldName: string
	): Promise<void> {
		try {
			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				delete frontmatter[fieldName];
			});
		} catch (error) {
			logger.error('bidirectional-linking', 'Failed to remove field', {
				file: file.path,
				fieldName,
				error: getErrorMessage(error)
			});
		}
	}
}
