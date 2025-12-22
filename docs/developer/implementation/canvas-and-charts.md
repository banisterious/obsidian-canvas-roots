# Canvas and Charts

This document covers canvas generation, PDF tree generation, and family chart layout systems.

## Table of Contents

- [Canvas Generation Implementation](#canvas-generation-implementation)
  - [Canvas Node ID Format](#canvas-node-id-format)
  - [Canvas JSON Format](#canvas-json-format)
  - [Known Issues & Solutions](#known-issues--solutions)
- [Family Chart Layout System](#family-chart-layout-system)
  - [Architecture Overview](#architecture-overview)
  - [Layout Engines](#layout-engines)
  - [Layout Selection](#layout-selection)
  - [Tree Generation Flow](#tree-generation-flow)
  - [Key Data Structures](#key-data-structures)
  - [Interactive Preview](#interactive-preview)
  - [Canvas Metadata](#canvas-metadata)
- [Visual Tree PDF Generation](#visual-tree-pdf-generation)
  - [Architecture](#pdf-architecture)
  - [Visual Tree Service](#visual-tree-service)
  - [PDF Rendering](#pdf-rendering)
  - [Custom Icons](#custom-icons)
- [Unified Tree Wizard](#unified-tree-wizard)

---

## Canvas Generation Implementation

### Canvas Node ID Format

Canvas nodes require alphanumeric IDs without special characters (dashes, underscores, etc.). The plugin generates these using `Math.random().toString(36)`:

```typescript
// Good: alphanumeric only
"6qi8mqi3quaufgk0imt33f"

// Bad: contains dashes (not movable in Obsidian)
"qjk-453-lms-042"
```

**Implementation:** The canvas generator maintains a mapping from `cr_id` (person identifier) to `canvasId` (canvas node identifier) to ensure edges connect correctly while using Obsidian-compatible IDs.

### Canvas JSON Format

Obsidian Canvas requires a specific JSON format:

1. **Tab indentation** (`\t`) for structure
2. **Compact objects** - each node/edge on a single line with no spaces after colons/commas
3. **Required metadata** - version and frontmatter fields

Example:
```json
{
	"nodes":[
		{"id":"abc123","type":"file","file":"Person.md","x":0,"y":0,"width":250,"height":120}
	],
	"edges":[],
	"metadata":{
		"version":"1.0-1.0",
		"frontmatter":{}
	}
}
```

**Implementation:** Custom `formatCanvasJson()` method in `control-center.ts` ensures exact format match.

### Known Issues & Solutions

#### Issue: Canvas nodes not movable/resizable
**Cause:** Canvas node IDs contained dashes (e.g., `qjk-453-lms-042`)
**Solution:** Generate alphanumeric-only IDs matching Obsidian's format
**Fixed in:** `canvas-generator.ts` - `generateNodeId()` method

#### Issue: Canvas cleared on close/reopen
**Cause:** JSON formatting didn't match Obsidian's exact requirements
**Solution:** Implement custom JSON formatter with tabs and compact objects
**Fixed in:** `control-center.ts` - `formatCanvasJson()` method

#### Issue: Race condition when opening canvas
**Cause:** Canvas opened before file system write completed
**Solution:** Add 100ms delay before opening canvas file
**Fixed in:** `control-center.ts` and `main.ts` - canvas opening logic

#### Issue: GEDCOM import only shows root person in tree
**Cause:** GEDCOM importer's second pass replaced IDs in wrong fields (father/mother/spouse instead of father_id/mother_id/spouse_id)
**Solution:** Update regex patterns to target correct _id fields with dual storage
**Fixed in:** `gedcom-importer.ts` - Phase 2 ID replacement logic

---

## Family Chart Layout System

The family chart generation system transforms person notes into interactive family tree visualizations through multiple layout engines.

### Architecture Overview

```
Person Notes (YAML frontmatter)
         ↓
FamilyGraphService (build graph from notes)
         ↓
FamilyTree (graph structure: nodes + edges)
         ↓
Layout Engine Selection (based on layoutType)
         ↓
LayoutResult (positioned nodes)
         ↓
TreePreviewRenderer (SVG) OR CanvasGenerator (Canvas JSON)
```

### Layout Engines

Canvas Roots implements four distinct layout algorithms:

#### Family-Chart Layout (`src/core/family-chart-layout.ts`)

The default layout for standard and compact trees. Uses the external `family-chart` library's D3-based algorithm.

**Key features:**
- Handles spouse relationships correctly (unlike standard D3 hierarchical trees)
- Positions root person as topmost ancestor using intelligent ancestor scoring
- Handles missing people (siblings-in-law, etc.) not positioned by family-chart

**Ancestor selection logic** (`findTopAncestor()`):
- Scores ancestors by descendant count
- Huge bonus (10,000 points) if root person is a descendant
- Connection bonuses for different family lines

**Missing spouse handling:**
1. Check if spouse is positioned in layout
2. If not, position next to their partner at same Y level
3. Use 1.5x spacing multiplier for consistent placement

**Spacing configuration:**
```typescript
const DEFAULT_LAYOUT = {
    nodeSpacingX: 1200,  // Large due to Canvas name labels above nodes
    nodeSpacingY: 250,
    nodeWidth: 250,
    nodeHeight: 120
};
```

#### Timeline Layout (`src/core/timeline-layout.ts`)

Creates chronological timelines showing family members by birth year.

- X-axis: Birth year (horizontal timeline)
- Y-axis: Generation level (for collision avoidance)
- Scales years: `pixelsPerYear = spacing / 10` (10 years = one spacing unit)
- Estimates positions for people without birth dates based on parents/children
- Falls back to generation-based layout if no dates available

#### Hourglass Layout (`src/core/hourglass-layout.ts`)

Focuses on a single person with ancestors above and descendants below.

- Root person at center (Y = 0)
- Ancestors above (negative Y coordinates)
- Descendants below (positive Y coordinates)
- Each generation centered horizontally

**Centering formula:**
```typescript
totalWidth = (numPeople - 1) * horizontalSpacing;
startX = -totalWidth / 2;
x = startX + (index * spacing);
```

#### Standard D3 Layout (`src/core/layout-engine.ts`)

Fallback hierarchical layout for large trees (>200 people).

- Uses D3-hierarchy's `tree()` function
- Simpler algorithm, faster for very large trees
- Separation ratio: 1x for same parents, 1.5x for different parents

### Layout Selection

```typescript
// In CanvasGenerator.generateCanvas()
const layoutType = options.layoutType ?? 'standard';
const isLargeTree = familyTree.nodes.size > 200;

if (layoutType === 'timeline') {
    → TimelineLayoutEngine
} else if (layoutType === 'hourglass') {
    → HourglassLayoutEngine
} else if (useFamilyChartLayout && !isLargeTree) {
    → FamilyChartLayoutEngine (standard/compact)
} else {
    → D3 LayoutEngine (large trees or fallback)
}
```

**Compact layout** is not a separate engine but a 50% spacing multiplier applied to the standard layout:
```typescript
if (layoutType === 'compact') {
    layoutOptions.nodeSpacingX *= 0.5;
    layoutOptions.nodeSpacingY *= 0.5;
}
```

### Tree Generation Flow

1. **User selects root person** → PersonPickerModal returns cr_id
2. **FamilyGraphService builds tree** from person notes:
   ```typescript
   const familyTree = familyGraphService.generateTree({
       rootCrId: selectedPersonId,
       treeType: 'descendants',  // or 'ancestors', 'full'
       maxGenerations: 5,
       includeSpouses: true
   });
   ```
3. **Layout engine calculates positions** → Returns `LayoutResult`
4. **Output generation:**
   - **Interactive preview** (`TreePreviewRenderer`): SVG with pan/zoom, tooltips, color schemes
   - **Canvas export** (`CanvasGenerator`): Obsidian Canvas JSON with metadata for smart re-layout

### Key Data Structures

```typescript
interface FamilyTree {
    root: PersonNode;
    nodes: Map<string, PersonNode>;  // crId → PersonNode
    edges: FamilyEdge[];
}

interface LayoutResult {
    positions: NodePosition[];
    options: Required<LayoutOptions>;
}

interface NodePosition {
    crId: string;
    person: PersonNode;
    x: number;
    y: number;
    generation?: number;
}
```

### Interactive Preview

`TreePreviewRenderer` (`src/ui/tree-preview.ts`) provides:
- **Zoom**: Mouse wheel (0.1x to 5x scale)
- **Pan**: Click + drag
- **Hover**: Tooltips with name, dates, generation
- **Color schemes**: sex (M=green, F=purple), generation (rainbow), monochrome
- **Export**: PNG, SVG, PDF
- **Node scaling**: Preview nodes are 40% of actual size for better overview

### Canvas Metadata

Generated canvases embed metadata for smart re-layout:
```typescript
interface CanvasRootsMetadata {
    plugin: 'canvas-roots',
    generation: {
        rootCrId, rootPersonName, treeType,
        maxGenerations, includeSpouses, direction, timestamp
    },
    layout: {
        nodeWidth, nodeHeight, nodeSpacingX, nodeSpacingY, layoutType
    }
}
```

---

## Visual Tree PDF Generation

Visual Tree PDFs provide printable tree diagrams generated via pdfmake. This system was added in Phase 2 of the Tree Visualization Overhaul.

### PDF Architecture

```
Person Notes (YAML frontmatter)
         ↓
VisualTreeService (build tree + calculate layout)
         ↓
VisualTreeData (nodes with positions, edges)
         ↓
PdfReportRenderer.generateVisualTreePdf()
         ↓
pdfmake Content (boxes, lines, text)
         ↓
PDF Blob → Download
```

### Visual Tree Service

`src/trees/services/visual-tree-service.ts` handles tree building and layout:

**Tree Types:**
- `pedigree` - Ancestors only, binary branching upward
- `descendant` - Descendants only, branching downward
- `hourglass` - Both ancestors (up) and descendants (down)
- `fan` - Semicircular radial layout (placeholder)

**Key Methods:**
```typescript
// Build tree data from person notes
buildTree(rootCrId: string, options: VisualTreeOptions): VisualTreeData

// Calculate node positions for layout
calculateLayout(tree: VisualTreeData, chartType: VisualTreeChartType): void

// Analyze tree size for large tree handling
analyzeTreeSize(rootCrId: string, options): TreeSizeAnalysis
```

**Large Tree Analysis:**
```typescript
interface TreeSizeAnalysis {
    isLarge: boolean;
    nodeCount: number;
    generationCount: number;
    estimatedWidth: number;
    estimatedHeight: number;
    recommendedPageSize?: VisualTreePageSize;
    warnings: string[];
}
```

### PDF Rendering

`src/reports/services/pdf-report-renderer.ts` extended with:

```typescript
async generateVisualTreePdf(options: VisualTreeOptions): Promise<Blob>
```

**PDF Content Structure:**
1. Title section (optional)
2. Tree content:
   - Node boxes with borders and backgrounds
   - Connecting lines between parent/child relationships
   - Text labels (name, dates, places based on nodeContent setting)

**Color Schemes:**
- `default` - Gender-based colors (blue/green for male, purple/pink for female)
- `grayscale` - Black/white for printing
- `generational` - Different colors per generation level

**Page Sizes:**
```typescript
type VisualTreePageSize = 'letter' | 'a4' | 'legal' | 'tabloid' | 'a3';
```

**Large Tree Handling:**
```typescript
type LargeTreeHandling = 'auto-scale' | 'auto-page-size' | 'limit-generations';
```

### Custom Icons

`src/ui/lucide-icons.ts` registers custom tree icons via Obsidian's `addIcon()` API:

**Icon Requirements (per Obsidian docs):**
- SVG content WITHOUT `<svg>` wrapper (Obsidian adds its own)
- Must fit within `0 0 100 100` viewBox
- Stroke width scaled from Lucide's 2px (24px canvas) to 8px (100px canvas)

**Registered Icons:**
| Icon Name | Description |
|-----------|-------------|
| `cr-pedigree-tree` | Root at bottom, ancestors branching up |
| `cr-descendant-tree` | Root at top, descendants branching down |
| `cr-hourglass-tree` | Root in center, both directions |
| `cr-fan-chart` | Semicircular arcs |

**Icon Registration:**
```typescript
export function registerCustomIcons(): void {
    for (const [name, svg] of Object.entries(CUSTOM_ICONS)) {
        addIcon(name, svg);
    }
}
```

Called during plugin initialization in `main.ts`.

---

## Unified Tree Wizard

`src/trees/ui/unified-tree-wizard-modal.ts` provides a single wizard for both Canvas and PDF output.

### Step Flow

```
Step 1: Person Selection
    ↓
Step 2: Tree Type Selection
    ↓
Step 3: Output Format (Canvas vs PDF)
    ├── Canvas → Step 4a: Canvas Options → Step 5a: Preview → Step 6a: Output
    └── PDF → Step 4b: PDF Options → Step 5b: Output
```

### Form Data

```typescript
interface UnifiedWizardFormData {
    // Step 1: Person
    rootPerson: PersonInfo | null;

    // Step 2: Tree Type
    treeType: 'full' | 'ancestors' | 'descendants' | 'fan';
    maxAncestorGenerations: number;
    maxDescendantGenerations: number;
    includeSpouses: boolean;

    // Step 3: Output Format
    outputFormat: 'canvas' | 'pdf';

    // Canvas-specific options
    layoutAlgorithm: 'standard' | 'compact' | 'timeline' | 'hourglass';
    colorScheme: ColorScheme;
    // ... edge styles, filters, etc.

    // PDF-specific options
    pageSize: VisualTreePageSize;
    orientation: 'portrait' | 'landscape';
    nodeContent: VisualTreeNodeContent;
    pdfColorScheme: VisualTreeColorScheme;
    largeTreeHandling: LargeTreeHandling;
}
```

### Initialization Options

The wizard can be opened with pre-selections:

```typescript
const wizard = new UnifiedTreeWizardModal(this.plugin, {
    // Pre-select a person
    rootPerson: { crId: 'abc-123', name: 'John Smith' },

    // Pre-select output format
    outputFormat: 'pdf',

    // Pre-select tree type for PDF reports
    treeType: 'ancestors'
});
wizard.open();
```

### Integration Points

The unified wizard is opened from:
1. **Control Center** - Canvas Trees tab "New Tree" button
2. **Statistics View** - Visual Trees report tiles
3. **Report Generator Modal** - Visual tree report types
