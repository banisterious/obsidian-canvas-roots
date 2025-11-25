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

/**
 * Node color scheme options
 * - 'gender': Color by gender (green for male, purple for female)
 * - 'generation': Color by generation level (creates visual layers)
 * - 'collection': Color by collection (different color per collection)
 * - 'monochrome': No coloring (neutral for all nodes)
 */
export type ColorScheme = 'gender' | 'generation' | 'collection' | 'monochrome';

/**
 * Canvas color values (Obsidian's 6 preset colors)
 * - '1': Red
 * - '2': Orange
 * - '3': Yellow
 * - '4': Green
 * - '5': Cyan
 * - '6': Purple
 * - 'none': No color (theme default)
 */
export type CanvasColor = '1' | '2' | '3' | '4' | '5' | '6' | 'none';

/**
 * Spouse edge label format options
 * - 'none': No labels (default - clean look)
 * - 'date-only': Just marriage date (e.g., "m. 1985")
 * - 'date-location': Date and location (e.g., "m. 1985 | Boston, MA")
 * - 'full': Date, location, and status (e.g., "m. 1985 | Boston, MA | div. 1992")
 */
export type SpouseEdgeLabelFormat = 'none' | 'date-only' | 'date-location' | 'full';

/**
 * Layout algorithm options for tree generation
 * - 'standard': Default family-chart layout with standard spacing
 * - 'compact': Tighter spacing for large trees (50% of standard spacing)
 * - 'timeline': Horizontal timeline layout by birth year
 * - 'hourglass': Ancestors above, descendants below a focus person
 */
export type LayoutType = 'standard' | 'compact' | 'timeline' | 'hourglass';

export interface CanvasRootsSettings {
	defaultNodeWidth: number;
	defaultNodeHeight: number;
	horizontalSpacing: number;
	verticalSpacing: number;
	autoGenerateCrId: boolean;
	peopleFolder: string;
	logExportPath: string;
	logLevel: LogLevel;
	obfuscateLogExports: boolean;
	recentTrees: RecentTreeInfo[];
	recentImports: RecentImportInfo[];
	// Arrow styling
	parentChildArrowStyle: ArrowStyle;
	spouseArrowStyle: ArrowStyle;
	// Node coloring
	nodeColorScheme: ColorScheme;
	// Edge coloring
	parentChildEdgeColor: CanvasColor;
	spouseEdgeColor: CanvasColor;
	// Marriage metadata display
	showSpouseEdges: boolean;
	spouseEdgeLabelFormat: SpouseEdgeLabelFormat;
	// Bidirectional relationship sync
	enableBidirectionalSync: boolean;
	syncOnFileModify: boolean;
	// Layout algorithm
	defaultLayoutType: LayoutType;
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
	logExportPath: '.canvas-roots/logs',
	logLevel: 'debug',
	obfuscateLogExports: true,  // Secure by default - protect PII in log exports
	recentTrees: [],
	recentImports: [],
	// Arrow styling defaults
	parentChildArrowStyle: 'directed',  // Parent → Child with single arrow
	spouseArrowStyle: 'undirected',     // Spouse — Spouse with no arrows (cleaner look)
	// Node coloring default
	nodeColorScheme: 'gender',          // Gender-based coloring for backward compatibility
	// Edge coloring defaults (neutral/subtle)
	parentChildEdgeColor: 'none',       // No color - use theme default (clean, subtle)
	spouseEdgeColor: 'none',            // No color - use theme default (clean, subtle)
	// Marriage metadata display defaults
	showSpouseEdges: false,             // Default: OFF (clean look, no spouse edges)
	spouseEdgeLabelFormat: 'date-only', // When enabled, show just marriage date
	// Bidirectional relationship sync defaults
	enableBidirectionalSync: true,      // Default: ON - automatically sync relationships
	syncOnFileModify: true,             // Default: ON - sync when files are modified
	// Layout algorithm default
	defaultLayoutType: 'standard'       // Default: standard family-chart layout
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

		// Regenerate canvas feature info
		const regenerateInfo = containerEl.createDiv({ cls: 'setting-item-description cr-info-box' });
		regenerateInfo.innerHTML = '<strong>💡 Tip:</strong> After changing layout settings, right-click any existing canvas file and select ' +
			'<strong>"Regenerate canvas"</strong> to apply the new settings.';

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

		new Setting(containerEl)
			.setName('Enable bidirectional relationship sync')
			.setDesc('Automatically maintain reciprocal relationships (e.g., when you set someone as a parent, that person is automatically added as a child in the parent\'s note)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableBidirectionalSync)
				.onChange(async (value) => {
					this.plugin.settings.enableBidirectionalSync = value;
					await this.plugin.saveSettings();
					// Re-register file modification handler with new settings
					(this.plugin as any).registerFileModificationHandler?.();
					// Refresh display to update disabled state
					this.display();
				}));

		new Setting(containerEl)
			.setName('Sync on file modify')
			.setDesc('Automatically sync relationships when person notes are edited (works with Bases table edits)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.syncOnFileModify)
				.onChange(async (value) => {
					this.plugin.settings.syncOnFileModify = value;
					await this.plugin.saveSettings();
					// Re-register file modification handler with new settings
					(this.plugin as any).registerFileModificationHandler?.();
				})
				.setDisabled(!this.plugin.settings.enableBidirectionalSync));

		// Canvas styling
		new Setting(containerEl)
			.setName('Canvas styling')
			.setHeading();

		// Styling tip
		const stylingInfo = containerEl.createDiv({ cls: 'setting-item-description cr-info-box' });
		stylingInfo.innerHTML = '<strong>💡 Tip:</strong> After changing styling settings, right-click any existing canvas file and select ' +
			'<strong>"Regenerate canvas"</strong> to apply the new settings.';

		new Setting(containerEl)
			.setName('Node color scheme')
			.setDesc('How to color person nodes in the family tree')
			.addDropdown(dropdown => dropdown
				.addOption('gender', 'Gender (green for male, purple for female)')
				.addOption('generation', 'Generation (color by generation level)')
				.addOption('monochrome', 'Monochrome (no coloring)')
				.setValue(this.plugin.settings.nodeColorScheme)
				.onChange(async (value: ColorScheme) => {
					this.plugin.settings.nodeColorScheme = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Parent-child arrow style')
			.setDesc('Arrow style for parent-to-child relationship edges')
			.addDropdown(dropdown => dropdown
				.addOption('directed', 'Directed (→ arrow pointing to child)')
				.addOption('bidirectional', 'Bidirectional (↔ arrows on both ends)')
				.addOption('undirected', 'Undirected (— no arrows)')
				.setValue(this.plugin.settings.parentChildArrowStyle)
				.onChange(async (value: ArrowStyle) => {
					this.plugin.settings.parentChildArrowStyle = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Spouse arrow style')
			.setDesc('Arrow style for spouse relationship edges')
			.addDropdown(dropdown => dropdown
				.addOption('directed', 'Directed (→ arrow pointing forward)')
				.addOption('bidirectional', 'Bidirectional (↔ arrows on both ends)')
				.addOption('undirected', 'Undirected (— no arrows)')
				.setValue(this.plugin.settings.spouseArrowStyle)
				.onChange(async (value: ArrowStyle) => {
					this.plugin.settings.spouseArrowStyle = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Parent-child edge color')
			.setDesc('Color for parent-to-child relationship edges')
			.addDropdown(dropdown => dropdown
				.addOption('none', 'None (theme default)')
				.addOption('1', 'Red')
				.addOption('2', 'Orange')
				.addOption('3', 'Yellow')
				.addOption('4', 'Green')
				.addOption('5', 'Cyan')
				.addOption('6', 'Purple')
				.setValue(this.plugin.settings.parentChildEdgeColor)
				.onChange(async (value: CanvasColor) => {
					this.plugin.settings.parentChildEdgeColor = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Spouse edge color')
			.setDesc('Color for spouse relationship edges')
			.addDropdown(dropdown => dropdown
				.addOption('none', 'None (theme default)')
				.addOption('1', 'Red')
				.addOption('2', 'Orange')
				.addOption('3', 'Yellow')
				.addOption('4', 'Green')
				.addOption('5', 'Cyan')
				.addOption('6', 'Purple')
				.setValue(this.plugin.settings.spouseEdgeColor)
				.onChange(async (value: CanvasColor) => {
					this.plugin.settings.spouseEdgeColor = value;
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
