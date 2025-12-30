# Nested Properties Redesign Plan

- **Created:** 2025-12-29
- **Updated:** 2025-12-30
- **Status:** ✅ **IMPLEMENTED** (feature/nested-properties-redesign branch)
- **Priority:** High - Architectural incompatibility with Obsidian

---

## Problem Statement

Two plugin features use nested YAML structures that are incompatible with Obsidian's property panel:

1. **`sourced_facts`** (Evidence Service, v0.9.0) - Maps fact keys to source arrays
2. **`events`** (Life Events, older feature) - Array of event objects with multiple fields

**Impact:**
- Obsidian's property panel shows "Type mismatch, expected text" warnings
- Clicking "update" corrupts data to `"[object Object]"` strings
- Violates design principle of Obsidian compatibility
- Confusing/frustrating user experience

**User Adoption:**
- `sourced_facts`: Opt-in feature (`trackFactSourcing` setting, default OFF), released Dec 4, 2025 (~25 days ago)
- `events`: Always available if manually added, unknown adoption but likely low (requires manual YAML editing)

---

## Design Goals

1. **Obsidian Compatible** - Use only flat property types supported by property panel
2. **Backward Compatible** - Read existing nested data, provide migration path
3. **User Friendly** - Easy to understand and edit in property panel
4. **Feature Parity** - Maintain all current functionality
5. **Minimal Breaking Changes** - Provide smooth migration for early adopters

---

## Option 1: Flat Alternative for `sourced_facts`

### Current Structure (Nested)
```yaml
sourced_facts:
  birth_date:
    sources:
      - "[[1870-census]]"
      - "[[Birth Certificate]]"
  death_date:
    sources:
      - "[[Death Certificate]]"
```

### Proposed Structure (Flat - Array of Strings)
```yaml
# Option A: Concatenated strings (parseable)
sourced_facts:
  - "birth_date: [[1870-census]], [[Birth Certificate]]"
  - "death_date: [[Death Certificate]]"
```

**Pros:**
- Single Obsidian-compatible List property
- Each item is a string (supported type)
- Relatively compact

**Cons:**
- Requires parsing `factKey: sources` format
- Less structured, harder to validate
- Awkward to edit in property panel

---

### Alternative: Individual Properties per Fact

```yaml
sourced_birth_date: ["[[1870-census]]", "[[Birth Certificate]]"]
sourced_death_date: ["[[Death Certificate]]"]
sourced_birth_place: ["[[Family Bible]]"]
```

**Pros:**
- Clean, simple arrays (Obsidian List type)
- Easy to edit in property panel
- Self-documenting property names
- Easy validation

**Cons:**
- Many properties (up to 10+ for all fact types)
- Property list gets long
- Repetitive `sourced_` prefix

**Recommendation:** Use this approach - cleaner and more Obsidian-native

---

## Option 2: Flat Alternative for `events`

### Current Structure (Nested)
```yaml
events:
  - event_type: residence
    place: "[[New York]]"
    date_from: "1920"
    date_to: "1935"
    description: "Family home on 5th Ave"
  - event_type: occupation
    place: "[[Chicago]]"
    date_from: "1935"
    date_to: "1942"
    description: "Steel mill foreman"
```

### Proposed Structure A: Event Note Files (Recommended)

Link to separate event note files instead of embedding in person frontmatter:

**Person frontmatter:**
```yaml
life_events:
  - "[[Events/John Smith - Residence - New York 1920-1935]]"
  - "[[Events/John Smith - Occupation - Chicago 1935-1942]]"
```

**Event note file:** `Events/John Smith - Residence - New York 1920-1935.md`
```yaml
---
cr_type: event
event_type: residence
place: "[[New York]]"
date_from: "1920"
date_to: "1935"
persons: ["[[John Smith]]"]
---
Family home on 5th Ave
```

**Pros:**
- Fully Obsidian compatible (simple wikilink array)
- Already have Event note infrastructure
- Can be edited/viewed like other entity notes
- Supports all existing event functionality (timelines, map markers)
- More scalable (unlimited events without frontmatter bloat)

**Cons:**
- More files in vault
- Breaking change for users with inline `events` arrays
- Requires migration wizard

---

### Proposed Structure B: Encoded Strings (Not Recommended)

```yaml
life_events:
  - "residence|[[New York]]|1920|1935|Family home on 5th Ave"
  - "occupation|[[Chicago]]|1935|1942|Steel mill foreman"
```

**Pros:**
- Single property, Obsidian compatible

**Cons:**
- Fragile parsing (pipe-delimited)
- Hard to edit manually
- Ugly, not user-friendly
- Doesn't leverage existing event note system

---

## Migration Strategy

### Phase 1: Add Flat Property Support (v0.18.9)

**`sourced_facts` migration:**
1. Add new flat properties: `sourced_birth_date`, `sourced_death_date`, etc.
2. Update `EvidenceService` to read from both old and new formats
3. Update UI to write only new format
4. Add setting: "Use legacy sourced_facts format" (default: OFF)

**`events` migration:**
1. Add support for `life_events` property (array of event note links)
2. Update `MapDataService` to read from both `events` and `life_events`
3. Update map view to recognize both formats

### Phase 2: Migration Wizard (v0.18.9)

**Cleanup Wizard Integration:**

The Cleanup Wizard currently has 11 steps, including:
- **Step 10: "Flatten Nested Properties"** - Generic flattening (e.g., `sourced_facts_birth_date_sources_0`)
- **Step 11: "Event Person Migration"** - `person` → `persons` array

The existing Step 10 does NOT produce the desired format. We need **purpose-built migration steps** that understand the semantic meaning:

**New Step 12: "Migrate Evidence Tracking"** (after Step 11)
- Scan for person notes with nested `sourced_facts`
- Convert to individual `sourced_*` properties (NOT generic underscore flattening)
- Preview changes before applying
- Option to keep or remove old property

**New Step 13: "Migrate Life Events to Event Notes"** (after Step 12)
- Scan for person notes with `events` array
- Create event note files for each item
- Update person notes with `life_events` links
- Option to keep or remove old property

**Note:** Consider hiding/deprecating Step 10 since its generic flattening is harmful for these specific cases.

### Phase 3: Deprecation Notice (v0.19.0)

- Add deprecation warnings when reading old format
- Update documentation to recommend new format
- Mark old format as "legacy" in settings

### Phase 4: Removal (v1.0.0 or later)

- Remove support for reading nested formats
- Remove migration wizard steps (assume all migrated)
- Clean up codebase

---

## Implementation Checklist

### For `sourced_facts` → Individual Properties ✅

**Property Names (10 fact types from `FACT_KEYS`):**
```typescript
sourced_birth_date: string[]    // sources for birth date
sourced_birth_place: string[]   // sources for birth place
sourced_death_date: string[]    // sources for death date
sourced_death_place: string[]   // sources for death place
sourced_parents: string[]       // sources for parents
sourced_marriage_date: string[] // sources for marriage date
sourced_marriage_place: string[] // sources for marriage place
sourced_spouse: string[]        // sources for spouse
sourced_occupation: string[]    // sources for occupation
sourced_residence: string[]     // sources for residence
```

**Implementation:**
- [x] Define new property names in `frontmatter.ts`
- [x] Update `EvidenceService.getFactCoverageForFile()` to check new properties
- [x] Update Control Center Research Gaps widget (writes to new format)
- [x] Add backward compatibility reader for old format
- [x] Add migration wizard step (Step 12)
- [ ] Update wiki documentation
- [ ] Add deprecation warning in settings UI

### For `events` → Event Note Files ✅

- [x] Add `life_events` property to `PersonFrontmatter`
- [x] Create "Convert life events to event notes" wizard (Step 13)
  - [x] Scan person notes with `events` array
  - [x] Generate event note files with proper naming
  - [x] Update person notes with `life_events` links
  - [x] Preview and confirm before execution
- [ ] Update `MapDataService.getLifeEventsForPerson()` to check new property
- [ ] Update map markers to work with both formats
- [ ] Update Geographic Features documentation
- [ ] Add deprecation notice in settings

### Migration Notice View (v0.18.9) ✅

Extend the existing migration notice infrastructure to inform users about the nested properties changes.

**Files modified:**
- `src/ui/views/migration-notice-view.ts` - Added `'nested-properties'` migration type
- `src/settings.ts` - Added migration completion tracking
- `main.ts` - Update `shouldShowMigrationNotice()` to trigger for v0.18.9 (TODO)

**Multi-Action Completion Tracking:**

The migration notice remains visible until BOTH migration actions are completed. Setting added to track individual migration completions:

```typescript
// In settings.ts - added to CanvasRootsSettings interface
/** Tracks completion of individual v0.18.9 migrations */
nestedPropertiesMigration?: {
  /** True when sourced_facts → sourced_* migration is complete */
  sourcedFactsComplete?: boolean;
  /** True when events → event note files migration is complete */
  eventsComplete?: boolean;
};
```

**Notice behavior:**
- Show notice when upgrading to v0.18.9+ AND either migration is incomplete
- Display checkmarks next to completed migrations
- "Dismiss" button only enabled when both migrations are complete OR user has no data requiring migration
- Each wizard step marks its corresponding migration as complete when finished
- "Skip for now" button added as escape hatch

**Implementation:**
- [x] Add `nestedPropertiesMigration` to `CanvasRootsSettings` interface in `settings.ts`
- [x] Add `'nested-properties'` to `MigrationType` union
- [x] Create `renderNestedPropertiesMigration()` method with:
  - Before/after code examples for `sourced_facts` → `sourced_*` properties
  - Before/after code examples for `events` → event note files
  - Benefits list (no more type mismatch, safe editing, etc.)
  - Completion status indicators (checkmarks) for each migration
  - "Open Cleanup Wizard" button (always enabled)
  - "Dismiss" button (enabled only when both complete)
  - "Skip for now" button (always enabled)
- [x] Update `determineMigrationType()` to detect v0.18.9+
- [x] Update `getDisplayText()` to return "Canvas Roots v0.18.9"
- [x] Update Cleanup Wizard steps to mark migrations complete on finish
- [ ] Add `checkMigrationNeeded()` method to scan vault for legacy data (auto-complete if no data)
- [ ] Update `shouldShowMigrationNotice()` in main.ts to check migration completion status

---

## Timeline

**v0.18.9 (Target: Early January 2026)**
- Implement flat alternatives for `sourced_facts` and `events`
- Add migration wizard steps to Cleanup Wizard
- Update documentation
- Maintain backward compatibility (read both formats)

**v0.19.0 (Target: Mid January 2026)**
- Add deprecation warnings when reading old formats
- Encourage migration via notices

**v1.0.0 (Target: TBD)**
- Remove nested format support
- Clean codebase

---

## User Communication Strategy

### For Current GitHub Issue Reporter

Draft response explaining:
1. Acknowledge the limitation and confusion
2. Explain that nested properties were an architectural mistake
3. Outline the redesign plan
4. Provide timeline for fix
5. Offer workaround (use Source mode for now)
6. Thank them for reporting

### For Existing Users (Discord/GitHub Announcement)

```markdown
**Important: Upcoming Change to Evidence Tracking and Life Events**

We're redesigning two features to fix an architectural incompatibility with Obsidian's property panel:

1. **Evidence Tracking** (`sourced_facts`) - Will use individual properties like `sourced_birth_date: ["[[source1]]"]`
2. **Life Events** (`events` array) - Will use separate event note files linked via `life_events` property

**Why?** Obsidian's property panel doesn't support nested structures, causing "Type mismatch" warnings and potential data corruption.

**Timeline:** Migration tools in v0.18.9 (January 2026)

**Action needed:** None immediately - migration wizard will handle conversion automatically.
```

---

## Decisions (2025-12-30)

1. **Target version:** v0.18.9 (bundled with Custom Relationships flat properties work)
2. **`sourced_*` properties:** Use **arrays** (Obsidian-native List type, consistent with other properties)
3. **Migration approach:** **Wizard-based** (user-triggered via Cleanup Wizard, not automatic on upgrade)
4. **Data recovery:** Out of scope for now - focus on preventing future corruption via migration
5. **Migration notice persistence:** Notice remains until BOTH migrations complete (tracked separately via `nestedPropertiesMigration` setting)

---

## Related Work

### `relationships` Array (Also v0.18.9)

A third nested property (`relationships` array for custom relationships) is being addressed separately as part of the Custom Relationships on Canvas Trees feature:

- **Planning doc:** `docs/planning/relationships-array-family-graph.md`
- **Flat format:** Individual properties per type (e.g., `godparent: ["[[John]]"]`, `godparent_id: ["john_123"]`)
- **Implementation:** Already done in `RelationshipService` and `AddRelationshipModal`
- **Migration:** Will need a wizard step (Step 14?) to convert legacy `relationships` arrays

This work is related but tracked separately since it's part of a larger feature.

---

## Related Files

- Implementation: `src/sources/services/evidence-service.ts`
- Types: `src/sources/types/source-types.ts`, `src/types/frontmatter.ts`
- Map integration: `src/maps/map-data-service.ts`
- Migration notice: `src/ui/views/migration-notice-view.ts`, `main.ts` (checkVersionUpgrade)
- Migration notice styles: `styles/migration-notice.css`
- Documentation: `wiki-content/Evidence-And-Sources.md`, `wiki-content/Geographic-Features.md`
- Cleanup Wizard: `src/ui/cleanup-wizard-modal.ts`, `src/core/data-quality.ts`

---

## Implementation Summary (2025-12-30)

Branch: `feature/nested-properties-redesign`

### Commits

1. **feat: add flat sourced_* properties for evidence tracking (#52)**
   - Added `SourcedPropertyName` type and `FACT_KEY_TO_SOURCED_PROPERTY` mapping
   - Added `SOURCED_PROPERTY_NAMES` array for iteration
   - Updated `EvidenceService` to read from flat properties with legacy fallback

2. **feat: write to flat sourced_* properties instead of nested sourced_facts (#52)**
   - Updated `addSourceCitationForFact()` in control-center.ts to write flat properties
   - Exported `FACT_KEY_TO_SOURCED_PROPERTY` from sources module

3. **feat: add nestedPropertiesMigration tracking setting (#52)**
   - Added `nestedPropertiesMigration` setting with completion flags

4. **feat: add nested-properties migration notice for v0.18.9 (#52)**
   - Added `nested-properties` migration type with dual-checkmark UI
   - Shows completion status for each migration
   - "Skip for now" button as escape hatch

5. **feat: add Cleanup Wizard Step 12 for Evidence Tracking migration (#52)**
   - Created `SourcedFactsMigrationService` with detect/preview/migrate methods
   - Converts nested `sourced_facts` to flat `sourced_*` properties
   - Marks `sourcedFactsComplete` on completion

6. **feat: add Cleanup Wizard Step 13 for Life Events migration (#52)**
   - Created `LifeEventsMigrationService` with detect/preview/migrate methods
   - Creates event note files for each inline event
   - Updates person notes with `life_events` wikilink arrays
   - Marks `eventsComplete` on completion

### New Files

- `src/sources/services/sourced-facts-migration-service.ts`
- `src/events/services/life-events-migration-service.ts`

### Modified Files

- `src/sources/types/source-types.ts` - New types and mappings
- `src/types/frontmatter.ts` - New sourced_* properties
- `src/sources/services/evidence-service.ts` - Dual-format reading
- `src/sources/index.ts` - New exports
- `src/ui/control-center.ts` - Write to flat properties
- `src/settings.ts` - Migration tracking setting
- `src/ui/views/migration-notice-view.ts` - v0.18.9 notice
- `src/ui/cleanup-wizard-modal.ts` - Steps 12 and 13

### Remaining Work

- [ ] Update `MapDataService` to read `life_events` property
- [ ] Update `shouldShowMigrationNotice()` in main.ts
- [ ] Auto-complete migrations when no legacy data exists
- [ ] Update wiki documentation
- [ ] Add deprecation warnings in settings UI
