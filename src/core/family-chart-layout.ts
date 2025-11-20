/**
 * Family Chart Layout Engine
 *
 * Uses the family-chart library to calculate proper family tree layouts.
 * This library handles spouse relationships correctly, unlike D3's hierarchical tree.
 */

import f3, { type Data, type Datum } from 'family-chart';
import { FamilyTree, PersonNode } from './family-graph';
import { LayoutOptions, NodePosition, LayoutResult } from './layout-engine';

/**
 * Default layout options for family-chart
 * Note: Much larger spacing needed to prevent overlaps when multiple couples exist at same level
 * The family-chart library adds extra spacing based on spouse relationships
 * Extra horizontal space also needed for Canvas name labels rendered above nodes
 */
const DEFAULT_LAYOUT: Required<LayoutOptions> = {
	nodeSpacingX: 1200,  // Very large spacing - accounts for node width + Canvas labels above nodes
	nodeSpacingY: 250,   // Vertical spacing between generations
	nodeWidth: 250,
	nodeHeight: 120,
	direction: 'vertical',
	treeType: 'descendant'
};

/**
 * Layout engine using family-chart library
 */
export class FamilyChartLayoutEngine {
	/**
	 * Calculates layout positions using family-chart
	 *
	 * @param familyTree The family tree to layout
	 * @param options Layout configuration options
	 * @returns Layout result with positioned nodes
	 */
	calculateLayout(
		familyTree: FamilyTree,
		options: LayoutOptions = {}
	): LayoutResult {
		const opts = { ...DEFAULT_LAYOUT, ...options };

		// Convert our data to family-chart format
		const f3Data = this.convertToFamilyChartFormat(familyTree);

		// For descendant trees, find the topmost ancestor to use as main_id
		// family-chart places main_id at y=0 and shows parents above, children below
		// So for a descendant tree, we want the eldest ancestor as the "main" person
		const topAncestor = this.findTopAncestor(familyTree);
		console.log('[FamilyChartLayout] Top ancestor:', topAncestor.name, 'crId:', topAncestor.crId);
		console.log('[FamilyChartLayout] Family tree root:', familyTree.root.name, 'crId:', familyTree.root.crId);

		// Use family-chart's layout engine
		// Multiply spacing by 1.5x for family-chart - it needs extra room for complex trees
		// The library's internal algorithm doesn't account for Canvas name labels above nodes
		const tree = f3.calculateTree(f3Data, {
			main_id: topAncestor.crId,
			node_separation: opts.nodeSpacingX * 1.5,  // 1.5x multiplier for balanced spacing
			level_separation: opts.nodeSpacingY,
			is_horizontal: opts.direction === 'horizontal',
			single_parent_empty_card: false,
			// Show everyone - let family-chart handle the full tree
			ancestry_depth: undefined,  // Show all ancestors
			progeny_depth: undefined    // Show all descendants
		});

		// Extract positions from family-chart's tree
		const positions: NodePosition[] = [];

		for (const node of tree.data) {
			const person = familyTree.nodes.get(node.data.id);
			if (person) {
				positions.push({
					crId: person.crId,
					person,
					x: node.x || 0,
					y: node.y || 0
				});
			}
		}

		console.log('[FamilyChartLayout] Raw positions:', positions.map(p =>
			`${p.person.name}: (${Math.round(p.x)}, ${Math.round(p.y)})`
		).join(', '));

		// Add missing people (siblings-in-law, etc.) that family-chart excluded
		// These are people connected only through marriage, not blood relation
		const positionedIds = new Set(positions.map(p => p.crId));
		for (const [crId, person] of familyTree.nodes) {
			if (!positionedIds.has(crId)) {
				// Person is missing from family-chart's layout
				// Try to position them based on their relationships

				// Strategy 1: If they have a spouse who IS positioned, place next to spouse
				if (person.spouseCrIds && person.spouseCrIds.length > 0) {
					const spousePos = positions.find(p => person.spouseCrIds!.includes(p.crId));
					if (spousePos) {
						// Place to the right of spouse at same Y level
						positions.push({
							crId: person.crId,
							person,
							x: spousePos.x + (opts.nodeSpacingX * 1.5),  // Match the 1.5x multiplier
							y: spousePos.y
						});
						console.log(`[FamilyChartLayout] Added ${person.name} next to spouse ${spousePos.person.name}`);
						continue;
					}
				}

				// Strategy 2: If they have children who ARE positioned, place above them
				if (person.childrenCrIds && person.childrenCrIds.length > 0) {
					const childPos = positions.find(p => person.childrenCrIds!.includes(p.crId));
					if (childPos) {
						// Place above child
						positions.push({
							crId: person.crId,
							person,
							x: childPos.x,
							y: childPos.y - opts.nodeSpacingY
						});
						console.log(`[FamilyChartLayout] Added ${person.name} above child ${childPos.person.name}`);
						continue;
					}
				}

				console.warn(`[FamilyChartLayout] Could not position ${person.name} - no positioned relatives found`);
			}
		}

		// Post-process positions to enforce minimum spacing
		// Family-chart doesn't always respect our spacing parameters with complex trees
		const adjustedPositions = this.enforceMinimumSpacing(positions, opts);

		console.log('[FamilyChartLayout] Adjusted positions:', adjustedPositions.map(p =>
			`${p.person.name}: (${Math.round(p.x)}, ${Math.round(p.y)})`
		).join(', '));

		return {
			positions: adjustedPositions,
			options: opts
		};
	}

	/**
	 * Finds the topmost ancestor(s) in the family tree
	 * Simply looks for people with no parents in the tree
	 *
	 * @param familyTree The family tree to search
	 * @returns The topmost ancestor node
	 */
	private findTopAncestor(familyTree: FamilyTree): PersonNode {
		// Find all people with no parents (top ancestors)
		const topAncestors: PersonNode[] = [];

		for (const [_, person] of familyTree.nodes) {
			const hasParents =
				(person.fatherCrId && familyTree.nodes.has(person.fatherCrId)) ||
				(person.motherCrId && familyTree.nodes.has(person.motherCrId));

			if (!hasParents) {
				topAncestors.push(person);
			}
		}

		console.log('[FamilyChartLayout] Top ancestors (no parents):', topAncestors.map(p => p.name).join(', '));

		if (topAncestors.length === 0) {
			console.log('[FamilyChartLayout] No top ancestors found, using root:', familyTree.root.name);
			return familyTree.root;
		}

		// Score each ancestor by how connected they are to the main family line
		// Prefer ancestors whose descendants connect to other family lines (via marriage)
		const scoredAncestors = topAncestors.map(ancestor => {
			let score = 0;

			// Count total descendants (children, grandchildren, etc.)
			const countDescendants = (crId: string, visited = new Set<string>()): number => {
				if (visited.has(crId)) return 0;
				visited.add(crId);

				const person = familyTree.nodes.get(crId);
				if (!person || !person.childrenCrIds) return 0;

				let count = person.childrenCrIds.length;
				for (const childCrId of person.childrenCrIds) {
					count += countDescendants(childCrId, visited);
				}
				return count;
			};

			score += countDescendants(ancestor.crId);

			// Bonus points if this ancestor is NOT the root person
			// (prefer in-laws over the root person for better layout)
			if (ancestor.crId !== familyTree.root.crId) {
				score += 100;
			}

			// Extra bonus if this ancestor is NOT married to the root
			// (prefer separate family lines over spouse of root)
			const rootSpouses = familyTree.root.spouseCrIds || [];
			if (!rootSpouses.includes(ancestor.crId)) {
				score += 1000; // Big bonus for being in a different family line
			}

			return { ancestor, score };
		});

		// Sort by score (highest first)
		scoredAncestors.sort((a, b) => b.score - a.score);

		const selected = scoredAncestors[0].ancestor;
		console.log('[FamilyChartLayout] Ancestor scores:', scoredAncestors.map(s => `${s.ancestor.name}: ${s.score}`).join(', '));
		console.log('[FamilyChartLayout] Selected top ancestor:', selected.name);

		return selected;
	}

	/**
	 * Enforces minimum spacing between nodes at the same generation level
	 * Post-processes positions to ensure nodes don't overlap visually
	 *
	 * @param positions Original positions from family-chart
	 * @param options Layout options including spacing requirements
	 * @returns Adjusted positions with proper spacing
	 */
	private enforceMinimumSpacing(
		positions: NodePosition[],
		options: Required<LayoutOptions>
	): NodePosition[] {
		// Calculate minimum spacing needed (node width + desired gap)
		// Use larger spacing to account for Canvas name labels above nodes
		const minSpacing = options.nodeWidth + 200; // 200px gap between nodes for label clearance

		// Group nodes by Y coordinate (generation level)
		const byGeneration = new Map<number, NodePosition[]>();
		for (const pos of positions) {
			const generation = pos.y;
			if (!byGeneration.has(generation)) {
				byGeneration.set(generation, []);
			}
			byGeneration.get(generation)!.push(pos);
		}

		// Process each generation
		const adjusted: NodePosition[] = [];
		for (const [_y, nodesAtLevel] of byGeneration) {
			// Sort by X coordinate
			const sorted = [...nodesAtLevel].sort((a, b) => a.x - b.x);

			// Track adjusted nodes for this generation only
			const generationAdjusted: NodePosition[] = [];

			// Check spacing and adjust if needed
			for (let i = 0; i < sorted.length; i++) {
				if (i === 0) {
					// First node in generation stays where it is
					generationAdjusted.push(sorted[i]);
				} else {
					const prev = generationAdjusted[generationAdjusted.length - 1];
					const current = sorted[i];

					// Calculate actual spacing
					const actualSpacing = current.x - prev.x;

					if (actualSpacing < minSpacing) {
						// Too close - push current node to the right
						const newX = prev.x + minSpacing;
						generationAdjusted.push({
							...current,
							x: newX
						});
					} else {
						// Spacing is fine
						generationAdjusted.push(current);
					}
				}
			}

			// Add this generation's nodes to final result
			adjusted.push(...generationAdjusted);
		}

		return adjusted;
	}

	/**
	 * Converts our PersonNode format to family-chart's Data format
	 *
	 * @param familyTree The family tree to convert
	 * @returns family-chart compatible data array
	 */
	private convertToFamilyChartFormat(familyTree: FamilyTree): Data {
		const data: Data = [];

		for (const [crId, person] of familyTree.nodes) {
			// Infer gender from relationships if not available
			// Default to 'M', but if this person is someone's mother, use 'F'
			let gender: 'M' | 'F' = 'M';

			// Check if this person is referenced as anyone's mother
			for (const [_, otherPerson] of familyTree.nodes) {
				if (otherPerson.motherCrId === crId) {
					gender = 'F';
					break;
				}
			}

			const datum: Datum = {
				id: crId,
				data: {
					gender,
					'first name': person.name,
					'last name': '',
					birthday: person.birthDate || '',
					avatar: ''
				},
				rels: {
					parents: [],
					spouses: [],
					children: []
				}
			};

			// Add parent relationships
			if (person.fatherCrId) {
				datum.rels.parents!.push(person.fatherCrId);
			}
			if (person.motherCrId) {
				datum.rels.parents!.push(person.motherCrId);
			}

			// Add spouse relationships
			if (person.spouseCrIds && person.spouseCrIds.length > 0) {
				datum.rels.spouses = [...person.spouseCrIds];
			}

			// Add children relationships
			if (person.childrenCrIds && person.childrenCrIds.length > 0) {
				datum.rels.children = [...person.childrenCrIds];
			}

			data.push(datum);
		}

		return data;
	}
}
