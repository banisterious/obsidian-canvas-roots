/**
 * Modal for building place hierarchy
 * Allows assigning parent places to orphan locations
 */

import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import { PlaceNode } from '../models/place';
import { updatePlaceNote } from '../core/place-note-writer';
import { createLucideIcon } from './lucide-icons';

interface BuildPlaceHierarchyOptions {
	onComplete?: (updated: number) => void;
}

interface OrphanAssignment {
	orphan: PlaceNode;
	parentId: string | null;
	parentName: string | null;
}

/**
 * Modal for assigning parent places to orphan locations
 */
export class BuildPlaceHierarchyModal extends Modal {
	private orphanPlaces: PlaceNode[];
	private potentialParents: PlaceNode[];
	private assignments: Map<string, OrphanAssignment>;
	private onComplete?: (updated: number) => void;

	constructor(
		app: App,
		orphanPlaces: PlaceNode[],
		potentialParents: PlaceNode[],
		options: BuildPlaceHierarchyOptions = {}
	) {
		super(app);
		this.orphanPlaces = orphanPlaces;
		this.potentialParents = potentialParents;
		this.onComplete = options.onComplete;

		// Initialize assignments
		this.assignments = new Map();
		for (const orphan of orphanPlaces) {
			this.assignments.set(orphan.id, {
				orphan,
				parentId: null,
				parentName: null
			});
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-build-hierarchy-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('layers', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Build place hierarchy');

		// Description
		contentEl.createEl('p', {
			text: `Found ${this.orphanPlaces.length} place${this.orphanPlaces.length !== 1 ? 's' : ''} without parent assignments. Select a parent for each place to build the hierarchy.`,
			cls: 'crc-text--muted'
		});

		if (this.potentialParents.length === 0) {
			contentEl.createEl('p', {
				text: 'No potential parent places found. Create country, state, or region place notes first.',
				cls: 'crc-text--warning'
			});
		}

		// Assignment list
		const assignmentContainer = contentEl.createDiv({ cls: 'crc-assignment-list' });
		this.renderAssignments(assignmentContainer);

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const applyBtn = buttonContainer.createEl('button', {
			text: 'Apply assignments',
			cls: 'crc-btn crc-btn--primary'
		});
		applyBtn.addEventListener('click', async () => {
			await this.applyAssignments();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Render the list of orphan places with parent selection dropdowns
	 */
	private renderAssignments(container: HTMLElement): void {
		container.empty();

		// Sort orphans by type then name
		const sortedOrphans = [...this.orphanPlaces].sort((a, b) => {
			if (a.placeType !== b.placeType) {
				return (a.placeType || '').localeCompare(b.placeType || '');
			}
			return a.name.localeCompare(b.name);
		});

		// Group by place type
		const byType = new Map<string, PlaceNode[]>();
		for (const orphan of sortedOrphans) {
			const type = orphan.placeType || 'other';
			if (!byType.has(type)) {
				byType.set(type, []);
			}
			byType.get(type)!.push(orphan);
		}

		// Build parent options for dropdown
		const parentOptions = this.buildParentOptions();

		for (const [type, orphans] of byType.entries()) {
			const typeSection = container.createDiv({ cls: 'crc-hierarchy-type-section' });

			typeSection.createEl('h4', {
				text: this.formatPlaceType(type),
				cls: 'crc-section-title'
			});

			for (const orphan of orphans) {
				const assignment = this.assignments.get(orphan.id)!;

				new Setting(typeSection)
					.setName(orphan.name)
					.setDesc(orphan.aliases.length > 0 ? `Also known as: ${orphan.aliases.join(', ')}` : '')
					.addDropdown(dropdown => {
						dropdown.addOption('', '(No parent)');

						for (const [groupName, options] of parentOptions.entries()) {
							// Add optgroup-like separator
							dropdown.addOption(`__group_${groupName}`, `── ${groupName} ──`);
							for (const opt of options) {
								dropdown.addOption(opt.id, `  ${opt.name}`);
							}
						}

						dropdown.setValue(assignment.parentId || '');
						dropdown.onChange(value => {
							if (value.startsWith('__group_')) {
								// Reset to no selection if they clicked a group header
								dropdown.setValue(assignment.parentId || '');
								return;
							}
							if (value) {
								const parent = this.potentialParents.find(p => p.id === value);
								assignment.parentId = value;
								assignment.parentName = parent?.name || null;
							} else {
								assignment.parentId = null;
								assignment.parentName = null;
							}
						});
					});
			}
		}
	}

	/**
	 * Build organized parent options grouped by type
	 */
	private buildParentOptions(): Map<string, Array<{ id: string; name: string }>> {
		const options = new Map<string, Array<{ id: string; name: string }>>();

		// Sort parents by type then name
		const sortedParents = [...this.potentialParents].sort((a, b) => {
			if (a.placeType !== b.placeType) {
				return (a.placeType || '').localeCompare(b.placeType || '');
			}
			return a.name.localeCompare(b.name);
		});

		for (const parent of sortedParents) {
			const type = this.formatPlaceType(parent.placeType || 'other');
			if (!options.has(type)) {
				options.set(type, []);
			}
			options.get(type)!.push({
				id: parent.id,
				name: parent.name
			});
		}

		return options;
	}

	/**
	 * Format place type for display
	 */
	private formatPlaceType(type: string): string {
		const names: Record<string, string> = {
			continent: 'Continents',
			country: 'Countries',
			state: 'States',
			province: 'Provinces',
			region: 'Regions',
			county: 'Counties',
			city: 'Cities',
			town: 'Towns',
			village: 'Villages',
			district: 'Districts',
			parish: 'Parishes',
			castle: 'Castles',
			estate: 'Estates',
			cemetery: 'Cemeteries',
			church: 'Churches',
			other: 'Other'
		};
		return names[type] || type.charAt(0).toUpperCase() + type.slice(1);
	}

	/**
	 * Apply the parent assignments to place notes
	 */
	private async applyAssignments(): Promise<void> {
		let updated = 0;
		const errors: string[] = [];

		for (const assignment of this.assignments.values()) {
			if (!assignment.parentId) continue;

			try {
				const file = this.app.vault.getAbstractFileByPath(assignment.orphan.filePath);
				if (!(file instanceof TFile)) {
					errors.push(`${assignment.orphan.name}: File not found`);
					continue;
				}

				await updatePlaceNote(this.app, file, {
					parentPlaceId: assignment.parentId,
					parentPlace: assignment.parentName || undefined
				});

				updated++;
			} catch (error) {
				errors.push(`${assignment.orphan.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		if (errors.length > 0) {
			console.error('Errors updating place notes:', errors);
			new Notice(`Updated ${updated} places. ${errors.length} failed.`);
		}

		if (this.onComplete) {
			this.onComplete(updated);
		}

		this.close();
	}
}
