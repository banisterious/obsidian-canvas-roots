/**
 * Organizations Tab UI Component
 *
 * Renders the Organizations tab in the Control Center, showing
 * organizations list, statistics, and hierarchy.
 */

import { setIcon, Setting, TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { LucideIconName } from '../../ui/lucide-icons';
import { createLucideIcon } from '../../ui/lucide-icons';
import { OrganizationService } from '../services/organization-service';
import { MembershipService } from '../services/membership-service';
import type { OrganizationInfo } from '../types/organization-types';
import { getOrganizationType, DEFAULT_ORGANIZATION_TYPES, getAllOrganizationTypes } from '../constants/organization-types';
import { CreateOrganizationModal } from './create-organization-modal';
import { TemplateSnippetsModal } from '../../ui/template-snippets-modal';
import { renderOrganizationTypeManagerCard } from './organization-type-manager-card';

/**
 * Filter options for organizations list
 */
type OrgFilter = 'all' | 'has_members' | 'no_members' | string;

/**
 * Sort options for organizations list
 */
type OrgSort = 'name_asc' | 'name_desc' | 'type' | 'members_desc' | 'members_asc' | 'universe';

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

	// Create organization button
	new Setting(content)
		.setName('Create organization')
		.setDesc('Create a new organization note')
		.addButton(button => button
			.setButtonText('Create')
			.setCta()
			.onClick(() => {
				new CreateOrganizationModal(plugin.app, plugin, () => {
					showTab('organizations');
				}).open();
			}));

	// View templates button
	new Setting(content)
		.setName('Templater templates')
		.setDesc('Copy ready-to-use templates for Templater integration')
		.addButton(button => button
			.setButtonText('View templates')
			.onClick(() => {
				new TemplateSnippetsModal(plugin.app, 'organization').open();
			}));

	// Get all organizations
	const allOrgs = orgService.getAllOrganizations();

	if (allOrgs.length === 0) {
		const emptyState = content.createDiv({ cls: 'crc-empty-state' });
		setIcon(emptyState.createSpan({ cls: 'crc-empty-icon' }), 'building');
		emptyState.createEl('p', { text: 'No organizations found.' });
		emptyState.createEl('p', {
			cls: 'crc-text-muted',
			text: 'Create organization notes with cr_type: organization in frontmatter, or use the button above.'
		});
	} else {
		// Pre-compute member counts for all orgs
		const memberCounts = new Map<string, number>();
		for (const org of allOrgs) {
			memberCounts.set(org.crId, membershipService.getOrganizationMembers(org.crId).length);
		}

		// Check if any org has members
		const anyHasMembers = Array.from(memberCounts.values()).some(count => count > 0);

		// State for filters, sorting, and pagination
		let currentFilter: OrgFilter = 'all';
		let currentSort: OrgSort = 'name_asc';
		let displayLimit = 25;

		// Filter and sort controls
		const controls = content.createDiv({ cls: 'crc-org-controls' });

		// Filter dropdown
		const filterContainer = controls.createDiv({ cls: 'crc-filter-container' });
		filterContainer.createEl('label', { text: 'Filter: ', cls: 'crc-text-small crc-text-muted' });
		const filterSelect = filterContainer.createEl('select', { cls: 'dropdown crc-filter-select' });

		// Build filter options
		filterSelect.createEl('option', { value: 'all', text: 'All organizations' });

		// Add type-based filters dynamically
		const orgTypes = getAllOrganizationTypes(plugin.settings.customOrganizationTypes || []);
		if (orgTypes.length > 0) {
			const typeGroup = filterSelect.createEl('optgroup', { attr: { label: 'By type' } });
			for (const ot of orgTypes) {
				typeGroup.createEl('option', { value: `type_${ot.id}`, text: ot.name });
			}
		}

		// Membership filters
		if (anyHasMembers) {
			const memberGroup = filterSelect.createEl('optgroup', { attr: { label: 'By membership' } });
			memberGroup.createEl('option', { value: 'has_members', text: 'Has members' });
			memberGroup.createEl('option', { value: 'no_members', text: 'No members' });
		}

		// Sort dropdown
		const sortContainer = controls.createDiv({ cls: 'crc-filter-container' });
		sortContainer.createEl('label', { text: 'Sort: ', cls: 'crc-text-small crc-text-muted' });
		const sortSelect = sortContainer.createEl('select', { cls: 'dropdown crc-filter-select' });
		sortSelect.createEl('option', { value: 'name_asc', text: 'Name A-Z' });
		sortSelect.createEl('option', { value: 'name_desc', text: 'Name Z-A' });
		sortSelect.createEl('option', { value: 'type', text: 'Type' });
		if (anyHasMembers) {
			sortSelect.createEl('option', { value: 'members_desc', text: 'Members (most)' });
			sortSelect.createEl('option', { value: 'members_asc', text: 'Members (least)' });
		}
		sortSelect.createEl('option', { value: 'universe', text: 'Universe' });

		// Table container (for refreshing)
		const tableContainer = content.createDiv({ cls: 'crc-org-table-container' });

		// Filter function
		const filterOrgs = (orgs: OrganizationInfo[]): OrganizationInfo[] => {
			return orgs.filter(org => {
				switch (currentFilter) {
					case 'all':
						return true;
					case 'has_members':
						return (memberCounts.get(org.crId) ?? 0) > 0;
					case 'no_members':
						return (memberCounts.get(org.crId) ?? 0) === 0;
					default:
						// Type-based filter (type_xxx)
						if (currentFilter.startsWith('type_')) {
							const typeId = currentFilter.replace('type_', '');
							return org.orgType === typeId;
						}
						return true;
				}
			});
		};

		// Sort function
		const sortOrgs = (orgs: OrganizationInfo[]): OrganizationInfo[] => {
			return [...orgs].sort((a, b) => {
				switch (currentSort) {
					case 'name_asc':
						return a.name.localeCompare(b.name);
					case 'name_desc':
						return b.name.localeCompare(a.name);
					case 'type':
						return (a.orgType || '').localeCompare(b.orgType || '');
					case 'members_desc':
						return (memberCounts.get(b.crId) ?? 0) - (memberCounts.get(a.crId) ?? 0);
					case 'members_asc':
						return (memberCounts.get(a.crId) ?? 0) - (memberCounts.get(b.crId) ?? 0);
					case 'universe':
						return (a.universe || '').localeCompare(b.universe || '');
					default:
						return 0;
				}
			});
		};

		// Render table function
		const renderTable = () => {
			tableContainer.empty();

			const filtered = filterOrgs(allOrgs);
			const sorted = sortOrgs(filtered);
			const displayed = sorted.slice(0, displayLimit);

			if (filtered.length === 0) {
				const noResults = tableContainer.createDiv({ cls: 'crc-empty-state' });
				noResults.createEl('p', { text: 'No organizations match the current filter.' });
				return;
			}

			// Hint text above table
			const hint = tableContainer.createEl('p', { cls: 'crc-text-muted crc-text-small crc-mb-2' });
			hint.appendText('Click a row to edit. ');
			const fileIconHint = createLucideIcon('file-text', 12);
			fileIconHint.style.display = 'inline';
			fileIconHint.style.verticalAlign = 'middle';
			hint.appendChild(fileIconHint);
			hint.appendText(' opens the note.');

			const table = tableContainer.createEl('table', { cls: 'cr-org-table' });

			// Header
			const thead = table.createEl('thead');
			const headerRow = thead.createEl('tr');
			headerRow.createEl('th', { text: 'Name' });
			headerRow.createEl('th', { text: 'Type' });
			headerRow.createEl('th', { text: 'Universe' });
			if (anyHasMembers) {
				headerRow.createEl('th', { text: 'Members' });
			}
			headerRow.createEl('th', { text: '', cls: 'cr-org-th-actions' });

			// Body
			const tbody = table.createEl('tbody');
			for (const org of displayed) {
				renderOrganizationRow(tbody, org, memberCounts.get(org.crId) ?? 0, plugin, anyHasMembers, showTab, renderTable);
			}

			// Show count and load more button
			if (filtered.length > displayLimit) {
				const loadMoreContainer = tableContainer.createDiv({ cls: 'crc-load-more-container' });
				loadMoreContainer.createSpan({
					text: `Showing ${displayed.length} of ${filtered.length} organizations`,
					cls: 'crc-text-muted'
				});
				const loadMoreBtn = loadMoreContainer.createEl('button', { cls: 'mod-cta' });
				loadMoreBtn.textContent = 'Load more';
				loadMoreBtn.addEventListener('click', () => {
					displayLimit += 25;
					renderTable();
				});
			} else if (filtered.length > 0) {
				const countInfo = tableContainer.createDiv({ cls: 'crc-count-info' });
				countInfo.createSpan({
					text: `Showing all ${filtered.length} organization${filtered.length !== 1 ? 's' : ''}`,
					cls: 'crc-text-muted'
				});
			}
		};

		// Event listeners
		filterSelect.addEventListener('change', () => {
			currentFilter = filterSelect.value as OrgFilter;
			displayLimit = 25; // Reset pagination on filter change
			renderTable();
		});

		sortSelect.addEventListener('change', () => {
			currentSort = sortSelect.value as OrgSort;
			renderTable();
		});

		// Initial render
		renderTable();
	}

	container.appendChild(card);
}

/**
 * Render a single organization as a table row
 */
function renderOrganizationRow(
	tbody: HTMLTableSectionElement,
	org: OrganizationInfo,
	memberCount: number,
	plugin: CanvasRootsPlugin,
	showMembers: boolean,
	showTab: (tabId: string) => void,
	onRefresh: () => void
): void {
	const typeDef = getOrganizationType(org.orgType);

	const row = tbody.createEl('tr', { cls: 'cr-org-row' });

	// Click row to open edit modal
	row.addEventListener('click', () => {
		if (org.file instanceof TFile) {
			new CreateOrganizationModal(plugin.app, plugin, {
				onSuccess: () => {
					showTab('organizations');
				},
				editOrg: org,
				editFile: org.file
			}).open();
		}
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
		membersCell.textContent = memberCount > 0 ? String(memberCount) : '—';
	}

	// Actions cell with open note button
	const actionsCell = row.createEl('td', { cls: 'cr-org-cell-actions' });
	const openBtn = actionsCell.createEl('button', {
		cls: 'crc-btn crc-btn--small crc-btn--ghost',
		attr: { title: 'Open organization note' }
	});
	const fileIcon = createLucideIcon('file-text', 14);
	openBtn.appendChild(fileIcon);

	openBtn.addEventListener('click', (e) => {
		e.stopPropagation(); // Don't trigger row click
		if (org.file instanceof TFile) {
			void plugin.app.workspace.getLeaf(false).openFile(org.file);
		}
	});
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
