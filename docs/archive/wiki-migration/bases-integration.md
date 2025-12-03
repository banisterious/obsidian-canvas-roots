# Bases Integration Guide

Canvas Roots is designed to work seamlessly with [Obsidian Bases](https://help.obsidian.md/bases), the core plugin for managing structured data in table views.

## Table of Contents

- [Overview](#overview)
- [Why Use Bases with Canvas Roots?](#why-use-bases-with-canvas-roots)
- [Quick Start](#quick-start)
- [Property Reference](#property-reference)
- [Example Views](#example-views)
- [Advanced Formulas](#advanced-formulas)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

**Bases** provides a table-based interface for viewing and editing note properties, making it ideal for managing genealogical data:

- **Table View**: Edit multiple people at once in a spreadsheet-like interface
- **Filtering**: Focus on specific family members or data subsets
- **Formulas**: Calculate ages, lifespans, and other derived values
- **Sorting**: Organize by birth date, name, or any property
- **Summaries**: Aggregate statistics across your family tree

**Canvas Roots** reads the same YAML frontmatter properties that Bases edits, creating a powerful dual-entry workflow:

```
Individual Notes ←→ Bases Table View
         ↓
   Canvas Roots
         ↓
  Family Tree Visualization
```

## Why Use Bases with Canvas Roots?

### Bulk Data Entry
Edit multiple family members in a single table view instead of opening individual notes.

### Data Validation
Quickly spot missing data, inconsistencies, or errors across your entire family tree.

### Calculated Fields
Create formulas to automatically calculate:
- Current age of living members
- Lifespan of deceased members
- Generation spans
- Data completeness metrics

### Flexible Filtering
Create custom views for:
- Living vs. deceased members
- Members missing parent information
- Recently added people
- Specific generations or branches

## Quick Start

### 1. Enable Bases Plugin

Bases is a core Obsidian plugin:

1. Open Settings → Core plugins
2. Enable "Bases"

### 2. Copy the Template

Canvas Roots provides a ready-to-use Base template:

1. Navigate to `docs/assets/templates/family-members.base`
2. Copy the file to your vault
3. Rename it as desired (e.g., `My Family.base`)

### 3. Open the Base

Double-click the `.base` file to open the table view. You should see all notes with a `cr_id` property.

### 4. Start Editing

Click any cell to edit properties. Changes are immediately saved to the note's YAML frontmatter.

## Property Reference

> **Complete Reference:** For the full property schema including advanced spouse metadata, reference numbering systems, and planned place note properties, see the [Frontmatter Schema Reference](reference/frontmatter-schema.md).

Canvas Roots uses these core properties in note frontmatter:

### Required Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `cr_id` | String | Unique identifier (UUID) | `abc-123-def-456` |

### Relationship Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `father` | Link | Link to father's note | `[[John Smith]]` |
| `mother` | Link | Link to mother's note | `[[Jane Doe]]` |
| `spouse` | Link or List | Link(s) to spouse(s) | `[[Mary Jones]]` or `["[[Mary]]", "[[Sarah]]"]` |
| `child` | Link or List | Link(s) to children | `["[[Bob]]", "[[Alice]]"]` |

### Biographical Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `name` | String | Full name | `John Robert Smith` |
| `born` | Date | Birth date | `1888-05-15` |
| `died` | Date | Death date | `1952-08-20` |
| `gender` | String | Gender (optional) | `M`, `F`, or custom |

### Optional Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `birthPlace` | String | Place of birth | `Boston, MA` |
| `deathPlace` | String | Place of death | `New York, NY` |
| `occupation` | String or List | Occupation(s) | `Teacher` or `["Farmer", "Soldier"]` |

### Internal Properties

| Property | Type | Description |
|----------|------|-------------|
| `cr_root` | Boolean | Marks this person as tree root (set by plugin) |

## Example Views

The template includes several pre-configured views:

### All Family Members
Default view showing everyone with a `cr_id`, sorted by birth date.

**Use case**: Overview of your entire family tree

### Living Members
Shows only people without a `died` date.

**Use case**: Focus on living relatives, calculate current ages

### Deceased Members
Shows only people with a `died` date.

**Use case**: Historical research, lifespan analysis

### Recently Added
Shows people added in the last 30 days.

**Use case**: Track recent research progress

### Missing Parents
Shows people without `father` or `mother` defined.

**Use case**: Identify gaps in your tree, prioritize research

### Incomplete Data
Shows people missing `born` or `name` properties.

**Use case**: Data quality checks

## Advanced Formulas

### Calculating Current Age

```yaml
formulas:
  age_now: 'if(born && !died, now().year() - born.year(), "")'
```

This calculates the age of living members based on their birth date.

### Lifespan Calculation

```yaml
formulas:
  full_lifespan: 'if(born && died, died.year() - born.year() + " years", "")'
```

Shows how many years a deceased person lived.

### Display Name Fallback

```yaml
formulas:
  display_name: 'name || file.name'
```

Shows the `name` property if present, otherwise uses the filename.

### Generation Span

```yaml
formulas:
  birth_decade: 'if(born, Math.floor(born.year() / 10) * 10 + "s", "")'
```

Groups people by the decade they were born in.

### Data Completeness

```yaml
formulas:
  completeness: '((!!name + !!born + !!died + !!father + !!mother) / 5 * 100).toFixed(0) + "%"'
```

Shows what percentage of core data fields are filled in.

### Relationship Count

```yaml
formulas:
  child_count: 'list(child).length'
  spouse_count: 'list(spouse).length'
```

Counts the number of children or spouses (handles both single values and arrays).

## Best Practices

### 1. Use Consistent Date Formats

Always use ISO format for dates: `YYYY-MM-DD`

✅ Good: `1888-05-15`
❌ Bad: `May 15, 1888` or `15/5/1888`

Bases can parse and manipulate ISO dates with built-in date functions.

### 2. Use Wikilinks for Relationships

Always use wikilink syntax for relationships:

✅ Good: `[[John Smith]]`
❌ Bad: `John Smith`

Wikilinks are automatically recognized as Link objects in Bases and are clickable.

### 3. Handle Arrays Consistently

For `spouse` and `child`, always use arrays if there's a possibility of multiple values:

```yaml
spouse: ["[[Mary Jones]]"]  # Array with one element
child: ["[[Bob]]", "[[Alice]]"]  # Array with multiple elements
```

This prevents issues when adding additional relationships later.

### 4. Tag Person Notes

Add a `#person` tag to all family member notes:

```yaml
---
tags:
  - person
cr_id: abc-123
---
```

This makes filtering easier and allows you to exclude non-person notes.

### 5. Use the `name` Property

While Canvas Roots can use the filename as a fallback, explicitly setting the `name` property gives you more flexibility:

```yaml
---
name: John Robert Smith
---
```

File can be renamed to `john-smith.md` without affecting display.

### 6. Create Multiple Views

Don't try to make one view do everything. Create specialized views for different tasks:

- **Data Entry View**: Minimal columns, easy to add new people
- **Research View**: All fields visible, sorted by missing data
- **Analysis View**: Formulas and summaries, sorted by patterns

## Troubleshooting

### Base Shows No Results

**Problem**: Base table is empty even though person notes exist.

**Solutions**:
1. Check that notes have the `cr_id` property
2. Verify the `filters` section in your `.base` file
3. Ensure notes are in the vault (not in `.obsidian` folder)

### Links Don't Work

**Problem**: Clicking a link in the base doesn't open the note.

**Solutions**:
1. Ensure you're using wikilink syntax: `[[Note Name]]`
2. Check that the linked note exists
3. Verify the link is in the note frontmatter (not just the base formula)

### Formulas Show Errors

**Problem**: Formula cells show `ERROR` or blank values.

**Solutions**:
1. Check formula syntax in the `.base` file
2. Verify property names are correct (case-sensitive)
3. Handle missing values with `if()` checks: `if(born, born.year(), "")`
4. Use `list()` function for properties that might be single values or arrays

### Changes Don't Appear in Canvas

**Problem**: Edited data in Bases doesn't show in Canvas Roots tree.

**Solutions**:
1. Run the "Re-Layout Current Canvas" command to refresh
2. Verify changes were saved to note frontmatter (open the note to check)
3. Check the Canvas is reading from the correct note files

### Arrays Display Strangely

**Problem**: Spouse or child arrays show as `[object Object]` or similar.

**Solutions**:
1. Use `.length` to count: `list(child).length`
2. Use `.join(", ")` to display as text: `list(spouse).map(s => s.toString()).join(", ")`
3. Create a formula to format the list properly

## Integration with Canvas Roots Workflow

### Recommended Workflow

1. **Initial Setup**: Create person notes with basic data (name, dates)
2. **Bulk Entry**: Use Bases to quickly add relationships and fill in missing data
3. **Visualization**: Run Canvas Roots to generate the family tree
4. **Refinement**: Identify gaps in the tree, use Bases to add missing people
5. **Re-layout**: Update the Canvas with new data
6. **Analysis**: Use Bases formulas to analyze patterns and data quality

### When to Use Bases vs. Individual Notes

**Use Bases when:**
- Adding multiple people at once
- Filling in the same property across many notes (e.g., adding birth dates)
- Finding patterns or missing data
- Doing data quality checks

**Use Individual Notes when:**
- Writing detailed biographical information
- Adding sources, images, or extensive notes
- Creating complex narrative content
- Linking to external research

### Bidirectional Relationship Sync

Canvas Roots automatically maintains reciprocal relationships to ensure data consistency across your family tree.

**How It Works:**

When bidirectional sync is enabled (default), editing relationships in Bases automatically updates both person notes:

1. Edit `father: [[John Smith]]` in a Bases row for Alice
2. Canvas Roots automatically adds `children: [[Alice]]` to John's note
3. The change appears immediately in Bases (if John is visible in the table)
4. Canvas trees automatically reflect the bidirectional relationship

**What Gets Synced:**

- **Parent → Child**: Setting `father`/`mother` adds person to parent's `children` array
- **Spouse ↔ Spouse**: Adding `spouse` creates reciprocal spouse link in both notes
- **Indexed Spouses**: Full support for `spouse1`, `spouse2`, etc. with `spouse1_id`, `spouse2_id`
- **Deletions**: Removing a relationship automatically removes the reciprocal link (e.g., deleting `father` removes person from parent's `children`)

**Enabling/Disabling:**

Go to Settings → Canvas Roots → Data section:

- **Enable bidirectional relationship sync**: Master toggle (default: ON)
- **Sync on file modify**: Auto-sync when editing notes or Bases (default: ON)

When sync is enabled, relationship changes made anywhere (Bases, frontmatter editor, or programmatically) are automatically propagated.

**Sync Triggers:**

- **File edits**: When you edit relationships in Bases or frontmatter (if "Sync on file modify" is enabled)
- **GEDCOM imports**: After importing a GEDCOM file, all relationships are automatically synced across all imported person notes

**Example Workflows:**

**Adding a Relationship:**
```yaml
# In Bases, edit Alice's row:
father: [[John Smith]]

# Canvas Roots automatically updates John Smith's note:
children: ["[[Alice]]"]
children_id: ["alice-cr-id-123"]

# Both changes are immediate and bidirectional
```

**Deleting a Relationship:**
```yaml
# In Bases, clear Alice's father field:
father:  # (empty)

# Canvas Roots automatically removes Alice from John Smith's note:
# "Alice" removed from children array
# "alice-cr-id-123" removed from children_id array
```

**GEDCOM Import Workflow:**

When importing a GEDCOM file with bidirectional sync enabled:

1. Import completes and creates all person notes with relationship data
2. Canvas Roots automatically syncs all relationships across all imported people
3. Progress notification shows sync status (e.g., "Syncing relationships: 50/200 people processed")
4. Completion notice confirms all relationships are bidirectional

This ensures relationship consistency across your entire tree and eliminates manual duplicate entry.

**Known Limitations:**

Bidirectional sync works by tracking relationship changes over time. There are a few edge cases to be aware of:

1. **Sync disabled during deletion**: If you disable bidirectional sync (or "Sync on file modify"), delete relationships, and then re-enable sync, the reciprocal links won't be automatically cleaned up. You'll need to manually remove them or use the "Validate relationships" command to find orphaned links.

2. **Bulk external edits**: If you edit many files externally (e.g., in VS Code) while Obsidian is closed, the sync will only see the final state when you reload Obsidian, not the intermediate changes.

These limitations are expected behavior and don't affect normal usage. The sync works reliably for day-to-day editing in Obsidian, Bases, or external editors while Obsidian is running.

## Additional Resources

- [Obsidian Bases Documentation](https://help.obsidian.md/bases)
- [Bases Syntax Reference](https://help.obsidian.md/bases/syntax)
- [Canvas Roots Property Reference](property-reference.md)
- [Example Family Base Template](assets/templates/family-members.base)

## Questions?

- **General questions**: [GitHub Discussions](https://github.com/banisterious/obsidian-canvas-roots/discussions)
- **Bug reports**: [GitHub Issues](https://github.com/banisterious/obsidian-canvas-roots/issues)
- **Feature requests**: [GitHub Issues](https://github.com/banisterious/obsidian-canvas-roots/issues) with "enhancement" label
