# Canvas Roots: Genealogical Family Tree Plugin for Obsidian

**Canvas Roots** is an Obsidian plugin that automatically generates complex family trees directly onto the Canvas using specialized genealogical layout algorithms for non-overlapping, relationship-aware positioning.

This Obsidian plugin is designed for genealogists, historians, and world-builders. It transforms structured data in your Markdown notes (relationships, dates, locations) into perfectly laid-out family trees directly on the Obsidian Canvas.

The core approach is hybrid: the plugin uses specialized family tree layout algorithms (powered by the [family-chart](https://github.com/donatso/family-chart) library) for advanced positioning that understands spouse relationships, multiple marriages, and complex genealogical structures, but generates the output using native Obsidian Canvas nodes and edges. This creates a beautiful, structured chart that is fully editable and linkable within the Canvas environment.


## ✨ Key Features

- **Automated Layout:** Generate precise, non-overlapping pedigree (ancestor) and descendant charts using specialized genealogical layout algorithms from the [family-chart](https://github.com/donatso/family-chart) library, designed specifically for complex family relationships.

- **Native Canvas Nodes:** Trees are built from Obsidian file nodes, making every person immediately linkable to research notes, images, and documents on the Canvas.

- **Obsidian Bases Integration:** Seamlessly works with [Obsidian Bases](https://help.obsidian.md/bases) for efficient bulk data entry and management. Edit multiple family members in table view while Canvas Roots handles visualization.

- **Bi-Directional Linking (Optional):** Configure automatic two-way relationship synchronization (e.g., setting a father automatically sets the child) with flexible settings for manual or automatic sync.

- **Relayout Command:** Recalculate and restore the optimized genealogical layout with a single command if Canvas nodes are manually rearranged.

- **Arrow Styling:** Customize relationship visualization with three arrow styles: directed (→) for generational flow, bidirectional (↔) for reciprocal relationships, or undirected (—) for cleaner layouts. Configure separately for parent-child and spouse relationships.

- **Privacy & Obfuscation:** Optional data obfuscation for exports and canvas display. Protect PII when sharing family trees publicly, for demonstrations, or for research collaboration while preserving relationship structure. Selectively obfuscate all individuals, living persons only, minors only, or combine filters for maximum privacy protection.

- **World-Building & Organizations:** Beyond genealogy - track fantasy dynasties, corporate succession, institutional evolution, and historical kingdoms. Features include visual grouping by house/faction, dual relationship trees (biological vs. political), complex succession rules, co-ruling visualization, and organizational mergers/splits over time.

- **YAML-First Data:** Uses native YAML frontmatter for maximum compatibility with Dataview, Bases, and other Obsidian tools.


## 📸 Screenshots

| Tree Generation Interface | Generated Family Tree |
|:-------------------------:|:---------------------:|
| ![Tree generation interface showing inline person browser with birth years, family group detection, and configuration options](docs/images/tree-generation-ui.png) | ![Multi-generational family tree canvas with automated genealogical layout](docs/images/family-tree-canvas.png) |
| **Streamlined tree generation** with inline person browser, birth/death year display, and family group detection | **Automated genealogical layout** showing 4 generations with spouse relationships and parent-child connections |


## 🛠️ Workflow

### 1. Enter Your Data

**Option A: Individual Notes**

Create individual Markdown notes with YAML frontmatter. The `cr_id` field is essential for persistence and mapping.

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

**Note:** The plugin supports both `born`/`died` (standard) and `birth_date`/`death_date` (Gramps style) field names for compatibility with different genealogy tools.

**Option B: Obsidian Bases (Recommended for Bulk Entry)**

Use [Obsidian Bases](https://help.obsidian.md/bases) to manage multiple family members in a table view. Edit relationships, dates, and properties in a spreadsheet-like interface. See the [Bases Integration Guide](docs/bases-integration.md) for details and templates.

### 2. Generate the Tree

1. Open the Command Palette (`Ctrl/Cmd + P`)
2. Run: `Canvas Roots: Open Control Center`
3. Navigate to the **Tree Generation** tab
4. **Select a root person:**
   - Use the inline person browser to search, sort, and filter
   - Click any person to select them as the tree's root
   - Or use the family group sidebar if you have disconnected family groups
5. **Configure tree options:**
   - Choose tree type (ancestors, descendants, or full family tree)
   - Set generation limits or include all generations
   - Enable/disable spouse inclusion
   - Adjust layout direction and spacing
6. **Generate:**
   - Enter an optional canvas name
   - Click **Generate family tree** for the selected person
   - Or click **Generate all trees** to automatically create separate trees for each disconnected family group

The plugin populates the Canvas with the calculated family tree layout using specialized genealogical positioning algorithms.

### 3. Maintain the Layout

After editing relationships in person notes or changing layout settings, refresh your canvas:

**Method 1: Right-Click Menu (Recommended)**
- Right-click on the canvas tab, file, or three-dot menu (⋮)
- Select **"Re-layout family tree"**

**Method 2: Command Palette**
- Open the canvas you want to re-layout
- Run: `Canvas Roots: Re-Layout Current Canvas`

**Method 3: Keyboard Shortcut**
- Assign a custom hotkey in Settings → Hotkeys → "Re-layout current canvas"

The re-layout command:
- ✅ Reads current relationship data from your person notes
- ✅ Preserves original tree settings (tree type, generations, spouses) using embedded canvas metadata
- ✅ Allows changing layout direction (vertical ↔ horizontal) while preserving other settings
- ✅ Applies your current spacing/sizing settings
- ✅ Updates the canvas in-place (non-destructive)
- ✅ Uses the latest family-chart layout algorithm

**Common Re-Layout Scenarios:**
- Added new spouses, children, or parents to person notes
- Corrected relationship errors (wrong parents, etc.)
- Changed spacing settings and want to apply to existing trees
- Updated from an older layout algorithm version
- Imported/edited data via GEDCOM or Bases
- Testing different layout configurations


## 💾 GEDCOM Integration

Canvas Roots integrates with industry-standard genealogy tools via the GEDCOM format.

### GEDCOM Import

Import `.ged` files to automatically generate Markdown notes for every individual in your family tree. The import process:

1. **Creates Person Notes:** Generates a note for each individual with structured YAML frontmatter
2. **Preserves Relationships:** Maintains parent-child and spousal relationships using both wikilinks and `cr_id` references
3. **UUID Handling:** Preserves `_UUID` tags from GEDCOM when present, or generates new `cr_id` values
4. **Duplicate Detection:** Identifies and handles duplicate individuals across multiple imports

This creates a rich, queryable genealogical database in your vault that works seamlessly with Dataview, Obsidian Bases, and other plugins.

### Round-Trip Data Integrity (Planned)

Future versions will support exporting your research back to GEDCOM format, ensuring portability and compatibility with dedicated genealogy software.


## 📚 Documentation

### Project Specifications

- **[Technical Specification](docs/specification.md)** - Complete technical specification including data models, features, GEDCOM integration, and enhanced relationship modeling

### For Contributors

- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to Canvas Roots, including development setup, coding standards, and pull request process
- **[Development Guide](docs/development.md)** - Complete development workflow, build commands, and testing procedures
- **[Coding Standards](docs/developer/coding-standards.md)** - TypeScript and CSS coding standards, naming conventions, and linting requirements
- **[CSS System](docs/css-system.md)** - CSS component architecture, build pipeline, and styling conventions
- **[ESLint Setup](docs/eslint-setup.md)** - ESLint configuration details and compatibility notes

### For Users

- **[Bases Integration Guide](docs/bases-integration.md)** - How to use Obsidian Bases for efficient family tree data management
- **[Security Policy](SECURITY.md)** - Important information about PII handling, data privacy, and security best practices

## 🧑‍💻 Development Status

Canvas Roots is in active development with core functionality in place:

**Working Features:**
- TypeScript-based plugin foundation with Obsidian API integration
- Re-layout command with context menu integration
- Build system with esbuild and automated CSS compilation
- Settings interface for layout customization and logging control
- Control Center modal UI for plugin management
- GEDCOM import with person note generation
- Dual storage relationship system (wikilinks + `cr_id` references)
- Bidirectional relationship linking
- Structured logging system with export capability

**Recently Completed:**
- Re-layout canvas command for updating existing trees with current data and settings
- Context menu integration for canvas files (right-click on file, tab, or three-dot menu)
- Genealogical layout engine using family-chart library for automated tree positioning
- Canvas generation from person notes with proper handling of complex relationships
- Streamlined Tree Generation tab with inline person browser (search, sort, filters, family groups)
- Integrated generation workflow with single-card interface
- Full tree generation with spacing optimization and multi-family support

**In Progress:**
- Collection management and tree detection

The plugin reads the vault's file structure and applies specialized family tree layout algorithms to safely write positional data into Canvas JSON files. The `cr_id` field ensures stable identity mapping between notes and canvas nodes.
