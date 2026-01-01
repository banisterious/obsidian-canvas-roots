# Family Chart View

The Interactive Family Chart View is a persistent, interactive visualization panel for exploring and editing family trees in real-time. Unlike the static canvas exports, it provides a dynamic, explorable interface powered by the [family-chart](https://github.com/donatso/family-chart) library.

---

## Table of Contents

- [Opening the Family Chart](#opening-the-family-chart)
- [Navigation and Exploration](#navigation-and-exploration)
- [Display Options](#display-options)
  - [Card Styles](#card-styles)
- [Edit Mode](#edit-mode)
- [Exporting the Chart](#exporting-the-chart)
- [Styling](#styling)
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

### Person Card Avatars

If a person note has a `media` property, the first media item is displayed as a thumbnail avatar on their card. This works with:
- Photos linked via `media: "[[portrait.jpg]]"`
- The first item in a media array: `media: ["[[portrait.jpg]]", "[[other.jpg]]"]`
- Media linked during Gramps Package (`.gpkg`) import

Use the `canvas-roots-media` block with `editable: true` in person notes to drag-and-reorder media items—the first item becomes the thumbnail.

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

### Card Styles

Choose from 4 card styles to match your visualization needs. Access via the **Style** menu → **Card Style** submenu.

| Style | Description | Best For |
|-------|-------------|----------|
| **Rectangle** | Default cards with avatar thumbnails and full details (name, dates) | General use, detailed views |
| **Circle** | Circular avatar cards with name labels below | Photo-centric trees, visual appeal |
| **Compact** | Text-only cards without avatars | Large trees, structure focus |
| **Mini** | Smaller name-only cards | High-level overviews, navigation |

**Features:**
- Card style persists across Obsidian restarts
- All styles support the "Open note" button (smaller on Mini)
- All styles work with PNG/PDF export
- Circle style uses circular avatar cropping with gender-colored backgrounds

**Choosing a Style:**
- Use **Rectangle** for most genealogy work where you want to see photos and dates
- Use **Circle** for presentations or when photos are the main focus
- Use **Compact** when working with large trees (50+ people) to see more at once
- Use **Mini** for quick navigation or getting an overview before zooming in

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

Click the **Export** button in the toolbar to open the Export Wizard.

### Quick Presets

Choose from 5 preset configurations for common use cases:

| Preset | Format | Settings | Use Case |
|--------|--------|----------|----------|
| **Quick Share** | PNG | 1x scale, no avatars | Social media, messaging |
| **High Quality** | PNG | 2x scale, with avatars | Printing, archiving |
| **Print Ready** | PDF | Cover page, with avatars | Physical prints, sharing |
| **Editable** | SVG | Vector format, no avatars | Editing in Inkscape/Illustrator |
| **Document** | ODT | Cover page, with avatars | Merging with reports in Word/LibreOffice |

### Custom Export Options

Click **Customize** to configure export settings manually:

**Format Options:**
- **PNG**: Raster image with configurable scale (1x, 2x, 3x, 4x)
- **SVG**: Scalable vector graphics for editing
- **PDF**: Multi-page document with optional cover page
- **ODT**: OpenDocument Text for editing in LibreOffice/Word

**PDF/ODT Options:**
- Page size: Fit to content, A4, Letter, Legal, Tabloid
- Layout: Single page or tiled across multiple pages
- Orientation: Auto, Portrait, Landscape
- Cover page: Optional title page with custom title and subtitle

**General Options:**
- Include avatars: Show person thumbnails in export
- Filename: Customize the output filename

### Export Progress

Large exports show a progress modal with:
- Phase indicators (Preparing, Embedding avatars, Rendering, Encoding, Saving)
- Progress bar
- Cancel button

### Settings Memory

Your last-used export settings (format, scale, page options) are remembered for next time.

## Styling

### Theme Presets

Click the **palette button** in the toolbar to access color themes:

| Theme | Description |
|-------|-------------|
| **Classic** | Traditional pink/blue genealogy colors (default) |
| **Pastel** | Lighter, softer tones |
| **Earth Tones** | Natural terracotta, sage, and sand colors |
| **High Contrast** | Magenta/cyan/yellow for accessibility |
| **Monochrome** | Grayscale, no color coding |

### Custom Colors

Select **Customize...** from the palette menu to open the color picker modal:

| Color | Description |
|-------|-------------|
| **Female card** | Background color for female person cards |
| **Male card** | Background color for male person cards |
| **Unknown card** | Background color for unknown gender cards |
| **Background (light)** | Chart background in light theme |
| **Background (dark)** | Chart background in dark theme |
| **Text (light)** | Card text color in light theme |
| **Text (dark)** | Card text color in dark theme |

Colors update in real-time as you adjust them. Click **Apply** to save, or **Reset to defaults** to revert.

### Style Settings Integration

If you have the [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin installed:
- In-view settings (from the palette menu) take precedence
- "Reset to defaults" clears in-view settings, revealing Style Settings values
- Both can coexist—use in-view for quick switching, Style Settings for vault-wide defaults

## State Persistence

The Family Chart View automatically saves and restores:
- Root person selection
- Color scheme preference
- Card style preference
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
| Palette | Access theme presets and custom color picker |
| Zoom in/out | Adjust zoom level |
| Search | Find and navigate to a specific person |
| Edit toggle | Enable/disable edit mode |
| Undo/Redo | Reverse or replay edits (edit mode only) |
| Fit to view | Zoom to show entire tree |
| Layout settings | Adjust spacing, date display, and kinship labels |
| Style menu | Card style (Rectangle, Circle, Compact, Mini), display options |
| Export | Open export wizard (PNG, SVG, PDF, ODT) |
| Refresh | Reload data from notes |

## Family Chart vs Canvas

| Feature | Family Chart View | Canvas Generation |
|---------|-------------------|-------------------|
| **Exploration** | Best for browsing large trees | Better for static documentation |
| **Editing** | Direct in-chart editing | Edit source notes, regenerate |
| **Persistence** | View survives reloads | Canvas file saved permanently |
| **Export** | PNG, SVG, PDF, ODT | Canvas file, Excalidraw |
| **Integration** | Live sync with notes | Snapshot at generation time |
| **Styling** | Theme presets, custom colors | Style Settings only |
| **Use case** | Interactive research | Shareable family tree |

**Recommendation:** Use Family Chart View for day-to-day exploration and quick edits. Use Canvas Generation for creating permanent, shareable family tree documents.
