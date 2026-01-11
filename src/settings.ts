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
	/** UI label preference for romantic relationships: "spouse" or "partner" */
	romanticRelationshipLabel: 'spouse' | 'partner';
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
	logExportPath: '.charted-roots/logs',
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
	romanticRelationshipLabel: 'spouse', // UI label for romantic relationships (spouse/partner)
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

		// ═══════════════════════════════════════════════════════════════════════
		// SECTION 1: FOLDERS
		// ═══════════════════════════════════════════════════════════════════════
		const foldersDetails = containerEl.createEl('details', { cls: 'cr-settings-section' });
		foldersDetails.setAttribute('open', ''); // Open by default
		const foldersSummary = foldersDetails.createEl('summary');
		foldersSummary.createSpan({ text: 'Folders' });
		foldersSummary.createSpan({ cls: 'cr-section-desc', text: 'Where Charted Roots stores and finds notes' });
		const foldersContent = foldersDetails.createDiv({ cls: 'cr-section-content' });

		// Folder explanation
		const folderExplanation = foldersContent.createDiv({ cls: 'setting-item-description cr-info-box' });
		folderExplanation.appendText('These folders determine where new notes are created. Charted Roots identifies notes by their properties (cr_type), not their location—your notes can live anywhere in your vault.');

		// --- Entity folders subsection ---
		foldersContent.createEl('h4', { text: 'Entity folders', cls: 'cr-subsection-title' });

		this.createFolderSetting(foldersContent, 'People folder', 'Default folder for person notes', 'Charted Roots/People',
			() => this.plugin.settings.peopleFolder, (v) => { this.plugin.settings.peopleFolder = v; });

		this.createFolderSetting(foldersContent, 'Places folder', 'Default folder for place notes', 'Charted Roots/Places',
			() => this.plugin.settings.placesFolder, (v) => { this.plugin.settings.placesFolder = v; });

		this.createFolderSetting(foldersContent, 'Events folder', 'Default folder for event notes', 'Charted Roots/Events',
			() => this.plugin.settings.eventsFolder, (v) => { this.plugin.settings.eventsFolder = v; });

		this.createFolderSetting(foldersContent, 'Sources folder', 'Default folder for source notes', 'Charted Roots/Sources',
			() => this.plugin.settings.sourcesFolder, (v) => { this.plugin.settings.sourcesFolder = v; });

		this.createFolderSetting(foldersContent, 'Organizations folder', 'Default folder for organization notes', 'Charted Roots/Organizations',
			() => this.plugin.settings.organizationsFolder, (v) => { this.plugin.settings.organizationsFolder = v; });

		this.createFolderSetting(foldersContent, 'Universes folder', 'Default folder for universe notes (fictional worlds)', 'Charted Roots/Universes',
			() => this.plugin.settings.universesFolder, (v) => { this.plugin.settings.universesFolder = v; });

		// --- Output folders subsection ---
		foldersContent.createEl('h4', { text: 'Output folders', cls: 'cr-subsection-title' });

		this.createFolderSetting(foldersContent, 'Canvases folder', 'Default folder for generated canvas files', 'Charted Roots/Canvases',
			() => this.plugin.settings.canvasesFolder, (v) => { this.plugin.settings.canvasesFolder = v; });

		this.createFolderSetting(foldersContent, 'Maps folder', 'Default folder for map notes', 'Charted Roots/Places/Maps',
			() => this.plugin.settings.mapsFolder, (v) => { this.plugin.settings.mapsFolder = v; });

		this.createFolderSetting(foldersContent, 'Timelines folder', 'Default folder for timeline notes', 'Charted Roots/Timelines',
			() => this.plugin.settings.timelinesFolder, (v) => { this.plugin.settings.timelinesFolder = v; });

		this.createFolderSetting(foldersContent, 'Reports folder', 'Default folder for generated reports', 'Charted Roots/Reports',
			() => this.plugin.settings.reportsFolder, (v) => { this.plugin.settings.reportsFolder = v; });

		this.createFolderSetting(foldersContent, 'Bases folder', 'Default folder for Obsidian Bases files', 'Charted Roots/Bases',
			() => this.plugin.settings.basesFolder, (v) => { this.plugin.settings.basesFolder = v; });

		// --- Media folder filtering subsection ---
		foldersContent.createEl('h4', { text: 'Media folder filtering', cls: 'cr-subsection-title' });

		foldersContent.createEl('p', {
			cls: 'setting-item-description',
			text: 'Limit media discovery to specific folders. This affects Find Unlinked, Media Manager stats, and the media picker—but not already-linked media or the Browse Gallery.'
		});

		new Setting(foldersContent)
			.setName('Limit media scanning to specified folders')
			.setDesc('When enabled, only scan the folders listed below for media files')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableMediaFolderFilter)
				.onChange(async (value) => {
					this.plugin.settings.enableMediaFolderFilter = value;
					await this.plugin.saveSettings();
				}));

		// Media folders list with drag-and-drop
		const mediaFoldersContainer = foldersContent.createDiv({ cls: 'cr-media-folders-list' });
		this.renderMediaFoldersList(mediaFoldersContainer);

		// Note about advanced settings
		const advancedNote = foldersContent.createDiv({ cls: 'cr-info-box cr-info-box--muted' });
		const advancedIcon = advancedNote.createSpan({ cls: 'cr-info-box-icon' });
		setIcon(advancedIcon, 'settings');
		advancedNote.createSpan({
			text: 'For folder filtering options (include/exclude folders from discovery), see Advanced below.'
		});

		// --- System folders subsection ---
		foldersContent.createEl('h4', { text: 'System folders', cls: 'cr-subsection-title' });

		this.createFolderSetting(foldersContent, 'Schemas folder', 'Default folder for validation schemas', 'Charted Roots/Schemas',
			() => this.plugin.settings.schemasFolder, (v) => { this.plugin.settings.schemasFolder = v; });

		this.createFolderSetting(foldersContent, 'Staging folder', 'Folder for import staging (isolated from main vault)', 'Charted Roots/Staging',
			() => this.plugin.settings.stagingFolder, (v) => { this.plugin.settings.stagingFolder = v; });

		this.createFolderSetting(foldersContent, 'Log export folder', 'Vault folder for exported log files', '.charted-roots/logs',
			() => this.plugin.settings.logExportPath, (v) => { this.plugin.settings.logExportPath = v; });

		// ═══════════════════════════════════════════════════════════════════════
		// SECTION 2: DATA & DETECTION
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
		// SECTION 3: CANVAS & TREES
		// ═══════════════════════════════════════════════════════════════════════
		const canvasDetails = containerEl.createEl('details', { cls: 'cr-settings-section' });
		const canvasSummary = canvasDetails.createEl('summary');
		canvasSummary.createSpan({ text: 'Canvas & trees' });
		canvasSummary.createSpan({ cls: 'cr-section-desc', text: 'Tree generation layout and styling' });
		const canvasContent = canvasDetails.createDiv({ cls: 'cr-section-content' });

		// Info text
		const canvasInfo = canvasContent.createDiv({ cls: 'setting-item-description cr-info-box' });
		canvasInfo.appendText('Changes apply to new tree generations. To update existing canvases, right-click the canvas file and select "Re-layout family tree".');

		// --- Node dimensions subsection ---
		canvasContent.createEl('h4', { text: 'Node dimensions', cls: 'cr-subsection-title' });

		new Setting(canvasContent)
			.setName('Node width')
			.setDesc('Width of person nodes in pixels')
			.addSlider(slider => slider
				.setLimits(100, 500, 25)
				.setValue(this.plugin.settings.defaultNodeWidth)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.defaultNodeWidth = value;
					await this.plugin.saveSettings();
				}));

		new Setting(canvasContent)
			.setName('Node height')
			.setDesc('Height of person nodes in pixels')
			.addSlider(slider => slider
				.setLimits(50, 300, 25)
				.setValue(this.plugin.settings.defaultNodeHeight)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.defaultNodeHeight = value;
					await this.plugin.saveSettings();
				}));

		// --- Spacing subsection ---
		canvasContent.createEl('h4', { text: 'Spacing', cls: 'cr-subsection-title' });

		new Setting(canvasContent)
			.setName('Horizontal spacing')
			.setDesc('Space between nodes horizontally')
			.addSlider(slider => slider
				.setLimits(100, 1000, 50)
				.setValue(this.plugin.settings.horizontalSpacing)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.horizontalSpacing = value;
					await this.plugin.saveSettings();
				}));

		new Setting(canvasContent)
			.setName('Vertical spacing')
			.setDesc('Space between generations vertically')
			.addSlider(slider => slider
				.setLimits(100, 1000, 50)
				.setValue(this.plugin.settings.verticalSpacing)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.verticalSpacing = value;
					await this.plugin.saveSettings();
				}));

		// --- Colors & styling subsection ---
		canvasContent.createEl('h4', { text: 'Colors & styling', cls: 'cr-subsection-title' });

		new Setting(canvasContent)
			.setName('Color scheme')
			.setDesc('How to color person nodes in family trees')
			.addDropdown(dropdown => dropdown
				.addOption('sex', 'Sex - green for males, purple for females')
				.addOption('generation', 'Generation - color by generation level')
				.addOption('collection', 'Collection - different color per collection')
				.addOption('monochrome', 'Monochrome - no coloring')
				.setValue(this.plugin.settings.nodeColorScheme)
				.onChange(async (value) => {
					this.plugin.settings.nodeColorScheme = value as ColorScheme;
					await this.plugin.saveSettings();
				}));

		new Setting(canvasContent)
			.setName('Canvas grouping')
			.setDesc('Visual groups to organize related nodes on the canvas')
			.addDropdown(dropdown => dropdown
				.addOption('none', 'None - no grouping')
				.addOption('generation', 'By generation')
				.addOption('nuclear-family', 'By couples')
				.addOption('collection', 'By collection')
				.setValue(this.plugin.settings.canvasGroupingStrategy)
				.onChange(async (value) => {
					this.plugin.settings.canvasGroupingStrategy = value as CanvasGroupingStrategy;
					await this.plugin.saveSettings();
				}));

		// --- Arrow styles subsection ---
		canvasContent.createEl('h4', { text: 'Arrow styles', cls: 'cr-subsection-title' });

		new Setting(canvasContent)
			.setName('Parent → child arrows')
			.setDesc('Arrow style for parent-child relationships')
			.addDropdown(dropdown => dropdown
				.addOption('directed', 'Directed (→)')
				.addOption('bidirectional', 'Bidirectional (↔)')
				.addOption('undirected', 'Undirected (—)')
				.setValue(this.plugin.settings.parentChildArrowStyle)
				.onChange(async (value) => {
					this.plugin.settings.parentChildArrowStyle = value as ArrowStyle;
					await this.plugin.saveSettings();
				}));

		new Setting(canvasContent)
			.setName('Spouse arrows')
			.setDesc('Arrow style for spouse relationships')
			.addDropdown(dropdown => dropdown
				.addOption('directed', 'Directed (→)')
				.addOption('bidirectional', 'Bidirectional (↔)')
				.addOption('undirected', 'Undirected (—)')
				.setValue(this.plugin.settings.spouseArrowStyle)
				.onChange(async (value) => {
					this.plugin.settings.spouseArrowStyle = value as ArrowStyle;
					await this.plugin.saveSettings();
				}));

		// --- Spouse edges subsection ---
		canvasContent.createEl('h4', { text: 'Spouse edges', cls: 'cr-subsection-title' });

		new Setting(canvasContent)
			.setName('Show spouse edges')
			.setDesc('Display edges between spouses with marriage metadata')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showSpouseEdges)
				.onChange(async (value) => {
					this.plugin.settings.showSpouseEdges = value;
					await this.plugin.saveSettings();
				}));

		new Setting(canvasContent)
			.setName('Spouse edge label format')
			.setDesc('How to display marriage information on spouse edges')
			.addDropdown(dropdown => dropdown
				.addOption('none', 'None')
				.addOption('date-only', 'Date only')
				.addOption('date-location', 'Date and location')
				.addOption('full', 'Full details')
				.setValue(this.plugin.settings.spouseEdgeLabelFormat)
				.onChange(async (value) => {
					this.plugin.settings.spouseEdgeLabelFormat = value as SpouseEdgeLabelFormat;
					await this.plugin.saveSettings();
				}));

		// ═══════════════════════════════════════════════════════════════════════
		// SECTION 5: DATES & VALIDATION
		// ═══════════════════════════════════════════════════════════════════════
		const datesDetails = containerEl.createEl('details', { cls: 'cr-settings-section' });
		const datesSummary = datesDetails.createEl('summary');
		datesSummary.createSpan({ text: 'Dates & validation' });
		datesSummary.createSpan({ cls: 'cr-section-desc', text: 'Date format and validation rules' });
		const datesContent = datesDetails.createDiv({ cls: 'cr-section-content' });

		new Setting(datesContent)
			.setName('Date format standard')
			.setDesc('Preferred date format standard for validation')
			.addDropdown(dropdown => dropdown
				.addOption('iso8601', 'ISO 8601 - strict YYYY-MM-DD')
				.addOption('gedcom', 'GEDCOM - DD MMM YYYY')
				.addOption('flexible', 'Flexible - multiple formats')
				.setValue(this.plugin.settings.dateFormatStandard)
				.onChange(async (value) => {
					this.plugin.settings.dateFormatStandard = value as 'iso8601' | 'gedcom' | 'flexible';
					await this.plugin.saveSettings();
				}));

		new Setting(datesContent)
			.setName('Allow partial dates')
			.setDesc('Accept dates with missing day or month (e.g., "1920-05" or "1920")')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.allowPartialDates)
				.onChange(async (value) => {
					this.plugin.settings.allowPartialDates = value;
					await this.plugin.saveSettings();
				}));

		new Setting(datesContent)
			.setName('Allow circa dates')
			.setDesc('Accept approximate dates with "c.", "ca.", "circa", or "~" prefix')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.allowCircaDates)
				.onChange(async (value) => {
					this.plugin.settings.allowCircaDates = value;
					await this.plugin.saveSettings();
				}));

		new Setting(datesContent)
			.setName('Allow date ranges')
			.setDesc('Accept date ranges with hyphen or "to" (e.g., "1850-1920")')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.allowDateRanges)
				.onChange(async (value) => {
					this.plugin.settings.allowDateRanges = value;
					await this.plugin.saveSettings();
				}));

		new Setting(datesContent)
			.setName('Require leading zeros')
			.setDesc('Require zero-padded months and days (e.g., "1920-05-01")')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.requireLeadingZeros)
				.onChange(async (value) => {
					this.plugin.settings.requireLeadingZeros = value;
					await this.plugin.saveSettings();
				}));

		// ═══════════════════════════════════════════════════════════════════════
		// SECTION 6: SEX & GENDER
		// ═══════════════════════════════════════════════════════════════════════
		const sexDetails = containerEl.createEl('details', { cls: 'cr-settings-section' });
		const sexSummary = sexDetails.createEl('summary');
		sexSummary.createSpan({ text: 'Sex & gender' });
		sexSummary.createSpan({ cls: 'cr-section-desc', text: 'Sex normalization and inclusive options' });
		const sexContent = sexDetails.createDiv({ cls: 'cr-section-content' });

		new Setting(sexContent)
			.setName('Sex normalization mode')
			.setDesc('How sex values are normalized in batch operations')
			.addDropdown(dropdown => dropdown
				.addOption('standard', 'Standard - normalize to GEDCOM M/F')
				.addOption('schema-aware', 'Schema-aware - skip notes with custom schemas')
				.addOption('disabled', 'Disabled - never normalize')
				.setValue(this.plugin.settings.sexNormalizationMode)
				.onChange(async (value) => {
					this.plugin.settings.sexNormalizationMode = value as SexNormalizationMode;
					await this.plugin.saveSettings();
				}));

		new Setting(sexContent)
			.setName('Enable gender-neutral parent property')
			.setDesc('Show a "Parents" property in person modals for inclusive terminology')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableInclusiveParents)
				.onChange(async (value) => {
					this.plugin.settings.enableInclusiveParents = value;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide label setting
				}));

		if (this.plugin.settings.enableInclusiveParents) {
			new Setting(sexContent)
				.setName('Parent property label')
				.setDesc('Customize the UI label for the gender-neutral parent property')
				.addText(text => text
					.setPlaceholder('Parents')
					.setValue(this.plugin.settings.parentFieldLabel)
					.onChange(async (value) => {
						this.plugin.settings.parentFieldLabel = value || 'Parents';
						await this.plugin.saveSettings();
					}));
		}

		new Setting(sexContent)
			.setName('Show pronouns')
			.setDesc('Display pronouns in person pickers and cards')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showPronouns)
				.onChange(async (value) => {
					this.plugin.settings.showPronouns = value;
					await this.plugin.saveSettings();
				}));

		new Setting(sexContent)
			.setName('Romantic relationship label')
			.setDesc('Choose terminology for spouse/partner relationships in the UI')
			.addDropdown(dropdown => dropdown
				.addOption('spouse', 'Spouse')
				.addOption('partner', 'Partner')
				.setValue(this.plugin.settings.romanticRelationshipLabel)
				.onChange(async (value: 'spouse' | 'partner') => {
					this.plugin.settings.romanticRelationshipLabel = value;
					await this.plugin.saveSettings();
				}));

		// ═══════════════════════════════════════════════════════════════════════
		// SECTION 7: PLACES
		// ═══════════════════════════════════════════════════════════════════════
		const placesDetails = containerEl.createEl('details', { cls: 'cr-settings-section' });
		const placesSummary = placesDetails.createEl('summary');
		placesSummary.createSpan({ text: 'Places' });
		placesSummary.createSpan({ cls: 'cr-section-desc', text: 'Place organization and coordinate handling' });
		const placesContent = placesDetails.createDiv({ cls: 'cr-section-content' });

		new Setting(placesContent)
			.setName('Use category-based subfolders')
			.setDesc('Automatically organize new places into subfolders based on their category')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useCategorySubfolders)
				.onChange(async (value) => {
					this.plugin.settings.useCategorySubfolders = value;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide overrides section
				}));

		// Show category folder overrides section if enabled
		if (this.plugin.settings.useCategorySubfolders) {
			placesContent.createEl('h4', { text: 'Category folder overrides', cls: 'cr-subsection-title' });

			placesContent.createEl('p', {
				cls: 'setting-item-description',
				text: 'Override the default subfolder name for specific categories. Leave empty to use the capitalized category name (e.g., "Historical").'
			});

			const rulesContainer = placesContent.createDiv({ cls: 'cr-category-folder-rules' });
			this.renderCategoryFolderRules(rulesContainer);
		}

		new Setting(placesContent)
			.setName('Default place category')
			.setDesc('Category assigned to new places when not specified')
			.addDropdown(dropdown => dropdown
				.addOption('real', 'Real')
				.addOption('historical', 'Historical')
				.addOption('disputed', 'Disputed')
				.addOption('legendary', 'Legendary')
				.addOption('mythological', 'Mythological')
				.addOption('fictional', 'Fictional')
				.setValue(this.plugin.settings.defaultPlaceCategory)
				.onChange(async (value) => {
					this.plugin.settings.defaultPlaceCategory = value as PlaceCategory;
					await this.plugin.saveSettings();
				}));

		new Setting(placesContent)
			.setName('Accept DMS coordinate format')
			.setDesc('Allow entering coordinates in degrees, minutes, seconds format')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableDMSCoordinates)
				.onChange(async (value) => {
					this.plugin.settings.enableDMSCoordinates = value;
					await this.plugin.saveSettings();
				}));

		// Info note about imports
		const importNote = placesContent.createDiv({ cls: 'cr-info-box cr-info-box--muted' });
		const importIcon = importNote.createSpan({ cls: 'cr-info-box-icon' });
		setIcon(importIcon, 'info');
		importNote.createSpan({
			text: 'Imports (GEDCOM, Gramps) always create places in the base folder. Use Data Quality → "Places not in category folders" to organize them afterward.'
		});

		// ═══════════════════════════════════════════════════════════════════════
		// SECTION 8: PROPERTY & VALUE ALIASES
		// ═══════════════════════════════════════════════════════════════════════
		const aliasesDetails = containerEl.createEl('details', { cls: 'cr-settings-section' });
		const aliasesSummary = aliasesDetails.createEl('summary');
		aliasesSummary.createSpan({ text: 'Property & value aliases' });
		aliasesSummary.createSpan({ cls: 'cr-section-desc', text: 'Custom frontmatter names and value mappings' });
		const aliasesContent = aliasesDetails.createDiv({ cls: 'cr-section-content' });

		// Services for alias management
		const propertyAliasService = new PropertyAliasService(this.plugin);
		const valueAliasService = new ValueAliasService(this.plugin);

		// Description
		const aliasExplanation = aliasesContent.createDiv({ cls: 'setting-item-description cr-info-box' });
		aliasExplanation.appendText('Use your own property names and values—Charted Roots will recognize them without rewriting your files.');

		// --- Property aliases subsection ---
		aliasesContent.createEl('h4', { text: 'Property aliases', cls: 'cr-subsection-title' });

		// Person properties
		this.renderPropertyAliasSection(aliasesContent, 'Person properties', PERSON_PROPERTY_METADATA, propertyAliasService);

		// Event properties
		this.renderPropertyAliasSection(aliasesContent, 'Event properties', EVENT_PROPERTY_METADATA, propertyAliasService);

		// Place properties
		this.renderPropertyAliasSection(aliasesContent, 'Place properties', PLACE_PROPERTY_METADATA, propertyAliasService);

		// Source properties
		this.renderPropertyAliasSection(aliasesContent, 'Source properties', SOURCE_PROPERTY_METADATA, propertyAliasService);

		// --- Value aliases subsection ---
		aliasesContent.createEl('h4', { text: 'Value aliases', cls: 'cr-subsection-title' });

		const valueAliasExplanation = aliasesContent.createDiv({ cls: 'setting-item-description cr-info-box cr-info-box--muted' });
		valueAliasExplanation.appendText('Map your custom values to Charted Roots canonical values. For example, map "nameday" to "birth" event type.');

		// Event type values
		this.renderValueAliasSection(aliasesContent, 'Event type values', 'eventType', CANONICAL_EVENT_TYPES, EVENT_TYPE_LABELS, valueAliasService);

		// Sex values
		this.renderValueAliasSection(aliasesContent, 'Sex values', 'sex', CANONICAL_SEX_VALUES, SEX_LABELS, valueAliasService);

		// Place category values
		this.renderValueAliasSection(aliasesContent, 'Place category values', 'placeCategory', CANONICAL_PLACE_CATEGORIES, PLACE_CATEGORY_LABELS, valueAliasService);

		// Note type values
		this.renderValueAliasSection(aliasesContent, 'Note type values', 'noteType', CANONICAL_NOTE_TYPES, NOTE_TYPE_LABELS, valueAliasService);

		// ═══════════════════════════════════════════════════════════════════════
		// SECTION 9: ADVANCED
		// ═══════════════════════════════════════════════════════════════════════
		const advancedDetails = containerEl.createEl('details', { cls: 'cr-settings-section' });
		const advancedSummary = advancedDetails.createEl('summary');
		advancedSummary.createSpan({ text: 'Advanced' });
		advancedSummary.createSpan({ cls: 'cr-section-desc', text: 'Less frequently used settings' });
		const advancedContent = advancedDetails.createDiv({ cls: 'cr-section-content' });

		// --- Folder filtering subsection ---
		advancedContent.createEl('h4', { text: 'Folder filtering', cls: 'cr-subsection-title' });

		new Setting(advancedContent)
			.setName('Filter mode')
			.setDesc('Control which folders are scanned for notes')
			.addDropdown(dropdown => dropdown
				.addOption('disabled', 'Disabled (scan all)')
				.addOption('exclude', 'Exclude folders')
				.addOption('include', 'Include folders only')
				.setValue(this.plugin.settings.folderFilterMode)
				.onChange(async (value: FolderFilterMode) => {
					this.plugin.settings.folderFilterMode = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.folderFilterMode !== 'disabled') {
			const isExcludeMode = this.plugin.settings.folderFilterMode === 'exclude';
			const filterFolders = isExcludeMode
				? this.plugin.settings.excludedFolders
				: this.plugin.settings.includedFolders;

			new Setting(advancedContent)
				.setName(isExcludeMode ? 'Excluded folders' : 'Included folders')
				.setDesc('One folder path per line')
				.addTextArea(textArea => textArea
					.setPlaceholder(isExcludeMode ? 'templates\narchive' : 'People\nFamily')
					.setValue(filterFolders.join('\n'))
					.onChange(async (value) => {
						const folderList = value.split('\n').map(f => f.trim()).filter(f => f.length > 0);
						if (isExcludeMode) {
							this.plugin.settings.excludedFolders = folderList;
						} else {
							this.plugin.settings.includedFolders = folderList;
						}
						await this.plugin.saveSettings();
					}));
		}

		new Setting(advancedContent)
			.setName('Staging isolation')
			.setDesc('Exclude staging folder from normal operations')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableStagingIsolation)
				.onChange(async (value) => {
					this.plugin.settings.enableStagingIsolation = value;
					await this.plugin.saveSettings();
				}));

		// --- Template detection subsection ---
		advancedContent.createEl('h4', { text: 'Template detection', cls: 'cr-subsection-title' });

		new Setting(advancedContent)
			.setName('Auto-detect template folders')
			.setDesc('Automatically exclude template folders from Templates/Templater/QuickAdd plugins')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoDetectTemplateFolders)
				.onChange(async (value) => {
					this.plugin.settings.autoDetectTemplateFolders = value;
					await this.plugin.saveSettings();
					const templateFilter = this.plugin.getTemplateFilter();
					if (templateFilter) {
						templateFilter.refresh();
					}
				}));

		new Setting(advancedContent)
			.setName('Additional template folders')
			.setDesc('Additional folders to exclude from note discovery (one per line)')
			.addTextArea(textArea => textArea
				.setPlaceholder('_templates\nmy-templates')
				.setValue((this.plugin.settings.templateFolders || []).join('\n'))
				.onChange(async (value) => {
					const folderList = value.split('\n').map(f => f.trim()).filter(f => f.length > 0);
					this.plugin.settings.templateFolders = folderList;
					await this.plugin.saveSettings();
				}));

		// --- Research tools subsection ---
		advancedContent.createEl('h4', { text: 'Research tools', cls: 'cr-subsection-title' });

		new Setting(advancedContent)
			.setName('Enable fact-level source tracking')
			.setDesc('Track which specific facts have source citations')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackFactSourcing)
				.onChange(async (value) => {
					this.plugin.settings.trackFactSourcing = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.trackFactSourcing) {
			new Setting(advancedContent)
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

			new Setting(advancedContent)
				.setName('Show research gaps in status tab')
				.setDesc('Display summary of unsourced facts in control center')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.showResearchGapsInStatus)
					.onChange(async (value) => {
						this.plugin.settings.showResearchGapsInStatus = value;
						await this.plugin.saveSettings();
					}));
		}

		// --- Integrations subsection ---
		advancedContent.createEl('h4', { text: 'Integrations', cls: 'cr-subsection-title' });

		new Setting(advancedContent)
			.setName('Calendarium integration')
			.setDesc('Import calendar definitions from Calendarium plugin')
			.addDropdown(dropdown => dropdown
				.addOption('off', 'Off')
				.addOption('read', 'Read calendars')
				.setValue(this.plugin.settings.calendariumIntegration)
				.onChange(async (value) => {
					this.plugin.settings.calendariumIntegration = value as 'off' | 'read';
					await this.plugin.saveSettings();
				}));

		new Setting(advancedContent)
			.setName('Sync Calendarium events')
			.setDesc('Show Calendarium dates (fc-date, fc-end) on timelines')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.syncCalendariumEvents)
				.onChange(async (value) => {
					this.plugin.settings.syncCalendariumEvents = value;
					await this.plugin.saveSettings();
				}));

		// --- Logging subsection ---
		advancedContent.createEl('h4', { text: 'Logging', cls: 'cr-subsection-title' });

		new Setting(advancedContent)
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
					const { LoggerFactory } = await import('./core/logging');
					LoggerFactory.setLogLevel(value);
				}));

		new Setting(advancedContent)
			.setName('Obfuscate log exports')
			.setDesc('Replace PII with placeholders when exporting logs')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.obfuscateLogExports)
				.onChange(async (value) => {
					this.plugin.settings.obfuscateLogExports = value;
					await this.plugin.saveSettings();
				}));

		new Setting(advancedContent)
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

					const logsToExport = this.plugin.settings.obfuscateLogExports
						? obfuscateLogs(logs)
						: logs;

					const lines = logsToExport.map(entry => {
						const timestamp = entry.timestamp.toISOString();
						const level = entry.level.toUpperCase().padEnd(5);
						const dataStr = entry.data ? ` | ${JSON.stringify(entry.data)}` : '';
						return `[${timestamp}] ${level} [${entry.component}/${entry.category}] ${entry.message}${dataStr}`;
					});
					const content = lines.join('\n');

					const folder = this.plugin.settings.logExportPath || '.charted-roots/logs';
					const filename = `charted-roots-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
					const fullPath = normalizePath(`${folder}/${filename}`);

					const folderPath = normalizePath(folder);
					const existingFolder = this.app.vault.getAbstractFileByPath(folderPath);
					if (!existingFolder) {
						await this.app.vault.createFolder(folderPath);
					}

					await this.app.vault.create(fullPath, content);
					new Notice(`Exported ${logs.length} log entries to ${fullPath}`);
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

	/**
	 * Helper to create a folder setting with autocomplete
	 */
	private createFolderSetting(
		container: HTMLElement,
		name: string,
		desc: string,
		placeholder: string,
		getValue: () => string,
		setValue: (v: string) => void
	): void {
		new Setting(container)
			.setName(name)
			.setDesc(desc)
			.addText(text => {
				text
					.setPlaceholder(placeholder)
					.setValue(getValue())
					.onChange(async (value) => {
						setValue(value);
						await this.plugin.saveSettings();
					});

				// Attach folder autocomplete
				new FolderSuggest(this.app, text, (value) => {
					void (async () => {
						setValue(value);
						await this.plugin.saveSettings();
					})();
				});
			});
	}

	/**
	 * Render a collapsible property alias section
	 */
	private renderPropertyAliasSection(
		container: HTMLElement,
		title: string,
		properties: readonly PropertyMetadata[],
		propertyAliasService: PropertyAliasService
	): void {
		// Count configured aliases
		const configuredCount = properties.filter(meta =>
			propertyAliasService.getAlias(meta.canonical)
		).length;

		// Create collapsible section
		const section = container.createEl('details', { cls: 'cr-property-section' });
		const summary = section.createEl('summary', { cls: 'cr-property-section-summary' });
		summary.createSpan({ text: title, cls: 'cr-property-section-title' });
		summary.createSpan({
			text: configuredCount > 0 ? `${configuredCount} configured` : `${properties.length} properties`,
			cls: 'cr-property-section-count'
		});

		const sectionContent = section.createDiv({ cls: 'cr-property-section-content' });

		// Lazy render on first open
		let rendered = false;
		section.addEventListener('toggle', () => {
			if (section.open && !rendered) {
				rendered = true;
				properties.forEach(meta => {
					const currentAlias = propertyAliasService.getAlias(meta.canonical) || '';

					new Setting(sectionContent)
						.setName(meta.label)
						.setDesc(meta.description)
						.addText(text => {
							text.setPlaceholder(meta.canonical).setValue(currentAlias);
							text.inputEl.addEventListener('blur', () => {
								void (async () => {
									const value = text.inputEl.value.trim();
									if (value === '') {
										if (currentAlias) {
											await propertyAliasService.removeAlias(currentAlias);
											this.display();
										}
									} else if (value !== meta.canonical && value !== currentAlias) {
										const existingMapping = propertyAliasService.aliases[value];
										if (existingMapping && existingMapping !== meta.canonical) {
											new Notice(`"${value}" is already mapped to "${existingMapping}"`);
											text.inputEl.value = currentAlias;
										} else {
											await propertyAliasService.setAlias(value, meta.canonical);
											this.display();
										}
									}
								})();
							});
						})
						.addExtraButton(button => {
							button.setIcon('x').setTooltip('Clear alias').onClick(async () => {
								if (currentAlias) {
									await propertyAliasService.removeAlias(currentAlias);
									this.display();
								}
							});
							button.extraSettingsEl.addClass(currentAlias ? 'cr-clear-btn--enabled' : 'cr-clear-btn--disabled');
						});
				});
			}
		});
	}

	/**
	 * Render a collapsible value alias section
	 */
	private renderValueAliasSection(
		container: HTMLElement,
		title: string,
		field: ValueAliasField,
		canonicalValues: readonly string[],
		valueLabels: Record<string, string>,
		valueAliasService: ValueAliasService
	): void {
		const aliases = valueAliasService.getAliases(field);
		const aliasCount = Object.keys(aliases).length;

		// Create collapsible section
		const section = container.createEl('details', { cls: 'cr-property-section' });
		const summary = section.createEl('summary', { cls: 'cr-property-section-summary' });
		summary.createSpan({ text: title, cls: 'cr-property-section-title' });
		summary.createSpan({
			text: `${aliasCount} ${aliasCount === 1 ? 'alias' : 'aliases'}`,
			cls: 'cr-property-section-count'
		});

		const sectionContent = section.createDiv({ cls: 'cr-property-section-content' });

		// Lazy render on first open
		let rendered = false;
		section.addEventListener('toggle', () => {
			if (section.open && !rendered) {
				rendered = true;
				canonicalValues.forEach(canonicalValue => {
					// Find existing alias for this canonical value
					const userValue = Object.entries(aliases).find(
						([_, canonical]) => canonical === canonicalValue
					)?.[0] || '';

					const valueLabel = valueLabels[canonicalValue] || canonicalValue;

					new Setting(sectionContent)
						.setName(valueLabel)
						.setDesc(canonicalValue)
						.addText(text => {
							text.setPlaceholder('your value').setValue(userValue);
							text.inputEl.addEventListener('blur', () => {
								void (async () => {
									const value = text.inputEl.value.trim();
									if (value === '') {
										if (userValue) {
											await valueAliasService.removeAlias(field, userValue);
											this.display();
										}
									} else if (value.toLowerCase() !== canonicalValue.toLowerCase() && value !== userValue) {
										const existingMapping = aliases[value.toLowerCase()];
										if (existingMapping && existingMapping !== canonicalValue) {
											new Notice(`"${value}" is already mapped to "${existingMapping}"`);
											text.inputEl.value = userValue;
										} else {
											if (userValue) {
												await valueAliasService.removeAlias(field, userValue);
											}
											await valueAliasService.setAlias(field, value, canonicalValue);
											this.display();
										}
									}
								})();
							});
						})
						.addExtraButton(button => {
							button.setIcon('x').setTooltip('Clear alias').onClick(async () => {
								if (userValue) {
									await valueAliasService.removeAlias(field, userValue);
									this.display();
								}
							});
							button.extraSettingsEl.addClass(userValue ? 'cr-clear-btn--enabled' : 'cr-clear-btn--disabled');
						});
				});
			}
		});
	}

	/**
	 * Render the media folders list with add/remove and drag-drop functionality
	 */
	private renderMediaFoldersList(container: HTMLElement): void {
		container.empty();

		const folders = this.plugin.settings.mediaFolders;

		// State for drag and drop
		let draggedIndex = -1;

		// Render existing folders
		for (let i = 0; i < folders.length; i++) {
			const folder = folders[i];
			const row = container.createDiv({ cls: 'cr-media-folder-row' });

			// Make row draggable
			row.setAttribute('draggable', 'true');

			// Drag handle
			const dragHandle = row.createSpan({ cls: 'cr-media-folder-handle' });
			setIcon(dragHandle, 'grip-vertical');

			// Folder icon
			const iconEl = row.createSpan({ cls: 'cr-media-folder-icon' });
			setIcon(iconEl, 'folder');

			// Folder path text
			row.createSpan({ cls: 'cr-media-folder-path', text: folder });

			// Remove button
			const removeBtn = row.createSpan({ cls: 'cr-media-folder-remove' });
			setIcon(removeBtn, 'x');
			removeBtn.setAttribute('aria-label', 'Remove folder');

			removeBtn.addEventListener('click', () => {
				this.plugin.settings.mediaFolders = folders.filter((_, idx) => idx !== i);
				void this.plugin.saveSettings().then(() => {
					this.renderMediaFoldersList(container);
				});
			});

			// Drag and drop event handlers
			row.addEventListener('dragstart', (e: DragEvent) => {
				draggedIndex = i;
				row.addClass('cr-media-folder-row--dragging');
				if (e.dataTransfer) {
					e.dataTransfer.effectAllowed = 'move';
					e.dataTransfer.setData('text/plain', i.toString());
				}
			});

			row.addEventListener('dragend', () => {
				row.removeClass('cr-media-folder-row--dragging');
				// Remove drag-over indicators from all rows
				container.querySelectorAll('.cr-media-folder-row').forEach(r => {
					r.removeClass('cr-media-folder-row--drag-over');
				});
			});

			row.addEventListener('dragover', (e: DragEvent) => {
				e.preventDefault();
				if (e.dataTransfer) {
					e.dataTransfer.dropEffect = 'move';
				}
			});

			row.addEventListener('dragenter', (e: DragEvent) => {
				e.preventDefault();
				if (i !== draggedIndex) {
					row.addClass('cr-media-folder-row--drag-over');
				}
			});

			row.addEventListener('dragleave', (e: DragEvent) => {
				// Only remove class if we're actually leaving the row
				const relatedTarget = e.relatedTarget as HTMLElement;
				if (!row.contains(relatedTarget)) {
					row.removeClass('cr-media-folder-row--drag-over');
				}
			});

			row.addEventListener('drop', (e: DragEvent) => {
				e.preventDefault();

				if (draggedIndex === -1 || draggedIndex === i) {
					return;
				}

				// Reorder the folders array
				const newFolders = [...folders];
				const [movedFolder] = newFolders.splice(draggedIndex, 1);
				newFolders.splice(i, 0, movedFolder);

				this.plugin.settings.mediaFolders = newFolders;
				void this.plugin.saveSettings().then(() => {
					this.renderMediaFoldersList(container);
				});
			});
		}

		// Add folder row
		const addRow = container.createDiv({ cls: 'cr-media-folder-add-row' });

		// Create a wrapper for the text input with folder suggest
		const inputWrapper = addRow.createDiv({ cls: 'cr-media-folder-input-wrapper' });

		const addSetting = new Setting(inputWrapper)
			.addText(text => {
				text.setPlaceholder('Add media folder...');

				// Attach folder autocomplete
				new FolderSuggest(this.app, text, (value) => {
					if (value.trim() && !folders.includes(value.trim())) {
						this.plugin.settings.mediaFolders = [...folders, value.trim()];
						void this.plugin.saveSettings().then(() => {
							this.renderMediaFoldersList(container);
						});
					}
				});

				// Also handle Enter key
				text.inputEl.addEventListener('keydown', (e) => {
					if (e.key === 'Enter') {
						const value = text.inputEl.value.trim();
						if (value && !folders.includes(value)) {
							this.plugin.settings.mediaFolders = [...folders, value];
							void this.plugin.saveSettings().then(() => {
								this.renderMediaFoldersList(container);
							});
						}
					}
				});
			});

		// Remove the default styling from the Setting
		addSetting.settingEl.addClass('cr-media-folder-add-setting');
	}

	/**
	 * Render the category folder rules list with add/remove functionality
	 */
	private renderCategoryFolderRules(container: HTMLElement): void {
		container.empty();

		const rules = this.plugin.settings.placeCategoryFolderRules || [];

		// Get categories that already have rules
		const usedCategories = new Set(rules.map(r => r.category));

		// Render existing rules
		for (let i = 0; i < rules.length; i++) {
			const rule = rules[i];
			const ruleRow = container.createDiv({ cls: 'cr-category-folder-rule' });

			// Category label
			const categoryLabel = PLACE_CATEGORY_LABELS[rule.category as keyof typeof PLACE_CATEGORY_LABELS] || rule.category;
			ruleRow.createSpan({ cls: 'cr-category-folder-rule-category', text: categoryLabel });

			// Arrow
			ruleRow.createSpan({ cls: 'cr-category-folder-rule-arrow', text: '→' });

			// Folder path (editable)
			const folderInput = ruleRow.createEl('input', {
				cls: 'cr-category-folder-rule-folder',
				attr: {
					type: 'text',
					value: rule.folder,
					placeholder: categoryLabel
				}
			});

			folderInput.addEventListener('change', () => {
				void (async () => {
					const newFolder = folderInput.value.trim();
					if (newFolder) {
						this.plugin.settings.placeCategoryFolderRules[i].folder = newFolder;
					} else {
						// Remove rule if folder is cleared
						this.plugin.settings.placeCategoryFolderRules.splice(i, 1);
					}
					await this.plugin.saveSettings();
					this.renderCategoryFolderRules(container);
				})();
			});

			// Remove button
			const removeBtn = ruleRow.createSpan({ cls: 'cr-category-folder-rule-remove' });
			setIcon(removeBtn, 'x');
			removeBtn.setAttribute('aria-label', 'Remove override');

			removeBtn.addEventListener('click', () => {
				void (async () => {
					this.plugin.settings.placeCategoryFolderRules.splice(i, 1);
					await this.plugin.saveSettings();
					this.renderCategoryFolderRules(container);
				})();
			});
		}

		// Add new rule row (only show if there are unused categories)
		const availableCategories = CANONICAL_PLACE_CATEGORIES.filter(c => !usedCategories.has(c));

		if (availableCategories.length > 0) {
			const addRow = container.createDiv({ cls: 'cr-category-folder-rule cr-category-folder-rule--add' });

			// Category dropdown
			const categorySelect = addRow.createEl('select', { cls: 'cr-category-folder-rule-select' });
			categorySelect.createEl('option', { value: '', text: 'Add override...' });
			for (const cat of availableCategories) {
				const label = PLACE_CATEGORY_LABELS[cat as keyof typeof PLACE_CATEGORY_LABELS] || cat;
				categorySelect.createEl('option', { value: cat, text: label });
			}

			// Arrow (hidden initially)
			const arrow = addRow.createSpan({ cls: 'cr-category-folder-rule-arrow', text: '→' });
			arrow.style.display = 'none';

			// Folder input (hidden initially)
			const folderInput = addRow.createEl('input', {
				cls: 'cr-category-folder-rule-folder',
				attr: {
					type: 'text',
					placeholder: 'Subfolder path'
				}
			});
			folderInput.style.display = 'none';

			// Show folder input when category is selected
			categorySelect.addEventListener('change', () => {
				const selectedCategory = categorySelect.value as PlaceCategory;
				if (selectedCategory) {
					arrow.style.display = '';
					folderInput.style.display = '';
					// Set placeholder to default folder name
					const label = PLACE_CATEGORY_LABELS[selectedCategory as keyof typeof PLACE_CATEGORY_LABELS] || selectedCategory;
					folderInput.placeholder = label;
					folderInput.focus();
				} else {
					arrow.style.display = 'none';
					folderInput.style.display = 'none';
				}
			});

			// Add rule when folder is entered
			folderInput.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					const selectedCategory = categorySelect.value as PlaceCategory;
					const folder = folderInput.value.trim();
					if (selectedCategory && folder) {
						void (async () => {
							const newRule: PlaceCategoryFolderRule = {
								category: selectedCategory,
								folder: folder
							};
							this.plugin.settings.placeCategoryFolderRules.push(newRule);
							await this.plugin.saveSettings();
							this.renderCategoryFolderRules(container);
						})();
					}
				}
			});

			// Also add on blur if there's a value
			folderInput.addEventListener('blur', () => {
				const selectedCategory = categorySelect.value as PlaceCategory;
				const folder = folderInput.value.trim();
				if (selectedCategory && folder) {
					void (async () => {
						const newRule: PlaceCategoryFolderRule = {
							category: selectedCategory,
							folder: folder
						};
						this.plugin.settings.placeCategoryFolderRules.push(newRule);
						await this.plugin.saveSettings();
						this.renderCategoryFolderRules(container);
					})();
				}
			});
		}
	}
}

/**
 * Inline suggest for folder paths with autocomplete from existing vault folders
 */
class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private textComponent: TextComponent;
	private onSelectValue: (value: string) => void;

	constructor(app: App, textComponent: TextComponent, onSelectValue: (value: string) => void) {
		super(app, textComponent.inputEl);
		this.textComponent = textComponent;
		this.onSelectValue = onSelectValue;
	}

	getSuggestions(inputStr: string): TFolder[] {
		const lowerInput = inputStr.toLowerCase();
		const folders: TFolder[] = [];

		// Get all folders from the vault
		const rootFolder = this.app.vault.getRoot();
		this.collectFolders(rootFolder, folders);

		// Filter by input
		return folders
			.filter(folder => folder.path.toLowerCase().includes(lowerInput))
			.sort((a, b) => a.path.localeCompare(b.path))
			.slice(0, 20); // Limit results
	}

	private collectFolders(folder: TFolder, result: TFolder[]): void {
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				result.push(child);
				this.collectFolders(child, result);
			}
		}
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.addClass('cr-folder-suggestion');
		const iconSpan = el.createSpan({ cls: 'cr-folder-suggestion-icon' });
		setIcon(iconSpan, 'folder');
		el.createSpan({ text: folder.path });
	}

	selectSuggestion(folder: TFolder): void {
		this.textComponent.setValue(folder.path);
		this.onSelectValue(folder.path);
		this.close();
	}
}
