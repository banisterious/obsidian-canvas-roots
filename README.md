# Canvas Roots: A Planned D3-Powered Family Tree Plugin for Obsidian

**Canvas Roots** is a blueprint for an Obsidian plugin that will automatically generate complex, D3-calculated family trees directly onto the Canvas using structured note properties for non-overlapping layouts.

This planned Obsidian plugin concept is designed for genealogists, historians, and world-builders. It is designed to transform structured data in your Markdown notes (relationships, dates, locations) into perfectly laid-out family trees directly on the Obsidian Canvas.

The core idea is a hybrid approach: the plugin will use the power of D3.js for advanced layout calculation, but will generate the output using native Obsidian Canvas nodes and edges. This is intended to create a beautiful, structured chart that is fully editable and linkable within the Canvas environment.


## ✨ Key Features

- **Automated Layout:** Generate precise, non-overlapping pedigree (ancestor) and descendant charts using D3.js hierarchy algorithms inspired by [family-chart](https://github.com/donatso/family-chart) logic.

- **Native Canvas Nodes:** Trees are built from Obsidian file nodes, making every person immediately linkable to research notes, images, and documents on the Canvas.

- **Obsidian Bases Integration:** Seamlessly works with [Obsidian Bases](https://help.obsidian.md/bases) for efficient bulk data entry and management. Edit multiple family members in table view while Canvas Roots handles visualization.

- **Bi-Directional Linking (Optional):** Configure automatic two-way relationship synchronization (e.g., setting a father automatically sets the child) with flexible settings for manual or automatic sync.

- **Relayout Command:** Recalculate and restore the D3-optimized layout with a single command if Canvas nodes are manually rearranged.

- **Privacy & Obfuscation:** Optional data obfuscation for exports and canvas display. Protect PII when sharing family trees publicly, for demonstrations, or for research collaboration while preserving relationship structure. Selectively obfuscate all individuals, living persons only, minors only, or combine filters for maximum privacy protection.

- **YAML-First Data:** Uses native YAML frontmatter for maximum compatibility with Dataview, Bases, and other Obsidian tools.


## 🛠️ Workflow

### 1. Enter Your Data

**Option A: Individual Notes**

Create individual Markdown notes with YAML frontmatter. The `cr_id` field is essential for persistence and mapping.

```yaml
---
cr_id: abc-123-def-456
name: John Robert Smith
father: "[[John Smith Sr]]"
mother: "[[Jane Doe]]"
spouse: ["[[Mary Jones]]"]
child: ["[[Bob Smith]]", "[[Alice Smith]]"]
born: 1888-05-15
died: 1952-08-20
---

# Research Notes

[Your biographical research, sources, and notes here...]
```

**Option B: Obsidian Bases (Recommended for Bulk Entry)**

Use [Obsidian Bases](https://help.obsidian.md/bases) to manage multiple family members in a table view. Edit relationships, dates, and properties in a spreadsheet-like interface. See the [Bases Integration Guide](docs/bases-integration.md) for details and templates.

### 2. Generate the Tree

1. Open or create a new Obsidian Canvas file (`.canvas`)
2. Navigate to the note of the person you want as the root (center) of the tree
3. Open the Command Palette (`Ctrl/Cmd + P`)
4. Run: `Canvas Roots: Generate Tree for Current Note`

The plugin populates the Canvas with the D3-calculated family tree layout.

### 3. Maintain the Layout

If you manually rearrange nodes or add new family members, restore the optimized layout:

- Run: `Canvas Roots: Re-Layout Current Canvas`


## 💾 Data Interchange & Deep Sync (Planned)

The power of Canvas Roots will extend to integration with industry-standard genealogy tools via the GEDCOM format.


### Two-Mode GEDCOM Import

The plugin will offer flexibility when importing family data:

1. **Canvas Visualization Mode (Quick Import):** Import a large `.ged` file and render the tree directly onto the Canvas without creating hundreds of notes in your vault. Perfect for quick visual analysis of external data.

2. **Vault Deep-Sync Mode (Full Integration):** Import a `.ged` file and automatically generate Markdown notes for every individual, source, and place. This will populate the notes with structured properties, creating a rich, queryable genealogical database powered by Dataview.


### Round-Trip Data Integrity

- **Export Capability:** A core feature will be the ability to export all the data collected within the Obsidian notes back into a standard `.ged` file, ensuring your research remains portable and can be transferred back to dedicated genealogy software.

- **Deep Queries:** By populating note properties with rich data (dates, locations, sources), you'll be able to run complex genealogical queries against your vault.


## 📚 Documentation

### Project Specifications

- **[Technical Specification](docs/specification.md)** - Complete technical specification including data models, features, GEDCOM integration, and enhanced relationship modeling

### For Contributors

- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to Canvas Roots, including development setup, coding standards, and pull request process
- **[Development Guide](docs/development.md)** - Complete development workflow, build commands, and testing procedures
- **[CSS System](docs/css-system.md)** - CSS component architecture, build pipeline, and styling conventions
- **[ESLint Setup](docs/eslint-setup.md)** - ESLint configuration details and compatibility notes

### For Users

- **[Bases Integration Guide](docs/bases-integration.md)** - How to use Obsidian Bases for efficient family tree data management
- **[Security Policy](SECURITY.md)** - Important information about PII handling, data privacy, and security best practices

## 🧑‍💻 Development Status

Canvas Roots is in active development. The core plugin structure, build system, and documentation are in place. The plugin currently includes:

- TypeScript-based plugin foundation with Obsidian API integration
- Build system with esbuild and automated CSS compilation
- Data models for Person and Canvas structures
- Settings interface for layout customization
- Command structure for tree generation and re-layout

The plugin relies on reading the vault's file structure, applying the layout logic of D3.js internally, and safely writing the positional data back into the Canvas JSON file. Careful handling of the Canvas Node ID and the person's `cr_id` is required for persistence.
