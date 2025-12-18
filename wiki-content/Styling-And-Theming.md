# Styling & Theming

This page covers how to customize the appearance of your family trees.

---

## Table of Contents

- [Built-in Canvas Roots Styling](#built-in-canvas-roots-styling)
- [Advanced Canvas Plugin](#advanced-canvas-plugin)
- [Style Settings Plugin](#style-settings-plugin)
- [CSS Customization](#css-customization)
- [Theme Compatibility](#theme-compatibility)

---

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

## Style Settings Plugin

Canvas Roots integrates with the [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin to provide a user-friendly way to customize visual options without editing CSS.

### Setup

1. Install the Style Settings plugin from Community Plugins
2. Open Settings → Style Settings
3. Find the "Canvas Roots" section
4. Adjust colors with visual color pickers

This is an optional enhancement - Canvas Roots works without Style Settings installed.

### Family Chart View

Customize colors for the interactive family chart:

| Setting | Description | Default |
|---------|-------------|---------|
| Female card color | Background color for female person cards | Pink (`rgb(196, 138, 146)`) |
| Male card color | Background color for male person cards | Blue (`rgb(120, 159, 172)`) |
| Unknown gender card color | Background color for unknown gender cards | Gray (`rgb(211, 211, 211)`) |
| Chart background (light theme) | Background color in light mode | Near white (`rgb(250, 250, 250)`) |
| Chart background (dark theme) | Background color in dark mode | Dark gray (`rgb(33, 33, 33)`) |
| Card text color (light theme) | Text color in light mode | Dark gray (`#333333`) |
| Card text color (dark theme) | Text color in dark mode | White (`#ffffff`) |

### Evidence Visualization

Customize colors for source quality indicators and research coverage:

| Setting | Description | Default |
|---------|-------------|---------|
| Primary source color | Original records created at the time of the event | Green (`#22c55e`) |
| Secondary source color | Compiled records based on primary sources | Amber (`#f59e0b`) |
| Derivative source color | Copies or transcriptions of other sources | Red (`#ef4444`) |
| Well-researched coverage color | Research coverage at or above 75% | Green (`#22c55e`) |
| Moderate coverage color | Research coverage between 50-74% | Amber (`#f59e0b`) |
| Needs research color | Research coverage below 50% | Red (`#ef4444`) |

### Canvas Node Dimensions

Node width, height, and spacing for generated canvas trees are not CSS-controlled. These settings are configured in:

- **Plugin settings:** Settings → Canvas Roots → Canvas Output
- **Control Center:** Canvas Settings tab

The Style Settings panel includes an informational note pointing to these locations.

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
