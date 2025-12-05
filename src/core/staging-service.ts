import { App, TFile, TFolder } from 'obsidian';
import type { CanvasRootsSettings } from '../settings';

/**
 * Information about a staging subfolder (import batch)
 */
export interface StagingSubfolderInfo {
	path: string;
	name: string;
	fileCount: number;
	personCount: number;
	modifiedDate: Date | null;
}

/**
 * Result of a promote operation
 */
export interface PromoteResult {
	success: boolean;
	filesPromoted: number;
	filesSkipped: number;
	errors: string[];
}

/**
 * Options for promote operations
 */
export interface PromoteOptions {
	/**
	 * Function to check if a file should be skipped (e.g., marked as duplicate)
	 * Returns true if file should be skipped, false to promote
	 */
	shouldSkip?: (file: TFile, crId: string | undefined) => boolean;
}

/**
 * Service for managing staging folder operations.
 * Provides functionality to view, promote, and clean up staging data.
 */
export class StagingService {
	constructor(
		private app: App,
		private settings: CanvasRootsSettings
	) {}

	/**
	 * Check if staging is configured and enabled
	 */
	isConfigured(): boolean {
		return !!this.settings.stagingFolder && this.settings.enableStagingIsolation;
	}

	/**
	 * Get the configured staging folder path
	 */
	getStagingFolder(): string {
		return this.settings.stagingFolder;
	}

	/**
	 * Get all markdown files in the staging folder
	 */
	getStagingFiles(): TFile[] {
		const stagingPath = this.settings.stagingFolder;
		if (!stagingPath) return [];

		return this.app.vault.getMarkdownFiles()
			.filter(f => this.isInStagingFolder(f.path));
	}

	/**
	 * Get all person notes in staging (files with cr_id)
	 */
	getStagingPersonFiles(): TFile[] {
		return this.getStagingFiles().filter(file => {
			const cache = this.app.metadataCache.getFileCache(file);
			return cache?.frontmatter?.cr_id;
		});
	}

	/**
	 * Get information about staging subfolders (import batches)
	 */
	getStagingSubfolders(): StagingSubfolderInfo[] {
		const stagingPath = this.settings.stagingFolder;
		if (!stagingPath) return [];

		const stagingFolder = this.app.vault.getAbstractFileByPath(stagingPath);
		if (!(stagingFolder instanceof TFolder)) return [];

		const subfolders: StagingSubfolderInfo[] = [];

		for (const child of stagingFolder.children) {
			if (child instanceof TFolder) {
				const files = this.getFilesInFolder(child);
				const personFiles = files.filter(f => {
					const cache = this.app.metadataCache.getFileCache(f);
					return cache?.frontmatter?.cr_id;
				});

				// Get most recent modification date
				let latestModified: Date | null = null;
				for (const file of files) {
					const mtime = new Date(file.stat.mtime);
					if (!latestModified || mtime > latestModified) {
						latestModified = mtime;
					}
				}

				subfolders.push({
					path: child.path,
					name: child.name,
					fileCount: files.length,
					personCount: personFiles.length,
					modifiedDate: latestModified
				});
			}
		}

		// Sort by modification date (most recent first)
		subfolders.sort((a, b) => {
			if (!a.modifiedDate) return 1;
			if (!b.modifiedDate) return -1;
			return b.modifiedDate.getTime() - a.modifiedDate.getTime();
		});

		return subfolders;
	}

	/**
	 * Get total counts for staging area
	 */
	getStagingStats(): { totalFiles: number; totalPeople: number; subfolderCount: number } {
		const files = this.getStagingFiles();
		const personFiles = this.getStagingPersonFiles();
		const subfolders = this.getStagingSubfolders();

		return {
			totalFiles: files.length,
			totalPeople: personFiles.length,
			subfolderCount: subfolders.length
		};
	}

	/**
	 * Promote a single file from staging to main tree
	 */
	async promoteFile(file: TFile): Promise<{ success: boolean; newPath: string; error?: string }> {
		if (!this.isInStagingFolder(file.path)) {
			return { success: false, newPath: '', error: 'File is not in staging folder' };
		}

		const mainPath = this.settings.peopleFolder;

		// Calculate new path: replace staging folder with main folder
		// Also strip any subfolder structure (flatten to main folder)
		const fileName = file.name;
		const newPath = mainPath ? `${mainPath}/${fileName}` : fileName;

		try {
			// Check if target exists
			const existing = this.app.vault.getAbstractFileByPath(newPath);
			if (existing) {
				return { success: false, newPath, error: `File already exists at ${newPath}` };
			}

			// Ensure target folder exists
			if (mainPath) {
				await this.ensureFolderExists(mainPath);
			}

			// Move the file
			await this.app.fileManager.renameFile(file, newPath);

			return { success: true, newPath };
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			return { success: false, newPath, error: errorMsg };
		}
	}

	/**
	 * Promote all files from a staging subfolder to main tree
	 */
	async promoteSubfolder(subfolderPath: string, options: PromoteOptions = {}): Promise<PromoteResult> {
		const folder = this.app.vault.getAbstractFileByPath(subfolderPath);
		if (!(folder instanceof TFolder)) {
			return { success: false, filesPromoted: 0, filesSkipped: 0, errors: ['Subfolder not found'] };
		}

		const files = this.getFilesInFolder(folder);
		const results: PromoteResult = { success: true, filesPromoted: 0, filesSkipped: 0, errors: [] };

		for (const file of files) {
			// Check if file should be skipped (e.g., marked as same person)
			if (options.shouldSkip) {
				const cache = this.app.metadataCache.getFileCache(file);
				const crId = cache?.frontmatter?.cr_id;
				if (options.shouldSkip(file, crId)) {
					results.filesSkipped++;
					continue;
				}
			}

			const result = await this.promoteFile(file);
			if (result.success) {
				results.filesPromoted++;
			} else {
				results.errors.push(`${file.name}: ${result.error}`);
			}
		}

		// If some files were promoted or skipped, consider it a partial success
		results.success = results.filesPromoted > 0 || results.filesSkipped > 0 || files.length === 0;

		return results;
	}

	/**
	 * Promote all staging files to main tree
	 */
	async promoteAll(options: PromoteOptions = {}): Promise<PromoteResult> {
		const files = this.getStagingFiles();
		const results: PromoteResult = { success: true, filesPromoted: 0, filesSkipped: 0, errors: [] };

		for (const file of files) {
			// Check if file should be skipped (e.g., marked as same person)
			if (options.shouldSkip) {
				const cache = this.app.metadataCache.getFileCache(file);
				const crId = cache?.frontmatter?.cr_id;
				if (options.shouldSkip(file, crId)) {
					results.filesSkipped++;
					continue;
				}
			}

			const result = await this.promoteFile(file);
			if (result.success) {
				results.filesPromoted++;
			} else {
				results.errors.push(`${file.name}: ${result.error}`);
			}
		}

		results.success = results.filesPromoted > 0 || results.filesSkipped > 0 || files.length === 0;

		return results;
	}

	/**
	 * Delete a staging subfolder and all its contents
	 */
	async deleteSubfolder(subfolderPath: string): Promise<{ success: boolean; filesDeleted: number; error?: string }> {
		const folder = this.app.vault.getAbstractFileByPath(subfolderPath);
		if (!(folder instanceof TFolder)) {
			return { success: false, filesDeleted: 0, error: 'Subfolder not found' };
		}

		// Verify it's in staging
		if (!this.isInStagingFolder(subfolderPath)) {
			return { success: false, filesDeleted: 0, error: 'Folder is not in staging area' };
		}

		const files = this.getFilesInFolder(folder);
		const fileCount = files.length;

		try {
			// Delete all files in folder first
			for (const file of files) {
				await this.app.fileManager.trashFile(file);
			}

			// Delete the folder itself using trashFile to respect user's trash preference
			await this.app.fileManager.trashFile(folder);

			return { success: true, filesDeleted: fileCount };
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			return { success: false, filesDeleted: 0, error: errorMsg };
		}
	}

	/**
	 * Delete all staging data
	 */
	async deleteAllStaging(): Promise<{ success: boolean; filesDeleted: number; error?: string }> {
		const files = this.getStagingFiles();
		let deletedCount = 0;

		try {
			for (const file of files) {
				await this.app.fileManager.trashFile(file);
				deletedCount++;
			}

			return { success: true, filesDeleted: deletedCount };
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			return { success: false, filesDeleted: deletedCount, error: errorMsg };
		}
	}

	/**
	 * Check if a file path is in the staging folder
	 */
	private isInStagingFolder(filePath: string): boolean {
		const stagingPath = this.settings.stagingFolder;
		if (!stagingPath) return false;

		const normalizedFile = filePath.toLowerCase();
		const normalizedStaging = stagingPath.toLowerCase().replace(/^\/|\/$/g, '');

		return normalizedFile.startsWith(normalizedStaging + '/');
	}

	/**
	 * Get all markdown files recursively in a folder
	 */
	private getFilesInFolder(folder: TFolder): TFile[] {
		const files: TFile[] = [];

		const recurse = (f: TFolder) => {
			for (const child of f.children) {
				if (child instanceof TFile && child.extension === 'md') {
					files.push(child);
				} else if (child instanceof TFolder) {
					recurse(child);
				}
			}
		};

		recurse(folder);
		return files;
	}

	/**
	 * Ensure a folder exists, creating it if necessary
	 */
	private async ensureFolderExists(folderPath: string): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(folderPath);
		if (!existing) {
			await this.app.vault.createFolder(folderPath);
		}
	}
}
