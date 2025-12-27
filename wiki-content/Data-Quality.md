# Data Quality

Canvas Roots includes comprehensive data quality tools to help you maintain accurate, consistent genealogical data. These tools detect issues, preview changes, and apply fixes across your vault.

---

## Table of Contents

- [Overview](#overview)
- [Post-Import Cleanup Workflow](#post-import-cleanup-workflow)
  - [Using the Cleanup Wizard (Recommended)](#using-the-cleanup-wizard-recommended)
  - [Manual Cleanup Steps](#manual-cleanup-steps)
- [Control Center Data Quality Tab](#control-center-data-quality-tab)
  - [Quality Report](#quality-report)
  - [Issue Categories](#issue-categories)
- [Batch Operations](#batch-operations)
- [Place Data Quality](#place-data-quality)
- [GEDCOM Import Quality Preview](#gedcom-import-quality-preview)
- [Best Practices](#best-practices)

---

## Overview

Data quality tools are available in two contexts:

1. **During GEDCOM import** - Preview issues before any files are created
2. **Post-import** - Analyze and fix issues in existing person notes

## Post-Import Cleanup Workflow

After importing a GEDCOM file (especially a "messy" one with data quality issues), use the **Cleanup Wizard** to guide you through the recommended sequence of fixes.

### Using the Cleanup Wizard (Recommended)

**Location:** Control Center → Data Quality tab → "Cleanup Wizard"

The Cleanup Wizard provides a guided, step-by-step workflow that walks you through all data quality operations in the correct order. It's the recommended approach for post-import cleanup.

**Wizard Features:**
- **10 sequential steps** covering all cleanup operations
- **Progress tracking** with completed/pending status for each step
- **Session persistence** — your progress is saved, so you can close the wizard and resume later
- **Preview before apply** — each operation shows what will change before making modifications
- **Skip/reset options** — skip steps that don't apply or reset to re-run a step

**Wizard Steps:**

| Step | Operation | Description |
|------|-----------|-------------|
| 1 | Migrate Legacy Type | Convert `type` to `cr_type` property |
| 2 | Flatten Nested Properties | Convert nested frontmatter to flat properties |
| 3 | Normalize Date Formats | Standardize dates to YYYY-MM-DD format |
| 4 | Normalize Sex Values | Normalize to GEDCOM-standard M/F/X/U |
| 5 | Fix Bidirectional Relationships | Ensure parent-child and spouse links are reciprocated |
| 6 | Migrate Source Arrays | Convert `source`, `source_2`, `source_3` to `sources: []` |
| 7 | Clear Orphan References | Remove references to non-existent people |
| 8 | Standardize Place Names | Unify spelling variations |
| 9 | Geocode Places | Look up coordinates for map display |
| 10 | Enrich Place Hierarchy | Add `contained_by` relationships |

**Tips:**
- Run the Quality Report first to understand the scope of issues
- Steps can be skipped if they don't apply to your data
- The wizard remembers which steps you've completed

---

### Manual Cleanup Steps

If you prefer to run individual operations manually, or need more control over specific steps, you can access each operation directly from the Control Center tabs.

#### Step 1: Review the Quality Report
**Location:** Control Center → Data Quality tab → "Run analysis"

Start here to understand the scope of issues. The report shows:
- Overall quality score (0-100)
- Issues grouped by severity (errors, warnings, info)
- Completeness metrics

This gives you the big picture before diving into fixes.

#### Step 2: Fix Bidirectional Relationships
**Location:** Control Center → People tab → Batch operations → "Fix bidirectional relationship inconsistencies"

Run this early — it ensures the family graph is internally consistent. If a child lists a parent, the parent should list the child. This step is essential for tree generation and navigation to work correctly.

**When to run this operation:**
- After manual edits where you added a parent/spouse/child to one person but forgot the reciprocal link
- After bulk operations that might have created one-sided relationships
- As a periodic sanity check during active data entry sessions (every 10-20 edits)
- Before major exports or canvas generation

**When it's unnecessary:**
- After GEDCOM imports — the importer creates bidirectional relationships automatically
- After using the plugin's built-in relationship editing UI — those create both sides automatically

#### Step 3: Normalize Date Formats
**Location:** Control Center → Data Quality tab → "Normalize date formats"

Converts varied date formats (`15 Mar 1920`, `Mar 15, 1920`, etc.) to the standard `YYYY-MM-DD` format. Standardized dates enable proper sorting, filtering, and age calculations.

#### Step 4: Normalize Sex Values
**Location:** Control Center → Data Quality tab → "Normalize sex values"

Converts `male`, `female`, `man`, `woman`, etc. to GEDCOM-standard canonical values (`M`, `F`, `X`, `U`). Consistent sex values are required for parent role validation (father vs. mother) and GEDCOM export compatibility.

#### Step 5: Clear Orphan References
**Location:** Control Center → Data Quality tab → "Clear orphan references"

Removes `father_id` and `mother_id` values that point to non-existent people. This cleans up dangling references that can cause errors in tree generation.

#### Step 6: Migrate Source Arrays
**Location:** Control Center → Data Quality tab → "Migrate source arrays"

Converts indexed source properties (`source`, `source_2`, `source_3`) to a single `sources` YAML array. This aligns with the modern array-based property format used throughout Canvas Roots.

#### Step 7: Standardize Place Names
**Location:** Control Center → Places tab → "Standardize variants"

Unifies spelling variations ("USA" vs "United States of America", state abbreviations). Consistent place names enable proper grouping and hierarchy building.

#### Step 8: Geocode Places
**Location:** Control Center → Places tab → "Bulk geocode"

Looks up coordinates for place notes that don't have them. Required for map visualizations. Note: Rate-limited to 1 request/second.

#### Step 9: Enrich Place Hierarchy
**Location:** Control Center → Places tab → "Enrich place hierarchy"

Uses geocoding API to fill in `contained_by` relationships (city → county → state → country). Creates proper place containment chains.

#### Optional: Flatten Nested Properties
**Location:** Control Center → Data Quality tab → "Flatten nested properties"

If your GEDCOM import created nested frontmatter (e.g., `coordinates: { lat: ..., long: ... }`), this converts them to flat properties (`coordinates_lat`, `coordinates_long`). Flat properties work better with Obsidian's property editor.

---

## Control Center Data Quality Tab

Access the Data Quality tab from Control Center to analyze and fix issues in your existing data.

### Quality Report

The Quality Report analyzes all person notes and generates:

- **Quality Score** (0-100) - Overall data quality rating
- **Issues by Severity** - Errors, warnings, and informational items
- **Issues by Category** - Date, relationship, data format, references, etc.
- **Completeness Metrics** - Percentage of notes with birth dates, parents, etc.

### Issue Categories

#### Date Inconsistencies

| Issue | Severity | Description |
|-------|----------|-------------|
| Death before birth | Error | Death date is earlier than birth date |
| Future birth/death | Error | Date is in the future |
| Unreasonable age | Warning | Lifespan exceeds 120 years |
| Born before parent | Error | Child's birth predates parent's birth |
| Parent too young | Warning | Parent was under 12 at child's birth |
| Parent too old | Warning | Father over 80 or mother over 55 at birth |
| Born after parent death | Error | Birth after mother's death (or >1 year after father's) |

#### Relationship Inconsistencies

| Issue | Severity | Description |
|-------|----------|-------------|
| Gender/role mismatch | Warning | Female listed as father, or male as mother |
| Self-reference | Error | Person listed as their own parent/spouse |
| Circular relationship | Error | A is parent of B, B is parent of A |
| Duplicate spouse | Warning | Same person listed multiple times as spouse |

#### Missing Data

| Issue | Severity | Description |
|-------|----------|-------------|
| No parents | Info | Neither father nor mother defined |
| One parent only | Info | Only one parent defined |
| No birth date | Info | Birth date not recorded |
| No gender | Info | Gender not specified |

#### Orphan References

| Issue | Severity | Description |
|-------|----------|-------------|
| Orphan parent ref | Warning | Father/mother ID points to non-existent person |
| Orphan spouse ref | Warning | Spouse ID points to non-existent person |
| Orphan child ref | Warning | Child ID points to non-existent person |

#### Data Format Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| Non-standard date | Info | Date not in YYYY-MM-DD or YYYY format |
| Invalid gender value | Warning | Gender value not recognized |
| Nested property | Warning | Frontmatter contains nested objects |
| Legacy type property | Info | Uses `type` instead of `cr_type` |

## Batch Operations

### Fix Bidirectional Relationships

Ensures all parent-child and spouse relationships are properly reciprocated.

**What it fixes:**
- Child lists parent, but parent doesn't list child in `children_id`
- Parent lists child, but child doesn't have `father_id`/`mother_id` set
- Person lists spouse, but spouse doesn't reciprocate

**Preview mode:** Shows all inconsistencies before applying fixes

**Conflict handling:** When two people both claim the same child as their own, the tool flags this for manual resolution rather than automatically overwriting.

### Normalize Date Formats

Converts various date formats to the standard YYYY-MM-DD format.

**Formats recognized:**
- `15 Mar 1920` → `1920-03-15`
- `Mar 15, 1920` → `1920-03-15`
- `15/03/1920` → `1920-03-15`
- `about 1920` → `1920`

### Normalize Sex Values

Converts sex values to GEDCOM-standard canonical forms using built-in synonyms and user-configured aliases.

**Canonical values:** `M`, `F`, `X`, `U` (GEDCOM standard)

**Built-in mappings:**
- `male`, `man`, `boy` → `M`
- `female`, `woman`, `girl` → `F`
- `nonbinary`, `non-binary`, `nb`, `intersex` → `X`
- `unknown`, `?` → `U`

**Customization:** Configure additional mappings in Preferences → Value Aliases

#### Normalization Modes

Control how normalization behaves via Preferences → Data Quality → Sex value normalization:

| Mode | Behavior |
|------|----------|
| **Standard** | Normalize all sex values to GEDCOM M/F (default) |
| **Schema-aware** | Skip notes covered by schemas that define custom sex enum values |
| **Disabled** | Never normalize (preview shows what would change) |

**Schema-aware mode** is designed for worldbuilders who define custom sex values (e.g., "hermaphrodite", "neuter") in a [schema](Schema-Validation). When enabled, the normalization operation checks if each person note has an applicable schema with a custom `sex` enum definition. Notes with such schemas are skipped, preserving custom values.

**Example:** A person note in a "Sci-Fi Universe" with a schema defining `sex: ["male", "female", "neuter", "hermaphrodite"]` will be skipped, while genealogy notes in the main tree continue to normalize to GEDCOM M/F

### Clear Orphan References

Removes `father_id` and `mother_id` values that point to non-existent `cr_id` values.

**Use case:** After deleting person notes, clear dangling references

### Migrate Legacy Type Property

Migrates from the legacy `type` property to the namespaced `cr_type` property.

**When to use:** If upgrading from an older version that used `type: person` instead of `cr_type: person`

## Place Data Quality

The Places tab in Control Center includes several data quality tools for place names.

### Standardize Place Names

Unifies spelling variations of place names across your vault.

**Example:** "New York City", "NYC", "New York, NY" → standardized to your chosen form

### Standardize Place Variants

Normalizes common abbreviations and alternate forms:

**Countries:**
- "United States of America", "United States", "US" → "USA"
- "United Kingdom", "Great Britain" → "UK"

**US States:**
- "California", "Cal." → "CA"
- "New York" → "NY"

### Merge Duplicate Places

Combines separate place notes that represent the same location.

**Detection methods:**
- Case-insensitive matching on `full_name`
- Title + parent combination matching

### Standardize Place Types

Converts generic place types to specific settlement types. This tool flags places with ambiguous types that typically need human review.

**Types flagged for review:**
- `locality` — Generic term often assigned during import
- `municipality` — Administrative term that varies by country
- `hamlet` — May be better classified as village
- `settlement` — Generic term needing specificity

**Standard types to convert to:**
- `city` — Large urban area, typically >10,000 population
- `town` — Medium settlement, typically 1,000–10,000 population
- `village` — Small rural settlement, typically <1,000 population

**Types NOT flagged:**
- `township` — Recognized as a valid US administrative division (Midwest/Northeast civil townships)
- All other built-in types (country, state, county, district, etc.)

## GEDCOM Import Quality Preview

When importing a GEDCOM file, Canvas Roots analyzes the data before creating any files.

### What's Detected

- **Date issues** - Death before birth, future dates, impossible ages
- **Relationship issues** - Gender/role mismatches, circular references
- **Reference issues** - Pointers to non-existent records
- **Data completeness** - Missing names, unknown sex, no dates
- **Place variants** - Inconsistent place name formats

### Place Variant Standardization

During import preview, you can choose canonical forms for place names:

1. Review detected variants (e.g., "USA" vs "United States of America")
2. Select your preferred form for each variant group
3. Changes apply to both file names and frontmatter values

This ensures consistency from the start, avoiding post-import cleanup.

### Preview Actions

- **Proceed with import** - Apply your choices and create files
- **Cancel** - Abort without creating any files

## Best Practices

### Regular Maintenance

1. Run the Quality Report periodically (monthly or after major imports)
2. Address errors first, then warnings
3. Informational items can often be ignored (missing data may be unavailable)

### Before Sharing Data

1. Run bidirectional relationship fix to ensure consistency
2. Check for orphan references
3. Standardize date formats for interoperability

### After GEDCOM Import

1. Review the quality preview before importing
2. Standardize place variants during import
3. Run the Places tab tools to complete place hierarchy
4. Resolve any parent claim conflicts before running other batch operations
5. **Skip** "Fix bidirectional relationships" — GEDCOM data already contains complete bidirectional relationships

**Important:** The GEDCOM importer preserves complete relationship data from the source file. Running the bidirectional fix immediately after import is unnecessary and could cause issues if there are unresolved parent claim conflicts (e.g., step-parents flagged as conflicting with biological parents).

### Data Entry Guidelines

- Use YYYY-MM-DD format for dates (or YYYY for year-only)
- Use `cr_type` instead of `type` for note types
- Keep frontmatter flat (avoid nested objects)
- Enter gender as `male`, `female`, or `nonbinary`
