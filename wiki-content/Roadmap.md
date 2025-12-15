# Roadmap

This document outlines planned features for Canvas Roots. For completed features, see [Release History](Release-History). For version-specific changes, see the [GitHub Releases](https://github.com/banisterious/obsidian-canvas-roots/releases).

---

## Table of Contents

- [Completed Features](#completed-features)
- [Planned Features](#planned-features)
  - [Calendarium Integration](#calendarium-integration) ⚡ High
  - [Post-Import Cleanup Wizard](#post-import-cleanup-wizard) 📋 Medium
  - [Configurable Normalization](#configurable-normalization) 📋 Medium
  - [Reports & Print Export](#reports--print-export) 📋 Medium
  - [Statistics Dashboard](#statistics-dashboard) 📋 Medium
  - [Dynamic Note Content](#dynamic-note-content) 📋 Medium
  - [Gramps Source Import](#gramps-source-import) 📋 Medium
  - [Transcript Nodes & Oral History](#transcript-nodes--oral-history) 💡 Low
  - [Step & Adoptive Parent Support](#step--adoptive-parent-support) 💡 Low
- [Future Considerations](#future-considerations)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)

---

## Completed Features

For detailed implementation documentation of completed features, see [Release History](Release-History).

| Version | Feature | Summary |
|:-------:|---------|---------|
| v0.12.5 | [Bulk Source-Image Linking](Release-History#bulk-source-image-linking-v0125) | Import images as sources, link media to existing sources |
| v0.11.0 | [Export v2](Release-History#export-v2-v0110) | Full entity export with round-trip fidelity |
| v0.10.20 | [Sex/Gender Identity Fields](Release-History#sexgender-identity-fields-v01020) | Separate gender_identity field with export support |
| v0.10.19 | [Unified Property Configuration](Release-History#unified-property-configuration-v01019) | Consolidated property and value alias management |
| v0.10.17 | [Data Enhancement Pass](Release-History#data-enhancement-pass-v01017) | Generate place notes from existing data with progress and editing |
| v0.10.3 | [Type Customization](Release-History#type-customization-v0103) | Full type managers for all note categories |
| v0.10.2 | [Flexible Note Type Detection](Release-History#flexible-note-type-detection-v0102) | Support cr_type, tags, avoids conflicts |
| v0.10.1 | [GEDCOM Import v2](Release-History#gedcom-import-v2-v0101) | Enhanced import with sources, events, and places |
| v0.10.0 | [Chronological Story Mapping](Release-History#chronological-story-mapping-v0100) | Event notes, timelines, narrative support |
| v0.9.4 | [Value Aliases](Release-History#value-aliases-v094) | Custom terminology for property values |
| v0.9.3 | [Property Aliases](Release-History#property-aliases-v093) | Map custom property names to canonical fields |
| v0.9.2 | [Events Tab](Release-History#events-tab-v092) | Control Center tab for event management |
| v0.9.1 | [Style Settings Integration](Release-History#style-settings-integration-v091) | Customize colors via Style Settings plugin |
| v0.9.0 | [Evidence Visualization](Release-History#evidence-visualization-v090) | GPS-aligned research methodology tools |
| v0.8.0 | [Source Media Gallery](Release-History#source-media-gallery--document-viewer-v080) | Evidence management and citation generator |
| v0.7.0 | [Organization Notes](Release-History#organization-notes-v070) | Non-genealogical hierarchies |
| v0.7.0 | [Fictional Date Systems](Release-History#fictional-date-systems-v070) | Custom calendars and eras |
| v0.7.0 | [Custom Relationship Types](Release-History#custom-relationship-types-v070) | Non-familial relationships |
| v0.6.3 | [Schema Validation](Release-History#schema-validation-v063) | User-defined data quality rules |
| v0.6.2 | [Maps Tab](Release-History#maps-tab-v062) | Control Center tab for map management |
| v0.6.0 | [Geographic Features](Release-History#geographic-features-v060) | Interactive Leaflet.js map view |
| v0.6.0 | [Import/Export Enhancements](Release-History#importexport-enhancements-v060) | GEDCOM, GEDCOM X, Gramps, CSV support |

---

## Planned Features

Features are prioritized to complete the data lifecycle: **import → enhance → export/share**.

| Priority | Label | Description |
|----------|-------|-------------|
| ⚡ High | Core workflow | Completes essential data portability |
| 📋 Medium | User value | Highly requested sharing/output features |
| 💡 Low | Specialized | Advanced use cases, niche workflows |

---

### Calendarium Integration

**Priority:** ⚡ High — Unified timeline experience for fictional worldbuilders

**Status:** ✅ Phase 1 complete (v0.12.0) | Phases 2-4 planned

**Summary:** Integration with the [Calendarium](https://plugins.javalent.com/calendarium) plugin to share calendar definitions, eliminating duplicate configuration for worldbuilders. Designed to be invisible to users who don't need it—settings default to off, and no UI changes appear unless Calendarium is installed.

**User Feedback (December 2024):**
- Calendar definition is the main value—users want Calendarium for setting up calendar structure (dates, eras), not primarily for events
- Date ranges (`fc-date` + `fc-end`) are important for lifespans, reign periods, residences
- Pain points with Calendarium include era handling and per-calendar frontmatter fields
- Phase 1 (read-only calendar import) validated as the right starting point

**Integration Modes:**

| Mode | Description | Use Case |
|------|-------------|----------|
| Standalone | Canvas Roots manages its own calendars | Users without Calendarium |
| Calendarium Primary | Canvas Roots reads Calendarium calendars | Existing Calendarium users |
| Bidirectional | Full sync between both plugins | Power users wanting unified experience |

**Phased Approach:**
- ✅ **Phase 1 (v0.12.0):** Import calendar definitions from Calendarium—delivers ~80% of value
- **Phase 2:** Display Calendarium events on Canvas Roots timelines; support date ranges (`fc-end`)
- **Phase 3:** Bidirectional sync between plugins
- **Phase 4:** Cross-calendar date translation

**Phase 1 Implementation (v0.12.0):**
- Detects Calendarium plugin installation
- Imports calendar definitions (names, eras, abbreviations, year directions)
- Displays imported calendars in Date Systems card and Create Event modal
- Graceful fallback when Calendarium not installed
- Integrations card hidden when Calendarium not installed

See [Fictional Date Systems - Calendarium Integration](Fictional-Date-Systems#calendarium-integration) for usage documentation.

**Data Mapping (Planned for Phase 2+):**

| Canvas Roots Field | Calendarium Field |
|--------------------|-------------------|
| `fictional_date` | `fc-date` / `fc-start` |
| `fictional_date_end` | `fc-end` |
| `calendar_system` | `fc-calendar` |
| `event_category` | `fc-category` |
| `display_name` | `fc-display-name` |

**Settings:**
- `calendariumIntegration`: off / read-only (bidirectional planned for Phase 3)

**API Integration:** Uses `window.Calendarium` global when available, with graceful fallback when Calendarium is not installed.

**Future Consideration:** Per-calendar frontmatter fields (e.g., `mycalendar-date` instead of `fc-calendar` + `fc-date`) to allow one note to have dates across multiple calendars.

See [Calendarium Integration Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/calendarium-integration.md) for implementation details.

---

### Post-Import Cleanup Wizard

**Priority:** 📋 Medium — Guided workflow for data quality after GEDCOM import

**Summary:** A step-by-step wizard that guides users through the recommended post-import cleanup sequence. After importing a messy GEDCOM file, users currently must navigate multiple Control Center tabs and run operations in the correct order. The wizard consolidates this into a single guided experience.

**Problem Statement:**

After a GEDCOM import (especially from a file with data quality issues), users face:
- **Scattered tools:** Cleanup operations are spread across Data Quality, Places, and other tabs
- **Unknown order:** No guidance on which operations to run first
- **Manual coordination:** Users must remember to run each step and track what's done

**Wizard Steps:**

| Step | Operation | Current Location | Why This Order |
|------|-----------|------------------|----------------|
| 1 | Quality Report | Data Quality tab | Understand scope of issues before fixing |
| 2 | Fix Bidirectional Relationships | People tab | Graph integrity required for other operations |
| 3 | Normalize Date Formats | Data Quality tab | Standardized dates enable age calculations |
| 4 | Normalize Gender Values | Data Quality tab | Required for parent role validation |
| 5 | Clear Orphan References | Data Quality tab | Remove dangling links |
| 6 | Standardize Place Variants | Places tab | Consistent names before geocoding |
| 7 | Bulk Geocode | Places tab | Coordinates for map features |
| 8 | Enrich Place Hierarchy | Places tab | Build containment chains |
| 9 | Flatten Nested Properties | Data Quality tab | Optional: fix frontmatter structure |

**UI Design:**

**Wizard Modal:**
- Multi-step modal with progress indicator (step X of Y)
- Each step shows: description, preview of changes, "Run" button
- Steps can be skipped if not applicable (e.g., no date issues detected)
- Progress persists if wizard is closed and reopened
- Final summary shows what was fixed

**Step States:**
- ⏳ Pending — Not yet analyzed
- ✅ Complete — Operation finished
- ⏭️ Skipped — User chose to skip or no issues found
- ⚠️ Needs Attention — Issues found, awaiting user action

**Entry Points:**
- Button in Import Results modal: "Run Cleanup Wizard"
- Data Quality tab: "Post-Import Cleanup Wizard" button
- Command palette: "Canvas Roots: Post-Import Cleanup Wizard"

**Smart Defaults:**
- Pre-analyze vault to show issue counts per step before running
- Auto-skip steps with zero detected issues (with override option)
- Remember last wizard state per vault (resume interrupted cleanup)

**Preview Mode:**
- Each step shows what will change before applying
- Match existing preview patterns (bidirectional fix preview, date normalization preview)
- Allow selective application within each step

**Phased Implementation:**

**Phase 1 — Core Wizard:**
- Modal with step-by-step navigation
- Run existing batch operations in sequence
- Basic progress tracking

**Phase 2 — Smart Analysis:**
- Pre-scan vault to show issue counts
- Auto-skip steps with no issues
- Persist state across sessions

**Phase 3 — Customization:**
- User-configurable step order
- Save/load cleanup profiles
- Integration with schema validation

**Technical Notes:**
- Reuses existing `DataQualityService` methods
- Reuses existing `GeocodingService` for bulk geocode
- Reuses existing `PlaceGraphService` for hierarchy enrichment
- New `CleanupWizardModal` class orchestrates the flow
- State persisted in `plugin.settings.cleanupWizardState`

**Documentation:**
- See [Data Quality: Post-Import Cleanup Workflow](Data-Quality#post-import-cleanup-workflow) for manual workflow

---

### Configurable Normalization

**Priority:** 📋 Medium — Flexible data standardization for worldbuilders

**Summary:** User-configurable normalization rules for sex/gender values and other enum fields. Allows worldbuilders to define custom normalization targets while genealogists maintain GEDCOM M/F compatibility.

**Current Limitation:** The "Normalize sex values" batch operation standardizes all variations to GEDCOM M/F values. Users with custom sex values (e.g., worldbuilders using "hermaphrodite", "neuter") cannot normalize to their own custom values.

**Planned Features:**

- **Per-universe normalization targets**: Configure which canonical value to normalize to (e.g., universe A normalizes to M/F, universe B normalizes to custom values)
- **Normalization preview**: Show what will change before applying
- **Custom normalization rules**: Define synonym mappings (e.g., "H" → "hermaphrodite")
- **Selective normalization**: Choose which properties to normalize (sex, event types, place categories)
- **Export format mapping**: Map non-standard values to GEDCOM-compatible values during export only

**Integration:**
- Builds on [Value Aliases](Release-History#value-aliases-v094) and [Schema Validation](Release-History#schema-validation-v063)
- Respects universe-scoped schemas for available values
- Uses existing Data Quality tab infrastructure

See [Sex/Gender Identity Expansion Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/sex-gender-expansion.md) for full context (Phase 4).

---

### Reports & Print Export

**Priority:** 📋 Medium — Tangible output for sharing and research documentation

**Summary:** Generate structured reports and print-ready outputs for genealogists, writers, worldbuilders, and historians. Reports are saved as Markdown notes with wikilinks for seamless integration with Obsidian's linking and search.

**User Personas:**
- **Genealogists:** Family Group Sheets, Ahnentafel reports, source bibliographies
- **Writers & Worldbuilders:** Character sheets, cast lists, faction rosters, age audits
- **Historians:** Prosopography reports, cohort analysis, evidence matrices

---

#### Report Types

**Genealogy Reports (v1 Priority):**

| Report | Description |
|--------|-------------|
| **Family Group Sheet** | Single family unit: couple + children with dates, places, sources |
| **Individual Summary** | All known facts for one person with source citations |
| **Ahnentafel Report** | Numbered ancestor list (1=subject, 2=father, 3=mother, etc.) |
| **Register Report** | Descendants with genealogical numbering (NGSQ style) |
| **Pedigree Chart** | Ancestor tree, 4-5 generations per page |
| **Descendant Chart** | All descendants of an ancestor |

**Worldbuilding Reports:**

| Report | Description |
|--------|-------------|
| **Character Sheet** | Single character with relationships, events, affiliations |
| **Cast List** | All characters filtered by universe/collection/faction |
| **Organization Roster** | Members of a faction/guild/house with roles and dates |
| **Faction Timeline** | Events filtered by group tag |
| **Age Audit** | Characters' ages at key story dates (catch anachronisms) |
| **Lifespan Overlap** | Which characters could have met? Matrix of overlapping lifetimes |

**Historian Reports:**

| Report | Description |
|--------|-------------|
| **Source Bibliography** | All sources with full citations, grouped by type |
| **Evidence Matrix** | Facts vs. sources grid showing which sources support which claims |
| **Cohort Analysis** | People sharing characteristics (occupation, location, time period) |
| **Prosopography** | Collective biography of a defined group |

**Creative Writing Reports:**

| Report | Description |
|--------|-------------|
| **Character Arc** | Single character's journey: events, relationships formed/lost |
| **Scene Outline** | Events organized by chapter/book with POV, setting, participants |
| **POV Coverage** | Which events are witnessed by which POV characters |
| **Subplot Timeline** | Events filtered by group tag with arc status and intersections |
| **Appearances by Book** | Character presence across volumes in a series |

---

#### Output Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| **Markdown** | Note with wikilinks, embeddable | Primary format, Obsidian-native |
| **PDF** | Print-ready via browser print | Sharing with family, archival |
| **Dataview Query** | Live query instead of static snapshot | Dynamic reports that auto-update |

**PDF Approach:** Reports generate Markdown with print-optimized CSS. Users print via browser (Ctrl/Cmd+P) for PDF. Power users can use Pandoc for advanced formatting.

---

#### UI & Workflow

**Reports Tab:** New Control Center tab for report generation.

**Report Modal:**
1. Select report type
2. Configure scope (person, collection, date range, place filter)
3. Preview report
4. Generate as Markdown note or copy to clipboard

**Scope & Filtering:**
- Filter by person (ancestors/descendants of X)
- Filter by collection or universe
- Filter by date range
- Filter by place (events at location)
- Privacy toggle (anonymize living persons)

---

#### v1 Priorities

The first implementation will focus on:
1. **Family Group Sheet** — Most requested, good template for other reports
2. **Individual Summary** — Useful for all personas
3. **Ahnentafel Report** — Standard genealogy output

---

#### Future Report Types

These reports are under consideration for later phases:

| Report | Description |
|--------|-------------|
| **Hourglass Chart** | Ancestors + descendants from a focal person |
| **Fan Chart** | Circular ancestor display |
| **Surname Report** | All people sharing a surname |
| **Place Report** | All events/people at a location |
| **Research Log** | Sources consulted, findings, next steps |
| **Conflicting Evidence** | Facts with contradictory sources |
| **Gaps Report** | Missing vital records by generation |

See [Reports Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/reports.md) for implementation details and output examples.

---

### Statistics Dashboard

**Priority:** 📋 Medium — At-a-glance insights into your data

**Summary:** A dedicated Statistics tab in the Control Center providing quantitative insights across all entity types. Designed for genealogists tracking research progress, worldbuilders auditing consistency, and historians analyzing patterns.

**User Personas:**
- **Genealogists:** Track completeness, identify under-researched branches, spot data gaps
- **Worldbuilders:** Audit character demographics, detect timeline inconsistencies
- **Historians:** Analyze cohort patterns, geographic distributions, temporal clustering

---

#### Core Statistics (v1)

**Entity Overview:**

| Statistic | Description |
|-----------|-------------|
| **Entity counts** | People, events, sources, places, organizations by type |
| **Completeness scores** | % of people with birth date, death date, at least one source |
| **Date range** | Earliest to latest dates across all entities |
| **Gender/sex breakdown** | Distribution with chart visualization |

**Top Lists:**

| Statistic | Description |
|-----------|-------------|
| **Top surnames** | Most common surnames with counts |
| **Top locations** | Most referenced places (birth, death, residence) |
| **Top occupations** | Most common occupations |
| **Top sources** | Most-cited sources |

**Quality Metrics:**

| Statistic | Description |
|-----------|-------------|
| **Unsourced facts** | Count of events without source citations |
| **Orphan entities** | Events/sources not linked to any person |
| **Missing vitals** | People missing birth or death dates |
| **Duplicate candidates** | Potential duplicates by name similarity |

---

#### Extended Statistics (v2)

**Demographic Analysis:**

| Statistic | Description |
|-----------|-------------|
| **Longevity analysis** | Average lifespan by generation, time period, or location |
| **Family size patterns** | Average children per family by generation |
| **Marriage patterns** | Age at marriage, remarriage rates, spouse age gaps |
| **Migration flows** | Birth-to-death location changes, immigration patterns |

**Source Coverage:**

| Statistic | Description |
|-----------|-------------|
| **Coverage by generation** | % sourced facts per generation (shows research depth) |
| **Source type distribution** | Primary vs secondary vs derivative sources |
| **Citation density** | Average sources per person/event |

**Worldbuilding Statistics:**

| Statistic | Description |
|-----------|-------------|
| **Characters by universe** | Breakdown across fictional universes |
| **Characters by faction** | Distribution across organizations/factions |
| **Timeline density** | Events per year/era (spot sparse periods) |
| **Active characters by period** | Who was alive when? |

**User-Defined Property Statistics:**

Canvas Roots supports [user-defined schemas](Release-History#schema-validation-v063) with custom properties. v2 statistics will aggregate these:

| Feature | Description |
|---------|-------------|
| **Enum distributions** | For any schema-defined enum property, show value counts |
| **Numeric aggregates** | For numeric properties, show min/max/average/sum |
| **Boolean counts** | For boolean properties, show true/false counts |
| **Property coverage** | % of entities with each custom property populated |

**Example:** If you define a `nobility_rank` enum with values `king`, `duke`, `baron`, `commoner`, the dashboard shows the distribution across your characters.

---

#### UI Design

**Statistics Tab:** New Control Center tab between Events and Import/Export.

**Dashboard Layout:**
- Summary cards at top (entity counts, completeness %)
- Expandable sections by category (Demographics, Quality, Sources, etc.)
- Charts where appropriate (bar charts for distributions, line for trends)
- Drill-down links to filtered entity lists

**Filtering:**
- Scope by collection/universe
- Scope by date range
- Scope by folder (main tree vs staging)

---

#### v1 Priorities

1. **Entity counts** — Basic counts by type
2. **Completeness scores** — Birth/death/source coverage
3. **Top lists** — Surnames, locations, occupations, sources
4. **Quality metrics** — Unsourced, orphans, missing vitals

---

### Dynamic Note Content

**Priority:** 📋 Medium — Live computed content in person notes

**Summary:** Render dynamic, computed content within person notes using code blocks. Content updates live from vault data, with the option to "freeze" to static markdown for editing or export.

**Problem Statement:**

Person notes currently contain only frontmatter and user-written content. Users wanting to see computed data (timelines, relationship lists, statistics) must navigate to Control Center or other views. This breaks the "note as single source of truth" mental model.

---

#### Code Block Types

| Block | Description |
|-------|-------------|
| `cr-timeline` | Chronological list of events linked to this person |
| `cr-relationships` | Family relationships (parents, spouse, children) with links |
| `cr-sources` | Sources citing this person with quality indicators |
| `cr-statistics` | Research coverage, source count, completeness % |
| `cr-places` | Places associated with this person's events |

**Example Usage:**

~~~markdown
## Timeline
```cr-timeline
```

## Family
```cr-relationships
type: immediate
```

## Sources
```cr-sources
sort: quality
```
~~~

---

#### Rendered Output

Code blocks render as styled containers with:
- **Header bar** with block type and toolbar
- **Live content** computed from vault data
- **Toolbar actions**: Copy to clipboard, Convert to markdown, Refresh

**Timeline Example:**
```
┌─────────────────────────────────────────────┐
│ Timeline                          [⋮] [📋] │
├─────────────────────────────────────────────┤
│ • 1845 — Born in [[Dublin, Ireland]]        │
│ • 1867 — Married [[Jane Smith]]             │
│ • 1890 — Resided in [[Boston, MA]]          │
│ • 1912 — Died in [[Boston, MA]]             │
└─────────────────────────────────────────────┘
```

---

#### Freeze to Markdown

Users can convert live code blocks to static markdown for:
- **Manual editing**: Add notes, reorder, customize formatting
- **Export compatibility**: Static markdown works everywhere
- **Historical snapshots**: Preserve state at a point in time
- **Performance**: Reduce live queries in large vaults

**Conversion Process:**
1. Click "Convert to markdown" in toolbar
2. Code block replaced with rendered content
3. Comment marker added for provenance:

```markdown
## Timeline
<!-- cr-timeline: frozen 2025-12-14 -->
- **1845** — Born in [[Dublin, Ireland]]
- **1867** — Married [[Jane Smith]]
- **1912** — Died in [[Boston, MA]]
```

**Refresh Frozen Content:**
- Context menu on frozen sections: "Refresh from live data"
- Shows diff or replaces content
- Updates timestamp marker

---

#### Configuration Options

Code blocks accept optional parameters:

~~~markdown
```cr-timeline
sort: chronological | reverse
include: birth, death, marriage, residence
exclude: occupation
limit: 10
```
~~~

~~~markdown
```cr-relationships
type: immediate | extended | all
include: parents, spouse, children, siblings
```
~~~

---

#### v1 Priorities

1. **cr-timeline** — Most requested, high value for viewing person history
2. **cr-relationships** — Core genealogy use case
3. **Freeze to markdown** — Essential for export and editing workflows

---

### Gramps Source Import

**Priority:** 📋 Medium — Complete Gramps migration support

**Status:** Planned | Phase 1 scoped

**Summary:** Import source and citation records from Gramps XML files, creating Canvas Roots source notes with full metadata and linking citations to person/event notes.

**Problem Statement:**

Gramps XML import currently supports people, places, and events, but source/citation records are not imported. Users migrating from Gramps must manually recreate their source documentation or re-import via GEDCOM (which may lose Gramps-specific metadata).

**Gramps Data Structure:**

Sources in Gramps XML contain:
- **Title** (`<stitle>`) — Source name/description
- **Author** (`<sauthor>`) — Creator of the source material
- **Publication info** (`<spubinfo>`) — Publisher, date, location
- **Notes** (`<noteref>`) — Research notes attached to sources

Citations link sources to facts:
- **Confidence** (0-4 scale) — Certainty level
- **Source reference** (`<sourceref>`) — Link to parent source
- Events reference citations via `<citationref>`

**Phased Implementation:**

**Phase 1 — Core Import:**

| Feature | Description |
|---------|-------------|
| **Source note creation** | One note per Gramps source record |
| **Field mapping** | `stitle` → `title`, `sauthor` → `author`, `spubinfo` → `repository` |
| **Note import** | Attach Gramps notes to source note body |
| **Citation linking** | Add `sources` field to person/event notes with wikilinks |
| **Confidence mapping** | Gramps 0-4 → Canvas Roots high/medium/low |

**Confidence Scale Mapping:**

| Gramps | Meaning | Canvas Roots |
|--------|---------|--------------|
| 0 | Very Low | low |
| 1 | Low | low |
| 2 | Normal | medium |
| 3 | High | high |
| 4 | Very High | high |

**Phase 2 — Extended Features (Future):**

| Feature | Description |
|---------|-------------|
| **Repository support** | Separate repository notes or enhanced source metadata |
| **Media references** | Import media attached to sources |
| **Gramps ID preservation** | Store original IDs for re-import scenarios |

**Relation to GEDCOM:**

GEDCOM import already supports source records. Gramps source import provides:
- Native Gramps field preservation (publication info structure)
- Gramps-specific citation confidence mapping
- Direct migration path without GEDCOM conversion step

See [Gramps Source Import Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/gramps-source-import.md) for implementation details.

---

### Transcript Nodes & Oral History

**Priority:** 💡 Low — Specialized for oral history researchers

**Summary:** Time-stamped citations from audio/video with direct linking.

**Schema:**
```yaml
oral_facts:
  - media: "[[Interview with Grandma.mp3]]"
    timestamp: "1m30s"
    fact_type: birth_date
    quote: "I was born on May 15th, 1922"
```

**Features:**
- Deep links with timestamp: `[[Interview.mp3]]#t=1m30s`
- Range support: `#t=1m30s-2m15s`
- One-click playback from timestamp
- Transcript nodes with speech bubble styling on canvas

**Interview Subject Graph:**
- Map relationship structure of interviews
- Interview as central hub node
- Edge thickness indicates mention frequency

---

### Step & Adoptive Parent Support

**Priority:** 💡 Low — Specialized for blended families and adoption records

**Summary:** Distinguish biological, step, and adoptive parent relationships in person notes. Prevents false parent claim conflicts when GEDCOM files contain non-biological parent relationships.

**Problem Statement:**

Canvas Roots currently assumes all parent relationships are biological. When GEDCOM files contain step-parent or adoptive relationships (via `PEDI` tags), these are imported as primary parent claims, triggering false conflicts.

**Proposed Schema:**

```yaml
# Biological parents (existing)
father_id: abc-123-def-456
mother_id: ghi-789-jkl-012

# Step-parents (new)
stepfather_id: mno-345-pqr-678
stepmother_id: stu-901-vwx-234

# Adoptive parents (new)
adoptive_father_id: yza-567-bcd-890
adoptive_mother_id: efg-123-hij-456
```

**Phased Implementation:**

| Phase | Goal | Features |
|-------|------|----------|
| 1 | Schema & import | New fields, GEDCOM PEDI tag parsing |
| 2 | Conflict detection | Exclude step/adoptive from biological conflicts |
| 3 | Canvas & tree | Visual distinction (dashed/dotted edges) |

**GEDCOM Pedigree Types:**

| PEDI Value | Meaning | Canvas Roots Field |
|------------|---------|-------------------|
| `birth` | Biological | `father_id`, `mother_id` |
| `adop` | Adopted | `adoptive_father_id`, `adoptive_mother_id` |
| `step` | Step-child | `stepfather_id`, `stepmother_id` |

See [Step & Adoptive Parent Support Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/step-adoptive-parent-support.md) for implementation details.

---

## Future Considerations

These features are under consideration but not yet prioritized.

---

### Ghost Nodes for Unresolved Links

**Priority:** 📋 Medium — Visualize incomplete data structures

**Summary:** Display "ghost" or "stub" nodes on canvases for wikilinks in relationship fields that don't resolve to existing notes or notes lacking a `cr_id`. This allows users to visualize the complete intended structure of their family tree or world even when some notes are incomplete or missing.

**Use Cases:**
- **Work-in-progress trees:** See the full intended structure while still creating notes
- **GEDCOM import preview:** Visualize what the tree would look like before all notes are created
- **Research planning:** Show known relationships to people you haven't researched yet
- **Worldbuilding:** Visualize mentioned-but-not-yet-documented characters, places, or organizations

**Scope:** All entity types (people, places, organizations, events).

**Features:**
- Parse wikilinks in relationship fields (father, mother, spouse, parent_place, etc.) that don't resolve to files
- Display stub nodes with distinct styling (dashed borders, muted colors, or "?" indicator)
- Show inferred context on ghost nodes (e.g., if referenced as "father", display "Father of [X]")
- Click-to-create action: clicking a ghost node offers to create the note with pre-filled relationships

**Technical Approach:**
1. During canvas generation, collect all wikilinks from relationship fields
2. Check each link against resolved files and `cr_id` mappings
3. For unresolved links, create placeholder nodes with ghost styling
4. Populate ghost nodes with relationship context inferred from the referencing property

### Research Tracking

Advanced research workflow tools for serious genealogists:

- "Needs research" tags with to-dos
- Confidence levels: verified, probable, possible
- Source documentation per fact
- DNA match tracking
- Research log notes

### Dynasty Management

Tools for tracking succession and inheritance in worldbuilding:

- Line of succession calculator
- Title/position inheritance rules
- Regnal numbering
- Heir designation and succession events

### Sensitive Field Redaction

Automatically redact sensitive personal information (SSN, identity numbers) from exports, regardless of living/deceased status. Currently, sensitive fields imported via GEDCOM v2 are stored but should never appear in exports.

### Data Analysis Scope Expansion

Expand Data Quality → Data Analysis scope options beyond folder-based filtering to include note type filtering:

**Current scope options:**
- All records (main tree)
- Staging folder only

**Proposed additions:**
- Filter by note type (Person, Place, Event, Source, etc.)
- Combined folder + note type filtering
- Note-type-specific validations (e.g., place notes check for missing coordinates, person notes check for missing birth date)

This requires generalizing the `DataQualityIssue` interface to support multiple note types instead of just `PersonNode`.

### Note Creation from Images

Context menu actions to create map or source notes from image files, pre-populating with image link.

### Person Note Templates

Pre-configured templates for different use cases: Researcher (full fields with sources), Casual User (minimal), World-Builder (with universe/fictional dates), Quick Add (bare minimum).

### Accessibility

- Screen reader support with ARIA labels
- High contrast mode
- Keyboard navigation
- WCAG AA compliance

### Obsidian Publish Support

Static HTML/SVG tree generation for Publish sites with privacy-aware export.

---

## Known Limitations

See [known-limitations.md](known-limitations.md) for complete details.

**Key Limitations:**
- Single vault only (no multi-vault merging)
- No undo/redo for Bases edits (platform limitation)
- No bulk operations from Bases multi-select (platform limitation)
- Privacy obfuscation for canvas display not yet implemented
- Interactive Canvas features limited by Obsidian Canvas API

### Context Menu Submenu Behavior

On desktop, submenus don't dismiss when hovering over a different submenu. This is a limitation of Obsidian's native `Menu` API. Potential solutions (flattening menus, modal dialogs, custom menu component) are under consideration based on user feedback.

---

## Contributing

We welcome feedback on feature priorities!

1. Check [existing issues](https://github.com/banisterious/obsidian-canvas-roots/issues)
2. Open a new issue with `feature-request` label
3. Describe your use case and why the feature would be valuable

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

---

**Questions?** Open an issue on [GitHub](https://github.com/banisterious/obsidian-canvas-roots/issues).
