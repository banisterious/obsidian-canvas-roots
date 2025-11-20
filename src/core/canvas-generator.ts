/**
 * Canvas Generator
 *
 * Converts family tree data structures into Obsidian Canvas JSON format.
 * Handles styling and edge rendering. Uses LayoutEngine for positioning.
 */

import { FamilyTree, PersonNode } from './family-graph';
import { LayoutEngine, LayoutOptions } from './layout-engine';

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
 * Canvas generation options (extends layout options with styling)
 */
export interface CanvasGenerationOptions extends LayoutOptions {
	/** Color coding by gender */
	colorByGender?: boolean;

	/** Show relationship labels on edges */
	showLabels?: boolean;
}

/**
 * Default canvas generation options
 */
const DEFAULT_OPTIONS: Required<CanvasGenerationOptions> = {
	nodeSpacingX: 300,
	nodeSpacingY: 200,
	nodeWidth: 250,
	nodeHeight: 120,
	direction: 'vertical',
	treeType: 'descendant',
	colorByGender: true,
	showLabels: true
}

/**
 * Service for generating Obsidian Canvas JSON from family trees
 */
export class CanvasGenerator {
	private layoutEngine: LayoutEngine;

	constructor() {
		this.layoutEngine = new LayoutEngine();
	}

	/**
	 * Generates Canvas JSON from a family tree
	 */
	generateCanvas(
		familyTree: FamilyTree,
		options: CanvasGenerationOptions = {}
	): CanvasData {
		const opts = { ...DEFAULT_OPTIONS, ...options };

		// Calculate layout using LayoutEngine
		const layoutResult = this.layoutEngine.calculateLayout(familyTree, opts);

		// Generate canvas nodes
		const canvasNodes: CanvasNode[] = [];
		const nodeMap = new Map<string, { x: number; y: number }>();
		const crIdToCanvasId = new Map<string, string>();

		for (const position of layoutResult.positions) {
			const { crId, person, x, y } = position;

			// Generate a canvas-compatible ID (no dashes, alphanumeric only)
			const canvasId = this.generateId();
			crIdToCanvasId.set(crId, canvasId);

			// Store position for edge generation
			nodeMap.set(crId, { x, y });

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
		}

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
	 * Generates canvas edges from family relationships
	 */
	private generateEdges(
		familyTree: FamilyTree,
		nodeMap: Map<string, { x: number; y: number }>,
		crIdToCanvasId: Map<string, string>,
		options: Required<CanvasGenerationOptions>
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
