# Family Chart View

The Interactive Family Chart View is a persistent, interactive visualization panel for exploring and editing family trees in real-time. Unlike the static canvas exports, it provides a dynamic, explorable interface powered by the [family-chart](https://github.com/donatso/family-chart) library.

---

## Table of Contents

- [Opening the Family Chart](#opening-the-family-chart)
- [Navigation and Exploration](#navigation-and-exploration)
- [Display Options](#display-options)
- [Edit Mode](#edit-mode)
- [Exporting the Chart](#exporting-the-chart)
- [State Persistence](#state-persistence)
- [Multiple Chart Views](#multiple-chart-views)
- [Toolbar Reference](#toolbar-reference)
- [Family Chart vs Canvas](#family-chart-vs-canvas)

---

## Opening the Family Chart

**Method 1: Command palette**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Open family chart"
3. Select a root person when prompted
4. The chart opens in a new view

**Method 2: From a person note**
1. Open a person note (must have `cr_id` property)
2. Press `Ctrl/Cmd + P`
3. Type "Canvas Roots: Open current note in family chart"
4. The chart opens centered on that person

## Navigation and Exploration

### Pan and Zoom

- **Mouse wheel**: Zoom in/out
- **Click and drag**: Pan around the chart
- **Zoom buttons**: Fine-grained zoom control in the toolbar
- **Fit to view**: Reset view to show entire tree

### Click Interactions

- **Single click** on a person card: Center the view on that person
- **Double click** on a person card: Open their note in the editor

## Display Options

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

### Date Display

Toggle birth/death dates on person cards via the layout settings menu.

### Kinship Labels

Toggle relationship labels on connecting lines to show how people are related:

1. Open the **Layout** menu (gear icon in toolbar)
2. Enable **Show kinship labels**
3. Links now display "Parent" or "Spouse" labels

This helps clarify relationship types at a glance, especially useful when presenting or reviewing complex family structures.

## Edit Mode

Enable edit mode to modify family relationships directly in the chart.

### Enabling Edit Mode

1. Click the **Edit** toggle button in the toolbar
2. The toolbar shows undo/redo buttons when editing is active

### Editing a Person

1. Click on any person card while in edit mode
2. An edit form appears with fields for:
   - First name and last name
   - Birth date and death date
   - Gender
3. Make your changes and save

### Undo and Redo

- Use the **Undo** and **Redo** buttons in the toolbar
- Full edit history is maintained during the session

### Bidirectional Sync

Changes made in the chart automatically update the underlying markdown notes:
- Name changes update the `name` property
- Date changes update `born` and `died` properties
- Gender changes update the `gender` property

## Exporting the Chart

### PNG Export

1. Click the export menu button in the toolbar
2. Select **Export as PNG**
3. High-resolution image (2x resolution) is saved

### SVG Export

1. Click the export menu button in the toolbar
2. Select **Export as SVG**
3. Scalable vector graphic is saved for further editing

Both exports preserve your current color scheme and theme (dark/light mode).

## State Persistence

The Family Chart View automatically saves and restores:
- Root person selection
- Color scheme preference
- Edit mode state
- Layout spacing settings
- Date visibility preference
- Approximate zoom level

When you close and reopen a family chart, it returns to the same state.

## Multiple Chart Views

Open additional family chart tabs to compare different branches or root persons:

### Open a New Chart

1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Open new family chart"
3. Select a root person
4. A new chart tab opens alongside existing ones

### Duplicate Current Chart

1. Click the three-dot menu (⋮) on the chart tab
2. Select **Duplicate view**
3. A copy of the current chart opens in a new tab

This allows you to:
- Compare different branches side-by-side
- Keep one view on ancestors while exploring descendants in another
- Navigate to different people without losing your current position

## Toolbar Reference

| Button | Function |
|--------|----------|
| Color dropdown | Switch between color schemes |
| Zoom in/out | Adjust zoom level |
| Search | Find and navigate to a specific person |
| Edit toggle | Enable/disable edit mode |
| Undo/Redo | Reverse or replay edits (edit mode only) |
| Fit to view | Zoom to show entire tree |
| Layout settings | Adjust spacing, date display, and kinship labels |
| Export menu | Save as PNG or SVG |
| Refresh | Reload data from notes |

## Family Chart vs Canvas

| Feature | Family Chart View | Canvas Generation |
|---------|-------------------|-------------------|
| **Exploration** | Best for browsing large trees | Better for static documentation |
| **Editing** | Direct in-chart editing | Edit source notes, regenerate |
| **Persistence** | View survives reloads | Canvas file saved permanently |
| **Export** | PNG/SVG images | Canvas file, Excalidraw |
| **Integration** | Live sync with notes | Snapshot at generation time |
| **Use case** | Interactive research | Shareable family tree |

**Recommendation:** Use Family Chart View for day-to-day exploration and quick edits. Use Canvas Generation for creating permanent, shareable family tree documents.
