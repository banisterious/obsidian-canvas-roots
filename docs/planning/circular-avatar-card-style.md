# Circular Avatar Card Style

**Status:** Planning
**Priority:** Medium
**Issue:** [#87](https://github.com/banisterious/obsidian-canvas-roots/issues/87)

---

## Summary

Add an optional "Circle" card style to the Family Chart view that displays person nodes with circular avatar images. When a person has no media attached, the card falls back to a rectangular text card showing name and dates.

This enhancement provides a more polished, photo-centric visualization for users who have attached portrait images to their person notes.

---

## User Experience

### Card Style Selector

A new toolbar button (icon: `layout-template` or similar) opens a dropdown menu:

| Option | Description |
|--------|-------------|
| Rectangle (default) | Current SVG cards with square avatars |
| Circle | HTML cards with circular avatars, rectangular fallback |

### Visual Behavior

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

---

## Technical Design

### State Management

New view state property:
```typescript
private cardStyle: 'rectangle' | 'circle' = 'rectangle';
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

    menu.showAtMouseEvent(e);
}
```

### Card Renderer Switching

Modify chart initialization (~line 895) to select renderer based on style:

```typescript
if (this.cardStyle === 'circle') {
    // HTML cards with circular avatar / rectangle fallback
    this.f3Card = this.f3Chart.setCardHtml()
        .setStyle('imageCircleRect')
        .setCardDisplay(displayFields)
        .setCardImageField('avatar')
        .setCardDim({ w: 200, h: 70, img_w: 60, img_h: 60, img_x: 5, img_y: 5 })
        .setOnCardClick((e, d) => this.handleCardClick(e, d))
        .setOnCardUpdate(this.createOpenNoteButtonCallback());
} else {
    // Default: SVG cards (current implementation)
    this.f3Card = this.f3Chart.setCardSvg()
        .setCardDisplay(displayFields)
        .setCardDim({ w: 200, h: 70, text_x: 75, text_y: 15, img_w: 60, img_h: 60, img_x: 5, img_y: 5 })
        .setOnCardClick((e, d) => this.handleCardClick(e, d))
        .setOnCardUpdate(this.createOpenNoteButtonCallback());
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
private setCardStyle(style: 'rectangle' | 'circle'): void {
    if (this.cardStyle === style) return;
    this.cardStyle = style;
    void this.refreshChart();
}
```

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
- [ ] Gender colors apply correctly in both styles
- [ ] Card click navigation works
- [ ] Open note button appears and works
- [ ] Switching styles refreshes chart correctly
- [ ] Style persists across view reopening
- [ ] Export produces expected output
- [ ] Works with horizontal and vertical orientations

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
