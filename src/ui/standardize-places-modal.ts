/**
 * Modal for standardizing place name variations
 * Finds similar place names and allows unification to a canonical form
 */

import { App, Modal, Notice, TFile } from 'obsidian';
import { createLucideIcon } from './lucide-icons';
import { PlaceGraphService } from '../core/place-graph';

interface PlaceVariationGroup {
	/** All variations found (including the suggested canonical) */
	variations: string[];
	/** Suggested canonical name (most common or linked) */
	canonical: string;
	/** Total reference count across all variations */
	totalCount: number;
	/** Whether any variation is linked to a place note */
	hasLinkedVariation: boolean;
}

interface StandardizePlacesOptions {
	onComplete?: (updated: number) => void;
}

/**
 * Modal for reviewing and standardizing place name variations
 */
export class StandardizePlacesModal extends Modal {
	private placeService: PlaceGraphService;
	private variationGroups: PlaceVariationGroup[];
	private selectedGroups: Map<PlaceVariationGroup, string>; // group -> chosen canonical
	private appliedGroups: Set<PlaceVariationGroup>; // groups that have been applied
	private groupElements: Map<PlaceVariationGroup, HTMLElement>; // group -> DOM element
	private onComplete?: (updated: number) => void;
	private totalUpdated = 0;

	constructor(
		app: App,
		variationGroups: PlaceVariationGroup[],
		options: StandardizePlacesOptions = {}
	) {
		super(app);
		this.placeService = new PlaceGraphService(app);
		this.variationGroups = variationGroups;
		this.selectedGroups = new Map();
		this.appliedGroups = new Set();
		this.groupElements = new Map();
		this.onComplete = options.onComplete;

		// Pre-select the suggested canonical for each group
		for (const group of variationGroups) {
			this.selectedGroups.set(group, group.canonical);
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-standardize-places-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('edit', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Standardize place names');

		// Description
		contentEl.createEl('p', {
			text: `Found ${this.variationGroups.length} group${this.variationGroups.length !== 1 ? 's' : ''} of similar place names. Select which name to use as the standard for each group.`,
			cls: 'crc-text--muted'
		});

		if (this.variationGroups.length === 0) {
			contentEl.createEl('p', {
				text: 'No place name variations found. Your place names are already consistent!',
				cls: 'crc-text--success crc-mt-3'
			});

			const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });
			const closeBtn = buttonContainer.createEl('button', {
				text: 'Close',
				cls: 'crc-btn crc-btn--primary'
			});
			closeBtn.addEventListener('click', () => this.close());
			return;
		}

		// Variation groups container
		const groupsContainer = contentEl.createDiv({ cls: 'crc-variation-groups' });
		this.renderGroups(groupsContainer);

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => this.close());

		const applyBtn = buttonContainer.createEl('button', {
			text: 'Apply changes',
			cls: 'crc-btn crc-btn--primary'
		});
		applyBtn.addEventListener('click', () => void this.applyStandardization());
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();

		// Call completion callback if any groups were applied individually
		if (this.totalUpdated > 0 && this.onComplete) {
			this.onComplete(this.totalUpdated);
		}
	}

	/**
	 * Render the variation groups
	 */
	private renderGroups(container: HTMLElement): void {
		container.empty();
		this.groupElements.clear();

		for (const group of this.variationGroups) {
			const groupEl = container.createDiv({ cls: 'crc-variation-group' });
			this.groupElements.set(group, groupEl);

			// Group header with apply button
			const groupHeader = groupEl.createDiv({ cls: 'crc-variation-group-header' });

			const headerInfo = groupHeader.createDiv({ cls: 'crc-variation-group-info' });
			headerInfo.createEl('strong', {
				text: `${group.variations.length} variations`,
				cls: 'crc-variation-count'
			});
			headerInfo.createEl('span', {
				text: ` • ${group.totalCount} total references`,
				cls: 'crc-text--muted'
			});
			if (group.hasLinkedVariation) {
				const linkedBadge = headerInfo.createEl('span', {
					text: 'has place note',
					cls: 'crc-badge crc-badge--success crc-badge--small crc-ml-2'
				});
				linkedBadge.title = 'One or more variations are linked to place notes';
			}

			// Apply button for this group
			const applyBtn = groupHeader.createEl('button', {
				text: 'Apply',
				cls: 'crc-btn crc-btn--small'
			});
			applyBtn.addEventListener('click', () => void this.applyGroupStandardization(group, groupEl, applyBtn));

			// Radio buttons for each variation
			const variationsEl = groupEl.createDiv({ cls: 'crc-variation-options' });
			const groupIndex = this.variationGroups.indexOf(group);

			for (const variation of group.variations) {
				const optionEl = variationsEl.createDiv({ cls: 'crc-variation-option' });

				const radioId = `variation-${groupIndex}-${group.variations.indexOf(variation)}`;
				const radio = optionEl.createEl('input', {
					type: 'radio',
					cls: 'crc-radio'
				});
				radio.name = `group-${groupIndex}`;
				radio.id = radioId;
				radio.checked = this.selectedGroups.get(group) === variation;
				radio.addEventListener('change', () => {
					if (radio.checked) {
						this.selectedGroups.set(group, variation);
						// Hide custom input when selecting a predefined option
						customInputContainer.addClass('crc-hidden');
					}
				});

				const label = optionEl.createEl('label', { cls: 'crc-radio-label' });
				label.setAttribute('for', radioId);
				label.createEl('span', { text: variation });

				// Show reference count and linked status
				const references = this.getVariationReferences(variation);
				const isLinked = this.isVariationLinked(variation);

				const meta = label.createEl('span', { cls: 'crc-variation-meta' });
				meta.createEl('span', {
					text: ` (${references.length})`,
					cls: 'crc-text--muted'
				});
				if (isLinked) {
					meta.createEl('span', {
						text: ' ✓ linked',
						cls: 'crc-text--success'
					});
				}
			}

			// Custom name option
			const customOptionEl = variationsEl.createDiv({ cls: 'crc-variation-option' });
			const customRadioId = `variation-${groupIndex}-custom`;
			const customRadio = customOptionEl.createEl('input', {
				type: 'radio',
				cls: 'crc-radio'
			});
			customRadio.name = `group-${groupIndex}`;
			customRadio.id = customRadioId;

			const customLabel = customOptionEl.createEl('label', { cls: 'crc-radio-label' });
			customLabel.setAttribute('for', customRadioId);
			customLabel.createEl('span', { text: 'Custom name...', cls: 'crc-text--muted' });

			// Custom input container (hidden by default)
			const customInputContainer = variationsEl.createDiv({ cls: 'crc-custom-name-input crc-hidden' });
			const customInput = customInputContainer.createEl('input', {
				type: 'text',
				cls: 'crc-input',
				placeholder: 'Enter custom place name'
			});
			// Pre-fill with the suggested canonical
			customInput.value = group.canonical;

			customRadio.addEventListener('change', () => {
				if (customRadio.checked) {
					customInputContainer.removeClass('crc-hidden');
					customInput.focus();
					customInput.select();
					// Set the custom value
					this.selectedGroups.set(group, customInput.value);
				}
			});

			customInput.addEventListener('input', () => {
				if (customRadio.checked) {
					this.selectedGroups.set(group, customInput.value);
				}
			});
		}
	}

	/**
	 * Apply standardization for a single group
	 */
	private async applyGroupStandardization(
		group: PlaceVariationGroup,
		groupEl: HTMLElement,
		applyBtn: HTMLButtonElement
	): Promise<void> {
		const canonical = this.selectedGroups.get(group);
		if (!canonical) return;

		// Disable the button while processing
		applyBtn.disabled = true;
		applyBtn.textContent = 'Applying...';

		const variationsToUpdate = group.variations.filter(v => v !== canonical);
		let updated = 0;
		const errors: string[] = [];

		for (const oldValue of variationsToUpdate) {
			try {
				const count = await this.updatePlaceReferences(oldValue, canonical);
				updated += count;
			} catch (error) {
				errors.push(`${oldValue}: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		this.totalUpdated += updated;
		this.appliedGroups.add(group);

		// Update the group element to show completion
		groupEl.addClass('crc-variation-group--applied');
		applyBtn.textContent = `Done (${updated})`;
		applyBtn.addClass('crc-btn--success');

		// Disable radio buttons
		const radios = groupEl.querySelectorAll('input[type="radio"]');
		radios.forEach(radio => (radio as HTMLInputElement).disabled = true);

		if (errors.length > 0) {
			console.error('Errors during group standardization:', errors);
			new Notice(`Updated ${updated} references with ${errors.length} errors`);
		} else if (updated > 0) {
			new Notice(`Updated ${updated} reference${updated !== 1 ? 's' : ''} to "${canonical}"`);
		} else {
			new Notice('No changes were needed');
		}
	}

	/**
	 * Get references for a specific variation
	 */
	private getVariationReferences(variation: string): Array<{ personId: string }> {
		this.placeService.ensureCacheLoaded();
		const allRefs = this.placeService.getPlaceReferences();
		return allRefs.filter(ref => ref.rawValue === variation);
	}

	/**
	 * Check if a variation is linked to a place note
	 */
	private isVariationLinked(variation: string): boolean {
		this.placeService.ensureCacheLoaded();
		const place = this.placeService.getPlaceByName(variation);
		return place !== undefined;
	}

	/**
	 * Apply the standardization changes for all remaining (non-applied) groups
	 */
	private async applyStandardization(): Promise<void> {
		let batchUpdated = 0;
		const errors: string[] = [];

		for (const [group, canonical] of this.selectedGroups.entries()) {
			// Skip groups that have already been applied individually
			if (this.appliedGroups.has(group)) continue;

			// Find all variations that need to be updated (not the canonical one)
			const variationsToUpdate = group.variations.filter(v => v !== canonical);

			for (const oldValue of variationsToUpdate) {
				try {
					const updated = await this.updatePlaceReferences(oldValue, canonical);
					batchUpdated += updated;
				} catch (error) {
					errors.push(`${oldValue} → ${canonical}: ${error instanceof Error ? error.message : 'Unknown error'}`);
				}
			}

			this.appliedGroups.add(group);
		}

		this.totalUpdated += batchUpdated;

		if (errors.length > 0) {
			console.error('Errors during standardization:', errors);
			new Notice(`Updated ${batchUpdated} references. ${errors.length} errors occurred.`);
		} else if (batchUpdated > 0) {
			new Notice(`Updated ${batchUpdated} place reference${batchUpdated !== 1 ? 's' : ''}`);
		} else {
			new Notice('No changes were needed');
		}

		if (this.onComplete) {
			this.onComplete(this.totalUpdated);
		}

		this.close();
	}

	/**
	 * Update all place references from oldValue to newValue
	 */
	private async updatePlaceReferences(oldValue: string, newValue: string): Promise<number> {
		let updated = 0;
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;

			// Skip place notes
			if (fm.type === 'place') continue;

			// Check if any place fields match the old value
			const fieldsToUpdate: string[] = [];

			if (fm.birth_place === oldValue) fieldsToUpdate.push('birth_place');
			if (fm.death_place === oldValue) fieldsToUpdate.push('death_place');
			if (fm.burial_place === oldValue) fieldsToUpdate.push('burial_place');

			// Check spouse marriage locations
			let spouseIndex = 1;
			while (fm[`spouse${spouseIndex}`] || fm[`spouse${spouseIndex}_id`]) {
				if (fm[`spouse${spouseIndex}_marriage_location`] === oldValue) {
					fieldsToUpdate.push(`spouse${spouseIndex}_marriage_location`);
				}
				spouseIndex++;
			}

			if (fieldsToUpdate.length > 0) {
				await this.updateFileFrontmatter(file, fieldsToUpdate, newValue);
				updated += fieldsToUpdate.length;
			}
		}

		return updated;
	}

	/**
	 * Update specific frontmatter fields in a file
	 */
	private async updateFileFrontmatter(file: TFile, fields: string[], newValue: string): Promise<void> {
		const content = await this.app.vault.read(file);
		const lines = content.split('\n');

		// Find frontmatter boundaries
		if (lines[0] !== '---') return;

		let endIndex = -1;
		for (let i = 1; i < lines.length; i++) {
			if (lines[i] === '---') {
				endIndex = i;
				break;
			}
		}

		if (endIndex === -1) return;

		// Update matching fields in frontmatter
		for (let i = 1; i < endIndex; i++) {
			const line = lines[i];
			for (const field of fields) {
				// Match field: value or field: "value" patterns
				const regex = new RegExp(`^(${field}:\\s*)(.+)$`);
				const match = line.match(regex);
				if (match) {
					// Preserve quoting style
					const oldValPart = match[2];
					let newLine: string;
					if (oldValPart.startsWith('"') && oldValPart.endsWith('"')) {
						newLine = `${match[1]}"${newValue}"`;
					} else if (oldValPart.startsWith("'") && oldValPart.endsWith("'")) {
						newLine = `${match[1]}'${newValue}'`;
					} else {
						// Use quotes if newValue contains special characters
						if (newValue.includes(':') || newValue.includes('#') || newValue.includes(',')) {
							newLine = `${match[1]}"${newValue}"`;
						} else {
							newLine = `${match[1]}${newValue}`;
						}
					}
					lines[i] = newLine;
				}
			}
		}

		await this.app.vault.modify(file, lines.join('\n'));
	}
}

/**
 * Find groups of similar place names that might be variations
 */
export function findPlaceNameVariations(app: App): PlaceVariationGroup[] {
	const placeService = new PlaceGraphService(app);
	placeService.reloadCache();

	const references = placeService.getReferencedPlaces();
	const allPlaceNames: Array<{ name: string; count: number; linked: boolean }> = [];

	for (const [name, info] of references.entries()) {
		allPlaceNames.push({ name, count: info.count, linked: info.linked });
	}

	// Group similar names using various heuristics
	const groups: PlaceVariationGroup[] = [];
	const processed = new Set<string>();

	for (const place of allPlaceNames) {
		if (processed.has(place.name)) continue;

		const similar = findSimilarNames(place.name, allPlaceNames, processed);

		if (similar.length > 1) {
			// Sort by: linked first, then by count (descending)
			similar.sort((a, b) => {
				if (a.linked !== b.linked) return a.linked ? -1 : 1;
				return b.count - a.count;
			});

			const group: PlaceVariationGroup = {
				variations: similar.map(s => s.name),
				canonical: similar[0].name, // Suggest the linked or most common
				totalCount: similar.reduce((sum, s) => sum + s.count, 0),
				hasLinkedVariation: similar.some(s => s.linked)
			};

			groups.push(group);

			for (const s of similar) {
				processed.add(s.name);
			}
		} else {
			processed.add(place.name);
		}
	}

	// Sort groups by total count (most references first)
	groups.sort((a, b) => b.totalCount - a.totalCount);

	return groups;
}

/**
 * Find names similar to the given name
 */
function findSimilarNames(
	name: string,
	allNames: Array<{ name: string; count: number; linked: boolean }>,
	processed: Set<string>
): Array<{ name: string; count: number; linked: boolean }> {
	const similar: Array<{ name: string; count: number; linked: boolean }> = [];

	// Normalize for comparison
	const normalized = normalizePlaceName(name);

	for (const place of allNames) {
		if (processed.has(place.name)) continue;

		const otherNormalized = normalizePlaceName(place.name);

		// Check various similarity criteria
		if (
			normalized === otherNormalized ||
			isSubstringMatch(normalized, otherNormalized) ||
			isAbbreviationMatch(name, place.name) ||
			isPunctuationVariation(name, place.name) ||
			isHierarchyVariation(name, place.name)
		) {
			similar.push(place);
		}
	}

	return similar;
}

/**
 * Normalize a place name for comparison
 */
function normalizePlaceName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[,.\-']/g, ' ')  // Replace punctuation with spaces
		.replace(/\s+/g, ' ')      // Normalize whitespace
		.trim();
}

/**
 * Check if one name is a substring of another (after normalization)
 * This is ONLY for catching cases where one place is a more specific version
 * of another, like "Boston" vs "Boston, MA, USA"
 *
 * This is NOT for matching places that just share a common word.
 */
function isSubstringMatch(a: string, b: string): boolean {
	// One must be significantly shorter to be a substring match
	if (Math.abs(a.length - b.length) < 5) return false;

	const shorter = a.length < b.length ? a : b;
	const longer = a.length < b.length ? b : a;

	// Don't match if the shorter string is just a state/country name
	// These are too common and create false positives
	const commonRegions = [
		'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
		'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
		'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
		'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
		'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
		'new hampshire', 'new jersey', 'new mexico', 'new york',
		'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon',
		'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
		'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington',
		'west virginia', 'wisconsin', 'wyoming',
		'usa', 'united states', 'america', 'uk', 'united kingdom',
		'england', 'scotland', 'wales', 'ireland', 'canada', 'australia',
		'germany', 'france', 'italy', 'spain'
	];

	const shorterNorm = shorter.toLowerCase().trim();
	if (commonRegions.includes(shorterNorm)) {
		return false;
	}

	// The shorter one must be at least 8 chars (increased from 6)
	// and must appear at the START of the longer string (not just anywhere)
	// This prevents "Hartford" from matching "West Hartford, Hartford, CT"
	return longer.startsWith(shorter) && shorter.length >= 8;
}

/**
 * Check for common abbreviation patterns
 * Only matches when the abbreviation substitution results in identical strings
 */
function isAbbreviationMatch(a: string, b: string): boolean {
	// Only check country/state abbreviations that are unambiguous
	// Removed directional abbreviations (N/S/E/W) as they cause too many false positives
	const abbreviations: Record<string, string[]> = {
		'united states': ['usa', 'u.s.a.'],
		'united kingdom': ['uk', 'u.k.'],
		'new york': ['ny', 'n.y.'],
		'california': ['calif'],
		'massachusetts': ['mass'],
		'pennsylvania': ['penn'],
		'connecticut': ['ct', 'conn'],
		'district of columbia': ['dc', 'd.c.'],
		'saint': ['st.'],  // Only match with period to avoid "St" matching random words
		'mount': ['mt.'],  // Only match with period
		'fort': ['ft.'],   // Only match with period
	};

	const aLower = a.toLowerCase();
	const bLower = b.toLowerCase();

	// Try substituting abbreviations and see if strings become equal
	for (const [full, abbrevs] of Object.entries(abbreviations)) {
		for (const abbrev of abbrevs) {
			// Try replacing full with abbrev in a, see if it matches b
			if (aLower.includes(full)) {
				const aSubstituted = aLower.replace(full, abbrev);
				if (normalizePlaceName(aSubstituted) === normalizePlaceName(bLower)) {
					return true;
				}
			}
			// Try replacing abbrev with full in a, see if it matches b
			if (aLower.includes(abbrev)) {
				const aSubstituted = aLower.replace(abbrev, full);
				if (normalizePlaceName(aSubstituted) === normalizePlaceName(bLower)) {
					return true;
				}
			}
		}
	}

	return false;
}

/**
 * Check for punctuation/formatting variations
 */
function isPunctuationVariation(a: string, b: string): boolean {
	// Remove all punctuation and compare
	const aNoPunct = a.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
	const bNoPunct = b.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

	return aNoPunct === bNoPunct && a !== b;
}

/**
 * Parse a place string into hierarchy parts
 * Handles both comma-separated and space-separated formats
 */
function parsePlaceHierarchy(name: string): string[] {
	// First try splitting by comma
	let parts = name.split(',').map(p => p.trim()).filter(p => p.length > 0);

	// If only one part and it has spaces, try to detect embedded hierarchy
	// e.g., "Greene County Tennessee" -> ["Greene County", "Tennessee"]
	if (parts.length === 1) {
		const words = name.split(/\s+/);

		// Look for state/country names at the end
		const statePatterns = [
			/^(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new\s*hampshire|new\s*jersey|new\s*mexico|new\s*york|north\s*carolina|north\s*dakota|ohio|oklahoma|oregon|pennsylvania|rhode\s*island|south\s*carolina|south\s*dakota|tennessee|texas|utah|vermont|virginia|washington|west\s*virginia|wisconsin|wyoming)$/i,
			/^(usa?|united\s*states|america|uk|england|scotland|wales|ireland|canada|australia|germany|france|italy|spain)$/i
		];

		// Try to find where the hierarchy split might be
		for (let i = words.length - 1; i >= 1; i--) {
			const potentialState = words.slice(i).join(' ');
			for (const pattern of statePatterns) {
				if (pattern.test(potentialState)) {
					const locality = words.slice(0, i).join(' ');
					if (locality.length > 0) {
						parts = [locality, potentialState];
						break;
					}
				}
			}
			if (parts.length > 1) break;
		}
	}

	return parts.map(p => p.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim());
}

/**
 * Extract the base locality name from a place hierarchy
 * e.g., "Greene County" -> "greene county", "Greene" -> "greene"
 */
function extractBaseLocality(parts: string[]): string {
	if (parts.length === 0) return '';
	return parts[0];
}

/**
 * Check if two places share the same base locality with different hierarchy depth
 *
 * Detects cases like:
 * - "Greene County, Tennessee, USA" vs "Greene County Tennessee"
 * - "Greene County, Tennessee" vs "Greene, Tennessee, USA"
 * - "Scotland County, North Carolina" vs "Scotland County North Carolina USA"
 *
 * Does NOT match places that just share a state/country - the base locality must match.
 * Does NOT match places where one locality name is a prefix of another different place
 * (e.g., "Newport" should NOT match "Newport News")
 */
function isHierarchyVariation(a: string, b: string): boolean {
	// Don't match identical strings
	if (a === b) return false;

	const partsA = parsePlaceHierarchy(a);
	const partsB = parsePlaceHierarchy(b);

	// Need at least two parts each (locality + at least one parent)
	// Single-part names are too ambiguous for hierarchy matching
	if (partsA.length < 2 || partsB.length < 2) return false;

	const baseA = extractBaseLocality(partsA);
	const baseB = extractBaseLocality(partsB);

	// Base localities must match exactly, OR differ only by common suffixes like "County", "City", "Township"
	// This prevents "Newport" from matching "Newport News" (different places)
	// but allows "Greene" to match "Greene County" (same place, different format)
	const commonSuffixes = ['county', 'city', 'township', 'town', 'village', 'borough', 'parish'];

	let baseMatch = baseA === baseB;

	if (!baseMatch) {
		// Check if one is the other plus a common suffix
		for (const suffix of commonSuffixes) {
			if (baseA === `${baseB} ${suffix}` || baseB === `${baseA} ${suffix}`) {
				baseMatch = true;
				break;
			}
		}
	}

	if (!baseMatch) return false;

	// Must also share at least one hierarchy element (state/county) to confirm they're the same place
	// But NOT just "usa" or other country-level matches - need state or county level
	const hierarchyA = partsA.slice(1);
	const hierarchyB = partsB.slice(1);

	// Filter out country-level matches which are too broad
	const countryNames = ['usa', 'united states', 'america', 'uk', 'united kingdom', 'canada', 'australia'];

	// Check for shared hierarchy elements at state/county level
	for (const elemA of hierarchyA) {
		if (countryNames.includes(elemA)) continue; // Skip country matches
		for (const elemB of hierarchyB) {
			if (countryNames.includes(elemB)) continue; // Skip country matches
			// Require exact match for hierarchy elements (after normalization)
			if (elemA === elemB && elemA.length >= 2) {
				return true;
			}
		}
	}

	return false;
}
