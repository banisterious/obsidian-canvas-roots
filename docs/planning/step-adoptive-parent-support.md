# Step & Adoptive Parent Support

## Overview

**Priority:** 💡 Low — Specialized for blended families and adoption records

**Summary:** Distinguish biological, step, and adoptive parent relationships in person notes. Prevents false parent claim conflicts when GEDCOM files contain non-biological parent relationships.

---

## Problem Statement

Canvas Roots currently assumes all parent relationships are biological. The data model uses `father_id` and `mother_id` fields without relationship type qualifiers. This causes issues when:

- **GEDCOM imports include step-parents:** Step-parent relationships (via `FAMC` with `PEDI STEP`) are imported as primary parent claims, triggering false conflicts
- **GEDCOM imports include adoptive parents:** Adoptive relationships (`PEDI ADOP`) similarly create false conflicts
- **Blended families are common:** Users researching 20th/21st century genealogy frequently encounter remarriages with step-children

**Current Behavior:**
- Import creates parent claims for all parent relationships regardless of type
- Parent claim conflicts are flagged when multiple people claim the same parent role
- Users must manually resolve conflicts and lose step/adoptive relationship data

**Example Conflict:**
```
Child: Dyllon Jazz Terje Bobo
Father Claimant 1: (unknown) — biological father
Father Claimant 2: Gary Allen Baldwin II — stepfather
```

Both are valid claims, but the current system treats them as conflicting.

---

## Design Decision

**Chosen Approach:** Separate fields for step/adoptive parents

This approach adds dedicated frontmatter fields for non-biological parent relationships while preserving the existing `father_id`/`mother_id` fields for biological parents.

### Alternative Approaches Considered

| Approach | Pros | Cons |
|----------|------|------|
| **Separate fields** (chosen) | Clear data model, no migration needed for existing data, explicit in frontmatter | More fields to manage |
| **Relationship type qualifier** | Single field per role, flexible | Requires parsing, harder to query |
| **Array of parents with types** | Handles multiple step-parents | Breaking change, complex schema |

---

## Proposed Schema

### New Frontmatter Fields

```yaml
# Biological parents (existing)
father_id: abc-123-def-456
mother_id: ghi-789-jkl-012

# Step-parents (new)
stepfather_id: mno-345-pqr-678
stepmother_id: stu-901-vwx-234

# Adoptive parents (new)
adoptive_father_id: yza-567-bcd-890
adoptive_mother_id: efg-123-hij-456
```

### Multiple Step/Adoptive Parents

For cases with multiple step-parents (e.g., mother remarried twice):

```yaml
stepfather_id:
  - mno-345-pqr-678
  - abc-111-def-222
```

Or with numbered fields (consistent with existing `media`, `media_2` pattern):

```yaml
stepfather_id: mno-345-pqr-678
stepfather_id_2: abc-111-def-222
```

**Recommendation:** Use array format for step/adoptive fields since multiple is common for these relationship types.

---

## Implementation Phases

### Phase 1: Schema & Import Support

**Goal:** Parse GEDCOM relationship types and store in new fields.

**Changes:**

1. **Update `PersonNode` interface** (`src/core/family-graph.ts`)
   ```typescript
   interface PersonNode {
     // Existing
     fatherCrId?: string;
     motherCrId?: string;

     // New
     stepfatherCrIds: string[];
     stepmotherCrIds: string[];
     adoptiveFatherCrId?: string;
     adoptiveMotherCrId?: string;
   }
   ```

2. **Update GEDCOM parser** (`src/gedcom/gedcom-parser-v2.ts`)
   - Parse `PEDI` (pedigree) tags in `FAMC` (family as child) records
   - Values: `birth` (biological), `adop` (adopted), `step`, `foster`
   - Store relationship type with parent references

3. **Update GEDCOM importer** (`src/gedcom/gedcom-importer-v2.ts`)
   - Write to appropriate field based on relationship type
   - Default to biological if `PEDI` tag is absent (standard GEDCOM behavior)

4. **Update person note template** (`src/templates/`)
   - Add optional step/adoptive parent fields

### Phase 2: Conflict Detection Update

**Goal:** Don't flag step/adoptive parents as conflicts.

**Changes:**

1. **Update `DataQualityService`** (`src/core/data-quality.ts`)
   - Exclude step/adoptive parent claims from biological parent conflict detection
   - Add separate validation for step/adoptive relationships (orphan refs, etc.)

2. **Update Control Center UI** (`src/ui/control-center.ts`)
   - Show step/adoptive parents in person details
   - Distinguish relationship types visually

### Phase 3: Canvas & Tree Support

**Goal:** Visualize non-biological relationships on canvas.

**Changes:**

1. **Edge styling for relationship types**
   - Biological: solid line
   - Step: dashed line
   - Adoptive: dotted line (or different color)

2. **Tree generation options**
   - Toggle: Include step-parents in tree
   - Toggle: Include adoptive parents in tree

3. **Legend for relationship types**

---

## GEDCOM Pedigree Types

Reference for GEDCOM `PEDI` (pedigree linkage type) values:

| Value | Meaning | Canvas Roots Field |
|-------|---------|-------------------|
| `birth` | Biological child | `father_id`, `mother_id` |
| `adop` | Legally adopted | `adoptive_father_id`, `adoptive_mother_id` |
| `step` | Step-child | `stepfather_id`, `stepmother_id` |
| `foster` | Foster child | (future: `foster_father_id`, `foster_mother_id`) |
| (absent) | Assumed biological | `father_id`, `mother_id` |

**GEDCOM Example:**
```gedcom
0 @I1@ INDI
1 NAME John /Smith/
1 FAMC @F1@
2 PEDI birth
1 FAMC @F2@
2 PEDI step
```

This indicates John is a biological child in family F1 and a step-child in family F2.

---

## Files to Modify

### Phase 1
- `src/types/person.ts` — Add step/adoptive parent fields to interface
- `src/core/family-graph.ts` — Update PersonNode, graph building logic
- `src/gedcom/gedcom-parser-v2.ts` — Parse PEDI tags
- `src/gedcom/gedcom-importer-v2.ts` — Write to appropriate fields
- `src/templates/person-template.ts` — Add optional fields

### Phase 2
- `src/core/data-quality.ts` — Update conflict detection
- `src/ui/control-center.ts` — Show relationship types in UI

### Phase 3
- `src/canvas/tree-builder.ts` — Support non-biological edges
- `src/canvas/canvas-exporter.ts` — Edge styling by type
- `styles.css` — Edge style classes

---

## Testing Plan

1. **GEDCOM import tests**
   - Import file with `PEDI step` relationships
   - Verify step-parents stored in correct fields
   - Verify biological parents unchanged

2. **Conflict detection tests**
   - Step-parent + biological parent: no conflict
   - Two biological fathers: conflict flagged
   - Adoptive parent + biological parent: no conflict

3. **Round-trip export tests**
   - Export to GEDCOM preserves `PEDI` tags
   - Re-import produces identical data

---

## Open Questions

1. **Foster parents:** Include in Phase 1 or defer?
2. **Guardians:** Legal guardianship is different from step/adoptive — support?
3. **Godparents:** Spiritual parentage — separate feature or include here?
4. **Multiple biological parents:** DNA-confirmed cases with donor/surrogate — future scope?

---

## Related Features

- [GEDCOM Import v2](../Release-History#gedcom-import-v2-v0101) — Current import system
- [Data Quality](../Data-Quality) — Conflict detection system
- [Parent Claim Conflicts](../Control-Center#parent-claim-conflicts) — Current conflict UI
