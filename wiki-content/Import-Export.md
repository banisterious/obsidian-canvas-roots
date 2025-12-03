# Import & Export

Canvas Roots supports importing and exporting family data in GEDCOM and CSV formats.

## GEDCOM Import/Export

Canvas Roots provides full round-trip support for GEDCOM 5.5.1 format, allowing you to import family trees from popular genealogy software and export your Obsidian data back to GEDCOM format.

### Importing a GEDCOM File

**Using Control Center:**
1. Open Control Center → **Import/Export** tab
2. Set **Format** to "GEDCOM" and **Direction** to "Import"
3. If folders aren't configured, expand **Configure folders** to set your people folder
4. Click **Import GEDCOM**
5. Select your `.ged` file
6. Configure import options:
   - Target folder for person notes
   - UUID handling (preserve or generate new)
7. Click **Import**

**What Happens:**
- Creates one Markdown note per individual
- Generates structured YAML frontmatter with relationships
- Preserves `_UUID` tags as `cr_id` when present
- Creates bidirectional relationship links
- Automatically syncs all relationships after import (if bidirectional sync is enabled)
- Handles duplicate detection across multiple imports

**Supported GEDCOM Tags:**
- `INDI` - Individuals
- `NAME` - Person names
- `BIRT`/`DEAT` - Birth and death events
- `DATE` - Event dates
- `PLAC` - Event locations
- `FAMC`/`FAMS` - Family relationships
- `SEX` - Gender
- `_UUID` - Preserved as `cr_id`

**Marriage Metadata (Enhanced Spouse Support):**
- `MARR` - Marriage events → `spouse1_marriage_date`
- `DIV` - Divorce events → `spouse1_divorce_date`
- `PLAC` - Marriage locations → `spouse1_marriage_location`

### After Import

1. **Wait for sync completion** - If bidirectional sync is enabled, Canvas Roots automatically processes all imported relationships. Progress notifications show sync status.
2. **Review imported notes** in your configured person folder
3. **Add research notes** below the frontmatter in each file
4. **Generate tree** using Control Center → Tree Generation

### Duplicate Handling

If you import the same GEDCOM multiple times:
- Existing `cr_id` values are preserved
- Relationships are updated (not duplicated)
- New individuals are added
- Warnings appear for conflicts

### Exporting to GEDCOM

Export your family data back to GEDCOM format for sharing with other genealogy software or family members.

**Using Context Menu:**
1. Right-click on a folder containing person notes
2. Select **Export folder to GEDCOM**
3. Choose export options
4. Save the `.ged` file

**Using Control Center:**
1. Open Control Center → **Import/Export** tab
2. Set **Format** to "GEDCOM" and **Direction** to "Export"
3. Click **Export GEDCOM**
4. Select the folder to export
5. Configure export options
6. Click **Export**

**What Gets Exported:**
- All person notes in the selected folder
- Relationships (parents, spouses, children)
- Birth and death dates/places
- Marriage metadata (dates, locations, divorce dates)
- `cr_id` values preserved as `_UUID` tags
- `group_name` values preserved as collection codes

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

## CSV Import/Export

Canvas Roots supports CSV and TSV file formats for easy data exchange with spreadsheets and other applications.

### Importing from CSV/TSV

**Using Control Center:**
1. Open Control Center → **Import/Export** tab
2. Set **Format** to "CSV" and **Direction** to "Import"
3. If folders aren't configured, expand **Configure folders** to set your people folder
4. Click **Import CSV**
5. Select your `.csv` or `.tsv` file
6. Review the auto-detected column mapping
7. Adjust mappings if needed
8. Click **Import**

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

**Using Control Center:**
1. Open Control Center → **Import/Export** tab
2. Set **Format** to "CSV" and **Direction** to "Export"
3. Click **Export CSV**
4. Select the folder to export
5. Configure columns to include
6. Enable privacy protection if needed
7. Click **Export**

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

### CSV vs GEDCOM

| Feature | CSV | GEDCOM |
|---------|-----|--------|
| **Compatibility** | Spreadsheets, databases | Genealogy software |
| **Structure** | Flat (one row per person) | Hierarchical (individuals + families) |
| **Best for** | Quick edits, bulk changes | Software interchange |
| **Marriage data** | Limited | Full support |
| **Use case** | Working with data | Archiving/sharing |

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

**In GEDCOM Export:**
1. Open Control Center → **Import/Export** tab
2. Set **Format** to "GEDCOM" and **Direction** to "Export"
3. Click **Export GEDCOM**
4. Select "Branch export" mode
5. Choose a root person for the branch
6. Select branch type (ancestors or descendants)
7. Optionally enable "Include spouses" for descendant exports
8. Click **Export**

**In CSV Export:**
1. Open Control Center → **Import/Export** tab
2. Set **Format** to "CSV" and **Direction** to "Export"
3. Click **Export CSV**
4. Select "Branch export" mode
5. Choose a root person and branch type
6. Configure other options as needed
7. Click **Export**

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
