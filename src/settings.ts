import { App, PluginSettingTab, Setting } from 'obsidian';
import CanvasRootsPlugin from '../main';
import type { LogLevel } from './core/logging';

export interface CanvasRootsSettings {
	defaultNodeWidth: number;
	defaultNodeHeight: number;
	horizontalSpacing: number;
	verticalSpacing: number;
	autoGenerateCrId: boolean;
	peopleFolder: string;
	logExportPath: string;
	logLevel: LogLevel;
}

export const DEFAULT_SETTINGS: CanvasRootsSettings = {
	defaultNodeWidth: 200,
	defaultNodeHeight: 100,
	// Spacing values optimized for family-chart layout engine with 1.5x multiplier
	// family-chart-layout.ts applies 1.5x multiplier: 400 * 1.5 = 600px effective horizontal spacing
	horizontalSpacing: 400,  // Base horizontal spacing (multiplied by 1.5x in layout engine)
	verticalSpacing: 250,    // Vertical spacing between generations (used directly)
	autoGenerateCrId: true,
	peopleFolder: '',
	logExportPath: '',
	logLevel: 'debug'
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
