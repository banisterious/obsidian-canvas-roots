# Events Tab Planning Document

## Overview

This document outlines the design for a new **Events** tab in the Control Center. The tab will improve discoverability of Fictional Date Systems and lay the groundwork for future Chronological Story Mapping features.

## Motivation

Currently, Fictional Date Systems settings are nested within the Canvas Settings tab, making them difficult to discover. As we plan to add event-based timeline features (see [Chronological Story Mapping](chronological-story-mapping.md)), having a dedicated Events tab provides:

1. **Better discoverability** - Date systems become a first-class feature
2. **Logical grouping** - Events and date systems are conceptually related
3. **Future-ready structure** - Infrastructure for event notes and timeline views
4. **Cleaner Canvas Settings** - Reduces complexity of the main settings tab

## Proposed Structure

### Tab: Events

#### Card 1: Event notes (Future)

*This card will be added when Chronological Story Mapping Phase 1 is implemented.*

Planned features:
- List of event notes in the vault
- Quick filters (by type, date range, person)
- Create new event note button
- Link to timeline view

#### Card 2: Date systems

Move the existing Fictional Date Systems card from Canvas Settings to this tab.

Current functionality (no changes needed):
- Enable/disable fictional dates toggle
- Show/hide built-in systems toggle
- Built-in systems table (Middle-earth, Westeros, Star Wars, Generic Fantasy)
- Custom systems management (add, edit, delete)
- Test date parsing input

#### Card 3: Statistics

Provide at-a-glance information about temporal data in the vault:

- **Date coverage**: X of Y person notes have birth/death dates
- **Fictional dates**: X notes use fictional date systems
- **Date systems in use**: List of active systems
- *(Future)* **Events by type**: Breakdown of event types

## Implementation Plan

### Phase 1: Tab Infrastructure (v0.9.x)

1. Create new `EventsTab` component extending `ControlCenterTab`
2. Register tab in Control Center
3. Move Date Systems card from Canvas Settings
4. Add basic Statistics card

**Estimated scope**: Small - primarily UI reorganization

### Phase 2: Event Notes Integration (Future)

Ties into [Chronological Story Mapping Phase 1](chronological-story-mapping.md):
- Add Event Notes card
- Expand Statistics card with event metrics
- Add event creation workflow

## UI Mockup

```
┌─────────────────────────────────────────────────────────────────┐
│  Control Center                                                  │
├─────────┬─────────┬─────────┬─────────┬─────────┬───────────────┤
│ Canvases│ People  │ Events  │ Import  │ Canvas  │ Preferences   │
│         │         │   ◄──   │         │ Settings│               │
├─────────┴─────────┴─────────┴─────────┴─────────┴───────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Date systems                                           [?]  ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ☑ Enable fictional dates                                    ││
│  │ ☑ Show built-in systems                                     ││
│  │                                                              ││
│  │ Built-in systems                                            ││
│  │ ┌──────────────────┬────────────────┬───────────┬─────────┐ ││
│  │ │ Name             │ Eras           │ Universe  │ Actions │ ││
│  │ ├──────────────────┼────────────────┼───────────┼─────────┤ ││
│  │ │ Middle-earth     │ FA, SA, TA,FoA │ middle-...│   👁    │ ││
│  │ │ Westeros         │ BC, AC         │ westeros  │   👁    │ ││
│  │ │ Star Wars        │ BBY, ABY       │ star-wars │   👁    │ ││
│  │ │ Generic Fantasy  │ A1, A2, A3, A4 │           │   👁    │ ││
│  │ └──────────────────┴────────────────┴───────────┴─────────┘ ││
│  │                                                              ││
│  │ Custom systems                                              ││
│  │ (No custom systems defined)                                 ││
│  │                                                              ││
│  │ [+ Add date system]                                         ││
│  │                                                              ││
│  │ Test date parsing                                           ││
│  │ ┌────────────────────────────────────────────────────────┐  ││
│  │ │ TA 2941                                                │  ││
│  │ └────────────────────────────────────────────────────────┘  ││
│  │ ✓ Third Age, year 2941 (Middle-earth) - Canonical: 2941     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Statistics                                             [?]  ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Date coverage                                               ││
│  │   • 42 of 67 person notes have birth dates (63%)            ││
│  │   • 38 of 67 person notes have death dates (57%)            ││
│  │                                                              ││
│  │ Fictional dates                                             ││
│  │   • 15 notes use fictional date systems                     ││
│  │   • Systems in use: Middle-earth (12), Westeros (3)         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Tab Order

Proposed Control Center tab order after this change:

1. **Canvases** - Canvas management and configuration
2. **People** - Person notes list and management
3. **Events** - Date systems and future event notes *(new)*
4. **Import** - GEDCOM import functionality
5. **Canvas Settings** - Layout, rendering, and display settings
6. **Preferences** - User preferences and plugin settings

## Migration Notes

When moving Date Systems from Canvas Settings:

1. Remove the "Fictional date systems" card from `CanvasSettingsTab`
2. Create `EventsTab` with the Date Systems card
3. Add Statistics card with date coverage metrics
4. Update any documentation referencing the old location
5. Consider adding a one-time notice for users familiar with the old location

## Related Documentation

- [Chronological Story Mapping](chronological-story-mapping.md) - Full event system planning
- [Fictional Date Systems Wiki](https://github.com/banisterious/obsidian-charted-roots/wiki/Fictional-Date-Systems) - User documentation

## Success Criteria

- [ ] Events tab appears in Control Center
- [ ] Date Systems card moved successfully with all functionality intact
- [ ] Statistics card shows accurate date coverage metrics
- [ ] Canvas Settings tab is cleaner without date systems
- [ ] Documentation updated to reflect new location
