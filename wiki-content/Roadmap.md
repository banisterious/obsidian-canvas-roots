# Roadmap

This document outlines planned features for Canvas Roots. For completed features, see [Release History](Release-History). For version-specific changes, see the [GitHub Releases](https://github.com/banisterious/obsidian-canvas-roots/releases).

---

## Table of Contents

- [Completed Features](#completed-features)
- [Planned Features](#planned-features)
  - [Calendarium Integration](#calendarium-integration) ⚡ High
  - [Post-Import Cleanup Wizard](#post-import-cleanup-wizard) 📋 Medium
  - [Configurable Normalization](#configurable-normalization) 📋 Medium
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
