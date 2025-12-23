# Report Generator ODT Export

**Status:** Planned
**Priority:** Medium
**Created:** 2025-12-23

---

## Overview

Add ODT (Open Document Text) export capability to the Report Generator, enabling users to export genealogical reports in a format that can be opened and edited in word processors like LibreOffice Writer and Microsoft Word. This enables document merging workflows where users combine text reports with visual tree exports.

---

## Motivation

**Primary Use Case:** Document merging workflow

Users want to create comprehensive family history documents by combining:
- Descendant/ancestor reports (text content)
- Visual tree charts (images)
- Custom narrative sections

Currently, users must:
1. Export reports as Markdown or PDF
2. Export visual trees separately
3. Manually combine in an external word processor

With ODT export, users can:
1. Export reports as ODT (editable)
2. Export visual trees as ODT (from Family Chart Export Modal)
3. Merge documents directly in LibreOffice/Word

**Secondary Benefits:**
- Editable output format (unlike PDF)
- Wide software compatibility
- Preserves formatting better than plain Markdown
- Standard format for document exchange

---

## Technical Approach

### ODT Format Overview

ODT files are ZIP archives containing XML files:

```
document.odt
├── mimetype                    # "application/vnd.oasis.opendocument.text"
├── META-INF/
│   └── manifest.xml            # File manifest
├── content.xml                 # Document content
├── styles.xml                  # Style definitions
└── Pictures/                   # Embedded images (if any)
    └── image1.png
```

### Implementation Strategy

**Approach:** JSZip + Manual XML Generation

Obsidian already includes JSZip, so no new dependencies are needed. We generate the XML content manually using template strings.

**Why not external libraries:**
- `simple-odf`: Node.js only, doesn't work in browser
- `docxtemplater`: Template-based, requires paid module for images
- Manual generation: Full control, no dependencies, works in browser

### Core Components

```typescript
interface OdtExportOptions {
  title?: string;
  subtitle?: string;
  author?: string;
  includeCoverPage: boolean;
  // For visual tree exports
  embedImage?: {
    data: string;  // base64 PNG
    width: number;
    height: number;
  };
}

class OdtGenerator {
  private zip: JSZip;

  constructor() {
    this.zip = new JSZip();
  }

  async generate(content: string, options: OdtExportOptions): Promise<Blob> {
    this.addMimetype();
    this.addManifest(options.embedImage !== undefined);
    this.addStyles();
    this.addContent(content, options);

    if (options.embedImage) {
      this.addImage(options.embedImage);
    }

    return this.zip.generateAsync({ type: 'blob' });
  }

  private addMimetype(): void {
    // Must be first file, uncompressed
    this.zip.file('mimetype', 'application/vnd.oasis.opendocument.text', {
      compression: 'STORE'
    });
  }

  private addManifest(hasImages: boolean): void {
    let manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>`;

    if (hasImages) {
      manifest += `
  <manifest:file-entry manifest:full-path="Pictures/chart.png" manifest:media-type="image/png"/>`;
    }

    manifest += `
</manifest:manifest>`;

    this.zip.file('META-INF/manifest.xml', manifest);
  }

  private addStyles(): void {
    const styles = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                        xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
                        xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">
  <office:styles>
    <style:style style:name="Title" style:family="paragraph">
      <style:paragraph-properties fo:text-align="center" fo:margin-bottom="0.5cm"/>
      <style:text-properties fo:font-size="24pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Subtitle" style:family="paragraph">
      <style:paragraph-properties fo:text-align="center" fo:margin-bottom="1cm"/>
      <style:text-properties fo:font-size="14pt" fo:color="#555555"/>
    </style:style>
    <style:style style:name="Heading1" style:family="paragraph">
      <style:paragraph-properties fo:margin-top="0.5cm" fo:margin-bottom="0.25cm"/>
      <style:text-properties fo:font-size="18pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Heading2" style:family="paragraph">
      <style:paragraph-properties fo:margin-top="0.4cm" fo:margin-bottom="0.2cm"/>
      <style:text-properties fo:font-size="14pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Standard" style:family="paragraph">
      <style:paragraph-properties fo:margin-bottom="0.2cm"/>
      <style:text-properties fo:font-size="11pt"/>
    </style:style>
  </office:styles>
</office:document-styles>`;

    this.zip.file('styles.xml', styles);
  }

  private addContent(content: string, options: OdtExportOptions): void {
    // Convert markdown-like content to ODT XML
    const bodyContent = this.markdownToOdtContent(content);

    let coverPage = '';
    if (options.includeCoverPage && options.title) {
      coverPage = this.generateCoverPage(options);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                         xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
                         xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
                         xmlns:xlink="http://www.w3.org/1999/xlink"
                         xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0">
  <office:body>
    <office:text>
${coverPage}
${bodyContent}
    </office:text>
  </office:body>
</office:document-content>`;

    this.zip.file('content.xml', xml);
  }

  private generateCoverPage(options: OdtExportOptions): string {
    let content = '';

    if (options.title) {
      content += `      <text:p text:style-name="Title">${this.escapeXml(options.title)}</text:p>\n`;
    }

    if (options.subtitle) {
      content += `      <text:p text:style-name="Subtitle">${this.escapeXml(options.subtitle)}</text:p>\n`;
    }

    // Page break after cover
    content += `      <text:p text:style-name="Standard"><text:soft-page-break/></text:p>\n`;

    return content;
  }

  private markdownToOdtContent(markdown: string): string {
    // Simple markdown to ODT conversion
    const lines = markdown.split('\n');
    let result = '';

    for (const line of lines) {
      if (line.startsWith('## ')) {
        result += `      <text:p text:style-name="Heading1">${this.escapeXml(line.slice(3))}</text:p>\n`;
      } else if (line.startsWith('### ')) {
        result += `      <text:p text:style-name="Heading2">${this.escapeXml(line.slice(4))}</text:p>\n`;
      } else if (line.trim()) {
        result += `      <text:p text:style-name="Standard">${this.escapeXml(line)}</text:p>\n`;
      } else {
        result += `      <text:p text:style-name="Standard"/>\n`;
      }
    }

    return result;
  }

  private addImage(image: { data: string; width: number; height: number }): void {
    // Add base64 image to Pictures folder
    const base64Data = image.data.replace(/^data:image\/png;base64,/, '');
    this.zip.file('Pictures/chart.png', base64Data, { base64: true });
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
```

---

## Implementation Plan

### Phase 1: Core ODT Generation

1. Create `OdtGenerator` class in `src/reports/services/odt-generator.ts`
2. Implement basic XML generation (mimetype, manifest, styles, content)
3. Add markdown-to-ODT content conversion
4. Test with simple text output

### Phase 2: Report Generator Integration

1. Add "ODT" option to output format selector in Report Generator modal
2. Wire up ODT generation to report output pipeline
3. Generate ODT from report markdown content
4. Add cover page support using existing cover page options

### Phase 3: Rich Content Support

1. Add support for tables (common in reports)
2. Add support for lists (bullet points, numbered)
3. Add support for bold/italic text
4. Handle wikilinks (convert to plain text or hyperlinks)

### Phase 4: Image Embedding

1. Add image embedding capability for visual tree reports
2. Coordinate with Family Chart Export Modal ODT export
3. Test image placement and sizing

### Phase 5: Polish & Testing

1. Test with LibreOffice Writer
2. Test with Microsoft Word
3. Test with Google Docs (via upload)
4. Validate document merging workflow
5. Handle edge cases (very large reports, many images)

---

## File Locations

- **ODT Generator:** `src/reports/services/odt-generator.ts`
- **Report Generator Modal:** `src/reports/modals/report-generator-modal.ts`
- **Export type definitions:** `src/reports/types.ts`

---

## Report Types Supporting ODT

All existing report types should support ODT export:

**Genealogical Reports:**
- Ancestor Report
- Descendant Report
- Family Group Sheet
- Pedigree Summary

**Relationship Reports:**
- Relationship Analysis

**Geographic Reports:**
- Geographic Distribution

**Statistical Reports:**
- Data Quality Summary
- Statistical Overview

**Visual Tree Reports:**
- Ancestor Tree
- Descendant Tree
- Hourglass Tree
- Fan Chart

---

## Success Criteria

### Phase 1-2: Basic ODT Export
- [ ] ODT option appears in Report Generator output format selector
- [ ] Basic text reports export as valid ODT files
- [ ] ODT files open in LibreOffice Writer without errors
- [ ] ODT files open in Microsoft Word without errors
- [ ] Cover page renders correctly when enabled

### Phase 3: Rich Content
- [ ] Tables render correctly in ODT output
- [ ] Lists (bullet and numbered) render correctly
- [ ] Bold and italic text preserved
- [ ] Wikilinks handled gracefully

### Phase 4: Images
- [ ] Visual tree reports can embed chart images
- [ ] Image sizing is appropriate for page
- [ ] Images display correctly in word processors

### Phase 5: Workflow Validation
- [ ] User can export Descendant Report as ODT
- [ ] User can export visual tree as ODT (from Family Chart)
- [ ] User can merge the two documents in LibreOffice/Word
- [ ] Merged document retains formatting from both sources

---

## Considerations

### Limitations

- **No live links:** Wikilinks converted to plain text (no clickable links within Obsidian)
- **Simplified styling:** Basic styles only; complex formatting may not transfer perfectly
- **Image placement:** Images placed inline; complex layouts not supported

### Future Enhancements

- **Template support:** Allow users to provide custom ODT templates
- **Style customization:** User-configurable fonts, colors, spacing
- **Table of contents:** Auto-generated TOC for long reports
- **DOCX export:** Similar approach could support Word's native format

---

## See Also

- [Family Chart Export Modal](family-chart-export-modal.md) — Phase 6 ODT export for visual charts
- [Report Wizard Enhancements](report-wizard-enhancements.md) — Related UX improvements
- [Statistics and Reports wiki](../../wiki-content/Statistics-And-Reports.md) — User documentation
