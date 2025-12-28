# Draggable Place Markers

Planning document for enabling interactive repositioning of place markers on maps with automatic frontmatter updates.

**Status:** Planning
**GitHub Issue:** #TBD
**Priority:** Low
**Created:** 2025-12-27

---

## Overview

Allow users to drag place markers on the map to reposition them, automatically updating the corresponding place note's frontmatter coordinates. This dramatically improves the workflow for placing locations on custom maps, especially pixel-based fictional maps where manually determining coordinates is tedious.

---

## Motivation

**The Problem:** Currently, to position a place on a custom map, users must:

1. Open the map image in an external image editor
2. Hover over the desired location to find pixel coordinates
3. Manually edit the place note's frontmatter with `pixel_x` and `pixel_y` values
4. Reload the map to verify placement
5. Repeat if the position isn't quite right

This friction discourages users from adding places to custom maps.

**The Solution:** Allow users to simply drag markers to the desired location, with automatic frontmatter updates.

---

## Design Principles

1. **Non-destructive by default** — Markers are not draggable in normal viewing mode
2. **Explicit edit mode** — User must opt-in to editing, preventing accidental moves
3. **Immediate feedback** — Show coordinates updating in real-time during drag
4. **Undo support** — Provide easy recovery from accidental moves
5. **Works with both coordinate systems** — Support geographic (lat/lng) and pixel coordinates

---

## User Experience

### Entering Edit Mode

Options to consider:

| Approach | Pros | Cons |
|----------|------|------|
| Reuse existing Edit button | Consistent with map image alignment editing | May confuse users expecting only image alignment |
| Separate "Edit Places" toggle | Clear intent separation | More UI clutter |
| Per-marker edit button | Fine-grained control | Tedious for bulk editing |
| Hold modifier key while dragging | No UI changes needed | Less discoverable |

**Recommendation:** Add a new toolbar toggle "Edit places" that appears next to the existing Edit button. When active, place markers become draggable.

### During Drag

- Marker follows cursor with smooth movement
- Tooltip or status bar shows current coordinates in real-time
- Visual indicator that marker is being moved (e.g., slight scale increase, shadow)

### After Drag

1. Show confirmation toast: "Moved [Place Name] to [coordinates]. Undo?"
2. Update place note frontmatter with new coordinates
3. "Undo" button in toast reverts both marker position and frontmatter
4. Map refreshes to reflect the change (may happen automatically via existing auto-refresh)

### Click-to-Create (Future)

When in edit mode, clicking on empty map space could offer to create a new place at that location:

1. User clicks empty area on map
2. Quick modal appears: "Create place at [coordinates]?"
3. Opens Create Place modal with coordinates pre-filled
4. New place appears on map after creation

---

## Technical Implementation

### Phase 1: Basic Draggable Markers

**Files to modify:**

- `src/maps/map-view.ts` — Add edit mode toggle, handle mode state
- `src/maps/marker-manager.ts` — Create markers with conditional draggable option
- `src/maps/map-data-service.ts` — Add method to update place coordinates

**Leaflet integration:**

```typescript
// Creating a draggable marker
const marker = L.marker([lat, lng], {
  draggable: isEditMode,
  // ... other options
});

// Listen for drag end
marker.on('dragend', async (event) => {
  const newLatLng = event.target.getLatLng();
  await this.updatePlaceCoordinates(placeId, newLatLng);
});
```

**Frontmatter update approach:**

```typescript
async updatePlaceCoordinates(placeId: string, coords: { lat?: number, lng?: number, pixelX?: number, pixelY?: number }) {
  const placeFile = await this.getPlaceFile(placeId);
  if (!placeFile) return;

  await this.app.fileManager.processFrontMatter(placeFile, (fm) => {
    if (coords.lat !== undefined) fm.latitude = coords.lat;
    if (coords.lng !== undefined) fm.longitude = coords.lng;
    if (coords.pixelX !== undefined) fm.pixel_x = coords.pixelX;
    if (coords.pixelY !== undefined) fm.pixel_y = coords.pixelY;
  });
}
```

### Phase 2: Undo Support

- Track previous coordinates before drag
- Show toast with "Undo" action
- On undo: revert frontmatter and marker position
- Toast auto-dismisses after ~5 seconds

### Phase 3: Click-to-Create

- In edit mode, add click listener to map (not on markers)
- Show quick confirmation popover at click location
- On confirm, open Create Place modal with coordinates pre-filled
- Handle both geographic and pixel coordinate systems

### Phase 4: Bulk Operations (Future)

- Select multiple markers (shift+click or lasso)
- Move selected markers as a group
- Batch frontmatter updates

---

## Coordinate System Handling

### Geographic Maps (OpenStreetMap, geo-aligned custom maps)

- Leaflet provides lat/lng directly from drag events
- Update `latitude` and `longitude` frontmatter properties
- Consider rounding to reasonable precision (e.g., 6 decimal places)

### Pixel-Based Custom Maps

- Need to convert from Leaflet's internal lat/lng to pixel coordinates
- Use the inverse of the coordinate transformation already in place for pixel maps
- Update `pixel_x` and `pixel_y` frontmatter properties
- Round to integers (pixels don't have fractional values)

```typescript
// For pixel maps, convert Leaflet coords to pixel coords
const pixelX = Math.round(/* conversion from latlng */);
const pixelY = Math.round(/* conversion from latlng */);
```

---

## UI Considerations

### Edit Mode Indicator

When edit mode is active:
- Toolbar button shows active state (highlighted/toggled)
- Optional: Edit banner similar to map image alignment mode
- Markers visually change (e.g., add grab cursor, subtle animation)

### Toast Messages

```
✓ Moved "Winterfell" to (1200, 2400)  [Undo]
```

For geographic:
```
✓ Moved "London" to (51.5074°N, 0.1278°W)  [Undo]
```

### Error Handling

- "Could not update [Place Name]: file not found"
- "Could not update [Place Name]: frontmatter parsing error"
- Marker reverts to original position on error

---

## Open Questions

1. **Should event markers also be draggable?** Events have place references, not their own coordinates. Moving an event marker would mean changing its place reference or creating a new place.

2. **What about person markers?** Person markers represent events at places. Same consideration as above.

3. **Multiple places at same location?** When dragging in a cluster, need clear indication of which marker is being moved.

4. **Conflict with popup behavior?** Currently clicking a marker shows a popup. Need to distinguish click (show info) from drag (reposition).

5. **Mobile/touch support?** Long-press to enter drag mode?

---

## Success Metrics

- Users can position places on custom maps without leaving Obsidian
- Time to place a new location reduced from ~2 minutes to ~10 seconds
- No accidental repositioning in normal use (edit mode provides safety)

---

## References

- [Leaflet Marker draggable option](https://leafletjs.com/reference.html#marker-draggable)
- [Leaflet drag events](https://leafletjs.com/reference.html#marker-dragend)
- Existing map edit mode implementation in `src/maps/image-map-manager.ts`
