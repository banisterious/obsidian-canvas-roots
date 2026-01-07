# Per-Map Marker Assignment

Planning document for per-map marker filtering in Canvas Roots.

- **Status:** Planning
- **GitHub Issue:** [#153](https://github.com/banisterious/obsidian-canvas-roots/issues/153)
- **Created:** 2026-01-07

---

## Overview

Add optional per-map marker assignment, allowing places to be restricted to specific custom maps rather than appearing on all maps within a universe.

### Goals

1. **Fine-grained control** — Allow users to specify which map(s) a place appears on
2. **Backward compatibility** — Places without map assignment continue to work as today
3. **Flexible assignment** — Support both single-map and multi-map assignment
4. **Minimal complexity** — Keep the feature opt-in and unobtrusive

### Non-Goals

- Changing how universe filtering works (it remains the primary grouping)
- Automatic coordinate-based filtering (too complex, doesn't handle conceptual separation)
- UI-mandatory map assignment (should remain optional frontmatter)

---

## Problem Statement

**Current behavior:**
- Place markers are filtered by `universe` only
- All places with a matching universe appear on every map that shares that universe
- When switching maps within the same universe, the same markers appear

**Limitations:**
- Cannot have separate regional maps within the same universe (e.g., "Eastern Europe" and "Western Europe" maps for a WWI research project, or "Westeros" and "Essos" in a fictional world)
- Cannot have different detail levels (e.g., a "London city map" showing only urban locations vs. a "Southeast England" regional map showing towns and villages)
- Cannot have era-specific maps (e.g., "Colonial America 1750" vs "Revolutionary War 1776" showing different place subsets based on historical period)

**User discovery:**
> "I just created a 2nd custom map and the markers from the first map show up on it... they only show up if they share the same universe, interesting"

---

## Current Architecture

### How Places Are Filtered

1. User selects a map in the dropdown
2. `MapController.onMapChange()` fires with `(mapId, universe)`
3. `filters.universe` is set to the map's universe
4. `MapDataService.getMapData()` filters places by universe
5. All places with matching universe are rendered

### Key Files

| File | Role |
|------|------|
| `src/maps/map-data-service.ts` | Filtering logic in `buildPlaceMarkers()` |
| `src/maps/map-view.ts` | Universe filter update on map change |
| `src/maps/image-map-manager.ts` | Map configuration loading |
| `src/maps/types/map-types.ts` | `MapFilters` interface |

### Current Filter Check (map-data-service.ts ~line 410)

```typescript
if (filters.universe && place.universe !== filters.universe) continue;
```

---

## Proposed Solution

### New Place Property

Add an optional `maps` property to place notes:

```yaml
# Historical example
name: Fort Ticonderoga
universe: colonial-america
coordinates_lat: 43.8426
coordinates_long: -73.3890
maps:
  - french-indian-war-map
  - revolutionary-war-map
```

```yaml
# Fictional example
name: Winterfell
universe: westeros
coordinates_lat: 54.5
coordinates_long: -5.9
maps:
  - north-map
  - westeros-full-map
```

**Semantics:**
- If `maps` is empty/undefined: Show on all maps with matching universe (current behavior)
- If `maps` is defined: Only show on the specified map(s)

### Alternative: Single-Value Property

For simpler use cases, could use `map_id` instead of `maps`:

```yaml
map_id: north-map  # Only appears on this one map
```

**Recommendation:** Use `maps` (array) for flexibility, but accept `map_id` (string) as a shorthand that gets normalized to a single-element array internally.

---

## Implementation Plan

### Phase 1: Core Filtering

**Effort:** Low

1. **Add `mapId` to `MapFilters` interface** (`src/maps/types/map-types.ts`)
   ```typescript
   export interface MapFilters {
     // ... existing fields
     mapId?: string;  // Current map ID for per-map filtering
   }
   ```

2. **Pass `mapId` through filter chain** (`src/maps/map-view.ts`)
   - In `onMapChange()`, set `this.filters.mapId = mapId`

3. **Update place filtering logic** (`src/maps/map-data-service.ts`)
   - In `buildPlaceMarkers()`, after universe check:
   ```typescript
   // Per-map filtering (if place specifies maps)
   const placeMaps = place.maps || (place.map_id ? [place.map_id] : null);
   if (placeMaps && filters.mapId && !placeMaps.includes(filters.mapId)) {
     continue;
   }
   ```

4. **Update `PlaceData` type** to include `maps?: string[]` and `map_id?: string`

5. **Add path/journey filtering** (`src/maps/map-data-service.ts`)
   - Paths should only appear if both endpoints are visible on current map:
   ```typescript
   // In path/journey rendering logic
   const startVisible = isPlaceVisibleOnMap(path.startPlace, filters);
   const endVisible = isPlaceVisibleOnMap(path.endPlace, filters);
   if (!startVisible || !endVisible) continue;
   ```

6. **Verify event filtering** — Events inherit place coordinates, so should filter automatically. Add test coverage to confirm.

### Phase 2: UI Integration (Optional)

**Effort:** Medium

1. **Create Place modal** — Add optional "Restrict to maps" multi-select
2. **Edit Place modal** — Show/edit map assignments
3. **Auto-populate current map** — When creating a place while viewing a custom map, offer to pre-populate `maps: [current-map-id]`. Keep optional — user can clear to show on all maps.
4. **Map dropdown** — Show count of places per map (nice-to-have)

### Phase 3: Documentation

1. Update wiki documentation for place properties
2. Add example in Custom Map Authoring guide
3. Document in Frontmatter Reference
4. Document how to create a "By Map" Bases view (filter/group by `maps` property)

---

## Edge Cases

### 1. Place assigned to non-existent map

**Scenario:** `maps: [deleted-map]`
**Behavior:** Place won't appear anywhere (map ID doesn't match any loaded map)
**Mitigation:** Data quality warning for orphaned map assignments (future enhancement)

### 2. Place with both universe and maps mismatch

**Scenario:** Place has `universe: colonial-america` and `maps: [civil-war-map]`, but `civil-war-map` has `universe: civil-war-era`
**Behavior:** Place won't appear (universe filter fails before map filter)
**Recommendation:** Document that `maps` should reference maps within the same universe

### 3. Real-world maps (no universe)

**Scenario:** Multiple real-world custom maps (England, France) with no universe set
**Behavior:** Works correctly — real-world places default to no universe, so they appear on OSM; custom real-world maps can have `universe: null` and places can use `maps` to restrict

### 4. Migration of existing places

**Scenario:** User has 100 places in universe X, wants to split across 2 maps
**Behavior:** No automatic migration — user adds `maps` property to places they want to restrict
**Recommendation:** Could add bulk operation in future (out of scope for Phase 1)

---

## Testing Plan

### Unit Tests

1. Place with no `maps` → appears on all maps in universe
2. Place with `maps: [map-a]` → appears only on map-a
3. Place with `maps: [map-a, map-b]` → appears on both
4. Place with `map_id: map-a` → normalized to array, appears only on map-a
5. Place with wrong universe → doesn't appear regardless of `maps`
6. Event at filtered-out place → event doesn't appear
7. Path with both endpoints visible → path appears
8. Path with one endpoint filtered out → path doesn't appear
9. Path with both endpoints filtered out → path doesn't appear

### Manual Tests

1. Create two maps in same universe
2. Create place with no `maps` → verify appears on both
3. Add `maps: [map-1]` to place → verify appears only on map-1
4. Switch between maps → verify filtering works
5. Remove `maps` property → verify place appears on both again
6. Create event at a map-restricted place → verify event respects filtering
7. Create path between places on different maps → verify path visibility

---

## Alternatives Considered

### 1. Separate universes per map

**Approach:** Use different universe values for each map
**Pros:** Works with current system
**Cons:** Loses ability to share places across maps, breaks universe-level organization

### 2. Coordinate bounds filtering

**Approach:** Only show places whose coordinates fall within map bounds
**Pros:** Automatic, no manual assignment needed
**Cons:** Complex to implement, doesn't handle conceptual separation (e.g., different zoom levels)

### 3. Place categories as pseudo-maps

**Approach:** Use `place_category` to filter places per map
**Pros:** Reuses existing property
**Cons:** Conflicts with actual category usage, hacky

---

## Open Questions (Resolved)

### 1. Property naming
**Question:** `maps` (array) vs `map_id` (single) vs `show_on_maps` vs `restrict_to_maps`?

**Decision:** Use `maps` for array, accept `map_id` as shorthand. Both get normalized internally.

### 2. Event markers and per-map filtering
**Question:** Should event markers respect per-map filtering?

**Decision:** Yes, automatically. Events inherit coordinates from places, so if a place is filtered out, its events won't render. The current implementation handles this since events use place coordinates at render time. No additional code needed — verify during testing.

### 3. Paths/journeys spanning maps
**Question:** What happens when a path's start and end places are on different maps?

**Decision:** Path appears only if **both** endpoints are visible on the current map. This is the most intuitive behavior — a journey from Boston to Philadelphia shouldn't appear on a "New England" map that doesn't include Philadelphia, nor should a path from Winterfell to King's Landing appear on a map showing only the North.

**Implementation:** Add path filtering in Phase 1:
```typescript
// In path/journey rendering logic
const startVisible = isPlaceVisibleOnMap(path.startPlace, filters);
const endVisible = isPlaceVisibleOnMap(path.endPlace, filters);
if (!startVisible || !endVisible) continue;
```

### 4. UI auto-assignment of current map
**Question:** Should the Create Place modal auto-populate the `maps` field based on which map is currently selected?

**Decision:** Defer to Phase 2 (UI Integration). When creating a place while viewing a specific custom map, offer to pre-populate `maps: [current-map-id]`. Keep it optional — user can clear it to show on all maps.

### 5. Bases views for per-map filtering
**Question:** Should there be a Bases view showing places by map assignment?

**Decision:** Low priority — no code needed. Users can already filter by any frontmatter property in Bases. Document how to create a "By Map" view manually, similar to "By Collection" view. Add to Phase 3 documentation.

---

## References

- [Issue #153](https://github.com/banisterious/obsidian-canvas-roots/issues/153)
- [Custom Map Authoring](../../wiki-content/Custom-Map-Authoring.md)
- [Map Data Service](../developer/implementation/map-data-service.md) (if exists)

---

## Status

| Phase | Status |
|-------|--------|
| Phase 1 | Planning |
| Phase 2 | Future |
| Phase 3 | Future |
