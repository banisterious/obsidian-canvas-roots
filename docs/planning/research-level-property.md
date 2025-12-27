# Research Level Property

**Status:** In Progress (Phases 1-3 Complete)
**Target Version:** TBD
**Created:** 2025-12-26
**Source:** GitHub Discussion #38
**Branch:** `feature/research-level-property`

---

## Overview

Add a `research_level` property to Person notes to track research progress toward GPS-compliant documentation. Based on Yvette Hoitink's "Six Levels of Ancestral Profiles" system.

This provides a simple, single-property way to track how thoroughly each ancestor has been researched, supporting the GPS principle of "reasonably exhaustive research."

---

## Research Levels

| Level | Name | Description |
|-------|------|-------------|
| 0 | Unidentified | Ancestor exists but no name established (placeholder) |
| 1 | Name Only | Name known, appears in others' records, no vital dates |
| 2 | Vital Statistics | Birth, marriage, death dates researched |
| 3 | Life Events | Occupations, residences, children, spouses documented |
| 4 | Extended Records | Property, military, religion, legal records researched |
| 5 | GPS Complete | Exhaustive research complete, written proof summary exists |
| 6 | Biography | Full narrative biography with historical context |

---

## Implementation

### Phase 1: Property Support ✅

**Status:** Complete

**Add to Person frontmatter schema:**

```yaml
research_level: 3
```

**Type definition:**

```typescript
// In types or schema file
type ResearchLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Or as enum for better documentation
enum ResearchLevel {
  Unidentified = 0,
  NameOnly = 1,
  VitalStatistics = 2,
  LifeEvents = 3,
  ExtendedRecords = 4,
  GPSComplete = 5,
  Biography = 6
}
```

**Files updated:**
- [x] `src/types/frontmatter.ts` - Added ResearchLevel type and RESEARCH_LEVELS metadata
- [x] `src/core/person-note-writer.ts` - Added researchLevel to PersonData
- [x] `wiki-content/Frontmatter-Reference.md` - Documented property

### Phase 2: Edit Modal Integration ✅

**Status:** Complete

**Add research level selector to Edit Person modal:**

- Dropdown showing levels 0-6 with "(Not assessed)" option
- Shows level number and name (e.g., "3 - Life Events")

**Location in modal:** In main form, after dates section

**Files updated:**
- [x] `src/ui/create-person-modal.ts` - Added dropdown selector

### Phase 3: Research Gaps Report Integration ✅

**Status:** Complete

**Enhance Research Gaps Report to use research_level:**

- [x] Filter by research level (e.g., "Show only Level 0-2")
- [x] Sort by research level (lowest first = most needs work)
- [x] Show research level in report table
- [x] Summary statistics: "X ancestors at Level 0-2, Y at Level 3-4, Z at Level 5-6"

**Files updated:**
- [x] `src/core/family-graph.ts` - Added researchLevel to PersonNode
- [x] `src/reports/types/report-types.ts` - Added researchLevel to ReportPerson, filtering options to GapsReportOptions, statistics to GapsReportResult
- [x] `src/reports/services/gaps-report-generator.ts` - Filtering, sorting, statistics, Research Level column in tables
- [x] `src/reports/ui/report-generator-modal.ts` - UI controls for research level filter

### Phase 4: Canvas Tree Visualization (Deferred)

**Status:** Deferred — Nice-to-have, may conflict with existing indicators

**Color-code tree nodes by research level:**

| Levels | Color | Meaning |
|--------|-------|---------|
| 0-1 | Red/Orange | Needs significant work |
| 2-3 | Yellow | Partially researched |
| 4-5 | Green | Well researched |
| 6 | Blue/Gold | Complete biography |

**Implementation considerations:**
- Add setting to enable/disable research level coloring
- Apply as CSS class or inline style to canvas nodes
- May conflict or overlap with existing source count indicators
- Need toggle or combined view to avoid visual clutter

**Files to update:**
- [ ] `src/settings.ts` - Add toggle setting
- [ ] `src/canvas/tree-generator.ts` - Add node coloring logic
- [ ] `styles/canvas.css` - Color definitions

---

## UI Considerations

### Edit Modal Selector Options

**Option A: Simple dropdown**
```
Research Level: [▼ 3 - Life Events]
```

**Option B: Segmented control with icons**
```
Research Level: [0] [1] [2] [3•] [4] [5] [6]
```

**Option C: Visual progress indicator**
```
Research Level: ████████░░░░ Level 4 - Extended Records
```

### Tooltip/Help Text

When hovering or clicking info icon, show:
```
Level 0: Unidentified - No name established
Level 1: Name Only - Appears in others' records
Level 2: Vital Statistics - Birth/marriage/death researched
Level 3: Life Events - Occupations, residences documented
Level 4: Extended Records - Property, military, legal records
Level 5: GPS Complete - Exhaustive research, proof summary
Level 6: Biography - Full narrative with historical context
```

---

## Bases Integration ✅

**Status:** Complete (shipped with Phase 1)

**Added research_level to Person base views:**

- [x] "By research level" grouped view
- [x] "Needs research" filtered view (Level ≤ 2)
- [x] "Not assessed" filtered view (empty research_level)

**Files updated:**
- [x] `src/constants/base-template.ts` - Added views and research_level property

---

## Export Support ✅

**Status:** Complete

Research level is exported to both GEDCOM and Gramps formats as custom tags/attributes:

| Format | Tag/Attribute | Example |
|--------|---------------|---------|
| **GEDCOM** | `_RESEARCH_LEVEL` | `1 _RESEARCH_LEVEL 3` |
| **Gramps XML** | `attribute type="Research Level"` | `<attribute type="Research Level" value="3"/>` |

**Files updated:**
- [x] `src/gedcom/gedcom-exporter.ts` - Added `_RESEARCH_LEVEL` custom tag
- [x] `src/gramps/gramps-exporter.ts` - Added "Research Level" attribute

---

## Import Support

**GEDCOM/Gramps import:**

Research level should be importable from GEDCOM/Gramps custom attributes. Users may have tracked this in:
- GEDCOM `_RESEARCH_LEVEL` or similar custom tag
- Gramps custom person attributes

**Implementation:**
- Add optional mapping in import settings
- Allow user to specify which custom attribute maps to `research_level`
- Validate imported values are 0-6

**Files to update:**
- [ ] `src/gedcom/gedcom-parser.ts` - Parse custom tags
- [ ] `src/gramps/gramps-parser.ts` - Parse custom attributes
- [ ] `src/ui/import-wizard-modal.ts` - Add mapping option

---

## Migration

**No migration required** - This is a new optional property. Existing Person notes without `research_level` simply won't have it set.

**Default behavior:**
- If `research_level` is not set, treat as "unknown" (not 0)
- Research Gaps Report can show "Not assessed" for missing values
- Canvas coloring can use neutral color for unset values

---

## Open Questions

### Resolved

1. **Should there be an "unknown/not assessed" state separate from Level 0?**
   → Yes. Use `null`/undefined for "not assessed" vs explicit `0` for "unidentified ancestor."

2. **Auto-calculation vs manual entry?**
   → Manual entry only. Research level is a qualitative judgment about exhaustiveness, not just data completeness.

### Still Open

3. **Should this integrate with proof summaries?**
   - Level 5 requires a written proof summary
   - Could add validation/reminder if Level 5 but no linked proof summary note
   - Deferred: Depends on proof summary feature maturity

4. **Bulk editing?**
   - Should Cleanup Wizard have a step to set research levels?
   - Could be useful post-import to quickly assess newly imported people
   - Lower priority - can be done manually or via Bases

---

## References

- [Hoitink's Six Levels of Ancestral Profiles](https://www.dutchgenealogy.nl/six-levels-ancestral-profiles/)
- [Board for Certification of Genealogists - Genealogy Standards](https://bcgcertification.org/product/genealogy-standards-second-edition/)
- [GPS Element 1: Reasonably Exhaustive Research](https://www.evidenceexplained.com/)

---

## Implementation Order

1. **Phase 1: Property Support** ✅ Complete
2. **Phase 2: Edit Modal** ✅ Complete
3. **Phase 3: Research Gaps Report** ✅ Complete
4. **Phase 4: Canvas Visualization** - Deferred, may conflict with existing indicators

**Completed additional work:**
- ✅ Bases "By Research Level" grouped view (shipped with Phase 1)
- ✅ Settings integration: UI hidden when `trackFactSourcing` disabled
- ✅ Export support for GEDCOM (`_RESEARCH_LEVEL`) and Gramps (`attribute type="Research Level"`)

**Remaining work:**
- Import support for GEDCOM/Gramps custom attributes (future)
