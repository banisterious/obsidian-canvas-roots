/**
 * Canvas Utilities
 *
 * Shared utilities for working with Obsidian canvas files.
 */

import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { getLogger } from './logging';
import type { CanvasData } from './canvas-generator';

// Re-export CanvasData for convenience
export type { CanvasData } from './canvas-generator';

const logger = getLogger('CanvasUtils');

/**
 * Result of a canvas write operation
 */
export interface CanvasWriteResult {
	success: boolean;
	file?: TFile;
	path: string;
	error?: string;
}

/**
 * Format canvas data to JSON string matching Obsidian's exact format
 *
 * Obsidian uses a specific JSON format for canvas files:
 * - Nodes and edges are each on their own line (compact within)
 * - Top-level structure is indented with newlines
 *
 * @param data Canvas data to format
 * @returns Formatted JSON string matching Obsidian's format
 */
/**
 * Safely stringify an object, handling circular references
 *
 * @param obj - Object to stringify
 * @returns JSON string with circular references replaced by "[Circular]"
 */
function safeStringify(obj: unknown): string {
	const seen = new WeakSet();
	let hasCircular = false;
	const result = JSON.stringify(obj, (key, value) => {
		if (typeof value === 'object' && value !== null) {
			if (seen.has(value)) {
				hasCircular = true;
				logger.warn('safeStringify', `Circular reference detected at key: ${key}`);
				return '[Circular]';
			}
			seen.add(value);
		}
		return value;
	});
	if (hasCircular) {
		logger.warn('safeStringify', 'Object contained circular references', { preview: result.substring(0, 200) });
	}
	return result;
}

export function formatCanvasJson(data: CanvasData): string {
	const lines: string[] = [];
	lines.push('{');

	// Format nodes array
	lines.push('\t"nodes":[');
	data.nodes.forEach((node, index) => {
		const compact = safeStringify(node);
		const suffix = index < data.nodes.length - 1 ? ',' : '';
		lines.push(`\t\t${compact}${suffix}`);
	});
	lines.push('\t],');

	// Format edges array
	lines.push('\t"edges":[');
	data.edges.forEach((edge, index) => {
		const compact = safeStringify(edge);
		const suffix = index < data.edges.length - 1 ? ',' : '';
		lines.push(`\t\t${compact}${suffix}`);
	});
	lines.push('\t],');

	// Format metadata
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

/**
 * Generate a unique canvas-compatible ID (16 hex characters)
 */
export function generateCanvasId(): string {
	const chars = '0123456789abcdef';
	let id = '';
	for (let i = 0; i < 16; i++) {
		id += chars[Math.floor(Math.random() * chars.length)];
	}
	return id;
}

/**
 * Ensure a folder exists, creating it if necessary
 *
 * @param app Obsidian app instance
 * @param folderPath Path to the folder
 * @returns The folder object
 */
export async function ensureFolderExists(app: App, folderPath: string): Promise<TFolder> {
	const normalizedPath = normalizePath(folderPath);

	// Check if folder already exists
	const existing = app.vault.getAbstractFileByPath(normalizedPath);
	if (existing instanceof TFolder) {
		return existing;
	}

	// Create folder (and any parent folders)
	await app.vault.createFolder(normalizedPath);

	const folder = app.vault.getAbstractFileByPath(normalizedPath);
	if (!(folder instanceof TFolder)) {
		throw new Error(`Failed to create folder: ${normalizedPath}`);
	}

	return folder;
}

/**
 * Write a canvas file to the vault
 *
 * @param app Obsidian app instance
 * @param path File path (with or without .canvas extension)
 * @param data Canvas data to write
 * @param overwrite Whether to overwrite existing files
 * @returns Result of the write operation
 */
export async function writeCanvasFile(
	app: App,
	path: string,
	data: CanvasData,
	overwrite = false
): Promise<CanvasWriteResult> {
	try {
		// Ensure .canvas extension
		let canvasPath = path;
		if (!canvasPath.endsWith('.canvas')) {
			canvasPath += '.canvas';
		}
		canvasPath = normalizePath(canvasPath);

		// Ensure parent folder exists
		const folderPath = canvasPath.substring(0, canvasPath.lastIndexOf('/'));
		if (folderPath) {
			await ensureFolderExists(app, folderPath);
		}

		// Format canvas JSON
		const content = formatCanvasJson(data);

		// Check for existing file
		const existingFile = app.vault.getAbstractFileByPath(canvasPath);

		let file: TFile;
		if (existingFile instanceof TFile) {
			if (!overwrite) {
				return {
					success: false,
					path: canvasPath,
					error: `File already exists: ${canvasPath}`
				};
			}
			await app.vault.modify(existingFile, content);
			file = existingFile;
			logger.info('writeCanvasFile', `Updated existing canvas: ${canvasPath}`);
		} else {
			file = await app.vault.create(canvasPath, content);
			logger.info('writeCanvasFile', `Created new canvas: ${canvasPath}`);
		}

		return {
			success: true,
			file,
			path: canvasPath
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error('writeCanvasFile', `Failed to write canvas: ${path}`, error);
		return {
			success: false,
			path,
			error: errorMessage
		};
	}
}

/**
 * Generate a safe filename from a string
 *
 * @param name The name to convert
 * @returns A safe filename
 */
export function toSafeFilename(name: string): string {
	return name
		.replace(/[<>:"/\\|?*]/g, '') // Remove invalid chars
		.replace(/\s+/g, '-')          // Replace spaces with dashes
		.replace(/-+/g, '-')           // Collapse multiple dashes
		.replace(/^-|-$/g, '')         // Remove leading/trailing dashes
		.toLowerCase();
}
