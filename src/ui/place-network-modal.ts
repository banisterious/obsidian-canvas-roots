/**
 * Place Network Modal
 * Visualizes place hierarchy as an interactive network/tree diagram
 */

import { App, Modal, Setting } from 'obsidian';
import { createLucideIcon } from './lucide-icons';
import { PlaceGraphService } from '../core/place-graph';
import { PlaceNode, PlaceCategory } from '../models/place';

interface NetworkNode {
	id: string;
	name: string;
	category: PlaceCategory;
	placeType?: string;
	personCount: number;
	depth: number;
	x: number;
	y: number;
	children: NetworkNode[];
	parent?: NetworkNode;
}

interface NetworkEdge {
	source: NetworkNode;
	target: NetworkNode;
}

interface MigrationFlow {
	from: string;
	to: string;
	count: number;
}

type ViewMode = 'hierarchy' | 'radial' | 'force';
type ColorMode = 'category' | 'type' | 'depth';

/**
 * Modal displaying a place network visualization
 */
export class PlaceNetworkModal extends Modal {
	private placeService: PlaceGraphService;
	private nodes: NetworkNode[] = [];
	private edges: NetworkEdge[] = [];
	private migrationFlows: MigrationFlow[] = [];
	private viewMode: ViewMode = 'hierarchy';
	private colorMode: ColorMode = 'category';
	private showMigrations: boolean = false;
	private svgContainer?: HTMLElement;
	private personCounts: Map<string, number> = new Map();

	constructor(app: App) {
		super(app);
		this.placeService = new PlaceGraphService(app);
		this.placeService.reloadCache();
		this.buildNetwork();
		this.buildMigrationFlows();
	}

	/**
	 * Build network data from place hierarchy
	 */
	private buildNetwork(): void {
		// Calculate person counts for each place
		const refs = this.placeService.getPlaceReferences();
		for (const ref of refs) {
			const key = ref.placeId || ref.rawValue;
			this.personCounts.set(key, (this.personCounts.get(key) || 0) + 1);
		}

		// Build tree structure from root places
		const rootPlaces = this.placeService.getRootPlaces();
		this.nodes = [];
		this.edges = [];

		const buildSubtree = (place: PlaceNode, depth: number, parent?: NetworkNode): NetworkNode => {
			const node: NetworkNode = {
				id: place.id,
				name: place.name,
				category: place.category,
				placeType: place.placeType,
				personCount: this.personCounts.get(place.id) || 0,
				depth,
				x: 0,
				y: 0,
				children: [],
				parent
			};

			this.nodes.push(node);

			if (parent) {
				this.edges.push({ source: parent, target: node });
			}

			const children = this.placeService.getChildren(place.id);
			for (const child of children) {
				const childNode = buildSubtree(child, depth + 1, node);
				node.children.push(childNode);
			}

			return node;
		};

		for (const rootPlace of rootPlaces) {
			buildSubtree(rootPlace, 0);
		}
	}

	/**
	 * Build migration flow data
	 */
	private buildMigrationFlows(): void {
		const detailedMigrations = this.placeService.getDetailedMigrations();
		this.migrationFlows = [];

		// Aggregate migrations by from/to pairs
		const flowMap = new Map<string, number>();
		for (const migration of detailedMigrations) {
			const key = `${migration.from}|${migration.to}`;
			flowMap.set(key, (flowMap.get(key) || 0) + 1);
		}

		// Convert to flows between nodes
		for (const [key, count] of flowMap) {
			const [fromName, toName] = key.split('|');
			// Find nodes by name
			const fromNode = this.nodes.find(n => n.name === fromName);
			const toNode = this.nodes.find(n => n.name === toName);

			if (fromNode && toNode) {
				this.migrationFlows.push({
					from: fromNode.id,
					to: toNode.id,
					count
				});
			}
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-place-network-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('git-branch', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Place hierarchy');

		// Description
		contentEl.createEl('p', {
			text: 'Visualizing place hierarchy and connections. Larger nodes indicate more associated people.',
			cls: 'crc-text--muted'
		});

		if (this.nodes.length === 0) {
			contentEl.createEl('p', {
				text: 'No place notes found. Create place notes to see the hierarchy.',
				cls: 'crc-text--muted crc-mt-3'
			});
			return;
		}

		// Controls
		const controlsRow = contentEl.createDiv({ cls: 'crc-network-controls' });

		// View mode selector
		new Setting(controlsRow)
			.setName('Layout')
			.addDropdown(dropdown => dropdown
				.addOption('hierarchy', 'Tree')
				.addOption('radial', 'Radial')
				.setValue(this.viewMode)
				.onChange((value: ViewMode) => {
					this.viewMode = value;
					this.renderNetwork();
				}));

		// Color mode selector
		new Setting(controlsRow)
			.setName('Color by')
			.addDropdown(dropdown => dropdown
				.addOption('category', 'Category')
				.addOption('type', 'Place type')
				.addOption('depth', 'Depth')
				.setValue(this.colorMode)
				.onChange((value: ColorMode) => {
					this.colorMode = value;
					this.renderNetwork();
				}));

		// Show migrations toggle (only if there are migration flows)
		if (this.migrationFlows.length > 0) {
			new Setting(controlsRow)
				.setName('Show migrations')
				.addToggle(toggle => toggle
					.setValue(this.showMigrations)
					.onChange((value: boolean) => {
						this.showMigrations = value;
						this.renderNetwork();
					}));
		}

		// Network container
		this.svgContainer = contentEl.createDiv({ cls: 'crc-place-network' });

		// Initial render
		this.renderNetwork();

		// Legend
		this.renderLegend(contentEl);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Render the network visualization
	 */
	private renderNetwork(): void {
		if (!this.svgContainer) return;
		this.svgContainer.empty();

		const width = 900;
		const height = 600;
		const padding = 60;

		// Calculate layout
		if (this.viewMode === 'hierarchy') {
			this.calculateHierarchyLayout(width, height, padding);
		} else {
			this.calculateRadialLayout(width, height);
		}

		// Create SVG
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('width', String(width));
		svg.setAttribute('height', String(height));
		svg.setAttribute('class', 'crc-network-svg');
		svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

		// Add arrowhead marker definition for migration flows
		if (this.showMigrations && this.migrationFlows.length > 0) {
			const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
			const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
			marker.setAttribute('id', 'migration-arrow');
			marker.setAttribute('viewBox', '0 0 10 10');
			marker.setAttribute('refX', '9');
			marker.setAttribute('refY', '5');
			marker.setAttribute('markerWidth', '6');
			marker.setAttribute('markerHeight', '6');
			marker.setAttribute('orient', 'auto-start-reverse');
			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
			path.setAttribute('fill', 'var(--color-orange)');
			marker.appendChild(path);
			defs.appendChild(marker);
			svg.appendChild(defs);
		}

		// Draw edges first (so they're behind nodes)
		for (const edge of this.edges) {
			this.drawEdge(svg, edge);
		}

		// Draw migration flows (if enabled)
		if (this.showMigrations) {
			for (const flow of this.migrationFlows) {
				this.drawMigrationFlow(svg, flow);
			}
		}

		// Draw nodes
		for (const node of this.nodes) {
			this.drawNode(svg, node);
		}

		this.svgContainer.appendChild(svg);

		// Add tooltip handler
		this.addTooltipHandler(this.svgContainer);
	}

	/**
	 * Calculate hierarchical tree layout
	 */
	private calculateHierarchyLayout(width: number, height: number, padding: number): void {
		// Find max depth
		const maxDepth = Math.max(...this.nodes.map(n => n.depth));
		const levelHeight = (height - padding * 2) / Math.max(maxDepth, 1);

		// Group nodes by depth
		const nodesByDepth = new Map<number, NetworkNode[]>();
		for (const node of this.nodes) {
			if (!nodesByDepth.has(node.depth)) {
				nodesByDepth.set(node.depth, []);
			}
			nodesByDepth.get(node.depth)!.push(node);
		}

		// Position nodes at each level
		for (let depth = 0; depth <= maxDepth; depth++) {
			const nodesAtDepth = nodesByDepth.get(depth) || [];
			const levelWidth = width - padding * 2;
			const nodeSpacing = levelWidth / Math.max(nodesAtDepth.length, 1);

			nodesAtDepth.forEach((node, i) => {
				node.y = padding + depth * levelHeight;
				if (nodesAtDepth.length === 1) {
					node.x = width / 2;
				} else {
					node.x = padding + i * nodeSpacing + nodeSpacing / 2;
				}
			});
		}
	}

	/**
	 * Calculate radial layout
	 */
	private calculateRadialLayout(width: number, height: number): void {
		const centerX = width / 2;
		const centerY = height / 2;
		const maxRadius = Math.min(width, height) / 2 - 60;

		// Find max depth
		const maxDepth = Math.max(...this.nodes.map(n => n.depth), 1);
		const radiusStep = maxRadius / maxDepth;

		// Group nodes by depth
		const nodesByDepth = new Map<number, NetworkNode[]>();
		for (const node of this.nodes) {
			if (!nodesByDepth.has(node.depth)) {
				nodesByDepth.set(node.depth, []);
			}
			nodesByDepth.get(node.depth)!.push(node);
		}

		// Position root nodes at center
		const rootNodes = nodesByDepth.get(0) || [];
		if (rootNodes.length === 1) {
			rootNodes[0].x = centerX;
			rootNodes[0].y = centerY;
		} else {
			// Multiple roots - arrange in small circle at center
			const rootRadius = 30;
			rootNodes.forEach((node, i) => {
				const angle = (2 * Math.PI * i) / rootNodes.length - Math.PI / 2;
				node.x = centerX + rootRadius * Math.cos(angle);
				node.y = centerY + rootRadius * Math.sin(angle);
			});
		}

		// Position other levels in concentric circles
		for (let depth = 1; depth <= maxDepth; depth++) {
			const nodesAtDepth = nodesByDepth.get(depth) || [];
			const radius = radiusStep * depth;

			// Sort nodes by parent position for better layout
			nodesAtDepth.sort((a, b) => {
				const aParentAngle = a.parent ? Math.atan2(a.parent.y - centerY, a.parent.x - centerX) : 0;
				const bParentAngle = b.parent ? Math.atan2(b.parent.y - centerY, b.parent.x - centerX) : 0;
				return aParentAngle - bParentAngle;
			});

			nodesAtDepth.forEach((node, i) => {
				const angle = (2 * Math.PI * i) / nodesAtDepth.length - Math.PI / 2;
				node.x = centerX + radius * Math.cos(angle);
				node.y = centerY + radius * Math.sin(angle);
			});
		}
	}

	/**
	 * Draw a network edge
	 */
	private drawEdge(svg: SVGElement, edge: NetworkEdge): void {
		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

		if (this.viewMode === 'hierarchy') {
			// Curved path for hierarchy view
			const midY = (edge.source.y + edge.target.y) / 2;
			const d = `M ${edge.source.x} ${edge.source.y}
					   C ${edge.source.x} ${midY}, ${edge.target.x} ${midY}, ${edge.target.x} ${edge.target.y}`;
			path.setAttribute('d', d);
		} else {
			// Straight line for radial view
			const d = `M ${edge.source.x} ${edge.source.y} L ${edge.target.x} ${edge.target.y}`;
			path.setAttribute('d', d);
		}

		path.setAttribute('fill', 'none');
		path.setAttribute('stroke', 'var(--text-muted)');
		path.setAttribute('stroke-opacity', '0.4');
		path.setAttribute('stroke-width', '1.5');
		path.setAttribute('class', 'crc-network-edge');

		svg.appendChild(path);
	}

	/**
	 * Draw a migration flow arrow between two places
	 */
	private drawMigrationFlow(svg: SVGElement, flow: MigrationFlow): void {
		const fromNode = this.nodes.find(n => n.id === flow.from);
		const toNode = this.nodes.find(n => n.id === flow.to);

		if (!fromNode || !toNode) return;

		// Calculate stroke width based on flow count (min 2, max 6)
		const maxCount = Math.max(...this.migrationFlows.map(f => f.count));
		const strokeWidth = 2 + (flow.count / maxCount) * 4;

		// Calculate the direction and shorten the line to not overlap nodes
		const dx = toNode.x - fromNode.x;
		const dy = toNode.y - fromNode.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist === 0) return;

		// Calculate node radii
		const baseRadius = 8;
		const maxRadius = 24;
		const fromRadius = Math.min(baseRadius + Math.sqrt(fromNode.personCount) * 3, maxRadius);
		const toRadius = Math.min(baseRadius + Math.sqrt(toNode.personCount) * 3, maxRadius);

		// Shorten line by node radii + small padding
		const padding = 5;
		const startOffset = fromRadius + padding;
		const endOffset = toRadius + padding + 8; // Extra for arrowhead

		const startX = fromNode.x + (dx / dist) * startOffset;
		const startY = fromNode.y + (dy / dist) * startOffset;
		const endX = toNode.x - (dx / dist) * endOffset;
		const endY = toNode.y - (dy / dist) * endOffset;

		// Create curved path for better visibility
		const midX = (startX + endX) / 2;
		const midY = (startY + endY) / 2;

		// Offset the middle point perpendicular to the line
		const perpX = -dy / dist * 20;
		const perpY = dx / dist * 20;

		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		const d = `M ${startX} ${startY} Q ${midX + perpX} ${midY + perpY}, ${endX} ${endY}`;
		path.setAttribute('d', d);
		path.setAttribute('fill', 'none');
		path.setAttribute('stroke', 'var(--color-orange)');
		path.setAttribute('stroke-opacity', '0.7');
		path.setAttribute('stroke-width', String(strokeWidth));
		path.setAttribute('marker-end', 'url(#migration-arrow)');
		path.setAttribute('class', 'crc-migration-flow');

		// Add tooltip data
		path.setAttribute('data-tooltip', `${fromNode.name} → ${toNode.name}: ${flow.count} ${flow.count === 1 ? 'person' : 'people'}`);

		svg.appendChild(path);
	}

	/**
	 * Draw a network node
	 */
	private drawNode(svg: SVGElement, node: NetworkNode): void {
		const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		g.setAttribute('class', 'crc-network-node');
		g.setAttribute('data-id', node.id);

		// Calculate radius based on person count
		const baseRadius = 8;
		const maxRadius = 24;
		const radius = Math.min(baseRadius + Math.sqrt(node.personCount) * 3, maxRadius);

		// Circle
		const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		circle.setAttribute('cx', String(node.x));
		circle.setAttribute('cy', String(node.y));
		circle.setAttribute('r', String(radius));
		circle.setAttribute('fill', this.getNodeColor(node));
		circle.setAttribute('stroke', 'var(--background-primary)');
		circle.setAttribute('stroke-width', '2');
		g.appendChild(circle);

		// Label
		const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		text.setAttribute('x', String(node.x));
		text.setAttribute('y', String(node.y + radius + 14));
		text.setAttribute('text-anchor', 'middle');
		text.setAttribute('class', 'crc-network-label');
		text.textContent = this.truncateName(node.name, 12);
		g.appendChild(text);

		// Tooltip data
		g.setAttribute('data-tooltip', this.getTooltipText(node));

		svg.appendChild(g);
	}

	/**
	 * Get color for a node based on color mode
	 */
	private getNodeColor(node: NetworkNode): string {
		switch (this.colorMode) {
			case 'category':
				return this.getCategoryColor(node.category);
			case 'type':
				return this.getTypeColor(node.placeType);
			case 'depth':
				return this.getDepthColor(node.depth);
			default:
				return 'var(--text-accent)';
		}
	}

	/**
	 * Get color for a category
	 */
	private getCategoryColor(category: PlaceCategory): string {
		const colors: Record<PlaceCategory, string> = {
			real: 'var(--color-green)',
			historical: 'var(--color-yellow)',
			disputed: 'var(--color-orange)',
			legendary: 'var(--color-purple)',
			mythological: 'var(--color-blue)',
			fictional: 'var(--color-pink)'
		};
		return colors[category] || 'var(--text-muted)';
	}

	/**
	 * Get color for a place type
	 */
	private getTypeColor(placeType?: string): string {
		const typeColors: Record<string, string> = {
			continent: '#4CAF50',
			country: '#2196F3',
			state: '#03A9F4',
			province: '#00BCD4',
			region: '#009688',
			county: '#8BC34A',
			city: '#FF9800',
			town: '#FFC107',
			village: '#FFEB3B',
			district: '#795548',
			parish: '#9E9E9E',
			castle: '#673AB7',
			estate: '#E91E63',
			cemetery: '#607D8B',
			church: '#9C27B0',
			other: '#757575'
		};
		return typeColors[placeType || 'other'] || '#757575';
	}

	/**
	 * Get color for depth level
	 */
	private getDepthColor(depth: number): string {
		const maxDepth = Math.max(...this.nodes.map(n => n.depth), 1);
		const hue = (depth / maxDepth) * 240; // Blue to red
		return `hsl(${240 - hue}, 70%, 50%)`;
	}

	/**
	 * Get tooltip text for a node
	 */
	private getTooltipText(node: NetworkNode): string {
		const parts = [node.name];
		if (node.placeType) {
			parts.push(`Type: ${node.placeType}`);
		}
		parts.push(`Category: ${node.category}`);
		parts.push(`People: ${node.personCount}`);
		if (node.children.length > 0) {
			parts.push(`Children: ${node.children.length}`);
		}
		return parts.join('\n');
	}

	/**
	 * Truncate name for display
	 */
	private truncateName(name: string, maxLength: number): string {
		if (name.length <= maxLength) return name;
		return name.substring(0, maxLength - 1) + '…';
	}

	/**
	 * Render the legend
	 */
	private renderLegend(container: HTMLElement): void {
		const legend = container.createDiv({ cls: 'crc-network-legend' });

		if (this.colorMode === 'category') {
			const categories: PlaceCategory[] = ['real', 'historical', 'disputed', 'legendary', 'mythological', 'fictional'];
			for (const cat of categories) {
				const item = legend.createDiv({ cls: 'crc-network-legend-item' });
				const dot = item.createSpan({ cls: 'crc-network-legend-dot' });
				dot.style.backgroundColor = this.getCategoryColor(cat);
				item.createSpan({ text: cat.charAt(0).toUpperCase() + cat.slice(1) });
			}
		} else if (this.colorMode === 'type') {
			const types = ['country', 'state', 'city', 'town', 'village'];
			for (const type of types) {
				const item = legend.createDiv({ cls: 'crc-network-legend-item' });
				const dot = item.createSpan({ cls: 'crc-network-legend-dot' });
				dot.style.backgroundColor = this.getTypeColor(type);
				item.createSpan({ text: type.charAt(0).toUpperCase() + type.slice(1) });
			}
		} else {
			const gradientItem = legend.createDiv({ cls: 'crc-network-legend-item' });
			gradientItem.createSpan({ cls: 'crc-network-legend-gradient' });
			gradientItem.appendText(' Shallow → Deep');
		}

		// Size explanation
		const sizeExplanation = legend.createDiv({ cls: 'crc-network-legend-item crc-mt-2' });
		sizeExplanation.createSpan({ cls: 'crc-text--muted', text: 'Node size indicates number of associated people' });
	}

	/**
	 * Add tooltip handler for nodes and migration flows
	 */
	private addTooltipHandler(container: HTMLElement): void {
		const tooltip = container.createDiv({ cls: 'crc-network-tooltip cr-hidden' });

		// Handler for nodes
		const nodes = container.querySelectorAll('.crc-network-node');
		nodes.forEach((node) => {
			node.addEventListener('mouseenter', (e: Event) => {
				const target = e.currentTarget as SVGGElement;
				const text = target.getAttribute('data-tooltip');
				if (text) {
					tooltip.empty();
					text.split('\n').forEach((line, i) => {
						if (i > 0) tooltip.createEl('br');
						tooltip.appendText(line);
					});
					tooltip.removeClass('cr-hidden');
				}
			});

			node.addEventListener('mousemove', (e: Event) => {
				const event = e as MouseEvent;
				const rect = container.getBoundingClientRect();
				tooltip.style.left = `${event.clientX - rect.left + 15}px`;
				tooltip.style.top = `${event.clientY - rect.top - 10}px`;
			});

			node.addEventListener('mouseleave', () => {
				tooltip.addClass('cr-hidden');
			});
		});

		// Handler for migration flows
		const flows = container.querySelectorAll('.crc-migration-flow');
		flows.forEach((flow) => {
			flow.addEventListener('mouseenter', (e: Event) => {
				const target = e.currentTarget as SVGPathElement;
				const text = target.getAttribute('data-tooltip');
				if (text) {
					tooltip.textContent = text;
					tooltip.removeClass('cr-hidden');
				}
			});

			flow.addEventListener('mousemove', (e: Event) => {
				const event = e as MouseEvent;
				const rect = container.getBoundingClientRect();
				tooltip.style.left = `${event.clientX - rect.left + 15}px`;
				tooltip.style.top = `${event.clientY - rect.top - 10}px`;
			});

			flow.addEventListener('mouseleave', () => {
				tooltip.addClass('cr-hidden');
			});
		});
	}
}
