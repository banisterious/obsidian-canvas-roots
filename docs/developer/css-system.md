# CSS Build System

## Overview

Charted Roots uses a component-based CSS build system that automatically concatenates, lints, and formats CSS files from the `styles/` directory into a single `styles.css` file for Obsidian.

## Directory Structure

```
styles/
├── variables.css      # CSS custom properties and design tokens
├── base.css          # Base structural elements
├── layout.css        # Layout utilities
├── canvas.css        # Canvas-specific styling
├── nodes.css         # Family tree node styling
├── edges.css         # Relationship edge styling
├── settings.css      # Settings interface
├── modals.css        # Modal dialogs
├── animations.css    # Keyframes and transitions
├── responsive.css    # Responsive breakpoints
└── theme.css         # Theme compatibility
```

## Available Commands

### Building CSS

```bash
# Full build with linting and formatting
npm run build:css

# Build only (skip linting)
npm run build:css -- --build-only

# Watch mode for development
npm run build:css:watch
```

### Linting CSS

```bash
# Lint CSS files
npm run lint:css

# Lint and auto-fix
npm run lint:css:fix
```

### Formatting CSS

```bash
# Format CSS files with Prettier
npm run format:css
```

## Build Process

The CSS build system follows this pipeline:

1. **Format** - Prettier formats all component files
2. **Lint** - Stylelint checks for errors and enforces rules
3. **Build** - Components are concatenated in dependency order
4. **Output** - Final `styles.css` is generated with build metadata

## Component Order

Components are concatenated in a specific order to ensure proper CSS cascade:

1. Variables (CSS custom properties)
2. Base styles
3. Layout utilities
4. Feature-specific components
5. Animations
6. Responsive styles
7. Theme compatibility (last)

## CSS Naming Conventions

### Class Names

Use BEM-style naming with `cr-` or `canvas-roots-` prefix:

```css
/* Block */
.cr-person-node { }

/* Block with element */
.cr-person-node__name { }

/* Block with modifier */
.cr-person-node--highlighted { }
```

### Custom Properties

Use `--cr-` prefix for Charted Roots variables:

```css
:root {
  --cr-spacing-md: 16px;
  --cr-node-width: 200px;
  --cr-primary: var(--interactive-accent);
}
```

Obsidian's variables (prefixed with `--`) can be used directly for theme compatibility.

## Stylelint Configuration

The project uses Stylelint with these configurations:

- `stylelint-config-standard` - Standard CSS rules
- `stylelint-config-prettier` - Prettier compatibility

### Key Rules

- **Class Pattern**: `^(cr|canvas-roots)-[a-z0-9-]+(__[a-z0-9-]+)?(--[a-z0-9-]+)?$`
- **Custom Property Pattern**: `^(md|cr)-[a-z0-9-]+$`
- **Max Nesting Depth**: 3 levels
- **String Quotes**: Double quotes
- **Color Hex**: Short notation, lowercase

### Rule Overrides

Some files have relaxed rules:

- `variables.css` - No custom property pattern enforcement
- `theme.css` - No class pattern enforcement (allows `.theme-light`, `.theme-dark`)

## Adding New Components

To add a new CSS component:

1. **Create the file** in `styles/` directory:
   ```bash
   touch styles/my-component.css
   ```

2. **Add to build order** in `build-css.js`:
   ```javascript
   componentOrder: [
     // ... existing components
     'my-component.css',  // Add here in correct order
     // ... remaining components
   ]
   ```

3. **Write your CSS** following naming conventions

4. **Build** to generate updated `styles.css`:
   ```bash
   npm run build:css
   ```

## Development Workflow

### Watch Mode

For active development, use watch mode:

```bash
npm run build:css:watch
```

This will:
- Watch for changes in `styles/` directory
- Automatically rebuild on file changes
- Show build status and errors in real-time

### Testing Styles

1. Build CSS: `npm run build:css`
2. Deploy to vault: `npm run deploy`
3. Reload Obsidian (Ctrl/Cmd + R)

## Integration with Main Build

The CSS build is automatically integrated into the main build process:

```bash
npm run build
```

This runs:
1. TypeScript compilation
2. JavaScript bundling (esbuild)
3. CSS building (with `--no-fail-on-lint` flag)

The `--no-fail-on-lint` flag allows the build to continue even if there are CSS linting warnings, but errors will still stop the build.

## Theme Compatibility

### Using Obsidian Variables

Always prefer Obsidian's CSS variables for colors and common properties:

```css
.cr-my-element {
  color: var(--text-normal);           /* Text color */
  background: var(--background-primary); /* Background */
  border-color: var(--background-modifier-border); /* Borders */
}
```

### Light and Dark Themes

Use theme-specific overrides in `theme.css`:

```css
.theme-light {
  /* Light theme specific overrides */
}

.theme-dark {
  /* Dark theme specific overrides */
}
```

## Troubleshooting

### Build Fails at Linting Stage

Check the error output for specific CSS issues:

```bash
npm run lint:css
```

Auto-fix common issues:

```bash
npm run lint:css:fix
```

### Orphaned Files Warning

If you see warnings about orphaned CSS files, either:
- Add them to `componentOrder` in `build-css.js`
- Or add them to `excludedFiles` if they shouldn't be included

### Component Not Included

Verify the component is:
1. In the `styles/` directory
2. Listed in `componentOrder` array
3. Has a `.css` extension

## Performance

The CSS build is fast:
- Typical build time: <100ms
- Full pipeline (format + lint + build): <1 second
- Watch mode rebuild: Near-instant

## References

- [Stylelint Documentation](https://stylelint.io/)
- [Prettier Documentation](https://prettier.io/)
- [Obsidian CSS Variables](https://docs.obsidian.md/Reference/CSS+variables/)
