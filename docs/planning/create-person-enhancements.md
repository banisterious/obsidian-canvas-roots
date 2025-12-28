# Create Person Enhancements

Planning document for enhancing person creation and editing workflows.

- **Status:** Planning (Phase 1 scoped for v0.18.1)
- **GitHub Issue:** #TBD
- **Created:** 2025-12-18
- **Updated:** 2025-12-28

---

## Overview

The core problem: **Building a family tree from scratch requires constant jumping in and out of modals.**

A new user scenario illustrates this:
> "I know my wife, I know my kids, I know my parents. Who should I create first? I was hoping to start with anyone and create additional parents/kids up and down the tree without having to save and exit out of the screen for the person you are editing/creating, click another edit/create button, look up another person, edit them, jump out of that screen to go look up another person, jumping round and round."

The current workflow forces users into a tedious loop:
1. Create Person A → Save → Close
2. Create Person B → Save → Close
3. Edit Person A to link B as spouse → Save → Close
4. Create Child C → Save → Close
5. Edit Child C to set parents → Save → Close
6. ...repeat endlessly

**Goal:** Enable continuous family creation without leaving the modal flow.

---

## Phase 1: Inline Person Creation (v0.18.1)

Allow creating new family members directly from within the Create/Edit Person modal.

### Core Feature: "Create New" in Person Pickers

When selecting a father, mother, spouse, or child, offer a "Create new person" option that:
1. Opens a sub-modal to create the new person
2. Automatically creates the note
3. Returns to the parent modal with the new person linked
4. User never loses context of who they're editing

### Scope

1. **Inline creation for all relationship fields**
   - Father picker: "Create new father" option
   - Mother picker: "Create new mother" option
   - Spouse picker: "Create new spouse" option
   - (Children picker deferred to Phase 2)

2. **Smart defaults for new inline persons**
   - Creating a father → pre-fill `sex: male`
   - Creating a mother → pre-fill `sex: female`
   - Creating a spouse → no sex pre-fill (unknown)

3. **Simplified sub-modal (QuickCreatePersonModal)**
   - Fields: name (required), sex (pre-filled where applicable), birth date (optional)
   - "Create and link" button creates note and returns to parent modal
   - No relationship fields in sub-modal (avoids nesting complexity)
   - Uses same directory as parent modal context

### Design Decisions

1. **Sub-modal is simplified, not full CreatePersonModal**
   - Rationale: Full modal would allow infinite nesting (create father → create father's father → etc.)
   - Quick create covers 90% of use cases; user can edit full details later
   - Matches PlacePickerModal's inline create pattern

2. **Single-level nesting only (v1)**
   - Sub-modal does not offer its own "Create new" options
   - User creates one person, returns to parent, can repeat as needed
   - Future: Could allow deeper nesting if requested

3. **No "recent creations" section (v1)**
   - Keep UI simple initially
   - Sort by "recently modified" already surfaces new people
   - Future: Add if users request it

### UI Flow

```
CreatePersonModal
  └── Father field → [Link] button
        └── PersonPickerModal
              ├── Search existing people
              ├── [+ Create new father] ← NEW
              │     └── QuickCreatePersonModal (name, sex=male, birth date)
              │           └── [Create and link] → creates note, returns PersonInfo
              └── Select existing person
```

### Implementation Notes

- Add `onCreateNew?: (context: RelationshipContext) => void` callback to PersonPickerModal
- New `QuickCreatePersonModal` class - minimal fields, single "Create and link" button
- Context passed to callback includes: relationship type, parent person's cr_id, suggested sex
- On creation: write note via `createPersonNote()`, return `PersonInfo` to picker
- Picker auto-selects newly created person and closes

### Implementation Checklist

#### Phase 1a: QuickCreatePersonModal
- [ ] Create `src/ui/quick-create-person-modal.ts`
- [ ] Minimal form: name (required), sex dropdown, birth date (optional)
- [ ] Accept `suggestedSex` and `directory` options
- [ ] "Create and link" button calls `createPersonNote()` and returns `PersonInfo`
- [ ] Add `ModalStatePersistence` support (matches CreatePersonModal pattern)
- [ ] Add styles to `styles.css` (reuse existing `.crc-form` classes)

#### Phase 1b: PersonPickerModal Enhancement
- [ ] Add `onCreateNew` callback option to `PersonPickerModal` constructor
- [ ] Add `RelationshipContext` interface: `{ relationshipType, suggestedSex?, parentCrId?, directory? }`
- [ ] Render "+ Create new person" button at top of results (or in header)
- [ ] Button click opens `QuickCreatePersonModal` with context
- [ ] On sub-modal close with result, call `onSelect` with new `PersonInfo`

#### Phase 1c: CreatePersonModal Integration
- [ ] Update `createRelationshipField()` to pass `onCreateNew` to picker
- [ ] Map field type to suggested sex: father→male, mother→female, spouse→undefined
- [ ] Pass current directory to quick create modal
- [ ] Test: create person, add father via picker, create new father inline

#### Phase 1d: Step/Adoptive Parents
- [ ] Extend to stepfather, stepmother, adoptive father, adoptive mother fields
- [ ] Same pattern: pre-fill sex based on field type

#### Phase 1e: Folder Context Menu
- [ ] Add "Create person" to People folder context menu (Canvas Roots submenu)
- [ ] Pass clicked folder path as `directory` option to CreatePersonModal
- [ ] Works for People folder and any subfolder within it

---

## Phase 2: Add Children Section to Edit Modal

> **Depends on:** Phase 1 (uses inline creation pattern). Can be implemented in same release.

Add the ability to view and manage children directly from the Edit Person modal.

### Context

- The plugin already has `child` frontmatter property and bidirectional linking
- Setting `father: [[John]]` on Jane's note automatically adds `[[Jane]]` to John's `child` array
- Users want to link existing children from the parent's perspective (batch operation)
- Combined with Phase 1, this enables creating new children inline

### Scope

1. **Children section in Edit mode**
   - Add "Children" section with multi-select person picker
   - Display currently linked children (from `child` array)
   - Allow adding existing children or creating new ones (via Phase 1)
   - Consider showing in Create mode too for "create whole family" workflow

2. **Parent field auto-detection**
   - When adding children, auto-detect which parent field to set based on parent's `sex` field
   - Male → set child's `father` field
   - Female → set child's `mother` field
   - Unknown/other → prompt user to choose

3. **Bidirectional sync**
   - Adding child to parent's `child` array triggers bidirectional linker
   - Child's `father`/`mother` field updated automatically
   - Removing child updates both directions

### Implementation Notes

- Reuse existing PersonPickerModal with multi-select support
- Similar pattern to existing spouses field
- Consider filtering candidates (people without this person as parent already)

### Open Questions

1. Should we filter candidate children to exclude people already linked to another parent of the same type?
2. Should there be a confirmation when adding many children at once?

---

## Phase 3: "Add Another" Flow

> **Depends on:** Phase 1. Can be implemented alongside Phase 2 if desired.

After creating a person, offer quick actions to continue building the family.

### Concept

When user clicks "Create" (not "Create and Close"), show options:
- **Add spouse** → Opens spouse picker/creator, then returns
- **Add child** → Opens child picker/creator, then returns
- **Add parent** → Opens parent picker/creator, then returns
- **Done** → Closes modal

This keeps the user in a "family building" flow without requiring them to navigate back to find the person they just created.

### Benefits

- Natural workflow: "I just created John, now let me add his wife and kids"
- Reduces navigation and context-switching
- Builds on Phase 1 and 2 infrastructure

---

## Phase 4: Family Creation Wizard (Future)

> **Standalone feature:** Does not depend on Phases 1-3. Addresses a different use case (batch family creation from scratch).

A dedicated wizard for creating an entire nuclear family at once.

### Motivation

For users starting completely fresh, a guided flow could be faster:
1. **Step 1:** Create yourself (or central person)
2. **Step 2:** Add spouse(s)
3. **Step 3:** Add children
4. **Step 4:** Add parents
5. **Review:** See the family structure, confirm and create all notes

### Alternative: Tabbed Modal

Instead of a full wizard, consider a tabbed modal for the Create/Edit Person form:
- Keeps everything in one place
- Organized into collapsible/tabbed sections
- Less disruptive than step-by-step wizard
- Better for quick edits

### Proposed Sections (if tabbed)

| Section | Fields |
|---------|--------|
| **Basic** | Name, sex, nicknames, cr_id |
| **Dates & Places** | Birth date + place, death date + place, living status |
| **Family** | Father, mother, spouses, children |
| **Extended** | Occupations, custom relationships, sources |
| **Options** | Target folder, filename format, dynamic blocks |

### When to Implement

This becomes valuable when:
- Modal complexity continues to grow
- Users report feeling overwhelmed by the form
- Need to add more relationship types or source linking
- Mobile users need simplified entry flow

---

## Bundled Enhancement: Nickname Property Support

> **Standalone feature:** Can be implemented independently. Bundled here for v0.18.1 release.
>
> **GitHub Issue:** [#46](https://github.com/banisterious/obsidian-canvas-roots/issues/46)

Add `nickname` as a first-class frontmatter property on Person notes, with import support.

### Motivation

Users want to capture informal names, aliases, and nicknames:
- "Bobby" for "Robert"
- "Gram" for grandmother
- Stage names, pen names, or titles used in daily life

The `nickname` property already exists in the property alias system (with aliases `alias`, `known_as`, `goes_by`), but:
- It's not in the `PersonData` interface
- Importers don't populate it
- Create/Edit Person modal doesn't show it

### Scope

1. **PersonData interface** — Add `nickname?: string` field
2. **Person note writer** — Write `nickname` to frontmatter when present
3. **Import support**
   - Gramps: Map `nick` element to `nickname` (already parsed, not written)
   - GEDCOM: Map `NICK` tag to `nickname`
   - GEDCOM X: Check for nickname in names array
4. **Create/Edit Person modal** — Add optional nickname field

### Implementation Checklist

#### Nickname Infrastructure
- [ ] Add `nickname?: string` to `PersonData` interface in `person-note-writer.ts`
- [ ] Add nickname writing logic to `createPersonNote()`
- [ ] Add nickname update logic to `updatePersonNote()`

#### Import Support
- [ ] Gramps importer: Populate `nickname` from parsed `nick` field
- [ ] GEDCOM importer: Parse and populate `NICK` tag
- [ ] GEDCOM X importer: Check for nickname name type

#### Modal Integration
- [ ] Add nickname field to CreatePersonModal (optional, after name field)
- [ ] Add nickname field to QuickCreatePersonModal (optional)

---

## Completed Enhancements

### Place Picker Integration ✅ (v0.14.x)

- Added place picker for birth/death places
- Link button opens place picker modal
- Create new place inline if none exists
- Dual storage: wikilink in `birth_place`, cr_id in `birth_place_id`

### Field Reordering ✅ (v0.14.x)

- Grouped related fields logically:
  - Birth date + Birth place
  - Death date + Death place

---

## Known Limitations to Address

### Multiple Spouses in Edit Modal

The current CreatePersonModal only handles a single spouse field, with a comment: "For now, only handle first spouse in the modal." This is a separate issue from the inline creation workflow but should be addressed:

- **Current state:** Only first spouse shown/editable in modal
- **Desired state:** Multi-select spouse field (similar to planned children section)
- **When to fix:** Could be bundled with Phase 2 (children section uses same multi-select pattern)

---

## Related Documents

- [Frontmatter Reference](../../wiki-content/Frontmatter-Reference.md) - Property documentation
- [Data Entry](../../wiki-content/Data-Entry.md) - Current documentation
- [Bidirectional Linking](../../wiki-content/Relationship-Tools.md) - How relationships sync
