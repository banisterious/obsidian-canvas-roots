/**
 * Family Graph Service
 *
 * Builds and traverses family relationship graphs from person notes in the vault.
 * Supports generating ancestor trees, descendant trees, and full family trees.
 */

import { App, TFile } from 'obsidian';
import { getLogger } from './logging';

const logger = getLogger('FamilyGraph');

/**
 * Represents a person node in the family graph
 */
export interface PersonNode {
	crId: string;
	name: string;
	birthDate?: string;
	deathDate?: string;
	sex?: string;
	file: TFile;

	// Relationships (as cr_ids)
	fatherCrId?: string;
	motherCrId?: string;
	spouseCrIds: string[];
	childrenCrIds: string[];
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
	type: 'parent' | 'spouse' | 'child';
}

/**
 * Service for building and traversing family graphs
 */
export class FamilyGraphService {
	private app: App;
	private personCache: Map<string, PersonNode>;

	constructor(app: App) {
		this.app = app;
		this.personCache = new Map();
	}

	/**
	 * Generates a family tree starting from a root person
	 */
	async generateTree(options: TreeOptions): Promise<FamilyTree | null> {
		// Load all person nodes into cache
		await this.loadPersonCache();

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
	 * Builds ancestor tree (parents, grandparents, etc.)
	 */
	private buildAncestorTree(
		node: PersonNode,
		nodes: Map<string, PersonNode>,
		edges: FamilyEdge[],
		options: TreeOptions,
		currentGeneration: number
	): void {
		// Add current node
		nodes.set(node.crId, node);

		// Check generation limit
		if (options.maxGenerations && currentGeneration >= options.maxGenerations) {
			return;
		}

		// Add father
		if (node.fatherCrId) {
			const father = this.personCache.get(node.fatherCrId);
			if (father) {
				edges.push({ from: father.crId, to: node.crId, type: 'parent' });
				this.buildAncestorTree(father, nodes, edges, options, currentGeneration + 1);
			}
		}

		// Add mother
		if (node.motherCrId) {
			const mother = this.personCache.get(node.motherCrId);
			if (mother) {
				edges.push({ from: mother.crId, to: node.crId, type: 'parent' });
				this.buildAncestorTree(mother, nodes, edges, options, currentGeneration + 1);
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
	}

	/**
	 * Builds descendant tree (children, grandchildren, etc.)
	 */
	private buildDescendantTree(
		node: PersonNode,
		nodes: Map<string, PersonNode>,
		edges: FamilyEdge[],
		options: TreeOptions,
		currentGeneration: number
	): void {
		// Add current node
		nodes.set(node.crId, node);

		// Check generation limit
		if (options.maxGenerations && currentGeneration >= options.maxGenerations) {
			return;
		}

		// Add spouses if requested
		if (options.includeSpouses) {
			for (const spouseCrId of node.spouseCrIds) {
				const spouse = this.personCache.get(spouseCrId);
				if (spouse) {
					nodes.set(spouse.crId, spouse);
					edges.push({ from: node.crId, to: spouse.crId, type: 'spouse' });
				}
			}
		}

		// Add children
		for (const childCrId of node.childrenCrIds) {
			const child = this.personCache.get(childCrId);
			if (child) {
				edges.push({ from: node.crId, to: child.crId, type: 'child' });
				this.buildDescendantTree(child, nodes, edges, options, currentGeneration + 1);
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

			// Add current person to tree
			nodes.set(currentCrId, currentPerson);

			// Add edges and queue related people

			// Parents
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
	private async loadPersonCache(): Promise<void> {
		this.personCache.clear();

		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const personNode = await this.extractPersonNode(file);
			if (personNode) {
				this.personCache.set(personNode.crId, personNode);
			}
		}

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

			// Also ensure all explicitly declared children are valid
			// (filter out any that don't exist in the cache)
			person.childrenCrIds = person.childrenCrIds.filter(childCrId =>
				this.personCache.has(childCrId)
			);
		}
	}

	/**
	 * Extracts person node data from a file
	 */
	private async extractPersonNode(file: TFile): Promise<PersonNode | null> {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache || !cache.frontmatter) {
			return null;
		}

		const fm = cache.frontmatter;

		// Must have cr_id
		if (!fm.cr_id) {
			return null;
		}

		// Extract name (from frontmatter or filename)
		const name = fm.name || file.basename;

		// Parse father relationship (prefer _id field, fallback to father field for legacy)
		const fatherCrId = fm.father_id || this.extractCrIdFromWikilink(fm.father);

		// Parse mother relationship (prefer _id field, fallback to mother field for legacy)
		const motherCrId = fm.mother_id || this.extractCrIdFromWikilink(fm.mother);

		// Parse spouse array (prefer _id field, fallback to spouse field for legacy)
		let spouseCrIds: string[] = [];
		const spouseIdField = fm.spouse_id;
		const spouseField = fm.spouse;

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

		// Parse children arrays (prefer _id field, fallback to son/daughter/children fields for legacy)
		let childrenCrIds: string[] = [];

		const childrenIdField = fm.children_id;
		if (childrenIdField) {
			// Use _id field (dual storage)
			childrenCrIds = Array.isArray(childrenIdField) ? childrenIdField : [childrenIdField];
		} else {
			// Fallback to legacy fields
			// Check for 'son' field
			if (fm.son) {
				const sons = Array.isArray(fm.son) ? fm.son : [fm.son];
				childrenCrIds.push(...sons.map(v => this.extractCrIdFromWikilink(v) || v));
			}

			// Check for 'daughter' field
			if (fm.daughter) {
				const daughters = Array.isArray(fm.daughter) ? fm.daughter : [fm.daughter];
				childrenCrIds.push(...daughters.map(v => this.extractCrIdFromWikilink(v) || v));
			}

			// Check for generic 'children' field
			if (fm.children) {
				const children = Array.isArray(fm.children) ? fm.children : [fm.children];
				childrenCrIds.push(...children.map(v => this.extractCrIdFromWikilink(v) || v));
			}
		}

		return {
			crId: fm.cr_id,
			name,
			birthDate: fm.born || fm.birth_date,
			deathDate: fm.died || fm.death_date,
			sex: fm.sex || fm.gender,
			file,
			fatherCrId,
			motherCrId,
			spouseCrIds,
			childrenCrIds // Now populated from frontmatter
		};
	}

	/**
	 * Extracts cr_id from a wikilink string
	 * Returns null if the value is not a wikilink or already a cr_id
	 */
	private extractCrIdFromWikilink(value: any): string | null {
		if (!value || typeof value !== 'string') {
			return null;
		}

		// Check if it's a wikilink format: [[Name]] or "[[Name]]"
		const wikilinkMatch = value.match(/\[\[([^\]]+)\]\]/);
		if (!wikilinkMatch) {
			// Not a wikilink, might be a direct cr_id
			return value;
		}

		// It's a wikilink - we can't extract cr_id from it, return null
		// The _id field should be used instead for reliable resolution
		return null;
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
}
