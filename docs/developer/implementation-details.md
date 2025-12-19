# Implementation Details

This document covers technical implementation specifics for Canvas Roots features.

## Table of Contents

- [Note Types and Entity System](#note-types-and-entity-system)
  - [Core Entity Types](#core-entity-types)
  - [Type Detection](#type-detection)
  - [Cross-References Between Types](#cross-references-between-types)
- [Context Menu Implementation](#context-menu-implementation)
- [Canvas Generation Implementation](#canvas-generation-implementation)
- [Family Chart Layout System](#family-chart-layout-system)
  - [Layout Engines](#layout-engines)
  - [Layout Selection](#layout-selection)
  - [Tree Generation Flow](#tree-generation-flow)
- [Dual Storage System](#dual-storage-system)
- [Maps System](#maps-system)
  - [Coordinate Systems](#coordinate-systems)
  - [Data Flow](#data-flow)
  - [Custom Image Maps](#custom-image-maps)
  - [Geocoding](#geocoding)
- [Obsidian Bases Integration](#obsidian-bases-integration)
  - [Base Templates](#base-templates)
  - [Property Aliases](#property-aliases)
  - [Base Creation Flow](#base-creation-flow)
- [Property and Value Alias System](#property-and-value-alias-system)
  - [Property Aliases](#property-aliases-1)
  - [Value Aliases](#value-aliases)
  - [Built-in Synonyms](#built-in-synonyms)
  - [Integration Points](#integration-points)
- [Statistics and Reports System](#statistics-and-reports-system)
  - [Statistics Architecture](#statistics-architecture)
  - [Metrics Computed](#metrics-computed)
  - [Report Types](#report-types)
  - [UI Integration](#ui-integration)
- [Privacy and Gender Identity Protection](#privacy-and-gender-identity-protection)
  - [Sex vs Gender Data Model](#sex-vs-gender-data-model)
  - [Living Person Privacy](#living-person-privacy)
  - [Log Export Obfuscation](#log-export-obfuscation)
  - [Planned Features](#planned-features-not-yet-implemented)

---

## Note Types and Entity System

Canvas Roots uses a structured entity system with typed notes identified by frontmatter properties.

### Core Entity Types

Seven primary entity types plus three system types:

| Type | Purpose | Key Properties |
|------|---------|----------------|
| **Person** | Individual genealogical records | `name`, `born`, `died`, `father`, `mother`, `spouse`, `children`, `sex` |
| **Place** | Geographic locations (real, historical, fictional) | `name`, `place_type`, `place_category`, `parent_place`, `coordinates_lat/long` |
| **Event** | Timeline events (vital, life, narrative) | `title`, `event_type`, `date`, `person`, `place` |
| **Source** | Evidence and documentation | `title`, `source_type`, `source_quality`, `source_repository` |
| **Organization** | Groups and hierarchies | `name`, `org_type`, `parent_org`, `seat`, `founded`, `dissolved` |
| **Universe** | Fictional world containers | `name`, `description`, `default_calendar`, `default_map`, `status` |
| **Map** | Custom image maps for fictional worlds | `name`, `universe`, `image_path`, `coordinate_system`, bounds |

**System types:** Schema (validation), Proof_summary (research), Timeline-export

```mermaid
graph TB
    subgraph "Core Entities"
        Person[Person<br/>Genealogical records]
        Place[Place<br/>Locations]
        Event[Event<br/>Timeline events]
        Source[Source<br/>Evidence]
        Organization[Organization<br/>Groups]
    end

    subgraph "World-Building"
        Universe[Universe<br/>Fictional worlds]
        Map[Map<br/>Custom image maps]
    end

    subgraph "System Types"
        Schema[Schema]
        Proof[Proof_summary]
        Timeline[Timeline-export]
    end

    Universe --> Map
    Universe -.-> Place
    Universe -.-> Organization
    Universe -.-> Event
```

### Type Detection

Notes are identified by frontmatter properties with configurable priority:

```typescript
// Detection priority (from src/utils/note-type-detection.ts)
1. cr_type property (recommended, namespaced to avoid conflicts)
2. type property (legacy support)
3. Tags (#person, #place, etc.) if tag detection enabled
```

**Identification properties:**
- `cr_id` - Unique identifier (UUID recommended), survives file renames
- `cr_type` - Type identifier: `person`, `place`, `event`, `source`, `organization`, `universe`, `map`

**Dual storage for relationships** (see [Dual Storage System](#dual-storage-system)):
```yaml
father: "[[John Smith]]"      # Wikilink for Obsidian features
father_id: abc-123-def-456    # cr_id for reliable resolution
```

### Person Note Structure

```yaml
cr_id: [string]
cr_type: person
name: [string]

# Biological parents
father: [wikilink]
father_id: [string]
mother: [wikilink]
mother_id: [string]

# Extended family (can be arrays)
stepfather: [wikilink | wikilink[]]
stepmother: [wikilink | wikilink[]]
adoptive_father: [wikilink]
adoptive_mother: [wikilink]

# Spouses and children
spouse: [wikilink | wikilink[]]
spouse_id: [string]
children: [wikilink[]]

# Demographics
sex: M | F | X | U           # GEDCOM-compatible
gender_identity: [string]     # Free-form identity

# Key dates and places
born: [date string]
died: [date string]
birth_place: [wikilink to Place]
death_place: [wikilink to Place]

# Research tracking
sourced_facts:
  birth_date:
    sources: [wikilink[]]
  # ... other facts
```

### Place Note Structure

```yaml
cr_id: [string]
cr_type: place
name: [string]

# Classification
place_type: planet | continent | country | state | city | town | village | ...
place_category: real | historical | disputed | legendary | mythological | fictional

# Hierarchy
parent_place: [wikilink to Place]
parent_place_id: [string]

# Coordinates
coordinates_lat: [number]      # Real-world
coordinates_long: [number]
custom_coordinates_x: [number] # Custom map
custom_coordinates_y: [number]
custom_coordinates_map: [string]

# World-building
universe: [wikilink to Universe]
```

### Event Note Structure

```yaml
cr_id: [string]
cr_type: event
title: [string]
event_type: [string]           # See event types below

# Temporal
date: [date string]
date_end: [date string]
date_precision: exact | month | year | decade | estimated | range | unknown

# Participants and location
person: [wikilink to Person]
persons: [wikilink[]]
place: [wikilink to Place]

# Documentation
sources: [wikilink[]]
confidence: high | medium | low | unknown

# Fictional
universe: [wikilink to Universe]
date_system: [calendar id]
is_canonical: [boolean]
```

**Event types (23 built-in):**
- **Vital:** birth, death, marriage, divorce
- **Life:** residence, occupation, military, immigration, education, burial, baptism, confirmation, ordination
- **Narrative:** anecdote, lore_event, plot_point, flashback, foreshadowing, backstory, climax, resolution

### Source Note Structure

```yaml
cr_id: [string]
cr_type: source
title: [string]
source_type: [string]          # See source types below
source_quality: primary | secondary | derivative

# Repository
source_repository: [string]
source_repository_url: [string]
source_collection: [string]

# Dates
source_date: [date string]
source_date_accessed: [date string]

# Media
media: [wikilink | wikilink[]]
confidence: high | medium | low | unknown
```

**Source types (15 built-in):** vital_record, obituary, census, church_record, court_record, land_deed, probate, military, immigration, photo, correspondence, newspaper, oral_history, custom

### Organization Note Structure

```yaml
cr_id: [string]
cr_type: organization
name: [string]
org_type: noble_house | guild | corporation | military | religious | political | educational | custom

# Hierarchy
parent_org: [wikilink to Organization]
seat: [wikilink to Place]

# Timeline
founded: [date string]
dissolved: [date string]

# World-building
universe: [wikilink to Universe]
```

**Membership tracking** (in Person notes):
```yaml
memberships:
  - org: "[[House Stark]]"
    org_id: [string]
    role: [string]
    from: [date]
    to: [date]
```

### Cross-References Between Types

The entity system uses wikilinks for Obsidian integration plus `_id` fields for reliable resolution:

```mermaid
erDiagram
    Person ||--o{ Person : "father/mother/spouse/children"
    Person }o--o{ Place : "birth_place/death_place"
    Person }o--o{ Source : "sourced_facts"
    Person }o--o{ Organization : "memberships"

    Event }o--|| Person : "person/persons"
    Event }o--o| Place : "place"
    Event }o--o{ Source : "sources"
    Event }o--o| Universe : "universe"

    Place ||--o{ Place : "parent_place"
    Place }o--o| Universe : "universe"

    Organization ||--o{ Organization : "parent_org"
    Organization }o--o| Place : "seat"
    Organization }o--o| Universe : "universe"

    Universe ||--o{ Map : "default_map"
    Map }o--|| Universe : "universe"
```

| From | To | Properties |
|------|-----|------------|
| Person | Person | `father`, `mother`, `spouse`, `children`, stepparents, adoptive parents |
| Person | Place | `birth_place`, `death_place` |
| Person | Source | `sourced_facts.*.sources` |
| Person | Organization | `memberships[].org` |
| Event | Person | `person`, `persons` |
| Event | Place | `place` |
| Event | Source | `sources` |
| Event | Universe | `universe` |
| Place | Place | `parent_place` (hierarchy: Country → State → City) |
| Place | Universe | `universe` (for fictional places) |
| Organization | Organization | `parent_org` |
| Organization | Place | `seat` |
| Organization | Universe | `universe` |
| Map | Universe | `universe` |
| Universe | Map | `default_map` |

**Type definitions:** `src/types/frontmatter.ts`, `src/*/types/*-types.ts`

---

## Context Menu Implementation

### File Menu Integration

The plugin adds context menu items when right-clicking on files. The implementation uses nested submenus on desktop and flat menus on mobile for better UX.

**Basic Pattern in main.ts:**

```typescript
this.registerEvent(
  this.app.workspace.on('file-menu', (menu, file) => {
    // Desktop: use nested submenus; Mobile: use flat menu with prefixes
    const useSubmenu = Platform.isDesktop && !Platform.isMobile;

    if (file instanceof TFile && file.extension === 'md') {
      const cache = this.app.metadataCache.getFileCache(file);
      const hasCrId = !!cache?.frontmatter?.cr_id;

      if (hasCrId) {
        menu.addSeparator();

        if (useSubmenu) {
          menu.addItem((item) => {
            const submenu: Menu = item
              .setTitle('Canvas Roots')
              .setIcon('git-fork')
              .setSubmenu();

            // Add submenu items...
            submenu.addItem((subItem) => {
              subItem
                .setTitle('Generate Canvas tree')
                .setIcon('layout')
                .onClick(() => {
                  const modal = new ControlCenterModal(this.app, this);
                  modal.openWithPerson(file);
                });
            });
          });
        } else {
          // Mobile: flat menu with prefix
          menu.addItem((item) => {
            item
              .setTitle('Canvas Roots: Generate family tree')
              .setIcon('git-fork')
              .onClick(() => {
                const modal = new ControlCenterModal(this.app, this);
                modal.openWithPerson(file);
              });
          });
        }
      }
    }
  })
);
```

**ControlCenterModal.openWithPerson() in control-center.ts:**

```typescript
public openWithPerson(file: TFile): void {
  const cache = this.app.metadataCache.getFileCache(file);
  if (!cache?.frontmatter?.cr_id) {
    new Notice('This note does not have a cr_id field');
    return;
  }

  const crId = cache.frontmatter.cr_id;
  const name = cache.frontmatter.name || file.basename;

  // Store person info for the tab to use when it renders
  this.pendingRootPerson = {
    name,
    crId,
    birthDate: cache.frontmatter.born,
    deathDate: cache.frontmatter.died,
    file
  };

  // Open to Tree Output tab (combines open + tab switch)
  this.openToTab('tree-generation');
}
```

**Note:** The actual implementation in main.ts is more comprehensive, with separate handling for:
- Canvas files (regenerate, export, statistics)
- Person notes (generate tree, add relationships, reference numbers)
- Place notes (geocode, view on map)
- Source/Event/Organization notes
- Schema notes
- Folders (import/export, statistics)

---

## Canvas Generation Implementation

### Canvas Node ID Format

Canvas nodes require alphanumeric IDs without special characters (dashes, underscores, etc.). The plugin generates these using `Math.random().toString(36)`:

```typescript
// Good: alphanumeric only
"6qi8mqi3quaufgk0imt33f"

// Bad: contains dashes (not movable in Obsidian)
"qjk-453-lms-042"
```

**Implementation:** The canvas generator maintains a mapping from `cr_id` (person identifier) to `canvasId` (canvas node identifier) to ensure edges connect correctly while using Obsidian-compatible IDs.

### Canvas JSON Format

Obsidian Canvas requires a specific JSON format:

1. **Tab indentation** (`\t`) for structure
2. **Compact objects** - each node/edge on a single line with no spaces after colons/commas
3. **Required metadata** - version and frontmatter fields

Example:
```json
{
	"nodes":[
		{"id":"abc123","type":"file","file":"Person.md","x":0,"y":0,"width":250,"height":120}
	],
	"edges":[],
	"metadata":{
		"version":"1.0-1.0",
		"frontmatter":{}
	}
}
```

**Implementation:** Custom `formatCanvasJson()` method in `control-center.ts` ensures exact format match.

### Known Issues & Solutions

#### Issue: Canvas nodes not movable/resizable
**Cause:** Canvas node IDs contained dashes (e.g., `qjk-453-lms-042`)
**Solution:** Generate alphanumeric-only IDs matching Obsidian's format
**Fixed in:** `canvas-generator.ts` - `generateNodeId()` method

#### Issue: Canvas cleared on close/reopen
**Cause:** JSON formatting didn't match Obsidian's exact requirements
**Solution:** Implement custom JSON formatter with tabs and compact objects
**Fixed in:** `control-center.ts` - `formatCanvasJson()` method

#### Issue: Race condition when opening canvas
**Cause:** Canvas opened before file system write completed
**Solution:** Add 100ms delay before opening canvas file
**Fixed in:** `control-center.ts` and `main.ts` - canvas opening logic

#### Issue: GEDCOM import only shows root person in tree
**Cause:** GEDCOM importer's second pass replaced IDs in wrong fields (father/mother/spouse instead of father_id/mother_id/spouse_id)
**Solution:** Update regex patterns to target correct _id fields with dual storage
**Fixed in:** `gedcom-importer.ts` - Phase 2 ID replacement logic

---

## Family Chart Layout System

The family chart generation system transforms person notes into interactive family tree visualizations through multiple layout engines.

### Architecture Overview

```
Person Notes (YAML frontmatter)
         ↓
FamilyGraphService (build graph from notes)
         ↓
FamilyTree (graph structure: nodes + edges)
         ↓
Layout Engine Selection (based on layoutType)
         ↓
LayoutResult (positioned nodes)
         ↓
TreePreviewRenderer (SVG) OR CanvasGenerator (Canvas JSON)
```

### Layout Engines

Canvas Roots implements four distinct layout algorithms:

#### Family-Chart Layout (`src/core/family-chart-layout.ts`)

The default layout for standard and compact trees. Uses the external `family-chart` library's D3-based algorithm.

**Key features:**
- Handles spouse relationships correctly (unlike standard D3 hierarchical trees)
- Positions root person as topmost ancestor using intelligent ancestor scoring
- Handles missing people (siblings-in-law, etc.) not positioned by family-chart

**Ancestor selection logic** (`findTopAncestor()`):
- Scores ancestors by descendant count
- Huge bonus (10,000 points) if root person is a descendant
- Connection bonuses for different family lines

**Missing spouse handling:**
1. Check if spouse is positioned in layout
2. If not, position next to their partner at same Y level
3. Use 1.5x spacing multiplier for consistent placement

**Spacing configuration:**
```typescript
const DEFAULT_LAYOUT = {
    nodeSpacingX: 1200,  // Large due to Canvas name labels above nodes
    nodeSpacingY: 250,
    nodeWidth: 250,
    nodeHeight: 120
};
```

#### Timeline Layout (`src/core/timeline-layout.ts`)

Creates chronological timelines showing family members by birth year.

- X-axis: Birth year (horizontal timeline)
- Y-axis: Generation level (for collision avoidance)
- Scales years: `pixelsPerYear = spacing / 10` (10 years = one spacing unit)
- Estimates positions for people without birth dates based on parents/children
- Falls back to generation-based layout if no dates available

#### Hourglass Layout (`src/core/hourglass-layout.ts`)

Focuses on a single person with ancestors above and descendants below.

- Root person at center (Y = 0)
- Ancestors above (negative Y coordinates)
- Descendants below (positive Y coordinates)
- Each generation centered horizontally

**Centering formula:**
```typescript
totalWidth = (numPeople - 1) * horizontalSpacing;
startX = -totalWidth / 2;
x = startX + (index * spacing);
```

#### Standard D3 Layout (`src/core/layout-engine.ts`)

Fallback hierarchical layout for large trees (>200 people).

- Uses D3-hierarchy's `tree()` function
- Simpler algorithm, faster for very large trees
- Separation ratio: 1x for same parents, 1.5x for different parents

### Layout Selection

```typescript
// In CanvasGenerator.generateCanvas()
const layoutType = options.layoutType ?? 'standard';
const isLargeTree = familyTree.nodes.size > 200;

if (layoutType === 'timeline') {
    → TimelineLayoutEngine
} else if (layoutType === 'hourglass') {
    → HourglassLayoutEngine
} else if (useFamilyChartLayout && !isLargeTree) {
    → FamilyChartLayoutEngine (standard/compact)
} else {
    → D3 LayoutEngine (large trees or fallback)
}
```

**Compact layout** is not a separate engine but a 50% spacing multiplier applied to the standard layout:
```typescript
if (layoutType === 'compact') {
    layoutOptions.nodeSpacingX *= 0.5;
    layoutOptions.nodeSpacingY *= 0.5;
}
```

### Tree Generation Flow

1. **User selects root person** → PersonPickerModal returns cr_id
2. **FamilyGraphService builds tree** from person notes:
   ```typescript
   const familyTree = familyGraphService.generateTree({
       rootCrId: selectedPersonId,
       treeType: 'descendants',  // or 'ancestors', 'full'
       maxGenerations: 5,
       includeSpouses: true
   });
   ```
3. **Layout engine calculates positions** → Returns `LayoutResult`
4. **Output generation:**
   - **Interactive preview** (`TreePreviewRenderer`): SVG with pan/zoom, tooltips, color schemes
   - **Canvas export** (`CanvasGenerator`): Obsidian Canvas JSON with metadata for smart re-layout

### Key Data Structures

```typescript
interface FamilyTree {
    root: PersonNode;
    nodes: Map<string, PersonNode>;  // crId → PersonNode
    edges: FamilyEdge[];
}

interface LayoutResult {
    positions: NodePosition[];
    options: Required<LayoutOptions>;
}

interface NodePosition {
    crId: string;
    person: PersonNode;
    x: number;
    y: number;
    generation?: number;
}
```

### Interactive Preview

`TreePreviewRenderer` (`src/ui/tree-preview.ts`) provides:
- **Zoom**: Mouse wheel (0.1x to 5x scale)
- **Pan**: Click + drag
- **Hover**: Tooltips with name, dates, generation
- **Color schemes**: sex (M=green, F=purple), generation (rainbow), monochrome
- **Export**: PNG, SVG, PDF
- **Node scaling**: Preview nodes are 40% of actual size for better overview

### Canvas Metadata

Generated canvases embed metadata for smart re-layout:
```typescript
interface CanvasRootsMetadata {
    plugin: 'canvas-roots',
    generation: {
        rootCrId, rootPersonName, treeType,
        maxGenerations, includeSpouses, direction, timestamp
    },
    layout: {
        nodeWidth, nodeHeight, nodeSpacingX, nodeSpacingY, layoutType
    }
}
```

---

## Dual Storage System

The plugin implements a **dual storage pattern** for relationships to balance Obsidian features with reliable resolution:

### Frontmatter Structure

```yaml
---
cr_id: abc-123-def-456
name: John Smith
father: "[[Dad Smith]]"      # Wikilink (enables Obsidian features)
father_id: xyz-789-uvw-012   # cr_id (enables reliable resolution)
mother: "[[Mom Smith]]"
mother_id: pqr-345-stu-678
spouse:
  - "[[Jane Doe]]"
spouse_id:
  - mno-901-jkl-234
children:
  - "[[Child 1]]"
  - "[[Child 2]]"
children_id:
  - def-456-ghi-789
  - abc-123-xyz-456
---
```

### Benefits

1. **Wikilinks** (father/mother/spouse/children): Enable Obsidian's link graph, backlinks, and hover previews
2. **ID fields** (_id suffix): Provide reliable resolution that survives file renames

### Implementation

- **bidirectional-linker.ts**: Creates/updates both wikilink and _id fields when syncing relationships
- **family-graph.ts**: Reads from _id fields first, falls back to wikilink resolution for legacy support
- **gedcom-importer.ts**: Two-pass import: creates wikilinks in first pass, replaces with cr_ids in _id fields in second pass

---

## Maps System

The maps module (`src/maps/`) provides interactive geographic visualization using Leaflet, supporting both real-world maps and custom fictional/historical image maps.

### Architecture

```
src/maps/
├── map-controller.ts          # Core Leaflet map management
├── map-view.ts                # ItemView UI for map rendering
├── map-data-service.ts        # Data preparation from notes
├── image-map-manager.ts       # Custom image map handling
├── types/
│   ├── map-types.ts          # Type definitions
│   └── leaflet-plugins.d.ts   # Plugin type declarations
├── services/
│   └── geocoding-service.ts   # OpenStreetMap Nominatim integration
└── ui/
    └── bulk-geocode-modal.ts  # Batch geocoding UI
```

### Coordinate Systems

The system supports two coordinate modes:

**Geographic mode** (default): Standard lat/lng coordinates for real-world maps
```yaml
coordinate_system: geographic
bounds_north: 50
bounds_south: -50
bounds_west: -100
bounds_east: 100
```

**Pixel mode**: Direct pixel coordinates with `L.CRS.Simple` for custom image maps
```yaml
coordinate_system: pixel
image_width: 2048
image_height: 3072
center_x: 1024
center_y: 1536
```

**CRS switching**: When changing between OpenStreetMap and pixel-based custom maps, the entire Leaflet map is destroyed and recreated (Leaflet doesn't support dynamic CRS changes).

### Data Flow

```
Place Notes (with coordinates)
         ↓
    Place Cache (by cr_id and name)
         ↓
Person Notes (with place references)
         ↓
    MapDataService.prepareMapData()
         ↓
    ┌────────────────┬─────────────────┐
    ↓                ↓                 ↓
 Markers      MigrationPaths     JourneyPaths
    ↓                ↓                 ↓
    └────────────────┴─────────────────┘
                     ↓
              MapController
                     ↓
           Leaflet Rendering
```

**Marker types:**
- Core life events: birth, death, marriage, burial
- Additional events: residence, occupation, education, military, immigration, religious events

**Path types:**
- **MigrationPath**: Birth → death location for a person
- **JourneyPath**: All life events chronologically ordered
- **AggregatedPath**: Grouped paths for visualization weight (shows travel flow intensity)

**Place resolution** (`MapDataService`):
1. Try cr_id lookup first (fastest)
2. Fall back to case-insensitive name lookup
3. Support partial matching ("Paris" finds "Paris, France")
4. Handle wikilink extraction from references

### Layer Management

`MapController` organizes markers into separate cluster groups:

```typescript
// Separate cluster groups by event type
birthMarkers: MarkerClusterGroup
deathMarkers: MarkerClusterGroup
marriageMarkers: MarkerClusterGroup
burialMarkers: MarkerClusterGroup
additionalMarkers: MarkerClusterGroup  // All other event types

// Path layers
pathLayer: LayerGroup      // Migration paths
journeyLayer: LayerGroup   // Full journey paths
heatLayer: HeatLayer       // Location density visualization
```

**Leaflet plugins used:**
- `leaflet.markercluster` - Clusters markers at various zoom levels
- `leaflet.heat` - Density heat maps
- `leaflet-polylinedecorator` - Arrow decorations on paths
- `leaflet-textpath` - Labels along paths
- `leaflet-fullscreen` - Fullscreen mode
- `leaflet-minimap` - Overview map
- `leaflet-search` - Place name search

### Custom Image Maps

`ImageMapManager` handles fictional worlds and historical maps.

**Map note frontmatter:**
```yaml
type: map
map_id: middle-earth
name: Middle-earth
universe: tolkien
image: path/to/image.jpg
coordinate_system: pixel  # or geographic
image_width: 2048
image_height: 3072
```

**Edit mode features:**
- Distortable image overlay (leaflet-distortableimage)
- Corner manipulation for alignment
- Corners saved to frontmatter (flat format for Obsidian Properties)
- Restore/reset functionality

**Property format support:**
- Flat format (preferred): `bounds_north`, `corner_nw_lat`
- Nested format (legacy): `bounds: {north: 50}`
- Automatic fallback between formats

### Geocoding

`GeocodingService` integrates with OpenStreetMap's Nominatim API.

**Features:**
- Single place lookup
- Bulk geocoding with rate limiting (1 request/second per Nominatim policy)
- Progress reporting and cancellation support
- Skips places that already have coordinates

**Implementation:**
```typescript
// User-Agent required by Nominatim
headers: { 'User-Agent': 'Canvas Roots Obsidian Plugin' }

// Updates place notes with flat property format
coordinates_lat: 48.8566
coordinates_long: 2.3522
```

### Time Slider

The map view includes a time slider for temporal filtering:

**Modes:**
- "Alive in year" (snapshot) - Shows people alive during selected year
- "Born by year" (cumulative) - Shows people born up to selected year

**Implementation:**
- Maintains original full dataset (`currentMapData`)
- Filters for display without changing source
- Animation loops through years with configurable speed
- Live count updates during filtering

---

## Obsidian Bases Integration

Canvas Roots generates `.base` files for Obsidian's database-like Bases feature (Obsidian 1.9.0+), providing pre-configured table views for genealogical data.

### Base Templates

Six base templates are available in `src/constants/`:

| Base | Template File | Key Properties | Views |
|------|--------------|----------------|-------|
| People | `base-template.ts` | name, cr_id, born, died, father, mother, spouse | 22 views |
| Places | `places-base-template.ts` | name, place_type, coordinates, parent_place | 11 views |
| Events | `events-base-template.ts` | title, event_type, date, person, place | 18 views |
| Sources | `sources-base-template.ts` | name, source_type, confidence, media | 15 views |
| Organizations | `organizations-base-template.ts` | name, org_type, parent_org, founded | 12 views |
| Universes | `universes-base-template.ts` | name, status, author, genre | 10 views |

**Template structure:**
```yaml
visibleProperties: [...]
summaries: {...}
filters: {...}
formulas: {...}
properties: {...}
views: [...]
```

**Data type identification:** Bases filter by `cr_type` property:
- People base: `cr_type == "person"`
- Places base: `cr_type == "place"`
- etc.

### Computed Formulas

Templates include computed properties using Obsidian's formula syntax:

**People base examples:**
```typescript
// Age calculation (respects livingPersonAgeThreshold)
age: 'if(${born}.isEmpty(), "Unknown",
      if(${died}.isEmpty() && (now() - ${born}).years.floor() < ${maxLivingAge},
         (now() - ${born}).years.floor() + " years",
         if(${born} && !${died}.isEmpty(),
            (${died} - ${born}).years.floor() + " years", "Unknown")))'

// Display name fallback
display_name: '${name} || file.name'
```

**Places base examples:**
```typescript
// Combine coordinates
coordinates: 'if(${coordinates_lat}, ${coordinates_lat} + ", " + ${coordinates_long}, "")'

// Map link generation
map_link: 'if(${coordinates_lat}, "[[Map View]]", "")'
```

### Property Aliases

Base templates respect user-defined property aliases, so custom property names work automatically.

**Implementation pattern:**
```typescript
function generatePeopleBaseTemplate(options?: {
    aliases?: Record<string, string>;
    maxLivingAge?: number;
}): string {
    const getPropertyName = (canonical: string) =>
        options?.aliases?.[canonical] || canonical;

    const name = getPropertyName('name');
    const born = getPropertyName('born');
    // Use in formulas: age: `if(\${${born}}.isEmpty(), ...)`
}
```

**Settings:** `settings.propertyAliases` maps custom names to canonical names.

**Current support:**
- People, Places, Events bases: Full alias support
- Organizations, Sources, Universes: Static templates (no alias support yet)

### Base Creation Flow

**Commands registered in `main.ts`:**
- `canvas-roots:create-base-template` - People base
- `canvas-roots:create-places-base-template` - Places base
- `canvas-roots:create-events-base-template` - Events base
- `canvas-roots:create-sources-base-template` - Sources base
- `canvas-roots:create-organizations-base-template` - Organizations base
- `canvas-roots:create-universes-base-template` - Universes base
- `canvas-roots:create-all-bases` - All bases at once

**Creation logic:**
1. **Check availability** (`isBasesAvailable()`): Looks for existing `.base` files or enabled Bases plugin
2. **User confirmation**: If Bases not detected, prompts user (file will work once enabled)
3. **Folder creation**: Creates `basesFolder` (default: `Canvas Roots/Bases`)
4. **File creation**: Creates `.base` file with generated template, opens in editor
5. **Template generation**: Applies property aliases and settings

**Auto-creation during import:**
When importing GEDCOM/CSV, bases are auto-created for imported note types (silently skips if already exist).

### Control Center Integration

The Preferences tab includes a "Base templates" card with:
- Individual buttons for each base type
- "Create all bases" button
- Icons and descriptions for each base

---

## Property and Value Alias System

The alias system normalizes data from various sources (GEDCOM imports, user input, existing notes) to canonical forms while respecting user preferences for property naming.

### Property Aliases

`PropertyAliasService` (`src/core/property-alias-service.ts`) maps custom frontmatter property names to canonical names used internally.

**Purpose:** Users may prefer `birthdate` instead of `born`, or `maiden_name` instead of `birth_surname`. The alias system allows custom naming while maintaining internal consistency.

**Configuration:** `settings.propertyAliases: Record<string, string>`

```typescript
// Example user configuration
{
  "birthdate": "born",      // User writes "birthdate:", plugin reads as "born"
  "deathdate": "died",
  "maiden_name": "birth_surname"
}
```

**Key methods:**

```typescript
// Resolve custom property name to canonical name
resolve(propertyName: string): string

// Get the property name to use when writing (user's preferred name)
getWriteProperty(canonicalName: string): string

// Get the property name to display in UI
getDisplayProperty(canonicalName: string): string
```

**Canonical properties by note type:**

| Note Type | Canonical Properties |
|-----------|---------------------|
| Person | `name`, `born`, `died`, `birth_surname`, `father`, `mother`, `spouse`, `children`, `sex`, `gender_identity`, `cr_id`, `cr_type` |
| Place | `name`, `place_type`, `coordinates_lat`, `coordinates_long`, `parent_place`, `cr_id`, `cr_type` |
| Event | `title`, `event_type`, `date`, `end_date`, `person`, `place`, `description`, `cr_id`, `cr_type` |
| Source | `name`, `source_type`, `author`, `publication_date`, `repository`, `cr_id`, `cr_type` |
| Organization | `name`, `org_type`, `founded`, `dissolved`, `parent_org`, `cr_id`, `cr_type` |

### Value Aliases

`ValueAliasService` (`src/core/value-alias-service.ts`) normalizes property values to canonical forms.

**Purpose:** Handle variations in how the same concept is expressed:
- "male" → "M" (GEDCOM standard)
- "Birth" → "birth" (case normalization)
- Custom value mappings for domain-specific needs

**Configuration:** `settings.valueAliases: ValueAliasSettings`

```typescript
interface ValueAliasSettings {
  eventType: Record<string, string>;      // "nameday" → "birth"
  sex: Record<string, string>;            // "male" → "M"
  gender_identity: Record<string, string>;
  placeCategory: Record<string, string>;
  noteType: Record<string, string>;
}
```

**Key methods:**

```typescript
// Resolve value to canonical form (checks user aliases, then built-in synonyms)
resolve(field: string, value: string): string

// Get the value to use when writing (user's preferred form)
getWriteValue(field: string, canonicalValue: string): string

// Check if a value is valid for a field
isValidValue(field: string, value: string): boolean
```

### Built-in Synonyms

The value alias service includes built-in synonyms for common variations, eliminating the need for explicit user configuration in most cases.

**Sex field synonyms:**

| Input | Canonical |
|-------|-----------|
| `male`, `m`, `boy`, `man` | `M` |
| `female`, `f`, `girl`, `woman` | `F` |
| `other`, `nonbinary`, `non-binary`, `nb`, `x` | `X` |
| `unknown`, `u`, `?` | `U` |

**Event type synonyms:**

| Input | Canonical |
|-------|-----------|
| `nameday`, `baptism`, `christening` | `birth` |
| `burial`, `cremation`, `interment` | `death` |
| `wedding`, `union`, `civil_union` | `marriage` |
| `separation`, `annulment` | `divorce` |
| `move`, `relocation`, `emigration`, `immigration` | `residence` |
| `job`, `career`, `employment`, `profession` | `occupation` |
| `schooling`, `degree`, `graduation` | `education` |
| `service`, `enlistment`, `discharge` | `military` |
| `bar_mitzvah`, `bat_mitzvah`, `confirmation`, `first_communion` | `religious` |

**Resolution order:**
1. User-defined aliases (highest priority)
2. Built-in synonyms
3. Original value (if no match)

### Integration Points

The alias system is used throughout the plugin:

**GEDCOM Import/Export** (`src/gedcom/`):
- Import: Maps GEDCOM property names to canonical, applies value normalization
- Export: Uses `getWriteProperty()` and `getWriteValue()` for output

**Data Quality** (`src/core/data-quality.ts`):
- Sex normalization uses value aliases
- Property standardization respects property aliases

**Obsidian Bases** (`src/constants/*-base-template.ts`):
- Base templates apply property aliases to formula references
- Ensures bases work with custom property names

**Family Graph** (`src/core/family-graph.ts`):
- Reads frontmatter using resolved property names
- Handles both canonical and aliased forms

**Settings UI** (`src/settings.ts`):
- Property alias editor with add/remove functionality
- Value alias configuration per field type

---

## Statistics and Reports System

The statistics and reports system provides vault-wide analytics and genealogical document generation.

### Statistics Architecture

```
src/statistics/
├── services/
│   └── statistics-service.ts    # Core computation (1,681 lines)
├── types/
│   └── statistics-types.ts      # Type definitions
├── constants/
│   └── statistics-constants.ts  # Section IDs, limits
└── ui/
    ├── statistics-tab.ts        # Control Center tab
    └── statistics-view.ts       # Workspace dashboard

src/reports/
├── services/
│   ├── report-generation-service.ts  # Orchestration
│   └── *-generator.ts               # 7 report generators
├── types/
│   └── report-types.ts
└── ui/
    └── report-generator-modal.ts
```

**StatisticsService** is the central computation point:
- Caching with 1-second debounced invalidation
- Lazy initialization of dependent services
- Drill-down methods for UI navigation

**Data sources:**
- `VaultStatsService` - Iterates markdown files, checks `cr_type` frontmatter
- `FamilyGraphService` - Family relationships, person cache, analytics
- Direct file iteration for statistics not in existing services

### Metrics Computed

**Entity Counts:**
```typescript
interface EntityCounts {
  people: number;
  events: number;
  places: number;
  sources: number;
  organizations: number;
  universes: number;
  canvases: number;
}
```

**Data Completeness (percentages):**
- Birth/death dates coverage
- Source attachment rate
- Father/mother/spouse link rates
- Parent type breakdown (biological, step, adoptive)

**Quality Metrics (issue counts):**
- Missing birth/death dates
- Orphaned people (no relationships)
- Living people (birth but no death)
- Incomplete parents (only one linked)
- Date inconsistencies (birth after death, age > 120)
- Blended families (mixed parent types)

**Top Lists (frequency analysis):**
- Surnames - extracted from last name
- Locations - birth/death places combined
- Occupations - from `occupation` field
- Sources - citation counts

**Distribution Analysis:**
- Gender/sex breakdown (M/F/X/U)
- Event types by count
- Source types and confidence levels
- Place categories

**Extended Statistics (Phase 3):**
- **Longevity** - Average/median/min/max lifespan, grouped by birth decade and location
- **Family size** - Children per family, distribution buckets (1-2, 3-4, 5-6, 7+)
- **Marriage patterns** - Marriage age by sex, remarriage rates
- **Migration** - Top routes, destinations, origins, migration rate
- **Source coverage** - Overall and by generation
- **Timeline density** - Events by decade, gap detection

**Drill-down methods** for navigating to specific people:
```typescript
getPeopleBySurname(surname: string): PersonRef[]
getPeopleByLocation(location: string): PersonRef[]
getPeopleWithMissingBirthDate(): PersonRef[]
getOrphanedPeople(): PersonRef[]
getPeopleWithDateInconsistencies(): PersonRef[]
```

### Report Types

Seven report generators output Markdown files:

| Report | Description | Key Options |
|--------|-------------|-------------|
| Family Group Sheet | Couple + spouses + children with vitals | `includeChildren`, `includeSpouseDetails`, `includeSources` |
| Individual Summary | One person's complete profile | `personCrId` |
| Ahnentafel | Numbered ancestor list (Sosa-Stradonitz) | `maxGenerations`, `includeDetails` |
| Gaps Report | Missing data and research opportunities | `scope`, `fieldsToCheck`, `maxItemsPerCategory` |
| Register Report | Descendant list with NGSQ numbering | `includeSpouses` |
| Pedigree Chart | Ancestor tree (markdown formatted) | `maxGenerations` |
| Descendant Chart | Descendant tree (markdown formatted) | `maxGenerations` |

**Report output structure:**
```typescript
interface ReportResult {
  success: boolean;
  content: string;              // Markdown content
  suggestedFilename: string;    // e.g., "Family-Smith-1850-1920.md"
  stats: {
    peopleCount: number;
    eventsCount: number;
    sourcesCount: number;
    generationsCount?: number;
  };
  warnings: string[];           // Data quality warnings
}
```

**Output methods:**
- `vault` - Save to configured reports folder
- `download` - Browser download

### UI Integration

**Control Center Statistics Tab:**
- Actions card with report generation shortcuts
- Overview card with entity counts and date range
- Data completeness with progress bars
- Quality alerts highlighting problematic data
- Top lists with expandable drill-downs

**Statistics Workspace View** (`VIEW_TYPE_STATISTICS`):
- Auto-refresh on vault changes
- Expandable/collapsible sections with state persistence
- Direct links to notes from drill-down lists
- Mobile-responsive layout

**Section organization:**
```typescript
// Managed via SECTION_IDS constants
OVERVIEW, COMPLETENESS, QUALITY,
TOP_SURNAMES, TOP_LOCATIONS, TOP_OCCUPATIONS, TOP_SOURCES,
EVENTS_BY_TYPE, SOURCES_BY_TYPE, SOURCES_BY_CONFIDENCE,
PLACES_BY_CATEGORY, GENDER_DISTRIBUTION, UNIVERSES,
LONGEVITY, FAMILY_SIZE, MARRIAGE_PATTERNS, MIGRATION,
SOURCE_COVERAGE_GEN, TIMELINE_DENSITY, REPORTS
```

**Additional statistics UI:**
- Folder statistics modal (context menu on folders)
- Tree statistics modal (context menu on canvas files)
- Export statistics service (pre-export counts with privacy adjustment)

---

## Privacy and Gender Identity Protection

The plugin supports inclusive gender identity modeling and privacy protection for sensitive data.

### Sex vs Gender Data Model

The frontmatter supports three distinct fields (defined in `src/types/frontmatter.ts`):

```yaml
sex: M                          # GEDCOM-compatible biological sex (M/F/X/U)
gender: male                    # Legacy field, falls back to sex when reading
gender_identity: Non-binary     # Free-form gender identity field
```

**Field usage:**

| Field | Purpose | Used By |
|-------|---------|---------|
| `sex` | Biological sex for GEDCOM compatibility | Import/export, Data Quality normalization, Canvas coloring |
| `gender` | Backwards compatibility | Falls back to `sex` when reading |
| `gender_identity` | Personal identity (free-form) | Display only (not used in data interchange) |

**Canvas node coloring** (`src/core/canvas-generator.ts` - `getPersonColor()`):
- Reads `sex` field from frontmatter
- M/MALE → Green (color 4)
- F/FEMALE → Purple (color 6)
- NONBINARY → Yellow (color 3)
- Unknown → Orange (color 2)
- Falls back to name prefix detection (Mr., Mrs., etc.) for legacy support

**Data Quality sex normalization** (`src/core/data-quality.ts` - `normalizeGenderValues()`):
- Standardizes values to GEDCOM M/F/X/U format
- Uses built-in synonyms (male→M, female→F, etc.)
- Supports user-defined value aliases via settings
- Three modes controlled by `settings.sexNormalizationMode`:
  - `standard` - Normalize all values to GEDCOM M/F/X/U
  - `schema-aware` - Skip notes with schemas defining custom sex values
  - `disabled` - No normalization

### Living Person Privacy

The `PrivacyService` (`src/core/privacy-service.ts`) protects living individuals in exports:

**Detection logic:**
- Person is "likely living" if: no death date AND birth year within age threshold
- Default threshold: 100 years (configurable via `settings.livingPersonAgeThreshold`)
- Supports approximate dates: "about 1920", "between 1920-1930", "before 1920"

**Protection display options** (`settings.privacyDisplayFormat`):

| Option | Display | Behavior |
|--------|---------|----------|
| `living` | "Living" | Show placeholder name |
| `private` | "Private" | Show placeholder name |
| `initials` | "J.S." | Show initials only |
| `hidden` | (excluded) | Remove from output entirely |

**What gets protected in exports:**
- **Name**: Replaced with chosen display format
- **Birth/death dates**: Hidden when `hideDetailsForLiving` is enabled
- **Relationships**: Preserved (allows tree structure to remain intact)
- **Original notes**: Unchanged (protection applies to outputs only)

**Applied in exports:**
- GEDCOM export (`src/gedcom/gedcom-exporter.ts`)
- GEDCOM X export (`src/gedcomx/gedcomx-exporter.ts`)
- Gramps XML export (`src/gramps/gramps-exporter.ts`)
- CSV export (`src/csv/csv-exporter.ts`)

**Not yet applied to:**
- Canvas display (shows full data)
- Interactive family chart view
- Reports (markdown output)

For user-facing documentation, see [Privacy & Security](../../wiki-content/Privacy-And-Security.md).

### Log Export Obfuscation

The logging system (`src/core/logging.ts`) includes built-in PII obfuscation for log exports, protecting personal data when sharing logs for debugging.

**Setting:** `settings.obfuscateLogExports` (default: `true` - secure by default)

**What gets obfuscated:**

| Pattern | Replacement | Example |
|---------|-------------|---------|
| Names (capitalized multi-word) | `[NAME-1]`, `[NAME-2]`, etc. | "John Smith" → `[NAME-1]` |
| ISO dates | `[DATE]` | "1985-03-15" → `[DATE]` |
| Years (1000-2029) | `[YEAR]` | "born in 1952" → "born in `[YEAR]`" |
| File paths (`.md`) | `/[FILE].md` | "/People/John Smith.md" → `/[FILE].md` |
| UUIDs/cr_ids | `[ID]` | "abc12345-..." → `[ID]` |

**Implementation functions:**
- `obfuscateString(str)` - Replaces PII patterns in a string
- `obfuscateData(data)` - Recursively obfuscates objects/arrays
- `obfuscateLogEntry(entry)` - Obfuscates a single log entry (preserves technical fields like component, category, level)
- `obfuscateLogs(logs)` - Obfuscates an array of log entries

**Usage in settings UI** (`src/settings.ts`):
```typescript
const logsToExport = this.plugin.settings.obfuscateLogExports
  ? obfuscateLogs(logs)
  : logs;
```

**Design notes:**
- Names are replaced with consistent numbered tokens (`[NAME-1]`, `[NAME-2]`) within each log entry to preserve reference relationships
- Numbers and booleans pass through unchanged (safe technical data)
- Component and category names are preserved (technical identifiers, not PII)

### Planned Features (Not Yet Implemented)

The following are documented for future implementation:

- **`cr_living` manual override** - Frontmatter property to explicitly mark someone as living (`cr_living: true`) or deceased (`cr_living: false`), overriding automatic detection
- **Pronouns field** - `pronouns: she/her` for respectful communication
- **Underscore-prefix privacy convention** - Fields like `_previous_names` excluded from search/display
- **Deadname protection** - Automatic suppression of historical names
- **Export warnings** - Confirmation when exporting private fields
- **Canvas privacy obfuscation** - Apply privacy protection to canvas display, not just exports

### Design Rationale

- Separates GEDCOM biological data from personal identity
- Supports inclusive gender identity while maintaining data interchange compatibility
- Protects living persons from inadvertent disclosure in exports
- Respects user-defined schemas that may have custom sex/gender values
