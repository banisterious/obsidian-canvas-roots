# Getting Started with Development

This guide covers setting up your development environment, building, and testing the Canvas Roots plugin.

## Table of Contents

- [Project Setup](#project-setup)
- [Manual Deployment to Obsidian Vault](#manual-deployment-to-obsidian-vault)
- [Testing in Obsidian](#testing-in-obsidian)
- [Hot Reload (Advanced)](#hot-reload-advanced)
- [Debugging](#debugging)
- [Version Management](#version-management)
- [Related Documentation](#related-documentation)

---

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

See [Coding Standards](coding-standards.md) for detailed style guidelines.

---

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

**Note:** You can create custom deploy scripts if needed. The package.json references `deploy.sh` and `dev-deploy.sh` scripts that are not currently in the repository.

---

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

---

## Hot Reload (Advanced)

For instant plugin reloading without restarting Obsidian:

1. Install the [Hot Reload](https://github.com/pjeby/hot-reload) plugin
2. It will automatically detect changes to `main.js` in your vault's plugin directory
3. After running `npm run build`, copy the files to your vault
4. Hot Reload will automatically reload the plugin

---

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

---

## Version Management

When ready to release a new version:

1. Update the version in `package.json`
2. Run the version bump script:
   ```bash
   npm version patch  # or minor, or major
   ```

This will automatically update `manifest.json` and `versions.json`.

---

## Related Documentation

- [Coding Standards](coding-standards.md) - TypeScript and CSS style guidelines
- [Project Structure](project-structure.md) - Directory layout and component map
- [Implementation Details](implementation-details.md) - Technical implementation notes
- [Design Decisions](design-decisions.md) - Architecture decision records
