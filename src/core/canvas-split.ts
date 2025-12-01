/**
 * Canvas Split Service
 *
 * Service for splitting family tree canvases into smaller, linked canvases.
 * Supports splitting by generation ranges, branches, collections, and lineage extraction.
 */

import { App, TFile } from 'obsidian';
import type { PersonNode, FamilyTree, FamilyEdge } from './family-graph';
import type {
	SplitOptions,
	SplitResult,
	GeneratedCanvas,
	NavigationDirection,
	CanvasRelationshipType,
	RelatedCanvas
} from './canvas-navigation';
import { NavigationNodeGenerator, DEFAULT_SPLIT_OPTIONS } from './canvas-navigation';
import { MediaAssociationService, type MediaDetectionOptions, type MediaDetectionResult } from './media-association';
import { CanvasGenerator, type CanvasGenerationOptions } from './canvas-generator';
import type { CanvasData } from './canvas-generator';
import {
	writeCanvasFile,
	toSafeFilename,
	type CanvasWriteResult
} from './canvas-utils';
import { getLogger } from './logging';

const logger = getLogger('CanvasSplit');

/**
 * Generation range for splitting
 */
export interface GenerationRange {
	/** Start generation (inclusive, 0 = root) */
	start: number;
	/** End generation (inclusive) */
	end: number;
	/** Label for this range */
	label: string;
}

/**
 * Result of assigning people to generation ranges
 */
export interface GenerationAssignment {
	/** People in each range, keyed by range label */
	byRange: Map<string, PersonNode[]>;
	/** Generation number for each person */
	generationMap: Map<string, number>;
	/** Min and max generation numbers found */
	generationBounds: { min: number; max: number };
	/** Boundary people (appear at edges of ranges, need navigation nodes) */
	boundaryPeople: Map<string, { person: PersonNode; adjacentRanges: string[] }>;
}

/**
 * Options for generation-based splitting
 */
export interface GenerationSplitOptions extends Partial<SplitOptions> {
	/** Number of generations per canvas */
	generationsPerCanvas: number;
	/** Custom ranges (overrides generationsPerCanvas) */
	customRanges?: GenerationRange[];
	/** Direction to count generations: 'up' (ancestors) or 'down' (descendants) */
	generationDirection: 'up' | 'down';
}

/**
 * Default generation split options
 */
export const DEFAULT_GENERATION_SPLIT_OPTIONS: GenerationSplitOptions = {
	...DEFAULT_SPLIT_OPTIONS,
	generationsPerCanvas: 4,
	generationDirection: 'up'
};

/**
 * Branch type for splitting
 */
export type BranchType = 'paternal' | 'maternal' | 'descendant' | 'custom';

/**
 * Branch definition for splitting
 */
export interface BranchDefinition {
	/** Type of branch */
	type: BranchType;
	/** Anchor person (the person this branch extends from) */
	anchorCrId: string;
	/** Label for this branch */
	label: string;
	/** For descendant branches, the child's crId */
	childCrId?: string;
	/** For custom branches, specific ancestor crId */
	ancestorCrId?: string;
	/** Maximum generations to include (undefined = all) */
	maxGenerations?: number;
}

/**
 * Result of branch extraction
 */
export interface BranchExtractionResult {
	/** People included in this branch */
	people: PersonNode[];
	/** CrIds of people in the branch */
	crIds: Set<string>;
	/** Root of this branch (paternal/maternal grandparent, or child for descendant) */
	branchRoot: PersonNode | undefined;
	/** Boundary people who connect to other branches */
	boundaryPeople: Map<string, { person: PersonNode; connectedBranches: string[] }>;
	/** Generation depth achieved */
	generationDepth: number;
}

/**
 * Options for branch-based splitting
 */
export interface BranchSplitOptions extends Partial<SplitOptions> {
	/** Branches to extract */
	branches: BranchDefinition[];
	/** Include spouses of branch members */
	includeSpouses: boolean;
	/** Maximum recursion depth for recursive splitting (0 = no recursion) */
	recursionDepth: number;
	/** Whether to create sub-branches for each grandparent line */
	splitGrandparentLines: boolean;
}

/**
 * Default branch split options
 */
export const DEFAULT_BRANCH_SPLIT_OPTIONS: BranchSplitOptions = {
	...DEFAULT_SPLIT_OPTIONS,
	branches: [],
	includeSpouses: true,
	recursionDepth: 0,
	splitGrandparentLines: false
};

/**
 * Options for collection-based splitting
 */
export interface CollectionSplitOptions extends Partial<SplitOptions> {
	/** Specific collections to extract (empty = all collections) */
	collections?: string[];
	/** Include people with no collection in a separate canvas */
	includeUncollected: boolean;
	/** Label for uncollected people canvas */
	uncollectedLabel: string;
	/** How to handle bridge people (people in multiple collections) */
	bridgePeopleHandling: 'duplicate' | 'primary-only' | 'separate-canvas';
	/** For 'primary-only', which collection takes priority (first alphabetically if not specified) */
	primaryCollectionOrder?: string[];
}

/**
 * Default collection split options
 */
export const DEFAULT_COLLECTION_SPLIT_OPTIONS: CollectionSplitOptions = {
	...DEFAULT_SPLIT_OPTIONS,
	includeUncollected: true,
	uncollectedLabel: 'Uncollected',
	bridgePeopleHandling: 'duplicate'
};

/**
 * Options for lineage extraction (direct line between two people)
 */
export interface LineageSplitOptions extends Partial<SplitOptions> {
	/** Starting person crId */
	startCrId: string;
	/** Ending person crId */
	endCrId: string;
	/** Include spouses of people on the lineage */
	includeSpouses: boolean;
	/** Include siblings at each generation */
	includeSiblings: boolean;
	/** Label for the lineage canvas */
	label?: string;
}

/**
 * Default lineage split options
 */
export const DEFAULT_LINEAGE_SPLIT_OPTIONS: Omit<LineageSplitOptions, 'startCrId' | 'endCrId'> = {
	...DEFAULT_SPLIT_OPTIONS,
	includeSpouses: true,
	includeSiblings: false
};

/**
 * Result of lineage extraction
 */
export interface LineageExtractionResult {
	/** Whether a path was found */
	pathFound: boolean;
	/** People on the direct line (in order from start to end) */
	lineagePath: PersonNode[];
	/** CrIds of people on the direct line */
	lineageCrIds: Set<string>;
	/** All people included (line + spouses + siblings) */
	allPeople: PersonNode[];
	/** All crIds included */
	allCrIds: Set<string>;
	/** Number of generations in the path */
	generationCount: number;
	/** Relationship description (e.g., "3x great-grandfather") */
	relationshipDescription: string;
}

/**
 * Node in pathfinding search
 */
interface PathNode {
	crId: string;
	parent: PathNode | null;
	relationship: 'parent' | 'child' | 'spouse';
}

/**
 * Options for generating ancestor-descendant canvas pairs
 */
export interface AncestorDescendantSplitOptions extends Partial<SplitOptions> {
	/** The root person's crId (center of both canvases) */
	rootCrId: string;
	/** Include spouses in both canvases */
	includeSpouses: boolean;
	/** Maximum generations to include for ancestors (undefined = all) */
	maxAncestorGenerations?: number;
	/** Maximum generations to include for descendants (undefined = all) */
	maxDescendantGenerations?: number;
	/** Label prefix for generated canvases */
	labelPrefix?: string;
	/** Generate an overview canvas linking both */
	generateOverview: boolean;
}

/**
 * Default ancestor-descendant split options
 */
export const DEFAULT_ANCESTOR_DESCENDANT_OPTIONS: Omit<AncestorDescendantSplitOptions, 'rootCrId'> = {
	...DEFAULT_SPLIT_OPTIONS,
	includeSpouses: true,
	generateOverview: true
};

/**
 * Options for surname-based splitting
 */
export interface SurnameSplitOptions extends Partial<SplitOptions> {
	/** Surnames to extract */
	surnames: string[];
	/** Include spouses of matching people (even with different surnames) */
	includeSpouses: boolean;
	/** Also match maiden names from frontmatter */
	includeMaidenNames: boolean;
	/** Handle spelling variants (future feature) */
	handleVariants: boolean;
	/** Create separate canvases per surname vs one combined canvas */
	separateCanvases: boolean;
}

/**
 * Default surname split options
 */
export const DEFAULT_SURNAME_SPLIT_OPTIONS: Omit<SurnameSplitOptions, 'surnames'> = {
	...DEFAULT_SPLIT_OPTIONS,
	includeSpouses: true,
	includeMaidenNames: true,
	handleVariants: true,
	separateCanvases: true
};

/**
 * Result of surname extraction
 */
export interface SurnameExtractionResult {
	/** People matching each surname */
	bySurname: Map<string, PersonNode[]>;
	/** Spouses included (keyed by their surname, value is original person's surname) */
	spouses: Map<string, string>;
	/** Total people extracted */
	totalPeople: number;
	/** Total unique people (some may appear in multiple if they have variant surnames) */
	uniquePeople: Set<string>;
}

/**
 * Preview result for surname split
 */
export interface SurnameSplitPreview {
	/** Surnames and their counts */
	surnames: Array<{ name: string; count: number }>;
	/** Total people to be extracted */
	totalPeople: number;
	/** Number of canvases that will be created */
	canvasCount: number;
	/** Spouse count (included but with different surname) */
	spouseCount: number;
}

/**
 * Result of ancestor or descendant extraction
 */
export interface DirectionalExtractionResult {
	/** People extracted */
	people: PersonNode[];
	/** CrIds of extracted people */
	crIds: Set<string>;
	/** Number of generations found */
	generationCount: number;
	/** Root person included */
	rootPerson: PersonNode;
}

/**
 * Result of ancestor-descendant pair generation
 */
export interface AncestorDescendantResult {
	/** Ancestor canvas info */
	ancestorCanvas: GeneratedCanvas;
	/** Descendant canvas info */
	descendantCanvas: GeneratedCanvas;
	/** Overview canvas (if generated) */
	overviewCanvas?: GeneratedCanvas;
	/** Root person who is the center */
	rootPerson: PersonNode;
	/** Total people across both canvases (excluding duplicates) */
	totalUniquePeople: number;
}

/**
 * Information about a collection for splitting
 */
export interface CollectionInfo {
	/** Collection name */
	name: string;
	/** People in this collection */
	people: PersonNode[];
	/** CrIds of people in this collection */
	crIds: Set<string>;
	/** Bridge people (also in other collections) */
	bridgePeople: Map<string, string[]>; // crId -> other collection names
	/** People count */
	count: number;
}

/**
 * Result of collection extraction
 */
export interface CollectionExtractionResult {
	/** Collections found and their contents */
	collections: Map<string, CollectionInfo>;
	/** People with no collection */
	uncollected: PersonNode[];
	/** All bridge people across collections */
	allBridgePeople: Map<string, string[]>; // crId -> collection names
}

/**
 * Internal canvas data structure for manipulation (used by split operations)
 * Note: This is separate from CanvasData imported from canvas-generator
 */
interface InternalCanvasData {
	nodes: InternalCanvasNode[];
	edges: InternalCanvasEdge[];
	groups?: InternalCanvasGroup[];
}

interface InternalCanvasNode {
	id: string;
	type: 'file' | 'text' | 'link' | 'group';
	file?: string;
	text?: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color?: string;
}

interface InternalCanvasEdge {
	id: string;
	fromNode: string;
	toNode: string;
	fromSide?: 'top' | 'right' | 'bottom' | 'left';
	toSide?: 'top' | 'right' | 'bottom' | 'left';
	color?: string;
	label?: string;
}

interface InternalCanvasGroup {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	label?: string;
}

/**
 * Service for splitting family tree canvases
 */
export class CanvasSplitService {
	private navigationGenerator: NavigationNodeGenerator;
	private mediaService: MediaAssociationService;

	constructor() {
		this.navigationGenerator = new NavigationNodeGenerator();
		this.mediaService = new MediaAssociationService();
	}

	/**
	 * Split a family tree by generation ranges
	 *
	 * @param tree - The family tree to split
	 * @param options - Split options
	 * @returns Split result with generated canvas information
	 */
	splitByGeneration(
		tree: FamilyTree,
		options: GenerationSplitOptions
	): SplitResult {
		const opts = { ...DEFAULT_GENERATION_SPLIT_OPTIONS, ...options };

		// Calculate generations for all people
		const assignment = this.assignGenerations(tree, opts.generationDirection);

		// Create generation ranges
		const ranges = opts.customRanges || this.createGenerationRanges(
			assignment.generationBounds,
			opts.generationsPerCanvas,
			opts.generationDirection
		);

		// Assign people to ranges
		this.assignPeopleToRanges(assignment, ranges);

		// Generate canvas info for each range
		const canvases: GeneratedCanvas[] = [];
		const relatedCanvases: RelatedCanvas[] = [];

		for (const range of ranges) {
			const people = assignment.byRange.get(range.label) || [];
			if (people.length === 0) continue;

			const canvasPath = this.generateCanvasPath(opts, range.label);

			const canvas: GeneratedCanvas = {
				path: canvasPath,
				label: range.label,
				personCount: people.length,
				generationRange: [range.start, range.end]
			};
			canvases.push(canvas);

			// Build related canvas info
			const direction = this.getRelationshipDirection(range, ranges, opts.generationDirection);
			relatedCanvases.push({
				path: canvasPath,
				label: range.label,
				direction,
				generationRange: [range.start, range.end],
				personCount: people.length
			});
		}

		// Calculate total people
		const totalPeople = Array.from(assignment.byRange.values())
			.reduce((sum, people) => sum + people.length, 0);

		return {
			canvases,
			totalPeople
		};
	}

	/**
	 * Calculate generation numbers for all people in the tree
	 *
	 * @param tree - The family tree
	 * @param direction - 'up' for ancestors (positive generations), 'down' for descendants
	 * @returns Generation assignment result
	 */
	assignGenerations(
		tree: FamilyTree,
		direction: 'up' | 'down'
	): GenerationAssignment {
		const generationMap = new Map<string, number>();
		const byRange = new Map<string, PersonNode[]>();
		let minGen = 0;
		let maxGen = 0;

		// BFS to assign generations
		const visited = new Set<string>();
		const queue: Array<{ crId: string; generation: number }> = [
			{ crId: tree.root.crId, generation: 0 }
		];

		while (queue.length > 0) {
			const { crId, generation } = queue.shift()!;

			if (visited.has(crId)) continue;
			visited.add(crId);

			const person = tree.nodes.get(crId);
			if (!person) continue;

			generationMap.set(crId, generation);
			minGen = Math.min(minGen, generation);
			maxGen = Math.max(maxGen, generation);

			// Traverse based on direction
			if (direction === 'up') {
				// Parents are +1 generation (further back in time)
				if (person.fatherCrId && tree.nodes.has(person.fatherCrId)) {
					queue.push({ crId: person.fatherCrId, generation: generation + 1 });
				}
				if (person.motherCrId && tree.nodes.has(person.motherCrId)) {
					queue.push({ crId: person.motherCrId, generation: generation + 1 });
				}
				// Children are -1 generation (closer to present)
				for (const childId of person.childrenCrIds) {
					if (tree.nodes.has(childId)) {
						queue.push({ crId: childId, generation: generation - 1 });
					}
				}
			} else {
				// Children are +1 generation (further from root)
				for (const childId of person.childrenCrIds) {
					if (tree.nodes.has(childId)) {
						queue.push({ crId: childId, generation: generation + 1 });
					}
				}
				// Parents are -1 generation (closer to root)
				if (person.fatherCrId && tree.nodes.has(person.fatherCrId)) {
					queue.push({ crId: person.fatherCrId, generation: generation - 1 });
				}
				if (person.motherCrId && tree.nodes.has(person.motherCrId)) {
					queue.push({ crId: person.motherCrId, generation: generation - 1 });
				}
			}

			// Spouses stay at same generation
			for (const spouseId of person.spouseCrIds) {
				if (tree.nodes.has(spouseId) && !visited.has(spouseId)) {
					queue.push({ crId: spouseId, generation });
				}
			}
		}

		return {
			byRange,
			generationMap,
			generationBounds: { min: minGen, max: maxGen },
			boundaryPeople: new Map()
		};
	}

	/**
	 * Create generation ranges based on bounds and size
	 */
	private createGenerationRanges(
		bounds: { min: number; max: number },
		generationsPerCanvas: number,
		direction: 'up' | 'down'
	): GenerationRange[] {
		const ranges: GenerationRange[] = [];

		if (direction === 'up') {
			// Start from 0 (root) and go up
			for (let start = 0; start <= bounds.max; start += generationsPerCanvas) {
				const end = Math.min(start + generationsPerCanvas - 1, bounds.max);
				ranges.push({
					start,
					end,
					label: this.formatGenerationLabel(start, end, 'ancestors')
				});
			}
			// Handle negative generations (descendants of root)
			if (bounds.min < 0) {
				for (let end = -1; end >= bounds.min; end -= generationsPerCanvas) {
					const start = Math.max(end - generationsPerCanvas + 1, bounds.min);
					ranges.unshift({
						start,
						end,
						label: this.formatGenerationLabel(start, end, 'descendants')
					});
				}
			}
		} else {
			// Start from 0 (root) and go down
			for (let start = 0; start <= bounds.max; start += generationsPerCanvas) {
				const end = Math.min(start + generationsPerCanvas - 1, bounds.max);
				ranges.push({
					start,
					end,
					label: this.formatGenerationLabel(start, end, 'descendants')
				});
			}
			// Handle negative generations (ancestors of root)
			if (bounds.min < 0) {
				for (let end = -1; end >= bounds.min; end -= generationsPerCanvas) {
					const start = Math.max(end - generationsPerCanvas + 1, bounds.min);
					ranges.unshift({
						start,
						end,
						label: this.formatGenerationLabel(start, end, 'ancestors')
					});
				}
			}
		}

		return ranges;
	}

	/**
	 * Format a human-readable label for a generation range
	 */
	private formatGenerationLabel(start: number, end: number, type: 'ancestors' | 'descendants'): string {
		if (start === 0 && end === 0) {
			return 'Root';
		}

		const absStart = Math.abs(start);
		const absEnd = Math.abs(end);

		if (start === end) {
			return `Gen ${absStart}`;
		}

		if (type === 'ancestors') {
			if (start === 0) {
				return `Root to Gen ${absEnd}`;
			}
			return `Gen ${absStart}-${absEnd}`;
		} else {
			if (start === 0) {
				return `Root to Gen ${absEnd}`;
			}
			return `Gen ${absStart}-${absEnd}`;
		}
	}

	/**
	 * Assign people to their respective generation ranges
	 */
	private assignPeopleToRanges(
		assignment: GenerationAssignment,
		ranges: GenerationRange[]
	): void {
		// Initialize range buckets
		for (const range of ranges) {
			assignment.byRange.set(range.label, []);
		}

		// For each person, find their range and assign them
		// Note: We need the tree to get PersonNode objects
		// This is a simplified version - in practice, we'd pass the tree
	}

	/**
	 * Get people in a specific generation range from the tree
	 */
	getPeopleInRange(
		tree: FamilyTree,
		assignment: GenerationAssignment,
		range: GenerationRange
	): PersonNode[] {
		const people: PersonNode[] = [];

		for (const [crId, generation] of assignment.generationMap.entries()) {
			if (generation >= range.start && generation <= range.end) {
				const person = tree.nodes.get(crId);
				if (person) {
					people.push(person);
				}
			}
		}

		return people;
	}

	/**
	 * Find people at the boundaries between ranges (need navigation nodes)
	 */
	findBoundaryPeople(
		tree: FamilyTree,
		assignment: GenerationAssignment,
		ranges: GenerationRange[]
	): Map<string, { person: PersonNode; adjacentRanges: string[] }> {
		const boundary = new Map<string, { person: PersonNode; adjacentRanges: string[] }>();

		for (const [crId, generation] of assignment.generationMap.entries()) {
			const person = tree.nodes.get(crId);
			if (!person) continue;

			// Check if this person is at a range boundary
			const adjacentRanges: string[] = [];

			for (const range of ranges) {
				// Person is at the edge of this range
				if (generation === range.start || generation === range.end) {
					// Check if they have connections to another range
					const connectedGens = this.getConnectedGenerations(person, tree, assignment);

					for (const connectedGen of connectedGens) {
						// Find which range the connected person is in
						const connectedRange = ranges.find(r =>
							connectedGen >= r.start && connectedGen <= r.end
						);
						if (connectedRange && connectedRange.label !== range.label) {
							if (!adjacentRanges.includes(connectedRange.label)) {
								adjacentRanges.push(connectedRange.label);
							}
						}
					}
				}
			}

			if (adjacentRanges.length > 0) {
				boundary.set(crId, { person, adjacentRanges });
			}
		}

		return boundary;
	}

	/**
	 * Get generations of all directly connected people
	 */
	private getConnectedGenerations(
		person: PersonNode,
		tree: FamilyTree,
		assignment: GenerationAssignment
	): number[] {
		const generations: number[] = [];

		// Parents
		if (person.fatherCrId) {
			const gen = assignment.generationMap.get(person.fatherCrId);
			if (gen !== undefined) generations.push(gen);
		}
		if (person.motherCrId) {
			const gen = assignment.generationMap.get(person.motherCrId);
			if (gen !== undefined) generations.push(gen);
		}

		// Children
		for (const childId of person.childrenCrIds) {
			const gen = assignment.generationMap.get(childId);
			if (gen !== undefined) generations.push(gen);
		}

		return generations;
	}

	/**
	 * Generate navigation nodes for range boundaries
	 */
	generateBoundaryNavigationNodes(
		tree: FamilyTree,
		assignment: GenerationAssignment,
		sourceRange: GenerationRange,
		targetRange: GenerationRange,
		targetCanvasPath: string
	): Array<{ node: ReturnType<NavigationNodeGenerator['createPortalNode']>; nearPerson: PersonNode }> {
		const nodes: Array<{ node: ReturnType<NavigationNodeGenerator['createPortalNode']>; nearPerson: PersonNode }> = [];

		// Find boundary people between these ranges
		const boundaryPeople = this.findBoundaryPeople(tree, assignment, [sourceRange, targetRange]);

		for (const [, { person, adjacentRanges }] of boundaryPeople.entries()) {
			if (adjacentRanges.includes(targetRange.label)) {
				const personGen = assignment.generationMap.get(person.crId);
				if (personGen === undefined) continue;

				// Determine direction based on generation relationship
				const direction: NavigationDirection = targetRange.start > sourceRange.end ? 'up' : 'down';

				// Create portal node
				const countInTarget = this.getPeopleInRange(tree, assignment, targetRange).length;
				const node = this.navigationGenerator.createPortalNode(
					targetCanvasPath,
					targetRange.label,
					{ x: 0, y: 0 }, // Position will be set based on person's position
					direction,
					`${countInTarget} people`
				);

				nodes.push({ node, nearPerson: person });
			}
		}

		return nodes;
	}

	/**
	 * Get relationship direction for a range relative to others
	 */
	private getRelationshipDirection(
		range: GenerationRange,
		allRanges: GenerationRange[],
		generationDirection: 'up' | 'down'
	): 'ancestor' | 'descendant' | 'sibling' {
		// Find this range's position in the sorted list
		const sortedRanges = [...allRanges].sort((a, b) => a.start - b.start);
		const index = sortedRanges.findIndex(r => r.label === range.label);

		if (index === 0) {
			return generationDirection === 'up' ? 'descendant' : 'ancestor';
		} else if (index === sortedRanges.length - 1) {
			return generationDirection === 'up' ? 'ancestor' : 'descendant';
		}

		return 'sibling';
	}

	/**
	 * Generate canvas file path based on options and label
	 */
	private generateCanvasPath(options: GenerationSplitOptions, label: string): string {
		const folder = options.outputFolder || '';
		const pattern = options.filenamePattern || '{name}';

		// Replace placeholders
		const filename = pattern
			.replace('{name}', this.sanitizeFilename(label))
			.replace('{type}', 'generation')
			.replace('{date}', new Date().toISOString().split('T')[0]);

		const extension = filename.endsWith('.canvas') ? '' : '.canvas';

		if (folder) {
			return `${folder}/${filename}${extension}`;
		}
		return `${filename}${extension}`;
	}

	/**
	 * Sanitize a string for use as a filename
	 */
	private sanitizeFilename(name: string): string {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

	/**
	 * Get edges that cross between two generation ranges
	 */
	getCrossingEdges(
		tree: FamilyTree,
		assignment: GenerationAssignment,
		rangeA: GenerationRange,
		rangeB: GenerationRange
	): FamilyEdge[] {
		const crossingEdges: FamilyEdge[] = [];

		for (const edge of tree.edges) {
			const fromGen = assignment.generationMap.get(edge.from);
			const toGen = assignment.generationMap.get(edge.to);

			if (fromGen === undefined || toGen === undefined) continue;

			const fromInA = fromGen >= rangeA.start && fromGen <= rangeA.end;
			const fromInB = fromGen >= rangeB.start && fromGen <= rangeB.end;
			const toInA = toGen >= rangeA.start && toGen <= rangeA.end;
			const toInB = toGen >= rangeB.start && toGen <= rangeB.end;

			// Edge crosses if one end is in A and other is in B
			if ((fromInA && toInB) || (fromInB && toInA)) {
				crossingEdges.push(edge);
			}
		}

		return crossingEdges;
	}

	/**
	 * Preview a generation split without actually creating files
	 */
	previewGenerationSplit(
		tree: FamilyTree,
		options: GenerationSplitOptions
	): {
		ranges: GenerationRange[];
		peopleCounts: Map<string, number>;
		boundaryCount: number;
		totalPeople: number;
	} {
		const opts = { ...DEFAULT_GENERATION_SPLIT_OPTIONS, ...options };
		const assignment = this.assignGenerations(tree, opts.generationDirection);

		const ranges = opts.customRanges || this.createGenerationRanges(
			assignment.generationBounds,
			opts.generationsPerCanvas,
			opts.generationDirection
		);

		const peopleCounts = new Map<string, number>();
		let totalPeople = 0;

		for (const range of ranges) {
			const people = this.getPeopleInRange(tree, assignment, range);
			peopleCounts.set(range.label, people.length);
			totalPeople += people.length;
		}

		const boundaryPeople = this.findBoundaryPeople(tree, assignment, ranges);

		return {
			ranges,
			peopleCounts,
			boundaryCount: boundaryPeople.size,
			totalPeople
		};
	}

	/**
	 * Find associated media for a set of people
	 */
	findAssociatedMedia(
		canvas: CanvasData,
		personCrIds: Set<string>,
		options?: Partial<MediaDetectionOptions>
	): MediaDetectionResult {
		return this.mediaService.findAssociatedMedia(canvas, personCrIds, options);
	}

	/**
	 * Generate a unique ID
	 */
	private generateId(): string {
		return Math.random().toString(36).substring(2, 15) +
			Math.random().toString(36).substring(2, 15);
	}

	// =========================================================================
	// Phase 5: Branch-Based Splitting
	// =========================================================================

	/**
	 * Split a family tree by branches (paternal/maternal lines, descendants)
	 *
	 * @param tree - The family tree to split
	 * @param options - Branch split options
	 * @returns Split result with generated canvas information
	 */
	splitByBranch(
		tree: FamilyTree,
		options: BranchSplitOptions
	): SplitResult {
		const opts = { ...DEFAULT_BRANCH_SPLIT_OPTIONS, ...options };
		const canvases: GeneratedCanvas[] = [];
		let totalPeople = 0;

		for (const branch of opts.branches) {
			const extraction = this.extractBranch(tree, branch, opts);

			if (extraction.people.length === 0) continue;

			const canvasPath = this.generateBranchCanvasPath(opts, branch);

			const canvas: GeneratedCanvas = {
				path: canvasPath,
				label: branch.label,
				personCount: extraction.people.length,
				branchType: branch.type,
				anchorPerson: branch.anchorCrId
			};
			canvases.push(canvas);
			totalPeople += extraction.people.length;

			// Handle recursive splitting if enabled
			if (opts.splitGrandparentLines && opts.recursionDepth > 0) {
				const subBranches = this.generateGrandparentBranches(
					tree,
					extraction,
					branch,
					opts.recursionDepth - 1
				);

				for (const subBranch of subBranches) {
					const subExtraction = this.extractBranch(tree, subBranch, opts);
					if (subExtraction.people.length === 0) continue;

					const subCanvasPath = this.generateBranchCanvasPath(opts, subBranch);

					canvases.push({
						path: subCanvasPath,
						label: subBranch.label,
						personCount: subExtraction.people.length,
						branchType: subBranch.type,
						anchorPerson: subBranch.anchorCrId,
						parentBranch: branch.label
					});
					totalPeople += subExtraction.people.length;
				}
			}
		}

		return {
			canvases,
			totalPeople
		};
	}

	/**
	 * Extract all people belonging to a specific branch
	 *
	 * @param tree - The family tree
	 * @param branch - Branch definition
	 * @param options - Split options
	 * @returns Branch extraction result
	 */
	extractBranch(
		tree: FamilyTree,
		branch: BranchDefinition,
		options: BranchSplitOptions
	): BranchExtractionResult {
		const people: PersonNode[] = [];
		let extractionResult: { crIds: Set<string>; branchRoot: PersonNode | undefined; generationDepth: number } = {
			crIds: new Set<string>(),
			branchRoot: undefined,
			generationDepth: 0
		};

		const anchor = tree.nodes.get(branch.anchorCrId);
		if (!anchor) {
			return {
				people: [],
				crIds: new Set(),
				branchRoot: undefined,
				boundaryPeople: new Map(),
				generationDepth: 0
			};
		}

		switch (branch.type) {
			case 'paternal':
				extractionResult = this.extractPaternalLine(
					tree,
					anchor,
					branch.maxGenerations
				);
				break;

			case 'maternal':
				extractionResult = this.extractMaternalLine(
					tree,
					anchor,
					branch.maxGenerations
				);
				break;

			case 'descendant':
				if (branch.childCrId) {
					const child = tree.nodes.get(branch.childCrId);
					if (child) {
						extractionResult = this.extractDescendantLine(
							tree,
							child,
							branch.maxGenerations
						);
					}
				}
				break;

			case 'custom':
				if (branch.ancestorCrId) {
					const ancestor = tree.nodes.get(branch.ancestorCrId);
					if (ancestor) {
						extractionResult = this.extractAncestorLine(
							tree,
							anchor,
							ancestor,
							branch.maxGenerations
						);
					}
				}
				break;
		}

		const { crIds, branchRoot, generationDepth } = extractionResult;

		// Optionally include spouses
		if (options.includeSpouses) {
			this.addSpouses(tree, crIds);
		}

		// Convert crIds to PersonNodes
		for (const crId of crIds) {
			const person = tree.nodes.get(crId);
			if (person) {
				people.push(person);
			}
		}

		// Find boundary people (those with connections outside this branch)
		const boundaryPeople = this.findBranchBoundaryPeople(tree, crIds, branch.label);

		return {
			people,
			crIds,
			branchRoot,
			boundaryPeople,
			generationDepth
		};
	}

	/**
	 * Extract paternal line (father's ancestors)
	 */
	private extractPaternalLine(
		tree: FamilyTree,
		anchor: PersonNode,
		maxGenerations?: number
	): { crIds: Set<string>; branchRoot: PersonNode | undefined; generationDepth: number } {
		const crIds = new Set<string>();
		let branchRoot: PersonNode | undefined;
		let generationDepth = 0;

		// Start with father
		if (!anchor.fatherCrId) {
			return { crIds, branchRoot: undefined, generationDepth: 0 };
		}

		const father = tree.nodes.get(anchor.fatherCrId);
		if (!father) {
			return { crIds, branchRoot: undefined, generationDepth: 0 };
		}

		// BFS to collect all paternal ancestors
		const queue: Array<{ person: PersonNode; depth: number }> = [{ person: father, depth: 1 }];
		const visited = new Set<string>();

		while (queue.length > 0) {
			const { person, depth } = queue.shift()!;

			if (visited.has(person.crId)) continue;
			if (maxGenerations !== undefined && depth > maxGenerations) continue;

			visited.add(person.crId);
			crIds.add(person.crId);
			branchRoot = person; // Will end up being the most distant ancestor
			generationDepth = Math.max(generationDepth, depth);

			// Add both parents of this person (we're tracing the full paternal lineage)
			if (person.fatherCrId) {
				const grandfather = tree.nodes.get(person.fatherCrId);
				if (grandfather) {
					queue.push({ person: grandfather, depth: depth + 1 });
				}
			}
			if (person.motherCrId) {
				const grandmother = tree.nodes.get(person.motherCrId);
				if (grandmother) {
					queue.push({ person: grandmother, depth: depth + 1 });
				}
			}
		}

		return { crIds, branchRoot, generationDepth };
	}

	/**
	 * Extract maternal line (mother's ancestors)
	 */
	private extractMaternalLine(
		tree: FamilyTree,
		anchor: PersonNode,
		maxGenerations?: number
	): { crIds: Set<string>; branchRoot: PersonNode | undefined; generationDepth: number } {
		const crIds = new Set<string>();
		let branchRoot: PersonNode | undefined;
		let generationDepth = 0;

		// Start with mother
		if (!anchor.motherCrId) {
			return { crIds, branchRoot: undefined, generationDepth: 0 };
		}

		const mother = tree.nodes.get(anchor.motherCrId);
		if (!mother) {
			return { crIds, branchRoot: undefined, generationDepth: 0 };
		}

		// BFS to collect all maternal ancestors
		const queue: Array<{ person: PersonNode; depth: number }> = [{ person: mother, depth: 1 }];
		const visited = new Set<string>();

		while (queue.length > 0) {
			const { person, depth } = queue.shift()!;

			if (visited.has(person.crId)) continue;
			if (maxGenerations !== undefined && depth > maxGenerations) continue;

			visited.add(person.crId);
			crIds.add(person.crId);
			branchRoot = person;
			generationDepth = Math.max(generationDepth, depth);

			// Add both parents of this person
			if (person.fatherCrId) {
				const grandfather = tree.nodes.get(person.fatherCrId);
				if (grandfather) {
					queue.push({ person: grandfather, depth: depth + 1 });
				}
			}
			if (person.motherCrId) {
				const grandmother = tree.nodes.get(person.motherCrId);
				if (grandmother) {
					queue.push({ person: grandmother, depth: depth + 1 });
				}
			}
		}

		return { crIds, branchRoot, generationDepth };
	}

	/**
	 * Extract descendant line (a child and all their descendants)
	 */
	private extractDescendantLine(
		tree: FamilyTree,
		child: PersonNode,
		maxGenerations?: number
	): { crIds: Set<string>; branchRoot: PersonNode | undefined; generationDepth: number } {
		const crIds = new Set<string>();
		let generationDepth = 0;

		// BFS to collect all descendants
		const queue: Array<{ person: PersonNode; depth: number }> = [{ person: child, depth: 0 }];
		const visited = new Set<string>();

		while (queue.length > 0) {
			const { person, depth } = queue.shift()!;

			if (visited.has(person.crId)) continue;
			if (maxGenerations !== undefined && depth > maxGenerations) continue;

			visited.add(person.crId);
			crIds.add(person.crId);
			generationDepth = Math.max(generationDepth, depth);

			// Add all children
			for (const childCrId of person.childrenCrIds) {
				const descendant = tree.nodes.get(childCrId);
				if (descendant) {
					queue.push({ person: descendant, depth: depth + 1 });
				}
			}
		}

		return { crIds, branchRoot: child, generationDepth };
	}

	/**
	 * Extract ancestor line to a specific ancestor
	 */
	private extractAncestorLine(
		tree: FamilyTree,
		anchor: PersonNode,
		targetAncestor: PersonNode,
		maxGenerations?: number
	): { crIds: Set<string>; branchRoot: PersonNode | undefined; generationDepth: number } {
		const crIds = new Set<string>();
		let generationDepth = 0;

		// BFS from target ancestor down to find path
		const queue: Array<{ person: PersonNode; depth: number }> = [{ person: targetAncestor, depth: 0 }];
		const visited = new Set<string>();

		while (queue.length > 0) {
			const { person, depth } = queue.shift()!;

			if (visited.has(person.crId)) continue;
			if (maxGenerations !== undefined && depth > maxGenerations) continue;

			visited.add(person.crId);
			crIds.add(person.crId);
			generationDepth = Math.max(generationDepth, depth);

			// Add both parents (going up from the ancestor)
			if (person.fatherCrId) {
				const father = tree.nodes.get(person.fatherCrId);
				if (father) {
					queue.push({ person: father, depth: depth + 1 });
				}
			}
			if (person.motherCrId) {
				const mother = tree.nodes.get(person.motherCrId);
				if (mother) {
					queue.push({ person: mother, depth: depth + 1 });
				}
			}
		}

		return { crIds, branchRoot: targetAncestor, generationDepth };
	}

	/**
	 * Add spouses of all people in a set
	 */
	private addSpouses(tree: FamilyTree, crIds: Set<string>): void {
		const spousesToAdd = new Set<string>();

		for (const crId of crIds) {
			const person = tree.nodes.get(crId);
			if (person) {
				for (const spouseId of person.spouseCrIds) {
					if (!crIds.has(spouseId)) {
						spousesToAdd.add(spouseId);
					}
				}
			}
		}

		for (const spouseId of spousesToAdd) {
			crIds.add(spouseId);
		}
	}

	/**
	 * Find boundary people in a branch (those with connections outside)
	 */
	private findBranchBoundaryPeople(
		tree: FamilyTree,
		branchCrIds: Set<string>,
		branchLabel: string
	): Map<string, { person: PersonNode; connectedBranches: string[] }> {
		const boundary = new Map<string, { person: PersonNode; connectedBranches: string[] }>();

		for (const crId of branchCrIds) {
			const person = tree.nodes.get(crId);
			if (!person) continue;

			const connectedBranches: string[] = [];

			// Check if any parents are outside this branch
			if (person.fatherCrId && !branchCrIds.has(person.fatherCrId)) {
				connectedBranches.push('paternal');
			}
			if (person.motherCrId && !branchCrIds.has(person.motherCrId)) {
				connectedBranches.push('maternal');
			}

			// Check if any children are outside this branch
			for (const childId of person.childrenCrIds) {
				if (!branchCrIds.has(childId)) {
					connectedBranches.push('descendants');
					break; // Only need to mark once
				}
			}

			// Check if any spouses are outside this branch
			for (const spouseId of person.spouseCrIds) {
				if (!branchCrIds.has(spouseId)) {
					connectedBranches.push('spouse-family');
					break;
				}
			}

			if (connectedBranches.length > 0) {
				boundary.set(crId, { person, connectedBranches });
			}
		}

		return boundary;
	}

	/**
	 * Generate sub-branches for grandparent lines
	 */
	private generateGrandparentBranches(
		tree: FamilyTree,
		extraction: BranchExtractionResult,
		parentBranch: BranchDefinition,
		remainingDepth: number
	): BranchDefinition[] {
		const subBranches: BranchDefinition[] = [];

		if (remainingDepth < 0 || !extraction.branchRoot) {
			return subBranches;
		}

		const branchRoot = extraction.branchRoot;

		// Create paternal grandparent branch
		if (branchRoot.fatherCrId) {
			const grandfather = tree.nodes.get(branchRoot.fatherCrId);
			if (grandfather) {
				subBranches.push({
					type: 'paternal',
					anchorCrId: branchRoot.crId,
					label: `${parentBranch.label} - Paternal`,
					maxGenerations: parentBranch.maxGenerations
				});
			}
		}

		// Create maternal grandparent branch
		if (branchRoot.motherCrId) {
			const grandmother = tree.nodes.get(branchRoot.motherCrId);
			if (grandmother) {
				subBranches.push({
					type: 'maternal',
					anchorCrId: branchRoot.crId,
					label: `${parentBranch.label} - Maternal`,
					maxGenerations: parentBranch.maxGenerations
				});
			}
		}

		return subBranches;
	}

	/**
	 * Generate canvas path for a branch
	 */
	private generateBranchCanvasPath(options: BranchSplitOptions, branch: BranchDefinition): string {
		const folder = options.outputFolder || '';
		const pattern = options.filenamePattern || '{name}';

		const filename = pattern
			.replace('{name}', this.sanitizeFilename(branch.label))
			.replace('{type}', branch.type)
			.replace('{date}', new Date().toISOString().split('T')[0]);

		const extension = filename.endsWith('.canvas') ? '' : '.canvas';

		if (folder) {
			return `${folder}/${filename}${extension}`;
		}
		return `${filename}${extension}`;
	}

	/**
	 * Create standard paternal/maternal branch definitions for a person
	 */
	createStandardBranches(
		tree: FamilyTree,
		anchorCrId: string,
		options?: { maxGenerations?: number; includeDescendants?: boolean }
	): BranchDefinition[] {
		const branches: BranchDefinition[] = [];
		const anchor = tree.nodes.get(anchorCrId);

		if (!anchor) return branches;

		// Paternal line
		if (anchor.fatherCrId) {
			const father = tree.nodes.get(anchor.fatherCrId);
			if (father) {
				branches.push({
					type: 'paternal',
					anchorCrId,
					label: `Paternal Line (${father.name || 'Father'})`,
					maxGenerations: options?.maxGenerations
				});
			}
		}

		// Maternal line
		if (anchor.motherCrId) {
			const mother = tree.nodes.get(anchor.motherCrId);
			if (mother) {
				branches.push({
					type: 'maternal',
					anchorCrId,
					label: `Maternal Line (${mother.name || 'Mother'})`,
					maxGenerations: options?.maxGenerations
				});
			}
		}

		// Descendant lines (one per child)
		if (options?.includeDescendants) {
			for (const childId of anchor.childrenCrIds) {
				const child = tree.nodes.get(childId);
				if (child) {
					branches.push({
						type: 'descendant',
						anchorCrId,
						childCrId: childId,
						label: `Descendants of ${child.name || 'Child'}`,
						maxGenerations: options?.maxGenerations
					});
				}
			}
		}

		return branches;
	}

	/**
	 * Preview a branch split without creating files
	 */
	previewBranchSplit(
		tree: FamilyTree,
		options: BranchSplitOptions
	): {
		branches: Array<{
			definition: BranchDefinition;
			peopleCount: number;
			boundaryCount: number;
			generationDepth: number;
		}>;
		totalPeople: number;
		overlap: number;
	} {
		const opts = { ...DEFAULT_BRANCH_SPLIT_OPTIONS, ...options };
		const branches: Array<{
			definition: BranchDefinition;
			peopleCount: number;
			boundaryCount: number;
			generationDepth: number;
		}> = [];

		const allPeopleSeen = new Set<string>();
		let totalPeople = 0;
		let overlap = 0;

		for (const branch of opts.branches) {
			const extraction = this.extractBranch(tree, branch, opts);

			// Calculate overlap
			for (const crId of extraction.crIds) {
				if (allPeopleSeen.has(crId)) {
					overlap++;
				} else {
					allPeopleSeen.add(crId);
				}
			}

			branches.push({
				definition: branch,
				peopleCount: extraction.people.length,
				boundaryCount: extraction.boundaryPeople.size,
				generationDepth: extraction.generationDepth
			});

			totalPeople += extraction.people.length;
		}

		return {
			branches,
			totalPeople,
			overlap
		};
	}

	// =========================================================================
	// Phase 6: Collection-Based Splitting
	// =========================================================================

	/**
	 * Split a family tree by user-defined collections
	 *
	 * @param tree - The family tree to split
	 * @param options - Collection split options
	 * @returns Split result with generated canvas information
	 */
	splitByCollection(
		tree: FamilyTree,
		options: CollectionSplitOptions
	): SplitResult {
		const opts = { ...DEFAULT_COLLECTION_SPLIT_OPTIONS, ...options };
		const canvases: GeneratedCanvas[] = [];
		let totalPeople = 0;

		// Extract collections from tree
		const extraction = this.extractCollections(tree, opts);

		// Generate canvas for each collection
		for (const [collectionName, info] of extraction.collections) {
			// Filter collections if specific ones requested
			if (opts.collections && opts.collections.length > 0) {
				if (!opts.collections.includes(collectionName)) {
					continue;
				}
			}

			// Handle bridge people based on option
			let peopleForCanvas = info.people;
			if (opts.bridgePeopleHandling === 'primary-only') {
				peopleForCanvas = this.filterToPrimaryCollection(
					info.people,
					collectionName,
					extraction.allBridgePeople,
					opts.primaryCollectionOrder
				);
			}

			if (peopleForCanvas.length === 0) continue;

			const canvasPath = this.generateCollectionCanvasPath(opts, collectionName);

			const canvas: GeneratedCanvas = {
				path: canvasPath,
				label: collectionName,
				personCount: peopleForCanvas.length,
				collection: collectionName
			};
			canvases.push(canvas);
			totalPeople += peopleForCanvas.length;
		}

		// Handle uncollected people
		if (opts.includeUncollected && extraction.uncollected.length > 0) {
			const canvasPath = this.generateCollectionCanvasPath(opts, opts.uncollectedLabel);

			canvases.push({
				path: canvasPath,
				label: opts.uncollectedLabel,
				personCount: extraction.uncollected.length,
				collection: opts.uncollectedLabel
			});
			totalPeople += extraction.uncollected.length;
		}

		// Handle bridge people as separate canvas if requested
		if (opts.bridgePeopleHandling === 'separate-canvas' && extraction.allBridgePeople.size > 0) {
			const bridgePeople = this.getBridgePeopleNodes(tree, extraction.allBridgePeople);
			if (bridgePeople.length > 0) {
				const canvasPath = this.generateCollectionCanvasPath(opts, 'Bridge People');

				canvases.push({
					path: canvasPath,
					label: 'Bridge People',
					personCount: bridgePeople.length,
					collection: 'Bridge People'
				});
				// Don't add to totalPeople as they're counted in their collections
			}
		}

		return {
			canvases,
			totalPeople
		};
	}

	/**
	 * Extract all collections from a family tree
	 *
	 * @param tree - The family tree
	 * @param options - Split options
	 * @returns Collection extraction result
	 */
	extractCollections(
		tree: FamilyTree,
		options: CollectionSplitOptions
	): CollectionExtractionResult {
		const collections = new Map<string, CollectionInfo>();
		const uncollected: PersonNode[] = [];
		const personCollections = new Map<string, string[]>(); // crId -> collection names

		// First pass: identify all collections and assign people
		for (const person of tree.nodes.values()) {
			const collection = person.collection;

			if (collection) {
				// Track which collections this person belongs to
				const existing = personCollections.get(person.crId) || [];
				existing.push(collection);
				personCollections.set(person.crId, existing);

				// Add to collection
				if (!collections.has(collection)) {
					collections.set(collection, {
						name: collection,
						people: [],
						crIds: new Set(),
						bridgePeople: new Map(),
						count: 0
					});
				}

				const info = collections.get(collection)!;
				info.people.push(person);
				info.crIds.add(person.crId);
				info.count++;
			} else {
				uncollected.push(person);
			}
		}

		// Second pass: identify bridge people (in multiple collections)
		const allBridgePeople = new Map<string, string[]>();

		for (const [crId, collectionNames] of personCollections) {
			if (collectionNames.length > 1) {
				allBridgePeople.set(crId, collectionNames);

				// Mark as bridge person in each collection
				for (const collectionName of collectionNames) {
					const info = collections.get(collectionName);
					if (info) {
						const otherCollections = collectionNames.filter(c => c !== collectionName);
						info.bridgePeople.set(crId, otherCollections);
					}
				}
			}
		}

		return {
			collections,
			uncollected,
			allBridgePeople
		};
	}

	/**
	 * Filter people to only include those whose primary collection matches
	 */
	private filterToPrimaryCollection(
		people: PersonNode[],
		collectionName: string,
		allBridgePeople: Map<string, string[]>,
		primaryOrder?: string[]
	): PersonNode[] {
		return people.filter(person => {
			const collections = allBridgePeople.get(person.crId);

			// Not a bridge person, include in all their collections
			if (!collections || collections.length <= 1) {
				return true;
			}

			// Determine primary collection
			const primaryCollection = this.determinePrimaryCollection(collections, primaryOrder);
			return primaryCollection === collectionName;
		});
	}

	/**
	 * Determine which collection is primary for a bridge person
	 */
	private determinePrimaryCollection(
		collections: string[],
		primaryOrder?: string[]
	): string {
		if (primaryOrder && primaryOrder.length > 0) {
			// Use provided order
			for (const collection of primaryOrder) {
				if (collections.includes(collection)) {
					return collection;
				}
			}
		}

		// Default: first alphabetically
		return [...collections].sort()[0];
	}

	/**
	 * Get PersonNode objects for all bridge people
	 */
	private getBridgePeopleNodes(
		tree: FamilyTree,
		bridgePeople: Map<string, string[]>
	): PersonNode[] {
		const nodes: PersonNode[] = [];

		for (const crId of bridgePeople.keys()) {
			const person = tree.nodes.get(crId);
			if (person) {
				nodes.push(person);
			}
		}

		return nodes;
	}

	/**
	 * Generate canvas path for a collection
	 */
	private generateCollectionCanvasPath(
		options: CollectionSplitOptions,
		collectionName: string
	): string {
		const folder = options.outputFolder || '';
		const pattern = options.filenamePattern || '{name}';

		const filename = pattern
			.replace('{name}', this.sanitizeFilename(collectionName))
			.replace('{type}', 'collection')
			.replace('{date}', new Date().toISOString().split('T')[0]);

		const extension = filename.endsWith('.canvas') ? '' : '.canvas';

		if (folder) {
			return `${folder}/${filename}${extension}`;
		}
		return `${filename}${extension}`;
	}

	/**
	 * Get all unique collection names from a family tree
	 */
	getCollectionNames(tree: FamilyTree): string[] {
		const collections = new Set<string>();

		for (const person of tree.nodes.values()) {
			if (person.collection) {
				collections.add(person.collection);
			}
		}

		return Array.from(collections).sort();
	}

	/**
	 * Preview a collection split without creating files
	 */
	previewCollectionSplit(
		tree: FamilyTree,
		options: CollectionSplitOptions
	): {
		collections: Array<{
			name: string;
			peopleCount: number;
			bridgeCount: number;
		}>;
		uncollectedCount: number;
		totalBridgePeople: number;
		totalPeople: number;
	} {
		const opts = { ...DEFAULT_COLLECTION_SPLIT_OPTIONS, ...options };
		const extraction = this.extractCollections(tree, opts);

		const collections: Array<{
			name: string;
			peopleCount: number;
			bridgeCount: number;
		}> = [];

		let totalPeople = 0;

		for (const [name, info] of extraction.collections) {
			// Filter if specific collections requested
			if (opts.collections && opts.collections.length > 0) {
				if (!opts.collections.includes(name)) {
					continue;
				}
			}

			collections.push({
				name,
				peopleCount: info.count,
				bridgeCount: info.bridgePeople.size
			});

			totalPeople += info.count;
		}

		// Sort by name
		collections.sort((a, b) => a.name.localeCompare(b.name));

		return {
			collections,
			uncollectedCount: extraction.uncollected.length,
			totalBridgePeople: extraction.allBridgePeople.size,
			totalPeople: totalPeople + extraction.uncollected.length
		};
	}

	/**
	 * Find connections between collections (for overview generation)
	 */
	findCollectionConnections(
		tree: FamilyTree
	): Map<string, Set<string>> {
		const connections = new Map<string, Set<string>>();

		// Initialize connection map
		const collectionNames = this.getCollectionNames(tree);
		for (const name of collectionNames) {
			connections.set(name, new Set());
		}

		// Find connections through family relationships
		for (const person of tree.nodes.values()) {
			if (!person.collection) continue;

			const personCollection = person.collection;

			// Check parents
			if (person.fatherCrId) {
				const father = tree.nodes.get(person.fatherCrId);
				if (father?.collection && father.collection !== personCollection) {
					connections.get(personCollection)?.add(father.collection);
					connections.get(father.collection)?.add(personCollection);
				}
			}

			if (person.motherCrId) {
				const mother = tree.nodes.get(person.motherCrId);
				if (mother?.collection && mother.collection !== personCollection) {
					connections.get(personCollection)?.add(mother.collection);
					connections.get(mother.collection)?.add(personCollection);
				}
			}

			// Check spouses
			for (const spouseId of person.spouseCrIds) {
				const spouse = tree.nodes.get(spouseId);
				if (spouse?.collection && spouse.collection !== personCollection) {
					connections.get(personCollection)?.add(spouse.collection);
					connections.get(spouse.collection)?.add(personCollection);
				}
			}

			// Check children
			for (const childId of person.childrenCrIds) {
				const child = tree.nodes.get(childId);
				if (child?.collection && child.collection !== personCollection) {
					connections.get(personCollection)?.add(child.collection);
					connections.get(child.collection)?.add(personCollection);
				}
			}
		}

		return connections;
	}

	/**
	 * Generate collection relationship data for overview canvas
	 */
	generateCollectionOverviewData(
		tree: FamilyTree,
		options: CollectionSplitOptions
	): {
		nodes: Array<{
			collection: string;
			peopleCount: number;
			canvasPath: string;
		}>;
		edges: Array<{
			from: string;
			to: string;
			bridgeCount: number;
		}>;
	} {
		const opts = { ...DEFAULT_COLLECTION_SPLIT_OPTIONS, ...options };
		const extraction = this.extractCollections(tree, opts);
		const connections = this.findCollectionConnections(tree);

		const nodes: Array<{
			collection: string;
			peopleCount: number;
			canvasPath: string;
		}> = [];

		// Create nodes for each collection
		for (const [name, info] of extraction.collections) {
			nodes.push({
				collection: name,
				peopleCount: info.count,
				canvasPath: this.generateCollectionCanvasPath(opts, name)
			});
		}

		// Create edges for connections
		const edges: Array<{
			from: string;
			to: string;
			bridgeCount: number;
		}> = [];

		const processedPairs = new Set<string>();

		for (const [from, connectedTo] of connections) {
			for (const to of connectedTo) {
				// Avoid duplicate edges (A-B and B-A)
				const pairKey = [from, to].sort().join('|');
				if (processedPairs.has(pairKey)) continue;
				processedPairs.add(pairKey);

				// Count bridge people between these collections
				let bridgeCount = 0;
				for (const [, collectionNames] of extraction.allBridgePeople) {
					if (collectionNames.includes(from) && collectionNames.includes(to)) {
						bridgeCount++;
					}
				}

				edges.push({
					from,
					to,
					bridgeCount
				});
			}
		}

		return { nodes, edges };
	}

	// =========================================================================
	// Phase 7: Single Lineage Extraction
	// =========================================================================

	/**
	 * Extract a direct lineage between two people
	 *
	 * @param tree - The family tree
	 * @param options - Lineage split options
	 * @returns Split result with generated canvas information
	 */
	splitByLineage(
		tree: FamilyTree,
		options: LineageSplitOptions
	): SplitResult {
		const opts = { ...DEFAULT_LINEAGE_SPLIT_OPTIONS, ...options };

		// Extract the lineage
		const extraction = this.extractLineage(tree, opts);

		if (!extraction.pathFound) {
			return {
				canvases: [],
				totalPeople: 0
			};
		}

		// Generate canvas path
		const label = opts.label || this.generateLineageLabel(tree, opts.startCrId, opts.endCrId);
		const canvasPath = this.generateLineageCanvasPath(opts, label);

		const canvas: GeneratedCanvas = {
			path: canvasPath,
			label,
			personCount: extraction.allPeople.length,
			generationRange: [0, extraction.generationCount]
		};

		return {
			canvases: [canvas],
			totalPeople: extraction.allPeople.length
		};
	}

	/**
	 * Extract all people on a direct lineage between two individuals
	 *
	 * @param tree - The family tree
	 * @param options - Lineage options
	 * @returns Lineage extraction result
	 */
	extractLineage(
		tree: FamilyTree,
		options: LineageSplitOptions
	): LineageExtractionResult {
		const startPerson = tree.nodes.get(options.startCrId);
		const endPerson = tree.nodes.get(options.endCrId);

		if (!startPerson || !endPerson) {
			return {
				pathFound: false,
				lineagePath: [],
				lineageCrIds: new Set(),
				allPeople: [],
				allCrIds: new Set(),
				generationCount: 0,
				relationshipDescription: 'No path found'
			};
		}

		// Find path between the two people
		const path = this.findPathBetweenPeople(tree, options.startCrId, options.endCrId);

		if (!path) {
			return {
				pathFound: false,
				lineagePath: [],
				lineageCrIds: new Set(),
				allPeople: [],
				allCrIds: new Set(),
				generationCount: 0,
				relationshipDescription: 'No path found'
			};
		}

		// Convert path to PersonNodes
		const lineagePath: PersonNode[] = [];
		const lineageCrIds = new Set<string>();

		for (const crId of path) {
			const person = tree.nodes.get(crId);
			if (person) {
				lineagePath.push(person);
				lineageCrIds.add(crId);
			}
		}

		// Collect all people (line + optional spouses + optional siblings)
		const allCrIds = new Set<string>(lineageCrIds);

		// Add spouses if requested
		if (options.includeSpouses) {
			for (const crId of lineageCrIds) {
				const person = tree.nodes.get(crId);
				if (person) {
					for (const spouseId of person.spouseCrIds) {
						allCrIds.add(spouseId);
					}
				}
			}
		}

		// Add siblings if requested
		if (options.includeSiblings) {
			for (const crId of lineageCrIds) {
				const siblings = this.findSiblings(tree, crId);
				for (const siblingId of siblings) {
					allCrIds.add(siblingId);
				}
			}
		}

		// Convert to PersonNodes
		const allPeople: PersonNode[] = [];
		for (const crId of allCrIds) {
			const person = tree.nodes.get(crId);
			if (person) {
				allPeople.push(person);
			}
		}

		// Calculate generation count and relationship
		const generationCount = lineagePath.length - 1;
		const relationshipDescription = this.describeRelationship(
			tree,
			options.startCrId,
			options.endCrId,
			path
		);

		return {
			pathFound: true,
			lineagePath,
			lineageCrIds,
			allPeople,
			allCrIds,
			generationCount,
			relationshipDescription
		};
	}

	/**
	 * Find the shortest path between two people in the family graph
	 *
	 * Uses BFS to find the path, considering parent-child relationships.
	 * Does not traverse through spouse relationships for lineage purposes.
	 *
	 * @param tree - The family tree
	 * @param startCrId - Starting person
	 * @param endCrId - Ending person
	 * @returns Array of crIds representing the path, or null if no path exists
	 */
	findPathBetweenPeople(
		tree: FamilyTree,
		startCrId: string,
		endCrId: string
	): string[] | null {
		if (startCrId === endCrId) {
			return [startCrId];
		}

		const startPerson = tree.nodes.get(startCrId);
		const endPerson = tree.nodes.get(endCrId);

		if (!startPerson || !endPerson) {
			return null;
		}

		// BFS to find shortest path
		const visited = new Set<string>();
		const queue: PathNode[] = [{ crId: startCrId, parent: null, relationship: 'parent' }];

		while (queue.length > 0) {
			const current = queue.shift()!;

			if (visited.has(current.crId)) continue;
			visited.add(current.crId);

			// Found the target
			if (current.crId === endCrId) {
				return this.reconstructPath(current);
			}

			const person = tree.nodes.get(current.crId);
			if (!person) continue;

			// Add parents (going up the tree)
			if (person.fatherCrId && !visited.has(person.fatherCrId)) {
				queue.push({
					crId: person.fatherCrId,
					parent: current,
					relationship: 'parent'
				});
			}
			if (person.motherCrId && !visited.has(person.motherCrId)) {
				queue.push({
					crId: person.motherCrId,
					parent: current,
					relationship: 'parent'
				});
			}

			// Add children (going down the tree)
			for (const childId of person.childrenCrIds) {
				if (!visited.has(childId)) {
					queue.push({
						crId: childId,
						parent: current,
						relationship: 'child'
					});
				}
			}
		}

		// No path found
		return null;
	}

	/**
	 * Reconstruct the path from the BFS result
	 */
	private reconstructPath(endNode: PathNode): string[] {
		const path: string[] = [];
		let current: PathNode | null = endNode;

		while (current !== null) {
			path.unshift(current.crId);
			current = current.parent;
		}

		return path;
	}

	/**
	 * Find all siblings of a person (people with the same parents)
	 */
	private findSiblings(tree: FamilyTree, crId: string): string[] {
		const person = tree.nodes.get(crId);
		if (!person) return [];

		const siblings = new Set<string>();

		// Find siblings through father
		if (person.fatherCrId) {
			const father = tree.nodes.get(person.fatherCrId);
			if (father) {
				for (const childId of father.childrenCrIds) {
					if (childId !== crId) {
						siblings.add(childId);
					}
				}
			}
		}

		// Find siblings through mother
		if (person.motherCrId) {
			const mother = tree.nodes.get(person.motherCrId);
			if (mother) {
				for (const childId of mother.childrenCrIds) {
					if (childId !== crId) {
						siblings.add(childId);
					}
				}
			}
		}

		return Array.from(siblings);
	}

	/**
	 * Describe the relationship between two people based on the path
	 */
	private describeRelationship(
		tree: FamilyTree,
		startCrId: string,
		endCrId: string,
		path: string[]
	): string {
		if (path.length === 0) return 'No relationship';
		if (path.length === 1) return 'Same person';

		const startPerson = tree.nodes.get(startCrId);
		const endPerson = tree.nodes.get(endCrId);

		if (!startPerson || !endPerson) return 'Unknown relationship';

		// Analyze the path to determine relationship
		let upSteps = 0; // Steps going to ancestors
		let downSteps = 0; // Steps going to descendants

		for (let i = 1; i < path.length; i++) {
			const prevPerson = tree.nodes.get(path[i - 1]);
			const currPerson = tree.nodes.get(path[i]);

			if (!prevPerson || !currPerson) continue;

			// Check if current is a parent of previous (going up)
			if (prevPerson.fatherCrId === currPerson.crId || prevPerson.motherCrId === currPerson.crId) {
				upSteps++;
			}
			// Check if current is a child of previous (going down)
			else if (prevPerson.childrenCrIds.includes(currPerson.crId)) {
				downSteps++;
			}
		}

		// Direct ancestor/descendant
		if (downSteps === 0) {
			return this.formatAncestorRelationship(upSteps, startPerson, endPerson);
		}
		if (upSteps === 0) {
			return this.formatDescendantRelationship(downSteps, startPerson, endPerson);
		}

		// Collateral relationship (cousin, uncle, etc.)
		return this.formatCollateralRelationship(upSteps, downSteps, startPerson, endPerson);
	}

	/**
	 * Format ancestor relationship (parent, grandparent, etc.)
	 */
	private formatAncestorRelationship(
		generations: number,
		start: PersonNode,
		end: PersonNode
	): string {
		const prefix = this.getGreatPrefix(generations - 1);

		if (generations === 1) {
			return end.sex === 'M' ? 'Father' : end.sex === 'F' ? 'Mother' : 'Parent';
		}
		if (generations === 2) {
			return end.sex === 'M' ? 'Grandfather' : end.sex === 'F' ? 'Grandmother' : 'Grandparent';
		}

		const base = end.sex === 'M' ? 'Grandfather' : end.sex === 'F' ? 'Grandmother' : 'Grandparent';
		return `${prefix}${base}`;
	}

	/**
	 * Format descendant relationship (child, grandchild, etc.)
	 */
	private formatDescendantRelationship(
		generations: number,
		start: PersonNode,
		end: PersonNode
	): string {
		const prefix = this.getGreatPrefix(generations - 1);

		if (generations === 1) {
			return end.sex === 'M' ? 'Son' : end.sex === 'F' ? 'Daughter' : 'Child';
		}
		if (generations === 2) {
			return end.sex === 'M' ? 'Grandson' : end.sex === 'F' ? 'Granddaughter' : 'Grandchild';
		}

		const base = end.sex === 'M' ? 'Grandson' : end.sex === 'F' ? 'Granddaughter' : 'Grandchild';
		return `${prefix}${base}`;
	}

	/**
	 * Format collateral relationship (cousin, uncle, etc.)
	 */
	private formatCollateralRelationship(
		upSteps: number,
		downSteps: number,
		start: PersonNode,
		end: PersonNode
	): string {
		// Siblings
		if (upSteps === 1 && downSteps === 1) {
			return end.sex === 'M' ? 'Brother' : end.sex === 'F' ? 'Sister' : 'Sibling';
		}

		// Uncle/Aunt (parent's sibling)
		if (upSteps === 2 && downSteps === 1) {
			return end.sex === 'M' ? 'Uncle' : end.sex === 'F' ? 'Aunt' : 'Pibling';
		}

		// Nephew/Niece (sibling's child)
		if (upSteps === 1 && downSteps === 2) {
			return end.sex === 'M' ? 'Nephew' : end.sex === 'F' ? 'Niece' : 'Nibling';
		}

		// Cousins
		if (upSteps === downSteps) {
			const degree = upSteps - 1;
			if (degree === 1) return 'First cousin';
			if (degree === 2) return 'Second cousin';
			if (degree === 3) return 'Third cousin';
			return `${degree}th cousin`;
		}

		// Cousins once/twice removed
		const minSteps = Math.min(upSteps, downSteps);
		const degree = minSteps - 1;
		const removed = Math.abs(upSteps - downSteps);

		const degreeStr = degree === 1 ? 'First' : degree === 2 ? 'Second' : degree === 3 ? 'Third' : `${degree}th`;
		const removedStr = removed === 1 ? 'once removed' : removed === 2 ? 'twice removed' : `${removed}x removed`;

		return `${degreeStr} cousin, ${removedStr}`;
	}

	/**
	 * Get the "great-" prefix for ancestor/descendant relationships
	 */
	private getGreatPrefix(greatCount: number): string {
		if (greatCount <= 0) return '';
		if (greatCount === 1) return 'Great-';
		if (greatCount === 2) return 'Great-great-';
		return `${greatCount}x great-`;
	}

	/**
	 * Generate a label for a lineage
	 */
	private generateLineageLabel(
		tree: FamilyTree,
		startCrId: string,
		endCrId: string
	): string {
		const startPerson = tree.nodes.get(startCrId);
		const endPerson = tree.nodes.get(endCrId);

		if (!startPerson || !endPerson) {
			return 'Lineage';
		}

		const startName = startPerson.name || 'Unknown';
		const endName = endPerson.name || 'Unknown';

		return `${startName} to ${endName}`;
	}

	/**
	 * Generate canvas path for a lineage
	 */
	private generateLineageCanvasPath(
		options: LineageSplitOptions,
		label: string
	): string {
		const folder = options.outputFolder || '';
		const pattern = options.filenamePattern || '{name}';

		const filename = pattern
			.replace('{name}', this.sanitizeFilename(label))
			.replace('{type}', 'lineage')
			.replace('{date}', new Date().toISOString().split('T')[0]);

		const extension = filename.endsWith('.canvas') ? '' : '.canvas';

		if (folder) {
			return `${folder}/${filename}${extension}`;
		}
		return `${filename}${extension}`;
	}

	/**
	 * Preview a lineage extraction without creating files
	 */
	previewLineageExtraction(
		tree: FamilyTree,
		options: LineageSplitOptions
	): {
		pathFound: boolean;
		lineageCount: number;
		totalCount: number;
		generationCount: number;
		relationship: string;
		path: Array<{ crId: string; name: string }>;
	} {
		const opts = { ...DEFAULT_LINEAGE_SPLIT_OPTIONS, ...options };
		const extraction = this.extractLineage(tree, opts);

		const path = extraction.lineagePath.map(person => ({
			crId: person.crId,
			name: person.name || 'Unknown'
		}));

		return {
			pathFound: extraction.pathFound,
			lineageCount: extraction.lineageCrIds.size,
			totalCount: extraction.allCrIds.size,
			generationCount: extraction.generationCount,
			relationship: extraction.relationshipDescription,
			path
		};
	}

	/**
	 * Find all possible lineages from a person (for surname studies)
	 *
	 * Returns all direct ancestor/descendant paths that could be extracted.
	 */
	findPossibleLineages(
		tree: FamilyTree,
		anchorCrId: string,
		options?: { maxGenerations?: number; direction?: 'ancestors' | 'descendants' | 'both' }
	): Array<{
		endCrId: string;
		endName: string;
		generations: number;
		direction: 'ancestor' | 'descendant';
	}> {
		const lineages: Array<{
			endCrId: string;
			endName: string;
			generations: number;
			direction: 'ancestor' | 'descendant';
		}> = [];

		const maxGen = options?.maxGenerations ?? 10;
		const direction = options?.direction ?? 'both';

		const anchor = tree.nodes.get(anchorCrId);
		if (!anchor) return lineages;

		// Find ancestors
		if (direction === 'ancestors' || direction === 'both') {
			const ancestorEndpoints = this.findLineageEndpoints(
				tree,
				anchorCrId,
				'ancestors',
				maxGen
			);

			for (const endpoint of ancestorEndpoints) {
				lineages.push({
					endCrId: endpoint.crId,
					endName: endpoint.name,
					generations: endpoint.generations,
					direction: 'ancestor'
				});
			}
		}

		// Find descendants
		if (direction === 'descendants' || direction === 'both') {
			const descendantEndpoints = this.findLineageEndpoints(
				tree,
				anchorCrId,
				'descendants',
				maxGen
			);

			for (const endpoint of descendantEndpoints) {
				lineages.push({
					endCrId: endpoint.crId,
					endName: endpoint.name,
					generations: endpoint.generations,
					direction: 'descendant'
				});
			}
		}

		// Sort by generation count (most distant first)
		lineages.sort((a, b) => b.generations - a.generations);

		return lineages;
	}

	/**
	 * Find endpoints for lineage extraction (most distant ancestors/descendants)
	 */
	private findLineageEndpoints(
		tree: FamilyTree,
		startCrId: string,
		direction: 'ancestors' | 'descendants',
		maxGenerations: number
	): Array<{ crId: string; name: string; generations: number }> {
		const endpoints: Array<{ crId: string; name: string; generations: number }> = [];
		const visited = new Set<string>();

		const queue: Array<{ crId: string; generations: number }> = [
			{ crId: startCrId, generations: 0 }
		];

		while (queue.length > 0) {
			const { crId, generations } = queue.shift()!;

			if (visited.has(crId)) continue;
			if (generations > maxGenerations) continue;
			visited.add(crId);

			const person = tree.nodes.get(crId);
			if (!person) continue;

			let hasNext = false;

			if (direction === 'ancestors') {
				// Check parents
				if (person.fatherCrId && !visited.has(person.fatherCrId)) {
					queue.push({ crId: person.fatherCrId, generations: generations + 1 });
					hasNext = true;
				}
				if (person.motherCrId && !visited.has(person.motherCrId)) {
					queue.push({ crId: person.motherCrId, generations: generations + 1 });
					hasNext = true;
				}
			} else {
				// Check children
				for (const childId of person.childrenCrIds) {
					if (!visited.has(childId)) {
						queue.push({ crId: childId, generations: generations + 1 });
						hasNext = true;
					}
				}
			}

			// If no further nodes, this is an endpoint
			if (!hasNext && generations > 0) {
				endpoints.push({
					crId: person.crId,
					name: person.name || 'Unknown',
					generations
				});
			}
		}

		return endpoints;
	}

	// =========================================================================
	// Phase 8: Ancestor-Descendant Pairs
	// =========================================================================

	/**
	 * Generate a linked pair of ancestor and descendant canvases
	 *
	 * Creates two canvases centered on the same root person:
	 * - Ancestor canvas: root person + all ancestors
	 * - Descendant canvas: root person + all descendants
	 * Both include navigation nodes linking to each other.
	 *
	 * @param tree - The family tree
	 * @param options - Split options
	 * @returns Split result with both canvases
	 */
	generateAncestorDescendantPair(
		tree: FamilyTree,
		options: AncestorDescendantSplitOptions
	): SplitResult {
		const opts = { ...DEFAULT_ANCESTOR_DESCENDANT_OPTIONS, ...options };

		const rootPerson = tree.nodes.get(opts.rootCrId);
		if (!rootPerson) {
			return {
				canvases: [],
				totalPeople: 0
			};
		}

		// Extract ancestors
		const ancestorExtraction = this.extractAncestors(
			tree,
			opts.rootCrId,
			opts.maxAncestorGenerations,
			opts.includeSpouses
		);

		// Extract descendants
		const descendantExtraction = this.extractDescendants(
			tree,
			opts.rootCrId,
			opts.maxDescendantGenerations,
			opts.includeSpouses
		);

		// Generate labels
		const rootName = rootPerson.name || 'Unknown';
		const labelPrefix = opts.labelPrefix || rootName;

		// Generate canvas paths
		const ancestorPath = this.generateAncestorDescendantCanvasPath(
			opts,
			`${labelPrefix} - Ancestors`
		);
		const descendantPath = this.generateAncestorDescendantCanvasPath(
			opts,
			`${labelPrefix} - Descendants`
		);

		// Create canvas info
		const ancestorCanvas: GeneratedCanvas = {
			path: ancestorPath,
			label: `${labelPrefix} - Ancestors`,
			personCount: ancestorExtraction.people.length,
			generationRange: [0, ancestorExtraction.generationCount],
			anchorPerson: opts.rootCrId
		};

		const descendantCanvas: GeneratedCanvas = {
			path: descendantPath,
			label: `${labelPrefix} - Descendants`,
			personCount: descendantExtraction.people.length,
			generationRange: [0, descendantExtraction.generationCount],
			anchorPerson: opts.rootCrId
		};

		const canvases: GeneratedCanvas[] = [ancestorCanvas, descendantCanvas];

		// Calculate unique people (root is in both)
		const allCrIds = new Set<string>([
			...ancestorExtraction.crIds,
			...descendantExtraction.crIds
		]);
		const totalPeople = allCrIds.size;

		// Generate overview canvas if requested
		let overviewCanvas: GeneratedCanvas | undefined;
		if (opts.generateOverview) {
			const overviewPath = this.generateAncestorDescendantCanvasPath(
				opts,
				`${labelPrefix} - Overview`
			);

			overviewCanvas = {
				path: overviewPath,
				label: `${labelPrefix} - Overview`,
				personCount: 1, // Just shows the root and links
				anchorPerson: opts.rootCrId
			};
			canvases.push(overviewCanvas);
		}

		return {
			canvases,
			totalPeople,
			overviewCanvas
		};
	}

	/**
	 * Extract all ancestors of a person
	 *
	 * @param tree - The family tree
	 * @param rootCrId - Starting person
	 * @param maxGenerations - Maximum generations to traverse (undefined = all)
	 * @param includeSpouses - Whether to include spouses of ancestors
	 * @returns Extraction result with ancestors
	 */
	extractAncestors(
		tree: FamilyTree,
		rootCrId: string,
		maxGenerations?: number,
		includeSpouses = true
	): DirectionalExtractionResult {
		const rootPerson = tree.nodes.get(rootCrId);
		if (!rootPerson) {
			return {
				people: [],
				crIds: new Set(),
				generationCount: 0,
				rootPerson: rootPerson!
			};
		}

		const crIds = new Set<string>();
		crIds.add(rootCrId);

		let generationCount = 0;
		const visited = new Set<string>();

		// BFS to collect ancestors
		const queue: Array<{ crId: string; generation: number }> = [
			{ crId: rootCrId, generation: 0 }
		];

		while (queue.length > 0) {
			const { crId, generation } = queue.shift()!;

			if (visited.has(crId)) continue;
			visited.add(crId);

			const person = tree.nodes.get(crId);
			if (!person) continue;

			crIds.add(crId);
			generationCount = Math.max(generationCount, generation);

			// Check generation limit
			if (maxGenerations !== undefined && generation >= maxGenerations) {
				continue;
			}

			// Add parents
			if (person.fatherCrId && !visited.has(person.fatherCrId)) {
				queue.push({ crId: person.fatherCrId, generation: generation + 1 });
			}
			if (person.motherCrId && !visited.has(person.motherCrId)) {
				queue.push({ crId: person.motherCrId, generation: generation + 1 });
			}
		}

		// Add spouses if requested
		if (includeSpouses) {
			const spousesToAdd = new Set<string>();
			for (const crId of crIds) {
				const person = tree.nodes.get(crId);
				if (person) {
					for (const spouseId of person.spouseCrIds) {
						if (!crIds.has(spouseId)) {
							spousesToAdd.add(spouseId);
						}
					}
				}
			}
			for (const spouseId of spousesToAdd) {
				crIds.add(spouseId);
			}
		}

		// Convert to PersonNodes
		const people: PersonNode[] = [];
		for (const crId of crIds) {
			const person = tree.nodes.get(crId);
			if (person) {
				people.push(person);
			}
		}

		return {
			people,
			crIds,
			generationCount,
			rootPerson
		};
	}

	/**
	 * Extract all descendants of a person
	 *
	 * @param tree - The family tree
	 * @param rootCrId - Starting person
	 * @param maxGenerations - Maximum generations to traverse (undefined = all)
	 * @param includeSpouses - Whether to include spouses of descendants
	 * @returns Extraction result with descendants
	 */
	extractDescendants(
		tree: FamilyTree,
		rootCrId: string,
		maxGenerations?: number,
		includeSpouses = true
	): DirectionalExtractionResult {
		const rootPerson = tree.nodes.get(rootCrId);
		if (!rootPerson) {
			return {
				people: [],
				crIds: new Set(),
				generationCount: 0,
				rootPerson: rootPerson!
			};
		}

		const crIds = new Set<string>();
		crIds.add(rootCrId);

		let generationCount = 0;
		const visited = new Set<string>();

		// BFS to collect descendants
		const queue: Array<{ crId: string; generation: number }> = [
			{ crId: rootCrId, generation: 0 }
		];

		while (queue.length > 0) {
			const { crId, generation } = queue.shift()!;

			if (visited.has(crId)) continue;
			visited.add(crId);

			const person = tree.nodes.get(crId);
			if (!person) continue;

			crIds.add(crId);
			generationCount = Math.max(generationCount, generation);

			// Check generation limit
			if (maxGenerations !== undefined && generation >= maxGenerations) {
				continue;
			}

			// Add children
			for (const childId of person.childrenCrIds) {
				if (!visited.has(childId)) {
					queue.push({ crId: childId, generation: generation + 1 });
				}
			}
		}

		// Add spouses if requested
		if (includeSpouses) {
			const spousesToAdd = new Set<string>();
			for (const crId of crIds) {
				const person = tree.nodes.get(crId);
				if (person) {
					for (const spouseId of person.spouseCrIds) {
						if (!crIds.has(spouseId)) {
							spousesToAdd.add(spouseId);
						}
					}
				}
			}
			for (const spouseId of spousesToAdd) {
				crIds.add(spouseId);
			}
		}

		// Convert to PersonNodes
		const people: PersonNode[] = [];
		for (const crId of crIds) {
			const person = tree.nodes.get(crId);
			if (person) {
				people.push(person);
			}
		}

		return {
			people,
			crIds,
			generationCount,
			rootPerson
		};
	}

	/**
	 * Generate canvas path for ancestor-descendant pair
	 */
	private generateAncestorDescendantCanvasPath(
		options: AncestorDescendantSplitOptions,
		label: string
	): string {
		const folder = options.outputFolder || '';
		const pattern = options.filenamePattern || '{name}';

		const filename = pattern
			.replace('{name}', this.sanitizeFilename(label))
			.replace('{type}', 'pair')
			.replace('{date}', new Date().toISOString().split('T')[0]);

		const extension = filename.endsWith('.canvas') ? '' : '.canvas';

		if (folder) {
			return `${folder}/${filename}${extension}`;
		}
		return `${filename}${extension}`;
	}

	/**
	 * Preview an ancestor-descendant pair generation without creating files
	 */
	previewAncestorDescendantPair(
		tree: FamilyTree,
		options: AncestorDescendantSplitOptions
	): {
		rootFound: boolean;
		rootName: string;
		ancestorCount: number;
		ancestorGenerations: number;
		descendantCount: number;
		descendantGenerations: number;
		totalUniquePeople: number;
		overviewIncluded: boolean;
	} {
		const opts = { ...DEFAULT_ANCESTOR_DESCENDANT_OPTIONS, ...options };

		const rootPerson = tree.nodes.get(opts.rootCrId);
		if (!rootPerson) {
			return {
				rootFound: false,
				rootName: 'Not found',
				ancestorCount: 0,
				ancestorGenerations: 0,
				descendantCount: 0,
				descendantGenerations: 0,
				totalUniquePeople: 0,
				overviewIncluded: opts.generateOverview
			};
		}

		const ancestorExtraction = this.extractAncestors(
			tree,
			opts.rootCrId,
			opts.maxAncestorGenerations,
			opts.includeSpouses
		);

		const descendantExtraction = this.extractDescendants(
			tree,
			opts.rootCrId,
			opts.maxDescendantGenerations,
			opts.includeSpouses
		);

		// Calculate unique people
		const allCrIds = new Set<string>([
			...ancestorExtraction.crIds,
			...descendantExtraction.crIds
		]);

		return {
			rootFound: true,
			rootName: rootPerson.name || 'Unknown',
			ancestorCount: ancestorExtraction.people.length,
			ancestorGenerations: ancestorExtraction.generationCount,
			descendantCount: descendantExtraction.people.length,
			descendantGenerations: descendantExtraction.generationCount,
			totalUniquePeople: allCrIds.size,
			overviewIncluded: opts.generateOverview
		};
	}

	/**
	 * Generate overview canvas data for an ancestor-descendant pair
	 *
	 * Creates a simple overview showing the root person with links to both canvases.
	 */
	generatePairOverviewData(
		tree: FamilyTree,
		options: AncestorDescendantSplitOptions,
		ancestorCanvasPath: string,
		descendantCanvasPath: string
	): {
		rootPerson: { crId: string; name: string };
		ancestorLink: { path: string; label: string; count: number; generations: number };
		descendantLink: { path: string; label: string; count: number; generations: number };
	} | null {
		const opts = { ...DEFAULT_ANCESTOR_DESCENDANT_OPTIONS, ...options };

		const rootPerson = tree.nodes.get(opts.rootCrId);
		if (!rootPerson) {
			return null;
		}

		const ancestorExtraction = this.extractAncestors(
			tree,
			opts.rootCrId,
			opts.maxAncestorGenerations,
			opts.includeSpouses
		);

		const descendantExtraction = this.extractDescendants(
			tree,
			opts.rootCrId,
			opts.maxDescendantGenerations,
			opts.includeSpouses
		);

		const rootName = rootPerson.name || 'Unknown';
		const labelPrefix = opts.labelPrefix || rootName;

		return {
			rootPerson: {
				crId: opts.rootCrId,
				name: rootName
			},
			ancestorLink: {
				path: ancestorCanvasPath,
				label: `${labelPrefix} - Ancestors`,
				count: ancestorExtraction.people.length,
				generations: ancestorExtraction.generationCount
			},
			descendantLink: {
				path: descendantCanvasPath,
				label: `${labelPrefix} - Descendants`,
				count: descendantExtraction.people.length,
				generations: descendantExtraction.generationCount
			}
		};
	}

	/**
	 * Preview a surname-based split without creating files
	 *
	 * Note: This method works directly with surname data passed in,
	 * since surname extraction happens at the wizard level (scanning vault files).
	 */
	previewSurnameSplit(
		surnameCounts: Map<string, number>,
		options: SurnameSplitOptions
	): SurnameSplitPreview {
		const opts = { ...DEFAULT_SURNAME_SPLIT_OPTIONS, ...options };

		const surnames: Array<{ name: string; count: number }> = [];
		let totalPeople = 0;

		for (const surname of opts.surnames) {
			const count = surnameCounts.get(surname) || 0;
			surnames.push({ name: surname, count });
			totalPeople += count;
		}

		// Sort by count descending
		surnames.sort((a, b) => b.count - a.count);

		// Calculate canvas count
		const canvasCount = opts.separateCanvases ? surnames.length : 1;

		return {
			surnames,
			totalPeople,
			canvasCount,
			spouseCount: 0 // Calculated separately if includeSpouses is true
		};
	}

	// ============================================================================
	// CANVAS FILE GENERATION METHODS
	// ============================================================================

	/**
	 * Create a subset FamilyTree from a list of people
	 *
	 * @param sourcePeople - Map of all people (crId -> PersonNode)
	 * @param includedCrIds - Set of crIds to include in the subset
	 * @param rootCrId - The root person for the new tree (must be in includedCrIds)
	 * @returns A new FamilyTree containing only the included people
	 */
	createSubsetTree(
		sourcePeople: Map<string, PersonNode>,
		includedCrIds: Set<string>,
		rootCrId: string
	): FamilyTree | null {
		const rootPerson = sourcePeople.get(rootCrId);
		if (!rootPerson || !includedCrIds.has(rootCrId)) {
			logger.warn('createSubsetTree', 'Root person not found or not included', { rootCrId });
			return null;
		}

		const nodes = new Map<string, PersonNode>();
		const edges: FamilyEdge[] = [];

		// Add included people to nodes
		for (const crId of includedCrIds) {
			const person = sourcePeople.get(crId);
			if (person) {
				// Create a copy with filtered relationships
				const filteredPerson: PersonNode = {
					...person,
					// Only keep relationships to people in the subset
					fatherCrId: person.fatherCrId && includedCrIds.has(person.fatherCrId)
						? person.fatherCrId : undefined,
					motherCrId: person.motherCrId && includedCrIds.has(person.motherCrId)
						? person.motherCrId : undefined,
					spouseCrIds: person.spouseCrIds.filter(id => includedCrIds.has(id)),
					childrenCrIds: person.childrenCrIds.filter(id => includedCrIds.has(id))
				};
				nodes.set(crId, filteredPerson);
			}
		}

		// Build edges for included relationships
		for (const [crId, person] of nodes) {
			// Parent edges
			if (person.fatherCrId) {
				edges.push({ from: person.fatherCrId, to: crId, type: 'parent' });
			}
			if (person.motherCrId) {
				edges.push({ from: person.motherCrId, to: crId, type: 'parent' });
			}

			// Spouse edges (only add once per pair)
			for (const spouseId of person.spouseCrIds) {
				if (crId < spouseId) { // Ensure we only add each pair once
					edges.push({ from: crId, to: spouseId, type: 'spouse' });
				}
			}
		}

		// Use the filtered root person from nodes, not the original
		const filteredRoot = nodes.get(rootCrId);
		if (!filteredRoot) {
			logger.warn('createSubsetTree', 'Filtered root not found in nodes', { rootCrId });
			return null;
		}

		return {
			root: filteredRoot,
			nodes,
			edges
		};
	}

	/**
	 * Find the best root person for a subset of people
	 * Prefers people with most descendants in the set, or earliest birth date
	 *
	 * @param people - Array of people to find root from
	 * @param allPeople - Map of all people for relationship checking
	 * @param includedCrIds - Set of crIds in the subset
	 * @returns The best root person's crId
	 */
	findBestRoot(
		people: PersonNode[],
		allPeople: Map<string, PersonNode>,
		includedCrIds: Set<string>
	): string {
		if (people.length === 0) {
			throw new Error('Cannot find root in empty people array');
		}

		// Score each person: more descendants in set = better root
		let bestPerson = people[0];
		let bestScore = 0;

		for (const person of people) {
			let score = 0;

			// Count descendants in set
			const visited = new Set<string>();
			const queue = [person.crId];
			while (queue.length > 0) {
				const crId = queue.shift()!;
				if (visited.has(crId)) continue;
				visited.add(crId);

				const p = allPeople.get(crId);
				if (!p) continue;

				for (const childId of p.childrenCrIds) {
					if (includedCrIds.has(childId) && !visited.has(childId)) {
						score++;
						queue.push(childId);
					}
				}
			}

			// Bonus for having no parents in set (top of tree)
			if (!person.fatherCrId || !includedCrIds.has(person.fatherCrId)) score += 10;
			if (!person.motherCrId || !includedCrIds.has(person.motherCrId)) score += 10;

			if (score > bestScore) {
				bestScore = score;
				bestPerson = person;
			}
		}

		return bestPerson.crId;
	}

	/**
	 * Generate canvas data for a subset of people
	 *
	 * @param tree - Source family tree
	 * @param includedCrIds - Set of crIds to include
	 * @param options - Canvas generation options
	 * @returns Canvas data or null if generation failed
	 */
	generateCanvasDataForSubset(
		tree: FamilyTree,
		includedCrIds: Set<string>,
		options: CanvasGenerationOptions = {}
	): CanvasData | null {
		if (includedCrIds.size === 0) {
			logger.warn('generateCanvasDataForSubset', 'No people to include');
			return null;
		}

		// Get people array
		const people: PersonNode[] = [];
		for (const crId of includedCrIds) {
			const person = tree.nodes.get(crId);
			if (person) {
				people.push(person);
			}
		}

		if (people.length === 0) {
			logger.warn('generateCanvasDataForSubset', 'No valid people found');
			return null;
		}

		// Find the best root for this subset
		const rootCrId = this.findBestRoot(people, tree.nodes, includedCrIds);

		// Create subset tree
		const subsetTree = this.createSubsetTree(tree.nodes, includedCrIds, rootCrId);
		if (!subsetTree) {
			logger.warn('generateCanvasDataForSubset', 'Failed to create subset tree');
			return null;
		}

		// Generate canvas using CanvasGenerator
		const generator = new CanvasGenerator();
		return generator.generateCanvas(subsetTree, options);
	}

	/**
	 * Generate and write canvas files for a generation-based split
	 *
	 * @param app - Obsidian app instance
	 * @param tree - Source family tree
	 * @param options - Generation split options
	 * @param canvasOptions - Canvas generation options
	 * @returns Array of write results
	 */
	async generateGenerationSplitCanvases(
		app: App,
		tree: FamilyTree,
		options: GenerationSplitOptions,
		canvasOptions: CanvasGenerationOptions = {}
	): Promise<CanvasWriteResult[]> {
		const results: CanvasWriteResult[] = [];
		const opts = { ...DEFAULT_GENERATION_SPLIT_OPTIONS, ...options };

		// Calculate generations
		const assignment = this.assignGenerations(tree, opts.generationDirection);

		// Create ranges
		const ranges = opts.customRanges || this.createGenerationRanges(
			assignment.generationBounds,
			opts.generationsPerCanvas,
			opts.generationDirection
		);

		// Assign people to ranges
		this.assignPeopleToRanges(assignment, ranges);

		// Generate canvas for each range
		for (const range of ranges) {
			const people = assignment.byRange.get(range.label) || [];
			if (people.length === 0) continue;

			const includedCrIds = new Set(people.map(p => p.crId));
			const canvasData = this.generateCanvasDataForSubset(tree, includedCrIds, canvasOptions);

			if (!canvasData) {
				results.push({
					success: false,
					path: this.generateCanvasPath(opts, range.label),
					error: 'Failed to generate canvas data'
				});
				continue;
			}

			const result = await writeCanvasFile(
				app,
				this.generateCanvasPath(opts, range.label),
				canvasData,
				true // overwrite
			);
			results.push(result);
		}

		return results;
	}

	/**
	 * Generate and write canvas files for a branch-based split
	 *
	 * @param app - Obsidian app instance
	 * @param tree - Source family tree
	 * @param options - Branch split options
	 * @param canvasOptions - Canvas generation options
	 * @returns Array of write results
	 */
	async generateBranchSplitCanvases(
		app: App,
		tree: FamilyTree,
		options: BranchSplitOptions,
		canvasOptions: CanvasGenerationOptions = {}
	): Promise<CanvasWriteResult[]> {
		const results: CanvasWriteResult[] = [];
		const opts = { ...DEFAULT_BRANCH_SPLIT_OPTIONS, ...options };

		// Extract each branch
		for (const branchDef of opts.branches) {
			const extraction = this.extractBranch(tree, branchDef, opts);
			if (extraction.people.length === 0) continue;

			const canvasData = this.generateCanvasDataForSubset(tree, extraction.crIds, canvasOptions);

			if (!canvasData) {
				const path = `${opts.outputFolder || ''}/${toSafeFilename(branchDef.label)}.canvas`;
				results.push({
					success: false,
					path,
					error: 'Failed to generate canvas data'
				});
				continue;
			}

			const path = `${opts.outputFolder || ''}/${toSafeFilename(branchDef.label)}`;
			const result = await writeCanvasFile(app, path, canvasData, true);
			results.push(result);
		}

		return results;
	}

	/**
	 * Generate and write canvas file for a lineage extraction
	 *
	 * @param app - Obsidian app instance
	 * @param tree - Source family tree
	 * @param options - Lineage split options
	 * @param canvasOptions - Canvas generation options
	 * @returns Write result
	 */
	async generateLineageCanvas(
		app: App,
		tree: FamilyTree,
		options: LineageSplitOptions,
		canvasOptions: CanvasGenerationOptions = {}
	): Promise<CanvasWriteResult> {
		const opts = { ...DEFAULT_LINEAGE_SPLIT_OPTIONS, ...options };

		// Extract lineage
		const extraction = this.extractLineage(tree, opts);

		if (!extraction.pathFound || extraction.allPeople.length === 0) {
			const label = opts.label || 'lineage';
			const path = `${opts.outputFolder || ''}/${toSafeFilename(label)}.canvas`;
			return {
				success: false,
				path,
				error: 'No path found between the specified people'
			};
		}

		const canvasData = this.generateCanvasDataForSubset(tree, extraction.allCrIds, canvasOptions);

		if (!canvasData) {
			const label = opts.label || 'lineage';
			const path = `${opts.outputFolder || ''}/${toSafeFilename(label)}.canvas`;
			return {
				success: false,
				path,
				error: 'Failed to generate canvas data'
			};
		}

		const label = opts.label || 'lineage';
		const path = `${opts.outputFolder || ''}/${toSafeFilename(label)}`;
		return await writeCanvasFile(app, path, canvasData, true);
	}

	/**
	 * Generate and write canvas files for a collection-based split
	 *
	 * @param app - Obsidian app instance
	 * @param tree - Source family tree
	 * @param options - Collection split options
	 * @param canvasOptions - Canvas generation options
	 * @returns Array of write results
	 */
	async generateCollectionSplitCanvases(
		app: App,
		tree: FamilyTree,
		options: CollectionSplitOptions,
		canvasOptions: CanvasGenerationOptions = {}
	): Promise<CanvasWriteResult[]> {
		const results: CanvasWriteResult[] = [];
		const opts = { ...DEFAULT_COLLECTION_SPLIT_OPTIONS, ...options };

		// Extract collections
		const extraction = this.extractCollections(tree, opts);

		// Generate canvas for each collection
		for (const [collectionName, info] of extraction.collections) {
			// Skip if we have a filter and this collection isn't in it
			if (opts.collections && opts.collections.length > 0) {
				if (!opts.collections.includes(collectionName)) continue;
			}

			const canvasData = this.generateCanvasDataForSubset(tree, info.crIds, canvasOptions);

			if (!canvasData) {
				const path = `${opts.outputFolder || ''}/${toSafeFilename(collectionName)}.canvas`;
				results.push({
					success: false,
					path,
					error: 'Failed to generate canvas data'
				});
				continue;
			}

			const path = `${opts.outputFolder || ''}/${toSafeFilename(collectionName)}`;
			const result = await writeCanvasFile(app, path, canvasData, true);
			results.push(result);
		}

		// Handle uncollected people
		if (opts.includeUncollected && extraction.uncollected.length > 0) {
			const uncollectedCrIds = new Set<string>(extraction.uncollected.map((p: PersonNode) => p.crId));
			const canvasData = this.generateCanvasDataForSubset(tree, uncollectedCrIds, canvasOptions);

			if (canvasData) {
				const path = `${opts.outputFolder || ''}/${toSafeFilename(opts.uncollectedLabel)}`;
				const result = await writeCanvasFile(app, path, canvasData, true);
				results.push(result);
			}
		}

		return results;
	}

	/**
	 * Generate and write canvas files for ancestor-descendant pair
	 *
	 * @param app - Obsidian app instance
	 * @param tree - Source family tree
	 * @param options - Ancestor-descendant split options
	 * @param canvasOptions - Canvas generation options
	 * @returns Array of write results
	 */
	async generateAncestorDescendantCanvases(
		app: App,
		tree: FamilyTree,
		options: AncestorDescendantSplitOptions,
		canvasOptions: CanvasGenerationOptions = {}
	): Promise<CanvasWriteResult[]> {
		const results: CanvasWriteResult[] = [];
		const opts = { ...DEFAULT_ANCESTOR_DESCENDANT_OPTIONS, ...options };

		const rootPerson = tree.nodes.get(opts.rootCrId);
		if (!rootPerson) {
			return [{
				success: false,
				path: '',
				error: 'Root person not found'
			}];
		}

		const labelPrefix = opts.labelPrefix || rootPerson.name || 'Person';

		// Extract ancestors
		const ancestorExtraction = this.extractAncestors(
			tree,
			opts.rootCrId,
			opts.maxAncestorGenerations,
			opts.includeSpouses
		);

		if (ancestorExtraction.people.length > 0) {
			const canvasData = this.generateCanvasDataForSubset(
				tree,
				ancestorExtraction.crIds,
				{ ...canvasOptions, treeType: 'ancestor' }
			);

			if (canvasData) {
				const path = `${opts.outputFolder || ''}/${toSafeFilename(labelPrefix)}-ancestors`;
				const result = await writeCanvasFile(app, path, canvasData, true);
				results.push(result);
			}
		}

		// Extract descendants
		const descendantExtraction = this.extractDescendants(
			tree,
			opts.rootCrId,
			opts.maxDescendantGenerations,
			opts.includeSpouses
		);

		if (descendantExtraction.people.length > 0) {
			const canvasData = this.generateCanvasDataForSubset(
				tree,
				descendantExtraction.crIds,
				{ ...canvasOptions, treeType: 'descendant' }
			);

			if (canvasData) {
				const path = `${opts.outputFolder || ''}/${toSafeFilename(labelPrefix)}-descendants`;
				const result = await writeCanvasFile(app, path, canvasData, true);
				results.push(result);
			}
		}

		return results;
	}
}
