/**
 * Family Graph Service
 *
 * Builds and traverses family relationship graphs from person notes in the vault.
 * Supports generating ancestor trees, descendant trees, and full family trees.
 */

import { App, TFile } from 'obsidian';
import { getLogger } from './logging';
import { SpouseRelationship } from '../models/person';
import { PersonFrontmatter } from '../types/frontmatter';
import { FolderFilterService } from './folder-filter';
import { PersonIndexService } from './person-index-service';
import type { CanvasRootsSettings, ValueAliasSettings } from '../settings';
import { CANONICAL_GENDERS, BUILTIN_SYNONYMS } from './value-alias-service';
import { isSourceNote, isEventNote, isPlaceNote } from '../utils/note-type-detection';
import type { RawRelationship, FamilyGraphMapping } from '../relationships/types/relationship-types';
import { getRelationshipType, getAllRelationshipTypesWithCustomizations } from '../relationships/constants/default-relationship-types';

const logger = getLogger('FamilyGraph');

/**
 * Represents a person node in the family graph
 */
export interface PersonNode {
	crId: string;
	name: string;
	birthDate?: string;
	deathDate?: string;
	birthPlace?: string;
	deathPlace?: string;
	burialPlace?: string;
	occupation?: string;
	sex?: string;
	pronouns?: string;
	researchLevel?: number;  // Research level (0-6) based on Hoitink's Six Levels
	cr_living?: boolean;  // Manual override for living status (bypasses automatic detection)
	file: TFile;

	// Biological parent relationships (as cr_ids)
	fatherCrId?: string;
	motherCrId?: string;

	// Step-parent relationships (can have multiple step-parents)
	stepfatherCrIds: string[];
	stepmotherCrIds: string[];

	// Adoptive parent relationships (gender-specific)
	adoptiveFatherCrId?: string;
	adoptiveMotherCrId?: string;

	// Gender-neutral adoptive parent relationships
	adoptiveParentCrIds: string[];

	// Adopted children (from parent's perspective - used to infer reverse relationship)
	adoptedChildCrIds: string[];

	// Gender-neutral parent relationships (opt-in via settings)
	parentCrIds: string[];

	// Spouse and child relationships
	spouseCrIds: string[];
	childrenCrIds: string[];

	// Enhanced spouse relationships with metadata (optional)
	spouses?: SpouseRelationship[];

	// Collection naming (optional)
	collectionName?: string;

	// User-defined collection (optional)
	collection?: string;

	// Fictional universe (optional)
	universe?: string;

	// Source count (number of source notes linking to this person)
	sourceCount?: number;

	// Research coverage percentage (0-100, only when fact-level tracking enabled)
	researchCoveragePercent?: number;

	// Conflict count (number of unresolved source conflicts for this person)
	conflictCount?: number;

	// Media files linked to this person (wikilinks)
	media?: string[];

	// Fields marked as private by user (from private_fields frontmatter)
	privateFields?: string[];
}

/**
 * Tree generation options
 */
export interface TreeOptions {
	/** Root person's cr_id */
	rootCrId: string;

	/** Tree type to generate */
	treeType: 'ancestors' | 'descendants' | 'full';

	/** Maximum number of generations (0 = unlimited) */
	maxGenerations?: number;

	/** Include spouses */
	includeSpouses?: boolean;

	/** Include step-parents in tree (default: false for ancestors, true for full) */
	includeStepParents?: boolean;

	/** Include adoptive parents in tree (default: false for ancestors, true for full) */
	includeAdoptiveParents?: boolean;

	/** Filter tree to only include people in this collection */
	collectionFilter?: string;

	/** Filter tree to only include people associated with this place */
	placeFilter?: {
		placeName: string;
		types: ('birth' | 'death' | 'marriage' | 'burial')[];
	};
}

/**
 * Represents the generated tree structure
 */
export interface FamilyTree {
	root: PersonNode;
	nodes: Map<string, PersonNode>;
	edges: FamilyEdge[];
}

/**
 * Represents a relationship edge in the tree
 */
export interface FamilyEdge {
	from: string; // cr_id
	to: string;   // cr_id
	type: 'parent' | 'spouse' | 'child' | 'relationship';
	/** For custom relationships, the relationship type ID */
	relationshipTypeId?: string;
	/** Display label for the relationship */
	relationshipLabel?: string;
}

/**
 * Represents a connection between two user collections
 */
export interface CollectionConnection {
	fromCollection: string;
	toCollection: string;
	bridgePeople: PersonNode[];
	relationshipCount: number;
}

/**
 * Analytics data for collections
 */
export interface CollectionAnalytics {
	totalPeople: number;
	totalFamilies: number;
	totalUserCollections: number;
	totalCollections: number;
	averageCollectionSize: number;
	largestCollection: { name: string; size: number } | null;
	smallestCollection: { name: string; size: number } | null;
	dataCompleteness: {
		birthDatePercent: number;
		deathDatePercent: number;
		sexPercent: number;
	};
	relationshipMetrics: {
		peopleWithParents: number;
		peopleWithSpouses: number;
		peopleWithChildren: number;
		orphanedPeople: number;
	};
	crossCollectionMetrics: {
		totalConnections: number;
		totalBridgePeople: number;
		topConnections: Array<{
			from: string;
			to: string;
			bridgeCount: number;
		}>;
	};
	dateRange: {
		earliest?: number;
		latest?: number;
		span?: number;
	};
}

/**
 * Service for building and traversing family graphs
 */
export class FamilyGraphService {
	private app: App;
	private personCache: Map<string, PersonNode>;
	private folderFilter: FolderFilterService | null = null;
	private personIndex: PersonIndexService | null = null;
	private propertyAliases: Record<string, string> = {};
	private valueAliases: ValueAliasSettings = { eventType: {}, sex: {}, gender_identity: {}, placeCategory: {}, noteType: {} };
	private settings: CanvasRootsSettings | null = null;

	constructor(app: App) {
		this.app = app;
		this.personCache = new Map();
	}

	/**
	 * Set the folder filter service for filtering person notes by folder
	 */
	setFolderFilter(folderFilter: FolderFilterService): void {
		this.folderFilter = folderFilter;
	}

	/**
	 * Set the person index service for wikilink resolution
	 */
	setPersonIndex(personIndex: PersonIndexService): void {
		this.personIndex = personIndex;
	}

	/**
	 * Set the full plugin settings for note type detection
	 */
	setSettings(settings: CanvasRootsSettings): void {
		this.settings = settings;
	}

	/**
	 * Set property aliases for reading frontmatter with custom property names
	 */
	setPropertyAliases(aliases: Record<string, string>): void {
		this.propertyAliases = aliases;
	}

	/**
	 * Set value aliases for resolving custom property values to canonical values
	 */
	setValueAliases(aliases: ValueAliasSettings): void {
		this.valueAliases = aliases;
	}

	/**
	 * Resolve a frontmatter property value, checking aliases if canonical property not found
	 * Canonical property takes precedence over aliased property
	 */
	private resolveProperty<T>(fm: Record<string, unknown>, canonicalProperty: string): T | undefined {
		// Canonical property takes precedence
		if (fm[canonicalProperty] !== undefined) {
			return fm[canonicalProperty] as T;
		}

		// Check aliases - find user property that maps to this canonical property
		for (const [userProp, canonicalProp] of Object.entries(this.propertyAliases)) {
			if (canonicalProp === canonicalProperty && fm[userProp] !== undefined) {
				return fm[userProp] as T;
			}
		}

		return undefined;
	}

	/**
	 * Resolve a gender value to canonical form using value aliases and built-in synonyms.
	 * Resolution order:
	 * 1. If value is already canonical (M, F, X, U), return it
	 * 2. If value has a user-defined alias configured, return the canonical value
	 * 3. If value matches a built-in synonym, return the canonical value
	 * 4. Otherwise pass through unchanged
	 */
	private resolveGender(userValue: string | undefined): string | undefined {
		if (!userValue) return undefined;

		const normalized = userValue.toLowerCase().trim();

		// Check if already canonical (case-insensitive match against M, F, X, U)
		const canonicalMatch = CANONICAL_GENDERS.find(v => v.toLowerCase() === normalized);
		if (canonicalMatch) {
			return canonicalMatch;
		}

		// Check user-defined value aliases first
		const userAliasedValue = this.valueAliases?.sex?.[normalized];
		if (userAliasedValue) {
			return userAliasedValue;
		}

		// Check built-in synonyms (male→M, female→F, etc.)
		const builtinValue = BUILTIN_SYNONYMS.sex[normalized];
		if (builtinValue) {
			return builtinValue;
		}

		// Pass through unchanged
		return userValue;
	}

	/**
	 * Force reload the person cache
	 * Use when you know data has changed and need fresh data
	 */
	async reloadCache(): Promise<void> {
		this.personCache.clear();

		// Wait for Obsidian's metadata cache to finish processing file changes
		// After batch operations, files are modified but Obsidian's file watcher
		// needs time to detect changes and update the metadata cache
		await new Promise(resolve => setTimeout(resolve, 2000));

		this.loadPersonCache();
	}

	/**
	 * Generates a family tree starting from a root person
	 */
	generateTree(options: TreeOptions): FamilyTree | null {
		// Load all person nodes into cache
		this.loadPersonCache();

		logger.info('generate-tree', 'Person cache loaded', {
			totalPeople: this.personCache.size,
			cacheIds: Array.from(this.personCache.keys())
		});

		const rootNode = this.personCache.get(options.rootCrId);
		if (!rootNode) {
			logger.error('generate-tree', 'Root person not found', {
				requestedCrId: options.rootCrId,
				availableIds: Array.from(this.personCache.keys())
			});
			return null;
		}

		logger.info('generate-tree', 'Root person found', {
			name: rootNode.name,
			crId: rootNode.crId,
			hasFather: !!rootNode.fatherCrId,
			hasMother: !!rootNode.motherCrId,
			fatherCrId: rootNode.fatherCrId,
			motherCrId: rootNode.motherCrId
		});

		const nodes = new Map<string, PersonNode>();
		const edges: FamilyEdge[] = [];

		// Build tree based on type
		switch (options.treeType) {
			case 'ancestors':
				logger.info('build-tree', 'Building ancestor tree');
				this.buildAncestorTree(rootNode, nodes, edges, options, 0);
				break;
			case 'descendants':
				logger.info('build-tree', 'Building descendant tree');
				this.buildDescendantTree(rootNode, nodes, edges, options, 0);
				break;
			case 'full':
				logger.info('build-tree', 'Building full tree');
				this.buildFullTree(rootNode, nodes, edges, options);
				break;
		}

		logger.info('build-tree', 'Tree construction complete', {
			nodeCount: nodes.size,
			edgeCount: edges.length,
			nodes: Array.from(nodes.values()).map(n => n.name)
		});

		return {
			root: rootNode,
			nodes,
			edges
		};
	}

	/**
	 * Gets the total count of people in the vault (must call after generateTree)
	 * This uses the cached person data from the most recent tree generation.
	 */
	getTotalPeopleCount(): number {
		// If cache is empty, load it
		if (this.personCache.size === 0) {
			this.loadPersonCache();
		}
		return this.personCache.size;
	}

	/**
	 * Gets a person by their cr_id
	 * Note: Call ensureCacheLoaded() or generateTree() first to ensure cache is loaded
	 */
	getPersonByCrId(crId: string): PersonNode | undefined {
		return this.personCache.get(crId);
	}

	/**
	 * Ensures the person cache is loaded
	 */
	ensureCacheLoaded(): void {
		if (this.personCache.size === 0) {
			this.loadPersonCache();
		}
	}

	/**
	 * Determines the collection name for a group of people
	 * Uses conflict resolution: most common group_name wins, ties broken alphabetically
	 * Returns undefined if no one in the group has a group_name
	 */
	private getCollectionName(people: PersonNode[]): string | undefined {
		// Count frequency of each collection name
		const nameFrequency = new Map<string, number>();

		for (const person of people) {
			if (person.collectionName) {
				const count = nameFrequency.get(person.collectionName) || 0;
				nameFrequency.set(person.collectionName, count + 1);
			}
		}

		// If no collection names, return undefined
		if (nameFrequency.size === 0) {
			return undefined;
		}

		// Find the most common name (ties broken alphabetically)
		let mostCommonName: string | undefined;
		let maxCount = 0;

		for (const [name, count] of nameFrequency.entries()) {
			if (count > maxCount || (count === maxCount && (!mostCommonName || name < mostCommonName))) {
				mostCommonName = name;
				maxCount = count;
			}
		}

		return mostCommonName;
	}

	/**
	 * Finds all disconnected family components in the vault
	 * Returns an array of components, each with representative person, size, and collection name
	 */
	findAllFamilyComponents(): Array<{ representative: PersonNode; size: number; people: PersonNode[]; collectionName?: string }> {
		// Ensure cache is loaded
		if (this.personCache.size === 0) {
			this.loadPersonCache();
		}

		const visited = new Set<string>();
		const components: Array<{ representative: PersonNode; size: number; people: PersonNode[]; collectionName?: string }> = [];

		// BFS to find each connected component
		for (const [crId] of this.personCache) {
			if (visited.has(crId)) continue;

			const component: PersonNode[] = [];
			const queue: string[] = [crId];

			while (queue.length > 0) {
				const currentCrId = queue.shift()!;
				if (visited.has(currentCrId)) continue;

				visited.add(currentCrId);
				const currentPerson = this.personCache.get(currentCrId);
				if (!currentPerson) continue;

				component.push(currentPerson);

				// Add all connected people (parents, spouses, children)
				const related: string[] = [];

				if (currentPerson.fatherCrId) related.push(currentPerson.fatherCrId);
				if (currentPerson.motherCrId) related.push(currentPerson.motherCrId);
				if (currentPerson.parentCrIds) related.push(...currentPerson.parentCrIds);
				if (currentPerson.spouseCrIds) related.push(...currentPerson.spouseCrIds);
				if (currentPerson.childrenCrIds) related.push(...currentPerson.childrenCrIds);

				for (const relatedCrId of related) {
					if (!visited.has(relatedCrId) && this.personCache.has(relatedCrId)) {
						queue.push(relatedCrId);
					}
				}
			}

			// Find representative (oldest person by birth date, or first alphabetically)
			const representative = component.reduce((oldest, current) => {
				if (!oldest.birthDate && current.birthDate) return current;
				if (oldest.birthDate && !current.birthDate) return oldest;
				if (oldest.birthDate && current.birthDate && current.birthDate < oldest.birthDate) return current;
				if (oldest.birthDate === current.birthDate && current.name < oldest.name) return current;
				return oldest;
			});

			// Determine collection name using conflict resolution
			const collectionName = this.getCollectionName(component);

			components.push({
				representative,
				size: component.length,
				people: component,
				collectionName
			});
		}

		// Sort by size (largest first)
		components.sort((a, b) => b.size - a.size);

		return components;
	}

	/**
	 * Gets all user-defined collections
	 * Returns collections grouped by the 'collection' property
	 */
	getUserCollections(): Array<{ name: string; people: PersonNode[]; size: number }> {
		// Ensure cache is loaded
		if (this.personCache.size === 0) {
			this.loadPersonCache();
		}

		const peopleByCollection = new Map<string, PersonNode[]>();

		// Group people by their collection property
		for (const person of this.personCache.values()) {
			if (person.collection) {
				// Handle case where collection might be an array or non-string
				const collectionName = typeof person.collection === 'string'
					? person.collection
					: Array.isArray(person.collection)
						? person.collection[0]
						: String(person.collection);
				if (collectionName) {
					if (!peopleByCollection.has(collectionName)) {
						peopleByCollection.set(collectionName, []);
					}
					peopleByCollection.get(collectionName)!.push(person);
				}
			}
		}

		// Convert to array and add size
		const collections = Array.from(peopleByCollection.entries()).map(([name, people]) => ({
			name,
			people,
			size: people.length
		}));

		// Sort by size (largest first), then alphabetically
		collections.sort((a, b) => {
			if (b.size !== a.size) return b.size - a.size;
			return a.name.localeCompare(b.name);
		});

		return collections;
	}

	/**
	 * Gets all unique universes from person notes
	 */
	getAllUniverses(): string[] {
		// Ensure cache is loaded
		if (this.personCache.size === 0) {
			this.loadPersonCache();
		}

		const universes = new Set<string>();
		for (const person of this.personCache.values()) {
			if (person.universe) {
				universes.add(person.universe);
			}
		}
		return Array.from(universes).sort();
	}

	/**
	 * Detects connections between user collections
	 * Finds "bridge people" who have relationships across collection boundaries
	 */
	detectCollectionConnections(): CollectionConnection[] {
		// Ensure cache is loaded
		if (this.personCache.size === 0) {
			this.loadPersonCache();
		}

		const connections = new Map<string, CollectionConnection>();

		// For each person with a collection
		for (const person of this.personCache.values()) {
			if (!person.collection) continue;

			// Check all their relationships
			const relatedCrIds = [
				person.fatherCrId,
				person.motherCrId,
				...person.spouseCrIds,
				...person.childrenCrIds
			].filter((id): id is string => id !== undefined);

			for (const relatedCrId of relatedCrIds) {
				const relatedPerson = this.personCache.get(relatedCrId);

				// If related person has a different collection, it's a bridge
				if (relatedPerson?.collection && relatedPerson.collection !== person.collection) {
					// Create a unique key for this connection (alphabetically sorted)
					const [from, to] = [person.collection, relatedPerson.collection].sort();
					const key = `${from}|${to}`;

					if (!connections.has(key)) {
						connections.set(key, {
							fromCollection: from,
							toCollection: to,
							bridgePeople: [],
							relationshipCount: 0
						});
					}

					const connection = connections.get(key)!;

					// Add person as bridge if not already added
					if (!connection.bridgePeople.find(p => p.crId === person.crId)) {
						connection.bridgePeople.push(person);
					}

					connection.relationshipCount++;
				}
			}
		}

		// Convert to array and sort by relationship count
		return Array.from(connections.values())
			.sort((a, b) => b.relationshipCount - a.relationshipCount);
	}

	/**
	 * Checks if a person should be included based on collection and place filters
	 */
	private shouldIncludePerson(person: PersonNode, options: TreeOptions): boolean {
		// Check collection filter
		if (options.collectionFilter && person.collection !== options.collectionFilter) {
			return false;
		}

		// Check place filter
		if (options.placeFilter) {
			const { placeName, types } = options.placeFilter;
			const lowerPlaceName = placeName.toLowerCase();

			let matchesPlace = false;

			// Check each specified type
			for (const type of types) {
				switch (type) {
					case 'birth':
						if (person.birthPlace?.toLowerCase().includes(lowerPlaceName)) {
							matchesPlace = true;
						}
						break;
					case 'death':
						if (person.deathPlace?.toLowerCase().includes(lowerPlaceName)) {
							matchesPlace = true;
						}
						break;
					case 'marriage':
						// Check marriage locations in spouse relationships
						if (person.spouses?.some(s =>
							s.marriageLocation?.toLowerCase().includes(lowerPlaceName)
						)) {
							matchesPlace = true;
						}
						break;
					case 'burial':
						if (person.burialPlace?.toLowerCase().includes(lowerPlaceName)) {
							matchesPlace = true;
						}
						break;
				}
				if (matchesPlace) break;
			}

			if (!matchesPlace) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Builds ancestor tree (parents, grandparents, etc.)
	 */
	private buildAncestorTree(
		node: PersonNode,
		nodes: Map<string, PersonNode>,
		edges: FamilyEdge[],
		options: TreeOptions,
		currentGeneration: number,
		visited: Set<string> = new Set()
	): void {
		// Cycle detection: prevent infinite recursion from circular relationships
		if (visited.has(node.crId)) {
			logger.warn('buildAncestorTree', `Circular relationship detected at ${node.crId}, breaking cycle`);
			return;
		}
		visited.add(node.crId);

		// Add current node if it passes filters
		if (!this.shouldIncludePerson(node, options)) {
			return;
		}

		nodes.set(node.crId, node);

		// Check generation limit
		if (options.maxGenerations && currentGeneration >= options.maxGenerations) {
			return;
		}

		// Add father
		if (node.fatherCrId) {
			const father = this.personCache.get(node.fatherCrId);
			if (father && this.shouldIncludePerson(father, options)) {
				edges.push({ from: father.crId, to: node.crId, type: 'parent' });
				this.buildAncestorTree(father, nodes, edges, options, currentGeneration + 1, visited);
			}
		}

		// Add mother
		if (node.motherCrId) {
			const mother = this.personCache.get(node.motherCrId);
			if (mother && this.shouldIncludePerson(mother, options)) {
				edges.push({ from: mother.crId, to: node.crId, type: 'parent' });
				this.buildAncestorTree(mother, nodes, edges, options, currentGeneration + 1, visited);
			}
		}

		// Add gender-neutral parents
		for (const parentCrId of node.parentCrIds) {
			const parent = this.personCache.get(parentCrId);
			if (parent && this.shouldIncludePerson(parent, options)) {
				edges.push({ from: parent.crId, to: node.crId, type: 'parent' });
				this.buildAncestorTree(parent, nodes, edges, options, currentGeneration + 1, visited);
			}
		}

		// Add step-parents if enabled (with distinct edge type)
		if (options.includeStepParents) {
			// Step-fathers
			for (const stepfatherCrId of node.stepfatherCrIds) {
				const stepfather = this.personCache.get(stepfatherCrId);
				if (stepfather && this.shouldIncludePerson(stepfather, options) && !nodes.has(stepfatherCrId)) {
					nodes.set(stepfatherCrId, stepfather);
					edges.push({
						from: stepfather.crId,
						to: node.crId,
						type: 'relationship',
						relationshipTypeId: 'step_parent',
						relationshipLabel: 'Step-father'
					});
					// Don't recurse ancestors for step-parents (they're not blood relatives)
				}
			}

			// Step-mothers
			for (const stepmotherCrId of node.stepmotherCrIds) {
				const stepmother = this.personCache.get(stepmotherCrId);
				if (stepmother && this.shouldIncludePerson(stepmother, options) && !nodes.has(stepmotherCrId)) {
					nodes.set(stepmotherCrId, stepmother);
					edges.push({
						from: stepmother.crId,
						to: node.crId,
						type: 'relationship',
						relationshipTypeId: 'step_parent',
						relationshipLabel: 'Step-mother'
					});
					// Don't recurse ancestors for step-parents (they're not blood relatives)
				}
			}
		}

		// Add adoptive parents if enabled (with distinct edge type)
		if (options.includeAdoptiveParents) {
			// Adoptive father (gender-specific)
			if (node.adoptiveFatherCrId) {
				const adoptiveFather = this.personCache.get(node.adoptiveFatherCrId);
				if (adoptiveFather && this.shouldIncludePerson(adoptiveFather, options) && !nodes.has(node.adoptiveFatherCrId)) {
					nodes.set(node.adoptiveFatherCrId, adoptiveFather);
					edges.push({
						from: adoptiveFather.crId,
						to: node.crId,
						type: 'relationship',
						relationshipTypeId: 'adoptive_parent',
						relationshipLabel: 'Adoptive father'
					});
					// Don't recurse ancestors for adoptive parents (they're not blood relatives)
				}
			}

			// Adoptive mother (gender-specific)
			if (node.adoptiveMotherCrId) {
				const adoptiveMother = this.personCache.get(node.adoptiveMotherCrId);
				if (adoptiveMother && this.shouldIncludePerson(adoptiveMother, options) && !nodes.has(node.adoptiveMotherCrId)) {
					nodes.set(node.adoptiveMotherCrId, adoptiveMother);
					edges.push({
						from: adoptiveMother.crId,
						to: node.crId,
						type: 'relationship',
						relationshipTypeId: 'adoptive_parent',
						relationshipLabel: 'Adoptive mother'
					});
					// Don't recurse ancestors for adoptive parents (they're not blood relatives)
				}
			}

			// Gender-neutral adoptive parents
			for (const adoptiveParentCrId of node.adoptiveParentCrIds) {
				const adoptiveParent = this.personCache.get(adoptiveParentCrId);
				if (adoptiveParent && this.shouldIncludePerson(adoptiveParent, options) && !nodes.has(adoptiveParentCrId)) {
					nodes.set(adoptiveParentCrId, adoptiveParent);
					edges.push({
						from: adoptiveParent.crId,
						to: node.crId,
						type: 'relationship',
						relationshipTypeId: 'adoptive_parent',
						relationshipLabel: 'Adoptive parent'
					});
					// Don't recurse ancestors for adoptive parents (they're not blood relatives)
				}
			}
		}

		// Add spouse edges between parents
		if (node.fatherCrId && node.motherCrId && options.includeSpouses) {
			const father = this.personCache.get(node.fatherCrId);
			const mother = this.personCache.get(node.motherCrId);
			if (father && mother) {
				// Add bidirectional spouse edge (only once)
				if (!edges.some(e =>
					(e.from === father.crId && e.to === mother.crId && e.type === 'spouse') ||
					(e.from === mother.crId && e.to === father.crId && e.type === 'spouse')
				)) {
					edges.push({ from: father.crId, to: mother.crId, type: 'spouse' });
				}
			}
		}

		// Add spouse edges between gender-neutral parents (if exactly 2 parents)
		if (node.parentCrIds.length === 2 && options.includeSpouses) {
			const parent1 = this.personCache.get(node.parentCrIds[0]);
			const parent2 = this.personCache.get(node.parentCrIds[1]);
			if (parent1 && parent2) {
				// Add bidirectional spouse edge (only once)
				if (!edges.some(e =>
					(e.from === parent1.crId && e.to === parent2.crId && e.type === 'spouse') ||
					(e.from === parent2.crId && e.to === parent1.crId && e.type === 'spouse')
				)) {
					edges.push({ from: parent1.crId, to: parent2.crId, type: 'spouse' });
				}
			}
		}
	}

	/**
	 * Builds descendant tree (children, grandchildren, etc.)
	 */
	private buildDescendantTree(
		node: PersonNode,
		nodes: Map<string, PersonNode>,
		edges: FamilyEdge[],
		options: TreeOptions,
		currentGeneration: number,
		visited: Set<string> = new Set()
	): void {
		// Cycle detection: prevent infinite recursion from circular relationships
		if (visited.has(node.crId)) {
			logger.warn('buildDescendantTree', `Circular relationship detected at ${node.crId}, breaking cycle`);
			return;
		}
		visited.add(node.crId);

		// Add current node if it passes filters
		if (!this.shouldIncludePerson(node, options)) {
			return;
		}

		nodes.set(node.crId, node);

		// Check generation limit
		if (options.maxGenerations && currentGeneration >= options.maxGenerations) {
			return;
		}

		// Add spouses if requested
		if (options.includeSpouses) {
			for (const spouseCrId of node.spouseCrIds) {
				const spouse = this.personCache.get(spouseCrId);
				if (spouse && this.shouldIncludePerson(spouse, options)) {
					nodes.set(spouse.crId, spouse);
					edges.push({ from: node.crId, to: spouse.crId, type: 'spouse' });
				}
			}
		}

		// Add children
		for (const childCrId of node.childrenCrIds) {
			const child = this.personCache.get(childCrId);
			if (child && this.shouldIncludePerson(child, options)) {
				edges.push({ from: node.crId, to: child.crId, type: 'parent' });
				this.buildDescendantTree(child, nodes, edges, options, currentGeneration + 1, visited);
			}
		}

		// Add adopted children
		for (const adoptedChildCrId of node.adoptedChildCrIds) {
			const adoptedChild = this.personCache.get(adoptedChildCrId);
			if (adoptedChild && this.shouldIncludePerson(adoptedChild, options) && !nodes.has(adoptedChildCrId)) {
				edges.push({
					from: node.crId,
					to: adoptedChild.crId,
					type: 'relationship',
					relationshipTypeId: 'adoptive_parent',
					relationshipLabel: 'Adopted child'
				});
				// Don't recurse descendants for adopted children (they have their own family line)
			}
		}
	}

	/**
	 * Builds full family tree (complete connected network including in-laws)
	 */
	private buildFullTree(
		node: PersonNode,
		nodes: Map<string, PersonNode>,
		edges: FamilyEdge[],
		options: TreeOptions
	): void {
		const visited = new Set<string>();
		const toProcess: string[] = [node.crId];

		// For full trees, default to including step/adoptive parents unless explicitly disabled
		const includeStepParents = options.includeStepParents !== false;
		const includeAdoptiveParents = options.includeAdoptiveParents !== false;

		// Process all connected people using breadth-first traversal
		while (toProcess.length > 0) {
			const currentCrId = toProcess.shift()!;

			if (visited.has(currentCrId)) {
				continue;
			}

			visited.add(currentCrId);
			const currentPerson = this.personCache.get(currentCrId);

			if (!currentPerson) {
				continue;
			}

			// Skip person if they don't pass filters
			if (!this.shouldIncludePerson(currentPerson, options)) {
				continue;
			}

			// Add current person to tree
			nodes.set(currentCrId, currentPerson);

			// Add edges and queue related people

			// Biological parents
			if (currentPerson.fatherCrId) {
				const father = this.personCache.get(currentPerson.fatherCrId);
				if (father) {
					edges.push({ from: father.crId, to: currentCrId, type: 'parent' });
					toProcess.push(father.crId);
				}
			}

			if (currentPerson.motherCrId) {
				const mother = this.personCache.get(currentPerson.motherCrId);
				if (mother) {
					edges.push({ from: mother.crId, to: currentCrId, type: 'parent' });
					toProcess.push(mother.crId);
				}
			}

			// Gender-neutral parents
			for (const parentCrId of currentPerson.parentCrIds) {
				const parent = this.personCache.get(parentCrId);
				if (parent) {
					edges.push({ from: parent.crId, to: currentCrId, type: 'parent' });
					toProcess.push(parent.crId);
				}
			}

			// Step-parents (with distinct edge type, default enabled for full trees)
			if (includeStepParents) {
				// Step-fathers
				for (const stepfatherCrId of currentPerson.stepfatherCrIds) {
					const stepfather = this.personCache.get(stepfatherCrId);
					if (stepfather && !visited.has(stepfatherCrId)) {
						// Add relationship edge (avoid duplicates)
						if (!edges.some(e =>
							e.from === stepfatherCrId && e.to === currentCrId &&
							e.relationshipTypeId === 'step_parent'
						)) {
							edges.push({
								from: stepfatherCrId,
								to: currentCrId,
								type: 'relationship',
								relationshipTypeId: 'step_parent',
								relationshipLabel: 'Step-father'
							});
						}
						toProcess.push(stepfatherCrId);
					}
				}

				// Step-mothers
				for (const stepmotherCrId of currentPerson.stepmotherCrIds) {
					const stepmother = this.personCache.get(stepmotherCrId);
					if (stepmother && !visited.has(stepmotherCrId)) {
						// Add relationship edge (avoid duplicates)
						if (!edges.some(e =>
							e.from === stepmotherCrId && e.to === currentCrId &&
							e.relationshipTypeId === 'step_parent'
						)) {
							edges.push({
								from: stepmotherCrId,
								to: currentCrId,
								type: 'relationship',
								relationshipTypeId: 'step_parent',
								relationshipLabel: 'Step-mother'
							});
						}
						toProcess.push(stepmotherCrId);
					}
				}
			}

			// Adoptive parents (with distinct edge type, default enabled for full trees)
			if (includeAdoptiveParents) {
				// Adoptive father (gender-specific)
				if (currentPerson.adoptiveFatherCrId) {
					const adoptiveFather = this.personCache.get(currentPerson.adoptiveFatherCrId);
					if (adoptiveFather && !visited.has(currentPerson.adoptiveFatherCrId)) {
						// Add relationship edge (avoid duplicates)
						if (!edges.some(e =>
							e.from === currentPerson.adoptiveFatherCrId && e.to === currentCrId &&
							e.relationshipTypeId === 'adoptive_parent'
						)) {
							edges.push({
								from: currentPerson.adoptiveFatherCrId,
								to: currentCrId,
								type: 'relationship',
								relationshipTypeId: 'adoptive_parent',
								relationshipLabel: 'Adoptive father'
							});
						}
						toProcess.push(currentPerson.adoptiveFatherCrId);
					}
				}

				// Adoptive mother (gender-specific)
				if (currentPerson.adoptiveMotherCrId) {
					const adoptiveMother = this.personCache.get(currentPerson.adoptiveMotherCrId);
					if (adoptiveMother && !visited.has(currentPerson.adoptiveMotherCrId)) {
						// Add relationship edge (avoid duplicates)
						if (!edges.some(e =>
							e.from === currentPerson.adoptiveMotherCrId && e.to === currentCrId &&
							e.relationshipTypeId === 'adoptive_parent'
						)) {
							edges.push({
								from: currentPerson.adoptiveMotherCrId,
								to: currentCrId,
								type: 'relationship',
								relationshipTypeId: 'adoptive_parent',
								relationshipLabel: 'Adoptive mother'
							});
						}
						toProcess.push(currentPerson.adoptiveMotherCrId);
					}
				}

				// Gender-neutral adoptive parents
				for (const adoptiveParentCrId of currentPerson.adoptiveParentCrIds) {
					const adoptiveParent = this.personCache.get(adoptiveParentCrId);
					if (adoptiveParent && !visited.has(adoptiveParentCrId)) {
						// Add relationship edge (avoid duplicates)
						if (!edges.some(e =>
							e.from === adoptiveParentCrId && e.to === currentCrId &&
							e.relationshipTypeId === 'adoptive_parent'
						)) {
							edges.push({
								from: adoptiveParentCrId,
								to: currentCrId,
								type: 'relationship',
								relationshipTypeId: 'adoptive_parent',
								relationshipLabel: 'Adoptive parent'
							});
						}
						toProcess.push(adoptiveParentCrId);
					}
				}
			}

			// Spouse edges between parents (avoid duplicates)
			if (currentPerson.fatherCrId && currentPerson.motherCrId && options.includeSpouses) {
				const father = this.personCache.get(currentPerson.fatherCrId);
				const mother = this.personCache.get(currentPerson.motherCrId);
				if (father && mother) {
					if (!edges.some(e =>
						(e.from === father.crId && e.to === mother.crId && e.type === 'spouse') ||
						(e.from === mother.crId && e.to === father.crId && e.type === 'spouse')
					)) {
						edges.push({ from: father.crId, to: mother.crId, type: 'spouse' });
					}
				}
			}

			// Spouse edges between gender-neutral parents (if exactly 2 parents, avoid duplicates)
			if (currentPerson.parentCrIds.length === 2 && options.includeSpouses) {
				const parent1 = this.personCache.get(currentPerson.parentCrIds[0]);
				const parent2 = this.personCache.get(currentPerson.parentCrIds[1]);
				if (parent1 && parent2) {
					if (!edges.some(e =>
						(e.from === parent1.crId && e.to === parent2.crId && e.type === 'spouse') ||
						(e.from === parent2.crId && e.to === parent1.crId && e.type === 'spouse')
					)) {
						edges.push({ from: parent1.crId, to: parent2.crId, type: 'spouse' });
					}
				}
			}

			// Spouses
			if (options.includeSpouses) {
				for (const spouseCrId of currentPerson.spouseCrIds) {
					const spouse = this.personCache.get(spouseCrId);
					if (spouse) {
						// Add spouse edge (avoid duplicates)
						if (!edges.some(e =>
							(e.from === currentCrId && e.to === spouseCrId && e.type === 'spouse') ||
							(e.from === spouseCrId && e.to === currentCrId && e.type === 'spouse')
						)) {
							edges.push({ from: currentCrId, to: spouseCrId, type: 'spouse' });
						}
						toProcess.push(spouseCrId);
					}
				}
			}

			// Children
			for (const childCrId of currentPerson.childrenCrIds) {
				const child = this.personCache.get(childCrId);
				if (child) {
					edges.push({ from: currentCrId, to: childCrId, type: 'child' });
					toProcess.push(childCrId);
				}
			}
		}
	}

	/**
	 * Loads all person notes from vault into cache
	 */
	private loadPersonCache(): void {
		this.personCache.clear();

		const files = this.app.vault.getMarkdownFiles();
		let folderFilterExcluded = 0;
		let noCrId = 0;
		let isOtherType = 0;
		let noCacheOrFrontmatter = 0;
		let detectedAsSource = 0;
		let detectedAsEvent = 0;
		let detectedAsPlace = 0;

		console.debug(`[DEBUG] loadPersonCache: Starting with ${files.length} total markdown files`);

		for (const file of files) {
			// Apply folder filter if configured
			if (this.folderFilter && !this.folderFilter.shouldIncludeFile(file)) {
				folderFilterExcluded++;
				continue;
			}

			const personNode = this.extractPersonNode(file);
			if (personNode && 'crId' in personNode) {
				this.personCache.set(personNode.crId, personNode);
			} else if (personNode) {
				// It's a typed response indicating what type it is
				if ('isSource' in personNode) {
					detectedAsSource++;
				} else if ('isEvent' in personNode) {
					detectedAsEvent++;
				} else if ('isPlace' in personNode) {
					detectedAsPlace++;
				}
				isOtherType++;
			} else {
				// Debug why this file wasn't included
				const cache = this.app.metadataCache.getFileCache(file);
				if (!cache || !cache.frontmatter) {
					noCacheOrFrontmatter++;
				} else if (!cache.frontmatter.cr_id) {
					noCrId++;
				}
			}
		}

		console.debug(`[DEBUG] loadPersonCache: Found ${this.personCache.size} person notes`);
		console.debug(`[DEBUG] loadPersonCache: Excluded by folder filter: ${folderFilterExcluded}`);
		console.debug(`[DEBUG] loadPersonCache: No cache/frontmatter: ${noCacheOrFrontmatter}`);
		console.debug(`[DEBUG] loadPersonCache: No cr_id: ${noCrId}`);
		console.debug(`[DEBUG] loadPersonCache: Other note type (event/place/source): ${isOtherType}`);
		console.debug(`[DEBUG] loadPersonCache:   - Detected as source: ${detectedAsSource}`);
		console.debug(`[DEBUG] loadPersonCache:   - Detected as event: ${detectedAsEvent}`);
		console.debug(`[DEBUG] loadPersonCache:   - Detected as place: ${detectedAsPlace}`);

		// Second pass: build child relationships (merge explicit and inferred)
		for (const [crId, person] of this.personCache.entries()) {
			// Add this person as child to their parents (inferred from father/mother fields)
			if (person.fatherCrId) {
				const father = this.personCache.get(person.fatherCrId);
				if (father && !father.childrenCrIds.includes(crId)) {
					father.childrenCrIds.push(crId);
				}
			}
			if (person.motherCrId) {
				const mother = this.personCache.get(person.motherCrId);
				if (mother && !mother.childrenCrIds.includes(crId)) {
					mother.childrenCrIds.push(crId);
				}
			}

			// Add this person as child to gender-neutral parents (inferred from parents/parents_id fields)
			for (const parentCrId of person.parentCrIds) {
				const parent = this.personCache.get(parentCrId);
				if (parent && !parent.childrenCrIds.includes(crId)) {
					parent.childrenCrIds.push(crId);
				}
			}

			// Also ensure all explicitly declared children are valid
			// (filter out any that don't exist in the cache)
			person.childrenCrIds = person.childrenCrIds.filter(childCrId =>
				this.personCache.has(childCrId)
			);

			// Build reverse adoptive parent relationships from adopted_child declarations
			// If this person has adopted_child: X, then X should have this person as adoptive parent
			for (const adoptedChildId of person.adoptedChildCrIds) {
				const adoptedChild = this.personCache.get(adoptedChildId);
				if (adoptedChild && !adoptedChild.adoptiveParentCrIds.includes(crId)) {
					adoptedChild.adoptiveParentCrIds.push(crId);
				}
			}
		}

		// Third pass: count source backlinks for each person
		this.countSourceBacklinks();
	}

	/**
	 * Counts source notes that link to each person note
	 * Uses resolvedLinks from metadata cache to find backlinks
	 */
	private countSourceBacklinks(): void {
		const resolvedLinks = this.app.metadataCache.resolvedLinks;

		// Build a map of person file paths to cr_ids for quick lookup
		const pathToCrId = new Map<string, string>();
		for (const [crId, person] of this.personCache.entries()) {
			pathToCrId.set(person.file.path, crId);
		}

		// Initialize source counts to 0
		for (const person of this.personCache.values()) {
			person.sourceCount = 0;
		}

		// Iterate through all files that have outgoing links
		for (const [sourcePath, destinations] of Object.entries(resolvedLinks)) {
			// Check if this is a source note by examining its frontmatter
			const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
			if (!(sourceFile instanceof TFile)) continue;

			const sourceCache = this.app.metadataCache.getFileCache(sourceFile);
			if (!sourceCache?.frontmatter) continue;

			// Only count links from source notes (uses flexible detection)
			if (!isSourceNote(sourceCache.frontmatter, sourceCache, this.settings?.noteTypeDetection)) continue;

			// Count links to person notes
			for (const destPath of Object.keys(destinations)) {
				const crId = pathToCrId.get(destPath);
				if (crId) {
					const person = this.personCache.get(crId);
					if (person) {
						person.sourceCount = (person.sourceCount || 0) + 1;
					}
				}
			}
		}
	}

	/**
	 * Set research coverage percentage for a person
	 * Called externally after building the cache when fact-level tracking is enabled
	 */
	setResearchCoverage(crId: string, coveragePercent: number): void {
		const person = this.personCache.get(crId);
		if (person) {
			person.researchCoveragePercent = coveragePercent;
		}
	}

	/**
	 * Set conflict count for a person
	 * Called externally after building the cache when fact-level tracking is enabled
	 */
	setConflictCount(crId: string, conflictCount: number): void {
		const person = this.personCache.get(crId);
		if (person) {
			person.conflictCount = conflictCount;
		}
	}

	/**
	 * Extracts person node data from a file
	 */
	private extractPersonNode(file: TFile): PersonNode | { isSource?: boolean; isEvent?: boolean; isPlace?: boolean } | null {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache || !cache.frontmatter) {
			return null;
		}

		const fm = cache.frontmatter as Record<string, unknown>;

		// Must have cr_id (with alias support)
		const crId = this.resolveProperty<string>(fm, 'cr_id');
		if (!crId) {
			return null;
		}

		// Skip non-person notes that also have cr_id (sources, events, places, etc.)
		const noteTypeSettings = this.settings?.noteTypeDetection;
		if (isSourceNote(fm, cache, noteTypeSettings)) {
			// Sample one to see why it's detected as source
			if (Math.random() < 0.01) {
				console.debug(`[DEBUG] Sample file detected as source:`, file.path);
				console.debug(`  - cr_type:`, fm.cr_type, `type:`, fm.type, `tags:`, cache.tags?.map(t => t.tag));
			}
			return { isSource: true };
		}
		if (isEventNote(fm, cache, noteTypeSettings)) {
			// Sample one to see why it's detected as event
			if (Math.random() < 0.01) {
				console.debug(`[DEBUG] Sample file detected as event:`, file.path);
				console.debug(`  - cr_type:`, fm.cr_type, `type:`, fm.type, `tags:`, cache.tags?.map(t => t.tag));
			}
			return { isEvent: true };
		}
		if (isPlaceNote(fm, cache, noteTypeSettings)) {
			// Sample one to see why it's detected as place
			if (Math.random() < 0.01) {
				console.debug(`[DEBUG] Sample file detected as place:`, file.path);
				console.debug(`  - cr_type:`, fm.cr_type, `type:`, fm.type, `tags:`, cache.tags?.map(t => t.tag));
			}
			return { isPlace: true };
		}

		// Extract name (from frontmatter or filename) with alias support
		const name = this.resolveProperty<string>(fm, 'name') || file.basename;

		// Parse father relationship (prefer _id field, fallback to father field for legacy)
		// Both father_id and father support aliases
		// Filter out unresolved Gramps handles that weren't replaced during import
		const fatherIdValue = this.resolveProperty<string>(fm, 'father_id');
		const fatherValue = this.resolveProperty<string>(fm, 'father');
		const fatherCrId = this.filterGrampsHandle(fatherIdValue || this.extractCrIdFromWikilink(fatherValue) || undefined);

		// Parse mother relationship (prefer _id field, fallback to mother field for legacy)
		// Filter out unresolved Gramps handles that weren't replaced during import
		const motherIdValue = this.resolveProperty<string>(fm, 'mother_id');
		const motherValue = this.resolveProperty<string>(fm, 'mother');
		const motherCrId = this.filterGrampsHandle(motherIdValue || this.extractCrIdFromWikilink(motherValue) || undefined);

		// Parse gender-neutral parent relationships (opt-in via settings)
		const parentsIdValue = this.resolveProperty<string | string[]>(fm, 'parents_id');
		const parentsValue = this.resolveProperty<string | string[]>(fm, 'parents');
		const parentCrIds = this.extractCrIdsFromField(parentsIdValue, parentsValue);

		// Parse step-parent relationships (can be arrays for multiple step-parents)
		const stepfatherIdValue = this.resolveProperty<string | string[]>(fm, 'stepfather_id');
		const stepfatherValue = this.resolveProperty<string | string[]>(fm, 'stepfather');
		const stepfatherCrIds = this.extractCrIdsFromField(stepfatherIdValue, stepfatherValue);

		const stepmotherIdValue = this.resolveProperty<string | string[]>(fm, 'stepmother_id');
		const stepmotherValue = this.resolveProperty<string | string[]>(fm, 'stepmother');
		const stepmotherCrIds = this.extractCrIdsFromField(stepmotherIdValue, stepmotherValue);

		// Parse adoptive parent relationships (gender-specific)
		// Filter out unresolved Gramps handles
		const adoptiveFatherIdValue = this.resolveProperty<string>(fm, 'adoptive_father_id');
		const adoptiveFatherValue = this.resolveProperty<string>(fm, 'adoptive_father');
		const adoptiveFatherCrId = this.filterGrampsHandle(adoptiveFatherIdValue || this.extractCrIdFromWikilink(adoptiveFatherValue) || undefined);

		const adoptiveMotherIdValue = this.resolveProperty<string>(fm, 'adoptive_mother_id');
		const adoptiveMotherValue = this.resolveProperty<string>(fm, 'adoptive_mother');
		const adoptiveMotherCrId = this.filterGrampsHandle(adoptiveMotherIdValue || this.extractCrIdFromWikilink(adoptiveMotherValue) || undefined);

		// Parse gender-neutral adoptive parent relationships (can be array)
		const adoptiveParentIdValue = this.resolveProperty<string | string[]>(fm, 'adoptive_parent_id');
		const adoptiveParentValue = this.resolveProperty<string | string[]>(fm, 'adoptive_parent');
		const adoptiveParentCrIds = this.extractCrIdsFromField(adoptiveParentIdValue, adoptiveParentValue);

		// Parse adopted children (from parent's perspective)
		const adoptedChildIdValue = this.resolveProperty<string | string[]>(fm, 'adopted_child_id');
		const adoptedChildValue = this.resolveProperty<string | string[]>(fm, 'adopted_child');
		const adoptedChildCrIds = this.extractCrIdsFromField(adoptedChildIdValue, adoptedChildValue);

		// Parse relationships array for family-relevant types
		// This supplements direct properties (stepfather, adoptive_father, etc.)
		const relationshipsFromArray = this.parseRelationshipsArrayForFamilyGraph(fm);

		// Merge relationships from array with direct properties (deduplicating)
		// Direct properties take precedence for single-value fields (adoptive parents)
		// Array fields (step-parents, parents) are merged and deduplicated
		for (const stepfatherId of relationshipsFromArray.stepfatherCrIds) {
			if (!stepfatherCrIds.includes(stepfatherId)) {
				stepfatherCrIds.push(stepfatherId);
			}
		}
		for (const stepmotherId of relationshipsFromArray.stepmotherCrIds) {
			if (!stepmotherCrIds.includes(stepmotherId)) {
				stepmotherCrIds.push(stepmotherId);
			}
		}
		for (const parentId of relationshipsFromArray.parentCrIds) {
			if (!parentCrIds.includes(parentId)) {
				parentCrIds.push(parentId);
			}
		}

		// Parse spouse relationships
		// Priority: 1) Enhanced flat indexed format (spouse1, spouse2...), 2) Legacy 'spouse_id' or 'spouse' fields
		// Filter out unresolved Gramps handles
		let spouseCrIds: string[] = [];
		let spouses: SpouseRelationship[] | undefined;

		// Note: indexed spouse format (spouse1, spouse1_id) doesn't support aliases currently
		// as the indexed property names are dynamic
		if (fm.spouse1 || fm.spouse1_id) {
			// Enhanced flat indexed format with metadata - cast fm for parseIndexedSpouseRelationships
			spouses = this.parseIndexedSpouseRelationships(fm as unknown as PersonFrontmatter);
			spouseCrIds = this.filterGrampsHandles(spouses.map(s => s.personId).filter(id => id));
		} else {
			// Legacy format: simple array of cr_ids or wikilinks (with alias support)
			const spouseIdField = this.resolveProperty<string | string[]>(fm, 'spouse_id');
			const spouseField = this.resolveProperty<string | string[]>(fm, 'spouse');

			if (spouseIdField) {
				// Use _id field (dual storage)
				spouseCrIds = Array.isArray(spouseIdField) ? spouseIdField : [spouseIdField];
			} else if (spouseField) {
				// Fallback to legacy field (could be wikilinks or cr_ids)
				const spouseValues = Array.isArray(spouseField) ? spouseField : [spouseField];
				spouseCrIds = spouseValues
					.map(v => this.extractCrIdFromWikilink(v) || v)
					.filter(v => v);
			}

			// Alternative: Check partners array (alias for spouse, for users who prefer that term)
			if (spouseCrIds.length === 0) {
				const partnersIdField = this.resolveProperty<string | string[]>(fm, 'partners_id');
				const partnersField = this.resolveProperty<string | string[]>(fm, 'partners');

				if (partnersIdField) {
					spouseCrIds = Array.isArray(partnersIdField) ? partnersIdField : [partnersIdField];
				} else if (partnersField) {
					const partnerValues = Array.isArray(partnersField) ? partnersField : [partnersField];
					spouseCrIds = partnerValues
						.map(v => this.extractCrIdFromWikilink(v) || v)
						.filter(v => v);
				}
			}

			// Filter out any unresolved Gramps handles
			spouseCrIds = this.filterGrampsHandles(spouseCrIds);
		}

		// Parse children arrays (prefer _id field, fallback to son/daughter/children fields for legacy)
		// All child-related properties support aliases
		// Filter out unresolved Gramps handles
		let childrenCrIds: string[] = [];

		const childrenIdField = this.resolveProperty<string | string[]>(fm, 'children_id');
		if (childrenIdField) {
			// Use _id field (dual storage), deduplicating to avoid issues with family-chart
			const rawChildren = Array.isArray(childrenIdField) ? childrenIdField : [childrenIdField];
			childrenCrIds = this.filterGrampsHandles([...new Set(rawChildren)]);
		} else {
			// Fallback to legacy fields (with alias support)
			// Check for 'child' field
			const childField = this.resolveProperty<string | string[]>(fm, 'child');
			if (childField) {
				const children = Array.isArray(childField) ? childField : [childField];
				childrenCrIds.push(...children.map(v => this.extractCrIdFromWikilink(v) || v).filter((v): v is string => !!v));
			}

			// Check for generic 'children' field (no alias - kept for backward compat)
			if (fm.children) {
				const children = Array.isArray(fm.children) ? fm.children : [fm.children];
				childrenCrIds.push(...(children as string[]).map(v => this.extractCrIdFromWikilink(v) || v).filter((v): v is string => !!v));
			}

			// Filter out any unresolved Gramps handles from legacy fields
			childrenCrIds = this.filterGrampsHandles(childrenCrIds);
		}

		// Note: Frontmatter uses 'born'/'died' properties, mapped to birthDate/deathDate internally
		// Convert Date objects to ISO strings if necessary (Obsidian parses YAML dates as Date objects)
		// Also handle bare numbers (e.g., born: 1845) which YAML parses as numbers
		// All date properties support aliases
		const bornValue = this.resolveProperty<string | Date | number>(fm, 'born');
		const diedValue = this.resolveProperty<string | Date | number>(fm, 'died');
		const birthDate = bornValue instanceof Date
			? bornValue.toISOString().split('T')[0]
			: typeof bornValue === 'number'
				? String(bornValue)
				: bornValue;
		const deathDate = diedValue instanceof Date
			? diedValue.toISOString().split('T')[0]
			: typeof diedValue === 'number'
				? String(diedValue)
				: diedValue;

		// Resolve other properties with alias support
		const birthPlace = this.resolveProperty<string>(fm, 'birth_place');
		const deathPlace = this.resolveProperty<string>(fm, 'death_place');
		const burialPlace = this.resolveProperty<string>(fm, 'burial_place');
		const occupation = this.resolveProperty<string>(fm, 'occupation');
		// Check 'sex' first (GEDCOM standard), then 'gender' for backwards compatibility
		const rawSex = this.resolveProperty<string>(fm, 'sex') || this.resolveProperty<string>(fm, 'gender');
		const sex = this.resolveGender(rawSex);
		const pronouns = this.resolveProperty<string>(fm, 'pronouns');
		const collectionName = this.resolveProperty<string>(fm, 'group_name');
		const collection = this.resolveProperty<string>(fm, 'collection');
		const universe = this.resolveProperty<string>(fm, 'universe');
		const researchLevel = this.resolveProperty<number>(fm, 'research_level');

		// cr_living is a boolean for manual living status override (no aliasing needed)
		// Handle both boolean and string representations (YAML may parse as string in some cases)
		let cr_living: boolean | undefined = undefined;
		if (typeof fm.cr_living === 'boolean') {
			cr_living = fm.cr_living;
		} else if (fm.cr_living === 'true') {
			cr_living = true;
		} else if (fm.cr_living === 'false') {
			cr_living = false;
		}

		// Parse private_fields array (fields user has marked as private)
		// Normalize to array, handling single string or array input
		const privateFieldsRaw = fm.private_fields;
		const privateFields: string[] = Array.isArray(privateFieldsRaw)
			? privateFieldsRaw.filter((f): f is string => typeof f === 'string')
			: (typeof privateFieldsRaw === 'string' ? [privateFieldsRaw] : []);

		// Parse media array
		const media = this.parseMediaProperty(fm);

		return {
			crId,
			name,
			birthDate,
			deathDate,
			birthPlace,
			deathPlace,
			burialPlace,
			occupation,
			sex,
			pronouns,
			cr_living,
			file,
			// Biological parents
			fatherCrId: fatherCrId || undefined,
			motherCrId: motherCrId || undefined,
			// Step-parents
			stepfatherCrIds,
			stepmotherCrIds,
			// Adoptive parents (gender-specific)
			adoptiveFatherCrId: adoptiveFatherCrId || undefined,
			adoptiveMotherCrId: adoptiveMotherCrId || undefined,
			// Gender-neutral adoptive parents
			adoptiveParentCrIds,
			// Adopted children (from parent's perspective)
			adoptedChildCrIds,
			// Gender-neutral parents
			parentCrIds,
			// Spouses and children
			spouseCrIds: [...new Set(spouseCrIds)], // Deduplicate to avoid family-chart issues
			spouses, // Enhanced spouse relationships with metadata (if present)
			childrenCrIds, // Now populated from frontmatter (deduplicated above)
			collectionName,
			collection,
			universe,
			researchLevel,
			media: media.length > 0 ? media : undefined,
			privateFields: privateFields.length > 0 ? privateFields : undefined
		};
	}

	/**
	 * Parse media array from frontmatter.
	 * Expects YAML array format:
	 *   media:
	 *     - "[[file1.jpg]]"
	 *     - "[[file2.jpg]]"
	 */
	private parseMediaProperty(fm: Record<string, unknown>): string[] {
		if (!fm.media) return [];

		// Handle array format
		if (Array.isArray(fm.media)) {
			return fm.media.filter((item): item is string => typeof item === 'string');
		}

		// Single value - wrap in array
		if (typeof fm.media === 'string') {
			return [fm.media];
		}

		return [];
	}

	/**
	 * Extracts cr_id from a wikilink string
	 * Returns null if the value is not a wikilink or already a cr_id
	 */
	private extractCrIdFromWikilink(value: unknown): string | null {
		if (!value || typeof value !== 'string') {
			return null;
		}

		// Check if it's a wikilink format: [[Name]] or [[Name|Alias]]
		const wikilinkMatch = value.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
		if (!wikilinkMatch) {
			// Not a wikilink, might be a direct cr_id
			return value;
		}

		// Extract basename from wikilink (handles both [[Name]] and [[Path/Name]])
		const basename = wikilinkMatch[1];

		// Use PersonIndexService to resolve wikilink (if available)
		if (this.personIndex) {
			const crId = this.personIndex.getCrIdByWikilink(basename);
			if (crId) {
				return crId;
			}

			// Wikilink couldn't be resolved (no match or ambiguous)
			logger.debug('extractCrIdFromWikilink', `Could not resolve wikilink: ${value}`);
			return null;
		}

		// PersonIndexService not available - fall back to old behavior
		// (return null for wikilinks, requiring _id fields)
		logger.debug('extractCrIdFromWikilink', 'PersonIndexService not available, wikilink not resolved');
		return null;
	}

	/**
	 * Check if a value looks like an unresolved Gramps handle.
	 * Gramps handles start with underscore followed by uppercase letters and digits,
	 * e.g., "_PTHMF88SXO93W8QTDJ" or "_bc09aafc5ba1cb2a871"
	 *
	 * Valid Charted Roots cr_ids have format: xxx-123-xxx-123
	 * (3 lowercase letters, 3 digits, 3 lowercase letters, 3 digits)
	 */
	private isUnresolvedGrampsHandle(value: string | undefined): boolean {
		if (!value) return false;

		// Gramps handles start with underscore
		if (!value.startsWith('_')) return false;

		// Valid cr_ids have a specific format with hyphens
		// Pattern: xxx-123-xxx-123 (lowercase letters and digits separated by hyphens)
		const crIdPattern = /^[a-z]{3}-\d{3}-[a-z]{3}-\d{3}$/;
		if (crIdPattern.test(value)) return false;

		// If it starts with _ and doesn't match cr_id format, it's likely a Gramps handle
		return true;
	}

	/**
	 * Filter out unresolved Gramps handles from a cr_id value.
	 * Returns undefined if the value is an unresolved handle, otherwise returns the value.
	 */
	private filterGrampsHandle(value: string | undefined): string | undefined {
		if (!value) return undefined;
		if (this.isUnresolvedGrampsHandle(value)) {
			logger.debug('filterGrampsHandle', 'Skipping unresolved Gramps handle', { handle: value });
			return undefined;
		}
		return value;
	}

	/**
	 * Filter out unresolved Gramps handles from an array of cr_ids.
	 */
	private filterGrampsHandles(values: string[]): string[] {
		return values.filter(v => !this.isUnresolvedGrampsHandle(v));
	}

	/**
	 * Extracts an array of cr_ids from _id and wikilink fields
	 * Handles both single values and arrays
	 * Filters out unresolved Gramps handles
	 */
	private extractCrIdsFromField(idValue: string | string[] | undefined, wikilinkValue: string | string[] | undefined): string[] {
		const result: string[] = [];

		// Prefer _id field
		if (idValue) {
			const ids = Array.isArray(idValue) ? idValue : [idValue];
			result.push(...ids.filter(id => id));
		} else if (wikilinkValue) {
			// Fallback to wikilink field
			const values = Array.isArray(wikilinkValue) ? wikilinkValue : [wikilinkValue];
			for (const v of values) {
				const crId = this.extractCrIdFromWikilink(v);
				if (crId) {
					result.push(crId);
				}
			}
		}

		// Deduplicate and filter out unresolved Gramps handles
		return this.filterGrampsHandles([...new Set(result)]);
	}

	/**
	 * Safely extracts a string value from frontmatter (handles array case)
	 */
	private getStringValue(value: unknown): string | undefined {
		if (!value) return undefined;
		if (typeof value === 'string') return value;
		if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
		return undefined;
	}

	/**
	 * Parses enhanced spouse relationships from flat indexed frontmatter properties
	 * Scans for spouse1, spouse2, spouse3, etc. with their associated metadata fields
	 */
	private parseIndexedSpouseRelationships(fm: PersonFrontmatter): SpouseRelationship[] {
		const relationships: SpouseRelationship[] = [];
		let index = 1;

		// Scan for spouse1, spouse2, spouse3, etc.
		while (fm[`spouse${index}`] || fm[`spouse${index}_id`]) {
			// Extract person_id (required)
			const personIdValue = this.getStringValue(fm[`spouse${index}_id`]) ||
				this.extractCrIdFromWikilink(fm[`spouse${index}`]);

			if (!personIdValue) {
				logger.warn('parseIndexedSpouseRelationships', `Spouse ${index} missing person_id, skipping`);
				index++;
				continue;
			}

			// Extract marriage status and validate it's a valid value
			const statusValue = this.getStringValue(fm[`spouse${index}_marriage_status`]);
			const validStatuses = ['current', 'divorced', 'widowed', 'separated', 'annulled'] as const;
			const marriageStatus = statusValue && validStatuses.includes(statusValue as typeof validStatuses[number])
				? statusValue as SpouseRelationship['marriageStatus']
				: undefined;

			// Build relationship object from indexed properties
			const relationship: SpouseRelationship = {
				personId: personIdValue,
				personLink: this.getStringValue(fm[`spouse${index}`]),
				marriageDate: this.getStringValue(fm[`spouse${index}_marriage_date`]),
				divorceDate: this.getStringValue(fm[`spouse${index}_divorce_date`]),
				marriageStatus,
				marriageLocation: this.getStringValue(fm[`spouse${index}_marriage_location`]),
				marriageOrder: index, // Index naturally provides ordering
			};

			relationships.push(relationship);
			index++;
		}

		// Already sorted by index (which represents marriage order)
		return relationships;
	}

	/**
	 * Parses relationship type properties from frontmatter for family-relevant types.
	 * Returns cr_ids organized by relationship mapping (stepparent, parent, etc.)
	 *
	 * Supports two formats:
	 * 1. NEW flat properties: step_parent: ["[[John]]"], step_parent_id: ["john_123"]
	 * 2. LEGACY nested array: relationships: [{type: "step_parent", target: "[[John]]", ...}]
	 *
	 * Only processes relationship types that have:
	 * 1. includeOnFamilyTree: true
	 * 2. A valid familyGraphMapping
	 */
	private parseRelationshipsArrayForFamilyGraph(fm: Record<string, unknown>): {
		stepfatherCrIds: string[];
		stepmotherCrIds: string[];
		parentCrIds: string[];
		// Note: adoptive parents, foster parents, guardians, spouses, children
		// could be added here in the future when their integration is implemented
	} {
		const result = {
			stepfatherCrIds: [] as string[],
			stepmotherCrIds: [] as string[],
			parentCrIds: [] as string[]
		};

		// Get all relationship types with family tree mappings
		const allTypes = getAllRelationshipTypesWithCustomizations(
			this.settings?.customRelationshipTypes ?? [],
			this.settings?.showBuiltInRelationshipTypes ?? true
		);

		const familyRelevantTypes = allTypes.filter(t =>
			t.includeOnFamilyTree && t.familyGraphMapping
		);

		// Process NEW flat properties format
		for (const typeDef of familyRelevantTypes) {
			const typeId = typeDef.id;

			// Check for flat property (e.g., step_parent, step_parent_id)
			const targetValue = fm[typeId];
			if (!targetValue) continue;

			const targets = Array.isArray(targetValue) ? targetValue : [targetValue];
			const targetIds = this.normalizeToStringArray(fm[`${typeId}_id`]);

			for (let i = 0; i < targets.length; i++) {
				const target = String(targets[i]);
				const targetCrId = targetIds[i] || this.extractCrIdFromWikilink(target);
				if (!targetCrId) continue;

				this.addToFamilyGraphResult(result, typeDef.familyGraphMapping as FamilyGraphMapping, targetCrId);
			}
		}

		// Process LEGACY nested array format (for backward compatibility)
		const relationships = fm.relationships;
		if (relationships && Array.isArray(relationships)) {
			for (const rel of relationships as RawRelationship[]) {
				if (!rel.type || !rel.target) continue;

				const typeDef = getRelationshipType(rel.type);
				if (!typeDef?.includeOnFamilyTree || !typeDef.familyGraphMapping) continue;

				const targetCrId = rel.target_id || this.extractCrIdFromWikilink(rel.target);
				if (!targetCrId) continue;

				// Skip if already added from flat properties
				const mapping = typeDef.familyGraphMapping;
				if (mapping === 'parent' && result.parentCrIds.includes(targetCrId)) continue;
				if (mapping === 'stepparent' && (result.stepfatherCrIds.includes(targetCrId) || result.stepmotherCrIds.includes(targetCrId))) continue;

				this.addToFamilyGraphResult(result, mapping, targetCrId);
			}
		}

		return result;
	}

	/**
	 * Helper to add a cr_id to the appropriate family graph result array
	 */
	private addToFamilyGraphResult(
		result: { stepfatherCrIds: string[]; stepmotherCrIds: string[]; parentCrIds: string[] },
		mapping: FamilyGraphMapping,
		targetCrId: string
	): void {
		switch (mapping) {
			case 'parent':
				if (!result.parentCrIds.includes(targetCrId)) {
					result.parentCrIds.push(targetCrId);
				}
				break;

			case 'stepparent':
				// Step-parent - for now add to stepfather by default
				// TODO: Look up target's sex to assign to stepfatherCrIds or stepmotherCrIds
				if (!result.stepfatherCrIds.includes(targetCrId)) {
					result.stepfatherCrIds.push(targetCrId);
				}
				break;

			// Other mappings (adoptive_parent, foster_parent, guardian, spouse, child)
			// are not yet integrated into the family graph parsing
			// They still require the direct frontmatter properties
		}
	}

	/**
	 * Normalize a value to a string array (helper for flat properties)
	 */
	private normalizeToStringArray(value: unknown): string[] {
		if (!value) return [];
		if (Array.isArray(value)) return value.map(v => typeof v === 'string' ? v : JSON.stringify(v));
		return [typeof value === 'string' ? value : JSON.stringify(value)];
	}

	/**
	 * Clears the person cache (useful for refreshing data)
	 */
	clearCache(): void {
		this.personCache.clear();
	}

	/**
	 * Gets a person node by cr_id from cache
	 */
	getPerson(crId: string): PersonNode | undefined {
		return this.personCache.get(crId);
	}

	/**
	 * Gets all cached person nodes
	 */
	getAllPeople(): PersonNode[] {
		return Array.from(this.personCache.values());
	}

	/**
	 * Find the person marked as root_person: true in the vault.
	 * Returns the PersonNode if exactly one person is marked, otherwise null.
	 * Also returns all marked root persons for callers that need to handle multiple.
	 */
	getMarkedRootPerson(): { rootPerson: PersonNode | null; allMarked: PersonNode[] } {
		// Ensure cache is loaded before iterating
		this.ensureCacheLoaded();

		const markedRoots: PersonNode[] = [];

		for (const person of this.personCache.values()) {
			const cache = this.app.metadataCache.getFileCache(person.file);
			if (cache?.frontmatter?.root_person === true) {
				markedRoots.push(person);
			}
		}

		return {
			rootPerson: markedRoots.length === 1 ? markedRoots[0] : null,
			allMarked: markedRoots
		};
	}

	/**
	 * Get all ancestors of a person (parents, grandparents, etc.)
	 * Uses BFS traversal to collect all people in the ancestor tree
	 */
	getAncestors(crId: string, includeRoot: boolean = true): PersonNode[] {
		const ancestors: PersonNode[] = [];
		const visited = new Set<string>();
		const queue: string[] = [crId];

		while (queue.length > 0) {
			const currentId = queue.shift()!;
			if (visited.has(currentId)) continue;
			visited.add(currentId);

			const person = this.personCache.get(currentId);
			if (!person) continue;

			// Add person to ancestors (optionally skip the root person)
			if (currentId !== crId || includeRoot) {
				ancestors.push(person);
			}

			// Queue parents
			if (person.fatherCrId && !visited.has(person.fatherCrId)) {
				queue.push(person.fatherCrId);
			}
			if (person.motherCrId && !visited.has(person.motherCrId)) {
				queue.push(person.motherCrId);
			}
			for (const parentCrId of person.parentCrIds) {
				if (!visited.has(parentCrId)) {
					queue.push(parentCrId);
				}
			}
		}

		return ancestors;
	}

	/**
	 * Get all descendants of a person (children, grandchildren, etc.)
	 * Uses BFS traversal to collect all people in the descendant tree
	 */
	getDescendants(crId: string, includeRoot: boolean = true, includeSpouses: boolean = false): PersonNode[] {
		const descendants: PersonNode[] = [];
		const visited = new Set<string>();
		const queue: string[] = [crId];

		while (queue.length > 0) {
			const currentId = queue.shift()!;
			if (visited.has(currentId)) continue;
			visited.add(currentId);

			const person = this.personCache.get(currentId);
			if (!person) continue;

			// Add person to descendants (optionally skip the root person)
			if (currentId !== crId || includeRoot) {
				descendants.push(person);
			}

			// Queue children
			for (const childId of person.childrenCrIds) {
				if (!visited.has(childId)) {
					queue.push(childId);
				}
			}

			// Optionally include spouses
			if (includeSpouses) {
				for (const spouseId of person.spouseCrIds) {
					if (!visited.has(spouseId)) {
						queue.push(spouseId);
					}
				}
			}
		}

		return descendants;
	}

	/**
	 * Calculate analytics for all collections
	 * Returns statistics about data quality, completeness, and structure
	 */
	calculateCollectionAnalytics(): CollectionAnalytics {
		// Ensure cache is loaded
		if (this.personCache.size === 0) {
			this.loadPersonCache();
		}

		const allPeople = Array.from(this.personCache.values());
		const families = this.findAllFamilyComponents();
		const userCollections = this.getUserCollections();
		const connections = this.detectCollectionConnections();

		// Calculate data completeness
		const peopleWithBirthDate = allPeople.filter(p => p.birthDate).length;
		const peopleWithDeathDate = allPeople.filter(p => p.deathDate).length;
		const peopleWithSex = allPeople.filter(p => p.sex).length;

		// Calculate relationship metrics
		const peopleWithParents = allPeople.filter(p => p.fatherCrId || p.motherCrId || p.parentCrIds.length > 0).length;
		const peopleWithSpouses = allPeople.filter(p => p.spouseCrIds.length > 0).length;
		const peopleWithChildren = allPeople.filter(p => p.childrenCrIds.length > 0).length;
		// Orphaned = no parents AND no spouse AND no children
		const orphanedPeople = allPeople.filter(p =>
			!p.fatherCrId && !p.motherCrId && p.parentCrIds.length === 0 &&
			p.spouseCrIds.length === 0 &&
			p.childrenCrIds.length === 0
		).length;

		// Find bridge people (people in multiple collections or connecting families)
		const bridgePeople = new Set<string>();
		for (const connection of connections) {
			for (const person of connection.bridgePeople) {
				bridgePeople.add(person.crId);
			}
		}

		// Calculate date ranges
		const datesWithYears = allPeople
			.map(p => p.birthDate || p.deathDate)
			.filter((d): d is string => !!d && typeof d === 'string')
			.map(d => {
				const match = d.match(/^(\d{4})/);
				return match ? parseInt(match[1]) : null;
			})
			.filter((y): y is number => y !== null);

		const earliestYear = datesWithYears.length > 0 ? Math.min(...datesWithYears) : undefined;
		const latestYear = datesWithYears.length > 0 ? Math.max(...datesWithYears) : undefined;

		// Collection size statistics
		// Normalize collection structure for consistent handling
		const normalizedCollections = [
			...families.map(f => ({ name: f.collectionName || 'Unnamed Family', size: f.size })),
			...userCollections
		];

		const collectionSizes = normalizedCollections.map(c => c.size);
		const averageSize = collectionSizes.length > 0
			? Math.round(collectionSizes.reduce((a, b) => a + b, 0) / collectionSizes.length)
			: 0;
		const largestCollection = normalizedCollections.length > 0
			? normalizedCollections.reduce((max, c) => c.size > max.size ? c : max)
			: null;
		const smallestCollection = normalizedCollections.length > 0
			? normalizedCollections.reduce((min, c) => c.size < min.size ? c : min)
			: null;

		return {
			totalPeople: allPeople.length,
			totalFamilies: families.length,
			totalUserCollections: userCollections.length,
			totalCollections: normalizedCollections.length,
			averageCollectionSize: averageSize,
			largestCollection,
			smallestCollection,
			dataCompleteness: {
				birthDatePercent: allPeople.length > 0 ? Math.round((peopleWithBirthDate / allPeople.length) * 100) : 0,
				deathDatePercent: allPeople.length > 0 ? Math.round((peopleWithDeathDate / allPeople.length) * 100) : 0,
				sexPercent: allPeople.length > 0 ? Math.round((peopleWithSex / allPeople.length) * 100) : 0
			},
			relationshipMetrics: {
				peopleWithParents,
				peopleWithSpouses,
				peopleWithChildren,
				orphanedPeople
			},
			crossCollectionMetrics: {
				totalConnections: connections.length,
				totalBridgePeople: bridgePeople.size,
				topConnections: connections.slice(0, 3).map(c => ({
					from: c.fromCollection,
					to: c.toCollection,
					bridgeCount: c.bridgePeople.length
				}))
			},
			dateRange: {
				earliest: earliestYear,
				latest: latestYear,
				span: earliestYear && latestYear ? latestYear - earliestYear : undefined
			}
		};
	}
}
