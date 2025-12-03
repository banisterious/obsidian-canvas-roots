/**
 * Schema Service
 *
 * Loads, manages, and provides access to schema notes in the vault.
 */

import { TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import { getLogger } from '../../core/logging';
import type {
	SchemaNote,
	SchemaNoteFrontmatter,
	SchemaDefinition,
	SchemaStats
} from '../types/schema-types';

const logger = getLogger('SchemaService');

/**
 * Regular expression to match JSON code blocks in markdown
 * Matches ```json or ```json schema followed by content and closing ```
 */
const JSON_CODE_BLOCK_REGEX = /```(?:json(?:\s+schema)?)\s*\n([\s\S]*?)\n```/;

/**
 * Service for loading and managing schema notes
 */
export class SchemaService {
	private plugin: CanvasRootsPlugin;
	private schemaCache: Map<string, SchemaNote> = new Map();
	private lastCacheRefresh: Date | null = null;

	constructor(plugin: CanvasRootsPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Get all schemas from the vault
	 */
	async getAllSchemas(forceRefresh = false): Promise<SchemaNote[]> {
		if (forceRefresh || this.schemaCache.size === 0) {
			await this.refreshCache();
		}
		return Array.from(this.schemaCache.values());
	}

	/**
	 * Get a schema by its cr_id
	 */
	async getSchemaById(crId: string): Promise<SchemaNote | undefined> {
		if (this.schemaCache.size === 0) {
			await this.refreshCache();
		}
		return this.schemaCache.get(crId);
	}

	/**
	 * Get schemas that apply to a specific person note
	 */
	async getSchemasForPerson(file: TFile): Promise<SchemaNote[]> {
		const schemas = await this.getAllSchemas();
		const cache = this.plugin.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) return [];

		const fm = cache.frontmatter;
		const collection = fm.collection as string | undefined;
		const universe = fm.universe as string | undefined;
		const folderPath = file.parent?.path || '';

		return schemas.filter(schema => this.schemaAppliesToPerson(schema, {
			collection,
			universe,
			folderPath
		}));
	}

	/**
	 * Get schemas that apply to a specific collection
	 */
	async getSchemasForCollection(collectionName: string): Promise<SchemaNote[]> {
		const schemas = await this.getAllSchemas();
		return schemas.filter(schema =>
			schema.appliesToType === 'collection' &&
			schema.appliesToValue === collectionName
		);
	}

	/**
	 * Get schemas that apply to a specific folder
	 */
	async getSchemasForFolder(folderPath: string): Promise<SchemaNote[]> {
		const schemas = await this.getAllSchemas();
		return schemas.filter(schema =>
			schema.appliesToType === 'folder' &&
			folderPath.startsWith(schema.appliesToValue || '')
		);
	}

	/**
	 * Get schemas that apply to a specific universe
	 */
	async getSchemasForUniverse(universe: string): Promise<SchemaNote[]> {
		const schemas = await this.getAllSchemas();
		return schemas.filter(schema =>
			schema.appliesToType === 'universe' &&
			schema.appliesToValue === universe
		);
	}

	/**
	 * Get global schemas (applies_to_type: all)
	 */
	async getGlobalSchemas(): Promise<SchemaNote[]> {
		const schemas = await this.getAllSchemas();
		return schemas.filter(schema => schema.appliesToType === 'all');
	}

	/**
	 * Get schema statistics
	 */
	async getStats(): Promise<SchemaStats> {
		const schemas = await this.getAllSchemas();

		const stats: SchemaStats = {
			totalSchemas: schemas.length,
			byScope: {
				collection: 0,
				folder: 0,
				universe: 0,
				all: 0
			}
		};

		for (const schema of schemas) {
			stats.byScope[schema.appliesToType]++;
		}

		return stats;
	}

	/**
	 * Create a new schema note
	 */
	async createSchema(schema: Omit<SchemaNote, 'filePath'>): Promise<TFile> {
		const folder = this.plugin.settings.schemasFolder || 'Schemas';
		const fileName = `${schema.name.replace(/[\\/:*?"<>|]/g, '-')}.md`;
		const filePath = `${folder}/${fileName}`;

		// Ensure folder exists
		const folderExists = this.plugin.app.vault.getAbstractFileByPath(folder);
		if (!folderExists) {
			await this.plugin.app.vault.createFolder(folder);
		}

		const content = this.generateSchemaContent(schema);
		const file = await this.plugin.app.vault.create(filePath, content);

		// Update cache
		await this.refreshCache();

		logger.info('create', 'Created schema note', { crId: schema.cr_id, filePath });
		return file;
	}

	/**
	 * Update an existing schema note
	 */
	async updateSchema(crId: string, updates: Partial<Omit<SchemaNote, 'filePath' | 'cr_id'>>): Promise<void> {
		const schema = await this.getSchemaById(crId);
		if (!schema) {
			throw new Error(`Schema not found: ${crId}`);
		}

		const file = this.plugin.app.vault.getAbstractFileByPath(schema.filePath);
		if (!(file instanceof TFile)) {
			throw new Error(`Schema file not found: ${schema.filePath}`);
		}

		const updatedSchema: Omit<SchemaNote, 'filePath'> = {
			...schema,
			...updates,
			cr_id: crId
		};

		const content = this.generateSchemaContent(updatedSchema);
		await this.plugin.app.vault.modify(file, content);

		// Update cache
		await this.refreshCache();

		logger.info('update', 'Updated schema note', { crId, filePath: schema.filePath });
	}

	/**
	 * Delete a schema note
	 */
	async deleteSchema(crId: string): Promise<void> {
		const schema = await this.getSchemaById(crId);
		if (!schema) {
			throw new Error(`Schema not found: ${crId}`);
		}

		const file = this.plugin.app.vault.getAbstractFileByPath(schema.filePath);
		if (file instanceof TFile) {
			await this.plugin.app.vault.delete(file);
		}

		// Update cache
		this.schemaCache.delete(crId);

		logger.info('delete', 'Deleted schema note', { crId });
	}

	/**
	 * Duplicate a schema with a new ID
	 */
	async duplicateSchema(crId: string): Promise<TFile> {
		const schema = await this.getSchemaById(crId);
		if (!schema) {
			throw new Error(`Schema not found: ${crId}`);
		}

		// Generate new ID with copy suffix
		let newCrId = `${crId}-copy`;
		let suffix = 2;
		while (await this.getSchemaById(newCrId)) {
			newCrId = `${crId}-copy-${suffix}`;
			suffix++;
		}

		const newSchema: Omit<SchemaNote, 'filePath'> = {
			...schema,
			cr_id: newCrId,
			name: `${schema.name} (Copy)`
		};

		return this.createSchema(newSchema);
	}

	/**
	 * Export a schema as JSON
	 */
	async exportSchemaAsJson(crId: string): Promise<string> {
		const schema = await this.getSchemaById(crId);
		if (!schema) {
			throw new Error(`Schema not found: ${crId}`);
		}

		const exportData = {
			cr_id: schema.cr_id,
			name: schema.name,
			description: schema.description,
			applies_to_type: schema.appliesToType,
			applies_to_value: schema.appliesToValue,
			definition: schema.definition
		};

		return JSON.stringify(exportData, null, 2);
	}

	/**
	 * Import a schema from JSON
	 */
	async importSchemaFromJson(json: string): Promise<TFile> {
		const data = JSON.parse(json);

		// Validate required fields
		if (!data.cr_id || !data.name) {
			throw new Error('Invalid schema JSON: missing cr_id or name');
		}

		// Check for duplicate ID
		const existing = await this.getSchemaById(data.cr_id);
		if (existing) {
			throw new Error(`Schema with ID "${data.cr_id}" already exists`);
		}

		const schema: Omit<SchemaNote, 'filePath'> = {
			cr_id: data.cr_id,
			name: data.name,
			description: data.description,
			appliesToType: data.applies_to_type || 'all',
			appliesToValue: data.applies_to_value,
			definition: data.definition || {
				requiredProperties: [],
				properties: {},
				constraints: []
			}
		};

		return this.createSchema(schema);
	}

	/**
	 * Refresh the schema cache from vault
	 */
	async refreshCache(): Promise<void> {
		this.schemaCache.clear();

		const files = this.plugin.app.vault.getMarkdownFiles();
		for (const file of files) {
			const schema = await this.parseSchemaFile(file);
			if (schema) {
				this.schemaCache.set(schema.cr_id, schema);
			}
		}

		this.lastCacheRefresh = new Date();
		logger.debug('cache', 'Schema cache refreshed', { count: this.schemaCache.size });
	}

	/**
	 * Parse a markdown file as a schema note
	 */
	private async parseSchemaFile(file: TFile): Promise<SchemaNote | null> {
		const cache = this.plugin.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) return null;

		const fm = cache.frontmatter as Partial<SchemaNoteFrontmatter>;

		// Must have type: schema
		if (fm.type !== 'schema') return null;

		// Must have cr_id and name
		if (!fm.cr_id || !fm.name) {
			logger.warn('parse', 'Schema note missing cr_id or name', { filePath: file.path });
			return null;
		}

		// Parse the JSON definition from the note body
		const content = await this.plugin.app.vault.read(file);
		const definition = this.parseSchemaDefinition(content);

		return {
			cr_id: fm.cr_id,
			name: fm.name,
			description: fm.description,
			appliesToType: fm.applies_to_type || 'all',
			appliesToValue: fm.applies_to_value,
			filePath: file.path,
			definition
		};
	}

	/**
	 * Parse the schema definition from a JSON code block in markdown content
	 */
	private parseSchemaDefinition(content: string): SchemaDefinition {
		const match = content.match(JSON_CODE_BLOCK_REGEX);
		if (!match) {
			return {
				requiredProperties: [],
				properties: {},
				constraints: []
			};
		}

		try {
			const json = JSON.parse(match[1]);
			return {
				requiredProperties: json.required_properties || json.requiredProperties || [],
				properties: json.properties || {},
				constraints: json.constraints || []
			};
		} catch (error) {
			logger.warn('parse', 'Failed to parse schema JSON', { error });
			return {
				requiredProperties: [],
				properties: {},
				constraints: []
			};
		}
	}

	/**
	 * Check if a schema applies to a person based on their metadata
	 */
	private schemaAppliesToPerson(
		schema: SchemaNote,
		personMeta: { collection?: string; universe?: string; folderPath: string }
	): boolean {
		switch (schema.appliesToType) {
			case 'all':
				return true;

			case 'collection':
				return personMeta.collection === schema.appliesToValue;

			case 'universe':
				return personMeta.universe === schema.appliesToValue;

			case 'folder':
				return personMeta.folderPath.startsWith(schema.appliesToValue || '');

			default:
				return false;
		}
	}

	/**
	 * Generate markdown content for a schema note
	 */
	private generateSchemaContent(schema: Omit<SchemaNote, 'filePath'>): string {
		const frontmatter = [
			'---',
			'type: schema',
			`cr_id: ${schema.cr_id}`,
			`name: "${schema.name.replace(/"/g, '\\"')}"`,
		];

		if (schema.description) {
			frontmatter.push(`description: "${schema.description.replace(/"/g, '\\"')}"`);
		}

		frontmatter.push(`applies_to_type: ${schema.appliesToType}`);

		if (schema.appliesToValue && schema.appliesToType !== 'all') {
			frontmatter.push(`applies_to_value: "${schema.appliesToValue.replace(/"/g, '\\"')}"`);
		}

		frontmatter.push('---');

		const definitionJson = JSON.stringify({
			required_properties: schema.definition.requiredProperties,
			properties: schema.definition.properties,
			constraints: schema.definition.constraints
		}, null, 2);

		return `${frontmatter.join('\n')}

# ${schema.name}

${schema.description || ''}

\`\`\`json schema
${definitionJson}
\`\`\`
`;
	}
}
