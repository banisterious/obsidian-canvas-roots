/**
 * Create Note Modal
 *
 * Modal for creating new note entity files (cr_type: note).
 * Part of Phase 4 Gramps Notes integration.
 */

import { App, Modal, Setting, Notice, TFile, normalizePath, Menu } from 'obsidian';
import type CanvasRootsPlugin from '../../main';
import { generateCrId } from '../core/uuid';
import { ModalStatePersistence, renderResumePromptBanner } from './modal-state-persistence';
import { createLucideIcon } from './lucide-icons';
import { PersonPickerModal, type PersonInfo } from './person-picker';
import { PlacePickerModal, type SelectedPlaceInfo } from './place-picker';
import { SourcePickerModal } from '../sources/ui/source-picker-modal';
import { EventPickerModal } from '../events/ui/event-picker-modal';
import type { SourceNote } from '../sources/types/source-types';
import type { EventNote } from '../events/types/event-types';

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

		// Linked entities section (styled like Sources field)
		const linkedSection = contentEl.createDiv({ cls: 'crc-linked-entities-field' });

		// Header with label and button
		const header = linkedSection.createDiv({ cls: 'crc-linked-entities-field__header' });
		header.createSpan({ cls: 'crc-linked-entities-field__label', text: 'Linked entities' });

		// Add entity button
		const addBtn = header.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-btn--small'
		});
		const addIcon = createLucideIcon('plus', 14);
		addBtn.appendChild(addIcon);
		addBtn.appendText(' Add entity');
		addBtn.addEventListener('click', (e) => this.showEntityPicker(e));

		// Linked entities list
		this.linkedEntitiesContainer = linkedSection.createDiv({ cls: 'crc-linked-entities-field__list' });
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
	 * Show entity type dropdown menu
	 */
	private showEntityPicker(event: MouseEvent): void {
		const menu = new Menu();

		// Person option
		menu.addItem(item => {
			item
				.setTitle('Person')
				.setIcon('user')
				.onClick(() => this.openPersonPicker());
		});

		// Event option
		menu.addItem(item => {
			item
				.setTitle('Event')
				.setIcon('calendar')
				.onClick(() => this.openEventPicker());
		});

		// Place option
		menu.addItem(item => {
			item
				.setTitle('Place')
				.setIcon('map-pin')
				.onClick(() => this.openPlacePicker());
		});

		// Source option
		menu.addItem(item => {
			item
				.setTitle('Source')
				.setIcon('book-open')
				.onClick(() => this.openSourcePicker());
		});

		menu.showAtMouseEvent(event);
	}

	/**
	 * Open person picker modal
	 */
	private openPersonPicker(): void {
		const picker = new PersonPickerModal(
			this.app,
			(person: PersonInfo) => {
				this.addLinkedEntity(person.name, person.file.basename);
			},
			{
				title: 'Link person to note',
				plugin: this.plugin
			}
		);
		picker.open();
	}

	/**
	 * Open event picker modal
	 */
	private openEventPicker(): void {
		const picker = new EventPickerModal(
			this.app,
			this.plugin,
			{
				onSelect: (event: EventNote) => {
					const displayName = event.title || event.file.basename;
					this.addLinkedEntity(displayName, event.file.basename);
				}
			}
		);
		picker.open();
	}

	/**
	 * Open place picker modal
	 */
	private openPlacePicker(): void {
		const picker = new PlacePickerModal(
			this.app,
			(place: SelectedPlaceInfo) => {
				this.addLinkedEntity(place.name, place.file.basename);
			},
			{
				settings: this.plugin.settings,
				plugin: this.plugin
			}
		);
		picker.open();
	}

	/**
	 * Open source picker modal
	 */
	private openSourcePicker(): void {
		const picker = new SourcePickerModal(
			this.app,
			this.plugin,
			{
				onSelect: (source: SourceNote) => {
					// Extract filename from filePath (SourceNote doesn't have file property)
					const filename = source.filePath.split('/').pop()?.replace(/\.md$/, '') || source.title;
					this.addLinkedEntity(source.title, filename);
				}
			}
		);
		picker.open();
	}

	/**
	 * Add a linked entity to the list
	 */
	private addLinkedEntity(displayName: string, filename: string): void {
		const wikilink = `[[${filename}]]`;
		if (!this.linkedEntities.includes(wikilink)) {
			this.linkedEntities.push(wikilink);
			this.renderLinkedEntities();
		}
	}

	/**
	 * Render the list of linked entities
	 */
	private renderLinkedEntities(): void {
		if (!this.linkedEntitiesContainer) return;

		this.linkedEntitiesContainer.empty();

		if (this.linkedEntities.length === 0) {
			const emptyState = this.linkedEntitiesContainer.createDiv({ cls: 'crc-linked-entities-field__empty' });
			emptyState.setText('No entities linked');
			return;
		}

		for (let i = 0; i < this.linkedEntities.length; i++) {
			const entity = this.linkedEntities[i];
			const item = this.linkedEntitiesContainer.createDiv({ cls: 'crc-linked-entities-field__item' });

			// Extract name from wikilink
			const match = entity.match(/\[\[(.+?)(?:\|.+?)?\]\]/);
			const displayName = match ? match[1] : entity;

			item.createSpan({ text: displayName, cls: 'crc-linked-entities-field__name' });

			// Remove button (styled like Sources field)
			const removeBtn = item.createEl('button', {
				cls: 'crc-btn crc-btn--icon crc-btn--danger',
				attr: { 'aria-label': `Remove ${displayName}` }
			});
			const removeIcon = createLucideIcon('x', 14);
			removeBtn.appendChild(removeIcon);
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
			const notesFolder = this.plugin.settings.notesFolder || 'Charted Roots/Notes';
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
