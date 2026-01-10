/**
 * Plugin Rename Migration Service
 *
 * Handles one-time migration of vault data when upgrading from Charted Roots to Charted Roots.
 * This service runs once on plugin load if the migration hasn't been completed.
 *
 * Migration tasks:
 * 1. Canvas metadata: Update `plugin: 'canvas-roots'` → `plugin: 'charted-roots'`
 * 2. Code blocks: Update `canvas-roots-timeline`, etc. → `charted-roots-timeline`, etc.
 *
 * Note: Protocol handlers and command IDs use dual-registration (handled in main.ts),
 * so no file migration is needed for those.
 */

import { App, Notice, TFile } from 'obsidian';
import { getLogger } from '../core/logging';

const logger = getLogger('PluginRenameMigration');

/** Old plugin identifier */
const OLD_PLUGIN_ID = 'canvas-roots';

/** New plugin identifier */
const NEW_PLUGIN_ID = 'charted-roots';

/** Code block types that need migration */
const CODE_BLOCK_TYPES = ['timeline', 'relationships', 'media'];

/**
 * Result of the migration operation
 */
export interface PluginRenameMigrationResult {
	/** Number of canvas files updated */
	canvasFilesUpdated: number;
	/** Number of markdown files updated (code blocks) */
	markdownFilesUpdated: number;
	/** Total files scanned */
	filesScanned: number;
	/** Errors encountered */
	errors: Array<{ file: string; error: string }>;
	/** Whether migration completed successfully */
	success: boolean;
}

/**
 * Service for migrating vault data from Charted Roots to Charted Roots
 */
export class PluginRenameMigrationService {
	constructor(private app: App) {}

	/**
	 * Run the full migration process
	 * Returns result with counts of what was updated
	 */
	async runMigration(
		onProgress?: (message: string) => void
	): Promise<PluginRenameMigrationResult> {
		const result: PluginRenameMigrationResult = {
			canvasFilesUpdated: 0,
			markdownFilesUpdated: 0,
			filesScanned: 0,
			errors: [],
			success: false
		};

		try {
			onProgress?.('Scanning for canvas files...');

			// Migrate canvas files
			const canvasResult = await this.migrateCanvasFiles(onProgress);
			result.canvasFilesUpdated = canvasResult.updated;
			result.filesScanned += canvasResult.scanned;
			result.errors.push(...canvasResult.errors);

			onProgress?.('Scanning for code blocks in markdown files...');

			// Migrate markdown files with code blocks
			const markdownResult = await this.migrateMarkdownCodeBlocks(onProgress);
			result.markdownFilesUpdated = markdownResult.updated;
			result.filesScanned += markdownResult.scanned;
			result.errors.push(...markdownResult.errors);

			result.success = result.errors.length === 0;

			logger.info('runMigration',
				`Migration complete: ${result.canvasFilesUpdated} canvas files, ` +
				`${result.markdownFilesUpdated} markdown files updated, ` +
				`${result.errors.length} errors`
			);

		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.error('runMigration', `Migration failed: ${message}`);
			result.errors.push({ file: 'general', error: message });
		}

		return result;
	}

	/**
	 * Migrate canvas files: update plugin metadata
	 */
	private async migrateCanvasFiles(
		onProgress?: (message: string) => void
	): Promise<{ updated: number; scanned: number; errors: Array<{ file: string; error: string }> }> {
		const result = { updated: 0, scanned: 0, errors: [] as Array<{ file: string; error: string }> };

		// Get all .canvas files
		const canvasFiles = this.app.vault.getFiles().filter(f => f.extension === 'canvas');
		result.scanned = canvasFiles.length;

		for (const file of canvasFiles) {
			try {
				const content = await this.app.vault.read(file);
				let canvasData: Record<string, unknown>;

				try {
					canvasData = JSON.parse(content);
				} catch {
					// Not valid JSON, skip
					continue;
				}

				// Check if this canvas has our plugin metadata
				if (canvasData.metadata &&
					typeof canvasData.metadata === 'object' &&
					(canvasData.metadata as Record<string, unknown>).plugin === OLD_PLUGIN_ID) {

					// Update the plugin identifier
					(canvasData.metadata as Record<string, unknown>).plugin = NEW_PLUGIN_ID;

					// Write back
					await this.app.vault.modify(file, JSON.stringify(canvasData, null, '\t'));
					result.updated++;

					onProgress?.(`Updated canvas: ${file.path}`);
					logger.debug('migrateCanvasFiles', `Updated: ${file.path}`);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				result.errors.push({ file: file.path, error: message });
				logger.error('migrateCanvasFiles', `Failed to process ${file.path}: ${message}`);
			}
		}

		return result;
	}

	/**
	 * Migrate markdown files: update code block types
	 */
	private async migrateMarkdownCodeBlocks(
		onProgress?: (message: string) => void
	): Promise<{ updated: number; scanned: number; errors: Array<{ file: string; error: string }> }> {
		const result = { updated: 0, scanned: 0, errors: [] as Array<{ file: string; error: string }> };

		// Build regex patterns for code block types
		// Matches ```canvas-roots-timeline, ```canvas-roots-relationships, ```canvas-roots-media
		const patterns = CODE_BLOCK_TYPES.map(type => ({
			old: new RegExp(`\`\`\`${OLD_PLUGIN_ID}-${type}`, 'g'),
			new: `\`\`\`${NEW_PLUGIN_ID}-${type}`
		}));

		// Get all markdown files
		const markdownFiles = this.app.vault.getMarkdownFiles();
		result.scanned = markdownFiles.length;

		for (const file of markdownFiles) {
			try {
				const content = await this.app.vault.read(file);
				let modified = content;
				let hasChanges = false;

				// Apply each pattern
				for (const pattern of patterns) {
					if (pattern.old.test(modified)) {
						modified = modified.replace(pattern.old, pattern.new);
						hasChanges = true;
					}
					// Reset regex lastIndex for next file
					pattern.old.lastIndex = 0;
				}

				if (hasChanges) {
					await this.app.vault.modify(file, modified);
					result.updated++;

					onProgress?.(`Updated markdown: ${file.path}`);
					logger.debug('migrateMarkdownCodeBlocks', `Updated: ${file.path}`);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				result.errors.push({ file: file.path, error: message });
				logger.error('migrateMarkdownCodeBlocks', `Failed to process ${file.path}: ${message}`);
			}
		}

		return result;
	}

	/**
	 * Preview what would be migrated without making changes
	 * Useful for showing users what will happen before migration
	 */
	async previewMigration(): Promise<{
		canvasFiles: string[];
		markdownFiles: string[];
	}> {
		const preview = {
			canvasFiles: [] as string[],
			markdownFiles: [] as string[]
		};

		// Check canvas files
		const canvasFiles = this.app.vault.getFiles().filter(f => f.extension === 'canvas');
		for (const file of canvasFiles) {
			try {
				const content = await this.app.vault.read(file);
				const canvasData = JSON.parse(content);

				if (canvasData.metadata?.plugin === OLD_PLUGIN_ID) {
					preview.canvasFiles.push(file.path);
				}
			} catch {
				// Skip files that can't be parsed
			}
		}

		// Check markdown files for code blocks
		const codeBlockPattern = new RegExp(`\`\`\`${OLD_PLUGIN_ID}-(timeline|relationships|media)`);
		const markdownFiles = this.app.vault.getMarkdownFiles();

		for (const file of markdownFiles) {
			try {
				const content = await this.app.vault.read(file);
				if (codeBlockPattern.test(content)) {
					preview.markdownFiles.push(file.path);
				}
			} catch {
				// Skip files that can't be read
			}
		}

		return preview;
	}

	/**
	 * Check if migration is needed
	 * Returns true if any files need updating
	 */
	async isMigrationNeeded(): Promise<boolean> {
		const preview = await this.previewMigration();
		return preview.canvasFiles.length > 0 || preview.markdownFiles.length > 0;
	}
}

/**
 * Show migration results to user via Notice
 */
export function showMigrationNotice(result: PluginRenameMigrationResult): void {
	if (result.canvasFilesUpdated === 0 && result.markdownFilesUpdated === 0) {
		// Nothing was migrated, don't show notice
		return;
	}

	const parts: string[] = [];

	if (result.canvasFilesUpdated > 0) {
		parts.push(`${result.canvasFilesUpdated} canvas file${result.canvasFilesUpdated === 1 ? '' : 's'}`);
	}

	if (result.markdownFilesUpdated > 0) {
		parts.push(`${result.markdownFilesUpdated} note${result.markdownFilesUpdated === 1 ? '' : 's'} with code blocks`);
	}

	const message = `Charted Roots: Migrated ${parts.join(' and ')} from Charted Roots format.`;

	if (result.errors.length > 0) {
		new Notice(`${message}\n\n${result.errors.length} error(s) occurred. Check console for details.`, 10000);
	} else {
		new Notice(message, 5000);
	}
}
