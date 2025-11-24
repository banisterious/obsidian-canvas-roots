# Canvas Roots: User Guide

> **Version:** v0.2.1-beta
> **Last Updated:** 2025-01-23

This guide covers the complete workflow for using Canvas Roots to create and maintain family trees in Obsidian.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Data Entry](#data-entry)
3. [Bidirectional Relationship Sync](#bidirectional-relationship-sync)
4. [Collections & Groups](#collections--groups)
5. [Generating Trees](#generating-trees)
6. [Maintaining Trees](#maintaining-trees)
7. [GEDCOM Import](#gedcom-import)
8. [Advanced Styling](#advanced-styling)
9. [Excalidraw Export](#excalidraw-export)
10. [Tips & Best Practices](#tips--best-practices)

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

See [specification.md §6.1](specification.md) for complete marriage metadata documentation.

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

## GEDCOM Import

Canvas Roots can import standard GEDCOM (`.ged`) files from genealogy software.

### Importing a GEDCOM File

**Using Control Center:**
1. Open Control Center → Data Entry tab
2. Click **Import GEDCOM**
3. Select your `.ged` file
4. Configure import options:
   - Target folder for person notes
   - UUID handling (preserve or generate new)
5. Click **Import**

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

See [specification.md §5](specification.md) for complete GEDCOM integration details.

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

- Read [specification.md](specification.md) for complete technical details
- Review [bases-integration.md](bases-integration.md) for bulk data management
- Check [roadmap.md](roadmap.md) for upcoming features
- Join discussions on [GitHub](https://github.com/banisterious/obsidian-canvas-roots)

**Happy tree building!** 🌳
