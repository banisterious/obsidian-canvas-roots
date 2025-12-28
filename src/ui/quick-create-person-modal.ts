/**
 * Quick Create Person Modal
 * Simplified modal for creating a person inline from another modal (e.g., PersonPickerModal).
 * Designed to be lightweight and single-level (no nested "Create new" options).
 */

import { App, Modal, Setting, Notice, normalizePath } from 'obsidian';
import { createPersonNote, PersonData } from '../core/person-note-writer';
import { generateCrId } from '../core/uuid';
import { createLucideIcon } from './lucide-icons';
import { PersonInfo } from './person-picker';
import type CanvasRootsPlugin from '../../main';

/**
 * Context passed when creating a person inline from a relationship field
 */
export interface RelationshipContext {
	/** The type of relationship being created (e.g., 'father', 'mother', 'spouse') */
	relationshipType: string;
	/** Suggested sex based on relationship type (e.g., 'male' for father) */
	suggestedSex?: 'male' | 'female';
	/** The cr_id of the person being edited (the "parent" person in the modal) */
	parentCrId?: string;
	/** Directory where the new person note should be created */
	directory?: string;
}

/**
 * Options for the QuickCreatePersonModal
 */
export interface QuickCreatePersonModalOptions {
	/** Relationship context from the picker */
	context?: RelationshipContext;
	/** Plugin reference for settings and persistence */
	plugin?: CanvasRootsPlugin;
	/** Callback when a person is successfully created */
	onCreated?: (person: PersonInfo) => void;
}

/**
 * Simplified modal for quick inline person creation.
 *
 * Features:
 * - Minimal form: name (required), sex, birth date
 * - Pre-fills sex based on relationship context (father=male, mother=female)
 * - Creates note and returns PersonInfo to caller
 * - No nested "Create new" options (single-level only)
 */
export class QuickCreatePersonModal extends Modal {
	private name: string = '';
	private nickname: string = '';
	private sex: string = '';
	private birthDate: string = '';
	private directory: string = '';
	private context?: RelationshipContext;
	private plugin?: CanvasRootsPlugin;
	private onCreated?: (person: PersonInfo) => void;

	constructor(app: App, options?: QuickCreatePersonModalOptions) {
		super(app);
		this.context = options?.context;
		this.plugin = options?.plugin;
		this.onCreated = options?.onCreated;

		// Apply defaults from context
		if (this.context) {
			if (this.context.suggestedSex) {
				this.sex = this.context.suggestedSex;
			}
			if (this.context.directory) {
				this.directory = this.context.directory;
			}
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-quick-create-person-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('user-plus', 24);
		titleContainer.appendChild(icon);

		// Title based on context
		const titleText = this.getTitleFromContext();
		titleContainer.appendText(titleText);

		// Subtitle explaining this is inline creation
		if (this.context?.relationshipType) {
			const subtitle = header.createDiv({ cls: 'crc-modal-subtitle' });
			subtitle.setText(`Creating a new ${this.context.relationshipType} to link`);
		}

		// Form
		const form = contentEl.createDiv({ cls: 'crc-form' });

		// Name (required)
		new Setting(form)
			.setName('Name')
			.setDesc('Full name of the person (required)')
			.addText(text => {
				text
					.setPlaceholder('e.g., John Robert Smith')
					.setValue(this.name)
					.onChange(value => {
						this.name = value;
					});
				// Auto-focus the name field
				setTimeout(() => text.inputEl.focus(), 50);
			});

		// Nickname (optional)
		new Setting(form)
			.setName('Nickname')
			.setDesc('Informal name or alias (optional)')
			.addText(text => text
				.setPlaceholder('e.g., Bobby, Gram')
				.setValue(this.nickname)
				.onChange(value => {
					this.nickname = value;
				}));

		// Sex (pre-filled if context provides suggestedSex)
		new Setting(form)
			.setName('Sex')
			.setDesc('Sex (pre-filled based on relationship type)')
			.addDropdown(dropdown => dropdown
				.addOption('', '(Unknown)')
				.addOption('male', 'Male')
				.addOption('female', 'Female')
				.addOption('nonbinary', 'Non-binary')
				.setValue(this.sex)
				.onChange(value => {
					this.sex = value;
				}));

		// Birth date (optional)
		new Setting(form)
			.setName('Birth date')
			.setDesc('Date of birth (optional, YYYY-MM-DD recommended)')
			.addText(text => text
				.setPlaceholder('e.g., 1888-05-15')
				.setValue(this.birthDate)
				.onChange(value => {
					this.birthDate = value;
				}));

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
			text: 'Create and link',
			cls: 'crc-btn crc-btn--primary'
		});
		createBtn.addEventListener('click', () => {
			void this.createPerson();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Get modal title based on relationship context
	 */
	private getTitleFromContext(): string {
		if (!this.context?.relationshipType) {
			return 'Quick create person';
		}

		// Capitalize first letter of relationship type
		const relType = this.context.relationshipType;
		const capitalizedType = relType.charAt(0).toUpperCase() + relType.slice(1);
		return `Create new ${capitalizedType.toLowerCase()}`;
	}

	/**
	 * Create the person note and close the modal
	 */
	private async createPerson(): Promise<void> {
		// Validate required fields
		if (!this.name.trim()) {
			new Notice('Please enter a name for the person');
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

			// Generate cr_id upfront so we have it for the callback
			// (metadataCache may not be updated immediately after file creation)
			const crId = generateCrId();

			// Build person data
			const personData: PersonData = {
				name: this.name.trim(),
				crId: crId
			};

			if (this.nickname) {
				personData.nickname = this.nickname.trim();
			}

			if (this.sex) {
				personData.sex = this.sex;
			}

			if (this.birthDate) {
				personData.birthDate = this.birthDate;
			}

			// Create the note
			const file = await createPersonNote(this.app, personData, {
				directory: this.directory,
				openAfterCreate: false, // Don't open - we're returning to parent modal
				includeDynamicBlocks: true,
				dynamicBlockTypes: ['media', 'timeline', 'relationships']
			});

			// Build PersonInfo to return (use the crId we generated)
			const personInfo: PersonInfo = {
				name: this.name.trim(),
				crId: crId,
				birthDate: this.birthDate || undefined,
				sex: this.sex || undefined,
				file: file
			};

			new Notice(`Created person: ${file.basename}`);

			// Call the onCreated callback
			if (this.onCreated) {
				this.onCreated(personInfo);
			}

			this.close();
		} catch (error) {
			console.error('Failed to create person note:', error);
			new Notice(`Failed to create person: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
}
