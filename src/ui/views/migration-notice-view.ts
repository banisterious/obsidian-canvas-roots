/**
 * Migration Notice View
 *
 * Displays a one-time notice when users upgrade to v0.17.0,
 * informing them about the source array migration and providing
 * a direct path to the Cleanup Wizard.
 */

import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';

export const VIEW_TYPE_MIGRATION_NOTICE = 'canvas-roots-migration-notice';

export class MigrationNoticeView extends ItemView {
	private plugin: CanvasRootsPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: CanvasRootsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_MIGRATION_NOTICE;
	}

	getDisplayText(): string {
		return 'Canvas Roots v0.17.0';
	}

	getIcon(): string {
		return 'info';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('cr-migration-notice');

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
		const buttons = content.createDiv({ cls: 'cr-migration-buttons' });

		const wizardBtn = buttons.createEl('button', {
			cls: 'mod-cta',
			text: 'Open Cleanup Wizard'
		});
		wizardBtn.addEventListener('click', async () => {
			// Mark as seen and close
			await this.markAsSeen();
			this.leaf.detach();
			// Open the cleanup wizard
			this.app.workspace.trigger('canvas-roots:open-cleanup-wizard');
		});

		const dismissBtn = buttons.createEl('button', {
			cls: 'cr-migration-dismiss',
			text: 'Dismiss'
		});
		dismissBtn.addEventListener('click', async () => {
			await this.markAsSeen();
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
