# Canvas Roots: Genealogical Family Tree Plugin for Obsidian

[![Version](https://img.shields.io/badge/version-0.18.31-blue.svg)](https://github.com/banisterious/obsidian-canvas-roots/releases) [![Status](https://img.shields.io/badge/status-stable-green.svg)](docs/roadmap.md)

**Canvas Roots** brings professional genealogical tools to Obsidian—import, organize, visualize, and share family histories and fictional worlds without leaving your vault. From GEDCOM imports to PDF reports, interactive charts to map views, manage your research with the power of linked Markdown notes. Built for genealogists, historians, writers, and world-builders.

## Demo

[![Canvas Roots Demo](https://img.youtube.com/vi/elQfn1fk1VQ/maxresdefault.jpg)](https://youtu.be/elQfn1fk1VQ)

**Watch:** Import GEDCOM → Generate family tree → Interactive family chart → Geolocate places → Map view

---

## Features

### [Canvas Trees](https://github.com/banisterious/obsidian-canvas-roots/wiki/Canvas-Trees)

| Feature | Description |
|---------|-------------|
| **Automated Layout** | Non-overlapping pedigree and descendant charts using specialized genealogical algorithms |
| **Multiple Tree Types** | Ancestor trees, descendant trees, or full family trees with configurable generation limits |
| **Layout Algorithms** | Standard, Compact (50% tighter), Timeline (chronological), Hourglass (focused lineage) |
| **Interactive Preview** | Pan, zoom, and explore layouts before generating; export as PNG, SVG, or PDF |
| **Multi-Family Detection** | Automatically detects disconnected family groups |
| **Regenerate Canvas** | Update existing canvases with current data via right-click |

### [Import & Export](https://github.com/banisterious/obsidian-canvas-roots/wiki/Import-Export)

| Feature | Description |
|---------|-------------|
| **Full Entity Export** | Export people, events, sources, places, and custom relationships to all formats |
| **GEDCOM 5.5.1** | Full round-trip import/export with validation, UUID preservation, privacy protection, and PEDI tag parsing for step/adoptive parents |
| **GEDCOM X** | Import/export with FamilySearch JSON format and lineage type parsing for step/adoptive parents |
| **Gramps XML** | Import/export for Gramps genealogy software; `.gpkg` package import extracts bundled media files |
| **CSV/TSV** | Import/export for spreadsheet workflows with auto-detected column mapping |
| **Excalidraw Export** | Export canvases for manual annotation and hand-drawn styling |
| **Enhanced Export UI** | Real-time statistics, entity toggles, format selection, and progress tracking |
| **Selective Branch Export** | Export only ancestors or descendants of a specific person |
| **Privacy-Aware Exports** | Optional anonymization of living persons in all export formats |

### [Interactive Family Chart](https://github.com/banisterious/obsidian-canvas-roots/wiki/Interactive-Family-Chart)

| Feature | Description |
|---------|-------------|
| **Persistent View** | Interactive visualization panel for exploring and editing trees in real-time |
| **Direct Editing** | Edit relationships in the chart with full undo/redo support |
| **Bidirectional Sync** | Chart edits update frontmatter; file changes refresh the chart |
| **Multiple Color Schemes** | Gender, Generation, Collection, or Monochrome |
| **Export Options** | High-quality PNG, SVG, PDF, or ODT with customizable filenames |

### [Data Management](https://github.com/banisterious/obsidian-canvas-roots/wiki/Data-Management)

| Feature | Description |
|---------|-------------|
| **Bidirectional Sync** | Reciprocal relationships auto-maintained across all notes |
| **Dual Storage** | Wikilinks for readability + `cr_id` references for robust tracking |
| **Smart Duplicate Detection** | Fuzzy name matching and date proximity analysis |
| **Merge Wizard** | Field-level conflict resolution with automatic relationship reconciliation |
| **Staging Workflow** | Dedicated Staging Manager for reviewing imports: batch cards, expandable file previews, duplicate detection, promote/delete actions |
| **[Data Quality Tools](https://github.com/banisterious/obsidian-canvas-roots/wiki/Data-Quality)** | Quality scores, 15+ issue types, batch normalization |
| **Post-Import Cleanup Wizard** | 14-step guided workflow for data quality after import (dates, genders, relationships, places, sources, property migrations) with batch progress indicators and keyboard navigation |
| **Family Creation Wizard** | 5-step guided workflow for creating interconnected family groups with automatic bidirectional relationship linking |
| **[Schema Validation](https://github.com/banisterious/obsidian-canvas-roots/wiki/Schema-Validation)** | User-defined schemas with required properties, type validation, enum constraints, and custom rules |
| **Generate Place Notes** | Batch create place notes from references in person/event notes with hierarchy linking |
| **[Dynamic Note Content](https://github.com/banisterious/obsidian-canvas-roots/wiki/Dynamic-Note-Content)** | Live-rendered timeline, relationships, and media gallery blocks within person notes |

### [Geographic Features](https://github.com/banisterious/obsidian-canvas-roots/wiki/Geographic-Features)

| Feature | Description |
|---------|-------------|
| **Interactive Map View** | Leaflet.js-powered map with markers, clustering, migration paths, heat maps, and time slider animation |
| **Custom Image Maps** | Load your own map images for fictional worlds with pixel or geographic coordinate systems |
| **Map Creation Wizard** | 4-step wizard to create custom maps: select image, configure settings, place markers interactively, review and create |
| **Draggable Place Markers** | Reposition markers by dragging on custom maps; changes saved automatically |
| **Place Marker Context Menu** | Right-click markers to open place notes, edit properties, or remove from map |
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
| **[Custom Relationships](https://github.com/banisterious/obsidian-canvas-roots/wiki/Custom-Relationships)** | Extended relationships beyond family (godparent, guardian, mentor, apprentice) with colored canvas edges |
| **Step & Adoptive Parents** | Dedicated fields for step-parents and adoptive parents with distinct line styles on canvas trees |
| **[Fictional Date Systems](https://github.com/banisterious/obsidian-canvas-roots/wiki/Fictional-Date-Systems)** | Custom calendars and eras for world-building (Middle-earth, Westeros, Star Wars, or custom) |
| **[Organization Notes](https://github.com/banisterious/obsidian-canvas-roots/wiki/Organization-Notes)** | Track non-genealogical hierarchies: noble houses, guilds, corporations, military units, religious orders |
| **[Universe Notes](https://github.com/banisterious/obsidian-canvas-roots/wiki/Universe-Notes)** | First-class entities for organizing fictional worlds with metadata, linked calendars, maps, and validation schemas |
| **[Events & Timelines](https://github.com/banisterious/obsidian-canvas-roots/wiki/Events-And-Timelines)** | Document life events with person/family/place timelines, visual exports, groups/factions filtering, and sort order computation |

### [Statistics & Reports](https://github.com/banisterious/obsidian-canvas-roots/wiki/Statistics-And-Reports)

| Feature | Description |
|---------|-------------|
| **Statistics Dashboard** | Workspace view with entity counts, completeness metrics, gender distribution, and date range |
| **Data Quality Analysis** | Severity-coded alerts for date issues, missing data, orphaned people; expandable drill-down lists |
| **Top Lists** | Interactive lists for surnames, locations, occupations, sources with drill-down to matching people |
| **Extended Statistics** | Longevity analysis, family size patterns, marriage patterns, migration flows, timeline density |
| **Visual Tree Charts** | Printable PDF tree diagrams: Pedigree, Descendant, Hourglass, and Fan Chart with custom icons |
| **Genealogical Reports** | Family Group Sheet, Individual Summary, Ahnentafel, Gaps Report, Register Report, Pedigree/Descendant Charts |
| **Extended Reports** | Source Summary, Timeline Report, Place Summary, Media Inventory, Universe Overview, Collection Overview |
| **PDF & ODT Export** | All 17 report types exportable as styled PDFs or editable ODT files with customizable cover pages, logos, and date formats |

### [Evidence & Sources](https://github.com/banisterious/obsidian-canvas-roots/wiki/Evidence-And-Sources)

| Feature | Description |
|---------|-------------|
| **Source Notes** | Dedicated notes for genealogical sources with structured metadata |
| **Source Quality Classification** | Rate sources as Primary, Secondary, or Derivative per GPS methodology |
| **Fact-Level Source Tracking** | Track which specific facts (birth, death, marriage) have source citations |
| **Proof Summary Notes** | Document reasoning chains for genealogical conclusions with evidence linking |
| **Research Level Property** | Track research progress (0-6 scale) based on GPS methodology—from unidentified to full biography |
| **Research Gaps Report** | Identify under-researched facts across your tree with priority ranking and research level filtering |
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
| **[Property Aliases](https://github.com/banisterious/obsidian-canvas-roots/wiki/Settings-And-Configuration#property-aliases)** | Map custom property names to Canvas Roots fields without renaming frontmatter |
| **[Value Aliases](https://github.com/banisterious/obsidian-canvas-roots/wiki/Settings-And-Configuration#value-aliases)** | Map custom property values (event types, gender, place categories) to Canvas Roots canonical values |
| **[Obsidian Bases](https://github.com/banisterious/obsidian-canvas-roots/wiki/Bases-Integration)** | Ready-to-use Base templates: People, Places, Events, Organizations, Sources, Universes; respects property aliases |
| **[Style Settings](https://github.com/banisterious/obsidian-canvas-roots/wiki/Styling-And-Theming#style-settings-plugin)** | Customize colors via [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin |
| **[Context Menu Actions](https://github.com/banisterious/obsidian-canvas-roots/wiki/Context-Menus)** | Right-click person notes, folders, and canvases for quick actions |
| **YAML-First Data** | Compatible with Dataview, Bases, and other Obsidian tools |
| **[Privacy Protection](https://github.com/banisterious/obsidian-canvas-roots/wiki/Privacy-And-Security)** | Optional anonymization of living persons in exports |

---

## Screenshots

### Canvas Trees
| Generate Tree Wizard | Generated Family Tree |
|:---------------------:|:---------------------:|
| ![Generate Tree wizard](docs/images/canvas-roots-generate-tree.png) | ![Family tree canvas](docs/images/family-tree-canvas.png) |
| Unified wizard with tree type, root person, layout, and output options | Automated genealogical layout with spouse and parent-child connections |

### Interactive Family Chart View
<img src="docs/images/canvas-roots-family-chart-view.png" alt="Interactive Family Chart View" width="700">

*Real-time family tree visualization with pan/zoom, person details panel, and direct editing with bidirectional sync.*

### Interactive Map View
<img src="docs/images/canvas-roots-interactive-map-view.png" alt="Interactive Map View" width="700">

*Leaflet-powered geographic visualization with color-coded markers (green=birth, red=death), marker clustering, migration paths with person labels, and mini-map overview.*

### Control Center
<img src="docs/images/canvas-roots-control-center-dashboard-tab.png" alt="Control Center Dashboard Tab" width="700">

*Central hub for all Canvas Roots operations: vault statistics, import/export, tree generation, data quality tools, and quick actions.*

### Statistics View
<img src="docs/images/canvas-roots-statistics-view.png" alt="Statistics View" width="700">

*Dashboard with entity counts, completeness metrics, gender distribution, date ranges, and data quality analysis.*

### Maps Tab & Custom Maps Gallery
<img src="docs/images/canvas-roots-control-center-maps-tab.png" alt="Maps Tab" width="700">

*Dedicated Maps tab with custom map thumbnail gallery, visualization tools, and geographic statistics.*

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

**Import existing data:** Control Center → Import/Export tab
- Supports GEDCOM 5.5.1, GEDCOM X, Gramps XML, and CSV

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

**Or use Obsidian Bases:** Control Center → Guide → "Create all bases"

### 2. Visualize Your Tree

**Interactive Family Chart:** Right-click a person note → "Open family chart"
- Pan, zoom, and click to explore
- Edit relationships directly in the chart

**Or generate a canvas:** Control Center → Canvas Trees tab
- Creates a static, shareable family tree document
- Right-click canvas → "Regenerate canvas" to update

### 3. Explore Further

- **Map View:** Visualize birth/death locations geographically
- **Statistics:** Open Statistics Dashboard view for vault health, metrics, and data quality analysis
- **Reports:** Generate 13 report types including Ahnentafel, family group sheets, timelines, and more—export as PDF or Markdown

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
- [Canvas Trees](https://github.com/banisterious/obsidian-canvas-roots/wiki/Canvas-Trees) - Generating family trees
- [Import & Export](https://github.com/banisterious/obsidian-canvas-roots/wiki/Import-Export) - GEDCOM 5.5.1, GEDCOM X (JSON), Gramps XML, and CSV
- [Geographic Features](https://github.com/banisterious/obsidian-canvas-roots/wiki/Geographic-Features) - Maps and places
- [Evidence & Sources](https://github.com/banisterious/obsidian-canvas-roots/wiki/Evidence-And-Sources) - Source management and indicators
- [Events & Timelines](https://github.com/banisterious/obsidian-canvas-roots/wiki/Events-And-Timelines) - Life events and timeline visualization
- [Settings & Configuration](https://github.com/banisterious/obsidian-canvas-roots/wiki/Settings-And-Configuration) - All settings and property aliases
- [FAQ](https://github.com/banisterious/obsidian-canvas-roots/wiki/FAQ) - Common questions
- [Troubleshooting](https://github.com/banisterious/obsidian-canvas-roots/wiki/Troubleshooting) - Problem solving

### For Worldbuilders
- [Universe Notes](https://github.com/banisterious/obsidian-canvas-roots/wiki/Universe-Notes) - Organize fictional worlds with metadata and linked resources
- [Organization Notes](https://github.com/banisterious/obsidian-canvas-roots/wiki/Organization-Notes) - Noble houses, guilds, military units, and hierarchies
- [Fictional Date Systems](https://github.com/banisterious/obsidian-canvas-roots/wiki/Fictional-Date-Systems) - Custom calendars and eras

### Other Resources
- [Changelog](CHANGELOG.md) - Version history
- [Roadmap](https://github.com/banisterious/obsidian-canvas-roots/wiki/Roadmap) - Planned features

### For Developers
- [Getting Started](docs/developer/getting-started.md) - Development environment setup
- [Project Structure](docs/developer/project-structure.md) - Directory layout and component map
- [Implementation Details](docs/developer/implementation-details.md) - Technical deep-dive into all features
- [Coding Standards](docs/developer/coding-standards.md) - TypeScript and CSS style guidelines
- [Design Decisions](docs/developer/design-decisions.md) - Architecture decision records
- [Styling Guide](docs/developer/styling.md) - CSS architecture and theming
- [Contributing Guide](CONTRIBUTING.md) - How to contribute

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
