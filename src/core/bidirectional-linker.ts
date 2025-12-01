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
	spouse?: string | string[];
	children?: string | string[];
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

	constructor(private app: App) {}

	/**
	 * Set the folder filter service for filtering person notes by folder
	 */
	setFolderFilter(folderFilter: FolderFilterService): void {
		this.folderFilter = folderFilter;
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
	 * Update the relationship snapshot for a person
	 */
	private updateSnapshot(filePath: string, frontmatter: PersonFrontmatter): void {
		const snapshot: RelationshipSnapshot = {
			father: frontmatter.father,
			mother: frontmatter.mother,
			spouse: frontmatter.spouse,
			children: frontmatter.children
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
		relationshipType: 'father' | 'mother'
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

		// Also check wikilinks for backward compatibility
		const childLinkText = `[[${childName}]]`;
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

		// Add child to parent's children arrays (dual storage)
		await this.addToArrayField(parentFile, 'children', childLinkText);
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

		const personLinkText = `[[${personName}]]`;

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

		// Remove from both children and children_id arrays
		await this.removeFromArrayField(parentFile, 'children', `[[${childName}]]`);
		await this.removeFromArrayField(parentFile, 'children', `[[${childFile.basename}]]`); // Handle basename variant
		await this.removeFromArrayField(parentFile, 'children_id', childCrId);

		logger.info('bidirectional-linking', 'Removed child from parent (deletion sync)', {
			parentFile: parentFile.path,
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
		await this.removeFromArrayField(spouseFile, 'spouse', `[[${personName}]]`);
		await this.removeFromArrayField(spouseFile, 'spouse', `[[${personFile.basename}]]`); // Handle basename variant
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
	private resolveLink(link: string | unknown, sourceFile: TFile): TFile | null {
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
	 */
	private async addToArrayField(
		file: TFile,
		fieldName: string,
		value: string
	): Promise<void> {
		const content = await this.app.vault.read(file);
		const lines = content.split('\n');

		// Find frontmatter boundaries
		let frontmatterStart = -1;
		let frontmatterEnd = -1;

		for (let i = 0; i < lines.length; i++) {
			if (lines[i].trim() === '---') {
				if (frontmatterStart === -1) {
					frontmatterStart = i;
				} else {
					frontmatterEnd = i;
					break;
				}
			}
		}

		if (frontmatterStart === -1 || frontmatterEnd === -1) {
			logger.error('bidirectional-linking', 'Could not find frontmatter', {
				file: file.path
			});
			return;
		}

		// Find the field or insert it
		let fieldLineIndex = -1;
		let isArrayField = false;

		for (let i = frontmatterStart + 1; i < frontmatterEnd; i++) {
			const line = lines[i];
			if (line.startsWith(`${fieldName}:`)) {
				fieldLineIndex = i;
				// Check if it's already an array
				isArrayField = line.trim().endsWith(':') || line.includes('[');
				break;
			}
		}

		if (fieldLineIndex === -1) {
			// Field doesn't exist, create it as array with single value
			lines.splice(frontmatterEnd, 0, `${fieldName}:`, `  - ${value}`);
		} else if (!isArrayField) {
			// Field exists as single value, convert to array
			const existingValue = lines[fieldLineIndex].split(':')[1].trim();
			lines[fieldLineIndex] = `${fieldName}:`;
			lines.splice(fieldLineIndex + 1, 0, `  - ${existingValue}`, `  - ${value}`);
		} else {
			// Field exists as array, add to end
			// Find the last array item
			let lastArrayLine = fieldLineIndex;
			for (let i = fieldLineIndex + 1; i < frontmatterEnd; i++) {
				if (lines[i].trim().startsWith('- ')) {
					lastArrayLine = i;
				} else if (!lines[i].trim().startsWith('#')) {
					// Not a comment, must be next field
					break;
				}
			}
			lines.splice(lastArrayLine + 1, 0, `  - ${value}`);
		}

		// Write back
		await this.app.vault.modify(file, lines.join('\n'));
	}

	/**
	 * Set a field value in frontmatter (replacing existing value)
	 */
	private async setField(
		file: TFile,
		fieldName: string,
		value: string | string[]
	): Promise<void> {
		const content = await this.app.vault.read(file);
		const lines = content.split('\n');

		// Find frontmatter boundaries
		let frontmatterStart = -1;
		let frontmatterEnd = -1;

		for (let i = 0; i < lines.length; i++) {
			if (lines[i].trim() === '---') {
				if (frontmatterStart === -1) {
					frontmatterStart = i;
				} else {
					frontmatterEnd = i;
					break;
				}
			}
		}

		if (frontmatterStart === -1 || frontmatterEnd === -1) {
			logger.error('bidirectional-linking', 'Could not find frontmatter', {
				file: file.path
			});
			return;
		}

		// Find and remove existing field
		for (let i = frontmatterStart + 1; i < frontmatterEnd; i++) {
			if (lines[i].startsWith(`${fieldName}:`)) {
				// Remove field and its array items if any
				let j = i + 1;
				while (j < frontmatterEnd && lines[j].trim().startsWith('- ')) {
					j++;
				}
				lines.splice(i, j - i);
				frontmatterEnd -= (j - i);
				break;
			}
		}

		// Add new field value
		if (Array.isArray(value)) {
			const newLines = [`${fieldName}:`];
			value.forEach(v => newLines.push(`  - ${v}`));
			lines.splice(frontmatterEnd, 0, ...newLines);
		} else {
			lines.splice(frontmatterEnd, 0, `${fieldName}: ${value}`);
		}

		// Write back
		await this.app.vault.modify(file, lines.join('\n'));
	}

	/**
	 * Remove a value from an array field in frontmatter
	 */
	private async removeFromArrayField(
		file: TFile,
		fieldName: string,
		value: string
	): Promise<void> {
		const content = await this.app.vault.read(file);
		const lines = content.split('\n');

		// Find frontmatter boundaries
		let frontmatterStart = -1;
		let frontmatterEnd = -1;

		for (let i = 0; i < lines.length; i++) {
			if (lines[i].trim() === '---') {
				if (frontmatterStart === -1) {
					frontmatterStart = i;
				} else {
					frontmatterEnd = i;
					break;
				}
			}
		}

		if (frontmatterStart === -1 || frontmatterEnd === -1) {
			logger.error('bidirectional-linking', 'Could not find frontmatter for removal', {
				file: file.path
			});
			return;
		}

		// Find the field
		let fieldLineIndex = -1;
		for (let i = frontmatterStart + 1; i < frontmatterEnd; i++) {
			if (lines[i].startsWith(`${fieldName}:`)) {
				fieldLineIndex = i;
				break;
			}
		}

		if (fieldLineIndex === -1) {
			// Field doesn't exist, nothing to remove
			return;
		}

		// Check if it's an array field
		const fieldLine = lines[fieldLineIndex];
		const isArrayField = fieldLine.trim().endsWith(':') || fieldLine.includes('[');

		if (isArrayField) {
			// Remove the specific value from array
			const linesToRemove: number[] = [];

			for (let i = fieldLineIndex + 1; i < frontmatterEnd; i++) {
				const line = lines[i].trim();
				if (line.startsWith('- ')) {
					// Check if this line contains the value to remove
					if (line.includes(value)) {
						linesToRemove.push(i);
					}
				} else if (!line.startsWith('#')) {
					// Not a comment, must be next field
					break;
				}
			}

			// Remove lines in reverse order to maintain indices
			for (let i = linesToRemove.length - 1; i >= 0; i--) {
				lines.splice(linesToRemove[i], 1);
			}

			// Check if array is now empty and remove field entirely if so
			const remainingItems = [];
			for (let i = fieldLineIndex + 1; i < lines.length; i++) {
				if (lines[i].trim().startsWith('- ')) {
					remainingItems.push(i);
				} else if (!lines[i].trim().startsWith('#') && lines[i].trim() !== '---') {
					break;
				}
			}

			if (remainingItems.length === 0) {
				// Array is empty, remove the field entirely
				lines.splice(fieldLineIndex, 1);
			}
		} else {
			// Single value field - check if it matches and remove if so
			const fieldValue = fieldLine.split(':')[1]?.trim();
			if (fieldValue === value) {
				lines.splice(fieldLineIndex, 1);
			}
		}

		// Write back
		await this.app.vault.modify(file, lines.join('\n'));
	}

	/**
	 * Remove a field entirely from frontmatter
	 */
	private async removeField(
		file: TFile,
		fieldName: string
	): Promise<void> {
		const content = await this.app.vault.read(file);
		const lines = content.split('\n');

		// Find frontmatter boundaries
		let frontmatterStart = -1;
		let frontmatterEnd = -1;

		for (let i = 0; i < lines.length; i++) {
			if (lines[i].trim() === '---') {
				if (frontmatterStart === -1) {
					frontmatterStart = i;
				} else {
					frontmatterEnd = i;
					break;
				}
			}
		}

		if (frontmatterStart === -1 || frontmatterEnd === -1) {
			logger.error('bidirectional-linking', 'Could not find frontmatter for field removal', {
				file: file.path
			});
			return;
		}

		// Find and remove the field and its array items if any
		for (let i = frontmatterStart + 1; i < frontmatterEnd; i++) {
			if (lines[i].startsWith(`${fieldName}:`)) {
				// Found the field, remove it and any array items
				let j = i + 1;
				while (j < frontmatterEnd && lines[j].trim().startsWith('- ')) {
					j++;
				}
				lines.splice(i, j - i);
				break;
			}
		}

		// Write back
		await this.app.vault.modify(file, lines.join('\n'));
	}
}
