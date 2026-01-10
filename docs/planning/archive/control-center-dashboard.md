# Control Center Dashboard

Planning document for adding a tile-based Dashboard to the Control Center, replacing the Status tab with a more action-oriented interface.

- **Status:** Complete
- **Priority:** Medium
- **GitHub Issue:** #TBD
- **Created:** 2025-12-20
- **Completed:** 2025-12-20
- **Version:** 0.13.6

---

## Overview

Transform the Control Center's Status tab into a Dashboard with quick-action tiles, providing mobile-friendly access to common operations. The current Status tab shows metrics but lacks actionable shortcuts. A tile-based interface surfaces high-frequency actions that are currently buried in menus or require multiple clicks.

---

## Problem Statement

**Current State:**
- Status tab displays entity counts and vault health metrics
- Common actions require navigating to other tabs or using Command Palette
- Mobile users face extra friction due to limited screen space and touch navigation
- No quick access to frequently-used operations

**Pain Points:**
1. **Mobile UX** — Small screens make menu navigation tedious
2. **Action discovery** — New users don't know what operations are available
3. **Context switching** — Must leave Control Center to perform common tasks
4. **Repetitive navigation** — Power users repeat the same clicks frequently

---

## Proposed Solution

Rename "Status" tab to "Dashboard" and add a tile grid of quick actions above the existing metrics. The tiles provide one-tap access to common operations while preserving the health overview.

### Design Principles

1. **Fixed, curated tile set** — Start with a well-chosen set rather than configurable tiles
2. **Mobile-first** — Larger tap targets, responsive grid layout
3. **Preserve existing content** — Vault health metrics remain, reorganized below tiles
4. **Progressive enhancement** — Can add configurability in future releases

---

## Dashboard Layout

```
┌─ DASHBOARD TAB ─────────────────────────────────────────┐
│                                                          │
│  QUICK ACTIONS                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │  👤      │ │  📅      │ │  📄      │                 │
│  │  Person  │ │  Event   │ │  Source  │                 │
│  └──────────┘ └──────────┘ └──────────┘                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │  📊      │ │  📈      │ │  📥      │                 │
│  │  Report  │ │  Stats   │ │  Import  │                 │
│  └──────────┘ └──────────┘ └──────────┘                 │
│                                                          │
│  ▼ VAULT HEALTH                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  1,234 People  │  456 Events  │  89 Sources        │ │
│  │  12 Issues     │  89% Complete                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ▼ RECENT                                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │  • John Smith (Person)           2 min ago        │ │
│  │  • Birth of Mary (Event)         1 hour ago       │ │
│  │  • 1850 Census (Source)          Yesterday        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Tile Categories & Actions

### Dashboard Tiles (9 tiles, 3×3 grid)

| Tile | Icon | Action | Description |
|------|------|--------|-------------|
| **Person** | `user` | Create Person | Opens person creation modal |
| **Event** | `calendar` | Create Event | Opens event creation modal |
| **Source** | `file-text` | Create Source | Opens source creation modal |
| **Report** | `bar-chart` | Generate Report | Opens Report Generator modal |
| **Statistics** | `line-chart` | Open Dashboard | Opens Statistics Dashboard view |
| **Import** | `upload` | Import Data | Opens Import Wizard |
| **Place** | `map-pin` | Create Place | Opens place creation modal |
| **Tree Output** | `git-branch` | Generate Tree | Opens Tree Output tab |
| **Map** | `map` | Open Map View | Opens Map View (works without person context) |

### Tile Selection Rationale

**Included:**
- Create Person/Event/Source/Place — Core entity creation for genealogists
- Generate Report — Key feature, currently requires navigating to Statistics Dashboard
- Statistics Dashboard — Central hub for analysis
- Import — Common entry point for new data
- Tree Output — Core visualization feature
- Map — Geographic exploration, works context-free, unique differentiator

**Deferred:**
- Family Chart — Requires person context (would need picker)
- Organization — Niche (worldbuilders only)
- Universe/Collection creation — Less frequent, available via other tabs
- Export — Less urgent than import, available in Import/Export tab
- Validate — Can add later based on user demand

---

## Responsive Grid Layout

### Desktop (>800px width)
- 3-column grid
- 6 tiles visible (2 rows)
- Comfortable spacing

### Tablet (500-800px)
- 3-column grid
- Slightly smaller tiles
- Same layout as desktop

### Mobile (<500px)
- 2-column grid
- Larger tap targets (min 48px)
- May show 4-6 tiles based on viewport

```css
/* Conceptual responsive breakpoints */
.cr-dashboard-tiles {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 500px) {
  .cr-dashboard-tiles {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

---

## Vault Health Section

Preserve existing Status tab content in a collapsible section:

| Metric | Description |
|--------|-------------|
| **Entity counts** | People, Events, Sources, Places, Organizations, Canvases |
| **Completeness** | % of people with key data (birth, death, parents, sources) |
| **Issues** | Count of data quality warnings/errors |
| **Date range** | Earliest to latest dates in vault |

**Interaction:**
- Collapsed by default after first use (remembers state)
- Click to expand/collapse
- "View Details" link opens Statistics Dashboard

---

## Recent Section

Track recently accessed genealogical files:

| Field | Description |
|-------|-------------|
| **File name** | Display name of the note |
| **Entity type** | Person, Event, Source, Place, etc. |
| **Timestamp** | Relative time (2 min ago, Yesterday, etc.) |

**Behavior:**
- Shows last 5 accessed files
- Click to open file
- Right-click for context menu
- Excludes non-CR files (regular notes, settings, etc.)

**Storage:**
```typescript
interface RecentFileEntry {
  path: string;
  name: string;
  entityType: 'person' | 'event' | 'source' | 'place' | 'organization' | 'canvas';
  accessedAt: number;
}

// Stored in plugin settings
recentFiles: RecentFileEntry[];  // Max 10, shown 5
```

---

## Implementation Architecture

### Component Structure (Actual Implementation)

```
src/ui/
├── dashboard-tab.ts              # Dashboard tab with tiles, vault health, and recent files
├── control-center.ts             # Updated to use 'dashboard' tab instead of 'status'
src/core/
├── recent-files-service.ts       # RecentFilesService for tracking file access
src/settings.ts                   # Added dashboardRecentFiles to settings
styles/
├── dashboard.css                 # Dashboard-specific styles
```

**Note:** The implementation consolidated all dashboard functionality into a single `dashboard-tab.ts` file rather than separate components, following the existing pattern for other Control Center tabs.

### Tab Registration

```typescript
// In control-center.ts
this.registerTab('dashboard', {
  id: 'dashboard',
  name: 'Dashboard',
  icon: 'layout-dashboard',
  component: DashboardTab
});
```

### Tile Configuration

```typescript
interface DashboardTile {
  id: string;
  label: string;
  icon: string;           // Lucide icon name
  action: () => void;     // Click handler
  description?: string;   // Tooltip text
}

const DASHBOARD_TILES: DashboardTile[] = [
  { id: 'create-person', label: 'Person', icon: 'user', action: () => createPerson() },
  { id: 'create-event', label: 'Event', icon: 'calendar', action: () => createEvent() },
  // ...
];
```

---

## Phased Implementation

### Phase 1: Foundation ✅
- Create `DashboardTab` component
- Implement tile grid with 9 tiles (3×3 grid)
- Wire up tile actions to existing modals/commands
- Rename tab from "Status" to "Dashboard"

### Phase 2: Sections ✅
- Add collapsible Vault Health section
- Migrate existing Status tab metrics
- Add expand/collapse state persistence

### Phase 3: Recent Files ✅
- Implement recent file tracking via `RecentFilesService`
- Add Recent section to Dashboard (last 5 files)
- Integrate tracking into People tab "Open" button and create modals

### Phase 4: Polish ✅
- Responsive grid refinement (3-column desktop, 2-column mobile)
- Mobile-specific optimizations
- Accessibility (keyboard navigation, focus states)
- First-run welcome notice for new users

### Additional Features (Added during implementation)
- **Context menu for Recent items**: Right-click for type-specific actions
  - All types: "Open note"
  - Place: "Open in Map View" (zooms to coordinates if available)
  - Person: "Open in Family Chart"

---

## Future Enhancements (Not in Scope)

These ideas are interesting but deferred to keep initial scope manageable:

| Enhancement | Description |
|-------------|-------------|
| **Configurable tiles** | User chooses which tiles to show |
| **Reorderable tiles** | Drag-drop to rearrange |
| **Custom quick actions** | User-defined tiles with custom commands |
| **Tile badges** | Notification counts (e.g., "12 issues") |
| **Favorite entities** | Pin frequently-accessed files |
| **Compact mode** | Icons only, no labels (for very small screens) |

---

## Design Decisions

1. **Icon style:** Lucide icons for consistency with Obsidian's native UI. Emoji render differently across platforms and can look out of place.

2. **Tile count:** 9 tiles (3 rows of 3). Covers core entity creation, key features, and visualization.

3. **Recent tracking scope:** Track file opens via Charted Roots features only. Cleaner data, and users opening files directly probably don't need the Dashboard reminder.

4. **Tab icon:** `home` — feels intuitive as the "starting point" for CR operations.

5. **Vault Health default state:** Expanded on first visit, remembers collapse state thereafter.

6. **Existing Status tab users:** Brief first-run tooltip to orient users to the renamed/reorganized tab.

---

## Alternatives Considered

### Command Palette Only
- Pros: No UI changes needed
- Cons: Doesn't help mobile users, requires knowing command names

### Floating Action Button (FAB)
- Pros: Always accessible, mobile-friendly pattern
- Cons: Obscures content, not standard in Obsidian, single action focus

### Toolbar Extension
- Pros: Persistent access
- Cons: Limited space, not visible in all views

### Sidebar Widget
- Pros: Always visible
- Cons: Takes permanent space, competes with other sidebar content

**Decision:** Dashboard tab is the best fit because:
- Control Center is already the hub for CR operations
- Tab pattern is familiar to users
- Doesn't require new UI paradigms
- Mobile users already know to open Control Center

---

## Related Documents

- [Report Wizard Enhancements](report-wizard-enhancements.md) — Report Generator improvements
- [Statistics and Reports](../../wiki-content/Statistics-And-Reports.md) — Statistics Dashboard documentation
- [Control Center](../../wiki-content/Control-Center.md) — Current Control Center documentation

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-20 | Created planning document | Mobile UX improvement opportunity |
| 2025-12-20 | Fixed tile set over configurable | Simpler implementation, better defaults matter more |
| 2025-12-20 | Preserve existing metrics in collapsible section | Don't lose existing functionality |
| 2025-12-20 | 4-phase implementation | Incremental delivery with foundation first |
| 2025-12-20 | Lucide icons over emoji | Consistency with Obsidian native UI |
| 2025-12-20 | 9 tiles (3×3 grid) | Added Place, Tree Output, Map for complete coverage |
| 2025-12-20 | Track CR feature opens only | Cleaner recent files data |
| 2025-12-20 | `home` tab icon | Intuitive "starting point" metaphor |
| 2025-12-20 | First-run welcome notice (dismissible) | Orient existing users to the change |
| 2025-12-20 | Context menu for Recent items | Added type-specific actions (Open in Map/Chart) |
| 2025-12-20 | Max 5 recent files | Balance between utility and UI clutter |
| 2025-12-20 | Consolidated dashboard-tab.ts | Single file follows existing tab patterns |
| 2025-12-20 | Feature complete v0.13.6 | All 4 phases implemented with additional context menu feature |
