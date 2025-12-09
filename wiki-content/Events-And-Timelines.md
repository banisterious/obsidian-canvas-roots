# Events & Timelines

Canvas Roots provides tools for documenting life events and visualizing them in chronological order. This feature supports both genealogists (who derive events from historical sources) and worldbuilders (who create canonical events directly).

## Overview

The Events & Timelines features enable you to:

- Create **event notes** documenting life events (births, deaths, marriages, and more)
- View **person timelines** showing all events for an individual in chronological order
- **Extract events** from source notes with pre-populated metadata
- Browse a **global timeline** with filtering and gap analysis
- Track **data quality** by identifying missing events and undocumented periods

## Event Notes

Event notes are structured markdown files that document individual life events. They link to people, places, and sources.

### Creating an Event Note

**Using the Command Palette:**

1. Open the command palette (Ctrl/Cmd + P)
2. Search for "Create event note"
3. Fill out the modal form

**Using the Create Event Modal:**

1. Go to **Control Center > Events tab**
2. Click **"+ Create event note"**
3. Complete the form fields

**Manual creation:**

Create a new markdown file with this frontmatter structure:

```yaml
---
cr_type: event
cr_id: "20251206143000"
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
---

# Birth of John Smith

Additional notes about this event...
```

### Event Note Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | Yes | Always `"event"` |
| `cr_id` | string | Yes | Unique identifier |
| `title` | string | Yes | Display title for the event |
| `event_type` | enum | Yes | Type of event (see Event Types below) |
| `date` | string | Yes | Event date (ISO format or fictional calendar) |
| `date_precision` | enum | Yes | How precise the date is |
| `date_end` | string | No | End date for ranges |
| `person` | wikilink | No | Primary person involved |
| `persons` | wikilink[] | No | Multiple people (for marriages, etc.) |
| `place` | wikilink | No | Where the event occurred |
| `sources` | wikilink[] | No | Sources documenting this event |
| `confidence` | enum | No | `high`, `medium`, `low`, `unknown` |
| `description` | string | No | Additional details |
| `is_canonical` | boolean | No | For worldbuilders: this is authoritative truth |
| `universe` | string | No | Fictional universe (for worldbuilding) |
| `date_system` | string | No | Fictional date system ID |
| `timeline` | wikilink | No | Parent timeline note |
| `sort_order` | number | No | Computed sort value for ordering |
| `groups` | string[] | No | Groups/factions involved (for filtering) |

### Event Types

Canvas Roots includes 22 built-in event types across four categories:

**Core Events** (vital records):
| Type | Icon | Color | Description |
|------|------|-------|-------------|
| `birth` | baby | green | Birth of a person |
| `death` | skull | gray | Death of a person |
| `marriage` | heart | pink | Marriage ceremony |
| `divorce` | heart-off | red | Divorce or annulment |

**Extended Events** (common life events):
| Type | Icon | Color | Description |
|------|------|-------|-------------|
| `burial` | cross | gray | Burial or interment |
| `residence` | home | blue | Change of residence |
| `occupation` | briefcase | amber | Employment or career change |
| `education` | graduation-cap | cyan | Educational milestone |
| `military` | shield | olive | Military service event |
| `immigration` | ship | teal | Immigration or emigration |
| `baptism` | droplets | sky | Baptism or christening |
| `confirmation` | star | purple | Religious confirmation |
| `ordination` | book-open | indigo | Religious ordination |

**Narrative Events** (for storytelling):
| Type | Icon | Color | Description |
|------|------|-------|-------------|
| `anecdote` | message-circle | orange | Family story or personal event |
| `lore_event` | scroll | amber | Worldbuilding canonical event |
| `plot_point` | bookmark | violet | Key story beat or turning point |
| `flashback` | rewind | slate | Non-chronological reference |
| `foreshadowing` | eye | indigo | Sets up future developments |
| `backstory` | history | stone | Pre-narrative background |
| `climax` | zap | red | Peak dramatic moment |
| `resolution` | check-circle | emerald | Story conclusion event |

**Custom Events:**

You can define custom event types in **Settings > Canvas Roots > Events**.

### Date Precision

The `date_precision` field indicates how accurate the date is:

| Precision | Format | Example | Use When |
|-----------|--------|---------|----------|
| `exact` | YYYY-MM-DD | 1850-03-15 | Date known to the day |
| `month` | YYYY-MM | 1850-03 | Known to month only |
| `year` | YYYY | 1850 | Known to year only |
| `decade` | YYYYs | 1850s | Known to decade only |
| `estimated` | circa YYYY | circa 1850 | Approximate date |
| `range` | YYYY - YYYY | 1848-1852 | Date falls within range |
| `unknown` | — | — | Date unknown, use relative ordering |

### Fictional Date Systems

Events integrate with Canvas Roots' [Fictional Date Systems](Fictional-Date-Systems). When `date_system` is specified, the date is parsed using that system's era definitions.

**Example with Middle-earth Calendar:**

```yaml
cr_type: event
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

## Person Timeline View

The Person Timeline shows all events for an individual in chronological order.

### Accessing the Timeline

1. Go to **Control Center > People tab**
2. Find a person in the list
3. Click the **calendar badge** (shows event count) to expand their timeline

### Timeline Display

Each event shows:

- **Date** with precision indicator
- **Event type** with color-coded icon
- **Event title** (click to open the event note)
- **Place** if recorded
- **Source count** or warning if unsourced
- **Confidence level** (shown as indicator for low confidence)

### Visual Indicators

| Indicator | Meaning |
|-----------|---------|
| Colored circle | Event type (birth=green, death=gray, etc.) |
| 📎 badge | Number of linked sources |
| ⚠️ warning | No sources linked |
| Faded node | Low confidence event |

## Family Timeline View

The Family Timeline shows aggregated events for an entire family unit: the focal person, their spouses, and their children.

### Accessing the Family Timeline

1. Go to **Control Center > People tab**
2. Find a person in the list
3. Look for the **users badge** (shows total family events) next to the calendar badge
4. Click the users badge to expand the family timeline

The users badge only appears for people who have spouses or children with events.

### Color-Coded Members

Each family member is assigned a unique color:

| Color | Member |
|-------|--------|
| Blue | Focal person (self) |
| Pink | First spouse |
| Green | First child |
| Amber | Second child |
| Purple | Third child or second spouse |
| (continues) | Additional children cycle through colors |

A legend at the top shows all family members with their colors and event counts.

### Event Display

Each event shows:

- **Color-coded node** matching the family member
- **Date** with precision indicator
- **Event title** (click to open)
- **Event type** label
- **Person indicator** showing which family member and their relationship (self, spouse, child)
- **Place and source info**

Events are sorted chronologically across all family members, making it easy to see the family's story unfold over time.

## Place Timeline View

The Place Timeline shows all events that occurred at a specific location, helping you track family presence in an area over time.

### Accessing the Place Timeline

1. Go to **Control Center > Maps tab**
2. Find the **Place timeline** card
3. Select a place from the dropdown

The dropdown shows all places that have associated events, with event counts displayed for each location.

### Timeline Features

**Summary Section:**
- Total event count at the location
- Date range (earliest to latest event)
- List of people with events at this place

**Family Presence Analysis:**
- Visual bar chart showing when each person was present
- Date ranges for each person's documented presence
- Bars scaled proportionally to the overall timeline span
- Shows top 5 people by presence

**Event List:**
- Chronological list of all events at the location
- Each event shows date, title, type, and associated person
- Click events to navigate to the event note
- Source count displayed when available

### Use Cases

- **Ancestral Homeland Research**: See everyone who lived in a village across generations
- **Migration Patterns**: Identify when a family arrived/left an area
- **Community History**: Understand family networks in a location
- **Urban vs Rural**: Compare family presence across different place types

## Global Timeline

The Events tab includes a Timeline card showing all events across your vault.

### Accessing the Global Timeline

1. Go to **Control Center > Events tab**
2. Scroll to the **Timeline** card

### Filter Controls

| Filter | Options |
|--------|---------|
| Event type | All types, or specific type (birth, death, etc.) |
| Person | All people, or specific person |
| Search | Free-text search across title, date, place, description |

### Timeline Table

The table shows:

| Column | Description |
|--------|-------------|
| Date | Event date (with end date for ranges) |
| Event | Event title (click row to open note) |
| Type | Color-coded badge with icon |
| Person | Linked person |
| Place | Event location |

**Context menu:** Right-click any event row to access:
- **Open note** - Open the event note in the current tab
- **Open in new tab** - Open the event note in a new tab
- **Delete event** - Delete the event note (with confirmation)

### Data Quality Insights

The Timeline card includes automated analysis:

| Insight | Description |
|---------|-------------|
| Timeline gaps | Periods of 5+ years with no documented events |
| Unsourced events | Events without source citations |
| Orphan events | Events not linked to any person |

## Timeline Export

Export your event timelines to Canvas, Excalidraw, or Markdown formats for presentations, printing, embedding in notes, or further editing.

### Accessing Timeline Export

1. Go to **Control Center > Events tab**
2. Find the **Export timeline** card
3. Select export format (Canvas, Excalidraw, or Markdown)
4. Configure format-specific options
5. Apply filters (person, type, group)
6. Click **Export**

### Export Formats

| Format | Description | Best For |
|--------|-------------|----------|
| **Canvas** | Native Obsidian canvas with linked nodes | Interactive exploration, linking back to notes |
| **Excalidraw** | Hand-drawn style diagrams | Presentations, visual appeal, manual annotation |
| **Markdown** | Text-based formats | Embedding in notes, static documentation |

### Canvas/Excalidraw Options

| Option | Description |
|--------|-------------|
| Title | Name for the exported file |
| Layout | Horizontal, Vertical, or Gantt |
| Color by | Event type, Category, Confidence, or Monochrome |
| Include ordering edges | Draw arrows for before/after relationships |
| Group by person | Visually group events by their associated person |

### Excalidraw-Specific Options

When Excalidraw format is selected, additional styling options appear:

| Option | Description |
|--------|-------------|
| Drawing style | Architect (clean), Artist (natural), or Cartoonist (rough) |
| Font | Virgil, Excalifont, Comic Shanns, Helvetica, Nunito, Lilita One, or Cascadia |
| Font size | Size of text labels (10-32, default: 16) |
| Stroke width | Thickness of lines and borders (1-6, default: 2) |
| Fill style | Solid, Hachure (diagonal lines), or Cross-hatch |
| Stroke style | Solid, Dashed, or Dotted |

### Markdown Export Formats

| Format | Description |
|--------|-------------|
| **Vertical timeline** | Visual timeline with year columns, colored dots, and event cards. Requires included CSS. |
| **Condensed table** | Compact markdown table with date, event, people, place, and sources columns |
| **Simple list** | Bullet list grouped by year. Maximum compatibility, no CSS required. |
| **Dataview query** | Generates a Dataview query that dynamically displays events. Requires Dataview plugin. |

### Layout Styles

**Horizontal (left to right):**
- Events arranged in a single row from earliest to latest
- Good for linear timelines with few events

**Vertical (top to bottom):**
- Events stacked vertically from earliest to latest
- Good for compact displays

**Gantt (by date and person):**
- Events positioned horizontally by date
- Each person gets their own row
- Best for visualizing family timelines with multiple people
- Undated events appear at the start of the timeline

### Color Schemes

| Scheme | Description |
|--------|-------------|
| Event type | Each event type has its own color (birth=green, death=gray, etc.) |
| Category | Core=green, Extended=blue, Narrative=purple, Custom=orange |
| Confidence | High=green, Medium=yellow, Low=orange, Unknown=red |
| Monochrome | No colors (gray nodes) |

### Filter Options

| Filter | Description |
|--------|-------------|
| Filter by person | Export only events for a specific person |
| Filter by type | Export only a specific event type |
| Filter by group | Export only events tagged with a specific group/faction |

### Export Preview

Before exporting, the quick stats row shows:

- Total events matching filters
- Date range (earliest to latest year)
- Number of unique people
- Number of unique places
- Count of dated vs undated events

## Source Event Extraction

Extract events from source notes without re-entering metadata.

### Extracting Events

**From the Sources tab:**

1. Go to **Control Center > Sources tab**
2. Find a source in the table
3. Click the **calendar-plus button** in the Actions column

**From the context menu:**

1. Right-click a source row
2. Select **"Extract events"**

### Extract Events Modal

The modal pre-populates fields from the source:

| Field | Source Metadata |
|-------|-----------------|
| Date | `source_date` |
| Place | `location` |
| Confidence | `confidence` |
| Source link | Automatically links to source note |

**Smart event suggestions:**

The modal suggests event types based on source type:

| Source Type | Suggested Events |
|-------------|------------------|
| Census | residence, occupation |
| Vital record | birth, death, marriage |
| Church record | baptism, confirmation |
| Military record | military |
| Immigration | immigration |

### Workflow

1. Click "Extract events" on a source
2. Review suggested events
3. Add or remove events as needed
4. Click "Create events"
5. Events are created with source automatically linked

## Event Templates

Seven event templates are available in the Template Snippets modal:

| Template | Description |
|----------|-------------|
| Basic event | Minimal event note |
| Birth event | Pre-configured birth event |
| Marriage event | Includes `persons` array for couple |
| Death event | Pre-configured death event |
| Narrative event | For worldbuilding/storytelling |
| Relative-ordered event | Uses `before`/`after` for dateless events |
| Full event | All available fields |

### Using Templates

1. Go to **Control Center > Import/Export tab**
2. Click **"View templates"**
3. Find "Event Notes" section
4. Click a template to copy to clipboard
5. Paste into a new note

## Settings

Event-related settings are in **Settings > Canvas Roots**:

| Setting | Default | Description |
|---------|---------|-------------|
| Events folder | `Canvas Roots/Events` | Default folder for new event notes |
| Show built-in event types | true | Include 22 built-in types |
| Custom event types | [] | User-defined event types |

## Best Practices

### Event vs. Fact

**Events are occurrences; facts are assertions about those occurrences.**

- An event is: "John was born on March 15, 1850 in Dublin"
- A fact in a proof summary is: "I conclude John's birth date was March 15, 1850"

Keep events as discrete occurrences. Use [Evidence & Sources](Evidence-And-Sources) for research conclusions.

### One Event, Multiple Sources

When multiple sources document the same event:

- Create **one event note**
- Add all sources to the `sources` array
- Note discrepancies in the description

### Multi-Person Events

For events involving multiple people (marriages, etc.):

- Use the `persons` array
- The event appears in both people's timelines

### Relative Ordering

For events without known dates:

```yaml
cr_type: event
title: "Person A moved to the Americas"
event_type: immigration
date_precision: unknown
after:
  - "[[Marriage of Person A]]"
before:
  - "[[Birth of First Child]]"
```

This enables meaningful timelines even with incomplete research.

### Computing Sort Order

The "Compute sort order" button in the Events tab automatically calculates `sort_order` values for all events based on:

1. **Dated events** - Sorted chronologically by date
2. **Relative constraints** - `before`/`after` relationships create a directed graph
3. **Topological sort** - Events ordered respecting all constraints

**How it works:**
- Click "Compute sort order" in the Events tab
- The algorithm performs a topological sort on the event graph
- Each event receives a `sort_order` value (multiples of 10 for flexibility)
- Cycles are detected and reported (cyclic events can't be fully ordered)

**Benefits:**
- Enables correct sorting in Obsidian Bases without manual numbering
- Respects relative ordering even when exact dates are unknown
- Increments of 10 allow manual insertion of events between computed values

### Groups and Factions

Tag events with groups for filtering by nation, faction, or organization:

```yaml
cr_type: event
title: "Battle of Helm's Deep"
event_type: lore_event
date: "TA 3019"
groups:
  - "Rohan"
  - "Isengard"
  - "Fellowship"
```

**Use cases:**
- Filter timeline exports by faction (e.g., "Show only Rohan events")
- Track events affecting multiple organizations
- Worldbuilding: organize events by nation, guild, or power structure
- Genealogy: tag events by family branch or immigrant group

## Related Pages

- [Evidence & Sources](Evidence-And-Sources) - Source management and citations
- [Fictional Date Systems](Fictional-Date-Systems) - Custom calendars for worldbuilding
- [Frontmatter Reference](Frontmatter-Reference) - Complete property documentation
- [Roadmap](Roadmap) - Planned timeline features
