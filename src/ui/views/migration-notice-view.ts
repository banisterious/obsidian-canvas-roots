/**
 * Migration Notice View
 *
 * Displays a one-time notice when users upgrade to versions with breaking changes,
 * informing them about data migrations and providing a path to the Cleanup Wizard.
 *
 * Supported migrations:
 * - v0.17.0: Source property format (source, source_2 → sources array)
 * - v0.18.0: Event person property (person → persons array)
 * - v0.18.9: Nested properties redesign (sourced_facts → sourced_*, events → event notes)
 */

import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import type CanvasRootsPlugin from '../../../main';

export const VIEW_TYPE_MIGRATION_NOTICE = 'canvas-roots-migration-notice';

/**
 * Migration type for the notice
 */
type MigrationType = 'sources' | 'event-persons' | 'nested-properties';

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
		// Check for 0.18.9+ first (nested properties migration)
		if (this.migrationType === 'nested-properties') {
			return 'Charted Roots v0.18.9';
		}
		if (version.startsWith('0.18')) {
			return 'Charted Roots v0.18.0';
		}
		return 'Charted Roots v0.17.0';
	}

	getIcon(): string {
		return 'info';
	}

	/**
	 * Determine which migration notice to show based on plugin version
	 */
	private determineMigrationType(): MigrationType {
		const version = this.plugin.manifest.version;
		// Check for 0.18.9+ (nested properties migration)
		if (this.isVersionAtLeast(version, '0.18.9')) {
			return 'nested-properties';
		}
		if (version.startsWith('0.18')) {
			return 'event-persons';
		}
		return 'sources';
	}

	/**
	 * Compare version strings (semver-like comparison)
	 */
	private isVersionAtLeast(current: string, minimum: string): boolean {
		const currentParts = current.split('.').map(p => parseInt(p) || 0);
		const minimumParts = minimum.split('.').map(p => parseInt(p) || 0);

		for (let i = 0; i < Math.max(currentParts.length, minimumParts.length); i++) {
			const curr = currentParts[i] || 0;
			const min = minimumParts[i] || 0;
			if (curr > min) return true;
			if (curr < min) return false;
		}
		return true; // Equal versions
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- ItemView.onOpen requires async signature
	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('cr-migration-notice');

		if (this.migrationType === 'nested-properties') {
			this.renderNestedPropertiesMigration(container);
		} else if (this.migrationType === 'event-persons') {
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
	 * Render the v0.18.9 nested properties migration notice
	 */
	private renderNestedPropertiesMigration(container: Element): void {
		// Header
		const header = container.createDiv({ cls: 'cr-migration-header' });
		const iconEl = header.createSpan({ cls: 'cr-migration-icon' });
		setIcon(iconEl, 'sparkles');
		header.createEl('h2', { text: "What's New in v0.18.9" });

		// Content
		const content = container.createDiv({ cls: 'cr-migration-content' });

		// Introduction
		const introSection = content.createDiv({ cls: 'cr-migration-section' });
		introSection.createEl('p', {
			text: 'This version fixes compatibility issues with Obsidian\'s Properties panel. Two features have been redesigned to use flat property formats that work seamlessly with Obsidian.'
		});

		// Get migration status
		const migration = this.plugin.settings.nestedPropertiesMigration || {};
		const sourcedFactsComplete = migration.sourcedFactsComplete ?? false;
		const eventsComplete = migration.eventsComplete ?? false;

		// === Evidence Tracking Migration ===
		const evidenceSection = content.createDiv({ cls: 'cr-migration-section' });
		const evidenceHeader = evidenceSection.createDiv({ cls: 'cr-migration-section-header' });
		if (sourcedFactsComplete) {
			const checkIcon = evidenceHeader.createSpan({ cls: 'cr-migration-check' });
			setIcon(checkIcon, 'check-circle');
		}
		evidenceHeader.createEl('h3', { text: 'Evidence Tracking Property Format' });

		evidenceSection.createEl('p', {
			text: 'The nested sourced_facts object is replaced with individual flat properties for each fact type.'
		});

		// Code comparison for sourced_facts
		const evidenceCode = evidenceSection.createDiv({ cls: 'cr-migration-code' });

		const oldEvidenceCode = evidenceCode.createDiv({ cls: 'cr-code-example cr-code-old' });
		oldEvidenceCode.createEl('div', { cls: 'cr-code-label', text: 'Old format (nested object)' });
		oldEvidenceCode.createEl('pre', {
			text: `sourced_facts:
  birth_date:
    sources:
      - "[[Census 1870]]"
  death_date:
    sources:
      - "[[Death Certificate]]"`
		});

		const newEvidenceCode = evidenceCode.createDiv({ cls: 'cr-code-example cr-code-new' });
		newEvidenceCode.createEl('div', { cls: 'cr-code-label', text: 'New format (flat properties)' });
		newEvidenceCode.createEl('pre', {
			text: `sourced_birth_date:
  - "[[Census 1870]]"
sourced_death_date:
  - "[[Death Certificate]]"`
		});

		// === Life Events Migration ===
		const eventsSection = content.createDiv({ cls: 'cr-migration-section' });
		const eventsHeader = eventsSection.createDiv({ cls: 'cr-migration-section-header' });
		if (eventsComplete) {
			const checkIcon = eventsHeader.createSpan({ cls: 'cr-migration-check' });
			setIcon(checkIcon, 'check-circle');
		}
		eventsHeader.createEl('h3', { text: 'Life Events Property Format' });

		eventsSection.createEl('p', {
			text: 'Inline events arrays are replaced with links to separate event note files.'
		});

		// Code comparison for events
		const eventsCode = eventsSection.createDiv({ cls: 'cr-migration-code' });

		const oldEventsCode = eventsCode.createDiv({ cls: 'cr-code-example cr-code-old' });
		oldEventsCode.createEl('div', { cls: 'cr-code-label', text: 'Old format (inline array)' });
		oldEventsCode.createEl('pre', {
			text: `events:
  - event_type: residence
    place: "[[New York]]"
    date_from: "1920"`
		});

		const newEventsCode = eventsCode.createDiv({ cls: 'cr-code-example cr-code-new' });
		newEventsCode.createEl('div', { cls: 'cr-code-label', text: 'New format (event note links)' });
		newEventsCode.createEl('pre', {
			text: `life_events:
  - "[[Events/John Smith - Residence 1920]]"`
		});

		// Benefits section
		const benefitsSection = content.createDiv({ cls: 'cr-migration-section' });
		benefitsSection.createEl('h3', { text: 'Benefits' });

		const benefitsList = benefitsSection.createEl('ul');
		benefitsList.createEl('li', { text: 'No more "Type mismatch" warnings in Properties panel' });
		benefitsList.createEl('li', { text: 'Safe to edit properties without data corruption' });
		benefitsList.createEl('li', { text: 'Better Dataview and Bases compatibility' });
		benefitsList.createEl('li', { text: 'Each event as a note enables linking, tags, and attachments' });

		// Action section
		const actionSection = content.createDiv({ cls: 'cr-migration-section' });
		actionSection.createEl('h3', { text: 'Action Recommended' });
		actionSection.createEl('p', {
			text: 'Use the Cleanup Wizard to migrate existing data. The plugin reads both old and new formats, so migration can be done at your convenience.'
		});

		// Buttons with multi-action aware dismiss
		this.renderNestedPropertiesButtons(content, sourcedFactsComplete, eventsComplete);
	}

	/**
	 * Render buttons for nested properties migration (with multi-action completion tracking)
	 */
	private renderNestedPropertiesButtons(content: Element, sourcedFactsComplete: boolean, eventsComplete: boolean): void {
		const buttons = content.createDiv({ cls: 'cr-migration-buttons' });

		const wizardBtn = buttons.createEl('button', {
			cls: 'mod-cta',
			text: 'Open Cleanup Wizard'
		});
		wizardBtn.addEventListener('click', () => {
			this.leaf.detach();
			// Open the cleanup wizard
			this.app.workspace.trigger('canvas-roots:open-cleanup-wizard');
		});

		// Only enable dismiss if both migrations are complete OR user has no data to migrate
		const canDismiss = (sourcedFactsComplete && eventsComplete);
		const dismissBtn = buttons.createEl('button', {
			cls: 'cr-migration-dismiss',
			text: canDismiss ? 'Dismiss' : 'Complete migrations to dismiss'
		});
		dismissBtn.disabled = !canDismiss;
		if (canDismiss) {
			dismissBtn.addEventListener('click', () => {
				void this.markAsSeen();
				this.leaf.detach();
			});
		}

		// Add skip button for users who want to dismiss without migrating
		const skipBtn = buttons.createEl('button', {
			cls: 'cr-migration-skip',
			text: 'Skip for now'
		});
		skipBtn.addEventListener('click', () => {
			void this.markAsSeen();
			this.leaf.detach();
		});
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
