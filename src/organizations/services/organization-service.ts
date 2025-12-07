/**
 * Organization Service
 *
 * Provides CRUD operations for organization notes and manages
 * the organization cache for efficient lookups.
 */

import { App, TFile, Notice } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type {
	OrganizationInfo,
	OrganizationType,
	OrganizationStats,
	OrganizationHierarchyNode
} from '../types/organization-types';
import { isValidOrganizationType } from '../constants/organization-types';
import { getLogger } from '../../core/logging';
import { isOrganizationNote } from '../../utils/note-type-detection';

const logger = getLogger('OrganizationService');

/**
 * Service for managing organization notes
 */
export class OrganizationService {
	private app: App;
	private plugin: CanvasRootsPlugin;
	private organizationCache: Map<string, OrganizationInfo>;
	private cacheLoaded: boolean = false;

	constructor(plugin: CanvasRootsPlugin) {
		this.plugin = plugin;
		this.app = plugin.app;
		this.organizationCache = new Map();
	}

	/**
	 * Ensure the organization cache is loaded
	 */
	ensureCacheLoaded(): void {
		if (!this.cacheLoaded) {
			this.loadOrganizationCache();
		}
	}

	/**
	 * Force reload the organization cache
	 */
	reloadCache(): void {
		this.loadOrganizationCache();
	}

	/**
	 * Get all organizations
	 */
	getAllOrganizations(): OrganizationInfo[] {
		this.ensureCacheLoaded();
		return Array.from(this.organizationCache.values());
	}

	/**
	 * Get organization by cr_id
	 */
	getOrganization(crId: string): OrganizationInfo | null {
		this.ensureCacheLoaded();
		return this.organizationCache.get(crId) || null;
	}

	/**
	 * Get organization by file path
	 */
	getOrganizationByFile(file: TFile): OrganizationInfo | null {
		this.ensureCacheLoaded();
		for (const org of this.organizationCache.values()) {
			if (org.file.path === file.path) {
				return org;
			}
		}
		return null;
	}

	/**
	 * Get child organizations (those with parentOrg = given crId)
	 */
	getChildOrganizations(parentCrId: string): OrganizationInfo[] {
		this.ensureCacheLoaded();
		return Array.from(this.organizationCache.values())
			.filter(org => org.parentOrg === parentCrId);
	}

	/**
	 * Get organization hierarchy (ancestors from current to root)
	 */
	getOrganizationHierarchy(crId: string): OrganizationInfo[] {
		this.ensureCacheLoaded();
		const hierarchy: OrganizationInfo[] = [];
		let currentId: string | undefined = crId;
		const visited = new Set<string>();

		while (currentId && !visited.has(currentId)) {
			visited.add(currentId);
			const org = this.organizationCache.get(currentId);
			if (org) {
				hierarchy.push(org);
				currentId = org.parentOrg;
			} else {
				break;
			}
		}

		return hierarchy;
	}

	/**
	 * Get organizations by type
	 */
	getOrganizationsByType(orgType: OrganizationType): OrganizationInfo[] {
		this.ensureCacheLoaded();
		return Array.from(this.organizationCache.values())
			.filter(org => org.orgType === orgType);
	}

	/**
	 * Get organizations by universe
	 */
	getOrganizationsByUniverse(universe: string): OrganizationInfo[] {
		this.ensureCacheLoaded();
		return Array.from(this.organizationCache.values())
			.filter(org => org.universe === universe);
	}

	/**
	 * Get root organizations (those without a parent)
	 */
	getRootOrganizations(): OrganizationInfo[] {
		this.ensureCacheLoaded();
		return Array.from(this.organizationCache.values())
			.filter(org => !org.parentOrg);
	}

	/**
	 * Build a hierarchy tree from root organizations
	 */
	buildHierarchyTree(): OrganizationHierarchyNode[] {
		this.ensureCacheLoaded();
		const roots = this.getRootOrganizations();

		const buildNode = (org: OrganizationInfo, depth: number): OrganizationHierarchyNode => {
			const children = this.getChildOrganizations(org.crId);
			return {
				org,
				children: children.map(child => buildNode(child, depth + 1)),
				depth,
				isExpanded: depth < 2 // Auto-expand first 2 levels
			};
		};

		return roots.map(root => buildNode(root, 0));
	}

	/**
	 * Get organization statistics
	 */
	getStats(): OrganizationStats {
		this.ensureCacheLoaded();
		const orgs = Array.from(this.organizationCache.values());

		const byType: Record<OrganizationType, number> = {
			noble_house: 0,
			guild: 0,
			corporation: 0,
			military: 0,
			religious: 0,
			political: 0,
			educational: 0,
			custom: 0
		};

		for (const org of orgs) {
			byType[org.orgType]++;
		}

		// TODO: Calculate membership stats from MembershipService
		return {
			total: orgs.length,
			byType,
			peopleWithMemberships: 0,
			totalMemberships: 0,
			emptyOrganizations: orgs.length // Will be updated when memberships are loaded
		};
	}

	/**
	 * Create a new organization note
	 */
	async createOrganization(
		name: string,
		orgType: OrganizationType,
		options?: {
			parentOrg?: string;
			universe?: string;
			founded?: string;
			motto?: string;
			seat?: string;
			folder?: string;
		}
	): Promise<TFile> {
		const folder = options?.folder || this.plugin.settings.organizationsFolder;

		// Generate cr_id
		const crId = `org-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;

		// Build frontmatter
		const frontmatterLines = [
			'---',
			'type: organization',
			`cr_id: ${crId}`,
			`name: "${name}"`,
			`org_type: ${orgType}`
		];

		if (options?.parentOrg) {
			frontmatterLines.push(`parent_org: "${options.parentOrg}"`);
		}
		if (options?.universe) {
			frontmatterLines.push(`universe: ${options.universe}`);
		}
		if (options?.founded) {
			frontmatterLines.push(`founded: "${options.founded}"`);
		}
		if (options?.motto) {
			frontmatterLines.push(`motto: "${options.motto}"`);
		}
		if (options?.seat) {
			frontmatterLines.push(`seat: "${options.seat}"`);
		}

		frontmatterLines.push('---');
		frontmatterLines.push('');
		frontmatterLines.push(`# ${name}`);
		frontmatterLines.push('');

		const content = frontmatterLines.join('\n');

		// Ensure folder exists
		const folderPath = folder;
		if (folderPath) {
			const folderExists = this.app.vault.getAbstractFileByPath(folderPath);
			if (!folderExists) {
				await this.app.vault.createFolder(folderPath);
			}
		}

		// Create file
		const filePath = folderPath ? `${folderPath}/${name}.md` : `${name}.md`;
		const file = await this.app.vault.create(filePath, content);

		// Reload cache
		this.reloadCache();

		new Notice(`Created organization: ${name}`);
		return file;
	}

	/**
	 * Load all organization notes into cache
	 */
	private loadOrganizationCache(): void {
		this.organizationCache.clear();

		const files = this.app.vault.getMarkdownFiles();
		let loadedCount = 0;

		for (const file of files) {
			const org = this.extractOrganizationInfo(file);
			if (org) {
				this.organizationCache.set(org.crId, org);
				loadedCount++;
			}
		}

		this.cacheLoaded = true;
		logger.debug('loadOrganizationCache', `Loaded ${loadedCount} organizations`);
	}

	/**
	 * Extract organization info from a file
	 */
	private extractOrganizationInfo(file: TFile): OrganizationInfo | null {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) {
			return null;
		}

		const fm = cache.frontmatter;

		// Must be an organization note (uses flexible detection)
		if (!isOrganizationNote(fm, cache, this.plugin.settings.noteTypeDetection)) {
			return null;
		}

		// Must have cr_id
		if (!fm.cr_id) {
			logger.warn('extractOrganizationInfo', `Organization without cr_id: ${file.path}`);
			return null;
		}

		// Must have a valid org_type
		const orgType = fm.org_type || 'custom';
		if (!isValidOrganizationType(orgType)) {
			logger.warn('extractOrganizationInfo', `Invalid org_type "${orgType}" in ${file.path}`);
		}

		// Extract parent org cr_id from wikilink if present
		let parentOrg: string | undefined;
		if (fm.parent_org_id) {
			parentOrg = fm.parent_org_id;
		} else if (fm.parent_org) {
			// Try to resolve wikilink to cr_id
			parentOrg = this.resolveWikilinkToCrId(fm.parent_org);
		}

		return {
			file,
			crId: fm.cr_id,
			name: fm.name || file.basename,
			orgType: isValidOrganizationType(orgType) ? orgType : 'custom',
			parentOrg,
			parentOrgLink: fm.parent_org,
			founded: fm.founded,
			dissolved: fm.dissolved,
			motto: fm.motto,
			seat: fm.seat,
			universe: fm.universe
		};
	}

	/**
	 * Resolve a wikilink to a cr_id by finding the linked file
	 */
	private resolveWikilinkToCrId(wikilink: string): string | undefined {
		if (!wikilink) return undefined;

		// Extract filename from wikilink
		const match = wikilink.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
		if (!match) return undefined;

		const linkPath = match[1];
		const linkedFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, '');
		if (!linkedFile) return undefined;

		const cache = this.app.metadataCache.getFileCache(linkedFile);
		return cache?.frontmatter?.cr_id;
	}
}

/**
 * Create an OrganizationService instance
 */
export function createOrganizationService(plugin: CanvasRootsPlugin): OrganizationService {
	return new OrganizationService(plugin);
}
