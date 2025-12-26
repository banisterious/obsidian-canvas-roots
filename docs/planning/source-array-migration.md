# Source Property Array Migration

## Status: ✅ Complete

All four phases implemented. See commits:
- Phase 4: `bbbaefd` - Remove indexed format support
- Migration notice: `b4bb817` - v0.17.0 upgrade notice

## Overview

Migrate the existing indexed `source`, `source_2`, `source_3`, etc. pattern to a YAML array format for consistency with the new `media` property and cleaner frontmatter.

## Release Target

**Target Version:** v0.17.0 (Data Cleanup Bundle)

This migration is bundled with the Post-Import Cleanup Wizard in v0.17.0. Both features share a focus on post-import data quality and benefit from being released together:

- The wizard provides a guided context for running the migration
- Breaking changes are consolidated into a single major version bump
- Users get a comprehensive cleanup experience in one release

See [Roadmap: v0.17.0 Data Cleanup Bundle](../../wiki-content/Roadmap.md#v0170-data-cleanup-bundle) for bundle details.

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

### Phase 1: Support Both Formats (Non-Breaking) ✅
1. ✅ Update parsing logic to accept both indexed (`source_*`) and array (`sources`) formats
2. ✅ Continue writing in indexed format for compatibility
3. Add deprecation notices in documentation

### Phase 2: Migration Tooling ✅
1. ✅ Create `SourceMigrationService` in `src/sources/services/`
   - `detectIndexedSources()` - Find notes with indexed source properties
   - `previewMigration()` - Preview changes without modifying files
   - `migrateToArrayFormat()` - Apply migration to notes
2. ✅ **Wizard Integration:** Add as Step 6 in Post-Import Cleanup Wizard
   - Pre-scan detects notes using indexed format
   - Preview shows proposed changes before applying
   - Batch migration with progress indicator
   - Auto-skip if no indexed sources detected

### Phase 3: Deprecate Indexed Format ✅
1. ✅ Switch default writing format to array in importers
   - Gramps importer already uses array format
   - GEDCOM importer already uses array format
2. ✅ Add console warnings when indexed format is detected
   - Warning logged once per session when pre-scan finds indexed sources
3. ✅ Update documentation
   - Updated `wiki-content/Frontmatter-Reference.md` with `sources` property
   - Added `sources` to supported property aliases list
   - Added deprecation note pointing to Cleanup Wizard Step 6

### Phase 4: Remove Indexed Support ✅
1. ✅ Remove indexed format parsing from statistics-service.ts
2. ✅ Update warning message to indicate format is no longer supported
3. ✅ Update documentation to reflect removal

## Considerations

### Backwards Compatibility (Resolved)
- ✅ Transition period complete - indexed format no longer parsed
- ✅ Gramps and GEDCOM importers already write array format
- ✅ Migration wizard available for users with legacy notes

### Property Name (Decided)
- Using `sources` (plural) for the array property
  - Clearer semantic meaning
  - Avoids confusion with single vs. multiple

## Implementation Notes

### Service Architecture ✅
- `SourceMigrationService` class in `src/sources/services/source-migration-service.ts`
- Standalone service (not integrated into DataQualityService to keep concerns separate)
- Reuses existing frontmatter update patterns via Obsidian's `processFrontMatter`

### Wizard Step Implementation ✅
```typescript
// In CleanupWizardModal WIZARD_STEPS array
{
  id: 'source-migrate',
  number: 6,
  title: 'Migrate Source Properties',
  shortTitle: 'Sources',
  description: 'Convert indexed source properties (source_2, source_3) to array format.',
  type: 'batch',
  service: 'SourceMigrationService',
  detectMethod: 'detectIndexedSources',
  applyMethod: 'migrateToArrayFormat',
  dependencies: [5]
}
```

## Dependencies

- Universal Media Linking implementation (validates array pattern works well)
- Property alias system update for new `sources` property
- Post-Import Cleanup Wizard (provides wizard step integration)

## Related

- [Universal Media Linking](./universal-media-linking.md) - Uses array format from the start
- [v0.17.0 Migration Notice](./v0170-migration-notice.md) - One-time upgrade notice for users
