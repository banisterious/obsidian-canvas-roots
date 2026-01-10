/**
 * Tree preview renderer for Charted Roots
 * Provides visual preview of family trees before canvas generation
 */

import { FamilyTree } from '../core/family-graph';
import { LayoutOptions, LayoutResult, NodePosition } from '../core/layout-engine';
import { FamilyChartLayoutEngine } from '../core/family-chart-layout';
import { TimelineLayoutEngine } from '../core/timeline-layout';
import { HourglassLayoutEngine } from '../core/hourglass-layout';
import type { ColorScheme } from '../settings';
import { jsPDF } from 'jspdf';
import { formatDisplayDate } from '../dates';

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
	private colorScheme: ColorScheme = 'sex';
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
			this.container.removeClass('cr-cursor--grab');
			this.container.addClass('cr-cursor--grabbing');
		});

		this.container.addEventListener('mousemove', (e: MouseEvent) => {
			if (!this.isDragging) return;
			this.currentTranslateX = e.clientX - this.dragStartX;
			this.currentTranslateY = e.clientY - this.dragStartY;
			this.updateTransform();
		});

		this.container.addEventListener('mouseup', () => {
			this.isDragging = false;
			this.container.removeClass('cr-cursor--grabbing');
			this.container.addClass('cr-cursor--grab');
		});

		this.container.addEventListener('mouseleave', () => {
			this.isDragging = false;
			this.container.removeClass('cr-cursor--grabbing');
			this.container.addClass('cr-cursor--grab');
		});

		this.container.addClass('cr-cursor--grab');
	}

	/**
	 * Setup tooltip element for hover interactions
	 */
	private setupTooltip(): void {
		this.tooltipElement = document.createElement('div');
		this.tooltipElement.addClass('crc-preview-tooltip');
		this.tooltipElement.addClass('cr-hidden');
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
			case 'sex': {
				const sex = pos.person.sex?.toLowerCase();
				if (sex === 'm' || sex === 'male') {
					return '#4ade80'; // Green (Obsidian color 4)
				} else if (sex === 'f' || sex === 'female') {
					return '#c084fc'; // Purple (Obsidian color 6)
				} else if (sex === 'nonbinary') {
					return '#fbbf24'; // Yellow (Obsidian color 3)
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
	renderPreview(
		familyTree: FamilyTree,
		options: LayoutOptions
	): void {
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
		this.tooltipElement.empty();

		// Name
		this.tooltipElement.createEl('strong', { text: person.name });

		// Add dates if available
		if (person.birthDate || person.deathDate) {
			this.tooltipElement.createEl('br');
			let dateText = '';
			if (person.birthDate) dateText += `b. ${formatDisplayDate(person.birthDate)}`;
			if (person.birthDate && person.deathDate) dateText += ' | ';
			if (person.deathDate) dateText += `d. ${formatDisplayDate(person.deathDate)}`;
			this.tooltipElement.appendText(dateText);
		}

		// Add generation
		if (pos.generation !== undefined) {
			this.tooltipElement.createEl('br');
			this.tooltipElement.createEl('em', { text: `Generation ${pos.generation}` });
		}

		this.tooltipElement.removeClass('cr-hidden');
		this.updateTooltipPosition(event);
	}

	/**
	 * Hide tooltip
	 */
	private hideTooltip(): void {
		if (!this.tooltipElement) return;
		this.tooltipElement.addClass('cr-hidden');
	}

	/**
	 * Update tooltip position based on mouse event
	 */
	private updateTooltipPosition(event: MouseEvent): void {
		if (!this.tooltipElement) return;

		const offset = 15;
		this.tooltipElement.style.setProperty('left', `${event.clientX + offset}px`);
		this.tooltipElement.style.setProperty('top', `${event.clientY + offset}px`);
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
	 * Export preview as PNG image
	 */
	async exportAsPNG(): Promise<void> {
		if (!this.svgElement) {
			throw new Error('No preview to export');
		}

		// Clone SVG and prepare for export
		const svgClone = this.svgElement.cloneNode(true) as SVGElement;

		// Get SVG bounds
		const bbox = this.svgElement.getBoundingClientRect();
		const width = bbox.width;
		const height = bbox.height;

		// Set explicit dimensions and namespace on clone
		svgClone.setAttribute('width', width.toString());
		svgClone.setAttribute('height', height.toString());
		svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

		// Inline styles so they survive serialization (required for PNG export)
		this.inlineStylesFromSource(this.svgElement, svgClone);

		// Remove clip-path and mask references that don't resolve in standalone SVG
		// The url(#id) references fail when SVG is serialized (base URL context changes)
		svgClone.querySelectorAll('[clip-path]').forEach((el) => {
			el.removeAttribute('clip-path');
		});
		svgClone.querySelectorAll('[mask]').forEach((el) => {
			el.removeAttribute('mask');
		});
		// Also remove from inline styles
		svgClone.querySelectorAll('[style*="clip-path"], [style*="mask"]').forEach((el) => {
			const style = el.getAttribute('style') || '';
			el.setAttribute('style', style.replace(/clip-path:[^;]+;?/g, '').replace(/mask:[^;]+;?/g, ''));
		});

		// Explicitly set fill color on all text elements (CSS won't survive serialization)
		const isDark = document.body.classList.contains('theme-dark');
		const textColor = isDark ? '#ffffff' : '#333333';
		svgClone.querySelectorAll('text, tspan').forEach((el) => {
			el.setAttribute('fill', textColor);
		});

		// Add background rect for proper rendering
		const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		bgRect.setAttribute('width', '100%');
		bgRect.setAttribute('height', '100%');
		bgRect.setAttribute('fill', isDark ? '#1e1e1e' : '#ffffff');
		svgClone.insertBefore(bgRect, svgClone.firstChild);

		// Serialize SVG to string
		const svgString = new XMLSerializer().serializeToString(svgClone);
		const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
		const url = URL.createObjectURL(svgBlob);

		// Create image and canvas
		const img = new Image();
		const canvas = document.createElement('canvas');
		const scale = 2; // 2x resolution for better quality
		canvas.width = width * scale;
		canvas.height = height * scale;
		const ctx = canvas.getContext('2d');

		if (!ctx) {
			throw new Error('Failed to get canvas context');
		}

		// Wait for image to load
		await new Promise<void>((resolve, reject) => {
			img.onload = () => {
				// Scale and draw
				ctx.scale(scale, scale);
				ctx.drawImage(img, 0, 0);
				URL.revokeObjectURL(url);

				// Convert to blob and download
				canvas.toBlob((blob) => {
					if (!blob) {
						reject(new Error('Failed to create PNG blob'));
						return;
					}
					this.downloadBlob(blob, 'tree-preview.png');
					resolve();
				}, 'image/png');
			};
			img.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error('Failed to load SVG image'));
			};
			img.src = url;
		});
	}

	/**
	 * Export preview as SVG file
	 */
	exportAsSVG(): void {
		if (!this.svgElement) {
			throw new Error('No preview to export');
		}

		// Clone SVG
		const svgClone = this.svgElement.cloneNode(true) as SVGElement;

		// Get computed styles and inline them
		this.inlineStyles(svgClone);

		// Get SVG bounds
		const bbox = this.svgElement.getBoundingClientRect();
		svgClone.setAttribute('width', bbox.width.toString());
		svgClone.setAttribute('height', bbox.height.toString());

		// Add XML namespace if not present
		if (!svgClone.getAttribute('xmlns')) {
			svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
		}

		// Serialize and download
		const svgString = new XMLSerializer().serializeToString(svgClone);
		const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
		this.downloadBlob(blob, 'tree-preview.svg');
	}

	/**
	 * Export preview as PDF file
	 */
	async exportAsPDF(): Promise<void> {
		if (!this.svgElement) {
			throw new Error('No preview to export');
		}

		// Clone SVG and prepare for export (same as PNG)
		const svgClone = this.svgElement.cloneNode(true) as SVGElement;

		// Get SVG bounds
		const bbox = this.svgElement.getBoundingClientRect();
		const width = bbox.width;
		const height = bbox.height;

		// Set explicit dimensions and namespace on clone
		svgClone.setAttribute('width', width.toString());
		svgClone.setAttribute('height', height.toString());
		svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

		// Inline styles so they survive serialization
		this.inlineStylesFromSource(this.svgElement, svgClone);

		// Remove clip-path and mask references
		svgClone.querySelectorAll('[clip-path]').forEach((el) => {
			el.removeAttribute('clip-path');
		});
		svgClone.querySelectorAll('[mask]').forEach((el) => {
			el.removeAttribute('mask');
		});
		svgClone.querySelectorAll('[style*="clip-path"], [style*="mask"]').forEach((el) => {
			const style = el.getAttribute('style') || '';
			el.setAttribute('style', style.replace(/clip-path:[^;]+;?/g, '').replace(/mask:[^;]+;?/g, ''));
		});

		// Set text colors
		const isDark = document.body.classList.contains('theme-dark');
		const textColor = isDark ? '#ffffff' : '#333333';
		svgClone.querySelectorAll('text, tspan').forEach((el) => {
			el.setAttribute('fill', textColor);
		});

		// Add background rect
		const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		bgRect.setAttribute('width', '100%');
		bgRect.setAttribute('height', '100%');
		bgRect.setAttribute('fill', isDark ? '#1e1e1e' : '#ffffff');
		svgClone.insertBefore(bgRect, svgClone.firstChild);

		// Serialize SVG to string
		const svgString = new XMLSerializer().serializeToString(svgClone);
		const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
		const url = URL.createObjectURL(svgBlob);

		// Create image and canvas
		const img = new Image();
		const canvas = document.createElement('canvas');
		const scale = 2; // 2x resolution for better quality
		canvas.width = width * scale;
		canvas.height = height * scale;
		const ctx = canvas.getContext('2d');

		if (!ctx) {
			throw new Error('Failed to get canvas context');
		}

		// Wait for image to load and create PDF
		await new Promise<void>((resolve, reject) => {
			img.onload = () => {
				// Scale and draw
				ctx.scale(scale, scale);
				ctx.drawImage(img, 0, 0);
				URL.revokeObjectURL(url);

				// Create PDF with appropriate page size
				const orientation = width > height ? 'landscape' : 'portrait';
				const pdf = new jsPDF({
					orientation,
					unit: 'px',
					format: [width, height]
				});

				// Add canvas image to PDF
				const imgData = canvas.toDataURL('image/png');
				pdf.addImage(imgData, 'PNG', 0, 0, width, height);

				// Save PDF
				pdf.save('tree-preview.pdf');
				resolve();
			};
			img.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error('Failed to load SVG image'));
			};
			img.src = url;
		});
	}

	/**
	 * Inline computed styles into SVG elements for export (single element version for SVG export)
	 */
	private inlineStyles(element: Element): void {
		const computedStyle = window.getComputedStyle(element);
		const styleString = Array.from(computedStyle).reduce((str, property) => {
			return `${str}${property}:${computedStyle.getPropertyValue(property)};`;
		}, '');

		if (element instanceof SVGElement) {
			element.setAttribute('style', styleString);
		}

		// Recursively inline styles for children
		Array.from(element.children).forEach(child => this.inlineStyles(child));
	}

	/**
	 * Inline computed styles from source element into target element for export
	 * This version works with cloned elements that are not in the DOM
	 */
	private inlineStylesFromSource(source: Element, target: Element): void {
		const computedStyle = window.getComputedStyle(source);

		// Copy relevant style properties for SVG
		const relevantProperties = [
			'fill', 'stroke', 'stroke-width', 'font-family', 'font-size',
			'font-weight', 'text-anchor', 'dominant-baseline', 'opacity',
			'fill-opacity', 'stroke-opacity', 'visibility', 'display', 'color'
		];

		let styleString = '';
		for (const prop of relevantProperties) {
			const value = computedStyle.getPropertyValue(prop);
			if (value) {
				styleString += `${prop}:${value};`;
			}
		}

		if (styleString && target instanceof SVGElement) {
			const existingStyle = target.getAttribute('style') || '';
			target.setAttribute('style', existingStyle + styleString);
		}

		// For text elements, ensure fill is set
		const isTextElement = source.tagName === 'text' || source.tagName === 'TEXT';
		if (isTextElement) {
			const fill = computedStyle.getPropertyValue('fill');
			if (!fill || fill === 'none' || fill === 'rgb(0, 0, 0)') {
				target.setAttribute('fill', '#333333');
			}
		}

		// Recursively inline styles for children
		const sourceChildren = Array.from(source.children);
		const targetChildren = Array.from(target.children);
		for (let i = 0; i < sourceChildren.length && i < targetChildren.length; i++) {
			this.inlineStylesFromSource(sourceChildren[i], targetChildren[i]);
		}
	}

	/**
	 * Download a blob as a file
	 */
	private downloadBlob(blob: Blob, filename: string): void {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
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
