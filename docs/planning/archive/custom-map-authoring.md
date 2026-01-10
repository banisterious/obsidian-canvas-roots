# Custom Map Authoring

Planning document for custom map creation and place management workflows.

- **Status:** Complete (Phase 1-3 implemented, Phase 4-5 deferred)
- **GitHub Issue:** #66
- **Created:** 2025-12-28
- **Updated:** 2025-12-30

---

## Overview

This document covers two complementary problems:

1. **Creating custom maps** — Setting up a map from an image with correct coordinate configuration
2. **Adding places to maps** — Positioning places on custom maps without manual coordinate entry

### The Problems

**Map Creation:**
> "I have a beautiful map image of my fantasy world. I want to use it in Charted Roots, but the setup process is confusing. What coordinate system should I use? What are bounds? I just want to see my map and start adding locations."

**Place Positioning:**
> "I have a map configured, but adding places is tedious. I have to open the image in an external editor, find pixel coordinates, type them into frontmatter, reload the map to check placement, and repeat. It takes 5 minutes per place."

### The Solutions

1. **Map Creation Wizard** — A guided, multi-step wizard that walks users through creating a map and optionally adding initial places
2. **Right-click to Create Place** — In Map View, right-click on empty map space to create a place with coordinates auto-filled ✅
3. **Place Marker Context Menu** — Right-click on a place marker to edit, open note, or copy coordinates ✅
4. **Draggable Place Markers** — Reposition existing places by dragging their markers (requires edit mode) ✅

---

## Current State

### Entry Points for Map Creation

| Entry Point | Location | Notes |
|-------------|----------|-------|
| Control Center → Maps → "Create map" | Opens `CreateMapModal` | Current primary workflow |
| Control Center → Maps → "Import JSON" | Import exported config | For sharing/backup |
| Context menu on map note → "Edit map" | Opens `CreateMapModal` in edit mode | For existing maps |

### Current Settings

| Setting | Description | Actual Usage |
|---------|-------------|--------------|
| `mapsFolder` | "Default folder for custom map images" | Where **map notes** are created (description is misleading) |

**Note:** Map images can live anywhere in the vault. The `image` property uses wikilinks like `"[[path/to/map.jpg]]"`.

### Pain Points

1. **No guided setup** — Users must understand coordinate systems, bounds, etc. upfront
2. **Settings description is misleading** — Says "map images" but stores map notes
3. **No command palette entry** — Must navigate through Control Center
4. **No "image first" workflow** — Can't right-click an image and say "Use as map"
5. **Manual coordinate entry** — Adding places requires external tools to find coordinates
6. **No visual feedback** — Can't see where a place will appear until after creation

---

## Phase 1: Map Creation Wizard

A guided wizard that walks users through creating a custom map with optional initial places.

### User Story

> As a worldbuilder, I want to set up a map of my fantasy world and add a few key locations in one flow, so I can start using the map immediately without multiple trips through different interfaces.

### Wizard Flow

```
Step 1: Select Map Image
   ├── Browse vault for image
   ├── Show image preview
   └── Auto-detect dimensions

Step 2: Configure Map
   ├── Name (required) → auto-generates map ID
   ├── Universe (optional, for grouping)
   ├── Coordinate system (pixel recommended for fantasy maps)
   └── Advanced: bounds, zoom levels (collapsed by default)

Step 3: Add Places (Optional)
   ├── Interactive map preview
   ├── Click on map to add a place
   ├── Enter name in inline field
   ├── Marker appears immediately
   ├── Repeat for additional places
   └── Can skip this step entirely

Step 4: Review & Create
   ├── Summary of what will be created
   ├── Map note preview
   ├── Place notes preview (if any)
   └── [Create] → creates all notes, opens map in Map View
```

### Design Decisions

1. **Pixel coordinate system as default**
   - Rationale: Most custom maps are fantasy/fictional without real-world coordinates
   - Geographic option available for historical maps with known bounds

2. **Click-on-map for place creation in Step 3**
   - Rationale: The whole point is eliminating manual coordinate entry
   - Same interaction users will use later in Map View

3. **Optional place creation**
   - Rationale: Some users just want to set up the map first
   - Can always add places later via Map View

4. **Creates all notes at once in Step 4**
   - Rationale: Allows preview/review before committing
   - Easier to cancel if something looks wrong

### Entry Points

1. **Control Center → Maps → "Create map wizard"** (new button)
2. **Command palette: "Charted Roots: Create custom map"** (new command)
3. **Context menu on image file → "Use as custom map"** (new option)

### Implementation Notes

- New modal class: `CreateMapWizardModal`
- Embed Leaflet map in Step 3 for interactive place creation
- Reuse `ImageMapManager` for image loading and coordinate handling
- Store pending places in wizard state until final creation

---

## Phase 2: Right-Click to Create Place

Allow users to right-click on empty map space in Map View to create a new place with coordinates auto-filled.

### User Story

> As a user viewing my custom map, I want to right-click where I want a new place and create it directly, so I don't have to figure out coordinates manually.

### Interaction Flow

```
Map View (any custom map)
  └── Right-click on empty map area
        └── Context menu appears
              └── "Create place here"
                    └── Opens CreatePlaceModal
                          ├── Coordinates pre-filled (read-only display)
                          ├── Map's universe pre-selected
                          ├── Name input (required)
                          ├── Place type dropdown
                          ├── Category dropdown
                          └── [Create] → saves note, marker appears on map
```

### Design Decisions

1. **No edit mode required for creation**
   - Rationale: Right-click is intentional; users don't accidentally right-click
   - Faster for adding one-off places
   - Edit mode still required for dragging (Phase 3) to prevent accidents

2. **Opens full CreatePlaceModal (not quick inline)**
   - Rationale: Places have multiple fields (type, category, parent)
   - Coordinates are the friction point, not the form itself
   - Consistent with existing place creation workflow

3. **Works with both coordinate systems**
   - Geographic maps: captures lat/lng
   - Pixel maps: captures pixel_x/pixel_y
   - Map type determines which coordinates to populate

### Implementation Notes

- Add context menu to map container in `MapView`
- Capture coordinates from right-click event: `map.mouseEventToLatLng(e)`
- For pixel maps, convert to pixel coordinates using existing transformation
- Pass coordinates to `CreatePlaceModal` via new `prefilledCoordinates` option
- Refresh map after creation (or dynamically add marker)

---

## Phase 3: Draggable Place Markers

Allow repositioning existing places by dragging their markers, with automatic frontmatter updates.

### User Story

> As a user with places on my map, I want to drag a marker to a new position and have the coordinates update automatically, so I can fine-tune placement without editing frontmatter.

### Interaction Flow

```
Map View (Edit Mode Active)
  └── Drag place marker to new location
        └── Marker follows cursor
              └── On drop:
                    ├── Update frontmatter with new coordinates
                    ├── Show toast: "Moved [Place] to [coords]. Undo?"
                    └── Undo reverts both marker and frontmatter
```

### Design Decisions

1. **Edit mode required for dragging**
   - Rationale: Dragging can happen accidentally when panning
   - Moving places is more consequential than creating them
   - Consistent with existing image alignment editing pattern

2. **Reuse existing Edit button with expanded scope**
   - Current: Edit button toggles image alignment mode
   - Proposed: Edit button enables both image alignment AND marker dragging
   - Clear visual indicator when active (banner or button highlight)

3. **Immediate frontmatter update**
   - Changes persist on drag-end, not on explicit save
   - Undo available via toast for ~5 seconds
   - Matches Obsidian's general "auto-save" philosophy

4. **Coordinate system awareness**
   - Geographic: updates `latitude`, `longitude` (or aliased properties)
   - Pixel: updates `pixel_x`, `pixel_y`
   - Rounds to appropriate precision (6 decimals for geo, integers for pixel)

### Edit Mode Behavior

When edit mode is active:
- Toolbar button shows active state
- Edit banner appears (similar to image alignment mode)
- Place markers become draggable (cursor changes to grab)
- Image corners become draggable (existing behavior)

### Toast Messages

```
✓ Moved "Winterfell" to (1200, 2400)  [Undo]
```

For geographic:
```
✓ Moved "London" to (51.5074°N, 0.1278°W)  [Undo]
```

### Technical Implementation

**Leaflet marker setup:**
```typescript
const marker = L.marker([lat, lng], {
  draggable: isEditMode,
  // ... other options
});

marker.on('dragend', async (event) => {
  const newLatLng = event.target.getLatLng();
  await this.updatePlaceCoordinates(placeId, newLatLng);
});
```

**Frontmatter update:**
```typescript
async updatePlaceCoordinates(placeId: string, coords: LatLng) {
  const placeFile = await this.getPlaceFile(placeId);
  await this.app.fileManager.processFrontMatter(placeFile, (fm) => {
    if (this.isPixelMap) {
      fm.pixel_x = Math.round(/* convert from latlng */);
      fm.pixel_y = Math.round(/* convert from latlng */);
    } else {
      fm.latitude = coords.lat.toFixed(6);
      fm.longitude = coords.lng.toFixed(6);
    }
  });
}
```

### Implementation Notes

- Modify `MarkerManager` to create markers with conditional `draggable` option
- Add drag event handlers in `MapController` or `MapView`
- Track previous coordinates for undo functionality
- Add `updatePlaceCoordinates` method to `MapDataService`

---

## Phase 4: Place Coordinate Import (Deferred)

> **Status:** Deferred for future consideration. The wizard's click-to-add and Map View's right-click-to-create flows cover most use cases.

Import places from a coordinates file (CSV/JSON) with bulk creation.

### Motivation

Worldbuilders often have existing location data:
- Spreadsheet of cities with coordinates
- Exported data from other mapping tools
- AI-generated location lists with positions

### Scope

1. **Import formats**
   - CSV: `name,x,y` or `name,latitude,longitude`
   - JSON: `[{name, coordinates: {x, y}}]`
   - Auto-detect format

2. **Import wizard**
   - Step 1: Select file or paste data
   - Step 2: Map columns to fields (name, x, y, type, category)
   - Step 3: Preview places on map before creation
   - Step 4: Create notes, show results

3. **Conflict handling**
   - Place with same name exists: Skip / Overwrite / Rename
   - Preview shows conflicts before creation

### Open Questions

1. Should import create place notes immediately or stage them for review?
2. How to handle places that fall outside map bounds?
3. Support for importing parent_place relationships?

---

## Phase 5: Additional Entry Points (Deferred)

### Context Menu on Image File

Right-click an image file in the file explorer:
- "Use as custom map" → Opens Map Creation Wizard with image pre-selected

### Command Palette

- "Charted Roots: Create custom map" → Opens Map Creation Wizard
- "Charted Roots: Add place to current map" → Opens CreatePlaceModal with current map's universe

### Quick Switcher Integration

- Type "map:" prefix to search custom maps
- Select to open in Map View

---

## Completed Enhancements

### Map View Tab (v0.6.2)

- Interactive map display in Control Center
- Layer toggles for places, events, people
- Support for both geographic and custom maps

### Place Picker Integration (v0.14.x)

- Place picker includes "Create new place" option
- Inline creation from person edit modal
- Places created with cr_id for reliable linking

### Custom Map Image Support (v0.9.x)

- Upload and configure custom map images
- Pixel-based coordinate system
- Image alignment editing

---

## Implementation Checklist

### Phase 1: Map Creation Wizard ✅

#### Phase 1a: Wizard Modal Structure
- [x] Create `CreateMapWizardModal` class with step navigation
- [x] Implement step indicator UI (Step 1 of 4, etc.)
- [x] Add Back/Next/Cancel/Create buttons with step-appropriate states

#### Phase 1b: Step 1 - Image Selection
- [x] Create `ImagePickerModal` for browsing vault images
- [x] Show image preview with dimensions
- [x] Auto-detect and display image dimensions

#### Phase 1c: Step 2 - Map Configuration
- [x] Name input with auto-generated map ID
- [x] Universe dropdown (existing universes)
- [x] Coordinate system selector (pixel default)
- [x] Collapsible advanced section for bounds/zoom

#### Phase 1d: Step 3 - Add Places
- [x] Display selected image as map preview
- [x] Handle click events to capture coordinates
- [x] Inline name input at click location
- [x] Display pending places as markers
- [x] Allow removing pending places before creation

#### Phase 1e: Step 4 - Review & Create
- [x] Summary view of map configuration
- [x] List of places to be created
- [x] Create all notes on confirm
- [x] Open map in Map View after creation

#### Phase 1f: Entry Points
- [x] Add "Wizard" button to Control Center Maps tab
- [x] Add command: "Charted Roots: Create custom map"
- [x] Add context menu on image files: "Use as custom map"

### Phase 2: Right-Click to Create Place

- [x] Add context menu to map container in `MapView`
- [x] Implement coordinate capture from right-click event
- [x] Add `prefilledCoordinates` option to `CreatePlaceModal`
- [x] Display coordinates as read-only info in modal
- [x] Handle both geographic and pixel coordinate prefill
- [x] Pass map's universe for default values
- [x] Refresh map after place creation

### Phase 2b: Place Marker Context Menu

- [x] Add `onPlaceMarkerContextMenu` callback to `MapController`
- [x] Add contextmenu event handler to place markers
- [x] Implement "Edit place" action (opens `CreatePlaceModal` in edit mode)
- [x] Implement "Open note" action
- [x] Implement "Copy coordinates" action

### Phase 3: Draggable Place Markers

#### Phase 3a: Edit Mode Enhancement
- [x] Extend existing edit mode to include marker dragging
- [x] Update edit mode banner text to reflect expanded scope
- [x] Ensure edit mode persists across layer changes

#### Phase 3b: Draggable Markers
- [x] Modify `MapController.createPlaceMarker()` to create draggable markers when in edit mode
- [x] Add drag event handlers for coordinate capture
- [x] Convert coordinates appropriately for map type (geo vs pixel)

#### Phase 3c: Frontmatter Updates
- [x] Add `handlePlaceMarkerDragged` method to `MapView`
- [x] Handle property aliases for coordinates (custom_coordinates_x/y, pixel_x/y, coordinates.lat/long, etc.)
- [x] Round to appropriate precision (integers for pixel, 6 decimals for geo)

#### Phase 3d: Undo Support
- [x] Track previous coordinates before drag
- [x] Show toast with Undo link
- [x] Implement undo: revert frontmatter and refresh map
- [x] Auto-dismiss toast after 8 seconds

### Phase 4: Place Coordinate Import (Deferred)

_Deferred for future consideration._

---

## Open Questions

1. **Should event markers also be draggable?** Events reference places, not their own coordinates. Moving an event marker would mean changing its place reference.

2. **Multiple places at same location?** When dragging in a cluster, need clear indication of which marker is being moved.

3. **Mobile/touch support?** Long-press for context menu? Long-press to enter drag mode?

4. **Settings cleanup:** Should we rename `mapsFolder` setting or add a separate `mapNotesFolder` setting for clarity?

---

## Session Notes

### 2025-12-30 Session

**Implemented:**
- Fixed "Open map" button to open newly created map (passes `activeMap` state)
- Fixed place marker coordinate mismatch between wizard and Map View
  - Issue: Wizard used DOM coordinates (Y=0 at top), Leaflet Simple CRS uses Y=0 at bottom
  - Solution: Flip Y coordinate when saving and rendering markers
- Fixed Map View toolbar button overflow when sidebar is open
  - Added `flex-wrap: wrap` to toolbar and sections
- Converted Map View toolbar buttons to icon-only with `aria-label` tooltips
  - Saves horizontal space, cleaner look
  - Icons: layers, move, edit, git-compare, clock, refresh-cw, download
- Fixed broken CSS comment blocks in control-center.css
- Added modal state persistence for wizard resume functionality
- Added inline universe creation in wizard Step 2

**UX improvements added during session:**
- Icon-only buttons reduce toolbar width significantly
- Tooltips appear on hover via Obsidian's aria-label handling

---

## Related Documents

- [Geographic Features](../../wiki-content/Geographic-Features.md) — User documentation
- [Frontmatter Reference](../../wiki-content/Frontmatter-Reference.md) — Place property documentation
- [CreateMapModal](../../src/ui/create-map-modal.ts) — Current map creation implementation
- [CreatePlaceModal](../../src/ui/create-place-modal.ts) — Current place creation implementation
- [MapView](../../src/maps/map-view.ts) — Map view implementation
- [MarkerManager](../../src/maps/marker-manager.ts) — Marker creation and management
