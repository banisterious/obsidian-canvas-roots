# Geographic Features

Canvas Roots provides comprehensive place-based features for tracking where people were born, died, married, and lived. These features support both real-world genealogy and world-building with fictional places.

## Interactive Map View

The Map View provides a Leaflet.js-powered interactive map for visualizing where your family members lived, traveled, and died.

### Opening Map View

**Option 1: Maps Tab (Control Center)**
1. Open Control Center → **Maps** tab
2. Click **Open Map View** in the first card

**Option 2: Command Palette**
1. Open Command Palette (Ctrl/Cmd + P)
2. Search for "Canvas Roots: Open Map View"

**Option 3: Custom Maps Gallery**
- In the Maps tab, click any custom map thumbnail to open it directly in Map View

**Option 4: Context Menu**
- Right-click on a map note and select "Open in Map View"

### Map Features

| Feature | Description |
|---------|-------------|
| **Markers** | Color-coded pins for birth (green), death (red), marriage (purple), burial (gray), and life events |
| **Clustering** | Dense marker areas collapse into numbered clusters; click to zoom in |
| **Migration Paths** | Solid indigo lines connecting birth → death locations with person name labels |
| **Journey Paths** | Dashed violet lines connecting all life events chronologically |
| **Heat Map** | Geographic concentration visualization showing where most people lived |
| **Fullscreen** | Click the fullscreen button to expand the map |
| **Mini-map** | Overview inset in the corner for context |
| **Place Search** | Search for places and zoom to their location |

### Toolbar Controls

| Button | Function |
|--------|----------|
| **Filters** | Filter by collection, year range |
| **Layers** | Toggle marker types, paths, heat map, journey paths |
| **Time** | Open time slider for "who was alive when?" animation |
| **Map** | Switch between OpenStreetMap and custom image maps |
| **Split** | Open side-by-side map comparison |
| **Export** | Export as GeoJSON or SVG overlay |
| **Edit** | Enter edit mode for custom map alignment (custom maps only) |
| **Refresh** | Reload data from vault |

### Filtering

**By Collection:**
1. Click **Filters** in the toolbar
2. Select a collection from the dropdown
3. Only people in that collection will be shown

**By Year Range:**
1. Click **Filters** in the toolbar
2. Enter minimum and/or maximum years
3. Click **Apply**

### Layer Toggles

Control which elements appear on the map:

1. Click **Layers** in the toolbar
2. Toggle individual marker types:
   - Births, Deaths, Marriages, Burials
   - Residences, Occupations, Educations, Military
   - Immigrations, Religious, Custom events
3. Toggle path layers:
   - Migration paths (birth → death)
   - Journey paths (all events chronologically)
4. Toggle heat map layer

### Time Slider Animation

Visualize "who was alive when?" across your family tree:

1. Click **Time** in the toolbar
2. Use the slider to select a year
3. Click **Play** to animate through time
4. Adjust speed with the speed control
5. Toggle between modes:
   - **Snapshot**: Only show people alive at the selected year
   - **Cumulative**: Show everyone born up to the selected year

The person count displays how many people are visible at each point.

### Map Comparison (Split View)

Compare different views side-by-side:

1. Click **Split** in the toolbar
2. Choose horizontal or vertical split
3. Each map instance has independent filters
4. Use this to compare:
   - Different time periods
   - Different collections/branches
   - Real-world vs. custom maps

### Export Options

**GeoJSON Export:**
- Click **Export** → **Export as GeoJSON**
- Creates a standard GeoJSON file with markers and paths
- Compatible with GIS tools (QGIS, ArcGIS, etc.)

**SVG Overlay Export:**
- Click **Export** → **Export as SVG Overlay**
- Creates an SVG file with markers and paths
- Can be embedded in notes or edited in vector graphics software

## Maps Tab (Control Center)

The Maps tab in Control Center provides a central location for managing custom maps and accessing map visualizations.

### Opening the Maps Tab

1. Open Control Center (click the Canvas Roots icon in the ribbon or use Command Palette)
2. Click the **Maps** tab in the sidebar

### Tab Contents

The Maps tab contains four cards:

| Card | Description |
|------|-------------|
| **Open Map View** | Quick access button to launch the Map View, with coordinate coverage stats |
| **Custom Maps** | Thumbnail gallery of all custom map images with management actions |
| **Visualizations** | Migration diagrams and place network visualization tools |
| **Map Statistics** | Coordinate coverage percentage, custom map count, and universe list |

### Custom Maps Gallery

The gallery displays thumbnail previews of all map notes in your vault (notes with `cr_type: map` frontmatter).

**Thumbnail display:**
- Image preview (~150×100px) with the map image
- Map name overlay at the bottom
- Universe badge (if assigned)

**Interactions:**
- **Click thumbnail** → Open map in Map View
- **Hover** → Reveals action buttons (Edit and Menu)
- **Edit button** (pencil icon) → Open Edit Map modal
- **Menu button** (three dots) → Context menu with additional actions

### Context Menu Actions

Right-click a thumbnail or click the menu button to access:

| Action | Description |
|--------|-------------|
| **Open in Map View** | Launch Map View with this map selected |
| **Edit map** | Open the Edit Map modal to modify properties |
| **Duplicate map** | Create a copy with auto-generated unique ID |
| **Export to JSON** | Download map configuration as a JSON file |
| **Open note** | Open the map note in the editor |
| **Delete map** | Remove the map note (with confirmation) |

### Creating a Custom Map

1. In the Custom Maps card, click **Create map** (or **Import JSON** to import)
2. Fill in the Create Map modal:
   - **Map name** (required): Display name for the map
   - **Map image**: Click "Browse" to select an image from your vault
   - **Universe**: Optional grouping for fictional worlds (e.g., "got", "lotr")
   - **Coordinate system**: Geographic (lat/lng) or Pixel (for hand-drawn maps)
   - **Bounds/Dimensions**: Define the coordinate space
3. Click **Create**

The map note is created in your configured maps folder.

### Editing a Custom Map

1. Hover over a map thumbnail and click the **Edit** button (pencil icon)
2. Modify any properties in the Edit Map modal
3. Click **Save changes**

### Duplicating a Map

Useful for creating variations or backups:

1. Right-click a thumbnail → **Duplicate map**
2. A copy is created with "-copy" appended to the map ID
3. If "-copy" already exists, it becomes "-copy-2", "-copy-3", etc.
4. The duplicate opens immediately in edit mode

### Exporting and Importing Maps

**Export to JSON:**
1. Right-click a thumbnail → **Export to JSON**
2. Save the JSON file to your computer
3. The file contains all map frontmatter properties

**Import from JSON:**
1. Click **Import JSON** button in the Custom Maps card
2. Select a JSON file from your computer
3. If a map with the same ID exists, you'll be warned
4. The imported map note is created in your maps folder

### Custom Image Maps

For fictional worlds or historical maps, you can use your own map images:

1. Create a map note with frontmatter:
   ```yaml
   ---
   cr_type: map
   map_id: westeros
   name: Westeros
   universe: got
   image: assets/maps/westeros.png
   bounds:
     north: 50
     south: -50
     west: -100
     east: 100
   ---
   ```

2. Create place notes with the matching universe and coordinates
3. In Map View, use the **Map** dropdown to switch to your custom map

**Coordinate Systems:**
- **Geographic** (default): Uses lat/lng coordinates
- **Pixel**: Uses pixel coordinates (`pixel_x`, `pixel_y`) - ideal for hand-drawn maps

## Place Notes

Place notes are structured markdown files with YAML frontmatter that describe locations. They support hierarchical relationships (city → state → country) and can be linked from person notes.

**Example Place Note:**

```yaml
---
cr_type: place
cr_id: place_abc123
name: "London"
aliases:
  - "City of London"
  - "Londinium"

# Classification
place_category: real  # real | historical | disputed | legendary | mythological | fictional
universe: null        # for fictional/mythological places

# Hierarchy
parent_place: "[[England]]"
place_type: city

# Coordinates (for real/historical places)
coordinates:
  lat: 51.5074
  long: -0.1278

# Historical names
historical_names:
  - name: "Londinium"
    period: "Roman"
---

# London

Notes about this place...
```

### Place Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `real` | Verified real-world location | London, New York, Tokyo |
| `historical` | Real place that no longer exists | Babylon, Constantinople |
| `disputed` | Location debated by historians | Troy, King Solomon's Mines |
| `legendary` | May have historical basis but fictionalized | Camelot, El Dorado |
| `mythological` | Place from mythology/religion | Asgard, Mount Olympus |
| `fictional` | Invented for a story/world | Winterfell, Mordor |

### Creating Place Notes

**Option 1: Control Center**
1. Open Control Center → **Places** tab
2. Click **Create place note**
3. Fill in the place details:
   - Name and aliases
   - Category (real, historical, fictional, etc.)
   - Place type (city, state, country, etc.)
   - Parent place (searchable dropdown)
   - Coordinates (for real places)
4. Click **Create**

**Option 2: Quick-Create from Person Note**
1. Right-click on a person note
2. Select **Create place notes...**
3. Review unlinked place references (from birth_place, death_place, etc.)
4. Click **Create** for each place you want to add
5. Optionally enable auto-linking to convert text to wikilinks

**Option 3: Bulk Create Missing Places**
1. Open Control Center → **Places** tab → **Statistics**
2. Click **Create missing place notes**
3. Review places referenced in person notes but not yet created
4. Create them individually or in batch

### Linking Places to People

Reference places in person notes using wikilinks or plain text:

```yaml
---
# Wikilink format (recommended - creates graph connections)
birth_place: "[[London]]"
death_place: "[[New York City]]"
burial_place: "[[Westminster Abbey]]"

# Plain text format (backwards compatible)
birth_place: "London, England"
---
```

## Life Events Array

Beyond core life events (birth, death, marriage, burial), you can track additional life events using the `events` array in person frontmatter. These events appear as color-coded markers in the Map View.

### Supported Event Types

| Event Type | Color | Use For |
|------------|-------|---------|
| `residence` | Blue | Places lived (homes, apartments) |
| `occupation` | Orange | Work locations (offices, factories) |
| `education` | Teal | Schools, universities, training |
| `military` | Brown | Military service locations |
| `immigration` | Cyan | Border crossings, ports of entry |
| `baptism` | Light Purple | Baptism locations |
| `confirmation` | Light Purple | Confirmation ceremonies |
| `ordination` | Light Purple | Religious ordinations |
| `custom` | Pink | Any other life event |

### Example Events Array

```yaml
---
birth_place: "[[Boston]]"
death_place: "[[Miami]]"

events:
  - event_type: residence
    place: "[[New York]]"
    date_from: "1920"
    date_to: "1935"
    description: "Family home on 5th Ave"
  - event_type: occupation
    place: "[[Chicago]]"
    date_from: "1935"
    date_to: "1942"
    description: "Steel mill foreman"
  - event_type: military
    place: "[[Normandy]]"
    date_from: "1944-06-06"
    date_to: "1944-08-25"
    description: "D-Day invasion"
  - event_type: education
    place: "[[Harvard University]]"
    date_from: "1915"
    date_to: "1919"
    description: "BA in History"
---
```

### Event Properties

| Property | Required | Description |
|----------|----------|-------------|
| `event_type` | Yes | One of the types listed above |
| `place` | Yes | Wikilink to a place note |
| `date_from` | No | Start date (YYYY, YYYY-MM, or YYYY-MM-DD) |
| `date_to` | No | End date (for duration events) |
| `description` | No | Brief description of the event |

## Journey Paths (Route Visualization)

Journey paths show a person's complete movement through life by connecting all their events in chronological order.

**How it works:**
- Birth location is always first
- Life events are sorted by date (year)
- Death and burial locations come last
- Consecutive duplicate locations are filtered out

**Visual style:**
- Dashed violet lines (distinct from solid indigo migration paths)
- Arrow decorations showing direction of movement
- Person name labels along the path
- Click the path to see all waypoints in a popup

**To enable:**
1. Open Map View
2. Click **Layers** in the toolbar
3. Check "Journey paths (all events)"

**Use cases:**
- Track immigration routes with multiple stops
- Visualize military service across locations
- Show career progression through cities
- Map pilgrimage or travel routes

## Place Statistics

The Places tab in Control Center shows aggregate statistics:

**Overview Metrics:**
- Total places in vault
- Percentage with coordinates
- Orphan places (no parent defined)
- Maximum hierarchy depth

**Category Breakdown:**
- Count of places per category
- Number of associated people per category

**Most Common Locations:**
- Top birth places
- Top death places
- Migration patterns (birth → death flows)

**Actions:**
- Create missing place notes
- Build hierarchy (assign parents to orphan places)
- Standardize place names (find and unify variations)
- View place index (alphabetical with person counts)

## Place Visualizations

Canvas Roots provides D3-based visualizations for place data:

**Network/Schematic View:**
- Places shown as nodes sized by associated person count
- Color coding by category, place type, or hierarchy depth
- Tree and radial layout options
- Interactive tooltips with place details
- Toggle migration flows as directed edges

**Migration Flow Diagram:**
- Arc diagram showing movement patterns between places
- Filter by minimum flow count
- Color-coded nodes (green=birth origin, red=death destination)
- Filter by time period (year range with century presets)
- Filter by collection (family branch)
- Aggregate by hierarchy level (e.g., group by country)

## Place-Based Tree Filtering

Filter tree generation by geographic data:

1. Open Control Center → **Tree Output** tab
2. Configure your tree settings
3. In the **Place filter** section:
   - Enable filtering by birth place, death place, marriage location, or burial place
   - Enter a place name to match
4. Generate tree with only people matching the place criteria

## Geocoding Lookup

For real, historical, or disputed places, look up coordinates automatically:

1. Create or edit a place note
2. Click **Look up coordinates** button
3. Canvas Roots queries Nominatim (OpenStreetMap geocoding)
4. Review and accept the suggested coordinates
5. Parent place is included in the query for better accuracy

**Note:** Geocoding is rate-limited. For bulk lookups, space requests appropriately.

## Custom Place Types

Beyond the built-in types (city, state, country, etc.), you can use custom types:

1. In the place type dropdown, select **Other...**
2. Enter your custom type (e.g., "galaxy", "star-system", "dimension")
3. Custom types are normalized to lowercase with hyphens
4. They appear in statistics alongside standard types

## Map Image Alignment (Edit Mode)

Custom map images often need adjustment to align properly with your coordinate system. The Map Image Alignment feature lets you interactively position, scale, rotate, and distort your map image to match geographic coordinates.

### When to Use Map Alignment

- **Historical maps**: Old maps may have different projections or orientations than modern coordinates
- **Fantasy/fictional maps**: Hand-drawn maps rarely align perfectly with a coordinate grid
- **Scanned images**: Scanning can introduce skew or distortion
- **Composite images**: Maps assembled from multiple sources may need adjustment

### Entering Edit Mode

1. Open the **Map View** (from ribbon icon or right-click a map note)
2. Select your custom map from the dropdown (not OpenStreetMap)
3. Click the **Edit** button in the toolbar
4. The edit banner appears with alignment controls

### Using the Corner Handles

When edit mode is active, four corner handles appear around your map image:

- **Drag any corner** to reposition that corner independently
- **Drag opposite corners** in opposite directions to scale the image
- **Drag adjacent corners** to rotate or skew the image
- The image updates in real-time as you drag

**Tip:** Start with small adjustments. It's easier to fine-tune alignment incrementally than to fix large distortions.

### Edit Banner Controls

| Button | Function |
|--------|----------|
| **Save alignment** | Save current corner positions to the map note's frontmatter |
| **Undo changes** | Revert to the last saved position (discards unsaved edits) |
| **Reset to default** | Clear all saved alignment and return to default rectangular bounds |
| **Cancel** | Exit edit mode without saving |

### How Alignment is Stored

Corner positions are saved as flat properties in your map note's frontmatter:

```yaml
---
cr_type: map
map_id: middle-earth
name: Middle-earth
image: assets/maps/middle-earth.jpg
bounds:
  north: 50
  south: -50
  west: -100
  east: 100
# Saved alignment corners
corner_nw_lat: 48.5
corner_nw_lng: -95.2
corner_ne_lat: 49.1
corner_ne_lng: -58.3
corner_sw_lat: -45.8
corner_sw_lng: -98.1
corner_se_lat: -44.2
corner_se_lng: -55.7
---
```

When corner properties are present, the map loads with that alignment. When they're absent, the map displays with default rectangular bounds.

### Best Practices

**Before aligning:**
- Identify reference points on your map (cities, coastlines, rivers)
- Know the approximate coordinates these points should have
- Consider the map's projection (most hand-drawn maps assume flat projection)

**During alignment:**
- Start with rough positioning of one corner
- Work around the map adjusting each corner
- Use known reference points to verify alignment
- Save frequently as you refine

**After alignment:**
- Test by adding place markers and verifying their positions
- Consider exporting the aligned map configuration for backup
- Document your reference points in the map note for future reference

### Limitations

- Alignment is saved per map note, not per image file
- Very large distortions may cause visual artifacts
- The underlying coordinate system remains unchanged; only the image position changes
- Alignment affects the Map View display only, not canvas generation

## Using Obsidian Maps Alongside Canvas Roots

[Obsidian Maps](https://github.com/obsidianmd/obsidian-maps) is an official community plugin that adds a Map view to Obsidian Bases. While Canvas Roots provides genealogy-focused map visualization, Obsidian Maps offers complementary features for general place browsing.

### When to Use Each

| Use Case | Recommended Tool |
|----------|------------------|
| Visualizing migration paths (birth → death) | Canvas Roots Map View |
| Journey paths through all life events | Canvas Roots Map View |
| Heat map of family concentrations | Canvas Roots Map View |
| Time slider ("who was alive when?") | Canvas Roots Map View |
| Marker clustering for large datasets | Canvas Roots Map View |
| Custom fictional/historical image maps | Canvas Roots Map View |
| Simple "show places on a map" from a Base query | Obsidian Maps |
| Embedded map view within a markdown note | Obsidian Maps |
| Custom marker icons per place (Lucide icons) | Obsidian Maps |
| Custom marker colors per place | Obsidian Maps |

### Using Both Plugins Together

Canvas Roots and Obsidian Maps work well together. Your place notes already include `coordinates` properties that Obsidian Maps can use:

1. **Install Obsidian Maps** from Community Plugins (requires Obsidian 1.10+)
2. **Create a Places Base** using the Canvas Roots template (Guide tab → Base templates → Places)
3. **Add a Map view** to your Base:
   - In the Base, click the view dropdown → Map
   - Set "Marker coordinates" to `coordinates`
   - Optionally set "Marker icon" to `icon` and "Marker color" to `color` if you've added those properties

This gives you a simple map view of your places within Bases, while Canvas Roots' Map View remains available for genealogy-specific analysis like migration paths and time-based filtering.

### Feature Comparison

| Feature | Canvas Roots | Obsidian Maps |
|---------|--------------|---------------|
| Map library | Leaflet 1.9.4 | MapLibre GL 5.8 |
| Tile format | Raster (XYZ) | Vector + Raster |
| Marker clustering | ✓ | — |
| Migration/journey paths | ✓ | — |
| Heat map layer | ✓ | — |
| Time slider animation | ✓ | — |
| Custom image maps | ✓ | — |
| Bases integration | — | ✓ |
| Embedded in notes | — | ✓ |
| Per-marker icons/colors | By event type | Per-note property |
| Formula-based properties | — | ✓ |

### Coordinated Workflows

**Scenario: Researching a specific branch**
1. Create a Base filtered to a collection (e.g., "Smith Family")
2. Use Obsidian Maps' Map view for quick place browsing
3. Switch to Canvas Roots Map View for migration path analysis

**Scenario: Place note research**
1. Browse places in an Obsidian Maps view
2. Click a marker to open the place note
3. Use Canvas Roots' "Open in Map View" context menu for full analysis

## Settings

Configure place features in Settings → Canvas Roots:

**Places Folder:**
- Default destination for new place notes
- Configurable via settings or folder context menu

**Default Place Category:**
- Global default category for new places
- Can be overridden by folder or collection rules

**Place Category Rules:**
- Define automatic category assignment based on folder path or collection
- Example: Places in "Places/Historical" default to `historical` category
