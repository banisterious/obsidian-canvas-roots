# Custom Maps

Canvas Roots allows you to create custom map images for fictional worlds, historical maps, or any other specialized geographic visualization. This page covers the complete workflow from creation to alignment.

---

## Table of Contents

- [Overview](#overview)
- [Creating a Custom Map](#creating-a-custom-map)
- [Editing Map Properties](#editing-map-properties)
- [Aligning a Map Image](#aligning-a-map-image)
- [Using Your Custom Map](#using-your-custom-map)
- [Map Actions](#map-actions)
- [Coordinate Systems](#coordinate-systems)
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

### From the Control Center

1. Open **Control Center** → **Maps** tab
2. In the **Custom Maps** card, click **Create map**
3. Fill in the map details:

| Field | Required | Description |
|-------|----------|-------------|
| **Map name** | Yes | Display name (e.g., "Middle-earth", "Colonial Virginia") |
| **Map image** | Yes | Click "Browse" to select an image from your vault |
| **Universe** | No | Group related maps (e.g., "tolkien", "got", "colonial-america") |
| **Coordinate system** | Yes | Geographic (lat/lng) or Pixel — see [Coordinate Systems](#coordinate-systems) |
| **Bounds/Dimensions** | Yes | Define the coordinate space for your map |

4. Click **Create**

The map note is created in your configured maps folder (Control Center → Preferences → Folder locations → Maps folder).

### From JSON Import

If you have a map configuration exported from another vault:

1. In the **Custom Maps** card, click **Import JSON**
2. Select a JSON file from your computer
3. If a map with the same ID already exists, you'll be warned
4. The imported map note is created in your maps folder

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

When using pixel coordinates, places should have `pixel_x` and `pixel_y` properties instead of `coordinates`:

```yaml
# In place note
pixel_x: 450
pixel_y: 780
```

---

## Frontmatter Reference

Complete map note frontmatter:

```yaml
---
cr_type: map
map_id: my-custom-map          # Unique identifier
name: My Custom Map            # Display name
universe: my-world             # Optional: group with places
image: path/to/map-image.jpg   # Path to image in vault

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
