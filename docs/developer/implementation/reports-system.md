# Reports System

This document covers the report generation system, including report types, rendering pipelines, and export formats.

## Table of Contents

- [Overview](#overview)
- [Report Types](#report-types)
- [Architecture](#architecture)
- [Report Generation Service](#report-generation-service)
- [PDF Rendering](#pdf-rendering)
- [ODT Export](#odt-export)
- [Report Wizard UI](#report-wizard-ui)

---

## Overview

Charted Roots provides a comprehensive report generation system with 14 genealogical report types across 6 categories. Reports can be output in multiple formats:

| Format | Description | Use Case |
|--------|-------------|----------|
| **Vault** | Save markdown to vault | Integration with Obsidian |
| **MD** | Download markdown file | External editing |
| **PDF** | Professional PDF document | Printing, sharing |
| **ODT** | OpenDocument Text | Editable in word processors |

**Data flow:**

```
User Input (Wizard/Modal)
    ↓
Build Options Object
    ↓
ReportGenerationService.generateReport()
    ↓
Specific Report Generator → ReportResult (markdown)
    ↓
Based on outputMethod:
  ├─ 'vault' → saveToVault()
  ├─ 'download' → downloadReport() [markdown]
  ├─ 'pdf' → PdfReportRenderer
  └─ 'odt' → OdtGenerator
```

---

## Report Types

### Categories and Reports

| Category | Reports |
|----------|---------|
| **Genealogical** | Family Group Sheet, Individual Summary, Ahnentafel, Register Report, Pedigree Chart, Descendant Chart |
| **Research** | Source Summary, Gaps Report, Media Inventory |
| **Timeline** | Timeline Report |
| **Geographic** | Place Summary |
| **Summary** | Universe Overview, Collection Overview |
| **Visual Trees** | Pedigree/Descendant/Hourglass/Fan Chart (via unified tree wizard) |

### Type Definitions

**Location:** `src/reports/types/report-types.ts`

```typescript
// Base options for all reports
interface ReportOptions {
  outputMethod: 'vault' | 'download' | 'pdf' | 'odt';
  outputFolder?: string;
  filename?: string;
  includeSources: boolean;
}

// Report-specific options extend base
interface AhnentafelOptions extends ReportOptions {
  rootPersonCrId: string;
  maxGenerations: number;
  includeDetails: boolean;
}

// Gaps Report with research level filtering
interface GapsReportOptions extends ReportOptions {
  scope: 'all' | 'collection';
  collectionPath?: string;
  fieldsToCheck: {
    birthDate: boolean;
    deathDate: boolean;
    parents: boolean;
    sources: boolean;
  };
  maxItemsPerCategory: number;
  // Research level filtering (requires trackFactSourcing setting)
  researchLevelMax?: number;      // 0-6, undefined = all
  includeUnassessed?: boolean;    // Include people without research_level
  sortByResearchLevel?: boolean;  // Sort lowest first (most needs work)
}

// Result returned by generators
interface ReportResult {
  success: boolean;
  content: string;  // Markdown content
  suggestedFilename: string;
  stats: {
    peopleCount: number;
    eventsCount: number;
    sourcesCount: number;
    generationsCount?: number;
  };
  error?: string;
  warnings: string[];
}
```

### Report Metadata

Each report type has associated metadata for UI rendering:

```typescript
interface ReportMetadata {
  type: ReportType;
  name: string;
  description: string;
  icon: string;
  category: ReportCategory;
  requiresPerson: boolean;
  entityType: 'person' | 'place' | 'universe' | 'collection' | null;
}

// Usage
const metadata = REPORT_METADATA['ahnentafel'];
// { type: 'ahnentafel', name: 'Ahnentafel Report', ... }
```

---

## Architecture

### File Structure

```
/src/reports/
├── index.ts                           # Public exports
├── types/
│   └── report-types.ts               # All type definitions
├── services/
│   ├── report-generation-service.ts  # Main orchestrator
│   ├── pdf-report-renderer.ts        # PDF rendering via pdfmake
│   ├── odt-generator.ts              # ODT export via JSZip
│   ├── family-group-sheet-generator.ts
│   ├── individual-summary-generator.ts
│   ├── ahnentafel-generator.ts
│   ├── gaps-report-generator.ts
│   ├── register-report-generator.ts
│   ├── pedigree-chart-generator.ts
│   ├── descendant-chart-generator.ts
│   ├── source-summary-generator.ts
│   ├── timeline-generator.ts
│   ├── place-summary-generator.ts
│   ├── media-inventory-generator.ts
│   ├── universe-overview-generator.ts
│   └── collection-overview-generator.ts
└── ui/
    ├── report-wizard-modal.ts        # 4-step wizard
    └── report-generator-modal.ts     # Single modal
```

### Key Patterns

**Separation of Concerns:**
- **Types** - All interfaces in `report-types.ts`
- **Services** - Report generation logic
- **Generators** - One class per report type
- **Renderers** - Output formatting (PDF, ODT)
- **UI** - Modal interfaces

**Markdown as Intermediate Format:**
All reports generate markdown first, which is then:
- Saved to vault (if 'vault' output)
- Downloaded as .md (if 'download' output)
- Converted to PDF via pdfmake
- Converted to ODT via markdown→XML parser

---

## Report Generation Service

**Location:** `src/reports/services/report-generation-service.ts`

The service orchestrates report generation by routing to specific generators:

```typescript
class ReportGenerationService {
  // Specific generator instances
  private familyGroupSheet: FamilyGroupSheetGenerator;
  private individualSummary: IndividualSummaryGenerator;
  // ... other generators

  async generateReport(
    type: ReportType,
    options: ReportOptions
  ): Promise<ReportResult> {
    switch (type) {
      case 'family-group-sheet':
        return this.familyGroupSheet.generate(options);
      case 'ahnentafel':
        return this.ahnentafel.generate(options);
      // ... other cases
    }
  }

  async saveToVault(result: ReportResult, folder: string): Promise<TFile> {
    // Creates file in vault with duplicate detection
  }
}

// Factory function
export function createReportGenerationService(
  app: App,
  settings: CanvasRootsSettings
): ReportGenerationService {
  return new ReportGenerationService(app, settings);
}
```

---

## PDF Rendering

**Location:** `src/reports/services/pdf-report-renderer.ts`

Uses pdfmake for professional PDF output with lazy loading to minimize bundle impact.

### Initialization

```typescript
class PdfReportRenderer {
  private pdfMake: any = null;

  private async ensurePdfMakeLoaded(): Promise<void> {
    if (this.pdfMake) return;

    // Dynamic import
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const vfsFonts = await import('pdfmake/build/vfs_fonts');

    this.pdfMake = pdfMakeModule.default || pdfMakeModule;
    this.pdfMake.vfs = vfsFonts.pdfMake?.vfs;

    // Font configuration (Roboto bundled with pdfmake)
    this.pdfMake.fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
      }
    };
  }
}
```

### PDF Options

```typescript
interface PdfOptions {
  pageSize: 'A4' | 'LETTER';
  fontStyle: 'serif' | 'sans-serif';
  includeCoverPage: boolean;
  logoDataUrl?: string;      // Base64 image for cover
  customTitle?: string;
  customTitleScope?: 'cover' | 'headers' | 'both';
  customSubtitle?: string;
  coverNotes?: string;       // Multi-paragraph preface
  dateFormat?: 'mdy' | 'dmy' | 'ymd';
}
```

### Document Structure

```typescript
const docDefinition: TDocumentDefinitions = {
  pageSize: 'LETTER',
  pageMargins: [40, 60, 40, 60],
  defaultStyle: { font: 'Roboto', fontSize: 10 },
  styles: {
    title: { fontSize: 14, bold: true },
    sectionHeader: { fontSize: 12, bold: true },
    tableHeader: { bold: true, fillColor: '#E5E5E5' },
    // ...
  },
  content: [
    // Cover page (optional)
    { text: 'Report Title', style: 'title' },
    // Report content
    { table: { body: [...] } },
  ],
  header: (currentPage, pageCount) => ({
    text: 'Report Name',
    alignment: 'left',
    margin: [40, 20]
  }),
  footer: (currentPage, pageCount) => ({
    text: `Page ${currentPage} of ${pageCount}`,
    alignment: 'right',
    margin: [40, 20]
  })
};

this.pdfMake.createPdf(docDefinition).download(filename);
```

### Layout Components

Helper methods build consistent pdfmake content:

```typescript
// Section header with accent bar
buildSectionHeader(title: string): Content {
  return {
    columns: [
      { canvas: [{ type: 'rect', ... }], width: 4 },
      { text: title.toUpperCase(), style: 'sectionHeader' }
    ]
  };
}

// Key-value pairs table
buildKeyValueTable(pairs: [string, string][]): Content {
  return {
    table: {
      widths: ['30%', '70%'],
      body: pairs.map(([label, value]) => [
        { text: label, style: 'label' },
        { text: value, style: 'value' }
      ])
    }
  };
}

// Data table with zebra striping
buildDataTable(headers: string[], rows: string[][]): Content {
  return {
    table: {
      headerRows: 1,
      body: [
        headers.map(h => ({ text: h, style: 'tableHeader' })),
        ...rows.map((row, i) =>
          row.map(cell => ({
            text: cell,
            fillColor: i % 2 ? '#F5F5F5' : null
          }))
        )
      ]
    }
  };
}
```

### Report-Specific Renderers

Each report type has a dedicated render method:

```typescript
async renderAhnentafel(
  result: AhnentafelResult,
  options: PdfOptions
): Promise<void> {
  await this.ensurePdfMakeLoaded();

  const content: Content[] = [];

  // Optional cover page
  if (options.includeCoverPage) {
    content.push(this.buildCoverPage(options));
  }

  // Report title
  content.push({ text: 'Ahnentafel Report', style: 'title' });

  // Subject info
  content.push(this.buildKeyValueTable([
    ['Subject', result.rootPerson.name],
    ['Generations', result.generationCount.toString()]
  ]));

  // Ancestors by generation
  for (const gen of result.generations) {
    content.push(this.buildSectionHeader(`Generation ${gen.number}`));
    content.push(this.buildDataTable(
      ['#', 'Name', 'Birth', 'Death'],
      gen.ancestors.map(a => [
        a.ahnentafelNumber.toString(),
        a.name,
        a.birthDate || '',
        a.deathDate || ''
      ])
    ));
  }

  const doc = this.buildDocument(content, options);
  this.pdfMake.createPdf(doc).download(result.suggestedFilename + '.pdf');
}
```

### Visual Tree PDF

For visual tree reports, SVG is rendered to PNG and embedded:

```typescript
async renderVisualTree(
  layout: VisualTreeLayout,
  options: VisualTreePdfOptions
): Promise<void> {
  // Render tree to SVG
  const svg = VisualTreeSvgRenderer.render(layout, options);

  // Convert SVG to PNG data URL
  const pngDataUrl = await this.svgToPng(svg, options.scale || 4);

  // Calculate page size to fit tree
  const pageSize = this.calculatePageSize(layout);

  const docDefinition = {
    pageSize,
    pageOrientation: layout.width > layout.height ? 'landscape' : 'portrait',
    content: [{
      image: pngDataUrl,
      width: layout.width,
      height: layout.height
    }]
  };

  this.pdfMake.createPdf(docDefinition).download(filename);
}
```

---

## ODT Export

**Location:** `src/reports/services/odt-generator.ts`

Generates OpenDocument Text files using JSZip. ODT files are ZIP archives containing XML.

### ODT Structure

```
report.odt (ZIP archive)
├── mimetype                    # application/vnd.oasis.opendocument.text
├── META-INF/
│   └── manifest.xml           # File registry
├── styles.xml                 # Paragraph and text styles
├── content.xml                # Document body
└── Pictures/                  # Embedded images (optional)
    └── tree.png
```

### Generation Flow

```typescript
class OdtGenerator {
  async generate(
    markdown: string,
    options: OdtExportOptions
  ): Promise<Blob> {
    const zip = new JSZip();

    // 1. Mimetype (must be first, uncompressed)
    zip.file('mimetype',
      'application/vnd.oasis.opendocument.text',
      { compression: 'STORE' }
    );

    // 2. Manifest
    zip.file('META-INF/manifest.xml', this.generateManifest());

    // 3. Styles
    zip.file('styles.xml', this.generateStyles());

    // 4. Content (markdown converted to XML)
    const content = this.markdownToOdtContent(markdown, options);
    zip.file('content.xml', content);

    // 5. Images (if any)
    for (const image of this.embeddedImages) {
      zip.file(`Pictures/${image.name}`, image.data, { binary: true });
    }

    return zip.generateAsync({ type: 'blob' });
  }
}
```

### ODT Options

```typescript
interface OdtExportOptions {
  title?: string;
  subtitle?: string;
  author?: string;
  includeCoverPage?: boolean;
  coverNotes?: string;
}
```

### Markdown Conversion

The `markdownToOdtContent()` method converts markdown to ODT XML:

```typescript
private markdownToOdtContent(
  markdown: string,
  options: OdtExportOptions
): string {
  const lines = markdown.split('\n');
  const bodyContent: string[] = [];

  // Optional cover page
  if (options.includeCoverPage) {
    bodyContent.push(this.generateCoverPage(options));
  }

  for (const line of lines) {
    if (line.startsWith('# ')) {
      // Heading 1
      bodyContent.push(
        `<text:p text:style-name="Heading_20_1">${this.escape(line.slice(2))}</text:p>`
      );
    } else if (line.startsWith('## ')) {
      // Heading 2
      bodyContent.push(
        `<text:p text:style-name="Heading_20_2">${this.escape(line.slice(3))}</text:p>`
      );
    } else if (line.startsWith('- ')) {
      // Unordered list item
      bodyContent.push(
        `<text:list><text:list-item>
          <text:p text:style-name="List_20_Paragraph">${this.processInline(line.slice(2))}</text:p>
        </text:list-item></text:list>`
      );
    } else if (this.isTableRow(line)) {
      // Table handling
      bodyContent.push(this.parseMarkdownTable(lines, currentIndex));
    } else {
      // Regular paragraph
      bodyContent.push(
        `<text:p text:style-name="Standard">${this.processInline(line)}</text:p>`
      );
    }
  }

  return this.wrapInDocument(bodyContent.join('\n'));
}
```

### Inline Formatting

```typescript
private processInlineFormatting(text: string): string {
  // Bold: **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g,
    '<text:span text:style-name="Bold">$1</text:span>');
  text = text.replace(/__(.+?)__/g,
    '<text:span text:style-name="Bold">$1</text:span>');

  // Italic: *text* or _text_
  text = text.replace(/\*(.+?)\*/g,
    '<text:span text:style-name="Italic">$1</text:span>');

  // Wikilinks: [[name]] → bold text
  text = text.replace(/\[\[([^\]]+)\]\]/g,
    '<text:span text:style-name="Bold">$1</text:span>');

  // Small caps for genealogy terms
  const terms = ['Husband', 'Wife', 'Father', 'Mother', 'Birth', 'Death', 'Married'];
  for (const term of terms) {
    text = text.replace(new RegExp(`\\b${term}\\b`, 'g'),
      `<text:span text:style-name="SmallCaps">${term}</text:span>`);
  }

  return this.escapeXml(text);
}
```

### Table Rendering

```typescript
private parseMarkdownTable(lines: string[], startIndex: number): string {
  // Detect table rows and separator
  const rows: string[][] = [];
  let hasHeader = false;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('|')) break;

    // Check if separator line (|---|---|)
    if (/^\|?[\s\-:|]+\|?$/.test(line)) {
      hasHeader = true;
      continue;
    }

    // Parse cells
    const cells = line.split('|')
      .map(c => c.trim())
      .filter(c => c);
    rows.push(cells);
  }

  // Build ODT table
  const columnCount = rows[0]?.length || 0;
  let xml = `<table:table table:style-name="Table1">`;

  // Column definitions
  for (let i = 0; i < columnCount; i++) {
    xml += `<table:table-column/>`;
  }

  // Rows
  rows.forEach((row, rowIndex) => {
    const isHeader = hasHeader && rowIndex === 0;
    xml += `<table:table-row>`;

    for (const cell of row) {
      const style = isHeader ? 'TableHeaderCell' : 'TableCell';
      xml += `<table:table-cell table:style-name="${style}">
        <text:p>${this.processInline(cell)}</text:p>
      </table:table-cell>`;
    }

    xml += `</table:table-row>`;
  });

  xml += `</table:table>`;
  return xml;
}
```

### Image Embedding

For visual tree exports, images are embedded in the ODT:

```typescript
interface OdtEmbeddedImage {
  name: string;      // e.g., 'tree.png'
  data: ArrayBuffer; // PNG binary data
  width: number;     // cm
  height: number;    // cm
}

addImage(image: OdtEmbeddedImage): void {
  this.embeddedImages.push(image);
}

private generateImageContent(image: OdtEmbeddedImage): string {
  return `
    <text:p text:style-name="Image_20_Paragraph">
      <draw:frame draw:style-name="ImageFrame"
                  svg:width="${image.width}cm"
                  svg:height="${image.height}cm"
                  text:anchor-type="paragraph">
        <draw:image xlink:href="Pictures/${image.name}"
                    xlink:type="simple"
                    xlink:show="embed"/>
      </draw:frame>
    </text:p>
  `;
}
```

### Download

```typescript
static download(blob: Blob, filename: string): void {
  // Ensure .odt extension
  if (!filename.endsWith('.odt')) {
    filename = filename.replace(/\.[^.]+$/, '') + '.odt';
  }

  // Trigger browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

---

## Report Wizard UI

**Location:** `src/reports/ui/report-wizard-modal.ts`

A 4-step wizard for guided report generation.

### Steps

| Step | Name | Purpose |
|------|------|---------|
| 1 | Select | Choose report type and subject |
| 2 | Format | Output format (Vault/PDF/ODT/MD) |
| 3 | Customize | Content options + format-specific settings |
| 4 | Generate | Review summary and generate |

### Wizard State

```typescript
interface WizardFormData {
  // Step 1
  reportType: ReportType | null;
  subjectCrId: string | null;
  subjectName: string | null;

  // Step 2
  outputFormat: 'vault' | 'pdf' | 'odt' | 'download';

  // Step 3 - Content options
  includeSpouses: boolean;
  includeSources: boolean;
  includeDetails: boolean;
  includeChildren: boolean;
  maxGenerations: number;

  // Step 3 - PDF options
  pdfPageSize: 'A4' | 'LETTER';
  pdfDateFormat: 'mdy' | 'dmy' | 'ymd';
  pdfIncludeCover: boolean;
  pdfTitle: string;
  pdfSubtitle: string;
  pdfCoverNotes: string;
  pdfLogoDataUrl: string | null;

  // Step 3 - ODT options
  odtIncludeCover: boolean;
  odtTitle: string;
  odtSubtitle: string;
  odtCoverNotes: string;

  // Step 4
  filename: string;
  outputFolder: string;
}
```

### Person Picker

The wizard includes an inline person picker with:
- Search input (real-time filtering)
- Sort options (Name A-Z/Z-A, Birth oldest/newest)
- Sex filter (All/Male/Female/Unknown)
- Connection filter checkbox
- Results count display
- Radio selection with highlight

```typescript
private renderPersonPicker(container: HTMLElement): void {
  // Search input
  const searchInput = container.createEl('input', {
    type: 'text',
    placeholder: 'Search by name...'
  });
  searchInput.addEventListener('input', () => {
    this.filterPeople(searchInput.value);
  });

  // Sort dropdown
  const sortSelect = container.createEl('select');
  sortSelect.createEl('option', { value: 'name-asc', text: 'Name A-Z' });
  sortSelect.createEl('option', { value: 'name-desc', text: 'Name Z-A' });
  sortSelect.createEl('option', { value: 'birth-asc', text: 'Birth oldest' });
  sortSelect.createEl('option', { value: 'birth-desc', text: 'Birth newest' });

  // Person list (max 50 shown)
  const listContainer = container.createDiv({ cls: 'person-list' });
  for (const person of this.filteredPeople.slice(0, 50)) {
    const item = listContainer.createDiv({ cls: 'person-item' });
    // Radio + name + dates
  }
}
```

### Visual Tree Delegation

When a visual tree report is selected, the wizard delegates to the unified tree wizard:

```typescript
private handleReportTypeChange(type: ReportType): void {
  if (this.isVisualTreeType(type)) {
    // Close this wizard
    this.close();

    // Map report type to tree type
    const treeType = this.mapReportToTreeType(type);

    // Open unified tree wizard
    const treeWizard = new UnifiedTreeWizardModal(this.plugin, {
      outputFormat: 'pdf',
      treeType
    });
    treeWizard.open();
  }
}

private mapReportToTreeType(reportType: ReportType): TreeType {
  switch (reportType) {
    case 'pedigree-tree-pdf': return 'ancestors';
    case 'descendant-tree-pdf': return 'descendants';
    case 'hourglass-tree-pdf': return 'full';
    case 'fan-chart-pdf': return 'fan';
  }
}
```

---

## Related Documentation

- [Canvas and Charts](canvas-and-charts.md) - Visual tree generation
- [Third-Party Libraries](third-party-libraries.md) - pdfmake and JSZip details
- [UI Architecture](ui-architecture.md) - Modal patterns and Control Center integration
