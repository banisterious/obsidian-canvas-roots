# Roadmap

This document outlines planned features for Canvas Roots. For completed features, see [Release History](Release-History). For version-specific changes, see the [GitHub Releases](https://github.com/banisterious/obsidian-canvas-roots/releases).

---

## Table of Contents

- [Completed Features](#completed-features)
- [Planned Features](#planned-features)
  - [Calendarium Integration](#calendarium-integration) ⚡ High
  - [Post-Import Cleanup Wizard](#post-import-cleanup-wizard) 📋 Medium
  - [Extended Report Types](#extended-report-types) 📋 Medium
  - [Universal Media Linking](#universal-media-linking) 📋 Medium
  - [Universe Management Enhancements](#universe-management-enhancements) 💡 Low
  - [Transcript Nodes & Oral History](#transcript-nodes--oral-history) 💡 Low
- [Future Considerations](#future-considerations)
  - [Ghost Nodes for Unresolved Links](#ghost-nodes-for-unresolved-links)
  - [Research Tracking](#research-tracking)
  - [Dynasty Management](#dynasty-management)
  - [Sensitive Field Redaction](#sensitive-field-redaction)
  - [Inclusive Identity & Privacy Enhancements](#inclusive-identity--privacy-enhancements)
  - [Data Analysis Scope Expansion](#data-analysis-scope-expansion)
  - [Person Note Templates](#person-note-templates)
  - [Accessibility](#accessibility)
  - [Obsidian Publish Support](#obsidian-publish-support)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)

---

## Completed Features

For detailed implementation documentation of completed features, see [Release History](Release-History).

| Version | Feature | Summary |
|:-------:|---------|---------|
| v0.13.4 | [PDF Report Export](Release-History#pdf-report-export-v0134) | Export reports as styled PDFs with cover page, logo support, 100% local generation |
| v0.13.0 | [Universe Management](Release-History#universe-management-v0130) | First-class universe entity, Universes tab, setup wizard, statistics integration |
| v0.12.12 | [Configurable Normalization](Release-History#configurable-normalization-v01212) | Schema-aware sex normalization modes for worldbuilders |
| v0.12.10 | [Step & Adoptive Parent Support](Release-History#step--adoptive-parent-support-v01210) | GEDCOM PEDI tags, Gramps mrel/frel, GEDCOM X lineage types, dedicated fields, canvas visualization |
| v0.12.9 | [Statistics & Reports](Statistics-And-Reports) | Dashboard with metrics, drill-down, and genealogical report generation |
| v0.12.8 | [Dynamic Note Content](Release-History#dynamic-note-content-v0128) | Live computed timeline and relationships blocks in person notes |
| v0.12.6 | [Gramps Source Import](Release-History#gramps-source-import-v0126) | Import sources, citations, and repositories from Gramps XML |
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

### Extended Report Types

**Priority:** 📋 Medium — Additional report types for sources, events, and places

**Summary:** Expand the report generator with new report types: a person-focused source documentation report, a vault-wide timeline report, and a place-based summary report. These complement the existing genealogical reports and leverage data from the Sources, Events, and Places tabs.

**Proposed Reports:**

| Report | Category | Description |
|--------|----------|-------------|
| **Source Summary** | Person | All sources cited for a person, grouped by fact type, with quality classification and gaps |
| **Timeline Report** | Event | Chronological list of events with dates, participants, places, and sources |
| **Place Summary** | Place | All events at a location, people associated with the place (born, died, resided) |

**Source Summary Options:**
- Root person picker
- Group by fact type (birth, death, marriage, etc.)
- Show source quality classification (primary/secondary/derivative)
- Include citation details and repository info
- Show confidence levels per fact
- Highlight unsourced facts (gaps analysis)

**Timeline Report Options:**
- Date range filter (from/to)
- Event type filter (birth, death, marriage, military, etc.)
- Person/family filter (events involving specific people)
- Grouping: by year, decade, or person
- Include sources toggle

**Place Summary Options:**
- Root place picker
- Include child places toggle
- Date range filter
- Event type filter
- Include coordinates and map reference

**UI Integration:**
- Add report category selector to Report Generator modal (Genealogical / Timeline / Place)
- Reuse existing PDF export infrastructure
- Same output options: Save to vault, Download as MD, Download as PDF

**Technical Approach:**
- Reuse `EventService` for timeline data
- Reuse `PlaceGraphService` for place hierarchy and associations
- Add new generator methods to `ReportGenerator`
- Add new render methods to `PdfReportRenderer`

---

### Universal Media Linking

**Priority:** 📋 Medium — Enable media attachments for all entity types

**Summary:** Extend the `media` property (currently only supported on Source notes) to Person, Event, Place, and Organization notes. This enables linking images, documents, and other media files to any entity type and provides foundation for Gramps Package (`.gpkg`) import support.

**Current State:**
- Only Source notes support the `media` property
- Bulk Source-Image Linking tool links images to sources
- Family Chart thumbnails not yet implemented

**Proposed Changes:**

| Entity Type | Media Support | Use Cases |
|-------------|---------------|-----------|
| **Person** | Multiple media | Photos, portraits, scanned documents |
| **Event** | Multiple media | Ceremony photos, certificates, newspaper clippings |
| **Place** | Multiple media | Location photos, historical maps, property records |
| **Organization** | Multiple media | Logos, documents, group photos |
| **Source** | Multiple media | ✅ Already supported |

**Features:**
- `media` property accepts array of wikilinks to image/document files
- First media item serves as display thumbnail (Gramps convention)
- "Link Media" action available in context menu for all entity types
- Bulk media linking tool extended beyond sources

**Family Chart Integration:**
- Display first media item as thumbnail on person nodes
- Configurable thumbnail size and position
- Fallback to initials or icon when no media present

**Gramps Package Import:**
- `.gpkg` files bundle media with XML data
- Import extracts media files to configurable folder
- Links media to corresponding entity notes
- Preserves media ordering (first = primary)

**UI Integration:**
- Context menu: "Link Media" action for Person, Event, Place, Organization
- Control Center: Media column/indicator in entity tables
- Dynamic Note Content: `<!-- cr:media-gallery -->` block renders linked media inline
- Canvas nodes: Optional thumbnail display

**Technical Approach:**
- Extend `NoteTypeSchema` to include `media` property for all entity types
- Add `MediaService` with entity-agnostic linking methods
- Extend Gramps import to handle `.gpkg` media extraction
- Add thumbnail rendering to `CanvasNodeRenderer`

**Worldbuilding Use Cases:**

| Entity | Use Cases |
|--------|-----------|
| **Person** | Character portraits, concept art, reference images for visual consistency |
| **Place** | Location art, fantasy maps, floor plans, setting mood boards |
| **Event** | Scene illustrations, battle maps, timeline graphics |
| **Organization** | Faction banners, house sigils, guild logos, heraldry |

Canvas thumbnails are particularly useful for writers — seeing character faces on relationship maps makes it easier to visualize story dynamics.

**Phased Implementation:**

| Phase | Scope |
|-------|-------|
| **Phase 1** | Add `media` property to Person, Event, Place, Organization schemas |
| **Phase 2** | Context menu actions and bulk linking tool |
| **Phase 3** | Family Chart thumbnail display |
| **Phase 4** | Gramps Package (`.gpkg`) import with media extraction |

---

### Universe Management Enhancements

**Priority:** 💡 Low — Advanced features for power users

**Status:** ✅ Core implementation complete | Phase 4 enhancements planned

**Summary:** Additional enhancements to the universe management system. The core universe management features are complete—universe entity type, Universes tab in Control Center, Statistics integration, Guide tab documentation, Create Universe wizard, and context menu actions. These enhancements add power-user features for advanced workflows.

**Current Implementation (Complete):**

- Universe as first-class entity type (`cr_type: universe`)
- UniverseService with CRUD operations, aggregation, orphan detection
- Universes tab in Control Center (conditional visibility)
- Create Universe wizard with guided setup
- Statistics → Universes section with entity counts and drill-down
- Guide tab → Universe notes documentation
- Context menu: "Add essential universe properties"
- Universes base template with 12 pre-configured views

**Planned Enhancements:**

| Feature | Description |
|---------|-------------|
| Universe dashboard | Enhanced overview with visual entity counts, quick access to related entities |
| Universe-scoped filtering | Filter quick switcher and searches by universe |
| Batch operations | Move entities between universes, bulk universe assignment |

**When This Becomes Relevant:**

These enhancements become valuable when users have:
- Multiple universes with many entities each
- Need to reorganize entities between universes
- Want streamlined navigation within a single universe context

See [Universe Management Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/universe-management.md) for implementation details.

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

### Inclusive Identity & Privacy Enhancements

Extend the privacy system to better support inclusive identity management:

- **Pronouns field** - Add `pronouns` property (e.g., "she/her", "they/them") for respectful communication in reports and UI
- **Underscore-prefix privacy convention** - Treat fields prefixed with `_` (e.g., `_previous_names`, `_medical_notes`) as private/sensitive:
  - Exclude from person picker and search results
  - Exclude from canvas labels
  - Require confirmation before including in exports
- **Deadname protection** - Automatic suppression of `_previous_names` in display contexts while preserving for historical research
- **Export privacy warnings** - Show confirmation dialog when exporting data containing private fields

This builds on the existing `sex`/`gender`/`gender_identity` data model documented in [Implementation Details](../docs/developer/implementation-details.md#privacy-and-gender-identity-protection).

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
