/**
 * Create Organization Modal
 *
 * Modal for creating or editing organization notes with proper frontmatter.
 */

import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { OrganizationType, OrganizationInfo } from '../types/organization-types';
import { DEFAULT_ORGANIZATION_TYPES } from '../constants/organization-types';
import { OrganizationService } from '../services/organization-service';
import { ModalStatePersistence, renderResumePromptBanner } from '../../ui/modal-state-persistence';

/**
 * Form data structure for persistence
 */
interface OrganizationFormData {
	name: string;
	orgType: OrganizationType;
	parentOrg: string;
	universe: string;
	founded: string;
	motto: string;
	seat: string;
	folder: string;
}

/**
 * Options for the CreateOrganizationModal
 */
export interface CreateOrganizationModalOptions {
	onSuccess: () => void;
	/** For edit mode: the organization to edit */
	editOrg?: OrganizationInfo;
	/** For edit mode: the file to update */
	editFile?: TFile;
}

/**
 * Modal for creating or editing organization notes
 */
export class CreateOrganizationModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private onSuccess: () => void;

	// Edit mode properties
	private editMode: boolean = false;
	private editingFile?: TFile;

	// Form fields
	private name: string = '';
	private orgType: OrganizationType = 'custom';
	private parentOrg: string = '';
	private universe: string = '';
	private founded: string = '';
	private motto: string = '';
	private seat: string = '';
	private folder: string;

	// State persistence
	private persistence?: ModalStatePersistence<OrganizationFormData>;
	private savedSuccessfully: boolean = false;
	private resumeBanner?: HTMLElement;

	constructor(app: App, plugin: CanvasRootsPlugin, options: CreateOrganizationModalOptions | (() => void)) {
		super(app);
		this.plugin = plugin;

		// Support both old signature (callback) and new signature (options object)
		if (typeof options === 'function') {
			this.onSuccess = options;
		} else {
			this.onSuccess = options.onSuccess;

			// Check for edit mode
			if (options.editOrg && options.editFile) {
				this.editMode = true;
				this.editingFile = options.editFile;
				// Populate form fields from existing organization
				this.name = options.editOrg.name;
				this.orgType = options.editOrg.orgType;
				this.parentOrg = options.editOrg.parentOrgLink || '';
				this.universe = options.editOrg.universe || '';
				this.founded = options.editOrg.founded || '';
				this.motto = options.editOrg.motto || '';
				this.seat = options.editOrg.seat || '';
			}
		}

		this.folder = plugin.settings.organizationsFolder;

		// Set up persistence (only in create mode)
		if (!this.editMode) {
			this.persistence = new ModalStatePersistence<OrganizationFormData>(this.plugin, 'organization');
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-create-org-modal');

		contentEl.createEl('h2', { text: this.editMode ? 'Edit organization' : 'Create organization' });

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
						this.restoreFromPersistedState(existingState.formData as unknown as OrganizationFormData);
						this.resumeBanner?.remove();
						this.resumeBanner = undefined;
						// Re-render form with restored data
						contentEl.empty();
						this.onOpen();
					}
				);
			}
		}

		// Name
		new Setting(contentEl)
			.setName('Name')
			.setDesc('Display name for the organization')
			.addText(text => text
				.setPlaceholder('e.g., House Stark')
				.setValue(this.name)
				.onChange(value => this.name = value));

		// Organization type
		new Setting(contentEl)
			.setName('Type')
			.setDesc('Category of organization')
			.addDropdown(dropdown => {
				for (const typeDef of DEFAULT_ORGANIZATION_TYPES) {
					dropdown.addOption(typeDef.id, typeDef.name);
				}
				dropdown.setValue(this.orgType);
				dropdown.onChange(value => this.orgType = value as OrganizationType);
			});

		// Parent organization
		new Setting(contentEl)
			.setName('Parent organization')
			.setDesc('Optional parent in the hierarchy (wikilink)')
			.addText(text => text
				.setPlaceholder('[[Parent Org]]')
				.setValue(this.parentOrg)
				.onChange(value => this.parentOrg = value));

		// Universe
		new Setting(contentEl)
			.setName('Universe')
			.setDesc('Optional universe scope (e.g., westeros, middle-earth)')
			.addText(text => text
				.setPlaceholder('e.g., westeros')
				.setValue(this.universe)
				.onChange(value => this.universe = value));

		// Collapsible optional details
		const detailsEl = contentEl.createEl('details', { cls: 'cr-create-org-details' });
		detailsEl.createEl('summary', { text: 'Optional details' });

		// Founded
		new Setting(detailsEl)
			.setName('Founded')
			.setDesc('Founding date (supports fictional dates)')
			.addText(text => text
				.setPlaceholder('e.g., Age of Heroes, TA 2000')
				.setValue(this.founded)
				.onChange(value => this.founded = value));

		// Motto
		new Setting(detailsEl)
			.setName('Motto')
			.setDesc('Organization motto or slogan')
			.addText(text => text
				.setPlaceholder('e.g., Winter is Coming')
				.setValue(this.motto)
				.onChange(value => this.motto = value));

		// Seat
		new Setting(detailsEl)
			.setName('Seat')
			.setDesc('Primary location (wikilink to place note)')
			.addText(text => text
				.setPlaceholder('[[Winterfell]]')
				.setValue(this.seat)
				.onChange(value => this.seat = value));

		// Folder (only in create mode)
		if (!this.editMode) {
			new Setting(detailsEl)
				.setName('Folder')
				.setDesc('Folder to create the note in')
				.addText(text => text
					.setPlaceholder('Charted Roots/Organizations')
					.setValue(this.folder)
					.onChange(value => this.folder = value));
		}

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'cr-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const submitBtn = buttonContainer.createEl('button', {
			text: this.editMode ? 'Save' : 'Create',
			cls: 'mod-cta'
		});
		submitBtn.addEventListener('click', () => {
			if (this.editMode) {
				void this.updateOrganization();
			} else {
				void this.createOrganization();
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
	private gatherFormData(): OrganizationFormData {
		return {
			name: this.name,
			orgType: this.orgType,
			parentOrg: this.parentOrg,
			universe: this.universe,
			founded: this.founded,
			motto: this.motto,
			seat: this.seat,
			folder: this.folder
		};
	}

	/**
	 * Restore form state from persisted data
	 */
	private restoreFromPersistedState(formData: OrganizationFormData): void {
		this.name = formData.name || '';
		this.orgType = formData.orgType || 'custom';
		this.parentOrg = formData.parentOrg || '';
		this.universe = formData.universe || '';
		this.founded = formData.founded || '';
		this.motto = formData.motto || '';
		this.seat = formData.seat || '';
		if (formData.folder) {
			this.folder = formData.folder;
		}
	}

	private async createOrganization(): Promise<void> {
		if (!this.name.trim()) {
			new Notice('Please enter an organization name');
			return;
		}

		try {
			const orgService = new OrganizationService(this.plugin);
			await orgService.createOrganization(this.name.trim(), this.orgType, {
				parentOrg: this.parentOrg.trim() || undefined,
				universe: this.universe.trim() || undefined,
				founded: this.founded.trim() || undefined,
				motto: this.motto.trim() || undefined,
				seat: this.seat.trim() || undefined,
				folder: this.folder.trim() || undefined
			});

			// Mark as saved successfully and clear persisted state
			this.savedSuccessfully = true;
			if (this.persistence) {
				void this.persistence.clear();
			}

			this.close();
			this.onSuccess();
		} catch (error) {
			new Notice(`Failed to create organization: ${error}`);
		}
	}

	private async updateOrganization(): Promise<void> {
		if (!this.name.trim()) {
			new Notice('Please enter an organization name');
			return;
		}

		if (!this.editingFile) {
			new Notice('No file to update');
			return;
		}

		try {
			const orgService = new OrganizationService(this.plugin);
			await orgService.updateOrganization(this.editingFile, {
				name: this.name.trim(),
				orgType: this.orgType,
				parentOrg: this.parentOrg.trim() || undefined,
				universe: this.universe.trim() || undefined,
				founded: this.founded.trim() || undefined,
				motto: this.motto.trim() || undefined,
				seat: this.seat.trim() || undefined
			});

			this.close();
			this.onSuccess();
		} catch (error) {
			new Notice(`Failed to update organization: ${error}`);
		}
	}
}
