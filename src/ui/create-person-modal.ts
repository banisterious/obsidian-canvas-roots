/**
 * Create Person Modal
 * Modal for creating or editing person notes with relationship linking
 */

import { App, Modal, Setting, TFile, Notice, normalizePath } from 'obsidian';
import { createPersonNote, updatePersonNote, PersonData, DynamicBlockType, addBidirectionalSpouseLink, addChildToParent, addParentToChild } from '../core/person-note-writer';
import { RelationshipManager } from '../core/relationship-manager';
import { createLucideIcon } from './lucide-icons';
import { FamilyGraphService } from '../core/family-graph';
import { PlaceGraphService } from '../core/place-graph';
import { PersonPickerModal, PersonInfo } from './person-picker';
import { PlacePickerModal, SelectedPlaceInfo } from './place-picker';
import { RelationshipContext } from './quick-create-person-modal';
import type { CanvasRootsSettings } from '../settings';
import type CanvasRootsPlugin from '../../main';
import { ModalStatePersistence, renderResumePromptBanner } from './modal-state-persistence';
import { ResearchLevel, RESEARCH_LEVELS } from '../types/frontmatter';
import { SourcePickerModal } from '../sources/ui/source-picker-modal';
import { CreateSourceModal } from '../sources/ui/create-source-modal';
import { SourceService } from '../sources/services/source-service';
import type { EventNote } from '../events/types/event-types';
import { getEventType } from '../events/types/event-types';
import { EventPickerModal } from '../events/ui/event-picker-modal';
import { CreateEventModal } from '../events/ui/create-event-modal';
import { getSourceType } from '../sources/types/source-types';

/**
 * Relationship field data
 */
interface RelationshipField {
	crId?: string;
	name?: string;
}

/**
 * Multi-relationship field data (for children)
 */
interface MultiRelationshipField {
	crIds: string[];
	names: string[];
}

/**
 * Form data structure for persistence
 */
interface PersonFormData {
	name?: string;
	sex?: string;
	pronouns?: string;
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
	// Spouses (multi-relationship)
	spouseCrIds?: string[];
	spouseNames?: string[];
	stepfatherCrId?: string;
	stepfatherName?: string;
	stepmotherCrId?: string;
	stepmotherName?: string;
	adoptiveFatherCrId?: string;
	adoptiveFatherName?: string;
	adoptiveMotherCrId?: string;
	adoptiveMotherName?: string;
	// Gender-neutral parents (multi-relationship)
	parentCrIds?: string[];
	parentNames?: string[];
	// Children fields
	childCrIds?: string[];
	childNames?: string[];
	// Place fields
	birthPlaceCrId?: string;
	birthPlaceName?: string;
	deathPlaceCrId?: string;
	deathPlaceName?: string;
	// Sources fields
	sourceCrIds?: string[];
	sourceNames?: string[];
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
	// Spouses (multi-relationship)
	private spousesField: MultiRelationshipField = { crIds: [], names: [] };
	// Step and adoptive parents
	private stepfatherField: RelationshipField = {};
	private stepmotherField: RelationshipField = {};
	private adoptiveFatherField: RelationshipField = {};
	private adoptiveMotherField: RelationshipField = {};
	// Gender-neutral parents (multi-relationship)
	private parentsField: MultiRelationshipField = { crIds: [], names: [] };
	// Children (multi-relationship)
	private childrenField: MultiRelationshipField = { crIds: [], names: [] };
	// Place fields
	private birthPlaceField: RelationshipField = {};
	private deathPlaceField: RelationshipField = {};
	private placeGraph?: PlaceGraphService;
	private settings?: CanvasRootsSettings;
	// Sources field (multi-relationship)
	private sourcesField: MultiRelationshipField = { crIds: [], names: [] };

	// Edit mode properties
	private editMode: boolean = false;
	private editingFile?: TFile;
	private originalName?: string; // Store original name for rename detection
	private propertyAliases: Record<string, string> = {};
	private includeDynamicBlocks: boolean = true;
	private dynamicBlockTypes: DynamicBlockType[] = ['media', 'timeline', 'relationships'];

	// State persistence
	private plugin?: CanvasRootsPlugin;
	private persistence?: ModalStatePersistence<PersonFormData>;
	private savedSuccessfully: boolean = false;
	private resumeBanner?: HTMLElement;

	// Post-create state (for "Add Another" flow)
	private createdFile?: TFile;
	private createdPersonCrId?: string;
	private createdPersonName?: string;

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
				pronouns?: string;
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
				cr_living?: boolean;
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
				// Gender-neutral parents
				parentIds?: string[];
				parentNames?: string[];
				// Children
				childIds?: string[];
				childNames?: string[];
				// Sources
				sourceIds?: string[];
				sourceNames?: string[];
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
			this.originalName = options.editPersonData.name; // Store for rename detection
			const ep = options.editPersonData;
			this.personData = {
				name: ep.name,
				crId: ep.crId,
				sex: ep.sex || ep.gender, // sex preferred, gender for backwards compatibility
				pronouns: ep.pronouns,
				birthDate: ep.born,
				deathDate: ep.died,
				birthPlace: ep.birthPlace,
				deathPlace: ep.deathPlace,
				occupation: ep.occupation,
				researchLevel: ep.researchLevel,
				cr_living: ep.cr_living,
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
			// Spouses (multi-relationship)
			if (ep.spouseIds && ep.spouseIds.length > 0) {
				this.spousesField = {
					crIds: [...ep.spouseIds],
					names: ep.spouseNames ? [...ep.spouseNames] : []
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
			// Gender-neutral parents
			if (ep.parentIds && ep.parentIds.length > 0) {
				this.parentsField = {
					crIds: [...ep.parentIds],
					names: ep.parentNames ? [...ep.parentNames] : []
				};
			}
			// Children
			if (ep.childIds && ep.childIds.length > 0) {
				this.childrenField = {
					crIds: [...ep.childIds],
					names: ep.childNames ? [...ep.childNames] : []
				};
			}
			// Sources
			if (ep.sourceIds && ep.sourceIds.length > 0) {
				this.sourcesField = {
					crIds: [...ep.sourceIds],
					names: ep.sourceNames ? [...ep.sourceNames] : []
				};
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
				.setValue(this.personData.name || '')
				.onChange(value => {
					this.personData.name = value;
				}));

		// Nickname (optional)
		new Setting(form)
			.setName('Nickname')
			.setDesc('Informal name or alias (optional)')
			.addText(text => text
				.setPlaceholder('e.g., Bobby, Gram')
				.setValue(this.personData.nickname || '')
				.onChange(value => {
					this.personData.nickname = value || undefined;
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

		// Pronouns
		new Setting(form)
			.setName('Pronouns')
			.setDesc('Pronouns for the person (optional)')
			.addText(text => text
				.setPlaceholder('e.g., she/her, they/them')
				.setValue(this.personData.pronouns || '')
				.onChange(value => {
					this.personData.pronouns = value || undefined;
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

		// Living status override (only in edit mode, when privacy protection is enabled)
		if (this.editMode && this.settings?.enablePrivacyProtection) {
			new Setting(form)
				.setName('Living status override')
				.setDesc('Override automatic living/deceased detection for privacy protection in exports')
				.addDropdown(dropdown => {
					dropdown
						.addOption('', '(Automatic)')
						.addOption('true', 'Living (protected)')
						.addOption('false', 'Deceased (not protected)')
						.setValue(this.personData.cr_living === undefined ? '' : String(this.personData.cr_living))
						.onChange(value => {
							if (value === '') {
								this.personData.cr_living = undefined;
							} else {
								this.personData.cr_living = value === 'true';
							}
						});
				});
		}

		// Events section (only in edit mode - events link TO persons, not FROM them)
		if (this.editMode) {
			this.createEventsField(form);
		}

		// Sources section
		this.createSourcesField(form);

		// Relationship fields section header
		const relSection = form.createDiv({ cls: 'crc-relationship-section' });
		relSection.createEl('h4', { text: 'Family relationships', cls: 'crc-section-header' });

		// Father relationship
		this.createRelationshipField(relSection, 'Father', this.fatherField);

		// Mother relationship
		this.createRelationshipField(relSection, 'Mother', this.motherField);

		// Spouses section (multi-select, shown in edit mode or if spouses exist)
		if (this.editMode || this.spousesField.crIds.length > 0) {
			this.createSpousesField(relSection);
		} else {
			// In create mode with no spouses, show single spouse picker for simplicity
			this.createSingleSpouseField(relSection);
		}

		// Children section (only in edit mode or if children already exist)
		if (this.editMode || this.childrenField.crIds.length > 0) {
			this.createChildrenField(relSection);
		}

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

		// Gender-neutral parents (only shown if enabled in settings)
		if (this.plugin?.settings.enableInclusiveParents) {
			const parentsLabel = this.plugin.settings.parentFieldLabel || 'Parents';
			this.createParentsField(stepAdoptSection, parentsLabel);
		}

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
			pronouns: this.personData.pronouns,
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
			// Spouses (multi-relationship)
			spouseCrIds: this.spousesField.crIds.length > 0 ? [...this.spousesField.crIds] : undefined,
			spouseNames: this.spousesField.names.length > 0 ? [...this.spousesField.names] : undefined,
			stepfatherCrId: this.stepfatherField.crId,
			stepfatherName: this.stepfatherField.name,
			stepmotherCrId: this.stepmotherField.crId,
			stepmotherName: this.stepmotherField.name,
			adoptiveFatherCrId: this.adoptiveFatherField.crId,
			adoptiveFatherName: this.adoptiveFatherField.name,
			adoptiveMotherCrId: this.adoptiveMotherField.crId,
			adoptiveMotherName: this.adoptiveMotherField.name,
			// Gender-neutral parents
			parentCrIds: this.parentsField.crIds.length > 0 ? [...this.parentsField.crIds] : undefined,
			parentNames: this.parentsField.names.length > 0 ? [...this.parentsField.names] : undefined,
			// Children fields
			childCrIds: this.childrenField.crIds.length > 0 ? [...this.childrenField.crIds] : undefined,
			childNames: this.childrenField.names.length > 0 ? [...this.childrenField.names] : undefined,
			// Place fields
			birthPlaceCrId: this.birthPlaceField.crId,
			birthPlaceName: this.birthPlaceField.name,
			deathPlaceCrId: this.deathPlaceField.crId,
			deathPlaceName: this.deathPlaceField.name,
			// Sources fields
			sourceCrIds: this.sourcesField.crIds.length > 0 ? [...this.sourcesField.crIds] : undefined,
			sourceNames: this.sourcesField.names.length > 0 ? [...this.sourcesField.names] : undefined
		};
	}

	/**
	 * Restore form state from persisted data
	 */
	private restoreFromPersistedState(formData: PersonFormData): void {
		// Basic fields
		this.personData.name = formData.name || '';
		this.personData.sex = formData.sex;
		this.personData.pronouns = formData.pronouns;
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
		// Spouses (multi-relationship)
		if (formData.spouseCrIds && formData.spouseCrIds.length > 0) {
			this.spousesField = {
				crIds: [...formData.spouseCrIds],
				names: formData.spouseNames ? [...formData.spouseNames] : []
			};
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

		// Gender-neutral parents
		if (formData.parentCrIds && formData.parentCrIds.length > 0) {
			this.parentsField = {
				crIds: [...formData.parentCrIds],
				names: formData.parentNames ? [...formData.parentNames] : []
			};
		}

		// Children fields
		if (formData.childCrIds && formData.childCrIds.length > 0) {
			this.childrenField = {
				crIds: [...formData.childCrIds],
				names: formData.childNames ? [...formData.childNames] : []
			};
		}

		// Sources fields
		if (formData.sourceCrIds && formData.sourceCrIds.length > 0) {
			this.sourcesField = {
				crIds: [...formData.sourceCrIds],
				names: formData.sourceNames ? [...formData.sourceNames] : []
			};
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
					// Build relationship context for inline creation
					const createContext = this.buildRelationshipContext(label);

					// Open person picker with inline creation support
					const picker = new PersonPickerModal(this.app, (person: PersonInfo) => {
						fieldData.name = person.name;
						fieldData.crId = person.crId;
						inputEl.value = person.name;
						inputEl.addClass('crc-input--linked');
						setting.setDesc(`Linked to: ${person.name}`);
						updateButton(true);
					}, {
						title: `Select ${label.toLowerCase()}`,
						createContext: createContext,
						onCreateNew: () => {
							// This callback is called when user clicks "Create new"
							// The picker handles opening QuickCreatePersonModal internally
						},
						plugin: this.plugin
					});
					picker.open();
				}
			});
		});
	}

	/**
	 * Build relationship context for inline person creation
	 * Maps field labels to suggested sex values
	 */
	private buildRelationshipContext(label: string): RelationshipContext {
		const labelLower = label.toLowerCase();

		// Determine suggested sex based on relationship type
		let suggestedSex: 'male' | 'female' | undefined;
		if (labelLower.includes('father')) {
			suggestedSex = 'male';
		} else if (labelLower.includes('mother')) {
			suggestedSex = 'female';
		}
		// Spouse has no suggested sex

		return {
			relationshipType: label.toLowerCase(),
			suggestedSex,
			parentCrId: this.personData.crId,
			directory: this.directory
		};
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
	 * Create the children multi-select field
	 * Shows a list of currently linked children with ability to add/remove
	 */
	private createChildrenField(container: HTMLElement): void {
		const childrenContainer = container.createDiv({ cls: 'crc-children-field' });

		// Header with label and add button
		const header = childrenContainer.createDiv({ cls: 'crc-children-field__header' });
		header.createSpan({ cls: 'crc-children-field__label', text: 'Children' });

		const addBtn = header.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-btn--small'
		});
		const addIcon = createLucideIcon('plus', 14);
		addBtn.appendChild(addIcon);
		addBtn.appendText(' Add child');

		// List of current children
		const childList = childrenContainer.createDiv({ cls: 'crc-children-field__list' });

		// Render function to update the list
		const renderChildList = () => {
			childList.empty();

			if (this.childrenField.crIds.length === 0) {
				const emptyState = childList.createDiv({ cls: 'crc-children-field__empty' });
				emptyState.setText('No children linked');
				return;
			}

			for (let i = 0; i < this.childrenField.crIds.length; i++) {
				const crId = this.childrenField.crIds[i];
				const name = this.childrenField.names[i] || crId;

				const childItem = childList.createDiv({ cls: 'crc-children-field__item' });

				// Child name
				const nameSpan = childItem.createSpan({ cls: 'crc-children-field__name' });
				nameSpan.setText(name);

				// Remove button
				const removeBtn = childItem.createEl('button', {
					cls: 'crc-btn crc-btn--icon crc-btn--danger',
					attr: { 'aria-label': `Remove ${name}` }
				});
				const removeIcon = createLucideIcon('x', 14);
				removeBtn.appendChild(removeIcon);

				removeBtn.addEventListener('click', () => {
					// Remove from arrays
					this.childrenField.crIds.splice(i, 1);
					this.childrenField.names.splice(i, 1);
					renderChildList();
				});
			}
		};

		// Initial render
		renderChildList();

		// Add button handler
		addBtn.addEventListener('click', () => {
			// Build context for inline creation - suggest child relationship
			const createContext: RelationshipContext = {
				relationshipType: 'child',
				parentCrId: this.personData.crId,
				directory: this.directory
			};

			const picker = new PersonPickerModal(this.app, (person: PersonInfo) => {
				// Check if already added
				if (this.childrenField.crIds.includes(person.crId)) {
					new Notice(`${person.name} is already linked as a child`);
					return;
				}

				// Add to arrays
				this.childrenField.crIds.push(person.crId);
				this.childrenField.names.push(person.name);
				renderChildList();
			}, {
				title: 'Select child',
				subtitle: 'Select an existing person or create a new one',
				createContext: createContext,
				onCreateNew: () => {
					// This callback signals inline creation support
				},
				plugin: this.plugin
			});
			picker.open();
		});
	}

	/**
	 * Create the gender-neutral parents multi-select field
	 * Shows a list of currently linked parents with ability to add/remove
	 */
	private createParentsField(container: HTMLElement, label: string): void {
		const parentsContainer = container.createDiv({ cls: 'crc-children-field' });

		// Header with label and add button
		const header = parentsContainer.createDiv({ cls: 'crc-children-field__header' });
		header.createSpan({ cls: 'crc-children-field__label', text: label });

		const addBtn = header.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-btn--small'
		});
		const addIcon = createLucideIcon('plus', 14);
		addBtn.appendChild(addIcon);
		addBtn.appendText(` Add ${label.toLowerCase().replace(/s$/, '')}`); // "Add parent" from "Parents"

		// List of current parents
		const parentList = parentsContainer.createDiv({ cls: 'crc-children-field__list' });

		// Render function to update the list
		const renderParentList = () => {
			parentList.empty();

			if (this.parentsField.crIds.length === 0) {
				const emptyState = parentList.createDiv({ cls: 'crc-children-field__empty' });
				emptyState.setText(`No ${label.toLowerCase()} linked`);
				return;
			}

			for (let i = 0; i < this.parentsField.crIds.length; i++) {
				const crId = this.parentsField.crIds[i];
				const name = this.parentsField.names[i] || crId;

				const parentItem = parentList.createDiv({ cls: 'crc-children-field__item' });

				// Parent name
				const nameSpan = parentItem.createSpan({ cls: 'crc-children-field__name' });
				nameSpan.setText(name);

				// Remove button
				const removeBtn = parentItem.createEl('button', {
					cls: 'crc-btn crc-btn--icon crc-btn--danger',
					attr: { 'aria-label': `Remove ${name}` }
				});
				const removeIcon = createLucideIcon('x', 14);
				removeBtn.appendChild(removeIcon);

				removeBtn.addEventListener('click', () => {
					// Remove from arrays
					this.parentsField.crIds.splice(i, 1);
					this.parentsField.names.splice(i, 1);
					renderParentList();
				});
			}
		};

		// Initial render
		renderParentList();

		// Add button handler
		addBtn.addEventListener('click', () => {
			// Build context for inline creation - no suggested sex for gender-neutral parents
			const createContext: RelationshipContext = {
				relationshipType: label.toLowerCase().replace(/s$/, ''), // "parent" from "Parents"
				parentCrId: undefined, // Not applicable for parent relationship
				directory: this.directory
			};

			const picker = new PersonPickerModal(this.app, (person: PersonInfo) => {
				// Check if already added
				if (this.parentsField.crIds.includes(person.crId)) {
					new Notice(`${person.name} is already linked as a ${label.toLowerCase().replace(/s$/, '')}`);
					return;
				}

				// Add to arrays
				this.parentsField.crIds.push(person.crId);
				this.parentsField.names.push(person.name);
				renderParentList();
			}, {
				title: `Select ${label.toLowerCase().replace(/s$/, '')}`,
				subtitle: 'Select an existing person or create a new one',
				createContext: createContext,
				onCreateNew: () => {
					// This callback signals inline creation support
				},
				plugin: this.plugin
			});
			picker.open();
		});
	}

	/**
	 * Create the sources multi-select field
	 * Shows a list of currently linked sources with ability to add/remove
	 */
	private createSourcesField(container: HTMLElement): void {
		const sourcesContainer = container.createDiv({ cls: 'crc-sources-field' });

		// Header with label and buttons
		const header = sourcesContainer.createDiv({ cls: 'crc-sources-field__header' });
		header.createSpan({ cls: 'crc-sources-field__label', text: 'Sources' });

		// Button container for multiple buttons (matching Events pattern)
		const buttonContainer = header.createDiv({ cls: 'crc-sources-field__buttons' });

		const linkBtn = buttonContainer.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-btn--small'
		});
		const linkIcon = createLucideIcon('link', 14);
		linkBtn.appendChild(linkIcon);
		linkBtn.appendText(' Link');

		const createBtn = buttonContainer.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-btn--small'
		});
		const createIcon = createLucideIcon('plus', 14);
		createBtn.appendChild(createIcon);
		createBtn.appendText(' Create');

		// List of current sources
		const sourceList = sourcesContainer.createDiv({ cls: 'crc-sources-field__list' });

		// Render function to update the list
		const renderSourceList = () => {
			sourceList.empty();

			if (this.sourcesField.crIds.length === 0) {
				const emptyState = sourceList.createDiv({ cls: 'crc-sources-field__empty' });
				emptyState.setText('No sources linked');
				return;
			}

			// Get source service for type lookup
			const sourceService = this.plugin ? new SourceService(this.app, this.plugin.settings) : null;

			for (let i = 0; i < this.sourcesField.crIds.length; i++) {
				const crId = this.sourcesField.crIds[i];
				const name = this.sourcesField.names[i] || crId;

				const sourceItem = sourceList.createDiv({ cls: 'crc-sources-field__item' });

				// Source info container
				const infoContainer = sourceItem.createDiv({ cls: 'crc-sources-field__info' });

				// Source name
				const nameSpan = infoContainer.createSpan({ cls: 'crc-sources-field__name' });
				nameSpan.setText(name);

				// Source type badge (if we can look it up)
				if (sourceService && this.plugin) {
					const source = sourceService.getSourceById(crId);
					if (source?.sourceType) {
						const typeDef = getSourceType(
							source.sourceType,
							this.plugin.settings.customSourceTypes,
							this.plugin.settings.showBuiltInSourceTypes
						);
						const typeBadge = infoContainer.createSpan({ cls: 'crc-sources-field__type' });
						if (typeDef) {
							typeBadge.setText(typeDef.name);
							if (typeDef.color) {
								typeBadge.style.setProperty('background-color', typeDef.color);
								typeBadge.style.setProperty('color', this.getContrastColor(typeDef.color));
							}
						} else {
							typeBadge.setText(source.sourceType);
						}
					}
				}

				// Remove button
				const removeBtn = sourceItem.createEl('button', {
					cls: 'crc-btn crc-btn--icon crc-btn--danger',
					attr: { 'aria-label': `Remove ${name}` }
				});
				const removeIcon = createLucideIcon('x', 14);
				removeBtn.appendChild(removeIcon);

				removeBtn.addEventListener('click', () => {
					// Remove from arrays
					this.sourcesField.crIds.splice(i, 1);
					this.sourcesField.names.splice(i, 1);
					renderSourceList();
				});
			}
		};

		// Initial render
		renderSourceList();

		// Link button handler - open source picker
		linkBtn.addEventListener('click', () => {
			if (!this.plugin) {
				new Notice('Plugin not available');
				return;
			}

			new SourcePickerModal(this.app, this.plugin, {
				onSelect: (source) => {
					// Check if already added
					if (this.sourcesField.crIds.includes(source.crId)) {
						new Notice(`${source.title} is already linked as a source`);
						return;
					}

					// Add to arrays
					this.sourcesField.crIds.push(source.crId);
					this.sourcesField.names.push(source.title);
					renderSourceList();
				},
				excludeSources: this.sourcesField.crIds,
				allowCreate: false  // Don't show create button in picker since we have separate Create button
			}).open();
		});

		// Create button handler - open create source modal
		createBtn.addEventListener('click', () => {
			if (!this.plugin) {
				new Notice('Plugin not available');
				return;
			}

			new CreateSourceModal(this.app, this.plugin, {
				onSuccess: (file) => {
					// After creating, get the source and add it to the list
					if (file) {
						const sourceService = new SourceService(this.app, this.plugin!.settings);
						const source = sourceService.getSourceByPath(file.path);
						if (source) {
							// Check if already added (shouldn't happen but safety check)
							if (!this.sourcesField.crIds.includes(source.crId)) {
								this.sourcesField.crIds.push(source.crId);
								this.sourcesField.names.push(source.title);
								renderSourceList();
							}
						}
					}
				}
			}).open();
		});
	}

	/**
	 * Create the events field
	 * Shows events that reference this person and allows linking new events
	 */
	private createEventsField(container: HTMLElement): void {
		const eventsContainer = container.createDiv({ cls: 'crc-events-field' });

		// Header with label and add button
		const header = eventsContainer.createDiv({ cls: 'crc-events-field__header' });
		header.createSpan({ cls: 'crc-events-field__label', text: 'Events' });

		// Button container for multiple buttons
		const buttonContainer = header.createDiv({ cls: 'crc-events-field__buttons' });

		const linkBtn = buttonContainer.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-btn--small'
		});
		const linkIcon = createLucideIcon('link', 14);
		linkBtn.appendChild(linkIcon);
		linkBtn.appendText(' Link');

		const createBtn = buttonContainer.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-btn--small'
		});
		const createIcon = createLucideIcon('plus', 14);
		createBtn.appendChild(createIcon);
		createBtn.appendText(' Create');

		// List of events referencing this person
		const eventList = eventsContainer.createDiv({ cls: 'crc-events-field__list' });

		// Render function to update the list
		const renderEventList = () => {
			eventList.empty();

			const personEvents = this.getEventsForPerson();

			if (personEvents.length === 0) {
				const emptyState = eventList.createDiv({ cls: 'crc-events-field__empty' });
				emptyState.setText('No events reference this person');
				return;
			}

			// Render each event
			for (const event of personEvents) {
				const eventItem = eventList.createDiv({ cls: 'crc-events-field__item' });

				// Event info container (clickable to open note)
				const infoContainer = eventItem.createDiv({ cls: 'crc-events-field__info' });

				// Event title
				const titleSpan = infoContainer.createSpan({ cls: 'crc-events-field__title' });
				titleSpan.setText(event.title);

				// Event type badge with color
				if (event.eventType && this.plugin) {
					const typeDef = getEventType(
						event.eventType,
						this.plugin.settings.customEventTypes,
						this.plugin.settings.showBuiltInEventTypes
					);
					const typeBadge = infoContainer.createSpan({ cls: 'crc-events-field__type' });
					if (typeDef) {
						typeBadge.setText(typeDef.name);
						if (typeDef.color) {
							typeBadge.style.setProperty('background-color', typeDef.color);
							typeBadge.style.setProperty('color', this.getContrastColor(typeDef.color));
						}
					} else {
						typeBadge.setText(event.eventType);
					}
				}

				// Event date
				if (event.date) {
					const dateSpan = infoContainer.createSpan({ cls: 'crc-events-field__date' });
					dateSpan.setText(event.date);
				}

				// Unlink button
				const unlinkBtn = eventItem.createEl('button', {
					cls: 'crc-btn crc-btn--icon crc-btn--danger',
					attr: { 'aria-label': `Unlink ${event.title}` }
				});
				const unlinkIcon = createLucideIcon('unlink', 14);
				unlinkBtn.appendChild(unlinkIcon);

				unlinkBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					void (async () => {
						await this.unlinkEventFromPerson(event);
						renderEventList();
					})();
				});

				// Click info area to open event note
				infoContainer.addEventListener('click', () => {
					void this.app.workspace.openLinkText(event.filePath, '', false);
				});
			}
		};

		// Initial render
		renderEventList();

		// Link button handler - open event picker
		linkBtn.addEventListener('click', () => {
			if (!this.plugin) {
				new Notice('Plugin not available');
				return;
			}

			// Get currently linked event cr_ids to exclude
			const linkedEvents = this.getEventsForPerson();
			const excludeEvents = linkedEvents.map(e => e.crId);

			new EventPickerModal(this.app, this.plugin, {
				onSelect: async (event) => {
					await this.linkEventToPerson(event);
					renderEventList();
				},
				excludeEvents,
				allowCreate: false
			}).open();
		});

		// Create button handler - open create event modal with person pre-filled
		createBtn.addEventListener('click', () => {
			if (!this.plugin) {
				new Notice('Plugin not available');
				return;
			}

			const eventService = this.plugin.getEventService();
			if (!eventService) {
				new Notice('Event service not available');
				return;
			}

			new CreateEventModal(
				this.app,
				eventService,
				this.plugin.settings,
				{
					initialPerson: {
						name: this.personData.name || '',
						crId: this.personData.crId || ''
					},
					onCreated: () => {
						// Refresh the event list after creation
						// Need a small delay for the cache to update
						setTimeout(() => renderEventList(), 100);
					},
					plugin: this.plugin
				}
			).open();
		});
	}

	/**
	 * Link an event to this person by adding person to event's persons array
	 */
	private async linkEventToPerson(event: EventNote): Promise<void> {
		const personName = this.personData.name;
		if (!personName) {
			new Notice('Person name is required to link events');
			return;
		}

		const personWikilink = `[[${personName}]]`;

		try {
			await this.app.fileManager.processFrontMatter(event.file, (frontmatter) => {
				// Initialize persons array if it doesn't exist
				if (!frontmatter.persons) {
					frontmatter.persons = [];
				}

				// Ensure it's an array
				if (!Array.isArray(frontmatter.persons)) {
					frontmatter.persons = [frontmatter.persons];
				}

				// Check if person is already linked
				const alreadyLinked = frontmatter.persons.some((p: string) => {
					const match = p.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
					const refName = match ? match[1] : p;
					return refName.toLowerCase() === personName.toLowerCase();
				});

				if (!alreadyLinked) {
					frontmatter.persons.push(personWikilink);
				}
			});

			new Notice(`Linked "${event.title}" to ${personName}`);
		} catch (error) {
			console.error('Failed to link event:', error);
			new Notice(`Failed to link event: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Unlink an event from this person by removing person from event's persons array
	 */
	private async unlinkEventFromPerson(event: EventNote): Promise<void> {
		const personName = this.personData.name;
		if (!personName) return;

		try {
			await this.app.fileManager.processFrontMatter(event.file, (frontmatter) => {
				if (!frontmatter.persons || !Array.isArray(frontmatter.persons)) {
					return;
				}

				// Filter out this person
				frontmatter.persons = frontmatter.persons.filter((p: string) => {
					const match = p.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
					const refName = match ? match[1] : p;
					return refName.toLowerCase() !== personName.toLowerCase();
				});

				// Also check singular person property
				if (frontmatter.person) {
					const match = frontmatter.person.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
					const refName = match ? match[1] : frontmatter.person;
					if (refName.toLowerCase() === personName.toLowerCase()) {
						delete frontmatter.person;
					}
				}

				// Clean up empty persons array
				if (frontmatter.persons.length === 0) {
					delete frontmatter.persons;
				}
			});

			new Notice(`Unlinked "${event.title}" from ${personName}`);
		} catch (error) {
			console.error('Failed to unlink event:', error);
			new Notice(`Failed to unlink event: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Get events that reference this person
	 * Checks both singular person and plural persons properties
	 */
	private getEventsForPerson(): EventNote[] {
		if (!this.plugin) return [];

		const eventService = this.plugin.getEventService();
		if (!eventService) return [];

		// Get the person's name and cr_id for matching
		const personName = this.personData.name;
		const personCrId = this.personData.crId;

		if (!personName && !personCrId) return [];

		// Get all events and filter to those referencing this person
		const allEvents = eventService.getAllEvents();

		return allEvents.filter(event => {
			// Check singular person property
			if (event.person) {
				const personMatch = this.matchesPersonReference(event.person, personName, personCrId);
				if (personMatch) return true;
			}

			// Check plural persons property
			if (event.persons && event.persons.length > 0) {
				for (const p of event.persons) {
					if (this.matchesPersonReference(p, personName, personCrId)) {
						return true;
					}
				}
			}

			return false;
		});
	}

	/**
	 * Check if a person reference (wikilink) matches the current person
	 */
	private matchesPersonReference(reference: string, personName: string | undefined, personCrId: string | undefined): boolean {
		// Extract name from wikilink: [[Name]] or "[[Name]]"
		const match = reference.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
		const refName = match ? match[1] : reference;

		// Match by name
		if (personName && refName.toLowerCase() === personName.toLowerCase()) {
			return true;
		}

		// Match by cr_id if present in reference (less common but possible)
		if (personCrId && reference.includes(personCrId)) {
			return true;
		}

		return false;
	}

	/**
	 * Get contrasting text color for a background color
	 */
	private getContrastColor(hexColor: string): string {
		const hex = hexColor.replace('#', '');
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		return luminance > 0.5 ? '#000000' : '#ffffff';
	}

	/**
	 * Create single spouse field for create mode (simplified UX)
	 * When a spouse is added, it gets moved to spousesField array
	 */
	private createSingleSpouseField(container: HTMLElement): void {
		const spouseContainer = container.createDiv({ cls: 'crc-spouse-field' });

		const setting = new Setting(spouseContainer)
			.setName('Spouse')
			.setDesc('Link to an existing person or create a new one');

		let inputEl: HTMLInputElement;

		setting.addText(text => {
			inputEl = text.inputEl;
			text
				.setPlaceholder('Click link button to select...')
				.setDisabled(true);
		});

		setting.addButton(button => {
			const icon = createLucideIcon('link', 16);
			button.buttonEl.empty();
			button.buttonEl.addClass('crc-btn', 'crc-btn--secondary');
			button.buttonEl.appendChild(icon);
			button.buttonEl.appendText(' Link');
			button.setTooltip('Link spouse');

			button.onClick(() => {
				const createContext: RelationshipContext = {
					relationshipType: 'spouse',
					directory: this.directory
				};

				const picker = new PersonPickerModal(this.app, (person: PersonInfo) => {
					// Add to spousesField array
					if (!this.spousesField.crIds.includes(person.crId)) {
						this.spousesField.crIds.push(person.crId);
						this.spousesField.names.push(person.name);
					}
					inputEl.value = person.name;
					inputEl.addClass('crc-input--linked');
					setting.setDesc(`Linked to: ${person.name}`);
				}, {
					title: 'Select spouse',
					subtitle: 'Select an existing person or create a new one',
					createContext: createContext,
					onCreateNew: () => {
						// Callback signals inline creation support
					},
					plugin: this.plugin
				});
				picker.open();
			});
		});
	}

	/**
	 * Create the spouses multi-select field
	 * Shows a list of currently linked spouses with ability to add/remove
	 */
	private createSpousesField(container: HTMLElement): void {
		const spousesContainer = container.createDiv({ cls: 'crc-spouses-field' });

		// Header with label and add button
		const header = spousesContainer.createDiv({ cls: 'crc-spouses-field__header' });
		header.createSpan({ cls: 'crc-spouses-field__label', text: 'Spouses' });

		const addBtn = header.createEl('button', {
			cls: 'crc-btn crc-btn--secondary crc-btn--small'
		});
		const addIcon = createLucideIcon('plus', 14);
		addBtn.appendChild(addIcon);
		addBtn.appendText(' Add spouse');

		// List of current spouses
		const spouseList = spousesContainer.createDiv({ cls: 'crc-spouses-field__list' });

		// Render function to update the list
		const renderSpouseList = () => {
			spouseList.empty();

			if (this.spousesField.crIds.length === 0) {
				const emptyState = spouseList.createDiv({ cls: 'crc-spouses-field__empty' });
				emptyState.setText('No spouses linked');
				return;
			}

			for (let i = 0; i < this.spousesField.crIds.length; i++) {
				const crId = this.spousesField.crIds[i];
				const name = this.spousesField.names[i] || crId;

				const spouseItem = spouseList.createDiv({ cls: 'crc-spouses-field__item' });

				// Spouse name
				const nameSpan = spouseItem.createSpan({ cls: 'crc-spouses-field__name' });
				nameSpan.setText(name);

				// Remove button
				const removeBtn = spouseItem.createEl('button', {
					cls: 'crc-btn crc-btn--icon crc-btn--danger',
					attr: { 'aria-label': `Remove ${name}` }
				});
				const removeIcon = createLucideIcon('x', 14);
				removeBtn.appendChild(removeIcon);

				removeBtn.addEventListener('click', () => {
					// Remove from arrays
					this.spousesField.crIds.splice(i, 1);
					this.spousesField.names.splice(i, 1);
					renderSpouseList();
				});
			}
		};

		// Initial render
		renderSpouseList();

		// Add button handler
		addBtn.addEventListener('click', () => {
			const createContext: RelationshipContext = {
				relationshipType: 'spouse',
				directory: this.directory
			};

			const picker = new PersonPickerModal(this.app, (person: PersonInfo) => {
				// Check if already added
				if (this.spousesField.crIds.includes(person.crId)) {
					new Notice(`${person.name} is already linked as a spouse`);
					return;
				}

				// Add to arrays
				this.spousesField.crIds.push(person.crId);
				this.spousesField.names.push(person.name);
				renderSpouseList();
			}, {
				title: 'Select spouse',
				subtitle: 'Select an existing person or create a new one',
				createContext: createContext,
				onCreateNew: () => {
					// This callback signals inline creation support
				},
				plugin: this.plugin
			});
			picker.open();
		});
	}

	/**
	 * Render post-create actions panel (for "Add Another" flow)
	 * Shows quick action buttons to continue building family after person creation
	 */
	private renderPostCreateActions(contentEl: HTMLElement): void {
		// Clear existing content
		contentEl.empty();

		// Success header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title crc-modal-title--success' });
		const icon = createLucideIcon('check-circle', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Person created!');

		// Created person info
		const infoSection = contentEl.createDiv({ cls: 'crc-post-create-info' });
		infoSection.createDiv({
			cls: 'crc-post-create-info__name',
			text: this.createdPersonName || 'Unknown'
		});
		infoSection.createDiv({
			cls: 'crc-post-create-info__hint',
			text: 'Continue building the family or close this dialog'
		});

		// Action buttons
		const actionsSection = contentEl.createDiv({ cls: 'crc-post-create-actions' });
		actionsSection.createEl('h4', {
			text: 'Add to this person:',
			cls: 'crc-post-create-actions__header'
		});

		const actionsGrid = actionsSection.createDiv({ cls: 'crc-post-create-actions__grid' });

		// Add spouse button
		this.createActionButton(actionsGrid, 'heart', 'Add spouse', () => {
			this.openPostCreatePicker('spouse');
		});

		// Add child button
		this.createActionButton(actionsGrid, 'baby', 'Add child', () => {
			this.openPostCreatePicker('child');
		});

		// Add parent button
		this.createActionButton(actionsGrid, 'users', 'Add parent', () => {
			this.openPostCreatePicker('parent');
		});

		// Done button (closes modal)
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });
		const doneBtn = buttonContainer.createEl('button', {
			text: 'Done',
			cls: 'crc-btn crc-btn--primary'
		});
		doneBtn.addEventListener('click', () => {
			this.close();
		});
	}

	/**
	 * Create an action button for post-create actions
	 */
	private createActionButton(
		container: HTMLElement,
		iconName: 'heart' | 'baby' | 'users',
		label: string,
		onClick: () => void
	): void {
		const btn = container.createEl('button', {
			cls: 'crc-post-create-action-btn'
		});
		const icon = createLucideIcon(iconName, 20);
		btn.appendChild(icon);
		btn.createSpan({ text: label });
		btn.addEventListener('click', onClick);
	}

	/**
	 * Open a person picker for post-create relationship addition
	 */
	private openPostCreatePicker(relationshipType: 'spouse' | 'child' | 'parent'): void {
		if (!this.createdPersonCrId || !this.createdFile) {
			new Notice('Error: No person context available');
			return;
		}

		// Determine context based on relationship type
		let suggestedSex: 'male' | 'female' | undefined;
		let pickerTitle: string;
		let relationshipLabel: string;

		if (relationshipType === 'parent') {
			// For parent, we'll show two options (father and mother)
			// First, ask which parent type
			this.showParentTypeSelector();
			return;
		} else if (relationshipType === 'spouse') {
			pickerTitle = 'Select spouse';
			relationshipLabel = 'spouse';
		} else {
			pickerTitle = 'Select child';
			relationshipLabel = 'child';
		}

		const createContext: RelationshipContext = {
			relationshipType: relationshipLabel,
			suggestedSex,
			parentCrId: this.createdPersonCrId,
			directory: this.directory
		};

		const picker = new PersonPickerModal(this.app, (person: PersonInfo) => {
			void this.addRelationshipToCreatedPerson(relationshipType, person).then(() => {
				// Return to post-create actions after adding relationship
				this.renderPostCreateActions(this.contentEl);
			});
		}, {
			title: pickerTitle,
			subtitle: 'Select an existing person or create a new one',
			createContext: createContext,
			onCreateNew: () => {
				// Callback signals inline creation support
			},
			plugin: this.plugin
		});
		picker.open();
	}

	/**
	 * Show selector for parent type (father/mother)
	 */
	private showParentTypeSelector(): void {
		// Create a simple modal-like overlay within our modal
		const { contentEl } = this;

		contentEl.empty();

		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('users', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Add parent');

		const choiceSection = contentEl.createDiv({ cls: 'crc-parent-type-choice' });
		choiceSection.createDiv({
			cls: 'crc-parent-type-choice__hint',
			text: 'Which parent do you want to add?'
		});

		const choiceGrid = choiceSection.createDiv({ cls: 'crc-parent-type-choice__grid' });

		// Father button
		const fatherBtn = choiceGrid.createEl('button', {
			cls: 'crc-parent-type-btn'
		});
		const fatherIcon = createLucideIcon('user', 20);
		fatherBtn.appendChild(fatherIcon);
		fatherBtn.createSpan({ text: 'Father' });
		fatherBtn.addEventListener('click', () => {
			this.openParentPicker('father');
		});

		// Mother button
		const motherBtn = choiceGrid.createEl('button', {
			cls: 'crc-parent-type-btn'
		});
		const motherIcon = createLucideIcon('user', 20);
		motherBtn.appendChild(motherIcon);
		motherBtn.createSpan({ text: 'Mother' });
		motherBtn.addEventListener('click', () => {
			this.openParentPicker('mother');
		});

		// Back button
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });
		const backBtn = buttonContainer.createEl('button', {
			text: 'Back',
			cls: 'crc-btn'
		});
		backBtn.addEventListener('click', () => {
			this.renderPostCreateActions(contentEl);
		});
	}

	/**
	 * Open parent picker for specific parent type
	 */
	private openParentPicker(parentType: 'father' | 'mother'): void {
		const suggestedSex = parentType === 'father' ? 'male' : 'female';

		const createContext: RelationshipContext = {
			relationshipType: parentType,
			suggestedSex,
			parentCrId: this.createdPersonCrId,
			directory: this.directory
		};

		const picker = new PersonPickerModal(this.app, (person: PersonInfo) => {
			void this.addRelationshipToCreatedPerson(parentType, person).then(() => {
				// Return to post-create actions after adding parent
				this.renderPostCreateActions(this.contentEl);
			});
		}, {
			title: `Select ${parentType}`,
			subtitle: 'Select an existing person or create a new one',
			createContext: createContext,
			onCreateNew: () => {
				// Callback signals inline creation support
			},
			plugin: this.plugin
		});
		picker.open();
	}

	/**
	 * Add a relationship to the created person's note
	 * Handles bidirectional linking for parent-child and spouse relationships
	 */
	private async addRelationshipToCreatedPerson(
		relationshipType: 'spouse' | 'child' | 'father' | 'mother',
		person: PersonInfo
	): Promise<void> {
		if (!this.createdFile) {
			new Notice('Error: No file to update');
			return;
		}

		try {
			const data: Partial<PersonData> = {};
			const cache = this.app.metadataCache.getFileCache(this.createdFile);
			const createdPersonCrId = cache?.frontmatter?.cr_id;
			const createdPersonName = cache?.frontmatter?.name || this.createdFile.basename;
			const createdPersonSex = cache?.frontmatter?.sex;

			if (!createdPersonCrId) {
				new Notice('Error: Could not find cr_id of created person');
				return;
			}

			if (relationshipType === 'spouse') {
				// Add to spouse array
				const existingSpouseIds = cache?.frontmatter?.spouse_id || [];
				const existingSpouseNames = cache?.frontmatter?.spouse || [];

				// Normalize to arrays
				const spouseIds = Array.isArray(existingSpouseIds) ? [...existingSpouseIds] : existingSpouseIds ? [existingSpouseIds] : [];
				const spouseNames = Array.isArray(existingSpouseNames) ? [...existingSpouseNames] : existingSpouseNames ? [existingSpouseNames] : [];

				// Add new spouse if not already present
				if (!spouseIds.includes(person.crId)) {
					spouseIds.push(person.crId);
					spouseNames.push(person.name);
				}

				data.spouseCrId = spouseIds;
				data.spouseName = spouseNames;

				// Bidirectional: add created person to the spouse's spouse array
				await addBidirectionalSpouseLink(this.app, person.crId, createdPersonCrId, createdPersonName, this.directory);
			} else if (relationshipType === 'child') {
				// Add to child array
				const existingChildIds = cache?.frontmatter?.children_id || [];
				const existingChildNames = cache?.frontmatter?.children || [];

				// Normalize to arrays
				const childIds = Array.isArray(existingChildIds) ? [...existingChildIds] : existingChildIds ? [existingChildIds] : [];
				const childNames = Array.isArray(existingChildNames) ? [...existingChildNames] : existingChildNames ? [existingChildNames] : [];

				// Add new child if not already present
				if (!childIds.includes(person.crId)) {
					childIds.push(person.crId);
					childNames.push(person.name);
				}

				data.childCrId = childIds;
				data.childName = childNames;
			} else if (relationshipType === 'father') {
				data.fatherCrId = person.crId;
				data.fatherName = person.name;
			} else if (relationshipType === 'mother') {
				data.motherCrId = person.crId;
				data.motherName = person.name;
			}

			// Suspend bidirectional linker to prevent interference
			const wasSuspended = this.plugin?.bidirectionalLinker?.['suspended'];
			if (this.plugin?.bidirectionalLinker && !wasSuspended) {
				this.plugin.bidirectionalLinker.suspend();
			}

			try {
				// Update the created person's note first
				await updatePersonNote(this.app, this.createdFile, data);

				// Wait a bit for Obsidian to update metadata cache
				await new Promise(resolve => setTimeout(resolve, 100));

				// Then do bidirectional linking (needs to happen AFTER update so cache is fresh)
				if (relationshipType === 'child') {
					// Bidirectional: add created person as parent to the child
					await addParentToChild(this.app, person.crId, createdPersonCrId, createdPersonName, createdPersonSex, this.directory);
				} else if (relationshipType === 'father') {
					// Bidirectional: add created person as child to the father
					await addChildToParent(this.app, person.crId, createdPersonCrId, createdPersonName, this.directory);
				} else if (relationshipType === 'mother') {
					// Bidirectional: add created person as child to the mother
					await addChildToParent(this.app, person.crId, createdPersonCrId, createdPersonName, this.directory);
				}
			} finally {
				// Resume bidirectional linker if we suspended it
				if (this.plugin?.bidirectionalLinker && !wasSuspended) {
					this.plugin.bidirectionalLinker.resume();
				}
			}
			new Notice(`Added ${relationshipType}: ${person.name}`);
		} catch (error) {
			console.error(`Failed to add ${relationshipType}:`, error);
			new Notice(`Failed to add ${relationshipType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Create the person note
	 */
	private async createPerson(): Promise<void> {
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

			// Add spouse relationships
			if (this.spousesField.crIds.length > 0) {
				data.spouseCrId = [...this.spousesField.crIds];
				data.spouseName = [...this.spousesField.names];
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

			// Add gender-neutral parents
			if (this.parentsField.crIds.length > 0) {
				data.parentCrId = [...this.parentsField.crIds];
				data.parentName = [...this.parentsField.names];
			}

			// Add children
			if (this.childrenField.crIds.length > 0) {
				data.childCrId = [...this.childrenField.crIds];
				data.childName = [...this.childrenField.names];
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

			// Add sources
			if (this.sourcesField.crIds.length > 0) {
				data.sourceCrIds = [...this.sourcesField.crIds];
				data.sourceNames = [...this.sourcesField.names];
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

			// Store created person info for post-create actions
			this.createdFile = file;
			this.createdPersonName = this.personData.name;
			// Get cr_id from the file's frontmatter
			const cache = this.app.metadataCache.getFileCache(file);
			this.createdPersonCrId = cache?.frontmatter?.cr_id || data.crId;

			// Show post-create actions instead of closing
			this.renderPostCreateActions(this.contentEl);
		} catch (error) {
			console.error('Failed to create person note:', error);
			new Notice(`Failed to create person note: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Update the existing person note
	 */
	private async updatePerson(): Promise<void> {
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
				pronouns: this.personData.pronouns,
				cr_living: this.personData.cr_living,
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

			// Add spouse relationships
			if (this.spousesField.crIds.length > 0) {
				data.spouseCrId = [...this.spousesField.crIds];
				data.spouseName = [...this.spousesField.names];
			} else {
				// Explicitly clear spouses if all removed
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

			// Add gender-neutral parents
			if (this.parentsField.crIds.length > 0) {
				data.parentCrId = [...this.parentsField.crIds];
				data.parentName = [...this.parentsField.names];
			} else {
				// Explicitly clear parents if all removed
				data.parentCrId = [];
				data.parentName = [];
			}

			// Add children
			if (this.childrenField.crIds.length > 0) {
				data.childCrId = [...this.childrenField.crIds];
				data.childName = [...this.childrenField.names];
			} else {
				// Explicitly clear children if all removed
				data.childCrId = [];
				data.childName = [];
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

			// Add sources
			if (this.sourcesField.crIds.length > 0) {
				data.sourceCrIds = [...this.sourcesField.crIds];
				data.sourceNames = [...this.sourcesField.names];
			} else {
				// Explicitly clear sources if all removed
				data.sourceCrIds = [];
				data.sourceNames = [];
			}

			// Add collection and universe
			data.collection = this.getCollectionValue();
			data.universe = this.getUniverseValue();

			await updatePersonNote(this.app, this.editingFile, data);

			// Check if name changed and offer to rename file
			let renamedFile: TFile | undefined;
			const currentName = this.personData.name || '';
			if (this.originalName && currentName !== this.originalName) {
				const shouldRename = await this.showRenameConfirmation(this.originalName, currentName);
				if (shouldRename) {
					// Get folder from current file path
					const folder = this.editingFile.parent?.path || '';
					const newPath = this.generateUniqueFilename(folder, currentName || 'Untitled Person');

					try {
						// Get cr_id before rename for updating relationships
						const cache = this.app.metadataCache.getFileCache(this.editingFile);
						const personCrId = cache?.frontmatter?.cr_id;

						await this.app.vault.rename(this.editingFile, newPath);
						// Get the renamed file reference
						const newFile = this.app.vault.getAbstractFileByPath(newPath);
						if (newFile instanceof TFile) {
							renamedFile = newFile;
							new Notice(`Renamed file to: ${newFile.basename}`);

							// Update relationship wikilinks in other notes
							if (personCrId && currentName) {
								const relationshipManager = new RelationshipManager(this.app);
								await relationshipManager.updateRelationshipWikilinks(
									personCrId,
									this.originalName,
									currentName,
									newFile
								);
							}
						}
					} catch (renameError) {
						console.error('Failed to rename file:', renameError);
						new Notice(`Failed to rename file: ${renameError instanceof Error ? renameError.message : 'Unknown error'}`);
					}
				}
			}

			new Notice(`Updated person note: ${(renamedFile || this.editingFile).basename}`);

			if (this.onUpdated) {
				this.onUpdated(renamedFile || this.editingFile);
			}

			this.close();
		} catch (error) {
			console.error('Failed to update person note:', error);
			new Notice(`Failed to update person note: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Show a confirmation dialog for renaming the file after name change
	 */
	private showRenameConfirmation(oldName: string, newName: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Rename file?');

			modal.contentEl.createEl('p', {
				text: `You changed the person's name from "${oldName}" to "${newName}".`
			});
			modal.contentEl.createEl('p', {
				text: 'Would you like to rename the note file to match?'
			});

			const buttonContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });

			buttonContainer.createEl('button', { text: 'Keep original filename' })
				.addEventListener('click', () => {
					modal.close();
					resolve(false);
				});

			const renameBtn = buttonContainer.createEl('button', {
				text: 'Rename file',
				cls: 'mod-cta'
			});
			renameBtn.addEventListener('click', () => {
				modal.close();
				resolve(true);
			});

			modal.open();
		});
	}

	/**
	 * Generate a unique filename by appending a number if the file already exists
	 */
	private generateUniqueFilename(folder: string, baseName: string): string {
		let newPath = normalizePath(`${folder}/${baseName}.md`);

		// Check if file already exists (and it's not our current file)
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(newPath) &&
			   this.app.vault.getAbstractFileByPath(newPath) !== this.editingFile) {
			newPath = normalizePath(`${folder}/${baseName} ${counter}.md`);
			counter++;
		}

		return newPath;
	}
}
