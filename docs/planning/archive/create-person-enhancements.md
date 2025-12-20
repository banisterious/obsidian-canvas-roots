# Create Person Enhancements

Planning document for enhancing person creation workflows.

**Status:** Planning
**GitHub Issue:** #TBD
**Created:** 2025-12-18

---

## Overview

User feedback requests improvements to the Create Person modal, specifically:
1. Add place picker/linking for birth and death places
2. Reorder fields to group related data (birth date + place, death date + place)
3. Add source linking capability

We're addressing this with a two-phase approach.

---

## Phase 1: Enhance Create Person Modal

Improve the existing modal while keeping it quick and lightweight.

### Scope

1. **Place picker for birth/death places**
   - Add "Link" button next to birth_place and death_place text fields
   - Opens place picker modal (search existing place notes with `cr_type: place`)
   - Selected place populates the field as a wikilink
   - Option to create new place inline if none exists (TBD based on user feedback)

2. **Field reordering**
   - Current: all dates together, all places together
   - Proposed:
     - Birth date
     - Birth place (with Link button)
     - Death date
     - Death place (with Link button)
   - Groups related information logically

3. **Source linking (TBD)**
   - Awaiting user feedback on workflow requirements
   - May defer to Phase 2 if semantics are unclear

### Implementation Notes

- Reuse existing person picker pattern for place picker
- Place picker filters to notes with `cr_type: place`
- Consider dual storage: wikilink in `birth_place`, cr_id in `birth_place_id`

### Open Questions

1. When linking to a place, should we populate both wikilink AND copy name as text, or just wikilink?
2. Should inline place creation be supported, or just text entry for new places?
3. What does source linking mean semantically at person-creation time?

---

## Phase 2: Create Person Wizard

A multi-step wizard for comprehensive data entry, similar to Universe Setup Wizard.

### Proposed Steps

1. **Identity**
   - Name (first, last, or combined)
   - Sex/gender
   - cr_id (auto-generated, optionally customizable)
   - Collection assignment
   - Universe assignment

2. **Life Events**
   - Birth date + place (with link capability)
   - Death date + place (with link capability)
   - Living status toggle

3. **Relationships**
   - Father (with Link to existing person)
   - Mother (with Link to existing person)
   - Spouse(s) (with Link to existing person)
   - Children (optional, for linking existing people as children)

4. **Sources** (optional step)
   - Link source notes that document this person
   - Semantics TBD based on user feedback

5. **Options**
   - Target folder
   - Filename format
   - Include dynamic blocks toggle
   - Open note after creation

### Features

- Steps can be skipped (all optional except Identity)
- Remember last-used settings (folder, collection, universe)
- Preview of frontmatter before creation
- Validation at each step

### Implementation Notes

- Follow Universe Wizard patterns for UI consistency
- Reuse components from Phase 1 (place picker, person picker)
- Consider wizard state persistence across Obsidian restarts

---

## User Feedback Pending

Questions posted to GitHub issue:

1. Place linking: wikilink only vs wikilink + text?
2. Inline place creation: needed or text sufficient?
3. Source workflow: general sources vs fact-specific citations?
4. Source linking: essential for Phase 1 or deferrable?
5. Phased approach alignment with user needs?

---

## Technical Considerations

### Place Picker Component

```typescript
interface PlacePickerOptions {
  app: App;
  onSelect: (place: { name: string; crId: string; file: TFile }) => void;
  onCreateNew?: (name: string) => void;  // Optional inline creation
  placeholder?: string;
}
```

### Frontmatter Output

Phase 1 modal should produce:
```yaml
cr_id: person-abc123
cr_type: person
name: John Smith
born: 1845-03-12
birth_place: "[[Dublin, Ireland]]"
birth_place_id: place-dublin-ireland
died: 1920-07-04
death_place: "[[Boston, Massachusetts]]"
death_place_id: place-boston-ma
```

---

## Timeline

- **Phase 1:** Target for next minor release
- **Phase 2:** Future release, after Phase 1 feedback

---

## Related Documents

- [Universe Setup Wizard](../architecture/universe-wizard.md) - Pattern reference
- [Frontmatter Reference](../../wiki-content/Frontmatter-Reference.md) - Property documentation
- [Data Entry](../../wiki-content/Data-Entry.md) - Current documentation
