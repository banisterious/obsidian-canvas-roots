/**
 * Canvas Navigation
 *
 * Data structures and utilities for canvas splitting, navigation nodes,
 * and linking between related canvases.
 */

import type { PersonNode } from './family-graph';

/**
 * Types of relationships between canvases
 */
export type CanvasRelationshipType =
	| 'generation-split'    // Canvas split by generation ranges
	| 'branch-split'        // Canvas split by family branches
	| 'collection-split'    // Canvas split by user collections
	| 'ancestor-descendant' // Ancestor + descendant pair
	| 'lineage-extraction'; // Single lineage extraction

/**
 * Direction of relationship to another canvas
 */
export type RelatedCanvasDirection =
	| 'ancestor'   // Related canvas contains ancestors
	| 'descendant' // Related canvas contains descendants
	| 'sibling'    // Related canvas is at same level (e.g., another branch)
	| 'parent'     // Related canvas is the source/overview
	| 'child';     // Related canvas is a subset/detail view

/**
 * Represents a canvas related to the current one
 */
export interface RelatedCanvas {
	/** Path to the related canvas file */
	path: string;

	/** Human-readable label for the relationship */
	label: string;

	/** Direction of the relationship */
	direction: RelatedCanvasDirection;

	/** Generation range covered by this canvas (for generation splits) */
	generationRange?: [number, number];

	/** Collection name (for collection splits) */
	collection?: string;

	/** Number of people in this canvas */
	personCount: number;
}

/**
 * Tracks relationships between canvases
 */
export interface CanvasRelationship {
	/** Type of split/relationship */
	type: CanvasRelationshipType;

	/** Related canvases */
	relatedCanvases: RelatedCanvas[];

	/** Path to overview canvas (if one exists) */
	overviewCanvas?: string;

	/** Timestamp when relationship was established */
	timestamp: number;
}

/**
 * Types of navigation nodes that can be created
 */
export type NavigationNodeType =
	| 'portal'      // Links to another canvas (for split boundaries)
	| 'placeholder' // Represents a person detailed elsewhere
	| 'file-link';  // Direct file link node to another canvas

/**
 * Direction indicator for navigation nodes
 */
export type NavigationDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Data for a navigation node
 */
export interface NavigationNode {
	/** Type of navigation node */
	type: NavigationNodeType;

	/** Path to target canvas */
	targetCanvas: string;

	/** Display label */
	label: string;

	/** For placeholder nodes: the person's cr_id */
	personCrId?: string;

	/** Direction indicator (for visual arrow/styling) */
	direction: NavigationDirection;

	/** Additional info to display (e.g., person count, generation range) */
	info?: string;
}

/**
 * Extended canvas metadata for navigation features
 */
export interface CanvasNavigationMetadata {
	/** Relationships to other canvases */
	relationships?: CanvasRelationship;

	/** Navigation nodes in this canvas */
	navigationNodes?: NavigationNode[];

	/** If this canvas was pruned from another, track the source */
	prunedFrom?: {
		sourceCanvas: string;
		prunedAt: number;
	};
}

/**
 * Options for split operations
 */
export interface SplitOptions {
	/** Output folder for generated canvases */
	outputFolder: string;

	/** Filename pattern (supports {name}, {type}, {date} placeholders) */
	filenamePattern: string;

	/** Generate an overview canvas linking all splits */
	generateOverview: boolean;

	/** Add navigation nodes between canvases */
	includeNavigationNodes: boolean;

	/** Maximum generations to include */
	maxGenerations?: number;

	// Destructive mode options
	/** Path to existing canvas to modify (for prune mode) */
	sourceCanvas?: string;

	/** If true, remove extracted nodes from source canvas */
	removeFromSource: boolean;

	/** If true, add portal node where removed section was */
	addNavigationNodeToSource: boolean;

	// Associated media options
	/** Include nodes with edges to extracted people */
	includeConnectedMedia: boolean;

	/** Include nodes within proximity threshold */
	includeNearbyMedia: boolean;

	/** Include nodes in same canvas group as extracted people */
	includeGroupedMedia: boolean;

	/** Pixels for nearby detection (default: 200) */
	proximityThreshold?: number;

	// Tagging options
	/** Collection name to add extracted people to */
	addToCollection?: string;

	/** If true, create collection if it doesn't exist */
	createNewCollection?: boolean;

	/** Group name to set on extracted people */
	setGroupName?: string;
}

/**
 * Options specific to lineage extraction
 */
export interface LineageOptions extends SplitOptions {
	/** Include spouses of people on the line */
	includeSpouses: boolean;

	/** Include siblings at each generation */
	includeSiblings: boolean;

	/** Direction to trace: ancestors, descendants, or auto-detect */
	lineageDirection: 'ancestors' | 'descendants' | 'auto';
}

/**
 * Association between a media node and a person
 */
export interface MediaAssociation {
	/** Canvas node ID of the media */
	mediaNodeId: string;

	/** cr_id of the associated person */
	personCrId: string;

	/** How the association was detected */
	associationType: 'edge' | 'proximity' | 'group' | 'naming';

	/** Distance in pixels (for proximity associations) */
	distance?: number;
}

/**
 * Result of a split operation
 */
export interface SplitResult {
	/** Generated canvases */
	canvases: GeneratedCanvas[];

	/** Overview canvas (if generated) */
	overviewCanvas?: GeneratedCanvas;

	/** Total number of people across all generated canvases */
	totalPeople: number;

	/** Media associations found and processed */
	mediaAssociations?: MediaAssociation[];

	/** People added to collection (if tagging was used) */
	taggedPeople?: string[];
}

/**
 * Information about a generated canvas
 */
export interface GeneratedCanvas {
	/** Path to the canvas file */
	path: string;

	/** Human-readable label */
	label: string;

	/** Number of people in this canvas */
	personCount: number;

	/** Generation range (for generation splits) */
	generationRange?: [number, number];

	/** Collection name (for collection splits) */
	collection?: string;

	/** Branch type (for branch splits) */
	branchType?: 'paternal' | 'maternal' | 'descendant' | 'custom';

	/** Anchor person for the branch */
	anchorPerson?: string;

	/** Parent branch label (for recursive splits) */
	parentBranch?: string;
}

/**
 * Service for creating navigation nodes
 */
export class NavigationNodeGenerator {
	private defaultNodeWidth = 200;
	private defaultNodeHeight = 100;

	/**
	 * Create a portal node that links to another canvas
	 *
	 * @param targetCanvas - Path to the target canvas
	 * @param label - Display label (e.g., "Ancestors", "Smith Line")
	 * @param position - Position for the node
	 * @param direction - Direction indicator
	 * @param info - Additional info (e.g., "4 more generations")
	 */
	createPortalNode(
		targetCanvas: string,
		label: string,
		position: { x: number; y: number },
		direction: NavigationDirection,
		info?: string
	): CanvasTextNode {
		const arrow = this.getDirectionArrow(direction);
		const infoLine = info ? `\n${info}` : '';

		// Create wikilink to target canvas
		const canvasName = targetCanvas.replace(/\.canvas$/, '').split('/').pop() || targetCanvas;
		const linkLine = `[[${targetCanvas}|${canvasName}]]`;

		const text = `${arrow} **${label}**${infoLine}\n${linkLine}`;

		return {
			id: this.generateId(),
			type: 'text',
			text,
			x: position.x,
			y: position.y,
			width: this.defaultNodeWidth,
			height: this.defaultNodeHeight,
			color: '5' // Cyan for navigation nodes
		};
	}

	/**
	 * Create a placeholder node for a person detailed elsewhere
	 *
	 * @param person - The person node
	 * @param targetCanvas - Path to canvas where person is detailed
	 * @param position - Position for the node
	 */
	createPlaceholderNode(
		person: PersonNode,
		targetCanvas: string,
		position: { x: number; y: number }
	): CanvasTextNode {
		const canvasName = targetCanvas.replace(/\.canvas$/, '').split('/').pop() || targetCanvas;

		const text = `**${person.name}**\n───────────\nSee: [[${targetCanvas}|${canvasName}]]`;

		return {
			id: this.generateId(),
			type: 'text',
			text,
			x: position.x,
			y: position.y,
			width: this.defaultNodeWidth,
			height: this.defaultNodeHeight,
			color: '2' // Orange for placeholder nodes
		};
	}

	/**
	 * Create a file link node to another canvas
	 *
	 * @param targetCanvas - Path to the target canvas
	 * @param position - Position for the node
	 * @param size - Optional size override
	 */
	createCanvasLinkNode(
		targetCanvas: string,
		position: { x: number; y: number },
		size?: { width: number; height: number }
	): CanvasFileNode {
		return {
			id: this.generateId(),
			type: 'file',
			file: targetCanvas,
			x: position.x,
			y: position.y,
			width: size?.width ?? this.defaultNodeWidth,
			height: size?.height ?? this.defaultNodeHeight
		};
	}

	/**
	 * Create a "back to overview" navigation node
	 *
	 * @param overviewCanvas - Path to the overview canvas
	 * @param position - Position for the node
	 */
	createBackToOverviewNode(
		overviewCanvas: string,
		position: { x: number; y: number }
	): CanvasTextNode {
		return this.createPortalNode(
			overviewCanvas,
			'Overview',
			position,
			'up',
			'Back to overview'
		);
	}

	/**
	 * Get arrow character for direction
	 */
	private getDirectionArrow(direction: NavigationDirection): string {
		switch (direction) {
			case 'up': return '↑';
			case 'down': return '↓';
			case 'left': return '←';
			case 'right': return '→';
		}
	}

	/**
	 * Generate a unique ID for canvas elements
	 */
	private generateId(): string {
		return Math.random().toString(36).substring(2, 15) +
			Math.random().toString(36).substring(2, 15);
	}
}

/**
 * Canvas text node structure (matches Obsidian Canvas spec)
 */
interface CanvasTextNode {
	id: string;
	type: 'text';
	text: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color?: string;
}

/**
 * Canvas file node structure (matches Obsidian Canvas spec)
 */
interface CanvasFileNode {
	id: string;
	type: 'file';
	file: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color?: string;
}

/**
 * Default split options
 */
export const DEFAULT_SPLIT_OPTIONS: Partial<SplitOptions> = {
	generateOverview: true,
	includeNavigationNodes: true,
	removeFromSource: false,
	addNavigationNodeToSource: true,
	includeConnectedMedia: true,
	includeNearbyMedia: false,
	includeGroupedMedia: true,
	proximityThreshold: 200
};

/**
 * Default lineage options
 */
export const DEFAULT_LINEAGE_OPTIONS: Partial<LineageOptions> = {
	...DEFAULT_SPLIT_OPTIONS,
	includeSpouses: true,
	includeSiblings: false,
	lineageDirection: 'auto'
};

/**
 * Canvas edge structure (matches Obsidian Canvas spec)
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
 * Generic canvas node (union of text and file nodes)
 */
type CanvasNode = CanvasTextNode | CanvasFileNode;

/**
 * Canvas data structure
 */
interface CanvasData {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
	metadata?: {
		version?: string;
		frontmatter?: Record<string, unknown>;
	};
}

/**
 * Result of a prune operation
 */
export interface PruneResult {
	/** Nodes that were removed */
	removedNodes: CanvasNode[];

	/** Edges that were removed */
	removedEdges: CanvasEdge[];

	/** Navigation node that was added (if requested) */
	navigationNode?: CanvasTextNode;

	/** Edges from remaining nodes to navigation node */
	navigationEdges?: CanvasEdge[];

	/** Centroid position of removed nodes */
	centroid: { x: number; y: number };

	/** Nodes that remain but had edges to removed nodes */
	affectedNodes: string[];
}

/**
 * Information about a pruned section for tracking
 */
export interface PrunedSectionInfo {
	/** When the prune occurred */
	timestamp: number;

	/** Path to the canvas containing the extracted content */
	extractedToCanvas: string;

	/** cr_ids of people that were removed */
	removedCrIds: string[];

	/** Label for the pruned section */
	label: string;

	/** Navigation node ID in the source canvas */
	navigationNodeId?: string;
}

/**
 * Service for pruning nodes from a canvas and adding navigation nodes
 */
export class CanvasPruneService {
	private navigationGenerator: NavigationNodeGenerator;

	constructor() {
		this.navigationGenerator = new NavigationNodeGenerator();
	}

	/**
	 * Remove nodes from a canvas by their IDs
	 *
	 * @param canvas - The canvas data to modify
	 * @param nodeIds - IDs of nodes to remove
	 * @param options - Prune options
	 * @returns Result containing removed nodes and any added navigation elements
	 */
	pruneNodes(
		canvas: CanvasData,
		nodeIds: Set<string>,
		options: {
			addNavigationNode: boolean;
			targetCanvas?: string;
			label?: string;
			direction?: NavigationDirection;
			info?: string;
		}
	): PruneResult {
		// Separate nodes into removed and remaining
		const removedNodes: CanvasNode[] = [];
		const remainingNodes: CanvasNode[] = [];

		for (const node of canvas.nodes) {
			if (nodeIds.has(node.id)) {
				removedNodes.push(node);
			} else {
				remainingNodes.push(node);
			}
		}

		// Identify edges to remove and edges that cross the boundary
		const removedEdges: CanvasEdge[] = [];
		const remainingEdges: CanvasEdge[] = [];
		const boundaryEdges: CanvasEdge[] = []; // Edges between removed and remaining nodes

		for (const edge of canvas.edges) {
			const fromRemoved = nodeIds.has(edge.fromNode);
			const toRemoved = nodeIds.has(edge.toNode);

			if (fromRemoved && toRemoved) {
				// Both ends removed - remove the edge
				removedEdges.push(edge);
			} else if (fromRemoved || toRemoved) {
				// One end removed - this is a boundary edge
				boundaryEdges.push(edge);
				removedEdges.push(edge);
			} else {
				// Both ends remain - keep the edge
				remainingEdges.push(edge);
			}
		}

		// Calculate centroid of removed nodes
		const centroid = this.calculateCentroid(removedNodes);

		// Find remaining nodes that were connected to removed nodes
		const affectedNodeIds = new Set<string>();
		for (const edge of boundaryEdges) {
			if (!nodeIds.has(edge.fromNode)) {
				affectedNodeIds.add(edge.fromNode);
			}
			if (!nodeIds.has(edge.toNode)) {
				affectedNodeIds.add(edge.toNode);
			}
		}

		const result: PruneResult = {
			removedNodes,
			removedEdges,
			centroid,
			affectedNodes: Array.from(affectedNodeIds)
		};

		// Create navigation node if requested
		if (options.addNavigationNode && options.targetCanvas) {
			const navNode = this.navigationGenerator.createPortalNode(
				options.targetCanvas,
				options.label || 'Extracted Content',
				centroid,
				options.direction || this.inferDirection(removedNodes, remainingNodes),
				options.info
			);

			result.navigationNode = navNode;
			remainingNodes.push(navNode);

			// Create edges from affected nodes to navigation node
			const navEdges = this.createNavigationEdges(
				Array.from(affectedNodeIds),
				navNode.id,
				boundaryEdges
			);
			result.navigationEdges = navEdges;
			remainingEdges.push(...navEdges);
		}

		// Update canvas in place
		canvas.nodes = remainingNodes;
		canvas.edges = remainingEdges;

		return result;
	}

	/**
	 * Remove nodes from canvas by cr_id (for person nodes linked to note files)
	 *
	 * @param canvas - The canvas data to modify
	 * @param crIds - cr_ids of people to remove
	 * @param options - Prune options
	 * @returns Result containing removed nodes and any added navigation elements
	 */
	pruneNodesByCrId(
		canvas: CanvasData,
		crIds: Set<string>,
		options: {
			addNavigationNode: boolean;
			targetCanvas?: string;
			label?: string;
			direction?: NavigationDirection;
			info?: string;
		}
	): PruneResult {
		// Find node IDs that correspond to the cr_ids
		const nodeIds = new Set<string>();

		for (const node of canvas.nodes) {
			if (node.type === 'file' && node.file) {
				// Extract cr_id from file path (assumes format: path/to/cr_id.md)
				const crId = this.extractCrIdFromPath(node.file);
				if (crId && crIds.has(crId)) {
					nodeIds.add(node.id);
				}
			}
		}

		return this.pruneNodes(canvas, nodeIds, options);
	}

	/**
	 * Calculate the centroid (center point) of a set of nodes
	 */
	calculateCentroid(nodes: CanvasNode[]): { x: number; y: number } {
		if (nodes.length === 0) {
			return { x: 0, y: 0 };
		}

		let sumX = 0;
		let sumY = 0;

		for (const node of nodes) {
			// Use center of node, not top-left corner
			sumX += node.x + node.width / 2;
			sumY += node.y + node.height / 2;
		}

		return {
			x: sumX / nodes.length,
			y: sumY / nodes.length
		};
	}

	/**
	 * Calculate bounding box of a set of nodes
	 */
	calculateBoundingBox(nodes: CanvasNode[]): {
		minX: number;
		minY: number;
		maxX: number;
		maxY: number;
		width: number;
		height: number;
	} {
		if (nodes.length === 0) {
			return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
		}

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for (const node of nodes) {
			minX = Math.min(minX, node.x);
			minY = Math.min(minY, node.y);
			maxX = Math.max(maxX, node.x + node.width);
			maxY = Math.max(maxY, node.y + node.height);
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

	/**
	 * Infer navigation direction based on relative positions
	 */
	private inferDirection(
		removedNodes: CanvasNode[],
		remainingNodes: CanvasNode[]
	): NavigationDirection {
		if (removedNodes.length === 0 || remainingNodes.length === 0) {
			return 'down'; // Default
		}

		const removedCentroid = this.calculateCentroid(removedNodes);
		const remainingCentroid = this.calculateCentroid(remainingNodes);

		const dx = removedCentroid.x - remainingCentroid.x;
		const dy = removedCentroid.y - remainingCentroid.y;

		// Determine primary direction
		if (Math.abs(dx) > Math.abs(dy)) {
			return dx > 0 ? 'right' : 'left';
		} else {
			return dy > 0 ? 'down' : 'up';
		}
	}

	/**
	 * Create edges from affected nodes to the navigation node
	 */
	private createNavigationEdges(
		affectedNodeIds: string[],
		navigationNodeId: string,
		originalBoundaryEdges: CanvasEdge[]
	): CanvasEdge[] {
		const edges: CanvasEdge[] = [];

		// For each affected node, create an edge to the navigation node
		// Try to preserve the original edge direction/style
		for (const nodeId of affectedNodeIds) {
			// Find original edge to get styling hints
			const originalEdge = originalBoundaryEdges.find(
				e => e.fromNode === nodeId || e.toNode === nodeId
			);

			const wasFromNode = originalEdge?.fromNode === nodeId;

			edges.push({
				id: this.generateId(),
				fromNode: wasFromNode ? nodeId : navigationNodeId,
				toNode: wasFromNode ? navigationNodeId : nodeId,
				fromSide: originalEdge?.fromSide,
				toSide: originalEdge?.toSide,
				color: '5' // Cyan to match navigation node
			});
		}

		return edges;
	}

	/**
	 * Extract cr_id from a file path
	 * Assumes files are named with cr_id: path/to/cr_id.md
	 */
	private extractCrIdFromPath(filePath: string): string | null {
		// Remove .md extension and get filename
		const match = filePath.match(/([^/]+)\.md$/);
		return match ? match[1] : null;
	}

	/**
	 * Generate a unique ID
	 */
	private generateId(): string {
		return Math.random().toString(36).substring(2, 15) +
			Math.random().toString(36).substring(2, 15);
	}
}

/**
 * Extend canvas metadata with prune tracking
 */
export interface ExtendedCanvasNavigationMetadata extends CanvasNavigationMetadata {
	/** Sections that have been pruned from this canvas */
	prunedSections?: PrunedSectionInfo[];
}
