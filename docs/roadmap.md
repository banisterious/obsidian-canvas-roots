# Canvas Roots: Development Roadmap

> **Last Updated:** 2025-12-01
> **Current Version:** v0.5.0

Canvas Roots is in beta with core functionality complete and stable. Advanced features and enhancements are planned for future releases.

---

## 🎯 Released Versions

### v0.5.0 (Current)

**Canvas Navigation & Organization:**
- ✅ Split Canvas Wizard with 6 split methods
- ✅ Branch splitting (paternal/maternal lines)
- ✅ Collection-based splitting
- ✅ Single lineage extraction
- ✅ Ancestor + descendant canvas pairs
- ✅ Surname-based splitting (with spouse/maiden name options)
- ✅ Preview functionality before splitting

### v0.4.0

**Import Cleanup & Merge Tools:**
- ✅ Staging folder workflow for safe import processing
- ✅ Cross-import duplicate detection (staging vs main tree)
- ✅ Merge wizard with field-level conflict resolution
- ✅ Folder filtering for person note discovery
- ✅ Staging tab in Control Center with subfolder management
- ✅ Resolution tracking for duplicate matches (same/different person)
- ✅ Relationship reconciliation during merge operations

### v0.3.3

**CSV Import/Export, Selective Branch Export, Duplicate Detection:**
- ✅ CSV import/export with auto-detected column mapping
- ✅ Selective branch export (ancestors/descendants of specific person)
- ✅ Smart duplicate detection with fuzzy name matching
- ✅ Family Chart View: kinship labels, multiple views support
- ✅ Command: "Find duplicate people" for data quality

### v0.3.2

**ESLint Compliance & Bidirectional Name Sync:**
- ✅ Fixed 19 ESLint errors related to async/await and promise handling
- ✅ Removed unnecessary async keywords from synchronous methods
- ✅ Fixed floating promises in event handlers
- ✅ Improved code quality for PR review compliance
- ✅ Bidirectional name sync: chart edits rename files, file renames update frontmatter
- ✅ Chart automatically refreshes when person files are renamed

### v0.3.1

**PDF Export & Export Customization:**
- ✅ PDF export for Family Chart View (Export menu in toolbar)
- ✅ PDF export for Tree Preview in Control Center
- ✅ "Export as image" submenu on Canvas file context menu (PNG, SVG, PDF)
- ✅ Customizable export filename pattern with `{name}` and `{date}` placeholders
- ✅ New setting: Export filename pattern (default: `{name}-family-chart-{date}`)

### v0.3.0

**Interactive Family Chart View:**
- ✅ Persistent leaf view for exploring family trees interactively
- ✅ Full family-chart interactivity: pan, zoom, click-to-focus, smooth animations
- ✅ Edit mode with inline relationship editing and undo/redo support
- ✅ Bidirectional sync: chart edits update frontmatter, changes reflect in chart
- ✅ Multiple color schemes: Gender, Generation, Collection, Monochrome
- ✅ Export as PNG, SVG, PDF with customizable filenames
- ✅ Toolbar UI: layout, color scheme, zoom, history, search
- ✅ Command: "Open family chart view", "Open current note in family chart"
- ✅ Context menu integration on person notes
- ✅ Added jsPDF dependency for PDF generation

### v0.2.9

**Privacy Protection, Lineage Tracking, Relationship History, Folder Statistics:**
- ✅ Privacy protection for living persons in GEDCOM exports (configurable birth year threshold)
- ✅ Lineage tracking with patrilineal, matrilineal, and all-descendants modes
- ✅ Folder statistics modal with data completeness metrics
- ✅ Relationship history with undo support (configurable retention period)
- ✅ Enhanced Bases template with 22 pre-configured views (added 6 new views)
- ✅ Multi-vault deploy script support

### v0.2.8

**Reference Numbering Systems:**
- ✅ Ahnentafel (ancestor numbering)
- ✅ d'Aboville (descendant numbering with dots)
- ✅ Henry System (compact descendant numbering)
- ✅ Generation numbering (relative depth)
- Commands for all systems via command palette and context menu
- Numbers stored in frontmatter, automatically visible in Bases

### v0.2.7

**Bases Integration Improvements:**
- Enhanced error handling for Base operations
- Bases plugin detection with confirmation modal
- Improved Base template with additional visible properties

### v0.2.6

**Documentation & Polish:**
- Documentation updates for community plugin submission
- Minor UI text improvements for Obsidian style guide compliance

### v0.2.5

**Relationship Calculator:**
- Calculate relationship between any two people in the family graph
- BFS pathfinding algorithm finds shortest path through family connections
- Relationship naming with proper genealogical terms (cousin, uncle, etc.)
- Support for cousins with removal (1st cousin once removed, 2nd cousin twice removed)
- In-law relationship detection (parent-in-law, sibling-in-law, etc.)
- Common ancestor identification for collateral relationships
- Visual path display showing the chain of relationships
- Copy result to clipboard functionality
- Command palette entry: "Calculate relationship between people"
- Context menu entry on person notes for quick access

### v0.2.4

**Community Plugin Submission:**
- Prepared plugin for Obsidian community plugin directory
- Fixed manifest validation issues (removed "Obsidian" from description, corrected authorUrl)
- Standardized version numbering (removed -beta suffix for community compatibility)
- Added GitHub issue templates with privacy guidance for genealogical data
- Updated security documentation

### v0.2.3

**Interactive Tree Preview:**
- Real-time SVG preview with pan/zoom controls
- Color scheme options (Gender, Generation, Monochrome)
- Hover tooltips with person details
- PNG/SVG export functionality
- Integrated into Tree Output tab

**Alternative Layout Algorithms:**
- Standard, Compact, Timeline, and Hourglass layout algorithms
- Auto-generated canvas filenames with layout type suffix
- Layout type stored in canvas metadata for regeneration

**UI Consolidation:**
- Renamed "Tree Generation" to "Tree Output" tab
- Added "Generate tree" submenu in person note context menus
- Hybrid workflow: Canvas (full control) vs Excalidraw (instant generation)

**Essential Properties:**
- "Add essential properties" context menu action for single/multi-file selections
- All person note creation includes 9 essential properties by default
- Complete person notes from GEDCOM imports

### v0.2.2-beta

**Bidirectional Relationship Sync:**
- Automatic reciprocal relationship maintenance
- Works with Bases edits, frontmatter changes, and external editors

### v0.2.0-beta

**Beta Release:**
- Transitioned from alpha to beta status
- Core features confirmed stable and production-ready
- All essential genealogical workflows fully functional
- Foundation established for advanced feature development

**Enhanced GEDCOM Export:**
- Birth place and death place export as PLAC tags
- Occupation field support (OCCU tag)
- Gender/sex export from explicit `gender` property or inferred from relationships
- Full round-trip support: import metadata from GEDCOM, export to GEDCOM
- Metadata stored in frontmatter: `birth_place`, `death_place`, `occupation`, `gender`

**Excalidraw Export:**
- Export canvas family trees to Excalidraw format (.excalidraw.md)
- Preserves node positions, dimensions, and colors
- Converts Canvas nodes to Excalidraw rectangles with text labels
- Converts edges to Excalidraw arrows with proper bindings
- Context menu integration on canvas files (desktop and mobile)
- Enables manual annotation, drawing, and customization in Excalidraw
- Full compatibility with Obsidian Excalidraw plugin

### v0.1.4-alpha

**GEDCOM Export:**
- GEDCOM 5.5.1 format generation with complete header and trailer
- Individual record export with name, sex, birth/death dates and places
- Family record extraction from parent-child and spouse relationships
- UUID preservation using custom _UID tags for round-trip compatibility
- Collection code preservation (_COLL and _COLLN tags)
- Marriage metadata export (dates, locations from SpouseRelationship)
- Sex inference from father/mother relationships
- Collection filtering for selective export
- Control Center UI with export configuration
- Context menu integration on folders ("Export GEDCOM from this folder")
- Browser download with .ged file extension
- Comprehensive Guide tab documentation

### v0.1.3-alpha

**Collections & Groups (Complete):**
- Dual organization system: auto-detected family groups + user-defined collections
- Auto-detected groups with customizable group names (`group_name` property)
- User collections for manual organization (`collection` property)
- Context menu actions: "Set group name" and "Add to collection"
- Collections tab with three browse modes: All people, Detected families, My collections
- Cross-collection connection detection showing bridge people
- Collection filtering in tree generation (all tree types)
- Collection-based node coloring with hash-based color assignment
- Collection overview canvas generation with grid layout and connection edges
- Analytics dashboard with comprehensive statistics and data quality metrics
- Comprehensive Guide tab documentation with advanced features

**UI Polish:**
- Refactored Control Center to use Obsidian's native `Setting` component throughout
- Standardized form layouts with horizontal label/control pattern across all tabs
- Canvas Settings: Native dropdowns for arrow styles and color schemes, proper input controls
- Data Entry: Clean horizontal layout for person creation form
- Tree Generation: Streamlined configuration with native slider, dropdowns
- Collections: Replaced radio buttons with dropdown for browse mode
- Advanced: Native controls for logging and export configuration
- Reduced code by 319 lines while improving consistency and accessibility

**Documentation:**
- Updated README with Collections & Groups feature
- New Collections & Groups section in user guide
- Complete Collections architecture documentation (All Phases 1-3 implemented)

### v0.1.2-alpha

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

## 📋 Planned Features

### Import Cleanup & Consolidation

**Status**: ✅ Phases 1-3 Complete (v0.4.0)

Tools for consolidating multiple GEDCOM files, cleaning up messy imports, and improving data quality. Addresses the common scenario of having multiple old, overlapping GEDCOM files from various sources.

**Phase 1 - Staging Workflow:** ✅ Complete
- Dedicated staging folder setting (auto-excluded from normal operations)
- Import destination toggle (main vs staging) in Control Center
- "Promote to main" action to move cleaned data to person folder
- Delete/archive staging data without affecting main tree
- Staging folder isolated from: tree generation, duplicate detection, relationship sync, collections

**Phase 2 - Cross-Import Duplicate Detection:** ✅ Complete
- Detect duplicates between staging and existing data
- Staging tab in Control Center with subfolder management
- Side-by-side comparison view for potential matches
- "Same person" / "Different people" resolution actions
- Resolution persistence across sessions

**Phase 3 - Merge & Consolidation Tools:** ✅ Complete
- Merge wizard for combining duplicate records
- Field-level conflict resolution (choose which source's date/place/etc.)
- Support for combining arrays (spouses, children) from both sources
- Relationship reconciliation when merging people with different connections
- Merge available from both cross-import review and duplicate detection modals

**Phase 4 - Data Quality Tools:** ✅ Complete
- Data quality report with quality score (0-100)
- Issue detection across 5 categories: date inconsistencies, relationship problems, missing data, format issues, orphan references
- 15+ specific issue types (birth after death, circular references, unrealistic ages, etc.)
- Batch normalization: date formats, gender values, orphan reference cleanup
- Preview changes before applying batch operations
- Data Quality tab in Control Center with filtering and navigation

See [import-cleanup-plan.md](architecture/import-cleanup-plan.md) for implementation details.

---

### Folder Filtering

**Status**: ✅ Complete (v0.4.0)

Control which folders Canvas Roots scans for person notes. Useful for mixed-use vaults or complex organizational structures.

**Implemented Features:**
- **Exclusion list**: Ignore specific folders (e.g., templates, archive, non-genealogy notes)
- **Inclusion list**: Alternative mode - only scan specified folders
- Settings UI with dropdown for filter mode and textarea for folder list
- Case-insensitive path matching for cross-platform compatibility

**Applies to:**
- Person note detection (FamilyGraphService)
- Duplicate detection scope
- Tree generation scans
- Validation commands
- Relationship sync scope
- Vault statistics
- All import/export operations

See [folder-filtering-plan.md](architecture/folder-filtering-plan.md) for implementation details.

---

### Bases Integration Improvements

**Status**: ✅ Completed in v0.2.9

- ✅ Children property in visible properties (Completed in v0.2.0-beta)
- ✅ Additional pre-configured Base views for common genealogy queries (Completed: Single Parents, Childless Couples, Multiple Marriages, Sibling Groups, Root Generation, Marked Root Persons)
- ✅ Enhanced error handling and validation for Base operations (Completed in v0.2.7)
- ✅ 22 pre-configured views including lineage, generation, and reference numbering views (Completed in v0.2.9)
- Collection management UI improvements in Bases views (future enhancement)

### Ancestor/Descendant Lineage Tracking

**Status**: ✅ Completed in v0.2.9

Compute and track multi-generational lineages from marked root persons to enable filtering and analysis of ancestor/descendant lines in Bases.

**Implemented Features**:
- ✅ Lineage path tagging (mark people belonging to specific ancestral lines)
- ✅ Support for multiple root persons per person (stored as `lineage` array property)
- ✅ Patrilineal tracking (father's line only)
- ✅ Matrilineal tracking (mother's line only)
- ✅ All descendants tracking
- ✅ Commands: "Assign lineage from root person", "Remove lineage tags"
- ✅ Context menu integration (right-click on person note)
- ✅ Suggested lineage names based on surname
- ✅ Integration with Bases filtering (lineage property visible in views)

### Relationship History & Undo

**Status**: ✅ Completed in v0.2.9

- ✅ Command history modal tracking relationship changes made through Canvas Roots UI
- ✅ Manual undo commands to reverse recent relationship edits
- ✅ Relationship History panel showing recent changes with rollback options
- ✅ Change tracking for all relationship modifications (parent, spouse, child edits)
- ✅ Configurable history retention period
- ✅ Settings: `enableRelationshipHistory`, `historyRetentionDays`
- ✅ Commands: "View relationship history", "Undo last relationship change"

### Reference Numbering Systems

**Status**: ✅ Completed in v0.2.8

Genealogical numbering systems for systematic identification of ancestors and descendants. Numbers stored in YAML frontmatter properties, automatically available in Bases views.

**Implemented Systems:**
- ✅ **Ahnentafel** (ancestor numbering): Self=1, Father=2, Mother=3, paternal grandfather=4, etc. Pattern: person N's father=2N, mother=2N+1
- ✅ **d'Aboville** (descendant numbering): Root=1, children=1.1/1.2/1.3, grandchildren=1.1.1/1.1.2, etc. Dots indicate generations, numbers show birth order
- ✅ **Henry System** (compact descendant): Similar to d'Aboville without dots (1, 11, 12, 111, 112...)
- ✅ **Generation numbering**: 0=self, -1=parents, -2=grandparents, +1=children, etc.

**Implemented Features:**
- ✅ Commands for each numbering system (command palette)
- ✅ Context menu on person notes with submenu for all systems
- ✅ "Clear reference numbers" command to remove specific numbering type
- ✅ GEDCOM import integration ("Assign reference numbers" button in import results)
- ✅ Mobile-friendly flat menu structure

**Storage:**
- `ahnentafel` property in frontmatter (integer)
- `daboville` property in frontmatter (string, e.g., "1.2.3")
- `henry` property in frontmatter (string, e.g., "123")
- `generation` property in frontmatter (integer, negative for ancestors)
- Automatically visible in Bases views (users opt-in by adding column)

### Advanced UI

**Status**: ⏸️ Low Priority - Superseded by existing features

| Feature | Status | Notes |
|---------|--------|-------|
| Person Detail Panel | Low priority | Largely redundant with Bases table views and opening notes directly |
| Rich inline person display | Low priority | Bases provides this; Family Chart View would do it better |
| Quick editing | Low priority | Bases inline editing covers this use case |
| Canvas export as image/PDF | ✅ Completed | PNG/SVG/PDF export in Family Chart View and Tree Preview (v0.3.1) |

The "relationship visualization" aspect originally planned for Person Detail Panel is better served by the **Interactive Family Chart View**, which provides full tree context rather than just immediate relatives.

### Interactive Family Chart View

**Status**: ✅ Completed in v0.3.0

A dedicated Obsidian leaf view that renders the full family-chart library interactively, complementing the static canvas output. Leverages the complete [family-chart](https://github.com/donatso/family-chart) API for rich genealogical visualization.

**Implemented Features:**
- ✅ Persistent leaf view (sidebar, new tab, or split pane)
- ✅ Full family-chart interactivity: pan, zoom, click-to-focus, smooth animated transitions
- ✅ Bidirectional sync with markdown notes (chart edits update frontmatter, frontmatter changes reflect in chart)
- ✅ Click node to open person note in editor
- ✅ Edit mode with inline relationship editing and undo/redo support
- ✅ Multiple color schemes: Gender, Generation, Collection, Monochrome
- ✅ Export as PNG, SVG, PDF with customizable filenames (v0.3.1)
- ✅ Toolbar UI: layout, color scheme, zoom, history, search
- ✅ Command: "Open family chart view", "Open current note in family chart"
- ✅ Context menu integration on person notes

**Potential Future Enhancements:**
- Multiple chart views open simultaneously (different root persons)
- Linked views that stay synchronized
- Custom card components with Obsidian-specific actions
- Info popup integration showing person note preview
- Kinship labels display mode

### Privacy & Obfuscation

**Status**: ✅ Partially Completed in v0.2.9

**Implemented:**
- ✅ Living person privacy controls for GEDCOM exports
- ✅ Configurable birth year threshold (default: 100 years)
- ✅ Settings: `enableGedcomPrivacy`, `livingPersonThreshold`

**Planned:**
- Optional data obfuscation for canvas display
- PII protection for notes/canvas (beyond GEDCOM export)
- Configurable obfuscation rules for different export types

### Batch Operations

- ✅ "Generate all family trees" folder action (Completed v0.2.9)
- ✅ Batch tree generation with progress tracking (Completed v0.2.9)
- ✅ Folder-level statistics and health reports (Completed v0.2.9)

### Canvas Navigation & Organization

**Status:** ✅ Complete (v0.5.0)

Tools for splitting large trees into manageable segments and linking them together.

**Implemented Features:**
- ✅ Split wizard modal with multi-step configuration flow
- ✅ Split by generation (configurable generations per canvas)
- ✅ Split by branch (paternal/maternal lines)
- ✅ Single lineage extraction (direct line between two people)
- ✅ Split by collection (one canvas per user-defined collection)
- ✅ Ancestor + descendant canvas pairs for same root person
- ✅ **Split by surname** - Extract all people with a given surname, even without established connections
  - Scrollable list of available surnames sorted by frequency
  - Multi-surname selection for combined extraction
  - Options: include spouses, match maiden names, handle spelling variants
  - Separate canvas per surname or combined output
- ✅ Preview functionality showing expected canvas count and people
- ✅ Canvas file generation from wizard configuration
- ✅ Completion step with generation results summary

**Planned Enhancements:**
- Navigation nodes linking between related canvases
- Master overview canvases with links to detailed views

See [canvas-navigation-plan.md](architecture/canvas-navigation-plan.md) for implementation details.

### World-Building Features

- Visual grouping by house/faction
- Dual relationship trees (biological vs. political)
- Complex succession rules
- Fantasy dynasties and corporate succession tracking
- Geographic grouping and timeline support

### Family Statistics Dashboard

- Longevity analysis (average lifespan by generation, time period)
- Geographic distribution analysis and maps
- Most common names, occupations, places
- Generation gap analysis (parent age at child birth)
- Marriage patterns (age differences, remarriage frequency)
- Timeline views: "Who was alive in [year]?" queries
- Historical event correlation

### Smart Duplicate Detection

**Status**: ✅ Partially Completed in v0.3.3

**Implemented:**
- ✅ Find potential duplicate people by name similarity and date proximity
- ✅ Fuzzy matching for name variations (Levenshtein distance)
- ✅ Confidence scoring with configurable thresholds
- ✅ Command: "Find duplicate people" with modal UI

**Planned:**
- Merge wizard to consolidate duplicate records
- GEDCOM import duplicate detection before creating new notes
- Confidence scoring for duplicate suggestions

### Geographic Features

- Place name standardization and geocoding
- Map view showing birth/death locations
- Migration pattern visualization
- Place hierarchy (City → County → State → Country)
- Location-based filtering and analysis
- Historical place name support

### Research Tracking

- Mark people as "needs research" with specific to-dos
- Track confidence levels for relationships (verified, probable, possible)
- Source documentation per fact (birth date source, death place source)
- Research progress indicators in Bases views
- DNA match tracking and ethnicity data
- "DNA confirmed" relationship tagging

### Interactive Canvas Features

**Status**: ⏸️ Reconsidered - See Interactive Family Chart View

Most interactive canvas features are not feasible with Obsidian's current Canvas API, which lacks programmatic viewport control and event hooks. The Canvas is designed as a user-manipulated workspace, not a programmatically-controlled visualization.

| Feature | Feasibility | Issue |
|---------|-------------|-------|
| Hover tooltips | 🟡 Hacky | No official API; requires fragile DOM manipulation |
| Minimap | 🔴 Difficult | No viewport state access |
| Zoom to person | 🔴 Difficult | No programmatic viewport control |
| Highlight paths | 🟡 Hacky | Edge SVG manipulation possible but fragile |
| Collapsible branches | 🔴 Very difficult | Would require hide/show plus layout recalculation |
| Click-to-focus | 🔴 Difficult | Same viewport control limitation |

**Recommended Alternative**: The **Interactive Family Chart View** (see above) provides all these features natively by rendering family-chart directly in a dedicated Obsidian leaf view, bypassing Canvas API limitations entirely. Canvas remains valuable for static, printable output with Obsidian-native file linking.

### Alternative Layout Algorithms

- ✅ **Compact layout** - 50% tighter spacing for large trees (v0.2.3-beta)
- ✅ **Timeline layout** - Chronological positioning by birth year (v0.2.3-beta)
- ✅ **Hourglass layout** - Ancestors above, descendants below root person (v0.2.3-beta)
- Fan chart (circular ancestor view) - Deferred due to Canvas rectangular node constraints
- Bow-tie layout for showing connections between families

### Dynasty Management

- Succession tracking (line of succession calculator)
- Title/position inheritance
- Royal/noble house visualization
- Coat of arms and heraldry support
- Regnal numbering (King Henry VIII, etc.)
- Crown succession rules (primogeniture, ultimogeniture, etc.)

### Faction Relationships

- Alliance and conflict tracking between groups
- Political marriage networks
- Power structure hierarchies
- Faction-based coloring and visualization
- Inter-faction relationship mapping

### Import/Export Enhancements

**Status**: ✅ Partially Completed in v0.3.3

**Implemented:**
- ✅ CSV bulk import/export (v0.3.3)
- ✅ Selective export - specific branches only (v0.3.3)
- ✅ Privacy filters for living people (v0.2.9 for GEDCOM export)

**Planned:**
- FamilySearch GEDCOM X format support
- Gramps XML import
- Redacted exports for sharing

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
- Memory usage optimization for large family databases
- Lazy loading for large tree views

**Export & Import:**
- Additional export formats (PDF, SVG, family tree charts)
- ✅ GEDCOM export with birth/death places, occupation, and gender (Completed in v0.2.0-beta)
- Additional GEDCOM fields (sources, notes from file body, events beyond birth/death)
- GEDCOM import validation and error reporting improvements

---

## 📊 Known Limitations

See [known-limitations.md](known-limitations.md) for a complete list of current limitations and workarounds.

**Key Limitations:**
- ~~No reference numbering systems~~ ✅ Completed in v0.2.8
- ~~Living person privacy not yet implemented~~ ✅ Completed in v0.2.9 (GEDCOM export)
- Single vault only (no multi-vault merging)
- No undo/redo for Bases edits (Bases platform limitation)
- No bulk operations from Bases multi-select (Bases platform limitation)
- Privacy obfuscation for canvas display not yet implemented

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
