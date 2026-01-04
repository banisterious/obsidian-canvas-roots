# Visual Trees

Generate visual family tree diagrams in multiple formats: interactive Canvas files, hand-drawn Excalidraw diagrams, printable PDFs, or editable ODT documents.

---

## Table of Contents

- [Overview](#overview)
- [Opening the Tree Wizard](#opening-the-tree-wizard)
- [Wizard Steps](#wizard-steps)
  - [Step 1: Select Root Person](#step-1-select-root-person)
  - [Step 2: Choose Tree Type](#step-2-choose-tree-type)
  - [Step 3: Select Output Format](#step-3-select-output-format)
  - [Canvas/Excalidraw Path](#canvasexcalidraw-path)
  - [PDF/ODT Path](#pdfodt-path)
- [Tree Types Explained](#tree-types-explained)
- [Canvas Layout Algorithms](#canvas-layout-algorithms)
- [Privacy Options](#privacy-options)
- [PDF/ODT Options](#pdfodt-options)
- [Next Steps](#next-steps)

---

## Overview

Canvas Roots provides a unified tree generation wizard that supports four output formats:

| Output | Description | Best For |
|--------|-------------|----------|
| **Canvas** | Interactive Obsidian canvas file | Exploration, linking to notes, editing |
| **Excalidraw** | Hand-drawn style diagram | Annotation, drawings, SVG/PNG export |
| **PDF** | Printable tree diagram | Sharing, printing, archiving |
| **ODT** | Editable document format | Further editing in word processors |

All formats share the same person selection and tree type steps, then branch into format-specific options.

---

## Opening the Tree Wizard

**From Control Center:**
1. Open Control Center (`Ctrl/Cmd + P` → "Canvas Roots: Open Control Center")
2. Go to the **Visual Trees** tab in the Output group
3. Click **New Tree** button

**From Statistics Dashboard:**
1. Open Statistics Dashboard
2. Scroll to **Visual Trees** section
3. Click any tree type (Pedigree, Descendant, Hourglass, Fan Chart)

**From Context Menu:**
1. Right-click on a person note
2. Select **Canvas Roots** → **Generate Tree**

---

## Wizard Steps

### Step 1: Select Root Person

Search and select the person who will be the root of your tree.

- **Search**: Type in the search box to filter by name
- **Sort**: Use dropdown to sort by name, birth year, or death year
- **Filter**: Filter by family group, collection, or universe
- Birth/death years appear next to names for identification

Click a person to select them, then click **Next**.

### Step 2: Choose Tree Type

Select the type of tree to generate:

| Type | Icon | Description |
|------|------|-------------|
| **Full Tree** | Hourglass | Both ancestors and descendants from root |
| **Ancestors** | Pedigree | Parents, grandparents, etc. (upward) |
| **Descendants** | Downward tree | Children, grandchildren, etc. (downward) |
| **Fan Chart** | Semicircle | Semicircular ancestor display (PDF only) |

Configure generation limits:
- **Ancestor generations**: How many generations up (parents, grandparents, etc.)
- **Descendant generations**: How many generations down (children, grandchildren, etc.)
- **Include spouses**: Show spouse relationships

### Step 3: Select Output Format

Choose your output format:

| Format | Features |
|--------|----------|
| **Canvas** | Interactive pan/zoom, links to person notes, editable, re-layoutable |
| **Excalidraw** | Hand-drawn style, annotations, SVG/PNG export, editable drawings |
| **PDF** | Printable, shareable, styled boxes and lines, multiple page sizes |
| **ODT** | Editable in word processors, customizable formatting |

After selecting, the wizard branches into format-specific steps:
- Canvas and Excalidraw share similar options (preview, styling)
- PDF and ODT share similar options (page size, node content)

### Canvas/Excalidraw Path

**Options Step:**
- **Scope options**: Include step-parents, adoptive parents, filter by collection/place/universe
- **Style options**: Color scheme, edge styles, spouse edge display
- **Privacy protection**: Enable privacy for living persons (see [Privacy Options](#privacy-options) below)

**Preview Step:**
- Interactive preview with pan and zoom
- Tree statistics (people count, generations, edges)
- Privacy-protected persons count (when privacy enabled)
- Verify layout before generating

**Excalidraw Style Step (Excalidraw only):**
- **Drawing style**: Architect (clean lines), Artist (slightly rough), or Cartoonist (hand-drawn)
- **Font family**: Virgil (handwritten), Cascadia (code), or system fonts
- **Fill style**: Solid, Hachure (diagonal lines), or Cross-hatch
- **Stroke style**: Solid, Dashed, or Dotted lines
- **Node content**: Name only, Name + dates, or Name + dates + places

**Output Step:**
- Set filename (`.canvas` or `.excalidraw.md`)
- Choose save folder
- Option to open file after generation

**Excalidraw-specific features:**
- Hand-drawn aesthetic for a more informal look
- Smart connectors that adapt when you move elements
- Wiki links on nodes for navigation back to person notes
- Spouse relationships styled with dashed lines
- Add annotations and drawings after generation
- Export to SVG or PNG via Excalidraw's native export
- Requires the [Excalidraw plugin](https://github.com/zsviczian/obsidian-excalidraw-plugin)

### PDF/ODT Path

**Options Step:**
- **Page size**: Letter, A4, Legal, Tabloid, A3
- **Orientation**: Portrait or Landscape
- **Node content**: Name only, with dates, with dates and places
- **Color scheme**: Default (gender-based), Grayscale, Generational
- **Large tree handling**: Auto-scale, increase page size, or limit generations

**Output Step:**
- Set document title
- Summary of selections
- Click **Generate** to download

**ODT-specific features:**
- Open and edit in LibreOffice, Microsoft Word, or Google Docs
- Customize fonts, colors, and formatting after generation
- Add additional content around the tree diagram

---

## Tree Types Explained

### Full Tree (Hourglass)

Shows both ancestors above the root person and descendants below:
- Root person in the center
- Parents and grandparents flow upward
- Children and grandchildren flow downward
- Best for showing a person's complete family context

### Ancestors (Pedigree)

Traditional pedigree chart showing only ancestors:
- Root person at the bottom (or left in horizontal layout)
- Parents, grandparents, great-grandparents branching upward
- Binary branching (each person has 2 parents)

### Descendants

Inverted pedigree showing only descendants:
- Root person at the top
- Children, grandchildren branching downward
- Can show multiple children per generation

### Fan Chart (PDF only)

Semicircular ancestor display:
- Root person at center-bottom
- Ancestors arranged in concentric arcs
- Each generation occupies a ring
- Compact visualization for many generations

---

## Canvas Layout Algorithms

When generating canvas output, choose a layout algorithm:

| Algorithm | Description | Best For |
|-----------|-------------|----------|
| **Standard** | Family-chart library layout with spouse handling | Most trees (< 50 people) |
| **Compact** | 50% tighter spacing | Large trees (50+ people) |
| **Timeline** | Chronological by birth year | Visualizing when people lived |
| **Hourglass** | Root centered, ancestors up, descendants down | Person-focused context |

---

## Privacy Options

Canvas and Excalidraw generation supports privacy protection for living persons.

### Enabling Privacy Protection

1. In the **Canvas Options** step, expand the **Privacy protection** section
2. Enable **Apply privacy protection to living persons**
3. Choose a format:

| Format | Description |
|--------|-------------|
| **Text node** | Living persons shown as text boxes with obfuscated names |
| **File node** | Keeps clickable file link (reveals identity in canvas JSON) |

### How It Works

When privacy protection is enabled:
- **Obfuscated names**: Uses your display format setting ("Living", "Private", initials, etc.)
- **Text nodes include wikilinks**: `[[filename]]` links for navigation back to original notes
- **Hidden format**: Completely excludes living persons from the canvas
- **Preview shows count**: See how many persons will be privacy-protected before generating

### What Privacy Protection Does NOT Do

Canvas privacy protection reduces casual visibility but has important limitations:
- Canvas files store data in plain JSON (viewable by anyone with file access)
- Wikilinks in text nodes contain original filenames
- Relationship edges remain, showing family structure
- Protection is applied at generation time only

For details on limitations, see [Privacy & Security](Privacy-And-Security#canvas-privacy-protection).

---

## PDF/ODT Options

### Page Sizes

| Size | Dimensions | Use Case |
|------|------------|----------|
| Letter | 8.5 × 11 in | Standard US paper |
| A4 | 210 × 297 mm | Standard international |
| Legal | 8.5 × 14 in | Extended US format |
| Tabloid | 11 × 17 in | Large format US |
| A3 | 297 × 420 mm | Large format international |

### Color Schemes

- **Default**: Males in blue/green tones, females in purple/pink tones
- **Grayscale**: Black and white for printing
- **Generational**: Different colors per generation level

### Large Tree Handling

For trees that exceed the selected page size:

- **Auto-scale**: Shrink content to fit (may reduce readability)
- **Auto page size**: Automatically use larger paper
- **Limit generations**: Reduce depth to fit selected size

---

## Next Steps

- [Tree Preview](Tree-Preview) - Preview your tree before generating
- [Family Chart View](Family-Chart-View) - Interactive view for exploring trees
- [Statistics & Reports](Statistics-And-Reports) - Generate other report types
- [Styling & Theming](Styling-And-Theming) - Customize tree appearance
