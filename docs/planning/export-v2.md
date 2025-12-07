# Export v2: Full Entity Export

## Overview

Enhanced export functionality that includes events, sources, and places in addition to person notes. This upgrade ensures round-trip fidelity with GEDCOM Import v2 and captures the full richness of Canvas Roots data.

## Current State Analysis

### What v0.10.x Exports

All four exporters (GEDCOM 5.5.1, GEDCOM X, Gramps XML, CSV) share the same limitations:

| Entity Type | GEDCOM 5.5.1 | GEDCOM X | Gramps XML | CSV |
|-------------|--------------|----------|------------|-----|
| **Person notes** | ✅ | ✅ | ✅ | ✅ |
| **Relationships** | ✅ | ✅ | ✅ | ✅ |
| **Person birth/death** | ✅ inline | ✅ as facts | ✅ as events | ✅ columns |
| **Marriage metadata** | ✅ MARR tag | ✅ couple facts | ⚠️ limited | ⚠️ limited |
| **Event notes** | ❌ | ❌ | ❌ | ❌ |
| **Source notes** | ❌ | ❌ | ❌ | ❌ |
| **Place notes** | ❌ | ❌ | ❌ | ❌ |
| **Source citations** | ❌ | ❌ | ❌ | ❌ |
| **Place hierarchy** | ❌ | ❌ | ❌ | ❌ |

### What Gets Lost

When exporting data that was imported with GEDCOM Import v2:

1. **Event notes** - All life events (residence, education, military, religious) are not exported
2. **Source citations** - Source records and their citations to events are lost
3. **Place structure** - Place hierarchy and coordinates are not preserved
4. **Event dates/places** - Events beyond birth/death lose their date/place context

## Implementation Plan

### Phase 1: Event Export

**Goal:** Export event notes linked to persons.

#### GEDCOM 5.5.1

Events become tags under the individual:

```gedcom
0 @I1@ INDI
1 NAME John /Smith/
1 BIRT
2 DATE 15 MAR 1850
2 PLAC Dublin, Ireland
2 SOUR @S1@
3 PAGE Certificate #123
1 RESI
2 DATE FROM 1875 TO 1880
2 PLAC New York, USA
2 SOUR @S2@
1 OCCU Blacksmith
2 DATE ABT 1870
1 IMMI
2 DATE 1875
2 PLAC New York, USA
```

**Event Type Mapping (Export):**

| Canvas Roots `event_type` | GEDCOM Tag |
|---------------------------|------------|
| `birth` | `BIRT` |
| `death` | `DEAT` |
| `marriage` | `MARR` (on FAM) |
| `divorce` | `DIV` (on FAM) |
| `burial` | `BURI` |
| `cremation` | `CREM` |
| `adoption` | `ADOP` |
| `graduation` | `GRAD` |
| `retirement` | `RETI` |
| `census` | `CENS` |
| `residence` | `RESI` |
| `occupation` | `OCCU` |
| `education` | `EDUC` |
| `probate` | `PROB` |
| `will` | `WILL` |
| `naturalization` | `NATU` |
| `military` | `MILI` |
| `immigration` | `IMMI` |
| `emigration` | `EMIG` |
| `baptism` | `BAPM` |
| `christening` | `CHR` |
| `confirmation` | `CONF` |
| `first_communion` | `FCOM` |
| `ordination` | `ORDN` |
| `bar_mitzvah` | `BARM` |
| `bas_mitzvah` | `BASM` |
| `blessing` | `BLES` |
| `engagement` | `ENGA` |
| `annulment` | `ANUL` |
| `custom` | `EVEN` (with TYPE substructure) |

**Date Precision Mapping (Export):**

| Canvas Roots `date_precision` | GEDCOM Output |
|-------------------------------|---------------|
| `exact` | `15 MAR 1850` |
| `estimated` | `ABT 15 MAR 1850` |
| `before` | `BEF 15 MAR 1850` |
| `after` | `AFT 15 MAR 1850` |
| `range` | `BET 1850 AND 1855` |
| `year_only` | `1850` |
| `month_year` | `MAR 1850` |

#### GEDCOM X

Events become facts on persons:

```json
{
  "persons": [{
    "id": "P1",
    "names": [{"nameForms": [{"fullText": "John Smith"}]}],
    "facts": [
      {
        "type": "http://gedcomx.org/Birth",
        "date": {"original": "15 Mar 1850", "formal": "+1850-03-15"},
        "place": {"original": "Dublin, Ireland"},
        "sources": [{"description": "#S1"}]
      },
      {
        "type": "http://gedcomx.org/Residence",
        "date": {"original": "1875-1880", "formal": "+1875/+1880"},
        "place": {"original": "New York, USA"}
      },
      {
        "type": "http://gedcomx.org/Immigration",
        "date": {"original": "1875", "formal": "+1875"},
        "place": {"original": "New York, USA"}
      }
    ]
  }]
}
```

#### Gramps XML

Events are separate records referenced by persons:

```xml
<events>
  <event handle="_e001" id="E1">
    <type>Birth</type>
    <dateval val="1850-03-15"/>
    <place hlink="_p001"/>
    <sourceref hlink="_s001"/>
  </event>
  <event handle="_e002" id="E2">
    <type>Residence</type>
    <daterange start="1875" stop="1880"/>
    <place hlink="_p002"/>
  </event>
</events>

<people>
  <person handle="_i001" id="I1">
    <name type="Birth Name">
      <first>John</first>
      <surname>Smith</surname>
    </name>
    <eventref hlink="_e001" role="Primary"/>
    <eventref hlink="_e002" role="Primary"/>
  </person>
</people>
```

#### CSV

Events export as separate rows with event-specific columns:

```csv
Type,Person,Event Type,Date,Date Precision,Place,Source,Confidence
event,[[John Smith]],birth,1850-03-15,exact,"Dublin, Ireland",[[1850 Census]],high
event,[[John Smith]],residence,1875-1880,range,"New York, USA",,unknown
event,[[John Smith]],immigration,1875,year_only,"New York, USA",,unknown
```

**Implementation Steps:**

1. Add event collection to all exporters
2. Create event note reader service (shared)
3. Map Canvas Roots event types to format-specific tags
4. Link events to persons via `person` wikilink resolution
5. Handle family events (marriage, divorce) on FAM records

### Phase 2: Source Export

**Goal:** Export source notes and link citations to events.

#### GEDCOM 5.5.1

Sources become top-level SOUR records:

```gedcom
0 @S1@ SOUR
1 TITL 1850 US Federal Census
1 AUTH US Census Bureau
1 PUBL Ancestry.com
1 REPO @R1@
1 NOTE Digitized microfilm

0 @I1@ INDI
1 NAME John /Smith/
1 BIRT
2 DATE 15 MAR 1850
2 SOUR @S1@
3 PAGE Sheet 12, Line 5
3 QUAY 3
```

**Source Quality Mapping (Export):**

| Canvas Roots `confidence` | GEDCOM QUAY |
|---------------------------|-------------|
| `primary` | 3 |
| `secondary` | 2 |
| `derivative` | 1 |
| `unknown` | (omit QUAY) |

#### GEDCOM X

Sources become sourceDescriptions:

```json
{
  "sourceDescriptions": [{
    "id": "S1",
    "titles": [{"value": "1850 US Federal Census"}],
    "citations": [{"value": "Ancestry.com"}],
    "repository": {"resource": "#R1"}
  }],
  "persons": [{
    "facts": [{
      "type": "http://gedcomx.org/Birth",
      "sources": [{
        "description": "#S1",
        "qualifiers": [{"name": "http://gedcomx.org/Page", "value": "Sheet 12, Line 5"}]
      }]
    }]
  }]
}
```

#### Gramps XML

Sources are separate records:

```xml
<sources>
  <source handle="_s001" id="S1">
    <stitle>1850 US Federal Census</stitle>
    <sauthor>US Census Bureau</sauthor>
    <spubinfo>Ancestry.com</spubinfo>
  </source>
</sources>

<events>
  <event handle="_e001" id="E1">
    <type>Birth</type>
    <sourceref hlink="_s001">
      <spage>Sheet 12, Line 5</spage>
    </sourceref>
  </event>
</events>
```

#### CSV

Sources export as separate section or linked columns:

```csv
Type,ID,Title,Author,Publisher,Repository,Confidence
source,src_001,1850 US Federal Census,US Census Bureau,Ancestry.com,Ancestry,primary

Type,Person,Event Type,Date,Place,Source ID,Citation Detail
event,[[John Smith]],birth,1850-03-15,"Dublin, Ireland",src_001,"Sheet 12, Line 5"
```

**Implementation Steps:**

1. Add source collection to all exporters
2. Create source note reader service (shared)
3. Build source ID → export ID mapping
4. Link sources to events via `sources` array
5. Export citation details (PAGE equivalent)

### Phase 3: Place Export

**Goal:** Export place notes with hierarchy and coordinates.

#### GEDCOM 5.5.1

Places can be exported with hierarchy:

```gedcom
0 @I1@ INDI
1 BIRT
2 PLAC Dublin, Dublin County, Leinster, Ireland
3 FORM City, County, Province, Country
3 MAP
4 LATI N53.3498
4 LONG W6.2603
```

**Place Hierarchy Format:**

GEDCOM uses comma-separated hierarchy from specific to general:
`City, County, State, Country`

#### GEDCOM X

Places become placeDescriptions:

```json
{
  "places": [{
    "id": "P1",
    "names": [{"value": "Dublin"}],
    "type": "http://gedcomx.org/City",
    "latitude": 53.3498,
    "longitude": -6.2603,
    "jurisdiction": {"resource": "#P2"}
  }, {
    "id": "P2",
    "names": [{"value": "Ireland"}],
    "type": "http://gedcomx.org/Country"
  }],
  "persons": [{
    "facts": [{
      "place": {"description": "#P1"}
    }]
  }]
}
```

#### Gramps XML

Places include coordinates and hierarchy:

```xml
<places>
  <placeobj handle="_p001" id="P1" type="City">
    <ptitle>Dublin, Ireland</ptitle>
    <pname value="Dublin"/>
    <coord lat="53.3498" long="-6.2603"/>
    <placeref hlink="_p002"/>
  </placeobj>
  <placeobj handle="_p002" id="P2" type="Country">
    <ptitle>Ireland</ptitle>
    <pname value="Ireland"/>
  </placeobj>
</places>
```

#### CSV

Places export with hierarchy columns:

```csv
Type,ID,Name,Place Type,Parent,Latitude,Longitude,Category
place,place_001,Dublin,city,[[Ireland]],53.3498,-6.2603,real
place,place_002,Ireland,country,,,,real
```

**Implementation Steps:**

1. Add place collection to all exporters
2. Create place note reader service (shared)
3. Build place hierarchy (resolve parent_place wikilinks)
4. Export coordinates if available
5. Convert place wikilinks to inline hierarchy strings (GEDCOM)

### Phase 4: UI Integration

**Export Modal Enhancements:**

```
┌─────────────────────────────────────────┐
│ Export to GEDCOM                        │
├─────────────────────────────────────────┤
│ Export scope:                           │
│   ○ All people                          │
│   ○ Collection: [Smith Family ▼]        │
│   ○ Branch of: [John Smith     ] [▼]    │
│                                         │
│ Include:                                │
│   ☑ Person notes (152)                  │
│   ☑ Event notes (423)                   │
│   ☑ Source notes (45)                   │
│   ☑ Place notes (78)                    │
│                                         │
│ Privacy:                                │
│   ☑ Protect living persons              │
│   ○ Exclude from export                 │
│   ○ Anonymize (show as "[Living]")      │
│                                         │
│ Sensitive fields:                       │
│   ☑ Redact SSN/identity numbers         │
│                                         │
│ Filename: [smith_family.ged        ]    │
│                                         │
│           [Cancel]  [Export]            │
└─────────────────────────────────────────┘
```

**Progress Display:**

```
Exporting to GEDCOM...
├── Reading person notes... 152/152 ✓
├── Reading event notes... 423/423 ✓
├── Reading source notes... 45/45 ✓
├── Reading place notes... 78/78 ✓
├── Building relationships... ✓
├── Linking source citations... ✓
└── Writing GEDCOM file... ✓

Export complete!
- 152 individuals exported (3 living anonymized)
- 423 events exported
- 45 sources exported
- 78 places exported
```

## Data Flow

```
┌──────────────────────────────────────────┐
│ Canvas Roots Vault                       │
│ ├── Person notes (with cr_id)            │
│ ├── Event notes (with person wikilinks)  │
│ ├── Source notes (with cr_id)            │
│ └── Place notes (with parent_place)      │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Entity Collection Service                │
│ ├── Collect all person notes             │
│ ├── Collect linked event notes           │
│ ├── Collect linked source notes          │
│ └── Collect linked place notes           │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Relationship Builder                     │
│ ├── Build person → event links           │
│ ├── Build event → source links           │
│ ├── Build event → place links            │
│ └── Build place hierarchy                │
└──────┬───────────────────────────────────┘
       │
       ├──► GedcomExporter   → .ged
       ├──► GedcomXExporter  → .json
       ├──► GrampsExporter   → .gramps
       └──► CsvExporter      → .csv
```

## File Structure

```
src/
├── core/
│   ├── entity-collection-service.ts   # Shared entity collection
│   └── relationship-builder.ts        # Shared relationship building
├── gedcom/
│   └── gedcom-exporter.ts            # Enhanced GEDCOM 5.5.1 export
├── gedcomx/
│   └── gedcomx-exporter.ts           # Enhanced GEDCOM X export
├── gramps/
│   └── gramps-exporter.ts            # Enhanced Gramps XML export
├── csv/
│   └── csv-exporter.ts               # Enhanced CSV export
└── ui/
    └── export-modal.ts               # Enhanced export UI
```

## Sensitive Field Handling

### Fields to Redact

| Field | Condition | Action |
|-------|-----------|--------|
| `ssn` | Always | Redact from all exports |
| `identityNumber` | Always | Redact from all exports |
| Birth details | Living person | Hide or anonymize per settings |
| Place details | Living person + setting | Hide or anonymize per settings |

### Implementation

```typescript
interface SensitiveFieldConfig {
  field: string;
  redactAlways: boolean;  // SSN, identity numbers
  redactForLiving: boolean;  // Birth date, birth place
}

const SENSITIVE_FIELDS: SensitiveFieldConfig[] = [
  { field: 'ssn', redactAlways: true, redactForLiving: false },
  { field: 'identityNumber', redactAlways: true, redactForLiving: false },
  { field: 'birthDate', redactAlways: false, redactForLiving: true },
  { field: 'birthPlace', redactAlways: false, redactForLiving: true },
];
```

## Testing Strategy

### Unit Tests

- Export event types map correctly to GEDCOM/GEDCOM X/Gramps tags
- Date precision exports correctly (ABT, BEF, AFT, BET)
- Source citations link correctly to events
- Place hierarchy builds correctly
- Sensitive fields are redacted
- Privacy filtering works correctly

### Integration Tests

- Round-trip test: Import GEDCOM → Export GEDCOM → Compare
- Export all entity types from test vault
- Verify relationships preserved across export
- Check coordinate precision in place exports

### Test Files

- `test-full-export.md` - Person with all event types
- `test-sources.md` - Person with source citations
- `test-places.md` - Events with place hierarchy
- `test-privacy.md` - Living person for privacy testing

## Migration Path

For users with existing exports:

1. **New exports** will automatically include all entity types
2. **Existing workflows** remain unchanged (person-only export still works)
3. **UI defaults** will include all entities where available
4. **Settings** allow disabling event/source/place export if not needed

## Related Documentation

- [GEDCOM Import v2](gedcom-import-v2.md) - Import side implementation
- [Events & Timelines](../../wiki-content/Events-And-Timelines.md)
- [Evidence & Sources](../../wiki-content/Evidence-And-Sources.md)
- [Geographic Features](../../wiki-content/Geographic-Features.md)
- [Privacy & Security](../../wiki-content/Privacy-And-Security.md)

## References

- [GEDCOM 5.5.1 Specification](https://www.familysearch.org/developers/docs/gedcom/)
- [GEDCOM 7.0 Specification](https://gedcom.io/specifications/FamilySearchGEDCOMv7.html)
- [GEDCOM X Specification](http://www.gedcomx.org/)
- [Gramps XML DTD](https://github.com/gramps-project/gramps/blob/master/data/grampsxml.dtd)
