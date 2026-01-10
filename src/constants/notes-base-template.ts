/**
 * Obsidian Bases template for managing Charted Roots note entities
 * Part of Phase 4 Gramps Notes integration
 */
export const NOTES_BASE_TEMPLATE = `visibleProperties:
  - note.name
  - note.cr_note_type
  - note.private
  - note.linked_entities
summaries:
  total_notes: 'values.length'
filters:
  and:
    - 'cr_type == "note"'
formulas:
  display_name: 'file.name'
  has_links: 'if(linked_entities, "Yes", "No")'
properties:
  cr_id:
    displayName: ID
  note.cr_note_type:
    displayName: Type
  note.private:
    displayName: Private
  note.linked_entities:
    displayName: Linked Entities
  note.gramps_id:
    displayName: Gramps ID
  formula.display_name:
    displayName: Note Title
  formula.has_links:
    displayName: Has Links
views:
  - name: All Notes
    type: table
    order:
      - formula.display_name
      - note.cr_note_type
      - note.private
      - note.linked_entities
  - name: By Type
    type: table
    groupBy:
      property: note.cr_note_type
      direction: ASC
    order:
      - formula.display_name
  - name: Research Notes
    type: table
    filters:
      and:
        - 'cr_note_type == "Research"'
    order:
      - formula.display_name
  - name: Person Notes
    type: table
    filters:
      and:
        - 'cr_note_type == "Person Note"'
    order:
      - formula.display_name
  - name: Transcripts
    type: table
    filters:
      and:
        - 'cr_note_type == "Transcript"'
    order:
      - formula.display_name
  - name: Source Texts
    type: table
    filters:
      and:
        - 'cr_note_type == "Source text"'
    order:
      - formula.display_name
  - name: Private Notes
    type: table
    filters:
      and:
        - 'private == true'
    order:
      - formula.display_name
  - name: Public Notes
    type: table
    filters:
      or:
        - 'private.isEmpty()'
        - 'private == false'
    order:
      - formula.display_name
  - name: With Links
    type: table
    filters:
      and:
        - '!linked_entities.isEmpty()'
    order:
      - formula.display_name
      - note.linked_entities
  - name: Unlinked Notes
    type: table
    filters:
      and:
        - 'linked_entities.isEmpty()'
    order:
      - formula.display_name
  - name: From Gramps
    type: table
    filters:
      and:
        - '!gramps_id.isEmpty()'
    order:
      - note.gramps_id
      - formula.display_name
`;
