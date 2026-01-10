/**
 * Integrations Settings Card
 *
 * UI component for managing third-party plugin integrations in Control Center.
 * Currently supports Calendarium integration for shared calendar definitions.
 */

import { Setting, Notice } from 'obsidian';
import type CanvasRootsPlugin from '../../main';
import type { LucideIconName } from '../ui/lucide-icons';
import { getCalendariumBridge } from './calendarium-bridge';
import type { CalendariumIntegrationMode } from '../settings';

/**
 * Create the integrations card for Control Center Preferences tab
 * Only renders if at least one supported integration is available
 *
 * @returns The card element, or null if no integrations are available
 */
export function createIntegrationsCard(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	createCard: (options: { title: string; icon?: LucideIconName }) => HTMLElement
): HTMLElement | null {
	const bridge = getCalendariumBridge(plugin.app);

	// Only show the card if Calendarium is installed
	if (!bridge.isAvailable()) {
		return null;
	}

	const card = createCard({
		title: 'Integrations',
		icon: 'link-2'
	});

	// Append card to container (createCard creates but doesn't append)
	container.appendChild(card);

	const content = card.querySelector('.crc-card__content') as HTMLElement;

	// Calendarium section
	renderCalendariumSection(content, plugin, bridge);

	return card;
}

/**
 * Render the Calendarium integration settings section
 */
function renderCalendariumSection(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	bridge: ReturnType<typeof getCalendariumBridge>
): void {
	// Section header
	const sectionHeader = container.createDiv({ cls: 'cr-integrations-section-header' });
	sectionHeader.createEl('h4', { text: 'Calendarium', cls: 'cr-subsection-heading' });

	// Description
	container.createEl('p', {
		text: 'Import calendar definitions from Calendarium to use for fictional dates.',
		cls: 'cr-text--muted cr-integrations-desc'
	});

	// Integration mode dropdown
	new Setting(container)
		.setName('Integration mode')
		.setDesc('Controls how Charted Roots interacts with Calendarium')
		.addDropdown(dropdown => {
			dropdown
				.addOption('off', 'Off')
				.addOption('read', 'Read-only (import calendars)')
				.setValue(plugin.settings.calendariumIntegration)
				.onChange(async (value: CalendariumIntegrationMode) => {
					plugin.settings.calendariumIntegration = value;
					await plugin.saveSettings();

					// Refresh the status display and sync toggle
					void renderCalendariumStatus(statusContainer, plugin, bridge);
					renderSyncToggle(syncSettingContainer, plugin);

					if (value === 'read') {
						new Notice('Calendarium calendars will now appear in date system dropdowns');
					}
				});
		});

	// Status container (shows available calendars when enabled)
	const statusContainer = container.createDiv({ cls: 'cr-calendarium-status' });
	void renderCalendariumStatus(statusContainer, plugin, bridge);

	// Timeline sync toggle (only show when integration is enabled)
	const syncSettingContainer = container.createDiv({ cls: 'cr-calendarium-sync-setting' });
	renderSyncToggle(syncSettingContainer, plugin);
}

/**
 * Render the toggle for showing Calendarium dates on timelines
 */
function renderSyncToggle(
	container: HTMLElement,
	plugin: CanvasRootsPlugin
): void {
	container.empty();

	// Only show when integration is enabled
	if (plugin.settings.calendariumIntegration === 'off') {
		return;
	}

	new Setting(container)
		.setName('Show Calendarium dates on timelines')
		.setDesc('Display events with fc-date and fc-end fields on person and place timelines')
		.addToggle(toggle => {
			toggle
				.setValue(plugin.settings.syncCalendariumEvents)
				.onChange(async (value: boolean) => {
					plugin.settings.syncCalendariumEvents = value;
					await plugin.saveSettings();

					if (value) {
						new Notice('Calendarium dates will now appear on timelines');
					}
				});
		});
}

/**
 * Render the status display showing available Calendarium calendars
 */
async function renderCalendariumStatus(
	container: HTMLElement,
	plugin: CanvasRootsPlugin,
	bridge: ReturnType<typeof getCalendariumBridge>
): Promise<void> {
	container.empty();

	if (plugin.settings.calendariumIntegration === 'off') {
		return;
	}

	// Initialize the bridge to get calendar data
	const initialized = await bridge.initialize();

	if (!initialized) {
		container.createEl('p', {
			text: 'Unable to connect to Calendarium. Make sure the plugin is enabled.',
			cls: 'cr-text--warning'
		});
		return;
	}

	const calendarNames = bridge.getCalendarNames();

	if (calendarNames.length === 0) {
		container.createEl('p', {
			text: 'No calendars found in Calendarium.',
			cls: 'cr-text--muted'
		});
		return;
	}

	// Show available calendars
	const statusEl = container.createDiv({ cls: 'cr-calendarium-calendars' });
	statusEl.createEl('span', {
		text: `Available calendars: `,
		cls: 'cr-text--muted'
	});
	statusEl.createEl('span', {
		text: calendarNames.join(', '),
		cls: 'cr-calendarium-calendar-list'
	});
}

/**
 * Check if any integrations are available (for conditional rendering)
 */
export function hasAvailableIntegrations(plugin: CanvasRootsPlugin): boolean {
	const bridge = getCalendariumBridge(plugin.app);
	return bridge.isAvailable();
}
