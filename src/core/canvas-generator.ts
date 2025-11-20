/**
 * Canvas Generator
 *
 * Converts family tree data structures into Obsidian Canvas JSON format.
 * Handles layout, positioning, styling, and edge rendering.
 */

import { hierarchy, tree } from 'd3-hierarchy';
import { FamilyTree, PersonNode, FamilyEdge } from './family-graph';

/**
 * Obsidian Canvas node
 */
interface CanvasNode {
	id: string;
	type: 'file' | 'text';
	file?: string;
	text?: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color?: string;
}

/**
 * Obsidian Canvas edge
 */
interface CanvasEdge {
	id: string;
	styleAttributes?: Record<string, unknown>;
	fromFloating?: boolean;
	toFloating?: boolean;
	fromNode: string;
	fromSide: 'top' | 'right' | 'bottom' | 'left';
	toNode: string;
	toSide: 'top' | 'right' | 'bottom' | 'left';
	color?: string;
	label?: string;
}

/**
 * Complete Obsidian Canvas structure
 */
export interface CanvasData {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
	metadata?: {
		version?: string;
		frontmatter?: Record<string, unknown>;
	};
}

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

	/** Color coding */
	colorByGender?: boolean;

	/** Show relationship labels */
	showLabels?: boolean;
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
	colorByGender: true,
	showLabels: true
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
 * Service for generating Obsidian Canvas JSON from family trees
 */
export class CanvasGenerator {
	/**
	 * Generates Canvas JSON from a family tree
	 */
	generateCanvas(
		familyTree: FamilyTree,
		options: LayoutOptions = {}
	): CanvasData {
		const opts = { ...DEFAULT_LAYOUT, ...options };

		// Convert tree to hierarchical structure for D3
		const treeData = this.buildHierarchy(familyTree);

		// Calculate layout using D3
		const layout = tree<TreeNode>()
			.nodeSize([opts.nodeSpacingX, opts.nodeSpacingY])
			.separation((a, b) => {
				// Wider spacing for different parents
				return a.parent === b.parent ? 1 : 1.5;
			});

		const root = hierarchy(treeData);
		const layoutRoot = layout(root);

		// Generate canvas nodes
		const canvasNodes: CanvasNode[] = [];
		const nodeMap = new Map<string, { x: number; y: number }>();
		const crIdToCanvasId = new Map<string, string>();

		layoutRoot.each((node) => {
			const person = node.data.person;
			const x = opts.direction === 'vertical' ? node.x : node.y;
			const y = opts.direction === 'vertical' ? node.y : node.x;

			// Generate a canvas-compatible ID (no dashes, alphanumeric only)
			const canvasId = this.generateId();
			crIdToCanvasId.set(person.crId, canvasId);

			// Store position for edge generation
			nodeMap.set(person.crId, { x, y });

			// Create canvas node using generated canvas ID
			canvasNodes.push({
				id: canvasId,
				type: 'file',
				file: person.file.path,
				x,
				y,
				width: opts.nodeWidth,
				height: opts.nodeHeight,
				color: opts.colorByGender ? this.getPersonColor(person) : undefined
			});
		});

		// Generate canvas edges using canvas IDs
		const canvasEdges = this.generateEdges(
			familyTree,
			nodeMap,
			crIdToCanvasId,
			opts
		);

		return {
			nodes: canvasNodes,
			edges: canvasEdges,
			metadata: {
				version: '1.0-1.0',
				frontmatter: {}
			}
		};
	}

	/**
	 * Builds hierarchical tree structure for D3 layout
	 */
	private buildHierarchy(familyTree: FamilyTree): TreeNode {
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

		// Build tree structure based on whether we're going up (ancestors) or down (descendants)
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

			// Get hierarchical children (could be actual children for descendant trees,
			// or parents for ancestor trees)
			const childIds = childrenMap.get(crId) || [];
			const parentIds = parentsMap.get(crId) || [];

			// For descendant trees, children go down
			// For ancestor trees, we want to show parents as "children" in the hierarchy
			// Check if this is an ancestor tree by seeing if root has parents
			const isAncestorTree = parentsMap.has(root.crId);

			const hierarchicalChildren = isAncestorTree ? parentIds : childIds;

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
	 * Generates canvas edges from family relationships
	 */
	private generateEdges(
		familyTree: FamilyTree,
		nodeMap: Map<string, { x: number; y: number }>,
		crIdToCanvasId: Map<string, string>,
		options: Required<LayoutOptions>
	): CanvasEdge[] {
		const edges: CanvasEdge[] = [];

		for (const edge of familyTree.edges) {
			const fromPos = nodeMap.get(edge.from);
			const toPos = nodeMap.get(edge.to);

			if (!fromPos || !toPos) {
				continue;
			}

			// Get canvas IDs for the nodes
			const fromCanvasId = crIdToCanvasId.get(edge.from);
			const toCanvasId = crIdToCanvasId.get(edge.to);

			if (!fromCanvasId || !toCanvasId) {
				continue;
			}

			// Determine edge sides based on direction
			let fromSide: 'top' | 'right' | 'bottom' | 'left';
			let toSide: 'top' | 'right' | 'bottom' | 'left';

			if (options.direction === 'vertical') {
				// Parent-child: top to bottom
				if (edge.type === 'parent') {
					fromSide = 'bottom';
					toSide = 'top';
				} else if (edge.type === 'child') {
					fromSide = 'top';
					toSide = 'bottom';
				} else {
					// Spouse: side to side
					fromSide = fromPos.x < toPos.x ? 'right' : 'left';
					toSide = fromPos.x < toPos.x ? 'left' : 'right';
				}
			} else {
				// Horizontal layout
				if (edge.type === 'parent') {
					fromSide = 'right';
					toSide = 'left';
				} else if (edge.type === 'child') {
					fromSide = 'left';
					toSide = 'right';
				} else {
					// Spouse: vertical
					fromSide = fromPos.y < toPos.y ? 'bottom' : 'top';
					toSide = fromPos.y < toPos.y ? 'top' : 'bottom';
				}
			}

			edges.push({
				id: this.generateId(),
				styleAttributes: {},
				fromFloating: false,
				toFloating: false,
				fromNode: fromCanvasId,
				fromSide,
				toNode: toCanvasId,
				toSide,
				color: this.getEdgeColor(edge.type),
				label: options.showLabels ? this.getEdgeLabel(edge.type) : undefined
			});
		}

		return edges;
	}

	/**
	 * Gets color for person node based on inferred gender
	 */
	private getPersonColor(person: PersonNode): string {
		// Simple heuristic: check for gendered terms in name/relationships
		// In future, could read from frontmatter gender field
		const name = person.name.toLowerCase();

		// Default colors (using Obsidian canvas colors)
		if (name.includes('mr.') || name.includes('sr.') || name.includes('jr.')) {
			return '4'; // Blue
		}
		if (name.includes('mrs.') || name.includes('ms.') || name.includes('miss')) {
			return '5'; // Purple
		}

		// Default: neutral
		return '2'; // Gray
	}

	/**
	 * Gets color for edge based on relationship type
	 */
	private getEdgeColor(type: 'parent' | 'spouse' | 'child'): string {
		switch (type) {
			case 'parent':
			case 'child':
				return '1'; // Red for parent-child
			case 'spouse':
				return '6'; // Pink for spouse
			default:
				return '2'; // Gray default
		}
	}

	/**
	 * Gets label text for edge based on relationship type
	 */
	private getEdgeLabel(type: 'parent' | 'spouse' | 'child'): string {
		switch (type) {
			case 'parent':
				return 'parent';
			case 'child':
				return 'child';
			case 'spouse':
				return 'spouse';
			default:
				return '';
		}
	}

	/**
	 * Generates a unique ID for canvas elements
	 */
	private generateId(): string {
		return Math.random().toString(36).substring(2, 15) +
			Math.random().toString(36).substring(2, 15);
	}
}
