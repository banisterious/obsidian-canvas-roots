# Statistics & Reports

## Overview

A unified statistics and reporting system with a shared data layer. The Statistics Dashboard provides at-a-glance metrics and monitoring, while Reports generate formatted output from the same underlying data. This architecture ensures consistency and avoids duplicate computation.

See [Roadmap: Statistics & Reports](../../wiki-content/Roadmap.md#statistics--reports) for the user-facing summary.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              StatisticsService                       │
│  (computes all metrics, caches results)             │
├─────────────────────────────────────────────────────┤
│  - entityCounts()      - qualityMetrics()           │
│  - completenessScores() - demographicAnalysis()     │
│  - topLists(category)   - sourceCoverage()          │
└─────────────────────────────────────────────────────┘
           │                          │
           ▼                          ▼
┌─────────────────────┐    ┌─────────────────────────┐
│  Statistics Tab     │    │  Reports Tab            │
│  (Control Center)   │    │  (Control Center)       │
│  + Workspace View   │    │  (formatted output)     │
└─────────────────────┘    └─────────────────────────┘
```

**Key Benefits:**
- Single source of truth for all metrics
- Dashboard provides immediate value and acts as "preview"
- Reports become formatted views of existing data
- Drill-down from dashboard metrics to detailed reports

---

## UI Architecture: Hybrid Approach

The system uses a **hybrid UI** that combines quick access in Control Center with deep exploration in a dedicated workspace view:

```
┌─────────────────────────────────────────────────────────────────┐
│  Control Center → Statistics Tab (Summary Card)                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 📊 Statistics Overview                                       ││
│  │                                                              ││
│  │  People: 1,247    Events: 3,891    Sources: 456              ││
│  │  Places: 892      Organizations: 23                          ││
│  │                                                              ││
│  │  Research Completeness: ████████░░ 78%                       ││
│  │  Source Coverage:       ██████░░░░ 62%                       ││
│  │                                                              ││
│  │  ⚠️ 45 missing vitals  •  23 unsourced facts                 ││
│  │                                                              ││
│  │  [ Open Statistics Dashboard ]                               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Opens
┌─────────────────────────────────────────────────────────────────┐
│  Workspace View → Statistics Dashboard (Full Detail)             │
│  - Expandable sections with drill-down                          │
│  - Interactive charts and visualizations                        │
│  - Direct links to reports and entity lists                     │
│  - Can be pinned alongside notes (split view)                   │
│  - Auto-refreshes as vault changes                              │
└─────────────────────────────────────────────────────────────────┘
```

**Why This Approach:**

| Aspect | Control Center Tab | Workspace View |
|--------|-------------------|----------------|
| **Purpose** | Quick health check | Deep exploration |
| **Persistence** | Modal (closes when done) | Pinnable (stays open) |
| **Refresh** | Manual | Auto-refresh on vault changes |
| **Detail level** | Summary metrics only | Full drill-down capability |
| **Workflow** | "Check stats, take action" | "Monitor while working" |

**Aligns with Obsidian Patterns:**
- Similar to Graph View: Status bar shows node count → Graph View shows full visualization
- Similar to Backlinks: Panel shows count → Dedicated view shows all links
- Control Center remains action-oriented; workspace view enables monitoring

---

## Statistics Dashboard

### Statistics Service

Core service that computes all metrics with caching and debounced refresh:

```typescript
interface StatisticsService {
  // Entity counts
  getEntityCounts(): EntityCounts;
  getEntityCountsByType(entityType: string): Map<string, number>;

  // Completeness
  getCompletenessScores(): CompletenessScores;
  getMissingVitals(): PersonNote[];

  // Quality metrics
  getUnsourcedFacts(): EventNote[];
  getOrphanEntities(): EntityNote[];
  getDuplicateCandidates(): DuplicatePair[];

  // Top lists
  getTopSurnames(limit?: number): SurnameCount[];
  getTopLocations(limit?: number): LocationCount[];
  getTopOccupations(limit?: number): OccupationCount[];
  getTopSources(limit?: number): SourceCount[];

  // Demographics (Phase 3)
  getGenderDistribution(): GenderDistribution;
  getAgeStatistics(): AgeStatistics;
  getMigrationPatterns(): MigrationPattern[];

  // Cache management
  invalidateCache(): void;
  getCacheAge(): number;
}
```

### Control Center Summary Card

Quick-glance metrics in the Statistics tab:

- Entity counts (people, events, sources, places, organizations)
- Research completeness % with progress bar
- Quick warning indicators (missing vitals, unsourced facts)
- "Open Statistics Dashboard" button → opens workspace view

### Workspace View Dashboard

Full statistics dashboard with drill-down capabilities:

**Entity Overview:**

| Statistic | Description |
|-----------|-------------|
| **Entity counts** | People, events, sources, places, organizations by type |
| **Completeness scores** | % of people with birth date, death date, at least one source |
| **Date range** | Earliest to latest dates across all entities |
| **Gender/sex breakdown** | Distribution with chart visualization |

**Top Lists:**

| Statistic | Description |
|-----------|-------------|
| **Top surnames** | Most common surnames with counts |
| **Top locations** | Most referenced places (birth, death, residence) |
| **Top occupations** | Most common occupations |
| **Top sources** | Most-cited sources |

**Quality Metrics:**

| Statistic | Description |
|-----------|-------------|
| **Unsourced facts** | Count of events without source citations |
| **Orphan entities** | Events/sources not linked to any person |
| **Missing vitals** | People missing birth or death dates |
| **Duplicate candidates** | Potential duplicates by name similarity |

**UI Features:**
- Summary cards at top (entity counts, completeness %)
- Expandable sections by category
- Charts for distributions (bar charts, pie charts)
- **Drill-down links**: Click any metric → opens filtered report or entity list
- Auto-refreshes when vault changes (debounced)
- Can be pinned alongside notes in split view

### Dashboard → Report Integration

The dashboard and reports share filtering and link directly:

| Dashboard Metric | Current Behavior | Future Report |
|------------------|------------------|---------------|
| Top surnames | Expands inline → shows people → click opens note | Surname Report |
| Top locations | Expands inline → shows people → click opens note | Place Report |
| Top occupations | Expands inline → shows people → click opens note | — |
| Top sources | Click → opens source note directly | Source Bibliography |
| Reports section | Click report type → opens generator modal | — |

**Current Flow (Implemented):**
1. Dashboard shows "Top Surnames: Smith (45)"
2. Click → Expands inline to show all 45 people as clickable chips
3. Click person → Opens their note in new tab

**Future Enhancement:**
- Quality alerts could link to filtered Gaps Report
- Extended statistics could link to demographic reports

---

## Reports

### Report Types by Persona

#### Genealogy Reports

| Report | Description | Data Required | Priority |
|--------|-------------|---------------|----------|
| **Family Group Sheet** | Single family unit: couple + children with dates, places, sources | Person notes, relationships | v1 |
| **Individual Summary** | All known facts for one person with source citations | Person, events, sources | v1 |
| **Ahnentafel Report** | Numbered ancestor list (1=subject, 2=father, 3=mother, etc.) | Person notes, relationships | v1 |
| **Register Report** | Descendants with genealogical numbering (NGSQ style) | Person notes, relationships | v2 |
| **Pedigree Chart** | Ancestor tree, 4-5 generations per page | Person notes, relationships | v2 |
| **Descendant Chart** | All descendants of an ancestor | Person notes, relationships | v2 |
| **Hourglass Chart** | Ancestors + descendants from a focal person | Person notes, relationships | Future |
| **Fan Chart** | Circular ancestor display | Person notes, relationships | Future |
| **Surname Report** | All people sharing a surname | Person notes | Future |
| **Place Report** | All events/people at a location | Events, places | Future |
| **Gaps Report** | Missing vital records by generation | Person notes | v1 |

#### Creative Writing Reports

| Report | Description | Data Required | Priority |
|--------|-------------|---------------|----------|
| **Character Arc** | Single character's journey: events, relationships formed/lost | Person, events | v2 |
| **Scene Outline** | Events organized by chapter/book with POV, setting, participants | Events with book/chapter | v2 |
| **POV Coverage** | Which events are witnessed by which POV characters | Events with POV field | v2 |
| **Subplot Timeline** | Events filtered by group tag with arc status and intersections | Events with groups | v2 |
| **Appearances by Book** | Character presence across volumes in a series | Events with book field | v2 |

#### Worldbuilding Reports

| Report | Description | Data Required | Priority |
|--------|-------------|---------------|----------|
| **Character Sheet** | Single character with relationships, events, affiliations | Person, events, orgs | v2 |
| **Cast List** | All characters filtered by universe/collection/faction | Person notes, collections | v2 |
| **Organization Roster** | Members of a faction/guild/house with roles and dates | Org notes, memberships | v2 |
| **Faction Timeline** | Events filtered by group tag | Events with groups | v2 |
| **Age Audit** | Characters' ages at key story dates (catch anachronisms) | Person birth dates, events | v2 |
| **Lifespan Overlap** | Which characters could have met? Matrix of overlapping lifetimes | Person birth/death dates | v2 |

#### Historian Reports

| Report | Description | Data Required | Priority |
|--------|-------------|---------------|----------|
| **Source Bibliography** | All sources with full citations, grouped by type | Source notes | v2 |
| **Evidence Matrix** | Facts vs. sources grid showing which sources support which claims | Events, sources | v2 |
| **Cohort Analysis** | People sharing characteristics (occupation, location, time period) | Person notes | Future |
| **Prosopography** | Collective biography of a defined group | Person notes, collections | Future |

#### Research Reports

| Report | Description | Data Required | Priority |
|--------|-------------|---------------|----------|
| **Research Log** | Sources consulted, findings, next steps | Sources, proof summaries | Future |
| **Conflicting Evidence** | Facts with contradictory sources | Events, sources | Future |

---

### Data Model Considerations

#### Existing Fields (No Changes Needed)

These reports work with the current data model:

- Family Group Sheet, Individual Summary, Ahnentafel, Register, Pedigree, Descendant
- Character Sheet, Cast List, Organization Roster, Faction Timeline
- Age Audit, Lifespan Overlap
- Source Bibliography, Evidence Matrix
- Character Arc (uses events filtered by person)
- Subplot Timeline (uses `groups` field on events)

#### Optional Schema Extensions

These fields would enhance certain reports but are not required:

| Field | On Entity | Used By | Notes |
|-------|-----------|---------|-------|
| `book` | Event | Scene Outline, Appearances by Book | Book/volume identifier |
| `chapter` | Event | Scene Outline | Chapter number or name |
| `pov_character` | Event | POV Coverage | Which character "sees" this event |
| `arc_status` | Group/Event | Subplot Timeline | setup / rising / climax / resolution |

Users who don't need these reports don't need these fields. Reports gracefully degrade when fields are absent.

---

### Report Output Examples

#### Family Group Sheet

```markdown
# Smith-Jones Family

## Parents

### John Robert Smith (1888-1952)
- **Born:** 15 May 1888, [[Dublin, Ireland]]
- **Died:** 20 Aug 1952, [[Boston, Massachusetts]]
- **Occupation:** Carpenter
- **Sources:** [[1888 Birth Certificate]], [[1920 Census]]

### Mary Elizabeth Jones (1892-1975)
- **Born:** 3 Mar 1892, [[Cork, Ireland]]
- **Died:** 12 Nov 1975, [[Boston, Massachusetts]]
- **Sources:** [[1892 Birth Certificate]]

## Marriage
- **Date:** 14 Jun 1912
- **Place:** [[St. Patrick's Church, Dublin]]
- **Sources:** [[1912 Marriage Record]]

## Children

| # | Name | Born | Died | Spouse |
|---|------|------|------|--------|
| 1 | [[Thomas John Smith]] | 1913 | 1985 | [[Sarah Williams]] |
| 2 | [[Margaret Mary Smith]] | 1915 | 2001 | [[Patrick O'Brien]] |
| 3 | [[William James Smith]] | 1918 | 1944 | — |

---
*Generated by Charted Roots on 2025-12-09*
```

#### Character Arc Report

```markdown
# Character Arc: Frodo Baggins

## Summary
- **First appearance:** TA 3001 (Bilbo's Birthday Party)
- **Last appearance:** TA 3021 (Departs to Valinor)
- **Arc span:** 20 years
- **Total events:** 47

## Key Relationships

### Formed
| Character | Relationship | First Event |
|-----------|--------------|-------------|
| [[Sam]] | companion | TA 3018 - [[Leaves the Shire]] |
| [[Gollum]] | captor/guide | TA 3019 - [[Captured by Gollum]] |

### Changed/Lost
| Character | Relationship | Event |
|-----------|--------------|-------|
| [[Gandalf]] | mentor | TA 3019 - [[Falls in Moria]] |
| [[Bilbo]] | uncle | TA 3021 - [[Departs together]] |

## Timeline

### TA 3001
- [[Bilbo's Birthday Party]] - Inherits Bag End and the Ring

### TA 3018
- [[Leaves the Shire]] - Begins journey with Sam, Merry, Pippin
- [[Council of Elrond]] - Volunteers to bear the Ring

### TA 3019
- [[Fellowship departs Rivendell]]
- [[Falls in Moria]] - Witnesses Gandalf's fall
- [[Breaking of the Fellowship]] - Departs alone with Sam
...

## Arc Analysis
- **Events by type:** 12 plot_point, 8 residence, 15 anecdote
- **Locations visited:** Shire → Rivendell → Moria → Lothlórien → ...
- **Affiliations:** Fellowship (TA 3018-3019), Ring-bearer

---
*Generated by Charted Roots on 2025-12-09*
```

#### Subplot Timeline Report

```markdown
# Subplot: Ring Quest

**Arc Status:** Resolved
**Date Range:** TA 3001 - TA 3019

## Timeline

| Date | Event | Characters | Status |
|------|-------|------------|--------|
| TA 3001 | [[Frodo receives the Ring]] | Frodo, Gandalf | Setup |
| TA 3018 | [[Council of Elrond]] | Frodo, Gandalf, Aragorn, Legolas, Gimli, Boromir | Rising |
| TA 3019 | [[Breaking of the Fellowship]] | All Fellowship | Rising |
| TA 3019 | [[Ring destroyed]] | Frodo, Sam, Gollum | Climax/Resolution |

## Intersecting Subplots
- **Shire** (3 shared events)
- **Gondor Succession** (2 shared events)
- **Rohan Defense** (1 shared event)

## Characters Involved
- [[Frodo Baggins]] (15 events)
- [[Samwise Gamgee]] (12 events)
- [[Gandalf]] (8 events)
- [[Gollum]] (6 events)

---
*Generated by Charted Roots on 2025-12-09*
```

---

### Output Formats

#### Markdown (Primary)

- Standard output format
- Contains wikilinks for Obsidian integration
- Embeddable in other notes
- Searchable and linkable

#### PDF (via Browser Print)

- Reports include print-optimized CSS
- Users print via Ctrl/Cmd+P → Save as PDF
- Clean layout with hidden navigation elements
- Page breaks at logical sections

#### Dataview Query (Dynamic)

Instead of a static snapshot, generate a Dataview query that produces the report dynamically:

```markdown
## Family Group Sheet: Smith-Jones

```dataview
TABLE
  born as "Born",
  died as "Died",
  birthPlace as "Birthplace"
FROM "People"
WHERE father = [[John Smith]] OR mother = [[Mary Jones]]
SORT born ASC
```
```

---

## UI Design

### Reports Tab

Control Center tab for generating formatted output:

```
┌─────────────────────────────────────────┐
│ Reports                                 │
├─────────────────────────────────────────┤
│                                         │
│ Generate reports                        │
│ ─────────────────────────────────────── │
│                                         │
│ Report type: [Family Group Sheet ▼]     │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ Scope                                   │
│ Root person: [Select person... ▼]       │
│ Direction: ○ Ancestors ○ Descendants    │
│ Generations: [4 ▼]                      │
│                                         │
│ Filters                                 │
│ Collection: [All ▼]                     │
│ Date range: [____] to [____]            │
│ ☐ Anonymize living persons              │
│                                         │
│ Output                                  │
│ Format: ○ Markdown ○ Dataview Query     │
│ Folder: [Reports ▼]                     │
│                                         │
│ [Preview]  [Generate Report]            │
│                                         │
└─────────────────────────────────────────┘
```

### Report Preview Modal

```
┌─────────────────────────────────────────┐
│ Preview: Family Group Sheet             │
├─────────────────────────────────────────┤
│                                         │
│ # Smith-Jones Family                    │
│                                         │
│ ## Parents                              │
│                                         │
│ ### John Robert Smith (1888-1952)       │
│ - **Born:** 15 May 1888, Dublin...      │
│                                         │
│ [scrollable preview content]            │
│                                         │
├─────────────────────────────────────────┤
│ Stats: 2 parents, 3 children, 8 sources │
│                                         │
│   [Copy to Clipboard]  [Create Note]    │
└─────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Statistics Dashboard ✅

**Status:** Complete

**Focus:** Core statistics infrastructure and dashboard.

1. **StatisticsService** ✅
   - Entity counts with caching
   - Completeness scores
   - Quality metrics (missing vitals, unsourced facts)
   - Top lists (surnames, locations, occupations, sources)
   - Debounced cache invalidation on vault changes

2. **Control Center Summary Card** ✅
   - Entity count display
   - Completeness progress bars
   - Warning indicators
   - "Open Statistics Dashboard" button

3. **Statistics Workspace View** ✅
   - Full dashboard with expandable sections
   - Charts for distributions
   - Auto-refresh on vault changes
   - Split view support

4. **Drill-Down** ✅
   - Top lists (surnames, locations, occupations) expand inline to show matching people
   - Click person chip → opens their note in new tab
   - Top sources link directly to source notes

### Phase 2: Reports Generator ✅

**Status:** Complete

**Focus:** Core genealogy reports that are most requested.

1. **Family Group Sheet** ✅
   - Select a couple or individual
   - Show spouse(s), children with basic vitals
   - Include source citations

2. **Individual Summary** ✅
   - All known facts for one person
   - Events in chronological order
   - Source citations per fact

3. **Ahnentafel Report** ✅
   - Numbered ancestor list
   - Configurable generation depth
   - Standard genealogical format

4. **Gaps Report** ✅
   - Missing vital records by generation
   - Linked from dashboard "Missing Vitals" metric

**Infrastructure:** ✅
- Report generation service
- Markdown templating system
- Reports section in Statistics Dashboard
- Report generator modal with preview

### Phase 3: Extended Statistics ✅

**Status:** Complete

**Focus:** Demographics, source coverage, worldbuilding metrics.

- ✅ Longevity analysis (average lifespan by birth decade and location)
- ✅ Family size patterns (average children per family by decade)
- ✅ Marriage patterns (age at marriage by sex, remarriage rates)
- ✅ Migration flows (birth-to-death location changes, top routes)
- ✅ Source coverage by generation
- ✅ Timeline density (events per decade with gap detection)

### Phase 4: Additional Reports ✅

**Status:** Complete

**Focus:** Expand to all report types.

**Completed:**
- ✅ Register Report (NGSQ-style descendant numbering)
- ✅ Pedigree Chart (markdown ancestor tree)
- ✅ Descendant Chart (markdown descendant tree)

**Future:**
- Character Sheet, Cast List, Organization Roster
- Character Arc, Scene Outline, POV Coverage
- Source Bibliography, Evidence Matrix
- Faction Timeline, Age Audit, Lifespan Overlap
- Dataview query generation

### Phase 5: Quality Drill-Down ✅

**Status:** Complete

**Focus:** Enhanced data quality section with drill-down and additional metrics.

**Bug Fix:**
- ✅ Fixed orphaned people calculation (was returning negative values due to incorrect subtraction of overlapping sets)

**New Quality Metrics:**
- ✅ Missing death dates (people with birth but no death, excluding living)
- ✅ Incomplete parents (people with only one parent linked)
- ✅ Date inconsistencies (birth after death, age > 120)

**Drill-Down Support:**
- ✅ All quality issues are now clickable and expandable
- ✅ Click to expand → shows affected people/items as clickable chips
- ✅ Right-click context menu (open to right, new window)
- ✅ Ctrl+hover for preview
- ✅ Severity levels: error (red), warning (orange), info (blue)
- ✅ Scrollable drill-down list (max 50 items with "...and X more" indicator)

### Future: Enhanced Drill-Down

**Focus:** Advanced drill-down capabilities beyond viewing.

- **Edit via modal**: Click person in drill-down → open edit modal instead of just navigating to note
- **Batch operations**: Select multiple people from drill-down → apply bulk edits (e.g., fix common spelling)
- **Context menu**: Right-click person chip → options: Open, Edit, Add to collection, etc.
- **Extended drill-down targets**: Events by type, sources by type, places by category

---

## Technical Considerations

### Statistics Service Architecture

```typescript
interface StatisticsCache {
  entityCounts?: EntityCounts;
  completenessScores?: CompletenessScores;
  topLists?: TopListsCache;
  lastUpdated: number;
}

class StatisticsService {
  private cache: StatisticsCache;
  private refreshDebounceMs = 1000;

  constructor(private plugin: CanvasRootsPlugin) {
    // Register vault change listeners
    this.plugin.registerEvent(
      this.plugin.app.vault.on('modify', this.scheduleRefresh.bind(this))
    );
  }

  private scheduleRefresh(): void {
    // Debounced cache invalidation
  }
}
```

### Report Generator Architecture

```typescript
interface ReportGenerator<TOptions, TResult> {
  readonly id: string;
  readonly name: string;
  readonly category: 'genealogy' | 'worldbuilding' | 'writing' | 'historian';

  getDefaultOptions(): TOptions;
  validate(options: TOptions): ValidationResult;
  generate(options: TOptions): Promise<TResult>;
  toMarkdown(result: TResult): string;
  toDataviewQuery?(result: TResult): string;
}

// Example: Family Group Sheet
class FamilyGroupSheetGenerator implements ReportGenerator<FGSOptions, FGSResult> {
  // ...
}
```

### Leveraging Existing Services

| Service | Used By |
|---------|---------|
| `FamilyGraphService` | Statistics (entity counts), Family Group Sheet, Ahnentafel, Pedigree |
| `EventGraphService` | Statistics (timeline density), Individual Summary, Character Arc |
| `SourceGraphService` | Statistics (source coverage), Source Bibliography, Evidence Matrix |
| `PlaceGraphService` | Statistics (top locations), Place Report |
| `OrgGraphService` | Statistics (org counts), Organization Roster |

### Print CSS

```css
@media print {
  /* Hide Obsidian UI */
  .workspace-ribbon,
  .workspace-tab-header-container,
  .status-bar { display: none; }

  /* Page breaks */
  .cr-report-section { page-break-inside: avoid; }
  .cr-report-page-break { page-break-after: always; }

  /* Clean typography */
  .cr-report { font-family: Georgia, serif; }
  .cr-report h1 { font-size: 24pt; }
  .cr-report table { font-size: 10pt; }
}
```

---

## Related Documentation

- [Roadmap: Statistics & Reports](../../wiki-content/Roadmap.md#statistics--reports)
- [Events & Timelines](../../wiki-content/Events-And-Timelines.md)
- [Evidence & Sources](../../wiki-content/Evidence-And-Sources.md)
- [Organization Notes](../../wiki-content/Organization-Notes.md)
