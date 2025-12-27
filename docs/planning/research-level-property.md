# Research Level Property

**Status:** Planning
**Target Version:** TBD
**Created:** 2025-12-26
**Source:** GitHub Discussion #38

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

### Phase 1: Property Support

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

**Files to update:**
- [ ] `src/types.ts` - Add ResearchLevel type
- [ ] `src/schemas/person-schema.ts` - Add to frontmatter schema
- [ ] `wiki-content/Frontmatter-Reference.md` - Document property

### Phase 2: Edit Modal Integration

**Add research level selector to Edit Person modal:**

- Dropdown or segmented control showing levels 0-6
- Show level name and brief description
- Optional: Show tooltip with full description on hover

**Location in modal:**
- Option A: In main form, after dates section
- Option B: In a collapsible "Research Status" section
- Option C: As a badge/indicator in the modal header

**Files to update:**
- [ ] `src/ui/edit-person-modal.ts` - Add selector
- [ ] `styles/modals.css` - Styling if needed

### Phase 3: Research Gaps Report Integration

**Enhance Research Gaps Report to use research_level:**

- Filter by research level (e.g., "Show only Level 0-2")
- Sort by research level (lowest first = most needs work)
- Show research level in report table
- Summary statistics: "X ancestors at Level 0-2, Y at Level 3-4, Z at Level 5-6"

**Files to update:**
- [ ] `src/reports/research-gaps-report.ts` - Add filtering/sorting
- [ ] `src/ui/research-gaps-modal.ts` - Add filter controls

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

## Bases Integration

**Add research_level to Person base views:**

- "By Research Level" grouped view (priority)
- "Needs Research" filtered view (Level 0-2)
- "Well Documented" filtered view (Level 4+)

**Files to update:**
- [ ] `src/bases/templates/person-base-template.ts` - Add views

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

1. **Phase 1: Property Support** - Low effort, foundation
2. **Phase 2: Edit Modal** - Medium effort, primary UI
3. **Phase 3: Research Gaps Report** - Medium effort, high value
4. **Phase 4: Canvas Visualization** - Deferred, may conflict with existing indicators

Phases 1-2 could ship together as minimum viable feature.
Phase 3 adds significant value for research prioritization.
Phase 4 deferred pending evaluation of visual indicator conflicts.

**Additional work (can be done in parallel):**
- Bases "By Research Level" grouped view (with Phase 1)
- Import support for GEDCOM/Gramps custom attributes (after Phase 1)
