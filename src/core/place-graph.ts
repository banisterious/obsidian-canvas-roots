/**
 * Place Graph Service
 *
 * Builds and traverses place hierarchy graphs from place notes in the vault.
 * Tracks place references from person notes and calculates statistics.
 */

import { App, TFile } from 'obsidian';
import { getLogger } from './logging';
import {
	PlaceNode,
	PlaceCategory,
	PlaceReference,
	PlaceReferenceType,
	PlaceStatistics,
	PlaceIssue,
	GeoCoordinates,
	CustomCoordinates,
	DEFAULT_PLACE_CATEGORY,
	supportsUniverse,
	supportsRealCoordinates
} from '../models/place';
import { FolderFilterService } from './folder-filter';
import type { ValueAliasSettings } from '../settings';
import { CANONICAL_PLACE_CATEGORIES, type CanonicalPlaceCategory } from './value-alias-service';

const logger = getLogger('PlaceGraph');

/**
 * Service for building and traversing place graphs
 */
export class PlaceGraphService {
	private app: App;
	private placeCache: Map<string, PlaceNode>;
	private placeReferenceCache: PlaceReference[];
	private folderFilter: FolderFilterService | null = null;
	private valueAliases: ValueAliasSettings = { eventType: {}, gender: {}, placeCategory: {} };

	constructor(app: App) {
		this.app = app;
		this.placeCache = new Map();
		this.placeReferenceCache = [];
	}

	/**
	 * Set the folder filter service for filtering notes by folder
	 */
	setFolderFilter(folderFilter: FolderFilterService): void {
		this.folderFilter = folderFilter;
	}

	/**
	 * Set value aliases for resolving custom property values to canonical values
	 */
	setValueAliases(aliases: ValueAliasSettings): void {
		this.valueAliases = aliases;
	}

	/**
	 * Resolve a place category value to canonical form using value aliases.
	 * Resolution order:
	 * 1. If value is already canonical, return it
	 * 2. If value has an alias configured, return the canonical value
	 * 3. Otherwise return the default place category ('real')
	 */
	private resolvePlaceCategory(userValue: string | undefined): PlaceCategory {
		if (!userValue) return DEFAULT_PLACE_CATEGORY;

		const normalized = userValue.toLowerCase().trim();

		// Check if already canonical (case-insensitive)
		const canonicalMatch = CANONICAL_PLACE_CATEGORIES.find(v => v.toLowerCase() === normalized);
		if (canonicalMatch) {
			return canonicalMatch as PlaceCategory;
		}

		// Check value aliases
		const aliasedValue = this.valueAliases.placeCategory[normalized];
		if (aliasedValue && CANONICAL_PLACE_CATEGORIES.includes(aliasedValue as CanonicalPlaceCategory)) {
			return aliasedValue as PlaceCategory;
		}

		// Unknown category - return default
		return DEFAULT_PLACE_CATEGORY;
	}

	/**
	 * Force reload the place cache
	 */
	reloadCache(): void {
		this.loadPlaceCache();
		this.loadPlaceReferences();
	}

	/**
	 * Ensures the place cache is loaded
	 */
	ensureCacheLoaded(): void {
		if (this.placeCache.size === 0) {
			this.loadPlaceCache();
			this.loadPlaceReferences();
		}
	}

	/**
	 * Gets the total count of places in the vault
	 */
	getTotalPlaceCount(): number {
		this.ensureCacheLoaded();
		return this.placeCache.size;
	}

	/**
	 * Gets a place by its cr_id
	 */
	getPlaceByCrId(crId: string): PlaceNode | undefined {
		this.ensureCacheLoaded();
		return this.placeCache.get(crId);
	}

	/**
	 * Gets a place by name (case-insensitive, checks name and aliases)
	 */
	getPlaceByName(name: string): PlaceNode | undefined {
		this.ensureCacheLoaded();
		const lowerName = name.toLowerCase();

		for (const place of this.placeCache.values()) {
			if (place.name.toLowerCase() === lowerName) {
				return place;
			}
			if (place.aliases.some(a => a.toLowerCase() === lowerName)) {
				return place;
			}
		}

		return undefined;
	}

	/**
	 * Gets all places
	 */
	getAllPlaces(): PlaceNode[] {
		this.ensureCacheLoaded();
		return Array.from(this.placeCache.values());
	}

	/**
	 * Gets all places by category
	 */
	getPlacesByCategory(category: PlaceCategory): PlaceNode[] {
		this.ensureCacheLoaded();
		return Array.from(this.placeCache.values()).filter(p => p.category === category);
	}

	/**
	 * Gets all places in a specific universe
	 */
	getPlacesByUniverse(universe: string): PlaceNode[] {
		this.ensureCacheLoaded();
		return Array.from(this.placeCache.values()).filter(p => p.universe === universe);
	}

	/**
	 * Gets all unique universes
	 */
	getAllUniverses(): string[] {
		this.ensureCacheLoaded();
		const universes = new Set<string>();
		for (const place of this.placeCache.values()) {
			if (place.universe) {
				universes.add(place.universe);
			}
		}
		return Array.from(universes).sort();
	}

	/**
	 * Gets the parent of a place
	 */
	getParent(placeId: string): PlaceNode | undefined {
		const place = this.placeCache.get(placeId);
		if (!place || !place.parentId) {
			return undefined;
		}
		return this.placeCache.get(place.parentId);
	}

	/**
	 * Gets all ancestors of a place (parent, grandparent, etc.)
	 */
	getAncestors(placeId: string): PlaceNode[] {
		const ancestors: PlaceNode[] = [];
		let currentId = placeId;
		const visited = new Set<string>();

		while (currentId) {
			if (visited.has(currentId)) {
				// Circular reference detected
				logger.warn('getAncestors', `Circular reference detected for place: ${placeId}`);
				break;
			}
			visited.add(currentId);

			const place = this.placeCache.get(currentId);
			if (!place || !place.parentId) {
				break;
			}

			const parent = this.placeCache.get(place.parentId);
			if (parent) {
				ancestors.push(parent);
				currentId = parent.id;
			} else {
				break;
			}
		}

		return ancestors;
	}

	/**
	 * Gets all children of a place
	 */
	getChildren(placeId: string): PlaceNode[] {
		const place = this.placeCache.get(placeId);
		if (!place) {
			return [];
		}
		return place.childIds
			.map(id => this.placeCache.get(id))
			.filter((p): p is PlaceNode => p !== undefined);
	}

	/**
	 * Gets all descendants of a place (children, grandchildren, etc.)
	 */
	getDescendants(placeId: string): PlaceNode[] {
		const descendants: PlaceNode[] = [];
		const queue = [placeId];
		const visited = new Set<string>();

		while (queue.length > 0) {
			const currentId = queue.shift()!;
			if (visited.has(currentId)) continue;
			visited.add(currentId);

			const place = this.placeCache.get(currentId);
			if (!place) continue;

			for (const childId of place.childIds) {
				const child = this.placeCache.get(childId);
				if (child && !visited.has(childId)) {
					descendants.push(child);
					queue.push(childId);
				}
			}
		}

		return descendants;
	}

	/**
	 * Gets the full hierarchy path for a place (from root to place)
	 */
	getHierarchyPath(placeId: string): PlaceNode[] {
		const ancestors = this.getAncestors(placeId);
		const place = this.placeCache.get(placeId);
		if (!place) return [];

		return [...ancestors.reverse(), place];
	}

	/**
	 * Gets the maximum depth of the place hierarchy
	 */
	getMaxHierarchyDepth(): number {
		this.ensureCacheLoaded();
		let maxDepth = 0;

		for (const place of this.placeCache.values()) {
			const depth = this.getAncestors(place.id).length;
			if (depth > maxDepth) {
				maxDepth = depth;
			}
		}

		return maxDepth + 1; // +1 to include the place itself
	}

	/**
	 * Gets the ancestor of a place at a specific hierarchy level
	 * Level 0 = root (country), Level 1 = state/region, Level 2 = county, etc.
	 * If the place is at or above the requested level, returns the place itself
	 */
	getAncestorAtLevel(placeId: string, level: number): PlaceNode | undefined {
		const place = this.placeCache.get(placeId);
		if (!place) return undefined;

		const path = this.getHierarchyPath(placeId);
		if (path.length === 0) return undefined;

		// If requested level is beyond the path, return the place itself
		if (level >= path.length) {
			return place;
		}

		return path[level];
	}

	/**
	 * Resolve a place name to its ancestor at a specific level
	 * Tries to find the place by name, then gets its ancestor
	 */
	resolveToAncestorLevel(placeName: string, level: number): string {
		const place = this.getPlaceByName(placeName);
		if (!place) {
			// If place not found, return original name
			return placeName;
		}

		const ancestor = this.getAncestorAtLevel(place.id, level);
		return ancestor ? ancestor.name : placeName;
	}

	/**
	 * Gets places that have no parent (root-level or orphans)
	 */
	getRootPlaces(): PlaceNode[] {
		this.ensureCacheLoaded();
		return Array.from(this.placeCache.values()).filter(p => !p.parentId);
	}

	/**
	 * Gets all place references from person notes
	 */
	getPlaceReferences(): PlaceReference[] {
		this.ensureCacheLoaded();
		return [...this.placeReferenceCache];
	}

	/**
	 * Gets place references by type (birth, death, etc.)
	 */
	getPlaceReferencesByType(type: PlaceReferenceType): PlaceReference[] {
		this.ensureCacheLoaded();
		return this.placeReferenceCache.filter(r => r.referenceType === type);
	}

	/**
	 * Gets all unique places referenced by person notes (linked or unlinked)
	 */
	getReferencedPlaces(): Map<string, { count: number; linked: boolean }> {
		this.ensureCacheLoaded();
		const referenced = new Map<string, { count: number; linked: boolean }>();

		for (const ref of this.placeReferenceCache) {
			const key = ref.placeId || ref.rawValue;
			const existing = referenced.get(key);
			if (existing) {
				existing.count++;
			} else {
				referenced.set(key, { count: 1, linked: ref.isLinked });
			}
		}

		return referenced;
	}

	/**
	 * Gets people associated with a place
	 */
	getPeopleAtPlace(placeIdOrName: string): { personId: string; referenceType: PlaceReferenceType }[] {
		this.ensureCacheLoaded();
		const results: { personId: string; referenceType: PlaceReferenceType }[] = [];

		for (const ref of this.placeReferenceCache) {
			if (ref.placeId === placeIdOrName || ref.rawValue === placeIdOrName) {
				results.push({
					personId: ref.personId,
					referenceType: ref.referenceType
				});
			}
		}

		return results;
	}

	/**
	 * Calculates comprehensive place statistics
	 */
	calculateStatistics(): PlaceStatistics {
		this.ensureCacheLoaded();

		const allPlaces = Array.from(this.placeCache.values());
		const issues: PlaceIssue[] = [];

		// Count by category
		const byCategory: Record<PlaceCategory, number> = {
			real: 0,
			historical: 0,
			disputed: 0,
			legendary: 0,
			mythological: 0,
			fictional: 0
		};

		// Count by type (starts with known types, will add custom types dynamically)
		const byType: Record<string, number> = {
			planet: 0,
			continent: 0,
			country: 0,
			state: 0,
			province: 0,
			region: 0,
			county: 0,
			city: 0,
			town: 0,
			village: 0,
			district: 0,
			parish: 0,
			castle: 0,
			estate: 0,
			cemetery: 0,
			church: 0
		};

		// Count by universe
		const byUniverse: Record<string, number> = {};

		// Count by collection
		const byCollection: Record<string, number> = {};

		let withCoordinates = 0;
		let orphanPlaces = 0;

		for (const place of allPlaces) {
			// Category counting
			byCategory[place.category]++;

			// Type counting (handle both known and custom types)
			if (place.placeType) {
				if (byType[place.placeType] === undefined) {
					byType[place.placeType] = 0;
				}
				byType[place.placeType]++;
			}

			// Universe counting
			if (place.universe) {
				byUniverse[place.universe] = (byUniverse[place.universe] || 0) + 1;
			}

			// Collection counting
			if (place.collection) {
				byCollection[place.collection] = (byCollection[place.collection] || 0) + 1;
			}

			// Coordinates
			if (place.coordinates) {
				withCoordinates++;
			}

			// Orphan detection (no parent and not a top-level place type)
			if (!place.parentId && place.placeType && !['continent', 'country'].includes(place.placeType)) {
				orphanPlaces++;
				issues.push({
					type: 'orphan_place',
					message: `Place "${place.name}" has no parent place defined`,
					placeId: place.id,
					placeName: place.name,
					filePath: place.filePath
				});
			}

			// Data quality checks
			if (supportsRealCoordinates(place.category) && !place.coordinates && place.category === 'real') {
				issues.push({
					type: 'real_missing_coords',
					message: `Real-world place "${place.name}" has no coordinates`,
					placeId: place.id,
					placeName: place.name,
					filePath: place.filePath
				});
			}

			if (!supportsRealCoordinates(place.category) && place.coordinates) {
				issues.push({
					type: 'fictional_with_coords',
					message: `${place.category} place "${place.name}" has real-world coordinates (possible mistake)`,
					placeId: place.id,
					placeName: place.name,
					filePath: place.filePath
				});
			}
		}

		// Check for duplicate names
		const nameCount = new Map<string, PlaceNode[]>();
		for (const place of allPlaces) {
			const lowerName = place.name.toLowerCase();
			if (!nameCount.has(lowerName)) {
				nameCount.set(lowerName, []);
			}
			nameCount.get(lowerName)!.push(place);
		}

		for (const places of nameCount.values()) {
			if (places.length > 1) {
				issues.push({
					type: 'duplicate_name',
					message: `Multiple places named "${places[0].name}" (${places.length} instances)`,
					placeName: places[0].name
				});
			}
		}

		// Check for circular hierarchies
		for (const place of allPlaces) {
			const ancestors = this.getAncestors(place.id);
			if (ancestors.some(a => a.id === place.id)) {
				issues.push({
					type: 'circular_hierarchy',
					message: `Circular hierarchy detected for place "${place.name}"`,
					placeId: place.id,
					placeName: place.name,
					filePath: place.filePath
				});
			}
		}

		// Calculate top birth/death places
		const birthPlaceCounts = new Map<string, number>();
		const deathPlaceCounts = new Map<string, number>();

		for (const ref of this.placeReferenceCache) {
			const key = ref.placeId || ref.rawValue;
			if (ref.referenceType === 'birth') {
				birthPlaceCounts.set(key, (birthPlaceCounts.get(key) || 0) + 1);
			} else if (ref.referenceType === 'death') {
				deathPlaceCounts.set(key, (deathPlaceCounts.get(key) || 0) + 1);
			}
		}

		const topBirthPlaces = Array.from(birthPlaceCounts.entries())
			.map(([place, count]) => ({ place, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 10);

		const topDeathPlaces = Array.from(deathPlaceCounts.entries())
			.map(([place, count]) => ({ place, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 10);

		// Calculate migration patterns
		const migrationPatterns = this.calculateMigrationPatterns();

		// Check for missing place notes (references to non-existent places)
		const referencedPlaces = this.getReferencedPlaces();
		for (const [key, info] of referencedPlaces.entries()) {
			if (!info.linked && !this.placeCache.has(key)) {
				issues.push({
					type: 'missing_place_note',
					message: `Place "${key}" is referenced by ${info.count} person(s) but has no place note`,
					placeName: key
				});
			}
		}

		return {
			totalPlaces: allPlaces.length,
			withCoordinates,
			orphanPlaces,
			maxHierarchyDepth: this.getMaxHierarchyDepth(),
			byCategory,
			byType,
			byUniverse,
			byCollection,
			topBirthPlaces,
			topDeathPlaces,
			migrationPatterns,
			issues
		};
	}

	/**
	 * Calculate migration patterns (birth place -> death place)
	 */
	private calculateMigrationPatterns(): Array<{ from: string; to: string; count: number }> {
		// Group references by person
		const personPlaces = new Map<string, { birth?: string; death?: string }>();

		for (const ref of this.placeReferenceCache) {
			if (!personPlaces.has(ref.personId)) {
				personPlaces.set(ref.personId, {});
			}
			const places = personPlaces.get(ref.personId)!;

			if (ref.referenceType === 'birth') {
				places.birth = ref.placeId || ref.rawValue;
			} else if (ref.referenceType === 'death') {
				places.death = ref.placeId || ref.rawValue;
			}
		}

		// Count migrations
		const migrationCounts = new Map<string, number>();

		for (const places of personPlaces.values()) {
			if (places.birth && places.death && places.birth !== places.death) {
				const key = `${places.birth}|${places.death}`;
				migrationCounts.set(key, (migrationCounts.get(key) || 0) + 1);
			}
		}

		// Convert to array and sort
		return Array.from(migrationCounts.entries())
			.map(([key, count]) => {
				const [from, to] = key.split('|');
				return { from, to, count };
			})
			.sort((a, b) => b.count - a.count)
			.slice(0, 20);
	}

	/**
	 * Get detailed migration data with birth/death years for filtering
	 * Returns individual migrations rather than aggregated counts
	 */
	getDetailedMigrations(): Array<{
		personId: string;
		from: string;
		to: string;
		birthYear?: number;
		deathYear?: number;
		collection?: string;
	}> {
		this.ensureCacheLoaded();

		const migrations: Array<{
			personId: string;
			from: string;
			to: string;
			birthYear?: number;
			deathYear?: number;
			collection?: string;
		}> = [];

		// Build a map of person data from frontmatter
		const files = this.app.vault.getMarkdownFiles();
		const personData = new Map<string, {
			birthPlace?: string;
			deathPlace?: string;
			birthYear?: number;
			deathYear?: number;
			collection?: string;
		}>();

		for (const file of files) {
			if (this.folderFilter && !this.folderFilter.shouldIncludeFile(file)) {
				continue;
			}

			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;
			if (fm.type === 'place' || !fm.cr_id) continue;

			const data: {
				birthPlace?: string;
				deathPlace?: string;
				birthYear?: number;
				deathYear?: number;
				collection?: string;
			} = {};

			// Extract birth place
			if (fm.birth_place) {
				const wikilinkMatch = String(fm.birth_place).match(/\[\[([^\]]+)\]\]/);
				data.birthPlace = wikilinkMatch ? wikilinkMatch[1] : fm.birth_place;
			}

			// Extract death place
			if (fm.death_place) {
				const wikilinkMatch = String(fm.death_place).match(/\[\[([^\]]+)\]\]/);
				data.deathPlace = wikilinkMatch ? wikilinkMatch[1] : fm.death_place;
			}

			// Extract birth year from birth_date
			if (fm.birth_date) {
				const year = this.extractYear(fm.birth_date);
				if (year) data.birthYear = year;
			}

			// Extract death year from death_date
			if (fm.death_date) {
				const year = this.extractYear(fm.death_date);
				if (year) data.deathYear = year;
			}

			// Extract collection
			if (fm.collection) {
				data.collection = fm.collection;
			}

			if (data.birthPlace || data.deathPlace) {
				personData.set(fm.cr_id, data);
			}
		}

		// Build migration records
		for (const [personId, data] of personData) {
			if (data.birthPlace && data.deathPlace && data.birthPlace !== data.deathPlace) {
				migrations.push({
					personId,
					from: data.birthPlace,
					to: data.deathPlace,
					birthYear: data.birthYear,
					deathYear: data.deathYear,
					collection: data.collection
				});
			}
		}

		return migrations;
	}

	/**
	 * Extract year from a date string (supports various formats)
	 */
	private extractYear(dateValue: unknown): number | undefined {
		if (!dateValue) return undefined;

		// If dateValue is an object, try to extract a string representation
		let str: string;
		if (typeof dateValue === 'object' && dateValue !== null) {
			str = JSON.stringify(dateValue);
		} else {
			// At this point, dateValue is a primitive
			str = String(dateValue);
		}

		// Try ISO format (YYYY-MM-DD or YYYY)
		const isoMatch = str.match(/^(\d{4})/);
		if (isoMatch) {
			return parseInt(isoMatch[1], 10);
		}

		// Try common formats with year at end (DD MMM YYYY, MM/DD/YYYY, etc.)
		const yearAtEndMatch = str.match(/(\d{4})$/);
		if (yearAtEndMatch) {
			return parseInt(yearAtEndMatch[1], 10);
		}

		// Try to find any 4-digit year
		const anyYearMatch = str.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
		if (anyYearMatch) {
			return parseInt(anyYearMatch[1], 10);
		}

		return undefined;
	}

	/**
	 * Get the range of years in migration data
	 */
	getMigrationYearRange(): { min: number; max: number } | null {
		const migrations = this.getDetailedMigrations();
		const years: number[] = [];

		for (const m of migrations) {
			if (m.birthYear) years.push(m.birthYear);
			if (m.deathYear) years.push(m.deathYear);
		}

		if (years.length === 0) return null;

		return {
			min: Math.min(...years),
			max: Math.max(...years)
		};
	}

	/**
	 * Get unique collections from migration data with counts
	 */
	getMigrationCollections(): Array<{ name: string; count: number }> {
		const migrations = this.getDetailedMigrations();
		const collectionCounts = new Map<string, number>();

		for (const m of migrations) {
			if (m.collection) {
				collectionCounts.set(m.collection, (collectionCounts.get(m.collection) || 0) + 1);
			}
		}

		return Array.from(collectionCounts.entries())
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count);
	}

	/**
	 * Clears the place cache
	 */
	clearCache(): void {
		this.placeCache.clear();
		this.placeReferenceCache = [];
	}

	/**
	 * Loads all place notes from vault into cache
	 */
	private loadPlaceCache(): void {
		this.placeCache.clear();

		const files = this.app.vault.getMarkdownFiles();

		// First pass: load all place nodes
		for (const file of files) {
			if (this.folderFilter && !this.folderFilter.shouldIncludeFile(file)) {
				continue;
			}

			const placeNode = this.extractPlaceNode(file);
			if (placeNode) {
				this.placeCache.set(placeNode.id, placeNode);
			}
		}

		// Second pass: build parent-child relationships
		for (const place of this.placeCache.values()) {
			if (place.parentId) {
				const parent = this.placeCache.get(place.parentId);
				if (parent && !parent.childIds.includes(place.id)) {
					parent.childIds.push(place.id);
				}
			}
		}

		logger.info('loadPlaceCache', `Loaded ${this.placeCache.size} place notes`);
	}

	/**
	 * Loads all place references from person notes
	 */
	private loadPlaceReferences(): void {
		this.placeReferenceCache = [];

		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			if (this.folderFilter && !this.folderFilter.shouldIncludeFile(file)) {
				continue;
			}

			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;

			// Skip place notes (we only want person notes)
			if (fm.type === 'place') continue;

			// Must have cr_id to be a valid person note
			if (!fm.cr_id) continue;

			const personId = fm.cr_id;

			// Extract birth place
			if (fm.birth_place) {
				this.placeReferenceCache.push(
					this.createPlaceReference(fm.birth_place, fm.birth_place_id, personId, 'birth')
				);
			}

			// Extract death place
			if (fm.death_place) {
				this.placeReferenceCache.push(
					this.createPlaceReference(fm.death_place, fm.death_place_id, personId, 'death')
				);
			}

			// Extract marriage locations from indexed spouse format
			let spouseIndex = 1;
			while (fm[`spouse${spouseIndex}`] || fm[`spouse${spouseIndex}_id`]) {
				const marriageLocation = fm[`spouse${spouseIndex}_marriage_location`];
				if (marriageLocation) {
					this.placeReferenceCache.push(
						this.createPlaceReference(marriageLocation, undefined, personId, 'marriage')
					);
				}
				spouseIndex++;
			}

			// Extract burial place if present
			if (fm.burial_place) {
				this.placeReferenceCache.push(
					this.createPlaceReference(fm.burial_place, fm.burial_place_id, personId, 'burial')
				);
			}
		}

		logger.info('loadPlaceReferences', `Found ${this.placeReferenceCache.length} place references`);
	}

	/**
	 * Creates a place reference from frontmatter values
	 */
	private createPlaceReference(
		rawValue: string,
		placeId: string | undefined,
		personId: string,
		referenceType: PlaceReferenceType
	): PlaceReference {
		// Check if it's a wikilink
		const wikilinkMatch = rawValue.match(/\[\[([^\]]+)\]\]/);
		let resolvedPlaceId = placeId;
		let isLinked = false;

		if (wikilinkMatch) {
			const linkTarget = wikilinkMatch[1];
			// Try to find the place by name
			const place = this.getPlaceByName(linkTarget);
			if (place) {
				resolvedPlaceId = place.id;
				isLinked = true;
			}
		} else if (placeId) {
			// Direct ID reference
			isLinked = this.placeCache.has(placeId);
		}

		return {
			placeId: resolvedPlaceId,
			rawValue,
			isLinked,
			referenceType,
			personId
		};
	}

	/**
	 * Extracts place node data from a file
	 */
	private extractPlaceNode(file: TFile): PlaceNode | null {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) return null;

		const fm = cache.frontmatter;

		// Must be a place note (type: place)
		if (fm.type !== 'place') return null;

		// Must have cr_id
		if (!fm.cr_id) return null;

		// Extract category using value alias resolution (default to 'real')
		const category: PlaceCategory = this.resolvePlaceCategory(fm.place_category);

		// Extract name (from frontmatter or filename)
		const name = fm.name || file.basename;

		// Extract aliases
		const aliases: string[] = Array.isArray(fm.aliases)
			? fm.aliases
			: fm.aliases ? [fm.aliases] : [];

		// Extract parent ID
		const parentId: string | undefined = fm.parent_place_id;
		if (!parentId && fm.parent_place) {
			// Try to resolve from wikilink
			const wikilinkMatch = String(fm.parent_place).match(/\[\[([^\]]+)\]\]/);
			if (wikilinkMatch) {
				// We'll need to resolve this later after all places are loaded
				// For now, store the name and resolve in second pass
			}
		}

		// Extract coordinates
		let coordinates: GeoCoordinates | undefined;
		if (fm.coordinates && typeof fm.coordinates === 'object') {
			if (fm.coordinates.lat !== undefined && fm.coordinates.long !== undefined) {
				coordinates = {
					lat: Number(fm.coordinates.lat),
					long: Number(fm.coordinates.long)
				};
			}
		}

		// Extract custom coordinates
		let customCoordinates: CustomCoordinates | undefined;
		if (fm.custom_coordinates && typeof fm.custom_coordinates === 'object') {
			if (fm.custom_coordinates.x !== undefined && fm.custom_coordinates.y !== undefined) {
				customCoordinates = {
					x: Number(fm.custom_coordinates.x),
					y: Number(fm.custom_coordinates.y),
					map: fm.custom_coordinates.map
				};
			}
		}

		return {
			id: fm.cr_id,
			name,
			filePath: file.path,
			category,
			placeType: fm.place_type,
			universe: supportsUniverse(category) ? fm.universe : undefined,
			parentId,
			childIds: [],
			aliases,
			coordinates,
			customCoordinates,
			collection: fm.collection
		};
	}
}
