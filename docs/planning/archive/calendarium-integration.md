# Calendarium Integration Planning

## Overview

This document outlines the integration between Charted Roots and the [Calendarium](https://github.com/javalent/calendarium) plugin, enabling shared calendar definitions, bidirectional event sync, and cross-calendar date translation.

---

## User Feedback (December 2024)

Feedback gathered from Calendarium users on what they'd want from this integration:

### Primary Use Case
- **Calendar definition is the main value** - Users want Calendarium for setting up calendar structure (dates, eras), not primarily for events
- Templates with `fc-date` and `fc-calendar` fields are common workflow
- Single custom calendar alongside Obsidian's default date properties is typical
- Multiple calendars for comparing dates across in-world cultures is a secondary use case

### Date Ranges Are Important
- `fc-date` for start, `fc-end` for end dates
- For people files: lifespans, reign periods, etc.
- **Conclusion:** Date range support (`fc-end`) should be prioritized in Phase 2

### Pain Points with Calendarium
1. **Custom timespans/formats** - Not great for naming things outside day-month-year structure
2. **Seasons vs Eras confusion** - "Seasons" means weather in Calendarium, but users want eras; terminology is unintuitive
3. **Eras should be part of date structure** - Users want `Era-Year-Month-Day` format; struggle with math to determine what year a note should be in for the right era
4. **Per-calendar frontmatter fields** - Would prefer custom frontmatter per calendar (e.g., `mycalendar-date`, `mycalendar-end`) rather than `fc-calendar` + `fc-date` pattern, allowing one note to have dates across multiple calendars

### Implications for Charted Roots
- **Phase 1 validated** - Reading calendar definitions eliminates the main pain point (duplicate config)
- **Era handling opportunity** - Charted Roots' fictional date systems could offer better era UX than Calendarium
- **Multi-calendar per note** - Feature request worth tracking; goes beyond current scope but could differentiate Charted Roots

---

## What is Calendarium?

Calendarium is "the ultimate Obsidian plugin for crafting mind-bending fantasy and sci-fi calendars." It allows users to define custom calendars with:

- **Custom months** - any number, any length, any names
- **Custom weeks/weekdays**
- **Leap days** with complex interval rules
- **Multiple eras** (e.g., "Third Age", "Fourth Age")
- **Named years**
- **Seasons** with configurable dates
- **Moons** with phase calculations

Events are tracked via frontmatter fields (`fc-date`, `fc-calendar`, `fc-category`, etc.) or inline HTML spans.

---

## Why Integrate?

**The problem:** Worldbuilders using Charted Roots for fictional genealogies often also use Calendarium for their world's calendar. Currently, they must configure their calendar system in both plugins separately.

**The solution:** Let Charted Roots read Calendarium's calendar definitions, eliminating duplicate configuration.

**Practical example:** A Middle-earth genealogist using both plugins could:
- Define the Shire Reckoning calendar once in Calendarium
- Have Charted Roots automatically recognize that calendar for date entry
- Optionally see Calendarium events on Charted Roots timelines
- Get proper date sorting even with complex fictional calendars

**Target Users:** Worldbuilders using fictional date systems who want a unified timeline experience across both plugins. This integration adds little value for standard Gregorian genealogy users.

**Design Principle:** The integration is designed to be invisible to users who don't need it. Settings default to off, no UI changes appear unless Calendarium is installed AND enabled, and existing fictional date systems continue to work independently.

**Dependencies:**
- Calendarium plugin (optional - graceful fallback when not installed)
- Charted Roots Fictional Date Systems (v0.7.0+)
- Charted Roots Event Notes (v0.10.0+)

---

## Integration Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| **Standalone** | Charted Roots manages its own calendars using built-in fictional date systems | Users without Calendarium installed |
| **Calendarium Primary** | Read calendars from Calendarium; Charted Roots events sync to Calendarium | Existing Calendarium users who want Charted Roots timeline features |
| **Bidirectional** | Events visible in both systems; changes sync both ways | Power users wanting unified experience across both plugins |

---

## Calendarium API

### Availability Check

```typescript
// Check if Calendarium is available
function isCalendariumAvailable(): boolean {
    return !!(window as any).Calendarium;
}

// Check if plugin is enabled (more reliable)
function isCalendariumEnabled(app: App): boolean {
    return app.plugins.enabledPlugins.has('calendarium');
}
```

### API Access

```typescript
// Get the Calendarium API
if (window.Calendarium) {
    const api = window.Calendarium;

    // List all available calendars
    const calendars = api.getCalendars();  // string[]

    // Get calendar-specific API
    const calApi = api.getAPI('Middle-earth');

    // Parse and format dates
    const date = calApi.parseDate('TA 3001');
    const display = calApi.toDisplayDate(date);

    // Query events on a specific day
    const events = calApi.getEventsOnDay(date);

    // Translate between calendars
    const translated = calApi.translate(date, 'Middle-earth', 'Gregorian');
}
```

### Deferred Initialization

Calendarium may not be ready immediately on plugin load. Use the settings callback:

```typescript
if (window.Calendarium) {
    window.Calendarium.onSettingsLoaded(() => {
        // Safe to access calendars now
        this.initializeCalendariumIntegration();
    });
}
```

### CalDate Type

Calendarium uses a specific date structure:

```typescript
interface CalDate {
    year: number;
    month: number;  // 0-indexed (January = 0)
    day: number;
}
```

**Important:** Calendarium uses 0-indexed months. Charted Roots' date parsing should align with this convention when syncing.

---

## Data Mapping

### Event Notes ↔ Calendarium Events

| Charted Roots Field | Calendarium Field | Notes |
|--------------------|-------------------|-------|
| `date` | `fc-date` or `fc-start` | Start date of event |
| `date_end` | `fc-end` | End date for ranges |
| `title` | `fc-display-name` | Event display name |
| `description` | `fc-description` | Event description |
| `event_type` | `fc-category` | Mapped to Calendarium category ID |
| `calendar_system` | `fc-calendar` | Which calendar this event uses |
| (image path) | `fc-img` | Event image |

### Fictional Date Systems ↔ Calendarium Calendars

| Charted Roots Field | Calendarium Equivalent |
|--------------------|------------------------|
| `date_system` name | Calendar name |
| Era definitions | Calendar eras |
| Month names | Month configuration |
| Epoch year | Calendar epoch |

---

## Sync Behavior

### Export to Calendarium

When a Charted Roots event note is created or updated:

1. Check if `calendariumIntegration` is `'sync'`
2. Add/update `fc-*` frontmatter fields in the event note
3. Calendarium picks up the event via its frontmatter scanning

```yaml
---
cr_type: event
event_type: birth
date: "TA 2931"
calendar_system: middle-earth
person: "[[Aragorn]]"
# Added by sync:
fc-date:
  year: 2931
  month: 2
  day: 1
fc-calendar: Middle-earth
fc-category: birth
fc-display-name: "Birth of Aragorn"
---
```

### Import from Calendarium

When loading events, check for `fc-*` fields:

1. Parse `fc-date` or `fc-start` as the event date
2. Use `fc-calendar` to determine which date system applies
3. Map `fc-category` to Charted Roots `event_type`
4. Respect `fc-end` for date ranges

### Calendar Translation

For cross-calendar events (e.g., comparing Middle-earth dates to real-world):

```typescript
// Translate a date from one calendar to another
const middleEarthDate = calApi.parseDate('TA 3001');
const gregorianDate = api.translate(middleEarthDate, 'Middle-earth', 'Gregorian');
```

---

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `calendariumIntegration` | `'off' \| 'read' \| 'sync'` | `'off'` | Integration mode |
| `calendariumDefaultCalendar` | `string` | `''` | Default Calendarium calendar for new events |
| `syncCalendariumEvents` | `boolean` | `false` | Show Calendarium events in Charted Roots timelines |

### Settings UI

Add to Settings → Integrations section:

```
┌─────────────────────────────────────────────────────────────┐
│ Calendarium Integration                                      │
├─────────────────────────────────────────────────────────────┤
│ Integration mode                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Off ▼                                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Controls how Charted Roots interacts with Calendarium.        │
│ • Off: No integration                                        │
│ • Read-only: Import calendars, don't write fc-* fields      │
│ • Bidirectional: Full sync between both plugins             │
│                                                              │
│ Default calendar                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Middle-earth ▼                                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Calendar to use when creating new events.                    │
│                                                              │
│ ☐ Show Calendarium events on timelines                      │
│   Display events created in Calendarium on Charted Roots     │
│   person and place timelines.                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Effort Assessment

### Phase 1 delivers 80% of the value

**Phase 1 (Read-only calendar import)** eliminates the main pain point: duplicate calendar configuration. Users define their calendar once in Calendarium and Charted Roots reads it. This is low-medium effort and should be implemented first.

Phases 2-4 add incremental value but with increasing complexity. Consider shipping Phase 1, gathering user feedback, then deciding if deeper integration is warranted.

### Effort Estimates

| Phase | Effort | Value | Notes |
|-------|--------|-------|-------|
| Phase 1 | 1-2 days | High | Calendar import eliminates duplicate config |
| Phase 2 | 2-3 days | Medium-High | Event display on timelines; date ranges (`fc-end`) important per user feedback |
| Phase 3 | 3-5 days | Low-Medium | Bidirectional sync, conflict handling |
| Phase 4 | 1 day | Low | Leverages Calendarium's translate() API |

### Third-Party Dependency Risk

Calendarium is actively developed by a third party (javalent). While the plugin is mature and the API appears stable, breaking changes could affect integration. Mitigation:
- Graceful fallback if API changes
- Version checking if needed
- Minimal coupling (read calendar definitions, don't depend on internal structures)

---

## Calendarium Date Model Complexity

Calendarium's date model is significantly richer than Charted Roots needs:

| Calendarium Feature | Example | Charted Roots Need? |
|---------------------|---------|-------------------|
| One-time dates | `TA 3001-3-15` | **Yes** - core use case |
| Named months | `144-Ches-15` | **Yes** - for fictional calendars |
| Eras | `TA`, `FA`, `SA` | **Yes** - already supported |
| Date ranges | `fc-start` + `fc-end` | **Yes** - user feedback confirms: lifespans, reigns, residences |
| Recurring events | `*-*-15` (15th of every month) | **No** - genealogy events are one-time |
| Wildcards | `*-March-*` (any day in March) | **No** |
| Leap day logic | Complex interval rules | **No** - overkill for genealogy |

**Recommendation:** Subset the model. Read Calendarium's calendar *definitions* (month names, eras) and support one-time dates plus date ranges for events. Recurring events and complex leap day logic aren't relevant to genealogy use cases.

---

## Planned Features

### Phase 1: Calendar Import (Read-only) — ✅ Complete (v0.12.0)

- [x] Detect Calendarium installation
- [x] Import calendar definitions (names, eras, months)
- [x] Display imported calendars in date system dropdown
- [x] Graceful fallback when Calendarium not installed
- [x] Hide integration settings entirely if Calendarium not installed

#### Phase 1 Implementation Details

**Files created:**
- `src/integrations/calendarium-bridge.ts` - Bridge service for Calendarium API

**Files modified:**
- `src/settings.ts` - Added `calendariumIntegration: 'off' | 'read'` setting
- `src/dates/ui/date-systems-card.ts` - Added "From Calendarium" section (table, read-only)
- `src/events/ui/create-event-modal.ts` - Included Calendarium calendars in dropdown

**UI Implementation:**
- Date Systems Card uses three-section grouping:
  1. Built-in systems (Middle-earth, Westeros) - table, view-only
  2. From Calendarium (if enabled) - table, view-only
  3. Custom systems (user-defined) - cards, editable
- Dropdowns (Create Event Modal, etc.) use a flat list - no visual distinction needed
- Integrations card hidden when Calendarium is not installed

### Phase 2: Event Display (Read-only) — ✅ Complete

**Scope:** Read `fc-*` fields from Charted Roots event notes (notes with `cr_type: event`) to display them on timelines. This phase does not import pure Calendarium events (notes without `cr_type`).

**Settings:**
- [x] Add `syncCalendariumEvents: boolean` setting (default: false)
- [x] Add UI toggle in Integrations card: "Show Calendarium dates on timelines"

**Date Parsing:**
- [x] Parse `fc-date` or `fc-start` as event start date
- [x] Parse `fc-end` as event end date (for date ranges: lifespans, reigns, residences)
- [x] Handle 0-indexed month conversion in CalendariumBridge (Calendarium months are 0-indexed)
- [x] Use `fc-calendar` value as `dateSystem` for calendar filtering

**Timeline Display:**
- [x] Display events with `fc-*` dates on person timelines
- [x] Display events with `fc-*` dates on place timelines
- [x] Add calendar filter dropdown to timeline views (appears when multiple calendars exist)
- [x] Add timeline badge to People tab table rows (click to open timeline modal)

#### Phase 2 Implementation Details

**Files modified:**
- `src/settings.ts` - Added `syncCalendariumEvents: boolean` setting
- `src/integrations/integrations-settings.ts` - Added sync toggle UI in Integrations card
- `src/integrations/calendarium-bridge.ts` - Added `parseFcDate()` and `calendariumDateToString()` methods
- `src/events/services/event-service.ts` - Extended `parseEventNote()` to check fc-* fields
- `src/events/ui/person-timeline.ts` - Added calendar filter dropdown
- `src/events/ui/place-timeline.ts` - Added calendar filter dropdown
- `src/ui/control-center.ts` - Added timeline badge to person table rows, `showPersonTimelineModal()`
- `styles/events.css` - Added filter and modal CSS styles

### Phase 3: Bidirectional Sync

- [ ] Write `fc-*` fields when creating/updating events
- [ ] Map Charted Roots event types to Calendarium categories
- [ ] Handle conflicts (both plugins modify same event)
- [ ] Sync status indicator in event notes

**Complexity note:** Calendarium uses a Web Worker for file watching. Timing issues could arise when both plugins modify the same note. Thorough testing required.

### Phase 4: Cross-Calendar Features

- [ ] Calendar translation in timeline views
- [ ] Multi-calendar timeline comparison
- [ ] Date conversion tool in Control Center

---

## Implementation Notes

### Plugin Detection

Always check for Calendarium before accessing its API:

```typescript
class CalendariumBridge {
    private app: App;
    private api: any = null;

    constructor(app: App) {
        this.app = app;
    }

    isAvailable(): boolean {
        return this.app.plugins.enabledPlugins.has('calendarium')
            && !!(window as any).Calendarium;
    }

    async initialize(): Promise<boolean> {
        if (!this.isAvailable()) return false;

        return new Promise((resolve) => {
            (window as any).Calendarium.onSettingsLoaded(() => {
                this.api = (window as any).Calendarium;
                resolve(true);
            });
        });
    }

    getCalendars(): string[] {
        return this.api?.getCalendars() ?? [];
    }
}
```

### Month Index Alignment

Calendarium uses 0-indexed months. When converting:

```typescript
// Charted Roots (1-indexed) → Calendarium (0-indexed)
const calMonth = crMonth - 1;

// Calendarium (0-indexed) → Charted Roots (1-indexed)
const crMonth = calMonth + 1;
```

### Error Handling

- If Calendarium is uninstalled mid-session, handle gracefully
- If calendar is deleted in Calendarium, preserve Charted Roots events
- Log sync failures without blocking user operations

### Performance

- Cache calendar definitions (don't query Calendarium on every render)
- Batch frontmatter updates when syncing multiple events
- Use debouncing for real-time sync

---

## Testing Scenarios

1. **Calendarium not installed:** Verify graceful fallback, no errors
2. **Calendarium installed but disabled:** Should behave like not installed
3. **Read-only mode:** Import calendars, verify no `fc-*` writes
4. **Bidirectional mode:** Create event in Charted Roots, verify appears in Calendarium
5. **Calendar deletion:** Delete calendar in Calendarium, verify Charted Roots events preserved
6. **Date translation:** Verify cross-calendar conversions are accurate

---

## References

- [Calendarium Plugin](https://github.com/javalent/calendarium)
- [Calendarium Documentation](https://plugins.javalent.com/calendarium)
- [Charted Roots Fictional Date Systems](../wiki-content/Fictional-Date-Systems.md)
- [Chronological Story Mapping Plan](chronological-story-mapping.md#calendarium-plugin-integration)
