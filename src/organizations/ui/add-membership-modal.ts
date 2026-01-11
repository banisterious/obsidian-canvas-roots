/**
 * Add Membership Modal
 *
 * Modal for adding an organization membership to a person note.
 */

import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';
import type { MembershipData, OrganizationInfo } from '../types/organization-types';
import { OrganizationService } from '../services/organization-service';
import { MembershipService } from '../services/membership-service';

/**
 * Modal for adding a membership to a person
 */
export class AddMembershipModal extends Modal {
	private plugin: CanvasRootsPlugin;
	private personFile: TFile;
	private onSuccess: () => void;
	private orgService: OrganizationService;
	private membershipService: MembershipService;

	// Form fields
	private selectedOrg: OrganizationInfo | null = null;
	private role: string = '';
	private fromDate: string = '';
	private toDate: string = '';
	private notes: string = '';

	constructor(app: App, plugin: CanvasRootsPlugin, personFile: TFile, onSuccess: () => void) {
		super(app);
		this.plugin = plugin;
		this.personFile = personFile;
		this.onSuccess = onSuccess;
		this.orgService = new OrganizationService(plugin);
		this.membershipService = new MembershipService(plugin, this.orgService);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cr-add-membership-modal');

		// Get person name
		const cache = this.app.metadataCache.getFileCache(this.personFile);
		const personName = cache?.frontmatter?.name || this.personFile.basename;

		contentEl.createEl('h2', { text: 'Add membership' });
		contentEl.createEl('p', {
			text: `Adding membership for: ${personName}`,
			cls: 'crc-text-muted'
		});

		// Organization selector
		const orgs = this.orgService.getAllOrganizations();

		if (orgs.length === 0) {
			contentEl.createEl('p', {
				text: 'No organizations found. Create an organization first.',
				cls: 'crc-text-muted'
			});

			const buttonContainer = contentEl.createDiv({ cls: 'cr-modal-buttons' });
			const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
			cancelBtn.addEventListener('click', () => this.close());

			const createBtn = buttonContainer.createEl('button', { text: 'Create organization', cls: 'mod-cta' });
			createBtn.addEventListener('click', () => {
				this.close();
				void (async () => {
					const { CreateOrganizationModal } = await import('./create-organization-modal');
					new CreateOrganizationModal(this.app, this.plugin, () => {
						// Re-open this modal after creating org
						new AddMembershipModal(this.app, this.plugin, this.personFile, this.onSuccess).open();
					}).open();
				})();
			});

			return;
		}

		new Setting(contentEl)
			.setName('Organization')
			.setDesc('Select the organization')
			.addDropdown(dropdown => {
				dropdown.addOption('', '-- Select organization --');
				for (const org of orgs.sort((a, b) => a.name.localeCompare(b.name))) {
					dropdown.addOption(org.crId, org.name);
				}
				dropdown.onChange(value => {
					this.selectedOrg = orgs.find(o => o.crId === value) || null;
				});
			});

		// Role
		new Setting(contentEl)
			.setName('Role')
			.setDesc('Position or role within the organization')
			.addText(text => text
				.setPlaceholder('e.g., Lord, Member, Captain')
				.setValue(this.role)
				.onChange(value => this.role = value));

		// From date
		new Setting(contentEl)
			.setName('From')
			.setDesc('Start date of membership (optional)')
			.addText(text => text
				.setPlaceholder('e.g., 283 AC, TA 2941')
				.setValue(this.fromDate)
				.onChange(value => this.fromDate = value));

		// To date
		new Setting(contentEl)
			.setName('To')
			.setDesc('End date of membership (optional, leave empty if current)')
			.addText(text => text
				.setPlaceholder('e.g., 298 AC')
				.setValue(this.toDate)
				.onChange(value => this.toDate = value));

		// Notes
		new Setting(contentEl)
			.setName('Notes')
			.setDesc('Additional context about this membership (optional)')
			.addText(text => text
				.setPlaceholder('e.g., Appointed after death of Jon Arryn')
				.setValue(this.notes)
				.onChange(value => this.notes = value));

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'cr-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const addBtn = buttonContainer.createEl('button', { text: 'Add', cls: 'mod-cta' });
		addBtn.addEventListener('click', () => void this.addMembership());
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private async addMembership(): Promise<void> {
		if (!this.selectedOrg) {
			new Notice('Please select an organization');
			return;
		}

		const membership: MembershipData = {
			org: `[[${this.selectedOrg.file.basename}]]`,
			org_id: this.selectedOrg.crId
		};

		if (this.role.trim()) {
			membership.role = this.role.trim();
		}
		if (this.fromDate.trim()) {
			membership.from = this.fromDate.trim();
		}
		if (this.toDate.trim()) {
			membership.to = this.toDate.trim();
		}
		if (this.notes.trim()) {
			membership.notes = this.notes.trim();
		}

		try {
			await this.membershipService.addMembership(this.personFile, membership);
			this.close();
			this.onSuccess();
		} catch (error) {
			new Notice(`Failed to add membership: ${error}`);
		}
	}
}
