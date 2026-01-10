# DNA Match Tracking

Planning document for [#126](https://github.com/banisterious/obsidian-charted-roots/issues/126).

---

## Overview

Add lightweight DNA match tracking to Charted Roots, enabling genetic genealogists to record key DNA matches alongside their family tree research. Designed to be **fully opt-in**—invisible to users who don't need it.

**Design Philosophy:**
- Charted Roots is not a DNA analysis tool—specialized tools (DNAPainter, Genetic Affairs, etc.) handle that well
- Focus on tracking "key matches" (BKM/BMM methodology) rather than comprehensive DNA management
- All phases are opt-in via settings; default experience is unchanged
- Leverage existing infrastructure (Bases, custom relationships, reports)

---

## Community Input Summary

From issue discussion:

- **jeff962**: Keep CR focused on core genealogy; specialized DNA tools handle complexity better
- **ANYroots**: Recommended tracking only "key matches" using Best Known Matches (BKM) and Best Mystery Matches (BMM) methodology, with optional endogamy flagging
- **Consensus**: Lightweight frontmatter approach, not comprehensive DNA management

---

## Phased Implementation

All phases are **opt-in**. Later phases require earlier phases to be enabled.

| Phase | Feature | Gated By | Effort |
|-------|---------|----------|--------|
| 1 | Frontmatter properties | Documentation only | Low |
| 2 | DNA Match person subtype | `enableDnaTracking` setting | Medium |
| 3 | DNA relationships | `enableDnaTracking` setting | Medium |
| 4 | Visualization & reports | `enableDnaVisualization` setting | Higher |

---

## Phase 1: Frontmatter Properties (Documentation Only)

**Effort:** Low
**Gating:** None—just document the properties

Define optional frontmatter properties that users can add to person notes. No code changes required; Bases views can filter/sort by these properties automatically.

### Properties

```yaml
# DNA match information (all optional)
dna_shared_cm: 1847          # Shared centiMorgans
dna_testing_company: AncestryDNA  # Testing company
dna_kit_id: "ABC123"         # Kit identifier
dna_match_type: BKM          # BKM | BMM | confirmed | unconfirmed
dna_endogamy_flag: true      # Flag for endogamous populations
dna_notes: "Matches on chromosome 7"  # Free-form notes
```

### Match Types

| Type | Description |
|------|-------------|
| `BKM` | Best Known Match — confirmed relationship, high confidence |
| `BMM` | Best Mystery Match — strong match, relationship unknown |
| `confirmed` | DNA confirms documented relationship |
| `unconfirmed` | Match recorded but not yet analyzed |

### Testing Companies (Suggested Values)

- `AncestryDNA`
- `23andMe`
- `FamilyTreeDNA`
- `MyHeritage`
- `LivingDNA`
- `GEDmatch` (aggregator)

### Documentation Updates

- Add DNA properties to `wiki-content/Frontmatter-Reference.md`
- Create `wiki-content/DNA-Match-Tracking.md` explaining the workflow
- Note that Bases views can filter by `dna_shared_cm`, `dna_match_type`, etc.

### What Users Get

- Track DNA data on any person note
- Filter/sort in Bases views (e.g., "Show all BKM matches", "Sort by cM")
- Zero impact on non-DNA workflows

### Bases View Template

Provide a pre-configured "DNA Matches" Bases view that users can create from the Control Center:

**Columns:**
- Name (person link)
- `dna_shared_cm` — Shared cM
- `dna_match_type` — Match type (BKM/BMM/etc.)
- `dna_testing_company` — Testing company
- `dna_endogamy_flag` — Endogamy indicator

**Default Sort:** `dna_shared_cm` descending (highest matches first)

**Default Filter:** `dna_shared_cm` is not empty (only show persons with DNA data)

This leverages existing Bases infrastructure—no new code required beyond the template definition.

### Template Snippets

Document example Templater/Templates snippets for DNA match notes:

```yaml
---
cr_type: person
personType: DNA Match
dna_shared_cm:
dna_testing_company:
dna_kit_id:
dna_match_type: unconfirmed
dna_endogamy_flag: false
dna_notes:
---
```

Include in documentation with usage guidance.

---

## Phase 2: DNA Match Person Subtype

**Effort:** Medium
**Gating:** `enableDnaTracking: false` (default)

Add `personType: DNA Match` as a recognized person subtype with dedicated UI support.

### Setting

```typescript
// settings.ts
enableDnaTracking: boolean = false;
```

When `enableDnaTracking` is **off**:
- No DNA-related UI anywhere
- DNA frontmatter properties still work (Phase 1)
- Person lists show no DNA badges

When `enableDnaTracking` is **on**:
- "DNA Match" option in Create Person modal
- DNA fields section in Edit Person modal (collapsed by default)
- DNA match badge in person lists
- Statistics Dashboard shows DNA match count

### Create Person Modal Changes

When enabled, add "Person Type" dropdown:
- Regular Person (default)
- DNA Match

Selecting "DNA Match" auto-populates:
```yaml
personType: DNA Match
```

### Edit Person Modal Changes

When enabled, add collapsible "DNA Information" section:
- Shared cM (number input)
- Testing Company (dropdown)
- Kit ID (text input)
- Match Type (dropdown: BKM/BMM/confirmed/unconfirmed)
- Endogamy Flag (toggle)
- Notes (textarea)

Section only shown when:
- `enableDnaTracking` is on, AND
- Either `personType: DNA Match` OR any `dna_*` property exists

### Person List Styling

DNA matches displayed with:
- 🧬 icon badge (or similar)
- Optional: cM value shown in subtitle
- Distinct from regular persons but not overwhelming

### Files to Modify

- `src/settings.ts` — Add `enableDnaTracking`
- `src/ui/settings-tab.ts` — Add setting toggle (in "Advanced" section)
- `src/ui/create-person-modal.ts` — Add person type selector
- `src/ui/edit-person-modal.ts` — Add DNA fields section
- `src/ui/person-picker-modal.ts` — Add DNA badge rendering
- `src/models/person.ts` — Add DNA property types

---

## Phase 3: DNA Relationships

**Effort:** Medium
**Gating:** `enableDnaTracking` setting (same as Phase 2)

Add `dna_match` as a custom relationship type with special semantics.

### Relationship Semantics

| Property | Value |
|----------|-------|
| ID | `dna_match` |
| Label | "DNA Match" |
| Bidirectional | Yes (A↔B automatically creates B↔A) |
| Transitive | **No** (A↔B and B↔C does NOT imply A↔C) |
| On Family Tree | No (DNA matches are not genealogical relationships) |

### Implementation

Register `dna_match` relationship type when `enableDnaTracking` is on:

```typescript
// Only registered when DNA tracking enabled
const dnaMatchRelationship: RelationshipTypeDefinition = {
  id: 'dna_match',
  label: 'DNA Match',
  reverseLabel: 'DNA Match',
  isBidirectional: true,
  includeOnFamilyTree: false,
  familyGraphMapping: null,
  color: '#9333ea', // Purple
};
```

### Edge Styling

- Dashed line style
- Purple color (or configurable)
- Label shows shared cM if available

### Relationship Picker

When `enableDnaTracking` is on:
- "DNA Match" appears in relationship type dropdown
- Selecting it prompts for optional cM value

### Files to Modify

- `src/relationships/constants/default-relationship-types.ts` — Conditional registration
- `src/relationships/relationship-service.ts` — Handle bidirectional creation
- `src/ui/relationship-picker-modal.ts` — Add DNA option when enabled
- `src/core/canvas-generator.ts` — Style DNA edges distinctly

---

## Phase 4: Visualization & Reports (Future)

**Effort:** Higher
**Gating:** `enableDnaVisualization: false` (default, requires `enableDnaTracking`)

Advanced DNA visualization features. Marked as **Future Consideration** pending user demand.

### Setting

```typescript
// settings.ts
enableDnaVisualization: boolean = false;  // Requires enableDnaTracking
```

### Potential Features

**DNA Matches Report:**
- List all DNA matches with cM values
- Group by match type (BKM/BMM/etc.)
- Sort by cM, name, or relationship status
- Show which matches are connected to confirmed ancestors

**Canvas Visualization:**
- "DNA Match Network" tree type in Tree Wizard
- Shows tester at center, matches radiating out
- Edge thickness indicates cM value
- Cluster by shared ancestors (if known)

**Ancestor DNA View:**
- Select an ancestor, show all DNA matches descending from them
- Helps identify which matches connect through which lines

### Why Future

- Complexity: Non-trivial layout algorithms for DNA networks
- Specialized: Most users won't need this
- Better tools exist: DNAPainter, Leeds Method charts
- Wait for Phase 1-3 adoption before investing here

---

## Complexity Considerations

### Endogamy

Populations with higher rates of intermarriage (e.g., Ashkenazi Jewish, Acadian/Cajun, isolated communities) have inflated cM values. The `dna_endogamy_flag` property allows users to mark matches that may be affected.

**Not implementing:**
- Automatic endogamy detection
- cM adjustment algorithms
- Population-specific thresholds

These belong in specialized DNA tools.

### Pedigree Collapse

When the same ancestor appears multiple times in a tree, DNA may be inherited through multiple paths. Charted Roots doesn't attempt to model this—users should record the match and use external tools for segment analysis.

### Shared cM Project Ranges

We could display expected relationship ranges based on the Shared cM Project, but this adds complexity:
- Ranges overlap significantly
- Population-specific considerations
- Better handled by external tools

**Decision:** Document the Shared cM Project as a resource but don't embed the data.

---

## Settings UI

Add to Settings → Advanced (or new "Specialized Features" section):

```
## DNA Tracking (Beta)

[ ] Enable DNA match tracking
    Show DNA-related fields and options for genetic genealogy workflows.

    When enabled:
    - "DNA Match" person type available in Create Person
    - DNA fields shown in Edit Person modal
    - DNA Match relationship type available

[ ] Enable DNA visualization (requires DNA tracking)
    Show DNA match reports and canvas visualizations.
```

---

## Implementation Order

1. **Phase 1** — Documentation only, zero code changes
2. **Phase 2** — Setting + UI for DNA match person type
3. **Phase 3** — DNA relationship type (builds on Phase 2)
4. **Phase 4** — Future consideration based on adoption

Phases 2 and 3 could ship together as they share the same setting gate.

---

## Non-Goals

Explicitly out of scope:

- **Segment analysis** — Use DNAPainter, Genetic Affairs
- **Chromosome browser** — External tool territory
- **Match management** — AncestryDNA/23andMe handle this
- **Automatic relationship prediction** — Too error-prone
- **DNA import from testing companies** — API access varies, privacy concerns

Charted Roots provides a place to **record and organize** key DNA matches alongside genealogical research, not to replace specialized DNA tools.

---

## References

- [Issue #126](https://github.com/banisterious/obsidian-charted-roots/issues/126)
- [Shared cM Project](https://thednageek.com/the-shared-cm-project-version-4-0-march-2020/)
- [Leeds Method](https://www.danaleeds.com/the-leeds-method/)
- [BKM/BMM Methodology](https://genealogyjunkie.net/bestmatchmethod/) (Best Match Method)

---

## Status

| Phase | Status |
|-------|--------|
| Phase 1 | Implemented |
| Phase 2 | Planned |
| Phase 3 | Planned |
| Phase 4 | Future Consideration |
