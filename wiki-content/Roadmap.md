# Roadmap

This document outlines planned features for Canvas Roots. For release history and completed features, see the [Releases page](https://github.com/banisterious/obsidian-canvas-roots/releases).

---

## Table of Contents

- [Development Priorities](#development-priorities)
- [Planned Features](#planned-features)
  - [Geographic Features (Phase 4)](#geographic-features-phase-4) ✅
  - [Maps Tab (Control Center)](#maps-tab-control-center) ✅
  - [Import/Export Enhancements](#importexport-enhancements) ✅
  - [Schema Validation](#schema-validation--consistency-checks) ✅
  - [Custom Relationship Types](#custom-relationship-types) ✅
  - [Fictional Date Systems](#fictional-date-systems) ✅
  - [Evidence & Source Management](#evidence--source-management) ✅
  - [World-Building Suite](#world-building-suite) ✅
  - [Research & Analysis Tools](#research--analysis-tools)
  - [Print & PDF Export](#print--pdf-export)
- [Future Considerations](#future-considerations)
  - [Person Note Templates](#person-note-templates)
  - [Accessibility](#accessibility)
  - [Obsidian Publish Support](#obsidian-publish-support)
  - [Style Settings Integration](#style-settings-integration)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)

---

## Development Priorities

The following priority order guides future development:

| Priority | Feature | Status |
|:--------:|---------|--------|
| 1 | [Import/Export Enhancements](#importexport-enhancements) | ✅ Complete (v0.6.0) |
| 2 | [Geographic Features (Phase 4)](#geographic-features-phase-4) | ✅ Complete (v0.6.0) |
| 3 | [Maps Tab (Control Center)](#maps-tab-control-center) | ✅ Complete (v0.6.2) |
| 4 | [Schema Validation](#schema-validation--consistency-checks) | ✅ Complete (v0.6.3) |
| 5 | [Custom Relationship Types](#custom-relationship-types) | ✅ Complete (v0.7.0) |
| 6 | [Fictional Date Systems](#fictional-date-systems) | ✅ Complete (v0.7.0) |
| 7 | [Organization Notes](#organization-notes--hierarchy-views) | ✅ Complete (v0.7.0) |
| 8 | [Source Media Gallery](#source-media-gallery--document-viewer) | ✅ Complete (v0.8.0) |
| 9 | [Evidence Visualization](#evidence-visualization) | Planned |
| 10 | [Transcript Nodes & Oral History](#transcript-nodes--quotable-facts) | Planned |
| 11 | [Print & PDF Export](#print--pdf-export) | Planned |
| 12 | [Style Settings Integration](#style-settings-integration) | Planned |

---

## Planned Features

### Geographic Features (Phase 4) ✅

> **Complete in v0.6.0.** See [leaflet-maps-plan.md](../docs/planning/leaflet-maps-plan.md) for implementation details.

**Implemented Features:**
- Interactive Map View with Leaflet.js and OpenStreetMap tiles
- Color-coded markers (birth, death, marriage, burial) with clustering
- Additional marker types (residence, occupation, education, military, immigration, religious, custom)
- Events array support for multiple life events per person
- Migration paths with directional arrows and person name labels (TextPath)
- Custom image maps for fictional worlds with universe-based switching
- Time slider animation ("who was alive in year X?")
- Heat map layer for geographic concentration
- Fullscreen mode, mini-map, place search
- Side-by-side map comparison (split view)
- GeoJSON and SVG overlay export
- Interactive image alignment (Leaflet.DistortableImage) - drag corners to align maps
- Pixel-based coordinates (L.CRS.Simple) for worldbuilders
- Route/journey visualization (connect all life events chronologically)

**Future Enhancements (v2+):** See [leaflet-maps-plan.md § Design Decisions](../docs/planning/leaflet-maps-plan.md#design-decisions) for detailed rationale.
- Offline tile caching for OSM (deferred: complexity, storage constraints, OSM ToS considerations)
- Tiled image maps (Zoomify/DeepZoom) for massive images (deferred: niche use case, requires external tooling)

---

### Maps Tab (Control Center) ✅

> **Complete in v0.6.2.** See [maps-tab.md](../docs/planning/maps-tab.md) for implementation details.

**Implemented Features:**
- Dedicated Maps tab in Control Center with 4 cards
- **Open Map View card**: Quick access with coordinate coverage stats
- **Custom Maps gallery**: Thumbnail grid with image previews (~150×100px)
  - Map name overlay and universe badge
  - Hover actions: Edit button and context menu button
  - Click thumbnail to open map in Map View
- **Visualizations card**: Migration diagrams and place network tools
- **Map Statistics card**: Coordinate coverage, custom map count, universe list

**Custom Map Management:**
- Create Map Modal for new map notes with image picker, bounds, and universe
- Edit Map Modal to update existing map properties
- Duplicate map with auto-generated unique ID
- Export map configuration to JSON
- Import map from JSON with duplicate ID detection
- Delete map with confirmation dialog

---

### World-Building Suite

A collection of features designed for fiction writers, game masters, and alternate history researchers. These features work together to support complex fictional universes.

#### Custom Relationship Types ✅

> **Complete in v0.7.0.** See [Custom Relationships](Custom-Relationships) wiki page for full documentation.

**Summary:** Define non-familial relationships beyond parent/child/spouse.

**Implemented Features:**
- 12 built-in relationship types across 4 categories (Legal, Religious, Professional, Social)
- Relationships Tab in Control Center for management
- Add Relationship Modal with category-grouped dropdown
- Frontmatter storage in `relationships` array
- Canvas edge support with colored edges
- Statistics card with relationship counts

**Schema:**
```yaml
# In person note frontmatter
relationships:
  - type: godparent
    target: "[[Jane Doe]]"
    target_id: person-jane-doe
    notes: "Became godparent at baptism in 1920"
```

**Future Enhancements (v0.8.0+):**
- Create custom relationship types with user-defined colors
- Automatic inverse relationship creation
- Bulk relationship management

---

#### Schema Validation & Consistency Checks ✅

> **Complete in v0.6.3.** See [Schema Validation](Schema-Validation) wiki page for full documentation.

**Summary:** User-defined validation schemas to catch data inconsistencies and enforce data quality rules.

**Implemented Features:**
- **Schema Notes**: New note type (`type: schema`) with JSON code block for schema definition
- **Schemas Tab**: Dedicated Control Center tab for schema management
  - Create Schema modal with full UI (no manual JSON editing required)
  - Edit existing schemas
  - Schema gallery with scope badges
  - Vault-wide validation with results display
  - Recent violations list
- **Schema Scopes**: Apply schemas by collection, folder, universe, or all people
- **Property Validation**:
  - Required properties
  - Type validation (string, number, date, boolean, enum, wikilink, array)
  - Enum validation with allowed values
  - Number range validation (min/max)
  - Wikilink target type validation (verify linked note type)
- **Conditional Requirements**: `requiredIf` conditions based on other properties
- **Custom Constraints**: JavaScript expressions for cross-property validation
- **Data Quality Integration**: Schema violations section in Data Quality tab
- **Commands**: "Open schemas tab", "Validate vault against schemas"
- **Context Menu**: "Validate against schemas" for person notes, schema-specific actions for schema notes

---

#### Fictional Date Systems ✅

> **Complete in v0.7.0.** See [Fictional Date Systems](Fictional-Date-Systems) wiki page for full documentation.

**Summary:** Custom calendars and eras for world-building and historical research.

**Implemented Features:**
- Era definitions with name, abbreviation, epoch offset, and direction (forward/backward)
- Date parsing for `{abbrev} {year}` format (e.g., "TA 2941", "AC 283")
- Built-in presets: Middle-earth, Westeros, Star Wars, Generic Fantasy calendars
- Universe-scoped calendar systems
- Date Systems card in Canvas Settings tab
- Test date parsing input for validation
- Custom date system creation with era table editor
- Canonical year conversion for sorting/comparison
- Age calculation within calendar systems

**Usage in Person Notes:**
```yaml
born: "TA 2890"
died: "FoA 61"
```

**Future Enhancements (v0.8.0+):**
- Leaflet.js timeline slider with fictional dates
- Bases integration for sorting/filtering by era and year
- "Who was alive in [year]?" queries

---

#### Organization Notes & Hierarchy Views

**Summary:** Define and visualize non-genealogical hierarchies (houses, guilds, corporations).

**Organization Note Schema:**
```yaml
type: organization
name: "House Stark"
parent_org: "[[The North]]"
org_type: noble_house
founded: "Age of Heroes"
motto: "Winter is Coming"
seat: "[[Winterfell]]"
```

**Person Membership:**
```yaml
house: "[[House Stark]]"
role: "Lord of Winterfell"
house_from: "TA 280"
memberships:
  - org: "[[Night's Watch]]"
    role: "Lord Commander"
    from: "TA 300"
    to: "TA 305"
```

**Visualization:**
- D3-based org chart (tree, radial, dendrogram layouts)
- View by organization or by person
- Color coding by role, tenure, or organization type
- Temporal filtering
- Export as PNG, SVG, PDF

**Integration Points:**
- Custom Relationship Types (liege/vassal edges)
- Fictional Date Systems (temporal membership)
- Place notes (organization seats)

---

### Evidence & Source Management

Features for genealogists managing documentary evidence and oral history.

#### Source Media Gallery & Document Viewer ✅

> **Complete in v0.8.0.** See [Evidence & Sources](Evidence-And-Sources) wiki page for full documentation.

**Summary:** Centralized evidence management linking source documents to person notes.

**Implemented Features:**
- Source note type (`type: source`) with frontmatter schema
- 13 built-in source types (census, vital_record, photo, correspondence, newspaper, military, immigration, etc.)
- Source counting using Obsidian's `resolvedLinks` metadata cache
- **Source indicators on generated trees**: Small badges (e.g., "📎 3") on person nodes showing linked source count
  - Color-coded: green for 3+ sources (well-documented), yellow for 1-2 sources
  - Toggle in Settings → Canvas Roots → Canvas styling → "Show source indicators"
- **Media Gallery in Sources Tab**: Thumbnail grid with search and filtering
  - Filter by media type (images, documents)
  - Filter by source type
  - Search by filename or source title
  - Lightbox viewer with keyboard navigation (arrow keys, Escape)
  - Support for images and document placeholders
- Sources Bases template with 17 pre-configured views
- **Citation Generator**: Generate formatted citations in multiple styles
  - Chicago Manual of Style
  - Evidence Explained (Elizabeth Shown Mills) - genealogical standard
  - MLA (Modern Language Association)
  - Turabian
  - Copy to clipboard functionality
  - Missing field warnings

**Source Note Schema:**
```yaml
type: source
cr_id: source-1900-census-smith
title: "1900 US Federal Census - Smith Family"
source_type: census
source_date: "1900-06-01"
source_repository: "Ancestry.com"
media: "[[Census 1900.pdf]]"
confidence: high
```

**Future Enhancements:**
- "Missing sources" report

**Integration Points:**
- Bases views for source inventory
- Evidence Visualization integration

---

#### Evidence Visualization

> See [evidence-visualization-plan.md](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/evidence-visualization-plan.md) for detailed implementation plan.

**Summary:** Visual research methodology tools aligned with the Genealogical Proof Standard (GPS) and professional genealogical practices. Transforms Canvas Roots from a tree builder into a serious research platform.

**Genealogical Standards Support:**

| Standard | Feature |
|----------|---------|
| GPS completeness | Fact coverage map showing sourced vs. unsourced claims |
| Source classification | Primary/secondary/derivative visual indicators |
| Evidence correlation | Proof clusters grouping sources supporting conclusions |
| Conflict documentation | Visual markers for contradictory evidence |
| Written conclusions | Proof summary nodes documenting reasoning |

**Phase 1 (v0.9.0) - Fact-Level Source Coverage:**

New `sourced_facts` property on person notes:

```yaml
sourced_facts:
  birth_date:
    sources: ["[[1850 Census]]", "[[Family Bible]]"]
  birth_place:
    sources: ["[[1850 Census]]"]
  death_date:
    sources: []  # Explicitly unsourced
```

New `source_quality` field on source notes:

```yaml
source_quality: primary  # primary | secondary | derivative
```

**Phase 1 Features:**
- Research Gaps Report in Data Quality tab
- Person fact coverage display (which facts have sources)
- Enhanced source indicator tooltips on canvas
- Schema validation for `sourced_facts`

**Source Quality Classification:**

| Classification | Meaning | Examples |
|----------------|---------|----------|
| Primary | Created at/near event by participant/witness | Original vital records, census, contemporary letters |
| Secondary | Created later from memory or hearsay | Family bibles (later entries), obituaries, oral histories |
| Derivative | Copies, transcriptions, or abstracts | Database transcriptions, published abstracts |

**Phases:**

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Fact-level source coverage, Research Gaps Report | ✅ Complete |
| 2 | Source quality visualization with color coding | ✅ Complete |
| 3 | Proof summary notes and conflict documentation | ✅ Complete |
| 4 | Canvas conflict markers | ✅ Complete |

**Deferred to Future Releases:**
- Source quality borders on media nodes → Style Settings Integration (see below)

**On Hold (Pending User Feedback):**
- Evidence clusters / Research View - Original spec was ambiguous (Obsidian Canvas vs Family Chart View). Three options under consideration:
  1. Add evidence visualization to Family Chart View (D3-based, full control)
  2. Keep current approach (evidence in Control Center detail views)
  3. Create a new "Research View" - evidence-centric visualization separate from family trees

**Integration Points:**
- Extends existing source indicators (v0.8.0)
- Source Media Gallery for evidence browsing
- Data Quality tab for research gap reports
- Export proof summaries for publication

---

#### Transcript Nodes & Quotable Facts

**Summary:** Time-stamped citations from audio/video with direct linking.

**Schema:**
```yaml
oral_facts:
  - media: "[[Interview with Grandma.mp3]]"
    timestamp: "1m30s"
    fact_type: birth_date
    quote: "I was born on May 15th, 1922"
    fact_id: "birth-001"
```

**Timestamp Linking:**
- Deep links: `[[Interview.mp3]]#t=1m30s`
- Range support: `#t=1m30s-2m15s`
- One-click playback from timestamp

**Fact Types:** birth_date, birth_place, residence, occupation, relationship, anecdote, lore, custom

**Canvas Integration:**
- Transcript nodes with speech bubble styling
- Click to jump to timestamp
- Edge labels showing fact type

---

#### Interview Subject Graph

**Summary:** Map the relationship structure of interviews themselves.

**Schema:**
```yaml
type: interview
title: "Andrew Wilson Interview 2019"
media: "[[Andrew Wilson Interview 2019.mp4]]"
date: 2019-08-15
interviewer: "[[Me]]"
interviewee: "[[Andrew Wilson]]"
mentions:
  - person: "[[Sue Wilson Robinson]]"
    context: "sister"
    timestamps: ["3m20s", "15m45s"]
```

**Canvas Visualization:**
- Interview as central hub node
- Interviewee with primary edge (thick, "subject" label)
- Mentioned people radiate outward
- Edge thickness indicates mention frequency
- Click edges to see timestamps

**Integration Points:**
- Bases view: interviews with participant counts
- "People by interview coverage" report
- Cross-reference: which interviews mention a person

---

#### Chronological Story Mapping

**Summary:** Transform oral facts into timeline events for Leaflet.js animation.

**Event Schema:**
```yaml
type: event
cr_id: "evt-qom515nql022"
date: 1949-04-05
date_precision: month
description: "Moved to California"
person: "[[Andrew Wilson]]"
place: "[[California]]"
source_media: "[[Interview 1.mp4]]"
source_timestamp: "5m0s"
event_type: residence_change
confidence: medium
```

**Event Types:** birth, death, marriage, divorce, residence_change, occupation, military, immigration, education, anecdote, lore_event

**Timeline Views:**
- Person Timeline: all events for one person
- Family Timeline: interleaved family events
- Place Timeline: all events at a location
- Global Timeline: filterable by criteria

**Integration Points:**
- Leaflet.js Time Slider animation
- Person note `events` frontmatter array
- "Timeline gaps" report

---

### Research & Analysis Tools

#### Family Statistics Dashboard

**Summary:** Advanced analytics for family history research.

**Features:**
- Longevity analysis (lifespan by generation/period)
- Geographic distribution maps
- Most common names, occupations, places
- Generation gap analysis (parent age at birth)
- Marriage patterns (age differences, remarriage)
- Historical event correlation

---

#### Research Tracking

**Summary:** Track research progress and confidence levels.

**Features:**
- "Needs research" tags with specific to-dos
- Confidence levels: verified, probable, possible
- Source documentation per fact
- Research progress in Bases views
- DNA match tracking
- "DNA confirmed" relationship tags

---

#### Dynasty Management

**Summary:** Royal/noble house tracking and succession.

**Features:**
- Line of succession calculator
- Title/position inheritance
- Coat of arms support
- Regnal numbering (Henry VIII, etc.)
- Crown succession rules (primogeniture, etc.)

---

### Import/Export Enhancements

**Status:** ✅ Complete in v0.6.0

**Completed Features:**
- GEDCOM import/export
- GEDCOM X import/export (JSON format)
- Gramps XML import/export
- CSV import/export
- Privacy-aware exports with redaction options
- Separate Import and Export cards in Control Center UI

**Future Enhancements:**
- Additional GEDCOM fields (sources, notes, events)

---

### Print & PDF Export

**Summary:** Generate print-ready and PDF outputs of family trees and reports.

**Export Types:**
- **Pedigree Chart**: Ancestor-focused tree (4-5 generations per page)
- **Descendant Chart**: Descendants of a selected person
- **Family Group Sheet**: Single family unit with sources
- **Full Tree Poster**: Large format for wall display

**Features:**
- Page size presets (Letter, A4, custom, poster sizes)
- Multi-page output with page breaks
- Print preview with zoom
- Header/footer customization (title, date, researcher name)
- Privacy filter (exclude/anonymize living persons)
- SVG and high-resolution PNG export for printing

**Technical Approach:**
- Leverage browser print APIs
- SVG-based rendering for scalability
- Optional integration with PDF libraries (jsPDF or similar)

---

## Future Considerations

### Person Note Templates

**Summary:** Pre-configured note templates for different use cases and user types.

**Template Types:**
- **Researcher Template**: Full fields including sources, confidence, research notes, citation placeholders
- **Casual User Template**: Minimal fields (name, dates, parents, spouse, children)
- **World-Builder Template**: Includes universe, fictional dates, organization memberships
- **Quick Add Template**: Bare minimum for fast data entry

**Features:**
- Template picker when creating new person notes
- Default template setting in preferences
- Custom template creation and editing
- Templater plugin compatibility

**Integration Points:**
- Context menu "Create person note" actions
- Control Center quick-add buttons
- GEDCOM/CSV import (choose template for imported notes)

---

### Accessibility

**Summary:** Ensure Canvas Roots is usable by people with disabilities.

**Screen Reader Support:**
- ARIA labels for all interactive elements
- Semantic HTML structure in Control Center
- Announce tree navigation changes
- Describe relationship connections

**Visual Accessibility:**
- High contrast mode toggle
- Respect system "reduce motion" preference
- Sufficient color contrast ratios (WCAG AA)
- Don't rely on color alone (use patterns/icons)

**Keyboard Navigation:**
- Full keyboard access to all features
- Visible focus indicators
- Logical tab order
- Escape key to close modals

**Testing:**
- Screen reader testing (VoiceOver, NVDA)
- Keyboard-only testing
- Color blindness simulation testing

---

### Obsidian Publish Support

**Summary:** Enable sharing family trees via Obsidian Publish for read-only web viewing.

**Features:**
- Static HTML/SVG tree generation for Publish sites
- Privacy-aware export (automatic living person protection)
- Clickable person nodes linking to published notes
- Responsive design for mobile viewers
- Optional password protection recommendation

**Considerations:**
- Canvas files aren't natively supported by Publish
- Would require generating static image/SVG alternatives
- Family Chart View is JavaScript-dependent (won't work on Publish)
- Focus on static pedigree/descendant chart images

**Integration:**
- "Export for Publish" command
- Automatic image regeneration on tree changes
- Embed code for published pages

---

### Style Settings Integration

**Summary:** Expose Canvas Roots styling options via the [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin, allowing users to customize colors and dimensions without editing CSS.

**Phase 1: Family Chart Colors**
- Female card color (default: `rgb(196, 138, 146)`)
- Male card color (default: `rgb(120, 159, 172)`)
- Unknown gender card color (default: `lightgray`)
- Chart background color
- Card text color

**Phase 2: Canvas Node Styling**
- Node width and height
- Border radius
- Border width
- Connection line width and color

**Phase 3: Evidence Visualization Styling**
> Deferred from Evidence Visualization Phase 4 - better fit here for comprehensive canvas theming.

- Source quality colors for canvas indicators:
  - Primary source indicator color (default: green)
  - Secondary source indicator color (default: amber/yellow)
  - Derivative source indicator color (default: red)
- Research coverage threshold colors:
  - Well-researched threshold color (≥75%, default: green)
  - Moderate coverage threshold color (≥50%, default: yellow)
  - Needs research threshold color (<50%, default: red)
- Media node quality borders (when sources are linked to media):
  - Border color based on source quality classification
  - Border width for quality indicators

**Implementation Notes:**
- Add `/* @settings */` block to `styles.css` with YAML configuration
- Call `app.workspace.trigger("parse-style-settings")` on plugin load
- Use `variable-color` type for colors, `variable-number-slider` for dimensions
- Scope family-chart variables properly (currently `.cr-fcv-chart-container.f3`)

**Dependencies:**
- Style Settings plugin must be installed by user (optional dependency)
- No changes to core functionality; styling-only enhancement

**Not Planned:**
- Spacing variables (internal layout; could break UI)
- Transition timing (edge case)
- Map view styling (Leaflet has its own theming)

---

### Events System Foundation

> **Implemented in v0.6.0** as part of Geographic Features. This general-purpose life events system provides infrastructure for future timeline and research features.

**Current Implementation:**
- `events` array in person frontmatter with `event_type`, `place`, `date_from`, `date_to`, `description`
- TypeScript types: `LifeEvent`, `EventType`, `JourneyWaypoint`, `JourneyPath` in [map-types.ts](../src/maps/types/map-types.ts)
- Event parsing in `MapDataService.buildMarkers()` and `buildJourneyPaths()`
- Import/export support: GEDCOM (RESI, OCCU, EDUC, MILI), GEDCOM X (facts), Gramps XML, CSV

**Future Extensions Enabled:**
- Timeline views (non-geographic chronological display)
- Event-based Bases queries ("all military service events")
- Event notes as first-class entities (like place notes)
- Chronological Story Mapping (see [Evidence & Source Management](#chronological-story-mapping))
- Person Timeline view (all events for one person)
- Family Timeline view (interleaved family events)

---

**Advanced Features:**
- Alternative parent relationships (adoption, foster, step-parents)
- Unknown parent handling with placeholder nodes
- Flexible date formats (circa, ranges)
- Child ordering within families
- Relationship quality visualization (close, distant, estranged)
- Medical genogram support

**Integration:**
- DataView template library
- Advanced Canvas plugin integration
- Multi-vault merging

**Performance:**
- Large tree optimization (1000+ people)
- Incremental layout updates
- Lazy loading for large views

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

**Issue:** On desktop, after hovering over a submenu to reveal its contents, hovering over a different submenu doesn't dismiss the first one. The first submenu remains "sticky" until clicked elsewhere.

**Cause:** This is a limitation of Obsidian's native `Menu` API. The `setSubmenu()` method creates native Obsidian submenus, and plugins have no control over their hover/dismiss behavior.

**Potential Solutions (to be evaluated):**

1. **Flatten menu structure** - Remove submenus for items with only 2 options (e.g., "Generate Canvas tree" and "Generate Excalidraw tree" as separate items instead of a "Generate tree" submenu). Keeps submenus only for longer lists (4+ items).

2. **Replace with modal dialogs** - Convert submenu actions to open modal pickers on click, similar to "More options...". More clicks but predictable behavior.

3. **Custom menu component** - Build a fully custom menu system with proper hover behavior. Significant development effort and wouldn't integrate with native right-click.

4. **Upstream feature request** - Request improved submenu behavior from Obsidian team.

**Status:** Deferred - will select approach based on user feedback and Obsidian API evolution.

---

## Contributing

We welcome feedback on feature priorities!

1. Check [existing issues](https://github.com/banisterious/obsidian-canvas-roots/issues)
2. Open a new issue with `feature-request` label
3. Describe your use case and why the feature would be valuable

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

---

**Questions?** Open an issue on [GitHub](https://github.com/banisterious/obsidian-canvas-roots/issues).
