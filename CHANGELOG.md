# Changelog

All notable changes to Canvas Roots will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.18.7] - 2025-12-29

### Added

- **Inclusive Parent Relationships** - Opt-in gender-neutral parent support for diverse family structures ([#63](https://github.com/banisterious/obsidian-canvas-roots/issues/63)):

  **Settings (Control Center > Preferences)**
  - Enable Inclusive Parents toggle (default: OFF) - opt-in feature
  - Parent Field Label text setting for customization (default: "Parents")
    - Examples: "Parents", "Guardians", "Progenitors", "Lolos"
    - Label shown in UI only; frontmatter always uses `parents` property
  - Conditional visibility: label setting only shown when toggle enabled

  **Schema Changes**
  - New `parents` property (wikilinks, can be array for multiple parents)
  - New `parents_id` property (Canvas Roots IDs, dual storage pattern)
  - Independent of `father`/`mother` - users can use either or both
  - Supports mixed usage for blended families or migration scenarios

  **Create/Edit Person Modal**
  - Parents field appears when setting enabled (above father/mother)
  - Multi-select person picker (same pattern as children field)
  - Inline parent creation via person picker
  - No gender pre-fill (unlike father/mother)
  - Uses custom label from settings

  **Family Graph Integration**
  - FamilyGraphService reads `parents`/`parents_id` relationships
  - Included in ancestor/descendant calculations
  - Same treatment as father/mother for graph traversal
  - Spouse edges between 2 parents (same pattern as father/mother)
  - Priority order for fallback: biological → gender-neutral → adoptive

  **Bidirectional Linking**
  - When person added to `parents` array, automatically adds to each parent's `children` array
  - Uses dual storage: both wikilinks (`parents`) and IDs (`parents_id`)
  - Deduplication prevents duplicate entries
  - Handles removal: when parent removed, child removed from their `children`
  - Supports aliased wikilinks (`[[basename|name]]`) when filename differs from name

  **Relationship Displays**
  - Relationships Block (`canvas-roots-relationships`): Shows parents with "Parent" label
  - Family Chart View: Displays gender-neutral parents in interactive tree
  - Sibling Detection: Checks gender-neutral parents' children for siblings

  **Design Principles**
  - Opt-in, not replacement - father/mother fields remain; this adds alongside
  - Configurable - users customize terminology to their preference
  - Non-disruptive - users with traditional setups see no UI changes
  - Coexistent - can use father, mother, AND parents simultaneously

---

## [0.18.6] - 2025-12-29

### Added

- **Media Upload and Management Enhancement** - Comprehensive file upload system allowing users to upload media directly from Canvas Roots and link to entities without manual file management ([#60](https://github.com/banisterious/obsidian-canvas-roots/issues/60)):

  **1. Settings Enhancement**
  - Drag-and-drop reordering of media folders in Preferences
  - First folder in list becomes upload destination
  - Visual feedback during drag operations with grip handle

  **2. Expanded Media Manager Dashboard**
  - 6-tile layout (3×2 grid) vs. previous 4-tile layout
  - Row 1 (Browse & Discover): Linked Media Gallery, Find Unlinked, Source Media Linker
  - Row 2 (Add & Link): Upload Media, Link Media, Bulk Link to Entities

  **3. Standalone Upload Modal**
  - Drag-and-drop file upload with browse fallback
  - Upload to first configured media folder
  - Read-only destination display with helpful hint
  - Multiple file selection support
  - Auto-rename collision handling (incremental numbering: `photo.jpg` → `photo 1.jpg`)
  - File type validation
  - Optional entity linking after upload

  **4. Inline Upload in Media Picker**
  - "Upload files..." button in MediaPickerModal
  - Follows PlacePickerModal "Create new place" pattern
  - Auto-selects newly uploaded files
  - Available in both context menu and Dashboard workflows

  **5. Entity Picker Modal**
  - Select entities after choosing media files (media-first workflow)
  - Supports all entity types: Person, Event, Place, Organization, Source
  - **Person-specific filters:**
    - Living status: All / Living only / Deceased only
    - Birth date: All / Has date / Missing date
    - Sex: All / Male / Female
  - **Person-specific sorting:**
    - Name (A-Z / Z-A)
    - Birth year (oldest first / youngest first)
    - Recently modified
  - Shows which entities already have selected media linked
  - Bulk linking with progress modal for ≥5 entities

  **6. Consistent Upload Availability**
  - Context menu flow: Right-click entity → Media → Link media → Upload files
  - Media Manager tile: Link Media → Upload files
  - Both workflows use same enhanced MediaPickerModal

- **"Create new" buttons in picker modals** - Added inline creation to streamline workflows:
  - **Context menu relationship flows**: All relationship context menu options now show "Create new" buttons
    - "Add father" → Shows "Create new father" button with sex pre-filled as male
    - "Add mother" → Shows "Create new mother" button with sex pre-filled as female
    - "Add spouse" → Shows "Create new spouse" button with opposite sex suggested (if known)
    - "Add child" → Shows "Create new child" button
    - "Add custom relationship" → Shows "Create new [relationship type]" button
  - **Event creation flow**:
    - Primary person field now uses a picker modal with "Create new person" button
    - Place field now uses a picker modal with "Create new place" button
    - Replaces plain text inputs with proper Link/Unlink buttons
  - Matches the behavior of the Create Person modal for a consistent user experience
  - Streamlines workflow from 3 steps (close modal, create note, re-open modal) down to 1 step

### Changed

- **Split "Add parent" into "Add father" and "Add mother"** - Context menu now shows separate options instead of prompting with an intermediate modal:
  - Eliminates the extra step of choosing parent type
  - More discoverable and straightforward
  - Consistent with having separate "Create new father" and "Create new mother" buttons

### Fixed

- **Research gaps counting bug** - Fixed inflated unsourced facts count in Control Center Research Gaps widget:
  - Previously counted all facts as "unsourced" for every person note in the vault, even those without GPS tracking enabled
  - Now only counts unsourced facts for people who have the `sourced_facts` property (actively using GPS tracking)
  - Example: With 24 people using GPS tracking and 7 fact types, the count was showing 169 unsourced facts (24×7), even though many people had complete tracking

- **Timeline filter not working with persons array** - Fixed timeline person filter to properly match events using the `persons` array field:
  - Timeline person filter now checks both the singular `person` field and the `persons` array
  - Events with multiple people are now properly included when filtering by any person's name
  - Substring matching now works correctly for aliased person names

- **Events view not showing linked people** - Fixed "Person" column in Events tab to display all linked people:
  - Person column now shows all people from both `person` (singular) and `persons` (array) fields
  - Multiple people are displayed comma-separated in the table
  - Events no longer appear to have no linked people when using the `persons` array

---

## [0.18.5] - 2025-12-29

### Fixed

- **Bidirectional linking for spouse's children** - Fixed critical regression where children added to a parent would not be automatically linked to the parent's spouse:
  - When adding a child to a parent who has a spouse, the child is now automatically linked to both parents, and both parents get the child in their `children_id` arrays
  - Implemented by suspending the background `BidirectionalLinker` service during manual relationship updates to prevent interference
  - Example: Creating Father, adding Mother as spouse, then adding children now correctly links all family members bidirectionally

- **Double bracket issue in child names** - Fixed bug where child names would accumulate multiple layers of brackets (e.g., `[[[[Child Name]]]]`):
  - Added `stripWikilink()` helper function to remove existing brackets before `createSmartWikilink()` adds new ones
  - Prevents bracket duplication when reading existing child names from frontmatter and re-writing them

- **Missing "Link" text on spouse button** - Added "Link" text label to spouse link button in create person modal (was showing only icon)

- **Data quality checker incorrectly flagging schema-defined structures** - Fixed false warnings for intentional nested structures:
  - `sourced_facts` and `evidence` properties are now whitelisted and won't trigger "nested structure" warnings
  - Cleanup wizard will no longer flatten these properties, preventing breakage of the Evidence Service
  - Users can now safely use GPS (Genealogical Proof Standard) research tracking features without getting false data quality warnings

---

## [0.18.4] - 2025-12-29

### Changed

- **CSS Architecture Refactoring** - Improved maintainability and organization of the plugin's CSS codebase:
  - **Split massive modals.css** (12,488 lines) into 6 focused component files organized by functional domain:
    - `control-center.css` (5,675 lines) - Core Control Center UI (tabs, navigation, cards)
    - `import-export-wizard.css` (1,778 lines) - Import/Export wizard modals
    - `cleanup-wizard.css` (2,134 lines) - Cleanup wizard with all 9 steps
    - `media-modals.css` (1,427 lines) - Media picker, manager, gallery, bulk link modals
    - `place-modals.css` (933 lines) - Place creation, standardization, merge, and network modals
    - `entity-create-modals.css` (542 lines) - Person picker and entity creation forms
  - **Removed 5 empty/unused CSS files** - Deleted `canvas.css`, `edges.css`, `theme.css`, `nodes.css`, and `animations.css` that contained no meaningful styles

### Fixed

- **CSS duplicate definitions** - Resolved critical CSS conflicts that could cause unpredictable styling behavior:
  - `.cr-progress-bar` - Removed duplicate definition, now uses modifier classes (--good, --medium, --bad)
  - `.crc-field-list` - Converted to scoped selectors to prevent conflicts between different contexts
  - `.cr-modal-buttons` - Consolidated to single base definition in `base.css`

- **Missing bidirectional parent-child relationship linking** - Fixed critical bug where creating a person with parents or children would only create one-way relationships. Now all relationship creation flows properly maintain bidirectional links:
  - **Person creation**: When you create a person and link them to a father/mother, the parent's `children_id` array is automatically updated. When you add children during creation, each child's `father_id` or `mother_id` is automatically set based on the parent's sex.
  - **Post-create actions**: When using "Add child", "Add spouse", or "Add parent" buttons in the post-creation flow, both sides of the relationship are now properly updated.
  - **Spouse relationships**: Refactored existing spouse linking to use proper dual storage (wikilink + ID) via `updatePersonNote()`.

  This ensures family relationships are always bidirectional across all creation flows, not just for spouse relationships.

---

## [0.18.3] - 2025-12-29

### Fixed

- **Wikilink handling for duplicate names** - The plugin now properly handles entities with duplicate names (e.g., "John Doe 1.md" for a person named "John Doe") throughout the codebase using Obsidian's wikilink alias format `[[filename|display name]]`. This fixes:
  - Bidirectional relationship linking when adding parents, spouses, or children
  - Note creation for persons, events, places, and organizations
  - All importers (GEDCOM, Gramps XML, GedcomX JSON, CSV)
  - All exporters (GEDCOM, Gramps XML, GedcomX JSON)
  - Dynamic content blocks (timeline, relationships, media gallery)
  - Report generators (timeline, place summary, collection overview, media inventory)

- **"Add essential properties" using wrong property name** - Fixed "Add essential source properties" and "Add essential event properties" context menu actions incorrectly setting `type` instead of `cr_type`. Person, place, and universe actions already used the correct property name. Also updated place standardization and organization membership filtering to check both `cr_type` (preferred) and legacy `type` for backward compatibility.

---

## [0.18.2] - 2025-12-28

### Added

- **Timeline Export Consolidation** - All 8 timeline export formats are now available from a single location: **Statistics & Reports → Reports → Timeline**. This consolidates functionality that was previously split between the Events tab Export card and the Reports wizard.

  **Unified formats:**
  - Visual exports: Canvas, Excalidraw (requires Excalidraw plugin)
  - Documents: PDF, ODT
  - Markdown: Vertical timeline (callouts), Table, Simple list, Dataview query

  **Consolidated options:**
  - All filters from both systems (person, event type, group, place, universe, date range)
  - Canvas/Excalidraw styling (layout, color scheme, ordering edges)
  - Excalidraw drawing options (style, font, stroke width)
  - PDF/ODT options (page size, date format, cover page)
  - Grouping options (none, by year, by decade, by person, by place)
  - Data quality insights (timeline gaps, unsourced events, orphan events)

- **Deprecation notice on Events tab Export card** - The Export card in Control Center → Events now displays a notice directing users to the unified Reports wizard. The Export card will be removed in a future release.

### Fixed

- **Excalidraw timeline exports showing raw file paths** - Event nodes in Excalidraw exports now display formatted labels (e.g., "BIRTH of John Smith (1850)") instead of raw file paths like "People/events/birth-john-smith.md".

- **Excalidraw text positioning** - Text labels in Excalidraw exports are now properly centered within their containing rectangles.

- **ODT table column misalignment with wikilinks** - Fixed an issue where wikilinks with aliases (e.g., `[[file|display]]`) would cause table columns to misalign in ODT exports. The pipe character inside wikilinks is no longer incorrectly treated as a cell delimiter.

- **Canvas year markers in timeline exports** - Year marker text nodes now display properly formatted year labels instead of placeholder text.

- **Intermediate canvas file cleanup** - When exporting to Excalidraw format, the intermediate canvas file is now automatically deleted after successful conversion.

- **Restored "Open in family chart" context menu action** - Re-added the missing menu item for person notes under the Canvas Roots submenu.

---

## [0.18.1] - 2025-12-28

### Added

- **Family Creation Wizard** - New 5-step wizard for creating interconnected family groups. Start from scratch by creating a central person, or build around an existing person in your vault. Add spouses, children, and parents with automatic bidirectional relationship linking. Access via command palette ("Canvas Roots: Create family wizard"), Dashboard tile, People tab actions, or folder context menu.

- **Inline person creation in Edit Modal** - Create new people directly from relationship fields (spouse, father, mother, children) without leaving the Edit Modal. Click the "+" button next to any relationship field to open a mini-form, enter basic details, and the new person is created and linked automatically.

- **Children management in Edit Modal** - New "Children" section in the Edit Modal displays existing children and allows adding new ones via person picker or inline creation. Children are stored using `child` (display names) and `children_id` (cr_id references) array properties.

- **"Add Another" flow for Create Person modal** - After creating a person, choose "Create & Add Another" to immediately create another person in the same folder, or use "Create & Open" to create and navigate to the new note.

- **Nickname property support** - New `nickname` frontmatter property for person notes, displayed in Edit Modal header alongside the formal name. Useful for informal names, pet names, or alternate identities.

- **Folder context menu integration** - Right-click on people folders to access "Create person" and "Create family" actions directly, with the selected folder pre-populated as the destination.

- **State persistence for Family Wizard** - If the Family Creation Wizard is accidentally closed, your progress is saved. When reopening, you'll see a prompt to restore or discard the previous session.

### Changed

- **Edit Modal relationship fields** - Relationship fields (spouse, father, mother) now show inline "Create new" buttons that open a mini-form for creating and linking new people without leaving the modal.

### Fixed

- **Family Wizard relationship merging** - When building a family around an existing person who already has relationships, new relationships are now merged with existing ones instead of overwriting them.

---

## [0.18.0] - 2025-12-28

### Changed

- **Event person property consolidation** - Event notes now use a single `persons` array property for all event types, replacing the previous dual-property approach (`person` for single-participant events, `persons` for multi-participant events). This simplifies data management and enables multi-participant support for all event types.

  **Old format (deprecated):**
  ```yaml
  # Single-participant event
  person: "[[John Smith]]"

  # Multi-participant event
  persons:
    - "[[John Smith]]"
    - "[[Jane Doe]]"
  ```

  **New format (all events):**
  ```yaml
  persons:
    - "[[John Smith]]"
  ```

### Added

- **Event person migration step in Cleanup Wizard** - Step 11 in the Post-Import Cleanup Wizard detects and migrates event notes using the legacy `person` property to the `persons` array format. Includes preview with merge detection for notes that have both properties.

- **Migration notice for v0.18.0** - Users upgrading from v0.17.x see a one-time notice explaining the event person property change with examples and a link to the Cleanup Wizard.

### Migration

The legacy `person` property continues to be read for backward compatibility. To migrate existing notes:

1. Open the Cleanup Wizard (Control Center → Data Quality → Cleanup Wizard, or command palette)
2. Navigate to Step 11: "Migrate Event Person Properties"
3. Review detected notes and click "Apply All" to migrate

---

## [0.17.9] - 2025-12-27

### Added

- **"All places" layer in Map View** - New layer toggle in the Layers menu shows all places with coordinates, not just those referenced by person events. Useful for viewing standalone places on custom maps, especially for fictional worlds where places may not yet have associated person notes.

- **Pixel coordinate support in Create Place modal** - When creating fictional, mythological, or legendary places, the modal now shows pixel coordinate fields (X/Y) instead of geographic coordinates. These coordinates are used for pixel-based custom maps.

- **Wikilink support for custom map images** - Map image paths can now use wikilink syntax (`[[path/to/image.png]]`), allowing Obsidian to automatically update paths when images are moved or renamed. The Create Map modal now stores image paths as wikilinks by default.

- **Map auto-refresh on note changes** - Maps now automatically refresh when place or person notes are modified, using Obsidian's metadata cache events for reliable change detection.

### Fixed

- **Dynamic block order ignored during import** - Fixed issue where the Media block always appeared last in person notes regardless of the configured order. Dynamic blocks now respect the order specified in `dynamicBlockTypes`, placing Media first by default.

- **Custom maps not appearing in gallery after creation** - Fixed issue where newly created custom maps wouldn't appear in the Control Center Maps tab gallery. The gallery now correctly detects maps using the `cr_type: map` frontmatter property in addition to the legacy `type: map` format.

- **Pixel coordinate format mismatch** - Fixed issue where places with pixel coordinates weren't appearing on maps. The map data service now reads multiple property formats (`pixel_x`/`pixel_y`, `custom_coordinates_x`/`custom_coordinates_y`) for compatibility.

---

## [0.17.8] - 2025-12-27

### Fixed

- **Gramps import: multiple events of same type silently skipped** - Fixed issue where multiple events of the same type with the same participants (e.g., several residence events for a married couple) would only import the first event. The filename now includes the event date to ensure uniqueness. (#43)

---

## [0.17.7] - 2025-12-27

### Changed

- **Events base: unified Person(s) column** - The events base template now uses a single "Person(s)" column that displays clickable links for both single-person events (`person` property) and multi-person events (`persons` property). Previously, these were separate columns or the multi-person events didn't display properly.

### Fixed

- **Create Person modal crash with array collection property** - Fixed TypeError when opening the Create Person modal if any person note had a `collection` property stored as an array instead of a string. The modal now safely handles array-type collection values.

- **Gramps import: events at same place incorrectly deduplicated** - Fixed issue where multiple events of the same type, with the same participants, on the same date, but at different places were incorrectly treated as duplicates. The deduplication key now includes place name, ensuring events like multiple residence records are imported correctly.

---

## [0.17.6] - 2025-12-27

### Fixed

- **Gramps import: family events missing Person field** - Events with multiple participants (marriage, divorce, residence, etc.) now correctly populate the Person property when importing from Gramps. These events are attached to families rather than persons in Gramps XML, and are now properly linked to both spouses.

- **"Create person note" command opening retired tab** - The command palette "Canvas Roots: Create person note" command now directly opens the Create Person modal instead of attempting to open the retired Data Entry tab in Control Center.

---

## [0.17.5] - 2025-12-27

### Added

- **Research Level property for tracking research progress** - New `research_level` property (0-6) on person notes to track progress toward GPS-compliant documentation, based on Yvette Hoitink's "Six Levels of Ancestral Profiles" system. Levels range from 0 (Unidentified) to 6 (Biography). Select via dropdown in Create/Edit Person modal.

- **Research Level in Gaps Report** - The Gaps Report now includes research level features: filter by research level (e.g., show only Level 0-2), sort by research level, display level in report table, and summary statistics showing count of ancestors at each level range.

- **Research Level export to GEDCOM and Gramps** - The `research_level` property is exported as `_RESEARCH_LEVEL` custom tag in GEDCOM files and as `<attribute type="Research Level">` in Gramps XML exports.

- **Research Level import from GEDCOM and Gramps** - When importing files that contain research level data (from previous Canvas Roots exports), the `_RESEARCH_LEVEL` tag (GEDCOM) or "Research Level" attribute (Gramps) is automatically imported back into person notes.

- **Research Level in Bases** - Person bases include "By research level" grouped view, "Needs research" filtered view (Level ≤ 2), and "Not assessed" filtered view for tracking research progress across your tree.

- **Media folder selection for Gramps .gpkg import** - When importing `.gpkg` files with bundled media, a dropdown in the Preview step lets you choose the destination folder: configured media folders from Preferences, the default `Canvas Roots/Media`, or a custom path. Option to preserve the original folder structure from the package.

### Changed

- **Control Center Tools icons and order** - Updated icons: Reports now uses `file-text`, Statistics uses `chart-bar-decreasing`. Reordered tools to: Templates, Media Manager, Family Chart, Import/Export, Reports, Statistics.

### Fixed

- **Source Media Linker showing already-linked images** - The Link Media to Sources wizard now excludes images that are already attached to a source note. Previously, images would appear in the list even after being linked, requiring manual tracking of which files had been processed.

- **Townships incorrectly flagged as non-standard place types** - Townships are now recognized as valid administrative divisions and will no longer appear in the "Standardize place types" cleanup wizard. Added `township` as a built-in place type at hierarchy level 6 (below county), appropriate for US Midwest/Northeast civil townships.

---

## [0.17.4] - 2025-12-27

### Added

- **Statistics entry in Control Center Tools** - Added Statistics to the Tools group in Control Center, providing an entry point to the Statistics View. Previously, Statistics View was only accessible via command palette after the old Statistics tab was retired.

- **Configured media folders in Bulk Media Linker** - The Link Media to Sources wizard now offers to use media folders configured in Control Center → Preferences. When folders are configured, users can select from them with checkboxes or switch to custom folder entry. Files from multiple configured folders are combined automatically.

### Fixed

- **Table overflow in Bulk Media Linker** - Fixed table columns spilling outside the modal. Column widths are now fixed with proper proportions, and the Apply button is no longer cut off.

- **Pagination in Bulk Media Linker** - Link step now shows 10 rows at a time with "Show more" and "Show all" buttons, preventing UI sluggishness with large file sets.

- **Focus loss in Media folder field** - Fixed input losing focus on every keystroke. Now only updates when selecting from suggestions or pressing Enter, matching the Control Center preferences behavior.

- **Individual Apply button per row** - Added ability to apply links one at a time from the Link step, with checkmark showing applied status. Review and Execute steps now show only pending (unapplied) links.

- **Confidence dot alignment** - Confidence indicator dots are now vertically aligned with filenames in a styled wrapper div.

---

## [0.17.3] - 2025-12-26

### Fixed

- **Duplicate name wikilinks in GEDCOM import** - When importing GEDCOM files with duplicate names (e.g., two people named "John Smith"), the relationship wikilinks now correctly point to the actual filenames (e.g., `[[John Smith]]` and `[[John Smith-1]]`) instead of all pointing to the same name.

- **Duplicate event note filenames during import** - Fixed "File already exists" errors when importing GEDCOM files with multiple events that generate identical titles (e.g., multiple "Marriage of Unknown and Unknown" events). The importer now tracks created filenames during the import session and includes retry logic to handle race conditions with vault indexing.

- **Missing space in timeline block** - Fixed missing space between event type and "in" preposition (e.g., "Bornin" now correctly displays as "Born in").

- **Bases not created during import** - Bases files (people.base, places.base, etc.) are now created after import even when some errors occur. Previously, any import error would prevent bases creation even though notes were successfully created.

---

## [0.17.2] - 2025-12-26

### Added

- **Resume unsaved work in create entity modals** - All create entity modals (Person, Place, Event, Organization, Source) now persist form state when closed without saving. When reopened, a banner offers to restore the previous session's data or discard it. State expires after 24 hours. Edit mode is excluded from persistence.

### Fixed

- **Base templates not created on import** - Import Wizard now auto-creates base templates (people, places, events, sources, organizations) after successful imports, matching the Control Center behavior.

- **Dynamic blocks not updating on frontmatter changes** - The `canvas-roots-media`, `canvas-roots-timeline`, and `canvas-roots-relationships` code blocks now automatically re-render when frontmatter properties are modified, without requiring the note to be closed and reopened.

### Changed

- **Dynamic block order** - When automatically added to person notes, dynamic code blocks now appear in the order: Media, Timeline, Relationships (previously Timeline, Relationships, Media).

- **Dynamic blocks enabled by default** - The "Include dynamic blocks" option in Create Person modal is now enabled by default, automatically adding Media, Timeline, and Relationships code blocks to new person notes.

---

## [0.17.1] - 2025-12-25

### Added

- **Excalidraw export format** - Generate Tree wizard now supports Excalidraw output. Creates hand-drawn style family tree diagrams using ExcalidrawAutomate API when available, with JSON fallback.
  - Smart connectors that adapt when elements are moved
  - Spouse relationships styled with dashed lines
  - Wiki links on nodes for navigation back to person notes
  - Rich labels with name, dates, and birthplace
  - Dedicated style options step with drawing style, font, fill, and stroke settings
  - Node content options: name only, name + dates, or name + dates + places

### Fixed

- **Text centering in Excalidraw boxes** - Text labels are now properly centered within node rectangles.

- **Duplicate boxes in Excalidraw output** - Fixed issue where using the EA box parameter created visible text containers alongside rectangles.

- **Wiki link brackets in labels** - Wiki link syntax (`[[Link]]`) is now stripped from text labels; links are set via the element's link property instead.

- **Temporary canvas file cleanup** - Excalidraw export no longer leaves behind an intermediate `.canvas` file.

- **Generate button reactivity** - Canvas name input changes now immediately update the Generate button state.

### Internal

- **ESLint compliance** - Fixed all non-sentence-case lint issues across the codebase:
  - Replaced TFile casts with instanceof checks
  - Replaced inline style assignments with CSS classes
  - Fixed floating promises with void operator
  - Fixed case declarations in switch blocks
  - Changed Vault.delete/trash to FileManager.trashFile
  - Removed unused imports and eslint-disable directives
  - Added `crc-clickable` CSS utility class

### Changed

- **Person note context menu** - Simplified to single "Generate visual tree" entry that opens the unified wizard with the person pre-selected.

- **Default canvas name** - Generate Tree wizard step 6 now pre-populates with "Family Tree" instead of requiring manual entry.

---

## [0.17.0] - 2025-12-25

### Added

- **Post-Import Cleanup Wizard** - 10-step guided wizard that consolidates post-import data quality operations into a single sequential workflow. Accessible via command palette ("Canvas Roots: Post-Import Cleanup Wizard"), Data Quality tab, or Import Wizard completion screen.
  - Step 1: Quality Report (review-only with collapsible categories)
  - Step 2: Fix Bidirectional Relationships
  - Step 3: Normalize Date Formats
  - Step 4: Normalize Gender Values
  - Step 5: Clear Orphan References
  - Step 6: Migrate Source Properties (indexed to array format)
  - Step 7: Standardize Place Variants (interactive)
  - Step 8: Bulk Geocode (interactive with progress)
  - Step 9: Enrich Place Hierarchy (interactive)
  - Step 10: Flatten Nested Properties

- **Wizard session persistence** - Cleanup wizard state is saved to settings, allowing interrupted sessions to be resumed. Progress, completed steps, and pending issues are preserved.

- **v0.17.0 Migration Notice** - One-time workspace tab displayed when upgrading to v0.17.0, explaining the source format change and providing direct access to the Cleanup Wizard.

- **Sources property alias support** - The `sources` property can now be aliased like other person note properties (Settings > Property Aliases).

### Changed

- **Source property format** - Sources are now stored as a YAML array (`sources: [...]`) instead of indexed properties (`source`, `source_2`, `source_3`). All importers (GEDCOM, Gramps, GEDCOM X, CSV) now write the array format.

### Breaking Changes

- **Indexed source format removed** - The legacy indexed source format (`source`, `source_2`, `source_3`) is no longer parsed. Notes using this format will not have their sources recognized until migrated. Use the Cleanup Wizard Step 6 to convert existing notes to the array format.

---

## [0.16.1] - 2025-12-25

### Added

- **Expandable parse warnings** - Import wizard Step 4 (Preview) now shows a clickable warning section with chevron icon. Click to expand and view up to 10 warning details, with "...and X more" shown if there are additional warnings.

### Fixed

- **Duplicate event detection in Gramps import** - Gramps importer now detects and skips duplicate events (same type + person + date) that may exist in the source file. Duplicate count is displayed in the import summary.

- **Progress reporting for relationships phase** - Gramps import progress indicator now updates during the relationship linking phase, which previously showed no progress while relationships were being established.

- **Media block missing from dynamic blocks** - All importers (GEDCOM, Gramps, CSV, GEDCOM X) now include the media block in person notes by default. Previously only timeline and relationships blocks were created.

---

## [0.16.0] - 2025-12-24

### Added

- **Import/Export Hub** - New modal-based hub accessible from the Tools group, replacing the Import/Export tab in Control Center. Two-card layout for launching Import or Export wizards.

- **Import Wizard** - 7-step wizard for importing genealogical data:
  1. Format selection (GEDCOM, GEDCOM X, Gramps, CSV)
  2. File picker with drag-and-drop support
  3. Options (entity types, target folder, conflict handling)
  4. Preview (entity counts, validation warnings)
  5. Import progress with real-time log
  6. Optional reference numbering (Ahnentafel, d'Aboville, Henry, Generation)
  7. Completion summary

- **Dynamic blocks import option** - Import Wizard Step 3 now includes a toggle for dynamic blocks, which was inadvertently omitted from the initial wizard implementation. Controls whether timeline, relationships, and media renderer blocks are included in imported person notes. Enabled by default.

- **Excalidraw output format** - Generate Tree wizard now includes Excalidraw as an output format, which was inadvertently omitted from the initial unified wizard implementation in an earlier release. Creates hand-drawn style diagrams that can be annotated and exported to SVG or PNG via the Excalidraw plugin.

- **Export Wizard** - 6-step wizard for exporting genealogical data:
  1. Format selection (GEDCOM, GEDCOM X, Gramps, CSV)
  2. Folder selection (preference folders or custom)
  3. Privacy controls (exclude/redact living persons) and entity inclusions
  4. Preview with entity counts and privacy summary
  5. Export progress with real-time log
  6. Completion with download options

- **Living person privacy controls** - Export wizard Step 3 includes privacy options: exclude living persons entirely, redact sensitive details, or include all. Configurable threshold for "born within X years" living determination.

- **Reports Hub** - New hub modal accessible from Tools group. Provides card-based access to both Narrative Reports (Report Wizard) and Visual Charts (Unified Tree Wizard) from a single entry point.

- **Grouped navigation sidebar** - Control Center sidebar reorganized into logical groups with dividers:
  - **Entities**: People, Events, Places, Sources, Organizations, Universes, Collections
  - **Data & Structure**: Data Quality, Schemas, Relationships
  - **Output**: Canvas Trees, Maps
  - **Tools**: Templates, Media Manager, Family Chart, Reports, Import/Export (open modals/views instead of tabs)
  - **Settings**: Preferences

- **Tools group** - New navigation group containing entries that open modals or dedicated views instead of switching tab content. Entries show a ↗ indicator to distinguish from regular tabs.

### Changed

- **Import/Export UI** - Moved from tab-based interface in Control Center to modal-based wizards, improving discoverability and providing step-by-step guidance.

- **Control Center sidebar styling**:
  - Removed "Navigation" header (redundant with grouped layout)
  - Compact styling with optimized spacing for desktop and mobile
  - Tighter padding and improved text sizing (13px)

### Removed

- **Import/Export tab** - Removed from Control Center's Data & Structure group. Import/Export is now accessed via the hub modal in the Tools group.

- **Guide tab** - Removed from Control Center. Getting Started and Essential Properties documentation moved to the wiki.

- **Statistics tab** - Removed from Control Center. Statistics are now accessed via the dedicated Statistics leaf view (View → Open Statistics).

---

## [0.15.3] - 2025-12-24

### Added

- **Report Wizard Modal** - New multi-step wizard for the Report Generator with 5 steps: Report Type, Subject, Content Options, Output & Styling, and Generate. Category filtering, dynamic options based on report type, and streamlined navigation replace the previous single-modal layout.

- **ODT Export for Reports** - Export all 13 report types as OpenDocument Text (.odt) files for editing in LibreOffice Writer or Microsoft Word. Includes optional cover page with title, subtitle, and notes. Uses JSZip for ZIP archive creation with manual XML generation.

- **ODT Export for Visual Trees** - The unified tree wizard now supports ODT output format. Title field in Step 5 is used for document title and filename. Tree image is embedded in the ODT document.

- **Visual Tree PDF Quality Improvements** - Increased canvas scale from 2× to 4× for crisp PDF output. Removed explicit height constraint to preserve aspect ratio. Visual Tree PDFs now match Family Chart PDF sharpness.

### Changed

- **Report Generator UI** - The Report Generator modal has been replaced with a wizard-style interface. Previous single-screen layout is now split into logical steps for better UX.

---

## [0.15.2] - 2025-12-23

### Added

- **Create universe command** - New command palette entry "Canvas Roots: Create universe" opens the Universe Wizard directly, making universe creation more discoverable.

- **Universes tab always visible** - The Universes tab is now always shown in the Control Center sidebar, even when no universes exist. Previously it was hidden until the first universe was created.

- **Quick Actions tiles in Universes tab** - The Universes tab now displays a tile-based quick actions bar with three options: Create Universe, Date Systems (links to Events tab), and Custom Maps (links to Places tab). These tiles are always visible for quick access.

- **Canvas settings moved to Canvas Trees tab** - The "Canvas layout" and "Canvas styling" cards have been moved from the Preferences tab to the Canvas Trees tab, placing them in context with tree generation features.

- **Preserve media folder structure on import** - New toggle in Gramps .gpkg import to recreate the original subfolder hierarchy from the source instead of importing all media to a flat folder. Useful for users who organize media by family or category.

- **Link media action in People tab** - New "Link media" action in the People tab Actions card opens the Media Manager modal for browsing, linking, and organizing media files.

### Changed

- **Universe discoverability** - Users can now discover and create universes from three entry points: command palette, Universes tab tiles, or Statistics tab. Previously the only entry was buried in the Statistics tab.

### Fixed

- **Dynamic media gallery block not created during import** - Fixed an issue where the "Include dynamic content blocks" toggle during GEDCOM and Gramps import would create timeline and relationships blocks but not the media gallery block. The `media` block type was missing from the import configuration.

---

## [0.15.1] - 2025-12-23

### Added

- **Family Chart Export Wizard** - Replaced the export dropdown menu with a multi-step wizard modal. Features 5 quick presets (Quick Share, High Quality, Print Ready, Editable, Document), format-specific options, scope selection (full tree or limited depth), and progress tracking with phase indicators.

- **ODT export format** - Export Family Chart as OpenDocument Text (.odt) files for editing in LibreOffice Writer or Microsoft Word. Enables merging visual tree charts with narrative text for comprehensive family history documents. Uses JSZip for ZIP archive creation with manual XML generation.

- **Family Chart Styling Panel** - Added palette button to toolbar for quick theme access. Choose from 5 preset themes (Classic, Pastel, Earth Tones, High Contrast, Monochrome) or customize all 7 chart colors via the Customize modal with live preview.

- **Export progress modal** - Real-time progress tracking during export with phase indicators (Preparing, Embedding avatars, Rendering, Encoding, Saving), progress bar, and cancel button.

- **Export settings memory** - Last-used export format, scale, page size, layout, orientation, and cover page settings are remembered for next export.

- **Dynamic content blocks for Gramps import** - Added "Include dynamic content blocks" toggle to Gramps XML/.gpkg import, matching the existing GEDCOM import option. When enabled, imports include timeline and family relationship blocks in person notes.

### Changed

- **Export button behavior** - The toolbar export button now opens the Export Wizard instead of a dropdown menu, providing better discoverability and preventing accidental exports.

- **Custom colors on chart initialization** - Chart colors are now applied from settings when the chart initializes, not just when changed via the styling panel.

---

## [0.15.0] - 2025-12-22

### Added

- **Universal Media Linking** - The `media` property is now supported on Person, Event, Place, and Organization notes (previously only Source notes). Link photos, documents, and scanned records to any entity type.

- **Gramps Package (.gpkg) media import** - Import `.gpkg` files with bundled media. Media files are extracted to your configured media folder and linked to corresponding Person, Event, Place, and Source notes via the `media` frontmatter property.

- **Dynamic media gallery block** - New `canvas-roots-media` code block renders an inline gallery of linked media files in reading view. Configurable columns (2-6 or auto), thumbnail size (small/medium/large), and custom title.

- **Editable media gallery mode** - Set `editable: true` in the media block to enable drag-and-drop reordering. First item becomes the thumbnail (used for Family Chart avatars). Frontmatter is updated automatically on drop.

- **Freeze media gallery to callout** - Click the freeze button (❄️) to convert a dynamic media gallery to a static `[!info|cr-frozen-gallery]` callout with embedded image links.

- **Media gallery Style Settings** - Gallery appearance (gap, max height/width, border radius, object-fit) customizable via the Style Settings plugin.

- **Media folder filtering** - New settings to specify which folders to scan for media files. Used by Find Unlinked Media, Media Manager stats, and Media Picker.

### Changed

- **Import wizards include media blocks** - When "Include dynamic blocks" is enabled, imported person notes now include all three block types (timeline, relationships, media). Media blocks are included with `editable: true` by default.

- **Insert dynamic blocks includes media** - Context menu action and bulk folder operation now add the media block alongside timeline and relationships blocks.

### Fixed

- **ESLint compliance** - Fixed all non-sentence-case ESLint errors for Obsidian plugin review compliance: async functions without await, misused promises in event handlers, floating promises, unused variables, and TFile cast issues.

---

## [0.14.0] - 2025-12-21

### Added

- **Visual Tree Charts** - Generate printable PDF tree diagrams with positioned boxes and connecting lines. Four chart types available: Pedigree (ancestors), Descendant, Hourglass (both directions), and Fan Chart (semicircular).

- **Recent Files tracks created notes** - Notes created via Dashboard quick-action tiles (Person, Event, Source, Place) now immediately appear in the Recent Files section.

- **Unified Tree Wizard** - Single wizard for both Canvas and PDF tree generation. Dynamic step flow branches based on output format selection. Replaces the previous separate wizards for a streamlined experience.

- **Visual Trees section in Statistics Dashboard** - Dedicated section for visual tree PDF generation, separate from text-based reports. Features card-based UI with custom tree icons for each chart type.

- **Custom tree icons** - Four new SVG icons registered with Obsidian: `cr-pedigree-tree`, `cr-descendant-tree`, `cr-hourglass-tree`, `cr-fan-chart`. Used across Statistics View, Report Generator, and Tree Wizard.

- **Visual Tree PDF options** - Page size (Letter, A4, Legal, Tabloid, A3), orientation (portrait/landscape), node content (name only, with dates, with dates and places), color schemes (default, grayscale, generational), and large tree handling (auto-scale, auto-page-size, limit-generations).

- **Tree type badges in wizard** - Chart type shown as badge in step headers after selection for clear context during wizard navigation.

### Changed

- **Statistics Dashboard reorganized** - Visual Trees now has its own expandable section at the top, separate from the Generate Reports section. Clearer separation between graphical tree outputs and text-based reports.

- **Report categories updated** - Added `visual-trees` category to report metadata. Visual tree reports filtered from main Reports section and moved to dedicated Visual Trees section.

---

## [0.13.6] - 2025-12-20

### Added

- **Control Center Dashboard** - Transformed the Status tab into a Dashboard with quick-action tiles for mobile-friendly access to common operations. Features 9 tiles (Person, Event, Source, Place, Report, Statistics, Import, Tree Output, Map), collapsible Vault Health section, and Recent Files list.

- **Dashboard quick-action tiles** - One-tap access to create entities and open views. 3×3 grid on desktop, 2×2 on mobile for touch-friendly tap targets.

- **Recent Files section** - Shows last 5 accessed genealogical files with entity type badges. Click to open, right-click for context menu with type-specific actions.

- **Recent Files context menu** - Right-click recent items for type-specific actions:
  - All types: "Open note"
  - Place: "Open in Map View" (zooms to coordinates if available)
  - Person: "Open in Family Chart"

- **First-run welcome notice** - Dismissible welcome message for new users orienting them to the renamed Dashboard tab (formerly Status).

- **Recent file tracking service** - New `RecentFilesService` tracks file access via Canvas Roots features (People tab "Open" button, create modals). Stores up to 5 recent files in settings.

---

## [0.13.5] - 2025-12-20

### Added

- **Extended report types** - Six new report types expanding beyond traditional genealogical reports: Source Summary (per-person source documentation), Timeline Report (chronological events), Place Summary (location-focused), Media Inventory (media with entity links), Universe Overview (fictional world stats), and Collection Overview (user collection summary).

- **Report category selector** - Reports are now organized into categories (Genealogical, Research, Timeline, Geographic, Summary) for easier discovery in the Generate Report modal.

- **PDF custom title options** - Override default report titles with custom text. Control title scope: cover page only, headers only, or both.

- **PDF custom subtitle** - Add subtitle text below the main title on cover pages.

- **PDF cover notes** - Add extended notes section to cover pages for additional context or instructions.

- **PDF date format option** - Choose between MDY (12/20/2025), DMY (20/12/2025), or YMD (2025-12-20) for dates in generated PDFs. Dropdown shows example dates using today's date for clarity.

---

## [0.13.4] - 2025-12-20

### Added

- **PDF report export** - Export all 7 report types (Ahnentafel, Family Group Sheet, Individual Summary, Gaps Report, Register Report, Pedigree Chart, Descendant Chart) as professionally styled PDF documents. PDFs are generated locally with no internet connection required.

- **PDF page size option** - Choose between A4 and Letter page sizes when exporting to PDF.

- **PDF cover page** - Optional title page with report name, subject name, generation date, and plugin branding. Enable via "Include cover page" toggle in PDF options.

- **PDF logo/crest support** - Add a custom logo or family crest to PDF cover pages. Images are automatically resized to reduce file size while maintaining quality.

---

## [0.13.3] - 2025-12-19

### Added

- **Context-specific person picker titles** - The person picker modal now shows context-aware titles and subtitles based on the action being performed. When assigning reference numbers, users see clear explanations like "This person will be #1; ancestors are numbered upward" for Ahnentafel or "This person will be generation 0" for generation numbering.

### Fixed

- **Source media linker dropdown styling** - Fixed dropdown styling conflict in the "Link media to existing sources" wizard. The dropdown now uses Obsidian's native styling, avoiding conflicts with themes, snippets, and GTK styling on Linux.

### Changed

- **Guide tab card footer links** - Restyled documentation links at the bottom of Guide tab cards to use consistent separator styling matching the "View full statistics" pattern elsewhere.

### Removed

- **Dead GEDCOM v1 importer code** - Removed ~600 lines of dead code from the legacy GEDCOM importer that was superseded by the v2 streaming implementation.

---

## [0.13.2] - 2025-12-19

### Added

- **Place linking for birth/death locations** - The Create Person modal now supports linking birth and death places to existing place notes, using the same pattern as family relationships. Click "Link" to open a place picker that searches all place notes, with options to filter by category. If the place doesn't exist, click "Create new place" to create it on-the-fly. Places are stored with dual fields (birth_place + birth_place_id) for reliable resolution.

---

## [0.13.1] - 2025-12-18

### Added

- **Family Chart horizontal orientation** - New option in Layout menu to switch between vertical (top-to-bottom) and horizontal (left-to-right) tree layouts.

- **Family Chart depth limits** - Control how many generations are displayed with new Depth menu. Set ancestry depth (1-5 generations or unlimited) and descendant depth independently.

- **Family Chart display options** - New Display menu with visibility controls:
  - Show/hide siblings of root person
  - Show unknown parent placeholder cards
  - Sort children by birth date
  - Hide living persons (privacy mode for people without death dates)

- **Family Chart toolbar reorganization** - Split the Layout menu into three focused menus: Layout (orientation, spacing), Display (card options, visibility), and Depth (generation limits).

### Improved

- **Reference numbers modal polish** - Redesigned the "Assign reference numbers" modal with icons, clearer descriptions explaining what each system is best for, person count preview, and Learn more link to documentation.

### Fixed

- **Family Chart info panel not resetting** - Fixed bug where the info panel continued showing the previous person's details when switching root person via context menu.

- **Reference numbers prompt after all imports** - Fixed inconsistency where GEDCOM 5.5.1 and CSV imports did not offer to assign reference numbers after import. All import types (GEDCOM, GEDCOM X, Gramps, CSV) now consistently show the "Assign reference numbers" prompt after successful imports.

---

## [0.13.0] - 2025-12-18

### Added

- **Universe management** - First-class universe notes for organizing fictional worlds. Create universes via the Universe Wizard with optional custom calendars, maps, and validation schemas. Universe notes track metadata (name, author, genre, status) and link related entities.

- **Universe notes card** - New table-based UI in Control Center > Universes tab matching the Person notes pattern. Features filter dropdown (all/active/draft/archived/has-entities/empty), sort dropdown (name/created/entities), search input, and row interactions (click to edit, file icon to open, right-click context menu).

- **Orphan universe detection** - Automatic detection of universe values referenced by entities but lacking corresponding universe notes. Create notes directly from the orphan list with matching cr_id to preserve entity references.

- **Universes base template** - New Universes base template available in Control Center > Guide and Control Center > Bases for spreadsheet-like universe management.

- **Universe folder context menu** - Right-click the configured Universes folder for quick access to create universe, set folder as universes folder, and add essential universe properties to notes.

- **Folder-type specific context menus** - Context menu actions now adapt to folder type. People folder shows GEDCOM import and relationship scan; Places folder shows geocoding actions; Universes folder shows universe-specific actions; etc.

- **Create all bases button** - New "Create all bases" button in Control Center > Guide > Base templates card creates all six base files (people, places, events, organizations, sources, universes) at once.

- **Auto-create bases on import** - Bases are automatically created after GEDCOM, GEDCOM X, and Gramps imports, making imported data immediately viewable in Obsidian's Bases feature.

### Changed

- **ESLint upgrade to v9 flat config** - Migrated from ESLint v8 legacy config to v9 flat config with `eslint-plugin-obsidianmd` for Obsidian-specific linting rules.

- **Statistics tab universes card** - Redesigned with Setting-style layout showing universe names with entity counts on left, Open buttons on right.

### Fixed

- **Edit universe button** - Control Center > Universes tab Edit button now opens EditUniverseModal instead of just opening the file.

- **Delete universe action** - Added delete universe option to file context menus with confirmation dialog.

- **Data quality analysis TypeError** - Fixed crash when analyzing data with non-string date values (e.g., from Gramps XML imports). parseYear and isStandardDateFormat now handle number and unknown types.

- **Code quality improvements** - Fixed 71 ESLint errors/warnings including inline style assignments (now using CSS classes), type safety issues, unused directives, and deprecated API usage.

- **People base filename** - Changed default filename from `family-members.base` to `people.base` to match the button label and be consistent with other base filenames.

---

## [0.12.14] - 2025-12-17

### Changed

- **Family chart info panel** - Replaced the hidden edit mode toggle with a dedicated info panel that opens when clicking any person card. The panel shows person details in read-only mode with an explicit "Edit" button to switch to edit mode. Includes clickable relationship links to navigate between family members.

### Fixed

- **Family chart zoom preserved on card click** - Clicking a person card no longer resets the zoom level and re-centers the view. The current view is preserved when opening the info panel.

---

## [0.12.13] - 2025-12-17

### Added

- **Log export button** - New "Export logs" button in Developer settings allows saving the current session log to a file with optional obfuscation of personal data.

### Fixed

- **Duplicate children_id during Gramps import** - Fixed a race condition where bidirectional sync added relationship IDs while import was still in progress, causing duplicate `children_id` entries. Now all import operations (Gramps, GEDCOM, GEDCOM X, CSV) disable bidirectional sync during the import process.

---

## [0.12.12] - 2025-12-17

### Added

- **Configurable sex normalization** - New setting in Preferences to control how "Normalize sex values" behaves: Standard (GEDCOM M/F), Schema-aware (respects custom sex enum values defined in schemas), or Disabled (never normalize). Schema-aware mode allows worldbuilders to protect custom sex values like "hermaphrodite" or "neuter" from normalization.

- **Universe field in Edit Person modal** - The universe dropdown now appears when editing a person via the file explorer context menu, matching the behavior when editing from the Control Center People tab.

### Changed

- **GEDCOM-standard sex values** - Canonical sex values changed from `male`/`female`/`nonbinary`/`unknown` to GEDCOM-standard `M`/`F`/`X`/`U`. Built-in synonyms automatically map common values (`male`→`M`, `female`→`F`, etc.) without requiring manual configuration.

### Fixed

- **Sex value normalization** - "Normalize sex values" now works out of the box with built-in mappings. Previously required manual value alias configuration to detect any changes.

- **Edit Person modal universe field** - Fixed universe dropdown not appearing when opening Edit Person modal from file explorer context menu. The modal now correctly loads existing universes from both place and person notes.

---

## [0.12.11] - 2025-12-17

### Changed

- **Tree Output tab two-panel layout** - Redesigned Tree Output tab with a two-panel layout: scrollable configuration accordions on the left, sticky preview and generate buttons on the right. Root person picker is now compact with inline radio buttons, names, and dates.

### Fixed

- **Tree Output accordion labels truncating** - Fixed setting labels in accordion sections (like "Tree type") being cut off due to constrained flexbox layout.

- **Statistics tab label wrapping** - Fixed Data completeness card labels wrapping mid-word by adding proper whitespace handling.

---

## [0.12.10] - 2025-12-16

### Added

- **Step & adoptive parent support** - Comprehensive support for non-biological parent relationships, improving GEDCOM import fidelity and enabling accurate representation of blended families.

- **GEDCOM pedigree parsing** - Parse `PEDI` tags (`birth`, `step`, `adop`, `foster`) from GEDCOM files. Step-parents and adoptive parents are imported to dedicated frontmatter fields. Biological parent conflicts are no longer triggered by step/adoptive relationships.

- **Gramps XML pedigree parsing** - Parse `mrel` and `frel` attributes from Gramps `<childref>` elements. Relationship types mapped: `Birth` → biological, `Stepchild` → step-parent, `Adopted` → adoptive parent. Uses the same dedicated frontmatter fields as GEDCOM import.

- **GEDCOM X lineage type parsing** - Parse lineage type facts (`AdoptiveParent`, `StepParent`, `BiologicalParent`, etc.) from GEDCOM X parent-child relationships. Uses the same dedicated frontmatter fields as GEDCOM and Gramps import.

- **Step/adoptive parent export** - Export step-parent and adoptive parent relationships to all three formats. GEDCOM 5.5.1 exports PEDI tags (`step`, `adop`) under FAMC references. Gramps XML exports `mrel`/`frel` attributes (`Stepchild`, `Adopted`) on childref elements. GEDCOM X exports ParentChild relationships with lineage type facts.

- **Canvas tree visualization** - Step-parent relationships shown with dashed lines; adoptive parent relationships shown with dotted lines. New toggles in tree generation: "Include step-parents" and "Include adoptive parents". Relationship labels displayed on non-biological parent edges.

- **Create/Edit Person modal** - New "Step & adoptive parents" section for manual entry of stepfather, stepmother, adoptive father, and adoptive mother.

- **Statistics parent breakdown** - Parent type breakdown in Data Completeness section (biological vs. step vs. adoptive). New quality metrics: "Biologically orphaned" (no biological parents but has step/adoptive) and blended family insights showing count of people with multiple parent types.

- **New frontmatter fields** - `stepfather_id`, `stepmother_id` (arrays for multiple), `adoptive_father_id`, `adoptive_mother_id` with corresponding property aliases.

- **New relationship types** - Built-in `step_parent`, `step_child`, `adoptive_parent`, `adopted_child` relationship types with distinct line styles.

---

## [0.12.9] - 2025-12-16

### Added

- **Family Chart "Open note" button** - Person cards in the Family Chart view now have a small button in the top-right corner that opens the person's note in a new tab. Works in both view and edit modes, providing quick access to notes without changing the card click behavior.

- **Statistics Dashboard** - New workspace view with comprehensive vault metrics including entity counts, data completeness percentages, gender distribution, and date range spanning all entities. Access via Control Center Statistics tab or command palette.

- **Data quality analysis** - Quality section with severity-coded alerts (error/warning/info) for date inconsistencies, missing birth/death dates, orphaned people, incomplete parents, unsourced events, and places without coordinates. All issues are expandable with drill-down to see affected records.

- **Top lists with drill-down** - Interactive lists for top surnames, locations, occupations, and sources. Click any item to expand and see all matching people as clickable chips with right-click context menu and hover preview.

- **Extended statistics** - Demographic analysis including longevity (average lifespan by birth decade and location), family size patterns, marriage patterns (age at marriage by sex, remarriage rates), migration flows (birth-to-death location changes with top routes), source coverage by generation, and timeline density with gap detection.

- **Genealogical reports** - Generate formatted reports from the Statistics Dashboard:
  - **Family Group Sheet** - Single family unit with parents, marriage, and children
  - **Individual Summary** - Complete record of one person with all events and sources
  - **Ahnentafel Report** - Numbered ancestor list (1=subject, 2=father, 3=mother, etc.)
  - **Gaps Report** - Analysis of missing data by category
  - **Register Report** - Descendants with NGSQ-style numbering
  - **Pedigree Chart** - Ancestor tree in markdown format
  - **Descendant Chart** - Descendant tree in markdown format

### Fixed

- **Orphaned people calculation** - Fixed bug where orphaned people count showed negative values due to incorrect subtraction of overlapping sets. Now correctly filters for people with no relationships at all.

---

## [0.12.8] - 2025-12-15

### Added

- **Dynamic content blocks** - New `canvas-roots-timeline` and `canvas-roots-relationships` code blocks that render live, computed content in person notes. Timeline shows chronological events; relationships shows family members with wikilinks. Blocks can be frozen to static markdown via toolbar button.

- **Insert dynamic blocks** - Context menu actions and command palette command to insert dynamic blocks into existing person notes. Includes bulk insert for folders with progress indicator.

- **Dynamic blocks toggle in Create Person modal** - Option to include dynamic blocks when creating new person notes.

- **Dynamic blocks toggle in import wizards** - Option to include dynamic blocks in person notes during GEDCOM/Gramps/CSV import.

### Fixed

- **Family Chart zoom buttons causing NaN%** - Fixed issue where clicking zoom in/out buttons could show "NaN%" and cause the chart to vanish. The `manualZoom` function uses D3's `scaleBy` which multiplies the scale, so zoom in now uses 1.2 (20% larger) and zoom out uses 0.8 (20% smaller) instead of the incorrect additive values. Also added validation to detect invalid zoom state and reset to fit view if needed.

- **Family Chart showing wrong person** - Fixed "Open family chart" command showing a previously loaded person instead of the current note. Now correctly opens with the current note's person, or shows a person picker if no cr_id is found.

- **Family Chart opening in sidebar** - Fixed issue where the chart could open in the sidebar instead of the main workspace. The chart now prefers opening in the main workspace when launched from a person note.

---

## [0.12.7] - 2025-12-15

### Added

- **Gramps source import** - Gramps XML import now creates source notes from `<sources>` and `<citations>` elements. Sources are linked to events via citation references. Includes repository metadata (`repository`, `repository_type`, `source_medium`), media reference handles for manual resolution (`gramps_media_refs`), and Gramps ID preservation (`gramps_handle`, `gramps_id`) for re-import scenarios.

- **Source property aliases** - Added source properties to the property alias system. Users can now customize property names for source notes (e.g., `creator` instead of `author`, `archive` instead of `repository`). Configure in Preferences → Property aliases → Source properties.

- **Gramps import progress indicator** - Gramps XML import now shows a progress modal with phase indicators and running statistics, matching the GEDCOM import experience.

- **Gramps import UI toggles** - Import options now use Obsidian-style toggles for "Create source notes", "Create place notes", and "Create event notes" with descriptions and destination folders.

- **Load testing tools** - Added parameterized GEDCOM generator (`gedcom-testing/generate-loadtest.js`) for creating test files of any size, performance testing documentation, and xxxlarge sample file (7,424 people) for stress testing.

### Changed

- **Unified Age formula in People base template** - Replaced separate `full_lifespan` and `age_now` formulas with a single intelligent `age` formula. Shows current age for living people, lifespan for deceased, and "Unknown" for people exceeding the configurable age threshold (set in Preferences → Privacy & Export). Living/Deceased view filters also use this threshold to categorize people without death dates.

### Fixed

- **Gramps XML import for compressed .gramps files** - Added support for importing gzip-compressed `.gramps` files exported from Gramps 6.x. The importer now automatically detects and decompresses gzip-compressed files. Previously, importing `.gramps` files would fail with "file does not appear to be a valid Gramps XML file" because the compressed binary data was not recognized as XML.

- **Family Chart "child has more than 1 parent" error** - Fixed crash when opening Family Chart after importing data with parent-child relationship inconsistencies. The chart now validates bidirectional relationships, only including children who explicitly reference the parent back. This handles cases where a parent's `child` field lists someone who doesn't list them as father/mother.

- **Family Chart refresh delay** - Removed unnecessary 2-second delay when chart updates from live note changes.

- **Duplicate relationship entries** - Added deduplication for `children_id` and `spouse_id` arrays to handle frontmatter with duplicate entries.

- **Duplicate child/children property after Gramps import** - Fixed inconsistent property naming where Gramps import created `child` property but bidirectional linking and data quality tools used `children`. All components now consistently use the canonical `child` property name for wikilinks (with `children_id` for cr_ids). Also fixed Gramps importer using `child_id` instead of `children_id`.

---

## [0.12.5] - 2025-12-14

### Added

- **Source Image Import Wizard** - New wizard in Sources tab (`Import` button) for bulk-importing source images. Parses filenames to extract metadata (surnames, years, record types, locations), shows confidence indicators, and creates source notes with media wikilinks attached. Supports multi-part document grouping for census pages and other multi-page records.

- **Source Media Linker Wizard** - New wizard in Sources tab (`Link` button) for attaching images to existing source notes that don't have media. Features smart suggestions with confidence scoring based on filename analysis, auto-selection of top matches, "+N more" badges showing alternative suggestions, and row highlighting for files needing manual selection.

- **Filename parser service** - New `ImageFilenameParser` service extracts metadata from common genealogy naming patterns (`surname_year_type`, `surname_given_byear_type`, descriptive names). Recognizes record type keywords (census, birth, death, marriage, military, immigration, obituary, etc.) and multi-part indicators (`_p1`, `_a`, `_page1`).

---

## [0.12.2] - 2025-12-14

### Fixed

- **Bases Lifespan formula error** - Fixed "Cannot find function 'year' on type Date" error in the Lifespan calculated property. Changed formula syntax from `.year()` method to `(date1 - date2).years.floor()` duration syntax which is correct for Obsidian Bases.

- **Bases Living/Deceased members views** - Fixed "Living members" and "Deceased members" views showing incorrect results when the `died` property exists but is empty. Changed filter from negation syntax to `isEmpty()` function which correctly handles both missing and empty property values. Added `name` to the view's `order` field so the Name column displays.

---

## [0.12.1] - 2025-12-14

### Changed

- **Family chart opens in main workspace** - "Open in family chart" now opens as a new tab in the main workspace instead of the sidebar, providing more screen space for viewing complex trees.

- **Context menu reorganization** - Moved "Open in family chart" into the "Generate tree" submenu for person notes, grouping all tree visualization options together. A separator distinguishes the interactive view from file-generating options.

### Fixed

- **cr_id prefix bug in context menu** - Fixed "Add essential place properties" and "Add essential event properties" context menu actions incorrectly adding `place_` or `event_` prefixes to generated cr_id values. The cr_type field already identifies the note type, so cr_id should be a plain UUID format.

- **Tree preview UI freeze on large trees** - Disabled tree preview for trees with more than 200 people to prevent UI freeze. Large trees show a notice with the count and recommendation to generate the canvas directly instead.

- **Canvas generation freeze on large trees** - Trees with more than 200 people now automatically use the D3 hierarchical layout instead of family-chart to prevent UI freeze. Spouse positioning may be less accurate for very large trees, but the canvas will generate successfully.

- **Canvas files not using configured folder** - Generated canvas files now correctly use the "Canvases folder" setting from Preferences. Previously, canvases were created in the vault root instead of the configured folder.

- **Excalidraw files created in wrong folder** - Exported Excalidraw files are now saved to the vault root instead of the source file's parent folder (e.g., People folder). This applies to canvas-to-Excalidraw exports, timeline exports, and person-to-Excalidraw exports.

---

## [0.12.0] - 2025-12-14

### Added

- **Calendarium integration (Phase 1)** - Canvas Roots can now import calendar definitions from the [Calendarium](https://github.com/javalent/calendarium) plugin. When Calendarium is installed and enabled, an "Integrations" card appears in Control Center Preferences with a toggle to enable read-only calendar import. Imported calendars appear in the "From Calendarium" section of the Date Systems card and can be selected when creating events with fictional dates. This eliminates the need to manually recreate calendar systems that are already defined in Calendarium.

### Changed

- **Stricter ESLint rules** - Added `await-thenable`, `no-base-to-string`, `no-console`, `no-case-declarations`, and `no-constant-condition` rules. Fixed all violations across the codebase.

---

## [0.11.9] - 2025-12-13

### Fixed

- **GEDCOM import race condition with BidirectionalLinker** - Fixed race condition where the BidirectionalLinker would modify files during Phase 1 of import before Phase 2 could replace GEDCOM IDs with cr_ids. The linker is now suspended during import and resumed after completion.

- **GEDCOM import regex substring matching** - Fixed ID replacement where shorter IDs (e.g., `I2`) would match within longer IDs (e.g., `I27`), causing corrupt cr_id formats like `jvc-874-coq-7457`. Replacements are now sorted by length (descending) with lookahead assertions to prevent partial matches.

- **GEDCOM import children_id not replaced in Phase 2** - Fixed missing children_id replacement during relationship update phase. Child references from family records are now collected and replaced alongside parent/spouse IDs.

- **GEDCOM import duplicate name corruption** - Fixed post-import relationship sync corrupting data when importing files with duplicate names (e.g., two "John Smith" people). The sync matched by filename rather than cr_id, causing relationship data to merge incorrectly. GEDCOM data already contains complete bidirectional relationships, so the sync is now skipped.

- **Data quality: corrupt cr_id detection** - Added validation for cr_id format (xxx-123-xxx-123) in orphan reference checks. Invalid formats are now flagged as errors to catch import corruption.

---

## [0.11.8] - 2025-12-13

### Fixed

- **Base templates: columns not visible by default** - Fixed an issue where Obsidian Bases templates for Events, Sources, Organizations, and Places did not display columns by default. The templates had `sort` (which controls sorting direction) but were missing `order` (which controls visible columns). Added `order` arrays to the first view in each template specifying which columns to display.

- **Descendant tree canvas export missing edges** - Fixed a bug where descendant tree canvas exports had no connecting arrows between person cards. The `buildDescendantTree()` function was creating edges with `type: 'child'` which were filtered out by the canvas generator (which skips child edges to avoid duplicates). Changed edge type to `'parent'` so edges are properly included in the export.

---

## [0.11.7] - 2025-12-12

### Added

- **Context menu for person links in Parent claim conflicts** - Right-click on person names in the Parent claim conflicts table to open in new tab or new window.

---

## [0.11.6] - 2025-12-12

### Fixed

- **GEDCOM import: children_id not replaced with cr_id values** - Fixed missing `children_id` replacement logic in `gedcom-importer.ts` and incorrect field name (`child_id` instead of `children_id`) in `gedcomx-importer.ts`. Now all relationship ID fields are properly replaced during import.

---

## [0.11.5] - 2025-12-12

Obsidian plugin review fixes (Round 12) and GEDCOM import bug fix.

### Fixed

- **GEDCOM import: parent IDs not replaced for duplicate names** - Fixed an issue where `father_id`, `mother_id`, `spouse_id`, and `children_id` properties retained GEDCOM IDs (e.g., `I2060`) instead of being replaced with `cr_id` values when importing people with duplicate names. The issue occurred because the relationship update phase looked for files by regenerating the filename, which didn't account for numeric suffixes added to handle duplicates (e.g., `John Smith 1.md`). Now tracks actual file paths during creation and uses them for relationship updates. Fixed in all three importers: `gedcom-importer.ts`, `gedcom-importer-v2.ts`, and `gedcomx-importer.ts`.

### Changed

- **PR review compliance (Round 12)** - Addressed all required items from Obsidian plugin review:
  - Fixed 27 floating promises by adding `void` or `await` as appropriate
  - Fixed lexical declaration in case block by wrapping in braces
  - Fixed `element.style.visibility` usage to use `setCssStyles()` instead
  - Removed `async` keyword from 4 methods that didn't use `await`
  - Added defensive object handling in YAML serialization to prevent `[object Object]`
  - Analyzed 449 sentence case flags - all determined to be false positives (proper nouns, product names, already sentence case)

- **PR review optional items** - Cleaned up deprecated code:
  - Removed unused template exports (`BASE_TEMPLATE`, `PLACES_BASE_TEMPLATE`, `EVENTS_BASE_TEMPLATE`)
  - Replaced `Vault.delete()` with `FileManager.trashFile()` to respect user preferences
  - Removed unused variables and function definitions

---

## [0.11.4] - 2025-12-12

Obsidian plugin review fixes (Round 11) and bug fixes.

### Changed

- **PR review compliance** - Addressed all required and optional items from Obsidian plugin review:
  - Replaced direct `style.x =` assignments with `style.setProperty()` for CSP compliance
  - Wrapped async event handlers with `void (async () => {...})()` pattern to handle floating promises
  - Removed unused imports across the codebase

### Fixed

- **Person picker showing non-person notes** - Fixed the "Select person" modal (used when linking Father/Mother/Spouse in Create Person) incorrectly listing place, event, and source notes alongside person notes

- **Timeline callout vertical line alignment** - Fixed the vertical line in markdown timeline exports not aligning with the dot markers

- **People base showing non-person notes** - Fixed the "Create People base" template including place, event, and source notes in the family members view

- **Events base template not working** - Rewrote the Events base template to use correct Obsidian Bases syntax (matching the working People base template structure). Added formulas for date formatting and duration calculations

- **Improved "Create base" button descriptions** - Updated descriptions for People, Events, Places, and Sources base buttons to explain that users need to click "Properties" after creating to enable additional columns

### Docs

- **Guide tab cleanup guidance** - Added post-import cleanup content to the Guide tab:
  - New "After importing" card with quick 4-step workflow overview
  - Added "Post-import cleanup" to Key Concepts section
  - Added "Clean up data" to Common Tasks grid

- **Data Quality wiki** - Added "Post-Import Cleanup Workflow" section with recommended 8-step sequence and tool locations

- **Roadmap** - Added "Post-Import Cleanup Wizard" as high-priority planned feature

---

## [0.11.3] - 2025-12-12

GEDCOM Import: Pre-import data quality preview with place name standardization, plus Control Center UI consistency improvements.

### Added

- **GEDCOM import data quality preview** - New pre-import analysis step that catches issues before any files are created:
  - Detects date issues (death before birth, future dates, events before/after death)
  - Identifies relationship issues (gender/role mismatches, parent younger than child)
  - Flags orphan references to non-existent records
  - Shows data completeness issues (missing names, unknown sex, no dates)
  - **Place name variant standardization** during import - choose canonical forms for country names (USA vs United States) and state abbreviations (CA vs California) before files are created
  - Choices affect both file names and frontmatter property values
  - Preview modal with tabbed interface organized by issue category

- **Standardize place name variants** (Places tab) - New data quality tool for post-import standardization of common place name abbreviations and alternate forms
  - Country variants: "United States of America", "United States", "US" → "USA"
  - US state abbreviations: "California" → "CA", "New York" → "NY"
  - Bulk selection of canonical forms with one-click apply

- **Actions cards consistency** - Reorganized control center tabs for consistent Actions-first layout:
  - **Events tab**: Renamed "Event notes" card to "Actions", added "Create Events base" and "Templater templates" actions
  - **People tab**: Added "Create People base" action to existing Actions card
  - **Places tab**: New "Actions" card at top with "Create place note", "Templater templates", and "Create Places base" actions
  - Moved "Normalize place name formatting" from Batch operations to Data quality > Other tools

- **Data Quality wiki page** - New comprehensive documentation covering all data quality tools, batch operations, and best practices

- **Comprehensive GEDCOM edge case test file** - New test file `gedcom-testing/gedcom-sample-medium-edge-cases.ged` with 50+ intentional data quality issues for stress testing:
  - Duplicate names without distinguishing data
  - Multiple parents claiming the same child
  - Impossible dates (death before birth, future dates, parent younger than child)
  - Sex/gender conflicts with family roles
  - Circular ancestry relationships
  - Orphan references to non-existent records
  - Special characters in names (Irish, Spanish, Chinese)
  - Date format variations (ABT, BEF, AFT, ranges, question marks like "1850?")
  - Place name variations, typos, and special characters
  - Source issues (duplicates, missing titles)
  - Family issues (empty families, multiple spouses)

- **Standardize place types modal** (Places tab) - New data quality tool to convert generic place types like "locality" to standard types (city, town, village)
  - Detects places with non-standard types from GEDCOM imports
  - Bulk actions to set all places to the same type
  - Individual type selection with one-click apply
  - Shows parent place context for better decision making

- **Place notes table open buttons** - Added separate buttons to open place notes in new tab or new window

### Changed

- **Places tab reorganization** - Reordered cards to prioritize actionable content: Data quality first, then Place notes table, then Statistics last
- **Place statistics card** - Now shows compact summary with collapsible detailed statistics (categories, top places, migration patterns)
- **Removed Referenced places card** - Consolidated into Data quality card's "Missing place notes" section to reduce redundancy

### Fixed

- **Tree output root person picker showing non-person notes** - Fixed person browser in Control Center > Tree output tab listing events, sources, and places instead of only person notes

- **Remove placeholder values treating empty/null as issues** - The batch operation now only flags actual placeholder text ("Unknown", "N/A", "???", etc.) and no longer treats null/undefined/empty properties as problems

- **Enrich place hierarchy modal preview list** - Modal now shows which places will be enriched before starting

- **Top-level places incorrectly listed as orphans** - Countries and regions without parents (Taiwan, South Korea, etc.) are no longer flagged for hierarchy enrichment

- **Duplicate place detection mismatch** - Data quality card count now matches what the merge modal actually finds

---

## [0.11.2] - 2025-12-11

Data Quality: Parent conflict resolution, settings UX overhaul, and bidirectional relationship fixes.

### Added

- **Parent claim conflicts card** (People tab) - New dedicated card for resolving conflicting parent claims
  - Automatically detects children claimed by multiple parents on tab load
  - Table shows child, conflict type, both claimants with cr_id for disambiguation
  - Per-row "Keep 1" / "Keep 2" buttons for quick resolution
  - Clicking names opens the corresponding note
  - Conflicts removed from bidirectional fix modal (now handled separately)

- **Settings UX overhaul** - Major improvements to both Plugin Settings and Preferences tab
  - **Search**: Filter settings by name or description in Plugin Settings
  - **Collapsible sections**: Plugin Settings organized into expandable groups (Data & Detection, Privacy & Export, Research Tools, Logging, Advanced)
  - **Sliders**: Numeric settings (spacing, node dimensions) now use sliders with reset buttons
  - **Folder autocomplete**: Folder settings suggest existing vault folders as you type
  - **Bidirectional navigation**: Links between Plugin Settings and Preferences tab for easy discovery
  - **Reduced duplication**: Canvas layout and folder settings consolidated in Preferences only
  - **Default change**: `primaryTypeProperty` now defaults to `cr_type` (avoids conflicts with other plugins)

- **GEDCOM import now adds `cr_type: person`** to imported person notes for consistent note type detection

- **`cr_type` now an essential property** - Added to Guide tab documentation, "Insert essential properties" context menu action, and base template filter for consistent note detection

### Fixed

- **Family chart view only showing ancestors** - Fixed issue where the interactive family chart only displayed the direct ancestral line instead of the complete tree
  - Chart now properly shows descendants, siblings, and in-laws
  - Root cause: missing bidirectional children relationships in data transformation

- **Places tab crash with non-string place values** - Fixed TypeError when place properties contain arrays or objects instead of strings

- **GEDCOM import nested arrays for wikilinks** - Fixed YAML serialization writing `[[place]]` as nested arrays; wikilink values are now properly quoted

- **Map view not showing markers** - Fixed map not recognizing flat coordinate properties (`coordinates_lat`, `coordinates_long`) written by geocoding; now supports nested, flat, and legacy coordinate formats

- **Bidirectional relationship validation** - Fixed false positives and persistence issues
  - Now validates parent sex matches expected parent type (male → father, female → mother)
  - Prevents incorrect fixes like setting female as father_id or male as mother_id
  - Resolves issue where spouses with children in their children_id array were incorrectly flagged
  - Fixed issue where automatic bidirectional linker was reverting batch fix changes
  - Batch fix operation now suspends automatic linking during updates to prevent interference

---

## [0.11.1] - 2025-12-10

Data Quality: Enhanced batch operations with relationship validation, value normalization, and improved organization.

### Added

- **Bidirectional relationship validation** (People tab) - Detect and fix one-way relationship inconsistencies
  - Finds missing reciprocal links: parent lists child but child doesn't list parent, spouse A lists B but B doesn't list A
  - Supports both simple (spouse, children) and indexed (spouse1, spouse2) properties
  - Preview modal with search, type filtering, and sorting
  - Apply button to automatically fix inconsistencies
  - Validates parent fields aren't already occupied before adding

- **Impossible dates detection** (People tab) - Preview-only validation to find logical date errors
  - Birth after death
  - Unrealistic lifespans (>120 years)
  - Parent born after child
  - Parent too young at child's birth (<10 years)
  - Posthumous births (>12 months for father, any for mother)
  - Handles various date formats: ISO (YYYY-MM-DD), partial dates (YYYY-MM, YYYY), circa dates, date ranges
  - Preview modal with search, type filtering, and sorting
  - Manual correction workflow to prevent data corruption

### Improved

- **Sex value normalization** - Now uses value alias system instead of hardcoded M/F logic
  - Respects user-configured value aliases (Control Center > Schemas > Value aliases)
  - Supports worldbuilders with custom sex values (e.g., "H" → "hermaphrodite")
  - Only normalizes values that have configured mappings
  - Skips values already in canonical form

- **Data quality organization** - Reorganized tools for better discoverability
  - **Quick Start card** (Data Quality tab): Navigation links to People, Places, and Schemas tabs with clear guidance
  - **Navigation guidance** (People tab, Places tab): Clickable links to Data Quality tab
  - **Section restructuring** (Data Quality tab): "Vault-wide analysis" and "Cross-domain batch operations" for clarity
  - **Removed duplication**: Removed duplicate "Remove orphaned cr_id references" operation from People tab
  - Domain-specific tools (People, Places) kept in respective tabs for convenience

- **Places tab batch operations** - Updated button alignment to match Obsidian settings pattern
  - Converted to Obsidian's `Setting` component for proper right-alignment
  - Consistent with People tab styling

- **Batch operation modals** - Improved user feedback and clarity
  - Modals now close immediately after applying changes (avoiding stale cache display)
  - Shows "Applying changes..." message during execution
  - Success/failure notices appear after completion
  - Applies to: Remove duplicates, Remove placeholders, Normalize names, Remove orphaned references, Add cr_type property, and Bidirectional validation

- **Bidirectional relationship preview** - Enhanced modal descriptions to clearly show what will be changed
  - Action-oriented descriptions: "Will add X to Y's field_name"
  - Explicitly shows which field will be modified (children_id, father_id, mother_id, spouse_id)
  - Includes context about existing relationship
  - Example: "Will add Aaron Seymour to Calvin Seymour's children_id (Aaron Seymour lists them as father)"

### Fixed

- **Remove empty/placeholder values** - Fixed false positives in preview modal
  - Preview was checking non-existent frontmatter fields, causing `isPlaceholder(undefined)` to return true
  - Added field existence checks before placeholder validation for place fields, relationship fields, and parent fields
  - Preview now accurately reflects what will actually be removed

---

## [0.11.0] - 2025-12-10

Export v2: Complete overhaul of export functionality with full entity support and round-trip fidelity.

### Added

- **Batch Operations for Data Cleanup** - New batch operations in People and Places tabs for post-import data quality improvements
  - **Remove duplicate relationships** (People tab): Detects and removes duplicate entries in spouse, spouse_id, children, and children_id arrays
    - Preview modal with search, field filtering, and sorting
    - Shows affected files and counts before applying
    - Async operation with progress notices
  - **Remove empty/placeholder values** (People tab): Cleans up common placeholder values from GEDCOM imports and data entry
    - Removes 15+ placeholder patterns: (unknown), Unknown, N/A, ???, Empty, None, etc.
    - Fixes malformed wikilinks with mismatched brackets: `[[unknown) ]]`
    - Cleans leading commas in place values: `, , , Canada` → `Canada`
    - Removes empty parent/spouse fields
    - Preview modal with use case descriptions, search, filtering, and sorting
    - Backup warning before applying changes
  - **Normalize name formatting** (People tab): Standardizes person names to proper title case
    - Capitalizes first letter of each name part
    - Preserves special cases: "van", "de", "von" prefixes and hyphenated names
    - Preview modal with search and sorting
  - **Remove orphaned cr_id references** (People tab): Removes cr_id references in relationship arrays where the target note no longer exists
    - Checks father_id, mother_id, spouse_id, children_id arrays
    - Preview modal shows which references will be removed
  - **Standardize place names** (Places tab): Normalizes place names to proper title case
    - Handles comma-separated hierarchies (e.g., "london, england" → "London, England")
    - Preserves special formatting for hyphenated place names
    - Preview modal with search and sorting
  - **Validate date formats** (People tab): Checks all date fields for format issues based on configurable validation preferences
    - **Configurable validation standards** (Control Center > Preferences > Date Validation):
      - ISO 8601: Strict YYYY-MM-DD format
      - GEDCOM: DD MMM YYYY format (e.g., 15 JAN 1920)
      - Flexible: Accepts both ISO 8601 and GEDCOM formats (default)
    - **Validation options**: Allow partial dates (YYYY-MM, YYYY), circa dates (c. 1850), date ranges (1850-1920), optional leading zeros
    - **Fictional date support**: Automatically skips notes with fc-calendar property
    - **Preview-only validation**: Reports issues without auto-correction to prevent errors
    - Preview modal with search, field filtering, and sorting

### Fixed

- **Tab navigation highlighting**: Fixed tab highlighting not updating when navigating between Control Center tabs via links
  - Links in Preferences tab now properly highlight destination tab
  - Applies to all cross-tab navigation links

- **Scroll position reset**: Fixed scroll position persisting when switching between Control Center tabs
  - All tabs now start at the top when switching
  - Improves navigation UX and prevents confusion

### Improved

- **Date Validation card**: Added clickable link to Events tab where fictional date systems are defined
  - Improves discoverability of fictional date system configuration
  - Link properly updates tab highlighting and scroll position

---

## [0.11.0] - 2025-12-10

Export v2: Complete overhaul of export functionality with full entity support and round-trip fidelity.

### Added

- **Export v2: Full Entity Export** - Major upgrade to all export formats with complete data fidelity
  - **Event export**: All life events (birth, death, marriage, residence, education, military, etc.) now export to GEDCOM, GEDCOM X, Gramps, and CSV formats
  - **Source export**: Source notes with citations, repositories, and confidence levels
  - **Place export**: Place hierarchy, coordinates, and categories preserved across all formats
  - **Property alias integration**: Exporters now respect user-configured property names and values
  - **Gender identity field**: New `gender_identity` field exported appropriately for each format
  - **Custom relationships**: Export custom relationships (godparent, witness, guardian, legal, professional, social, feudal) as GEDCOM ASSO records with RELA descriptors, date ranges, and notes

- **Enhanced Export UI** - Complete redesign of export interface with real-time feedback
  - **Export statistics preview**: Real-time count of people, events, sources, places to be exported
  - **Format version selector**: Choose GEDCOM 5.5.1 (legacy compatibility) or 7.0 (future-ready)
  - **Entity inclusion toggles**: Granular control over which entity types to include
  - **Output location options**: Download to system or save to vault folder
  - **Export progress modal**: Full-screen progress tracking with detailed phase information
  - **Last export info**: Display information about previous exports from vault
  - **Consolidated UI components**: Shared ExportOptionsBuilder reduces code duplication across formats

- **Round-trip fidelity**: Exports now preserve all data imported via GEDCOM Import v2
  - Event dates with precision modifiers (exact, estimated, before, after, range)
  - Source citations linked to events with page numbers and confidence levels
  - Place hierarchy with coordinates
  - Privacy protection with configurable display formats

---

## [0.10.20] - 2025-12-10

Phase 1 of Sex/Gender Identity Expansion: distinct gender identity field support.

### Added

- **Gender identity field**: Added `gender_identity` property for person notes, distinct from biological `sex`
  - Separate from `sex` field (used for GEDCOM compatibility and historical records)
  - Separate from `gender` field (kept for backwards compatibility)
  - Supports inclusive tracking of gender identity for trans individuals and contemporary use cases
  - Included in property alias system with full metadata
  - Documented in Frontmatter Reference wiki

### Documentation

- **Sex/Gender Identity Expansion Phase 1 complete**: Updated planning docs and roadmap
  - Phase 1 (gender_identity field): Complete (v0.10.20)
  - Phase 2 (Schema-based definitions): Already complete (existing Schema system)
  - Phase 3 (Value Aliases for sex): Already complete (v0.9.4, enhanced v0.10.19)
  - Phase 4 (Configurable normalization): Planned

---

## [0.10.19] - 2025-12-10

Unified property and value alias configuration UI with improved discoverability and usability.

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
