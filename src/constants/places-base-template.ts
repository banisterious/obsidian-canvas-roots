/**
 * Obsidian Bases template for managing Canvas Roots place notes
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
 * Generate the Places base template with property aliases applied
 * @param aliases Property aliases from plugin settings
 * @returns The base template string with aliased property names
 */
export function generatePlacesBaseTemplate(aliases: PropertyAliases = {}): string {
	// Get aliased property names for place properties
	const name = getPropertyName('name', aliases);
	const place_type = getPropertyName('place_type', aliases);
	const place_category = getPropertyName('place_category', aliases);
	const parent_place = getPropertyName('parent_place', aliases);
	const coordinates_lat = getPropertyName('coordinates_lat', aliases);
	const coordinates_long = getPropertyName('coordinates_long', aliases);
	const universe = getPropertyName('universe', aliases);
	const collection = getPropertyName('collection', aliases);
	const aliases_prop = getPropertyName('aliases', aliases);
	const cr_id = getPropertyName('cr_id', aliases);
	const cr_type = getPropertyName('cr_type', aliases);

	return `visibleProperties:
  - note.${name}
  - formula.map_link
  - note.${place_type}
  - note.${parent_place}
  - note.${universe}
  - note.${collection}
  - note.${aliases_prop}
summaries:
  total_places: 'values.length'
filters:
  and:
    - '${cr_type} == "place"'
formulas:
  display_name: '${name} || file.name'
  coordinates: 'if(${coordinates_lat}, ${coordinates_lat} + ", " + ${coordinates_long}, "")'
  map_link: 'if(${coordinates_lat}, link("obsidian://canvas-roots-map?lat=" + ${coordinates_lat} + "&lng=" + ${coordinates_long} + "&zoom=12", "📍"), "")'
  has_coords: 'if(${coordinates_lat}, "Yes", "No")'
  hierarchy_path: 'if(${parent_place}, ${parent_place} + " → " + ${name}, ${name})'
properties:
  ${cr_id}:
    displayName: ID
  note.${name}:
    displayName: Name
  note.${place_type}:
    displayName: Type
  note.${place_category}:
    displayName: Category
  note.${parent_place}:
    displayName: Parent
  note.${coordinates_lat}:
    displayName: Latitude
  note.${coordinates_long}:
    displayName: Longitude
  formula.coordinates:
    displayName: Coordinates
  formula.map_link:
    displayName: Map
  note.${universe}:
    displayName: Universe
  note.${collection}:
    displayName: Collection
  note.${aliases_prop}:
    displayName: Aliases
  formula.display_name:
    displayName: Display Name
  formula.has_coords:
    displayName: Has Coords
  formula.hierarchy_path:
    displayName: Hierarchy
views:
  - name: All Places
    type: table
    order:
      - file.name
      - note.${name}
      - formula.map_link
      - note.${place_type}
      - note.${place_category}
      - note.${parent_place}
  - name: By Type
    type: table
    groupBy:
      property: note.${place_type}
      direction: ASC
    order:
      - file.name
      - note.${name}
  - name: By Category
    type: table
    groupBy:
      property: note.${place_category}
      direction: ASC
    order:
      - note.${name}
  - name: Countries
    type: table
    filters:
      and:
        - '${place_type} == "country"'
    order:
      - file.name
      - note.${name}
  - name: States/Provinces
    type: table
    filters:
      or:
        - '${place_type} == "state"'
        - '${place_type} == "province"'
    order:
      - note.${name}
  - name: Cities/Towns
    type: table
    filters:
      or:
        - '${place_type} == "city"'
        - '${place_type} == "town"'
        - '${place_type} == "village"'
    order:
      - note.${name}
  - name: Real Places
    type: table
    filters:
      and:
        - '${place_category} == "real"'
    order:
      - note.${name}
  - name: Historical Places
    type: table
    filters:
      and:
        - '${place_category} == "historical"'
    order:
      - note.${name}
  - name: Fictional Places
    type: table
    filters:
      and:
        - '${place_category} == "fictional"'
    order:
      - note.${name}
  - name: By Universe
    type: table
    filters:
      and:
        - '!${universe}.isEmpty()'
    groupBy:
      property: note.${universe}
      direction: ASC
    order:
      - note.${name}
  - name: With Coordinates
    type: table
    filters:
      and:
        - '!${coordinates_lat}.isEmpty()'
    order:
      - note.${name}
      - formula.map_link
  - name: Missing Coordinates
    type: table
    filters:
      and:
        - '${coordinates_lat}.isEmpty()'
    order:
      - file.name
      - note.${name}
  - name: Orphan Places
    type: table
    filters:
      and:
        - '${parent_place}.isEmpty()'
    order:
      - note.${name}
  - name: By Collection
    type: table
    filters:
      and:
        - '!${collection}.isEmpty()'
    groupBy:
      property: note.${collection}
      direction: ASC
    order:
      - note.${name}
`;
}

/**
 * Static base template for backward compatibility
 * Uses canonical property names (no aliases)
 * @deprecated Use generatePlacesBaseTemplate() instead
 */
export const PLACES_BASE_TEMPLATE = generatePlacesBaseTemplate();
