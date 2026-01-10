# Research Workflow Integration

Unified planning document for GPS-aligned research workflow features combining entity management (#125) and workflow tracking (#124).

- **Status:** Planning
- **GitHub Issues:** [#124](https://github.com/banisterious/obsidian-charted-roots/issues/124), [#125](https://github.com/banisterious/obsidian-charted-roots/issues/125)
- **Created:** 2026-01-05
- **Contributors:** @ANYroots, @wilbry, @banisterious

---

## Overview

Enable genealogists to manage research workflow using GPS (Genealogical Proof Standard) methodology within Charted Roots. This integration provides entity types, hierarchical organization, and workflow tracking without forcing users into rigid structures.

### Goals

1. **Support GPS methodology** — Align with Mills' Evidence Explained research practices
2. **Maintain flexibility** — Users can adopt features selectively without enforcement
3. **Avoid duplication** — Single cohesive system, not overlapping features
4. **Integrate with existing features** — Leverage Data Quality, schema validation, conflict detection
5. **Minimize vault bloat** — Lightweight entities, optional features

### Non-Goals

- Replacing user's existing research system wholesale
- Enforcing specific folder structures or naming conventions
- Auto-generating complex analysis or conclusions
- Task management (users can integrate with Obsidian Tasks/DataView)

---

## Entity Types

### Research Project

**Purpose:** Hub for complex, multi-phase research cases.

**Properties:**
```yaml
cr_type: research_project
title: "Identity of John Smith (1850-1920)"
status: in-progress  # open | in-progress | on-hold | completed
research_level: 3    # 0-6 GPS scale (optional)
private: false       # Exclude from exports if true
up: "[[Research Notebook]]"  # Optional parent
related: ["[[Sarah Jones Identity Project]]"]  # Related projects
```

**Markdown Structure:**
```markdown
---
cr_type: research_project
title: "Identity of John Smith (1850-1920)"
status: in-progress
---

# Identity of John Smith (1850-1920)

## Research Question

Was John Smith (b. ~1850) who married Mary Jones in 1875 the same person as John Smith enumerated in 1860 census?

## Research Log

- date: 2026-01-04
  source: "[[1860 Census - District 42]]"
  searched_for: "John Smith, age 10-12"
  result: negative
  notes: "Searched all pages, no match in expected age range"

- date: 2026-01-05
  source: "[[Marriage Record - Smith-Jones 1875]]"
  searched_for: "John Smith parents"
  result: positive
  notes: "Parents listed as William and Elizabeth Smith"

## Related Reports

- [[Smith Identity Research Report]]
- [[Smith Family Group Analysis]]
```

### Research Report

**Purpose:** Living/working document analyzing specific research question with findings and evidence.

**Properties:**
```yaml
cr_type: research_report
title: "John Smith Birth Location Analysis"
status: draft  # draft | review | final | published
reportTo: File  # File | Family | Client | Public | Print
private: false
up: "[[Identity of John Smith Project]]"
related: ["[[Smith Family Group Report]]"]
```

**Markdown Structure:**
```markdown
---
cr_type: research_report
title: "John Smith Birth Location Analysis"
status: draft
up: "[[Identity of John Smith Project]]"
---

# John Smith Birth Location Analysis

## Research Question

Where was John Smith (1850-1920) born?

## Sources Consulted

- [[1860 Census - Smith Household]]
- [[1875 Marriage Record - Smith-Jones]]
- [[Death Certificate - John Smith 1920]]

## Findings

### Census Evidence
The 1860 census shows John Smith (age 10) enumerated with William and Elizabeth Smith...

### Marriage Record Evidence
Marriage certificate states birthplace as "Pennsylvania"...

## Research Notes

**Negative Finding:** Searched Pennsylvania birth records 1845-1855 for John Smith with parents William and Elizabeth. No matches found in:
- Philadelphia County birth index
- Allegheny County birth index
- Lancaster County birth records

**Analysis:** Conflicting evidence between census (born NY) and marriage record (born PA) requires further investigation...

## Conclusions

[Analysis and synthesis]
```

### Individual Research Note (IRN)

**Purpose:** Synthesis document between research reports and person notes, combining analysis across multiple sources.

**Properties:**
```yaml
cr_type: individual_research_note
subject: "[[John Smith]]"
status: in-progress
private: false
up: "[[Identity of John Smith Project]]"
```

**Markdown Structure:**
```markdown
---
cr_type: individual_research_note
subject: "[[John Smith]]"
status: in-progress
up: "[[Identity of John Smith Project]]"
---

# Individual Research Note: John Smith

## Identity

**Full Name:** John Smith
**Birth:** ~1850, Pennsylvania (conflicting evidence)
**Death:** 20 Aug 1920, Philadelphia, PA

## Research Summary

### Birth Evidence
- 1860 Census: Born New York (per enumeration)
- 1875 Marriage: Born Pennsylvania (stated)
- Unresolved conflict requiring further investigation

### Family Relationships
- Father: William Smith (confirmed via multiple sources)
- Mother: Elizabeth [Unknown] Smith (confirmed)
- Spouse: Mary Jones (m. 1875)

## Outstanding Questions

1. Resolve birth location conflict (NY vs PA)
2. Locate birth record
3. Identify Elizabeth's maiden name

## Related Research

- [[Smith Identity Research Report]]
- [[Smith Family Group Analysis]]
```

### Research Journal (Optional)

**Purpose:** Daily/session-level research log for tracking activity across projects.

**Properties:**
```yaml
cr_type: research_journal
date: 2026-01-04
repositories: ["[[FamilySearch]]", "[[Ancestry.com]]"]
```

**Markdown Structure:**
```markdown
---
cr_type: research_journal
date: 2026-01-04
---

# Research Journal - 2026-01-04

## Projects Worked On

- [[Identity of John Smith Project]]
- [[Sarah Jones Identity Project]]

## Activities

- Searched FamilySearch for John Smith birth records in PA (1845-1855)
- Negative finding: No matches in Philadelphia County
- Reviewed 1860 census images for Smith households

## Next Steps

- Expand PA search to adjacent counties
- Check NY birth records for alternative birth location
```

---

## Properties Reference

### Common Properties (All Types)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `cr_type` | string | Yes | Entity type identifier |
| `title` | string | Recommended | Display name |
| `status` | string | No | Current state (draft, in-progress, completed, etc.) |
| `private` | boolean | No | Exclude from exports if true |
| `up` | wikilink | No | Parent in hierarchy |
| `related` | wikilink[] | No | Related research entities |

### Research Project Specific

| Property | Type | Description |
|----------|------|-------------|
| `research_level` | number | GPS research level (0-6) |

### Research Report Specific

| Property | Type | Description |
|----------|------|-------------|
| `reportTo` | string | Intended audience (File, Family, Client, Public, Print) |

### Individual Research Note Specific

| Property | Type | Description |
|----------|------|-------------|
| `subject` | wikilink | Person note being researched |

### Research Journal Specific

| Property | Type | Description |
|----------|------|-------------|
| `date` | date | Journal entry date |
| `repositories` | wikilink[] | Repositories visited/searched |

---

## Research Log Entry Format

Research logs appear in `## Research Log` sections within Research Projects. Each entry uses structured YAML format:

```yaml
- date: YYYY-MM-DD
  source: "[[Source Note]]"        # Optional: source consulted
  searched_for: "search criteria"  # What you were looking for
  result: positive | negative | inconclusive
  notes: "Free-form notes"
```

**Examples:**

```yaml
## Research Log

- date: 2026-01-04
  source: "[[1860 Census - District 42]]"
  searched_for: "John Smith, age 10-12"
  result: negative
  notes: "Searched all pages of district 42, no match in expected age range"

- date: 2026-01-05
  source: "[[Marriage Record - Smith-Jones 1875]]"
  searched_for: "John Smith parents"
  result: positive
  notes: "Parents listed as William and Elizabeth Smith"

- date: 2026-01-06
  searched_for: "Elizabeth Smith maiden name"
  result: negative
  notes: "No records found in county index 1820-1850"
```

**Negative Findings:** Document "searched X, found nothing" scenarios using `result: negative`. This tracks meaningful absence of expected records per Mills' methodology.

---

## Hierarchical Navigation

Research entities use `up` and `related` properties for flexible hierarchy:

**Example Hierarchy:**
```
Research Notebook/
├── Identity of John Smith Project (Research Project)
│   ├── Smith Identity Research Report (Research Report)
│   ├── Smith Birth Analysis Report (Research Report)
│   └── John Smith IRN (Individual Research Note)
│       └── John Smith (Person Note)
└── Sarah Jones Identity Project (Research Project)
    └── Jones Family Analysis (Research Report)
```

**Properties:**
- `up`: Points to parent in hierarchy (Research Report → Research Project)
- `related`: Lateral relationships (related projects, related reports)

**Navigation:**
- Charted Roots recognizes hierarchy for breadcrumb navigation
- No enforcement: users can organize files however they prefer
- Queries can surface cross-project relationships

---

## Phase 1: Foundation

**Status:** Ready for implementation

**Scope:** Basic entity recognition and schema support.

### 1. Entity Type Recognition

**Implementation:**
- Extend `EntityTypeManager` with new types: `research_project`, `research_report`, `individual_research_note`, `research_journal`
- Add icons for each type (research-specific)
- Include in note discovery index

**Schema Definitions:**
```typescript
// src/schemas/research-project-schema.ts
export const researchProjectSchema = {
  cr_type: { type: 'string', required: true, enum: ['research_project'] },
  title: { type: 'string', required: false },
  status: { type: 'string', required: false, enum: ['open', 'in-progress', 'on-hold', 'completed'] },
  research_level: { type: 'number', required: false, min: 0, max: 6 },
  private: { type: 'boolean', required: false },
  up: { type: 'wikilink', required: false },
  related: { type: 'wikilink[]', required: false }
};

// Similar schemas for research_report, individual_research_note, research_journal
```

### 2. Properties Support

**Implementation:**
- Add property aliases support for research entity properties
- Recognize `status`, `private`, `up`, `related` across all research types
- Add `reportTo` for research reports
- Add `subject` for IRNs
- Add `date`, `repositories` for research journals

### 3. Research Log Parsing

**Implementation:**
- Parse `## Research Log` sections in Research Projects
- Extract structured YAML entries
- Store in metadata for querying
- No UI initially (access via DataView/Bases queries)

**Parser Logic:**
```typescript
interface ResearchLogEntry {
  date: string;
  source?: string;  // Wikilink to source note
  searched_for: string;
  result: 'positive' | 'negative' | 'inconclusive';
  notes: string;
}
```

### 4. Data Quality Integration

**Implementation:**
- Add research entity filtering to Data Quality dashboard
- Filter by `status` (show only in-progress, exclude completed)
- Filter by `private` (exclude from exports)
- Count research entities in vault statistics

**Dashboard Card:**
```
Research Entities
─────────────────
4 Projects (2 in-progress, 1 on-hold, 1 completed)
12 Reports (8 draft, 3 review, 1 final)
6 IRNs (4 in-progress)
```

### 5. Schema Validation

**Implementation:**
- Validate research entity frontmatter against schemas
- Report validation errors in Data Quality
- Support in Post-Import Cleanup Wizard if research entities imported

### Implementation Tasks

**Files to Create:**
- `src/types/research-entities.ts` — Type definitions
- `src/schemas/research-project-schema.ts`
- `src/schemas/research-report-schema.ts`
- `src/schemas/individual-research-note-schema.ts`
- `src/schemas/research-journal-schema.ts`
- `src/parsers/research-log-parser.ts` — Parse research log YAML

**Files to Modify:**
- `src/services/EntityTypeManager.ts` — Register research entity types
- `src/services/NoteIndexService.ts` — Index research entities
- `src/modals/DataQualityModal.ts` — Add research entity filtering
- `src/services/StatisticsService.ts` — Count research entities

**Testing:**
- Create sample research notes with various properties
- Verify entity type detection
- Validate schema enforcement
- Test Data Quality filtering

**Documentation:**
- Wiki page: `Research-Workflow.md`
- Section in `Essential-Properties.md` for research properties
- Section in `Frontmatter-Reference.md` for research entity schemas

### Benefits

- Users can start creating research entities immediately
- Schema validation ensures data quality
- Integration with existing Data Quality features
- Lightweight: no UI changes required
- Foundation for Phase 2 enhancements

---

## Phase 2: Workflow Integration

**Status:** Future (after Phase 1 feedback)

Enhance with workflow-specific features and UI improvements.

### 1. Needs-Research Tagging

**Feature:** Tag persons/facts requiring investigation.

**Implementation:**
- Add `needs_research` property to person/event/place entities
- Structure: `needs_research: ["research question", "another question"]`
- Integrate with Data Quality dashboard
- Show badge count on person notes in file explorer

**Data Quality Card:**
```
Research Needed
───────────────
8 people needing research
  - 4 missing birth records
  - 2 conflicting sources
  - 2 identity questions
```

### 2. IRN Auto-Generation

**Feature:** Auto-create IRN stub when creating person note.

**Implementation:**
- Command: "Create Person with Research Note"
- Generates paired files:
  - `John Smith.md` (person note)
  - `John Smith IRN.md` (research note stub)
- Links IRN to person via `subject` property
- Optionally link to parent project via `up` property

**Stub Template:**
```markdown
---
cr_type: individual_research_note
subject: "[[John Smith]]"
status: in-progress
---

# Individual Research Note: John Smith

## Identity

[Auto-populated from person note if available]

## Research Summary

[Placeholder for analysis]

## Outstanding Questions

[Placeholder]

## Related Research

[Placeholder]
```

**Refresh Command:** "Refresh IRN from Sources"
- Re-read linked sources
- Update auto-generated sections
- Preserve manual analysis sections

### 3. Hierarchical Breadcrumb Navigation

**Feature:** Visual breadcrumb showing research hierarchy.

**Implementation:**
- Render breadcrumb trail at top of research note editor
- Format: `Research Notebook > Identity Project > Smith Report`
- Each breadcrumb is clickable link to parent
- Follows `up` property chain

**UI Location:**
- Above note title in editor pane
- CSS: Similar to file path display but with larger, clickable segments

### 4. Research Log UI Enhancements

**Feature:** Structured entry form for research logs.

**Implementation:**
- Command: "Add Research Log Entry"
- Modal form with fields:
  - Date (auto-filled with today)
  - Source (wikilink picker)
  - Searched for (text input)
  - Result (dropdown: positive/negative/inconclusive)
  - Notes (textarea)
- Appends formatted YAML to `## Research Log` section

**Optional Enhancement:** Inline log viewer showing parsed entries in table format.

### Implementation Tasks

**Files to Create:**
- `src/commands/CreatePersonWithIRN.ts`
- `src/commands/RefreshIRNCommand.ts`
- `src/commands/AddResearchLogEntryCommand.ts`
- `src/modals/ResearchLogEntryModal.ts`
- `src/components/ResearchBreadcrumb.ts`

**Files to Modify:**
- `src/modals/DataQualityModal.ts` — Add needs-research section
- `src/services/NoteIndexService.ts` — Index needs_research tags
- Editor integration for breadcrumb rendering

**Testing:**
- Test IRN auto-generation workflow
- Verify breadcrumb navigation
- Test research log entry form
- Validate needs_research integration

**Documentation:**
- Update `Research-Workflow.md` with new features
- Add screenshots of breadcrumb navigation
- Document IRN auto-generation workflow

---

## Phase 3: Advanced Features

**Status:** Conceptual (after Phase 2 feedback)

### 1. Negative Findings Surfacing

**Feature:** Query view showing all negative findings across projects.

**Implementation:**
- Parse all research logs for `result: negative` entries
- DataView-compatible query or custom view
- Group by person/source/repository
- Identify gaps in research coverage

### 2. Research Timeline View

**Feature:** Visual timeline of research activities.

**Implementation:**
- Parse research log dates
- Display chronological view of research sessions
- Filter by project, person, or repository
- Identify research gaps (long periods without activity)

### 3. Cross-Project Queries

**Feature:** Find related research across projects.

**Implementation:**
- "Find related research" command on person notes
- Searches for:
  - IRNs with matching subject
  - Research logs mentioning person
  - Reports linking to person's sources
- Shows consolidated view of all research for person

### 4. Templates/Bases Integration

**Feature:** Ready-to-use Bases templates for research entities.

**Implementation:**
- Create Bases for:
  - Research Project
  - Research Report
  - Individual Research Note
  - Research Journal
- Include sample content and property hints
- Respect property aliases

---

## Integration with Existing Features

### Data Quality Dashboard

**Phase 1:**
- Count research entities by type and status
- Filter by status (show only in-progress)
- Filter by private (exclude from exports)

**Phase 2:**
- Needs-research section showing tagged items
- Breakdown by research question type

### Schema Validation

**Phase 1:**
- Validate research entity frontmatter
- Report missing required properties
- Report invalid enum values (status, reportTo, result)

### Export (GEDCOM, Gramps, CSV)

**All Phases:**
- Respect `private: true` property
- Exclude private research entities from exports
- Optional: include research notes as GEDCOM notes

### Statistics View

**Phase 1:**
- Count research entities by type
- Show status distribution

**Phase 2:**
- Research activity metrics (log entries per month)
- Negative findings count

### Post-Import Cleanup Wizard

**Phase 1:**
- If research entities imported, validate schemas
- Prompt to set status/private properties

---

## User Workflows

### Workflow 1: Complex Research Case

**User:** ANYroots managing multi-source investigation.

**Steps:**
1. Create Research Project: "Identity of John Smith (1850-1920)"
2. Create Research Report: "Smith Birth Location Analysis"
3. Link report to project via `up` property
4. Add research log entries as sources consulted
5. Document negative finding: searched PA birth records, no match
6. Create IRN synthesizing findings across multiple reports
7. Link IRN to person note via `subject` property

**Benefits:**
- Hierarchical organization via `up` property
- Negative findings documented in research logs
- IRN provides synthesis separate from structured person data
- Parallel folder structure maintained (research vs entities)

### Workflow 2: Quick Research Session

**User:** wilbry documenting daily research activity.

**Steps:**
1. Create Research Journal entry for today
2. List projects worked on
3. Document sources searched and findings
4. Link to existing Research Projects via project names
5. Use DataView to query all journal entries by date range

**Benefits:**
- Lightweight daily tracking
- No entity bloat (single journal note per day)
- Connection to projects via wikilinks
- Queryable via DataView for reports

### Workflow 3: Needs-Research Tracking

**User:** General user identifying gaps in tree.

**Steps:**
1. Review person note for missing information
2. Add `needs_research: ["locate birth record", "identify parents"]`
3. Data Quality dashboard shows count of research-needed items
4. Create Research Project to address questions
5. Link person to project
6. Mark `needs_research` items as resolved when completed

**Benefits:**
- Visual indicator in Data Quality
- Integration with research projects
- Track progress on research goals

---

## Design Decisions

### Why Separate IRN from Person Note?

**Decision:** Individual Research Notes (IRNs) are separate entities, not embedded in person notes.

**Rationale:**
- **Separation of concerns:** IRNs contain analysis/synthesis; person notes contain structured data
- **Version control:** Research analysis can evolve without modifying person note
- **Audience:** IRNs may be marked private; person data remains in tree
- **GPS methodology:** Research notes document reasoning; person notes document facts

### Why Research Logs in Projects Instead of Separate Entities?

**Decision:** Research log entries are YAML within `## Research Log` section, not separate notes.

**Rationale:**
- **Lightweight:** Avoids creating hundreds of tiny log entry notes
- **Contextual:** Logs stay with related project
- **Queryable:** Still accessible via DataView/Bases
- **Optional:** Users can use Research Journals for daily tracking if preferred

### Why Support Both Research Journals and Research Logs?

**Decision:** Both are optional; users choose based on workflow preference.

**Rationale:**
- **Research Journals:** Daily/session-level tracking across projects
- **Research Logs:** Project-specific tracking within project note
- **Complementary:** Journals for "what I did today"; logs for "what I found for this project"
- **No enforcement:** Users can use neither, one, or both

### Why `up` Instead of `parent`?

**Decision:** Use `up` property for hierarchy navigation.

**Rationale:**
- **Consistency:** Matches organizational structure from Organization Notes feature
- **Bidirectional:** `up` points to parent; parent can list children in `related` or content
- **Flexibility:** Not enforced; recognized for navigation if present
- **Clarity:** "Up" is intuitive for hierarchy ("go up one level")

---

## Community Feedback Integration

### ANYroots Input

**Validated:**
- ✅ IRNs as intermediate synthesis layer
- ✅ Parallel folder structures (research vs entities)
- ✅ Negative findings in research logs and reports
- ✅ GPS methodology alignment (Mills' Evidence Explained)
- ✅ `reportTo` versioning for different audiences

**Templates Shared:**
- Research Project structure with `## Research Log`
- Research Report structure with separate Research Notes section
- IRN structure with Identity, Summary, Questions sections

### wilbry Input

**Validated:**
- ✅ Connection between research and questions/projects
- ✅ Lightweight approach avoiding entity bloat
- ✅ Preference for cohesive design over overlapping features
- ✅ Interest in GPS research practices

**Concerns Addressed:**
- Avoid duplicative features (#124 vs #125) → Unified plan
- Avoid contaminating source quality metrics → Research logs separate from sources
- Minimize vault sync overhead → Optional features, lightweight entities

---

## Related Documents

- [Evidence & Sources](../../wiki-content/Evidence-And-Sources.md) — Source management and GPS methodology
- [Data Quality](../../wiki-content/Data-Quality.md) — Data quality features and validation
- [Organization Notes](../../wiki-content/Organization-Notes.md) — Hierarchical structures with `up` property
- [Schema Validation](../../wiki-content/Schema-Validation.md) — Schema enforcement

---

## Notes

This plan integrates community feedback from #124 and #125 discussions. Key contributors:

- **@ANYroots:** Detailed GPS workflow, IRN structure, template examples
- **@wilbry:** Lightweight approach, cohesive design philosophy, research journal concept
- **@banisterious:** Phased implementation, integration with existing features

The phased approach allows learning from real usage before committing to UI/UX decisions. Phase 1 provides foundation for users to start using research entities immediately with existing tools (DataView, Bases).
