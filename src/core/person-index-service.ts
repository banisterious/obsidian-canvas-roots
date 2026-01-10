/**
 * Person Index Service
 *
 * Centralized index for fast cr_id ↔ file lookups and wikilink resolution.
 * Maintains cached mappings between basenames, paths, and cr_ids to enable
 * automatic wikilink resolution in relationship fields.
 *
 * @see https://github.com/banisterious/obsidian-charted-roots/issues/104
 */

import { App, TFile, EventRef } from 'obsidian';
import { getLogger } from './logging';
import type { CanvasRootsSettings } from '../settings';
import type { FolderFilterService } from './folder-filter';

const logger = getLogger('PersonIndexService');

/**
 * Person Index Service
 *
 * Provides fast lookups for:
 * - cr_id → TFile (get file by cr_id)
 * - basename → cr_id(s) (resolve wikilinks, detect ambiguity)
 * - path → cr_id (full path wikilink resolution)
 */
export class PersonIndexService {
	// Primary indices
	private crIdToFile: Map<string, TFile> = new Map();
	private fileToCrId: Map<string, string> = new Map();  // file.path → cr_id

	// Basename index (for wikilink resolution)
	private basenameToFiles: Map<string, TFile[]> = new Map();  // handles duplicates

	// Path index (for full-path wikilinks)
	private pathToFile: Map<string, TFile> = new Map();  // normalized path → file

	// Cache validity
	private cacheValid: boolean = false;

	// Services (follow existing pattern)
	private folderFilter: FolderFilterService | null = null;

	// Event subscriptions
	private changedEventRef: EventRef | null = null;
	private deletedEventRef: EventRef | null = null;
	private renamedEventRef: EventRef | null = null;

	constructor(
		private app: App,
		private settings: CanvasRootsSettings
	) {
		// Subscribe to metadata cache events
		this.subscribeToEvents();
	}

	/**
	 * Service Integration (following existing pattern)
	 */
	setFolderFilter(folderFilter: FolderFilterService): void {
		this.folderFilter = folderFilter;
		this.invalidateCache();
	}

	setSettings(settings: CanvasRootsSettings): void {
		this.settings = settings;
		this.invalidateCache();
	}

	/**
	 * Cache Invalidation Pattern (like FamilyGraph)
	 */
	private ensureIndexLoaded(): void {
		if (!this.cacheValid) {
			this.rebuildIndex();
			this.cacheValid = true;
		}
	}

	invalidateCache(): void {
		this.cacheValid = false;
		logger.debug('invalidateCache', 'Cache invalidated');
	}

	/**
	 * Rebuild index from vault files
	 * Applies folder filter during build
	 */
	private rebuildIndex(): void {
		logger.info('rebuildIndex', 'Rebuilding person index');

		// Clear all indices
		this.crIdToFile.clear();
		this.fileToCrId.clear();
		this.basenameToFiles.clear();
		this.pathToFile.clear();

		const files = this.app.vault.getMarkdownFiles();
		let indexedCount = 0;
		let filteredCount = 0;

		for (const file of files) {
			// Apply folder filter FIRST (following existing pattern)
			if (this.folderFilter && !this.folderFilter.shouldIncludeFile(file)) {
				filteredCount++;
				continue;
			}

			// Read cr_id from metadata cache
			const cache = this.app.metadataCache.getFileCache(file);
			const crId = cache?.frontmatter?.cr_id;

			if (!crId || typeof crId !== 'string') {
				continue;  // Skip files without cr_id
			}

			// Populate indices
			this.crIdToFile.set(crId, file);
			this.fileToCrId.set(file.path, crId);

			// Basename index (for wikilink resolution)
			const basename = file.basename;
			if (!this.basenameToFiles.has(basename)) {
				this.basenameToFiles.set(basename, []);
			}
			this.basenameToFiles.get(basename)!.push(file);

			// Path index (for full-path wikilinks)
			// Normalize: remove .md extension, lowercase
			const normalizedPath = file.path.replace(/\.md$/, '').toLowerCase();
			this.pathToFile.set(normalizedPath, file);

			indexedCount++;
		}

		logger.info('rebuildIndex', 'Index rebuilt', {
			indexedCount,
			filteredCount,
			totalFiles: files.length
		});
	}

	/**
	 * Subscribe to vault/metadata cache events for incremental updates
	 */
	private subscribeToEvents(): void {
		// File changed (metadata updated)
		this.changedEventRef = this.app.metadataCache.on('changed', (file: TFile) => {
			this.handleFileChanged(file);
		});

		// File deleted (use vault event)
		this.deletedEventRef = this.app.vault.on('delete', (file: TFile) => {
			this.handleFileDeleted(file);
		});

		// File renamed (use vault event)
		this.renamedEventRef = this.app.vault.on('rename', (file: TFile, oldPath: string) => {
			this.handleFileRenamed(file, oldPath);
		});

		logger.debug('subscribeToEvents', 'Subscribed to vault and metadata cache events');
	}

	/**
	 * Handle file metadata change
	 */
	private handleFileChanged(file: TFile): void {
		if (!this.cacheValid) {
			return;  // Index not built yet, ignore
		}

		// Check folder filter
		if (this.folderFilter && !this.folderFilter.shouldIncludeFile(file)) {
			// File is now filtered out, remove it
			this.removeFileFromIndex(file.path);
			return;
		}

		// Read updated cr_id
		const cache = this.app.metadataCache.getFileCache(file);
		const crId = cache?.frontmatter?.cr_id;

		if (!crId || typeof crId !== 'string') {
			// File no longer has cr_id, remove it
			this.removeFileFromIndex(file.path);
			return;
		}

		// Remove old entry (if path changed)
		const oldCrId = this.fileToCrId.get(file.path);
		if (oldCrId && oldCrId !== crId) {
			this.crIdToFile.delete(oldCrId);
		}

		// Update indices
		this.updateFileInIndex(file, crId);

		logger.debug('handleFileChanged', 'Updated file in index', {
			path: file.path,
			crId
		});
	}

	/**
	 * Handle file deletion
	 */
	private handleFileDeleted(file: TFile): void {
		if (!this.cacheValid) {
			return;
		}

		this.removeFileFromIndex(file.path);

		logger.debug('handleFileDeleted', 'Removed file from index', {
			path: file.path
		});
	}

	/**
	 * Handle file rename
	 */
	private handleFileRenamed(file: TFile, oldPath: string): void {
		if (!this.cacheValid) {
			return;
		}

		// Remove old path entries
		this.removeFileFromIndex(oldPath);

		// Add new path entries
		const cache = this.app.metadataCache.getFileCache(file);
		const crId = cache?.frontmatter?.cr_id;

		if (crId && typeof crId === 'string') {
			// Check folder filter with new path
			if (!this.folderFilter || this.folderFilter.shouldIncludeFile(file)) {
				this.updateFileInIndex(file, crId);
			}
		}

		logger.debug('handleFileRenamed', 'Updated file path in index', {
			oldPath,
			newPath: file.path
		});
	}

	/**
	 * Update file in index
	 */
	private updateFileInIndex(file: TFile, crId: string): void {
		// Update primary indices
		this.crIdToFile.set(crId, file);
		this.fileToCrId.set(file.path, crId);

		// Update basename index
		const basename = file.basename;
		if (!this.basenameToFiles.has(basename)) {
			this.basenameToFiles.set(basename, []);
		}
		const basenameFiles = this.basenameToFiles.get(basename)!;
		if (!basenameFiles.includes(file)) {
			basenameFiles.push(file);
		}

		// Update path index
		const normalizedPath = file.path.replace(/\.md$/, '').toLowerCase();
		this.pathToFile.set(normalizedPath, file);
	}

	/**
	 * Remove file from index
	 */
	private removeFileFromIndex(filePath: string): void {
		// Remove from fileToCrId
		const crId = this.fileToCrId.get(filePath);
		if (crId) {
			this.fileToCrId.delete(filePath);
			this.crIdToFile.delete(crId);
		}

		// Remove from basename index
		// Note: We need to find the file by path since we may not have the TFile object
		for (const [basename, files] of this.basenameToFiles.entries()) {
			const index = files.findIndex(f => f.path === filePath);
			if (index !== -1) {
				files.splice(index, 1);
				if (files.length === 0) {
					this.basenameToFiles.delete(basename);
				}
				break;
			}
		}

		// Remove from path index
		const normalizedPath = filePath.replace(/\.md$/, '').toLowerCase();
		this.pathToFile.delete(normalizedPath);
	}

	/**
	 * Public Lookup Methods
	 */

	/**
	 * Get cr_id by wikilink basename
	 * Returns null if no match or ambiguous (multiple matches)
	 *
	 * Handles both:
	 * - [[John Smith]] -> basename match
	 * - [[People/John Smith]] -> full path match with basename fallback
	 */
	getCrIdByWikilink(wikilink: string): string | null {
		this.ensureIndexLoaded();

		// Try full path match first (for [[Path/Name]] wikilinks)
		const normalizedPath = wikilink.replace(/\.md$/, '').toLowerCase();
		const pathFile = this.pathToFile.get(normalizedPath);
		if (pathFile) {
			const crId = this.fileToCrId.get(pathFile.path);
			if (crId) {
				return crId;
			}
		}

		// Fallback to basename match
		// Extract basename from path if present: "People/John Smith" -> "John Smith"
		const basename = wikilink.includes('/')
			? wikilink.split('/').pop()!
			: wikilink;

		const files = this.basenameToFiles.get(basename);

		if (!files || files.length === 0) {
			return null;  // No match
		}

		if (files.length > 1) {
			logger.debug('getCrIdByWikilink', 'Ambiguous wikilink', {
				basename,
				matchCount: files.length
			});
			return null;  // Ambiguous - cannot resolve
		}

		// Single match - resolve to cr_id
		const file = files[0];
		return this.fileToCrId.get(file.path) || null;
	}

	/**
	 * Alias for getCrIdByWikilink (for API consistency)
	 */
	getCrIdByFilename(basename: string): string | null {
		return this.getCrIdByWikilink(basename);
	}

	/**
	 * Get file by cr_id (reverse lookup)
	 */
	getFileByCrId(crId: string): TFile | null {
		this.ensureIndexLoaded();
		return this.crIdToFile.get(crId) || null;
	}

	/**
	 * Check if basename is ambiguous (matches multiple files)
	 */
	hasAmbiguousFilename(basename: string): boolean {
		this.ensureIndexLoaded();
		const files = this.basenameToFiles.get(basename);
		return files ? files.length > 1 : false;
	}

	/**
	 * Get all files with given basename
	 */
	getFilesWithBasename(basename: string): TFile[] {
		this.ensureIndexLoaded();
		return this.basenameToFiles.get(basename) || [];
	}

	/**
	 * Get all indexed cr_ids
	 */
	getAllCrIds(): Set<string> {
		this.ensureIndexLoaded();
		return new Set(this.crIdToFile.keys());
	}

	/**
	 * Cleanup on unload
	 */
	onunload(): void {
		if (this.changedEventRef) {
			this.app.metadataCache.offref(this.changedEventRef);
		}
		if (this.deletedEventRef) {
			this.app.vault.offref(this.deletedEventRef);
		}
		if (this.renamedEventRef) {
			this.app.vault.offref(this.renamedEventRef);
		}

		logger.debug('onunload', 'Unsubscribed from vault and metadata cache events');
	}
}
