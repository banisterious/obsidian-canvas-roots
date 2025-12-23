# Tree Visualization Overhaul

Comprehensive planning document for modernizing tree visualization in Canvas Roots:

1. **Canvas Trees Tab Redesign** - Transform into a tree manager dashboard with wizard-based generation
2. **Visual Tree Reports** - Add printable tree diagrams (Pedigree, Descendant, Hourglass, Fan) to Statistics and Reports

- **Status:** Complete (Phases 1 & 2 Complete)
- **Priority:** Medium
- **GitHub Issue:** TBD
- **Created:** 2025-12-21
- **Updated:** 2025-12-22

---

## Implementation Progress

### Completed

#### Phase 1: Canvas Trees Tab Redesign (2025-12-21)

**Tree Generation Wizard Modal** - `src/trees/ui/tree-generation-wizard.ts` (deprecated)
- 5-step wizard flow: Person → Layout → Options → Preview → Output
- Step 1: Person search with keyboard navigation, family group filtering
- Step 2: Tree type selection (Ancestors/Descendants/Combined), layout algorithm, generation limits
- Step 3: Scope options (step-parents, adoptive parents, collection/place/universe filters) and style options (coloring, arrows, edge colors, spouse edges)
- Step 4: Interactive preview with tree statistics
- Step 5: Canvas name, save folder selection, open after generate option
- Refactored from inline UI to modal wizard pattern

**Canvas Trees Tab Dashboard** - `src/ui/control-center.ts`
- Card-based layout replacing sparse accordion design
- Overview Card: Title with icon, action buttons (New Tree, Open Latest, Generate All), 4-column stats grid
- Recent Trees Card: Tree list with metadata (people count, root person, time ago), action buttons (open, context menu)
- Tips Card: Condensed guidance for tree generation
- Empty state with icon and call-to-action

**CSS Updates** - `styles/tree-output.css`
- New card component styles (`.crc-tree-card`, `.crc-tree-card__header`, etc.)
- Stats grid with visual separators
- Recent tree item styling with borders
- Empty state and tips list styling
- Wizard options step with collapsible `<details>` sections

#### Phase 2: Visual Tree Reports & Unified Wizard (2025-12-21 to 2025-12-22)

**Unified Tree Wizard Modal** - `src/trees/ui/unified-tree-wizard-modal.ts`
- Merged Canvas and PDF wizard functionality into single modal
- Dynamic step flow based on output format selection:
  - Canvas path: Person → Tree Type → Output Format → Canvas Options → Preview → Output
  - PDF path: Person → Tree Type → Output Format → PDF Options → Output
- Chart type badges shown in step headers after selection
- Custom tree icons for all chart types (cr-pedigree-tree, cr-descendant-tree, cr-hourglass-tree, cr-fan-chart)

**Visual Tree Service** - `src/trees/services/visual-tree-service.ts`
- Tree data building from person notes
- Layout algorithms for all chart types:
  - Pedigree: Standard ancestor tree with binary branching
  - Descendant: Inverted tree with children branching downward
  - Hourglass: Bidirectional with ancestors above and descendants below
  - Fan: Semicircular radial layout (placeholder for future)
- Coordinate calculation and bounding box computation
- Large tree analysis with page size recommendations

**PDF Report Renderer** - `src/reports/services/pdf-report-renderer.ts`
- Extended with visual tree PDF generation
- Tree-specific PDF layout with node boxes and connecting lines
- Color schemes: default, grayscale, generational
- Page size options: letter, a4, legal, tabloid, a3
- Portrait and landscape orientations
- Large tree handling with auto-scaling and page size recommendations

**Visual Trees Report Category** - `src/reports/types/report-types.ts`
- Added 4 visual tree report types:
  - `pedigree-tree-pdf`: Graphical ancestor tree
  - `descendant-tree-pdf`: Graphical descendant tree
  - `hourglass-tree-pdf`: Both ancestors and descendants
  - `fan-chart-pdf`: Semicircular pedigree (PDF only)

**Custom SVG Icons** - `src/ui/lucide-icons.ts`
- 4 custom icons registered via Obsidian's addIcon() API
- Icons use 100x100 viewBox format per Obsidian requirements
- Prefixed with `cr-` to avoid caching issues
- Used across Statistics view, Report Generator, and Unified Wizard

**Deprecated Old Wizards** (deleted 2025-12-22)
- `src/trees/ui/tree-generation-wizard.ts` - Removed (was 1500+ lines)
- `src/trees/ui/visual-tree-wizard-modal.ts` - Removed (was 570+ lines)

### Deferred

#### Phase 3: Library Consolidation (Deferred)

**Decision (2025-12-22):** Keep jsPDF for Family Chart and defer library consolidation. The jsPDF-based Family Chart PDF export produces significantly higher quality output than the pdfmake visual trees due to differences in how images are embedded and scaled.

**Future path:** Rather than migrating Family Chart to pdfmake, improve the pdfmake visual tree rendering to match Family Chart quality.

**See:** [Visual Tree PDF Enhancements](../visual-tree-pdf-enhancements.md) — Detailed technical analysis and implementation plan for improving pdfmake output quality.

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

### V2 Icon Alternatives (AI-Generated)

Alternative icon designs generated via Nano Banana Pro and optimized for Lucide style.

#### Descendant Tree Icon (V2)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- Root node at top -->
  <circle cx="12" cy="4" r="2.5"/>
  <!-- Child nodes -->
  <circle cx="5" cy="13" r="2"/>
  <circle cx="19" cy="13" r="2"/>
  <!-- Grandchild nodes -->
  <circle cx="5" cy="21" r="1.5"/>
  <circle cx="19" cy="21" r="1.5"/>
  <!-- Lines from root to children -->
  <line x1="10" y1="6" x2="6.5" y2="11"/>
  <line x1="14" y1="6" x2="17.5" y2="11"/>
  <!-- Lines from children to grandchildren -->
  <line x1="5" y1="15" x2="5" y2="19.5"/>
  <line x1="19" y1="15" x2="19" y2="19.5"/>
</svg>
```

#### Fan Chart Icon (V2)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- Outer arc -->
  <path d="M 2 20 A 12 12 0 0 1 22 20"/>
  <!-- Inner arc -->
  <path d="M 6 20 A 8 8 0 0 1 18 20"/>
  <!-- Radial dividers -->
  <line x1="12" y1="20" x2="12" y2="8"/>
  <line x1="12" y1="20" x2="4" y2="12"/>
  <line x1="12" y1="20" x2="20" y2="12"/>
</svg>
```

#### Hourglass Tree Icon (V2)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- Center root node -->
  <circle cx="12" cy="12" r="2.5"/>
  <!-- Parent nodes (top) -->
  <circle cx="4" cy="4" r="2"/>
  <circle cx="20" cy="4" r="2"/>
  <!-- Child nodes (bottom) -->
  <circle cx="4" cy="20" r="2"/>
  <circle cx="20" cy="20" r="2"/>
  <!-- Lines to parents -->
  <line x1="10" y1="10" x2="5.5" y2="5.5"/>
  <line x1="14" y1="10" x2="18.5" y2="5.5"/>
  <!-- Lines to children -->
  <line x1="10" y1="14" x2="5.5" y2="18.5"/>
  <line x1="14" y1="14" x2="18.5" y2="18.5"/>
</svg>
```

#### Pedigree Tree Icon (V2)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- Root node at bottom -->
  <circle cx="12" cy="20" r="2.5"/>
  <!-- Parent nodes -->
  <circle cx="5" cy="11" r="2"/>
  <circle cx="19" cy="11" r="2"/>
  <!-- Grandparent nodes -->
  <circle cx="5" cy="3" r="1.5"/>
  <circle cx="19" cy="3" r="1.5"/>
  <!-- Lines from root to parents -->
  <line x1="10" y1="18" x2="6.5" y2="13"/>
  <line x1="14" y1="18" x2="17.5" y2="13"/>
  <!-- Lines from parents to grandparents -->
  <line x1="5" y1="9" x2="5" y2="4.5"/>
  <line x1="19" y1="9" x2="19" y2="4.5"/>
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

## Canvas Trees Tab Redesign

The Canvas Trees tab currently shows the tree generation interface inline. This redesign transforms it into a dashboard/manager view with generation moved to a modal wizard.

### Current Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  Canvas Trees                                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐  ┌────────────────────────────────────┐   │
│  │  Person Browser     │  │  Layout Options                     │   │
│  │  - Search           │  │  - Tree type                        │   │
│  │  - Person list      │  │  - Layout algorithm                 │   │
│  │  - Selection        │  │  - Generation limits                │   │
│  │                     │  │  - Styling options                  │   │
│  └─────────────────────┘  └────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Interactive Preview                                          │  │
│  │  (Pan, zoom, explore before generating)                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│                                        [Generate Canvas]             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Proposed Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  Canvas Trees                                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Actions                                         [+ New Tree] │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Your Canvas Trees                                            │  │
│  │                                                               │  │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │  │
│  │  │ Smith Family    │ │ Jones Ancestors │ │ My Descendants  │ │  │
│  │  │ Pedigree • 5gen │ │ Pedigree • 8gen │ │ Descendant•4gen │ │  │
│  │  │ Modified: Dec 20│ │ Modified: Dec 15│ │ Modified: Dec 10│ │  │
│  │  │ [Open][⋮ Menu]  │ │ [Open][⋮ Menu]  │ │ [Open][⋮ Menu]  │ │  │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘ │  │
│  │                                                               │  │
│  │  Empty state: "No canvas trees yet. Click 'New Tree' to      │  │
│  │  generate your first family tree canvas."                     │  │
│  │                                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Existing Trees Detection

Trees are detected using two complementary methods, building on existing infrastructure.

#### Current Implementation

The plugin already has infrastructure for both approaches:

**1. Canvas File Metadata** (already exists)

Generated canvases include full metadata in `metadata.frontmatter.canvasRootsMetadata`:

```json
{
  "nodes": [...],
  "edges": [...],
  "metadata": {
    "version": "1.0-1.0",
    "frontmatter": {
      "plugin": "canvas-roots",
      "generation": {
        "rootCrId": "abc-123-def-456",
        "rootPersonName": "John Smith",
        "treeType": "full",
        "maxGenerations": 0,
        "includeSpouses": true,
        "direction": "vertical",
        "timestamp": 1734789000000
      },
      "layout": {
        "nodeWidth": 250,
        "nodeHeight": 120,
        "nodeSpacingX": 300,
        "nodeSpacingY": 200,
        "layoutType": "standard"
      },
      "styleOverrides": {
        "nodeColorScheme": "sex",
        "parentChildArrowStyle": "directed"
      }
    }
  }
}
```

**Source:** `src/core/canvas-generator.ts` lines 73-124

**2. Plugin Data Tracking** (partially exists)

The plugin already tracks recent trees in settings:

```typescript
// Current: src/settings.ts lines 13-20
interface RecentTreeInfo {
  canvasPath: string;
  canvasName: string;
  peopleCount: number;
  edgeCount: number;
  rootPerson: string;
  timestamp: number;
}

// Stored in plugin.settings.recentTrees (limited to 10)
```

**Source:** `src/ui/control-center.ts` lines 5025-5053

#### Required Changes

| Current State | Required Change |
|---------------|-----------------|
| `recentTrees` limited to 10 items | Expand to full registry (`canvasTreeRegistry`) |
| No file existence verification | Verify files exist on tab open |
| No discovery of moved/renamed canvases | Scan for canvases with `plugin: 'canvas-roots'` metadata |
| No sync with file system | Update registry when files renamed/deleted |

#### New Data Structures

```typescript
// Expanded registry (replaces recentTrees)
interface CanvasTreeRegistry {
  trees: CanvasTreeRecord[];
  lastScanTimestamp: number;
  version: number;  // For future migrations
}

interface CanvasTreeRecord {
  // Identity
  canvasPath: string;
  canvasName: string;

  // Generation info (from canvas metadata)
  rootPersonCrId: string;
  rootPersonName: string;
  treeType: 'full' | 'ancestors' | 'descendants';
  layoutType: string;
  maxGenerations: number;
  direction: 'vertical' | 'horizontal';

  // Statistics
  nodeCount: number;
  edgeCount: number;

  // Timestamps
  createdAt: number;
  lastModified: number;
  lastVerified: number;  // When we last confirmed file exists

  // Status
  status: 'valid' | 'missing' | 'orphaned';
}
```

#### Detection Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Tab Opens                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Load registry from plugin data (instant)                     │
│     → Display trees immediately with cached data                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Verify existing entries (background, async)                  │
│     For each registry entry:                                     │
│     - Check if file still exists at canvasPath                   │
│     - If missing: mark status = 'missing', show indicator        │
│     - If exists: update lastVerified timestamp                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Discover new canvases (background, async)                    │
│     - Scan all .canvas files in vault                            │
│     - Check for metadata.frontmatter.plugin === 'canvas-roots'   │
│     - Add any not in registry (user may have moved/copied)       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Save updated registry                                        │
└─────────────────────────────────────────────────────────────────┘
```

#### File System Event Handling

Subscribe to Obsidian vault events for real-time sync:

```typescript
// In plugin onload()
this.registerEvent(
  this.app.vault.on('rename', (file, oldPath) => {
    if (file.extension === 'canvas') {
      this.canvasTreeService.handleFileRename(oldPath, file.path);
    }
  })
);

this.registerEvent(
  this.app.vault.on('delete', (file) => {
    if (file.extension === 'canvas') {
      this.canvasTreeService.handleFileDelete(file.path);
    }
  })
);
```

#### Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Large vaults with many .canvas files | Only scan files, don't parse unless needed |
| Slow JSON parsing | Parse metadata section only, not full canvas |
| Frequent tab switching | Cache scan results, only re-scan if vault modified |
| Background scanning blocking UI | Use `requestIdleCallback` or chunked async processing |

#### Scan Optimization

```typescript
async scanForCanvasRootsCanvases(): Promise<CanvasTreeRecord[]> {
  const canvasFiles = this.app.vault.getFiles()
    .filter(f => f.extension === 'canvas');

  const discovered: CanvasTreeRecord[] = [];

  for (const file of canvasFiles) {
    // Quick check: read first ~500 bytes to check for marker
    const content = await this.app.vault.cachedRead(file);

    // Fast string check before JSON parse
    if (!content.includes('"plugin":"canvas-roots"') &&
        !content.includes('"plugin": "canvas-roots"')) {
      continue;
    }

    // Full parse only for Canvas Roots canvases
    try {
      const data = JSON.parse(content);
      if (data.metadata?.frontmatter?.plugin === 'canvas-roots') {
        discovered.push(this.extractRecordFromCanvas(file, data));
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  }

  return discovered;
}
```

### Tree Card Actions

Each tree card in the list provides quick actions:

| Action | Description |
|--------|-------------|
| **Open** | Open canvas in editor |
| **Regenerate** | Re-run generation with same settings |
| **Duplicate** | Create a copy with new settings |
| **Edit Settings** | Open wizard pre-filled with current settings |
| **Delete** | Remove canvas file (with confirmation) |

### Tree Generation Wizard Modal

The "+ New Tree" button opens a multi-step wizard modal:

#### Step 1: Select Root Person

```
┌─────────────────────────────────────────────────────────────────┐
│  Generate Canvas Tree                              Step 1 of 4  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Select Root Person                                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🔍 Search by name...                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  John Smith (1850-1920)                              ○  │   │
│  │  Jane Smith née Jones (1855-1930)                    ○  │   │
│  │  Robert Smith (1880-1945)                            ●  │   │
│  │  ...                                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Selected: Robert Smith (1880-1945)                              │
│                                                                  │
│                                          [Cancel]  [Next →]      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 2: Choose Tree Type & Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Generate Canvas Tree                              Step 2 of 4  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Tree Type                                                       │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Pedigree   │  │ Descendant  │  │  Hourglass  │              │
│  │    [icon]   │  │    [icon]   │  │    [icon]   │              │
│  │  Ancestors  │  │ Descendants │  │    Both     │              │
│  │     ●       │  │     ○       │  │     ○       │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  Layout Algorithm                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Standard                                            ▼  │   │
│  └─────────────────────────────────────────────────────────┘   │
│  Options: Standard, Compact, Timeline, Horizontal               │
│                                                                  │
│  Generations                                                     │
│  Ancestors:   [  5  ▼]    Descendants: [  3  ▼]                 │
│                                                                  │
│                                    [← Back]  [Cancel]  [Next →]  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 3: Preview

```
┌─────────────────────────────────────────────────────────────────┐
│  Generate Canvas Tree                              Step 3 of 4  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Preview                                                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │              Interactive preview canvas                  │   │
│  │              (Pan, zoom, explore)                        │   │
│  │                                                          │   │
│  │                                                          │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Summary: Pedigree tree • 5 generations • 31 people             │
│                                                                  │
│                                    [← Back]  [Cancel]  [Next →]  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 4: Output Settings

```
┌─────────────────────────────────────────────────────────────────┐
│  Generate Canvas Tree                              Step 4 of 4  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Output Settings                                                 │
│                                                                  │
│  Canvas Name                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Robert Smith - Pedigree Tree                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Save Location                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Family Trees/                                       📁  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ☐ Open canvas after generation                                 │
│  ☐ Overwrite existing file if present                           │
│                                                                  │
│                                    [← Back]  [Cancel] [Generate] │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Notes

#### Tab Component Changes

The `CanvasTreesTab` component changes from:
- Inline person browser + layout options + preview

To:
- Actions card with "New Tree" button
- Tree list component with cards
- Empty state when no trees exist

#### New Components

| Component | Purpose |
|-----------|---------|
| `CanvasTreeListCard` | Card displaying a single tree's info and actions |
| `CanvasTreeActionMenu` | Dropdown menu for tree actions |
| `TreeGenerationWizardModal` | Multi-step wizard for tree generation |
| `CanvasTreeService` | Service for tracking and scanning trees |

#### Migration Path

1. Add new components alongside existing UI
2. Feature flag to switch between old/new UI
3. Test new UI thoroughly
4. Make new UI default
5. Remove old inline UI code

---

## Related Documents

- [Roadmap: Visual Tree Charts](../../wiki-content/Roadmap.md#visual-tree-charts) - Roadmap entry for this feature
- [Statistics and Reports Wiki](../../wiki-content/Statistics-And-Reports.md) - Where Visual Tree reports will appear
- [Canvas Trees Wiki](../../wiki-content/Canvas-Trees.md) - Current Canvas Trees documentation
- [Control Center Wiki](../../wiki-content/Control-Center.md) - Control Center documentation
- [pdfmake Documentation](https://pdfmake.github.io/docs/) - PDF generation library
