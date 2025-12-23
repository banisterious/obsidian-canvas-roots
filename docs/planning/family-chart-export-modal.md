# Family Chart Export Modal

**Status:** Planned
**Priority:** Medium
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

### Export Modal UI

```
┌─────────────────────────────────────────────────────────────┐
│  Export Family Chart                                    [X] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FORMAT                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│  │  [PNG]  │  │  [SVG]  │  │  [PDF]  │                     │
│  │  icon   │  │  icon   │  │  icon   │                     │
│  └─────────┘  └─────────┘  └─────────┘                     │
│                                                             │
│  AVATARS                                                    │
│  ○ Include avatars (recommended for small trees)           │
│  ● Exclude avatars (faster, smaller file)                  │
│                                                             │
│  SCOPE                                                      │
│  ○ Visible tree (current view)                             │
│  ● Full tree (all loaded people)                           │
│  ○ Limited depth: [3 ▼] generations                        │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ESTIMATE                                                   │
│  People: 127  │  Avatars: 89  │  Est. size: ~2.4 MB        │
│                                                             │
│  ⚠ Large export - may take 10-30 seconds                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                              [Cancel]  [Export]             │
└─────────────────────────────────────────────────────────────┘
```

### Features

#### 1. Format Selection
- **PNG** — Raster image, best for sharing/printing
- **SVG** — Vector, best for editing/scaling
- **PDF** — Document format, best for archival

Visual icons/cards for each format with brief description on hover.

#### 2. Avatar Options
- **Include avatars** — Embeds person photos as base64 (slower, larger)
- **Exclude avatars** — Gender icons only (faster, smaller, always works)

Show warning when avatars + large tree detected.

#### 3. Scope Options
- **Visible tree** — Export only what's currently rendered
- **Full tree** — Export entire loaded tree
- **Limited depth** — Export N generations from root

#### 4. Size Estimation
Before export, calculate and display:
- Number of people in export scope
- Number of avatars to embed
- Estimated file size
- Estimated export duration

#### 5. Progress Display
For exports > 2 seconds, show:
- Progress bar with percentage
- Current phase (rendering, embedding avatars, encoding)
- Cancel button

#### 6. PDF-Specific Options
When PDF format is selected, show additional options:

**Document Metadata:**
- Title (defaults to "{Root Person} Family Tree")
- Author (optional, defaults to vault name or empty)
- Keywords (optional, for searchability)

**Cover Page (optional):**
- Include a title page before the chart
- Shows: Tree title, root person name, generation date, person count
- Clean, professional layout suitable for archival

**Multi-Page Layout:**
- **Single page** — Fit entire chart on one page (default)
- **Tiled pages** — Split large charts across multiple standard pages (A4/Letter)
- Page size selection: A4, Letter, Legal, Tabloid

Multi-page is useful for printing large trees that would otherwise be unreadably small when fit to a single page.

#### 7. Presets (Future Enhancement)
Quick-select buttons:
- **Print quality** — PNG, with avatars, full tree
- **Web sharing** — PNG, no avatars, visible tree
- **Archival PDF** — PDF with cover page, metadata, full tree
- **Compact** — SVG, no avatars, limited depth

---

## Implementation Plan

### Phase 1: Basic Modal
1. Create `FamilyChartExportModal` class extending `Modal`
2. Implement format selection (PNG/SVG/PDF cards)
3. Implement avatar toggle (include/exclude)
4. Wire up to existing export methods
5. Replace dropdown with single "Export" button that opens modal

### Phase 2: Scope & Estimation
1. Add scope options (visible/full/limited)
2. Implement tree size calculation
3. Add file size estimation algorithm
4. Display warnings for large exports

### Phase 3: PDF Enhancements
1. Keep jsPDF for Family Chart PDF export (better image quality — see Technical Notes)
2. Add PDF-specific options panel (shown when PDF selected)
3. Implement cover page generation using jsPDF text primitives
4. Implement multi-page tiling for large charts
5. Add page size selection (A4, Letter, Legal, Tabloid)
6. Add document metadata via `pdf.setDocumentProperties()`

### Phase 4: Progress & Polish
1. Add progress bar for long exports
2. Implement cancel functionality
3. Add export duration estimation
4. Polish UI/UX

### Phase 5: Presets (Optional)
1. Add preset buttons
2. Remember last-used settings
3. Allow custom preset creation

### Phase 6: ODT Export (Optional)
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

### Modal File Location
`src/ui/views/family-chart-export-modal.ts`

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
  includeAvatars: boolean;
  scope: 'visible' | 'full' | 'limited';
  limitedDepth?: number;

  // PDF-specific options
  pdfOptions?: {
    pageSize: 'A4' | 'LETTER' | 'LEGAL' | 'TABLOID' | 'fit'; // 'fit' = dynamic sizing
    includeCoverPage: boolean;
    customTitle?: string;
    customSubtitle?: string;
    multiPage: 'single' | 'tiled';
  };

  // ODT-specific options (Phase 6)
  odtOptions?: {
    includeCoverPage: boolean;
    customTitle?: string;
    customSubtitle?: string;
  };
}
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
- `.cr-fcv-export-modal`
- `.cr-fcv-export-format-cards`
- `.cr-fcv-export-format-card`
- `.cr-fcv-export-format-card--selected`
- `.cr-fcv-export-options`
- `.cr-fcv-export-estimate`
- `.cr-fcv-export-warning`
- `.cr-fcv-export-progress`

---

## Benefits

1. **Better discoverability** — All options visible at once
2. **Prevents crashes** — Warnings for large exports, easy avatar toggle
3. **Quality control** — Users can tune quality vs size
4. **Progress feedback** — Know what's happening during long exports
5. **Informed decisions** — Size estimates before committing

---

## Success Criteria

### Phase 1-2: Basic Modal
- [ ] Export modal opens from toolbar button
- [ ] All three formats (PNG, SVG, PDF) selectable
- [ ] Avatar include/exclude toggle works
- [ ] Scope options affect export content
- [ ] Size estimation displays before export
- [ ] Warning shown for large exports (>50 people with avatars)

### Phase 3: PDF Enhancements
- [ ] PDF export continues using jsPDF (better quality for chart images)
- [ ] Document metadata added (title, subject, author, keywords)
- [ ] Cover page option available with styled title page
- [ ] Custom title/subtitle fields work
- [ ] Multi-page tiling available for large charts
- [ ] Page size selection (A4, Letter, Legal, Tabloid, Fit) works

### Phase 4-5: Polish & Presets
- [ ] Progress bar shown for exports >2 seconds
- [ ] Cancel button works during export
- [ ] Settings remembered between sessions
- [ ] Presets available for common export configurations

### Phase 6: ODT Export
- [ ] ODT format option appears alongside PNG/SVG/PDF
- [ ] ODT generation works without external library (JSZip + manual XML)
- [ ] Chart embedded as image in ODT document
- [ ] Optional cover page with title/subtitle renders correctly
- [ ] Generated ODT opens in LibreOffice/Word without errors
- [ ] Document merging workflow validated (user can combine with text exports)

---

## See Also

- [Universal Media Linking](universal-media-linking.md) — Original context
- [Family Chart View wiki](../../wiki-content/Family-Chart-View.md) — User documentation
