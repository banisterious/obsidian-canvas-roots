/**
 * Places Tab UI Component
 *
 * Renders the Places tab in the Control Center, showing
 * place statistics, lists, references, and data quality issues.
 */

import { setIcon, Setting, TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../main';
import type { LucideIconName } from './lucide-icons';
import { createLucideIcon, setLucideIcon } from './lucide-icons';
import { PlaceGraphService } from '../core/place-graph';
import type { PlaceCategory, PlaceIssue } from '../models/place';
import { CreatePlaceModal } from './create-place-modal';
import { CreateMissingPlacesModal } from './create-missing-places-modal';
import { BuildPlaceHierarchyModal } from './build-place-hierarchy-modal';
import { StandardizePlacesModal, findPlaceNameVariations } from './standardize-places-modal';
import { TemplateSnippetsModal } from './template-snippets-modal';
import { renderPlaceTypeManagerCard } from '../places/ui/place-type-manager-card';

/**
 * Render the Places tab content
 */
export function renderPlacesTab(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	// Actions Card
	renderActionsCard(container, plugin, createCard, showTab);

	// Overview Card
	const overviewCard = createCard({
		title: 'Place statistics',
		icon: 'map-pin',
		subtitle: 'Geographic data overview'
	});

	const overviewContent = overviewCard.querySelector('.crc-card__content') as HTMLElement;
	overviewContent.createEl('p', {
		text: 'Loading statistics...',
		cls: 'crc-text--muted'
	});

	container.appendChild(overviewCard);

	// Load statistics asynchronously
	loadPlaceStatistics(overviewContent, plugin);

	// Place List Card
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

	// Referenced Places Card (places mentioned in person notes)
	const referencedCard = createCard({
		title: 'Referenced places',
		icon: 'link',
		subtitle: 'Places mentioned in person notes'
	});

	const referencedContent = referencedCard.querySelector('.crc-card__content') as HTMLElement;
	referencedContent.createEl('p', {
		text: 'Loading references...',
		cls: 'crc-text--muted'
	});

	container.appendChild(referencedCard);

	// Load referenced places asynchronously
	loadReferencedPlaces(referencedContent, plugin, showTab);

	// Issues Card
	const issuesCard = createCard({
		title: 'Data quality issues',
		icon: 'alert-triangle',
		subtitle: 'Place-related issues requiring attention'
	});

	const issuesContent = issuesCard.querySelector('.crc-card__content') as HTMLElement;
	issuesContent.createEl('p', {
		text: 'Loading issues...',
		cls: 'crc-text--muted'
	});

	container.appendChild(issuesCard);

	// Load issues asynchronously
	loadPlaceIssues(issuesContent, plugin);

	// Place Type Manager card
	renderPlaceTypeManagerCard(container, plugin, createCard, () => {
		showTab('places');
	});
}

/**
 * Render the Actions card
 */
function renderActionsCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName; subtitle?: string }) => HTMLElement,
	showTab: (tabId: string) => void
): void {
	const actionsCard = createCard({
		title: 'Actions',
		icon: 'plus',
		subtitle: 'Create and manage place notes'
	});

	const actionsContent = actionsCard.querySelector('.crc-card__content') as HTMLElement;

	new Setting(actionsContent)
		.setName('Create new place note')
		.setDesc('Create a new place note with geographic information')
		.addButton(button => button
			.setButtonText('Create place')
			.setCta()
			.onClick(() => {
				new CreatePlaceModal(plugin.app, {
					directory: plugin.settings.placesFolder || '',
					familyGraph: plugin.createFamilyGraphService(),
					placeGraph: new PlaceGraphService(plugin.app),
					settings: plugin.settings,
					onCreated: () => {
						// Refresh the Places tab
						showTab('places');
					}
				}).open();
			}));

	new Setting(actionsContent)
		.setName('Create missing place notes')
		.setDesc('Generate place notes for locations referenced in person notes')
		.addButton(button => button
			.setButtonText('Find missing')
			.onClick(() => {
				showCreateMissingPlacesModal(plugin, showTab);
			}));

	new Setting(actionsContent)
		.setName('Build place hierarchy')
		.setDesc('Assign parent places to orphan locations')
		.addButton(button => button
			.setButtonText('Build hierarchy')
			.onClick(() => {
				showBuildHierarchyModal(plugin, showTab);
			}));

	new Setting(actionsContent)
		.setName('Standardize place names')
		.setDesc('Find and unify variations of place names')
		.addButton(button => button
			.setButtonText('Find variations')
			.onClick(() => {
				showStandardizePlacesModal(plugin, showTab);
			}));

	new Setting(actionsContent)
		.setName('Templater templates')
		.setDesc('Copy ready-to-use templates for Templater integration')
		.addButton(button => button
			.setButtonText('View templates')
			.onClick(() => {
				new TemplateSnippetsModal(plugin.app).open();
			}));

	container.appendChild(actionsCard);
}

/**
 * Load place statistics into container
 */
function loadPlaceStatistics(container: HTMLElement, plugin: CanvasRootsPlugin): void {
	container.empty();

	const placeService = new PlaceGraphService(plugin.app);
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
			text: 'Place notes use type: place in their frontmatter. Create place notes to track geographic locations associated with your family tree.',
			cls: 'crc-text--muted crc-text--small'
		});
		return;
	}

	// Overview statistics grid
	const statsGrid = container.createDiv({ cls: 'crc-stats-grid' });

	// Total places
	createStatItem(statsGrid, 'Total places', stats.totalPlaces.toString(), 'map-pin');

	// With coordinates
	const coordPercent = stats.totalPlaces > 0
		? Math.round((stats.withCoordinates / stats.totalPlaces) * 100)
		: 0;
	createStatItem(statsGrid, 'With coordinates', `${stats.withCoordinates} (${coordPercent}%)`, 'globe');

	// Hierarchy depth
	createStatItem(statsGrid, 'Max hierarchy depth', stats.maxHierarchyDepth.toString(), 'layers');

	// Orphan places
	createStatItem(statsGrid, 'Orphan places', stats.orphanPlaces.toString(), 'alert-circle');

	// By Category breakdown
	const categorySection = container.createDiv({ cls: 'crc-mt-4' });
	categorySection.createEl('h4', { text: 'By category', cls: 'crc-section-title' });

	const categoryGrid = categorySection.createDiv({ cls: 'crc-stats-grid crc-stats-grid--compact' });

	const categories: PlaceCategory[] = ['real', 'historical', 'disputed', 'legendary', 'mythological', 'fictional'];
	for (const category of categories) {
		const count = stats.byCategory[category];
		if (count > 0) {
			createStatItem(categoryGrid, formatPlaceCategoryName(category), count.toString());
		}
	}

	// Universes (if any fictional/mythological places)
	const universeCount = Object.keys(stats.byUniverse).length;
	if (universeCount > 0) {
		const universeSection = container.createDiv({ cls: 'crc-mt-4' });
		universeSection.createEl('h4', { text: 'By universe', cls: 'crc-section-title' });

		const universeList = universeSection.createEl('ul', { cls: 'crc-list' });
		for (const [universe, count] of Object.entries(stats.byUniverse).sort((a, b) => b[1] - a[1])) {
			const item = universeList.createEl('li');
			item.createEl('span', { text: universe });
			item.createEl('span', { text: ` (${count})`, cls: 'crc-text--muted' });
		}
	}

	// Collections (user-defined groupings)
	const collectionCount = Object.keys(stats.byCollection).length;
	if (collectionCount > 0) {
		const collectionSection = container.createDiv({ cls: 'crc-mt-4' });
		collectionSection.createEl('h4', { text: 'By collection', cls: 'crc-section-title' });

		const collectionList = collectionSection.createEl('ul', { cls: 'crc-list' });
		for (const [collection, count] of Object.entries(stats.byCollection).sort((a, b) => b[1] - a[1])) {
			const item = collectionList.createEl('li');
			item.createEl('span', { text: collection });
			item.createEl('span', { text: ` (${count})`, cls: 'crc-text--muted' });
		}
	}

	// Top birth places
	if (stats.topBirthPlaces.length > 0) {
		const birthSection = container.createDiv({ cls: 'crc-mt-4' });
		birthSection.createEl('h4', { text: 'Most common birth places', cls: 'crc-section-title' });

		const birthList = birthSection.createEl('ol', { cls: 'crc-list crc-list--numbered' });
		for (const place of stats.topBirthPlaces.slice(0, 5)) {
			const item = birthList.createEl('li');
			item.createEl('span', { text: place.place });
			item.createEl('span', { text: ` (${place.count})`, cls: 'crc-text--muted' });
		}
	}

	// Top death places
	if (stats.topDeathPlaces.length > 0) {
		const deathSection = container.createDiv({ cls: 'crc-mt-4' });
		deathSection.createEl('h4', { text: 'Most common death places', cls: 'crc-section-title' });

		const deathList = deathSection.createEl('ol', { cls: 'crc-list crc-list--numbered' });
		for (const place of stats.topDeathPlaces.slice(0, 5)) {
			const item = deathList.createEl('li');
			item.createEl('span', { text: place.place });
			item.createEl('span', { text: ` (${place.count})`, cls: 'crc-text--muted' });
		}
	}

	// Migration patterns
	if (stats.migrationPatterns.length > 0) {
		const migrationSection = container.createDiv({ cls: 'crc-mt-4' });
		migrationSection.createEl('h4', { text: 'Migration patterns (birth → death)', cls: 'crc-section-title' });

		const migrationList = migrationSection.createEl('ul', { cls: 'crc-list' });
		for (const pattern of stats.migrationPatterns.slice(0, 5)) {
			const item = migrationList.createEl('li');
			item.createEl('span', { text: `${pattern.from} → ${pattern.to}` });
			item.createEl('span', { text: ` (${pattern.count})`, cls: 'crc-text--muted' });
		}
	}
}

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
	placeService.setValueAliases(plugin.settings.valueAliases);
	placeService.reloadCache();

	const places = placeService.getAllPlaces();

	if (places.length === 0) {
		container.createEl('p', {
			text: 'No place notes found. Create place notes with type: place in frontmatter.',
			cls: 'crc-text--muted'
		});
		return;
	}

	// Sort by name
	places.sort((a, b) => a.name.localeCompare(b.name));

	// Group by category
	const byCategory = new Map<PlaceCategory, typeof places>();
	for (const place of places) {
		if (!byCategory.has(place.category)) {
			byCategory.set(place.category, []);
		}
		byCategory.get(place.category)!.push(place);
	}

	// Display categories in order
	const categories: PlaceCategory[] = ['real', 'historical', 'disputed', 'legendary', 'mythological', 'fictional'];

	for (const category of categories) {
		const categoryPlaces = byCategory.get(category);
		if (!categoryPlaces || categoryPlaces.length === 0) continue;

		const categorySection = container.createDiv({ cls: 'crc-place-category' });

		const categoryHeader = categorySection.createDiv({ cls: 'crc-collection-header' });
		categoryHeader.createEl('strong', { text: `${formatPlaceCategoryName(category)} ` });
		categoryHeader.createEl('span', {
			cls: 'crc-badge',
			text: categoryPlaces.length.toString()
		});

		const placeList = categorySection.createEl('ul', { cls: 'crc-list crc-mt-2' });

		for (const place of categoryPlaces.slice(0, 10)) {
			const item = placeList.createEl('li', { cls: 'crc-place-item' });

			// Place name as link
			const link = item.createEl('a', {
				text: place.name,
				cls: 'crc-link'
			});
			link.addEventListener('click', (e) => {
				e.preventDefault();
				const file = plugin.app.vault.getAbstractFileByPath(place.filePath);
				if (file instanceof TFile) {
					void plugin.app.workspace.getLeaf(false).openFile(file);
				}
			});

			// Edit button
			const editBtn = item.createEl('button', {
				cls: 'crc-place-edit-btn clickable-icon',
				attr: { 'aria-label': 'Edit place' }
			});
			const editIcon = createLucideIcon('edit', 14);
			editBtn.appendChild(editIcon);
			editBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				const file = plugin.app.vault.getAbstractFileByPath(place.filePath);
				if (file instanceof TFile) {
					new CreatePlaceModal(plugin.app, {
						editPlace: place,
						editFile: file,
						placeGraph: placeService,
						settings: plugin.settings,
						onUpdated: () => {
							// Refresh the place list after edit
							loadPlaceList(container, plugin, showTab);
						}
					}).open();
				}
			});

			// Person count
			const peopleAtPlace = placeService.getPeopleAtPlace(place.id);
			if (peopleAtPlace.length > 0) {
				item.createEl('span', {
					text: ` (${peopleAtPlace.length} ${peopleAtPlace.length === 1 ? 'person' : 'people'})`,
					cls: 'crc-text--muted'
				});
			}

			// Place type badge
			if (place.placeType) {
				item.createEl('span', {
					text: place.placeType,
					cls: 'crc-badge crc-badge--small crc-ml-2'
				});
			}

			// Universe badge for fictional places
			if (place.universe) {
				item.createEl('span', {
					text: place.universe,
					cls: 'crc-badge crc-badge--accent crc-badge--small crc-ml-1'
				});
			}
		}

		// Show "more" indicator if truncated
		if (categoryPlaces.length > 10) {
			categorySection.createEl('p', {
				text: `+${categoryPlaces.length - 10} more...`,
				cls: 'crc-text--muted crc-text--small'
			});
		}
	}
}

/**
 * Load referenced places into container
 */
function loadReferencedPlaces(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	showTab: (tabId: string) => void
): void {
	container.empty();

	const placeService = new PlaceGraphService(plugin.app);
	placeService.setValueAliases(plugin.settings.valueAliases);
	placeService.reloadCache();

	const references = placeService.getReferencedPlaces();

	if (references.size === 0) {
		container.createEl('p', {
			text: 'No place references found in person notes.',
			cls: 'crc-text--muted'
		});
		return;
	}

	// Separate linked vs unlinked
	const linked: Array<{ name: string; count: number }> = [];
	const unlinked: Array<{ name: string; count: number }> = [];

	for (const [name, info] of references.entries()) {
		if (info.linked) {
			linked.push({ name, count: info.count });
		} else {
			unlinked.push({ name, count: info.count });
		}
	}

	// State for filtering and sorting
	let filterText = '';
	let sortBy: 'count' | 'name' = 'count';
	let showLinked = true;
	let showUnlinked = true;

	// Summary
	const summary = container.createDiv({ cls: 'crc-stats-summary crc-mb-3' });
	summary.createEl('span', { text: `${linked.length} linked`, cls: 'crc-text--success' });
	summary.createEl('span', { text: ' • ', cls: 'crc-text--muted' });
	summary.createEl('span', { text: `${unlinked.length} unlinked`, cls: unlinked.length > 0 ? 'crc-text--warning' : 'crc-text--muted' });

	// Controls row
	const controlsRow = container.createDiv({ cls: 'crc-referenced-controls crc-mb-3' });

	// Filter input
	const filterContainer = controlsRow.createDiv({ cls: 'crc-filter-container' });
	const filterInput = filterContainer.createEl('input', {
		type: 'text',
		placeholder: 'Filter places...',
		cls: 'crc-filter-input'
	});

	// Sort dropdown
	const sortContainer = controlsRow.createDiv({ cls: 'crc-sort-container' });
	sortContainer.createEl('span', { text: 'Sort: ', cls: 'crc-text--muted crc-text--small' });
	const sortSelect = sortContainer.createEl('select', { cls: 'crc-sort-select dropdown' });
	sortSelect.createEl('option', { value: 'count', text: 'By count' });
	sortSelect.createEl('option', { value: 'name', text: 'By name' });

	// Filter checkboxes
	const filterToggles = controlsRow.createDiv({ cls: 'crc-filter-toggles' });

	const linkedToggle = filterToggles.createEl('label', { cls: 'crc-filter-toggle' });
	const linkedCheckbox = linkedToggle.createEl('input', { type: 'checkbox' });
	linkedCheckbox.checked = true;
	linkedToggle.createEl('span', { text: 'Linked', cls: 'crc-text--small' });

	const unlinkedToggle = filterToggles.createEl('label', { cls: 'crc-filter-toggle' });
	const unlinkedCheckbox = unlinkedToggle.createEl('input', { type: 'checkbox' });
	unlinkedCheckbox.checked = true;
	unlinkedToggle.createEl('span', { text: 'Unlinked', cls: 'crc-text--small' });

	// List container
	const listContainer = container.createDiv({ cls: 'crc-referenced-list' });

	// Render function
	const renderList = () => {
		listContainer.empty();

		// Apply sorting
		const sortFn = sortBy === 'count'
			? (a: { name: string; count: number }, b: { name: string; count: number }) => b.count - a.count
			: (a: { name: string; count: number }, b: { name: string; count: number }) => a.name.localeCompare(b.name);

		// Filter and combine lists
		const allPlaces: Array<{ name: string; count: number; linked: boolean }> = [];

		if (showUnlinked) {
			for (const p of unlinked) {
				if (!filterText || p.name.toLowerCase().includes(filterText.toLowerCase())) {
					allPlaces.push({ ...p, linked: false });
				}
			}
		}

		if (showLinked) {
			for (const p of linked) {
				if (!filterText || p.name.toLowerCase().includes(filterText.toLowerCase())) {
					allPlaces.push({ ...p, linked: true });
				}
			}
		}

		// Sort
		allPlaces.sort((a, b) => {
			// Unlinked first when sorting by count
			if (sortBy === 'count' && a.linked !== b.linked) {
				return a.linked ? 1 : -1;
			}
			return sortFn(a, b);
		});

		if (allPlaces.length === 0) {
			listContainer.createEl('p', {
				text: filterText ? 'No places match the filter.' : 'No places to show.',
				cls: 'crc-text--muted'
			});
			return;
		}

		// Render list
		const list = listContainer.createEl('ul', { cls: 'crc-list crc-referenced-places-list' });

		for (const place of allPlaces) {
			const item = list.createEl('li', {
				cls: `crc-referenced-place-item ${place.linked ? 'crc-referenced-place-item--linked' : 'crc-referenced-place-item--unlinked'}`
			});

			const content = item.createDiv({ cls: 'crc-referenced-place-content' });

			// Status indicator
			const statusIcon = content.createSpan({ cls: 'crc-referenced-place-status' });
			if (place.linked) {
				setLucideIcon(statusIcon, 'check', 14);
				statusIcon.addClass('crc-text--success');
			} else {
				setLucideIcon(statusIcon, 'alert-circle', 14);
				statusIcon.addClass('crc-text--warning');
			}

			// Name and count
			content.createEl('span', { text: place.name, cls: 'crc-referenced-place-name' });
			content.createEl('span', { text: ` (${place.count})`, cls: 'crc-text--muted' });

			// Quick-create button for unlinked
			if (!place.linked) {
				const createBtn = item.createEl('button', {
					cls: 'crc-btn crc-btn--small crc-btn--ghost',
					text: 'Create'
				});
				createBtn.addEventListener('click', () => {
					showQuickCreatePlaceModal(plugin, place.name, showTab);
				});
			}
		}

		// Show count
		const countText = listContainer.createEl('p', {
			cls: 'crc-text--muted crc-text--small crc-mt-2'
		});
		countText.textContent = `Showing ${allPlaces.length} of ${linked.length + unlinked.length} places`;
	};

	// Event handlers
	filterInput.addEventListener('input', () => {
		filterText = filterInput.value;
		renderList();
	});

	sortSelect.addEventListener('change', () => {
		sortBy = sortSelect.value as 'count' | 'name';
		renderList();
	});

	linkedCheckbox.addEventListener('change', () => {
		showLinked = linkedCheckbox.checked;
		renderList();
	});

	unlinkedCheckbox.addEventListener('change', () => {
		showUnlinked = unlinkedCheckbox.checked;
		renderList();
	});

	// Initial render
	renderList();
}

/**
 * Load place issues into container
 */
function loadPlaceIssues(container: HTMLElement, plugin: CanvasRootsPlugin): void {
	container.empty();

	const placeService = new PlaceGraphService(plugin.app);
	placeService.setValueAliases(plugin.settings.valueAliases);
	placeService.reloadCache();

	const stats = placeService.calculateStatistics();
	const issues = stats.issues;

	if (issues.length === 0) {
		container.createEl('p', {
			text: 'No issues found.',
			cls: 'crc-text--success'
		});
		return;
	}

	// Group by issue type
	const byType = new Map<string, PlaceIssue[]>();
	for (const issue of issues) {
		if (!byType.has(issue.type)) {
			byType.set(issue.type, []);
		}
		byType.get(issue.type)!.push(issue);
	}

	// Display issue groups
	for (const [type, typeIssues] of byType.entries()) {
		const issueSection = container.createDiv({ cls: 'crc-issue-group crc-mb-3' });

		const header = issueSection.createDiv({ cls: 'crc-collection-header' });
		header.createEl('strong', { text: `${formatIssueType(type)} ` });
		header.createEl('span', {
			cls: 'crc-badge crc-badge--warning',
			text: typeIssues.length.toString()
		});

		const issueList = issueSection.createEl('ul', { cls: 'crc-list crc-list--compact' });
		for (const issue of typeIssues.slice(0, 5)) {
			const item = issueList.createEl('li', { cls: 'crc-text--small' });
			item.textContent = issue.message;
		}

		if (typeIssues.length > 5) {
			issueSection.createEl('p', {
				text: `+${typeIssues.length - 5} more...`,
				cls: 'crc-text--muted crc-text--small'
			});
		}
	}
}

/**
 * Create a stat item for the statistics grid
 */
function createStatItem(container: HTMLElement, label: string, value: string, icon?: LucideIconName): void {
	const item = container.createDiv({ cls: 'crc-stat-item' });

	if (icon) {
		const iconEl = createLucideIcon(icon, 16);
		iconEl.addClass('crc-stat-icon');
		item.appendChild(iconEl);
	}

	const content = item.createDiv({ cls: 'crc-stat-content' });
	content.createEl('div', { text: value, cls: 'crc-stat-value' });
	content.createEl('div', { text: label, cls: 'crc-stat-label' });
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
 * Format issue type for display
 */
function formatIssueType(type: string): string {
	const names: Record<string, string> = {
		orphan_place: 'Orphan places',
		missing_place_note: 'Missing place notes',
		circular_hierarchy: 'Circular hierarchies',
		duplicate_name: 'Duplicate names',
		fictional_with_coords: 'Fictional places with coordinates',
		real_missing_coords: 'Real places missing coordinates',
		invalid_category: 'Invalid categories'
	};
	return names[type] || type;
}

/**
 * Show modal to create missing place notes
 */
function showCreateMissingPlacesModal(plugin: CanvasRootsPlugin, showTab: (tabId: string) => void): void {
	const placeService = new PlaceGraphService(plugin.app);
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
		// Use Obsidian Notice
		const { Notice } = require('obsidian');
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
	const { Notice } = require('obsidian');
	const modal = new CreatePlaceModal(plugin.app, {
		directory: plugin.settings.placesFolder || '',
		initialName: placeName,
		familyGraph: plugin.createFamilyGraphService(),
		placeGraph: new PlaceGraphService(plugin.app),
		settings: plugin.settings,
		onCreated: () => {
			new Notice(`Created place note: ${placeName}`);
			// Refresh the Places tab
			showTab('places');
		}
	});
	modal.open();
}

/**
 * Show modal to build place hierarchy (assign parents to orphan places)
 */
function showBuildHierarchyModal(plugin: CanvasRootsPlugin, showTab: (tabId: string) => void): void {
	const { Notice } = require('obsidian');
	const placeService = new PlaceGraphService(plugin.app);
	placeService.setValueAliases(plugin.settings.valueAliases);
	placeService.reloadCache();

	const allPlaces = placeService.getAllPlaces();

	// Find orphan places (no parent and not top-level types)
	const orphanPlaces = allPlaces.filter(place =>
		!place.parentId &&
		place.placeType &&
		!['continent', 'country'].includes(place.placeType)
	);

	if (orphanPlaces.length === 0) {
		new Notice('No orphan places found! All places have parent assignments or are top-level.');
		return;
	}

	// Get potential parent places (higher-level places)
	const potentialParents = allPlaces.filter(place =>
		place.placeType && ['continent', 'country', 'state', 'province', 'region', 'county'].includes(place.placeType)
	);

	// Create hierarchy wizard modal
	const modal = new BuildPlaceHierarchyModal(plugin.app, orphanPlaces, potentialParents, {
		onComplete: (updated: number) => {
			new Notice(`Updated ${updated} place${updated !== 1 ? 's' : ''} with parent assignments`);
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
	const { Notice } = require('obsidian');
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
