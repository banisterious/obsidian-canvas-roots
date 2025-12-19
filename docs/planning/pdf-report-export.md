# PDF Report Export

Planning document for adding PDF export capability to genealogical reports.

**Status:** Planning
**Priority:** High
**GitHub Issue:** #TBD
**Created:** 2024-12-19

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

**No PDF export currently exists.**

---

## Phase 1: Core PDF Export

Add PDF export with fixed professional styling using pdfmake.

### Scope

1. **Add pdfmake dependency**
   - Install `pdfmake` npm package (~400KB minified)
   - Note: jsPDF is currently in the project but only used for image-based PDF export in family-chart-view and tree-preview

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

### Default Styling

Professional genealogy report styling:

| Element | Style |
|---------|-------|
| Page size | A4 (Letter as future option) |
| Font | Times-like serif for body, sans-serif for headers |
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
  // Render methods for each report type
  renderAhnentafel(result: AhnentafelResult, options: AhnentafelOptions): Promise<Blob>;
  renderPedigreeChart(result: PedigreeChartResult, options: PedigreeChartOptions): Promise<Blob>;
  renderDescendantChart(result: DescendantChartResult, options: DescendantChartOptions): Promise<Blob>;
  renderRegisterReport(result: RegisterReportResult, options: RegisterReportOptions): Promise<Blob>;
  renderFamilyGroupSheet(result: FamilyGroupSheetResult, options: FamilyGroupSheetOptions): Promise<Blob>;
  renderIndividualSummary(result: IndividualSummaryResult, options: IndividualSummaryOptions): Promise<Blob>;
  renderGapsReport(result: GapsReportResult, options: GapsReportOptions): Promise<Blob>;
}
```

**pdfmake document structure:**

```typescript
const docDefinition = {
  pageSize: 'A4',
  pageMargins: [40, 60, 40, 60],
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
    normal: { fontSize: 11 },
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

| Feature | Description |
|---------|-------------|
| Custom fonts | Embed user-specified fonts |
| Logo/watermark | Add family crest or watermark |
| Table of contents | For long reports |
| Hyperlinks | Internal document links between generations |
| Charts/graphs | Visual statistics (age distribution, etc.) |
| Multi-report compilation | Combine multiple reports into one PDF |

---

## Technical Considerations

### Bundle Size Impact

| Library | Size (minified) | Notes |
|---------|-----------------|-------|
| pdfmake | ~400 KB | Full-featured PDF generation |
| Current main.js | 6.2 MB | Existing bundle |
| Impact | +6.5% | Acceptable for feature value |

### Why pdfmake Over jsPDF

- **Document definition approach:** JSON-based, easier to maintain
- **Better table support:** Built-in table rendering
- **Consistent typography:** Better font handling
- **Existing jsPDF usage:** Only for image-based export (canvas → PNG → PDF), not suitable for text-heavy reports

### Migration Path

If pdfmake proves too large or problematic, the abstraction (PdfReportRenderer service) allows swapping to jsPDF + jspdf-autotable with minimal changes to calling code.

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/reports/services/pdf-report-renderer.ts` | PDF rendering service |

### Modified Files

| File | Changes |
|------|---------|
| `src/reports/types/report-types.ts` | Add `'pdf'` to outputMethod |
| `src/reports/ui/report-generator-modal.ts` | Add PDF output option |
| `src/reports/services/report-generation-service.ts` | Handle PDF output |
| `package.json` | Add pdfmake dependency |

---

## Success Criteria

### Phase 1
- [ ] User can select "Download as PDF" in report generator modal
- [ ] All 7 report types render correctly to PDF
- [ ] PDFs open correctly in standard PDF readers
- [ ] Styling is consistent and professional
- [ ] ASCII tree charts are legible in PDF

### Phase 2
- [ ] User can configure page size and font style
- [ ] Cover page option works correctly
- [ ] Settings persist between sessions

---

## Related Documents

- [Statistics and Reports](../../wiki-content/Statistics-And-Reports.md) - Report documentation
- [Report Types](../architecture/report-types.md) - Report type definitions
