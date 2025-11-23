# Canvas Roots: Development Roadmap

> **Last Updated:** 2025-11-22
> **Current Version:** v0.1.2-alpha

Canvas Roots is in active alpha development with core functionality in place and advanced features planned.

---

## 🎯 Released Versions

### v0.1.2-alpha (Current)

**Context Menu Actions:**
- Person notes: Add relationships, validate data integrity, find on canvases
- Folders: Set as people folder, import GEDCOM, scan for relationship issues
- Canvas files: Regenerate trees, view statistics
- Full desktop and mobile support

### v0.1.1-alpha

**Tree Statistics & Regeneration:**
- Tree statistics modal showing person count, generation depth, edge counts
- Canvas regeneration with options to preserve/update layout and styling
- Context menu integration for canvas files

### v0.1.0-alpha

**Core Functionality:**
- TypeScript-based plugin foundation with Obsidian API integration
- Control Center modal UI for plugin management
- GEDCOM import with person note generation
- Dual storage relationship system (wikilinks + `cr_id` references)
- Bidirectional relationship linking
- Structured logging system with export capability

**Tree Generation:**
- Genealogical layout engine using [family-chart](https://github.com/donatso/family-chart) library
- Canvas generation from person notes with complex relationship handling
- Multiple tree types: ancestors (pedigree), descendants, full family tree
- Generation limits and spouse inclusion controls
- Vertical and horizontal layout directions

**UI & Workflow:**
- Streamlined Tree Generation tab with inline person browser
- Person search, sort, and filter capabilities
- Multi-family detection and automatic family group organization
- "Generate all trees" command for batch tree creation

**Styling & Customization:**
- Comprehensive canvas styling options within JSON Canvas spec
- Node coloring: gender-based, generation-based, or monochrome
- Arrow styles: directed, bidirectional, undirected
- Edge colors for parent-child and spouse relationships

**Multiple Spouse Support:**
- Flat indexed YAML properties (`spouse1`, `spouse2`, etc.)
- Marriage metadata: dates, locations, status (divorced, widowed, etc.)
- Optional spouse edge display with configurable labels
- Label formats: none, date-only, date-location, full

**Data Management:**
- Obsidian Bases template with one-click creation
- 6 pre-configured views for family data management
- YAML-first data storage for maximum compatibility

---

## 🚧 In Active Development

### Collections Management

**Component Naming:**
- Add `collection_name` property support to person notes
- Update UI to show custom names instead of "Family 1", "Family 2"
- Implement naming conflict resolution (most common name wins)

**Architecture:**
- Dual system: detected components (computed) + user collections (stored)
- Zero configuration required (flat vaults fully supported)
- Self-healing data (component membership computed from relationships)

See [architecture/collections.md](architecture/collections.md) for complete ADR.

---

## 📋 Planned Features

### Collections

- User collections with `collection` YAML property
- Collections tab in Control Center
- Collection filtering and statistics
- Cross-collection connection detection
- Obsidian Bases integration for bulk collection editing

### GEDCOM Export

- Round-trip GEDCOM export back to `.ged` format
- UUID preservation in GEDCOM export
- Collection codes in GEDCOM output
- Sharing with other genealogy software

### Reference Numbering Systems

- Ahnentafel numbering system support
- Dollarhide-Cole numbering system support
- d'Aboville descendant numbering
- Automatic number assignment and display
- Integration with Obsidian Properties panel

### Advanced UI

- Person Detail Panel with relationship visualization
- Rich inline person information display
- Quick editing capabilities
- D3 tree preview with real-time layout configuration
- Interactive tree preview before canvas export
- Canvas export as image/PDF

### Privacy & Obfuscation

- Optional data obfuscation for exports
- PII protection for canvas display
- Living person privacy controls
- Configurable obfuscation rules

### Batch Operations

- "Generate all family trees" folder action
- Batch tree generation with progress tracking
- Folder-level statistics and health reports

### World-Building Features

- Visual grouping by house/faction
- Dual relationship trees (biological vs. political)
- Complex succession rules
- Fantasy dynasties and corporate succession tracking
- Geographic grouping and timeline support

---

## 🔮 Future Considerations

**Advanced Features:**
- Alternative parent relationships (adoption, foster care, step-parents)
- Unknown parent handling with placeholder nodes
- Flexible date formats (circa dates, date ranges)
- Child ordering within families
- Multi-generational gap handling
- Relationship quality visualization (close, distant, estranged)
- Medical genogram support
- Location and migration tracking
- Place note system

**Integration:**
- DataView template library
- Advanced Canvas plugin integration
- Multi-vault merging with collection matching
- Cloud sync considerations

**Performance:**
- Large tree optimization (1000+ people)
- Incremental layout updates
- Canvas rendering performance improvements

---

## 📊 Known Limitations

See [known-limitations.md](known-limitations.md) for a complete list of current limitations and workarounds.

**Key Limitations:**
- No GEDCOM export yet (import only)
- Collections require manual organization
- No reference numbering systems
- Living person privacy not yet implemented
- Single vault only (no multi-vault merging)

---

## 🤝 Contributing to the Roadmap

We welcome feedback on feature priorities! Please:

1. Check [existing issues](https://github.com/banisterious/obsidian-canvas-roots/issues) first
2. Open a new issue with the `feature-request` label
3. Describe your use case and why the feature would be valuable
4. Be specific about genealogical standards or workflows you need

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development setup and contribution guidelines.

---

## 📅 Release Philosophy

Canvas Roots follows semantic versioning:
- **Patch releases (v0.1.x):** Bug fixes, minor improvements
- **Minor releases (v0.x.0):** New features, backward compatible
- **Major releases (v1.0.0+):** Breaking changes, major milestones

Features are prioritized based on:
- User feedback and requests
- Genealogical standards compliance
- Foundation for future features
- Development complexity vs. value

---

**Questions or suggestions?** Open an issue on [GitHub](https://github.com/banisterious/obsidian-canvas-roots/issues).
