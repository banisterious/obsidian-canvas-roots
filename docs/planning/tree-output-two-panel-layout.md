# Tree Output Tab: Two-Panel Layout Redesign

## Problem Statement

The current Tree Output tab has UX issues:
- 6 vertically stacked cards require extensive scrolling
- The "Generate family tree" button gets lost off-screen
- Preview is buried in the middle, not prominently visible
- Users must scroll up and down repeatedly to configure and generate
- No visual feedback until manually clicking "Generate preview"

## Solution: Two-Panel Layout

Split the tab into a fixed two-panel layout:
- **Left panel**: Scrollable configuration options
- **Right panel**: Sticky preview + generate button (always visible)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tree Output                               │
├────────────────────────────┬────────────────────────────────────┤
│                            │                                     │
│  ▼ Root person             │   ┌─────────────────────────────┐  │
│  ┌────────────────────┐    │   │                             │  │
│  │ [Search people...] │    │   │                             │  │
│  │ ○ John Smith       │    │   │      Live Tree Preview      │  │
│  │ ○ Jane Doe         │    │   │                             │  │
│  │ ○ ...              │    │   │         (auto-updates)      │  │
│  └────────────────────┘    │   │                             │  │
│                            │   │                             │  │
│  ▼ Tree scope              │   └─────────────────────────────┘  │
│  ┌────────────────────┐    │                                     │
│  │ Type: [Full     ▼] │    │   ┌─ Preview controls ──────────┐  │
│  │ Generations: [5  ] │    │   │ [+] [-] [⟲]  Color: [Sex ▼] │  │
│  │ ☑ Spouses          │    │   │ ☑ Labels    Export: [PNG ▼] │  │
│  │ ☑ Step-parents     │    │   └─────────────────────────────┘  │
│  │ ☑ Adoptive parents │    │                                     │
│  └────────────────────┘    │   ┌─────────────────────────────┐  │
│                            │   │ Canvas name:                │  │
│  ▶ Layout options          │   │ [John Smith Family Tree   ] │  │
│    (collapsed)             │   │                             │  │
│                            │   │ [  Generate family tree   ] │  │
│  ▶ Style customization     │   │ [  Generate all trees     ] │  │
│    (collapsed)             │   └─────────────────────────────┘  │
│                            │                                     │
│  ▶ Filter by place         │                                     │
│    (collapsed)             │                                     │
│                            │                                     │
└────────────────────────────┴────────────────────────────────────┘
```

---

## Design Details

### Left Panel (Scrollable Config)

**Sections (collapsible accordions):**

1. **Root person** (expanded by default)
   - Search input with fuzzy matching
   - Person list with filters (living, sex, birth year)
   - Sort options (A-Z, birth year, recently modified)
   - Family groups sidebar (if multiple disconnected families)
   - Selected person display with clear button

2. **Tree scope** (expanded by default)
   - Tree type dropdown: Full / Ancestors only / Descendants only
   - Max generations slider (0-10, 0 = unlimited)
   - Checkboxes: Include spouses, step-parents, adoptive parents
   - Filter by collection dropdown

3. **Layout options** (collapsed by default)
   - Direction: Vertical / Horizontal
   - Algorithm: Standard / Compact / Timeline / Hourglass
   - Spacing inputs (horizontal/vertical)

4. **Style customization** (collapsed by default)
   - Node coloring scheme
   - Edge colors and styles
   - Override toggles for each setting

5. **Filter by place** (collapsed by default)
   - Place name input
   - Checkboxes: Birth, Death, Marriage, Burial

### Right Panel (Sticky)

**Components (top to bottom):**

1. **Preview area** (~60% of panel height)
   - SVG tree preview with pan/zoom
   - Auto-updates when config changes (debounced)
   - Shows "Select a root person to preview" placeholder initially
   - Node limit warning if tree > 200 nodes

2. **Preview controls bar**
   - Zoom: [+] [-] [Reset]
   - Label visibility toggle
   - Color scheme quick-switch (without opening Style section)
   - Export dropdown (PNG / SVG / PDF)

3. **Generate section** (bottom, always visible)
   - Canvas name input (auto-populated from root person)
   - Primary button: "Generate family tree"
   - Secondary button: "Generate all trees" (only if multiple family groups)
   - Node count badge: "~125 nodes"

---

## Implementation Plan

### Phase 1: Layout Structure

**Files to modify:**
- `src/ui/control-center.ts` - Restructure `buildTreeOutputTab()`
- `styles/control-center.css` or new `styles/tree-output.css` - Two-panel CSS

**Changes:**
1. Create two-column container with CSS Grid or Flexbox
2. Left column: `overflow-y: auto` for scrolling
3. Right column: `position: sticky; top: 0;` to stay fixed
4. Move existing card content into accordion sections

### Phase 2: Collapsible Sections

**Changes:**
1. Convert cards to collapsible accordions
2. Root Person + Tree Scope expanded by default
3. Layout, Style, Place Filter collapsed by default
4. Persist collapsed state in settings (optional)

### Phase 3: Sticky Preview & Generate

**Changes:**
1. Move preview to right panel
2. Move generate button and canvas name input to right panel
3. Add node count badge near generate button
4. Style the right panel as a cohesive unit

### Phase 4: Auto-Preview Updates

**Changes:**
1. Add debounced preview regeneration on config change
2. Trigger preview when: root person selected, tree type changed, generations changed
3. Don't auto-regenerate for: spacing changes, style changes (too expensive)
4. Add loading indicator during preview generation

---

## CSS Layout

```css
.crc-tree-output-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--cr-spacing-lg);
  height: 100%;
  min-height: 600px;
}

.crc-tree-output-left {
  overflow-y: auto;
  padding-right: var(--cr-spacing-md);
}

.crc-tree-output-right {
  position: sticky;
  top: 0;
  height: fit-content;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: var(--cr-spacing-md);
}

.crc-tree-preview-area {
  flex: 1;
  min-height: 400px;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--cr-radius-md);
  overflow: hidden;
}

.crc-tree-generate-section {
  background: var(--background-secondary);
  padding: var(--cr-spacing-md);
  border-radius: var(--cr-radius-md);
  border: 1px solid var(--background-modifier-border);
}

/* Responsive: stack on narrow screens */
@media (max-width: 900px) {
  .crc-tree-output-container {
    grid-template-columns: 1fr;
  }

  .crc-tree-output-right {
    position: static;
    order: -1; /* Preview first on mobile */
  }
}
```

---

## Accordion Component

Reuse or create a collapsible section component:

```typescript
interface AccordionSection {
  title: string;
  icon: string;
  defaultExpanded: boolean;
  content: (container: HTMLElement) => void;
}

function buildAccordion(
  container: HTMLElement,
  sections: AccordionSection[]
): void {
  for (const section of sections) {
    const wrapper = container.createDiv('crc-accordion-section');
    const header = wrapper.createDiv('crc-accordion-header');

    // Chevron icon
    const chevron = header.createSpan('crc-accordion-chevron');
    setIcon(chevron, section.defaultExpanded ? 'chevron-down' : 'chevron-right');

    // Icon + title
    const icon = header.createSpan('crc-accordion-icon');
    setIcon(icon, section.icon);
    header.createSpan({ text: section.title, cls: 'crc-accordion-title' });

    // Content
    const content = wrapper.createDiv('crc-accordion-content');
    if (!section.defaultExpanded) {
      content.style.display = 'none';
    }
    section.content(content);

    // Toggle
    header.addEventListener('click', () => {
      const isExpanded = content.style.display !== 'none';
      content.style.display = isExpanded ? 'none' : 'block';
      setIcon(chevron, isExpanded ? 'chevron-right' : 'chevron-down');
    });
  }
}
```

---

## Migration Strategy

1. **Non-breaking**: Keep all existing functionality, just reorganize layout
2. **Test thoroughly**: Ensure all tree generation options still work
3. **Settings preserved**: No changes to plugin settings structure
4. **Existing entry points**: `openWithPerson()` and `openAndGenerateAllTrees()` still work

---

## Open Questions

1. **Panel width ratio**: 50/50 or 40/60 (more space for preview)?
2. **Preview auto-update**: On every change or only for key settings?
3. **Responsive behavior**: Stack vertically on narrow screens? Preview on top or bottom?
4. **Persist accordion state**: Remember which sections user expanded?

---

## Success Criteria

- [ ] Generate button always visible without scrolling
- [ ] Preview visible while adjusting any configuration
- [ ] Less scrolling required to use the tab
- [ ] Common workflow (select person → generate) requires minimal clicks
- [ ] Power users can still access all advanced options
- [ ] No regression in existing functionality
