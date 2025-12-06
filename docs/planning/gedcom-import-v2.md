# GEDCOM Import v2

## Overview

Enhanced GEDCOM import that creates source notes, event notes, and place notes in addition to person notes. This upgrade captures the full richness of GEDCOM data and integrates with Canvas Roots' existing entity types.

## Current State Analysis

### What v0.6.0 Imports

| GEDCOM Record | Captured | Storage |
|---------------|----------|---------|
| `@I1@ INDI` (Individual) | ✅ | Person note |
| `NAME`, `GIVN`, `SURN` | ✅ | `name` property |
| `SEX` | ✅ | `gender` property |
| `BIRT DATE` | ✅ | `birthDate` property (flat string) |
| `BIRT PLAC` | ✅ | `birthPlace` property (flat string) |
| `DEAT DATE` | ✅ | `deathDate` property (flat string) |
| `DEAT PLAC` | ✅ | `deathPlace` property (flat string) |
| `OCCU` | ✅ | `occupation` property |
| `FAMC`, `FAMS` | ✅ | Relationship links |
| `@F1@ FAM` (Family) | ✅ | Relationship processing |
| `MARR DATE/PLAC` | ⚠️ | Parsed but not stored as event |

### What v0.6.0 Ignores

| GEDCOM Record | Type | Notes |
|---------------|------|-------|
| `@S1@ SOUR` | Source definition | Top-level source records |
| `SOUR @S1@` | Source citation | Citations on facts |
| `RESI` | Residence event | Extended event |
| `BURI` | Burial event | Extended event |
| `EDUC` | Education event | Extended event |
| `MILI` | Military event | Extended event |
| `IMMI` | Immigration event | Extended event |
| `EMIG` | Emigration event | Extended event |
| `NATU` | Naturalization event | Extended event |
| `BAPM` | Baptism event | Religious event |
| `CHR` | Christening event | Religious event |
| `CONF` | Confirmation event | Religious event |
| `ORDN` | Ordination event | Religious event |
| `DIV` | Divorce event | Core event |
| `NOTE` | Notes | General notes |
| `OBJE` | Media objects | Images/documents |

## Implementation Plan

### Phase 1: Event Import

**Goal:** Create event notes for all individual and family events.

**GEDCOM Event Tag Mapping:**

| GEDCOM Tag | Canvas Roots `event_type` | Category | Notes |
|------------|---------------------------|----------|-------|
| **Core Events** ||||
| `BIRT` | `birth` | Core | |
| `DEAT` | `death` | Core | |
| `MARR` | `marriage` | Core | Family event |
| `DIV` | `divorce` | Core | Family event |
| **Life Events** ||||
| `BURI` | `burial` | Life | |
| `CREM` | `cremation` | Life | Alternative to burial |
| `ADOP` | `adoption` | Life | |
| `GRAD` | `graduation` | Life | Education milestone |
| `RETI` | `retirement` | Life | Career milestone |
| `CENS` | `census` | Life | Very common in genealogy |
| **Career/Residence** ||||
| `RESI` | `residence` | Career | |
| `OCCU` | `occupation` | Career | |
| `EDUC` | `education` | Career | |
| **Legal/Estate** ||||
| `PROB` | `probate` | Legal | Estate/legal event |
| `WILL` | `will` | Legal | Estate/legal event |
| `NATU` | `naturalization` | Legal | Citizenship |
| `MILI` | `military` | Legal | Military service |
| **Migration** ||||
| `IMMI` | `immigration` | Migration | Arrival |
| `EMIG` | `emigration` | Migration | Departure |
| **Religious** ||||
| `BAPM` | `baptism` | Religious | |
| `CHR` | `christening` | Religious | Infant baptism |
| `CHRA` | `adult_christening` | Religious | Adult baptism |
| `CONF` | `confirmation` | Religious | |
| `FCOM` | `first_communion` | Religious | Catholic milestone |
| `ORDN` | `ordination` | Religious | |
| `BARM` | `bar_mitzvah` | Religious | Jewish milestone |
| `BASM` | `bas_mitzvah` | Religious | Jewish milestone |
| `BLES` | `blessing` | Religious | |
| **Family Events** ||||
| `ENGA` | `engagement` | Family | Pre-marriage |
| `MARB` | `marriage_bann` | Family | Pre-marriage announcement |
| `MARC` | `marriage_contract` | Family | Legal document |
| `MARL` | `marriage_license` | Family | Legal document |
| `MARS` | `marriage_settlement` | Family | Financial arrangement |
| `ANUL` | `annulment` | Family | Marriage dissolution |
| `DIVF` | `divorce_filed` | Family | Legal process start |

**Person Attribute Tag Mapping:**

These are stored as properties on the person note, not as separate event notes.

| GEDCOM Tag | Canvas Roots Property | Notes |
|------------|----------------------|-------|
| `DSCR` | `physicalDescription` | Physical description |
| `IDNO` | `identityNumber` | ID number ⚠️ Sensitive |
| `NATI` | `nationality` | Nationality |
| `RELI` | `religion` | Religious affiliation |
| `TITL` | `title` | Nobility/professional title |
| `PROP` | `property` | Property ownership |
| `CAST` | `caste` | Social classification |
| `NCHI` | `childrenCount` | Number of children |
| `NMR` | `marriageCount` | Number of marriages |
| `SSN` | `ssn` | Social security number ⚠️ Sensitive |

⚠️ **Sensitive Fields:** Properties marked "Sensitive" contain personal identification information. These are imported for genealogical completeness but are automatically redacted from exports. See [Sensitive Field Redaction](../../wiki-content/Roadmap.md#sensitive-field-redaction) for details.

**Date Precision Mapping:**

| GEDCOM Modifier | Canvas Roots `date_precision` |
|-----------------|-------------------------------|
| (none) | `exact` |
| `ABT` | `estimated` |
| `BEF` | `estimated` (with note) |
| `AFT` | `estimated` (with note) |
| `BET...AND` | `range` (use `date` and `date_end`) |
| `CAL` | `estimated` |
| `EST` | `estimated` |

**Implementation Steps:**

1. Extend `GedcomParser` to parse all event tags
2. Create `GedcomEvent` interface with date, place, sources
3. Extend `GedcomImporter` to create event notes
4. Generate event titles: "{Event Type} of {Person Name}" or custom format
5. Link events to person via `person` wikilink
6. Handle family events (marriage, divorce) with `persons` array

**Event Note Schema:**

```yaml
type: event
cr_id: "evt_birth_john_smith_1850"
title: "Birth of John Smith"
event_type: birth
date: 1850-03-15
date_precision: exact
person: "[[John Smith]]"
place: "Dublin, Ireland"  # String initially, then wikilink if place notes created
sources: []  # Populated in Phase 2
confidence: unknown
description: "Imported from GEDCOM"
```

### Phase 2: Source Import

**Goal:** Create source notes from GEDCOM `@S1@ SOUR` records and link citations.

**GEDCOM Source Structure:**

```gedcom
0 @S1@ SOUR
1 TITL 1850 US Federal Census
1 AUTH US Census Bureau
1 PUBL Ancestry.com
1 REPO @R1@ REPO
1 NOTE Enumeration district 45

0 @I1@ INDI
1 NAME John /Smith/
1 BIRT
2 DATE 15 MAR 1850
2 PLAC Dublin, Ireland
2 SOUR @S1@
3 PAGE Sheet 12, Line 5
3 QUAY 3
```

**Source Note Schema:**

```yaml
type: source
cr_id: "src_1850_census"
title: "1850 US Federal Census"
source_type: census  # Inferred from title or manual
author: "US Census Bureau"
publisher: "Ancestry.com"
repository: "[[Ancestry]]"  # If REPO notes created
confidence: high  # From QUAY if present
citation_detail: ""  # PAGE goes here on event citations
```

**Implementation Steps:**

1. Parse `SOUR` records in `GedcomParser`
2. Create `GedcomSource` interface
3. Create source notes during import
4. Track source ID → note path mapping
5. When parsing event citations, add to event's `sources` array
6. Include `citation_detail` for PAGE information

**Source Quality Mapping (QUAY):**

| GEDCOM QUAY | Canvas Roots `source_quality` |
|-------------|-------------------------------|
| 0 | `derivative` (unreliable) |
| 1 | `secondary` (questionable) |
| 2 | `secondary` (secondary evidence) |
| 3 | `primary` (direct/primary evidence) |

### Phase 3: Place Import

**Goal:** Create place notes from unique places and convert strings to wikilinks.

**GEDCOM Place Hierarchy:**

GEDCOM places are typically formatted as:
`City, County, State, Country`

Example: `Dublin, Dublin County, Leinster, Ireland`

**Place Note Schema:**

```yaml
type: place
cr_id: "place_dublin_ireland"
name: "Dublin"
place_type: city
parent_place: "[[Dublin County, Ireland]]"  # If creating hierarchy
country: "Ireland"
coordinates_lat: 53.3498
coordinates_long: -6.2603
category: real
```

**Implementation Steps:**

1. Collect all unique place strings during parsing
2. Deduplicate (case-insensitive, trim whitespace)
3. Parse hierarchy: split by comma, create parent chain
4. User option: flat (all places in one folder) vs. nested (country/state/city)
5. Create place notes
6. Update person notes: replace `birthPlace`/`deathPlace` strings with wikilinks
7. Update event notes: replace `place` strings with wikilinks

**Place Deduplication:**

```typescript
// Normalize place string for comparison
function normalizePlaceString(place: string): string {
  return place
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/,\s*/g, ', ');
}

// Example: "Dublin,  Ireland" → "dublin, ireland"
```

**Geocoding (Optional):**

- Use Nominatim API (OpenStreetMap) for geocoding
- Rate-limited (1 request/second per OSM policy)
- Store coordinates in `coordinates_lat`, `coordinates_long`
- Only geocode if user enables option

### Phase 4: UI Integration

**Import Modal Enhancements:**

```
┌─────────────────────────────────────────┐
│ Import GEDCOM                           │
├─────────────────────────────────────────┤
│ File: [family.ged]              [Browse]│
│                                         │
│ ☑ Create person notes                   │
│ ☑ Create event notes                    │
│ ☑ Create source notes                   │
│ ☑ Create place notes                    │
│                                         │
│ Place hierarchy: [Flat ▼]               │
│   ○ Flat (all in Places folder)         │
│   ○ Nested (Country/State/City folders) │
│                                         │
│ ☐ Attempt geocoding (slow)              │
│                                         │
│ Staging folder: [Canvas Roots/Staging]  │
│                                         │
│ Preview:                                │
│   152 individuals → person notes        │
│   89 families → marriage events         │
│   423 events → event notes              │
│   45 sources → source notes             │
│   78 unique places → place notes        │
│                                         │
│           [Cancel]  [Import]            │
└─────────────────────────────────────────┘
```

**Progress Display:**

```
Importing GEDCOM...
├── Creating person notes... 152/152 ✓
├── Creating event notes... 423/423 ✓
├── Creating source notes... 45/45 ✓
├── Creating place notes... 78/78 ✓
├── Linking sources to events... ✓
└── Converting place strings to wikilinks... ✓

Import complete!
- 152 person notes created
- 423 event notes created
- 45 source notes created
- 78 place notes created
```

## Data Flow

```
┌──────────────┐
│ GEDCOM File  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ GedcomParser │ Parse all records
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Parsed Data                              │
│ ├── individuals: GedcomIndividual[]      │
│ ├── families: GedcomFamily[]             │
│ ├── sources: GedcomSource[]              │
│ ├── events: GedcomEvent[]                │
│ └── places: Set<string>                  │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────┐
│ GedcomImporter   │
└──────┬───────────┘
       │
       ├──► Create source notes (first - need IDs)
       │
       ├──► Create place notes (second - need IDs)
       │
       ├──► Create person notes (third - link to places)
       │
       └──► Create event notes (fourth - link to persons, places, sources)
```

## File Structure

```
src/gedcom/
├── gedcom-parser.ts          # Parsing logic
├── gedcom-importer.ts        # Import orchestration
├── types/
│   ├── gedcom-types.ts       # Type definitions
│   └── gedcom-mappings.ts    # Tag → type mappings
├── services/
│   ├── source-import-service.ts
│   ├── event-import-service.ts
│   ├── place-import-service.ts
│   └── geocoding-service.ts  # Optional geocoding
└── ui/
    └── import-modal.ts       # Enhanced modal
```

## Testing Strategy

### Unit Tests

- Parse individual GEDCOM tags correctly
- Map GEDCOM event types to Canvas Roots types
- Handle date modifiers (ABT, BEF, AFT, BET)
- Normalize and deduplicate place strings
- Generate valid cr_id values

### Integration Tests

- Import sample GEDCOM with all entity types
- Verify wikilinks are created correctly
- Check source citations link to events
- Validate place hierarchy creation

### Test GEDCOM Files

- `test-minimal.ged` - Single individual, no events
- `test-events.ged` - Individual with all event types
- `test-sources.ged` - Full source citations
- `test-places.ged` - Various place formats
- `test-large.ged` - 500+ individuals for performance testing

## Migration Path

For users with existing imports:

1. **Option A:** Re-import with new settings
   - Use staging folder to avoid conflicts
   - Manually merge or replace existing notes

2. **Option B:** Use Data Enhancement Pass
   - See [data-enhancement-pass.md](data-enhancement-pass.md)
   - Creates events/places from existing person note data
   - Preserves existing cr_id values

## Related Documentation

- [Roadmap: GEDCOM Import v2](../../wiki-content/Roadmap.md#gedcom-import-v2)
- [Roadmap: Data Enhancement Pass](../../wiki-content/Roadmap.md#data-enhancement-pass)
- [Events & Timelines](../../wiki-content/Events-And-Timelines.md)
- [Evidence & Sources](../../wiki-content/Evidence-And-Sources.md)
- [Geographic Features](../../wiki-content/Geographic-Features.md)

## References

- [GEDCOM 5.5.1 Specification](https://www.familysearch.org/developers/docs/gedcom/)
- [GEDCOM 7.0 Specification](https://gedcom.io/specifications/FamilySearchGEDCOMv7.html)
- [Nominatim API](https://nominatim.org/release-docs/latest/api/Overview/)
