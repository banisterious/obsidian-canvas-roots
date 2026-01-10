/**
 * Lineage Tracking Service for Charted Roots
 *
 * Computes and tracks multi-generational lineages from marked root persons.
 * Allows filtering and analysis of ancestor/descendant lines in Bases.
 *
 * Key features:
 * - Tag descendants with lineage names (e.g., "Smith Line", "Jones Family")
 * - Support multiple lineages per person (when descending from multiple roots)
 * - Track both maternal and paternal lines separately
 * - Compute patrilineal and matrilineal descent
 */

import { App, TFile } from 'obsidian';
import { FamilyGraphService, PersonNode } from './family-graph';
import { FolderFilterService } from './folder-filter';
import { getLogger } from './logging';

const logger = getLogger('lineage-tracking');

export type LineageType = 'all' | 'patrilineal' | 'matrilineal';

export interface LineageDefinition {
	/** Name of the lineage (e.g., "Smith Line", "Tudor Dynasty") */
	name: string;
	/** cr_id of the root person (progenitor) */
	rootCrId: string;
	/** Type of lineage tracking */
	type: LineageType;
	/** Optional description */
	description?: string;
}

export interface LineageAssignment {
	crId: string;
	file: TFile;
	name: string;
	lineages: string[];
	generation: number;
	pathFromRoot: string[];
}

export interface LineageStats {
	lineageName: string;
	rootPerson: string;
	type: LineageType;
	totalMembers: number;
	maxGeneration: number;
	assignments: LineageAssignment[];
}

/**
 * Service for tracking and managing lineages from root persons
 */
export class LineageTrackingService {
	private app: App;
	private graphService: FamilyGraphService;

	constructor(app: App, folderFilter?: FolderFilterService) {
		this.app = app;
		this.graphService = new FamilyGraphService(app);
		if (folderFilter) {
			this.graphService.setFolderFilter(folderFilter);
		}
	}

	/**
	 * Assign a lineage to all descendants of a root person
	 *
	 * Traverses the descendant tree from the root person and tags each
	 * descendant with the lineage name. Supports patrilineal (father's line),
	 * matrilineal (mother's line), or all descendants.
	 */
	async assignLineage(definition: LineageDefinition): Promise<LineageStats> {
		this.graphService.ensureCacheLoaded();

		const rootPerson = this.graphService.getPersonByCrId(definition.rootCrId);
		if (!rootPerson) {
			throw new Error(`Person with cr_id ${definition.rootCrId} not found`);
		}

		const assignments: LineageAssignment[] = [];
		const visited = new Set<string>();

		// Queue: [person, generation, path from root]
		const queue: Array<{
			person: PersonNode;
			generation: number;
			path: string[];
			fromParent: 'father' | 'mother' | 'root';
		}> = [
			{
				person: rootPerson,
				generation: 0,
				path: [rootPerson.name],
				fromParent: 'root'
			}
		];

		while (queue.length > 0) {
			const { person, generation, path, fromParent } = queue.shift()!;

			if (visited.has(person.crId)) continue;
			visited.add(person.crId);

			// Check lineage type constraints
			// For patrilineal: only include if reached through father (or is root)
			// For matrilineal: only include if reached through mother (or is root)
			if (definition.type === 'patrilineal' && fromParent === 'mother') {
				continue;
			}
			if (definition.type === 'matrilineal' && fromParent === 'father') {
				continue;
			}

			// Get current lineages for this person
			const currentLineages = this.getPersonLineages(person.file);
			const newLineages = currentLineages.includes(definition.name)
				? currentLineages
				: [...currentLineages, definition.name];

			assignments.push({
				crId: person.crId,
				file: person.file,
				name: person.name,
				lineages: newLineages,
				generation,
				pathFromRoot: path
			});

			// Queue children with appropriate lineage type tracking
			for (const childCrId of person.childrenCrIds) {
				const child = this.graphService.getPersonByCrId(childCrId);
				if (child && !visited.has(child.crId)) {
					// Determine if this child comes through father or mother
					const isFromFather = child.fatherCrId === person.crId;
					const isFromMother = child.motherCrId === person.crId;

					// For patrilineal, only follow if person is the father
					// For matrilineal, only follow if person is the mother
					if (definition.type === 'patrilineal' && !isFromFather) {
						continue;
					}
					if (definition.type === 'matrilineal' && !isFromMother) {
						continue;
					}

					queue.push({
						person: child,
						generation: generation + 1,
						path: [...path, child.name],
						fromParent: isFromFather ? 'father' : 'mother'
					});
				}
			}
		}

		// Write lineages to frontmatter
		for (const assignment of assignments) {
			await this.writeLineagesToFrontmatter(assignment.file, assignment.lineages);
		}

		const maxGeneration = assignments.length > 0
			? Math.max(...assignments.map(a => a.generation))
			: 0;

		logger.info('assign-lineage', `Assigned lineage "${definition.name}" to ${assignments.length} descendants of ${rootPerson.name}`);

		return {
			lineageName: definition.name,
			rootPerson: rootPerson.name,
			type: definition.type,
			totalMembers: assignments.length,
			maxGeneration,
			assignments
		};
	}

	/**
	 * Remove a lineage from all people who have it
	 */
	async removeLineage(lineageName: string): Promise<number> {
		this.graphService.ensureCacheLoaded();

		const allPeople = this.graphService.getAllPeople();
		let removedCount = 0;

		for (const person of allPeople) {
			const currentLineages = this.getPersonLineages(person.file);
			if (currentLineages.includes(lineageName)) {
				const newLineages = currentLineages.filter(l => l !== lineageName);
				await this.writeLineagesToFrontmatter(person.file, newLineages);
				removedCount++;
			}
		}

		logger.info('remove-lineage', `Removed lineage "${lineageName}" from ${removedCount} people`);
		return removedCount;
	}

	/**
	 * Get all unique lineages currently assigned in the vault
	 */
	getAllLineages(): string[] {
		this.graphService.ensureCacheLoaded();

		const allPeople = this.graphService.getAllPeople();
		const lineages = new Set<string>();

		for (const person of allPeople) {
			const personLineages = this.getPersonLineages(person.file);
			for (const lineage of personLineages) {
				lineages.add(lineage);
			}
		}

		return Array.from(lineages).sort();
	}

	/**
	 * Get people belonging to a specific lineage
	 */
	getPeopleInLineage(lineageName: string): PersonNode[] {
		this.graphService.ensureCacheLoaded();

		const allPeople = this.graphService.getAllPeople();
		const results: PersonNode[] = [];

		for (const person of allPeople) {
			const personLineages = this.getPersonLineages(person.file);
			if (personLineages.includes(lineageName)) {
				results.push(person);
			}
		}

		return results;
	}

	/**
	 * Find common lineages between two people
	 */
	findCommonLineages(crId1: string, crId2: string): string[] {
		this.graphService.ensureCacheLoaded();

		const person1 = this.graphService.getPersonByCrId(crId1);
		const person2 = this.graphService.getPersonByCrId(crId2);

		if (!person1 || !person2) {
			return [];
		}

		const lineages1 = this.getPersonLineages(person1.file);
		const lineages2 = this.getPersonLineages(person2.file);

		return lineages1.filter(l => lineages2.includes(l));
	}

	/**
	 * Get suggested lineage name based on root person
	 */
	suggestLineageName(person: PersonNode): string {
		// Extract surname if possible (last word of name)
		const nameParts = person.name.trim().split(/\s+/);
		if (nameParts.length > 1) {
			return `${nameParts[nameParts.length - 1]} Line`;
		}
		return `${person.name} Line`;
	}

	/**
	 * Get lineages for a specific person from their frontmatter
	 */
	private getPersonLineages(file: TFile): string[] {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) {
			return [];
		}

		const lineages = cache.frontmatter.lineage;
		if (!lineages) {
			return [];
		}

		if (Array.isArray(lineages)) {
			return lineages.filter(l => typeof l === 'string');
		}

		if (typeof lineages === 'string') {
			return [lineages];
		}

		return [];
	}

	/**
	 * Write lineages to a file's frontmatter
	 */
	private async writeLineagesToFrontmatter(file: TFile, lineages: string[]): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			if (lineages.length === 0) {
				delete frontmatter.lineage;
			} else {
				frontmatter.lineage = lineages;
			}
		});
	}
}

/**
 * Format lineage type for display
 */
export function formatLineageType(type: LineageType): string {
	switch (type) {
		case 'all':
			return 'All descendants';
		case 'patrilineal':
			return 'Patrilineal (father\'s line)';
		case 'matrilineal':
			return 'Matrilineal (mother\'s line)';
	}
}

/**
 * Get description for lineage type
 */
export function getLineageTypeDescription(type: LineageType): string {
	switch (type) {
		case 'all':
			return 'Includes all descendants regardless of parent gender';
		case 'patrilineal':
			return 'Follows father-to-child descent only (traditional surname inheritance)';
		case 'matrilineal':
			return 'Follows mother-to-child descent only (mitochondrial lineage)';
	}
}
