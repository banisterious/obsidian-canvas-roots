/**
 * Media Inventory Generator
 *
 * Generates a report of all media files in the vault, identifying which
 * are linked to entities and which are orphaned.
 */

import { App, TFile } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import type {
	MediaInventoryOptions,
	MediaInventoryResult,
	MediaFileEntry
} from '../types/report-types';
import { SourceService } from '../../sources/services/source-service';
import { getLogger } from '../../core/logging';
import { extractWikilinkPath } from '../../utils/wikilink-resolver';

const logger = getLogger('MediaInventoryGenerator');

/**
 * Media file extensions to scan
 */
const MEDIA_EXTENSIONS = new Set([
	// Images
	'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'tif',
	// Documents
	'pdf',
	// Audio
	'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac',
	// Video
	'mp4', 'mov', 'avi', 'mkv', 'webm'
]);

/**
 * Get file type category from extension
 */
function getFileTypeCategory(ext: string): string {
	const lower = ext.toLowerCase();
	if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'tif'].includes(lower)) {
		return 'image';
	}
	if (lower === 'pdf') {
		return 'pdf';
	}
	if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(lower)) {
		return 'audio';
	}
	if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(lower)) {
		return 'video';
	}
	return 'other';
}

/**
 * Generator for Media Inventory reports
 */
export class MediaInventoryGenerator {
	private app: App;
	private settings: CanvasRootsSettings;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Generate a Media Inventory report
	 */
	async generate(options: MediaInventoryOptions): Promise<MediaInventoryResult> {
		logger.info('generate', 'Generating Media Inventory', { scope: options.scope });

		const warnings: string[] = [];

		// Initialize source service
		const sourceService = new SourceService(this.app, this.settings);

		// Get all media files in vault
		const allFiles = this.app.vault.getFiles();
		let mediaFiles = allFiles.filter(f => {
			const ext = f.extension.toLowerCase();
			return MEDIA_EXTENSIONS.has(ext);
		});

		// Apply folder filter if specified
		if (options.scope === 'by_folder' && options.folderPath) {
			mediaFiles = mediaFiles.filter(f => f.path.startsWith(options.folderPath!));
		}

		// Build a map of linked media paths
		const linkedMediaPaths = new Map<string, Array<{ crId: string; name: string; type: string }>>();

		// Currently only sources have media links
		if (options.scope !== 'by_folder') {
			const allSources = sourceService.getAllSources();
			for (const source of allSources) {
				for (const mediaPath of source.media) {
					// Media path might be a wikilink or direct path
					const normalizedPath = this.normalizeMediaPath(mediaPath);
					if (normalizedPath) {
						if (!linkedMediaPaths.has(normalizedPath)) {
							linkedMediaPaths.set(normalizedPath, []);
						}
						linkedMediaPaths.get(normalizedPath)!.push({
							crId: source.crId,
							name: source.title,
							type: 'source'
						});
					}
				}
			}
		}

		// Process media files
		const linkedMedia: MediaFileEntry[] = [];
		const orphanedMedia: MediaFileEntry[] = [];
		const byFileType: Record<string, number> = {};
		const byEntityType: Record<string, number> = { source: 0 };
		let totalSize = 0;

		for (const file of mediaFiles) {
			const ext = file.extension.toLowerCase();
			const category = getFileTypeCategory(ext);
			byFileType[category] = (byFileType[category] || 0) + 1;

			const fileSize = options.includeFileSizes ? await this.getFileSize(file) : undefined;
			if (fileSize) {
				totalSize += fileSize;
			}

			const linkedEntities = linkedMediaPaths.get(file.path) || [];
			const isOrphaned = linkedEntities.length === 0;

			const entry: MediaFileEntry = {
				path: file.path,
				name: file.name,
				extension: ext,
				size: fileSize,
				linkedEntities,
				isOrphaned
			};

			if (isOrphaned) {
				orphanedMedia.push(entry);
			} else {
				linkedMedia.push(entry);
				// Count by entity type
				for (const entity of linkedEntities) {
					byEntityType[entity.type] = (byEntityType[entity.type] || 0) + 1;
				}
			}
		}

		// Find entities without media (if requested)
		const entitiesWithoutMedia: Array<{ crId: string; name: string; type: string }> = [];
		if (options.showCoverageGaps) {
			const allSources = sourceService.getAllSources();
			for (const source of allSources) {
				if (source.media.length === 0) {
					entitiesWithoutMedia.push({
						crId: source.crId,
						name: source.title,
						type: 'source'
					});
				}
			}
		}

		const summary = {
			totalFiles: mediaFiles.length,
			linkedCount: linkedMedia.length,
			orphanedCount: orphanedMedia.length,
			totalSize: options.includeFileSizes ? totalSize : undefined
		};

		// Generate markdown content
		const content = this.generateMarkdown(
			summary,
			byFileType,
			byEntityType,
			linkedMedia,
			orphanedMedia,
			entitiesWithoutMedia,
			options
		);

		const date = new Date().toISOString().split('T')[0];
		const suggestedFilename = `Media Inventory - ${date}.md`;

		return {
			success: true,
			content,
			suggestedFilename,
			stats: {
				peopleCount: 0,
				eventsCount: 0,
				sourcesCount: entitiesWithoutMedia.length
			},
			warnings,
			summary,
			byFileType,
			byEntityType,
			linkedMedia,
			orphanedMedia,
			entitiesWithoutMedia
		};
	}

	/**
	 * Normalize a media path (handle wikilinks, etc.)
	 */
	private normalizeMediaPath(path: string): string | null {
		if (!path) return null;

		// Extract path from wikilink (handles brackets and alias format)
		const normalized = extractWikilinkPath(path);

		// Try to find the file
		const file = this.app.metadataCache.getFirstLinkpathDest(normalized, '');
		if (file) {
			return file.path;
		}

		// Return as-is if we can't resolve
		return normalized;
	}

	/**
	 * Get file size in bytes
	 */
	private async getFileSize(file: TFile): Promise<number> {
		const stat = await this.app.vault.adapter.stat(file.path);
		return stat?.size || 0;
	}

	/**
	 * Format file size for display
	 */
	private formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	}

	/**
	 * Generate markdown content
	 */
	private generateMarkdown(
		summary: { totalFiles: number; linkedCount: number; orphanedCount: number; totalSize?: number },
		byFileType: Record<string, number>,
		byEntityType: Record<string, number>,
		linkedMedia: MediaFileEntry[],
		orphanedMedia: MediaFileEntry[],
		entitiesWithoutMedia: Array<{ crId: string; name: string; type: string }>,
		options: MediaInventoryOptions
	): string {
		const lines: string[] = [];
		const date = new Date().toLocaleDateString();

		// Title
		lines.push('# Media Inventory');
		lines.push('');
		lines.push(`Generated: ${date}`);
		if (options.scope === 'by_folder' && options.folderPath) {
			lines.push(`Scope: ${options.folderPath}`);
		}
		lines.push('');

		// Summary
		lines.push('## Summary');
		lines.push('');
		lines.push(`- **Total media files:** ${summary.totalFiles}`);
		lines.push(`- **Linked to entities:** ${summary.linkedCount}`);
		lines.push(`- **Orphaned (no links):** ${summary.orphanedCount}`);
		if (summary.totalSize !== undefined) {
			lines.push(`- **Total size:** ${this.formatFileSize(summary.totalSize)}`);
		}
		lines.push('');

		// File type breakdown
		lines.push('## By file type');
		lines.push('');
		lines.push('| Type | Count |');
		lines.push('|------|-------|');
		for (const [type, count] of Object.entries(byFileType).sort((a, b) => b[1] - a[1])) {
			lines.push(`| ${type} | ${count} |`);
		}
		lines.push('');

		// Entity type breakdown
		if (Object.values(byEntityType).some(v => v > 0)) {
			lines.push('## By entity type');
			lines.push('');
			lines.push('| Entity Type | Media Count |');
			lines.push('|-------------|-------------|');
			for (const [type, count] of Object.entries(byEntityType).sort((a, b) => b[1] - a[1])) {
				if (count > 0) {
					lines.push(`| ${type} | ${count} |`);
				}
			}
			lines.push('');
		}

		// Linked media
		if (linkedMedia.length > 0) {
			lines.push(`## Linked media (${linkedMedia.length})`);
			lines.push('');

			if (options.includeFileSizes) {
				lines.push('| File | Size | Linked To |');
				lines.push('|------|------|-----------|');
			} else {
				lines.push('| File | Linked To |');
				lines.push('|------|-----------|');
			}

			for (const file of linkedMedia.slice(0, 100)) {
				const linkedTo = file.linkedEntities.map(e => `[[${e.name}]]`).join(', ');
				if (options.includeFileSizes) {
					const size = file.size ? this.formatFileSize(file.size) : '';
					lines.push(`| ${file.name} | ${size} | ${linkedTo} |`);
				} else {
					lines.push(`| ${file.name} | ${linkedTo} |`);
				}
			}

			if (linkedMedia.length > 100) {
				lines.push('');
				lines.push(`*...and ${linkedMedia.length - 100} more*`);
			}
			lines.push('');
		}

		// Orphaned media
		if (options.showOrphanedFiles && orphanedMedia.length > 0) {
			lines.push(`## Orphaned media (${orphanedMedia.length})`);
			lines.push('');
			lines.push('These files are not linked to any entity:');
			lines.push('');

			if (options.includeFileSizes) {
				lines.push('| File | Size | Folder |');
				lines.push('|------|------|--------|');
			} else {
				lines.push('| File | Folder |');
				lines.push('|------|--------|');
			}

			for (const file of orphanedMedia.slice(0, 100)) {
				const folder = file.path.split('/').slice(0, -1).join('/') || '/';
				if (options.includeFileSizes) {
					const size = file.size ? this.formatFileSize(file.size) : '';
					lines.push(`| ${file.name} | ${size} | ${folder} |`);
				} else {
					lines.push(`| ${file.name} | ${folder} |`);
				}
			}

			if (orphanedMedia.length > 100) {
				lines.push('');
				lines.push(`*...and ${orphanedMedia.length - 100} more*`);
			}
			lines.push('');
		}

		// Entities without media
		if (options.showCoverageGaps && entitiesWithoutMedia.length > 0) {
			lines.push(`## Entities without media (${entitiesWithoutMedia.length})`);
			lines.push('');
			lines.push('These entities have no linked media files:');
			lines.push('');
			lines.push('| Entity | Type |');
			lines.push('|--------|------|');

			for (const entity of entitiesWithoutMedia.slice(0, 100)) {
				lines.push(`| [[${entity.name}]] | ${entity.type} |`);
			}

			if (entitiesWithoutMedia.length > 100) {
				lines.push('');
				lines.push(`*...and ${entitiesWithoutMedia.length - 100} more*`);
			}
			lines.push('');
		}

		// Footer
		lines.push('---');
		lines.push('*Generated by Canvas Roots*');

		return lines.join('\n');
	}
}
