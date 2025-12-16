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

Generate formatted genealogical reports from your data.

### Report Types

| Report | Description |
|--------|-------------|
| **Family Group Sheet** | Single family unit with parents, marriage, and children |
| **Individual Summary** | Complete record of one person with all events and sources |
| **Ahnentafel Report** | Numbered ancestor list (1=subject, 2=father, 3=mother, etc.) |
| **Gaps Report** | Analysis of missing data by category |
| **Register Report** | Descendants with NGSQ-style numbering |
| **Pedigree Chart** | Ancestor tree in ASCII art format |
| **Descendant Chart** | Descendant tree in ASCII art format |

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
| **Output method** | Create as note or copy to clipboard |
| **Output folder** | Where to save the generated note |

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
