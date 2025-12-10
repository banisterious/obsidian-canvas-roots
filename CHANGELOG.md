# Changelog

All notable changes to Canvas Roots will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Unified Property Configuration UI**: Complete redesign of property and value alias configuration in Preferences tab
  - **Property aliases**: Shows all 55 aliasable properties (27 Person, 20 Event, 8 Place) in collapsible sections
  - **Value aliases**: Shows all 31 canonical values across 4 fields (Event type: 13, Sex: 4, Place category: 6, Note type: 8)
  - Collapsible sections by entity/field type with lazy rendering for performance
  - Search/filter functionality for property aliases across names, descriptions, and common aliases
  - Inline Obsidian Setting components with auto-save on blur
  - Alias count badges on section headers
  - All sections collapsed by default for cleaner initial view
  - Replaced modal-based workflow with native Obsidian UI patterns

### Fixed

- **Alias validation blocking partial input**: Fixed validation triggering on every keystroke, preventing users from typing values that start with existing names (e.g., "sex2")
  - Validation now only occurs when field loses focus (blur event)
  - Invalid input restores previous valid value instead of blocking typing
  - Applies to both property and value aliases

---

## [0.10.18] - 2025-12-09

Property alias support across all note creation and comprehensive bug fixes.

### Added

- **Property alias support for all note creation modals**: All create/edit modals now respect user-configured property aliases
  - Create Person, Create Place, Create Event, Create Source, Create Organization modals
  - Template-based place notes from Generate Place Notes
  - Event note properties (date, event_type, participants, related_places)
  - Parent place linking in place notes

- **Edit Event context menu action**: Right-click event notes in file explorer to edit via modal

- **Fuzzy name matching for duplicate detection**: Merge Duplicates now catches more variations
  - Handles minor spelling differences and character variations

- **Person picker performance improvements**: Faster loading for large vaults

- **FAQ sections**: Added help documentation for common questions

### Fixed

- **Event statistics not recognizing aliased date properties**: Fixed Control Center showing "0% events have dates" for users with property aliases
  - `calculateEventStatistics` now uses `resolveProperty` helper to check both canonical and aliased property names
  - Applies to both `date` and `event_type` property lookups

- **Fictional dates not recognized by Control Panel statistics**: Fixed date detection for non-standard date formats

- **Event type dropdown category headers selectable**: Fixed headers being selectable as values in event type dropdown

- **Family Chart initialization and viewport positioning**: Fixed chart not centering correctly on initial load

- **Crash when place name frontmatter contains wikilinks**: Fixed error when place name property contained `[[wikilink]]` syntax

- **Bulk geocode writing nested coordinates**: Fixed geocoding service writing legacy nested `coordinates:` format
  - Now writes flat `coordinates_lat` / `coordinates_long` properties

- **Referenced places card showing cr_id instead of place names**: Fixed display to show human-readable place names

- **Place statistics showing cr_id instead of place names**: Fixed "Most common birth/death places" to show names

- **Merge duplicates false positives**: Fixed places with common prefixes being incorrectly grouped

### Documentation

- **Unified Property Configuration roadmap entry**: Added medium-priority feature to Future Considerations
  - Single card in Preferences tab showing all property and value aliases
  - Collapsible sections by note type (Person, Place, Event, Source, Organization, Map)

- **Ghost Nodes roadmap entry**: Added medium-priority feature for visualizing unresolved wikilinks

- **Statistics Dashboard roadmap entry**: Added future feature for data visualization

- **Reports & Print Export roadmap**: Expanded from Print & PDF Export to include reports

---

## [0.10.17] - 2025-12-09

Data Enhancement Pass: Improved place generation workflow.

### Added

- **Generate place notes - Progress indicator**: Real-time progress tracking during bulk place note creation
  - Animated progress bar with phase indicator
  - Current place name displayed during generation
  - Cancel button to stop long-running operations

- **Generate place notes - Paginated results table**: Full-featured table replaces simple list after generation
  - Search filter to find specific places by name
  - Sort by place name or status (created/existing)
  - Pagination controls for navigating large result sets

- **Generate place notes - Edit integration**: Each result row has an edit button
  - Opens Edit Place modal for the selected place
  - Allows immediate refinement of generated place notes

---

## [0.10.16] - 2025-12-09

Place management improvements and Calendarium integration planning.

### Added

- **Place name normalization**: Create Missing Places modal now normalizes abbreviated place names
  - Expands US state abbreviations (e.g., "TX" → "Texas")
  - Converts "Co" to "County" (e.g., "Hunt Co" → "Hunt County")
  - Toggle to enable/disable normalization
  - Shows preview of normalized names before creation
  - Original abbreviated name saved as alias for linking

- **Parent hierarchy auto-linking**: New place notes automatically link to existing parent places
  - Parses hierarchical place names (e.g., "Union Valley, Hunt County, Texas, USA")
  - Finds existing parent places by progressively shorter suffixes
  - Sets both `parent_place` wikilink and `parent_place_id` for reliable resolution

- **Flatten nested properties modal**: New batch operation to migrate legacy nested YAML to flat properties
  - Available in Data Quality tab → Batch operations
  - Scans all Canvas Roots notes for nested `coordinates:` and `custom_coordinates:` properties
  - Converts to flat format (e.g., `coordinates_lat`, `coordinates_long`)
  - Shows preview of affected files before applying
  - Progress indicator during migration

### Fixed

- **Bulk geocode modal**: Fixed false "cancelled" message when clicking Done after completion
  - Same fix pattern as Enrich Place Hierarchy modal (v0.10.14)
  - Added `hasCompleted` flag to prevent false cancellation on close

- **Place reference matching**: Fixed GEDCOM-imported places not matching existing place notes
  - Plain text references now matched against existing place names
  - Coordinate lookup now uses multi-strategy approach for hierarchical names

- **Merge Duplicates - Pass 4 false positives**: Fixed places with same parent but different names being grouped as duplicates
  - Previously extracted only first word of name (e.g., "San Mateo" and "San Francisco" both became "san")
  - Now extracts full base name minus state suffixes (e.g., "san mateo" vs "san francisco")
  - Correctly groups "Abbeville" with "Abbeville SC" without matching unrelated places

- **Place statistics showing IDs instead of names**: Fixed "Most common birth/death places" and "Migration patterns" displaying `cr_id` values instead of place names
  - Added `resolvePlaceDisplayName()` helper to convert place IDs to names
  - Statistics now show human-readable place names (e.g., "Texas, USA" instead of "aet-050-abr-564")

- **Referenced places showing IDs instead of names**: Fixed "Referenced places" card displaying `cr_id` values
  - Applied same `resolvePlaceDisplayName()` fix to `getReferencedPlaces()` method

- **Bulk geocode writing nested coordinates**: Fixed geocoding service writing legacy nested `coordinates:` format
  - Now writes flat `coordinates_lat` / `coordinates_long` properties (preferred format)
  - Also removes any legacy nested `coordinates:` property when updating

- **Data Analysis showing person issues for place notes**: Fixed Data Quality analysis incorrectly flagging place notes with person-specific issues like "No parents defined" or "No birth date"
  - Added `isPlaceNote` filter to exclude place notes from person cache

### Documentation

- **Calendarium integration planning**: Added user feedback section to planning document
  - Documented primary use case (calendar definitions over events)
  - Added date range support (`fc-end`) as Phase 2 priority
  - Noted pain points: era handling, per-calendar frontmatter fields
  - Updated roadmap with integration timeline and user feedback

---

## [0.10.15] - 2025-12-08

Improved duplicate place detection and GEDCOM import normalization for US state abbreviations.

### Added

- **Merge Duplicates - Pass 5: State Abbreviation Variants**: New detection pass identifies place notes that differ only in state name format
  - Detects pairs like "Abbeville SC" and "Abbeville South Carolina" as duplicates
  - Checks both frontmatter title and filename for state components
  - Supports various filename formats: spaces, kebab-case (`abbeville-south-carolina`), and snake_case (`abbeville_south_carolina`)

### Changed

- **GEDCOM Import: State Abbreviation Normalization**: US state abbreviations are now automatically expanded to full names during place import
  - Comma-separated: `Abbeville, SC, USA` → `Abbeville, South Carolina, USA`
  - Space-separated: `Abbeville SC` → `Abbeville, South Carolina`
  - Prevents duplicate place notes from being created during import

### Improved

- **Merge Duplicates - Pass 4**: Administrative divisions (County, Parish, etc.) are now separated from settlements before grouping
  - Prevents "Abbeville County" from being incorrectly grouped with "Abbeville" (the city)
  - Each category groups independently by base name

- **GEDCOM Import Type Inference**: Context-aware detection prevents mislabeling cities as counties
  - When importing "Abbeville", checks if "Abbeville County" exists as a sibling
  - If explicit county sibling exists, infers the non-suffixed place as a city/town rather than county

---

## [0.10.14] - 2025-12-08

Control Center UI consistency improvements, Places tab UX overhaul, and new hierarchy enrichment tool.

### Added

- **Enrich Place Hierarchy Modal**: New tool to automatically build place hierarchies using geocoding
  - Geocodes orphan places using Nominatim API with address details
  - Parses structured address components to extract hierarchy (city → county → state → country)
  - Auto-creates missing parent place notes with appropriate place types
  - Links places to their parents, building complete hierarchies
  - Handles country-level places as top-level (no parent needed)
  - Progress indicator with per-place results showing hierarchy created

- **Schema Validation Progress Modal**: Visual progress indicator when validating vault against schemas
  - Shows current file being validated
  - Progress bar with percentage complete
  - Auto-closes on completion

### Changed

- **Places Tab: Unified Data Quality Card**: Combined separate "Actions" and "Data quality issues" cards into a single unified card
  - **Summary bar**: At-a-glance overview showing counts for orphan places, missing place notes, and other issues
  - **Collapsible issue sections**: Each issue type in its own expandable section with issue count badge
  - **Inline action buttons**: Individual "Create", "Edit", "Set parent", or "Review" buttons per issue item
  - **Batch action links**: "Find all duplicates →" and similar links connect to existing modals
  - **Other tools section**: Non-issue actions (Geocode lookup, Standardize place names, Merge duplicates) moved to dedicated section below issues
  - **Progressive disclosure**: First two issue sections expanded by default; others collapsed
  - **Priority ordering**: Missing place notes sorted by reference count (most-referenced first)

- **Places Tab Workflow Order**: Reorganized Data Quality card to present tools in recommended workflow order
  1. Missing place notes → Create missing places
  2. Real places missing coordinates → Bulk geocode
  3. Orphan places → Enrich hierarchy (new)
  4. Duplicate names → Merge duplicates
  5. Name variations → Standardize names (moved from Other Tools)
  - Circular hierarchies, fictional with coords, invalid categories follow

- **Type Manager Cards**: Unified all type manager cards (Events, Sources, Organizations, Relationships, Places) to use Obsidian's Setting component
  - Consistent layout with name, description, and action buttons
  - Standardized spacing and visual hierarchy

- **Control Order Standardization**: Filter, sort, and search controls now follow consistent order across all tabs
  - Order: Filter → Sort → Search (where applicable)
  - Consistent styling and spacing

- **Collections Tab: Families Table**: Converted families list to paginated table format
  - Consistent with other entity tables in Control Center
  - Pagination for large family lists

### Fixed

- **Enrich Place Hierarchy Modal**: Fixed false "Enrichment cancelled" message when clicking Done button after completion
  - Button handler conflict caused both startEnrichment and close to fire simultaneously
  - Added guard to prevent re-entry after completion
- **Enrich Place Hierarchy Modal**: Countries no longer re-processed on subsequent runs
  - Top-level countries (placeType=country) are now excluded from orphan list
- **Enrich Place Hierarchy Modal**: Places with incomplete hierarchies no longer re-processed if already enriched
  - Places that already have coordinates are excluded when "Include incomplete hierarchies" is enabled
- **Data Quality Card**: Orphan place count now matches Enrich Hierarchy modal count
  - Both now exclude countries from orphan calculation

### Improved

- **Data Quality Card Discoverability**: Issues are now prominently displayed at the top of the Places tab instead of buried at the bottom
- **Actionability**: Users can now fix issues directly from the issue list without scrolling to a separate Actions card

---

## [0.10.13] - 2025-12-08

Timeline export improvements with Excalidraw styling options and unified export UI.

### Added

- **Unified Export Timeline Card**: Consolidated Canvas, Excalidraw, and Markdown export into a single card
  - Format selector dropdown to switch between export types
  - Dynamic options that show/hide based on selected format
  - Shared filter controls (person, event type, group) across all formats

- **Excalidraw Export Styling Options**: Full control over hand-drawn diagram appearance
  - Drawing style: Architect (clean), Artist (natural), Cartoonist (rough)
  - Font selection: 7 fonts including Virgil, Excalifont, Comic Shanns, Helvetica, Nunito, Lilita One, Cascadia
  - Font size slider (10-32px)
  - Stroke width slider (1-6px)
  - Fill style: Solid, Hachure (diagonal lines), Cross-hatch
  - Stroke style: Solid, Dashed, Dotted

### Fixed

- **Markdown Table Export**: Escaped pipe characters in wikilink aliases
  - Links like `[[path/to/file|Display Name]]` now render correctly in table cells
  - Prevents table column misalignment from unescaped pipe delimiters

---

## [0.10.12] - 2025-12-07

Duplicate place detection and improved merge modal UX.

### Added

- **Merge Duplicate Place Notes**: New tool to find and merge duplicate place notes
  - Detects place notes with identical names that may represent the same location
  - Suggests the most complete note as canonical (based on parent, coordinates, type, references)
  - Merging updates person notes, re-parents child places, and moves duplicates to trash
  - Accessible via Places tab workflow (step 2) or command palette
  - Particularly useful after GEDCOM import when duplicates are common

- **Full Name Similarity Detection**: Duplicate detection now also groups places by normalized `full_name`
  - Catches duplicates like "Hartford, CT" and "Hartford, CT, USA" with different parents
  - Normalizes full names by removing common country suffixes (USA, United Kingdom, etc.)
  - Shows "similar full name" match reason in the UI

- **Merge Modal Enhancements**:
  - **Help link**: Links to wiki documentation for the merge feature
  - **Context menu for open button**: Right-click to choose "Open in new tab", "Open to the right", or "Open in new window"
  - **Filename rename**: Change the canonical file's name after merge (useful for removing "-2" suffixes)
  - **Sorting options**: Sort by most/fewest duplicates, or alphabetically by name
  - **Filtering options**: Filter to show pending, has metadata, or has coordinates groups
  - **Character count badge**: Shows body content length instead of generic "has content"
  - **Full name display**: Shows the `full_name` GEDCOM property for each place

- **New Command**: `Merge duplicate place notes` to find and merge duplicate place notes

### Improved

- **Standardize Place Names UX**: Enhanced modal with clearer explanations and impact preview
  - Added explanation section showing which frontmatter fields will be updated
  - Dynamic impact display shows exactly what will change when you select an option
  - Button labels now show reference counts (e.g., "Standardize (12)")
  - Tooltips provide additional context about files affected

- **Places Tab Workflow**: Reorganized workflow steps
  - Added "Merge duplicate places" as step 2
  - Renumbered subsequent steps (Create missing → 3, Build hierarchy → 4, Geocode → 5)

---

## [0.10.11] - 2025-12-07

GEDCOM import improvements and enhanced place variation detection.

### Added

- **Guide Tab: Base Templates Card**: New card providing quick access to create Obsidian Bases for all entity types
  - People, Places, Events, Organizations, and Sources templates available
  - One-click creation with descriptive labels for each type
  - Consistent styling with other Guide tab cards

- **Data Quality Tab: Base Type Dropdown**: Create base dropdown now supports all entity types
  - Dropdown selector to choose People, Places, Events, Organizations, or Sources
  - Replaces single-purpose People template button

- **New Commands**: Added commands for Places and Events base templates
  - `Create places base template`: Creates an Obsidian Base for geographic locations
  - `Create events base template`: Creates an Obsidian Base for life events and milestones

- **Geocode Place Context Menu Action**: Right-click any place note to look up coordinates via OpenStreetMap
  - Uses note title and parent place for accurate geocoding
  - Updates frontmatter with lat/long coordinates
  - Works with both `cr_type: place` and `type: place` notes

- **Enhanced Place Variation Detection**: "Find variations" now detects places with same name but different hierarchy
  - Detects variations like "Greene County, Tennessee, USA" vs "Greene County Tennessee"
  - Parses both comma-separated and space-separated place formats
  - Recognizes US states and common countries in space-separated strings
  - Matches places sharing base locality with common hierarchy elements

### Fixed

- **GEDCOM Importer Property Alignment**: Fixed place properties to match Place model
  - Changed `parent` to `parent_place` for wikilink references
  - Added `parent_place_id` with cr_id reference for reliable linking
  - Fixed dedup cache to recognize both `type` and `cr_type` properties

- **Place String Normalization**: GEDCOM importer now normalizes place strings before processing
  - Handles leading commas, extra spaces, and empty hierarchy parts
  - Applied during collection, event creation, and cache building
  - Reduces duplicate place creation from inconsistent GEDCOM data

- **Place Type Detection**: Added heuristics for inferring place types from names
  - Detects counties, states, countries, cities, etc. from naming patterns
  - Falls back gracefully when patterns don't match

---

## [0.10.10] - 2025-12-07

### Fixed

- **Place Hierarchy Not Loading from GEDCOM Import**: Fixed parent-child relationships not being resolved for GEDCOM-imported places
  - Root cause: GEDCOM importer writes `parent: "[[ParentName]]"` but PlaceGraphService only checked `parent_place` and `parent_place_id`
  - Now supports `parent`, `parent_place`, and `parent_place_id` properties
  - Added proper wikilink resolution in a second pass after all places are loaded
  - This should significantly reduce orphan place counts for GEDCOM imports

---

## [0.10.9] - 2025-12-07

Control Center improvements for large vaults.

### Added

- **Status Tab: Events and Sources Cards**: New cards showing event and source note statistics
  - Events card displays total count and breakdown by event type
  - Sources card displays total count and breakdown by source type

- **Custom Maps Card Description**: Clarifies that the built-in interactive map handles most real-world genealogy, with custom maps for historical maps, cemetery plots, land surveys, or fictional worlds

- **Person Notes Table**: Replaced alphabetical letter-grouped list with a compact table format
  - Columns: Name, Born, Died, and actions
  - Click any row to open the person edit modal
  - File icon button opens the note directly; badge icon creates missing place notes
  - Explanatory hint above table describes interactions
  - Filter dropdown: All people, Has dates, Missing dates, Unlinked places, Living
  - Sort dropdown: Name (A–Z/Z–A), Birth (oldest/newest), Death (oldest/newest)
  - Pagination with "Load more" button for large lists

- **Events Tab: Timeline Table Editing**: Click-to-edit events directly from the Timeline card
  - Click any row to open the event edit modal
  - File icon button opens the note directly
  - Explanatory hint above table describes interactions
  - Context menu still available for additional options (open in new tab, delete)

- **Places Tab: Place Notes Table**: Replaced category-grouped list with a compact table format
  - Columns: Name, Category, Type, People, and actions
  - Click any row to open the place edit modal
  - File icon button opens the note directly
  - Explanatory hint above table describes interactions
  - Filter dropdown: All places, by category (Real, Historical, etc.), Has/No coordinates
  - Sort dropdown: Name (A–Z/Z–A), People count (most/least), Category, Type
  - Pagination with "Load more" button for large lists
  - Color-coded category badges for quick visual identification

- **Sources Tab: Filter, Sort, and Open Note Button**: Enhanced sources table with filtering and sorting
  - Filter dropdown: All sources, by type (grouped), by confidence (High/Medium/Low), Has/No media
  - Sort dropdown: Title (A–Z/Z–A), Date (newest/oldest), Type, Confidence
  - Open note button added to actions column next to existing Extract events button
  - Pagination with "Load more" button for large lists

- **Organizations Tab: Filter, Sort, and Click-to-Edit**: Enhanced organizations table with filtering, sorting, and edit modal
  - Filter dropdown: All organizations, by type (grouped), Has/No members
  - Sort dropdown: Name (A–Z/Z–A), Type, Members (most/least), Universe
  - Click any row to open the organization edit modal
  - Open note button in actions column (file icon)
  - Explanatory hint above table describes interactions
  - Pagination with "Load more" button for large lists

- **Maps Tab: World Map Preview**: Interactive Leaflet world map preview in Control Center
  - Shows real world geography using OpenStreetMap tiles
  - Displays place markers at their geographic coordinates
  - Shows count of places with coordinates
  - Click anywhere on the map to open the full interactive map view

### Fixed

- **Person Notes Listing Sources/Events**: Fixed issue where source and event notes appeared in the People tab's person list
  - Root cause: Notes with `cr_id` were included regardless of `cr_type`
  - Now properly filters out notes with `cr_type: source` or `cr_type: event`
  - Also fixed in vault statistics to ensure accurate person count

- **Events Tab Statistics Not Detecting cr_type Notes**: Fixed "Event notes" and "Statistics" cards showing zero counts when notes use `cr_type: event` or `cr_type: person` instead of `type`
  - Root cause: `calculateEventStatistics()` and `calculateDateStatistics()` used hardcoded `type` property check
  - Now uses flexible note type detection (`isEventNote`, `isPersonNote`) supporting `cr_type`, `type`, and tags

---

## [0.10.8] - 2025-12-07

Completes the `cr_type` migration started in v0.10.2.

### Changed

- **cr_type Migration Complete**: All note creation and documentation now uses `cr_type` instead of `type`
  - Updated Essential properties in Control Center Guide tab
  - Updated all Templater template snippets
  - Updated service files that create events, sources, organizations, schemas
  - Updated GEDCOM importer for events, sources, and places
  - Updated create-map-modal and image-map-manager
  - Updated empty state messages in all tabs
  - Note: `type` property still works for backwards compatibility

### Added

- **Wiki Link in Template Snippets Modal**: Added link to Templater Integration wiki guide for advanced user script setup

---

## [0.10.7] - 2025-12-07

Settings consolidation and bug fixes.

### Changed

- **Settings Consolidation**: Reorganized folder settings for clarity
  - Added Events, Organizations, Timelines, and Schemas folders to Plugin Settings
  - Created new "Advanced" section for staging isolation and folder filtering options
  - Added explanatory info boxes in both Plugin Settings and Preferences tab
  - Import/Export tab now shows folder summary with link to Preferences for configuration

### Fixed

- **Status Tab Crash**: Fixed error when opening Control Center Status tab
  - Crash occurred when notes had non-string tags in frontmatter
  - Added type checking to gracefully skip malformed tag data
  - Added error handling to display helpful error messages instead of silent failures

---

## [0.10.6] - 2025-12-07

Bug fix release: Fixed wikilink corruption in frontmatter operations. Added "Add cr_id" context menu action.

### Added

- **Add cr_id Context Menu Action**: Quick way to add just a cr_id to notes
  - Appears alongside "Add essential properties" in all context menus
  - Available for single files, multi-file selection, and folders
  - Detects note type and uses appropriate prefix (`place_`, `event_`, or none for persons)
  - Skips notes that already have a cr_id

### Fixed

- **Wikilink Corruption Bug**: Fixed issue where wikilinks like `[[Person]]` became `[[[Person]]]`
  - Affected "Add essential properties" context menu action
  - Affected bidirectional relationship sync (adding parents, spouses, children)
  - Root cause: Manual YAML manipulation with regex didn't handle wikilinks in arrays properly
  - Solution: Converted all frontmatter operations to use Obsidian's `processFrontMatter` API

---

## [0.10.5] - 2025-12-07

Bug fix release with Templater documentation.

### Added

- **Templater Integration Guide**: Comprehensive wiki documentation for using Templater with Canvas Roots
  - Explains `cr_id` format (`abc-123-def-456`)
  - Provides inline template snippets and reusable user script approaches
  - Complete example templates for Person, Place, Event, and Source notes
  - Tips for folder-specific template automation
  - Guide tab in Control Center now links to this documentation

### Fixed

- **"Add essential properties" Frontmatter Corruption**: Fixed bug where existing list properties containing wikilinks were corrupted
  - `[[Gaeleri]]` would incorrectly become `[[[Gaeleri]]]`
  - Now uses Obsidian's `processFrontMatter` API to safely modify only specified properties

---

## [0.10.4] - 2025-12-06

Bug fix release: Fixed Preferences tab crash when valueAliases was undefined.

### Fixed

- **Preferences Tab Crash**: Fixed error when opening Preferences tab
  - Crash occurred when `valueAliases` setting was undefined (new installs or after settings reset)
  - Added null check before accessing `valueAliases` properties

---

## [0.10.3] - 2025-12-06

Type Customization: Full type manager for Events, Sources, Organizations, Relationships, and Places. Create, edit, hide, and customize types and categories with user-defined names.

### Added

- **Type Managers**: Full customization UI for all note type categories
  - Events: Create custom event types, rename built-ins (e.g., "birth" → "nameday"), organize into categories
  - Sources: Add custom source types for specialized research materials
  - Organizations: Define organization types for noble houses, guilds, corporations, etc.
  - Relationships: Customize relationship types with colors and line styles
  - Places: Add custom place types with hierarchy levels, organize into categories

- **Category Management**: Create, edit, and organize type categories
  - Create custom categories to group related types
  - Rename built-in categories to match your terminology
  - Reorder categories with sort order field
  - Hide unused categories (built-in or custom)

- **Type Customization Features**
  - Override built-in types: Change name, description, icon, color
  - Hide types: Remove from dropdowns while preserving existing notes
  - Reset to defaults: Restore customized built-in types
  - Delete custom types: Remove user-created types entirely

- **Place Type Hierarchy**: Place types support both category and hierarchy level
  - Hierarchy levels (0-99) determine valid parent-child relationships
  - Categories (geographic, political, settlement, subdivision, structure) organize the UI
  - Users can assign place types to any category regardless of hierarchy

---

## [0.10.1] - 2025-12-06

GEDCOM Import v2: Full-featured import with event notes, source notes, hierarchical place notes, progress indicator, and filename format options.

### Added

- **GEDCOM Import v2**: Enhanced import creating multiple note types
  - Create event notes from GEDCOM events (births, deaths, marriages, and 30+ other event types)
  - Create source notes from GEDCOM `SOUR` records with `TITL`, `AUTH`, `PUBL`, `REPO` fields
  - Create hierarchical place notes parsing `City, County, State, Country` structure
  - Per-note-type toggle: choose which note types to create (people, events, sources, places)
  - Disable people notes if you already have them in your vault

- **Filename Format Options**: Control how imported note filenames are formatted
  - Three formats: Original (John Smith.md), Kebab-case (john-smith.md), Snake_case (john_smith.md)
  - "Customize per note type" toggle for fine-grained control
  - Set different formats for people, events, sources, and places

- **Import Progress Modal**: Visual feedback during large imports
  - Phase indicator (validating, parsing, places, sources, people, relationships, events)
  - Progress bar with current/total counts
  - Running statistics showing places, sources, people, events created
  - Auto-closes after completion

- **Place Duplicate Detection**: Smart matching for existing place notes
  - Case-insensitive matching on `full_name` property
  - Fallback matching on title + parent combination
  - Updates existing places (adds missing parent links) instead of creating duplicates

- **Import Options UI Improvements**
  - Descriptive text explaining what each toggle does
  - Counts shown in toggle labels (e.g., "Create event notes (6,010 found)")
  - Reorganized options with explanatory paragraph

### Changed

- **Numbering System Modal**: No longer appears automatically after GEDCOM import
  - Added "Skip" button for when accessed from other UI paths
  - Users can assign reference numbers later via Tools menu

### Fixed

- **People Tab Performance**: Fixed crash when viewing People tab with large imports (2k+ people)
  - Added pagination (100 people at a time with "Load more" button)
  - Removed expensive per-person badge calculations that were causing freezes

- **GEDCOM Analysis Performance**: Fixed freeze when selecting large GEDCOM files
  - Optimized connected components algorithm from O(n×m) to O(n+m)
  - Pre-built family lookup index for fast relationship traversal

---

## [0.10.0] - 2025-12-06

Chronological Story Mapping release: Event notes, person timelines, family timelines, source event extraction, and global timeline view.

### Added

- **Timeline Export**: Export event timelines to Canvas or Excalidraw
  - Export card in Events tab with layout and filtering options
  - Three layout styles: horizontal, vertical, and Gantt (by date and person)
  - Color-coding by event type, category, confidence, or monochrome
  - Filter exports by person, event type, or group/faction
  - Include before/after relationship edges as canvas connections
  - Group events by person option
  - Preview shows export statistics before export
  - Export to Excalidraw (when plugin is installed)
  - Events positioned chronologically with dated events arranged by date
  - Per-canvas style overrides preserved during regeneration

- **Groups/Factions Property**: Events can now be tagged with groups for filtering
  - New `groups` property (string array) for categorizing events by nation, faction, organization
  - Filter timeline exports by group
  - "By Group" view in events base template
  - Statistics track events by group

- **Compute Sort Order**: Automatic topological ordering of events
  - "Compute sort order" button in Events tab
  - Calculates `sort_order` values from before/after DAG relationships
  - Respects date-based ordering, then relative constraints
  - Detects and reports cycles in event ordering
  - Uses increments of 10 for manual adjustment flexibility

- **Events Base Template**: Pre-configured Obsidian Base for event management
  - "New events base from template" context menu on folders
  - 20 pre-configured views: By Type, By Person, By Place, By Group, By Confidence, etc.
  - Includes Vital Events, Life Events, Narrative Events filter views
  - High/Low Confidence, With/Missing Sources views
  - By Sort Order view for computed chronological ordering

- **Place Timeline View**: Events at a specific location over time in the Maps tab
  - Place selector dropdown with event counts per place
  - Timeline displays all events at selected location chronologically
  - Family presence analysis with visual bars showing date ranges per person
  - Summary shows event count, date range, and people present
  - Events clickable to navigate to event notes
  - Integrated into Maps tab for geographic context

- **Family Timeline View**: Aggregate timeline for family units in the People tab
  - Users badge on person list items shows total family events count
  - Click badge to expand family timeline showing events for person + spouses + children
  - Color-coded by family member with legend (blue=self, pink=spouse, green/amber/etc=children)
  - Relationship context shown for each event (e.g., "John Smith (child)")
  - All events sorted chronologically across family members
  - Lazy-loaded for performance

- **Timeline Card in Events Tab**: Global timeline view with filtering and gap analysis
  - View all events in chronological order
  - Filter by event type, person, and search text
  - Event table with Date, Event, Type, Person, Place columns
  - Click rows to navigate to event notes
  - Color-coded event type badges with icons
  - Data quality insights: timeline gaps (5+ years), unsourced events, orphan events
  - Right-click context menu on event rows (Open note, Open in new tab, Delete event)

- **Person List Context Menus**: Right-click on person list items in People tab
  - Events submenu with "Create event for this person" and timeline export options
  - Export timeline to Canvas or Excalidraw formats
  - Mobile-friendly: flat menu items on mobile devices, submenus on desktop

- **Person Note File Context Menus**: Right-click on person note files in file explorer
  - Events submenu with "Create event for this person" and timeline export options
  - Export timeline to Canvas or Excalidraw formats
  - Mobile-friendly with "Canvas Roots:" prefixes on flat menu items

- **Source Event Extraction**: Extract events from source notes
  - "Extract events" button in Sources tab action column
  - Context menu with "Extract events" option on source rows
  - ExtractEventsModal pre-populates fields from source metadata (date, place, confidence)
  - Suggests event types based on source type (census→residence/occupation, vital_record→birth/death/marriage)
  - Add/remove event suggestions before batch creation
  - Created events automatically link to the source note

- **Person Timeline View**: View chronological events for any person in the People tab
  - Calendar badge on person list items shows event count
  - Click badge to expand timeline showing all linked events
  - Events display chronologically with date, type, place, and source info
  - Color-coded icons match event type (birth=green, death=gray, marriage=pink, etc.)
  - Click event to navigate to event note
  - Confidence and source warnings for data quality awareness
  - Lazy-loaded for performance with large vaults

- **Event Notes**: New note type (`type: event`) for documenting life events
  - 22 built-in event types across 4 categories: core, extended, narrative, custom
  - Core events: birth, death, marriage, divorce
  - Extended events: burial, residence, occupation, education, military, immigration, baptism, confirmation, ordination
  - Narrative events: anecdote, lore_event, plot_point, flashback, foreshadowing, backstory, climax, resolution
  - Date precision support: exact, month, year, decade, estimated, range, unknown
  - Confidence levels: high, medium, low, unknown
  - Person and place linking via wikilinks
  - Timeline membership for grouping events
  - Fictional date system integration for worldbuilders
  - Canonical event marking for worldbuilding

- **Create Event Modal**: Full-featured modal for creating event notes
  - Event type dropdown grouped by category
  - Date precision and date fields with end date for ranges
  - Person picker integration for linking primary person
  - Place and timeline linking fields
  - Confidence level selection
  - Worldbuilding options section for narrative event types

- **Event Service**: Backend service for event note management
  - CRUD operations with caching
  - Query by person, place, or timeline
  - Event statistics

- **Event Templates**: Seven new templates in Template Snippets modal
  - Basic event, Birth, Marriage, Death, Narrative, Relative-ordered, Full event

- **Command**: "Create event note" command in command palette

### Changed

- **Control Center Consolidation**: Merged Canvas Settings tab into Preferences tab
  - Canvas layout settings (horizontal/vertical spacing, node dimensions)
  - Canvas styling settings (color scheme, arrow styles, spouse edge labels)
  - Reduced tab count from 16 to 15 for cleaner navigation
  - Preferences tab description updated to reflect added functionality

### Fixed

- **Create Event Modal**: Fixed person linking UI
  - Link/Unlink button now properly updates icon and text when toggling state
  - Button icons correctly switch between link and unlink states

### Settings Added

- `eventsFolder`: Default folder for event notes (default: `Canvas Roots/Events`)
- `customEventTypes`: User-defined event types
- `showBuiltInEventTypes`: Toggle visibility of built-in event types (default: true)

---

## [0.9.4] - 2025-12-05

Value Aliases release: Use custom property values without editing your notes.

### Added

- **Value Aliases**: Map custom property values to Canvas Roots canonical values
  - Configure aliases in Control Center → Preferences → Aliases
  - Supports three field types: event types, gender, and place categories
  - Event types: `birth`, `death`, `marriage`, `burial`, `residence`, `occupation`, `education`, `military`, `immigration`, `baptism`, `confirmation`, `ordination`, `custom`
  - Gender: `male`, `female`, `nonbinary`, `unknown`
  - Place categories: `real`, `historical`, `disputed`, `legendary`, `mythological`, `fictional`
  - Graceful fallback: unknown event types resolve to `custom`
  - Read integration: canonical values take precedence, then aliases are checked
  - Write integration: imports create notes with aliased values

- **Bases Folder Setting**: Configure where Obsidian Bases files are created
  - New setting in Plugin Settings → Folder Locations and Preferences → Folder Locations
  - Default: `Canvas Roots/Bases`
  - Leave empty to create bases in the context menu folder

- **Nested Property Detection**: Data Quality now detects non-flat frontmatter structures
  - Warns about nested YAML properties that may cause compatibility issues
  - Shows nested keys for each detected property
  - Prepares for future "Flatten" action

### Changed

- Renamed "Property aliases" card to "Aliases" with two sections: property names and property values
- Unified alias configuration in a single card for better discoverability
- **Gender Standardization**: Person modal now uses "Gender" terminology
  - Changed from "Sex" to "Gender" with updated description
  - Added "Non-binary" option alongside Male, Female, and Unknown
  - Non-binary displays as yellow in canvas and tree preview
  - Updated data quality validation to accept all canonical gender values

### Fixed

- Fixed `addClass()` calls in create place modal (was passing incorrect arguments)
- Place note creation and editing now write flat coordinate properties (`coordinates_lat`, `coordinates_long`, `custom_coordinates_x`, etc.) instead of nested objects
- Place graph reads both flat and nested coordinate formats for backwards compatibility

### Documentation

- Updated Settings and Configuration wiki page with Value Aliases section
- Updated Frontmatter Reference wiki page with canonical values tables
- Updated Roadmap to mark Value Aliases as complete

---

## [0.9.3] - 2025-12-05

Property Aliases release: Use custom property names without renaming your frontmatter.

### Added

- **Property Aliases**: Map custom frontmatter property names to Canvas Roots fields
  - Configure aliases in Control Center → Preferences → Property Aliases
  - Supports all person note properties: identity, dates, places, relationships
  - Read resolution: canonical property first, then falls back to aliases
  - Write integration: imports create notes with aliased property names
  - Essential Properties card displays aliased property names when configured
  - Bases templates generated with aliased property names
  - Add, edit, and delete aliases through intuitive modal interface

- **Settings & Configuration Wiki Page**: New comprehensive documentation
  - Control Center overview with all tabs documented
  - Folder locations reference
  - Property aliases configuration guide
  - Layout and canvas styling settings
  - Data, privacy, and research tool settings

### Changed

- Essential Properties card now shows aliased property names when aliases are configured
- GEDCOM, GEDCOM X, Gramps, and CSV importers now write to aliased property names
- Person note creation respects property aliases throughout

---

## [0.9.2] - 2025-12-05

Events Tab release: Improved discoverability for Fictional Date Systems.

### Added

- **Events Tab**: New dedicated tab in Control Center for temporal data management
  - **Date systems card**: Moved from Canvas Settings with all existing functionality intact
  - **Statistics card**: Shows date coverage metrics for person notes
    - Birth/death date coverage percentages
    - Fictional date usage count and systems breakdown
- Improves discoverability of Fictional Date Systems feature
- Lays groundwork for future Chronological Story Mapping features

### Changed

- Canvas Settings tab simplified by moving date systems to Events tab
- Control Center tab order updated: Events tab now appears after People tab

---

## [0.9.1] - 2025-12-05

Style Settings integration and code quality improvements.

### Added

- **Style Settings Integration**: Customize Canvas Roots colors via the [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin
  - **Family Chart View colors**: Female, male, and unknown gender card colors; chart background (light/dark); card text color (light/dark)
  - **Evidence Visualization colors**: Primary/secondary/derivative source colors; research coverage threshold colors (well-researched/moderate/needs research)
  - **Canvas Node Dimensions**: Info panel directing users to plugin settings (not CSS-controlled)
  - Works with Style Settings plugin if installed; no changes required for users without it

### Changed

- Updated wiki documentation for Style Settings feature

### Fixed

- Fixed potential object stringification issues (`[object Object]`) in various services
- Fixed lexical declaration in switch case block (validation service)
- Wrapped unhandled promises with `void` operator
- Removed unnecessary `async` from methods without `await`
- Removed unused imports and variables
- Fixed sentence case violations in UI text

---

## [0.9.0] - 2025-12-05

Evidence Visualization release: GPS-aligned fact tracking, proof summaries, and canvas conflict markers.

### Added

- **Fact-Level Source Tracking**: Track which specific facts have source citations
  - New `sourced_facts` property on person notes for GPS-aligned research
  - Per-fact source arrays: `birth_date`, `birth_place`, `death_date`, `death_place`, `marriage_date`, `occupation`
  - Research coverage percentage calculated from sourced vs total facts
  - Configurable fact coverage threshold in settings

- **Source Quality Classification**: Rate sources by genealogical standards
  - Three quality levels: Primary, Secondary, Derivative (per Evidence Explained methodology)
  - `source_quality` property on source notes
  - Color-coded quality badges throughout the UI

- **Research Gaps Report**: Identify under-researched areas
  - Data Quality tab shows unsourced facts across the tree
  - Filter by fact type or person
  - Priority ranking by number of missing sources
  - Quick actions to add source citations

- **Proof Summary Notes**: Document reasoning for genealogical conclusions
  - New note type `type: proof_summary` with structured frontmatter
  - Track subject person, fact type, conclusion, status, and confidence
  - Evidence array linking sources with support levels (strongly/moderately/weakly/conflicts)
  - Status workflow: draft → complete → needs_review → conflicted
  - Confidence levels: proven, probable, possible, disproven

- **Proof Summary Management**: Full CRUD operations for proof notes
  - Create Proof modal accessible from person detail view
  - Edit existing proof summaries
  - Delete with confirmation (moves to trash)
  - Proof cards displayed in Research Coverage section

- **Source Conflict Detection**: Identify conflicting evidence
  - Source Conflicts section in Data Quality tab
  - Detects proof summaries with `status: conflicted` or conflicting evidence items
  - Shows conflict count per person

- **Canvas Conflict Markers**: Visual indicators for unresolved conflicts
  - `⚠️ N` indicator at top-left of person nodes with conflicts
  - Only visible when `trackFactSourcing` is enabled
  - Red color (canvas color '1') draws attention to research issues
  - Complements existing source indicator (`📎 N · %`) at top-right

- **Enhanced Source Indicators**: Research progress overlay
  - Shows source count and research coverage percentage: `📎 3 · 75%`
  - Color-coded by coverage: green (≥75%), yellow (≥50%), red (<50%)
  - Gated behind `trackFactSourcing` setting for casual users

### Changed

- Control Center person detail view now includes Research Coverage section with fact-level breakdown
- Data Quality tab reorganized with Source Conflicts section
- Source indicators on canvas now optionally show coverage percentage

### Settings Added

- `trackFactSourcing`: Enable fact-level source tracking (default: false)
- `factCoverageThreshold`: Number of facts for 100% coverage (default: 6)
- `showResearchGapsInStatus`: Show research gaps in Status tab (default: true)

---

## [0.8.0] - 2025-12-04

Evidence & Source Management release: Complete source management with media gallery, citation generator, and tree indicators.

### Added

- **Source Indicators on Generated Trees**: Visual badges showing research documentation quality
  - Display badges like "📎 3" on tree nodes indicating how many source notes link to each person
  - **Color coding**: Green badges for 3+ sources (well-documented), yellow for 1-2 sources
  - Only appears on nodes that have at least one linked source
  - Source notes identified by `type: source` frontmatter property
  - Toggle in Settings → Canvas Roots → Canvas styling → "Show source indicators"
  - Uses Obsidian's `resolvedLinks` to detect wikilinks from source notes to person notes
  - Helps identify which ancestors need more research at a glance

- **Source Media Gallery**: Thumbnail grid for browsing source media
  - Filter by media type (images, documents)
  - Filter by source type
  - Search by filename or source title
  - Lightbox viewer with keyboard navigation (arrow keys, Escape)
  - Support for images and document placeholders
  - Statistics footer showing media counts

- **Citation Generator**: Generate formatted citations in multiple academic styles
  - Chicago Manual of Style
  - Evidence Explained (Elizabeth Shown Mills) - genealogical standard
  - MLA (Modern Language Association)
  - Turabian
  - Copy single format or all formats to clipboard
  - Missing field warnings for incomplete citations

- **Evidence & Sources Wiki Page**: Comprehensive documentation for source management
  - Source note schema with 13 source types (census, vital_record, photograph, etc.)
  - Source property reference (source_date, source_repository, confidence, etc.)
  - Linking sources to people via wikilinks
  - Sources Bases template with 17 pre-configured views
  - Best practices for organizing source notes and media

### Changed

- Updated Frontmatter-Reference.md with correct source property names (source_date, source_repository, etc.)
- Updated Tree-Generation wiki page with source indicators documentation
- Updated Roadmap to reflect completion of Evidence & Source Management

---

## [0.7.0] - 2025-12-03

World-Building Suite release: Custom Relationships, Fictional Date Systems, and Organization Notes.

### Added

- **Custom Relationships**: Extended relationship types beyond standard family links
  - **Built-in Relationship Types**: 12 pre-defined relationship types across 4 categories:
    - Legal/Guardianship: Guardian/Ward, Adoptive Parent/Child, Foster Parent/Child
    - Religious/Spiritual: Godparent/Godchild, Mentor/Disciple
    - Professional: Master/Apprentice
    - Social: Witness (symmetric)
  - **Relationships Tab**: Dedicated Control Center tab for relationship management
    - Custom relationship types table with color swatches and category grouping
    - Toggle to show/hide built-in relationship types
    - Custom relationships table showing all defined relationships in vault
    - Statistics card with relationship counts by type
  - **Add Relationship Modal**: Add custom relationships from person note context menu
    - Dropdown grouped by category
    - Person picker for target selection
    - Optional notes field
  - **Frontmatter Storage**: Relationships stored in `relationships` array with `type`, `target`, `target_id`, and optional `notes`
  - **Canvas Edge Support**: Custom relationships can be rendered as colored edges on canvas trees
  - **Commands**: "Add custom relationship to current person", "Open relationships tab"
  - **Context Menu**: "Add custom relationship..." option for person notes

- **Fictional Date Systems**: Custom calendars and eras for world-building
  - Era definitions with name, abbreviation, and epoch year
  - Date parsing for `{abbrev} {year}` format (e.g., "TA 2941", "AC 283")
  - Age calculation within a single calendar system
  - Built-in presets: Middle-earth, Westeros, Star Wars, Generic Fantasy calendars
  - Universe-scoped calendar systems
  - Date Systems card in Canvas Settings tab for management
  - Test date parsing input for validation
  - Toggle for enabling/disabling built-in systems
  - Custom date system creation with era table editor

- **Organization Notes**: Define and track non-genealogical hierarchies
  - New note type `type: organization` for houses, guilds, corporations, military units
  - **8 Organization Types**: noble_house, guild, corporation, military, religious, political, educational, custom
    - Each type has unique color and icon
    - Built-in types can be hidden, custom types can be added
  - **Organization Hierarchy**: Parent organization relationships via `parent_org` field
    - Sub-organization tracking
    - Hierarchy navigation
  - **Person Membership System**: Track people's affiliations with organizations
    - `memberships` array in person frontmatter
    - Role, from date, to date, and notes fields
    - Multiple memberships per person supported
  - **Organizations Tab in Control Center**:
    - Organizations list grouped by type with color indicators
    - Statistics card with total organizations, people with memberships, total memberships
    - Type breakdown with counts per organization type
    - Organization types table with toggle for built-in types
    - Data tools card with "Create base template" button
  - **Obsidian Bases Integration**: Pre-configured organizations.base template
    - 17 views: By Type, Noble Houses, Guilds, Corporations, Military Units, Religious Orders, etc.
    - Filter by active/dissolved, universe, top-level vs sub-organizations
    - Formulas for display name, active status, hierarchy path
  - **Context Menu**: "Add organization membership..." option for person notes
  - **Commands**: "Create organization note", "Open organizations tab", "Create organizations base template"

### Changed

- **Status Tab**: Renamed "Relationships" card to "Family links" to distinguish from custom relationships
  - Clarifies that family links (father, mother, spouse) are separate from custom relationships
- **Tab Reorganization**: Merged Staging tab content into Import/Export tab
  - Staging area management now accessible from Import/Export tab
  - Reduced navigation clutter while maintaining functionality

### Removed

- **Advanced Tab**: Retired from Control Center to reduce tab count
  - Logging settings moved to plugin's native Settings tab (Settings → Canvas Roots → Logging)
  - "Create base template" button moved to Data Quality tab under "Data tools" section
  - Log export folder and obfuscation settings now accessible in plugin settings

### Code Quality (2025-12-04)

- Moved Leaflet plugin CSS from dynamic injection to static stylesheet
- Replaced browser `fetch()` with Obsidian `requestUrl()` API
- Replaced deprecated `substr()` with `substring()`
- Replaced browser `confirm()` dialogs with Obsidian modals
- Use `Vault#configDir` instead of hardcoded `.obsidian` path
- Replaced `as TFile` casts with proper `instanceof` checks
- Fixed TypeScript union type issue (`string | unknown` → `unknown`)
- Removed unnecessary `async` from methods without `await`

---

## [0.6.3] - 2025-12-03

### Added

- **Schema Validation**: User-defined validation schemas to enforce data consistency
  - **Schema Notes**: New note type (`type: schema`) with JSON code block for schema definition
  - **Schemas Tab**: Dedicated Control Center tab for schema management
    - Create Schema modal with full UI (no manual JSON editing required)
    - Edit existing schemas via modal
    - Schema gallery with scope badges (collection, folder, universe, all)
    - Vault-wide validation with results display
    - Recent violations list with clickable links to affected notes
    - Schema statistics (total schemas, validation counts)
  - **Property Validation**: Type checking for string, number, date, boolean, enum, wikilink, array
    - Enum validation with allowed values list
    - Number range validation (min/max)
    - Wikilink target type validation (verify linked note has correct type)
  - **Required Properties**: Enforce presence of specific frontmatter fields
  - **Conditional Requirements**: `requiredIf` conditions based on other property values
  - **Custom Constraints**: JavaScript expressions for cross-property validation
    - Sandboxed evaluation with access to frontmatter properties
    - Custom error messages for each constraint
  - **Data Quality Integration**: Schema violations section in Data Quality tab
    - Summary stats (validated, passed, failed)
    - Error breakdown by type
    - Re-validate button
  - **Commands**: "Open schemas tab", "Validate vault against schemas"
  - **Context Menu**:
    - Person notes: "Validate against schemas"
    - Schema notes: "Edit schema", "Validate matching notes", "Open schemas tab"

- **Guide Tab Updates**: Schema validation integrated into Control Center Guide
  - Schema notes section in Essential Properties collapsible
  - Schema validation concept in Key Concepts card
  - "Validate schemas" quick action in Common Tasks grid

- **New Icons**: `clipboard-check` (schema validation), `file-check` (schema note)

### Changed

- **Tab Order**: Schemas tab added between Maps and Collections
  - New order: Status → Guide → Import/Export → Staging → People → Places → Maps → **Schemas** → Collections → Data Quality → Tree Output → Canvas Settings → Advanced

---

## [0.6.2] - 2025-12-03

### Added

- **Maps Tab in Control Center**: Dedicated tab for map management and visualization
  - **Open Map View card**: Quick access to Map View with coordinate coverage stats
  - **Custom Maps gallery**: Thumbnail grid showing all custom map images
    - Image previews (~150×100px) with name overlay and universe badge
    - Hover actions: Edit button and context menu button (stacked on right)
    - Click thumbnail to open map in Map View
  - **Visualizations card**: Migration diagrams and place network tools
  - **Map Statistics card**: Coordinate coverage, custom map count, universe list

- **Custom Map Management**: Full CRUD operations for custom map notes
  - **Create Map Modal**: Create new map notes with image picker, bounds, and universe
  - **Edit Map Modal**: Update existing map note properties
  - **Duplicate Map**: Clone a map with auto-generated unique ID (copy, copy 2, etc.)
  - **Export to JSON**: Export map configuration as JSON file
  - **Import from JSON**: Import map configuration with duplicate ID detection
  - **Delete Map**: Remove map with confirmation dialog

- **New UI Components**
  - `createCollapsible()` helper method for reusable accordion sections
  - Task grid CSS component for quick action navigation
  - Guide step badges for visual workflow clarity
  - Map gallery section with thumbnail grid styling
  - New icon types: `lightbulb`, `list-checks`, `map`, `more-vertical`

- **Status Tab Enhancements**: Comprehensive vault overview
  - **Places card**: Total places, places with coordinates, breakdown by category
  - **Custom Maps card**: Total maps count and list of universes
  - **Canvases card**: Total canvas files in vault

### Changed

- **Data Quality Tab Repositioned**: Moved after Collections tab for better workflow
  - New tab order: Status → Guide → Import/Export → Staging → People → Places → Maps → Collections → Data Quality → Tree Output → Canvas Settings → Advanced

- **Guide Tab Overhaul**: Streamlined Control Center Guide tab for better usability
  - Reduced from 19 cards (~976 lines) to 5 focused cards (~254 lines)
  - New collapsible sections for essential properties reference (Person, Place, Map notes)
  - Task grid component for quick navigation to common features
  - Integrated wiki links for detailed documentation
  - Streamlined "Getting Started" with clear 3-step workflow

### Removed

- **Quick Actions Tab**: Removed from Control Center to streamline the interface
  - "Recent Trees" section moved to Tree Output tab
  - "Create base template" button moved to Advanced tab
  - Other actions were redundant (tab navigation buttons) or placeholder (coming soon notices)

---

## [0.6.0] - 2025-12-03

### Added

- **Interactive Map View**: Full Leaflet.js-powered geographic visualization
  - Dedicated Map View (Open via ribbon icon or command palette)
  - OpenStreetMap tiles for real-world locations
  - Color-coded markers: birth (green), death (red), marriage (purple), burial (gray)
  - Marker clustering for dense areas with click-to-zoom
  - Migration paths connecting birth → death locations with directional arrows
  - Path text labels showing person names along migration routes (Leaflet.TextPath)
  - Heat map layer showing geographic concentration
  - Fullscreen mode and mini-map overview
  - Place search with autocomplete and zoom-to-result

- **Custom Image Maps**: Support for fictional world mapping
  - Load custom map images from vault (PNG, JPG, WebP)
  - Universe-based filtering (auto-switch to Westeros map when viewing House Stark)
  - YAML frontmatter configuration for bounds, center, zoom
  - Two coordinate systems: geographic (lat/lng) or pixel (for hand-drawn maps)
  - Pixel coordinate system uses `pixel_x` and `pixel_y` in place notes

- **Map Image Alignment (Edit Mode)**: Interactive georeferencing for custom maps
  - Drag corner handles to position, scale, rotate, and distort map images
  - Align historical or hand-drawn maps to coordinate systems
  - Edit banner with Save/Undo/Reset/Cancel controls
  - Corner positions saved to map note frontmatter (`corner_nw_lat`, etc.)
  - "Reset to default" clears alignment and restores rectangular bounds
  - Powered by Leaflet.DistortableImage library

- **Additional Marker Types**: Extended life event visualization beyond core events
  - New marker types: residence, occupation, education, military, immigration
  - Religious event markers: baptism, confirmation, ordination
  - Custom event type for user-defined life events
  - Events array in person frontmatter for multiple events per person
  - Each event type has configurable color in settings
  - Layer toggles for each marker category (residences, occupations, etc.)
  - Religious events grouped under single "Religious" toggle

- **Journey Paths (Route Visualization)**: Connect all life events chronologically
  - Shows complete life journey from birth through all events to death
  - Dashed violet polylines distinguish journeys from migration paths
  - Arrow decorations show direction of movement between locations
  - Popup displays all waypoints with event types and dates
  - Layer toggle: "Journey paths (all events)" in Layers menu
  - Off by default to avoid visual clutter with many people
  - Complements Time Slider for tracking individual movement over time

- **Map Filtering & Controls**
  - Filter by collection (family branch)
  - Year range filtering with min/max inputs
  - Layer toggles for all marker types and paths/heat map
  - Map selector dropdown for switching between real-world and custom maps

- **Time Slider Animation**: "Who was alive when?" visualization
  - Scrub through years to see who was alive at any point
  - Play/pause animation with adjustable speed
  - Snapshot mode (only alive at year) vs. cumulative mode
  - Person count display during animation

- **Map Comparison**: Side-by-side and multi-instance support
  - Split view horizontally or vertically
  - Open additional map tabs
  - Independent filtering per instance

- **Export Options**
  - Export as GeoJSON Overlay for GIS tools
  - Export as SVG Overlay for embedding in notes
  - Exports include markers, paths, and metadata

- **Edit Person Modal**: Update existing person notes
  - Edit mode for CreatePersonModal
  - Update name, dates, places, relationships
  - Clear relationships by unlinking

- **Context Menu Actions**: Quick editing from any view
  - "Edit person" action opens edit modal for person notes
  - "Edit place" action opens edit modal for place notes

- **Folder Settings**: Configurable default folders in plugin settings
  - People folder setting
  - Places folder setting
  - Maps folder setting (for custom map images)
  - Canvases folder setting

### Changed

- Control Center restructured with folder settings section

---

## [0.5.2] - 2025-12-01

### Added

- **Geographic Features - Place Notes System**: Comprehensive place-based features for genealogical and world-building research
  - Place note schema with hierarchical relationships (city → state → country)
  - Six place categories: real, historical, disputed, legendary, mythological, fictional
  - Universe support for organizing fictional/mythological places
  - Coordinates support for real-world lat/long and custom map systems
  - Historical names tracking for places that changed names over time
  - Person note integration with birth_place, death_place, burial_place fields

- **Place Statistics & Management**: Control Center panel for place analytics
  - Overview metrics: total places, coordinate coverage, orphan detection, max hierarchy depth
  - Category breakdown with associated person counts
  - Most common birth/death places ranking
  - Migration pattern detection (birth → death location flows)
  - Place hierarchy issue detection and warnings
  - Actions: create missing place notes, build hierarchy wizard, standardize place names, view place index

- **Place Visualizations (D3-based)**: Interactive place network and migration diagrams
  - Network/Schematic View: places as nodes sized by associated person count
  - Tree and radial layout options with color coding by category, type, or depth
  - Interactive tooltips with place details
  - Migration Flow Diagram: arc diagram showing movement patterns between places
  - Time period filtering with year range inputs and century presets
  - Collection (family branch) filtering
  - Hierarchy level aggregation for regional analysis

- **Place UX Improvements**: Streamlined place creation and management workflow
  - Searchable parent place picker grouped by place type
  - Manual coordinate entry with validation (lat: -90 to 90, long: -180 to 180)
  - Quick-create places from person notes via context menu
  - Auto-create parent place workflow with type suggestions
  - Custom place types beyond built-in options (e.g., "galaxy", "dimension")
  - Geocoding lookup via Nominatim API with "Look up coordinates" button
  - Places Base template with 14 pre-configured views
  - Default place category rules (folder-based and collection-based)
  - Auto-populate parent place from folder structure

- **Control Center Updates**: Tab restructuring for geographic features
  - Renamed "Data entry" tab to "People" for clarity
  - New Create Person modal with relationship pickers (father, mother, spouse)
  - People tab combines quick actions, statistics, and searchable person list
  - Unlinked place badges with create buttons in person list
  - Dedicated places folder setting
  - Place-based tree filtering (birth, death, marriage, burial locations)

---

## [0.5.0] - 2025-12-01

### Added

- **Staging Workflow**: Safe import processing with isolated staging folder
  - Configure staging folder in Settings → Data section
  - Import destination toggle: choose main tree or staging
  - Staging folder automatically excluded from tree generation, duplicate detection, etc.
  - Staging tab in Control Center for managing import batches

- **Cross-Import Duplicate Detection**: Find duplicates between staging and main tree
  - CrossImportDetectionService compares staging records against main tree
  - Side-by-side comparison modal for reviewing matches
  - Resolution tracking: mark matches as "Same person" or "Different people"
  - Resolutions persist across sessions

- **Merge Wizard**: Field-level conflict resolution for duplicate records
  - MergeWizardModal with side-by-side field comparison
  - Dropdown per field to choose source (Main, Staging, or Both for arrays)
  - Preview merged result before executing
  - Automatic relationship reconciliation updates all references
  - Available from both duplicate detection and cross-import review

- **Data Quality Tools**: Comprehensive data quality analysis and batch operations
  - Quality score (0-100) based on completeness and consistency
  - Issue detection across 5 categories: date inconsistencies, relationship problems, missing data, format issues, orphan references
  - 15+ specific issue types detected (birth after death, circular references, etc.)
  - Filter issues by category and severity (error/warning/info)
  - Batch normalization: standardize date formats to YYYY-MM-DD
  - Batch normalization: standardize gender values to M/F
  - Batch normalization: clear orphan parent references
  - Preview changes before applying any batch operation
  - Data Quality tab in Control Center with visual stats and issue list

- **Staging Tab in Control Center**: Dedicated UI for import management
  - View staging subfolders with person counts and modification dates
  - Promote subfolders or all staging to main tree
  - Delete staging subfolders
  - Review cross-import matches before promoting
  - Quick statistics for staging area

- **Folder Filtering for Person Discovery**: Control which folders are scanned
  - Exclusion list mode: ignore specific folders
  - Inclusion list mode: only scan specified folders
  - Applies to all person note operations

- **Combined Import/Export Tab**: Unified interface for all import/export operations
  - Single tab replaces separate GEDCOM and CSV tabs
  - Format dropdown: choose GEDCOM or CSV
  - Direction dropdown: choose Import or Export
  - Inline folder configuration section for quick setup

- **Split Canvas Wizard**: Multi-step wizard for splitting large family trees
  - Split by generation (configurable generations per canvas)
  - Split by branch (paternal/maternal lines)
  - Single lineage extraction (direct line between two people)
  - Split by collection (one canvas per user-defined collection)
  - Ancestor + descendant canvas pairs
  - **Split by surname** - Extract people by surname even without established connections
    - Scrollable list of surnames sorted by frequency
    - Multi-surname selection
    - Options: include spouses, match maiden names, handle spelling variants
    - Separate canvas per surname or combined output
  - Preview showing expected canvas count and people
  - Access via canvas context menu → Canvas Roots → Split canvas wizard

### Changed

- Promote operations now skip files marked as "same person" (duplicates should be merged instead)
- StagingService updated with `PromoteOptions` for skip logic
- DuplicateDetectionModal now accepts settings for merge button integration
- Control Center Import/Export tab now includes collapsible folder configuration
  - Configure people folder, staging folder, and isolation settings without leaving Control Center
  - Shows current folder status at a glance

---

## [0.3.3] - 2025-11-29

### Added

- **CSV Import/Export**: Full CSV support for spreadsheet workflows
  - Import from CSV/TSV files with auto-detected column mapping
  - Export to CSV with configurable columns and privacy protection
  - New CSV tab in Control Center alongside GEDCOM

- **Selective Branch Export**: Export specific portions of your family tree
  - Choose a person and export only their ancestors or descendants
  - Available in both GEDCOM and CSV export tabs
  - Option to include spouses when exporting descendants
  - Works alongside collection filtering

- **Smart Duplicate Detection**: Find and manage potential duplicate records
  - Fuzzy name matching using Levenshtein distance algorithm
  - Date proximity analysis for birth/death dates
  - Confidence scoring (high/medium/low) with configurable thresholds
  - Command: "Find duplicate people" opens detection modal
  - Review matches and dismiss false positives

- **Family Chart View Enhancements**:
  - Kinship labels: Toggle to show relationship labels on links (Parent/Spouse)
  - Multiple views: "Open new family chart" command creates additional tabs
  - Duplicate view: Pane menu option to open same chart in new tab

---

## [0.3.2] - 2025-11-28

### Fixed

- **ESLint Compliance**: Fixed 19 ESLint errors for PR review compliance
  - Removed unnecessary `async` keywords from synchronous methods
  - Fixed floating promises in event handlers with `void` operator
  - Added eslint-disable comments with explanations where required by base class

### Added

- **Bidirectional Name Sync**: Full two-way synchronization between chart edits and file names
  - Editing a name in Family Chart View now renames the markdown file
  - Renaming a file in Obsidian updates the frontmatter `name` property
  - Chart automatically refreshes when person files are renamed
  - Added `sanitizeFilename` helper for safe filename generation

---

## [0.3.1] - 2025-11-27

### Added

- **PDF Export**: Export family charts and tree previews to PDF format
  - Family Chart View: Export menu in toolbar (PNG, SVG, PDF)
  - Tree Preview in Control Center: PDF export option
  - Canvas file context menu: "Export as image" submenu with PNG, SVG, PDF options

- **Customizable Export Filenames**: Configure export filename patterns
  - New setting: Export filename pattern (default: `{name}-family-chart-{date}`)
  - Placeholders: `{name}` for root person name, `{date}` for current date
  - Applied to all image exports (PNG, SVG, PDF)

### Changed

- Added jsPDF dependency for PDF generation

---

## [0.3.0] - 2025-11-26

### Added

- **Interactive Family Chart View**: A new persistent, interactive visualization panel for exploring and editing family trees in real-time
  - Pan, zoom, and navigate large trees (50+ people) with smooth animations
  - Click any person to center the view or open their note
  - Built-in editing: add, modify, and delete relationships directly in the chart
  - Full undo/redo support for confident editing
  - Bidirectional sync: changes automatically update your markdown notes
  - Color schemes: Gender, Generation, Collection, or Monochrome
  - Adjustable layout spacing: Compact, Normal, or Spacious
  - Toggle birth/death date display on person cards
  - Export as high-quality PNG (2x resolution) or SVG
  - Commands: "Open family chart", "Open current note in family chart"
  - State persistence: view settings preserved across sessions

---

## [0.2.9] - 2025-11-26

### Added

- **Privacy Protection for GEDCOM Export**: Optional privacy controls for living persons
  - Configurable birth year threshold (default: 100 years ago)
  - Exclude living persons entirely or anonymize their data
  - Privacy-protected exports maintain family structure while hiding PII
  - Settings: `enableGedcomPrivacy`, `livingPersonThreshold`

- **Lineage Tracking**: Compute and track multi-generational lineages from root persons
  - Support for patrilineal (father's line), matrilineal (mother's line), and all descendants
  - `lineage` array property in frontmatter for multiple lineage membership
  - Commands: "Assign lineage from root person", "Remove lineage tags"
  - Context menu integration on person notes with lineage type submenu
  - Suggested lineage names based on surname (e.g., "Smith Line")

- **Folder Statistics Modal**: Comprehensive folder-level analytics
  - Data completeness metrics (required fields, dates, relationships)
  - Relationship health reports (orphans, incomplete relationships)
  - Family structure analysis (gender distribution, generation depth)
  - Access via right-click folder context menu

- **Relationship History & Undo**: Track and reverse relationship changes
  - History modal showing all relationship changes with timestamps
  - Statistics by change type (add parent, add spouse, add child, etc.)
  - One-click undo for any change
  - Configurable retention period with automatic cleanup
  - Settings: `enableRelationshipHistory`, `historyRetentionDays`
  - Commands: "View relationship history", "Undo last relationship change"

- **Enhanced Bases Template**: Expanded from 16 to 22 pre-configured views
  - New views: By lineage, By generation number, Ahnentafel ordered, d'Aboville ordered, Henry ordered, Without lineage
  - Added visible properties: lineage, generation, ahnentafel, daboville, henry

- **Multi-Vault Deploy Script**: Deploy to multiple Obsidian vaults simultaneously

### Changed

- RelationshipManager now optionally records changes to history service
- Improved error handling for Base template creation with Bases plugin detection

---

## [0.2.8] - 2025-11-26

### Added

- **Reference Numbering Systems**: Assign standard genealogical reference numbers
  - **Ahnentafel**: Ancestor numbering (self=1, father=2, mother=3, paternal grandfather=4, etc.)
  - **d'Aboville**: Descendant numbering with dot notation (1, 1.1, 1.2, 1.1.1, etc.)
  - **Henry System**: Compact descendant numbering without dots (1, 11, 12, 111, etc.)
  - **Generation**: Relative generation depth (0=self, -1=parents, +1=children)
  - Commands for each system via command palette
  - Context menu on person notes with numbering submenu
  - "Clear reference numbers" command to remove specific numbering types
  - Numbers stored in frontmatter: `ahnentafel`, `daboville`, `henry`, `generation`

---

## [0.2.7] - 2025-11-25

### Added

- **Bases Integration Improvements**
  - Enhanced error handling for Base operations
  - Bases plugin detection with confirmation modal
  - Improved Base template with additional visible properties

---

## [0.2.6] - 2025-11-25

### Changed

- Documentation updates for community plugin submission
- Minor UI text improvements for Obsidian style guide compliance

---

## [0.2.5] - 2025-11-25

### Added

- **Relationship Calculator**: Calculate the relationship between any two people
  - BFS pathfinding algorithm finds shortest path through family connections
  - Proper genealogical terms (cousin, uncle, 2nd cousin once removed, etc.)
  - Support for cousins with removal (1st cousin twice removed, etc.)
  - In-law relationship detection (parent-in-law, sibling-in-law)
  - Common ancestor identification for collateral relationships
  - Visual path display showing the chain of relationships
  - Copy result to clipboard functionality
  - Command: "Calculate relationship between people"
  - Context menu entry on person notes

---

## [0.2.4] - 2025-11-24

### Changed

- **Community Plugin Submission**: Prepared plugin for Obsidian community plugin directory
  - Fixed manifest validation issues (removed "Obsidian" from description)
  - Corrected authorUrl format
  - Standardized version numbering (removed -beta suffix)
  - Added GitHub issue templates with privacy guidance
  - Updated security documentation

---

## [0.2.3-beta] - 2025-11-24

### Added

- **Interactive Tree Preview**: Real-time visual preview of family trees before canvas generation
  - SVG-based preview with pan/zoom controls (mouse wheel zoom, drag to pan)
  - Interactive controls: Zoom in/out buttons, zoom-to-fit, label visibility toggle
  - Color scheme options: Gender (green/purple), Generation (multi-color layers), Monochrome (neutral)
  - Hover tooltips: View person details (name, birth/death dates, generation) on hover
  - Export functionality: Save preview as high-resolution PNG or vector SVG
  - Integrated into Tree Output tab for seamless workflow
  - Particularly useful for large trees (50+ people) to verify layout before canvas generation

- **UI Consolidation**: Streamlined tree generation and export workflows
  - Renamed "Tree Generation" tab to "Tree Output" to reflect both generation and export capabilities
  - Added "Export Tree" section with Excalidraw export instructions
  - Created "Generate tree" submenu in person note context menus with two quick actions:
    - "Generate Canvas tree" - Opens Tree Output tab with full control over settings
    - "Generate Excalidraw tree" - Instantly generates Excalidraw tree with sensible defaults
  - Hybrid approach: Canvas generation for full control, Excalidraw for speed

- **Essential Properties Feature**: Bulk-add essential properties to person notes
  - Context menu action "Add essential properties" for single or multiple markdown files
  - Adds all 9 essential properties if missing: `cr_id`, `name`, `born`, `died`, `father`, `mother`, `spouses`, `children`, `group_name`
  - Smart visibility: Only shows for files missing some properties
  - Multi-file selection support with file count indicator
  - Non-destructive: Preserves existing data, only adds missing properties

- **Complete Person Notes by Default**: All person note creation now includes essential properties
  - Person notes created via Data Entry tab include all essential properties
  - GEDCOM imports create complete person notes with all essential properties
  - Properties use empty strings or arrays when data is unavailable
  - Ensures consistency between manually created and imported notes

- **Alternative Layout Algorithms**: Choose from four layout algorithms to visualize family trees in different ways
  - **Standard**: Traditional family-chart layout with proper spouse handling (default)
  - **Compact**: 50% tighter spacing for large trees (ideal for 50+ people)
  - **Timeline**: Chronological positioning by birth year
    - X-axis: Birth year (shows who lived when)
    - Y-axis: Generation number
    - Intelligently estimates positions for missing birth dates from relatives
    - Auto-fallback to generation-based layout when no dates available
  - **Hourglass**: Focus on one person's complete lineage
    - Root person centered at Y=0
    - Ancestors positioned above (negative Y)
    - Descendants positioned below (positive Y)
    - Each generation horizontally centered

- **Enhanced Canvas Naming**: Auto-generated canvas filenames now include layout type
  - Standard: `Family Tree - Name.canvas` (no suffix)
  - Compact: `Family Tree - Name (compact).canvas`
  - Timeline: `Family Tree - Name (timeline).canvas`
  - Hourglass: `Family Tree - Name (hourglass).canvas`

- **Documentation**: Added comprehensive layout documentation
  - New "Layout algorithms" section in Control Center Guide tab
  - Updated user guide with layout descriptions and use cases
  - Layout type stored in canvas metadata for regeneration

---

## [0.2.2-beta] - 2025-11-23

### Added

- **Bidirectional Relationship Sync**: Automatically maintains reciprocal relationships across your family tree
  - Setting someone as a parent automatically adds child relationship in parent's note
  - Deleting a relationship automatically removes reciprocal link
  - Works seamlessly with Bases table edits, direct frontmatter modifications, and external editors
  - Relationship snapshots loaded on plugin initialization for immediate sync

- **Enhanced GEDCOM Support**:
  - Pre-import validation with detailed error reporting
  - Comprehensive import results modal showing success/warning/error counts
  - Improved relationship validation and duplicate detection
  - Better handling of edge cases and malformed data

- **Obsidian Bases Integration**: Six new pre-configured relationship query views
  - Single Parents: People with children but no spouse
  - Childless Couples: Married couples without children
  - Multiple Marriages: People married more than once
  - Sibling Groups: Sets of siblings grouped by parents
  - Root Generation: Ancestor endpoints with children but no parents
  - Marked Root Persons: People marked with `root_person: true`

- **Root Person Marking**: Mark specific people as "root persons" for lineage tracking
  - Crown-icon context menu action: "Mark as root person" / "Unmark as root person"
  - Property: `root_person: true` in YAML frontmatter
  - Documented in Control Center Guide tab with use cases
  - Integrated with Bases "Marked Root Persons" view

- **Property Migration**: Renamed `collection_name` to `group_name` with automatic migration
  - Backward-compatible migration on plugin load
  - Updates both settings and person note properties

### Changed

- Enhanced Control Center Guide tab with root person documentation
- Improved relationship sync reliability and performance
- Updated GEDCOM import workflow with better error handling

---

## [0.2.1-beta] - 2025-11-23

### Fixed

- **Person picker date display**: Fixed person picker and tree generation interface to properly display birth/death dates instead of `cr_id` values. The UI now shows meaningful date information (e.g., "b. 1888" or "1888 – 1952") when available, with `cr_id` as fallback only when dates are missing.
  - Resolved issue where Obsidian's YAML parser converts `born`/`died` date strings to JavaScript Date objects, which weren't being converted back to strings for display
  - Updated person picker modal, Control Center tree generation tab, and root person display
  - Affects both context menu "Generate tree" and Control Center inline person browser

- **Excalidraw export compatibility**: Fixed Excalidraw export feature to generate valid, properly formatted Excalidraw files. Exported family trees now display correctly in Excalidraw with all nodes and connections visible.
  - Corrected opacity values from 0-1 scale to proper 0-100 scale
  - Added missing required fields: `frameId`, `rawText`, `autoResize`, `lineHeight`, `elbowed`
  - Fixed Drawing section JSON structure to be properly enclosed in `%%` comment blocks
  - Added block reference IDs to text elements for proper Excalidraw indexing
  - Implemented coordinate normalization to handle Canvas negative coordinates

---

## [0.2.0-beta] - 2025-11-22

### Added

- **Collections & Groups**: Organize people using auto-detected family groups with customizable names or user-defined collections
  - Browse by detected families, custom collections, or all people
  - Cross-collection connection detection to identify bridge people
  - Filter tree generation by collection
  - Context menu option to set collection names

- **Excalidraw Export**: Export family tree canvases to Excalidraw format for manual annotation and customization
  - Preserves node positioning and colors
  - Enables hand-drawn styling and freeform annotations
  - Maintains family tree structure while allowing artistic enhancement

- **Enhanced spouse support**: Multiple spouse tracking with flat indexed YAML properties
  - Support for unlimited spouses using `spouse1`, `spouse2`, etc.
  - Marriage metadata: dates, locations, divorce dates, marriage status
  - Optional spouse edge display with configurable labels
  - GEDCOM import/export support for marriage events

- **Context menu actions**: Right-click integration throughout Obsidian
  - Person notes: Add relationships, validate data, find canvases
  - Folders: Scan for issues, import/export GEDCOM
  - Canvas files: Regenerate, view statistics
  - Full desktop and mobile support

- **Tree generation improvements**:
  - Inline person browser with birth/death year display
  - Family group sidebar for multi-family vaults
  - Canvas regeneration preserves tree metadata
  - Layout direction switching while preserving other settings

### Changed

- Improved Control Center UI consistency and organization
- Enhanced GEDCOM import to support marriage metadata
- Updated tree preview descriptions for clarity

---

## [0.1.2-alpha] - 2025-11-17

Initial alpha release with core genealogical features.

### Added

- **GEDCOM Import**: Full support for GEDCOM 5.5.1 format
  - Import from Gramps, Ancestry, FamilySearch
  - Preserve `_UUID` tags as `cr_id`
  - Bidirectional relationship linking

- **Automated Layout**: Generate pedigree and descendant charts
  - Non-overlapping genealogical layout algorithms
  - Multiple tree types: ancestors, descendants, full
  - Configurable generation limits and spouse inclusion

- **Canvas Integration**: Native Obsidian Canvas nodes
  - File nodes link to research notes
  - JSON Canvas 1.0 compliance
  - Regenerate canvas to update with current data

- **Styling Options**:
  - Node coloring: gender-based, generation-based, monochrome
  - Arrow styles: directed, bidirectional, undirected
  - Edge colors: 6 preset colors plus theme default
  - Separate parent-child and spouse relationship styling

- **Dual Storage System**: Wikilinks + persistent `cr_id` references
- **YAML-First Data**: Compatible with Dataview and Bases
- **Multi-Family Detection**: Automatically detect disconnected groups
- **Obsidian Bases Compatible**: Ready-to-use Base template included

---

## Release Notes

### Version Status

- **Stable (v0.9.x)**: Evidence Visualization with GPS-aligned fact tracking, proof summaries, canvas conflict markers, and property aliases.
- **Stable (v0.8.x)**: Evidence & Source Management with media gallery, citation generator, and source indicators.
- **Stable (v0.7.x)**: World-Building Suite with custom relationships, fictional date systems, and organization notes.
- **Stable (v0.6.x)**: Interactive Map View with Leaflet.js, custom image maps for fictional worlds, time slider animation, journey paths, and map exports.
- **Stable (v0.5.x)**: Geographic features with place notes, statistics, and visualizations. Import cleanup and merge tools.
- **Stable (v0.4.x)**: Feature-complete for core genealogical workflows with import cleanup and merge tools.
- **Stable (v0.3.x)**: Interactive family chart view, CSV import/export, duplicate detection.
- **Beta (v0.2.x)**: Core genealogical workflows with canvas generation, GEDCOM support, and relationship management.
- **Alpha (v0.1.x)**: Initial testing releases with core functionality.

### Roadmap

See [docs/roadmap.md](docs/roadmap.md) for planned features and development priorities.
