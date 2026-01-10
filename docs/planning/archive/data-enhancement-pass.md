# Data Enhancement Pass

## Overview

A set of commands and UI tools to upgrade existing vaults by creating missing linked entities (events, places, sources) from existing person note data. Designed for users who imported GEDCOM before Charted Roots supported these entity types.

## Use Cases

1. **Imported GEDCOM before v0.10.0** - No event notes were created; birth/death dates are flat properties
2. **Imported GEDCOM before v0.9.0** - No source notes; source citations were ignored
3. **Have place strings instead of wikilinks** - `birthPlace: "Dublin, Ireland"` instead of `birthPlace: "[[Dublin, Ireland]]"`
4. **Want event notes for existing data** - Retroactively create event notes to use timeline features

## Features

### 1. Generate Events from Dates

**Summary:** Scan person notes and create event notes from date properties.

**What it does:**

1. Find all person notes with `birthDate` or `deathDate` properties
2. Check if corresponding event notes already exist (by person + event type)
3. Create event notes for dates that don't have events

**Event Detection Logic:**

```typescript
// For each person note:
const existingEvents = await findEventsByPerson(personPath);

if (person.birthDate && !existingEvents.some(e => e.event_type === 'birth')) {
  await createEventNote({
    type: 'event',
    cr_id: generateEventId(),
    title: `Birth of ${person.name}`,
    event_type: 'birth',
    date: person.birthDate,
    date_precision: inferPrecision(person.birthDate),
    person: `[[${person.name}]]`,
    place: person.birthPlace,  // String or wikilink
    confidence: 'unknown',
    description: 'Generated from person note'
  });
}

if (person.deathDate && !existingEvents.some(e => e.event_type === 'death')) {
  await createEventNote({
    type: 'event',
    cr_id: generateEventId(),
    title: `Death of ${person.name}`,
    event_type: 'death',
    date: person.deathDate,
    date_precision: inferPrecision(person.deathDate),
    person: `[[${person.name}]]`,
    place: person.deathPlace,
    confidence: 'unknown',
    description: 'Generated from person note'
  });
}
```

**Date Precision Inference:**

| Date Format | Inferred Precision |
|-------------|-------------------|
| `1850-03-15` | `exact` |
| `1850-03` | `month` |
| `1850` | `year` |
| `circa 1850` | `estimated` |
| `1848-1852` | `range` |
| `ABT 1850` | `estimated` |

**Options:**

- [ ] Include birth events
- [ ] Include death events
- [ ] Overwrite existing events (default: skip)
- Target folder for new events

### 2. Generate Place Notes

**Summary:** Extract unique place strings and create place notes, then update references.

**What it does:**

1. Scan all person notes for `birthPlace`, `deathPlace`
2. Scan all event notes for `place` (if string, not wikilink)
3. Collect unique place strings
4. Create place notes for each unique place
5. Update source notes to use wikilinks

**Place Extraction:**

```typescript
const placeStrings = new Set<string>();

// From person notes
for (const person of personNotes) {
  if (typeof person.birthPlace === 'string' && !isWikilink(person.birthPlace)) {
    placeStrings.add(normalizePlace(person.birthPlace));
  }
  if (typeof person.deathPlace === 'string' && !isWikilink(person.deathPlace)) {
    placeStrings.add(normalizePlace(person.deathPlace));
  }
}

// From event notes
for (const event of eventNotes) {
  if (typeof event.place === 'string' && !isWikilink(event.place)) {
    placeStrings.add(normalizePlace(event.place));
  }
}
```

**Place Note Creation:**

```yaml
type: place
cr_id: "place_dublin_ireland"
name: "Dublin, Ireland"
place_type: unknown  # User can refine later
category: real
```

**Reference Update:**

After creating place notes, update all references:

```yaml
# Before
birthPlace: "Dublin, Ireland"

# After
birthPlace: "[[Dublin, Ireland]]"
```

**Options:**

- [ ] Scan person notes
- [ ] Scan event notes
- [ ] Update references after creation (default: on)
- [ ] Parse place hierarchy (create parent places)
- Place folder: `Charted Roots/Places`

### 3. Re-parse GEDCOM for Sources

**Summary:** Re-import a GEDCOM file to extract sources, matching individuals to existing person notes.

**What it does:**

1. User selects original GEDCOM file
2. Parse GEDCOM for `SOUR` records and citations
3. Match GEDCOM individuals to existing person notes
4. Create source notes
5. Link sources to matched person/event notes

**Matching Strategy:**

```typescript
function matchIndividualToNote(individual: GedcomIndividual): TFile | null {
  // Strategy 1: Match by cr_id if stored during original import
  if (individual.xrefId) {
    const match = findNoteByProperty('gedcom_xref', individual.xrefId);
    if (match) return match;
  }

  // Strategy 2: Match by name + dates
  const candidates = findNotesByName(individual.name);
  for (const candidate of candidates) {
    if (datesMatch(candidate.birthDate, individual.birthDate) &&
        datesMatch(candidate.deathDate, individual.deathDate)) {
      return candidate;
    }
  }

  // Strategy 3: Fuzzy name match + family structure
  // ...

  return null;
}
```

**Match Report:**

```
Matching Results:
├── Exact matches: 145
├── Fuzzy matches: 5 (review recommended)
├── Unmatched GEDCOM individuals: 2
└── Unmatched person notes: 0

Unmatched individuals:
- John Smith (b. 1823) - No matching person note
- Jane Doe (b. unknown) - Multiple candidates
```

**Options:**

- GEDCOM file: [Browse]
- [ ] Create source notes
- [ ] Link sources to events
- [ ] Store GEDCOM xref for future matching

## UI Design

### Import/Export Tab Card

```
┌─────────────────────────────────────────┐
│ Enhance existing data                   │
├─────────────────────────────────────────┤
│ Upgrade your vault by creating missing  │
│ event, place, or source notes from      │
│ existing data.                          │
│                                         │
│ [Generate events from dates]            │
│ [Generate place notes]                  │
│ [Re-parse GEDCOM for sources]           │
└─────────────────────────────────────────┘
```

### Enhancement Modal

```
┌─────────────────────────────────────────┐
│ Generate Events from Dates              │
├─────────────────────────────────────────┤
│ This will scan your person notes and    │
│ create event notes for birth and death  │
│ dates.                                  │
│                                         │
│ Options:                                │
│ ☑ Birth events                          │
│ ☑ Death events                          │
│ ☐ Overwrite existing events             │
│                                         │
│ Events folder: [Charted Roots/Events ▼]  │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ Preview (dry run):                      │
│                                         │
│ Person notes scanned: 152               │
│ Events to create: 287                   │
│   • Birth events: 148                   │
│   • Death events: 139                   │
│ Skipped (already exist): 17             │
│                                         │
│ Sample events:                          │
│   • Birth of John Smith (1850-03-15)    │
│   • Death of John Smith (1923-07-22)    │
│   • Birth of Mary Smith (1852-06-01)    │
│   ...                                   │
│                                         │
│ ⚠️ Backup your vault before proceeding  │
│                                         │
│      [Cancel]  [Dry Run]  [Create]      │
└─────────────────────────────────────────┘
```

### Progress Display

```
Generating events from dates...

[████████████████░░░░] 80%

Creating event: Birth of Margaret Wilson
152 of 190 person notes processed
287 events created

[Cancel]
```

### Summary Report

```
┌─────────────────────────────────────────┐
│ Enhancement Complete                    │
├─────────────────────────────────────────┤
│ ✓ 287 event notes created               │
│ ✓ 17 events skipped (already existed)   │
│ ✓ 0 errors                              │
│                                         │
│ Created events:                         │
│ • 148 birth events                      │
│ • 139 death events                      │
│                                         │
│ View in Events tab to see all events.   │
│                                         │
│                              [Done]     │
└─────────────────────────────────────────┘
```

## Commands

| Command | Description |
|---------|-------------|
| `Charted Roots: Generate event notes from person dates` | Opens enhancement modal for events |
| `Charted Roots: Generate place notes from place strings` | Opens enhancement modal for places |
| `Charted Roots: Re-parse GEDCOM for sources` | Opens GEDCOM re-parse modal |

## Implementation

### File Structure

```
src/enhancement/
├── services/
│   ├── event-generator.ts      # Generate events from dates
│   ├── place-generator.ts      # Generate place notes
│   └── source-reimport.ts      # Re-parse GEDCOM for sources
├── ui/
│   ├── enhancement-modal.ts    # Base modal class
│   ├── event-generator-modal.ts
│   ├── place-generator-modal.ts
│   └── source-reimport-modal.ts
└── types/
    └── enhancement-types.ts
```

### Event Generator Service

```typescript
interface EventGeneratorOptions {
  includeBirth: boolean;
  includeDeath: boolean;
  overwriteExisting: boolean;
  eventsFolder: string;
  dryRun: boolean;
}

interface EventGeneratorResult {
  scanned: number;
  created: number;
  skipped: number;
  errors: EnhancementError[];
  events: GeneratedEvent[];
}

class EventGeneratorService {
  async generate(options: EventGeneratorOptions): Promise<EventGeneratorResult> {
    // Implementation
  }

  async preview(options: EventGeneratorOptions): Promise<EventGeneratorResult> {
    return this.generate({ ...options, dryRun: true });
  }
}
```

### Place Generator Service

```typescript
interface PlaceGeneratorOptions {
  scanPersonNotes: boolean;
  scanEventNotes: boolean;
  updateReferences: boolean;
  parseHierarchy: boolean;
  placesFolder: string;
  dryRun: boolean;
}

interface PlaceGeneratorResult {
  placesFound: number;
  notesCreated: number;
  referencesUpdated: number;
  errors: EnhancementError[];
}

class PlaceGeneratorService {
  async generate(options: PlaceGeneratorOptions): Promise<PlaceGeneratorResult> {
    // Implementation
  }
}
```

## Safety Features

### Backup Reminder

Before any enhancement operation:

```
⚠️ Backup Recommended

Enhancement operations modify multiple files. We recommend:
• Using Git to track changes
• Creating a vault backup
• Using Obsidian's File Recovery plugin

☐ I have backed up my vault

[Cancel] [Continue]
```

### Dry Run Mode

- Default behavior: preview changes without writing
- Shows exact counts and sample entities
- User must explicitly click "Create" to apply

### Skip Duplicates

- Check for existing events by person + event type + date
- Check for existing places by normalized name
- Skip if already exists (unless overwrite enabled)

### Undo Support

- Enhancement operations create new files
- Can be undone via Obsidian's file history
- Git users can revert commits
- Consider: batch tag for easy identification

## Testing

### Unit Tests

- Date precision inference
- Place string normalization
- Wikilink detection
- Duplicate detection logic

### Integration Tests

- Generate events for sample vault
- Verify event-person links
- Test place deduplication
- Test GEDCOM re-parse matching

### Test Fixtures

- `test-vault-no-events/` - Person notes with dates, no events
- `test-vault-mixed/` - Some events, some missing
- `test-vault-places/` - String places needing conversion
- `test-gedcom-sources/` - GEDCOM with full source citations

## Related Documentation

- [Roadmap: Data Enhancement Pass](../../wiki-content/Roadmap.md#data-enhancement-pass)
- [Roadmap: GEDCOM Import v2](../../wiki-content/Roadmap.md#gedcom-import-v2)
- [GEDCOM Import v2 Planning](gedcom-import-v2.md)
- [Events & Timelines](../../wiki-content/Events-And-Timelines.md)

## Implementation Status

### Generate Place Notes - ✅ Complete (v0.10.17)

**Merged to main in v0.10.17**

Files created:
- `src/enhancement/services/place-generator.ts` - PlaceGeneratorService with hierarchy parsing
- `src/enhancement/ui/place-generator-modal.ts` - Modal UI with preview/generate workflow
- `src/enhancement/index.ts` - Module exports

Files modified:
- `main.ts` - Added `generate-place-notes` command
- `src/ui/control-center.ts` - Added Data Enhancement card to Data Quality tab
- `src/ui/lucide-icons.ts` - Added `sparkles` and `plus-circle` icons
- `styles/data-quality.css` - Added place generator modal styles

Features:
- Scans person notes for `birth_place`, `death_place` properties
- Scans event notes for `place` properties
- Detects string values (not wikilinks) that need conversion
- Creates place notes with proper hierarchy (parents created first)
- Updates references to use wikilinks
- Preview mode shows what will be created/modified
- Matches existing place notes to avoid duplicates
- Progress indicator during bulk generation with cancel support
- Paginated results table with search/sort after completion
- Edit button on each result to open Edit Place modal

### Generate Events from Dates - 📋 Planned

Not yet implemented.

### Re-parse GEDCOM for Sources - 📋 Planned

Not yet implemented.
