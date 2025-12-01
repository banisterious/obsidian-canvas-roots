/**
 * Media Association Service
 *
 * Identifies and manages associations between media nodes (photos, documents, etc.)
 * and person nodes on a canvas. Supports multiple detection strategies:
 * - Edge-connected: Media has an edge to a person node
 * - Proximity-based: Media is within N pixels of a person node
 * - Group membership: Media and person share a canvas group
 * - Naming convention: Media filename contains person's name or cr_id
 */

import type { MediaAssociation } from './canvas-navigation';

/**
 * Canvas node types for media detection
 */
interface CanvasNode {
	id: string;
	type: 'file' | 'text' | 'link' | 'group';
	file?: string;
	text?: string;
	url?: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color?: string;
}

/**
 * Canvas edge structure
 */
interface CanvasEdge {
	id: string;
	fromNode: string;
	toNode: string;
}

/**
 * Canvas group structure
 */
interface CanvasGroup {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	label?: string;
}

/**
 * Canvas data structure with groups
 */
interface CanvasData {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
	groups?: CanvasGroup[];
}

/**
 * Options for media association detection
 */
export interface MediaDetectionOptions {
	/** Include nodes connected by edges */
	includeConnectedMedia: boolean;

	/** Include nodes within proximity threshold */
	includeNearbyMedia: boolean;

	/** Include nodes in same canvas group */
	includeGroupedMedia: boolean;

	/** Include nodes matching naming conventions */
	includeNamedMedia: boolean;

	/** Pixels threshold for proximity detection (default: 200) */
	proximityThreshold: number;
}

/**
 * Default media detection options
 */
export const DEFAULT_MEDIA_DETECTION_OPTIONS: MediaDetectionOptions = {
	includeConnectedMedia: true,
	includeNearbyMedia: false,
	includeGroupedMedia: true,
	includeNamedMedia: false,
	proximityThreshold: 200
};

/**
 * Result of media detection for a set of people
 */
export interface MediaDetectionResult {
	/** All media associations found */
	associations: MediaAssociation[];

	/** Media node IDs to include in extraction */
	mediaNodeIds: Set<string>;

	/** Summary counts by detection type */
	summary: {
		edgeConnected: number;
		proximityBased: number;
		groupBased: number;
		namingBased: number;
		total: number;
	};

	/** Media nodes grouped by person cr_id */
	byPerson: Map<string, MediaAssociation[]>;
}

/**
 * Information about a person node on the canvas
 */
interface PersonNodeInfo {
	nodeId: string;
	crId: string;
	name?: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Service for detecting and managing media associations with person nodes
 */
export class MediaAssociationService {
	/**
	 * Find all media nodes associated with a set of people
	 *
	 * @param canvas - Canvas data to search
	 * @param personCrIds - Set of cr_ids to find associated media for
	 * @param options - Detection options
	 * @returns Detection result with all found associations
	 */
	findAssociatedMedia(
		canvas: CanvasData,
		personCrIds: Set<string>,
		options: Partial<MediaDetectionOptions> = {}
	): MediaDetectionResult {
		const opts = { ...DEFAULT_MEDIA_DETECTION_OPTIONS, ...options };

		// Build lookup structures
		const personNodes = this.identifyPersonNodes(canvas.nodes, personCrIds);
		const personNodeIds = new Set(personNodes.map(p => p.nodeId));
		const mediaNodes = this.identifyMediaNodes(canvas.nodes, personNodeIds);

		// Collect associations from each detection method
		const associations: MediaAssociation[] = [];

		if (opts.includeConnectedMedia) {
			const edgeAssociations = this.findEdgeConnectedMedia(
				canvas.edges,
				personNodes,
				mediaNodes
			);
			associations.push(...edgeAssociations);
		}

		if (opts.includeNearbyMedia) {
			const proximityAssociations = this.findProximityMedia(
				personNodes,
				mediaNodes,
				opts.proximityThreshold
			);
			associations.push(...proximityAssociations);
		}

		if (opts.includeGroupedMedia && canvas.groups) {
			const groupAssociations = this.findGroupedMedia(
				canvas.groups,
				personNodes,
				mediaNodes
			);
			associations.push(...groupAssociations);
		}

		if (opts.includeNamedMedia) {
			const namedAssociations = this.findNamedMedia(
				personNodes,
				mediaNodes
			);
			associations.push(...namedAssociations);
		}

		// Deduplicate associations (same media may be found by multiple methods)
		const deduped = this.deduplicateAssociations(associations);

		// Build result
		return this.buildDetectionResult(deduped);
	}

	/**
	 * Identify person nodes from canvas nodes
	 */
	private identifyPersonNodes(
		nodes: CanvasNode[],
		personCrIds: Set<string>
	): PersonNodeInfo[] {
		const personNodes: PersonNodeInfo[] = [];

		for (const node of nodes) {
			if (node.type === 'file' && node.file) {
				const crId = this.extractCrIdFromPath(node.file);
				if (crId && personCrIds.has(crId)) {
					personNodes.push({
						nodeId: node.id,
						crId,
						name: this.extractNameFromPath(node.file) ?? undefined,
						x: node.x,
						y: node.y,
						width: node.width,
						height: node.height
					});
				}
			}
		}

		return personNodes;
	}

	/**
	 * Identify potential media nodes (non-person file nodes, text nodes, link nodes)
	 */
	private identifyMediaNodes(
		nodes: CanvasNode[],
		personNodeIds: Set<string>
	): CanvasNode[] {
		return nodes.filter(node => {
			// Skip person nodes
			if (personNodeIds.has(node.id)) {
				return false;
			}

			// Include file nodes (images, documents, etc.)
			if (node.type === 'file') {
				return true;
			}

			// Include text nodes (could be research notes)
			if (node.type === 'text') {
				return true;
			}

			// Include link nodes (external references)
			if (node.type === 'link') {
				return true;
			}

			return false;
		});
	}

	/**
	 * Find media connected to person nodes via edges
	 */
	private findEdgeConnectedMedia(
		edges: CanvasEdge[],
		personNodes: PersonNodeInfo[],
		mediaNodes: CanvasNode[]
	): MediaAssociation[] {
		const associations: MediaAssociation[] = [];
		const personNodeMap = new Map(personNodes.map(p => [p.nodeId, p]));
		const mediaNodeIds = new Set(mediaNodes.map(m => m.id));

		for (const edge of edges) {
			// Check if edge connects a person to a media node
			const fromPerson = personNodeMap.get(edge.fromNode);
			const toPerson = personNodeMap.get(edge.toNode);

			if (fromPerson && mediaNodeIds.has(edge.toNode)) {
				associations.push({
					mediaNodeId: edge.toNode,
					personCrId: fromPerson.crId,
					associationType: 'edge'
				});
			} else if (toPerson && mediaNodeIds.has(edge.fromNode)) {
				associations.push({
					mediaNodeId: edge.fromNode,
					personCrId: toPerson.crId,
					associationType: 'edge'
				});
			}
		}

		return associations;
	}

	/**
	 * Find media within proximity threshold of person nodes
	 */
	private findProximityMedia(
		personNodes: PersonNodeInfo[],
		mediaNodes: CanvasNode[],
		threshold: number
	): MediaAssociation[] {
		const associations: MediaAssociation[] = [];

		for (const media of mediaNodes) {
			// Find closest person node
			let closestPerson: PersonNodeInfo | null = null;
			let closestDistance = Infinity;

			for (const person of personNodes) {
				const distance = this.calculateNodeDistance(
					{ x: media.x, y: media.y, width: media.width, height: media.height },
					{ x: person.x, y: person.y, width: person.width, height: person.height }
				);

				if (distance < closestDistance) {
					closestDistance = distance;
					closestPerson = person;
				}
			}

			if (closestPerson && closestDistance <= threshold) {
				associations.push({
					mediaNodeId: media.id,
					personCrId: closestPerson.crId,
					associationType: 'proximity',
					distance: Math.round(closestDistance)
				});
			}
		}

		return associations;
	}

	/**
	 * Find media sharing canvas groups with person nodes
	 */
	private findGroupedMedia(
		groups: CanvasGroup[],
		personNodes: PersonNodeInfo[],
		mediaNodes: CanvasNode[]
	): MediaAssociation[] {
		const associations: MediaAssociation[] = [];

		for (const group of groups) {
			// Find all person nodes in this group
			const personsInGroup = personNodes.filter(p =>
				this.isNodeInGroup(p, group)
			);

			if (personsInGroup.length === 0) continue;

			// Find all media nodes in this group
			const mediaInGroup = mediaNodes.filter(m =>
				this.isNodeInGroup(m, group)
			);

			// Associate each media with all persons in the same group
			for (const media of mediaInGroup) {
				for (const person of personsInGroup) {
					associations.push({
						mediaNodeId: media.id,
						personCrId: person.crId,
						associationType: 'group'
					});
				}
			}
		}

		return associations;
	}

	/**
	 * Find media matching naming conventions (filename contains person name/cr_id)
	 */
	private findNamedMedia(
		personNodes: PersonNodeInfo[],
		mediaNodes: CanvasNode[]
	): MediaAssociation[] {
		const associations: MediaAssociation[] = [];

		for (const media of mediaNodes) {
			if (media.type !== 'file' || !media.file) continue;

			const mediaFilename = media.file.toLowerCase();

			for (const person of personNodes) {
				// Check if filename contains cr_id
				if (mediaFilename.includes(person.crId.toLowerCase())) {
					associations.push({
						mediaNodeId: media.id,
						personCrId: person.crId,
						associationType: 'naming'
					});
					continue;
				}

				// Check if filename contains person name (if available)
				if (person.name) {
					const nameParts = person.name.toLowerCase().split(/\s+/);
					// Match if filename contains at least 2 name parts (to avoid false positives)
					const matchCount = nameParts.filter(part =>
						part.length > 2 && mediaFilename.includes(part)
					).length;

					if (matchCount >= 2) {
						associations.push({
							mediaNodeId: media.id,
							personCrId: person.crId,
							associationType: 'naming'
						});
					}
				}
			}
		}

		return associations;
	}

	/**
	 * Calculate minimum distance between two rectangles (nodes)
	 */
	private calculateNodeDistance(
		a: { x: number; y: number; width: number; height: number },
		b: { x: number; y: number; width: number; height: number }
	): number {
		// Calculate edges of each rectangle
		const aLeft = a.x;
		const aRight = a.x + a.width;
		const aTop = a.y;
		const aBottom = a.y + a.height;

		const bLeft = b.x;
		const bRight = b.x + b.width;
		const bTop = b.y;
		const bBottom = b.y + b.height;

		// Calculate horizontal and vertical gaps
		const horizontalGap = Math.max(0, Math.max(aLeft - bRight, bLeft - aRight));
		const verticalGap = Math.max(0, Math.max(aTop - bBottom, bTop - aBottom));

		// If rectangles overlap, distance is 0
		if (horizontalGap === 0 && verticalGap === 0) {
			return 0;
		}

		// Otherwise, use Euclidean distance between closest edges
		return Math.sqrt(horizontalGap * horizontalGap + verticalGap * verticalGap);
	}

	/**
	 * Check if a node is contained within a group
	 */
	private isNodeInGroup(
		node: { x: number; y: number; width: number; height: number },
		group: CanvasGroup
	): boolean {
		// Check if node center is within group bounds
		const nodeCenterX = node.x + node.width / 2;
		const nodeCenterY = node.y + node.height / 2;

		return (
			nodeCenterX >= group.x &&
			nodeCenterX <= group.x + group.width &&
			nodeCenterY >= group.y &&
			nodeCenterY <= group.y + group.height
		);
	}

	/**
	 * Deduplicate associations, preferring edge > group > proximity > naming
	 */
	private deduplicateAssociations(
		associations: MediaAssociation[]
	): MediaAssociation[] {
		// Group by media node + person combination
		const byKey = new Map<string, MediaAssociation[]>();

		for (const assoc of associations) {
			const key = `${assoc.mediaNodeId}:${assoc.personCrId}`;
			const existing = byKey.get(key) || [];
			existing.push(assoc);
			byKey.set(key, existing);
		}

		// Pick best association for each combination
		const result: MediaAssociation[] = [];
		const typePriority: Record<string, number> = {
			edge: 1,
			group: 2,
			proximity: 3,
			naming: 4
		};

		for (const assocs of byKey.values()) {
			// Sort by priority and pick first
			assocs.sort((a, b) =>
				typePriority[a.associationType] - typePriority[b.associationType]
			);
			result.push(assocs[0]);
		}

		return result;
	}

	/**
	 * Build the final detection result from associations
	 */
	private buildDetectionResult(
		associations: MediaAssociation[]
	): MediaDetectionResult {
		const mediaNodeIds = new Set<string>();
		const byPerson = new Map<string, MediaAssociation[]>();

		const summary = {
			edgeConnected: 0,
			proximityBased: 0,
			groupBased: 0,
			namingBased: 0,
			total: 0
		};

		for (const assoc of associations) {
			mediaNodeIds.add(assoc.mediaNodeId);

			// Count by type
			switch (assoc.associationType) {
				case 'edge':
					summary.edgeConnected++;
					break;
				case 'proximity':
					summary.proximityBased++;
					break;
				case 'group':
					summary.groupBased++;
					break;
				case 'naming':
					summary.namingBased++;
					break;
			}

			// Group by person
			const personAssocs = byPerson.get(assoc.personCrId) || [];
			personAssocs.push(assoc);
			byPerson.set(assoc.personCrId, personAssocs);
		}

		summary.total = associations.length;

		return {
			associations,
			mediaNodeIds,
			summary,
			byPerson
		};
	}

	/**
	 * Extract cr_id from a file path
	 */
	private extractCrIdFromPath(filePath: string): string | null {
		const match = filePath.match(/([^/]+)\.md$/);
		return match ? match[1] : null;
	}

	/**
	 * Extract a readable name from a file path
	 */
	private extractNameFromPath(filePath: string): string | null {
		const match = filePath.match(/([^/]+)\.md$/);
		if (!match) return null;

		// Convert cr_id-style names to readable: "john-doe-1850" -> "John Doe 1850"
		return match[1]
			.split('-')
			.map(part => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	/**
	 * Get a human-readable summary of detection results
	 */
	formatSummary(result: MediaDetectionResult): string {
		const parts: string[] = [];

		if (result.summary.edgeConnected > 0) {
			parts.push(`${result.summary.edgeConnected} connected`);
		}
		if (result.summary.proximityBased > 0) {
			parts.push(`${result.summary.proximityBased} nearby`);
		}
		if (result.summary.groupBased > 0) {
			parts.push(`${result.summary.groupBased} grouped`);
		}
		if (result.summary.namingBased > 0) {
			parts.push(`${result.summary.namingBased} by name`);
		}

		if (parts.length === 0) {
			return 'No associated media found';
		}

		return `Found ${result.summary.total} media items (${parts.join(', ')})`;
	}

	/**
	 * Categorize media nodes by file type
	 */
	categorizeMedia(
		nodes: CanvasNode[],
		mediaNodeIds: Set<string>
	): {
		images: number;
		documents: number;
		notes: number;
		links: number;
		other: number;
	} {
		const counts = {
			images: 0,
			documents: 0,
			notes: 0,
			links: 0,
			other: 0
		};

		const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
		const documentExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];

		for (const node of nodes) {
			if (!mediaNodeIds.has(node.id)) continue;

			if (node.type === 'text') {
				counts.notes++;
			} else if (node.type === 'link') {
				counts.links++;
			} else if (node.type === 'file' && node.file) {
				const ext = node.file.substring(node.file.lastIndexOf('.')).toLowerCase();

				if (imageExtensions.includes(ext)) {
					counts.images++;
				} else if (documentExtensions.includes(ext)) {
					counts.documents++;
				} else {
					counts.other++;
				}
			} else {
				counts.other++;
			}
		}

		return counts;
	}
}
