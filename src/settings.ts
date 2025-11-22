import { App, PluginSettingTab, Setting } from 'obsidian';
import CanvasRootsPlugin from '../main';
import type { LogLevel } from './core/logging';

export interface RecentTreeInfo {
	canvasPath: string;
	canvasName: string;
	peopleCount: number;
	edgeCount: number;
	rootPerson: string;
	timestamp: number;
}

export interface RecentImportInfo {
	fileName: string;
	recordsImported: number;
	notesCreated: number;
	timestamp: number;
}

/**
 * Arrow style for relationship edges
 * - 'directed': Single arrow pointing to child/target (default)
 * - 'bidirectional': Arrows on both ends
 * - 'undirected': No arrows (just lines)
 */
export type ArrowStyle = 'directed' | 'bidirectional' | 'undirected';

export interface CanvasRootsSettings {
	defaultNodeWidth: number;
	defaultNodeHeight: number;
	horizontalSpacing: number;
	verticalSpacing: number;
	autoGenerateCrId: boolean;
	peopleFolder: string;
	logExportPath: string;
	logLevel: LogLevel;
	recentTrees: RecentTreeInfo[];
	recentImports: RecentImportInfo[];
	// Arrow styling
	parentChildArrowStyle: ArrowStyle;
	spouseArrowStyle: ArrowStyle;
}

export const DEFAULT_SETTINGS: CanvasRootsSettings = {
	defaultNodeWidth: 200,
	defaultNodeHeight: 100,
	// Spacing values optimized for family-chart layout engine with 1.5x multiplier
	// family-chart-layout.ts applies 1.5x multiplier: 400 * 1.5 = 600px effective horizontal spacing
	horizontalSpacing: 400,  // Base horizontal spacing (multiplied by 1.5x in layout engine)
	verticalSpacing: 250,    // Vertical spacing between generations (used directly)
	autoGenerateCrId: true,
	peopleFolder: 'Canvas Roots',
	logExportPath: '',
	logLevel: 'debug',
	recentTrees: [],
	recentImports: [],
	// Arrow styling defaults
	parentChildArrowStyle: 'directed',  // Parent → Child with single arrow
	spouseArrowStyle: 'undirected'      // Spouse — Spouse with no arrows (cleaner look)
};

export class CanvasRootsSettingTab extends PluginSettingTab {
	plugin: CanvasRootsPlugin;

	constructor(app: App, plugin: CanvasRootsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// Layout
		new Setting(containerEl)
			.setName('Layout')
			.setHeading();

		// Re-layout feature info
		const relayoutInfo = containerEl.createDiv({ cls: 'setting-item-description' });
		relayoutInfo.style.marginBottom = '1em';
		relayoutInfo.style.padding = '0.75em';
		relayoutInfo.style.background = 'var(--background-secondary)';
		relayoutInfo.style.borderRadius = '4px';
		relayoutInfo.innerHTML = '<strong>💡 Tip:</strong> After changing layout settings, right-click any existing canvas file and select ' +
			'<strong>"Re-layout family tree"</strong> to apply the new settings.';

		new Setting(containerEl)
			.setName('Default node width')
			.setDesc('Width of person nodes in pixels')
			.addText(text => text
				.setPlaceholder('200')
				.setValue(String(this.plugin.settings.defaultNodeWidth))
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.defaultNodeWidth = numValue;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Default node height')
			.setDesc('Height of person nodes in pixels')
			.addText(text => text
				.setPlaceholder('100')
				.setValue(String(this.plugin.settings.defaultNodeHeight))
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.defaultNodeHeight = numValue;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Horizontal spacing')
			.setDesc('Space between nodes horizontally in pixels')
			.addText(text => text
				.setPlaceholder('400')
				.setValue(String(this.plugin.settings.horizontalSpacing))
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.horizontalSpacing = numValue;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Vertical spacing')
			.setDesc('Space between generations vertically in pixels')
			.addText(text => text
				.setPlaceholder('250')
				.setValue(String(this.plugin.settings.verticalSpacing))
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.verticalSpacing = numValue;
						await this.plugin.saveSettings();
					}
				}));

		// Data
		new Setting(containerEl)
			.setName('Data')
			.setHeading();

		new Setting(containerEl)
			.setName('People folder')
			.setDesc('Folder path for person notes (leave empty for vault root)')
			.addText(text => text
				.setPlaceholder('People')
				.setValue(this.plugin.settings.peopleFolder)
				.onChange(async (value) => {
					this.plugin.settings.peopleFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-generate cr_id')
			.setDesc('Automatically generate cr_id for person notes that don\'t have one')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoGenerateCrId)
				.onChange(async (value) => {
					this.plugin.settings.autoGenerateCrId = value;
					await this.plugin.saveSettings();
				}));

		// Logging
		new Setting(containerEl)
			.setName('Logging')
			.setHeading();

		new Setting(containerEl)
			.setName('Log level')
			.setDesc('Set the verbosity of console logging. Debug shows all messages, Info shows important events, Warn shows warnings only, Error shows errors only, Off disables logging.')
			.addDropdown(dropdown => dropdown
				.addOption('debug', 'Debug (Most Verbose)')
				.addOption('info', 'Info')
				.addOption('warn', 'Warn')
				.addOption('error', 'Error')
				.addOption('off', 'Off')
				.setValue(this.plugin.settings.logLevel)
				.onChange(async (value: LogLevel) => {
					this.plugin.settings.logLevel = value;
					await this.plugin.saveSettings();
					// Update logger immediately
					const { LoggerFactory } = await import('./core/logging');
					LoggerFactory.setLogLevel(value);
				}));
	}
}
