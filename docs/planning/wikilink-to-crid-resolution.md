# Wikilink to cr_id Resolution

Planning document for automatic wikilink resolution in relationship fields.

- **Status:** Planning
- **GitHub Issue:** [#104](https://github.com/banisterious/obsidian-canvas-roots/issues/104)
- **Created:** 2026-01-07

---

## Overview

Enable automatic resolution of wikilinks to `cr_id` values in relationship fields, eliminating the need for manual `_id` field population in most cases.

### Goals

1. **Improved UX** — Wikilinks in relationship fields (e.g., `father: "[[John Smith]]"`) are automatically resolved to `cr_id` values, creating the relationship in the family graph without requiring manual `_id` field population
2. **Backward compatibility** — Existing `_id` fields continue to work and take precedence
3. **Performance** — Resolution is cached to avoid repeated vault scans
4. **Graceful degradation** — Ambiguous or missing resolutions produce warnings, not errors

### Non-Goals

- Automatic creation of `_id` fields in frontmatter (would cause file modification on read)
- Resolution of paths that don't exist (cannot resolve `[[Non-existent Person]]`)
- Disambiguation UI during graph building (too disruptive)

---

## Problem Statement

**Current behavior:**
- Relationship fields can contain wikilinks: `father: "[[John Smith]]"`
- `extractCrIdFromWikilink()` in `family-graph.ts` returns `null` for wikilinks
- Users must manually add `father_id: "abc-123-def-456"` for the relationship to work
- This is tedious and error-prone

**User expectation:**
- `father: "[[John Smith]]"` should automatically resolve to John Smith's `cr_id`
- The relationship should "just work" like Obsidian's native linking

**Technical context:**
- `ProofSummaryService` already has working wikilink resolution (lines 558-582)
- Multiple services rebuild `cr_id` → `TFile` maps on each operation
- No centralized person index exists

---

## Current Architecture

### Wikilink Handling (family-graph.ts ~line 1636)

```typescript
private extractCrIdFromWikilink(value: unknown): string | null {
  // ...
  const wikilinkMatch = value.match(/\[\[([^\]]+)\]\]/);
  if (!wikilinkMatch) {
    return value;  // Not a wikilink, return as direct cr_id
  }
  // It's a wikilink - we can't extract cr_id from it, return null
  return null;
}
```

### ProofSummaryService Resolution (proof-summary-service.ts ~line 558)

```typescript
private extractCrIdFromWikilink(wikilink: string): string | null {
  if (!wikilink.includes('[[')) {
    return wikilink;
  }
  const match = wikilink.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
  if (!match) return null;

  const noteName = match[1];
  const files = this.app.vault.getMarkdownFiles();
  for (const file of files) {
    if (file.basename === noteName) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.cr_id) {
        return cache.frontmatter.cr_id as string;
      }
    }
  }
  return null;
}
```

### Key Files

| File | Role |
|------|------|
| `src/core/family-graph.ts` | Main relationship parsing, `extractCrIdFromWikilink()` |
| `src/core/relationship-validator.ts` | Builds `cr_id → TFile` map for validation |
| `src/sources/services/proof-summary-service.ts` | Working wikilink resolution |
| `src/core/data-quality.ts` | Person validation, builds `cr_id → PersonNode` map |

---

## Proposed Solution

### Phase 1: Centralized Person Index Service

**Effort:** Medium

Create a `PersonIndexService` that maintains cached lookups between wikilinks, file basenames, and `cr_id` values.

#### Service Interface

```typescript
interface PersonIndexService {
  // Initialization
  initialize(): Promise<void>;
  refresh(): void;

  // Lookups
  getCrIdByFilename(basename: string): string | null;
  getCrIdByWikilink(wikilink: string): string | null;
  getFilenameByCrId(crId: string): string | null;
  getFileByCrId(crId: string): TFile | null;

  // Ambiguity detection
  hasAmbiguousFilename(basename: string): boolean;
  getFilesWithBasename(basename: string): TFile[];

  // Validation
  getAllCrIds(): Set<string>;
  getOrphanedWikilinks(): string[];  // Wikilinks pointing to non-persons
}
```

#### Internal Data Structures

```typescript
class PersonIndexService {
  // Primary indices
  private crIdToFile: Map<string, TFile> = new Map();
  private fileTocrId: Map<string, string> = new Map();  // file.path → cr_id

  // Basename index (for wikilink resolution)
  private basenameToFiles: Map<string, TFile[]> = new Map();  // handles duplicates

  // Cached derived data
  private initialized: boolean = false;
}
```

#### Cache Invalidation

- Subscribe to `metadataCache.on('changed')` for incremental updates
- Full rebuild on plugin reload
- Incremental update on file rename/delete/create

### Phase 2: Integrate with Family Graph

**Effort:** Low

Update `FamilyGraph.extractCrIdFromWikilink()` to use `PersonIndexService`:

```typescript
private extractCrIdFromWikilink(value: unknown): string | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const wikilinkMatch = value.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
  if (!wikilinkMatch) {
    return value;  // Not a wikilink, return as direct cr_id
  }

  // Use PersonIndexService to resolve wikilink
  const basename = wikilinkMatch[1];
  const crId = this.personIndex.getCrIdByFilename(basename);

  if (!crId) {
    logger.debug('extractCrIdFromWikilink', `Could not resolve wikilink: ${value}`);
    return null;
  }

  return crId;
}
```

### Phase 3: Ambiguity Handling

**Effort:** Low

When multiple files share the same basename (e.g., two "John Smith" notes):

1. **Resolution returns null** — Cannot auto-resolve ambiguous references
2. **Warning in Data Quality report** — "Ambiguous wikilink: [[John Smith]] matches 2 files"
3. **_id field takes precedence** — User can disambiguate with explicit `father_id`

#### Data Quality Integration

Add new check category: "Ambiguous Wikilinks"

```typescript
// In data-quality.ts
checkAmbiguousWikilinks(): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  for (const person of this.persons) {
    // Check each relationship field for unresolved wikilinks
    const wikilinkFields = ['father', 'mother', 'spouse', 'children', ...];
    for (const field of wikilinkFields) {
      const value = person.frontmatter[field];
      if (isWikilink(value) && !person.frontmatter[`${field}_id`]) {
        const basename = extractBasename(value);
        if (this.personIndex.hasAmbiguousFilename(basename)) {
          issues.push({
            type: 'ambiguous_wikilink',
            personCrId: person.crId,
            field,
            wikilink: value,
            matchCount: this.personIndex.getFilesWithBasename(basename).length,
            suggestion: `Add ${field}_id field to disambiguate`
          });
        }
      }
    }
  }

  return issues;
}
```

### Phase 4: Performance Optimization (Future)

**Effort:** Medium

If Phase 1-3 performance is acceptable, this may not be needed.

#### Deferred Resolution

For very large vaults (10,000+ notes), consider deferred resolution:

1. Build index lazily on first access
2. Background indexing after plugin load
3. Progress indicator during initial indexing

#### Partial Indexing

Only index files that:
- Match folder filter settings
- Have `cr_type: person` frontmatter

---

## Implementation Plan

### Phase 1: PersonIndexService

1. Create `src/core/person-index-service.ts`
2. Implement core indices and lookups
3. Subscribe to metadataCache events for incremental updates
4. Add service to plugin main.ts initialization
5. Add tests for basic lookups and ambiguity detection

### Phase 2: Family Graph Integration

1. Inject `PersonIndexService` into `FamilyGraph`
2. Update `extractCrIdFromWikilink()` to use index
3. Add debug logging for resolution failures
4. Test with existing vault data

### Phase 3: Data Quality Integration

1. Add "Ambiguous Wikilinks" check category
2. Add UI section in Data Quality report
3. Document resolution behavior

### Phase 4: Migrate Other Services

Consolidate duplicate map-building code:
- `relationship-validator.ts:getAllPersonCrIds()`
- `data-quality.ts` person map building
- `proof-summary-service.ts:extractCrIdFromWikilink()`

---

## Edge Cases

### 1. Wikilink to non-person note

**Scenario:** `father: "[[Research Notes]]"` where Research Notes is not a person
**Behavior:** Resolution returns null (no `cr_id` in target)
**Mitigation:** Data Quality warning for unresolved wikilinks

### 2. Wikilink with alias

**Scenario:** `father: "[[John Smith|Dad]]"`
**Behavior:** Extract "John Smith" from before the pipe, resolve normally
**Implementation:** Already handled by regex: `/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/`

### 3. Wikilink with path

**Scenario:** `father: "[[People/Ancestors/John Smith]]"`
**Behavior:** Use full path for resolution, fall back to basename
**Implementation:** Try full path match first, then basename-only

### 4. Circular reference during indexing

**Scenario:** Index building triggers relationship resolution
**Behavior:** Not possible — index only maps `cr_id` ↔ filename, no relationship parsing
**Prevention:** Index service is pure lookup, no graph traversal

### 5. File rename

**Scenario:** User renames "John Smith.md" to "John R Smith.md"
**Behavior:** Index updates via `metadataCache.on('changed')`, wikilinks auto-update via Obsidian
**Note:** Existing `_id` fields remain valid (cr_id unchanged)

### 6. Multiple persons, same display name

**Scenario:** Two "John Smith" notes in different folders
**Behavior:** Ambiguous — resolution returns null, Data Quality warning shown
**Resolution:** User adds `_id` field to disambiguate

---

## Testing Plan

### Unit Tests

1. Wikilink parsing: `[[Name]]`, `[[Name|Alias]]`, `[[Path/Name]]`
2. Resolution: basename match, path match, no match
3. Ambiguity: single match, multiple matches, zero matches
4. Cache invalidation: file create, rename, delete, metadata change

### Integration Tests

1. End-to-end: Create person with wikilink relationship → verify graph edge created
2. Data Quality: Ambiguous wikilink → warning shown in report
3. Precedence: `_id` field present → use `_id`, ignore wikilink resolution

### Manual Tests

1. Create person A with `cr_id`
2. Create person B with `father: "[[Person A]]"` (no `father_id`)
3. Open family tree → verify B shows A as father
4. Rename Person A → verify relationship still works
5. Create Person A2 (same basename) → verify Data Quality warning

---

## Alternatives Considered

### 1. Auto-populate _id fields on file save

**Approach:** When saving a note, resolve wikilinks and add `_id` fields
**Pros:** Explicit resolution, works offline
**Cons:** Modifies user files, surprising behavior, sync conflicts

### 2. Resolve only at tree generation time

**Approach:** No index, resolve each wikilink during graph building
**Pros:** Simpler, no cache management
**Cons:** O(n²) performance (scan all files for each relationship)

### 3. Use Obsidian's resolved links

**Approach:** Leverage `metadataCache.resolvedLinks`
**Pros:** Built-in, handles paths correctly
**Cons:** Doesn't provide `cr_id`, only file paths — still need our mapping

---

## Open Questions (Resolved)

### 1. Should resolution log warnings for every unresolved wikilink?

**Options:**
- A) Log debug-level for each unresolved (noisy for non-person wikilinks)
- B) Only log when field looks like a relationship field
- C) Silent resolution, rely on Data Quality report

**Decision:** Option B — log when resolving father/mother/spouse/child fields. Wikilinks appear throughout notes (to sources, places, research notes), so logging every unresolved wikilink would be noisy. Relationship fields are where resolution matters for graph building.

### 2. Should ambiguous resolution prefer certain paths?

**Example:** `[[John Smith]]` matches `People/John Smith.md` and `Archive/John Smith.md`
**Options:**
- A) Always null for ambiguous (current proposal)
- B) Prefer paths matching folder filter settings
- C) Prefer most recently modified

**Decision:** Option A — explicit disambiguation via `_id` is clearer. Automatic disambiguation creates "magic" behavior that's hard to debug. Users expect explicit control over identity resolution—this is fundamental to genealogy.

### 3. Should the index include non-person notes with cr_id?

**Context:** Some users might add `cr_id` to place/event/source notes
**Options:**
- A) Person notes only (`cr_type: person`)
- B) Any note with `cr_id`

**Decision:** Option B — index any note with `cr_id`. More flexible for future cross-type linking (e.g., linking to sources, places). `cr_id` is already the universal identifier pattern in Canvas Roots.

### 4. Should resolved wikilinks auto-populate _id fields?

**Question:** Should resolution automatically write `_id` fields to frontmatter?

**Decision:** No — keep resolution read-only. Modifying user files during read operations is surprising behavior, creates sync conflicts in multi-device setups. Users can manually add `_id` fields if they want explicit resolution. Could be a separate "Data Quality Fix" action in the future.

### 5. When is the index built and updated?

**Decision:**
- **Initial build:** On plugin load, after metadataCache is ready
- **Incremental updates:** Subscribe to `metadataCache.on('changed', 'deleted', 'renamed')`
- **No blocking:** Index building shouldn't block plugin startup; use background initialization

### 6. How to handle path resolution in wikilinks?

**Question:** How to handle `[[Folder/John Smith]]` vs `[[John Smith]]`?

**Decision:** Try path match first, then basename fallback:
```typescript
// 1. Try exact path match: [[People/John Smith]] → People/John Smith.md
// 2. Fallback to basename match: [[John Smith]] → */John Smith.md
// 3. If multiple basename matches → ambiguous, return null
```

---

## References

- [Issue #104](https://github.com/banisterious/obsidian-canvas-roots/issues/104)
- [Issue #103](https://github.com/banisterious/obsidian-canvas-roots/issues/103) (Sibling ordering, related)
- [ProofSummaryService](../../src/sources/services/proof-summary-service.ts) (existing resolution code)

---

## Status

| Phase | Status |
|-------|--------|
| Phase 1 | Planning |
| Phase 2 | Planning |
| Phase 3 | Planning |
| Phase 4 | Future Consideration |
