# Import & Export

Canvas Roots supports importing and exporting family data in GEDCOM, Gramps XML, and CSV formats through guided step-by-step wizards.

## Table of Contents

- [Import/Export Hub](#importexport-hub)
  - [Opening the Hub](#opening-the-hub)
  - [Import Wizard](#import-wizard)
  - [Export Wizard](#export-wizard)
- [GEDCOM Import/Export](#gedcom-importexport)
  - [Importing a GEDCOM File](#importing-a-gedcom-file)
  - [After Import](#after-import)
  - [Duplicate Handling](#duplicate-handling)
  - [Exporting to GEDCOM](#exporting-to-gedcom)
  - [Privacy Protection for Export](#privacy-protection-for-export)
- [Gramps XML Import](#gramps-xml-import)
  - [Supported File Formats](#supported-file-formats)
  - [Importing a Gramps File](#importing-a-gramps-file)
  - [What Gets Created](#what-gets-created)
  - [Place Linking](#place-linking)
  - [Supported Event Types](#supported-event-types)
  - [Notes Import](#notes-import)
  - [Limitations](#limitations)
- [CSV Import/Export](#csv-importexport)
  - [Importing from CSV/TSV](#importing-from-csvtsv)
  - [Exporting to CSV](#exporting-to-csv)
  - [Format Comparison](#format-comparison)
- [Selective Branch Export](#selective-branch-export)

---

## Import/Export Hub

The Import/Export Hub provides a centralized entry point for all data import and export operations through guided wizards.

### Opening the Hub

| Method | How |
|--------|-----|
| **Control Center** | Click **Import/Export** in the Tools group |
| **Dashboard** | Click the **Import** quick action tile |
| **Command Palette** | `Ctrl/Cmd+P` → "Canvas Roots: Open Import/Export Hub" |

The hub displays two cards:
- **Import** — Launch the 7-step import wizard
- **Export** — Launch the 6-step export wizard

### Import Wizard

The import wizard guides you through 7 steps:

| Step | Purpose |
|------|---------|
| **1. Format** | Select GEDCOM 5.5.1, GEDCOM X (JSON), Gramps XML/.gpkg, or CSV |
| **2. File** | Drag-and-drop or click to select your import file |
| **3. Options** | Configure entity types, target folder, conflict handling, dynamic blocks |
| **4. Preview** | Review entity counts and duplicate warnings |
| **5. Import** | Watch progress with real-time log |
| **6. Numbering** | Optional reference numbering (Ahnentafel, d'Aboville, Henry, Generation) |
| **7. Complete** | Summary with quick actions |

**Key Features:**

- **Dynamic blocks toggle** — Enable or disable dynamic content blocks in imported notes
- **Integrated numbering** — Apply reference numbers immediately after import without leaving the wizard
- **Gramps media extraction** — `.gpkg` packages automatically extract embedded media files

### Export Wizard

The export wizard guides you through 6 steps:

| Step | Purpose |
|------|---------|
| **1. Format** | Select GEDCOM 5.5.1 (other formats coming soon) |
| **2. Folders** | Choose preference folders or specify custom folders |
| **3. Options** | Configure privacy controls and entity inclusions |
| **4. Preview** | Review entity counts and privacy summary |
| **5. Export** | Watch progress with real-time log |
| **6. Complete** | Download or save options |

**Privacy Controls:**

- **Exclude living persons** — Completely omit people without death dates born after threshold year
- **Redact living persons** — Include structure but replace personal details with "[Living]"
- **Birth year threshold** — Configure how recent a birth date triggers living person protection

**Entity Inclusions:**

Toggle which entity types to include in the export:
- Sources and citations
- Places with hierarchy
- Notes and annotations

## GEDCOM Import/Export

Canvas Roots provides full round-trip support for GEDCOM 5.5.1 format, allowing you to import family trees from popular genealogy software and export your Obsidian data back to GEDCOM format.

### Importing a GEDCOM File

**Using the Import Wizard:**
1. Open the Import/Export Hub (see [Opening the Hub](#opening-the-hub))
2. Click the **Import** card
3. Select **GEDCOM 5.5.1** format
4. Drag and drop your `.ged` file or click to browse
5. Configure import options:
   - **Entity types** — People, events, sources, places (toggle each on/off)
   - **Target folder** — Where to create notes
   - **Conflict handling** — Skip, overwrite, or merge duplicates
   - **Dynamic blocks** — Enable/disable dynamic content blocks
6. Review the preview showing entity counts and any warnings
7. Click **Import** to begin
8. Optionally apply reference numbering in Step 6
9. Review summary and use quick actions to open imported notes

**Data Quality Preview:**

Before any files are created, Canvas Roots analyzes the GEDCOM data and shows a quality preview modal if issues or place name variants are detected. This allows you to:

- **Review detected issues** organized by category:
  - **Dates**: Death before birth, future dates, events before birth/after death
  - **Relationships**: Gender/role mismatches, parent younger than child
  - **References**: Orphan references to non-existent records
  - **Data**: Missing names, unknown sex, no dates recorded

- **Standardize place name variants** before import:
  - Choose canonical forms for country names (e.g., "USA" vs "United States of America")
  - Standardize state abbreviations (e.g., "CA" vs "California")
  - Your choices affect both file names and frontmatter property values

- **Decide how to proceed**:
  - Click "Proceed with import" to apply your choices and continue
  - Click "Cancel" to abort without creating any files

This preview step ensures consistent data from the start, avoiding cleanup work after import.

**Progress Indicator:**

During import, a modal shows:
- Current phase (validating, parsing, places, sources, people, relationships, events)
- Progress bar with current/total count
- Running statistics (places, sources, people, events created)

**What Gets Created:**

| Note Type | What's Created |
|-----------|----------------|
| **People** | One note per individual with relationships, dates, places |
| **Events** | One note per life event (birth, death, marriage, etc.) linked to person |
| **Sources** | One note per GEDCOM source record with citation metadata |
| **Places** | Hierarchical place notes (city → county → state → country) |

**Supported GEDCOM Tags:**

*Individuals:*
- `INDI` - Individuals → person notes
- `NAME` - Person names
- `BIRT`/`DEAT` - Birth and death → event notes
- `DATE` - Event dates (with precision: `ABT`, `BEF`, `AFT`, `BET`)
- `PLAC` - Event locations → place wikilinks
- `FAMC`/`FAMS` - Family relationships
- `SEX` - Gender
- `_UUID` - Preserved as `cr_id`

*Events (create event notes):*
- **Core:** `BIRT`, `DEAT`, `MARR`, `DIV`
- **Life Events:** `BURI`, `CREM`, `ADOP`, `GRAD`, `RETI`, `CENS`
- **Career/Residence:** `RESI`, `OCCU`, `EDUC`
- **Legal/Estate:** `PROB`, `WILL`, `NATU`, `MILI`
- **Migration:** `IMMI`, `EMIG`
- **Religious:** `BAPM`, `CHR`, `CHRA`, `CONF`, `FCOM`, `ORDN`, `BARM`, `BASM`, `BLES`
- **Family:** `ENGA`, `MARB`, `MARC`, `MARL`, `MARS`, `ANUL`, `DIVF`

*Person Attributes (stored as properties):*
- `DSCR` → `physicalDescription`
- `IDNO` → `identityNumber`
- `NATI` → `nationality`
- `RELI` → `religion`
- `TITL` → `title`
- `PROP` → `property`
- `CAST` → `caste`
- `NCHI` → `childrenCount`
- `NMR` → `marriageCount`
- `SSN` → `ssn` (automatically redacted from exports)
- `_RESEARCH_LEVEL` → `research_level` (custom tag, 0-6 research progress level)

*Sources:*
- `SOUR` - Source records → source notes
- `TITL` - Source title
- `AUTH` - Author
- `PUBL` - Publication info
- `REPO` - Repository

**Marriage Metadata (Enhanced Spouse Support):**
- `MARR` - Marriage events → `spouse1_marriage_date`
- `DIV` - Divorce events → `spouse1_divorce_date`
- `PLAC` - Marriage locations → `spouse1_marriage_location`

### After Import

1. **Wait for sync completion** - If bidirectional sync is enabled, Canvas Roots automatically processes all imported relationships. Progress notifications show sync status.
2. **Review imported notes** in your configured folders (People, Events, Sources, Places)
3. **Add research notes** below the frontmatter in each file
4. **Generate tree** using Control Center → Tree Generation

### Duplicate Handling

**Person Notes:**
If you import the same GEDCOM multiple times:
- Existing `cr_id` values are preserved
- Relationships are updated (not duplicated)
- New individuals are added
- Warnings appear for conflicts

**Place Notes:**
Place duplicate detection uses multiple strategies:
- **Primary:** Case-insensitive match on `full_name` property
- **Fallback:** Match by title + parent combination (for places with same name in different regions)
- Existing places are updated (missing parent links added) rather than duplicated

**State Abbreviation Normalization:**
US state abbreviations are automatically expanded to full names during import:
- Comma-separated: `Abbeville, SC, USA` → `Abbeville, South Carolina, USA`
- Space-separated: `Abbeville SC` → `Abbeville, South Carolina`

This prevents duplicate place notes from being created when GEDCOM data contains inconsistent state formats. All 50 US states plus DC are supported.

**Place Type Inference:**
When importing places, Canvas Roots uses context-aware type inference:
- Administrative division suffixes (County, Parish, Township, etc.) are detected
- When both "Abbeville" and "Abbeville County" exist as siblings, the non-suffixed version is inferred as a city/town rather than a county

### Exporting to GEDCOM

Export your family data back to GEDCOM format for sharing with other genealogy software or family members.

**Using the Export Wizard:**
1. Open the Import/Export Hub (see [Opening the Hub](#opening-the-hub))
2. Click the **Export** card
3. Select **GEDCOM 5.5.1** format
4. Choose folders:
   - **Preference folders** — Uses paths configured in Preferences
   - **Specify folders** — Select custom folders for each entity type
5. Configure privacy and inclusion options
6. Review the preview showing entity counts and privacy summary
7. Click **Export** to generate the file
8. Download or save the exported `.ged` file

**Using Context Menu (Quick Export):**
1. Right-click on a folder containing person notes
2. Select **Export folder to GEDCOM**
3. Choose export options
4. Save the `.ged` file

**What Gets Exported:**
- All person notes in the selected folder
- Relationships (parents, spouses, children)
- Birth and death dates/places
- Marriage metadata (dates, locations, divorce dates)
- `cr_id` values preserved as `_UUID` tags
- `group_name` values preserved as collection codes
- `research_level` preserved as `_RESEARCH_LEVEL` custom tag (0-6)

### Privacy Protection for Export

Canvas Roots includes optional privacy controls for protecting living persons in GEDCOM exports:

**Enable Privacy Protection:**
1. Go to Settings → Canvas Roots → GEDCOM section
2. Enable "Privacy protection for living persons"
3. Configure the birth year threshold (default: 100 years ago)

**Privacy Options:**
- **Exclude living persons**: Completely remove potentially living people from export
- **Anonymize living persons**: Include structure but replace PII with "[Living]"

**How Living Status is Determined:**
- People without death dates AND born after the threshold year are considered potentially living
- Threshold is configurable (e.g., born after 1925 = potentially living)
- Family structure is maintained even when details are anonymized

**Use Cases:**
- Share family trees publicly without exposing living relatives' data
- Comply with genealogical privacy best practices
- Create "public" and "private" versions of your research

## Gramps XML Import

Canvas Roots supports importing family data from [Gramps](https://gramps-project.org/), a popular open-source genealogy application.

### Supported File Formats

- **`.gpkg`** - Gramps Package (recommended) — bundles XML data with media files
- **`.gramps`** - Native Gramps compressed format (gzip-compressed XML)
- **`.xml`** - Uncompressed Gramps XML export

> **💡 Tip:** Export from Gramps as `.gpkg` to include media files (photos, documents, scans). Canvas Roots will extract them to your vault automatically.

### Importing a Gramps File

**Using the Import Wizard:**
1. Open the Import/Export Hub (see [Opening the Hub](#opening-the-hub))
2. Click the **Import** card
3. Select **Gramps XML** format (note: ".gpkg includes media")
4. Drag and drop your `.gpkg`, `.gramps`, or `.xml` file
5. Configure import options:
   - **Entity types** — People, events, sources, places (toggle each on/off)
   - **Target folder** — Where to create notes
   - **Dynamic blocks** — Enable/disable dynamic content blocks
6. Review the preview showing entity counts and media files
7. Click **Import** to begin (media files are automatically extracted from `.gpkg`)
8. Optionally apply reference numbering
9. Review summary and use quick actions

### What Gets Created

| Note Type | What's Created |
|-----------|----------------|
| **People** | One note per individual with relationships, dates, places, and linked media |
| **Sources** | One note per source record with citations and linked media |
| **Places** | One note per location (when enabled), linked from person notes, with linked media |
| **Events** | One note per life event (when enabled), linked to persons, places, and media |
| **Media** | Files extracted from `.gpkg` packages to your media folder |

### Place Linking

When you enable "Create place notes", Canvas Roots:
1. Creates place notes first
2. Automatically converts birth/death places in person notes to wikilinks
3. Links event notes to place notes as well

This creates a fully connected web of notes where you can navigate between people, events, and places.

### Supported Event Types

Gramps events are mapped to Canvas Roots event types:

| Gramps Event | Canvas Roots Type |
|--------------|-------------------|
| Birth | birth |
| Death | death |
| Marriage | marriage |
| Divorce | divorce |
| Burial | burial |
| Baptism, Christening | baptism |
| Confirmation | confirmation |
| Ordination | ordination |
| Residence | residence |
| Occupation | occupation |
| Military, Military Service | military |
| Immigration, Emigration, Naturalization | immigration |
| Education, Graduation | education |

Events not in this list are imported as "custom" type.

### Person Attributes

Gramps person attributes are imported when present:

| Gramps Attribute | Canvas Roots Property | Description |
|------------------|----------------------|-------------|
| `Research Level` | `research_level` | Research progress level (0-6) |

The `Research Level` attribute is automatically recognized from Gramps person records and imported as the `research_level` property. See [Research Level](Frontmatter-Reference#research-level) for details on the 0-6 scale.

### Notes Import

Notes attached to entities in Gramps are imported and appended to the corresponding Obsidian notes. The import wizard includes a **Notes** toggle (enabled by default) to control this behavior.

**What gets imported:**

| Entity Type | Notes Location |
|-------------|----------------|
| **Person** | Appended as "## Notes" section in person note |
| **Event** | Appended as "## Notes" section in event note |
| **Place** | Appended as "## Notes" section in place note |
| **Family** | Attached to marriage/family events (no separate family entity) |

**Note formatting:**

Gramps note styling is converted to Markdown:

| Gramps Style | Markdown Output |
|--------------|-----------------|
| Bold | `**text**` |
| Italic | `*text*` |
| Strikethrough | `~~text~~` |
| Underline | `<u>text</u>` |
| Superscript | `<sup>text</sup>` |
| Subscript | `<sub>text</sub>` |
| Link | `[text](url)` |

**Note format handling:**

- **Flowed notes** (default): Normal text, rendered as regular Markdown
- **Formatted notes** (preformatted): Wrapped in code fences to preserve whitespace

**Note types:**

Each note's type from Gramps (e.g., "Person Note", "Research", "Source text") becomes a `### Heading` in the imported content, making it easy to distinguish different types of notes on the same entity.

**Privacy handling:**

If any note attached to an entity has the privacy flag set in Gramps (`priv="1"`), the imported Obsidian note will include `private: true` in its frontmatter. This allows you to filter or exclude private data when exporting.

### Place Type Mapping

Gramps place types are preserved and mapped to Canvas Roots place types:
- Administrative: country, state, province, county, region, district, borough, municipality
- Populated: city, town, village, parish, neighborhood
- Specific: cemetery, church, building, farm, street, address

### After Import

1. Review imported notes in your configured folders
2. Add research notes below the frontmatter in each file
3. Generate tree using Control Center → Tree Generation

### Media Import from .gpkg

When importing a `.gpkg` package file, Canvas Roots:

1. **Extracts media files** to your configured media folder
2. **Links media to entities** — Photos, documents, and scans attached in Gramps are linked to the corresponding person, event, place, or source notes via the `media` frontmatter property
3. **Preserves order** — The first media item serves as the thumbnail (matching Gramps convention)

Media extracted from Gramps packages can be viewed using the [Media Gallery](Dynamic-Note-Content#media-block) dynamic block.

### Limitations

- **Separate note files**: Notes are embedded in entity notes, not created as standalone files (planned for future phase)
- **Repositories**: Repository records create properties on sources but not separate notes

## CSV Import/Export

Canvas Roots supports CSV and TSV file formats for easy data exchange with spreadsheets and other applications.

### Importing from CSV/TSV

**Using the Import Wizard:**
1. Open the Import/Export Hub (see [Opening the Hub](#opening-the-hub))
2. Click the **Import** card
3. Select **CSV** format
4. Drag and drop your `.csv` or `.tsv` file
5. Review the auto-detected column mapping and adjust if needed
6. Configure target folder and options
7. Review the preview
8. Click **Import** to create notes

**Auto-Detected Column Mapping:**

Canvas Roots automatically detects common column names and maps them to person properties:

| Detected columns | Maps to |
|-----------------|---------|
| name, full name, person | `name` |
| birth, born, birth date | `born` |
| death, died, death date | `died` |
| father, father name | `father` |
| mother, mother name | `mother` |
| spouse, spouse name | `spouse` |
| gender, sex | `gender` |

You can manually adjust any mapping before importing if the auto-detection doesn't match your file's column names.

**What Happens:**
- Creates one Markdown note per row
- Generates `cr_id` for each person automatically
- Creates relationship links when parent/spouse columns reference other people in the file
- Supports both wikilink format (`[[Name]]`) and plain text names

### Exporting to CSV

**Using the Export Wizard:**
1. Open the Import/Export Hub (see [Opening the Hub](#opening-the-hub))
2. Click the **Export** card
3. Select **CSV** format (coming soon)
4. Choose folders to export from
5. Configure columns to include
6. Enable privacy protection if needed
7. Review and export

> **Note:** CSV export via the wizard is planned for a future release. Currently available via context menu on folders.

**Configurable Columns:**

Choose which fields to include in your export:
- Core fields: name, cr_id, gender
- Dates: born, died
- Relationships: father, mother, spouse, children
- Metadata: collection, group_name, lineage

**Privacy Protection:**

Same privacy options as GEDCOM export:
- Exclude living persons entirely
- Anonymize living persons (replace PII with "[Living]")
- Configurable birth year threshold

### Format Comparison

| Feature | CSV | GEDCOM | Gramps XML |
|---------|-----|--------|------------|
| **Compatibility** | Spreadsheets, databases | Most genealogy software | Gramps only |
| **Structure** | Flat (one row per person) | Hierarchical (individuals + families) | Hierarchical with events |
| **Best for** | Quick edits, bulk changes | Software interchange | Gramps users |
| **Marriage data** | Limited | Full support | Full support |
| **Place hierarchy** | No | Limited | Yes |
| **Events** | No | Yes | Yes |
| **Sources** | No | Yes | Not yet |
| **Export support** | Yes | Yes | Import only |
| **Use case** | Working with data | Archiving/sharing | Migration from Gramps |

## Selective Branch Export

Export specific portions of your family tree rather than the entire dataset. Available for both GEDCOM and CSV formats.

### Branch Types

**Ancestors Only:**
Export only the ancestors (parents, grandparents, etc.) of a selected person.
- Useful for pedigree charts
- Creates focused lineage documentation
- Reduces file size for large trees

**Descendants Only:**
Export only the descendants (children, grandchildren, etc.) of a selected person.
- Useful for descendant reports
- Can optionally include spouses of descendants
- Great for sharing a specific family branch

### How to Use Selective Export

**Using the Export Wizard:**
1. Open the Import/Export Hub and click **Export**
2. Select your format (GEDCOM 5.5.1)
3. In the Folders step, select "Branch export" mode
4. Choose a root person for the branch
5. Select branch type (ancestors or descendants)
6. Optionally enable "Include spouses" for descendant exports
7. Complete the remaining wizard steps

### Combining with Collection Filtering

Selective branch export works together with collection filtering for precise exports:

1. Filter by collection to narrow the scope
2. Then apply branch selection to further refine
3. Result includes only people matching both criteria

**Example workflow:**
- Filter to "Maternal Line" collection
- Select branch: descendants of "Great-Grandmother Jane"
- Export only that specific branch within the maternal line

### Include Spouses Option

When exporting descendants, you can optionally include spouses:

- **Enabled**: Includes spouses of each descendant (helps show family units)
- **Disabled**: Exports only direct blood descendants

This option is particularly useful when you want complete family units rather than just the bloodline.
