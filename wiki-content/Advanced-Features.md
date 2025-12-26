# Advanced Features

This page covers additional features: folder statistics, Excalidraw export, and the split canvas wizard.

---

## Table of Contents

- [Folder Statistics](#folder-statistics)
- [Excalidraw Export](#excalidraw-export)
- [Split Canvas Wizard](#split-canvas-wizard)

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

## Excalidraw Export

Canvas Roots supports Excalidraw in two ways:

1. **Direct generation**: Generate Excalidraw files directly from the Tree Wizard (see [Visual Trees](Visual-Trees#canvasexcalidraw-path))
2. **Canvas conversion**: Export an existing Canvas file to Excalidraw format (documented below)

Both methods produce editable [Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin) files with hand-drawn styling, annotation capabilities, and SVG/PNG export.

### Why Use Excalidraw?

Excalidraw provides drawing capabilities not available in standard Canvas:

- **Annotations**: Add handwritten notes, highlights, and comments directly on the tree
- **Custom styling**: Apply hand-drawn aesthetics, colors, and shapes
- **Smart connectors**: Connections adapt when you move elements
- **Wiki links**: Click nodes to navigate to person notes
- **Additional elements**: Draw family crests, photo frames, decorative borders
- **Presentation mode**: Create polished diagrams for sharing or presentation
- **Native export**: Export to SVG or PNG directly from Excalidraw

### Direct Generation (Recommended)

The Tree Wizard can generate Excalidraw files directly, with full control over styling:

1. Open the Tree Wizard (Control Center → Visual Trees → New Tree)
2. Select root person and tree type
3. Choose **Excalidraw** as output format
4. Configure canvas options and preview the tree
5. In the **Excalidraw Style** step, customize:
   - **Drawing style**: Architect (clean), Artist (sketchy), or Cartoonist (rough)
   - **Font family**: Virgil, Cascadia, or system fonts
   - **Fill/stroke styles**: Solid, hachure, cross-hatch; solid, dashed, dotted
   - **Node content**: Name only, with dates, or with dates and places
6. Generate the file

This method uses the ExcalidrawAutomate API when available, producing smart connectors that adapt when elements are moved.

### Converting Existing Canvas

If you already have a Canvas file, you can convert it to Excalidraw:

**Method 1: Context Menu**
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
- ✅ Person names, dates, and places as text labels
- ✅ Relationship connections as arrows (smart connectors when API available)
- ✅ Wiki links for navigation back to person notes
- ✅ Spouse relationships styled with dashed lines

**Converted to Excalidraw Format:**
- Canvas nodes → Excalidraw rectangles with grouped text
- Node labels → Multi-line text elements (name, dates, place)
- Edges → Excalidraw arrows (smart connectors adapt when moved)
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
- Try re-exporting or regenerating the file

**Text not centered in boxes:**
- Update to Canvas Roots v0.17.1+ which fixes text centering issues

**Nodes positioned incorrectly:**
- Canvas Roots automatically normalizes negative coordinates to positive space
- If issues persist, try regenerating the Canvas first, then re-export

**Missing wiki links:**
- Wiki links are set on the rectangle element, not inline in text
- Click the rectangle (not the text) to follow the link

**Connectors don't adapt when moving elements:**
- Smart connectors require the ExcalidrawAutomate API
- Ensure Excalidraw plugin is installed; files generated without it use static arrows

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
