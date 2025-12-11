# Getting Started

Canvas Roots transforms structured genealogical data in your Markdown notes into beautifully laid-out family trees on the Obsidian Canvas.

## Prerequisites

- Obsidian v1.7.2 or later
- Canvas Roots plugin installed and enabled

## Installation

### From Community Plugins (Recommended)

1. Open Obsidian Settings → Community plugins
2. Click "Browse" and search for "Canvas Roots"
3. Click "Install" then "Enable"

### Using BRAT (Beta Testing)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. Add beta plugin: `banisterious/obsidian-canvas-roots`
3. Enable Canvas Roots in Community plugins

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/banisterious/obsidian-canvas-roots/releases)
2. Extract `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/canvas-roots/` folder
3. Reload Obsidian and enable the plugin

## Basic Workflow

1. **Enter your family data** - Create person notes with relationship frontmatter, or import from GEDCOM
2. **Generate tree** - Use the Control Center to select a root person and generate the tree
3. **View and interact** - Explore the tree on the canvas, click nodes to open person notes
4. **Regenerate after edits** - When you update relationships, regenerate to refresh the layout

## First Steps

### 1. Create Your First Person Note

Create a new note for a person in your family tree:

```yaml
---
cr_id: john-smith-001
cr_type: person
name: John Smith
born: 1920-05-15
died: 1995-08-20
---

# John Smith

Your research notes about John go here.
```

### 2. Add Family Relationships

Create notes for related family members and link them:

```yaml
---
cr_id: mary-smith-001
cr_type: person
name: Mary Smith
born: 1922-03-10
died: 2001-11-30
spouse: "[[John Smith]]"
spouse_id: john-smith-001
children: ["[[Bob Smith]]", "[[Alice Smith]]"]
---
```

### 3. Open the Control Center

- Use the command palette: "Canvas Roots: Open Control Center"
- Or click the tree icon in the ribbon

### 4. Generate Your Tree

1. Select a folder containing your person notes
2. Choose a root person (typically the oldest ancestor)
3. Click "Generate Tree"
4. A new canvas file will be created with your family tree

## Next Steps

- [Data Entry](Data-Entry) - Learn about all the frontmatter fields for person notes
- [Bases Integration](Bases-Integration) - Use spreadsheet-like tables for bulk data entry
- [Tree Generation](Tree-Generation) - Explore generation options and layout settings
- [Import & Export](Import-Export) - Import existing family data from GEDCOM files
