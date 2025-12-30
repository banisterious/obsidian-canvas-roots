# Nested Properties Redesign Plan

- **Created:** 2025-12-29
- **Status:** Planning
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

### Phase 1: Add Flat Property Support (v0.19.0)

**`sourced_facts` migration:**
1. Add new flat properties: `sourced_birth_date`, `sourced_death_date`, etc.
2. Update `EvidenceService` to read from both old and new formats
3. Update UI to write only new format
4. Add setting: "Use legacy sourced_facts format" (default: OFF)

**`events` migration:**
1. Add support for `life_events` property (array of event note links)
2. Update `MapDataService` to read from both `events` and `life_events`
3. Update map view to recognize both formats

### Phase 2: Migration Wizard (v0.19.0)

Add two steps to Cleanup Wizard:

**Step: "Migrate Evidence Tracking"**
- Scan for person notes with nested `sourced_facts`
- Convert to individual `sourced_*` properties
- Preview changes before applying
- Option to keep or remove old property

**Step: "Migrate Life Events to Event Notes"**
- Scan for person notes with `events` array
- Create event note files for each item
- Update person notes with `life_events` links
- Option to keep or remove old property

### Phase 3: Deprecation Notice (v0.20.0)

- Add deprecation warnings when reading old format
- Update documentation to recommend new format
- Mark old format as "legacy" in settings

### Phase 4: Removal (v1.0.0 or later)

- Remove support for reading nested formats
- Remove migration wizard steps (assume all migrated)
- Clean up codebase

---

## Implementation Checklist

### For `sourced_facts` → Individual Properties

- [ ] Define new property names in `frontmatter.ts`
- [ ] Update `EvidenceService.getFactCoverageForFile()` to check new properties
- [ ] Update Control Center Research Gaps widget
- [ ] Add backward compatibility reader for old format
- [ ] Add migration wizard step
- [ ] Update wiki documentation
- [ ] Add deprecation warning in settings UI

### For `events` → Event Note Files

- [ ] Add `life_events` property to `PersonFrontmatter`
- [ ] Update `MapDataService.getLifeEventsForPerson()` to check new property
- [ ] Create "Convert life events to event notes" wizard
  - [ ] Scan person notes with `events` array
  - [ ] Generate event note files with proper naming
  - [ ] Update person notes with `life_events` links
  - [ ] Preview and confirm before execution
- [ ] Update map markers to work with both formats
- [ ] Update Geographic Features documentation
- [ ] Add deprecation notice in settings

---

## Timeline

**v0.19.0 (Target: Early January 2026)**
- Implement flat alternatives
- Add migration wizards
- Update documentation
- Maintain backward compatibility

**v0.20.0 (Target: Mid January 2026)**
- Add deprecation warnings
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

**Timeline:** Migration tools in v0.19.0 (January 2026)

**Action needed:** None immediately - migration wizard will handle conversion automatically.
```

---

## Open Questions

1. Should we fast-track this to v0.18.7 instead of v0.19.0?
2. For `sourced_*` properties, should we use arrays or comma-separated strings?
3. Should migration be automatic on upgrade or require user action?
4. What should happen to users who click "update" and corrupt their data? (Recovery tool?)

---

## Related Files

- Implementation: `src/sources/services/evidence-service.ts`
- Types: `src/sources/types/source-types.ts`, `src/types/frontmatter.ts`
- Map integration: `src/maps/map-data-service.ts`
- Documentation: `wiki-content/Evidence-And-Sources.md`, `wiki-content/Geographic-Features.md`
