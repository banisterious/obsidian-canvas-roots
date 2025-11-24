/**
 * Tree preview renderer for Canvas Roots
 * Provides visual preview of family trees before canvas generation
 */

import { FamilyTree } from '../core/family-graph';
import { LayoutOptions, LayoutResult, NodePosition } from '../core/layout-engine';
import { FamilyChartLayoutEngine } from '../core/family-chart-layout';
import { TimelineLayoutEngine } from '../core/timeline-layout';
import { HourglassLayoutEngine } from '../core/hourglass-layout';
import type { ColorScheme } from '../settings';

/**
 * Renders interactive SVG preview of family trees
 * Phase 1: Basic preview with zoom-to-fit
 */
export class TreePreviewRenderer {
	private container: HTMLElement;
	private svgElement: SVGElement | null = null;
	private currentLayout: LayoutResult | null = null;
	private showLabels: boolean = true;
	private currentScale: number = 1;
	private currentTranslateX: number = 0;
	private currentTranslateY: number = 0;
	private isDragging: boolean = false;
	private dragStartX: number = 0;
	private dragStartY: number = 0;
	private colorScheme: ColorScheme = 'gender';
	private tooltipElement: HTMLElement | null = null;

	constructor(container: HTMLElement) {
		this.container = container;
		this.setupPanZoom();
		this.setupTooltip();
	}

	/**
	 * Setup pan and zoom interactions
	 */
	private setupPanZoom(): void {
		// Mouse wheel zoom
		this.container.addEventListener('wheel', (e: WheelEvent) => {
			if (!this.svgElement) return;
			e.preventDefault();

			const delta = e.deltaY > 0 ? 0.9 : 1.1;
			this.currentScale = Math.max(0.1, Math.min(5, this.currentScale * delta));
			this.updateTransform();
		});

		// Pan with mouse drag
		this.container.addEventListener('mousedown', (e: MouseEvent) => {
			this.isDragging = true;
			this.dragStartX = e.clientX - this.currentTranslateX;
			this.dragStartY = e.clientY - this.currentTranslateY;
			this.container.style.cursor = 'grabbing';
		});

		this.container.addEventListener('mousemove', (e: MouseEvent) => {
			if (!this.isDragging) return;
			this.currentTranslateX = e.clientX - this.dragStartX;
			this.currentTranslateY = e.clientY - this.dragStartY;
			this.updateTransform();
		});

		this.container.addEventListener('mouseup', () => {
			this.isDragging = false;
			this.container.style.cursor = 'grab';
		});

		this.container.addEventListener('mouseleave', () => {
			this.isDragging = false;
			this.container.style.cursor = 'grab';
		});

		this.container.style.cursor = 'grab';
	}

	/**
	 * Setup tooltip element for hover interactions
	 */
	private setupTooltip(): void {
		this.tooltipElement = document.createElement('div');
		this.tooltipElement.addClass('crc-preview-tooltip');
		this.tooltipElement.style.display = 'none';
		document.body.appendChild(this.tooltipElement);
	}

	/**
	 * Update SVG transform for pan/zoom
	 */
	private updateTransform(): void {
		if (!this.svgElement) return;
		const g = this.svgElement.querySelector('.crc-tree-preview-content');
		if (!g) return;

		g.setAttribute('transform',
			`translate(${this.currentTranslateX}, ${this.currentTranslateY}) scale(${this.currentScale})`
		);
	}

	/**
	 * Get node color based on current color scheme
	 */
	private getNodeColor(pos: NodePosition): string {
		switch (this.colorScheme) {
			case 'gender': {
				const sex = pos.person.sex?.toLowerCase();
				if (sex === 'm' || sex === 'male') {
					return '#4ade80'; // Green (Obsidian color 4)
				} else if (sex === 'f' || sex === 'female') {
					return '#c084fc'; // Purple (Obsidian color 6)
				}
				return '#94a3b8'; // Neutral gray
			}
			case 'generation': {
				// Use generation number to assign colors
				const colors = ['#ef4444', '#f97316', '#eab308', '#4ade80', '#06b6d4', '#c084fc'];
				const colorIndex = Math.abs((pos.generation ?? 0) % colors.length);
				return colors[colorIndex];
			}
			case 'monochrome':
			default:
				return '#94a3b8'; // Neutral gray
		}
	}

	/**
	 * Render a preview of the family tree with the given options
	 */
	async renderPreview(
		familyTree: FamilyTree,
		options: LayoutOptions
	): Promise<void> {
		// Clear existing preview
		this.clear();

		// Calculate layout using selected algorithm
		const layout = this.calculateLayout(familyTree, options);
		this.currentLayout = layout;

		// Create SVG element
		this.svgElement = this.createSVG();
		this.container.appendChild(this.svgElement);

		// Render nodes and edges
		this.renderNodes(layout.positions, options);
		this.renderEdges(familyTree, layout.positions);

		// Zoom to fit entire tree
		this.zoomToFit(layout.positions);
	}

	/**
	 * Calculate layout based on selected algorithm
	 */
	private calculateLayout(
		familyTree: FamilyTree,
		options: LayoutOptions
	): LayoutResult {
		const layoutType = options.layoutType ?? 'standard';

		// Apply spacing multiplier for compact layouts
		const layoutOptions = { ...options };
		if (layoutType === 'compact') {
			layoutOptions.nodeSpacingX = (options.nodeSpacingX ?? 400) * 0.5;
			layoutOptions.nodeSpacingY = (options.nodeSpacingY ?? 200) * 0.5;
		}

		switch (layoutType) {
			case 'compact':
			case 'standard':
			default: {
				const standardLayout = new FamilyChartLayoutEngine();
				return standardLayout.calculateLayout(familyTree, layoutOptions);
			}
			case 'timeline': {
				const timelineLayout = new TimelineLayoutEngine();
				return timelineLayout.calculateLayout(familyTree, layoutOptions);
			}
			case 'hourglass': {
				const hourglassLayout = new HourglassLayoutEngine();
				return hourglassLayout.calculateLayout(familyTree, layoutOptions);
			}
		}
	}

	/**
	 * Create SVG element for rendering
	 */
	private createSVG(): SVGElement {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('class', 'crc-tree-preview-svg');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', '100%');

		// Add container group for zoom/pan
		const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		g.setAttribute('class', 'crc-tree-preview-content');
		svg.appendChild(g);

		return svg;
	}

	/**
	 * Render person nodes as rectangles
	 */
	private renderNodes(positions: NodePosition[], options: LayoutOptions): void {
		if (!this.svgElement) return;

		const g = this.svgElement.querySelector('.crc-tree-preview-content');
		if (!g) return;

		const nodeWidth = options.nodeWidth ?? 250;
		const nodeHeight = options.nodeHeight ?? 120;

		// Preview uses smaller nodes for better overview
		const previewWidth = nodeWidth * 0.4;
		const previewHeight = nodeHeight * 0.4;

		for (const pos of positions) {
			// Create node group
			const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
			nodeGroup.setAttribute('class', 'crc-preview-node');
			nodeGroup.setAttribute('data-cr-id', pos.crId);

			// Create rectangle
			const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			rect.setAttribute('x', (pos.x - previewWidth / 2).toString());
			rect.setAttribute('y', (pos.y - previewHeight / 2).toString());
			rect.setAttribute('width', previewWidth.toString());
			rect.setAttribute('height', previewHeight.toString());
			rect.setAttribute('rx', '4');
			rect.setAttribute('class', 'crc-preview-node-rect');

			// Apply color based on scheme
			const fillColor = this.getNodeColor(pos);
			rect.setAttribute('fill', fillColor);
			rect.setAttribute('fill-opacity', '0.3');
			rect.setAttribute('stroke', fillColor);

			// Create text label (just name, no dates in preview)
			const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			text.setAttribute('x', pos.x.toString());
			text.setAttribute('y', pos.y.toString());
			text.setAttribute('class', 'crc-preview-node-text');
			text.setAttribute('text-anchor', 'middle');
			text.setAttribute('dominant-baseline', 'middle');
			text.textContent = this.truncateName(pos.person.name);

			// Hide labels if toggle is off
			if (!this.showLabels) {
				text.setAttribute('display', 'none');
			}

			// Add hover interactions
			nodeGroup.addEventListener('mouseenter', (e: MouseEvent) => {
				this.showTooltip(pos, e);
				rect.setAttribute('fill-opacity', '0.5');
			});
			nodeGroup.addEventListener('mouseleave', () => {
				this.hideTooltip();
				rect.setAttribute('fill-opacity', '0.3');
			});
			nodeGroup.addEventListener('mousemove', (e: MouseEvent) => {
				this.updateTooltipPosition(e);
			});

			nodeGroup.appendChild(rect);
			nodeGroup.appendChild(text);
			g.appendChild(nodeGroup);
		}
	}

	/**
	 * Render relationship edges as lines
	 */
	private renderEdges(familyTree: FamilyTree, positions: NodePosition[]): void {
		if (!this.svgElement) return;

		const g = this.svgElement.querySelector('.crc-tree-preview-content');
		if (!g) return;

		// Create position lookup map
		const posMap = new Map<string, NodePosition>();
		for (const pos of positions) {
			posMap.set(pos.crId, pos);
		}

		// Render parent-child edges
		for (const edge of familyTree.edges) {
			const fromPos = posMap.get(edge.from);
			const toPos = posMap.get(edge.to);

			if (!fromPos || !toPos) continue;

			const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			line.setAttribute('x1', fromPos.x.toString());
			line.setAttribute('y1', fromPos.y.toString());
			line.setAttribute('x2', toPos.x.toString());
			line.setAttribute('y2', toPos.y.toString());
			line.setAttribute('class', 'crc-preview-edge');

			// Insert edges before nodes so they appear behind
			g.insertBefore(line, g.firstChild);
		}
	}

	/**
	 * Adjust SVG viewBox to fit all nodes with padding
	 */
	private zoomToFit(positions: NodePosition[]): void {
		if (!this.svgElement || positions.length === 0) return;

		// Find bounding box of all nodes
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for (const pos of positions) {
			minX = Math.min(minX, pos.x);
			minY = Math.min(minY, pos.y);
			maxX = Math.max(maxX, pos.x);
			maxY = Math.max(maxY, pos.y);
		}

		// Add padding (20% of dimensions)
		const width = maxX - minX;
		const height = maxY - minY;
		const padding = Math.max(width, height) * 0.2;

		minX -= padding;
		minY -= padding;
		const viewWidth = width + padding * 2;
		const viewHeight = height + padding * 2;

		// Set viewBox to show entire tree
		this.svgElement.setAttribute(
			'viewBox',
			`${minX} ${minY} ${viewWidth} ${viewHeight}`
		);
	}

	/**
	 * Truncate long names for preview display
	 */
	private truncateName(name: string): string {
		const maxLength = 15;
		if (name.length <= maxLength) return name;

		// Try to show first and last name
		const parts = name.split(' ');
		if (parts.length >= 2) {
			return `${parts[0]} ${parts[parts.length - 1]}`;
		}

		return name.substring(0, maxLength) + '...';
	}

	/**
	 * Show tooltip for a person node
	 */
	private showTooltip(pos: NodePosition, event: MouseEvent): void {
		if (!this.tooltipElement) return;

		const person = pos.person;
		let tooltipContent = `<strong>${person.name}</strong>`;

		// Add dates if available
		if (person.birthDate || person.deathDate) {
			tooltipContent += '<br>';
			if (person.birthDate) tooltipContent += `b. ${person.birthDate}`;
			if (person.birthDate && person.deathDate) tooltipContent += ' | ';
			if (person.deathDate) tooltipContent += `d. ${person.deathDate}`;
		}

		// Add generation
		if (pos.generation !== undefined) {
			tooltipContent += `<br><em>Generation ${pos.generation}</em>`;
		}

		this.tooltipElement.innerHTML = tooltipContent;
		this.tooltipElement.style.display = 'block';
		this.updateTooltipPosition(event);
	}

	/**
	 * Hide tooltip
	 */
	private hideTooltip(): void {
		if (!this.tooltipElement) return;
		this.tooltipElement.style.display = 'none';
	}

	/**
	 * Update tooltip position based on mouse event
	 */
	private updateTooltipPosition(event: MouseEvent): void {
		if (!this.tooltipElement) return;

		const offset = 15;
		this.tooltipElement.style.left = `${event.clientX + offset}px`;
		this.tooltipElement.style.top = `${event.clientY + offset}px`;
	}

	/**
	 * Clear the preview
	 */
	clear(): void {
		this.container.empty();
		this.svgElement = null;
		this.currentLayout = null;
		this.hideTooltip();
		this.resetView();
	}

	/**
	 * Toggle label visibility
	 */
	toggleLabels(show: boolean): void {
		this.showLabels = show;

		if (!this.svgElement) return;

		// Update all text elements
		const texts = this.svgElement.querySelectorAll('.crc-preview-node-text');
		texts.forEach((text) => {
			if (show) {
				text.removeAttribute('display');
			} else {
				text.setAttribute('display', 'none');
			}
		});
	}

	/**
	 * Reset view to initial zoom and position
	 */
	resetView(): void {
		this.currentScale = 1;
		this.currentTranslateX = 0;
		this.currentTranslateY = 0;
		this.updateTransform();
	}

	/**
	 * Zoom in
	 */
	zoomIn(): void {
		this.currentScale = Math.min(5, this.currentScale * 1.2);
		this.updateTransform();
	}

	/**
	 * Zoom out
	 */
	zoomOut(): void {
		this.currentScale = Math.max(0.1, this.currentScale / 1.2);
		this.updateTransform();
	}

	/**
	 * Set color scheme and re-render nodes if preview exists
	 */
	setColorScheme(scheme: ColorScheme): void {
		this.colorScheme = scheme;

		// Re-apply colors to existing nodes if preview is rendered
		if (!this.svgElement || !this.currentLayout) return;

		const g = this.svgElement.querySelector('.crc-tree-preview-content');
		if (!g) return;

		// Update each node's color
		const nodes = g.querySelectorAll('.crc-preview-node');
		nodes.forEach((nodeGroup) => {
			const crId = nodeGroup.getAttribute('data-cr-id');
			if (!crId) return;

			const pos = this.currentLayout!.positions.find(p => p.crId === crId);
			if (!pos) return;

			const rect = nodeGroup.querySelector('rect');
			if (!rect) return;

			const fillColor = this.getNodeColor(pos);
			rect.setAttribute('fill', fillColor);
			rect.setAttribute('stroke', fillColor);
		});
	}

	/**
	 * Get current layout result (for debugging/testing)
	 */
	getLayout(): LayoutResult | null {
		return this.currentLayout;
	}

	/**
	 * Cleanup resources (call when disposing the renderer)
	 */
	dispose(): void {
		this.clear();
		if (this.tooltipElement) {
			this.tooltipElement.remove();
			this.tooltipElement = null;
		}
	}
}
