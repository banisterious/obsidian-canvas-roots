/**
 * Obsidian Bases template for managing Canvas Roots organization notes
 */
export const ORGANIZATIONS_BASE_TEMPLATE = `visibleProperties:
  - note.name
  - note.org_type
  - note.parent_org
  - note.founded
  - note.dissolved
  - note.motto
  - note.seat
  - note.universe
  - note.collection
summaries:
  total_organizations: 'values.length'
filters:
  and:
    - 'cr_type == "organization"'
formulas:
  display_name: 'name || file.name'
  is_active: 'if(dissolved, "No", "Yes")'
  hierarchy_path: 'if(parent_org, parent_org + " → " + name, name)'
properties:
  cr_id:
    displayName: ID
  note.name:
    displayName: Name
  note.org_type:
    displayName: Type
  note.parent_org:
    displayName: Parent
  note.founded:
    displayName: Founded
  note.dissolved:
    displayName: Dissolved
  note.motto:
    displayName: Motto
  note.seat:
    displayName: Seat
  note.universe:
    displayName: Universe
  note.collection:
    displayName: Collection
  formula.display_name:
    displayName: Display Name
  formula.is_active:
    displayName: Active
  formula.hierarchy_path:
    displayName: Hierarchy
views:
  - name: All Organizations
    type: table
    order:
      - note.name
      - note.org_type
      - note.parent_org
      - note.founded
      - note.dissolved
  - name: By Type
    type: table
    groupBy:
      property: note.org_type
      direction: ASC
    order:
      - note.name
  - name: Noble Houses
    type: table
    filters:
      and:
        - 'org_type == "noble_house"'
    order:
      - note.name
  - name: Guilds
    type: table
    filters:
      and:
        - 'org_type == "guild"'
    order:
      - note.name
  - name: Corporations
    type: table
    filters:
      and:
        - 'org_type == "corporation"'
    order:
      - note.name
  - name: Military Units
    type: table
    filters:
      and:
        - 'org_type == "military"'
    order:
      - note.name
  - name: Religious Orders
    type: table
    filters:
      and:
        - 'org_type == "religious"'
    order:
      - note.name
  - name: Political Entities
    type: table
    filters:
      and:
        - 'org_type == "political"'
    order:
      - note.name
  - name: Educational
    type: table
    filters:
      and:
        - 'org_type == "educational"'
    order:
      - note.name
  - name: Active Organizations
    type: table
    filters:
      and:
        - 'dissolved.isEmpty()'
    order:
      - note.name
  - name: Dissolved Organizations
    type: table
    filters:
      and:
        - '!dissolved.isEmpty()'
    order:
      - note.dissolved
  - name: By Universe
    type: table
    filters:
      and:
        - '!universe.isEmpty()'
    groupBy:
      property: note.universe
      direction: ASC
    order:
      - note.name
  - name: Top-Level Organizations
    type: table
    filters:
      and:
        - 'parent_org.isEmpty()'
    order:
      - note.name
  - name: Sub-Organizations
    type: table
    filters:
      and:
        - '!parent_org.isEmpty()'
    groupBy:
      property: note.parent_org
      direction: ASC
    order:
      - note.name
  - name: By Collection
    type: table
    filters:
      and:
        - '!collection.isEmpty()'
    groupBy:
      property: note.collection
      direction: ASC
    order:
      - note.name
  - name: With Seat
    type: table
    filters:
      and:
        - '!seat.isEmpty()'
    order:
      - note.name
  - name: Missing Seat
    type: table
    filters:
      and:
        - 'seat.isEmpty()'
    order:
      - note.name
`;
