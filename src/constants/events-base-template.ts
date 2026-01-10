/**
 * Obsidian Bases template for managing Charted Roots event notes
 */

/**
 * Property aliases mapping type
 * Maps user's custom property name → Charted Roots canonical name
 */
export type PropertyAliases = Record<string, string>;

/**
 * Get the display property name for a canonical property
 * If an alias exists, returns the user's aliased name; otherwise returns the canonical name
 */
function getPropertyName(canonical: string, aliases: PropertyAliases): string {
	// Find if user has an alias for this canonical property
	for (const [userProp, canonicalProp] of Object.entries(aliases)) {
		if (canonicalProp === canonical) {
			return userProp;
		}
	}
	return canonical;
}

/**
 * Generate the Events base template with property aliases applied
 * @param aliases Property aliases from plugin settings
 * @returns The base template string with aliased property names
 */
export function generateEventsBaseTemplate(aliases: PropertyAliases = {}): string {
	// Get aliased property names for event properties
	const title = getPropertyName('title', aliases);
	const event_type = getPropertyName('event_type', aliases);
	const date = getPropertyName('date', aliases);
	const date_end = getPropertyName('date_end', aliases);
	const date_precision = getPropertyName('date_precision', aliases);
	const person = getPropertyName('person', aliases);
	const persons = getPropertyName('persons', aliases);
	const place = getPropertyName('place', aliases);
	const sources = getPropertyName('sources', aliases);
	const confidence = getPropertyName('confidence', aliases);
	const description = getPropertyName('description', aliases);
	const before = getPropertyName('before', aliases);
	const after = getPropertyName('after', aliases);
	const timeline = getPropertyName('timeline', aliases);
	const sort_order = getPropertyName('sort_order', aliases);
	const groups = getPropertyName('groups', aliases);
	const is_canonical = getPropertyName('is_canonical', aliases);
	const universe = getPropertyName('universe', aliases);
	const cr_id = getPropertyName('cr_id', aliases);
	const cr_type = getPropertyName('cr_type', aliases);

	return `visibleProperties:
  - note.${title}
  - note.${event_type}
  - note.${date}
  - formula.participant
  - note.${place}
  - note.${confidence}
  - note.${date_precision}
summaries:
  total_events: 'values.length'
filters:
  and:
    - '${cr_type} == "event"'
formulas:
  display_name: '${title} || file.name'
  year_only: 'if(${date}, ${date}.year, "")'
  has_sources: 'if(${sources}, "Yes", "No")'
  is_dated: 'if(${date}, "Dated", "Relative only")'
  participant: 'if(${persons}, ${persons}.map([value, html("<span style=\\"margin-left:-0.25em\\">,</span>")]).flat().slice(0, -1), if(${person}, ${person}, ""))'
properties:
  ${cr_id}:
    displayName: ID
  note.${title}:
    displayName: Title
  note.${event_type}:
    displayName: Type
  note.${date}:
    displayName: Date
  note.${date_end}:
    displayName: End Date
  note.${date_precision}:
    displayName: Precision
  note.${person}:
    displayName: Person
  note.${persons}:
    displayName: People
  note.${place}:
    displayName: Place
  note.${sources}:
    displayName: Sources
  note.${confidence}:
    displayName: Confidence
  note.${description}:
    displayName: Description
  note.${before}:
    displayName: Before
  note.${after}:
    displayName: After
  note.${timeline}:
    displayName: Timeline
  note.${sort_order}:
    displayName: Sort Order
  note.${groups}:
    displayName: Groups
  note.${is_canonical}:
    displayName: Canonical
  note.${universe}:
    displayName: Universe
  formula.display_name:
    displayName: Display Name
  formula.year_only:
    displayName: Year
  formula.has_sources:
    displayName: Has Sources
  formula.is_dated:
    displayName: Date Status
  formula.participant:
    displayName: Person(s)
views:
  - name: All Events
    type: table
    order:
      - note.${title}
      - note.${event_type}
      - note.${date}
      - formula.participant
      - note.${place}
  - name: By Type
    type: table
    groupBy:
      property: note.${event_type}
      direction: ASC
    order:
      - file.name
      - note.${date}
  - name: By Person
    type: table
    filters:
      or:
        - '!${persons}.isEmpty()'
        - '!${person}.isEmpty()'
    groupBy:
      property: note.${persons}
      direction: ASC
    order:
      - note.${date}
  - name: By Place
    type: table
    filters:
      and:
        - '!${place}.isEmpty()'
    groupBy:
      property: note.${place}
      direction: ASC
    order:
      - file.name
      - note.${date}
  - name: By Confidence
    type: table
    groupBy:
      property: note.${confidence}
      direction: ASC
    order:
      - note.${date}
  - name: Vital Events
    type: table
    filters:
      or:
        - '${event_type} == "birth"'
        - '${event_type} == "death"'
        - '${event_type} == "marriage"'
        - '${event_type} == "divorce"'
    order:
      - file.name
      - note.${date}
  - name: Life Events
    type: table
    filters:
      or:
        - '${event_type} == "residence"'
        - '${event_type} == "occupation"'
        - '${event_type} == "military"'
        - '${event_type} == "immigration"'
        - '${event_type} == "education"'
        - '${event_type} == "burial"'
        - '${event_type} == "baptism"'
        - '${event_type} == "confirmation"'
        - '${event_type} == "ordination"'
    order:
      - note.${date}
  - name: Narrative Events
    type: table
    filters:
      or:
        - '${event_type} == "anecdote"'
        - '${event_type} == "lore_event"'
        - '${event_type} == "plot_point"'
        - '${event_type} == "flashback"'
        - '${event_type} == "foreshadowing"'
        - '${event_type} == "backstory"'
        - '${event_type} == "climax"'
        - '${event_type} == "resolution"'
    order:
      - note.${date}
  - name: High Confidence
    type: table
    filters:
      and:
        - '${confidence} == "high"'
    order:
      - note.${date}
  - name: Low Confidence
    type: table
    filters:
      or:
        - '${confidence} == "low"'
        - '${confidence} == "unknown"'
    order:
      - note.${date}
  - name: With Sources
    type: table
    filters:
      and:
        - '!${sources}.isEmpty()'
    order:
      - note.${date}
  - name: Missing Sources
    type: table
    filters:
      and:
        - '${sources}.isEmpty()'
    order:
      - note.${date}
  - name: Dated Events
    type: table
    filters:
      and:
        - '!${date}.isEmpty()'
    order:
      - note.${date}
  - name: Relative Ordering Only
    type: table
    filters:
      and:
        - '${date}.isEmpty()'
        - '!${before}.isEmpty() || !${after}.isEmpty()'
    order:
      - note.${sort_order}
  - name: Canonical Events
    type: table
    filters:
      and:
        - '${is_canonical} == true'
    order:
      - note.${date}
  - name: By Timeline
    type: table
    filters:
      and:
        - '!${timeline}.isEmpty()'
    groupBy:
      property: note.${timeline}
      direction: ASC
    order:
      - note.${date}
  - name: By Universe
    type: table
    filters:
      and:
        - '!${universe}.isEmpty()'
    groupBy:
      property: note.${universe}
      direction: ASC
    order:
      - note.${date}
  - name: By Group
    type: table
    filters:
      and:
        - '!${groups}.isEmpty()'
    groupBy:
      property: note.${groups}
      direction: ASC
    order:
      - note.${date}
  - name: By Sort Order
    type: table
    order:
      - note.${sort_order}
`;
}

/**
 * Static base template for backward compatibility
 * Uses canonical property names (no aliases)
 * @deprecated Use generateEventsBaseTemplate() instead
 */
export const EVENTS_BASE_TEMPLATE = generateEventsBaseTemplate();
