/**
 * Obsidian Bases template for managing Charted Roots universe notes
 */
export const UNIVERSES_BASE_TEMPLATE = `visibleProperties:
  - note.name
  - note.description
  - note.status
  - note.author
  - note.genre
  - note.default_calendar
  - note.default_map
  - note.created
summaries:
  total_universes: 'values.length'
filters:
  and:
    - 'cr_type == "universe"'
formulas:
  display_name: 'name || file.name'
  is_active: 'if(status == "active", "Yes", "No")'
  has_calendar: 'if(default_calendar, "Yes", "No")'
  has_map: 'if(default_map, "Yes", "No")'
properties:
  cr_id:
    displayName: ID
  note.name:
    displayName: Name
  note.description:
    displayName: Description
  note.status:
    displayName: Status
  note.author:
    displayName: Author
  note.genre:
    displayName: Genre
  note.default_calendar:
    displayName: Calendar
  note.default_map:
    displayName: Map
  note.created:
    displayName: Created
  formula.display_name:
    displayName: Display Name
  formula.is_active:
    displayName: Active
  formula.has_calendar:
    displayName: Has Calendar
  formula.has_map:
    displayName: Has Map
views:
  - name: All Universes
    type: table
    order:
      - note.name
      - note.status
      - note.author
      - note.genre
      - note.description
  - name: By Status
    type: table
    groupBy:
      property: note.status
      direction: ASC
    order:
      - note.name
  - name: Active Universes
    type: table
    filters:
      and:
        - 'status == "active"'
    order:
      - note.name
  - name: Draft Universes
    type: table
    filters:
      and:
        - 'status == "draft"'
    order:
      - note.name
  - name: Archived Universes
    type: table
    filters:
      and:
        - 'status == "archived"'
    order:
      - note.name
  - name: By Genre
    type: table
    filters:
      and:
        - '!genre.isEmpty()'
    groupBy:
      property: note.genre
      direction: ASC
    order:
      - note.name
  - name: By Author
    type: table
    filters:
      and:
        - '!author.isEmpty()'
    groupBy:
      property: note.author
      direction: ASC
    order:
      - note.name
  - name: With Calendars
    type: table
    filters:
      and:
        - '!default_calendar.isEmpty()'
    order:
      - note.name
  - name: Without Calendars
    type: table
    filters:
      and:
        - 'default_calendar.isEmpty()'
    order:
      - note.name
  - name: With Maps
    type: table
    filters:
      and:
        - '!default_map.isEmpty()'
    order:
      - note.name
  - name: Without Maps
    type: table
    filters:
      and:
        - 'default_map.isEmpty()'
    order:
      - note.name
  - name: Recently Created
    type: table
    filters:
      and:
        - '!created.isEmpty()'
    sortBy:
      property: note.created
      direction: DESC
    order:
      - note.name
      - note.created
`;
