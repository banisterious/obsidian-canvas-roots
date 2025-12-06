# Chronological Story Mapping

> **Status:** Complete (Phase 7 Complete)
> **Target Version:** 0.9.5+
> **Last Updated:** 2025-12-06

## Overview

Chronological Story Mapping introduces event-based timeline visualization to Canvas Roots, enabling users to document and visualize life events in chronological order. The feature supports both genealogists (who derive events from sources) and worldbuilders (who create canonical events directly).

## User Research Insights

Based on user feedback (December 2025), the following priorities emerged:

### Core Requirements

1. **Single Source of Truth**: Events should be promotable from embedded text to standalone notes seamlessly. Users want `born: 1976` convertible to `born: [[1976]]` without friction.

2. **Flexibility Over Structure**: Support for partial/incomplete data that evolves over time. The `date_precision` property is highly valued for handling uncertain dates.

3. **Relative Ordering Without Exact Dates**: Critical requirement - users need to express "Event A happened before B but after C" even without knowing actual dates. This enables meaningful timelines from incomplete research.

4. **Event Relationships**: Support for prev/next relationships between events (like periodic notes chains), and parent/child relationships (events → timelines → eras → calendars).

### Visualization Preferences

- **Gantt-style timeline view** with flexible zoom (eras → days)
- **Color-coding by period/era** on canvases
- **Graph-friendly structure** that can export to Canvas/Excalidraw
- **Custom sort property** based on timeline relationships for Bases sorting

### User Personas Update

The existing genealogist/worldbuilder personas should be supplemented with:

| Persona | Focus | Key Needs |
|---------|-------|-----------|
| **Writer/Plotter** | Narrative timeline for storytelling | Rearranging events, narrative event types (`plot_point`, `flashback`), flexible ordering |

Writers particularly value narrative event types and the ability to visualize story structure alongside chronology.

## Design Principles

### Events vs. Facts

**Events are occurrences; facts are assertions about those occurrences.**

- An `event` is a discrete occurrence: "John was born on March 15, 1850 in Dublin"
- A `fact` in a proof summary is an assertion: "I conclude John's birth date was March 15, 1850, based on these sources"

This distinction means:
- Person notes keep their current structure (no embedded `events` array)
- Events link *to* people via the `person` field, not the reverse
- Proof summaries can reference events as supporting evidence

### Dual-Path Creation

Different users have different workflows:

| User Type | Primary Workflow | Entry Point |
|-----------|------------------|-------------|
| Genealogist (casual) | "I found a document, let me record what it says" | Source → Extract events |
| Genealogist (power) | "I'm building a timeline to find research gaps" | Timeline → Create event → Attach sources |
| Worldbuilder (casual) | "This character did something interesting" | Person → Add life event |
| Worldbuilder (power) | "I need a coherent timeline for my universe" | Timeline → Batch create events |
| Writer/Plotter | "I need to visualize my story's timeline" | Timeline → Arrange events → Export to Canvas/Excalidraw |

---

## Event Schema

### Frontmatter Structure

```yaml
type: event
cr_id: "20251205123456"
title: "Birth of John Smith"
event_type: birth
date: 1850-03-15
date_precision: exact
person: "[[John Smith]]"
place: "[[Dublin, Ireland]]"
sources:
  - "[[1850 Birth Certificate]]"
confidence: high
description: "Born at 23 Grafton Street, Dublin"
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"event"` | Yes | Note type identifier |
| `cr_id` | string | Yes | Unique identifier |
| `title` | string | Yes | Display title for the event |
| `event_type` | EventType | Yes | Type of event (see below) |
| `date` | string | Yes | Event date (ISO format or fictional calendar) |
| `date_precision` | DatePrecision | Yes | How precise the date is |
| `person` | wikilink | No | Primary person involved |
| `persons` | wikilink[] | No | Multiple people (for marriages, etc.) |
| `place` | wikilink | No | Where the event occurred |
| `sources` | wikilink[] | No | Sources documenting this event |
| `confidence` | Confidence | No | Confidence level (default: `medium`) |
| `description` | string | No | Additional details |
| `is_canonical` | boolean | No | For worldbuilders: this is authoritative truth |
| `universe` | string | No | Fictional universe (for worldbuilding) |
| `date_system` | string | No | Fictional date system ID (for non-Gregorian dates) |
| `before` | wikilink[] | No | Events that happen after this one (for relative ordering) |
| `after` | wikilink[] | No | Events that happen before this one (for relative ordering) |
| `timeline` | wikilink | No | Parent timeline note this event belongs to |
| `sort_order` | number | No | Computed sort value for Bases (auto-generated from relationships) |
| `groups` | string[] | No | Groups/factions involved (for filtering by nation, faction, etc.) |

### Fictional Date System Integration

Events integrate with Canvas Roots' existing [Fictional Date Systems](../../wiki-content/Fictional-Date-Systems.md) feature. When `date_system` is specified, the `date` field is parsed using that system's era definitions.

**Example with Middle-earth Calendar:**
```yaml
type: event
cr_id: "20251205123456"
title: "Bilbo's Birthday Party"
event_type: anecdote
date: "TA 3001"
date_system: middle_earth
date_precision: year
person: "[[Bilbo Baggins]]"
place: "[[Bag End]]"
universe: "Middle-earth"
is_canonical: true
```

**Integration points:**
- `DateService.parseDate()` resolves fictional dates to `ParsedFictionalDate`
- `canonicalYear` from `ParsedFictionalDate` enables cross-era sorting
- Timeline views display dates using the appropriate era abbreviations
- Date picker in CreateEventModal offers era selection when a date system is active
- Universe-scoped date systems auto-select based on person's `universe` field

**Sorting across eras:**

The `canonicalYear` computed from `ParsedFictionalDate` enables correct chronological ordering even across different eras:

```typescript
// TA 3001 → canonicalYear = 3001 (Third Age epoch = 0)
// FoA 1   → canonicalYear = 3022 (Fourth Age epoch = 3021)
// Events sort correctly: TA 3001 < FoA 1
```

### Date Precision

```typescript
type DatePrecision =
  | 'exact'      // Known to the day: 1850-03-15
  | 'month'      // Known to the month: 1850-03
  | 'year'       // Known to the year: 1850
  | 'decade'     // Known to the decade: 1850s
  | 'estimated'  // Approximate: "circa 1850"
  | 'range'      // Between two dates: 1848-1852
  | 'unknown';   // Date unknown, use relative ordering
```

### Relative Ordering (Dateless Events)

A critical requirement from user research: support meaningful timelines even when exact dates are unknown. Events can specify their position relative to other events using `before` and `after` fields.

**Example: Immigration Timeline with Unknown Date**
```yaml
type: event
title: "Person A moved to the Americas"
event_type: immigration
date_precision: unknown
after:
  - "[[Marriage of Person A]]"    # We know this happened after marriage
before:
  - "[[Birth of First Child]]"    # We know this happened before first child
person: "[[Person A]]"
description: "Earlier than X date but later than Y date - actual date unknown"
```

**Sort Order Computation:**

The `sort_order` property is auto-computed from:
1. Exact dates (highest priority)
2. Relative ordering constraints (`before`/`after`)
3. Timeline membership
4. Manual override

This enables correct chronological ordering in Bases without requiring additional sorting values:

```typescript
// Topological sort resolves: Marriage → Immigration → Birth of Child
// Even though Immigration has no date, it sorts correctly based on constraints
```

**Graph Visualization:**

The `before`/`after` relationships create a directed graph that can be:
- Visualized in Obsidian's graph view (as links)
- Exported to Canvas with positioned nodes
- Exported to Excalidraw for further editing
- Displayed in a Gantt-style timeline with relative positioning

### Event Types

**Core types** (vital events):
- `birth` - Birth of a person
- `death` - Death of a person
- `marriage` - Marriage ceremony
- `divorce` - Divorce or annulment

**Extended types** (common life events):
- `residence` - Change of residence
- `occupation` - Employment or career change
- `military` - Military service event
- `immigration` - Immigration or emigration
- `education` - Educational milestone

**Narrative types** (for storytelling):
- `anecdote` - Family story or personal event
- `lore_event` - Worldbuilding canonical event
- `plot_point` - Key story beat or turning point
- `flashback` - Event referenced in non-chronological narrative
- `foreshadowing` - Event that sets up future developments
- `backstory` - Pre-narrative event that informs character/plot
- `climax` - Peak dramatic moment
- `resolution` - Story conclusion event

**Custom types**: Users can define additional event types via settings.

---

## Implementation Phases

### Phase 1: Event Notes Foundation

**Goal:** Basic event note support with manual creation.

**Deliverables:**
- `src/events/types/event-types.ts` - Type definitions
- `src/events/services/event-service.ts` - CRUD operations
- `CreateEventModal` - Modal for creating/editing events
- Event note validation in schema validator
- Event templates in Template Snippets modal

**UI Entry Points:**
- Command palette: "Create event note"
- Person detail view: "Add life event" button

### Phase 2: Person Timeline View

**Goal:** Display events for a single person in chronological order.

**Deliverables:**
- `src/events/ui/person-timeline.ts` - Timeline component
- Integration with person detail view in Control Center
- Timeline visualization (vertical list with date markers)
- Click-to-navigate to event notes

**Timeline Display:**
```
├─ 1850-03-15  Birth
│              Dublin, Ireland
│              [1850 Birth Certificate]
│
├─ 1872-06-20  Marriage
│              St. Patrick's Church
│              [Marriage Register]
│
├─ 1875        Residence (year only)
│              Boston, Massachusetts
│
└─ 1920-11-03  Death
               Boston, Massachusetts
               [Death Certificate]
```

### Phase 3: Source Event Extraction

**Goal:** Derive events from source documentation.

**Deliverables:**
- "Extract events" action on source notes
- `ExtractEventsModal` - UI for selecting what events to create
- Pre-populated event fields from source metadata
- Automatic source linking

**Workflow:**
1. User views a source (e.g., 1850 Census)
2. Clicks "Extract events"
3. Modal suggests extractable events:
   - Residence of John Smith, 1850, Ohio
   - Occupation of John Smith, 1850, Farmer
4. User selects which to create
5. Events created with source automatically linked

### Phase 4: Timeline Tab in Control Center

**Goal:** Dedicated timeline view with filtering and navigation.

**Deliverables:**
- New "Timeline" tab in Control Center
- Event list with sorting/filtering
- Filter by: person, event type, date range, confidence
- Statistics: events by type, date coverage gaps

**UI Components:**
- Event table with sortable columns
- Create event button
- Filter controls
- "Timeline gaps" analysis

### Phase 5: Family Timeline View

**Goal:** Aggregate timeline for family units.

**Deliverables:**
- Family timeline aggregating person + spouse + children
- Color-coded by person
- Relationship context (shows how people are connected)
- Expand/collapse by generation

### Phase 6: Place Timeline View

**Goal:** Events at a specific location over time.

**Deliverables:**
- Timeline filtered by place
- Shows all events at a location
- Useful for tracking family presence in an area
- Integration with Maps tab

### Phase 7: Canvas/Excalidraw Export

**Goal:** Export timeline to visual canvas formats for further editing.

**Deliverables:**
- "Export to Canvas" action from Timeline tab
- "Export to Excalidraw" action (if Excalidraw plugin installed)
- Events positioned based on chronological/relative ordering
- Color-coded nodes by event type or period/era
- `before`/`after` relationships rendered as edges
- Gantt-style horizontal layout option

**Use Cases:**
- Writers visualizing story structure
- Worldbuilders creating timeline reference canvases
- Researchers documenting family history for presentation

### Phase 8: Leaflet Time Animation (Advanced)

**Goal:** Animated map showing events over time.

**Deliverables:**
- Time slider control on map view
- Markers appear/disappear as time advances
- Animation playback controls
- Path visualization (migration routes)

**Dependencies:** Requires Leaflet.js time slider plugin.

---

## Integration Points

### With Existing Features

| Feature | Integration |
|---------|-------------|
| Person notes | Events link via `person` field; timeline shown in person detail |
| Place notes | Events link via `place` field; place timeline view |
| Source notes | "Extract events" action; events link via `sources` field |
| Proof summaries | Can cite events as evidence |
| Fictional date systems | `date_system` field enables custom calendars; `DateService` parses era-based dates; `canonicalYear` enables cross-era sorting |
| Maps tab | Place timeline; animated map visualization |
| Universe filtering | Events inherit universe from linked person; date system auto-selects based on universe |
| Canvas/Excalidraw | Export timeline graphs; events as nodes with ordering edges |
| Obsidian Graph | `before`/`after` links visible in graph view; navigate event chains |
| Bases | `sort_order` property enables automatic chronological sorting |
| Value Aliases | Custom event type values mapped to canonical types |

### Calendarium Plugin Integration

[Calendarium](https://github.com/javalent/calendarium) is a popular community plugin for custom fantasy/sci-fi calendars. Canvas Roots can optionally integrate with it for users who prefer Calendarium's richer calendar features.

**Calendarium API Access:**
```typescript
// Check if Calendarium is available
if (window.Calendarium) {
    const api = window.Calendarium;
    const calendars = api.getCalendars();  // List of calendar names
    const calApi = api.getAPI('Middle-earth');  // Calendar-specific API

    // Parse and format dates
    const date = calApi.parseDate('TA 3001');
    const display = calApi.toDisplayDate(date);

    // Query events
    const events = calApi.getEventsOnDay(date);
}
```

**Integration Modes:**

| Mode | Behavior |
|------|----------|
| **Standalone** | Use Canvas Roots' built-in fictional date systems (default) |
| **Calendarium Primary** | Read calendars from Calendarium; Canvas Roots events sync to Calendarium |
| **Bidirectional** | Events visible in both systems; changes sync both ways |

**Data Mapping:**

| Canvas Roots Field | Calendarium Field |
|--------------------|-------------------|
| `date` | `fc-date` or `fc-start` |
| `date_end` (for ranges) | `fc-end` |
| `title` | `fc-display-name` |
| `description` | `fc-description` |
| `event_type` | `fc-category` (mapped to category ID) |

**Sync Behavior:**
- **Export to Calendarium**: Add `fc-*` frontmatter fields to event notes
- **Import from Calendarium**: Parse `fc-*` fields when loading events
- **Calendar Translation**: Use `calApi.translate(date, fromCal, toCal)` for cross-calendar events

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `calendariumIntegration` | `'none' \| 'read' \| 'sync'` | `'none'` | Integration mode |
| `calendariumDefaultCalendar` | string | `''` | Default Calendarium calendar for new events |
| `syncCalendariumEvents` | boolean | `false` | Show Calendarium events in Canvas Roots timelines |

**Implementation Notes:**
- Check `app.plugins.enabledPlugins.has('calendarium')` before accessing API
- Calendarium uses 0-indexed months; align with Canvas Roots' date parsing
- Calendarium's `CalDate` type: `{year: number, month: number, day: number}`
- Use `api.onSettingsLoaded(callback)` to defer initialization until Calendarium is ready

### New Reports in Data Quality Tab

- **Timeline gaps**: Periods with no documented events
- **Unsourced events**: Events without source citations
- **Orphan events**: Events not linked to any person

---

## UI Mockups

### Person Timeline (Phase 2)

```
┌─────────────────────────────────────────────────┐
│ Timeline: John Smith                            │
├─────────────────────────────────────────────────┤
│ ● 1850-03-15  Birth                         [→] │
│ │             Dublin, Ireland                   │
│ │             📄 1850 Birth Certificate         │
│ │                                               │
│ ● 1872-06-20  Marriage                      [→] │
│ │             St. Patrick's Church              │
│ │             📄 Marriage Register              │
│ │             👤 Mary O'Brien                   │
│ │                                               │
│ ○ 1875       Residence (year)               [→] │
│ │             Boston, Massachusetts             │
│ │             ⚠️ No sources                     │
│ │                                               │
│ ● 1920-11-03  Death                         [→] │
│               Boston, Massachusetts             │
│               📄 Death Certificate              │
└─────────────────────────────────────────────────┘
```

### Timeline Tab (Phase 4)

```
┌─────────────────────────────────────────────────┐
│ Timeline                                        │
├─────────────────────────────────────────────────┤
│ [+ Create event]  [View templates]              │
│                                                 │
│ Filter: [All types ▼] [All people ▼] [1800-1950]│
├─────────────────────────────────────────────────┤
│ Date       │ Type    │ Person      │ Place     │
│────────────┼─────────┼─────────────┼───────────│
│ 1850-03-15 │ Birth   │ John Smith  │ Dublin    │
│ 1852-07-01 │ Birth   │ Mary O'Brien│ Cork      │
│ 1872-06-20 │ Marriage│ John & Mary │ Dublin    │
│ ...        │         │             │           │
├─────────────────────────────────────────────────┤
│ Statistics                                      │
│ ─────────────────────────────────               │
│ Total events: 47                                │
│ By type: Birth (12), Death (8), Marriage (6)...│
│ ⚠️ Gap detected: 1885-1892 (7 years, no events)│
└─────────────────────────────────────────────────┘
```

---

## Settings

New settings under "Canvas Roots → Events":

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enableEvents` | boolean | `true` | Enable events feature |
| `defaultEventConfidence` | Confidence | `medium` | Default confidence for new events |
| `showEventSourceWarnings` | boolean | `true` | Warn about unsourced events |
| `customEventTypes` | EventType[] | `[]` | User-defined event types |

---

## File Structure

```
src/events/
├── types/
│   └── event-types.ts          # Type definitions
├── services/
│   └── event-service.ts        # CRUD and queries
├── ui/
│   ├── create-event-modal.ts   # Create/edit modal
│   ├── extract-events-modal.ts # Extract from source
│   ├── person-timeline.ts      # Person timeline component
│   ├── timeline-tab.ts         # Control Center tab
│   └── family-timeline.ts      # Family timeline view
└── constants/
    └── event-types.ts          # Built-in event types
```

---

## Design Decisions

### Sort Order Algorithm

**Decision: Float-based interpolation with on-demand recomputation**

The `sort_order` property uses floating-point numbers to enable flexible interpolation:

```typescript
// Dated events: year.mmdd format (or epoch for sub-day precision)
sort_order: 1850.0315      // March 15, 1850

// Undated events: interpolated between neighbors
sort_order: 1851.5         // Midpoint between dated neighbors
sort_order: 1851.25        // Can subdivide further without recomputing others
```

**Rationale:**
- Floats allow inserting events between any two existing values without cascading updates
- Simple to understand and debug
- Internal implementation detail - can evolve without affecting user data

**Recomputation:**
- **On-demand only**: "Recompute sort order" command in Timeline tab
- **Not auto on save**: Avoids unexpected changes, gives user control
- **Cycle detection**: Warn user but don't block; exclude cyclic events from sort

**Future flexibility:**
- Algorithm is internal; interpretation can change
- `sort_order` is just a number; meaning derived at runtime

### Timeline Note Schema

**Decision: Backlinks-first, explicit list deferred**

Timeline notes use backlink discovery as the primary mechanism:

```yaml
type: timeline
cr_id: "20251206123456"
title: "Book 1 Timeline"
description: "Main narrative arc"
universe: "My Fantasy World"
# Events discovered via backlinks (events have `timeline: [[This Note]]`)
```

**Rationale:**
- Single source of truth (on event notes via `timeline` field)
- Less maintenance burden for users
- Matches Obsidian mental model (links create relationships)
- Events work without timeline notes (optional grouping)

**Deferred to future phase:**
- Explicit `events` array for manual ordering (if users request)
- Additional fields: `era`, `calendar`, `date_range`

**Event membership:**
| Method | Status |
|--------|--------|
| Backlinks (`timeline` field on events) | Phase 1 |
| Explicit `events` array | Future (if needed) |

---

## Open Questions

1. **Event deduplication**: How to handle the same event documented by multiple sources? Should events merge or remain separate?
   - *Proposed*: Keep events separate but linkable. Multiple source citations on one event; or separate "observation" events that reference the same canonical event.

2. **Multi-person events**: For marriages, do we create one event linked to both people, or two events (one per person)?
   - *Proposed*: Single event with `persons` array for multi-person events. Appears in both people's timelines.

3. **Event inheritance**: Should children automatically inherit parent marriage events in their timeline?
   - *Proposed*: No automatic inheritance. Family Timeline view aggregates related events without duplicating data.

4. **Fictional calendar display**: How to sort events across different fictional calendar systems in a global timeline?
   - *Resolved*: Use `canonicalYear` from `ParsedFictionalDate` for cross-era sorting. Each date system defines epoch offsets.

5. **GEDCOM export**: How should events map to GEDCOM EVEN tags?
   - *Proposed*: Map event types to GEDCOM tags (BIRT, DEAT, MARR, etc.); custom types become EVEN with TYPE subtag.

6. **Event promotion workflow**: How should users "promote" an embedded date to an event note?
   - *User feedback*: Critical requirement. Should support seamless transition from `born: 1976` to `born: [[1976 Birth Event]]`.
   - *Proposed*: "Create event from property" action that generates event note and updates original property to wikilink.

7. **Timeline note type**: Should there be a `type: timeline` note to organize related events?
   - *User feedback*: Users want dedicated timeline/calendar notes as "single source of truth" for event collections.
   - *Proposed*: Add `type: timeline` with `events` array linking to event notes; serves as grouping container.

---

## Success Criteria

Phase 1 is complete when:
- [x] Event notes can be created via modal
- [x] Event notes validate correctly
- [x] Event templates available in Template Snippets modal

Phase 2 is complete when:
- [x] Person detail view shows timeline
- [x] Timeline displays events chronologically
- [x] Events are clickable/navigable

Phase 3 is complete when:
- [x] "Extract events" action appears on source notes
- [x] Events created from sources have automatic source links
- [x] Multiple events can be extracted from one source

Phase 4 is complete when:
- [x] Timeline tab appears in Control Center (as Timeline card in Events tab)
- [x] Events can be filtered by type, person, date range
- [x] Statistics show event distribution (gap analysis, unsourced/orphan detection)

Phase 5 is complete when:
- [x] Family timeline aggregates events from person + spouse + children
- [x] Events color-coded by family member with legend
- [x] Relationship context shown (self, spouse, child)
- [x] Family timeline badge on person list items (users icon)

Phase 6 is complete when:
- [x] Place timeline card added to Maps tab
- [x] Place selector dropdown with event counts
- [x] Place timeline shows all events at selected location
- [x] Family presence analysis with visual bars showing date ranges per person
- [x] Timeline summary (event count, date range, people present)
- [x] Events clickable to navigate to event notes

Phase 7 is complete when:
- [x] "Export to Canvas" generates positioned event nodes
- [x] `before`/`after` relationships render as edges
- [x] Excalidraw export available (when plugin installed)
- [x] Color-coding by event type or period working

---

## References

- [Roadmap entry](../../wiki-content/Roadmap.md#chronological-story-mapping)
- [proof-types.ts](../../src/sources/types/proof-types.ts) - Related FactKey definitions
- [source-types.ts](../../src/sources/types/source-types.ts) - Source linking patterns
- [date-types.ts](../../src/dates/types/date-types.ts) - Fictional date system types
- [date-service.ts](../../src/dates/services/date-service.ts) - Date parsing and formatting
- [Fictional Date Systems wiki](../../wiki-content/Fictional-Date-Systems.md) - User documentation
- [Calendarium plugin](https://github.com/javalent/calendarium) - Community plugin for fantasy calendars
- [Calendarium source reference](../developer/calendarium-reference/) - Local copy of Calendarium source for API reference
