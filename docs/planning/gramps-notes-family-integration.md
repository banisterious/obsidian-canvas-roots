# Gramps Notes & Family Entity Integration

Planning document for Gramps notes import/export and potentially introducing a Family entity type.

**Status:** Planning
**GitHub Issue:** #TBD
**Priority:** Medium
**Created:** 2025-12-26
**Updated:** 2025-12-27

---

## Overview

Gramps allows attaching notes to various entities (people, families, events, places, sources, etc.). These notes are free-form text that can contain research notes, biographical information, source transcriptions, and more. Users importing from Gramps expect their notes to be preserved.

Additionally, Gramps treats families as first-class entities with their own notes and metadata. This raises the question of whether Canvas Roots should introduce a Family entity type to properly support this data.

---

## Design Principles

Canvas Roots serves a diverse user base. Many users come from GEDCOM files or start fresh in Obsidian — they may never touch Gramps and have no need for advanced sync or note-sharing features.

**Guiding principles for this feature:**

1. **Start conservatively** — Begin with the simplest implementation that meets core needs
2. **Opt-in for advanced features** — Complex capabilities (separate note files, Family entities, sync support) should be optional settings, not defaults
3. **Don't disrupt simple workflows** — Users with basic requirements should not see added complexity
4. **Preserve data** — All Gramps metadata should be captured, even if not immediately used, to enable future features and round-tripping

---

## User Feedback

Forum discussion: https://gramps.discourse.group/t/genealogy-research-in-obsidian-for-those-who-want-to-try/8926/4

A Gramps user provided detailed feedback suggesting:

1. **Notes as first-class entities** — Each note should be an independent file, not embedded text
2. **Preserve all metadata** — Note types, privacy flags, and other attributes in frontmatter
3. **Per-object folder structure** — Each entity gets a folder with subfolders for notes
4. **Family notes support** — Families should have their own Markdown files
5. **Internal/external links** — Convert Gramps object references to wikilinks
6. **Bi-directional sync** — Support for syncing changes back to Gramps
7. **Privacy flag handling** — Respect private flags, especially for synced vaults
8. **Link back to Gramps** — Obsidian files as media objects in Gramps

**Pending questions for the user:**
- How often are notes shared across multiple entities?
- What's the typical use case for family-level notes?
- Is the workflow one-time import or ongoing sync?
- What triggers marking notes as private?
- Do they use Obsidian Sync or publish their vault?

---

## Background Research

### Gramps Note Structure (from grampsxml.dtd)

```xml
<!ELEMENT note (text, style*, tagref*)>
<!ATTLIST note
        id        CDATA #IMPLIED
        handle    ID    #REQUIRED
        priv      (0|1) #IMPLIED
        change    CDATA #REQUIRED
        format    (0|1) #IMPLIED
        type      CDATA #REQUIRED
>

<!ELEMENT noteref EMPTY>
<!ATTLIST noteref hlink IDREF #REQUIRED>
```

### Gramps Family Structure (from grampsxml.dtd)

```xml
<!ELEMENT family (rel?, father?, mother?, eventref*, lds_ord*, objref*,
                  childref*, attribute*, noteref*, citationref*, tagref*)>
<!ATTLIST family
        id        CDATA #IMPLIED
        handle    ID    #REQUIRED
        priv      (0|1) #IMPLIED
        change    CDATA #REQUIRED
>
```

### Entities That Can Have Notes

According to the DTD, the following elements can contain `noteref`:
- **person** - directly and within names, addresses, person references
- **family** - directly and within child references
- **event** - directly
- **place** (placeobj) - directly
- **source** - directly (already implemented!)
- **citation** - directly
- **object** (media) - directly
- **repository** - directly

### Note Types

Common note types in Gramps:
- Person Note
- Research
- Transcript
- Source text
- Citation
- General
- Custom user-defined types

### Current Implementation

- Notes are already parsed in `gramps-parser.ts` (line 480-487)
- Notes are stored in `database.notes` Map
- Source notes are already resolved and used (line 359-370)
- `GrampsPerson` type does not currently include `noteRefs`
- `GrampsFamily` is parsed but only used to derive person relationships
- Canvas Roots has no Family entity — relationships are properties on Person notes

---

## Proposed Implementation

### Phase 1: Embedded Person Notes (Conservative)

The simplest approach that meets core needs.

1. **Extend `GrampsPerson` interface**
   - Add `noteRefs: string[]` field

2. **Parse person note references**
   - In `parsePerson()`, extract `noteref` elements
   - Store handle references in `noteRefs` array

3. **Add import option**
   - Add `importNotes: boolean` to `GrampsImportOptions`
   - Default: enabled (notes are valuable data)
   - Add toggle in Import Wizard UI

4. **Append notes to person content**
   - Add "## Notes" section at bottom of person note
   - Include note type as subsection header if multiple notes
   - Preserve note text content
   - Add `private: true` to frontmatter if any note has `priv="1"`

5. **Preserve metadata**
   - Note type as header: `### Research Note`
   - Private flag as frontmatter property

### Phase 2: Other Entity Notes

Extend the embedded approach to other entities.

- Event notes → append to event note content
- Place notes → append to place note content
- Source notes → already implemented
- Family notes → see Phase 3

### Phase 3: Family Entity (Advanced, Opt-in)

Introduce Family as a new entity type in Canvas Roots.

**Motivation:**
- Natural home for family-level notes
- Matches Gramps/GEDCOM mental model
- Place for marriage events, shared research, household information

**Implementation:**
- Add `cr_type: family` entity type
- Create `Families/` folder during import
- Family note includes:
  - Parents (wikilinks to Person notes)
  - Children (wikilinks to Person notes)
  - Marriage/partnership events
  - Family notes section
- Add to Bases templates

**Trade-offs:**
- Adds complexity to the data model
- Some information becomes duplicated (parent/child relationships exist on both Person and Family)
- Requires new UI components, service layer, etc.

**Should be opt-in:** Import wizard checkbox "Create family notes" (default: off)

### Phase 4: Separate Note Files (Advanced, Opt-in)

For users who need notes as independent, linkable entities.

- Each Gramps note becomes its own Markdown file in a `Notes/` folder
- Parent entity links to note files instead of embedding content
- Enables note sharing across multiple entities
- Required for accurate round-trip sync to Gramps

**Should be opt-in:** Import wizard checkbox "Create separate note files" (default: off)

### Phase 5: Export & Sync (Future)

Support for exporting notes back to Gramps and potentially bi-directional sync.

**User feedback suggests:**
- `sync-status: draft | synced | ignore` frontmatter field to control what gets pushed back
- Dedicated folder structure makes change detection easier
- Obsidian note files could be linked as media objects in Gramps

**Requirements for round-trip support:**
- Preserve Gramps handles (`gramps_handle` in frontmatter) - already done for some entities
- Avoid lossy transformations during import
- Track which notes were created in Obsidian vs. imported from Gramps
- Handle conflicts (same note edited in both places)

**Implementation considerations:**
- Requires Phase 4 (separate note files) for accurate note-level sync
- May require Phase 3 (Family entity) to preserve family-level notes
- Export would extend existing Gramps XML export functionality
- True "sync" is complex; "export changes" is more tractable

**Status:** Deferred. Capture requirements now, implement after Phases 1-4 are stable and user feedback confirms demand.

---

## Privacy Handling

The `priv` attribute on Gramps notes indicates private/sensitive content.

**Options:**

1. **Frontmatter flag only** (Phase 1)
   - Add `private: true` to entity frontmatter if any attached note is private
   - User responsible for configuring sync/publish exclusions
   - Simple but not foolproof

2. **Separate folder** (Phase 3+)
   - Private notes go in a `Private/` folder
   - Easier to exclude from sync via folder rules
   - More robust but changes file organization

3. **Skip private notes**
   - Don't import notes marked private
   - Add import option: "Skip private notes"
   - Safest for shared vaults but loses data

**Recommendation:** Start with option 1, add options 2-3 as advanced settings.

---

## Open Questions

### Resolved

1. **Where should notes appear in person notes?**
   → Phase 1: Bottom of note content (after dynamic blocks), as "## Notes" section
   → Phase 4: Separate note files with full metadata in frontmatter (user-preferred approach for round-tripping)

   *Note: Phase 1's embedded approach trades some metadata fidelity for simplicity. Users needing full Gramps metadata preservation (handles, per-note privacy flags) should use Phase 4.*

2. **How to handle multiple notes per person?**
   → Separate subsections by note type

3. **Should note type be preserved?**
   → Yes, as header: `### Research Note`

4. **Default behavior?**
   → Notes import enabled by default (valuable data); Family entity and separate files are opt-in

### Still Open

1. **How to handle styled/formatted notes?**
   - Gramps notes can have `<style>` elements for formatting
   - Convert to Markdown formatting?
   - Strip formatting and import plain text only?
   - Start with plain text, add formatting support later?

2. **Note sharing patterns?**
   - Waiting for user feedback on how often notes are shared across entities
   - If rare, embedded approach is fine
   - If common, separate files become more important

3. **The `format` attribute**
   - What does `format="0"` vs `format="1"` indicate?
   - Needs research in Gramps documentation

4. **Note tags (`tagref`)**
   - Should Gramps note tags become Obsidian tags?
   - How to namespace them to avoid conflicts?

5. **Family entity adoption**
   - Depends on user feedback about family note usage
   - May be needed regardless for proper Gramps round-tripping

---

## Technical Notes

### Files to Modify

**Phase 1:**
- `src/gramps/gramps-types.ts` - Add `noteRefs` to `GrampsPerson`
- `src/gramps/gramps-parser.ts` - Parse person noteref elements
- `src/gramps/gramps-importer.ts` - Resolve and append notes to content
- `src/ui/import-wizard-modal.ts` - Add import toggle

**Phase 3 (Family Entity):**
- `src/models/family.ts` - New Family model
- `src/core/family-service.ts` - New service layer
- `src/gramps/gramps-importer.ts` - Create family notes
- `src/bases/family-base-template.ts` - Bases integration
- Settings and UI updates

### Example Output (Phase 1)

```markdown
---
name: John Smith
birth_date: 1850-03-15
private: true
# ... other frontmatter
---

## Notes

### Research Note
Census records show John living with his parents in 1860.
Further research needed to confirm birth location.

### Person Note
Biographical information from family bible.
```

### Example Output (Phase 3 - Family Entity)

```markdown
---
cr_type: family
cr_id: family_F0001
gramps_handle: _abc123
private: false
---

## Parents

- Father: [[John Smith]]
- Mother: [[Jane Doe]]

## Children

- [[James Smith]]
- [[Mary Smith]]

## Events

- Marriage: [[Marriage of John Smith and Jane Doe]]

## Notes

### Family Note
The Smith family emigrated from Ireland during the famine years.
```

---

## References

- [Gramps XML Format](https://www.gramps-project.org/wiki/index.php/Gramps_XML)
- [grampsxml.dtd on GitHub](https://github.com/gramps-project/gramps/blob/master/data/grampsxml.dtd)
- [Forum Discussion](https://gramps.discourse.group/t/genealogy-research-in-obsidian-for-those-who-want-to-try/8926/4)
