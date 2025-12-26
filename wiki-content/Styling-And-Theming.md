# Styling & Theming

This page covers how to customize the appearance of your family trees and charts.

---

## Table of Contents

- [Canvas Tree Styling](#canvas-tree-styling)
- [Family Chart View Options](#family-chart-view-options)
- [Advanced Canvas Plugin](#advanced-canvas-plugin)
- [Style Settings Plugin](#style-settings-plugin)
- [CSS Customization](#css-customization)
- [Theme Compatibility](#theme-compatibility)

---

## Canvas Tree Styling

Canvas Roots provides styling options for generated canvas trees within the JSON Canvas standard.

### Access Settings

- **Control Center** → Visual Trees tab → Styling section

### Node Coloring Schemes

- **Gender**: Green for male, purple for female (genealogy convention)
- **Generation**: Different color per generation level (creates visual layers)
- **Collection**: Different colors for each collection/universe
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

### Source Indicators

Enable "Show source indicators" to display source count badges on nodes (e.g., "📎 3"). This helps identify which ancestors have documented evidence.

### Applying Styling

- Settings apply to newly generated trees automatically
- For existing trees: right-click → "Regenerate canvas"

---

## Family Chart View Options

The interactive Family Chart View has its own display options accessible directly in the chart toolbar.

### Color Schemes

Access via the color scheme dropdown in the toolbar:

- **Gender**: Pink for female, blue for male (traditional genealogy colors)
- **Generation**: Different colors for each generation level
- **Collection**: Color by collection membership
- **Monochrome**: Neutral coloring for clean appearance

### Layout Spacing

Access via the layout settings button (gear icon):

- **Compact**: 200px horizontal spacing (best for large trees)
- **Normal**: 250px horizontal spacing (default)
- **Spacious**: 350px horizontal spacing (best for readability)

### Display Toggles

Available in the layout settings menu:

- **Show dates**: Toggle birth/death dates on person cards
- **Show kinship labels**: Display relationship labels ("Parent", "Spouse") on connecting lines
- **Avatars**: Person cards show thumbnail from the first `media` item

### Customizing Colors

For deeper color customization of the Family Chart, use the [Style Settings plugin](#style-settings-plugin) to adjust card colors, backgrounds, and text colors.

See [Family Chart View](Family-Chart-View) for complete documentation

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

### Timeline Callouts

Customize the appearance of exported markdown timelines that use `[!cr-timeline]` callouts:

| Setting | Description | Default |
|---------|-------------|---------|
| Enable wide timeline mode | Expands readable line width for timeline notes | Off |
| Wide timeline width | Width when wide mode is enabled | `1200px` |
| Year/title text color | Color for year labels | `#e5e5e5` |
| Year/title font size | Font size for year labels | `1.5em` |
| Year column width | Width of the year column | `150px` |
| Vertical line color | Color of the timeline spine | `#525252` |
| Vertical line width | Thickness of the timeline spine | `4px` |
| Event dot size | Size of event markers | `32px` |
| Event dot border width | Border thickness on event markers | `6px` |
| Event card background | Background color for event cards | `#404040` |
| Event card border radius | Corner rounding for event cards | `1rem` |

**Event type colors** (dot colors for specific event types):

| Setting | Default |
|---------|---------|
| Birth event dot color | Green (`#4ade80`) |
| Death event dot color | Gray (`#6b7280`) |
| Marriage event dot color | Pink (`#f472b6`) |
| Default event dot color | Blue (`#60a5fa`) |

### Frozen Media Gallery

Customize the appearance of frozen media galleries that use `[!info|cr-frozen-gallery]` callouts. These settings are inspired by [MCL Gallery Cards](https://github.com/efemkay/obsidian-modular-css-layout) by Faiz Khuzaimah.

| Setting | Description | Default |
|---------|-------------|---------|
| Gallery gap | Space between images | `5px` |
| Image max height | Maximum height for gallery images | `200px` |
| Image max width | Maximum width for gallery images | `250px` |
| Image border radius | Corner rounding for images | `8px` |
| Image fit mode | How images fill their container | `cover` |
| Gallery background | Background color behind the gallery | Transparent |

**Image fit mode options:**
- `cover` - Fill container, crop if needed (default)
- `contain` - Fit entire image, may have empty space
- `fill` - Stretch to fill container
- `none` - Display at natural size

### Canvas Node Dimensions

Node width, height, and spacing for generated canvas trees are not CSS-controlled. These settings are configured in:

- **Control Center** → Visual Trees tab → Layout section

The Style Settings panel includes an informational note pointing to this location.

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
