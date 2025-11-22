/**
 * Canvas Generator
 *
 * Converts family tree data structures into Obsidian Canvas JSON format.
 * Handles styling and edge rendering. Uses LayoutEngine for positioning.
 */

import { FamilyTree, PersonNode } from './family-graph';
import { LayoutEngine, LayoutOptions } from './layout-engine';
import { FamilyChartLayoutEngine } from './family-chart-layout';
import { getLogger } from './logging';
import type { ArrowStyle } from '../settings';

const logger = getLogger('CanvasGenerator');

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
 * Obsidian Canvas edge (JSON Canvas 1.0 spec compliant)
 */
interface CanvasEdge {
	id: string;
	fromNode: string;
	fromSide?: 'top' | 'right' | 'bottom' | 'left';
	fromEnd?: 'none' | 'arrow';
	toNode: string;
	toSide?: 'top' | 'right' | 'bottom' | 'left';
	toEnd?: 'none' | 'arrow';
	color?: string;
	label?: string;
}

/**
 * Canvas Roots generation metadata stored in canvas frontmatter
 */
export interface CanvasRootsMetadata {
	/** Plugin identifier */
	plugin: 'canvas-roots';

	/** Tree generation parameters */
	generation: {
		/** Root person cr_id */
		rootCrId: string;

		/** Root person name for display */
		rootPersonName: string;

		/** Tree type */
		treeType: 'full' | 'ancestors' | 'descendants';

		/** Maximum generations (0 = unlimited) */
		maxGenerations: number;

		/** Whether spouses are included */
		includeSpouses: boolean;

		/** Layout direction */
		direction: 'vertical' | 'horizontal';

		/** Timestamp when generated */
		timestamp: number;
	};

	/** Layout parameters used */
	layout: {
		nodeWidth: number;
		nodeHeight: number;
		nodeSpacingX: number;
		nodeSpacingY: number;
	};
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

	/** Optional metadata to embed in canvas (for smart re-layout) */
	canvasRootsMetadata?: CanvasRootsMetadata;

	/** Arrow style for parent-child relationships */
	parentChildArrowStyle?: ArrowStyle;

	/** Arrow style for spouse relationships */
	spouseArrowStyle?: ArrowStyle;
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
		// Merge options with defaults, ensuring all required fields are present
		const opts = {
			nodeSpacingX: options.nodeSpacingX ?? 300,
			nodeSpacingY: options.nodeSpacingY ?? 200,
			nodeWidth: options.nodeWidth ?? 250,
			nodeHeight: options.nodeHeight ?? 120,
			direction: options.direction ?? 'vertical' as const,
			treeType: options.treeType ?? 'descendant' as const,
			colorByGender: options.colorByGender ?? true,
			showLabels: options.showLabels ?? true,
			useFamilyChartLayout: options.useFamilyChartLayout ?? true,
			parentChildArrowStyle: options.parentChildArrowStyle ?? 'directed' as const,
			spouseArrowStyle: options.spouseArrowStyle ?? 'undirected' as const
		};
		const metadata = options.canvasRootsMetadata;

		logger.debug('canvas-generation', 'Canvas generation options', {
			useFamilyChartLayout: opts.useFamilyChartLayout,
			hasMetadata: !!metadata,
			metadataKeys: metadata ? Object.keys(metadata) : null
		});

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
				frontmatter: metadata ? (metadata as unknown as Record<string, unknown>) : {}
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
		options: {
			nodeSpacingX: number;
			nodeSpacingY: number;
			nodeWidth: number;
			nodeHeight: number;
			direction: 'vertical' | 'horizontal';
			treeType: 'ancestor' | 'descendant' | 'full';
			colorByGender: boolean;
			showLabels: boolean;
			useFamilyChartLayout: boolean;
			parentChildArrowStyle: ArrowStyle;
			spouseArrowStyle: ArrowStyle;
		}
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

			// Determine arrow endpoints based on relationship type and settings
			const arrowStyle = edge.type === 'parent' 
				? options.parentChildArrowStyle
				: options.spouseArrowStyle;
			const [fromEnd, toEnd] = this.getArrowEndpoints(arrowStyle);

			edges.push({
				id: this.generateId(),
				fromNode: fromCanvasId,
				fromSide,
				fromEnd,
				toNode: toCanvasId,
				toSide,
				toEnd,
				color: this.getEdgeColor(edge.type),
				label: options.showLabels ? this.getEdgeLabel(edge.type) : undefined
			});
		}

		return edges;
	}

	/**
	 * Converts ArrowStyle to Canvas edge endpoint values
	 * @param style - Arrow style setting
	 * @returns Tuple of [fromEnd, toEnd] values
	 */
	private getArrowEndpoints(style: ArrowStyle): ['none' | 'arrow', 'none' | 'arrow'] {
		switch (style) {
			case 'directed':
				return ['none', 'arrow'];  // Standard: → (arrow pointing forward)
			case 'bidirectional':
				return ['arrow', 'arrow']; // Both ends: ↔ (arrows on both ends)
			case 'undirected':
				return ['none', 'none'];   // No arrows: — (just a line)
			default:
				return ['none', 'arrow'];  // Fallback to directed
		}
	}

	/**
	 * Gets color for person node based on sex/gender from frontmatter
	 * Uses Obsidian's 6 canvas colors:
	 * 1 = Red, 2 = Orange, 3 = Yellow, 4 = Green, 5 = Blue, 6 = Purple
	 */
	private getPersonColor(person: PersonNode): string {
		// Use sex field from frontmatter if available
		if (person.sex) {
			const sex = person.sex.toUpperCase();
			if (sex === 'M' || sex === 'MALE') {
				return '4'; // Green for males
			}
			if (sex === 'F' || sex === 'FEMALE') {
				return '6'; // Purple for females
			}
		}

		// Fallback: try to infer from name prefixes (legacy support)
		const name = person.name.toLowerCase();
		if (name.includes('mr.') || name.includes('sr.') || name.includes('jr.')) {
			return '4'; // Green
		}
		if (name.includes('mrs.') || name.includes('ms.') || name.includes('miss')) {
			return '6'; // Purple
		}

		// Default: neutral gray for unknown gender
		return '2'; // Orange (neutral)
	}

	/**
	 * Gets color for edge based on relationship type
	 * Uses Obsidian's 6 canvas colors:
	 * 1 = Red, 2 = Orange, 3 = Yellow, 4 = Green, 5 = Blue, 6 = Purple
	 */
	private getEdgeColor(type: 'parent' | 'spouse' | 'child'): string {
		switch (type) {
			case 'parent':
			case 'child':
				return '1'; // Red for parent-child relationships
			case 'spouse':
				return '5'; // Blue for spouse relationships
			default:
				return '3'; // Yellow default
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
