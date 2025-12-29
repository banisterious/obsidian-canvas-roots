# Timeline Export Consolidation

Planning document for merging timeline export functionality from the Events tab into the unified Reports system.

- **Status:** Phase 3 In Progress
- **Target Version:** v0.18.2 (Phases 1-3 deprecation notice), future release (removal)
- **GitHub Issue:** #TBD
- **Priority:** Medium
- **Created:** 2025-12-27
- **Updated:** 2025-12-28

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
| Markdown: Callout | Events tab | Vertical timeline with year columns, colored dots (plugin styling) |
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

### Grouping Behavior by Format

| Format | None | By Year | By Decade | By Person | By Place |
|--------|------|---------|-----------|-----------|----------|
| **Canvas** | Single timeline, chronological | Canvas groups with year labels | Canvas groups with decade labels | Swim lanes (existing) | Canvas groups with place names |
| **Excalidraw** | Single timeline | Frames with year headers | Frames with decade headers | Swim lanes with frames | Frames with place names |
| **PDF/ODT** | Flat list | Section headers per year | Section headers per decade | Section headers per person | Section headers per place |
| **Markdown: Callout** | Year headers (default) | Same as default | Decade headers instead | Separate callout blocks per person | Separate callout blocks per place |
| **Markdown: Table** | Single table | Year column, sorted | Decade column added | Person column, sorted | Place column, sorted |
| **Markdown: List** | H2 headers by year | Same as default | H2 by decade | H2 by person name | H2 by place name |
| **Dataview** | Single query | `GROUP BY year` | `GROUP BY decade` | `GROUP BY person` | `GROUP BY place` |

**Notes:**
- Callout format inherently groups by year, so "By year" = current behavior
- "By person/place" for callouts creates a fundamentally different structure with outer grouping by person/place and inner grouping by year

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

**Markdown: Callout:**

The callout format uses two nested callout types:

| Callout | Default | Purpose |
|---------|---------|---------|
| Outer container | `[!cr-timeline-outer]` | Wraps entire timeline, displays title |
| Year/event entries | `[!cr-timeline]` | Individual year blocks with color modifier (e.g., `\|green`) |

Example output:
```markdown
> [!cr-timeline-outer] Family Timeline
>
>> [!cr-timeline|green] [[1850]]
>> - [[Birth of John Smith]]
>> 	- (March 15, 1850)
```

**Custom callout types:** Users can specify their own callout type names to leverage existing CSS styling. The wizard provides a dropdown with presets plus a custom option:

| Option | Description |
|--------|-------------|
| cr-timeline (default) | Plugin's built-in styled callout |
| timeline | Common callout name |
| event | Common callout name |
| note | Obsidian's built-in note callout |
| Custom... | Text field for any custom callout name |

The custom callout applies to the inner year/event callouts only. The outer container uses `cr-timeline-outer` for structural styling.

### Data Quality Insights (from Events tab)

- Timeline gaps (5+ year periods with no events)
- Unsourced events
- Orphan events (not linked to any person)

---

## Wizard Flow Design

### Simple Mode Toggle

A "Simple Mode" toggle at the top of the wizard enables quick exports:
- When enabled: Skip Step 3 (Format Options), use sensible defaults
- Single-click path: Select format → Export immediately
- Toggle state persists in settings
- Power users disable for full control

### Saved Presets

Named presets dropdown at top of wizard for quick access:
- Save complete configurations including format and all options
- Examples: "Family Timeline (Canvas)", "Research Report (PDF)"
- Recent reports list shows format icon/badge
- Migration: Existing configs default to `markdown_table` format

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
  [ ] Vertical Timeline — Styled callouts with year columns (plugin styling)
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
- Grouping selector:
  - By person: Swim lanes (current behavior)
  - By year/decade: Vertical columns with headers, events stacked within
  - By place: Labeled regions (may require layout algorithm changes)
- (Excalidraw only) Drawing style, font, stroke options

**If PDF or ODT:**
- Page size (A4/Letter)
- Date format
- Cover page toggle → title, subtitle, notes fields

**If Markdown formats:**
- Grouping selector (none/year/decade/person/place)
- Include descriptions toggle
- Include sources toggle

**If Markdown: Callout (Vertical Timeline):**
- Callout type selector (presets + custom option)

### Step 4: Preview & Export

- Quick stats: event count, date range, unique people/places
- Data quality section (collapsible):
  - Collapsed by default if no issues; expanded if issues exist
  - Shows gaps, unsourced events, orphan events
  - "Review issues first" links to Data Quality tab
  - Non-blocking — users can export despite warnings
- Export destination (vault folder, download)
- Export button
- Save as preset button

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

1. ~~Add deprecation notice to Events tab Export card~~ ✓ (implemented in events-tab.ts:716-736)
2. Remove Export card from Events tab in future release
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
  calloutOptions?: {
    calloutType: string;  // 'cr-timeline' | 'timeline' | 'event' | 'note' | custom
  };
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

1. **v0.18.2**: Add all formats to Reports Timeline (feature parity) + deprecation notice
2. **Future release**: Remove Events tab Export card entirely

---

## Success Criteria

- [x] All 8 export formats available from Reports → Timeline
- [x] All filters from both systems available
- [x] Canvas/Excalidraw styling options preserved
- [x] PDF/ODT cover page options preserved
- [x] Data quality insights visible in preview step
- [x] Deprecation notice added to Events tab Export card
- [ ] Events tab Export card removed (future release)
- [ ] Documentation updated for new workflow
