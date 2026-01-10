/**
 * Excalidraw Exporter for Charted Roots
 *
 * Converts Obsidian Canvas family trees to Excalidraw format for manual annotation and customization.
 * Supports both ExcalidrawAutomate API (when available) and fallback JSON generation.
 */

import { App, TFile, Notice } from 'obsidian';
import { getLogger } from '../core/logging';
import { getErrorMessage } from '../core/error-utils';
import type { CanvasData } from '../core/canvas-generator';
import type { CanvasNode } from '../models/canvas';
import type { ExcalidrawAutomate } from './excalidraw-automate.d';

const logger = getLogger('ExcalidrawExporter');

/**
 * Excalidraw font family options
 * 1=Virgil (hand-drawn), 2=Helvetica, 3=Cascadia (code), 4=Comic Shanns, 5=Excalifont,
 * 6=Nunito, 7=Lilita One
 */
export type ExcalidrawFontFamily = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Excalidraw fill style options
 */
export type ExcalidrawFillStyle = 'solid' | 'hachure' | 'cross-hatch';

/**
 * Excalidraw stroke style options
 */
export type ExcalidrawStrokeStyle = 'solid' | 'dashed' | 'dotted';

/**
 * Excalidraw export options
 */
export interface ExcalidrawExportOptions {
	/** Source canvas file to export */
	canvasFile: TFile;

	/** Output filename (without extension) */
	fileName?: string;

	/** Preserve colors from canvas */
	preserveColors?: boolean;

	/** Font size for labels (default: 16) */
	fontSize?: number;

	/** Stroke width for edges (default: 2) */
	strokeWidth?: number;

	/** Roughness level: 0=architect (clean), 1=artist (slightly rough), 2=cartoonist (very rough) */
	roughness?: number;

	/** Font family: 1=Virgil (hand-drawn), 2=Helvetica, 3=Cascadia (code) */
	fontFamily?: ExcalidrawFontFamily;

	/** Fill style for shapes */
	fillStyle?: ExcalidrawFillStyle;

	/** Stroke style for lines */
	strokeStyle?: ExcalidrawStrokeStyle;

	/** Background color for shapes (hex color or 'transparent') */
	shapeBackgroundColor?: string;

	/** Canvas background color (hex color) */
	viewBackgroundColor?: string;

	/** Element opacity (0-100) */
	opacity?: number;

	/** Include wiki links in text elements for navigation (default: true) */
	includeWikiLinks?: boolean;

	/** Node content level: 'name', 'name-dates', or 'name-dates-places' (default: 'name-dates-places') */
	nodeContent?: 'name' | 'name-dates' | 'name-dates-places';

	/** @deprecated Use nodeContent instead. Include dates/places in node labels (default: true) */
	includePersonDetails?: boolean;

	/** Use smart connectors that adapt when elements move (requires API, default: true) */
	useSmartConnectors?: boolean;

	/** Style spouse relationships with dashed lines (default: true) */
	styleSpouseRelationships?: boolean;

	/** Group rectangle and text elements together (default: true) */
	groupElements?: boolean;
}

/**
 * Excalidraw export result
 */
export interface ExcalidrawExportResult {
	/** Whether export succeeded */
	success: boolean;

	/** Excalidraw markdown content */
	excalidrawContent?: string;

	/** Number of elements exported */
	elementsExported: number;

	/** Error messages if any */
	errors: string[];

	/** Output filename */
	fileName: string;

	/** Whether API mode was used (vs fallback JSON) */
	usedApi: boolean;
}

/**
 * Relationship type for edge styling
 */
type RelationshipType = 'parent-child' | 'spouse' | 'unknown';

/**
 * Person details extracted from frontmatter
 */
interface PersonDetails {
	name: string;
	birthDate?: string;
	deathDate?: string;
	birthPlace?: string;
	filePath?: string;
}

/**
 * Event details extracted from frontmatter
 */
interface EventDetails {
	title: string;
	eventType?: string;
	date?: string;
	person?: string;
	filePath?: string;
}

/**
 * Excalidraw element base properties
 */
interface ExcalidrawElement {
	id: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	angle: number;
	strokeColor: string;
	backgroundColor: string;
	fillStyle: 'solid' | 'hachure' | 'cross-hatch';
	strokeWidth: number;
	strokeStyle: 'solid' | 'dashed' | 'dotted';
	roughness: number;
	opacity: number;
	groupIds: string[];
	frameId: null;
	roundness: null | { type: number };
	seed: number;
	version: number;
	versionNonce: number;
	isDeleted: boolean;
	boundElements: { id: string; type: string }[] | null;
	updated: number;
	link: null | string;
	locked: boolean;
}

/**
 * Excalidraw rectangle element
 */
interface ExcalidrawRectangle extends ExcalidrawElement {
	type: 'rectangle';
}

/**
 * Excalidraw text element
 */
interface ExcalidrawText extends ExcalidrawElement {
	type: 'text';
	text: string;
	rawText: string;
	fontSize: number;
	fontFamily: ExcalidrawFontFamily; // 1=Virgil, 2=Helvetica, 3=Cascadia, 4=Comic Shanns, 5=Excalifont, 6=Nunito, 7=Lilita One
	textAlign: 'left' | 'center' | 'right';
	verticalAlign: 'top' | 'middle';
	baseline: number;
	containerId: string | null;
	originalText: string;
	autoResize: boolean;
	lineHeight: number;
}

/**
 * Excalidraw arrow element
 */
interface ExcalidrawArrow extends ExcalidrawElement {
	type: 'arrow';
	points: [number, number][];
	lastCommittedPoint: null | [number, number];
	startBinding: {
		elementId: string;
		focus: number;
		gap: number;
	} | null;
	endBinding: {
		elementId: string;
		focus: number;
		gap: number;
	} | null;
	startArrowhead: null | 'arrow' | 'bar' | 'dot';
	endArrowhead: null | 'arrow' | 'bar' | 'dot';
	elbowed: boolean;
}

/**
 * Excalidraw file structure (Obsidian Excalidraw plugin format)
 */
interface ExcalidrawFile {
	type: 'excalidraw';
	version: number;
	source: string;
	elements: (ExcalidrawRectangle | ExcalidrawText | ExcalidrawArrow)[];
	appState: {
		gridSize: null;
		viewBackgroundColor: string;
	};
	files: Record<string, unknown>;
}

/**
 * Canvas color to Excalidraw color mapping
 */
const CANVAS_TO_EXCALIDRAW_COLORS: Record<string, string> = {
	'1': '#e03131', // red
	'2': '#f08c00', // orange
	'3': '#fab005', // yellow
	'4': '#82c91e', // green
	'5': '#4dabf7', // blue
	'6': '#be4bdb', // purple
	'none': '#1e1e1e' // default dark
};

/**
 * Export canvas to Excalidraw format
 */
export class ExcalidrawExporter {
	private app: App;
	private idCounter: number;
	private personDetailsCache: Map<string, PersonDetails>;
	private eventDetailsCache: Map<string, EventDetails>;

	constructor(app: App) {
		this.app = app;
		this.idCounter = 0;
		this.personDetailsCache = new Map();
		this.eventDetailsCache = new Map();
	}

	/**
	 * Resolve effective nodeContent from options, supporting deprecated includePersonDetails
	 */
	private resolveNodeContent(options: ExcalidrawExportOptions): 'name' | 'name-dates' | 'name-dates-places' {
		if (options.nodeContent) {
			return options.nodeContent;
		}
		// Support deprecated includePersonDetails for backward compatibility
		// Access via bracket notation to avoid deprecation warning
		const legacyOption = (options as unknown as Record<string, unknown>)['includePersonDetails'];
		if (legacyOption === false) {
			return 'name';
		}
		return 'name-dates-places';
	}

	/**
	 * Check if ExcalidrawAutomate API is available
	 */
	private getExcalidrawAutomate(): ExcalidrawAutomate | null {
		const ea = (window as unknown as { ExcalidrawAutomate?: ExcalidrawAutomate }).ExcalidrawAutomate;
		if (ea && typeof ea.addRect === 'function') {
			logger.info('export', 'ExcalidrawAutomate API detected');
			return ea;
		}
		logger.info('export', 'ExcalidrawAutomate API not available, using JSON fallback');
		return null;
	}

	/**
	 * Export canvas file to Excalidraw format
	 * Automatically uses ExcalidrawAutomate API if available, otherwise falls back to JSON generation.
	 */
	async exportToExcalidraw(options: ExcalidrawExportOptions): Promise<ExcalidrawExportResult> {
		const result: ExcalidrawExportResult = {
			success: false,
			elementsExported: 0,
			errors: [],
			fileName: options.fileName || options.canvasFile.basename,
			usedApi: false
		};

		try {
			new Notice('Reading canvas file...');

			// Read canvas JSON
			const canvasContent = await this.app.vault.read(options.canvasFile);
			const canvasData: CanvasData = JSON.parse(canvasContent);

			logger.info('export', `Loaded canvas with ${canvasData.nodes.length} nodes and ${canvasData.edges.length} edges`);

			// Pre-load person and event details for all nodes (for rich content)
			const nodeContent = this.resolveNodeContent(options);
			if (nodeContent !== 'name') {
				this.loadPersonDetails(canvasData.nodes);
			}
			// Always load event details for timeline exports
			this.loadEventDetails(canvasData.nodes);

			// Check for ExcalidrawAutomate API
			const ea = this.getExcalidrawAutomate();

			let excalidrawData: ExcalidrawFile;
			if (ea) {
				// Use API mode for enhanced features
				new Notice('Converting with ExcalidrawAutomate API...');
				excalidrawData = this.convertWithApi(ea, canvasData, options);
				result.usedApi = true;
			} else {
				// Fallback to JSON generation
				new Notice('Converting to Excalidraw format...');
				excalidrawData = this.convertCanvasToExcalidraw(canvasData, options);
			}

			logger.info('export', `Converted to ${excalidrawData.elements.length} Excalidraw elements (API: ${result.usedApi})`);

			// Build Excalidraw markdown content (Obsidian Excalidraw plugin format)
			logger.info('export', 'Building Excalidraw markdown...');
			const excalidrawMarkdown = this.buildExcalidrawMarkdown(excalidrawData);

			logger.info('export', `Generated markdown with ${excalidrawMarkdown.length} characters`);

			result.excalidrawContent = excalidrawMarkdown;
			result.elementsExported = excalidrawData.elements.length;
			result.success = true;

			const modeLabel = result.usedApi ? ' (with smart connectors)' : '';
			logger.info('export', `Export completed successfully${modeLabel}`);
			new Notice(`Export complete: ${result.elementsExported} elements exported${modeLabel}`);

		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			const errorStack = error instanceof Error ? error.stack : '';
			result.errors.push(`Export failed: ${errorMsg}`);
			logger.error('export', 'Export failed', { error: errorMsg, stack: errorStack });
			new Notice(`Export failed: ${errorMsg}`);
		}

		// Clear caches
		this.personDetailsCache.clear();
		this.eventDetailsCache.clear();

		return result;
	}

	/**
	 * Load person details from frontmatter for all file nodes
	 */
	private loadPersonDetails(nodes: CanvasNode[]): void {
		for (const node of nodes) {
			if (node.type === 'file' && node.file) {
				const details = this.extractPersonDetails(node.file);
				if (details) {
					this.personDetailsCache.set(node.id, details);
				}
			}
		}
		logger.info('export', `Loaded person details for ${this.personDetailsCache.size} nodes`);
	}

	/**
	 * Extract person details from file frontmatter
	 */
	private extractPersonDetails(filePath: string): PersonDetails | null {
		try {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof TFile)) return null;

			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) return null;

			const fm = cache.frontmatter;

			// Extract name (try various common frontmatter fields)
			const name = fm.name || fm.full_name || fm.fullname ||
				file.basename;

			// Extract dates
			const birthDate = fm.birth_date || fm.birthDate || fm.born || fm.dob;
			const deathDate = fm.death_date || fm.deathDate || fm.died || fm.dod;

			// Extract place
			const birthPlace = fm.birth_place || fm.birthPlace || fm.birthplace;

			return {
				name,
				birthDate: this.formatDate(birthDate),
				deathDate: this.formatDate(deathDate),
				birthPlace,
				filePath
			};
		} catch (error) {
			logger.warn('export', `Failed to extract person details from ${filePath}`, error);
			return null;
		}
	}

	/**
	 * Format date for display
	 */
	private formatDate(date: unknown): string | undefined {
		if (!date) return undefined;
		if (typeof date === 'string') return date;
		if (typeof date === 'number') return String(date);
		if (date instanceof Date) return date.toLocaleDateString();
		// For objects with toString, try to get a meaningful string
		if (typeof date === 'object' && date !== null && 'toString' in date) {
			const str = (date as { toString: () => string }).toString();
			// Only use if it's not the default "[object Object]"
			if (!str.startsWith('[object ')) return str;
		}
		return undefined;
	}

	/**
	 * Load event details from frontmatter for all file nodes
	 */
	private loadEventDetails(nodes: CanvasNode[]): void {
		let fileNodes = 0;
		let textNodes = 0;
		for (const node of nodes) {
			if (node.type === 'file' && node.file) {
				fileNodes++;
				const details = this.extractEventDetails(node.file);
				if (details) {
					this.eventDetailsCache.set(node.id, details);
					logger.info('export', `Loaded event: ${details.title} (${details.eventType}) from ${node.file}`);
				} else {
					logger.info('export', `No event details for file node: ${node.file}`);
				}
			} else if (node.type === 'text') {
				textNodes++;
			}
		}
		logger.info('export', `Event loading summary: ${this.eventDetailsCache.size} events from ${fileNodes} file nodes, ${textNodes} text nodes`);
	}

	/**
	 * Extract event details from file frontmatter
	 */
	private extractEventDetails(filePath: string): EventDetails | null {
		try {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof TFile)) {
				logger.info('export', `extractEventDetails: File not found in vault: ${filePath}`);
				return null;
			}

			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) {
				logger.info('export', `extractEventDetails: No frontmatter cache for: ${filePath}`);
				return null;
			}

			const fm = cache.frontmatter;
			const fmKeys = Object.keys(fm);
			logger.info('export', `extractEventDetails: ${filePath} has keys: ${fmKeys.join(', ')}`);

			// Check if this is an event note - look for cr_type: event OR event_type field
			const isEvent = fm.cr_type === 'event' || fm.event_type || fm.eventType;
			if (!isEvent) {
				logger.info('export', `extractEventDetails: Not an event (cr_type=${fm.cr_type}, event_type=${fm.event_type})`);
				return null;
			}

			// Extract title - use frontmatter title or file basename
			const title = fm.title || file.basename;

			// Extract event type - try multiple property names
			const eventType = fm.event_type || fm.eventType || fm.type || 'event';

			// Extract date
			const date = fm.date;

			// Extract person - check both 'person' and 'persons' fields
			let person = fm.person;
			if (!person && fm.persons && Array.isArray(fm.persons) && fm.persons.length > 0) {
				person = fm.persons[0]; // Use first person from array
			}

			return {
				title,
				eventType,
				date: this.formatDate(date),
				person,
				filePath
			};
		} catch (error) {
			logger.warn('export', `Failed to extract event details from ${filePath}`, error);
			return null;
		}
	}

	/**
	 * Get formatted label for event node
	 */
	private getEventLabel(eventDetails: EventDetails): string {
		const lines: string[] = [];

		// Format: "Birth of Person" or just the title
		if (eventDetails.eventType) {
			const typeLabel = eventDetails.eventType.charAt(0).toUpperCase() +
				eventDetails.eventType.slice(1);
			if (eventDetails.person) {
				// Extract name from wikilink if present
				const personName = eventDetails.person
					.replace(/^\[\[/, '')
					.replace(/\]\]$/, '')
					.split('|').pop() || eventDetails.person;
				lines.push(`${typeLabel} of ${personName}`);
			} else {
				lines.push(typeLabel);
			}
		} else {
			lines.push(eventDetails.title);
		}

		// Add date if available
		if (eventDetails.date) {
			lines.push(eventDetails.date);
		}

		return lines.join('\n');
	}

	/**
	 * Determine relationship type from edge
	 */
	private getRelationshipType(edge: {
		fromSide?: string;
		toSide?: string;
		label?: string;
	}): RelationshipType {
		// Check edge label for relationship hints
		const label = edge.label?.toLowerCase() || '';
		if (label.includes('spouse') || label.includes('married') || label.includes('partner')) {
			return 'spouse';
		}
		if (label.includes('child') || label.includes('parent') || label.includes('son') || label.includes('daughter')) {
			return 'parent-child';
		}

		// Check edge sides - spouse relationships often connect from side to side
		const fromSide = edge.fromSide || '';
		const toSide = edge.toSide || '';

		logger.debug('export', `Edge relationship detection: fromSide=${fromSide}, toSide=${toSide}, label=${label}`);

		if ((fromSide === 'left' || fromSide === 'right') && (toSide === 'left' || toSide === 'right')) {
			logger.debug('export', 'Detected spouse relationship (side-to-side)');
			return 'spouse';
		}
		// Parent-child typically goes top-to-bottom
		if ((fromSide === 'bottom' && toSide === 'top') || (fromSide === 'top' && toSide === 'bottom')) {
			return 'parent-child';
		}

		return 'unknown';
	}

	/**
	 * Strip wiki link syntax from a string
	 * Converts [[Link]] or [[Link|Display]] to just the display text
	 */
	private stripWikiLinks(text: string): string {
		if (!text) return text;
		// Handle [[Link|Display]] format - use Display
		// Handle [[Link]] format - use Link
		return text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
			.replace(/\[\[([^\]]+)\]\]/g, '$1');
	}

	/**
	 * Build rich label for node including dates and places
	 * Note: Wiki links are handled via the element's `link` property, not inline [[]] syntax
	 * @param node - Canvas node to build label for
	 * @param contentLevel - 'name', 'name-dates', or 'name-dates-places'
	 */
	private buildRichLabel(node: CanvasNode, contentLevel: 'name' | 'name-dates' | 'name-dates-places' = 'name-dates-places'): string {
		const details = this.personDetailsCache.get(node.id);

		if (!details) {
			// Fall back to simple label
			return this.extractNodeLabel(node);
		}

		const lines: string[] = [];

		// Name (wiki link is set separately via element's link property)
		// Strip any wiki link syntax from the name
		lines.push(this.stripWikiLinks(details.name));

		// Date line (only for name-dates or name-dates-places)
		if (contentLevel !== 'name' && (details.birthDate || details.deathDate)) {
			const birth = this.stripWikiLinks(details.birthDate || '?');
			const death = this.stripWikiLinks(details.deathDate || '');
			if (death) {
				lines.push(`${birth} – ${death}`);
			} else {
				lines.push(`b. ${birth}`);
			}
		}

		// Place (only for name-dates-places) - strip wiki links
		if (contentLevel === 'name-dates-places' && details.birthPlace) {
			lines.push(this.stripWikiLinks(details.birthPlace));
		}

		return lines.join('\n');
	}

	/**
	 * Get wiki link path for a node (for element's link property)
	 */
	private getWikiLinkPath(node: CanvasNode): string | null {
		if (node.type === 'file' && node.file) {
			// Return the file path without extension for wiki link format
			return node.file.replace(/\.(md|markdown)$/, '');
		}
		return null;
	}

	/**
	 * Convert Canvas data to Excalidraw format using ExcalidrawAutomate API
	 * This method provides enhanced features: smart connectors, wiki links, grouping
	 */
	private convertWithApi(
		ea: ExcalidrawAutomate,
		canvasData: CanvasData,
		options: ExcalidrawExportOptions
	): ExcalidrawFile {
		// Reset EA state
		ea.reset();
		ea.setView(null); // API-only mode, no open view required

		const nodeIdMap = new Map<string, string>(); // Canvas ID -> Excalidraw ID

		// Extract options with defaults
		const fontSize = options.fontSize ?? 16;
		const strokeWidth = options.strokeWidth ?? 2;
		const preserveColors = options.preserveColors ?? true;
		const roughness = options.roughness ?? 1;
		const fontFamily = options.fontFamily ?? 1;
		const fillStyle = options.fillStyle ?? 'solid';
		const strokeStyle = options.strokeStyle ?? 'solid';
		const shapeBackgroundColor = options.shapeBackgroundColor ?? 'transparent';
		const viewBackgroundColor = options.viewBackgroundColor ?? '#ffffff';
		const opacity = options.opacity ?? 100;
		const includeWikiLinks = options.includeWikiLinks !== false;
		const nodeContent = this.resolveNodeContent(options);
		const useSmartConnectors = options.useSmartConnectors !== false;
		const styleSpouseRelationships = options.styleSpouseRelationships !== false;
		const groupElements = options.groupElements !== false;

		// Calculate bounds to normalize coordinates
		let minX = Infinity;
		let minY = Infinity;
		for (const node of canvasData.nodes) {
			minX = Math.min(minX, node.x);
			minY = Math.min(minY, node.y);
		}

		const padding = 50;
		const offsetX = -minX + padding;
		const offsetY = -minY + padding;

		// Set EA styles
		ea.style.strokeWidth = strokeWidth;
		ea.style.roughness = roughness;
		ea.style.fillStyle = fillStyle as 'solid' | 'hachure' | 'cross-hatch';
		ea.style.strokeStyle = strokeStyle as 'solid' | 'dashed' | 'dotted';
		ea.style.opacity = opacity;
		ea.style.fontFamily = fontFamily;
		ea.style.fontSize = fontSize;

		// Log cache keys and node IDs for debugging
		const cacheKeys = Array.from(this.eventDetailsCache.keys());
		const nodeIds = canvasData.nodes.slice(0, 5).map(n => n.id);
		logger.info('export', `convertWithApi: eventCache keys (first 5): ${cacheKeys.slice(0, 5).join(', ')}`);
		logger.info('export', `convertWithApi: node IDs (first 5): ${nodeIds.join(', ')}`);

		// Convert nodes
		for (const node of canvasData.nodes) {
			const rectColor = preserveColors && node.color
				? CANVAS_TO_EXCALIDRAW_COLORS[node.color] || CANVAS_TO_EXCALIDRAW_COLORS['none']
				: CANVAS_TO_EXCALIDRAW_COLORS['none'];

			ea.style.strokeColor = rectColor;
			ea.style.backgroundColor = shapeBackgroundColor;

			// Create rectangle
			const rectId = ea.addRect(
				node.x + offsetX,
				node.y + offsetY,
				node.width,
				node.height
			);
			nodeIdMap.set(node.id, rectId);

			// Set wiki link on the rectangle element if enabled
			if (includeWikiLinks) {
				const linkPath = this.getWikiLinkPath(node);
				if (linkPath) {
					const rectElement = ea.getElement(rectId);
					if (rectElement) {
						rectElement.link = `[[${linkPath}]]`;
					}
				}
			}

			// Create text label - check event cache first (for timeline exports), then person cache
			let labelText: string;
			if (this.eventDetailsCache.has(node.id)) {
				// Event node - use event label
				labelText = this.extractNodeLabel(node);
			} else if (nodeContent !== 'name' && this.personDetailsCache.has(node.id)) {
				// Person node with rich content
				labelText = this.buildRichLabel(node, nodeContent);
			} else {
				// Fallback to simple label
				labelText = this.extractNodeLabel(node);
			}

			if (labelText) {
				// ExcalidrawAutomate API style object - not DOM styles
				Object.assign(ea.style, {
					strokeColor: '#1e1e1e', // Text always dark
					textAlign: 'center',
					verticalAlign: 'middle'
				});

				// Calculate wrap width based on node width and font size
				// Virgil font is roughly 0.6 * fontSize per character
				const charsPerLine = Math.floor(node.width / (fontSize * 0.6));
				const wrapAt = Math.max(15, charsPerLine); // Minimum 15 chars

				// Estimate text dimensions for centering
				// Split by existing newlines and apply wrapping
				const rawLines = labelText.split('\n');
				const wrappedLines: string[] = [];
				for (const line of rawLines) {
					if (line.length <= wrapAt) {
						wrappedLines.push(line);
					} else {
						// Simple word wrap
						const words = line.split(' ');
						let currentLine = '';
						for (const word of words) {
							if (currentLine.length + word.length + 1 <= wrapAt) {
								currentLine += (currentLine ? ' ' : '') + word;
							} else {
								if (currentLine) wrappedLines.push(currentLine);
								currentLine = word;
							}
						}
						if (currentLine) wrappedLines.push(currentLine);
					}
				}

				const lineCount = wrappedLines.length;
				const maxLineLength = Math.max(...wrappedLines.map(l => l.length));
				const charWidth = fontSize * 0.55; // Virgil font character width estimate
				const lineHeight = fontSize * 1.25;
				const textWidth = maxLineLength * charWidth;
				const textHeight = lineCount * lineHeight;

				// Calculate top-left position to center text in rectangle
				const textX = node.x + offsetX + (node.width - textWidth) / 2;
				const textY = node.y + offsetY + (node.height - textHeight) / 2;

				// Add text at calculated position
				const textId = ea.addText(
					textX,
					textY,
					labelText,
					{
						textAlign: 'center',
						textVerticalAlign: 'middle',
						wrapAt
					}
				);

				// Group rectangle and text if enabled
				if (groupElements) {
					ea.addToGroup([rectId, textId]);
				}
			}
		}

		// Convert edges
		for (const edge of canvasData.edges) {
			const fromExcalidrawId = nodeIdMap.get(edge.fromNode);
			const toExcalidrawId = nodeIdMap.get(edge.toNode);

			if (!fromExcalidrawId || !toExcalidrawId) {
				logger.warn('export', `Skipping edge with missing node: ${edge.id}`);
				continue;
			}

			const edgeColor = preserveColors && edge.color
				? CANVAS_TO_EXCALIDRAW_COLORS[edge.color] || CANVAS_TO_EXCALIDRAW_COLORS['none']
				: CANVAS_TO_EXCALIDRAW_COLORS['none'];

			// Determine relationship type for styling (spouse edges = side-to-side, parent-child = top-to-bottom)
			const relType = this.getRelationshipType(edge);
			const isSpouse = relType === 'spouse' && styleSpouseRelationships;

			ea.style.strokeColor = edgeColor;
			ea.style.strokeStyle = isSpouse ? 'dashed' : strokeStyle as 'solid' | 'dashed' | 'dotted';
			ea.style.strokeWidth = strokeWidth;

			if (useSmartConnectors) {
				// Use connectObjects for smart, adaptive arrows
				ea.connectObjects(
					fromExcalidrawId,
					null, // auto-detect connection point
					toExcalidrawId,
					null, // auto-detect connection point
					{
						endArrowHead: 'arrow',
						startArrowHead: null,
						numberOfPoints: 1
					}
				);
			} else {
				// Fall back to manual arrow creation (handled in JSON mode)
				// For now, still use connectObjects but it's logged as non-smart
				ea.connectObjects(
					fromExcalidrawId,
					null,
					toExcalidrawId,
					null,
					{
						endArrowHead: 'arrow',
						startArrowHead: null,
						numberOfPoints: 1
					}
				);
			}
		}

		// Get elements from EA
		const elements = Object.values(ea.elementsDict) as unknown as (ExcalidrawRectangle | ExcalidrawText | ExcalidrawArrow)[];

		return {
			type: 'excalidraw',
			version: 2,
			source: 'https://github.com/banisterious/obsidian-charted-roots',
			elements,
			appState: {
				gridSize: null,
				viewBackgroundColor
			},
			files: {}
		};
	}

	/**
	 * Convert Canvas data to Excalidraw format (JSON fallback mode)
	 * This method is used when ExcalidrawAutomate API is not available.
	 * Supports rich content, wiki links, relationship styling, and grouping.
	 */
	private convertCanvasToExcalidraw(
		canvasData: CanvasData,
		options: ExcalidrawExportOptions
	): ExcalidrawFile {
		const elements: (ExcalidrawRectangle | ExcalidrawText | ExcalidrawArrow)[] = [];
		const nodeIdMap = new Map<string, string>(); // Canvas ID -> Excalidraw ID
		const textIdMap = new Map<string, string>(); // Canvas ID -> Text element ID (for grouping)

		// Extract options with defaults
		const fontSize = options.fontSize ?? 16;
		const strokeWidth = options.strokeWidth ?? 2;
		const preserveColors = options.preserveColors ?? true;
		const roughness = options.roughness ?? 1;
		const fontFamily = options.fontFamily ?? 1;
		const fillStyle = options.fillStyle ?? 'solid';
		const strokeStyle = options.strokeStyle ?? 'solid';
		const shapeBackgroundColor = options.shapeBackgroundColor ?? 'transparent';
		const viewBackgroundColor = options.viewBackgroundColor ?? '#ffffff';
		const opacity = options.opacity ?? 100;
		const includeWikiLinks = options.includeWikiLinks !== false;
		const nodeContent = this.resolveNodeContent(options);
		const styleSpouseRelationships = options.styleSpouseRelationships !== false;
		const groupElements = options.groupElements !== false;

		// Calculate bounds to normalize coordinates
		let minX = Infinity;
		let minY = Infinity;
		for (const node of canvasData.nodes) {
			minX = Math.min(minX, node.x);
			minY = Math.min(minY, node.y);
		}

		// Add padding so elements aren't right at edge
		const padding = 50;
		const offsetX = -minX + padding;
		const offsetY = -minY + padding;

		logger.info('export', `Coordinate offset: (${offsetX}, ${offsetY}) from bounds (${minX}, ${minY})`);

		// Log cache keys and node IDs for debugging
		const cacheKeys = Array.from(this.eventDetailsCache.keys());
		const nodeIds = canvasData.nodes.slice(0, 5).map(n => n.id);
		logger.info('export', `convertCanvas: eventCache keys (first 5): ${cacheKeys.slice(0, 5).join(', ')}`);
		logger.info('export', `convertCanvas: node IDs (first 5): ${nodeIds.join(', ')}`);

		// Generate group IDs for grouped elements
		const groupIdMap = new Map<string, string>();
		if (groupElements) {
			for (const node of canvasData.nodes) {
				groupIdMap.set(node.id, this.generateId());
			}
		}

		// Convert nodes
		for (const node of canvasData.nodes) {
			const excalidrawId = this.generateId();
			nodeIdMap.set(node.id, excalidrawId);

			// Create rectangle for node (with coordinate offset applied)
			const rectColor = preserveColors && node.color
				? CANVAS_TO_EXCALIDRAW_COLORS[node.color] || CANVAS_TO_EXCALIDRAW_COLORS['none']
				: CANVAS_TO_EXCALIDRAW_COLORS['none'];

			const groupId = groupIdMap.get(node.id);

			// Get wiki link path if enabled
			const linkPath = includeWikiLinks ? this.getWikiLinkPath(node) : null;

			const rectangle = this.createRectangle(
				excalidrawId,
				node.x + offsetX,
				node.y + offsetY,
				node.width,
				node.height,
				rectColor,
				{
					roughness,
					fillStyle,
					strokeStyle,
					strokeWidth,
					backgroundColor: shapeBackgroundColor,
					opacity,
					groupIds: groupId ? [groupId] : [],
					link: linkPath ? `[[${linkPath}]]` : undefined
				}
			);
			elements.push(rectangle);

			// Create text label - check event cache first (for timeline exports), then person cache
			// Wiki links are on the rectangle, not in text
			let labelText: string;
			if (this.eventDetailsCache.has(node.id)) {
				// Event node - use event label
				labelText = this.extractNodeLabel(node);
			} else if (nodeContent !== 'name' && this.personDetailsCache.has(node.id)) {
				// Person node with rich content
				labelText = this.buildRichLabel(node, nodeContent);
			} else {
				// Fallback to simple label
				labelText = this.extractNodeLabel(node);
			}

			if (labelText) {
				const textId = this.generateId();
				textIdMap.set(node.id, textId);
				const textElement = this.createText(
					textId,
					node.x + offsetX,
					node.y + offsetY,
					labelText,
					fontSize,
					excalidrawId, // container ID
					{
						fontFamily,
						opacity,
						groupIds: groupId ? [groupId] : [],
						containerWidth: node.width,
						containerHeight: node.height
					}
				);
				elements.push(textElement);
			}
		}

		// Convert edges
		for (const edge of canvasData.edges) {
			const fromExcalidrawId = nodeIdMap.get(edge.fromNode);
			const toExcalidrawId = nodeIdMap.get(edge.toNode);

			if (!fromExcalidrawId || !toExcalidrawId) {
				logger.warn('export', `Skipping edge with missing node: ${edge.id}`);
				continue;
			}

			// Get source and target node positions
			const fromNode = canvasData.nodes.find(n => n.id === edge.fromNode);
			const toNode = canvasData.nodes.find(n => n.id === edge.toNode);

			if (!fromNode || !toNode) continue;

			const edgeColor = preserveColors && edge.color
				? CANVAS_TO_EXCALIDRAW_COLORS[edge.color] || CANVAS_TO_EXCALIDRAW_COLORS['none']
				: CANVAS_TO_EXCALIDRAW_COLORS['none'];

			// Determine relationship type for styling
			const relType = this.getRelationshipType(edge);
			const isSpouse = relType === 'spouse' && styleSpouseRelationships;
			const edgeStrokeStyle = isSpouse ? 'dashed' : strokeStyle;

			const arrow = this.createArrow(
				this.generateId(),
				fromNode,
				toNode,
				fromExcalidrawId,
				toExcalidrawId,
				edgeColor,
				strokeWidth,
				offsetX,
				offsetY,
				edge.label,
				{
					roughness,
					strokeStyle: edgeStrokeStyle,
					opacity
				}
			);
			elements.push(arrow);
		}

		return {
			type: 'excalidraw',
			version: 2,
			source: 'https://github.com/banisterious/obsidian-charted-roots',
			elements,
			appState: {
				gridSize: null,
				viewBackgroundColor
			},
			files: {}
		};
	}

	/**
	 * Create Excalidraw rectangle element
	 */
	private createRectangle(
		id: string,
		x: number,
		y: number,
		width: number,
		height: number,
		color: string,
		styleOptions?: {
			roughness?: number;
			fillStyle?: ExcalidrawFillStyle;
			strokeStyle?: ExcalidrawStrokeStyle;
			strokeWidth?: number;
			backgroundColor?: string;
			opacity?: number;
			groupIds?: string[];
			link?: string;
		}
	): ExcalidrawRectangle {
		return {
			id,
			type: 'rectangle',
			x,
			y,
			width,
			height,
			angle: 0,
			strokeColor: color,
			backgroundColor: styleOptions?.backgroundColor ?? 'transparent',
			fillStyle: styleOptions?.fillStyle ?? 'solid',
			strokeWidth: styleOptions?.strokeWidth ?? 2,
			strokeStyle: styleOptions?.strokeStyle ?? 'solid',
			roughness: styleOptions?.roughness ?? 1,
			opacity: styleOptions?.opacity ?? 100,
			groupIds: styleOptions?.groupIds ?? [],
			frameId: null,
			roundness: { type: 3 },
			seed: this.generateSeed(),
			version: 1,
			versionNonce: this.generateSeed(),
			isDeleted: false,
			boundElements: null,
			updated: Date.now(),
			link: styleOptions?.link ?? null,
			locked: false
		};
	}

	/**
	 * Create Excalidraw text element
	 */
	private createText(
		id: string,
		x: number,
		y: number,
		text: string,
		fontSize: number,
		containerId: string | null = null,
		styleOptions?: {
			fontFamily?: ExcalidrawFontFamily;
			opacity?: number;
			groupIds?: string[];
			containerWidth?: number;
			containerHeight?: number;
		}
	): ExcalidrawText {
		// Handle multi-line text for rich labels
		const lines = text.split('\n');
		const maxLineLength = Math.max(...lines.map(l => l.length));

		// Estimate text dimensions based on font size
		// Virgil (hand-drawn) font is quite wide - measured at approximately 0.6 per character
		// Line height in Excalidraw is fontSize * lineHeight property (default 1.25)
		const charWidthMultiplier = 0.6;
		const lineHeightMultiplier = 1.25;

		// Calculate actual rendered dimensions
		const estimatedTextWidth = maxLineLength * fontSize * charWidthMultiplier;
		const estimatedTextHeight = lines.length * fontSize * lineHeightMultiplier;

		// Calculate text position
		let textX: number;
		let textY: number;
		let textWidth: number;
		let textHeight: number;

		if (styleOptions?.containerWidth && styleOptions?.containerHeight) {
			// Center text within the container
			// x,y are the container's top-left corner
			textWidth = estimatedTextWidth;
			textHeight = estimatedTextHeight;

			// Center horizontally and vertically within container
			// containerWidth/Height are the rectangle dimensions
			// We position the text so its center aligns with the rectangle's center
			const containerCenterX = x + styleOptions.containerWidth / 2;
			const containerCenterY = y + styleOptions.containerHeight / 2;
			textX = containerCenterX - textWidth / 2;
			textY = containerCenterY - textHeight / 2;

			logger.debug('export', `Text positioning: text="${text.substring(0, 20)}...", fontSize=${fontSize}, ` +
				`maxLineLen=${maxLineLength}, lines=${lines.length}, ` +
				`estWidth=${textWidth.toFixed(1)}, estHeight=${textHeight.toFixed(1)}, ` +
				`container=${styleOptions.containerWidth}x${styleOptions.containerHeight}, ` +
				`pos=(${textX.toFixed(1)}, ${textY.toFixed(1)})`);
		} else {
			// Legacy behavior: x,y is the desired center point
			textWidth = estimatedTextWidth;
			textHeight = estimatedTextHeight;
			textX = x - textWidth / 2;
			textY = y - textHeight / 2;
		}

		return {
			id,
			type: 'text',
			x: textX,
			y: textY,
			width: textWidth,
			height: textHeight,
			angle: 0,
			strokeColor: '#1e1e1e',
			backgroundColor: 'transparent',
			fillStyle: 'solid',
			strokeWidth: 2,
			strokeStyle: 'solid',
			roughness: 0, // Text should always be clean
			opacity: styleOptions?.opacity ?? 100,
			groupIds: styleOptions?.groupIds ?? [],
			frameId: null,
			roundness: null,
			seed: this.generateSeed(),
			version: 1,
			versionNonce: this.generateSeed(),
			isDeleted: false,
			boundElements: null,
			updated: Date.now(),
			link: null,
			locked: false,
			text,
			rawText: text,
			fontSize,
			fontFamily: styleOptions?.fontFamily ?? 1, // Default to Virgil (hand-drawn style)
			textAlign: 'center',
			verticalAlign: 'middle',
			baseline: fontSize,
			containerId,
			originalText: text,
			autoResize: true,
			lineHeight: 1.25
		};
	}

	/**
	 * Create Excalidraw arrow element
	 */
	private createArrow(
		id: string,
		fromNode: CanvasNode,
		toNode: CanvasNode,
		fromExcalidrawId: string,
		toExcalidrawId: string,
		color: string,
		strokeWidth: number,
		offsetX: number,
		offsetY: number,
		label?: string,
		styleOptions?: {
			roughness?: number;
			strokeStyle?: ExcalidrawStrokeStyle;
			opacity?: number;
		}
	): ExcalidrawArrow {
		// Calculate arrow start and end points (with coordinate offset applied)
		const startX = fromNode.x + offsetX + fromNode.width / 2;
		const startY = fromNode.y + offsetY + fromNode.height / 2;
		const endX = toNode.x + offsetX + toNode.width / 2;
		const endY = toNode.y + offsetY + toNode.height / 2;

		// Arrow points are relative to start position
		const points: [number, number][] = [
			[0, 0],
			[endX - startX, endY - startY]
		];

		return {
			id,
			type: 'arrow',
			x: startX,
			y: startY,
			width: Math.abs(endX - startX),
			height: Math.abs(endY - startY),
			angle: 0,
			strokeColor: color,
			backgroundColor: 'transparent',
			fillStyle: 'solid',
			strokeWidth,
			strokeStyle: styleOptions?.strokeStyle ?? 'solid',
			roughness: styleOptions?.roughness ?? 1,
			opacity: styleOptions?.opacity ?? 100,
			groupIds: [],
			frameId: null,
			roundness: { type: 2 },
			seed: this.generateSeed(),
			version: 1,
			versionNonce: this.generateSeed(),
			isDeleted: false,
			boundElements: null,
			updated: Date.now(),
			link: null,
			locked: false,
			points,
			lastCommittedPoint: null,
			startBinding: {
				elementId: fromExcalidrawId,
				focus: 0,
				gap: 10
			},
			endBinding: {
				elementId: toExcalidrawId,
				focus: 0,
				gap: 10
			},
			startArrowhead: null,
			endArrowhead: 'arrow',
			elbowed: false
		};
	}

	/**
	 * Extract label text from canvas node
	 */
	private extractNodeLabel(node: CanvasNode): string {
		// Check if this is an event node with cached details
		const eventDetails = this.eventDetailsCache.get(node.id);
		logger.info('export', `extractNodeLabel: node.id=${node.id}, hasEventDetails=${!!eventDetails}, cacheSize=${this.eventDetailsCache.size}`);
		if (eventDetails) {
			const label = this.getEventLabel(eventDetails);
			logger.info('export', `extractNodeLabel: Using event label: ${label}`);
			return label;
		}

		if (node.type === 'file' && node.file) {
			// Extract filename without extension and path
			const match = node.file.match(/([^/]+)\.(md|markdown)$/);
			let label = match ? match[1] : node.file;
			// Truncate long filenames to fit in node (approx 20 chars fit comfortably)
			if (label.length > 25) {
				label = label.substring(0, 22) + '...';
			}
			return label;
		} else if (node.type === 'text' && node.text) {
			// Use first line of text
			const firstLine = node.text.split('\n')[0];
			return firstLine.substring(0, 50); // Limit length
		}
		return '';
	}

	/**
	 * Build Excalidraw markdown content (Obsidian Excalidraw plugin format)
	 */
	private buildExcalidrawMarkdown(excalidrawData: ExcalidrawFile): string {
		const lines: string[] = [];

		// Frontmatter
		lines.push('---');
		lines.push('');
		lines.push('excalidraw-plugin: parsed');
		lines.push('tags:');
		lines.push('  - excalidraw');
		lines.push('  - family-tree');
		lines.push('');
		lines.push('---');
		lines.push('');

		// Excalidraw data marker
		lines.push('==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==');
		lines.push('');
		lines.push('');
		lines.push('# Excalidraw Data');
		lines.push('## Text Elements');
		lines.push('');

		// Add text elements section (for search/indexing)
		// Each text element needs a block reference ID that matches its element ID
		for (const element of excalidrawData.elements) {
			if (element.type === 'text') {
				// Format: "Text content ^elementID"
				// The elementID is used by Excalidraw to link the text list to the drawing
				lines.push(`${element.text} ^${element.id}`);
				lines.push('');
			}
		}

		lines.push('%%');
		lines.push('# Drawing');
		lines.push('```json');
		try {
			lines.push(JSON.stringify(excalidrawData, null, 2));
		} catch (e) {
			logger.error('export', 'Failed to stringify excalidrawData (formatted)', e);
			throw new Error(`JSON stringify failed (formatted): ${e.message}`);
		}
		lines.push('```');
		lines.push('%%');

		return lines.join('\n');
	}

	/**
	 * Generate unique Excalidraw element ID
	 */
	private generateId(): string {
		this.idCounter++;
		return `canvas-roots-${Date.now()}-${this.idCounter}`;
	}

	/**
	 * Generate random seed for Excalidraw roughness
	 */
	private generateSeed(): number {
		return Math.floor(Math.random() * 1000000);
	}
}
