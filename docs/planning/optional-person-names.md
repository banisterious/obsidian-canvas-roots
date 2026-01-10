# Optional Person Names

Planning document for making person names optional in Charted Roots.

- **Status:** Implemented
- **GitHub Issue:** [#140](https://github.com/banisterious/obsidian-charted-roots/issues/140)
- **Created:** 2026-01-05
- **Implemented:** 2026-01-07

---

## Overview

Enable users to create person notes without requiring a name, addressing the common genealogical research scenario where relationships are known before individual identities are discovered.

### Goals

1. **Support real-world research workflows** — Allow tracking of hypothesized persons before names are confirmed
2. **Maintain data integrity** — Use `cr_id`-based linking to ensure relationships work without names
3. **Enable seamless transition** — Automatic file renaming and reference updates when names are added later
4. **Preserve existing workflows** — Non-breaking change that coexists with manual placeholder approaches

### Non-Goals

- Requiring migration of existing placeholder notes (e.g., "[father of John]")
- Enforcing a specific placeholder naming convention
- Automatic detection/conversion of existing placeholder patterns

---

## Problem Statement

**Common research scenario:**
> "I need to add person A's parents so I can add their siblings, but I don't know the parents' names yet."

**Current workaround:**
Users manually create placeholder names like:
- Given name: `[father of John]`
- Surname: `[Smith]`

**Evidence from community:**
- @ANYroots uses systematic placeholder format: `[father/mother/parent] of [Person A's firstname]`
- @wilbry emphasizes tracking hypothesized persons in research workflows
- Multiple users report this as a blocking issue in their research process

---

## Proposed Solution

Make the name field optional in person creation modals, with smart handling for unnamed persons.

### Technical Foundation

The codebase already supports this pattern:
- **Relationships use `cr_id` for linking** — Names are not required for relationship integrity
- **Dual storage pattern** — Both `cr_id` properties and wikilinks maintained
- **Existing rename functionality** — File renames already update all wikilink references
- **Filename fallback** — `formatFilename()` already handles empty names with fallback to "Unknown"

---

## Implementation Plan

### Phase 1: Core Functionality

**Status:** Implemented

**Features:**
1. **Optional name fields**
   - Make Given Name and Surname optional in Create Person modal
   - At least one of {Given Name, Surname, `cr_id`} must exist
   - Validation: Show warning if creating completely blank person

2. **Smart filename handling**
   - When name is empty: Use `cr_id` as filename (e.g., `cr-abc123.md`)
   - When partial name: Use existing logic (e.g., `john.md`, `smith.md`)
   - When full name added later: Trigger automatic rename

3. **Automatic file renaming**
   - Leverage existing rename functionality in person-note-writer.ts
   - Update all wikilink references automatically
   - Preserve `cr_id` (unchanged during rename)

4. **Display handling**
   - Show `cr_id` in UI where name would normally appear
   - Use muted/subtle styling to indicate unnamed status
   - Preserve functionality in all views (family charts, timelines, etc.)

**Files to modify:**
- `src/ui/modals/create-person-modal.ts` — Make name fields optional
- `src/core/person-note-writer.ts` — Update validation, leverage existing `formatFilename()` fallback
- `src/ui/components/person-card.ts` — Display `cr_id` for unnamed persons
- UI components that display person names — Add unnamed styling

**Testing priorities:**
- Create unnamed person and verify `cr_id` filename
- Add name to unnamed person and verify automatic rename
- Verify relationship links survive rename
- Test family chart display with unnamed persons

### Phase 2: Metadata & Filtering

**Status:** Future enhancement

**Features:**
1. **Optional `placeholder` property**
   - Opt-in checkbox in Create Person modal
   - Allows users to distinguish "temporarily unnamed" from "true unknown"
   - Property: `placeholder: true` (boolean)

2. **Visual indicators**
   - Subtle styling for unnamed persons in UI
   - Icon or badge indicating placeholder status
   - Not intrusive — just enough to identify at a glance

3. **Dashboard filtering**
   - Research Gaps Report: Filter for unnamed persons
   - Separate filter for `placeholder: true` persons
   - Helps track research progress on unknowns

**Future considerations:**
- Research workflow integration (#125) — Link to research projects tracking unknown persons
- Bulk operations on placeholder persons
- Statistics/counts of unnamed persons in dashboard

---

## User Workflows

### Workflow 1: Creating Unknown Parent

1. User has person "John Smith" with unknown parents
2. Click "Add Parent" → Create Person modal opens
3. Leave Given Name and Surname empty
4. Optionally check "Mark as placeholder"
5. Click Create → File created as `cr-abc123.md`
6. Relationship automatically created using `cr_id`
7. Later: User discovers parent's name is "Robert Smith"
8. Edit person → Add Given Name "Robert", Surname "Smith"
9. File automatically renames to `robert-smith.md`
10. All wikilinks update automatically

### Workflow 2: Tracking Hypothesized Person

1. User reviewing census record with unnamed child
2. Create Person modal → Leave name empty
3. Check "Mark as placeholder" to indicate research needed
4. Add other known data (birth year estimate, location, etc.)
5. Link to siblings/parents via relationships
6. Use Research Gaps Report to track unnamed persons
7. Fill in name when discovered through continued research

### Workflow 3: Existing Placeholder Migration (Optional)

Users with existing `[father of John]` placeholder notes can:
- **Option A:** Leave them as-is (fully compatible)
- **Option B:** Manually convert to unnamed persons when convenient
- No forced migration required

---

## Migration & Compatibility

### For Existing Users

**No breaking changes:**
- Existing notes with placeholder names work as-is
- Name field validation unchanged for existing workflows
- Optional feature — users can ignore if preferred

**Coexistence:**
- Manual placeholder approach: `[father of John]` still works
- New unnamed approach: `cr-abc123.md` works alongside
- Users choose which approach fits their workflow

### For Developers

**API compatibility:**
- No changes to `cr_id` handling
- No changes to relationship linking
- Leverages existing rename functionality
- Filename format remains backward compatible

---

## Design Decisions

### 1. Filename Format

**Decision:** Use `cr_id` as filename for unnamed persons

**Rationale:**
- Guaranteed unique (no collisions)
- Already used internally for relationships
- Clear indicator that person is unnamed
- Automatic rename when name added

**Alternatives considered:**
- Sequential numbering (`unknown-001.md`) — Harder to guarantee uniqueness
- Timestamp-based (`unnamed-20260105.md`) — Less meaningful
- Leave blank validation in place — Blocks legitimate use case

### 2. Placeholder Property

**Decision:** Opt-in checkbox (not automatic)

**Rationale:**
- Distinguishes "temporarily unnamed during active research" from "true unknown placeholder"
- User signals intent explicitly
- Avoids assuming all unnamed persons are placeholders
- Simpler initial implementation

**Alternatives considered:**
- Auto-add `placeholder: true` to all unnamed — Assumes intent
- Separate "Unknown Person" entity type — Over-engineering
- No metadata at all — Harder to filter/report later

### 3. Display Format

**Decision:** Show `cr_id` with subtle styling

**Rationale:**
- Preserves all UI functionality
- Clear visual indicator of unnamed status
- Not intrusive or distracting
- Familiarizes users with `cr_id` concept

**Alternatives considered:**
- Show "[Unnamed]" placeholder text — Less specific
- Leave blank in UI — Confusing, breaks assumptions
- Show relationships instead ("Father of John") — Complex to implement

---

## Testing Plan

### Phase 1 Testing

**Core functionality:**
1. Create person with no name → Verify `cr_id` filename created
2. Create person with partial name → Verify standard filename format
3. Add name to unnamed person → Verify automatic rename
4. Verify relationship links survive rename
5. Test family chart display with unnamed persons
6. Test timeline with unnamed persons
7. Test Bases views with unnamed persons

**Edge cases:**
1. Multiple unnamed persons (ensure unique filenames)
2. Rename unnamed person multiple times
3. Delete unnamed person → Verify orphan cleanup
4. Import GEDCOM with unnamed persons
5. Export to GEDCOM with unnamed persons

### Phase 2 Testing

**Metadata & filtering:**
1. Create person with `placeholder: true`
2. Filter Research Gaps Report by unnamed persons
3. Filter by placeholder status
4. Dashboard statistics for unnamed persons

**Visual indicators:**
1. Unnamed styling appears in all views
2. Placeholder badge displays correctly
3. No layout issues in compact views

---

## Documentation Plan

### User Guide Updates

**New section: Working with Unnamed Persons**
- When to use unnamed persons vs. placeholder names
- How to create unnamed persons
- How adding a name triggers automatic rename
- Using the placeholder property for research tracking
- Filtering and reporting on unnamed persons

**Update existing sections:**
- Creating People: Document optional name fields
- Relationships: Clarify that names are not required
- Research Workflows: Add unnamed persons to research tracking guidance

### Developer Documentation

**Implementation notes:**
- `cr_id`-based filename generation
- Rename trigger conditions
- Wikilink update process
- Display formatting for unnamed persons

---

## Open Questions

1. **GEDCOM export format:** How should unnamed persons be represented in GEDCOM export?
   - Option A: Use `cr_id` as NAME field
   - Option B: Leave NAME field empty (check GEDCOM spec compliance)
   - Option C: Use placeholder format `[Unknown]`

2. **Search behavior:** Should unnamed persons be searchable by `cr_id`?
   - Useful for debugging and research tracking
   - But may clutter search results

3. **Relationship display:** In family charts, show relationship label for unnamed persons?
   - E.g., "Father of John" instead of just `cr-abc123`
   - More intuitive but harder to implement
   - Could be Phase 3 enhancement

---

## Related Documents

- [Research Tracking Discussion](#125)
- [Dual Storage Pattern](../developer/architecture/dual-storage.md)
- [Person Note Writer](../developer/implementation/person-note-writer.md)

---

## Notes

This feature enables a workflow pattern that users are already implementing manually through placeholder names. The implementation formalizes and streamlines this pattern while maintaining backward compatibility with existing approaches.

**Community input:**
- @ANYroots: Uses `[father/mother/parent] of [Person A's firstname]` placeholder format
- @wilbry: Emphasizes importance of tracking hypothesized persons in research workflows
