# Plan: DMS to Decimal Degrees Coordinate Conversion (Issue #121)

- **Status:** Implemented
- **GitHub Issue:** [#121](https://github.com/banisterious/obsidian-charted-roots/issues/121)
- **Implemented:** 2026-01-07

---

## Overview
Add opt-in DMS (degrees, minutes, seconds) parsing to coordinate input fields in the place creation modal. When enabled via settings, users can enter coordinates in either decimal or DMS format, and the system automatically detects and converts DMS to decimal.

## Feature Toggle
This feature is **opt-in** via a settings toggle:
- **Setting name**: "Accept DMS coordinate format"
- **Default**: Off (disabled)
- **Location**: Places section in settings
- **Rationale**: Keeps existing behavior unchanged for users who don't need DMS; avoids unexpected conversions

## Current Architecture

### Coordinate Flow
```
Input (create-place-modal.ts) → Storage (frontmatter) → Parsing (map-data-service.ts) → Display (map-controller.ts)
```

### Existing Coordinate Support
- **Storage formats**: Flat (`coordinates_lat`/`coordinates_long`), nested, legacy - all supported for reading
- **Input**: Only decimal degrees via `parseFloat()` in `updateCoordinates()` method
- **Geocoding**: Uses Nominatim API, returns decimal degrees
- **Maps**: Leaflet expects decimal degrees for geographic CRS

### Key Files
| File | Role |
|------|------|
| `src/ui/create-place-modal.ts` | User input, validation (~line 1151-1194) |
| `src/maps/map-data-service.ts` | Reads coordinates from frontmatter (~line 917-924) |
| `src/maps/services/geocoding-service.ts` | Nominatim API lookups |
| `src/core/place-note-writer.ts` | Writes flat coordinate properties |

## Recommended Approach: Opt-in Smart Input Parsing
Enhance existing coordinate input fields to auto-detect DMS format and convert on-the-fly when enabled. No separate dialog needed.

## Implementation Steps

### 1. Create DMS Parser Utility
**File**: `src/utils/coordinate-converter.ts` (new)

```typescript
// Core functions:
parseDMSCoordinate(input: string): { decimal: number; isDMS: boolean } | null
parseLatitude(input: string): number | null
parseLongitude(input: string): number | null
formatDecimal(value: number, precision?: number): string
```

**DMS Formats to Support**:
- `33°51'08"N` or `33°51'08"S`
- `83°37'06"W` or `83°37'06"E`
- `33 51 08 N` (space-separated)
- `33-51-08-N` (hyphen-separated)
- `33.8522` (pass-through decimal)
- `+33.8522` or `-83.6183` (signed decimal)
- `N 33 51 08` (direction prefix)

**Conversion formula**: `DD = D + M/60 + S/3600`

**Validation**:
- Latitude: -90 to 90
- Longitude: -180 to 180
- Minutes: 0 to 59
- Seconds: 0 to 59.999

### 2. Add Settings Toggle
**File**: `src/settings.ts`

**Changes**:
- Add `enableDMSCoordinates: boolean` setting (default: `false`)
- Add toggle in Places section: "Accept DMS coordinate format"
- Description: "Allow entering coordinates in degrees, minutes, seconds format (e.g., 33°51'08\"N)"

### 3. Integrate into Create Place Modal
**File**: `src/ui/create-place-modal.ts`

**Changes to `updateCoordinates()` method** (~line 1154):
- Check if `settings.enableDMSCoordinates` is true
- If enabled, attempt DMS parse before falling back to parseFloat
- If DMS detected, convert to decimal and update field
- If disabled, use existing decimal-only behavior

**UI Enhancements** (when DMS enabled):
- Update placeholder text: `"33.8522 or 33°51'08\"N"`
- Add helper text below coordinate inputs showing accepted formats
- Optional: Show converted value below input when DMS is entered

### 4. Add Unit Tests
**File**: `tests/coordinate-converter.test.ts` (new)

Test cases:
- Various DMS formats (symbols, spaces, hyphens)
- Direction indicators (N/S/E/W, +/-)
- Edge cases (0°, 180°, -90°)
- Invalid inputs (out of range, malformed)
- Decimal pass-through

## Key Files

| File | Action | Purpose |
|------|--------|---------|
| `src/utils/coordinate-converter.ts` | Create | DMS parsing logic |
| `src/settings.ts` | Modify | Add `enableDMSCoordinates` setting and toggle |
| `src/ui/create-place-modal.ts` | Modify | Integrate parser into coordinate inputs (when enabled) |
| `tests/coordinate-converter.test.ts` | Create | Unit tests for parser |

## Edge Cases to Handle

1. **Mixed formats**: User enters "33.5°N" - partial DMS
2. **Whitespace variations**: Leading/trailing spaces, multiple spaces
3. **Unicode vs ASCII**: `°` (degree sign) vs `o` (letter o)
4. **Case insensitivity**: "n", "N", "north" for direction
5. **Negative DMS**: `-33°51'08"` without direction letter

## Out of Scope
- Displaying coordinates in DMS format (storage remains decimal)
- Converting existing decimal coordinates to DMS for display
- Coordinate system conversions (WGS84, UTM, etc.)
- Changes to map-data-service.ts parsing (already flexible enough)
- Changes to geocoding-service.ts (returns decimal from API)

## Future Considerations
- Could add DMS parsing to `map-data-service.ts` `parseCoordinate()` method for reading DMS from frontmatter
- Could extend to bulk import tools if users paste DMS coordinates from spreadsheets
