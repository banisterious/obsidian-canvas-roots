/**
 * Relationship Calculator
 *
 * Calculates the relationship between two people in the family graph
 * using BFS pathfinding and genealogical relationship naming conventions.
 */

import { App } from 'obsidian';
import { FamilyGraphService, PersonNode } from './family-graph';
import { FolderFilterService } from './folder-filter';
import { getLogger } from './logging';

const logger = getLogger('RelationshipCalculator');

/**
 * Represents a step in the relationship path
 */
export interface RelationshipStep {
	person: PersonNode;
	relationship: 'father' | 'mother' | 'spouse' | 'child' | 'start';
	direction: 'up' | 'down' | 'lateral' | 'start';
}

/**
 * Result of a relationship calculation
 */
export interface RelationshipResult {
	personA: PersonNode;
	personB: PersonNode;
	path: RelationshipStep[];
	relationshipDescription: string;
	commonAncestor?: PersonNode;
	generationsUp: number;
	generationsDown: number;
	isDirectLine: boolean;
	isBloodRelation: boolean;
}

/**
 * Service for calculating relationships between people
 */
export class RelationshipCalculator {
	private app: App;
	private familyGraph: FamilyGraphService;

	constructor(app: App, folderFilter?: FolderFilterService) {
		this.app = app;
		this.familyGraph = new FamilyGraphService(app);
		if (folderFilter) {
			this.familyGraph.setFolderFilter(folderFilter);
		}
	}

	/**
	 * Calculate the relationship between two people
	 */
	calculateRelationship(
		personACrId: string,
		personBCrId: string
	): RelationshipResult | null {
		// Load the family graph
		this.familyGraph.ensureCacheLoaded();

		const personA = this.familyGraph.getPersonByCrId(personACrId);
		const personB = this.familyGraph.getPersonByCrId(personBCrId);

		if (!personA || !personB) {
			logger.warn('calculate-relationship', 'Person not found', {
				personACrId,
				personBCrId,
				foundA: !!personA,
				foundB: !!personB
			});
			return null;
		}

		if (personACrId === personBCrId) {
			return {
				personA,
				personB,
				path: [{ person: personA, relationship: 'start', direction: 'start' }],
				relationshipDescription: 'Same person',
				generationsUp: 0,
				generationsDown: 0,
				isDirectLine: true,
				isBloodRelation: true
			};
		}

		// Find path using BFS
		const path = this.findPath(personA, personB);

		if (!path || path.length === 0) {
			return {
				personA,
				personB,
				path: [],
				relationshipDescription: 'Not related',
				generationsUp: 0,
				generationsDown: 0,
				isDirectLine: false,
				isBloodRelation: false
			};
		}

		// Analyze the path to determine relationship
		const analysis = this.analyzePath(path);

		return {
			personA,
			personB,
			path,
			relationshipDescription: analysis.description,
			commonAncestor: analysis.commonAncestor,
			generationsUp: analysis.generationsUp,
			generationsDown: analysis.generationsDown,
			isDirectLine: analysis.isDirectLine,
			isBloodRelation: analysis.isBloodRelation
		};
	}

	/**
	 * Find the shortest path between two people using BFS
	 */
	private findPath(personA: PersonNode, personB: PersonNode): RelationshipStep[] | null {
		interface QueueItem {
			person: PersonNode;
			path: RelationshipStep[];
		}

		const visited = new Set<string>();
		const queue: QueueItem[] = [{
			person: personA,
			path: [{ person: personA, relationship: 'start', direction: 'start' }]
		}];

		visited.add(personA.crId);

		while (queue.length > 0) {
			const current = queue.shift()!;

			// Check if we found the target
			if (current.person.crId === personB.crId) {
				return current.path;
			}

			// Explore parents (going up)
			if (current.person.fatherCrId) {
				const father = this.familyGraph.getPersonByCrId(current.person.fatherCrId);
				if (father && !visited.has(father.crId)) {
					visited.add(father.crId);
					queue.push({
						person: father,
						path: [...current.path, { person: father, relationship: 'father', direction: 'up' }]
					});
				}
			}

			if (current.person.motherCrId) {
				const mother = this.familyGraph.getPersonByCrId(current.person.motherCrId);
				if (mother && !visited.has(mother.crId)) {
					visited.add(mother.crId);
					queue.push({
						person: mother,
						path: [...current.path, { person: mother, relationship: 'mother', direction: 'up' }]
					});
				}
			}

			// Explore children (going down)
			for (const childCrId of current.person.childrenCrIds) {
				const child = this.familyGraph.getPersonByCrId(childCrId);
				if (child && !visited.has(child.crId)) {
					visited.add(child.crId);
					queue.push({
						person: child,
						path: [...current.path, { person: child, relationship: 'child', direction: 'down' }]
					});
				}
			}

			// Explore spouses (lateral)
			for (const spouseCrId of current.person.spouseCrIds) {
				const spouse = this.familyGraph.getPersonByCrId(spouseCrId);
				if (spouse && !visited.has(spouse.crId)) {
					visited.add(spouse.crId);
					queue.push({
						person: spouse,
						path: [...current.path, { person: spouse, relationship: 'spouse', direction: 'lateral' }]
					});
				}
			}
		}

		return null; // No path found
	}

	/**
	 * Analyze a path to determine the relationship description
	 */
	private analyzePath(path: RelationshipStep[]): {
		description: string;
		commonAncestor?: PersonNode;
		generationsUp: number;
		generationsDown: number;
		isDirectLine: boolean;
		isBloodRelation: boolean;
	} {
		// Count generations up and down, track spouse connections
		let generationsUp = 0;
		let generationsDown = 0;
		let hasSpouseConnection = false;
		let commonAncestorIndex = -1;

		// Find where the path changes direction (common ancestor)
		let direction: 'up' | 'down' | null = null;

		for (let i = 1; i < path.length; i++) {
			const step = path[i];

			if (step.direction === 'up') {
				if (direction === 'down') {
					// Changed direction - this shouldn't happen in a proper path
					// but handle it gracefully
				}
				direction = 'up';
				generationsUp++;
				commonAncestorIndex = i;
			} else if (step.direction === 'down') {
				if (direction === 'up' && commonAncestorIndex === -1) {
					commonAncestorIndex = i - 1;
				}
				direction = 'down';
				generationsDown++;
			} else if (step.direction === 'lateral') {
				hasSpouseConnection = true;
			}
		}

		// If we only went up, the common ancestor is the last person
		if (generationsUp > 0 && generationsDown === 0 && commonAncestorIndex === -1) {
			commonAncestorIndex = path.length - 1;
		}

		const commonAncestor = commonAncestorIndex >= 0 ? path[commonAncestorIndex].person : undefined;
		const isDirectLine = generationsUp === 0 || generationsDown === 0;
		const isBloodRelation = !hasSpouseConnection || (generationsUp > 0 || generationsDown > 0);

		// Generate description
		const description = this.generateRelationshipDescription(
			generationsUp,
			generationsDown,
			hasSpouseConnection,
			path
		);

		return {
			description,
			commonAncestor,
			generationsUp,
			generationsDown,
			isDirectLine,
			isBloodRelation
		};
	}

	/**
	 * Generate a human-readable relationship description
	 */
	private generateRelationshipDescription(
		generationsUp: number,
		generationsDown: number,
		hasSpouseConnection: boolean,
		path: RelationshipStep[]
	): string {
		// Direct spouse relationship
		if (generationsUp === 0 && generationsDown === 0 && hasSpouseConnection) {
			return 'Spouse';
		}

		// Direct line ancestors
		if (generationsUp > 0 && generationsDown === 0 && !hasSpouseConnection) {
			return this.getAncestorTerm(generationsUp);
		}

		// Direct line descendants
		if (generationsUp === 0 && generationsDown > 0 && !hasSpouseConnection) {
			return this.getDescendantTerm(generationsDown, path);
		}

		// Siblings (same parents)
		if (generationsUp === 1 && generationsDown === 1 && !hasSpouseConnection) {
			return 'Sibling';
		}

		// Aunts/Uncles and Nieces/Nephews
		if (generationsUp === 1 && generationsDown === 2 && !hasSpouseConnection) {
			return 'Niece/Nephew';
		}
		if (generationsUp === 2 && generationsDown === 1 && !hasSpouseConnection) {
			return 'Aunt/Uncle';
		}

		// Cousins
		if (generationsUp > 1 && generationsDown > 1 && !hasSpouseConnection) {
			return this.getCousinTerm(generationsUp, generationsDown);
		}

		// Great aunts/uncles and grand nieces/nephews
		if (generationsUp > 1 && generationsDown === 1 && !hasSpouseConnection) {
			const greats = generationsUp - 2;
			const prefix = greats > 0 ? 'Great-'.repeat(greats) : '';
			return `${prefix}Grand Aunt/Uncle`;
		}
		if (generationsUp === 1 && generationsDown > 2 && !hasSpouseConnection) {
			const greats = generationsDown - 2;
			const prefix = greats > 0 ? 'Great-'.repeat(greats) : '';
			return `${prefix}Grand Niece/Nephew`;
		}

		// In-laws (spouse connections with generational differences)
		if (hasSpouseConnection) {
			if (generationsUp === 1 && generationsDown === 0) {
				return 'Parent-in-law';
			}
			if (generationsUp === 0 && generationsDown === 1) {
				return 'Child-in-law';
			}
			if (generationsUp === 1 && generationsDown === 1) {
				return 'Sibling-in-law';
			}
			return 'Related by marriage';
		}

		// Fallback for complex relationships
		return `Related (${generationsUp} gen. up, ${generationsDown} gen. down)`;
	}

	/**
	 * Get the term for a direct ancestor
	 */
	private getAncestorTerm(generations: number): string {
		switch (generations) {
			case 1: return 'Parent';
			case 2: return 'Grandparent';
			case 3: return 'Great-Grandparent';
			default: {
				const greats = generations - 2;
				return 'Great-'.repeat(greats) + 'Grandparent';
			}
		}
	}

	/**
	 * Get the term for a direct descendant
	 */
	private getDescendantTerm(generations: number, path: RelationshipStep[]): string {
		// Try to determine gender from the final person if available
		switch (generations) {
			case 1: return 'Child';
			case 2: return 'Grandchild';
			case 3: return 'Great-Grandchild';
			default: {
				const greats = generations - 2;
				return 'Great-'.repeat(greats) + 'Grandchild';
			}
		}
	}

	/**
	 * Get the cousin term with proper ordinal and removal
	 */
	private getCousinTerm(generationsUp: number, generationsDown: number): string {
		// Cousin degree is based on the minimum generations from common ancestor
		const minGen = Math.min(generationsUp, generationsDown) - 1;
		const removal = Math.abs(generationsUp - generationsDown);

		const ordinal = this.getOrdinal(minGen);
		const removalText = removal > 0
			? ` ${removal}${removal === 1 ? ' time' : ' times'} removed`
			: '';

		return `${ordinal} Cousin${removalText}`;
	}

	/**
	 * Get ordinal string for a number
	 */
	private getOrdinal(n: number): string {
		if (n === 1) return '1st';
		if (n === 2) return '2nd';
		if (n === 3) return '3rd';
		return `${n}th`;
	}

	/**
	 * Get the FamilyGraphService for external access
	 */
	getFamilyGraph(): FamilyGraphService {
		return this.familyGraph;
	}
}
