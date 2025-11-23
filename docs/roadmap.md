# Canvas Roots: Development Roadmap

> **Last Updated:** 2025-11-22
> **Current Version:** v0.1.1-alpha

Canvas Roots is in active alpha development with core functionality in place and advanced features planned.

---

## 🎯 Current Status (v0.1.1)

### ✅ Implemented Features

**Core Functionality:**
- TypeScript-based plugin foundation with Obsidian API integration
- Control Center modal UI for plugin management
- GEDCOM import with person note generation
- Dual storage relationship system (wikilinks + `cr_id` references)
- Bidirectional relationship linking
- Structured logging system with export capability

**Tree Generation:**
- Genealogical layout engine using [family-chart](https://github.com/donatso/family-chart) library for automated positioning
- Canvas generation from person notes with proper handling of complex relationships
- Multiple tree types: ancestors (pedigree), descendants, full family tree
- Generation limits and spouse inclusion controls
- Vertical and horizontal layout directions

**Canvas Management:**
- Canvas regeneration command for updating existing trees with current data
- Context menu integration (right-click on canvas files, tabs, or three-dot menu)
- Metadata preservation during regeneration
- Re-layout command with settings integration

**UI & Workflow:**
- Streamlined Tree Generation tab with inline person browser
- Person search, sort, and filter capabilities
- Multi-family detection and automatic family group organization
- "Generate all trees" command for batch tree creation
- Integrated generation workflow with single-card interface

**Styling & Customization:**
- Comprehensive canvas styling options within JSON Canvas spec
- Node coloring: gender-based, generation-based, or monochrome
- Arrow styles: directed, bidirectional, undirected
- Edge colors for parent-child and spouse relationships
- Settings interface for layout customization and logging control

**Multiple Spouse Support:**
- Flat indexed YAML properties (`spouse1`, `spouse2`, etc.)
- Marriage metadata: dates, locations, status (divorced, widowed, etc.)
- Optional spouse edge display with configurable labels
- Canvas Settings toggle for showing/hiding spouse edges
- Label formats: none, date-only, date-location, full

**Data Management:**
- Obsidian Bases template with one-click creation
- 6 pre-configured views for family data management
- YAML-first data storage for maximum compatibility
- Robust error handling in GEDCOM import

---

## 🚧 In Progress

### Collections Management (v0.2.0-beta)

**Phase 1: Component Naming**
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

### Phase 2: Collections (v0.3.0-beta)

- User collections with `collection` YAML property
- Collections tab in Control Center
- Collection filtering and statistics
- Cross-collection connection detection
- Obsidian Bases integration for bulk collection editing

### Phase 3: GEDCOM Export (v0.4.0)

- Round-trip GEDCOM export back to `.ged` format
- UUID preservation in GEDCOM export
- Collection codes in GEDCOM output
- Sharing with other genealogy software

### Phase 4: Reference Numbering (v0.5.0)

- Ahnentafel numbering system support
- Dollarhide-Cole numbering system support
- d'Aboville descendant numbering
- Automatic number assignment and display
- Integration with Obsidian Properties panel

### Phase 5: Advanced UI (v0.6.0)

- Person Detail Panel with relationship visualization
- Rich inline person information display
- Quick editing capabilities
- D3 tree preview with real-time layout configuration
- Interactive tree preview before canvas export

### Phase 6: Privacy & Obfuscation (v0.7.0)

- Optional data obfuscation for exports
- PII protection for canvas display
- Living person privacy controls
- Configurable obfuscation rules

### Phase 7: World-Building Features (v1.0.0)

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

## 🎓 Feature Phases by Version

### Alpha (v0.1.x) - Core Features ✅
- GEDCOM import
- Tree generation with family-chart layout
- Canvas regeneration
- Basic styling options
- Obsidian Bases template
- Multiple spouse support

### Beta (v0.2.x - v0.4.x) - Essential Features 🚧
- Collections management (v0.2.x)
- GEDCOM export (v0.3.x)
- Reference numbering (v0.4.x)

### Release Candidate (v0.5.x - v0.9.x) - Advanced Features 📋
- Person detail panel (v0.5.x)
- D3 tree preview (v0.6.x)
- Privacy controls (v0.7.x)
- DataView integration (v0.8.x)
- Performance optimization (v0.9.x)

### Stable (v1.0.0+) - Complete Platform 🔮
- World-building features
- Full genealogical feature set
- Community plugin directory listing
- Production-ready stability

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

## 📅 Release Schedule

Canvas Roots follows semantic versioning:
- **Patch releases (v0.1.x):** Bug fixes, minor improvements
- **Minor releases (v0.x.0):** New features, backward compatible
- **Major releases (v1.0.0+):** Breaking changes, major milestones

Target release cadence:
- Alpha patch releases: As needed for critical fixes
- Beta minor releases: Every 2-4 weeks
- Stable releases: When feature-complete and thoroughly tested

---

**Questions or suggestions?** Open an issue on [GitHub](https://github.com/banisterious/obsidian-canvas-roots/issues).
