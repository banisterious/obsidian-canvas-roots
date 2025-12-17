/**
 * Canvas Generator
 *
 * Converts family tree data structures into Obsidian Canvas JSON format.
 * Handles styling and edge rendering. Uses LayoutEngine for positioning.
 */

import { FamilyTree, PersonNode } from './family-graph';
import { LayoutEngine, LayoutOptions } from './layout-engine';
import { FamilyChartLayoutEngine } from './family-chart-layout';
import { TimelineLayoutEngine } from './timeline-layout';
import { HourglassLayoutEngine } from './hourglass-layout';
import { getLogger } from './logging';
import type { ArrowStyle, SpouseEdgeLabelFormat } from '../settings';
import type { SpouseRelationship } from '../models/person';
import type { StyleOverrides } from './canvas-style-overrides';
import { mergeStyleSettings } from './canvas-style-overrides';
import type { CanvasNavigationMetadata } from './canvas-navigation';
import type { RelationshipTypeDefinition } from '../relationships';
import { getDefaultRelationshipType } from '../relationships/constants/default-relationship-types';

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
 * Advanced Canvas style attributes for edges
 * These are only used when Advanced Canvas plugin is installed
 * @see https://github.com/Developer-Mike/obsidian-advanced-canvas
 */
interface AdvancedCanvasEdgeStyles {
	/** Line path style */
	path?: 'solid' | 'dotted' | 'short-dashed' | 'long-dashed';
	/** Arrow head style */
	arrow?: 'triangle' | 'triangle-outline' | 'thin-triangle' | 'halved-triangle' |
		'diamond' | 'diamond-outline' | 'circle' | 'circle-outline' | 'blunt';
	/** Path routing method */
	pathfindingMethod?: 'bezier' | 'direct' | 'square' | 'a-star';
}

/**
 * Obsidian Canvas edge (JSON Canvas 1.0 spec compliant)
 * Extended with optional Advanced Canvas styleAttributes
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
	/** Advanced Canvas style attributes (ignored by vanilla Obsidian) */
	styleAttributes?: AdvancedCanvasEdgeStyles;
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
		layoutType?: import('../settings').LayoutType;
	};

	/**
	 * Canvas-specific style overrides (optional)
	 * If present, these override global plugin style settings for this canvas.
	 * Preserved during canvas regeneration.
	 */
	styleOverrides?: StyleOverrides;

	/**
	 * Navigation and relationship metadata (optional)
	 * Tracks relationships to other canvases, navigation nodes, and split history.
	 */
	navigation?: CanvasNavigationMetadata;
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
	/** Color coding by gender (deprecated - use nodeColorScheme instead) */
	colorByGender?: boolean;

	/** Node color scheme: 'sex', 'generation', or 'monochrome' */
	nodeColorScheme?: import('../settings').ColorScheme;

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

	/** Edge color for parent-child relationships */
	parentChildEdgeColor?: import('../settings').CanvasColor;

	/** Edge color for spouse relationships */
	spouseEdgeColor?: import('../settings').CanvasColor;

	/** Show spouse edges with marriage metadata */
	showSpouseEdges?: boolean;

	/** Format for spouse edge labels */
	spouseEdgeLabelFormat?: SpouseEdgeLabelFormat;

	/** Show source count indicators on person nodes */
	showSourceIndicators?: boolean;

	/** Show research coverage percentage in source indicators (requires fact-level tracking) */
	showResearchCoverage?: boolean;
}

/**
 * Service for generating Obsidian Canvas JSON from family trees
 */
export class CanvasGenerator {
	private layoutEngine: LayoutEngine;
	private familyChartLayoutEngine: FamilyChartLayoutEngine;
	private timelineLayoutEngine: TimelineLayoutEngine;
	private hourglassLayoutEngine: HourglassLayoutEngine;

	constructor() {
		this.layoutEngine = new LayoutEngine();
		this.familyChartLayoutEngine = new FamilyChartLayoutEngine();
		this.timelineLayoutEngine = new TimelineLayoutEngine();
		this.hourglassLayoutEngine = new HourglassLayoutEngine();
	}

	/**
	 * Generates Canvas JSON from a family tree
	 */
	generateCanvas(
		familyTree: FamilyTree,
		options: CanvasGenerationOptions = {}
	): CanvasData {
		// Merge options with defaults, ensuring all required fields are present
		// Support legacy colorByGender option for backward compatibility
		const nodeColorScheme = options.nodeColorScheme ??
			(options.colorByGender === false ? 'monochrome' : 'sex');

		// Extract metadata and style overrides
		const metadata = options.canvasRootsMetadata;
		const styleOverrides = metadata?.styleOverrides;

		// Apply style overrides from metadata if present
		// This allows per-canvas style settings to override global settings
		const globalStyleSettings = {
			nodeColorScheme,
			parentChildArrowStyle: options.parentChildArrowStyle ?? 'directed' as const,
			spouseArrowStyle: options.spouseArrowStyle ?? 'undirected' as const,
			parentChildEdgeColor: options.parentChildEdgeColor ?? 'none' as const,
			spouseEdgeColor: options.spouseEdgeColor ?? 'none' as const,
			showSpouseEdges: options.showSpouseEdges ?? false,
			spouseEdgeLabelFormat: options.spouseEdgeLabelFormat ?? 'date-only' as const
		};

		const effectiveStyles = mergeStyleSettings(globalStyleSettings, styleOverrides);

		// Get layout type and apply spacing multiplier for compact layouts
		const layoutType = options.layoutType ?? 'standard';
		const spacingMultiplier = layoutType === 'compact' ? 0.5 : 1.0;

		const opts = {
			nodeSpacingX: (options.nodeSpacingX ?? 300) * spacingMultiplier,
			nodeSpacingY: (options.nodeSpacingY ?? 200) * spacingMultiplier,
			nodeWidth: options.nodeWidth ?? 250,
			nodeHeight: options.nodeHeight ?? 120,
			direction: options.direction ?? 'vertical' as const,
			treeType: options.treeType ?? 'descendant' as const,
			layoutType: layoutType,
			showLabels: options.showLabels ?? true,
			useFamilyChartLayout: options.useFamilyChartLayout ?? true,
			// Use effective styles (global settings merged with per-canvas overrides)
			nodeColorScheme: effectiveStyles.nodeColorScheme,
			parentChildArrowStyle: effectiveStyles.parentChildArrowStyle,
			spouseArrowStyle: effectiveStyles.spouseArrowStyle,
			parentChildEdgeColor: effectiveStyles.parentChildEdgeColor,
			spouseEdgeColor: effectiveStyles.spouseEdgeColor,
			showSpouseEdges: effectiveStyles.showSpouseEdges,
			spouseEdgeLabelFormat: effectiveStyles.spouseEdgeLabelFormat,
			showSourceIndicators: options.showSourceIndicators ?? false,
			showResearchCoverage: options.showResearchCoverage ?? false
		};

		logger.debug('canvas-generation', 'Canvas generation options', {
			useFamilyChartLayout: opts.useFamilyChartLayout,
			hasMetadata: !!metadata,
			metadataKeys: metadata ? Object.keys(metadata) : null,
			hasStyleOverrides: !!styleOverrides,
			effectiveNodeColorScheme: effectiveStyles.nodeColorScheme
		});

		// Choose layout engine based on layout type
		// For very large trees (>200 people), fall back to D3 layout to avoid freeze
		const LARGE_TREE_THRESHOLD = 200;
		const isLargeTree = familyTree.nodes.size > LARGE_TREE_THRESHOLD;

		let layoutResult;
		if (layoutType === 'timeline') {
			// Timeline layout: position by birth year
			layoutResult = this.timelineLayoutEngine.calculateLayout(familyTree, opts);
		} else if (layoutType === 'hourglass') {
			// Hourglass layout: ancestors above, descendants below
			layoutResult = this.hourglassLayoutEngine.calculateLayout(familyTree, opts);
		} else if (opts.useFamilyChartLayout && !isLargeTree) {
			// Standard/compact: use family-chart for proper spouse handling
			layoutResult = this.familyChartLayoutEngine.calculateLayout(familyTree, opts);
		} else {
			// Large trees or explicit request: use D3 hierarchical layout (faster)
			if (isLargeTree) {
				logger.info('generate-canvas', `Large tree (${familyTree.nodes.size} people) - using D3 layout for performance`);
			}
			layoutResult = this.layoutEngine.calculateLayout(familyTree, opts);
		}

		// Generate canvas nodes
		const canvasNodes: CanvasNode[] = [];
		const nodeMap = new Map<string, { x: number; y: number }>();
		const crIdToCanvasId = new Map<string, string>();

		// Process hierarchically positioned nodes
		for (const position of layoutResult.positions) {
			const { crId, person, x, y, generation } = position;

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
				color: this.getNodeColor(person, generation, opts.nodeColorScheme)
			});
		}

		// Add nodes that appear in edges but weren't positioned by the layout engine
		const spouseSpacing = opts.nodeWidth + (opts.nodeSpacingX * 0.3); // 30% of horizontal spacing

		// Create a map of crId to generation for quick lookup
		const generationMap = new Map<string, number | undefined>();
		for (const position of layoutResult.positions) {
			generationMap.set(position.crId, position.generation);
		}

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

						// Spouses have the same generation
						const generation = generationMap.get(edge.from);

						canvasNodes.push({
							id: canvasId,
							type: 'file',
							file: spouse.file.path,
							x: spousePos.x,
							y: spousePos.y,
							width: opts.nodeWidth,
							height: opts.nodeHeight,
							color: this.getNodeColor(spouse, generation, opts.nodeColorScheme)
						});
					}
				} else if (toPos && !fromPos) {
					const spouse = familyTree.nodes.get(edge.from);
					if (spouse) {
						const canvasId = this.generateId();
						crIdToCanvasId.set(edge.from, canvasId);
						const spousePos = { x: toPos.x - spouseSpacing, y: toPos.y };
						nodeMap.set(edge.from, spousePos);

						// Spouses have the same generation
						const generation = generationMap.get(edge.to);

						canvasNodes.push({
							id: canvasId,
							type: 'file',
							file: spouse.file.path,
							x: spousePos.x,
							y: spousePos.y,
							width: opts.nodeWidth,
							height: opts.nodeHeight,
							color: this.getNodeColor(spouse, generation, opts.nodeColorScheme)
						});
					}
				} else if (!fromPos && !toPos) {
					// Both spouses are missing - find a child to position relative to
					const spouse1 = familyTree.nodes.get(edge.from);
					const spouse2 = familyTree.nodes.get(edge.to);
					if (spouse1 && spouse2) {
						let childPos: { x: number; y: number } | undefined;
						let childCrId: string | undefined;
						for (const childEdge of familyTree.edges) {
							if (childEdge.type === 'parent' &&
								(childEdge.from === edge.from || childEdge.from === edge.to)) {
								childPos = nodeMap.get(childEdge.to);
								if (childPos) {
									childCrId = childEdge.to;
									break;
								}
							}
						}

						if (childPos && childCrId) {
							// Position parents above child
							const parent1Pos = { x: childPos.x - spouseSpacing / 2, y: childPos.y - opts.nodeSpacingY };
							const parent2Pos = { x: childPos.x + spouseSpacing / 2, y: childPos.y - opts.nodeSpacingY };

							// Parents are one generation before their child
							const childGeneration = generationMap.get(childCrId);
							const parentGeneration = childGeneration !== undefined ? childGeneration - 1 : undefined;

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
								color: this.getNodeColor(spouse1, parentGeneration, opts.nodeColorScheme)
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
								color: this.getNodeColor(spouse2, parentGeneration, opts.nodeColorScheme)
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

		// Add source indicator nodes if enabled
		if (opts.showSourceIndicators) {
			this.addSourceIndicatorNodes(canvasNodes, familyTree, nodeMap, opts);
		}

		// Add conflict indicator nodes when research coverage is enabled
		if (opts.showSourceIndicators && opts.showResearchCoverage) {
			this.addConflictIndicatorNodes(canvasNodes, familyTree, nodeMap, opts);
		}

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
	 * Adds small text nodes as source indicators near person nodes
	 * Shows the number of source notes linking to each person, and optionally research coverage
	 */
	private addSourceIndicatorNodes(
		canvasNodes: CanvasNode[],
		familyTree: FamilyTree,
		nodeMap: Map<string, { x: number; y: number }>,
		opts: { nodeWidth: number; nodeHeight: number; showResearchCoverage?: boolean }
	): void {
		// Indicator node dimensions - wider if showing coverage percentage
		const showCoverage = opts.showResearchCoverage ?? false;
		const indicatorWidth = showCoverage ? 70 : 40;
		const indicatorHeight = 24;
		const offsetX = opts.nodeWidth - indicatorWidth - 4; // Position at top-right
		const offsetY = -indicatorHeight - 2; // Position above the node

		for (const [crId, person] of familyTree.nodes) {
			const pos = nodeMap.get(crId);
			if (!pos) continue;

			const sourceCount = person.sourceCount ?? 0;
			const coveragePercent = person.researchCoveragePercent;

			// Show indicator if person has sources OR has research coverage data
			if (sourceCount === 0 && coveragePercent === undefined) continue;

			// Build indicator text
			let indicatorText: string;
			if (showCoverage && coveragePercent !== undefined) {
				// Show both source count and coverage percentage
				indicatorText = sourceCount > 0 ? `📎 ${sourceCount} · ${coveragePercent}%` : `${coveragePercent}%`;
			} else {
				// Original behavior: just source count
				if (sourceCount === 0) continue;
				indicatorText = `📎 ${sourceCount}`;
			}

			// Determine color based on coverage (if available) or source count
			let color: string | undefined;
			if (showCoverage && coveragePercent !== undefined) {
				// Color by research coverage percentage
				if (coveragePercent >= 75) {
					color = '4'; // Green - well researched
				} else if (coveragePercent >= 50) {
					color = '3'; // Yellow - moderate coverage
				} else {
					color = '1'; // Red - needs research
				}
			} else {
				// Original behavior: color by source count
				color = sourceCount >= 3 ? '4' : sourceCount >= 1 ? '3' : undefined;
			}

			// Create source indicator text node
			canvasNodes.push({
				id: this.generateId(),
				type: 'text',
				text: indicatorText,
				x: pos.x + offsetX,
				y: pos.y + offsetY,
				width: indicatorWidth,
				height: indicatorHeight,
				color
			});
		}
	}

	/**
	 * Adds small text nodes as conflict indicators near person nodes
	 * Shows when a person has unresolved source conflicts (only when fact-level tracking is enabled)
	 */
	private addConflictIndicatorNodes(
		canvasNodes: CanvasNode[],
		familyTree: FamilyTree,
		nodeMap: Map<string, { x: number; y: number }>,
		opts: { nodeWidth: number; nodeHeight: number }
	): void {
		const indicatorWidth = 36;
		const indicatorHeight = 24;
		// Position at top-left (source indicator is at top-right)
		const offsetX = 4;
		const offsetY = -indicatorHeight - 2;

		for (const [crId, person] of familyTree.nodes) {
			const pos = nodeMap.get(crId);
			if (!pos) continue;

			const conflictCount = person.conflictCount ?? 0;
			if (conflictCount === 0) continue;

			// Create conflict indicator text node
			canvasNodes.push({
				id: this.generateId(),
				type: 'text',
				text: `⚠️ ${conflictCount}`,
				x: pos.x + offsetX,
				y: pos.y + offsetY,
				width: indicatorWidth,
				height: indicatorHeight,
				color: '1' // Red - conflicts need attention
			});
		}
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
			nodeColorScheme: import('../settings').ColorScheme;
			showLabels: boolean;
			useFamilyChartLayout: boolean;
			parentChildArrowStyle: ArrowStyle;
			spouseArrowStyle: ArrowStyle;
			parentChildEdgeColor: import('../settings').CanvasColor;
			spouseEdgeColor: import('../settings').CanvasColor;
			showSpouseEdges: boolean;
			spouseEdgeLabelFormat: SpouseEdgeLabelFormat;
			showRelationshipEdges?: boolean;
			relationshipTypes?: Map<string, RelationshipTypeDefinition>;
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
			// 2. Conditionally skip spouse edges based on settings
			// 3. Conditionally skip relationship edges based on settings
			if (edge.type === 'child') {
				continue; // Skip child edges - we'll show parent edges instead
			}

			if (edge.type === 'spouse' && !options.showSpouseEdges) {
				continue; // Skip spouse edges when setting is disabled (default)
			}

			if (edge.type === 'relationship' && !options.showRelationshipEdges) {
				// Always show step/adoptive parent edges - they're core family relationships
				// Only skip user-defined custom relationship edges when setting is disabled
				const isFamilyRelationship = edge.relationshipTypeId === 'step_parent' ||
					edge.relationshipTypeId === 'adoptive_parent';
				if (!isFamilyRelationship) {
					continue; // Skip custom relationship edges when setting is disabled
				}
			}

			// Determine edge sides based on direction and relationship
			// Note: We've already filtered out 'child' edges above
			let fromSide: 'top' | 'right' | 'bottom' | 'left';
			let toSide: 'top' | 'right' | 'bottom' | 'left';

			// Step/adoptive parent edges should be oriented like parent edges
			const isParentLikeEdge = edge.type === 'parent' ||
				edge.relationshipTypeId === 'step_parent' ||
				edge.relationshipTypeId === 'adoptive_parent';

			if (options.direction === 'vertical') {
				if (isParentLikeEdge) {
					// Parent-child relationships: always vertical (top-bottom)
					fromSide = 'bottom';
					toSide = 'top';
				} else {
					// Spouse and custom relationships: horizontal (side-to-side)
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
				if (isParentLikeEdge) {
					// Parent-child: horizontal
					fromSide = 'right';
					toSide = 'left';
				} else {
					// Spouse and custom relationships: vertical
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
			let arrowStyle: ArrowStyle;
			if (edge.type === 'parent') {
				arrowStyle = options.parentChildArrowStyle;
			} else if (edge.type === 'relationship') {
				// Custom relationships use directed arrows by default
				arrowStyle = 'directed';
			} else {
				arrowStyle = options.spouseArrowStyle;
			}
			const [fromEnd, toEnd] = this.getArrowEndpoints(arrowStyle);

			// Determine edge color and line style based on relationship type and settings
			let edgeColor: string | undefined;
			let lineStyle: 'solid' | 'dashed' | 'dotted' | undefined;
			if (edge.type === 'parent') {
				edgeColor = options.parentChildEdgeColor === 'none' ? undefined : options.parentChildEdgeColor;
			} else if (edge.type === 'relationship') {
				// Relationships use their defined color and line style
				if (edge.relationshipTypeId) {
					// Try custom types first, then fall back to built-in defaults
					const relType = options.relationshipTypes?.get(edge.relationshipTypeId) ??
						getDefaultRelationshipType(edge.relationshipTypeId);
					edgeColor = relType?.color;
					lineStyle = relType?.lineStyle;
				}
			} else {
				edgeColor = options.spouseEdgeColor === 'none' ? undefined : options.spouseEdgeColor;
			}

			// Generate label for edge
			let edgeLabel: string | undefined;
			if (edge.type === 'spouse' && options.showSpouseEdges) {
				// For spouse edges, look up marriage metadata from PersonNode
				const fromPerson = familyTree.nodes.get(edge.from);
				if (fromPerson?.spouses) {
					// Find the spouse relationship for this specific edge
					const spouseRelationship = fromPerson.spouses.find(s => s.personId === edge.to);
					edgeLabel = this.formatMarriageLabel(spouseRelationship, options.spouseEdgeLabelFormat);
				}
			} else if (edge.type === 'relationship') {
				// Use the relationship label from the edge
				edgeLabel = edge.relationshipLabel;
			} else if (options.showLabels) {
				edgeLabel = this.getEdgeLabel(edge.type);
			}

			// Build Advanced Canvas styleAttributes if line style is not solid
			// These attributes are ignored by vanilla Obsidian but used by Advanced Canvas plugin
			let styleAttributes: AdvancedCanvasEdgeStyles | undefined;
			if (lineStyle && lineStyle !== 'solid') {
				// Map our lineStyle values to Advanced Canvas path values
				const pathStyle = lineStyle === 'dashed' ? 'short-dashed' : lineStyle;
				styleAttributes = { path: pathStyle };
			}

			edges.push({
				id: this.generateId(),
				fromNode: fromCanvasId,
				fromSide,
				fromEnd,
				toNode: toCanvasId,
				toSide,
				toEnd,
				color: edgeColor,
				label: edgeLabel,
				styleAttributes
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
		// Use sex/gender field from frontmatter if available
		if (person.sex) {
			const sex = person.sex.toUpperCase();
			if (sex === 'M' || sex === 'MALE') {
				return '4'; // Green for males
			}
			if (sex === 'F' || sex === 'FEMALE') {
				return '6'; // Purple for females
			}
			if (sex === 'NONBINARY') {
				return '3'; // Yellow for non-binary
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
	 * Gets color for person node based on generation number
	 * Uses Obsidian's 6 canvas colors to create visual layers:
	 * 1 = Red, 2 = Orange, 3 = Yellow, 4 = Green, 5 = Blue (Cyan), 6 = Purple
	 *
	 * Color cycling pattern:
	 * - Generation 0 (root): Purple (6)
	 * - Generation 1: Cyan (5)
	 * - Generation 2: Green (4)
	 * - Generation 3: Yellow (3)
	 * - Generation 4: Orange (2)
	 * - Generation 5: Red (1)
	 * - Then repeats...
	 *
	 * @param generation - Generation number (0 = root, positive = descendants, negative = ancestors)
	 * @returns Color code string ('1' through '6')
	 */
	private getGenerationColor(generation: number | undefined): string {
		if (generation === undefined) {
			return '2'; // Orange (neutral) for undefined generations
		}

		// Use absolute value for ancestors (negative generations)
		const absGeneration = Math.abs(generation);

		// Cycle through colors 1-6, starting with purple (6) for generation 0
		// Map: 0→6, 1→5, 2→4, 3→3, 4→2, 5→1, 6→6, 7→5, etc.
		const colorIndex = 6 - (absGeneration % 6);
		return String(colorIndex === 0 ? 6 : colorIndex);
	}

	/**
	 * Gets color for person node based on their collection
	 * Uses Obsidian's 6 canvas colors to distinguish collections:
	 * 1 = Red, 2 = Orange, 3 = Yellow, 4 = Green, 5 = Blue, 6 = Purple
	 *
	 * Collections are assigned colors in a rotating pattern based on alphabetical order.
	 * People without a collection get a neutral color (gray).
	 *
	 * @param person - Person node
	 * @returns Color code string ('1' through '6') or undefined for no collection
	 */
	private getCollectionColor(person: PersonNode): string | undefined {
		// If person has no collection, return undefined (gray/monochrome)
		if (!person.collection) {
			return undefined;
		}

		// Create a simple hash from the collection name to get consistent colors
		// Same collection = same color across all canvases
		let hash = 0;
		for (let i = 0; i < person.collection.length; i++) {
			hash = person.collection.charCodeAt(i) + ((hash << 5) - hash);
		}

		// Map hash to colors 1-6
		const colorIndex = (Math.abs(hash) % 6) + 1;
		return String(colorIndex);
	}

	/**
	 * Gets node color based on the selected color scheme
	 *
	 * @param person - Person node
	 * @param generation - Generation number (optional, required for 'generation' scheme)
	 * @param colorScheme - Color scheme to use
	 * @returns Color code string ('1' through '6') or undefined for monochrome
	 */
	private getNodeColor(
		person: PersonNode,
		generation: number | undefined,
		colorScheme: import('../settings').ColorScheme
	): string | undefined {
		switch (colorScheme) {
			case 'sex':
				return this.getPersonColor(person);
			case 'generation':
				return this.getGenerationColor(generation);
			case 'collection':
				return this.getCollectionColor(person);
			case 'monochrome':
				return undefined;  // No color
			default:
				return this.getPersonColor(person);  // Fallback to sex
		}
	}

	/**
	 * Gets label text for edge based on relationship type
	 *
	 * Note: We hide labels for parent/spouse/child because:
	 * - The visual layout (top-to-bottom for parent-child, side-by-side for spouses) makes relationships clear
	 * - Labels clutter the diagram and cause overlaps
	 * - Edge colors already distinguish relationship types
	 * Custom relationships use their own labels from edge.relationshipLabel
	 */
	private getEdgeLabel(_type: 'parent' | 'spouse' | 'child' | 'relationship'): string {
		// Return empty string to hide labels - visual layout is self-explanatory
		// Custom relationship labels are handled separately via edge.relationshipLabel
		return '';
	}

	/**
	 * Generates a unique ID for canvas elements
	 */
	private generateId(): string {
		return Math.random().toString(36).substring(2, 15) +
			Math.random().toString(36).substring(2, 15);
	}

	/**
	 * Formats marriage metadata into an edge label
	 * @param spouseRelationship The spouse relationship with metadata
	 * @param format The label format to use
	 * @returns Formatted label string, or undefined if no metadata or format is 'none'
	 */
	private formatMarriageLabel(
		spouseRelationship: SpouseRelationship | undefined,
		format: SpouseEdgeLabelFormat
	): string | undefined {
		if (!spouseRelationship || format === 'none') {
			return undefined;
		}

		const parts: string[] = [];

		// Marriage date
		if (spouseRelationship.marriageDate) {
			// Format date: if it's ISO format (YYYY-MM-DD), show just year for brevity
			const date = spouseRelationship.marriageDate;
			const yearMatch = date.match(/^(\d{4})/);
			const formattedDate = yearMatch ? yearMatch[1] : date;
			parts.push(`m. ${formattedDate}`);
		}

		// For 'date-only', stop here
		if (format === 'date-only') {
			return parts.length > 0 ? parts.join(' | ') : undefined;
		}

		// Location (for 'date-location' and 'full')
		if (spouseRelationship.marriageLocation && (format === 'date-location' || format === 'full')) {
			parts.push(spouseRelationship.marriageLocation);
		}

		// For 'date-location', stop here
		if (format === 'date-location') {
			return parts.length > 0 ? parts.join(' | ') : undefined;
		}

		// Divorce/status info (for 'full' only)
		if (format === 'full') {
			if (spouseRelationship.divorceDate) {
				const date = spouseRelationship.divorceDate;
				const yearMatch = date.match(/^(\d{4})/);
				const formattedDate = yearMatch ? yearMatch[1] : date;
				parts.push(`div. ${formattedDate}`);
			} else if (spouseRelationship.marriageStatus && spouseRelationship.marriageStatus !== 'current') {
				parts.push(spouseRelationship.marriageStatus);
			}
		}

		return parts.length > 0 ? parts.join(' | ') : undefined;
	}

	/**
	 * Generates a collection overview canvas
	 * Shows all collections as nodes with connections between them
	 *
	 * @param collections - Array of family components or user collections
	 * @param connections - Optional array of collection connections
	 * @param options - Optional canvas generation options
	 */
	generateCollectionOverviewCanvas(
		collections: Array<{ name: string; size: number; representative?: PersonNode }>,
		connections?: Array<{ fromCollection: string; toCollection: string; bridgePeople: PersonNode[]; relationshipCount: number }>,
		options: { nodeWidth?: number; nodeHeight?: number } = {}
	): CanvasData {
		const nodeWidth = options.nodeWidth ?? 300;
		const nodeHeight = options.nodeHeight ?? 200;
		const horizontalSpacing = 400;
		const verticalSpacing = 300;

		const canvasNodes: CanvasNode[] = [];
		const canvasEdges: CanvasEdge[] = [];
		const collectionToNodeId = new Map<string, string>();

		// Calculate grid layout (3 columns)
		const columns = 3;
		let currentX = 100;
		let currentY = 100;
		let column = 0;

		// Create legend node first
		const legendId = this.generateId();
		const legendText = `# Collection Overview

This canvas shows all collections in your vault.

**Collections:** Family groups or custom collections
**Connections:** Lines show relationships between collections
**Statistics:** Person count and representative shown for each

Generated: ${new Date().toLocaleString()}`;

		canvasNodes.push({
			id: legendId,
			type: 'text',
			text: legendText,
			x: currentX,
			y: currentY,
			width: nodeWidth,
			height: nodeHeight,
			color: '3' // Yellow for legend
		});

		// Move to next column for first collection
		column++;
		currentX += nodeWidth + horizontalSpacing;

		// Create collection nodes
		for (const collection of collections) {
			const nodeId = this.generateId();
			collectionToNodeId.set(collection.name, nodeId);

			// Build collection text content
			let nodeText = `# ${collection.name}\n\n`;
			nodeText += `**People:** ${collection.size}\n\n`;

			if (collection.representative) {
				nodeText += `**Representative:**\n${collection.representative.name}`;
				if (collection.representative.birthDate) {
					nodeText += `\n📅 ${collection.representative.birthDate}`;
				}
			}

			// Use collection color if available (hash-based coloring)
			const color = this.getCollectionColorFromName(collection.name);

			canvasNodes.push({
				id: nodeId,
				type: 'text',
				text: nodeText,
				x: currentX,
				y: currentY,
				width: nodeWidth,
				height: nodeHeight,
				color
			});

			// Update position for next node
			column++;
			if (column >= columns) {
				column = 0;
				currentX = 100;
				currentY += nodeHeight + verticalSpacing;
			} else {
				currentX += nodeWidth + horizontalSpacing;
			}
		}

		// Create connection edges if provided
		if (connections) {
			for (const connection of connections) {
				const fromNodeId = collectionToNodeId.get(connection.fromCollection);
				const toNodeId = collectionToNodeId.get(connection.toCollection);

				if (fromNodeId && toNodeId) {
					const edgeId = this.generateId();
					const label = `${connection.bridgePeople.length} bridge ${connection.bridgePeople.length === 1 ? 'person' : 'people'}`;

					canvasEdges.push({
						id: edgeId,
						fromNode: fromNodeId,
						toNode: toNodeId,
						fromEnd: 'none',
						toEnd: 'none',
						color: '5', // Cyan for connections
						label
					});
				}
			}
		}

		return {
			nodes: canvasNodes,
			edges: canvasEdges
		};
	}

	/**
	 * Helper method to get consistent color for a collection name
	 * Matches the logic used in getCollectionColor()
	 */
	private getCollectionColorFromName(collectionName: string): string {
		let hash = 0;
		for (let i = 0; i < collectionName.length; i++) {
			hash = collectionName.charCodeAt(i) + ((hash << 5) - hash);
		}
		const colorIndex = (Math.abs(hash) % 6) + 1;
		return String(colorIndex);
	}
}
