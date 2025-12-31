# Release History

This document contains detailed implementation documentation for completed Canvas Roots features. For the current roadmap of planned features, see [Roadmap](Roadmap).

For version-specific changes, see the [CHANGELOG](../CHANGELOG.md) and [GitHub Releases](https://github.com/banisterious/obsidian-canvas-roots/releases).

---

## Table of Contents

- [v0.18.x](#v018x)
  - [Cleanup Wizard Phase 4](#cleanup-wizard-phase-4-v01811)
  - [Property Naming Normalization](#property-naming-normalization-v01811)
  - [Custom Map Authoring](#custom-map-authoring-v01810)
  - [Nested Properties Redesign](#nested-properties-redesign-v0189)
  - [Inclusive Parent Relationships](#inclusive-parent-relationships-v0187)
  - [Media Upload and Management Enhancement](#media-upload-and-management-enhancement-v0186)
  - [Timeline Export Consolidation](#timeline-export-consolidation-v0182)
  - [Create Person Enhancements](#create-person-enhancements-v0181)
  - [Event Person Property Consolidation](#event-person-property-consolidation-v0180)
- [v0.17.x](#v017x)
  - [Research Level Property](#research-level-property-v0175)
  - [Excalidraw Export Enhancements](#excalidraw-export-enhancements-v0171)
  - [Post-Import Cleanup Wizard](#post-import-cleanup-wizard-v0170)
  - [Source Array Migration](#source-array-migration-v0170)
  - [Migration Notice](#migration-notice-v0170)
- [v0.16.x](#v016x)
  - [Import/Export Hub](#importexport-hub-v0160)
- [v0.15.x](#v015x)
  - [Visual Tree PDF Quality Improvements](#visual-tree-pdf-quality-improvements-v0153)
  - [Report Wizard Enhancements](#report-wizard-enhancements-v0153)
  - [Report Generator ODT Export](#report-generator-odt-export-v0153)
  - [Calendarium Integration Phase 2](#calendarium-integration-phase-2-v0152)
  - [Family Chart Export Wizard](#family-chart-export-wizard-v0151)
  - [Family Chart Styling Panel](#family-chart-styling-panel-v0151)
  - [Universal Media Linking](#universal-media-linking-v0150)
- [v0.14.x](#v014x)
  - [Visual Tree Charts](#visual-tree-charts-v0140)
- [v0.13.x](#v013x)
  - [Control Center Dashboard](#control-center-dashboard-v0136)
  - [Extended Report Types](#extended-report-types-v0135)
  - [PDF Report Export](#pdf-report-export-v0134)
  - [Universe Management](#universe-management-v0130)
- [v0.12.x](#v012x)
  - [Configurable Normalization](#configurable-normalization-v01212)
  - [Step & Adoptive Parent Support](#step--adoptive-parent-support-v01210)
  - [Statistics & Reports](#statistics--reports-v0129)
  - [Dynamic Note Content](#dynamic-note-content-v0128)
  - [Gramps Source Import](#gramps-source-import-v0126)
  - [Bulk Source-Image Linking](#bulk-source-image-linking-v0125)
  - [Calendarium Integration Phase 1](#calendarium-integration-phase-1-v0120)
- [v0.11.x](#v011x)
  - [Export v2](#export-v2-v0110)
- [v0.10.x](#v010x)
  - [Sex/Gender Identity Fields](#sexgender-identity-fields-v01020)
  - [Unified Property Configuration](#unified-property-configuration-v01019)
  - [Data Enhancement Pass](#data-enhancement-pass-v01017)
  - [Type Customization](#type-customization-v0103)
  - [Flexible Note Type Detection](#flexible-note-type-detection-v0102)
  - [GEDCOM Import v2](#gedcom-import-v2-v0101)
  - [Chronological Story Mapping](#chronological-story-mapping-v0100)
- [v0.9.x](#v09x)
  - [Value Aliases](#value-aliases-v094)
  - [Property Aliases](#property-aliases-v093)
  - [Events Tab](#events-tab-v092)
  - [Style Settings Integration](#style-settings-integration-v091)
  - [Evidence Visualization](#evidence-visualization-v090)
- [v0.8.x](#v08x)
  - [Source Media Gallery & Document Viewer](#source-media-gallery--document-viewer-v080)
- [v0.7.x](#v07x)
  - [Organization Notes](#organization-notes-v070)
  - [Fictional Date Systems](#fictional-date-systems-v070)
  - [Custom Relationship Types](#custom-relationship-types-v070)
- [v0.6.x](#v06x)
  - [Schema Validation](#schema-validation-v063)
  - [Maps Tab](#maps-tab-v062)
  - [Geographic Features](#geographic-features-v060)
  - [Import/Export Enhancements](#importexport-enhancements-v060)

---

## v0.18.x

### Cleanup Wizard Phase 4 (v0.18.11)

User experience refinements for the Post-Import Cleanup Wizard, improving accessibility and feedback during batch operations.

**Features:**

| Feature | Description |
|---------|-------------|
| Batch Progress Indicators | Real-time progress bars during batch operations (Steps 2-6, 10-14) showing current/total count and current file |
| Keyboard Navigation | Full keyboard accessibility: arrow keys for tile selection, Enter/Space to activate, Escape to go back |

**Batch Progress Implementation:**

- Progress callbacks added to all batch methods in `DataQualityService` and migration services
- UI re-renders every 5 items to show progress without excessive updates
- Displays "Processing X of Y notes..." with animated progress bar
- Shows current filename being processed

**Keyboard Navigation Implementation:**

- Arrow keys navigate between tiles on overview screen
- Enter/Space activates focused tile
- Escape returns to overview or closes modal from step view
- ARIA attributes (role, aria-label) for screen reader accessibility
- Visual focus indicators matching hover styles

**Remaining Phase 4 Tasks (Deferred):**

| Task | Status | Notes |
|------|--------|-------|
| Step Reordering | Deferred | Drag-drop tiles with dependency validation |
| Cleanup Profiles | Deferred | Save/load named configurations |
| Step Animations | Deferred | Smooth transitions between views |
| Schema Integration | Deferred | Depends on schema validation feature |

**Documentation:**
- See [Cleanup Wizard Phase 4 Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/cleanup-wizard-phase4.md) for detailed specifications

---

### Property Naming Normalization (v0.18.11)

Standardized property naming for consistency and Obsidian compatibility, completing the `child` → `children` migration.

**Problem Solved:**

The codebase had inconsistent naming for the children wikilink property:
- `child` (singular) - legacy, used by older code paths
- `children` (plural) - preferred, matches `children_id`

This caused duplicate properties to appear in YAML when both systems wrote to the same note.

**Solution:**

| Component | Change |
|-----------|--------|
| Cleanup Wizard Step 14 | Batch migrate `child` → `children` across vault with preview |
| Documentation | `children` marked as canonical in Frontmatter-Reference.md |
| Deprecation Notice | Clear deprecation note with migration instructions |
| Wizard Extensibility | Fixed hardcoded step count to use `WIZARD_STEPS.length` |

**Migration Logic:**
- Detects person notes with legacy `child` property
- Merges with existing `children` if both exist (deduplicates)
- Removes legacy `child` property after migration

**Backward Compatibility:**
- Plugin reads both `child` and `children` during transition
- Future breaking change to remove `child` read support planned

**Documentation:**
- See [Deprecate Child Property Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/deprecate-child-property.md) for detailed specifications

---

### Custom Map Authoring (v0.18.10)

Streamlined custom map creation and place positioning, eliminating manual coordinate entry.

**Features:**

| Feature | Description |
|---------|-------------|
| Map Creation Wizard | 4-step guided wizard: select image → configure map → add initial places → review & create |
| Right-Click to Create Place | Right-click on custom map → "Create place here" → coordinates auto-filled |
| Draggable Place Markers | Drag markers to reposition (edit mode required), auto-update frontmatter, undo support |
| Place Marker Context Menu | Right-click markers to edit, open note, or copy coordinates |
| Icon-Only Toolbar | Map View toolbar buttons converted to icons with tooltips for space efficiency |

**Map Creation Wizard Steps:**
1. **Select Image** — Browse vault for map image with preview and auto-detected dimensions
2. **Configure Map** — Set name, universe (optional), coordinate system (pixel default for fantasy maps)
3. **Add Places** — Click on map preview to add initial locations (optional, can skip)
4. **Review & Create** — Summary view, then create map note and all place notes at once

**Entry Points:**
- Control Center → Maps → "Create map wizard"
- Command palette: "Canvas Roots: Create custom map"
- Context menu on image files: "Use as custom map"

**Technical Notes:**
- Wizard supports inline universe creation
- Modal state persistence allows resuming interrupted sessions
- Coordinates properly convert between DOM (y=0 at top) and Leaflet Simple CRS (y=0 at bottom)

**Documentation:**
- See [Custom Map Authoring Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/custom-map-authoring.md) for detailed specifications

---

### Nested Properties Redesign (v0.18.9)

Redesigned two features to use Obsidian-compatible flat property formats, eliminating "Type mismatch" warnings in the Properties panel and preventing data corruption.

**Problem Solved:**

Two plugin features used nested YAML structures incompatible with Obsidian's property panel:
- `sourced_facts` (Evidence Tracking) - nested objects with source arrays
- `events` (Life Events) - inline array of event objects

This caused "Type mismatch" warnings and risked data corruption if users clicked "update" in the property panel. ([GitHub Issue #52](https://github.com/banisterious/obsidian-canvas-roots/issues/52))

**Solution:**

**1. Evidence Tracking → Flat Properties**

Replaced nested `sourced_facts` object with individual flat properties:

```yaml
# Old format (nested - incompatible)
sourced_facts:
  birth_date:
    sources:
      - "[[Census 1870]]"
  death_date:
    sources:
      - "[[Death Certificate]]"

# New format (flat - compatible)
sourced_birth_date:
  - "[[Census 1870]]"
sourced_death_date:
  - "[[Death Certificate]]"
```

10 flat properties for each fact type:
- `sourced_birth_date`, `sourced_birth_place`
- `sourced_death_date`, `sourced_death_place`
- `sourced_parents`, `sourced_spouse`
- `sourced_marriage_date`, `sourced_marriage_place`
- `sourced_occupation`, `sourced_residence`

**2. Life Events → Event Note Files**

Replaced inline `events` array with separate event note files:

```yaml
# Old format (inline array - incompatible)
events:
  - event_type: residence
    place: "[[New York]]"
    date_from: "1920"

# New format (event note links - compatible)
life_events:
  - "[[Events/John Smith - Residence 1920]]"
```

Each event becomes a first-class note with full frontmatter, enabling:
- Searchability and linking
- Tags and attachments
- Source citations per event
- Organized in Events folder

**3. Cleanup Wizard Integration**

Added two new migration steps (now 13-step wizard):

| Step | Name | Description |
|------|------|-------------|
| 12 | Migrate Evidence Tracking | Convert `sourced_facts` → `sourced_*` flat properties |
| 13 | Migrate Life Events | Convert inline `events` → event note files with `life_events` links |

**4. Migration Notice (v0.18.9)**

- Shows on upgrade to v0.18.9+
- Explains both migrations with before/after examples
- Checkmarks indicate completed migrations
- "Open Cleanup Wizard" button for migration
- "Skip for now" button as escape hatch

**5. Backward Compatibility**

- Plugin reads both old and new formats during transition
- Old data continues to work until migrated
- Migration can be done at user's convenience

**Benefits:**
- No more "Type mismatch" warnings in Properties panel
- Safe to edit properties without data corruption
- Better Dataview and Bases compatibility
- Each event as a note enables linking, tags, and attachments

**Files Changed:**
- `src/sources/types/source-types.ts` - New property types and mappings
- `src/types/frontmatter.ts` - New `sourced_*` and `life_events` properties
- `src/sources/services/evidence-service.ts` - Dual-format reading
- `src/ui/control-center.ts` - Write to flat properties
- `src/sources/services/sourced-facts-migration-service.ts` - Step 12 migration
- `src/events/services/life-events-migration-service.ts` - Step 13 migration
- `src/ui/cleanup-wizard-modal.ts` - Steps 12 and 13
- `src/ui/views/migration-notice-view.ts` - v0.18.9 notice
- `src/settings.ts` - Migration completion tracking

---

### Inclusive Parent Relationships (v0.18.7)

Opt-in gender-neutral parent relationship support allowing users to represent diverse family structures while preserving traditional father/mother fields.

**Problem Solved:**

Users with nonbinary parents or those who prefer gender-neutral terminology had no way to represent these relationships. The plugin only supported gendered parent fields (father/mother), which doesn't accommodate all family structures.

**User Request:** "What if one or both parents are nonbinary? Could you add a 'Parent' option to father/mother?" ([GitHub Issue #63](https://github.com/banisterious/obsidian-canvas-roots/issues/63))

**Solution:**

A complete opt-in gender-neutral parent system that coexists with traditional relationships:

**1. Settings (Control Center > Preferences)**
- **Enable Inclusive Parents** toggle (default: OFF)
- **Parent Field Label** text setting for customization (default: "Parents")
  - Examples: "Parents", "Guardians", "Progenitors", "Lolos"
  - Label shown in UI only; frontmatter always uses `parents` property
- Conditional visibility: label setting only shown when toggle enabled

**2. Schema Changes**
- New `parents` property (wikilinks, can be array for multiple parents)
- New `parents_id` property (Canvas Roots IDs, dual storage pattern)
- Independent of `father`/`mother` — users can use either or both
- Supports mixed usage for blended families or migration scenarios

**3. Create/Edit Person Modal**
- Parents field appears when setting enabled (above father/mother)
- Multi-select person picker (same pattern as children field)
- Inline parent creation via person picker
- No gender pre-fill (unlike father/mother)
- Uses custom label from settings

**4. Family Graph Integration**
- FamilyGraphService reads `parents`/`parents_id` relationships
- Included in ancestor/descendant calculations
- Same treatment as father/mother for graph traversal
- Spouse edges between 2 parents (same pattern as father/mother)
- Priority order for fallback: biological → gender-neutral → adoptive

**5. Bidirectional Linking**
- When person added to `parents` array, automatically adds to each parent's `children` array
- Uses dual storage: both wikilinks (`parents`) and IDs (`parents_id`)
- Deduplication prevents duplicate entries
- Handles removal: when parent removed, child removed from their `children`
- Supports aliased wikilinks (`[[basename|name]]`) when filename differs from name

**6. Relationship Displays**
- **Relationships Block** (`canvas-roots-relationships`): Shows parents with "Parent" label
- **Family Chart View**: Displays gender-neutral parents in interactive tree
- **Sibling Detection**: Checks gender-neutral parents' children for siblings

**Design Principles:**

1. **Opt-in, not replacement** — Father/mother fields remain; this adds alongside
2. **Configurable** — Users customize terminology to their preference
3. **Non-disruptive** — Users with traditional setups see no UI changes
4. **Coexistent** — Can use father, mother, AND parents simultaneously

**Schema Example:**

```yaml
# Child's note
name: Jamie Smith
parents:
  - "[[Alex Smith]]"
  - "[[Jordan Smith]]"
parents_id:
  - "I0045"
  - "I0046"
```

```yaml
# Parent's note (automatically updated via bidirectional linking)
name: Alex Smith
children:
  - "[[Jamie Smith]]"
children_id:
  - "I0050"
```

**Implementation:**

**Files Modified:**
- [src/settings.ts](../../src/settings.ts) — Settings schema and UI
- [src/types/frontmatter.ts](../../src/types/frontmatter.ts#L62-L63) — Schema definition
- [src/core/family-graph.ts](../../src/core/family-graph.ts#L48) — Family graph integration
- [src/core/bidirectional-linker.ts](../../src/core/bidirectional-linker.ts#L227-L241) — Bidirectional sync
- [src/core/person-note-writer.ts](../../src/core/person-note-writer.ts#L393-L412) — Frontmatter writing
- [src/dynamic-content/renderers/relationships-renderer.ts](../../src/dynamic-content/renderers/relationships-renderer.ts#L150-L156) — Relationships display
- [src/ui/views/family-chart-view.ts](../../src/ui/views/family-chart-view.ts#L1090-L1097) — Family Chart View

**User Benefits:**
- Represents nonbinary parents respectfully
- Supports diverse family structures (queer families, cultural variations)
- Fully customizable terminology
- Backward compatible — no disruption to existing workflows
- Full integration across all family graph features

**Technical Details:**

**Dual Storage Pattern:**
```yaml
# Both wikilinks and IDs stored for flexibility
parents: ["[[Alex Smith]]"]  # For display and linking
parents_id: ["I0045"]         # For reliable graph traversal
```

**Priority Order (Fallback Logic):**
1. Check biological parents (father/mother)
2. If none, check gender-neutral parents
3. If none, check adoptive parents

**Bidirectional Sync:**
- Uses same `children` array as father/mother relationships
- Each parent in `parents` array gets child added to their `children`
- Deduplication by both cr_id and wikilink
- Deletion detection for relationship cleanup

**Planning Documentation:**
- See [planning document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/inclusive-parent-relationships.md) for detailed specifications and design decisions

---

### Media Upload and Management Enhancement (v0.18.6)

Comprehensive media upload and management system allowing users to upload files directly from Canvas Roots and link them to entities without manual file management.

**Problem Solved:**

Users could link existing vault files to entities (people, places, events, etc.), but had no way to upload new files directly from the plugin. This required breaking the workflow to manually add files to the vault before linking them, creating friction when attaching scanned documents, photos, or certificates to research.

**User Request:** "Can't link the Birth Certificate or picture" ([GitHub Issue #60](https://github.com/banisterious/obsidian-canvas-roots/issues/60))

**Solution:**

A complete media upload and linking system with multiple workflows:

**1. Settings Enhancement**
- Drag-and-drop reordering of media folders in Preferences
- First folder in list becomes upload destination
- Visual feedback during drag operations

**2. Expanded Media Manager Dashboard**
- 6-tile layout (3×2 grid) vs. previous 4-tile layout
- **Row 1 (Browse & Discover):**
  - Linked Media Gallery — view all linked media with filters
  - Find Unlinked — discover orphaned media files
  - Source Media Linker — smart filename-based matching
- **Row 2 (Add & Link):**
  - Upload Media — standalone file upload with optional linking
  - Link Media — media-first workflow (select files → choose entities)
  - Bulk Link to Entities — entity-first workflow (select entities → choose files)

**3. Standalone Upload Modal**
- Drag-and-drop file upload with browse fallback
- Upload to first configured media folder
- Read-only destination display with helpful hint
- Multiple file selection
- Auto-rename collision handling (incremental numbering)
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

**Architecture:**

**"Read Many, Write One" model:**
- Files upload to `mediaFolders[0]` (first configured folder)
- MediaPickerModal browses ALL media folders
- Users can reorganize files later via Obsidian's file explorer
- Drag-and-drop reordering in settings allows changing upload destination

**Key Design Decisions:**
- Media folders separate from maps folder (maps via place map picker)
- No destination dropdown (simplified UX, predictable behavior)
- Auto-rename collision handling vs. prompting user
- Inline upload in existing modals vs. separate upload-only modal

**Implementation:**

**Files Created:**
- `src/core/ui/media-upload-modal.ts` (302 lines) — Standalone upload modal
- `src/core/ui/entity-picker-modal.ts` (608 lines) — Entity selection with filtering

**Files Modified:**
- `src/ui/preferences-tab.ts` — Drag-and-drop reordering
- `src/core/ui/media-manager-modal.ts` — 6-tile layout
- `src/core/ui/media-picker-modal.ts` — Inline upload button
- `main.ts` — Context menu upload support
- `styles/preferences.css` — Folder reordering styles
- `styles/media-modals.css` — Upload and entity picker styles

**User Benefits:**
- No context switching to add files to vault
- Streamlined workflow for attaching documents to research
- Consistent upload experience across all entry points
- Visual media folder management in settings
- Powerful entity selection with filters for media-first workflows

**Technical Details:**

Uses Obsidian Vault API:
```typescript
await this.app.vault.createBinary(path, arrayBuffer)
```

Auto-rename collision handling:
- `photo.jpg` → `photo 1.jpg` → `photo 2.jpg` (incremental)
- Prevents overwrite accidents
- Allows quick bulk uploads without manual renaming

**Planning Documentation:**
- See [archived planning document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archived/media-upload-enhancement.md) for detailed specifications

---

### Timeline Export Consolidation (v0.18.2)

Consolidated all timeline export functionality from the Events tab Export card into the unified Reports wizard, creating a single comprehensive experience with all 8 export formats.

**Problem Solved:**

Timeline exports existed in two separate locations with different capabilities:

| Location | Formats | Strengths | Weaknesses |
|----------|---------|-----------|------------|
| Events tab → Export card | Canvas, Excalidraw, 4 markdown formats | Visual exports, styling options | No PDF/ODT, no date range filter |
| Reports → Timeline | PDF, ODT, markdown table | Document exports, advanced filters | No Canvas/Excalidraw, limited markdown |

Users had to navigate between two different UIs to access the full range of export options.

**Solution:**

All timeline export capabilities are now unified in **Statistics & Reports → Reports → Timeline**:

| Category | Formats |
|----------|---------|
| Visual exports | Canvas, Excalidraw (requires Excalidraw plugin) |
| Documents | PDF, ODT |
| Markdown | Vertical timeline (callouts), Table, Simple list, Dataview query |

**Consolidated Features:**

| Feature | Source |
|---------|--------|
| All filters | Person, event type, group, place, universe, date range |
| Canvas/Excalidraw styling | Layout (horizontal/vertical/Gantt), color scheme, ordering edges |
| Excalidraw drawing options | Style, font, stroke width |
| PDF/ODT options | Page size, date format, cover page |
| Grouping options | None, by year, by decade, by person, by place |
| Data quality insights | Timeline gaps, unsourced events, orphan events |

**Implementation Phases:**

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Add Canvas, Excalidraw, and additional markdown formats to Reports Timeline | ✓ Complete |
| 2 | Redesign wizard steps for format selection and format-specific options | ✓ Complete |
| 3 | Add deprecation notice to Events tab Export card | ✓ Complete |

**Deprecation Notice:**

The Events tab Export card now displays a notice directing users to the Reports wizard. The Export card will be removed in a future release.

**Documentation:**
- See [Timeline Export Consolidation Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/timeline-export-consolidation.md) for detailed specifications

---

### Create Person Enhancements (v0.18.1)

A comprehensive set of enhancements to streamline family tree creation, addressing the tedious workflow of jumping in and out of modals when building a family tree from scratch.

**Problem Solved:**

Building a family tree required constant context-switching:
1. Create Person A → Save → Close
2. Create Person B → Save → Close
3. Edit Person A to link B as spouse → Save → Close
4. Create Child C → Save → Close
5. Edit Child C to set parents → Save → Close
6. ...repeat endlessly

**Solution:**

Four phases of enhancements enable continuous family creation without leaving the modal flow.

**Phase 1: Inline Person Creation**

| Feature | Description |
|---------|-------------|
| "Create new" in pickers | When selecting father/mother/spouse, offer "Create new person" option |
| QuickCreatePersonModal | Simplified sub-modal for creating new family members inline |
| Smart defaults | Pre-fill sex for parents (father→male, mother→female) |
| Folder context menu | "Create person" option in People folder context menu |

**Phase 2: Children Section in Edit Modal**

| Feature | Description |
|---------|-------------|
| Children picker | Multi-select person picker to view/manage children in Edit mode |
| Inline creation | Create new children directly using Phase 1 infrastructure |
| Auto-detection | Infer `father`/`mother` field from parent's `sex` property |
| Bidirectional sync | Adding/removing children updates both parent and child notes |

**Phase 3: "Add Another" Flow**

After creating a person, the modal shows quick actions to continue building the family:
- **Add spouse** → Opens spouse picker with inline creation
- **Add child** → Opens child picker with inline creation
- **Add parent** → Shows father/mother choice, then opens parent picker
- **Done** → Closes modal

**Phase 4: Family Creation Wizard**

A dedicated 5-step wizard for creating an entire nuclear family at once:

| Step | Description |
|------|-------------|
| Start | Choose mode: start from scratch or build around existing person |
| Step 1 | Create central person (name, nickname, sex, birth date) |
| Step 2 | Add spouse(s) — supports multiple, create new or pick existing |
| Step 3 | Add children — create new or pick existing |
| Step 4 | Add parents (father and mother) |
| Step 5 | Review — visual family tree preview, stats summary, confirm |

**Wizard Features:**

| Feature | Description |
|---------|-------------|
| Visual tree preview | Mini family tree showing all members with initials |
| Batch creation | All notes created with relationships automatically linked |
| Merge logic | Links existing persons without overwriting their existing relationships |
| State persistence | Resume interrupted wizard sessions via `ModalStatePersistence` |
| Multiple entry points | Command palette, Dashboard tile, People tab, folder context menu |

**Bundled Enhancement: Nickname Property**

Added `nickname` as a first-class frontmatter property:
- Added to `PersonData` interface
- Supported in Create/Edit Person and QuickCreate modals
- Import support for GEDCOM (`NICK`), Gramps (`nick`), and GEDCOM X

**Entry Points:**

| Entry Point | Action |
|-------------|--------|
| Command: `Canvas Roots: Create family wizard` | Opens Family Creation Wizard |
| Dashboard → Create Family tile | Opens Family Creation Wizard |
| People tab → Actions → Create family | Opens Family Creation Wizard |
| People folder context menu → Create family | Opens wizard with folder pre-selected |
| People folder context menu → Create person | Opens CreatePersonModal with folder pre-selected |

**Documentation:**
- [Create Person Enhancements Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/create-person-enhancements.md) - Detailed specifications
- [Data Entry](Data-Entry) - User documentation

---

### Event Person Property Consolidation (v0.18.0)

Consolidates the dual `person`/`persons` event properties into a single unified `persons` array format for all event types.

**Problem Solved:**

Event notes previously used two different properties to track participants:
- `person` (string): Single participant for individual events (birth, death, occupation)
- `persons` (array): Multiple participants for family events (marriage, divorce, residence)

This duality created complexity in base templates (required formula workarounds), importers (must decide which property to use), and user understanding.

**Solution:**

All events now use the `persons` array property. Single-participant events simply have an array with one element:

```yaml
# Single-participant event
persons:
  - "[[John Smith]]"

# Multi-participant event
persons:
  - "[[John Smith]]"
  - "[[Jane Doe]]"
```

**Features:**

| Feature | Description |
|---------|-------------|
| **Unified Property** | All importers (GEDCOM, Gramps, GEDCOM X) now write `persons` array |
| **Migration Wizard Step** | Cleanup Wizard Step 11 detects and migrates legacy `person` properties |
| **Backward Compatibility** | Base templates and services continue reading both properties |
| **Migration Notice** | Users upgrading from v0.17.x see a one-time notice with migration guidance |

**Migration:**

1. Open the Cleanup Wizard (Control Center → Data Quality, or command palette)
2. Navigate to Step 11: "Migrate Event Person Properties"
3. Review detected notes and click "Apply All"

The legacy `person` property continues to be read indefinitely for backward compatibility.

**Documentation:**
- [Events And Timelines](Events-And-Timelines) - Updated property documentation
- [Frontmatter Reference](Frontmatter-Reference#person-and-place-links) - Updated event properties

---

## v0.17.x

### Research Level Property (v0.17.5)

A `research_level` property for Person notes to track research progress toward GPS-compliant documentation. Based on Yvette Hoitink's "Six Levels of Ancestral Profiles" system.

**Problem Solved:**

Genealogists need a way to track how thoroughly each ancestor has been researched, supporting the GPS principle of "reasonably exhaustive research." Previously, there was no standardized way to indicate which ancestors need more work.

**Research Levels:**

| Level | Name | Description |
|-------|------|-------------|
| 0 | Unidentified | Ancestor exists but no name established (placeholder) |
| 1 | Name Only | Name known, appears in others' records, no vital dates |
| 2 | Vital Statistics | Birth, marriage, death dates researched |
| 3 | Life Events | Occupations, residences, children, spouses documented |
| 4 | Extended Records | Property, military, religion, legal records researched |
| 5 | GPS Complete | Exhaustive research complete, written proof summary exists |
| 6 | Biography | Full narrative biography with historical context |

**Features:**

| Feature | Description |
|---------|-------------|
| **Edit Modal Selector** | Dropdown in Create/Edit Person modal to set research level |
| **Research Gaps Report** | Filter/sort by level, show statistics by level range |
| **Bases Views** | "By research level" grouped view, "Needs research" filtered view |
| **GEDCOM Export** | `_RESEARCH_LEVEL` custom tag |
| **Gramps Export** | `<attribute type="Research Level">` element |
| **Round-trip Import** | Both formats import back into `research_level` property |

**UI Integration:**

The research level selector appears in the Edit Person modal when `trackFactSourcing` is enabled in settings. The "(Not assessed)" option allows distinguishing between "not yet evaluated" and "Level 0 (Unidentified)".

**Files Modified:**

| File | Changes |
|------|---------|
| `src/types/frontmatter.ts` | ResearchLevel type, RESEARCH_LEVELS metadata |
| `src/core/person-note-writer.ts` | researchLevel in PersonData |
| `src/ui/create-person-modal.ts` | Dropdown selector |
| `src/core/family-graph.ts` | researchLevel in PersonNode |
| `src/reports/services/gaps-report-generator.ts` | Filtering, sorting, statistics |
| `src/gedcom/gedcom-exporter.ts` | `_RESEARCH_LEVEL` export |
| `src/gramps/gramps-exporter.ts` | "Research Level" attribute export |
| `src/gedcom/gedcom-parser-v2.ts` | Import parsing |
| `src/gramps/gramps-parser.ts` | Import parsing |
| `src/constants/base-template.ts` | Bases views |

See [Research Level Property Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/research-level-property.md) for implementation details.

---

### Excalidraw Export Enhancements (v0.17.1)

Enhanced Excalidraw export with ExcalidrawAutomate API integration, style customization, and improved output quality.

**Problem Solved:**

The previous Excalidraw export was functional but limited:
- **Manual text sizing:** Text dimensions estimated with character width multiplier, often inaccurate
- **Static arrows:** Connections didn't adapt when elements were moved in Excalidraw
- **No wiki links:** Couldn't click nodes to navigate to person notes
- **No style control:** Fixed visual style with no customization options
- **Temp file pollution:** Intermediate canvas files left behind after export

**Features:**

| Feature | Description |
|---------|-------------|
| **ExcalidrawAutomate API** | Uses API when available for smart connectors and accurate text measurement |
| **Smart connectors** | Arrows adapt when elements are moved (API mode) |
| **Wiki links** | Nodes link to person notes via Excalidraw's link property |
| **Spouse styling** | Spouse relationships rendered with dashed lines |
| **Drawing style options** | Architect (clean), Artist (sketchy), Cartoonist (rough) |
| **Font family options** | Virgil (handwritten), Cascadia (code), system fonts |
| **Fill/stroke styles** | Solid, hachure, cross-hatch fills; solid, dashed, dotted strokes |
| **Node content levels** | Name only, name + dates, or name + dates + places |
| **Dedicated wizard step** | Excalidraw style options in separate step for better UX |
| **JSON fallback** | Works without Excalidraw plugin using direct JSON generation |

**Wizard Flow (Excalidraw):**

| Step | Content |
|------|---------|
| 1 | Select root person |
| 2 | Choose tree type |
| 3 | Select output format (Excalidraw) |
| 4 | Canvas options (scope, colors) |
| 5 | Preview tree |
| 6 | Excalidraw style options |
| 7 | Output settings and generate |

**Files Modified:**

| File | Changes |
|------|---------|
| `src/excalidraw/excalidraw-exporter.ts` | API integration, style options, smart connectors |
| `src/trees/ui/unified-tree-wizard-modal.ts` | Excalidraw style step, form data fields |
| `src/excalidraw/excalidraw-automate.d.ts` | Type definitions for EA API |

**Bug Fixes:**

- Text centering in Excalidraw boxes
- Duplicate visible boxes (removed `box` parameter from `addText`)
- Wiki link brackets appearing in labels (stripped, set via element link property)
- Temporary canvas file cleanup after export
- Generate button reactivity on canvas name input
- Duplicate navigation footer in wizard

---

### Post-Import Cleanup Wizard (v0.17.0)

A 10-step guided wizard that consolidates post-import data quality operations into a single, sequential workflow. After importing a GEDCOM file (especially one with data quality issues), users previously had to navigate multiple Control Center tabs and run operations in the correct order. The wizard provides a unified experience with progress tracking.

**Problem Solved:**

- **Scattered tools:** Cleanup operations were spread across Data Quality, Places, and other tabs
- **Unknown order:** No guidance on which operations to run first
- **Manual coordination:** Users had to remember to run each step and track what's done

**Wizard Steps:**

| Step | Operation | Type |
|------|-----------|------|
| 1 | Quality Report | Review-only |
| 2 | Fix Bidirectional Relationships | Batch-fix |
| 3 | Normalize Date Formats | Batch-fix |
| 4 | Normalize Gender Values | Batch-fix |
| 5 | Clear Orphan References | Batch-fix |
| 6 | Migrate Source Properties | Batch-fix |
| 7 | Standardize Place Variants | Interactive |
| 8 | Bulk Geocode | Interactive |
| 9 | Enrich Place Hierarchy | Interactive |
| 10 | Flatten Nested Properties | Batch-fix |

**Features:**

| Feature | Description |
|---------|-------------|
| **Overview Grid** | 5×2 tile grid showing all 10 steps with status badges |
| **Progress Tracking** | Horizontal progress bar with step completion state |
| **Preview Mode** | Each batch step shows proposed changes before applying |
| **Session Persistence** | Wizard state saved to resume interrupted cleanup |
| **Smart Defaults** | Auto-skip steps with zero detected issues |
| **Summary Report** | Export completion stats to markdown |

**Entry Points:**
- Import Wizard results: "Run Cleanup Wizard" button
- Control Center > Data Quality > Quick Start card
- Command palette: "Canvas Roots: Post-Import Cleanup Wizard"

**Technical Notes:**
- `CleanupWizardModal` orchestrates the 10-step flow
- Reuses existing services: `DataQualityService`, `GeocodingService`, `PlaceGraphService`, `SourceMigrationService`
- State persisted in `plugin.settings.cleanupWizardState`

**Files Added:**

| File | Purpose |
|------|---------|
| `src/ui/modals/cleanup-wizard-modal.ts` | Main wizard modal with step navigation |
| `styles/cleanup-wizard.css` | Wizard-specific styling |

See [Post-Import Cleanup Wizard Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/post-import-cleanup-wizard.md) for implementation details.

---

### Source Array Migration (v0.17.0)

Migration from indexed source properties (`source`, `source_2`, `source_3`) to a YAML array format (`sources: []`). This change improves scalability, simplifies Dataview queries, and aligns with modern frontmatter practices.

**Problem Solved:**

The indexed format had limitations:
- **Fixed slots:** Only 3 source slots available per entity
- **Query complexity:** Dataview queries had to check multiple properties
- **Schema rigidity:** Adding more sources required schema changes

**Format Change:**

```yaml
# Old format (no longer supported)
source: "[[Birth Certificate]]"
source_2: "[[Census 1920]]"
source_3: "[[Family Bible]]"

# New format (unlimited sources)
sources:
  - "[[Birth Certificate]]"
  - "[[Census 1920]]"
  - "[[Family Bible]]"
  - "[[Interview Notes]]"
```

**Migration Phases:**

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Support both formats (read array, fall back to indexed) | ✅ Complete |
| Phase 2 | Add migration tooling via Cleanup Wizard Step 6 | ✅ Complete |
| Phase 3 | Deprecate indexed format (console warnings) | ✅ Complete |
| Phase 4 | Remove indexed format support | ✅ Complete |

**Features:**

| Feature | Description |
|---------|-------------|
| **Wizard Integration** | Step 6 of Cleanup Wizard handles migration |
| **Preview Mode** | Shows proposed changes before applying |
| **Batch Processing** | Migrates all notes in one operation |
| **Merge Support** | Combines indexed sources with existing array |
| **Legacy Warning** | Console warning for notes still using old format |

**Technical Notes:**
- `SourceMigrationService` handles detection and migration
- GEDCOM and Gramps importers now write array format by default
- Statistics service only reads `sources` array (indexed parsing removed)

**Files Added:**

| File | Purpose |
|------|---------|
| `src/sources/services/source-migration-service.ts` | Detection and migration logic |

**Breaking Change:** The indexed format (`source`, `source_2`, etc.) is no longer parsed. Users with legacy notes should run the Cleanup Wizard Step 6 to migrate.

See [Source Array Migration Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/source-array-migration.md) for implementation details.

---

### Migration Notice (v0.17.0)

A one-time workspace tab displayed when users upgrade to v0.17.0, informing them about the source array format change and providing a direct path to the Cleanup Wizard.

**Features:**
- Opens as main workspace tab on first load after upgrade
- Shows before/after code examples of format change
- "Open Cleanup Wizard" button for immediate migration
- "Dismiss" button marks notice as seen
- Version tracking via `lastSeenVersion` setting

**Files Added:**

| File | Purpose |
|------|---------|
| `src/ui/views/migration-notice-view.ts` | Workspace view for upgrade notice |
| `styles/migration-notice.css` | Notice styling |

---

## v0.16.x

### Import/Export Hub (v0.16.0)

Modal-based hub with step-by-step wizards for importing and exporting genealogical data, replacing the previous Import/Export tab in Control Center.

**Problem Solved:**

The previous import/export experience was fragmented:
- **Scattered UI:** Import/export lived in a Control Center tab, but progress displayed in separate modals
- **Disconnected numbering:** Post-import reference numbering was a separate modal, not integrated into the import workflow
- **Limited guidance:** No step-by-step flow for format selection, options, and preview

**Features:**

| Feature | Description |
|---------|-------------|
| **Hub Modal** | Two-card layout (Import, Export) matching Reports Hub and Media Manager patterns |
| **Import Wizard** | 7-step guided import with format selection, file picker, options, preview, progress, numbering, and completion |
| **Export Wizard** | 6-step guided export with format selection, folder picker, privacy controls, preview, progress, and completion |
| **Integrated Numbering** | Reference numbering (Ahnentafel, d'Aboville, Henry, Generation) built into import flow |
| **Privacy Controls** | Living person exclusion with redact vs. exclude options in export wizard |

**Import Wizard Steps:**

| Step | Purpose |
|------|---------|
| 1. Format | Select GEDCOM 5.5.1, GEDCOM X (JSON), Gramps XML/.gpkg, or CSV |
| 2. File | Drag-and-drop file picker |
| 3. Options | Entity types, target folder, conflict handling, dynamic blocks toggle |
| 4. Preview | Entity counts, duplicate warnings |
| 5. Import | Progress with real-time log |
| 6. Numbering | Optional reference numbering with root person picker |
| 7. Complete | Summary with actions |

**Export Wizard Steps:**

| Step | Purpose |
|------|---------|
| 1. Format | Select GEDCOM 5.5.1, GEDCOM X (JSON), Gramps XML, or CSV |
| 2. Folders | Preference folders or custom folder pickers |
| 3. Options | Privacy controls, inclusions (sources, places, notes, media) |
| 4. Preview | Entity counts, privacy summary |
| 5. Export | Progress with real-time log |
| 6. Complete | Download/save options |

**Technical Notes:**

- Reuses existing import/export logic (GEDCOM parsing, export generation)
- Integrates `ReferenceNumberingService` for numbering step
- `.gpkg` format includes embedded media, extracted and linked during import

**Files Added:**

| File | Purpose |
|------|---------|
| `src/ui/import-export-hub-modal.ts` | Hub modal with import/export cards |
| `src/ui/import-wizard-modal.ts` | 7-step import wizard |
| `src/ui/export-wizard-modal.ts` | 6-step export wizard |

See [Import/Export Hub Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/import-export-hub-plan.md) for implementation details.

---

## v0.15.x

### Visual Tree PDF Quality Improvements (v0.15.3)

Improved rendering quality for Visual Tree PDFs generated from the unified tree wizard, achieving parity with Family Chart PDF exports.

**Problem Solved:**
- Visual Tree PDFs generated via pdfmake appeared slightly blurry compared to Family Chart PDFs using jsPDF
- The pdfmake image embedding was resampling the tree image, causing quality loss
- No dynamic page sizing option for optimal digital viewing

**Changes:**

| Change | Description |
|--------|-------------|
| **4× scale rendering** | Increased canvas scale from 2× to 4× in `visual-tree-svg-renderer.ts` |
| **Aspect ratio preservation** | Removed explicit height constraint from pdfmake image content |
| **Quality parity** | Visual Tree PDFs now match Family Chart PDF sharpness |

**Technical Details:**

The quality difference stemmed from how images are embedded in PDFs:

- **jsPDF (Family Chart):** Sizes the PDF page to match the content, avoiding any resampling
- **pdfmake (Visual Tree):** Used fixed page sizes with explicit width/height, causing resampling

The fix increases the source canvas resolution (4× instead of 2×) to compensate for any resampling, and removes the explicit height constraint to preserve aspect ratio.

**Files Changed:**

| File | Change |
|------|--------|
| `src/trees/services/visual-tree-svg-renderer.ts` | Changed scale from 2 to 4 |
| `src/reports/services/pdf-report-renderer.ts` | Removed height from image content |

See [Visual Tree PDF Enhancements Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/visual-tree-pdf-enhancements.md) for technical analysis.

---

### Report Wizard Enhancements (v0.15.3)

Multi-step wizard interface for the Report Generator with improved UX, step-by-step navigation, and streamlined report creation.

**Problem Solved:**
- The Report Generator modal had grown complex with 13 report types, 5 categories, and extensive PDF options
- All options were displayed at once, creating cognitive overload
- No way to save common report configurations for reuse

**Features:**

| Feature | Description |
|---------|-------------|
| **5-step wizard** | Report Type → Subject → Content Options → Output & Styling → Generate |
| **Step navigation** | Previous/Next buttons with step indicator |
| **Category filtering** | Filter reports by category (Genealogical, Research, Timeline, Geographic, Summary) |
| **Dynamic options** | Content options step adapts to selected report type |
| **Format selection** | Choose output format (Vault, Markdown, PDF, ODT) in Output step |

**Wizard Steps:**

| Step | Purpose |
|------|---------|
| 1. Report Type | Category filter + report selection from 13 types |
| 2. Subject | Person/place/universe/collection picker based on report type |
| 3. Content Options | Report-specific toggles (generations, spouses, sources, etc.) |
| 4. Output & Styling | Format selection + PDF/ODT customization options |
| 5. Generate | Review settings and generate report |

**Files Changed:**

| File | Change |
|------|--------|
| `src/reports/ui/report-wizard-modal.ts` | New multi-step wizard modal |
| `src/reports/services/pdf-report-renderer.ts` | ODT generation support |
| `styles/report-wizard.css` | Wizard styling with compact cards |

See [Report Wizard Enhancements Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/report-wizard-enhancements.md) for implementation details.

---

### Report Generator ODT Export (v0.15.3)

ODT (Open Document Text) export capability for all report types, enabling document merging workflows with LibreOffice Writer and Microsoft Word.

**Problem Solved:**
- Reports could only be saved as Markdown or PDF
- No editable document format for further customization
- Users couldn't easily merge text reports with visual tree charts

**Features:**

| Feature | Description |
|---------|-------------|
| **All 13 report types** | ODT export available for all report types |
| **Cover page support** | Optional title page with logo, title, subtitle, and notes |
| **Rich content** | Tables, lists, bold/italic text preserved |
| **Image embedding** | Visual tree charts embedded as images (for tree reports) |
| **Title in document** | Optional title at top of document (when not using cover page) |
| **No external dependencies** | Uses JSZip (bundled with Obsidian) + manual XML generation |

**ODT Generation:**

ODT files are ZIP archives containing XML. The generator creates:

| File | Purpose |
|------|---------|
| `content.xml` | Document content with text, tables, and images |
| `styles.xml` | Paragraph, table, and character styles |
| `meta.xml` | Document metadata (title, author, date) |
| `manifest.xml` | File manifest for the archive |
| `Pictures/` | Embedded images (tree charts, logos) |

**Unified Tree Wizard Integration:**

The unified tree wizard also supports ODT output:
- ODT option in Step 3 (Output Format)
- Title field in Step 5 for document title
- Filename based on title field value
- Tree image embedded in ODT document

**Files Changed:**

| File | Change |
|------|--------|
| `src/reports/services/odt-generator.ts` | New ODT generation service |
| `src/reports/services/pdf-report-renderer.ts` | ODT generation for reports |
| `src/trees/ui/unified-tree-wizard-modal.ts` | ODT support in tree wizard |

See [Report Generator ODT Export Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/report-generator-odt-export.md) for implementation details.

---

### Calendarium Integration Phase 2 (v0.15.2)

Display events with Calendarium `fc-*` date fields on Canvas Roots timelines, with calendar filtering support.

**Problem Solved:**
- Events using Calendarium's `fc-date` format weren't visible on Canvas Roots timelines
- No way to filter timeline views by calendar system when mixing real and fictional dates
- Timeline badges in People tab didn't show event counts

**Features:**

| Feature | Description |
|---------|-------------|
| **fc-date Parsing** | Read `fc-date` or `fc-start` as event start date |
| **fc-end Support** | Read `fc-end` as event end date for date ranges (lifespans, reigns) |
| **Month Conversion** | Handle 0-indexed months from Calendarium (converts to 1-indexed) |
| **Calendar Filter** | Dropdown to filter timelines by `fc-calendar` value |
| **Timeline Badges** | Calendar icon with event count in People tab table rows |
| **Timeline Modal** | Click badge to open full timeline in modal dialog |

**Settings:**

| Setting | Description |
|---------|-------------|
| `syncCalendariumEvents` | Enable/disable fc-* field parsing (default: false) |
| Integration mode | Must be set to "Read-only" in Preferences → Integrations |

**How It Works:**

1. Enable Calendarium integration in Preferences → Integrations
2. Enable "Show Calendarium dates on timelines" toggle
3. Event notes with `fc-date` fields will now appear on timelines
4. The `fc-calendar` value is used as the date system for filtering

**Example Event Note:**

```yaml
---
cr_type: event
cr_id: "20251223120000"
title: "Birth of Aragorn"
event_type: birth
person: "[[Aragorn]]"
fc-date:
  year: 2931
  month: 2
  day: 1
fc-calendar: Middle-earth
---
```

**Related Documentation:**
- [Calendarium Integration](Fictional-Date-Systems#calendarium-integration)
- [Events & Timelines](Events-And-Timelines)

---

### Family Chart Export Wizard (v0.15.1)

Multi-step export wizard for Family Chart view with format presets, customization options, and progress tracking.

**Problem Solved:**
- The export dropdown menu was cluttered and easy to trigger accidentally
- No preview of export settings before generating
- Large exports could freeze the UI without progress indication
- No way to remember last-used settings

**Features:**

| Feature | Description |
|---------|-------------|
| **5 Quick Presets** | Quick Share (PNG 1x), High Quality (PNG 2x), Print Ready (PDF), Editable (SVG), Document (ODT) |
| **Format Options** | PNG, SVG, PDF, ODT with format-specific settings |
| **Scope Selection** | Full tree or limited depth (1-5 generations) |
| **PDF Options** | Page size (fit/A4/letter/legal/tabloid), layout (single/tiled), orientation (auto/portrait/landscape) |
| **Cover Page** | Optional title page for PDF/ODT with custom title and subtitle |
| **Avatar Toggle** | Include or exclude person thumbnails |
| **Progress Modal** | Real-time progress with phase indicators and cancel button |
| **Settings Memory** | Last-used format, scale, and options remembered |

**Export Presets:**

| Preset | Format | Settings | Use Case |
|--------|--------|----------|----------|
| **Quick Share** | PNG | 1x scale, no avatars | Social media, messaging |
| **High Quality** | PNG | 2x scale, with avatars | Printing, archiving |
| **Print Ready** | PDF | Cover page, with avatars | Physical prints, sharing |
| **Editable** | SVG | Vector format, no avatars | Editing in Inkscape/Illustrator |
| **Document** | ODT | Cover page, with avatars | Merging with reports in Word/LibreOffice |

**ODT Export:**

The ODT format creates an OpenDocument Text file that can be opened in LibreOffice Writer or Microsoft Word. This enables:
- Merging family charts with narrative text
- Adding custom formatting and styling
- Creating comprehensive family history documents

Technical implementation uses JSZip for creating the ODT ZIP archive with manual XML generation (no external library dependencies).

**Files Changed:**

| File | Change |
|------|--------|
| `src/ui/views/family-chart-export-wizard.ts` | New export wizard modal |
| `src/ui/views/family-chart-export-progress-modal.ts` | Progress tracking modal |
| `src/ui/views/odt-generator.ts` | ODT generation using JSZip |
| `src/ui/views/family-chart-view.ts` | Export button wiring, exportWithOptions method |
| `src/settings.ts` | LastFamilyChartExportSettings interface |
| `styles/family-chart-export.css` | Wizard and progress modal styling |

See [Family Chart View](Family-Chart-View#exporting) for usage documentation.

---

### Family Chart Styling Panel (v0.15.1)

In-view color theming for Family Chart with preset themes and custom color picker.

**Problem Solved:**
- Chart color options were only accessible via the Style Settings plugin
- Users without Style Settings couldn't customize colors
- No quick way to switch between color themes

**Features:**

| Feature | Description |
|---------|-------------|
| **Palette Button** | Toolbar button opens theme menu |
| **5 Theme Presets** | Classic, Pastel, Earth Tones, High Contrast, Monochrome |
| **Customize Modal** | Color pickers for all 7 chart colors |
| **Live Preview** | Colors update in real-time while adjusting |
| **Settings Persistence** | Custom colors saved across sessions |
| **Reset Option** | Reverts to default colors |

**Theme Presets:**

| Theme | Female | Male | Unknown | Description |
|-------|--------|------|---------|-------------|
| **Classic** | Pink `#c48a92` | Blue `#789fac` | Gray `#d3d3d3` | Default colors |
| **Pastel** | Soft pink `#f4c2c2` | Soft blue `#a7c7e7` | Lavender `#e6e6fa` | Lighter, softer tones |
| **Earth Tones** | Terracotta `#cc7a6f` | Sage `#8fbc8f` | Sand `#d2b48c` | Natural, warm palette |
| **High Contrast** | Magenta `#ff00ff` | Cyan `#00ffff` | Yellow `#ffff00` | Accessibility-focused |
| **Monochrome** | Dark gray `#666666` | Medium gray `#888888` | Light gray `#aaaaaa` | No color coding |

**Customizable Colors:**

| Color | Description |
|-------|-------------|
| **Female card** | Background color for female person cards |
| **Male card** | Background color for male person cards |
| **Unknown card** | Background color for unknown gender cards |
| **Background (light)** | Chart background in light theme |
| **Background (dark)** | Chart background in dark theme |
| **Text (light)** | Card text color in light theme |
| **Text (dark)** | Card text color in dark theme |

**Interaction with Style Settings:**

If you have the Style Settings plugin installed:
- In-view settings take precedence (applied via inline styles)
- "Reset to defaults" clears in-view settings, revealing Style Settings values
- Both can coexist—use in-view for quick switching, Style Settings for vault-wide defaults

**Files Changed:**

| File | Change |
|------|--------|
| `src/ui/views/family-chart-view.ts` | Palette button, theme presets, FamilyChartStyleModal |
| `src/settings.ts` | FamilyChartColors interface |
| `styles/family-chart-view.css` | Style modal CSS |

See [Family Chart View](Family-Chart-View#styling) for usage documentation.

---

### Universal Media Linking (v0.15.0)

Extend the `media` property to all entity types (Person, Event, Place, Organization) with Gramps Package (`.gpkg`) import support and dynamic inline galleries.

**Problem Solved:**
- The `media` property was only supported on Source notes
- Gramps Package (`.gpkg`) import ignored bundled media files
- No way to display media galleries inline within person notes
- Writers and worldbuilders couldn't attach character portraits, location art, or scene illustrations

**Features:**

| Feature | Description |
|---------|-------------|
| **Universal media property** | `media` supported on Person, Event, Place, Source, Organization notes |
| **Gramps Package import** | `.gpkg` files import with media extraction to vault |
| **Media linking during import** | Media files linked to all entity types based on Gramps `objref` references |
| **Dynamic media gallery** | `canvas-roots-media` code block renders inline gallery |
| **Editable mode** | Drag-to-reorder with `editable: true` option |
| **Freeze to callout** | Convert gallery to styled `[!info|cr-frozen-gallery]` callout |
| **Style Settings** | Gallery appearance customizable via Style Settings plugin |
| **Find Unlinked Media** | Tool to discover orphaned media files in vault |
| **Media folder filtering** | Settings to exclude folders from media searches |

**Dynamic Media Gallery:**

~~~markdown
```canvas-roots-media
columns: 3
size: medium
editable: false
title: Media
```
~~~

**Configuration options:**

| Option | Values | Description |
|--------|--------|-------------|
| `columns` | 2-6, `auto` | Number of columns in grid (default: 3) |
| `size` | `small`, `medium`, `large` | Thumbnail size (default: medium) |
| `editable` | `true`, `false` | Enable drag-to-reorder (default: false) |
| `title` | string | Custom header text (default: "Media") |

**Editable Mode:**

When `editable: true` is set:
- Items show a drag handle on hover
- Drag items to reorder their position
- First item becomes the thumbnail (shown on Family Chart nodes)
- Frontmatter is updated automatically when you drop
- Gallery has a dashed border to indicate edit mode

**Frozen Gallery:**

Click the freeze button (❄️) to convert to a styled callout:

~~~markdown
> [!info|cr-frozen-gallery]
> ![[portrait.jpg]]
> ![[wedding-photo.jpg]]
> ![[birth-certificate.pdf]]
~~~

The frozen gallery renders images in a flex layout with click-and-hold zoom.

**Entity Support:**

| Entity Type | Use Cases |
|-------------|-----------|
| **Person** | Photos, portraits, scanned documents, character concept art |
| **Event** | Ceremony photos, certificates, scene illustrations |
| **Place** | Location photos, historical maps, fantasy maps, floor plans |
| **Organization** | Logos, group photos, faction banners, heraldry |
| **Source** | Original records, digitized documents |

**Gramps Package Import:**

When importing a `.gpkg` file:
1. Media files are extracted to your configured media folder
2. `objref` elements in the Gramps XML are resolved to vault paths
3. `media` wikilinks are added to Person, Event, Place, and Source frontmatter
4. First media item serves as thumbnail (matching Gramps convention)

**Implementation Phases:**

| Phase | Scope |
|-------|-------|
| Phase 1 | Add `media` property to Person, Event, Place, Organization schemas |
| Phase 2 | Find Unlinked Media tool, Media Manager integration |
| Phase 3 | Media folder filtering and settings |
| Phase 4 | Gramps Package (`.gpkg`) import with media extraction |
| Phase 5 | Dynamic `canvas-roots-media` block with freeze support |

**Files Changed:**

| File | Change |
|------|--------|
| `src/gramps/types.ts` | Added `mediaRefs` to GrampsPerson, GrampsEvent, GrampsPlace interfaces |
| `src/gramps/gramps-parser.ts` | Parse `objref` elements, populate `mediaRefs` arrays |
| `src/gramps/gramps-importer.ts` | Resolve media refs to wikilinks during note creation |
| `src/dynamic-content/media-processor.ts` | New processor for `canvas-roots-media` blocks |
| `src/dynamic-content/dynamic-content-service.ts` | Media gallery rendering and freeze logic |
| `styles/dynamic-content.css` | Gallery grid, editable mode, frozen callout styles |

See [Dynamic Note Content: Media Block](Dynamic-Note-Content#media-block) for usage documentation and [Universal Media Linking Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/universal-media-linking.md) for implementation details.

---

## v0.14.x

### Visual Tree Charts (v0.14.0)

Unified tree generation wizard supporting both Canvas and PDF output, with visual tree reports in the Statistics Dashboard.

**Problem Solved:**
- Two separate wizards for Canvas and PDF tree generation created confusion
- No visual tree diagrams in the Statistics and Reports system
- Canvas Trees tab lacked modern dashboard design
- No custom icons for tree chart types

**Features:**

| Feature | Description |
|---------|-------------|
| **Unified Tree Wizard** | Single wizard for both Canvas and PDF output with dynamic step flow |
| **Visual Tree Reports** | 4 chart types in Statistics Dashboard: Pedigree, Descendant, Hourglass, Fan Chart |
| **Custom SVG Icons** | Themeable icons for each chart type (`cr-pedigree-tree`, `cr-descendant-tree`, `cr-hourglass-tree`, `cr-fan-chart`) |
| **Canvas Trees Tab** | Redesigned dashboard with recent trees, statistics, and quick actions |
| **PDF Options** | Page size, orientation, node content, color schemes, large tree handling |

**Wizard Step Flow:**

```
Step 1: Person Selection
    ↓
Step 2: Tree Type Selection
    ↓
Step 3: Output Format (Canvas vs PDF)
    ├── Canvas → Step 4a: Canvas Options → Step 5a: Preview → Step 6a: Output
    └── PDF → Step 4b: PDF Options → Step 5b: Output
```

**Chart Types:**

| Chart Type | Description |
|------------|-------------|
| **Pedigree Tree** | Ancestors branching upward from root person |
| **Descendant Tree** | Descendants branching downward from root person |
| **Hourglass Tree** | Both ancestors and descendants from root person |
| **Fan Chart** | Semicircular pedigree (PDF only, placeholder for future) |

**PDF Generation Paths:**

| Path | Library | Quality | Use Case |
|------|---------|---------|----------|
| **Unified Wizard** | pdfmake | Good | Quick PDF generation from wizard |
| **Family Chart View** | jsPDF | Excellent | High-quality printable output |

The Family Chart view produces superior visual output (orthogonal connectors, profile icons, better spouse positioning). Both paths are maintained for different use cases.

**Files Changed:**

| File | Change |
|------|--------|
| `src/trees/ui/unified-tree-wizard-modal.ts` | New unified wizard modal |
| `src/trees/services/visual-tree-service.ts` | Tree building and layout service |
| `src/reports/services/pdf-report-renderer.ts` | Extended with visual tree PDF generation |
| `src/reports/types/report-types.ts` | Added 4 visual tree report types |
| `src/ui/lucide-icons.ts` | Added 4 custom SVG icons |
| `src/ui/control-center.ts` | Canvas Trees tab dashboard redesign |
| `styles/tree-output.css` | New card and wizard styles |

**Removed Files:**
- `src/trees/ui/tree-generation-wizard.ts` (1500+ lines, replaced by unified wizard)
- `src/trees/ui/visual-tree-wizard-modal.ts` (570+ lines, replaced by unified wizard)

See [Canvas Trees](Visual-Trees) for user documentation and [Tree Visualization Overhaul Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/tree-visualization-overhaul.md) for implementation details.

---

## v0.13.x

### Control Center Dashboard (v0.13.6)

Transform the Control Center's Status tab into a Dashboard with quick-action tiles, providing mobile-friendly access to common operations.

**Problem Solved:**
- Status tab displayed entity counts and vault health but no actions
- Common operations required navigating to other tabs or Command Palette
- Mobile users faced extra friction due to limited screen space
- No quick access to frequently-used operations

**Features:**

| Feature | Description |
|---------|-------------|
| **Dashboard tab** | Replaces Status tab as the Control Center's home screen |
| **9 quick-action tiles** | One-tap access to Person, Event, Source, Place, Report, Statistics, Import, Tree Output, and Map |
| **Vault Health section** | Collapsible section with entity counts and completeness metrics |
| **Recent Files** | Last 5 accessed files with type badges and click-to-open |
| **Context menu** | Right-click Recent items for type-specific actions |
| **First-run notice** | Dismissible welcome message for new users |
| **Responsive grid** | 3-column on desktop, 2-column on mobile |

**Quick Action Tiles:**

| Tile | Icon | Action |
|------|------|--------|
| **Person** | `user` | Opens Create Person modal |
| **Event** | `calendar` | Opens Create Event modal |
| **Source** | `file-text` | Opens Create Source modal |
| **Place** | `map-pin` | Opens Create Place modal |
| **Report** | `file-chart-pie` | Opens Report Generator modal |
| **Statistics** | `bar-chart-3` | Opens Statistics Dashboard view |
| **Import** | `upload` | Opens Import/Export tab |
| **Tree Output** | `git-branch` | Opens Tree Output tab |
| **Map** | `map` | Opens Map View |

**Recent Files Context Menu:**

| Entity Type | Actions |
|-------------|---------|
| All types | Open note |
| Place | Open in Map View (zooms to coordinates if available) |
| Person | Open in Family Chart |

**Vault Health Section:**

| Metric | Description |
|--------|-------------|
| **Entity counts** | People, Events, Sources, Places, Organizations, Canvases |
| **Completeness** | Percentage of people with key data (birth, death, parents) |
| **Issues** | Count of data quality warnings with "View details" link |

**Technical Details:**
- New `DashboardTab` component in `src/ui/dashboard-tab.ts`
- New `RecentFilesService` in `src/core/recent-files-service.ts`
- Recent files stored in `plugin.settings.dashboardRecentFiles`
- Dashboard styles in `styles/dashboard.css`
- Vault Health section collapse state persisted in settings

See [Control Center Dashboard Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/control-center-dashboard.md) for implementation details.

---

### Extended Report Types (v0.13.5)

Six new report types expanding the report generator beyond traditional genealogical reports, plus enhanced PDF customization options.

**Problem Solved:**
- Reports were limited to 7 genealogical report types
- No way to document sources for a person in aggregate
- No timeline report showing all events chronologically
- No place-focused summaries
- No reports for worldbuilders (universe/collection overviews)
- Limited PDF customization options

**New Report Types:**

| Report | Category | Description |
|--------|----------|-------------|
| **Source Summary** | Research | All sources cited for a person, grouped by fact type, with quality ratings and gap analysis |
| **Timeline Report** | Timeline | Chronological list of events with filtering by date range, event type, and participants |
| **Place Summary** | Geographic | All events and people associated with a location (born, died, resided, married) |
| **Media Inventory** | Research | Media files with linked entities, orphaned file detection, coverage gap analysis |
| **Universe Overview** | Summary | Entity statistics for a fictional world with date ranges and entity type breakdown |
| **Collection Overview** | Summary | Summary of a user collection or family component with member list and statistics |

**Report Category Selector:**

The Report Generator modal now includes a category selector that groups all 13 report types:

| Category | Reports |
|----------|---------|
| Genealogical | Ahnentafel, Pedigree Chart, Descendant Chart, Register Report, Family Group Sheet, Individual Summary |
| Research | Source Summary, Gaps Report, Media Inventory |
| Timeline | Timeline Report |
| Geographic | Place Summary |
| Summary | Universe Overview, Collection Overview |

**Source Summary Report:**

| Feature | Description |
|---------|-------------|
| **Root person picker** | Select subject for the report |
| **Grouping options** | By fact type, source type, or quality |
| **Quality indicators** | Primary, secondary, derivative classification |
| **Citation details** | Full citations with repository info |
| **Gap analysis** | Highlights unsourced facts needing documentation |

**Timeline Report:**

| Feature | Description |
|---------|-------------|
| **Date range filter** | Optional start and end dates |
| **Event type filter** | Filter to specific event types |
| **Participant filter** | Events involving specific people |
| **Grouping** | None, by year, by decade, by person, by place |
| **Source inclusion** | Toggle source references |

**Place Summary Report:**

| Feature | Description |
|---------|-------------|
| **Root place picker** | Select subject location |
| **Child places** | Option to include events at child locations |
| **Date range filter** | Filter events by date |
| **Place hierarchy** | Shows containment chain |
| **Coordinate display** | Includes lat/long when available |

**Media Inventory Report:**

| Feature | Description |
|---------|-------------|
| **Scope selection** | All media, sources only, or by folder |
| **Orphan detection** | Lists media files not linked to any entity |
| **Coverage gaps** | Shows entities that could have media but don't |
| **File type breakdown** | Images, PDFs, audio counts |
| **Grouping** | By entity type, folder, or file type |

**Universe Overview Report:**

| Feature | Description |
|---------|-------------|
| **Universe picker** | Select subject universe |
| **Entity breakdown** | Counts per type (people, places, events, organizations, sources) |
| **Date range** | Earliest to latest dates using fictional dates if applicable |
| **Geographic summary** | Places with coordinates and coverage percentage |
| **Date systems** | Lists calendar systems used in the universe |
| **Recent activity** | Optionally lists recently modified entities |

**Collection Overview Report:**

| Feature | Description |
|---------|-------------|
| **Collection picker** | User collections or auto-detected family components |
| **Member list** | People with key dates (birth, death) |
| **Generation analysis** | Ancestor/descendant counts by generation |
| **Geographic distribution** | Places and counts |
| **Surname distribution** | For family components |
| **Sort options** | By birth date, name, or death date |

**Enhanced PDF Options:**

| Option | Description |
|--------|-------------|
| **Custom title** | Override default report title |
| **Custom title scope** | Apply to cover only, headers only, or both |
| **Custom subtitle** | Additional text below title on cover page |
| **Cover notes** | Extended notes section on cover page |
| **Date format** | MDY (12/20/2025), DMY (20/12/2025), or YMD (2025-12-20) |

**Access Points:**
- Statistics Dashboard → Reports section → Generate
- Command palette: "Canvas Roots: Generate Report"

**Technical Details:**
- Each report type has a dedicated generator class in `src/reports/services/`
- All reports use shared PDF infrastructure via `PdfReportRenderer`
- Report options stored in modal state and passed to generators
- Same output options: Save to vault, Download as MD, Download as PDF

See [Extended Report Types Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/extended-report-types.md) for implementation details.

---

### PDF Report Export (v0.13.4)

Export genealogical reports as professionally styled PDF documents, generated entirely locally with no internet connection required.

**Problem Solved:**
- Reports could only be saved as markdown files or copied to clipboard
- No way to share polished, print-ready reports with family members
- Professional archiving required manual formatting in external tools

**Features:**

| Feature | Description |
|---------|-------------|
| **All 7 report types** | Ahnentafel, Pedigree Chart, Descendant Chart, Register Report, Family Group Sheet, Individual Summary, Gaps Report |
| **Page size options** | A4 or Letter |
| **Optional cover page** | Title page with report name, subject, generation date, and Canvas Roots branding |
| **Logo/crest support** | Add custom image to cover page (automatically resized for optimal file size) |
| **100% local generation** | PDFs created entirely on device using bundled pdfmake library |
| **Privacy-first design** | No data sent to any server; no internet connection required |

**PDF Options:**

| Option | Description |
|--------|-------------|
| **Page size** | A4 or Letter |
| **Include cover page** | Add a title page with report metadata |
| **Logo or crest** | Optional image for cover page (PNG, JPEG, GIF, WebP) |

**Cover Page Contents:**
- Report title (e.g., "Ahnentafel Report")
- Subject name (e.g., "Ancestors of John Smith")
- Decorative separator line
- Generation date
- "Canvas Roots for Obsidian" branding
- Optional logo/crest centered at top

**Privacy & Security:**

Genealogical data is highly personal. PDF generation is designed with privacy as a core principle:

- **100% local generation** — PDFs are created entirely on your device using the pdfmake library bundled with the plugin
- **No internet connection required** — No data is sent to any server or cloud service
- **No external dependencies** — Fonts are embedded; no network requests are made during generation
- **Downloads to your system** — Files save to your operating system's Downloads folder, outside your vault

**Access Points:**
- Statistics Dashboard → Reports section → Generate → Select "Download as PDF"
- Command palette: "Canvas Roots: Open Statistics Dashboard"

**Technical Details:**
- Uses pdfmake library (~400KB) for document generation, lazy-loaded on first use
- Renders directly from structured report data (not markdown parsing)
- Logo images automatically resized to max 200×200px to reduce file size
- Separate from jsPDF dependency used for Family Chart canvas export

See [Statistics & Reports](Statistics-And-Reports#pdf-export) for usage documentation.

---

### Universe Management (v0.13.0)

First-class universe entity type for managing fictional worlds, with a dedicated Control Center tab, guided setup wizard, and comprehensive statistics integration.

**Problem Solved:**
- Worldbuilders had no central place to manage fictional universes (Middle-earth, Westeros, etc.)
- The `universe` field was a plain string with no validation, leading to typos creating duplicate "universes"
- No way to see which entities belonged to which universe
- No guided setup for creating a new world with calendar, map, and validation rules

**Universe Entity:**

Universe notes (`cr_type: universe`) serve as a canonical registry for fictional worlds:

```yaml
cr_type: universe
cr_id: middle-earth
name: Middle-earth
description: A fantasy world created by J.R.R. Tolkien
author: J.R.R. Tolkien
genre: fantasy
status: active
default_calendar: shire-reckoning
default_map: middle-earth-map
```

**Features:**

| Feature | Description |
|---------|-------------|
| **Universe entity type** | First-class note type with full CRUD support |
| **UniverseService** | Entity aggregation, orphan detection, statistics |
| **Universes tab** | Dedicated Control Center tab (conditional visibility) |
| **Create Universe wizard** | Multi-step guided setup with optional calendar, map, and schema |
| **Statistics integration** | Universes section with entity counts and drill-down |
| **Guide tab documentation** | Universe notes section in Essential Properties card |
| **Context menu action** | "Add essential universe properties" for universe notes |
| **Universes base template** | 12 pre-configured views for browsing universes |

**Universes Tab:**

The Universes tab appears in Control Center when:
- Any universe notes exist in the vault, OR
- Any orphan universe strings exist (entities with `universe` field but no matching note)

This keeps the UI clean for genealogists who never use fictional worlds.

| Card | Description |
|------|-------------|
| **Actions** | Create universe (wizard), Create universes base |
| **Your universes** | List of universe notes with entity counts |
| **Orphan universe strings** | Entities referencing non-existent universes |

**Create Universe Wizard:**

| Step | Description | Skippable |
|------|-------------|-----------|
| 1 | Universe details (name, description, author, genre, status) | No |
| 2 | Custom calendar? Creates linked date system | Yes |
| 3 | Custom map? Creates linked map configuration | Yes |
| 4 | Validation schema? Creates scoped schema | Yes |
| 5 | Summary with links to all created entities | No |

**Statistics Integration:**

The Statistics dashboard includes a Universes section showing:
- Universe count and list
- Per-universe entity breakdown (people, events, places, sources, organizations)
- Drill-down to view entities filtered by universe
- "View full statistics →" link to dashboard with universe filter

**Universes Base Template:**

12 pre-configured views for browsing universes:
- All Universes
- By Status (active, draft, archived)
- By Genre, By Author
- With/Without Calendars
- With/Without Maps
- Recently Created

**Context Menu:**

Right-click on a universe note to access:
- Add essential universe properties
- Open in Universes tab
- Create related entities (person, event, place, etc.) pre-populated with universe

**Backward Compatibility:**

- String-only `universe` values continue to function
- Orphan detection shows entities referencing non-existent universe notes
- New entities can link to universe notes via wikilink or use string values

See [Universe Management Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/universe-management.md) for implementation details.

---

## v0.12.x

### Configurable Normalization (v0.12.12)

User-configurable sex value normalization modes that allow worldbuilders to protect custom sex values from GEDCOM-standard normalization.

**Problem Solved:**
- Worldbuilders using custom sex values (e.g., "hermaphrodite", "neuter" for alien species) had those values normalized to GEDCOM M/F when running "Normalize sex values"
- No way to skip normalization for notes covered by schemas with custom sex enum definitions
- All-or-nothing approach: either normalize everything or nothing

**Features:**

| Feature | Description |
|---------|-------------|
| **Three normalization modes** | Standard (GEDCOM M/F), Schema-aware (skip protected notes), Disabled (never normalize) |
| **Schema-aware detection** | Checks if person has applicable schema with custom `sex` enum values |
| **Preview enhancement** | Shows which notes will be skipped due to schema override |
| **Preferences setting** | New dropdown in Preferences → Data Quality |

**Normalization Modes:**

| Mode | Behavior |
|------|----------|
| **Standard** | Normalize all sex values to GEDCOM M/F (default, existing behavior) |
| **Schema-aware** | Skip notes covered by schemas that define custom sex enum values |
| **Disabled** | Never normalize sex values (preview shows what would change) |

**Schema-Aware Example:**

A worldbuilder creates a schema for their sci-fi universe:

```yaml
---
cr_type: schema
cr_id: schema-alien-species
applies_to_type: universe
applies_to_value: "Sci-Fi Universe"
---

```json schema
{
  "properties": {
    "sex": {
      "type": "enum",
      "values": ["male", "female", "neuter", "hermaphrodite"]
    }
  }
}
```

With **Schema-aware** mode enabled, person notes in the "Sci-Fi Universe" with sex values like "hermaphrodite" will be skipped during normalization, while notes in other universes (or without a universe) will still be normalized to GEDCOM M/F.

**Integration:**
- Builds on [Value Aliases](Release-History#value-aliases-v094) for synonym mapping
- Builds on [Schema Validation](Release-History#schema-validation-v063) for custom enum detection
- Uses existing Data Quality tab batch operation infrastructure

See [Sex/Gender Identity Expansion Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/sex-gender-expansion.md) for Phase 4 implementation details.

---

### Step & Adoptive Parent Support (v0.12.10)

Comprehensive support for non-biological parent relationships, improving GEDCOM import fidelity and enabling accurate representation of blended families.

**Problem Solved:**
- GEDCOM files with step-parent or adoptive relationships (via `PEDI` tags) were imported as primary parent claims, triggering false conflicts
- No way to distinguish biological parents from step/adoptive parents in the data model
- Canvas trees could not visualize non-biological parent relationships

**Features:**

| Feature | Description |
|---------|-------------|
| **GEDCOM PEDI parsing** | Parse `PEDI` tags (`birth`, `step`, `adop`, `foster`) from GEDCOM 5.5.1 files |
| **Gramps mrel/frel parsing** | Parse `mrel`/`frel` attributes (`Birth`, `Stepchild`, `Adopted`) from Gramps XML |
| **GEDCOM X lineage types** | Parse lineage type facts (`StepParent`, `AdoptiveParent`, etc.) from GEDCOM X JSON |
| **Round-trip export** | Export step/adoptive parents with PEDI tags (GEDCOM), mrel/frel (Gramps), lineage facts (GEDCOM X) |
| **Dedicated frontmatter fields** | `stepfather_id`, `stepmother_id`, `adoptive_father_id`, `adoptive_mother_id` |
| **Conflict detection** | Step/adoptive parents excluded from biological parent conflicts |
| **Canvas visualization** | Step-parents shown with dashed lines, adoptive parents with dotted lines |
| **Tree generation toggles** | "Include step-parents" and "Include adoptive parents" options |
| **Create/Edit modal** | New section for manual entry of step/adoptive parents |
| **Statistics breakdown** | Parent type breakdown in Data Completeness, blended family metrics |

**New Frontmatter Fields:**

```yaml
# Biological parents (existing)
father_id: abc-123-def-456
mother_id: ghi-789-jkl-012

# Step-parents (can have multiple)
stepfather_id:
  - mno-345-pqr-678
  - abc-111-def-222
stepmother_id: stu-901-vwx-234

# Adoptive parents
adoptive_father_id: yza-567-bcd-890
adoptive_mother_id: efg-123-hij-456
```

**GEDCOM 5.5.1 Pedigree Types:**

| PEDI Value | Meaning | Canvas Roots Field |
|------------|---------|-------------------|
| `birth` | Biological | `father_id`, `mother_id` |
| `adop` | Adopted | `adoptive_father_id`, `adoptive_mother_id` |
| `step` | Step-child | `stepfather_id`, `stepmother_id` |
| `foster` | Foster child | (stored but not specially handled) |
| (absent) | Assumed biological | `father_id`, `mother_id` |

**Gramps XML Pedigree Types:**

| mrel/frel Value | Meaning | Canvas Roots Field |
|-----------------|---------|-------------------|
| `Birth` | Biological | `father_id`, `mother_id` |
| `Adopted` | Adopted | `adoptive_father_id`, `adoptive_mother_id` |
| `Stepchild` | Step-child | `stepfather_id`, `stepmother_id` |
| `Foster` | Foster child | (stored but not specially handled) |
| (absent) | Assumed biological | `father_id`, `mother_id` |

**GEDCOM X Lineage Types:**

| Lineage Type | Meaning | Canvas Roots Field |
|--------------|---------|-------------------|
| `BiologicalParent` | Biological | `father_id`, `mother_id` |
| `AdoptiveParent` | Adopted | `adoptive_father_id`, `adoptive_mother_id` |
| `StepParent` | Step-parent | `stepfather_id`, `stepmother_id` |
| `FosterParent` | Foster parent | (stored but not specially handled) |
| `GuardianParent` | Guardian | (stored but not specially handled) |
| `SociologicalParent` | Sociological | (stored but not specially handled) |
| (absent) | Assumed biological | `father_id`, `mother_id` |

**New Relationship Types:**

| Type | Line Style | Color |
|------|------------|-------|
| `step_parent` / `step_child` | Dashed | Teal (#14b8a6) |
| `adoptive_parent` / `adopted_child` | Dotted | Cyan (#06b6d4) |

**Statistics Enhancements:**

| Metric | Description |
|--------|-------------|
| **Parent type breakdown** | Counts of biological, step, and adoptive parents in Completeness section |
| **Biologically orphaned** | People with no biological parents but have step/adoptive |
| **Blended family count** | People with multiple parent types |

**Tree Behavior:**
- Ancestor trees: Step/adoptive parents included as leaf nodes (no ancestry recursion)
- Full trees: Step/adoptive parents included by default, follow their connections
- Both respect the include toggles in tree generation UI

See [Step & Adoptive Parent Support Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/step-adoptive-parent-support.md) for implementation details.

---

### Statistics & Reports (v0.12.9)

Comprehensive statistics dashboard and report generation system for analyzing vault data and generating formatted genealogical reports.

**Problem Solved:**
- No centralized view of vault statistics (entity counts, completeness, quality)
- No way to generate standard genealogical reports (Family Group Sheets, Pedigree Charts)
- Data quality issues were scattered and hard to track

**Statistics Dashboard:**

| Section | Description |
|---------|-------------|
| **Entity overview** | Counts for people, events, sources, places, organizations, canvases |
| **Data completeness** | Progress bars for birth dates, death dates, sources, parents, spouses |
| **Data quality** | Clickable issues with drill-down to affected records |
| **Gender distribution** | Visual breakdown with bar chart |
| **Top lists** | Surnames, locations, occupations, sources with drill-down |
| **Extended statistics** | Longevity, family size, marriage patterns, migration, source coverage, timeline density |

**Data Quality Drill-Down:**

| Issue Type | Severity | Description |
|------------|----------|-------------|
| **Date inconsistencies** | Error | Birth after death, age over 120 |
| **Missing birth dates** | Warning | People without birth date |
| **Missing death dates** | Warning | With birth but no death (excluding living) |
| **Orphaned people** | Warning | No relationships at all |
| **Incomplete parents** | Warning | Only one parent linked |
| **Unsourced events** | Info | Events without sources |
| **Places without coordinates** | Info | Missing lat/long |

Click any issue to expand and see affected records. Click a person chip to open their note. Right-click for context menu. Ctrl+hover for preview.

**Report Types:**

| Report | Description |
|--------|-------------|
| **Family Group Sheet** | Single family unit with parents, marriage, children |
| **Individual Summary** | Complete record of one person |
| **Ahnentafel Report** | Numbered ancestor list |
| **Gaps Report** | Analysis of missing data |
| **Register Report** | NGSQ-style descendant numbering |
| **Pedigree Chart** | ASCII ancestor tree |
| **Descendant Chart** | ASCII descendant tree |

**Report Options:**
- Select root person
- Configure generation depth (2-10)
- Toggle details, spouses, sources
- Output as new note or clipboard

**Extended Statistics:**

| Analysis | Description |
|----------|-------------|
| **Longevity** | Average lifespan by decade and location |
| **Family size** | Children per family with distribution |
| **Marriage patterns** | Age at marriage by sex, remarriage rates |
| **Migration** | Birth-to-death location changes, top routes |
| **Source coverage** | Coverage by generation depth |
| **Timeline density** | Events per decade with gap detection |

**Access Points:**
- Control Center → Statistics tab → "Open Statistics Dashboard"
- Command palette: "Canvas Roots: Open Statistics Dashboard"
- Reports section in Statistics Dashboard

See [Statistics & Reports](Statistics-And-Reports) for detailed usage documentation.

---

### Dynamic Note Content (v0.12.8)

Live computed content blocks within person notes using custom code block processors. Content updates dynamically from vault data with option to freeze to static markdown.

**Problem Solved:**
- Person notes contained only frontmatter and user-written content
- Computed data (timelines, relationships) required navigating to Control Center
- No way to see a person's full story in one place

**Features:**

| Feature | Description |
|---------|-------------|
| **Timeline block** | `canvas-roots-timeline` renders chronological events for a person |
| **Relationships block** | `canvas-roots-relationships` shows family members with wikilinks |
| **Freeze to markdown** | Convert live blocks to static markdown via toolbar button |
| **Create Person toggle** | Option to include blocks when creating new person notes |
| **Import wizard toggle** | Option to include blocks during GEDCOM/Gramps/CSV import |
| **Insert commands** | Context menu and command palette actions for existing notes |
| **Bulk insert** | Add blocks to all person notes in a folder |

**Code Block Types:**

~~~markdown
```canvas-roots-timeline
sort: chronological
```

```canvas-roots-relationships
type: immediate
```
~~~

**Timeline Block:**
- Shows birth, death, and all linked events chronologically
- Displays year, event title, and place with wikilinks
- Configuration options: `sort` (chronological/reverse), `include`/`exclude` event types, `limit`

**Relationships Block:**
- Shows parents, spouse(s), children, and optionally siblings
- Each person rendered as clickable wikilink with birth-death dates
- Configuration options: `type` (immediate/extended/all), `include`/`exclude` relationship types

**Freeze to Markdown:**
- Toolbar button converts live block to static markdown
- Preserves wikilinks and formatting
- Useful for export compatibility or manual editing

**Inserting Blocks:**

| Method | Description |
|--------|-------------|
| **Create Person modal** | "Include dynamic blocks" toggle |
| **Import wizards** | "Include dynamic blocks" toggle in GEDCOM/Gramps/CSV import |
| **Context menu** | Right-click person note → "Insert dynamic blocks" |
| **Command palette** | "Canvas Roots: Insert dynamic blocks" |
| **Bulk insert** | Right-click folder → "Insert dynamic blocks in folder" |

**Technical Details:**
- Uses Obsidian's `registerMarkdownCodeBlockProcessor` API
- `DynamicContentService` provides shared utilities for config parsing and data resolution
- `TimelineProcessor` and `RelationshipsProcessor` handle block rendering
- Content computed on note open; manual refresh via code block edit

**Bug Fixes (v0.12.8):**
- Fixed Family Chart zoom buttons showing "NaN%" and causing chart to vanish (incorrect scale multiplier)
- Fixed "Open family chart" showing wrong person instead of current note
- Fixed Family Chart opening in sidebar instead of main workspace

---

### Gramps Source Import (v0.12.6)

Import source and citation records from Gramps XML files, creating Canvas Roots source notes with full metadata and linking citations to person/event notes.

**Problem Solved:**
- Gramps XML import supported people, places, and events, but source/citation records were not imported
- Users migrating from Gramps had to manually recreate source documentation
- Repository metadata and media references were lost during migration

**Features:**

| Feature | Description |
|---------|-------------|
| **Source note creation** | One note per Gramps source record with full metadata |
| **Repository support** | Parse `<repositories>` and `<reporef>` elements for archive/library data |
| **Media references** | Store Gramps media handles in `gramps_media_refs` for manual linking |
| **Source property aliases** | Full property alias support for all 15 source properties |
| **Gramps ID preservation** | Store `gramps_handle` and `gramps_id` for re-import scenarios |
| **Progress indicator** | Real-time progress modal during import |
| **UI toggles** | Obsidian-style toggles for import options |

**Field Mapping:**

| Gramps Field | Canvas Roots Property |
|--------------|----------------------|
| `<stitle>` | `title` |
| `<sauthor>` | `author` |
| `<spubinfo>` | `repository` (fallback) |
| Repository `<rname>` | `repository` |
| Repository `<type>` | `repository_type` |
| `<reporef medium>` | `source_medium` |
| `<noteref>` text | Note body content |
| `<objref>` handles | `gramps_media_refs` |

**Confidence Scale Mapping:**

| Gramps (0-4) | Meaning | Canvas Roots |
|--------------|---------|--------------|
| 0 | Very Low | low |
| 1 | Low | low |
| 2 | Normal | medium |
| 3 | High | high |
| 4 | Very High | high |

**Source Property Aliases:**

All 15 source properties support aliasing via Preferences → Property aliases:

| Property | Description |
|----------|-------------|
| `cr_id` | Unique identifier |
| `cr_type` | Note type (source) |
| `title` | Source title |
| `author` | Author/creator |
| `source_type` | Type (census, vital_record, etc.) |
| `repository` | Archive or website |
| `repository_type` | Library, Archive, etc. |
| `source_medium` | Book, Electronic, etc. |
| `confidence` | High/medium/low |
| `url` | Online source URL |
| `access_date` | Date accessed |
| `citation_detail` | Page, volume, etc. |
| `gramps_handle` | Original Gramps handle |
| `gramps_id` | Original Gramps ID |
| `gramps_media_refs` | Media handles for manual linking |

**Import Options UI:**

The Gramps import modal includes Obsidian-style toggles for:
- Create source notes (enabled by default)
- Create place notes
- Create event notes

Each toggle shows the count of records found in the file.

**Technical Details:**
- Parses `<sources>`, `<citations>`, `<notes>`, and `<repositories>` sections
- Resolves note references to include text in source note body
- Resolves repository references to get name, type, and medium
- Builds citation-to-source mapping for linking to person/event notes
- Source type inferred from title keywords (census, vital_record, church_record, etc.)

See [Gramps Source Import Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/gramps-source-import.md) for full implementation details.

---

### Bulk Source-Image Linking (v0.12.5)

Two wizard tools for managing source images: importing new images as source notes, and linking existing images to existing source notes.

**Problem Solved:**
- Genealogists often have hundreds of source images (census records, vital records, photos) with inconsistent naming conventions
- Manual creation of source notes from images is tedious
- Existing source notes without media require manual attachment of related images
- No way to bulk-process images with intelligent metadata extraction

**Features:**

**Source Image Import Wizard** (`Sources tab → Import`):

| Feature | Description |
|---------|-------------|
| **Folder selection** | Browse vault folders containing source images |
| **Filename parsing** | Extract surnames, years, record types, locations from filenames |
| **Confidence indicators** | Visual dots (green/yellow/orange/gray) showing parse quality |
| **Editable metadata** | Review and correct parsed data before import |
| **Source note creation** | Creates source notes with media wikilinks in frontmatter |

**Source Media Linker Wizard** (`Sources tab → Link`):

| Feature | Description |
|---------|-------------|
| **Target sources** | Only shows source notes without existing media |
| **Smart suggestions** | Scores potential matches based on filename analysis |
| **Auto-selection** | Top suggestion pre-selected with confidence indicator |
| **"+N more" badge** | Shows when alternative suggestions exist |
| **Row highlighting** | Yellow background for rows needing manual selection |
| **Summary breakdown** | Shows auto-matched vs. manual selection counts |

**Filename Parser:**

Extracts metadata from common genealogy image naming patterns:

| Pattern | Extracted Data |
|---------|----------------|
| `smith_census_1900.jpg` | Surname: Smith, Type: census, Year: 1900 |
| `Marriage Cert Boston 1875.jpeg` | Type: marriage, Location: Boston, Year: 1875 |
| `henderson_obituary_1945.jpg` | Surname: Henderson, Type: obituary, Year: 1945 |

**Confidence Scoring:**

| Score Range | Confidence | Visual |
|-------------|------------|--------|
| ≥50 | High | 🟢 Green dot |
| 30-49 | Medium | 🟡 Yellow dot |
| 1-29 | Low | 🟠 Orange dot |
| 0 | None | ⚪ Gray dot |

**Technical Details:**
- `ImageFilenameParser` service handles filename analysis
- Source matching uses scoring algorithm based on surname, year, type, and location overlap
- Media stored as wikilinks in source frontmatter (`media`, `media_2`, etc.)
- Builds on existing `SourceService` for note creation and updates

---

### Calendarium Integration Phase 1 (v0.12.0)

Integration with the [Calendarium](https://github.com/javalent/calendarium) plugin to import calendar definitions for fictional dates.

**Problem Solved:**
- Worldbuilders using Calendarium for fantasy calendar management had to manually recreate calendar definitions in Canvas Roots
- No way to leverage existing Calendarium calendar structure (eras, year directions)

**Features:**

| Feature | Description |
|---------|-------------|
| **Calendar import** | Automatically import Calendarium calendars as Canvas Roots date systems |
| **Era preservation** | Era names, abbreviations, and year directions are preserved |
| **Zero configuration** | Calendars appear automatically when integration is enabled |
| **Invisible when not needed** | Integrations card only appears if Calendarium is installed |

**How It Works:**

1. Install [Calendarium](https://github.com/javalent/calendarium) plugin
2. Open Control Center → Preferences → Integrations
3. Set Integration mode to "Read-only (import calendars)"
4. Calendarium calendars appear in Date Systems card and Create Event modal

**Technical Details:**

- Uses `window.Calendarium` global API
- Waits for Calendarium settings to load before importing
- Converts Calendarium eras to Canvas Roots `FictionalEra` format
- Handles starting eras (epoch 0) and regular eras with dates
- Extracts era abbreviations from Calendarium format strings

**Settings:**

| Setting | Options | Default |
|---------|---------|---------|
| `calendariumIntegration` | `off`, `read` | `off` |

**Future Phases:**
- Phase 2: Display Calendarium events on timelines
- Phase 3: Bidirectional sync between plugins
- Phase 4: Cross-calendar date translation

See [Fictional Date Systems - Calendarium Integration](Fictional-Date-Systems#calendarium-integration) and [Roadmap - Calendarium Integration](Roadmap#calendarium-integration) for details.

---

## v0.11.x

### Export v2 (v0.11.0)

Complete overhaul of export functionality with full entity support and round-trip fidelity with GEDCOM Import v2.

See [export-v2.md](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/export-v2.md) for implementation plan.

**Problem Solved:**
- Previous exports only included people (person notes)
- Events, sources, places, and custom relationships were lost on export
- No round-trip fidelity with GEDCOM Import v2 (import created entity notes, but export discarded them)
- Limited export options and no real-time statistics

**Full Entity Export:**

All four export formats (GEDCOM 5.5.1, GEDCOM X, Gramps XML, CSV) now support:

| Entity Type | Export Support |
|-------------|----------------|
| **People** | Full person records with all properties |
| **Events** | All 22 event types with dates, places, participants, sources, confidence levels |
| **Sources** | Source notes with citations, repositories, quality classification |
| **Places** | Place hierarchy, coordinates, categories, types preserved |
| **Custom Relationships** | Godparent, guardian, mentor, etc. (GEDCOM: ASSO records; other formats: dedicated fields) |

**Enhanced Export UI:**

- **Export statistics preview**: Real-time count of entities before export
  - Shows people count, event count, source count, place count
  - Respects collection filters and branch filters
  - Updates dynamically as options change
- **Entity inclusion toggles**: Granular control over what to include
  - Toggle people, events, sources, places individually
  - Statistics update to reflect selections
- **Format-specific options**:
  - GEDCOM: Version selector (5.5.1 vs 7.0), collection codes toggle, custom relationships toggle
  - All formats: Entity toggles, output location, privacy settings
- **Output location options**:
  - Download file (traditional behavior)
  - Save to vault (specify folder path)
- **Export progress modal**: Full-screen modal showing:
  - Current phase (loading, filtering, privacy, events, sources, places, generating, writing)
  - Progress bar with percentage
  - Running statistics (entities processed so far)
  - Phase-specific icons and labels
- **Last export info**: Display previous export timestamp, entity counts, destination

**Property & Value Alias Integration:**

All exporters now respect user-configured property and value aliases:

- **Property aliases**: Export using canonical property names (e.g., `born` → `BIRT` in GEDCOM)
- **Value aliases**: Map custom event types, sex values, place categories to canonical values before export
- **Gender identity field**: New `gender_identity` property exported appropriately for each format
  - GEDCOM: Custom `_GEND` tag
  - GEDCOM X: `gender` field
  - Gramps XML: Custom attribute
  - CSV: Dedicated column

**Custom Relationships Export:**

GEDCOM 5.5.1 now exports custom relationships as ASSO records:

```gedcom
1 ASSO @I2@
2 RELA godparent
2 NOTE Relationship from 1920-05-15 to 1935-08-20
2 NOTE Became godparent at baptism
```

- Includes relationship type name as RELA descriptor
- Date ranges in NOTE subrecords
- Custom notes preserved
- Only defined relationships exported (not inferred bidirectional ones)
- Toggle option in export settings (enabled by default)

**Round-Trip Fidelity:**

Exports now preserve all data from GEDCOM Import v2:

| Import Creates | Export Preserves |
|----------------|------------------|
| Event notes | All event types, dates, places, participants, sources |
| Source notes | Citations, repositories, confidence levels, media links |
| Place notes | Hierarchy, coordinates, categories, historical names |
| Custom relationships | ASSO records with full metadata |

**Before Export v2:**
```
Import GEDCOM → 500 people, 350 events, 200 sources, 150 places
Export GEDCOM → 500 people only (850 entities lost)
```

**After Export v2:**
```
Import GEDCOM → 500 people, 350 events, 200 sources, 150 places
Export GEDCOM → 500 people, 350 events, 200 sources, 150 places (full fidelity)
```

**Architecture:**

- **Shared ExportOptionsBuilder**: Consolidated UI component used across all export formats
- **Service injection pattern**: Exporters conditionally load EventService, SourceService, PlaceGraphService, RelationshipService
- **Progress callback system**: Unified progress reporting for all export phases
- **ExportStatisticsService**: Calculates real-time entity counts based on current filter settings

---

## v0.10.x

### Sex/Gender Identity Fields (v0.10.20)

Separate `gender_identity` field for inclusive handling of sex and gender, with full export support across all formats.

See [sex-gender-expansion.md](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/sex-gender-expansion.md) for implementation plan (Phases 1-3).

**Problem Solved:**
- The `sex` field follows GEDCOM standards (M/F) for historical record compatibility, but doesn't capture gender identity
- Writers and worldbuilders need separate fields for biological sex vs. gender identity
- LGBTQ+ genealogists researching trans individuals need respectful data handling

**Features:**

**Gender Identity Field (Phase 1):**
- New optional `gender_identity` property on person notes
- Separate from biological `sex` field for historical record accuracy
- Displayed in People tab person details
- Included in all export formats:
  - GEDCOM: Custom `_GEND` tag
  - GEDCOM X: `gender` field
  - Gramps XML: Custom attribute
  - CSV: Dedicated column

**Schema-Based Definitions (Phase 2):**
- Schema system supports custom sex/gender values via `enum` types
- Scoped by collection or universe for worldbuilding
- Example: `sex` values of ["male", "female", "neuter", "hermaphrodite", "asexual"] for alien species

**Value Aliases (Phase 3):**
- Sex field supports 4 canonical values: male, female, nonbinary, unknown
- Built-in synonyms (M → male, F → female)
- Custom aliases configurable via Unified Property Configuration UI
- All exporters respect value aliases

**User Personas:**
- **Genealogist:** Uses `sex` field with GEDCOM M/F values; optionally `gender_identity` for living relatives or LGBTQ+ research
- **Fiction writer / Worldbuilder:** Custom sex values via Schema, separate `gender_identity` field for character development

**Respectful Trans Documentation:**
When documenting trans individuals:
- `name` field holds chosen/current name (displayed by default)
- Optional `birth_name` field for birth records if needed for research
- `gender_identity` captures current identity
- `sex` captures what appears on historical records
- Privacy options can exclude `birth_name` and `sex` from exports

---

### Unified Property Configuration (v0.10.19)

Consolidated property and value alias management in a single interface with comprehensive coverage of all canonical properties.

See [unified-property-config.md](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/unified-property-config.md) for implementation plan.

**Problem Solved:**
- Property aliases were managed through modal-based workflows with limited discoverability
- Users couldn't see which properties supported aliasing without trial and error
- Value aliases were separate from property aliases with inconsistent UI
- No search/filter to find specific properties across ~55 canonical properties

**Features:**

**Property Aliases:**
- **Comprehensive coverage**: All 56 canonical properties across Person (28), Event (20), and Place (8) entity types
- **Collapsible sections**: Properties grouped by entity type (all collapsed by default)
- **Lazy rendering**: Section content only renders when first expanded for performance
- **Search/filter**: Find properties by label, description, canonical name, or common aliases
- **Inline editing**: Configure aliases directly with auto-save on blur
- **Validation**: Checks for empty values, self-aliasing, conflicts with other properties/aliases

**Value Aliases:**
- **Unified interface**: Value aliases styled consistently with property aliases
- **Four value types**: Event type (13 values), Sex (4 values), Place category (6 values), Note type (8 values)
- **Alias count badges**: Section headers show how many aliases are configured per field
- **Inline editing**: Configure value mappings with validation on blur
- **Canonical value labels**: Human-readable display of canonical values

**UI Improvements:**
- Native Obsidian Setting components for consistent look and feel
- Validation on blur (not on keystroke) to avoid blocking partial input
- All sections use HTML `<details>` elements for native collapsibility
- Search box with real-time filtering across all properties

**Property Coverage:**

| Entity Type | Properties | Examples |
|-------------|------------|----------|
| Person | 28 | name, born, died, cr_id, sex, gender_identity, father, mother, spouse, children, birth_place, death_place, occupation, nickname, maiden_name |
| Event | 20 | title, event_type, date, date_precision, place, person, participants, groups, sources, confidence |
| Place | 8 | name, full_name, parent_place, latitude, longitude, place_type, place_category, historical_name |

**Value Coverage:**

| Field | Canonical Values | Examples |
|-------|------------------|----------|
| Event type | 13 | birth, death, marriage, burial, residence, occupation, education, military, immigration, baptism, confirmation, ordination, custom |
| Sex | 4 | male, female, nonbinary, unknown |
| Place category | 6 | real, historical, disputed, legendary, mythological, fictional |
| Note type | 8 | person, place, event, source, organization, map, schema, timeline |

---

### Data Enhancement Pass (v0.10.17)

Commands and UI tools to upgrade existing vaults by creating missing linked entities from existing person note data. Designed for users who imported GEDCOM before Canvas Roots supported event, place, or source note types.

See [data-enhancement-pass.md](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/data-enhancement-pass.md) for implementation plan.

**Use Cases:**
- Imported GEDCOM before v0.10.0: No event notes were created; birth/death dates are flat properties
- Imported GEDCOM before v0.9.0: No source notes; source citations were ignored
- Have place strings instead of wikilinks: `birthPlace: "Dublin, Ireland"` instead of `birthPlace: "[[Dublin, Ireland]]"`
- Want event notes for existing data: Retroactively create event notes to use timeline features

**Generate Place Notes (v0.10.17):**
- Scans person notes for `birth_place`, `death_place` properties
- Scans event notes for `place` properties
- Detects string values (not wikilinks) that need conversion
- Creates place notes with proper hierarchy (parents created first)
- Updates references to use wikilinks
- Preview mode shows what will be created/modified
- Matches existing place notes to avoid duplicates
- Progress indicator during bulk generation with cancel support
- Paginated results table with search/sort after completion
- Edit button on each result to open Edit Place modal

**Planned Features:**
- Generate Events from Dates: Create event notes from person `birthDate`/`deathDate` properties
- Re-parse GEDCOM for Sources: Re-import GEDCOM to extract sources, matching to existing person notes

---

### Type Customization (v0.10.3)

Full type manager for each note category: events, sources, organizations, relationships, and places. Create, edit, hide, and customize types and categories with user-defined names.

**Type Managers:**

Each Control Center tab now includes a "Manage types" card:

| Tab | Types | Features |
|-----|-------|----------|
| Events | 22 built-in event types | Custom types, categories (Core, Extended, Narrative), icon/color |
| Sources | 6 built-in source types | Custom types, categories, description |
| Organizations | 11 built-in org types | Custom types, categories |
| Relationships | 17 built-in relationship types | Custom types, color, line style (solid, dashed, dotted) |
| Places | 16 built-in place types | Custom types, categories, hierarchy level (0-99) |

**Type Management Features:**
- **Create custom types**: Add new types with full customization
- **Override built-in types**: Change name, description, icon, color
- **Hide types**: Remove from dropdowns while preserving existing notes
- **Reset to defaults**: Restore customized built-in types
- **Delete custom types**: Remove user-created types entirely

**Category Management:**
- Create custom categories to group related types
- Rename built-in categories to match your terminology
- Reorder categories with sort order field
- Hide unused categories (built-in or custom)
- "Show all" button to restore hidden categories

**Place Type Specifics:**
- Hierarchy levels (0-99) determine valid parent-child relationships
- Categories (geographic, political, settlement, subdivision, structure) organize the UI
- Users can assign place types to any category regardless of hierarchy
- Quick level presets for common hierarchy positions

**Settings Storage:**
```typescript
// Per-category settings (events shown as example)
customEventTypes: EventTypeDefinition[];
eventTypeCustomizations: Record<string, Partial<EventTypeDefinition>>;
hiddenEventTypes: string[];
customEventCategories: EventCategoryDefinition[];
categoryCustomizations: Record<string, Partial<EventCategoryDefinition>>;
hiddenCategories: string[];
```

**Use Cases:**
- Rename "birth" to "nameday" for fantasy world-building
- Add "coronation" and "succession" event types for dynasty tracking
- Create "Land Records" source type for property research
- Hide unused relationship types like "apprentice" or "mentor"
- Add "Bodies of Water" category for place types

---

### Flexible Note Type Detection (v0.10.2)

Support multiple methods for identifying Canvas Roots note types, avoiding conflicts with other plugins that use the `type` property.

**Problem Solved:**
- The generic `type` property conflicts with other plugins (Templater, Dataview, etc.)
- Some users prefer tags (`#person`) over frontmatter properties
- Need a namespaced property to avoid conflicts

**New Standard: `cr_type`**

New installations now use `cr_type` as the primary type property:
```yaml
cr_type: person
```

This aligns with the existing `cr_id` convention and avoids conflicts with other plugins.

**Detection Methods (checked in order):**
1. **`cr_type` property** - New default, namespaced to avoid conflicts (e.g., `cr_type: person`)
2. **`type` property** - Legacy fallback for existing vaults (e.g., `type: person`)
3. **Tags** - Additional fallback via tags (`#person`, `#place`, `#event`, `#source`, `#map`, `#organization`)
   - Supports nested tags (e.g., `#genealogy/person`)

**Settings:**
- **Primary type property**: Choose between `cr_type` (default) or `type` (legacy)
- **Enable tag-based detection**: Toggle tags as fallback detection method

**Supported Note Types:**
- `person` - Person notes with family relationships
- `place` - Place notes with geographic data
- `event` - Event notes for chronological mapping
- `source` - Source notes for evidence management
- `map` - Custom map configuration notes
- `organization` - Organization notes for hierarchies
- `schema` - Schema validation notes
- `proof_summary` - GPS proof summary notes

**Backwards Compatibility:**
- Existing users automatically keep `type` as their primary (migrated on first load)
- Both properties are always checked (primary first, then fallback)
- Person notes with `cr_id` but no explicit type are still detected as persons
- No migration of existing notes required

---

### GEDCOM Import v2 (v0.10.1)

Enhanced GEDCOM import that creates source notes, event notes, and place notes in addition to person notes.

**Import Options UI:**
- Toggle for each note type: people, events, sources, places
- Filename format selection: Original (John Smith.md), Kebab-case (john-smith.md), Snake_case (john_smith.md)
- Per-type filename formats via "Customize per note type" toggle
- Progress modal showing import phases with running statistics
- File analysis with counts before confirming import

**Source Import:**
- Parse `SOUR` records and `@S1@`-style source references
- Create source notes (`cr_type: source`) with available metadata
- Support for `TITL`, `AUTH`, `PUBL`, `REPO` fields

**Event Import:**
- Create event notes (`cr_type: event`) for all supported GEDCOM tags:
  - **Core (4):** `BIRT`, `DEAT`, `MARR`, `DIV`
  - **Life Events (6):** `BURI`, `CREM`, `ADOP`, `GRAD`, `RETI`, `CENS`
  - **Career/Residence (3):** `RESI`, `OCCU`, `EDUC`
  - **Legal/Estate (4):** `PROB`, `WILL`, `NATU`, `MILI`
  - **Migration (2):** `IMMI`, `EMIG`
  - **Religious (8):** `BAPM`, `CHR`, `CHRA`, `CONF`, `FCOM`, `ORDN`, `BARM`, `BASM`, `BLES`
  - **Family (7):** `ENGA`, `MARB`, `MARC`, `MARL`, `MARS`, `ANUL`, `DIVF`
- Preserve date precision from GEDCOM (`ABT`, `BEF`, `AFT`, `BET`)

**Person Attributes (stored as properties):**
- `DSCR` → `physicalDescription`
- `IDNO` → `identityNumber` (sensitive - redacted from exports)
- `NATI` → `nationality`
- `RELI` → `religion`
- `TITL` → `title`
- `PROP` → `property`
- `CAST` → `caste`
- `NCHI` → `childrenCount`
- `NMR` → `marriageCount`
- `SSN` → `ssn` (sensitive - redacted from exports)

**Place Import:**
- Hierarchical place structure parsing (`City, County, State, Country`)
- Create place notes (`type: place`) with parent/child relationships
- Duplicate detection: case-insensitive matching on `full_name` property
- Fallback matching: title + parent combination for same-named places
- Update existing places (add missing parent links) instead of creating duplicates

**Performance:**
- Optimized connected components analysis (O(n+m) instead of O(n×m))
- Paginated People tab (100 at a time) for large imports
- Progress callback throughout all import phases

**Integration Points:**
- Staging folder support (import to staging, review, then merge)
- Property aliases (use configured property names)
- Value aliases (map GEDCOM event types to Canvas Roots types)

---

### Chronological Story Mapping (v0.10.0)

Event-based timeline visualization supporting genealogists (source-derived events), worldbuilders (canonical events), and writers/plotters (narrative timelines).

See [Events And Timelines](Events-And-Timelines) wiki page for full documentation.

**Features:**
- Event notes (`cr_type: event`) as first-class entities with 22 built-in event types
- Create Event Modal for manual event creation
- Source event extraction ("Extract events" action with smart suggestions)
- Person Timeline view (calendar badge on person list items)
- Family Timeline view (aggregate events for person + spouses + children)
- Place Timeline view (events at a location over time)
- Global Timeline in Events tab with filtering and gap analysis
- Relative ordering with `before`/`after` constraints
- Compute sort order (topological sort from DAG relationships)
- Groups/factions property for filtering by nation, faction, organization
- Timeline Canvas/Excalidraw export with multiple layouts (horizontal, vertical, Gantt)
- Color-coding by event type, category, confidence, or monochrome
- Events Base template with 20 pre-configured views
- Fictional date system integration (`date_system` field, era-based dates)
- Per-canvas style overrides preserved during regeneration

**Event Schema:**
```yaml
cr_type: event
cr_id: "20251205123456"
title: "Birth of John Smith"
event_type: birth
date: 1850-03-15
date_precision: exact
person: "[[John Smith]]"
place: "[[Dublin, Ireland]]"
sources:
  - "[[1850 Birth Certificate]]"
confidence: high
groups:
  - "Smith Family"
```

**Event Types:**
- Core (4): birth, death, marriage, divorce
- Extended (9): burial, residence, occupation, education, military, immigration, baptism, confirmation, ordination
- Narrative (8): anecdote, lore_event, plot_point, flashback, foreshadowing, backstory, climax, resolution

---

## v0.9.x

### Value Aliases (v0.9.4)

Extend Property Aliases to support custom property *values*. Allows users with existing vaults to use custom terminology (e.g., `nameday` instead of `birth` for event types) without editing existing notes.

See [value-aliases.md](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/value-aliases.md) for implementation plan.

**Features:**
- Map custom values to Canvas Roots canonical values
- Support for three field types:
  - **Event type**: `birth`, `death`, `marriage`, `burial`, `residence`, `occupation`, `education`, `military`, `immigration`, `baptism`, `confirmation`, `ordination`, `custom`
  - **Sex**: `male`, `female`, `nonbinary`, `unknown`
  - **Place category**: `real`, `historical`, `disputed`, `legendary`, `mythological`, `fictional`
- Graceful fallback: unknown event types treated as `custom`
- Unified "Aliases" card in Preferences with property names and property values sections

---

### Property Aliases (v0.9.3)

Map custom frontmatter property names to Canvas Roots fields, enabling compatibility with existing vaults and other plugins without requiring property renaming.

See [Settings & Configuration](Settings-And-Configuration) wiki page for configuration documentation.

**Features:**
- Configure aliases in Control Center → Preferences → Property Aliases
- Read resolution: canonical property first, then falls back to aliases
- Write integration: imports create notes with aliased property names
- Essential Properties UI displays aliased property names when configured
- Bases templates generated with aliased property names
- Full support for all person note properties (identity, dates, places, relationships)

**Supported Properties:**
- Identity fields: `name`, `cr_id`, `type`, `sex`, `gender`, `nickname`, `maiden_name`
- Date fields: `born`, `died`
- Location fields: `birth_place`, `death_place`
- Relationship fields: `father`, `father_id`, `mother`, `mother_id`, `spouse`, `spouse_id`, `child`, `children_id`
- Other fields: `occupation`, `universe`, `image`, `sourced_facts`, `relationships`

---

### Events Tab (v0.9.2)

Dedicated Events tab in the Control Center improves discoverability of Fictional Date Systems and provides foundation for Chronological Story Mapping features.

See [events-tab.md](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/events-tab.md) for implementation details.

**Features:**
- **Date systems card**: Moved from Canvas Settings with all existing functionality
- **Statistics card**: Date coverage metrics (birth/death dates), fictional date usage breakdown
- **Event notes card**: Foundation for Chronological Story Mapping

---

### Style Settings Integration (v0.9.1)

Canvas Roots styling options exposed via the [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin.

See [Styling & Theming](Styling-And-Theming) wiki page for full documentation.

**Family Chart View Colors:**
- Female card color (default: `rgb(196, 138, 146)`)
- Male card color (default: `rgb(120, 159, 172)`)
- Unknown gender card color (default: `rgb(211, 211, 211)`)
- Chart background (light/dark themes)
- Card text color (light/dark themes)

**Evidence Visualization Colors:**
- Primary source color (default: `#22c55e` green)
- Secondary source color (default: `#f59e0b` amber)
- Derivative source color (default: `#ef4444` red)
- Research coverage color bands (well-researched, moderate, needs research)

---

### Evidence Visualization (v0.9.0)

Visual research methodology tools aligned with the Genealogical Proof Standard (GPS).

See [evidence-visualization-plan.md](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/evidence-visualization-plan.md) for implementation details.

**Genealogical Standards Support:**

| Standard | Feature |
|----------|---------|
| GPS completeness | Fact coverage map showing sourced vs. unsourced claims |
| Source classification | Primary/secondary/derivative visual indicators |
| Evidence correlation | Proof clusters grouping sources supporting conclusions |
| Conflict documentation | Visual markers for contradictory evidence |
| Written conclusions | Proof summary nodes documenting reasoning |

**Fact-Level Source Coverage:**
```yaml
sourced_facts:
  birth_date:
    sources: ["[[1850 Census]]", "[[Family Bible]]"]
  birth_place:
    sources: ["[[1850 Census]]"]
  death_date:
    sources: []  # Explicitly unsourced
```

**Source Quality Classification:**

| Classification | Meaning | Examples |
|----------------|---------|----------|
| Primary | Created at/near event by participant/witness | Original vital records, census, contemporary letters |
| Secondary | Created later from memory or hearsay | Family bibles (later entries), obituaries, oral histories |
| Derivative | Copies, transcriptions, or abstracts | Database transcriptions, published abstracts |

**Features:**
- Research Gaps Report in Data Quality tab
- Person fact coverage display (which facts have sources)
- Enhanced source indicator tooltips on canvas
- Schema validation for `sourced_facts`
- Source quality visualization with color coding
- Proof summary notes and conflict documentation
- Canvas conflict markers

---

## v0.8.x

### Source Media Gallery & Document Viewer (v0.8.0)

Centralized evidence management linking source documents to person notes.

See [Evidence & Sources](Evidence-And-Sources) wiki page for full documentation.

**Features:**
- Source note type (`cr_type: source`) with frontmatter schema
- 13 built-in source types (census, vital_record, photo, correspondence, newspaper, military, immigration, etc.)
- Source counting using Obsidian's `resolvedLinks` metadata cache
- **Source indicators on generated trees**: Small badges (e.g., "📎 3") on person nodes showing linked source count
  - Color-coded: green for 3+ sources (well-documented), yellow for 1-2 sources
  - Toggle in Settings → Canvas Roots → Canvas styling → "Show source indicators"
- **Media Gallery in Sources Tab**: Thumbnail grid with search and filtering
  - Filter by media type (images, documents)
  - Filter by source type
  - Search by filename or source title
  - Lightbox viewer with keyboard navigation (arrow keys, Escape)
- Sources Bases template with 17 pre-configured views
- **Citation Generator**: Generate formatted citations in multiple styles
  - Chicago Manual of Style
  - Evidence Explained (Elizabeth Shown Mills) - genealogical standard
  - MLA (Modern Language Association)
  - Turabian

**Source Note Schema:**
```yaml
cr_type: source
cr_id: source-1900-census-smith
title: "1900 US Federal Census - Smith Family"
source_type: census
source_date: "1900-06-01"
source_repository: "Ancestry.com"
media: "[[Census 1900.pdf]]"
confidence: high
```

---

## v0.7.x

### Organization Notes (v0.7.0)

Define and visualize non-genealogical hierarchies (houses, guilds, corporations).

**Organization Note Schema:**
```yaml
cr_type: organization
name: "House Stark"
parent_org: "[[The North]]"
org_type: noble_house
founded: "Age of Heroes"
motto: "Winter is Coming"
seat: "[[Winterfell]]"
```

**Person Membership:**
```yaml
house: "[[House Stark]]"
role: "Lord of Winterfell"
house_from: "TA 280"
memberships:
  - org: "[[Night's Watch]]"
    role: "Lord Commander"
    from: "TA 300"
    to: "TA 305"
```

**Visualization:**
- D3-based org chart (tree, radial, dendrogram layouts)
- View by organization or by person
- Color coding by role, tenure, or organization type
- Temporal filtering
- Export as PNG, SVG, PDF

---

### Fictional Date Systems (v0.7.0)

Custom calendars and eras for world-building and historical research.

See [Fictional Date Systems](Fictional-Date-Systems) wiki page for full documentation.

**Features:**
- Era definitions with name, abbreviation, epoch offset, and direction (forward/backward)
- Date parsing for `{abbrev} {year}` format (e.g., "TA 2941", "AC 283")
- Built-in presets: Middle-earth, Westeros, Star Wars, Generic Fantasy calendars
- Universe-scoped calendar systems
- Date Systems card in Events tab
- Test date parsing input for validation
- Custom date system creation with era table editor
- Canonical year conversion for sorting/comparison
- Age calculation within calendar systems

**Usage in Person Notes:**
```yaml
born: "TA 2890"
died: "FoA 61"
```

---

### Custom Relationship Types (v0.7.0)

Define non-familial relationships beyond parent/child/spouse.

See [Custom Relationships](Custom-Relationships) wiki page for full documentation.

**Features:**
- 12 built-in relationship types across 4 categories (Legal, Religious, Professional, Social)
- Relationships Tab in Control Center for management
- Add Relationship Modal with category-grouped dropdown
- Frontmatter storage in `relationships` array
- Canvas edge support with colored edges
- Statistics card with relationship counts

**Schema:**
```yaml
relationships:
  - type: godparent
    target: "[[Jane Doe]]"
    target_id: person-jane-doe
    notes: "Became godparent at baptism in 1920"
```

---

## v0.6.x

### Schema Validation (v0.6.3)

User-defined validation schemas to catch data inconsistencies and enforce data quality rules.

See [Schema Validation](Schema-Validation) wiki page for full documentation.

**Features:**
- **Schema Notes**: New note type (`type: schema`) with JSON code block for schema definition
- **Schemas Tab**: Dedicated Control Center tab for schema management
  - Create Schema modal with full UI (no manual JSON editing required)
  - Edit existing schemas
  - Schema gallery with scope badges
  - Vault-wide validation with results display
  - Recent violations list
- **Schema Scopes**: Apply schemas by collection, folder, universe, or all people
- **Property Validation**:
  - Required properties
  - Type validation (string, number, date, boolean, enum, wikilink, array)
  - Enum validation with allowed values
  - Number range validation (min/max)
  - Wikilink target type validation (verify linked note type)
- **Conditional Requirements**: `requiredIf` conditions based on other properties
- **Custom Constraints**: JavaScript expressions for cross-property validation
- **Data Quality Integration**: Schema violations section in Data Quality tab
- **Commands**: "Open schemas tab", "Validate vault against schemas"

---

### Maps Tab (v0.6.2)

Dedicated Maps tab in Control Center for geographic features management.

See [maps-tab.md](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/maps-tab.md) for implementation details.

**Features:**
- Dedicated Maps tab in Control Center with 4 cards
- **Open Map View card**: Quick access with coordinate coverage stats
- **Custom Maps gallery**: Thumbnail grid with image previews (~150×100px)
  - Map name overlay and universe badge
  - Hover actions: Edit button and context menu button
  - Click thumbnail to open map in Map View
- **Visualizations card**: Migration diagrams and place network tools
- **Map Statistics card**: Coordinate coverage, custom map count, universe list

**Custom Map Management:**
- Create Map Modal for new map notes with image picker, bounds, and universe
- Edit Map Modal to update existing map properties
- Duplicate map with auto-generated unique ID
- Export map configuration to JSON
- Import map from JSON with duplicate ID detection
- Delete map with confirmation dialog

---

### Geographic Features (v0.6.0)

Interactive Map View with Leaflet.js for visualizing family history geographically.

See [leaflet-maps-plan.md](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/leaflet-maps-plan.md) for implementation details.

**Features:**
- Interactive Map View with Leaflet.js and OpenStreetMap tiles
- Color-coded markers (birth, death, marriage, burial) with clustering
- Additional marker types (residence, occupation, education, military, immigration, religious, custom)
- Events array support for multiple life events per person
- Migration paths with directional arrows and person name labels (TextPath)
- Custom image maps for fictional worlds with universe-based switching
- Time slider animation ("who was alive in year X?")
- Heat map layer for geographic concentration
- Fullscreen mode, mini-map, place search
- Side-by-side map comparison (split view)
- GeoJSON and SVG overlay export
- Interactive image alignment (Leaflet.DistortableImage) - drag corners to align maps
- Pixel-based coordinates (L.CRS.Simple) for worldbuilders
- Route/journey visualization (connect all life events chronologically)

---

### Import/Export Enhancements (v0.6.0)

Multiple format support for data interchange with other genealogy software.

**Features:**
- GEDCOM import/export
- GEDCOM X import/export (JSON format)
- Gramps XML import/export
- CSV import/export
- Privacy-aware exports with redaction options
- Separate Import and Export cards in Control Center UI
