# Excalidraw Export Enhancements

## Overview

Enhance the Excalidraw export feature to leverage the full capabilities of the Obsidian Excalidraw plugin's ExcalidrawAutomate API, providing richer output with smart connectors, wiki links, and improved styling.

## Current Implementation

**File:** `src/excalidraw/excalidraw-exporter.ts` (664 lines)

**Current approach:**
- Reads existing Canvas file JSON
- Manually builds Excalidraw element JSON (rectangles, text, arrows)
- Outputs markdown file with embedded JSON

**Limitations:**
| Issue | Impact |
|-------|--------|
| Manual text sizing (`text.length * fontSize * 0.6`) | Inaccurate text dimensions |
| Point-to-point arrows | Don't adapt when elements are moved |
| No wiki links | Can't click to navigate to person notes |
| Separate rectangle + text elements | Not grouped, can become misaligned |
| No spouse connector styling | All edges look the same |
| Canvas-only input | Must generate Canvas first, then convert |

## Proposed Enhancements

### Phase 1: API Integration (Non-Breaking)

Detect and use ExcalidrawAutomate API when available, falling back to current JSON approach.

**Detection pattern:**
```typescript
const ea = (window as any).ExcalidrawAutomate;
if (ea) {
    return this.exportWithAPI(ea, options);
} else {
    return this.exportWithJSON(options); // Current approach
}
```

**Benefits of API approach:**
- `ea.measureText(text)` for accurate text dimensions
- `ea.connectObjects()` for smart connectors that adapt
- `ea.addText()` with `box` parameter for contained text
- `ea.addToGroup()` for keeping person cards as units
- Automatic element ID generation and binding

### Phase 2: Rich Node Content

Add dates and places to person nodes (matching PDF/ODT export capabilities).

**Current output:**
```
John Smith
```

**Enhanced output:**
```
John Smith
1850–1920
Dublin, Ireland
```

**Configuration options:**
```typescript
interface ExcalidrawExportOptions {
    // ... existing options ...

    /** Node content level */
    nodeContent?: 'name' | 'name-dates' | 'name-dates-places';
}
```

### Phase 3: Wiki Links

Include clickable wiki links in text labels that navigate to person notes.

**Implementation:**
```typescript
private extractNodeLabel(node: CanvasNode, includeLink: boolean): string {
    if (node.type === 'file' && node.file) {
        const name = node.file.match(/([^/]+)\.(md|markdown)$/)?.[1];
        if (includeLink) {
            // Excalidraw supports [[wiki links]] in text
            return `[[${node.file}|${name}]]`;
        }
        return name;
    }
    // ...
}
```

**Note:** Wiki links work in Excalidraw text elements—clicking them opens the linked note.

### Phase 4: Smart Connectors

Replace manual arrow creation with `connectObjects()` for intelligent routing.

**Current approach (manual):**
```typescript
const arrow = this.createArrow(
    id, fromNode, toNode, fromExcalidrawId, toExcalidrawId,
    color, strokeWidth, offsetX, offsetY, label, styleOptions
);
```

**Enhanced approach (API):**
```typescript
ea.connectObjects(
    fromExcalidrawId, "bottom",  // Connection point
    toExcalidrawId, "top",
    {
        startArrowHead: "none",
        endArrowHead: "arrow",
        numberOfPoints: 2  // Adds break points for routing
    }
);
```

**Benefits:**
- Connectors snap to element edges
- Auto-route around obstacles
- Adapt when elements are moved in Excalidraw

### Phase 5: Relationship-Aware Styling

Differentiate connector types visually.

| Relationship | Style |
|--------------|-------|
| Parent-child | Solid arrow |
| Spouse | Dashed line, no arrowhead |
| Sibling | Dotted line (optional) |

**Implementation:**
```typescript
if (edge.label === 'spouse' || isSpouseEdge(edge)) {
    ea.style.strokeStyle = 'dashed';
    ea.style.startArrowHead = 'none';
    ea.style.endArrowHead = 'none';
} else {
    ea.style.strokeStyle = 'solid';
    ea.style.endArrowHead = 'arrow';
}
```

### Phase 6: Element Grouping

Group rectangle + text as a single unit.

**Current:** Separate elements that can drift apart when edited.

**Enhanced:**
```typescript
const rectId = ea.addRect(x, y, width, height);
const textId = ea.addText(x + width/2, y + height/2, label, {
    textAlign: "center",
    verticalAlign: "middle"
});
ea.addToGroup([rectId, textId]);
```

**Alternative:** Use `addText()` with `box` parameter for single contained element:
```typescript
ea.addText(x, y, label, {
    box: "box",
    boxPadding: 10,
    textAlign: "center"
});
```

### Phase 7: Direct Generation (Skip Canvas)

Generate Excalidraw directly from person data without intermediate Canvas file.

**Current flow:**
```
Person Notes → Canvas File → Excalidraw File
```

**Enhanced flow:**
```
Person Notes → Excalidraw File (direct)
```

**Benefits:**
- Faster generation
- No temporary Canvas file
- Can use different layout optimized for Excalidraw

### Phase 8: Export Options

Leverage Excalidraw's export capabilities.

**SVG/PNG generation:**
```typescript
// If user wants SVG/PNG instead of .excalidraw.md
const svg = await ea.createSVG(null, true, {
    withBackground: true,
    withTheme: true
});

const png = await ea.createPNG(null, 2, {  // 2x scale
    withBackground: true
});
```

**Export settings in wizard:**
- Output format: Excalidraw / SVG / PNG
- Scale factor (for PNG): 1x, 2x, 4x
- Include background: yes/no
- Theme: light/dark/auto

## Technical Considerations

### ExcalidrawAutomate Availability

The API is only available when:
1. Excalidraw plugin is installed and enabled
2. An Excalidraw view is open (for some operations)

**Graceful degradation:**
```typescript
private async getExcalidrawAPI(): Promise<ExcalidrawAutomate | null> {
    const ea = (window as any).ExcalidrawAutomate;
    if (!ea) {
        logger.info('export', 'ExcalidrawAutomate not available, using JSON fallback');
        return null;
    }
    return ea;
}
```

### View Requirements

Some API operations require an open Excalidraw view:
- `ea.create()` - Can create without view
- `ea.addElementsToView()` - Requires open view
- `ea.createSVG()` / `ea.createPNG()` - Requires open view

**Workaround:** Use file-based approach with `ea.create()` which doesn't require an open view.

### Type Definitions

Create type definitions for ExcalidrawAutomate:

```typescript
// src/excalidraw/excalidraw-automate.d.ts
interface ExcalidrawAutomate {
    reset(): void;
    style: ExcalidrawStyle;
    canvas: ExcalidrawCanvas;

    addRect(x: number, y: number, w: number, h: number): string;
    addText(x: number, y: number, text: string, options?: TextOptions): string;
    addArrow(points: [number, number][], options?: ArrowOptions): string;
    connectObjects(
        objA: string, connectionA: ConnectionPoint,
        objB: string, connectionB: ConnectionPoint,
        options?: ConnectorOptions
    ): string;
    addToGroup(ids: string[]): string;
    measureText(text: string): { width: number; height: number };

    create(options?: CreateOptions): Promise<string>;
    createSVG(template?: string, dark?: boolean, options?: ExportOptions): Promise<SVGSVGElement>;
    createPNG(template?: string, scale?: number, options?: ExportOptions): Promise<Blob>;
}
```

## Implementation Priority

| Phase | Priority | Complexity | Value |
|-------|----------|------------|-------|
| Phase 1: API Integration | High | Medium | Foundation for all enhancements |
| Phase 2: Rich Node Content | High | Low | Matches PDF/ODT parity |
| Phase 3: Wiki Links | High | Low | Major usability improvement |
| Phase 4: Smart Connectors | Medium | Medium | Better editing experience |
| Phase 5: Relationship Styling | Medium | Low | Visual clarity |
| Phase 6: Element Grouping | Medium | Low | Better editing experience |
| Phase 7: Direct Generation | Low | High | Performance optimization |
| Phase 8: Export Options | Low | Medium | Power user feature |

## Recommended Release Groupings

Based on priority and dependencies:

| Release | Phases | Theme | Rationale |
|---------|--------|-------|-----------|
| v0.18.0 | 1, 2, 3 | Core API + Content + Links | Foundation + immediate user value |
| v0.19.0 | 4, 5, 6 | Smart Connectors + Styling | Enhanced editing experience |
| Future | 7, 8 | Performance + Power User | Optimization and advanced features |

**Note:** Phase 7 (Direct Generation) should offer both paths:
- "Export to Excalidraw" (direct from person data)
- "Convert Canvas to Excalidraw" (current flow, preserved)

This preserves Canvas as an intermediate artifact for users who want Obsidian-native viewing.

## Additional Enhancement Opportunities

Based on analysis of the Excalidraw plugin's ea-scripts library, the following features could be leveraged for future enhancements:

### Auto Layout (ELK.js Integration)

The `Auto Layout.md` script demonstrates integration with [ELK.js](https://github.com/kieler/elkjs), a powerful graph layout library. This could enable:

- **Alternative layout algorithms:** Layered, radial, tree (mrtree)
- **User-configurable spacing:** Component, node, and layer spacing
- **Direction control:** Left-to-right, right-to-left, top-down, bottom-up
- **Re-layout after editing:** Users could rearrange nodes and apply auto-layout

**Potential Phase 9: ELK.js Layout Integration**
```typescript
// Example: Using ELK for genealogy tree layout
layoutOptionsJson["elk.algorithm"] = "org.eclipse.elk.mrtree"; // Tree layout
layoutOptionsJson["org.eclipse.elk.direction"] = "DOWN"; // Top-down family tree
layoutOptionsJson["org.eclipse.elk.spacing.nodeNode"] = "100";
```

### Elbow Connectors

The `Elbow connectors.md` script converts arrows to right-angle elbow connectors. This could provide:

- **Cleaner orthogonal routing:** More formal genealogy chart appearance
- **Configurable routing:** Option for curved vs. elbow connectors

### Connect Elements Utility

The `Connect elements.md` script shows a pattern for connecting grouped elements:

- **Group-aware connection:** Identifies largest element in a group for connection point
- **Style inheritance:** Copies stroke properties from source element

### Box Selected Elements

The `Box Selected Elements.md` script wraps elements in a container:

- **Generation grouping:** Could be used to visually group generations
- **Family unit highlighting:** Box around nuclear family units

### Fixed Spacing

The `Fixed spacing.md` and `Fixed vertical distance.md` scripts enable:

- **Uniform node spacing:** Ensure consistent gaps between person nodes
- **Post-generation cleanup:** User can select nodes and apply uniform spacing

### Mindmap Format

The `Mindmap format.md` script provides a complete tree formatting algorithm:

- **Hierarchical layout:** Parent → children with curved connectors
- **Automatic spacing:** Calculates heights and positions children
- **Configurable curve styling:** Line curvature and connection points

This could inspire an alternative "family chart" mode distinct from the standard tree layout.

## Testing Considerations

1. **Fallback testing:** Ensure JSON approach still works when Excalidraw plugin not installed
2. **Version compatibility:** Test with multiple Excalidraw plugin versions
3. **Large trees:** Test performance with 100+ person trees
4. **Round-trip:** Generate → Edit in Excalidraw → Verify links still work

## Dependencies

- Excalidraw plugin (optional, for API features)
- No new npm dependencies required

## Related Documentation

- [Excalidraw Plugin API](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/API/attributes_functions_overview.md)
- [Canvas and Charts Implementation](../developer/implementation/canvas-and-charts.md)
- [Visual Trees User Guide](../../wiki-content/Visual-Trees.md)

## File Locations

| Component | Path |
|-----------|------|
| Current Exporter | `src/excalidraw/excalidraw-exporter.ts` |
| Type Definitions | `src/excalidraw/excalidraw-automate.d.ts` (new) |
| Wizard Integration | `src/trees/ui/unified-tree-wizard-modal.ts` |
| External Reference | `external/obsidian-excalidraw-plugin/` |
