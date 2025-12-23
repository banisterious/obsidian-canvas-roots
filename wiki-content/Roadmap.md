# Roadmap

This document outlines planned features for Canvas Roots. For completed features, see [Release History](Release-History). For version-specific changes, see the [GitHub Releases](https://github.com/banisterious/obsidian-canvas-roots/releases).

---

## Table of Contents

- [Completed Features](#completed-features)
- [Planned Features](#planned-features)
  - [Calendarium Integration](#calendarium-integration) ⚡ High
  - [Visual Tree PDF Enhancements](#visual-tree-pdf-enhancements) 💡 Low
  - [Post-Import Cleanup Wizard](#post-import-cleanup-wizard) 📋 Medium
  - [Report Wizard Enhancements](#report-wizard-enhancements) 📋 Medium
  - [Report Generator ODT Export](#report-generator-odt-export) 📋 Medium
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

For the complete list of implemented features, see [Release History](Release-History).

| Version | Feature | Summary |
|:-------:|---------|---------|
| v0.15.1 | [Family Chart Export Wizard](Release-History#family-chart-export-wizard-v0151) | Multi-step export wizard with presets, PNG/SVG/PDF/ODT formats, progress modal |
| v0.15.1 | [Family Chart Styling Panel](Release-History#family-chart-styling-panel-v0151) | In-view color theming with 5 presets, custom color picker modal |
| v0.15.0 | [Universal Media Linking](#universal-media-linking) | Media support for all entities, .gpkg import, dynamic galleries |
| v0.14.0 | [Visual Tree Charts](Release-History#visual-tree-charts-v0140) | Unified tree wizard for Canvas/PDF, 4 visual tree report types, custom SVG icons |
| v0.13.6 | [Control Center Dashboard](Release-History#control-center-dashboard-v0136) | Dashboard tab with quick-action tiles, collapsible Vault Health, Recent Files |
| v0.13.4 | [PDF Report Export](Release-History#pdf-report-export-v0134) | Export reports as styled PDFs with cover page and logo support |
| v0.13.0 | [Universe Management](Release-History#universe-management-v0130) | First-class universe entity for worldbuilders |
| v0.12.9 | [Statistics & Reports](Statistics-And-Reports) | Dashboard with metrics, drill-down, and genealogical reports |
| v0.11.0 | [Export v2](Release-History#export-v2-v0110) | Full entity export with round-trip fidelity |

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

### Visual Tree PDF Enhancements

**Priority:** 💡 Low — Improve pdfmake tree rendering to match Family Chart quality

**Summary:** Enhance the pdfmake-based visual tree PDF rendering to match the quality of the Family Chart jsPDF export, enabling eventual library consolidation.

**Current State:**

The unified wizard's PDF output (pdfmake) produces functional but basic tree diagrams. The Family Chart view's PDF export (jsPDF) is significantly better:

| Feature | Family Chart (jsPDF) | Unified Wizard (pdfmake) |
|---------|---------------------|-------------------------|
| Spouse positioning | Side-by-side | Stacked or offset |
| Connector lines | Orthogonal routing | Diagonal lines |
| Node styling | Card with profile icon | Simple boxes |
| Visual indicators | Corner badges | Colored dots |
| Overall polish | Professional | Functional |

**Proposed Improvements:**

| Enhancement | Description |
|-------------|-------------|
| **Orthogonal connectors** | Route lines with right-angle turns instead of diagonals |
| **Profile silhouettes** | Add person icons to node boxes |
| **Spouse layout** | Position spouses side-by-side on same row |
| **Corner badges** | Add indicators for gender, living status, etc. |
| **Better spacing** | Match Family Chart's node arrangement algorithm |

**Benefits of Consolidation (Future):**

- Single PDF library (smaller bundle)
- Unified styling across all PDF exports
- Simpler maintenance

**When to Revisit:**

This becomes higher priority when:
- Users request unified styling across PDF outputs
- Bundle size becomes a concern
- Major updates to either library require maintenance

See [Visual Tree PDF Enhancements Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/visual-tree-pdf-enhancements.md) for technical details.

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

### Report Wizard Enhancements

**Priority:** 📋 Medium — Improved UX for report generation with presets

**Summary:** Refactor the Report Generator modal into a multi-step wizard with additional customization options, a preset system for saved configurations, and recent report tracking. The current modal has grown complex with 13 report types, 5 categories, and extensive PDF options.

**Problem Statement:**

The Report Generator modal now handles:
- 13 report types across 5 categories
- Person/place/universe/collection pickers
- Generation limits and inclusion toggles
- Output method selection (vault, MD, PDF)
- PDF options (page size, cover page, logo, title customization, date format)

This creates cognitive overload for new users and makes adding more options difficult.

**Proposed Solution: Hybrid Wizard + Quick Generate**

| Component | Description |
|-----------|-------------|
| **Quick Generate** | Home screen showing recent reports and saved presets |
| **4-Step Wizard** | Focused steps for full customization |
| **Preset System** | Save and reuse report configurations |

**Wizard Steps:**

| Step | Purpose |
|------|---------|
| 1. Report Type | Category filter + report selection |
| 2. Subject | Person/place/universe/collection picker |
| 3. Content Options | Report-specific toggles (spouses, sources, generations) |
| 4. Output & Styling | Format selection + customization options |

**New Customization Options:**

**PDF Options:**
- Header/footer visibility toggle
- Header alignment (left, center, right)
- Accent color for headers and dividers
- Watermark text with opacity
- Font size (9-12pt)

**Markdown Options:**
- Date format (MDY, DMY, YMD)
- Custom title and subtitle
- Introductory notes (equivalent to PDF cover notes)
- Optional YAML metadata block

**Preset System:**

| Feature | Description |
|---------|-------------|
| **Save Preset** | Capture current configuration with custom name |
| **Preset Cards** | Quick access from home screen |
| **Built-in Presets** | Optional starter presets (Family Archive, Quick Share, Research Draft) |
| **Preset Management** | Edit, duplicate, delete, export presets |

**Phased Implementation:**

| Phase | Scope |
|-------|-------|
| 1 | Wizard container, step navigation, report type + subject steps |
| 2 | Content options step, output step, recent reports tracking |
| 3 | Preset system with save/load/manage |
| 4 | Enhanced PDF options (header/footer, accent color, watermark) |
| 5 | Enhanced Markdown options (date format, title, intro notes) |
| 6 | Advanced features (filename templates, preset export/import) |

**Technical Notes:**
- Refactor `ReportGeneratorModal` into wizard container with step components
- New `ReportWizardState` interface for cross-step state management
- Presets stored in `plugin.settings.reportPresets`
- Recent reports stored in `plugin.settings.recentReports`

See [Report Wizard Enhancements Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/report-wizard-enhancements.md) for full implementation details.

---

### Report Generator ODT Export

**Priority:** 📋 Medium — Enable document merging workflows

**Summary:** Add ODT (Open Document Text) export capability to the Report Generator, enabling users to export genealogical reports in an editable format compatible with LibreOffice Writer and Microsoft Word.

**Motivation:**

Users want to create comprehensive family history documents by combining text reports with visual tree charts. ODT export enables a document merging workflow:

1. Export genealogical reports (Descendant Report, Ancestor Report, etc.) as ODT
2. Export visual tree charts as ODT (from Family Chart Export Modal)
3. Merge documents directly in LibreOffice/Word

**Technical Approach:**

- Use JSZip (already available in Obsidian) + manual XML generation
- No external libraries required
- ODT files are ZIP archives containing XML

**Features:**

| Feature | Description |
|---------|-------------|
| **All report types** | ODT option for all 13 report types |
| **Cover page** | Optional title page using existing cover page options |
| **Rich content** | Tables, lists, bold/italic text |
| **Image embedding** | Visual tree charts embedded as images |

**Phased Implementation:**

| Phase | Scope |
|-------|-------|
| 1 | Core ODT generation (JSZip + XML) |
| 2 | Report Generator integration |
| 3 | Rich content support (tables, lists, formatting) |
| 4 | Image embedding for visual tree reports |
| 5 | Testing with LibreOffice, Word, Google Docs |

See [Report Generator ODT Export Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/report-generator-odt-export.md) for full implementation details.

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
