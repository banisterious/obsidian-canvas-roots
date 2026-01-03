/**
 * Family Chart Layout Engine
 *
 * Uses the family-chart library to calculate proper family tree layouts.
 * This library handles spouse relationships correctly, unlike D3's hierarchical tree.
 */

import f3, { type Data, type Datum } from 'family-chart';
import { FamilyTree, PersonNode } from './family-graph';
import { LayoutOptions, NodePosition, LayoutResult } from './layout-engine';
import { getLogger } from './logging';

const logger = getLogger('FamilyChartLayout');

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
	treeType: 'descendant',
	layoutType: 'standard'
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

		// Calculate generation numbers for all nodes
		const generationMap = this.calculateGenerations(familyTree, topAncestor.crId);

		// Extract positions from family-chart's tree
		const positions: NodePosition[] = [];

		for (const node of tree.data) {
			const person = familyTree.nodes.get(node.data.id);
			if (person) {
				positions.push({
					crId: person.crId,
					person,
					x: node.x || 0,
					y: node.y || 0,
					generation: generationMap.get(person.crId)
				});
			}
		}

		// Add missing people (siblings-in-law, etc.) that family-chart excluded
		// These are people connected only through marriage, not blood relation
		const positionedIds = new Set(positions.map(p => p.crId));
		for (const [crId, person] of familyTree.nodes) {
			if (!positionedIds.has(crId)) {
				// Person is missing from family-chart's layout
				// Try to position them based on their relationships

				// Strategy 1: If they have a spouse who IS positioned, place next to spouse
				if (person.spouseCrIds && person.spouseCrIds.length > 0) {
					const spousePos = positions.find(p => person.spouseCrIds.includes(p.crId));
					if (spousePos) {
						// Place to the right of spouse at same Y level (same generation)
						positions.push({
							crId: person.crId,
							person,
							x: spousePos.x + (opts.nodeSpacingX * 1.5),  // Match the 1.5x multiplier
							y: spousePos.y,
							generation: spousePos.generation  // Same generation as spouse
						});
						continue;
					}
				}

				// Strategy 2: If they have children who ARE positioned, place above them
				if (person.childrenCrIds && person.childrenCrIds.length > 0) {
					const childPos = positions.find(p => person.childrenCrIds.includes(p.crId));
					if (childPos) {
						// Place above child (one generation earlier)
						positions.push({
							crId: person.crId,
							person,
							x: childPos.x,
							y: childPos.y - opts.nodeSpacingY,
							generation: childPos.generation !== undefined ? childPos.generation - 1 : undefined
						});
						continue;
					}
				}

				// Strategy 3: If they have positioned parents, place next to siblings
				const fatherPos = person.fatherCrId ? positions.find(p => p.crId === person.fatherCrId) : null;
				const motherPos = person.motherCrId ? positions.find(p => p.crId === person.motherCrId) : null;
				const parentPos = fatherPos || motherPos;

				if (parentPos) {
					// Find positioned siblings (same parents)
					const siblings = positions.filter(p => {
						const sibling = p.person;
						return (
							sibling.crId !== person.crId &&
							((person.fatherCrId && sibling.fatherCrId === person.fatherCrId) ||
								(person.motherCrId && sibling.motherCrId === person.motherCrId))
						);
					});

					if (siblings.length > 0) {
						// Place to the right of rightmost sibling (same generation)
						const rightmostSibling = siblings.reduce((prev, curr) =>
							curr.x > prev.x ? curr : prev
						);
						positions.push({
							crId: person.crId,
							person,
							x: rightmostSibling.x + (opts.nodeSpacingX * 1.5),
							y: rightmostSibling.y,
							generation: rightmostSibling.generation  // Same generation as sibling
						});
						continue;
					} else {
						// No siblings positioned yet - place below parent (one generation later)
						positions.push({
							crId: person.crId,
							person,
							x: parentPos.x,
							y: parentPos.y + opts.nodeSpacingY,
							generation: parentPos.generation !== undefined ? parentPos.generation + 1 : undefined
						});
						continue;
					}
				}

				logger.warn('layout', `Could not position ${person.name} - no positioned relatives found`);
			}
		}

		// Post-process positions to enforce minimum spacing
		// Family-chart doesn't always respect our spacing parameters with complex trees
		const spacedPositions = this.enforceMinimumSpacing(positions, opts);

		// Re-sort siblings by parent pair to ensure full-siblings are grouped together
		// This works around an issue in family-chart where children from different
		// parent pairs can be interleaved instead of grouped by family unit
		const adjustedPositions = this.resortSiblingsByParentPair(spacedPositions, opts);

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

		for (const [, person] of familyTree.nodes) {
			const hasParents =
				(person.fatherCrId && familyTree.nodes.has(person.fatherCrId)) ||
				(person.motherCrId && familyTree.nodes.has(person.motherCrId));

			if (!hasParents) {
				topAncestors.push(person);
			}
		}

		if (topAncestors.length === 0) {
			return familyTree.root;
		}

		// Score each ancestor by how connected they are to the main family line
		// Prefer ancestors whose descendants connect to other family lines (via marriage)
		const scoredAncestors = topAncestors.map(ancestor => {
			let score = 0;

			// Count total descendants (children, grandchildren, etc.)
			// Also track if the root person is in this descendant tree
			let rootIsDescendant = false;
			const countDescendants = (crId: string, visited = new Set<string>()): number => {
				if (visited.has(crId)) return 0;
				visited.add(crId);

				if (crId === familyTree.root.crId) {
					rootIsDescendant = true;
				}

				const person = familyTree.nodes.get(crId);
				if (!person || !person.childrenCrIds) return 0;

				let count = person.childrenCrIds.length;
				for (const childCrId of person.childrenCrIds) {
					count += countDescendants(childCrId, visited);
				}
				return count;
			};

			score += countDescendants(ancestor.crId);

			// Huge bonus if the root person is a descendant of this ancestor
			// This ensures we always show the user's selected root person and their lineage
			if (rootIsDescendant) {
				score += 10000;
			}

			// Bonus points if this ancestor is NOT the root person
			// (prefer in-laws over the root person for better layout)
			// But only if root is NOT a descendant (don't penalize root's ancestry)
			if (ancestor.crId !== familyTree.root.crId && !rootIsDescendant) {
				score += 100;
			}

			// Extra bonus if this ancestor is NOT married to the root
			// (prefer separate family lines over spouse of root)
			// But only if root is NOT a descendant (don't penalize root's ancestry)
			const rootSpouses = familyTree.root.spouseCrIds || [];
			if (!rootSpouses.includes(ancestor.crId) && !rootIsDescendant) {
				score += 1000; // Big bonus for being in a different family line
			}

			return { ancestor, score };
		});

		// Sort by score (highest first)
		scoredAncestors.sort((a, b) => b.score - a.score);

		return scoredAncestors[0].ancestor;
	}

	/**
	 * Re-sorts siblings within each generation to group full-siblings together
	 * This works around an issue in the family-chart library where children from
	 * different parent pairs can be interleaved instead of grouped by family unit.
	 *
	 * The algorithm:
	 * 1. Group nodes by Y coordinate (generation level)
	 * 2. Within each generation, identify which nodes are "blood relatives" (parents in tree)
	 *    vs "in-laws/spouses" (parents not in tree)
	 * 3. Only group blood relatives by parent pair; leave in-laws in their original positions
	 * 4. Re-assign X coordinates while maintaining spacing
	 *
	 * @param positions Positions after spacing enforcement
	 * @param options Layout options including spacing requirements
	 * @returns Adjusted positions with siblings grouped by parent pair
	 */
	private resortSiblingsByParentPair(
		positions: NodePosition[],
		options: Required<LayoutOptions>
	): NodePosition[] {
		// Calculate minimum spacing (same as enforceMinimumSpacing)
		const minSpacing = options.nodeWidth + 200;

		// Build a set of all person IDs in the tree for quick lookup
		const personIdsInTree = new Set(positions.map(p => p.person.crId));

		// Group nodes by Y coordinate (generation level)
		const byGeneration = new Map<number, NodePosition[]>();
		for (const pos of positions) {
			const y = pos.y;
			if (!byGeneration.has(y)) {
				byGeneration.set(y, []);
			}
			byGeneration.get(y)!.push(pos);
		}

		const adjusted: NodePosition[] = [];

		for (const [, nodesAtLevel] of byGeneration) {
			// Sort by current X to establish initial order
			const sorted = [...nodesAtLevel].sort((a, b) => a.x - b.x);

			// Check if a node's parents are in the tree (making them a "blood relative")
			// vs an "in-law" whose parents are outside the tree
			const hasParentsInTree = (node: NodePosition): boolean => {
				const fatherId = node.person.fatherCrId;
				const motherId = node.person.motherCrId;
				// At least one parent must be in the tree for this to be a blood relative
				return (fatherId !== undefined && personIdsInTree.has(fatherId)) ||
					   (motherId !== undefined && personIdsInTree.has(motherId));
			};

			// Create a parent pair key for each node
			// Key format: "fatherId|motherId" (sorted to be consistent)
			const getParentPairKey = (node: NodePosition): string => {
				const parents = [
					node.person.fatherCrId || '',
					node.person.motherCrId || ''
				].sort();
				return parents.join('|');
			};

			// Build a lookup of nodes by crId for spouse resolution
			const nodesByCrId = new Map<string, NodePosition>();
			for (const node of sorted) {
				nodesByCrId.set(node.person.crId, node);
			}

			// Separate nodes into:
			// 1. Blood relatives (parents in tree) - will be grouped by parent pair
			// 2. In-laws/spouses - will be attached to their blood-relative spouse's group
			// 3. Ancestors (no parents at all) - keep original position
			const parentPairGroups = new Map<string, NodePosition[]>();
			const keepOriginalPosition: NodePosition[] = [];
			const assignedToGroup = new Set<string>(); // Track nodes already assigned

			// First pass: identify blood relatives and group by parent pair
			for (const node of sorted) {
				const key = getParentPairKey(node);
				if (key === '|') {
					// No parents - this is an ancestor, keep original position
					keepOriginalPosition.push(node);
					assignedToGroup.add(node.person.crId);
				} else if (hasParentsInTree(node)) {
					// Blood relative - group by parent pair
					if (!parentPairGroups.has(key)) {
						parentPairGroups.set(key, []);
					}
					parentPairGroups.get(key)!.push(node);
					assignedToGroup.add(node.person.crId);
				}
				// In-laws will be handled in second pass
			}

			// Second pass: attach in-laws/spouses to their blood-relative spouse's group
			for (const node of sorted) {
				if (assignedToGroup.has(node.person.crId)) {
					continue; // Already assigned
				}

				// This is an in-law (parents not in tree)
				// Find their spouse(s) who are blood relatives and attach to that group
				const spouseIds = node.person.spouseCrIds || [];
				let attachedToGroup = false;

				for (const spouseId of spouseIds) {
					const spouseNode = nodesByCrId.get(spouseId);
					if (spouseNode && hasParentsInTree(spouseNode)) {
						// Spouse is a blood relative - attach this in-law to spouse's group
						const spouseKey = getParentPairKey(spouseNode);
						if (parentPairGroups.has(spouseKey)) {
							parentPairGroups.get(spouseKey)!.push(node);
							assignedToGroup.add(node.person.crId);
							attachedToGroup = true;
							break;
						}
					}
				}

				if (!attachedToGroup) {
					// No blood-relative spouse found, keep original position
					keepOriginalPosition.push(node);
					assignedToGroup.add(node.person.crId);
				}
			}

			// If there are no parent-pair groups (all ancestors/in-laws), keep original order
			if (parentPairGroups.size === 0) {
				adjusted.push(...sorted);
				continue;
			}

			// Determine group order by the leftmost node in each group
			// This preserves the general layout from family-chart while grouping siblings
			const groupOrder = Array.from(parentPairGroups.entries())
				.map(([key, nodes]) => ({
					key,
					nodes,
					leftmostX: Math.min(...nodes.map(n => n.x))
				}))
				.sort((a, b) => a.leftmostX - b.leftmostX);

			// Sort nodes that keep original position by X
			keepOriginalPosition.sort((a, b) => a.x - b.x);

			// Merge all groups by their X positions
			// This keeps ancestors/in-laws in their proper positions relative to siblings
			const allGroups: { nodes: NodePosition[]; leftmostX: number }[] = [
				...groupOrder.map(g => ({ nodes: g.nodes, leftmostX: g.leftmostX })),
				...keepOriginalPosition.map(n => ({ nodes: [n], leftmostX: n.x }))
			].sort((a, b) => a.leftmostX - b.leftmostX);

			// Re-assign X coordinates while maintaining spacing
			// Find the leftmost X to use as starting point
			const startX = Math.min(...sorted.map(n => n.x));
			let currentX = startX;

			for (const group of allGroups) {
				// Sort nodes within group by their original X (preserves birth order if any)
				const groupNodes = [...group.nodes].sort((a, b) => a.x - b.x);

				for (const node of groupNodes) {
					adjusted.push({
						...node,
						x: currentX
					});
					currentX += minSpacing;
				}
			}
		}

		return adjusted;
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
		for (const [, nodesAtLevel] of byGeneration) {
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
	 * Calculates generation numbers for all nodes in the tree
	 * Uses breadth-first search from the root node
	 *
	 * @param familyTree The family tree
	 * @param rootCrId The ID of the root person (generation 0)
	 * @returns Map of crId to generation number
	 */
	private calculateGenerations(familyTree: FamilyTree, rootCrId: string): Map<string, number> {
		const generationMap = new Map<string, number>();
		const visited = new Set<string>();
		const queue: Array<{ crId: string; generation: number }> = [];

		// Start with root at generation 0
		queue.push({ crId: rootCrId, generation: 0 });
		visited.add(rootCrId);

		while (queue.length > 0) {
			const { crId, generation } = queue.shift()!;
			generationMap.set(crId, generation);

			const person = familyTree.nodes.get(crId);
			if (!person) continue;

			// Add parents (previous generation: -1)
			if (person.fatherCrId && !visited.has(person.fatherCrId)) {
				queue.push({ crId: person.fatherCrId, generation: generation - 1 });
				visited.add(person.fatherCrId);
			}
			if (person.motherCrId && !visited.has(person.motherCrId)) {
				queue.push({ crId: person.motherCrId, generation: generation - 1 });
				visited.add(person.motherCrId);
			}

			// Add children (next generation: +1)
			if (person.childrenCrIds) {
				for (const childId of person.childrenCrIds) {
					if (!visited.has(childId)) {
						queue.push({ crId: childId, generation: generation + 1 });
						visited.add(childId);
					}
				}
			}

			// Add spouses (same generation)
			if (person.spouseCrIds) {
				for (const spouseId of person.spouseCrIds) {
					if (!visited.has(spouseId)) {
						queue.push({ crId: spouseId, generation });
						visited.add(spouseId);
					}
				}
			}
		}

		return generationMap;
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
			for (const [, otherPerson] of familyTree.nodes) {
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

			// Add parent relationships (only if parent exists in tree)
			if (person.fatherCrId && familyTree.nodes.has(person.fatherCrId)) {
				datum.rels.parents.push(person.fatherCrId);
			}
			if (person.motherCrId && familyTree.nodes.has(person.motherCrId)) {
				datum.rels.parents.push(person.motherCrId);
			}

			// Add spouse relationships (only if spouse exists in tree)
			// Prefer enhanced spouse metadata for proper ordering, fall back to simple array
			if (person.spouses && person.spouses.length > 0) {
				// Use enhanced metadata - this preserves marriage order (spouse1, spouse2, spouse3...)
				datum.rels.spouses = person.spouses
					.map(s => s.personId)
					.filter(id => familyTree.nodes.has(id));
			} else if (person.spouseCrIds && person.spouseCrIds.length > 0) {
				// Fall back to simple array (no ordering information)
				datum.rels.spouses = person.spouseCrIds.filter(id => familyTree.nodes.has(id));
			}

			// Add children relationships (only if child exists in tree)
			if (person.childrenCrIds && person.childrenCrIds.length > 0) {
				datum.rels.children = person.childrenCrIds.filter(id => familyTree.nodes.has(id));
			}

			data.push(datum);
		}

		return data;
	}
}
