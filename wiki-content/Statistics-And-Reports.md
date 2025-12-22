# Statistics & Reports

Canvas Roots provides a comprehensive statistics dashboard and report generation system to help you understand your data and generate formatted genealogical reports.

---

## Table of Contents

- [Overview](#overview)
- [Statistics Dashboard](#statistics-dashboard)
  - [Opening the Dashboard](#opening-the-dashboard)
  - [Entity Overview](#entity-overview)
  - [Data Completeness](#data-completeness)
  - [Data Quality](#data-quality)
  - [Gender Distribution](#gender-distribution)
  - [Top Lists](#top-lists)
  - [Extended Statistics](#extended-statistics)
- [Reports](#reports)
  - [Report Types](#report-types)
  - [Generating Reports](#generating-reports)
  - [Report Options](#report-options)
- [Control Center Summary](#control-center-summary)

---

## Overview

The Statistics & Reports system provides:

- **Statistics Dashboard**: A dedicated workspace view with metrics, drill-down lists, and demographic analysis
- **Reports Generator**: Create formatted genealogical reports (Family Group Sheets, Pedigree Charts, etc.)
- **Control Center Summary**: Quick-glance metrics in the Statistics tab

The system uses a shared data layer ensuring consistency between dashboard metrics and generated reports.

---

## Statistics Dashboard

The Statistics Dashboard is a full-featured workspace view that provides detailed insights into your vault data.

### Opening the Dashboard

There are several ways to open the Statistics Dashboard:

1. **From Control Center**: Statistics tab → "Open Statistics Dashboard" button
2. **Command Palette**: "Canvas Roots: Open Statistics Dashboard"
3. **Ribbon icon**: Click the statistics icon in the left ribbon (if enabled)

The dashboard can be pinned alongside notes in split view and auto-refreshes when vault data changes.

### Entity Overview

The Entity Overview section displays counts for each entity type in your vault:

| Entity Type | Description |
|-------------|-------------|
| **People** | Total person notes |
| **Events** | Total event notes |
| **Sources** | Total source notes |
| **Places** | Total place notes |
| **Organizations** | Total organization notes |
| **Canvases** | Total canvas files |

Also shows the date range spanning all entities (earliest to latest dates).

### Data Completeness

Track how complete your research is with percentage metrics:

| Metric | Description |
|--------|-------------|
| **With birth date** | % of people with birth dates recorded |
| **With death date** | % of people with death dates recorded |
| **With sources** | % of people with at least one source citation |
| **With father** | % of people with father linked |
| **With mother** | % of people with mother linked |
| **With spouse** | % of people with spouse linked |

Progress bars are color-coded: green (80%+), yellow (50-79%), red (below 50%).

### Data Quality

The Data Quality section identifies issues in your data. Click any issue to expand and see the affected records.

| Issue Type | Severity | Description |
|------------|----------|-------------|
| **Date inconsistencies** | Error | People with birth after death, or age over 120 years |
| **Missing birth dates** | Warning | People without birth date recorded |
| **Missing death dates** | Warning | People with birth but no death (excluding living) |
| **Orphaned people** | Warning | People with no relationships (no parents, spouse, or children) |
| **Incomplete parents** | Warning | People with only one parent linked |
| **Unsourced events** | Info | Events without source citations |
| **Places without coordinates** | Info | Place notes missing latitude/longitude |

**Drill-down features:**
- Click an issue to expand and see affected records
- Click a person/file chip to open in new tab
- Right-click for context menu (open to right, new window)
- Ctrl+hover for preview popup

### Gender Distribution

Displays the breakdown of sex/gender values in your person notes:

- Male, Female, Other, Unknown counts with percentages
- Visual bar chart showing distribution

### Top Lists

Interactive lists showing the most common values, with drill-down to see matching people:

| List | Description |
|------|-------------|
| **Top Surnames** | Most common surnames with counts |
| **Top Locations** | Most referenced birth/death places |
| **Top Occupations** | Most common occupations |
| **Top Sources** | Most frequently cited sources |

Click a row to expand and see all people matching that surname, location, or occupation. Click a person chip to open their note.

### Extended Statistics

Advanced demographic analysis for deeper research insights:

#### Longevity Analysis
- Average, median, min, and max lifespan across all people
- Lifespan trends by birth decade
- Lifespan by birth location

#### Family Size Patterns
- Average number of children per family
- Family size distribution (0, 1-2, 3-4, 5+ children)
- Trends by birth decade

#### Marriage Patterns
- Average age at first marriage by sex
- Remarriage rates and statistics

#### Migration Flows
- Migration rate (% who died in different location than birth)
- Top migration routes (from → to)
- Top destinations and origins

#### Source Coverage by Generation
- Coverage percentage by generation depth
- Average sources per person by generation

#### Timeline Density
- Events per decade visualization
- Gap detection (periods with unusually low activity)

---

## Reports

Generate formatted reports from your data. Reports are organized into categories for easy discovery.

### Report Categories

| Category | Reports |
|----------|---------|
| **Genealogical** | Ahnentafel, Pedigree Chart, Descendant Chart, Register Report, Family Group Sheet, Individual Summary |
| **Research** | Source Summary, Gaps Report, Media Inventory |
| **Timeline** | Timeline Report |
| **Geographic** | Place Summary |
| **Summary** | Universe Overview, Collection Overview |
| **Visual Trees** | Pedigree Tree PDF, Descendant Tree PDF, Hourglass Tree PDF, Fan Chart PDF |

### Visual Tree Reports

Generate printable PDF tree diagrams with positioned boxes and connecting lines.

| Report | Description |
|--------|-------------|
| **Pedigree Tree PDF** | Graphical ancestor tree with root at bottom, ancestors branching upward |
| **Descendant Tree PDF** | Graphical descendant tree with root at top, descendants branching downward |
| **Hourglass Tree PDF** | Both ancestors above and descendants below the root person |
| **Fan Chart PDF** | Semicircular pedigree with ancestors in radiating arcs |

Clicking any Visual Tree report opens the unified tree wizard, which guides you through:
1. Selecting a root person
2. Choosing tree type and generation limits
3. Selecting output format (PDF is pre-selected)
4. Configuring PDF options (page size, orientation, colors)
5. Generating and downloading the PDF

See [Canvas Trees](Canvas-Trees) for detailed wizard documentation.

### Genealogical Reports

| Report | Description |
|--------|-------------|
| **Family Group Sheet** | Single family unit with parents, marriage, and children |
| **Individual Summary** | Complete record of one person with all events and sources |
| **Ahnentafel Report** | Numbered ancestor list (1=subject, 2=father, 3=mother, etc.) |
| **Gaps Report** | Analysis of missing data by category |
| **Register Report** | Descendants with NGSQ-style numbering |
| **Pedigree Chart** | Ancestor tree in ASCII art format |
| **Descendant Chart** | Descendant tree in ASCII art format |

### Research Reports

| Report | Description |
|--------|-------------|
| **Source Summary** | All sources cited for a person, grouped by fact type with quality ratings and gap analysis |
| **Media Inventory** | Media files with linked entities, orphaned file detection, coverage gaps |

### Timeline Reports

| Report | Description |
|--------|-------------|
| **Timeline Report** | Chronological list of events with filtering by date range, event type, and participants |

### Geographic Reports

| Report | Description |
|--------|-------------|
| **Place Summary** | All events and people at a location (born, died, resided, married) with hierarchy display |

### Summary Reports

| Report | Description |
|--------|-------------|
| **Universe Overview** | Entity statistics for a fictional world with date ranges and breakdowns |
| **Collection Overview** | Summary of a user collection or family component with member list and statistics |

### Generating Reports

1. Open the Statistics Dashboard
2. Scroll to the "Reports" section
3. Click "Generate" on your desired report type
4. Configure options in the modal:
   - Select root person (for person-based reports)
   - Set maximum generations
   - Choose what details to include
   - Select output method (new note or clipboard)
5. Click "Generate"

### Report Options

Common options available for most reports:

| Option | Description |
|--------|-------------|
| **Root person** | The starting person for the report |
| **Maximum generations** | How many generations to include (2-10) |
| **Include details** | Show birth/death dates and places |
| **Include spouses** | Show spouse information |
| **Include sources** | Include source citations |
| **Output method** | Save to vault, Download as MD, or Download as PDF |
| **Output folder** | Where to save the generated note (vault only) |

### PDF Export

All report types can be exported as professionally styled PDF documents. PDFs are generated entirely locally—no internet connection required.

#### PDF Options

When "Download as PDF" is selected, additional options appear:

| Option | Description |
|--------|-------------|
| **Page size** | A4 or Letter |
| **Include cover page** | Add a title page with report name, subject, and generation date |
| **Logo or crest** | Optional image to display on the cover page (shown when cover page is enabled) |
| **Custom title** | Override the default report title |
| **Custom title scope** | Apply custom title to cover only, headers only, or both |
| **Custom subtitle** | Additional text below title on cover page |
| **Cover notes** | Extended notes section on cover page |
| **Date format** | MDY (12/20/2025), DMY (20/12/2025), or YMD (2025-12-20) |

#### Cover Page

The optional cover page includes:
- Report title (e.g., "Ahnentafel Report")
- Subject name (e.g., "Ancestors of John Smith")
- Decorative separator line
- Generation date
- "Canvas Roots for Obsidian" branding

If a logo is provided, it appears centered at the top of the cover page. Images are automatically resized to reduce PDF file size.

#### Privacy & Security

Genealogical data is highly personal. When you select "Download as PDF" or "Download as MD", a privacy message confirms:

- **100% local generation** — PDFs are created entirely on your device using the pdfmake library bundled with the plugin
- **No internet connection required** — No data is sent to any server or cloud service
- **No external dependencies** — Fonts are embedded; no network requests are made during generation
- **Downloads to your system** — Files save to your operating system's Downloads folder, outside your vault

This ensures your family data never leaves your computer during report generation.

---

## Control Center Summary

The Statistics tab in Control Center provides a quick overview:

- Entity counts at a glance
- Research completeness percentage
- Data quality warning indicators
- "Open Statistics Dashboard" button for full details

This summary is useful for quick health checks without opening the full dashboard.

---

## Related Documentation

- [Data Quality](Data-Quality) - Batch operations for fixing data issues
- [Evidence And Sources](Evidence-And-Sources) - Managing source citations
- [Events And Timelines](Events-And-Timelines) - Working with events
