/**
 * Places Tab UI Component
 *
 * Renders the Places tab in the Control Center, showing
 * place statistics, lists, references, and data quality issues.
 */

import { Menu, Modal, Notice, Setting, TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../main';
import type { LucideIconName } from './lucide-icons';
import { createLucideIcon } from './lucide-icons';
import { PlaceGraphService } from '../core/place-graph';
import type { PlaceCategory } from '../models/place';
import { CreatePlaceModal } from './create-place-modal';
import { CreateMissingPlacesModal } from './create-missing-places-modal';
import { StandardizePlacesModal, findPlaceNameVariations } from './standardize-places-modal';
import { MergeDuplicatePlacesModal, findDuplicatePlaceNotes } from './merge-duplicate-places-modal';
import { StandardizePlaceTypesModal, findNonStandardTypePlaces } from './standardize-place-types-modal';
import { StandardizePlaceVariantsModal, findPlaceNameVariants } from './standardize-place-variants-modal';
import { TemplateSnippetsModal } from './template-snippets-modal';
import { renderPlaceTypeManagerCard } from '../places/ui/place-type-manager-card';
import { BulkGeocodeModal } from '../maps/ui/bulk-geocode-modal';
import { EnrichPlaceHierarchyModal } from '../maps/ui/enrich-place-hierarchy-modal';

/**
 * Render the Places tab content
 */
export function renderPlacesTab(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	// 1. Actions Card - create and manage places
	const actionsCard = createCard({
		title: 'Actions',
		icon: 'plus',
		subtitle: 'Create and manage place notes'
	});

	const actionsContent = actionsCard.querySelector('.crc-card__content') as HTMLElement;

	new Setting(actionsContent)
		.setName('Create place note')
		.setDesc('Create a new place note with geographic information')
		.addButton(button => button
			.setButtonText('Create')
			.setCta()
			.onClick(() => {
				new CreatePlaceModal(plugin.app, {
					directory: plugin.settings.placesFolder || '',
					familyGraph: plugin.createFamilyGraphService(),
					placeGraph: new PlaceGraphService(plugin.app),
					settings: plugin.settings,
					plugin,
					onCreated: () => showTab('places')
				}).open();
			}));

	new Setting(actionsContent)
		.setName('Templater templates')
		.setDesc('Copy ready-to-use templates for Templater integration')
		.addButton(button => button
			.setButtonText('View templates')
			.onClick(() => {
				new TemplateSnippetsModal(plugin.app, 'place', plugin.settings.propertyAliases).open();
			}));

	new Setting(actionsContent)
		.setName('Create Places base')
		.setDesc('Create an Obsidian base for managing Place notes. After creating, click "Properties" to enable columns like Name, Category, Coordinates, and Contained by.')
		.addButton(button => button
			.setButtonText('Create')
			.onClick(() => {
				plugin.app.commands.executeCommandById('canvas-roots:create-places-base-template');
			}));

	container.appendChild(actionsCard);

	// 2. Data Quality Card (unified issues + actions)
	const dataQualityCard = createCard({
		title: 'Data quality',
		icon: 'alert-triangle',
		subtitle: 'Place-related issues and fixes'
	});

	const dataQualityContent = dataQualityCard.querySelector('.crc-card__content') as HTMLElement;
	dataQualityContent.createEl('p', {
		text: 'Loading issues...',
		cls: 'crc-text--muted'
	});

	container.appendChild(dataQualityCard);

	// Load data quality content asynchronously
	loadDataQualityCard(dataQualityContent, plugin, showTab);

	// 3. Place List Card - browse/edit
	const listCard = createCard({
		title: 'Place notes',
		icon: 'globe',
		subtitle: 'Defined place notes in your vault'
	});

	const listContent = listCard.querySelector('.crc-card__content') as HTMLElement;
	listContent.createEl('p', {
		text: 'Loading places...',
		cls: 'crc-text--muted'
	});

	container.appendChild(listCard);

	// Load place list asynchronously
	loadPlaceList(listContent, plugin, showTab);

	// 4. Place Type Manager card
	renderPlaceTypeManagerCard(container, plugin, createCard, () => {
		showTab('places');
	});

	// 5. Place Statistics Card - reference info, last
	const statsCard = createCard({
		title: 'Place statistics',
		icon: 'bar-chart',
		subtitle: 'Geographic data overview'
	});

	const statsContent = statsCard.querySelector('.crc-card__content') as HTMLElement;
	statsContent.createEl('p', {
		text: 'Loading statistics...',
		cls: 'crc-text--muted'
	});

	container.appendChild(statsCard);

	// Load statistics asynchronously
	loadPlaceStatistics(statsContent, plugin);
}

/**
 * Load the unified Data Quality card content
 */
function loadDataQualityCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	showTab: (tabId: string) => void
): void {
	container.empty();

	// Navigation guidance
	const navInfo = container.createEl('p', {
		cls: 'crc-text-muted',
		text: 'These data quality checks are specific to place notes. For comprehensive data quality analysis across all entities, see the '
	});
	const dataQualityLink = navInfo.createEl('a', {
		text: 'Data Quality tab',
		href: '#',
		cls: 'crc-text-link'
	});
	dataQualityLink.addEventListener('click', (e) => {
		e.preventDefault();
		showTab('data-quality');
	});
	navInfo.appendText('.');

	const placeService = new PlaceGraphService(plugin.app);
	placeService.setSettings(plugin.settings);
	placeService.setValueAliases(plugin.settings.valueAliases);
	placeService.reloadCache();

	const stats = placeService.calculateStatistics();
	const issues = stats.issues;
	const references = placeService.getReferencedPlaces();

	// Get missing place references (unlinked)
	const missingPlaces: Array<{ name: string; count: number }> = [];
	for (const [name, info] of references.entries()) {
		if (!info.linked) {
			missingPlaces.push({ name, count: info.count });
		}
	}
	missingPlaces.sort((a, b) => b.count - a.count);

	// Group issues by type
	const issuesByType = new Map<string, typeof issues>();
	for (const issue of issues) {
		if (!issuesByType.has(issue.type)) {
			issuesByType.set(issue.type, []);
		}
		issuesByType.get(issue.type)!.push(issue);
	}

	// Get duplicate place groups (using same logic as merge modal)
	// This ensures the card count matches what the modal will actually find
	const duplicateGroups = findDuplicatePlaceNotes(plugin.app, {
		settings: plugin.settings,
		folderFilter: plugin.getFolderFilter()
	});

	// Get places with non-standard types (locality, etc.)
	const nonStandardTypePlaces = findNonStandardTypePlaces(placeService);

	// Calculate total issues (missing places + other issues, but avoid double counting)
	// Missing places are tracked separately from PlaceIssue 'missing_place_note'
	// Exclude 'duplicate_name' from place-graph since we use findDuplicatePlaceNotes instead
	const missingPlaceNoteIssues = issuesByType.get('missing_place_note') || [];
	const duplicateNameIssues = issuesByType.get('duplicate_name') || [];
	const otherIssueCount = issues.length - missingPlaceNoteIssues.length - duplicateNameIssues.length;
	const totalIssues = missingPlaces.length + otherIssueCount + duplicateGroups.length + nonStandardTypePlaces.length;

	// Count categories (only count non-empty ones)
	let categoryCount = 0;
	if (missingPlaces.length > 0) categoryCount++;
	if (issuesByType.has('real_missing_coords')) categoryCount++;
	if (issuesByType.has('orphan_place')) categoryCount++;
	if (duplicateGroups.length > 0) categoryCount++;
	if (nonStandardTypePlaces.length > 0) categoryCount++;
	if (issuesByType.has('circular_hierarchy')) categoryCount++;
	if (issuesByType.has('fictional_with_coords')) categoryCount++;
	if (issuesByType.has('invalid_category')) categoryCount++;

	// If no issues at all, show success message
	if (totalIssues === 0) {
		const successState = container.createDiv({ cls: 'crc-dq-success' });
		const icon = createLucideIcon('check-circle', 24);
		icon.addClass('crc-text--success');
		successState.appendChild(icon);
		successState.createEl('p', {
			text: 'No data quality issues found!',
			cls: 'crc-text--success crc-mt-2'
		});

		// Still show other tools
		renderOtherTools(container, plugin, showTab);
		return;
	}

	// Summary bar
	const summaryBar = container.createDiv({ cls: 'crc-dq-summary' });

	const issuesSummary = summaryBar.createDiv({ cls: 'crc-dq-summary__item' });
	issuesSummary.createEl('span', {
		text: totalIssues.toLocaleString(),
		cls: 'crc-dq-summary__count crc-dq-summary__count--warning'
	});
	issuesSummary.createEl('span', {
		text: 'issues found',
		cls: 'crc-dq-summary__label'
	});

	const categoriesSummary = summaryBar.createDiv({ cls: 'crc-dq-summary__item' });
	categoriesSummary.createEl('span', {
		text: categoryCount.toString(),
		cls: 'crc-dq-summary__count'
	});
	categoriesSummary.createEl('span', {
		text: categoryCount === 1 ? 'category' : 'categories',
		cls: 'crc-dq-summary__label'
	});

	// Track which sections to expand by default (first two with issues)
	let expandedCount = 0;

	// Issue sections container
	const sectionsContainer = container.createDiv({ cls: 'crc-dq-sections' });

	// 1. Missing place notes section
	if (missingPlaces.length > 0) {
		renderIssueSection(sectionsContainer, {
			icon: 'file-plus',
			title: 'Missing place notes',
			count: missingPlaces.length,
			expanded: expandedCount < 2,
			items: missingPlaces.slice(0, 4).map(place => ({
				name: place.name,
				detail: `Referenced by ${place.count} ${place.count === 1 ? 'person' : 'people'}`,
				action: {
					label: 'Create',
					primary: true,
					onClick: () => showQuickCreatePlaceModal(plugin, place.name, showTab)
				}
			})),
			batchAction: {
				label: 'Create all missing places',
				onClick: () => showCreateMissingPlacesModal(plugin, showTab)
			}
		});
		expandedCount++;
	}

	// 2. Real places missing coordinates
	const missingCoords = issuesByType.get('real_missing_coords') || [];
	if (missingCoords.length > 0) {
		renderIssueSection(sectionsContainer, {
			icon: 'globe',
			title: 'Real places missing coordinates',
			count: missingCoords.length,
			expanded: expandedCount < 2,
			items: missingCoords.slice(0, 4).map(issue => ({
				name: issue.placeName || 'Unknown place',
				detail: 'Real place with no coordinates',
				action: {
					label: 'Edit',
					onClick: () => openPlaceForEditing(plugin, issue.filePath, placeService, showTab)
				}
			})),
			batchAction: {
				label: 'Bulk geocode all',
				onClick: () => {
					const placeGraph = new PlaceGraphService(plugin.app);
					placeGraph.setSettings(plugin.settings);
					placeGraph.setValueAliases(plugin.settings.valueAliases);
					placeGraph.reloadCache();
					new BulkGeocodeModal(plugin.app, placeGraph, {
						onComplete: () => showTab('places')
					}).open();
				}
			}
		});
		expandedCount++;
	}

	// 3. Orphan places (simplified - just count + action button)
	// Count real-world places without parents (matching EnrichPlaceHierarchyModal criteria)
	// Exclude top-level types - countries and regions without parents are typically
	// sovereign nations (Taiwan, South Korea, etc.) that don't need parent linking
	const topLevelTypes = ['country', 'region'];
	const allPlaces = placeService.getAllPlaces();
	const orphanRealPlaces = allPlaces.filter(place =>
		!place.parentId &&
		!topLevelTypes.includes(place.placeType || '') &&
		['real', 'historical', 'disputed'].includes(place.category)
	);
	if (orphanRealPlaces.length > 0) {
		renderSimplifiedIssueRow(sectionsContainer, {
			icon: 'alert-circle',
			title: `${orphanRealPlaces.length} orphan place${orphanRealPlaces.length !== 1 ? 's' : ''}`,
			description: 'Geocode places and auto-create parent place notes (city → county → state → country)',
			action: {
				label: 'Enrich hierarchy',
				onClick: () => {
					const placeGraph = new PlaceGraphService(plugin.app);
					placeGraph.setSettings(plugin.settings);
					placeGraph.setValueAliases(plugin.settings.valueAliases);
					placeGraph.reloadCache();
					new EnrichPlaceHierarchyModal(plugin.app, placeGraph, {
						directory: plugin.settings.placesFolder || '',
						onComplete: () => showTab('places')
					}).open();
				}
			}
		});
	}

	// 4. Duplicate places (using duplicateGroups computed earlier)
	if (duplicateGroups.length > 0) {
		renderSimplifiedIssueRow(sectionsContainer, {
			icon: 'copy',
			title: `${duplicateGroups.length} potential duplicate${duplicateGroups.length !== 1 ? 's' : ''}`,
			description: 'Place notes that may represent the same location',
			action: {
				label: 'Merge duplicates',
				onClick: () => showMergeDuplicatePlacesModal(plugin, showTab)
			}
		});
	}

	// 5. Standardize place name variations
	const variationGroups = findPlaceNameVariations(plugin.app);
	if (variationGroups.length > 0) {
		const totalVariations = variationGroups.reduce((sum, g) => sum + g.variations.length, 0);
		renderSimplifiedIssueRow(sectionsContainer, {
			icon: 'edit',
			title: `${totalVariations} name variation${totalVariations !== 1 ? 's' : ''} in ${variationGroups.length} group${variationGroups.length !== 1 ? 's' : ''}`,
			description: 'Unify place name spelling across person notes',
			action: {
				label: 'Standardize names',
				onClick: () => showStandardizePlacesModal(plugin, showTab)
			}
		});
	}

	// 5b. Standardize common place name variants (USA vs United States, state abbreviations, etc.)
	const placeVariants = findPlaceNameVariants(plugin.app);
	if (placeVariants.length > 0) {
		const totalVariantRefs = placeVariants.reduce((sum, v) => sum + v.count, 0);
		renderSimplifiedIssueRow(sectionsContainer, {
			icon: 'globe',
			title: `${placeVariants.length} place variant${placeVariants.length !== 1 ? 's' : ''} (${totalVariantRefs} ref${totalVariantRefs !== 1 ? 's' : ''})`,
			description: 'Standardize abbreviations: USA vs United States, CA vs California',
			action: {
				label: 'Standardize variants',
				onClick: () => showStandardizePlaceVariantsModal(plugin, showTab)
			}
		});
	}

	// 6. Non-standard place types (locality, etc.) - using already computed variable
	if (nonStandardTypePlaces.length > 0) {
		renderSimplifiedIssueRow(sectionsContainer, {
			icon: 'map-pin',
			title: `${nonStandardTypePlaces.length} place${nonStandardTypePlaces.length !== 1 ? 's' : ''} with generic types`,
			description: 'Convert "locality" and other generic types to city/town/village',
			action: {
				label: 'Standardize types',
				onClick: () => {
					new StandardizePlaceTypesModal(plugin.app, placeService, {
						onComplete: () => showTab('places')
					}).open();
				}
			}
		});
	}

	// 7. Circular hierarchies (if any)
	const circular = issuesByType.get('circular_hierarchy') || [];
	if (circular.length > 0) {
		renderIssueSection(sectionsContainer, {
			icon: 'refresh-cw',
			title: 'Circular hierarchies',
			count: circular.length,
			expanded: expandedCount < 2,
			items: circular.slice(0, 4).map(issue => ({
				name: issue.placeName || 'Unknown place',
				detail: 'Circular parent reference detected',
				action: {
					label: 'Fix',
					onClick: () => openPlaceForEditing(plugin, issue.filePath, placeService, showTab)
				}
			})),
			batchAction: undefined
		});
		expandedCount++;
	}

	// 8. Fictional places with coordinates (if any)
	const fictionalWithCoords = issuesByType.get('fictional_with_coords') || [];
	if (fictionalWithCoords.length > 0) {
		renderIssueSection(sectionsContainer, {
			icon: 'unlink',
			title: 'Fictional places with coordinates',
			count: fictionalWithCoords.length,
			expanded: expandedCount < 2,
			items: fictionalWithCoords.slice(0, 4).map(issue => ({
				name: issue.placeName || 'Unknown place',
				detail: 'Fictional place should not have real coordinates',
				action: {
					label: 'Fix',
					onClick: () => openPlaceForEditing(plugin, issue.filePath, placeService, showTab)
				}
			})),
			batchAction: undefined
		});
		expandedCount++;
	}

	// 9. Invalid categories (if any)
	const invalidCategory = issuesByType.get('invalid_category') || [];
	if (invalidCategory.length > 0) {
		renderIssueSection(sectionsContainer, {
			icon: 'help-circle',
			title: 'Invalid categories',
			count: invalidCategory.length,
			expanded: expandedCount < 2,
			items: invalidCategory.slice(0, 4).map(issue => ({
				name: issue.placeName || 'Unknown place',
				detail: 'Unrecognized place category',
				action: {
					label: 'Fix',
					onClick: () => openPlaceForEditing(plugin, issue.filePath, placeService, showTab)
				}
			})),
			batchAction: undefined
		});
		expandedCount++;
	}

	// Other tools section
	renderOtherTools(container, plugin, showTab);
}

/**
 * Render a collapsible issue section
 */
interface IssueSectionOptions {
	icon: LucideIconName;
	title: string;
	count: number;
	expanded: boolean;
	items: Array<{
		name: string;
		detail: string;
		action: {
			label: string;
			primary?: boolean;
			onClick: () => void;
		};
	}>;
	batchAction?: {
		label: string;
		onClick: () => void;
	};
}

function renderIssueSection(container: HTMLElement, options: IssueSectionOptions): void {
	const section = container.createDiv({
		cls: `crc-dq-section ${options.expanded ? 'crc-dq-section--expanded' : ''}`
	});

	// Header (clickable to expand/collapse)
	const header = section.createDiv({ cls: 'crc-dq-section__header' });

	const icon = createLucideIcon(options.icon, 16);
	icon.addClass('crc-dq-section__icon');
	header.appendChild(icon);

	header.createEl('span', {
		text: options.title,
		cls: 'crc-dq-section__title'
	});

	header.createEl('span', {
		text: options.count.toString(),
		cls: 'crc-dq-section__badge'
	});

	const chevron = createLucideIcon('chevron-right', 16);
	chevron.addClass('crc-dq-section__chevron');
	header.appendChild(chevron);

	// Toggle expand/collapse on header click
	header.addEventListener('click', () => {
		section.classList.toggle('crc-dq-section--expanded');
	});

	// Items container
	const itemsContainer = section.createDiv({ cls: 'crc-dq-section__items' });

	// Render items
	for (const item of options.items) {
		const itemEl = itemsContainer.createDiv({ cls: 'crc-dq-item' });

		const content = itemEl.createDiv({ cls: 'crc-dq-item__content' });
		content.createEl('div', {
			text: item.name,
			cls: 'crc-dq-item__name'
		});
		content.createEl('div', {
			text: item.detail,
			cls: 'crc-dq-item__detail'
		});

		const btn = itemEl.createEl('button', {
			text: item.action.label,
			cls: `crc-btn crc-btn--small ${item.action.primary ? 'crc-btn--primary' : 'crc-btn--ghost'}`
		});
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			item.action.onClick();
		});
	}

	// Batch action
	if (options.batchAction) {
		const batchRow = itemsContainer.createDiv({ cls: 'crc-dq-batch' });
		const batchBtn = batchRow.createEl('button', {
			cls: 'crc-dq-batch__btn'
		});
		batchBtn.createEl('span', { text: options.batchAction.label });
		const arrow = createLucideIcon('arrow-right', 14);
		batchBtn.appendChild(arrow);
		batchBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			options.batchAction!.onClick();
		});
	}
}

/**
 * Options for simplified issue row (no collapsible content)
 */
interface SimplifiedIssueRowOptions {
	icon: LucideIconName;
	title: string;
	description: string;
	action: {
		label: string;
		onClick: () => void;
	};
}

/**
 * Render a simplified issue row with count and single action button
 * Used for issues where per-item actions don't make sense
 */
function renderSimplifiedIssueRow(container: HTMLElement, options: SimplifiedIssueRowOptions): void {
	const row = container.createDiv({ cls: 'crc-dq-tool' });

	const icon = createLucideIcon(options.icon, 16);
	icon.addClass('crc-dq-section__icon');
	row.appendChild(icon);

	const info = row.createDiv({ cls: 'crc-dq-tool__info' });
	info.createEl('h4', { text: options.title });
	info.createEl('p', { text: options.description });

	const btn = row.createEl('button', {
		text: options.action.label,
		cls: 'crc-btn crc-btn--ghost'
	});
	btn.addEventListener('click', options.action.onClick);
}

/**
 * Render the "Other tools" section
 */
function renderOtherTools(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	showTab: (tabId: string) => void
): void {
	// Divider
	const divider = container.createDiv({ cls: 'crc-dq-divider' });
	divider.createEl('span', { text: 'Other tools' });

	// Tools list
	const toolsList = container.createDiv({ cls: 'crc-dq-tools' });

	// Normalize place name formatting
	const normalizeTool = toolsList.createDiv({ cls: 'crc-dq-tool' });
	const normalizeInfo = normalizeTool.createDiv({ cls: 'crc-dq-tool__info' });
	normalizeInfo.createEl('h4', { text: 'Normalize place name formatting' });
	normalizeInfo.createEl('p', { text: 'Standardize capitalization: "NEW YORK" → "New York", handle prefixes like van, de' });
	const normalizeActions = normalizeTool.createDiv({ cls: 'crc-dq-tool__actions' });
	const previewBtn = normalizeActions.createEl('button', {
		text: 'Preview',
		cls: 'crc-btn crc-btn--ghost'
	});
	previewBtn.addEventListener('click', () => {
		showNormalizePlaceNamesPreview(plugin, showTab);
	});
	const applyBtn = normalizeActions.createEl('button', {
		text: 'Apply',
		cls: 'crc-btn crc-btn--primary'
	});
	applyBtn.addEventListener('click', () => {
		showNormalizePlaceNamesApply(plugin, showTab);
	});
}

/**
 * Open a place note for editing
 */
function openPlaceForEditing(
	plugin: CanvasRootsPlugin,
	filePath: string | undefined,
	placeService: PlaceGraphService,
	showTab: (tabId: string) => void
): void {
	if (!filePath) return;

	const file = plugin.app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return;

	const place = placeService.getAllPlaces().find(p => p.filePath === filePath);
	if (!place) return;

	new CreatePlaceModal(plugin.app, {
		editPlace: place,
		editFile: file,
		placeGraph: placeService,
		settings: plugin.settings,
		onUpdated: () => showTab('places')
	}).open();
}

/**
 * Load place statistics into container
 */
function loadPlaceStatistics(container: HTMLElement, plugin: CanvasRootsPlugin): void {
	container.empty();

	const placeService = new PlaceGraphService(plugin.app);
	placeService.setSettings(plugin.settings);
	placeService.setValueAliases(plugin.settings.valueAliases);
	placeService.reloadCache();

	const stats = placeService.calculateStatistics();

	// If no places, show getting started message
	if (stats.totalPlaces === 0) {
		const emptyState = container.createDiv({ cls: 'crc-empty-state' });
		emptyState.createEl('p', {
			text: 'No place notes found in your vault.',
			cls: 'crc-text--muted'
		});
		emptyState.createEl('p', {
			text: 'Place notes use cr_type: place in their frontmatter. Create place notes to track geographic locations associated with your family tree.',
			cls: 'crc-text--muted crc-text--small'
		});
		return;
	}

	// Compact summary row
	const summaryRow = container.createDiv({ cls: 'crc-stats-summary-row' });

	const coordPercent = stats.totalPlaces > 0
		? Math.round((stats.withCoordinates / stats.totalPlaces) * 100)
		: 0;

	summaryRow.createEl('span', { text: `${stats.totalPlaces} places` });
	summaryRow.createEl('span', { text: ' · ', cls: 'crc-text--muted' });
	summaryRow.createEl('span', { text: `${coordPercent}% geocoded`, cls: coordPercent === 100 ? 'crc-text--success' : '' });
	summaryRow.createEl('span', { text: ' · ', cls: 'crc-text--muted' });
	summaryRow.createEl('span', { text: `${stats.maxHierarchyDepth} levels deep` });

	// By type breakdown (inline badges)
	const typeRow = container.createDiv({ cls: 'crc-stats-type-row crc-mt-2' });
	const allPlaces = placeService.getAllPlaces();
	const typeMap = new Map<string, number>();
	for (const place of allPlaces) {
		const type = place.placeType || 'untyped';
		typeMap.set(type, (typeMap.get(type) || 0) + 1);
	}

	// Sort by count descending, show top types
	const sortedTypes = Array.from(typeMap.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8);

	for (const [type, count] of sortedTypes) {
		const badge = typeRow.createEl('span', {
			cls: 'crc-stats-type-badge'
		});
		badge.createEl('span', { text: type, cls: 'crc-stats-type-name' });
		badge.createEl('span', { text: count.toString(), cls: 'crc-stats-type-count' });
	}

	// Collapsible detailed sections
	const detailsContainer = container.createDiv({ cls: 'crc-stats-details' });

	// Toggle for showing details
	const toggleRow = container.createDiv({ cls: 'crc-stats-toggle crc-mt-2' });
	const toggleBtn = toggleRow.createEl('button', {
		cls: 'crc-btn crc-btn--small crc-btn--ghost'
	});
	const toggleIcon = createLucideIcon('chevron-right', 14);
	toggleBtn.appendChild(toggleIcon);
	toggleBtn.createEl('span', { text: 'Show detailed statistics' });

	let detailsExpanded = false;

	toggleBtn.addEventListener('click', () => {
		detailsExpanded = !detailsExpanded;
		detailsContainer.classList.toggle('crc-stats-details--expanded', detailsExpanded);
		toggleBtn.empty();
		const newIcon = createLucideIcon(detailsExpanded ? 'chevron-down' : 'chevron-right', 14);
		toggleBtn.appendChild(newIcon);
		toggleBtn.createEl('span', { text: detailsExpanded ? 'Hide detailed statistics' : 'Show detailed statistics' });
	});

	// Detailed content (hidden by default)
	const detailsContent = detailsContainer.createDiv({ cls: 'crc-stats-details-content' });

	// By Category breakdown
	const categories: PlaceCategory[] = ['real', 'historical', 'disputed', 'legendary', 'mythological', 'fictional'];
	const nonZeroCategories = categories.filter(cat => stats.byCategory[cat] > 0);

	if (nonZeroCategories.length > 0) {
		const categorySection = detailsContent.createDiv({ cls: 'crc-stats-section' });
		categorySection.createEl('h5', { text: 'By category', cls: 'crc-stats-section-title' });

		const categoryList = categorySection.createDiv({ cls: 'crc-stats-inline-list' });
		for (const category of nonZeroCategories) {
			const count = stats.byCategory[category];
			categoryList.createEl('span', {
				text: `${formatPlaceCategoryName(category)}: ${count}`,
				cls: 'crc-stats-inline-item'
			});
		}
	}

	// Universes (if any fictional/mythological places)
	const universeCount = Object.keys(stats.byUniverse).length;
	if (universeCount > 0) {
		const universeSection = detailsContent.createDiv({ cls: 'crc-stats-section' });
		universeSection.createEl('h5', { text: 'Fictional universes', cls: 'crc-stats-section-title' });

		const universeList = universeSection.createDiv({ cls: 'crc-stats-inline-list' });
		for (const [universe, count] of Object.entries(stats.byUniverse).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
			universeList.createEl('span', {
				text: `${universe}: ${count}`,
				cls: 'crc-stats-inline-item'
			});
		}
	}

	// Top birth places
	if (stats.topBirthPlaces.length > 0) {
		const birthSection = detailsContent.createDiv({ cls: 'crc-stats-section' });
		birthSection.createEl('h5', { text: 'Top birth places', cls: 'crc-stats-section-title' });

		const birthList = birthSection.createDiv({ cls: 'crc-stats-inline-list' });
		for (const place of stats.topBirthPlaces.slice(0, 5)) {
			birthList.createEl('span', {
				text: `${place.place}: ${place.count}`,
				cls: 'crc-stats-inline-item'
			});
		}
	}

	// Top death places
	if (stats.topDeathPlaces.length > 0) {
		const deathSection = detailsContent.createDiv({ cls: 'crc-stats-section' });
		deathSection.createEl('h5', { text: 'Top death places', cls: 'crc-stats-section-title' });

		const deathList = deathSection.createDiv({ cls: 'crc-stats-inline-list' });
		for (const place of stats.topDeathPlaces.slice(0, 5)) {
			deathList.createEl('span', {
				text: `${place.place}: ${place.count}`,
				cls: 'crc-stats-inline-item'
			});
		}
	}

	// Migration patterns
	if (stats.migrationPatterns.length > 0) {
		const migrationSection = detailsContent.createDiv({ cls: 'crc-stats-section' });
		migrationSection.createEl('h5', { text: 'Migration patterns', cls: 'crc-stats-section-title' });

		const migrationList = migrationSection.createDiv({ cls: 'crc-stats-inline-list' });
		for (const pattern of stats.migrationPatterns.slice(0, 5)) {
			migrationList.createEl('span', {
				text: `${pattern.from} → ${pattern.to}: ${pattern.count}`,
				cls: 'crc-stats-inline-item'
			});
		}
	}

	// View full statistics link
	const statsLink = container.createDiv({ cls: 'cr-stats-link' });
	const link = statsLink.createEl('a', { text: 'View full statistics →', cls: 'crc-text-muted' });
	link.addEventListener('click', (e) => {
		e.preventDefault();
		void plugin.activateStatisticsView();
	});
}

/**
 * Filter options for place list
 */
type PlaceFilter = 'all' | 'real' | 'historical' | 'disputed' | 'legendary' | 'mythological' | 'fictional' | 'has_coordinates' | 'no_coordinates';

/**
 * Sort options for place list
 */
type PlaceSort = 'name_asc' | 'name_desc' | 'people_desc' | 'people_asc' | 'category' | 'type';

/**
 * Load place list into container
 */
function loadPlaceList(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	showTab: (tabId: string) => void
): void {
	container.empty();

	const placeService = new PlaceGraphService(plugin.app);
	placeService.setSettings(plugin.settings);
	placeService.setValueAliases(plugin.settings.valueAliases);
	placeService.reloadCache();

	const allPlaces = placeService.getAllPlaces();

	if (allPlaces.length === 0) {
		container.createEl('p', {
			text: 'No place notes found. Create place notes with cr_type: place in frontmatter.',
			cls: 'crc-text--muted'
		});
		return;
	}

	// Build people count map for sorting
	const peopleCountMap = new Map<string, number>();
	for (const place of allPlaces) {
		const peopleAtPlace = placeService.getPeopleAtPlace(place.id);
		peopleCountMap.set(place.id, peopleAtPlace.length);
	}

	// State
	let currentFilter: PlaceFilter = 'all';
	let currentSort: PlaceSort = 'name_asc';
	let displayLimit = 25;

	// Controls row (filter + sort + search)
	const controlsRow = container.createDiv({ cls: 'crc-place-controls crc-mb-3' });

	// Filter dropdown
	const filterSelect = controlsRow.createEl('select', { cls: 'dropdown' });

	const filterOptions: Array<{ value: PlaceFilter; label: string }> = [
		{ value: 'all', label: 'All places' },
		{ value: 'real', label: 'Real' },
		{ value: 'historical', label: 'Historical' },
		{ value: 'disputed', label: 'Disputed' },
		{ value: 'legendary', label: 'Legendary' },
		{ value: 'mythological', label: 'Mythological' },
		{ value: 'fictional', label: 'Fictional' },
		{ value: 'has_coordinates', label: 'Has coordinates' },
		{ value: 'no_coordinates', label: 'No coordinates' }
	];

	for (const opt of filterOptions) {
		filterSelect.createEl('option', { value: opt.value, text: opt.label });
	}

	// Sort dropdown
	const sortSelect = controlsRow.createEl('select', { cls: 'dropdown' });

	const sortOptions: Array<{ value: PlaceSort; label: string }> = [
		{ value: 'name_asc', label: 'Name (A–Z)' },
		{ value: 'name_desc', label: 'Name (Z–A)' },
		{ value: 'people_desc', label: 'People (most)' },
		{ value: 'people_asc', label: 'People (least)' },
		{ value: 'category', label: 'Category' },
		{ value: 'type', label: 'Type' }
	];

	for (const opt of sortOptions) {
		sortSelect.createEl('option', { value: opt.value, text: opt.label });
	}

	// Search input
	let searchQuery = '';
	const searchInput = controlsRow.createEl('input', {
		cls: 'crc-filter-input',
		attr: {
			type: 'text',
			placeholder: `Search ${allPlaces.length} places...`
		}
	});

	// Table container
	const tableContainer = container.createDiv({ cls: 'crc-place-table-container' });

	// Render function
	const renderTable = () => {
		tableContainer.empty();

		// Filter places
		const filtered = allPlaces.filter(place => {
			// Apply search filter first
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const matchesSearch = place.name.toLowerCase().includes(query) ||
					(place.placeType && place.placeType.toLowerCase().includes(query)) ||
					place.category.toLowerCase().includes(query);
				if (!matchesSearch) return false;
			}

			switch (currentFilter) {
				case 'all':
					return true;
				case 'real':
				case 'historical':
				case 'disputed':
				case 'legendary':
				case 'mythological':
				case 'fictional':
					return place.category === currentFilter;
				case 'has_coordinates':
					return place.coordinates !== undefined;
				case 'no_coordinates':
					return place.coordinates === undefined;
				default:
					return true;
			}
		});

		// Sort places
		filtered.sort((a, b) => {
			switch (currentSort) {
				case 'name_asc':
					return a.name.localeCompare(b.name);
				case 'name_desc':
					return b.name.localeCompare(a.name);
				case 'people_desc':
					return (peopleCountMap.get(b.id) || 0) - (peopleCountMap.get(a.id) || 0);
				case 'people_asc':
					return (peopleCountMap.get(a.id) || 0) - (peopleCountMap.get(b.id) || 0);
				case 'category': {
					const catOrder = ['real', 'historical', 'disputed', 'legendary', 'mythological', 'fictional'];
					return catOrder.indexOf(a.category) - catOrder.indexOf(b.category);
				}
				case 'type':
					return (a.placeType || '').localeCompare(b.placeType || '');
				default:
					return 0;
			}
		});

		if (filtered.length === 0) {
			tableContainer.createEl('p', {
				text: 'No places match the current filter.',
				cls: 'crc-text-muted crc-text-center'
			});
			return;
		}

		// Hint text
		const hint = tableContainer.createEl('p', { cls: 'crc-text-muted crc-text-small crc-mb-2' });
		hint.appendText('Click a row to edit. Use icons to open in new tab or window.');

		// Table
		const table = tableContainer.createEl('table', { cls: 'crc-place-table' });

		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Name' });
		headerRow.createEl('th', { text: 'Category' });
		headerRow.createEl('th', { text: 'Type' });
		headerRow.createEl('th', { text: 'Coordinates' });
		headerRow.createEl('th', { text: 'People' });
		headerRow.createEl('th', { text: 'Media', cls: 'crc-place-th--center' });
		headerRow.createEl('th', { text: '', cls: 'crc-place-th--actions' });

		// Body
		const tbody = table.createEl('tbody');

		const displayedPlaces = filtered.slice(0, displayLimit);

		for (const place of displayedPlaces) {
			const row = tbody.createEl('tr', { cls: 'crc-place-row' });

			// Click row to edit
			row.addEventListener('click', () => {
				const file = plugin.app.vault.getAbstractFileByPath(place.filePath);
				if (file instanceof TFile) {
					new CreatePlaceModal(plugin.app, {
						editPlace: place,
						editFile: file,
						placeGraph: placeService,
						settings: plugin.settings,
						onUpdated: () => {
							loadPlaceList(container, plugin, showTab);
						}
					}).open();
				}
			});

			// Context menu
			row.addEventListener('contextmenu', (e) => {
				e.preventDefault();
				const file = plugin.app.vault.getAbstractFileByPath(place.filePath);
				if (!(file instanceof TFile)) return;

				const menu = new Menu();

				menu.addItem((item) => {
					item
						.setTitle('Open note')
						.setIcon('file')
						.onClick(async () => {
							await plugin.trackRecentFile(file, 'place');
							void plugin.app.workspace.getLeaf(false).openFile(file);
						});
				});

				menu.addItem((item) => {
					item
						.setTitle('Open in new tab')
						.setIcon('file-plus')
						.onClick(async () => {
							await plugin.trackRecentFile(file, 'place');
							void plugin.app.workspace.getLeaf('tab').openFile(file);
						});
				});

				menu.addSeparator();

				// Media actions
				const mediaCount = place.media?.length || 0;
				menu.addItem((item) => {
					item
						.setTitle('Link media...')
						.setIcon('image-plus')
						.onClick(() => {
							plugin.openLinkMediaModal(file, 'place', place.name);
						});
				});

				if (mediaCount > 0) {
					menu.addItem((item) => {
						item
							.setTitle(`Manage media (${mediaCount})...`)
							.setIcon('images')
							.onClick(() => {
								plugin.openManageMediaModal(file, 'place', place.name);
							});
					});
				}

				menu.showAtMouseEvent(e);
			});

			// Name cell
			const nameCell = row.createEl('td', { cls: 'crc-place-cell-name' });
			nameCell.createEl('span', { text: place.name });
			if (place.universe) {
				nameCell.createEl('span', {
					text: place.universe,
					cls: 'crc-badge crc-badge--accent crc-badge--small crc-ml-1'
				});
			}

			// Category cell
			const categoryCell = row.createEl('td', { cls: 'crc-place-cell-category' });
			categoryCell.createEl('span', {
				text: formatPlaceCategoryName(place.category),
				cls: `crc-category-badge crc-category-badge--${place.category}`
			});

			// Type cell
			const typeCell = row.createEl('td', { cls: 'crc-place-cell-type' });
			if (place.placeType) {
				typeCell.textContent = place.placeType;
			} else {
				typeCell.createEl('span', { text: '—', cls: 'crc-text-muted' });
			}

			// Coordinates cell
			const coordsCell = row.createEl('td', { cls: 'crc-place-cell-coords' });
			if (place.coordinates) {
				const coordsWrapper = coordsCell.createDiv({ cls: 'crc-place-coords-wrapper' });

				// Format coordinates to reasonable precision
				const lat = place.coordinates.lat.toFixed(4);
				const lng = place.coordinates.long.toFixed(4);
				coordsWrapper.createEl('span', {
					text: `${lat}, ${lng}`,
					cls: 'crc-place-coords-text'
				});

				// Map button
				const mapBtn = coordsWrapper.createEl('button', {
					cls: 'crc-place-map-btn clickable-icon',
					attr: { 'aria-label': 'Show on map' }
				});
				const mapIcon = createLucideIcon('map', 14);
				mapBtn.appendChild(mapIcon);
				mapBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					void plugin.activateMapView(undefined, false, undefined, {
						lat: place.coordinates!.lat,
						lng: place.coordinates!.long,
						zoom: 12
					});
				});
			} else {
				coordsCell.createEl('span', { text: '—', cls: 'crc-text-muted' });
			}

			// People cell
			const peopleCell = row.createEl('td', { cls: 'crc-place-cell-people' });
			const peopleCount = peopleCountMap.get(place.id) || 0;
			if (peopleCount > 0) {
				peopleCell.textContent = peopleCount.toString();
			} else {
				peopleCell.createEl('span', { text: '—', cls: 'crc-text-muted' });
			}

			// Media cell
			const mediaCell = row.createEl('td', { cls: 'crc-place-cell-media' });
			const mediaCount = place.media?.length || 0;
			if (mediaCount > 0) {
				const mediaBadge = mediaCell.createEl('span', {
					cls: 'crc-person-list-badge crc-person-list-badge--media',
					attr: { title: `${mediaCount} media file${mediaCount !== 1 ? 's' : ''}` }
				});
				const mediaIcon = createLucideIcon('image', 12);
				mediaBadge.appendChild(mediaIcon);
				mediaBadge.appendText(mediaCount.toString());

				// Click to open manage media modal
				mediaBadge.addEventListener('click', (e) => {
					e.stopPropagation();
					const file = plugin.app.vault.getAbstractFileByPath(place.filePath);
					if (file instanceof TFile) {
						plugin.openManageMediaModal(file, 'place', place.name);
					}
				});
			} else {
				mediaCell.createEl('span', { text: '—', cls: 'crc-text-muted' });
			}

			// Actions cell
			const actionsCell = row.createEl('td', { cls: 'crc-place-cell-actions' });

			// Open in new tab button
			const openTabBtn = actionsCell.createEl('button', {
				cls: 'crc-place-open-btn clickable-icon',
				attr: { 'aria-label': 'Open note in new tab' }
			});
			const tabIcon = createLucideIcon('file-text', 14);
			openTabBtn.appendChild(tabIcon);
			openTabBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				const file = plugin.app.vault.getAbstractFileByPath(place.filePath);
				if (file instanceof TFile) {
					void (async () => {
						await plugin.trackRecentFile(file, 'place');
						void plugin.app.workspace.getLeaf('tab').openFile(file);
					})();
				}
			});

			// Open in new window button
			const openWindowBtn = actionsCell.createEl('button', {
				cls: 'crc-place-open-btn clickable-icon',
				attr: { 'aria-label': 'Open note in new window' }
			});
			const windowIcon = createLucideIcon('external-link', 14);
			openWindowBtn.appendChild(windowIcon);
			openWindowBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				const file = plugin.app.vault.getAbstractFileByPath(place.filePath);
				if (file instanceof TFile) {
					void (async () => {
						await plugin.trackRecentFile(file, 'place');
						void plugin.app.workspace.getLeaf('window').openFile(file);
					})();
				}
			});
		}

		// Footer with count and load more
		const footer = tableContainer.createDiv({ cls: 'crc-place-table-footer crc-mt-2' });

		const countText = footer.createEl('span', {
			cls: 'crc-text-muted crc-text-small'
		});
		countText.textContent = `Showing ${displayedPlaces.length} of ${filtered.length} place${filtered.length !== 1 ? 's' : ''}`;

		if (filtered.length > displayLimit) {
			const loadMoreBtn = footer.createEl('button', {
				text: `Load more (${Math.min(25, filtered.length - displayLimit)} more)`,
				cls: 'crc-btn crc-btn--small crc-btn--ghost crc-ml-2'
			});
			loadMoreBtn.addEventListener('click', () => {
				displayLimit += 25;
				renderTable();
			});
		}
	};

	// Event handlers
	filterSelect.addEventListener('change', () => {
		currentFilter = filterSelect.value as PlaceFilter;
		displayLimit = 25; // Reset pagination
		renderTable();
	});

	sortSelect.addEventListener('change', () => {
		currentSort = sortSelect.value as PlaceSort;
		renderTable();
	});

	searchInput.addEventListener('input', () => {
		searchQuery = searchInput.value;
		displayLimit = 25; // Reset pagination
		renderTable();
	});

	// Initial render
	renderTable();
}

/**
 * Format place category name for display
 */
function formatPlaceCategoryName(category: PlaceCategory): string {
	const names: Record<PlaceCategory, string> = {
		real: 'Real',
		historical: 'Historical',
		disputed: 'Disputed',
		legendary: 'Legendary',
		mythological: 'Mythological',
		fictional: 'Fictional'
	};
	return names[category] || category;
}

/**
 * Show modal to create missing place notes
 */
function showCreateMissingPlacesModal(plugin: CanvasRootsPlugin, showTab: (tabId: string) => void): void {
	const placeService = new PlaceGraphService(plugin.app);
	placeService.setSettings(plugin.settings);
	placeService.setValueAliases(plugin.settings.valueAliases);
	placeService.reloadCache();

	const references = placeService.getReferencedPlaces();

	// Find unlinked places (referenced but no note exists)
	const unlinked: Array<{ name: string; count: number }> = [];
	for (const [name, info] of references.entries()) {
		if (!info.linked) {
			unlinked.push({ name, count: info.count });
		}
	}

	// Sort by reference count (most referenced first)
	unlinked.sort((a, b) => b.count - a.count);

	if (unlinked.length === 0) {
		new Notice('All referenced places already have notes!');
		return;
	}

	// Create a selection modal
	const modal = new CreateMissingPlacesModal(plugin.app, unlinked, {
		directory: plugin.settings.placesFolder || '',
		placeGraph: placeService,
		onComplete: (created: number) => {
			if (created > 0) {
				// Refresh the Places tab
				showTab('places');
			}
		}
	});
	modal.open();
}

/**
 * Quick-create a single place note from an unlinked place name
 */
function showQuickCreatePlaceModal(
	plugin: CanvasRootsPlugin,
	placeName: string,
	showTab: (tabId: string) => void
): void {
	const modal = new CreatePlaceModal(plugin.app, {
		directory: plugin.settings.placesFolder || '',
		initialName: placeName,
		familyGraph: plugin.createFamilyGraphService(),
		placeGraph: new PlaceGraphService(plugin.app),
		settings: plugin.settings,
		plugin,
		onCreated: () => {
			new Notice(`Created place note: ${placeName}`);
			// Refresh the Places tab
			showTab('places');
		}
	});
	modal.open();
}

/**
 * Show modal to standardize place name variations
 */
function showStandardizePlacesModal(plugin: CanvasRootsPlugin, showTab: (tabId: string) => void): void {
	// Find place name variations
	const variationGroups = findPlaceNameVariations(plugin.app);

	if (variationGroups.length === 0) {
		new Notice('No place name variations found. Your place names are already consistent!');
		return;
	}

	const modal = new StandardizePlacesModal(plugin.app, variationGroups, {
		onComplete: (updated: number) => {
			if (updated > 0) {
				// Refresh the Places tab
				showTab('places');
			}
		}
	});
	modal.open();
}

/**
 * Show modal to standardize common place name variants (USA vs United States, state abbreviations, etc.)
 */
function showStandardizePlaceVariantsModal(plugin: CanvasRootsPlugin, showTab: (tabId: string) => void): void {
	// Find place name variants
	const variants = findPlaceNameVariants(plugin.app);

	if (variants.length === 0) {
		new Notice('No place name variants found. Your place names are already standardized!');
		return;
	}

	const modal = new StandardizePlaceVariantsModal(plugin.app, variants, {
		onComplete: (updated: number) => {
			if (updated > 0) {
				// Refresh the Places tab
				showTab('places');
			}
		}
	});
	modal.open();
}

/**
 * Show modal to merge duplicate place notes
 */
function showMergeDuplicatePlacesModal(plugin: CanvasRootsPlugin, showTab: (tabId: string) => void): void {
	// Find duplicate place notes
	const duplicateGroups = findDuplicatePlaceNotes(plugin.app, {
		settings: plugin.settings,
		folderFilter: plugin.getFolderFilter()
	});

	if (duplicateGroups.length === 0) {
		new Notice('No duplicate place notes found. Your places are unique!');
		return;
	}

	const modal = new MergeDuplicatePlacesModal(plugin.app, duplicateGroups, {
		onComplete: (merged: number, deleted: number) => {
			if (merged > 0 || deleted > 0) {
				// Refresh the Places tab
				showTab('places');
			}
		}
	});
	modal.open();
}

/**
 * Preview normalize place names operation
 */
function showNormalizePlaceNamesPreview(plugin: CanvasRootsPlugin, showTab: (tabId: string) => void): void {
	const files = plugin.app.vault.getMarkdownFiles();
	const changes: Array<{ place: string; oldName: string; newName: string; file: TFile }> = [];

	// Normalization function (same logic as person names but for places)
	const normalizePlaceName = (name: string): string | null => {
		if (!name || typeof name !== 'string') return null;

		const cleaned = name.trim().replace(/\s+/g, ' ');
		if (!cleaned) return null;

		// Helper function to normalize a single word/segment
		const normalizeWord = (word: string, isFirstWord: boolean): string => {
			if (!word) return word;

			const lowerWord = word.toLowerCase();

			// Preserve initials (A., B., A.B., H.G., etc.)
			if (/^([a-z]\.)+$/i.test(word)) {
				return word.toUpperCase();
			}

			// Preserve Roman numerals (I, II, III, IV, V, VI, VII, VIII, IX, X, etc.)
			if (/^[ivx]+$/i.test(word)) {
				return word.toUpperCase();
			}

			// Common place name prefixes that should stay lowercase (unless at start)
			const lowercasePrefixes = ['van', 'von', 'de', 'del', 'della', 'di', 'da', 'le', 'la', 'den', 'der', 'ten', 'ter', 'du'];
			if (!isFirstWord && lowercasePrefixes.includes(lowerWord)) {
				return lowerWord;
			}

			// Handle hyphenated names (Abdul-Aziz, Saint-Pierre, etc.)
			if (word.includes('-')) {
				return word.split('-')
					.map(part => normalizeWord(part, false))
					.join('-');
			}

			// Standard title case
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		};

		const words = cleaned.split(' ');
		const normalized = words.map((word, index) => {
			// Handle parentheses
			if (word.startsWith('(') && word.endsWith(')')) {
				const inner = word.slice(1, -1);
				return '(' + normalizeWord(inner, false) + ')';
			}

			if (word.startsWith('(')) {
				const inner = word.slice(1);
				return '(' + normalizeWord(inner, index === 0);
			}

			if (word.endsWith(')')) {
				const inner = word.slice(0, -1);
				return normalizeWord(inner, false) + ')';
			}

			return normalizeWord(word, index === 0);
		});

		const result = normalized.join(' ');
		return result !== cleaned ? result : null;
	};

	// Check each place note
	for (const file of files) {
		const cache = plugin.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) continue;

		const fm = cache.frontmatter as Record<string, unknown>;

		// Check if it has place_type (indicates it's a place note)
		if (!fm.place_type && !fm.category) continue;

		if (fm.name && typeof fm.name === 'string') {
			const normalized = normalizePlaceName(fm.name);
			if (normalized) {
				changes.push({
					place: fm.name,
					oldName: fm.name,
					newName: normalized,
					file
				});
			}
		}
	}

	if (changes.length === 0) {
		new Notice('No place names need normalization');
		return;
	}

	// Show preview modal
	const modal = new Modal(plugin.app);
	modal.modalEl.addClass('crc-batch-preview-modal');
	modal.titleEl.setText('Preview: Normalize place name formatting');

	const { contentEl } = modal;

	// Description
	const description = contentEl.createDiv({ cls: 'crc-batch-description' });
	description.createEl('p', {
		text: `Found ${changes.length} place name${changes.length === 1 ? '' : 's'} that will be normalized.`
	});

	// Table
	const tableContainer = contentEl.createDiv({ cls: 'crc-table-container' });
	const table = tableContainer.createEl('table', { cls: 'crc-batch-table' });

	const thead = table.createEl('thead');
	const headerRow = thead.createEl('tr');
	headerRow.createEl('th', { text: 'Old Name' });
	headerRow.createEl('th', { text: 'New Name' });

	const tbody = table.createEl('tbody');
	for (const change of changes.slice(0, 100)) { // Limit display to 100 rows
		const row = tbody.createEl('tr');
		row.createEl('td', { text: change.oldName });
		row.createEl('td', { text: change.newName, cls: 'crc-text--success' });
	}

	if (changes.length > 100) {
		const row = tbody.createEl('tr');
		const cell = row.createEl('td', {
			text: `... and ${changes.length - 100} more`,
			cls: 'crc-text--muted'
		});
		cell.colSpan = 2;
	}

	// Backup warning
	const warning = contentEl.createDiv({ cls: 'crc-warning-callout' });
	const warningIcon = createLucideIcon('alert-triangle', 16);
	warning.appendChild(warningIcon);
	warning.createSpan({
		text: ' Backup your vault before proceeding. This operation will modify existing notes.'
	});

	// Buttons
	const buttonContainer = contentEl.createDiv({ cls: 'crc-confirmation-buttons' });

	const cancelButton = buttonContainer.createEl('button', {
		text: 'Cancel',
		cls: 'crc-btn-secondary'
	});
	cancelButton.addEventListener('click', () => modal.close());

	const applyButton = buttonContainer.createEl('button', {
		text: `Apply ${changes.length} change${changes.length === 1 ? '' : 's'}`,
		cls: 'mod-cta'
	});
	applyButton.addEventListener('click', () => {
		modal.close();
		showNormalizePlaceNamesApply(plugin, showTab);
	});

	modal.open();
}

/**
 * Apply normalize place names operation
 */
function showNormalizePlaceNamesApply(plugin: CanvasRootsPlugin, showTab: (tabId: string) => void): void {
	const files = plugin.app.vault.getMarkdownFiles();
	let modified = 0;
	const errors: Array<{ file: string; error: string }> = [];

	new Notice('Normalizing place names...');

	// Normalization function (same as preview)
	const normalizePlaceName = (name: string): string | null => {
		if (!name || typeof name !== 'string') return null;

		const cleaned = name.trim().replace(/\s+/g, ' ');
		if (!cleaned) return null;

		const words = cleaned.split(' ');
		const normalized = words.map(word => {
			if (!word) return word;

			const lowerWord = word.toLowerCase();

			// Preserve initials (single letter followed by period, like "A.", "B.", etc.)
			if (/^[a-z]\.$/i.test(word)) {
				return word.toUpperCase();
			}

			// Preserve Roman numerals (I, II, III, IV, V, VI, VII, VIII, IX, X, etc.)
			if (/^[ivx]+$/i.test(word)) {
				return word.toUpperCase();
			}

			// Common place name prefixes that should stay lowercase (unless at start)
			const lowercasePrefixes = ['van', 'von', 'de', 'del', 'della', 'di', 'da', 'le', 'la', 'den', 'der', 'ten', 'ter', 'du'];

			const wordIndex = words.indexOf(word);
			if (wordIndex > 0 && lowercasePrefixes.includes(lowerWord)) {
				return lowerWord;
			}

			// Standard title case
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		});

		const result = normalized.join(' ');
		return result !== cleaned ? result : null;
	};

	// Process each file asynchronously
	void (async () => {
		for (const file of files) {
			try {
				const cache = plugin.app.metadataCache.getFileCache(file);
				if (!cache?.frontmatter) continue;

				const fm = cache.frontmatter as Record<string, unknown>;

				// Check if it has place_type (indicates it's a place note)
				if (!fm.place_type && !fm.category) continue;

				if (fm.name && typeof fm.name === 'string') {
					const normalized = normalizePlaceName(fm.name);
					if (normalized) {
						await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
							frontmatter.name = normalized;
						});
						modified++;
					}
				}
			} catch (error) {
				errors.push({
					file: file.path,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}

		if (modified > 0) {
			new Notice(`✓ Normalized ${modified} place name${modified === 1 ? '' : 's'}`);
		} else {
			new Notice('No place names needed normalization');
		}

		if (errors.length > 0) {
			new Notice(`⚠ ${errors.length} errors occurred. Check console for details.`);
			console.error('Normalize place names errors:', errors);
		}

		// Refresh the Places tab
		showTab('places');
	})();
}
