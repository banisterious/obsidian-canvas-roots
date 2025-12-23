# Family Chart Export Modal

**Status:** Complete
**Priority:** Medium
**Completed:** 2025-12-23
**Extracted from:** `universal-media-linking.md` (Phase 3 notes)

---

## Overview

Replace the current export dropdown menu in the Family Chart View toolbar with a dedicated Export Modal/Wizard that provides better discoverability, prevents accidental large exports, and gives users control over quality vs size tradeoffs.

---

## Current State

The Family Chart View has an export dropdown menu with these options:
- Export as PNG
- Export as PNG (no avatars)
- Export as SVG
- Export as SVG (no avatars)
- Export as PDF
- Export as PDF (no avatars)

**Problems with current approach:**
- Options are hidden in a dropdown, not discoverable
- No preview of what will be exported
- No indication of file size or export duration
- Large trees with avatars can cause memory exhaustion
- No progress feedback during export
- Users must manually choose "no avatars" variant to avoid crashes

---

## Proposed Solution

### Two-Step Wizard Design

The export wizard uses a two-step flow to reduce cognitive load:

**Step 1: Quick Export** — Presets and basic choices (most users stop here)
**Step 2: Customize** — Format-specific options for power users

This design provides a fast path (click preset → Export) while still offering full control.

### Step 1: Quick Export

```
┌─────────────────────────────────────────────────────────────┐
│  Export Family Chart                                    [X] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PRESETS                                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Quick Share │ │ High Quality│ │ Print Ready │           │
│  │ PNG · 1x    │ │ PNG · 2x    │ │ PDF · Cover │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐                           │
│  │  Editable   │ │  Document   │                           │
│  │    SVG      │ │    ODT      │                           │
│  └─────────────┘ └─────────────┘                           │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  FORMAT                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  [PNG]  │  │  [SVG]  │  │  [PDF]  │  │  [ODT]  │        │
│  │  icon   │  │  icon   │  │  icon   │  │  icon   │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                             │
│  FILENAME                                                   │
│  ┌───────────────────────────────────────────┐ .png        │
│  │ John-Smith-family-chart-2025-12-23        │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ESTIMATE                                                   │
│  People: 127  │  Avatars: 89  │  Est. size: ~2.4 MB        │
│                                                             │
│  ⚠ Large export — may take 10-30 seconds                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Customize →]                      [Cancel]  [Export]      │
└─────────────────────────────────────────────────────────────┘
```

### Step 2: Customize (Optional)

```
┌─────────────────────────────────────────────────────────────┐
│  Export Family Chart                                    [X] │
├─────────────────────────────────────────────────────────────┤
│  ← Back to presets                                          │
│                                                             │
│  AVATARS                                                    │
│  ○ Include avatars (slower, larger)                        │
│  ● Exclude avatars (faster, smaller)                       │
│                                                             │
│  SCOPE                                                      │
│  ● Full tree (respects current depth settings)             │
│  ○ Limited depth: [3 ▼] generations                        │
│                                                             │
│  ───────────────────────────────────────────────────────── │
│                                                             │
│  PNG OPTIONS                                                │
│  Scale:  [1x]  [2x]  [3x]                                  │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ESTIMATE                                                   │
│  People: 127  │  Avatars: 89  │  Est. size: ~2.4 MB        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [← Back]                           [Cancel]  [Export]      │
└─────────────────────────────────────────────────────────────┘
```

**PDF Step 2 shows:**
- Page size (Fit/A4/Letter/Legal/Tabloid)
- Layout (Single/Tiled)
- Orientation (Auto/Portrait/Landscape) — shown when Tiled selected
- Cover page toggle with title/subtitle fields

**ODT Step 2 shows:**
- Cover page toggle with title/subtitle fields

### Features

#### Step 1 Features

##### 1. Presets (Quick Path)
Prominent preset cards at top for one-click export:

| Preset | Format | Avatars | Scale/Options | Use Case |
|--------|--------|---------|---------------|----------|
| **Quick Share** | PNG | Exclude | 1x | Fast sharing on social/chat |
| **High Quality** | PNG | Include | 2x | Best quality raster image |
| **Print Ready** | PDF | Include | Cover page, Fit | Physical printing/archival |
| **Editable** | SVG | Exclude | — | Further editing in design tools |
| **Document** | ODT | Include | Cover page | Merging with text reports |

Clicking a preset:
1. Populates all settings (format, avatars, scale, cover page, etc.)
2. User can immediately click Export, or modify settings first
3. Preset selection is visual feedback only — settings can be changed

##### 2. Format Selection
Visual icon cards for each format:
- **PNG** — Raster image, best for sharing/printing
- **SVG** — Vector, best for editing/scaling
- **PDF** — Document format, best for archival
- **ODT** — Editable document for merging workflows (Phase 6)

##### 3. Filename
- Editable text field pre-populated with generated filename
- Default pattern: `{name}-family-chart-{date}` (from existing settings)
- Root person name auto-detected from current chart
- Extension automatically appended based on format

##### 4. Size Estimation
Shown on Step 1 to inform decisions before export:
- Number of people in export scope
- Number of avatars to embed (hidden when avatars excluded in Step 2)
- Estimated file size

##### 5. Warning Logic
Show warning when ANY of:
- People count > 100 (large tree regardless of avatars)
- Avatar count > 50 AND avatars included
- Estimated file size > 5 MB

---

#### Step 2 Features (Customize)

Accessed via "Customize →" button. Back button returns to Step 1.

##### 6. Avatar Options
- **Include avatars** — Embeds person photos as base64 (slower, larger)
- **Exclude avatars** — Gender icons only (faster, smaller, always works)

When avatars excluded, hide avatar count from estimate panel for cleaner UI.

##### 7. Scope Options
- **Full tree** — Export entire loaded tree (respects current depth settings)
- **Limited depth** — Override current depth with modal-specified value (2-5 generations)

Note: "Visible tree" (viewport-based) removed to reduce complexity. Users control scope via depth limits.

##### 8. PNG-Specific Options
When PNG format is selected:
- **Scale** — 1x (standard), 2x (high DPI/retina, default), 3x (print quality)
  - Higher scale = sharper image, larger file size
  - Current implementation uses 2x internally

##### 9. SVG-Specific Options
SVG is inherently scalable, so no additional options needed beyond avatars toggle.

##### 10. PDF-Specific Options
When PDF format is selected, show additional options:

**Page Size:**
- Fit to content (default) — Dynamic sizing to match chart
- A4 (210 × 297 mm)
- Letter (8.5 × 11 in)
- Legal (8.5 × 14 in)
- Tabloid (11 × 17 in)

**Layout:**
- **Single page** — Fit entire chart on one page (default)
- **Tiled pages** — Split large charts across multiple standard pages

**Orientation** (for tiled pages):
- Auto (detect from chart dimensions)
- Portrait
- Landscape

**Cover Page (optional):**
- Include a title page before the chart
- Shows: Tree title, root person name, generation date, person count
- Title field (defaults to "{Root Person} Family Tree")
- Subtitle field (optional)

##### 11. ODT-Specific Options (Phase 6)
When ODT format is selected:
- **Cover page** toggle with title/subtitle fields
- Same title/subtitle defaults as PDF

---

#### Shared Features

##### 12. Progress Display
For exports > 2 seconds, show (replaces normal footer):
- Progress bar with percentage
- Current phase (rendering, embedding avatars, encoding)
- Cancel button

---

## Implementation Plan

### Phase 1: Two-Step Wizard Structure
1. Create `FamilyChartExportWizard` class extending `Modal`
2. Implement step navigation (Step 1 ↔ Step 2)
3. Create Step 1: Presets, format cards, filename, estimate panel
4. Create Step 2: Avatars, scope, format-specific options
5. Wire "Customize →" and "← Back" buttons
6. Replace dropdown with single "Export" button that opens wizard

### Phase 2: Core Export Integration
1. Implement format selection (PNG/SVG/PDF cards)
2. Implement avatar toggle (include/exclude)
3. Add scope options (full/limited)
4. Wire up to existing export methods
5. Implement tree size calculation and file size estimation
6. Display warnings for large exports

### Phase 3: PDF Enhancements
1. Keep jsPDF for Family Chart PDF export (better image quality — see Technical Notes)
2. Add PDF-specific options panel in Step 2 (shown when PDF selected)
3. Implement cover page generation using jsPDF text primitives
4. Implement multi-page tiling for large charts
5. Add page size selection (A4, Letter, Legal, Tabloid)
6. Add document metadata via `pdf.setDocumentProperties()`

### Phase 4: Progress & Polish
1. Add progress bar for long exports
2. Implement cancel functionality
3. Add export duration estimation
4. Polish UI/UX

### Phase 5: Presets
1. Implement 5 preset cards with visual feedback
2. Preset click populates all form fields
3. Remember last-used settings

### Phase 6: ODT Export
1. Add ODT format option alongside PNG/SVG/PDF
2. Implement ODT generation using JSZip + manual XML (no external library)
3. Embed chart as image in ODT document
4. Include optional cover page text content
5. Enable document merging workflow (combine with text reports)

---

## Technical Notes

### Existing Export Code Location
- `src/ui/views/family-chart-view.ts`
- Export methods: `exportAsPng()`, `exportAsSvg()`, `exportAsPdf()`
- Avatar embedding in `prepareExportData()`

### Size Estimation Algorithm
```typescript
function estimateExportSize(options: ExportOptions): number {
  const baseSizePerPerson = 500; // bytes for SVG node
  const avatarSize = 15000; // ~15KB per base64 avatar

  let size = options.personCount * baseSizePerPerson;
  if (options.includeAvatars) {
    size += options.avatarCount * avatarSize;
  }

  // Format multipliers
  if (options.format === 'png') size *= 1.5;
  if (options.format === 'pdf') size *= 1.2;

  return size;
}
```

### Wizard File Location
`src/ui/views/family-chart-export-wizard.ts`

### PDF Enhancement Implementation

**Why jsPDF instead of pdfmake for Family Chart:**

The Family Chart uses jsPDF rather than pdfmake (used for reports) due to image quality differences:

| Aspect | jsPDF (Family Chart) | pdfmake (Reports) |
|--------|---------------------|-------------------|
| **Quality** | Crisp, sharp rendering | Slightly softer/blurry |
| **Page size** | Dynamic (matches content) | Fixed standard sizes |
| **Image handling** | Direct 1:1 placement | Rescales to fit layout |

The quality difference stems from how images are embedded:
- **jsPDF**: Page sized to content → 2x canvas → add at 1:1 → no resampling
- **pdfmake**: Fixed page → 2x canvas → fit to available space → resampling occurs

For the Family Chart's detailed SVG with text labels, the jsPDF approach produces noticeably sharper output.

**Export Options Interface:**
```typescript
interface FamilyChartExportOptions {
  format: 'png' | 'svg' | 'pdf' | 'odt';
  filename: string;  // User-editable, without extension
  includeAvatars: boolean;
  scope: 'full' | 'limited';
  limitedDepth?: number;  // 2-5 generations

  // PNG-specific options
  pngOptions?: {
    scale: 1 | 2 | 3;  // 1x, 2x (default), 3x
  };

  // PDF-specific options
  pdfOptions?: {
    pageSize: 'fit' | 'A4' | 'LETTER' | 'LEGAL' | 'TABLOID';
    layout: 'single' | 'tiled';
    orientation: 'auto' | 'portrait' | 'landscape';  // For tiled only
    includeCoverPage: boolean;
    customTitle?: string;
    customSubtitle?: string;
  };

  // ODT-specific options (Phase 6)
  odtOptions?: {
    includeCoverPage: boolean;
    customTitle?: string;
    customSubtitle?: string;
  };
}

// Preset definitions
const EXPORT_PRESETS = {
  quickShare: {
    format: 'png',
    includeAvatars: false,
    scope: 'full',
    pngOptions: { scale: 1 }
  },
  highQuality: {
    format: 'png',
    includeAvatars: true,
    scope: 'full',
    pngOptions: { scale: 2 }
  },
  printReady: {
    format: 'pdf',
    includeAvatars: true,
    scope: 'full',
    pdfOptions: {
      pageSize: 'fit',
      layout: 'single',
      orientation: 'auto',
      includeCoverPage: true
    }
  },
  editable: {
    format: 'svg',
    includeAvatars: false,
    scope: 'full'
  },
  document: {
    format: 'odt',
    includeAvatars: true,
    scope: 'full',
    odtOptions: { includeCoverPage: true }
  }
};
```

**Cover Page with jsPDF:**
```typescript
function addCoverPage(pdf: jsPDF, options: PdfCoverOptions): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Title
  pdf.setFontSize(28);
  pdf.setTextColor(51, 51, 51); // #333333
  pdf.text(options.title, pageWidth / 2, pageHeight * 0.3, { align: 'center' });

  // Subtitle
  pdf.setFontSize(16);
  pdf.setTextColor(85, 85, 85); // #555555
  pdf.text(options.subtitle, pageWidth / 2, pageHeight * 0.4, { align: 'center' });

  // Decorative line
  pdf.setDrawColor(204, 204, 204);
  pdf.setLineWidth(0.5);
  pdf.line(pageWidth * 0.3, pageHeight * 0.45, pageWidth * 0.7, pageHeight * 0.45);

  // Stats
  pdf.setFontSize(11);
  pdf.text(options.stats, pageWidth / 2, pageHeight * 0.52, { align: 'center' });

  // Generation date
  pdf.setFontSize(10);
  pdf.setTextColor(136, 136, 136); // #888888
  pdf.text(`Generated ${new Date().toLocaleDateString()}`, pageWidth / 2, pageHeight * 0.85, { align: 'center' });

  // Branding
  pdf.setFontSize(9);
  pdf.setTextColor(153, 153, 153); // #999999
  pdf.text('Canvas Roots for Obsidian', pageWidth / 2, pageHeight * 0.9, { align: 'center' });

  // Add chart on next page
  pdf.addPage();
}
```

**Document Metadata:**
```typescript
pdf.setDocumentProperties({
  title: `${rootPersonName} Family Tree`,
  subject: `Family tree with ${personCount} people`,
  author: options.author || '',
  keywords: 'family tree, genealogy, canvas roots',
  creator: 'Canvas Roots for Obsidian'
});
```

**Multi-Page Tiling:**
```typescript
function exportTiledPdf(
  svgElement: SVGSVGElement,
  chartWidth: number,
  chartHeight: number,
  pageSize: PageSize
): void {
  const { width: pageWidth, height: pageHeight } = PAGE_SIZES[pageSize];
  const margin = 40;
  const printableWidth = pageWidth - (margin * 2);
  const printableHeight = pageHeight - (margin * 2) - 30; // Header space

  const cols = Math.ceil(chartWidth / printableWidth);
  const rows = Math.ceil(chartHeight / printableHeight);

  const pdf = new jsPDF({
    orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
    unit: 'px',
    format: [pageWidth, pageHeight]
  });

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (row > 0 || col > 0) pdf.addPage();

      // Page header
      pdf.setFontSize(9);
      pdf.setTextColor(136, 136, 136);
      pdf.text(`Page ${row * cols + col + 1} of ${rows * cols}`, pageWidth / 2, 25, { align: 'center' });

      // Extract tile from canvas and add to PDF
      const tileCanvas = extractTile(svgElement, col * printableWidth, row * printableHeight, printableWidth, printableHeight);
      const imgData = tileCanvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', margin, margin + 30, printableWidth, printableHeight);
    }
  }

  pdf.save(filename);
}
```

**Page Sizes:**
```typescript
const PAGE_SIZES = {
  A4: { width: 595.28, height: 841.89, label: 'A4 (210 × 297 mm)' },
  LETTER: { width: 612, height: 792, label: 'Letter (8.5 × 11 in)' },
  LEGAL: { width: 612, height: 1008, label: 'Legal (8.5 × 14 in)' },
  TABLOID: { width: 792, height: 1224, label: 'Tabloid (11 × 17 in)' },
  fit: null // Dynamic sizing to match content
};
```

### CSS Classes
- `.cr-fcv-export-wizard`
- `.cr-fcv-export-wizard__step` — Container for each step
- `.cr-fcv-export-wizard__step--active` — Currently visible step
- `.cr-fcv-export-presets` — Preset cards container
- `.cr-fcv-export-preset` — Individual preset card
- `.cr-fcv-export-preset--selected` — Selected preset
- `.cr-fcv-export-format-cards`
- `.cr-fcv-export-format-card`
- `.cr-fcv-export-format-card--selected`
- `.cr-fcv-export-options` — Step 2 options container
- `.cr-fcv-export-estimate`
- `.cr-fcv-export-warning`
- `.cr-fcv-export-progress`
- `.cr-fcv-export-nav` — Navigation buttons (Customize/Back)

---

## Benefits

1. **Better discoverability** — All options visible at once
2. **Prevents crashes** — Warnings for large exports, easy avatar toggle
3. **Quality control** — Users can tune quality vs size
4. **Progress feedback** — Know what's happening during long exports
5. **Informed decisions** — Size estimates before committing

---

## Success Criteria

### Phase 1: Two-Step Wizard Structure ✅
- [x] Export wizard opens from toolbar button
- [x] Step 1 shows: presets, format cards, filename, estimate panel
- [x] Step 2 shows: avatars, scope, format-specific options
- [x] "Customize →" button navigates to Step 2
- [x] "← Back" button returns to Step 1
- [x] Export button works from both steps

### Phase 2: Core Export Integration ✅
- [x] All four formats (PNG, SVG, PDF, ODT placeholder) selectable via cards
- [x] Filename field editable, pre-populated with pattern
- [x] Avatar include/exclude toggle works (Step 2)
- [x] Scope options (full/limited) affect export content (Step 2)
- [x] PNG scale option (1x/2x/3x) works (Step 2)
- [x] Size estimation displays on Step 1 (people count, avatar count, file size)
- [x] Avatar count hidden when avatars excluded
- [x] Warning shown when: >100 people, OR >50 avatars with avatars included, OR >5MB

### Phase 3: PDF Enhancements ✅
- [x] PDF export continues using jsPDF (better quality for chart images)
- [x] PDF options appear in Step 2 when PDF selected
- [x] Page size selection (Fit, A4, Letter, Legal, Tabloid) works
- [x] Layout selection (single/tiled) works
- [x] Orientation selection (auto/portrait/landscape) for tiled layout
- [x] Cover page option available with styled title page
- [x] Custom title/subtitle fields work
- [x] Document metadata added (title, subject, author, keywords)

### Phase 4: Progress & Polish ✅
- [x] Progress bar shown for exports >2 seconds
- [x] Cancel button works during export
- [x] UI polish complete

### Phase 5: Presets ✅
- [x] Five preset cards displayed prominently on Step 1
- [x] Preset click populates all form fields (format, avatars, scale, cover page)
- [x] Visual feedback shows which preset is selected (icon + border highlight)
- [x] Settings remembered between sessions (lastFamilyChartExport in settings)

### Phase 6: ODT Export ✅
- [x] ODT format option fully functional alongside PNG/SVG/PDF
- [x] ODT generation works without external library (JSZip + manual XML)
- [x] Chart embedded as image in ODT document
- [x] Optional cover page with title/subtitle renders correctly
- [x] Generated ODT opens in LibreOffice/Word without errors
- [x] Document preset uses ODT format

---

## See Also

- [Universal Media Linking](universal-media-linking.md) — Original context
- [Family Chart View wiki](../../wiki-content/Family-Chart-View.md) — User documentation
