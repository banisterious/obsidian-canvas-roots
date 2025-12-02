# Canvas Roots: Genealogical Family Tree Plugin for Obsidian

[![Version](https://img.shields.io/badge/version-0.5.2-blue.svg)](https://github.com/banisterious/obsidian-canvas-roots/releases) [![Status](https://img.shields.io/badge/status-stable-green.svg)](docs/roadmap.md)

**Canvas Roots** transforms structured genealogical data in your Markdown notes into beautifully laid-out family trees on the Obsidian Canvas. Designed for genealogists, historians, and world-builders.

## Demo

[![Canvas Roots Demo](https://img.youtube.com/vi/oiEjFsNI7pI/maxresdefault.jpg)](https://youtu.be/oiEjFsNI7pI)

**Watch:** Import GEDCOM → Create Base → Generate tree with interactive preview → Export to Excalidraw

---

## Features

### Tree Generation

| Feature | Description |
|---------|-------------|
| **Automated Layout** | Non-overlapping pedigree and descendant charts using specialized genealogical algorithms |
| **Multiple Tree Types** | Ancestor trees, descendant trees, or full family trees with configurable generation limits |
| **Layout Algorithms** | Standard, Compact (50% tighter), Timeline (chronological), Hourglass (focused lineage) |
| **Interactive Preview** | Pan, zoom, and explore layouts before generating; export as PNG, SVG, or PDF |
| **Multi-Family Detection** | Automatically detects disconnected family groups |
| **Regenerate Canvas** | Update existing canvases with current data via right-click |

### Import & Export

| Feature | Description |
|---------|-------------|
| **GEDCOM 5.5.1** | Full round-trip import/export with validation, UUID preservation, and privacy protection |
| **GEDCOM X** | Import from FamilySearch JSON format |
| **Gramps XML** | Import directly from Gramps genealogy software |
| **CSV/TSV** | Import/export for spreadsheet workflows with auto-detected column mapping |
| **Excalidraw Export** | Export canvases for manual annotation and hand-drawn styling |
| **Selective Branch Export** | Export only ancestors or descendants of a specific person |

### Interactive Family Chart

| Feature | Description |
|---------|-------------|
| **Persistent View** | Interactive visualization panel for exploring and editing trees in real-time |
| **Direct Editing** | Edit relationships in the chart with full undo/redo support |
| **Bidirectional Sync** | Chart edits update frontmatter; file changes refresh the chart |
| **Multiple Color Schemes** | Gender, Generation, Collection, or Monochrome |
| **Export Options** | High-quality PNG, SVG, or PDF with customizable filenames |

### Data Management

| Feature | Description |
|---------|-------------|
| **Bidirectional Sync** | Reciprocal relationships auto-maintained across all notes |
| **Dual Storage** | Wikilinks for readability + `cr_id` references for robust tracking |
| **Smart Duplicate Detection** | Fuzzy name matching and date proximity analysis |
| **Merge Wizard** | Field-level conflict resolution with automatic relationship reconciliation |
| **Staging Workflow** | Isolated staging folder for safe import processing |
| **Data Quality Tools** | Quality scores, 15+ issue types, batch normalization |

### Geographic Features

| Feature | Description |
|---------|-------------|
| **Place Notes** | Hierarchical places (city → state → country) with six categories |
| **Place Categories** | Real, historical, disputed, legendary, mythological, fictional |
| **Place Statistics** | Category breakdown, common locations, migration patterns |
| **Migration Visualizations** | D3-based network and arc diagrams with time/collection filters |
| **Geocoding Lookup** | Auto-lookup coordinates via Nominatim (OpenStreetMap) |
| **Place-Based Filtering** | Filter tree generation by birth/death/marriage locations |

### Organization & Analysis

| Feature | Description |
|---------|-------------|
| **Collections & Groups** | Auto-detected family groups and user-defined collections |
| **Reference Numbering** | Ahnentafel, d'Aboville, Henry, and Generation systems |
| **Lineage Tracking** | Track patrilineal, matrilineal, or all descendants |
| **Relationship Calculator** | Find connections with proper genealogical terms (cousin, 2nd cousin once removed, etc.) |
| **Relationship History** | Track all changes with timestamps and one-click undo |

### Canvas Features

| Feature | Description |
|---------|-------------|
| **Native Canvas Nodes** | Every person is a linkable Obsidian file node |
| **Canvas Styling** | Node coloring, arrow styles, edge colors for parent-child and spouse relationships |
| **Multiple Spouse Support** | Indexed properties with marriage dates, locations, and status |
| **Split Canvas Wizard** | Split large trees by generation, branch, collection, surname, or lineage |
| **Navigation Portals** | Link between related canvases with optional master overview |

### Integration

| Feature | Description |
|---------|-------------|
| **Obsidian Bases** | Ready-to-use Base template with 22 pre-configured views |
| **Context Menu Actions** | Right-click person notes, folders, and canvases for quick actions |
| **YAML-First Data** | Compatible with Dataview, Bases, and other Obsidian tools |
| **Privacy Protection** | Optional anonymization of living persons in exports |

---

## Planned Features

See [Roadmap](docs/roadmap.md) for detailed descriptions and development priorities.

### Coming Soon

| Feature | Description |
|---------|-------------|
| **Interactive Maps** | Leaflet.js integration with birth/death markers, migration paths, and animated timelines |
| **Custom Relationships** | Non-familial relationships (mentor, liege, rival) with colored canvas edges |
| **Fictional Dates** | Custom calendars and eras for world-building (e.g., "Third Age 2941") |
| **Schema Validation** | User-defined JSON schemas to enforce property rules and catch inconsistencies |
| **Organization Charts** | Track houses, guilds, and factions with hierarchical D3 visualizations |
| **Source Media Gallery** | Centralized evidence management with thumbnails and citation generation |
| **Canvas Media Nodes** | Media files as first-class canvas entities with intelligent placement |
| **Oral History Tools** | Timestamped transcript citations, interview subject graphs, chronological story mapping |

---

## Screenshots

| Tree Output Interface | Generated Family Tree |
|:---------------------:|:---------------------:|
| ![Tree Output interface](docs/images/tree-output-ui.png) | ![Family tree canvas](docs/images/family-tree-canvas.png) |
| Person browser, layout selection, interactive preview | Automated genealogical layout with spouse and parent-child connections |

---

## Installation

### Using BRAT (Recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Community Plugins
2. Run command: `BRAT: Add a beta plugin for testing`
3. Enter: `https://github.com/banisterious/obsidian-canvas-roots`
4. Enable Canvas Roots in Settings → Community Plugins

### Manual Installation

1. Download from [Releases](https://github.com/banisterious/obsidian-canvas-roots/releases)
2. Extract to `<vault>/.obsidian/plugins/canvas-roots/`
3. Reload Obsidian and enable the plugin

### From Source

```bash
git clone https://github.com/banisterious/obsidian-canvas-roots
cd obsidian-canvas-roots
npm install && npm run build
```

Copy `main.js`, `styles.css`, and `manifest.json` to your vault's plugins folder.

---

## Quick Start

### 1. Enter Your Data

**Import GEDCOM:** Control Center → Import/Export tab → Import section

**Or create notes manually:**

```yaml
---
cr_id: abc-123-def-456
name: John Robert Smith
father: "[[John Smith Sr]]"
mother: "[[Jane Doe]]"
spouse: ["[[Mary Jones]]"]
born: 1888-05-15
died: 1952-08-20
---
```

**Or use Obsidian Bases:** Control Center → Quick Actions → "Create Bases template"

### 2. Generate Tree

1. Open Control Center → Tree Generation tab
2. Select root person
3. Configure tree type and layout
4. Click "Generate family tree"

### 3. Maintain Tree

Right-click canvas → "Regenerate canvas" after editing relationships.

See [User Guide](docs/user-guide.md) for complete documentation.

---

## Support

If you find this plugin useful, please consider supporting its development!

<a href="https://www.buymeacoffee.com/banisterious" target="_blank"><img src="docs/images/buy-me-a-coffee.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

---

## Documentation

### For Users
- [User Guide](docs/user-guide.md) - Complete workflow and features
- [Frontmatter Schema](docs/reference/frontmatter-schema.md) - Property reference for person and place notes
- [Bases Integration](docs/bases-integration.md) - Bulk data management
- [Changelog](CHANGELOG.md) - Version history
- [Roadmap](docs/roadmap.md) - Planned features

### For Developers
- [Contributing Guide](CONTRIBUTING.md) - Development setup
- [Development Guide](docs/development.md) - Architecture and testing
- [Coding Standards](docs/developer/coding-standards.md) - Style guidelines

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT License - see [LICENSE](LICENSE)

---

## Issues & Support

- **Bug Reports:** [GitHub Issues](https://github.com/banisterious/obsidian-canvas-roots/issues)
- **Feature Requests:** [GitHub Discussions](https://github.com/banisterious/obsidian-canvas-roots/discussions)
- **Security:** See [SECURITY.md](SECURITY.md)

---

## Acknowledgments

- [Obsidian Plugin API](https://docs.obsidian.md/Plugins)
- [family-chart](https://github.com/donatso/family-chart) library
- [JSON Canvas 1.0 specification](https://jsoncanvas.org/)
- Compatible with [Obsidian Bases](https://help.obsidian.md/bases) and [Advanced Canvas](https://github.com/Developer-Mike/obsidian-advanced-canvas)
