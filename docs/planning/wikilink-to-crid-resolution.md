# Wikilink to cr_id Resolution

Planning document for automatic wikilink resolution in relationship fields.

- **Status:** Implemented
- **GitHub Issue:** [#104](https://github.com/banisterious/obsidian-charted-roots/issues/104)
- **Created:** 2026-01-07
- **Implemented:** 2026-01-09

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

### Relationship Field Resolution Pattern (family-graph.ts, lines 1370-1515)

**Dual-storage with precedence:**
```typescript
// Single-value relationships: _id field takes precedence
const fatherIdValue = this.resolveProperty<string>(fm, 'father_id');
const fatherValue = this.resolveProperty<string>(fm, 'father');
const fatherCrId = this.filterGrampsHandle(
  fatherIdValue || this.extractCrIdFromWikilink(fatherValue) || undefined
);

// Array relationships: _id field takes precedence
const childrenIdField = this.resolveProperty<string | string[]>(fm, 'children_id');
if (childrenIdField) {
  const rawChildren = Array.isArray(childrenIdField) ? childrenIdField : [childrenIdField];
  childrenCrIds = this.filterGrampsHandles([...new Set(rawChildren)]);
} else {
  // Fallback to children field (can contain wikilinks)
  const childrenField = this.resolveProperty<string | string[]>(fm, 'children');
  // ... extract cr_ids from wikilinks
}
```

**Key patterns:**
- `_id` fields store cr_ids directly (canonical storage)
- Legacy wikilink fields are fallback when `_id` absent
- Arrays handled automatically via `Array.isArray()` checks
- Deduplication via `Set` for array fields

### Wikilink Handling (family-graph.ts, line 1636)

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

| File | Role | Map Pattern |
|------|------|-------------|
| `src/core/family-graph.ts` | Main relationship parsing, `extractCrIdFromWikilink()` | `personCache: Map<cr_id, PersonNode>` |
| `src/core/relationship-validator.ts` | Builds `cr_id → TFile` map for validation | `Map<cr_id, TFile>` |
| `src/sources/services/proof-summary-service.ts` | Working wikilink resolution | `proofCache: Map<cr_id, ProofSummaryNote>` |
| `src/core/data-quality.ts` | Person validation, builds `cr_id → PersonNode` map | Local `Map<cr_id, PersonNode>` |
| `src/core/folder-filter.ts` | Applies folder/staging/template exclusions | N/A (filter service) |

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
  private fileToCrId: Map<string, string> = new Map();  // file.path → cr_id

  // Basename index (for wikilink resolution)
  private basenameToFiles: Map<string, TFile[]> = new Map();  // handles duplicates

  // Path index (for full-path wikilinks)
  private pathToFile: Map<string, TFile> = new Map();  // normalized path → file

  // Cache validity
  private cacheValid: boolean = false;

  // Services (follow existing pattern)
  private folderFilter: FolderFilterService | null = null;
}
```

#### Implementation Pattern (Following Existing Services)

**Constructor:**
```typescript
constructor(
  private app: App,
  private settings: CanvasRootsSettings
) {}
```

**Service Integration (like FamilyGraph):**
```typescript
setFolderFilter(folderFilter: FolderFilterService): void {
  this.folderFilter = folderFilter;
  this.invalidateCache();
}

setSettings(settings: CanvasRootsSettings): void {
  this.settings = settings;
  this.invalidateCache();
}
```

**Cache Invalidation Pattern (like FamilyGraph):**
```typescript
private ensureIndexLoaded(): void {
  if (!this.cacheValid) {
    this.rebuildIndex();
    this.cacheValid = true;
  }
}

invalidateCache(): void {
  this.cacheValid = false;
}
```

#### Cache Invalidation Strategy

**Initial build:**
- On first access (lazy initialization)
- After `app.workspace.onLayoutReady()` (metadataCache ready)

**Incremental updates:**
- Subscribe to `metadataCache.on('changed')` for file modifications
- Subscribe to `metadataCache.on('deleted')` for file deletions
- Subscribe to `metadataCache.on('renamed')` for file renames

**Full rebuild triggers:**
- Folder filter settings change
- Plugin reload
- Manual cache clear (if exposed)

### Phase 2: Integrate with Family Graph

**Effort:** Low

**Service Injection (following existing pattern):**
```typescript
// In FamilyGraph constructor or via setter
setPersonIndex(personIndex: PersonIndexService): void {
  this.personIndex = personIndex;
}
```

**Update `extractCrIdFromWikilink()` to use `PersonIndexService`:**

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
  const crId = this.personIndex.getCrIdByWikilink(basename);

  if (!crId) {
    logger.debug('extractCrIdFromWikilink', `Could not resolve wikilink: ${value}`);
    return null;
  }

  return crId;
}
```

**Array handling (already supported by existing code):**
The existing code in `extractPersonNode()` already handles arrays correctly:
```typescript
// Existing pattern handles both single values and arrays
const childrenField = this.resolveProperty<string | string[]>(fm, 'children');
if (childrenField) {
  const children = Array.isArray(childrenField) ? childrenField : [childrenField];
  for (const child of children) {
    const childCrId = this.extractCrIdFromWikilink(child);
    if (childCrId) {
      childrenCrIds.push(childCrId);
    }
  }
}
```
No changes needed—wikilink resolution will automatically work for array fields.

### Phase 3: Ambiguity Handling

**Effort:** Low

When multiple files share the same basename (e.g., two "John Smith" notes):

1. **Resolution returns null** — Cannot auto-resolve ambiguous references
2. **Warning in Data Quality report** — "Ambiguous wikilink: [[John Smith]] matches 2 files"
3. **_id field takes precedence** — User can disambiguate with explicit `father_id`

#### Data Quality Integration

**Use existing issue structure** (from data-quality.ts):
```typescript
export interface DataQualityIssue {
  code: string;              // 'AMBIGUOUS_WIKILINK'
  message: string;           // Human-readable description
  severity: IssueSeverity;   // 'warning'
  category: IssueCategory;   // 'relationship_inconsistency'
  person: PersonNode;        // The affected person
  relatedPerson?: PersonNode;// Not used for ambiguous wikilinks
  details?: Record<string, string | number | boolean>;  // matchCount, field, etc.
}
```

**Add check for ambiguous wikilinks:**
```typescript
// In data-quality.ts
checkAmbiguousWikilinks(): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  for (const person of this.persons) {
    // Check each relationship field for unresolved wikilinks
    const wikilinkFields = ['father', 'mother', 'spouse', 'children', 'parents',
                           'stepfather', 'stepmother', 'adoptive_father',
                           'adoptive_mother', 'adoptive_parent'];

    for (const field of wikilinkFields) {
      const value = person.frontmatter?.[field];

      // Skip if _id field exists (takes precedence)
      if (person.frontmatter?.[`${field}_id`]) continue;

      // Handle both single values and arrays
      const values = Array.isArray(value) ? value : (value ? [value] : []);

      for (const val of values) {
        if (typeof val === 'string' && val.includes('[[')) {
          const match = val.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
          if (match) {
            const basename = match[1];
            if (this.personIndex.hasAmbiguousFilename(basename)) {
              const matchCount = this.personIndex.getFilesWithBasename(basename).length;
              issues.push({
                code: 'AMBIGUOUS_WIKILINK',
                message: `Wikilink [[${basename}]] matches ${matchCount} files`,
                severity: 'warning',
                category: 'relationship_inconsistency',
                person,
                details: {
                  field,
                  wikilink: val,
                  matchCount,
                  suggestion: `Add ${field}_id field to disambiguate`
                }
              });
            }
          }
        }
      }
    }
  }

  return issues;
}
```

**UI Pattern:**
Issues will automatically appear in the Data Quality report grouped by category. The existing card-based display will show:
- Severity icon (⚠️ for warning)
- Code: `AMBIGUOUS_WIKILINK`
- Message: "Wikilink [[John Smith]] matches 2 files"
- Person name (clickable link)
- Details: field name, suggestion

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

**File:** `src/core/person-index-service.ts`

**Steps:**
1. Create service class with data structures (maps for basename, path, cr_id)
2. Implement `rebuildIndex()` method:
   - Iterate `app.vault.getMarkdownFiles()`
   - Apply folder filter (via `this.folderFilter?.shouldIncludeFile()`)
   - Read `cr_id` from `metadataCache.getFileCache()`
   - Populate all indices (basename, path, cr_id maps)
3. Implement lookup methods:
   - `getCrIdByWikilink(basename)` - handles ambiguity
   - `getCrIdByFilename(basename)` - alias for consistency
   - `getFileByCrId(crId)` - reverse lookup
   - `hasAmbiguousFilename(basename)` - check for duplicates
   - `getFilesWithBasename(basename)` - get all matches
4. Subscribe to metadataCache events:
   - `on('changed')` - update single file entry
   - `on('deleted')` - remove from indices
   - `on('renamed')` - update path indices
5. Add `setFolderFilter()` and `setSettings()` methods
6. Add unit tests for lookups and ambiguity

**Initialize in main.ts (after folder filter, ~line 275):**
```typescript
async onload() {
  await this.loadSettings();
  LoggerFactory.setLogLevel(this.settings.logLevel);

  this.folderFilter = new FolderFilterService(this.settings);
  this.templateFilter = new TemplateFilterService(this.app, this.settings);
  this.folderFilter.setTemplateFilter(this.templateFilter);

  // NEW: Initialize PersonIndexService
  this.personIndex = new PersonIndexService(this.app, this.settings);
  this.personIndex.setFolderFilter(this.folderFilter);

  // Subscribe to metadata cache after layout ready
  this.app.workspace.onLayoutReady(() => {
    // PersonIndexService subscriptions happen in constructor
  });

  // ... rest of initialization
}
```

### Phase 2: Family Graph Integration

**File:** `src/core/family-graph.ts`

**Steps:**
1. Add `personIndex` property to `FamilyGraph` class
2. Add `setPersonIndex()` method (follows existing pattern)
3. Update `extractCrIdFromWikilink()`:
   - Parse wikilink to extract basename
   - Call `this.personIndex.getCrIdByWikilink(basename)`
   - Add debug logging for null results
4. Update `createFamilyGraphService()` in main.ts:
   ```typescript
   createFamilyGraphService(): FamilyGraphService {
     const graphService = new FamilyGraphService(this.app);
     if (this.folderFilter) {
       graphService.setFolderFilter(this.folderFilter);
     }
     if (this.personIndex) {
       graphService.setPersonIndex(this.personIndex);  // NEW
     }
     graphService.setSettings(this.settings);
     // ... rest of setup
     return graphService;
   }
   ```
5. Test with vault data containing wikilinks in relationship fields
6. Verify array fields work (should be automatic)

### Phase 3: Data Quality Integration

**File:** `src/core/data-quality.ts`

**Steps:**
1. Inject `PersonIndexService` into `DataQualityService`
2. Add `checkAmbiguousWikilinks()` method (see implementation above)
3. Call check in main analysis method
4. Test UI rendering in Data Quality report modal
5. Verify warnings appear for ambiguous wikilinks

### Phase 4: Migrate Other Services (Optional)

**Goal:** Consolidate duplicate `cr_id → file` map building

**Services to update:**
- `relationship-validator.ts:getAllPersonCrIds()` → use `personIndex.getAllCrIds()`
- `proof-summary-service.ts:extractCrIdFromWikilink()` → use `personIndex.getCrIdByWikilink()`

**Benefits:**
- Eliminate redundant vault scans
- Consistent folder filtering
- Single source of truth

**Note:** This is optional optimization—existing code works fine.

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

### 7. Folder filtering changes

**Scenario:** User changes folder filter settings (include/exclude folders)
**Behavior:** PersonIndexService invalidates cache via `setSettings()`
**Implementation:** Next access triggers full rebuild with new filter rules
**Note:** Follows same pattern as FamilyGraph

### 8. Staging folder isolation

**Scenario:** File in staging folder, staging isolation enabled
**Behavior:** File excluded from index (via folder filter)
**Implementation:** `folderFilter.shouldIncludeFile()` returns false for staging files
**Priority:** Staging/template exclusions happen before other filter rules

### 9. Array with mixed _id and wikilinks

**Scenario:**
```yaml
children:
  - "[[Alice]]"
  - "abc-123-def"
children_id:
  - "xyz-789-ghi"
```
**Behavior:** Only `children_id` values used; `children` field ignored
**Reason:** `_id` field takes absolute precedence (see family-graph.ts lines 1395-1403)
**Note:** This is existing behavior, not specific to wikilink resolution

---

## Testing Plan

### Unit Tests (PersonIndexService)

**Wikilink parsing:**
1. `[[Name]]` - simple basename
2. `[[Name|Alias]]` - with alias (extract "Name")
3. `[[Path/Name]]` - with path prefix
4. `[[Path/Nested/Name]]` - deeply nested path

**Resolution:**
1. Single match - basename resolves to cr_id
2. No match - returns null
3. Ambiguous - multiple files with same basename, returns null
4. Path match - full path specified, resolves correctly
5. Non-person note - file exists but no cr_id, returns null

**Cache invalidation:**
1. File created - index updated incrementally
2. File renamed - old basename removed, new basename added
3. File deleted - removed from all indices
4. Metadata changed - cr_id added/removed, index updated

**Folder filtering:**
1. File in excluded folder - not in index
2. File in staging folder - not in index (if isolation enabled)
3. File in template folder - not in index
4. Filter settings change - cache invalidated, rebuilt

### Integration Tests

**End-to-end resolution:**
1. Create person A with `cr_id`
2. Create person B with `father: "[[Person A]]"` (no `father_id`)
3. Open family tree → verify B shows A as father
4. Verify edge created in graph

**Array fields:**
1. Create person with `children: ["[[Alice]]", "[[Bob]]"]`
2. Verify both children resolved and appear in tree
3. Add `children_id` field → verify it takes precedence

**Data Quality integration:**
1. Create two "John Smith" notes in different folders
2. Create person with `father: "[[John Smith]]"`
3. Run Data Quality report
4. Verify warning: "Ambiguous wikilink: [[John Smith]] matches 2 files"

**Precedence:**
1. Person with both `father: "[[Wrong Person]]"` and `father_id: "correct-id"`
2. Verify graph uses `father_id`, ignores wikilink

**Folder filter interaction:**
1. Set folder filter to exclude "Archive"
2. Create person in Archive with `cr_id`
3. Create person with `father: "[[Archived Person]]"`
4. Verify relationship not resolved (person not in index)

### Manual Tests

**Basic workflow:**
1. Create person A with `cr_id`
2. Create person B with `father: "[[Person A]]"` (no `father_id`)
3. Open family tree → verify B shows A as father
4. Rename Person A → verify relationship still works
5. Create Person A2 (same basename) → verify Data Quality warning

**Performance:**
1. Test with large vault (1,000+ notes)
2. Measure index build time (should be <1 second)
3. Verify incremental updates don't cause lag

**Special characters:**
1. Create person "José García.md"
2. Create relationship with `father: "[[José García]]"`
3. Verify resolution works with non-ASCII characters

**Path disambiguation:**
1. Create "People/John Smith.md" and "Archive/John Smith.md"
2. Use `father: "[[People/John Smith]]"` with full path
3. Verify correct person resolved

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

**Decision:** Option B — index any note with `cr_id`. More flexible for future cross-type linking (e.g., linking to sources, places). `cr_id` is already the universal identifier pattern in Charted Roots.

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

- [Issue #104](https://github.com/banisterious/obsidian-charted-roots/issues/104)
- [Issue #103](https://github.com/banisterious/obsidian-charted-roots/issues/103) (Sibling ordering, related)
- [ProofSummaryService](../../src/sources/services/proof-summary-service.ts) (existing resolution code)

---

## Architectural Patterns (From Codebase Analysis)

### Service Initialization Pattern (main.ts)

**Startup sequence:**
1. Load settings from disk (`await this.loadSettings()`)
2. Initialize logger with log level
3. Initialize filter services (folder filter, template filter)
4. Initialize domain services (event, media, web clipper)
5. Register UI components (settings tab, commands, views)
6. Subscribe to events after layout ready

**PersonIndexService fits here:**
```typescript
// After folder filter initialization (~line 275)
this.personIndex = new PersonIndexService(this.app, this.settings);
this.personIndex.setFolderFilter(this.folderFilter);
```

### Service Injection Pattern

**All services use setter-based injection:**
```typescript
// FamilyGraph example
setFolderFilter(folderFilter: FolderFilterService): void {
  this.folderFilter = folderFilter;
  this.loadPersonCache(); // Rebuild with new filter
}

setSettings(settings: CanvasRootsSettings): void {
  this.settings = settings;
}
```

**PersonIndexService should follow:**
```typescript
setFolderFilter(folderFilter: FolderFilterService): void {
  this.folderFilter = folderFilter;
  this.invalidateCache(); // Trigger rebuild on next access
}
```

### Lazy Graph Creation Pattern

**FamilyGraph is created on-demand:**
```typescript
// main.ts line 187
createFamilyGraphService(): FamilyGraphService {
  const graphService = new FamilyGraphService(this.app);
  // Inject dependencies
  if (this.folderFilter) graphService.setFolderFilter(this.folderFilter);
  if (this.personIndex) graphService.setPersonIndex(this.personIndex);
  graphService.setSettings(this.settings);
  return graphService;
}
```

**Why this matters:**
- PersonIndexService must be initialized before first graph creation
- But index building can be lazy (on first access)
- MetadataCache subscriptions should start immediately (in constructor or onLayoutReady)

### Cache Invalidation Pattern

**FamilyGraph pattern (lines 1160-1256):**
```typescript
private loadPersonCache(): void {
  this.personCache.clear();
  // Rebuild from vault files
}

async reloadCache(): Promise<void> {
  this.personCache.clear();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for metadata
  this.loadPersonCache();
}
```

**PersonIndexService should use:**
```typescript
private cacheValid = false;

private ensureIndexLoaded(): void {
  if (!this.cacheValid) {
    this.rebuildIndex();
    this.cacheValid = true;
  }
}

// All public methods call ensureIndexLoaded() first
getCrIdByWikilink(basename: string): string | null {
  this.ensureIndexLoaded();
  // ... lookup logic
}
```

### Folder Filter Application Pattern

**Consistent across all services:**
```typescript
const files = this.app.vault.getMarkdownFiles();
for (const file of files) {
  // Apply folder filter FIRST
  if (this.folderFilter && !this.folderFilter.shouldIncludeFile(file)) {
    continue; // Skip excluded files
  }

  // Process file
  const cache = this.app.metadataCache.getFileCache(file);
  // ...
}
```

**Filter priority (folder-filter.ts):**
1. Staging folder (highest priority) - always excluded if isolation enabled
2. Template folders - always excluded
3. Folder filter mode (disabled/exclude/include)

### MetadataCache Usage Pattern

**Reading frontmatter (everywhere):**
```typescript
const cache = this.app.metadataCache.getFileCache(file);
if (!cache?.frontmatter) return null;
const crId = cache.frontmatter.cr_id;
```

**Subscribing to changes (main.ts line 4612):**
```typescript
this.fileModifyEventRef = this.app.metadataCache.on('changed', (file: TFile) => {
  // Handle file modification
});

// Cleanup on unload
this.app.metadataCache.offref(this.fileModifyEventRef);
```

**PersonIndexService should subscribe to:**
- `on('changed')` - update entry for modified file
- `on('deleted')` - remove from indices
- `on('renamed')` - update path maps

### Map Building Pattern

**Common across services:**
```typescript
// Primary index: cr_id → data
private personCache: Map<string, PersonNode> = new Map();

// Reverse indices for lookups
private pathToCrId: Map<string, string> = new Map();

// Build indices in single pass
for (const file of files) {
  const crId = cache.frontmatter.cr_id;
  if (crId) {
    this.personCache.set(crId, personNode);
    this.pathToCrId.set(file.path, crId);
  }
}
```

**PersonIndexService needs:**
- `crIdToFile: Map<string, TFile>` - primary index
- `fileToCrId: Map<string, string>` - reverse lookup
- `basenameToFiles: Map<string, TFile[]>` - wikilink resolution (handles duplicates)
- `pathToFile: Map<string, TFile>` - full-path wikilinks

---

## Status

| Phase | Status |
|-------|--------|
| Phase 1 | Implemented (PersonIndexService created) |
| Phase 2 | Implemented (FamilyGraph integration) |
| Phase 3 | Implemented (Data Quality ambiguous wikilink check) |
| Phase 4 | Implemented (Consolidated duplicate code in RelationshipValidator and ProofSummaryService) |

**Last Updated:** 2026-01-09 (all phases implemented)
