# Edit Person Modal: Events & Sources

## Overview

Add events and sources fields to the Edit Person modal, allowing users to manage all person-related data from a single interface instead of editing multiple notes separately.

**Status:** Planning
**Issue:** [#33](https://github.com/banisterious/obsidian-canvas-roots/issues/33)
**Target Version:** TBD

## Problem Statement

Currently, to associate events and sources with a person, users must:
1. Create/edit event notes separately and manually add the person to the `persons` array
2. Edit person note frontmatter directly to add source links

This workflow is cumbersome, especially for users who want to quickly capture all information about a person in one place.

## Proposed Solution

Add two new sections to the Edit Person modal:

### Events Section

Display and manage events associated with this person.

**Features:**
- Show existing events that reference this person (from the event's `persons` array)
- Link existing events to this person
- Create new events with this person pre-filled in the `persons` array
- Unlink events (removes this person from the event's `persons` array)

**Data Model:**
- Events use an inverse relationship: the event note contains `persons: ["[[Person Name]]"]`
- The person note does NOT store event references
- Linking/unlinking modifies the **event note**, not the person note

### Sources Section

Link source notes to the person.

**Features:**
- Multi-value picker to link existing sources (similar to spouses/children pattern)
- Create new sources via `CreateSourceModal`
- Remove linked sources
- Stores as `sources` array in person frontmatter

**Data Model:**
```yaml
# Person frontmatter
sources:
  - "[[1860 Census - Smith Household]]"
  - "[[Birth Certificate - John Smith]]"
sources_id:
  - "1860-census-smith"
  - "birth-cert-john-smith"
```

## Technical Design

### Events Implementation

#### Loading Events for a Person

```typescript
// In CreatePersonModal
private async loadPersonEvents(): Promise<EventNote[]> {
  const personName = this.nameInput.value;
  const personCrId = this.editingPersonCrId;

  // Get all events from cache
  const allEvents = this.plugin.eventService.getAllEvents();

  // Filter to events that reference this person
  return allEvents.filter(event => {
    const persons = event.frontmatter.persons || [];
    return persons.some(p => {
      const name = extractWikilinkText(p);
      return name === personName || p.includes(personCrId);
    });
  });
}
```

#### Linking an Event

When user selects an event to link:

```typescript
private async linkEventToPerson(event: EventNote): Promise<void> {
  const personWikilink = `"[[${this.nameInput.value}]]"`;

  // Read current event frontmatter
  const file = event.file;
  const frontmatter = await this.plugin.getFrontmatter(file);

  // Add person to persons array
  const persons = frontmatter.persons || [];
  if (!persons.includes(personWikilink)) {
    persons.push(personWikilink);
    await this.plugin.updateFrontmatter(file, { persons });
  }

  // Refresh display
  this.renderEventsSection();
}
```

#### Creating a New Event

```typescript
private openCreateEventForPerson(): void {
  const modal = new CreateEventModal(this.app, this.plugin, {
    prefillPerson: {
      name: this.nameInput.value,
      crId: this.editingPersonCrId
    },
    onSave: () => {
      // Refresh events list after creation
      this.renderEventsSection();
    }
  });
  modal.open();
}
```

### Sources Implementation

#### Field State

```typescript
// Add to CreatePersonModal instance variables
private sourcesField: MultiRelationshipField = { crIds: [], names: [] };

interface MultiRelationshipField {
  crIds: string[];
  names: string[];
}
```

#### Rendering Sources Section

Follow the existing pattern from spouses/children:

```typescript
private renderSourcesSection(container: HTMLElement): void {
  const section = container.createDiv({ cls: 'crc-person-form-section' });

  // Header with Add button
  const header = section.createDiv({ cls: 'crc-person-form-section-header' });
  header.createEl('h4', { text: 'Sources' });

  const addBtn = header.createEl('button', { cls: 'crc-add-btn' });
  setIcon(addBtn, 'plus');
  addBtn.createSpan({ text: 'Add source' });

  // List container
  const listContainer = section.createDiv({ cls: 'crc-person-sources-list' });

  const renderList = () => {
    listContainer.empty();

    if (this.sourcesField.crIds.length === 0) {
      listContainer.createDiv({
        cls: 'crc-empty-state',
        text: 'No sources linked'
      });
      return;
    }

    for (let i = 0; i < this.sourcesField.crIds.length; i++) {
      const item = listContainer.createDiv({ cls: 'crc-source-item' });
      item.createSpan({ text: this.sourcesField.names[i] });

      const removeBtn = item.createEl('button', { cls: 'crc-remove-btn' });
      setIcon(removeBtn, 'x');
      removeBtn.addEventListener('click', () => {
        this.sourcesField.crIds.splice(i, 1);
        this.sourcesField.names.splice(i, 1);
        renderList();
      });
    }
  };

  // Add button handler
  addBtn.addEventListener('click', () => {
    const picker = new SourcePickerModal(this.app, this.plugin, {
      onSelect: (source) => {
        // Check for duplicates
        if (this.sourcesField.crIds.includes(source.crId)) {
          new Notice('Source already linked');
          return;
        }
        this.sourcesField.crIds.push(source.crId);
        this.sourcesField.names.push(source.title);
        renderList();
      },
      allowCreate: true
    });
    picker.open();
  });

  renderList();
}
```

#### Saving Sources

Update `person-note-writer.ts` to handle sources:

```typescript
// In PersonNoteWriter.buildFrontmatter()
if (person.sourceCrIds?.length > 0) {
  frontmatter[prop('sources')] = person.sourceNames.map(
    name => `"${createSmartWikilink(name, app)}"`
  );
  frontmatter[prop('sources_id')] = person.sourceCrIds;
}
```

### UI Layout

Position new sections after Research Level, before Family Relationships:

```
┌─────────────────────────────────────────┐
│ Basic Info (name, dates, sex)           │
├─────────────────────────────────────────┤
│ Birth/Death Places                       │
├─────────────────────────────────────────┤
│ Research Level (if enabled)              │
├─────────────────────────────────────────┤
│ Events                    [+ Add event]  │  ← NEW
│ • Birth of John Smith (1850)             │
│ • Marriage to Sarah (1875)               │
├─────────────────────────────────────────┤
│ Sources                  [+ Add source]  │  ← NEW
│ • 1860 Census - Smith Household          │
│ • Birth Certificate                      │
├─────────────────────────────────────────┤
│ Family Relationships                     │
│ (father, mother, spouses, children...)   │
├─────────────────────────────────────────┤
│ Metadata (collection, universe)          │
└─────────────────────────────────────────┘
```

### Event Picker Modal

Need to create `EventPickerModal` or extend existing picker patterns:

```typescript
class EventPickerModal extends FuzzySuggestModal<EventNote> {
  constructor(
    app: App,
    plugin: CanvasRootsPlugin,
    private options: {
      onSelect: (event: EventNote) => void;
      excludeEvents?: string[];  // cr_ids to exclude (already linked)
      allowCreate?: boolean;
    }
  ) {
    super(app);
  }

  getItems(): EventNote[] {
    return this.plugin.eventService.getAllEvents()
      .filter(e => !this.options.excludeEvents?.includes(e.crId));
  }

  getItemText(event: EventNote): string {
    return `${event.title} (${event.eventType})`;
  }

  onChooseItem(event: EventNote): void {
    this.options.onSelect(event);
  }
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/ui/create-person-modal.ts` | Add events and sources sections, state management |
| `src/core/person-note-writer.ts` | Handle `sources` and `sources_id` properties |
| `src/types/frontmatter.ts` | Add `sources` and `sources_id` to PersonFrontmatter |
| `src/events/ui/create-event-modal.ts` | Add `prefillPerson` option |

## Files to Create

| File | Purpose |
|------|---------|
| `src/events/ui/event-picker-modal.ts` | Event selection modal (optional - could use FuzzySuggestModal inline) |

## Out of Scope

- Organizations field (user doesn't use it)
- Universe field changes (already exists as text field)
- Fact-level source attribution (existing `sourced_*` properties handle this)

## Implementation Phases

### Phase 1: Sources Section
1. Add `sources` / `sources_id` to frontmatter types
2. Add sources section UI to Create Person modal
3. Integrate with `SourcePickerModal`
4. Update `PersonNoteWriter` to save sources
5. Load existing sources when editing

### Phase 2: Events Section
1. Add events section UI (read-only display first)
2. Query events that reference this person
3. Add "Link event" functionality with picker
4. Add "Create event" with person pre-filled
5. Add "Unlink event" functionality

### Phase 3: Polish
1. Form state persistence for new fields
2. Duplicate detection and warnings
3. Event display formatting (type badges, dates)
4. Source display formatting (type badges)

## Testing Considerations

- Create new person with sources → verify frontmatter
- Edit existing person → verify sources load correctly
- Link event to person → verify event note updated
- Unlink event → verify person removed from event
- Create event from person modal → verify person pre-filled
- Duplicate prevention for sources and events
- Form persistence includes new fields
