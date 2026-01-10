# Edit Person Modal: Events & Sources

## Overview

Add events and sources fields to the Edit Person modal, allowing users to manage all person-related data from a single interface instead of editing multiple notes separately.

**Status:** ✅ Complete (All Phases)
**Issue:** [#33](https://github.com/banisterious/obsidian-charted-roots/issues/33)
**Released:** v0.18.14

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

## Codebase Investigation Findings

Investigation completed December 2024 to verify existing infrastructure and property patterns.

### Existing Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| `CreatePersonModal` | ✅ Exists | Used for both create and edit modes; `isEditing` flag controls behavior |
| `SourcePickerModal` | ✅ Exists | Needs `allowCreate` option added to constructor |
| `MultiRelationshipField` | ✅ Exists | Pattern already used for spouses, children; can be reused for sources |
| `SourceMigrationService` | ✅ Exists | Already handles `sources` array via migration from legacy `source`, `source_2`, etc. |

### Property Status

| Property | Status | Notes |
|----------|--------|-------|
| `sources` | ✅ Already exists | Migrated from legacy indexed properties by `SourceMigrationService` |
| `sources_id` | 🆕 New | Companion cr_id array to add (follows `children`/`children_id` pattern) |
| `source`, `source_2`, `source_3` | ⚠️ Legacy | Still in use by some vaults; migrated to `sources` array on load |

### Property Naming Rationale

The `sources_id` naming follows the established convention for dual-storage relationship properties:

| Wikilink Property | ID Property | Pattern |
|-------------------|-------------|---------|
| `children` | `children_id` | plural → plural_id |
| `parents` | `parents_id` | plural → plural_id |
| `spouses` | `spouses_id` | plural → plural_id |
| `sources` | `sources_id` | plural → plural_id ✅ |

Alternative `source_ids` was considered but rejected for consistency with existing patterns.

### Sources vs Sourced Properties

**Important distinction:**

| Property Type | Purpose | Example |
|---------------|---------|---------|
| `sources` / `sources_id` | **General person-level sources** | Census records, family bibles, photographs documenting the person |
| `sourced_*` properties | **Fact-level GPS tracking** | `sourced_birth_date`, `sourced_birth_place` for specific claims |

The `sourced_*` properties support evidence tracking at the individual fact level (Genealogical Proof Standard compliance), while `sources` provides a simpler list of general sources associated with the person. Both can coexist.

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
| `src/core/person-note-writer.ts` | Handle `sources_id` property (sources already handled) |
| `src/types/frontmatter.ts` | Add `sources_id` to PersonFrontmatter (`sources` may already exist) |
| `src/events/ui/create-event-modal.ts` | Add `prefillPerson` option |
| `src/sources/ui/source-picker-modal.ts` | Add `allowCreate` option to constructor |

## Files to Create

| File | Purpose |
|------|---------|
| `src/events/ui/event-picker-modal.ts` | Event selection modal (optional - could use FuzzySuggestModal inline) |

## No Changes Required

| File | Reason |
|------|--------|
| `src/sources/services/source-migration-service.ts` | Already handles `sources` array migration from legacy properties |

## Out of Scope

- Organizations field (user doesn't use it)
- Universe field changes (already exists as text field)
- Fact-level source attribution (existing `sourced_*` properties handle this)

## Implementation Phases

### Phase 1: Sources Section ✅ Complete

| Step | Task | Status |
|------|------|--------|
| 1 | Add `sources_id` to frontmatter types | ✅ Done |
| 2 | Add `allowCreate` option to `SourcePickerModal` | ✅ Done |
| 3 | Add sources section UI to CreatePersonModal | ✅ Done |
| 4 | Update `PersonNoteWriter` to save `sources_id` alongside `sources` | ✅ Done |
| 5 | Load existing sources when editing | ✅ Done |
| 6 | Add CSS styling matching spouses field pattern | ✅ Done |

**Commits:**
- `6b559bb` - Add sources_id property and refactor SourcePickerModal to options pattern
- `9be4fe3` - Add sources section UI to CreatePersonModal
- `5a9d54d` - Load existing sources when editing a person
- `0e0f48d` - Match sources field styling to spouses field pattern

### Phase 2: Events Section ✅ Complete

| Step | Task | Status |
|------|------|--------|
| 1 | Add events section UI (read-only display) | ✅ Done |
| 2 | Query events that reference this person | ✅ Done |
| 3 | Add "Link event" functionality with EventPickerModal | ✅ Done |
| 4 | Add "Unlink event" functionality | ✅ Done |
| 5 | Add "Create event" with person pre-filled | ✅ Done |

**Commits:**
- `a42ecc2` - Add events section to Edit Person modal (read-only display)
- `13bbb73` - Add link/unlink event functionality with EventPickerModal
- `bb829a8` - Add create event button to Edit Person modal

### Phase 3: Polish ✅ Complete

| Step | Task | Status |
|------|------|--------|
| 1 | Form state persistence for new fields | ✅ Done (already implemented) |
| 2 | Duplicate detection and warnings | ✅ Done (via excludeSources/excludeEvents) |
| 3 | Event display formatting (type badges, dates) | ✅ Done |
| 4 | Source display formatting (type badges) | ✅ Done |

**Commits:**
- `43f8a77` - Fix plugin reference in Edit Person context menu handler
- `607048e` - Add type badges with colors to Events and Sources displays

## Testing Considerations

- Create new person with sources → verify frontmatter
- Edit existing person → verify sources load correctly
- Link event to person → verify event note updated
- Unlink event → verify person removed from event
- Create event from person modal → verify person pre-filled
- Duplicate prevention for sources and events
- Form persistence includes new fields
