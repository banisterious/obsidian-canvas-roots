/**
 * Create Person Modal
 * Modal for creating new person notes with relationship linking
 */

import { App, Modal, Setting, TFile, Notice, normalizePath } from 'obsidian';
import { createPersonNote, PersonData } from '../core/person-note-writer';
import { createLucideIcon } from './lucide-icons';
import { FamilyGraphService } from '../core/family-graph';
import { PersonPickerModal, PersonInfo } from './person-picker';

/**
 * Relationship field data
 */
interface RelationshipField {
	crId?: string;
	name?: string;
}

/**
 * Modal for creating new person notes
 */
export class CreatePersonModal extends Modal {
	private personData: PersonData;
	private directory: string;
	private onCreated?: (file: TFile) => void;
	private familyGraph?: FamilyGraphService;
	private existingCollections: string[] = [];

	// Relationship fields
	private fatherField: RelationshipField = {};
	private motherField: RelationshipField = {};
	private spouseField: RelationshipField = {};

	constructor(
		app: App,
		options?: {
			directory?: string;
			initialName?: string;
			onCreated?: (file: TFile) => void;
			familyGraph?: FamilyGraphService;
		}
	) {
		super(app);
		this.directory = options?.directory || '';
		this.onCreated = options?.onCreated;
		this.familyGraph = options?.familyGraph;
		this.personData = {
			name: options?.initialName || ''
		};

		// Gather existing collections from person notes
		this.loadExistingCollections();
	}

	/**
	 * Load existing collections from person notes
	 */
	private loadExistingCollections(): void {
		const collections = new Set<string>();

		if (this.familyGraph) {
			const userCollections = this.familyGraph.getUserCollections();
			for (const coll of userCollections) {
				collections.add(coll.name);
			}
		}

		// Sort alphabetically
		this.existingCollections = Array.from(collections).sort((a, b) =>
			a.toLowerCase().localeCompare(b.toLowerCase())
		);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-create-person-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('user-plus', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Create person note');

		// Form container
		const form = contentEl.createDiv({ cls: 'crc-form' });

		// Name (required)
		new Setting(form)
			.setName('Name')
			.setDesc('Full name of the person')
			.addText(text => text
				.setPlaceholder('e.g., John Robert Smith')
				.setValue(this.personData.name)
				.onChange(value => {
					this.personData.name = value;
				}));

		// Sex/Gender
		new Setting(form)
			.setName('Sex')
			.setDesc('Biological sex (used for relationship terminology)')
			.addDropdown(dropdown => dropdown
				.addOption('', '(Unknown)')
				.addOption('M', 'Male')
				.addOption('F', 'Female')
				.setValue(this.personData.gender || '')
				.onChange(value => {
					this.personData.gender = value || undefined;
				}));

		// Birth date
		new Setting(form)
			.setName('Birth date')
			.setDesc('Date of birth (YYYY-MM-DD format recommended)')
			.addText(text => text
				.setPlaceholder('e.g., 1888-05-15')
				.setValue(this.personData.birthDate || '')
				.onChange(value => {
					this.personData.birthDate = value || undefined;
				}));

		// Death date
		new Setting(form)
			.setName('Death date')
			.setDesc('Date of death (leave blank if still living)')
			.addText(text => text
				.setPlaceholder('e.g., 1952-08-20')
				.setValue(this.personData.deathDate || '')
				.onChange(value => {
					this.personData.deathDate = value || undefined;
				}));

		// Birth place
		new Setting(form)
			.setName('Birth place')
			.setDesc('Place of birth')
			.addText(text => text
				.setPlaceholder('e.g., London, England')
				.setValue(this.personData.birthPlace || '')
				.onChange(value => {
					this.personData.birthPlace = value || undefined;
				}));

		// Death place
		new Setting(form)
			.setName('Death place')
			.setDesc('Place of death')
			.addText(text => text
				.setPlaceholder('e.g., New York, USA')
				.setValue(this.personData.deathPlace || '')
				.onChange(value => {
					this.personData.deathPlace = value || undefined;
				}));

		// Relationship fields section header
		const relSection = form.createDiv({ cls: 'crc-relationship-section' });
		relSection.createEl('h4', { text: 'Family relationships', cls: 'crc-section-header' });

		// Father relationship
		this.createRelationshipField(relSection, 'Father', this.fatherField);

		// Mother relationship
		this.createRelationshipField(relSection, 'Mother', this.motherField);

		// Spouse relationship
		this.createRelationshipField(relSection, 'Spouse', this.spouseField);

		// Collection - dropdown with existing + text for custom
		const collectionSetting = new Setting(form)
			.setName('Collection')
			.setDesc('User-defined grouping for organizing person notes');

		if (this.existingCollections.length > 0) {
			let customInput: HTMLInputElement | null = null;
			let collectionValue: string | undefined = undefined;

			collectionSetting.addDropdown(dropdown => {
				dropdown
					.addOption('', '(None)')
					.addOption('__custom__', '+ New collection...');

				for (const coll of this.existingCollections) {
					dropdown.addOption(coll, coll);
				}

				dropdown.setValue(collectionValue || '');
				dropdown.onChange(value => {
					if (value === '__custom__') {
						if (customInput) {
							customInput.style.display = 'block';
							customInput.focus();
						}
						collectionValue = undefined;
					} else {
						if (customInput) {
							customInput.style.display = 'none';
							customInput.value = '';
						}
						collectionValue = value || undefined;
					}
				});
			});

			// Add text input for custom collection (hidden by default)
			collectionSetting.addText(text => {
				customInput = text.inputEl;
				text.setPlaceholder('Enter new collection name')
					.onChange(value => {
						collectionValue = value || undefined;
					});
				text.inputEl.style.display = 'none';
				text.inputEl.style.marginLeft = '8px';
			});

			// Store the value getter for use when creating
			this.getCollectionValue = () => collectionValue;
		} else {
			let collectionValue: string | undefined = undefined;
			collectionSetting.addText(text => text
				.setPlaceholder('e.g., Smith Family')
				.onChange(value => {
					collectionValue = value || undefined;
				}));
			this.getCollectionValue = () => collectionValue;
		}

		// Directory setting
		new Setting(form)
			.setName('Directory')
			.setDesc('Where to create the person note')
			.addText(text => text
				.setPlaceholder('e.g., People')
				.setValue(this.directory)
				.onChange(value => {
					this.directory = value;
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
			text: 'Create person',
			cls: 'crc-btn crc-btn--primary'
		});
		createBtn.addEventListener('click', async () => {
			await this.createPerson();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	// Collection value getter (set by collection field setup)
	private getCollectionValue: () => string | undefined = () => undefined;

	/**
	 * Create a relationship field with link/unlink button
	 */
	private createRelationshipField(
		container: HTMLElement,
		label: string,
		fieldData: RelationshipField
	): void {
		const setting = new Setting(container)
			.setName(label)
			.setDesc(fieldData.name ? `Linked to: ${fieldData.name}` : `Click "Link" to select ${label.toLowerCase()}`);

		// Text input (readonly, shows selected person name)
		let inputEl: HTMLInputElement;

		setting.addText(text => {
			inputEl = text.inputEl;
			text.setPlaceholder(`Click "Link" to select ${label.toLowerCase()}`)
				.setValue(fieldData.name || '');
			text.inputEl.readOnly = true;
			if (fieldData.name) {
				text.inputEl.addClass('crc-input--linked');
			}
		});

		// Link/Unlink button
		setting.addButton(btn => {
			const updateButton = (isLinked: boolean) => {
				btn.buttonEl.empty();
				if (isLinked) {
					const unlinkIcon = createLucideIcon('unlink', 16);
					btn.buttonEl.appendChild(unlinkIcon);
					btn.buttonEl.appendText(' Unlink');
					btn.setClass('crc-btn crc-btn--secondary');
				} else {
					const linkIcon = createLucideIcon('link', 16);
					btn.buttonEl.appendChild(linkIcon);
					btn.buttonEl.appendText(' Link');
					btn.setClass('crc-btn crc-btn--secondary');
				}
			};

			updateButton(!!fieldData.name);

			btn.onClick(() => {
				if (fieldData.name) {
					// Unlink
					fieldData.crId = undefined;
					fieldData.name = undefined;
					inputEl.value = '';
					inputEl.removeClass('crc-input--linked');
					setting.setDesc(`Click "Link" to select ${label.toLowerCase()}`);
					updateButton(false);
				} else {
					// Open person picker
					const picker = new PersonPickerModal(this.app, (person: PersonInfo) => {
						fieldData.name = person.name;
						fieldData.crId = person.crId;
						inputEl.value = person.name;
						inputEl.addClass('crc-input--linked');
						setting.setDesc(`Linked to: ${person.name}`);
						updateButton(true);
					});
					picker.open();
				}
			});
		});
	}

	/**
	 * Create the person note
	 */
	private async createPerson(): Promise<void> {
		// Validate required fields
		if (!this.personData.name.trim()) {
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

			// Build person data with relationships
			const data: PersonData = {
				...this.personData
			};

			// Add father relationship
			if (this.fatherField.crId && this.fatherField.name) {
				data.fatherCrId = this.fatherField.crId;
				data.fatherName = this.fatherField.name;
			}

			// Add mother relationship
			if (this.motherField.crId && this.motherField.name) {
				data.motherCrId = this.motherField.crId;
				data.motherName = this.motherField.name;
			}

			// Add spouse relationship
			if (this.spouseField.crId && this.spouseField.name) {
				data.spouseCrId = [this.spouseField.crId];
				data.spouseName = [this.spouseField.name];
			}

			// Get collection value from the closure
			const collection = this.getCollectionValue();
			// Note: PersonData doesn't have a collection field yet
			// This would need to be added to person-note-writer.ts if needed

			const file = await createPersonNote(this.app, data, {
				directory: this.directory,
				openAfterCreate: true
			});

			new Notice(`Created person note: ${file.basename}`);

			if (this.onCreated) {
				this.onCreated(file);
			}

			this.close();
		} catch (error) {
			console.error('Failed to create person note:', error);
			new Notice(`Failed to create person note: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
}
