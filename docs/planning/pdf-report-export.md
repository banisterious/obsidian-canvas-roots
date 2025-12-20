# PDF Report Export

Planning document for adding PDF export capability to genealogical reports.

**Status:** Planning
**Priority:** High
**GitHub Issue:** #TBD
**Created:** 2024-12-19
**Updated:** 2025-12-19

---

## Overview

Add the ability to export genealogical reports as professionally styled PDF documents, in addition to the existing markdown output. This enables users to share and archive reports in a widely compatible format.

---

## Current State

The report generation system currently supports 7 report types:

| Report | Description |
|--------|-------------|
| Ahnentafel | Numbered ancestor list (Sosa-Stradonitz system) |
| Pedigree Chart | ASCII tree visualization of ancestors |
| Descendant Chart | ASCII tree of descendants |
| Register Report | NGSQ-style descendant numbering |
| Family Group Sheet | Couple + children + vitals |
| Individual Summary | Comprehensive facts for one person |
| Gaps Report | Missing data and research opportunities |

**Current output options:**
- Save to vault (markdown file)
- Download file (markdown download)

**Existing PDF export (charts only):**
- jsPDF is used in `family-chart-view.ts` and `tree-preview.ts` for image-based PDF export (SVG → Canvas → PNG → PDF)
- Not suitable for text-heavy reports

---

## Phase 1: Core PDF Export

Add PDF export with fixed professional styling using pdfmake with dynamic loading and standard PDF fonts.

### Scope

1. **Add pdfmake dependency**
   - Install `pdfmake` npm package
   - Use dynamic import (lazy loading) to minimize bundle impact
   - Use standard PDF fonts only (no vfs_fonts.js)

2. **Create PdfReportRenderer service**
   - Location: `src/reports/services/pdf-report-renderer.ts`
   - Render each report type directly from structured data (not markdown parsing)
   - Use consistent, professional styling

3. **Update ReportOptions type**
   - Add `'pdf'` to `outputMethod` union type

4. **Update ReportGeneratorModal**
   - Add "Download as PDF" option to output method dropdown

5. **Update ReportGenerationService**
   - Handle PDF output method
   - Call PdfReportRenderer for PDF generation

### Dynamic Loading Strategy

pdfmake is loaded only when the user exports a PDF, not at plugin startup:

```typescript
export class PdfReportRenderer {
  private pdfMake: any = null;

  private async ensurePdfMake(): Promise<void> {
    if (this.pdfMake) return;

    new Notice('Preparing PDF export...');

    // Dynamic import - only loads when needed
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    this.pdfMake = pdfMakeModule.default || pdfMakeModule;

    // Use standard PDF fonts - NO vfs_fonts.js needed
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

  async renderReport(data: ReportResult, options: PdfOptions): Promise<void> {
    await this.ensurePdfMake();

    const docDefinition = {
      defaultStyle: {
        font: options.fontStyle === 'serif' ? 'Times' : 'Helvetica'
      },
      // ... rest of document
    };

    this.pdfMake.createPdf(docDefinition).download(filename);
  }
}
```

### Standard PDF Fonts

Using standard PDF fonts eliminates the need for embedded fonts:

| Font Family | Use Case | Variants |
|-------------|----------|----------|
| Helvetica | Sans-serif body, headers | Regular, Bold, Oblique, BoldOblique |
| Times | Serif body (traditional reports) | Roman, Bold, Italic, BoldItalic |
| Courier | Monospace (ASCII trees, code) | Regular, Bold, Oblique, BoldOblique |

These fonts are built into every PDF reader—no embedding required.

### Default Styling

Professional genealogy report styling:

| Element | Style |
|---------|-------|
| Page size | A4 (Letter as future option) |
| Serif font | Times (traditional look) |
| Sans-serif font | Helvetica (modern look) |
| Monospace font | Courier (ASCII trees) |
| Title | Large, bold, centered |
| Section headers | Bold, slightly larger, with subtle underline |
| Body text | 11pt, black on white |
| Tables | Clean borders, alternating row colors optional |
| Page numbers | Footer, centered |
| Generation date | Header or title page |

### Implementation Details

**PdfReportRenderer methods:**

```typescript
class PdfReportRenderer {
  private pdfMake: any = null;

  // Lazy loading
  private async ensurePdfMake(): Promise<void>;

  // Render methods for each report type
  async renderAhnentafel(result: AhnentafelResult, options: AhnentafelOptions): Promise<void>;
  async renderPedigreeChart(result: PedigreeChartResult, options: PedigreeChartOptions): Promise<void>;
  async renderDescendantChart(result: DescendantChartResult, options: DescendantChartOptions): Promise<void>;
  async renderRegisterReport(result: RegisterReportResult, options: RegisterReportOptions): Promise<void>;
  async renderFamilyGroupSheet(result: FamilyGroupSheetResult, options: FamilyGroupSheetOptions): Promise<void>;
  async renderIndividualSummary(result: IndividualSummaryResult, options: IndividualSummaryOptions): Promise<void>;
  async renderGapsReport(result: GapsReportResult, options: GapsReportOptions): Promise<void>;
}
```

**pdfmake document structure:**

```typescript
const docDefinition = {
  pageSize: 'A4',
  pageMargins: [40, 60, 40, 60],
  defaultStyle: {
    font: 'Times',
    fontSize: 11
  },
  header: { text: 'Report Title', alignment: 'right', margin: [40, 20] },
  footer: (currentPage, pageCount) => ({
    text: `Page ${currentPage} of ${pageCount}`,
    alignment: 'center',
    margin: [40, 20]
  }),
  content: [
    // Report-specific content
  ],
  styles: {
    title: { fontSize: 24, bold: true, alignment: 'center', margin: [0, 0, 0, 20] },
    h2: { fontSize: 16, bold: true, margin: [0, 15, 0, 5] },
    h3: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
    monospace: { font: 'Courier', fontSize: 10 },
    tableHeader: { bold: true, fillColor: '#f0f0f0' }
  }
};
```

### Report-Specific Rendering

**Ahnentafel:**
- Title with root person name and generation count
- Sections by generation with generation labels
- Numbered list entries with optional birth/death details
- Summary statistics section

**Pedigree/Descendant Charts:**
- Title with root person
- Monospace font section for ASCII tree (preserving tree structure)
- Detailed ancestor/descendant list by generation

**Register Report:**
- Title with progenitor name
- Numbered sections following NGSQ format
- Children sub-listings with roman numerals

**Family Group Sheet:**
- Husband/Wife sections with vitals
- Children table with birth/death info
- Marriage events section

**Individual Summary:**
- Person name and vital statistics
- Family relationships section
- Events timeline table
- Attributes section

**Gaps Report:**
- Summary statistics table
- Sections for each gap type
- Tables of affected people with links removed (plain text)

---

## Phase 2: User-Configurable Styling

Add user options for PDF appearance.

### Scope

1. **PDF Options in Modal**
   - Page size: A4 / Letter
   - Font style: Traditional (serif) / Modern (sans-serif)
   - Include cover page: Yes / No
   - Color scheme: Classic / Minimal

2. **Settings Integration**
   - Default PDF options in plugin settings
   - Remember last-used options per report type

3. **Cover Page**
   - Report title
   - Root person name (if applicable)
   - Generation date
   - Optional: Vault/project name

### Implementation Notes

Add PDF-specific options to report options:

```typescript
interface PdfOptions {
  pageSize: 'A4' | 'LETTER';
  fontStyle: 'serif' | 'sans-serif';
  includeCoverPage: boolean;
  colorScheme: 'classic' | 'minimal';
}
```

---

## Phase 3: Advanced Features

Future enhancements based on user feedback.

### Potential Features

| Feature | Description | Complexity |
|---------|-------------|------------|
| Custom fonts | Embed user-specified fonts (increases size) | High |
| Logo/watermark | Add family crest or watermark | Medium |
| Table of contents | For long reports | Medium |
| Hyperlinks | Internal document links between generations | Low |
| Charts/graphs | Visual statistics (age distribution, etc.) | High |
| Multi-report compilation | Combine multiple reports into one PDF | Medium |
| Non-Latin font packs | Optional download for CJK, Arabic, Hebrew | High |

### Non-Latin Script Support

For users with non-Latin names (Chinese, Arabic, Hebrew, etc.), standard PDF fonts won't work. Options:

1. **Optional font pack download** - User downloads additional font file when needed
2. **Transliteration fallback** - Convert to Latin equivalents with notice
3. **Skip with warning** - Notify user that custom fonts are needed

This is deferred to Phase 3 based on user demand.

---

## Technical Considerations

### Bundle Size Strategy

The hybrid approach minimizes impact on both initial bundle and vault storage:

| Component | Size | Strategy |
|-----------|------|----------|
| pdfmake core | ~400-500 KB | Dynamic import (not in initial bundle) |
| vfs_fonts.js (Roboto) | ~2.4 MB | **Excluded** - use standard PDF fonts |
| **Initial bundle impact** | 0 KB | Loaded only when exporting PDF |
| **Runtime load (first export)** | ~400-500 KB | Cached for subsequent exports |

This is an **~85% reduction** compared to including the full pdfmake bundle with fonts.

### Why Standard PDF Fonts

Standard PDF fonts (Helvetica, Times, Courier) are:
- Built into every PDF reader—no embedding required
- Professional and appropriate for genealogy reports
- Zero additional bundle size
- Sufficient for Latin-script genealogy (English, European languages)

See [ADR: PDF Library and Font Strategy](../developer/design-decisions.md#pdf-library-and-font-strategy) for the full decision record.

### Why pdfmake Over jsPDF for Reports

| Aspect | pdfmake | jsPDF |
|--------|---------|-------|
| API style | Declarative JSON | Imperative |
| Table support | Built-in | Requires jspdf-autotable |
| Typography | Excellent | Basic |
| Maintainability | Higher | Lower |
| Current usage | New | Image-based chart export |

**Decision:** Use pdfmake for text-heavy reports, keep jsPDF for existing image-based chart exports.

### Migration Path

The abstraction (PdfReportRenderer service) allows swapping to jsPDF + jspdf-autotable if needed, with minimal changes to calling code.

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/reports/services/pdf-report-renderer.ts` | PDF rendering service with lazy loading |

### Modified Files

| File | Changes |
|------|---------|
| `src/reports/types/report-types.ts` | Add `'pdf'` to outputMethod |
| `src/reports/ui/report-generator-modal.ts` | Add PDF output option |
| `src/reports/services/report-generation-service.ts` | Handle PDF output |
| `package.json` | Add pdfmake dependency |
| `docs/developer/design-decisions.md` | Add ADR for PDF strategy |

---

## Success Criteria

### Phase 1
- [ ] User can select "Download as PDF" in report generator modal
- [ ] All 7 report types render correctly to PDF
- [ ] PDFs open correctly in standard PDF readers
- [ ] Styling is consistent and professional
- [ ] ASCII tree charts are legible in PDF (using Courier)
- [ ] pdfmake loads dynamically (not in initial bundle)
- [ ] No vfs_fonts.js in bundle (standard fonts only)

### Phase 2
- [ ] User can configure page size and font style
- [ ] Cover page option works correctly
- [ ] Settings persist between sessions

---

## Related Documents

- [Statistics and Reports](../../wiki-content/Statistics-And-Reports.md) - Report documentation
- [ADR: PDF Library and Font Strategy](../developer/design-decisions.md#pdf-library-and-font-strategy) - Design decision
