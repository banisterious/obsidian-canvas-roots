# Canvas Navigation & Organization Implementation Plan

**Status:** Planning
**Date:** 2025-11-30
**Target Version:** v0.5.0
**Prerequisites:** None (builds on existing canvas generation)

---

## Overview

Large family trees can become unwieldy on a single canvas. This feature set provides tools for splitting trees into manageable segments and linking them together for easy navigation.

**Goals:**
- Split large canvases by branch, generation, or geography
- Create navigation nodes that link between related canvases
- Generate master overview canvases with links to detailed views
- Support ancestor/descendant canvas pairs for the same root person

---

## Current State Analysis

### Existing Canvas Generation

The plugin currently generates single monolithic canvases:
- `CanvasGenerator.generateCanvas()` creates one canvas with all nodes
- Layout engines position all nodes in a single coordinate space
- No concept of canvas-to-canvas linking
- Canvas metadata tracks generation parameters but not relationships to other canvases

### Obsidian Canvas Capabilities

Canvas files support:
- **File nodes**: Link to any file in the vault (including other `.canvas` files)
- **Text nodes**: Can contain markdown with wikilinks
- **Groups**: Visual grouping with labels and colors
- **Edge labels**: Text on connections

Canvas-to-canvas navigation:
- File nodes pointing to `.canvas` files can be clicked to open that canvas
- No "deep linking" to specific nodes within a canvas
- Position/viewport not controllable programmatically

---

## Feature Specifications

### Feature 1: Canvas Splitting

Split an existing or new tree into multiple linked canvases based on criteria.

#### 1.1 Split by Generation

Create separate canvases for generation ranges:
- Ancestors canvas (generations -4 to -1)
- Core family canvas (generations -1 to +1)
- Descendants canvas (generations +1 to +4)

**Use case:** Very deep trees where seeing all generations at once is overwhelming.

#### 1.2 Split by Branch

Create separate canvases for each major branch:
- Paternal line canvas (father's ancestors)
- Maternal line canvas (mother's ancestors)
- Per-child descendant canvases

**Use case:** Researching specific family lines independently.

#### 1.3 Single Lineage Extraction

Extract a single direct line through the generations:
- Select start person (e.g., oldest known ancestor)
- Select end person (e.g., youngest descendant)
- Include only people on the direct path between them
- Optionally include spouses of people on the line
- Optionally include siblings at each generation

**Example:** "McCasland patrilineal line" - oldest McCasland ancestor → each firstborn/specified son → youngest male McCasland, with their spouses shown.

**Use case:**
- Surname studies (following one family name through generations)
- Direct lineage documentation for heritage applications
- Simplified view focusing on one thread through a complex tree

#### 1.4 Split by Collection

Create separate canvases per user-defined collection:
- One canvas per collection
- Bridge people appear on multiple canvases
- Overview canvas shows collection relationships

**Use case:** Multi-family research projects, fictional world-building with factions.

#### 1.5 Split by Surname ✅ Implemented

Extract all people with a given surname, even without established family connections:
- Scrollable list of available surnames sorted by frequency
- Multi-surname selection for combined extraction
- One canvas per surname (or combined into single canvas)
- Optionally include spouses (with different surnames)
- Optionally match maiden names from frontmatter
- Handle spelling variants (future enhancement)

**Use cases:**
- Surname studies when connections are incomplete or unknown
- Consolidating unconnected people who share a family name
- Research projects focused on a specific surname
- Extracting people imported from different GEDCOM files that haven't been linked yet

### Feature 2: Extraction Modes

All split/extraction operations support two modes:

#### 2.1 Copy Mode (Non-destructive) - Default

- Creates new canvas(es) with the extracted portion
- Original canvas (if any) remains unchanged
- Safe for experimentation

#### 2.2 Prune Mode (Destructive)

- Creates new canvas(es) with the extracted portion
- **Removes** extracted nodes from the source canvas
- Optionally inserts a navigation node where the removed section was
- Useful for managing canvas complexity over time

**Example - Pruning a lineage:**
```
Before:                          After:
┌─────────────────────┐          ┌─────────────────────┐
│   Full Family Tree  │          │   Full Family Tree  │
│                     │          │                     │
│  ┌───┐   ┌───┐     │          │  ┌───┐   ┌───┐     │
│  │ A │───│ B │     │   ──→    │  │ A │───│ B │     │
│  └─┬─┘   └───┘     │          │  └─┬─┘   └───┘     │
│    │               │          │    │               │
│  ┌─┴─┐             │          │  ┌─┴───────────┐   │
│  │ C │ ← extracted │          │  │→ C's Line   │   │  + new "C-lineage.canvas"
│  └─┬─┘             │          │  │ (12 people) │   │    with C, D, E, F...
│    │               │          │  └─────────────┘   │
│  ┌─┴─┐             │          │                     │
│  │ D │             │          └─────────────────────┘
│  └───┘             │
└─────────────────────┘
```

**Use cases:**
- Declutter a growing canvas by archiving completed branches
- Focus main canvas on active research areas
- Split an unwieldy canvas into manageable linked pieces

#### 2.3 Associated Media Handling

When extracting or pruning, users may have attached media to person nodes on the canvas:
- Photos (images linked to a person)
- Documents (scanned records, certificates)
- Text notes (research notes, transcriptions)
- Groups containing a person and their media

**Detection strategies:**
1. **Edge-connected**: Media node has an edge connecting it to a person node
2. **Proximity-based**: Media node is within N pixels of a person node
3. **Group membership**: Media and person are in the same canvas group
4. **Naming convention**: Media filename contains person's name or cr_id

**Options in UI:**
```
┌─ Associated media ───────────────────────────────────┐
│ ☑ Include connected media (nodes with edges)         │
│ ☐ Include nearby media (within 200px)                │
│ ☑ Include grouped media (same canvas group)          │
│                                                      │
│ Found: 3 photos, 1 document linked to extracted      │
│        people                                        │
└──────────────────────────────────────────────────────┘
```

**Behavior:**
- In **Copy mode**: Media is duplicated to new canvas (original stays)
- In **Prune mode**: Media moves with the person (removed from source)
- Edges between person and media are preserved in the extracted canvas
- Groups are recreated if all members are extracted

#### 2.4 Collection/Group Tagging

Optionally tag extracted people with a collection or group name for organizational purposes.

**Options in UI:**
```
┌─ Tagging ────────────────────────────────────────────┐
│ ☐ Add to collection                                  │
│   [McCasland Patrilineal Line              ]         │
│   ○ Create new  ○ Add to existing                    │
│                                                      │
│ ☐ Set group name                                     │
│   [McCasland                               ]         │
│   (Suggested: McCasland)                             │
└──────────────────────────────────────────────────────┘
```

**Collection vs Group:**

| Feature | Collection | Group |
|---------|------------|-------|
| Property | `collection` | `group_name` |
| Purpose | User-defined research projects, cross-family topics | Family cluster organization |
| Use case | DAR application, surname study, sharing subset | Keeping branches organized |
| Visibility | Bases filtering, collection overview | Auto-detected families, canvas coloring |

**Behavior:**
- Both are optional and independent (can use neither, either, or both)
- Name suggestion based on start person's surname
- For existing collections/groups, dropdown shows available options
- Updates person note frontmatter for all extracted people

**Use cases:**
- Tag a pruned lineage as a collection for ongoing research
- Set group name to keep extracted branch identifiable
- Create a collection for a specific documentation project (heritage application)
- Regenerate canvas later from collection filter

### Feature 3: Navigation Nodes

Special nodes that link canvases together.

#### 3.1 Navigation Node Types

**Portal Node**: A styled text node indicating "continues on another canvas"
```
┌─────────────────────┐
│  → Ancestors        │
│  (4 more gens)      │
│  [Smith Ancestors]  │
└─────────────────────┘
```

**File Link Node**: An Obsidian file node pointing to another canvas
- Clicking opens the linked canvas
- Shows preview of linked canvas name

**Placeholder Node**: Indicates a person exists but is detailed elsewhere
```
┌─────────────────────┐
│  John Smith         │
│  ─────────────────  │
│  See: [Main Tree]   │
└─────────────────────┘
```

#### 3.2 Navigation Node Placement

- At generation boundaries (top/bottom of canvas)
- At branch split points
- At collection boundaries

### Feature 3: Master Overview Canvas

A high-level canvas showing the structure of related canvases.

#### 3.1 Overview Types

**Generation Overview**: Shows generation ranges as nodes
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Ancestors    │ ──→ │ Core Family  │ ──→ │ Descendants  │
│ Gen -4 to -2 │     │ Gen -1 to +1 │     │ Gen +2 to +4 │
│ 45 people    │     │ 12 people    │     │ 28 people    │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Branch Overview**: Shows family branches
```
         ┌───────────────┐
         │  Root Person  │
         │  John Smith   │
         └───────┬───────┘
           ┌─────┴─────┐
    ┌──────┴──────┐ ┌──┴───────────┐
    │ Paternal    │ │ Maternal     │
    │ Smith Line  │ │ Jones Line   │
    │ 34 people   │ │ 28 people    │
    └─────────────┘ └──────────────┘
```

**Collection Overview**: Shows collections with bridge connections (already exists partially)

#### 3.2 Overview Canvas Features

- Each node is a file link to the detailed canvas
- Shows person count per canvas
- Shows generation range or other metadata
- Optional: Shows "bridge people" connecting canvases

### Feature 4: Linked Canvas Generation

Generate related canvas sets in one operation.

#### 4.1 Ancestor + Descendant Pair

For a root person, generate:
1. `{name}-ancestors.canvas` - Pedigree chart going back
2. `{name}-descendants.canvas` - Descendant chart going forward
3. `{name}-overview.canvas` - Links both with root person as center

#### 4.2 Generation-Split Set

For a full tree, generate:
1. One canvas per N generations
2. Navigation nodes linking adjacent generation canvases
3. Overview canvas showing all generation canvases

#### 4.3 Branch-Split Set

For a root person's ancestors, generate:
1. `{name}-paternal.canvas` - Father's line
2. `{name}-maternal.canvas` - Mother's line
3. Recursive splits for each grandparent line (optional)
4. Overview canvas showing branch structure

---

## Technical Design

### New Data Structures

```typescript
// Canvas relationship metadata
interface CanvasRelationship {
    type: 'generation-split' | 'branch-split' | 'collection-split' | 'ancestor-descendant';
    relatedCanvases: RelatedCanvas[];
    overviewCanvas?: string;  // Path to overview canvas
}

interface RelatedCanvas {
    path: string;
    label: string;
    direction: 'ancestor' | 'descendant' | 'sibling' | 'parent' | 'child';
    generationRange?: [number, number];
    collection?: string;
    personCount: number;
}

// Navigation node data
interface NavigationNode {
    type: 'portal' | 'placeholder';
    targetCanvas: string;
    label: string;
    personCrId?: string;  // For placeholder nodes
    direction: 'up' | 'down' | 'left' | 'right';
}

// Extended canvas metadata
interface CanvasRootsMetadata {
    // ... existing fields ...
    relationships?: CanvasRelationship;
    navigationNodes?: NavigationNode[];
}
```

### New Services

#### CanvasSplitService

```typescript
export class CanvasSplitService {
    constructor(
        private app: App,
        private settings: CanvasRootsSettings,
        private canvasGenerator: CanvasGenerator,
        private familyGraph: FamilyGraphService
    ) {}

    /**
     * Split a tree by generation ranges
     */
    async splitByGeneration(
        rootPerson: PersonNode,
        generationsPerCanvas: number,
        options: SplitOptions
    ): Promise<SplitResult>;

    /**
     * Split a tree by family branches
     */
    async splitByBranch(
        rootPerson: PersonNode,
        options: SplitOptions
    ): Promise<SplitResult>;

    /**
     * Split existing people by collection
     */
    async splitByCollection(
        options: SplitOptions
    ): Promise<SplitResult>;

    /**
     * Generate ancestor + descendant canvas pair
     */
    async generateAncestorDescendantPair(
        rootPerson: PersonNode,
        options: SplitOptions
    ): Promise<SplitResult>;

    /**
     * Extract a single lineage between two people
     */
    async extractLineage(
        startPerson: PersonNode,
        endPerson: PersonNode,
        options: LineageOptions
    ): Promise<SplitResult>;
}

interface LineageOptions extends SplitOptions {
    includeSpouses: boolean;      // Include spouses of people on the line
    includeSiblings: boolean;     // Include siblings at each generation
    lineageDirection: 'ancestors' | 'descendants' | 'auto';  // Which direction to trace
}

// ✅ Implemented
interface SurnameSplitOptions extends Partial<SplitOptions> {
    surnames: string[];           // Surnames to extract
    includeSpouses: boolean;      // Include spouses with different surnames
    includeMaidenNames: boolean;  // Match maiden names from frontmatter
    handleVariants: boolean;      // Handle spelling variants (future)
    separateCanvases: boolean;    // One canvas per surname vs combined
}

interface SplitOptions {
    outputFolder: string;
    filenamePattern: string;
    generateOverview: boolean;
    includeNavigationNodes: boolean;
    maxGenerations?: number;

    // Destructive mode options
    sourceCanvas?: string;            // Path to existing canvas to modify
    removeFromSource: boolean;        // If true, remove extracted nodes from source canvas
    addNavigationNodeToSource: boolean; // If true, add portal node where removed section was

    // Associated media options
    includeConnectedMedia: boolean;   // Include nodes with edges to extracted people
    includeNearbyMedia: boolean;      // Include nodes within proximity threshold
    includeGroupedMedia: boolean;     // Include nodes in same canvas group as extracted people
    proximityThreshold?: number;      // Pixels for nearby detection (default: 200)

    // Tagging options
    addToCollection?: string;         // Collection name to add extracted people to
    createNewCollection?: boolean;    // If true, create collection if it doesn't exist
    setGroupName?: string;            // Group name to set on extracted people
}

interface MediaAssociation {
    mediaNodeId: string;
    personCrId: string;
    associationType: 'edge' | 'proximity' | 'group' | 'naming';
    distance?: number;  // For proximity associations
}

interface SplitResult {
    canvases: GeneratedCanvas[];
    overviewCanvas?: GeneratedCanvas;
    totalPeople: number;
}

interface GeneratedCanvas {
    path: string;
    label: string;
    personCount: number;
    generationRange?: [number, number];
}
```

#### NavigationNodeGenerator

```typescript
export class NavigationNodeGenerator {
    /**
     * Create a portal node pointing to another canvas
     */
    createPortalNode(
        targetCanvas: string,
        label: string,
        position: { x: number; y: number },
        direction: 'up' | 'down' | 'left' | 'right'
    ): CanvasTextNode;

    /**
     * Create a placeholder node for a person detailed elsewhere
     */
    createPlaceholderNode(
        person: PersonNode,
        targetCanvas: string,
        position: { x: number; y: number }
    ): CanvasTextNode;

    /**
     * Create a file link node to another canvas
     */
    createCanvasLinkNode(
        targetCanvas: string,
        position: { x: number; y: number },
        size: { width: number; height: number }
    ): CanvasFileNode;
}
```

#### OverviewCanvasGenerator

```typescript
export class OverviewCanvasGenerator {
    /**
     * Generate an overview canvas from a split result
     */
    async generateOverview(
        splitResult: SplitResult,
        options: OverviewOptions
    ): Promise<string>;  // Returns canvas path
}

interface OverviewOptions {
    title: string;
    outputPath: string;
    layoutStyle: 'horizontal' | 'vertical' | 'radial';
    showPersonCounts: boolean;
    showGenerationRanges: boolean;
}
```

### UI Components

#### Split Wizard Modal

Multi-step modal for configuring canvas splitting:

```
┌─ Split Canvas Wizard ────────────────────────────────────┐
│                                                          │
│ Step 1: Choose split method                              │
│                                                          │
│ ○ By generation (split every N generations)              │
│ ○ By branch (separate paternal/maternal lines)           │
│ ● Single lineage (direct line between two people)        │
│ ○ By collection (one canvas per collection)              │
│ ○ Ancestor + Descendant pair                             │
│ ○ By surname (extract by last name, even unconnected)    │
│                                                          │
│ ──────────────────────────────────────────────────────── │
│                                                          │
│ Step 2: Configure lineage                                │
│                                                          │
│ Start person:       [William McCasland (1820)▼]          │
│ End person:         [James McCasland (2005)  ▼]          │
│                                                          │
│ ☑ Include spouses                                        │
│ ☐ Include siblings at each generation                    │
│                                                          │
│ ┌─ Extraction mode ──────────────────────────────────┐   │
│ │ ● Copy (keep original canvas unchanged)            │   │
│ │ ○ Prune (remove from source, add navigation node)  │   │
│ │   Source canvas: [Smith-full-tree.canvas     ▼]    │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ┌─ Tagging (optional) ───────────────────────────────┐   │
│ │ ☑ Add to collection: [McCasland Line         ]     │   │
│ │   ● Create new  ○ Add to existing                  │   │
│ │ ☐ Set group name: [McCasland                 ]     │   │
│ │   (Suggested: McCasland)                           │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ Output folder:      [Family Trees            ] [📁]      │
│ Filename:           [McCasland-lineage       ]           │
│                                                          │
│ ──────────────────────────────────────────────────────── │
│                                                          │
│ Preview:                                                 │
│   Path found: 7 generations, 7 direct ancestors          │
│   With spouses: 14 people total                          │
│   • McCasland-lineage.canvas                             │
│                                                          │
│                           [Cancel]  [Back]  [Generate]   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

#### Control Center Integration

Add "Split options" section to Tree Output tab:

```
┌─ Tree Output ────────────────────────────────────────────┐
│                                                          │
│ Tree type:          [Full family tree        ▼]          │
│ Root person:        [John Smith              ▼]          │
│ Max generations:    [──────●────────] 4                  │
│                                                          │
│ ┌─ Split options ──────────────────────────────────────┐ │
│ │ ☐ Split into multiple canvases                       │ │
│ │                                                      │ │
│ │ (When checked, shows split configuration)            │ │
│ │ Split method:     [By branch               ▼]        │ │
│ │ ☑ Generate overview canvas                           │ │
│ │ ☑ Add navigation links                               │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ [Generate Tree]                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Infrastructure

**Goal:** Build the foundation for canvas splitting and navigation nodes.

1. [ ] Define data structures for canvas relationships and navigation nodes
2. [ ] Create `NavigationNodeGenerator` for creating portal/placeholder nodes
3. [ ] Extend `CanvasRootsMetadata` with relationship tracking
4. [ ] Add CSS styles for navigation nodes

**Files to create/modify:**
- `src/core/canvas-navigation.ts` (new)
- `src/core/canvas-generator.ts` (extend metadata)
- `styles/canvas-navigation.css` (new)

### Phase 2: Prune Mode Infrastructure

**Goal:** Support removing extracted nodes from source canvas.

1. [ ] Implement canvas node/edge removal by cr_id
2. [ ] Implement navigation node insertion at removal point
3. [ ] Calculate appropriate position for navigation node (centroid of removed nodes)
4. [ ] Add edge from remaining nodes to navigation node
5. [ ] Update canvas metadata to track pruned sections

**Files to create/modify:**
- `src/core/canvas-navigation.ts` (extend with prune logic)
- `src/core/canvas-generator.ts` (add node removal methods)

### Phase 3: Associated Media Detection

**Goal:** Identify and include media nodes associated with extracted people.

1. [ ] Implement edge-based media detection (nodes connected to person nodes)
2. [ ] Implement proximity-based detection (nodes within N pixels)
3. [ ] Implement group-based detection (nodes sharing canvas group)
4. [ ] Create `MediaAssociationService` to find all associated media
5. [ ] Add media options to split UI with preview counts
6. [ ] Handle media node relocation (copy or move based on mode)

**Files to create/modify:**
- `src/core/media-association.ts` (new)
- `src/core/canvas-split.ts` (integrate media handling)

### Phase 4: Generation-Based Splitting

**Goal:** Split trees by generation ranges.

1. [ ] Create `CanvasSplitService` with `splitByGeneration()` method
2. [ ] Implement generation range calculation and node assignment
3. [ ] Generate navigation nodes at generation boundaries
4. [ ] Add "Split by generation" option to Control Center

**Files to create/modify:**
- `src/core/canvas-split.ts` (new)
- `src/ui/control-center.ts` (add split options)

### Phase 5: Branch-Based Splitting

**Goal:** Split trees by family branches.

1. [ ] Implement `splitByBranch()` method
2. [ ] Implement paternal/maternal line extraction
3. [ ] Handle recursive branch splitting (grandparent lines)
4. [ ] Add "Split by branch" option to Control Center

**Files to modify:**
- `src/core/canvas-split.ts`
- `src/ui/control-center.ts`

### Phase 6: Overview Canvas Generation

**Goal:** Generate master overview canvases.

1. [ ] Create `OverviewCanvasGenerator` service
2. [ ] Implement horizontal/vertical overview layouts
3. [ ] Add canvas file nodes with metadata display
4. [ ] Connect overview to split workflow

**Files to create/modify:**
- `src/core/overview-canvas.ts` (new)
- `src/core/canvas-split.ts`

### Phase 7: Single Lineage Extraction

**Goal:** Extract a direct line between two people (e.g., surname line).

1. [ ] Implement pathfinding between two people in family graph
2. [ ] Implement `extractLineage()` method with spouse/sibling options
3. [ ] Add UI for selecting start and end person
4. [ ] Add "Extract lineage" option to Control Center and context menu

**Files to modify:**
- `src/core/canvas-split.ts`
- `src/core/family-graph.ts` (add pathfinding if not present)
- `src/ui/control-center.ts`

### Phase 8: Ancestor-Descendant Pairs

**Goal:** Generate linked ancestor + descendant canvas pairs.

1. [ ] Implement `generateAncestorDescendantPair()` method
2. [ ] Create center-focused overview with bidirectional links
3. [ ] Add dedicated command for pair generation

**Files to modify:**
- `src/core/canvas-split.ts`
- `src/main.ts` (add command)

### Phase 9: Split Wizard UI ✅ Complete

**Goal:** Full-featured split configuration modal.

1. [x] Create `SplitWizardModal` with multi-step flow
2. [x] Add preview of generated canvases
3. [x] Implement all split methods in wizard (generation, branch, lineage, collection, ancestor-descendant, **surname**)
4. [x] Add context menu integration

**Files created/modified:**
- `src/ui/split-wizard-modal.ts` (new)
- `src/core/canvas-split.ts` (new)
- `src/main.ts` (context menus)
- `styles/canvas-navigation.css` (new)

**Note:** The surname split method was added as a sixth split type, allowing extraction of people by surname even without established family connections. This is useful for consolidating unconnected GEDCOM imports or surname-focused research.

### Phase 10: Collection-Based Splitting

**Goal:** Split by user-defined collections.

1. [ ] Implement `splitByCollection()` method
2. [ ] Handle bridge people (appear on multiple canvases)
3. [ ] Generate collection relationship overview
4. [ ] Integrate with existing collection overview feature

**Files to modify:**
- `src/core/canvas-split.ts`
- `src/ui/split-wizard-modal.ts`

---

## UI/UX Considerations

### Navigation Node Styling

Navigation nodes should be visually distinct:
- Different background color (subtle blue/purple tint)
- Arrow icon indicating direction (↑ ancestors, ↓ descendants)
- Clear label indicating destination
- Consistent size and positioning

### Canvas Naming Convention

Default naming pattern: `{rootName}-{splitType}-{identifier}`

Examples:
- `John Smith-ancestors.canvas`
- `John Smith-descendants.canvas`
- `John Smith-paternal.canvas`
- `John Smith-gen-1-to-4.canvas`
- `Smith Family-overview.canvas`

### Navigation Flow

Users should be able to:
1. Click navigation node → opens linked canvas
2. From overview, click any segment → opens that canvas
3. Each canvas has "back to overview" navigation node
4. Breadcrumb-style context (optional): "Overview > Paternal > Great-grandparents"

---

## Edge Cases and Considerations

### Duplicate People Across Canvases

When splitting by branch, some people may appear in multiple branches (e.g., a person who married into two different lines). Options:
1. **Placeholder nodes**: Show person once in detail, placeholders elsewhere
2. **Full duplication**: Show person fully on each canvas (simpler but redundant)
3. **Configurable**: Let user choose behavior

**Recommendation:** Default to placeholder nodes with option to duplicate.

### Canvas Regeneration

When regenerating a split canvas set:
- Detect existing related canvases via metadata
- Offer to regenerate entire set or single canvas
- Preserve navigation node positions if possible
- Update overview canvas automatically

### Large Trees

For very large trees (1000+ people):
- Warn user about potential performance issues
- Suggest more aggressive splitting (smaller generation ranges)
- Consider lazy loading in overview (show counts, load on demand)

### Missing Relationships

When splitting by branch but relationships are incomplete:
- People with unknown parents go to "unplaced" group
- Offer to include unplaced people in overview or separate canvas
- Show warning about incomplete data

---

## Testing Checklist

### Unit Tests

- [ ] NavigationNodeGenerator creates correct node structures
- [ ] Generation range calculation handles edge cases
- [ ] Branch extraction correctly separates paternal/maternal
- [ ] Metadata serialization/deserialization works correctly

### Integration Tests

- [ ] Split by generation creates correct number of canvases
- [ ] Navigation nodes point to correct canvases
- [ ] Overview canvas includes all split canvases
- [ ] Regeneration preserves relationships

### Manual Testing

- [ ] Generate split canvases for small tree (< 20 people)
- [ ] Generate split canvases for medium tree (50-100 people)
- [ ] Test navigation between canvases
- [ ] Verify overview canvas layout
- [ ] Test with incomplete data (missing parents, etc.)
- [ ] Test on mobile (navigation node clicking)

---

## Future Enhancements

After initial implementation:

1. **Geographic splitting**: Split by birth/death locations
2. **Time-based splitting**: Split by century or time period
3. **Custom split criteria**: User-defined rules for splitting
4. **Canvas linking UI**: Visual tool for manually linking existing canvases
5. **Deep linking**: If Obsidian adds support, link to specific nodes within canvases
6. **Animated transitions**: Smooth zoom/pan when navigating between canvases

---

## Open Questions

1. **Navigation node appearance**: Should navigation nodes use text nodes (more customizable) or file nodes (native canvas linking)?
   - Recommendation: Text nodes for portals (custom styling), file nodes for overview (native preview)

2. **Bi-directional navigation**: Should every canvas have "back" links, or only forward links from overview?
   - Recommendation: Include back-to-overview link on each canvas

3. **Split granularity**: What's the minimum useful canvas size? Should we prevent splits that result in < 5 people per canvas?
   - Recommendation: Warn but allow (user knows their use case)

4. **Existing canvas handling**: When generating split set, what to do with existing single canvas?
   - Recommendation: Keep it (don't delete), offer to archive or replace

---

## References

- [Obsidian Canvas JSON Spec](https://jsoncanvas.org/)
- Existing canvas generation: `src/core/canvas-generator.ts`
- Existing layout engines: `src/core/*-layout.ts`
- Collection overview (partial prior art): `src/core/canvas-generator.ts::generateCollectionOverview()`
