# Chronological Story Mapping

> **Status:** Planned
> **Target Version:** TBD
> **Last Updated:** 2025-12-05

## Overview

Chronological Story Mapping introduces event-based timeline visualization to Canvas Roots, enabling users to document and visualize life events in chronological order. The feature supports both genealogists (who derive events from sources) and worldbuilders (who create canonical events directly).

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
  | 'range';     // Between two dates: 1848-1852
```

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

### Phase 7: Leaflet Time Animation (Advanced)

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

## Open Questions

1. **Event deduplication**: How to handle the same event documented by multiple sources? Should events merge or remain separate?

2. **Multi-person events**: For marriages, do we create one event linked to both people, or two events (one per person)?

3. **Event inheritance**: Should children automatically inherit parent marriage events in their timeline?

4. **Fictional calendar display**: How to sort events across different fictional calendar systems in a global timeline?

5. **GEDCOM export**: How should events map to GEDCOM EVEN tags?

---

## Success Criteria

Phase 1 is complete when:
- [ ] Event notes can be created via modal
- [ ] Event notes validate correctly
- [ ] Event templates available in Template Snippets modal

Phase 2 is complete when:
- [ ] Person detail view shows timeline
- [ ] Timeline displays events chronologically
- [ ] Events are clickable/navigable

Phase 3 is complete when:
- [ ] "Extract events" action appears on source notes
- [ ] Events created from sources have automatic source links
- [ ] Multiple events can be extracted from one source

Phase 4 is complete when:
- [ ] Timeline tab appears in Control Center
- [ ] Events can be filtered by type, person, date range
- [ ] Statistics show event distribution

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
