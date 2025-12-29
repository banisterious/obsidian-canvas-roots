/**
 * Modal for standardizing place name variations
 * Finds similar place names and allows unification to a canonical form
 */

import { App, Modal, Notice, TFile } from 'obsidian';
import { createLucideIcon } from './lucide-icons';
import { PlaceGraphService } from '../core/place-graph';
import { FamilyGraphService, PersonNode } from '../core/family-graph';
import { PlaceReference, PlaceReferenceType } from '../models/place';

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
	private familyGraph: FamilyGraphService;
	private variationGroups: PlaceVariationGroup[];
	private selectedGroups: Map<PlaceVariationGroup, string>; // group -> chosen canonical
	private appliedGroups: Set<PlaceVariationGroup>; // groups that have been applied
	private groupElements: Map<PlaceVariationGroup, HTMLElement>; // group -> DOM element
	private groupImpactElements: Map<PlaceVariationGroup, HTMLElement>; // group -> impact display element
	private groupApplyButtons: Map<PlaceVariationGroup, HTMLButtonElement>; // group -> apply button
	private onComplete?: (updated: number) => void;
	private totalUpdated = 0;

	constructor(
		app: App,
		variationGroups: PlaceVariationGroup[],
		options: StandardizePlacesOptions = {}
	) {
		super(app);
		this.placeService = new PlaceGraphService(app);
		this.familyGraph = new FamilyGraphService(app);
		this.variationGroups = variationGroups;
		this.selectedGroups = new Map();
		this.appliedGroups = new Set();
		this.groupElements = new Map();
		this.groupImpactElements = new Map();
		this.groupApplyButtons = new Map();
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

		// Description - what the modal does
		const descriptionEl = contentEl.createDiv({ cls: 'crc-standardize-description' });
		descriptionEl.createEl('p', {
			text: `Found ${this.variationGroups.length} group${this.variationGroups.length !== 1 ? 's' : ''} of similar place names that may be variations of the same location.`,
			cls: 'crc-text--muted'
		});

		// Explanation of what happens
		const explanationEl = descriptionEl.createDiv({ cls: 'crc-standardize-explanation' });
		explanationEl.createEl('p', {
			text: 'For each group, select the name you want to use as the standard. Applying will update these frontmatter fields in your person notes:',
			cls: 'crc-text--muted'
		});
		const fieldsList = explanationEl.createEl('ul', { cls: 'crc-field-list' });
		fieldsList.createEl('li', { text: 'birth_place' });
		fieldsList.createEl('li', { text: 'death_place' });
		fieldsList.createEl('li', { text: 'burial_place' });
		fieldsList.createEl('li', { text: 'spouse marriage locations' });

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

		// Backup warning
		const warning = contentEl.createDiv({ cls: 'crc-warning-callout' });
		const warningIcon = createLucideIcon('alert-triangle', 16);
		warning.appendChild(warningIcon);
		warning.createSpan({
			text: ' Backup your vault before proceeding. This operation will modify existing notes.'
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Close',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => this.close());

		// Calculate total impact for the main button
		const totalImpact = this.calculateTotalImpact();
		const applyBtn = buttonContainer.createEl('button', {
			text: `Standardize all (${totalImpact.totalRefs} refs)`,
			cls: 'crc-btn crc-btn--primary'
		});
		applyBtn.title = `Update ${totalImpact.totalRefs} references across ${totalImpact.groupCount} groups`;
		applyBtn.addEventListener('click', () => void this.applyStandardization());
	}

	/**
	 * Calculate total impact across all groups
	 */
	private calculateTotalImpact(): { totalRefs: number; groupCount: number } {
		let totalRefs = 0;
		let groupCount = 0;

		for (const group of this.variationGroups) {
			if (this.appliedGroups.has(group)) continue;
			const impact = this.calculateGroupImpact(group);
			if (impact.totalRefs > 0) {
				totalRefs += impact.totalRefs;
				groupCount++;
			}
		}

		return { totalRefs, groupCount };
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
		this.groupImpactElements.clear();
		this.groupApplyButtons.clear();

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

			// Apply button for this group - with dynamic label showing impact
			const impact = this.calculateGroupImpact(group);
			const applyBtn = groupHeader.createEl('button', {
				text: `Standardize (${impact.totalRefs})`,
				cls: 'crc-btn crc-btn--small'
			});
			applyBtn.title = `Update ${impact.totalRefs} reference${impact.totalRefs !== 1 ? 's' : ''} in ${impact.fileCount} file${impact.fileCount !== 1 ? 's' : ''}`;
			this.groupApplyButtons.set(group, applyBtn);
			applyBtn.addEventListener('click', () => void this.applyGroupStandardization(group, groupEl, applyBtn));

			// Radio buttons for each variation
			const variationsEl = groupEl.createDiv({ cls: 'crc-variation-options' });
			const groupIndex = this.variationGroups.indexOf(group);

			for (const variation of group.variations) {
				const optionContainer = variationsEl.createDiv({ cls: 'crc-variation-option-container' });
				const optionEl = optionContainer.createDiv({ cls: 'crc-variation-option' });

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
						this.updateGroupImpactDisplay(group);
					}
				});

				const label = optionEl.createEl('label', { cls: 'crc-radio-label' });
				label.setAttribute('for', radioId);
				label.createEl('span', { text: variation });

				// Show reference count and linked status
				const references = this.getVariationReferences(variation);
				const isLinked = this.isVariationLinked(variation);
				const typeCounts = this.getReferenceTypeCounts(references);

				const meta = label.createEl('span', { cls: 'crc-variation-meta' });

				// Clickable count that expands to show affected notes
				const countEl = meta.createEl('span', {
					text: `(${references.length})`,
					cls: 'crc-variation-count-link'
				});
				countEl.title = 'Click to show affected notes';

				// Reference type breakdown (e.g., "birth: 2, death: 1")
				if (typeCounts.size > 0) {
					const typeBreakdown: string[] = [];
					for (const [type, count] of typeCounts) {
						typeBreakdown.push(`${this.formatReferenceType(type)}: ${count}`);
					}
					meta.createEl('span', {
						text: ` ${typeBreakdown.join(', ')}`,
						cls: 'crc-text--muted crc-variation-types'
					});
				}

				if (isLinked) {
					meta.createEl('span', {
						text: ' ✓ linked',
						cls: 'crc-text--success'
					});
				}

				// Expandable details panel (hidden by default)
				const detailsEl = optionContainer.createDiv({ cls: 'crc-variation-details crc-hidden' });
				this.renderVariationDetails(detailsEl, references);

				// Toggle details on count click
				countEl.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					detailsEl.toggleClass('crc-hidden', !detailsEl.hasClass('crc-hidden'));
					countEl.toggleClass('crc-expanded', !detailsEl.hasClass('crc-hidden'));
				});
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
					this.updateGroupImpactDisplay(group);
				}
			});

			customInput.addEventListener('input', () => {
				if (customRadio.checked) {
					this.selectedGroups.set(group, customInput.value);
					this.updateGroupImpactDisplay(group);
				}
			});

			// Impact display area - shows what will happen when applied
			const impactEl = groupEl.createDiv({ cls: 'crc-variation-impact' });
			this.groupImpactElements.set(group, impactEl);
			this.updateGroupImpactDisplay(group);
		}
	}

	/**
	 * Calculate the impact of standardizing a group
	 */
	private calculateGroupImpact(group: PlaceVariationGroup): {
		totalRefs: number;
		fileCount: number;
		filesAffected: Set<string>;
		typeCounts: Map<PlaceReferenceType, number>;
	} {
		const canonical = this.selectedGroups.get(group) || group.canonical;
		const variationsToUpdate = group.variations.filter(v => v !== canonical);

		let totalRefs = 0;
		const filesAffected = new Set<string>();
		const typeCounts = new Map<PlaceReferenceType, number>();

		for (const variation of variationsToUpdate) {
			const refs = this.getVariationReferences(variation);
			totalRefs += refs.length;
			for (const ref of refs) {
				filesAffected.add(ref.personId);
				typeCounts.set(ref.referenceType, (typeCounts.get(ref.referenceType) || 0) + 1);
			}
		}

		return { totalRefs, fileCount: filesAffected.size, filesAffected, typeCounts };
	}

	/**
	 * Update the impact display for a group based on current selection
	 */
	private updateGroupImpactDisplay(group: PlaceVariationGroup): void {
		const impactEl = this.groupImpactElements.get(group);
		const applyBtn = this.groupApplyButtons.get(group);
		if (!impactEl) return;

		impactEl.empty();

		const canonical = this.selectedGroups.get(group);
		if (!canonical) return;

		const impact = this.calculateGroupImpact(group);

		// Update button label and state based on impact
		if (applyBtn) {
			// Check if this group was already applied
			const wasApplied = this.appliedGroups.has(group);

			if (impact.totalRefs === 0 && !wasApplied) {
				// Nothing to change - disable the button
				applyBtn.disabled = true;
				applyBtn.textContent = 'Nothing to change';
				applyBtn.title = 'All references already use the selected name';
				applyBtn.removeClass('crc-btn--success');
			} else if (!wasApplied) {
				// Enable and update label
				applyBtn.disabled = false;
				applyBtn.textContent = `Standardize (${impact.totalRefs})`;
				applyBtn.title = `Update ${impact.totalRefs} reference${impact.totalRefs !== 1 ? 's' : ''} in ${impact.fileCount} file${impact.fileCount !== 1 ? 's' : ''}`;
			}
			// If wasApplied, leave button in its "Done" state
		}

		if (impact.totalRefs === 0) {
			impactEl.createEl('span', {
				text: '✓ All references already use this name',
				cls: 'crc-text--success crc-impact-message'
			});
		} else {
			const variationsToUpdate = group.variations.filter(v => v !== canonical);
			const impactText = impactEl.createEl('span', { cls: 'crc-impact-message' });

			// Show which variations will be replaced
			const variationNames = variationsToUpdate.map(v => `"${v}"`).join(', ');
			impactText.createEl('span', {
				text: `Will update ${impact.totalRefs} reference${impact.totalRefs !== 1 ? 's' : ''} `,
				cls: 'crc-text--muted'
			});
			impactText.createEl('span', {
				text: `(${variationNames})`,
				cls: 'crc-text--muted crc-variation-names'
			});
			impactText.createEl('span', {
				text: ` → "${canonical}"`,
				cls: 'crc-text--accent'
			});

			// Show field type breakdown
			if (impact.typeCounts.size > 0) {
				const typeBreakdown: string[] = [];
				for (const [type, count] of impact.typeCounts) {
					typeBreakdown.push(`${count} ${this.formatReferenceType(type)}`);
				}
				impactEl.createEl('div', {
					text: `Fields: ${typeBreakdown.join(', ')}`,
					cls: 'crc-text--muted crc-impact-types'
				});
			}
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
	private getVariationReferences(variation: string): PlaceReference[] {
		this.placeService.ensureCacheLoaded();
		const allRefs = this.placeService.getPlaceReferences();
		return allRefs.filter(ref => ref.rawValue === variation);
	}

	/**
	 * Get a person's display name from their cr_id
	 */
	private getPersonName(personId: string): string {
		const person = this.familyGraph.getPersonByCrId(personId);
		if (person) {
			return person.name || person.file.basename;
		}
		return personId;
	}

	/**
	 * Get a person node from their cr_id
	 */
	private getPerson(personId: string): PersonNode | undefined {
		this.familyGraph.ensureCacheLoaded();
		return this.familyGraph.getPersonByCrId(personId);
	}

	/**
	 * Format reference type for display
	 */
	private formatReferenceType(type: PlaceReferenceType): string {
		switch (type) {
			case 'birth': return 'birth';
			case 'death': return 'death';
			case 'burial': return 'burial';
			case 'marriage': return 'marriage';
			default: return type;
		}
	}

	/**
	 * Get reference type counts for a variation
	 */
	private getReferenceTypeCounts(references: PlaceReference[]): Map<PlaceReferenceType, number> {
		const counts = new Map<PlaceReferenceType, number>();
		for (const ref of references) {
			counts.set(ref.referenceType, (counts.get(ref.referenceType) || 0) + 1);
		}
		return counts;
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
	 * Render the expandable details panel showing affected notes
	 */
	private renderVariationDetails(container: HTMLElement, references: PlaceReference[]): void {
		if (references.length === 0) {
			container.createEl('span', {
				text: 'No references found',
				cls: 'crc-text--muted'
			});
			return;
		}

		const list = container.createEl('ul', { cls: 'crc-variation-details-list' });

		for (const ref of references) {
			const person = this.getPerson(ref.personId);
			const li = list.createEl('li', { cls: 'crc-variation-details-item' });

			// Person name as clickable link
			const personName = person ? (person.name || person.file.basename) : ref.personId;
			const link = li.createEl('a', {
				text: personName,
				cls: 'crc-variation-details-link'
			});
			link.addEventListener('click', (e) => {
				e.preventDefault();
				if (person) {
					void this.app.workspace.getLeaf('window').openFile(person.file);
				}
			});

			// Field type badge
			li.createEl('span', {
				text: this.formatReferenceType(ref.referenceType),
				cls: 'crc-badge crc-badge--small crc-variation-details-type'
			});
		}
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

			// Skip place notes (check both cr_type and legacy type)
			if (fm.cr_type === 'place' || fm.type === 'place') continue;

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

	// Filter out groups where there are no actual references to standardize
	// The totalCount from getReferencedPlaces() may not match actual rawValue references
	// because it resolves place IDs to display names. We need to verify actual refs exist.
	const allRefs = placeService.getPlaceReferences();
	const actionableGroups = groups.filter(g => {
		// Check if any variation has actual references by rawValue
		for (const variation of g.variations) {
			const refs = allRefs.filter(ref => ref.rawValue === variation);
			if (refs.length > 0) {
				return true;
			}
		}
		return false;
	});

	// Recalculate totalCount based on actual rawValue references
	for (const group of actionableGroups) {
		let actualTotal = 0;
		for (const variation of group.variations) {
			actualTotal += allRefs.filter(ref => ref.rawValue === variation).length;
		}
		group.totalCount = actualTotal;
	}

	// Sort groups by total count (most references first)
	actionableGroups.sort((a, b) => b.totalCount - a.totalCount);

	return actionableGroups;
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
