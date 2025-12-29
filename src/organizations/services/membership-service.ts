/**
 * Membership Service
 *
 * Handles person-to-organization membership relationships,
 * including parsing, updating, and querying memberships.
 */

import { App, TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type {
	MembershipData,
	PersonMembership,
	OrganizationInfo
} from '../types/organization-types';
import { OrganizationService } from './organization-service';
import { getLogger } from '../../core/logging';

const logger = getLogger('MembershipService');

/**
 * Service for managing person memberships in organizations
 */
export class MembershipService {
	private app: App;
	private plugin: CanvasRootsPlugin;
	private organizationService: OrganizationService;

	constructor(plugin: CanvasRootsPlugin, organizationService: OrganizationService) {
		this.plugin = plugin;
		this.app = plugin.app;
		this.organizationService = organizationService;
	}

	/**
	 * Get all memberships for a person by their cr_id
	 */
	getPersonMemberships(personCrId: string): PersonMembership[] {
		const personFile = this.findPersonFileByCrId(personCrId);
		if (!personFile) {
			return [];
		}

		return this.getPersonMembershipsFromFile(personFile);
	}

	/**
	 * Get all memberships from a person file
	 */
	getPersonMembershipsFromFile(personFile: TFile): PersonMembership[] {
		const cache = this.app.metadataCache.getFileCache(personFile);
		if (!cache?.frontmatter) {
			return [];
		}

		const fm = cache.frontmatter;
		const memberships: PersonMembership[] = [];

		const personCrId = fm.cr_id || '';
		const personName = typeof fm.name === 'string' ? fm.name : personFile.basename;

		// Check for simple house/role membership
		if (fm.house || fm.organization) {
			const orgLink = fm.house || fm.organization;
			const membership = this.createMembership(
				personCrId,
				personName,
				personFile,
				orgLink,
				fm.house_id || fm.organization_id,
				fm.role,
				undefined,
				undefined,
				true // Simple memberships are considered current
			);
			memberships.push(membership);
		}

		// Check for memberships array
		if (Array.isArray(fm.memberships)) {
			for (const m of fm.memberships) {
				if (typeof m === 'object' && m.org) {
					const membership = this.createMembership(
						personCrId,
						personName,
						personFile,
						m.org,
						m.org_id,
						m.role,
						m.from,
						m.to,
						!m.to // Current if no end date
					);
					memberships.push(membership);
				}
			}
		}

		return memberships;
	}

	/**
	 * Get all members of an organization by cr_id
	 */
	getOrganizationMembers(orgCrId: string): PersonMembership[] {
		const members: PersonMembership[] = [];
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;

			// Skip non-person notes (check both cr_type and legacy type)
			if ((fm.cr_type && fm.cr_type !== 'person') || (fm.type && fm.type !== 'person')) continue;

			const personMemberships = this.getPersonMembershipsFromFile(file);
			for (const membership of personMemberships) {
				if (membership.orgId === orgCrId) {
					members.push(membership);
				}
			}
		}

		return members;
	}

	/**
	 * Get the primary/current organization for a person
	 */
	getPrimaryOrganization(personCrId: string): OrganizationInfo | null {
		const memberships = this.getPersonMemberships(personCrId);
		const currentMembership = memberships.find(m => m.isCurrent);
		return currentMembership?.org || null;
	}

	/**
	 * Add a membership to a person's note
	 */
	async addMembership(personFile: TFile, membership: MembershipData): Promise<void> {
		const cache = this.app.metadataCache.getFileCache(personFile);
		if (!cache?.frontmatter) {
			throw new Error('Person file has no frontmatter');
		}

		const content = await this.app.vault.read(personFile);
		const fm = cache.frontmatter;

		// Get existing memberships array or create new one
		const existingMemberships: MembershipData[] = Array.isArray(fm.memberships)
			? [...fm.memberships]
			: [];

		// Add new membership
		existingMemberships.push(membership);

		// Update frontmatter
		const newContent = this.updateFrontmatterField(
			content,
			'memberships',
			existingMemberships
		);

		await this.app.vault.modify(personFile, newContent);
		logger.info('addMembership', `Added membership to ${personFile.basename}`);
	}

	/**
	 * Remove a membership from a person's note
	 */
	async removeMembership(personFile: TFile, orgCrId: string): Promise<void> {
		const cache = this.app.metadataCache.getFileCache(personFile);
		if (!cache?.frontmatter) {
			return;
		}

		const content = await this.app.vault.read(personFile);
		const fm = cache.frontmatter;

		// Check if it's a simple membership
		if (fm.house_id === orgCrId || fm.organization_id === orgCrId) {
			// Remove simple membership fields
			let newContent = this.removeFrontmatterField(content, 'house');
			newContent = this.removeFrontmatterField(newContent, 'house_id');
			newContent = this.removeFrontmatterField(newContent, 'organization');
			newContent = this.removeFrontmatterField(newContent, 'organization_id');
			newContent = this.removeFrontmatterField(newContent, 'role');
			await this.app.vault.modify(personFile, newContent);
			return;
		}

		// Check memberships array
		if (!Array.isArray(fm.memberships)) {
			return;
		}

		const filteredMemberships = fm.memberships.filter(
			(m: MembershipData) => m.org_id !== orgCrId
		);

		const newContent = this.updateFrontmatterField(
			content,
			'memberships',
			filteredMemberships
		);

		await this.app.vault.modify(personFile, newContent);
		logger.info('removeMembership', `Removed membership from ${personFile.basename}`);
	}

	/**
	 * Get count of people with memberships and total memberships
	 */
	getMembershipStats(): { peopleWithMemberships: number; totalMemberships: number } {
		const files = this.app.vault.getMarkdownFiles();
		let peopleWithMemberships = 0;
		let totalMemberships = 0;

		for (const file of files) {
			const memberships = this.getPersonMembershipsFromFile(file);
			if (memberships.length > 0) {
				peopleWithMemberships++;
				totalMemberships += memberships.length;
			}
		}

		return { peopleWithMemberships, totalMemberships };
	}

	/**
	 * Create a PersonMembership object
	 */
	private createMembership(
		personCrId: string,
		personName: string,
		personFile: TFile,
		orgLink: string,
		orgId: string | undefined,
		role: string | undefined,
		from: string | undefined,
		to: string | undefined,
		isCurrent: boolean
	): PersonMembership {
		// Try to resolve org cr_id from link if not provided
		let resolvedOrgId = orgId;
		if (!resolvedOrgId && orgLink) {
			resolvedOrgId = this.resolveWikilinkToCrId(orgLink);
		}

		// Try to get organization info
		let org: OrganizationInfo | undefined;
		if (resolvedOrgId) {
			org = this.organizationService.getOrganization(resolvedOrgId) || undefined;
		}

		return {
			personCrId,
			personName,
			personFile,
			org,
			orgLink,
			orgId: resolvedOrgId,
			role,
			from,
			to,
			isCurrent
		};
	}

	/**
	 * Find a person file by their cr_id
	 */
	private findPersonFileByCrId(crId: string): TFile | null {
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter?.cr_id === crId) {
				return file;
			}
		}

		return null;
	}

	/**
	 * Resolve a wikilink to a cr_id
	 */
	private resolveWikilinkToCrId(wikilink: string): string | undefined {
		if (!wikilink) return undefined;

		const match = wikilink.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
		if (!match) return undefined;

		const linkPath = match[1];
		const linkedFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, '');
		if (!linkedFile) return undefined;

		const cache = this.app.metadataCache.getFileCache(linkedFile);
		return cache?.frontmatter?.cr_id;
	}

	/**
	 * Update a frontmatter field in the content
	 */
	private updateFrontmatterField(content: string, field: string, value: unknown): string {
		const yamlValue = this.toYaml(value, 0);
		const fieldLine = `${field}: ${yamlValue}`;

		// Find frontmatter bounds
		const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (!fmMatch) {
			return content;
		}

		const fmContent = fmMatch[1];
		const fmLines = fmContent.split('\n');

		// Find and replace the field, or add it
		let found = false;
		const newLines = fmLines.map(line => {
			if (line.startsWith(`${field}:`)) {
				found = true;
				return fieldLine;
			}
			return line;
		});

		if (!found) {
			newLines.push(fieldLine);
		}

		const newFm = `---\n${newLines.join('\n')}\n---`;
		return content.replace(/^---\n[\s\S]*?\n---/, newFm);
	}

	/**
	 * Remove a frontmatter field from the content
	 */
	private removeFrontmatterField(content: string, field: string): string {
		const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (!fmMatch) {
			return content;
		}

		const fmContent = fmMatch[1];
		const fmLines = fmContent.split('\n');
		const newLines = fmLines.filter(line => !line.startsWith(`${field}:`));

		const newFm = `---\n${newLines.join('\n')}\n---`;
		return content.replace(/^---\n[\s\S]*?\n---/, newFm);
	}

	/**
	 * Convert a value to YAML format
	 */
	private toYaml(value: unknown, indent: number): string {
		const spaces = '  '.repeat(indent);

		if (value === null || value === undefined) {
			return 'null';
		}

		if (typeof value === 'string') {
			if (value.includes('\n') || value.includes(':') || value.includes('#')) {
				return `"${value.replace(/"/g, '\\"')}"`;
			}
			return value;
		}

		if (typeof value === 'number' || typeof value === 'boolean') {
			return String(value);
		}

		if (Array.isArray(value)) {
			if (value.length === 0) {
				return '[]';
			}
			return '\n' + value.map(item => `${spaces}- ${this.toYaml(item, indent + 1)}`).join('\n');
		}

		if (typeof value === 'object' && value !== null) {
			const entries = Object.entries(value);
			if (entries.length === 0) {
				return '{}';
			}
			return '\n' + entries
				.map(([k, v]) => `${spaces}${k}: ${this.toYaml(v, indent + 1)}`)
				.join('\n');
		}

		// At this point, value is a primitive (symbol, bigint, etc.)
		return String(value as symbol | bigint);
	}
}

/**
 * Create a MembershipService instance
 */
export function createMembershipService(
	plugin: CanvasRootsPlugin,
	organizationService: OrganizationService
): MembershipService {
	return new MembershipService(plugin, organizationService);
}
