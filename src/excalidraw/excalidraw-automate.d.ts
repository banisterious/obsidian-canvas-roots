/**
 * Type definitions for ExcalidrawAutomate API
 *
 * Based on the Obsidian Excalidraw plugin's ExcalidrawAutomate interface.
 * @see https://github.com/zsviczian/obsidian-excalidraw-plugin
 */

/**
 * Excalidraw arrowhead types
 */
export type ExcalidrawArrowhead = 'arrow' | 'bar' | 'dot' | 'triangle' | null;

/**
 * Excalidraw stroke style
 */
export type EAStrokeStyle = 'solid' | 'dashed' | 'dotted';

/**
 * Excalidraw fill style
 */
export type EAFillStyle = 'solid' | 'hachure' | 'cross-hatch';

/**
 * Excalidraw font family
 * 1=Virgil (hand-drawn), 2=Helvetica, 3=Cascadia (code),
 * 4=Comic Shanns, 5=Excalifont, 6=Nunito, 7=Lilita One
 */
export type EAFontFamily = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Element binding for arrows
 */
export interface ElementBinding {
	elementId: string;
	focus: number;
	gap: number;
}

/**
 * Options for connecting objects with arrows
 */
export interface ConnectObjectsOptions {
	/** Arrowhead at the end of the arrow */
	endArrowHead?: ExcalidrawArrowhead;
	/** Arrowhead at the start of the arrow */
	startArrowHead?: ExcalidrawArrowhead;
	/** Number of intermediate points between start and end */
	numberOfPoints?: number;
}

/**
 * Style settings for ExcalidrawAutomate
 */
export interface ExcalidrawAutomateStyle {
	strokeColor: string;
	backgroundColor: string;
	angle: number;
	fillStyle: EAFillStyle;
	strokeWidth: number;
	strokeStyle: EAStrokeStyle;
	roughness: number;
	opacity: number;
	strokeSharpness?: 'sharp' | 'round';
	fontFamily: EAFontFamily;
	fontSize: number;
	textAlign: 'left' | 'center' | 'right';
	verticalAlign: 'top' | 'middle' | 'bottom';
	startArrowHead: ExcalidrawArrowhead;
	endArrowHead: ExcalidrawArrowhead;
}

/**
 * Box parameter for addText - positions text within a container
 */
export interface TextBoxParam {
	/** Top-left X coordinate */
	topX: number;
	/** Top-left Y coordinate */
	topY: number;
	/** Box width */
	width: number;
	/** Box height */
	height: number;
}

/**
 * Excalidraw element (simplified interface)
 */
export interface ExcalidrawAutomateElement {
	id: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	groupIds: string[];
	boundElements?: { id: string; type: string }[] | null;
	strokeColor?: string;
	backgroundColor?: string;
	text?: string;
	containerId?: string | null;
	[key: string]: unknown;
}

/**
 * Result from measureText
 */
export interface TextMeasurement {
	width: number;
	height: number;
}

/**
 * ExcalidrawAutomate API interface
 *
 * This is the scripting API provided by the Obsidian Excalidraw plugin.
 * Available via `(window as any).ExcalidrawAutomate` when the plugin is active.
 */
export interface ExcalidrawAutomate {
	/**
	 * Style settings for new elements
	 */
	style: ExcalidrawAutomateStyle;

	/**
	 * Canvas to render to (null for creating new)
	 */
	canvas: { theme: string; viewBackgroundColor: string } | null;

	/**
	 * Elements added during the session
	 */
	elementsDict: Record<string, ExcalidrawAutomateElement>;

	/**
	 * Reset the state for a new drawing session
	 */
	reset(): void;

	/**
	 * Set current view to work with
	 * @param view - Excalidraw view to target (null for API-only mode)
	 */
	setView(view: unknown): void;

	/**
	 * Add a rectangle element
	 * @param topX - Top-left X coordinate
	 * @param topY - Top-left Y coordinate
	 * @param width - Rectangle width
	 * @param height - Rectangle height
	 * @returns Element ID
	 */
	addRect(topX: number, topY: number, width: number, height: number): string;

	/**
	 * Add an ellipse element
	 * @param topX - Top-left X coordinate
	 * @param topY - Top-left Y coordinate
	 * @param width - Ellipse width
	 * @param height - Ellipse height
	 * @returns Element ID
	 */
	addEllipse(topX: number, topY: number, width: number, height: number): string;

	/**
	 * Add a diamond element
	 * @param topX - Top-left X coordinate
	 * @param topY - Top-left Y coordinate
	 * @param width - Diamond width
	 * @param height - Diamond height
	 * @returns Element ID
	 */
	addDiamond(topX: number, topY: number, width: number, height: number): string;

	/**
	 * Add a text element
	 * @param topX - Top-left X coordinate
	 * @param topY - Top-left Y coordinate
	 * @param text - Text content (supports [[wiki links]])
	 * @param formatting - Optional formatting options
	 * @param formatting.wrapAt - Wrap text at character count
	 * @param formatting.width - Fixed width for text box
	 * @param formatting.height - Fixed height for text box
	 * @param formatting.textAlign - Horizontal alignment
	 * @param formatting.box - Position text within a bounding box (useful for containers)
	 * @param formatting.textVerticalAlign - Vertical alignment
	 * @param id - Optional element ID
	 * @returns Element ID
	 */
	addText(
		topX: number,
		topY: number,
		text: string,
		formatting?: {
			wrapAt?: number;
			width?: number;
			height?: number;
			textAlign?: 'left' | 'center' | 'right';
			box?: TextBoxParam | boolean;
			textVerticalAlign?: 'top' | 'middle' | 'bottom';
		},
		id?: string
	): string;

	/**
	 * Add a line element
	 * @param points - Array of [x, y] points
	 * @returns Element ID
	 */
	addLine(points: [number, number][]): string;

	/**
	 * Add an arrow element
	 * @param points - Array of [x, y] points
	 * @param formatting - Arrow formatting options
	 * @returns Element ID
	 */
	addArrow(
		points: [number, number][],
		formatting?: {
			startArrowHead?: ExcalidrawArrowhead;
			endArrowHead?: ExcalidrawArrowhead;
		}
	): string;

	/**
	 * Connect two objects with an arrow
	 * Arrows created this way automatically adapt when elements are moved.
	 *
	 * @param objectA - ID of the start object
	 * @param connectionA - Connection point on object A (null for auto)
	 * @param objectB - ID of the end object
	 * @param connectionB - Connection point on object B (null for auto)
	 * @param options - Arrow options
	 * @returns Arrow element ID
	 */
	connectObjects(
		objectA: string,
		connectionA: 'top' | 'bottom' | 'left' | 'right' | null,
		objectB: string,
		connectionB: 'top' | 'bottom' | 'left' | 'right' | null,
		options?: ConnectObjectsOptions
	): string;

	/**
	 * Add elements to a group
	 * @param ids - Array of element IDs to group
	 * @returns Group ID
	 */
	addToGroup(ids: string[]): string;

	/**
	 * Get the bounding box of elements
	 * @param elements - Array of elements
	 * @returns Bounding box with topX, topY, width, height
	 */
	getBoundingBox(elements: ExcalidrawAutomateElement[]): {
		topX: number;
		topY: number;
		width: number;
		height: number;
	};

	/**
	 * Measure text dimensions
	 * @param text - Text to measure
	 * @returns Width and height
	 */
	measureText(text: string): TextMeasurement;

	/**
	 * Get element by ID
	 * @param id - Element ID
	 * @returns Element or undefined
	 */
	getElement(id: string): ExcalidrawAutomateElement | undefined;

	/**
	 * Create the drawing (without open view)
	 * Returns JSON string of the Excalidraw data.
	 *
	 * @param options - Creation options
	 * @returns Promise<string> - JSON string of Excalidraw data
	 */
	create(options?: {
		filename?: string;
		foldername?: string;
		templatePath?: string;
		onNewPane?: boolean;
	}): Promise<string>;

	/**
	 * Add elements to the current view
	 * Requires an open Excalidraw view.
	 *
	 * @param repositionToCursor - Whether to position at cursor
	 * @param save - Whether to save after adding
	 * @param newElementsOnTop - Whether to place new elements on top
	 * @returns Promise<boolean>
	 */
	addElementsToView(
		repositionToCursor?: boolean,
		save?: boolean,
		newElementsOnTop?: boolean
	): Promise<boolean>;

	/**
	 * Create SVG from elements
	 * Requires an open Excalidraw view.
	 *
	 * @param elements - Elements to render
	 * @param options - Export options
	 * @returns Promise<SVGSVGElement>
	 */
	createSVG(
		elements?: ExcalidrawAutomateElement[],
		options?: {
			withBackground?: boolean;
			withTheme?: boolean;
		}
	): Promise<SVGSVGElement>;

	/**
	 * Create PNG from elements
	 * Requires an open Excalidraw view.
	 *
	 * @param elements - Elements to render
	 * @param scale - Export scale
	 * @param options - Export options
	 * @returns Promise<Blob>
	 */
	createPNG(
		elements?: ExcalidrawAutomateElement[],
		scale?: number,
		options?: {
			withBackground?: boolean;
			withTheme?: boolean;
		}
	): Promise<Blob>;

	/**
	 * Verify minimum plugin version
	 * @param version - Version string like "1.5.21"
	 * @returns boolean
	 */
	verifyMinimumPluginVersion(version: string): boolean;

	/**
	 * Get all elements in the scene
	 * @returns Array of elements
	 */
	getElements(): ExcalidrawAutomateElement[];

	/**
	 * Get selected elements
	 * @returns Array of selected elements
	 */
	getViewSelectedElements(): ExcalidrawAutomateElement[];

	/**
	 * Copy view elements to EA for editing
	 * @param elements - Elements to copy
	 */
	copyViewElementsToEAforEditing(elements: ExcalidrawAutomateElement[]): void;

	/**
	 * Get script settings
	 * @returns Settings object
	 */
	getScriptSettings(): Record<string, unknown>;

	/**
	 * Set script settings
	 * @param settings - Settings to save
	 */
	setScriptSettings(settings: Record<string, unknown>): void;

	/**
	 * Get Excalidraw API
	 * @returns Excalidraw API object
	 */
	getExcalidrawAPI(): {
		getSceneElements(): ExcalidrawAutomateElement[];
		getAppState(): { currentItemStrokeColor: string };
	};

	/**
	 * Get the largest element from a group
	 * @param elements - Array of elements
	 * @returns Largest element by area
	 */
	getLargestElement(elements: ExcalidrawAutomateElement[]): ExcalidrawAutomateElement;

	/**
	 * Get maximum groups from elements
	 * @param elements - Array of elements
	 * @returns Array of grouped elements
	 */
	getMaximumGroups(elements: ExcalidrawAutomateElement[]): ExcalidrawAutomateElement[][];
}

/**
 * Get ExcalidrawAutomate instance from window
 * @returns ExcalidrawAutomate instance or null if not available
 */
export function getExcalidrawAutomate(): ExcalidrawAutomate | null {
	return (window as unknown as { ExcalidrawAutomate?: ExcalidrawAutomate }).ExcalidrawAutomate ?? null;
}
