# Geographic Features

Charted Roots provides comprehensive place-based features for tracking where people were born, died, married, and lived. These features support both real-world genealogy and world-building with fictional places.

---

## Table of Contents

- [Interactive Map View](#interactive-map-view)
- [Maps Tab (Control Center)](#maps-tab-control-center)
- [Place Notes](#place-notes)
- [Life Events Array](#life-events-array)
- [Journey Paths (Route Visualization)](#journey-paths-route-visualization)
- [Place Statistics](#place-statistics)
- [Data Quality Card](#data-quality-card)
- [Place Visualizations](#place-visualizations)
- [Merge Duplicate Places](#merge-duplicate-places)
- [Place-Based Tree Filtering](#place-based-tree-filtering)
- [Geocoding Lookup](#geocoding-lookup)
- [Custom Place Types](#custom-place-types)
- [Using Obsidian Maps Alongside Charted Roots](#using-obsidian-maps-alongside-canvas-roots)
- [Settings](#settings)
  - [Category-Based Organization](#category-based-organization)

---

## Interactive Map View

The Map View provides a Leaflet.js-powered interactive map for visualizing where your family members lived, traveled, and died.

### Opening Map View

**Option 1: Maps Tab (Control Center)**
1. Open Control Center → **Maps** tab
2. Click **Open Map View** in the first card

**Option 2: Command Palette**
1. Open Command Palette (Ctrl/Cmd + P)
2. Search for "Charted Roots: Open Map View"

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

The Map View toolbar uses compact icon-only buttons with tooltips. Hover over any button to see its function.

| Icon | Function |
|------|----------|
| **Layers** | Toggle marker types, paths, heat map, journey paths |
| **Filter** | Filter by collection, year range |
| **Clock** | Open time slider for "who was alive when?" animation |
| **Map** | Switch between OpenStreetMap and custom image maps |
| **Columns** | Open side-by-side map comparison (split view) |
| **Download** | Export as GeoJSON or SVG overlay |
| **Pencil** | Enter edit mode for custom map alignment (custom maps only) |
| **Refresh** | Reload data from vault |

### Place Marker Interactions

Place markers on custom maps support direct manipulation:

**Dragging Markers:**
- Click and hold any place marker to drag it to a new position
- Release to drop the marker; the new coordinates are saved automatically to the place note
- Works with both geographic and pixel coordinate systems

**Right-Click Context Menu:**
- Right-click any place marker to access quick actions:
  - **Open place note**: Navigate to the place's markdown note
  - **Edit place**: Open the Edit Place modal to modify properties
  - **Remove from map**: Remove the marker (clears coordinates from the place note)

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

1. Open Control Center (click the Charted Roots icon in the ribbon or use Command Palette)
2. Click the **Maps** tab in the sidebar

### Tab Contents

The Maps tab contains four cards:

| Card | Description |
|------|-------------|
| **Open Map View** | Quick access button to launch the Map View, with coordinate coverage stats |
| **Custom Maps** | Thumbnail gallery of all custom map images with management actions |
| **Visualizations** | Migration diagrams and place network visualization tools |
| **Map Statistics** | Coordinate coverage percentage, custom map count, and universe list |

### Custom Maps

The Custom Maps gallery displays thumbnail previews of all map notes in your vault. Click any thumbnail to open it in Map View, or hover to reveal edit and menu options.

For complete documentation on creating, editing, and aligning custom maps, see **[Custom Maps](Custom-Maps)**.

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

## Data Quality Card

The Data Quality card in the Places tab provides a unified view of place data issues with inline actions to fix them. It combines issue detection with resolution tools in a single, scannable interface.

### Summary Bar

At the top of the card, a summary bar shows at-a-glance counts for each issue type:
- **Orphan**: Places without a parent place defined
- **Missing**: Place names referenced in person notes that don't have corresponding place notes
- **Duplicate**: Place names that appear multiple times (potential duplicates)
- **Other**: Additional issues (circular hierarchy, fictional places with coordinates, etc.)

### Issue Sections

Each issue type appears in its own collapsible section. Sections show a count badge and can be expanded or collapsed by clicking the header.

**Default behavior:**
- The first two sections are expanded by default (progressive disclosure)
- Sections with zero issues are hidden

**Issue types detected:**
| Issue Type | Description | Action |
|------------|-------------|--------|
| Orphan places | Places without `parent_place` defined | Edit button to set parent |
| Missing place notes | Places referenced in person notes but no place note exists | Create button to create note |
| Duplicate names | Multiple place notes with the same name | Review button, batch link to merge modal |
| Circular hierarchy | Place A → B → A (invalid parent chain) | Edit button to fix |
| Fictional with coords | Fictional/mythological places with real-world coordinates | Review button |
| Real missing coords | Real places without coordinates defined | Edit button to add coords |
| Places in wrong folder | Places not stored in their category-appropriate subfolder | Organize places button (see [Category-Based Organization](#category-based-organization)) |

### Inline Actions

Each issue item shows:
- **Place name**: The name of the affected place
- **Detail text**: Context about the issue (e.g., "no parent", "referenced by 5 people")
- **Action button**: A contextual action like "Create", "Edit", "Set parent", or "Review"

Clicking the action button opens the appropriate modal or navigates to the place for editing.

### Batch Actions

For issue types that support bulk operations, a batch action link appears below the issue list:
- **"Find all duplicates →"**: Opens the Merge Duplicate Places modal
- **"Create all missing →"**: Opens the Create Missing Places modal (when available)

### Other Tools

Below the issue sections, an "Other tools" section provides access to actions that aren't issue-driven:
- **Geocode lookup**: Look up coordinates for real places via OpenStreetMap
- **Standardize place names**: Normalize place name formatting across notes
- **Merge duplicate places**: Open the full duplicate detection and merge modal

### Best Practices

**Recommended workflow:**
1. Review the summary bar to understand the scope of issues
2. Address high-impact issues first (missing places with many references)
3. Use batch actions for bulk operations
4. Use inline actions for individual fixes
5. Re-check after fixes to catch any new issues

## Place Visualizations

Charted Roots provides D3-based visualizations for place data:

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

## Merge Duplicate Places

When importing GEDCOM files or building place notes manually, you may end up with multiple notes representing the same location. The "Merge duplicate places" feature helps identify and consolidate these duplicates.

### Opening the Merge Modal

1. Open Control Center → **Places** tab
2. In the **Actions** section, click **Merge duplicate places**
3. The modal scans your vault for potential duplicates

### How Duplicates Are Detected

The duplicate detection algorithm uses multiple passes to identify potential duplicates:

**Pass 1-3: Name Matching**
- **Exact name match** (case-insensitive)
- **Similar name match** (fuzzy matching for typos)
- **Same parent + same name** (places with identical names under the same parent)

**Pass 4: Same Parent + Shared Base Name**
Places under the same parent that share a base name (first word) are grouped. This catches GEDCOM import fragments like "Abbeville" and "Abbeville County" under "South Carolina".

- Administrative divisions (County, Parish, Township, etc.) are grouped separately from settlements
- Prevents incorrect grouping of "Abbeville County" with "Abbeville" (the city) — they're different entities

**Pass 5: State Abbreviation Variants**
Detects places that differ only in US state name format:
- "Abbeville SC" ↔ "Abbeville South Carolina"
- Checks both frontmatter title and filename for state components
- Supports various filename formats: spaces, kebab-case (`abbeville-south-carolina`), and snake_case (`abbeville_south_carolina`)

**Example duplicates detected:**
- "Birmingham, Alabama" and "Birmingham, Alabama" (different `cr_id` values)
- "Hartford, Hartford County" (two notes with same parent name)
- "Abbeville SC" and "Abbeville South Carolina" (state abbreviation variant)

**Not grouped together:**
- "Hartford, Hartford County, Connecticut" vs "Hartford, Oxfordshire, England" (different parents)
- "Washington, Wilkes County" vs "Washington, D.C." (different parents)
- "Abbeville County" vs "Abbeville" (administrative division vs settlement)

### Sorting and Filtering

The controls bar at the top of the modal lets you manage large lists of duplicates:

**Sort options:**
- **Most duplicates** (default): Groups with the most duplicate notes first
- **Fewest duplicates**: Groups with only 2 notes first
- **Name (A-Z)**: Alphabetical by place name
- **Name (Z-A)**: Reverse alphabetical

**Filter options:**
- **All groups**: Show all detected duplicate groups
- **Pending only**: Hide groups that have already been merged
- **Has note content**: Only show groups where at least one note has body text
- **Has coordinates**: Only show groups where at least one note has coordinates

The status display shows how many groups are currently visible (e.g., "Showing 12 of 45 groups").

### Understanding the Interface

Each duplicate group shows:

| Element | Description |
|---------|-------------|
| **Suggested badge** | The recommended canonical place based on completeness score |
| **Full name** | The `full_name` property from GEDCOM import (shown in italics) |
| **Character count** | Body content length (e.g., "1.2k chars", "500 chars") |
| **Custom props** | Badge shown if the note has non-standard frontmatter properties |
| **Open button** | Click to open note; right-click for open options |
| **Select as canonical** | Choose which note should be the primary place |

### Suggested Canonical Scoring

The "Suggested" badge indicates which place note has the most complete data. The scoring algorithm considers:

| Criterion | Points |
|-----------|--------|
| Has parent place defined | +100 |
| Has coordinates | +50 |
| Has place type specified | +25 |
| Has universe assigned | +10 |
| References from person notes | +5 per reference |
| Shorter file path (less nested) | -1 per path segment |

Higher scores indicate more complete and better-connected place notes.

### Merging Process

1. **Review each group**: Examine the places in each duplicate group
2. **Open notes if needed**: Click the open button to view note contents
   - Left-click: Open in new tab
   - Right-click: Choose "Open to the right" or "Open in new window"
3. **Select canonical**: Click "Select as canonical" on the note you want to keep
4. **Rename if needed**: Click the edit icon next to "Final filename" to change the filename
   - Useful for removing "-2" suffixes from auto-generated duplicate names
   - The file will be renamed after the merge completes
5. **Repeat for each group**
6. **Click Merge**: The merge operation will:
   - Update all references in person notes to point to the canonical place
   - Re-parent any child places to point to the canonical
   - Rename the canonical file (if a new filename was specified)
   - Move duplicate notes to trash

### Best Practices

**Before merging:**
- Review the `full_name` property to understand each place's context
- Check character counts to identify notes with substantial content
- Open notes with "custom props" to review what data might be lost
- Use "Open to the right" to compare two places side-by-side

**When selecting canonical:**
- Prefer notes with coordinates defined
- Prefer notes with proper hierarchy (parent_place set)
- Prefer notes with more content (higher character count)
- Consider which note has more references from person notes

**After merging:**
- Run the merge process again to catch any newly-detectable duplicates
- Use "Build hierarchy" to establish parent-child relationships
- Review the Places tab statistics for orphan places

### Limitations

- Only detects duplicates within the same parent context
- Does not automatically merge note content (preserves canonical only)
- Cannot undo merges (consider backing up before bulk merges)
- Places must have `cr_type: place` in frontmatter to be detected

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
3. Charted Roots queries Nominatim (OpenStreetMap geocoding)
4. Review and accept the suggested coordinates
5. Parent place is included in the query for better accuracy

**Note:** Geocoding is rate-limited. For bulk lookups, space requests appropriately.

## Custom Place Types

Beyond the built-in types (city, state, country, etc.), you can use custom types:

1. In the place type dropdown, select **Other...**
2. Enter your custom type (e.g., "galaxy", "star-system", "dimension")
3. Custom types are normalized to lowercase with hyphens
4. They appear in statistics alongside standard types

## Using Obsidian Maps Alongside Charted Roots

[Obsidian Maps](https://github.com/obsidianmd/obsidian-maps) is an official community plugin that adds a Map view to Obsidian Bases. While Charted Roots provides genealogy-focused map visualization, Obsidian Maps offers complementary features for general place browsing.

### When to Use Each

| Use Case | Recommended Tool |
|----------|------------------|
| Visualizing migration paths (birth → death) | Charted Roots Map View |
| Journey paths through all life events | Charted Roots Map View |
| Heat map of family concentrations | Charted Roots Map View |
| Time slider ("who was alive when?") | Charted Roots Map View |
| Marker clustering for large datasets | Charted Roots Map View |
| Custom fictional/historical image maps | Charted Roots Map View |
| Simple "show places on a map" from a Base query | Obsidian Maps |
| Embedded map view within a markdown note | Obsidian Maps |
| Custom marker icons per place (Lucide icons) | Obsidian Maps |
| Custom marker colors per place | Obsidian Maps |

### Using Both Plugins Together

Charted Roots and Obsidian Maps work well together. Your place notes already include `coordinates` properties that Obsidian Maps can use:

1. **Install Obsidian Maps** from Community Plugins (requires Obsidian 1.10+)
2. **Create a Places Base** using the Charted Roots template (Guide tab → Base templates → Places)
3. **Add a Map view** to your Base:
   - In the Base, click the view dropdown → Map
   - Set "Marker coordinates" to `coordinates`
   - Optionally set "Marker icon" to `icon` and "Marker color" to `color` if you've added those properties

This gives you a simple map view of your places within Bases, while Charted Roots' Map View remains available for genealogy-specific analysis like migration paths and time-based filtering.

### Feature Comparison

| Feature | Charted Roots | Obsidian Maps |
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
3. Switch to Charted Roots Map View for migration path analysis

**Scenario: Place note research**
1. Browse places in an Obsidian Maps view
2. Click a marker to open the place note
3. Use Charted Roots' "Open in Map View" context menu for full analysis

## Settings

Configure place features in Settings → Charted Roots:

**Places Folder:**
- Default destination for new place notes
- Configurable via settings or folder context menu

**Default Place Category:**
- Global default category for new places
- Can be overridden by folder or collection rules

**Place Category Rules:**
- Define automatic category assignment based on folder path or collection
- Example: Places in "Places/Historical" default to `historical` category

### Category-Based Organization

*Added in v0.19.3*

When enabled, places are automatically stored in category-specific subfolders based on their `place_category`:

```
Places/
  Real/         (place_category: real)
  Historical/   (place_category: historical)
  Disputed/     (place_category: disputed)
  Legendary/    (place_category: legendary)
  Mythological/ (place_category: mythological)
  Fictional/    (place_category: fictional)
```

**Enabling Category Subfolders:**

1. Open **Settings → Charted Roots → Places**
2. Scroll to the **Category organization** section
3. Enable **Use category-based subfolders**

**How It Works:**

| Action | Behavior |
|--------|----------|
| **Create new place** | Automatically stored in category subfolder (e.g., `Places/Historical/`) |
| **Edit existing place** | If category changes, you're prompted to move the file |
| **Import (GEDCOM/Gramps)** | Places go to base folder; use Data Quality to organize afterward |

**Custom Folder Rules:**

Override automatic folder names for specific categories:

1. In the Place organization section, click **Add override**
2. Select a category (e.g., Historical)
3. Enter a custom subfolder path (e.g., `Ancient/Historical` or `Fantasy/Legendary`)

Custom rules take precedence over automatic naming.

**Organizing Existing Places:**

If you enable category subfolders after creating place notes:

1. Open Control Center → Places tab
2. In Data Quality, look for "N places in wrong folder"
3. Click **Organize places** to open the bulk migration modal
4. Select places to move and click **Move**

The organize modal shows:
- Place name and category
- Current folder location
- Target folder based on category

**Default Behavior:**

- **New vaults**: Category subfolders are enabled by default
- **Existing vaults**: Disabled by default to avoid disrupting existing organization
- Places with the default category (usually `real`) stay in the base folder unless a rule is defined
