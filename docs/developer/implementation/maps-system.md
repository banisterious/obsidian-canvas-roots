# Maps System

The maps module (`src/maps/`) provides interactive geographic visualization using Leaflet, supporting both real-world maps and custom fictional/historical image maps.

## Table of Contents

- [Architecture](#architecture)
- [Coordinate Systems](#coordinate-systems)
- [Data Flow](#data-flow)
- [Layer Management](#layer-management)
- [Custom Image Maps](#custom-image-maps)
- [Map Creation Wizard](#map-creation-wizard)
- [Draggable Place Markers](#draggable-place-markers)
- [Place Marker Context Menu](#place-marker-context-menu)
- [Geocoding](#geocoding)
- [Time Slider](#time-slider)

---

## Architecture

```
src/maps/
├── map-controller.ts          # Core Leaflet map management, marker interactions
├── map-view.ts                # ItemView UI for map rendering, toolbar
├── map-data-service.ts        # Data preparation from notes
├── image-map-manager.ts       # Custom image map handling
├── types/
│   ├── map-types.ts          # Type definitions
│   └── leaflet-plugins.d.ts   # Plugin type declarations
├── services/
│   └── geocoding-service.ts   # OpenStreetMap Nominatim integration
└── ui/
    └── bulk-geocode-modal.ts  # Batch geocoding UI

src/ui/
├── create-map-wizard-modal.ts # 4-step map creation wizard
└── create-place-modal.ts      # Place creation/editing (used by wizard)
```

## Coordinate Systems

The system supports two coordinate modes:

**Geographic mode** (default): Standard lat/lng coordinates for real-world maps
```yaml
coordinate_system: geographic
bounds_north: 50
bounds_south: -50
bounds_west: -100
bounds_east: 100
```

**Pixel mode**: Direct pixel coordinates with `L.CRS.Simple` for custom image maps
```yaml
coordinate_system: pixel
image_width: 2048
image_height: 3072
center_x: 1024
center_y: 1536
```

**CRS switching**: When changing between OpenStreetMap and pixel-based custom maps, the entire Leaflet map is destroyed and recreated (Leaflet doesn't support dynamic CRS changes).

## Data Flow

```
Place Notes (with coordinates)
         ↓
    Place Cache (by cr_id and name)
         ↓
Person Notes (with place references)
         ↓
    MapDataService.prepareMapData()
         ↓
    ┌────────────────┬─────────────────┐
    ↓                ↓                 ↓
 Markers      MigrationPaths     JourneyPaths
    ↓                ↓                 ↓
    └────────────────┴─────────────────┘
                     ↓
              MapController
                     ↓
           Leaflet Rendering
```

**Marker types:**
- Core life events: birth, death, marriage, burial
- Additional events: residence, occupation, education, military, immigration, religious events

**Path types:**
- **MigrationPath**: Birth → death location for a person
- **JourneyPath**: All life events chronologically ordered
- **AggregatedPath**: Grouped paths for visualization weight (shows travel flow intensity)

**Place resolution** (`MapDataService`):
1. Try cr_id lookup first (fastest)
2. Fall back to case-insensitive name lookup
3. Support partial matching ("Paris" finds "Paris, France")
4. Handle wikilink extraction from references

## Layer Management

`MapController` organizes markers into separate cluster groups:

```typescript
// Separate cluster groups by event type
birthMarkers: MarkerClusterGroup
deathMarkers: MarkerClusterGroup
marriageMarkers: MarkerClusterGroup
burialMarkers: MarkerClusterGroup
additionalMarkers: MarkerClusterGroup  // All other event types

// Path layers
pathLayer: LayerGroup      // Migration paths
journeyLayer: LayerGroup   // Full journey paths
heatLayer: HeatLayer       // Location density visualization
```

**Leaflet plugins used:**
- `leaflet.markercluster` - Clusters markers at various zoom levels
- `leaflet.heat` - Density heat maps
- `leaflet-polylinedecorator` - Arrow decorations on paths
- `leaflet-textpath` - Labels along paths
- `leaflet-fullscreen` - Fullscreen mode
- `leaflet-minimap` - Overview map
- `leaflet-search` - Place name search

## Custom Image Maps

`ImageMapManager` handles fictional worlds and historical maps.

**Map note frontmatter:**
```yaml
type: map
map_id: middle-earth
name: Middle-earth
universe: tolkien
image: path/to/image.jpg
coordinate_system: pixel  # or geographic
image_width: 2048
image_height: 3072
```

**Edit mode features:**
- Distortable image overlay (leaflet-distortableimage)
- Corner manipulation for alignment
- Corners saved to frontmatter (flat format for Obsidian Properties)
- Restore/reset functionality

**Property format support:**
- Flat format (preferred): `bounds_north`, `corner_nw_lat`
- Nested format (legacy): `bounds: {north: 50}`
- Automatic fallback between formats

## Map Creation Wizard

`CreateMapWizardModal` (`src/ui/create-map-wizard-modal.ts`) provides a guided 4-step workflow for creating custom maps with interactive place marker placement.

**Steps:**
1. **Select Image** - Browse vault for map image with preview
2. **Configure Map** - Name, universe, coordinate system, bounds
3. **Place Markers** - Interactive click-to-place with drag repositioning
4. **Review & Create** - Summary and confirmation

**Key implementation details:**

```typescript
interface WizardState {
  currentStep: number;
  imagePath: string;
  mapName: string;
  universe: string;
  coordinateSystem: 'geographic' | 'pixel';
  bounds: MapBounds;
  places: PlaceMarkerData[];  // Markers added during step 3
}
```

**Coordinate system handling:**
- The wizard preview uses DOM coordinates (Y=0 at top)
- Leaflet Simple CRS uses Y=0 at bottom
- Coordinates are flipped when storing: `storedY = imageHeight - domY`
- Coordinates are flipped back when rendering markers

**State persistence:**
- Wizard state is saved via `ModalStatePersistence` on close
- Users can resume interrupted sessions
- State includes all places added during step 3

**Place creation flow:**
1. User clicks on map image
2. Click coordinates converted to map coordinate system
3. `CreatePlaceModal` opens with pre-filled coordinates
4. On save, marker added to wizard's places array
5. Marker rendered on preview with drag support

## Draggable Place Markers

Place markers on custom maps support drag-to-reposition in both the wizard preview and the live Map View.

**Implementation in MapController:**

```typescript
// Enable dragging on place markers
marker.options.draggable = true;

marker.on('dragend', async (e: L.DragEndEvent) => {
  const newLatLng = e.target.getLatLng();

  // Update place note frontmatter
  await this.updatePlaceCoordinates(placeId, {
    lat: newLatLng.lat,
    lng: newLatLng.lng
  });
});
```

**Coordinate conversion for pixel maps:**
- Leaflet returns coordinates in its internal format
- For pixel maps: Y must be converted back to image coordinates
- `imageY = imageHeight - leafletY`

**In the wizard preview:**
- Markers are standard DOM elements with drag event handlers
- Position updates stored in wizard state
- Final coordinates written when map is created

## Place Marker Context Menu

Right-click on place markers opens a context menu with quick actions.

**Implementation in MapController:**

```typescript
marker.on('contextmenu', (e: L.LeafletMouseEvent) => {
  L.DomEvent.stopPropagation(e);

  const menu = new Menu();

  menu.addItem((item) => {
    item.setTitle('Open place note')
        .setIcon('file-text')
        .onClick(() => this.openPlaceNote(placeId));
  });

  menu.addItem((item) => {
    item.setTitle('Edit place')
        .setIcon('pencil')
        .onClick(() => this.openEditPlaceModal(placeId));
  });

  menu.addItem((item) => {
    item.setTitle('Remove from map')
        .setIcon('trash-2')
        .onClick(() => this.removeMarkerFromMap(placeId));
  });

  menu.showAtMouseEvent(e.originalEvent);
});
```

**Remove from map action:**
- Clears coordinates from place note frontmatter
- Marker disappears on next refresh
- Does not delete the place note itself

## Geocoding

`GeocodingService` integrates with OpenStreetMap's Nominatim API.

**Features:**
- Single place lookup
- Bulk geocoding with rate limiting (1 request/second per Nominatim policy)
- Progress reporting and cancellation support
- Skips places that already have coordinates

**Implementation:**
```typescript
// User-Agent required by Nominatim
headers: { 'User-Agent': 'Charted Roots Obsidian Plugin' }

// Updates place notes with flat property format
coordinates_lat: 48.8566
coordinates_long: 2.3522
```

## Time Slider

The map view includes a time slider for temporal filtering:

**Modes:**
- "Alive in year" (snapshot) - Shows people alive during selected year
- "Born by year" (cumulative) - Shows people born up to selected year

**Implementation:**
- Maintains original full dataset (`currentMapData`)
- Filters for display without changing source
- Animation loops through years with configurable speed
- Live count updates during filtering
