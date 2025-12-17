/**
 * Obsidian Bases template for managing Canvas Roots source notes
 */
export const SOURCES_BASE_TEMPLATE = `visibleProperties:
  - note.name
  - note.source_type
  - note.source_repository
  - note.source_date
  - note.confidence
  - note.collection
  - note.location
summaries:
  total_sources: 'values.length'
filters:
  and:
    - 'cr_type == "source"'
formulas:
  display_name: 'title || file.name'
  has_media: 'if(media, "Yes", "No")'
  year_only: 'if(source_date, source_date.year, "")'
properties:
  cr_id:
    displayName: ID
  note.title:
    displayName: Title
  note.source_type:
    displayName: Type
  note.source_repository:
    displayName: Repository
  note.source_date:
    displayName: Date
  note.source_date_accessed:
    displayName: Accessed
  note.confidence:
    displayName: Confidence
  note.collection:
    displayName: Collection
  note.location:
    displayName: Location
  note.source_repository_url:
    displayName: URL
  note.media:
    displayName: Media
  formula.display_name:
    displayName: Display Name
  formula.has_media:
    displayName: Has Media
  formula.year_only:
    displayName: Year
views:
  - name: All Sources
    type: table
    order:
      - note.title
      - note.source_type
      - note.source_repository
      - note.source_date
      - note.confidence
  - name: By Type
    type: table
    groupBy:
      property: note.source_type
      direction: ASC
    order:
      - note.title
  - name: By Repository
    type: table
    groupBy:
      property: note.source_repository
      direction: ASC
    order:
      - note.title
  - name: By Confidence
    type: table
    groupBy:
      property: note.confidence
      direction: ASC
    order:
      - note.title
  - name: Vital Records
    type: table
    filters:
      and:
        - 'source_type == "vital_record"'
    order:
      - note.source_date
  - name: Census Records
    type: table
    filters:
      and:
        - 'source_type == "census"'
    order:
      - note.source_date
  - name: Church Records
    type: table
    filters:
      or:
        - 'source_type == "church_record"'
        - 'source_type == "parish_register"'
    order:
      - note.source_date
  - name: Legal Documents
    type: table
    filters:
      or:
        - 'source_type == "will"'
        - 'source_type == "probate"'
        - 'source_type == "land_record"'
        - 'source_type == "court_record"'
    order:
      - note.source_date
  - name: Military Records
    type: table
    filters:
      and:
        - 'source_type == "military_record"'
    order:
      - note.source_date
  - name: Photos & Media
    type: table
    filters:
      or:
        - 'source_type == "photograph"'
        - 'source_type == "newspaper"'
    order:
      - note.source_date
  - name: High Confidence
    type: table
    filters:
      and:
        - 'confidence == "high"'
    order:
      - note.title
  - name: Low Confidence
    type: table
    filters:
      or:
        - 'confidence == "low"'
        - 'confidence == "unknown"'
    order:
      - note.title
  - name: With Media
    type: table
    filters:
      and:
        - '!media.isEmpty()'
    order:
      - note.title
  - name: Missing Media
    type: table
    filters:
      and:
        - 'media.isEmpty()'
    order:
      - note.title
  - name: By Date
    type: table
    filters:
      and:
        - '!source_date.isEmpty()'
    order:
      - note.source_date
  - name: Recently Accessed
    type: table
    filters:
      and:
        - '!source_date_accessed.isEmpty()'
    order:
      - note.source_date_accessed
  - name: By Collection
    type: table
    filters:
      and:
        - '!collection.isEmpty()'
    groupBy:
      property: note.collection
      direction: ASC
    order:
      - note.title
  - name: By Location
    type: table
    filters:
      and:
        - '!location.isEmpty()'
    groupBy:
      property: note.location
      direction: ASC
    order:
      - note.title
  - name: Media Gallery
    type: cards
    filters:
      and:
        - '!media.isEmpty()'
    image: note.media
    imageFit: contain
    order:
      - note.title
      - note.source_type
      - note.source_date
`;
