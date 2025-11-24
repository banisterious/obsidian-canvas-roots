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
│   ├── development.md         # This file
│   ├── user-guide.md          # Complete user documentation ✓
│   ├── roadmap.md             # Released and planned features ✓
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
| `compact-layout.ts` | ✅ Complete | 50% tighter spacing layout for large trees (50+ people) |
| `family-chart-layout.ts` | ✅ Complete | Family tree layout using family-chart library with support for complex relationships |
| `family-graph.ts` | ✅ Complete | Builds relationship graphs from person notes with dual storage support |
| `hourglass-layout.ts` | ✅ Complete | Ancestors above, descendants below root person layout |
| `layout-engine.ts` | 🟡 Deprecated | Original D3.js hierarchy layout (superseded by family-chart-layout.ts) |
| `logging.ts` | ✅ Complete | Structured logging with export capability and persistent log level settings |
| `person-note-writer.ts` | ✅ Complete | Creates person notes with YAML frontmatter, includes all essential properties by default |
| `timeline-layout.ts` | ✅ Complete | Chronological positioning by birth year layout |
| `uuid.ts` | ✅ Complete | UUID v4 generation for `cr_id` fields |
| `vault-stats.ts` | ✅ Complete | Calculates vault-wide statistics |
| **To Be Implemented** | | |
| `collection-manager.ts` | 🔴 Needed | Component naming and user collection management (Phase 1/2) |

### UI Components (src/ui/)

| Component | Status | Purpose |
|-----------|--------|---------|
| `control-center.ts` | ✅ Complete | Main Control Center modal with Status, Tree Output, Quick Actions, and Data Entry tabs |
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
| `collection.ts` | 🔴 Needed | FamilyComponent, UserCollection, CollectionConnection interfaces (Phase 1/2) |
| `layout.ts` | 🔴 Needed | Layout options and results |
| `settings.ts` | 🔴 Needed | Plugin settings types (currently in src/settings.ts) |

### Commands (main.ts)

| Command | Status | Purpose |
|---------|--------|---------|
| Open Control Center | ✅ Complete | Opens main Control Center modal |
| Generate Tree for Current Note | ✅ Complete | Opens Control Center with current person pre-selected in Tree Output tab |
| Create Person Note | ✅ Complete | Opens Control Center to Data Entry tab for creating new person notes |
| Re-Layout Current Canvas | ✅ Complete | Recalculates layout for active canvas using current settings and relationship data |
| Generate All Trees | ✅ Complete | Generates separate canvases for each disconnected family component in vault |
| **To Be Implemented** | | |
| Open Tree View | 🔴 Needed | Opens D3 preview for collection/tree |

### Context Menus

| Menu Item | Status | Trigger | Purpose |
|-----------|--------|---------|---------|
| "Generate tree" submenu | ✅ Complete | Right-click on person note | Quick access to Canvas (full options) or Excalidraw (instant) tree generation |
| "Add essential properties" | ✅ Complete | Right-click on markdown file(s) | Bulk-add all 9 essential properties to person notes |
| "Re-layout Family Tree" | ✅ Complete | Right-click on canvas file (file explorer, tab, or three-dot menu) | Recalculates canvas layout using current settings |

### Control Center Tabs

| Tab | Status | Purpose |
|-----|--------|---------|
| Status | ✅ Complete | Displays vault statistics (people, relationships, health metrics) |
| Tree Output | ✅ Complete | Tree generation and export UI with layout algorithm options, Excalidraw export instructions |
| Quick Actions | ✅ Complete | Shortcuts to common operations (generate tree, re-layout, create person) |
| Data Entry | ✅ Complete | Person note creation with relationship fields |
| **To Be Implemented** | | |
| Collections | 🔴 Needed | Collections tab for browsing family components and user collections (Phase 2) |

### Collections Feature Roadmap

> **Architecture:** See [docs/architecture/collections.md](../architecture/collections.md) for complete ADR

**Current Status (v0.1.1):**
- ✅ Detected family components (backend working via `FamilyGraphService.findAllFamilyComponents()`)
- ✅ Multi-family UI in Tree Generation tab (sidebar shows "Family 1", "Family 2", etc.)
- ❌ No component naming support (`group_name` property not implemented)
- ❌ No user collections support (`collection` property not implemented)
- ❌ No Collections tab in Control Center

**Phase 1: Component Naming (v0.2.0-beta) - Planned:**
- Add `group_name` property support to person notes
- Update UI to show custom names instead of "Family 1", "Family 2"
- Implement naming conflict resolution (most common name wins)
- Update family group sidebar to display custom names
- Documentation for users

**Phase 2: User Collections (v0.3.0-beta) - Planned:**
- Add `collection` property support to person notes
- Create Collections tab in Control Center
- UI to filter/browse by user collection
- Collection statistics in Status tab
- Obsidian Bases integration testing
- Cross-collection connection detection
- Update Bases template to include `collection` column

**Phase 3: Advanced Features (v1.x.x) - Future:**
- Cross-collection tree generation
- Collection-level GEDCOM export
- Collection merge/split tools
- Collection-specific node styling
- Reference numbering with collection codes

**Technical Implementation:**
- Detected components = computed from relationship graph (BFS traversal)
- User collections = stored in YAML frontmatter (`collection` property)
- Both systems coexist independently
- Zero configuration required (flat vaults fully supported)

See [docs/architecture/collections.md](architecture/collections.md) for complete collections architecture.

## Implementation Priority

When contributing or implementing features for collections support, follow this order:

### Phase 1: Component Naming (v0.2.0-beta)

1. **Update PersonNode interface** (src/models/person.ts or inline)
   - Add optional `collectionName?: string` field
   - Update `extractPersonNode()` to read `group_name` from frontmatter

2. **Update FamilyGraphService** (src/core/family-graph.ts)
   - Add `findCollectionName()` helper method
   - Update `getFamilyComponents()` to populate `displayName` from `group_name`
   - Implement naming conflict resolution (most common name wins)

3. **Update Tree Generation UI** (src/ui/control-center.ts)
   - Replace hardcoded "Family 1", "Family 2" with `component.displayName`
   - Update sidebar labels to show custom names
   - No other UI changes needed

4. **Documentation**
   - Update user guide with `group_name` property usage
   - Add examples of naming family components

### Phase 2: User Collections (v0.3.0-beta)

1. **Define TypeScript interfaces** (src/models/collection.ts)
   - `FamilyComponent` interface (formalize existing structure)
   - `UserCollection` interface
   - `CollectionConnection` interface

2. **Update PersonNode interface**
   - Add optional `userCollection?: string` field
   - Update `extractPersonNode()` to read `collection` from frontmatter

3. **Implement Collection Service** (src/core/collection-manager.ts)
   - `getUserCollections()`: Find all unique collection values
   - `findCollectionConnections()`: Detect cross-collection relationships
   - `getCollectionStatistics()`: Count people per collection

4. **Create Collections Tab** (src/ui/control-center.ts)
   - List user collections with statistics
   - Show detected family components
   - Display cross-collection connections

5. **Update Tree Generation Tab**
   - Add collection filter dropdown
   - Support filtering by family component OR user collection

6. **Update Bases Template**
   - Add `collection` column to person template

### Phase 3+: Future Features

- Cross-collection tree visualization
- Collection-specific styling
- Reference numbering with collection codes
- Tree View with D3 interactive preview

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

### Smart Hybrid Collections Architecture (2025-11-22)

**Decision:** Implemented dual collection system with detected components (computed) and user collections (stored), rejecting folder-based and tag-based alternatives.

**Rationale:**
- **User diversity:** Many Obsidian users do not use folders or tags and do not wish to
- **Zero configuration:** Plugin must work perfectly for flat vaults with no organization
- **Self-healing data:** Computed component membership prevents stale data
- **Power user flexibility:** Optional user collections provide custom organization
- **World-building support:** Same architecture serves both genealogy and fiction writing use cases

**Architecture:** See [docs/architecture/collections.md](../architecture/collections.md) for complete ADR

**Options Evaluated:**

1. **Option A: Folder-Based Collections** ❌
   - Auto-discover collections from folder structure
   - **Rejected:** Excludes users with flat vaults
   - **Rejected:** Requires reorganizing files to change collections

2. **Option B: Tag-Based Collections** ❌
   - Use tags to assign collection membership
   - **Rejected:** Excludes users who don't use tags
   - **Rejected:** Tags already serve other purposes in genealogy vaults

3. **Option C: Smart Hybrid** ✅ **SELECTED**
   - Detected components computed from relationship graph (BFS traversal)
   - Optional user collections stored in `collection` YAML property
   - Both systems coexist independently

**Implementation:**

**Detected Family Components:**
```typescript
// Computed on every access, never stored
interface FamilyComponent {
  index: number;              // 0, 1, 2... (sorted by size)
  displayName: string;        // From group_name or "Family 1"
  size: number;
  people: PersonNode[];
  representative: PersonNode;
}
```

**User Collections:**
```yaml
# Optional property in person note frontmatter
collection: "Paternal Line"  # or "House Stark", etc.
```

**Key Technical Decisions:**

1. **Component membership = COMPUTED (not stored)**
   - Prevents stale data when relationships change
   - Self-healing (always reflects current relationship graph)
   - Users control membership by editing relationships, not stored IDs

2. **Component naming = STORED (optional)**
   - `group_name` property in person notes
   - Naming conflict resolution: most common name wins
   - Falls back to "Family 1", "Family 2" if no custom names

3. **User collections = STORED (optional)**
   - `collection` property in person notes
   - Independent from detected components
   - Obsidian Bases compatible (editable text field)

4. **Cross-collection connections = COMPUTED**
   - Detected by scanning relationships
   - Self-healing (updates when relationships change)
   - Enables world-building use cases (political alliances between houses)

**Implementation Phases:**

- **Phase 1 (v0.2.0-beta):** Component naming with `group_name` property
- **Phase 2 (v0.3.0-beta):** User collections with `collection` property and Collections tab
- **Phase 3 (v1.x.x):** Advanced features (cross-collection trees, collection-specific styling)

**Impact:**
- Works for 100% of users (no folder/tag requirements)
- Zero configuration needed (detected components work immediately)
- Power users get optional custom organization
- Supports both genealogy and world-building use cases
- Obsidian Bases compatible for bulk collection assignment
- Self-healing architecture prevents data staleness

**Architecture:** See [docs/architecture/collections.md](architecture/collections.md) for complete implementation details

---

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

## Recent Features

### Re-Layout Canvas Command (2025-11-21)

**Added:** Complete re-layout functionality for existing family tree canvases.

**Implemented Features:**

1. **Command Integration:**
   - Command Palette: "Re-layout current canvas"
   - Right-click menu on canvas files (file explorer, tab bar, three-dot menu)
   - Uses current plugin settings for spacing and node dimensions

2. **Smart Re-Layout Logic:**
   - Reads existing canvas JSON structure
   - Extracts person notes and relationships
   - Rebuilds family tree from current vault data
   - Recalculates positions using family-chart layout engine
   - Preserves Obsidian's exact JSON formatting

3. **Non-Destructive Updates:**
   - Updates canvas in-place (same file, same location)
   - Uses current relationship data from person notes
   - Applies current spacing/sizing settings
   - Shows success notification with person count

**Use Cases:**
- Update tree after editing relationships in person notes
- Apply new spacing settings to existing canvases
- Fix layout after data corrections
- Standardize multiple trees with consistent settings
- Refresh trees created with older layout algorithms
- Test different layout configurations

**Files Modified:**
- `main.ts` - Added `relayoutCanvas()` method (lines 165-310)
- `main.ts` - Added `formatCanvasJson()` helper (lines 321-358)
- `main.ts` - Added file-menu context integration
- `main.ts` - Added command registration
- `src/ui/relayout-options-modal.ts` - Modal for re-layout direction selection

**Technical Details:**
- Uses full tree generation (`treeType: 'full'`) to include all people in canvas
- Detects root person automatically (first person note with cr_id)
- Applies 100ms delay when opening canvas before re-layout
- Formats JSON with tabs and compact objects to match Obsidian format
- Comprehensive error handling with user-friendly notices

### Canvas Metadata & Smart Re-layout (2025-11-22)

**Added:** Embedded generation metadata in canvas files to enable intelligent re-layout with preserved settings.

**Implemented Features:**

1. **Canvas Generation Metadata:**
   - Stores complete generation parameters in canvas frontmatter
   - Metadata includes: root person (cr_id and name), tree type, max generations, spouse inclusion, layout direction, timestamp
   - Layout settings preserved: node dimensions, horizontal/vertical spacing
   - Metadata format compatible with Obsidian Canvas JSON specification

2. **Smart Re-Layout with Settings Preservation:**
   - Re-layout modal reads original generation settings from canvas metadata
   - Displays original settings to user: "Originally generated as 'full' tree from Thomas Wilson with direction: vertical"
   - Preserves all original settings (tree type, generations, spouses) when re-layouting
   - Only allows changing layout direction (vertical ↔ horizontal)
   - Maintains generation timestamp for tracking

3. **Metadata Infrastructure:**
   - `CanvasRootsMetadata` interface in canvas-generator.ts defines metadata schema
   - Metadata embedded in canvas JSON at generation time (both Control Center and Generate All Trees)
   - `formatCanvasJson()` methods properly serialize metadata to frontmatter
   - Re-layout reads metadata and passes to canvas generator to preserve settings

**Files Modified:**
- `src/core/canvas-generator.ts` - Added `CanvasRootsMetadata` interface, metadata logging, metadata embedding in canvas output
- `src/ui/control-center.ts` - Added metadata to `handleTreeGeneration()` and `openAndGenerateAllTrees()`, fixed `formatCanvasJson()` to serialize frontmatter
- `main.ts` - Updated `relayoutCanvas()` to read and use stored metadata, fixed `formatCanvasJson()` to serialize frontmatter
- `src/ui/relayout-options-modal.ts` - Enhanced modal to read and display original generation settings from metadata

**Technical Details:**
- Metadata stored in standard Obsidian Canvas `metadata.frontmatter` field as `Record<string, unknown>`
- TypeScript literal types (`as const`) ensure type safety for fixed values like 'canvas-roots', 'full', 'vertical'
- Uses plugin's structured logging system (`getLogger('CanvasGenerator')`) instead of console.log
- Metadata passed through generation pipeline via `canvasRootsMetadata` option parameter
- JSON serialization via `JSON.stringify()` for nested metadata object

**Use Cases:**
- Preserve complex tree configurations when switching between vertical/horizontal layouts
- Track when and how each canvas was generated for audit trail
- Enable future "regenerate with same settings" functionality
- Support canvas versioning and migration in future updates

### Tree Generation Tab Streamlining (2025-11-21)

**Enhanced:** Redesigned Tree Generation tab with inline person browser for improved UX.

**Major Changes:**
- **Removed Modal Dependency:** Eliminated PersonPickerModal from Tree Generation workflow
- **Inline Person Browser:** Integrated complete person selection directly into Root Person card
- **Single-Card Interface:** Consolidated all tree generation actions into one streamlined card
- **Improved Prominence:** Moved generate buttons into Root Person card for better visibility

**Implemented Features:**

1. **Inline Person Browser in Root Person Card:**
   - Real-time search filtering by person name
   - 5 sort options (Name A-Z/Z-A, Birth year ascending/descending, Recently modified)
   - 3 filter categories (Living status, Birth date presence, Sex)
   - Family group sidebar for multi-family vaults (shows disconnected components)
   - Constrained height (400px max) with scrollable results
   - Async loading of all person notes and family components

2. **Integrated Generation Actions:**
   - Canvas name input field (optional)
   - Large, prominent "Generate family tree" button
   - "Generate all trees" option with dynamic family group count
   - Visual "OR" separator for clarity
   - Both generation options in same card - no scrolling required

3. **Multi-Family Detection:**
   - Uses BFS graph traversal via FamilyGraphService
   - Automatically detects disconnected family components
   - Dynamic message shows actual count: "Found 6 disconnected family groups"
   - "Generate all trees" auto-selects one representative per component

**Layout Before:**
- Root person field in Configuration card (modal picker)
- Configuration card (tree type, generations, spouses)
- Layout card (direction, spacing)
- Output card at bottom (canvas name, generate button) - easy to miss

**Layout After:**
- Root Person card (person display, inline browser, canvas name, both generate buttons)
- Tree Configuration card (tree type, generations, spouses)
- Layout Options card (direction, spacing)

**Files Modified:**
- `src/ui/control-center.ts`:
  - Made `showTreeGenerationTab()` async (line 1018)
  - Created `createRootPersonCard()` method (lines 2146-2545) with inline browser
  - Created `updateRootPersonDisplay()` helper (lines 2547-2567)
  - Created `extractPersonInfoFromFile()` helper (lines 2575-2587)
  - Added class properties: `treeCanvasNameInput`, `treeGenerateBtn`
  - Removed Output card, integrated actions into Root Person card
- `styles/modals.css`:
  - Added `.crc-root-person-display` styles (lines 290-346)
  - Added `.crc-person-browser` styles (lines 348-394)
  - Added `.crc-root-person-generate` styles (lines 396-409)
  - Added `.crc-separator` with "OR" visual styling (lines 411-438)
  - Added `.crc-btn--large` for prominent full-width buttons (lines 490-495)

**Documentation Updated:**
- `README.md` - Updated workflow instructions for new streamlined process

**UX Benefits:**
- No modal switching required - entire workflow in one view
- Primary action impossible to miss (large button at top)
- Clear distinction between single-tree and multi-tree workflows
- Faster person selection with inline filtering
- Better understanding of vault structure via family group detection

### Person Picker Enhancements (2025-11-20)

**Added:** Sorting and filtering capabilities for person selection modal.

**Note:** PersonPickerModal is now primarily used in the Data Entry tab. The Tree Generation tab uses an inline person browser implementation (see Tree Generation Tab Streamlining above).

**Implemented Features:**
- **5 Sort Options:**
  - Name (A-Z / Z-A)
  - Birth year (oldest first / youngest first)
  - Recently modified
- **3 Filter Categories:**
  - Living status (all / living / deceased)
  - Birth date presence (all / has date / missing date)
  - Sex (all / M / F)

**Smart Date Parsing:**
- Extracts year from various date formats for chronological sorting
- Handles people without birth dates gracefully (sorted to end)

**Files Modified:**
- `src/ui/person-picker.ts` - Added sort/filter logic
- `styles/modals.css` - Filter controls styling

### Recent Trees History (2025-11-20)

**Added:** "Recently generated trees" card in Control Center Status tab.

**Implemented Features:**
- **Automatic Tree Tracking:**
  - Saves metadata for each generated tree
  - Tracks: canvas name, path, people count, edge count, root person, timestamp
  - Stores last 10 trees in plugin settings
- **Status Tab Display:**
  - Clickable tree names that open the canvas
  - Shows root person and generation stats
  - Relative timestamps ("2 hours ago", "just now")
- **Automatic Cleanup:**
  - Filters out deleted canvas files when rendering
  - Updates settings to remove dead entries
  - Keeps settings tidy automatically

**Files Modified:**
- `src/settings.ts` - Added `RecentTreeInfo` interface and `recentTrees` array
- `src/ui/control-center.ts` - Save tree info on generation, display in Status tab
- `styles/modals.css` - Recent trees card styling

### Person Count Notification (2025-11-20)

**Added:** Display people count in tree generation success notification.

**Implementation:**
- Success message now shows: "Family tree generated successfully! (163 people)"
- Provides immediate feedback about tree size
- Modified: `src/ui/control-center.ts` line 1141

### CSS Linting Configuration (2025-11-20)

**Fixed:** Pre-existing CSS linting errors by properly handling Obsidian built-in variables.

**Changes:**
- Added override for `modals.css` to allow Obsidian CSS variables (--text-normal, --background-primary, etc.)
- Removed unused "md-" prefix from custom property pattern
- Modified: `.stylelintrc.json`

### GEDCOM Test Datasets (2025-11-20)

**Created:** Progressive test files for scale testing the layout engine.

**Test Files:**
- **gedcom-sample-small.ged:** 27 people, 4 generations (baseline scale test)
- **gedcom-sample-medium.ged:** 60 people, 5 generations (medium complexity)
- **gedcom-sample-large.ged:** 163 people, 6 generations (realistic genealogy)
- **gedcom-sample-xlarge.ged:** 599 people, 7 generations (extreme stress test)

**Documentation:**
- `gedcom-testing/TESTING.md` - Comprehensive testing guide with success criteria
- Includes methodology, metrics to track, and expected challenges
- **Note:** All individuals in test files are entirely fictional

### Canvas Color Enhancements (2025-11-20)

**Enhanced:** Gender-based node coloring using all 6 available Canvas colors.

**Implemented Features:**
- **Gender Detection:** Reads `sex` or `gender` field from YAML frontmatter
  - Male (M/MALE): Canvas color 4 (Green)
  - Female (F/FEMALE): Canvas color 6 (Purple)
  - Unknown/Neutral: Canvas color 2 (Orange)
- **GEDCOM Compatibility:** Supports standard GEDCOM SEX tag values (M, F, U)
- **Fallback Support:** Legacy name-based detection (Mr., Mrs., etc.) still works
- **Enhanced Edge Colors:**
  - Parent-child relationships: Canvas color 1 (Red)
  - Spouse relationships: Canvas color 5 (Blue)
  - Default edges: Canvas color 3 (Yellow)

**Technical Details:**
- Added `sex` field to `PersonNode` interface
- Updated `extractPersonNode()` to extract sex/gender from frontmatter
- Enhanced `getPersonColor()` to prioritize frontmatter over name heuristics
- Updated `getEdgeColor()` to use more distinctive colors
- All 6 Obsidian Canvas colors now utilized for visual clarity

**Files Modified:**
- `src/core/family-graph.ts` - Added sex field to PersonNode interface and extraction
- `src/core/canvas-generator.ts` - Enhanced color assignment logic

**Benefits:**
- More accurate gender representation using GEDCOM-standard data
- Better visual differentiation using full color palette
- Maintains compatibility with existing vaults (graceful degradation)
- Prepares foundation for future customizable color schemes

### Privacy and Gender Identity Protection (2025-11-20)

**Enhanced:** Data model to support inclusive gender identity and privacy protection.

**Implemented Features:**
- **Gender vs Sex Separation:**
  - `sex`: GEDCOM-compatible biological sex field (M/F/U) for data interchange
  - `gender`: Free-form gender identity field (e.g., "Woman", "Non-binary", "Transgender man")
  - `pronouns`: Optional preferred pronouns (e.g., "she/her", "they/them", "he/him")
- **Deadname Protection:**
  - `name` field always represents current, chosen name
  - `_previous_names` array for historical names (underscore = private/sensitive)
  - Plugin will never display underscore-prefixed fields in UI or search
  - Export warnings when private fields are included
- **Privacy Field Convention:**
  - Any field with underscore prefix (`_`) is private/sensitive
  - Excluded from person picker, search results, canvas labels
  - Requires explicit confirmation for exports
  - Examples: `_previous_names`, `_medical_notes`, `_adoption_details`
- **Inclusive Language:**
  - All documentation and UI uses respectful, inclusive language
  - Designed to serve all users regardless of gender identity or family structure

**Files Modified:**
- `docs/development.md` - This documentation

**Rationale:**
- Respects transgender and non-binary individuals' dignity
- Separates GEDCOM biological data from personal identity
- Protects sensitive historical information
- Aligns with LGBTQIA+ ally values and inclusive design principles

**Future Enhancements:**
- User preference settings for color coding (by sex, gender, or disabled)
- Privacy mode for exports (strip all underscore-prefixed fields)
- Pronoun support in custom reports and documentation generation

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
