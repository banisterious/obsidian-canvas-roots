/**
 * Family Creation Wizard Modal
 *
 * A step-by-step wizard for creating an entire nuclear family at once.
 * Guides users through creating a central person, then adding spouse(s),
 * children, and parents.
 *
 * Steps:
 * - Start: Choose mode (start from scratch vs. build around existing person)
 * - Step 1: Create central person
 * - Step 2: Add spouse(s)
 * - Step 3: Add children
 * - Step 4: Add parents
 * - Step 5: Review with family tree preview
 * - Complete: Success with created notes list
 */

import { App, Modal, Notice, Setting, setIcon, TFile, normalizePath } from 'obsidian';
import type CanvasRootsPlugin from '../../main';
import { createPersonNote, updatePersonNote, PersonData } from '../core/person-note-writer';
import { generateCrId } from '../core/uuid';
import { createLucideIcon } from './lucide-icons';
import { PersonPickerModal, PersonInfo } from './person-picker';
import { getLogger } from '../core/logging';
import { ModalStatePersistence, renderResumePromptBanner } from './modal-state-persistence';

const logger = getLogger('FamilyCreationWizard');

/**
 * Wizard steps
 */
type WizardStep = 'start' | 'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'complete';

/**
 * Wizard mode
 */
type WizardMode = 'scratch' | 'existing';

/**
 * Pending person to be created
 */
interface PendingPerson {
	id: string; // Temporary ID for tracking
	name: string;
	nickname?: string;
	sex?: 'male' | 'female' | 'nonbinary' | '';
	birthDate?: string;
	crId?: string; // Assigned after creation
	file?: TFile; // Assigned after creation
}

/**
 * Wizard state
 */
interface WizardState {
	mode: WizardMode;
	centralPerson: PendingPerson | null;
	existingCentralPerson: PersonInfo | null;
	spouses: PendingPerson[];
	children: PendingPerson[];
	father: PendingPerson | null;
	mother: PendingPerson | null;
	createdFiles: TFile[];
}

/**
 * Serializable pending person (without TFile reference)
 */
interface SerializablePendingPerson {
	id: string;
	name: string;
	nickname?: string;
	sex?: 'male' | 'female' | 'nonbinary' | '';
	birthDate?: string;
	crId?: string;
	filePath?: string; // Store path instead of TFile
}

/**
 * Serializable existing person info (without TFile reference)
 */
interface SerializablePersonInfo {
	name: string;
	crId: string;
	sex?: string;
	birthDate?: string;
	filePath?: string;
}

/**
 * Serializable wizard state for persistence
 */
interface SerializableWizardState {
	currentStep: WizardStep;
	mode: WizardMode;
	centralPerson: SerializablePendingPerson | null;
	existingCentralPerson: SerializablePersonInfo | null;
	spouses: SerializablePendingPerson[];
	children: SerializablePendingPerson[];
	father: SerializablePendingPerson | null;
	mother: SerializablePendingPerson | null;
	directory: string;
}

/**
 * Family Creation Wizard Modal
 */
export class FamilyCreationWizardModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private currentStep: WizardStep = 'start';
	private state: WizardState;
	private directory: string;

	// Persistence
	private persistence: ModalStatePersistence<SerializableWizardState>;
	private completedSuccessfully: boolean = false;

	constructor(app: App, plugin: CanvasRootsPlugin, directory?: string) {
		super(app);
		this.plugin = plugin;
		this.directory = directory || plugin.settings.peopleFolder || 'People';

		// Initialize persistence
		this.persistence = new ModalStatePersistence(plugin, 'family-wizard');

		// Initialize state
		this.state = {
			mode: 'scratch',
			centralPerson: null,
			existingCentralPerson: null,
			spouses: [],
			children: [],
			father: null,
			mother: null,
			createdFiles: []
		};
	}

	onOpen(): void {
		this.modalEl.addClass('crc-family-wizard-modal');

		// Check for existing state to resume
		const existingState = this.persistence.getValidState();
		if (existingState && this.hasContent(existingState.formData as unknown as SerializableWizardState)) {
			// Store the state for rendering the banner
			this.pendingResumeState = existingState;
		}

		this.render();
	}

	// Pending resume state (set in onOpen, cleared after user chooses)
	private pendingResumeState: ReturnType<ModalStatePersistence<SerializableWizardState>['getValidState']> = null;

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Persist state if not completed successfully and has content
		if (!this.completedSuccessfully) {
			const serializableState = this.getSerializableState();
			if (this.hasContent(serializableState)) {
				void this.persistence.persist(serializableState);
			}
		}
	}

	/**
	 * Main render method
	 */
	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Show resume banner if there's pending state
		if (this.pendingResumeState) {
			const timeAgo = this.persistence.getTimeAgoString(this.pendingResumeState);
			renderResumePromptBanner(
				contentEl,
				timeAgo,
				() => {
					// Discard - clear state and re-render
					void this.persistence.clear();
					this.pendingResumeState = null;
					this.render();
				},
				() => {
					// Restore - populate form with saved data
					this.restoreFromPersistedState(this.pendingResumeState!.formData as unknown as SerializableWizardState);
					this.pendingResumeState = null;
					this.render();
				}
			);
		}

		switch (this.currentStep) {
			case 'start':
				this.renderStartStep();
				break;
			case 'step1':
				this.renderStep1();
				break;
			case 'step2':
				this.renderStep2();
				break;
			case 'step3':
				this.renderStep3();
				break;
			case 'step4':
				this.renderStep4();
				break;
			case 'step5':
				this.renderStep5();
				break;
			case 'complete':
				this.renderComplete();
				break;
		}
	}

	/**
	 * Render header
	 */
	private renderHeader(title: string = 'Create Family'): void {
		const { contentEl } = this;

		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('users', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText(title);
	}

	/**
	 * Render step indicator
	 */
	private renderStepIndicator(currentStepNum: number): void {
		const { contentEl } = this;
		const indicator = contentEl.createDiv({ cls: 'crc-wizard-step-indicator' });

		const steps = [
			{ num: 1, label: 'Self' },
			{ num: 2, label: 'Spouse' },
			{ num: 3, label: 'Children' },
			{ num: 4, label: 'Parents' },
			{ num: 5, label: 'Review' }
		];

		steps.forEach((step, index) => {
			if (index > 0) {
				const connector = indicator.createDiv({ cls: 'crc-wizard-step-connector' });
				if (step.num <= currentStepNum) {
					connector.addClass('crc-wizard-step-connector--completed');
				}
			}

			const stepEl = indicator.createDiv({ cls: 'crc-wizard-step' });
			stepEl.textContent = String(step.num);

			if (step.num === currentStepNum) {
				stepEl.addClass('crc-wizard-step--active');
			} else if (step.num < currentStepNum) {
				stepEl.addClass('crc-wizard-step--completed');
				stepEl.empty();
				setIcon(stepEl, 'check');
			}
		});
	}

	/**
	 * Render footer with navigation buttons
	 */
	private renderFooter(options: {
		onBack?: () => void;
		onNext?: () => void;
		backLabel?: string;
		nextLabel?: string;
		nextDisabled?: boolean;
		showSkip?: boolean;
		onSkip?: () => void;
	}): void {
		const { contentEl } = this;
		const footer = contentEl.createDiv({ cls: 'crc-modal-buttons' });

		if (options.onBack) {
			const backBtn = footer.createEl('button', {
				text: options.backLabel || 'Back',
				cls: 'crc-btn'
			});
			backBtn.addEventListener('click', options.onBack);
		} else {
			// Spacer
			footer.createDiv({ cls: 'crc-btn-spacer' });
		}

		const rightButtons = footer.createDiv({ cls: 'crc-btn-group' });

		if (options.showSkip && options.onSkip) {
			const skipBtn = rightButtons.createEl('button', {
				text: 'Skip',
				cls: 'crc-btn'
			});
			skipBtn.addEventListener('click', options.onSkip);
		}

		if (options.onNext) {
			const nextBtn = rightButtons.createEl('button', {
				text: options.nextLabel || 'Next',
				cls: 'crc-btn crc-btn--primary'
			});
			if (options.nextDisabled) {
				nextBtn.disabled = true;
			}
			nextBtn.addEventListener('click', options.onNext);
		}
	}

	// ========================================
	// START STEP
	// ========================================

	private renderStartStep(): void {
		const { contentEl } = this;

		this.renderHeader();

		const content = contentEl.createDiv({ cls: 'crc-wizard-content' });

		// Info callout
		const callout = content.createDiv({ cls: 'crc-info-callout' });
		const calloutIcon = callout.createDiv({ cls: 'crc-info-callout-icon' });
		setIcon(calloutIcon, 'info');
		callout.createDiv({ cls: 'crc-info-callout-text' }).setText(
			'This wizard helps you create multiple family members at once and automatically links them together.'
		);

		// Mode selection
		const modeTitle = content.createEl('h3', { cls: 'crc-wizard-section-title' });
		modeTitle.setText('How would you like to build your family?');

		const modeCards = content.createDiv({ cls: 'crc-wizard-mode-cards' });

		// Start from scratch
		const scratchCard = modeCards.createDiv({ cls: 'crc-wizard-mode-card' });
		if (this.state.mode === 'scratch') {
			scratchCard.addClass('crc-wizard-mode-card--selected');
		}
		const scratchIcon = scratchCard.createDiv({ cls: 'crc-wizard-mode-card-icon' });
		setIcon(scratchIcon, 'user-plus');
		scratchCard.createDiv({ cls: 'crc-wizard-mode-card-title' }).setText('Start from Scratch');
		scratchCard.createDiv({ cls: 'crc-wizard-mode-card-desc' }).setText(
			'Create yourself first, then add family members step by step'
		);
		scratchCard.addEventListener('click', () => {
			this.state.mode = 'scratch';
			this.state.existingCentralPerson = null;
			this.render();
		});

		// Build around existing
		const existingCard = modeCards.createDiv({ cls: 'crc-wizard-mode-card' });
		if (this.state.mode === 'existing') {
			existingCard.addClass('crc-wizard-mode-card--selected');
		}
		const existingIcon = existingCard.createDiv({ cls: 'crc-wizard-mode-card-icon' });
		setIcon(existingIcon, 'user');
		existingCard.createDiv({ cls: 'crc-wizard-mode-card-title' }).setText('Build Around Person');
		existingCard.createDiv({ cls: 'crc-wizard-mode-card-desc' }).setText(
			'Select an existing person to add family members around'
		);
		existingCard.addEventListener('click', () => {
			this.state.mode = 'existing';
			this.render();
		});

		// If existing mode, show person picker
		if (this.state.mode === 'existing') {
			const pickerSection = content.createDiv({ cls: 'crc-wizard-picker-section' });
			const pickerLabel = pickerSection.createDiv({ cls: 'crc-wizard-picker-label' });
			pickerLabel.setText('Selected person:');

			if (this.state.existingCentralPerson) {
				const personCard = pickerSection.createDiv({ cls: 'crc-wizard-person-card' });
				const personIcon = personCard.createDiv({ cls: 'crc-wizard-person-card-icon' });
				if (this.state.existingCentralPerson.sex === 'male') {
					personIcon.addClass('crc-wizard-person-card-icon--male');
				} else if (this.state.existingCentralPerson.sex === 'female') {
					personIcon.addClass('crc-wizard-person-card-icon--female');
				}
				setIcon(personIcon, 'user');

				const personInfo = personCard.createDiv({ cls: 'crc-wizard-person-card-info' });
				personInfo.createDiv({ cls: 'crc-wizard-person-card-name' }).setText(
					this.state.existingCentralPerson.name
				);
				if (this.state.existingCentralPerson.birthDate) {
					personInfo.createDiv({ cls: 'crc-wizard-person-card-meta' }).setText(
						`Born: ${this.state.existingCentralPerson.birthDate}`
					);
				}

				const changeBtn = personCard.createEl('button', {
					text: 'Change',
					cls: 'crc-btn crc-btn--small'
				});
				changeBtn.addEventListener('click', () => {
					this.openPersonPicker();
				});
			} else {
				const selectBtn = pickerSection.createEl('button', {
					cls: 'crc-wizard-add-btn'
				});
				const btnIcon = selectBtn.createSpan();
				setIcon(btnIcon, 'search');
				selectBtn.appendText(' Select existing person');
				selectBtn.addEventListener('click', () => {
					this.openPersonPicker();
				});
			}
		}

		// Footer
		const footer = contentEl.createDiv({ cls: 'crc-modal-buttons' });
		const cancelBtn = footer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => this.close());

		const startBtn = footer.createEl('button', {
			text: 'Get Started',
			cls: 'crc-btn crc-btn--primary'
		});
		const canStart = this.state.mode === 'scratch' ||
			(this.state.mode === 'existing' && this.state.existingCentralPerson !== null);
		if (!canStart) {
			startBtn.disabled = true;
		}
		startBtn.addEventListener('click', () => {
			if (this.state.mode === 'existing' && this.state.existingCentralPerson) {
				// Skip step 1
				this.currentStep = 'step2';
			} else {
				this.currentStep = 'step1';
			}
			this.render();
		});
	}

	private openPersonPicker(): void {
		const modal = new PersonPickerModal(
			this.app,
			(person: PersonInfo) => {
				this.state.existingCentralPerson = person;
				this.render();
			},
			{
				title: 'Select person',
				subtitle: 'Choose the person to build a family around',
				plugin: this.plugin
			}
		);
		modal.open();
	}

	// ========================================
	// STEP 1: CREATE CENTRAL PERSON
	// ========================================

	private renderStep1(): void {
		const { contentEl } = this;

		this.renderHeader();
		this.renderStepIndicator(1);

		const content = contentEl.createDiv({ cls: 'crc-wizard-content' });

		const sectionTitle = content.createEl('h3', { cls: 'crc-wizard-section-title' });
		sectionTitle.setText('Who is the central person?');

		const sectionDesc = content.createEl('p', { cls: 'crc-wizard-section-desc' });
		sectionDesc.setText(
			'This person will be at the center of the family tree. Usually this is yourself or the main subject of your research.'
		);

		// Initialize central person if not set
		if (!this.state.centralPerson) {
			this.state.centralPerson = {
				id: generateCrId(),
				name: '',
				sex: '',
				birthDate: ''
			};
		}

		const form = content.createDiv({ cls: 'crc-form' });

		// Name
		new Setting(form)
			.setName('Full name')
			.setDesc('Required')
			.addText(text => {
				text
					.setPlaceholder('e.g., John Robert Smith')
					.setValue(this.state.centralPerson?.name || '')
					.onChange(value => {
						if (this.state.centralPerson) {
							this.state.centralPerson.name = value;
						}
					});
				// Auto-focus
				setTimeout(() => text.inputEl.focus(), 50);
			});

		// Nickname
		new Setting(form)
			.setName('Nickname')
			.setDesc('Optional informal name or alias')
			.addText(text => text
				.setPlaceholder('e.g., Bobby, JR')
				.setValue(this.state.centralPerson?.nickname || '')
				.onChange(value => {
					if (this.state.centralPerson) {
						this.state.centralPerson.nickname = value;
					}
				}));

		// Sex and Birth date in a row
		const rowContainer = form.createDiv({ cls: 'crc-form-row-inline' });

		new Setting(rowContainer)
			.setName('Sex')
			.addDropdown(dropdown => dropdown
				.addOption('', 'Unknown')
				.addOption('male', 'Male')
				.addOption('female', 'Female')
				.addOption('nonbinary', 'Non-binary')
				.setValue(this.state.centralPerson?.sex || '')
				.onChange(value => {
					if (this.state.centralPerson) {
						this.state.centralPerson.sex = value as 'male' | 'female' | 'nonbinary' | '';
					}
				}));

		new Setting(rowContainer)
			.setName('Birth date')
			.addText(text => text
				.setPlaceholder('YYYY-MM-DD')
				.setValue(this.state.centralPerson?.birthDate || '')
				.onChange(value => {
					if (this.state.centralPerson) {
						this.state.centralPerson.birthDate = value;
					}
				}));

		// Footer
		this.renderFooter({
			onBack: () => {
				this.currentStep = 'start';
				this.render();
			},
			onNext: () => {
				if (!this.state.centralPerson?.name.trim()) {
					new Notice('Please enter a name for the central person');
					return;
				}
				this.currentStep = 'step2';
				this.render();
			},
			nextLabel: 'Next: Add Spouse'
		});
	}

	// ========================================
	// STEP 2: ADD SPOUSES
	// ========================================

	private renderStep2(): void {
		const { contentEl } = this;

		this.renderHeader();
		this.renderStepIndicator(2);

		const content = contentEl.createDiv({ cls: 'crc-wizard-content' });

		const centralName = this.getCentralPersonName();

		const sectionTitle = content.createEl('h3', { cls: 'crc-wizard-section-title' });
		sectionTitle.setText(`Add spouse(s) for ${centralName}`);

		const sectionDesc = content.createEl('p', { cls: 'crc-wizard-section-desc' });
		sectionDesc.setText('You can add multiple spouses if applicable. Skip this step if there are no spouses to add.');

		// Spouse list
		const list = content.createDiv({ cls: 'crc-wizard-person-list' });

		this.state.spouses.forEach((spouse, index) => {
			this.renderPersonCard(list, spouse, 'Spouse', () => {
				// Edit
				this.openPersonEditor(spouse, (updated) => {
					this.state.spouses[index] = updated;
					this.render();
				});
			}, () => {
				// Remove
				this.state.spouses.splice(index, 1);
				this.render();
			});
		});

		// Add spouse buttons
		const addBtns = content.createDiv({ cls: 'crc-wizard-add-btns' });

		// Create new spouse button
		const createBtn = addBtns.createEl('button', { cls: 'crc-wizard-add-btn' });
		const createIcon = createBtn.createSpan();
		setIcon(createIcon, 'user-plus');
		createBtn.appendText(' Create new spouse');
		createBtn.addEventListener('click', () => {
			const newSpouse: PendingPerson = {
				id: generateCrId(),
				name: '',
				sex: '',
				birthDate: ''
			};
			this.openPersonEditor(newSpouse, (spouse) => {
				if (spouse.name.trim()) {
					this.state.spouses.push(spouse);
				}
				this.render();
			});
		});

		// Pick existing spouse button
		const pickBtn = addBtns.createEl('button', { cls: 'crc-wizard-add-btn crc-wizard-add-btn--secondary' });
		const pickIcon = pickBtn.createSpan();
		setIcon(pickIcon, 'user');
		pickBtn.appendText(' Pick existing person');
		pickBtn.addEventListener('click', () => {
			this.openExistingPersonPicker('spouse');
		});

		// Footer
		this.renderFooter({
			onBack: () => {
				if (this.state.mode === 'existing') {
					this.currentStep = 'start';
				} else {
					this.currentStep = 'step1';
				}
				this.render();
			},
			onNext: () => {
				this.currentStep = 'step3';
				this.render();
			},
			nextLabel: 'Next: Add Children',
			showSkip: this.state.spouses.length === 0,
			onSkip: () => {
				this.currentStep = 'step3';
				this.render();
			}
		});
	}

	// ========================================
	// STEP 3: ADD CHILDREN
	// ========================================

	private renderStep3(): void {
		const { contentEl } = this;

		this.renderHeader();
		this.renderStepIndicator(3);

		const content = contentEl.createDiv({ cls: 'crc-wizard-content' });

		const centralName = this.getCentralPersonName();

		const sectionTitle = content.createEl('h3', { cls: 'crc-wizard-section-title' });
		sectionTitle.setText(`Add children for ${centralName}`);

		const sectionDesc = content.createEl('p', { cls: 'crc-wizard-section-desc' });
		sectionDesc.setText('Add any children. Skip this step if there are no children to add.');

		// Children list
		const list = content.createDiv({ cls: 'crc-wizard-person-list' });

		this.state.children.forEach((child, index) => {
			this.renderPersonCard(list, child, 'Child', () => {
				// Edit
				this.openPersonEditor(child, (updated) => {
					this.state.children[index] = updated;
					this.render();
				});
			}, () => {
				// Remove
				this.state.children.splice(index, 1);
				this.render();
			});
		});

		// Add child buttons
		const addBtns = content.createDiv({ cls: 'crc-wizard-add-btns' });

		// Create new child button
		const createBtn = addBtns.createEl('button', { cls: 'crc-wizard-add-btn' });
		const createIcon = createBtn.createSpan();
		setIcon(createIcon, 'user-plus');
		createBtn.appendText(' Create new child');
		createBtn.addEventListener('click', () => {
			const newChild: PendingPerson = {
				id: generateCrId(),
				name: '',
				sex: '',
				birthDate: ''
			};
			this.openPersonEditor(newChild, (child) => {
				if (child.name.trim()) {
					this.state.children.push(child);
				}
				this.render();
			});
		});

		// Pick existing child button
		const pickBtn = addBtns.createEl('button', { cls: 'crc-wizard-add-btn crc-wizard-add-btn--secondary' });
		const pickIcon = pickBtn.createSpan();
		setIcon(pickIcon, 'user');
		pickBtn.appendText(' Pick existing person');
		pickBtn.addEventListener('click', () => {
			this.openExistingPersonPicker('child');
		});

		// Footer
		this.renderFooter({
			onBack: () => {
				this.currentStep = 'step2';
				this.render();
			},
			onNext: () => {
				this.currentStep = 'step4';
				this.render();
			},
			nextLabel: 'Next: Add Parents',
			showSkip: this.state.children.length === 0,
			onSkip: () => {
				this.currentStep = 'step4';
				this.render();
			}
		});
	}

	// ========================================
	// STEP 4: ADD PARENTS
	// ========================================

	private renderStep4(): void {
		const { contentEl } = this;

		this.renderHeader();
		this.renderStepIndicator(4);

		const content = contentEl.createDiv({ cls: 'crc-wizard-content' });

		const centralName = this.getCentralPersonName();

		const sectionTitle = content.createEl('h3', { cls: 'crc-wizard-section-title' });
		sectionTitle.setText(`Add parents for ${centralName}`);

		const sectionDesc = content.createEl('p', { cls: 'crc-wizard-section-desc' });
		sectionDesc.setText('Add the father and/or mother. Skip this step if there are no parents to add.');

		// Parents list
		const list = content.createDiv({ cls: 'crc-wizard-person-list' });

		// Father section
		const fatherSection = list.createDiv({ cls: 'crc-wizard-parent-section' });
		fatherSection.createEl('h4', { cls: 'crc-wizard-parent-label', text: 'Father' });

		if (this.state.father) {
			this.renderPersonCard(fatherSection, this.state.father, 'Father', () => {
				// Only allow editing if not an existing person
				if (!this.state.father?.file) {
					this.openPersonEditor(this.state.father!, (updated) => {
						this.state.father = updated;
						this.render();
					});
				}
			}, () => {
				this.state.father = null;
				this.render();
			});
		} else {
			const fatherBtns = fatherSection.createDiv({ cls: 'crc-wizard-add-btns' });

			const createFatherBtn = fatherBtns.createEl('button', { cls: 'crc-wizard-add-btn' });
			const createFatherIcon = createFatherBtn.createSpan();
			setIcon(createFatherIcon, 'user-plus');
			createFatherBtn.appendText(' Create new');
			createFatherBtn.addEventListener('click', () => {
				const newFather: PendingPerson = {
					id: generateCrId(),
					name: '',
					sex: 'male',
					birthDate: ''
				};
				this.openPersonEditor(newFather, (father) => {
					if (father.name.trim()) {
						this.state.father = father;
					}
					this.render();
				});
			});

			const pickFatherBtn = fatherBtns.createEl('button', { cls: 'crc-wizard-add-btn crc-wizard-add-btn--secondary' });
			const pickFatherIcon = pickFatherBtn.createSpan();
			setIcon(pickFatherIcon, 'user');
			pickFatherBtn.appendText(' Pick existing');
			pickFatherBtn.addEventListener('click', () => {
				this.openExistingPersonPicker('father');
			});
		}

		// Mother section
		const motherSection = list.createDiv({ cls: 'crc-wizard-parent-section' });
		motherSection.createEl('h4', { cls: 'crc-wizard-parent-label', text: 'Mother' });

		if (this.state.mother) {
			this.renderPersonCard(motherSection, this.state.mother, 'Mother', () => {
				// Only allow editing if not an existing person
				if (!this.state.mother?.file) {
					this.openPersonEditor(this.state.mother!, (updated) => {
						this.state.mother = updated;
						this.render();
					});
				}
			}, () => {
				this.state.mother = null;
				this.render();
			});
		} else {
			const motherBtns = motherSection.createDiv({ cls: 'crc-wizard-add-btns' });

			const createMotherBtn = motherBtns.createEl('button', { cls: 'crc-wizard-add-btn' });
			const createMotherIcon = createMotherBtn.createSpan();
			setIcon(createMotherIcon, 'user-plus');
			createMotherBtn.appendText(' Create new');
			createMotherBtn.addEventListener('click', () => {
				const newMother: PendingPerson = {
					id: generateCrId(),
					name: '',
					sex: 'female',
					birthDate: ''
				};
				this.openPersonEditor(newMother, (mother) => {
					if (mother.name.trim()) {
						this.state.mother = mother;
					}
					this.render();
				});
			});

			const pickMotherBtn = motherBtns.createEl('button', { cls: 'crc-wizard-add-btn crc-wizard-add-btn--secondary' });
			const pickMotherIcon = pickMotherBtn.createSpan();
			setIcon(pickMotherIcon, 'user');
			pickMotherBtn.appendText(' Pick existing');
			pickMotherBtn.addEventListener('click', () => {
				this.openExistingPersonPicker('mother');
			});
		}

		// Footer
		this.renderFooter({
			onBack: () => {
				this.currentStep = 'step3';
				this.render();
			},
			onNext: () => {
				this.currentStep = 'step5';
				this.render();
			},
			nextLabel: 'Review Family',
			showSkip: !this.state.father && !this.state.mother,
			onSkip: () => {
				this.currentStep = 'step5';
				this.render();
			}
		});
	}

	// ========================================
	// STEP 5: REVIEW
	// ========================================

	private renderStep5(): void {
		const { contentEl } = this;

		this.renderHeader();
		this.renderStepIndicator(5);

		const content = contentEl.createDiv({ cls: 'crc-wizard-content' });

		const sectionTitle = content.createEl('h3', { cls: 'crc-wizard-section-title' });
		sectionTitle.setText('Review your family');

		const sectionDesc = content.createEl('p', { cls: 'crc-wizard-section-desc' });
		sectionDesc.setText('Review the family members before creating the notes.');

		// Stats summary
		const stats = content.createDiv({ cls: 'crc-wizard-stats-summary' });
		const peopleToCreate = this.getPeopleToCreate();

		const totalStat = stats.createDiv({ cls: 'crc-wizard-stat-card' });
		totalStat.createDiv({ cls: 'crc-wizard-stat-value' }).setText(String(peopleToCreate.length));
		totalStat.createDiv({ cls: 'crc-wizard-stat-label' }).setText('People');

		const spouseCount = this.state.spouses.length;
		const spouseStat = stats.createDiv({ cls: 'crc-wizard-stat-card' });
		spouseStat.createDiv({ cls: 'crc-wizard-stat-value' }).setText(String(spouseCount));
		spouseStat.createDiv({ cls: 'crc-wizard-stat-label' }).setText('Spouses');

		const childCount = this.state.children.length;
		const childStat = stats.createDiv({ cls: 'crc-wizard-stat-card' });
		childStat.createDiv({ cls: 'crc-wizard-stat-value' }).setText(String(childCount));
		childStat.createDiv({ cls: 'crc-wizard-stat-label' }).setText('Children');

		const parentCount = (this.state.father ? 1 : 0) + (this.state.mother ? 1 : 0);
		const parentStat = stats.createDiv({ cls: 'crc-wizard-stat-card' });
		parentStat.createDiv({ cls: 'crc-wizard-stat-value' }).setText(String(parentCount));
		parentStat.createDiv({ cls: 'crc-wizard-stat-label' }).setText('Parents');

		// Family tree preview
		const preview = content.createDiv({ cls: 'crc-wizard-tree-preview' });
		const previewTitle = preview.createDiv({ cls: 'crc-wizard-tree-preview-title' });
		const previewIcon = previewTitle.createSpan();
		setIcon(previewIcon, 'git-branch');
		previewTitle.appendText(' Family tree preview');

		this.renderFamilyTreePreview(preview);

		// People list
		const listSection = content.createDiv({ cls: 'crc-wizard-people-list-section' });
		const listTitle = listSection.createEl('h4');
		listTitle.setText('People to be created:');

		const list = listSection.createDiv({ cls: 'crc-wizard-person-list' });

		peopleToCreate.forEach(person => {
			const card = list.createDiv({ cls: 'crc-wizard-person-card' });
			const cardIcon = card.createDiv({ cls: 'crc-wizard-person-card-icon' });
			if (person.sex === 'male') {
				cardIcon.addClass('crc-wizard-person-card-icon--male');
			} else if (person.sex === 'female') {
				cardIcon.addClass('crc-wizard-person-card-icon--female');
			}
			setIcon(cardIcon, 'user');

			const cardInfo = card.createDiv({ cls: 'crc-wizard-person-card-info' });
			cardInfo.createDiv({ cls: 'crc-wizard-person-card-name' }).setText(person.name);
			if (person.birthDate) {
				cardInfo.createDiv({ cls: 'crc-wizard-person-card-meta' }).setText(
					`Born: ${person.birthDate}`
				);
			}
		});

		// Footer
		this.renderFooter({
			onBack: () => {
				this.currentStep = 'step4';
				this.render();
			},
			onNext: () => {
				void this.createAllPeople();
			},
			nextLabel: `Create ${peopleToCreate.length} People`
		});
	}

	/**
	 * Render a simple family tree preview
	 */
	private renderFamilyTreePreview(container: HTMLElement): void {
		const diagram = container.createDiv({ cls: 'crc-wizard-tree-diagram' });

		// Parents row
		if (this.state.father || this.state.mother) {
			const parentsRow = diagram.createDiv({ cls: 'crc-wizard-tree-row' });

			if (this.state.father) {
				this.renderTreeNode(parentsRow, this.state.father.name, 'male', false);
			} else {
				this.renderPlaceholderNode(parentsRow, 'Father');
			}

			if (this.state.mother) {
				this.renderTreeNode(parentsRow, this.state.mother.name, 'female', false);
			} else {
				this.renderPlaceholderNode(parentsRow, 'Mother');
			}

			// Connector down
			diagram.createDiv({ cls: 'crc-wizard-tree-connector-vertical' });
		}

		// Central person and spouses row
		const centralRow = diagram.createDiv({ cls: 'crc-wizard-tree-row' });

		const centralName = this.getCentralPersonName();
		const centralSex = this.getCentralPersonSex();
		this.renderTreeNode(centralRow, centralName, centralSex, true);

		if (this.state.spouses.length > 0) {
			centralRow.createDiv({ cls: 'crc-wizard-spouse-connector' });
			this.state.spouses.forEach((spouse, index) => {
				if (index > 0) {
					centralRow.createDiv({ cls: 'crc-wizard-spouse-connector' });
				}
				this.renderTreeNode(centralRow, spouse.name, spouse.sex || '', false);
			});
		}

		// Children row
		if (this.state.children.length > 0) {
			// Connector down
			diagram.createDiv({ cls: 'crc-wizard-tree-connector-vertical' });

			const childrenRow = diagram.createDiv({ cls: 'crc-wizard-tree-row' });
			this.state.children.forEach(child => {
				this.renderTreeNode(childrenRow, child.name, child.sex || '', false);
			});
		}
	}

	private renderTreeNode(container: HTMLElement, name: string, sex: string, isCentral: boolean): void {
		const node = container.createDiv({ cls: 'crc-wizard-tree-node' });
		const circle = node.createDiv({ cls: 'crc-wizard-tree-node-circle' });

		if (isCentral) {
			circle.addClass('crc-wizard-tree-node-circle--self');
		} else if (sex === 'male') {
			circle.addClass('crc-wizard-tree-node-circle--male');
		} else if (sex === 'female') {
			circle.addClass('crc-wizard-tree-node-circle--female');
		}

		// Initials
		const initials = name.split(' ')
			.slice(0, 2)
			.map(n => n.charAt(0).toUpperCase())
			.join('');
		circle.setText(initials || '?');

		const label = node.createDiv({ cls: 'crc-wizard-tree-node-label' });
		label.setText(name.split(' ')[0] || 'Unknown');
	}

	private renderPlaceholderNode(container: HTMLElement, label: string): void {
		const node = container.createDiv({ cls: 'crc-wizard-tree-node' });
		const circle = node.createDiv({ cls: 'crc-wizard-tree-node-circle crc-wizard-tree-node-circle--placeholder' });
		circle.setText('?');
		const labelEl = node.createDiv({ cls: 'crc-wizard-tree-node-label' });
		labelEl.setText(label);
	}

	// ========================================
	// COMPLETE STEP
	// ========================================

	private renderComplete(): void {
		const { contentEl } = this;

		const content = contentEl.createDiv({ cls: 'crc-wizard-content crc-wizard-completion' });

		// Success icon
		const successIcon = content.createDiv({ cls: 'crc-wizard-completion-icon' });
		setIcon(successIcon, 'check-circle');

		content.createEl('h2', { cls: 'crc-wizard-completion-title' }).setText('Family created!');
		content.createEl('p', { cls: 'crc-wizard-completion-message' }).setText(
			'All family members have been created and linked together.'
		);

		// Stats
		const stats = content.createDiv({ cls: 'crc-wizard-completion-stats' });

		const notesCreated = this.state.createdFiles.length;
		const notesStat = stats.createDiv({ cls: 'crc-wizard-completion-stat' });
		notesStat.createDiv({ cls: 'crc-wizard-completion-stat-value' }).setText(String(notesCreated));
		notesStat.createDiv({ cls: 'crc-wizard-completion-stat-label' }).setText('Notes created');

		const relationshipCount = this.calculateRelationshipCount();
		const relStat = stats.createDiv({ cls: 'crc-wizard-completion-stat' });
		relStat.createDiv({ cls: 'crc-wizard-completion-stat-value' }).setText(String(relationshipCount));
		relStat.createDiv({ cls: 'crc-wizard-completion-stat-label' }).setText('Relationships linked');

		// Created notes list
		if (this.state.createdFiles.length > 0) {
			const listSection = content.createDiv({ cls: 'crc-wizard-created-notes-list' });
			listSection.createEl('h5').setText('Created notes:');

			this.state.createdFiles.forEach(file => {
				const item = listSection.createDiv({ cls: 'crc-wizard-created-note-item' });
				const itemIcon = item.createDiv({ cls: 'crc-wizard-created-note-icon' });
				setIcon(itemIcon, 'check');
				item.createDiv({ cls: 'crc-wizard-created-note-name' }).setText(file.basename);

				const openLink = item.createEl('span', { cls: 'crc-wizard-created-note-link' });
				openLink.setText('Open');
				openLink.addEventListener('click', () => {
					void this.app.workspace.openLinkText(file.path, '', false);
				});
			});
		}

		// Footer
		const footer = contentEl.createDiv({ cls: 'crc-modal-buttons crc-modal-buttons--center' });

		const doneBtn = footer.createEl('button', {
			text: 'Done',
			cls: 'crc-btn crc-btn--primary crc-btn--success'
		});
		doneBtn.addEventListener('click', () => this.close());
	}

	// ========================================
	// HELPER METHODS
	// ========================================

	private getCentralPersonName(): string {
		if (this.state.mode === 'existing' && this.state.existingCentralPerson) {
			return this.state.existingCentralPerson.name;
		}
		return this.state.centralPerson?.name || 'Unknown';
	}

	private getCentralPersonSex(): string {
		if (this.state.mode === 'existing' && this.state.existingCentralPerson) {
			return this.state.existingCentralPerson.sex || '';
		}
		return this.state.centralPerson?.sex || '';
	}

	private getPeopleToCreate(): PendingPerson[] {
		const people: PendingPerson[] = [];

		// Central person (if starting from scratch)
		if (this.state.mode === 'scratch' && this.state.centralPerson?.name.trim()) {
			people.push(this.state.centralPerson);
		}

		// Spouses
		people.push(...this.state.spouses.filter(s => s.name.trim()));

		// Children
		people.push(...this.state.children.filter(c => c.name.trim()));

		// Parents
		if (this.state.father?.name.trim()) {
			people.push(this.state.father);
		}
		if (this.state.mother?.name.trim()) {
			people.push(this.state.mother);
		}

		return people;
	}

	private calculateRelationshipCount(): number {
		let count = 0;

		const hasSpouses = this.state.spouses.length > 0;
		const hasChildren = this.state.children.length > 0;
		const hasFather = this.state.father !== null;
		const hasMother = this.state.mother !== null;

		// Spouse relationships
		count += this.state.spouses.length; // Each spouse is linked to central person

		// Child relationships (each child links to central person as parent)
		count += this.state.children.length;

		// If spouses exist and children exist, children also link to spouses
		if (hasSpouses && hasChildren) {
			count += this.state.children.length * this.state.spouses.length;
		}

		// Parent relationships (central person links to father/mother)
		if (hasFather) count += 1;
		if (hasMother) count += 1;

		return count;
	}

	private renderPersonCard(
		container: HTMLElement,
		person: PendingPerson,
		roleLabel: string,
		onEdit: () => void,
		onRemove: () => void
	): void {
		const card = container.createDiv({ cls: 'crc-wizard-person-card' });

		const cardIcon = card.createDiv({ cls: 'crc-wizard-person-card-icon' });
		if (person.sex === 'male') {
			cardIcon.addClass('crc-wizard-person-card-icon--male');
		} else if (person.sex === 'female') {
			cardIcon.addClass('crc-wizard-person-card-icon--female');
		}
		setIcon(cardIcon, 'user');

		const cardInfo = card.createDiv({ cls: 'crc-wizard-person-card-info' });
		cardInfo.createDiv({ cls: 'crc-wizard-person-card-name' }).setText(person.name || 'Unnamed');

		const meta: string[] = [];
		if (roleLabel) meta.push(roleLabel);
		if (person.birthDate) meta.push(`Born: ${person.birthDate}`);
		if (meta.length > 0) {
			cardInfo.createDiv({ cls: 'crc-wizard-person-card-meta' }).setText(meta.join(' · '));
		}

		const actions = card.createDiv({ cls: 'crc-wizard-person-card-actions' });

		const editBtn = actions.createEl('button', { cls: 'crc-wizard-person-card-btn' });
		setIcon(editBtn, 'edit');
		editBtn.setAttribute('aria-label', 'Edit');
		editBtn.addEventListener('click', onEdit);

		const removeBtn = actions.createEl('button', { cls: 'crc-wizard-person-card-btn crc-wizard-person-card-btn--delete' });
		setIcon(removeBtn, 'trash');
		removeBtn.setAttribute('aria-label', 'Remove');
		removeBtn.addEventListener('click', onRemove);
	}

	/**
	 * Open a simple inline editor for a pending person
	 */
	private openPersonEditor(person: PendingPerson, onSave: (person: PendingPerson) => void): void {
		const modal = new PersonEditorModal(this.app, person, onSave);
		modal.open();
	}

	/**
	 * Open person picker to select an existing person
	 */
	private openExistingPersonPicker(role: 'spouse' | 'child' | 'father' | 'mother'): void {
		// Get the central person's cr_id to exclude from picker
		const centralCrId = this.state.mode === 'existing'
			? this.state.existingCentralPerson?.crId
			: this.state.centralPerson?.crId;

		// Get already selected person IDs to avoid duplicates
		const excludeIds = new Set<string>();
		if (centralCrId) excludeIds.add(centralCrId);

		// Add already selected spouses, children, parents
		this.state.spouses.forEach(s => { if (s.crId) excludeIds.add(s.crId); });
		this.state.children.forEach(c => { if (c.crId) excludeIds.add(c.crId); });
		if (this.state.father?.crId) excludeIds.add(this.state.father.crId);
		if (this.state.mother?.crId) excludeIds.add(this.state.mother.crId);

		const roleLabels: Record<typeof role, string> = {
			spouse: 'Select spouse',
			child: 'Select child',
			father: 'Select father',
			mother: 'Select mother'
		};

		const modal = new PersonPickerModal(
			this.app,
			(person: PersonInfo) => {
				// Skip if already selected
				if (excludeIds.has(person.crId)) {
					new Notice('This person is already in the family');
					return;
				}

				// Convert PersonInfo to PendingPerson (existing person)
				const pendingPerson: PendingPerson = {
					id: person.crId, // Use crId as id for existing persons
					name: person.name,
					sex: (person.sex as PendingPerson['sex']) || '',
					birthDate: person.birthDate || '',
					crId: person.crId,
					file: person.file
				};

				// Add to appropriate state
				if (role === 'spouse') {
					this.state.spouses.push(pendingPerson);
				} else if (role === 'child') {
					this.state.children.push(pendingPerson);
				} else if (role === 'father') {
					this.state.father = pendingPerson;
				} else if (role === 'mother') {
					this.state.mother = pendingPerson;
				}

				this.render();
			},
			{
				title: roleLabels[role],
				subtitle: 'Choose an existing person from your vault',
				plugin: this.plugin
			}
		);
		modal.open();
	}

	/**
	 * Create all people and link relationships
	 */
	private async createAllPeople(): Promise<void> {
		const peopleToCreate = this.getPeopleToCreate();

		if (peopleToCreate.length === 0) {
			new Notice('No people to create');
			return;
		}

		try {
			// Ensure directory exists
			const normalizedDir = normalizePath(this.directory);
			const folder = this.app.vault.getAbstractFileByPath(normalizedDir);
			if (!folder) {
				await this.app.vault.createFolder(normalizedDir);
			}

			// Create all people first
			for (const person of peopleToCreate) {
				const crId = generateCrId();
				person.crId = crId;

				const personData: PersonData = {
					name: person.name.trim(),
					crId: crId
				};

				if (person.nickname) {
					personData.nickname = person.nickname.trim();
				}

				if (person.sex) {
					personData.sex = person.sex;
				}

				if (person.birthDate) {
					personData.birthDate = person.birthDate;
				}

				const file = await createPersonNote(this.app, personData, {
					directory: this.directory,
					openAfterCreate: false,
					includeDynamicBlocks: true,
					dynamicBlockTypes: ['media', 'timeline', 'relationships']
				});

				person.file = file;
				this.state.createdFiles.push(file);
			}

			// Now link relationships
			await this.linkRelationships();

			// Mark as completed successfully and clear persisted state
			this.completedSuccessfully = true;
			void this.persistence.clear();

			// Show completion
			this.currentStep = 'complete';
			this.render();

		} catch (error) {
			logger.error('create-family', 'Failed to create family', { error });
			new Notice(`Failed to create family: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Link all relationships after people are created
	 */
	private async linkRelationships(): Promise<void> {
		// Helper to get existing array values from frontmatter
		const getExistingArray = (file: TFile, idProp: string, nameProp: string): { ids: string[], names: string[] } => {
			const cache = this.app.metadataCache.getFileCache(file);
			const existingIds = cache?.frontmatter?.[idProp] || [];
			const existingNames = cache?.frontmatter?.[nameProp] || [];

			// Normalize to arrays
			const ids = Array.isArray(existingIds) ? [...existingIds] : existingIds ? [existingIds] : [];
			const names = Array.isArray(existingNames) ? [...existingNames] : existingNames ? [existingNames] : [];

			return { ids, names };
		};

		// Helper to merge new values with existing, avoiding duplicates
		const mergeArrays = (
			existing: { ids: string[], names: string[] },
			newIds: string[],
			newNames: string[]
		): { ids: string[], names: string[] } => {
			const resultIds = [...existing.ids];
			const resultNames = [...existing.names];

			for (let i = 0; i < newIds.length; i++) {
				if (!resultIds.includes(newIds[i])) {
					resultIds.push(newIds[i]);
					resultNames.push(newNames[i]);
				}
			}

			return { ids: resultIds, names: resultNames };
		};

		// Get central person info
		let centralCrId: string;
		let centralName: string;
		let centralSex: string;
		let centralFile: TFile | undefined;

		if (this.state.mode === 'existing' && this.state.existingCentralPerson) {
			centralCrId = this.state.existingCentralPerson.crId;
			centralName = this.state.existingCentralPerson.name;
			centralSex = this.state.existingCentralPerson.sex || '';
			centralFile = this.state.existingCentralPerson.file;
		} else if (this.state.centralPerson?.crId) {
			centralCrId = this.state.centralPerson.crId;
			centralName = this.state.centralPerson.name;
			centralSex = this.state.centralPerson.sex || '';
			centralFile = this.state.centralPerson.file;
		} else {
			return;
		}

		// Collect all children info for parent linking
		const childCrIds = this.state.children
			.filter(c => c.crId)
			.map(c => c.crId!);
		const childNames = this.state.children
			.filter(c => c.crId)
			.map(c => c.name);

		// Link spouses (bidirectional)
		for (const spouse of this.state.spouses) {
			if (spouse.file && spouse.crId) {
				// Add central person as spouse of spouse (merge with existing)
				const existingSpousesOnSpouse = getExistingArray(spouse.file, 'spouse_id', 'spouse');
				const mergedSpousesOnSpouse = mergeArrays(existingSpousesOnSpouse, [centralCrId], [centralName]);
				await updatePersonNote(this.app, spouse.file, {
					spouseCrId: mergedSpousesOnSpouse.ids,
					spouseName: mergedSpousesOnSpouse.names
				});

				// Add spouse to central person (merge with existing)
				if (centralFile) {
					const existingSpousesOnCentral = getExistingArray(centralFile, 'spouse_id', 'spouse');
					const mergedSpousesOnCentral = mergeArrays(existingSpousesOnCentral, [spouse.crId], [spouse.name]);
					await updatePersonNote(this.app, centralFile, {
						spouseCrId: mergedSpousesOnCentral.ids,
						spouseName: mergedSpousesOnCentral.names
					});
				}

				// Add children to spouse (merge with existing)
				if (childCrIds.length > 0 && spouse.file) {
					const existingChildrenOnSpouse = getExistingArray(spouse.file, 'children_id', 'child');
					const mergedChildrenOnSpouse = mergeArrays(existingChildrenOnSpouse, childCrIds, childNames);
					await updatePersonNote(this.app, spouse.file, {
						childCrId: mergedChildrenOnSpouse.ids,
						childName: mergedChildrenOnSpouse.names
					});
				}
			}
		}

		// Link children (bidirectional)
		for (const child of this.state.children) {
			if (child.file && child.crId) {
				// Set parent based on central person's sex
				if (centralSex === 'male') {
					await updatePersonNote(this.app, child.file, {
						fatherCrId: centralCrId,
						fatherName: centralName
					});
				} else if (centralSex === 'female') {
					await updatePersonNote(this.app, child.file, {
						motherCrId: centralCrId,
						motherName: centralName
					});
				}

				// Also link spouses as parents of children
				for (const spouse of this.state.spouses) {
					if (spouse.crId && child.file) {
						if (spouse.sex === 'male') {
							await updatePersonNote(this.app, child.file, {
								fatherCrId: spouse.crId,
								fatherName: spouse.name
							});
						} else if (spouse.sex === 'female') {
							await updatePersonNote(this.app, child.file, {
								motherCrId: spouse.crId,
								motherName: spouse.name
							});
						}
					}
				}
			}
		}

		// Add children to central person (merge with existing)
		if (childCrIds.length > 0 && centralFile) {
			const existingChildrenOnCentral = getExistingArray(centralFile, 'children_id', 'child');
			const mergedChildrenOnCentral = mergeArrays(existingChildrenOnCentral, childCrIds, childNames);
			await updatePersonNote(this.app, centralFile, {
				childCrId: mergedChildrenOnCentral.ids,
				childName: mergedChildrenOnCentral.names
			});
		}

		// Link parents (bidirectional)
		if (this.state.father?.crId) {
			// Set father on central person
			if (centralFile) {
				await updatePersonNote(this.app, centralFile, {
					fatherCrId: this.state.father.crId,
					fatherName: this.state.father.name
				});
			}
			// Add central person as child of father (merge with existing)
			if (this.state.father.file) {
				const existingChildrenOnFather = getExistingArray(this.state.father.file, 'children_id', 'child');
				const mergedChildrenOnFather = mergeArrays(existingChildrenOnFather, [centralCrId], [centralName]);
				await updatePersonNote(this.app, this.state.father.file, {
					childCrId: mergedChildrenOnFather.ids,
					childName: mergedChildrenOnFather.names
				});
			}
		}

		if (this.state.mother?.crId) {
			// Set mother on central person
			if (centralFile) {
				await updatePersonNote(this.app, centralFile, {
					motherCrId: this.state.mother.crId,
					motherName: this.state.mother.name
				});
			}
			// Add central person as child of mother (merge with existing)
			if (this.state.mother.file) {
				const existingChildrenOnMother = getExistingArray(this.state.mother.file, 'children_id', 'child');
				const mergedChildrenOnMother = mergeArrays(existingChildrenOnMother, [centralCrId], [centralName]);
				await updatePersonNote(this.app, this.state.mother.file, {
					childCrId: mergedChildrenOnMother.ids,
					childName: mergedChildrenOnMother.names
				});
			}
		}

		// Link father and mother as spouses to each other (merge with existing)
		if (this.state.father?.crId && this.state.mother?.crId) {
			if (this.state.father.file) {
				const existingSpousesOnFather = getExistingArray(this.state.father.file, 'spouse_id', 'spouse');
				const mergedSpousesOnFather = mergeArrays(existingSpousesOnFather, [this.state.mother.crId], [this.state.mother.name]);
				await updatePersonNote(this.app, this.state.father.file, {
					spouseCrId: mergedSpousesOnFather.ids,
					spouseName: mergedSpousesOnFather.names
				});
			}
			if (this.state.mother.file) {
				const existingSpousesOnMother = getExistingArray(this.state.mother.file, 'spouse_id', 'spouse');
				const mergedSpousesOnMother = mergeArrays(existingSpousesOnMother, [this.state.father.crId], [this.state.father.name]);
				await updatePersonNote(this.app, this.state.mother.file, {
					spouseCrId: mergedSpousesOnMother.ids,
					spouseName: mergedSpousesOnMother.names
				});
			}
		}
	}

	// ========================================
	// PERSISTENCE HELPERS
	// ========================================

	/**
	 * Convert current state to serializable format for persistence
	 */
	private getSerializableState(): SerializableWizardState {
		const serializePendingPerson = (p: PendingPerson | null): SerializablePendingPerson | null => {
			if (!p) return null;
			return {
				id: p.id,
				name: p.name,
				nickname: p.nickname,
				sex: p.sex,
				birthDate: p.birthDate,
				crId: p.crId,
				filePath: p.file?.path
			};
		};

		const serializePersonInfo = (p: PersonInfo | null): SerializablePersonInfo | null => {
			if (!p) return null;
			return {
				name: p.name,
				crId: p.crId,
				sex: p.sex,
				birthDate: p.birthDate,
				filePath: p.file?.path
			};
		};

		return {
			currentStep: this.currentStep,
			mode: this.state.mode,
			centralPerson: serializePendingPerson(this.state.centralPerson),
			existingCentralPerson: serializePersonInfo(this.state.existingCentralPerson),
			spouses: this.state.spouses.map(s => serializePendingPerson(s)!),
			children: this.state.children.map(c => serializePendingPerson(c)!),
			father: serializePendingPerson(this.state.father),
			mother: serializePendingPerson(this.state.mother),
			directory: this.directory
		};
	}

	/**
	 * Restore state from persisted data
	 */
	private restoreFromPersistedState(saved: SerializableWizardState): void {
		const restorePendingPerson = (p: SerializablePendingPerson | null): PendingPerson | null => {
			if (!p) return null;
			const restored: PendingPerson = {
				id: p.id,
				name: p.name,
				nickname: p.nickname,
				sex: p.sex,
				birthDate: p.birthDate,
				crId: p.crId
			};
			// Restore TFile reference if path exists
			if (p.filePath) {
				const file = this.app.vault.getAbstractFileByPath(p.filePath);
				if (file instanceof TFile) {
					restored.file = file;
				}
			}
			return restored;
		};

		const restorePersonInfo = (p: SerializablePersonInfo | null): PersonInfo | null => {
			if (!p) return null;
			// PersonInfo requires a TFile - if we can't restore it, we can't use this person
			let file: TFile | undefined;
			if (p.filePath) {
				const abstractFile = this.app.vault.getAbstractFileByPath(p.filePath);
				if (abstractFile instanceof TFile) {
					file = abstractFile;
				}
			}
			// If no valid file, we can't restore this PersonInfo
			if (!file) {
				return null;
			}
			return {
				name: p.name,
				crId: p.crId,
				sex: p.sex,
				birthDate: p.birthDate,
				file: file
			};
		};

		this.currentStep = saved.currentStep;
		this.directory = saved.directory || this.directory;

		const restoredExistingCentralPerson = restorePersonInfo(saved.existingCentralPerson);

		// If we were in 'existing' mode but can't restore the central person, fall back to scratch
		let mode = saved.mode;
		if (mode === 'existing' && !restoredExistingCentralPerson) {
			mode = 'scratch';
			this.currentStep = 'start';
		}

		this.state = {
			mode: mode,
			centralPerson: restorePendingPerson(saved.centralPerson),
			existingCentralPerson: restoredExistingCentralPerson,
			spouses: saved.spouses.map(s => restorePendingPerson(s)!).filter(Boolean),
			children: saved.children.map(c => restorePendingPerson(c)!).filter(Boolean),
			father: restorePendingPerson(saved.father),
			mother: restorePendingPerson(saved.mother),
			createdFiles: []
		};
	}

	/**
	 * Check if there's meaningful content to persist
	 */
	private hasContent(state: SerializableWizardState): boolean {
		// Has content if we've moved past start, or have any people defined
		if (state.currentStep !== 'start') {
			return true;
		}
		if (state.centralPerson?.name?.trim()) {
			return true;
		}
		if (state.existingCentralPerson?.crId) {
			return true;
		}
		if (state.spouses.length > 0) {
			return true;
		}
		if (state.children.length > 0) {
			return true;
		}
		if (state.father?.name?.trim()) {
			return true;
		}
		if (state.mother?.name?.trim()) {
			return true;
		}
		return false;
	}
}

/**
 * Simple inline editor for a pending person
 */
class PersonEditorModal extends Modal {
	private person: PendingPerson;
	private onSave: (person: PendingPerson) => void;

	constructor(app: App, person: PendingPerson, onSave: (person: PendingPerson) => void) {
		super(app);
		// Clone the person to avoid mutating the original
		this.person = { ...person };
		this.onSave = onSave;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		this.modalEl.addClass('crc-person-editor-modal');

		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('user', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText(this.person.name ? 'Edit person' : 'Add person');

		const form = contentEl.createDiv({ cls: 'crc-form' });

		// Name
		new Setting(form)
			.setName('Full name')
			.setDesc('Required')
			.addText(text => {
				text
					.setPlaceholder('e.g., Jane Doe')
					.setValue(this.person.name)
					.onChange(value => {
						this.person.name = value;
					});
				setTimeout(() => text.inputEl.focus(), 50);
			});

		// Nickname
		new Setting(form)
			.setName('Nickname')
			.setDesc('Optional')
			.addText(text => text
				.setPlaceholder('e.g., Janie')
				.setValue(this.person.nickname || '')
				.onChange(value => {
					this.person.nickname = value;
				}));

		// Sex
		new Setting(form)
			.setName('Sex')
			.addDropdown(dropdown => dropdown
				.addOption('', 'Unknown')
				.addOption('male', 'Male')
				.addOption('female', 'Female')
				.addOption('nonbinary', 'Non-binary')
				.setValue(this.person.sex || '')
				.onChange(value => {
					this.person.sex = value as 'male' | 'female' | 'nonbinary' | '';
				}));

		// Birth date
		new Setting(form)
			.setName('Birth date')
			.addText(text => text
				.setPlaceholder('YYYY-MM-DD')
				.setValue(this.person.birthDate || '')
				.onChange(value => {
					this.person.birthDate = value;
				}));

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => this.close());

		const saveBtn = buttonContainer.createEl('button', {
			text: 'Save',
			cls: 'crc-btn crc-btn--primary'
		});
		saveBtn.addEventListener('click', () => {
			this.onSave(this.person);
			this.close();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
