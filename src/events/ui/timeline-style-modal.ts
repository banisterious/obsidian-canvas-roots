/**
 * Timeline Style Customization Modal
 *
 * Modal for customizing per-timeline canvas style settings.
 * Reads existing style overrides from canvas metadata and allows editing.
 */

import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { CanvasColor } from '../../settings';
import type { TimelineColorScheme, TimelineLayoutStyle } from '../services/timeline-canvas-exporter';
import type { TimelineStyleOverrides, TimelineCanvasMetadata } from '../services/timeline-style-overrides';
import { TIMELINE_STYLE_DEFAULTS } from '../services/timeline-style-overrides';
import { getLogger } from '../../core/logging';

const logger = getLogger('TimelineStyleModal');

interface CanvasData {
	nodes: unknown[];
	edges: unknown[];
	metadata?: {
		version?: string;
		frontmatter?: {
			'canvas-roots'?: TimelineCanvasMetadata;
		};
	};
}

export class TimelineStyleModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private canvasFile: TFile;
	private currentOverrides?: TimelineStyleOverrides;
	private currentMetadata?: TimelineCanvasMetadata;

	constructor(app: App, plugin: CanvasRootsPlugin, canvasFile: TFile) {
		super(app);
		this.plugin = plugin;
		this.canvasFile = canvasFile;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-timeline-style-modal');

		contentEl.createEl('h2', { text: 'Customize timeline styles' });

		// Load current metadata
		try {
			const canvasContent = await this.app.vault.read(this.canvasFile);
			const canvasData: CanvasData = JSON.parse(canvasContent);
			const metadata = canvasData.metadata?.frontmatter?.['canvas-roots'];

			if (metadata?.type === 'timeline-export') {
				this.currentMetadata = metadata;
				this.currentOverrides = metadata.styleOverrides;
			}
		} catch (error: unknown) {
			logger.error('style-modal', 'Failed to read canvas metadata', error);
		}

		// Description
		contentEl.createEl('p', {
			text: 'Customize styles for this timeline canvas. Changes will be applied when you regenerate the timeline.',
			cls: 'setting-item-description'
		});

		// Current settings info
		if (this.currentMetadata) {
			const infoEl = contentEl.createDiv({ cls: 'cr-timeline-info' });
			infoEl.createEl('p', {
				text: `Events: ${this.currentMetadata.eventCount} • Layout: ${this.currentMetadata.layoutStyle} • Color: ${this.currentMetadata.colorScheme}`,
				cls: 'setting-item-description'
			});
			if (this.currentMetadata.filterPerson || this.currentMetadata.filterEventType) {
				const filters: string[] = [];
				if (this.currentMetadata.filterPerson) {
					filters.push(`Person: ${this.currentMetadata.filterPerson.replace(/^\[\[|\]\]$/g, '')}`);
				}
				if (this.currentMetadata.filterEventType) {
					filters.push(`Type: ${this.currentMetadata.filterEventType}`);
				}
				infoEl.createEl('p', {
					text: `Filters: ${filters.join(', ')}`,
					cls: 'setting-item-description'
				});
			}
		}

		// Style controls
		let colorScheme: TimelineColorScheme | undefined = this.currentOverrides?.colorScheme;
		let layoutStyle: TimelineLayoutStyle | undefined = this.currentOverrides?.layoutStyle;
		let nodeWidth: number | undefined = this.currentOverrides?.nodeWidth;
		let nodeHeight: number | undefined = this.currentOverrides?.nodeHeight;
		let spacingX: number | undefined = this.currentOverrides?.spacingX;
		let spacingY: number | undefined = this.currentOverrides?.spacingY;
		let includeOrderingEdges: boolean | undefined = this.currentOverrides?.includeOrderingEdges;
		let groupByPerson: boolean | undefined = this.currentOverrides?.groupByPerson;
		let orderingEdgeColor: CanvasColor | undefined = this.currentOverrides?.orderingEdgeColor;

		// Color scheme
		new Setting(contentEl)
			.setName('Color scheme')
			.setDesc('How to color event nodes')
			.addDropdown(dropdown => {
				dropdown
					.addOption('', `(Default: ${TIMELINE_STYLE_DEFAULTS.colorScheme})`)
					.addOption('event_type', 'Event type')
					.addOption('category', 'Category (core/extended/narrative)')
					.addOption('confidence', 'Confidence level')
					.addOption('monochrome', 'No color')
					.setValue(colorScheme || '')
					.onChange(value => {
						colorScheme = value ? value as TimelineColorScheme : undefined;
					});
			});

		// Layout style
		new Setting(contentEl)
			.setName('Layout style')
			.setDesc('How to arrange events on the canvas')
			.addDropdown(dropdown => {
				dropdown
					.addOption('', `(Default: ${TIMELINE_STYLE_DEFAULTS.layoutStyle})`)
					.addOption('horizontal', 'Horizontal (left to right)')
					.addOption('vertical', 'Vertical (top to bottom)')
					.addOption('gantt', 'Gantt (by date and person)')
					.setValue(layoutStyle || '')
					.onChange(value => {
						layoutStyle = value ? value as TimelineLayoutStyle : undefined;
					});
			});

		// Node dimensions section
		contentEl.createEl('h3', { text: 'Node dimensions', cls: 'setting-item-heading' });

		// Node width
		new Setting(contentEl)
			.setName('Node width')
			.setDesc(`Width of event nodes in pixels (default: ${TIMELINE_STYLE_DEFAULTS.nodeWidth})`)
			.addText(text => {
				text
					.setPlaceholder(String(TIMELINE_STYLE_DEFAULTS.nodeWidth))
					.setValue(nodeWidth !== undefined ? String(nodeWidth) : '')
					.onChange(value => {
						const num = parseInt(value, 10);
						nodeWidth = !isNaN(num) && num > 0 ? num : undefined;
					});
			});

		// Node height
		new Setting(contentEl)
			.setName('Node height')
			.setDesc(`Height of event nodes in pixels (default: ${TIMELINE_STYLE_DEFAULTS.nodeHeight})`)
			.addText(text => {
				text
					.setPlaceholder(String(TIMELINE_STYLE_DEFAULTS.nodeHeight))
					.setValue(nodeHeight !== undefined ? String(nodeHeight) : '')
					.onChange(value => {
						const num = parseInt(value, 10);
						nodeHeight = !isNaN(num) && num > 0 ? num : undefined;
					});
			});

		// Spacing section
		contentEl.createEl('h3', { text: 'Spacing', cls: 'setting-item-heading' });

		// Horizontal spacing
		new Setting(contentEl)
			.setName('Horizontal spacing')
			.setDesc(`Space between nodes horizontally in pixels (default: ${TIMELINE_STYLE_DEFAULTS.spacingX})`)
			.addText(text => {
				text
					.setPlaceholder(String(TIMELINE_STYLE_DEFAULTS.spacingX))
					.setValue(spacingX !== undefined ? String(spacingX) : '')
					.onChange(value => {
						const num = parseInt(value, 10);
						spacingX = !isNaN(num) && num >= 0 ? num : undefined;
					});
			});

		// Vertical spacing
		new Setting(contentEl)
			.setName('Vertical spacing')
			.setDesc(`Space between nodes vertically in pixels (default: ${TIMELINE_STYLE_DEFAULTS.spacingY})`)
			.addText(text => {
				text
					.setPlaceholder(String(TIMELINE_STYLE_DEFAULTS.spacingY))
					.setValue(spacingY !== undefined ? String(spacingY) : '')
					.onChange(value => {
						const num = parseInt(value, 10);
						spacingY = !isNaN(num) && num >= 0 ? num : undefined;
					});
			});

		// Options section
		contentEl.createEl('h3', { text: 'Options', cls: 'setting-item-heading' });

		// Include ordering edges
		new Setting(contentEl)
			.setName('Show ordering edges')
			.setDesc('Display edges for before/after relationships between events')
			.addDropdown(dropdown => {
				dropdown
					.addOption('', `(Default: ${TIMELINE_STYLE_DEFAULTS.includeOrderingEdges ? 'Enabled' : 'Disabled'})`)
					.addOption('true', 'Enabled')
					.addOption('false', 'Disabled')
					.setValue(includeOrderingEdges === undefined ? '' : String(includeOrderingEdges))
					.onChange(value => {
						includeOrderingEdges = value === '' ? undefined : value === 'true';
					});
			});

		// Group by person
		new Setting(contentEl)
			.setName('Group by person')
			.setDesc('Organize events into swimlanes by person')
			.addDropdown(dropdown => {
				dropdown
					.addOption('', `(Default: ${TIMELINE_STYLE_DEFAULTS.groupByPerson ? 'Enabled' : 'Disabled'})`)
					.addOption('true', 'Enabled')
					.addOption('false', 'Disabled')
					.setValue(groupByPerson === undefined ? '' : String(groupByPerson))
					.onChange(value => {
						groupByPerson = value === '' ? undefined : value === 'true';
					});
			});

		// Ordering edge color
		new Setting(contentEl)
			.setName('Ordering edge color')
			.setDesc('Color for before/after relationship edges')
			.addDropdown(dropdown => {
				dropdown
					.addOption('', '(Default: Theme default)')
					.addOption('none', 'Theme default')
					.addOption('1', 'Red')
					.addOption('2', 'Orange')
					.addOption('3', 'Yellow')
					.addOption('4', 'Green')
					.addOption('5', 'Cyan')
					.addOption('6', 'Purple')
					.setValue(orderingEdgeColor || '')
					.onChange(value => {
						orderingEdgeColor = value ? value as CanvasColor : undefined;
					});
			});

		// Action buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		// Save button
		buttonContainer.createEl('button', {
			text: 'Save styles',
			cls: 'mod-cta'
		}).addEventListener('click', () => {
			void this.saveStyleOverrides({
				colorScheme,
				layoutStyle,
				nodeWidth,
				nodeHeight,
				spacingX,
				spacingY,
				includeOrderingEdges,
				groupByPerson,
				orderingEdgeColor
			});
		});

		// Clear all button
		buttonContainer.createEl('button', {
			text: 'Clear all overrides'
		}).addEventListener('click', () => {
			void this.saveStyleOverrides({});
		});

		// Cancel button
		buttonContainer.createEl('button', {
			text: 'Cancel'
		}).addEventListener('click', () => {
			this.close();
		});
	}

	private async saveStyleOverrides(overrides: TimelineStyleOverrides): Promise<void> {
		try {
			// Read current canvas data
			const canvasContent = await this.app.vault.read(this.canvasFile);
			const canvasData: CanvasData = JSON.parse(canvasContent);

			// Ensure metadata structure exists
			if (!canvasData.metadata) {
				canvasData.metadata = { version: '1.0', frontmatter: {} };
			}
			if (!canvasData.metadata.frontmatter) {
				canvasData.metadata.frontmatter = {};
			}
			if (!canvasData.metadata.frontmatter['canvas-roots']) {
				// Create default metadata if missing
				canvasData.metadata.frontmatter['canvas-roots'] = {
					type: 'timeline-export',
					exportedAt: Date.now(),
					eventCount: 0,
					colorScheme: 'event_type',
					layoutStyle: 'horizontal'
				};
			}

			// Update style overrides in metadata
			const metadata = canvasData.metadata.frontmatter['canvas-roots'];

			// If all overrides are undefined, remove styleOverrides entirely
			const hasOverrides = Object.values(overrides).some(value => value !== undefined);
			if (hasOverrides) {
				metadata.styleOverrides = overrides;
				logger.info('style-modal', 'Saving timeline style overrides', overrides);
			} else {
				delete metadata.styleOverrides;
				logger.info('style-modal', 'Clearing all timeline style overrides');
			}

			// Format and save canvas JSON
			const formattedJson = this.formatCanvasJson(canvasData);
			await this.app.vault.modify(this.canvasFile, formattedJson);

			new Notice('Timeline styles updated! Regenerate the timeline to see changes.');
			this.close();
		} catch (error: unknown) {
			logger.error('style-modal', 'Failed to save timeline style overrides', error);
			new Notice('Failed to save style overrides. Check console for details.');
		}
	}

	/**
	 * Format canvas JSON to match Obsidian's exact format
	 */
	private formatCanvasJson(data: CanvasData): string {
		// Helper to safely stringify handling circular references
		const safeStringify = (obj: unknown): string => {
			const seen = new WeakSet();
			return JSON.stringify(obj, (_key, value) => {
				if (typeof value === 'object' && value !== null) {
					if (seen.has(value)) {
						return '[Circular]';
					}
					seen.add(value);
				}
				return value;
			});
		};

		const lines: string[] = [];
		lines.push('{');

		// Nodes
		lines.push('\t"nodes":[');
		data.nodes.forEach((node, i) => {
			const isLast = i === data.nodes.length - 1;
			const nodeStr = safeStringify(node);
			lines.push(`\t\t${nodeStr}${isLast ? '' : ','}`);
		});
		lines.push('\t],');

		// Edges
		lines.push('\t"edges":[');
		data.edges.forEach((edge, i) => {
			const isLast = i === data.edges.length - 1;
			const edgeStr = safeStringify(edge);
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

	onClose(): void {
		this.contentEl.empty();
	}
}
