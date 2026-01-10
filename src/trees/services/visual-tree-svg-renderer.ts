/**
 * Visual Tree SVG Renderer
 *
 * Renders visual tree layouts as SVG for embedding in PDFs.
 * Matches the family-chart visual style with profile icons,
 * colored cards, and indicator dots.
 */

import type {
	VisualTreeLayout,
	VisualTreeOptions,
	VisualTreeNode,
	VisualTreeConnection
} from '../types/visual-tree-types';
import { formatDisplayDate } from '../../dates';

/**
 * Color scheme matching family-chart
 */
const FAMILY_CHART_COLORS = {
	male: 'rgb(120, 159, 172)',       // Teal blue
	female: 'rgb(196, 138, 146)',     // Dusty rose
	unknown: 'rgb(180, 180, 180)',    // Gray
	maleDark: 'rgb(90, 125, 136)',    // Darker teal for border/icon bg
	femaleDark: 'rgb(160, 110, 118)', // Darker rose for border/icon bg
	unknownDark: 'rgb(140, 140, 140)',
	text: '#ffffff',
	textSecondary: 'rgba(255, 255, 255, 0.85)',
	line: 'rgb(100, 100, 100)',
	background: 'rgb(250, 250, 250)'
};

/**
 * Generation-based rainbow colors (muted for print)
 */
const GENERATION_COLORS = [
	'rgb(180, 120, 120)', // Gen 0 - Muted red
	'rgb(180, 150, 100)', // Gen 1 - Muted orange
	'rgb(170, 170, 100)', // Gen 2 - Muted yellow
	'rgb(120, 160, 120)', // Gen 3 - Muted green
	'rgb(120, 150, 170)', // Gen 4 - Muted blue
	'rgb(150, 130, 170)', // Gen 5 - Muted purple
	'rgb(170, 130, 150)', // Gen 6 - Muted pink
	'rgb(150, 140, 130)'  // Gen 7+ - Muted brown
];

/**
 * Renders a VisualTreeLayout to an SVG string
 */
export class VisualTreeSvgRenderer {
	/**
	 * Render the tree to an SVG string
	 */
	renderToSvg(layout: VisualTreeLayout, options: VisualTreeOptions): string {
		const { page, margins, bounds } = layout;

		// Calculate usable area
		const usableWidth = page.width - margins.left - margins.right;
		const usableHeight = page.height - margins.top - margins.bottom;

		// Calculate scale to fit content
		const scaleX = bounds.width > 0 ? usableWidth / bounds.width : 1;
		const scaleY = bounds.height > 0 ? usableHeight / bounds.height : 1;
		const scale = Math.min(scaleX, scaleY, 1); // Don't scale up

		// Calculate offset to center the tree
		const scaledWidth = bounds.width * scale;
		const scaledHeight = bounds.height * scale;
		const offsetX = (usableWidth - scaledWidth) / 2 + margins.left - bounds.minX * scale;
		const offsetY = (usableHeight - scaledHeight) / 2 + margins.top - bounds.minY * scale;

		// Build SVG content
		const elements: string[] = [];

		// Add definitions (shadows)
		elements.push(this.renderDefs());

		// Add background
		elements.push(this.renderBackground(page.width, page.height, options.colorScheme));

		// Render connections first (behind nodes)
		for (const connection of layout.connections) {
			elements.push(this.renderConnection(connection, scale, offsetX, offsetY, options));
		}

		// Render nodes
		for (const node of layout.nodes) {
			elements.push(this.renderNode(node, scale, offsetX, offsetY, options));
		}

		// Wrap in SVG element
		return `<svg xmlns="http://www.w3.org/2000/svg"
			width="${page.width}"
			height="${page.height}"
			viewBox="0 0 ${page.width} ${page.height}">
			${elements.join('\n')}
		</svg>`;
	}

	/**
	 * Convert SVG to a PNG data URL for embedding in PDF
	 */
	async svgToDataUrl(svgString: string, width: number, height: number): Promise<string> {
		return new Promise((resolve, reject) => {
			const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
			const url = URL.createObjectURL(svgBlob);

			const img = new Image();
			const canvas = document.createElement('canvas');
			const scale = 4; // 4x resolution for sharper PDF output
			canvas.width = width * scale;
			canvas.height = height * scale;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				URL.revokeObjectURL(url);
				reject(new Error('Failed to get canvas context'));
				return;
			}

			img.onload = () => {
				ctx.scale(scale, scale);
				ctx.drawImage(img, 0, 0, width, height);
				URL.revokeObjectURL(url);

				const dataUrl = canvas.toDataURL('image/png');
				resolve(dataUrl);
			};

			img.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error('Failed to load SVG image'));
			};

			img.src = url;
		});
	}

	/**
	 * Render SVG defs (shadows)
	 */
	private renderDefs(): string {
		return `
			<defs>
				<filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
					<feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.25"/>
				</filter>
			</defs>
		`;
	}

	/**
	 * Render background rectangle
	 */
	private renderBackground(width: number, height: number, colorScheme: VisualTreeOptions['colorScheme']): string {
		const fillColor = colorScheme === 'grayscale' ? '#ffffff' : FAMILY_CHART_COLORS.background;
		return `<rect x="0" y="0" width="${width}" height="${height}" fill="${fillColor}"/>`;
	}

	/**
	 * Render a connection line between nodes
	 */
	private renderConnection(
		connection: VisualTreeConnection,
		scale: number,
		offsetX: number,
		offsetY: number,
		options: VisualTreeOptions
	): string {
		const fromX = connection.from.x * scale + offsetX;
		const fromY = connection.from.y * scale + offsetY;
		const toX = connection.to.x * scale + offsetX;
		const toY = connection.to.y * scale + offsetY;

		const lineColor = options.colorScheme === 'grayscale' ? '#444444' : FAMILY_CHART_COLORS.line;

		// Use a curved path for visual appeal
		const midY = (fromY + toY) / 2;

		return `<path
			d="M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}"
			stroke="${lineColor}"
			stroke-width="2"
			fill="none"/>`;
	}

	/**
	 * Render a person node in family-chart style
	 */
	private renderNode(
		node: VisualTreeNode,
		scale: number,
		offsetX: number,
		offsetY: number,
		options: VisualTreeOptions
	): string {
		const x = node.x * scale + offsetX;
		const y = node.y * scale + offsetY;
		const width = node.width * scale;
		const height = node.height * scale;

		const colors = this.getNodeColors(node, options.colorScheme);
		const textLines = this.getNodeTextLines(node, options.nodeContent);

		// Card dimensions
		const cardX = x - width / 2;
		const cardY = y - height / 2;
		const borderRadius = 4;

		// Icon area dimensions - fixed proportion of height to keep it square-ish
		const iconAreaWidth = height * 0.9; // Slightly less than height for a near-square icon area
		const iconPadding = 3;
		const iconSize = height - iconPadding * 2;
		const iconCenterX = cardX + iconAreaWidth / 2;
		const iconCenterY = y;

		// Text area (rest of the card width)
		const textAreaX = cardX + iconAreaWidth;
		const textAreaWidth = width - iconAreaWidth - 4; // Small right padding
		const textCenterX = textAreaX + textAreaWidth / 2;

		// Calculate font size - scale with card size but keep readable
		const baseFontSize = Math.max(7, Math.min(11, height / 5));
		const lineHeight = baseFontSize * 1.25;

		// Build text elements
		const textElements: string[] = [];
		const totalTextHeight = textLines.length * lineHeight;
		const textStartY = y - totalTextHeight / 2 + lineHeight * 0.35;

		for (let i = 0; i < textLines.length; i++) {
			const lineY = textStartY + i * lineHeight;
			const fontSize = i === 0 ? baseFontSize : baseFontSize * 0.8;
			const fill = colors.text;
			const fontWeight = i === 0 ? 'bold' : 'normal';
			const escapedText = this.escapeXml(textLines[i]);

			textElements.push(`
				<text
					x="${textCenterX}"
					y="${lineY}"
					text-anchor="middle"
					dominant-baseline="middle"
					font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
					font-size="${fontSize}"
					font-weight="${fontWeight}"
					fill="${fill}"
				>${escapedText}</text>
			`);
		}

		// Gender indicator dots above the card
		const dotY = cardY - 5;
		const dotRadius = 2.5;
		const dotGap = 2;
		const maleColor = options.colorScheme === 'grayscale' ? '#666666' : FAMILY_CHART_COLORS.male;
		const femaleColor = options.colorScheme === 'grayscale' ? '#999999' : FAMILY_CHART_COLORS.female;

		const indicatorDots = `
			<circle cx="${x - dotRadius - dotGap/2}" cy="${dotY}" r="${dotRadius}" fill="${maleColor}"/>
			<circle cx="${x + dotRadius + dotGap/2}" cy="${dotY}" r="${dotRadius}" fill="${femaleColor}"/>
		`;

		// Profile icon SVG (simplified person silhouette)
		const personIcon = this.renderPersonIcon(iconCenterX, iconCenterY, iconSize);

		// Build the icon area path (left rounded corners)
		const iconAreaPath = `
			M ${cardX + borderRadius} ${cardY}
			L ${cardX + iconAreaWidth} ${cardY}
			L ${cardX + iconAreaWidth} ${cardY + height}
			L ${cardX + borderRadius} ${cardY + height}
			Q ${cardX} ${cardY + height}, ${cardX} ${cardY + height - borderRadius}
			L ${cardX} ${cardY + borderRadius}
			Q ${cardX} ${cardY}, ${cardX + borderRadius} ${cardY}
			Z
		`;

		return `
			<g filter="url(#cardShadow)">
				<!-- Gender indicator dots -->
				${indicatorDots}

				<!-- Main card background -->
				<rect
					x="${cardX}"
					y="${cardY}"
					width="${width}"
					height="${height}"
					rx="${borderRadius}"
					ry="${borderRadius}"
					fill="${colors.fill}"
					stroke="${colors.border}"
					stroke-width="1"
				/>

				<!-- Icon background area (darker) -->
				<path
					d="${iconAreaPath}"
					fill="${colors.iconBg}"
				/>

				<!-- Person icon -->
				${personIcon}

				<!-- Text content -->
				${textElements.join('')}
			</g>
		`;
	}

	/**
	 * Render a simplified person icon
	 */
	private renderPersonIcon(cx: number, cy: number, size: number): string {
		const headRadius = size * 0.18;
		const headY = cy - size * 0.12;
		const bodyY = cy + size * 0.08;
		const bodyWidth = size * 0.4;
		const bodyHeight = size * 0.28;

		return `
			<g opacity="0.75">
				<!-- Head -->
				<circle
					cx="${cx}"
					cy="${headY}"
					r="${headRadius}"
					fill="rgba(255, 255, 255, 0.9)"
				/>
				<!-- Body (rounded rectangle) -->
				<rect
					x="${cx - bodyWidth / 2}"
					y="${bodyY}"
					width="${bodyWidth}"
					height="${bodyHeight}"
					rx="${bodyWidth / 2}"
					ry="${bodyWidth / 3}"
					fill="rgba(255, 255, 255, 0.9)"
				/>
			</g>
		`;
	}

	/**
	 * Get colors for a node based on color scheme
	 */
	private getNodeColors(
		node: VisualTreeNode,
		colorScheme: VisualTreeOptions['colorScheme']
	): { fill: string; border: string; iconBg: string; text: string } {
		switch (colorScheme) {
			case 'gender': {
				const sex = node.person.sex?.toLowerCase();
				if (sex === 'm' || sex === 'male') {
					return {
						fill: FAMILY_CHART_COLORS.male,
						border: FAMILY_CHART_COLORS.maleDark,
						iconBg: FAMILY_CHART_COLORS.maleDark,
						text: FAMILY_CHART_COLORS.text
					};
				} else if (sex === 'f' || sex === 'female') {
					return {
						fill: FAMILY_CHART_COLORS.female,
						border: FAMILY_CHART_COLORS.femaleDark,
						iconBg: FAMILY_CHART_COLORS.femaleDark,
						text: FAMILY_CHART_COLORS.text
					};
				}
				return {
					fill: FAMILY_CHART_COLORS.unknown,
					border: FAMILY_CHART_COLORS.unknownDark,
					iconBg: FAMILY_CHART_COLORS.unknownDark,
					text: FAMILY_CHART_COLORS.text
				};
			}
			case 'generation': {
				const genIndex = Math.abs(node.generation) % GENERATION_COLORS.length;
				const baseColor = GENERATION_COLORS[genIndex];
				const darkColor = this.darkenColor(baseColor, 0.2);
				return {
					fill: baseColor,
					border: darkColor,
					iconBg: darkColor,
					text: FAMILY_CHART_COLORS.text
				};
			}
			case 'grayscale':
				return {
					fill: '#d0d0d0',
					border: '#888888',
					iconBg: '#a0a0a0',
					text: '#333333'
				};
			case 'default':
			default:
				// Use gender colors as default since they're most informative
				return this.getNodeColors(node, 'gender');
		}
	}

	/**
	 * Darken a color by a percentage
	 */
	private darkenColor(color: string, amount: number): string {
		const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
		if (!match) return color;

		const r = Math.max(0, Math.floor(parseInt(match[1]) * (1 - amount)));
		const g = Math.max(0, Math.floor(parseInt(match[2]) * (1 - amount)));
		const b = Math.max(0, Math.floor(parseInt(match[3]) * (1 - amount)));

		return `rgb(${r}, ${g}, ${b})`;
	}

	/**
	 * Get text lines for a node based on content option
	 */
	private getNodeTextLines(
		node: VisualTreeNode,
		nodeContent: VisualTreeOptions['nodeContent']
	): string[] {
		const lines: string[] = [node.person.name];

		if (nodeContent === 'name-dates' || nodeContent === 'name-dates-places') {
			// Format dates more compactly
			if (node.person.birthDate) {
				lines.push(formatDisplayDate(node.person.birthDate));
			}
		}

		if (nodeContent === 'name-dates-places') {
			if (node.person.birthPlace) {
				const place = this.stripWikilinks(node.person.birthPlace);
				// Truncate long place names
				lines.push(place.length > 25 ? place.substring(0, 22) + '...' : place);
			}
		}

		return lines;
	}

	/**
	 * Strip wikilink brackets from text
	 */
	private stripWikilinks(text: string | undefined): string {
		if (!text) return '';
		return text.replace(/\[\[([^\]]+)\]\]/g, '$1');
	}

	/**
	 * Escape XML special characters
	 */
	private escapeXml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}
}
