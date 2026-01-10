# Interactive Family Chart View Architecture Decision Record

**Status:** Approved
**Date:** 2025-11-26
**Decision Makers:** Core development team
**Affects:** v0.3.x (Interactive Family Chart View feature)

---

## Context and Problem Statement

Charted Roots currently generates static canvas files for family tree visualization. While these work well for documentation and export, users need an **interactive exploration experience** for:

1. **Navigation**: Pan, zoom, click-to-focus on large trees (50+ people)
2. **Quick edits**: Add/remove relationships without leaving the visualization
3. **Exploration**: Discover relationships, trace lineages, understand complex connections
4. **Real-time feedback**: See changes immediately as data updates

The existing **Tree Preview** (modal-based, read-only) provides some interactivity but lacks:
- Persistence (closes when modal closes)
- Editing capabilities
- Bidirectional sync with notes
- Full family-chart features (kinship, history, search)

The **Canvas API** was considered but rejected (see roadmap) due to:
- No programmatic viewport control
- No event hooks for hover/click
- No API for dynamic updates

**Solution**: Create a dedicated **Obsidian ItemView** that renders the full family-chart library interactively.

---

## Decision Drivers

1. **User Experience**: Graph View-like exploration is familiar to Obsidian users
2. **Library Leverage**: family-chart provides rich features we shouldn't reimplement
3. **Bidirectional Sync**: Changes should flow both directions (chart ↔ notes)
4. **Persistence**: View should survive plugin reload, workspace changes
5. **Performance**: Large trees (500+ people) must remain responsive
6. **Maintainability**: Use native family-chart rendering, not custom SVG

---

## Options Considered

### Option A: Enhanced Modal (Rejected)

**Approach**: Extend current TreePreviewRenderer into a larger, feature-rich modal.

**Pros:**
- Reuses existing code
- Simpler implementation
- No view registration complexity

**Cons:**
- ❌ Not persistent (closes on escape/click outside)
- ❌ Can't be placed in sidebar
- ❌ Blocks workspace interaction
- ❌ No native Obsidian view features (pane menu, state persistence)
- ❌ Custom SVG rendering diverges from family-chart capabilities

**Verdict:** ❌ Rejected - Modals aren't meant for persistent exploration

---

### Option B: Native family-chart in ItemView (Selected)

**Approach**: Create ItemView that embeds family-chart directly, using its native rendering.

**Pros:**
- ✅ Full family-chart feature set (EditTree, kinship, history, search)
- ✅ Persistent (sidebar, split pane, new tab)
- ✅ Native Obsidian view integration (pane menu, state, hotkeys)
- ✅ Maintained by family-chart library (not our custom SVG)
- ✅ Graph View UX pattern (familiar to users)
- ✅ Can have multiple views open simultaneously

**Cons:**
- ⚠️ More complex implementation
- ⚠️ Need to handle D3 lifecycle within Obsidian
- ⚠️ State synchronization between chart and notes

**Verdict:** ✅ **SELECTED**

---

### Option C: React/Svelte Wrapper (Rejected)

**Approach**: Wrap family-chart in a React or Svelte component.

**Pros:**
- Better state management
- Easier reactive updates
- Modern component patterns

**Cons:**
- ❌ family-chart uses D3 directly (framework adds overhead, not value)
- ❌ Increased bundle size
- ❌ Additional build complexity
- ❌ DOM manipulation conflicts between framework and D3

**Verdict:** ❌ Rejected - D3-based library works best with direct DOM

---

## Detailed Design

### Component Architecture

```
src/
├── ui/
│   └── views/
│       ├── family-chart-view.ts      # ItemView implementation
│       ├── family-chart-toolbar.ts   # Toolbar UI component
│       └── family-chart-adapter.ts   # family-chart ↔ Charted Roots adapter
├── core/
│   └── family-chart-sync.ts          # Bidirectional sync service
```

### View Type Constant

```typescript
export const VIEW_TYPE_FAMILY_CHART = 'canvas-roots-family-chart';
```

### Class Structure

```typescript
import { ItemView, WorkspaceLeaf, Menu } from 'obsidian';
import f3 from 'family-chart';
import CanvasRootsPlugin from '../../main';

export class FamilyChartView extends ItemView {
    plugin: CanvasRootsPlugin;

    // View state
    private rootPersonId: string | null = null;
    private colorScheme: ColorScheme = 'gender';
    private editMode: boolean = false;

    // family-chart instance
    private f3Chart: any = null;
    private f3Card: any = null;
    private f3EditTree: any = null;

    // UI components
    private toolbar: FamilyChartToolbar;
    private chartContainer: HTMLElement;

    constructor(leaf: WorkspaceLeaf, plugin: CanvasRootsPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_FAMILY_CHART;
    }

    getDisplayText(): string {
        return 'Family chart';
    }

    getIcon(): string {
        return 'git-fork';  // Or custom icon
    }

    async onOpen(): Promise<void> {
        // Build UI structure
        this.buildUI();

        // Initialize chart if we have state
        if (this.rootPersonId) {
            await this.initializeChart();
        }

        // Register event handlers
        this.registerEvents();
    }

    async onClose(): Promise<void> {
        // Cleanup family-chart instance
        this.destroyChart();
    }

    // State persistence
    getState(): any {
        return {
            rootPersonId: this.rootPersonId,
            colorScheme: this.colorScheme,
            editMode: this.editMode,
        };
    }

    async setState(state: any, result: ViewStateResult): Promise<void> {
        if (state.rootPersonId) {
            this.rootPersonId = state.rootPersonId;
            await this.initializeChart();
        }
        if (state.colorScheme) {
            this.colorScheme = state.colorScheme;
        }
        if (state.editMode !== undefined) {
            this.editMode = state.editMode;
        }
    }

    // Pane menu (three-dot menu)
    onPaneMenu(menu: Menu, source: string): void {
        menu.addItem((item) => {
            item.setTitle('Refresh chart')
                .setIcon('refresh-cw')
                .onClick(() => this.refreshChart());
        });
        menu.addItem((item) => {
            item.setTitle('Export as PNG')
                .setIcon('image')
                .onClick(() => this.exportPNG());
        });
        menu.addItem((item) => {
            item.setTitle('Export as SVG')
                .setIcon('file-code')
                .onClick(() => this.exportSVG());
        });
        super.onPaneMenu(menu, source);
    }
}
```

---

## Data Flow Architecture

### 1. Notes → Chart (Initial Load)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Person Notes│────▶│ FamilyGraphService│────▶│ family-chart    │
│ (YAML)      │     │ (build graph)     │     │ data format     │
└─────────────┘     └──────────────────┘     └─────────────────┘
                                                      │
                                                      ▼
                                             ┌─────────────────┐
                                             │ f3.createChart()│
                                             │ renders SVG     │
                                             └─────────────────┘
```

### 2. Chart → Notes (User Edits)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│ EditTree form   │────▶│ f3.exportData()  │────▶│ Sync Service│
│ (user edits)    │     │ (get changes)    │     │             │
└─────────────────┘     └──────────────────┘     └──────┬──────┘
                                                        │
                                                        ▼
                                             ┌─────────────────┐
                                             │ Update YAML     │
                                             │ (frontmatter)   │
                                             └─────────────────┘
```

### 3. Notes → Chart (External Changes)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│ vault.on()      │────▶│ Debounce +       │────▶│ Diff changes│
│ 'modify' event  │     │ Filter person    │     │             │
└─────────────────┘     │ notes            │     └──────┬──────┘
                        └──────────────────┘            │
                                                        ▼
                                             ┌─────────────────┐
                                             │ f3.updateData() │
                                             │ (animate)       │
                                             └─────────────────┘
```

---

## family-chart Integration

### Data Transformation

Charted Roots person notes → family-chart format:

```typescript
interface FamilyChartPerson {
    id: string;                    // cr_id
    data: {
        'first name': string;      // Parsed from name
        'last name': string;
        gender: 'M' | 'F' | '';
        birthday?: string;         // born
        deathday?: string;         // died
        avatar?: string;           // Optional image
    };
    rels: {
        father?: string;           // father_id
        mother?: string;           // mother_id
        spouses?: string[];        // spouse_id[]
        children?: string[];       // Computed from children_id[]
    };
}

// Adapter function
function personNoteToFamilyChart(person: PersonNode): FamilyChartPerson {
    const [firstName, ...lastParts] = (person.name || '').split(' ');
    return {
        id: person.crId,
        data: {
            'first name': firstName || '',
            'last name': lastParts.join(' '),
            gender: mapGender(person.sex),
            birthday: person.born,
            deathday: person.died,
        },
        rels: {
            father: person.fatherId,
            mother: person.motherId,
            spouses: person.spouseIds || [],
            children: person.childrenIds || [],
        }
    };
}
```

### Chart Initialization

```typescript
private async initializeChart(): Promise<void> {
    // Get family data
    const people = await this.plugin.familyGraph.getAllPeople();
    const chartData = people.map(personNoteToFamilyChart);

    // Create chart
    this.f3Chart = f3.createChart(this.chartContainer, chartData)
        .setTransitionTime(800)
        .setCardXSpacing(250)
        .setCardYSpacing(150);

    // Configure cards
    this.f3Card = this.f3Chart.setCardSvg()
        .setCardDisplay([['first name', 'last name'], ['birthday']])
        .setCardDim({w: 200, h: 70, text_x: 75, text_y: 15, img_w: 60, img_h: 60, img_x: 5, img_y: 5})
        .setOnCardClick((e, d) => this.handleCardClick(e, d));

    // Set main person
    if (this.rootPersonId) {
        this.f3Chart.updateMainId(this.rootPersonId);
    }

    // Render
    this.f3Chart.updateTree({ initial: true });
}
```

### Edit Mode Integration

```typescript
private enableEditMode(): void {
    this.f3EditTree = this.f3Chart.editTree()
        .fixed(true)
        .setFields(['first name', 'last name', 'birthday', 'deathday', 'gender'])
        .setEditFirst(true);

    this.f3EditTree.setEdit();

    // Handle card clicks in edit mode
    this.f3Card.setOnCardClick((e, d) => {
        this.f3EditTree.open(d.data);
        if (this.f3EditTree.isAddingRelative()) return;
        if (this.f3EditTree.isRemovingRelative()) return;
        this.f3Card.onCardClickDefault(e, d);
    });

    // Listen for data changes
    this.f3EditTree.setOnDataChange((data) => {
        this.syncToNotes(data);
    });
}
```

---

## UI Design

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Tab: Family chart                                     [⋮] [×] │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Toolbar                                                     │ │
│ │ [Layout ▾] [Color ▾] [Ancestors ▾] [Descendants ▾]         │ │
│ │ [✎ Edit] [👥 Kinship] [⊡ Fit] [🔍 Search]                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │                                                             │ │
│ │                     [family-chart SVG]                      │ │
│ │                                                             │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Toolbar Controls

| Control | Type | Purpose |
|---------|------|---------|
| Layout | Dropdown | Standard, Compact, Hourglass, Horizontal |
| Color | Dropdown | Gender, Generation, Monochrome, Collection |
| Ancestors | Dropdown | 1, 2, 3, 5, 10, All |
| Descendants | Dropdown | 1, 2, 3, 5, 10, All |
| Edit | Toggle | Enable/disable edit mode |
| Kinship | Toggle | Show relationship labels |
| Fit | Button | Zoom to fit entire tree |
| Search | Button | Open person search overlay |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `+` / `-` | Zoom in/out |
| `0` | Fit to view |
| `E` | Toggle edit mode |
| `K` | Toggle kinship labels |
| `/` | Open search |
| `Escape` | Close edit form / exit search |

---

## Bidirectional Sync Strategy

### Chart → Notes Sync

When user edits via EditTree:

```typescript
private async syncToNotes(chartData: FamilyChartPerson[]): void {
    // Get changed person from chart
    const changedPerson = this.detectChanges(chartData);
    if (!changedPerson) return;

    // Find corresponding note
    const file = this.plugin.familyGraph.getFileById(changedPerson.id);
    if (!file) {
        // New person - create note
        await this.plugin.personWriter.createPerson({
            name: `${changedPerson.data['first name']} ${changedPerson.data['last name']}`,
            crId: changedPerson.id,
            sex: changedPerson.data.gender,
            born: changedPerson.data.birthday,
            died: changedPerson.data.deathday,
            fatherId: changedPerson.rels.father,
            motherId: changedPerson.rels.mother,
            spouseIds: changedPerson.rels.spouses,
        });
        return;
    }

    // Update existing note via RelationshipManager
    await this.plugin.relationshipManager.updatePerson(file, {
        name: `${changedPerson.data['first name']} ${changedPerson.data['last name']}`,
        sex: changedPerson.data.gender,
        born: changedPerson.data.birthday,
        died: changedPerson.data.deathday,
    });

    // Handle relationship changes
    await this.syncRelationships(file, changedPerson.rels);
}
```

### Notes → Chart Sync

When notes change externally:

```typescript
private registerEvents(): void {
    // Listen for note modifications
    this.registerEvent(
        this.app.vault.on('modify', async (file) => {
            if (!this.isPersonNote(file)) return;

            // Debounce rapid changes
            this.scheduleRefresh();
        })
    );

    // Listen for file renames (cr_id survives, but need to update)
    this.registerEvent(
        this.app.vault.on('rename', async (file, oldPath) => {
            if (!this.isPersonNote(file)) return;
            this.scheduleRefresh();
        })
    );

    // Listen for file deletions
    this.registerEvent(
        this.app.vault.on('delete', async (file) => {
            this.scheduleRefresh();
        })
    );
}

private scheduleRefresh = debounce(async () => {
    await this.refreshChart();
}, 500);
```

### Conflict Resolution

When both chart and notes change:

1. **Notes win** - Notes are source of truth
2. **Warn user** if chart has unsaved edits when external change detected
3. **Auto-merge** simple cases (non-conflicting fields)
4. **Manual resolution** for conflicts (show diff modal)

---

## State Management

### View State (Persisted)

```typescript
interface FamilyChartViewState {
    rootPersonId: string | null;
    colorScheme: ColorScheme;
    editMode: boolean;
    ancestorDepth: number;
    descendantDepth: number;
    showKinship: boolean;
    zoom: number;
    panX: number;
    panY: number;
}
```

### Ephemeral State (Not Persisted)

```typescript
interface FamilyChartEphemeralState {
    searchQuery: string;
    selectedPersonId: string | null;
    editFormDirty: boolean;
}
```

---

## Implementation Phases

### Phase 1: Basic View (MVP)

**Scope**: Read-only chart in ItemView

**Tasks**:
1. Create `FamilyChartView` extending `ItemView`
2. Register view in `main.ts`
3. Add command: "Open family chart"
4. Basic toolbar (color scheme, fit to view)
5. Data transformation (notes → family-chart format)
6. Click to open person note
7. State persistence (root person, color)

**Deliverable**: Users can explore family tree in persistent view

---

### Phase 2: Navigation & Controls

**Scope**: Full navigation and display options

**Tasks**:
1. Ancestor/descendant depth controls
2. Layout algorithm selection
3. Search overlay (person picker integration)
4. Keyboard shortcuts
5. Kinship label toggle
6. Zoom controls
7. Context menu on person cards

**Deliverable**: Full exploration capabilities

---

### Phase 3: Edit Mode

**Scope**: Bidirectional editing

**Tasks**:
1. EditTree integration
2. Add relationship forms
3. Delete person with cleanup
4. Chart → Notes sync service
5. Notes → Chart live updates
6. Edit mode toolbar toggle
7. Unsaved changes warning

**Deliverable**: Full CRUD via chart interface

---

### Phase 4: Advanced Features

**Scope**: Power user features

**Tasks**:
1. Multiple chart views (different root persons)
2. Linked views (sync focus between views)
3. Export (PNG, SVG) from view
4. History/undo integration
5. Hover tooltips with person preview
6. Custom card templates

**Deliverable**: Complete feature set matching roadmap

---

## Testing Strategy

### Unit Tests

- Data transformation (PersonNode → FamilyChartPerson)
- State serialization/deserialization
- Conflict detection
- Relationship sync logic

### Integration Tests

- View lifecycle (open, close, reopen)
- State persistence across reload
- Notes → Chart update propagation
- Chart → Notes sync with real files

### Manual Testing

- Large tree performance (500+ people)
- Edit mode workflow
- Multiple simultaneous views
- Workspace layout persistence

---

## Performance Considerations

### Large Trees

- **Trim tree**: Use `ancestry_depth` and `progeny_depth` to limit rendered nodes
- **Lazy load**: Only load full data for visible subtree
- **Virtualization**: family-chart handles this internally
- **Debounce**: Batch rapid note changes before re-render

### Memory Management

- Destroy family-chart instance on view close
- Clear event listeners properly
- Avoid holding references to removed nodes

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| family-chart breaking changes | Low | High | Pin version, test before upgrade |
| D3 conflicts with Obsidian | Low | Medium | Isolate D3 scope, use unique selectors |
| Large tree performance | Medium | Medium | Trim tree, lazy loading |
| Sync conflicts | Medium | Low | Notes win, warn user |
| Mobile compatibility | Medium | Medium | Test early, progressive enhancement |

---

## Design Decisions

1. **Edit mode default:** OFF - Prevents accidental edits; users explicitly enable when needed
2. **Card type:** SVG cards (default family-chart) - HTML cards deferred
3. **Tree Preview modal:** KEEP - Serves different purpose (quick preview before canvas generation, PNG/SVG export); Family Chart View is for ongoing exploration and editing
4. **Person avatars:** DEFERRED - Can add later if `avatar` property support is requested

---

## References

- [Obsidian ItemView Documentation](../developer/obsidian-developer-docs/en/Plugins/User%20interface/Views.md)
- [family-chart Library](https://github.com/donatso/family-chart)
- [family-chart Examples](../developer/family-chart/examples/)
- [Collections ADR](./collections.md)
- [Roadmap - Interactive Family Chart View](../roadmap.md#interactive-family-chart-view)

---

## Decision Outcome

**Chosen Option:** Option B - Native family-chart in ItemView ✅

**Rationale:**
1. Full family-chart capabilities without reimplementation
2. Native Obsidian view integration (persistence, pane menu, state)
3. Familiar UX pattern (similar to Graph View)
4. Bidirectional sync with existing note infrastructure
5. Phased implementation allows early user feedback

**Next Steps:**
1. Review and approve this ADR
2. Begin Phase 1 implementation
3. Gather user feedback on MVP
4. Iterate on Phase 2-4 based on feedback

---

**Document Version:** 1.0
**Last Updated:** 2025-11-26
**Status:** Approved
