# Plan: Partial Date Support (Issue #172)

- **Status:** Planning
- **GitHub Issue:** [#172](https://github.com/banisterious/obsidian-charted-roots/issues/172)
- **GitHub Discussion:** [#170](https://github.com/banisterious/obsidian-charted-roots/discussions/170)

---

## Overview

Preserve date precision throughout the plugin instead of normalizing partial dates to full ISO format. Currently `1850` becomes `1850-01-01`, adding false precision. Users need to distinguish between "born January 1, 1850" and "born sometime in 1850".

## Current Behavior

### Normalization Points

| Location | File | Function | Behavior |
|----------|------|----------|----------|
| GEDCOM import | `gedcom-parser.ts:443` | `gedcomDateToISO()` | `1850` → `1850-01-01` |

**Note:** Codebase exploration (Jan 2026) confirmed that UI modals (`create-person-modal.ts`, `create-event-modal.ts`, etc.) do **not** normalize dates on save—they store raw user input. The normalization problem is isolated to `gedcomDateToISO()`.

### Parser Architecture

The v2 parser (`gedcom-parser-v2.ts`) is the active importer. It:
- Captures `dateRaw` (original GEDCOM string) and `datePrecision` in `GedcomEvent`
- Delegates to `GedcomParser.gedcomDateToISO()` for the `date` field
- **However**, the importer (`gedcom-importer-v2.ts`) only uses the normalized `date` field, not `dateRaw`

This means the raw date is parsed but discarded during import.

### GEDCOM Date Formats

| Format | Example | Current Storage | Desired Storage |
|--------|---------|-----------------|-----------------|
| Year only | `1850` | `1850-01-01` | `1850` |
| Month + year | `MAR 1855` | `1855-03-01` | `1855-03` |
| Full date | `15 MAR 1855` | `1855-03-15` | `1855-03-15` |
| Approximate | `ABT 1878` | `1878-01-01` | `ABT 1878` |
| Before | `BEF 1950` | `1950-01-01` | `BEF 1950` |
| After | `AFT 1880` | `1880-01-01` | `AFT 1880` |
| Range | `BET 1882 AND 1885` | unclear | `BET 1882 AND 1885` |
| Calculated | `CAL 1945` | `1945-01-01` | `CAL 1945` |
| Estimated | `EST 1880` | `1880-01-01` | `EST 1880` |

### Downstream Handling

`DateService.extractStandardYear()` already handles partial dates correctly:
- Extracts year from `1850`, `ABT 1878`, `BET 1882 AND 1885`, etc.
- Sets `isApproximate` flag for qualified dates
- Used by age calculation, timeline sorting, display
- For date ranges (`BET X AND Y`), uses the **earlier year** for sorting

The problem is upstream (storage), not downstream (usage).

### Sorting Behavior

Timeline and canvas sorting (in `timeline-canvas-exporter.ts` and `timeline-generator.ts`) use:
1. `extractSortDate()` which normalizes partial dates to `YYYY-01-01` for consistent ordering
2. ISO string comparison (`localeCompare`) for chronological order

**Current behavior for qualified dates:**
- `BEF 1950` sorts the same as `1950` (both become `1950-01-01`)
- `AFT 1950` sorts the same as `1950`
- `BET 1850 AND 1860` sorts as `1850`

This is acceptable but could be refined (see Future Enhancements).

## Proposed Solution

### Storage Format Decision

**Hybrid approach (Recommended)**

Combine the best of both options:

```yaml
born: "1850"           # Year only - preserve as-is
died: "1920-03"        # Month + year - use ISO partial (not "MAR 1920")
married: "ABT 1875"    # Qualified dates - preserve GEDCOM vocabulary
event: "1905-06-15"    # Full dates - ISO format (unchanged)
```

**Rationale:**
- **Year only:** `1850` is unambiguous, no conversion needed
- **Month + year:** Use `YYYY-MM` (ISO partial) rather than `MAR YYYY` because:
  - Sorts correctly as string
  - `extractSortDate()` already handles this format
  - More consistent with full ISO dates
  - External tools can parse it
- **Qualifiers:** Preserve `ABT`, `BEF`, `AFT`, `CAL`, `EST`, `BET...AND` vocabulary
  - Maintains source fidelity
  - DateService already parses these
  - GEDCOM round-trip works naturally
- **Full dates:** Keep `YYYY-MM-DD` (no change)

## Implementation Plan

### Phase 1: GEDCOM Import (Primary Focus)

This is the only phase requiring code changes. UI modals already preserve raw input.

#### 1.1 Modify `gedcomDateToISO()`

**File:** `src/gedcom/gedcom-parser.ts:443`

Current behavior:
```typescript
// Year only → fabricates month/day
if (match3) {
    return `${match3[1]}-01-01`;
}
```

New behavior:
```typescript
// Year only → preserve as-is
if (match3) {
    return match3[1];
}
```

Full changes:
- Year only (`1850`) → return `1850`
- Month + year (`MAR 1855`) → return `1855-03` (ISO partial)
- Full date (`15 MAR 1855`) → return `1855-03-15` (unchanged)
- Qualifiers (`ABT`, `BEF`, `AFT`, `CAL`, `EST`) → preserve prefix with normalized date
  - `ABT MAR 1855` → `ABT 1855-03`
  - `BEF 1950` → `BEF 1950`
- Ranges (`BET X AND Y`) → preserve as-is

#### 1.2 Rename Function

Rename `gedcomDateToISO()` to `normalizeGedcomDate()` since output is no longer strictly ISO. Update call sites:
- `gedcom-parser-v2.ts:57-58` (static method delegation)
- `gedcom-parser-v2.ts:607, 609, 612, 753, 755, 758` (internal calls)
- `gedcom-importer-v2.ts:688-689` (birth/death date conversion)

#### 1.3 Alternative: Use `dateRaw` Directly

The v2 parser already captures `dateRaw`. An alternative implementation:
- Modify importer to use `dateRaw` instead of calling `gedcomDateToISO()`
- Only normalize month names to ISO partial format (`MAR 1855` → `1855-03`)
- This avoids changing the shared function

**Recommendation:** Modify `gedcomDateToISO()` directly—it's cleaner and fixes all call sites.

### Phase 2: UI Modals (No Changes Needed)

~~Audit date fields in modals~~

**Finding:** Codebase exploration confirmed modals already store raw user input without normalization. No changes required.

Optional enhancement: Update placeholder text to document accepted formats:
```
"YYYY, YYYY-MM, YYYY-MM-DD, or ABT/BEF/AFT YYYY"
```

### Phase 3: Display Formatting

#### 3.1 Review Display Points

Check how dates are displayed throughout UI:
- Person cards/lists
- Event lists
- Timeline blocks
- Interactive family chart
- Statistics/reports

#### 3.2 Format for Display

`DateService.formatDate()` already returns raw string for standard dates. May want to prettify:
- `ABT 1878` → "c. 1878" or "about 1878"
- `BEF 1950` → "before 1950"
- `AFT 1880` → "after 1880"
- `BET 1882 AND 1885` → "1882–1885"

This is optional polish - raw strings are acceptable.

### Phase 4: Export Round-Trip

#### 4.1 GEDCOM Export

Verify dates export correctly:
- `1850` → `2 DATE 1850`
- `1855-03` → `2 DATE MAR 1855`
- `1855-03-15` → `2 DATE 15 MAR 1855`
- `ABT 1878` → `2 DATE ABT 1878`
- `ABT 1855-03` → `2 DATE ABT MAR 1855`
- `BET 1882 AND 1885` → `2 DATE BET 1882 AND 1885`

#### 4.2 Other Exporters

Review Gramps, CSV, GedcomX exporters for date handling.

## Test Cases

### Test File

`tests/fixtures/gedcom/gedcom-sample-small-year-only.ged`

### Expected Results After Import

| Person | GEDCOM Date | Expected Frontmatter |
|--------|-------------|----------------------|
| John Smith | `1850` | `born: "1850"` |
| Mary Jones | `MAR 1855` | `born: "1855-03"` |
| William Smith | `ABT 1878` | `born: "ABT 1878"` |
| Elizabeth Smith | `AFT 1880` | `born: "AFT 1880"` |
| Thomas Smith | `BET 1882 AND 1885` | `born: "BET 1882 AND 1885"` |
| Sarah Brown | `EST 1880` | `born: "EST 1880"` |
| Robert Smith | `15 JUN 1905` | `born: "1905-06-15"` |
| Margaret Smith | `JUL 1908` | `born: "1908-07"` |
| Anne Smith | `ABT MAR 1875` | `born: "ABT 1875-03"` |

### Unit Tests

Add tests to verify:
- `DateService.parseDate()` handles all formats
- `DateService.extractStandardYear()` extracts years correctly
- `DateService.isApproximateDate()` detects qualifiers
- Age calculation works with partial dates
- Timeline sorting works with partial dates

## Key Files

| File | Action | Purpose |
|------|--------|---------|
| `src/gedcom/gedcom-parser.ts` | **Modify** | Change `gedcomDateToISO()` to preserve precision |
| `src/gedcom/gedcom-parser-v2.ts` | Update refs | Update method name if renamed |
| `src/gedcom/gedcom-importer-v2.ts` | Update refs | Update method name if renamed |
| `src/dates/services/date-service.ts` | Verify | Confirm handles all formats (likely no changes) |
| `tests/fixtures/gedcom/gedcom-sample-small-year-only.ged` | Create | Test file with partial dates |

**Files confirmed to need NO changes:**
- `src/ui/create-person-modal.ts` - already stores raw input
- `src/ui/create-event-modal.ts` - already stores raw input
- `src/ui/edit-event-modal.ts` - already stores raw input
- `src/events/services/timeline-canvas-exporter.ts` - internal normalization for sorting is correct

## Edge Cases

1. **Empty month/day in ISO format**: User enters `1850-00-00` - treat as year-only
2. **Mixed formats in same vault**: Some notes have `1850-01-01`, others have `1850` - both should work
3. **Manual frontmatter edits**: User changes `1850-01-01` to `1850` - should be preserved
4. **BCE dates**: `500 BCE` or `-500` - ensure year extraction works
5. **Date ranges with qualifiers**: `ABT BET 1880 AND 1885` - unlikely but handle gracefully

## Migration Considerations

- No migration needed for existing vaults
- Users who want to clean up fabricated dates can manually edit frontmatter
- Could offer a data quality check: "Dates that may have false precision (January 1)" - but this risks false positives for people actually born on January 1

## Future Enhancements

These are not required for the initial implementation but could improve date handling:

### Refined Sorting for BEF/AFT

Currently `BEF 1950` and `AFT 1950` both sort as `1950-01-01`. Consider:
- `BEF 1950` → sort as `1949-12-31`
- `AFT 1950` → sort as `1950-01-02`

This would place "before" events slightly earlier and "after" events slightly later in timelines.

### Semantic Qualifier Preservation

Currently all qualifiers (ABT, BEF, AFT, CAL, EST) map to `datePrecision: 'estimated'` in `DateService`. A future enhancement could:
- Add a `dateQualifier` field to preserve the specific qualifier
- Display different indicators for "about" vs "before" vs "calculated"

### Display Formatting

Prettify qualified dates for display:
- `ABT 1878` → "c. 1878" or "about 1878"
- `BEF 1950` → "before 1950"
- `AFT 1880` → "after 1880"
- `BET 1882 AND 1885` → "1882–1885"

## Out of Scope

- Date picker UI (complex, would require partial date picker)
- Displaying precision indicators in UI (e.g., "~" icon for approximate dates)
- Automated migration of existing `YYYY-01-01` dates to `YYYY`
- Supporting non-Gregorian calendars (separate feature)

## References

- [GEDCOM 5.5.1 Date Specification](https://www.gedcom.org/gedcom.html)
- DateService: `src/dates/services/date-service.ts`
- Test file: `tests/fixtures/gedcom/gedcom-sample-small-year-only.ged`
