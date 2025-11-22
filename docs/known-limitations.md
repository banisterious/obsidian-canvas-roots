# Known Limitations - Alpha Release v0.1.0

**Last Updated:** 2025-11-22

This document outlines features that are planned but not yet implemented in the alpha release of Canvas Roots. The plugin's core functionality (GEDCOM import, tree generation, and canvas styling) is stable and well-tested.

---

## Features Not Yet Implemented

### Collections Management

**Status:** Planned for future release

**Current Limitation:**
- No folder-based collection auto-discovery
- All person notes in the vault are treated as one large collection
- No collection-level organization or browsing interface

**Impact:**
- Users with multiple family trees in one vault must manage them manually
- No automatic grouping by folder structure

**Workarounds:**
1. Use folder names as prefixes in person note titles (e.g., "Smith Family - John Smith")
2. Use tags to identify different families (e.g., `#family/smith`, `#family/jones`)
3. Use the "Generate all trees" command to automatically create separate canvases for each disconnected family group
4. Keep different families in separate Obsidian vaults if strict separation is needed

**Related Specification:** See [docs/specification.md](specification.md) §3.4 Collections and Dataset Management

---

### Multi-Family Detection UI ✅ IMPLEMENTED

**Status:** Fully implemented (v0.1.1)

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

**Testing Results:** Malformed GEDCOM test showed this works correctly - detected 8 of 13 disconnected people, displayed family groups in sidebar, and showed appropriate notice after generation.

---

### GEDCOM Export (Round-Trip)

**Status:** Planned for future release

**Current Limitation:**
- Import-only in alpha release
- No export from Canvas Roots format back to `.ged` format
- No round-trip data integrity validation

**Impact:**
- Cannot share your Canvas Roots research with users of other genealogy software
- Cannot create backup `.ged` files from your Obsidian vault
- Data portability is one-way (import only)

**Workarounds:**
1. Keep original `.ged` files as backups
2. Use Obsidian Bases (table view) to export person data to CSV if needed
3. Maintain parallel data in genealogy software if round-trip is critical
4. Use Obsidian's native export features (copy-paste, file export) for data sharing

**Related Specification:** See [docs/specification.md](specification.md) §5.3 Export (Round-Trip)

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

**Current:** v0.1.0-alpha (core features stable)

**Future Releases:**
- **v0.2.0-beta:** Collections management, GEDCOM export, reference numbering
- **v0.3.0-beta:** Person detail panel, D3 tree view
- **v1.0.0:** Full feature set from specification
- **v1.x.x:** Advanced relationship features, world-building support

Timeline is subject to change based on user feedback and development priorities.

---

## Summary

Canvas Roots v0.1.0-alpha provides a **solid foundation** for genealogical research in Obsidian:

**Strengths:**
- ✅ Exceptional GEDCOM import with robust error handling
- ✅ Zero-overlap tree layouts with proper genealogical positioning
- ✅ Comprehensive canvas styling options
- ✅ Non-destructive canvas regeneration
- ✅ Multi-family detection and handling

**Limitations:**
- ❌ No collections management (single vault-wide collection)
- ❌ No GEDCOM export (import-only)
- ❌ No reference numbering systems
- ❌ No advanced relationship features (medical genograms, etc.)

**Recommendation:** Ideal for users who want automated family tree visualization in Obsidian Canvas. Best suited for single-family research or users comfortable with manual family group management.
