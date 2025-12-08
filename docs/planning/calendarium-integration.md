# Calendarium Integration Planning

## Overview

This document outlines the integration between Canvas Roots and the [Calendarium](https://github.com/javalent/calendarium) plugin, enabling shared calendar definitions, bidirectional event sync, and cross-calendar date translation.

**Target Users:** Worldbuilders using fictional date systems who want a unified timeline experience across both plugins.

**Dependencies:**
- Calendarium plugin (optional - graceful fallback when not installed)
- Canvas Roots Fictional Date Systems (v0.7.0+)
- Canvas Roots Event Notes (v0.10.0+)

---

## Integration Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| **Standalone** | Canvas Roots manages its own calendars using built-in fictional date systems | Users without Calendarium installed |
| **Calendarium Primary** | Read calendars from Calendarium; Canvas Roots events sync to Calendarium | Existing Calendarium users who want Canvas Roots timeline features |
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

**Important:** Calendarium uses 0-indexed months. Canvas Roots' date parsing should align with this convention when syncing.

---

## Data Mapping

### Event Notes ↔ Calendarium Events

| Canvas Roots Field | Calendarium Field | Notes |
|--------------------|-------------------|-------|
| `date` | `fc-date` or `fc-start` | Start date of event |
| `date_end` | `fc-end` | End date for ranges |
| `title` | `fc-display-name` | Event display name |
| `description` | `fc-description` | Event description |
| `event_type` | `fc-category` | Mapped to Calendarium category ID |
| `calendar_system` | `fc-calendar` | Which calendar this event uses |

### Fictional Date Systems ↔ Calendarium Calendars

| Canvas Roots Field | Calendarium Equivalent |
|--------------------|------------------------|
| `date_system` name | Calendar name |
| Era definitions | Calendar eras |
| Month names | Month configuration |
| Epoch year | Calendar epoch |

---

## Sync Behavior

### Export to Calendarium

When a Canvas Roots event note is created or updated:

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
3. Map `fc-category` to Canvas Roots `event_type`
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
| `syncCalendariumEvents` | `boolean` | `false` | Show Calendarium events in Canvas Roots timelines |

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
│ Controls how Canvas Roots interacts with Calendarium.        │
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
│   Display events created in Calendarium on Canvas Roots     │
│   person and place timelines.                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Planned Features

### Phase 1: Calendar Import (Read-only)

- [ ] Detect Calendarium installation
- [ ] Import calendar definitions (names, eras, months)
- [ ] Display imported calendars in date system dropdown
- [ ] Graceful fallback when Calendarium not installed

### Phase 2: Event Display

- [ ] Parse `fc-*` frontmatter when loading events
- [ ] Display Calendarium events on person timelines
- [ ] Display Calendarium events on place timelines
- [ ] Filter timeline by calendar

### Phase 3: Bidirectional Sync

- [ ] Write `fc-*` fields when creating/updating events
- [ ] Map Canvas Roots event types to Calendarium categories
- [ ] Handle conflicts (both plugins modify same event)
- [ ] Sync status indicator in event notes

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
// Canvas Roots (1-indexed) → Calendarium (0-indexed)
const calMonth = crMonth - 1;

// Calendarium (0-indexed) → Canvas Roots (1-indexed)
const crMonth = calMonth + 1;
```

### Error Handling

- If Calendarium is uninstalled mid-session, handle gracefully
- If calendar is deleted in Calendarium, preserve Canvas Roots events
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
4. **Bidirectional mode:** Create event in Canvas Roots, verify appears in Calendarium
5. **Calendar deletion:** Delete calendar in Calendarium, verify Canvas Roots events preserved
6. **Date translation:** Verify cross-calendar conversions are accurate

---

## References

- [Calendarium Plugin](https://github.com/javalent/calendarium)
- [Calendarium Documentation](https://plugins.javalent.com/calendarium)
- [Canvas Roots Fictional Date Systems](../wiki-content/Fictional-Date-Systems.md)
- [Chronological Story Mapping Plan](chronological-story-mapping.md#calendarium-plugin-integration)
