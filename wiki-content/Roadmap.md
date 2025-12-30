# Roadmap

This document outlines planned features for Canvas Roots. For completed features, see [Release History](Release-History). For version-specific changes, see the [GitHub Releases](https://github.com/banisterious/obsidian-canvas-roots/releases).

---

## Table of Contents

- [Completed Features](#completed-features)
- [Planned Features](#planned-features)
  - [Nested Properties Redesign](#nested-properties-redesign) 📋 Medium
  - [Cleanup Wizard Phase 4](#cleanup-wizard-phase-4) 📋 Medium
  - [Gramps Notes & Family Integration](#gramps-notes--family-integration) 📋 Medium
  - [Custom Map Authoring](#custom-map-authoring) 💡 Low
  - [Custom Relationships on Canvas Trees](#custom-relationships-on-canvas-trees) 💡 Low
  - [Calendarium Integration](#calendarium-integration) 💡 Low
  - [Staging Management](#staging-management) 💡 Low
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
| v0.18.7 | [Inclusive Parent Relationships](Release-History#inclusive-parent-relationships-v0187) | Gender-neutral parent support with customizable labels, bidirectional linking, and full family graph integration |
| v0.18.6 | [Media Upload and Management Enhancement](Release-History#media-upload-and-management-enhancement-v0186) | Direct file upload with drag-and-drop, 6-tile Media Manager dashboard, inline upload in media picker, entity picker with filters |
| v0.18.2 | [Timeline Export Consolidation](Release-History#timeline-export-consolidation-v0182) | Unified timeline exports in Reports wizard with all 8 formats, consolidated filters, deprecation notice on Events tab |
| v0.18.1 | [Create Person Enhancements](Release-History#create-person-enhancements-v0181) | Inline person creation, children management, "Add Another" flow, Family Creation Wizard, nickname property |
| v0.18.0 | [Event Person Property Consolidation](Release-History#event-person-property-consolidation-v0180) | Unified `persons` array for all events, migration wizard step, backward-compatible reading |
| v0.17.5 | [Research Level Property](Release-History#research-level-property-v0175) | Track research progress with 7-level GPS-based system, Edit Modal selector, Research Gaps Report integration |
| v0.17.0 | [Post-Import Cleanup Wizard](Release-History#post-import-cleanup-wizard-v0170) | 10-step guided wizard for post-import data quality (relationships, dates, genders, places, sources) |
| v0.17.0 | [Source Array Migration](Release-History#source-array-migration-v0170) | Migrate indexed source properties to YAML array format with wizard integration |
| v0.16.0 | [Import/Export Hub](Release-History#importexport-hub-v0160) | Modal-based hub with 7-step import and 6-step export wizards, integrated reference numbering |

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

### Nested Properties Redesign

**Priority:** 📋 Medium — Fix architectural incompatibility with Obsidian's property panel

**Status:** Planning

**The Problem:** Two features (`sourced_facts` for evidence tracking, `events` for life events) use nested YAML structures (objects within objects, arrays of objects) that are incompatible with Obsidian's property panel. This causes "Type mismatch" warnings and risks data corruption if users click "update" in the property panel.

**Goal:** Redesign both features to use Obsidian-compatible flat property structures while maintaining full functionality and providing automatic migration for existing users.

**Solution:**

**Evidence Tracking:** Replace nested `sourced_facts` with individual flat properties:
```yaml
# Current (nested - incompatible)
sourced_facts:
  birth_date:
    sources: ["[[1870 Census]]", "[[Birth Cert]]"]

# New (flat - compatible)
sourced_birth_date:
  - "[[1870 Census]]"
  - "[[Birth Cert]]"
```

**Life Events:** Replace inline `events` array with separate event note files:
```yaml
# Current (nested - incompatible)
events:
  - event_type: residence
    place: "[[New York]]"
    date_from: "1920"

# New (flat - compatible)
life_events:
  - "[[Events/John - Residence - NYC 1920]]"
```

**Implementation:**

| Phase | Feature | Description |
|-------|---------|-------------|
| 1 | Flat Alternatives | Add support for new flat property formats |
| 2 | Migration Wizard | Add Cleanup Wizard steps to convert existing data |
| 3 | Backward Compatibility | Read both old and new formats during transition |
| 4 | Deprecation | Mark old format as legacy, encourage migration |

**Benefits:**
- Fully compatible with Obsidian's property panel
- No more confusing "Type mismatch" warnings
- Safer editing experience (no accidental data corruption)
- Event notes become first-class entities (searchable, linkable, organized)

**Documentation:** See [docs/planning/nested-properties-redesign.md](../docs/planning/nested-properties-redesign.md) for full technical plan.

---

### Inclusive Parent Relationships

**Priority:** 📋 Medium — Gender-neutral parent support for diverse families

**Status:** Planning

**The Problem:** Currently, the plugin only supports gendered parent fields (father/mother). Users with nonbinary parents or those who prefer gender-neutral terminology have no way to represent these relationships.

**Goal:** Add opt-in support for gender-neutral parent relationships while preserving the existing father/mother fields for users who prefer them.

**Design Principles:**
- Opt-in, not replacement — don't remove or replace father/mother
- Configurable label — let users customize the terminology
- Non-disruptive — users with traditional setups won't notice any change
- Coexistent — a person can have father, mother, AND parents

**Settings:**

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Enable Inclusive Parents | Toggle | Off | Show gender-neutral parent field in modals |
| Parent Field Label | Text | "Parent" | Customize the UI label (e.g., "Progenitor", "Guardian") |

**Schema:**
- New `parents` array property (wikilinks)
- New `parents_id` array property (Canvas Roots IDs)
- Independent of father/mother — can use either or both

**Phased Implementation:**

| Phase | Feature | Description |
|-------|---------|-------------|
| 1 | Settings & Schema | Add toggle, label setting, and new properties |
| 2 | Create/Edit Modal | Add parents field with multi-select picker |
| 3 | Family Graph | Include parents in relationship displays and calculations |
| 4 | Bidirectional Linking | Optionally sync parent→child relationships |

**Documentation:**
- See [Inclusive Parent Relationships Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/inclusive-parent-relationships.md) for detailed specifications

---

### Cleanup Wizard Phase 4

**Priority:** 📋 Medium — UX polish and customization for the Post-Import Cleanup Wizard

**Status:** Planning | Depends on v0.17.0 completion

**Summary:** User experience refinements for the Post-Import Cleanup Wizard. These enhancements improve accessibility, allow workflow customization, and add visual polish without changing core functionality.

**Planned Features:**

| Task | Feature | Value |
|------|---------|-------|
| 1 | Batch Progress Indicators | Progress bars for large batch operations (Steps 2-6, 10) |
| 2 | Keyboard Navigation | Arrow keys, Enter/Escape, number shortcuts for accessibility |
| 3 | Step Reordering | Drag-drop tiles with dependency validation |
| 4 | Cleanup Profiles | Save/load named configurations (Full, Quick, Places Only) |
| 5 | Step Transition Animations | Smooth tile expansion, slide transitions, staggered results |
| 6 | Schema Integration | Hook into future schema validation system |

**Implementation Order:**
1. Batch progress indicators (high priority, UX improvement for large vaults)
2. Keyboard navigation (high priority, accessibility)
3. Animations (quick UX win)
4. Cleanup profiles (power user feature)
5. Step reordering (complex, may not be needed if profiles suffice)
6. Schema integration (deferred until schema validation exists)

**Documentation:**
- See [Cleanup Wizard Phase 4 Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/cleanup-wizard-phase4.md) for detailed specifications

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

### Custom Map Authoring

**Priority:** 💡 Low — Streamlined map creation and place positioning for custom maps

**Status:** Planning

**Summary:** Enable intuitive custom map creation and place positioning. Currently, setting up a custom map requires understanding coordinate systems and bounds, while adding places requires tedious manual coordinate entry. This feature set provides a guided wizard for map creation and eliminates coordinate friction for place management.

**The Problems:**

1. **Map Creation:** Setting up a custom map requires understanding coordinate systems, bounds, and configuration options upfront
2. **Place Positioning:** Adding places requires opening the map in an external editor, finding pixel coordinates, typing them into frontmatter, and repeating until correct

**Phased Implementation:**

| Phase | Feature | Description |
|-------|---------|-------------|
| 1 | Map Creation Wizard | 4-step guided wizard: select image → configure map → add initial places → review & create |
| 2 | Right-Click to Create Place | Right-click on map → "Create place here" → coordinates auto-filled |
| 3 | Draggable Place Markers | Drag markers to reposition (edit mode), auto-update frontmatter, undo support |
| 4 | Place Coordinate Import | Bulk import places from CSV/JSON with preview and conflict handling |

**Phase 1: Map Creation Wizard**
- Guided 4-step wizard for creating custom maps
- Step 1: Select map image from vault (with preview)
- Step 2: Configure name, universe, coordinate system (pixel default)
- Step 3: Click on map to add initial places (optional)
- Step 4: Review and create all notes at once
- Entry points: Control Center, command palette, image context menu

**Phase 2: Right-Click to Create Place**
- Right-click anywhere on a custom map in Map View
- Context menu: "Create place here"
- Opens Create Place modal with coordinates pre-filled
- No edit mode required (right-click is intentional)
- Works with both geographic and pixel-based maps

**Phase 3: Draggable Place Markers**
- Edit mode required (prevents accidental moves when panning)
- Drag markers to reposition, frontmatter updates automatically
- Toast notification with Undo option (5-second window)
- Rounds to appropriate precision (integers for pixel, 6 decimals for geo)

**Documentation:**
- See [Custom Map Authoring Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/custom-map-authoring.md) for detailed specifications

---

### Custom Relationships on Canvas Trees

**Priority:** 💡 Low — Worldbuilder feature for non-biological lineages

**Status:** Planning

**The Problem:** The `relationships` array in frontmatter is not parsed by the family graph or canvas tree generation. Only direct properties (`stepfather`, `adoptive_father`, etc.) are read. Users who define step-parents or adoptive parents via the relationships array don't see them on canvas trees.

**Summary:** Render custom relationships (defined in the `relationships` frontmatter array) as labeled edges on canvas trees and family charts. Currently, only biological and step/adoptive parent relationships appear on trees — and only when using direct properties, not the relationships array. Custom relationship types like vampire sire/childer, guild master/apprentice, or magical bonds are tracked in the Relationships tab but don't render on visual trees.

**Use Cases:**
- **Vampire lineages:** Sire/childer relationships forming parallel "family" structures
- **Guild apprenticeships:** Master/apprentice lineages in fantasy worldbuilding
- **Magical bonds:** Familiar bonds, mentor relationships, magical adoption
- **Feudal systems:** Lord/vassal relationships, sworn sword bonds
- **Non-biological kinship:** Godparents, sworn siblings, adopted-but-not-legally relationships

**Current Workaround:** Use direct frontmatter properties instead of the relationships array:

```yaml
# Instead of:
relationships:
  - type: adoptive_parent
    target: "[[John Doe]]"

# Use:
adoptive_father: "[[John Doe]]"
```

Users can also configure property aliases (`sire` → `father`) to render custom lineages using the standard parent/child infrastructure, but edges display as generic parent/child rather than with custom labels.

**Proposed Features:**

| Feature | Description |
|---------|-------------|
| Parse `relationships` array | FamilyGraphService reads `relationships` frontmatter entries |
| Map to family roles | `step_parent`, `adoptive_parent`, etc. map to existing step/adoptive parent handling |
| Filter by relationship category | Only render relationships marked as "lineage" or "parent-child" type |
| Custom edge labels | Display relationship type on edge (e.g., "sire", "mentor") |
| Edge styling | Distinct styling for custom vs biological relationships (color, dash pattern) |
| Tree wizard option | Checkbox to include/exclude custom relationships from tree generation |

**Technical Approach:**
1. Parse `relationships` array in `FamilyGraphService.parsePersonFromFrontmatter()`
2. Map relationship types to family graph roles (step_parent → stepfatherCrIds/stepmotherCrIds based on target gender)
3. Add support for foster parents and guardians
4. Apply custom edge styling based on relationship type definitions

**Documentation:**
- See [Relationships Array in Family Graph Planning](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/relationships-array-family-graph.md) for detailed specifications

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

See [Universe Management Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/archive/universe-management.md) for implementation details.

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
