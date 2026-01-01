# Roadmap

This document outlines planned features for Canvas Roots. For completed features, see [Release History](Release-History). For version-specific changes, see the [GitHub Releases](https://github.com/banisterious/obsidian-canvas-roots/releases).

---

## Table of Contents

- [Completed Features](#completed-features)
- [Planned Features](#planned-features)
  - [Export Privacy & Sensitive Data](#export-privacy--sensitive-data) 📋 Medium
  - [Calendarium Integration](#calendarium-integration) 💡 Low
  - [Staging Management](#staging-management) 💡 Low
  - [Transcript Nodes & Oral History](#transcript-nodes--oral-history) 💡 Low
- [Future Considerations](#future-considerations)
  - [Research Tracking](#research-tracking)
  - [Dynasty Management](#dynasty-management)
  - [Universe Batch Operations](#universe-batch-operations)
  - [Import Wizard Filename Parser Enhancements](#import-wizard-filename-parser-enhancements)
  - [Accessibility](#accessibility)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)

---

## Completed Features

For the complete list of implemented features, see [Release History](Release-History).

| Version | Feature | Summary |
|:-------:|---------|---------|
| v0.18.15 | [Gramps Notes Phase 4](Release-History#gramps-notes-integration-v01813) | Separate note files (opt-in) with Create Note modal and Notes folder |
| v0.18.15 | [Card Style Options](Release-History#card-style-options-v01815) | 4 card styles (Rectangle, Circle, Compact, Mini) for Family Chart with state persistence and export support |
| v0.18.13 | [Gramps Notes Phases 1-2](Release-History#gramps-notes-integration-v01813) | Import notes from Gramps entities with style conversion and privacy handling |
| v0.18.14 | [Edit Person Events & Sources](Release-History#edit-person-events--sources-v01814) | Sources and Events sections in Edit Person modal with link/create/unlink, type badges with colors |
| v0.18.11 | [Cleanup Wizard Phase 4](Release-History#cleanup-wizard-phase-4-v01811) | Batch progress indicators, keyboard navigation for accessibility |
| v0.18.11 | [Property Naming Normalization](Release-History#property-naming-normalization-v01811) | `child` → `children` migration, Cleanup Wizard Step 14, documentation updates |
| v0.18.10 | [Custom Map Authoring](Release-History#custom-map-authoring-v01810) | 4-step Map Creation Wizard, right-click to create places, draggable place markers with undo, icon-only Map View toolbar |
| v0.18.9 | [Nested Properties Redesign](Release-History#nested-properties-redesign-v0189) | Flat property format for evidence tracking (`sourced_*`) and life events (`life_events` → event notes), 13-step Cleanup Wizard |
| v0.18.9 | [Custom Relationships on Canvas Trees](Release-History#custom-relationships-on-canvas-trees-v0189) | Custom relationship types with flat properties, family tree integration via `includeOnFamilyTree` and `familyGraphMapping` |
| v0.18.7 | [Inclusive Parent Relationships](Release-History#inclusive-parent-relationships-v0187) | Gender-neutral parent support with customizable labels, bidirectional linking, and full family graph integration |
| v0.18.6 | [Media Upload and Management Enhancement](Release-History#media-upload-and-management-enhancement-v0186) | Direct file upload with drag-and-drop, 6-tile Media Manager dashboard, inline upload in media picker, entity picker with filters |
| v0.18.2 | [Timeline Export Consolidation](Release-History#timeline-export-consolidation-v0182) | Unified timeline exports in Reports wizard with all 8 formats, consolidated filters, deprecation notice on Events tab |

**Earlier releases:** Create Person enhancements, Event Person consolidation, Research Level property, Post-Import Cleanup Wizard, Import/Export Hub, and more. See [Release History](Release-History) for details.

---

## Planned Features

Features are prioritized to complete the data lifecycle: **import → enhance → export/share**.

| Priority | Label | Description |
|----------|-------|-------------|
| ⚡ High | Core workflow | Completes essential data portability |
| 📋 Medium | User value | Highly requested sharing/output features |
| 💡 Low | Specialized | Advanced use cases, niche workflows |

---

### Export Privacy & Sensitive Data

**Priority:** 📋 Medium — Protect sensitive information in exports and UI display

**Status:** Partial — Infrastructure exists, redaction not yet implemented

**Summary:** Ensure sensitive personal information is properly handled during export and display operations.

**Already Implemented:**
- **Sensitive field identification** — `SENSITIVE_FIELDS` constant identifies `ssn` and `identityNumber` fields imported from GEDCOM
- **Gender identity model** — `sex`/`gender`/`gender_identity` data model (see [Specialized Features](../docs/developer/implementation/specialized-features.md#privacy-and-gender-identity-protection))

**Planned:**
- **Sensitive field redaction** — Automatically exclude SSN, identity numbers from exports regardless of living/deceased status
- **Underscore-prefix privacy convention** — Treat fields prefixed with `_` (e.g., `_previous_names`, `_medical_notes`) as private:
  - Exclude from person picker and search results
  - Exclude from canvas labels
  - Require confirmation before including in exports
- **Deadname protection** — Automatic suppression of `_previous_names` in display contexts while preserving for historical research
- **Export privacy warnings** — Show confirmation dialog when exporting data containing private fields
- **Pronouns field** — Add `pronouns` property for respectful communication in reports and UI

---

### Calendarium Integration

**Priority:** 💡 Low — Unified timeline experience for fictional worldbuilders

**Status:** ✅ Phase 1 complete (v0.12.0) | ✅ Phase 2 complete (v0.15.2) | Phases 3-4 planned

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
- ✅ **Phase 2 (v0.15.2):** Display Calendarium events on Canvas Roots timelines; support date ranges (`fc-end`)
- **Phase 3:** Bidirectional sync between plugins
- **Phase 4:** Cross-calendar date translation

**Phase 1 Implementation (v0.12.0):**
- Detects Calendarium plugin installation
- Imports calendar definitions (names, eras, abbreviations, year directions)
- Displays imported calendars in Date Systems card and Create Event modal
- Graceful fallback when Calendarium not installed
- Integrations card hidden when Calendarium not installed

See [Fictional Date Systems - Calendarium Integration](Fictional-Date-Systems#calendarium-integration) for usage documentation.

**Data Mapping (Planned for Phase 3+):**

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

### Staging Management

**Priority:** 💡 Low — Review and manage imported data before promoting to main tree

**Status:** Planning

**Summary:** Add a dedicated interface for managing data in the staging folder. The Import Wizard supports importing to staging folders, but there's currently no UI to review, check for duplicates, promote, or delete staged imports after they're created.

**The Problem:** After importing data to staging:
1. No way to see what's in staging from the UI
2. No way to check for duplicates against the main tree
3. No way to promote reviewed imports to the main folder
4. No way to delete rejected imports
5. Users must manually move/delete files

**Staging Workflow:**

| Step | Action | Description |
|------|--------|-------------|
| 1 | Import to Staging | Import wizard creates notes in staging subfolder |
| 2 | Review | View imported people, check for duplicates |
| 3 | Resolve | Mark duplicates as "same person" (skip) or "different" (promote) |
| 4 | Promote | Move reviewed files to main people folder |
| 5 | Cleanup | Delete rejected staging data |

**Planned Features:**

| Feature | Description |
|---------|-------------|
| Staging overview | Display staging folder stats, subfolder list with counts |
| Duplicate detection | Compare staging people against main tree by name/ID/dates |
| Duplicate review modal | Side-by-side comparison with resolution options |
| Promote operations | Move files to main tree, skip "same person" duplicates |
| Delete operations | Remove staging files with confirmation |
| Per-subfolder actions | Check/promote/delete individual import batches |

**Entry Points (Proposed):**
- Command palette: "Canvas Roots: Manage staging area"
- Import Wizard success screen: "View in Staging Manager"
- Dashboard tile (when staging has data)

**Services Available:**
- `StagingService` — File operations, stats, promote/delete
- `CrossImportDetectionService` — Duplicate detection and resolution tracking
- `CrossImportReviewModal` — Existing duplicate review UI

**Documentation:**
- See [Staging Management Enhancement Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/staging-management-enhancement.md) for detailed specifications

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

### Research Tracking

**Summary:** Tools for tracking research progress toward GPS-compliant documentation.

**Already Implemented:**
- **Research level property** (v0.17.x) — 7-level scale (0-6) based on Hoitink's "Six Levels of Ancestral Profiles," with Edit Person modal, Research Gaps Report filtering/sorting, and Bases views
- **Confidence levels** — Source confidence (high/medium/low/unknown), proof confidence (proven/probable/possible/disproven)
- **Source documentation per fact** — `sourced_*` properties linking facts to sources, coverage percentages in reports
- **Proof summaries** — GPS-aligned proof summary notes with evidence tracking, conflict detection, and resolution

**Potential Future Additions:**
- Research to-do tracking (per-person or per-fact task lists)
- DNA match tracking (cM values, shared segments, match relationships)
- Research log notes (session-based research journals)

See [Evidence and Sources](Evidence-And-Sources) for documentation on existing features.

### Dynasty Management

Tools for tracking succession and inheritance in worldbuilding:

- Line of succession calculator
- Title/position inheritance rules
- Regnal numbering
- Heir designation and succession events

### Universe Batch Operations

Bulk operations for managing entities across universes:

- Move entities between universes
- Bulk universe assignment to existing entities
- Universe merge/split tools

### Import Wizard Filename Parser Enhancements

Extend the Bulk Source Image Import wizard's filename parser to recognize additional naming conventions used by genealogists:

**Enumeration District / Page patterns:**
- `YYYY-recordType_State_County_Locality-ED-p` (e.g., `1880-census_SC_Chester_Baton-Rouge-ED37-p60`)
- Support for slave schedules: `1850-slave-schedule_VA_Henrico-ED12-p3`

This pattern is already documented as a [recommended naming convention](Evidence-And-Sources#page-level-naming-for-multi-page-records) but not yet recognized by the automatic parser. Benefits include:
- Linking multiple families to the same enumeration page
- Supporting FAN (Friends, Associates, Neighbors) research workflows
- Better handling of enslaved ancestor research where context matters

**Note:** Canvas Roots intentionally avoids dictating naming conventions—this would be an opt-in enhancement for users who follow the ED/page pattern.

### Accessibility

- Screen reader support with ARIA labels
- High contrast mode
- Keyboard navigation
- WCAG AA compliance

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
