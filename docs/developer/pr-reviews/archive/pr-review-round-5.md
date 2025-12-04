# PR Review Round 5 Analysis

**Source:** [PR Comment #3587798652](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3587798652)
**Date:** 2025-11-28
**Branch:** `fix/pr-review-round-5`

## Summary

This review contains **required** fixes in 14 categories plus 1 optional fix.

| Category | Count | Severity |
|----------|-------|----------|
| Sentence case for UI text | 168 | Required |
| Unhandled promise | 5 | Required |
| Async method with no await | 5 | Required |
| Unexpected await of non-Promise | 9 | Required |
| Invalid type "never" in template literal | 1 | Required |
| Promise returned where void expected | 7 | Required |
| innerHTML usage | 11 | Required |
| style.setProperty usage | 3 | Required |
| ESLint directive without description | 1 | Required |
| Disabling no-explicit-any | 1 | Required |
| Unexpected confirm() | 1 | Required |
| Unused import | 1 | Optional |

---

## Required Fixes

### 1. Sentence Case for UI Text (168 instances)

All UI text (`.setName()`, buttons, labels, headings) must use sentence case per Obsidian guidelines.

**Files affected:**

| File | Count |
|------|-------|
| main.ts | 52 |
| src/ui/control-center.ts | 84 |
| src/settings.ts | 10 |
| src/ui/canvas-style-modal.ts | 7 |
| src/core/relationship-manager.ts | 5 |
| src/ui/folder-scan-modal.ts | 4 |
| src/gedcom/gedcom-importer.ts | 2 |
| src/ui/relationship-history-modal.ts | 2 |
| src/gedcom/gedcom-exporter.ts | 1 |
| src/ui/gedcom-import-results-modal.ts | 1 |
| src/ui/views/family-chart-view.ts | 1 |

**Pattern to fix:**
- WRONG: `'Root Person'`, `'Default Node Width'`, `'Tree Configuration'`
- CORRECT: `'Root person'`, `'Default node width'`, `'Tree configuration'`

**Exceptions (keep capitalized):**
- **Proper nouns:** GEDCOM, Canvas, Obsidian, Excalidraw
- **Acronyms:** UUID, ID, PNG, SVG, CSV, PDF
- **Technical terms:** Canvas Roots (plugin name), Family Chart (feature name)
- **Format names:** Ahnentafel, d'Aboville, Henry, Modified Register

**Line references for main.ts:**
- L57, L164, L173, L182, L255, L329, L341, L350, L360, L369, L387, L400, L592, L657, L667, L689, L704, L719, L730, L744, L766, L775, L796, L805, L814, L823, L833, L842, L851, L885, L895, L912, L929, L944, L1014, L1025, L1040, L1058, L1067, L1076, L1097, L1462, L1600, L1748, L1838, L1903, L1969, L1981, L2329, L2488, L2569

**Line references for control-center.ts:**
- L265, L320, L489, L536, L980, L1090, L1107, L1110, L1113, L1130, L1132, L1133, L1136, L1144, L1145, L1184, L1185, L1195, L1200, L1202, L1216, L1236, L1248, L1249, L1261, L1262, L1263, L1270, L1284, L1297, L1314, L1325, L1348, L1353, L1368, L1369, L1370, L1404, L1413, L1414, L1421, L1422, L1447, L1463, L1470, L1471, L1479, L1484, L1485, L1491, L1492, L1623, L1659, L1672, L1676, L1700, L1932, L1936, L1937, L1987, L1993, L1997, L2007, L2031, L2035, L2042, L2046, L2134, L2142, L2788, L2796, L3352, L3361, L3776, L3846, L3853, L3893, L3931, L3945, L3955, L4042, L4113, L4730, L4760

**Line references for settings.ts:**
- L166, L168, L244, L245, L269, L287, L289, L372, L421, L422

**Line references for canvas-style-modal.ts:**
- L74, L91, L107, L123, L143, L163, L178

**Line references for relationship-manager.ts:**
- L63, L69, L71, L107, L143

**Line references for folder-scan-modal.ts:**
- L100, L132, L142, L152

**Line references for gedcom-importer.ts:**
- L146, L163

**Line references for relationship-history-modal.ts:**
- L180, L187

**Line references for gedcom-exporter.ts:**
- L163

**Line references for gedcom-import-results-modal.ts:**
- L35

**Line references for family-chart-view.ts:**
- L301

---

### 2. Unhandled Promise (5 instances)

Promises must be awaited, end with `.catch()`, end with `.then()` with a rejection handler, or be explicitly marked as ignored with `void`.

**File:** main.ts
- L238
- L2613
- L2643

**File:** src/ui/views/family-chart-view.ts
- L182
- L462

**Fix:** Add `void` operator or proper error handling.

---

### 3. Async Method with No Await (5 instances)

**File:** main.ts#L2554
- Method: `showFolderStatistics`
- Fix: Remove `async` keyword (no await needed)

**File:** src/core/lineage-tracking.ts#L269
- Method: `getPersonLineages`
- Fix: Remove `async` keyword (no await needed)

**File:** src/ui/views/family-chart-view.ts#L128
- Method: `onClose`
- Fix: Remove `async` keyword (no await needed)

**File:** src/ui/views/family-chart-view.ts#L676
- Method: `exportAsPng`
- Fix: Remove `async` keyword (no await needed)

**File:** src/ui/views/family-chart-view.ts#L1210
- Async arrow function
- Fix: Remove `async` keyword (no await needed)

---

### 4. Unexpected Await of Non-Promise (9 instances)

These are `await` expressions on values that are not Promises (non-"Thenable").

**File:** src/core/family-graph.ts (7 instances)
- L156, L220, L238, L284, L355, L393, L896

**File:** src/gedcom/gedcom-exporter.ts (1 instance)
- L104

**File:** src/ui/control-center.ts (1 instance)
- L674

**Fix:** Remove the `await` keyword from these expressions.

---

### 5. Invalid Type "never" in Template Literal (1 instance)

**File:** src/core/relationship-history.ts#L516

Template literal expression has invalid type "never".

**Fix:** Add proper type handling or exhaustive type check.

---

### 6. Promise Returned Where Void Expected (7 instances)

**File:** src/ui/relationship-history-modal.ts
- L201-207
- L234-240
- L297-302

**File:** src/ui/views/family-chart-view.ts
- L217
- L288
- L307
- L316-319

Promise is returned in function argument where void return was expected.

**Fix:** Add `void` operator or wrap in IIFE with void.

---

### 7. innerHTML Usage (11 instances)

**File:** src/ui/views/family-chart-view.ts
- L193, L204, L216, L225, L234, L242, L250, L260, L270, L279, L287

Do not write to DOM directly using innerHTML/outerHTML property.

**Fix:** Use DOM API methods like `createEl()`, `setText()`, `createDiv()`, etc.

---

### 8. style.setProperty Usage (3 instances)

**File:** src/ui/views/family-chart-view.ts
- L346, L347, L348

Avoid setting styles directly via `element.style.setProperty`. Use CSS classes for better theming and maintainability.

**Fix:** Use CSS classes or the `setCssProps` function.

---

### 9. ESLint Directive Issues (2 instances)

**File:** src/ui/views/family-chart-view.ts#L467

1. Unexpected undescribed directive comment - Include descriptions to explain why the comment is necessary.
2. Disabling '@typescript-eslint/no-explicit-any' is not allowed.

**Fix:** Remove the eslint-disable comment and fix the underlying type issue.

---

### 10. Unexpected confirm() (1 instance)

**File:** src/ui/views/family-chart-view.ts#L987

Use Obsidian's modal system instead of native `confirm()`.

**Fix:** Replace with Obsidian confirmation modal or custom modal.

---

## Optional Fixes

### 1. Unused Import (1 instance)

**File:** src/ui/relationship-history-modal.ts#L13
- `'HistoryStats'` is defined but never used

**Fix:** Remove the unused import.

---

## Implementation Strategy

### Phase 1: Sentence Case Fixes (Largest batch)
1. Start with main.ts (52 instances)
2. Then control-center.ts (84 instances)
3. Then remaining files

### Phase 2: Promise/Async Fixes
1. Fix 5 unhandled promise issues
2. Remove `async` from 5 methods with no await
3. Remove `await` from 9 non-Promise values
4. Fix 7 promise-in-void-context issues

### Phase 3: DOM/Style Fixes
1. Replace 11 innerHTML usages with DOM API
2. Replace 3 style.setProperty with CSS classes

### Phase 4: ESLint/Type Fixes
1. Fix eslint-disable directive issue
2. Fix "never" type in relationship-history.ts
3. Replace confirm() with Obsidian modal

### Phase 5: Cleanup
1. Remove unused HistoryStats import

---

## Testing Checklist

- [ ] Build passes with no TypeScript errors
- [ ] ESLint passes with no errors
- [ ] All UI text displays correctly in sentence case
- [ ] No console errors related to unhandled promises
- [ ] Plugin loads and functions correctly
- [ ] All modals render correctly
- [ ] Settings page displays correctly
- [ ] Family Chart View renders correctly
- [ ] Export functionality works (PNG, SVG, PDF)
