# Visual Tree PDF Enhancements

**Status:** Planned
**Priority:** Low
**Extracted from:** `archive/tree-visualization-overhaul.md` (Phase 3: Library Consolidation)
**Created:** 2025-12-23

---

## Overview

Improve the pdfmake-based Visual Tree PDF output quality to match the Family Chart's jsPDF output. The goal is to achieve crisp, sharp rendering comparable to what jsPDF produces, without migrating Family Chart away from jsPDF.

---

## Problem Statement

The Tree Wizard generates Visual Tree PDFs using pdfmake, while the Family Chart view uses jsPDF. The jsPDF output is noticeably higher quality:

| Aspect | jsPDF (Family Chart) | pdfmake (Tree Wizard) |
|--------|---------------------|----------------------|
| **Quality** | Crisp, sharp rendering | Slightly softer/blurry |
| **Page sizing** | Dynamic (matches content exactly) | Fixed standard sizes |
| **Image handling** | Direct 1:1 placement | Rescales to fit available layout space |

### Visual Quality Differences

The Family Chart PDF export produces better output because of:
- Proper spouse positioning side-by-side
- Clean orthogonal connector lines with proper routing
- Card-style nodes with profile silhouette icons
- Corner badges/indicators
- Better overall visual hierarchy
- Noticeably sharper text and lines

---

## Technical Analysis

### Root Cause

Investigation revealed the quality difference stems from how images are embedded in the PDF.

**jsPDF pipeline (family-chart-view.ts):**
1. SVG rendered at native dimensions (e.g., 800×600)
2. Canvas created at 2× scale (1600×1200) for higher DPI
3. PDF page sized to match content: `format: [width, height]`
4. Image added at 1:1 logical dimensions: `pdf.addImage(imgData, 'PNG', 0, 0, width, height)`
5. **No resampling occurs** — pixel-perfect output

**pdfmake pipeline (pdf-report-renderer.ts → visual-tree-svg-renderer.ts):**
1. SVG rendered at layout dimensions (e.g., 800×600)
2. Canvas created at 2× scale (1600×1200) via `svgToDataUrl()`
3. PDF page uses fixed size from `layout.page.width/height`
4. Image added with explicit width AND height that may differ from source:
   ```typescript
   const imageWidth = layout.page.width - layout.margins.left - layout.margins.right;
   const imageHeight = layout.page.height - layout.margins.top - layout.margins.bottom - 80;
   content.push({ image: imageDataUrl, width: imageWidth, height: imageHeight });
   ```
5. **Resampling occurs** when pdfmake fits the 2× canvas image into the specified dimensions

**Key insight:** Specifying both `width` and `height` in pdfmake's image content causes resampling if they don't match the source aspect ratio or logical size. The jsPDF approach avoids this by sizing the page to content rather than fitting content to page.

### Source Files

- jsPDF export: `src/ui/views/family-chart-view.ts` lines 2490-2584
- pdfmake export: `src/reports/services/pdf-report-renderer.ts` lines 1833-1902
- SVG to PNG conversion: `src/trees/services/visual-tree-svg-renderer.ts` lines 99-136

---

## Proposed Solutions

### Option 1: Only Specify Width (Quick Fix)

Let pdfmake maintain aspect ratio by only specifying `width`:

```typescript
// Before (causes resampling)
content.push({
  image: imageDataUrl,
  width: imageWidth,
  height: imageHeight  // Remove this
});

// After (maintains aspect ratio)
content.push({
  image: imageDataUrl,
  width: imageWidth
});
```

**Pros:** Simple change, minimal risk
**Cons:** May not use full available height, doesn't address page sizing

### Option 2: Match Page Size to Content

Size the PDF page to match the tree content dimensions, like jsPDF does:

```typescript
// Calculate page size from content
const docDefinition: TDocumentDefinitions = {
  pageSize: {
    width: treeWidth + margins.left + margins.right,
    height: treeHeight + margins.top + margins.bottom + titleHeight
  },
  // ...
};
```

**Pros:** Eliminates resampling entirely, matches jsPDF quality
**Cons:** Non-standard page sizes may print poorly, requires layout refactor

### Option 3: Higher Scale Factor

Increase the canvas scale from 2× to 3× or 4× to compensate for resampling:

```typescript
// In visual-tree-svg-renderer.ts
async svgToDataUrl(svgString: string, width: number, height: number): Promise<string> {
  const scale = 4; // Was 2
  canvas.width = width * scale;
  canvas.height = height * scale;
  // ...
}
```

**Pros:** Simple change, works with existing layout
**Cons:** Larger file sizes, more memory usage, doesn't fix root cause

### Option 4: Embed SVG Directly

pdfmake supports SVG embedding. Skip the PNG conversion entirely:

```typescript
content.push({
  svg: svgString,
  width: imageWidth
});
```

**Pros:** Vector output, infinitely scalable, smaller file size
**Cons:** pdfmake SVG support may have limitations, fonts/styles may render differently

### Option 5: Calculate Exact Logical Dimensions

Calculate the exact dimensions that match the source image's logical size:

```typescript
// Get actual image dimensions from the data URL
const img = new Image();
img.src = imageDataUrl;
await img.decode();

// Use logical dimensions (canvas size / scale factor)
const logicalWidth = img.naturalWidth / 2;  // scale was 2×
const logicalHeight = img.naturalHeight / 2;

content.push({
  image: imageDataUrl,
  width: logicalWidth,
  height: logicalHeight
});
```

**Pros:** Precise 1:1 mapping, no resampling
**Cons:** May overflow page, requires page size coordination

---

## Recommended Approach

Implement in phases, starting with lowest risk:

### Phase 1: Quick Wins
1. Try Option 1 (only specify width) — test if quality improves
2. If not sufficient, try Option 3 (higher scale factor)

### Phase 2: Proper Fix
1. Implement Option 2 (dynamic page sizing) for a "Fit to Content" page size option
2. Keep standard page sizes (A4, Letter) as options with the current behavior
3. Let users choose based on their needs (printing vs. digital viewing)

### Phase 3: Advanced
1. Investigate Option 4 (SVG embedding) for best possible quality
2. Test with complex trees to ensure compatibility

---

## Implementation Plan

### Phase 1: Quick Quality Improvements

1. Modify `renderVisualTree()` in `pdf-report-renderer.ts`:
   - Remove explicit `height` from image content
   - Test output quality

2. If insufficient, increase scale factor in `visual-tree-svg-renderer.ts`:
   - Change scale from 2 to 3 or 4
   - Measure file size impact

### Phase 2: Dynamic Page Sizing

1. Add "Fit to Content" option to page size selector in unified wizard
2. Calculate page dimensions from tree bounds + margins
3. Use dynamic page size when selected
4. Keep standard sizes (A4, Letter, etc.) for print-oriented users

### Phase 3: SVG Embedding (Optional)

1. Research pdfmake SVG limitations
2. Test with complex trees containing:
   - Custom fonts
   - Embedded images (avatars)
   - Gradients/shadows
3. Implement if viable

---

## Success Criteria

- [ ] Visual Tree PDF text is as sharp as Family Chart PDF
- [ ] Lines and borders render crisply without blur
- [ ] Quality improvement doesn't significantly increase file size (< 2× increase acceptable)
- [ ] Standard page sizes still work for users who need printable output
- [ ] "Fit to Content" option available for best quality digital viewing

---

## Context

**Decision (2025-12-22):** Keep jsPDF for Family Chart and defer library consolidation until the pdfmake visual trees can match the Family Chart quality. The pdfmake trees remain useful for quick PDF generation from the unified wizard, while the Family Chart view provides high-quality printable output.

**Future path:** Rather than migrating Family Chart to pdfmake, improve the pdfmake visual tree rendering to match Family Chart quality.

---

## See Also

- [Tree Visualization Overhaul](archive/tree-visualization-overhaul.md) — Original context
- [Family Chart Export Modal](family-chart-export-modal.md) — Related export improvements (jsPDF-based)
