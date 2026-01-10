# Geographic Features Plan

> **Status:** Phase 1 ✓, Phase 2 ✓, Phase 2.5 ✓, Phase 3 ✓ (Phase 4: Planned)
> **Version:** 0.5.2

This document outlines the design for geographic/place-based features in Charted Roots.

---

## Overview

Geographic features will enable users to:
- Create and manage place notes with hierarchical relationships
- Track where people were born, died, married, and lived
- Visualize migration patterns and geographic distributions
- Support both real-world and fictional geography

---

## Phase 1: Place Notes Foundation ✓

### Place Note Schema

```yaml
---
type: place
cr_id: place_abc123
name: "London"
aliases:
  - "City of London"
  - "Londinium"

# Classification
place_category: real  # real | historical | disputed | legendary | mythological | fictional
universe: null        # optional, for fictional/mythological/legendary places

# Hierarchy
parent_place: "[[England]]"  # or parent_place_id: place_xyz789
place_type: city             # city, village, region, country, castle, etc.

# Real-world coordinates (for real, historical, disputed places)
coordinates:
  lat: 51.5074
  long: -0.1278

# Custom coordinates (for fictional places or custom maps)
custom_coordinates:
  x: null
  y: null
  map: null  # path to custom map image

# Historical names (place changed names over time)
historical_names:
  - name: "Londinium"
    period: "Roman"
  - name: "Lundenwic"
    period: "Anglo-Saxon"
---

# London

Notes about this place...
```

### Place Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `real` | Verified real-world location | London, New York, Tokyo |
| `historical` | Real place that no longer exists or changed significantly | Babylon, Constantinople, Tenochtitlan |
| `disputed` | Location debated by historians/archaeologists | Troy, King Solomon's Mines |
| `legendary` | May have historical basis but heavily fictionalized | Camelot, El Dorado, Shangri-La |
| `mythological` | Place from mythology/religion, not claimed to be real | Asgard, Mount Olympus, Valhalla |
| `fictional` | Invented for a story/world | Winterfell, Mordor, Gotham City |

### Default Behavior

- If `place_category` is omitted, defaults to `real`
- `universe` field only relevant for `fictional`, `mythological`, `legendary` categories
- Data quality warnings if `fictional` place has lat/long coordinates

### Person Note Integration

Person notes can reference places in two ways:

```yaml
# String-based (current, backwards compatible)
birth_place: "London, England"

# Link-based (enhanced)
birth_place: "[[London]]"
birth_place_id: place_abc123
```

---

## Phase 2: Place Statistics ✓

A new section in the Control Center showing aggregate place data.

### Statistics Display

```
📍 Place Statistics

Overview
────────
Total places: 47
With coordinates: 38 (81%)
Orphan places (no parent): 3
Max hierarchy depth: 5

By Category
───────────
Real:          34 places │ 156 people
Historical:     8 places │  23 people
Fictional:     13 places │  45 people
Mythological:   4 places │  12 people
Disputed:       2 places │   6 people
Unclassified:   5 places │  18 people

Most Common Birth Places
────────────────────────
1. London, England         23
2. New York, USA           18
3. Dublin, Ireland         12
4. Unknown                  8
5. Paris, France            7

Migration Patterns (Birth → Death)
──────────────────────────────────
Ireland → USA              14
England → Australia         8
Germany → USA               6

Place Hierarchy Issues
──────────────────────
⚠ "Springfield" appears in 3 different hierarchies
⚠ "London" has no parent place defined
⚠ 5 people reference non-existent place notes
```

### Actions from Statistics Panel

| Action | Status | Description |
|--------|--------|-------------|
| Create missing place notes | ✓ | Generate notes for places referenced but not created |
| Build hierarchy | ✓ | Wizard to assign parent places to orphans |
| View place index | ✓ | Alphabetical list with person counts |
| Standardize place names | ✓ | Find variations and unify them |
| Migration diagram | ✓ | Visual showing flows between places |

---

## Phase 3: Simple Visualization ✓

D3-based visualizations without external map dependencies.

### Schematic/Network View ✓

- ✓ Places as nodes, connections as edges
- ✓ Size nodes by number of associated people
- ✓ Color by category, place type, or hierarchy depth
- ✓ Tree and radial layout options
- ✓ Interactive tooltips with place details
- ✓ Show migration flows as directed edges overlay (toggle-able)

### Migration Flow Diagram ✓

- ✓ Arc diagram showing movement between places
- ✓ Filter by minimum flow count
- ✓ Color-coded nodes (green=birth origin, red=death destination)
- ✓ Interactive tooltips with flow details
- ✓ Filter by time period (year range inputs with century presets)
- ✓ Aggregate by region (hierarchy level grouping)
- ✓ Filter by collection (family branch)

---

## Phase 4: Full Map Support

### Real-World Maps

**Recommended Stack:**
- Leaflet.js (~40KB) for map rendering
- OpenStreetMap tiles (free, attribution required)
- Nominatim for geocoding (optional, rate-limited)

**Features:**
- Pin markers for birth/death locations
- Lines showing migration paths
- Cluster markers for dense areas
- Time slider to animate across generations

### Fictional/Custom Maps

**Custom Image Maps:**
- User provides map image (PNG/SVG)
- Define coordinate bounds for the image
- Place pins using pixel or custom coordinate system

**Map Upload/Selection in Create Place Modal:**
- File picker to select an existing map image from the vault
- Import from filesystem: drag-and-drop or file dialog to add external images to vault
- Configurable destination folder for imported maps (e.g., `assets/maps/`)
- Map preview with click-to-set coordinates
- Remember recently used maps per universe/collection
- Support common image formats: PNG, JPG, SVG, WebP

**Features:**
- Same pin/path visualization as real maps
- Support multiple custom maps per universe
- Link between custom and real maps for hybrid worlds

### Feature Availability by Category

| Feature | real | historical | disputed | legendary | mythological | fictional |
|---------|------|------------|----------|-----------|--------------|-----------|
| Geocoding lookup | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| OpenStreetMap link | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Custom map support | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Universe grouping | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Historical names | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |

---

## Data Quality Integration

### New Validation Rules

- Person references place that doesn't exist as a note
- Place has no parent (orphan at non-root level)
- Circular hierarchy detected
- Duplicate place names without disambiguation
- Fictional place has real-world coordinates (likely mistake)
- Real place missing coordinates
- Person born in child place, died in ancestor place (geographically odd)

---

## Phase 2.5: UX Improvements ✓

Enhancements to place creation and management workflow.

### Parent Place Picker ✓

Add a searchable dropdown for parent place selection in Create Place modal:
- ✓ Similar pattern to collection dropdown
- ✓ Group by place type (Countries, States, Regions, etc.)
- ✓ Show place hierarchy path in dropdown (e.g., "London → England → UK")
- ✓ Filter options based on selected place type (hierarchy-aware filtering)

### Coordinate Entry ✓

Manual coordinate entry for real/historical/disputed places:
- ✓ Latitude and longitude input fields
- ✓ Validation (lat: -90 to 90, long: -180 to 180)
- ✓ Auto-hide for fictional/mythological places

### Quick-Create Place from Person Note ✓

When viewing a person note with unlinked place references:
- ✓ Context menu option "Create place notes..." on person notes
- ✓ Extract unlinked place references from birth_place, death_place, burial_place, marriage locations
- ✓ Filter out already-linked places and existing place notes
- ✓ Open CreateMissingPlacesModal for batch creation
- ✓ Auto-link option: converts plain text place names to wikilinks after creation
- ✓ Action button in person list (Control Center People tab) shows unlinked places with create actions

### Place Note Template Configuration (Partial)

Allow users to customize place note templates:
- ✓ Templater-compatible template snippets (copy-paste)
- ✓ Person and place note templates with Templater variables
- ✓ Variable reference documentation
- ✓ Link to frontmatter schema reference
- ✓ Default place category per folder/collection (via settings rules)
- ✓ Auto-populate parent place based on folder structure
- Future: Custom frontmatter fields (define additional fields via settings, display in modal)
- Future: Template selection in Create Place modal (choose from user-defined templates)

#### Default Place Category Rules

The plugin now supports configuring default place categories via settings:

1. **Global Default**: `defaultPlaceCategory` setting (defaults to 'real')
2. **Folder Rules**: Match places by destination folder path prefix
3. **Collection Rules**: Match places by collection name (exact match)

Rules are evaluated in order:
1. Collection rules checked first (if collection is provided)
2. Folder rules checked next (if folder is provided)
3. Global default used as fallback

**Settings Interface** (`CanvasRootsSettings`):
```typescript
defaultPlaceCategory: PlaceCategory;  // Global default
placeCategoryRules: PlaceCategoryRule[];  // Ordered list of rules

interface PlaceCategoryRule {
  type: 'folder' | 'collection';
  pattern: string;  // Folder path or collection name
  category: PlaceCategory;
}
```

**Example Configuration**:
```json
{
  "defaultPlaceCategory": "real",
  "placeCategoryRules": [
    { "type": "collection", "pattern": "Middle-earth", "category": "fictional" },
    { "type": "folder", "pattern": "Places/Historical", "category": "historical" },
    { "type": "folder", "pattern": "Places/Mythology", "category": "mythological" }
  ]
}
```

*Note: Settings UI for configuring these rules is planned for a future update. Currently requires manual JSON editing.*

#### Auto-Populate Parent Place from Folder Structure

When creating a new place note, the plugin automatically suggests a parent place based on the folder hierarchy:

1. **Folder Matching**: Scans the destination folder path for names matching existing place notes
2. **Deepest Match First**: Prefers more specific (deeper) folder matches over generic ones
3. **Case Insensitive**: Folder name "california" matches place note "California"
4. **Skip Generic Names**: Ignores common folder names like "Places", "Locations", "Charted Roots"

**Example**:
- Creating a place in `Places/USA/California/` with existing place notes for "USA" and "California"
- Will auto-select "California" as parent (deepest match)
- User can still change the selection in the dropdown

### Auto-Create Parent Place ✓

Streamlined workflow for creating place hierarchies:
- ✓ Detect when user enters a custom parent place that doesn't exist
- ✓ After creating child place, automatically open modal to create parent
- ✓ Pre-fill parent name and suggest appropriate place type based on child
- ✓ Type suggestions: city→state, town→county, county→state, state→country, etc.

### Geocoding Integration Prep ✓

Prepare infrastructure for optional geocoding:
- ✓ "Look up coordinates" button for real/historical places
- ✓ Nominatim API integration for free geocoding
- ✓ Parent place included in search query for better accuracy
- Planned: Preview on mini-map (Phase 4 integration point)

### Custom Place Types ✓

Flexible place type system beyond the built-in types:
- ✓ "Other..." option in place type dropdown reveals text input
- ✓ Users can enter any custom type (e.g., "galaxy", "star-system", "dimension")
- ✓ Custom types normalized to lowercase with hyphens
- ✓ Custom types stored as-is in frontmatter `place_type` field
- ✓ Custom types treated as hierarchy level 99 (leaf-level) for parent filtering
- ✓ Statistics track custom types alongside known types
- ✓ Edit mode preserves and displays custom types correctly

### Places Base Support ✓

Folder context menu integration for Obsidian Bases plugin:
- ✓ "Set as places folder" menu option to configure default places location
- ✓ "New places base from template" creates pre-configured `.base` file
- ✓ 14 pre-configured views in the template:
  - All Places, By Type, By Category
  - Countries, States/Provinces, Cities/Towns
  - Real Places, Historical Places, Fictional Places
  - By Universe (for fictional places)
  - With Coordinates, Missing Coordinates
  - Orphan Places (no parent)
  - By Collection
- ✓ Desktop submenu and mobile flat menu support
- ✓ Graceful handling when Bases plugin not installed

---

## Control Center Changes ✓

Updates to Control Center tabs and organization for geographic features.

### Tab Restructuring ✓

- ✓ Renamed "Data entry" tab to "People" for clarity
- ✓ Removed "Person details" tab (functionality merged into People tab)
- ✓ People tab now shows person list with:
  - Expandable unlinked place badges
  - "Create" buttons for each unlinked place field
  - Integration with CreateMissingPlacesModal

### Places Folder Setting ✓

Added dedicated places folder setting in plugin settings:
- ✓ Separate from `peopleFolder` setting
- ✓ Used as default destination for new place notes
- ✓ Configurable via Settings > Charted Roots > Places folder

---

## Integration Improvements

Cross-feature integration with existing Charted Roots functionality.

### Filter Trees by Place ✓

Add place-based filtering to tree views:
- ✓ Filter by birth place, death place, marriage location, or burial place
- ✓ Configurable place type checkboxes (birth, death, marriage, burial)
- ✓ Text input for place name matching
- ✓ Integrated into Tree Output tab
- Planned: Show all people born in a specific country/region
- Planned: Highlight migration paths on tree canvas

### Place-Based Collections

Auto-grouping based on geographic data:
- Group people by birth country/region
- Identify geographic clusters in family
- "All people from Ireland" quick filter

### Timeline Integration

Connect places with temporal data:
- Show when family moved to/from places
- Generation-by-generation geographic spread
- Historical context for place names (use correct period name)

---

## Implementation Questions (TBD)

1. **Place note creation**: Automatic from imports, or manual only?
2. **Hierarchy enforcement**: Strict (must link to parent) or flexible (string fallback)?
3. **Existing data migration**: How to convert `birth_place: "London, England"` strings to place note links?
4. **Settings**: Places folder location, default category, coordinate system preference

---

## Third-Party Dependencies

| Library | Purpose | Size | Required Phase |
|---------|---------|------|----------------|
| Leaflet.js | Map rendering | ~40KB | Phase 4 |
| D3-geo | SVG map projections | Already included | Phase 3 |

**External Services (Optional):**
- OpenStreetMap tiles (free, attribution required)
- Nominatim geocoding API (free, rate-limited)

---

## Related Roadmap Items

From `docs/roadmap.md`:
- Place name standardization and geocoding
- Map view showing birth/death locations
- Migration pattern visualization
- Place hierarchy (City → County → State → Country)
- Location-based filtering and analysis
- Historical place name support
- Geographic grouping and timeline support
- Geographic distribution analysis and maps
- Location and migration tracking
- Place note system
