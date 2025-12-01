/**
 * Split Wizard Modal
 *
 * Multi-step wizard for configuring and executing canvas splitting operations.
 * Supports splitting by generation, branch, lineage, collection, and ancestor-descendant pairs.
 */

import { App, Modal, Notice, Setting, TFile, TFolder } from 'obsidian';
import type { CanvasRootsSettings } from '../settings';
import { FamilyGraphService, type FamilyTree, type PersonNode } from '../core/family-graph';
import { FolderFilterService } from '../core/folder-filter';
import {
	CanvasSplitService,
	type GenerationSplitOptions,
	type BranchSplitOptions,
	type LineageSplitOptions,
	type CollectionSplitOptions,
	type AncestorDescendantSplitOptions,
	type SurnameSplitOptions,
	DEFAULT_GENERATION_SPLIT_OPTIONS,
	DEFAULT_BRANCH_SPLIT_OPTIONS,
	DEFAULT_LINEAGE_SPLIT_OPTIONS,
	DEFAULT_COLLECTION_SPLIT_OPTIONS,
	DEFAULT_ANCESTOR_DESCENDANT_OPTIONS,
	DEFAULT_SURNAME_SPLIT_OPTIONS
} from '../core/canvas-split';
import type { CanvasWriteResult } from '../core/canvas-utils';
import { PersonPickerModal, type PersonInfo } from './person-picker';

/**
 * Simplified person selection info for the wizard
 * (doesn't require full PersonNode which may not exist in partial tree)
 */
interface SelectedPerson {
	crId: string;
	name: string;
}
import { createLucideIcon, type LucideIconName } from './lucide-icons';
import { getLogger } from '../core/logging';

const logger = getLogger('SplitWizard');

/**
 * Split method type
 */
export type SplitMethod = 'generation' | 'branch' | 'lineage' | 'collection' | 'ancestor-descendant' | 'surname';

/**
 * Wizard step type
 */
type WizardStep = 'method' | 'configure' | 'preview' | 'complete';

/**
 * Split Wizard Modal
 */
export class SplitWizardModal extends Modal {
	private settings: CanvasRootsSettings;
	private folderFilter?: FolderFilterService;
	private familyGraph: FamilyGraphService;
	private splitService: CanvasSplitService;
	private tree: FamilyTree | null = null;

	// Wizard state
	private currentStep: WizardStep = 'method';
	private selectedMethod: SplitMethod | null = null;

	// Common options
	private outputFolder: string = '';
	private filenamePrefix: string = '';
	private includeNavigationNodes: boolean = true;
	private generateOverview: boolean = true;

	// Generation split options
	private generationsPerCanvas: number = 4;
	private generationDirection: 'up' | 'down' = 'up';
	private selectedRootPerson: SelectedPerson | null = null;

	// Branch split options
	private includePaternal: boolean = true;
	private includeMaternal: boolean = true;
	private includeDescendants: boolean = false;
	private branchMaxGenerations?: number;
	private branchAnchorPerson: SelectedPerson | null = null;

	// Lineage split options
	private lineageStartPerson: SelectedPerson | null = null;
	private lineageEndPerson: SelectedPerson | null = null;
	private lineageIncludeSpouses: boolean = true;
	private lineageIncludeSiblings: boolean = false;

	// Collection split options
	private selectedCollections: string[] = [];
	private availableCollections: string[] = [];
	private collectionIncludeBridgePeople: boolean = true;

	// Ancestor-descendant options
	private ancestorDescendantRoot: SelectedPerson | null = null;
	private ancestorDescendantIncludeSpouses: boolean = true;
	private ancestorDescendantMaxAncestors?: number;
	private ancestorDescendantMaxDescendants?: number;

	// Surname split options
	private selectedSurnames: string[] = [];
	private availableSurnames: string[] = [];
	private surnameIncludeSpouses: boolean = true;
	private surnameIncludeMaidenNames: boolean = true;
	private surnameHandleVariants: boolean = true;
	private surnameSeparateCanvases: boolean = true;

	// Preview data
	private previewData: {
		canvasCount: number;
		totalPeople: number;
		details: string[];
	} | null = null;

	// Generation state
	private isGenerating: boolean = false;
	private generationResults: CanvasWriteResult[] | null = null;

	constructor(
		app: App,
		settings: CanvasRootsSettings,
		folderFilter?: FolderFilterService
	) {
		super(app);
		this.settings = settings;
		this.folderFilter = folderFilter;
		this.familyGraph = new FamilyGraphService(app);
		if (folderFilter) {
			this.familyGraph.setFolderFilter(folderFilter);
		}
		this.splitService = new CanvasSplitService();

		// Set default output folder from settings (peopleFolder as fallback)
		this.outputFolder = settings.peopleFolder || '';
	}

	async onOpen(): Promise<void> {
		const { contentEl, titleEl } = this;
		titleEl.setText('Split canvas wizard');
		contentEl.addClass('crc-split-wizard');

		// Load family tree data
		await this.loadFamilyTree();

		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	/**
	 * Load family tree data for the wizard
	 */
	private async loadFamilyTree(): Promise<void> {
		try {
			// Find all people and build tree
			const components = await this.familyGraph.findAllFamilyComponents();
			if (components.length === 0) {
				return;
			}

			// Use the largest component as the primary tree
			const largestComponent = components.reduce((a, b) =>
				a.size > b.size ? a : b
			);

			this.tree = this.familyGraph.generateTree({
				rootCrId: largestComponent.representative.crId,
				treeType: 'full'
			});

			// Load available collections
			this.loadAvailableCollections();
		} catch (error) {
			logger.error('loadFamilyTree', `Failed to load family tree: ${error}`);
		}
	}

	/**
	 * Load available collections from person notes
	 */
	private loadAvailableCollections(): void {
		const collections = new Set<string>();

		if (this.tree) {
			for (const person of this.tree.nodes.values()) {
				if (person.collection) {
					collections.add(person.collection);
				}
			}
		}

		this.availableCollections = Array.from(collections).sort();
	}

	/**
	 * Render the current wizard step
	 */
	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Progress indicator
		this.renderProgressIndicator();

		// Step content
		switch (this.currentStep) {
			case 'method':
				this.renderMethodStep();
				break;
			case 'configure':
				this.renderConfigureStep();
				break;
			case 'preview':
				this.renderPreviewStep();
				break;
			case 'complete':
				this.renderCompleteStep();
				break;
		}

		// Navigation buttons
		this.renderNavigationButtons();
	}

	/**
	 * Render step progress indicator
	 */
	private renderProgressIndicator(): void {
		const { contentEl } = this;
		const steps: WizardStep[] = ['method', 'configure', 'preview', 'complete'];
		const stepLabels = ['Choose method', 'Configure', 'Preview', 'Complete'];

		const progressEl = contentEl.createDiv({ cls: 'crc-wizard-progress' });

		steps.forEach((step, index) => {
			const stepEl = progressEl.createDiv({
				cls: `crc-wizard-progress-step ${step === this.currentStep ? 'is-active' : ''} ${steps.indexOf(this.currentStep) > index ? 'is-completed' : ''}`
			});

			stepEl.createDiv({
				cls: 'crc-wizard-progress-step-number',
				text: String(index + 1)
			});

			stepEl.createDiv({
				cls: 'crc-wizard-progress-step-label',
				text: stepLabels[index]
			});

			if (index < steps.length - 1) {
				progressEl.createDiv({ cls: 'crc-wizard-progress-connector' });
			}
		});
	}

	/**
	 * Render method selection step
	 */
	private renderMethodStep(): void {
		const { contentEl } = this;

		const stepContainer = contentEl.createDiv({ cls: 'crc-split-wizard-step' });
		stepContainer.createDiv({
			cls: 'crc-split-wizard-step-header',
			text: 'Choose how to split your family tree canvas'
		});

		const methods: Array<{
			id: SplitMethod;
			label: string;
			desc: string;
			icon: LucideIconName;
		}> = [
			{
				id: 'generation',
				label: 'By generation',
				desc: 'Split every N generations into separate canvases',
				icon: 'layers'
			},
			{
				id: 'branch',
				label: 'By branch',
				desc: 'Separate paternal and maternal lines',
				icon: 'git-branch'
			},
			{
				id: 'lineage',
				label: 'Single lineage',
				desc: 'Extract a direct line between two people',
				icon: 'arrow-down'
			},
			{
				id: 'collection',
				label: 'By collection',
				desc: 'One canvas per user-defined collection',
				icon: 'folder'
			},
			{
				id: 'ancestor-descendant',
				label: 'Ancestor + descendant pair',
				desc: 'Create linked ancestor and descendant canvases',
				icon: 'arrow-up-down'
			},
			{
				id: 'surname',
				label: 'By surname',
				desc: 'Extract all people with a given surname (even without connections)',
				icon: 'users'
			}
		];

		const methodsContainer = stepContainer.createDiv({ cls: 'crc-split-methods' });

		methods.forEach(method => {
			const methodEl = methodsContainer.createDiv({
				cls: `crc-split-method ${this.selectedMethod === method.id ? 'is-selected' : ''}`
			});

			// Radio button
			const radio = methodEl.createEl('input', {
				type: 'radio',
				attr: {
					name: 'split-method',
					value: method.id
				}
			});
			if (this.selectedMethod === method.id) {
				radio.checked = true;
			}

			// Icon
			const iconEl = methodEl.createDiv({ cls: 'crc-split-method-icon' });
			iconEl.appendChild(createLucideIcon(method.icon, 20));

			// Label and description
			const textEl = methodEl.createDiv({ cls: 'crc-split-method-text' });
			textEl.createDiv({ cls: 'crc-split-method-label', text: method.label });
			textEl.createDiv({ cls: 'crc-split-method-desc', text: method.desc });

			// Click handler
			methodEl.addEventListener('click', () => {
				this.selectedMethod = method.id;
				this.render();
			});
		});
	}

	/**
	 * Render configuration step based on selected method
	 */
	private renderConfigureStep(): void {
		const { contentEl } = this;

		const stepContainer = contentEl.createDiv({ cls: 'crc-split-wizard-step' });

		// Method-specific configuration
		switch (this.selectedMethod) {
			case 'generation':
				this.renderGenerationConfig(stepContainer);
				break;
			case 'branch':
				this.renderBranchConfig(stepContainer);
				break;
			case 'lineage':
				this.renderLineageConfig(stepContainer);
				break;
			case 'collection':
				this.renderCollectionConfig(stepContainer);
				break;
			case 'ancestor-descendant':
				this.renderAncestorDescendantConfig(stepContainer);
				break;
			case 'surname':
				this.renderSurnameConfig(stepContainer);
				break;
		}

		// Common output options
		this.renderOutputOptions(stepContainer);
	}

	/**
	 * Render generation split configuration
	 */
	private renderGenerationConfig(container: HTMLElement): void {
		container.createDiv({
			cls: 'crc-split-wizard-step-header',
			text: 'Configure generation-based split'
		});

		const configSection = container.createDiv({ cls: 'crc-split-config-section' });

		// Root person selection
		new Setting(configSection)
			.setName('Root person')
			.setDesc('The person to start counting generations from')
			.addButton(btn => {
				btn
					.setButtonText(this.selectedRootPerson?.name || 'Select person')
					.onClick(() => {
						new PersonPickerModal(this.app, (person: PersonInfo) => {
							this.selectedRootPerson = { crId: person.crId, name: person.name };
							this.render();
						}, this.folderFilter).open();
					});
			});

		// Generations per canvas
		new Setting(configSection)
			.setName('Generations per canvas')
			.setDesc('How many generations to include in each canvas')
			.addSlider(slider => {
				slider
					.setLimits(2, 10, 1)
					.setValue(this.generationsPerCanvas)
					.setDynamicTooltip()
					.onChange(value => {
						this.generationsPerCanvas = value;
					});
			});

		// Generation direction
		new Setting(configSection)
			.setName('Direction')
			.setDesc('Count generations upward (ancestors) or downward (descendants)')
			.addDropdown(dropdown => {
				dropdown
					.addOption('up', 'Ancestors (upward)')
					.addOption('down', 'Descendants (downward)')
					.setValue(this.generationDirection)
					.onChange(value => {
						this.generationDirection = value as 'up' | 'down';
					});
			});
	}

	/**
	 * Render branch split configuration
	 */
	private renderBranchConfig(container: HTMLElement): void {
		container.createDiv({
			cls: 'crc-split-wizard-step-header',
			text: 'Configure branch-based split'
		});

		const configSection = container.createDiv({ cls: 'crc-split-config-section' });

		// Anchor person selection
		new Setting(configSection)
			.setName('Anchor person')
			.setDesc('The person whose family branches will be split')
			.addButton(btn => {
				btn
					.setButtonText(this.branchAnchorPerson?.name || 'Select person')
					.onClick(() => {
						new PersonPickerModal(this.app, (person: PersonInfo) => {
							this.branchAnchorPerson = { crId: person.crId, name: person.name };
							this.render();
						}, this.folderFilter).open();
					});
			});

		// Branch toggles
		new Setting(configSection)
			.setName('Include paternal line')
			.setDesc("Father's ancestors")
			.addToggle(toggle => {
				toggle
					.setValue(this.includePaternal)
					.onChange(value => {
						this.includePaternal = value;
					});
			});

		new Setting(configSection)
			.setName('Include maternal line')
			.setDesc("Mother's ancestors")
			.addToggle(toggle => {
				toggle
					.setValue(this.includeMaternal)
					.onChange(value => {
						this.includeMaternal = value;
					});
			});

		new Setting(configSection)
			.setName('Include descendants')
			.setDesc('Create canvases for descendant lines')
			.addToggle(toggle => {
				toggle
					.setValue(this.includeDescendants)
					.onChange(value => {
						this.includeDescendants = value;
					});
			});

		// Max generations
		new Setting(configSection)
			.setName('Maximum generations')
			.setDesc('Limit how many generations to include (leave empty for all)')
			.addText(text => {
				text
					.setPlaceholder('Unlimited')
					.setValue(this.branchMaxGenerations?.toString() || '')
					.onChange(value => {
						const num = parseInt(value, 10);
						this.branchMaxGenerations = isNaN(num) ? undefined : num;
					});
			});
	}

	/**
	 * Render lineage extraction configuration
	 */
	private renderLineageConfig(container: HTMLElement): void {
		container.createDiv({
			cls: 'crc-split-wizard-step-header',
			text: 'Configure lineage extraction'
		});

		const configSection = container.createDiv({ cls: 'crc-split-config-section' });

		// Start person
		new Setting(configSection)
			.setName('Start person')
			.setDesc('The older person in the lineage (e.g., oldest ancestor)')
			.addButton(btn => {
				btn
					.setButtonText(this.lineageStartPerson?.name || 'Select person')
					.onClick(() => {
						new PersonPickerModal(this.app, (person: PersonInfo) => {
							this.lineageStartPerson = { crId: person.crId, name: person.name };
							this.render();
						}, this.folderFilter).open();
					});
			});

		// End person
		new Setting(configSection)
			.setName('End person')
			.setDesc('The younger person in the lineage (e.g., youngest descendant)')
			.addButton(btn => {
				btn
					.setButtonText(this.lineageEndPerson?.name || 'Select person')
					.onClick(() => {
						new PersonPickerModal(this.app, (person: PersonInfo) => {
							this.lineageEndPerson = { crId: person.crId, name: person.name };
							this.render();
						}, this.folderFilter).open();
					});
			});

		// Include spouses
		new Setting(configSection)
			.setName('Include spouses')
			.setDesc('Include spouses of people on the lineage')
			.addToggle(toggle => {
				toggle
					.setValue(this.lineageIncludeSpouses)
					.onChange(value => {
						this.lineageIncludeSpouses = value;
					});
			});

		// Include siblings
		new Setting(configSection)
			.setName('Include siblings')
			.setDesc('Include siblings at each generation')
			.addToggle(toggle => {
				toggle
					.setValue(this.lineageIncludeSiblings)
					.onChange(value => {
						this.lineageIncludeSiblings = value;
					});
			});
	}

	/**
	 * Render collection split configuration
	 */
	private renderCollectionConfig(container: HTMLElement): void {
		container.createDiv({
			cls: 'crc-split-wizard-step-header',
			text: 'Configure collection-based split'
		});

		const configSection = container.createDiv({ cls: 'crc-split-config-section' });

		if (this.availableCollections.length === 0) {
			configSection.createDiv({
				cls: 'crc-split-info',
				text: 'No collections found. Add the "collection" property to person notes to use this feature.'
			});
			return;
		}

		// Collection selection
		configSection.createDiv({
			cls: 'crc-split-config-section-header',
			text: 'Select collections to include'
		});

		const collectionList = configSection.createDiv({ cls: 'crc-collection-list' });

		this.availableCollections.forEach(collection => {
			const item = collectionList.createDiv({ cls: 'crc-collection-item' });

			const checkbox = item.createEl('input', {
				type: 'checkbox',
				attr: { id: `collection-${collection}` }
			});
			checkbox.checked = this.selectedCollections.includes(collection);
			checkbox.addEventListener('change', () => {
				if (checkbox.checked) {
					this.selectedCollections.push(collection);
				} else {
					this.selectedCollections = this.selectedCollections.filter(
						c => c !== collection
					);
				}
				this.updateNavigationButtons();
			});

			item.createEl('label', {
				text: collection,
				attr: { for: `collection-${collection}` }
			});
		});

		// Bridge people option
		new Setting(configSection)
			.setName('Include bridge people')
			.setDesc('Include people who appear in multiple collections on each canvas')
			.addToggle(toggle => {
				toggle
					.setValue(this.collectionIncludeBridgePeople)
					.onChange(value => {
						this.collectionIncludeBridgePeople = value;
					});
			});
	}

	/**
	 * Render ancestor-descendant split configuration
	 */
	private renderAncestorDescendantConfig(container: HTMLElement): void {
		container.createDiv({
			cls: 'crc-split-wizard-step-header',
			text: 'Configure ancestor-descendant pair'
		});

		const configSection = container.createDiv({ cls: 'crc-split-config-section' });

		// Root person selection
		new Setting(configSection)
			.setName('Center person')
			.setDesc('The person at the center - ancestors go up, descendants go down')
			.addButton(btn => {
				btn
					.setButtonText(this.ancestorDescendantRoot?.name || 'Select person')
					.onClick(() => {
						new PersonPickerModal(this.app, (person: PersonInfo) => {
							this.ancestorDescendantRoot = { crId: person.crId, name: person.name };
							this.render();
						}, this.folderFilter).open();
					});
			});

		// Include spouses
		new Setting(configSection)
			.setName('Include spouses')
			.setDesc('Include spouses in both canvases')
			.addToggle(toggle => {
				toggle
					.setValue(this.ancestorDescendantIncludeSpouses)
					.onChange(value => {
						this.ancestorDescendantIncludeSpouses = value;
					});
			});

		// Max ancestor generations
		new Setting(configSection)
			.setName('Maximum ancestor generations')
			.setDesc('Limit ancestor depth (leave empty for all)')
			.addText(text => {
				text
					.setPlaceholder('Unlimited')
					.setValue(this.ancestorDescendantMaxAncestors?.toString() || '')
					.onChange(value => {
						const num = parseInt(value, 10);
						this.ancestorDescendantMaxAncestors = isNaN(num) ? undefined : num;
					});
			});

		// Max descendant generations
		new Setting(configSection)
			.setName('Maximum descendant generations')
			.setDesc('Limit descendant depth (leave empty for all)')
			.addText(text => {
				text
					.setPlaceholder('Unlimited')
					.setValue(this.ancestorDescendantMaxDescendants?.toString() || '')
					.onChange(value => {
						const num = parseInt(value, 10);
						this.ancestorDescendantMaxDescendants = isNaN(num) ? undefined : num;
					});
			});
	}

	/**
	 * Render surname split configuration
	 */
	private renderSurnameConfig(container: HTMLElement): void {
		container.createDiv({
			cls: 'crc-split-wizard-step-header',
			text: 'Configure surname-based extraction'
		});

		const configSection = container.createDiv({ cls: 'crc-split-config-section' });

		// Load surnames if not already loaded
		if (this.availableSurnames.length === 0) {
			this.loadAvailableSurnames();
		}

		if (this.availableSurnames.length === 0) {
			configSection.createDiv({
				cls: 'crc-split-info',
				text: 'No people found. Ensure person notes exist in your vault.'
			});
			return;
		}

		// Surname selection
		configSection.createDiv({
			cls: 'crc-split-config-section-header',
			text: `Select surnames to extract (${this.availableSurnames.length} found)`
		});

		const surnameList = configSection.createDiv({ cls: 'crc-collection-list' });

		this.availableSurnames.forEach(surname => {
			const item = surnameList.createDiv({ cls: 'crc-collection-item' });

			const checkbox = item.createEl('input', {
				type: 'checkbox',
				attr: { id: `surname-${surname}` }
			});
			checkbox.checked = this.selectedSurnames.includes(surname);
			checkbox.addEventListener('change', () => {
				if (checkbox.checked) {
					this.selectedSurnames.push(surname);
				} else {
					this.selectedSurnames = this.selectedSurnames.filter(
						s => s !== surname
					);
				}
				this.updateNavigationButtons();
			});

			// Get count for this surname
			const count = this.getSurnameCount(surname);
			item.createEl('label', {
				text: `${surname} (${count})`,
				attr: { for: `surname-${surname}` }
			});
		});

		// Additional options
		configSection.createDiv({
			cls: 'crc-split-config-section-header',
			text: 'Options',
			attr: { style: 'margin-top: var(--size-4-3);' }
		});

		// Include spouses
		new Setting(configSection)
			.setName('Include spouses')
			.setDesc('Include spouses of matching people (with different surnames)')
			.addToggle(toggle => {
				toggle
					.setValue(this.surnameIncludeSpouses)
					.onChange(value => {
						this.surnameIncludeSpouses = value;
					});
			});

		// Include maiden names
		new Setting(configSection)
			.setName('Include maiden names')
			.setDesc('Also match people whose maiden name matches the surname')
			.addToggle(toggle => {
				toggle
					.setValue(this.surnameIncludeMaidenNames)
					.onChange(value => {
						this.surnameIncludeMaidenNames = value;
					});
			});

		// Handle variants
		new Setting(configSection)
			.setName('Handle name variants')
			.setDesc('Treat similar spellings as the same surname (e.g., Smith/Smythe)')
			.addToggle(toggle => {
				toggle
					.setValue(this.surnameHandleVariants)
					.onChange(value => {
						this.surnameHandleVariants = value;
					});
			});

		// Separate canvases per surname
		new Setting(configSection)
			.setName('Separate canvas per surname')
			.setDesc('Create one canvas per surname (off = combine all into one)')
			.addToggle(toggle => {
				toggle
					.setValue(this.surnameSeparateCanvases)
					.onChange(value => {
						this.surnameSeparateCanvases = value;
					});
			});
	}

	/**
	 * Load available surnames from all people
	 */
	private loadAvailableSurnames(): void {
		const surnames = new Map<string, number>();

		// Scan all people files in the vault
		const files = this.app.vault.getMarkdownFiles();
		const peopleFolder = this.settings.peopleFolder;

		for (const file of files) {
			// Check if file is in people folder
			if (peopleFolder && !file.path.startsWith(peopleFolder)) {
				continue;
			}

			// Apply folder filter if set
			if (this.folderFilter && !this.folderFilter.shouldIncludePath(file.path)) {
				continue;
			}

			// Extract surname from file name (last word typically)
			const baseName = file.basename;
			const nameParts = baseName.split(/\s+/);
			if (nameParts.length >= 2) {
				const surname = nameParts[nameParts.length - 1];
				// Skip if it looks like a date or number
				if (!/^\d+$/.test(surname) && surname.length > 1) {
					surnames.set(surname, (surnames.get(surname) || 0) + 1);
				}
			}
		}

		// Sort by count (most common first), then alphabetically
		this.availableSurnames = Array.from(surnames.entries())
			.sort((a, b) => {
				if (b[1] !== a[1]) return b[1] - a[1];
				return a[0].localeCompare(b[0]);
			})
			.map(([name]) => name);
	}

	/**
	 * Get count of people with a given surname
	 */
	private getSurnameCount(surname: string): number {
		let count = 0;
		const files = this.app.vault.getMarkdownFiles();
		const peopleFolder = this.settings.peopleFolder;

		for (const file of files) {
			if (peopleFolder && !file.path.startsWith(peopleFolder)) {
				continue;
			}
			if (this.folderFilter && !this.folderFilter.shouldIncludePath(file.path)) {
				continue;
			}

			const baseName = file.basename;
			const nameParts = baseName.split(/\s+/);
			if (nameParts.length >= 2) {
				const fileSurname = nameParts[nameParts.length - 1];
				if (fileSurname.toLowerCase() === surname.toLowerCase()) {
					count++;
				}
			}
		}

		return count;
	}

	/**
	 * Render common output options
	 */
	private renderOutputOptions(container: HTMLElement): void {
		const outputSection = container.createDiv({ cls: 'crc-split-config-section' });
		outputSection.createDiv({
			cls: 'crc-split-config-section-header',
			text: 'Output options'
		});

		// Output folder
		new Setting(outputSection)
			.setName('Output folder')
			.setDesc('Where to save generated canvases')
			.addText(text => {
				text
					.setPlaceholder('Root folder')
					.setValue(this.outputFolder)
					.onChange(value => {
						this.outputFolder = value;
					});
			})
			.addExtraButton(btn => {
				btn
					.setIcon('folder')
					.setTooltip('Browse folders')
					.onClick(() => {
						this.browseFolder();
					});
			});

		// Filename prefix
		new Setting(outputSection)
			.setName('Filename prefix')
			.setDesc('Prefix for generated canvas files')
			.addText(text => {
				text
					.setPlaceholder('family-tree')
					.setValue(this.filenamePrefix)
					.onChange(value => {
						this.filenamePrefix = value;
					});
			});

		// Navigation nodes
		new Setting(outputSection)
			.setName('Include navigation nodes')
			.setDesc('Add portal nodes linking between canvases')
			.addToggle(toggle => {
				toggle
					.setValue(this.includeNavigationNodes)
					.onChange(value => {
						this.includeNavigationNodes = value;
					});
			});

		// Overview canvas
		new Setting(outputSection)
			.setName('Generate overview canvas')
			.setDesc('Create a master canvas showing relationships between generated canvases')
			.addToggle(toggle => {
				toggle
					.setValue(this.generateOverview)
					.onChange(value => {
						this.generateOverview = value;
					});
			});
	}

	/**
	 * Render preview step
	 */
	private renderPreviewStep(): void {
		const { contentEl } = this;

		const stepContainer = contentEl.createDiv({ cls: 'crc-split-wizard-step' });
		stepContainer.createDiv({
			cls: 'crc-split-wizard-step-header',
			text: 'Preview'
		});

		// Generate preview data
		this.generatePreview();

		if (!this.previewData) {
			stepContainer.createDiv({
				cls: 'crc-split-warning',
				text: 'Could not generate preview. Please check your configuration.'
			});
			return;
		}

		// Preview content
		const previewSection = stepContainer.createDiv({ cls: 'crc-split-preview' });

		previewSection.createDiv({
			cls: 'crc-split-preview-header',
			text: 'This configuration will create:'
		});

		const statsEl = previewSection.createDiv({ cls: 'crc-split-preview-stats' });
		statsEl.createDiv({
			text: `${this.previewData.canvasCount} canvas file${this.previewData.canvasCount !== 1 ? 's' : ''}`
		});
		statsEl.createDiv({
			text: `${this.previewData.totalPeople} people total`
		});

		if (this.previewData.details.length > 0) {
			const filesEl = previewSection.createDiv({ cls: 'crc-split-preview-files' });
			this.previewData.details.forEach(detail => {
				filesEl.createDiv({ cls: 'crc-split-preview-file', text: detail });
			});
		}

		// Show generation results if available
		if (this.generationResults) {
			const resultsSection = stepContainer.createDiv({ cls: 'crc-split-preview' });
			resultsSection.createDiv({
				cls: 'crc-split-preview-header',
				text: 'Generation results:'
			});

			const successCount = this.generationResults.filter(r => r.success).length;
			const failCount = this.generationResults.filter(r => !r.success).length;

			const resultsEl = resultsSection.createDiv({ cls: 'crc-split-preview-stats' });

			if (successCount > 0) {
				resultsEl.createDiv({
					text: `${successCount} canvas file${successCount !== 1 ? 's' : ''} created successfully`
				});
			}

			if (failCount > 0) {
				resultsEl.createDiv({
					text: `${failCount} failed`,
					cls: 'crc-split-warning'
				});

				// Show failed files
				for (const result of this.generationResults.filter(r => !r.success)) {
					resultsEl.createDiv({
						text: `  ${result.path}: ${result.error}`,
						cls: 'crc-split-warning'
					});
				}
			}

			// List created files
			if (successCount > 0) {
				const filesEl = resultsSection.createDiv({ cls: 'crc-split-preview-files' });
				for (const result of this.generationResults.filter(r => r.success)) {
					filesEl.createDiv({ cls: 'crc-split-preview-file', text: result.path });
				}
			}
		} else if (this.isGenerating) {
			// Show generating indicator
			const infoEl = stepContainer.createDiv({ cls: 'crc-split-info' });
			const infoIcon = createLucideIcon('refresh-cw', 16);
			infoEl.appendChild(infoIcon);
			infoEl.createSpan({ text: 'Generating canvas files...' });
		}
	}

	/**
	 * Render the completion step with results summary
	 */
	private renderCompleteStep(): void {
		const { contentEl } = this;
		const stepContainer = contentEl.createDiv({ cls: 'crc-wizard-step' });

		if (!this.generationResults) {
			stepContainer.createEl('p', { text: 'No results available.' });
			return;
		}

		const successCount = this.generationResults.filter(r => r.success).length;
		const failCount = this.generationResults.filter(r => !r.success).length;

		// Header with appropriate icon
		const headerEl = stepContainer.createDiv({ cls: 'crc-split-complete-header' });
		if (failCount === 0 && successCount > 0) {
			const icon = createLucideIcon('check', 24);
			icon.addClass('crc-split-complete-icon', 'mod-success');
			headerEl.appendChild(icon);
			headerEl.createEl('h3', { text: 'Generation complete' });
		} else if (successCount > 0 && failCount > 0) {
			const icon = createLucideIcon('alert-triangle', 24);
			icon.addClass('crc-split-complete-icon', 'mod-warning');
			headerEl.appendChild(icon);
			headerEl.createEl('h3', { text: 'Generation completed with errors' });
		} else {
			const icon = createLucideIcon('alert-circle', 24);
			icon.addClass('crc-split-complete-icon', 'mod-error');
			headerEl.appendChild(icon);
			headerEl.createEl('h3', { text: 'Generation failed' });
		}

		// Summary stats
		const statsEl = stepContainer.createDiv({ cls: 'crc-split-complete-stats' });
		if (successCount > 0) {
			statsEl.createDiv({
				cls: 'crc-split-complete-stat mod-success',
				text: `${successCount} canvas file${successCount !== 1 ? 's' : ''} created`
			});
		}
		if (failCount > 0) {
			statsEl.createDiv({
				cls: 'crc-split-complete-stat mod-error',
				text: `${failCount} failed`
			});
		}

		// List created files
		if (successCount > 0) {
			const filesSection = stepContainer.createDiv({ cls: 'crc-split-complete-section' });
			filesSection.createEl('h4', { text: 'Created files:' });
			const filesList = filesSection.createDiv({ cls: 'crc-split-complete-files' });
			for (const result of this.generationResults.filter(r => r.success)) {
				const fileItem = filesList.createDiv({ cls: 'crc-split-complete-file' });
				const fileIcon = createLucideIcon('file', 14);
				fileItem.appendChild(fileIcon);
				fileItem.createSpan({ text: result.path });
			}
		}

		// List errors if any
		if (failCount > 0) {
			const errorsSection = stepContainer.createDiv({ cls: 'crc-split-complete-section' });
			errorsSection.createEl('h4', { text: 'Errors:' });
			const errorsList = errorsSection.createDiv({ cls: 'crc-split-complete-errors' });
			for (const result of this.generationResults.filter(r => !r.success)) {
				const errorItem = errorsList.createDiv({ cls: 'crc-split-complete-error' });
				errorItem.createSpan({ text: result.path || 'Unknown', cls: 'crc-split-complete-error-path' });
				errorItem.createSpan({ text: result.error || 'Unknown error', cls: 'crc-split-complete-error-message' });
			}
		}

		// Method summary
		const summarySection = stepContainer.createDiv({ cls: 'crc-split-complete-section' });
		summarySection.createEl('h4', { text: 'Configuration used:' });
		const summaryList = summarySection.createEl('ul', { cls: 'crc-split-complete-summary' });
		summaryList.createEl('li', { text: `Method: ${this.getMethodLabel(this.selectedMethod)}` });
		if (this.outputFolder) {
			summaryList.createEl('li', { text: `Output folder: ${this.outputFolder}` });
		}
		if (this.filenamePrefix) {
			summaryList.createEl('li', { text: `Filename prefix: ${this.filenamePrefix}` });
		}
	}

	/**
	 * Get human-readable label for a split method
	 */
	private getMethodLabel(method: SplitMethod | null): string {
		switch (method) {
			case 'generation': return 'Split by generation';
			case 'branch': return 'Split by branch';
			case 'lineage': return 'Single lineage extraction';
			case 'collection': return 'Split by collection';
			case 'ancestor-descendant': return 'Ancestor + descendant pair';
			case 'surname': return 'Split by surname';
			default: return 'Unknown';
		}
	}

	/**
	 * Generate preview data based on current configuration
	 */
	private generatePreview(): void {
		// Surname split doesn't need the tree
		if (this.selectedMethod !== 'surname' && !this.tree) {
			this.previewData = null;
			return;
		}

		try {
			switch (this.selectedMethod) {
				case 'generation':
					this.previewGenerationSplit();
					break;
				case 'branch':
					this.previewBranchSplit();
					break;
				case 'lineage':
					this.previewLineageSplit();
					break;
				case 'collection':
					this.previewCollectionSplit();
					break;
				case 'ancestor-descendant':
					this.previewAncestorDescendantSplit();
					break;
				case 'surname':
					this.previewSurnameSplit();
					break;
				default:
					this.previewData = null;
			}
		} catch (error) {
			logger.error('generatePreview', `Preview generation failed: ${error}`);
			this.previewData = null;
		}
	}

	/**
	 * Preview generation-based split
	 */
	private previewGenerationSplit(): void {
		if (!this.selectedRootPerson) {
			this.previewData = null;
			return;
		}

		const tree = this.getTreeContainingPerson(this.selectedRootPerson.crId);
		if (!tree) {
			this.previewData = {
				canvasCount: 0,
				totalPeople: 0,
				details: ['Could not build family tree for selected person']
			};
			return;
		}

		const preview = this.splitService.previewGenerationSplit(tree, {
			...DEFAULT_GENERATION_SPLIT_OPTIONS,
			generationsPerCanvas: this.generationsPerCanvas,
			generationDirection: this.generationDirection
		});

		const canvasCount = preview.ranges.length + (this.generateOverview ? 1 : 0);
		const prefix = this.filenamePrefix || 'family-tree';

		this.previewData = {
			canvasCount,
			totalPeople: preview.totalPeople,
			details: preview.ranges.map(r => {
				const count = preview.peopleCounts.get(r.label) || 0;
				return `${prefix}-gen-${r.start}-${r.end}.canvas (${count} people)`;
			})
		};

		if (this.generateOverview) {
			this.previewData.details.push(`${prefix}-overview.canvas`);
		}
	}

	/**
	 * Preview branch-based split
	 */
	private previewBranchSplit(): void {
		if (!this.branchAnchorPerson) {
			this.previewData = null;
			return;
		}

		const tree = this.getTreeContainingPerson(this.branchAnchorPerson.crId);
		if (!tree) {
			this.previewData = {
				canvasCount: 0,
				totalPeople: 0,
				details: ['Could not build family tree for selected person']
			};
			return;
		}

		const preview = this.splitService.previewBranchSplit(tree, {
			...DEFAULT_BRANCH_SPLIT_OPTIONS,
			branches: this.buildBranchDefinitions(),
			maxGenerations: this.branchMaxGenerations
		});

		const canvasCount = preview.branches.length + (this.generateOverview ? 1 : 0);
		const prefix = this.filenamePrefix || this.branchAnchorPerson.name.replace(/\s+/g, '-');

		this.previewData = {
			canvasCount,
			totalPeople: preview.totalPeople,
			details: preview.branches.map(b =>
				`${prefix}-${b.definition.label}.canvas (${b.peopleCount} people)`
			)
		};

		if (this.generateOverview) {
			this.previewData.details.push(`${prefix}-overview.canvas`);
		}
	}

	/**
	 * Build branch definitions from current settings
	 */
	private buildBranchDefinitions(): Array<{
		type: 'paternal' | 'maternal' | 'descendant';
		anchorCrId: string;
		label: string;
	}> {
		if (!this.branchAnchorPerson) return [];

		const branches: Array<{
			type: 'paternal' | 'maternal' | 'descendant';
			anchorCrId: string;
			label: string;
		}> = [];

		if (this.includePaternal) {
			branches.push({
				type: 'paternal',
				anchorCrId: this.branchAnchorPerson.crId,
				label: 'paternal'
			});
		}

		if (this.includeMaternal) {
			branches.push({
				type: 'maternal',
				anchorCrId: this.branchAnchorPerson.crId,
				label: 'maternal'
			});
		}

		if (this.includeDescendants) {
			branches.push({
				type: 'descendant',
				anchorCrId: this.branchAnchorPerson.crId,
				label: 'descendants'
			});
		}

		return branches;
	}

	/**
	 * Preview lineage extraction
	 */
	private previewLineageSplit(): void {
		if (!this.lineageStartPerson || !this.lineageEndPerson) {
			this.previewData = null;
			return;
		}

		// Build a tree that includes the start person to ensure we can find paths
		const tree = this.getTreeContainingPerson(this.lineageStartPerson.crId);
		if (!tree) {
			this.previewData = {
				canvasCount: 0,
				totalPeople: 0,
				details: ['Could not build family tree for selected person']
			};
			return;
		}

		const preview = this.splitService.previewLineageExtraction(tree, {
			...DEFAULT_LINEAGE_SPLIT_OPTIONS,
			startCrId: this.lineageStartPerson.crId,
			endCrId: this.lineageEndPerson.crId,
			includeSpouses: this.lineageIncludeSpouses,
			includeSiblings: this.lineageIncludeSiblings
		});

		if (!preview.pathFound) {
			this.previewData = {
				canvasCount: 0,
				totalPeople: 0,
				details: ['No path found between selected people', 'They may not be directly related through parent-child relationships']
			};
			return;
		}

		const prefix = this.filenamePrefix || 'lineage';

		this.previewData = {
			canvasCount: 1,
			totalPeople: preview.totalCount,
			details: [
				`${prefix}.canvas`,
				`Path: ${preview.generationCount} generations`,
				`Direct line: ${preview.lineageCount} people`,
				`Total with spouses/siblings: ${preview.totalCount} people`
			]
		};
	}

	/**
	 * Preview collection-based split
	 */
	private previewCollectionSplit(): void {
		if (!this.tree || this.selectedCollections.length === 0) {
			this.previewData = null;
			return;
		}

		const preview = this.splitService.previewCollectionSplit(this.tree, {
			...DEFAULT_COLLECTION_SPLIT_OPTIONS,
			collections: this.selectedCollections
		});

		const canvasCount = preview.collections.length + (this.generateOverview ? 1 : 0);
		const prefix = this.filenamePrefix || 'collection';

		this.previewData = {
			canvasCount,
			totalPeople: preview.totalPeople,
			details: preview.collections.map(c =>
				`${prefix}-${c.name.replace(/\s+/g, '-')}.canvas (${c.peopleCount} people)`
			)
		};

		if (preview.totalBridgePeople > 0) {
			this.previewData.details.push(
				`${preview.totalBridgePeople} bridge people appear in multiple canvases`
			);
		}

		if (this.generateOverview) {
			this.previewData.details.push(`${prefix}-overview.canvas`);
		}
	}

	/**
	 * Preview ancestor-descendant split
	 */
	private previewAncestorDescendantSplit(): void {
		if (!this.ancestorDescendantRoot) {
			this.previewData = null;
			return;
		}

		const tree = this.getTreeContainingPerson(this.ancestorDescendantRoot.crId);
		if (!tree) {
			this.previewData = {
				canvasCount: 0,
				totalPeople: 0,
				details: ['Could not build family tree for selected person']
			};
			return;
		}

		const preview = this.splitService.previewAncestorDescendantPair(tree, {
			...DEFAULT_ANCESTOR_DESCENDANT_OPTIONS,
			rootCrId: this.ancestorDescendantRoot.crId,
			includeSpouses: this.ancestorDescendantIncludeSpouses,
			maxAncestorGenerations: this.ancestorDescendantMaxAncestors,
			maxDescendantGenerations: this.ancestorDescendantMaxDescendants
		});

		const canvasCount = 2 + (this.generateOverview ? 1 : 0);
		const prefix = this.filenamePrefix || this.ancestorDescendantRoot.name.replace(/\s+/g, '-');

		this.previewData = {
			canvasCount,
			totalPeople: preview.totalUniquePeople,
			details: [
				`${prefix}-ancestors.canvas (${preview.ancestorCount} people, ${preview.ancestorGenerations} generations)`,
				`${prefix}-descendants.canvas (${preview.descendantCount} people, ${preview.descendantGenerations} generations)`
			]
		};

		if (this.generateOverview) {
			this.previewData.details.push(`${prefix}-overview.canvas`);
		}
	}

	/**
	 * Preview surname-based split
	 */
	private previewSurnameSplit(): void {
		if (this.selectedSurnames.length === 0) {
			this.previewData = null;
			return;
		}

		// Build surname counts map
		const surnameCounts = new Map<string, number>();
		for (const surname of this.selectedSurnames) {
			surnameCounts.set(surname, this.getSurnameCount(surname));
		}

		const preview = this.splitService.previewSurnameSplit(surnameCounts, {
			...DEFAULT_SURNAME_SPLIT_OPTIONS,
			surnames: this.selectedSurnames,
			includeSpouses: this.surnameIncludeSpouses,
			includeMaidenNames: this.surnameIncludeMaidenNames,
			handleVariants: this.surnameHandleVariants,
			separateCanvases: this.surnameSeparateCanvases
		});

		// Note: Surname split doesn't support overview canvas generation yet
		const canvasCount = preview.canvasCount;
		const prefix = this.filenamePrefix || 'surname';

		const details: string[] = [];

		if (this.surnameSeparateCanvases) {
			// One canvas per surname
			for (const { name, count } of preview.surnames) {
				details.push(`${prefix}-${name.replace(/\s+/g, '-')}.canvas (${count} people)`);
			}
		} else {
			// Combined canvas
			const surnameList = preview.surnames.map(s => s.name).join(', ');
			details.push(`${prefix}-combined.canvas (${preview.totalPeople} people)`);
			details.push(`Surnames: ${surnameList}`);
		}

		if (this.surnameIncludeSpouses) {
			details.push('Spouses will be included');
		}

		if (this.surnameIncludeMaidenNames) {
			details.push('Maiden names will be matched');
		}

		this.previewData = {
			canvasCount,
			totalPeople: preview.totalPeople,
			details
		};
	}

	/**
	 * Render navigation buttons
	 */
	private renderNavigationButtons(): void {
		const { contentEl } = this;

		const buttonsEl = contentEl.createDiv({ cls: 'crc-wizard-buttons' });

		// Complete step only has Done button
		if (this.currentStep === 'complete') {
			const doneBtn = buttonsEl.createEl('button', {
				text: 'Done',
				cls: 'crc-wizard-btn mod-cta'
			});
			doneBtn.addEventListener('click', () => this.close());
			return;
		}

		// Cancel button
		const cancelBtn = buttonsEl.createEl('button', {
			text: 'Cancel',
			cls: 'crc-wizard-btn'
		});
		cancelBtn.addEventListener('click', () => this.close());

		// Back button (not on first step)
		if (this.currentStep !== 'method') {
			const backBtn = buttonsEl.createEl('button', {
				text: 'Back',
				cls: 'crc-wizard-btn'
			});
			backBtn.addEventListener('click', () => this.goBack());
		}

		// Next/Generate button
		if (this.currentStep === 'preview') {
			const generateBtn = buttonsEl.createEl('button', {
				text: this.isGenerating ? 'Generating...' : 'Generate',
				cls: 'crc-wizard-btn mod-cta'
			});

			if (this.isGenerating || !this.previewData || this.previewData.canvasCount === 0) {
				generateBtn.disabled = true;
			}

			generateBtn.addEventListener('click', async () => {
				await this.executeGeneration();
			});
		} else {
			const nextBtn = buttonsEl.createEl('button', {
				text: 'Next',
				cls: 'crc-wizard-btn mod-cta'
			});
			nextBtn.addEventListener('click', () => this.goNext());

			// Disable if requirements not met
			if (!this.canProceed()) {
				nextBtn.disabled = true;
			}
		}
	}

	/**
	 * Check if we can proceed to the next step
	 */
	private canProceed(): boolean {
		switch (this.currentStep) {
			case 'method':
				return this.selectedMethod !== null;
			case 'configure':
				return this.isConfigurationValid();
			default:
				return true;
		}
	}

	/**
	 * Update the navigation button states without full re-render
	 */
	private updateNavigationButtons(): void {
		const nextBtn = this.contentEl.querySelector('.crc-wizard-btn.mod-cta:not([disabled])') as HTMLButtonElement;
		const disabledBtn = this.contentEl.querySelector('.crc-wizard-btn.mod-cta[disabled]') as HTMLButtonElement;
		const btn = nextBtn || disabledBtn;

		if (btn && btn.textContent === 'Next') {
			btn.disabled = !this.canProceed();
		}
	}

	/**
	 * Check if current configuration is valid
	 */
	private isConfigurationValid(): boolean {
		switch (this.selectedMethod) {
			case 'generation':
				return this.selectedRootPerson !== null;
			case 'branch':
				return this.branchAnchorPerson !== null &&
					(this.includePaternal || this.includeMaternal || this.includeDescendants);
			case 'lineage':
				return this.lineageStartPerson !== null && this.lineageEndPerson !== null;
			case 'collection':
				return this.selectedCollections.length > 0;
			case 'ancestor-descendant':
				return this.ancestorDescendantRoot !== null;
			case 'surname':
				return this.selectedSurnames.length > 0;
			default:
				return false;
		}
	}

	/**
	 * Go to next step
	 */
	private goNext(): void {
		switch (this.currentStep) {
			case 'method':
				this.currentStep = 'configure';
				break;
			case 'configure':
				this.currentStep = 'preview';
				break;
		}
		this.render();
	}

	/**
	 * Get a tree that contains the given person
	 * This builds a tree from the component containing that person
	 */
	private getTreeContainingPerson(crId: string): FamilyTree | null {
		// First check if the person is in the already-loaded tree
		if (this.tree && this.tree.nodes.has(crId)) {
			return this.tree;
		}

		// Otherwise, build a tree from that person's component
		try {
			const tree = this.familyGraph.generateTree({
				rootCrId: crId,
				treeType: 'full'
			});
			return tree;
		} catch {
			return null;
		}
	}

	/**
	 * Go back to previous step
	 */
	private goBack(): void {
		switch (this.currentStep) {
			case 'configure':
				this.currentStep = 'method';
				break;
			case 'preview':
				this.currentStep = 'configure';
				break;
		}
		this.render();
	}

	/**
	 * Execute the canvas generation based on selected method and configuration
	 */
	private async executeGeneration(): Promise<void> {
		if (this.isGenerating) return;

		this.isGenerating = true;
		this.generationResults = null;
		this.render();

		try {
			let results: CanvasWriteResult[] = [];

			switch (this.selectedMethod) {
				case 'generation':
					results = await this.executeGenerationSplit();
					break;
				case 'branch':
					results = await this.executeBranchSplit();
					break;
				case 'lineage':
					results = await this.executeLineageSplit();
					break;
				case 'collection':
					results = await this.executeCollectionSplit();
					break;
				case 'ancestor-descendant':
					results = await this.executeAncestorDescendantSplit();
					break;
				case 'surname':
					results = await this.executeSurnameSplit();
					break;
			}

			this.generationResults = results;

			// Log results
			const successCount = results.filter(r => r.success).length;
			const failCount = results.filter(r => !r.success).length;
			logger.info('executeGeneration', `Generation complete: ${successCount} success, ${failCount} failed`, results);

			// Transition to complete step
			this.isGenerating = false;
			this.currentStep = 'complete';
			this.render();

		} catch (error) {
			logger.error('executeGeneration', 'Generation failed', error);
			new Notice(`Canvas generation failed: ${error instanceof Error ? error.message : String(error)}`);
			this.isGenerating = false;
			this.render();
		}
	}

	/**
	 * Execute generation-based split
	 */
	private async executeGenerationSplit(): Promise<CanvasWriteResult[]> {
		if (!this.selectedRootPerson) {
			return [{ success: false, path: '', error: 'No root person selected' }];
		}

		const tree = this.getTreeContainingPerson(this.selectedRootPerson.crId);
		if (!tree) {
			return [{ success: false, path: '', error: 'Could not build family tree' }];
		}

		const options: GenerationSplitOptions = {
			...DEFAULT_GENERATION_SPLIT_OPTIONS,
			generationsPerCanvas: this.generationsPerCanvas,
			generationDirection: this.generationDirection,
			outputFolder: this.outputFolder,
			filenamePattern: this.filenamePrefix ? `${this.filenamePrefix}-gen-{name}` : 'gen-{name}'
		};

		return await this.splitService.generateGenerationSplitCanvases(
			this.app,
			tree,
			options
		);
	}

	/**
	 * Execute branch-based split
	 */
	private async executeBranchSplit(): Promise<CanvasWriteResult[]> {
		if (!this.branchAnchorPerson) {
			return [{ success: false, path: '', error: 'No anchor person selected' }];
		}

		const tree = this.getTreeContainingPerson(this.branchAnchorPerson.crId);
		if (!tree) {
			return [{ success: false, path: '', error: 'Could not build family tree' }];
		}

		const options: BranchSplitOptions = {
			...DEFAULT_BRANCH_SPLIT_OPTIONS,
			branches: this.buildBranchDefinitions(),
			maxGenerations: this.branchMaxGenerations,
			outputFolder: this.outputFolder
		};

		return await this.splitService.generateBranchSplitCanvases(
			this.app,
			tree,
			options
		);
	}

	/**
	 * Execute lineage extraction
	 */
	private async executeLineageSplit(): Promise<CanvasWriteResult[]> {
		if (!this.lineageStartPerson || !this.lineageEndPerson) {
			return [{ success: false, path: '', error: 'Start and end persons required' }];
		}

		const tree = this.getTreeContainingPerson(this.lineageStartPerson.crId);
		if (!tree) {
			return [{ success: false, path: '', error: 'Could not build family tree' }];
		}

		const options: LineageSplitOptions = {
			...DEFAULT_LINEAGE_SPLIT_OPTIONS,
			startCrId: this.lineageStartPerson.crId,
			endCrId: this.lineageEndPerson.crId,
			includeSpouses: this.lineageIncludeSpouses,
			includeSiblings: this.lineageIncludeSiblings,
			outputFolder: this.outputFolder,
			label: this.filenamePrefix || 'lineage'
		};

		const result = await this.splitService.generateLineageCanvas(
			this.app,
			tree,
			options
		);

		return [result];
	}

	/**
	 * Execute collection-based split
	 */
	private async executeCollectionSplit(): Promise<CanvasWriteResult[]> {
		if (!this.tree || this.selectedCollections.length === 0) {
			return [{ success: false, path: '', error: 'No collections selected' }];
		}

		const options: CollectionSplitOptions = {
			...DEFAULT_COLLECTION_SPLIT_OPTIONS,
			collections: this.selectedCollections,
			bridgePeopleHandling: this.collectionIncludeBridgePeople ? 'duplicate' : 'primary-only',
			outputFolder: this.outputFolder
		};

		return await this.splitService.generateCollectionSplitCanvases(
			this.app,
			this.tree,
			options
		);
	}

	/**
	 * Execute ancestor-descendant split
	 */
	private async executeAncestorDescendantSplit(): Promise<CanvasWriteResult[]> {
		if (!this.ancestorDescendantRoot) {
			return [{ success: false, path: '', error: 'No center person selected' }];
		}

		const tree = this.getTreeContainingPerson(this.ancestorDescendantRoot.crId);
		if (!tree) {
			return [{ success: false, path: '', error: 'Could not build family tree' }];
		}

		const options: AncestorDescendantSplitOptions = {
			...DEFAULT_ANCESTOR_DESCENDANT_OPTIONS,
			rootCrId: this.ancestorDescendantRoot.crId,
			includeSpouses: this.ancestorDescendantIncludeSpouses,
			maxAncestorGenerations: this.ancestorDescendantMaxAncestors,
			maxDescendantGenerations: this.ancestorDescendantMaxDescendants,
			outputFolder: this.outputFolder,
			labelPrefix: this.filenamePrefix || this.ancestorDescendantRoot.name
		};

		return await this.splitService.generateAncestorDescendantCanvases(
			this.app,
			tree,
			options
		);
	}

	/**
	 * Execute surname-based split
	 *
	 * Surname split is unique because it works by scanning files directly
	 * rather than using an existing FamilyTree structure.
	 */
	private async executeSurnameSplit(): Promise<CanvasWriteResult[]> {
		if (this.selectedSurnames.length === 0) {
			return [{ success: false, path: '', error: 'No surnames selected' }];
		}

		const results: CanvasWriteResult[] = [];

		// Find all people matching the selected surnames
		const peopleByFile = await this.findPeopleBySurname(this.selectedSurnames);

		if (peopleByFile.size === 0) {
			return [{ success: false, path: '', error: 'No people found with selected surnames' }];
		}

		// Group by surname if separateCanvases is enabled
		if (this.surnameSeparateCanvases) {
			// Create one canvas per surname
			for (const surname of this.selectedSurnames) {
				const surnameFiles = new Map<string, string>();
				for (const [filePath, fileSurname] of peopleByFile) {
					if (fileSurname.toLowerCase() === surname.toLowerCase()) {
						surnameFiles.set(filePath, fileSurname);
					}
				}

				if (surnameFiles.size === 0) continue;

				const result = await this.generateSurnameCanvas(surname, surnameFiles);
				results.push(result);
			}
		} else {
			// Create one combined canvas for all surnames
			const combinedLabel = this.selectedSurnames.length === 1
				? this.selectedSurnames[0]
				: 'combined';
			const result = await this.generateSurnameCanvas(combinedLabel, peopleByFile);
			results.push(result);
		}

		return results;
	}

	/**
	 * Find all people matching any of the selected surnames
	 *
	 * @returns Map of file path -> matched surname
	 */
	private async findPeopleBySurname(surnames: string[]): Promise<Map<string, string>> {
		const peopleFiles = new Map<string, string>();
		const files = this.app.vault.getMarkdownFiles();
		const peopleFolder = this.settings.peopleFolder;
		const surnameLower = surnames.map(s => s.toLowerCase());

		for (const file of files) {
			// Filter by people folder
			if (peopleFolder && !file.path.startsWith(peopleFolder)) {
				continue;
			}

			// Apply folder filter if set
			if (this.folderFilter && !this.folderFilter.shouldIncludePath(file.path)) {
				continue;
			}

			// Extract surname from file name (last word)
			const baseName = file.basename;
			const nameParts = baseName.split(/\s+/);
			if (nameParts.length >= 2) {
				const fileSurname = nameParts[nameParts.length - 1];
				if (surnameLower.includes(fileSurname.toLowerCase())) {
					peopleFiles.set(file.path, fileSurname);
				}
			}

			// Also check maiden name if enabled
			if (this.surnameIncludeMaidenNames) {
				try {
					const metadata = this.app.metadataCache.getFileCache(file);
					const maidenName = metadata?.frontmatter?.maiden_name as string | undefined;
					if (maidenName && surnameLower.includes(maidenName.toLowerCase())) {
						peopleFiles.set(file.path, maidenName);
					}
				} catch {
					// Ignore metadata errors
				}
			}
		}

		return peopleFiles;
	}

	/**
	 * Generate a canvas for people with a given surname
	 */
	private async generateSurnameCanvas(
		label: string,
		peopleFiles: Map<string, string>
	): Promise<CanvasWriteResult> {
		// Get cr_ids for all the people files
		const crIds: string[] = [];

		for (const filePath of peopleFiles.keys()) {
			try {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (!file || !(file instanceof TFile)) continue;

				const metadata = this.app.metadataCache.getFileCache(file);
				const crId = metadata?.frontmatter?.cr_id as string | undefined;
				if (crId) {
					crIds.push(crId);
				}
			} catch {
				// Skip files we can't read
			}
		}

		if (crIds.length === 0) {
			return {
				success: false,
				path: '',
				error: `No valid cr_id found for surname: ${label}`
			};
		}

		// Build a tree containing these people
		// Use the first person as root and build from there
		const tree = this.getTreeContainingPerson(crIds[0]);
		if (!tree) {
			return {
				success: false,
				path: '',
				error: `Could not build tree for surname: ${label}`
			};
		}

		// Filter tree to only include the surname-matched people (and optionally spouses)
		const includedCrIds = new Set<string>(crIds);

		// Add spouses if enabled
		if (this.surnameIncludeSpouses) {
			for (const crId of crIds) {
				const person = tree.nodes.get(crId);
				if (person) {
					for (const spouseId of person.spouseCrIds) {
						includedCrIds.add(spouseId);
					}
				}
			}
		}

		// Generate canvas data for the subset
		const canvasData = this.splitService.generateCanvasDataForSubset(
			tree,
			includedCrIds
		);

		if (!canvasData) {
			return {
				success: false,
				path: '',
				error: `Failed to generate canvas for surname: ${label}`
			};
		}

		// Write the canvas file
		const prefix = this.filenamePrefix || 'surname';
		const filename = `${prefix}-${label.toLowerCase().replace(/\s+/g, '-')}`;
		const path = this.outputFolder
			? `${this.outputFolder}/${filename}`
			: filename;

		const { writeCanvasFile } = await import('../core/canvas-utils');
		return await writeCanvasFile(this.app, path, canvasData, true);
	}

	/**
	 * Open folder browser modal
	 */
	private browseFolder(): void {
		// Simple folder browser using Obsidian's native folder structure
		const folders: TFolder[] = [];

		const collectFolders = (folder: TFolder) => {
			folders.push(folder);
			for (const child of folder.children) {
				if (child instanceof TFolder) {
					collectFolders(child);
				}
			}
		};

		collectFolders(this.app.vault.getRoot());

		// Create a simple selection modal
		const modal = new FolderPickerModal(this.app, folders, (folder) => {
			this.outputFolder = folder.path === '/' ? '' : folder.path;
			this.render();
		});
		modal.open();
	}
}

/**
 * Simple folder picker modal
 */
class FolderPickerModal extends Modal {
	private folders: TFolder[];
	private onSelect: (folder: TFolder) => void;

	constructor(app: App, folders: TFolder[], onSelect: (folder: TFolder) => void) {
		super(app);
		this.folders = folders;
		this.onSelect = onSelect;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText('Select folder');

		const listEl = contentEl.createDiv({ cls: 'crc-folder-list' });

		this.folders.forEach(folder => {
			const item = listEl.createDiv({ cls: 'crc-folder-item' });
			item.appendChild(createLucideIcon('folder', 16));
			item.createSpan({ text: folder.path || '(Root)' });

			item.addEventListener('click', () => {
				this.onSelect(folder);
				this.close();
			});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
