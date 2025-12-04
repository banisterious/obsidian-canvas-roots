/**
 * Migration Flow Diagram Modal
 * Visualizes migration patterns (birth place -> death place) as an arc diagram
 */

import { App, Modal } from 'obsidian';
import { createLucideIcon } from './lucide-icons';
import { PlaceGraphService } from '../core/place-graph';

interface DetailedMigration {
	personId: string;
	from: string;
	to: string;
	birthYear?: number;
	deathYear?: number;
	collection?: string;
}

interface MigrationFlow {
	from: string;
	to: string;
	count: number;
}

interface PlaceData {
	name: string;
	birthCount: number;
	deathCount: number;
	x?: number;
}

/**
 * Modal displaying a migration flow diagram
 */
export class MigrationDiagramModal extends Modal {
	private placeService: PlaceGraphService;
	private allMigrations: DetailedMigration[];
	private yearRange: { min: number; max: number } | null;
	private maxHierarchyDepth: number;
	private collections: Array<{ name: string; count: number }>;
	private minFlowCount: number = 1;
	private startYear: number | null = null;
	private endYear: number | null = null;
	private aggregationLevel: number = -1; // -1 = no aggregation (show all places as-is)
	private collectionFilter: string | null = null; // null = all collections
	private diagramContainer: HTMLElement | null = null;

	constructor(app: App) {
		super(app);
		this.placeService = new PlaceGraphService(app);
		this.placeService.reloadCache();

		// Get detailed migration data with years
		this.allMigrations = this.placeService.getDetailedMigrations();
		this.yearRange = this.placeService.getMigrationYearRange();
		this.maxHierarchyDepth = this.placeService.getMaxHierarchyDepth();
		this.collections = this.placeService.getMigrationCollections();

		// Set initial year range if available
		if (this.yearRange) {
			this.startYear = this.yearRange.min;
			this.endYear = this.yearRange.max;
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-migration-diagram-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('arrow-right', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Migration patterns');

		// Description
		contentEl.createEl('p', {
			text: 'Visualizing migration flows from birth locations to death locations.',
			cls: 'crc-text--muted'
		});

		if (this.allMigrations.length === 0) {
			contentEl.createEl('p', {
				text: 'No migration patterns found. People must have different birth and death places to show migration.',
				cls: 'crc-text--muted crc-mt-3'
			});
			return;
		}

		// Controls container
		const controlsContainer = contentEl.createDiv({ cls: 'crc-migration-controls-container' });

		// Row 1: Minimum people filter
		const controlsRow1 = controlsContainer.createDiv({ cls: 'crc-migration-controls' });
		controlsRow1.createEl('span', { text: 'Minimum people: ', cls: 'crc-text--muted' });

		const slider = controlsRow1.createEl('input', {
			type: 'range',
			cls: 'crc-migration-slider'
		});
		slider.min = '1';
		slider.max = String(this.getMaxFlowCount());
		slider.value = '1';

		const countLabel = controlsRow1.createEl('span', {
			text: '1',
			cls: 'crc-migration-count-label'
		});

		// Row 2: Time period filter (only if we have year data)
		if (this.yearRange) {
			const controlsRow2 = controlsContainer.createDiv({ cls: 'crc-migration-controls crc-migration-time-controls' });
			controlsRow2.createEl('span', { text: 'Time period: ', cls: 'crc-text--muted' });

			// Start year input
			const startInput = controlsRow2.createEl('input', {
				type: 'number',
				cls: 'crc-migration-year-input',
				placeholder: String(this.yearRange.min)
			});
			startInput.value = String(this.yearRange.min);
			startInput.min = String(this.yearRange.min);
			startInput.max = String(this.yearRange.max);

			controlsRow2.createEl('span', { text: ' – ', cls: 'crc-text--muted' });

			// End year input
			const endInput = controlsRow2.createEl('input', {
				type: 'number',
				cls: 'crc-migration-year-input',
				placeholder: String(this.yearRange.max)
			});
			endInput.value = String(this.yearRange.max);
			endInput.min = String(this.yearRange.min);
			endInput.max = String(this.yearRange.max);

			// Year range info
			controlsRow2.createEl('span', {
				text: `(data spans ${this.yearRange.min}–${this.yearRange.max})`,
				cls: 'crc-text--muted crc-migration-year-info'
			});

			// Handle year input changes
			const updateYears = () => {
				const start = parseInt(startInput.value) || this.yearRange!.min;
				const end = parseInt(endInput.value) || this.yearRange!.max;
				this.startYear = Math.max(this.yearRange!.min, Math.min(start, end));
				this.endYear = Math.min(this.yearRange!.max, Math.max(start, end));
				this.renderDiagram();
			};

			startInput.addEventListener('change', updateYears);
			endInput.addEventListener('change', updateYears);

			// Quick preset buttons
			const presetsRow = controlsContainer.createDiv({ cls: 'crc-migration-presets' });
			presetsRow.createEl('span', { text: 'Presets: ', cls: 'crc-text--muted' });

			const presetContainer = presetsRow.createDiv({ cls: 'crc-migration-preset-buttons' });

			// Generate century presets based on data range
			const startCentury = Math.floor(this.yearRange.min / 100) * 100;
			const endCentury = Math.floor(this.yearRange.max / 100) * 100;

			for (let century = startCentury; century <= endCentury; century += 100) {
				const centuryEnd = century + 99;
				// Only show if there's data in this century
				const hasMigrations = this.allMigrations.some(m => {
					const year = m.birthYear || m.deathYear;
					return year && year >= century && year <= centuryEnd;
				});

				if (hasMigrations) {
					const btn = presetContainer.createEl('button', {
						text: `${century}s`,
						cls: 'crc-btn crc-btn--small'
					});
					btn.addEventListener('click', () => {
						this.startYear = Math.max(this.yearRange!.min, century);
						this.endYear = Math.min(this.yearRange!.max, centuryEnd);
						startInput.value = String(this.startYear);
						endInput.value = String(this.endYear);
						this.renderDiagram();
					});
				}
			}

			// "All" preset
			const allBtn = presetContainer.createEl('button', {
				text: 'All',
				cls: 'crc-btn crc-btn--small'
			});
			allBtn.addEventListener('click', () => {
				this.startYear = this.yearRange!.min;
				this.endYear = this.yearRange!.max;
				startInput.value = String(this.startYear);
				endInput.value = String(this.endYear);
				this.renderDiagram();
			});
		}

		// Row 3: Aggregation level (only if we have place hierarchy)
		if (this.maxHierarchyDepth > 1) {
			const controlsRow3 = controlsContainer.createDiv({ cls: 'crc-migration-controls crc-migration-aggregation-controls' });
			controlsRow3.createEl('span', { text: 'Group by: ', cls: 'crc-text--muted' });

			const aggregationSelect = controlsRow3.createEl('select', {
				cls: 'crc-migration-aggregation-select dropdown'
			});

			// "No grouping" option
			aggregationSelect.createEl('option', {
				text: 'No grouping (show all places)',
				value: '-1'
			});

			// Add level options based on hierarchy depth
			const levelLabels = ['Country/Root', 'State/Region', 'County', 'City/Town', 'District', 'Locality'];
			for (let level = 0; level < Math.min(this.maxHierarchyDepth, levelLabels.length); level++) {
				aggregationSelect.createEl('option', {
					text: levelLabels[level],
					value: String(level)
				});
			}

			aggregationSelect.value = '-1';
			aggregationSelect.addEventListener('change', () => {
				this.aggregationLevel = parseInt(aggregationSelect.value);
				this.renderDiagram();
			});

			// Add help text
			controlsRow3.createEl('span', {
				text: '(aggregates places by hierarchy level)',
				cls: 'crc-text--muted crc-migration-aggregation-help'
			});
		}

		// Row 4: Collection filter (only if we have collections)
		if (this.collections.length > 0) {
			const controlsRow4 = controlsContainer.createDiv({ cls: 'crc-migration-controls crc-migration-collection-controls' });
			controlsRow4.createEl('span', { text: 'Collection: ', cls: 'crc-text--muted' });

			const collectionSelect = controlsRow4.createEl('select', {
				cls: 'crc-migration-collection-select dropdown'
			});

			// "All collections" option
			collectionSelect.createEl('option', {
				text: 'All collections',
				value: ''
			});

			// Add collection options
			for (const collection of this.collections) {
				collectionSelect.createEl('option', {
					text: `${collection.name} (${collection.count})`,
					value: collection.name
				});
			}

			collectionSelect.value = '';
			collectionSelect.addEventListener('change', () => {
				this.collectionFilter = collectionSelect.value || null;
				this.renderDiagram();
			});

			// Add help text
			controlsRow4.createEl('span', {
				text: '(filter by family branch)',
				cls: 'crc-text--muted crc-migration-collection-help'
			});
		}

		// Diagram container
		this.diagramContainer = contentEl.createDiv({ cls: 'crc-migration-diagram' });

		// Initial render
		this.renderDiagram();

		// Update on slider change
		slider.addEventListener('input', () => {
			this.minFlowCount = parseInt(slider.value);
			countLabel.textContent = slider.value;
			this.renderDiagram();
		});

		// Legend
		const legend = contentEl.createDiv({ cls: 'crc-migration-legend' });
		const birthItem = legend.createEl('div', { cls: 'crc-migration-legend-item' });
		birthItem.createSpan({ cls: 'crc-migration-legend-dot crc-migration-legend-dot--birth' });
		birthItem.appendText(' Birth location');

		const deathItem = legend.createEl('div', { cls: 'crc-migration-legend-item' });
		deathItem.createSpan({ cls: 'crc-migration-legend-dot crc-migration-legend-dot--death' });
		deathItem.appendText(' Death location');

		const flowItem = legend.createEl('div', { cls: 'crc-migration-legend-item' });
		flowItem.createSpan({ cls: 'crc-migration-legend-line' });
		flowItem.appendText(' Migration flow (thicker = more people)');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Get the maximum flow count for the slider
	 */
	private getMaxFlowCount(): number {
		const flows = this.aggregateMigrations(this.allMigrations);
		if (flows.length === 0) return 1;
		return Math.max(...flows.map(f => f.count));
	}

	/**
	 * Filter migrations by time period
	 */
	private filterByTimePeriod(migrations: DetailedMigration[]): DetailedMigration[] {
		if (this.startYear === null || this.endYear === null) {
			return migrations;
		}

		return migrations.filter(m => {
			// Use birth year primarily, fall back to death year
			const year = m.birthYear || m.deathYear;
			if (!year) return true; // Include migrations without year data
			return year >= this.startYear! && year <= this.endYear!;
		});
	}

	/**
	 * Filter migrations by collection (family branch)
	 */
	private filterByCollection(migrations: DetailedMigration[]): DetailedMigration[] {
		if (this.collectionFilter === null) {
			return migrations;
		}

		return migrations.filter(m => m.collection === this.collectionFilter);
	}

	/**
	 * Apply aggregation level to a place name
	 * Resolves the place to its ancestor at the specified level
	 */
	private applyAggregation(placeName: string): string {
		if (this.aggregationLevel < 0) {
			return placeName;
		}
		return this.placeService.resolveToAncestorLevel(placeName, this.aggregationLevel);
	}

	/**
	 * Aggregate individual migrations into flow counts
	 */
	private aggregateMigrations(migrations: DetailedMigration[]): MigrationFlow[] {
		const counts = new Map<string, number>();

		for (const m of migrations) {
			// Apply aggregation level to both from and to places
			const from = this.applyAggregation(m.from);
			const to = this.applyAggregation(m.to);

			// Skip if aggregation results in same place (no actual migration)
			if (from === to) continue;

			const key = `${from}|${to}`;
			counts.set(key, (counts.get(key) || 0) + 1);
		}

		return Array.from(counts.entries())
			.map(([key, count]) => {
				const [from, to] = key.split('|');
				return { from, to, count };
			})
			.sort((a, b) => b.count - a.count);
	}

	/**
	 * Render the migration diagram as an arc diagram
	 */
	private renderDiagram(): void {
		if (!this.diagramContainer) return;

		const container = this.diagramContainer;
		container.empty();

		// Apply all filters
		let filteredMigrations = this.allMigrations;
		filteredMigrations = this.filterByTimePeriod(filteredMigrations);
		filteredMigrations = this.filterByCollection(filteredMigrations);

		// Aggregate into flows
		const allFlows = this.aggregateMigrations(filteredMigrations);

		// Filter flows by minimum count
		const flows = allFlows.filter(f => f.count >= this.minFlowCount);

		if (flows.length === 0) {
			container.createEl('p', {
				text: 'No migration patterns match the current filters.',
				cls: 'crc-text--muted crc-text--center'
			});
			return;
		}

		// Show filtered count with all active filters
		const shownMigrations = flows.reduce((sum, f) => sum + f.count, 0);
		const filterParts: string[] = [];

		// Add time period info if filtered
		if (this.startYear !== null && this.endYear !== null && this.yearRange) {
			if (this.startYear !== this.yearRange.min || this.endYear !== this.yearRange.max) {
				filterParts.push(`${this.startYear}–${this.endYear}`);
			}
		}

		// Add collection info if filtered
		if (this.collectionFilter !== null) {
			filterParts.push(`collection: ${this.collectionFilter}`);
		}

		if (filterParts.length > 0) {
			container.createEl('p', {
				text: `Showing ${shownMigrations} migrations (${filterParts.join(', ')})`,
				cls: 'crc-text--muted crc-text--center crc-mb-2'
			});
		}

		// Collect unique places and calculate their stats
		const places = new Map<string, PlaceData>();

		for (const flow of flows) {
			if (!places.has(flow.from)) {
				places.set(flow.from, { name: flow.from, birthCount: 0, deathCount: 0 });
			}
			if (!places.has(flow.to)) {
				places.set(flow.to, { name: flow.to, birthCount: 0, deathCount: 0 });
			}
			places.get(flow.from)!.birthCount += flow.count;
			places.get(flow.to)!.deathCount += flow.count;
		}

		// Sort places by total activity
		const sortedPlaces = Array.from(places.values())
			.sort((a, b) => (b.birthCount + b.deathCount) - (a.birthCount + a.deathCount));

		// Calculate layout - ensure minimum spacing per node for readability
		const minNodeSpacing = 80; // Minimum pixels between nodes
		const padding = 60;
		const nodeRadius = 8;
		const labelHeight = 100; // Space for rotated labels below nodes

		// Calculate width based on number of nodes (scrollable if many)
		const minWidth = 600;
		const calculatedWidth = padding * 2 + (sortedPlaces.length - 1) * minNodeSpacing;
		const width = Math.max(minWidth, calculatedWidth);

		// Height for arcs above + nodes + labels below
		const arcSpace = 200;
		const height = arcSpace + nodeRadius * 2 + labelHeight;

		// Assign x positions with fixed spacing
		sortedPlaces.forEach((place, i) => {
			place.x = padding + i * minNodeSpacing;
		});

		// Create SVG
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('width', String(width));
		svg.setAttribute('height', String(height));
		svg.setAttribute('class', 'crc-migration-svg');

		// Create place index for quick lookup
		const placeIndex = new Map<string, PlaceData>();
		for (const place of sortedPlaces) {
			placeIndex.set(place.name, place);
		}

		// Calculate max flow for scaling
		const maxFlow = Math.max(...flows.map(f => f.count));

		// Draw arcs for each migration flow
		// Position nodes in upper portion to leave room for labels below
		const centerY = arcSpace / 2 + 20;

		for (const flow of flows) {
			const fromPlace = placeIndex.get(flow.from);
			const toPlace = placeIndex.get(flow.to);

			if (!fromPlace || !toPlace || fromPlace.x === undefined || toPlace.x === undefined) continue;

			// Calculate arc
			const x1 = fromPlace.x;
			const x2 = toPlace.x;
			const midX = (x1 + x2) / 2;
			const distance = Math.abs(x2 - x1);
			// Scale curve height based on distance, but cap it
			const curveHeight = Math.min(distance / 2.5, arcSpace / 2 - 20);

			// All arcs go above the nodes (cleaner look)
			const arcY = centerY - curveHeight;

			// Create path
			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			const d = `M ${x1} ${centerY} Q ${midX} ${arcY} ${x2} ${centerY}`;
			path.setAttribute('d', d);
			path.setAttribute('fill', 'none');
			path.setAttribute('stroke', 'var(--text-accent)');
			path.setAttribute('stroke-opacity', String(0.3 + 0.5 * (flow.count / maxFlow)));
			path.setAttribute('stroke-width', String(1 + 4 * (flow.count / maxFlow)));
			path.setAttribute('class', 'crc-migration-arc');

			// Add arrow marker
			const arrowId = `arrow-${Math.random().toString(36).substring(2, 11)}`;
			const defs = svg.querySelector('defs') || svg.insertBefore(
				document.createElementNS('http://www.w3.org/2000/svg', 'defs'),
				svg.firstChild
			);

			const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
			marker.setAttribute('id', arrowId);
			marker.setAttribute('viewBox', '0 0 10 10');
			marker.setAttribute('refX', '8');
			marker.setAttribute('refY', '5');
			marker.setAttribute('markerWidth', '6');
			marker.setAttribute('markerHeight', '6');
			marker.setAttribute('orient', 'auto-start-reverse');

			const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
			arrowPath.setAttribute('fill', 'var(--text-accent)');
			arrowPath.setAttribute('fill-opacity', String(0.3 + 0.5 * (flow.count / maxFlow)));
			marker.appendChild(arrowPath);
			defs.appendChild(marker);

			path.setAttribute('marker-end', `url(#${arrowId})`);

			// Tooltip
			path.setAttribute('data-tooltip', `${flow.from} → ${flow.to}: ${flow.count} ${flow.count === 1 ? 'person' : 'people'}`);

			svg.appendChild(path);
		}

		// Draw place nodes
		for (const place of sortedPlaces) {
			if (place.x === undefined) continue;

			// Node group
			const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
			g.setAttribute('class', 'crc-migration-node');

			// Circle
			const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			circle.setAttribute('cx', String(place.x));
			circle.setAttribute('cy', String(centerY));
			circle.setAttribute('r', String(nodeRadius));

			// Color based on whether it's primarily a birth or death location
			if (place.birthCount > place.deathCount) {
				circle.setAttribute('fill', 'var(--color-green)');
				circle.setAttribute('class', 'crc-migration-node--birth');
			} else if (place.deathCount > place.birthCount) {
				circle.setAttribute('fill', 'var(--color-red)');
				circle.setAttribute('class', 'crc-migration-node--death');
			} else {
				circle.setAttribute('fill', 'var(--text-muted)');
			}
			g.appendChild(circle);

			// Rotated label (45 degrees) - positioned below node
			const labelY = centerY + nodeRadius + 12;
			const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			text.setAttribute('x', String(place.x));
			text.setAttribute('y', String(labelY));
			text.setAttribute('text-anchor', 'start');
			text.setAttribute('transform', `rotate(45, ${place.x}, ${labelY})`);
			text.setAttribute('class', 'crc-migration-label');
			text.textContent = this.truncatePlaceName(place.name, 20);
			g.appendChild(text);

			// Stats on second line (also rotated)
			const statsY = labelY + 12;
			const stats = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			stats.setAttribute('x', String(place.x));
			stats.setAttribute('y', String(statsY));
			stats.setAttribute('text-anchor', 'start');
			stats.setAttribute('transform', `rotate(45, ${place.x}, ${statsY})`);
			stats.setAttribute('class', 'crc-migration-stats');
			stats.textContent = `↑${place.birthCount} ↓${place.deathCount}`;
			g.appendChild(stats);

			svg.appendChild(g);
		}

		container.appendChild(svg);

		// Add tooltip handler
		this.addTooltipHandler(container);
	}

	/**
	 * Truncate place name for display
	 */
	private truncatePlaceName(name: string, maxLength: number): string {
		if (name.length <= maxLength) return name;
		return name.substring(0, maxLength - 1) + '…';
	}

	/**
	 * Add tooltip handler for arcs
	 */
	private addTooltipHandler(container: HTMLElement): void {
		const tooltip = container.createDiv({ cls: 'crc-migration-tooltip cr-hidden' });

		const arcs = container.querySelectorAll('.crc-migration-arc');
		arcs.forEach((arc) => {
			arc.addEventListener('mouseenter', (e: Event) => {
				const target = e.target as SVGPathElement;
				const text = target.getAttribute('data-tooltip');
				if (text) {
					tooltip.textContent = text;
					tooltip.removeClass('cr-hidden');
				}
			});

			arc.addEventListener('mousemove', (e: Event) => {
				const event = e as MouseEvent;
				const rect = container.getBoundingClientRect();
				tooltip.style.left = `${event.clientX - rect.left + 10}px`;
				tooltip.style.top = `${event.clientY - rect.top - 20}px`;
			});

			arc.addEventListener('mouseleave', () => {
				tooltip.addClass('cr-hidden');
			});
		});
	}
}
