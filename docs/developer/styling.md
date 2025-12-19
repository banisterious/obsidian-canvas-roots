# Styling and CSS

This document covers the Canvas Roots CSS architecture, build system, and customization options.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Build System](#build-system)
  - [Build Commands](#build-commands)
  - [Component Order](#component-order)
  - [Adding New Components](#adding-new-components)
- [Design Tokens](#design-tokens)
  - [Spacing](#spacing)
  - [Colors](#colors)
  - [Transitions](#transitions)
- [Style Settings Integration](#style-settings-integration)
- [Component Files](#component-files)
- [Theme Compatibility](#theme-compatibility)
- [Development Workflow](#development-workflow)

---

## Architecture Overview

Canvas Roots uses a modular CSS architecture with component files that are concatenated into a single `styles.css` for Obsidian.

```
canvas-roots/
├── styles/                    # Component CSS files (36 files)
│   ├── variables.css          # CSS custom properties
│   ├── style-settings.css     # Style Settings plugin config
│   ├── base.css               # Base structural elements
│   ├── modals.css             # Modal dialogs (~120KB)
│   ├── map-view.css           # Leaflet map styling (~40KB)
│   ├── sources.css            # Sources tab (~55KB)
│   └── ...                    # Other component files
├── styles.css                 # Generated output (DO NOT EDIT)
└── build-css.js               # Node.js build script
```

**Key principles:**
- Component files are self-contained
- Use CSS custom properties for theming
- Reference Obsidian's built-in variables for theme compatibility
- Prefix custom properties with `--cr-` namespace

---

## Build System

The CSS build system is a Node.js script (`build-css.js`) that:
1. Formats CSS with Prettier
2. Lints CSS with Stylelint
3. Concatenates component files in dependency order
4. Generates `styles.css` with metadata headers

### Build Commands

```bash
# Full build (format + lint + build)
npm run build:css

# Build only (skip format/lint)
npm run build:css -- --build-only

# Watch mode for development
npm run build:css -- --watch

# Lint only
npm run build:css -- --lint

# Format only
npm run build:css -- --format
```

### Component Order

Components are concatenated in a specific order to handle dependencies:

```javascript
componentOrder: [
  'variables.css',           // 1. CSS custom properties
  'style-settings.css',      // 2. Style Settings plugin config
  'base.css',                // 3. Base structural elements
  'layout.css',              // 4. Layout utilities
  'canvas.css',              // 5. Canvas-specific styling
  'nodes.css',               // 6. Family tree node styling
  'edges.css',               // 7. Relationship edge styling
  'settings.css',            // 8. Settings interface
  'modals.css',              // 9. Modal dialogs
  // ... additional components
  'animations.css',          // Animation keyframes
  'responsive.css',          // Responsive breakpoints
  'theme.css'                // Theme compatibility (last)
]
```

### Adding New Components

1. Create the component file in `styles/`:
   ```css
   /* styles/my-component.css */
   .cr-my-component {
     /* styles */
   }
   ```

2. Add to `componentOrder` in `build-css.js`:
   ```javascript
   componentOrder: [
     // ... existing components
     'my-component.css',
     // ... remaining components
   ]
   ```

3. Rebuild:
   ```bash
   npm run build:css
   ```

**Orphan detection:** The build system warns about CSS files not in the component order.

---

## Design Tokens

Design tokens are defined in `styles/variables.css` and prefixed with `--cr-`.

### Spacing

```css
:root {
  --cr-spacing-xs: 4px;
  --cr-spacing-sm: 8px;
  --cr-spacing-md: 16px;
  --cr-spacing-lg: 24px;
  --cr-spacing-xl: 32px;
}
```

### Colors

Colors reference Obsidian's CSS variables for automatic theme compatibility:

```css
:root {
  /* Core colors - inherit from Obsidian */
  --cr-primary: var(--interactive-accent);
  --cr-bg: var(--background-primary);
  --cr-text: var(--text-normal);
  --cr-border: var(--background-modifier-border);

  /* Family Chart colors - customizable via Style Settings */
  --cr-fcv-female-color: rgb(196, 138, 146);
  --cr-fcv-male-color: rgb(120, 159, 172);
  --cr-fcv-unknown-color: rgb(211, 211, 211);

  /* Evidence colors - customizable via Style Settings */
  --cr-source-primary: #22c55e;
  --cr-source-secondary: #f59e0b;
  --cr-source-derivative: #ef4444;
}
```

### Transitions

```css
:root {
  --cr-transition-fast: 150ms ease;
  --cr-transition-normal: 250ms ease;
  --cr-transition-slow: 350ms ease;
}
```

---

## Style Settings Integration

Canvas Roots integrates with the [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin for user customization.

Configuration is defined in `styles/style-settings.css`:

```css
/* @settings

name: Canvas Roots
id: canvas-roots
settings:
  -
    id: family-chart-heading
    title: Family Chart View
    type: heading
    level: 1
    collapsed: true
  -
    id: cr-fcv-female-color
    title: Female card color
    type: variable-color
    format: rgb
    default: "rgb(196, 138, 146)"
  ...
*/
```

**Customizable settings:**

| Category | Settings |
|----------|----------|
| Family Chart View | Female/male/unknown card colors, background colors, text colors |
| Evidence Visualization | Primary/secondary/derivative source colors, coverage level colors |

Users with Style Settings installed can customize these values in Settings → Style Settings → Canvas Roots.

---

## Component Files

| Component | Purpose | Size |
|-----------|---------|------|
| `variables.css` | CSS custom properties and design tokens | 1 KB |
| `style-settings.css` | Style Settings plugin configuration | 6 KB |
| `base.css` | Base structural elements | 1 KB |
| `modals.css` | Modal dialogs (Control Center, pickers, wizards) | 120 KB |
| `map-view.css` | Leaflet map view (includes bundled Leaflet CSS) | 40 KB |
| `sources.css` | Sources tab, media gallery, citations | 55 KB |
| `statistics.css` | Statistics tab and workspace view | 30 KB |
| `data-quality.css` | Data quality analysis tab | 28 KB |
| `events.css` | Events tab, timeline components | 28 KB |
| `family-chart-view.css` | Interactive family chart | 24 KB |
| `canvas-navigation.css` | Canvas navigation and split wizard | 15 KB |
| `universe-wizard.css` | Universe setup wizard | 11 KB |
| `timeline-callouts.css` | Timeline callout styles for markdown export | 11 KB |
| `relationships.css` | Relationships tab | 10 KB |
| `tree-output.css` | Tree output two-panel layout | 9 KB |
| `leaflet-distortable.css` | Leaflet toolbar plugins (vendored) | 8 KB |
| `date-systems.css` | Date systems card | 5 KB |
| `relationship-calculator.css` | Relationship calculator modal | 5 KB |
| `preferences.css` | Preferences tab | 5 KB |
| `organizations.css` | Organizations tab | 4 KB |
| `dynamic-content.css` | Dynamic content blocks | 4 KB |
| `settings.css` | Plugin settings tab | 4 KB |
| `duplicate-detection.css` | Duplicate detection modal | 3 KB |
| `folder-scan.css` | Folder scan modal | 3 KB |
| `find-on-canvas.css` | Find on canvas modal | 2 KB |
| `validation.css` | Validation results modal | 2 KB |

---

## Theme Compatibility

Canvas Roots maintains compatibility with Obsidian themes by:

1. **Using Obsidian CSS variables:**
   ```css
   .cr-component {
     background: var(--background-primary);
     color: var(--text-normal);
     border: 1px solid var(--background-modifier-border);
   }
   ```

2. **Respecting theme mode:**
   ```css
   .theme-light .cr-family-chart {
     background: var(--cr-fcv-background-light);
     color: var(--cr-fcv-text-light);
   }

   .theme-dark .cr-family-chart {
     background: var(--cr-fcv-background-dark);
     color: var(--cr-fcv-text-dark);
   }
   ```

3. **Avoiding hardcoded colors** - except for semantic colors (success/warning/error) that should remain consistent across themes.

**Common Obsidian CSS variables:**

| Variable | Purpose |
|----------|---------|
| `--background-primary` | Main background color |
| `--background-secondary` | Secondary/alt background |
| `--background-modifier-border` | Border color |
| `--text-normal` | Normal text color |
| `--text-muted` | Muted/secondary text |
| `--text-faint` | Faint text (disabled, etc.) |
| `--interactive-accent` | Accent/primary color |
| `--interactive-accent-hover` | Accent hover state |

---

## Development Workflow

### Initial Setup

```bash
# Install dependencies
npm install

# Build CSS
npm run build:css
```

### Development

1. Start watch mode:
   ```bash
   npm run build:css -- --watch
   ```

2. Edit component files in `styles/`

3. Changes automatically rebuild `styles.css`

4. Reload Obsidian to see changes (or use Hot Reload plugin)

### Before Committing

1. Run full build to format and lint:
   ```bash
   npm run build:css
   ```

2. Fix any linting errors

3. Commit both component files and generated `styles.css`

### CSS Conventions

**Class naming:**
- Prefix all classes with `cr-` (Canvas Roots)
- Use BEM-like naming: `.cr-component__element--modifier`

**Selector specificity:**
- Keep specificity low where possible
- Use `:where()` for opt-out overrides
- Avoid `!important` except for Style Settings variables

**Organization within components:**
- Group related rules together
- Comment sections for clarity
- Place responsive styles at the end

```css
/* Component: Example Card */
.cr-example-card {
  /* Layout */
  display: flex;
  flex-direction: column;

  /* Sizing */
  padding: var(--cr-spacing-md);

  /* Appearance */
  background: var(--background-primary);
  border-radius: var(--cr-border-radius);

  /* Transitions */
  transition: var(--cr-transition-normal);
}

.cr-example-card__header {
  /* ... */
}

.cr-example-card--highlighted {
  /* ... */
}

/* Responsive */
@media (max-width: 768px) {
  .cr-example-card {
    padding: var(--cr-spacing-sm);
  }
}
```
