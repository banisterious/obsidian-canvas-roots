/**
 * Migration Notice View
 *
 * Displays a one-time notice when users upgrade to versions with breaking changes,
 * informing them about data migrations and providing a path to the Cleanup Wizard.
 *
 * Supported migrations:
 * - v0.17.0: Source property format (source, source_2 → sources array)
 * - v0.18.0: Event person property (person → persons array)
 */

import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';

export const VIEW_TYPE_MIGRATION_NOTICE = 'canvas-roots-migration-notice';

/**
 * Migration type for the notice
 */
type MigrationType = 'sources' | 'event-persons';

export class MigrationNoticeView extends ItemView {
	private plugin: CanvasRootsPlugin;
	private migrationType: MigrationType;

	constructor(leaf: WorkspaceLeaf, plugin: CanvasRootsPlugin) {
		super(leaf);
		this.plugin = plugin;
		// Determine which migration to show based on current version
		this.migrationType = this.determineMigrationType();
	}

	getViewType(): string {
		return VIEW_TYPE_MIGRATION_NOTICE;
	}

	getDisplayText(): string {
		const version = this.plugin.manifest.version;
		if (version.startsWith('0.18')) {
			return 'Canvas Roots v0.18.0';
		}
		return 'Canvas Roots v0.17.0';
	}

	getIcon(): string {
		return 'info';
	}

	/**
	 * Determine which migration notice to show based on plugin version
	 */
	private determineMigrationType(): MigrationType {
		const version = this.plugin.manifest.version;
		if (version.startsWith('0.18')) {
			return 'event-persons';
		}
		return 'sources';
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('cr-migration-notice');

		if (this.migrationType === 'event-persons') {
			this.renderEventPersonsMigration(container);
		} else {
			this.renderSourcesMigration(container);
		}
	}

	/**
	 * Render the v0.18.0 event persons migration notice
	 */
	private renderEventPersonsMigration(container: Element): void {
		// Header
		const header = container.createDiv({ cls: 'cr-migration-header' });
		const iconEl = header.createSpan({ cls: 'cr-migration-icon' });
		setIcon(iconEl, 'sparkles');
		header.createEl('h2', { text: "What's New in v0.18.0" });

		// Content
		const content = container.createDiv({ cls: 'cr-migration-content' });

		// Event person format change section
		const section = content.createDiv({ cls: 'cr-migration-section' });
		section.createEl('h3', { text: 'Event Person Property Consolidation' });

		section.createEl('p', {
			text: 'Event notes now use a single "persons" array property instead of separate "person" and "persons" properties. This simplifies data management and enables multi-person events for all event types.'
		});

		// Code comparison
		const codeBlock = section.createDiv({ cls: 'cr-migration-code' });

		const oldCode = codeBlock.createDiv({ cls: 'cr-code-example cr-code-old' });
		oldCode.createEl('div', { cls: 'cr-code-label', text: 'Old format (deprecated)' });
		oldCode.createEl('pre', {
			text: `# Single-person event
person: "[[John Smith]]"

# Multi-person event
persons:
  - "[[John Smith]]"
  - "[[Jane Doe]]"`
		});

		const newCode = codeBlock.createDiv({ cls: 'cr-code-example cr-code-new' });
		newCode.createEl('div', { cls: 'cr-code-label', text: 'New format (all events)' });
		newCode.createEl('pre', {
			text: `persons:
  - "[[John Smith]]"

# or for multi-person events:
persons:
  - "[[John Smith]]"
  - "[[Jane Doe]]"`
		});

		// Benefits section
		const benefitsSection = content.createDiv({ cls: 'cr-migration-section' });
		benefitsSection.createEl('h3', { text: 'Benefits' });

		const benefitsList = benefitsSection.createEl('ul');
		benefitsList.createEl('li', { text: 'Consistent property name across all event types' });
		benefitsList.createEl('li', { text: 'Any event can have multiple participants without schema changes' });
		benefitsList.createEl('li', { text: 'Simpler queries in Obsidian Bases and Dataview' });

		// Action section
		const actionSection = content.createDiv({ cls: 'cr-migration-section' });
		actionSection.createEl('h3', { text: 'Action Recommended' });
		actionSection.createEl('p', {
			text: 'If you have event notes using the old "person" property, run the Cleanup Wizard to migrate them automatically. New imports will use the array format.'
		});

		// Buttons
		this.renderButtons(content);
	}

	/**
	 * Render the v0.17.0 sources migration notice
	 */
	private renderSourcesMigration(container: Element): void {
		// Header
		const header = container.createDiv({ cls: 'cr-migration-header' });
		const iconEl = header.createSpan({ cls: 'cr-migration-icon' });
		setIcon(iconEl, 'sparkles');
		header.createEl('h2', { text: "What's New in v0.17.0" });

		// Content
		const content = container.createDiv({ cls: 'cr-migration-content' });

		// Source format change section
		const section = content.createDiv({ cls: 'cr-migration-section' });
		section.createEl('h3', { text: 'Source Property Format Change' });

		section.createEl('p', {
			text: 'The indexed source format (source, source_2, source_3...) is now deprecated in favor of a YAML array format:'
		});

		// Code comparison
		const codeBlock = section.createDiv({ cls: 'cr-migration-code' });

		const oldCode = codeBlock.createDiv({ cls: 'cr-code-example cr-code-old' });
		oldCode.createEl('div', { cls: 'cr-code-label', text: 'Old format (deprecated)' });
		oldCode.createEl('pre', {
			text: `source: "[[Census 1900]]"
source_2: "[[Birth Certificate]]"`
		});

		const newCode = codeBlock.createDiv({ cls: 'cr-code-example cr-code-new' });
		newCode.createEl('div', { cls: 'cr-code-label', text: 'New format' });
		newCode.createEl('pre', {
			text: `sources:
  - "[[Census 1900]]"
  - "[[Birth Certificate]]"`
		});

		// Action section
		const actionSection = content.createDiv({ cls: 'cr-migration-section' });
		actionSection.createEl('h3', { text: 'Action Required' });
		actionSection.createEl('p', {
			text: 'If you have notes using the old format, run the Cleanup Wizard to migrate them automatically.'
		});

		// Buttons
		this.renderButtons(content);
	}

	/**
	 * Render the action buttons
	 */
	private renderButtons(content: Element): void {
		const buttons = content.createDiv({ cls: 'cr-migration-buttons' });

		const wizardBtn = buttons.createEl('button', {
			cls: 'mod-cta',
			text: 'Open Cleanup Wizard'
		});
		wizardBtn.addEventListener('click', () => {
			// Mark as seen and close
			void this.markAsSeen();
			this.leaf.detach();
			// Open the cleanup wizard
			this.app.workspace.trigger('canvas-roots:open-cleanup-wizard');
		});

		const dismissBtn = buttons.createEl('button', {
			cls: 'cr-migration-dismiss',
			text: 'Dismiss'
		});
		dismissBtn.addEventListener('click', () => {
			void this.markAsSeen();
			this.leaf.detach();
		});
	}

	async onClose(): Promise<void> {
		// Nothing to clean up
	}

	/**
	 * Mark the current version as seen so the notice doesn't appear again
	 */
	private async markAsSeen(): Promise<void> {
		this.plugin.settings.lastSeenVersion = this.plugin.manifest.version;
		await this.plugin.saveSettings();
	}
}
