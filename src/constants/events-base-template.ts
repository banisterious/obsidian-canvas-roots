/**
 * Obsidian Bases template for managing Canvas Roots event notes
 */

/**
 * Property aliases mapping type
 * Maps user's custom property name → Canvas Roots canonical name
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

	return `formulas:
  display_title: ${title} || file.name
  date_display: if(${date}, ${date}.format("YYYY-MM-DD"), "")
  end_date_display: if(${date_end}, ${date_end}.format("YYYY-MM-DD"), "")
  duration: if(${date} && ${date_end}, ${date_end}.year() - ${date}.year() + " years", "")
  sourced: if(${sources}, "Yes", "No")
filters:
  and:
    - file.hasProperty("${event_type}")
properties:
  note.${cr_id}:
    displayName: ID
  formula.display_title:
    displayName: Title
  note.${event_type}:
    displayName: Type
  formula.date_display:
    displayName: Date
  note.${date_end}:
    displayName: End Date
  formula.end_date_display:
    displayName: End Date
  formula.duration:
    displayName: Duration
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
  formula.sourced:
    displayName: Sourced
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
  file.path:
    displayName: Location
views:
  - type: table
    name: All Events
    filters:
      and:
        - file.hasProperty("${event_type}")
    order:
      - ${date}
      - ${sort_order}
      - file.name
  - type: table
    name: By type
    filters:
      and:
        - file.hasProperty("${event_type}")
    order:
      - ${event_type}
      - ${date}
    summaries:
      ${event_type}: Count
  - type: table
    name: By person
    filters:
      and:
        - file.hasProperty("${event_type}")
        - note.${person}
    order:
      - ${person}
      - ${date}
    summaries:
      ${person}: Count
  - type: table
    name: By place
    filters:
      and:
        - file.hasProperty("${event_type}")
        - note.${place}
    order:
      - ${place}
      - ${date}
    summaries:
      ${place}: Count
  - type: table
    name: Vital events
    filters:
      or:
        - note.${event_type} = "birth"
        - note.${event_type} = "death"
        - note.${event_type} = "marriage"
        - note.${event_type} = "divorce"
    order:
      - ${event_type}
      - ${date}
    summaries:
      ${event_type}: Count
  - type: table
    name: Life events
    filters:
      or:
        - note.${event_type} = "residence"
        - note.${event_type} = "occupation"
        - note.${event_type} = "military"
        - note.${event_type} = "immigration"
        - note.${event_type} = "education"
        - note.${event_type} = "burial"
        - note.${event_type} = "baptism"
        - note.${event_type} = "confirmation"
        - note.${event_type} = "ordination"
    order:
      - ${event_type}
      - ${date}
    summaries:
      ${event_type}: Count
  - type: table
    name: Narrative events
    filters:
      or:
        - note.${event_type} = "anecdote"
        - note.${event_type} = "lore_event"
        - note.${event_type} = "plot_point"
        - note.${event_type} = "flashback"
        - note.${event_type} = "foreshadowing"
        - note.${event_type} = "backstory"
        - note.${event_type} = "climax"
        - note.${event_type} = "resolution"
    order:
      - ${event_type}
      - ${date}
    summaries:
      ${event_type}: Count
  - type: table
    name: By confidence
    filters:
      and:
        - file.hasProperty("${event_type}")
        - note.${confidence}
    order:
      - ${confidence}
      - ${date}
    summaries:
      ${confidence}: Count
  - type: table
    name: High confidence
    filters:
      and:
        - file.hasProperty("${event_type}")
        - note.${confidence} = "high"
    order:
      - ${date}
  - type: table
    name: Low confidence
    filters:
      and:
        - file.hasProperty("${event_type}")
        - note.${confidence} = "low"
    order:
      - ${date}
  - type: table
    name: Unknown confidence
    filters:
      and:
        - file.hasProperty("${event_type}")
        - note.${confidence} = "unknown"
    order:
      - ${date}
  - type: table
    name: With sources
    filters:
      and:
        - file.hasProperty("${event_type}")
        - note.${sources}
    order:
      - ${date}
    summaries:
      formula.sourced: Count
  - type: table
    name: Missing sources
    filters:
      and:
        - file.hasProperty("${event_type}")
        - "!note.${sources}"
    order:
      - ${date}
  - type: table
    name: Dated events
    filters:
      and:
        - file.hasProperty("${event_type}")
        - note.${date}
    order:
      - ${date}
    summaries:
      ${date}: Earliest
  - type: table
    name: Undated events
    filters:
      and:
        - file.hasProperty("${event_type}")
        - "!note.${date}"
    order:
      - file.name
  - type: table
    name: Relative ordering only
    filters:
      and:
        - file.hasProperty("${event_type}")
        - "!note.${date}"
        - "note.${before} || note.${after}"
    order:
      - ${sort_order}
      - file.name
  - type: table
    name: Canonical events
    filters:
      and:
        - file.hasProperty("${event_type}")
        - note.${is_canonical} = true
    order:
      - ${date}
  - type: table
    name: By timeline
    filters:
      and:
        - file.hasProperty("${event_type}")
        - note.${timeline}
    order:
      - ${timeline}
      - ${date}
    summaries:
      ${timeline}: Count
  - type: table
    name: By universe
    filters:
      and:
        - file.hasProperty("${event_type}")
        - note.${universe}
    order:
      - ${universe}
      - ${date}
    summaries:
      ${universe}: Count
  - type: table
    name: By group
    filters:
      and:
        - file.hasProperty("${event_type}")
        - note.${groups}
    order:
      - ${groups}
      - ${date}
    summaries:
      ${groups}: Count
  - type: table
    name: Recently added
    filters:
      and:
        - file.hasProperty("${event_type}")
        - file.ctime > now() - '30 days'
    order:
      - file.ctime
    limit: 20
`;
}

/**
 * Static base template for backward compatibility
 * Uses canonical property names (no aliases)
 * @deprecated Use generateEventsBaseTemplate() instead
 */
export const EVENTS_BASE_TEMPLATE = generateEventsBaseTemplate();
