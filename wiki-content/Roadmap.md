# Roadmap

This document outlines planned features for Canvas Roots. For completed features, see [Release History](Release-History). For version-specific changes, see the [GitHub Releases](https://github.com/banisterious/obsidian-canvas-roots/releases).

---

## Table of Contents

- [Completed Features](#completed-features)
- [Planned Features](#planned-features)
  - [Web Clipper Integration](#web-clipper-integration) 📋 Medium
  - [DMS Coordinate Conversion](#dms-coordinate-conversion) 💡 Low
  - [DNA Match Tracking](#dna-match-tracking) 💡 Low
  - [Calendarium Integration](#calendarium-integration) 💡 Low
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
| v0.18.24 | [Staging Management](Release-History#staging-management-v01824) | Dedicated UI for managing staged imports: view stats, check duplicates, promote to main tree, expandable file lists |
| v0.18.22 | [Export Privacy & Sensitive Data](Release-History#export-privacy--sensitive-data-v01822) | Complete privacy feature set: canvas privacy, sensitive field redaction, private fields, deadname protection, discoverability |
| v0.18.15 | [Card Style Options](Release-History#card-style-options-v01815) | 4 card styles (Rectangle, Circle, Compact, Mini) for Family Chart with state persistence and export support |
| v0.18.15 | [Gramps Notes Phase 4](Release-History#gramps-notes-integration-v01813) | Separate note files (opt-in) with Create Note modal and Notes folder |
| v0.18.14 | [Edit Person Events & Sources](Release-History#edit-person-events--sources-v01814) | Sources and Events sections in Edit Person modal with link/create/unlink, type badges with colors |

**Earlier releases:** Gramps Notes, Cleanup Wizard, Custom Map Authoring, Nested Properties Redesign, and more. See [Release History](Release-History) for details.

---

## Planned Features

Features are prioritized to complete the data lifecycle: **import → enhance → export/share**.

| Priority | Label | Description |
|----------|-------|-------------|
| ⚡ High | Core workflow | Completes essential data portability |
| 📋 Medium | User value | Highly requested sharing/output features |
| 💡 Low | Specialized | Advanced use cases, niche workflows |

---

### Web Clipper Integration

**Priority:** 📋 Medium — Streamlines research capture for all genealogists

**Status:** Planning

**GitHub Issue:** [#128](https://github.com/banisterious/obsidian-canvas-roots/issues/128)

**Summary:** Integration with Obsidian Web Clipper to streamline capturing genealogical data from web sources. Users can already use Web Clipper with Staging Manager (v0.18.24); this feature adds convenience and standardization.

**The Problem:** Genealogists frequently clip data from web sources (obituaries, Find A Grave, FamilySearch, Wikipedia) during research. Users can create their own Web Clipper templates and output to staging, but lack guided integration and standardized templates.

**Phased Approach:**

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | File Watcher & Dashboard Integration | Enabled by [#137](https://github.com/banisterious/obsidian-canvas-roots/issues/137) (v0.18.24) |
| 2 | Official Template Distribution | After community feedback |
| 3 | Enhanced Extraction | Conceptual |

**Phase 1 — File Watcher & Dashboard Integration:**
- Detect clipped notes in staging folder (files with `clip_source_type` or `clipped_from` properties)
- Show Dashboard indicator: "3 new clipped notes"
- Click to open Staging Manager filtered to clipped notes
- Optional desktop notification when clips detected
- Works with any user-created Web Clipper templates

**Phase 2 — Official Template Distribution (Future):**
- Curated JSON template files in `docs/clipper-templates/`
- Templates for: Generic Obituary (LLM), Find A Grave (CSS selectors), FamilySearch Person (CSS selectors), Wikipedia Biography (Schema.org)
- Use canonical Canvas Roots property names
- Community testing phase before official release

**Phase 3 — Enhanced Extraction (Future):**
- Relationship extraction from obituary "survived by" sections
- Multi-person clipping from census pages
- Auto-create source notes linked to clipped people

**Documentation:**
- See [Web Clipper Integration Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/web-clipper-integration.md) for detailed specifications

---

### DMS Coordinate Conversion

**Priority:** 💡 Low — Specialized for genealogists working with historical maps

**Status:** Planning

**Summary:** Opt-in support for entering coordinates in DMS (degrees, minutes, seconds) format when creating places. When enabled, coordinate input fields accept both decimal degrees and DMS formats, automatically converting DMS to decimal for storage.

**Use Case:** Genealogical researchers often copy coordinates from historical maps that use DMS notation (e.g., `33°51'08"N, 83°37'06"W`). Currently, users must manually convert to decimal degrees before entering.

**Feature Toggle:**
- Setting: "Accept DMS coordinate format" (default: off)
- Location: Places section in settings
- When enabled, coordinate inputs accept formats like `33°51'08"N` or `33 51 08 N`

**Supported Formats:**
- `33°51'08"N` — Standard DMS with symbols
- `33 51 08 N` — Space-separated
- `33-51-08-N` — Hyphen-separated
- `N 33 51 08` — Direction prefix
- `33.8522` — Decimal pass-through (always supported)

**Implementation:**
- New utility: `src/utils/coordinate-converter.ts`
- Settings toggle in Places section
- Integration with Create Place modal coordinate inputs
- Unit tests for parser

See [DMS Coordinate Conversion Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/dms-coordinate-conversion.md) for detailed specifications.

---

### DNA Match Tracking

**Priority:** 💡 Low — Specialized for genetic genealogists

**Status:** Planning

**Summary:** Lightweight DNA match tracking for genetic genealogists, designed to record key DNA matches alongside family tree research. Keeps advanced features out of the way of users who don't need them.

**Design Philosophy:**
- Canvas Roots is not a DNA analysis tool—specialized tools (DNAPainter, Genetic Affairs, etc.) handle that well
- Focus on tracking "key matches" (BKM/BMM methodology) rather than comprehensive DNA management
- All phases are opt-in via settings; default experience is unchanged

**Phased Approach (all opt-in):**

| Phase | Feature | Gated By |
|-------|---------|----------|
| 1 | Frontmatter properties (`dna_shared_cm`, `dna_match_type`, etc.) | Documentation only |
| 2 | DNA Match person subtype with UI support | `enableDnaTracking` setting |
| 3 | DNA relationship type (bidirectional, non-transitive) | `enableDnaTracking` setting |
| 4 | Visualization & reports | `enableDnaVisualization` setting |

**Match Types:**
- `BKM` — Best Known Match (confirmed relationship, high confidence)
- `BMM` — Best Mystery Match (strong match, relationship unknown)
- `confirmed` — DNA confirms documented relationship
- `unconfirmed` — Match recorded but not yet analyzed

**Non-Goals:**
- Segment analysis, chromosome browser, match management (use specialized tools)
- Automatic relationship prediction
- DNA import from testing companies

See [DNA Match Tracking Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/dna-match-tracking.md) for detailed specifications.

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

### Research Tracking

**Summary:** Tools for tracking research progress toward GPS-compliant documentation.

**Already Implemented:**
- **Research level property** (v0.17.x) — 7-level scale (0-6) based on Hoitink's "Six Levels of Ancestral Profiles," with Edit Person modal, Research Gaps Report filtering/sorting, and Bases views
- **Confidence levels** — Source confidence (high/medium/low/unknown), proof confidence (proven/probable/possible/disproven)
- **Source documentation per fact** — `sourced_*` properties linking facts to sources, coverage percentages in reports
- **Proof summaries** — GPS-aligned proof summary notes with evidence tracking, conflict detection, and resolution

**Potential Future Additions:**
- Research to-do tracking (per-person or per-fact task lists)
- Research log notes (session-based research journals)

For DNA match tracking, see [DNA Match Tracking](#dna-match-tracking) in Planned Features.

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

**Summary:** Improve usability for users with visual, motor, or cognitive disabilities.

**Already Implemented:**
- **ARIA labels** — Interactive buttons, tiles, and controls include `aria-label` attributes for screen readers
- **Keyboard navigation** — Cleanup Wizard supports arrow keys, Enter/Space activation, and Escape to close (v0.18.11)
- **Focus indicators** — Standard Obsidian focus styles on interactive elements

**Planned Improvements:**
- **Systematic ARIA coverage** — Audit all modals and UI components for missing labels
- **Focus management** — Trap focus in modals, restore focus on close
- **Skip-to-content links** — Allow keyboard users to bypass navigation in Control Center
- **Reduced motion** — Respect `prefers-reduced-motion` for animations
- **Color-independent indicators** — Add icons/patterns alongside color for status (not just red/green)
- **High contrast mode** — Test and adjust colors for high contrast themes

**Testing Approach:**
- Screen reader testing with NVDA (Windows) and VoiceOver (macOS)
- Keyboard-only navigation testing
- Automated accessibility linting where feasible

---

## Known Limitations

See [known-limitations.md](known-limitations.md) for complete details.

**Key Limitations:**
- Single vault only (no multi-vault merging)
- No undo/redo for Bases edits (platform limitation)
- No bulk operations from Bases multi-select (platform limitation)
- Privacy obfuscation for canvas display requires generation-time application (runtime toggle not feasible due to Obsidian Canvas API limitations) — see [#95](https://github.com/banisterious/obsidian-canvas-roots/issues/95)
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
