# Known Limitations - Beta Release

**Last Updated:** 2025-11-23
**Current Version:** v0.2.0-beta

This document outlines features that are planned but not yet implemented in the beta release of Canvas Roots. The plugin's core functionality (GEDCOM import/export, tree generation, canvas styling, and collections) is stable and production-ready.

---

## Features Not Yet Implemented

### Collections Management ✅ IMPLEMENTED

**Status:** Fully implemented (v0.1.3-alpha)

**Features Working:**
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

**How to Use:**
1. Open Control Center → Collections tab
2. Browse by detected families or create custom collections
3. Filter tree generation by collection
4. Generate collection overview canvases

---

### Multi-Family Detection UI ✅ IMPLEMENTED

**Status:** Fully implemented (v0.1.1-alpha)

**Features Working:**
- Multi-family detection works correctly (backend detects disconnected family components)
- Visual family group sidebar in Tree Generation tab's person picker
- Shows "Family 1", "Family 2", etc. with person counts for each group
- "All families" tab to view everyone at once
- Clicking a family tab filters person list to show only that family's members
- Disconnected family notice displayed after generating full family trees
- Notice shows: "Full Family Tree shows X of Y people. Z people are not connected..."

**How to Use:**
1. Open Control Center → Tree Generation tab
2. If multiple families detected, sidebar appears automatically
3. Click a family group tab to browse only that family
4. Select root person from filtered list
5. Generate tree for that specific family

**Alternative:**
- Use "Generate all trees" command to automatically create canvases for all family groups at once

---

### GEDCOM Export (Round-Trip) ✅ IMPLEMENTED

**Status:** Fully implemented (v0.1.4-alpha)

**Features Working:**
- GEDCOM 5.5.1 format generation with complete header and trailer
- Individual record export with name, sex, birth/death dates
- Family record extraction from parent-child and spouse relationships
- UUID preservation using custom _UID tags for round-trip compatibility
- Collection code preservation (_COLL and _COLLN tags)
- Marriage metadata export (dates, locations from SpouseRelationship)
- Sex inference from father/mother relationships
- Collection filtering for selective export
- Control Center UI with export configuration
- Context menu integration on folders ("Export GEDCOM from this folder")
- Browser download with .ged file extension

**How to Use:**
1. Open Control Center → GEDCOM tab → Export section
2. Configure export options (filename, collection filter, etc.)
3. Click "Export to GEDCOM"
4. Or right-click any folder → "Export GEDCOM from this folder"

**Round-Trip Compatibility:**
- Export → import → export maintains same UUIDs
- Collection codes preserved for re-import
- Marriage metadata preserved

---

### Reference Numbering Systems

**Status:** Planned for future release

**Current Limitation:**
- No Dollarhide-Cole numbering system
- No Ahnentafel numbering system
- No automatic reference number assignment or display

**Impact:**
- Cannot use traditional genealogical reference numbering
- No hierarchical person identifiers beyond `cr_id` UUIDs
- Harder to organize print reports or references

**Workarounds:**
1. Manually add reference numbers to person note titles (e.g., "12.3 - John Smith")
2. Use `cr_id` for technical operations (reliable but not human-friendly)
3. Create custom numbering schemes in person note frontmatter
4. Use Dataview queries to generate numbered lists

**Related Specification:** See [docs/specification.md](specification.md) §2.1.4 Reference Numbering Systems

---

### Person Detail Panel

**Status:** Planned for future release

**Current Limitation:**
- No rich person information display panel
- No inline relationship visualization
- No quick editing interface for person properties

**Impact:**
- Must open person notes directly to view/edit details
- Cannot see relationship overview without generating a tree
- No hover preview for quick person information

**Workarounds:**
1. Use Obsidian's hover preview (Ctrl/Cmd + hover over wikilink)
2. Open person notes in separate panes for side-by-side viewing
3. Use Dataview queries to create custom person summaries
4. Use Bases table view for bulk editing of person properties

**Related Specification:** See [docs/specification.md](specification.md) §3.3 Person Detail Panel

---

### D3 Tree View (Interactive Preview)

**Status:** Planned for future release

**Current Limitation:**
- No interactive D3 tree preview before canvas export
- Cannot test layout configurations without creating canvas files
- No real-time layout preview

**Impact:**
- Must generate canvas to see tree layout
- Trial-and-error for spacing and configuration settings
- More iterations needed to get desired layout

**Workarounds:**
1. Use small test trees to experiment with settings
2. Use "Regenerate canvas" command to quickly update existing trees with new settings
3. Start with default settings (work well for most cases)
4. Adjust spacing incrementally and regenerate to see changes

**Related Specification:** See [docs/specification.md](specification.md) §3.5 Tree Visualization Modes

---

### Advanced Relationship Features

**Status:** Planned for future releases

**Features Not Implemented:**
- Relationship quality metadata (§6.8)
- Medical genogram support (§6.9)
- Enhanced location and migration tracking (§6.10)
- Visual grouping by house/faction (§7.1)
- Dual relationship trees (biological vs. political) (§7.2)
- Succession rules engine (§7.3)
- Co-ruling visualization (§7.4)

**Impact:**
- Cannot track emotional bond strength or relationship quality
- Cannot create medical family trees with health conditions
- No specialized support for world-building or organizational hierarchies
- No geographic migration visualization

**Workarounds:**
1. Add custom frontmatter fields for advanced metadata
2. Use tags and properties for manual categorization
3. Use multiple canvases for different relationship views
4. Use text notes within person notes for narrative context

**Related Specification:** See [docs/specification.md](specification.md) §6 Enhanced Relationship Modeling and §7 World-Building Features

---

## What IS Working (Tested and Stable)

### ✅ GEDCOM Import

**Tested:** Baseline (11 people), Malformed (13 people with 10+ edge cases)

**Results:**
- 100% import success rate on malformed data
- Zero crashes during import
- Graceful degradation with sensible defaults ("Unknown" for missing names)
- Perfect preservation of special characters (`< > ' -`)
- Duplicate UUIDs handled with separate `cr_id` values
- Import time: ~0.4 seconds for small files

**User Feedback:**
- Enhanced import notices show malformed data count
- Example: "Import complete: 13 people imported. 5 had missing/invalid data (defaults applied)"

---

### ✅ Tree Generation

**Tested:** Baseline (11 people, 4 generations)

**Results:**
- Zero overlapping nodes
- Fast performance (0.005 sec layout, 0.168 sec total generation)
- Perfect layout quality with proper spacing
- All relationships correctly represented
- Gender-based node coloring working (green/purple)
- Spouse edges displayed correctly (yellow, undirected)

**Canvas Dimensions:** ~1500 x 600 pixels for 11-person tree

---

### ✅ Regenerate Canvas

**Tested:** Manual testing during development

**Features:**
- Preserves original tree settings (type, generations, root person)
- Applies current spacing and styling settings
- Updates relationship data from person notes
- Non-destructive (updates canvas in-place)
- Supports layout direction change (vertical ↔ horizontal)

---

### ✅ Canvas Styling

**Features Working:**
- Node coloring: Gender-based, generation-based, monochrome
- Arrow styles: Directed (→), bidirectional (↔), undirected (—)
- Edge colors: 6 preset colors or theme default
- Separate controls for parent-child vs. spouse relationships
- All styling compliant with JSON Canvas 1.0 spec

---

### ✅ Disconnected Family Detection

**Tested:** Malformed GEDCOM (8 of 13 disconnected)

**Features:**
- Automatically detects disconnected family components
- Displays clear user notice after tree generation
- Notice shows connected vs. total people count
- Suggests using "Generate all trees" command

**Example Notice:**
> Full Family Tree shows 5 of 13 people.
>
> 8 people are not connected to John Smith through family relationships.
>
> This usually means your vault has multiple separate family trees. Use the "Generate all trees" command to create canvases for all family groups at once.

---

### ✅ Recent Trees History

**Features Working:**
- Automatically tracks last 10 generated trees
- Displays in Status tab and Quick Actions tab
- Clickable tree names open canvas files
- Shows root person, people count, and relative timestamp
- Automatic cleanup of deleted canvas files

---

### ✅ Error Handling

**Tested:** Malformed GEDCOM with 10+ edge cases

**Edge Cases Handled:**
- Empty names → "Unknown"
- Missing dates → No crash, omitted from display
- Invalid date formats → Graceful handling
- Non-existent spouse references → Placeholder created
- Duplicate UUIDs → Separate `cr_id` values assigned
- Special characters → Preserved perfectly
- Invalid relationships → Tree generation unaffected

**Rating:** Production-ready (exceeds alpha expectations)

---

## Performance Characteristics

Based on testing with GEDCOM sample files:

| Tree Size | Import Time | Layout Time | Canvas Size | Status |
|-----------|-------------|-------------|-------------|--------|
| 11 people | 0.45 sec | 0.005 sec | ~1500 x 600 px | ✅ Excellent |
| 13 people (malformed) | 0.38 sec | 0.005 sec | ~900 x 400 px | ✅ Excellent |

**Estimated Limits (not yet tested):**
- Small trees (< 30 people): Expected to work excellently
- Medium trees (30-100 people): Likely good performance
- Large trees (100-200 people): Unknown, user testing needed
- Extra-large trees (200+ people): May hit practical limits

**Note:** Actual performance limits will be determined by alpha user feedback and scale testing.

---

## Reporting Issues

If you encounter problems with features listed as "working" above, please report them:

1. Check the Obsidian console for error messages (Ctrl/Cmd + Shift + I)
2. Export logs from Control Center → Status tab
3. Report at: https://github.com/banisterious/obsidian-canvas-roots/issues

Include:
- Plugin version (v0.1.0-alpha)
- Obsidian version
- Operating system
- Steps to reproduce
- Console errors or exported logs

---

## Planned Release Timeline

**Current:** v0.2.0-beta (core features complete and stable)

**Future Releases:**
- Bug fixes and stability improvements based on user feedback
- Reference numbering systems (Ahnentafel, etc.)
- Person detail panel and interactive tree preview
- Privacy/obfuscation features for living people
- Advanced relationship features and world-building support

Timeline is subject to change based on user feedback and development priorities.

---

## Summary

Canvas Roots v0.2.0-beta is **production-ready** for core genealogical workflows in Obsidian:

**Strengths:**
- ✅ Exceptional GEDCOM import/export with round-trip compatibility
- ✅ Zero-overlap tree layouts with proper genealogical positioning
- ✅ Comprehensive canvas styling options
- ✅ Non-destructive canvas regeneration
- ✅ Multi-family detection and handling
- ✅ Collections management with auto-detection and custom organization
- ✅ Context menu integration for all common operations
- ✅ Production-grade error handling and validation

**Limitations:**
- ❌ No reference numbering systems (Ahnentafel, etc.)
- ❌ No person detail panel or interactive preview
- ❌ No advanced relationship features (medical genograms, etc.)
- ❌ No privacy/obfuscation features for living people

**Recommendation:** Canvas Roots v0.2.0-beta is stable and ready for everyday use. Core features are production-ready with robust error handling. Perfect for users who want automated family tree visualization in Obsidian Canvas with full data portability via GEDCOM. Remaining features are enhancements, not essential functionality.
