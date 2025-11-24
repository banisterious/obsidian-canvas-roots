/**
 * Timeline Layout Engine
 *
 * Positions people horizontally by birth year, creating a chronological timeline view.
 * Useful for seeing which family members were alive during the same time period.
 */

import { FamilyTree, PersonNode } from './family-graph';
import { LayoutOptions, NodePosition, LayoutResult } from './layout-engine';

/**
 * Timeline layout engine that positions nodes by birth year
 */
export class TimelineLayoutEngine {
	/**
	 * Calculates timeline layout positions
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
			layoutType: options.layoutType ?? 'timeline'
		};

		// Extract birth years and calculate range
		const yearData = this.extractBirthYears(familyTree);
		if (yearData.validYears.length === 0) {
			// No birth dates available - fall back to generation-based layout
			return this.fallbackLayout(familyTree, opts);
		}

		// Create scale from years to X coordinates
		const yearScale = this.createYearScale(
			yearData.minYear,
			yearData.maxYear,
			horizontalSpacing
		);

		// Calculate generation numbers for Y-axis
		const generationMap = this.calculateGenerations(familyTree);

		// Position nodes
		const positions: NodePosition[] = [];
		const positionedByYear: Map<number, NodePosition[]> = new Map();

		for (const [crId, person] of familyTree.nodes) {
			const birthYear = this.extractYear(person.birthDate);
			const generation = generationMap.get(crId) ?? 0;

			let x: number;
			if (birthYear !== null) {
				x = yearScale(birthYear);
			} else {
				// No birth date - position based on parents' or children's dates
				x = this.estimatePosition(person, familyTree, yearScale);
			}

			// Initial Y position based on generation
			const y = generation * verticalSpacing;

			const position: NodePosition = {
				crId,
				person,
				x,
				y,
				generation
			};

			positions.push(position);

			// Track positions by year for collision detection
			const yearKey = Math.floor(x / 100); // Group by proximity
			if (!positionedByYear.has(yearKey)) {
				positionedByYear.set(yearKey, []);
			}
			positionedByYear.get(yearKey)!.push(position);
		}

		// Resolve collisions
		this.resolveCollisions(positions, positionedByYear, nodeWidth, nodeHeight, verticalSpacing);

		return {
			positions,
			options: opts
		};
	}

	/**
	 * Extract birth years from all people
	 */
	private extractBirthYears(familyTree: FamilyTree): {
		validYears: number[];
		minYear: number;
		maxYear: number;
	} {
		const years: number[] = [];

		for (const person of familyTree.nodes.values()) {
			const year = this.extractYear(person.birthDate);
			if (year !== null) {
				years.push(year);
			}
		}

		if (years.length === 0) {
			return { validYears: [], minYear: 0, maxYear: 0 };
		}

		return {
			validYears: years,
			minYear: Math.min(...years),
			maxYear: Math.max(...years)
		};
	}

	/**
	 * Extract year from a date string
	 * Handles formats: YYYY, YYYY-MM-DD, etc.
	 */
	private extractYear(dateString?: string): number | null {
		if (!dateString) return null;

		// Try to extract 4-digit year
		const match = dateString.match(/\b(\d{4})\b/);
		if (match) {
			const year = parseInt(match[1], 10);
			// Sanity check: reasonable year range
			if (year >= 1000 && year <= 2100) {
				return year;
			}
		}

		return null;
	}

	/**
	 * Create a scale function that maps years to X coordinates
	 */
	private createYearScale(
		minYear: number,
		_maxYear: number,
		horizontalSpacing: number
	): (year: number) => number {
		const pixelsPerYear = horizontalSpacing / 10; // 10 years = horizontalSpacing

		return (year: number) => {
			return (year - minYear) * pixelsPerYear;
		};
	}

	/**
	 * Estimate X position for people without birth dates
	 * Based on parents' or children's positions
	 */
	private estimatePosition(
		person: PersonNode,
		familyTree: FamilyTree,
		yearScale: (year: number) => number
	): number {
		// Try parents first
		const parents = [person.fatherCrId, person.motherCrId]
			.filter((id): id is string => !!id)
			.map(id => familyTree.nodes.get(id))
			.filter((p): p is PersonNode => !!p);

		if (parents.length > 0) {
			const parentYears = parents
				.map(p => this.extractYear(p.birthDate))
				.filter((y): y is number => y !== null);

			if (parentYears.length > 0) {
				// Place 25 years after average parent birth
				const avgParentYear = parentYears.reduce((a, b) => a + b, 0) / parentYears.length;
				return yearScale(avgParentYear + 25);
			}
		}

		// Try children
		const children = person.childrenCrIds
			.map(id => familyTree.nodes.get(id))
			.filter((p): p is PersonNode => !!p);

		if (children.length > 0) {
			const childYears = children
				.map(p => this.extractYear(p.birthDate))
				.filter((y): y is number => y !== null);

			if (childYears.length > 0) {
				// Place 25 years before average child birth
				const avgChildYear = childYears.reduce((a, b) => a + b, 0) / childYears.length;
				return yearScale(avgChildYear - 25);
			}
		}

		// Fallback: middle of timeline
		return 0;
	}

	/**
	 * Calculate generation numbers for all nodes
	 */
	private calculateGenerations(familyTree: FamilyTree): Map<string, number> {
		const generations = new Map<string, number>();
		const visited = new Set<string>();

		// BFS from root
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

			// Add children (next generation)
			for (const childCrId of person.childrenCrIds) {
				if (!visited.has(childCrId)) {
					queue.push({ crId: childCrId, generation: generation + 1 });
				}
			}

			// Add parents (previous generation)
			if (person.fatherCrId && !visited.has(person.fatherCrId)) {
				queue.push({ crId: person.fatherCrId, generation: generation - 1 });
			}
			if (person.motherCrId && !visited.has(person.motherCrId)) {
				queue.push({ crId: person.motherCrId, generation: generation - 1 });
			}
		}

		return generations;
	}

	/**
	 * Resolve collisions by adjusting Y positions
	 */
	private resolveCollisions(
		positions: NodePosition[],
		positionedByYear: Map<number, NodePosition[]>,
		nodeWidth: number,
		nodeHeight: number,
		verticalSpacing: number
	): void {
		// For each year group, check for vertical collisions
		for (const group of positionedByYear.values()) {
			if (group.length <= 1) continue;

			// Sort by Y position
			group.sort((a, b) => a.y - b.y);

			// Check each pair for collision
			for (let i = 1; i < group.length; i++) {
				const prev = group[i - 1];
				const curr = group[i];

				const minDistance = nodeHeight + 50; // 50px gap

				if (Math.abs(curr.y - prev.y) < minDistance) {
					// Collision! Move current node down
					curr.y = prev.y + minDistance;
				}
			}
		}
	}

	/**
	 * Fallback layout when no birth dates are available
	 * Uses generation-based vertical layout
	 */
	private fallbackLayout(familyTree: FamilyTree, options: Required<LayoutOptions>): LayoutResult {
		const generationMap = this.calculateGenerations(familyTree);
		const positions: NodePosition[] = [];

		// Position counters per generation
		const generationPositions = new Map<number, number>();

		for (const [crId, person] of familyTree.nodes) {
			const generation = generationMap.get(crId) ?? 0;
			const positionInGen = generationPositions.get(generation) ?? 0;
			generationPositions.set(generation, positionInGen + 1);

			positions.push({
				crId,
				person,
				x: positionInGen * options.nodeSpacingX,
				y: generation * options.nodeSpacingY,
				generation
			});
		}

		return {
			positions,
			options
		};
	}
}
