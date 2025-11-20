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

## Deployment to Obsidian Vault

### Quick Deploy
Deploy the built plugin to your Obsidian vault:

```bash
npm run deploy
```

This will:
1. Build the plugin (`npm run build`)
2. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugin directory
3. You'll need to reload Obsidian to see changes (Ctrl+R or Cmd+R)

### Development with Auto-Deploy
For active development with automatic deployment on file changes:

```bash
npm run dev:deploy
```

**Note:** This requires `inotify-tools` to be installed:
```bash
sudo apt-get install inotify-tools
```

The script will:
- Watch for TypeScript file changes
- Automatically rebuild
- Auto-deploy to vault
- Show build status and timestamp

### Vault Path Configuration

The deployment scripts target:
```
/mnt/d/Vaults/Banister/.obsidian/plugins/canvas-roots
```

To change this, edit the `VAULT_PATH` variable in:
- [deploy.sh](../deploy.sh)
- [dev-deploy.sh](../dev-deploy.sh)

## Project Structure

```
canvas-roots/
├── main.ts                    # Plugin entry point
├── main.css                   # Base CSS (compiled from styles/)
├── styles.css                 # Final compiled CSS for Obsidian
├── src/
│   ├── settings.ts            # Plugin settings interface
│   ├── core/                  # Core business logic
│   │   ├── canvas-generator.ts   # Canvas file generation (partial)
│   │   ├── family-graph.ts       # Relationship graph builder (partial)
│   │   ├── logging.ts            # Structured logging system ✓
│   │   ├── person-note-writer.ts # Person note creation ✓
│   │   ├── uuid.ts               # UUID generation ✓
│   │   └── vault-stats.ts        # Vault statistics ✓
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
| `canvas-generator.ts` | ✅ Complete | Writes family trees to `.canvas` files with metadata |
| `family-graph.ts` | 🟡 Partial | Builds relationship graphs from person notes |
| `logging.ts` | ✅ Complete | Structured logging with export capability |
| `person-note-writer.ts` | ✅ Complete | Creates person notes with YAML frontmatter |
| `uuid.ts` | ✅ Complete | UUID v4 generation for `cr_id` fields |
| `vault-stats.ts` | ✅ Complete | Calculates vault-wide statistics |
| **To Be Implemented** | | |
| `collection-manager.ts` | 🔴 Needed | Auto-discovers collections, manages trees |
| `layout-engine.ts` | 🔴 Needed | D3 layout calculations (currently in canvas-generator) |
| `bidirectional-linker.ts` | 🔴 Needed | Automatic relationship synchronization |

### UI Components (src/ui/)

| Component | Status | Purpose |
|-----------|--------|---------|
| `control-center.ts` | 🟡 Partial | Main Control Center modal (skeleton complete) |
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
| Export Logs | ✅ Complete | Exports structured logs to JSON |
| **To Be Implemented** | | |
| Generate Tree to Canvas | 🔴 Needed | Generates family tree to Canvas file |
| Re-Layout Canvas | 🔴 Needed | Recalculates layout for existing Canvas |
| Open Tree View | 🔴 Needed | Opens D3 preview for collection/tree |
| Create Person Note | 🔴 Needed | Quick person note creation |

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

3. **Layout Engine** (src/core/layout-engine.ts)
   - Extract D3 logic from canvas-generator
   - Implement tree layout algorithms
   - Support multiple layout options

4. **Canvas Generation** (complete src/core/canvas-generator.ts)
   - Write Canvas JSON with metadata
   - Support collection/tree context
   - Re-layout existing Canvas files

5. **Control Center Tabs**
   - Collections tab (list collections, trees)
   - Status tab (vault statistics)
   - Quick Actions tab (generate, re-layout)
   - Data Entry tab (create person notes)

6. **Tree View** (src/ui/tree-view.ts)
   - D3 SVG rendering
   - Interactive preview
   - Export to Canvas

## Testing in Obsidian

1. Build and deploy the plugin: `npm run deploy`
2. Open Obsidian
3. Go to Settings → Community plugins
4. Enable "Canvas Roots"
5. The plugin commands will be available in the Command Palette (Ctrl/Cmd+P):
   - "Canvas Roots: Generate Tree for Current Note"
   - "Canvas Roots: Re-Layout Current Canvas"

### Reloading After Changes

After deploying changes, reload Obsidian:
- **Quick reload**: Press Ctrl+R (Windows/Linux) or Cmd+R (Mac)
- **Full reload**: Settings → Community plugins → Toggle plugin off/on

## Hot Reload (Advanced)

For instant plugin reloading without restarting Obsidian:

1. Install the [Hot Reload](https://github.com/pjeby/hot-reload) plugin
2. It will automatically detect changes to `main.js` in your vault's plugin directory
3. Use `npm run dev:deploy` to build and deploy on file changes
4. Hot Reload will automatically reload the plugin

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

## Debugging

### Console Logs
Open the Developer Console in Obsidian:
- Windows/Linux: Ctrl+Shift+I
- Mac: Cmd+Option+I

Look for:
- "Loading Canvas Roots plugin" when the plugin loads
- Any error messages or console logs

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
