/**
 * Canvas Generator
 *
 * Converts family tree data structures into Obsidian Canvas JSON format.
 * Handles styling and edge rendering. Uses LayoutEngine for positioning.
 */

import { FamilyTree, PersonNode } from './family-graph';
import { LayoutEngine, LayoutOptions, NodePosition } from './layout-engine';
import { FamilyChartLayoutEngine } from './family-chart-layout';

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

	/** Use family-chart layout engine (better for complex trees with spouses) */
	useFamilyChartLayout?: boolean;
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
	showLabels: true,
	useFamilyChartLayout: true  // Use family-chart by default for better layouts
}

/**
 * Service for generating Obsidian Canvas JSON from family trees
 */
export class CanvasGenerator {
	private layoutEngine: LayoutEngine;
	private familyChartLayoutEngine: FamilyChartLayoutEngine;

	constructor() {
		this.layoutEngine = new LayoutEngine();
		this.familyChartLayoutEngine = new FamilyChartLayoutEngine();
	}

	/**
	 * Generates Canvas JSON from a family tree
	 */
	generateCanvas(
		familyTree: FamilyTree,
		options: CanvasGenerationOptions = {}
	): CanvasData {
		const opts = { ...DEFAULT_OPTIONS, ...options };

		console.log('[CanvasGenerator] useFamilyChartLayout:', opts.useFamilyChartLayout);

		// Choose layout engine based on option
		const layoutResult = opts.useFamilyChartLayout
			? this.familyChartLayoutEngine.calculateLayout(familyTree, opts)
			: this.layoutEngine.calculateLayout(familyTree, opts);

		// Generate canvas nodes
		const canvasNodes: CanvasNode[] = [];
		const nodeMap = new Map<string, { x: number; y: number }>();
		const crIdToCanvasId = new Map<string, string>();

		// Process hierarchically positioned nodes
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

		// Add nodes that appear in edges but weren't positioned by the layout engine
		const spouseSpacing = opts.nodeWidth + (opts.nodeSpacingX * 0.3); // 30% of horizontal spacing

		// First pass: add spouse nodes next to their positioned partners
		for (const edge of familyTree.edges) {
			if (edge.type === 'spouse') {
				const fromPos = nodeMap.get(edge.from);
				const toPos = nodeMap.get(edge.to);

				// If one spouse is positioned but the other isn't, add the missing spouse
				if (fromPos && !toPos) {
					const spouse = familyTree.nodes.get(edge.to);
					if (spouse) {
						const canvasId = this.generateId();
						crIdToCanvasId.set(edge.to, canvasId);
						const spousePos = { x: fromPos.x + spouseSpacing, y: fromPos.y };
						nodeMap.set(edge.to, spousePos);

						canvasNodes.push({
							id: canvasId,
							type: 'file',
							file: spouse.file.path,
							x: spousePos.x,
							y: spousePos.y,
							width: opts.nodeWidth,
							height: opts.nodeHeight,
							color: opts.colorByGender ? this.getPersonColor(spouse) : undefined
						});
					}
				} else if (toPos && !fromPos) {
					const spouse = familyTree.nodes.get(edge.from);
					if (spouse) {
						const canvasId = this.generateId();
						crIdToCanvasId.set(edge.from, canvasId);
						const spousePos = { x: toPos.x - spouseSpacing, y: toPos.y };
						nodeMap.set(edge.from, spousePos);

						canvasNodes.push({
							id: canvasId,
							type: 'file',
							file: spouse.file.path,
							x: spousePos.x,
							y: spousePos.y,
							width: opts.nodeWidth,
							height: opts.nodeHeight,
							color: opts.colorByGender ? this.getPersonColor(spouse) : undefined
						});
					}
				} else if (!fromPos && !toPos) {
					// Both spouses are missing - find a child to position relative to
					const spouse1 = familyTree.nodes.get(edge.from);
					const spouse2 = familyTree.nodes.get(edge.to);
					if (spouse1 && spouse2) {
						let childPos: { x: number; y: number } | undefined;
						for (const childEdge of familyTree.edges) {
							if (childEdge.type === 'parent' &&
								(childEdge.from === edge.from || childEdge.from === edge.to)) {
								childPos = nodeMap.get(childEdge.to);
								if (childPos) break;
							}
						}

						if (childPos) {
							// Position parents above child
							const parent1Pos = { x: childPos.x - spouseSpacing / 2, y: childPos.y - opts.nodeSpacingY };
							const parent2Pos = { x: childPos.x + spouseSpacing / 2, y: childPos.y - opts.nodeSpacingY };

							const canvasId1 = this.generateId();
							crIdToCanvasId.set(edge.from, canvasId1);
							nodeMap.set(edge.from, parent1Pos);
							canvasNodes.push({
								id: canvasId1,
								type: 'file',
								file: spouse1.file.path,
								x: parent1Pos.x,
								y: parent1Pos.y,
								width: opts.nodeWidth,
								height: opts.nodeHeight,
								color: opts.colorByGender ? this.getPersonColor(spouse1) : undefined
							});

							const canvasId2 = this.generateId();
							crIdToCanvasId.set(edge.to, canvasId2);
							nodeMap.set(edge.to, parent2Pos);
							canvasNodes.push({
								id: canvasId2,
								type: 'file',
								file: spouse2.file.path,
								x: parent2Pos.x,
								y: parent2Pos.y,
								width: opts.nodeWidth,
								height: opts.nodeHeight,
								color: opts.colorByGender ? this.getPersonColor(spouse2) : undefined
							});
						}
					}
				}
			}
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

			// Filter edges to reduce clutter:
			// 1. Skip "child" edges (only show parent→child, not child→parent)
			// 2. Skip ALL spouse edges (side-by-side positioning makes them obvious)
			if (edge.type === 'child') {
				continue; // Skip child edges - we'll show parent edges instead
			}

			if (edge.type === 'spouse') {
				continue; // Skip spouse edges - visual positioning makes the relationship clear
			}

			// Determine edge sides based on direction and relationship
			// Note: We've already filtered out 'child' edges above
			let fromSide: 'top' | 'right' | 'bottom' | 'left';
			let toSide: 'top' | 'right' | 'bottom' | 'left';

			if (options.direction === 'vertical') {
				if (edge.type === 'parent') {
					// Parent-child relationships: always vertical (top-bottom)
					fromSide = 'bottom';
					toSide = 'top';
				} else {
					// Spouse relationships: horizontal (side-to-side)
					// Use horizontal edges to avoid crossing vertical parent-child lines
					if (fromPos.x < toPos.x) {
						fromSide = 'right';
						toSide = 'left';
					} else {
						fromSide = 'left';
						toSide = 'right';
					}
				}
			} else {
				// Horizontal layout
				if (edge.type === 'parent') {
					// Parent-child: horizontal
					fromSide = 'right';
					toSide = 'left';
				} else {
					// Spouse: vertical
					if (fromPos.y < toPos.y) {
						fromSide = 'bottom';
						toSide = 'top';
					} else {
						fromSide = 'top';
						toSide = 'bottom';
					}
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
	 *
	 * Note: We hide all labels because:
	 * - The visual layout (top-to-bottom for parent-child, side-by-side for spouses) makes relationships clear
	 * - Labels clutter the diagram and cause overlaps
	 * - Edge colors already distinguish relationship types
	 */
	private getEdgeLabel(_type: 'parent' | 'spouse' | 'child'): string {
		// Return empty string to hide all labels - visual layout is self-explanatory
		return '';
	}

	/**
	 * Generates a unique ID for canvas elements
	 */
	private generateId(): string {
		return Math.random().toString(36).substring(2, 15) +
			Math.random().toString(36).substring(2, 15);
	}
}
