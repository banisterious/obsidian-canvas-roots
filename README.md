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

- **Privacy & Obfuscation:** Optional data obfuscation for exports and canvas display. Protect PII when sharing family trees publicly, for demonstrations, or for research collaboration while preserving relationship structure. Selectively obfuscate all individuals, living persons only, minors only, or combine filters for maximum privacy protection.

- **World-Building & Organizations:** Beyond genealogy - track fantasy dynasties, corporate succession, institutional evolution, and historical kingdoms. Features include visual grouping by house/faction, dual relationship trees (biological vs. political), complex succession rules, co-ruling visualization, and organizational mergers/splits over time.

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

**Option B: Obsidian Bases (Recommended for Bulk Entry)**

Use [Obsidian Bases](https://help.obsidian.md/bases) to manage multiple family members in a table view. Edit relationships, dates, and properties in a spreadsheet-like interface. See the [Bases Integration Guide](docs/bases-integration.md) for details and templates.

### 2. Generate the Tree

1. Open or create a new Obsidian Canvas file (`.canvas`)
2. Navigate to the note of the person you want as the root (center) of the tree
3. Open the Command Palette (`Ctrl/Cmd + P`)
4. Run: `Canvas Roots: Generate Tree for Current Note`

The plugin populates the Canvas with the calculated family tree layout using specialized genealogical positioning algorithms.

### 3. Maintain the Layout

If you manually rearrange nodes or add new family members, restore the optimized layout:

- Run: `Canvas Roots: Re-Layout Current Canvas`


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
- Build system with esbuild and automated CSS compilation
- Settings interface for layout customization and logging control
- Control Center modal UI for plugin management
- GEDCOM import with person note generation
- Dual storage relationship system (wikilinks + `cr_id` references)
- Bidirectional relationship linking
- Structured logging system with export capability

**Recently Completed:**
- Genealogical layout engine using family-chart library for automated tree positioning
- Canvas generation from person notes with proper handling of complex relationships
- Person picker UI component with fuzzy search
- Full tree generation workflow with spacing optimization

**In Progress:**
- Re-layout command for existing canvases

The plugin reads the vault's file structure and applies specialized family tree layout algorithms to safely write positional data into Canvas JSON files. The `cr_id` field ensures stable identity mapping between notes and canvas nodes.
