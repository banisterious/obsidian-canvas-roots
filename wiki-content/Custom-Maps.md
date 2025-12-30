# Custom Maps

Canvas Roots allows you to create custom map images for fictional worlds, historical maps, or any other specialized geographic visualization. This page covers the complete workflow from creation to alignment.

---

## Table of Contents

- [Overview](#overview)
- [Creating a Custom Map](#creating-a-custom-map)
  - [Map Creation Wizard](#map-creation-wizard)
  - [From the Control Center](#from-the-control-center)
  - [From JSON Import](#from-json-import)
- [Editing Map Properties](#editing-map-properties)
- [Aligning a Map Image](#aligning-a-map-image)
- [Using Your Custom Map](#using-your-custom-map)
- [Working with Place Markers](#working-with-place-markers)
- [Map Actions](#map-actions)
- [Coordinate Systems](#coordinate-systems)
  - [Adding Places to Pixel-Based Maps](#adding-places-to-pixel-based-maps)
- [Frontmatter Reference](#frontmatter-reference)

---

## Overview

Custom maps let you visualize people and places on your own map images rather than OpenStreetMap. Common use cases include:

- **Fictional worlds**: Westeros, Middle-earth, your own fantasy setting
- **Historical maps**: Period-accurate maps showing boundaries as they were
- **Regional focus**: Detailed local maps for specific research areas
- **Thematic maps**: Migration routes, land ownership, parish boundaries

Each custom map is stored as a note with `cr_type: map` frontmatter, containing the map configuration and a reference to the image file.

---

## Creating a Custom Map

### Map Creation Wizard

The Map Creation Wizard provides a guided 4-step workflow for creating custom maps with interactive place marker placement.

1. Open **Control Center** → **Maps** tab
2. Click **Create Custom Map** button
3. Follow the wizard steps:

**Step 1: Select Image**
- Browse your vault for a map image (PNG, JPG, WebP, etc.)
- A preview of the selected image is shown

**Step 2: Configure Map**
- Enter a map name
- Select or create a universe (optional, for grouping related maps)
- Choose coordinate system (Geographic or Pixel)
- Set bounds/dimensions for the coordinate space

**Step 3: Place Markers**
- Click on the map image to add place markers
- Each click opens the Create Place modal to define the place
- Markers appear with the place name; drag to reposition
- Right-click markers to edit or remove them
- This step is optional — you can add places later

**Step 4: Review & Create**
- Review your configuration summary
- See a list of places that will be created
- Click **Create Map** to finalize

The wizard creates the map note and any place notes you added, then optionally opens the map in Map View.

**Resuming a Wizard Session:**
If you close the wizard before completing, your progress is saved. When you reopen the wizard, you'll be prompted to resume where you left off or start fresh.

### From the Control Center

For a simpler creation flow without the wizard:

1. Open **Control Center** → **Maps** tab
2. In the **Custom Maps** card, click the overflow menu (⋮) → **Create map (simple)**
3. Fill in the map details:

| Field | Required | Description |
|-------|----------|-------------|
| **Map name** | Yes | Display name (e.g., "Middle-earth", "Colonial Virginia") |
| **Map image** | Yes | Click "Browse" to select an image from your vault. Stored as a wikilink so Obsidian auto-updates the path if you move the image. |
| **Universe** | No | Group related maps (e.g., "tolkien", "got", "colonial-america") |
| **Coordinate system** | Yes | Geographic (lat/lng) or Pixel — see [Coordinate Systems](#coordinate-systems) |
| **Bounds/Dimensions** | Yes | Define the coordinate space for your map |

4. Click **Create**

The map note is created in your configured map notes folder (Control Center → Preferences → Folder locations → Map notes folder).

### From JSON Import

If you have a map configuration exported from another vault:

1. In the **Custom Maps** card, click **Import JSON**
2. Select a JSON file from your computer
3. If a map with the same ID already exists, you'll be warned
4. The imported map note is created in your map notes folder

---

## Editing Map Properties

To modify an existing custom map:

1. In the **Maps** tab, hover over the map thumbnail
2. Click the **Edit** button (pencil icon)
3. Modify any properties:
   - Change the name, image, or universe
   - Adjust coordinate bounds or dimensions
   - Switch coordinate systems
4. Click **Save changes**

You can also edit the map note directly in the editor — the frontmatter follows the format described in [Frontmatter Reference](#frontmatter-reference).

---

## Aligning a Map Image

Historical and hand-drawn maps often need adjustment to align properly with your coordinate system. The alignment feature lets you interactively position, scale, rotate, and distort your map image.

### When You Need Alignment

- **Historical maps**: Old maps have different projections or orientations
- **Fantasy maps**: Hand-drawn maps rarely align with a coordinate grid
- **Scanned images**: Scanning can introduce skew or distortion
- **Composite images**: Maps assembled from multiple sources

### Entering Edit Mode

1. Open **Map View** (from the Maps tab or Command Palette)
2. Select your custom map from the **Map** dropdown (not OpenStreetMap)
3. Click the **Edit** button in the toolbar
4. The edit banner appears with alignment controls

### Using Corner Handles

When edit mode is active, four corner handles appear around your map image:

- **Drag any corner** to reposition that corner independently
- **Drag opposite corners** apart to scale the image
- **Drag adjacent corners** to rotate or skew the image
- The image updates in real-time as you drag

**Tip:** Start with small adjustments. It's easier to fine-tune incrementally than to fix large distortions.

### Edit Banner Controls

| Button | Function |
|--------|----------|
| **Save alignment** | Save corner positions to the map note's frontmatter |
| **Undo changes** | Revert to the last saved position (discards unsaved edits) |
| **Reset to default** | Clear all alignment and return to rectangular bounds |
| **Cancel** | Exit edit mode without saving |

### Alignment Workflow

1. **Identify reference points** on your map (cities, coastlines, rivers, landmarks)
2. **Know target coordinates** for those reference points
3. **Start with rough positioning** of one corner
4. **Work around the map** adjusting each corner
5. **Verify with markers** — add a test place and check its position
6. **Save frequently** as you refine the alignment

### How Alignment is Stored

Corner positions are saved as flat properties in your map note's frontmatter:

```yaml
---
cr_type: map
map_id: middle-earth
name: Middle-earth
image: "[[assets/maps/middle-earth.jpg]]"
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

When corner properties are present, the map loads with that alignment. When absent, the map displays with default rectangular bounds.

---

## Using Your Custom Map

Once created, your custom map is available in several places:

### Map View Dropdown

1. Open **Map View** (ribbon icon, Command Palette, or Maps tab)
2. Click the **Map** button in the toolbar
3. Select your custom map from the dropdown
4. All places with matching coordinates (or matching `universe`) appear on the map

### Maps Tab Gallery

- Click any map thumbnail to open it directly in Map View
- Thumbnails show a preview of the map image with the name overlay

### Split View Comparison

1. In Map View, click **Split** in the toolbar
2. Choose horizontal or vertical split
3. Select different maps in each pane to compare:
   - Your custom map vs OpenStreetMap
   - Two different historical periods
   - Two fictional regions

### Filtering by Universe

Places automatically appear on maps when:

1. The place has coordinates within the map's bounds, OR
2. The place's `universe` property matches the map's `universe`

This lets you create separate coordinate spaces for each fictional world without conflicts.

---

## Working with Place Markers

Once your custom map is open in Map View, you can interact with place markers directly.

### Dragging Markers

Reposition any place marker by dragging:

1. Click and hold on a place marker
2. Drag to the new position
3. Release to drop — coordinates are saved automatically to the place note

This works with both geographic (lat/lng) and pixel coordinate systems. The place note's frontmatter is updated immediately.

### Right-Click Context Menu

Right-click any place marker to access quick actions:

| Action | Description |
|--------|-------------|
| **Open place note** | Navigate to the place's markdown note in the editor |
| **Edit place** | Open the Edit Place modal to modify name, category, parent, etc. |
| **Remove from map** | Clear the coordinates from the place note (marker disappears) |

### Adding New Places

To add a new place to an existing custom map:

**Option 1: Right-click on the map**
1. Right-click anywhere on the map image
2. Select **Create place here**
3. Fill in the Create Place modal — coordinates are pre-filled

**Option 2: Create from Control Center**
1. Open Control Center → Places → Create place note
2. Set the universe to match your map
3. Add coordinates manually (see [Adding Places to Pixel-Based Maps](#adding-places-to-pixel-based-maps))

---

## Map Actions

Right-click a map thumbnail (or click the three-dot menu button) to access:

| Action | Description |
|--------|-------------|
| **Open in Map View** | View the map with all your places and people |
| **Edit map** | Open the Edit Map modal to modify properties |
| **Duplicate map** | Create a copy with a unique ID (useful for variations) |
| **Export to JSON** | Download map configuration for backup or sharing |
| **Open note** | View the raw map note in the editor |
| **Delete map** | Remove the map note (with confirmation) |

---

## Coordinate Systems

Canvas Roots supports two coordinate systems for custom maps:

### Geographic (Default)

Uses standard latitude/longitude coordinates. Best for:

- Historical maps of real places
- Maps that should align with OpenStreetMap
- Places with known geographic coordinates

```yaml
coordinate_system: geographic
bounds:
  north: 50    # Top edge latitude
  south: -50   # Bottom edge latitude
  west: -100   # Left edge longitude
  east: 100    # Right edge longitude
```

### Pixel

Uses direct pixel coordinates with the origin at top-left. Best for:

- Hand-drawn fantasy maps
- Maps with arbitrary coordinate systems
- Images where geographic coordinates don't apply

```yaml
coordinate_system: pixel
image_width: 2048
image_height: 3072
center_x: 1024   # Optional: default center
center_y: 1536
```

### Adding Places to Pixel-Based Maps

When using pixel coordinates, places need `pixel_x` and `pixel_y` properties instead of geographic coordinates. Currently, the Create Place modal doesn't have fields for pixel coordinates, so you'll need to add them manually:

1. **Create the place note** using Control Center → Places → Create place note
   - Set the category to "Fictional" or "Mythological"
   - Set the universe to match your map's universe
2. **Open the place note** in the editor
3. **Add pixel coordinates** to the frontmatter:

```yaml
---
cr_type: place
name: Winterfell
place_category: fictional
universe: got
pixel_x: 450
pixel_y: 780
---
```

**Finding pixel coordinates:**

To determine the pixel coordinates for a location on your map image:

1. Open the map image in an image editor (or use your OS image viewer)
2. Hover over the desired location to see the pixel coordinates
3. Note the X (horizontal) and Y (vertical) values
4. The origin (0, 0) is at the top-left corner of the image

**Tip:** If your image editor shows coordinates from the bottom-left, subtract the Y value from the image height to convert to top-left origin.

---

## Frontmatter Reference

Complete map note frontmatter:

```yaml
---
cr_type: map
map_id: my-custom-map          # Unique identifier
name: My Custom Map            # Display name
universe: my-world             # Optional: group with places
image: "[[path/to/map-image.jpg]]"   # Wikilink to image (auto-updates if moved)

# Geographic coordinate system
coordinate_system: geographic
bounds:
  north: 50
  south: -50
  west: -100
  east: 100

# OR Pixel coordinate system
coordinate_system: pixel
image_width: 2048
image_height: 3072
center_x: 1024
center_y: 1536

# Optional: saved alignment corners
corner_nw_lat: 48.5
corner_nw_lng: -95.2
corner_ne_lat: 49.1
corner_ne_lng: -58.3
corner_sw_lat: -45.8
corner_sw_lng: -98.1
corner_se_lat: -44.2
corner_se_lng: -55.7
---

# My Custom Map

Optional notes about the map...
```

---

## See Also

- [Geographic Features](Geographic-Features) — Full map view documentation
- [Universe Notes](Universe-Notes) — Organizing fictional worlds
- [Fictional Date Systems](Fictional-Date-Systems) — Custom calendars for world-building
