# PR Review Round 3 - Overview

**Source:** [Obsidian PR Comment #3579607224](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3579607224)
**Date:** 2025-01-26
**Commit:** f84d32f

## Summary

Round 3 continues to flag sentence case issues (mostly proper noun false positives) plus a few code quality issues.

## Required Issues

| Category | Count | Status |
|----------|-------|--------|
| Sentence case | 145 | Mostly false positives (proper nouns) |
| Async method no await | 3 | ✅ Fixed |
| Unexpected any | 1 | ✅ Fixed |
| Unnecessary assertions | 3 | ✅ Fixed |

**Total Required Issues: 152** (but ~145 are sentence case false positives)

## Actual Fixes Needed

### 1. Async method no await (3 issues)

| # | File | Line | Method |
|---|------|------|--------|
| 1 | main.ts | 1138 | `generateTreeForCurrentNote` |
| 2 | src/core/family-graph.ts | 645 | `loadPersonCache` |
| 3 | src/core/vault-stats.ts | 50 | `collectStats` |

**Fix:** Remove `async` keyword from methods that don't use `await`.

### 2. Unexpected any (1 issue)

| # | File | Line |
|---|------|------|
| 1 | main.ts | 1443 |

**Fix:** Replace `any` with proper type.

### 3. Unnecessary assertions (3 issues)

| # | File | Line |
|---|------|------|
| 1 | src/ui/canvas-style-modal.ts | 38 |
| 2 | src/ui/canvas-style-modal.ts | 238 |
| 3 | src/ui/control-center.ts | 2567 |

**Fix:** Remove unnecessary type assertions.

## Sentence Case Issues (False Positives)

The 145 sentence case flags are mostly for proper nouns that should remain capitalized:
- **"Canvas Roots"** - Plugin name
- **"GEDCOM"** - Industry standard acronym
- **"Excalidraw"** - Third-party product name
- **"Obsidian Canvas"** / **"Obsidian Bases"** - Obsidian feature names

These are correctly capitalized and should not be changed.

## Progress

**Completed: 7/7 actual issues (100%)**

## Fixes Applied

### Async method no await
- `main.ts#L1138`: Removed `async` from `generateTreeForCurrentNote`, added `: void` return type
- `family-graph.ts#L645`: Removed `async` and `Promise<void>`, changed to `void` return type
- `vault-stats.ts#L50`: Removed `async` and `Promise<FullVaultStats>`, changed to `FullVaultStats` return type

### Unexpected any
- `main.ts#L1443`: Changed `Record<string, any>` to `Record<string, unknown>`

### Unnecessary assertions
- `canvas-style-modal.ts#L38`: Removed `as Record<string, unknown> | undefined` assertion
- `canvas-style-modal.ts#L238`: Removed `as Record<string, unknown>` assertion
- `control-center.ts#L2567`: Removed assertion, added explicit type annotation to `treeTypeValue` variable declaration instead

## Notes

- Sentence case issues are false positives for proper nouns
