# Visual Tree Charts

Planning document for adding printable tree diagrams to Statistics and Reports.

- **Status:** Planning
- **Priority:** Medium
- **GitHub Issue:** TBD
- **Created:** 2025-12-21
- **Updated:** 2025-12-21

---

## Overview

Add a "Visual Trees" category to Statistics and Reports for generating printable tree diagrams as PDF. This consolidates all printable output in one location while keeping canvas generation (for interactive exploration) in the Canvas Trees tab.

---

## Problem Statement

Genealogists regularly need printed family trees for:

1. **Family reunions and gatherings** — Wall-sized charts for display
2. **Research trips** — Portable reference when visiting archives, courthouses, or cemeteries
3. **Sharing with relatives** — Elderly family members who prefer paper
4. **Wall displays** — Home or genealogical society meeting decorations
5. **Lineage documentation** — Applications for DAR, SAR, and other lineage societies

Currently, Canvas Roots generates interactive Obsidian canvas files but lacks direct PDF export for visual tree diagrams. The Family Chart view has PDF/PNG export using jsPDF, but this is separate from the Report Generator.

---

## Current State

### Canvas Trees Tab

The Canvas Trees tab (formerly "Tree Output") generates `.canvas` files for interactive exploration within Obsidian:

- Pedigree, descendant, and hourglass tree types
- Interactive pan/zoom/navigation
- Links to person notes
- Export button (currently generates canvas files)

### Family Chart View

The Family Chart view provides an interactive relationship visualization with export options:

- Uses jsPDF for PDF export
- Uses html2canvas for PNG export
- Separate from the Report Generator

### Statistics and Reports

The Report Generator supports 13 report types across 5 categories:

| Category | Reports |
|----------|---------|
| Overview | Universe Summary |
| People | All Persons, Living Persons, Deceased Persons, People Without Dates |
| Events | All Events, Events by Type |
| Sources | All Sources, Sources by Type, Uncited Persons |
| Places | All Places, Places by Region |
| Media | Media Gallery |

No tree diagram reports currently exist.

---

## Solution Design

### New Report Category: Visual Trees

Add four tree chart types to Statistics and Reports:

| Chart Type | Description | Icon |
|------------|-------------|------|
| **Pedigree Tree** | Ancestors branching upward from root person | Custom SVG |
| **Descendant Tree** | Descendants branching downward from root person | Custom SVG |
| **Hourglass Tree** | Both ancestors and descendants from root person | Custom SVG |
| **Fan Chart** | Semicircular pedigree with radiating ancestor segments | Custom SVG |

Each chart type opens a wizard modal for configuration, then renders directly to PDF via pdfmake.

### Chart Wizard Options

| Option | Description | Values |
|--------|-------------|--------|
| **Root person** | Person picker to select starting individual | Person search |
| **Generations** | Number of generations to include | 2-10+ |
| **Layout direction** | Vertical or horizontal orientation | Vertical, Horizontal |
| **Page size** | Output page dimensions | Letter, A4, Legal, Tabloid, Custom |
| **Orientation** | Portrait or landscape | Portrait, Landscape |
| **Node content** | What to display in each box | Name only, Name + dates, Name + dates + places |
| **Include photos** | Show person thumbnails in nodes | Yes/No |
| **Color scheme** | Visual styling | Default, Grayscale, Custom |

### Custom SVG Icons

Each tree type has a custom SVG icon for the report tile, following Lucide design guidelines:

- 24×24 pixel canvas with 1px padding
- 2px stroke width with round caps and joins
- Themeable via `currentColor`

#### Pedigree Tree Icon

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- Root person at bottom -->
  <circle cx="12" cy="19" r="2"/>
  <!-- Trunk up to branch point -->
  <line x1="12" y1="17" x2="12" y2="13"/>
  <!-- Branches to parents -->
  <line x1="12" y1="13" x2="6" y2="9"/>
  <line x1="12" y1="13" x2="18" y2="9"/>
  <!-- Parent nodes -->
  <circle cx="6" cy="7" r="2"/>
  <circle cx="18" cy="7" r="2"/>
</svg>
```

#### Descendant Tree Icon

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- Root person at top -->
  <circle cx="12" cy="5" r="2"/>
  <!-- Trunk down to branch point -->
  <line x1="12" y1="7" x2="12" y2="11"/>
  <!-- Branches to children -->
  <line x1="12" y1="11" x2="6" y2="15"/>
  <line x1="12" y1="11" x2="18" y2="15"/>
  <!-- Child nodes -->
  <circle cx="6" cy="17" r="2"/>
  <circle cx="18" cy="17" r="2"/>
</svg>
```

#### Hourglass Tree Icon

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- Center root node -->
  <circle cx="12" cy="12" r="2"/>
  <!-- Lines up to parents -->
  <line x1="10" y1="11" x2="6" y2="7"/>
  <line x1="14" y1="11" x2="18" y2="7"/>
  <!-- Parent nodes -->
  <circle cx="5" cy="6" r="1.5"/>
  <circle cx="19" cy="6" r="1.5"/>
  <!-- Lines down to children -->
  <line x1="10" y1="13" x2="6" y2="17"/>
  <line x1="14" y1="13" x2="18" y2="17"/>
  <!-- Child nodes -->
  <circle cx="5" cy="18" r="1.5"/>
  <circle cx="19" cy="18" r="1.5"/>
</svg>
```

#### Fan Chart Icon

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- Outer semicircle arc -->
  <path d="M 2 18 A 10 10 0 0 1 22 18"/>
  <!-- Radial dividers creating wedges -->
  <line x1="12" y1="18" x2="2" y2="18"/>
  <line x1="12" y1="18" x2="4" y2="10"/>
  <line x1="12" y1="18" x2="12" y2="8"/>
  <line x1="12" y1="18" x2="20" y2="10"/>
  <line x1="12" y1="18" x2="22" y2="18"/>
</svg>
```

---

## UI Changes

### Tab Rename

| Location | Current | After |
|----------|---------|-------|
| Control Center tab | "Tree Output" | "Canvas Trees" |
| Dashboard tile | "Tree Output" | "Canvas Trees" |

The rename clarifies the distinction: "Canvas Trees" for interactive exploration, "Visual Trees" (in Reports) for printable PDF output.

### Export Button Changes

| Location | Current Behavior | New Behavior |
|----------|------------------|--------------|
| **Canvas Trees tab** | Export button in preview panel generates canvas | Button navigates to Statistics and Reports → Visual Trees |
| **Family Chart view** | Export button opens jsPDF export modal | Button navigates to Statistics and Reports → Visual Trees |

### Statistics and Reports Layout

The Visual Trees category appears alongside existing report categories:

```
┌─────────────────────────────────────────────────────────────┐
│  Statistics and Reports                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Overview    People    Events    Sources    Places    Media │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Visual Trees                                        │    │
│  │                                                      │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│    │
│  │  │ Pedigree │ │Descendant│ │Hourglass │ │   Fan    ││    │
│  │  │   Tree   │ │   Tree   │ │   Tree   │ │  Chart   ││    │
│  │  │   [icon] │ │   [icon] │ │   [icon] │ │  [icon]  ││    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘│    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Library Consolidation

### Current State

| Feature | Library |
|---------|---------|
| Family Chart PDF export | jsPDF |
| Family Chart PNG export | html2canvas |
| Report Generator PDF output | pdfmake |

### Target State

| Feature | Library |
|---------|---------|
| All PDF generation | pdfmake |
| PNG export | html2canvas (keep for now) |

### Migration Steps

1. Add Visual Trees reports using pdfmake
2. Keep Family Chart jsPDF temporarily
3. Once Visual Trees mature, redirect Family Chart export to Visual Trees
4. Remove jsPDF dependency

### Benefits

- Single PDF library = smaller bundle size
- Consistent PDF output styling
- Less maintenance burden
- pdfmake is more actively maintained

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TreeChartWizardModal                      │
│  (Chart type selection, configuration options)               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    VisualTreeService                         │
│  - buildPedigreeTree(rootPerson, generations)                │
│  - buildDescendantTree(rootPerson, generations)              │
│  - buildHourglassTree(rootPerson, ancestorGens, descGens)    │
│  - buildFanChart(rootPerson, generations)                    │
│  - calculateLayout(tree, options): TreeLayout                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PdfGeneratorService                       │
│  (Extended with tree diagram rendering)                      │
│  - generateTreePdf(layout: TreeLayout, options): Blob        │
│  - renderPedigreeLayout(layout): pdfmake.Content             │
│  - renderDescendantLayout(layout): pdfmake.Content           │
│  - renderHourglassLayout(layout): pdfmake.Content            │
│  - renderFanChartLayout(layout): pdfmake.Content             │
└─────────────────────────────────────────────────────────────┘
```

### Data Structures

```typescript
interface TreeNode {
  person: PersonNode;
  x: number;
  y: number;
  width: number;
  height: number;
  children?: TreeNode[];
  parents?: TreeNode[];
}

interface TreeLayout {
  type: 'pedigree' | 'descendant' | 'hourglass' | 'fan';
  nodes: TreeNode[];
  connections: TreeConnection[];
  bounds: { width: number; height: number };
  pageSize: PageSize;
  orientation: 'portrait' | 'landscape';
}

interface TreeConnection {
  from: TreeNode;
  to: TreeNode;
  type: 'parent' | 'child' | 'spouse';
}

interface TreeChartOptions {
  rootPersonCrId: string;
  generations: number;
  direction: 'vertical' | 'horizontal';
  pageSize: 'letter' | 'a4' | 'legal' | 'tabloid' | 'custom';
  orientation: 'portrait' | 'landscape';
  nodeContent: 'name' | 'name-dates' | 'name-dates-places';
  includePhotos: boolean;
  colorScheme: 'default' | 'grayscale' | 'custom';
  customColors?: {
    nodeBackground: string;
    nodeBorder: string;
    nodeText: string;
    connectionLine: string;
  };
}
```

### Layout Algorithms

#### Pedigree Tree

Standard binary tree layout with root at bottom:

```
                    ┌───────┐ ┌───────┐
                    │ GGP1  │ │ GGP2  │
                    └───┬───┘ └───┬───┘
                        │         │
                    ┌───┴─────────┴───┐
                    │      GP1        │
                    └────────┬────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │                                          │
    ┌───┴───┐                                  ┌───┴───┐
    │  GP2  │                                  │  GP3  │
    └───┬───┘                                  └───┬───┘
        │                                          │
    ┌───┴───┐                                  ┌───┴───┐
    │ Parent│                                  │ Parent│
    └───┬───┘                                  └───┬───┘
        │                                          │
        └────────────────┬─────────────────────────┘
                         │
                    ┌────┴────┐
                    │  Root   │
                    └─────────┘
```

**Algorithm:**
1. Start with root person at bottom center
2. For each generation, calculate horizontal positions to avoid overlap
3. Use Reingold-Tilford algorithm or similar for optimal spacing
4. Scale to fit page dimensions

#### Descendant Tree

Inverted pedigree with root at top:

```
                    ┌─────────┐
                    │  Root   │
                    └────┬────┘
                         │
        ┌────────────────┴────────────────┐
        │                                  │
    ┌───┴───┐                          ┌───┴───┐
    │ Child │                          │ Child │
    └───┬───┘                          └───┬───┘
        │                                  │
   ┌────┴────┐                       ┌─────┴─────┐
   │         │                       │           │
┌──┴──┐  ┌──┴──┐                 ┌──┴──┐    ┌──┴──┐
│ GC1 │  │ GC2 │                 │ GC3 │    │ GC4 │
└─────┘  └─────┘                 └─────┘    └─────┘
```

#### Hourglass Tree

Combines pedigree (upward) and descendant (downward):

```
         ┌───────┐     ┌───────┐
         │  GP1  │     │  GP2  │
         └───┬───┘     └───┬───┘
             │             │
         ┌───┴─────────────┴───┐
         │      Parent         │
         └──────────┬──────────┘
                    │
              ┌─────┴─────┐
              │   Root    │
              └─────┬─────┘
                    │
         ┌──────────┴──────────┐
         │        Child        │
         └──────────┬──────────┘
             │             │
         ┌───┴───┐     ┌───┴───┐
         │  GC1  │     │  GC2  │
         └───────┘     └───────┘
```

#### Fan Chart

Radial layout with root at center:

```
              ╱ GGP1 ╲   ╱ GGP2 ╲
            ╱───────────────────────╲
          ╱     ╱ GP1 ╲   ╱ GP2 ╲     ╲
        ╱─────────────────────────────╲
       │        ╱ P1 ╲   ╱ P2 ╲        │
       │───────────────────────────────│
       │              │                │
       │            ROOT               │
       │              │                │
       └───────────────────────────────┘
```

**Algorithm:**
1. Root at center (or center-bottom for half-fan)
2. Each generation occupies a ring segment
3. Angular width of each ancestor = 180° / 2^(generation-1)
4. Use polar coordinates, convert to Cartesian for PDF rendering

---

## Phased Implementation

### Phase 1: Foundation

**Scope:**
- Create `VisualTreeService` with tree building and layout algorithms
- Create `TreeChartWizardModal` for chart configuration
- Implement Pedigree Tree chart type
- Extend `PdfGeneratorService` with tree rendering
- Add Visual Trees category to report type definitions

**Files to Create:**

| File | Purpose |
|------|---------|
| `src/trees/services/visual-tree-service.ts` | Tree building and layout calculations |
| `src/trees/ui/tree-chart-wizard-modal.ts` | Configuration wizard |
| `src/trees/types/tree-types.ts` | TypeScript interfaces |

**Files to Modify:**

| File | Changes |
|------|---------|
| `src/reports/services/pdf-generator-service.ts` | Add tree diagram rendering |
| `src/reports/types/report-types.ts` | Add Visual Trees category |
| `src/reports/ui/statistics-tab.ts` | Display Visual Trees tiles |

### Phase 2: Additional Chart Types

**Scope:**
- Implement Descendant Tree layout
- Implement Hourglass Tree layout
- Add chart type switching in wizard

### Phase 3: Fan Chart

**Scope:**
- Implement radial layout algorithm
- Handle curved text for names (or use straight text with rotation)
- Add fan-specific options (half vs full, segment styling)

### Phase 4: Icons and Polish

**Scope:**
- Integrate custom SVG icons into report tiles
- Add icons to `src/ui/tree-icons/` directory
- Register icons with Obsidian's icon system
- Polish wizard UI and PDF output

### Phase 5: Migration

**Scope:**
- Update Canvas Trees tab export button to navigate to Visual Trees
- Update Family Chart view export button to navigate to Visual Trees
- Remove jsPDF dependency
- Update documentation

---

## Scope Boundaries

### In Scope

| Feature | Description |
|---------|-------------|
| PDF tree diagram generation | Pedigree, Descendant, Hourglass, Fan charts |
| pdfmake-based rendering | Consistent with existing reports |
| Tree wizard in Reports | Configuration modal for each chart type |
| Custom SVG icons | Lucide-compatible icons for report tiles |
| Tab rename | "Tree Output" → "Canvas Trees" |
| Export button redirect | Point to Visual Trees instead of canvas export |

### Out of Scope

| Feature | Reason |
|---------|--------|
| Canvas file generation changes | Stays in Canvas Trees tab |
| jsPDF support | Being replaced by pdfmake |
| Interactive tree visualization | Use Family Chart view for that |
| Large format printing (A0, etc.) | Complex page tiling; consider for future |
| GEDCOM export | Separate feature |

---

## Success Criteria

### Phase 1
- [ ] Pedigree Tree generates correct PDF output
- [ ] Wizard allows root person selection and generation count
- [ ] PDF renders readable with 5+ generations
- [ ] Visual Trees category appears in Statistics and Reports

### Phase 2
- [ ] Descendant Tree generates correct PDF output
- [ ] Hourglass Tree generates correct PDF output
- [ ] All three chart types accessible from wizard

### Phase 3
- [ ] Fan Chart generates correct radial layout
- [ ] Text readable in all segments
- [ ] Handles 4+ generations gracefully

### Phase 4
- [ ] Custom icons display on report tiles
- [ ] Icons adapt to light/dark themes
- [ ] Wizard polished and intuitive

### Phase 5
- [ ] Export buttons redirect correctly
- [ ] jsPDF removed from dependencies
- [ ] Documentation updated
- [ ] No regression in existing functionality

---

## Technical Considerations

### Page Size Handling

For large trees, content may exceed single page:

| Approach | Pros | Cons |
|----------|------|------|
| Scale to fit | Simple, always fits | May be unreadable |
| Multi-page with overlap | Readable | Complex layout |
| Limit generations | Predictable | User frustration |

**Recommendation:** Start with scale-to-fit, add generation limit warning. Multi-page is future enhancement.

### Font Handling

pdfmake requires embedded fonts. Use standard fonts initially:

- Roboto (pdfmake default)
- Helvetica fallback

Custom fonts can be added later if needed.

### Photo Embedding

If "Include photos" is enabled:

1. Resolve photo from person's `media` property
2. Convert to base64 for pdfmake embedding
3. Scale to fit node dimensions
4. Handle missing photos gracefully (show placeholder or skip)

### Performance

For large trees (10+ generations):

- Lazy calculate only visible/needed nodes
- Pre-calculate layout before PDF generation
- Show progress indicator during generation
- Consider generation limit for performance

---

## Related Documents

- [Roadmap: Visual Tree Charts](../../wiki-content/Roadmap.md#visual-tree-charts)
- [Statistics and Reports](../../wiki-content/Statistics-And-Reports.md)
- [Canvas Trees Tab](../../wiki-content/Control-Center.md#canvas-trees)
- [pdfmake Documentation](https://pdfmake.github.io/docs/)
