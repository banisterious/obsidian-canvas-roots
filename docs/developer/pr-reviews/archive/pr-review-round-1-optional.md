# PR Review Round 1 - Optional Issues

**Source:** [Obsidian PR Comment #3577414946](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3577414946)

**Priority:** Optional
**Total Issues:** 23
**Category:** Various optional improvements

## FileManager.trashFile() (1 occurrence)

Use 'FileManager.trashFile()' instead of 'Vault.delete()' to respect the user's file deletion preference.

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 1633 | [main.ts](../../../main.ts#L1633) | ❌ |

### Fix Strategy

```typescript
// Before
await this.app.vault.delete(file);

// After
await this.app.fileManager.trashFile(file);
```

---

## Unused Variables (22 occurrences)

Variables assigned but never used should be removed or prefixed with `_` if intentionally unused.

### src/core/bidirectional-linker.ts

| # | Line | Variable | Status |
|---|------|----------|--------|
| 1 | 685 | `fieldLineIndex` | ❌ |

### src/core/canvas-finder.ts

| # | Line | Variable | Status |
|---|------|----------|--------|
| 2 | 83 | `error` | ❌ |

### src/core/family-chart-layout.ts

| # | Line | Variable | Status |
|---|------|----------|--------|
| 3 | 196 | `_` | ❌ |
| 4 | 296 | `_y` | ❌ |
| 5 | 409 | `_` | ❌ |

### src/excalidraw/excalidraw-exporter.ts

| # | Line | Variable | Status |
|---|------|----------|--------|
| 6 | 11 | `CanvasEdge` (unused import) | ❌ |

### src/gedcom/gedcom-exporter.ts

| # | Line | Variable | Status |
|---|------|----------|--------|
| 7 | 7 | `TFile` (unused import) | ❌ |

### src/gedcom/gedcom-importer.ts

| # | Line | Variable | Status |
|---|------|----------|--------|
| 8 | 209 | `gedcomId` | ❌ |

### src/ui/control-center.ts

| # | Line | Variable | Status |
|---|------|----------|--------|
| 9 | 2396 | `labelLabel` | ❌ |
| 10 | 2608 | `nodeColorSetting` | ❌ |
| 11 | 2628 | `parentChildArrowSetting` | ❌ |
| 12 | 2647 | `spouseArrowSetting` | ❌ |
| 13 | 2666 | `parentChildColorSetting` | ❌ |
| 14 | 2689 | `spouseColorSetting` | ❌ |
| 15 | 2712 | `spouseEdgesSetting` | ❌ |
| 16 | 2728 | `spouseLabelsSetting` | ❌ |
| 17 | 4641 | `error` | ❌ |

### src/ui/find-on-canvas-modal.ts

| # | Line | Variable | Status |
|---|------|----------|--------|
| 18 | 107 | `nameSpan` | ❌ |
| 19 | 116 | `nodeCountBadge` | ❌ |
| 20 | 123 | `treeTypeBadge` | ❌ |

### src/ui/folder-scan-modal.ts

| # | Line | Variable | Status |
|---|------|----------|--------|
| 21 | 158 | `resultsHeader` | ❌ |
| 22 | 182 | `issueBadge` | ❌ |

### src/ui/person-picker.ts

| # | Line | Variable | Status |
|---|------|----------|--------|
| 23 | 252 | `sortLabel` | ❌ |

### src/ui/regenerate-options-modal.ts

| # | Line | Variable | Status |
|---|------|----------|--------|
| 24 | 43 | `error` | ❌ |

### src/ui/validation-results-modal.ts

| # | Line | Variable | Status |
|---|------|----------|--------|
| 25 | 2 | `ValidationIssue` (unused import) | ❌ |
| 26 | 90 | `typeBadge` | ❌ |

## Progress

**Completed: 0/23 (0%)**

## Notes

- Unused imports should be removed entirely
- Unused variables in catch blocks should use `_error` convention
- Variables used only for side effects in method chaining may need the assignment removed
