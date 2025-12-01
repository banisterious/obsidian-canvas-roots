/**
 * Canvas Style Customization Modal
 *
 * Modal for customizing per-canvas style settings.
 * Reads existing style overrides from canvas metadata and allows editing.
 */

import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../main';
import type { ArrowStyle, ColorScheme, CanvasColor, SpouseEdgeLabelFormat } from '../settings';
import type { StyleOverrides } from '../core/canvas-style-overrides';
import type { CanvasData } from '../core/canvas-generator';
import { getLogger } from '../core/logging';

const logger = getLogger('CanvasStyleModal');

export class CanvasStyleModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private canvasFile: TFile;
	private currentOverrides?: StyleOverrides;

	constructor(app: App, plugin: CanvasRootsPlugin, canvasFile: TFile) {
		super(app);
		this.plugin = plugin;
		this.canvasFile = canvasFile;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Customize canvas styles' });

		// Load current metadata
		try {
			const canvasContent = await this.app.vault.read(this.canvasFile);
			const canvasData: CanvasData = JSON.parse(canvasContent);
			const metadata = canvasData.metadata?.frontmatter;

			if (metadata?.plugin === 'canvas-roots') {
				this.currentOverrides = metadata.styleOverrides as StyleOverrides | undefined;
			}
		} catch (error: unknown) {
			logger.error('style-modal', 'Failed to read canvas metadata', error);
		}

		// Description
		contentEl.createEl('p', {
			text: 'Customize styles for this canvas. Changes will be applied when you regenerate the canvas.',
			cls: 'setting-item-description'
		});

		// Global settings notice
		contentEl.createEl('p', {
			text: `Current global settings will be used for any options left at their default. Toggle individual settings to override them for this canvas only.`,
			cls: 'setting-item-description'
		});

		// Style controls
		let nodeColorScheme: ColorScheme | undefined = this.currentOverrides?.nodeColorScheme;
		let parentChildArrowStyle: ArrowStyle | undefined = this.currentOverrides?.parentChildArrowStyle;
		let spouseArrowStyle: ArrowStyle | undefined = this.currentOverrides?.spouseArrowStyle;
		let parentChildEdgeColor: CanvasColor | undefined = this.currentOverrides?.parentChildEdgeColor;
		let spouseEdgeColor: CanvasColor | undefined = this.currentOverrides?.spouseEdgeColor;
		let showSpouseEdges: boolean | undefined = this.currentOverrides?.showSpouseEdges;
		let spouseEdgeLabelFormat: SpouseEdgeLabelFormat | undefined = this.currentOverrides?.spouseEdgeLabelFormat;

		// Node color scheme
		new Setting(contentEl)
			.setName('Node coloring')
			.setDesc('Color scheme for person nodes')
			.addDropdown(dropdown => {
				dropdown
					.addOption('', '(Use global setting)')
					.addOption('gender', 'Gender (green/purple)')
					.addOption('generation', 'Generation (gradient)')
					.addOption('collection', 'Collection (multi-color)')
					.addOption('monochrome', 'Monochrome (neutral)')
					.setValue(nodeColorScheme || '')
					.onChange(value => {
						nodeColorScheme = value ? value as ColorScheme : undefined;
					});
			});

		// Parent-child arrow style
		new Setting(contentEl)
			.setName('Parent-child arrows')
			.setDesc('Arrow style for parent-child relationships')
			.addDropdown(dropdown => {
				dropdown
					.addOption('', '(Use global setting)')
					.addOption('directed', 'Directed (→)')
					.addOption('bidirectional', 'Bidirectional (↔)')
					.addOption('undirected', 'Undirected (—)')
					.setValue(parentChildArrowStyle || '')
					.onChange(value => {
						parentChildArrowStyle = value ? value as ArrowStyle : undefined;
					});
			});

		// Spouse arrow style
		new Setting(contentEl)
			.setName('Spouse arrows')
			.setDesc('Arrow style for spouse relationships')
			.addDropdown(dropdown => {
				dropdown
					.addOption('', '(Use global setting)')
					.addOption('directed', 'Directed (→)')
					.addOption('bidirectional', 'Bidirectional (↔)')
					.addOption('undirected', 'Undirected (—)')
					.setValue(spouseArrowStyle || '')
					.onChange(value => {
						spouseArrowStyle = value ? value as ArrowStyle : undefined;
					});
			});

		// Parent-child edge color
		new Setting(contentEl)
			.setName('Parent-child edge color')
			.setDesc('Color for parent-child relationship edges')
			.addDropdown(dropdown => {
				dropdown
					.addOption('', '(Use global setting)')
					.addOption('none', 'Theme default')
					.addOption('1', 'Red')
					.addOption('2', 'Orange')
					.addOption('3', 'Yellow')
					.addOption('4', 'Green')
					.addOption('5', 'Cyan')
					.addOption('6', 'Purple')
					.setValue(parentChildEdgeColor || '')
					.onChange(value => {
						parentChildEdgeColor = value ? value as CanvasColor : undefined;
					});
			});

		// Spouse edge color
		new Setting(contentEl)
			.setName('Spouse edge color')
			.setDesc('Color for spouse relationship edges')
			.addDropdown(dropdown => {
				dropdown
					.addOption('', '(Use global setting)')
					.addOption('none', 'Theme default')
					.addOption('1', 'Red')
					.addOption('2', 'Orange')
					.addOption('3', 'Yellow')
					.addOption('4', 'Green')
					.addOption('5', 'Cyan')
					.addOption('6', 'Purple')
					.setValue(spouseEdgeColor || '')
					.onChange(value => {
						spouseEdgeColor = value ? value as CanvasColor : undefined;
					});
			});

		// Show spouse edges
		new Setting(contentEl)
			.setName('Show spouse edges')
			.setDesc('Display marriage relationship edges on canvas')
			.addDropdown(dropdown => {
				dropdown
					.addOption('', '(Use global setting)')
					.addOption('true', 'Enabled')
					.addOption('false', 'Disabled')
					.setValue(showSpouseEdges === undefined ? '' : String(showSpouseEdges))
					.onChange(value => {
						showSpouseEdges = value === '' ? undefined : value === 'true';
					});
			});

		// Spouse label format
		new Setting(contentEl)
			.setName('Spouse edge labels')
			.setDesc('Label format for spouse relationship edges')
			.addDropdown(dropdown => {
				dropdown
					.addOption('', '(Use global setting)')
					.addOption('none', 'None')
					.addOption('date-only', 'Date only')
					.addOption('date-location', 'Date + location')
					.addOption('full', 'Full (date + location + status)')
					.setValue(spouseEdgeLabelFormat || '')
					.onChange(value => {
						spouseEdgeLabelFormat = value ? value as SpouseEdgeLabelFormat : undefined;
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
				nodeColorScheme,
				parentChildArrowStyle,
				spouseArrowStyle,
				parentChildEdgeColor,
				spouseEdgeColor,
				showSpouseEdges,
				spouseEdgeLabelFormat
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

	private async saveStyleOverrides(overrides: StyleOverrides): Promise<void> {
		try {
			// Read current canvas data
			const canvasContent = await this.app.vault.read(this.canvasFile);
			const canvasData: CanvasData = JSON.parse(canvasContent);

			// Ensure metadata structure exists
			if (!canvasData.metadata) {
				canvasData.metadata = { version: '1.0-1.0', frontmatter: {} };
			}
			if (!canvasData.metadata.frontmatter) {
				canvasData.metadata.frontmatter = {};
			}

			// Update style overrides in metadata
			const metadata = canvasData.metadata.frontmatter;

			// If all overrides are undefined, remove styleOverrides entirely
			const hasOverrides = Object.values(overrides).some(value => value !== undefined);
			if (hasOverrides) {
				metadata.styleOverrides = overrides;
				logger.info('style-modal', 'Saving style overrides', overrides);
			} else {
				delete metadata.styleOverrides;
				logger.info('style-modal', 'Clearing all style overrides');
			}

			// Format and save canvas JSON
			const formattedJson = this.formatCanvasJson(canvasData);
			await this.app.vault.modify(this.canvasFile, formattedJson);

			new Notice('Canvas styles updated! Regenerate the canvas to see changes.');
			this.close();
		} catch (error: unknown) {
			logger.error('style-modal', 'Failed to save style overrides', error);
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
		lines.push('\t],');

		// Metadata
		lines.push('\t"metadata":{');
		if (data.metadata?.version) {
			lines.push(`\t\t"version":"${data.metadata.version}",`);
		}
		const frontmatter = data.metadata?.frontmatter || {};
		lines.push(`\t\t"frontmatter":${safeStringify(frontmatter)}`);
		lines.push('\t}');

		lines.push('}');

		return lines.join('\n');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
