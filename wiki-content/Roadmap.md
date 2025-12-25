# Roadmap

This document outlines planned features for Canvas Roots. For completed features, see [Release History](Release-History). For version-specific changes, see the [GitHub Releases](https://github.com/banisterious/obsidian-canvas-roots/releases).

---

## Table of Contents

- [Completed Features](#completed-features)
- [Planned Features](#planned-features)
  - [v0.17.0: Data Cleanup Bundle](#v0170-data-cleanup-bundle) 📋 Medium
    - [Post-Import Cleanup Wizard](#post-import-cleanup-wizard)
    - [Source Array Migration](#source-array-migration)
  - [Excalidraw Export Enhancements](#excalidraw-export-enhancements) 📋 Medium
  - [Cleanup Wizard Phase 4](#cleanup-wizard-phase-4) 📋 Medium
  - [Universe Management Enhancements](#universe-management-enhancements) 💡 Low
  - [Calendarium Integration](#calendarium-integration) 💡 Low
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

For the complete list of implemented features, see [Release History](Release-History).

| Version | Feature | Summary |
|:-------:|---------|---------|
| v0.16.0 | [Import/Export Hub](Release-History#importexport-hub-v0160) | Modal-based hub with 7-step import and 6-step export wizards, integrated reference numbering |
| v0.15.3 | [Visual Tree PDF Quality Improvements](Release-History#visual-tree-pdf-quality-improvements-v0153) | 4× scale rendering for crisp PDF output, aspect ratio preservation |
| v0.15.3 | [Report Wizard Enhancements](Release-History#report-wizard-enhancements-v0153) | Multi-step wizard with 5 steps, preset system, recent reports tracking |
| v0.15.3 | [Report Generator ODT Export](Release-History#report-generator-odt-export-v0153) | ODT export for all reports, JSZip-based generation, image embedding |
| v0.15.2 | [Calendarium Integration Phase 2](Release-History#calendarium-integration-phase-2-v0152) | Display fc-* dated events on timelines, calendar filter dropdown, timeline badges |

**Earlier releases:** GEDCOM/Gramps/GEDCOM X import, geographic maps, evidence visualization, custom relationship types, fictional calendars, and more. See [Release History](Release-History) for details.

---

## Planned Features

Features are prioritized to complete the data lifecycle: **import → enhance → export/share**.

| Priority | Label | Description |
|----------|-------|-------------|
| ⚡ High | Core workflow | Completes essential data portability |
| 📋 Medium | User value | Highly requested sharing/output features |
| 💡 Low | Specialized | Advanced use cases, niche workflows |

---

### v0.17.0: Data Cleanup Bundle

**Priority:** 📋 Medium — Comprehensive data quality tooling

**Summary:** v0.17.0 bundles two related data quality features: the Post-Import Cleanup Wizard and Source Array Migration. Both features focus on improving data quality after import and are designed to work together—the wizard guides users through the migration as one of its steps.

**Why Bundle These Features:**
- Both address post-import data quality concerns
- Source migration is a breaking change requiring a major version bump
- The wizard provides a natural context for running the migration
- Users benefit from a single, comprehensive cleanup experience

---

#### Post-Import Cleanup Wizard

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
| 6 | Migrate Source Properties | Data Quality tab | Convert indexed sources to array format |
| 7 | Standardize Place Variants | Places tab | Consistent names before geocoding |
| 8 | Bulk Geocode | Places tab | Coordinates for map features |
| 9 | Enrich Place Hierarchy | Places tab | Build containment chains |
| 10 | Flatten Nested Properties | Data Quality tab | Optional: fix frontmatter structure |

**UI Design:**

**Overview Screen:**
- Compact 5×2 tile grid showing all 10 steps at a glance
- Each tile shows: step number, short title, status badge (issue count, "Done", "Pending", or "0 issues")
- Click any tile to view step details
- Current step highlighted with accent border

**Step Types:**

| Type | Steps | Behavior |
|------|-------|----------|
| Review-only | 1 | Generates report for manual review. Issues tagged with which step auto-fixes them. Click row → Person Edit modal; ↗ button → open note in new tab. |
| Batch-fix | 2-6, 10 | Detect issues, show preview, apply fixes automatically with one click. |
| Interactive | 7-9 | Require user decisions per item (e.g., picking canonical place name, confirming geocode matches). |

**Step States:**
- ⏳ Pending — Not yet analyzed
- 🔢 Ready — Issues found, shows count (e.g., "8 fixes")
- ✅ Complete — Operation finished
- ⏭️ Skipped — User chose to skip or no issues found

**Progress Indicator:**
- Compact horizontal bar on step views showing current position
- Checkmarks for complete steps, numbers for pending
- Connects step circles with lines (green when complete)

**Entry Points:**
- Import Wizard results: "Run Cleanup Wizard" button
- Control Center > Data Quality > Quick Start card: Action button
- Command palette: "Canvas Roots: Post-Import Cleanup Wizard"

**Smart Defaults:**
- Pre-analyze vault to show issue counts per step before running
- Auto-skip steps with zero detected issues (with override option)
- Remember last wizard state per vault (resume interrupted cleanup)

**Preview Mode:**
- Each step shows what will change before applying
- Match existing preview patterns (bidirectional fix preview, date normalization preview)
- Clickable rows open edit modals for quick fixes

**Summary Screen:**
- Shows completion stats in a grid (fixes applied, steps skipped)
- Detailed breakdown per step with outcomes
- "Save Report" button creates markdown note in `Canvas Roots/Reports/Cleanup Summary YYYY-MM-DD.md`
- Report includes timestamp, summary stats, and per-step details for audit trail

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
- See [Post-Import Cleanup Wizard Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/post-import-cleanup-wizard.md) for implementation details
- See [Data Quality: Post-Import Cleanup Workflow](Data-Quality#post-import-cleanup-workflow) for manual workflow

---

#### Source Array Migration

**Priority:** 📋 Medium — Modernize source citation storage format

**Summary:** Migrate from indexed source properties (`source`, `source_2`, `source_3`) to a YAML array format (`sources: []`). This change improves scalability, simplifies querying, and aligns with modern frontmatter practices.

**Problem Statement:**

The current indexed format has limitations:
- **Fixed slots:** Only 3 source slots available per entity
- **Query complexity:** Dataview queries must check multiple properties
- **Schema rigidity:** Adding more sources requires schema changes

**Current Format:**
```yaml
source: "[[Birth Certificate.md]]"
source_2: "[[Census 1920.md]]"
source_3: "[[Family Bible.md]]"
```

**New Format:**
```yaml
sources:
  - "[[Birth Certificate.md]]"
  - "[[Census 1920.md]]"
  - "[[Family Bible.md]]"
  - "[[Interview Notes.md]]"  # Unlimited sources
```

**Migration Approach:**

| Phase | Description | Breaking? |
|-------|-------------|-----------|
| Phase 1 | Support both formats (read array, fall back to indexed) | No |
| Phase 2 | Add migration tooling in Data Quality tab | No |
| Phase 3 | Deprecate indexed format (warnings in UI) | No |
| Phase 4 | Remove indexed format support | **Yes** |

**Wizard Integration:**

The source migration is integrated as Step 6 in the Post-Import Cleanup Wizard:
- Pre-scan detects notes using indexed format
- Preview shows proposed changes before applying
- Batch migration with progress indicator
- Skip option if no indexed sources detected

**Technical Notes:**
- New `SourceMigrationService` handles conversion
- Preserves source order during migration
- Updates both person and event notes
- Integrated into `DataQualityService` for consistency

**Documentation:**
- See [Source Array Migration Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/source-array-migration.md) for implementation details

---

### Excalidraw Export Enhancements

**Priority:** 📋 Medium — Richer Excalidraw output with smart connectors and wiki links

**Summary:** Enhance the Excalidraw export feature to leverage the full capabilities of the Obsidian Excalidraw plugin's ExcalidrawAutomate API. Current implementation generates basic shapes; enhancements add smart connectors, clickable wiki links, richer node content, and relationship-aware styling.

**Current Limitations:**
- Manual text sizing (approximate character width calculation)
- Point-to-point arrows that don't adapt when elements are moved
- No wiki links (can't click to navigate to person notes)
- All edges styled the same (no spouse vs parent-child distinction)

**Planned Enhancements:**

| Phase | Feature | Value |
|-------|---------|-------|
| 1 | API Integration | Use ExcalidrawAutomate when available, fallback to JSON |
| 2 | Rich Node Content | Add dates/places like PDF export |
| 3 | Wiki Links | Clickable `[[Person Note]]` links in labels |
| 4 | Smart Connectors | `connectObjects()` for adaptive arrows |
| 5 | Relationship Styling | Dashed lines for spouses, solid for parent-child |
| 6 | Element Grouping | Keep rect+text together as units |

**Technical Approach:**

Detect ExcalidrawAutomate API at runtime:
```typescript
const ea = (window as any).ExcalidrawAutomate;
if (ea) {
    // Use API for smart connectors, accurate text sizing
    ea.connectObjects(personA, "bottom", personB, "top");
} else {
    // Fall back to current JSON generation
}
```

**Key API Features:**
- `ea.measureText()` — Accurate text dimensions
- `ea.connectObjects()` — Smart connectors that snap and adapt
- `ea.addText()` with `box` — Contained text boxes
- `ea.addToGroup()` — Group related elements

**Documentation:**
- See [Excalidraw Export Enhancements Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/excalidraw-export-enhancements.md) for implementation details

---

### Cleanup Wizard Phase 4

**Priority:** 📋 Medium — UX polish and customization for the Post-Import Cleanup Wizard

**Status:** Planning | Depends on v0.17.0 completion

**Summary:** User experience refinements for the Post-Import Cleanup Wizard. These enhancements improve accessibility, allow workflow customization, and add visual polish without changing core functionality.

**Planned Features:**

| Task | Feature | Value |
|------|---------|-------|
| 1 | Keyboard Navigation | Arrow keys, Enter/Escape, number shortcuts for accessibility |
| 2 | Step Transition Animations | Smooth tile expansion, slide transitions, staggered results |
| 3 | Cleanup Profiles | Save/load named configurations (Full, Quick, Places Only) |
| 4 | Step Reordering | Drag-drop tiles with dependency validation |
| 5 | Schema Integration | Hook into future schema validation system |

**Implementation Order:**
1. Keyboard navigation (high priority, accessibility)
2. Animations (quick UX win)
3. Cleanup profiles (power user feature)
4. Step reordering (complex, may not be needed if profiles suffice)
5. Schema integration (deferred until schema validation exists)

**Documentation:**
- See [Cleanup Wizard Phase 4 Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/cleanup-wizard-phase4.md) for detailed specifications

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
