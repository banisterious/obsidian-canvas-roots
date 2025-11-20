import { App, PluginSettingTab, Setting } from 'obsidian';
import CanvasRootsPlugin from '../main';

export interface CanvasRootsSettings {
	defaultNodeWidth: number;
	defaultNodeHeight: number;
	horizontalSpacing: number;
	verticalSpacing: number;
	gedcomImportMode: 'canvas-only' | 'vault-sync';
	autoGenerateCrId: boolean;
	peopleFolder: string;
	logExportPath: string;
}

export const DEFAULT_SETTINGS: CanvasRootsSettings = {
	defaultNodeWidth: 200,
	defaultNodeHeight: 100,
	horizontalSpacing: 50,
	verticalSpacing: 100,
	gedcomImportMode: 'canvas-only',
	autoGenerateCrId: true,
	peopleFolder: '',
	logExportPath: ''
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
				.setPlaceholder('50')
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
				.setPlaceholder('100')
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

		// GEDCOM import
		new Setting(containerEl)
			.setName('GEDCOM import')
			.setHeading();

		new Setting(containerEl)
			.setName('Default import mode')
			.setDesc('Canvas-only: quick visualization. Vault-sync: create notes for all individuals.')
			.addDropdown(dropdown => dropdown
				.addOption('canvas-only', 'Canvas Visualization Only')
				.addOption('vault-sync', 'Full Vault Synchronization')
				.setValue(this.plugin.settings.gedcomImportMode)
				.onChange(async (value: 'canvas-only' | 'vault-sync') => {
					this.plugin.settings.gedcomImportMode = value;
					await this.plugin.saveSettings();
				}));
	}
}
