/**
 * Organizations Tab UI Component
 *
 * Renders the Organizations tab in the Control Center, showing
 * organizations list, statistics, and hierarchy.
 */

import { setIcon, Setting } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { LucideIconName } from '../../ui/lucide-icons';
import { OrganizationService } from '../services/organization-service';
import { MembershipService } from '../services/membership-service';
import type { OrganizationInfo } from '../types/organization-types';
import { getOrganizationType, DEFAULT_ORGANIZATION_TYPES } from '../constants/organization-types';
import { CreateOrganizationModal } from './create-organization-modal';
import { TemplateSnippetsModal } from '../../ui/template-snippets-modal';
import { renderOrganizationTypeManagerCard } from './organization-type-manager-card';

/**
 * Render the Organizations tab content
 */
export function renderOrganizationsTab(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const orgService = new OrganizationService(plugin);
	const membershipService = new MembershipService(plugin, orgService);

	// Organizations List card
	renderOrganizationsListCard(container, plugin, orgService, membershipService, createCard, showTab);

	// Statistics card
	renderOrganizationStatsCard(container, orgService, membershipService, createCard);

	// Organization Type Manager card (replaces simple types card)
	renderOrganizationTypeManagerCard(container, plugin, createCard, () => {
		showTab('organizations');
	});

	// Data tools card
	renderDataToolsCard(container, plugin, createCard);
}

/**
 * Render the main Organizations List card
 */
function renderOrganizationsListCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	orgService: OrganizationService,
	membershipService: MembershipService,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const card = createCard({
		title: 'Organizations',
		icon: 'building'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Toolbar
	const toolbar = content.createDiv({ cls: 'crc-card-toolbar' });

	const addBtn = toolbar.createEl('button', { cls: 'mod-cta' });
	setIcon(addBtn.createSpan({ cls: 'crc-button-icon' }), 'plus');
	addBtn.createSpan({ text: 'Create organization' });
	addBtn.addEventListener('click', () => {
		new CreateOrganizationModal(plugin.app, plugin, () => {
			showTab('organizations');
		}).open();
	});

	const templateBtn = toolbar.createEl('button');
	setIcon(templateBtn.createSpan({ cls: 'crc-button-icon' }), 'file-code');
	templateBtn.createSpan({ text: 'View templates' });
	templateBtn.addEventListener('click', () => {
		new TemplateSnippetsModal(plugin.app, 'organization').open();
	});

	// Get organizations grouped by type
	const orgs = orgService.getAllOrganizations();

	if (orgs.length === 0) {
		const emptyState = content.createDiv({ cls: 'crc-empty-state' });
		setIcon(emptyState.createSpan({ cls: 'crc-empty-icon' }), 'building');
		emptyState.createEl('p', { text: 'No organizations found.' });
		emptyState.createEl('p', {
			cls: 'crc-text-muted',
			text: 'Create organization notes with type: organization in frontmatter, or use the button above.'
		});
	} else {
		// Check if any org has members
		const anyHasMembers = orgs.some(org =>
			membershipService.getOrganizationMembers(org.crId).length > 0
		);

		// Render as table
		const table = content.createEl('table', { cls: 'cr-org-table' });

		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Name' });
		headerRow.createEl('th', { text: 'Type' });
		headerRow.createEl('th', { text: 'Universe' });
		if (anyHasMembers) {
			headerRow.createEl('th', { text: 'Members' });
		}

		// Body
		const tbody = table.createEl('tbody');
		const sortedOrgs = orgs.sort((a, b) => a.name.localeCompare(b.name));

		for (const org of sortedOrgs) {
			renderOrganizationRow(tbody, org, membershipService, plugin, anyHasMembers);
		}
	}

	container.appendChild(card);
}

/**
 * Render a single organization as a table row
 */
function renderOrganizationRow(
	tbody: HTMLTableSectionElement,
	org: OrganizationInfo,
	membershipService: MembershipService,
	plugin: CanvasRootsPlugin,
	showMembers: boolean
): void {
	const typeDef = getOrganizationType(org.orgType);
	const members = membershipService.getOrganizationMembers(org.crId);

	const row = tbody.createEl('tr', { cls: 'cr-org-row' });
	row.addEventListener('click', () => {
		void plugin.app.workspace.openLinkText(org.file.path, '');
	});

	// Name cell
	const nameCell = row.createEl('td', { cls: 'cr-org-cell-name' });
	nameCell.createSpan({ text: org.name });

	// Type cell with badge
	const typeCell = row.createEl('td', { cls: 'cr-org-cell-type' });
	const typeBadge = typeCell.createSpan({ cls: 'cr-org-type-badge' });
	typeBadge.style.backgroundColor = typeDef.color;
	typeBadge.style.color = getContrastColor(typeDef.color);
	typeBadge.textContent = typeDef.name;

	// Universe cell
	const universeCell = row.createEl('td', { cls: 'cr-org-cell-universe' });
	universeCell.textContent = org.universe || '—';

	// Members cell (only if any org has members)
	if (showMembers) {
		const membersCell = row.createEl('td', { cls: 'cr-org-cell-members' });
		membersCell.textContent = members.length > 0 ? String(members.length) : '—';
	}
}

/**
 * Get contrasting text color for a background
 */
function getContrastColor(hexColor: string): string {
	// Remove # if present
	const hex = hexColor.replace('#', '');
	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);
	// Calculate luminance
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Render the Organization Statistics card
 */
function renderOrganizationStatsCard(
	container: HTMLElement,
	orgService: OrganizationService,
	membershipService: MembershipService,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement
): void {
	const card = createCard({
		title: 'Statistics',
		icon: 'bar-chart'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	const stats = orgService.getStats();
	const membershipStats = membershipService.getMembershipStats();

	// Summary stats
	const statsGrid = content.createDiv({ cls: 'cr-stats-grid' });

	const createStatItem = (label: string, value: string | number) => {
		const item = statsGrid.createDiv({ cls: 'cr-stat-item' });
		item.createDiv({ cls: 'cr-stat-value', text: String(value) });
		item.createDiv({ cls: 'cr-stat-label', text: label });
	};

	createStatItem('Organizations', stats.total);
	createStatItem('People with memberships', membershipStats.peopleWithMemberships);
	createStatItem('Total memberships', membershipStats.totalMemberships);

	// Breakdown by type
	if (stats.total > 0) {
		const breakdown = content.createDiv({ cls: 'cr-stats-breakdown' });
		breakdown.createEl('h4', { text: 'By type', cls: 'cr-subsection-heading' });

		const typeList = breakdown.createDiv({ cls: 'cr-type-breakdown-list' });
		for (const typeDef of DEFAULT_ORGANIZATION_TYPES) {
			const count = (stats.byType as Record<string, number>)[typeDef.id] || 0;
			if (count === 0) continue;

			const row = typeList.createDiv({ cls: 'cr-type-breakdown-row' });
			const swatch = row.createDiv({ cls: 'cr-type-swatch' });
			swatch.style.backgroundColor = typeDef.color;
			row.createSpan({ text: typeDef.name });
			row.createSpan({ text: String(count), cls: 'crc-text-muted' });
		}
	}

	container.appendChild(card);
}

/**
 * Render the Data Tools card
 */
function renderDataToolsCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement
): void {
	const card = createCard({
		title: 'Data tools',
		icon: 'table-2'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	new Setting(content)
		.setName('Create base template')
		.setDesc('Create a ready-to-use Obsidian Bases template for managing organizations in table view')
		.addButton(btn => btn
			.setButtonText('Create template')
			.setCta()
			.onClick(() => {
				plugin.app.commands.executeCommandById('canvas-roots:create-organizations-base-template');
			})
		);

	container.appendChild(card);
}
