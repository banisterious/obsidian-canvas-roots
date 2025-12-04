# Styling & Theming

This page covers how to customize the appearance of your family trees.

## Built-in Canvas Roots Styling

Canvas Roots provides styling options within the JSON Canvas standard.

### Access Settings

- Control Center → Canvas Settings tab
- Or: Settings → Canvas Roots → Canvas styling

### Node Coloring Schemes

- **Gender**: Green for male, purple for female (genealogy convention)
- **Generation**: Different color per generation level (creates visual layers)
- **Monochrome**: No coloring (neutral, clean look)

### Arrow Styles

- **Directed (→)**: Single arrow pointing to child/target
- **Bidirectional (↔)**: Arrows on both ends
- **Undirected (—)**: No arrows (just lines)

Configure separately for:
- Parent-child relationships (default: directed)
- Spouse relationships (default: undirected)

### Edge Colors

Choose from Obsidian's 6 preset colors or theme default:
- Red, Orange, Yellow, Green, Cyan, Purple, None

### Spouse Edge Display

By default, spouse relationships are indicated by positioning only. Optionally show spouse edges with marriage metadata:

1. Enable "Show spouse edges" toggle
2. Choose label format:
   - None (no labels)
   - Date only (e.g., "m. 1985")
   - Date and location (e.g., "m. 1985 | Boston, MA")
   - Full details (e.g., "m. 1985 | Boston, MA | div. 1992")

### Applying Styling

- Settings apply to newly generated trees automatically
- For existing trees: right-click → "Regenerate canvas"

## Advanced Canvas Plugin

For styling beyond the JSON Canvas spec, use the [Advanced Canvas](https://github.com/Developer-Mike/obsidian-advanced-canvas) plugin.

### Additional Features

- Border styles (dashed, dotted)
- Custom shapes (circles, hexagons)
- Enhanced visual effects (shadows, gradients)

### Installation

1. Install Advanced Canvas from Community Plugins
2. Both plugins work independently
3. Canvas Roots handles layout, Advanced Canvas handles advanced styling

### Workflow

1. Generate tree with Canvas Roots (handles positioning)
2. Apply standard styling via Canvas Roots settings
3. Optionally apply advanced styling with Advanced Canvas
4. Use "Regenerate canvas" to update tree structure while preserving Advanced Canvas styling

**Note:** Advanced Canvas features may not be portable to other Canvas viewers.

## Style Settings Plugin (Planned)

> **Status:** Planned for v0.8.0. See [Roadmap](Roadmap#style-settings-integration) for details.

Canvas Roots will integrate with the [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin to provide a user-friendly way to customize visual options without editing CSS.

### Planned Options

**Family Chart View:**
- Female card color
- Male card color
- Unknown gender card color
- Chart background color
- Card text color

**Canvas Nodes (future):**
- Node width and height
- Border radius
- Connection line styling

### How It Will Work

1. Install the Style Settings plugin from Community Plugins
2. Open Settings → Style Settings
3. Find the "Canvas Roots" section
4. Adjust colors and dimensions with visual pickers and sliders

This is an optional enhancement - Canvas Roots works without Style Settings installed.

## CSS Customization

For advanced customization beyond Style Settings, Canvas Roots uses CSS classes that can be customized in your vault's CSS snippets.

### Canvas Node Classes

Canvas Roots applies classes to generated nodes that can be targeted with CSS:

```css
/* Example: Style male person nodes */
.canvas-node[data-gender="M"] {
  border-color: #4a9eff;
}

/* Example: Style female person nodes */
.canvas-node[data-gender="F"] {
  border-color: #ff69b4;
}
```

### Control Center Styling

The Control Center modal uses CSS classes prefixed with `cr-`:

```css
/* Example: Customize Control Center header */
.cr-control-center-header {
  background: var(--background-secondary);
}
```

### Family Chart View Styling

The interactive chart view can be styled via CSS:

```css
/* Example: Customize chart background */
.cr-family-chart-container {
  background: var(--background-primary);
}
```

## Theme Compatibility

Canvas Roots is designed to work with Obsidian's theme system:

- Colors adapt to light/dark mode automatically
- Uses CSS custom properties for consistency
- Respects accent colors from your theme

### Tested Themes

Canvas Roots is tested with:
- Default Obsidian theme
- Minimal
- Things
- California Coast

If you encounter styling issues with a specific theme, please [report it](https://github.com/banisterious/obsidian-canvas-roots/issues).
