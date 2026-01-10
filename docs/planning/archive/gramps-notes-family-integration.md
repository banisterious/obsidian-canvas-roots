# Gramps Notes & Family Entity Integration

Planning document for Gramps notes import/export and potentially introducing a Family entity type.

- **Status:** In Progress (Phases 1, 2 & 4 complete)
- **GitHub Issue:** [#36](https://github.com/banisterious/obsidian-charted-roots/issues/36)
- **Sub-issues:**
  - [#76](https://github.com/banisterious/obsidian-charted-roots/issues/76) Phase 1: Embedded Notes ✅
  - [#77](https://github.com/banisterious/obsidian-charted-roots/issues/77) Phase 2: Other Entity Notes ✅
  - [#79](https://github.com/banisterious/obsidian-charted-roots/issues/79) Phase 3: Family Entity (Optional)
  - [#80](https://github.com/banisterious/obsidian-charted-roots/issues/80) Phase 4: Separate Note Files (Optional) ✅
  - [#81](https://github.com/banisterious/obsidian-charted-roots/issues/81) Phase 5: Gramps Export & Sync Support
- **Priority:** Medium
- **Created:** 2025-12-26
- **Updated:** 2026-01-01

---

## Overview

Gramps allows attaching notes to various entities (people, families, events, places, sources, etc.). These notes are free-form text that can contain research notes, biographical information, source transcriptions, and more. Users importing from Gramps expect their notes to be preserved.

Additionally, Gramps treats families as first-class entities with their own notes and metadata. This raises the question of whether Charted Roots should introduce a Family entity type to properly support this data.

---

## Design Principles

Charted Roots serves a diverse user base. Many users come from GEDCOM files or start fresh in Obsidian — they may never touch Gramps and have no need for advanced sync or note-sharing features.

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

**User feedback received (2025-12-27):** See `docs/user-feedback/user-feedback-03.md`

| Question | Answer | Implication |
|----------|--------|-------------|
| Notes shared across entities? | **Yes, frequently.** Uses `[[{doc}\|Alias]]` format with redundant "Notes" sections for control. | Phase 4 (separate note files) important for this user |
| Family notes use case? | Same as any entity — info that can't attach elsewhere, research docs, links | Phase 3 (Family entity) needed |
| One-time import or sync? | **Advanced hybrid.** Obsidian is "hub" connecting tools; plans Python scripts for bi-directional sync | Phase 5 eventually needed; preserve handles |
| Privacy flag triggers? | Manual control preferred; just add the YAML key for extensibility | Phase 1 approach is correct |
| Obsidian Sync / publishing? | No Sync; looking at export-to-website plugins; wants total control over what leaves computer | Privacy flag as frontmatter sufficient |

**Takeaway:** This is a power user. Simpler users may still benefit from Phase 1's embedded approach, but the phased plan is validated — each phase serves real needs.

**User feedback received (2025-12-27):** [GitHub issue #36 comment](https://github.com/banisterious/obsidian-charted-roots/issues/36#issuecomment-3694263634)

| Question | Answer | Implication |
|----------|--------|-------------|
| Where should notes appear? | Appended to note content | Phase 1 approach is correct |
| Multiple notes organization? | Separate subsections by note type | Phase 1 approach is correct |
| Preserve note types? | Yes, as subsection headers (e.g., `### Research`) | Phase 1 approach is correct |
| Formatted notes handling? | Convert Gramps styling to Markdown | Need style conversion in Phase 1 |
| Private notes handling? | Import and add `private: true` to frontmatter | Phase 1 approach is correct |
| Default behavior? | Notes import enabled by default | Phase 1 approach is correct |
| Family notes? | **Attach to marriage event** | Alternative to Phase 3 Family entity |

**Takeaway:** This user prefers the simpler embedded approach (Phase 1) and suggests attaching family notes to marriage events rather than creating a separate Family entity. This validates Phase 1 as the default and suggests Phase 3 (Family entity) should remain opt-in for power users who need it.

**Additional feedback (2025-12-27):** https://gramps.discourse.group/t/genealogy-research-in-obsidian-for-those-who-want-to-try/8926/8

Same user shared screenshots of their Obsidian vault structure:

| Observation | Details | Implication |
|-------------|---------|-------------|
| **"More is less" philosophy** | Advocates importing everything from GEDCOM/Gramps — users can discover new relationships in Obsidian that genealogy software can't show | Validates preserving all data; don't filter during import |
| **Numbered folder prefixes** | Uses `10. People`, `20. Families & Kinships`, `30. Events`, etc. for ordering | Consider optional numbered prefix support |
| **Extended entity types** | Has `Ships & Vessels`, `Companies` as separate folders beyond our standard types | Organization entity can cover Companies; Ships could be custom type |
| **Research Logs** | Dedicated `Research Logs for People` folder with per-person logs | Potential future entity type; relates to Research Tracking in Roadmap |
| **"People of Interest"** | Separates main research subjects from peripheral people | Could use `status` field or collections to distinguish |
| **Rich person note sections** | Family & Kinship (with Foster Parents, Grand Parents subsections), History, Events, Occupations, Notes | Our dynamic blocks cover some; person note templates could help |
| **Status property** | Uses `status: Object of Research` in frontmatter | Not currently in our schema; could add |
| **Multiple alias variants** | Stores many name variations | Aligns with our existing `aliases` field |
| **Hierarchical archives** | Organizes by country code + repository (NO/SAO = Norway/State Archive Oslo) | Aligns with our place hierarchy and source organization |

**Takeaway:** This user operates at power-user level, using tools outside intended purpose. Their elaborate structure is aspirational rather than minimum requirement, but validates our phased approach and "preserve everything" principle.

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
- Charted Roots has no Family entity — relationships are properties on Person notes

---

## Phase Dependencies

Phases 3, 4, and 5 are largely independent of each other:

| Phase | Depends On | Description |
|-------|------------|-------------|
| 1 ✅ | — | Embedded person notes |
| 2 ✅ | Phase 1 | Embedded notes for other entities |
| 3 | Phases 1-2 | Family entity type (optional) |
| 4 ✅ | Phases 1-2 | Separate note files (optional) |
| 5 | Phase 4 | Export & sync to Gramps |

**Key insight:** Phase 3 (Family Entity) is orthogonal to Phases 4-5. Since Phase 1 already attaches family notes to marriage events, Phase 3 is only needed for users who want families as first-class entities matching the Gramps data model.

**Viable implementation paths:**

| Path | Phases | Use Case |
|------|--------|----------|
| Minimal | 1, 2 ✅ | Most users — notes embedded, no sync needed |
| Sync-ready | 1, 2 ✅, 4 ✅, 5 | Users wanting round-trip to Gramps |
| Full fidelity | 1, 2 ✅, 3, 4 ✅, 5 | Power users wanting complete Gramps model |
| Family-only | 1, 2 ✅, 3 | Users wanting Family entity but not sync |

Phase 3 could be skipped entirely if the marriage event attachment approach satisfies users.

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

### Phase 3: Family Entity (Deferred Indefinitely)

Introduce Family as a new entity type in Charted Roots.

**Status:** Deferred indefinitely pending user demand.

**Rationale (2026-01-01):**
- Only one known user has expressed interest in full Gramps data model fidelity
- That user plans to write custom Python scripts for their workflow
- Phase 1 already attaches family notes to marriage events, which satisfies most use cases
- Adding a new entity type introduces significant complexity:
  - New UI components (create/edit modals, context menus)
  - New service layer
  - Duplicated relationship data (parent/child on both Person and Family)
  - Additional Bases templates and documentation
- Not justified without broader demand from multiple users

**If revisited, the implementation would include:**
- `cr_type: family` entity type
- `Families/` folder during import
- Family note with parents, children (wikilinks), marriage events, family notes
- Bases templates
- Import wizard checkbox "Create family notes" (default: off)

**Alternative Already Implemented: Attach to Marriage Event**

User feedback suggested this simpler approach: attach family notes to the marriage/partnership event instead of creating a separate Family entity. This is now the default behavior.

| Approach | Pros | Cons |
|----------|------|------|
| Family entity | Matches Gramps model; dedicated place for family-level data | Adds complexity; duplicates relationship data |
| Marriage event (current) | Simpler; no new entity type; already have events | Family notes without marriage event have no home |

### Phase 4: Separate Note Files (Advanced, Opt-in)

For users who need notes as independent, linkable entities.

- Each Gramps note becomes its own Markdown file in a `Notes/` folder
- Parent entity links to note files instead of embedding content
- Enables note sharing across multiple entities
- Required for accurate round-trip sync to Gramps

**Should be opt-in:** Import wizard checkbox "Create separate note files" (default: off)

#### Implementation Details

**1. New entity type: `cr_type: note`**

Notes become first-class Charted Roots entities with their own frontmatter schema:

```yaml
---
cr_type: note
cr_id: note_N0001
gramps_id: N0001
gramps_handle: _abc123def
cr_note_type: Research
private: true
gramps_tags:
  - todo
  - verified
---

Census records show John living with his parents in 1860.
Further research needed to confirm birth location.
```

**2. Folder structure**

Notes are created in the configured notes folder (default: `Charted Roots/Notes`):
```
vault/
├── Charted Roots/
│   ├── People/
│   │   └── John Smith.md       # Contains [[Research on John Smith]]
│   ├── Events/
│   │   └── Birth of John Smith.md
│   ├── Notes/
│   │   ├── Research on John Smith.md
│   │   └── Smith Family History.md
│   └── ...
```

**Settings integration:**
- Add `notesFolder: string` to `CanvasRootsSettings`
- Default: `'Charted Roots/Notes'`
- Follows existing pattern for `peopleFolder`, `eventsFolder`, `sourcesFolder`, etc.

**3. Note naming convention**

Since Gramps notes don't have names, generate from:
1. Note type + first linked entity: `Research on John Smith`
2. If no linked entity: `Research Note N0001`
3. If no type: `Note N0001`

Handle duplicates with suffix: `Research on John Smith (2)`

**4. Entity linking**

Instead of embedding note content, parent entities link to note files:

```markdown
## Notes

- [[Research on John Smith]]
- [[Smith Family Origins]]
```

**5. Import wizard option**

Add checkbox to Gramps import options:
- Label: "Create separate note files"
- Default: off (embedded notes remain the default)
- When enabled: creates `Notes/` folder and note files instead of embedding

**6. Files to modify**

| File | Changes |
|------|---------|
| `src/settings.ts` | Add `notesFolder: string` with default `'Charted Roots/Notes'` |
| `src/gramps/gramps-types.ts` | No changes (GrampsNote already complete) |
| `src/gramps/gramps-importer.ts` | Add `createSeparateNoteFiles` option; create note files; link instead of embed |
| `src/core/note-writer.ts` | **New file**: Write note entity files |
| `src/ui/import-wizard-modal.ts` | Add "Create separate note files" checkbox |
| `src/gramps/gramps-note-converter.ts` | May need adjustment for standalone notes |
| `src/ui/control-center.ts` | Add conditional Notes card to Dashboard tab |
| `src/core/vault-stats.ts` | Add notes stats (count, by type) |
| `src/ui/create-note-modal.ts` | **New file**: Modal for creating notes manually |
| `src/ui/template-snippets-modal.ts` | Add 'note' to `TemplateType`, add Notes tile, add `getNoteTemplates()` |
| `Charted Roots/Bases/Note.md` | **New file**: Base template for note creation |

**11. Control Center integration**

Add a Notes card to the Dashboard tab (conditional - only shows if notes exist):

```typescript
// Only render if notes exist
if (stats.notes.totalNotes > 0) {
    const notesCard = this.createCard({
        title: 'Notes',
        icon: 'file-text'
    });
    // Show total count and breakdown by cr_note_type
}
```

Card displays:
- Total notes count
- Breakdown by `cr_note_type` (Research, Person Note, etc.)
- Link to browse Notes folder

**12. Manual note creation**

Users need a good experience for creating notes manually (not just via import).

**Create Note Modal** (`src/ui/create-note-modal.ts`):
- Note type dropdown: Research, Person Note, Transcript, Source text, General, Custom
- Title field (required)
- Privacy toggle (default: off)
- Linked entities field with typed entity pickers:
  - "+ Add entity" button opens dropdown menu (Person, Event, Place, Source)
  - Each option opens the corresponding picker modal (PersonPickerModal, EventPickerModal, PlacePickerModal, SourcePickerModal)
  - Selected entities appear as removable chips with wikilinks
  - Styling matches Sources field pattern for visual consistency
- Creates note in `notesFolder` with proper frontmatter

**Entry points:**
- Command palette: "Charted Roots: Create note"
- File menu: Right-click in Notes folder → "New Charted Roots note"
- Control Center: Notes card "Create note" button (if notes exist)
- Context menu on entities: "Create linked note" (pre-fills entity link)

**File explorer context menu:**

Register a context menu item for the Notes folder:
```typescript
this.registerEvent(
    this.app.workspace.on('file-menu', (menu, file) => {
        // Only show in Notes folder
        if (file.path.startsWith(this.settings.notesFolder)) {
            menu.addItem((item) => {
                item.setTitle('New Charted Roots note')
                    .setIcon('file-plus')
                    .onClick(() => this.openCreateNoteModal());
            });
        }
    })
);
```

**Note Base Template** (`Charted Roots/Bases/Note.md`):
```markdown
---
cr_type: note
cr_id: "{{cr_id}}"
cr_note_type: Research
private: false
---

{{content}}
```

**13. Templater templates modal**

Add a Notes tile to the existing Templater templates modal (`src/ui/template-snippets-modal.ts`):

Changes required:
- Add `'note'` to `TemplateType` union
- Add Notes tile to `tiles` array: `{ type: 'note', label: 'Notes', icon: 'file-text' }`
- Add case for `'note'` in `renderTemplates()` switch
- Add `getNoteTemplates()` method

**Note templates to include:**

```typescript
private getNoteTemplates(): TemplateSnippet[] {
    const p = (canonical: string) => getPropertyName(canonical, this.propertyAliases);

    return [
        {
            name: 'Basic note',
            description: 'Minimal template for research notes',
            template: `---
${p('cr_type')}: note
${p('cr_id')}: <% tp.date.now("YYYYMMDDHHmmss") %>
cr_note_type: <% tp.system.suggester(["Research", "Person Note", "Transcript", "Source text", "General"], ["Research", "Person Note", "Transcript", "Source text", "General"]) %>
private: false
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
        },
        {
            name: 'Research note',
            description: 'Template for documenting research findings',
            template: `---
${p('cr_type')}: note
${p('cr_id')}: <% tp.date.now("YYYYMMDDHHmmss") %>
cr_note_type: Research
private: false
linked_entities:
  - "[[<% tp.system.prompt("Related person/event/source?", "", false) %>]]"
---

# <% tp.file.title %>

## Summary

<% tp.file.cursor() %>

## Sources consulted

## Next steps

`
        },
        {
            name: 'Transcript note',
            description: 'For document transcriptions',
            template: `---
${p('cr_type')}: note
${p('cr_id')}: <% tp.date.now("YYYYMMDDHHmmss") %>
cr_note_type: Transcript
private: false
source: "[[<% tp.system.prompt("Source document?", "", false) %>]]"
---

# Transcript: <% tp.file.title %>

## Original text

<% tp.file.cursor() %>

## Transcription notes

`
        }
    ];
}
```

**7. Shared notes handling**

Gramps allows the same note to be referenced by multiple entities. With separate files:
- Note is created once in `Notes/` folder
- Each referencing entity gets a wikilink to the same note
- This enables true note sharing in Obsidian

**8. Backlinks**

Consider adding backlinks in note frontmatter:
```yaml
referenced_by:
  - "[[John Smith]]"
  - "[[Jane Doe]]"
```

Or rely on Obsidian's native backlink pane (simpler).

**9. Migration path**

Users who initially import with embedded notes and later want separate files:
- Could add a "Convert embedded notes to files" command
- Or simply re-import with the new option enabled

**10. Interaction with Phase 1-2**

When `createSeparateNoteFiles` is enabled:
- Phase 1-2 note embedding is skipped
- Note files are created in `Notes/` folder
- Parent entities get wikilinks instead of embedded content
- All note metadata (type, privacy, tags, handle) preserved in frontmatter

### Phase 5: Export & Sync (Deferred Indefinitely)

Support for exporting notes back to Gramps and potentially bi-directional sync.

**Status:** Deferred indefinitely pending user demand.

**Rationale (2026-01-01):**
- Only one known user has expressed interest in this feature
- That user plans to write custom Python scripts for their sync workflow
- True bi-directional sync is complex (conflict resolution, change detection, handle mapping for new entities)
- "Export to Gramps XML" would be the tractable first step if demand emerges
- Not justified without broader demand from multiple users

**If revisited, user feedback suggests:**
- `sync-status: draft | synced | ignore` frontmatter field to control what gets pushed back
- Dedicated folder structure makes change detection easier
- Obsidian note files could be linked as media objects in Gramps

**Requirements for round-trip support (captured for future reference):**
- Preserve Gramps handles (`gramps_handle` in frontmatter) - already done for some entities
- Avoid lossy transformations during import
- Track which notes were created in Obsidian vs. imported from Gramps
- Handle conflicts (same note edited in both places)

**Implementation considerations:**
- Requires Phase 4 (separate note files) for accurate note-level sync ✅
- May require Phase 3 (Family entity) to preserve family-level notes
- Export would extend existing Gramps XML export functionality
- True "sync" is complex; "export changes" is more tractable

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

5. **How to handle styled/formatted notes?**
   → Phase 1: Import plain text only
   → Phase 2+: Add style conversion for basic types (bold, italic, strikethrough, links)

   **Gramps style types** (from `StyledTextTagType`):
   | Type | Markdown equivalent |
   |------|---------------------|
   | BOLD | `**text**` |
   | ITALIC | `*text*` |
   | UNDERLINE | `<u>text</u>` (HTML) or skip |
   | STRIKETHROUGH | `~~text~~` |
   | SUPERSCRIPT | `<sup>text</sup>` |
   | SUBSCRIPT | `<sub>text</sub>` |
   | LINK | `[text](url)` |
   | FONTFACE, FONTSIZE, FONTCOLOR, HIGHLIGHT | Skip (no Markdown equivalent) |

6. **The `format` attribute**
   → `format="0"` (FLOWED) → normal Markdown text
   → `format="1"` (FORMATTED) → wrap in code fence or preserve whitespace

7. **Note tags (`tagref`)**
   → Store in frontmatter array: `gramps_tags: [research, todo]`
   → Preserves data without polluting Obsidian tag namespace
   → Users can convert to Obsidian tags manually if desired

### Still Open

*None currently — all questions resolved.*

### Resolved by User Feedback

4. **Note sharing patterns?**
   → **Frequently shared.** User uses wikilinks with aliases and redundant "Notes" sections.
   → Phase 4 (separate note files) is important for power users; Phase 1 still valuable for simpler workflows.

5. **Family entity adoption**
   → **Needed.** User treats family notes same as any other entity type.
   → Phase 3 should proceed as planned.

---

## Technical Notes

### Implementation Progress

#### Phase 1: Embedded Notes ✅ (Completed 2025-12-31)

**Files Modified:**
- `src/gramps/gramps-types.ts` - Added `noteRefs` to `GrampsPerson`, `GrampsEvent`, `GrampsPlace`, `GrampsFamily`; extended `GrampsNote` with `format`, `private`, `styles` fields; added `GrampsNoteFormat` and `GrampsStyleRange` types
- `src/gramps/gramps-parser.ts` - Parse `<noteref>` elements for persons, events, places, families; parse note `format`, `priv`, and `<style>` elements
- `src/gramps/gramps-note-converter.ts` - **New file**: Markdown conversion with style handling (bold, italic, strikethrough, links, etc.)
- `src/gramps/gramps-importer.ts` - Resolve and append notes to person content; added `importNotes` option
- `src/core/person-note-writer.ts` - Added `notesContent` and `private` fields to `PersonData`
- `src/ui/import-wizard-modal.ts` - Added "Notes" toggle (Gramps only, enabled by default)

**Key Features:**
- Style conversion: bold → `**`, italic → `*`, strikethrough → `~~`, links → `[]()`
- Format handling: FLOWED (normal text) vs FORMATTED (code fence)
- Privacy flag: `private: true` in frontmatter if any note has `priv="1"`
- Family notes fallback: attached to marriage/family events instead of separate entity
- Import wizard toggle to enable/disable notes import

#### Phase 2: Other Entity Notes ✅ (Completed 2025-12-31)

**Files Modified:**
- `src/gramps/gramps-parser.ts` - Add `noteRefs` to `ParsedGrampsPlace` interface
- `src/gramps/gramps-importer.ts` - Resolve notes for events and places (events were already done in Phase 1)
- `src/core/place-note-writer.ts` - Add `notesContent` and `private` fields to `PlaceData`

**Key Features:**
- Event notes: already implemented in Phase 1 (resolved and appended to event body)
- Place notes: resolve noteRefs and append as "## Notes" section
- Privacy flag propagation for places (same pattern as persons/events)

#### Phase 3 (Family Entity - Future):
- `src/models/family.ts` - New Family model
- `src/core/family-service.ts` - New service layer
- `src/gramps/gramps-importer.ts` - Create family notes
- `src/bases/family-base-template.ts` - Bases integration
- Settings and UI updates

#### Phase 4: Separate Note Files ✅

**Status:** Implementation complete

**Files Created:**
- `src/core/note-writer.ts` - Write note entity files with frontmatter
- `src/ui/create-note-modal.ts` - Modal for manual note creation
- `src/constants/notes-base-template.ts` - Obsidian Bases template with 11 views

**Files Modified:**
- `src/settings.ts` - Added `notesFolder` setting, `createNoteModalState` persistence
- `src/gramps/gramps-importer.ts` - Added `createSeparateNoteFiles` option; create note files; link instead of embed
- `src/ui/import-wizard-modal.ts` - Added "Create separate note files" checkbox (Gramps only)
- `src/ui/modal-state-persistence.ts` - Added 'note' to ModalType
- `src/ui/template-snippets-modal.ts` - Added Notes tile and 3 templates
- `main.ts` - Added create-note command, notes base template command, Notes folder context menu

**Implementation Steps (All Complete):**

*Core infrastructure:*
1. [x] Add `notesFolder: string` setting with default `'Charted Roots/Notes'`
2. [x] Add `createSeparateNoteFiles: boolean` to `GrampsImportOptions`
3. [x] Create `note-writer.ts` with `writeNoteFile()` function

*Import integration:*
4. [x] Build note-to-entity reference map during parsing
5. [x] Generate note names from type + first referencing entity
6. [x] Create note files in configured notes folder during import
7. [x] Modify entity note sections to use wikilinks instead of embedded content
8. [x] Add import wizard checkbox
9. [x] Filter out source-only notes (already embedded in source notes)

*Manual creation:*
10. [x] Create `create-note-modal.ts` with type dropdown, title, privacy, typed entity pickers (dropdown → picker modals)
11. [x] Add Note base template (`notes-base-template.ts`) for Obsidian Bases
12. [x] Register "Create note" command in command palette
13. [x] Register file-menu context action for Notes folder ("New Charted Roots note")
14. [x] Add Notes tile and templates to Templater templates modal

*Control Center (deferred to future iteration):*
15. [ ] Add notes stats to `VaultStatsService` (count, by type)
16. [ ] Add conditional Notes card to Dashboard tab

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

### Example Output (Phase 4 - Separate Note Files)

**Note file (`Notes/Research on John Smith.md`):**
```markdown
---
cr_type: note
cr_id: note_N0042
gramps_id: N0042
gramps_handle: _abc123def456
cr_note_type: Research
private: false
---

Census records show John living with his parents in 1860.
Further research needed to confirm birth location.
```

**Person file (`People/John Smith.md`) with linked notes:**
```markdown
---
name: John Smith
birth_date: 1850-03-15
# ... other frontmatter
---

## Notes

- [[Research on John Smith]]
- [[Person Note for John Smith]]
```

**Shared note example** - same note linked by multiple entities:
```markdown
# Notes/Smith Family Origins.md
---
cr_type: note
cr_id: note_N0099
gramps_id: N0099
gramps_handle: _xyz789
cr_note_type: Research
---

The Smith family emigrated from County Cork, Ireland during the 1847 famine.
```

Both `[[John Smith]]` and `[[Jane Smith]]` can link to `[[Smith Family Origins]]`.

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
- Local Gramps source: `external/gramps/` (cloned for research)
  - `gramps/gen/lib/note.py` — Note class with FLOWED/FORMATTED constants
  - `gramps/gen/lib/styledtexttagtype.py` — Style tag types (BOLD, ITALIC, etc.)
  - `data/grampsxml.dtd` — XML schema definition
