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
	OrganizationInfo,
	FlatMembershipProperties
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
	 *
	 * Reads from three formats in priority order:
	 * 1. Flat parallel arrays (membership_orgs, etc.) - preferred
	 * 2. Legacy nested array (memberships) - deprecated
	 * 3. Simple single membership (house/organization) - legacy
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

		// Priority 1: Check for flat parallel arrays (new format)
		if (Array.isArray(fm.membership_orgs) && fm.membership_orgs.length > 0) {
			const orgs = fm.membership_orgs as string[];
			const orgIds = (fm.membership_org_ids as string[] | undefined) || [];
			const roles = (fm.membership_roles as string[] | undefined) || [];
			const fromDates = (fm.membership_from_dates as string[] | undefined) || [];
			const toDates = (fm.membership_to_dates as string[] | undefined) || [];
			const notes = (fm.membership_notes as string[] | undefined) || [];

			for (let i = 0; i < orgs.length; i++) {
				const orgLink = orgs[i];
				if (!orgLink) continue;

				const toDate = toDates[i];
				const membership = this.createMembership(
					personCrId,
					personName,
					personFile,
					orgLink,
					orgIds[i],
					roles[i],
					fromDates[i],
					toDate,
					notes[i],
					!toDate // Current if no end date
				);
				memberships.push(membership);
			}

			return memberships;
		}

		// Priority 2: Check for legacy nested memberships array
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
						m.notes,
						!m.to // Current if no end date
					);
					memberships.push(membership);
				}
			}

			return memberships;
		}

		// Priority 3: Check for simple house/role membership (legacy)
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
				undefined, // No notes in simple format
				true // Simple memberships are considered current
			);
			memberships.push(membership);
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
	 * Add a membership to a person's note using flat parallel arrays
	 */
	async addMembership(personFile: TFile, membership: MembershipData): Promise<void> {
		const cache = this.app.metadataCache.getFileCache(personFile);
		if (!cache?.frontmatter) {
			throw new Error('Person file has no frontmatter');
		}

		let content = await this.app.vault.read(personFile);
		const fm = cache.frontmatter;

		// Get existing flat arrays or initialize empty
		const orgs: string[] = Array.isArray(fm.membership_orgs) ? [...fm.membership_orgs] : [];
		const orgIds: string[] = Array.isArray(fm.membership_org_ids) ? [...fm.membership_org_ids] : [];
		const roles: string[] = Array.isArray(fm.membership_roles) ? [...fm.membership_roles] : [];
		const fromDates: string[] = Array.isArray(fm.membership_from_dates) ? [...fm.membership_from_dates] : [];
		const toDates: string[] = Array.isArray(fm.membership_to_dates) ? [...fm.membership_to_dates] : [];
		const notes: string[] = Array.isArray(fm.membership_notes) ? [...fm.membership_notes] : [];

		// Add new membership to each array
		orgs.push(membership.org);
		orgIds.push(membership.org_id || '');
		roles.push(membership.role || '');
		fromDates.push(membership.from || '');
		toDates.push(membership.to || '');
		notes.push(membership.notes || '');

		// Update all flat arrays
		content = this.updateFrontmatterField(content, 'membership_orgs', orgs);
		content = this.updateFrontmatterField(content, 'membership_org_ids', orgIds);
		content = this.updateFrontmatterField(content, 'membership_roles', roles);
		content = this.updateFrontmatterField(content, 'membership_from_dates', fromDates);
		content = this.updateFrontmatterField(content, 'membership_to_dates', toDates);
		content = this.updateFrontmatterField(content, 'membership_notes', notes);

		await this.app.vault.modify(personFile, content);
		logger.info('addMembership', `Added membership to ${personFile.basename}`);
	}

	/**
	 * Remove a membership from a person's note
	 *
	 * Handles all three formats:
	 * - Flat parallel arrays (new format)
	 * - Legacy nested array (memberships)
	 * - Simple single membership (house/organization)
	 */
	async removeMembership(personFile: TFile, orgCrId: string): Promise<void> {
		const cache = this.app.metadataCache.getFileCache(personFile);
		if (!cache?.frontmatter) {
			return;
		}

		let content = await this.app.vault.read(personFile);
		const fm = cache.frontmatter;

		// Check flat parallel arrays first (new format)
		if (Array.isArray(fm.membership_org_ids)) {
			const orgIds = fm.membership_org_ids as string[];
			const indexToRemove = orgIds.findIndex(id => id === orgCrId);

			if (indexToRemove !== -1) {
				// Remove from all parallel arrays at the same index
				const orgs: string[] = Array.isArray(fm.membership_orgs) ? [...fm.membership_orgs] : [];
				const roles: string[] = Array.isArray(fm.membership_roles) ? [...fm.membership_roles] : [];
				const fromDates: string[] = Array.isArray(fm.membership_from_dates) ? [...fm.membership_from_dates] : [];
				const toDates: string[] = Array.isArray(fm.membership_to_dates) ? [...fm.membership_to_dates] : [];
				const notes: string[] = Array.isArray(fm.membership_notes) ? [...fm.membership_notes] : [];
				const newOrgIds = [...orgIds];

				orgs.splice(indexToRemove, 1);
				newOrgIds.splice(indexToRemove, 1);
				roles.splice(indexToRemove, 1);
				fromDates.splice(indexToRemove, 1);
				toDates.splice(indexToRemove, 1);
				notes.splice(indexToRemove, 1);

				// Update all arrays (or remove if empty)
				if (orgs.length === 0) {
					content = this.removeFrontmatterField(content, 'membership_orgs');
					content = this.removeFrontmatterField(content, 'membership_org_ids');
					content = this.removeFrontmatterField(content, 'membership_roles');
					content = this.removeFrontmatterField(content, 'membership_from_dates');
					content = this.removeFrontmatterField(content, 'membership_to_dates');
					content = this.removeFrontmatterField(content, 'membership_notes');
				} else {
					content = this.updateFrontmatterField(content, 'membership_orgs', orgs);
					content = this.updateFrontmatterField(content, 'membership_org_ids', newOrgIds);
					content = this.updateFrontmatterField(content, 'membership_roles', roles);
					content = this.updateFrontmatterField(content, 'membership_from_dates', fromDates);
					content = this.updateFrontmatterField(content, 'membership_to_dates', toDates);
					content = this.updateFrontmatterField(content, 'membership_notes', notes);
				}

				await this.app.vault.modify(personFile, content);
				logger.info('removeMembership', `Removed membership from ${personFile.basename}`);
				return;
			}
		}

		// Check legacy nested memberships array
		if (Array.isArray(fm.memberships)) {
			const filteredMemberships = fm.memberships.filter(
				(m: MembershipData) => m.org_id !== orgCrId
			);

			if (filteredMemberships.length !== fm.memberships.length) {
				if (filteredMemberships.length === 0) {
					content = this.removeFrontmatterField(content, 'memberships');
				} else {
					content = this.updateFrontmatterField(content, 'memberships', filteredMemberships);
				}
				await this.app.vault.modify(personFile, content);
				logger.info('removeMembership', `Removed membership from ${personFile.basename}`);
				return;
			}
		}

		// Check simple membership format
		if (fm.house_id === orgCrId || fm.organization_id === orgCrId) {
			content = this.removeFrontmatterField(content, 'house');
			content = this.removeFrontmatterField(content, 'house_id');
			content = this.removeFrontmatterField(content, 'organization');
			content = this.removeFrontmatterField(content, 'organization_id');
			content = this.removeFrontmatterField(content, 'role');
			await this.app.vault.modify(personFile, content);
			logger.info('removeMembership', `Removed simple membership from ${personFile.basename}`);
		}
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
		notes: string | undefined,
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
			notes,
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
			return '\n' + value.map(item => {
				// For objects in arrays, inline the first property with the hyphen
				if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
					const entries = Object.entries(item);
					if (entries.length === 0) {
						return `${spaces}- {}`;
					}
					const [firstKey, firstVal] = entries[0];
					const firstLine = `${spaces}- ${firstKey}: ${this.toYamlValue(firstVal)}`;
					if (entries.length === 1) {
						return firstLine;
					}
					// Remaining properties indented under the first
					const restLines = entries.slice(1)
						.map(([k, v]) => `${spaces}  ${k}: ${this.toYamlValue(v)}`)
						.join('\n');
					return `${firstLine}\n${restLines}`;
				}
				return `${spaces}- ${this.toYaml(item, indent + 1)}`;
			}).join('\n');
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

	/**
	 * Convert a simple value to YAML (for use in array item objects)
	 */
	private toYamlValue(value: unknown): string {
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
		// For complex nested values, fall back to toYaml
		return this.toYaml(value, 0);
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
