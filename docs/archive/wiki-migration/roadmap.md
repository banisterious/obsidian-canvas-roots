# Canvas Roots: Development Roadmap

> **Last Updated:** 2025-12-02
> **Current Version:** v0.6.0

This document outlines planned features for Canvas Roots. For release history and completed features, see [CHANGELOG.md](../CHANGELOG.md).

---

## Table of Contents

- [Development Priorities](#development-priorities)
- [Planned Features](#planned-features)
  - [Geographic Features (Phase 4)](#geographic-features-phase-4)
  - [World-Building Suite](#world-building-suite)
  - [Evidence & Source Management](#evidence--source-management)
  - [Research & Analysis Tools](#research--analysis-tools)
  - [Import/Export Enhancements](#importexport-enhancements)
- [Future Considerations](#future-considerations)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)

---

## Development Priorities

The following priority order guides future development:

| Priority | Feature | Status |
|:--------:|---------|--------|
| 1 | [Import/Export Enhancements](#importexport-enhancements) | ✅ Complete (v0.6.0) |
| 2 | [Geographic Features (Phase 4)](#geographic-features-phase-4) | ✅ Complete (v0.6.0) |
| 3 | [Custom Relationship Types](#custom-relationship-types) | Planned |
| 4 | [Schema Validation](#schema-validation--consistency-checks) | Planned |
| 5 | [Fictional Date Systems](#fictional-date-systems) | Planned |
| 6 | [Organization Notes](#organization-notes--hierarchy-views) | Planned |
| 7 | [Source Media Gallery](#source-media-gallery--document-viewer) | Planned |
| 8 | [Canvas Media Nodes](#canvas-media-nodes) | Planned |
| 9 | [Transcript Nodes & Oral History](#transcript-nodes--quotable-facts) | Planned |

---

## Planned Features

### Geographic Features (Phase 4) ✅

> **Complete in v0.6.0.** See [leaflet-maps-plan.md](architecture/leaflet-maps-plan.md) for implementation details.

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

**Future Enhancements (v2+):** See [leaflet-maps-plan.md § Design Decisions](architecture/leaflet-maps-plan.md#design-decisions) for detailed rationale.
- Offline tile caching for OSM (deferred: complexity, storage constraints, OSM ToS considerations)
- Tiled image maps (Zoomify/DeepZoom) for massive images (deferred: niche use case, requires external tooling)

---

### World-Building Suite

A collection of features designed for fiction writers, game masters, and alternate history researchers. These features work together to support complex fictional universes.

#### Custom Relationship Types

**Summary:** Define non-familial relationships beyond parent/child/spouse.

**Schema:**
```yaml
# In person note frontmatter
relationships:
  - type: mentor
    target: "[[Gandalf]]"
    from: "TA 2941"
    to: "TA 3019"
  - type: liege
    target: "[[Aragorn]]"
    from: "TA 3019"
```

**Relationship Categories:**
| Category | Examples |
|----------|----------|
| Feudal/Political | liege, vassal, sworn knight, ward, hostage |
| Religious/Spiritual | mentor, disciple, confessor, godparent |
| Professional | master, apprentice, patron, protégé |
| Social | rival, ally, betrothed, companion |
| Historical | guardian, foster-parent |

**Canvas Visualization:**
- Colored edges distinct from family relationships
- Configurable edge colors per relationship type
- Dashed vs. solid line styles
- Toggle visibility by relationship type
- Optional edge labels

**Integration Points:**
- Bases views filter/group by relationship type
- Relationship calculator optionally traverses custom relationships
- Statistics panel shows relationship type distribution

---

#### Schema Validation & Consistency Checks

**Summary:** User-defined JSON schemas to catch data inconsistencies and plot holes.

**Schema Configuration:**
```json
{
  "name": "House Stark Schema",
  "applies_to": { "collection": "House Stark" },
  "required_properties": ["allegiance", "combat_style"],
  "properties": {
    "race": {
      "type": "enum",
      "values": ["human", "direwolf"],
      "default": "human"
    },
    "magic_type": {
      "type": "enum",
      "values": ["warging", "greensight", "none"],
      "required_if": { "has_magic": true }
    }
  },
  "constraints": [
    {
      "rule": "if magic_type == 'greensight' then race != 'direwolf'",
      "message": "Direwolves cannot have greensight"
    }
  ]
}
```

**Validation Features:**
- Required properties by collection, house, or custom criteria
- Enum validation with allowed values
- Conditional requirements (`required_if`)
- Cross-property constraints with custom error messages
- Type validation (string, number, date, wikilink, array)

**Integration Points:**
- Data Quality tab shows schema violations
- Pre-visualization validation warnings
- Batch "fix missing properties" with defaults

---

#### Fictional Date Systems

**Summary:** Custom calendars and eras for world-building and historical research.

**Configuration:**
```yaml
date_formats:
  middle_earth:
    pattern: "{era} {year}"
    eras:
      - name: "Third Age"
        abbrev: "TA"
        epoch: 0
      - name: "Fourth Age"
        abbrev: "FA"
        epoch: 3021
```

**Usage in Person Notes:**
```yaml
born: "TA 2890"
died: "TA 2941"
```

**Features:**
- Internal canonical representation for calculations
- Age calculations within each calendar system
- Sorting/filtering in Bases views
- Graceful fallback for unrecognized formats
- Migration path from existing ISO dates

**Integration Points:**
- Leaflet.js timeline slider with fictional dates
- Timeline layout algorithm
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

#### Source Media Gallery & Document Viewer

**Summary:** Centralized evidence management linking source documents to person notes.

**Schema:**
```yaml
sources:
  - media: "[[Census 1900.pdf]]"
    type: census
    date: 1900-06-01
    repository: "Ancestry.com"
  - media: "[[Birth Certificate.jpg]]"
    type: vital_record
    date: 1888-05-15
source_media:  # Simple format
  - "[[Census 1900.pdf]]"
  - "[[Marriage License 1910.png]]"
```

**Source Types:** census, vital_record, photo, correspondence, newspaper, military, immigration, custom

**Features:**
- Thumbnail grid with PDF previews
- Sort by date, type, or filename
- Filter by source type
- Citation generator (Chicago, Evidence Explained)
- "Missing sources" report

**Integration Points:**
- Bases views for source inventory
- Canvas Media Nodes sync

---

#### Canvas Media Nodes

**Summary:** Media files as first-class canvas entities with semantic relationships.

**Media Node Types:**
| Type | Description | Placement |
|------|-------------|-----------|
| `avatar` | Primary photo/portrait | Adjacent to person node |
| `source` | Documentary evidence | Clustered in source zones |
| `document` | Full document scans | Grouped by type |
| `artifact` | Physical objects | Edge of canvas |

**Canvas JSON:**
```json
{
  "type": "file",
  "file": "media/census-1900-smith.pdf",
  "cr_media_type": "source",
  "cr_linked_person": "person-uuid-123"
}
```

**Features:**
- Intelligent placement during layout
- Toggle visibility by media type
- Media → Person edges with labels
- Filter: "Show sources for people born before 1900"
- Media coverage report

**Integration Points:**
- Source Media Gallery sync
- Bidirectional: canvas ↔ frontmatter

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

## Future Considerations

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
