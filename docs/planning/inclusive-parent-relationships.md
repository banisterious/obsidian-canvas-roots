# Inclusive Parent Relationships

Planning document for adding gender-neutral parent relationship support.

- **Status:** Completed
- **GitHub Issue:** #63
- **Created:** 2025-12-27
- **Updated:** 2025-12-29

---

## Overview

Some users have nonbinary parents or prefer gender-neutral terminology. Currently, the plugin only supports gendered parent fields (father/mother), which doesn't accommodate all family structures.

**Goal:** Add opt-in support for gender-neutral parent relationships while preserving the existing father/mother fields for users who prefer them.

---

## User Request

> "What if one or both parents are nonbinary? Could you add a 'Parent' option to father/mother?"

This is a reasonable request that aligns with the plugin's goal of supporting diverse family structures.

---

## Design Principles

1. **Opt-in, not replacement** - Don't remove or replace father/mother; add alongside
2. **Configurable** - Let users customize the label to their preference
3. **Non-disruptive** - Users with traditional setups shouldn't notice any change
4. **Coexistent** - A person can have a father, a mother, AND parents (e.g., for blended families or to represent the same people differently)

---

## Proposed Settings

### Setting 1: Enable Inclusive Parent Relationships

| Property | Value |
|----------|-------|
| Name | `enableInclusiveParents` |
| Type | Toggle (boolean) |
| Default | `false` (off) |
| Location | Control Center > Preferences |

**When enabled:**
- Shows a "Parents" (or custom label) field in Create/Edit Person modal
- Adds `parents` and `parents_id` properties to person schema
- Includes parents in relationship displays and family graph

**When disabled:**
- No UI changes
- Existing father/mother fields work as before

### Setting 2: Parent Field Label

| Property | Value |
|----------|-------|
| Name | `parentFieldLabel` |
| Type | Text input |
| Default | `"Parents"` |
| Location | Control Center > Preferences (only shown when Setting 1 is enabled) |

**Purpose:** Customize the label shown in the UI for the gender-neutral parent field.

**Examples:**
- "Parents" (default)
- "Progenitors"
- "Guardians"
- Any user-defined term

---

## Schema Changes

### New Frontmatter Properties

```yaml
# Person note frontmatter
parents:
  - "[[Alex Smith]]"
  - "[[Jordan Smith]]"
parents_id:
  - "I0045"
  - "I0046"
```

### Property Definitions

| Property | Type | Description |
|----------|------|-------------|
| `parents` | array of wikilinks | Gender-neutral parent references |
| `parents_id` | array of strings | Canvas Roots IDs for parents |

### Relationship to Existing Properties

The `parents` array is **independent** of `father`/`mother`:
- A person can have `father`, `mother`, AND `parents`
- They represent different ways to model the same or different relationships
- No automatic syncing between them (user decides how to use)

**Use cases:**
- User prefers gender-neutral terms → use only `parents`
- User has one gendered and one non-gendered parent → use `father` + `parents`
- User migrating from father/mother → can use both during transition

---

## UI Changes

### Create/Edit Person Modal

When `enableInclusiveParents` is enabled, add a new section:

```
┌─────────────────────────────────────────────┐
│ Parents                                      │
│ ┌─────────────────────────────────────────┐ │
│ │ [Parent picker - multi-select]          │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ Father                                       │
│ ┌─────────────────────────────────────────┐ │
│ │ [Father picker]                         │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ Mother                                       │
│ ┌─────────────────────────────────────────┐ │
│ │ [Mother picker]                         │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Field placement options:**
1. **Above father/mother** - Emphasizes the gender-neutral option
2. **Below father/mother** - Keeps existing fields in familiar position
3. **Separate section** - "Gender-Neutral Parents" collapsible section

Recommended: Option 1 (above), with the custom label from Setting 2.

### Inline Creation (Phase 1 of Create Person Enhancements)

When creating a parent inline:
- "Create new parent" option in parents picker
- No gender pre-fill (unlike father/mother which pre-fill sex)
- Returns to modal with new person linked in `parents` array

---

## Implementation Plan

### Phase 1: Settings and Schema

1. Add `enableInclusiveParents` toggle to settings
2. Add `parentFieldLabel` text setting (conditional visibility)
3. Add `parents` and `parents_id` to person schema
4. Update Frontmatter Reference documentation

### Phase 2: Create/Edit Modal

1. Add parents field to CreatePersonModal (when enabled)
2. Implement multi-select person picker for parents
3. Support inline creation of new parents
4. Handle saving/loading of `parents` array

### Phase 3: Family Graph Integration

1. Update FamilyGraphService to recognize `parents` relationships
2. Include parents in ancestor/descendant calculations
3. Display parents in relationship views
4. Consider parents for bidirectional linking

### Phase 4: Bidirectional Linking

**Decision: Automatic bidirectional linking using `children` array**

When a person is added to the `parents` array, automatically add them to each parent's `children` array:

1. **Jamie's note:**
   ```yaml
   parents:
     - "[[Alex Smith]]"
     - "[[Jordan Smith]]"
   parents_id:
     - "I0045"
     - "I0046"
   ```

2. **Alex's note (automatically updated):**
   ```yaml
   children:
     - "[[Jamie Smith]]"
   ```

3. **Jordan's note (automatically updated):**
   ```yaml
   children:
     - "[[Jamie Smith]]"
   ```

**Implementation:**
- Use `children` array (consistent with existing father/mother → children pattern)
- Each parent in `parents` array gets the child added to their `children` array
- Deduplication: Don't add duplicates if child already exists
- Mixed usage: If a person uses both `parents` and `father`/`mother`, all relationships are honored independently

---

## Decisions Made

1. **Bidirectional linking behavior** ✓
   - **Decision:** Automatic bidirectional linking using `children` array
   - When adding someone as a `parent`, automatically add the child to their `children` array
   - See Phase 4 implementation details above

2. **Canvas visualization** ✓
   - **Decision:** Same visual treatment as father/mother, just different label
   - No special color/icon distinction needed
   - The label difference is sufficient

3. **Property alias interaction** ✓
   - **Decision:** UI label only, keep `parents` as canonical property name
   - If user sets label to "Guardians", the UI shows "Guardians" but frontmatter stays `parents: [[...]]`
   - Ensures consistency and makes documentation easier to follow

4. **Migration path** ✓
   - **Decision:** No migration tool needed
   - Users can use both systems as they prefer (coexistence is the goal)
   - Manual conversion is simple enough if users want to switch

5. **Gramps/GEDCOM import** ✓
   - **Decision:** Keep imports gendered (existing behavior)
   - Import continues using father/mother; users can manually adjust afterward
   - Future enhancement: Optional toggle to import as gender-neutral (deferred)

---

## Implementation Checklist

### Phase 1: Settings and Schema
- [x] Add `enableInclusiveParents` toggle to Control Center > Preferences
- [x] Add `parentFieldLabel` text setting (conditional visibility when toggle is on)
- [x] Add `parents` and `parents_id` to PersonFrontmatter type definition
- [x] Update Frontmatter Reference documentation

### Phase 2: Create/Edit Modal
- [x] Add parents field to CreatePersonModal (multi-select, like children field)
- [x] Implement "Add parent" button with person picker
- [x] Support inline creation of new parents (via person picker)
- [x] Handle saving/loading of `parents` and `parents_id` arrays
- [x] Only show parents field when `enableInclusiveParents` is enabled
- [x] Use `parentFieldLabel` setting for field label (default: "Parents")

### Phase 3: Family Graph Integration
- [x] Update FamilyGraphService to read `parents`/`parents_id` relationships
- [x] Include parents in ancestor/descendant calculations
- [x] Display parents in relationship views (canvas-roots-relationships block)
- [x] Treat parents same as father/mother for graph traversal

### Phase 4: Bidirectional Linking
- [x] Update BidirectionalLinker to handle `parents` → `children` linking
- [x] When parent is added to `parents` array, add child to parent's `children` array
- [x] Implement deduplication (don't add if already exists)
- [x] Handle removal (when parent removed from `parents`, remove child from their `children`)
- [x] Test mixed usage (both `parents` and `father`/`mother` on same person)

### Documentation and Testing
- [x] Update Data Entry documentation
- [x] Add CHANGELOG entry
- [x] Test with various family configurations
- [x] Test bidirectional linking edge cases
- [x] Test with property aliases enabled

---

## Related Documents

- [Create Person Enhancements](./archive/create-person-enhancements.md) - Inline creation features
- [Frontmatter Reference](../../wiki-content/Frontmatter-Reference.md) - Property documentation
- [Data Entry](../../wiki-content/Data-Entry.md) - Modal documentation
- [UI Mockup](../mockups/create-person-modal-inclusive-parents.html) - Visual design for Create Person modal with parents field
