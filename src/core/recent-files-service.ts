/**
 * Recent Files Service
 *
 * Tracks files accessed via Charted Roots features for the Dashboard.
 * Stores up to 5 most recent files, persisted in plugin settings.
 */

import type { TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../main';
import type { RecentFileEntry } from '../settings';

/** Maximum number of recent files to track */
const MAX_RECENT_FILES = 5;

/** Entity type for recent file tracking */
export type RecentEntityType = RecentFileEntry['type'];

/**
 * Service for tracking recently accessed files
 */
export class RecentFilesService {
	private plugin: CanvasRootsPlugin;

	constructor(plugin: CanvasRootsPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Get all recent files
	 */
	getRecentFiles(): RecentFileEntry[] {
		return this.plugin.settings.dashboardRecentFiles || [];
	}

	/**
	 * Track a file access
	 * Adds the file to the front of the list, removes duplicates,
	 * and trims to MAX_RECENT_FILES
	 */
	async trackFile(file: TFile, type: RecentEntityType): Promise<void> {
		const entry: RecentFileEntry = {
			path: file.path,
			name: file.basename,
			type,
			timestamp: Date.now()
		};

		// Get current list, filter out this file if already present
		const current = this.getRecentFiles().filter(f => f.path !== file.path);

		// Add new entry at the front
		const updated = [entry, ...current].slice(0, MAX_RECENT_FILES);

		// Save to settings
		this.plugin.settings.dashboardRecentFiles = updated;
		await this.plugin.saveSettings();
	}

	/**
	 * Remove a file from recent files (e.g., if deleted)
	 */
	async removeFile(path: string): Promise<void> {
		const current = this.getRecentFiles();
		const updated = current.filter(f => f.path !== path);

		if (updated.length !== current.length) {
			this.plugin.settings.dashboardRecentFiles = updated;
			await this.plugin.saveSettings();
		}
	}

	/**
	 * Clear all recent files
	 */
	async clearAll(): Promise<void> {
		this.plugin.settings.dashboardRecentFiles = [];
		await this.plugin.saveSettings();
	}

	/**
	 * Check if a file exists in the vault
	 * Used to filter out deleted files when displaying
	 */
	fileExists(path: string): boolean {
		return this.plugin.app.vault.getAbstractFileByPath(path) !== null;
	}

	/**
	 * Get recent files, filtering out any that no longer exist
	 */
	getValidRecentFiles(): RecentFileEntry[] {
		return this.getRecentFiles().filter(f => this.fileExists(f.path));
	}
}
