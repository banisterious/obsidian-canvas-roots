/**
 * Relationship Service
 *
 * Parses, manages, and provides access to custom relationships between person notes.
 */

import { TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import { getLogger } from '../../core/logging';
import { DEFAULT_RELATIONSHIP_TYPES } from '../constants/default-relationship-types';
import type {
	RelationshipTypeDefinition,
	RawRelationship,
	ParsedRelationship,
	RelationshipStats,
	RelationshipCategory,
	RelationshipValidationResult
} from '../types/relationship-types';
import {
	extractWikilinkName,
	extractWikilinkPath,
	isWikilink,
	RELATIONSHIP_CATEGORY_NAMES
} from '../types/relationship-types';

const logger = getLogger('RelationshipService');

/**
 * Service for managing custom relationships between person notes
 */
export class RelationshipService {
	private plugin: CanvasRootsPlugin;
	private relationshipCache: Map<string, ParsedRelationship[]> = new Map();
	private personCrIdToFilePath: Map<string, string> = new Map();
	private lastCacheRefresh: Date | null = null;

	constructor(plugin: CanvasRootsPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Get all relationship type definitions (built-in + custom)
	 */
	getAllRelationshipTypes(): RelationshipTypeDefinition[] {
		const builtIn = this.plugin.settings.showBuiltInRelationshipTypes
			? DEFAULT_RELATIONSHIP_TYPES
			: [];
		const custom = this.plugin.settings.customRelationshipTypes || [];

		// Custom types can override built-in types by ID
		const typeMap = new Map<string, RelationshipTypeDefinition>();

		for (const type of builtIn) {
			typeMap.set(type.id, type);
		}
		for (const type of custom) {
			typeMap.set(type.id, type);
		}

		return Array.from(typeMap.values());
	}

	/**
	 * Get a relationship type by ID
	 */
	getRelationshipType(id: string): RelationshipTypeDefinition | undefined {
		return this.getAllRelationshipTypes().find(t => t.id === id);
	}

	/**
	 * Get relationship types by category
	 */
	getRelationshipTypesByCategory(category: RelationshipCategory): RelationshipTypeDefinition[] {
		return this.getAllRelationshipTypes().filter(t => t.category === category);
	}

	/**
	 * Add a custom relationship type
	 */
	async addRelationshipType(type: Omit<RelationshipTypeDefinition, 'builtIn'>): Promise<void> {
		const newType: RelationshipTypeDefinition = {
			...type,
			builtIn: false
		};

		// Check for duplicate ID
		const existing = this.plugin.settings.customRelationshipTypes.find(t => t.id === newType.id);
		if (existing) {
			throw new Error(`Relationship type with ID "${newType.id}" already exists`);
		}

		this.plugin.settings.customRelationshipTypes.push(newType);
		await this.plugin.saveSettings();

		logger.info('add', 'Added custom relationship type', { id: newType.id });
	}

	/**
	 * Update a custom relationship type
	 */
	async updateRelationshipType(id: string, updates: Partial<RelationshipTypeDefinition>): Promise<void> {
		const index = this.plugin.settings.customRelationshipTypes.findIndex(t => t.id === id);
		if (index === -1) {
			throw new Error(`Custom relationship type not found: ${id}`);
		}

		this.plugin.settings.customRelationshipTypes[index] = {
			...this.plugin.settings.customRelationshipTypes[index],
			...updates,
			id, // Don't allow changing ID
			builtIn: false
		};

		await this.plugin.saveSettings();
		logger.info('update', 'Updated custom relationship type', { id });
	}

	/**
	 * Delete a custom relationship type
	 */
	async deleteRelationshipType(id: string): Promise<void> {
		const index = this.plugin.settings.customRelationshipTypes.findIndex(t => t.id === id);
		if (index === -1) {
			throw new Error(`Custom relationship type not found: ${id}`);
		}

		this.plugin.settings.customRelationshipTypes.splice(index, 1);
		await this.plugin.saveSettings();

		logger.info('delete', 'Deleted custom relationship type', { id });
	}

	/**
	 * Get all relationships in the vault
	 */
	getAllRelationships(forceRefresh = false): ParsedRelationship[] {
		if (forceRefresh || this.relationshipCache.size === 0) {
			this.refreshCache();
		}

		const allRelationships: ParsedRelationship[] = [];
		for (const relationships of this.relationshipCache.values()) {
			allRelationships.push(...relationships);
		}

		return allRelationships;
	}

	/**
	 * Get relationships for a specific person (by cr_id)
	 */
	getRelationshipsForPerson(crId: string): ParsedRelationship[] {
		if (this.relationshipCache.size === 0) {
			this.refreshCache();
		}

		return this.relationshipCache.get(crId) || [];
	}

	/**
	 * Get inferred inverse relationships for a person
	 *
	 * For example, if person A has "mentor: B", this returns the inferred
	 * "disciple: A" relationship for person B.
	 */
	getInverseRelationships(crId: string): ParsedRelationship[] {
		const allRelationships = this.getAllRelationships();
		const inverseRels: ParsedRelationship[] = [];

		for (const rel of allRelationships) {
			// Skip if this relationship is already for the target person
			if (rel.sourceCrId === crId) continue;

			// Check if this relationship targets our person
			if (rel.targetCrId !== crId) continue;

			// Check if the type has an inverse or is symmetric
			if (rel.type.symmetric) {
				// Symmetric: just flip source and target
				inverseRels.push({
					...rel,
					sourceCrId: crId,
					sourceName: rel.targetName,
					sourceFilePath: rel.targetFilePath || '',
					targetCrId: rel.sourceCrId,
					targetName: rel.sourceName,
					targetFilePath: rel.sourceFilePath,
					isInferred: true
				});
			} else if (rel.type.inverse) {
				// Asymmetric with inverse: use the inverse type
				const inverseType = this.getRelationshipType(rel.type.inverse);
				if (inverseType) {
					inverseRels.push({
						type: inverseType,
						sourceCrId: crId,
						sourceName: rel.targetName,
						sourceFilePath: rel.targetFilePath || '',
						targetCrId: rel.sourceCrId,
						targetName: rel.sourceName,
						targetFilePath: rel.sourceFilePath,
						from: rel.from,
						to: rel.to,
						notes: rel.notes,
						isInferred: true
					});
				}
			}
		}

		return inverseRels;
	}

	/**
	 * Get statistics about relationships in the vault
	 */
	getStats(): RelationshipStats {
		const relationships = this.getAllRelationships();
		const definedRels = relationships.filter(r => !r.isInferred);

		// Calculate inferred relationships
		const allCrIds = new Set<string>();
		for (const rel of relationships) {
			allCrIds.add(rel.sourceCrId);
			if (rel.targetCrId) allCrIds.add(rel.targetCrId);
		}

		let totalInferred = 0;
		for (const crId of allCrIds) {
			const inverse = this.getInverseRelationships(crId);
			totalInferred += inverse.length;
		}

		// Count by type and category
		const byType: Record<string, number> = {};
		const byCategory: Record<RelationshipCategory, number> = {
			family: 0,
			legal: 0,
			religious: 0,
			professional: 0,
			social: 0,
			feudal: 0
		};

		for (const rel of definedRels) {
			byType[rel.type.id] = (byType[rel.type.id] || 0) + 1;
			const cat = rel.type.category as RelationshipCategory;
			if (cat in byCategory) {
				byCategory[cat]++;
			}
		}

		// Count people with relationships
		const peopleWithRels = new Set<string>();
		for (const rel of definedRels) {
			peopleWithRels.add(rel.sourceCrId);
			if (rel.targetCrId) peopleWithRels.add(rel.targetCrId);
		}

		return {
			totalDefined: definedRels.length,
			totalInferred,
			peopleWithRelationships: peopleWithRels.size,
			byType,
			byCategory
		};
	}

	/**
	 * Validate a raw relationship from frontmatter
	 */
	validateRelationship(rel: RawRelationship): RelationshipValidationResult {
		const errors: string[] = [];

		// Check type exists
		if (!rel.type) {
			errors.push('Missing relationship type');
		} else {
			const typeDef = this.getRelationshipType(rel.type);
			if (!typeDef) {
				errors.push(`Unknown relationship type: ${rel.type}`);
			}
		}

		// Check target
		if (!rel.target) {
			errors.push('Missing relationship target');
		} else if (!isWikilink(rel.target)) {
			errors.push(`Target must be a wikilink: ${rel.target}`);
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	/**
	 * Refresh the relationship cache from vault
	 */
	refreshCache(): void {
		this.relationshipCache.clear();
		this.personCrIdToFilePath.clear();

		const files = this.plugin.app.vault.getMarkdownFiles();

		// First pass: build cr_id → file path map
		for (const file of files) {
			const cache = this.plugin.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const crId = cache.frontmatter.cr_id as string | undefined;
			if (crId) {
				this.personCrIdToFilePath.set(crId, file.path);
			}
		}

		// Second pass: parse relationships
		for (const file of files) {
			const relationships = this.parsePersonRelationships(file);
			if (relationships.length > 0) {
				const cache = this.plugin.app.metadataCache.getFileCache(file);
				const crId = cache?.frontmatter?.cr_id as string;
				if (crId) {
					this.relationshipCache.set(crId, relationships);
				}
			}
		}

		this.lastCacheRefresh = new Date();
		logger.debug('cache', 'Relationship cache refreshed', {
			relationships: Array.from(this.relationshipCache.values()).flat().length,
			people: this.relationshipCache.size
		});
	}

	/**
	 * Parse relationships from a person note's frontmatter
	 */
	private parsePersonRelationships(file: TFile): ParsedRelationship[] {
		const cache = this.plugin.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) return [];

		const fm = cache.frontmatter;
		const sourceCrId = fm.cr_id as string | undefined;
		const sourceName = (fm.name as string) || file.basename;

		if (!sourceCrId) return [];

		const rawRelationships = fm.relationships as RawRelationship[] | undefined;
		if (!rawRelationships || !Array.isArray(rawRelationships)) return [];

		const parsed: ParsedRelationship[] = [];

		for (const raw of rawRelationships) {
			// Validate
			const validation = this.validateRelationship(raw);
			if (!validation.isValid) {
				logger.warn('parse', 'Invalid relationship', {
					file: file.path,
					errors: validation.errors
				});
				continue;
			}

			// Get type definition
			const typeDef = this.getRelationshipType(raw.type);
			if (!typeDef) continue;

			// Resolve target
			const targetName = extractWikilinkName(raw.target);
			const targetPath = extractWikilinkPath(raw.target);

			// Try to resolve target cr_id
			let targetCrId = raw.target_id;
			let targetFilePath: string | undefined;

			if (targetCrId) {
				targetFilePath = this.personCrIdToFilePath.get(targetCrId);
			} else {
				// Try to find by file path
				const targetFile = this.plugin.app.metadataCache.getFirstLinkpathDest(targetPath, file.path);
				if (targetFile instanceof TFile) {
					const targetCache = this.plugin.app.metadataCache.getFileCache(targetFile);
					targetCrId = targetCache?.frontmatter?.cr_id as string | undefined;
					targetFilePath = targetFile.path;
				}
			}

			parsed.push({
				type: typeDef,
				sourceCrId,
				sourceName,
				sourceFilePath: file.path,
				targetCrId,
				targetName,
				targetFilePath,
				from: raw.from,
				to: raw.to,
				notes: raw.notes,
				isInferred: false
			});
		}

		return parsed;
	}

	/**
	 * Get the file path for a person by cr_id
	 */
	getFilePathByCrId(crId: string): string | undefined {
		return this.personCrIdToFilePath.get(crId);
	}

	/**
	 * Get human-readable category name
	 */
	getCategoryName(category: RelationshipCategory): string {
		return RELATIONSHIP_CATEGORY_NAMES[category] || category;
	}
}
