/**
 * Create Note Modal
 *
 * Modal for creating new note entity files (cr_type: note).
 * Part of Phase 4 Gramps Notes integration.
 */

import { App, Modal, Setting, Notice, TFile, normalizePath } from 'obsidian';
import type CanvasRootsPlugin from '../../main';
import { generateCrId } from '../core/uuid';
import { ModalStatePersistence, renderResumePromptBanner } from './modal-state-persistence';

/**
 * Standard note types from Gramps
 */
export const NOTE_TYPES = [
	{ id: 'Research', label: 'Research', description: 'Research findings and notes' },
	{ id: 'Person Note', label: 'Person Note', description: 'Biographical information' },
	{ id: 'Transcript', label: 'Transcript', description: 'Document transcriptions' },
	{ id: 'Source text', label: 'Source text', description: 'Extracted source content' },
	{ id: 'General', label: 'General', description: 'General purpose notes' },
	{ id: 'Custom', label: 'Custom', description: 'User-defined type' }
] as const;

export type NoteType = typeof NOTE_TYPES[number]['id'];

/**
 * Form data structure for persistence
 */
interface NoteFormData {
	title: string;
	noteType: NoteType;
	customType: string;
	isPrivate: boolean;
	linkedEntities: string[];
	content: string;
}

/**
 * Options for opening the note modal
 */
export interface NoteModalOptions {
	/** Callback after successful create */
	onSuccess?: (file: TFile) => void;
	/** Pre-fill linked entity (for "Create linked note" context menu) */
	linkedEntity?: string;
}

/**
 * Modal for creating note entity files
 */
export class CreateNoteModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private onSuccess: (file: TFile) => void;

	// Form fields
	private title: string = '';
	private noteType: NoteType = 'Research';
	private customType: string = '';
	private isPrivate: boolean = false;
	private linkedEntities: string[] = [];
	private content: string = '';

	// UI state
	private linkedEntitiesContainer: HTMLElement | null = null;

	// State persistence
	private persistence: ModalStatePersistence<NoteFormData>;
	private savedSuccessfully: boolean = false;
	private resumeBanner?: HTMLElement;

	constructor(app: App, plugin: CanvasRootsPlugin, options?: NoteModalOptions) {
		super(app);
		this.plugin = plugin;
		this.onSuccess = options?.onSuccess || (() => {});

		// Pre-fill linked entity if provided
		if (options?.linkedEntity) {
			this.linkedEntities = [options.linkedEntity];
		}

		// Set up persistence
		this.persistence = new ModalStatePersistence<NoteFormData>(this.plugin, 'note');
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-create-note-modal');

		contentEl.createEl('h2', { text: 'Create note' });

		// Check for persisted state
		const existingState = this.persistence.getValidState();
		if (existingState) {
			const timeAgo = this.persistence.getTimeAgoString(existingState);
			this.resumeBanner = renderResumePromptBanner(
				contentEl,
				timeAgo,
				() => {
					// Discard - clear state and remove banner
					void this.persistence.clear();
					this.resumeBanner?.remove();
					this.resumeBanner = undefined;
				},
				() => {
					// Restore - populate form with saved data
					this.restoreFromPersistedState(existingState.formData as unknown as NoteFormData);
					this.resumeBanner?.remove();
					this.resumeBanner = undefined;
					// Re-render form with restored data
					contentEl.empty();
					this.onOpen();
				}
			);
		}

		// Title (required)
		new Setting(contentEl)
			.setName('Title')
			.setDesc('Note title (used as filename)')
			.addText(text => text
				.setPlaceholder('e.g., Research on Smith family origins')
				.setValue(this.title)
				.onChange(value => this.title = value));

		// Note type
		new Setting(contentEl)
			.setName('Note type')
			.setDesc('Classification of this note')
			.addDropdown(dropdown => {
				for (const type of NOTE_TYPES) {
					dropdown.addOption(type.id, type.label);
				}
				dropdown.setValue(this.noteType);
				dropdown.onChange(value => {
					this.noteType = value as NoteType;
					// Show/hide custom type field
					this.updateCustomTypeVisibility();
				});
			});

		// Custom type (shown only when "Custom" is selected)
		const customTypeSetting = new Setting(contentEl)
			.setName('Custom type')
			.setDesc('Enter your custom note type')
			.addText(text => text
				.setPlaceholder('e.g., Interview Notes')
				.setValue(this.customType)
				.onChange(value => this.customType = value));
		customTypeSetting.settingEl.addClass('cr-custom-type-setting');
		if (this.noteType !== 'Custom') {
			customTypeSetting.settingEl.addClass('cr-hidden');
		}

		// Privacy toggle
		new Setting(contentEl)
			.setName('Private')
			.setDesc('Mark this note as private')
			.addToggle(toggle => toggle
				.setValue(this.isPrivate)
				.onChange(value => this.isPrivate = value));

		// Linked entities section
		const linkedSection = contentEl.createDiv({ cls: 'cr-linked-entities-section' });
		linkedSection.createEl('h4', { text: 'Linked entities' });
		linkedSection.createEl('p', {
			text: 'Link this note to people, events, places, or sources',
			cls: 'setting-item-description'
		});

		// Add entity button
		const addEntityRow = linkedSection.createDiv({ cls: 'cr-add-entity-row' });
		const addBtn = addEntityRow.createEl('button', { text: 'Add entity link' });
		addBtn.addEventListener('click', () => this.showEntityPicker());

		// Linked entities list
		this.linkedEntitiesContainer = linkedSection.createDiv({ cls: 'cr-linked-entities-list' });
		this.renderLinkedEntities();

		// Content (optional initial content)
		new Setting(contentEl)
			.setName('Initial content')
			.setDesc('Optional starting content for the note')
			.addTextArea(textArea => {
				textArea
					.setPlaceholder('Enter note content...')
					.setValue(this.content)
					.onChange(value => this.content = value);
				textArea.inputEl.rows = 6;
			});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'cr-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const createBtn = buttonContainer.createEl('button', {
			text: 'Create note',
			cls: 'mod-cta'
		});
		createBtn.addEventListener('click', () => void this.createNote());
	}

	onClose() {
		const { contentEl } = this;

		// Persist state if not saved successfully
		if (!this.savedSuccessfully) {
			const formData = this.gatherFormData();
			if (this.persistence.hasContent(formData)) {
				void this.persistence.persist(formData);
			}
		}

		contentEl.empty();
	}

	/**
	 * Update visibility of custom type field
	 */
	private updateCustomTypeVisibility(): void {
		const customSetting = this.contentEl.querySelector('.cr-custom-type-setting');
		if (customSetting) {
			if (this.noteType === 'Custom') {
				customSetting.removeClass('cr-hidden');
			} else {
				customSetting.addClass('cr-hidden');
			}
		}
	}

	/**
	 * Show entity picker for linking
	 */
	private showEntityPicker(): void {
		// Simple text input for now - could be enhanced with fuzzy search modal
		const input = document.createElement('input');
		input.type = 'text';
		input.placeholder = 'Enter entity name (e.g., John Smith)';
		input.className = 'cr-entity-input';

		const dialog = document.createElement('div');
		dialog.className = 'cr-entity-picker-dialog';
		dialog.appendChild(input);

		const addBtn = document.createElement('button');
		addBtn.textContent = 'Add';
		addBtn.addEventListener('click', () => {
			const value = input.value.trim();
			if (value) {
				const wikilink = value.startsWith('[[') ? value : `[[${value}]]`;
				if (!this.linkedEntities.includes(wikilink)) {
					this.linkedEntities.push(wikilink);
					this.renderLinkedEntities();
				}
			}
			dialog.remove();
		});
		dialog.appendChild(addBtn);

		const cancelBtn = document.createElement('button');
		cancelBtn.textContent = 'Cancel';
		cancelBtn.addEventListener('click', () => dialog.remove());
		dialog.appendChild(cancelBtn);

		// Insert after the add button
		const addEntityRow = this.contentEl.querySelector('.cr-add-entity-row');
		if (addEntityRow) {
			addEntityRow.after(dialog);
			input.focus();
		}
	}

	/**
	 * Render the list of linked entities
	 */
	private renderLinkedEntities(): void {
		if (!this.linkedEntitiesContainer) return;

		this.linkedEntitiesContainer.empty();

		if (this.linkedEntities.length === 0) {
			this.linkedEntitiesContainer.createSpan({
				text: 'No linked entities',
				cls: 'crc-text-muted'
			});
			return;
		}

		for (let i = 0; i < this.linkedEntities.length; i++) {
			const entity = this.linkedEntities[i];
			const item = this.linkedEntitiesContainer.createDiv({ cls: 'cr-linked-entity-item' });

			// Extract name from wikilink
			const match = entity.match(/\[\[(.+?)(?:\|.+?)?\]\]/);
			const displayName = match ? match[1] : entity;

			item.createSpan({ text: displayName, cls: 'cr-linked-entity-name' });

			// Remove button
			const removeBtn = item.createEl('button', {
				cls: 'cr-linked-entity-remove clickable-icon',
				attr: { 'aria-label': 'Remove' }
			});
			removeBtn.textContent = '×';
			removeBtn.addEventListener('click', () => {
				this.linkedEntities.splice(i, 1);
				this.renderLinkedEntities();
			});
		}
	}

	/**
	 * Gather current form data for persistence
	 */
	private gatherFormData(): NoteFormData {
		return {
			title: this.title,
			noteType: this.noteType,
			customType: this.customType,
			isPrivate: this.isPrivate,
			linkedEntities: [...this.linkedEntities],
			content: this.content
		};
	}

	/**
	 * Restore form state from persisted data
	 */
	private restoreFromPersistedState(formData: NoteFormData): void {
		this.title = formData.title || '';
		this.noteType = formData.noteType || 'Research';
		this.customType = formData.customType || '';
		this.isPrivate = formData.isPrivate || false;
		this.linkedEntities = formData.linkedEntities ? [...formData.linkedEntities] : [];
		this.content = formData.content || '';
	}

	/**
	 * Get the property name respecting user aliases
	 */
	private getProperty(canonical: string): string {
		const aliases = this.plugin.settings.propertyAliases || {};
		for (const [userProp, canonicalProp] of Object.entries(aliases)) {
			if (canonicalProp === canonical) {
				return userProp;
			}
		}
		return canonical;
	}

	/**
	 * Create the note file
	 */
	private async createNote(): Promise<void> {
		if (!this.title.trim()) {
			new Notice('Please enter a title');
			return;
		}

		try {
			const notesFolder = this.plugin.settings.notesFolder || 'Canvas Roots/Notes';
			const crId = `note_${generateCrId()}`;

			// Determine the note type to use
			const effectiveNoteType = this.noteType === 'Custom' && this.customType.trim()
				? this.customType.trim()
				: this.noteType;

			// Build frontmatter
			const frontmatterLines: string[] = [
				'---',
				`${this.getProperty('cr_type')}: note`,
				`${this.getProperty('cr_id')}: ${crId}`,
				`${this.getProperty('cr_note_type')}: ${effectiveNoteType}`
			];

			if (this.isPrivate) {
				frontmatterLines.push(`${this.getProperty('private')}: true`);
			}

			if (this.linkedEntities.length > 0) {
				frontmatterLines.push('linked_entities:');
				for (const entity of this.linkedEntities) {
					frontmatterLines.push(`  - "${entity}"`);
				}
			}

			frontmatterLines.push('---');

			// Build content
			let fileContent = frontmatterLines.join('\n') + '\n\n';

			if (this.content.trim()) {
				fileContent += this.content.trim();
			}

			// Sanitize filename
			const sanitizedTitle = this.title
				.replace(/[<>:"/\\|?*]/g, '-')
				.replace(/\s+/g, ' ')
				.trim();

			// Check for existing file and add suffix if needed
			let filename = sanitizedTitle;
			let filePath = normalizePath(`${notesFolder}/${filename}.md`);
			let suffix = 1;

			while (this.app.vault.getAbstractFileByPath(filePath)) {
				suffix++;
				filename = `${sanitizedTitle} (${suffix})`;
				filePath = normalizePath(`${notesFolder}/${filename}.md`);
			}

			// Ensure folder exists
			const folder = this.app.vault.getAbstractFileByPath(notesFolder);
			if (!folder) {
				await this.app.vault.createFolder(notesFolder);
			}

			// Create the file
			const file = await this.app.vault.create(filePath, fileContent);

			// Mark as saved successfully and clear persisted state
			this.savedSuccessfully = true;
			void this.persistence.clear();

			// Open the newly created file
			await this.app.workspace.openLinkText(file.path, '');

			new Notice(`Note created: ${filename}`);
			this.close();
			this.onSuccess(file);
		} catch (error) {
			new Notice(`Failed to create note: ${error}`);
		}
	}
}
