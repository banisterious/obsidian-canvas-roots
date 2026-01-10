# Report Wizard Enhancements

Planning document for enhancing the report generator with additional customization options and a wizard-based UI.

- **Status:** ✅ Complete (Phase 1-2)
- **Priority:** Medium
- **GitHub Issue:** #TBD
- **Created:** 2025-12-20
- **Completed:** 2025-12-24

> **Note:** This document has been archived. See [Release History](../../wiki-content/Release-History.md#report-wizard-enhancements-v016x) for the summary. Phases 1-2 (two-step wizard, ODT export) are complete. Phases 3+ (presets, advanced PDF options) remain for future work.

---

## Overview

The Report Generator modal has grown significantly with the Extended Report Types release (v0.13.5). It now handles 13 report types across 5 categories, plus extensive PDF customization options. This planning document explores:

1. **Additional customization options** for PDF and Markdown output
2. **Wizard-based UI** to manage complexity and improve user experience
3. **Architecture considerations** for maintainability

---

## Current State

### Modal Complexity

The current `ReportGeneratorModal` manages:

| Area | Elements |
|------|----------|
| **Report Selection** | 13 report types, 5 category filters |
| **Subject Selection** | Person picker, place picker, universe picker, collection picker |
| **Report Options** | Generation limits, inclusion toggles (spouses, sources, details) |
| **Output Selection** | Save to vault, Download as MD, Download as PDF |
| **PDF Options** | Page size, date format, cover page toggle, logo upload, custom title, title scope, custom subtitle, cover notes |

This is approximately 20+ configurable options spread across a single scrollable modal.

### Pain Points

1. **Overwhelming for new users** — Too many options visible at once
2. **Cognitive load** — Hard to understand which options apply to which output format
3. **Progressive disclosure lacking** — PDF-only options shown even when MD selected
4. **Discoverability** — Advanced options may be missed
5. **Scalability** — Adding more options will compound these issues

---

## Proposed Customization Options

### PDF Export Options

#### Header & Footer Customization

| Option | Description | Default |
|--------|-------------|---------|
| **Show header** | Toggle header visibility | On |
| **Show footer** | Toggle footer visibility | On |
| **Header alignment** | Title position: left, center, right | Left |
| **Header margin** | Space above content (10-40pt) | 20pt |
| **Footer margin** | Space below content (10-40pt) | 10pt |

**Note:** Removing header/footer entirely may reduce report professionalism, but some users may want clean pages for further editing. Consider keeping this but with a warning.

#### Visual Styling

| Option | Description | Default |
|--------|-------------|---------|
| **Accent color** | Color for headers, lines, highlights | #4a90d9 |
| **Header border** | None, underline, box | Underline |
| **Footer border** | None, overline, box | None |
| **Section dividers** | Style for section separators | Single line |

#### Watermark & Branding

| Option | Description | Default |
|--------|-------------|---------|
| **Watermark text** | Diagonal text across pages (e.g., "DRAFT", "CONFIDENTIAL") | None |
| **Watermark opacity** | Transparency (10-50%) | 20% |
| **Custom footer graphic** | Small image in footer (e.g., family crest) | None |
| **Charted Roots branding** | Show "Charted Roots for Obsidian" on cover | On |

#### Typography

| Option | Description | Default |
|--------|-------------|---------|
| **Font style** | Serif, Sans-serif | Serif |
| **Base font size** | 9, 10, 11, 12pt | 10pt |

### Markdown Export Options

Currently, Markdown output has no customization. Proposed additions:

| Option | Description | Default |
|--------|-------------|---------|
| **Date format** | MDY, DMY, YMD for dates in content | MDY |
| **Custom title** | Override default report title | None |
| **Custom subtitle** | Additional subtitle line | None |
| **Introductory notes** | Text block after title (equivalent to PDF cover notes) | None |
| **Include metadata block** | YAML frontmatter with report info | Off |

### ODT Export Options

ODT (OpenDocument Text) provides an editable document format that can be opened in LibreOffice Writer, Microsoft Word, and other word processors. This enables users to:
- Merge family reports with narrative text
- Apply custom formatting and styling
- Create professional family history books
- Share documents with non-technical family members

| Option | Description | Default |
|--------|-------------|---------|
| **Include cover page** | Title page with report info | On |
| **Include table of contents** | Auto-generated TOC | On |
| **Date format** | MDY, DMY, YMD for dates in content | MDY |
| **Custom title** | Override default report title | None |
| **Custom subtitle** | Additional subtitle line | None |
| **Introductory notes** | Text block after title | None |

**Implementation Notes:**
- Uses JSZip for creating the ODT ZIP archive (same as Family Chart export)
- Manual XML generation for content.xml, styles.xml, meta.xml, manifest.xml
- Same approach as `src/ui/views/odt-generator.ts` but extended for multi-page text content
- Supports embedded images (logo, any media references) in Pictures/ folder

### Save to Vault Options

Same as Markdown export, plus:

| Option | Description | Default |
|--------|-------------|---------|
| **Output folder** | Where to save (existing) | Reports/ |
| **Filename template** | Pattern for filename | {type}-{subject}-{date} |

---

## Wizard UI Design

### Design Inspiration: Family Chart Export Wizard

The Report Wizard follows the same two-step pattern as the Family Chart Export wizard (`src/ui/views/family-chart-export-wizard.ts`):

| Family Chart Export | Report Generator |
|---------------------|------------------|
| Step 1: Quick Export | Step 1: Quick Generate |
| Step 2: Customize | Step 2: Customize |

This provides consistency across the plugin and a familiar UX pattern.

### Two-Step Wizard Structure

#### Step 1: Quick Generate

The primary screen where most users complete their task. Contains:

1. **Report Type Selection** — Tile-based category picker with expandable report types
2. **Subject Selection** — Person/place/universe picker (varies by report type)
3. **Output Format** — Format tiles (Vault, PDF, ODT, MD)
4. **Filename** — Editable filename with format extension

```
┌─────────────────────────────────────────────────────────┐
│  Generate Report                                        │
├─────────────────────────────────────────────────────────┤
│  ① ─── ②   Step 1 of 2: Quick Generate                 │
│                                                         │
│  REPORT TYPE                                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ 📋 Genealo- │ │ 📊 Statis-  │ │ 🌳 Visual   │       │
│  │ gical (4)   │ │ tical (3)   │ │ Trees (4)   │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│  ┌─────────────┐ ┌─────────────┐                       │
│  │ 🔗 Relation-│ │ 🌍 Place    │  ← Single-report     │
│  │ ship Finder │ │ Summary     │    categories go      │
│  └─────────────┘ └─────────────┘    directly to report │
│                                                         │
│  ▼ Genealogical Reports (expanded)                     │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────┐│
│  │Ahnentafel │ │Descendant │ │Family Grp │ │Pedigree ││
│  │           │ │Report     │ │Sheet      │ │Chart    ││
│  └───────────┘ └───────────┘ └───────────┘ └─────────┘│
│  ─────────────────────────────────────────────────────  │
│  SUBJECT                                                │
│  [👤 Select a person...]                               │
│  ─────────────────────────────────────────────────────  │
│  FORMAT                                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│  │ Vault  │ │  PDF   │ │  ODT   │ │   MD   │          │
│  └────────┘ └────────┘ └────────┘ └────────┘          │
│  ─────────────────────────────────────────────────────  │
│  FILENAME                                               │
│  [family-group-sheet-john-smith-2025-12-24    ] .pdf   │
│                                                         │
│                    [Cancel]  [Customize →]  [Generate] │
└─────────────────────────────────────────────────────────┘
```

**Key behaviors:**
- Clicking a multi-report category (Genealogical, Statistical, Visual) expands to show report type tiles
- Clicking a single-report category (Relationship Finder, Place Summary) selects that report directly
- Subject picker adapts to report type (person, place, universe, collection, or none)
- "Generate" button available immediately once required fields are filled
- "Customize →" advances to Step 2 for power users

#### Step 2: Customize

Advanced options for power users. Contains:

1. **Content Options** — Report-specific toggles (spouses, sources, details, generations)
2. **Format-Specific Options** — Conditional on selected format:
   - **PDF:** Page size, cover page, logo, accent color, header/footer
   - **ODT:** Cover page, table of contents
   - **Vault:** Output folder

```
┌─────────────────────────────────────────────────────────┐
│  Generate Report                                        │
├─────────────────────────────────────────────────────────┤
│  ① ─── ②   Step 2 of 2: Customize                      │
│                                                         │
│  CONTENT OPTIONS                                        │
│  ┌─────────────────────────────────────────────────────┐│
│  │ ○ Include spouses    ○ Include sources             ││
│  │ ○ Include details    Generations: [5 ▼]            ││
│  └─────────────────────────────────────────────────────┘│
│  ─────────────────────────────────────────────────────  │
│  PDF OPTIONS                                            │
│  Page size: [A4 ▼]                                     │
│  ☑ Include cover page                                  │
│    Title: [Family Group Sheet: John Smith         ]    │
│    Subtitle: [                                    ]    │
│  ─────────────────────────────────────────────────────  │
│  ▶ Advanced Styling (collapsed)                        │
│  ─────────────────────────────────────────────────────  │
│  ESTIMATE                                               │
│  People: 45  |  Est. size: ~120KB                      │
│                                                         │
│                         [← Back]              [Generate]│
└─────────────────────────────────────────────────────────┘
```

**Key behaviors:**
- Shows only options relevant to selected format
- Advanced styling collapsed by default (accent color, watermark, etc.)
- "Back" returns to Step 1 with all selections preserved
- Estimate panel shows scope (like Family Chart Export wizard)

### Category and Report Type Tiles

**Categories (5 tiles):**

| Category | Icon | Reports | Behavior |
|----------|------|---------|----------|
| Genealogical | 📋 | 4 | Expands to show tiles |
| Statistical | 📊 | 3 | Expands to show tiles |
| Visual Trees | 🌳 | 4 | Expands to show tiles |
| Relationship Finder | 🔗 | 1 | Direct selection |
| Place Summary | 🌍 | 1 | Direct selection |

**Report Types by Category:**

| Genealogical | Statistical | Visual Trees |
|--------------|-------------|--------------|
| Ahnentafel | Data Quality | Pedigree Tree |
| Descendant Report | Gaps Report | Descendant Tree |
| Family Group Sheet | Timeline | Hourglass Tree |
| Pedigree Chart | | Fan Chart |

### Footer Layout

Matches Family Chart Export wizard pattern:

- **Step 1:** `[Cancel]` on left, `[Customize →]` + `[Generate]` on right
- **Step 2:** `[← Back]` on left, `[Generate]` on right

### UI Flexibility Note

The tile-based approach for report type selection can be swapped for a dropdown if testing reveals scrolling issues. The underlying wizard structure (two steps, state management, navigation) remains the same regardless of selection UI.

### Future: Presets (Phase 3)

After the core wizard is implemented, add preset support:

```
┌─────────────────────────────────────────────────────────┐
│  PRESETS                                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ ⚡ Quick    │ │ 📄 Full     │ │ 🖨️ Print    │       │
│  │ Share      │ │ Ancestry    │ │ Ready       │       │
│  │ MD·minimal │ │ PDF·5 gen   │ │ PDF·cover   │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                         │
│  ──────────────── or ────────────────                  │
│                                                         │
│  [+ New Report]                                        │
└─────────────────────────────────────────────────────────┘
```

Presets appear above the report type selection. Clicking a preset pre-fills all options and prompts only for subject selection.

---

## Implementation Architecture

### State Management

State is organized by the two-step structure:

```typescript
interface ReportWizardState {
  // Step 1: Quick Generate
  reportType: ReportType | null;
  selectedCategory: ReportCategory | null;  // For UI state
  subject: {
    personCrId?: string;
    personName?: string;
    placeCrId?: string;
    placeName?: string;
    universeCrId?: string;
    collectionId?: string;
  };
  outputMethod: 'vault' | 'download-md' | 'download-pdf' | 'download-odt';
  filename: string;

  // Step 2: Customize
  contentOptions: {
    includeSpouses: boolean;
    includeSources: boolean;
    includeDetails: boolean;
    includeChildren: boolean;
    maxGenerations: number;
    // ... report-specific options
  };
  pdfOptions: PdfOptions;
  odtOptions: OdtOptions;
  vaultOptions: {
    outputFolder: string;
  };
}
```

### Component Structure

```
src/reports/ui/
├── report-wizard-modal.ts         # New wizard modal (replaces report-generator-modal.ts)
├── wizard/
│   ├── steps/
│   │   ├── QuickGenerateStep.ts   # Step 1: Report type, subject, format, filename
│   │   └── CustomizeStep.ts       # Step 2: Content options, format-specific options
│   ├── components/
│   │   ├── StepIndicator.ts       # Progress dots (① ─── ②)
│   │   ├── CategoryTile.ts        # Clickable category card
│   │   ├── ReportTypeTile.ts      # Clickable report type card
│   │   ├── FormatTile.ts          # Output format selection card
│   │   └── EstimatePanel.ts       # People count, file size estimate
│   └── presets/                   # Phase 3
│       └── PresetCards.ts         # Preset selection UI
├── report-generator-modal.ts      # Legacy modal (deprecated, kept for compatibility)
```

### Backward Compatibility

- Existing command palette command continues to work
- API for programmatic report generation unchanged
- Settings migration for saved preferences
- Legacy `ReportGeneratorModal` remains available during transition

---

## Phased Implementation

### Phase 1: Two-Step Wizard Foundation
- Create new `ReportWizardModal` class
- Implement step navigation (step indicator, back/next/cancel)
- Step 1: Category tiles, report type tiles, subject picker, format tiles, filename
- Step 2: Content options, format-specific options
- Footer layout matching Family Chart Export wizard
- Wire up report generation with existing services

### Phase 2: Polish & Estimate
- Add estimate panel (people count, file size)
- Remember last-used settings per report type
- Smooth transitions between steps
- Keyboard navigation support

### Phase 3: Preset System
- Preset data model and storage
- "Save as Preset" button in Step 2
- Preset cards at top of Step 1
- Preset management (edit, duplicate, delete)
- Optional: Built-in starter presets

### Phase 4: Enhanced PDF Options
- Header/footer visibility toggle and customization
- Header alignment options
- Accent colors
- Watermark support
- Font size option

### Phase 5: Enhanced Markdown Options
- Date format for MD output
- Custom title/subtitle for MD
- Introductory notes
- Metadata block option

### Phase 6: ODT Export
- Add ODT as fourth output method (alongside Vault / MD / PDF)
- Implement ODT generation using JSZip + manual XML (same approach as Family Chart)
- Support all common options: custom title, subtitle, introductory notes
- Include document structure: cover page (optional), table of contents, report content
- Embed any images (logos, media references) as Pictures/
- Benefits: Editable in LibreOffice/Word, mergeable with other documents

### Phase 7: Advanced Features
- Filename templates for vault saves
- Header/footer graphics
- Preset export/import for sharing

---

## Preset System

Presets allow users to save named configurations for common report workflows. This reduces repetitive configuration and enables one-click generation for frequently used report styles.

### Preset Data Model

```typescript
interface ReportPreset {
  id: string;                    // UUID
  name: string;                  // User-defined name
  description?: string;          // Optional description
  createdAt: number;             // Timestamp
  updatedAt: number;             // Timestamp

  // What the preset configures
  reportType: ReportType;        // Required - which report

  // Content options (report-specific)
  contentOptions: {
    includeSpouses?: boolean;
    includeSources?: boolean;
    includeDetails?: boolean;
    maxGenerations?: number;
    // ... other report-specific options
  };

  // Output configuration
  outputMethod: 'vault' | 'download-md' | 'download-pdf' | 'download-odt';

  // Common options (all formats)
  commonOptions: {
    dateFormat: 'mdy' | 'dmy' | 'ymd';
    customTitle?: string;
    customSubtitle?: string;
    introductoryNotes?: string;
  };

  // PDF-specific options (only if outputMethod is 'download-pdf')
  pdfOptions?: {
    pageSize: 'A4' | 'LETTER';
    includeCoverPage: boolean;
    logoDataUrl?: string;
    accentColor?: string;
    showHeader?: boolean;
    showFooter?: boolean;
    headerAlignment?: 'left' | 'center' | 'right';
    watermarkText?: string;
    watermarkOpacity?: number;
    fontSize?: number;
  };

  // ODT-specific options (only if outputMethod is 'download-odt')
  odtOptions?: {
    includeCoverPage: boolean;
    includeTableOfContents: boolean;
  };

  // Vault-specific options (only if outputMethod is 'vault')
  vaultOptions?: {
    outputFolder: string;
    filenameTemplate: string;
    includeMetadataBlock: boolean;
  };
}
```

### Preset Management UI

**In the Quick Generate view:**
- Preset cards with name and icon
- Click to generate with preset (prompts for subject if needed)
- Right-click or overflow menu for: Edit, Duplicate, Delete, Export

**Preset Editor:**
- Opens as step 4 of wizard with "Save as Preset" button
- Or dedicated modal accessed from preset context menu
- Name and description fields
- All options from the wizard pre-filled

### Built-in Presets (Optional)

Consider shipping a few default presets as examples:

| Preset | Description |
|--------|-------------|
| **Family Archive** | PDF with cover page, serif font, full details |
| **Quick Share** | MD download, minimal options, no sources |
| **Research Draft** | Vault save, includes sources, no styling |
| **Editable Document** | ODT with cover page and TOC, ready for further editing |

Users could modify or delete these.

### Storage

Presets stored in plugin settings:

```typescript
interface CanvasRootsSettings {
  // ... existing settings
  reportPresets: ReportPreset[];
  recentReports: RecentReportEntry[];  // Last 5 generated
}

interface RecentReportEntry {
  reportType: ReportType;
  subjectName: string;
  subjectCrId: string;
  outputMethod: string;
  generatedAt: number;
  // Snapshot of options used (for "Edit" action)
  options: Partial<ReportWizardState>;
}
```

### Preset Workflows

**Creating a preset:**
1. User completes wizard steps 1-4
2. Before generating, clicks "Save as Preset"
3. Enters preset name and optional description
4. Preset saved; report generates

**Using a preset:**
1. User opens Report Generator
2. Clicks a preset card
3. If report requires a subject (person/place/etc.):
   - Mini subject picker appears
   - User selects subject
4. Report generates immediately

**Editing a preset:**
1. Right-click preset → "Edit"
2. Opens wizard with preset values pre-filled
3. User modifies options
4. Clicks "Update Preset"

---

## Open Questions

1. **Tile vs dropdown:** If tile-based report selection causes scrolling issues, should we switch to a dropdown? (Note: UI is designed to be swappable.)

2. **Mobile experience:** Obsidian mobile has limited screen space. Should wizard adapt to smaller screens?

3. **Accessibility:** How to ensure keyboard navigation works well across steps?

4. **Validation timing:** Validate per-step or only on generate? Per-step prevents forward navigation issues but adds friction.

5. **Preset sharing:** Should presets be exportable/importable for sharing between vaults or users?

---

## Alternatives Considered

### Tabbed Modal (Not Recommended)

```
┌─────────────────────────────────────────────────────────┐
│  Generate Report                                        │
├───────────┬───────────┬───────────┬───────────┬────────┤
│  Report   │  Subject  │  Options  │  Output   │  PDF   │
├───────────┴───────────┴───────────┴───────────┴────────┤
│                                                         │
│  [Tab content here]                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Why not:**
- Tabs don't enforce order
- Users might miss required tabs
- PDF tab would be empty for MD output
- Doesn't solve discoverability

### Collapsible Sections (Partially Viable)

Could be used within wizard steps for advanced options:

```
Step 4: Output & Styling
├─ Output Method: [PDF ▼]
├─ Page Size: [A4 ▼]
├─ Cover Page: [✓]
└─ ▶ Advanced Styling Options
   ├─ Accent Color: [#4a90d9]
   ├─ Header Alignment: [Left ▼]
   └─ Watermark: [None]
```

This could be combined with the wizard for advanced options.

---

## Related Documents

- [Extended Report Types](archive/extended-report-types.md) — Current report types
- [PDF Report Export](pdf-report-export.md) — PDF infrastructure
- [Statistics and Reports](../../wiki-content/Statistics-And-Reports.md) — User documentation

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-20 | Created planning document | Modal complexity requires structured approach |
| 2025-12-20 | Hybrid wizard + quick generate approach | Best of both worlds: power users get speed, new users get guidance |
| 2025-12-20 | Include preset system | Valuable for reducing repetitive configuration in common workflows |
| 2025-12-20 | 6-phase implementation plan | Allows incremental delivery with foundation first |
| 2025-12-23 | Added Phase 6: ODT Export | Editable document format enables merging with narrative text; uses same JSZip approach as Family Chart ODT export |
| 2025-12-23 | Renumbered Advanced Features to Phase 7 | ODT export is higher priority than advanced features |
| 2025-12-24 | Redesigned as two-step wizard | Align with Family Chart Export wizard pattern; reduces from 4 steps to 2 for faster workflow |
| 2025-12-24 | Tile-based report type selection | Visual consistency with export wizard; can swap to dropdown if scrolling becomes an issue |
| 2025-12-24 | Category expansion for multi-report categories | Single-report categories (Relationship Finder, Place Summary) select directly; multi-report categories expand to show tiles |
| | | |
