# Design Decisions

This document records architectural decisions (ADRs) for Canvas Roots.

## Table of Contents

- [PDF Library and Font Strategy](#pdf-library-and-font-strategy-2025-12-19)
- [Smart Hybrid Collections Architecture](#smart-hybrid-collections-architecture-2025-11-22)
- [Interactive Tree Preview](#interactive-tree-preview-2025-11-24)
- [Switch to family-chart Library](#switch-to-family-chart-library-2025-11-20)
- [Layout Engine Extraction](#layout-engine-extraction-2025-11-20)
- [Canvas-Only Mode Removal](#canvas-only-mode-removal-2025-11-20)

---

## PDF Library and Font Strategy (2025-12-19)

**Decision:** Use pdfmake with dynamic loading and standard PDF fonts (Helvetica, Times, Courier) for report PDF export. Keep jsPDF for existing image-based chart exports.

**Context:**
- Users requested PDF export for genealogical reports (Ahnentafel, Register Report, Family Group Sheets, etc.)
- Existing jsPDF usage is for image-based chart export (SVG → Canvas → PNG → PDF)
- Plugin footprint matters: users may sync plugins via Obsidian Sync (1-10 GB storage limits)

**Options Evaluated:**

1. **Option A: jsPDF + jspdf-autotable for everything** ❌
   - Imperative API, harder to maintain
   - Would require rewriting existing chart export code
   - Table support via plugin, not native

2. **Option B: pdfmake with embedded Roboto fonts** ❌
   - Full pdfmake bundle: ~3.7 MB (vfs_fonts.js alone is ~2.4 MB)
   - Significant impact on vault storage for Sync users
   - Roboto fonts are overkill for document-style reports

3. **Option C: pdfmake with standard PDF fonts + dynamic loading** ✅ **SELECTED**
   - pdfmake core without vfs_fonts.js: ~400-500 KB
   - Standard PDF fonts (Helvetica, Times, Courier) require zero embedding
   - Dynamic import: 0 KB initial bundle impact, loads on first PDF export
   - ~85% size reduction compared to full pdfmake bundle

4. **Option D: Replace jsPDF entirely with pdfmake** ❌
   - pdfmake supports SVG natively, could work for charts
   - However, the SVG → Canvas → PNG approach works well for visual charts
   - Mixing approaches for different use cases is acceptable
   - No benefit to rewriting working code

**Implementation:**

**Dynamic Loading Pattern:**
```typescript
export class PdfReportRenderer {
  private pdfMake: any = null;

  private async ensurePdfMake(): Promise<void> {
    if (this.pdfMake) return;

    new Notice('Preparing PDF export...');

    // Dynamic import - not in initial bundle
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    this.pdfMake = pdfMakeModule.default || pdfMakeModule;

    // Standard PDF fonts - NO vfs_fonts.js needed
    this.pdfMake.fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      },
      Times: {
        normal: 'Times-Roman',
        bold: 'Times-Bold',
        italics: 'Times-Italic',
        bolditalics: 'Times-BoldItalic'
      },
      Courier: {
        normal: 'Courier',
        bold: 'Courier-Bold',
        italics: 'Courier-Oblique',
        bolditalics: 'Courier-BoldOblique'
      }
    };
  }
}
```

**Why Standard PDF Fonts:**

| Benefit | Explanation |
|---------|-------------|
| Zero embedding size | Built into every PDF reader since PDF 1.0 |
| Professional appearance | Helvetica and Times are industry standards |
| Sufficient coverage | Full Latin character set for English/European genealogy |
| Fast rendering | No font parsing overhead |

**Trade-offs Accepted:**

| Trade-off | Mitigation |
|-----------|------------|
| No non-Latin scripts (CJK, Arabic, Hebrew) | Phase 3: Optional font pack download |
| First PDF export has ~1-3s delay | Show "Preparing PDF export..." notice |
| Two PDF libraries in codebase | Clear separation: jsPDF for images, pdfmake for documents |

**Bundle Size Impact:**

| Component | Size | Notes |
|-----------|------|-------|
| jsPDF (existing) | ~229 KB | Kept for chart export |
| pdfmake core | ~400-500 KB | Dynamic import, not in initial bundle |
| vfs_fonts.js | 0 KB | **Excluded** - use standard fonts |
| **Initial bundle change** | 0 KB | pdfmake loads on demand |
| **Runtime (first export)** | ~400-500 KB | Cached for session |

**Impact:**
- Zero impact on initial plugin load time
- Zero impact on vault storage for users who don't export PDFs
- ~400-500 KB one-time load for users who do export PDFs
- Professional-looking reports with Helvetica/Times typography
- Path forward for non-Latin support without bloating default bundle

**Related:** See [PDF Report Export Planning Document](../planning/pdf-report-export.md) for full implementation plan.

---

## Smart Hybrid Collections Architecture (2025-11-22)

**Decision:** Implemented dual collection system with detected components (computed) and user collections (stored), rejecting folder-based and tag-based alternatives.

**Rationale:**
- **User diversity:** Many Obsidian users do not use folders or tags and do not wish to
- **Zero configuration:** Plugin must work perfectly for flat vaults with no organization
- **Self-healing data:** Computed component membership prevents stale data
- **Power user flexibility:** Optional user collections provide custom organization
- **World-building support:** Same architecture serves both genealogy and fiction writing use cases

**Architecture:** See [docs/architecture/collections.md](../architecture/collections.md) for complete ADR

**Options Evaluated:**

1. **Option A: Folder-Based Collections** ❌
   - Auto-discover collections from folder structure
   - **Rejected:** Excludes users with flat vaults
   - **Rejected:** Requires reorganizing files to change collections

2. **Option B: Tag-Based Collections** ❌
   - Use tags to assign collection membership
   - **Rejected:** Excludes users who don't use tags
   - **Rejected:** Tags already serve other purposes in genealogy vaults

3. **Option C: Smart Hybrid** ✅ **SELECTED**
   - Detected components computed from relationship graph (BFS traversal)
   - Optional user collections stored in `collection` YAML property
   - Both systems coexist independently

**Implementation:**

**Detected Family Components:**
```typescript
// Computed on every access, never stored
interface FamilyComponent {
  index: number;              // 0, 1, 2... (sorted by size)
  displayName: string;        // From group_name or "Family 1"
  size: number;
  people: PersonNode[];
  representative: PersonNode;
}
```

**User Collections:**
```yaml
# Optional property in person note frontmatter
collection: "Paternal Line"  # or "House Stark", etc.
```

**Key Technical Decisions:**

1. **Component membership = COMPUTED (not stored)**
   - Prevents stale data when relationships change
   - Self-healing (always reflects current relationship graph)
   - Users control membership by editing relationships, not stored IDs

2. **Component naming = STORED (optional)**
   - `group_name` property in person notes
   - Naming conflict resolution: most common name wins
   - Falls back to "Family 1", "Family 2" if no custom names

3. **User collections = STORED (optional)**
   - `collection` property in person notes
   - Independent from detected components
   - Obsidian Bases compatible (editable text field)

4. **Cross-collection connections = COMPUTED**
   - Detected by scanning relationships
   - Self-healing (updates when relationships change)
   - Enables world-building use cases (political alliances between houses)

**Impact:**
- Works for 100% of users (no folder/tag requirements)
- Zero configuration needed (detected components work immediately)
- Power users get optional custom organization
- Supports both genealogy and world-building use cases
- Obsidian Bases compatible for bulk collection assignment
- Self-healing architecture prevents data staleness

---

## Interactive Tree Preview (2025-11-24)

**Decision:** Implemented SVG-based interactive preview in the Control Center's Tree Output tab, enabling users to visualize and verify family tree layouts before canvas generation.

**Rationale:**
- **Layout verification:** Large trees (50+ people) require visual inspection before committing to canvas generation
- **Early feedback:** Users can catch layout issues, missing relationships, or configuration problems before creating the canvas
- **Color scheme testing:** Preview color schemes (Gender, Generation, Monochrome) before applying to canvas
- **Export flexibility:** Generate standalone PNG/SVG exports without creating canvas files
- **Streamlined workflow:** Integrated into existing Tree Output tab, no modal switching required

**Implementation:**
- Created [src/ui/tree-preview.ts](../../src/ui/tree-preview.ts) - 502 lines, complete SVG preview renderer
- Uses same layout engines as canvas generation (FamilyChartLayoutEngine, TimelineLayoutEngine, HourglassLayoutEngine)
- SVG-based rendering with native pan/zoom interactions
- Responsive design: Preview scales to 40% of canvas node size for better overview
- Integrated into [src/ui/control-center.ts](../../src/ui/control-center.ts) Tree Output tab

**Features:**
- **Interactive controls:**
  - Mouse wheel zoom (0.1x to 5x range)
  - Click-and-drag panning
  - Zoom in/out buttons
  - Zoom-to-fit button
  - Label visibility toggle
- **Color schemes:**
  - Gender: Green (male), Purple (female), Gray (unknown)
  - Generation: Multi-color layers cycling through 6 colors
  - Monochrome: Neutral gray for all nodes
- **Hover tooltips:**
  - Person name, birth/death dates, generation number
  - Fixed positioning with 15px offset from cursor
  - Styled with theme-aware CSS custom properties
- **Export functionality:**
  - PNG export: 2x resolution rasterization using Canvas API
  - SVG export: Inline computed styles for portability
  - Download triggers with blob URLs

**Technical Details:**
- **Pan/Zoom:** SVG `transform` attribute with translate/scale
- **Color application:** Dynamic fill/stroke attributes on rect elements
- **Tooltip system:** Fixed-position div with mouseenter/mouseleave events
- **PNG export:** SVG → Image → Canvas → PNG blob pipeline
- **SVG export:** Recursive style inlining for external compatibility
- **Layout reuse:** Calls same `calculateLayout()` as canvas generation
- **Memory management:** `dispose()` method cleans up tooltip element

**Impact:**
- Reduces trial-and-error in canvas generation workflow
- Enables quick layout algorithm comparison without creating multiple canvases
- Provides standalone export option for users who don't need full canvas files
- Improves UX for large family trees by making layout verification instant and visual

---

## Switch to family-chart Library (2025-11-20)

**Decision:** Replaced the custom D3.js hierarchy layout engine with the family-chart library for calculating family tree positions.

**Rationale:**
- Complex spouse relationships: D3's hierarchy layout doesn't natively support multiple spouses or marriage connections, which are fundamental to genealogy
- Overlapping nodes: The original implementation couldn't handle extended families where siblings-in-law and multiple generations created visual conflicts
- Specialized algorithm: family-chart is purpose-built for genealogical visualization with algorithms designed for family relationships
- Spouse positioning: family-chart automatically places spouses side-by-side at the same generation level
- Maintained separation: Layout calculation remains separate from canvas generation, preserving the clean architecture

**Implementation:**
- Created [src/core/family-chart-layout.ts](../../src/core/family-chart-layout.ts) as new layout engine
- Integrated family-chart's `f3.calculateTree()` for position calculation
- Added custom logic to handle "siblings-in-law" (people connected only through marriage) that family-chart excludes
- Implemented smart ancestor selection algorithm to choose optimal tree root for best visual layout
- Updated default spacing settings (400px horizontal, 250px vertical) with 1.5x multiplier for family-chart's algorithm
- Maintained LayoutEngine interface compatibility for future flexibility

**Challenges Solved:**
- Overlapping nodes at generation boundaries (e.g., grandparents hiding behind parents)
- Missing people in output when they're not in direct bloodline (siblings-in-law)
- Inconsistent tree orientation (wrong person at top/y=0)
- Spacing optimization for Canvas name labels

**Technical Details:**
- Uses family-chart's `ancestry_depth: undefined` and `progeny_depth: undefined` to show full family
- Implements manual positioning strategy for missing people (place next to spouse or above children)
- Applies 1.5x spacing multiplier to account for Canvas labels and visual clarity
- Maintains post-processing step to enforce minimum spacing and prevent overlaps

**Impact:**
- Zero overlapping nodes in complex family trees
- Proper handling of multiple spouses, adoptive parents, and extended family
- More accurate genealogical representation
- Better visual clarity with appropriate spacing
- Original layout-engine.ts retained for potential future use or comparison

---

## Layout Engine Extraction (2025-11-20)

**Decision:** Extracted D3.js layout calculation logic from canvas-generator.ts into a dedicated LayoutEngine class.

**Rationale:**
- Separation of concerns: layout calculation vs. canvas JSON generation are distinct responsibilities
- Reusability: LayoutEngine can be used independently for the re-layout command
- Testability: Layout logic can be tested without canvas generation dependencies
- Clarity: Each module has a single, well-defined purpose

**Implementation:**
- Created [src/core/layout-engine.ts](../../src/core/layout-engine.ts) with LayoutEngine class
- Defined LayoutOptions interface for configuration (spacing, direction, tree type)
- Created CanvasGenerationOptions extending LayoutOptions with canvas-specific options (colorByGender, showLabels)
- Refactored CanvasGenerator to use LayoutEngine as a service
- Removed 98 lines of embedded layout logic from canvas-generator.ts

**Impact:**
- Cleaner architecture with better module boundaries
- Layout engine ready for re-layout command implementation
- Easier to maintain and extend layout algorithms
- Canvas generator now focuses purely on JSON format conversion

---

## Canvas-Only Mode Removal (2025-11-20)

**Decision:** Removed the canvas-only import mode entirely. GEDCOM imports now always create person notes in the vault.

**Rationale:**
- Canvas-only mode provided limited value - users couldn't leverage Obsidian features (backlinks, graph view, manual editing)
- Data was locked in Canvas JSON format, not user-friendly for editing or external tools
- Two code paths created maintenance burden and complexity
- Users who started with canvas-only would need migration tooling later
- Person notes enable richer workflows: adding photos, stories, documents, linking to daily notes

**Impact:**
- Simplified codebase (removed 67 lines)
- Clearer value proposition: plugin manages family relationships using person notes
- Better user experience with full Obsidian integration from the start
- Removed confusing setting from UI
