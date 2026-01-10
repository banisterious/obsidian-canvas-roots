# Staging & Cleanup

This page covers tools for managing imported data quality: staging workflows, duplicate detection, and record merging.

---

## Table of Contents

- [Smart Duplicate Detection](#smart-duplicate-detection)
- [Staging & Import Cleanup](#staging--import-cleanup)
  - [Setting Up Staging](#setting-up-staging)
  - [Importing to Staging](#importing-to-staging)
  - [Staging Manager](#staging-manager)
  - [Batch Cards](#batch-cards)
  - [Batch Actions](#batch-actions)
  - [Cross-Import Detection](#cross-import-detection)
  - [Staging Isolation](#staging-isolation)
- [Merging Duplicate Records](#merging-duplicate-records)

---

## Smart Duplicate Detection

Find potential duplicate person records in your vault using intelligent matching algorithms. This helps maintain data quality, especially after importing data from multiple sources.

### How It Works

Smart Duplicate Detection analyzes your person notes using multiple criteria:

**Fuzzy Name Matching (Levenshtein Distance):**
- Compares names allowing for typos and spelling variations
- "John Smith" matches "Jon Smith" or "John Smyth"
- Handles reversed names ("Smith, John" vs "John Smith")
- Configurable similarity threshold

**Date Proximity Analysis:**
- Compares birth and death dates when available
- Allows configurable year tolerance (default: ±2 years)
- Missing dates don't disqualify matches

**Confidence Scoring:**
Each potential duplicate receives a confidence level:
- **High**: Strong name match + close dates (likely duplicates)
- **Medium**: Good name match, dates may differ slightly
- **Low**: Possible match, worth reviewing

### Finding Duplicates

**Via Command Palette:**
1. Press `Ctrl/Cmd + P`
2. Type "Charted Roots: Find duplicate people"
3. The detection modal opens with results

**What You'll See:**
- List of potential duplicate pairs grouped by confidence
- Name comparison showing both versions
- Birth/death dates for each person (if available)
- Match score and confidence level

### Reviewing Matches

For each potential duplicate pair:

**Confirm as Duplicate:**
- Opens both notes for manual review
- Decide which record to keep
- Merge data as needed

**Dismiss False Positive:**
- Marks the pair as "not duplicates"
- Won't appear in future scans
- Dismissals are remembered across sessions

### Configuring Detection

Adjust detection sensitivity in Settings → Charted Roots → Data:

**Name Similarity Threshold:**
- Higher values = stricter matching (fewer false positives)
- Lower values = looser matching (catches more variations)
- Default: 0.8 (80% similarity required)

**Date Tolerance:**
- Years of variance allowed for date matching
- Default: 2 years
- Set to 0 for exact date matching only

### Best Practices

**When to Run Detection:**
- After importing GEDCOM or CSV files
- After bulk data entry sessions
- Periodically during research to catch accidental duplicates

**Handling Duplicates:**
1. Review both notes side-by-side
2. Identify which has more complete data
3. Merge unique information into the keeper
4. Update relationships pointing to the duplicate
5. Delete or archive the duplicate note

**Preventing Duplicates:**
- Use consistent naming conventions
- Enable bidirectional sync to catch relationship conflicts
- Import from single authoritative source when possible

## Staging & Import Cleanup

The staging workflow provides a safe way to process imported data before incorporating it into your main family tree. This is particularly useful when working with messy GEDCOM files, multiple overlapping imports, or data that needs cleanup.

### Setting Up Staging

**From Plugin Settings:**
1. Go to **Settings → Charted Roots → Data**
2. Set a **Staging folder** path (e.g., `People-Staging`)

**From Preferences:**
1. Go to **Settings → Charted Roots → Preferences**
2. Enable **Staging isolation** to exclude staging from normal operations

When staging is configured, imported data is kept separate from your main tree until you're ready to promote it.

### Importing to Staging

1. Open the Import Wizard (Command palette: `Charted Roots: Import wizard`)
2. Select your format (GEDCOM, Gramps, CSV)
3. Select **Import destination**: choose "Staging" instead of "Main tree"
4. Optionally specify a **Subfolder name** for this import batch (e.g., `smith-gedcom-2024`)
5. Import your file
6. Data is created in the staging folder, isolated from your main tree
7. After import completes, click **Manage Staging** to open the Staging Manager

### Staging Manager

The Staging Manager is a dedicated modal for managing staged imports. It provides batch organization, duplicate detection, and promotion workflow.

**Opening the Staging Manager:**

| Method | Description |
|--------|-------------|
| Dashboard | Click **Staging Manager** button (appears when staging has data) |
| Command palette | `Charted Roots: Manage staging area` |
| Import Wizard | Click **Manage Staging** on the success screen after importing to staging |

**Stats Summary:**
- Total files across all batches
- Number of import batches
- Potential duplicates detected

### Batch Cards

Each import batch appears as a collapsible card showing:

| Element | Description |
|---------|-------------|
| Folder name | Timestamp-based name (e.g., `2024-12-15_14-30-00`) |
| Entity counts | Breakdown by type: people, places, sources, events, organizations |
| Last modified | When the batch was last updated |

**Expanding Batches:**
- Click a batch header to expand and see individual files
- Each file shows an icon for its entity type and a type badge
- Click any file row to open it in a new tab for review

### Batch Actions

Each batch card has action buttons:

| Button | Description |
|--------|-------------|
| **Check duplicates** | Run cross-import detection against the main tree |
| **Promote** | Move all files from this batch to the main tree folder |
| **Delete** | Delete the entire batch (with confirmation) |

**Bulk Actions:**
- **Promote all**: Move all staged files to main tree
- **Delete all**: Remove all staging data

### Cross-Import Detection

Click **Check duplicates** on a batch to find potential duplicates against your main tree.

**How Matching Works:**

| Factor | Weight | Description |
|--------|--------|-------------|
| Name similarity | 60% | Levenshtein distance comparison |
| Date proximity | 30% | Birth/death year within threshold |
| Gender match | 5% bonus | Additional confidence when genders match |

Default thresholds: minConfidence=60, minNameSimilarity=70, maxYearDifference=5

**Reviewing Matches:**
- Mark matches as "Same person" or "Different people"
- "Same person" matches are skipped during promote—use merge instead
- "Different people" dismissals are remembered across sessions

### Staging Isolation

When staging isolation is enabled (Settings → Preferences), staged files are automatically excluded from:
- Tree generation (your trees only show main tree data)
- Normal duplicate detection
- Relationship sync operations
- Collections and groups
- Vault statistics

This ensures your production data stays clean while you work on imports.

### Workflow Example

1. Import `smith-family.ged` to staging (Import Wizard → Staging destination)
2. Import `jones-tree.ged` to staging
3. Open Staging Manager (Dashboard button or command palette)
4. Expand each batch to preview files
5. Click "Check duplicates" to find matches with main tree
6. For each match, decide: Same person → Merge, or Different people → dismiss
7. Click "Promote" for each batch
8. New unique people are moved to main; duplicates were merged earlier
9. Delete empty batches or click "Delete all" to clean up

## Merging Duplicate Records

When you find duplicate person records—either through duplicate detection or cross-import review—the Merge Wizard helps you combine them with field-level control.

### Accessing the Merge Wizard

**From Duplicate Detection:**
1. Run command "Find duplicate people"
2. For each potential duplicate, click **Merge**

**From Cross-Import Review:**
1. Open Import/Export tab → click "Review matches with main tree"
2. Click "Same person" for a match
3. Click the **Merge** button that appears

### Using the Merge Wizard

The Merge Wizard shows a side-by-side comparison of both records:

**Field Comparison Table:**
- Each row shows one field (name, birth date, etc.)
- **Staging** column: value from the staging/source record
- **Main** column: value from the main/target record
- **Use** column: dropdown to choose which value to keep

**Field Choices:**
- **Main**: Keep the main record's value
- **Staging**: Use the staging record's value
- **Both** (for arrays): Combine values from both (spouses, children)

Fields that are identical show a checkmark instead of a dropdown.

### Preview and Execute

1. Click **Preview** to see what the merged record will look like
2. Review the combined data
3. Click **Merge** to execute

**What Happens:**
- The main record is updated with your selected field values
- The staging record is deleted
- All relationships pointing to the staging record are updated to point to main
- A success notification confirms the merge

### Relationship Reconciliation

When merging, Charted Roots automatically updates relationship references:

- If the staging person was listed as someone's father, that reference updates to the main person
- Spouse and child relationships are similarly updated
- This ensures no orphaned relationship references remain

### Best Practices

**Before Merging:**
- Review both records carefully
- Check if the staging record has data the main record lacks
- Consider using "Both" for array fields to preserve all relationships

**After Merging:**
- The staging file is deleted automatically
- Check the main record to verify the merge result
- Regenerate any canvases that included either person
