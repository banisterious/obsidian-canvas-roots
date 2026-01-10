# Export v2: Full Entity Export

## Overview

Enhanced export functionality that includes events, sources, places, and media in addition to person notes. This upgrade ensures round-trip fidelity with GEDCOM Import v2 and captures the full richness of Charted Roots data.

**Supported Export Formats:**
- GEDCOM 5.5.1 (legacy compatibility)
- GEDCOM 7.0 (modern, with embedded media support)
- GEDCOM X (JSON format)
- Gramps XML
- CSV

## Current State Analysis

### What v0.10.x Exports

All four current exporters (GEDCOM 5.5.1, GEDCOM X, Gramps XML, CSV) share the same limitations:

| Entity Type | GEDCOM 5.5.1 | GEDCOM 7.0 | GEDCOM X | Gramps XML | CSV |
|-------------|--------------|------------|----------|------------|-----|
| **Person notes** | ✅ | ❌ (new) | ✅ | ✅ | ✅ |
| **Relationships** | ✅ | ❌ (new) | ✅ | ✅ | ✅ |
| **Person birth/death** | ✅ inline | ❌ (new) | ✅ as facts | ✅ as events | ✅ columns |
| **Marriage metadata** | ✅ MARR tag | ❌ (new) | ✅ couple facts | ⚠️ limited | ⚠️ limited |
| **Event notes** | ❌ | ❌ (new) | ❌ | ❌ | ❌ |
| **Source notes** | ❌ | ❌ (new) | ❌ | ❌ | ❌ |
| **Place notes** | ❌ | ❌ (new) | ❌ | ❌ | ❌ |
| **Source citations** | ❌ | ❌ (new) | ❌ | ❌ | ❌ |
| **Place hierarchy** | ❌ | ❌ (new) | ❌ | ❌ | ❌ |
| **Media files** | ❌ | ❌ (new) | ❌ | ❌ | ❌ |

### What Gets Lost

When exporting data that was imported with GEDCOM Import v2:

1. **Event notes** - All life events (residence, education, military, religious) are not exported
2. **Source citations** - Source records and their citations to events are lost
3. **Place structure** - Place hierarchy and coordinates are not preserved
4. **Event dates/places** - Events beyond birth/death lose their date/place context
5. **Media files** - Linked images, documents, and recordings are not included

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

| Charted Roots `event_type` | GEDCOM Tag |
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

#### GEDCOM 7.0

GEDCOM 7.0 uses similar structure but with enhanced features:

```gedcom
0 HEAD
1 GEDC
2 VERS 7.0
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
2 DATE ~1870
1 IMMI
2 DATE 1875
2 PLAC New York, USA
```

**GEDCOM 7.0 Date Improvements:**
- Simplified date modifiers (`~` for approximate instead of `ABT`)
- Better range support with `FROM...TO` and `BET...AND`
- Full ISO 8601 date support

**Date Precision Mapping (Export):**

| Charted Roots `date_precision` | GEDCOM Output |
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
3. Map Charted Roots event types to format-specific tags
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

#### GEDCOM 7.0

GEDCOM 7.0 sources support multimedia objects directly:

```gedcom
0 @S1@ SOUR
1 TITL 1850 US Federal Census
1 AUTH US Census Bureau
1 PUBL Ancestry.com
1 REPO @R1@
1 NOTE Digitized microfilm
1 OBJE @M1@

0 @M1@ OBJE
1 FILE media/1850_census_page12.jpg
2 FORM image/jpeg
2 TITL Census Page 12

0 @I1@ INDI
1 NAME John /Smith/
1 BIRT
2 DATE 15 MAR 1850
2 SOUR @S1@
3 PAGE Sheet 12, Line 5
```

**Source Quality Mapping (Export):**

| Charted Roots `confidence` | GEDCOM QUAY |
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

#### GEDCOM 7.0

GEDCOM 7.0 introduces formal place records that can be referenced:

```gedcom
0 @P1@ _PLAC
1 NAME Dublin
1 TYPE City
1 MAP
2 LATI N53.3498
2 LONG W6.2603
1 _PLAC @P2@

0 @P2@ _PLAC
1 NAME Ireland
1 TYPE Country

0 @I1@ INDI
1 BIRT
2 DATE 15 MAR 1850
2 PLAC @P1@
```

**Note:** GEDCOM 7.0's place record handling is still evolving. We'll monitor the specification and implement according to best practices.

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

**Goal:** Enhance the export UI with statistics preview, format selection, progress modal, and improved user experience.

#### 4.1 Export Statistics Preview

Before exporting, show a real-time summary of what will be included. Updates dynamically as filters change.

```
┌─────────────────────────────────────────┐
│ Export Preview                          │
├─────────────────────────────────────────┤
│ Based on current filters:               │
│                                         │
│ • 152 people (3 living will be hidden)  │
│ • 287 relationships                     │
│ • 423 events                            │
│ • 45 sources                            │
│ • 78 places                             │
│ • 47 media files (156 MB)               │
│                                         │
│ Estimated export size: ~2.3 MB          │
│ (+ 156 MB if media bundled)             │
└─────────────────────────────────────────┘
```

**Implementation:**
- Calculate counts when export card renders
- Recalculate on filter changes (collection, branch, privacy)
- Show warning if counts seem low (possible filter issue)
- Disable export button if 0 people selected

#### 4.2 Format Version Selection

For GEDCOM exports, allow users to choose between versions:

```
┌─────────────────────────────────────────┐
│ GEDCOM Version                          │
├─────────────────────────────────────────┤
│ ○ GEDCOM 5.5.1 (Legacy)                 │
│   Maximum compatibility with older      │
│   software. Limited media support.      │
│                                         │
│ ● GEDCOM 7.0 (Recommended)              │
│   Modern format with full media         │
│   embedding. Best for Gramps, RootsMagic│
└─────────────────────────────────────────┘
```

**Implementation:**
- Default to 7.0 for new exports
- Remember user's last choice in settings
- Show compatibility notes for each version
- GEDCOM 7.0 enables additional media options

#### 4.3 Entity Inclusion Checkboxes

Allow granular control over what's exported:

```
┌─────────────────────────────────────────┐
│ Include in Export                       │
├─────────────────────────────────────────┤
│ ☑ Person notes          152             │
│ ☑ Event notes           423             │
│ ☑ Source notes          45              │
│ ☑ Place notes           78              │
│ ☑ Media files           47 (156 MB)     │
│                                         │
│ ⚠ Unchecking sources will remove        │
│   citation links from events            │
└─────────────────────────────────────────┘
```

**Implementation:**
- All enabled by default
- Show dependency warnings (sources → citations)
- Counts update based on collection/branch filters
- Media checkbox only enabled for GEDCOM 7.0 or bundled ZIP

#### 4.4 Output Location Options

Choose where the export file is saved:

```
┌─────────────────────────────────────────┐
│ Output Location                         │
├─────────────────────────────────────────┤
│ ● Download to system                    │
│   Save to your Downloads folder         │
│                                         │
│ ○ Save to vault                         │
│   Save in: [exports/            ]       │
│   Useful for backup and versioning      │
│                                         │
│ ○ Both                                  │
│   Download and save to vault            │
└─────────────────────────────────────────┘
```

**Implementation:**
- Default to "Download to system" (current behavior)
- "Save to vault" creates `exports/` folder if needed
- Remember preference in settings
- Vault saves use consistent naming: `{filename}_{date}.{ext}`

#### 4.5 Last Export Info

Show information about previous exports from this vault:

```
┌─────────────────────────────────────────┐
│ Export History                          │
├─────────────────────────────────────────┤
│ Last export: smith-family.ged           │
│ Date: Dec 5, 2025 at 2:34 PM            │
│ Format: GEDCOM 7.0                      │
│ Contents: 148 people, 412 events        │
│                                         │
│ [View export log]                       │
└─────────────────────────────────────────┘
```

**Implementation:**
- Store export history in plugin data (last 10 exports)
- Track: filename, date, format, counts, duration
- "View export log" opens detailed history modal
- Helps users verify exports and track changes

#### 4.6 Export Progress Modal

Full-screen modal with detailed progress, similar to GEDCOM Import modal:

```
┌─────────────────────────────────────────────────────────────┐
│                    Exporting to GEDCOM 7.0                  │
│                                                             │
│  ████████████████████████████░░░░░░░░░░  75%               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✓ Reading person notes              152/152         │   │
│  │ ✓ Reading event notes               423/423         │   │
│  │ ✓ Reading source notes              45/45           │   │
│  │ ● Reading place notes               62/78           │   │
│  │ ○ Building relationships                            │   │
│  │ ○ Linking source citations                          │   │
│  │ ○ Collecting media files                            │   │
│  │ ○ Writing GEDCOM 7.0 file                           │   │
│  │ ○ Creating ZIP archive                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Elapsed: 0:12  │  Estimated remaining: 0:04               │
│                                                             │
│                        [Cancel]                             │
└─────────────────────────────────────────────────────────────┘
```

**After completion:**

```
┌─────────────────────────────────────────────────────────────┐
│                     Export Complete ✓                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Summary                          │   │
│  │                                                     │   │
│  │  People exported:      152 (3 living anonymized)   │   │
│  │  Events exported:      423                         │   │
│  │  Sources exported:     45                          │   │
│  │  Places exported:      78                          │   │
│  │  Media files:          47 (156 MB)                 │   │
│  │  Relationships:        287                         │   │
│  │                                                     │   │
│  │  Output file:          smith_family_export.zip     │   │
│  │  File size:            158.3 MB                    │   │
│  │  Duration:             0:16                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⚠ 2 warnings during export                                │
│  [View details]                                            │
│                                                             │
│              [Export Another]  [Close]                      │
└─────────────────────────────────────────────────────────────┘
```

**With errors:**

```
┌─────────────────────────────────────────────────────────────┐
│                   Export Completed with Errors              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⚠ 3 media files could not be found:                │   │
│  │   • attachments/census/missing_file.jpg            │   │
│  │   • attachments/photos/old_portrait.png            │   │
│  │   • attachments/docs/will_scan.pdf                 │   │
│  │                                                     │   │
│  │ These files are referenced in source notes but     │   │
│  │ were not found in the vault. Export continued      │   │
│  │ without them.                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│              [Export Another]  [Close]                      │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Reuse modal patterns from `gedcom-import-progress-modal.ts`
- Real-time progress updates via callbacks
- Cancel support with cleanup (delete partial files)
- Error aggregation with expandable details
- "Export Another" resets to export card

#### 4.7 Consolidated Export Card UI

Refactor the four export cards to share common UI components:

**Current state:** ~400 lines of duplicate code across GEDCOM, GEDCOM X, Gramps, CSV export cards.

**Proposed refactor:**

```typescript
// Shared export options component
class ExportOptionsBuilder {
  // Collection filter dropdown
  addCollectionFilter(container: HTMLElement): void;

  // Branch filter (person picker + direction)
  addBranchFilter(container: HTMLElement): void;

  // Privacy override settings
  addPrivacyOptions(container: HTMLElement): void;

  // Entity inclusion checkboxes
  addEntityCheckboxes(container: HTMLElement): void;

  // Export statistics preview
  addStatisticsPreview(container: HTMLElement): void;

  // Output location options
  addOutputLocationOptions(container: HTMLElement): void;

  // File name input
  addFileNameInput(container: HTMLElement, extension: string): void;
}

// Usage in each export card
private renderGedcomExport(container: HTMLElement): void {
  const builder = new ExportOptionsBuilder(this.plugin);

  // GEDCOM-specific: version selector
  builder.addVersionSelector(content, ['5.5.1', '7.0']);

  // Shared options
  builder.addCollectionFilter(content);
  builder.addBranchFilter(content);
  builder.addEntityCheckboxes(content);
  builder.addStatisticsPreview(content);
  builder.addPrivacyOptions(content);
  builder.addOutputLocationOptions(content);
  builder.addFileNameInput(content, '.ged');
}
```

**Benefits:**
- Consistent UI across all export formats
- Single place to add new options
- Easier testing and maintenance
- ~300 lines of code reduction

#### Complete Export Card Mockup

```
┌─────────────────────────────────────────────────────────────┐
│ Export GEDCOM                                         [?]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Export your family tree data to GEDCOM format for sharing   │
│ with other genealogy software.                              │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ GEDCOM Version                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ○ GEDCOM 5.5.1 (Legacy) - Maximum compatibility        │ │
│ │ ● GEDCOM 7.0 (Recommended) - Full media support        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Export Scope                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Collection: [All people            ▼]                  │ │
│ │                                                         │ │
│ │ Branch filter: [Select person...   ]                   │ │
│ │ Direction:     [No branch filter   ▼]                  │ │
│ │ □ Include spouses of descendants                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Include in Export                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ☑ Person notes          152                            │ │
│ │ ☑ Event notes           423                            │ │
│ │ ☑ Source notes          45                             │ │
│ │ ☑ Place notes           78                             │ │
│ │ ☑ Media files           47 (156 MB)                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Media Handling (GEDCOM 7.0 only)                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ○ Skip media                                           │ │
│ │ ○ Reference only (paths in file)                       │ │
│ │ ● Bundle in ZIP archive                                │ │
│ │                                                         │ │
│ │ Organization: [Organize by type    ▼]                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Privacy                                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ □ Override privacy settings                            │ │
│ │   ☑ Enable privacy protection                          │ │
│ │   Format: [Anonymize as "Living"   ▼]                  │ │
│ │                                                         │ │
│ │ 3 of 152 people will be anonymized (living)            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Output                                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Location: [Download to system      ▼]                  │ │
│ │ Filename: [smith_family            ]                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Export Preview                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 152 people • 423 events • 45 sources • 78 places       │ │
│ │ 47 media files (156 MB) • Est. size: ~158 MB           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Last export: smith-family.ged (Dec 5, 2025)                 │
│                                                             │
│                              [Export to GEDCOM 7.0]         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
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

### Phase 5: Media Export

**Goal:** Export media files (images, documents, audio, video) with proper linking to sources and persons. Support bundled ZIP export for complete data portability.

#### Export Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Reference Only** | Export file paths as references | User manages files separately |
| **Bundled ZIP** | Include all media in ZIP archive | Complete portable export |
| **Skip Media** | Exclude all media references | Minimal export |

#### Bundled ZIP Structure

```
export_smith_family.zip
├── smith_family.ged          # or .json, .gramps, .csv
├── manifest.json             # Media inventory and checksums
└── media/
    ├── images/
    │   ├── 1850_census_page12.jpg
    │   ├── marriage_certificate.png
    │   └── portrait_john_smith.jpg
    ├── documents/
    │   ├── will_1892.pdf
    │   └── naturalization_papers.pdf
    └── audio/
        └── interview_grandma_1985.mp3
```

#### Manifest File

The manifest provides a complete inventory of bundled media:

```json
{
  "version": "1.0",
  "created": "2024-01-15T10:30:00Z",
  "generator": "Charted Roots v0.11.0",
  "format": "GEDCOM 7.0",
  "media": [
    {
      "id": "M1",
      "originalPath": "attachments/census/1850_census_page12.jpg",
      "exportPath": "media/images/1850_census_page12.jpg",
      "mimeType": "image/jpeg",
      "size": 245678,
      "checksum": "sha256:abc123...",
      "linkedTo": [
        {"type": "source", "id": "S1", "title": "1850 US Federal Census"}
      ]
    },
    {
      "id": "M2",
      "originalPath": "attachments/documents/will_1892.pdf",
      "exportPath": "media/documents/will_1892.pdf",
      "mimeType": "application/pdf",
      "size": 1234567,
      "checksum": "sha256:def456...",
      "linkedTo": [
        {"type": "event", "id": "E45", "eventType": "probate"},
        {"type": "source", "id": "S12", "title": "Last Will and Testament"}
      ]
    }
  ],
  "statistics": {
    "totalFiles": 47,
    "totalSize": 156789012,
    "byType": {
      "image/jpeg": 32,
      "image/png": 8,
      "application/pdf": 5,
      "audio/mpeg": 2
    }
  }
}
```

#### Format-Specific Media Handling

##### GEDCOM 7.0 (Preferred for Media)

GEDCOM 7.0 natively supports embedded media with MIME types:

```gedcom
0 HEAD
1 GEDC
2 VERS 7.0

0 @M1@ OBJE
1 FILE media/images/1850_census_page12.jpg
2 FORM image/jpeg
2 TITL 1850 Census - John Smith household
2 _SIZE 245678
1 NOTE Page 12, Household #45

0 @S1@ SOUR
1 TITL 1850 US Federal Census
1 OBJE @M1@
```

##### GEDCOM 5.5.1

GEDCOM 5.5.1 has limited media support:

```gedcom
0 @M1@ OBJE
1 FILE media/images/1850_census_page12.jpg
1 FORM JPEG
1 TITL 1850 Census - John Smith household

0 @S1@ SOUR
1 TITL 1850 US Federal Census
1 OBJE @M1@
```

##### GEDCOM X

Media as sourceDescriptions with artifact type:

```json
{
  "sourceDescriptions": [
    {
      "id": "M1",
      "resourceType": "http://gedcomx.org/DigitalArtifact",
      "about": "media/images/1850_census_page12.jpg",
      "titles": [{"value": "1850 Census - John Smith household"}],
      "mediaType": "image/jpeg"
    },
    {
      "id": "S1",
      "titles": [{"value": "1850 US Federal Census"}],
      "sources": [{"description": "#M1"}]
    }
  ]
}
```

##### Gramps XML

Gramps has robust media object support:

```xml
<objects>
  <object handle="_m001" id="M1">
    <file src="media/images/1850_census_page12.jpg"
          mime="image/jpeg"
          checksum="abc123..."
          description="1850 Census - John Smith household"/>
  </object>
</objects>

<sources>
  <source handle="_s001" id="S1">
    <stitle>1850 US Federal Census</stitle>
    <objref hlink="_m001"/>
  </source>
</sources>
```

##### CSV

Media exported as separate rows or reference columns:

```csv
Type,ID,Original Path,Export Path,MIME Type,Size,Linked Sources,Linked Events
media,M1,attachments/census/1850_census_page12.jpg,media/images/1850_census_page12.jpg,image/jpeg,245678,S1,
media,M2,attachments/documents/will_1892.pdf,media/documents/will_1892.pdf,application/pdf,1234567,S12,E45
```

#### Media Organization Options

| Option | Description |
|--------|-------------|
| **Preserve vault structure** | Keep original folder hierarchy |
| **Flatten** | All files in single `media/` folder |
| **Organize by type** | Separate folders for images, documents, audio |
| **Organize by entity** | Folders per person or source |

#### Supported Media Types

| Category | Extensions | MIME Types |
|----------|------------|------------|
| **Images** | jpg, jpeg, png, gif, tiff, webp | image/* |
| **Documents** | pdf | application/pdf |
| **Audio** | mp3, wav, m4a, ogg | audio/* |
| **Video** | mp4, mov, webm | video/* |

#### Implementation Steps

1. **Media Discovery Service**
   - Scan source notes for `media` field wikilinks
   - Scan source notes for embedded images (`![[image.jpg]]`)
   - Build media → entity relationship map

2. **Media Collection**
   - Resolve wikilinks to actual file paths
   - Verify files exist and are readable
   - Calculate checksums for manifest

3. **ZIP Bundle Creation**
   - Create temporary directory structure
   - Copy media files with optional reorganization
   - Generate manifest.json
   - Write genealogy data file
   - Create ZIP archive

4. **Format-Specific OBJE Records**
   - GEDCOM 7.0: Full OBJE records with MIME types
   - GEDCOM 5.5.1: Limited OBJE with FORM
   - GEDCOM X: sourceDescriptions with artifact type
   - Gramps: objects with full metadata
   - CSV: media reference rows

5. **Progress Tracking**
   - File copy progress for large media sets
   - Estimated time remaining
   - Skip/retry for inaccessible files

#### UI Enhancements for Media

```
┌─────────────────────────────────────────┐
│ Export to GEDCOM 7.0                    │
├─────────────────────────────────────────┤
│ Export scope:                           │
│   ○ All people                          │
│   ○ Collection: [Smith Family ▼]        │
│                                         │
│ Include:                                │
│   ☑ Person notes (152)                  │
│   ☑ Event notes (423)                   │
│   ☑ Source notes (45)                   │
│   ☑ Place notes (78)                    │
│   ☑ Media files (47)                    │
│                                         │
│ Media handling:                         │
│   ○ Skip media                          │
│   ○ Reference only (paths in file)      │
│   ● Bundle in ZIP archive               │
│                                         │
│ Media organization:                     │
│   ● Organize by type                    │
│   ○ Preserve vault structure            │
│   ○ Flatten to single folder            │
│                                         │
│ Privacy:                                │
│   ☑ Protect living persons              │
│                                         │
│ Filename: [smith_family            ]    │
│                                         │
│           [Cancel]  [Export]            │
└─────────────────────────────────────────┘
```

#### Progress Display with Media

```
Exporting to GEDCOM 7.0...
├── Reading person notes... 152/152 ✓
├── Reading event notes... 423/423 ✓
├── Reading source notes... 45/45 ✓
├── Reading place notes... 78/78 ✓
├── Collecting media files... 47/47 ✓
├── Building relationships... ✓
├── Linking source citations... ✓
├── Copying media files... 47/47 (156 MB) ✓
├── Generating manifest... ✓
├── Writing GEDCOM 7.0 file... ✓
└── Creating ZIP archive... ✓

Export complete!
- 152 individuals exported (3 living anonymized)
- 423 events exported
- 45 sources exported
- 78 places exported
- 47 media files bundled (156 MB)
- Output: smith_family_export.zip
```

## Data Flow

```
┌──────────────────────────────────────────┐
│ Charted Roots Vault                       │
│ ├── Person notes (with cr_id)            │
│ ├── Event notes (with person wikilinks)  │
│ ├── Source notes (with cr_id + media)    │
│ ├── Place notes (with parent_place)      │
│ └── Media files (images, documents, etc) │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Entity Collection Service                │
│ ├── Collect all person notes             │
│ ├── Collect linked event notes           │
│ ├── Collect linked source notes          │
│ ├── Collect linked place notes           │
│ └── Discover linked media files          │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Relationship Builder                     │
│ ├── Build person → event links           │
│ ├── Build event → source links           │
│ ├── Build event → place links            │
│ ├── Build source → media links           │
│ └── Build place hierarchy                │
└──────┬───────────────────────────────────┘
       │
       ├──► Gedcom551Exporter → .ged (5.5.1)
       ├──► Gedcom7Exporter   → .ged (7.0)
       ├──► GedcomXExporter   → .json
       ├──► GrampsExporter    → .gramps
       └──► CsvExporter       → .csv
       │
       ▼ (if bundled export)
┌──────────────────────────────────────────┐
│ ZIP Bundle Service                       │
│ ├── Copy media files                     │
│ ├── Generate manifest.json               │
│ └── Create ZIP archive                   │
└──────────────────────────────────────────┘
```

## File Structure

```
src/
├── core/
│   ├── entity-collection-service.ts   # Shared entity collection
│   ├── relationship-builder.ts        # Shared relationship building
│   ├── media-discovery-service.ts     # Media file discovery and linking
│   ├── zip-bundle-service.ts          # ZIP archive creation
│   └── export-history-service.ts      # Track export history in plugin data
├── gedcom/
│   ├── gedcom-exporter.ts             # Enhanced GEDCOM 5.5.1 export
│   └── gedcom7-exporter.ts            # New GEDCOM 7.0 export
├── gedcomx/
│   └── gedcomx-exporter.ts            # Enhanced GEDCOM X export
├── gramps/
│   └── gramps-exporter.ts             # Enhanced Gramps XML export
├── csv/
│   └── csv-exporter.ts                # Enhanced CSV export
└── ui/
    ├── export-options-builder.ts      # Shared export card UI components
    ├── export-progress-modal.ts       # Full-screen progress modal
    ├── export-results-modal.ts        # Export completion summary
    └── export-history-modal.ts        # View past exports
```

## Phase 5: Property & Value Alias Integration

**Goal:** Ensure exporters correctly handle property aliases and value aliases when reading note data.

### Problem Statement

Charted Roots v0.9.3+ allows users to configure custom property names (property aliases) and custom property values (value aliases). Exporters must respect these configurations when reading note frontmatter.

**Example scenarios:**
- User has `dob` aliased to canonical `born` property
- User has `M` aliased to canonical `male` sex value
- User has `hometown` aliased to canonical `birth_place` property

Without alias resolution, the exporter would miss these fields entirely.

### Property Alias Resolution

All exporters must use the `PropertyAliasService` to resolve property names when reading frontmatter.

**Current approach (problematic):**
```typescript
const birthDate = frontmatter.born || frontmatter.birth_date;
const sex = frontmatter.sex || frontmatter.gender;
```

**Correct approach:**
```typescript
const propertyService = this.plugin.propertyAliasService;
const birthDate = propertyService.resolve(frontmatter, 'born');
const sex = propertyService.resolve(frontmatter, 'sex');
```

The `PropertyAliasService.resolve()` method:
1. Checks the canonical property name first
2. Checks configured aliases second
3. Returns `undefined` if neither found

**Implementation checklist:**
- [ ] Update GEDCOM 5.5.1 exporter to use `PropertyAliasService.resolve()`
- [ ] Update GEDCOM 7.0 exporter to use `PropertyAliasService.resolve()`
- [ ] Update GEDCOM X exporter to use `PropertyAliasService.resolve()`
- [ ] Update Gramps XML exporter to use `PropertyAliasService.resolve()`
- [ ] Update CSV exporter to use `PropertyAliasService.resolve()`
- [ ] Add unit tests for alias resolution in each exporter

### Value Alias Resolution

All exporters must use the `ValueAliasService` to resolve property values before exporting.

**Supported value alias fields:**
- `event_type` (13 canonical values)
- `sex` (4 canonical values: male, female, nonbinary, unknown)
- `place_category` (6 canonical values)
- `note_type` (8 canonical values)

**Example:**
```typescript
const valueService = this.plugin.valueAliasService;

// Read raw sex value from frontmatter (might be aliased)
const rawSex = propertyService.resolve(frontmatter, 'sex');

// Resolve to canonical value
const canonicalSex = valueService.resolveAlias('sex', rawSex);
// "M" → "male", "F" → "female", etc.

// Map canonical value to GEDCOM tag
const gedcomSex = this.mapSexToGedcom(canonicalSex);
// "male" → "M", "female" → "F"
```

**Sex Value Mapping (Export):**

| User Value | Value Alias → | Canonical Value | GEDCOM Output |
|------------|---------------|-----------------|---------------|
| `M` | (built-in) | `male` | `M` |
| `F` | (built-in) | `female` | `F` |
| `nb` | (built-in) | `nonbinary` | `U` (unknown) |
| `unknown` | (no alias) | `unknown` | `U` |
| Custom (via schema) | (user config) | Varies | `U` or NOTE |

**Event Type Mapping:**

Similar approach for `event_type` - resolve alias first, then map canonical value to format-specific tag.

**Implementation checklist:**
- [ ] Add `ValueAliasService.resolveAlias()` calls for sex values
- [ ] Add `ValueAliasService.resolveAlias()` calls for event_type values
- [ ] Add `ValueAliasService.resolveAlias()` calls for place_category values
- [ ] Handle unrecognized values gracefully (map to "unknown" or add NOTE)
- [ ] Add unit tests for value alias resolution

## Phase 6: Gender Identity Field Handling

**Goal:** Export the new `gender_identity` field added in v0.10.20.

### Problem Statement

The `gender_identity` field is distinct from biological `sex` and represents a person's gender identity. GEDCOM 5.5.1/7.0 have no standard field for this concept.

**Export strategy:**

#### GEDCOM 5.5.1 & 7.0

Export `gender_identity` as a custom fact with NOTE:

```gedcom
0 @I1@ INDI
1 NAME Jane /Doe/
1 SEX F
1 EVEN
2 TYPE Gender Identity
2 DATE 2020
2 NOTE Identifies as nonbinary
```

Or as inline NOTE under the individual:

```gedcom
0 @I1@ INDI
1 NAME Jane /Doe/
1 SEX F
1 NOTE Gender identity: nonbinary
```

**Recommendation:** Use EVEN with TYPE for structured data that importing software can parse.

#### GEDCOM X

GEDCOM X supports custom fact types:

```json
{
  "persons": [{
    "facts": [
      {
        "type": "http://customontology.org/GenderIdentity",
        "value": "nonbinary"
      }
    ]
  }]
}
```

#### Gramps XML

Gramps supports attributes:

```xml
<person>
  <attribute type="Gender Identity" value="nonbinary"/>
</person>
```

#### CSV

Add `gender_identity` column:

```csv
Type,Name,Sex,Gender Identity
person,Jane Doe,female,nonbinary
```

**Implementation checklist:**
- [ ] Add `gender_identity` export to GEDCOM 5.5.1 (as EVEN or NOTE)
- [ ] Add `gender_identity` export to GEDCOM 7.0 (as EVEN or NOTE)
- [ ] Add `gender_identity` export to GEDCOM X (as custom fact)
- [ ] Add `gender_identity` export to Gramps XML (as attribute)
- [ ] Add `gender_identity` column to CSV export
- [ ] Add setting to control gender_identity export format (EVEN vs NOTE vs skip)
- [ ] Document `gender_identity` export behavior in wiki

### Privacy Considerations

The `gender_identity` field may be sensitive information. Add privacy controls:

**Setting:** `exportGenderIdentity`
- `always` - Export for all persons
- `deceased_only` - Only export for deceased persons
- `never` - Never export gender_identity field

Default: `always` (respects user's choice to include the field)

## Phase 7: Organization & Custom Relationship Export

**Goal:** Export organization notes and custom relationship types (both added in v0.7.0).

### Organization Notes

Organizations could map to:
- **GEDCOM 5.5.1/7.0:** NOTE records or SOUR records (if organization is a repository)
- **GEDCOM X:** `organizations` array (part of spec)
- **Gramps XML:** No direct equivalent (could use custom XML)
- **CSV:** Separate `organization` rows

**Export strategy:**

#### GEDCOM 5.5.1/7.0

For organizations that are repositories (archives, libraries):

```gedcom
0 @R1@ REPO
1 NAME National Archives
1 ADDR
2 ADDR 700 Pennsylvania Avenue NW
2 CITY Washington
2 STAE DC
2 POST 20408
2 CTRY USA
```

For other organizations, use NOTE:

```gedcom
0 @N1@ NOTE
1 CONT Organization: Freemasons Lodge #42
1 CONT Type: Fraternal Organization
1 CONT Founded: 1850
```

#### GEDCOM X

Full organization support:

```json
{
  "organizations": [{
    "id": "O1",
    "names": [{"value": "Freemasons Lodge #42"}],
    "type": "http://gedcomx.org/FraternalOrganization"
  }],
  "persons": [{
    "id": "P1",
    "facts": [{
      "type": "http://gedcomx.org/Membership",
      "value": "Member",
      "qualifiers": [{
        "name": "http://gedcomx.org/Organization",
        "value": "#O1"
      }]
    }]
  }]
}
```

#### CSV

Add organization rows:

```csv
Type,ID,Name,Type,Founded
organization,org_001,Freemasons Lodge #42,fraternal,1850
```

**Implementation decision needed:**
- Export organizations in v1, or defer to future version?
- If exported, which formats get full support?

### Custom Relationship Types

Custom relationships (godparent, mentor, rival, etc.) could map to:
- **GEDCOM 5.5.1/7.0:** ASSO (association) records
- **GEDCOM X:** Relationship facts with custom types
- **Gramps XML:** Association records
- **CSV:** Separate relationship rows

**Example GEDCOM:**

```gedcom
0 @I1@ INDI
1 NAME John /Smith/
1 ASSO @I2@
2 TYPE Godfather
2 RELA Godson
```

**Implementation decision needed:**
- Export custom relationships in v1, or defer?
- How to handle bidirectional relationships?

## Phase 8: Fictional Calendar System Support

**Goal:** Handle fictional date systems in exports (Calendarium integration pending).

### Problem Statement

Charted Roots supports fictional calendar systems via the `date_system` field. When exporting fictional dates, we need to preserve:
1. The original fictional date string
2. The calendar system name
3. (Optional) Gregorian equivalent if available

### Export Strategies

#### GEDCOM 5.5.1/7.0

Use custom tags or NOTE:

```gedcom
1 EVEN Custom Event
2 TYPE Festival
2 _FDATE 15 Fireseek, 592 CY
2 _FCAL Greyhawk Calendar
2 NOTE Fictional date: 15 Fireseek, 592 CY (Greyhawk Calendar)
```

Or approximate with Gregorian:

```gedcom
1 EVEN Festival
2 DATE ABT 592
2 NOTE Fictional date: 15 Fireseek, 592 CY (Greyhawk Calendar)
```

#### GEDCOM X

Use custom qualifiers:

```json
{
  "facts": [{
    "date": {
      "original": "15 Fireseek, 592 CY",
      "formal": "+0592"
    },
    "qualifiers": [
      {"name": "http://customontology.org/CalendarSystem", "value": "Greyhawk Calendar"},
      {"name": "http://customontology.org/FictionalDate", "value": "true"}
    ]
  }]
}
```

#### CSV

Include calendar system column:

```csv
Type,Event,Date,Date System,Date Precision
event,Festival,15 Fireseek 592 CY,Greyhawk Calendar,exact
```

**Implementation decision:**
- How to handle fictional dates when importing software doesn't support them?
- Should we require Gregorian equivalents for export?
- Should this be optional (skip fictional events if no Gregorian date)?

**Setting:** `fictionalDateExportMode`
- `include_with_note` - Export with calendar system in NOTE
- `approximate_gregorian` - Convert to approximate Gregorian date
- `skip` - Skip events with fictional dates

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

- Export event types map correctly to GEDCOM 5.5.1/7.0/GEDCOM X/Gramps tags
- Date precision exports correctly (ABT, BEF, AFT, BET for 5.5.1; ~ for 7.0)
- Source citations link correctly to events
- Place hierarchy builds correctly
- Sensitive fields are redacted
- Privacy filtering works correctly
- Media MIME types detected correctly
- Manifest JSON validates against schema

### Integration Tests

- Round-trip test: Import GEDCOM → Export GEDCOM → Compare
- Export all entity types from test vault
- Verify relationships preserved across export
- Check coordinate precision in place exports
- GEDCOM 7.0 validates against official schema
- ZIP bundle extracts correctly with valid manifest
- Media files preserved with correct checksums

### Media Export Tests

- Media discovery finds all linked files
- Missing media files handled gracefully
- Large media sets export without memory issues
- ZIP compression works correctly
- Manifest checksums match actual files
- Media organization options work correctly

### Test Files

- `test-full-export.md` - Person with all event types
- `test-sources.md` - Person with source citations
- `test-places.md` - Events with place hierarchy
- `test-privacy.md` - Living person for privacy testing
- `test-media.md` - Source with linked media files
- `test-large-media/` - Directory with large/many media files

## Implementation Priority & Scope

### v1 Core Features (Phases 1-4)

**Must-have for initial release:**
- ✅ Phase 1: Event Export
- ✅ Phase 2: Source Export
- ✅ Phase 3: Place Export
- ✅ Phase 4: UI Integration (progress modal, statistics preview, entity checkboxes)
- ✅ Phase 5: Property & Value Alias Integration (CRITICAL - required for correctness)
- ✅ Phase 6: Gender Identity Field Handling (simple, just added in v0.10.20)

### v1.1 Extended Features (Phases 7-8)

**Nice-to-have, can be deferred:**
- ✅ Phase 7: Custom Relationship Export **COMPLETE**
  - ✅ Custom relationships exported via GEDCOM ASSO records
  - ✅ Toggle option in GEDCOM export settings (enabled by default)
  - ✅ Includes all relationship categories (family, legal, religious, professional, social, feudal)
  - ✅ Date ranges exported in NOTE subrecords
  - ✅ Only defined relationships exported (not inferred bidirectional ones)
  - ⚠️ Organization export: **Defer to v1.1** (genealogists rarely need this)
- ⚠️ Phase 8: Fictional Calendar System Support
  - Decision: **Defer to v1.1** (Calendarium integration not yet complete)
  - Workaround: Export fictional dates as-is in NOTE fields for now

### Critical Path for v1

1. ✅ Implement PropertyAliasService integration (Phase 5) - **COMPLETE**
2. ✅ Implement ValueAliasService integration (Phase 5) - **COMPLETE**
3. ✅ Implement core entity export (Phases 1-3) - **COMPLETE**
4. ✅ Implement UI enhancements (Phase 4) - **COMPLETE**
5. ✅ Add gender_identity export (Phase 6) - **COMPLETE**
6. ✅ Add custom relationships via ASSO (Phase 7 partial) - **COMPLETE**

**Status: Export v2 COMPLETE**

All core phases (1-6) and custom relationships (Phase 7 partial) are now complete. Organizations and fictional calendar system support deferred to v1.1.

## Migration Path

For users with existing exports:

1. **New exports** will automatically include all entity types
2. **Existing workflows** remain unchanged (person-only export still works)
3. **UI defaults** will include all entities where available
4. **Settings** allow disabling event/source/place/media export if not needed
5. **GEDCOM 7.0** recommended for users migrating to Gramps or other modern software
6. **Bundled ZIP** recommended when media files need to transfer with the data

## Summary of Additions

This plan update adds critical missing pieces:

### Phase 5: Property & Value Alias Integration ⚠️ **CRITICAL**
- **Why:** Without this, exporters will miss user-configured property names and values
- **Impact:** All 5 exporters (GEDCOM 5.5.1, 7.0, GEDCOM X, Gramps, CSV)
- **Complexity:** Medium (systematic but straightforward)
- **Priority:** **BLOCKING** - must be in v1

### Phase 6: Gender Identity Field Handling
- **Why:** New field added in v0.10.20, should be exported
- **Impact:** All 5 exporters
- **Complexity:** Low (simple NOTE/EVEN or attribute)
- **Priority:** High - should be in v1

### Phase 7: Organization & Custom Relationship Export
- **Why:** Features added in v0.7.0, currently not exported
- **Impact:** GEDCOM X has full support, others use NOTE/ASSO
- **Complexity:** Medium-High (organizations complex, relationships simple)
- **Priority:** Medium - custom relationships in v1, organizations defer to v1.1

### Phase 8: Fictional Calendar System Support
- **Why:** Fictional dates exist in system but export poorly
- **Impact:** Worldbuilder persona primarily affected
- **Complexity:** Medium (depends on Calendarium integration)
- **Priority:** Low - defer to v1.1, use NOTE workaround for now

## Related Documentation

- [GEDCOM Import v2](gedcom-import-v2.md) - Import side implementation
- [Events & Timelines](https://github.com/banisterious/obsidian-charted-roots/wiki/Events-And-Timelines)
- [Evidence & Sources](https://github.com/banisterious/obsidian-charted-roots/wiki/Evidence-And-Sources)
- [Geographic Features](https://github.com/banisterious/obsidian-charted-roots/wiki/Geographic-Features)
- [Privacy & Security](https://github.com/banisterious/obsidian-charted-roots/wiki/Privacy-And-Security)

## References

- [GEDCOM 5.5.1 Specification](https://www.familysearch.org/developers/docs/gedcom/)
- [GEDCOM 7.0 Specification](https://gedcom.io/specifications/FamilySearchGEDCOMv7.html)
- [GEDCOM X Specification](http://www.gedcomx.org/)
- [Gramps XML DTD](https://github.com/gramps-project/gramps/blob/master/data/grampsxml.dtd)
