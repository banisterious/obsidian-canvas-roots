/**
 * Create/Edit Schema Modal
 * Modal for creating and editing schema notes for validation
 */

import { App, Modal, Setting, TFile, Notice } from 'obsidian';
import { createLucideIcon, setLucideIcon } from './lucide-icons';
import type CanvasRootsPlugin from '../../main';
import { SchemaService } from '../schemas';
import type {
	SchemaNote,
	PropertyDefinition,
	PropertyType,
	SchemaConstraint,
	SchemaAppliesTo
} from '../schemas';

/**
 * Data structure for schema being edited
 */
interface SchemaFormData {
	crId: string;
	name: string;
	description: string;
	appliesToType: SchemaAppliesTo;
	appliesToValue: string;
	requiredProperties: string[];
	properties: Record<string, PropertyDefinition>;
	constraints: SchemaConstraint[];
}

/**
 * Generate a URL-friendly schema ID from a name
 */
function generateSchemaId(name: string): string {
	return 'schema-' + name
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

/**
 * Parse schema data from a SchemaNote
 */
function parseSchemaData(schema: SchemaNote): SchemaFormData {
	return {
		crId: schema.cr_id,
		name: schema.name,
		description: schema.description || '',
		appliesToType: schema.appliesToType,
		appliesToValue: schema.appliesToValue || '',
		requiredProperties: [...schema.definition.requiredProperties],
		properties: { ...schema.definition.properties },
		constraints: [...schema.definition.constraints]
	};
}

/**
 * Modal for creating and editing schema notes
 */
export class CreateSchemaModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private schemaService: SchemaService;
	private formData: SchemaFormData;
	private onCreated?: (file: TFile) => void;
	private onUpdated?: () => void;

	// Edit mode properties
	private editMode: boolean = false;
	private editingSchema?: SchemaNote;

	// UI elements
	private crIdInput?: HTMLInputElement;
	private appliesToValueContainer?: HTMLElement;
	private propertiesContainer?: HTMLElement;
	private constraintsContainer?: HTMLElement;
	private requiredPropsContainer?: HTMLElement;

	constructor(
		app: App,
		plugin: CanvasRootsPlugin,
		options?: {
			onCreated?: (file: TFile) => void;
			onUpdated?: () => void;
			editSchema?: SchemaNote;
		}
	) {
		super(app);
		this.plugin = plugin;
		this.schemaService = new SchemaService(plugin);
		this.onCreated = options?.onCreated;
		this.onUpdated = options?.onUpdated;

		if (options?.editSchema) {
			this.editMode = true;
			this.editingSchema = options.editSchema;
			this.formData = parseSchemaData(options.editSchema);
		} else {
			this.formData = {
				crId: '',
				name: '',
				description: '',
				appliesToType: 'all',
				appliesToValue: '',
				requiredProperties: [],
				properties: {},
				constraints: []
			};
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.modalEl.addClass('crc-create-schema-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('clipboard-check', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText(this.editMode ? 'Edit schema' : 'Create schema');

		// Description
		contentEl.createEl('p', {
			text: this.editMode
				? 'Edit the validation schema configuration.'
				: 'Create a validation schema to enforce property rules on person notes.',
			cls: 'crc-modal-description'
		});

		// Form with scrollable content
		const formWrapper = contentEl.createDiv({ cls: 'crc-schema-form-wrapper' });
		const form = formWrapper.createDiv({ cls: 'crc-form' });

		this.renderBasicSettings(form);
		this.renderScopeSettings(form);
		this.renderRequiredProperties(form);
		this.renderPropertyDefinitions(form);
		this.renderConstraints(form);

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'crc-btn'
		});
		cancelBtn.addEventListener('click', () => this.close());

		const submitBtn = buttonContainer.createEl('button', {
			text: this.editMode ? 'Save changes' : 'Create schema',
			cls: 'crc-btn crc-btn--primary'
		});
		submitBtn.addEventListener('click', () => {
			if (this.editMode) {
				void this.updateSchema();
			} else {
				void this.createSchema();
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Render basic settings (name, ID, description)
	 */
	private renderBasicSettings(form: HTMLElement): void {
		// Name
		new Setting(form)
			.setName('Name')
			.setDesc('Display name for the schema')
			.addText(text => text
				.setPlaceholder('e.g., House Stark Schema')
				.setValue(this.formData.name)
				.onChange(value => {
					this.formData.name = value;
					// Auto-generate ID from name (only in create mode)
					if (!this.editMode && this.crIdInput && !this.crIdInput.dataset.manuallyEdited) {
						const generatedId = generateSchemaId(value);
						this.formData.crId = generatedId;
						this.crIdInput.value = generatedId;
					}
				}));

		// Schema ID
		new Setting(form)
			.setName('Schema ID')
			.setDesc(this.editMode
				? 'Unique identifier (changing may break references)'
				: 'Unique identifier (auto-generated from name)')
			.addText(text => {
				this.crIdInput = text.inputEl;
				text.setPlaceholder('e.g., schema-house-stark')
					.setValue(this.formData.crId)
					.onChange(value => {
						this.formData.crId = value;
						if (this.crIdInput) {
							this.crIdInput.dataset.manuallyEdited = 'true';
						}
					});
			});

		if (this.editMode && this.crIdInput) {
			this.crIdInput.dataset.manuallyEdited = 'true';
		}

		// Description
		new Setting(form)
			.setName('Description')
			.setDesc('Optional description of what this schema validates')
			.addTextArea(text => text
				.setPlaceholder('e.g., Validates members of House Stark...')
				.setValue(this.formData.description)
				.onChange(value => {
					this.formData.description = value;
				}));
	}

	/**
	 * Render scope settings (applies to)
	 */
	private renderScopeSettings(form: HTMLElement): void {
		const scopeSection = form.createDiv({ cls: 'crc-section' });
		scopeSection.createEl('h4', { text: 'Scope', cls: 'crc-section-title' });

		// Applies to type
		new Setting(scopeSection)
			.setName('Applies to')
			.setDesc('Which person notes should this schema validate?')
			.addDropdown(dropdown => dropdown
				.addOption('all', 'All people')
				.addOption('collection', 'By collection')
				.addOption('folder', 'By folder')
				.addOption('universe', 'By universe')
				.setValue(this.formData.appliesToType)
				.onChange(value => {
					this.formData.appliesToType = value as SchemaAppliesTo;
					this.updateAppliesToValueVisibility();
				}));

		// Applies to value container
		this.appliesToValueContainer = scopeSection.createDiv();
		this.renderAppliesToValue();
	}

	/**
	 * Render the applies-to value field
	 */
	private renderAppliesToValue(): void {
		if (!this.appliesToValueContainer) return;
		this.appliesToValueContainer.empty();

		if (this.formData.appliesToType === 'all') {
			return; // No value needed
		}

		const labels: Record<SchemaAppliesTo, string> = {
			all: '',
			collection: 'Collection name',
			folder: 'Folder path',
			universe: 'Universe name'
		};

		const placeholders: Record<SchemaAppliesTo, string> = {
			all: '',
			collection: 'e.g., House Stark',
			folder: 'e.g., People/Westeros',
			universe: 'e.g., westeros'
		};

		new Setting(this.appliesToValueContainer)
			.setName(labels[this.formData.appliesToType])
			.addText(text => text
				.setPlaceholder(placeholders[this.formData.appliesToType])
				.setValue(this.formData.appliesToValue)
				.onChange(value => {
					this.formData.appliesToValue = value;
				}));
	}

	/**
	 * Update visibility of applies-to value field
	 */
	private updateAppliesToValueVisibility(): void {
		this.renderAppliesToValue();
	}

	/**
	 * Render required properties section
	 */
	private renderRequiredProperties(form: HTMLElement): void {
		const section = form.createDiv({ cls: 'crc-section' });
		section.createEl('h4', { text: 'Required properties', cls: 'crc-section-title' });
		section.createEl('p', {
			text: 'Properties that must be present on all matching person notes.',
			cls: 'crc-section-desc crc-text--muted'
		});

		this.requiredPropsContainer = section.createDiv({ cls: 'crc-required-props' });
		this.renderRequiredPropsList();

		// Add button
		const addBtn = section.createEl('button', {
			text: 'Add required property',
			cls: 'crc-btn crc-btn--secondary crc-btn--small'
		});
		addBtn.prepend(createLucideIcon('plus', 14));
		addBtn.addEventListener('click', () => {
			this.formData.requiredProperties.push('');
			this.renderRequiredPropsList();
		});
	}

	/**
	 * Render the list of required properties
	 */
	private renderRequiredPropsList(): void {
		if (!this.requiredPropsContainer) return;
		this.requiredPropsContainer.empty();

		if (this.formData.requiredProperties.length === 0) {
			this.requiredPropsContainer.createEl('p', {
				text: 'No required properties defined.',
				cls: 'crc-text--muted crc-text--small'
			});
			return;
		}

		for (let i = 0; i < this.formData.requiredProperties.length; i++) {
			const propRow = this.requiredPropsContainer.createDiv({ cls: 'crc-prop-row' });

			const input = propRow.createEl('input', {
				type: 'text',
				cls: 'crc-form-input',
				value: this.formData.requiredProperties[i],
				attr: { placeholder: 'e.g., allegiance' }
			});
			input.addEventListener('input', (e) => {
				this.formData.requiredProperties[i] = (e.target as HTMLInputElement).value;
			});

			const removeBtn = propRow.createEl('button', {
				cls: 'crc-btn crc-btn--icon crc-btn--danger',
				attr: { 'aria-label': 'Remove' }
			});
			setLucideIcon(removeBtn, 'x', 14);
			removeBtn.addEventListener('click', () => {
				this.formData.requiredProperties.splice(i, 1);
				this.renderRequiredPropsList();
			});
		}
	}

	/**
	 * Render property definitions section
	 */
	private renderPropertyDefinitions(form: HTMLElement): void {
		const section = form.createDiv({ cls: 'crc-section' });
		section.createEl('h4', { text: 'Property definitions', cls: 'crc-section-title' });
		section.createEl('p', {
			text: 'Define validation rules for specific properties.',
			cls: 'crc-section-desc crc-text--muted'
		});

		this.propertiesContainer = section.createDiv({ cls: 'crc-properties-list' });
		this.renderPropertiesList();

		// Add button
		const addBtn = section.createEl('button', {
			text: 'Add property definition',
			cls: 'crc-btn crc-btn--secondary crc-btn--small'
		});
		addBtn.prepend(createLucideIcon('plus', 14));
		addBtn.addEventListener('click', () => {
			const propName = `property_${Object.keys(this.formData.properties).length + 1}`;
			this.formData.properties[propName] = { type: 'string' };
			this.renderPropertiesList();
		});
	}

	/**
	 * Render the list of property definitions
	 */
	private renderPropertiesList(): void {
		if (!this.propertiesContainer) return;
		this.propertiesContainer.empty();

		const propNames = Object.keys(this.formData.properties);

		if (propNames.length === 0) {
			this.propertiesContainer.createEl('p', {
				text: 'No property definitions. Add one to validate specific properties.',
				cls: 'crc-text--muted crc-text--small'
			});
			return;
		}

		for (const propName of propNames) {
			const propDef = this.formData.properties[propName];
			const card = this.propertiesContainer.createDiv({ cls: 'crc-property-card' });

			// Header with property name and remove button
			const header = card.createDiv({ cls: 'crc-property-card-header' });

			const nameInput = header.createEl('input', {
				type: 'text',
				cls: 'crc-form-input crc-property-name-input',
				value: propName,
				attr: { placeholder: 'Property name' }
			});
			nameInput.addEventListener('change', (e) => {
				const newName = (e.target as HTMLInputElement).value;
				if (newName && newName !== propName) {
					this.formData.properties[newName] = this.formData.properties[propName];
					delete this.formData.properties[propName];
					this.renderPropertiesList();
				}
			});

			const removeBtn = header.createEl('button', {
				cls: 'crc-btn crc-btn--icon crc-btn--danger',
				attr: { 'aria-label': 'Remove property' }
			});
			setLucideIcon(removeBtn, 'trash', 14);
			removeBtn.addEventListener('click', () => {
				delete this.formData.properties[propName];
				this.renderPropertiesList();
			});

			// Property settings
			const settings = card.createDiv({ cls: 'crc-property-settings' });

			// Type dropdown
			new Setting(settings)
				.setName('Type')
				.addDropdown(dropdown => dropdown
					.addOption('string', 'String')
					.addOption('number', 'Number')
					.addOption('boolean', 'Boolean')
					.addOption('date', 'Date')
					.addOption('wikilink', 'Wikilink')
					.addOption('array', 'Array')
					.addOption('enum', 'Enum')
					.addOption('sourced_facts', 'Sourced facts')
					.setValue(propDef.type)
					.onChange(value => {
						propDef.type = value as PropertyType;
						this.renderPropertiesList();
					}));

			// Type-specific settings
			if (propDef.type === 'enum') {
				new Setting(settings)
					.setName('Allowed values')
					.setDesc('Comma-separated list')
					.addText(text => text
						.setPlaceholder('e.g., male, female, other')
						.setValue(propDef.values?.join(', ') || '')
						.onChange(value => {
							propDef.values = value.split(',').map(v => v.trim()).filter(v => v);
						}));
			}

			if (propDef.type === 'number') {
				const rangeRow = settings.createDiv({ cls: 'crc-range-row' });
				new Setting(rangeRow)
					.setName('Min')
					.addText(text => text
						.setPlaceholder('0')
						.setValue(propDef.min?.toString() || '')
						.onChange(value => {
							propDef.min = value ? parseFloat(value) : undefined;
						}));
				new Setting(rangeRow)
					.setName('Max')
					.addText(text => text
						.setPlaceholder('100')
						.setValue(propDef.max?.toString() || '')
						.onChange(value => {
							propDef.max = value ? parseFloat(value) : undefined;
						}));
			}

			if (propDef.type === 'wikilink') {
				new Setting(settings)
					.setName('Target type')
					.setDesc('Optional: restrict to specific note types')
					.addDropdown(dropdown => dropdown
						.addOption('', 'Any')
						.addOption('person', 'Person')
						.addOption('place', 'Place')
						.addOption('map', 'Map')
						.setValue(propDef.targetType || '')
						.onChange(value => {
							propDef.targetType = value || undefined;
						}));
			}

			if (propDef.type === 'sourced_facts') {
				settings.createEl('p', {
					text: 'Validates fact-level source tracking structure. Expected format: { birth_date: { sources: ["[[Source]]"] }, ... }',
					cls: 'crc-text--muted crc-text--small crc-mt-1'
				});
			}

			// Description
			new Setting(settings)
				.setName('Description')
				.addText(text => text
					.setPlaceholder('Optional description')
					.setValue(propDef.description || '')
					.onChange(value => {
						propDef.description = value || undefined;
					}));
		}
	}

	/**
	 * Render constraints section
	 */
	private renderConstraints(form: HTMLElement): void {
		const section = form.createDiv({ cls: 'crc-section' });
		section.createEl('h4', { text: 'Constraints', cls: 'crc-section-title' });
		section.createEl('p', {
			text: 'Cross-property validation rules using JavaScript expressions.',
			cls: 'crc-section-desc crc-text--muted'
		});

		this.constraintsContainer = section.createDiv({ cls: 'crc-constraints-list' });
		this.renderConstraintsList();

		// Add button
		const addBtn = section.createEl('button', {
			text: 'Add constraint',
			cls: 'crc-btn crc-btn--secondary crc-btn--small'
		});
		addBtn.prepend(createLucideIcon('plus', 14));
		addBtn.addEventListener('click', () => {
			this.formData.constraints.push({ rule: '', message: '' });
			this.renderConstraintsList();
		});

		// Help text
		const helpDiv = section.createDiv({ cls: 'crc-help-text crc-mt-2' });
		helpDiv.createEl('p', {
			text: 'Examples:',
			cls: 'crc-text--muted crc-text--small'
		});
		const examples = helpDiv.createEl('ul', { cls: 'crc-text--muted crc-text--small' });
		examples.createEl('li', { text: '!died || born — "Cannot have death without birth"' });
		examples.createEl('li', { text: 'age >= 0 && age <= 200 — "Age must be between 0 and 200"' });
	}

	/**
	 * Render the list of constraints
	 */
	private renderConstraintsList(): void {
		if (!this.constraintsContainer) return;
		this.constraintsContainer.empty();

		if (this.formData.constraints.length === 0) {
			this.constraintsContainer.createEl('p', {
				text: 'No constraints defined.',
				cls: 'crc-text--muted crc-text--small'
			});
			return;
		}

		for (let i = 0; i < this.formData.constraints.length; i++) {
			const constraint = this.formData.constraints[i];
			const card = this.constraintsContainer.createDiv({ cls: 'crc-constraint-card' });

			// Header with remove button
			const header = card.createDiv({ cls: 'crc-constraint-header' });
			header.createEl('span', { text: `Constraint ${i + 1}`, cls: 'crc-constraint-label' });

			const removeBtn = header.createEl('button', {
				cls: 'crc-btn crc-btn--icon crc-btn--danger',
				attr: { 'aria-label': 'Remove constraint' }
			});
			setLucideIcon(removeBtn, 'x', 14);
			removeBtn.addEventListener('click', () => {
				this.formData.constraints.splice(i, 1);
				this.renderConstraintsList();
			});

			// Rule input
			new Setting(card)
				.setName('Rule')
				.setDesc('JavaScript expression')
				.addText(text => text
					.setPlaceholder('e.g., !died || born')
					.setValue(constraint.rule)
					.onChange(value => {
						constraint.rule = value;
					}));

			// Message input
			new Setting(card)
				.setName('Error message')
				.addText(text => text
					.setPlaceholder('e.g., Cannot have death date without birth date')
					.setValue(constraint.message)
					.onChange(value => {
						constraint.message = value;
					}));
		}
	}

	/**
	 * Validate form data
	 */
	private validate(): boolean {
		if (!this.formData.name.trim()) {
			new Notice('Please enter a name for the schema');
			return false;
		}

		if (!this.formData.crId.trim()) {
			new Notice('Please enter a schema ID');
			return false;
		}

		if (this.formData.appliesToType !== 'all' && !this.formData.appliesToValue.trim()) {
			new Notice(`Please enter a value for "${this.formData.appliesToType}"`);
			return false;
		}

		// Validate constraints have both rule and message
		for (let i = 0; i < this.formData.constraints.length; i++) {
			const c = this.formData.constraints[i];
			if (!c.rule.trim() || !c.message.trim()) {
				new Notice(`Constraint ${i + 1} must have both a rule and error message`);
				return false;
			}
		}

		return true;
	}

	/**
	 * Create a new schema
	 */
	private async createSchema(): Promise<void> {
		if (!this.validate()) return;

		try {
			// Check for duplicate ID
			const existing = await this.schemaService.getSchemaById(this.formData.crId);
			if (existing) {
				new Notice(`A schema with ID "${this.formData.crId}" already exists`);
				return;
			}

			const schemaData: Omit<SchemaNote, 'filePath'> = {
				cr_id: this.formData.crId,
				name: this.formData.name,
				description: this.formData.description || undefined,
				appliesToType: this.formData.appliesToType,
				appliesToValue: this.formData.appliesToType !== 'all' ? this.formData.appliesToValue : undefined,
				definition: {
					requiredProperties: this.formData.requiredProperties.filter(p => p.trim()),
					properties: this.formData.properties,
					constraints: this.formData.constraints
				}
			};

			const file = await this.schemaService.createSchema(schemaData);

			new Notice(`Created schema: ${this.formData.name}`);

			if (this.onCreated) {
				this.onCreated(file);
			}

			this.close();
		} catch (error) {
			console.error('Failed to create schema:', error);
			new Notice(`Failed to create schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Update an existing schema
	 */
	private async updateSchema(): Promise<void> {
		if (!this.validate()) return;

		if (!this.editingSchema) {
			new Notice('No schema to update');
			return;
		}

		try {
			await this.schemaService.updateSchema(this.editingSchema.cr_id, {
				name: this.formData.name,
				description: this.formData.description || undefined,
				appliesToType: this.formData.appliesToType,
				appliesToValue: this.formData.appliesToType !== 'all' ? this.formData.appliesToValue : undefined,
				definition: {
					requiredProperties: this.formData.requiredProperties.filter(p => p.trim()),
					properties: this.formData.properties,
					constraints: this.formData.constraints
				}
			});

			new Notice(`Updated schema: ${this.formData.name}`);

			if (this.onUpdated) {
				this.onUpdated();
			}

			this.close();
		} catch (error) {
			console.error('Failed to update schema:', error);
			new Notice(`Failed to update schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
}
