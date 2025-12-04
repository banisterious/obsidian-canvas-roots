/**
 * Reference Numbering Systems for Genealogical Data
 *
 * Implements standard genealogical numbering systems:
 * - Ahnentafel: Ancestor numbering (Self=1, Father=2, Mother=3, PGF=4, etc.)
 * - d'Aboville: Descendant numbering with dots (1, 1.1, 1.2, 1.1.1, etc.)
 * - Henry: Compact descendant numbering without dots (1, 11, 12, 111, etc.)
 */

import { App, TFile } from 'obsidian';
import { FamilyGraphService, PersonNode } from './family-graph';
import { FolderFilterService } from './folder-filter';
import { getLogger } from './logging';

const logger = getLogger('reference-numbering');

export type NumberingSystem = 'ahnentafel' | 'daboville' | 'henry' | 'generation';

export interface NumberingResult {
	crId: string;
	file: TFile;
	name: string;
	number: string | number;
}

export interface NumberingStats {
	system: NumberingSystem;
	rootPerson: string;
	totalAssigned: number;
	results: NumberingResult[];
}

/**
 * Service for assigning genealogical reference numbers to person notes
 */
export class ReferenceNumberingService {
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
	 * Assign Ahnentafel numbers to all ancestors of a person
	 *
	 * Ahnentafel (German for "ancestor table") numbering:
	 * - Self = 1
	 * - Father = 2n (where n is person's number)
	 * - Mother = 2n + 1
	 *
	 * Example: Self=1, Father=2, Mother=3, PGF=4, PGM=5, MGF=6, MGM=7
	 */
	async assignAhnentafel(rootCrId: string): Promise<NumberingStats> {
		this.graphService.ensureCacheLoaded();

		const rootPerson = this.graphService.getPersonByCrId(rootCrId);
		if (!rootPerson) {
			throw new Error(`Person with cr_id ${rootCrId} not found`);
		}

		const results: NumberingResult[] = [];
		const queue: Array<{ person: PersonNode; number: number }> = [
			{ person: rootPerson, number: 1 }
		];

		const visited = new Set<string>();

		while (queue.length > 0) {
			const { person, number } = queue.shift()!;

			if (visited.has(person.crId)) continue;
			visited.add(person.crId);

			// Assign number to this person
			results.push({
				crId: person.crId,
				file: person.file,
				name: person.name,
				number: number
			});

			// Queue father (2n)
			if (person.fatherCrId) {
				const father = this.graphService.getPersonByCrId(person.fatherCrId);
				if (father && !visited.has(father.crId)) {
					queue.push({ person: father, number: number * 2 });
				}
			}

			// Queue mother (2n + 1)
			if (person.motherCrId) {
				const mother = this.graphService.getPersonByCrId(person.motherCrId);
				if (mother && !visited.has(mother.crId)) {
					queue.push({ person: mother, number: number * 2 + 1 });
				}
			}
		}

		// Write numbers to frontmatter
		for (const result of results) {
			await this.writeNumberToFrontmatter(result.file, 'ahnentafel', result.number);
		}

		logger.info('ahnentafel', `Assigned Ahnentafel numbers to ${results.length} ancestors of ${rootPerson.name}`);

		return {
			system: 'ahnentafel',
			rootPerson: rootPerson.name,
			totalAssigned: results.length,
			results
		};
	}

	/**
	 * Assign d'Aboville numbers to all descendants of a person
	 *
	 * d'Aboville numbering uses dots to separate generations:
	 * - Root = 1
	 * - Children = 1.1, 1.2, 1.3 (by birth order)
	 * - Grandchildren = 1.1.1, 1.1.2, 1.2.1, etc.
	 */
	async assignDAboville(rootCrId: string): Promise<NumberingStats> {
		this.graphService.ensureCacheLoaded();

		const rootPerson = this.graphService.getPersonByCrId(rootCrId);
		if (!rootPerson) {
			throw new Error(`Person with cr_id ${rootCrId} not found`);
		}

		const results: NumberingResult[] = [];
		const visited = new Set<string>();

		// Recursive function to assign numbers
		const assignNumbers = (person: PersonNode, prefix: string): void => {
			if (visited.has(person.crId)) return;
			visited.add(person.crId);

			results.push({
				crId: person.crId,
				file: person.file,
				name: person.name,
				number: prefix
			});

			// Get children and sort by birth date if available
			const children = this.getSortedChildren(person);

			children.forEach((child, index) => {
				const childNumber = prefix === '1' ? `1.${index + 1}` : `${prefix}.${index + 1}`;
				assignNumbers(child, childNumber);
			});
		};

		assignNumbers(rootPerson, '1');

		// Write numbers to frontmatter
		for (const result of results) {
			await this.writeNumberToFrontmatter(result.file, 'daboville', result.number);
		}

		logger.info('daboville', `Assigned d'Aboville numbers to ${results.length} descendants of ${rootPerson.name}`);

		return {
			system: 'daboville',
			rootPerson: rootPerson.name,
			totalAssigned: results.length,
			results
		};
	}

	/**
	 * Assign Henry numbers to all descendants of a person
	 *
	 * Henry System is a compact version without dots:
	 * - Root = 1
	 * - Children = 11, 12, 13 (first digit is parent, second is child number)
	 * - Grandchildren = 111, 112, 121, etc.
	 *
	 * For children 10+, letters are used: A=10, B=11, etc.
	 */
	async assignHenry(rootCrId: string): Promise<NumberingStats> {
		this.graphService.ensureCacheLoaded();

		const rootPerson = this.graphService.getPersonByCrId(rootCrId);
		if (!rootPerson) {
			throw new Error(`Person with cr_id ${rootCrId} not found`);
		}

		const results: NumberingResult[] = [];
		const visited = new Set<string>();

		// Helper to convert child index to Henry digit
		const toHenryDigit = (index: number): string => {
			if (index < 10) return index.toString();
			// Use letters for 10+ (A=10, B=11, etc.)
			return String.fromCharCode(65 + (index - 10));
		};

		// Recursive function to assign numbers
		const assignNumbers = (person: PersonNode, prefix: string): void => {
			if (visited.has(person.crId)) return;
			visited.add(person.crId);

			results.push({
				crId: person.crId,
				file: person.file,
				name: person.name,
				number: prefix
			});

			// Get children and sort by birth date if available
			const children = this.getSortedChildren(person);

			children.forEach((child, index) => {
				const childNumber = `${prefix}${toHenryDigit(index + 1)}`;
				assignNumbers(child, childNumber);
			});
		};

		assignNumbers(rootPerson, '1');

		// Write numbers to frontmatter
		for (const result of results) {
			await this.writeNumberToFrontmatter(result.file, 'henry', result.number);
		}

		logger.info('henry', `Assigned Henry numbers to ${results.length} descendants of ${rootPerson.name}`);

		return {
			system: 'henry',
			rootPerson: rootPerson.name,
			totalAssigned: results.length,
			results
		};
	}

	/**
	 * Assign generation numbers relative to a reference person
	 *
	 * Generation numbering shows distance from a reference person:
	 * - Self = 0
	 * - Parents = -1, Grandparents = -2, etc.
	 * - Children = 1, Grandchildren = 2, etc.
	 *
	 * This traverses both ancestors and descendants from the root.
	 */
	async assignGeneration(rootCrId: string): Promise<NumberingStats> {
		this.graphService.ensureCacheLoaded();

		const rootPerson = this.graphService.getPersonByCrId(rootCrId);
		if (!rootPerson) {
			throw new Error(`Person with cr_id ${rootCrId} not found`);
		}

		const results: NumberingResult[] = [];
		const visited = new Set<string>();

		// Assign root person generation 0
		results.push({
			crId: rootPerson.crId,
			file: rootPerson.file,
			name: rootPerson.name,
			number: 0
		});
		visited.add(rootPerson.crId);

		// Traverse ancestors (negative generations)
		const ancestorQueue: Array<{ person: PersonNode; generation: number }> = [];
		if (rootPerson.fatherCrId) {
			const father = this.graphService.getPersonByCrId(rootPerson.fatherCrId);
			if (father) ancestorQueue.push({ person: father, generation: -1 });
		}
		if (rootPerson.motherCrId) {
			const mother = this.graphService.getPersonByCrId(rootPerson.motherCrId);
			if (mother) ancestorQueue.push({ person: mother, generation: -1 });
		}

		while (ancestorQueue.length > 0) {
			const { person, generation } = ancestorQueue.shift()!;

			if (visited.has(person.crId)) continue;
			visited.add(person.crId);

			results.push({
				crId: person.crId,
				file: person.file,
				name: person.name,
				number: generation
			});

			// Queue parents (one generation further back)
			if (person.fatherCrId) {
				const father = this.graphService.getPersonByCrId(person.fatherCrId);
				if (father && !visited.has(father.crId)) {
					ancestorQueue.push({ person: father, generation: generation - 1 });
				}
			}
			if (person.motherCrId) {
				const mother = this.graphService.getPersonByCrId(person.motherCrId);
				if (mother && !visited.has(mother.crId)) {
					ancestorQueue.push({ person: mother, generation: generation - 1 });
				}
			}
		}

		// Traverse descendants (positive generations)
		const descendantQueue: Array<{ person: PersonNode; generation: number }> = [];
		for (const childCrId of rootPerson.childrenCrIds) {
			const child = this.graphService.getPersonByCrId(childCrId);
			if (child && !visited.has(child.crId)) {
				descendantQueue.push({ person: child, generation: 1 });
			}
		}

		while (descendantQueue.length > 0) {
			const { person, generation } = descendantQueue.shift()!;

			if (visited.has(person.crId)) continue;
			visited.add(person.crId);

			results.push({
				crId: person.crId,
				file: person.file,
				name: person.name,
				number: generation
			});

			// Queue children (one generation forward)
			for (const childCrId of person.childrenCrIds) {
				const child = this.graphService.getPersonByCrId(childCrId);
				if (child && !visited.has(child.crId)) {
					descendantQueue.push({ person: child, generation: generation + 1 });
				}
			}
		}

		// Write numbers to frontmatter
		for (const result of results) {
			await this.writeNumberToFrontmatter(result.file, 'generation', result.number);
		}

		logger.info('generation', `Assigned generation numbers to ${results.length} relatives of ${rootPerson.name}`);

		return {
			system: 'generation',
			rootPerson: rootPerson.name,
			totalAssigned: results.length,
			results
		};
	}

	/**
	 * Clear reference numbers of a specific type from all notes
	 */
	async clearNumbers(system: NumberingSystem): Promise<number> {
		this.graphService.ensureCacheLoaded();

		const allPeople = this.graphService.getAllPeople();
		let clearedCount = 0;

		for (const person of allPeople) {
			const cleared = await this.clearNumberFromFrontmatter(person.file, system);
			if (cleared) clearedCount++;
		}

		logger.info('clear', `Cleared ${clearedCount} ${system} numbers`);
		return clearedCount;
	}

	/**
	 * Get sorted children of a person by birth date
	 */
	private getSortedChildren(person: PersonNode): PersonNode[] {
		const children: PersonNode[] = [];

		for (const childCrId of person.childrenCrIds) {
			const child = this.graphService.getPersonByCrId(childCrId);
			if (child) {
				children.push(child);
			}
		}

		// Sort by birth date if available, otherwise by name
		children.sort((a, b) => {
			if (a.birthDate && b.birthDate) {
				return a.birthDate.localeCompare(b.birthDate);
			}
			if (a.birthDate) return -1;
			if (b.birthDate) return 1;
			return a.name.localeCompare(b.name);
		});

		return children;
	}

	/**
	 * Write a reference number to a file's frontmatter
	 */
	private async writeNumberToFrontmatter(
		file: TFile,
		system: NumberingSystem,
		number: string | number
	): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			frontmatter[system] = number;
		});
	}

	/**
	 * Clear a reference number from a file's frontmatter
	 */
	private async clearNumberFromFrontmatter(
		file: TFile,
		system: NumberingSystem
	): Promise<boolean> {
		let hadNumber = false;

		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			if (frontmatter[system] !== undefined) {
				hadNumber = true;
				delete frontmatter[system];
			}
		});

		return hadNumber;
	}
}

/**
 * Format a numbering result for display
 */
export function formatNumberingResult(result: NumberingResult, system: NumberingSystem): string {
	switch (system) {
		case 'ahnentafel':
			return `${result.name}: #${result.number}`;
		case 'daboville':
			return `${result.name}: ${result.number}`;
		case 'henry':
			return `${result.name}: ${result.number}`;
		case 'generation':
			return `${result.name}: Gen ${result.number}`;
	}
}

/**
 * Get a human-readable description of a numbering system
 */
export function getSystemDescription(system: NumberingSystem): string {
	switch (system) {
		case 'ahnentafel':
			return 'Ahnentafel (ancestor numbering: self=1, father=2, mother=3, etc.)';
		case 'daboville':
			return "d'Aboville (descendant numbering: 1, 1.1, 1.2, 1.1.1, etc.)";
		case 'henry':
			return 'Henry (compact descendant: 1, 11, 12, 111, etc.)';
		case 'generation':
			return 'Generation (relative: 0=self, -1=parents, +1=children)';
	}
}
