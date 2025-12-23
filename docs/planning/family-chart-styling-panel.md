# Family Chart Styling Panel

**Status:** Complete
**Priority:** Low
**Created:** 2025-12-23
**Completed:** 2025-12-23

---

## Overview

Expose the Family Chart styling options (currently only accessible via Style Settings plugin) directly in the Family Chart view toolbar. This improves discoverability and allows users to customize colors without installing Style Settings.

---

## Current State

Styling options are defined in `styles/style-settings.css` and only accessible if the user has the Style Settings plugin installed. The options are:

| Variable | Description | Default |
|----------|-------------|---------|
| `--cr-fcv-female-color` | Female card color | `rgb(196, 138, 146)` |
| `--cr-fcv-male-color` | Male card color | `rgb(120, 159, 172)` |
| `--cr-fcv-unknown-color` | Unknown gender card color | `rgb(211, 211, 211)` |
| `--cr-fcv-background-light` | Chart background (light theme) | `rgb(250, 250, 250)` |
| `--cr-fcv-background-dark` | Chart background (dark theme) | `rgb(33, 33, 33)` |
| `--cr-fcv-text-light` | Card text color (light theme) | `#333333` |
| `--cr-fcv-text-dark` | Card text color (dark theme) | `#ffffff` |

---

## Proposed Solution

### Two-Level Approach

1. **Quick Menu** — Toolbar button opens a menu with preset themes
2. **Customize Modal** — "Customize..." option opens a modal with color pickers

### Toolbar Button

Add a "palette" icon button to the toolbar (after Display settings, before Depth settings):

```
[search] [fit] [popout] [layout] [display] [🎨 style] [depth] [export] [refresh]
```

### Quick Menu

```
┌─────────────────────────────┐
│ Theme                       │
├─────────────────────────────┤
│ ✓ Classic (default)         │
│   Pastel                    │
│   Earth Tones               │
│   High Contrast             │
│   Monochrome                │
├─────────────────────────────┤
│   Customize...              │
│   Reset to defaults         │
└─────────────────────────────┘
```

### Theme Presets

| Theme | Female | Male | Unknown | Description |
|-------|--------|------|---------|-------------|
| **Classic** | Pink `#c48a92` | Blue `#789fac` | Gray `#d3d3d3` | Default colors |
| **Pastel** | Soft pink `#f4c2c2` | Soft blue `#a7c7e7` | Lavender `#e6e6fa` | Lighter, softer tones |
| **Earth Tones** | Terracotta `#cc7a6f` | Sage `#8fbc8f` | Sand `#d2b48c` | Natural, warm palette |
| **High Contrast** | Magenta `#ff00ff` | Cyan `#00ffff` | Yellow `#ffff00` | Accessibility-focused |
| **Monochrome** | Dark gray `#666666` | Medium gray `#888888` | Light gray `#aaaaaa` | No color coding |

### Customize Modal

```
┌─────────────────────────────────────────────────────────┐
│  Chart Colors                                        [X] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  CARD COLORS                                            │
│                                                         │
│  Female     [██████████] #c48a92                       │
│  Male       [██████████] #789fac                       │
│  Unknown    [██████████] #d3d3d3                       │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  BACKGROUND (current theme)                             │
│                                                         │
│  Background [██████████] #fafafa                       │
│  Text       [██████████] #333333                       │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  PRESETS                                                │
│  [Classic] [Pastel] [Earth] [Contrast] [Mono]          │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [Reset]                              [Cancel] [Apply]  │
└─────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Storage

Colors stored in plugin settings:

```typescript
interface FamilyChartColors {
  femaleColor: string;
  maleColor: string;
  unknownColor: string;
  backgroundLight: string;
  backgroundDark: string;
  textLight: string;
  textDark: string;
}

interface CanvasRootsSettings {
  // ... existing settings
  familyChartColors?: FamilyChartColors;  // undefined = use defaults
}
```

### Applying Colors

Colors applied by setting CSS custom properties on the chart container:

```typescript
private applyCustomColors(): void {
  const colors = this.plugin.settings.familyChartColors;
  if (!colors || !this.chartContainerEl) return;

  const el = this.chartContainerEl;
  el.style.setProperty('--cr-fcv-female-color', colors.femaleColor);
  el.style.setProperty('--cr-fcv-male-color', colors.maleColor);
  el.style.setProperty('--cr-fcv-unknown-color', colors.unknownColor);
  // Theme-specific colors based on current theme
  if (document.body.classList.contains('theme-dark')) {
    el.style.setProperty('--cr-fcv-background-dark', colors.backgroundDark);
    el.style.setProperty('--cr-fcv-text-dark', colors.textDark);
  } else {
    el.style.setProperty('--cr-fcv-background-light', colors.backgroundLight);
    el.style.setProperty('--cr-fcv-text-light', colors.textLight);
  }
}
```

### Color Picker

Use Obsidian's built-in color input or a simple HTML5 color picker:

```typescript
const colorInput = container.createEl('input', {
  type: 'color',
  value: currentColor
});
```

### Interaction with Style Settings

If user has Style Settings installed and has customized values there:
- Our settings take precedence (applied via inline styles)
- "Reset to defaults" clears our settings, revealing Style Settings values
- Document this behavior in the modal

---

## Implementation Plan

### Phase 1: Menu with Presets
1. Add palette button to toolbar
2. Implement `showStyleMenu(e: MouseEvent)` with preset options
3. Define preset color schemes as constants
4. Apply preset by saving to settings and refreshing chart

### Phase 2: Customize Modal
1. Create `FamilyChartStyleModal` extending `Modal`
2. Add color picker rows for each color
3. Add preset buttons for quick selection
4. Implement Apply/Cancel/Reset logic
5. Live preview while modal is open

### Phase 3: Polish
1. Add color swatches to menu items showing current colors
2. Remember last-used preset
3. Add keyboard shortcuts for common presets

---

## Files Modified

| File | Changes |
|------|---------|
| `src/ui/views/family-chart-view.ts` | Added palette button, theme presets, style menu, FamilyChartStyleModal |
| `src/settings.ts` | Added `FamilyChartColors` interface and `familyChartColors` setting |
| `styles/family-chart-view.css` | Added CSS for style modal and color pickers |

Note: Modal was implemented inline in `family-chart-view.ts` rather than as a separate file.

---

## Success Criteria

- [x] Palette button appears in toolbar
- [x] Menu shows 5 preset themes
- [x] Clicking preset applies colors immediately
- [x] "Customize..." opens modal with color pickers
- [x] Colors persist across sessions
- [x] "Reset to defaults" clears custom colors
- [x] Works alongside Style Settings (our values take precedence)
- [x] Colors apply to exports (PNG/SVG/PDF/ODT)

---

## See Also

- [Style Settings CSS](../../styles/style-settings.css) — Current style settings configuration
- [Family Chart View wiki](../../wiki-content/Family-Chart-View.md) — User documentation
