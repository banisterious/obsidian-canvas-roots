# Timeline Export Consolidation

Planning document for merging timeline export functionality from the Events tab into the unified Reports system.

**Status:** Planning
**GitHub Issue:** #TBD
**Priority:** Medium
**Created:** 2025-12-27

---

## Overview

Consolidate all timeline export functionality into Statistics & Reports → Reports → Timeline report, eliminating the duplicate Export card in Control Center → Events tab. This creates a single, comprehensive timeline export experience with all formats and options in one place.

---

## Motivation

**The Problem:** Timeline exports currently exist in two places:

| Location | Formats | Strengths | Weaknesses |
|----------|---------|-----------|------------|
| Events tab → Export card | Canvas, Excalidraw, Markdown (4 formats) | Visual exports, styling options, data quality insights | No PDF/ODT, no date range filter, no grouping |
| Reports → Timeline | PDF, ODT, Markdown (table only) | Document exports, advanced filters, grouping options | No Canvas/Excalidraw, limited markdown formats |

Users must navigate between two different UIs to access the full range of export options.

**The Solution:** Merge all capabilities into the Reports system's Timeline report, then deprecate the Events tab Export card.

---

## Design Principles

1. **No feature regression** — Every capability from both systems must be preserved
2. **Unified experience** — Single wizard flow for all timeline exports
3. **Progressive disclosure** — Common options first, format-specific options revealed when relevant
4. **Graceful deprecation** — Events tab Export card removed only after Reports has parity

---

## Consolidated Feature Set

### Output Formats

| Format | Source | Notes |
|--------|--------|-------|
| Canvas | Events tab | Native Obsidian canvas with linked nodes |
| Excalidraw | Events tab | Requires Excalidraw plugin; hide if unavailable |
| Markdown: Callout | Events tab | Vertical timeline with year columns, colored dots (requires CSS) |
| Markdown: Table | Both | Compact table format |
| Markdown: List | Events tab | Simple bullet list, maximum compatibility |
| Markdown: Dataview | Events tab | Dynamic query (requires Dataview plugin) |
| PDF | Reports | Professional document with optional cover page |
| ODT | Reports | Editable document with optional cover page |

### Filters (Union of Both Systems)

| Filter | Source | Notes |
|--------|--------|-------|
| Person | Both | Select from people linked to events |
| Event type | Both | birth, death, marriage, etc. |
| Group/faction | Events tab | Filter by group property |
| Place | Reports | With optional child places inclusion |
| Universe | Reports | For multi-universe vaults |
| Date range | Reports | From/to date filtering |

### Grouping Options (from Reports)

- None (flat chronological list)
- By year
- By decade
- By person
- By place

### Styling Options (from Events tab)

**Canvas/Excalidraw:**
- Layout: horizontal, vertical, Gantt (by date and person)
- Color scheme: event type, category, confidence, monochrome
- Include ordering edges (before/after relationships)
- Group by person

**Excalidraw-specific:**
- Drawing style: architect (clean), artist (natural), cartoonist (rough)
- Font family: Virgil, Excalifont, Comic Shanns, Helvetica, Nunito, Lilita One, Cascadia
- Font size, stroke width, fill style, stroke style

**PDF/ODT:**
- Page size: A4, Letter
- Date format
- Cover page with title, subtitle, notes

### Data Quality Insights (from Events tab)

- Timeline gaps (5+ year periods with no events)
- Unsourced events
- Orphan events (not linked to any person)

---

## Wizard Flow Design

### Step 1: Report Type & Filters

Same as current Reports wizard step 1, but with consolidated filter options:

- Date range (from/to)
- Person filter (multi-select)
- Event type filter (multi-select)
- Place filter (with child places toggle)
- Group/faction filter
- Universe filter

### Step 2: Output Format

New step replacing current format selection:

```
Select output format:

Visual Exports
  [ ] Canvas — Interactive Obsidian canvas with linked nodes
  [ ] Excalidraw — Hand-drawn style diagram (requires Excalidraw)

Documents
  [ ] PDF — Professional document for printing/sharing
  [ ] ODT — Editable document (LibreOffice, Word)

Markdown
  [ ] Vertical Timeline — Styled callouts with year columns (requires CSS)
  [ ] Table — Compact data table
  [ ] Simple List — Maximum compatibility, no styling required
  [ ] Dataview Query — Dynamic, auto-updating (requires Dataview)
```

### Step 3: Format Options

Dynamically shows options based on selected format:

**If Canvas or Excalidraw:**
- Layout selector (horizontal/vertical/Gantt)
- Color scheme selector
- Ordering edges toggle
- Group by person toggle
- (Excalidraw only) Drawing style, font, stroke options

**If PDF or ODT:**
- Page size (A4/Letter)
- Date format
- Cover page toggle → title, subtitle, notes fields

**If Markdown formats:**
- Grouping selector (none/year/decade/person/place)
- Include descriptions toggle
- Include sources toggle

### Step 4: Preview & Export

- Quick stats: event count, date range, unique people/places
- Data quality warnings (gaps, unsourced, orphans)
- Export destination (vault folder, download)
- Export button

---

## Implementation Phases

### Phase 1: Extend Reports Timeline

1. Add new output formats to TimelineGenerator/report system:
   - Canvas export (integrate TimelineCanvasExporter)
   - Excalidraw export (integrate ExcalidrawExporter)
   - Markdown callout format
   - Markdown list format
   - Markdown dataview format

2. Add missing filters to report options:
   - Group/faction filter

3. Add styling options infrastructure:
   - Canvas layout/color options
   - Excalidraw drawing style options

### Phase 2: Wizard UI Updates

1. Redesign Step 2 for format selection with categories
2. Implement dynamic Step 3 for format-specific options
3. Add data quality insights to Step 4 preview
4. Update recent reports tracking for new formats

### Phase 3: Deprecate Events Tab Export

1. Add deprecation notice to Events tab Export card:
   "Timeline exports have moved to Reports → Timeline. [Open Reports]"
2. Remove Export card from Events tab in next minor version
3. Update documentation

---

## Technical Notes

### Service Layer Changes

```typescript
// Extend TimelineReportOptions
interface TimelineReportOptions {
  // Existing
  dateRange?: { from?: string; to?: string };
  eventTypes?: string[];
  personIds?: string[];
  placeIds?: string[];
  universe?: string;
  grouping?: 'none' | 'by_year' | 'by_decade' | 'by_person' | 'by_place';

  // New from Events tab
  groupFilter?: string;  // faction/group filter

  // Output format
  format: 'canvas' | 'excalidraw' | 'pdf' | 'odt' |
          'markdown_callout' | 'markdown_table' | 'markdown_list' | 'markdown_dataview';

  // Format-specific options
  canvasOptions?: CanvasExportOptions;
  excalidrawOptions?: ExcalidrawExportOptions;
  pdfOptions?: PdfExportOptions;
  markdownOptions?: MarkdownExportOptions;
}
```

### Files to Modify

- `src/reports/services/timeline-generator.ts` — Add format routing
- `src/reports/ui/report-wizard-modal.ts` — Update wizard steps
- `src/reports/types.ts` — Extend option interfaces
- `src/dates/ui/events-tab.ts` — Add deprecation notice, then remove Export card

### Files to Integrate

- `src/events/services/timeline-markdown-exporter.ts` — Reuse for markdown formats
- `src/events/services/timeline-canvas-exporter.ts` — Reuse for Canvas/Excalidraw

---

## Migration Path

1. **v0.18.0**: Add all formats to Reports Timeline (feature parity)
2. **v0.18.x**: Add deprecation notice to Events tab Export card
3. **v0.19.0**: Remove Events tab Export card entirely

---

## Open Questions

1. Should we preserve the "quick export" feel with a simplified mode in Reports?
2. Should Canvas/Excalidraw exports support grouping options?
3. Should data quality insights be a separate collapsible section or inline warnings?

---

## Success Criteria

- [ ] All 8 export formats available from Reports → Timeline
- [ ] All filters from both systems available
- [ ] Canvas/Excalidraw styling options preserved
- [ ] PDF/ODT cover page options preserved
- [ ] Data quality insights visible in preview step
- [ ] Events tab Export card removed without user complaints
- [ ] Documentation updated for new workflow
