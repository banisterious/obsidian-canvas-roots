# Card Style Options for Family Chart

**Status:** Planning
**Priority:** Medium
**Issue:** [#87](https://github.com/banisterious/obsidian-canvas-roots/issues/87)

---

## Summary

Add multiple card style options to the Family Chart view, allowing users to choose the visualization that best fits their needs. Options include circular avatars for photo-centric display, compact text-only cards for large trees, and mini cards for overview navigation.

---

## User Experience

### Card Style Selector

A new toolbar button (icon: `layout-template` or similar) opens a dropdown menu:

| Option | Description |
|--------|-------------|
| Rectangle (default) | Current SVG cards with square avatars |
| Circle | HTML cards with circular avatars, rectangular fallback |
| Compact | Text-only cards, no avatars (for large trees or structure focus) |
| Mini | Smaller cards fitting more generations on screen |

### Visual Behavior

**Rectangle style (default):**
- Current implementation with SVG cards
- Square avatar image on the left
- Name + birth/death dates on the right
- Gender-based background color
- "Open note" button on hover

**Circle style with avatar:**
- Circular photo cropped to fit
- Name label below the circle
- Gender-based border/background color
- Hover effect with subtle scale/shadow

**Circle style without avatar:**
- Falls back to rectangular text card
- Shows name + birth/death dates
- Gender-based background color
- Same appearance as Rectangle style cards

This hybrid approach (`imageCircleRect` in family-chart library) ensures no information loss for persons without photos.

**Compact style:**
- Text-only cards, no avatar images
- Name + birth/death dates
- Gender-based background color
- Useful for large trees (100+ nodes) or when focusing on structure over photos

**Mini style:**
- Smaller card dimensions
- Abbreviated display (name only, or name + years)
- Fits more generations on screen
- Ideal for overview/navigation before zooming in

---

## Technical Design

### State Management

New view state property:
```typescript
private cardStyle: 'rectangle' | 'circle' | 'compact' | 'mini' = 'rectangle';
```

### Toolbar Addition

Add button between Display and Style buttons in `buildToolbar()`:
```typescript
const cardStyleBtn = rightControls.createEl('button', {
    cls: 'cr-fcv-btn clickable-icon',
    attr: { 'aria-label': 'Card style' }
});
setIcon(cardStyleBtn, 'layout-template');
cardStyleBtn.addEventListener('click', (e) => this.showCardStyleMenu(e));
```

### Card Style Menu

New method `showCardStyleMenu()`:
```typescript
private showCardStyleMenu(e: MouseEvent): void {
    const menu = new Menu();

    menu.addItem((item) => {
        item.setTitle('Card style')
            .setIcon('credit-card')
            .setDisabled(true);
    });

    menu.addItem((item) => {
        item.setTitle(`${this.cardStyle === 'rectangle' ? '✓ ' : '  '}Rectangle`)
            .onClick(() => this.setCardStyle('rectangle'));
    });

    menu.addItem((item) => {
        item.setTitle(`${this.cardStyle === 'circle' ? '✓ ' : '  '}Circle`)
            .onClick(() => this.setCardStyle('circle'));
    });

    menu.addItem((item) => {
        item.setTitle(`${this.cardStyle === 'compact' ? '✓ ' : '  '}Compact`)
            .onClick(() => this.setCardStyle('compact'));
    });

    menu.addItem((item) => {
        item.setTitle(`${this.cardStyle === 'mini' ? '✓ ' : '  '}Mini`)
            .onClick(() => this.setCardStyle('mini'));
    });

    menu.showAtMouseEvent(e);
}
```

### Card Renderer Switching

Modify chart initialization (~line 895) to select renderer based on style:

```typescript
switch (this.cardStyle) {
    case 'circle':
        // HTML cards with circular avatar / rectangle fallback
        this.f3Card = this.f3Chart.setCardHtml()
            .setStyle('imageCircleRect')
            .setCardDisplay(displayFields)
            .setCardImageField('avatar')
            .setCardDim({ w: 200, h: 70, img_w: 60, img_h: 60, img_x: 5, img_y: 5 })
            .setOnCardClick((e, d) => this.handleCardClick(e, d))
            .setOnCardUpdate(this.createOpenNoteButtonCallback());
        break;

    case 'compact':
        // Text-only cards, no avatars
        this.f3Card = this.f3Chart.setCardSvg()
            .setCardDisplay(displayFields)
            .setCardDim({ w: 180, h: 50, text_x: 10, text_y: 12, img_w: 0, img_h: 0 })
            .setOnCardClick((e, d) => this.handleCardClick(e, d))
            .setOnCardUpdate(this.createOpenNoteButtonCallback());
        break;

    case 'mini':
        // Smaller cards for overview
        this.f3Card = this.f3Chart.setCardSvg()
            .setCardDisplay([['name']]) // Name only for mini
            .setCardDim({ w: 120, h: 35, text_x: 5, text_y: 10, img_w: 0, img_h: 0 })
            .setOnCardClick((e, d) => this.handleCardClick(e, d))
            .setOnCardUpdate(this.createOpenNoteButtonCallback());
        break;

    case 'rectangle':
    default:
        // Default: SVG cards with square avatars (current implementation)
        this.f3Card = this.f3Chart.setCardSvg()
            .setCardDisplay(displayFields)
            .setCardDim({ w: 200, h: 70, text_x: 75, text_y: 15, img_w: 60, img_h: 60, img_x: 5, img_y: 5 })
            .setOnCardClick((e, d) => this.handleCardClick(e, d))
            .setOnCardUpdate(this.createOpenNoteButtonCallback());
        break;
}
```

### Type Updates

Update `f3Card` type to support both renderers:
```typescript
private f3Card: ReturnType<ReturnType<typeof f3.createChart>['setCardSvg']>
              | ReturnType<ReturnType<typeof f3.createChart>['setCardHtml']>
              | null = null;
```

### Style Change Handler

```typescript
private setCardStyle(style: 'rectangle' | 'circle' | 'compact' | 'mini'): void {
    if (this.cardStyle === style) return;
    this.cardStyle = style;
    this.updateContainerStyleClass();
    void this.refreshChart();
}

private updateContainerStyleClass(): void {
    const container = this.chartContainer;
    if (!container) return;

    // Remove existing style classes
    container.removeClass('card-style-rectangle', 'card-style-circle', 'card-style-compact', 'card-style-mini');

    // Add current style class
    container.addClass(`card-style-${this.cardStyle}`);
}
```

### State Persistence

Card style is stored as per-view state using Obsidian's view state API:

```typescript
getState(): Record<string, unknown> {
    return {
        ...super.getState(),
        cardStyle: this.cardStyle
    };
}

setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {
    if (state.cardStyle && typeof state.cardStyle === 'string') {
        this.cardStyle = state.cardStyle as 'rectangle' | 'circle' | 'compact' | 'mini';
    }
    return super.setState(state, result);
}
```

This ensures the card style persists when the view is reopened or the workspace is restored.

---

## CSS Additions

Add to `styles/family-chart-view.css`:

```css
/* ============================================================
 * Circular Avatar Card Styles (imageCircle / imageCircleRect)
 * ============================================================ */

.cr-fcv-chart-container.f3 div.card-image-circle {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px;
    border-radius: 8px;
    min-width: 100px;
}

.cr-fcv-chart-container.f3 div.card-image-circle img {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid rgba(255, 255, 255, 0.3);
}

.cr-fcv-chart-container.f3 div.card-image-circle .person-icon {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.cr-fcv-chart-container.f3 div.card-image-circle .person-icon svg {
    width: 40px;
    height: 40px;
    opacity: 0.7;
}

.cr-fcv-chart-container.f3 div.card-image-circle .card-label {
    margin-top: 8px;
    text-align: center;
    font-size: 12px;
    line-height: 1.3;
}

/* Rectangular fallback styling (matches existing rect cards) */
.cr-fcv-chart-container.f3 div.card-rect {
    width: 200px;
    min-height: 70px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 10px 15px;
    border-radius: 5px;
}

/* ============================================================
 * Compact Card Styles (text-only, no avatars)
 * ============================================================ */

.cr-fcv-chart-container.f3.card-style-compact rect.card-bg {
    width: 180px;
    height: 50px;
}

.cr-fcv-chart-container.f3.card-style-compact text {
    font-size: 11px;
}

/* ============================================================
 * Mini Card Styles (smaller for overview)
 * ============================================================ */

.cr-fcv-chart-container.f3.card-style-mini rect.card-bg {
    width: 120px;
    height: 35px;
}

.cr-fcv-chart-container.f3.card-style-mini text {
    font-size: 10px;
}

.cr-fcv-chart-container.f3.card-style-mini .open-note-btn {
    display: none; /* Hide button on mini cards - too small */
}
```

---

## Implementation Phases

### Phase 1: Core Implementation

| Step | Description |
|------|-------------|
| 1.1 | Add `cardStyle` state property with default value |
| 1.2 | Add toolbar button and menu |
| 1.3 | Implement conditional renderer switching |
| 1.4 | Add CSS for circular cards |
| 1.5 | Test with various avatar states |

### Phase 2: Polish

| Step | Description |
|------|-------------|
| 2.1 | Verify export compatibility (PNG/PDF/SVG) |
| 2.2 | Test with different tree sizes |
| 2.3 | Adjust card dimensions if needed |
| 2.4 | Ensure "Open note" button works on HTML cards |

### Phase 3: Documentation

| Step | Description |
|------|-------------|
| 3.1 | Update user documentation |
| 3.2 | Add to Roadmap/Release History |

---

## Considerations

### Export Compatibility

HTML cards render differently than SVG cards. Need to verify:
- PNG export via html2canvas
- PDF export
- SVG export (may not work with HTML cards - might need to fall back to SVG for export)

### Card Callbacks

The `setOnCardUpdate` callback is used to add the "Open note" button. Need to verify this works correctly with HTML cards, or adapt the callback for the HTML DOM structure.

### Performance

HTML cards use DOM elements instead of SVG. For large trees (100+ nodes), benchmark to ensure acceptable performance.

---

## Testing Checklist

- [ ] Rectangle style works as before (no regression)
- [ ] Circle style displays circular avatars correctly
- [ ] Circle style falls back to rectangle for no-avatar persons
- [ ] Compact style displays text-only cards without avatars
- [ ] Mini style displays smaller cards with name only
- [ ] Gender colors apply correctly in all styles
- [ ] Card click navigation works in all styles
- [ ] Open note button appears and works (except Mini where hidden)
- [ ] Switching styles refreshes chart correctly
- [ ] Style persists across view reopening (per-view state)
- [ ] Export produces expected output for each style
- [ ] All styles work with horizontal and vertical orientations
- [ ] Mini style renders correctly with large trees (100+ nodes)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/ui/views/family-chart-view.ts` | Add state, toolbar button, menu, renderer switching |
| `styles/family-chart-view.css` | Add circular card styles |

---

## References

- [family-chart HTML card example](../../external/family-chart/examples/htmls/11-html-card-styling.html)
- [card-html.ts renderer](../../external/family-chart/src/renderers/card-html.ts)
- [CardHtml class](../../external/family-chart/src/core/cards/card-html.ts)
