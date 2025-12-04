# PR Review Round 1 - Complete Tracking

**Source:** [Obsidian PR Comment #3577414946](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3577414946)

**Status:** Not Started
**Total Issues:** 349 violations across 17 categories (Required) + 23 optional
**Branch:** `fixes/pr-review-round-1`

---

## Progress Summary

**Total Progress: 0/349 (0%)**

### Required Issues

- [ ] High Priority (17 issues) - 0/17
- [ ] Medium Priority (53 issues) - 0/53
- [ ] Low Priority (279 issues) - 0/279

### Optional Issues

- [ ] Optional (23 issues) - 0/23

---

## Category 1: Console Statements

**Priority:** High
**File:** [pr-review-round-1-console-statements.md](pr-review-round-1-console-statements.md)
**Issues:** 3

Only `console.warn`, `console.error`, and `console.debug` are allowed.

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 30 | main.ts | ❌ |
| 2 | 881 | main.ts | ❌ |
| 3 | 140 | src/core/logging.ts | ❌ |

---

## Category 2: Floating Promises

**Priority:** High
**File:** [pr-review-round-1-floating-promises.md](pr-review-round-1-floating-promises.md)
**Issues:** 13

Promises must be awaited, end with `.catch()`, `.then()` with rejection handler, or be explicitly marked as ignored with `void`.

| # | File | Locations | Status |
|---|------|-----------|--------|
| 1 | main.ts | 38, 62, 97, 106 | ❌ |
| 2 | src/ui/control-center.ts | 204, 219, 222, 2060-2070, 2079-2089, 3568, 3956, 4626-4644 | ❌ |
| 3 | src/ui/relationship-calculator-modal.ts | 386 | ❌ |

---

## Category 3: Promise-Returning Method in Plugin

**Priority:** High
**File:** [pr-review-round-1-plugin-promise-method.md](pr-review-round-1-plugin-promise-method.md)
**Issues:** 1

Promise-returning method provided where a void return was expected by extended/implemented type 'Plugin'.

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 880-887 | main.ts | ❌ |

---

## Category 4: Async Arrow Function No Await

**Priority:** Medium
**File:** [pr-review-round-1-async-arrow-no-await.md](pr-review-round-1-async-arrow-no-await.md)
**Issues:** 11

Async arrow function has no 'await' expression.

| # | File | Locations | Status |
|---|------|-----------|--------|
| 1 | main.ts | 157, 211, 364, 379, 502, 516, 651, 669, 715, 733 | ❌ |
| 2 | src/ui/control-center.ts | 1683 | ❌ |

---

## Category 5: Promise Returned in Void Context

**Priority:** Medium
**File:** [pr-review-round-1-promise-void-context.md](pr-review-round-1-promise-void-context.md)
**Issues:** 29

Promise returned in function argument where a void return was expected.

**Files affected:**
- main.ts (9 locations)
- src/ui/canvas-style-modal.ts (2 locations)
- src/ui/control-center.ts (12 locations)
- src/ui/find-on-canvas-modal.ts (1 location)
- src/ui/folder-scan-modal.ts (1 location)
- src/ui/regenerate-options-modal.ts (1 location)
- src/ui/relationship-calculator-modal.ts (1 location)

---

## Category 6: Async Method No Await (Various)

**Priority:** Medium
**File:** [pr-review-round-1-async-method-no-await.md](pr-review-round-1-async-method-no-await.md)
**Issues:** 11

Async methods that have no 'await' expression.

| # | Line | File | Method | Status |
|---|------|------|--------|--------|
| 1 | 880 | main.ts | `onunload` | ❌ |
| 2 | 47 | src/core/bidirectional-linker.ts | `initializeSnapshots` | ❌ |
| 3 | 74 | src/core/canvas-finder.ts | `nodeMatchesPerson` | ❌ |
| 4 | 684 | src/core/family-graph.ts | `extractPersonNode` | ❌ |
| 5 | 192 | src/core/relationship-validator.ts | `getAllPersonCrIds` | ❌ |
| 6 | 130 | src/core/vault-stats.ts | `extractPersonData` | ❌ |
| 7 | 252 | src/ui/control-center.ts | `openWithPerson` | ❌ |
| 8 | 4710 | src/ui/control-center.ts | `extractPersonInfoFromFile` | ❌ |
| 9 | 67 | src/ui/folder-scan-modal.ts | `findPersonNotes` | ❌ |
| 10 | 181 | src/ui/person-picker.ts | `extractPersonInfo` | ❌ |
| 11 | 34 | src/ui/relationship-calculator-modal.ts | `onOpen` | ❌ |
| 12 | 131 | src/ui/tree-preview.ts | `renderPreview` | ❌ |

---

## Category 7: Unexpected Any

**Priority:** Medium
**File:** [pr-review-round-1-unexpected-any.md](pr-review-round-1-unexpected-any.md)
**Issues:** 2

Unexpected any. Specify a different type.

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 1447 | main.ts | ❌ |
| 2 | 79 | src/core/person-note-writer.ts | ❌ |

---

## Category 8: Sentence Case for UI Text

**Priority:** Low (UI Consistency)
**File:** [pr-review-round-1-sentence-case.md](pr-review-round-1-sentence-case.md)
**Issues:** 167

Use sentence case for UI text (only capitalize first word and proper nouns).

**Files affected:**
- main.ts (35 locations)
- src/core/relationship-manager.ts (5 locations)
- src/gedcom/gedcom-exporter.ts (1 location)
- src/gedcom/gedcom-importer.ts (2 locations)
- src/settings.ts (4 locations)
- src/ui/canvas-style-modal.ts (7 locations)
- src/ui/control-center.ts (108 locations)
- src/ui/folder-scan-modal.ts (4 locations)
- src/ui/gedcom-import-results-modal.ts (1 location)

---

## Category 9: Avoid Inline Styles

**Priority:** Low (Maintainability)
**File:** [pr-review-round-1-inline-styles.md](pr-review-round-1-inline-styles.md)
**Issues:** 43

Avoid setting styles directly via `element.style.*`. Use CSS classes for better theming and maintainability.

**Breakdown by style property:**
- `display`: 20 occurrences
- `marginTop`: 7 occurrences
- `cursor`: 4 occurrences
- `gap`: 3 occurrences
- `justifyContent`: 3 occurrences
- `width`: 2 occurrences
- `fontSize`: 2 occurrences
- `color`: 2 occurrences

---

## Category 10: Unnecessary Type Assertions

**Priority:** Low (Code Cleanup)
**File:** [pr-review-round-1-unnecessary-assertions.md](pr-review-round-1-unnecessary-assertions.md)
**Issues:** 12

This assertion is unnecessary since it does not change the type of the expression.

| # | File | Locations | Status |
|---|------|-----------|--------|
| 1 | src/core/bidirectional-linker.ts | 242 | ❌ |
| 2 | src/core/family-chart-layout.ts | 99, 115, 434, 437 | ❌ |
| 3 | src/core/family-graph.ts | 395-400, 915-922 | ❌ |
| 4 | src/excalidraw/excalidraw-exporter.ts | 547 | ❌ |
| 5 | src/gedcom/gedcom-exporter.ts | 485 | ❌ |
| 6 | src/ui/canvas-style-modal.ts | 38, 238 | ❌ |
| 7 | src/ui/control-center.ts | 2553 | ❌ |

---

## Category 11: DOM innerHTML Usage

**Priority:** Low (Security/Best Practice)
**File:** [pr-review-round-1-innerhtml.md](pr-review-round-1-innerhtml.md)
**Issues:** 9

Do not write to DOM directly using innerHTML/outerHTML property.

| # | File | Locations | Status |
|---|------|-----------|--------|
| 1 | src/settings.ts | 150-151, 269-270 | ❌ |
| 2 | src/ui/control-center.ts | 535, 540, 1763-1764, 3333, 4611-4612, 4633-4634 | ❌ |
| 3 | src/ui/tree-preview.ts | 383 | ❌ |

---

## Category 12: Regex Space Count

**Priority:** Low (Readability)
**File:** [pr-review-round-1-regex-spaces.md](pr-review-round-1-regex-spaces.md)
**Issues:** 9

Spaces are hard to count. Use `{2}` instead of multiple spaces.

| # | File | Locations | Status |
|---|------|-----------|--------|
| 1 | src/core/person-note-writer.ts | 334, 336, 355 | ❌ |
| 2 | src/core/relationship-manager.ts | 161, 170, 213, 222 | ❌ |
| 3 | src/core/relationship-validator.ts | 232, 235 | ❌ |

---

## Category 13: Lexical Declaration in Case Block

**Priority:** Low (Code Quality)
**File:** [pr-review-round-1-lexical-case.md](pr-review-round-1-lexical-case.md)
**Issues:** 2

Unexpected lexical declaration in case block.

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 344 | src/core/relationship-calculator.ts | ❌ |
| 2 | 359 | src/core/relationship-calculator.ts | ❌ |

---

## Category 14: Invalid Template Literal Expression

**Priority:** Low
**File:** [pr-review-round-1-template-literal.md](pr-review-round-1-template-literal.md)
**Issues:** 1

Invalid type "string[] | undefined" of template literal expression.

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 103 | src/core/person-note-writer.ts | ❌ |

---

## Category 15: Unnecessary Escape Character

**Priority:** Low
**File:** [pr-review-round-1-unnecessary-escape.md](pr-review-round-1-unnecessary-escape.md)
**Issues:** 1

Unnecessary escape character: `/`.

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 280 | src/core/logging.ts | ❌ |

---

## Optional Issues

**File:** [pr-review-round-1-optional.md](pr-review-round-1-optional.md)
**Issues:** 23

### FileManager.trashFile() (1 occurrence)
Use 'FileManager.trashFile()' instead of 'Vault.delete()' to respect the user's file deletion preference.

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 1633 | main.ts | ❌ |

### Unused Variables (22 occurrences)
Variables assigned but never used.

**Files affected:**
- src/core/bidirectional-linker.ts: `fieldLineIndex`
- src/core/canvas-finder.ts, src/ui/control-center.ts, src/ui/regenerate-options-modal.ts: `error`
- src/core/family-chart-layout.ts: `_`, `_y`
- src/excalidraw/excalidraw-exporter.ts: `CanvasEdge` (unused import)
- src/gedcom/gedcom-exporter.ts: `TFile` (unused import)
- src/gedcom/gedcom-importer.ts: `gedcomId`
- src/ui/control-center.ts: various UI element variables
- src/ui/find-on-canvas-modal.ts: `nameSpan`, `nodeCountBadge`, `treeTypeBadge`
- src/ui/folder-scan-modal.ts: `resultsHeader`, `issueBadge`
- src/ui/person-picker.ts: `sortLabel`
- src/ui/validation-results-modal.ts: `ValidationIssue`, `typeBadge`

---

## Fix Strategy

### Recommended Order:

1. **Phase 1 - High Priority Issues** (17 fixes)
   - Category 1: Console statements (3)
   - Category 2: Floating promises (13)
   - Category 3: Plugin promise method (1)

2. **Phase 2 - Medium Priority Async/Await Issues** (53 fixes)
   - Category 4: Async arrow function no await (11)
   - Category 5: Promise returned in void context (29)
   - Category 6: Async method no await (12)
   - Category 7: Unexpected any (2)

3. **Phase 3 - Low Priority Cleanup** (279 fixes)
   - Category 8: Sentence case (167) - can be done in batches by file
   - Category 9: Inline styles (43)
   - Category 10: Unnecessary assertions (12)
   - Category 11: innerHTML usage (9)
   - Category 12: Regex space count (9)
   - Category 13: Lexical case declaration (2)
   - Category 14: Template literal (1)
   - Category 15: Unnecessary escape (1)

4. **Phase 4 - Optional** (23 fixes)
   - FileManager.trashFile (1)
   - Unused variables (22)

### Notes:

- Largest concentration of issues in `src/ui/control-center.ts`
- Sentence case fixes are numerous but straightforward
- High/medium priority issues should be addressed first as they relate to async/await correctness and runtime behavior
- Inline styles can be moved to CSS classes in `styles.css`
