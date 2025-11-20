/**
 * Layout Engine
 *
 * Handles D3.js hierarchy layout calculations for family trees.
 * Provides positioning algorithms for ancestor, descendant, and full family trees.
 */

import { hierarchy, tree } from 'd3-hierarchy';
import { FamilyTree, PersonNode } from './family-graph';

/**
 * Layout options for tree generation
 */
export interface LayoutOptions {
	/** Horizontal spacing between nodes */
	nodeSpacingX?: number;

	/** Vertical spacing between generations */
	nodeSpacingY?: number;

	/** Node width */
	nodeWidth?: number;

	/** Node height */
	nodeHeight?: number;

	/** Tree direction */
	direction?: 'vertical' | 'horizontal';

	/** Tree type */
	treeType?: 'ancestor' | 'descendant' | 'full';
}

/**
 * Default layout options
 */
const DEFAULT_LAYOUT: Required<LayoutOptions> = {
	nodeSpacingX: 300,
	nodeSpacingY: 200,
	nodeWidth: 250,
	nodeHeight: 120,
	direction: 'vertical',
	treeType: 'descendant'
};

/**
 * Hierarchy node for D3 layout
 */
interface TreeNode {
	crId: string;
	person: PersonNode;
	children?: TreeNode[];
}

/**
 * Position data for a person node
 */
export interface NodePosition {
	crId: string;
	person: PersonNode;
	x: number;
	y: number;
}

/**
 * Layout result containing positioned nodes
 */
export interface LayoutResult {
	positions: NodePosition[];
	options: Required<LayoutOptions>;
}

/**
 * Service for calculating tree layouts using D3.js
 */
export class LayoutEngine {
	/**
	 * Calculates layout positions for a family tree
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

		// Convert tree to hierarchical structure for D3
		const treeData = this.buildHierarchy(familyTree, opts.treeType);

		// Calculate layout using D3
		const layout = tree<TreeNode>()
			.nodeSize([opts.nodeSpacingX, opts.nodeSpacingY])
			.separation((a, b) => {
				// Wider spacing for different parents
				return a.parent === b.parent ? 1 : 1.5;
			});

		const root = hierarchy(treeData);
		const layoutRoot = layout(root);

		// Extract positioned nodes
		const positions: NodePosition[] = [];

		layoutRoot.each((node) => {
			const person = node.data.person;
			const x = opts.direction === 'vertical' ? node.x : node.y;
			const y = opts.direction === 'vertical' ? node.y : node.x;

			positions.push({
				crId: person.crId,
				person,
				x,
				y
			});
		});

		return {
			positions,
			options: opts
		};
	}

	/**
	 * Builds hierarchical tree structure for D3 layout
	 *
	 * @param familyTree The family tree data
	 * @param treeType Type of tree to build (ancestor/descendant/full)
	 * @returns Root TreeNode for D3 hierarchy
	 */
	private buildHierarchy(
		familyTree: FamilyTree,
		treeType: 'ancestor' | 'descendant' | 'full'
	): TreeNode {
		const { root, nodes, edges } = familyTree;

		// Build adjacency maps for both parent->child and child->parent relationships
		const childrenMap = new Map<string, string[]>();
		const parentsMap = new Map<string, string[]>();

		for (const edge of edges) {
			if (edge.type === 'parent' || edge.type === 'child') {
				const parentId = edge.type === 'parent' ? edge.from : edge.to;
				const childId = edge.type === 'parent' ? edge.to : edge.from;

				// Parent -> Children map
				if (!childrenMap.has(parentId)) {
					childrenMap.set(parentId, []);
				}
				const children = childrenMap.get(parentId)!;
				if (!children.includes(childId)) {
					children.push(childId);
				}

				// Child -> Parents map
				if (!parentsMap.has(childId)) {
					parentsMap.set(childId, []);
				}
				const parents = parentsMap.get(childId)!;
				if (!parents.includes(parentId)) {
					parents.push(parentId);
				}
			}
		}

		// Build tree structure based on tree type
		const visited = new Set<string>();

		const buildNode = (crId: string): TreeNode | null => {
			if (!nodes.has(crId)) {
				return null;
			}

			if (visited.has(crId)) {
				// Circular reference protection - return a stub node
				return {
					crId,
					person: nodes.get(crId)!,
					children: []
				};
			}

			visited.add(crId);

			const person = nodes.get(crId)!;
			const children: TreeNode[] = [];

			// Determine hierarchical children based on tree type
			const childIds = childrenMap.get(crId) || [];
			const parentIds = parentsMap.get(crId) || [];

			let hierarchicalChildren: string[] = [];

			switch (treeType) {
				case 'ancestor':
					// For ancestor trees, parents become hierarchical children
					hierarchicalChildren = parentIds;
					break;
				case 'descendant':
					// For descendant trees, children remain hierarchical children
					hierarchicalChildren = childIds;
					break;
				case 'full':
					// For full trees, include both parents and children
					// (Note: This creates a more complex graph structure)
					hierarchicalChildren = [...parentIds, ...childIds];
					break;
			}

			for (const childId of hierarchicalChildren) {
				if (!visited.has(childId)) {
					const childNode = buildNode(childId);
					if (childNode) {
						children.push(childNode);
					}
				}
			}

			return {
				crId,
				person,
				children
			};
		};

		const rootNode = buildNode(root.crId);

		if (!rootNode) {
			// Fallback: return a minimal tree with just the root
			return {
				crId: root.crId,
				person: root,
				children: []
			};
		}

		return rootNode;
	}

	/**
	 * Calculates bounding box for layout positions
	 *
	 * @param positions Array of node positions
	 * @param options Layout options (for node dimensions)
	 * @returns Bounding box {minX, minY, maxX, maxY, width, height}
	 */
	calculateBounds(
		positions: NodePosition[],
		options: Required<LayoutOptions>
	): {
		minX: number;
		minY: number;
		maxX: number;
		maxY: number;
		width: number;
		height: number;
	} {
		if (positions.length === 0) {
			return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
		}

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for (const pos of positions) {
			minX = Math.min(minX, pos.x);
			minY = Math.min(minY, pos.y);
			maxX = Math.max(maxX, pos.x + options.nodeWidth);
			maxY = Math.max(maxY, pos.y + options.nodeHeight);
		}

		return {
			minX,
			minY,
			maxX,
			maxY,
			width: maxX - minX,
			height: maxY - minY
		};
	}
}
