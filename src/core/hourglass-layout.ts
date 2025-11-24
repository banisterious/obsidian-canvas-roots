/**
 * Hourglass Layout Engine
 *
 * Positions the root person at center with ancestors above and descendants below,
 * creating an hourglass visualization that focuses on a single person's lineage.
 */

import { FamilyTree, PersonNode } from './family-graph';
import { LayoutOptions, NodePosition, LayoutResult } from './layout-engine';

/**
 * Hourglass layout engine that positions root at center, ancestors above, descendants below
 */
export class HourglassLayoutEngine {
	/**
	 * Calculates hourglass layout positions
	 *
	 * @param familyTree The family tree to layout
	 * @param options Layout configuration options
	 * @returns Layout result with positioned nodes
	 */
	calculateLayout(
		familyTree: FamilyTree,
		options: LayoutOptions = {}
	): LayoutResult {
		const nodeWidth = options.nodeWidth ?? 250;
		const nodeHeight = options.nodeHeight ?? 120;
		const verticalSpacing = options.nodeSpacingY ?? 200;
		const horizontalSpacing = options.nodeSpacingX ?? 400;

		// Create required options object
		const opts: Required<LayoutOptions> = {
			nodeSpacingX: horizontalSpacing,
			nodeSpacingY: verticalSpacing,
			nodeWidth: nodeWidth,
			nodeHeight: nodeHeight,
			direction: options.direction ?? 'vertical',
			treeType: options.treeType ?? 'descendant',
			layoutType: options.layoutType ?? 'hourglass'
		};

		// Calculate generation numbers relative to root (0 = root, negative = ancestors, positive = descendants)
		const generationMap = this.calculateRelativeGenerations(familyTree);

		// Group nodes by generation
		const generationGroups = this.groupByGeneration(familyTree, generationMap);

		// Calculate positions for each generation
		const positions = this.positionGenerations(
			generationGroups,
			horizontalSpacing,
			verticalSpacing
		);

		return {
			positions,
			options: opts
		};
	}

	/**
	 * Calculate generation numbers relative to root person
	 * Root = 0, parents = -1, children = +1, etc.
	 */
	private calculateRelativeGenerations(familyTree: FamilyTree): Map<string, number> {
		const generations = new Map<string, number>();
		const visited = new Set<string>();

		// Start with root at generation 0
		const queue: Array<{ crId: string; generation: number }> = [
			{ crId: familyTree.root.crId, generation: 0 }
		];

		while (queue.length > 0) {
			const { crId, generation } = queue.shift()!;

			if (visited.has(crId)) continue;
			visited.add(crId);

			generations.set(crId, generation);

			const person = familyTree.nodes.get(crId);
			if (!person) continue;

			// Add parents (generation - 1, ancestors above)
			if (person.fatherCrId && !visited.has(person.fatherCrId)) {
				queue.push({ crId: person.fatherCrId, generation: generation - 1 });
			}
			if (person.motherCrId && !visited.has(person.motherCrId)) {
				queue.push({ crId: person.motherCrId, generation: generation - 1 });
			}

			// Add children (generation + 1, descendants below)
			for (const childCrId of person.childrenCrIds) {
				if (!visited.has(childCrId)) {
					queue.push({ crId: childCrId, generation: generation + 1 });
				}
			}

			// Add spouses (same generation)
			for (const spouseCrId of person.spouseCrIds) {
				if (!visited.has(spouseCrId)) {
					queue.push({ crId: spouseCrId, generation: generation });
				}
			}
		}

		return generations;
	}

	/**
	 * Group nodes by their generation number
	 */
	private groupByGeneration(
		familyTree: FamilyTree,
		generationMap: Map<string, number>
	): Map<number, PersonNode[]> {
		const groups = new Map<number, PersonNode[]>();

		for (const [crId, person] of familyTree.nodes) {
			const generation = generationMap.get(crId) ?? 0;

			if (!groups.has(generation)) {
				groups.set(generation, []);
			}
			groups.get(generation)!.push(person);
		}

		return groups;
	}

	/**
	 * Position all generations, centering them horizontally
	 */
	private positionGenerations(
		generationGroups: Map<number, PersonNode[]>,
		horizontalSpacing: number,
		verticalSpacing: number
	): NodePosition[] {
		const positions: NodePosition[] = [];

		// Sort generations (ancestors first, then root, then descendants)
		const sortedGenerations = Array.from(generationGroups.keys()).sort((a, b) => a - b);

		for (const generation of sortedGenerations) {
			const people = generationGroups.get(generation)!;

			// Calculate Y position (negative for ancestors, positive for descendants)
			const y = generation * verticalSpacing;

			// Position people horizontally, centered
			const generationPositions = this.positionGeneration(
				people,
				generation,
				y,
				horizontalSpacing
			);

			positions.push(...generationPositions);
		}

		return positions;
	}

	/**
	 * Position all people in a single generation, centered horizontally
	 */
	private positionGeneration(
		people: PersonNode[],
		generation: number,
		y: number,
		horizontalSpacing: number
	): NodePosition[] {
		// For simplicity, position each person with consistent spacing
		// This avoids complex couple grouping and ensures even distribution
		const totalPeople = people.length;
		const totalWidth = (totalPeople - 1) * horizontalSpacing;

		// Center the generation horizontally
		const startX = -totalWidth / 2;

		const positions: NodePosition[] = [];

		for (let i = 0; i < people.length; i++) {
			const person = people[i];
			const x = startX + (i * horizontalSpacing);

			positions.push({
				crId: person.crId,
				person: person,
				x,
				y,
				generation
			});
		}

		return positions;
	}
}
