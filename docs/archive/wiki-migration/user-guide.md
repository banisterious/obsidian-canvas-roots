# Canvas Roots: User Guide

> **Version:** v0.6.0
> **Last Updated:** 2025-12-02

This guide covers the complete workflow for using Canvas Roots to create and maintain family trees in Obsidian.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Data Entry](#data-entry)
3. [Bidirectional Relationship Sync](#bidirectional-relationship-sync)
4. [Collections & Groups](#collections--groups)
5. [Generating Trees](#generating-trees)
6. [Interactive Tree Preview](#interactive-tree-preview)
7. [Interactive Family Chart View](#interactive-family-chart-view)
8. [Maintaining Trees](#maintaining-trees)
9. [GEDCOM Import/Export](#gedcom-importexport)
10. [CSV Import/Export](#csv-importexport)
11. [Selective Branch Export](#selective-branch-export)
12. [Relationship Calculator](#relationship-calculator)
13. [Smart Duplicate Detection](#smart-duplicate-detection)
14. [Staging & Import Cleanup](#staging--import-cleanup)
15. [Merging Duplicate Records](#merging-duplicate-records)
16. [Reference Numbering Systems](#reference-numbering-systems)
17. [Lineage Tracking](#lineage-tracking)
18. [Relationship History & Undo](#relationship-history--undo)
19. [Folder Statistics](#folder-statistics)
20. [Geographic Features](#geographic-features)
21. [Advanced Styling](#advanced-styling)
22. [Excalidraw Export](#excalidraw-export)
23. [Split Canvas Wizard](#split-canvas-wizard)
24. [Tips & Best Practices](#tips--best-practices)

---

## Getting Started

Canvas Roots transforms structured genealogical data in your Markdown notes into beautifully laid-out family trees on the Obsidian Canvas.

**Prerequisites:**
- Obsidian v1.7.2 or later
- Canvas Roots plugin installed and enabled

**Basic Workflow:**
1. Enter your family data (individual notes or GEDCOM import)
2. Generate tree using Control Center
3. View and interact with the canvas
4. Regenerate after making edits

---

## Data Entry

> **Reference:** For a complete list of all supported properties, see the [Frontmatter Schema Reference](reference/frontmatter-schema.md).

### Option A: Individual Markdown Notes

Create individual notes for each person with YAML frontmatter containing relationship data.

**Required Fields:**
- `cr_id`: Unique identifier (UUID format recommended)
- `name`: Person's name

**Optional Relationship Fields:**
- `father`: Wikilink to father's note
- `father_id`: Father's `cr_id` value
- `mother`: Wikilink to mother's note
- `mother_id`: Mother's `cr_id` value
- `spouse`: Wikilink(s) to spouse(s)
- `spouse_id`: Spouse `cr_id` value(s)
- `children`: Array of wikilinks to children
- `children_id`: Array of children's `cr_id` values

**Optional Date Fields:**
- `born`: Birth date (YYYY-MM-DD format recommended)
- `died`: Death date (YYYY-MM-DD format recommended)

**Example Person Note:**

```yaml
---
cr_id: abc-123-def-456
name: John Robert Smith
father: "[[John Smith Sr]]"
father_id: xyz-789-uvw-012
mother: "[[Jane Doe]]"
mother_id: pqr-345-stu-678
spouse: ["[[Mary Jones]]"]
spouse_id: ["mno-901-jkl-234"]
children: ["[[Bob Smith]]", "[[Alice Smith]]"]
children_id: ["def-456-ghi-789", "abc-123-xyz-456"]
born: 1888-05-15
died: 1952-08-20
---

# Research Notes

[Your biographical research, sources, and notes here...]
```

**Multiple Spouse Support:**

For complex marital histories, use indexed spouse properties:

```yaml
---
cr_id: abc-123-def-456
name: John Robert Smith
# First spouse
spouse1: "[[Jane Doe]]"
spouse1_id: "jane-cr-id-123"
spouse1_marriage_date: "1985-06-15"
spouse1_divorce_date: "1992-03-20"
spouse1_marriage_status: divorced
spouse1_marriage_location: "Boston, MA"

# Second spouse
spouse2: "[[Mary Johnson]]"
spouse2_id: "mary-cr-id-456"
spouse2_marriage_date: "1995-08-10"
spouse2_marriage_status: current
spouse2_marriage_location: "Seattle, WA"
---
```

### Option B: Obsidian Bases (Recommended for Bulk Entry)

Use [Obsidian Bases](https://help.obsidian.md/bases) to manage multiple family members in a spreadsheet-like table interface.

**Advantages:**
- Edit multiple people at once
- Sort and filter by any field
- Copy/paste from spreadsheets
- Bulk updates and corrections

**Getting Started:**
1. Open Control Center → Quick Actions
2. Click "Create Bases template"
3. Edit family data in the table views
4. Changes automatically sync to person notes

See [bases-integration.md](bases-integration.md) for detailed instructions and templates.

---

## Bidirectional Relationship Sync

Canvas Roots automatically maintains **reciprocal relationships** across your family tree to ensure data consistency. When you create or delete a relationship in one person's note, the inverse relationship is automatically updated in the related person's note.

### How It Works

When bidirectional sync is **enabled** (default), relationship changes automatically update both person notes:

**Example - Adding a parent:**
1. You edit Alice's note and set `father: [[John Smith]]`
2. Canvas Roots automatically adds `children: [[Alice]]` to John's note
3. Both notes now reflect the bidirectional relationship
4. Changes appear immediately in Bases (if both people are visible in the table)
5. Canvas trees automatically reflect the relationship

**Example - Deleting a parent:**
1. You clear Alice's `father` field (remove `[[John Smith]]`)
2. Canvas Roots automatically removes Alice from John's `children` array
3. The reciprocal link is cleaned up automatically

### What Gets Synced

- **Parent → Child**: Setting `father`/`mother` automatically adds person to parent's `children` array (with both wikilink and `children_id`)
- **Spouse ↔ Spouse**: Adding `spouse` creates reciprocal spouse link in both notes (both simple and indexed formats)
- **Indexed Spouses**: Full support for `spouse1`, `spouse2`, etc. with corresponding `spouse1_id`, `spouse2_id`
- **Deletions**: Removing a relationship automatically removes the reciprocal link
- **Marriage Metadata**: Indexed spouse deletion also cleans up associated marriage dates, locations, and divorce dates

### Sync Triggers

Bidirectional sync activates in these situations:

- **File edits**: When you edit relationships in Bases, frontmatter editor, or note body
- **Data entry**: When you create new person notes with relationships via Control Center
- **GEDCOM imports**: After importing a GEDCOM file, all relationships are automatically synced across all imported person notes
- **External editors**: When you edit files externally (VS Code, Vim, etc.) while Obsidian is running

### Enable or Disable

Go to **Settings → Canvas Roots → Data** section:

- **Enable bidirectional relationship sync**: Master toggle (default: **ON**)
- **Sync on file modify**: Auto-sync when editing notes or Bases (default: **ON**)

When sync is enabled, relationship changes made anywhere (Bases, frontmatter editor, external editors, or programmatically) are automatically propagated to both person notes.

**Note:** Disabling "Sync on file modify" while keeping the master toggle enabled means sync will only occur during specific operations like GEDCOM import and manual data entry via Control Center.

### Known Limitations

Bidirectional sync works by tracking relationship changes over time. There are a few edge cases to be aware of:

1. **Sync disabled during deletion**: If you disable bidirectional sync (or "Sync on file modify"), delete relationships, and then re-enable sync, the reciprocal links won't be automatically cleaned up. You'll need to manually remove them or use the "Validate relationships" command to find orphaned links.

2. **Bulk external edits**: If you edit many files externally (e.g., in VS Code) while Obsidian is closed, the sync will only see the final state when you reload Obsidian, not the intermediate changes.

These limitations are expected behavior and don't affect normal usage. The sync works reliably for day-to-day editing in Obsidian, Bases, or external editors while Obsidian is running.

### Best Practices

**Do:**
- ✅ Keep bidirectional sync enabled for automatic relationship maintenance
- ✅ Edit relationships in Bases or frontmatter editor with sync enabled
- ✅ Use "Validate relationships" command periodically to catch any inconsistencies
- ✅ Trust the sync to maintain reciprocal relationships automatically

**Don't:**
- ❌ Manually maintain reciprocal relationships (let the sync do it for you)
- ❌ Disable sync unless you have a specific reason and understand the implications
- ❌ Bulk edit files externally while Obsidian is closed if you need deletion tracking

### Troubleshooting

**Problem:** Reciprocal relationships aren't being created.

**Solutions:**
- Verify bidirectional sync is enabled in Settings → Canvas Roots → Data
- Check that "Sync on file modify" is enabled
- Ensure the person notes have valid `cr_id` fields
- Check console logs (open Developer Tools) for sync errors

**Problem:** Orphaned relationships after deleting.

**Solutions:**
- Use "Validate relationships" command to find orphaned links
- Ensure sync was enabled when you made the deletion
- Manually clean up orphaned links if sync was disabled during deletion

**Problem:** Sync not working with external editor.

**Solutions:**
- Ensure Obsidian is running when editing externally
- Wait for Obsidian to detect file changes (usually automatic)
- Check that files have valid frontmatter with `cr_id`

For more detailed information about bidirectional sync with Bases integration, see [bases-integration.md](bases-integration.md).

---

## Collections & Groups

Canvas Roots provides two complementary ways to organize people in your vault:

### Group Names (Auto-Detected Families)

Canvas Roots automatically detects disconnected family groups by analyzing relationship connections. These are the people who share biological/marital relationships.

**How It Works:**
- Runs automatically in the background
- Based on actual relationship data (father, mother, spouse, children)
- Always up-to-date (recomputed on demand)
- Zero configuration required

**Customizing Group Names:**

By default, groups are named "Family 1", "Family 2", etc. You can customize these names:

1. **Via Context Menu:**
   - Right-click any person note
   - Select "Set group name"
   - Enter a custom name (e.g., "Smith Family Tree")

2. **Via YAML Frontmatter:**
   ```yaml
   ---
   group_name: "Smith Family Tree"
   ---
   ```

**Note:** The `group_name` property sets the display name for the entire connected family group. If multiple people in the same group have different names, the most common one is used.

### Collections (User-Defined Organization)

Collections let you create custom groupings independent of biological relationships. Use these for:
- Organizing by lineage (e.g., "Paternal Line", "Maternal Line")
- Grouping by generation (e.g., "First Generation", "My Generation")
- World-building categories (e.g., "House Stark", "The Council")
- Any other organizational scheme that makes sense for your research

**Creating Collections:**

1. **Via Context Menu:**
   - Right-click any person note
   - Select "Add to collection"
   - Enter or select a collection name

2. **Via YAML Frontmatter:**
   ```yaml
   ---
   collection: "Paternal Line"
   ---
   ```

3. **Via Obsidian Bases:**
   - Edit the `collection` property directly in table views
   - Bulk assign collections to multiple people at once

### Browsing Collections & Groups

Open Control Center → **Collections** tab to browse and organize:

**Browse Modes:**
- **All people**: Complete list of everyone in your vault
- **Detected families**: Auto-detected groups with custom names
- **My collections**: Your user-defined collections

**Cross-Collection Connections:**

When you have 2+ collections, Canvas Roots automatically detects "bridge people" who connect different collections through their relationships.

**Example:**
```
Collections:
  • Paternal Line (40 people)
  • Maternal Line (35 people)

Bridge People:
  • You (connects Paternal ↔ Maternal via parents)
  • Your siblings (2 links)
```

### Using Collections in Tree Generation

Filter generated trees by collection membership:

1. Open Control Center → Tree Generation tab
2. Configure your tree settings
3. **Filter by collection**: Select a specific collection (optional)
   - Leave as "All collections" for unfiltered trees
   - Select a collection to include only those people
4. Generate tree

**When to Use Collection Filtering:**
- Generate trees for specific branches (e.g., only paternal ancestors)
- Visualize a single lineage or faction
- Create focused trees for presentations or research
- Separate fictional characters by house/organization

### Groups vs Collections: Quick Comparison

| Feature | Group Names | Collections |
|---------|-------------|-------------|
| **Purpose** | Identify connected families | Organize for your needs |
| **Detection** | Automatic (from relationships) | Manual (you assign) |
| **Property** | `group_name` | `collection` |
| **Zero Config** | ✅ Yes | ❌ Optional |
| **Use Cases** | Multi-family vaults, auto-naming | Lineages, generations, factions |
| **Example** | "Smith Family Tree" | "Paternal Line" |

**Pro Tip:** Use both together! Group names for automated organization, collections for your custom research categories.

---

## Generating Trees

### Step 1: Open Control Center

**Method 1: Command Palette**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Open Control Center"
3. Press Enter

**Method 2: Ribbon Icon (if enabled)**
- Click the Canvas Roots icon in the left sidebar

### Step 2: Navigate to Tree Generation Tab

Click the **Tree Generation** tab at the top of the Control Center modal.

### Step 3: Select Root Person

**Using the Person Browser:**
1. **Search**: Type in the search box to filter by name
2. **Sort**: Click column headers to sort by name or birth year
3. **Click**: Select any person as the tree's root
4. Birth/death years appear next to names for identification

**Using Family Groups (Multi-Family Vaults):**
- If you have disconnected family groups, use the sidebar
- Shows "Family 1", "Family 2", etc. with person counts
- Click any family to select its representative person

### Step 4: Configure Tree Options

**Tree Type:**
- **Ancestors**: Shows parents, grandparents, etc. (pedigree chart)
- **Descendants**: Shows children, grandchildren, etc.
- **Full**: Shows both ancestors and descendants

**Generations:**
- **All generations**: Include everyone related to root person
- **Limit generations**: Set maximum number of generations (1-10)

**Spouses:**
- **Include spouses**: Show spouse relationships in the tree
- **Exclude spouses**: Show only blood relationships

**Layout:**
- **Vertical**: Generations flow top-to-bottom (traditional pedigree)
- **Horizontal**: Generations flow left-to-right (compact for wide screens)

**Layout Algorithm:**
- **Standard**: Default family-chart layout with proper spouse handling (default spacing)
- **Compact**: 50% tighter spacing for large trees (ideal for 50+ people)
- **Timeline**: Chronological positioning by birth year (X-axis = time, Y-axis = generation)
- **Hourglass**: Root person centered with ancestors above and descendants below

**Spacing:**
- **Horizontal spacing**: Distance between nodes side-by-side
- **Vertical spacing**: Distance between generations
- Adjust in Canvas Settings tab

### Step 5: Generate

**Single Tree:**
1. Enter an optional canvas name (defaults to "Family Tree - [Root Person]")
2. Click **Generate family tree**
3. Canvas opens automatically

**All Trees (Multi-Family Vaults):**
1. Click **Generate all trees**
2. Creates separate canvas for each disconnected family group
3. Files named "Family Tree [N] - [Representative Name].canvas"

The plugin calculates optimal positions using the [family-chart](https://github.com/donatso/family-chart) library and creates the canvas.

---

## Interactive Tree Preview

Before generating a canvas, you can preview your family tree layout using the interactive SVG preview feature. This is particularly useful for large trees (50+ people) where you want to verify the layout before committing to canvas generation.

### Accessing the Preview

1. Open Control Center → Tree Output tab
2. Select your root person and configure tree options
3. Click **Preview tree** to generate the interactive preview

### Preview Controls

**Navigation:**
- **Mouse wheel**: Zoom in/out
- **Click and drag**: Pan around the preview
- **Zoom buttons**: Fine-grained zoom control (+/-)
- **Zoom to fit**: Reset view to show entire tree

**Display Options:**
- **Show labels**: Toggle person name visibility
- **Color scheme**: Switch between Gender, Generation, or Monochrome coloring

**Hover Tooltips:**
Hover over any node to see person details:
- Full name
- Birth and death dates (if available)
- Generation number relative to root person

### Color Schemes

- **Gender**: Green for male, purple for female (genealogy convention)
- **Generation**: Multi-color layers showing generational depth
- **Monochrome**: Neutral gray for clean, professional appearance

### Exporting the Preview

Export the preview as an image file for use outside Obsidian:

**PNG Export:**
- Click **Export PNG** button
- High-resolution raster image suitable for documents and presentations

**SVG Export:**
- Click **Export SVG** button
- Vector format that scales without quality loss
- Ideal for printing or further editing in vector graphics software

### When to Use Preview

- **Large trees**: Verify layout before generating 50+ person canvases
- **Layout comparison**: Test different algorithms (Standard, Compact, Timeline, Hourglass)
- **Quick exports**: Generate shareable images without creating canvas files
- **Research review**: Visually verify relationships before finalizing

---

## Interactive Family Chart View

The Interactive Family Chart View is a persistent, interactive visualization panel for exploring and editing family trees in real-time. Unlike the static canvas exports, it provides a dynamic, explorable interface powered by the [family-chart](https://github.com/donatso/family-chart) library.

### Opening the Family Chart

**Method 1: Command palette**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Open family chart"
3. Select a root person when prompted
4. The chart opens in a new view

**Method 2: From a person note**
1. Open a person note (must have `cr_id` property)
2. Press `Ctrl/Cmd + P`
3. Type "Canvas Roots: Open current note in family chart"
4. The chart opens centered on that person

### Navigation and Exploration

**Pan and zoom:**
- **Mouse wheel**: Zoom in/out
- **Click and drag**: Pan around the chart
- **Zoom buttons**: Fine-grained zoom control in the toolbar
- **Fit to view**: Reset view to show entire tree

**Click interactions:**
- **Single click** on a person card: Center the view on that person
- **Double click** on a person card: Open their note in the editor

### Display Options

**Color schemes:**
Access via the color scheme dropdown in the toolbar:
- **Gender**: Pink for female, blue for male (traditional genealogy colors)
- **Generation**: Different colors for each generation level
- **Collection**: Color by collection membership
- **Monochrome**: Neutral coloring for clean appearance

**Layout spacing:**
Access via the layout settings button (gear icon):
- **Compact**: 200px horizontal spacing (best for large trees)
- **Normal**: 250px horizontal spacing (default)
- **Spacious**: 350px horizontal spacing (best for readability)

**Date display:**
Toggle birth/death dates on person cards via the layout settings menu.

### Edit Mode

Enable edit mode to modify family relationships directly in the chart.

**Enabling edit mode:**
1. Click the **Edit** toggle button in the toolbar
2. The toolbar shows undo/redo buttons when editing is active

**Editing a person:**
1. Click on any person card while in edit mode
2. An edit form appears with fields for:
   - First name and last name
   - Birth date and death date
   - Gender
3. Make your changes and save

**Undo and redo:**
- Use the **Undo** and **Redo** buttons in the toolbar
- Full edit history is maintained during the session

**Bidirectional sync:**
Changes made in the chart automatically update the underlying markdown notes:
- Name changes update the `name` property
- Date changes update `born` and `died` properties
- Gender changes update the `gender` property

### Exporting the Chart

**PNG export:**
1. Click the export menu button in the toolbar
2. Select **Export as PNG**
3. High-resolution image (2x resolution) is saved

**SVG export:**
1. Click the export menu button in the toolbar
2. Select **Export as SVG**
3. Scalable vector graphic is saved for further editing

Both exports preserve your current color scheme and theme (dark/light mode).

### State Persistence

The Family Chart View automatically saves and restores:
- Root person selection
- Color scheme preference
- Edit mode state
- Layout spacing settings
- Date visibility preference
- Approximate zoom level

When you close and reopen a family chart, it returns to the same state.

### Kinship Labels

Toggle relationship labels on connecting lines to show how people are related:

1. Open the **Layout** menu (gear icon in toolbar)
2. Enable **Show kinship labels**
3. Links now display "Parent" or "Spouse" labels

This helps clarify relationship types at a glance, especially useful when presenting or reviewing complex family structures.

### Multiple Chart Views

Open additional family chart tabs to compare different branches or root persons:

**Open a new chart:**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Open new family chart"
3. Select a root person
4. A new chart tab opens alongside existing ones

**Duplicate current chart:**
1. Click the three-dot menu (⋮) on the chart tab
2. Select **Duplicate view**
3. A copy of the current chart opens in a new tab

This allows you to:
- Compare different branches side-by-side
- Keep one view on ancestors while exploring descendants in another
- Navigate to different people without losing your current position

### Toolbar Reference

| Button | Function |
|--------|----------|
| Color dropdown | Switch between color schemes |
| Zoom in/out | Adjust zoom level |
| Search | Find and navigate to a specific person |
| Edit toggle | Enable/disable edit mode |
| Undo/Redo | Reverse or replay edits (edit mode only) |
| Fit to view | Zoom to show entire tree |
| Layout settings | Adjust spacing, date display, and kinship labels |
| Export menu | Save as PNG or SVG |
| Refresh | Reload data from notes |

### When to Use Family Chart vs Canvas

| Feature | Family Chart View | Canvas Generation |
|---------|-------------------|-------------------|
| **Exploration** | Best for browsing large trees | Better for static documentation |
| **Editing** | Direct in-chart editing | Edit source notes, regenerate |
| **Persistence** | View survives reloads | Canvas file saved permanently |
| **Export** | PNG/SVG images | Canvas file, Excalidraw |
| **Integration** | Live sync with notes | Snapshot at generation time |
| **Use case** | Interactive research | Shareable family tree |

**Recommendation:** Use Family Chart View for day-to-day exploration and quick edits. Use Canvas Generation for creating permanent, shareable family tree documents.

---

## Maintaining Trees

### Regenerating After Edits

After editing relationship data in person notes, refresh your canvas to see the changes.

**Method 1: Right-Click Menu (Recommended)**
1. Right-click on the canvas tab (or file in sidebar, or three-dot menu ⋮)
2. Select **"Regenerate canvas"**

**Method 2: Command Palette**
1. Open the canvas you want to regenerate
2. Press `Ctrl/Cmd + P`
3. Type "Canvas Roots: Regenerate canvas"
4. Press Enter

**Method 3: Keyboard Shortcut**
1. Go to Settings → Hotkeys
2. Search for "Regenerate canvas"
3. Assign a custom hotkey (e.g., `Ctrl+Shift+R`)
4. Use the hotkey while viewing any canvas

### What Regeneration Does

The regenerate command:
- ✅ Reads current relationship data from person notes
- ✅ Preserves original tree settings (type, generations, spouses) from canvas metadata
- ✅ Allows changing layout direction while preserving other settings
- ✅ Applies current spacing, sizing, and styling settings
- ✅ Updates the canvas in-place (non-destructive)
- ✅ Uses the latest layout algorithm

**Preserved Settings:**
- Root person
- Tree type (ancestors/descendants/full)
- Generation limits
- Spouse inclusion

**Applied Settings:**
- Current spacing values
- Node coloring scheme
- Arrow styles
- Edge colors
- Spouse edge display preferences

### Common Regeneration Scenarios

**When to Regenerate:**
- Added new spouses, children, or parents to person notes
- Corrected relationship errors (wrong parents, etc.)
- Changed spacing or styling settings
- Imported or edited data via GEDCOM or Bases
- Want to switch layout direction (vertical ↔ horizontal)
- Testing different color schemes

**Workflow Example:**
1. Import GEDCOM file (creates person notes)
2. Generate initial tree
3. Research and add missing relationships in person notes
4. Right-click canvas → "Regenerate canvas"
5. Tree updates with new relationships

---

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

1. **Wait for sync completion** - If bidirectional sync is enabled, Canvas Roots automatically processes all imported relationships to ensure reciprocal links (e.g., when a person has a father, the father's note is updated with that person as a child). Progress notifications show sync status.
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

---

## CSV Import/Export

Canvas Roots supports CSV and TSV file formats for easy data exchange with spreadsheets and other applications. The Import/Export tab in Control Center provides a unified interface for both GEDCOM and CSV operations.

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

Export your family data to CSV format for use in spreadsheets or sharing with others.

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

---

## Selective Branch Export

Export specific portions of your family tree rather than the entire dataset. Available for both GEDCOM and CSV formats in the Import/Export tab.

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

---

## Relationship Calculator

Calculate the genealogical relationship between any two people in your family tree using proper genealogical terminology.

### How It Works

The Relationship Calculator uses BFS (breadth-first search) pathfinding to find the shortest connection path between two people, then translates that path into standard genealogical relationship terms.

### Accessing the Calculator

**Method 1: Command Palette**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Calculate relationship between people"
3. Select the first person
4. Select the second person
5. View the result

**Method 2: Context Menu**
1. Right-click on a person note
2. Select **Calculate relationship**
3. Select the second person to compare
4. View the result

### Understanding Results

**Direct Relationships:**
- Parent, child, grandparent, great-grandparent, etc.
- Sibling, half-sibling
- Uncle/aunt, nephew/niece, great-uncle/great-aunt

**Collateral Relationships (Cousins):**
- 1st cousin, 2nd cousin, 3rd cousin, etc.
- Removals: "1st cousin once removed", "2nd cousin twice removed"
- Common ancestor identification

**In-Law Relationships:**
- Parent-in-law, child-in-law
- Sibling-in-law
- Other in-law connections

### Relationship Path

The calculator displays the complete path showing how two people are connected:

```
John Smith → Mary Smith (spouse) → Robert Jones (father) → Alice Jones
```

This helps you understand the chain of relationships connecting two individuals.

### Copy to Clipboard

Click **Copy result** to copy the relationship description for use in notes or documentation.

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
2. Type "Canvas Roots: Find duplicate people"
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

Adjust detection sensitivity in Settings → Canvas Roots → Data:

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

---

## Staging & Import Cleanup

The staging workflow provides a safe way to process imported data before incorporating it into your main family tree. This is particularly useful when working with messy GEDCOM files, multiple overlapping imports, or data that needs cleanup.

### Setting Up Staging

**Option 1: From Control Center (Recommended)**
1. Open Control Center → **Import/Export** tab
2. Expand the **Configure folders** section at the top
3. Set your **People folder** (where main tree notes live)
4. Set a **Staging folder** path (e.g., `People-Staging`)
5. Enable **Staging isolation** to exclude staging from normal operations

**Option 2: From Plugin Settings**
1. Go to **Settings → Canvas Roots → Data**
2. Set a **Staging folder** path
3. Enable **Staging isolation**

When staging is configured, imported data is kept separate from your main tree until you're ready to promote it.

### Importing to Staging

1. Open Control Center → **Import/Export** tab
2. Select **Format** (GEDCOM or CSV) and **Direction** (Import)
3. Select **Import destination**: choose "Staging" instead of "Main tree"
4. Optionally specify a **Subfolder name** for this import batch (e.g., `smith-gedcom-2024`)
5. Import your GEDCOM or CSV file
6. Data is created in the staging folder, isolated from your main tree

### Using the Staging Tab

The **Staging** tab in Control Center provides tools for managing staged imports:

**Subfolder Management:**
- View all import batches with person counts and dates
- Expand subfolders to see individual files
- Delete subfolders you no longer need

**Cross-Import Detection:**
- Click "Review matches with main tree" to find potential duplicates
- Compare staging records against your main tree
- Mark matches as "Same person" or "Different people"

**Promote Actions:**
- **Promote subfolder**: Move all files from a subfolder to your main people folder
- **Promote all**: Move all staging files to main
- Files marked as "same person" (duplicates) are skipped during promote—use merge instead

### Staging Isolation

When staging is enabled, staged files are automatically excluded from:
- Tree generation (your trees only show main tree data)
- Normal duplicate detection
- Relationship sync operations
- Collections and groups
- Vault statistics

This ensures your production data stays clean while you work on imports.

### Workflow Example

1. Import `smith-family.ged` to staging subfolder `smith-2024`
2. Import `jones-tree.ged` to staging subfolder `jones-2024`
3. Open Staging tab, click "Review matches with main tree"
4. For each match, decide: Same person → Merge, or Different people → will be promoted
5. Click "Promote subfolder" for each batch
6. New unique people are moved to main; duplicates were merged earlier

---

## Merging Duplicate Records

When you find duplicate person records—either through duplicate detection or cross-import review—the Merge Wizard helps you combine them with field-level control.

### Accessing the Merge Wizard

**From Duplicate Detection:**
1. Run command "Find duplicate people"
2. For each potential duplicate, click **Merge**

**From Cross-Import Review:**
1. Open Staging tab → "Review matches with main tree"
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

When merging, Canvas Roots automatically updates relationship references:

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

---

## Reference Numbering Systems

Canvas Roots supports standard genealogical numbering systems for organizing and referencing individuals in your family tree.

### Supported Systems

**Ahnentafel (Ancestor Numbering):**
The Ahnentafel system assigns numbers to ancestors starting from a reference person:
- Person = 1
- Father = 2, Mother = 3
- Paternal grandfather = 4, Paternal grandmother = 5
- Maternal grandfather = 6, Maternal grandmother = 7
- Pattern: Father = 2N, Mother = 2N+1

**d'Aboville (Descendant Numbering with Dots):**
Numbers descendants using dot notation:
- Root person = 1
- Children = 1.1, 1.2, 1.3
- Grandchildren = 1.1.1, 1.1.2, 1.2.1
- Each dot level represents a generation

**Henry System (Compact Descendant Numbering):**
Similar to d'Aboville but without dots:
- Root person = 1
- Children = 11, 12, 13
- Grandchildren = 111, 112, 121
- More compact but less readable for large numbers

**Generation Numbering:**
Assigns relative generation depth from a reference person:
- Reference person = 0
- Parents = -1, Grandparents = -2
- Children = +1, Grandchildren = +2

### Assigning Reference Numbers

**Via Command Palette:**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Assign [system] numbers"
3. Select the reference/root person
4. Numbers are assigned to all related individuals

**Via Context Menu:**
1. Right-click on a person note
2. Select **Reference numbers** submenu
3. Choose the numbering system
4. Numbers are assigned from that person

### Where Numbers Are Stored

Reference numbers are stored in frontmatter properties:
- `ahnentafel`: Ahnentafel number
- `daboville`: d'Aboville number (e.g., "1.2.3")
- `henry`: Henry system number (e.g., "123")
- `generation`: Generation depth number

### Clearing Reference Numbers

**Via Command Palette:**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Clear reference numbers"
3. Select which numbering type to clear
4. Numbers are removed from all person notes

### Using Numbers in Bases

Reference numbers appear in Bases views automatically:
- Sort by Ahnentafel number to see ancestor order
- Filter by generation number to focus on specific generations
- Use d'Aboville/Henry for descendant reports

---

## Lineage Tracking

Track multi-generational lineages from root persons, enabling you to mark people as belonging to specific ancestral lines.

### What Is Lineage Tracking?

Lineage tracking lets you mark people as belonging to named ancestral lines (e.g., "Smith Line", "Tudor Dynasty"). This is useful for:
- Tracking descent from notable ancestors
- Organizing multi-family research
- Identifying which lineage(s) a person belongs to
- Filtering views by ancestral line

### Lineage Types

**Patrilineal (Father's Line):**
Tracks descendants through male lines only (father → son → grandson).

**Matrilineal (Mother's Line):**
Tracks descendants through female lines only (mother → daughter → granddaughter).

**All Descendants:**
Tracks all descendants regardless of gender (includes everyone descended from the root person).

### Assigning Lineages

**Via Context Menu:**
1. Right-click on a person note (usually a notable ancestor)
2. Select **Assign lineage from this person**
3. Choose lineage type (Patrilineal, Matrilineal, or All descendants)
4. Enter a lineage name (e.g., "Smith Line") - suggested name based on surname
5. All qualifying descendants receive the lineage tag

**Via Command Palette:**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Assign lineage from root person"
3. Select the root person
4. Choose lineage type and enter name

### Multiple Lineage Membership

A person can belong to multiple lineages:
```yaml
---
lineage:
  - "Smith Line"
  - "Jones Family"
  - "Tudor Dynasty"
---
```

This occurs when:
- Someone has ancestors from multiple tracked lineages
- You've run lineage assignment multiple times with different root persons

### Removing Lineage Tags

**Via Command Palette:**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Remove lineage tags"
3. Select which lineage to remove (or all lineages)
4. Tags are removed from all person notes

### Using Lineages in Bases

The `lineage` property appears in Bases views:
- Filter by lineage to see all members of an ancestral line
- Use the "By lineage" view in the included Base template
- Cross-reference lineages to find common ancestry

---

## Relationship History & Undo

Canvas Roots tracks all relationship changes, allowing you to review history and undo mistakes.

### Enabling History Tracking

History tracking is enabled by default. Configure in Settings → Canvas Roots → Data:
- **Enable relationship history**: Master toggle
- **History retention days**: How long to keep history (default: 30 days)

### Viewing Relationship History

**Via Command Palette:**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: View relationship history"
3. Review recent changes

**History Modal Shows:**
- Chronological list of all relationship changes
- Change type (add parent, add spouse, remove child, etc.)
- Person affected and related person
- Timestamp of each change
- Statistics by change type

### Undoing Changes

**Undo Most Recent Change:**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Undo last relationship change"
3. Confirm the undo

**Undo Specific Change:**
1. Open relationship history modal
2. Find the change you want to undo
3. Click the **Undo** button next to that entry
4. The change is reversed in both person notes

### What Gets Tracked

- Adding/removing parent relationships
- Adding/removing spouse relationships
- Adding/removing child relationships
- Changes via Control Center, context menus, Bases, or direct frontmatter edits

### Automatic Cleanup

Old history entries are automatically removed based on your retention setting:
- Default: 30 days
- Configure in Settings → Canvas Roots → Data
- Set to 0 for unlimited retention (not recommended for large trees)

---

## Folder Statistics

View comprehensive analytics about person notes in any folder.

### Accessing Folder Statistics

1. Right-click on any folder in the file explorer
2. Select **View folder statistics**
3. Review the statistics modal

### Available Metrics

**Data Completeness:**
- Percentage of notes with required fields (name, cr_id)
- Percentage with birth/death dates
- Percentage with relationship data (parents, spouses, children)

**Relationship Health:**
- Count of orphaned persons (no parents, no children)
- Count of incomplete relationships (missing reciprocal links)
- Count of people marked as root persons

**Family Structure:**
- Total person count
- Gender distribution (male/female/unknown)
- Average relationships per person
- Maximum generation depth
- Number of distinct family groups

### Use Cases

- **Data quality review**: Identify notes missing essential information
- **Research planning**: Find areas needing more research (orphaned persons)
- **Progress tracking**: Monitor completeness as you build your tree
- **Quality assurance**: Verify relationship consistency before exporting

---

## Geographic Features

Canvas Roots provides comprehensive place-based features for tracking where people were born, died, married, and lived. These features support both real-world genealogy and world-building with fictional places.

### Interactive Map View

The Map View provides a Leaflet.js-powered interactive map for visualizing where your family members lived, traveled, and died.

#### Opening Map View

**Option 1: Ribbon Icon**
- Click the map icon in the left ribbon

**Option 2: Command Palette**
1. Open Command Palette (Ctrl/Cmd + P)
2. Search for "Canvas Roots: Open Map View"

**Option 3: Context Menu**
- Right-click on a map note and select "Open in Map View"

#### Map Features

| Feature | Description |
|---------|-------------|
| **Markers** | Color-coded pins for birth (green), death (red), marriage (purple), burial (gray), and life events |
| **Clustering** | Dense marker areas collapse into numbered clusters; click to zoom in |
| **Migration Paths** | Solid indigo lines connecting birth → death locations with person name labels |
| **Journey Paths** | Dashed violet lines connecting all life events chronologically |
| **Heat Map** | Geographic concentration visualization showing where most people lived |
| **Fullscreen** | Click the fullscreen button to expand the map |
| **Mini-map** | Overview inset in the corner for context |
| **Place Search** | Search for places and zoom to their location |

#### Toolbar Controls

The Map View toolbar provides access to all features:

| Button | Function |
|--------|----------|
| **Filters** | Filter by collection, year range |
| **Layers** | Toggle marker types, paths, heat map, journey paths |
| **Time** | Open time slider for "who was alive when?" animation |
| **Map** | Switch between OpenStreetMap and custom image maps |
| **Split** | Open side-by-side map comparison |
| **Export** | Export as GeoJSON or SVG overlay |
| **Edit** | Enter edit mode for custom map alignment (custom maps only) |
| **Refresh** | Reload data from vault |

#### Filtering

**By Collection:**
1. Click **Filters** in the toolbar
2. Select a collection from the dropdown
3. Only people in that collection will be shown

**By Year Range:**
1. Click **Filters** in the toolbar
2. Enter minimum and/or maximum years
3. Click **Apply**

#### Layer Toggles

Control which elements appear on the map:

1. Click **Layers** in the toolbar
2. Toggle individual marker types:
   - Births, Deaths, Marriages, Burials
   - Residences, Occupations, Educations, Military
   - Immigrations, Religious, Custom events
3. Toggle path layers:
   - Migration paths (birth → death)
   - Journey paths (all events chronologically)
4. Toggle heat map layer

#### Time Slider Animation

Visualize "who was alive when?" across your family tree:

1. Click **Time** in the toolbar
2. Use the slider to select a year
3. Click **Play** to animate through time
4. Adjust speed with the speed control
5. Toggle between modes:
   - **Snapshot**: Only show people alive at the selected year
   - **Cumulative**: Show everyone born up to the selected year

The person count displays how many people are visible at each point.

#### Map Comparison (Split View)

Compare different views side-by-side:

1. Click **Split** in the toolbar
2. Choose horizontal or vertical split
3. Each map instance has independent filters
4. Use this to compare:
   - Different time periods
   - Different collections/branches
   - Real-world vs. custom maps

#### Export Options

**GeoJSON Export:**
- Click **Export** → **Export as GeoJSON**
- Creates a standard GeoJSON file with markers and paths
- Compatible with GIS tools (QGIS, ArcGIS, etc.)

**SVG Overlay Export:**
- Click **Export** → **Export as SVG Overlay**
- Creates an SVG file with markers and paths
- Can be embedded in notes or edited in vector graphics software

#### Custom Image Maps

For fictional worlds or historical maps, you can use your own map images:

1. Create a map note with frontmatter:
   ```yaml
   ---
   type: map
   map_id: westeros
   name: Westeros
   universe: got
   image: assets/maps/westeros.png
   bounds:
     north: 50
     south: -50
     west: -100
     east: 100
   ---
   ```

2. Create place notes with the matching universe and coordinates
3. In Map View, use the **Map** dropdown to switch to your custom map

**Coordinate Systems:**
- **Geographic** (default): Uses lat/lng coordinates
- **Pixel**: Uses pixel coordinates (`pixel_x`, `pixel_y`) - ideal for hand-drawn maps

See [Map Image Alignment](#map-image-alignment-edit-mode) for adjusting custom map positioning.

### Place Notes

Place notes are structured markdown files with YAML frontmatter that describe locations. They support hierarchical relationships (city → state → country) and can be linked from person notes.

**Example Place Note:**

```yaml
---
type: place
cr_id: place_abc123
name: "London"
aliases:
  - "City of London"
  - "Londinium"

# Classification
place_category: real  # real | historical | disputed | legendary | mythological | fictional
universe: null        # for fictional/mythological places

# Hierarchy
parent_place: "[[England]]"
place_type: city

# Coordinates (for real/historical places)
coordinates:
  lat: 51.5074
  long: -0.1278

# Historical names
historical_names:
  - name: "Londinium"
    period: "Roman"
---

# London

Notes about this place...
```

### Place Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `real` | Verified real-world location | London, New York, Tokyo |
| `historical` | Real place that no longer exists | Babylon, Constantinople |
| `disputed` | Location debated by historians | Troy, King Solomon's Mines |
| `legendary` | May have historical basis but fictionalized | Camelot, El Dorado |
| `mythological` | Place from mythology/religion | Asgard, Mount Olympus |
| `fictional` | Invented for a story/world | Winterfell, Mordor |

### Creating Place Notes

**Option 1: Control Center**
1. Open Control Center → **Places** tab
2. Click **Create place note**
3. Fill in the place details:
   - Name and aliases
   - Category (real, historical, fictional, etc.)
   - Place type (city, state, country, etc.)
   - Parent place (searchable dropdown)
   - Coordinates (for real places)
4. Click **Create**

**Option 2: Quick-Create from Person Note**
1. Right-click on a person note
2. Select **Create place notes...**
3. Review unlinked place references (from birth_place, death_place, etc.)
4. Click **Create** for each place you want to add
5. Optionally enable auto-linking to convert text to wikilinks

**Option 3: Bulk Create Missing Places**
1. Open Control Center → **Places** tab → **Statistics**
2. Click **Create missing place notes**
3. Review places referenced in person notes but not yet created
4. Create them individually or in batch

### Linking Places to People

Reference places in person notes using wikilinks or plain text:

```yaml
---
# Wikilink format (recommended - creates graph connections)
birth_place: "[[London]]"
death_place: "[[New York City]]"
burial_place: "[[Westminster Abbey]]"

# Plain text format (backwards compatible)
birth_place: "London, England"
---
```

### Life Events Array

Beyond core life events (birth, death, marriage, burial), you can track additional life events using the `events` array in person frontmatter. These events appear as color-coded markers in the Map View.

**Supported Event Types:**

| Event Type | Color | Use For |
|------------|-------|---------|
| `residence` | Blue | Places lived (homes, apartments) |
| `occupation` | Orange | Work locations (offices, factories) |
| `education` | Teal | Schools, universities, training |
| `military` | Brown | Military service locations |
| `immigration` | Cyan | Border crossings, ports of entry |
| `baptism` | Light Purple | Baptism locations |
| `confirmation` | Light Purple | Confirmation ceremonies |
| `ordination` | Light Purple | Religious ordinations |
| `custom` | Pink | Any other life event |

**Example Events Array:**

```yaml
---
birth_place: "[[Boston]]"
death_place: "[[Miami]]"

events:
  - event_type: residence
    place: "[[New York]]"
    date_from: "1920"
    date_to: "1935"
    description: "Family home on 5th Ave"
  - event_type: occupation
    place: "[[Chicago]]"
    date_from: "1935"
    date_to: "1942"
    description: "Steel mill foreman"
  - event_type: military
    place: "[[Normandy]]"
    date_from: "1944-06-06"
    date_to: "1944-08-25"
    description: "D-Day invasion"
  - event_type: education
    place: "[[Harvard University]]"
    date_from: "1915"
    date_to: "1919"
    description: "BA in History"
---
```

**Event Properties:**

| Property | Required | Description |
|----------|----------|-------------|
| `event_type` | Yes | One of the types listed above |
| `place` | Yes | Wikilink to a place note |
| `date_from` | No | Start date (YYYY, YYYY-MM, or YYYY-MM-DD) |
| `date_to` | No | End date (for duration events) |
| `description` | No | Brief description of the event |

**Map View Layer Toggles:**

In Map View, you can toggle visibility of each event type:
1. Click the **Layers** button in the toolbar
2. Each event category has its own checkbox
3. Religious events (baptism, confirmation, ordination) are grouped under "Religious"
4. **Path layers:**
   - "Migration paths (birth → death)" - Direct lines from birthplace to death location
   - "Journey paths (all events)" - Connects all life events chronologically

### Journey Paths (Route Visualization)

Journey paths show a person's complete movement through life by connecting all their events in chronological order.

**How it works:**
- Birth location is always first
- Life events are sorted by date (year)
- Death and burial locations come last
- Consecutive duplicate locations are filtered out

**Visual style:**
- Dashed violet lines (distinct from solid indigo migration paths)
- Arrow decorations showing direction of movement
- Person name labels along the path
- Click the path to see all waypoints in a popup

**To enable:**
1. Open Map View
2. Click **Layers** in the toolbar
3. Check "Journey paths (all events)"

**Use cases:**
- Track immigration routes with multiple stops
- Visualize military service across locations
- Show career progression through cities
- Map pilgrimage or travel routes

**Tips:**
- Events with both `date_from` and `date_to` represent duration events (e.g., a residence from 1920-1935)
- The `place` field should be a wikilink to enable coordinate lookup
- Use `custom` event type for events that don't fit other categories

### Place Statistics

The Places tab in Control Center shows aggregate statistics:

**Overview Metrics:**
- Total places in vault
- Percentage with coordinates
- Orphan places (no parent defined)
- Maximum hierarchy depth

**Category Breakdown:**
- Count of places per category
- Number of associated people per category

**Most Common Locations:**
- Top birth places
- Top death places
- Migration patterns (birth → death flows)

**Actions:**
- Create missing place notes
- Build hierarchy (assign parents to orphan places)
- Standardize place names (find and unify variations)
- View place index (alphabetical with person counts)

### Place Visualizations

Canvas Roots provides D3-based visualizations for place data:

**Network/Schematic View:**
- Places shown as nodes sized by associated person count
- Color coding by category, place type, or hierarchy depth
- Tree and radial layout options
- Interactive tooltips with place details
- Toggle migration flows as directed edges

**Migration Flow Diagram:**
- Arc diagram showing movement patterns between places
- Filter by minimum flow count
- Color-coded nodes (green=birth origin, red=death destination)
- Filter by time period (year range with century presets)
- Filter by collection (family branch)
- Aggregate by hierarchy level (e.g., group by country)

### Place-Based Tree Filtering

Filter tree generation by geographic data:

1. Open Control Center → **Tree Output** tab
2. Configure your tree settings
3. In the **Place filter** section:
   - Enable filtering by birth place, death place, marriage location, or burial place
   - Enter a place name to match
4. Generate tree with only people matching the place criteria

### Geocoding Lookup

For real, historical, or disputed places, look up coordinates automatically:

1. Create or edit a place note
2. Click **Look up coordinates** button
3. Canvas Roots queries Nominatim (OpenStreetMap geocoding)
4. Review and accept the suggested coordinates
5. Parent place is included in the query for better accuracy

**Note:** Geocoding is rate-limited. For bulk lookups, space requests appropriately.

### Custom Place Types

Beyond the built-in types (city, state, country, etc.), you can use custom types:

1. In the place type dropdown, select **Other...**
2. Enter your custom type (e.g., "galaxy", "star-system", "dimension")
3. Custom types are normalized to lowercase with hyphens
4. They appear in statistics alongside standard types

### Places Base Template

Create a pre-configured Obsidian Base for managing places:

1. Right-click on a folder
2. Select **New places base from template**
3. A `.base` file is created with 14 pre-configured views:
   - All Places, By Type, By Category
   - Countries, States/Provinces, Cities/Towns
   - Real Places, Historical Places, Fictional Places
   - By Universe (for fictional places)
   - With Coordinates, Missing Coordinates
   - Orphan Places (no parent)
   - By Collection

### Settings

Configure place features in Settings → Canvas Roots:

**Places Folder:**
- Default destination for new place notes
- Configurable via settings or folder context menu

**Default Place Category:**
- Global default category for new places
- Can be overridden by folder or collection rules

**Place Category Rules:**
- Define automatic category assignment based on folder path or collection
- Example: Places in "Places/Historical" default to `historical` category

### Map Image Alignment (Edit Mode)

Custom map images often need adjustment to align properly with your coordinate system. The Map Image Alignment feature lets you interactively position, scale, rotate, and distort your map image to match geographic coordinates.

#### When to Use Map Alignment

- **Historical maps**: Old maps may have different projections or orientations than modern coordinates
- **Fantasy/fictional maps**: Hand-drawn maps rarely align perfectly with a coordinate grid
- **Scanned images**: Scanning can introduce skew or distortion
- **Composite images**: Maps assembled from multiple sources may need adjustment

#### Entering Edit Mode

1. Open the **Map View** (from ribbon icon or right-click a map note)
2. Select your custom map from the dropdown (not OpenStreetMap)
3. Click the **Edit** button in the toolbar
4. The edit banner appears with alignment controls

#### Using the Corner Handles

When edit mode is active, four corner handles appear around your map image:

- **Drag any corner** to reposition that corner independently
- **Drag opposite corners** in opposite directions to scale the image
- **Drag adjacent corners** to rotate or skew the image
- The image updates in real-time as you drag

**Tip:** Start with small adjustments. It's easier to fine-tune alignment incrementally than to fix large distortions.

#### Edit Banner Controls

| Button | Function |
|--------|----------|
| **Save alignment** | Save current corner positions to the map note's frontmatter |
| **Undo changes** | Revert to the last saved position (discards unsaved edits) |
| **Reset to default** | Clear all saved alignment and return to default rectangular bounds |
| **Cancel** | Exit edit mode without saving |

#### How Alignment is Stored

Corner positions are saved as flat properties in your map note's frontmatter:

```yaml
---
type: map
map_id: middle-earth
name: Middle-earth
image: assets/maps/middle-earth.jpg
bounds:
  north: 50
  south: -50
  west: -100
  east: 100
# Saved alignment corners
corner_nw_lat: 48.5
corner_nw_lng: -95.2
corner_ne_lat: 49.1
corner_ne_lng: -58.3
corner_sw_lat: -45.8
corner_sw_lng: -98.1
corner_se_lat: -44.2
corner_se_lng: -55.7
---
```

When corner properties are present, the map loads with that alignment. When they're absent, the map displays with default rectangular bounds based on the `bounds` configuration.

#### Working with Multiple Map Versions

For complex alignment scenarios, consider maintaining multiple map notes:

**Approach 1: Separate notes for different alignments**
- `Middle-earth.md` — Original unaligned version (no corner properties)
- `Middle-earth (Aligned).md` — Aligned version with saved corners

Both can reference the same image file but have different frontmatter configurations.

**Approach 2: Use Reset to default**
- Make alignment changes and save them
- If you need the original, click "Reset to default" to clear corners
- Re-align as needed

**Approach 3: Manual frontmatter editing**
- Copy the corner properties to a backup location
- Use "Reset to default" to clear
- Paste properties back when needed

#### Best Practices

**Before aligning:**
- Identify reference points on your map (cities, coastlines, rivers)
- Know the approximate coordinates these points should have
- Consider the map's projection (most hand-drawn maps assume flat projection)

**During alignment:**
- Start with rough positioning of one corner
- Work around the map adjusting each corner
- Use known reference points to verify alignment
- Save frequently as you refine

**After alignment:**
- Test by adding place markers and verifying their positions
- Consider exporting the aligned map configuration for backup
- Document your reference points in the map note for future reference

#### Limitations

- Alignment is saved per map note, not per image file
- Very large distortions may cause visual artifacts
- The underlying coordinate system remains unchanged; only the image position changes
- Alignment affects the Map View display only, not canvas generation

---

## Advanced Styling

### Built-in Canvas Roots Styling

Canvas Roots provides styling options within the JSON Canvas standard.

**Access Settings:**
- Control Center → Canvas Settings tab
- Or: Settings → Canvas Roots → Canvas styling

**Node Coloring Schemes:**
- **Gender**: Green for male, purple for female (genealogy convention)
- **Generation**: Different color per generation level (creates visual layers)
- **Monochrome**: No coloring (neutral, clean look)

**Arrow Styles:**
- **Directed (→)**: Single arrow pointing to child/target
- **Bidirectional (↔)**: Arrows on both ends
- **Undirected (—)**: No arrows (just lines)

Configure separately for:
- Parent-child relationships (default: directed)
- Spouse relationships (default: undirected)

**Edge Colors:**
Choose from Obsidian's 6 preset colors or theme default:
- Red, Orange, Yellow, Green, Cyan, Purple, None

**Spouse Edge Display:**
By default, spouse relationships are indicated by positioning only. Optionally show spouse edges with marriage metadata:

1. Enable "Show spouse edges" toggle
2. Choose label format:
   - None (no labels)
   - Date only (e.g., "m. 1985")
   - Date and location (e.g., "m. 1985 | Boston, MA")
   - Full details (e.g., "m. 1985 | Boston, MA | div. 1992")

**Applying Styling:**
- Settings apply to newly generated trees automatically
- For existing trees: right-click → "Regenerate canvas"

### Advanced Canvas Plugin

For styling beyond the JSON Canvas spec, use the [Advanced Canvas](https://github.com/Developer-Mike/obsidian-advanced-canvas) plugin.

**Additional Features:**
- Border styles (dashed, dotted)
- Custom shapes (circles, hexagons)
- Enhanced visual effects (shadows, gradients)

**Installation:**
1. Install Advanced Canvas from Community Plugins
2. Both plugins work independently
3. Canvas Roots handles layout, Advanced Canvas handles advanced styling

**Workflow:**
1. Generate tree with Canvas Roots (handles positioning)
2. Apply standard styling via Canvas Roots settings
3. Optionally apply advanced styling with Advanced Canvas
4. Use "Regenerate canvas" to update tree structure while preserving Advanced Canvas styling

**Note:** Advanced Canvas features may not be portable to other Canvas viewers.

---

## Excalidraw Export

Canvas Roots can export family tree canvases to [Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin) format, enabling manual annotation, hand-drawn styling, and freeform customization while preserving the genealogical layout.

### Why Export to Excalidraw?

Excalidraw provides drawing capabilities not available in standard Canvas:

- **Annotations**: Add handwritten notes, highlights, and comments directly on the tree
- **Custom styling**: Apply hand-drawn aesthetics, colors, and shapes
- **Additional elements**: Draw family crests, photo frames, decorative borders
- **Presentation mode**: Create polished diagrams for sharing or presentation
- **Whiteboard features**: Collaborative editing and real-time drawing

The export preserves your tree's structure (node positions, colors, connections) while converting to an editable Excalidraw drawing.

### How to Export

**Method 1: Context Menu (Recommended)**
1. Right-click on the canvas tab, file, or three-dot menu
2. Select **"Export to Excalidraw"**
3. The Excalidraw file opens automatically in a new tab

**Method 2: Command Palette**
1. Open the canvas you want to export
2. Press `Ctrl/Cmd + P`
3. Type "Canvas Roots: Export to Excalidraw"
4. Press Enter

### What Gets Exported

**Preserved from Canvas:**
- ✅ Node positions (automatically normalized to positive coordinates)
- ✅ Node sizes and dimensions
- ✅ Node colors (converted to Excalidraw color scheme)
- ✅ Person names as text labels
- ✅ Relationship connections as arrows
- ✅ Family tree structure and layout

**Converted to Excalidraw Format:**
- Canvas nodes → Excalidraw rectangles
- Node labels → Excalidraw text elements
- Edges → Excalidraw arrows
- Colors → Excalidraw-compatible color palette

**File Structure:**
The exported `.excalidraw.md` file contains:
- Text elements list (for search/indexing)
- Complete Excalidraw JSON drawing data
- Obsidian-compatible markdown format

### After Export

Once exported, you can:

1. **Edit in Excalidraw**: Double-click the `.excalidraw.md` file to open in Excalidraw plugin
2. **Annotate freely**: Add drawings, shapes, text, and colors
3. **Customize styling**: Change fonts, line styles, hand-drawn effects
4. **Share or present**: Export as PNG, SVG, or share the markdown file

**Important Notes:**
- The exported Excalidraw file is a **one-time snapshot** of the Canvas tree
- Changes to person notes or relationships **will not update** the Excalidraw file
- To update: re-export from Canvas after regenerating the tree
- Excalidraw edits are preserved in the `.excalidraw.md` file itself

### Workflow Example

**Research → Canvas → Excalidraw → Presentation**

1. **Build tree in Canvas**: Use Canvas Roots to generate and style your family tree
2. **Export to Excalidraw**: Convert the structured tree to editable drawing
3. **Annotate and enhance**: Add photos, dates, notes, decorative elements
4. **Present or share**: Export polished diagram for presentations or publications

**Iterative Updates:**

1. Research and update person notes with new relationships
2. Regenerate Canvas tree to reflect updates
3. Re-export to Excalidraw (creates new file or overwrites)
4. Re-apply annotations as needed

### Requirements

- [Excalidraw plugin](https://github.com/zsviczian/obsidian-excalidraw-plugin) must be installed and enabled
- Canvas file must be a valid Canvas Roots-generated family tree
- Excalidraw files are stored alongside Canvas files (same vault location)

### Troubleshooting

**Excalidraw file appears blank:**
- Ensure Excalidraw plugin is installed and up-to-date
- Check Canvas Roots version (export fixes in v0.2.1+)
- Try re-exporting the Canvas

**Nodes positioned incorrectly:**
- Canvas Roots automatically normalizes negative coordinates to positive space
- If issues persist, try regenerating the Canvas first, then re-export

**Missing connections:**
- Verify the Canvas tree generated correctly before export
- Check that all person nodes have valid relationships

For more help, see [troubleshooting section](#troubleshooting) or open an issue on [GitHub](https://github.com/banisterious/obsidian-canvas-roots/issues).

---

## Split Canvas Wizard

The Split Canvas Wizard helps you plan how to split large family trees into manageable segments. This is useful when you have a tree that's too large to view comfortably on a single canvas, or when you want to focus on specific family lines.

### Accessing the Wizard

1. Right-click on any canvas file
2. Select **Canvas Roots** → **Split canvas wizard**

### Split Methods

The wizard offers six different split methods:

#### By Generation
Split your tree into separate canvases based on generation ranges:
- Configure how many generations per canvas
- Choose direction: ancestors (older generations first) or descendants (younger first)
- Useful for very deep trees (10+ generations)

#### By Branch
Separate paternal and maternal lines:
- Create separate canvases for father's ancestors vs mother's ancestors
- Optionally include descendant branches
- Useful for focusing on specific family lines

#### Single Lineage
Extract a direct line between two specific people:
- Select a start person (e.g., oldest known ancestor)
- Select an end person (e.g., yourself or youngest descendant)
- Optionally include spouses of people on the line
- Optionally include siblings at each generation
- Useful for surname studies or lineage documentation

#### By Collection
Create one canvas per user-defined collection:
- Select which collections to include
- Bridge people (those in multiple collections) can appear on multiple canvases
- Useful for multi-family research projects

#### Ancestor + Descendant Pair
Generate linked ancestor and descendant canvases for the same person:
- Select a root person as the pivot point
- Configure maximum generations in each direction
- Optionally include spouses
- Creates two linked canvases plus optional overview

#### By Surname
Extract all people with a given surname, even without established family connections:
- Scrollable list shows all surnames sorted by frequency
- Select one or more surnames to extract
- **Include spouses**: Also include spouses who have different surnames
- **Include maiden names**: Match people whose maiden name matches (from frontmatter)
- **Handle name variants**: Treat similar spellings as the same surname (e.g., Smith/Smythe)
- **Separate canvas per surname**: Create one canvas per surname, or combine all into one

This is particularly useful for:
- Consolidating unconnected GEDCOM imports that share surnames
- Surname studies when family connections aren't fully established
- Research projects focused on a specific surname
- Extracting people from different family branches who share a name

### Output Options

All split methods share common output options:

- **Output folder**: Where to save generated canvases
- **Filename prefix**: Prefix for canvas file names
- **Include navigation nodes**: Add portal nodes linking between canvases
- **Generate overview canvas**: Create a master canvas showing relationships

### Preview

The final step shows a preview of what will be generated:
- Number of canvases to be created
- Total people included
- List of canvas files with person counts

**Note:** Canvas generation is planned for a future update. Currently, the wizard provides planning and preview functionality.

---

## Tips & Best Practices

### Data Management

**Use `cr_id` UUIDs:**
- Generate unique UUIDs for stable identification
- Enable auto-generation in settings for new notes
- Preserves relationships when files are renamed/moved

**Organize Person Notes:**
- Store in dedicated folder (e.g., "People" or "Family")
- Configure folder in Settings → Canvas Roots
- Use consistent naming (e.g., "John Smith.md")

**Leverage Obsidian Bases:**
- Bulk edit relationships and dates
- Sort by birth year to find gaps
- Filter by generation or family line
- Export to CSV for backup

### Tree Generation

**Start Small:**
- Generate tree for one ancestor first
- Test layout and styling options
- Expand to full family trees once satisfied

**Multi-Family Vaults:**
- Use "Generate all trees" for batch creation
- Canvas Roots auto-detects disconnected groups
- Each family gets its own canvas

**Experiment with Layout:**
- Try both vertical and horizontal directions
- Adjust spacing for different screen sizes
- Use generation limits for focused views

### Styling

**Choose Appropriate Color Schemes:**
- Gender coloring: Traditional genealogy charts
- Generation coloring: Emphasize generational layers
- Monochrome: Clean, professional presentations

**Spouse Edge Visibility:**
- Default (hidden): Clean, minimal look
- Date-only: Show marriage years for context
- Full details: Comprehensive for research/documentation

### Performance

**Large Trees (100+ people):**
- Use generation limits for initial exploration
- Generate focused subtrees (ancestors OR descendants)
- Regenerate only when necessary

**Canvas Navigation:**
- Use Obsidian's Canvas pan/zoom controls
- Double-click nodes to open person notes
- Right-click canvas background for context menu

### Workflow Integration

**Research Workflow:**
1. Import GEDCOM or create initial notes
2. Generate tree to visualize relationships
3. Research individuals and add notes
4. Update relationships as you discover new information
5. Regenerate canvas to reflect updates

**Collaboration:**
- Share vault with collaborators
- Use git for version control
- GEDCOM export (planned) will enable sharing with non-Obsidian users

---

## Troubleshooting

**Tree not generating?**
- Check that root person has `cr_id` value
- Verify relationships use valid `cr_id` references
- Enable debug logging in Settings → Canvas Roots → Logging

**Missing people in tree?**
- Ensure `cr_id` values match between relationships
- Check generation limits (may exclude distant relatives)
- Verify spouse inclusion setting if spouses are missing

**Layout issues?**
- Try different spacing values
- Switch between vertical/horizontal layout
- Regenerate with latest settings

**GEDCOM import problems?**
- Check file is valid GEDCOM format
- Review import log for errors
- Try smaller GEDCOM file first to test

For more help, see [troubleshooting section](development.md#troubleshooting) in the development guide or open an issue on [GitHub](https://github.com/banisterious/obsidian-canvas-roots/issues).

---

## Next Steps

- Review [bases-integration.md](bases-integration.md) for bulk data management
- Check [roadmap.md](roadmap.md) for upcoming features
- Read [development.md](development.md) for technical details and architecture
- Join discussions on [GitHub](https://github.com/banisterious/obsidian-canvas-roots)

**Happy tree building!** 🌳
