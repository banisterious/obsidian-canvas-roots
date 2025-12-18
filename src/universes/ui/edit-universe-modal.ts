/**
 * Edit Universe Modal
 * Modal for editing existing universe notes
 */

import { App, Modal, Setting, TFile, Notice } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import { createLucideIcon } from '../../ui/lucide-icons';
import type { UniverseInfo, UniverseStatus } from '../types/universe-types';
import { UniverseService } from '../services/universe-service';

/** Available status options */
const STATUS_OPTIONS: Record<UniverseStatus, string> = {
	active: 'Active',
	draft: 'Draft',
	archived: 'Archived'
};

/** Available genre options */
const GENRE_OPTIONS = [
	'',
	'Fantasy',
	'Science Fiction',
	'Historical',
	'Alternate History',
	'Horror',
	'Mystery',
	'Romance',
	'Thriller',
	'Other'
];

/**
 * Modal for editing universe notes
 */
export class EditUniverseModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private universeService: UniverseService;
	private universe: UniverseInfo;
	private file: TFile;
	private onUpdated?: (file: TFile) => void;

	// Form state
	private name: string;
	private description: string;
	private author: string;
	private genre: string;
	private status: UniverseStatus;

	constructor(
		app: App,
		plugin: CanvasRootsPlugin,
		options: {
			universe: UniverseInfo;
			file: TFile;
			onUpdated?: (file: TFile) => void;
		}
	) {
		super(app);
		this.plugin = plugin;
		this.universeService = new UniverseService(plugin);
		this.universe = options.universe;
		this.file = options.file;
		this.onUpdated = options.onUpdated;

		// Initialize form state from universe
		this.name = this.universe.name;
		this.description = this.universe.description || '';
		this.author = this.universe.author || '';
		this.genre = this.universe.genre || '';
		this.status = this.universe.status;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-edit-universe-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('globe', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Edit universe');

		// Form container
		const form = contentEl.createDiv({ cls: 'crc-form' });

		// Name (required)
		new Setting(form)
			.setName('Name')
			.setDesc('The display name for this universe')
			.addText(text => text
				.setPlaceholder('e.g., Middle-earth')
				.setValue(this.name)
				.onChange(value => {
					this.name = value;
				}));

		// Description
		new Setting(form)
			.setName('Description')
			.setDesc('Brief description of the universe')
			.addTextArea(text => {
				text
					.setPlaceholder('A rich fantasy world...')
					.setValue(this.description)
					.onChange(value => {
						this.description = value;
					});
				text.inputEl.rows = 3;
			});

		// Author
		new Setting(form)
			.setName('Author')
			.setDesc('Creator or author of the fictional world')
			.addText(text => text
				.setPlaceholder('e.g., J.R.R. Tolkien')
				.setValue(this.author)
				.onChange(value => {
					this.author = value;
				}));

		// Genre
		new Setting(form)
			.setName('Genre')
			.setDesc('Primary genre of the fictional world')
			.addDropdown(dropdown => {
				for (const genre of GENRE_OPTIONS) {
					dropdown.addOption(genre, genre || 'Not specified');
				}
				dropdown.setValue(this.genre);
				dropdown.onChange(value => {
					this.genre = value;
				});
			});

		// Status
		new Setting(form)
			.setName('Status')
			.setDesc('Current status of this universe')
			.addDropdown(dropdown => {
				for (const [value, label] of Object.entries(STATUS_OPTIONS)) {
					dropdown.addOption(value, label);
				}
				dropdown.setValue(this.status);
				dropdown.onChange((value: UniverseStatus) => {
					this.status = value;
				});
			});

		// Info section
		const info = form.createDiv({ cls: 'crc-modal-info' });
		info.createEl('p', {
			text: `cr_id: ${this.universe.crId}`,
			cls: 'crc-info-text'
		});
		if (this.universe.created) {
			info.createEl('p', {
				text: `Created: ${this.universe.created}`,
				cls: 'crc-info-text'
			});
		}

		// Action buttons
		const actions = contentEl.createDiv({ cls: 'crc-modal-actions' });

		// Cancel button
		const cancelBtn = actions.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn crc-btn-secondary'
		});
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		// Save button
		const saveBtn = actions.createEl('button', {
			text: 'Save changes',
			cls: 'crc-btn crc-btn-primary'
		});
		saveBtn.addEventListener('click', () => {
			void this.save();
		});
	}

	/**
	 * Validate and save changes
	 */
	private async save(): Promise<void> {
		// Validate required fields
		if (!this.name.trim()) {
			new Notice('Name is required');
			return;
		}

		try {
			await this.universeService.updateUniverse(this.file, {
				name: this.name.trim(),
				description: this.description.trim() || undefined,
				author: this.author.trim() || undefined,
				genre: this.genre || undefined,
				status: this.status
			});

			this.close();
			this.onUpdated?.(this.file);
		} catch (error) {
			new Notice(`Failed to update universe: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
