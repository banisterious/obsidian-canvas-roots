# Source Property Array Migration

## Overview

Migrate the existing indexed `source`, `source_2`, `source_3`, etc. pattern to a YAML array format for consistency with the new `media` property and cleaner frontmatter.

## Current State

```yaml
# Current indexed pattern
source: "[[Parish Records, Dublin]]"
source_2: "[[Census 1901]]"
source_3: "[[Birth Certificate]]"
```

## Target State

```yaml
# New array pattern
sources:
  - "[[Parish Records, Dublin]]"
  - "[[Census 1901]]"
  - "[[Birth Certificate]]"
```

## Scope

### Entity Types Affected
- Person notes (`source_*` properties)
- Event notes (`source_*` properties)
- Any other entity types using source references

### Files to Modify
- `src/models/person.ts` - Update `PersonNode` interface
- `src/models/event.ts` - Update `EventNote` interface
- `src/core/family-graph.ts` - Update `extractPersonNode()` parsing
- `src/services/event-service.ts` - Update source parsing
- Property alias configuration
- Any UI components displaying sources

## Migration Strategy

### Phase 1: Support Both Formats (Non-Breaking)
1. Update parsing logic to accept both indexed (`source_*`) and array (`sources`) formats
2. Continue writing in indexed format for compatibility
3. Add deprecation notices in documentation

### Phase 2: Migration Tooling
1. Create migration command in Control Center
2. Bulk convert existing notes from indexed to array format
3. Provide dry-run option to preview changes

### Phase 3: Deprecate Indexed Format
1. Switch default writing format to array
2. Add console warnings when indexed format is detected
3. Update all documentation

### Phase 4: Remove Indexed Support
1. Remove indexed format parsing (major version bump)
2. Final cleanup of legacy code

## Considerations

### Backwards Compatibility
- Must support both formats during transition period
- Gramps import currently uses indexed format - needs update
- External tools/scripts may depend on indexed format

### Property Name
- Option A: Keep `source` (singular) for array property
- Option B: Use `sources` (plural) for array property - **Recommended**
  - Clearer semantic meaning
  - Avoids confusion with single vs. multiple

### Timing
- Should be done AFTER Universal Media Linking is stable
- Allows learning from media array implementation
- Reduces risk of simultaneous breaking changes

## Dependencies

- Universal Media Linking implementation (validates array pattern works well)
- Property alias system update for new `sources` property

## Related

- [Universal Media Linking](./universal-media-linking.md) - Uses array format from the start
