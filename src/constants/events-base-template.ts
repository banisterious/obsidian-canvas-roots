/**
 * Obsidian Bases template for managing Canvas Roots event notes
 */
export const EVENTS_BASE_TEMPLATE = `visibleProperties:
  - note.title
  - note.event_type
  - note.date
  - note.person
  - note.place
  - note.confidence
  - note.date_precision
summaries:
  total_events: values.length
filters:
  or:
    - note.type == "event"
    - file.hasProperty("event_type")
formulas:
  display_name: title || file.name
  year_only: if(date, date.year, "")
  has_sources: if(sources, "Yes", "No")
  is_dated: if(date, "Dated", "Relative only")
properties:
  cr_id:
    displayName: ID
  note.title:
    displayName: Title
  note.event_type:
    displayName: Type
  note.date:
    displayName: Date
  note.date_end:
    displayName: End Date
  note.date_precision:
    displayName: Precision
  note.person:
    displayName: Person
  note.persons:
    displayName: People
  note.place:
    displayName: Place
  note.sources:
    displayName: Sources
  note.confidence:
    displayName: Confidence
  note.description:
    displayName: Description
  note.before:
    displayName: Before
  note.after:
    displayName: After
  note.timeline:
    displayName: Timeline
  note.sort_order:
    displayName: Sort Order
  note.groups:
    displayName: Groups
  note.is_canonical:
    displayName: Canonical
  note.universe:
    displayName: Universe
  formula.display_name:
    displayName: Display Name
  formula.year_only:
    displayName: Year
  formula.has_sources:
    displayName: Has Sources
  formula.is_dated:
    displayName: Date Status
views:
  - name: All Events
    type: table
    filter: {}
    sort:
      - property: note.date
        direction: asc
      - property: note.sort_order
        direction: asc
  - name: By Type
    type: table
    filter: {}
    group:
      - property: note.event_type
    sort:
      - property: note.date
        direction: asc
  - name: By Person
    type: table
    filter:
      note.person:
        ne: null
    group:
      - property: note.person
    sort:
      - property: note.date
        direction: asc
  - name: By Place
    type: table
    filter:
      note.place:
        ne: null
    group:
      - property: note.place
    sort:
      - property: note.date
        direction: asc
  - name: By Confidence
    type: table
    filter: {}
    group:
      - property: note.confidence
    sort:
      - property: note.date
        direction: asc
  - name: Vital Events
    type: table
    filter:
      or:
        - note.event_type: birth
        - note.event_type: death
        - note.event_type: marriage
        - note.event_type: divorce
    sort:
      - property: note.date
        direction: asc
  - name: Life Events
    type: table
    filter:
      or:
        - note.event_type: residence
        - note.event_type: occupation
        - note.event_type: military
        - note.event_type: immigration
        - note.event_type: education
        - note.event_type: burial
        - note.event_type: baptism
        - note.event_type: confirmation
        - note.event_type: ordination
    sort:
      - property: note.date
        direction: asc
  - name: Narrative Events
    type: table
    filter:
      or:
        - note.event_type: anecdote
        - note.event_type: lore_event
        - note.event_type: plot_point
        - note.event_type: flashback
        - note.event_type: foreshadowing
        - note.event_type: backstory
        - note.event_type: climax
        - note.event_type: resolution
    sort:
      - property: note.date
        direction: asc
  - name: High Confidence
    type: table
    filter:
      note.confidence: high
    sort:
      - property: note.date
        direction: asc
  - name: Low Confidence
    type: table
    filter:
      or:
        - note.confidence: low
        - note.confidence: unknown
    sort:
      - property: note.date
        direction: asc
  - name: With Sources
    type: table
    filter:
      note.sources:
        ne: null
    sort:
      - property: note.date
        direction: asc
  - name: Missing Sources
    type: table
    filter:
      note.sources:
        eq: null
    sort:
      - property: note.date
        direction: asc
  - name: Dated Events
    type: table
    filter:
      note.date:
        ne: null
    sort:
      - property: note.date
        direction: asc
  - name: Relative Ordering Only
    type: table
    filter:
      and:
        - note.date:
            eq: null
        - or:
            - note.before:
                ne: null
            - note.after:
                ne: null
    sort:
      - property: note.sort_order
        direction: asc
  - name: Canonical Events
    type: table
    filter:
      note.is_canonical: true
    sort:
      - property: note.date
        direction: asc
  - name: By Timeline
    type: table
    filter:
      note.timeline:
        ne: null
    group:
      - property: note.timeline
    sort:
      - property: note.date
        direction: asc
  - name: By Universe
    type: table
    filter:
      note.universe:
        ne: null
    group:
      - property: note.universe
    sort:
      - property: note.date
        direction: asc
  - name: By Group
    type: table
    filter:
      note.groups:
        ne: null
    group:
      - property: note.groups
    sort:
      - property: note.date
        direction: asc
  - name: By Sort Order
    type: table
    filter: {}
    sort:
      - property: note.sort_order
        direction: asc
`;
