/**
 * Modal for standardizing common place name variants
 * Handles cases like "USA" vs "United States of America", state abbreviations, etc.
 */

import { App, Modal, Notice, TFile } from 'obsidian';
import { createLucideIcon, setLucideIcon } from './lucide-icons';
import { PlaceGraphService } from '../core/place-graph';

/**
 * Common place name variants - maps variant forms to canonical form
 * The key is the canonical form, values are alternate forms that should be standardized
 */
export const PLACE_NAME_VARIANTS: Record<string, string[]> = {
	// Countries
	'USA': ['United States', 'United States of America', 'U.S.A.', 'U.S.', 'US', 'America'],
	'UK': ['United Kingdom', 'Great Britain', 'Britain', 'U.K.'],
	'England': ['Eng.', 'Eng'],
	'Scotland': ['Scot.', 'Scot'],
	'Ireland': ['Eire', 'Éire'],
	'Germany': ['Deutschland', 'Ger.', 'Ger'],
	'France': ['Fra.', 'Fra'],

	// US State abbreviations to full names
	'Alabama': ['AL', 'Ala.', 'Ala'],
	'Alaska': ['AK'],
	'Arizona': ['AZ', 'Ariz.', 'Ariz'],
	'Arkansas': ['AR', 'Ark.', 'Ark'],
	'California': ['CA', 'Calif.', 'Calif', 'Cal.', 'Cal'],
	'Colorado': ['CO', 'Colo.', 'Colo'],
	'Connecticut': ['CT', 'Conn.', 'Conn'],
	'Delaware': ['DE', 'Del.', 'Del'],
	'Florida': ['FL', 'Fla.', 'Fla'],
	'Georgia': ['GA'],
	'Hawaii': ['HI'],
	'Idaho': ['ID'],
	'Illinois': ['IL', 'Ill.', 'Ill'],
	'Indiana': ['IN', 'Ind.', 'Ind'],
	'Iowa': ['IA'],
	'Kansas': ['KS', 'Kans.', 'Kans', 'Kan.', 'Kan'],
	'Kentucky': ['KY', 'Ky.', 'Ky'],
	'Louisiana': ['LA'],
	'Maine': ['ME'],
	'Maryland': ['MD', 'Md.', 'Md'],
	'Massachusetts': ['MA', 'Mass.', 'Mass'],
	'Michigan': ['MI', 'Mich.', 'Mich'],
	'Minnesota': ['MN', 'Minn.', 'Minn'],
	'Mississippi': ['MS', 'Miss.', 'Miss'],
	'Missouri': ['MO'],
	'Montana': ['MT', 'Mont.', 'Mont'],
	'Nebraska': ['NE', 'Nebr.', 'Nebr', 'Neb.', 'Neb'],
	'Nevada': ['NV', 'Nev.', 'Nev'],
	'New Hampshire': ['NH', 'N.H.'],
	'New Jersey': ['NJ', 'N.J.'],
	'New Mexico': ['NM', 'N.M.', 'N. Mex.', 'N Mex'],
	'New York': ['NY', 'N.Y.'],
	'North Carolina': ['NC', 'N.C.', 'N. Carolina'],
	'North Dakota': ['ND', 'N.D.', 'N. Dakota', 'N Dak'],
	'Ohio': ['OH'],
	'Oklahoma': ['OK', 'Okla.', 'Okla'],
	'Oregon': ['OR', 'Ore.', 'Ore', 'Oreg.', 'Oreg'],
	'Pennsylvania': ['PA', 'Penn.', 'Penn', 'Penna.', 'Penna'],
	'Rhode Island': ['RI', 'R.I.'],
	'South Carolina': ['SC', 'S.C.', 'S. Carolina'],
	'South Dakota': ['SD', 'S.D.', 'S. Dakota', 'S Dak'],
	'Tennessee': ['TN', 'Tenn.', 'Tenn'],
	'Texas': ['TX', 'Tex.', 'Tex'],
	'Utah': ['UT'],
	'Vermont': ['VT'],
	'Virginia': ['VA'],
	'Washington': ['WA', 'Wash.', 'Wash'],
	'West Virginia': ['WV', 'W.V.', 'W. Virginia', 'W Va'],
	'Wisconsin': ['WI', 'Wis.', 'Wis', 'Wisc.', 'Wisc'],
	'Wyoming': ['WY', 'Wyo.', 'Wyo'],
	'District of Columbia': ['DC', 'D.C.'],

	// Canadian provinces
	'Ontario': ['ON', 'Ont.', 'Ont'],
	'Quebec': ['QC', 'Que.', 'Que', 'Québec'],
	'British Columbia': ['BC', 'B.C.'],
	'Alberta': ['AB', 'Alta.', 'Alta'],
	'Manitoba': ['MB', 'Man.', 'Man'],
	'Saskatchewan': ['SK', 'Sask.', 'Sask'],
	'Nova Scotia': ['NS', 'N.S.'],
	'New Brunswick': ['NB', 'N.B.'],
	'Newfoundland and Labrador': ['NL', 'Nfld.', 'Nfld', 'Newfoundland'],
	'Prince Edward Island': ['PE', 'P.E.I.', 'PEI'],

	// Common place name words
	'Saint': ['St.', 'St'],
	'Mount': ['Mt.', 'Mt'],
	'Fort': ['Ft.', 'Ft'],
	'County': ['Co.', 'Co'],
};

/**
 * Build a reverse lookup map from variant to canonical
 */
function buildVariantLookup(): Map<string, string> {
	const lookup = new Map<string, string>();
	for (const [canonical, variants] of Object.entries(PLACE_NAME_VARIANTS)) {
		for (const variant of variants) {
			lookup.set(variant.toLowerCase(), canonical);
		}
	}
	return lookup;
}

const VARIANT_LOOKUP = buildVariantLookup();

/**
 * A group of place references that use the same variant
 */
export interface PlaceVariantMatch {
	/** The variant form found (e.g., "United States of America") */
	variant: string;
	/** The canonical form to standardize to (e.g., "USA") */
	canonical: string;
	/** Files containing this variant */
	files: TFile[];
	/** Total number of references */
	count: number;
}

interface StandardizePlaceVariantsOptions {
	onComplete?: (updated: number) => void;
}

/**
 * Modal for standardizing common place name variants
 */
export class StandardizePlaceVariantsModal extends Modal {
	private placeService: PlaceGraphService;
	private matches: PlaceVariantMatch[];
	private selectedMatches: Set<PlaceVariantMatch>;
	private canonicalOverrides: Map<PlaceVariantMatch, string>; // Allow user to pick different canonical
	private onComplete?: (updated: number) => void;

	constructor(
		app: App,
		matches: PlaceVariantMatch[],
		options: StandardizePlaceVariantsOptions = {}
	) {
		super(app);
		this.placeService = new PlaceGraphService(app);
		this.matches = matches;
		this.selectedMatches = new Set(matches); // All selected by default
		this.canonicalOverrides = new Map();
		this.onComplete = options.onComplete;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.modalEl.addClass('crc-standardize-variants-modal');
		this.modalEl.addClass('crc-batch-preview-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('globe', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Standardize place name variants');

		// Description
		const descriptionEl = contentEl.createDiv({ cls: 'crc-batch-description' });

		if (this.matches.length === 0) {
			descriptionEl.createEl('p', {
				text: 'No place name variants found. Your place names are already standardized!',
				cls: 'crc-text--success'
			});

			const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });
			const closeBtn = buttonContainer.createEl('button', {
				text: 'Close',
				cls: 'crc-btn crc-btn--primary'
			});
			closeBtn.addEventListener('click', () => this.close());
			return;
		}

		const totalRefs = this.matches.reduce((sum, m) => sum + m.count, 0);
		descriptionEl.createEl('p', {
			text: `Found ${this.matches.length} place name variant${this.matches.length !== 1 ? 's' : ''} across ${totalRefs} reference${totalRefs !== 1 ? 's' : ''}.`,
			cls: 'crc-text--muted'
		});
		descriptionEl.createEl('p', {
			text: 'Select which variants to standardize. You can also choose a different canonical form for each.',
			cls: 'crc-text--muted crc-text--small'
		});

		// Search/filter
		const filterRow = contentEl.createDiv({ cls: 'crc-batch-filter-row' });
		const searchInput = filterRow.createEl('input', {
			type: 'text',
			placeholder: 'Filter variants...',
			cls: 'crc-filter-input'
		});

		// Select all / deselect all buttons
		const selectAllBtn = filterRow.createEl('button', {
			text: 'Select all',
			cls: 'crc-btn crc-btn--small crc-btn--ghost'
		});
		const deselectAllBtn = filterRow.createEl('button', {
			text: 'Deselect all',
			cls: 'crc-btn crc-btn--small crc-btn--ghost'
		});

		// Table
		const tableContainer = contentEl.createDiv({ cls: 'crc-batch-table-container' });
		const table = tableContainer.createEl('table', { cls: 'crc-batch-preview-table' });

		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: '', cls: 'crc-th--checkbox' });
		headerRow.createEl('th', { text: 'Current value' });
		headerRow.createEl('th', { text: 'Standardize to' });
		headerRow.createEl('th', { text: 'References' });
		headerRow.createEl('th', { text: 'Actions', cls: 'crc-th--actions' });

		const tbody = table.createEl('tbody');

		// Render matches
		const renderMatches = (filter: string = '') => {
			tbody.empty();

			const filteredMatches = filter
				? this.matches.filter(m =>
					m.variant.toLowerCase().includes(filter.toLowerCase()) ||
					m.canonical.toLowerCase().includes(filter.toLowerCase())
				)
				: this.matches;

			for (const match of filteredMatches) {
				const row = tbody.createEl('tr');

				// Checkbox
				const checkCell = row.createEl('td', { cls: 'crc-batch-cell--checkbox' });
				const checkbox = checkCell.createEl('input', { type: 'checkbox' });
				checkbox.checked = this.selectedMatches.has(match);
				checkbox.addEventListener('change', () => {
					if (checkbox.checked) {
						this.selectedMatches.add(match);
					} else {
						this.selectedMatches.delete(match);
					}
					updateApplyButton();
				});

				// Current value (with strikethrough if selected)
				const currentCell = row.createEl('td');
				if (this.selectedMatches.has(match)) {
					currentCell.createEl('s', { text: match.variant, cls: 'crc-text--muted' });
				} else {
					currentCell.createEl('span', { text: match.variant });
				}

				// Canonical (editable dropdown)
				const canonicalCell = row.createEl('td');
				const canonicalSelect = canonicalCell.createEl('select', { cls: 'dropdown' });

				// Add the default canonical as first option
				const defaultOpt = canonicalSelect.createEl('option', {
					value: match.canonical,
					text: match.canonical
				});
				defaultOpt.selected = !this.canonicalOverrides.has(match);

				// Add the variant itself as an option (for keeping as-is)
				if (match.variant !== match.canonical) {
					const variantOpt = canonicalSelect.createEl('option', {
						value: match.variant,
						text: `${match.variant} (keep as-is)`
					});
					variantOpt.selected = this.canonicalOverrides.get(match) === match.variant;
				}

				// Add any other known canonicals for this type
				const relatedCanonicals = this.getRelatedCanonicals(match.canonical);
				for (const related of relatedCanonicals) {
					if (related !== match.canonical && related !== match.variant) {
						const relatedOpt = canonicalSelect.createEl('option', {
							value: related,
							text: related
						});
						relatedOpt.selected = this.canonicalOverrides.get(match) === related;
					}
				}

				canonicalSelect.addEventListener('change', () => {
					if (canonicalSelect.value === match.canonical) {
						this.canonicalOverrides.delete(match);
					} else {
						this.canonicalOverrides.set(match, canonicalSelect.value);
					}
				});

				// Count
				const countCell = row.createEl('td', { cls: 'crc-batch-cell--count' });
				countCell.textContent = match.count.toString();

				// Actions
				const actionsCell = row.createEl('td', { cls: 'crc-batch-actions crc-batch-actions--inline' });

				// Open first file in new tab
				if (match.files.length > 0) {
					const openTabBtn = actionsCell.createEl('button', {
						cls: 'crc-batch-action-btn clickable-icon',
						attr: { 'aria-label': 'Open note in new tab' }
					});
					setLucideIcon(openTabBtn, 'file-text');
					openTabBtn.addEventListener('click', () => {
						void this.app.workspace.getLeaf('tab').openFile(match.files[0]);
					});

					const openWindowBtn = actionsCell.createEl('button', {
						cls: 'crc-batch-action-btn clickable-icon',
						attr: { 'aria-label': 'Open note in new window' }
					});
					setLucideIcon(openWindowBtn, 'external-link');
					openWindowBtn.addEventListener('click', () => {
						void this.app.workspace.getLeaf('window').openFile(match.files[0]);
					});
				}
			}
		};

		// Initial render
		renderMatches();

		// Filter handler
		searchInput.addEventListener('input', () => {
			renderMatches(searchInput.value);
		});

		// Select all / deselect all handlers
		selectAllBtn.addEventListener('click', () => {
			this.selectedMatches = new Set(this.matches);
			renderMatches(searchInput.value);
			updateApplyButton();
		});

		deselectAllBtn.addEventListener('click', () => {
			this.selectedMatches.clear();
			renderMatches(searchInput.value);
			updateApplyButton();
		});

		// Warning
		const warning = contentEl.createDiv({ cls: 'crc-warning-callout' });
		const warningIcon = createLucideIcon('alert-triangle', 16);
		warning.appendChild(warningIcon);
		warning.createSpan({
			text: ' Backup your vault before proceeding. This operation will modify existing notes.'
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => this.close());

		const applyBtn = buttonContainer.createEl('button', {
			text: `Standardize ${this.selectedMatches.size} variant${this.selectedMatches.size !== 1 ? 's' : ''}`,
			cls: 'crc-btn crc-btn--primary'
		});

		const updateApplyButton = () => {
			const count = this.selectedMatches.size;
			applyBtn.textContent = `Standardize ${count} variant${count !== 1 ? 's' : ''}`;
			applyBtn.disabled = count === 0;
		};

		applyBtn.addEventListener('click', () => void this.applyStandardization());

		updateApplyButton();
	}

	/**
	 * Get related canonical forms (e.g., for countries, show other country options)
	 */
	private getRelatedCanonicals(canonical: string): string[] {
		// For now, just return an empty array - could be extended to group related canonicals
		return [];
	}

	/**
	 * Apply the standardization
	 */
	private async applyStandardization(): Promise<void> {
		let totalUpdated = 0;
		const errors: string[] = [];

		for (const match of this.selectedMatches) {
			const targetCanonical = this.canonicalOverrides.get(match) || match.canonical;

			// Skip if keeping as-is
			if (targetCanonical === match.variant) continue;

			try {
				const updated = await this.updatePlaceReferences(match.variant, targetCanonical, match.files);
				totalUpdated += updated;
			} catch (error) {
				errors.push(`${match.variant}: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		if (errors.length > 0) {
			console.error('Errors during variant standardization:', errors);
			new Notice(`Updated ${totalUpdated} references. ${errors.length} errors occurred.`);
		} else if (totalUpdated > 0) {
			new Notice(`Updated ${totalUpdated} place reference${totalUpdated !== 1 ? 's' : ''}`);
		} else {
			new Notice('No changes were needed');
		}

		if (this.onComplete) {
			this.onComplete(totalUpdated);
		}

		this.close();
	}

	/**
	 * Update place references in specific files
	 */
	private async updatePlaceReferences(oldValue: string, newValue: string, files: TFile[]): Promise<number> {
		let updated = 0;

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;

			// Check if any place fields contain the old value (as a component)
			const fieldsToUpdate: Array<{ field: string; oldVal: string; newVal: string }> = [];

			// Helper to check and queue field updates
			const checkField = (fieldName: string) => {
				const value = fm[fieldName];
				if (typeof value === 'string' && this.containsVariant(value, oldValue)) {
					const newFieldValue = this.replaceVariant(value, oldValue, newValue);
					if (newFieldValue !== value) {
						fieldsToUpdate.push({ field: fieldName, oldVal: value, newVal: newFieldValue });
					}
				}
			};

			checkField('birth_place');
			checkField('death_place');
			checkField('burial_place');

			// Check spouse marriage locations
			let spouseIndex = 1;
			while (fm[`spouse${spouseIndex}`] || fm[`spouse${spouseIndex}_id`]) {
				checkField(`spouse${spouseIndex}_marriage_location`);
				spouseIndex++;
			}

			if (fieldsToUpdate.length > 0) {
				await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
					for (const update of fieldsToUpdate) {
						frontmatter[update.field] = update.newVal;
					}
				});
				updated += fieldsToUpdate.length;
			}
		}

		return updated;
	}

	/**
	 * Check if a place value contains the variant (as a standalone component)
	 */
	private containsVariant(value: string, variant: string): boolean {
		// Split by comma and check each part
		const parts = value.split(',').map(p => p.trim());
		return parts.some(part => part.toLowerCase() === variant.toLowerCase());
	}

	/**
	 * Replace a variant in a place value with the canonical form
	 */
	private replaceVariant(value: string, oldVariant: string, newCanonical: string): string {
		const parts = value.split(',').map(p => p.trim());
		const newParts = parts.map(part => {
			if (part.toLowerCase() === oldVariant.toLowerCase()) {
				return newCanonical;
			}
			return part;
		});
		return newParts.join(', ');
	}

	onClose() {
		this.contentEl.empty();
	}
}

/**
 * Find place name variants in the vault
 */
export function findPlaceNameVariants(app: App): PlaceVariantMatch[] {
	const matches: PlaceVariantMatch[] = [];
	const files = app.vault.getMarkdownFiles();

	// Track which variants we've found and their files
	const variantFiles: Map<string, { files: TFile[]; count: number }> = new Map();

	// Helper to check a place value for variants
	const checkPlaceValue = (value: string, file: TFile) => {
		if (!value || typeof value !== 'string') return;

		// Split by comma and check each component
		const parts = value.split(',').map(p => p.trim());
		for (const part of parts) {
			const lowerPart = part.toLowerCase();
			const canonical = VARIANT_LOOKUP.get(lowerPart);

			if (canonical && part !== canonical) {
				// Found a variant that differs from canonical
				const key = `${part}|||${canonical}`;
				const existing = variantFiles.get(key);
				if (existing) {
					if (!existing.files.includes(file)) {
						existing.files.push(file);
					}
					existing.count++;
				} else {
					variantFiles.set(key, { files: [file], count: 1 });
				}
			}
		}
	};

	// Scan all markdown files
	for (const file of files) {
		const cache = app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) continue;

		const fm = cache.frontmatter;

		// Check place fields
		checkPlaceValue(fm.birth_place, file);
		checkPlaceValue(fm.death_place, file);
		checkPlaceValue(fm.burial_place, file);

		// Check spouse marriage locations
		let spouseIndex = 1;
		while (fm[`spouse${spouseIndex}`] || fm[`spouse${spouseIndex}_id`]) {
			checkPlaceValue(fm[`spouse${spouseIndex}_marriage_location`], file);
			spouseIndex++;
		}
	}

	// Convert to matches array
	for (const [key, data] of variantFiles.entries()) {
		const [variant, canonical] = key.split('|||');
		matches.push({
			variant,
			canonical,
			files: data.files,
			count: data.count
		});
	}

	// Sort by count descending
	matches.sort((a, b) => b.count - a.count);

	return matches;
}
