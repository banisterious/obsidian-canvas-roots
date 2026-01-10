/**
 * Timeline Canvas Exporter
 *
 * Exports event timelines to Obsidian Canvas format.
 * Supports chronological positioning, relative ordering via before/after,
 * and color-coding by event type.
 */

import { App, TFile } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import { getLogger } from '../../core/logging';
import {
	writeCanvasFile,
	generateCanvasId,
	toSafeFilename
} from '../../core/canvas-utils';
import type { CanvasData } from '../../core/canvas-utils';
import { EventNote, getEventType } from '../types/event-types';

const logger = getLogger('TimelineCanvasExporter');

/**
 * Canvas node for timeline export
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
 * Canvas edge for timeline export
 */
interface CanvasEdge {
	id: string;
	fromNode: string;
	fromSide: 'top' | 'right' | 'bottom' | 'left';
	fromEnd?: 'none' | 'arrow';
	toNode: string;
	toSide: 'top' | 'right' | 'bottom' | 'left';
	toEnd?: 'none' | 'arrow';
	color?: string;
	label?: string;
}

/**
 * Color scheme for event nodes
 */
export type TimelineColorScheme = 'event_type' | 'category' | 'confidence' | 'monochrome';

/**
 * Layout style for timeline
 */
export type TimelineLayoutStyle = 'horizontal' | 'vertical' | 'gantt';

/**
 * Options for timeline canvas export
 */
export interface TimelineCanvasOptions {
	/** Title for the canvas file */
	title?: string;
	/** Color scheme for nodes */
	colorScheme?: TimelineColorScheme;
	/** Layout style */
	layoutStyle?: TimelineLayoutStyle;
	/** Node width */
	nodeWidth?: number;
	/** Node height */
	nodeHeight?: number;
	/** Horizontal spacing between nodes */
	spacingX?: number;
	/** Vertical spacing between nodes */
	spacingY?: number;
	/** Include before/after edges */
	includeOrderingEdges?: boolean;
	/** Group by person */
	groupByPerson?: boolean;
	/** Filter by person (wikilink) */
	filterPerson?: string;
	/** Filter by place (wikilink) */
	filterPlace?: string;
	/** Filter by event type */
	filterEventType?: string;
	/** Filter by group/faction */
	filterGroup?: string;
}

/**
 * Positioned event for layout
 */
interface PositionedEvent {
	event: EventNote;
	x: number;
	y: number;
	canvasId: string;
}

/**
 * Map event type hex colors to Obsidian canvas colors (1-6)
 * Colors: 1=Red, 2=Orange, 3=Yellow, 4=Green, 5=Blue/Cyan, 6=Purple
 */
function hexToCanvasColor(hex: string): string {
	// Convert hex to HSL to determine the closest canvas color
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;

	if (max !== min) {
		const d = max - min;
		if (max === r) {
			h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
		} else if (max === g) {
			h = ((b - r) / d + 2) / 6;
		} else {
			h = ((r - g) / d + 4) / 6;
		}
	}

	const hue = h * 360;

	// Map hue ranges to canvas colors
	if (hue >= 330 || hue < 15) return '1'; // Red
	if (hue >= 15 && hue < 45) return '2'; // Orange
	if (hue >= 45 && hue < 75) return '3'; // Yellow
	if (hue >= 75 && hue < 165) return '4'; // Green
	if (hue >= 165 && hue < 260) return '5'; // Blue/Cyan
	if (hue >= 260 && hue < 330) return '6'; // Purple

	return '2'; // Default to orange
}

/**
 * Map event category to canvas color
 */
function categoryToCanvasColor(category: string): string {
	switch (category) {
		case 'core':
			return '4'; // Green
		case 'extended':
			return '5'; // Blue
		case 'narrative':
			return '6'; // Purple
		case 'custom':
			return '2'; // Orange
		default:
			return '2';
	}
}

/**
 * Map confidence to canvas color
 */
function confidenceToCanvasColor(confidence: string): string {
	switch (confidence) {
		case 'high':
			return '4'; // Green
		case 'medium':
			return '3'; // Yellow
		case 'low':
			return '2'; // Orange
		case 'unknown':
			return '1'; // Red
		default:
			return '2';
	}
}

/**
 * Extract year from a date string
 */
function extractYear(dateStr: string): number | null {
	const match = dateStr.match(/^(\d{4})/);
	return match ? parseInt(match[1]) : null;
}

/**
 * Extract month and day from a date string for sub-year positioning
 */
function extractMonthDay(dateStr: string): { month: number; day: number } {
	const monthMatch = dateStr.match(/^\d{4}-(\d{2})/);
	const dayMatch = dateStr.match(/^\d{4}-\d{2}-(\d{2})/);

	return {
		month: monthMatch ? parseInt(monthMatch[1]) : 6, // Default to mid-year
		day: dayMatch ? parseInt(dayMatch[1]) : 15 // Default to mid-month
	};
}

/**
 * Sort events chronologically with topological sort for before/after constraints
 */
function sortEventsChronologically(events: EventNote[]): EventNote[] {
	// First, sort by date
	const byDate = [...events].sort((a, b) => {
		// Events with sortOrder use that first
		if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
			return a.sortOrder - b.sortOrder;
		}
		if (a.sortOrder !== undefined) return -1;
		if (b.sortOrder !== undefined) return 1;

		// Then sort by date
		if (a.date && b.date) {
			return a.date.localeCompare(b.date);
		}
		if (a.date) return -1;
		if (b.date) return 1;

		// Finally sort by title
		return a.title.localeCompare(b.title);
	});

	// Build dependency graph for before/after constraints
	const eventByCrId = new Map<string, EventNote>();
	const eventByPath = new Map<string, EventNote>();

	for (const event of events) {
		eventByCrId.set(event.crId, event);
		eventByPath.set(event.filePath, event);
	}

	// Simple topological adjustment: events with 'after' constraints should come after
	// their referenced events. This is a simple heuristic, not full topological sort.
	const result: EventNote[] = [];
	const added = new Set<string>();

	function addEvent(event: EventNote): void {
		if (added.has(event.crId)) return;

		// First add any events this one should come after
		if (event.after) {
			for (const afterRef of event.after) {
				const refPath = afterRef.replace(/^\[\[/, '').replace(/\]\]$/, '');
				const afterEvent = eventByPath.get(refPath) || eventByPath.get(refPath + '.md');
				if (afterEvent && !added.has(afterEvent.crId)) {
					addEvent(afterEvent);
				}
			}
		}

		result.push(event);
		added.add(event.crId);
	}

	for (const event of byDate) {
		addEvent(event);
	}

	return result;
}

/**
 * Timeline Canvas Exporter Service
 */
export class TimelineCanvasExporter {
	constructor(
		private app: App,
		private settings: CanvasRootsSettings
	) {}

	/**
	 * Export events to a canvas file
	 */
	async exportToCanvas(
		events: EventNote[],
		options: TimelineCanvasOptions = {}
	): Promise<{ success: boolean; path?: string; error?: string; warnings?: string[] }> {
		const {
			title = 'Event Timeline',
			colorScheme = 'event_type',
			layoutStyle = 'horizontal',
			nodeWidth = 200,
			nodeHeight = 100,
			spacingX = 50,
			spacingY = 50,
			includeOrderingEdges = true,
			groupByPerson = false,
			filterPerson,
			filterPlace,
			filterEventType,
			filterGroup
		} = options;

		try {
			// Filter events if needed
			let filteredEvents = events;

			if (filterPerson) {
				filteredEvents = filteredEvents.filter(e =>
					e.person === filterPerson ||
					e.persons?.includes(filterPerson)
				);
			}

			if (filterPlace) {
				filteredEvents = filteredEvents.filter(e => e.place === filterPlace);
			}

			if (filterEventType) {
				filteredEvents = filteredEvents.filter(e => e.eventType === filterEventType);
			}

			if (filterGroup) {
				filteredEvents = filteredEvents.filter(e => e.groups?.includes(filterGroup));
			}

			if (filteredEvents.length === 0) {
				return { success: false, error: 'No events to export after filtering' };
			}

			// Sort events
			const sortedEvents = sortEventsChronologically(filteredEvents);

			// Track warnings for user feedback
			const warnings: string[] = [];

			// Check for Gantt layout issues before positioning
			if (layoutStyle === 'gantt') {
				const datedEvents = sortedEvents.filter(e => e.date && /^\d{4}/.test(e.date));
				const eventsWithPerson = sortedEvents.filter(e => e.person);

				if (datedEvents.length === 0) {
					warnings.push('Gantt layout requires dated events. No events have parseable dates (YYYY format). Falling back to horizontal layout.');
				} else if (eventsWithPerson.length === 0) {
					warnings.push('Gantt layout works best with events linked to people. All events will appear in a single row.');
				}
			}

			// Position events based on layout style
			const positions = this.positionEvents(sortedEvents, {
				layoutStyle,
				nodeWidth,
				nodeHeight,
				spacingX,
				spacingY,
				groupByPerson
			});

			// Generate canvas nodes
			const nodes: CanvasNode[] = positions.map(pos => this.createEventNode(
				pos,
				colorScheme
			));

			// Add year marker nodes for horizontal/vertical layouts
			const yearMarkers = this.createYearMarkers(positions, {
				layoutStyle,
				nodeWidth,
				nodeHeight,
				spacingX,
				spacingY
			});
			nodes.push(...yearMarkers);

			// Generate edges
			const edges: CanvasEdge[] = [];

			// Add sequential edges between chronologically adjacent events (for horizontal/vertical)
			if (layoutStyle === 'horizontal' || layoutStyle === 'vertical') {
				for (let i = 0; i < positions.length - 1; i++) {
					edges.push(this.createSequentialEdge(positions[i], positions[i + 1], layoutStyle));
				}
			}

			// Add edges for before/after constraints
			if (includeOrderingEdges) {
				for (const pos of positions) {
					// Add edges for 'before' relationships (this event → events that come after)
					if (pos.event.before) {
						for (const beforeRef of pos.event.before) {
							const refPath = beforeRef.replace(/^\[\[/, '').replace(/\]\]$/, '');
							// Find target event by path
							const targetPos = positions.find(p =>
								p.event.filePath === refPath ||
								p.event.filePath === refPath + '.md' ||
								p.event.filePath.endsWith('/' + refPath) ||
								p.event.filePath.endsWith('/' + refPath + '.md')
							);
							if (targetPos) {
								edges.push(this.createOrderingEdge(pos, targetPos, layoutStyle));
							}
						}
					}
				}
			}

			// Create canvas data with complete metadata for regeneration
			const timelineMetadata: Record<string, unknown> = {
				type: 'timeline-export',
				exportedAt: Date.now(),
				eventCount: filteredEvents.length,
				colorScheme,
				layoutStyle,
				nodeWidth,
				nodeHeight,
				spacingX,
				spacingY,
				includeOrderingEdges,
				groupByPerson
			};

			// Store filter options for regeneration
			if (filterPerson) {
				timelineMetadata.filterPerson = filterPerson;
			}
			if (filterEventType) {
				timelineMetadata.filterEventType = filterEventType;
			}
			if (filterGroup) {
				timelineMetadata.filterGroup = filterGroup;
			}

			const canvasData: CanvasData = {
				nodes,
				edges,
				metadata: {
					version: '1.0',
					frontmatter: {
						'canvas-roots': timelineMetadata
					}
				}
			};

			// Determine file path
			const folder = this.settings.canvasesFolder || 'Charted Roots';
			const filename = `${toSafeFilename(title)}.canvas`;
			const path = `${folder}/${filename}`;

			// Write canvas file
			const result = await writeCanvasFile(this.app, path, canvasData, true);

			if (result.success) {
				logger.info('exportToCanvas', `Exported ${filteredEvents.length} events to ${result.path}`);
				return { success: true, path: result.path, warnings: warnings.length > 0 ? warnings : undefined };
			} else {
				return { success: false, error: result.error };
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error('exportToCanvas', 'Failed to export timeline', error);
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Position events based on layout style
	 */
	private positionEvents(
		events: EventNote[],
		options: {
			layoutStyle: TimelineLayoutStyle;
			nodeWidth: number;
			nodeHeight: number;
			spacingX: number;
			spacingY: number;
			groupByPerson: boolean;
		}
	): PositionedEvent[] {
		const { layoutStyle, nodeWidth, nodeHeight, spacingX, spacingY, groupByPerson } = options;

		if (layoutStyle === 'gantt') {
			return this.positionEventsGantt(events, { nodeWidth, nodeHeight, spacingX, spacingY });
		}

		if (groupByPerson) {
			return this.positionEventsGrouped(events, {
				layoutStyle,
				nodeWidth,
				nodeHeight,
				spacingX,
				spacingY
			});
		}

		// Simple linear layout
		const positions: PositionedEvent[] = [];
		const isHorizontal = layoutStyle === 'horizontal';

		for (let i = 0; i < events.length; i++) {
			const x = isHorizontal ? i * (nodeWidth + spacingX) : 0;
			const y = isHorizontal ? 0 : i * (nodeHeight + spacingY);

			positions.push({
				event: events[i],
				x,
				y,
				canvasId: generateCanvasId()
			});
		}

		return positions;
	}

	/**
	 * Position events in Gantt-style layout (horizontal by date, vertical by person)
	 */
	private positionEventsGantt(
		events: EventNote[],
		options: { nodeWidth: number; nodeHeight: number; spacingX: number; spacingY: number }
	): PositionedEvent[] {
		const { nodeHeight, spacingY } = options;
		const positions: PositionedEvent[] = [];

		// Find date range
		let minYear = Infinity;
		let maxYear = -Infinity;

		for (const event of events) {
			if (event.date) {
				const year = extractYear(event.date);
				if (year !== null) {
					minYear = Math.min(minYear, year);
					maxYear = Math.max(maxYear, year);
				}
			}
		}

		if (minYear === Infinity) {
			// No dated events, fall back to linear layout
			return this.positionEvents(events, { ...options, layoutStyle: 'horizontal', groupByPerson: false });
		}
		const pixelsPerYear = 150; // Configurable scale

		// Group events by person
		const byPerson = new Map<string, EventNote[]>();
		const noPerson: EventNote[] = [];

		for (const event of events) {
			const person = event.person?.replace(/^\[\[/, '').replace(/\]\]$/, '') || '';
			if (person) {
				if (!byPerson.has(person)) {
					byPerson.set(person, []);
				}
				byPerson.get(person)!.push(event);
			} else {
				noPerson.push(event);
			}
		}

		// Position each person's events on a row
		let rowIndex = 0;
		const personRows = [...byPerson.entries()].sort((a, b) => a[0].localeCompare(b[0]));

		for (const [, personEvents] of personRows) {
			const y = rowIndex * (nodeHeight + spacingY);

			for (const event of personEvents) {
				let x = 0;

				if (event.date) {
					const year = extractYear(event.date);
					if (year !== null) {
						const { month, day } = extractMonthDay(event.date);
						const yearFraction = (month - 1) / 12 + (day - 1) / 365;
						x = ((year - minYear) + yearFraction) * pixelsPerYear;
					}
				}

				positions.push({
					event,
					x,
					y,
					canvasId: generateCanvasId()
				});
			}

			rowIndex++;
		}

		// Position events without person on a separate row
		if (noPerson.length > 0) {
			const y = rowIndex * (nodeHeight + spacingY);

			for (const event of noPerson) {
				let x = 0;

				if (event.date) {
					const year = extractYear(event.date);
					if (year !== null) {
						x = (year - minYear) * pixelsPerYear;
					}
				}

				positions.push({
					event,
					x,
					y,
					canvasId: generateCanvasId()
				});
			}
		}

		return positions;
	}

	/**
	 * Position events grouped by person
	 */
	private positionEventsGrouped(
		events: EventNote[],
		options: {
			layoutStyle: TimelineLayoutStyle;
			nodeWidth: number;
			nodeHeight: number;
			spacingX: number;
			spacingY: number;
		}
	): PositionedEvent[] {
		const { layoutStyle, nodeWidth, nodeHeight, spacingX, spacingY } = options;
		const positions: PositionedEvent[] = [];
		const isHorizontal = layoutStyle === 'horizontal';

		// Group by person
		const byPerson = new Map<string, EventNote[]>();
		const noPerson: EventNote[] = [];

		for (const event of events) {
			const person = event.person?.replace(/^\[\[/, '').replace(/\]\]$/, '') || '';
			if (person) {
				if (!byPerson.has(person)) {
					byPerson.set(person, []);
				}
				byPerson.get(person)!.push(event);
			} else {
				noPerson.push(event);
			}
		}

		let groupOffset = 0;
		const personGroups = [...byPerson.entries()].sort((a, b) => a[0].localeCompare(b[0]));

		for (const [, personEvents] of personGroups) {
			for (let i = 0; i < personEvents.length; i++) {
				const x = isHorizontal ? i * (nodeWidth + spacingX) : groupOffset;
				const y = isHorizontal ? groupOffset : i * (nodeHeight + spacingY);

				positions.push({
					event: personEvents[i],
					x,
					y,
					canvasId: generateCanvasId()
				});
			}

			// Move to next group row/column
			groupOffset += isHorizontal
				? nodeHeight + spacingY * 2
				: nodeWidth + spacingX * 2;
		}

		// Add events without person
		if (noPerson.length > 0) {
			for (let i = 0; i < noPerson.length; i++) {
				const x = isHorizontal ? i * (nodeWidth + spacingX) : groupOffset;
				const y = isHorizontal ? groupOffset : i * (nodeHeight + spacingY);

				positions.push({
					event: noPerson[i],
					x,
					y,
					canvasId: generateCanvasId()
				});
			}
		}

		return positions;
	}

	/**
	 * Create a canvas node for an event
	 */
	private createEventNode(
		position: PositionedEvent,
		colorScheme: TimelineColorScheme
	): CanvasNode {
		const { event, x, y, canvasId } = position;

		// Get color based on scheme
		let color: string | undefined;

		switch (colorScheme) {
			case 'event_type': {
				const eventType = getEventType(
					event.eventType,
					this.settings.customEventTypes || [],
					this.settings.showBuiltInEventTypes !== false
				);
				if (eventType) {
					color = hexToCanvasColor(eventType.color);
				}
				break;
			}
			case 'category': {
				const eventType = getEventType(
					event.eventType,
					this.settings.customEventTypes || [],
					this.settings.showBuiltInEventTypes !== false
				);
				if (eventType) {
					color = categoryToCanvasColor(eventType.category);
				}
				break;
			}
			case 'confidence':
				color = confidenceToCanvasColor(event.confidence);
				break;
			case 'monochrome':
				color = undefined;
				break;
		}

		return {
			id: canvasId,
			type: 'file',
			file: event.filePath,
			x,
			y,
			width: 200,
			height: 100,
			color
		};
	}

	/**
	 * Create an edge for before/after ordering
	 */
	private createOrderingEdge(
		from: PositionedEvent,
		to: PositionedEvent,
		layoutStyle: TimelineLayoutStyle
	): CanvasEdge {
		const isHorizontal = layoutStyle === 'horizontal' || layoutStyle === 'gantt';

		return {
			id: generateCanvasId(),
			fromNode: from.canvasId,
			fromSide: isHorizontal ? 'right' : 'bottom',
			fromEnd: 'none',
			toNode: to.canvasId,
			toSide: isHorizontal ? 'left' : 'top',
			toEnd: 'arrow',
			color: '5', // Blue for ordering edges
			label: 'before'
		};
	}

	/**
	 * Create a sequential edge between chronologically adjacent events
	 */
	private createSequentialEdge(
		from: PositionedEvent,
		to: PositionedEvent,
		layoutStyle: TimelineLayoutStyle
	): CanvasEdge {
		const isHorizontal = layoutStyle === 'horizontal';

		return {
			id: generateCanvasId(),
			fromNode: from.canvasId,
			fromSide: isHorizontal ? 'right' : 'bottom',
			fromEnd: 'none',
			toNode: to.canvasId,
			toSide: isHorizontal ? 'left' : 'top',
			toEnd: 'arrow'
			// No color = default gray, no label for cleaner look
		};
	}

	/**
	 * Create year marker nodes along the timeline
	 */
	private createYearMarkers(
		positions: PositionedEvent[],
		options: {
			layoutStyle: TimelineLayoutStyle;
			nodeWidth: number;
			nodeHeight: number;
			spacingX: number;
			spacingY: number;
		}
	): CanvasNode[] {
		const { layoutStyle, nodeWidth, nodeHeight, spacingX, spacingY } = options;

		// Only add markers for horizontal/vertical layouts
		if (layoutStyle === 'gantt') return [];

		// Collect unique years from events
		const yearsWithPositions: Map<number, { minX: number; minY: number; maxX: number; maxY: number }> = new Map();

		for (const pos of positions) {
			if (!pos.event.date) continue;
			const year = extractYear(pos.event.date);
			if (year === null) continue;

			const existing = yearsWithPositions.get(year);
			if (existing) {
				existing.minX = Math.min(existing.minX, pos.x);
				existing.minY = Math.min(existing.minY, pos.y);
				existing.maxX = Math.max(existing.maxX, pos.x);
				existing.maxY = Math.max(existing.maxY, pos.y);
			} else {
				yearsWithPositions.set(year, {
					minX: pos.x,
					minY: pos.y,
					maxX: pos.x,
					maxY: pos.y
				});
			}
		}

		// Create year marker nodes
		const markers: CanvasNode[] = [];
		const markerWidth = 80;
		const markerHeight = 30;
		const isHorizontal = layoutStyle === 'horizontal';

		// Sort years and create markers
		const sortedYears = [...yearsWithPositions.entries()].sort((a, b) => a[0] - b[0]);

		for (const [year, bounds] of sortedYears) {
			// Position marker above/left of first event in that year
			const x = isHorizontal
				? bounds.minX + (nodeWidth - markerWidth) / 2  // Center above node
				: bounds.minX - markerWidth - spacingX;        // Left of nodes
			const y = isHorizontal
				? bounds.minY - markerHeight - spacingY / 2    // Above nodes
				: bounds.minY + (nodeHeight - markerHeight) / 2; // Center beside node

			markers.push({
				id: generateCanvasId(),
				type: 'text',
				text: String(year),
				x,
				y,
				width: markerWidth,
				height: markerHeight
				// No color = subtle default appearance
			});
		}

		return markers;
	}

	/**
	 * Get export summary for preview
	 */
	getExportSummary(
		events: EventNote[],
		options: TimelineCanvasOptions = {}
	): {
		totalEvents: number;
		datedEvents: number;
		undatedEvents: number;
		withOrderingConstraints: number;
		uniquePeople: number;
		uniquePlaces: number;
	} {
		const { filterPerson, filterPlace, filterEventType, filterGroup } = options;

		let filtered = events;

		if (filterPerson) {
			filtered = filtered.filter(e =>
				e.person === filterPerson ||
				e.persons?.includes(filterPerson)
			);
		}

		if (filterPlace) {
			filtered = filtered.filter(e => e.place === filterPlace);
		}

		if (filterEventType) {
			filtered = filtered.filter(e => e.eventType === filterEventType);
		}

		if (filterGroup) {
			filtered = filtered.filter(e => e.groups?.includes(filterGroup));
		}

		const people = new Set<string>();
		const places = new Set<string>();

		for (const event of filtered) {
			if (event.person) {
				people.add(event.person.replace(/^\[\[/, '').replace(/\]\]$/, ''));
			}
			if (event.persons) {
				for (const p of event.persons) {
					people.add(p.replace(/^\[\[/, '').replace(/\]\]$/, ''));
				}
			}
			if (event.place) {
				places.add(event.place.replace(/^\[\[/, '').replace(/\]\]$/, ''));
			}
		}

		return {
			totalEvents: filtered.length,
			datedEvents: filtered.filter(e => e.date).length,
			undatedEvents: filtered.filter(e => !e.date).length,
			withOrderingConstraints: filtered.filter(e =>
				(e.before && e.before.length > 0) ||
				(e.after && e.after.length > 0)
			).length,
			uniquePeople: people.size,
			uniquePlaces: places.size
		};
	}

	/**
	 * Regenerate an existing timeline canvas using its stored metadata and style overrides.
	 * Reads the canvas file, extracts stored options, and re-exports with current events.
	 */
	async regenerateCanvas(
		canvasFile: { path: string },
		events: EventNote[]
	): Promise<{ success: boolean; error?: string }> {
		try {
			// Read existing canvas to get metadata
			const file = this.app.vault.getAbstractFileByPath(canvasFile.path);
			if (!(file instanceof TFile)) {
				return { success: false, error: 'Canvas file not found' };
			}
			const canvasContent = await this.app.vault.read(file);
			const canvasData = JSON.parse(canvasContent);

			// Extract timeline metadata
			const metadata = canvasData.metadata?.frontmatter?.['canvas-roots'];
			if (!metadata || metadata.type !== 'timeline-export') {
				return { success: false, error: 'Not a timeline canvas' };
			}

			// Merge stored settings with style overrides
			const styleOverrides = metadata.styleOverrides || {};

			// Build options from metadata + style overrides (overrides take precedence)
			const options: TimelineCanvasOptions = {
				title: canvasFile.path.replace(/^.*\//, '').replace(/\.canvas$/, ''),
				colorScheme: styleOverrides.colorScheme ?? metadata.colorScheme ?? 'event_type',
				layoutStyle: styleOverrides.layoutStyle ?? metadata.layoutStyle ?? 'horizontal',
				nodeWidth: styleOverrides.nodeWidth ?? metadata.nodeWidth ?? 200,
				nodeHeight: styleOverrides.nodeHeight ?? metadata.nodeHeight ?? 100,
				spacingX: styleOverrides.spacingX ?? metadata.spacingX ?? 50,
				spacingY: styleOverrides.spacingY ?? metadata.spacingY ?? 50,
				includeOrderingEdges: styleOverrides.includeOrderingEdges ?? metadata.includeOrderingEdges ?? true,
				groupByPerson: styleOverrides.groupByPerson ?? metadata.groupByPerson ?? false,
				filterPerson: metadata.filterPerson,
				filterEventType: metadata.filterEventType,
				filterGroup: metadata.filterGroup
			};

			// Filter events if needed
			let filteredEvents = events;

			if (options.filterPerson) {
				filteredEvents = filteredEvents.filter(e =>
					e.person === options.filterPerson ||
					e.persons?.includes(options.filterPerson!)
				);
			}

			if (options.filterEventType) {
				filteredEvents = filteredEvents.filter(e => e.eventType === options.filterEventType);
			}

			if (options.filterGroup) {
				filteredEvents = filteredEvents.filter(e => e.groups?.includes(options.filterGroup!));
			}

			if (filteredEvents.length === 0) {
				return { success: false, error: 'No events to export after filtering' };
			}

			// Sort events
			const sortedEvents = sortEventsChronologically(filteredEvents);

			// Position events based on layout style
			const positions = this.positionEvents(sortedEvents, {
				layoutStyle: options.layoutStyle!,
				nodeWidth: options.nodeWidth!,
				nodeHeight: options.nodeHeight!,
				spacingX: options.spacingX!,
				spacingY: options.spacingY!,
				groupByPerson: options.groupByPerson!
			});

			// Generate canvas nodes
			const nodes: CanvasNode[] = positions.map(pos => this.createEventNode(
				pos,
				options.colorScheme!
			));

			// Generate edges for before/after constraints
			const edges: CanvasEdge[] = [];
			if (options.includeOrderingEdges) {
				for (const pos of positions) {
					if (pos.event.before) {
						for (const beforeRef of pos.event.before) {
							const refPath = beforeRef.replace(/^\[\[/, '').replace(/\]\]$/, '');
							const targetPos = positions.find(p =>
								p.event.filePath === refPath ||
								p.event.filePath === refPath + '.md' ||
								p.event.filePath.endsWith('/' + refPath) ||
								p.event.filePath.endsWith('/' + refPath + '.md')
							);
							if (targetPos) {
								edges.push(this.createOrderingEdge(pos, targetPos, options.layoutStyle!));
							}
						}
					}
				}
			}

			// Rebuild metadata preserving style overrides
			const newTimelineMetadata: Record<string, unknown> = {
				type: 'timeline-export',
				exportedAt: Date.now(),
				eventCount: filteredEvents.length,
				colorScheme: options.colorScheme,
				layoutStyle: options.layoutStyle,
				nodeWidth: options.nodeWidth,
				nodeHeight: options.nodeHeight,
				spacingX: options.spacingX,
				spacingY: options.spacingY,
				includeOrderingEdges: options.includeOrderingEdges,
				groupByPerson: options.groupByPerson
			};

			// Preserve filter options
			if (metadata.filterPerson) {
				newTimelineMetadata.filterPerson = metadata.filterPerson;
			}
			if (metadata.filterEventType) {
				newTimelineMetadata.filterEventType = metadata.filterEventType;
			}
			if (metadata.filterGroup) {
				newTimelineMetadata.filterGroup = metadata.filterGroup;
			}

			// Preserve style overrides
			if (styleOverrides && Object.keys(styleOverrides).length > 0) {
				newTimelineMetadata.styleOverrides = styleOverrides;
			}

			// Create updated canvas data
			const newCanvasData: CanvasData = {
				nodes,
				edges,
				metadata: {
					version: '1.0',
					frontmatter: {
						'canvas-roots': newTimelineMetadata
					}
				}
			};

			// Format and write back
			const formattedJson = this.formatCanvasJson(newCanvasData);
			await this.app.vault.modify(file, formattedJson);
			logger.info('regenerateCanvas', `Regenerated timeline with ${filteredEvents.length} events`);
			return { success: true };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error('regenerateCanvas', 'Failed to regenerate timeline', error);
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Format canvas JSON to match Obsidian's exact format
	 */
	private formatCanvasJson(data: CanvasData): string {
		const lines: string[] = [];
		lines.push('{');

		// Nodes
		lines.push('\t"nodes":[');
		data.nodes.forEach((node, i) => {
			const isLast = i === data.nodes.length - 1;
			const nodeStr = JSON.stringify(node);
			lines.push(`\t\t${nodeStr}${isLast ? '' : ','}`);
		});
		lines.push('\t],');

		// Edges
		lines.push('\t"edges":[');
		data.edges.forEach((edge, i) => {
			const isLast = i === data.edges.length - 1;
			const edgeStr = JSON.stringify(edge);
			lines.push(`\t\t${edgeStr}${isLast ? '' : ','}`);
		});
		lines.push('\t]');

		// Metadata (if present)
		if (data.metadata) {
			lines[lines.length - 1] = '\t],';  // Add comma after edges
			lines.push(`\t"metadata":${JSON.stringify(data.metadata)}`);
		}

		lines.push('}');
		return lines.join('\n');
	}
}
