import { App, TFile } from 'obsidian';
import { CanvasNode } from '../models/canvas';

/**
 * Canvas search result
 */
export interface CanvasSearchResult {
	canvasFile: TFile;
	nodeCount: number;
	treeType?: string;
	rootPerson?: string;
}

/**
 * Service for finding person nodes in canvas files
 */
export class CanvasFinder {
	constructor(private app: App) {}

	/**
	 * Find all canvases containing a person with the given cr_id
	 */
	async findCanvasesWithPerson(crId: string): Promise<CanvasSearchResult[]> {
		const results: CanvasSearchResult[] = [];
		const canvasFiles = this.app.vault.getFiles().filter(f => f.extension === 'canvas');

		for (const canvasFile of canvasFiles) {
			try {
				const content = await this.app.vault.read(canvasFile);
				const canvasData = JSON.parse(content);

				// Check if any nodes reference this person
				const hasPersonNode = canvasData.nodes?.some((node: CanvasNode) => {
					// Charted Roots person nodes are file nodes pointing to .md files
					if (node.type === 'file' && node.file?.endsWith('.md')) {
						// Check if the file matches the cr_id
						// We need to read the file to get its cr_id
						return this.nodeMatchesPerson(node.file, crId);
					}
					return false;
				});

				if (hasPersonNode) {
					// Count person nodes in this canvas
					const personNodes = canvasData.nodes?.filter((node: CanvasNode) =>
						node.type === 'file' && node.file?.endsWith('.md')
					) || [];

					// Extract tree metadata if available
					const metadata = canvasData.metadata?.frontmatter;
					const treeType = metadata?.generation?.treeType;
					const rootPerson = metadata?.generation?.rootPersonName;

					results.push({
						canvasFile,
						nodeCount: personNodes.length,
						treeType,
						rootPerson
					});
				}
			} catch (error: unknown) {
				// Skip invalid canvas files
				console.error(`Error reading canvas ${canvasFile.path}:`, error);
			}
		}

		return results;
	}

	/**
	 * Check if a node's file matches the person cr_id
	 * This is a simplified check - we cache cr_id to file path mapping
	 */
	private nodeMatchesPerson(filePath: string, crId: string): boolean {
		try {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!file || !(file instanceof TFile)) {
				return false;
			}

			const cache = this.app.metadataCache.getFileCache(file);
			return cache?.frontmatter?.cr_id === crId;
		} catch {
			return false;
		}
	}

	/**
	 * Open a canvas file and optionally highlight the person node
	 */
	async openCanvas(canvasFile: TFile): Promise<void> {
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(canvasFile);
	}
}
