/**
 * Organization Notes - Type Definitions
 *
 * Enables tracking of non-genealogical hierarchies such as noble houses,
 * guilds, corporations, military units, and religious orders.
 */

import type { TFile } from 'obsidian';
import type { LucideIconName } from '../../ui/lucide-icons';

/**
 * Organization type identifiers
 */
export type OrganizationType =
	| 'noble_house'
	| 'guild'
	| 'corporation'
	| 'military'
	| 'religious'
	| 'political'
	| 'educational'
	| 'custom';

/**
 * Definition for an organization type
 */
export interface OrganizationTypeDefinition {
	/** Type identifier (e.g., "noble_house") */
	id: string;
	/** Display name (e.g., "Noble House") */
	name: string;
	/** Brief description of this organization type */
	description?: string;
	/** Color for UI display (CSS color value) */
	color: string;
	/** Lucide icon name */
	icon: LucideIconName;
	/** Category ID - can be built-in or custom */
	category: string;
	/** Whether this is a built-in type */
	isBuiltIn: boolean;
}

/**
 * Definition of an organization type category (built-in or custom)
 */
export interface OrganizationCategoryDefinition {
	id: string;
	name: string;
	sortOrder: number;
}

/**
 * Parsed organization information from a note
 */
export interface OrganizationInfo {
	/** The source file */
	file: TFile;
	/** Unique identifier (cr_id) */
	crId: string;
	/** Display name */
	name: string;
	/** Organization type/category */
	orgType: OrganizationType;
	/** Parent organization cr_id (for hierarchy) */
	parentOrg?: string;
	/** Parent organization wikilink (raw from frontmatter) */
	parentOrgLink?: string;
	/** Founding date (supports fictional dates) */
	founded?: string;
	/** Dissolution date */
	dissolved?: string;
	/** Organization motto/slogan */
	motto?: string;
	/** Primary location (wikilink to place note) */
	seat?: string;
	/** Universe scope */
	universe?: string;
	/** Media files linked to this organization (wikilinks) */
	media?: string[];
}

/**
 * Raw organization frontmatter as stored in notes
 */
export interface OrganizationFrontmatter {
	type: 'organization';
	cr_id: string;
	name: string;
	org_type: OrganizationType;
	parent_org?: string;
	founded?: string;
	dissolved?: string;
	motto?: string;
	seat?: string;
	universe?: string;
}

/**
 * Membership data as stored in person frontmatter (legacy nested format)
 * @deprecated Use flat parallel arrays instead (membership_orgs, membership_org_ids, etc.)
 */
export interface MembershipData {
	/** Wikilink to organization note */
	org: string;
	/** Organization cr_id for robust linking */
	org_id?: string;
	/** Role/position within organization */
	role?: string;
	/** Start date of membership */
	from?: string;
	/** End date of membership */
	to?: string;
	/** Additional notes */
	notes?: string;
}

/**
 * Flat membership properties as stored in person frontmatter
 *
 * Each array is parallel - index 0 in each array represents the same membership.
 * This format is consistent with sourced_* properties and works better with
 * Obsidian's Properties editor and Dataview queries.
 *
 * Example:
 * ```yaml
 * membership_orgs:
 *   - "[[House Stark]]"
 *   - "[[Small Council]]"
 * membership_org_ids:
 *   - org-house-stark
 *   - org-small-council
 * membership_roles:
 *   - Lord of Winterfell
 *   - Hand of the King
 * membership_from_dates:
 *   - "283 AC"
 *   - "298 AC"
 * membership_to_dates:
 *   - "298 AC"
 *   - "298 AC"
 * membership_notes:
 *   - ""
 *   - "Appointed after death of Jon Arryn"
 * ```
 */
export interface FlatMembershipProperties {
	/** Wikilinks to organization notes (parallel array) */
	membership_orgs?: string[];
	/** Organization cr_ids for robust linking (parallel array) */
	membership_org_ids?: string[];
	/** Roles/positions within organizations (parallel array) */
	membership_roles?: string[];
	/** Start dates of memberships (parallel array) */
	membership_from_dates?: string[];
	/** End dates of memberships (parallel array) */
	membership_to_dates?: string[];
	/** Additional notes/context for memberships (parallel array) */
	membership_notes?: string[];
}

/**
 * Resolved membership with full organization and person info
 */
export interface PersonMembership {
	/** The person's cr_id */
	personCrId: string;
	/** The person's display name */
	personName: string;
	/** The person's file */
	personFile: TFile;
	/** The organization info (if resolved) */
	org?: OrganizationInfo;
	/** Raw organization reference (wikilink) */
	orgLink: string;
	/** Organization cr_id */
	orgId?: string;
	/** Role/position within organization */
	role?: string;
	/** Start date of membership */
	from?: string;
	/** End date of membership */
	to?: string;
	/** Additional notes */
	notes?: string;
	/** Whether this is the current/active membership */
	isCurrent: boolean;
}

/**
 * Organization with its members loaded
 */
export interface OrganizationWithMembers extends OrganizationInfo {
	/** Members of this organization */
	members: PersonMembership[];
	/** Child organizations */
	children: OrganizationInfo[];
}

/**
 * Hierarchy node for tree visualization
 */
export interface OrganizationHierarchyNode {
	/** The organization info */
	org: OrganizationInfo;
	/** Child organizations */
	children: OrganizationHierarchyNode[];
	/** Depth in hierarchy (0 = root) */
	depth: number;
	/** Whether this node is expanded in UI */
	isExpanded?: boolean;
}

/**
 * Statistics about organizations in the vault
 */
export interface OrganizationStats {
	/** Total number of organizations */
	total: number;
	/** Count by organization type */
	byType: Record<OrganizationType, number>;
	/** Number of people with memberships */
	peopleWithMemberships: number;
	/** Total membership count (a person can have multiple) */
	totalMemberships: number;
	/** Organizations without any members */
	emptyOrganizations: number;
}
