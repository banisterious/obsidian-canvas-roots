# Style Settings Integration Plan

## Overview

Expose Charted Roots styling options via the [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin, allowing users to customize colors and dimensions without editing CSS.

**Target Version:** v0.9.1
**Type:** Enhancement (customization of existing features)

## Scope

### Phase 1: Family Chart Colors

Customizable colors for the Family Chart View (D3-based interactive chart):

| Setting | CSS Variable | Default |
|---------|--------------|---------|
| Female card color | `--cr-fcv-female-color` | `rgb(196, 138, 146)` |
| Male card color | `--cr-fcv-male-color` | `rgb(120, 159, 172)` |
| Unknown gender card color | `--cr-fcv-unknown-color` | `lightgray` |
| Chart background color | `--cr-fcv-background` | `var(--background-primary)` |
| Card text color | `--cr-fcv-text-color` | `var(--text-normal)` |

### Phase 2: Canvas Node Styling

Customizable dimensions for generated canvas nodes:

| Setting | CSS Variable | Default | Range |
|---------|--------------|---------|-------|
| Node width | `--cr-canvas-node-width` | `250` | 150-400 |
| Node height | `--cr-canvas-node-height` | `120` | 80-200 |
| Border radius | `--cr-canvas-border-radius` | `8` | 0-20 |
| Border width | `--cr-canvas-border-width` | `2` | 1-5 |
| Connection line width | `--cr-canvas-edge-width` | `2` | 1-6 |

### Phase 3: Evidence Visualization Styling

Deferred from Evidence Visualization Phase 4 - better fit here for comprehensive theming.

**Source Quality Indicator Colors:**

| Setting | CSS Variable | Default |
|---------|--------------|---------|
| Primary source color | `--cr-source-primary` | `var(--color-green)` |
| Secondary source color | `--cr-source-secondary` | `var(--color-yellow)` |
| Derivative source color | `--cr-source-derivative` | `var(--color-red)` |

**Research Coverage Threshold Colors:**

| Setting | CSS Variable | Default |
|---------|--------------|---------|
| Well-researched (≥75%) | `--cr-coverage-high` | `var(--color-green)` |
| Moderate (≥50%) | `--cr-coverage-medium` | `var(--color-yellow)` |
| Needs research (<50%) | `--cr-coverage-low` | `var(--color-red)` |

**Media Node Quality Borders:**

| Setting | CSS Variable | Default |
|---------|--------------|---------|
| Quality border width | `--cr-media-quality-border-width` | `3` |
| Primary border color | `--cr-media-border-primary` | `var(--color-green)` |
| Secondary border color | `--cr-media-border-secondary` | `var(--color-yellow)` |
| Derivative border color | `--cr-media-border-derivative` | `var(--color-red)` |

## Implementation

### Style Settings Configuration

Add `/* @settings */` block to `styles.css` (or dedicated `style-settings.css`):

```css
/* @settings

name: Charted Roots
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
    default: 'rgb(196, 138, 146)'
  -
    id: cr-fcv-male-color
    title: Male card color
    type: variable-color
    format: rgb
    default: 'rgb(120, 159, 172)'
  # ... additional settings

*/
```

### Triggering Style Settings Parse

In `main.ts` `onload()`:

```typescript
// Trigger Style Settings to parse our settings block
this.app.workspace.trigger('parse-style-settings');
```

### CSS Variable Usage

Update component CSS to use variables with fallbacks:

```css
.cr-fcv-chart-container .f3 .card.female {
  background-color: var(--cr-fcv-female-color, rgb(196, 138, 146));
}
```

### Current Hardcoded Values to Replace

1. **Family Chart View** (`styles/family-chart.css`):
   - Card colors by gender
   - Background colors
   - Text colors

2. **Canvas Generator** (`src/core/canvas-generator.ts`):
   - Node dimensions (currently from settings, but could expose via CSS)
   - Edge colors (currently hardcoded canvas color indices)

3. **Evidence Indicators** (`src/sources/ui/*`, `src/core/canvas-generator.ts`):
   - Source quality badge colors
   - Coverage percentage colors
   - Conflict indicator color

## Dependencies

- **Style Settings plugin**: Optional dependency - plugin works without it, but styling options won't appear
- No changes to core functionality; styling-only enhancement

## Out of Scope

- Spacing variables (internal layout; could break UI)
- Transition timing (edge case)
- Map view styling (Leaflet has its own theming)
- Canvas colors (limited to Obsidian's 6 color palette)

## Testing

1. Verify plugin works normally without Style Settings installed
2. Install Style Settings and verify Charted Roots section appears
3. Test each color/dimension setting updates live
4. Verify settings persist across Obsidian restarts
5. Test with various Obsidian themes (light/dark)

## Files to Modify

- `styles/variables.css` - Add new CSS custom properties with defaults
- `styles/family-chart.css` - Replace hardcoded colors with variables
- `styles/modals.css` - Replace evidence indicator colors with variables
- `main.ts` - Add Style Settings trigger on load
- New: `styles/style-settings.css` - Style Settings configuration block
- `wiki-content/Styling-And-Theming.md` - Update "Style Settings Plugin" section from planned to implemented

## References

- [Style Settings Documentation](https://github.com/mgmeyers/obsidian-style-settings)
- [Style Settings Types](https://github.com/mgmeyers/obsidian-style-settings#setting-types)
