# Custom Relationships

Custom relationships allow you to define and track non-family connections between people in your genealogical database. While standard family links (father, mother, spouse, children) are handled automatically, custom relationships let you capture additional connections like godparents, guardians, mentors, witnesses, and more.

---

## Table of Contents

- [Overview](#overview)
- [Built-in Relationship Types](#built-in-relationship-types)
- [Adding Custom Relationships](#adding-custom-relationships)
- [Frontmatter Format](#frontmatter-format)
- [Control Center - Relationships Tab](#control-center---relationships-tab)
- [Canvas Edge Rendering](#canvas-edge-rendering)
- [Commands and Context Menu](#commands-and-context-menu)
- [Best Practices](#best-practices)

---

## Overview

Custom relationships are:
- **Stored in person note frontmatter** in a `relationships` array
- **Typed** - each relationship has a defined type with properties like color and inverse
- **Directional or symmetric** - some relationships have inverses (godparent/godchild), others are symmetric (witness)
- **Separate from family links** - they complement but don't replace standard genealogical connections

### Terminology

To avoid confusion, Charted Roots uses distinct terms:

| Term | Description |
|------|-------------|
| **Family links** | Standard genealogical connections (father, mother, spouse, children) shown in the Status tab |
| **Custom relationships** | Extended relationship types managed in the Relationships tab |

---

## Built-in Relationship Types

Charted Roots includes 12 pre-defined relationship types across 4 categories:

### Legal/Guardianship

| Type | Inverse | Color |
|------|---------|-------|
| Guardian | Ward | Teal |
| Ward | Guardian | Teal |
| Adoptive Parent | Adopted Child | Teal |
| Adopted Child | Adoptive Parent | Teal |
| Foster Parent | Foster Child | Teal |
| Foster Child | Foster Parent | Teal |

### Religious/Spiritual

| Type | Inverse | Color |
|------|---------|-------|
| Godparent | Godchild | Blue |
| Godchild | Godparent | Blue |
| Mentor | Disciple | Purple |
| Disciple | Mentor | Purple |

### Professional

| Type | Inverse | Color |
|------|---------|-------|
| Master | Apprentice | Orange |
| Apprentice | Master | Orange |

### Social

| Type | Inverse | Color |
|------|---------|-------|
| Witness | (symmetric) | Gray |

---

## Adding Custom Relationships

### Via Context Menu

1. Right-click on a person note
2. Navigate to **Charted Roots** → **Relationships** → **Add custom relationship...**
3. In the modal:
   - Select the relationship type from the dropdown (grouped by category)
   - Click "Select person" to choose the target person
   - Optionally add notes about the relationship
4. Click "Add relationship"

### Via Command Palette

1. Open a person note
2. Open the command palette (`Ctrl/Cmd + P`)
3. Run **Charted Roots: Add custom relationship to current person**
4. Follow the same modal workflow as above

### Manual Frontmatter

Add a `relationships` array to the person note frontmatter:

```yaml
---
name: John Smith
cr_id: person-john-smith
relationships:
  - type: godparent
    target: "[[Jane Doe]]"
    target_id: person-jane-doe
    notes: "Became godparent at baptism in 1920"
  - type: mentor
    target: "[[Robert Brown]]"
    target_id: person-robert-brown
---
```

---

## Frontmatter Format

### Relationship Properties

| Property | Required | Description |
|----------|----------|-------------|
| `type` | Yes | The relationship type ID (e.g., `godparent`, `guardian`, `mentor`) |
| `target` | Yes | Wikilink to the target person note |
| `target_id` | Yes | The `cr_id` of the target person (for robust tracking) |
| `notes` | No | Optional notes about the relationship |

### Example

```yaml
relationships:
  - type: godparent
    target: "[[Jane Doe]]"
    target_id: person-jane-doe
    notes: "Became godparent at baptism in 1920"
  - type: mentor
    target: "[[Robert Brown]]"
    target_id: person-robert-brown
  - type: witness
    target: "[[Mary Johnson]]"
    target_id: person-mary-johnson
    notes: "Witnessed marriage ceremony"
```

---

## Control Center - Relationships Tab

The Relationships tab in Control Center provides comprehensive relationship management:

### Custom Relationship Types Card

- **Table view** of all available relationship types
- **Color swatches** showing edge colors for each type
- **Category column** showing type grouping
- **Inverse column** showing the inverse relationship (if any)
- **Source column** indicating built-in or custom types
- **Toggle** to show/hide built-in types
- **Add type** button (for creating custom types - coming soon)

### Custom Relationships Card

- **List of all custom relationships** defined in the vault
- **Clickable source and target names** to open person notes
- **Relationship type** with color indicator
- **Statistics summary** at top

### Statistics Card

- Total relationships count
- Breakdown by relationship type
- People with custom relationships count

---

## Canvas Edge Rendering

Custom relationships can be rendered as colored edges on canvas trees:

- Each relationship type defines an **edge color**
- Edges use **dashed or dotted line styles** to distinguish from family links
- Enable/disable custom relationship edges in tree generation settings

---

## Commands and Context Menu

### Commands

| Command | Description |
|---------|-------------|
| Add custom relationship to current person | Opens the Add Relationship modal for the active person note |
| Open relationships tab | Opens Control Center to the Relationships tab |

### Context Menu

Right-click on a person note:
- **Charted Roots** → **Relationships** → **Add custom relationship...** - Opens the Add Relationship modal

---

## Best Practices

### Use target_id

Always include the `target_id` for robust linking. Even if notes are renamed, the `cr_id` reference ensures the relationship remains valid.

### Be Consistent

Use the same relationship type across your database. For example, always use `godparent` rather than mixing "Godparent" and "godparent".

### Add Notes

Document when and where the relationship was established. This context is valuable for future research.

### Consider Inverses

Some relationships should be added to both people:
- If John is Jane's godparent, you should also add that Jane is John's godchild
- Currently this must be done manually (automatic inverse creation coming soon)

### Separate from Family Links

Don't use custom relationships for connections that are already handled by family links:
- Use `father`/`mother` for parents, not "Biological Parent" custom relationship
- Use `spouse` for marriages, not custom relationship types

---

## Coming Soon

- **Create custom relationship types** with your own colors and categories
- **Edit and delete** custom types
- **Automatic inverse relationship creation**
- **Bulk relationship management**
