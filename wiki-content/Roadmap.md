# Roadmap

This document outlines planned features for Charted Roots. For completed features, see [Release History](Release-History). For version-specific changes, see the [GitHub Releases](https://github.com/banisterious/obsidian-charted-roots/releases).

---

## Table of Contents

- [Completed Features](#completed-features)
- [Planned Features](#planned-features)
  - [GPS Research Workflow Integration](#gps-research-workflow-integration) 📋 Medium
  - [GEDCOM Notes Support](#gedcom-notes-support) 📋 Medium
  - [DNA Match Tracking](#dna-match-tracking) 💡 Low
  - [Per-Map Marker Assignment](#per-map-marker-assignment) 💡 Low
  - [Calendarium Integration](#calendarium-integration) 💡 Low
  - [Transcript Nodes & Oral History](#transcript-nodes--oral-history) 💡 Low
  - [Multiple Surname Support](#multiple-surname-support) 💡 Low
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
| v0.19.5 | [Romantic Relationship Label Preference](Release-History#romantic-relationship-label-preference-v0195) | UI preference to display "Spouse" or "Partner" terminology |
| v0.19.3 | [Place Category Folder Mapping](Release-History#place-category-folder-mapping-v0193) | Automatic organization of places into category-based subfolders |
| v0.19.3 | [Timeline Event Description Display](Release-History#timeline-event-description-display-v0193) | Descriptive event types show description instead of title in timelines |
| v0.19.2 | [Partial Date Support](Release-History#partial-date-support-v0192) | GEDCOM import preserves date precision (year-only, month+year, qualifiers, ranges) |
| v0.19.0 | [Plugin Rename](Release-History#plugin-rename-canvas-roots--charted-roots-v0190) | Renamed from Canvas Roots to Charted Roots with automatic vault migration |
| v0.18.32 | [Automatic Wikilink Resolution](Release-History#automatic-wikilink-resolution-v01832) | Resolve `[[Person Name]]` wikilinks to cr_id values in relationship fields |
| v0.18.28 | [MyHeritage GEDCOM Import Compatibility](Release-History#myheritage-gedcom-import-compatibility-v01828) | Auto-detect and fix MyHeritage GEDCOM exports (BOM, double-encoded entities, `<br>` tags) |

See [Release History](Release-History) for earlier releases.

---

## Planned Features

Features are prioritized to complete the data lifecycle: **import → enhance → export/share**.

| Priority | Label | Description |
|----------|-------|-------------|
| ⚡ High | Core workflow | Completes essential data portability |
| 📋 Medium | User value | Highly requested sharing/output features |
| 💡 Low | Specialized | Advanced use cases, niche workflows |

---

### GPS Research Workflow Integration

**Priority:** 📋 Medium — Supports GPS methodology for serious genealogists

**Status:** Planning (Phase 1 ready for implementation)

**GitHub Issue:** [#145](https://github.com/banisterious/obsidian-charted-roots/issues/145) (consolidates #124, #125)

**Summary:** Enable genealogists to manage research workflow using GPS (Genealogical Proof Standard) methodology with support for research projects, reports, individual research notes, and research journals.

**The Problem:** Serious genealogists need to track research progress, document negative findings, maintain research logs, and synthesize analysis across sources. Current Charted Roots focuses on person/event/source entities but lacks structures for research workflow.

**The Solution:** Four GPS-aligned research entity types:
- **Research Project** — Hub for complex, multi-phase research cases
- **Research Report** — Living/working document analyzing specific questions
- **Individual Research Note (IRN)** — Synthesis between reports and person notes
- **Research Journal** — Optional daily/session tracking across projects

**Phased Approach:**

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Foundation: Entity Recognition & Schemas | Ready for implementation |
| 2 | Workflow Integration: Tagging & Auto-generation | After Phase 1 feedback |
| 3 | Advanced Features: Queries & Timeline Views | Future |

**Phase 1 — Foundation:**
- Entity type recognition for all four types
- Schema validation with Data Quality integration
- Research log parsing (YAML in `## Research Log` sections)
- Properties: `status`, `private`, `up`, `related`, `reportTo`, `subject`
- No UI changes required

**Phase 2 — Workflow Integration (Future):**
- `needs_research` tagging on person/event/place notes
- IRN auto-generation with refresh capability
- Breadcrumb navigation showing hierarchy
- Research log entry form

**Phase 3 — Advanced Features (Future):**
- Negative findings surfacing across projects
- Research timeline views
- Cross-project queries
- Templates/Bases for research entities

**Key Features:**
- **Research logs with negative findings** — Document "searched X, found nothing" scenarios per Mills' methodology
- **Hierarchical organization** — Use `up`/`related` properties for flexible hierarchy (recognized but not enforced)
- **IRNs separate from person notes** — Analysis/synthesis vs structured facts (GPS methodology)
- **Integration with existing features** — Data Quality filtering, schema validation, export privacy

**Documentation:**
- See [Research Workflow Integration Planning](https://github.com/banisterious/obsidian-charted-roots/blob/main/docs/planning/research-workflow-integration.md) for detailed specifications
- Community contributors: @ANYroots (IRN structure, GPS methodology, templates), @wilbry (lightweight approach, unified design)

---

### GEDCOM Notes Support

**Priority:** 📋 Medium — Completes GEDCOM round-trip data portability

**Status:** Planning

**GitHub Issue:** [#179](https://github.com/banisterious/obsidian-charted-roots/issues/179)

**Summary:** Import GEDCOM NOTE records attached to individuals, families, events, and sources. Export notes back to GEDCOM for round-trip compatibility.

**The Problem:** GEDCOM files often contain research notes, biographical narratives, and source transcriptions in NOTE records. Currently these notes are not imported, losing valuable context that genealogists have documented.

**The Solution:** Full NOTE support across import and export:
- Parse individual-level, family-level, event-level, and shared NOTE records
- Support inline notes (`1 NOTE text`) and referenced notes (`1 NOTE @N001@`)
- Handle continuation lines (`CONT`/`CONC`) correctly
- Optional separate note files with wikilinks (like Gramps import)
- Export notes back to GEDCOM format

**Phased Approach:**

| Phase | Feature | Status |
|-------|---------|--------|
| 0 | Preprocessor enhancement for CONT lines | Planning |
| 1 | Parse individual and family notes | Planning |
| 2 | Parse shared NOTE records (0-level) | Planning |
| 3 | Write notes to person/family notes | Planning |
| 4 | Optional separate note files | Planning |
| 5 | Settings UI for note options | Planning |
| 6 | GEDCOM export with notes | Planning |

**Key Features:**
- **Continuation line handling** — Proper CONT (newline) vs CONC (concatenate) support
- **Referenced notes** — Resolve `@N001@` references to shared NOTE records
- **Family notes** — Write to marriage events or relationship notes
- **Separate note files** — Optional feature matching Gramps import behavior
- **Round-trip support** — Preserve note IDs for export compatibility

**User Impact:** Non-breaking change
- Existing imports continue to work
- Notes appear in person note content or as linked files
- New setting toggles for note import behavior

See [GEDCOM Notes Planning Document](https://github.com/banisterious/obsidian-charted-roots/blob/main/docs/planning/gedcom-notes.md) for detailed specifications.

---

### DNA Match Tracking

**Priority:** 💡 Low — Specialized for genetic genealogists

**Status:** Phase 1 complete (v0.18.27+), Phases 2-4 planned

**Summary:** Lightweight DNA match tracking for genetic genealogists, designed to record key DNA matches alongside family tree research. Keeps advanced features out of the way of users who don't need them.

**Design Philosophy:**
- Charted Roots is not a DNA analysis tool—specialized tools (DNAPainter, Genetic Affairs, etc.) handle that well
- Focus on tracking "key matches" (BKM/BMM methodology) rather than comprehensive DNA management
- All phases are opt-in via settings; default experience is unchanged

**Phased Approach (all opt-in):**

| Phase | Feature | Gated By | Status |
|-------|---------|----------|--------|
| 1 | Frontmatter properties (`dna_shared_cm`, `dna_match_type`, etc.) | Documentation only | ✅ Complete (v0.18.27) |
| 2 | DNA Match person subtype with UI support | `enableDnaTracking` setting | Planned |
| 3 | DNA relationship type (bidirectional, non-transitive) | `enableDnaTracking` setting | Planned |
| 4 | Visualization & reports | `enableDnaVisualization` setting | Future |

**Phase 1 — Documentation & Templates:** ✅ Complete (v0.18.27)

- DNA match template snippet in template snippets modal
- "DNA Matches" view in People Bases template (filters by `dna_shared_cm`, sorts by highest matches first)
- DNA property display names in base template
- Documented frontmatter properties for manual use

**Match Types:**
- `BKM` — Best Known Match (confirmed relationship, high confidence)
- `BMM` — Best Mystery Match (strong match, relationship unknown)
- `confirmed` — DNA confirms documented relationship
- `unconfirmed` — Match recorded but not yet analyzed

**Non-Goals:**
- Segment analysis, chromosome browser, match management (use specialized tools)
- Automatic relationship prediction
- DNA import from testing companies

See [DNA Match Tracking Planning Document](https://github.com/banisterious/obsidian-charted-roots/blob/main/docs/planning/dna-match-tracking.md) for detailed specifications.

---

### Per-Map Marker Assignment

**Priority:** 💡 Low — Enables regional and era-specific map organization

**Status:** Planning

**GitHub Issue:** [#153](https://github.com/banisterious/obsidian-charted-roots/issues/153)

**Summary:** Allow places to be restricted to specific custom maps rather than appearing on all maps within a universe. Enables regional maps, era-specific views, and detail-level separation.

**The Problem:** Currently, place markers are filtered by universe only. All places with a matching universe appear on every map that shares that universe. This creates limitations when:
- You have separate regional maps within the same universe (e.g., "Eastern Europe" and "Western Europe" maps for a WWI research project)
- You want different detail levels (e.g., a "London city map" vs. a "Southeast England" regional map)
- You have era-specific maps (e.g., "Colonial America 1750" vs. "Revolutionary War 1776")

**The Solution:** Add optional `maps` (array) or `map_id` (string) property to place notes:

```yaml
# Historical example
name: Fort Ticonderoga
universe: colonial-america
maps:
  - french-indian-war-map
  - revolutionary-war-map
```

**Filtering Logic:**
- If place has no `maps`/`map_id`: Show on all maps with matching universe (current behavior)
- If place has `maps`/`map_id`: Only show on specified map(s)
- Events inherit filtering from their places automatically
- Paths appear only if both endpoints are visible on current map

**Phased Approach:**

| Phase | Feature | Effort | Status |
|-------|---------|--------|--------|
| 1 | Core filtering logic, path filtering | Low | Planning |
| 2 | UI integration (Create/Edit Place modals) | Medium | Future |
| 3 | Documentation updates | Low | Future |

**User Impact:** Non-breaking change
- Existing places without `maps` continue working as today
- Opt-in via frontmatter property
- Supports both single-map and multi-map assignment

See [Per-Map Marker Assignment Planning Document](https://github.com/banisterious/obsidian-charted-roots/blob/main/docs/planning/per-map-marker-assignment.md) for detailed specifications.

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
| Standalone | Charted Roots manages its own calendars | Users without Calendarium |
| Calendarium Primary | Charted Roots reads Calendarium calendars | Existing Calendarium users |
| Bidirectional | Full sync between both plugins | Power users wanting unified experience |

**Phased Approach:**
- ✅ **Phase 1 (v0.12.0):** Import calendar definitions from Calendarium—delivers ~80% of value
- ✅ **Phase 2 (v0.15.2):** Display Calendarium events on Charted Roots timelines; support date ranges (`fc-end`)
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

| Charted Roots Field | Calendarium Field |
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

See [Calendarium Integration Planning Document](https://github.com/banisterious/obsidian-charted-roots/blob/main/docs/planning/archive/calendarium-integration.md) for implementation details.

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

### Multiple Surname Support

**Priority:** 💡 Low — Internationalization for non-Western naming conventions

**Status:** Planning

**GitHub Issue:** [#174](https://github.com/banisterious/obsidian-charted-roots/issues/174)

**Summary:** Support explicit surname properties in frontmatter to handle naming conventions beyond Western "First Last" format. Enables accurate surname statistics for Hispanic, Portuguese, compound, and other multi-surname cultures.

**The Problem:** The "Top Surnames" statistic extracts only the last word of a name as the surname. For "José García López" (Hispanic naming), only "López" is counted while "García" (paternal surname) is ignored.

**The Solution:** Add explicit surname frontmatter properties:

```yaml
# Hispanic (two surnames)
name: "José García López"
surnames:
  - García
  - López

# Compound surname
name: "Maria da Silva"
surname: "da Silva"
```

**Implementation:**
- Add `surname` (string) and `surnames` (array) frontmatter properties
- Populate from GEDCOM `SURN` tag on import
- Statistics use explicit surname(s) when available; fall back to name parsing
- Support in person creation/edit modals

**User Impact:** Non-breaking change
- Existing name parsing continues to work
- Users can optionally add explicit surnames for accurate statistics

See [Multiple Surname Support Planning Document](https://github.com/banisterious/obsidian-charted-roots/blob/main/docs/planning/multiple-surname-support.md) for detailed specifications.

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

**Note:** Charted Roots intentionally avoids dictating naming conventions—this would be an opt-in enhancement for users who follow the ED/page pattern.

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
- Privacy obfuscation for canvas display requires generation-time application (runtime toggle not feasible due to Obsidian Canvas API limitations) — see [#95](https://github.com/banisterious/obsidian-charted-roots/issues/95)
- Interactive Canvas features limited by Obsidian Canvas API

### Context Menu Submenu Behavior

On desktop, submenus don't dismiss when hovering over a different submenu. This is a limitation of Obsidian's native `Menu` API. Potential solutions (flattening menus, modal dialogs, custom menu component) are under consideration based on user feedback.

---

## Contributing

We welcome feedback on feature priorities!

1. Check [existing issues](https://github.com/banisterious/obsidian-charted-roots/issues)
2. Open a new issue with `feature-request` label
3. Describe your use case and why the feature would be valuable

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

---

**Questions?** Open an issue on [GitHub](https://github.com/banisterious/obsidian-charted-roots/issues).
