# Implementation Details

This document covers technical implementation specifics for Canvas Roots features.

## Table of Contents

- [Context Menu Implementation](#context-menu-implementation)
- [Canvas Generation Implementation](#canvas-generation-implementation)
- [Family Chart Layout System](#family-chart-layout-system)
  - [Layout Engines](#layout-engines)
  - [Layout Selection](#layout-selection)
  - [Tree Generation Flow](#tree-generation-flow)
- [Dual Storage System](#dual-storage-system)
- [Privacy and Gender Identity Protection](#privacy-and-gender-identity-protection)
  - [Sex vs Gender Data Model](#sex-vs-gender-data-model)
  - [Living Person Privacy](#living-person-privacy)
  - [Log Export Obfuscation](#log-export-obfuscation)
  - [Planned Features](#planned-features-not-yet-implemented)

---

## Context Menu Implementation

### File Menu Integration

The plugin adds context menu items when right-clicking on files. The implementation uses nested submenus on desktop and flat menus on mobile for better UX.

**Basic Pattern in main.ts:**

```typescript
this.registerEvent(
  this.app.workspace.on('file-menu', (menu, file) => {
    // Desktop: use nested submenus; Mobile: use flat menu with prefixes
    const useSubmenu = Platform.isDesktop && !Platform.isMobile;

    if (file instanceof TFile && file.extension === 'md') {
      const cache = this.app.metadataCache.getFileCache(file);
      const hasCrId = !!cache?.frontmatter?.cr_id;

      if (hasCrId) {
        menu.addSeparator();

        if (useSubmenu) {
          menu.addItem((item) => {
            const submenu: Menu = item
              .setTitle('Canvas Roots')
              .setIcon('git-fork')
              .setSubmenu();

            // Add submenu items...
            submenu.addItem((subItem) => {
              subItem
                .setTitle('Generate Canvas tree')
                .setIcon('layout')
                .onClick(() => {
                  const modal = new ControlCenterModal(this.app, this);
                  modal.openWithPerson(file);
                });
            });
          });
        } else {
          // Mobile: flat menu with prefix
          menu.addItem((item) => {
            item
              .setTitle('Canvas Roots: Generate family tree')
              .setIcon('git-fork')
              .onClick(() => {
                const modal = new ControlCenterModal(this.app, this);
                modal.openWithPerson(file);
              });
          });
        }
      }
    }
  })
);
```

**ControlCenterModal.openWithPerson() in control-center.ts:**

```typescript
public openWithPerson(file: TFile): void {
  const cache = this.app.metadataCache.getFileCache(file);
  if (!cache?.frontmatter?.cr_id) {
    new Notice('This note does not have a cr_id field');
    return;
  }

  const crId = cache.frontmatter.cr_id;
  const name = cache.frontmatter.name || file.basename;

  // Store person info for the tab to use when it renders
  this.pendingRootPerson = {
    name,
    crId,
    birthDate: cache.frontmatter.born,
    deathDate: cache.frontmatter.died,
    file
  };

  // Open to Tree Output tab (combines open + tab switch)
  this.openToTab('tree-generation');
}
```

**Note:** The actual implementation in main.ts is more comprehensive, with separate handling for:
- Canvas files (regenerate, export, statistics)
- Person notes (generate tree, add relationships, reference numbers)
- Place notes (geocode, view on map)
- Source/Event/Organization notes
- Schema notes
- Folders (import/export, statistics)

---

## Canvas Generation Implementation

### Canvas Node ID Format

Canvas nodes require alphanumeric IDs without special characters (dashes, underscores, etc.). The plugin generates these using `Math.random().toString(36)`:

```typescript
// Good: alphanumeric only
"6qi8mqi3quaufgk0imt33f"

// Bad: contains dashes (not movable in Obsidian)
"qjk-453-lms-042"
```

**Implementation:** The canvas generator maintains a mapping from `cr_id` (person identifier) to `canvasId` (canvas node identifier) to ensure edges connect correctly while using Obsidian-compatible IDs.

### Canvas JSON Format

Obsidian Canvas requires a specific JSON format:

1. **Tab indentation** (`\t`) for structure
2. **Compact objects** - each node/edge on a single line with no spaces after colons/commas
3. **Required metadata** - version and frontmatter fields

Example:
```json
{
	"nodes":[
		{"id":"abc123","type":"file","file":"Person.md","x":0,"y":0,"width":250,"height":120}
	],
	"edges":[],
	"metadata":{
		"version":"1.0-1.0",
		"frontmatter":{}
	}
}
```

**Implementation:** Custom `formatCanvasJson()` method in `control-center.ts` ensures exact format match.

### Known Issues & Solutions

#### Issue: Canvas nodes not movable/resizable
**Cause:** Canvas node IDs contained dashes (e.g., `qjk-453-lms-042`)
**Solution:** Generate alphanumeric-only IDs matching Obsidian's format
**Fixed in:** `canvas-generator.ts` - `generateNodeId()` method

#### Issue: Canvas cleared on close/reopen
**Cause:** JSON formatting didn't match Obsidian's exact requirements
**Solution:** Implement custom JSON formatter with tabs and compact objects
**Fixed in:** `control-center.ts` - `formatCanvasJson()` method

#### Issue: Race condition when opening canvas
**Cause:** Canvas opened before file system write completed
**Solution:** Add 100ms delay before opening canvas file
**Fixed in:** `control-center.ts` and `main.ts` - canvas opening logic

#### Issue: GEDCOM import only shows root person in tree
**Cause:** GEDCOM importer's second pass replaced IDs in wrong fields (father/mother/spouse instead of father_id/mother_id/spouse_id)
**Solution:** Update regex patterns to target correct _id fields with dual storage
**Fixed in:** `gedcom-importer.ts` - Phase 2 ID replacement logic

---

## Family Chart Layout System

The family chart generation system transforms person notes into interactive family tree visualizations through multiple layout engines.

### Architecture Overview

```
Person Notes (YAML frontmatter)
         ↓
FamilyGraphService (build graph from notes)
         ↓
FamilyTree (graph structure: nodes + edges)
         ↓
Layout Engine Selection (based on layoutType)
         ↓
LayoutResult (positioned nodes)
         ↓
TreePreviewRenderer (SVG) OR CanvasGenerator (Canvas JSON)
```

### Layout Engines

Canvas Roots implements four distinct layout algorithms:

#### Family-Chart Layout (`src/core/family-chart-layout.ts`)

The default layout for standard and compact trees. Uses the external `family-chart` library's D3-based algorithm.

**Key features:**
- Handles spouse relationships correctly (unlike standard D3 hierarchical trees)
- Positions root person as topmost ancestor using intelligent ancestor scoring
- Handles missing people (siblings-in-law, etc.) not positioned by family-chart

**Ancestor selection logic** (`findTopAncestor()`):
- Scores ancestors by descendant count
- Huge bonus (10,000 points) if root person is a descendant
- Connection bonuses for different family lines

**Missing spouse handling:**
1. Check if spouse is positioned in layout
2. If not, position next to their partner at same Y level
3. Use 1.5x spacing multiplier for consistent placement

**Spacing configuration:**
```typescript
const DEFAULT_LAYOUT = {
    nodeSpacingX: 1200,  // Large due to Canvas name labels above nodes
    nodeSpacingY: 250,
    nodeWidth: 250,
    nodeHeight: 120
};
```

#### Timeline Layout (`src/core/timeline-layout.ts`)

Creates chronological timelines showing family members by birth year.

- X-axis: Birth year (horizontal timeline)
- Y-axis: Generation level (for collision avoidance)
- Scales years: `pixelsPerYear = spacing / 10` (10 years = one spacing unit)
- Estimates positions for people without birth dates based on parents/children
- Falls back to generation-based layout if no dates available

#### Hourglass Layout (`src/core/hourglass-layout.ts`)

Focuses on a single person with ancestors above and descendants below.

- Root person at center (Y = 0)
- Ancestors above (negative Y coordinates)
- Descendants below (positive Y coordinates)
- Each generation centered horizontally

**Centering formula:**
```typescript
totalWidth = (numPeople - 1) * horizontalSpacing;
startX = -totalWidth / 2;
x = startX + (index * spacing);
```

#### Standard D3 Layout (`src/core/layout-engine.ts`)

Fallback hierarchical layout for large trees (>200 people).

- Uses D3-hierarchy's `tree()` function
- Simpler algorithm, faster for very large trees
- Separation ratio: 1x for same parents, 1.5x for different parents

### Layout Selection

```typescript
// In CanvasGenerator.generateCanvas()
const layoutType = options.layoutType ?? 'standard';
const isLargeTree = familyTree.nodes.size > 200;

if (layoutType === 'timeline') {
    → TimelineLayoutEngine
} else if (layoutType === 'hourglass') {
    → HourglassLayoutEngine
} else if (useFamilyChartLayout && !isLargeTree) {
    → FamilyChartLayoutEngine (standard/compact)
} else {
    → D3 LayoutEngine (large trees or fallback)
}
```

**Compact layout** is not a separate engine but a 50% spacing multiplier applied to the standard layout:
```typescript
if (layoutType === 'compact') {
    layoutOptions.nodeSpacingX *= 0.5;
    layoutOptions.nodeSpacingY *= 0.5;
}
```

### Tree Generation Flow

1. **User selects root person** → PersonPickerModal returns cr_id
2. **FamilyGraphService builds tree** from person notes:
   ```typescript
   const familyTree = familyGraphService.generateTree({
       rootCrId: selectedPersonId,
       treeType: 'descendants',  // or 'ancestors', 'full'
       maxGenerations: 5,
       includeSpouses: true
   });
   ```
3. **Layout engine calculates positions** → Returns `LayoutResult`
4. **Output generation:**
   - **Interactive preview** (`TreePreviewRenderer`): SVG with pan/zoom, tooltips, color schemes
   - **Canvas export** (`CanvasGenerator`): Obsidian Canvas JSON with metadata for smart re-layout

### Key Data Structures

```typescript
interface FamilyTree {
    root: PersonNode;
    nodes: Map<string, PersonNode>;  // crId → PersonNode
    edges: FamilyEdge[];
}

interface LayoutResult {
    positions: NodePosition[];
    options: Required<LayoutOptions>;
}

interface NodePosition {
    crId: string;
    person: PersonNode;
    x: number;
    y: number;
    generation?: number;
}
```

### Interactive Preview

`TreePreviewRenderer` (`src/ui/tree-preview.ts`) provides:
- **Zoom**: Mouse wheel (0.1x to 5x scale)
- **Pan**: Click + drag
- **Hover**: Tooltips with name, dates, generation
- **Color schemes**: sex (M=green, F=purple), generation (rainbow), monochrome
- **Export**: PNG, SVG, PDF
- **Node scaling**: Preview nodes are 40% of actual size for better overview

### Canvas Metadata

Generated canvases embed metadata for smart re-layout:
```typescript
interface CanvasRootsMetadata {
    plugin: 'canvas-roots',
    generation: {
        rootCrId, rootPersonName, treeType,
        maxGenerations, includeSpouses, direction, timestamp
    },
    layout: {
        nodeWidth, nodeHeight, nodeSpacingX, nodeSpacingY, layoutType
    }
}
```

---

## Dual Storage System

The plugin implements a **dual storage pattern** for relationships to balance Obsidian features with reliable resolution:

### Frontmatter Structure

```yaml
---
cr_id: abc-123-def-456
name: John Smith
father: "[[Dad Smith]]"      # Wikilink (enables Obsidian features)
father_id: xyz-789-uvw-012   # cr_id (enables reliable resolution)
mother: "[[Mom Smith]]"
mother_id: pqr-345-stu-678
spouse:
  - "[[Jane Doe]]"
spouse_id:
  - mno-901-jkl-234
children:
  - "[[Child 1]]"
  - "[[Child 2]]"
children_id:
  - def-456-ghi-789
  - abc-123-xyz-456
---
```

### Benefits

1. **Wikilinks** (father/mother/spouse/children): Enable Obsidian's link graph, backlinks, and hover previews
2. **ID fields** (_id suffix): Provide reliable resolution that survives file renames

### Implementation

- **bidirectional-linker.ts**: Creates/updates both wikilink and _id fields when syncing relationships
- **family-graph.ts**: Reads from _id fields first, falls back to wikilink resolution for legacy support
- **gedcom-importer.ts**: Two-pass import: creates wikilinks in first pass, replaces with cr_ids in _id fields in second pass

---

## Privacy and Gender Identity Protection

The plugin supports inclusive gender identity modeling and privacy protection for sensitive data.

### Sex vs Gender Data Model

The frontmatter supports three distinct fields (defined in `src/types/frontmatter.ts`):

```yaml
sex: M                          # GEDCOM-compatible biological sex (M/F/X/U)
gender: male                    # Legacy field, falls back to sex when reading
gender_identity: Non-binary     # Free-form gender identity field
```

**Field usage:**

| Field | Purpose | Used By |
|-------|---------|---------|
| `sex` | Biological sex for GEDCOM compatibility | Import/export, Data Quality normalization, Canvas coloring |
| `gender` | Backwards compatibility | Falls back to `sex` when reading |
| `gender_identity` | Personal identity (free-form) | Display only (not used in data interchange) |

**Canvas node coloring** (`src/core/canvas-generator.ts` - `getPersonColor()`):
- Reads `sex` field from frontmatter
- M/MALE → Green (color 4)
- F/FEMALE → Purple (color 6)
- NONBINARY → Yellow (color 3)
- Unknown → Orange (color 2)
- Falls back to name prefix detection (Mr., Mrs., etc.) for legacy support

**Data Quality sex normalization** (`src/core/data-quality.ts` - `normalizeGenderValues()`):
- Standardizes values to GEDCOM M/F/X/U format
- Uses built-in synonyms (male→M, female→F, etc.)
- Supports user-defined value aliases via settings
- Three modes controlled by `settings.sexNormalizationMode`:
  - `standard` - Normalize all values to GEDCOM M/F/X/U
  - `schema-aware` - Skip notes with schemas defining custom sex values
  - `disabled` - No normalization

### Living Person Privacy

The `PrivacyService` (`src/core/privacy-service.ts`) protects living individuals in exports:

**Detection logic:**
- Person is "likely living" if: no death date AND birth year within age threshold
- Default threshold: 100 years (configurable via `settings.livingPersonAgeThreshold`)
- Supports approximate dates: "about 1920", "between 1920-1930", "before 1920"

**Protection display options** (`settings.privacyDisplayFormat`):

| Option | Display | Behavior |
|--------|---------|----------|
| `living` | "Living" | Show placeholder name |
| `private` | "Private" | Show placeholder name |
| `initials` | "J.S." | Show initials only |
| `hidden` | (excluded) | Remove from output entirely |

**What gets protected in exports:**
- **Name**: Replaced with chosen display format
- **Birth/death dates**: Hidden when `hideDetailsForLiving` is enabled
- **Relationships**: Preserved (allows tree structure to remain intact)
- **Original notes**: Unchanged (protection applies to outputs only)

**Applied in exports:**
- GEDCOM export (`src/gedcom/gedcom-exporter.ts`)
- GEDCOM X export (`src/gedcomx/gedcomx-exporter.ts`)
- Gramps XML export (`src/gramps/gramps-exporter.ts`)
- CSV export (`src/csv/csv-exporter.ts`)

**Not yet applied to:**
- Canvas display (shows full data)
- Interactive family chart view
- Reports (markdown output)

For user-facing documentation, see [Privacy & Security](../../wiki-content/Privacy-And-Security.md).

### Log Export Obfuscation

The logging system (`src/core/logging.ts`) includes built-in PII obfuscation for log exports, protecting personal data when sharing logs for debugging.

**Setting:** `settings.obfuscateLogExports` (default: `true` - secure by default)

**What gets obfuscated:**

| Pattern | Replacement | Example |
|---------|-------------|---------|
| Names (capitalized multi-word) | `[NAME-1]`, `[NAME-2]`, etc. | "John Smith" → `[NAME-1]` |
| ISO dates | `[DATE]` | "1985-03-15" → `[DATE]` |
| Years (1000-2029) | `[YEAR]` | "born in 1952" → "born in `[YEAR]`" |
| File paths (`.md`) | `/[FILE].md` | "/People/John Smith.md" → `/[FILE].md` |
| UUIDs/cr_ids | `[ID]` | "abc12345-..." → `[ID]` |

**Implementation functions:**
- `obfuscateString(str)` - Replaces PII patterns in a string
- `obfuscateData(data)` - Recursively obfuscates objects/arrays
- `obfuscateLogEntry(entry)` - Obfuscates a single log entry (preserves technical fields like component, category, level)
- `obfuscateLogs(logs)` - Obfuscates an array of log entries

**Usage in settings UI** (`src/settings.ts`):
```typescript
const logsToExport = this.plugin.settings.obfuscateLogExports
  ? obfuscateLogs(logs)
  : logs;
```

**Design notes:**
- Names are replaced with consistent numbered tokens (`[NAME-1]`, `[NAME-2]`) within each log entry to preserve reference relationships
- Numbers and booleans pass through unchanged (safe technical data)
- Component and category names are preserved (technical identifiers, not PII)

### Planned Features (Not Yet Implemented)

The following are documented for future implementation:

- **`cr_living` manual override** - Frontmatter property to explicitly mark someone as living (`cr_living: true`) or deceased (`cr_living: false`), overriding automatic detection
- **Pronouns field** - `pronouns: she/her` for respectful communication
- **Underscore-prefix privacy convention** - Fields like `_previous_names` excluded from search/display
- **Deadname protection** - Automatic suppression of historical names
- **Export warnings** - Confirmation when exporting private fields
- **Canvas privacy obfuscation** - Apply privacy protection to canvas display, not just exports

### Design Rationale

- Separates GEDCOM biological data from personal identity
- Supports inclusive gender identity while maintaining data interchange compatibility
- Protects living persons from inadvertent disclosure in exports
- Respects user-defined schemas that may have custom sex/gender values
