/**
 * Modal for batch creating missing place notes
 * Shows referenced places that don't have notes and allows selection for creation
 */

import { App, Modal, Setting, Notice, normalizePath } from 'obsidian';
import { createPlaceNote } from '../core/place-note-writer';
import { createLucideIcon } from './lucide-icons';

interface MissingPlace {
	name: string;
	count: number;
}

interface CreateMissingPlacesOptions {
	directory?: string;
	onComplete?: (created: number) => void;
}

/**
 * Modal for selecting and creating missing place notes in batch
 */
export class CreateMissingPlacesModal extends Modal {
	private places: MissingPlace[];
	private selectedPlaces: Set<string>;
	private directory: string;
	private onComplete?: (created: number) => void;

	constructor(
		app: App,
		places: MissingPlace[],
		options: CreateMissingPlacesOptions = {}
	) {
		super(app);
		this.places = places;
		this.selectedPlaces = new Set();
		this.directory = options.directory || '';
		this.onComplete = options.onComplete;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-create-missing-places-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('map-pin', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Create missing place notes');

		// Description
		contentEl.createEl('p', {
			text: `Found ${this.places.length} place${this.places.length !== 1 ? 's' : ''} referenced in person notes without corresponding place notes.`,
			cls: 'crc-text--muted'
		});

		// Directory setting
		const form = contentEl.createDiv({ cls: 'crc-form' });

		new Setting(form)
			.setName('Directory')
			.setDesc('Where to create the new place notes')
			.addText(text => text
				.setPlaceholder('e.g., Places')
				.setValue(this.directory)
				.onChange(value => {
					this.directory = value;
				}));

		// Selection controls
		const controlsRow = contentEl.createDiv({ cls: 'crc-controls-row crc-mb-3' });

		const selectAllBtn = controlsRow.createEl('button', {
			text: 'Select all',
			cls: 'crc-btn crc-btn--small'
		});
		selectAllBtn.addEventListener('click', () => {
			this.selectAll();
			this.renderPlaceList(placeListContainer);
		});

		const selectNoneBtn = controlsRow.createEl('button', {
			text: 'Select none',
			cls: 'crc-btn crc-btn--small crc-ml-2'
		});
		selectNoneBtn.addEventListener('click', () => {
			this.selectNone();
			this.renderPlaceList(placeListContainer);
		});

		const selectionCount = controlsRow.createEl('span', {
			cls: 'crc-text--muted crc-ml-3'
		});
		this.updateSelectionCount(selectionCount);

		// Place list container
		const placeListContainer = contentEl.createDiv({ cls: 'crc-place-list-container' });
		this.renderPlaceList(placeListContainer);

		// Update selection count when checkboxes change
		placeListContainer.addEventListener('change', () => {
			this.updateSelectionCount(selectionCount);
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const createBtn = buttonContainer.createEl('button', {
			text: 'Create selected',
			cls: 'crc-btn crc-btn--primary'
		});
		createBtn.addEventListener('click', async () => {
			await this.createSelectedPlaces();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Render the place list with checkboxes
	 */
	private renderPlaceList(container: HTMLElement): void {
		container.empty();

		const list = container.createEl('div', { cls: 'crc-checkbox-list' });

		for (const place of this.places) {
			const item = list.createDiv({ cls: 'crc-checkbox-item' });

			const checkbox = item.createEl('input', {
				type: 'checkbox',
				cls: 'crc-checkbox'
			});
			checkbox.checked = this.selectedPlaces.has(place.name);
			checkbox.addEventListener('change', () => {
				if (checkbox.checked) {
					this.selectedPlaces.add(place.name);
				} else {
					this.selectedPlaces.delete(place.name);
				}
			});

			const label = item.createEl('label', { cls: 'crc-checkbox-label' });
			label.createEl('span', { text: place.name });
			label.createEl('span', {
				text: ` (${place.count} reference${place.count !== 1 ? 's' : ''})`,
				cls: 'crc-text--muted'
			});

			// Make label toggle checkbox
			label.addEventListener('click', () => {
				checkbox.checked = !checkbox.checked;
				checkbox.dispatchEvent(new Event('change', { bubbles: true }));
			});
		}
	}

	/**
	 * Select all places
	 */
	private selectAll(): void {
		for (const place of this.places) {
			this.selectedPlaces.add(place.name);
		}
	}

	/**
	 * Deselect all places
	 */
	private selectNone(): void {
		this.selectedPlaces.clear();
	}

	/**
	 * Update the selection count display
	 */
	private updateSelectionCount(element: HTMLElement): void {
		element.textContent = `${this.selectedPlaces.size} of ${this.places.length} selected`;
	}

	/**
	 * Create place notes for selected places
	 */
	private async createSelectedPlaces(): Promise<void> {
		if (this.selectedPlaces.size === 0) {
			new Notice('No places selected');
			return;
		}

		try {
			// Ensure directory exists
			if (this.directory) {
				const normalizedDir = normalizePath(this.directory);
				const folder = this.app.vault.getAbstractFileByPath(normalizedDir);
				if (!folder) {
					await this.app.vault.createFolder(normalizedDir);
				}
			}

			let created = 0;
			const errors: string[] = [];

			for (const placeName of this.selectedPlaces) {
				try {
					await createPlaceNote(this.app, {
						name: placeName
					}, {
						directory: this.directory,
						openAfterCreate: false
					});
					created++;
				} catch (error) {
					errors.push(`${placeName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
				}
			}

			if (errors.length > 0) {
				console.error('Errors creating place notes:', errors);
				new Notice(`Created ${created} place notes. ${errors.length} failed.`);
			}

			if (this.onComplete) {
				this.onComplete(created);
			}

			this.close();
		} catch (error) {
			console.error('Failed to create place notes:', error);
			new Notice(`Failed to create place notes: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
}
