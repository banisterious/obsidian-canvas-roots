# Roadmap

This document outlines planned features for Canvas Roots. For completed features, see [Release History](Release-History). For version-specific changes, see the [GitHub Releases](https://github.com/banisterious/obsidian-canvas-roots/releases).

---

## Table of Contents

- [Completed Features](#completed-features)
- [Planned Features](#planned-features)
  - [Edit Person Modal: Events & Sources](#edit-person-modal-events--sources) 📋 Medium
  - [Gramps Notes & Family Integration](#gramps-notes--family-integration) 📋 Medium
  - [Calendarium Integration](#calendarium-integration) 💡 Low
  - [Staging Management](#staging-management) 💡 Low
  - [Transcript Nodes & Oral History](#transcript-nodes--oral-history) 💡 Low
- [Future Considerations](#future-considerations)
  - [Ghost Nodes for Unresolved Links](#ghost-nodes-for-unresolved-links)
  - [Research Tracking](#research-tracking)
  - [Dynasty Management](#dynasty-management)
  - [Universe Batch Operations](#universe-batch-operations)
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

For the complete list of implemented features, see [Release History](Release-History).

| Version | Feature | Summary |
|:-------:|---------|---------|
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

### Edit Person Modal: Events & Sources

**Priority:** 📋 Medium — Expand person editing with related entity linking

**Status:** Planning | [#33](https://github.com/banisterious/obsidian-canvas-roots/issues/33)

**Summary:** Add events and sources fields to the Edit Person modal, allowing users to manage all person-related data from a single interface instead of editing multiple notes separately.

**Planned Features:**

| Feature | Description |
|---------|-------------|
| Events section | Display events referencing this person; link existing or create new events |
| Sources section | Multi-value picker to link source notes with create-new support |
| Event linking | Updates event note's `persons` array to include this person |
| Source storage | Stores as `sources` array in person frontmatter |

**Technical Notes:**
- Events use inverse relationships: event notes contain `persons: ["[[Person]]"]`
- Linking an event from the person modal modifies the event note, not the person note
- Sources follow the existing multi-value picker pattern (like spouses/children)
- Uses existing `SourcePickerModal` and `CreateEventModal`

**Implementation Phases:**
1. Sources section (straightforward multi-value picker)
2. Events section (read-only display, then link/create/unlink)
3. Polish (form persistence, duplicate detection, display formatting)

**Documentation:**
- See [Edit Person Events & Sources Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/edit-person-events-sources.md) for detailed specifications

---

### Gramps Notes & Family Integration

**Priority:** 📋 Medium — Preserve research notes and family structure from Gramps imports

**Status:** Planning

**Summary:** Import notes attached to Gramps entities and potentially introduce a Family entity type. Gramps treats notes and families as first-class entities with rich metadata. This feature ensures that data is preserved when importing into Canvas Roots, with optional advanced features for users who need them.

**Design Principles:**
- Start conservatively with embedded notes (appended to entity content)
- Advanced features (separate note files, Family entity, sync) are opt-in
- Preserve all Gramps metadata in frontmatter for future use and round-tripping
- Don't complicate the experience for users with simpler requirements

**Phased Implementation:**

| Phase | Feature | Default |
|-------|---------|---------|
| 1 | Embedded person notes | Enabled |
| 2 | Other entity notes (events, places) | Enabled |
| 3 | Family entity type | Opt-in |
| 4 | Separate note files | Opt-in |
| 5 | Export & sync back to Gramps | Future |

**Privacy Handling:**
- Gramps notes can be marked private (`priv="1"`)
- Phase 1: Add `private: true` to frontmatter; user configures sync/publish exclusions
- Future: Optional separate folder for private content, or skip private notes entirely

**Documentation:**
- See [Gramps Notes & Family Integration Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/gramps-notes-family-integration.md) for detailed specifications

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

### Universe Batch Operations

Bulk operations for managing entities across universes:

- Move entities between universes
- Bulk universe assignment to existing entities
- Universe merge/split tools

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

This builds on the existing `sex`/`gender`/`gender_identity` data model documented in [Specialized Features](../docs/developer/implementation/specialized-features.md#privacy-and-gender-identity-protection).

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
