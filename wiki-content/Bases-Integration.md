# Bases Integration

Canvas Roots is designed to work seamlessly with [Obsidian Bases](https://help.obsidian.md/bases), the core plugin for managing structured data in table views.

---

## Table of Contents

- [Overview](#overview)
- [Available Base Templates](#available-base-templates)
- [Why Use Bases with Canvas Roots?](#why-use-bases-with-canvas-roots)
- [Quick Start](#quick-start)
- [Property Reference](#property-reference)
- [Example Views](#example-views)
- [Advanced Formulas](#advanced-formulas)
- [Best Practices](#best-practices)
- [Places Base Template](#places-base-template)
- [Organizations Base Template](#organizations-base-template)
- [Troubleshooting](#troubleshooting)
- [Integration with Canvas Roots Workflow](#integration-with-canvas-roots-workflow)
- [Map View for Bases](#map-view-for-bases)
- [Additional Resources](#additional-resources)

---

## Overview

**Bases** provides a table-based interface for viewing and editing note properties, making it ideal for managing genealogical data:

- **Table View**: Edit multiple records at once in a spreadsheet-like interface
- **Filtering**: Focus on specific subsets of data
- **Formulas**: Calculate ages, lifespans, and other derived values
- **Sorting**: Organize by date, name, or any property
- **Summaries**: Aggregate statistics across your data

**Canvas Roots** reads the same YAML frontmatter properties that Bases edits, creating a powerful dual-entry workflow:

```
Individual Notes ←→ Bases Table View
         ↓
   Canvas Roots
         ↓
  Visualization (Trees, Maps, etc.)
```

## Available Base Templates

Canvas Roots provides ready-to-use templates for five entity types:

| Template | Data Type | Key Features |
|----------|-----------|--------------|
| **People** | Person notes | Relationships, dates, lifespans |
| **Places** | Place notes | Coordinates, hierarchies, categories |
| **Events** | Event notes | Life events and milestones |
| **Organizations** | Organization notes | Types, members, universes |
| **Sources** | Source notes | Citations and references |

### Creating Base Templates

**From Control Center (Guide tab):**
1. Open Control Center → **Guide** tab
2. Find the **Base templates** card
3. Click any template type to create it

**From Control Center (Data Quality tab):**
1. Open Control Center → **Data quality** tab
2. Find the **Data tools** section
3. Select a template type from the dropdown and click **Create**

**From Context Menu:**
Right-click any folder and select:
- "Create people Base template"
- "Create places Base template"
- "Create events Base template"
- "Create organizations Base template"
- "Create sources Base template"

**From Command Palette:**
- `Canvas Roots: Create base template` (People)
- `Canvas Roots: Create places base template`
- `Canvas Roots: Create events base template`
- `Canvas Roots: Create organizations base template`
- `Canvas Roots: Create sources base template`

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

### 2. Create a Base Template

Use Control Center to create a template:

1. Open Control Center → **People** tab (or Places/Organizations)
2. Find the **Data tools** card
3. Click "Create base template"
4. The template is created in your configured folder

### 3. Open the Base

Double-click the `.base` file to open the table view. You should see all matching notes.

### 4. Start Editing

Click any cell to edit properties. Changes are immediately saved to the note's YAML frontmatter.

## Property Reference

> **Complete Reference:** For the full property schema including advanced spouse metadata, reference numbering systems, and place note properties, see the [Frontmatter Reference](Frontmatter-Reference).

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

## Places Base Template

The Places template provides a table view for managing geographic locations:

### Key Columns
- **Name**: Place name
- **Category**: Type of place (city, country, region, etc.)
- **Parent**: Hierarchical parent location
- **Coordinates**: Latitude/longitude
- **Universe**: For fictional locations

### Useful Formulas

**Has Coordinates:**
```yaml
has_coords: 'if(latitude && longitude, "Yes", "No")'
```

**Hierarchy Depth:**
```yaml
depth: 'if(parent, 1, 0)'  # Simplified; actual hierarchy may be deeper
```

## Organizations Base Template

The Organizations template provides a table view for managing organizations and memberships:

### Key Columns
- **Name**: Organization name
- **Type**: Organization type (guild, corporation, noble_house, etc.)
- **Universe**: For fictional organizations
- **Members**: Count of people with membership

### Organization Types
Built-in types: noble_house, guild, corporation, military, religious, political, educational, custom

### Useful Formulas

**Type Display:**
```yaml
type_label: 'org_type || "Other"'
```

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

## Map View for Bases

[Obsidian Maps](https://github.com/obsidianmd/obsidian-maps) is an official community plugin that adds a Map view layout to Bases. If you're using Obsidian 1.10+, you can install it to display your place notes on an interactive map directly within a Base.

### Setting Up Map View

1. Install **Obsidian Maps** from Community Plugins
2. Create a Places Base using the Canvas Roots template
3. In the Base, click the view dropdown → **Map**
4. Configure the view settings:
   - Set "Marker coordinates" to `coordinates`
   - Optionally set "Marker icon" and "Marker color" to custom properties

### When to Use Obsidian Maps vs. Canvas Roots Map View

| Obsidian Maps | Canvas Roots Map View |
|---------------|----------------------|
| Simple place browsing within a Base | Migration paths (birth → death) |
| Embedded map in a note | Journey paths through life events |
| Custom icons/colors per place | Heat map visualization |
| Query-filtered views | Time slider animation |
| | Marker clustering |
| | Custom image maps (fictional/historical) |

For detailed comparison and coordinated workflows, see [Geographic Features → Using Obsidian Maps Alongside Canvas Roots](Geographic-Features#using-obsidian-maps-alongside-canvas-roots).

## Additional Resources

- [Obsidian Bases Documentation](https://help.obsidian.md/bases)
- [Bases Syntax Reference](https://help.obsidian.md/bases/syntax)
- [Obsidian Maps Plugin](https://github.com/obsidianmd/obsidian-maps) - Map view for Bases
- [Frontmatter Reference](Frontmatter-Reference) - Complete property documentation
- [Geographic Features](Geographic-Features) - Place notes and maps
- [Organization Notes](Organization-Notes) - Organizations and memberships
