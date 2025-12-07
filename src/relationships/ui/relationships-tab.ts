/**
 * Relationships Tab UI Component
 *
 * Renders the Relationships tab in the Control Center, showing
 * relationship types, relationships list, and statistics.
 */

import { setIcon } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { LucideIconName } from '../../ui/lucide-icons';
import { RelationshipService } from '../services/relationship-service';
import { RELATIONSHIP_CATEGORY_NAMES, type RelationshipCategory } from '../types/relationship-types';
import { renderRelationshipTypeManagerCard } from './relationship-type-manager-card';

/**
 * Render the Relationships tab content
 */
export function renderRelationshipsTab(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const relationshipService = new RelationshipService(plugin);

	// Relationship Type Manager card (replaces simple types card)
	renderRelationshipTypeManagerCard(container, plugin, createCard, () => {
		showTab('relationships');
	});

	// Relationships Overview card
	renderRelationshipsOverviewCard(container, plugin, relationshipService, createCard);

	// Statistics card
	renderRelationshipStatsCard(container, relationshipService, createCard);
}

/**
 * Render Custom Relationships card with table of all custom relationships
 */
function renderRelationshipsOverviewCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	service: RelationshipService,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement
): void {
	const card = createCard({
		title: 'Custom relationships',
		icon: 'users'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Loading
	const loading = content.createDiv({ cls: 'crc-loading' });
	loading.createSpan({ text: 'Loading relationships...' });

	try {
		const relationships = service.getAllRelationships();
		const stats = service.getStats();

		loading.remove();

		if (relationships.length === 0) {
			const emptyState = content.createDiv({ cls: 'crc-empty-state' });
			setIcon(emptyState.createSpan({ cls: 'crc-empty-icon' }), 'link-2');
			emptyState.createEl('p', { text: 'No custom relationships found.' });
			emptyState.createEl('p', {
				cls: 'crc-text-muted',
				text: 'Custom relationships (godparent, guardian, mentor, etc.) are defined in person note frontmatter. Standard family links (spouse, parent, child) are handled separately on canvas trees.'
			});
		} else {
			// Summary row
			const summaryRow = content.createDiv({ cls: 'crc-relationship-summary-row' });
			summaryRow.createSpan({
				text: `${stats.totalDefined} defined relationships`,
				cls: 'crc-relationship-stat'
			});
			summaryRow.createSpan({
				text: `${stats.totalInferred} inferred`,
				cls: 'crc-relationship-stat crc-text-muted'
			});
			summaryRow.createSpan({
				text: `${stats.peopleWithRelationships} people`,
				cls: 'crc-relationship-stat'
			});

			// Table
			const tableContainer = content.createDiv({ cls: 'crc-table-container' });
			const table = tableContainer.createEl('table', { cls: 'crc-table' });

			// Header
			const thead = table.createEl('thead');
			const headerRow = thead.createEl('tr');
			headerRow.createEl('th', { text: 'From' });
			headerRow.createEl('th', { text: 'Type' });
			headerRow.createEl('th', { text: 'To' });
			headerRow.createEl('th', { text: 'Dates' });

			// Body
			const tbody = table.createEl('tbody');

			// Limit display to first 50
			const displayRels = relationships.slice(0, 50);
			for (const rel of displayRels) {
				const row = tbody.createEl('tr');
				if (rel.isInferred) {
					row.classList.add('crc-table-row--muted');
				}

				// From
				const fromCell = row.createEl('td');
				const fromLink = fromCell.createEl('a', {
					text: rel.sourceName,
					cls: 'crc-person-link'
				});
				fromLink.addEventListener('click', (e) => {
					e.preventDefault();
					void plugin.app.workspace.openLinkText(rel.sourceFilePath, '');
				});

				// Type
				const typeCell = row.createEl('td');
				const typeBadge = typeCell.createSpan({ cls: 'crc-relationship-badge' });
				typeBadge.style.backgroundColor = rel.type.color;
				typeBadge.style.color = getContrastColor(rel.type.color);
				typeBadge.textContent = rel.type.name;
				if (rel.isInferred) {
					typeCell.createSpan({ text: ' (inferred)', cls: 'crc-text-muted' });
				}

				// To
				const toCell = row.createEl('td');
				if (rel.targetFilePath) {
					const toLink = toCell.createEl('a', {
						text: rel.targetName,
						cls: 'crc-person-link'
					});
					toLink.addEventListener('click', (e) => {
						e.preventDefault();
						void plugin.app.workspace.openLinkText(rel.targetFilePath!, '');
					});
				} else {
					toCell.createSpan({ text: rel.targetName, cls: 'crc-text-muted' });
				}

				// Dates
				const datesCell = row.createEl('td');
				const dateParts: string[] = [];
				if (rel.from) dateParts.push(rel.from);
				if (rel.to) dateParts.push(rel.to);
				datesCell.textContent = dateParts.length > 0 ? dateParts.join(' – ') : '—';
			}

			if (relationships.length > 50) {
				content.createEl('p', {
					cls: 'crc-text-muted',
					text: `Showing 50 of ${relationships.length} relationships.`
				});
			}
		}
	} catch (error) {
		loading.remove();
		content.createEl('p', {
			cls: 'crc-error',
			text: `Failed to load relationships: ${error instanceof Error ? error.message : String(error)}`
		});
	}

	container.appendChild(card);
}

/**
 * Render Relationship Statistics card
 */
function renderRelationshipStatsCard(
	container: HTMLElement,
	service: RelationshipService,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement
): void {
	const card = createCard({
		title: 'Statistics',
		icon: 'bar-chart'
	});
	const content = card.querySelector('.crc-card__content') as HTMLElement;

	try {
		const stats = service.getStats();

		if (stats.totalDefined === 0) {
			content.createEl('p', {
				cls: 'crc-text-muted',
				text: 'No relationship statistics available yet.'
			});
		} else {
			// By Type
			const byTypeSection = content.createDiv({ cls: 'crc-stats-section' });
			byTypeSection.createEl('h4', { text: 'By type', cls: 'crc-section-subtitle' });

			const typeList = byTypeSection.createDiv({ cls: 'crc-stats-list' });
			const sortedTypes = Object.entries(stats.byType)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 10);

			for (const [typeId, count] of sortedTypes) {
				const typeDef = service.getRelationshipType(typeId);
				const item = typeList.createDiv({ cls: 'crc-stats-item' });

				const swatch = item.createSpan({ cls: 'crc-stats-swatch' });
				swatch.style.backgroundColor = typeDef?.color || '#666';

				item.createSpan({ text: typeDef?.name || typeId, cls: 'crc-stats-label' });
				item.createSpan({ text: count.toString(), cls: 'crc-stats-value' });
			}

			// By Category
			const byCatSection = content.createDiv({ cls: 'crc-stats-section' });
			byCatSection.createEl('h4', { text: 'By category', cls: 'crc-section-subtitle' });

			const catList = byCatSection.createDiv({ cls: 'crc-stats-list' });
			for (const [cat, count] of Object.entries(stats.byCategory)) {
				if (count > 0) {
					const item = catList.createDiv({ cls: 'crc-stats-item' });
					item.createSpan({
						text: RELATIONSHIP_CATEGORY_NAMES[cat as RelationshipCategory],
						cls: 'crc-stats-label'
					});
					item.createSpan({ text: count.toString(), cls: 'crc-stats-value' });
				}
			}
		}
	} catch (error) {
		content.createEl('p', {
			cls: 'crc-error',
			text: `Failed to load statistics: ${error instanceof Error ? error.message : String(error)}`
		});
	}

	container.appendChild(card);
}

/**
 * Get contrasting text color for a background color
 */
function getContrastColor(hexColor: string): string {
	const hex = hexColor.replace('#', '');
	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.5 ? '#000000' : '#ffffff';
}
