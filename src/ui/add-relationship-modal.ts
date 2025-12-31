/**
 * Add Relationship Modal
 * Allows users to add custom relationships between person notes
 */

import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import { PersonPickerModal, PersonInfo } from './person-picker';
import { RelationshipContext } from './quick-create-person-modal';
import { RelationshipService } from '../relationships';
import type { RelationshipTypeDefinition } from '../relationships';
import type CanvasRootsPlugin from '../../main';

/**
 * Modal for adding a custom relationship to a person note
 */
export class AddRelationshipModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private sourceFile: TFile;
	private relationshipService: RelationshipService;

	private selectedType: RelationshipTypeDefinition | null = null;
	private selectedTarget: PersonInfo | null = null;
	private notes: string = '';

	constructor(app: App, plugin: CanvasRootsPlugin, sourceFile: TFile) {
		super(app);
		this.plugin = plugin;
		this.sourceFile = sourceFile;
		this.relationshipService = new RelationshipService(plugin);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-add-relationship-modal');

		// Get source person info
		const sourceCache = this.app.metadataCache.getFileCache(this.sourceFile);
		const sourceName = sourceCache?.frontmatter?.name || this.sourceFile.basename;
		const sourceCrId = sourceCache?.frontmatter?.cr_id;

		if (!sourceCrId) {
			new Notice('Source person does not have a cr_id');
			this.close();
			return;
		}

		contentEl.createEl('h2', { text: 'Add relationship' });
		contentEl.createEl('p', {
			text: `Adding relationship from: ${sourceName}`,
			cls: 'crc-text-muted'
		});

		// Relationship type selector
		const types = this.relationshipService.getAllRelationshipTypes();
		const typesByCategory = new Map<string, RelationshipTypeDefinition[]>();

		for (const type of types) {
			const existing = typesByCategory.get(type.category) || [];
			existing.push(type);
			typesByCategory.set(type.category, existing);
		}

		new Setting(contentEl)
			.setName('Relationship type')
			.setDesc('Select the type of relationship')
			.addDropdown(dropdown => {
				dropdown.addOption('', 'Select a type...');

				// Group by category
				for (const [category, categoryTypes] of typesByCategory) {
					const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
					for (const type of categoryTypes) {
						dropdown.addOption(type.id, `${categoryLabel}: ${type.name}`);
					}
				}

				dropdown.onChange(value => {
					this.selectedType = types.find(t => t.id === value) || null;
					this.updateAddButton();
				});
			});

		// Target person selector
		const targetSetting = new Setting(contentEl)
			.setName('Target person')
			.setDesc('Select the person this relationship points to');

		const targetDisplay = targetSetting.controlEl.createDiv({ cls: 'cr-target-display' });
		targetDisplay.createSpan({ text: 'None selected', cls: 'crc-text-muted' });

		targetSetting.addButton(btn => btn
			.setButtonText('Select person')
			.onClick(() => {
				// Build context for inline creation
				const cache = this.app.metadataCache.getFileCache(this.sourceFile);
				const crId = cache?.frontmatter?.cr_id;
				const directory = this.sourceFile.parent?.path || '';

				// Use selected relationship type (if any)
				const relationshipType = this.selectedType?.id || 'related';

				const createContext: RelationshipContext = {
					relationshipType: relationshipType,
					suggestedSex: undefined, // Custom relationships don't suggest sex
					parentCrId: crId,
					directory: directory
				};

				const picker = new PersonPickerModal(this.app, (selected) => {
					this.selectedTarget = selected;
					targetDisplay.empty();
					targetDisplay.createSpan({ text: selected.name });
					this.updateAddButton();
				}, {
					title: 'Select person',
					createContext: createContext,
					onCreateNew: () => {
						// Callback signals inline creation support
					},
					plugin: this.plugin
				});
				picker.open();
			})
		);

		// Optional notes
		new Setting(contentEl)
			.setName('Notes (optional)')
			.setDesc('Additional notes about this relationship')
			.addTextArea(text => text
				.setPlaceholder('e.g., "Became godparent in 1920"')
				.onChange(value => {
					this.notes = value;
				})
			);

		// Action buttons
		const buttonContainer = contentEl.createDiv({ cls: 'cr-modal-buttons' });

		const addBtn = buttonContainer.createEl('button', {
			text: 'Add relationship',
			cls: 'mod-cta'
		});
		addBtn.disabled = true;
		addBtn.addEventListener('click', () => void this.addRelationship());

		// Store reference for enabling/disabling
		(this as { addButton?: HTMLButtonElement }).addButton = addBtn;

		buttonContainer.createEl('button', { text: 'Cancel' })
			.addEventListener('click', () => this.close());
	}

	private updateAddButton() {
		const addBtn = (this as { addButton?: HTMLButtonElement }).addButton;
		if (addBtn) {
			addBtn.disabled = !this.selectedType || !this.selectedTarget;
		}
	}

	private async addRelationship() {
		if (!this.selectedType || !this.selectedTarget) {
			new Notice('Please select a relationship type and target person');
			return;
		}

		const sourceCache = this.app.metadataCache.getFileCache(this.sourceFile);
		const targetCache = this.app.metadataCache.getFileCache(this.selectedTarget.file);

		const sourceCrId = sourceCache?.frontmatter?.cr_id;
		const targetCrId = targetCache?.frontmatter?.cr_id;
		const targetName = targetCache?.frontmatter?.name || this.selectedTarget.file.basename;

		if (!sourceCrId || !targetCrId) {
			new Notice('Both people must have cr_id fields');
			return;
		}

		const typeId = this.selectedType.id;
		const targetWikilink = `[[${this.selectedTarget.file.basename}]]`;

		try {
			// Write flat properties (new format)
			await this.app.fileManager.processFrontMatter(this.sourceFile, (frontmatter) => {
				// Get existing values for this relationship type
				const existingTargets = this.normalizeToArray(frontmatter[typeId]);
				const existingIds = this.normalizeToArray(frontmatter[`${typeId}_id`]);

				// Check for duplicates
				if (existingIds.includes(targetCrId)) {
					throw new Error('This relationship already exists');
				}

				// Add the new relationship
				existingTargets.push(targetWikilink);
				existingIds.push(targetCrId);

				// Write back (use array if multiple, single value if only one)
				frontmatter[typeId] = existingTargets.length === 1 ? existingTargets[0] : existingTargets;
				frontmatter[`${typeId}_id`] = existingIds.length === 1 ? existingIds[0] : existingIds;
			});

			const typeName = this.selectedType.name;
			new Notice(`Added ${typeName} relationship to ${targetName}`);

			// Refresh the relationship service cache
			this.relationshipService.refreshCache();

			this.close();
		} catch (error) {
			const msg = error instanceof Error ? error.message : 'Unknown error';
			new Notice(`Failed to add relationship: ${msg}`);
		}
	}

	/**
	 * Normalize a value to an array
	 */
	private normalizeToArray(value: unknown): string[] {
		if (!value) return [];
		if (Array.isArray(value)) return value.map(v => typeof v === 'string' ? v : JSON.stringify(v));
		return [typeof value === 'string' ? value : JSON.stringify(value)];
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
