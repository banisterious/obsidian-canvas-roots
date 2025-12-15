# Canvas Roots: Genealogical Family Tree Plugin for Obsidian

[![Version](https://img.shields.io/badge/version-0.12.8-blue.svg)](https://github.com/banisterious/obsidian-canvas-roots/releases) [![Status](https://img.shields.io/badge/status-stable-green.svg)](docs/roadmap.md)

**Canvas Roots** transforms structured genealogical data in your Markdown notes into beautifully laid-out family trees on the Obsidian Canvas. Designed for genealogists, historians, writers, and world-builders.

## Demo

[![Canvas Roots Demo](https://img.youtube.com/vi/KQhqfUtpp18/maxresdefault.jpg)](https://youtu.be/KQhqfUtpp18)

**Watch:** Import GEDCOM → Generate family tree → Interactive family chart → Geolocate places → Map view

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
| **Full Entity Export** | Export people, events, sources, places, and custom relationships to all formats |
| **GEDCOM 5.5.1** | Full round-trip import/export with validation, UUID preservation, and privacy protection |
| **GEDCOM X** | Import/export with FamilySearch JSON format |
| **Gramps XML** | Import/export for Gramps genealogy software |
| **CSV/TSV** | Import/export for spreadsheet workflows with auto-detected column mapping |
| **Excalidraw Export** | Export canvases for manual annotation and hand-drawn styling |
| **Enhanced Export UI** | Real-time statistics, entity toggles, format selection, and progress tracking |
| **Selective Branch Export** | Export only ancestors or descendants of a specific person |
| **Privacy-Aware Exports** | Optional anonymization of living persons in all export formats |

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
| **Schema Validation** | User-defined schemas with required properties, type validation, enum constraints, and custom rules |
| **Generate Place Notes** | Batch create place notes from references in person/event notes with hierarchy linking |

### Geographic Features

| Feature | Description |
|---------|-------------|
| **Interactive Map View** | Leaflet.js-powered map with markers, clustering, migration paths, heat maps, and time slider animation |
| **Custom Image Maps** | Load your own map images for fictional worlds with pixel or geographic coordinate systems |
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
| **Custom Relationships** | Extended relationships beyond family (godparent, guardian, mentor, apprentice) with colored canvas edges |
| **Fictional Date Systems** | Custom calendars and eras for world-building (Middle-earth, Westeros, Star Wars, or custom) |
| **Organization Notes** | Track non-genealogical hierarchies: noble houses, guilds, corporations, military units, religious orders |
| **Events & Timelines** | Document life events with person/family/place timelines, visual exports, groups/factions filtering, and sort order computation |

### Evidence & Sources

| Feature | Description |
|---------|-------------|
| **Source Notes** | Dedicated notes for genealogical sources with structured metadata |
| **Source Quality Classification** | Rate sources as Primary, Secondary, or Derivative per GPS methodology |
| **Fact-Level Source Tracking** | Track which specific facts (birth, death, marriage) have source citations |
| **Proof Summary Notes** | Document reasoning chains for genealogical conclusions with evidence linking |
| **Research Gaps Report** | Identify under-researched facts across your tree with priority ranking |
| **Source Conflict Detection** | Detect and track conflicting evidence requiring resolution |
| **Source Media Gallery** | Thumbnail grid of source media with search, filtering, and lightbox viewer |
| **Citation Generator** | Generate citations in Chicago, Evidence Explained, MLA, and Turabian formats |
| **Canvas Research Indicators** | Visual badges showing source count, coverage %, and conflict warnings |

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
| **Calendarium Integration** | Import calendar definitions from [Calendarium](https://github.com/javalent/calendarium) for fictional dates |
| **Type Customization** | Full type managers for events, sources, organizations, relationships, and places; create, edit, hide, and customize types and categories |
| **Property Aliases** | Map custom property names to Canvas Roots fields without renaming frontmatter |
| **Value Aliases** | Map custom property values (event types, gender, place categories) to Canvas Roots canonical values |
| **Obsidian Bases** | Ready-to-use Base templates: People (22 views), Places (14 views), Organizations (17 views); respects property aliases |
| **Style Settings** | Customize colors via [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin |
| **Context Menu Actions** | Right-click person notes, folders, and canvases for quick actions |
| **YAML-First Data** | Compatible with Dataview, Bases, and other Obsidian tools |
| **Privacy Protection** | Optional anonymization of living persons in exports |

---

## Screenshots

### Interactive Map View
![Interactive Map View](docs/images/canvas-roots-interactive-map-view.png)
*Leaflet-powered geographic visualization with color-coded markers (green=birth, red=death), marker clustering, migration paths with person labels, and mini-map overview.*

### Control Center Dashboard
![Control Center Status Tab](docs/images/canvas-roots-control-center-status-tab.png)
*Status tab showing comprehensive vault statistics: people, relationships, places, custom maps, canvases, vault health, and recent GEDCOM imports.*

### Maps Tab & Custom Maps Gallery
![Maps Tab](docs/images/canvas-roots-control-center-maps-tab.png)
*Dedicated Maps tab with custom map thumbnail gallery, visualization tools, and geographic statistics.*

### Tree Generation
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

**Or use Obsidian Bases:** Control Center → Advanced tab → "Create Bases template"

### 2. Generate Tree

1. Open Control Center → Tree output tab
2. Select root person
3. Configure tree type and layout
4. Click "Generate family tree"

### 3. Maintain Tree

Right-click canvas → "Regenerate canvas" after editing relationships.

See the [Wiki](https://github.com/banisterious/obsidian-canvas-roots/wiki) for complete documentation.

---

## Support

If you find this plugin useful, please consider supporting its development!

<a href="https://www.buymeacoffee.com/banisterious" target="_blank"><img src="docs/images/buy-me-a-coffee.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

---

## Documentation

📖 **[Full Documentation on the Wiki](https://github.com/banisterious/obsidian-canvas-roots/wiki)**

### Quick Links
- [Getting Started](https://github.com/banisterious/obsidian-canvas-roots/wiki/Getting-Started) - Installation and first steps
- [Data Entry](https://github.com/banisterious/obsidian-canvas-roots/wiki/Data-Entry) - Creating person notes
- [Tree Generation](https://github.com/banisterious/obsidian-canvas-roots/wiki/Tree-Generation) - Generating family trees
- [Import & Export](https://github.com/banisterious/obsidian-canvas-roots/wiki/Import-Export) - GEDCOM 5.5.1, GEDCOM X (JSON), Gramps XML, and CSV
- [Geographic Features](https://github.com/banisterious/obsidian-canvas-roots/wiki/Geographic-Features) - Maps and places
- [Evidence & Sources](https://github.com/banisterious/obsidian-canvas-roots/wiki/Evidence-And-Sources) - Source management and indicators
- [Events & Timelines](https://github.com/banisterious/obsidian-canvas-roots/wiki/Events-And-Timelines) - Life events and timeline visualization
- [Settings & Configuration](https://github.com/banisterious/obsidian-canvas-roots/wiki/Settings-And-Configuration) - All settings and property aliases
- [FAQ](https://github.com/banisterious/obsidian-canvas-roots/wiki/FAQ) - Common questions
- [Troubleshooting](https://github.com/banisterious/obsidian-canvas-roots/wiki/Troubleshooting) - Problem solving

### Other Resources
- [Changelog](CHANGELOG.md) - Version history
- [Roadmap](https://github.com/banisterious/obsidian-canvas-roots/wiki/Roadmap) - Planned features

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
