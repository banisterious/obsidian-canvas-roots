# Development Guide

## Project Setup

### Installation
```bash
npm install
```

### Build Commands

- `npm run dev` - Start development mode with watch (builds to local main.js)
- `npm run build` - Production build with type checking
- `npm run lint` - Check TypeScript code for linting errors
- `npm run lint:fix` - Auto-fix TypeScript linting errors
- `npm run lint:css` - Check CSS for linting errors
- `npm run lint:css:fix` - Auto-fix CSS linting errors
- `npm run format:css` - Format CSS with Prettier

**Before committing code**, always run linting to ensure compliance with coding standards:
```bash
npm run lint && npm run lint:css
```

See [Coding Standards](docs/developer/coding-standards.md) for detailed style guidelines.

## Manual Deployment to Obsidian Vault

To deploy the plugin to your Obsidian vault for testing:

1. Build the plugin:
   ```bash
   npm run build
   ```

2. Manually copy the built files to your vault's plugin directory:
   ```bash
   cp main.js manifest.json styles.css /path/to/your/vault/.obsidian/plugins/canvas-roots/
   ```

3. Reload Obsidian (Ctrl+R or Cmd+R) to see changes

**Note:** You can create custom deploy scripts if needed. The package.json references `deploy.sh` and `dev-deploy.sh` scripts that are not currently in the repository

## Project Structure

```
canvas-roots/
├── main.ts                    # Plugin entry point
├── main.css                   # Base CSS (compiled from styles/)
├── styles.css                 # Final compiled CSS for Obsidian
├── src/
│   ├── settings.ts            # Plugin settings interface
│   ├── core/                  # Core business logic
│   │   ├── canvas-generator.ts      # Canvas JSON generation from positioned nodes ✓
│   │   ├── family-chart-layout.ts   # Family tree layout using family-chart library ✓
│   │   ├── family-graph.ts          # Relationship graph builder ✓
│   │   ├── layout-engine.ts         # Original D3.js layout (deprecated) ✓
│   │   ├── logging.ts               # Structured logging system ✓
│   │   ├── person-note-writer.ts    # Person note creation ✓
│   │   ├── uuid.ts                  # UUID generation ✓
│   │   └── vault-stats.ts           # Vault statistics ✓
│   ├── models/                # TypeScript interfaces
│   │   ├── person.ts             # Person data structures (partial)
│   │   └── canvas.ts             # Canvas JSON types (partial)
│   └── ui/                    # User interface components
│       ├── control-center.ts     # Control Center modal ✓ (skeleton)
│       ├── lucide-icons.ts       # Icon helpers ✓
│       └── person-picker.ts      # Person search modal ✓
├── styles/                    # CSS source files
│   ├── control-center.css     # Control Center styling ✓
│   └── modals.css             # Modal styling
├── docs/                      # Documentation
│   ├── specification.md       # Complete technical spec ✓
│   ├── development.md         # This file
│   ├── css-system.md          # CSS build pipeline
│   └── ...
├── manifest.json              # Obsidian plugin metadata
├── package.json               # NPM configuration
├── tsconfig.json              # TypeScript configuration
├── esbuild.config.mjs         # Build configuration with CSS compilation
└── .eslintrc.json             # ESLint configuration
```

**Legend:**
- ✓ = Implemented
- (partial) = Started but incomplete
- (to be implemented) = Planned but not started

## Component Map

### Core Services (src/core/)

| Component | Status | Purpose |
|-----------|--------|---------|
| `bidirectional-linker.ts` | ✅ Complete | Automatic relationship synchronization with dual storage |
| `canvas-generator.ts` | ✅ Complete | Converts positioned nodes to Canvas JSON format with styling |
| `family-chart-layout.ts` | ✅ Complete | Family tree layout using family-chart library with support for complex relationships |
| `family-graph.ts` | ✅ Complete | Builds relationship graphs from person notes with dual storage support |
| `layout-engine.ts` | 🟡 Deprecated | Original D3.js hierarchy layout (superseded by family-chart-layout.ts) |
| `logging.ts` | ✅ Complete | Structured logging with export capability and persistent log level settings |
| `person-note-writer.ts` | ✅ Complete | Creates person notes with YAML frontmatter |
| `uuid.ts` | ✅ Complete | UUID v4 generation for `cr_id` fields |
| `vault-stats.ts` | ✅ Complete | Calculates vault-wide statistics |
| **To Be Implemented** | | |
| `collection-manager.ts` | 🔴 Needed | Auto-discovers collections, manages trees |

### UI Components (src/ui/)

| Component | Status | Purpose |
|-----------|--------|---------|
| `control-center.ts` | ✅ Complete | Main Control Center modal with Status, Tree Generation, Quick Actions, and Data Entry tabs |
| `person-picker.ts` | ✅ Complete | Person search modal with fuzzy matching |
| `lucide-icons.ts` | ✅ Complete | Lucide icon integration helpers |
| **To Be Implemented** | | |
| `tree-view.ts` | 🔴 Needed | D3 interactive preview view |
| `material-components.ts` | 🔴 Needed | Reusable Material Design components |
| `d3-renderer.ts` | 🔴 Needed | D3 SVG tree rendering |

### Data Models (src/models/)

| Component | Status | Purpose |
|-----------|--------|---------|
| `person.ts` | 🟡 Partial | Person note schema and interfaces |
| `canvas.ts` | 🟡 Partial | Canvas JSON type definitions |
| **To Be Implemented** | | |
| `collection.ts` | 🔴 Needed | Collection and Tree interfaces |
| `layout.ts` | 🔴 Needed | Layout options and results |
| `settings.ts` | 🔴 Needed | Plugin settings types (currently in src/settings.ts) |

### Commands (main.ts)

| Command | Status | Purpose |
|---------|--------|---------|
| Open Control Center | ✅ Complete | Opens main Control Center modal |
| Generate Tree for Current Note | ✅ Complete | Opens Control Center with current person pre-selected in Tree Generation tab |
| Create Person Note | ✅ Complete | Opens Control Center to Data Entry tab for creating new person notes |
| Re-Layout Canvas | 🟡 Partial | Placeholder for recalculating layout (stub implementation) |
| **To Be Implemented** | | |
| Open Tree View | 🔴 Needed | Opens D3 preview for collection/tree |

### Context Menus

| Menu Item | Status | Trigger | Purpose |
|-----------|--------|---------|---------|
| "Generate Family Tree" | ✅ Complete | Right-click on person note | Opens Control Center with person pre-selected as tree root |

### Control Center Tabs

| Tab | Status | Purpose |
|-----|--------|---------|
| Status | ✅ Complete | Displays vault statistics (people, relationships, health metrics) |
| Tree Generation | ✅ Complete | Full tree generation UI with layout options and canvas export |
| Quick Actions | ✅ Complete | Shortcuts to common operations (generate tree, re-layout, create person) |
| Data Entry | ✅ Complete | Person note creation with relationship fields |
| **To Be Implemented** | | |
| Collections | 🔴 Needed | Browse and manage family collections and trees |

### Planned Features (See specification.md)

**MVP (Phase 1):**
- Collection management foundation (auto-discovery, basic codes)
- Layout engine with D3 calculations
- Canvas generation with metadata
- Control Center: Status, Collections, Quick Actions, Data Entry tabs
- Bidirectional link automation

**Phase 2:**
- Tree View with D3 interactive preview
- Reference numbering with collection codes
- Enhanced collection management

**Phase 3:**
- Enhanced Canvas view with dataset browser
- Query-based collections
- GEDCOM import/export with collection codes

See [specification.md](specification.md) for complete feature roadmap.

## Implementation Priority

When contributing or implementing features, follow this order:

1. **Define TypeScript interfaces** (src/models/)
   - Complete collection.ts, layout.ts interfaces
   - Finalize person.ts and canvas.ts types

2. **Collection Management** (src/core/collection-manager.ts)
   - Auto-discovery from folder structure
   - Collection code generation
   - Tree detection (disconnected graphs)

3. **Re-Layout Command** (complete in main.ts)
   - Read existing Canvas JSON
   - Extract nodes and their linked files
   - Use LayoutEngine to recalculate positions
   - Update and write back Canvas JSON

4. **Control Center Tabs**
   - Collections tab (list collections, trees)
   - Status tab (vault statistics) ✅
   - Quick Actions tab (generate, re-layout) ✅
   - Data Entry tab (create person notes) ✅

5. **Tree View** (src/ui/tree-view.ts)
   - D3 SVG rendering
   - Interactive preview
   - Export to Canvas

## Testing in Obsidian

1. Build the plugin: `npm run build`
2. Copy built files to your vault's plugin directory (see Manual Deployment section above)
3. Open Obsidian
4. Go to Settings → Community plugins
5. Enable "Canvas Roots"
6. The plugin commands will be available in the Command Palette (Ctrl/Cmd+P):
   - "Canvas Roots: Open Control Center"
   - "Canvas Roots: Generate Tree for Current Note"
   - "Canvas Roots: Re-Layout Current Canvas"
   - "Canvas Roots: Create Person Note"

### Reloading After Changes

After copying changes to your vault, reload Obsidian:
- **Quick reload**: Press Ctrl+R (Windows/Linux) or Cmd+R (Mac)
- **Full reload**: Settings → Community plugins → Toggle plugin off/on

## Hot Reload (Advanced)

For instant plugin reloading without restarting Obsidian:

1. Install the [Hot Reload](https://github.com/pjeby/hot-reload) plugin
2. It will automatically detect changes to `main.js` in your vault's plugin directory
3. After running `npm run build`, copy the files to your vault
4. Hot Reload will automatically reload the plugin

## Context Menu Implementation

### File Menu Integration

To add a context menu item that appears when right-clicking on person notes:

**Implementation in main.ts:**

```typescript
this.registerEvent(
  this.app.workspace.on('file-menu', (menu, file) => {
    // Only show for person notes (files with cr_id in frontmatter)
    if (file instanceof TFile && file.extension === 'md') {
      // Check if file has cr_id property
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.cr_id) {
        menu.addItem((item) => {
          item
            .setTitle('Generate Family Tree')
            .setIcon('git-fork')
            .onClick(async () => {
              // Open Control Center with this person pre-selected
              const modal = new ControlCenterModal(this.app, this);
              modal.openWithPerson(file);
            });
        });
      }
    }
  })
);
```

**Required ControlCenterModal changes:**

Add `openWithPerson()` method to pre-select person and navigate to Tree Generation tab:

```typescript
public openWithPerson(file: TFile): void {
  this.open();

  // Switch to Tree Generation tab
  this.switchToTab('tree-generation');

  // Pre-populate the root person field
  const cache = this.app.metadataCache.getFileCache(file);
  if (cache?.frontmatter) {
    const crId = cache.frontmatter.cr_id;
    const name = cache.frontmatter.name || file.basename;

    // Set the person picker value
    this.setRootPerson({ crId, name, file });
  }
}
```

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
**Fixed in:** canvas-generator.ts lines 132-141

#### Issue: Canvas cleared on close/reopen
**Cause:** JSON formatting didn't match Obsidian's exact requirements
**Solution:** Implement custom JSON formatter with tabs and compact objects
**Fixed in:** control-center.ts lines 1067-1100

#### Issue: Race condition when opening canvas
**Cause:** Canvas opened before file system write completed
**Solution:** Add 100ms delay before opening canvas file
**Fixed in:** control-center.ts lines 1052-1055

#### Issue: GEDCOM import only shows root person in tree
**Cause:** GEDCOM importer's second pass replaced IDs in wrong fields (father/mother/spouse instead of father_id/mother_id/spouse_id)
**Solution:** Update regex patterns to target correct _id fields with dual storage
**Fixed in:** gedcom-importer.ts lines 208-246 (2025-11-20)

## Design Decisions

### Switch to family-chart Library (2025-11-20)

**Decision:** Replaced the custom D3.js hierarchy layout engine with the family-chart library for calculating family tree positions.

**Rationale:**
- Complex spouse relationships: D3's hierarchy layout doesn't natively support multiple spouses or marriage connections, which are fundamental to genealogy
- Overlapping nodes: The original implementation couldn't handle extended families where siblings-in-law and multiple generations created visual conflicts
- Specialized algorithm: family-chart is purpose-built for genealogical visualization with algorithms designed for family relationships
- Spouse positioning: family-chart automatically places spouses side-by-side at the same generation level
- Maintained separation: Layout calculation remains separate from canvas generation, preserving the clean architecture

**Implementation:**
- Created [src/core/family-chart-layout.ts](../src/core/family-chart-layout.ts) as new layout engine
- Integrated family-chart's `f3.calculateTree()` for position calculation
- Added custom logic to handle "siblings-in-law" (people connected only through marriage) that family-chart excludes
- Implemented smart ancestor selection algorithm to choose optimal tree root for best visual layout
- Updated default spacing settings (400px horizontal, 250px vertical) with 1.5x multiplier for family-chart's algorithm
- Maintained LayoutEngine interface compatibility for future flexibility

**Challenges Solved:**
- Overlapping nodes at generation boundaries (e.g., grandparents hiding behind parents)
- Missing people in output when they're not in direct bloodline (siblings-in-law)
- Inconsistent tree orientation (wrong person at top/y=0)
- Spacing optimization for Canvas name labels

**Technical Details:**
- Uses family-chart's `ancestry_depth: undefined` and `progeny_depth: undefined` to show full family
- Implements manual positioning strategy for missing people (place next to spouse or above children)
- Applies 1.5x spacing multiplier to account for Canvas labels and visual clarity
- Maintains post-processing step to enforce minimum spacing and prevent overlaps

**Impact:**
- Zero overlapping nodes in complex family trees
- Proper handling of multiple spouses, adoptive parents, and extended family
- More accurate genealogical representation
- Better visual clarity with appropriate spacing
- Original layout-engine.ts retained for potential future use or comparison

### Layout Engine Extraction (2025-11-20)

**Decision:** Extracted D3.js layout calculation logic from canvas-generator.ts into a dedicated LayoutEngine class.

**Rationale:**
- Separation of concerns: layout calculation vs. canvas JSON generation are distinct responsibilities
- Reusability: LayoutEngine can be used independently for the re-layout command
- Testability: Layout logic can be tested without canvas generation dependencies
- Clarity: Each module has a single, well-defined purpose

**Implementation:**
- Created [src/core/layout-engine.ts](../src/core/layout-engine.ts) with LayoutEngine class
- Defined LayoutOptions interface for configuration (spacing, direction, tree type)
- Created CanvasGenerationOptions extending LayoutOptions with canvas-specific options (colorByGender, showLabels)
- Refactored CanvasGenerator to use LayoutEngine as a service
- Removed 98 lines of embedded layout logic from canvas-generator.ts

**Impact:**
- Cleaner architecture with better module boundaries
- Layout engine ready for re-layout command implementation
- Easier to maintain and extend layout algorithms
- Canvas generator now focuses purely on JSON format conversion

### Canvas-Only Mode Removal (2025-11-20)

**Decision:** Removed the canvas-only import mode entirely. GEDCOM imports now always create person notes in the vault.

**Rationale:**
- Canvas-only mode provided limited value - users couldn't leverage Obsidian features (backlinks, graph view, manual editing)
- Data was locked in Canvas JSON format, not user-friendly for editing or external tools
- Two code paths created maintenance burden and complexity
- Users who started with canvas-only would need migration tooling later
- Person notes enable richer workflows: adding photos, stories, documents, linking to daily notes

**Impact:**
- Simplified codebase (removed 67 lines)
- Clearer value proposition: plugin manages family relationships using person notes
- Better user experience with full Obsidian integration from the start
- Removed confusing setting from UI

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

## Debugging

### Logging System

The plugin includes a structured logging system with persistent configuration:

**Log Levels:**
- `debug`: Most verbose, shows all operations
- `info`: Important events and state changes
- `warn`: Warnings and non-critical issues
- `error`: Errors and failures
- `off`: Disable logging

**Configuration:**
1. Open Settings → Canvas Roots
2. Navigate to "Logging" section
3. Select desired log level from dropdown
4. Changes apply immediately and persist across Obsidian restarts

**Default Setting:** Debug mode is enabled by default for development visibility.

**Exporting Logs:**
The logging system captures structured log entries that can be exported via the Control Center's Status tab for debugging complex issues.

### Console Logs
Open the Developer Console in Obsidian:
- Windows/Linux: Ctrl+Shift+I
- Mac: Cmd+Option+I

Look for:
- "Loading Canvas Roots plugin" when the plugin loads
- Structured log entries with component names and operation contexts
- Any error messages or stack traces

### TypeScript Errors
The build command includes type checking:
```bash
npm run build
```

This will show any TypeScript errors before building.

## Version Management

When ready to release a new version:

1. Update the version in `package.json`
2. Run the version bump script:
   ```bash
   npm version patch  # or minor, or major
   ```

This will automatically update `manifest.json` and `versions.json`.
