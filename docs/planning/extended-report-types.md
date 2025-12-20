# Extended Report Types

Planning document for adding new report types beyond the genealogical reports.

- **Status:** Planning
- **Priority:** Medium
- **GitHub Issue:** #TBD
- **Created:** 2025-12-20
- **Updated:** 2025-12-20 (added Media Inventory, Universe Overview, Collection Overview)

---

## Overview

Expand the report generator with new report types that leverage data from Sources, Events, and Places. These complement the existing 7 genealogical reports and provide new ways to analyze and share research.

---

## Current State

The report generation system supports 7 genealogical report types:

| Report | Category | Description |
|--------|----------|-------------|
| Ahnentafel | Person | Numbered ancestor list (Sosa-Stradonitz system) |
| Pedigree Chart | Person | ASCII tree visualization of ancestors |
| Descendant Chart | Person | ASCII tree of descendants |
| Register Report | Person | NGSQ-style descendant numbering |
| Family Group Sheet | Family | Couple + children + vitals |
| Individual Summary | Person | Comprehensive facts for one person |
| Gaps Report | Data Quality | Missing data and research opportunities |

**Current infrastructure:**
- `ReportGenerator` service generates structured report data
- `PdfReportRenderer` renders reports to PDF with professional styling
- Output options: Save to vault (MD), Download as MD, Download as PDF
- Report Generator modal with options per report type

---

## Proposed Report Types

### Source Summary Report

**Category:** Person / Research
**Purpose:** Document all sources cited for a person, grouped by fact type, with quality assessment and gap analysis.

**Use Cases:**
- Prepare research summaries for sharing with other genealogists
- Identify which facts are well-documented vs. unsourced
- Generate source-focused view for lineage society applications

**Report Sections:**

| Section | Content |
|---------|---------|
| **Header** | Person name, vital dates, generation date |
| **Summary Statistics** | Total sources, by quality classification, unsourced fact count |
| **Birth/Baptism** | Sources with quality rating, citation details |
| **Death/Burial** | Sources with quality rating, citation details |
| **Marriage(s)** | Per-marriage sources |
| **Census Records** | Chronological list of census appearances |
| **Military Service** | Service-related sources |
| **Other Facts** | Grouped by fact type |
| **Unsourced Facts** | List of facts needing documentation |
| **Repositories** | Summary of repositories referenced |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| Root person | Person picker | Required | Subject of the report |
| Include children's sources | Boolean | false | Extend to immediate family |
| Group by | Dropdown | fact_type | fact_type, source_type, quality, chronological |
| Show quality ratings | Boolean | true | Display source quality classification |
| Include citation details | Boolean | true | Full citation vs. just source name |
| Show repository info | Boolean | false | Include repository names and locations |
| Highlight gaps | Boolean | true | Emphasize unsourced facts |

**Data Sources:**
- `SourceService` for source notes and citations
- Person's `sources` property (indexed: `sources`, `sources_2`, etc.)
- Event notes with source references
- GPS evidence quality levels if available

---

### Timeline Report

**Category:** Event / Narrative
**Purpose:** Chronological list of events with dates, participants, places, and sources.

**Use Cases:**
- Visualize the sequence of events in a family's history
- Create narrative timelines for family histories
- Identify chronological inconsistencies
- Generate event-focused exports for specific time periods

**Report Sections:**

| Section | Content |
|---------|---------|
| **Header** | Report title, date range, generation date |
| **Summary Statistics** | Event count, date range, participant count |
| **Timeline Entries** | Chronological event list with details |
| **By Participant** | (Optional) Events grouped by person |
| **By Place** | (Optional) Events grouped by location |
| **Sources Referenced** | List of sources cited in events |

**Timeline Entry Format:**

```
┌──────────────────────────────────────────────────────────────┐
│ 12 June 1902                                                  │
│ MARRIAGE                                                      │
│ John Smith and Mary Johnson                                   │
│ St. Patrick's Cathedral, Dublin, Ireland                      │
│ Source: Parish Register, St. Patrick's                        │
└──────────────────────────────────────────────────────────────┘
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| Date range (from) | Date picker | None | Start of range (optional) |
| Date range (to) | Date picker | None | End of range (optional) |
| Event types | Multi-select | All | Filter by event type |
| Participants | Person picker (multi) | All | Filter to specific people |
| Places | Place picker (multi) | All | Filter to specific places |
| Include child places | Boolean | true | Include events at child locations |
| Grouping | Dropdown | none | none, by_year, by_decade, by_person, by_place |
| Include sources | Boolean | true | Show source references |
| Include descriptions | Boolean | true | Show event descriptions |
| Universe | Universe picker | All | Filter by universe (for worldbuilders) |

**Data Sources:**
- `EventService` for event notes
- Person notes for birth/death/marriage events
- Place hierarchy for location filtering

---

### Place Summary Report

**Category:** Place / Geographic
**Purpose:** All events at a location, people associated with the place (born, died, resided).

**Use Cases:**
- Research all family connections to a specific location
- Prepare location-focused summaries for local history groups
- Identify migration patterns from/to a place
- Document family presence in ancestral villages

**Report Sections:**

| Section | Content |
|---------|---------|
| **Header** | Place name, hierarchy, coordinates, generation date |
| **Place Details** | Full hierarchy, coordinates, place type |
| **Summary Statistics** | Event count, person count, date range |
| **Events at This Place** | Chronological list of events |
| **People Born Here** | List with dates |
| **People Died Here** | List with dates |
| **People Resided Here** | List with residency periods |
| **People Married Here** | List with dates and spouses |
| **Child Places** | (Optional) Summary of activity at child locations |
| **Sources** | Sources referencing this place |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| Root place | Place picker | Required | Subject location |
| Include child places | Boolean | false | Aggregate data from child locations |
| Date range (from) | Date picker | None | Filter events by date |
| Date range (to) | Date picker | None | Filter events by date |
| Event types | Multi-select | All | Filter by event type |
| Show coordinates | Boolean | true | Include lat/long |
| Show place hierarchy | Boolean | true | Display containment chain |
| Include map reference | Boolean | false | Embed map link (future) |

**Data Sources:**
- `PlaceGraphService` for place hierarchy and associations
- Event notes with place references
- Person notes for birth_place, death_place
- Residence events for residency data

---

### Media Inventory Report

**Category:** Media / Data Quality
**Purpose:** Inventory all media files with linked entities, identify orphaned files and coverage gaps.

**Use Cases:**
- Audit media collection for organization and cleanup
- Identify orphaned media files not linked to any entity
- Find entities missing media attachments
- Plan digitization or media acquisition priorities

**Report Sections:**

| Section | Content |
|---------|---------|
| **Header** | Report title, scope, generation date |
| **Summary Statistics** | Total media files, linked count, orphan count, coverage stats |
| **By Entity Type** | Media counts per entity type (sources, and future: persons, places, events) |
| **File Type Breakdown** | Images, PDFs, audio, video counts |
| **Linked Media** | Media files with their linked entities |
| **Orphaned Media** | Media files with no entity links |
| **Entities Without Media** | Entities that could have media but don't |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| Scope | Dropdown | all | all, sources_only, by_folder |
| Show orphaned files | Boolean | true | Include unlinked media |
| Show coverage gaps | Boolean | true | Show entities without media |
| Group by | Dropdown | entity_type | entity_type, folder, file_type |
| Include file sizes | Boolean | false | Show file size statistics |
| Folder filter | Folder picker | None | Limit to specific folder |

**Data Sources:**
- Vault file listing for media files (images, PDFs, audio)
- Source notes with `media` property
- Future: Person, Place, Event, Organization notes with media (after Universal Media Linking)

**Note:** This report is designed to work with current source-only media linking and will automatically expand when Universal Media Linking ships.

---

### Universe Overview Report

**Category:** Universe / Summary
**Purpose:** Summary of all entities in a universe with statistics, date ranges, and entity type breakdown.

**Use Cases:**
- Get a high-level view of a fictional world's scope
- Track worldbuilding progress across entity types
- Generate universe documentation for sharing
- Compare relative sizes of different universes

**Report Sections:**

| Section | Content |
|---------|---------|
| **Header** | Universe name, description, generation date |
| **Summary Statistics** | Total entities, by type, date range |
| **Entity Breakdown** | Count and percentage per entity type |
| **Date Range** | Earliest to latest dates (using fictional dates if applicable) |
| **Geographic Summary** | Places with coordinates, coverage areas |
| **Calendar Systems** | Date systems used in this universe |
| **Recent Activity** | Recently modified entities (optional) |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| Universe | Universe picker | Required | Subject universe |
| Include entity list | Boolean | false | List all entities (can be long) |
| Show geographic summary | Boolean | true | Include place statistics |
| Show date systems | Boolean | true | List fictional calendars used |
| Show recent activity | Boolean | false | List recently modified entities |
| Max entities per type | Number | 20 | Limit for entity lists |

**Data Sources:**
- `UniverseService` for universe entity aggregation
- `FamilyGraphService` for person counts
- `PlaceGraphService` for place data
- `EventService` for event counts
- `DateService` for fictional date handling

---

### Collection Overview Report

**Category:** Collection / Summary
**Purpose:** Summary of a user collection or auto-detected family component.

**Use Cases:**
- Document a specific family line or research project
- Generate summaries for family reunions or publications
- Analyze scope of a collection before export
- Compare different branches of a family tree

**Report Sections:**

| Section | Content |
|---------|---------|
| **Header** | Collection name, type (user/component), generation date |
| **Summary Statistics** | Member count, generation depth, date range |
| **Member List** | People with key dates (birth, death) |
| **Generation Analysis** | Ancestor/descendant counts by generation |
| **Geographic Distribution** | Places represented, with counts |
| **Date Range** | Earliest birth to latest death |
| **Surname Distribution** | Surname counts (for family components) |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| Collection | Collection picker | Required | User collection or family component |
| Include member list | Boolean | true | List all members with dates |
| Show generation analysis | Boolean | true | Break down by generation |
| Show geographic distribution | Boolean | true | List places and counts |
| Show surname distribution | Boolean | true | For family components |
| Sort members by | Dropdown | birth_date | birth_date, name, death_date |
| Max members | Number | 100 | Limit for member list |

**Data Sources:**
- `FamilyGraphService` for collection data and member lists
- Person notes for vital dates
- Place references for geographic distribution

---

## UI Integration

### Report Category Selector

Add a category selector to the Report Generator modal:

```
┌─────────────────────────────────────────────────────────────┐
│  Generate Report                                             │
│                                                              │
│  Category:  [Genealogical ▼]                                 │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ ○ Genealogical                                          │ │
│  │ ○ Research                                              │ │
│  │ ○ Timeline                                              │ │
│  │ ○ Geographic                                            │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  Report type:  [Source Summary ▼]                            │
│                                                              │
│  [Report-specific options...]                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Category → Report Type Mapping:**

| Category | Report Types |
|----------|-------------|
| Genealogical | Ahnentafel, Pedigree Chart, Descendant Chart, Register, Family Group Sheet, Individual Summary |
| Research | Source Summary, Gaps Report, Media Inventory |
| Timeline | Timeline Report |
| Geographic | Place Summary |
| Summary | Universe Overview, Collection Overview |

### Entry Points

Same as existing reports:
- Statistics Dashboard → Reports section → Generate
- Command palette: "Canvas Roots: Generate Report"

---

## Implementation Phases

### Phase 1: Source Summary Report

**Scope:**
1. Add Source Summary report type to `ReportType` enum
2. Create `SourceSummaryResult` interface
3. Implement `generateSourceSummary()` in `ReportGenerator`
4. Add `renderSourceSummary()` to `PdfReportRenderer`
5. Update `ReportGeneratorModal` with Source Summary options

**Dependencies:**
- Existing `SourceService`
- Person notes with `sources` property
- GPS evidence model (if implemented)

### Phase 2: Timeline Report

**Scope:**
1. Add Timeline report type
2. Create `TimelineResult` interface
3. Implement `generateTimeline()` in `ReportGenerator`
4. Add `renderTimeline()` to `PdfReportRenderer`
5. Update modal with Timeline options

**Dependencies:**
- `EventService` for event data
- Date parsing and sorting utilities
- Place resolution for location display

### Phase 3: Place Summary Report

**Scope:**
1. Add Place Summary report type
2. Create `PlaceSummaryResult` interface
3. Implement `generatePlaceSummary()` in `ReportGenerator`
4. Add `renderPlaceSummary()` to `PdfReportRenderer`
5. Update modal with Place Summary options

**Dependencies:**
- `PlaceGraphService` for hierarchy
- Event-to-place associations
- Person birth/death/residence place fields

### Phase 4: Report Category UI

**Scope:**
1. Add category selector to Report Generator modal
2. Reorganize existing reports under categories
3. Add category filtering to report type dropdown
4. Update Statistics Dashboard reports card with categories

### Phase 5: Media Inventory Report

**Scope:**
1. Add Media Inventory report type
2. Create `MediaInventoryResult` interface
3. Implement `generateMediaInventory()` in `ReportGenerator`
4. Add `renderMediaInventory()` to `PdfReportRenderer`
5. Update modal with Media Inventory options

**Dependencies:**
- Vault API for file listing
- Source notes with `media` property
- Future: Universal Media Linking for other entity types

**Note:** Designed to work with current source-only media and expand automatically when Universal Media Linking ships.

### Phase 6: Universe Overview Report

**Scope:**
1. Add Universe Overview report type
2. Create `UniverseOverviewResult` interface
3. Implement `generateUniverseOverview()` in `ReportGenerator`
4. Add `renderUniverseOverview()` to `PdfReportRenderer`
5. Update modal with Universe Overview options

**Dependencies:**
- `UniverseService` for entity aggregation
- `DateService` for fictional date handling
- Universe notes with `date_system` property

### Phase 7: Collection Overview Report

**Scope:**
1. Add Collection Overview report type
2. Create `CollectionOverviewResult` interface
3. Implement `generateCollectionOverview()` in `ReportGenerator`
4. Add `renderCollectionOverview()` to `PdfReportRenderer`
5. Update modal with Collection Overview options

**Dependencies:**
- `FamilyGraphService` for collection/component data
- Generation calculation utilities
- Place aggregation for geographic distribution

---

## PDF Styling

All new reports follow the styling system established in [PDF Report Export](pdf-report-export.md#pdf-styling-guide). This section documents report-specific layouts.

### Shared Components Reference

From the PDF Report Export styling guide:

| Component | Purpose |
|-----------|---------|
| `buildSectionHeader()` | Dark accent bar with section title |
| `buildKeyValueTable()` | Label-value pairs (person vitals, etc.) |
| `buildDataTable()` | Columnar table with zebra striping |
| `buildRelationshipCard()` | Centered card for marriage/union info |

### Color Palette (Reference)

| Color | Hex | Usage |
|-------|-----|-------|
| Primary text | `#333333` | Section headers, labels |
| Secondary text | `#555555` | Card headers |
| Tertiary text | `#666666` | Notes, footer text |
| Accent bar | `#5b5b5b` | Section header accent |
| Header row | `#e8e8e8` | Table header background |
| Alternating row | `#f8f8f8` | Table zebra striping |

---

### Source Summary Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Source Summary Report                              Canvas Roots │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│                      SOURCE SUMMARY                              │
│                      John Smith                                  │
│                   (1850 - 1920)                                  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  SUMMARY                                                   │  │
│  │  Total sources: 12    Primary: 5    Secondary: 7          │  │
│  │  Unsourced facts: 3                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───┬───────────────────────────────────────────────────────┐  │
│  │ ▌ │  BIRTH                                                 │  │
│  └───┴───────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Source          │ Quality   │ Citation                    │  │
│  │─────────────────┼───────────┼─────────────────────────────│  │
│  │ Birth Cert      │ Primary   │ "John Smith, born..."       │  │
│  │ Census 1860     │ Secondary │ "Age 10, born Ireland"      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───┬───────────────────────────────────────────────────────┐  │
│  │ ▌ │  UNSOURCED FACTS                                       │  │
│  └───┴───────────────────────────────────────────────────────┘  │
│                                                                  │
│  ⚠ The following facts need documentation:                      │
│    • Death date                                                  │
│    • Mother's name                                               │
│    • Marriage date                                               │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  Generated: 20 Dec 2025                          Page 1 of 2    │
└─────────────────────────────────────────────────────────────────┘
```

**Components Used:**

| Section | Component | Notes |
|---------|-----------|-------|
| Title block | Centered title + subtitle | Person name, dates |
| Summary | Card with statistics | Total, by quality, gaps |
| Per fact type | Section header + data table | Birth, Death, Marriage, etc. |
| Source rows | 3-column table | Source name, quality badge, citation |
| Unsourced | Section header + bullet list | Warning icon + list |
| Repositories | Section header + key-value | Repository → source count |

**Quality Badges:**

| Quality | Style |
|---------|-------|
| Primary | Green text or ● indicator |
| Secondary | Yellow/amber text or ◐ indicator |
| Derivative | Gray text or ○ indicator |
| Undetermined | Italic, no indicator |

---

### Timeline Report Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Timeline Report                                    Canvas Roots │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│                      FAMILY TIMELINE                             │
│                    1850 - 1920                                   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Events: 24    Participants: 8    Places: 12               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───┬───────────────────────────────────────────────────────┐  │
│  │ ▌ │  1850                                                  │  │
│  └───┴───────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  15 Mar 1850                                                ││
│  │  ────────────────────────────────────────────────────────── ││
│  │  BIRTH                                                      ││
│  │  John Smith                                                 ││
│  │  Dublin, Ireland                                            ││
│  │  Source: Birth Certificate                                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  12 Jun 1850                                                ││
│  │  ────────────────────────────────────────────────────────── ││
│  │  MARRIAGE                                                   ││
│  │  Patrick Smith and Catherine O'Brien                        ││
│  │  St. Patrick's Cathedral, Dublin                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  Generated: 20 Dec 2025                          Page 1 of 4    │
└─────────────────────────────────────────────────────────────────┘
```

**Components Used:**

| Section | Component | Notes |
|---------|-----------|-------|
| Title block | Centered title + date range | |
| Summary | Inline statistics card | Event/participant/place counts |
| Year headers | Section header | When grouping by year |
| Event cards | Timeline entry card | Date, type, participants, place |

**Timeline Entry Card:**

```typescript
function buildTimelineEntry(event: TimelineEvent): Content {
  return {
    stack: [
      // Date header
      { text: formatDate(event.date), style: 'timelineDate' },
      { canvas: [{ type: 'line', ... }] }, // separator
      // Event type
      { text: event.type.toUpperCase(), style: 'timelineType' },
      // Participants
      { text: event.participants.join(' and '), style: 'timelineParticipants' },
      // Place
      { text: event.place, style: 'timelinePlace', color: '#666666' },
      // Source (if enabled)
      event.source ? { text: `Source: ${event.source}`, style: 'timelineSource' } : null
    ].filter(Boolean),
    margin: [0, 8, 0, 8],
    // Light border or background
  };
}
```

**Grouping Variants:**

| Grouping | Section Headers | Entry Format |
|----------|-----------------|--------------|
| None | No headers | All entries chronological |
| By Year | "1850", "1851", etc. | Entries under year |
| By Decade | "1850s", "1860s", etc. | Entries under decade |
| By Person | Person names | Their events listed |
| By Place | Place names | Events at that place |

---

### Place Summary Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Place Summary Report                               Canvas Roots │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│                      PLACE SUMMARY                               │
│                   Dublin, Ireland                                │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Type: City                                                │  │
│  │  Hierarchy: Dublin → County Dublin → Leinster → Ireland    │  │
│  │  Coordinates: 53.3498° N, 6.2603° W                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Events: 45    People: 28    Date range: 1820 - 1920       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───┬───────────────────────────────────────────────────────┐  │
│  │ ▌ │  BIRTHS                                                │  │
│  └───┴───────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Name              │ Date        │ Parents                 │  │
│  │───────────────────┼─────────────┼─────────────────────────│  │
│  │ John Smith        │ 15 Mar 1850 │ Patrick & Catherine     │  │
│  │ Mary Smith        │ 22 Aug 1852 │ Patrick & Catherine     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───┬───────────────────────────────────────────────────────┐  │
│  │ ▌ │  MARRIAGES                                             │  │
│  └───┴───────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Couple                        │ Date        │ Venue        │  │
│  │────────────────────────────────┼─────────────┼─────────────│  │
│  │ Patrick Smith & Catherine...  │ 12 Jun 1848 │ St. Patrick's│  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  Generated: 20 Dec 2025                          Page 1 of 3    │
└─────────────────────────────────────────────────────────────────┘
```

**Components Used:**

| Section | Component | Notes |
|---------|-----------|-------|
| Title block | Centered title | Place name |
| Place details | Key-value card | Type, hierarchy, coordinates |
| Summary | Inline statistics | Event/people counts, date range |
| Births | Section header + data table | Name, date, parents |
| Deaths | Section header + data table | Name, date, age |
| Marriages | Section header + data table | Couple, date, venue |
| Residences | Section header + data table | Name, period |
| Events | Section header + data table | All other events |

**Hierarchy Display:**

```typescript
function formatPlaceHierarchy(place: PlaceInfo): string {
  // "Dublin → County Dublin → Leinster → Ireland"
  const chain = getPlaceHierarchyChain(place);
  return chain.map(p => p.name).join(' → ');
}
```

---

### New Styles to Add

Add these styles to the shared `pdfStyles` object:

```typescript
const extendedReportStyles = {
  // Timeline-specific
  timelineDate: { fontSize: 11, bold: true, color: '#333333' },
  timelineType: { fontSize: 10, bold: true, color: '#555555', margin: [0, 4, 0, 2] },
  timelineParticipants: { fontSize: 10 },
  timelinePlace: { fontSize: 9, italics: true, color: '#666666' },
  timelineSource: { fontSize: 8, color: '#888888', margin: [0, 4, 0, 0] },

  // Source Summary-specific
  qualityPrimary: { color: '#2e7d32' },      // Green
  qualitySecondary: { color: '#f57c00' },    // Amber
  qualityDerivative: { color: '#757575' },   // Gray
  unsourcedWarning: { color: '#d32f2f' },    // Red

  // Place Summary-specific
  hierarchyChain: { fontSize: 9, color: '#666666' },
  coordinates: { fontSize: 9, color: '#888888', font: 'Courier' }
};
```

---

## Technical Considerations

### PDF Rendering

All new reports use the existing PDF infrastructure:
- Reuse shared helper functions (`buildSectionHeader`, `buildDataTable`, etc.)
- Follow established styling guide (colors, typography, layout)
- Support same output options (Save to vault, Download as MD, Download as PDF)

### Data Aggregation

**Source Summary:**
- Collect all `sources_*` properties from person frontmatter
- Resolve source wikilinks to source notes
- Extract quality classification and citation details
- Group by fact type (requires parsing citation context)

**Timeline:**
- Query all events within date range
- Sort by date (handling partial/unknown dates)
- Resolve participants and places
- Handle fictional dates if universe has custom calendar

**Place Summary:**
- Use `PlaceGraphService.getPlaceHierarchy()` for containment
- Query events with matching `place` field
- Query persons with matching birth/death/residence places
- Aggregate child place data if option enabled

### Performance

For large vaults:
- Lazy load report data (don't precompute on modal open)
- Show progress indicator for reports spanning many entities
- Consider pagination for very long reports (future)

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/reports/generators/source-summary-generator.ts` | Source Summary report logic |
| `src/reports/generators/timeline-generator.ts` | Timeline Report logic |
| `src/reports/generators/place-summary-generator.ts` | Place Summary report logic |
| `src/reports/generators/media-inventory-generator.ts` | Media Inventory report logic |
| `src/reports/generators/universe-overview-generator.ts` | Universe Overview report logic |
| `src/reports/generators/collection-overview-generator.ts` | Collection Overview report logic |

## Files to Modify

| File | Changes |
|------|---------|
| `src/reports/types/report-types.ts` | Add new report types, result interfaces |
| `src/reports/services/report-generator.ts` | Integrate new generators |
| `src/reports/services/pdf-report-renderer.ts` | Add render methods for new reports |
| `src/reports/ui/report-generator-modal.ts` | Add category selector, new report options |
| `src/dashboard/statistics-dashboard.ts` | Update Reports card with categories |

---

## Success Criteria

### Phase 1 (Source Summary)
- [ ] User can generate Source Summary report for any person
- [ ] Sources grouped by fact type with quality ratings
- [ ] Unsourced facts highlighted
- [ ] PDF renders with consistent styling
- [ ] Repository information included when option enabled

### Phase 2 (Timeline)
- [ ] User can generate Timeline report with date range filtering
- [ ] Events sorted chronologically
- [ ] Grouping options work correctly (by year, decade, person, place)
- [ ] Participant and place filters work correctly
- [ ] PDF renders timeline entries in consistent format

### Phase 3 (Place Summary)
- [ ] User can generate Place Summary for any place
- [ ] Events at place listed chronologically
- [ ] People born/died/resided/married at place listed
- [ ] Child place aggregation works when enabled
- [ ] Place hierarchy displayed correctly

### Phase 4 (Category UI)
- [ ] Report Generator modal shows category selector
- [ ] Reports grouped logically by category
- [ ] Existing reports continue to work unchanged
- [ ] Statistics Dashboard reflects new category structure

### Phase 5 (Media Inventory)
- [ ] User can generate Media Inventory report
- [ ] Media files listed with linked entities
- [ ] Orphaned files identified (media with no entity links)
- [ ] Coverage gaps shown (entities without media)
- [ ] File type breakdown displayed
- [ ] Report works with source media now, expands when Universal Media Linking ships

### Phase 6 (Universe Overview)
- [ ] User can generate Universe Overview for any universe
- [ ] Entity counts by type displayed
- [ ] Date range shown (with fictional dates if applicable)
- [ ] Geographic summary included when places have coordinates
- [ ] Calendar systems listed for universes with fictional dates

### Phase 7 (Collection Overview)
- [ ] User can generate Collection Overview for user collections
- [ ] User can generate Collection Overview for auto-detected family components
- [ ] Member list with vital dates
- [ ] Generation analysis (ancestor/descendant counts)
- [ ] Geographic distribution shown
- [ ] Surname distribution for family components

---

## Future Considerations

### Additional Report Types

| Report | Category | Description |
|--------|----------|-------------|
| Organization Summary | Organization | Members, hierarchy, timeline |
| Migration Report | Geographic | Track family movements across places over time |
| DNA Match Report | Research | Document DNA matches and shared ancestors |
| Research Log | Research | Chronological log of research activities |

### Enhanced Features

| Feature | Description |
|---------|-------------|
| Multi-person Timeline | Compare timelines of multiple people side-by-side |
| Interactive Timeline | HTML output with expandable events (future) |
| Map Integration | Embed maps in Place Summary (requires map rendering) |
| Cross-references | Hyperlinks between related reports |

---

## Related Documents

- [PDF Report Export](pdf-report-export.md) - PDF infrastructure and styling guide
- [Statistics and Reports](../../wiki-content/Statistics-And-Reports.md) - Existing report documentation
- [Roadmap: Extended Report Types](../../wiki-content/Roadmap.md#extended-report-types) - Feature summary
