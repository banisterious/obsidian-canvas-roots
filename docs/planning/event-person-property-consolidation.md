# Event Person Property Consolidation

Planning document for consolidating `person` and `persons` event properties into a single unified property.

- **Status:** In Progress (Phase 1, 2, 4 Complete)
- **GitHub Issue:** #TBD
- **Created:** 2025-12-27
- **Updated:** 2025-12-28

---

## Overview

Currently, event notes use two different properties to track participants:

- **`person`** (string): Single participant, used for individual events like birth, death, occupation
- **`persons`** (array): Multiple participants, used for family events like marriage, divorce, residence

This duality creates complexity in:
- Base templates (requires formula to coalesce both properties)
- Importers (must decide which property to populate)
- Services (must check both properties when filtering/reading)
- User understanding (which property to use when?)

**Goal:** Consolidate to a single `persons` array property that works for all events.

**Decision:** Keep `persons` as the property name (not `participants`) since:
- Matches existing usage in the codebase
- The base template already uses `participant` as a *formula* name, so renaming to `participants` would cause confusion

---

## Current State

### Property Usage

| Event Type | Current Property | Value Example |
|------------|------------------|---------------|
| Birth | `person` | `"[[John Smith]]"` |
| Death | `person` | `"[[John Smith]]"` |
| Occupation | `person` | `"[[John Smith]]"` |
| Marriage | `persons` | `["[[John Smith]]", "[[Jane Doe]]"]` |
| Divorce | `persons` | `["[[John Smith]]", "[[Jane Doe]]"]` |
| Residence | `persons` | `["[[John Smith]]", "[[Jane Doe]]"]` |

### Events Base Template Workaround

In v0.17.7, we added a `participant` formula to handle this duality:

```yaml
participant: 'if(${person}, ${person}, ${persons}.map([value, html("<span style=\"margin-left:-0.25em\">,</span>")]).flat().slice(0, -1))'
```

This works but is a symptom of the underlying schema issue.

---

## Proposed Solution

### Target Schema

All events use a single `persons` property (array):

| Event Type | Property | Value Example |
|------------|----------|---------------|
| Birth | `persons` | `["[[John Smith]]"]` |
| Death | `persons` | `["[[John Smith]]"]` |
| Occupation | `persons` | `["[[John Smith]]"]` |
| Marriage | `persons` | `["[[John Smith]]", "[[Jane Doe]]"]` |
| Divorce | `persons` | `["[[John Smith]]", "[[Jane Doe]]"]` |

Single-participant events simply have an array with one element.

### Benefits

1. **Consistency**: One property to learn and use
2. **Simpler base formulas**: No coalescing needed
3. **Simpler importers**: Always populate the same property
4. **Future-proof**: Any event can have multiple participants without schema change

---

## Migration Strategy

### Phase 1: Update Importers and Services

Update all code that writes event properties to always use `persons` array.

**Importers to modify:**
- `src/gramps/gramps-parser.ts` — Gramps XML import
- `src/gedcom/gedcom-importer-v2.ts` — GEDCOM import (note: `gedcom-parser.ts` mentioned in original doc doesn't exist; v2 is the active importer)
- `src/gedcomx/gedcomx-importer.ts` — GEDCOM X import (if it handles events)

**Services to modify:**
- `src/events/services/event-service.ts` — Creates and updates event notes; currently writes both `person` and `persons`

**Change:**
- Single-participant events: `persons: ["[[Person]]"]` instead of `person: "[[Person]]"`
- Multi-participant events: unchanged (already use `persons`)

### Phase 2: Update Base Templates

Simplify the events base template formula and clean up deprecated references.

**File:** `src/constants/events-base-template.ts`

**Formula change:**

Before:
```yaml
participant: 'if(${person}, ${person}, ${persons}.map([value, html(...)]).flat().slice(0, -1))'
```

After:
```yaml
participant: '${persons}.map([value, html("<span style=\"margin-left:-0.25em\">,</span>")]).flat().slice(0, -1)'
```

Or even simpler if Bases handles single-element arrays gracefully:
```yaml
participant: '${persons}'
```

**Other template changes:**
- Remove `note.${person}` from `visibleProperties` (line 57) — keep only `formula.participant`
- Remove `note.${person}` property definition (lines 85-86)
- Update "By Person" view (lines 140-147) — currently filters on `!${person}.isEmpty()`, needs to filter on `persons` instead or use the participant formula

### Phase 3: Update Reading Code

After migration, services that read events can be simplified to only check `persons`. During transition, they should continue checking both.

**Files that read both properties:**
- `src/events/services/event-service.ts` — `getEventsForPerson()`, `getUniquePeople()`, `getEventsByPerson()`
- `src/events/services/timeline-canvas-exporter.ts` — Filters events by person, gets person for labels
- `src/events/services/timeline-markdown-exporter.ts` — May also reference person property
- `src/reports/services/place-summary-generator.ts` — `getEventParticipants()` reads both `event.person` and `event.persons`

**Transition approach:**
1. Keep reading both properties during migration period
2. After sufficient time (2-3 versions), simplify to only read `persons`
3. Log deprecation warning if `person` property is encountered

### Phase 4: Migration Tool

Add a cleanup wizard step or standalone migration command:

1. Find all event notes with `person` property (singular)
2. Convert `person: "[[X]]"` → `persons: ["[[X]]"]`
3. Remove the old `person` property
4. Report results to user

**Implementation options:**
- Add to Cleanup Wizard Phase 4
- Standalone command: "Canvas Roots: Migrate event person properties"
- Run automatically on plugin load with user confirmation

### Phase 5: Update Documentation

- Frontmatter Reference: Remove `person`, document `persons` as the canonical property
- Migration notes in CHANGELOG
- Update any examples using `person`

---

## Backward Compatibility

### Reading Old Notes

The base template formula should continue to support both properties during transition:

```yaml
participant: 'if(${persons}, ${persons}.map(...), if(${person}, [${person}], []))'
```

### Property Aliases

Users with property aliases for `person` should be notified and guided to update their aliases to `persons`.

---

## Open Questions

1. ~~**Property name**: Keep `persons` or rename to `participants`?~~ **Resolved:** Keep `persons` (see Decision in Overview)

2. **Migration timing**: When to run the migration?
   - On plugin update (risky, could surprise users)
   - Manual command (requires user action)
   - Cleanup Wizard integration (natural place for data fixes) ← **Recommended**

3. **Deprecation period**: How long to support reading `person`?
   - Forever (just stop writing it) ← **Recommended** for simplicity
   - 2-3 versions with deprecation warning
   - Remove after major version bump

---

## Implementation Checklist

### Phase 1: Update Writers ✅
- [x] Update `src/gramps/gramps-importer.ts` to use `persons` for all events
- [x] Update `src/gedcom/gedcom-importer-v2.ts` to use `persons` for all events
- [x] Update `src/gedcomx/gedcomx-importer.ts` for event handling
- [x] Update `src/events/services/event-service.ts` to write only `persons`

### Phase 2: Update Base Template ✅
- [x] Update `participant` formula in `src/constants/events-base-template.ts` for backward compat
- [x] Update "By Person" view to check both `persons` and `person` properties

### Phase 3: Update Readers (optional cleanup)
- [ ] Simplify `src/events/services/event-service.ts` to read only `persons`
- [ ] Simplify `src/events/services/timeline-canvas-exporter.ts`
- [ ] Simplify `src/reports/services/place-summary-generator.ts`

### Phase 4: Migration Tool ✅
- [x] Add migration step to Cleanup Wizard (Step 11)
- [x] Add one-time migration notice for v0.18.0 upgrades
- [x] Create `src/events/services/event-person-migration-service.ts`

### Phase 5: Documentation
- [ ] Update Frontmatter Reference documentation
- [ ] Add CHANGELOG entry
- [ ] Test with existing vaults containing both property types

---

## Related Documents

- [Frontmatter Reference](../../wiki-content/Frontmatter-Reference.md) - Property documentation
- [Events Base Template](../../src/constants/events-base-template.ts) - Current formula workaround
- [Cleanup Wizard Phase 4](./cleanup-wizard-phase4.md) - Potential integration point
