# Universe Management - Planning Document

## Overview

A comprehensive universe management system for fictional worldbuilders. This includes:
1. **Universe as a first-class entity type** — canonical registry of universes
2. **Universe Setup Wizard** — guided onboarding for new worlds
3. **Universes tab in Control Center** — management UI (conditional visibility)
4. **Universes section in Statistics** — discovery and overview

See [Roadmap: Universe Setup Wizard](../../wiki-content/Roadmap.md#universe-setup-wizard) for the user-facing summary.

---

## Problem Statement

When setting up a new fictional world (e.g., Middle-earth, Westeros), users currently need to:

1. Discover that date systems exist and create one
2. Find the maps feature and create a custom map
3. Learn about schemas and create validation rules
4. Remember to use the same universe string everywhere
5. Hope they don't make typos that create duplicate "universes"

These features are spread across different parts of the plugin with no guidance on how they connect. The `universe` field is just a string — there's no validation, no autocomplete from a canonical source, and no central place to see "all my universes."

---

## Solution: Universe as First-Class Entity

### Why First-Class?

For a userbase that takes worldbuilding seriously, string-only universes are insufficient:

| Problem | First-Class Solution |
|---------|---------------------|
| Typos create duplicates | Autocomplete from universe notes |
| No central overview | Universe notes + Universes tab |
| Can't store metadata | Universe note holds description, author, genre, etc. |
| No validation | Warn when `universe` field references non-existent universe |
| No relationships | Universe links to its default calendar, map, etc. |
| No discoverability | Browse universe notes, Universes section in Statistics |

### Backward Compatibility

- String-only `universe` values continue to function (graceful degradation)
- Migration prompt: "We found 3 universes without notes. Create them?"
- New entities created via wizard default to linking via universe notes

---

## Universe Entity Schema

```yaml
---
cr_type: universe
cr_id: middle-earth
name: Middle-earth
description: A fantasy world created by J.R.R. Tolkien
author: J.R.R. Tolkien
genre: fantasy
status: active           # active | archived | draft
default_calendar: shire-reckoning
default_map: middle-earth-map
created: 2025-01-15
---

# Middle-earth

A legendarium of stories set in a mythic past of our own world.

## Associated Entities
- Calendar: [[Shire Reckoning]]
- Map: [[Middle-earth Map]]
- Schema: [[Middle-earth Validation]]

## Notes
(User can add their own notes here)
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `cr_type` | `"universe"` | Entity type identifier |
| `cr_id` | string | Unique identifier (kebab-case recommended) |
| `name` | string | Display name |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Brief description of the universe |
| `author` | string | Creator of the fictional world |
| `genre` | string | Genre (fantasy, sci-fi, historical, etc.) |
| `status` | enum | `active` / `archived` / `draft` |
| `default_calendar` | string | `cr_id` of the default date system |
| `default_map` | string | `cr_id` of the default custom map |
| `created` | date | When this universe was created |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    UniverseService                           │
│  (CRUD, validation, aggregation across entity types)         │
├─────────────────────────────────────────────────────────────┤
│  - getAllUniverses()         - getUniverseById()            │
│  - createUniverse()          - updateUniverse()             │
│  - getEntitiesForUniverse()  - getOrphanUniverseStrings()   │
│  - validateUniverseReference()                               │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Statistics View │  │ Control Center  │  │ Entity Creation │
│ Universes       │  │ Universes Tab   │  │ Modals          │
│ Section         │  │ (conditional)   │  │ (autocomplete)  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## UniverseService API

```typescript
interface UniverseInfo {
  crId: string;
  name: string;
  description?: string;
  author?: string;
  genre?: string;
  status: 'active' | 'archived' | 'draft';
  defaultCalendar?: string;
  defaultMap?: string;
  file: TFile;
}

interface UniverseEntityCounts {
  people: number;
  places: number;
  events: number;
  organizations: number;
  calendars: number;
  maps: number;
  schemas: number;
}

interface UniverseService {
  // CRUD
  getAllUniverses(): UniverseInfo[];
  getUniverseById(crId: string): UniverseInfo | null;
  getUniverseByName(name: string): UniverseInfo | null;
  createUniverse(data: CreateUniverseData): Promise<TFile>;
  updateUniverse(crId: string, updates: Partial<UniverseInfo>): Promise<void>;

  // Aggregation
  getEntityCountsForUniverse(crId: string): UniverseEntityCounts;
  getEntitiesForUniverse(crId: string, entityType?: string): TFile[];

  // Validation & Migration
  getOrphanUniverseStrings(): string[];  // universe values without notes
  validateUniverseReference(value: string): ValidationResult;
  createUniverseFromOrphan(orphanValue: string): Promise<TFile>;

  // Autocomplete
  getUniverseNames(): string[];  // for autocomplete in modals
}
```

---

## UI: Universes Card in Guide Tab

The Guide tab always shows a "Universes" card that explains the feature and provides entry points. This is the primary discovery mechanism for users who haven't created universes yet.

### Card Layout

```
┌─────────────────────────────────────────────────────────────┐
│  🌍  Fictional universes                                    │
│      For worldbuilders and fiction writers                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Universes help you organize fictional worlds. Create a     │
│  universe to group related calendars, maps, places, and     │
│  characters together.                                       │
│                                                             │
│  No universes yet.                                          │
│                                                             │
│  [Create universe]              Learn more about universes →│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

When universes exist, the card changes to show a summary:

```
┌─────────────────────────────────────────────────────────────┐
│  🌍  Fictional universes                                    │
│      For worldbuilders and fiction writers                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  You have 2 universes:                                      │
│  • Middle-earth (12 people, 5 places)                       │
│  • Westeros (8 people, 3 places)                            │
│                                                             │
│  [Create universe]  [Manage universes]                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Interactions

| Element | Action |
|---------|--------|
| **[Create universe]** | Opens Universe Setup Wizard |
| **[Manage universes]** | Switches to Universes tab (only shown when universes exist) |
| **Universe name** | Opens the universe note |
| **Learn more →** | Opens wiki documentation |

---

## UI: Universes Tab (Control Center)

### Conditional Visibility

The Universes tab only appears when:
- Any universe notes exist in the vault, OR
- Any orphan universe strings exist (entities with `universe` field but no matching universe note)

This keeps the UI clean for genealogists who never use fictional worlds.

### Tab Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Universes                                    [+ Create]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ▼ Middle-earth                                    [Edit]   │
│    A fantasy world created by J.R.R. Tolkien               │
│    ┌──────────────────────────────────────────────────┐    │
│    │ 📅 Calendars: 1  │ 🗺️ Maps: 2   │ 👤 People: 12  │    │
│    │ 📍 Places: 8     │ 🏛️ Orgs: 3   │ 📋 Schemas: 1  │    │
│    └──────────────────────────────────────────────────┘    │
│    Quick actions: [Add person] [Add place] [Add event]     │
│                                                             │
│  ▶ Westeros                                        [Edit]   │
│    8 people, 3 places, 1 calendar                          │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  ⚠️ Orphan universe values (no notes)                       │
│    • "narnia" — used by 3 entities  [Create note]          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Interactions

| Element | Action |
|---------|--------|
| **[+ Create]** | Opens Universe Setup Wizard |
| **Universe row (collapsed)** | Click to expand |
| **Universe row (expanded)** | Shows entity counts and quick actions |
| **[Edit]** | Opens universe note for editing |
| **Entity count** | Click to filter/show those entities |
| **Quick actions** | Opens creation modal with universe pre-filled |
| **[Create note]** (orphan) | Creates universe note from orphan string |

---

## UI: Universes Section in Statistics

Always visible in the Statistics Dashboard (unlike the tab). Provides discovery for users who haven't created universes yet.

### Section Layout

```
▼ Universes                                        [globe icon]
  ┌─────────────────────────────────────────────────────────┐
  │ middle-earth    12 people  5 places  1 calendar    ▶   │
  │ westeros         8 people  3 places  1 calendar    ▶   │
  │ star-wars        0 people  0 places  1 calendar    ▶   │
  └─────────────────────────────────────────────────────────┘

  [+ Create universe]

  ⚠️ 1 orphan universe value without note
```

### Interactions

| Element | Action |
|---------|--------|
| **Universe row** | Click to expand (shows entities) or open universe note |
| **[+ Create universe]** | Opens Universe Setup Wizard |
| **Orphan warning** | Links to Universes tab for resolution |

---

## Universe Setup Wizard

### Flow

| Step | Description | Skippable |
|------|-------------|-----------|
| 1 | **Create universe** — name, description, optional metadata | No |
| 2 | **Custom calendar?** — creates date system linked to universe | Yes |
| 3 | **Custom map?** — creates map config linked to universe | Yes |
| 4 | **Validation rules?** — creates schema scoped to universe | Yes |
| 5 | **Summary** — shows universe note with links to created entities | No |

### Step Details

#### Step 1: Create Universe

```
┌─────────────────────────────────────────────────────────────┐
│  Create universe                                            │
│  Step 1 of 5                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Universe name *                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Middle-earth                                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Description                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ A fantasy world created by J.R.R. Tolkien           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ▼ Additional details (optional)                            │
│    Author: [J.R.R. Tolkien    ]                            │
│    Genre:  [Fantasy           ▼]                           │
│    Status: [Active            ▼]                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                         [Cancel]  [Next]    │
└─────────────────────────────────────────────────────────────┘
```

#### Step 2: Custom Calendar

```
┌─────────────────────────────────────────────────────────────┐
│  Create universe                                            │
│  Step 2 of 5: Calendar                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Would you like a custom calendar for Middle-earth?         │
│                                                             │
│  Custom calendars let you use fictional dates like          │
│  "Third Age 3019" instead of real-world dates.              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ○  Yes, create a calendar                          │   │
│  │  ●  Skip for now                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Calendar creation form appears here if "Yes" selected]    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                    [Back]  [Skip]  [Next]   │
└─────────────────────────────────────────────────────────────┘
```

#### Step 5: Summary

```
┌─────────────────────────────────────────────────────────────┐
│  Create universe                                            │
│  Step 5 of 5: Summary                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ Universe created successfully!                          │
│                                                             │
│  Middle-earth                                               │
│  A fantasy world created by J.R.R. Tolkien                 │
│                                                             │
│  Created entities:                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✓  Universe note    [[Middle-earth]]                │   │
│  │ ✓  Date system      [[Shire Reckoning]]             │   │
│  │ ✓  Custom map       [[Middle-earth Map]]            │   │
│  │ ○  Schema           (skipped)                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  What's next?                                               │
│  • Add people, places, and events to your universe         │
│  • Open the universe note to add your own documentation    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                              [Open universe note]  [Done]   │
└─────────────────────────────────────────────────────────────┘
```

---

## Entity Creation Integration

### Autocomplete from Universe Notes

All entity creation modals with a `universe` field should:
1. Fetch universe names from `UniverseService.getUniverseNames()`
2. Show autocomplete suggestions as user types
3. Validate on blur: warn if value doesn't match a universe note

### Pre-filling Universe

When creating entities from within a universe context (e.g., quick actions in Universes tab), the universe field should be pre-filled and optionally locked.

---

## Implementation Phases

### Phase 1: Universe Entity Type

**Focus:** Establish universes as first-class citizens.

1. **Universe schema and types**
   - `UniverseInfo` interface
   - `UniverseFrontmatter` interface
   - Add to `cr_type` enum

2. **UniverseService**
   - CRUD operations
   - Entity aggregation by universe
   - Orphan detection

3. **Property alias support**
   - Add universe to property alias system

### Phase 2: UI Integration

**Focus:** Make universes visible and manageable.

1. **Guide tab → Universes card**
   - Always visible (primary entry point)
   - Explains what universes are
   - Shows universe count when they exist
   - "Create universe" button launches wizard

2. **Statistics → Universes section**
   - Universe list with counts
   - "Create universe" button
   - Orphan warning

3. **Control Center → Universes tab**
   - Conditional visibility logic
   - Full management UI
   - Orphan resolution

4. **Autocomplete in creation modals**
   - Universe field autocomplete
   - Validation warnings

### Phase 3: Universe Setup Wizard

**Focus:** Guided onboarding for new universes.

1. **Wizard modal**
   - Multi-step flow
   - Progress indicator
   - Step navigation (back/next/skip)

2. **Integration with existing creation forms**
   - Reuse date system creation
   - Reuse map creation
   - Reuse schema creation

3. **Summary and entity linking**
   - Generate universe note content
   - Link created entities

### Phase 4: Enhanced Features

**Focus:** Power user capabilities.

1. **Universe dashboard**
   - Entity counts over time
   - Recent activity

2. **Universe-scoped filtering**
   - Quick switcher filtering
   - Bases views filtered by universe

3. **Batch operations**
   - Move entities between universes
   - Bulk universe assignment

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/universes/types/universe-types.ts` | Type definitions |
| `src/universes/services/universe-service.ts` | Core service |
| `src/universes/ui/universes-tab.ts` | Control Center tab |
| `src/universes/ui/universe-wizard.ts` | Setup wizard modal |
| `src/universes/ui/universes-section.ts` | Statistics section component |
| `src/universes/index.ts` | Module exports |
| `src/constants/universes-base-template.ts` | Bases template |

### Modified Files

| File | Change |
|------|--------|
| `src/ui/control-center.ts` | Add Universes tab (conditional) |
| `src/statistics/ui/statistics-view.ts` | Add Universes section |
| `src/ui/create-person-modal.ts` | Universe autocomplete |
| `src/ui/create-place-modal.ts` | Universe autocomplete |
| `src/events/ui/create-event-modal.ts` | Universe autocomplete |
| `src/organizations/ui/create-organization-modal.ts` | Universe autocomplete |
| `src/dates/ui/date-systems-card.ts` | Universe autocomplete |
| `src/core/property-alias-service.ts` | Universe aliases |
| `main.ts` | Register UniverseService |

---

## Migration Strategy

### Detecting Orphan Universes

```typescript
getOrphanUniverseStrings(): string[] {
  const usedUniverses = new Set<string>();

  // Collect all universe values from entities
  for (const person of familyGraph.getAllPeople()) {
    if (person.universe) usedUniverses.add(person.universe);
  }
  for (const place of placeGraph.getAllPlaces()) {
    if (place.universe) usedUniverses.add(place.universe);
  }
  // ... etc for events, orgs, date systems, maps

  // Find which ones don't have universe notes
  const universeNotes = this.getAllUniverses().map(u => u.crId);
  return [...usedUniverses].filter(u => !universeNotes.includes(u));
}
```

### Migration Prompt

When orphan universes are detected, show in Universes tab:

```
⚠️ Orphan universe values (no notes)
  • "middle-earth" — used by 15 entities  [Create note]
  • "westeros" — used by 8 entities       [Create note]

  [Create all]
```

Creating a note from an orphan:
1. Generates universe note with `cr_id` matching the orphan string
2. Populates `name` from the string (title-cased)
3. Leaves other fields empty for user to fill

---

## Related Documentation

- [Roadmap: Universe Setup Wizard](../../wiki-content/Roadmap.md#universe-setup-wizard)
- [Fictional Date Systems](../../wiki-content/Fictional-Date-Systems.md)
- [Custom Maps](../../wiki-content/Maps.md)
- [Schema Validation](../../wiki-content/Schema-Validation.md)

---

## Status

**✅ Phase 1 Complete** — Universe entity type, UniverseService, types
**✅ Phase 2 Complete** — Universes tab, Statistics section, Guide card
**✅ Phase 3 Complete** — Universe Setup Wizard with calendar/map/schema steps
**📋 Phase 4 Pending** — Enhanced features (dashboard, filtering, batch operations)

---

## Additional Features Implemented

### Guide Tab: Universe Notes Section
- Added "Universe notes" collapsible to Essential Properties card
- Lists all essential universe frontmatter properties (cr_type, cr_id, name, description, author, genre, status, default_calendar, default_map)

### Context Menu: Add Essential Universe Properties
- Right-click on universe notes shows Canvas Roots submenu
- "Add essential universe properties" action adds all essential fields
- Follows same pattern as person/place/source/event notes

### Universes Tab: Actions Card
- Actions card at top with standard Obsidian Setting pattern
- "Create universe" (CTA) - opens wizard
- "Create universes base" - creates Obsidian base file for browsing universes

### Universes Base Template
- Created `src/constants/universes-base-template.ts`
- 12 pre-configured views: All, By Status (active/draft/archived), By Genre, By Author, With/Without Calendars, With/Without Maps, Recently Created
- Public `createUniversesBaseTemplate()` method in main.ts
