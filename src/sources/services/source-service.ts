/**
 * Source Service for Evidence & Source Management
 *
 * Handles CRUD operations for source notes and source-related queries.
 */

import { App, TFile, TFolder, normalizePath } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import {
	SourceNote,
	SourceStats,
	SourceConfidence,
	SourceQuality,
	SourceTypeDefinition,
	getAllSourceTypes,
	getSourceType
} from '../types/source-types';
import { getSourceTemplate, applyTemplatePlaceholders } from '../types/source-templates';
import { generateCrId } from '../../core/uuid';

/**
 * Safely convert frontmatter value to string
 */
function fmToString(value: unknown): string {
	if (value === undefined || value === null) return '';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}

/**
 * Service for managing source notes
 */
export class SourceService {
	private app: App;
	private settings: CanvasRootsSettings;
	private sourceCache: Map<string, SourceNote> = new Map();
	private cacheValid = false;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Update settings reference (called when settings change)
	 */
	updateSettings(settings: CanvasRootsSettings): void {
		this.settings = settings;
		this.invalidateCache();
	}

	/**
	 * Invalidate the source cache
	 */
	invalidateCache(): void {
		this.cacheValid = false;
		this.sourceCache.clear();
	}

	/**
	 * Get all source notes in the vault
	 */
	getAllSources(): SourceNote[] {
		if (!this.cacheValid) {
			this.loadSourceCache();
		}
		return Array.from(this.sourceCache.values());
	}

	/**
	 * Get a source note by cr_id
	 */
	getSourceById(crId: string): SourceNote | undefined {
		if (!this.cacheValid) {
			this.loadSourceCache();
		}
		return this.sourceCache.get(crId);
	}

	/**
	 * Get a source note by file path
	 */
	getSourceByPath(filePath: string): SourceNote | undefined {
		if (!this.cacheValid) {
			this.loadSourceCache();
		}
		return Array.from(this.sourceCache.values()).find(s => s.filePath === filePath);
	}

	/**
	 * Get sources by type
	 */
	getSourcesByType(sourceType: string): SourceNote[] {
		const sources = this.getAllSources();
		return sources.filter(s => s.sourceType === sourceType);
	}

	/**
	 * Get sources by repository
	 */
	getSourcesByRepository(repository: string): SourceNote[] {
		const sources = this.getAllSources();
		return sources.filter(s => s.repository === repository);
	}

	/**
	 * Get sources with low confidence
	 */
	getLowConfidenceSources(): SourceNote[] {
		const sources = this.getAllSources();
		return sources.filter(s => s.confidence === 'low' || s.confidence === 'unknown');
	}

	/**
	 * Get sources with media files
	 */
	getSourcesWithMedia(): SourceNote[] {
		const sources = this.getAllSources();
		return sources.filter(s => s.media.length > 0);
	}

	/**
	 * Get sources without media files
	 */
	getSourcesWithoutMedia(): SourceNote[] {
		const sources = this.getAllSources();
		return sources.filter(s => s.media.length === 0);
	}

	/**
	 * Get all unique repositories
	 */
	getUniqueRepositories(): string[] {
		const sources = this.getAllSources();
		const repositories = new Set<string>();
		for (const source of sources) {
			if (source.repository) {
				repositories.add(source.repository);
			}
		}
		return Array.from(repositories).sort();
	}

	/**
	 * Get all unique locations
	 */
	getUniqueLocations(): string[] {
		const sources = this.getAllSources();
		const locations = new Set<string>();
		for (const source of sources) {
			if (source.location) {
				locations.add(source.location);
			}
		}
		return Array.from(locations).sort();
	}

	/**
	 * Calculate source statistics
	 */
	getSourceStats(): SourceStats {
		const sources = this.getAllSources();

		const stats: SourceStats = {
			totalSources: sources.length,
			byType: {},
			byRepository: {},
			byConfidence: {
				high: 0,
				medium: 0,
				low: 0,
				unknown: 0
			},
			withMedia: 0,
			withoutMedia: 0
		};

		for (const source of sources) {
			// Count by type
			stats.byType[source.sourceType] = (stats.byType[source.sourceType] || 0) + 1;

			// Count by repository
			if (source.repository) {
				stats.byRepository[source.repository] = (stats.byRepository[source.repository] || 0) + 1;
			}

			// Count by confidence
			stats.byConfidence[source.confidence]++;

			// Count media
			if (source.media.length > 0) {
				stats.withMedia++;
			} else {
				stats.withoutMedia++;
			}
		}

		return stats;
	}

	/**
	 * Create a new source note
	 */
	async createSource(data: {
		title: string;
		sourceType: string;
		date?: string;
		dateAccessed?: string;
		repository?: string;
		repositoryUrl?: string;
		collection?: string;
		location?: string;
		media?: string[];
		confidence?: SourceConfidence;
		sourceQuality?: SourceQuality;
		transcription?: string;
	}): Promise<TFile> {
		// Generate cr_id
		const crId = generateCrId();

		// Build frontmatter
		const frontmatterLines: string[] = [
			'---',
			'type: source',
			`cr_id: ${crId}`,
			`title: "${data.title.replace(/"/g, '\\"')}"`,
			`source_type: ${data.sourceType}`
		];

		if (data.date) {
			frontmatterLines.push(`source_date: ${data.date}`);
		}
		if (data.dateAccessed) {
			frontmatterLines.push(`source_date_accessed: ${data.dateAccessed}`);
		}
		if (data.repository) {
			frontmatterLines.push(`source_repository: "${data.repository.replace(/"/g, '\\"')}"`);
		}
		if (data.repositoryUrl) {
			frontmatterLines.push(`source_repository_url: "${data.repositoryUrl}"`);
		}
		if (data.collection) {
			frontmatterLines.push(`collection: "${data.collection.replace(/"/g, '\\"')}"`);
		}
		if (data.location) {
			frontmatterLines.push(`location: "${data.location.replace(/"/g, '\\"')}"`);
		}
		if (data.media && data.media.length > 0) {
			frontmatterLines.push(`media: "${data.media[0]}"`);
			for (let i = 1; i < data.media.length; i++) {
				frontmatterLines.push(`media_${i + 1}: "${data.media[i]}"`);
			}
		}
		if (data.confidence) {
			frontmatterLines.push(`confidence: ${data.confidence}`);
		}
		if (data.sourceQuality) {
			frontmatterLines.push(`source_quality: ${data.sourceQuality}`);
		}

		frontmatterLines.push('---');

		// Build note body using template
		// Check if this is a custom type with a template
		const customTemplates: Record<string, string> = {};
		for (const customType of this.settings.customSourceTypes) {
			if (customType.template) {
				customTemplates[customType.id] = customType.template;
			}
		}
		let body = getSourceTemplate(data.sourceType, customTemplates);
		body = applyTemplatePlaceholders(body, { title: data.title });

		// If user provided a transcription, insert it into the template
		if (data.transcription) {
			// Find the Transcription section and add content after it
			const transcriptionHeader = '## Transcription';
			const transcriptionIndex = body.indexOf(transcriptionHeader);
			if (transcriptionIndex !== -1) {
				const afterHeader = transcriptionIndex + transcriptionHeader.length;
				const nextSection = body.indexOf('\n## ', afterHeader);
				if (nextSection !== -1) {
					// Insert transcription between header and next section
					body = body.slice(0, afterHeader) + '\n\n' + data.transcription + '\n' + body.slice(nextSection);
				} else {
					// No next section, append at end of transcription area
					body = body.slice(0, afterHeader) + '\n\n' + data.transcription + body.slice(afterHeader);
				}
			}
		}

		const content = frontmatterLines.join('\n') + body;

		// Create file
		const fileName = this.slugify(data.title) + '.md';
		const folder = this.settings.sourcesFolder;
		const filePath = normalizePath(`${folder}/${fileName}`);

		// Ensure folder exists
		await this.ensureFolderExists(folder);

		// Create the file
		const file = await this.app.vault.create(filePath, content);

		// Invalidate cache
		this.invalidateCache();

		return file;
	}

	/**
	 * Update an existing source note's frontmatter
	 */
	async updateSource(file: TFile, data: {
		title: string;
		sourceType: string;
		date?: string;
		dateAccessed?: string;
		repository?: string;
		repositoryUrl?: string;
		collection?: string;
		location?: string;
		confidence?: SourceConfidence;
		sourceQuality?: SourceQuality;
		media?: string[];
	}): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			// Update fields
			frontmatter.title = data.title;
			frontmatter.source_type = data.sourceType;

			// Optional fields - set or remove
			// Also clean up legacy property names if present
			if (data.date) {
				frontmatter.source_date = data.date;
			} else {
				delete frontmatter.source_date;
			}
			delete frontmatter.date; // Remove legacy

			if (data.dateAccessed) {
				frontmatter.source_date_accessed = data.dateAccessed;
			} else {
				delete frontmatter.source_date_accessed;
			}
			delete frontmatter.date_accessed; // Remove legacy

			if (data.repository) {
				frontmatter.source_repository = data.repository;
			} else {
				delete frontmatter.source_repository;
			}
			delete frontmatter.repository; // Remove legacy

			if (data.repositoryUrl) {
				frontmatter.source_repository_url = data.repositoryUrl;
			} else {
				delete frontmatter.source_repository_url;
			}
			delete frontmatter.repository_url; // Remove legacy

			if (data.collection) {
				frontmatter.collection = data.collection;
			} else {
				delete frontmatter.collection;
			}

			if (data.location) {
				frontmatter.location = data.location;
			} else {
				delete frontmatter.location;
			}

			if (data.confidence) {
				frontmatter.confidence = data.confidence;
			} else {
				delete frontmatter.confidence;
			}

			if (data.sourceQuality) {
				frontmatter.source_quality = data.sourceQuality;
			} else {
				delete frontmatter.source_quality;
			}

			// Handle media fields - clear existing and set new
			// First, remove all existing media fields
			delete frontmatter.media;
			for (let i = 2; i <= 20; i++) {
				delete frontmatter[`media_${i}`];
			}

			// Then add new media fields
			if (data.media && data.media.length > 0) {
				frontmatter.media = data.media[0];
				for (let i = 1; i < data.media.length; i++) {
					frontmatter[`media_${i + 1}`] = data.media[i];
				}
			}
		});

		// Invalidate cache
		this.invalidateCache();
	}

	/**
	 * Parse a file into a SourceNote object
	 */
	parseSourceNote(file: TFile, frontmatter: Record<string, unknown>): SourceNote | null {
		// Must have type: source
		if (frontmatter.type !== 'source') {
			return null;
		}

		// Must have required fields
		const crId = frontmatter.cr_id as string;
		const title = frontmatter.title as string;
		const sourceType = frontmatter.source_type as string;

		if (!crId || !title || !sourceType) {
			return null;
		}

		// Collect media fields (media, media_2, media_3, etc.)
		const media: string[] = [];
		if (frontmatter.media) {
			media.push(fmToString(frontmatter.media));
		}
		for (let i = 2; i <= 20; i++) {
			const key = `media_${i}`;
			if (frontmatter[key]) {
				media.push(fmToString(frontmatter[key]));
			} else {
				break; // Stop at first missing number
			}
		}

		// Parse confidence
		let confidence: SourceConfidence = 'unknown';
		if (frontmatter.confidence) {
			const conf = fmToString(frontmatter.confidence).toLowerCase();
			if (conf === 'high' || conf === 'medium' || conf === 'low' || conf === 'unknown') {
				confidence = conf;
			}
		}

		// Parse source quality (GPS methodology)
		let sourceQuality: SourceQuality | undefined;
		if (frontmatter.source_quality) {
			const quality = fmToString(frontmatter.source_quality).toLowerCase();
			if (quality === 'primary' || quality === 'secondary' || quality === 'derivative') {
				sourceQuality = quality;
			}
		}

		return {
			filePath: file.path,
			crId,
			title,
			sourceType,
			// Support both new and legacy property names for backwards compatibility
			date: (frontmatter.source_date || frontmatter.date) ? fmToString(frontmatter.source_date || frontmatter.date) : undefined,
			dateAccessed: (frontmatter.source_date_accessed || frontmatter.date_accessed) ? fmToString(frontmatter.source_date_accessed || frontmatter.date_accessed) : undefined,
			repository: (frontmatter.source_repository || frontmatter.repository) ? fmToString(frontmatter.source_repository || frontmatter.repository) : undefined,
			repositoryUrl: (frontmatter.source_repository_url || frontmatter.repository_url) ? fmToString(frontmatter.source_repository_url || frontmatter.repository_url) : undefined,
			collection: frontmatter.collection ? fmToString(frontmatter.collection) : undefined,
			location: frontmatter.location ? fmToString(frontmatter.location) : undefined,
			media,
			confidence,
			citationOverride: frontmatter.citation_override ? fmToString(frontmatter.citation_override) : undefined,
			sourceQuality
		};
	}

	/**
	 * Get source type definition for a source
	 */
	getSourceTypeDefinition(source: SourceNote): SourceTypeDefinition | undefined {
		return getSourceType(
			source.sourceType,
			this.settings.customSourceTypes,
			this.settings.showBuiltInSourceTypes
		);
	}

	/**
	 * Get all available source types
	 */
	getAvailableSourceTypes(): SourceTypeDefinition[] {
		return getAllSourceTypes(
			this.settings.customSourceTypes,
			this.settings.showBuiltInSourceTypes
		);
	}

	// ============ Private Methods ============

	/**
	 * Load all source notes into the cache
	 */
	private loadSourceCache(): void {
		this.sourceCache.clear();

		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const source = this.parseSourceNote(file, cache.frontmatter);
			if (source) {
				this.sourceCache.set(source.crId, source);
			}
		}

		this.cacheValid = true;
	}

	/**
	 * Ensure a folder exists, creating it if necessary
	 */
	private async ensureFolderExists(folderPath: string): Promise<void> {
		const normalizedPath = normalizePath(folderPath);
		const folder = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (!folder) {
			await this.app.vault.createFolder(normalizedPath);
		} else if (!(folder instanceof TFolder)) {
			throw new Error(`Path exists but is not a folder: ${normalizedPath}`);
		}
	}

	/**
	 * Convert a title to a URL-safe filename
	 */
	private slugify(title: string): string {
		return title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.substring(0, 100); // Limit length
	}
}
