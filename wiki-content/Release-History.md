# Release History

This document contains detailed implementation documentation for completed Canvas Roots features. For the current roadmap of planned features, see [Roadmap](Roadmap).

For version-specific changes, see the [CHANGELOG](../CHANGELOG.md) and [GitHub Releases](https://github.com/banisterious/obsidian-canvas-roots/releases).

---

## Table of Contents

- [v0.12.x](#v012x)
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

## v0.12.x

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

See [Gramps Source Import Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/gramps-source-import.md) for full implementation details.

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
| Places | 15 built-in place types | Custom types, categories, hierarchy level (0-99) |

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
