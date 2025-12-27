/**
 * Create Person Modal
 * Modal for creating or editing person notes with relationship linking
 */

import { App, Modal, Setting, TFile, Notice, normalizePath } from 'obsidian';
import { createPersonNote, updatePersonNote, PersonData, DynamicBlockType } from '../core/person-note-writer';
import { createLucideIcon } from './lucide-icons';
import { FamilyGraphService } from '../core/family-graph';
import { PlaceGraphService } from '../core/place-graph';
import { PersonPickerModal, PersonInfo } from './person-picker';
import { PlacePickerModal, SelectedPlaceInfo } from './place-picker';
import type { CanvasRootsSettings } from '../settings';
import type CanvasRootsPlugin from '../../main';
import { ModalStatePersistence, renderResumePromptBanner } from './modal-state-persistence';
import { ResearchLevel, RESEARCH_LEVELS } from '../types/frontmatter';

/**
 * Relationship field data
 */
interface RelationshipField {
	crId?: string;
	name?: string;
}

/**
 * Form data structure for persistence
 */
interface PersonFormData {
	name: string;
	sex?: string;
	birthDate?: string;
	deathDate?: string;
	occupation?: string;
	researchLevel?: ResearchLevel;
	collection?: string;
	universe?: string;
	directory?: string;
	includeDynamicBlocks?: boolean;
	// Relationship fields
	fatherCrId?: string;
	fatherName?: string;
	motherCrId?: string;
	motherName?: string;
	spouseCrId?: string;
	spouseName?: string;
	stepfatherCrId?: string;
	stepfatherName?: string;
	stepmotherCrId?: string;
	stepmotherName?: string;
	adoptiveFatherCrId?: string;
	adoptiveFatherName?: string;
	adoptiveMotherCrId?: string;
	adoptiveMotherName?: string;
	// Place fields
	birthPlaceCrId?: string;
	birthPlaceName?: string;
	deathPlaceCrId?: string;
	deathPlaceName?: string;
}

/**
 * Modal for creating or editing person notes
 */
export class CreatePersonModal extends Modal {
	private personData: PersonData;
	private directory: string;
	private onCreated?: (file: TFile) => void;
	private onUpdated?: (file: TFile) => void;
	private familyGraph?: FamilyGraphService;
	private existingCollections: string[] = [];
	private existingUniverses: string[] = [];

	// Relationship fields
	private fatherField: RelationshipField = {};
	private motherField: RelationshipField = {};
	private spouseField: RelationshipField = {};
	// Step and adoptive parents
	private stepfatherField: RelationshipField = {};
	private stepmotherField: RelationshipField = {};
	private adoptiveFatherField: RelationshipField = {};
	private adoptiveMotherField: RelationshipField = {};
	// Place fields
	private birthPlaceField: RelationshipField = {};
	private deathPlaceField: RelationshipField = {};
	private placeGraph?: PlaceGraphService;
	private settings?: CanvasRootsSettings;

	// Edit mode properties
	private editMode: boolean = false;
	private editingFile?: TFile;
	private propertyAliases: Record<string, string> = {};
	private includeDynamicBlocks: boolean = true;
	private dynamicBlockTypes: DynamicBlockType[] = ['media', 'timeline', 'relationships'];

	// State persistence
	private plugin?: CanvasRootsPlugin;
	private persistence?: ModalStatePersistence<PersonFormData>;
	private savedSuccessfully: boolean = false;
	private resumeBanner?: HTMLElement;

	constructor(
		app: App,
		options?: {
			directory?: string;
			initialName?: string;
			onCreated?: (file: TFile) => void;
			onUpdated?: (file: TFile) => void;
			familyGraph?: FamilyGraphService;
			propertyAliases?: Record<string, string>;
			includeDynamicBlocks?: boolean;
			dynamicBlockTypes?: DynamicBlockType[];
			// Edit mode options
			editFile?: TFile;
			editPersonData?: {
				crId: string;
				name: string;
				sex?: string;
				gender?: string; // Kept for backwards compatibility
				born?: string;
				died?: string;
				birthPlace?: string;
				deathPlace?: string;
				birthPlaceId?: string;
				birthPlaceName?: string;
				deathPlaceId?: string;
				deathPlaceName?: string;
				occupation?: string;
				researchLevel?: ResearchLevel;
				fatherId?: string;
				fatherName?: string;
				motherId?: string;
				motherName?: string;
				spouseIds?: string[];
				spouseNames?: string[];
				collection?: string;
				universe?: string;
				// Step and adoptive parents
				stepfatherId?: string;
				stepfatherName?: string;
				stepmotherId?: string;
				stepmotherName?: string;
				adoptiveFatherId?: string;
				adoptiveFatherName?: string;
				adoptiveMotherId?: string;
				adoptiveMotherName?: string;
			};
			// Universe options
			existingUniverses?: string[];
			// Place graph for place picker
			placeGraph?: PlaceGraphService;
			settings?: CanvasRootsSettings;
			// Plugin reference for state persistence
			plugin?: CanvasRootsPlugin;
		}
	) {
		super(app);
		this.directory = options?.directory || '';
		this.onCreated = options?.onCreated;
		this.onUpdated = options?.onUpdated;
		this.familyGraph = options?.familyGraph;
		this.propertyAliases = options?.propertyAliases || {};
		this.includeDynamicBlocks = options?.includeDynamicBlocks ?? true;
		this.dynamicBlockTypes = options?.dynamicBlockTypes || ['media', 'timeline', 'relationships'];
		this.existingUniverses = options?.existingUniverses || [];
		this.placeGraph = options?.placeGraph;
		this.settings = options?.settings;
		this.plugin = options?.plugin;

		// Set up persistence (only in create mode)
		if (this.plugin && !options?.editFile) {
			this.persistence = new ModalStatePersistence<PersonFormData>(this.plugin, 'person');
		}

		// Check for edit mode
		if (options?.editFile && options?.editPersonData) {
			this.editMode = true;
			this.editingFile = options.editFile;
			const ep = options.editPersonData;
			this.personData = {
				name: ep.name,
				crId: ep.crId,
				sex: ep.sex || ep.gender, // sex preferred, gender for backwards compatibility
				birthDate: ep.born,
				deathDate: ep.died,
				birthPlace: ep.birthPlace,
				deathPlace: ep.deathPlace,
				occupation: ep.occupation,
				researchLevel: ep.researchLevel,
				collection: ep.collection,
				universe: ep.universe
			};
			// Set up relationship fields
			if (ep.fatherId || ep.fatherName) {
				this.fatherField = { crId: ep.fatherId, name: ep.fatherName };
			}
			if (ep.motherId || ep.motherName) {
				this.motherField = { crId: ep.motherId, name: ep.motherName };
			}
			if ((ep.spouseIds && ep.spouseIds.length > 0) || (ep.spouseNames && ep.spouseNames.length > 0)) {
				// For now, only handle first spouse in the modal
				this.spouseField = {
					crId: ep.spouseIds?.[0],
					name: ep.spouseNames?.[0]
				};
			}
			// Step and adoptive parents
			if (ep.stepfatherId || ep.stepfatherName) {
				this.stepfatherField = { crId: ep.stepfatherId, name: ep.stepfatherName };
			}
			if (ep.stepmotherId || ep.stepmotherName) {
				this.stepmotherField = { crId: ep.stepmotherId, name: ep.stepmotherName };
			}
			if (ep.adoptiveFatherId || ep.adoptiveFatherName) {
				this.adoptiveFatherField = { crId: ep.adoptiveFatherId, name: ep.adoptiveFatherName };
			}
			if (ep.adoptiveMotherId || ep.adoptiveMotherName) {
				this.adoptiveMotherField = { crId: ep.adoptiveMotherId, name: ep.adoptiveMotherName };
			}
			// Place fields
			if (ep.birthPlaceId || ep.birthPlaceName) {
				this.birthPlaceField = { crId: ep.birthPlaceId, name: ep.birthPlaceName };
			}
			if (ep.deathPlaceId || ep.deathPlaceName) {
				this.deathPlaceField = { crId: ep.deathPlaceId, name: ep.deathPlaceName };
			}
			// Get directory from file path
			const pathParts = options.editFile.path.split('/');
			pathParts.pop(); // Remove filename
			this.directory = pathParts.join('/');
		} else {
			this.personData = {
				name: options?.initialName || ''
			};
		}

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
		const icon = createLucideIcon(this.editMode ? 'edit' : 'user-plus', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText(this.editMode ? 'Edit person note' : 'Create person note');

		// Check for persisted state (only in create mode)
		if (this.persistence && !this.editMode) {
			const existingState = this.persistence.getValidState();
			if (existingState) {
				const timeAgo = this.persistence.getTimeAgoString(existingState);
				this.resumeBanner = renderResumePromptBanner(
					contentEl,
					timeAgo,
					() => {
						// Discard - clear state and remove banner
						void this.persistence?.clear();
						this.resumeBanner?.remove();
						this.resumeBanner = undefined;
					},
					() => {
						// Restore - populate form with saved data
						this.restoreFromPersistedState(existingState.formData as unknown as PersonFormData);
						this.resumeBanner?.remove();
						this.resumeBanner = undefined;
						// Re-render form with restored data
						this.renderForm(contentEl);
					}
				);
			}
		}

		// Form container
		this.renderForm(contentEl);
	}

	/**
	 * Render the form fields
	 */
	private renderForm(contentEl: HTMLElement): void {
		// Remove existing form if re-rendering
		const existingForm = contentEl.querySelector('.crc-form');
		if (existingForm) {
			existingForm.remove();
		}
		const existingButtons = contentEl.querySelector('.crc-modal-buttons');
		if (existingButtons) {
			existingButtons.remove();
		}

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

		// Sex
		new Setting(form)
			.setName('Sex')
			.setDesc('Sex (used for relationship terminology and display)')
			.addDropdown(dropdown => dropdown
				.addOption('', '(Unknown)')
				.addOption('male', 'Male')
				.addOption('female', 'Female')
				.addOption('nonbinary', 'Non-binary')
				.setValue(this.personData.sex || '')
				.onChange(value => {
					this.personData.sex = value || undefined;
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

		// Birth place (link field)
		this.createPlaceField(form, 'Birth place', this.birthPlaceField);

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

		// Death place (link field)
		this.createPlaceField(form, 'Death place', this.deathPlaceField);

		// Research level (only shown when Research Tools are enabled)
		if (this.settings?.trackFactSourcing) {
			new Setting(form)
				.setName('Research level')
				.setDesc('Research progress toward GPS-compliant documentation')
				.addDropdown(dropdown => {
					dropdown.addOption('', '(Not assessed)');
					for (const [level, info] of Object.entries(RESEARCH_LEVELS)) {
						dropdown.addOption(level, `${level} - ${info.name}`);
					}
					dropdown
						.setValue(this.personData.researchLevel?.toString() || '')
						.onChange(value => {
							this.personData.researchLevel = value ? parseInt(value) as ResearchLevel : undefined;
						});
				});
		}

		// Relationship fields section header
		const relSection = form.createDiv({ cls: 'crc-relationship-section' });
		relSection.createEl('h4', { text: 'Family relationships', cls: 'crc-section-header' });

		// Father relationship
		this.createRelationshipField(relSection, 'Father', this.fatherField);

		// Mother relationship
		this.createRelationshipField(relSection, 'Mother', this.motherField);

		// Spouse relationship
		this.createRelationshipField(relSection, 'Spouse', this.spouseField);

		// Step and adoptive parents section
		const stepAdoptSection = form.createDiv({ cls: 'crc-relationship-section' });
		stepAdoptSection.createEl('h4', { text: 'Step & adoptive parents (optional)', cls: 'crc-section-header crc-section-header--secondary' });

		// Step-father
		this.createRelationshipField(stepAdoptSection, 'Step-father', this.stepfatherField);

		// Step-mother
		this.createRelationshipField(stepAdoptSection, 'Step-mother', this.stepmotherField);

		// Adoptive father
		this.createRelationshipField(stepAdoptSection, 'Adoptive father', this.adoptiveFatherField);

		// Adoptive mother
		this.createRelationshipField(stepAdoptSection, 'Adoptive mother', this.adoptiveMotherField);

		// Collection - dropdown with existing + text for custom
		const collectionSetting = new Setting(form)
			.setName('Collection')
			.setDesc('User-defined grouping for organizing person notes');

		if (this.existingCollections.length > 0) {
			let customInput: HTMLInputElement | null = null;
			let collectionValue: string | undefined = this.personData.collection;

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
							customInput.removeClass('cr-hidden');
							customInput.focus();
						}
						collectionValue = undefined;
					} else {
						if (customInput) {
							customInput.addClass('cr-hidden');
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
				text.inputEl.addClass('cr-hidden');
				text.inputEl.addClass('crc-input--inline');
			});

			// Store the value getter for use when creating
			this.getCollectionValue = () => collectionValue;
		} else {
			let collectionValue: string | undefined = this.personData.collection;
			collectionSetting.addText(text => text
				.setPlaceholder('e.g., Smith Family')
				.setValue(collectionValue || '')
				.onChange(value => {
					collectionValue = value || undefined;
				}));
			this.getCollectionValue = () => collectionValue;
		}

		// Universe - dropdown with existing + text for custom
		const universeSetting = new Setting(form)
			.setName('Universe')
			.setDesc('Fictional universe or world this person belongs to');

		if (this.existingUniverses.length > 0) {
			let universeCustomInput: HTMLInputElement | null = null;
			let universeValue: string | undefined = this.personData.universe;

			universeSetting.addDropdown(dropdown => {
				dropdown
					.addOption('', '(None)')
					.addOption('__custom__', '+ New universe...');

				for (const univ of this.existingUniverses) {
					dropdown.addOption(univ, univ);
				}

				dropdown.setValue(universeValue || '');
				dropdown.onChange(value => {
					if (value === '__custom__') {
						if (universeCustomInput) {
							universeCustomInput.removeClass('cr-hidden');
							universeCustomInput.focus();
						}
						universeValue = undefined;
					} else {
						if (universeCustomInput) {
							universeCustomInput.addClass('cr-hidden');
							universeCustomInput.value = '';
						}
						universeValue = value || undefined;
					}
				});
			});

			// Add text input for custom universe (hidden by default)
			universeSetting.addText(text => {
				universeCustomInput = text.inputEl;
				text.setPlaceholder('Enter new universe name')
					.onChange(value => {
						universeValue = value || undefined;
					});
				text.inputEl.addClass('cr-hidden');
				text.inputEl.addClass('crc-input--inline');
			});

			// Store the value getter for use when creating
			this.getUniverseValue = () => universeValue;
		} else {
			let universeValue: string | undefined = this.personData.universe;
			universeSetting.addText(text => text
				.setPlaceholder('e.g., westeros, middle-earth')
				.setValue(universeValue || '')
				.onChange(value => {
					universeValue = value || undefined;
				}));
			this.getUniverseValue = () => universeValue;
		}

		// Directory setting (only show in create mode)
		if (!this.editMode) {
			new Setting(form)
				.setName('Directory')
				.setDesc('Where to create the person note')
				.addText(text => text
					.setPlaceholder('e.g., People')
					.setValue(this.directory)
					.onChange(value => {
						this.directory = value;
					}));

			// Dynamic blocks toggle (only in create mode)
			new Setting(form)
				.setName('Include dynamic blocks')
				.setDesc('Add timeline, relationships, and media gallery blocks that update automatically')
				.addToggle(toggle => toggle
					.setValue(this.includeDynamicBlocks)
					.onChange(value => {
						this.includeDynamicBlocks = value;
					}));
		}

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const submitBtn = buttonContainer.createEl('button', {
			text: this.editMode ? 'Save changes' : 'Create person',
			cls: 'crc-btn crc-btn--primary'
		});
		submitBtn.addEventListener('click', () => {
			if (this.editMode) {
				void this.updatePerson();
			} else {
				void this.createPerson();
			}
		});
	}

	onClose() {
		const { contentEl } = this;

		// Persist state if not saved successfully and we have persistence enabled
		if (this.persistence && !this.editMode && !this.savedSuccessfully) {
			const formData = this.gatherFormData();
			if (this.persistence.hasContent(formData)) {
				void this.persistence.persist(formData);
			}
		}

		contentEl.empty();
	}

	/**
	 * Gather current form data for persistence
	 */
	private gatherFormData(): PersonFormData {
		return {
			name: this.personData.name,
			sex: this.personData.sex,
			birthDate: this.personData.birthDate,
			deathDate: this.personData.deathDate,
			occupation: this.personData.occupation,
			researchLevel: this.personData.researchLevel,
			collection: this.getCollectionValue(),
			universe: this.getUniverseValue(),
			directory: this.directory,
			includeDynamicBlocks: this.includeDynamicBlocks,
			// Relationship fields
			fatherCrId: this.fatherField.crId,
			fatherName: this.fatherField.name,
			motherCrId: this.motherField.crId,
			motherName: this.motherField.name,
			spouseCrId: this.spouseField.crId,
			spouseName: this.spouseField.name,
			stepfatherCrId: this.stepfatherField.crId,
			stepfatherName: this.stepfatherField.name,
			stepmotherCrId: this.stepmotherField.crId,
			stepmotherName: this.stepmotherField.name,
			adoptiveFatherCrId: this.adoptiveFatherField.crId,
			adoptiveFatherName: this.adoptiveFatherField.name,
			adoptiveMotherCrId: this.adoptiveMotherField.crId,
			adoptiveMotherName: this.adoptiveMotherField.name,
			// Place fields
			birthPlaceCrId: this.birthPlaceField.crId,
			birthPlaceName: this.birthPlaceField.name,
			deathPlaceCrId: this.deathPlaceField.crId,
			deathPlaceName: this.deathPlaceField.name
		};
	}

	/**
	 * Restore form state from persisted data
	 */
	private restoreFromPersistedState(formData: PersonFormData): void {
		// Basic fields
		this.personData.name = formData.name || '';
		this.personData.sex = formData.sex;
		this.personData.birthDate = formData.birthDate;
		this.personData.deathDate = formData.deathDate;
		this.personData.occupation = formData.occupation;
		this.personData.researchLevel = formData.researchLevel;
		this.personData.collection = formData.collection;
		this.personData.universe = formData.universe;
		if (formData.directory) {
			this.directory = formData.directory;
		}
		if (formData.includeDynamicBlocks !== undefined) {
			this.includeDynamicBlocks = formData.includeDynamicBlocks;
		}

		// Relationship fields
		if (formData.fatherCrId || formData.fatherName) {
			this.fatherField = { crId: formData.fatherCrId, name: formData.fatherName };
		}
		if (formData.motherCrId || formData.motherName) {
			this.motherField = { crId: formData.motherCrId, name: formData.motherName };
		}
		if (formData.spouseCrId || formData.spouseName) {
			this.spouseField = { crId: formData.spouseCrId, name: formData.spouseName };
		}
		if (formData.stepfatherCrId || formData.stepfatherName) {
			this.stepfatherField = { crId: formData.stepfatherCrId, name: formData.stepfatherName };
		}
		if (formData.stepmotherCrId || formData.stepmotherName) {
			this.stepmotherField = { crId: formData.stepmotherCrId, name: formData.stepmotherName };
		}
		if (formData.adoptiveFatherCrId || formData.adoptiveFatherName) {
			this.adoptiveFatherField = { crId: formData.adoptiveFatherCrId, name: formData.adoptiveFatherName };
		}
		if (formData.adoptiveMotherCrId || formData.adoptiveMotherName) {
			this.adoptiveMotherField = { crId: formData.adoptiveMotherCrId, name: formData.adoptiveMotherName };
		}

		// Place fields
		if (formData.birthPlaceCrId || formData.birthPlaceName) {
			this.birthPlaceField = { crId: formData.birthPlaceCrId, name: formData.birthPlaceName };
		}
		if (formData.deathPlaceCrId || formData.deathPlaceName) {
			this.deathPlaceField = { crId: formData.deathPlaceCrId, name: formData.deathPlaceName };
		}
	}

	// Collection value getter (set by collection field setup)
	private getCollectionValue: () => string | undefined = () => undefined;

	// Universe value getter (set by universe field setup)
	private getUniverseValue: () => string | undefined = () => undefined;

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
				btn.buttonEl.addClass('crc-btn', 'crc-btn--secondary');
				if (isLinked) {
					const unlinkIcon = createLucideIcon('unlink', 16);
					btn.buttonEl.appendChild(unlinkIcon);
					btn.buttonEl.appendText(' Unlink');
				} else {
					const linkIcon = createLucideIcon('link', 16);
					btn.buttonEl.appendChild(linkIcon);
					btn.buttonEl.appendText(' Link');
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
	 * Create a place field with link/unlink button
	 */
	private createPlaceField(
		container: HTMLElement,
		label: string,
		fieldData: RelationshipField
	): void {
		const setting = new Setting(container)
			.setName(label)
			.setDesc(fieldData.name ? `Linked to: ${fieldData.name}` : `Click "Link" to select ${label.toLowerCase()}`);

		// Text input (readonly, shows selected place name)
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
				btn.buttonEl.addClass('crc-btn', 'crc-btn--secondary');
				if (isLinked) {
					const unlinkIcon = createLucideIcon('unlink', 16);
					btn.buttonEl.appendChild(unlinkIcon);
					btn.buttonEl.appendText(' Unlink');
				} else {
					const linkIcon = createLucideIcon('map-pin', 16);
					btn.buttonEl.appendChild(linkIcon);
					btn.buttonEl.appendText(' Link');
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
					// Open place picker
					const picker = new PlacePickerModal(this.app, (place: SelectedPlaceInfo) => {
						fieldData.name = place.name;
						fieldData.crId = place.crId;
						inputEl.value = place.name;
						inputEl.addClass('crc-input--linked');
						setting.setDesc(`Linked to: ${place.name}`);
						updateButton(true);
					}, {
						placeGraph: this.placeGraph,
						settings: this.settings,
						directory: this.directory,
						plugin: this.plugin
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

			// Add step-father relationship
			if (this.stepfatherField.crId && this.stepfatherField.name) {
				data.stepfatherCrId = [this.stepfatherField.crId];
				data.stepfatherName = [this.stepfatherField.name];
			}

			// Add step-mother relationship
			if (this.stepmotherField.crId && this.stepmotherField.name) {
				data.stepmotherCrId = [this.stepmotherField.crId];
				data.stepmotherName = [this.stepmotherField.name];
			}

			// Add adoptive father relationship
			if (this.adoptiveFatherField.crId && this.adoptiveFatherField.name) {
				data.adoptiveFatherCrId = this.adoptiveFatherField.crId;
				data.adoptiveFatherName = this.adoptiveFatherField.name;
			}

			// Add adoptive mother relationship
			if (this.adoptiveMotherField.crId && this.adoptiveMotherField.name) {
				data.adoptiveMotherCrId = this.adoptiveMotherField.crId;
				data.adoptiveMotherName = this.adoptiveMotherField.name;
			}

			// Add birth place
			if (this.birthPlaceField.crId && this.birthPlaceField.name) {
				data.birthPlaceCrId = this.birthPlaceField.crId;
				data.birthPlaceName = this.birthPlaceField.name;
			}

			// Add death place
			if (this.deathPlaceField.crId && this.deathPlaceField.name) {
				data.deathPlaceCrId = this.deathPlaceField.crId;
				data.deathPlaceName = this.deathPlaceField.name;
			}

			// Add collection and universe
			data.collection = this.getCollectionValue();
			data.universe = this.getUniverseValue();

			const file = await createPersonNote(this.app, data, {
				directory: this.directory,
				openAfterCreate: true,
				propertyAliases: this.propertyAliases,
				includeDynamicBlocks: this.includeDynamicBlocks,
				dynamicBlockTypes: this.dynamicBlockTypes
			});

			new Notice(`Created person note: ${file.basename}`);

			// Mark as saved successfully and clear persisted state
			this.savedSuccessfully = true;
			if (this.persistence) {
				void this.persistence.clear();
			}

			if (this.onCreated) {
				this.onCreated(file);
			}

			this.close();
		} catch (error) {
			console.error('Failed to create person note:', error);
			new Notice(`Failed to create person note: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Update the existing person note
	 */
	private async updatePerson(): Promise<void> {
		// Validate required fields
		if (!this.personData.name.trim()) {
			new Notice('Please enter a name for the person');
			return;
		}

		if (!this.editingFile) {
			new Notice('No file to update');
			return;
		}

		try {
			// Build person data with relationships
			const data: Partial<PersonData> = {
				name: this.personData.name,
				birthDate: this.personData.birthDate,
				deathDate: this.personData.deathDate,
				sex: this.personData.sex,
				occupation: this.personData.occupation,
				researchLevel: this.personData.researchLevel
			};

			// Add father relationship
			if (this.fatherField.crId || this.fatherField.name) {
				data.fatherCrId = this.fatherField.crId;
				data.fatherName = this.fatherField.name;
			} else {
				// Explicitly clear father if unlinked
				data.fatherCrId = undefined;
				data.fatherName = undefined;
			}

			// Add mother relationship
			if (this.motherField.crId || this.motherField.name) {
				data.motherCrId = this.motherField.crId;
				data.motherName = this.motherField.name;
			} else {
				// Explicitly clear mother if unlinked
				data.motherCrId = undefined;
				data.motherName = undefined;
			}

			// Add spouse relationship
			if (this.spouseField.crId || this.spouseField.name) {
				data.spouseCrId = this.spouseField.crId ? [this.spouseField.crId] : undefined;
				data.spouseName = this.spouseField.name ? [this.spouseField.name] : undefined;
			} else {
				// Explicitly clear spouse if unlinked
				data.spouseCrId = [];
				data.spouseName = [];
			}

			// Add step-father relationship
			if (this.stepfatherField.crId || this.stepfatherField.name) {
				data.stepfatherCrId = this.stepfatherField.crId ? [this.stepfatherField.crId] : undefined;
				data.stepfatherName = this.stepfatherField.name ? [this.stepfatherField.name] : undefined;
			} else {
				data.stepfatherCrId = [];
				data.stepfatherName = [];
			}

			// Add step-mother relationship
			if (this.stepmotherField.crId || this.stepmotherField.name) {
				data.stepmotherCrId = this.stepmotherField.crId ? [this.stepmotherField.crId] : undefined;
				data.stepmotherName = this.stepmotherField.name ? [this.stepmotherField.name] : undefined;
			} else {
				data.stepmotherCrId = [];
				data.stepmotherName = [];
			}

			// Add adoptive father relationship
			if (this.adoptiveFatherField.crId || this.adoptiveFatherField.name) {
				data.adoptiveFatherCrId = this.adoptiveFatherField.crId;
				data.adoptiveFatherName = this.adoptiveFatherField.name;
			} else {
				data.adoptiveFatherCrId = undefined;
				data.adoptiveFatherName = undefined;
			}

			// Add adoptive mother relationship
			if (this.adoptiveMotherField.crId || this.adoptiveMotherField.name) {
				data.adoptiveMotherCrId = this.adoptiveMotherField.crId;
				data.adoptiveMotherName = this.adoptiveMotherField.name;
			} else {
				data.adoptiveMotherCrId = undefined;
				data.adoptiveMotherName = undefined;
			}

			// Add birth place
			if (this.birthPlaceField.crId || this.birthPlaceField.name) {
				data.birthPlaceCrId = this.birthPlaceField.crId;
				data.birthPlaceName = this.birthPlaceField.name;
			} else {
				// Explicitly clear birth place if unlinked
				data.birthPlaceCrId = undefined;
				data.birthPlaceName = undefined;
			}

			// Add death place
			if (this.deathPlaceField.crId || this.deathPlaceField.name) {
				data.deathPlaceCrId = this.deathPlaceField.crId;
				data.deathPlaceName = this.deathPlaceField.name;
			} else {
				// Explicitly clear death place if unlinked
				data.deathPlaceCrId = undefined;
				data.deathPlaceName = undefined;
			}

			// Add collection and universe
			data.collection = this.getCollectionValue();
			data.universe = this.getUniverseValue();

			await updatePersonNote(this.app, this.editingFile, data);

			new Notice(`Updated person note: ${this.editingFile.basename}`);

			if (this.onUpdated) {
				this.onUpdated(this.editingFile);
			}

			this.close();
		} catch (error) {
			console.error('Failed to update person note:', error);
			new Notice(`Failed to update person note: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
}
