import { App, Modal, TFile } from 'obsidian';
import { CanvasData } from 'obsidian/canvas';
import { CanvasNode } from '../models/canvas';

interface TreeStatistics {
	peopleCount: number;
	edgeCount: number;
	rootPerson: string;
	treeType: string;
	maxGenerations: number;
	includeSpouses: boolean;
	direction: string;
	generationDepth: {
		ancestors: number;
		descendants: number;
	};
}

export class TreeStatisticsModal extends Modal {
	private canvasFile: TFile;
	private statistics: TreeStatistics | null = null;

	constructor(app: App, canvasFile: TFile) {
		super(app);
		this.canvasFile = canvasFile;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Set modal title
		this.modalEl.addClass('cr-tree-statistics-modal');
		this.titleEl.setText('Tree statistics');

		// Calculate statistics
		await this.calculateStatistics();

		if (!this.statistics) {
			contentEl.createEl('p', { text: 'Unable to read canvas data.' });
			return;
		}

		// Create statistics display
		this.renderStatistics(contentEl);
	}

	private async calculateStatistics(): Promise<void> {
		try {
			// Read canvas file
			const canvasContent = await this.app.vault.read(this.canvasFile);
			const canvasData: CanvasData = JSON.parse(canvasContent);

			// Extract metadata
			const metadata = canvasData.metadata?.frontmatter;
			const isCanvasRootsTree = metadata?.plugin === 'charted-roots' || metadata?.plugin === 'canvas-roots';

			// Count person nodes (file nodes with .md extension)
			const personNodes = canvasData.nodes.filter(
				(node: CanvasNode) => node.type === 'file' && node.file?.endsWith('.md')
			);

			// Basic statistics
			const peopleCount = personNodes.length;
			const edgeCount = canvasData.edges.length;

			// Extract generation metadata if available
			let rootPerson = 'Unknown';
			let treeType = 'Unknown';
			let maxGenerations = 0;
			let includeSpouses = true;
			let direction = 'vertical';
			let generationDepth = { ancestors: 0, descendants: 0 };

			if (isCanvasRootsTree && metadata.generation) {
				rootPerson = metadata.generation.rootPersonName || 'Unknown';
				treeType = this.formatTreeType(metadata.generation.treeType);
				maxGenerations = metadata.generation.maxGenerations || 0;
				includeSpouses = metadata.generation.includeSpouses ?? true;
				direction = metadata.generation.direction || 'vertical';

				// Calculate generation depth from node positions
				// (This is a simplified calculation - could be enhanced)
				generationDepth = this.calculateGenerationDepth(canvasData, direction);
			}

			this.statistics = {
				peopleCount,
				edgeCount,
				rootPerson,
				treeType,
				maxGenerations,
				includeSpouses,
				direction,
				generationDepth
			};
		} catch (error: unknown) {
			console.error('Error calculating tree statistics:', error);
			this.statistics = null;
		}
	}

	private formatTreeType(treeType: string): string {
		const typeMap: Record<string, string> = {
			'full': 'Full family tree',
			'ancestors': 'Ancestors (pedigree)',
			'descendants': 'Descendants'
		};
		return typeMap[treeType] || treeType;
	}

	private calculateGenerationDepth(canvasData: CanvasData, direction: string): { ancestors: number; descendants: number } {
		// Simplified generation depth calculation based on node positions
		// In a vertical layout, generations are organized by Y position
		// In horizontal layout, by X position

		const personNodes = canvasData.nodes.filter(
			(node: CanvasNode) => node.type === 'file' && node.file?.endsWith('.md')
		);

		if (personNodes.length === 0) {
			return { ancestors: 0, descendants: 0 };
		}

		// For now, return a simplified count
		// This could be enhanced to actually traverse the tree structure
		const uniquePositions = new Set(
			personNodes.map((node: CanvasNode) => direction === 'vertical' ? node.y : node.x)
		);

		const depth = uniquePositions.size;
		return {
			ancestors: Math.floor(depth / 2),
			descendants: Math.ceil(depth / 2)
		};
	}

	private renderStatistics(contentEl: HTMLElement) {
		if (!this.statistics) return;

		const container = contentEl.createDiv({ cls: 'cr-tree-statistics' });

		// File info
		this.addStatRow(container, 'Canvas file', this.canvasFile.basename, 'file');

		// Separator
		container.createEl('hr');

		// Tree composition
		this.addStatRow(container, 'People', this.statistics.peopleCount.toString(), 'users');
		this.addStatRow(container, 'Relationships', this.statistics.edgeCount.toString(), 'link');

		// Separator
		container.createEl('hr');

		// Tree configuration
		this.addStatRow(container, 'Root person', this.statistics.rootPerson, 'user');
		this.addStatRow(container, 'Tree type', this.statistics.treeType, 'git-fork');

		if (this.statistics.maxGenerations > 0) {
			this.addStatRow(container, 'Generation limit', this.statistics.maxGenerations.toString(), 'layers');
		} else {
			this.addStatRow(container, 'Generation limit', 'None (all generations)', 'layers');
		}

		this.addStatRow(
			container,
			'Spouses included',
			this.statistics.includeSpouses ? 'Yes' : 'No',
			'heart'
		);
		this.addStatRow(container, 'Layout direction', this.statistics.direction, 'move');

		// Separator
		container.createEl('hr');

		// Generation depth
		const depthText = `↑ ${this.statistics.generationDepth.ancestors} generations up, ↓ ${this.statistics.generationDepth.descendants} down`;
		this.addStatRow(container, 'Approximate depth', depthText, 'trending-up');

		// Close button
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
		const closeButton = buttonContainer.createEl('button', { text: 'Close' });
		closeButton.addEventListener('click', () => this.close());
	}

	private addStatRow(container: HTMLElement, label: string, value: string, icon?: string) {
		const row = container.createDiv({ cls: 'cr-stat-row' });

		const labelEl = row.createDiv({ cls: 'cr-stat-label' });
		if (icon) {
			labelEl.createSpan({ cls: `cr-stat-icon lucide-${icon}` });
		}
		labelEl.createSpan({ text: label });

		row.createDiv({ cls: 'cr-stat-value', text: value });
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
