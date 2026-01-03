import { App, TFile } from 'obsidian';
import { SpouseValue } from '../types/frontmatter';
import { FolderFilterService } from './folder-filter';
import type { CanvasRootsSettings } from '../settings';
import { isPlaceNote, isMapNote, isSourceNote, isEventNote } from '../utils/note-type-detection';

/**
 * Vault statistics for person notes
 */
export interface VaultStats {
	totalPeople: number;
	peopleWithBirthDate: number;
	peopleWithDeathDate: number;
	peopleWithFather: number;
	peopleWithMother: number;
	peopleWithSpouse: number;
	orphanedPeople: number;  // No relationships
	livingPeople: number;    // Potentially living (birth within age threshold, no death date)
}

/**
 * Relationship statistics
 */
export interface RelationshipStats {
	totalFatherLinks: number;
	totalMotherLinks: number;
	totalSpouseLinks: number;
	totalRelationships: number;
}

/**
 * Place statistics
 */
export interface PlaceStats {
	totalPlaces: number;
	placesWithCoordinates: number;
	byCategory: Record<string, number>;
}

/**
 * Map statistics
 */
export interface MapStats {
	totalMaps: number;
	universes: string[];
}

/**
 * Event statistics
 */
export interface EventStats {
	totalEvents: number;
	unsourcedEvents: number;
	byType: Record<string, number>;
}

/**
 * Source statistics
 */
export interface SourceStats {
	totalSources: number;
	byType: Record<string, number>;
}

/**
 * Canvas statistics
 */
export interface CanvasStats {
	totalCanvases: number;
	canvasRootsCanvases: number;
	totalNodes: number;
	totalEdges: number;
}

/**
 * Combined vault statistics
 */
export interface FullVaultStats {
	people: VaultStats;
	relationships: RelationshipStats;
	places: PlaceStats;
	maps: MapStats;
	events: EventStats;
	sources: SourceStats;
	canvases: CanvasStats;
	lastUpdated: Date;
}

/**
 * Service for collecting statistics about person notes in the vault
 */
export class VaultStatsService {
	private app: App;
	private folderFilter: FolderFilterService | null = null;
	private settings: CanvasRootsSettings | null = null;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Set the folder filter service for filtering person notes by folder
	 */
	setFolderFilter(folderFilter: FolderFilterService): void {
		this.folderFilter = folderFilter;
	}

	/**
	 * Set the full plugin settings for note type detection
	 */
	setSettings(settings: CanvasRootsSettings): void {
		this.settings = settings;
	}

	/**
	 * Collect full vault statistics
	 */
	collectStats(): FullVaultStats {
		const files = this.app.vault.getMarkdownFiles();

		// People stats
		let totalPeople = 0;
		let peopleWithBirthDate = 0;
		let peopleWithDeathDate = 0;
		let peopleWithFather = 0;
		let peopleWithMother = 0;
		let peopleWithSpouse = 0;
		let orphanedPeople = 0;
		let livingPeople = 0;

		let totalFatherLinks = 0;
		let totalMotherLinks = 0;
		let totalSpouseLinks = 0;

		// Place stats
		let totalPlaces = 0;
		let placesWithCoordinates = 0;
		const placesByCategory: Record<string, number> = {};

		// Map stats
		let totalMaps = 0;
		const universesSet = new Set<string>();

		// Event stats
		let totalEvents = 0;
		let unsourcedEvents = 0;
		const eventsByType: Record<string, number> = {};

		// Source stats
		let totalSources = 0;
		const sourcesByType: Record<string, number> = {};

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache || !cache.frontmatter) continue;

			const fm = cache.frontmatter;

			// Check for place notes (uses flexible detection)
			if (isPlaceNote(fm, cache, this.settings?.noteTypeDetection)) {
				totalPlaces++;
				if (fm.coordinates?.lat !== undefined && fm.coordinates?.long !== undefined) {
					placesWithCoordinates++;
				}
				const category = fm.place_category || 'uncategorized';
				placesByCategory[category] = (placesByCategory[category] || 0) + 1;
				continue;
			}

			// Check for map notes (uses flexible detection)
			if (isMapNote(fm, cache, this.settings?.noteTypeDetection)) {
				totalMaps++;
				if (fm.universe) {
					universesSet.add(fm.universe);
				}
				continue;
			}

			// Check for event notes (uses flexible detection)
			if (isEventNote(fm, cache, this.settings?.noteTypeDetection)) {
				totalEvents++;
				const eventType = fm.event_type || 'uncategorized';
				eventsByType[eventType] = (eventsByType[eventType] || 0) + 1;
				// Check if event has sources
				if (!fm.sources || (Array.isArray(fm.sources) && fm.sources.length === 0)) {
					unsourcedEvents++;
				}
				continue;
			}

			// Check for source notes (uses flexible detection)
			if (isSourceNote(fm, cache, this.settings?.noteTypeDetection)) {
				totalSources++;
				const sourceType = fm.source_type || 'uncategorized';
				sourcesByType[sourceType] = (sourcesByType[sourceType] || 0) + 1;
				continue;
			}

			// Check for person notes (has cr_id)
			// Apply folder filter if configured
			if (this.folderFilter && !this.folderFilter.shouldIncludeFile(file)) {
				continue;
			}

			const personData = this.extractPersonData(file);
			if (!personData) continue;

			totalPeople++;

			// Birth/death statistics
			if (personData.hasBirthDate) {
				peopleWithBirthDate++;
			}
			if (personData.hasDeathDate) {
				peopleWithDeathDate++;
			}

			// Living person check: uses age threshold, not just "no death date"
			if (this.couldBeLiving(personData.birthYear, personData.hasDeathDate)) {
				livingPeople++;
			}

			// Relationship statistics
			let hasRelationships = false;
			if (personData.hasFather) {
				peopleWithFather++;
				totalFatherLinks++;
				hasRelationships = true;
			}
			if (personData.hasMother) {
				peopleWithMother++;
				totalMotherLinks++;
				hasRelationships = true;
			}
			if (personData.spouseCount > 0) {
				peopleWithSpouse++;
				totalSpouseLinks += personData.spouseCount;
				hasRelationships = true;
			}

			if (!hasRelationships) {
				orphanedPeople++;
			}
		}

		// Collect canvas stats
		const canvasStats = this.collectCanvasStats();

		return {
			people: {
				totalPeople,
				peopleWithBirthDate,
				peopleWithDeathDate,
				peopleWithFather,
				peopleWithMother,
				peopleWithSpouse,
				orphanedPeople,
				livingPeople
			},
			relationships: {
				totalFatherLinks,
				totalMotherLinks,
				totalSpouseLinks,
				totalRelationships: totalFatherLinks + totalMotherLinks + totalSpouseLinks
			},
			places: {
				totalPlaces,
				placesWithCoordinates,
				byCategory: placesByCategory
			},
			maps: {
				totalMaps,
				universes: Array.from(universesSet).sort()
			},
			events: {
				totalEvents,
				unsourcedEvents,
				byType: eventsByType
			},
			sources: {
				totalSources,
				byType: sourcesByType
			},
			canvases: canvasStats,
			lastUpdated: new Date()
		};
	}

	/**
	 * Collect canvas statistics
	 */
	private collectCanvasStats(): CanvasStats {
		let totalCanvases = 0;
		const canvasRootsCanvases = 0;
		const totalNodes = 0;
		const totalEdges = 0;

		const allFiles = this.app.vault.getFiles();
		const canvasFiles = allFiles.filter(f => f.extension === 'canvas');
		totalCanvases = canvasFiles.length;

		// Note: For accurate node/edge counts, we'd need async file reads
		// For now, just return canvas count
		return {
			totalCanvases,
			canvasRootsCanvases, // Would need async to populate accurately
			totalNodes,
			totalEdges
		};
	}

	/**
	 * Extract person data from a file
	 */
	private extractPersonData(file: TFile): {
		hasCrId: boolean;
		hasBirthDate: boolean;
		hasDeathDate: boolean;
		hasFather: boolean;
		hasMother: boolean;
		spouseCount: number;
		birthYear: number | null;
	} | null {
		try {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache || !cache.frontmatter) {
				return null;
			}

			const fm = cache.frontmatter;

			// Must have cr_id to be a valid person note
			if (!fm.cr_id) {
				return null;
			}

			// Extract birth year for living person calculation
			const birthDate = fm.born || fm.birth_date;
			const birthYear = this.extractYear(birthDate);

			return {
				hasCrId: true,
				hasBirthDate: !!(fm.born || fm.birth_date),
				hasDeathDate: !!(fm.died || fm.death_date),
				hasFather: !!(fm.father || fm.father_id),
				hasMother: !!(fm.mother || fm.mother_id),
				spouseCount: this.getSpouseCount(fm.spouse || fm.spouse_id),
				birthYear
			};
		} catch (error: unknown) {
			console.error('Error extracting person data from file:', file.path, error);
			return null;
		}
	}

	/**
	 * Get spouse count from frontmatter
	 */
	private getSpouseCount(spouse: SpouseValue): number {
		if (!spouse) return 0;
		if (Array.isArray(spouse)) return spouse.length;
		return 1;
	}

	/**
	 * Extract year from a date value (supports various formats)
	 */
	private extractYear(dateValue: unknown): number | null {
		if (!dateValue) return null;

		// Handle Date objects
		if (dateValue instanceof Date) {
			return dateValue.getFullYear();
		}

		// Handle numbers (year as number)
		if (typeof dateValue === 'number') {
			return dateValue;
		}

		// Handle strings
		if (typeof dateValue === 'string') {
			// Try YYYY-MM-DD or YYYY format
			const yearMatch = dateValue.match(/\b(\d{4})\b/);
			if (yearMatch) {
				return parseInt(yearMatch[1], 10);
			}
		}

		return null;
	}

	/**
	 * Check if a person could plausibly still be alive based on birth year
	 * Uses the livingPersonAgeThreshold setting (default 100)
	 */
	private couldBeLiving(birthYear: number | null, hasDeathDate: boolean): boolean {
		// If they have a death date, they're not living
		if (hasDeathDate) return false;

		// If no birth year, we can't determine if living
		if (birthYear === null) return false;

		// Calculate age and compare to threshold
		const currentYear = new Date().getFullYear();
		const age = currentYear - birthYear;
		const threshold = this.settings?.livingPersonAgeThreshold ?? 100;

		return age < threshold;
	}
}
