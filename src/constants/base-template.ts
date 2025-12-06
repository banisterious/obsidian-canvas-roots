/**
 * Obsidian Bases template for managing Canvas Roots family tree data
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
 * Generate the People base template with property aliases applied
 * @param aliases Property aliases from plugin settings
 * @returns The base template string with aliased property names
 */
export function generatePeopleBaseTemplate(aliases: PropertyAliases = {}): string {
	// Get aliased property names
	const name = getPropertyName('name', aliases);
	const cr_id = getPropertyName('cr_id', aliases);
	const gender = getPropertyName('gender', aliases);
	const born = getPropertyName('born', aliases);
	const died = getPropertyName('died', aliases);
	const father = getPropertyName('father', aliases);
	const mother = getPropertyName('mother', aliases);
	const spouse = getPropertyName('spouse', aliases);
	const child = getPropertyName('child', aliases);

	return `visibleProperties:
  - formula.display_name
  - note.${father}
  - note.${mother}
  - note.${spouse}
  - note.${child}
  - formula.birth_display
  - formula.death_display
  - note.${gender}
  - note.collection
  - note.group_name
  - note.root_person
  - note.lineage
  - note.generation
  - note.ahnentafel
  - note.daboville
summaries:
  generation_span: if(values.length > 0, values.max().year() - values.min().year(), 0)
filters:
  or:
    - file.hasTag("person")
    - file.hasProperty("${cr_id}")
formulas:
  display_name: ${name} || file.name
  full_lifespan: if(${born} && ${died}, ${died}.year() - ${born}.year() + " years", "")
  age_now: if(${born} && !${died}, now().year() - ${born}.year(), "")
  birth_display: if(${born}, ${born}.format("YYYY-MM-DD"), "")
  death_display: if(${died}, ${died}.format("YYYY-MM-DD"), "")
properties:
  ${cr_id}:
    displayName: ID
  formula.display_name:
    displayName: Name
  note.${father}:
    displayName: Father
  note.${mother}:
    displayName: Mother
  note.${spouse}:
    displayName: Spouse(s)
  note.${child}:
    displayName: Children
  formula.birth_display:
    displayName: Born
  formula.death_display:
    displayName: Died
  formula.full_lifespan:
    displayName: Lifespan
  formula.age_now:
    displayName: Age
  note.${gender}:
    displayName: Gender
  note.collection:
    displayName: Collection
  note.group_name:
    displayName: Group name
  note.root_person:
    displayName: Root person
  note.lineage:
    displayName: Lineage
  note.generation:
    displayName: Generation
  note.ahnentafel:
    displayName: Ahnentafel #
  note.daboville:
    displayName: d'Aboville #
  note.henry:
    displayName: Henry #
  file.path:
    displayName: Location
views:
  - type: table
    name: All family members
    filters:
      and:
        - note.${cr_id}
    order:
      - ${born}
      - file.name
      - ${father}
      - ${mother}
      - ${spouse}
      - ${child}
    summaries:
      ${born}: Earliest
      ${died}: Latest
      formula.full_lifespan: Average
  - type: table
    name: Living members
    filters:
      and:
        - note.${cr_id}
        - "!note.${died}"
    order:
      - ${born}
    summaries:
      formula.age_now: Average
  - type: table
    name: Deceased members
    filters:
      and:
        - note.${cr_id}
        - note.${died}
    order:
      - ${died}
    summaries:
      formula.full_lifespan: Average
      ${died}: Latest
  - type: table
    name: Recently added
    filters:
      and:
        - note.${cr_id}
        - file.ctime > now() - '30 days'
    order:
      - file.ctime
    limit: 20
  - type: table
    name: Missing parents
    filters:
      and:
        - note.${cr_id}
        - "!note.${father} && !note.${mother}"
    order:
      - file.name
  - type: table
    name: Incomplete data
    filters:
      and:
        - note.${cr_id}
        - "!note.${born} || !note.${name}"
    order:
      - file.name
  - type: table
    name: By collection
    filters:
      and:
        - note.${cr_id}
        - note.collection
    order:
      - collection
      - file.name
    summaries:
      collection: Count
      ${born}: Earliest
      ${died}: Latest
  - type: table
    name: By family group
    filters:
      and:
        - note.${cr_id}
        - note.group_name
    order:
      - group_name
      - file.name
    summaries:
      group_name: Count
      ${born}: Earliest
      ${died}: Latest
  - type: table
    name: Unassigned collections
    filters:
      and:
        - note.${cr_id}
        - "!note.collection"
    order:
      - file.name
  - type: table
    name: Single parents
    filters:
      and:
        - note.${cr_id}
        - note.${child}
        - "!note.${spouse}"
    order:
      - file.name
    summaries:
      ${child}: Count
  - type: table
    name: Childless couples
    filters:
      and:
        - note.${cr_id}
        - note.${spouse}
        - "!note.${child}"
    order:
      - file.name
  - type: table
    name: Multiple marriages
    filters:
      and:
        - note.${cr_id}
        - note.${spouse}
    order:
      - file.name
  - type: table
    name: Sibling groups
    filters:
      and:
        - note.${cr_id}
        - note.${father}
    order:
      - ${father}
      - ${mother}
      - ${born}
    summaries:
      ${father}: Count
  - type: table
    name: Root generation
    filters:
      and:
        - note.${cr_id}
        - "!note.${father} && !note.${mother}"
    order:
      - ${born}
    summaries:
      ${child}: Count
  - type: table
    name: Marked root persons
    filters:
      and:
        - note.${cr_id}
        - note.root_person = true
    order:
      - ${born}
    summaries:
      ${child}: Count
  - type: table
    name: By lineage
    filters:
      and:
        - note.${cr_id}
        - note.lineage
    order:
      - lineage
      - generation
      - ${born}
    summaries:
      lineage: Count
  - type: table
    name: By generation number
    filters:
      and:
        - note.${cr_id}
        - note.generation
    order:
      - generation
      - ${born}
    summaries:
      generation: Count
  - type: table
    name: Ahnentafel ordered
    filters:
      and:
        - note.${cr_id}
        - note.ahnentafel
    order:
      - ahnentafel
    summaries:
      ahnentafel: Max
  - type: table
    name: d'Aboville ordered
    filters:
      and:
        - note.${cr_id}
        - note.daboville
    order:
      - daboville
  - type: table
    name: Without lineage
    filters:
      and:
        - note.${cr_id}
        - "!note.lineage"
    order:
      - file.name
`;
}

/**
 * Static base template for backward compatibility
 * Uses canonical property names (no aliases)
 * @deprecated Use generatePeopleBaseTemplate() instead
 */
export const BASE_TEMPLATE = `visibleProperties:
  - formula.display_name
  - note.father
  - note.mother
  - note.spouse
  - note.child
  - formula.birth_display
  - formula.death_display
  - note.gender
  - note.collection
  - note.group_name
  - note.root_person
  - note.lineage
  - note.generation
  - note.ahnentafel
  - note.daboville
summaries:
  generation_span: if(values.length > 0, values.max().year() - values.min().year(), 0)
filters:
  or:
    - file.hasTag("person")
    - file.hasProperty("cr_id")
formulas:
  display_name: name || file.name
  full_lifespan: if(born && died, died.year() - born.year() + " years", "")
  age_now: if(born && !died, now().year() - born.year(), "")
  birth_display: if(born, born.format("YYYY-MM-DD"), "")
  death_display: if(died, died.format("YYYY-MM-DD"), "")
properties:
  cr_id:
    displayName: ID
  formula.display_name:
    displayName: Name
  note.father:
    displayName: Father
  note.mother:
    displayName: Mother
  note.spouse:
    displayName: Spouse(s)
  note.child:
    displayName: Children
  formula.birth_display:
    displayName: Born
  formula.death_display:
    displayName: Died
  formula.full_lifespan:
    displayName: Lifespan
  formula.age_now:
    displayName: Age
  note.gender:
    displayName: Gender
  note.collection:
    displayName: Collection
  note.group_name:
    displayName: Group name
  note.root_person:
    displayName: Root person
  note.lineage:
    displayName: Lineage
  note.generation:
    displayName: Generation
  note.ahnentafel:
    displayName: Ahnentafel #
  note.daboville:
    displayName: d'Aboville #
  note.henry:
    displayName: Henry #
  file.path:
    displayName: Location
views:
  - type: table
    name: All family members
    filters:
      and:
        - note.cr_id
    order:
      - born
      - file.name
      - father
      - mother
      - spouse
      - child
    summaries:
      born: Earliest
      died: Latest
      formula.full_lifespan: Average
  - type: table
    name: Living members
    filters:
      and:
        - note.cr_id
        - "!note.died"
    order:
      - born
    summaries:
      formula.age_now: Average
  - type: table
    name: Deceased members
    filters:
      and:
        - note.cr_id
        - note.died
    order:
      - died
    summaries:
      formula.full_lifespan: Average
      died: Latest
  - type: table
    name: Recently added
    filters:
      and:
        - note.cr_id
        - file.ctime > now() - '30 days'
    order:
      - file.ctime
    limit: 20
  - type: table
    name: Missing parents
    filters:
      and:
        - note.cr_id
        - "!note.father && !note.mother"
    order:
      - file.name
  - type: table
    name: Incomplete data
    filters:
      and:
        - note.cr_id
        - "!note.born || !note.name"
    order:
      - file.name
  - type: table
    name: By collection
    filters:
      and:
        - note.cr_id
        - note.collection
    order:
      - collection
      - file.name
    summaries:
      collection: Count
      born: Earliest
      died: Latest
  - type: table
    name: By family group
    filters:
      and:
        - note.cr_id
        - note.group_name
    order:
      - group_name
      - file.name
    summaries:
      group_name: Count
      born: Earliest
      died: Latest
  - type: table
    name: Unassigned collections
    filters:
      and:
        - note.cr_id
        - "!note.collection"
    order:
      - file.name
  - type: table
    name: Single parents
    filters:
      and:
        - note.cr_id
        - note.child
        - "!note.spouse"
    order:
      - file.name
    summaries:
      child: Count
  - type: table
    name: Childless couples
    filters:
      and:
        - note.cr_id
        - note.spouse
        - "!note.child"
    order:
      - file.name
  - type: table
    name: Multiple marriages
    filters:
      and:
        - note.cr_id
        - note.spouse
    order:
      - file.name
  - type: table
    name: Sibling groups
    filters:
      and:
        - note.cr_id
        - note.father
    order:
      - father
      - mother
      - born
    summaries:
      father: Count
  - type: table
    name: Root generation
    filters:
      and:
        - note.cr_id
        - "!note.father && !note.mother"
    order:
      - born
    summaries:
      child: Count
  - type: table
    name: Marked root persons
    filters:
      and:
        - note.cr_id
        - note.root_person = true
    order:
      - born
    summaries:
      child: Count
  - type: table
    name: By lineage
    filters:
      and:
        - note.cr_id
        - note.lineage
    order:
      - lineage
      - generation
      - born
    summaries:
      lineage: Count
  - type: table
    name: By generation number
    filters:
      and:
        - note.cr_id
        - note.generation
    order:
      - generation
      - born
    summaries:
      generation: Count
  - type: table
    name: Ahnentafel ordered
    filters:
      and:
        - note.cr_id
        - note.ahnentafel
    order:
      - ahnentafel
    summaries:
      ahnentafel: Max
  - type: table
    name: d'Aboville ordered
    filters:
      and:
        - note.cr_id
        - note.daboville
    order:
      - daboville
  - type: table
    name: Without lineage
    filters:
      and:
        - note.cr_id
        - "!note.lineage"
    order:
      - file.name
`;
