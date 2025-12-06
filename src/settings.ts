import { App, PluginSettingTab, Setting } from 'obsidian';
import CanvasRootsPlugin from '../main';
import type { LogLevel } from './core/logging';
import type { RelationshipTypeDefinition } from './relationships';
import type { FictionalDateSystem } from './dates';
import type { OrganizationTypeDefinition } from './organizations';
import type { SourceTypeDefinition, CitationFormat } from './sources/types/source-types';

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

/**
 * Folder filter mode options
 * - 'disabled': Scan all folders (default - current behavior)
 * - 'exclude': Scan all folders except those in the exclusion list
 * - 'include': Only scan folders in the inclusion list
 */
export type FolderFilterMode = 'disabled' | 'exclude' | 'include';

export interface CanvasRootsSettings {
	defaultNodeWidth: number;
	defaultNodeHeight: number;
	horizontalSpacing: number;
	verticalSpacing: number;
	autoGenerateCrId: boolean;
	peopleFolder: string;
	placesFolder: string;
	mapsFolder: string;
	schemasFolder: string;
	canvasesFolder: string;
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
	// Privacy settings
	enablePrivacyProtection: boolean;
	livingPersonAgeThreshold: number;
	privacyDisplayFormat: 'living' | 'private' | 'initials' | 'hidden';
	hideDetailsForLiving: boolean;
	// Relationship history settings
	enableRelationshipHistory: boolean;
	historyRetentionDays: number;
	// Export settings
	exportFilenamePattern: string;
	// Folder filtering
	folderFilterMode: FolderFilterMode;
	excludedFolders: string[];
	includedFolders: string[];
	// Staging folder
	stagingFolder: string;
	enableStagingIsolation: boolean;
	// Place category defaults
	defaultPlaceCategory: PlaceCategory;
	placeCategoryRules: PlaceCategoryRule[];
	// Custom relationship types
	customRelationshipTypes: RelationshipTypeDefinition[];
	showBuiltInRelationshipTypes: boolean;
	// Fictional date systems
	enableFictionalDates: boolean;
	fictionalDateSystems: FictionalDateSystem[];
	showBuiltInDateSystems: boolean;
	// Organization settings
	organizationsFolder: string;
	customOrganizationTypes: OrganizationTypeDefinition[];
	showBuiltInOrganizationTypes: boolean;
	// Source management settings
	sourcesFolder: string;
	defaultCitationFormat: CitationFormat;
	showSourceThumbnails: boolean;
	thumbnailSize: 'small' | 'medium' | 'large';
	customSourceTypes: SourceTypeDefinition[];
	showBuiltInSourceTypes: boolean;
	// Source indicators on tree nodes
	showSourceIndicators: boolean;
	// Evidence visualization settings (Research tools - opt-in)
	trackFactSourcing: boolean;
	factCoverageThreshold: number;
	showResearchGapsInStatus: boolean;
	// Property aliases for custom frontmatter names
	propertyAliases: Record<string, string>;
	// Value aliases for custom property values
	valueAliases: ValueAliasSettings;
}

/**
 * Value alias settings structure
 * Maps user values to canonical values for each supported field type
 */
export interface ValueAliasSettings {
	eventType: Record<string, string>;      // userValue → canonicalEventType
	gender: Record<string, string>;         // userValue → canonicalGender
	placeCategory: Record<string, string>;  // userValue → canonicalPlaceCategory
}

/**
 * Rule for setting default place category based on folder or collection
 */
export interface PlaceCategoryRule {
	type: 'folder' | 'collection';
	pattern: string;  // Folder path or collection name
	category: PlaceCategory;
}

/**
 * Place categories (duplicated from models/place.ts to avoid circular imports)
 */
export type PlaceCategory = 'real' | 'historical' | 'disputed' | 'legendary' | 'mythological' | 'fictional';

/**
 * Get the default place category based on folder path and/or collection name.
 * Rules are checked in order:
 * 1. Collection-based rules (if collection is provided)
 * 2. Folder-based rules (if folder is provided)
 * 3. Global default
 */
export function getDefaultPlaceCategory(
	settings: CanvasRootsSettings,
	options?: { folder?: string; collection?: string }
): PlaceCategory {
	const { folder, collection } = options || {};

	// Check rules in order
	for (const rule of settings.placeCategoryRules) {
		if (rule.type === 'collection' && collection) {
			// Exact match for collection
			if (rule.pattern.toLowerCase() === collection.toLowerCase()) {
				return rule.category;
			}
		} else if (rule.type === 'folder' && folder) {
			// Path prefix match for folders
			const normalizedFolder = folder.toLowerCase().replace(/\\/g, '/');
			const normalizedPattern = rule.pattern.toLowerCase().replace(/\\/g, '/');
			if (normalizedFolder.startsWith(normalizedPattern) ||
				normalizedFolder === normalizedPattern) {
				return rule.category;
			}
		}
	}

	// Fall back to global default
	return settings.defaultPlaceCategory;
}

export const DEFAULT_SETTINGS: CanvasRootsSettings = {
	defaultNodeWidth: 200,
	defaultNodeHeight: 100,
	// Spacing values optimized for family-chart layout engine with 1.5x multiplier
	// family-chart-layout.ts applies 1.5x multiplier: 400 * 1.5 = 600px effective horizontal spacing
	horizontalSpacing: 400,  // Base horizontal spacing (multiplied by 1.5x in layout engine)
	verticalSpacing: 250,    // Vertical spacing between generations (used directly)
	autoGenerateCrId: true,
	peopleFolder: 'Canvas Roots/People',
	placesFolder: 'Canvas Roots/Places',
	mapsFolder: 'Canvas Roots/Places/Maps',
	schemasFolder: 'Canvas Roots/Schemas',
	canvasesFolder: 'Canvas Roots/Canvases',
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
	defaultLayoutType: 'standard',      // Default: standard family-chart layout
	// Privacy settings defaults
	enablePrivacyProtection: false,     // Default: OFF - user must opt-in to privacy protection
	livingPersonAgeThreshold: 100,      // Assume alive if born within last 100 years with no death date
	privacyDisplayFormat: 'living',     // Show "Living" for protected persons
	hideDetailsForLiving: true,         // Hide birth dates and places for living persons
	// Relationship history defaults
	enableRelationshipHistory: true,    // Default: ON - track relationship changes
	historyRetentionDays: 30,           // Keep history for 30 days by default
	// Export defaults
	exportFilenamePattern: '{name}-family-chart-{date}',  // Pattern with {name} and {date} placeholders
	// Folder filtering defaults
	folderFilterMode: 'disabled',  // Default: scan all folders (preserves existing behavior)
	excludedFolders: [],           // No folders excluded by default
	includedFolders: [],           // No inclusion filter by default
	// Staging folder defaults
	stagingFolder: '',             // Empty = no staging configured (must be set by user)
	enableStagingIsolation: true,  // When staging folder is set, auto-exclude from normal operations
	// Place category defaults
	defaultPlaceCategory: 'real',  // Default place category when creating new places
	placeCategoryRules: [],        // Folder/collection-based category rules
	// Custom relationship types
	customRelationshipTypes: [],   // User-defined relationship types (built-ins are always available)
	showBuiltInRelationshipTypes: true,  // Whether to show built-in types in UI
	// Fictional date systems
	enableFictionalDates: true,    // Enable fictional date parsing and display
	fictionalDateSystems: [],      // User-defined date systems (built-ins are always available)
	showBuiltInDateSystems: true,  // Whether to show built-in date systems (Middle-earth, Westeros, etc.)
	// Organization settings
	organizationsFolder: 'Canvas Roots/Organizations',  // Default folder for organization notes
	customOrganizationTypes: [],   // User-defined organization types (built-ins are always available)
	showBuiltInOrganizationTypes: true,  // Whether to show built-in organization types in UI
	// Source management settings
	sourcesFolder: 'Canvas Roots/Sources',  // Default folder for source notes
	defaultCitationFormat: 'evidence_explained',  // Evidence Explained is the genealogy standard
	showSourceThumbnails: true,   // Show media previews in gallery
	thumbnailSize: 'medium',      // Thumbnail size (small/medium/large)
	customSourceTypes: [],        // User-defined source types (built-ins are always available)
	showBuiltInSourceTypes: true, // Whether to show built-in source types in UI
	// Source indicators on tree nodes
	showSourceIndicators: false,   // Default OFF - users opt-in to this feature
	// Evidence visualization settings (Research tools - opt-in for advanced users)
	trackFactSourcing: false,      // Default OFF - opt-in feature for researchers
	factCoverageThreshold: 6,      // Number of facts for 100% coverage calculation
	showResearchGapsInStatus: true, // Show research gap summary when tracking is enabled
	// Property aliases for custom frontmatter names
	propertyAliases: {},           // Maps user property name → Canvas Roots canonical name
	// Value aliases for custom property values
	valueAliases: {
		eventType: {},             // Maps user event type → canonical event type
		gender: {},                // Maps user gender value → canonical gender
		placeCategory: {}          // Maps user place category → canonical place category
	}
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
		regenerateInfo.createEl('strong', { text: '💡 Tip:' });
		regenerateInfo.appendText(' After changing layout settings, right-click any existing canvas file and select ');
		regenerateInfo.createEl('strong', { text: '"Regenerate canvas"' });
		regenerateInfo.appendText(' to apply the new settings.');

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
			.setName('Places folder')
			.setDesc('Default folder for place notes (leave empty for vault root)')
			.addText(text => text
				.setPlaceholder('Places')
				.setValue(this.plugin.settings.placesFolder)
				.onChange(async (value) => {
					this.plugin.settings.placesFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Maps folder')
			.setDesc('Folder for custom map configuration notes (for fictional/historical maps)')
			.addText(text => text
				.setPlaceholder('Canvas Roots/Places/Maps')
				.setValue(this.plugin.settings.mapsFolder)
				.onChange(async (value) => {
					this.plugin.settings.mapsFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Canvases folder')
			.setDesc('Folder for generated family tree canvases (reserved for future use)')
			.addText(text => text
				.setPlaceholder('Canvas Roots/Canvases')
				.setValue(this.plugin.settings.canvasesFolder)
				.onChange(async (value) => {
					this.plugin.settings.canvasesFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Sources folder')
			.setDesc('Folder for source notes (census records, vital records, photos, etc.)')
			.addText(text => text
				.setPlaceholder('Canvas Roots/Sources')
				.setValue(this.plugin.settings.sourcesFolder)
				.onChange(async (value) => {
					this.plugin.settings.sourcesFolder = value;
					await this.plugin.saveSettings();
				}));

		// Staging folder section
		new Setting(containerEl)
			.setName('Staging folder')
			.setDesc('Folder for GEDCOM/CSV imports before merging into main tree. When set, this folder is automatically excluded from normal operations.')
			.addText(text => text
				.setPlaceholder('People-Staging')
				.setValue(this.plugin.settings.stagingFolder)
				.onChange(async (value) => {
					this.plugin.settings.stagingFolder = value;
					await this.plugin.saveSettings();
					// Refresh to show/hide the isolation toggle
					this.display();
				}));

		// Only show isolation toggle if staging folder is configured
		if (this.plugin.settings.stagingFolder) {
			new Setting(containerEl)
				.setName('Enable staging isolation')
				.setDesc('When enabled, staging folder is automatically excluded from tree generation, duplicate detection, and other normal operations.')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.enableStagingIsolation)
					.onChange(async (value) => {
						this.plugin.settings.enableStagingIsolation = value;
						await this.plugin.saveSettings();
					}));
		}

		// Folder filtering section
		new Setting(containerEl)
			.setName('Folder filtering')
			.setDesc('Control which folders are scanned for person notes')
			.addDropdown(dropdown => dropdown
				.addOption('disabled', 'Disabled (scan all folders)')
				.addOption('exclude', 'Exclude folders (scan all except listed)')
				.addOption('include', 'Include folders only (scan only listed)')
				.setValue(this.plugin.settings.folderFilterMode)
				.onChange(async (value: FolderFilterMode) => {
					this.plugin.settings.folderFilterMode = value;
					await this.plugin.saveSettings();
					// Refresh display to show/hide folder list
					this.display();
				}));

		// Show folder list based on mode
		if (this.plugin.settings.folderFilterMode !== 'disabled') {
			const isExcludeMode = this.plugin.settings.folderFilterMode === 'exclude';
			const folders = isExcludeMode
				? this.plugin.settings.excludedFolders
				: this.plugin.settings.includedFolders;

			new Setting(containerEl)
				.setName(isExcludeMode ? 'Excluded folders' : 'Included folders')
				.setDesc('One folder path per line. Subfolders are included automatically.')
				.addTextArea(textArea => textArea
					.setPlaceholder(isExcludeMode
						? `templates\narchive\n${this.app.vault.configDir}`
						: 'People\nFamily')
					.setValue(folders.join('\n'))
					.onChange(async (value) => {
						const folderList = value
							.split('\n')
							.map(f => f.trim())
							.filter(f => f.length > 0);

						if (isExcludeMode) {
							this.plugin.settings.excludedFolders = folderList;
						} else {
							this.plugin.settings.includedFolders = folderList;
						}
						await this.plugin.saveSettings();
					}));
		}

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
					this.plugin.registerFileModificationHandler();
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
					this.plugin.registerFileModificationHandler();
				})
				.setDisabled(!this.plugin.settings.enableBidirectionalSync));

		// Canvas styling
		new Setting(containerEl)
			.setName('Canvas styling')
			.setHeading();

		// Styling tip
		const stylingInfo = containerEl.createDiv({ cls: 'setting-item-description cr-info-box' });
		stylingInfo.createEl('strong', { text: '💡 Tip:' });
		stylingInfo.appendText(' After changing styling settings, right-click any existing canvas file and select ');
		stylingInfo.createEl('strong', { text: '"Regenerate canvas"' });
		stylingInfo.appendText(' to apply the new settings.');

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
			.setName('Show source indicators')
			.setDesc('Display source count badges on person nodes in generated trees (e.g., "📎 3" for 3 linked sources)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showSourceIndicators)
				.onChange(async (value) => {
					this.plugin.settings.showSourceIndicators = value;
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
				.addOption('debug', 'Debug (most verbose)')
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

		new Setting(containerEl)
			.setName('Log export folder')
			.setDesc('Vault folder for exported log files (e.g., ".canvas-roots/logs")')
			.addText(text => text
				.setPlaceholder('.canvas-roots/logs')
				.setValue(this.plugin.settings.logExportPath)
				.onChange(async (value) => {
					// Normalize the path (remove leading/trailing slashes)
					const normalized = value.replace(/^\/+|\/+$/g, '');
					this.plugin.settings.logExportPath = normalized;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Obfuscate log exports')
			.setDesc('Replace personally identifiable information (names, dates, paths) with placeholders when exporting logs. Recommended for sharing logs publicly.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.obfuscateLogExports)
				.onChange(async (value) => {
					this.plugin.settings.obfuscateLogExports = value;
					await this.plugin.saveSettings();
				}));

		// Privacy
		new Setting(containerEl)
			.setName('Privacy')
			.setHeading();

		new Setting(containerEl)
			.setName('Enable privacy protection')
			.setDesc('Protect living persons in exports and canvas displays. When enabled, living persons (those without a death date and born within the threshold) will be obfuscated.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enablePrivacyProtection)
				.onChange(async (value) => {
					this.plugin.settings.enablePrivacyProtection = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Living person age threshold')
			.setDesc('Assume a person is living if born within this many years and has no death date')
			.addText(text => text
				.setPlaceholder('100')
				.setValue(String(this.plugin.settings.livingPersonAgeThreshold))
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.livingPersonAgeThreshold = numValue;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Privacy display format')
			.setDesc('How to display protected persons in exports and canvases')
			.addDropdown(dropdown => dropdown
				.addOption('living', 'Show "Living" as name')
				.addOption('private', 'Show "Private" as name')
				.addOption('initials', 'Show initials only')
				.addOption('hidden', 'Exclude from output entirely')
				.setValue(this.plugin.settings.privacyDisplayFormat)
				.onChange(async (value: 'living' | 'private' | 'initials' | 'hidden') => {
					this.plugin.settings.privacyDisplayFormat = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Hide details for living persons')
			.setDesc('When enabled, birth dates and places are hidden for living persons even when showing their name')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hideDetailsForLiving)
				.onChange(async (value) => {
					this.plugin.settings.hideDetailsForLiving = value;
					await this.plugin.saveSettings();
				}));

		// Research Tools (optional - for advanced users)
		new Setting(containerEl)
			.setName('Research tools (optional)')
			.setHeading();

		const researchInfo = containerEl.createDiv({ cls: 'setting-item-description cr-info-box' });
		researchInfo.createEl('strong', { text: '🔬 For researchers:' });
		researchInfo.appendText(' These optional tools help track which facts have documentary evidence, aligned with the Genealogical Proof Standard. Leave disabled for casual use.');

		new Setting(containerEl)
			.setName('Enable fact-level source tracking')
			.setDesc('Track which specific facts (birth, death, marriage, etc.) have source citations. Enables the research gaps report in data quality tab.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackFactSourcing)
				.onChange(async (value) => {
					this.plugin.settings.trackFactSourcing = value;
					await this.plugin.saveSettings();
					// Refresh to show/hide dependent settings
					this.display();
				}));

		// Only show dependent settings if tracking is enabled
		if (this.plugin.settings.trackFactSourcing) {
			new Setting(containerEl)
				.setName('Fact coverage threshold')
				.setDesc('Number of key facts (birth, death, parents, etc.) for calculating 100% research coverage.')
				.addText(text => text
					.setPlaceholder('6')
					.setValue(String(this.plugin.settings.factCoverageThreshold))
					.onChange(async (value) => {
						const numValue = parseInt(value);
						if (!isNaN(numValue) && numValue > 0 && numValue <= 10) {
							this.plugin.settings.factCoverageThreshold = numValue;
							await this.plugin.saveSettings();
						}
					}));

			new Setting(containerEl)
				.setName('Show research gaps in status tab')
				.setDesc('Display a summary of unsourced facts in the control center status tab.')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.showResearchGapsInStatus)
					.onChange(async (value) => {
						this.plugin.settings.showResearchGapsInStatus = value;
						await this.plugin.saveSettings();
					}));
		}

		// Export
		new Setting(containerEl)
			.setName('Export')
			.setHeading();

		new Setting(containerEl)
			.setName('Export filename pattern')
			.setDesc('Pattern for exported filenames. Use {name} for root person name, {date} for current date.')
			.addText(text => text
				.setPlaceholder('{name}-family-chart-{date}')
				.setValue(this.plugin.settings.exportFilenamePattern)
				.onChange(async (value) => {
					this.plugin.settings.exportFilenamePattern = value || '{name}-family-chart-{date}';
					await this.plugin.saveSettings();
				}));
	}
}
