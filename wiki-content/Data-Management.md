# Data Management

This page covers how to manage and organize your family data, including bidirectional sync, collections, and maintaining trees.

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

### Known Limitations

1. **Sync disabled during deletion**: If you disable bidirectional sync (or "Sync on file modify"), delete relationships, and then re-enable sync, the reciprocal links won't be automatically cleaned up. You'll need to manually remove them or use the "Validate relationships" command to find orphaned links.

2. **Bulk external edits**: If you edit many files externally (e.g., in VS Code) while Obsidian is closed, the sync will only see the final state when you reload Obsidian, not the intermediate changes.

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

## Collections & Groups

Canvas Roots provides two complementary ways to organize people in your vault.

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

### Using Collections in Tree Generation

Filter generated trees by collection membership:

1. Open Control Center → Tree Generation tab
2. Configure your tree settings
3. **Filter by collection**: Select a specific collection (optional)
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

**Pro Tip:** Use both together! Group names for automated organization, collections for your custom research categories.

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
