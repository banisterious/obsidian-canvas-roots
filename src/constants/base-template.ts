/**
 * Obsidian Bases template for managing Canvas Roots family tree data
 */

/**
 * Property aliases mapping type
 * Maps user's custom property name → Canvas Roots canonical name
 */
export type PropertyAliases = Record<string, string>;

/**
 * Options for generating the People base template
 */
export interface PeopleBaseTemplateOptions {
	/** Property aliases from plugin settings */
	aliases?: PropertyAliases;
	/** Maximum age to consider someone without a death date as still living (default: 125) */
	maxLivingAge?: number;
}

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
 * @param aliasesOrOptions Property aliases object OR options object with aliases and maxLivingAge
 * @returns The base template string with aliased property names
 */
export function generatePeopleBaseTemplate(aliasesOrOptions: PropertyAliases | PeopleBaseTemplateOptions = {}): string {
	// Handle both old signature (just aliases) and new signature (options object)
	let aliases: PropertyAliases;
	let maxLivingAge: number;

	// Check if it's the new options object format (has 'aliases' or 'maxLivingAge' keys)
	const isOptionsObject = aliasesOrOptions &&
		typeof aliasesOrOptions === 'object' &&
		('aliases' in aliasesOrOptions || 'maxLivingAge' in aliasesOrOptions);

	if (isOptionsObject) {
		// New options object format
		const options = aliasesOrOptions as PeopleBaseTemplateOptions;
		aliases = options.aliases ?? {};
		maxLivingAge = options.maxLivingAge ?? 125;
	} else {
		// Old format (just aliases) for backward compatibility
		aliases = aliasesOrOptions as PropertyAliases;
		maxLivingAge = 125;
	}

	// Get aliased property names
	const name = getPropertyName('name', aliases);
	const cr_id = getPropertyName('cr_id', aliases);
	const cr_type = getPropertyName('cr_type', aliases);
	const sex = getPropertyName('sex', aliases);
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
  - note.${sex}
  - note.collection
  - note.group_name
  - note.root_person
  - note.lineage
  - note.generation
  - note.ahnentafel
  - note.daboville
summaries:
  generation_span: 'if(values.length > 0, (values.max() - values.min()).years.floor(), 0)'
filters:
  and:
    - '${cr_type} == "person"'
formulas:
  display_name: '${name} || file.name'
  age: 'if(${born}.isEmpty(), "Unknown", if(${died}.isEmpty() && (now() - ${born}).years.floor() < ${maxLivingAge}, (now() - ${born}).years.floor() + " years", if(${born} && !${died}.isEmpty(), (${died} - ${born}).years.floor() + " years", "Unknown")))'
  birth_display: 'if(${born}, ${born}.format("YYYY-MM-DD"), "")'
  death_display: 'if(${died}, ${died}.format("YYYY-MM-DD"), "")'
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
  formula.age:
    displayName: Age
  note.${sex}:
    displayName: Sex
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
        - '!${cr_id}.isEmpty()'
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
      formula.age: Average
  - type: table
    name: Living members
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - '${died}.isEmpty()'
        - '(now() - ${born}).years.floor() < ${maxLivingAge}'
    order:
      - ${born}
      - ${name}
    summaries:
      formula.age: Average
  - type: table
    name: Deceased members
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - '!${died}.isEmpty() || (now() - ${born}).years.floor() >= ${maxLivingAge}'
    order:
      - ${died}
      - ${name}
    summaries:
      formula.age: Average
      ${died}: Latest
  - type: table
    name: Recently added
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - 'file.ctime > now() - "30d"'
    order:
      - file.ctime
    limit: 20
  - type: table
    name: Missing parents
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - '${father}.isEmpty() && ${mother}.isEmpty()'
    order:
      - file.name
  - type: table
    name: Incomplete data
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - '${born}.isEmpty() || ${name}.isEmpty()'
    order:
      - file.name
  - type: table
    name: By collection
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - '!collection.isEmpty()'
    groupBy:
      property: note.collection
      direction: ASC
    order:
      - collection
      - file.name
    summaries:
      collection: Unique
      ${born}: Earliest
      ${died}: Latest
  - type: table
    name: By family group
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - '!group_name.isEmpty()'
    groupBy:
      property: note.group_name
      direction: ASC
    order:
      - group_name
      - file.name
    summaries:
      group_name: Unique
      ${born}: Earliest
      ${died}: Latest
  - type: table
    name: Unassigned collections
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - 'collection.isEmpty()'
    order:
      - file.name
  - type: table
    name: Single parents
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - '!${child}.isEmpty()'
        - '${spouse}.isEmpty()'
    order:
      - file.name
    summaries:
      ${child}: Filled
  - type: table
    name: Childless couples
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - '!${spouse}.isEmpty()'
        - '${child}.isEmpty()'
    order:
      - file.name
  - type: table
    name: Multiple marriages
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - '!${spouse}.isEmpty()'
    order:
      - file.name
  - type: table
    name: Sibling groups
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - '!${father}.isEmpty()'
    groupBy:
      property: note.${father}
      direction: ASC
    order:
      - ${father}
      - ${mother}
      - ${born}
    summaries:
      ${father}: Unique
  - type: table
    name: Root generation
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - '${father}.isEmpty() && ${mother}.isEmpty()'
    order:
      - ${born}
    summaries:
      ${child}: Filled
  - type: table
    name: Marked root persons
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - 'root_person == true'
    order:
      - ${born}
    summaries:
      ${child}: Filled
  - type: table
    name: By lineage
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - '!lineage.isEmpty()'
    groupBy:
      property: note.lineage
      direction: ASC
    order:
      - lineage
      - generation
      - ${born}
    summaries:
      lineage: Unique
  - type: table
    name: By generation number
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - '!generation.isEmpty()'
    groupBy:
      property: note.generation
      direction: ASC
    order:
      - generation
      - ${born}
    summaries:
      generation: Unique
  - type: table
    name: Ahnentafel ordered
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - '!ahnentafel.isEmpty()'
    order:
      - ahnentafel
    summaries:
      ahnentafel: Max
  - type: table
    name: d'Aboville ordered
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - '!daboville.isEmpty()'
    order:
      - daboville
  - type: table
    name: Without lineage
    filters:
      and:
        - '!${cr_id}.isEmpty()'
        - 'lineage.isEmpty()'
    order:
      - file.name
`;
}

/**
 * Static base template for backward compatibility
 * Uses canonical property names (no aliases)
 * @deprecated Use generatePeopleBaseTemplate() instead
 */
export const BASE_TEMPLATE = generatePeopleBaseTemplate();
