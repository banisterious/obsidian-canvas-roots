/**
 * Per-Timeline Canvas Style Overrides
 *
 * Allows individual timeline canvases to override export settings.
 * Style overrides are stored in canvas metadata and preserved during regeneration.
 */

import type { TimelineColorScheme, TimelineLayoutStyle } from './timeline-canvas-exporter';
import type { CanvasColor } from '../../settings';

/**
 * Style settings that can be overridden on a per-timeline basis.
 * All fields are optional - undefined means "use default setting".
 */
export interface TimelineStyleOverrides {
	/**
	 * Color scheme for event nodes
	 * - 'event_type': Color by event type (birth, death, marriage, etc.)
	 * - 'category': Color by category (core/extended/narrative)
	 * - 'confidence': Color by confidence level
	 * - 'monochrome': No coloring
	 * - undefined: Use default (event_type)
	 */
	colorScheme?: TimelineColorScheme;

	/**
	 * Layout style for timeline
	 * - 'horizontal': Left to right chronological layout
	 * - 'vertical': Top to bottom chronological layout
	 * - 'gantt': Gantt chart style with date and person rows
	 * - undefined: Use default (horizontal)
	 */
	layoutStyle?: TimelineLayoutStyle;

	/**
	 * Node width in pixels
	 * - undefined: Use default (200)
	 */
	nodeWidth?: number;

	/**
	 * Node height in pixels
	 * - undefined: Use default (100)
	 */
	nodeHeight?: number;

	/**
	 * Horizontal spacing between nodes in pixels
	 * - undefined: Use default (50)
	 */
	spacingX?: number;

	/**
	 * Vertical spacing between nodes in pixels
	 * - undefined: Use default (50)
	 */
	spacingY?: number;

	/**
	 * Whether to include before/after ordering edges
	 * - true: Show edges for relative ordering constraints
	 * - false: Hide ordering edges
	 * - undefined: Use default (true)
	 */
	includeOrderingEdges?: boolean;

	/**
	 * Whether to group events by person
	 * - true: Group events into swimlanes by person
	 * - false: Single timeline
	 * - undefined: Use default (false)
	 */
	groupByPerson?: boolean;

	/**
	 * Color for ordering edges (before/after relationships)
	 * - '1' through '6': Obsidian's preset colors
	 * - 'none': No color (theme default)
	 * - undefined: Use default (none)
	 */
	orderingEdgeColor?: CanvasColor;
}

/**
 * Timeline export metadata stored in canvas
 */
export interface TimelineCanvasMetadata {
	type: 'timeline-export';
	exportedAt: number;
	eventCount: number;
	colorScheme: TimelineColorScheme;
	layoutStyle: TimelineLayoutStyle;
	/** Filter applied at export time */
	filterPerson?: string;
	filterEventType?: string;
	/** Style overrides applied to this canvas */
	styleOverrides?: TimelineStyleOverrides;
}

/**
 * Default values for timeline style settings
 */
export const TIMELINE_STYLE_DEFAULTS = {
	colorScheme: 'event_type' as TimelineColorScheme,
	layoutStyle: 'horizontal' as TimelineLayoutStyle,
	nodeWidth: 200,
	nodeHeight: 100,
	spacingX: 50,
	spacingY: 50,
	includeOrderingEdges: true,
	groupByPerson: false,
	orderingEdgeColor: 'none' as CanvasColor
};

/**
 * Merge default settings with timeline-specific overrides.
 * Returns a complete style configuration with all values defined.
 *
 * @param overrides - Timeline-specific style overrides (optional)
 * @returns Complete style configuration with all values defined
 */
export function mergeTimelineStyleSettings(
	overrides?: TimelineStyleOverrides
): {
	colorScheme: TimelineColorScheme;
	layoutStyle: TimelineLayoutStyle;
	nodeWidth: number;
	nodeHeight: number;
	spacingX: number;
	spacingY: number;
	includeOrderingEdges: boolean;
	groupByPerson: boolean;
	orderingEdgeColor: CanvasColor;
} {
	if (!overrides) {
		return { ...TIMELINE_STYLE_DEFAULTS };
	}

	return {
		colorScheme: overrides.colorScheme ?? TIMELINE_STYLE_DEFAULTS.colorScheme,
		layoutStyle: overrides.layoutStyle ?? TIMELINE_STYLE_DEFAULTS.layoutStyle,
		nodeWidth: overrides.nodeWidth ?? TIMELINE_STYLE_DEFAULTS.nodeWidth,
		nodeHeight: overrides.nodeHeight ?? TIMELINE_STYLE_DEFAULTS.nodeHeight,
		spacingX: overrides.spacingX ?? TIMELINE_STYLE_DEFAULTS.spacingX,
		spacingY: overrides.spacingY ?? TIMELINE_STYLE_DEFAULTS.spacingY,
		includeOrderingEdges: overrides.includeOrderingEdges ?? TIMELINE_STYLE_DEFAULTS.includeOrderingEdges,
		groupByPerson: overrides.groupByPerson ?? TIMELINE_STYLE_DEFAULTS.groupByPerson,
		orderingEdgeColor: overrides.orderingEdgeColor ?? TIMELINE_STYLE_DEFAULTS.orderingEdgeColor
	};
}

/**
 * Check if style overrides object has any values defined.
 * Used to determine if custom styles are applied to a timeline canvas.
 *
 * @param overrides - Style overrides to check
 * @returns True if at least one override is defined, false otherwise
 */
export function hasTimelineStyleOverrides(overrides?: TimelineStyleOverrides): boolean {
	if (!overrides) return false;

	return (
		overrides.colorScheme !== undefined ||
		overrides.layoutStyle !== undefined ||
		overrides.nodeWidth !== undefined ||
		overrides.nodeHeight !== undefined ||
		overrides.spacingX !== undefined ||
		overrides.spacingY !== undefined ||
		overrides.includeOrderingEdges !== undefined ||
		overrides.groupByPerson !== undefined ||
		overrides.orderingEdgeColor !== undefined
	);
}

/**
 * Create a default/empty TimelineStyleOverrides object.
 * Used when initializing new timeline style customization.
 *
 * @returns Empty TimelineStyleOverrides object
 */
export function createEmptyTimelineStyleOverrides(): TimelineStyleOverrides {
	return {};
}

/**
 * Clone timeline style overrides object.
 * Used when copying styles between timelines.
 *
 * @param overrides - Style overrides to clone
 * @returns Cloned TimelineStyleOverrides object
 */
export function cloneTimelineStyleOverrides(overrides?: TimelineStyleOverrides): TimelineStyleOverrides {
	if (!overrides) return {};

	return {
		colorScheme: overrides.colorScheme,
		layoutStyle: overrides.layoutStyle,
		nodeWidth: overrides.nodeWidth,
		nodeHeight: overrides.nodeHeight,
		spacingX: overrides.spacingX,
		spacingY: overrides.spacingY,
		includeOrderingEdges: overrides.includeOrderingEdges,
		groupByPerson: overrides.groupByPerson,
		orderingEdgeColor: overrides.orderingEdgeColor
	};
}
