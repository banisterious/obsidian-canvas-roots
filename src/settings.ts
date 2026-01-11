import { App, Notice, normalizePath, PluginSettingTab, Setting, TFolder, TextComponent, AbstractInputSuggest, setIcon } from 'obsidian';
import CanvasRootsPlugin from '../main';
import type { LogLevel } from './core/logging';
import type { RelationshipTypeDefinition } from './relationships';
import type { FictionalDateSystem } from './dates';
import type { OrganizationTypeDefinition } from './organizations';
import type { SourceTypeDefinition, CitationFormat, SourceCategoryDefinition } from './sources/types/source-types';
import type { EventTypeDefinition, EventCategoryDefinition } from './events/types/event-types';
import type { OrganizationCategoryDefinition } from './organizations/types/organization-types';
import type { RelationshipCategoryDefinition } from './relationships/types/relationship-types';
import type { PlaceTypeDefinition, PlaceTypeCategoryDefinition } from './places/types/place-types';
import type { GedcomCompatibilityMode } from './gedcom/gedcom-preprocessor';
import {
	PropertyAliasService,
	PERSON_PROPERTY_METADATA,
	EVENT_PROPERTY_METADATA,
	PLACE_PROPERTY_METADATA,
	SOURCE_PROPERTY_METADATA,
	type PropertyMetadata
} from './core/property-alias-service';
import {
	ValueAliasService,
	EVENT_TYPE_LABELS,
	SEX_LABELS,
	PLACE_CATEGORY_LABELS,
	NOTE_TYPE_LABELS,
	CANONICAL_EVENT_TYPES,
	CANONICAL_SEX_VALUES,
	CANONICAL_PLACE_CATEGORIES,
	CANONICAL_NOTE_TYPES,
	type ValueAliasField
} from './core/value-alias-service';

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
 * Recent file entry for Dashboard
 * Tracks files accessed via Charted Roots features
 */
export interface RecentFileEntry {
	/** File path */
	path: string;
	/** Display name (file basename without extension) */
	name: string;
	/** Entity type (person, event, source, place, canvas, map) */
	type: 'person' | 'event' | 'source' | 'place' | 'canvas' | 'map' | 'organization';
	/** Timestamp of last access */
	timestamp: number;
}

/**
 * Information about the last export performed for a specific format
 */
export interface LastExportInfo {
	/** Timestamp of the export */
	timestamp: number;
	/** Number of people exported */
	peopleCount: number;
	/** Output destination (download or vault) */
	destination: 'download' | 'vault';
	/** File path (if saved to vault) */
	filePath?: string;
	/** Number of living people excluded due to privacy */
	privacyExcluded?: number;
}

/**
 * Last-used settings for Family Chart export wizard
 */
export interface LastFamilyChartExportSettings {
	/** Last selected format */
	format: 'png' | 'svg' | 'pdf' | 'odt';
	/** Last avatar setting */
	includeAvatars: boolean;
	/** Last PNG scale */
	scale: number;
	/** Last PDF page size */
	pageSize: 'fit' | 'a4' | 'letter' | 'legal' | 'tabloid';
	/** Last PDF layout */
	layout: 'single' | 'tiled';
	/** Last PDF orientation */
	orientation: 'auto' | 'portrait' | 'landscape';
	/** Last cover page setting */
	includeCoverPage: boolean;
}

/**
 * Custom colors for Family Chart view
 * When set, these override the default CSS variables
 */
export interface FamilyChartColors {
	/** Female card background color */
	femaleColor: string;
	/** Male card background color */
	maleColor: string;
	/** Unknown gender card background color */
	unknownColor: string;
	/** Chart background color (light theme) */
	backgroundLight: string;
	/** Chart background color (dark theme) */
	backgroundDark: string;
	/** Card text color (light theme) */
	textLight: string;
	/** Card text color (dark theme) */
	textDark: string;
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
 * - 'sex': Color by sex (green for male, purple for female) - GEDCOM aligned
 * - 'generation': Color by generation level (creates visual layers)
 * - 'collection': Color by collection (different color per collection)
 * - 'monochrome': No coloring (neutral for all nodes)
 */
export type ColorScheme = 'sex' | 'generation' | 'collection' | 'monochrome';

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
 * Canvas grouping strategy options
 * - 'none': No groups (default - current behavior)
 * - 'generation': Group nodes by generation level
 * - 'nuclear-family': Group nuclear families (parents + children)
 * - 'collection': Group by collection/family group name
 */
export type CanvasGroupingStrategy = 'none' | 'generation' | 'nuclear-family' | 'collection';

/**
 * Folder filter mode options
 * - 'disabled': Scan all folders (default - current behavior)
 * - 'exclude': Scan all folders except those in the exclusion list
 * - 'include': Only scan folders in the inclusion list
 */
export type FolderFilterMode = 'disabled' | 'exclude' | 'include';

/**
 * Calendarium integration mode
 * - 'off': No integration with Calendarium
 * - 'read': Import calendar definitions from Calendarium (read-only)
 */
export type CalendariumIntegrationMode = 'off' | 'read';

/**
 * Sex value normalization mode
 * - 'standard': Normalize to GEDCOM M/F values (default)
 * - 'schema-aware': Skip notes with schemas that define custom sex enum values
 * - 'disabled': Never normalize sex values
 */
export type SexNormalizationMode = 'standard' | 'schema-aware' | 'disabled';

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
	// Canvas grouping
	canvasGroupingStrategy: CanvasGroupingStrategy;
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
	showPronouns: boolean;
	/** Whether the user has dismissed the privacy notice (shown after importing living persons) */
	privacyNoticeDismissed: boolean;
	// Relationship history settings
	enableRelationshipHistory: boolean;
	historyRetentionDays: number;
	// Export settings
	exportFilenamePattern: string;
	preferredGedcomVersion: '5.5.1' | '7.0';
	// GEDCOM import settings
	/** Compatibility mode for GEDCOM imports (auto-detect and fix vendor-specific issues) */
	gedcomCompatibilityMode: GedcomCompatibilityMode;
	lastGedcomExport?: LastExportInfo;
	lastGedcomXExport?: LastExportInfo;
	lastGrampsExport?: LastExportInfo;
	lastCsvExport?: LastExportInfo;
	lastFamilyChartExport?: LastFamilyChartExportSettings;
	// Family Chart custom colors
	familyChartColors?: FamilyChartColors;
	// Folder filtering
	folderFilterMode: FolderFilterMode;
	excludedFolders: string[];
	includedFolders: string[];
	// Staging folder
	stagingFolder: string;
	enableStagingIsolation: boolean;
	// Template folder filtering
	/** Auto-detect template folders from Templates/Templater/QuickAdd plugins */
	autoDetectTemplateFolders: boolean;
	/** Additional folders to treat as template folders (excluded from note discovery) */
	templateFolders: string[];
	// Place category defaults
	defaultPlaceCategory: PlaceCategory;
	placeCategoryRules: PlaceCategoryRule[];
	// Place category → folder mapping (#163)
	/** Automatically organize places into subfolders based on their category */
	useCategorySubfolders: boolean;
	/** Custom category → folder mappings (overrides automatic subfolder naming) */
	placeCategoryFolderRules: PlaceCategoryFolderRule[];
	// Place type management
	customPlaceTypes: PlaceTypeDefinition[];
	showBuiltInPlaceTypes: boolean;
	/** Customizations for built-in place types (overrides name, description) */
	placeTypeCustomizations: Record<string, Partial<PlaceTypeDefinition>>;
	/** Hidden place types (won't appear in dropdowns, but existing notes still work) */
	hiddenPlaceTypes: string[];
	/** User-defined place type categories */
	customPlaceTypeCategories: PlaceTypeCategoryDefinition[];
	/** Customizations for built-in place type categories (name overrides) */
	placeTypeCategoryCustomizations: Record<string, Partial<PlaceTypeCategoryDefinition>>;
	/** Hidden/deleted built-in place type category IDs */
	hiddenPlaceTypeCategories: string[];
	/** Accept DMS coordinate format in place creation modal */
	enableDMSCoordinates: boolean;
	// Custom relationship types
	customRelationshipTypes: RelationshipTypeDefinition[];
	showBuiltInRelationshipTypes: boolean;
	/** Customizations for built-in relationship types (overrides name, color, lineStyle) */
	relationshipTypeCustomizations: Record<string, Partial<RelationshipTypeDefinition>>;
	/** Hidden relationship types (won't appear in dropdowns, but existing notes still work) */
	hiddenRelationshipTypes: string[];
	/** User-defined relationship categories */
	customRelationshipCategories: RelationshipCategoryDefinition[];
	/** Customizations for built-in relationship categories (name overrides) */
	relationshipCategoryCustomizations: Record<string, Partial<RelationshipCategoryDefinition>>;
	/** Hidden/deleted built-in relationship category IDs */
	hiddenRelationshipCategories: string[];
	// Fictional date systems
	enableFictionalDates: boolean;
	fictionalDateSystems: FictionalDateSystem[];
	showBuiltInDateSystems: boolean;
	// Universe settings
	universesFolder: string;
	// Organization settings
	organizationsFolder: string;
	customOrganizationTypes: OrganizationTypeDefinition[];
	showBuiltInOrganizationTypes: boolean;
	/** Customizations for built-in organization types (overrides name, icon, color) */
	organizationTypeCustomizations: Record<string, Partial<OrganizationTypeDefinition>>;
	/** Hidden organization types (won't appear in dropdowns, but existing notes still work) */
	hiddenOrganizationTypes: string[];
	/** User-defined organization categories */
	customOrganizationCategories: OrganizationCategoryDefinition[];
	/** Customizations for built-in organization categories (name overrides) */
	organizationCategoryCustomizations: Record<string, Partial<OrganizationCategoryDefinition>>;
	/** Hidden/deleted built-in organization category IDs */
	hiddenOrganizationCategories: string[];
	// Source management settings
	sourcesFolder: string;
	// Notes folder (for separate note files - Phase 4 Gramps integration)
	notesFolder: string;
	// Bases folder
	basesFolder: string;
	defaultCitationFormat: CitationFormat;
	showSourceThumbnails: boolean;
	thumbnailSize: 'small' | 'medium' | 'large';
	customSourceTypes: SourceTypeDefinition[];
	showBuiltInSourceTypes: boolean;
	/** Customizations for built-in source types (overrides name, icon, color) */
	sourceTypeCustomizations: Record<string, Partial<SourceTypeDefinition>>;
	/** Hidden source types (won't appear in dropdowns, but existing notes still work) */
	hiddenSourceTypes: string[];
	/** User-defined source categories */
	customSourceCategories: SourceCategoryDefinition[];
	/** Customizations for built-in source categories (name overrides) */
	sourceCategoryCustomizations: Record<string, Partial<SourceCategoryDefinition>>;
	/** Hidden/deleted built-in source category IDs */
	hiddenSourceCategories: string[];
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
	// Event management settings
	eventsFolder: string;
	timelinesFolder: string;
	customEventTypes: EventTypeDefinition[];
	showBuiltInEventTypes: boolean;
	/** Customizations for built-in event types (overrides name, icon, color) */
	eventTypeCustomizations: Record<string, Partial<EventTypeDefinition>>;
	/** Hidden event types (won't appear in dropdowns, but existing notes still work) */
	hiddenEventTypes: string[];
	/** User-defined event categories */
	customEventCategories: EventCategoryDefinition[];
	/** Customizations for built-in categories (name overrides) */
	categoryCustomizations: Record<string, Partial<EventCategoryDefinition>>;
	/** Hidden/deleted built-in category IDs */
	hiddenCategories: string[];
	// Note type detection settings
	noteTypeDetection: NoteTypeDetectionSettings;
	// Date validation settings
	dateFormatStandard: 'iso8601' | 'gedcom' | 'flexible';
	allowPartialDates: boolean;
	allowCircaDates: boolean;
	allowDateRanges: boolean;
	requireLeadingZeros: boolean;
	// Calendarium integration
	calendariumIntegration: CalendariumIntegrationMode;
	/** Show Calendarium dates (fc-date, fc-end) on timelines */
	syncCalendariumEvents: boolean;
	// Reports settings
	reportsFolder: string;
	// Sex value normalization
	sexNormalizationMode: SexNormalizationMode;
	// Dashboard settings
	dashboardVaultHealthCollapsed: boolean;
	/** Recent files accessed via CR features (max 5) */
	dashboardRecentFiles: RecentFileEntry[];
	/** Whether the user has seen the Dashboard first-run notice */
	dashboardFirstVisitDone: boolean;
	// Media folder filtering
	/** Folders to scan for media files (used by Find Unlinked, Media Manager stats, Media Picker) */
	mediaFolders: string[];
	/** Whether to limit media scanning to specified folders */
	enableMediaFolderFilter: boolean;
	// Gramps import settings
	/** Preserve subfolder structure when extracting media from .gpkg files */
	preserveMediaFolderStructure: boolean;
	// Dynamic content settings
	/** Callout type for frozen media galleries (info, note, etc.) */
	frozenGalleryCalloutType: string;
	// Cleanup wizard state (for resuming interrupted wizards)
	/** Persisted state of the cleanup wizard, if any */
	cleanupWizardState?: CleanupWizardPersistedState;
	// Create entity modal state (for resuming interrupted creation)
	/** Persisted state for create person modal */
	createPersonModalState?: CreateEntityPersistedState;
	/** Persisted state for create place modal */
	createPlaceModalState?: CreateEntityPersistedState;
	/** Persisted state for create event modal */
	createEventModalState?: CreateEntityPersistedState;
	/** Persisted state for create organization modal */
	createOrganizationModalState?: CreateEntityPersistedState;
	/** Persisted state for create source modal */
	createSourceModalState?: CreateEntityPersistedState;
	/** Persisted state for create note modal */
	createNoteModalState?: CreateEntityPersistedState;
	/** Persisted state for family wizard modal */
	familyWizardModalState?: CreateEntityPersistedState;
	/** Persisted state for map wizard modal */
	mapWizardModalState?: CreateEntityPersistedState;
	// Version tracking (for migration notices)
	/** Last plugin version the user has acknowledged (for showing upgrade notices) */
	lastSeenVersion?: string;
	/**
	 * Tracks completion of individual v0.18.9 nested property migrations.
	 * Migration notice remains visible until all applicable migrations are complete.
	 */
	nestedPropertiesMigration?: {
		/** True when sourced_facts → sourced_* migration is complete */
		sourcedFactsComplete?: boolean;
		/** True when events → event note files migration is complete */
		eventsComplete?: boolean;
	};
	// Inclusive parent relationships (opt-in feature)
	/** Enable gender-neutral parent relationships */
	enableInclusiveParents: boolean;
	/** Label for gender-neutral parent field (e.g., "Parents", "Guardians", "Progenitors") */
	parentFieldLabel: string;
	// Plugin rename migration (Charted Roots → Charted Roots)
	/**
	 * True when migration from Charted Roots to Charted Roots is complete.
	 * Migration updates canvas metadata and code block types in vault files.
	 */
	migratedToChartedRoots?: boolean;
}

/**
 * Persisted state for the cleanup wizard
 * Used to resume an interrupted cleanup session
 */
export interface CleanupWizardPersistedState {
	/** Current step number (1-10) */
	currentStep: number;
	/** Status and fix count for each step (keyed by step number) */
	steps: Record<number, {
		status: 'pending' | 'in_progress' | 'complete' | 'skipped';
		issueCount: number;
		fixCount: number;
		skippedReason?: string;
	}>;
	/** When the state was saved */
	savedAt: number;
	/** Step completion tracking for dependency checks (keyed by step ID) */
	stepCompletion?: Record<string, {
		/** Whether this step was explicitly completed (not just skipped) */
		completed: boolean;
		/** Timestamp when completed */
		completedAt: number;
		/** Number of issues fixed in this step */
		issuesFixed: number;
	}>;
}

/**
 * Persisted state for create entity modals
 * Used to resume interrupted entity creation (person, place, event, etc.)
 */
export interface CreateEntityPersistedState {
	/** Modal type identifier */
	modalType: 'person' | 'place' | 'event' | 'organization' | 'source' | 'note' | 'family-wizard' | 'map-wizard';
	/** Form data as key-value pairs */
	formData: Record<string, unknown>;
	/** When the state was saved */
	savedAt: number;
}

/**
 * Settings for note type detection
 * Supports multiple detection methods to avoid conflicts with other plugins
 */
export interface NoteTypeDetectionSettings {
	/**
	 * Enable tag-based detection (#person, #place, etc.)
	 * When enabled, tags are checked as a fallback after property-based detection
	 */
	enableTagDetection: boolean;

	/**
	 * Primary property to check for type
	 * - 'cr_type': Use cr_type property (recommended, avoids conflicts)
	 * - 'type': Use type property (legacy default)
	 */
	primaryTypeProperty: 'cr_type' | 'type';
}

/**
 * Value alias settings structure
 * Maps user values to canonical values for each supported field type
 */
export interface ValueAliasSettings {
	eventType: Record<string, string>;        // userValue → canonicalEventType
	sex: Record<string, string>;              // userValue → canonicalSex (GEDCOM aligned)
	gender_identity: Record<string, string>;  // userValue → canonicalGenderIdentity
	placeCategory: Record<string, string>;    // userValue → canonicalPlaceCategory
	noteType: Record<string, string>;         // userValue → canonicalNoteType (cr_type/type)
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
 * Rule for mapping place category to a specific subfolder (category → folder)
 * This is the reverse of PlaceCategoryRule (folder → category)
 */
export interface PlaceCategoryFolderRule {
	category: PlaceCategory;
	folder: string;  // Relative path from placesFolder (e.g., "Fantasy/Fictional")
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

/**
 * Get the folder path for a place based on its category (#163)
 * Priority:
 * 1. Check for explicit category → folder rule
 * 2. If useCategorySubfolders enabled and not default category, use automatic subfolder
 * 3. Fall back to base placesFolder
 *
 * @param settings - Plugin settings
 * @param category - Place category
 * @returns Full folder path (e.g., "Charted Roots/Places/Historical")
 */
export function getPlaceFolderForCategory(
	settings: CanvasRootsSettings,
	category: PlaceCategory
): string {
	const baseFolder = settings.placesFolder || 'Charted Roots/Places';
	const defaultCategory = settings.defaultPlaceCategory || 'real';

	// Check for explicit rule first
	const rule = settings.placeCategoryFolderRules?.find(r => r.category === category);
	if (rule) {
		// Normalize path separators
		const subfolder = rule.folder.replace(/\\/g, '/');
		return `${baseFolder}/${subfolder}`.replace(/\/+/g, '/');
	}

	// Fall back to automatic subfolder if enabled and not default category
	if (settings.useCategorySubfolders && category !== defaultCategory) {
		// Capitalize first letter: historical → Historical
		const subfolder = category.charAt(0).toUpperCase() + category.slice(1);
		return `${baseFolder}/${subfolder}`;
	}

	// Fall back to base folder
	return baseFolder;
}

export const DEFAULT_SETTINGS: CanvasRootsSettings = {
	defaultNodeWidth: 200,
	defaultNodeHeight: 100,
	// Spacing values optimized for family-chart layout engine with 1.5x multiplier
	// family-chart-layout.ts applies 1.5x multiplier: 400 * 1.5 = 600px effective horizontal spacing
	horizontalSpacing: 400,  // Base horizontal spacing (multiplied by 1.5x in layout engine)
	verticalSpacing: 250,    // Vertical spacing between generations (used directly)
	autoGenerateCrId: true,
	peopleFolder: 'Charted Roots/People',
	placesFolder: 'Charted Roots/Places',
	mapsFolder: 'Charted Roots/Places/Maps',
	schemasFolder: 'Charted Roots/Schemas',
	canvasesFolder: 'Charted Roots/Canvases',
	logExportPath: '.canvas-roots/logs',
	logLevel: 'debug',
	obfuscateLogExports: true,  // Secure by default - protect PII in log exports
	recentTrees: [],
	recentImports: [],
	// Arrow styling defaults
	parentChildArrowStyle: 'directed',  // Parent → Child with single arrow
	spouseArrowStyle: 'undirected',     // Spouse — Spouse with no arrows (cleaner look)
	// Node coloring default
	nodeColorScheme: 'sex',             // Sex-based coloring (GEDCOM aligned)
	// Canvas grouping default
	canvasGroupingStrategy: 'none',     // No groups by default (current behavior)
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
	showPronouns: true,                 // Show pronouns in person picker and displays
	privacyNoticeDismissed: false,      // Show privacy notice after first import with living persons
	// Relationship history defaults
	enableRelationshipHistory: true,    // Default: ON - track relationship changes
	historyRetentionDays: 30,           // Keep history for 30 days by default
	// Export defaults
	exportFilenamePattern: '{name}-family-chart-{date}',  // Pattern with {name} and {date} placeholders
	preferredGedcomVersion: '5.5.1',  // Default to 5.5.1 for maximum compatibility
	// GEDCOM import defaults
	gedcomCompatibilityMode: 'auto',  // Auto-detect MyHeritage and apply fixes
	// Folder filtering defaults
	folderFilterMode: 'disabled',  // Default: scan all folders (preserves existing behavior)
	excludedFolders: [],           // No folders excluded by default
	includedFolders: [],           // No inclusion filter by default
	// Staging folder defaults
	stagingFolder: '',             // Empty = no staging configured (must be set by user)
	enableStagingIsolation: true,  // When staging folder is set, auto-exclude from normal operations
	// Template folder filtering defaults
	autoDetectTemplateFolders: true,  // Auto-detect from Templates/Templater/QuickAdd plugins
	templateFolders: [],              // Additional user-specified template folders
	// Place category defaults
	defaultPlaceCategory: 'real',  // Default place category when creating new places
	placeCategoryRules: [],        // Folder/collection-based category rules
	// Place category → folder mapping (#163)
	useCategorySubfolders: false,  // Default false for existing vaults (set true on new installs via migration check)
	placeCategoryFolderRules: [],  // Custom category → folder mappings (empty = use automatic naming)
	// Place type management
	customPlaceTypes: [],                    // User-defined place types (built-ins are always available)
	showBuiltInPlaceTypes: true,             // Whether to show built-in place types in UI
	placeTypeCustomizations: {},             // Overrides for built-in place types
	hiddenPlaceTypes: [],                    // Place types hidden from dropdowns
	customPlaceTypeCategories: [],           // User-defined place type categories
	placeTypeCategoryCustomizations: {},     // Overrides for built-in place type category names
	hiddenPlaceTypeCategories: [],           // Hidden/deleted built-in place type categories
	enableDMSCoordinates: false,             // Opt-in: accept DMS coordinate format
	// Custom relationship types
	customRelationshipTypes: [],   // User-defined relationship types (built-ins are always available)
	showBuiltInRelationshipTypes: true,  // Whether to show built-in types in UI
	relationshipTypeCustomizations: {},  // Overrides for built-in relationship types
	hiddenRelationshipTypes: [],         // Relationship types hidden from dropdowns
	customRelationshipCategories: [],    // User-defined relationship categories
	relationshipCategoryCustomizations: {}, // Overrides for built-in relationship category names
	hiddenRelationshipCategories: [],    // Hidden/deleted built-in relationship categories
	// Fictional date systems
	enableFictionalDates: true,    // Enable fictional date parsing and display
	fictionalDateSystems: [],      // User-defined date systems (built-ins are always available)
	showBuiltInDateSystems: true,  // Whether to show built-in date systems (Middle-earth, Westeros, etc.)
	// Universe settings
	universesFolder: 'Charted Roots/Universes',  // Default folder for universe notes
	// Organization settings
	organizationsFolder: 'Charted Roots/Organizations',  // Default folder for organization notes
	customOrganizationTypes: [],   // User-defined organization types (built-ins are always available)
	showBuiltInOrganizationTypes: true,  // Whether to show built-in organization types in UI
	organizationTypeCustomizations: {},  // Overrides for built-in organization types
	hiddenOrganizationTypes: [],         // Organization types hidden from dropdowns
	customOrganizationCategories: [],    // User-defined organization categories
	organizationCategoryCustomizations: {}, // Overrides for built-in organization category names
	hiddenOrganizationCategories: [],    // Hidden/deleted built-in organization categories
	// Source management settings
	sourcesFolder: 'Charted Roots/Sources',  // Default folder for source notes
	// Notes folder (for separate note files - Phase 4 Gramps integration)
	notesFolder: 'Charted Roots/Notes',      // Default folder for note entity files
	// Bases folder
	basesFolder: 'Charted Roots/Bases',      // Default folder for base files
	defaultCitationFormat: 'evidence_explained',  // Evidence Explained is the genealogy standard
	showSourceThumbnails: true,   // Show media previews in gallery
	thumbnailSize: 'medium',      // Thumbnail size (small/medium/large)
	customSourceTypes: [],        // User-defined source types (built-ins are always available)
	showBuiltInSourceTypes: true, // Whether to show built-in source types in UI
	sourceTypeCustomizations: {}, // Overrides for built-in source types
	hiddenSourceTypes: [],        // Source types hidden from dropdowns
	customSourceCategories: [],   // User-defined source categories
	sourceCategoryCustomizations: {}, // Overrides for built-in source category names
	hiddenSourceCategories: [],   // Hidden/deleted built-in source categories
	// Source indicators on tree nodes
	showSourceIndicators: false,   // Default OFF - users opt-in to this feature
	// Evidence visualization settings (Research tools - opt-in for advanced users)
	trackFactSourcing: false,      // Default OFF - opt-in feature for researchers
	factCoverageThreshold: 6,      // Number of facts for 100% coverage calculation
	showResearchGapsInStatus: true, // Show research gap summary when tracking is enabled
	// Property aliases for custom frontmatter names
	propertyAliases: {},           // Maps user property name → Charted Roots canonical name
	// Value aliases for custom property values
	valueAliases: {
		eventType: {},             // Maps user event type → canonical event type
		sex: {},                   // Maps user sex value → canonical sex (GEDCOM aligned)
		gender_identity: {},       // Maps user gender_identity value → canonical gender identity
		placeCategory: {},         // Maps user place category → canonical place category
		noteType: {}               // Maps user note type (cr_type/type) → canonical note type
	},
	// Event management settings
	eventsFolder: 'Charted Roots/Events',      // Default folder for event notes
	timelinesFolder: 'Charted Roots/Timelines', // Default folder for timeline notes
	customEventTypes: [],                      // User-defined event types (built-ins are always available)
	showBuiltInEventTypes: true,               // Whether to show built-in event types in UI
	eventTypeCustomizations: {},               // Overrides for built-in event types
	hiddenEventTypes: [],                      // Event types hidden from dropdowns
	customEventCategories: [],                 // User-defined event categories
	categoryCustomizations: {},                // Overrides for built-in category names
	hiddenCategories: [],                      // Hidden/deleted built-in categories
	// Note type detection settings
	noteTypeDetection: {
		enableTagDetection: true,              // Allow #person, #place, etc. as fallback
		primaryTypeProperty: 'cr_type'         // cr_type recommended to avoid conflicts with other plugins
	},
	// Date validation settings
	dateFormatStandard: 'flexible',            // Most permissive default
	allowPartialDates: true,                   // Allow YYYY-MM or YYYY
	allowCircaDates: true,                     // Allow circa dates (c. 1850, ca. 1920)
	allowDateRanges: true,                     // Allow date ranges (1850-1920)
	requireLeadingZeros: false,                // Don't require YYYY-MM-DD format (allow YYYY-M-D)
	// Calendarium integration
	calendariumIntegration: 'off',             // Default: no integration (invisible to users without Calendarium)
	syncCalendariumEvents: false,              // Default: don't show fc-* dates on timelines
	// Reports settings
	reportsFolder: 'Charted Roots/Reports',     // Default folder for generated reports
	// Sex value normalization
	sexNormalizationMode: 'standard',          // Default: normalize to GEDCOM M/F
	// Dashboard settings
	dashboardVaultHealthCollapsed: false,      // Default: expanded on first visit
	dashboardRecentFiles: [],                  // Empty by default
	dashboardFirstVisitDone: false,            // Show welcome notice on first visit
	// Media folder filtering
	mediaFolders: [],                          // Empty = no filtering (scan entire vault)
	enableMediaFolderFilter: false,            // Disabled by default for backwards compatibility
	// Gramps import settings
	preserveMediaFolderStructure: false,       // Disabled by default for backwards compatibility
	// Dynamic content settings
	frozenGalleryCalloutType: 'info',          // Callout type for frozen media galleries
	// Inclusive parent relationships (opt-in feature)
	enableInclusiveParents: false,             // Default: OFF - users opt-in to gender-neutral parents
	parentFieldLabel: 'Parents'                // Default label for gender-neutral parent field
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

		// Search box for filtering settings
		const searchContainer = containerEl.createDiv({ cls: 'cr-settings-search' });
		new Setting(searchContainer)
			.setName('Search settings')
			.addSearch(search => {
				search
					.setPlaceholder('Filter settings...')
					.onChange((query) => {
						this.filterSettings(containerEl, query);
					});
			});

		// Cross-reference callout pointing to Control Center Preferences
		const preferencesCallout = containerEl.createDiv({ cls: 'setting-item-description cr-info-box cr-preferences-callout' });
		preferencesCallout.createEl('strong', { text: '💡 Looking for folder locations, property aliases, or canvas styling?' });
		preferencesCallout.createEl('br');
		preferencesCallout.appendText('These settings are in ');
		const preferencesLink = preferencesCallout.createEl('a', {
			text: 'Control Center → Preferences',
			href: '#'
		});
		preferencesLink.addEventListener('click', (e) => {
			e.preventDefault();
			// Close the plugin settings modal first, then open Control Center
			// Access Obsidian's internal settings API (not exported in types)
			const appWithSettings = this.app as App & { setting?: { close: () => void } };
			appWithSettings.setting?.close();
			this.app.workspace.trigger('charted-roots:open-control-center', 'preferences');
		});
		preferencesCallout.appendText(' for easier access alongside other configuration options.');

		// ═══════════════════════════════════════════════════════════════════════
		// DATA & DETECTION SECTION (Collapsible)
		// ═══════════════════════════════════════════════════════════════════════
		const dataDetails = containerEl.createEl('details', { cls: 'cr-settings-section' });
		dataDetails.setAttribute('open', ''); // Open by default
		const dataSummary = dataDetails.createEl('summary');
		dataSummary.createSpan({ text: 'Data & detection' });
		dataSummary.createSpan({ cls: 'cr-section-desc', text: 'How Charted Roots identifies and syncs notes' });
		const dataContent = dataDetails.createDiv({ cls: 'cr-section-content' });

		// Auto-generate cr_id
		new Setting(dataContent)
			.setName('Auto-generate cr_id')
			.setDesc('Automatically generate cr_id for person notes that don\'t have one')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoGenerateCrId)
				.onChange(async (value) => {
					this.plugin.settings.autoGenerateCrId = value;
					await this.plugin.saveSettings();
				}));

		// Primary type property (from Note type detection)
		new Setting(dataContent)
			.setName('Primary type property')
			.setDesc('Which frontmatter property to check first for note type (person, place, event, etc.)')
			.addDropdown(dropdown => dropdown
				.addOption('cr_type', 'cr_type (recommended)')
				.addOption('type', 'type (legacy)')
				.setValue(this.plugin.settings.noteTypeDetection.primaryTypeProperty)
				.onChange(async (value) => {
					this.plugin.settings.noteTypeDetection.primaryTypeProperty = value as 'type' | 'cr_type';
					await this.plugin.saveSettings();
				}));

		// Enable tag-based detection
		new Setting(dataContent)
			.setName('Enable tag-based detection')
			.setDesc('Allow tags (#person, #place, #event, #source) as fallback when no type property is found')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.noteTypeDetection.enableTagDetection)
				.onChange(async (value) => {
					this.plugin.settings.noteTypeDetection.enableTagDetection = value;
					await this.plugin.saveSettings();
				}));

		// Accept DMS coordinate format
		new Setting(dataContent)
			.setName('Accept DMS coordinate format')
			.setDesc('Allow entering coordinates in degrees, minutes, seconds format (e.g., 33°51\'08"N)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableDMSCoordinates)
				.onChange(async (value) => {
					this.plugin.settings.enableDMSCoordinates = value;
					await this.plugin.saveSettings();
				}));

		// GEDCOM compatibility mode
		new Setting(dataContent)
			.setName('GEDCOM compatibility mode')
			.setDesc('Fix vendor-specific issues in GEDCOM imports (MyHeritage: BOM, double-encoded entities, <br> tags)')
			.addDropdown(dropdown => dropdown
				.addOption('auto', 'Auto (detect and fix)')
				.addOption('myheritage', 'MyHeritage (always fix)')
				.addOption('none', 'None (disabled)')
				.setValue(this.plugin.settings.gedcomCompatibilityMode)
				.onChange(async (value) => {
					this.plugin.settings.gedcomCompatibilityMode = value as GedcomCompatibilityMode;
					await this.plugin.saveSettings();
				}));

		// Bidirectional relationship sync
		new Setting(dataContent)
			.setName('Enable bidirectional relationship sync')
			.setDesc('Automatically maintain reciprocal relationships when editing notes')
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

		// Sync on file modify
		new Setting(dataContent)
			.setName('Sync on file modify')
			.setDesc('Automatically sync relationships when person notes are edited')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.syncOnFileModify)
				.onChange(async (value) => {
					this.plugin.settings.syncOnFileModify = value;
					await this.plugin.saveSettings();
					// Re-register file modification handler with new settings
					this.plugin.registerFileModificationHandler();
				})
				.setDisabled(!this.plugin.settings.enableBidirectionalSync));

		// ═══════════════════════════════════════════════════════════════════════
		// PRIVACY & EXPORT SECTION (Collapsible)
		// ═══════════════════════════════════════════════════════════════════════
		const privacyDetails = containerEl.createEl('details', { cls: 'cr-settings-section' });
		const privacySummary = privacyDetails.createEl('summary');
		privacySummary.createSpan({ text: 'Privacy & export' });
		privacySummary.createSpan({ cls: 'cr-section-desc', text: 'Control how data is protected and exported' });
		const privacyContent = privacyDetails.createDiv({ cls: 'cr-section-content' });

		new Setting(privacyContent)
			.setName('Enable privacy protection')
			.setDesc('Protect living persons in exports and canvas displays')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enablePrivacyProtection)
				.onChange(async (value) => {
					this.plugin.settings.enablePrivacyProtection = value;
					await this.plugin.saveSettings();
				}));

		new Setting(privacyContent)
			.setName('Living person age threshold')
			.setDesc('Assume a person is living if born within this many years')
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

		new Setting(privacyContent)
			.setName('Privacy display format')
			.setDesc('How to display protected persons')
			.addDropdown(dropdown => dropdown
				.addOption('living', 'Show "Living"')
				.addOption('private', 'Show "Private"')
				.addOption('initials', 'Show initials only')
				.addOption('hidden', 'Exclude entirely')
				.setValue(this.plugin.settings.privacyDisplayFormat)
				.onChange(async (value: 'living' | 'private' | 'initials' | 'hidden') => {
					this.plugin.settings.privacyDisplayFormat = value;
					await this.plugin.saveSettings();
				}));

		new Setting(privacyContent)
			.setName('Hide details for living persons')
			.setDesc('Hide birth dates and places for living persons')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hideDetailsForLiving)
				.onChange(async (value) => {
					this.plugin.settings.hideDetailsForLiving = value;
					await this.plugin.saveSettings();
				}));

		new Setting(privacyContent)
			.setName('Export filename pattern')
			.setDesc('Use {name} for root person, {date} for current date')
			.addText(text => text
				.setPlaceholder('{name}-family-chart-{date}')
				.setValue(this.plugin.settings.exportFilenamePattern)
				.onChange(async (value) => {
					this.plugin.settings.exportFilenamePattern = value || '{name}-family-chart-{date}';
					await this.plugin.saveSettings();
				}));

		// ═══════════════════════════════════════════════════════════════════════
		// RESEARCH TOOLS SECTION (Collapsible)
		// ═══════════════════════════════════════════════════════════════════════
		const researchDetails = containerEl.createEl('details', { cls: 'cr-settings-section' });
		const researchSummary = researchDetails.createEl('summary');
		researchSummary.createSpan({ text: 'Research tools' });
		researchSummary.createSpan({ cls: 'cr-section-desc', text: 'Optional features for advanced genealogists' });
		const researchContent = researchDetails.createDiv({ cls: 'cr-section-content' });

		const researchInfo = researchContent.createDiv({ cls: 'setting-item-description cr-info-box' });
		researchInfo.createEl('strong', { text: '🔬' });
		researchInfo.appendText(' These tools help track which facts have documentary evidence, aligned with the Genealogical Proof Standard.');

		new Setting(researchContent)
			.setName('Enable fact-level source tracking')
			.setDesc('Track which specific facts have source citations')
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
			new Setting(researchContent)
				.setName('Fact coverage threshold')
				.setDesc('Number of key facts for 100% coverage calculation')
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

			new Setting(researchContent)
				.setName('Show research gaps in status tab')
				.setDesc('Display summary of unsourced facts in control center')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.showResearchGapsInStatus)
					.onChange(async (value) => {
						this.plugin.settings.showResearchGapsInStatus = value;
						await this.plugin.saveSettings();
					}));
		}

		// ═══════════════════════════════════════════════════════════════════════
		// LOGGING SECTION (Collapsible)
		// ═══════════════════════════════════════════════════════════════════════
		const loggingDetails = containerEl.createEl('details', { cls: 'cr-settings-section' });
		const loggingSummary = loggingDetails.createEl('summary');
		loggingSummary.createSpan({ text: 'Logging' });
		loggingSummary.createSpan({ cls: 'cr-section-desc', text: 'Debug output and log exports' });
		const loggingContent = loggingDetails.createDiv({ cls: 'cr-section-content' });

		new Setting(loggingContent)
			.setName('Log level')
			.setDesc('Verbosity of console logging')
			.addDropdown(dropdown => dropdown
				.addOption('debug', 'Debug (verbose)')
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

		new Setting(loggingContent)
			.setName('Log export folder')
			.setDesc('Vault folder for exported log files')
			.addText(text => text
				.setPlaceholder('.canvas-roots/logs')
				.setValue(this.plugin.settings.logExportPath)
				.onChange(async (value) => {
					// Normalize the path (remove leading/trailing slashes)
					const normalized = value.replace(/^\/+|\/+$/g, '');
					this.plugin.settings.logExportPath = normalized;
					await this.plugin.saveSettings();
				}));

		new Setting(loggingContent)
			.setName('Obfuscate log exports')
			.setDesc('Replace PII with placeholders when exporting logs')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.obfuscateLogExports)
				.onChange(async (value) => {
					this.plugin.settings.obfuscateLogExports = value;
					await this.plugin.saveSettings();
				}));

		new Setting(loggingContent)
			.setName('Export logs')
			.setDesc('Export collected logs to a file in the vault')
			.addButton(button => button
				.setButtonText('Export')
				.onClick(async () => {
					const { LoggerFactory, obfuscateLogs } = await import('./core/logging');
					const logs = LoggerFactory.getLogs();

					if (logs.length === 0) {
						new Notice('No logs to export');
						return;
					}

					// Optionally obfuscate
					const logsToExport = this.plugin.settings.obfuscateLogExports
						? obfuscateLogs(logs)
						: logs;

					// Format logs as text
					const lines = logsToExport.map(entry => {
						const timestamp = entry.timestamp.toISOString();
						const level = entry.level.toUpperCase().padEnd(5);
						const dataStr = entry.data ? ` | ${JSON.stringify(entry.data)}` : '';
						return `[${timestamp}] ${level} [${entry.component}/${entry.category}] ${entry.message}${dataStr}`;
					});
					const content = lines.join('\n');

					// Determine output path
					const folder = this.plugin.settings.logExportPath || '.canvas-roots/logs';
					const filename = `canvas-roots-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
					const fullPath = normalizePath(`${folder}/${filename}`);

					// Ensure folder exists
					const folderPath = normalizePath(folder);
					const existingFolder = this.app.vault.getAbstractFileByPath(folderPath);
					if (!existingFolder) {
						await this.app.vault.createFolder(folderPath);
					}

					// Write the file
					await this.app.vault.create(fullPath, content);
					new Notice(`Exported ${logs.length} log entries to ${fullPath}`);
				}));

		// ═══════════════════════════════════════════════════════════════════════
		// ADVANCED SECTION (Collapsible)
		// ═══════════════════════════════════════════════════════════════════════
		const advancedDetails = containerEl.createEl('details', { cls: 'cr-settings-section' });
		const advancedSummary = advancedDetails.createEl('summary');
		advancedSummary.createSpan({ text: 'Advanced' });
		advancedSummary.createSpan({ cls: 'cr-section-desc', text: 'Folder filtering and edge cases' });
		const advancedContent = advancedDetails.createDiv({ cls: 'cr-section-content' });

		// Folder filtering
		new Setting(advancedContent)
			.setName('Folder filtering')
			.setDesc('Control which folders are scanned for notes')
			.addDropdown(dropdown => dropdown
				.addOption('disabled', 'Disabled (scan all)')
				.addOption('exclude', 'Exclude folders')
				.addOption('include', 'Include folders only')
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

			new Setting(advancedContent)
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

		// Template folder filtering
		new Setting(advancedContent)
			.setName('Auto-detect template folders')
			.setDesc('Automatically exclude template folders (from Templates, Templater, QuickAdd plugins)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoDetectTemplateFolders)
				.onChange(async (value) => {
					this.plugin.settings.autoDetectTemplateFolders = value;
					await this.plugin.saveSettings();
					// Refresh template filter and display
					const templateFilter = this.plugin.getTemplateFilter();
					if (templateFilter) {
						templateFilter.refresh();
					}
					this.display();
				}));

		// Show detected template folders (read-only info)
		const templateFilter = this.plugin.getTemplateFilter();
		const detectedFolders = templateFilter?.getDetectedFolders() || [];
		if (detectedFolders.length > 0 && this.plugin.settings.autoDetectTemplateFolders) {
			const detectedInfo = advancedContent.createDiv({ cls: 'setting-item-description cr-info-box' });
			detectedInfo.createEl('strong', { text: '📁 Detected template folders:' });
			detectedInfo.createEl('br');
			detectedInfo.appendText(detectedFolders.join(', '));
		}

		// Additional template folders (user-specified)
		new Setting(advancedContent)
			.setName('Additional template folders')
			.setDesc('Additional folders to exclude from note discovery (one per line)')
			.addTextArea(textArea => textArea
				.setPlaceholder('_templates\nmy-templates')
				.setValue((this.plugin.settings.templateFolders || []).join('\n'))
				.onChange(async (value) => {
					const folderList = value
						.split('\n')
						.map(f => f.trim())
						.filter(f => f.length > 0);

					this.plugin.settings.templateFolders = folderList;
					await this.plugin.saveSettings();
				}));

	}

	/**
	 * Filter visible settings based on search query
	 */
	private filterSettings(containerEl: HTMLElement, query: string): void {
		const normalizedQuery = query.toLowerCase().trim();
		const sections = containerEl.querySelectorAll('.cr-settings-section');

		sections.forEach(section => {
			const settingItems = section.querySelectorAll('.cr-section-content .setting-item');
			let visibleCount = 0;

			settingItems.forEach(item => {
				const settingItem = item as HTMLElement;
				const nameEl = settingItem.querySelector('.setting-item-name');
				const descEl = settingItem.querySelector('.setting-item-description');

				const name = nameEl?.textContent?.toLowerCase() || '';
				const desc = descEl?.textContent?.toLowerCase() || '';

				const matches = !normalizedQuery ||
					name.includes(normalizedQuery) ||
					desc.includes(normalizedQuery);

				settingItem.toggleClass('crc-hidden', !matches);
				if (matches) visibleCount++;
			});

			// Show/hide section based on whether it has visible items
			const sectionEl = section as HTMLElement;
			if (normalizedQuery && visibleCount === 0) {
				sectionEl.addClass('crc-hidden');
			} else {
				sectionEl.removeClass('crc-hidden');
				// Auto-expand sections with matches when searching
				if (normalizedQuery && visibleCount > 0) {
					(section as HTMLDetailsElement).open = true;
				}
			}
		});
	}
}
