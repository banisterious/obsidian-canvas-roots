# Leaflet Maps Implementation Plan

> **Status:** Implementation Complete (v1 + v2)
> **Target Version:** v0.6.0
> **Branch:** feature/leaflet-maps

This document details the implementation plan for Phase 4 Geographic Features: interactive maps using Leaflet.js.

---

## Table of Contents

- [Overview](#overview)
- [Scope](#scope)
- [Architecture](#architecture)
- [Dependencies](#dependencies)
- [Implementation Phases](#implementation-phases)
- [Data Flow](#data-flow)
- [UI Components](#ui-components)
- [Settings](#settings)
- [Export Options](#export-options)
- [Testing Strategy](#testing-strategy)

---

## Overview

Add interactive map visualization to Canvas Roots, enabling users to:
- View birth/death locations as pins on real-world maps
- Visualize migration patterns with directional path lines
- See geographic clustering with heat maps
- Use custom image maps for fictional worlds

---

## Scope

### v1 (v0.6.0) - Core Map Features

| Feature | Description | Plugin/Approach | Status |
|---------|-------------|-----------------|--------|
| **Map View** | Dedicated leaf view (like Family Chart View) | Obsidian ItemView | ✅ Complete |
| **OpenStreetMap tiles** | Real-world base maps | Leaflet + OSM | ✅ Complete |
| **Pin markers** | Birth (green), death (red), other (blue) | Core Leaflet | ✅ Complete |
| **Marker clustering** | Collapse dense marker areas | Leaflet.markercluster | ✅ Complete |
| **Migration paths** | Lines connecting birth → death | Core Leaflet polylines | ✅ Complete |
| **Path text labels** | Person names along migration paths | Leaflet.TextPath | ✅ Complete |
| **Direction arrows** | Show migration direction on paths | Leaflet.PolylineDecorator | ✅ Complete |
| **Heat maps** | Geographic concentration visualization | Leaflet.heat | ✅ Complete |
| **Fullscreen mode** | Expand map to full screen | Leaflet.fullscreen | ✅ Complete |
| **Mini-map** | Overview inset for context | Leaflet.Control.MiniMap | ✅ Complete |
| **Custom image maps** | User-provided map images for fictional worlds | Leaflet L.imageOverlay | ✅ Complete |
| **Filtering** | By collection, time period, place category | Custom controls | ✅ Complete |
| **GeoJSON export** | Export markers/paths for GIS tools | Native JSON serialization | ✅ Complete |
| **SVG overlay export** | Export markers/paths as SVG for note embedding | Custom SVG generation | ✅ Complete |

### v2 (v0.6.0) - Advanced Features

| Feature | Description | Status |
|---------|-------------|--------|
| Time slider animation | Animate across generations | ✅ Complete |
| Image export | PNG/SVG of current map view | ⏸ Deferred (CORS challenges) |
| Search places on map | Find and zoom to places | ✅ Complete |
| Multiple map instances | Side-by-side comparison | ✅ Complete |

---

## Architecture

### File Structure

```
src/
├── maps/
│   ├── map-view.ts           # Obsidian ItemView implementation
│   ├── map-controller.ts     # Leaflet map initialization and control
│   ├── map-data-service.ts   # Data preparation from person/place notes
│   ├── map-layers.ts         # Layer management (markers, paths, heat)
│   ├── map-controls.ts       # Custom Leaflet controls (filters, legend)
│   ├── map-export.ts         # GeoJSON export functionality
│   └── image-map-manager.ts  # Custom image map handling
├── maps/types/
│   └── map-types.ts          # TypeScript interfaces for map data
```

### View Registration

```typescript
// In main.ts
this.registerView(
  MAP_VIEW_TYPE,
  (leaf) => new MapView(leaf, this)
);

// Command to open map view
this.addCommand({
  id: 'open-map-view',
  name: 'Open map view',
  callback: () => this.activateMapView()
});
```

### Layer Architecture

```
Map Container
├── Tile Layer (OpenStreetMap) OR Image Overlay (custom maps)
├── Heat Layer (toggle-able)
├── Cluster Layer
│   ├── Birth Markers (green)
│   ├── Death Markers (red)
│   └── Other Markers (blue)
├── Path Layer
│   └── Migration Polylines with arrow decorations
└── Controls
    ├── Zoom
    ├── Fullscreen
    ├── Mini-map
    ├── Layer Toggle
    ├── Filter Panel
    └── Legend
```

---

## Dependencies

### NPM Packages (bundled)

| Package | Version | Size | Purpose |
|---------|---------|------|---------|
| leaflet | ^1.9.4 | ~40KB | Core map library |
| leaflet.markercluster | ^1.5.3 | ~35KB | Marker clustering |
| leaflet-polylinedecorator | ^1.6.0 | ~8KB | Arrow decorations |
| leaflet.heat | ^0.2.0 | ~5KB | Heat map layer |
| leaflet.fullscreen | ^3.0.0 | ~3KB | Fullscreen control |
| leaflet-minimap | ^3.6.1 | ~8KB | Overview mini-map |

**Total additional bundle size:** ~99KB (gzipped: ~35KB)

### Type Definitions

```bash
npm install --save-dev @types/leaflet @types/leaflet.markercluster
```

Note: Some plugins may need manual type declarations in `src/maps/types/`.

### External Services

| Service | Purpose | Requirements |
|---------|---------|--------------|
| OpenStreetMap | Tile images | Attribution required, rate limits apply |

**Attribution (required):**
```
© OpenStreetMap contributors
```

---

## Implementation Phases

### Phase 4.1: Foundation (~2-3 sessions)

1. **Package setup**
   - Install Leaflet and plugins via npm
   - Configure esbuild to bundle Leaflet CSS
   - Add Leaflet CSS to styles.css or load dynamically

2. **MapView class**
   - Extend Obsidian's ItemView
   - Register view type in main.ts
   - Basic container setup with Leaflet initialization
   - Command palette entry to open view

3. **Basic map display**
   - OpenStreetMap tile layer
   - Zoom and pan controls
   - Attribution

4. **Data service**
   - Query person notes for coordinates (via linked place notes)
   - Build marker data structures
   - Handle missing/invalid coordinates gracefully

### Phase 4.2: Markers and Clustering (~2 sessions)

1. **Marker layer**
   - Birth markers (green) from birth_place coordinates
   - Death markers (red) from death_place coordinates
   - Custom marker icons with Canvas Roots styling

2. **Marker clustering**
   - Configure markercluster for each marker type
   - Cluster click to zoom behavior
   - Cluster styling (counts, colors)

3. **Marker popups**
   - Person name and dates
   - Click to open person note
   - Show place name and coordinates

### Phase 4.3: Migration Paths (~1-2 sessions)

1. **Path calculation**
   - Connect birth_place → death_place for each person
   - Filter out invalid paths (missing coordinates)
   - Aggregate duplicate paths (same origin/destination)

2. **Polyline rendering**
   - Curved paths (great circle or bezier)
   - Color coding options (by generation, collection)
   - Line weight based on count (optional)

3. **Arrow decorations**
   - Direction indicators using PolylineDecorator
   - Positioned at midpoint or destination

### Phase 4.4: Heat Maps and Controls (~1-2 sessions)

1. **Heat layer**
   - Birth location intensity
   - Death location intensity
   - Combined mode
   - Toggle in layer controls

2. **Filter panel**
   - Collection dropdown
   - Date range (year inputs)
   - Place category checkboxes
   - Apply/reset buttons

3. **Legend**
   - Marker type legend
   - Heat map gradient (when active)

### Phase 4.5: Custom Image Maps (~1-2 sessions)

1. **Image overlay support**
   - User selects image from vault
   - Define coordinate bounds (corners or center + scale)
   - Replace tile layer with image

2. **Universe/collection filtering**
   - Detect fictional places by category
   - Switch to appropriate custom map
   - Map selection dropdown

3. **Coordinate system**
   - Support custom_coordinates from place notes
   - Transform custom coords to image pixels

### Phase 4.6: Polish and Export (~1 session)

1. **Fullscreen mode**
   - Leaflet.fullscreen integration
   - Escape key handling

2. **Mini-map**
   - Overview inset in corner
   - Click to pan main map

3. **GeoJSON export**
   - Export current markers as GeoJSON FeatureCollection
   - Export paths as LineString features
   - Include person metadata in properties

4. **SVG overlay export**
   - Generate standalone SVG of markers and paths
   - Include legend and bounding box coordinates
   - Save to vault as `.svg` file for embedding in notes
   - Full image export available for custom image maps (no CORS)
   - For real-world maps: overlay only (no basemap tiles)

---

## Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Person Notes   │────▶│  MapDataService  │────▶│  MapController  │
│  (frontmatter)  │     │                  │     │                 │
└─────────────────┘     │  - Resolve place │     │  - Create       │
                        │    links         │     │    markers      │
┌─────────────────┐     │  - Get coords    │     │  - Draw paths   │
│  Place Notes    │────▶│  - Build marker  │     │  - Update heat  │
│  (coordinates)  │     │    data          │     │    layer        │
└─────────────────┘     │  - Calc paths    │     │                 │
                        └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │   Leaflet Map   │
                                                 │   (in ItemView) │
                                                 └─────────────────┘
```

### Marker Data Structure

```typescript
interface MapMarker {
  personId: string;        // cr_id of person
  personName: string;
  type: 'birth' | 'death' | 'marriage' | 'burial';
  lat: number;
  lng: number;
  placeName: string;
  placeId?: string;        // cr_id of place note
  date?: string;           // ISO date string
  collection?: string;
}

interface MigrationPath {
  personId: string;
  personName: string;
  origin: { lat: number; lng: number; name: string };
  destination: { lat: number; lng: number; name: string };
  birthYear?: number;
  deathYear?: number;
  collection?: string;
}
```

---

## UI Components

### Map View Layout

```
┌────────────────────────────────────────────────────────────┐
│ Map View                                            [×]    │
├────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐   │
│ │                                                      │   │
│ │                                                      │   │
│ │                    MAP AREA                          │   │
│ │                                                      │   │
│ │  [+]                                                 │   │
│ │  [-]                                    ┌─────────┐  │   │
│ │  [⛶]                                   │ MiniMap │  │   │
│ │                                         └─────────┘  │   │
│ │                                                      │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                            │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│ │ Layers ▾    │ │ Filters ▾   │ │ Export ▾            │   │
│ │ ☑ Births    │ │ Collection: │ │ • GeoJSON           │   │
│ │ ☑ Deaths    │ │ [All     ▾] │ │ • (Screenshot hint) │   │
│ │ ☑ Paths     │ │ Years:      │ └─────────────────────┘   │
│ │ ☐ Heat map  │ │ [1800]-[2000]                           │
│ └─────────────┘ └─────────────┘                           │
│                                                            │
│ Legend: 🟢 Birth  🔴 Death  ➡️ Migration                   │
│ © OpenStreetMap contributors                               │
└────────────────────────────────────────────────────────────┘
```

### Marker Popup

```
┌─────────────────────────┐
│ John Smith              │
│ Born: 1888-05-15        │
│ London, England         │
│                         │
│ [Open Note]             │
└─────────────────────────┘
```

---

## Settings

New settings for Map View (in plugin settings):

```typescript
// In settings.ts
interface MapSettings {
  // Tile provider
  tileProvider: 'openstreetmap' | 'custom';
  customTileUrl?: string;

  // Default view
  defaultCenter: { lat: number; lng: number };
  defaultZoom: number;

  // Markers
  birthMarkerColor: string;      // default: '#22c55e' (green)
  deathMarkerColor: string;      // default: '#ef4444' (red)
  otherMarkerColor: string;      // default: '#3b82f6' (blue)

  // Paths
  showMigrationPaths: boolean;   // default: true
  pathColor: string;             // default: '#6366f1' (indigo)
  pathWeight: number;            // default: 2

  // Heat map
  heatMapRadius: number;         // default: 25
  heatMapBlur: number;           // default: 15

  // Custom maps
  customMapsFolder: string;      // default: 'assets/maps'
}
```

---

## Export Options

### v1: GeoJSON Export

Export markers and paths as standard GeoJSON for use in external tools (Google Earth, QGIS, etc.):

### v1: SVG Overlay Export

Export markers and migration paths as a standalone SVG file for embedding in notes.

**Use cases:**
- Embed migration visualizations in family history narratives
- Share geographic patterns with family members
- Create portable documentation that works outside Obsidian

**What's included:**
- Marker circles (color-coded by type)
- Migration path lines with direction arrows
- Person name labels (optional, toggle-able)
- Legend showing marker types
- Bounding box with coordinate labels
- Title and timestamp

**What's NOT included (for real-world maps):**
- Basemap tiles (CORS restrictions)
- Users can layer the SVG over their own downloaded map image if needed

**Custom image maps:** Full export including the basemap image is possible since we control the source.

**Embedding in notes:**
```markdown
![[migration-map-2024-01-15.svg]]
```

**GeoJSON example:**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-0.1278, 51.5074]
      },
      "properties": {
        "personId": "abc-123",
        "personName": "John Smith",
        "markerType": "birth",
        "date": "1888-05-15",
        "placeName": "London, England"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-0.1278, 51.5074],
          [-74.006, 40.7128]
        ]
      },
      "properties": {
        "personId": "abc-123",
        "personName": "John Smith",
        "pathType": "migration",
        "origin": "London, England",
        "destination": "New York, USA"
      }
    }
  ]
}
```

**SVG export example:**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <title>Smith Family Migration (1850-1920)</title>

  <!-- Bounding box with coordinates -->
  <rect x="50" y="50" width="700" height="450" fill="none" stroke="#ccc"/>
  <text x="50" y="45" font-size="10">51.5°N, 0.1°W</text>
  <text x="700" y="515" font-size="10">40.7°N, 74.0°W</text>

  <!-- Migration path with arrow -->
  <path d="M 150,200 Q 400,100 650,350" stroke="#6366f1" stroke-width="2" fill="none"/>
  <polygon points="645,345 655,355 660,340" fill="#6366f1"/>

  <!-- Birth marker -->
  <circle cx="150" cy="200" r="8" fill="#22c55e"/>
  <text x="160" y="195" font-size="11">London</text>

  <!-- Death marker -->
  <circle cx="650" cy="350" r="8" fill="#ef4444"/>
  <text x="660" y="345" font-size="11">New York</text>

  <!-- Legend -->
  <g transform="translate(550, 480)">
    <circle cx="10" cy="10" r="6" fill="#22c55e"/><text x="22" y="14" font-size="10">Birth</text>
    <circle cx="80" cy="10" r="6" fill="#ef4444"/><text x="92" y="14" font-size="10">Death</text>
    <line x1="140" y1="10" x2="160" y2="10" stroke="#6366f1" stroke-width="2"/>
    <text x="165" y="14" font-size="10">Migration</text>
  </g>
</svg>
```

---

## Testing Strategy

### Manual Testing Checklist

- [ ] Map loads with OpenStreetMap tiles
- [ ] Markers appear at correct locations
- [ ] Markers cluster when zoomed out
- [ ] Cluster click zooms to show individual markers
- [ ] Marker popup shows person info
- [ ] "Open Note" link works in popup
- [ ] Migration paths connect birth → death
- [ ] Path arrows show correct direction
- [ ] Heat map toggles on/off
- [ ] Heat map reflects marker density
- [ ] Collection filter limits displayed data
- [ ] Year range filter works
- [ ] Fullscreen mode enters/exits cleanly
- [ ] Mini-map updates with main map
- [ ] GeoJSON export produces valid file
- [ ] SVG export saves to vault
- [ ] SVG embeds correctly in markdown notes
- [ ] SVG includes legend and coordinate labels
- [ ] Custom image map loads and displays
- [ ] Custom image map exports with basemap included
- [ ] Custom coordinates map to image correctly

### Edge Cases

- Person with birth_place but no death_place (no path)
- Place note with no coordinates (skip marker)
- Large dataset performance (1000+ people)
- Empty filters (show "no data" message)
- Invalid coordinate values (graceful handling)

---

## Related Documentation

- [geographic-features-plan.md](geographic-features-plan.md) - Overall geographic features design
- [roadmap.md](../roadmap.md) - Project roadmap
- [Family Chart View implementation](../development.md#family-chart-view) - Similar ItemView pattern

---

## Design Decisions

### Offline Tile Caching

**Decision:** Defer to v2.

**Rationale:**
- Obsidian is offline-first, but tile caching adds significant complexity (~20-40KB additional plugins, storage management UI, expiration logic)
- Custom image maps already work fully offline for fictional worlds
- Users needing offline real-world maps can screenshot/export regions of interest
- Will revisit once real usage patterns are understood

**v1 approach:** Document clearly that real-world maps require internet connection.

### Mobile Testing Strategy

**Decision:** Use both DevTools simulation and real device testing.

| Method | Use For |
|--------|---------|
| DevTools simulation | Rapid iteration, responsive layout, touch event simulation, network throttling |
| Real device testing | Actual performance validation, gesture handling, memory pressure, Leaflet mobile quirks |

**Testing checkpoints:**
- After Phase 4.2 (markers/clustering): Phone test - clustering is the key performance concern
- After Phase 4.4 (full feature set): Tablet test - larger touch targets, different interaction patterns

**Key concern:** 1000+ markers on mobile may lag without proper clustering thresholds.

### Universe/Map Switching

**Decision:** Filter-driven auto-switching with manual override.

**Behavior:**
1. When user selects a collection or applies place category filter:
   - If all visible places are `fictional`/`mythological`/`legendary` with the same `universe` value, auto-switch to that universe's custom map
   - If places are mixed or all `real`/`historical`, show OpenStreetMap
2. Manual override dropdown available for edge cases

**UX flow:**
- User selects "House Stark" collection → map auto-switches to Westeros
- User clears filter to "All people" → map returns to OpenStreetMap
- User can manually select different map from dropdown if auto-detection is wrong

**Implementation:** Hooks into existing filter panel; universe detection reads `universe` field from place notes.

---

## Future Considerations (v2+)

### Offline Tile Caching
- Cache OpenStreetMap tiles locally for offline use
- Leaflet-offline or localForage-based solutions
- Storage management UI (clear cache, view size)
- Tile expiration/refresh logic
- Per-region download capability (e.g., "Download tiles for Europe")
- Use cases:
  - Users without reliable internet
  - Faster map loading for frequently-viewed regions
  - Privacy-conscious users who want to minimize external requests

### Additional Marker Types
- Expand beyond birth/death/marriage/burial markers
- New event types:
  - **Residence** - Places where a person lived (with date ranges)
  - **Occupation** - Workplaces, businesses owned
  - **Education** - Schools, universities attended
  - **Military** - Service locations, battles
  - **Religious** - Baptism, confirmation, ordination locations
  - **Custom events** - User-defined event types
- Implementation:
  - Extend person note schema with `events` array
  - Each event has type, place, date_from, date_to
  - Layer toggles for each event type
  - Distinct marker colors/icons per type

### Route/Journey Visualization
- Show a person's movements through life, not just birth→death
- Connect all known locations in chronological order
- Use cases:
  - Track immigration journeys (multiple stops)
  - Visualize military campaigns or tours of duty
  - Show career moves across cities
  - Map pilgrimage or travel routes
- Implementation:
  - Parse events with dates and locations
  - Draw polyline connecting locations in date order
  - Optional animation showing movement over time
  - "Playback" mode stepping through life events
- Complements Time Slider: see where someone was at each point in time

### Image Export
Options explored (deferred due to CORS complexity):

| Approach | Pros | Cons |
|----------|------|------|
| leaflet-image | Full map capture | CORS issues with external tiles |
| leaflet-easyPrint | Print dialog | Same CORS limitations |
| SVG overlay only | No CORS issues | No basemap in export |
| html2canvas | General solution | Unreliable with map tiles |

**Workaround:** Document screenshot approach for users who need image export.

### Interactive Image Overlay Manipulation (Leaflet.DistortableImage)
- Enable users to interactively scale, rotate, and distort custom map images
- Supports corner-dragging for perspective warping (rubber-sheet georeferencing)
- Toolbar modes: distort, drag, rotate, scale, freeRotate, lock
- Use cases:
  - Align historical maps to modern coordinates
  - Fit hand-drawn fictional world maps to a coordinate system
  - Adjust scanned maps that aren't perfectly rectangular
- Library: [Leaflet.DistortableImage](https://github.com/publiclab/Leaflet.DistortableImage) (~50KB)
- Depends on: Leaflet.toolbar, Leaflet.Path.Transform

### Pixel-Based Coordinate System (L.CRS.Simple) ✅ Implemented

Leaflet's Simple CRS is now supported for direct pixel-to-coordinate mapping.

**How it works:**
- Set `coordinate_system: pixel` in the map config frontmatter
- Place notes use flat `pixel_x` and `pixel_y` properties
- Image dimensions can be specified or auto-detected from the image
- The map automatically switches CRS when loading a pixel-based custom map

**Map configuration example:**
```yaml
---
type: map
map_id: westeros
name: Westeros
universe: got
image: assets/maps/westeros.png
coordinate_system: pixel
image_width: 2048
image_height: 3072
center_x: 1024
center_y: 1536
default_zoom: 0
---
```

**Place note example:**
```yaml
---
type: place
cr_id: winterfell
name: Winterfell
universe: got
pixel_x: 1200
pixel_y: 2400
---
```

**Use cases:**
- Worldbuilders who want to place markers directly on their map image
- Game maps, dungeon layouts, floor plans
- Any image where real-world coordinates don't apply

**Benefits:**
- More intuitive for non-geographic maps (users think in pixels)
- No need to define arbitrary lat/lng bounds for fictional worlds
- Coordinates directly correspond to image editor positions
- Flat properties work well with Obsidian's Properties view

### Tiled Image Maps (Zoomify/DeepZoom)
- Replace `L.imageOverlay` with tiled image loading for massive custom maps
- Only loads visible tiles at current zoom level, enabling smooth performance with huge images
- Use cases:
  - Extremely detailed fantasy world maps (10,000+ pixels)
  - High-resolution historical maps
  - Large hand-drawn or commissioned artwork
- Options:
  - **Leaflet.Zoomify** - Pre-tiled images via Zoomify format
  - **Leaflet.DeepZoom** - Microsoft DeepZoom format (DZI files)
  - **leaflet-iiif** - IIIF Image API support for academic/archival maps
- Requires: External tool to pre-tile images (e.g., VIPS, ImageMagick, or online converters)
- Current v1 approach: `L.imageOverlay` works well for reasonably-sized images (~4000px); users with larger maps can pre-scale or crop regions
